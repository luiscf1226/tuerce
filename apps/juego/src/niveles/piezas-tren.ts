// Las piezas que estrena El tren bananero (TU-27), menos el Duende (duende.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-tren.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   vagon     un vagón sobre rieles: rueda empujado a lo largo de su lado más largo y se engancha al que toca de
//             punta. El guion se lo puede llevar (`llevar`): deja los rieles y lo mueve él
//   dresina   una plataforma con una bomba de balancín: cada vez que la bomba pasa de un lado al otro la apura por
//             su vía (mecanismos/via.ts). El que agarra la manija de su lado se cuelga de ella y la baja (y sube la
//             otra), así que bombea uno arriba y otro abajo, por turnos; solo, hay que cruzar a la otra punta entre
//             bombeo y bombeo. Lo que va encima viaja con ella
//   racimo    un racimo de guineos: se carga (si no pesa más de lo que levanta un muñeco) y se cuelga de un gancho
//             (el de la grúa, el de la romana)
//   grua      un mástil con un brazo que gira y un gancho: mientras la mandan (`mandar(true)`) baja el gancho; el
//             racimo que alguien le acerca agarrado se engancha, y al soltar la palanca lo sube, gira y lo suelta
//   sombrero  el sombrero del Duende: empieza quieto en su lugar hasta que lo agarran
//
// El racimo y el sombrero los atraviesan los muñecos (como al hueso del pinar) pero los agarran igual; la bomba de la
// dresina también, para que no le pegue en la cabeza al que bombea.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import type { Muneco } from "../muneco";
import type { PiezaDelTrenEnPlano } from "./formato-tren";
import { crearVia, type Via } from "./mecanismos/via";
import type { Herramientas } from "./piezas";
import { GRUPOS_SUELTO, manosEn } from "./piezas-pinar";

/** Grupos del resolvedor sin filtro: se lo encuentra (para agarrarlo) pero no empuja ni lo empujan. */
const SIN_EMPUJAR = ((1 << 5) << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const cuaternion = (q: RAPIER.Rotation) => new THREE.Quaternion(q.x, q.y, q.z, q.w);

/** Cuántos muñecos tienen agarrado ese cuerpo (con una mano o con las dos). */
const cuantosAgarran = (munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody) =>
  munecos.filter((m) => manosEn(m, cuerpo) > 0).length;

/** Lo pone donde estaba al empezar, quieto. */
function devolver(cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3, giro: THREE.Quaternion) {
  cuerpo.setTranslation(vector(posicion), true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
}

/** El ángulo (radianes) que giró `q` respecto de `base` alrededor de `eje` (en el marco de `base`). */
function anguloRelativo(base: THREE.Quaternion, q: THREE.Quaternion, eje: THREE.Vector3): number {
  const r = base.clone().invert().multiply(q);
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return 2 * Math.atan2(r.w < 0 ? -s : s, Math.abs(r.w));
}

/** Los números de las piezas del tren que no se ponen desde Blender. */
export const AJUSTES_TREN = {
  vagon: {
    /** El alto de las ruedas: el cuerpo que choca empieza más arriba (m). */
    ruedas: 0.35,
    /** Con las puntas a menos de esto (m, de costado: tienen que estar en la misma vía) se enganchan. */
    enganchar: 0.25,
    /** Más alto que esto es un furgón, con techo; si no, una plataforma con barandas bajas (m). */
    furgon: 1.5,
  },
  dresina: {
    /** La bomba: medio largo del balancín y medio ancho de cada manija, a lo ancho (m). */
    balancin: 0.6,
    manija: 0.3,
    masa: 3,
    /** Qué parte de su inclinación tiene que pasar la bomba de cada lado para contar un bombeo. */
    umbral: 0.6,
    /** Rozamiento en el eje de la bomba (N·m·s/rad): sin él, la que se suelta sigue de largo. */
    rozamiento: 1.5,
    /** El que se cuelga de su manija la baja a tanto (rad/s), con tanta fuerza en la bisagra (N·m·s/rad): su peso. */
    bajar: 1.2,
    tiron: 150,
    /** Al frenarla, durante tantos pasos el vaivén de la bomba no cuenta. */
    frenada: 90,
    /** Lo que va encima: hasta cuánto por fuera de la plataforma y hasta qué altura sobre ella (m). */
    encima: { margen: 0.1, alto: 1.6 },
  },
  grua: {
    /** El gancho sube y baja a tanto (m/s); el brazo gira a tanto (rad/s). */
    subir: 0.9,
    girar: 0.6,
    /** El gancho engancha el racimo agarrado que le queda a menos de esto (m), si está abajo. */
    enganchar: 0.55,
    /** Sobre la tolva, quieto esto antes de soltar el racimo; después de soltarlo espera esto antes de volver (s). */
    quieto: 1,
    esperar: 0.6,
  },
  racimo: {
    /** Tirado más abajo que esto de donde empezó (m), sin nadie que lo agarre, vuelve solo a los tantos segundos:
     * del suelo no se lo puede levantar (las manos agarran a la altura del pecho). */
    bajo: 0.45,
    vuelveSolo: 3,
  },
} as const;

// ── El vagón ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface Vagon {
  readonly cual: "vagon";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto rodó desde donde empezó (m, positivo hacia su frente). */
  readonly corrido: number;
  /** Los vagones enganchados a este (directamente). */
  readonly enganchados: readonly Vagon[];
  /** La punta de atrás y la de adelante, en el mundo (a la altura del centro de la caja). */
  puntas(): [THREE.Vector3, THREE.Vector3];
  /** Llama a `aviso` cuando se engancha con otro. Devuelve cómo dejar de escuchar. */
  alEnganchar(aviso: (otro: Vagon) => void): () => void;
  /** Lo mueve el guion: la primera vez deja los rieles y los enganches y pasa a cinemático. `posicion` es el centro
   * de su caja. */
  llevar(posicion: THREE.Vector3Like, giro: THREE.Quaternion): void;
}

/** Lo que el vagón necesita de los otros vagones para engancharse. */
interface VagonInterno extends Vagon {
  enganchar(otro: VagonInterno, junta: RAPIER.ImpulseJoint): void;
  soltarEnganches(): void;
}

export function armarVagon(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "vagon" }>): Vagon {
  const { rapier, mundo } = h;
  const a = AJUSTES_TREN.vagon;
  const { centro, medio, giro } = p.caja;
  const enX = medio.x >= medio.z;
  const largo = (enX ? EJE_X : EJE_Z).clone();
  const mitad = enX ? medio.x : medio.z;
  const frente = largo.clone().applyQuaternion(giro);
  // El cuerpo que choca va arriba de las ruedas; las ruedas son solo imagen
  const ruedas = Math.min(a.ruedas, medio.y);
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(1));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y - ruedas / 2, medio.z)
      .setTranslation(0, ruedas / 2, 0)
      .setMass(p.masa)
      .setFriction(0.8),
    cuerpo,
  );
  // Los rieles: un ancla fija y una junta que solo lo deja rodar a lo largo, con su roce
  const ancla = h.fijo(centro, giro);
  const datos = rapier.JointData.prismatic(CERO, CERO, vector(largo));
  datos.limitsEnabled = true;
  datos.limits = [-p.atras, p.adelante];
  let rieles: RAPIER.ImpulseJoint | null = mundo.createImpulseJoint(datos, ancla, cuerpo, true);
  rieles.setContactsEnabled(false);
  if (rieles instanceof rapier.PrismaticImpulseJoint) {
    rieles.configureMotorModel(rapier.MotorModel.ForceBased);
    rieles.configureMotorVelocity(0, p.roce);
  }

  const objeto = crearImagenVagon(medio, enX, ruedas, medio.y * 2 > a.furgon, h);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  const enganches: { otro: VagonInterno; junta: RAPIER.ImpulseJoint }[] = [];
  const avisos = new Set<(otro: Vagon) => void>();
  let llevado = false;
  const centroAhora = new THREE.Vector3();

  const vagon: VagonInterno = {
    cual: "vagon",
    nombre: p.nombre,
    cuerpo,
    get corrido() {
      const t = cuerpo.translation();
      return (t.x - centro.x) * frente.x + (t.y - centro.y) * frente.y + (t.z - centro.z) * frente.z;
    },
    get enganchados() {
      return enganches.map((e) => e.otro);
    },
    puntas() {
      const q = cuaternion(cuerpo.rotation());
      const c = centroAhora.copy(cuerpo.translation());
      const eje = largo.clone().applyQuaternion(q).multiplyScalar(mitad);
      return [c.clone().sub(eje), c.clone().add(eje)];
    },
    alEnganchar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    llevar(posicion, q) {
      if (!llevado) {
        llevado = true;
        if (rieles) mundo.removeImpulseJoint(rieles, true);
        rieles = null;
        vagon.soltarEnganches();
        cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        cuerpo.setTranslation(vector(posicion), true);
        cuerpo.setRotation(q, true);
      }
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(q);
    },
    enganchar(otro, junta) {
      enganches.push({ otro, junta });
      for (const aviso of avisos) aviso(otro);
    },
    soltarEnganches() {
      for (const e of enganches.splice(0)) {
        if (mundo.getImpulseJoint(e.junta.handle)) mundo.removeImpulseJoint(e.junta, true);
        e.otro.soltarEnganches();
      }
    },
  };

  // Enganchar: la punta de adelante de este contra la de atrás de otro vagón de la misma vía
  h.despues(() => {
    if (llevado) return;
    const [, adelante] = vagon.puntas();
    for (const pieza of h.lista) {
      if (pieza.cual !== "vagon" || pieza === vagon) continue;
      const otro = pieza as VagonInterno;
      if (enganches.some((e) => e.otro === otro)) continue;
      const [atras] = otro.puntas();
      if (Math.hypot(adelante.x - atras.x, adelante.z - atras.z) > a.enganchar) continue;
      if (Math.abs(adelante.y - atras.y) > 1) continue;
      // Una rótula en el punto del enganche: con los dos en sus rieles, quedan a la misma distancia
      const q1 = cuaternion(cuerpo.rotation()).invert();
      const q2 = cuaternion(otro.cuerpo.rotation()).invert();
      const t1 = cuerpo.translation();
      const t2 = otro.cuerpo.translation();
      const ancla1 = adelante.clone().sub(t1).applyQuaternion(q1);
      const ancla2 = adelante.clone().sub(t2).applyQuaternion(q2);
      const junta = mundo.createImpulseJoint(
        rapier.JointData.spherical(vector(ancla1), vector(ancla2)),
        cuerpo,
        otro.cuerpo,
        true,
      );
      junta.setContactsEnabled(false);
      vagon.enganchar(otro, junta);
      otro.enganchar(vagon, junta);
    }
  });
  return vagon;
}

/** Un vagón mirando hacia +x (o +z si `enX` es falso) del tamaño de `medio`: plataforma con barandas bajas, o
 * furgón con techo y puerta corrediza. Las ruedas abajo, en `ruedas` de alto. */
function crearImagenVagon(
  medio: THREE.Vector3,
  enX: boolean,
  ruedas: number,
  furgon: boolean,
  h: Herramientas,
): THREE.Object3D {
  const mitad = enX ? medio.x : medio.z;
  const ancho = enX ? medio.z : medio.x;
  const piso = -medio.y + ruedas;
  const madera: THREE.BufferGeometry[] = [];
  const hierro: THREE.BufferGeometry[] = [];
  const caja = (lista: THREE.BufferGeometry[], x: number, y: number, z: number, l: number, a: number, f: number) =>
    lista.push(new THREE.BoxGeometry(l, a, f).translate(x, y, z));
  // El chasis y las puntas con sus topes (los paragolpes)
  caja(hierro, 0, piso + 0.06, 0, mitad * 2, 0.12, ancho * 1.6);
  for (const s of [-1, 1]) {
    caja(hierro, s * (mitad - 0.04), piso + 0.12, 0, 0.08, 0.2, ancho * 2);
    for (const z of [-0.6, 0.6]) {
      hierro.push(
        new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8)
          .rotateZ(Math.PI / 2)
          .translate(s * (mitad + 0.04), piso + 0.12, z * ancho),
      );
    }
  }
  // Dos bogies de dos ejes, con sus ruedas
  for (const sx of [-1, 1]) {
    const bx = sx * mitad * 0.62;
    caja(hierro, bx, -medio.y + ruedas * 0.6, 0, 1.0, 0.12, ancho * 1.5);
    for (const dx of [-0.32, 0.32])
      for (const sz of [-1, 1]) {
        hierro.push(
          new THREE.CylinderGeometry(ruedas * 0.48, ruedas * 0.48, 0.07, 14)
            .rotateX(Math.PI / 2)
            .translate(bx + dx, -medio.y + ruedas * 0.48, sz * ancho * 0.72),
        );
      }
  }
  if (furgon) {
    // La caja de tablas, el techo un poco abombado y la puerta corrediza (más oscura) a cada lado
    const alto = medio.y * 2 - ruedas - 0.12 - 0.12;
    const y0 = piso + 0.12;
    caja(madera, 0, y0 + alto / 2, 0, mitad * 2 - 0.1, alto, ancho * 2 - 0.06);
    madera.push(
      new THREE.CylinderGeometry(ancho * 1.08, ancho * 1.08, mitad * 2 + 0.06, 18)
        .rotateZ(Math.PI / 2)
        .scale(1, 0.22, 1)
        .translate(0, y0 + alto, 0),
    );
    for (const s of [-1, 1]) {
      caja(hierro, 0.15, y0 + alto * 0.45, s * ancho, mitad * 0.7, alto * 0.82, 0.04);
      for (const x of [-mitad * 0.8, mitad * 0.8]) caja(hierro, x, y0 + alto / 2, s * ancho, 0.06, alto, 0.05);
    }
  } else {
    // El piso de tablas y las barandas bajas, con parantes
    caja(madera, 0, piso + 0.18, 0, mitad * 2 - 0.04, 0.08, ancho * 2 - 0.04);
    const baranda = medio.y * 2 - ruedas - 0.22;
    if (baranda > 0.05)
      for (const s of [-1, 1]) {
        caja(madera, 0, piso + 0.22 + baranda / 2, s * (ancho - 0.04), mitad * 2 - 0.04, baranda, 0.06);
        caja(madera, s * (mitad - 0.04), piso + 0.22 + baranda / 2, 0, 0.06, baranda, ancho * 2 - 0.04);
        for (let i = 0; i <= 4; i++)
          caja(hierro, -mitad + (i * mitad) / 2, piso + 0.22 + baranda / 2, s * ancho, 0.07, baranda + 0.04, 0.08);
      }
  }
  const grupo = new THREE.Group();
  const imagen = new THREE.Group();
  imagen.add(new THREE.Mesh(juntar(madera), h.madera), new THREE.Mesh(juntar(hierro), h.oscuro));
  if (!enX) imagen.rotation.y = -Math.PI / 2;
  grupo.add(imagen);
  return grupo;
}

// ── La dresina ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Dresina {
  readonly cual: "dresina";
  readonly nombre: string;
  /** La plataforma (cinemática: la mueve esta pieza por su vía) y la bomba (dinámica, con bisagra en su poste). */
  readonly plataforma: RAPIER.RigidBody;
  readonly bomba: RAPIER.RigidBody;
  /** Cuánto anduvo por su vía desde el principio (m) y a qué velocidad va (m/s, negativa si va para atrás). */
  readonly avance: number;
  readonly velocidad: number;
  /** Si pasó el cambio por el desvío. */
  readonly porElDesvio: boolean;
  /** Cuántas veces la bombearon (cada vez que la bomba pasó de un lado al otro). */
  readonly bombeos: number;
  /** La bomba: positiva con la manija del frente arriba (radianes). */
  readonly inclinacion: number;
  /** Cuántos muñecos van encima. */
  readonly montados: number;
  /** Al llegar al final de su vía (o del desvío) y frenar contra el tope. */
  readonly enElTope: boolean;
  /** Le da su vía: desde el principio, y en el cambio pregunta `cambio()` (si va por el desvío). La deja quieta al
   * principio de la vía. */
  seguir(via: Via, cambio?: () => boolean): void;
  /** La pone quieta a `s` metros del principio (por el desvío o no), con lo que lleva encima. */
  poner(s: number, porElDesvio?: boolean): void;
  /** La para en seco (y el próximo vaivén de la bomba no cuenta: hay que bombearla de nuevo, de los dos lados). */
  frenar(): void;
  /** Llama a `aviso` en cada bombeo. Devuelve cómo dejar de escuchar. */
  alBombear(aviso: () => void): () => void;
}

export function armarDresina(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "dresina" }>): Dresina {
  const { rapier, mundo } = h;
  const a = AJUSTES_TREN.dresina;
  const { medio, giro } = p.caja;
  // La vía por omisión: derecho hacia su frente (su +x), desde arriba de la plataforma
  const arribaDeLaCaja = h.enElMundo(p, 0, medio.y, 0);
  const frente = EJE_X.clone().applyQuaternion(giro).multiplyScalar(p.recorrido).add(arribaDeLaCaja);
  let via: Via = crearVia([arribaDeLaCaja.toArray(), frente.toArray()]);
  let cambio: () => boolean = () => false;

  /** El centro de la plataforma con su parte de arriba en `pose.posicion`. */
  const centroDe = (posicion: THREE.Vector3, q: THREE.Quaternion) =>
    new THREE.Vector3(0, -medio.y, 0).applyQuaternion(q).add(posicion);
  const inicio = via.pose(0);
  const plataforma = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(...centroDe(inicio.posicion, inicio.giro).toArray())
      .setRotation(inicio.giro),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setFriction(1),
    plataforma,
  );

  // La bomba: un balancín a lo largo de la plataforma con una manija a lo ancho en cada punta, sobre un poste
  const eje = new THREE.Vector3(0, medio.y + p.bomba, 0);
  const radio = 0.035;
  const enLaBomba = (q: THREE.Quaternion, c: THREE.Vector3) => eje.clone().applyQuaternion(q).add(c);
  const bomba = mundo.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(...enLaBomba(inicio.giro, centroDe(inicio.posicion, inicio.giro)).toArray())
      .setRotation(inicio.giro)
      .setAngularDamping(0.5),
  );
  const travesano = new THREE.Quaternion().setFromAxisAngle(EJE_X, Math.PI / 2);
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.balancin, 0.04, 0.05)
      .setMass(a.masa * 0.6)
      .setCollisionGroups(GRUPOS_SUELTO)
      .setSolverGroups(SIN_EMPUJAR),
    bomba,
  );
  /** De qué lado es cada manija: +1 la del frente, −1 la de atrás (por el colisionador que agarra la mano). */
  const manijas = new Map<number, number>();
  for (const s of [-1, 1]) {
    const manija = mundo.createCollider(
      rapier.ColliderDesc.capsule(a.manija, radio * 1.4)
        .setTranslation(s * a.balancin, 0, 0)
        .setRotation(travesano)
        .setMass(a.masa * 0.2)
        .setFriction(0.9)
        .setCollisionGroups(GRUPOS_SUELTO)
        .setSolverGroups(SIN_EMPUJAR),
      bomba,
    );
    manijas.set(manija.handle, s);
  }
  const junta = mundo.createImpulseJoint(
    rapier.JointData.revolute(vector(eje), CERO, vector(EJE_Z)),
    plataforma,
    bomba,
    true,
  );
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.RevoluteImpulseJoint) {
    // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
    junta.setLimits(-p.angulo, p.angulo);
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorVelocity(0, a.rozamiento);
  }

  const imagen = crearImagenDresina(medio, p.bomba, h);
  imagen.name = p.nombre;
  h.mover(plataforma, imagen);
  const imagenBomba = new THREE.Group();
  imagenBomba.add(
    new THREE.Mesh(new THREE.BoxGeometry(a.balancin * 2, 0.08, 0.1), h.madera),
    ...[-1, 1].map((s) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(radio * 1.4, a.manija * 2, 4, 8), h.oscuro);
      m.position.x = s * a.balancin;
      m.quaternion.copy(travesano);
      return m;
    }),
  );
  h.mover(bomba, imagenBomba);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo: plataforma, colisionador });

  let s = 0;
  let v = 0;
  let porElDesvio = false;
  let bombeos = 0;
  let ultimoLado = 0;
  let montados = 0;
  let enElTope = false;
  const avisos = new Set<() => void>();
  const sacarPose = (donde: number, desvio: boolean) => {
    const pose = via.pose(donde, desvio);
    return { centro: centroDe(pose.posicion, pose.giro), giro: pose.giro, pendiente: pose.pendiente };
  };
  const finDeVia = () => (porElDesvio && s >= via.cambio ? via.largoDesvio : via.largo);

  /** Lo que va encima: el muñeco con la pelvis sobre la plataforma (en su marco), hasta `encima.alto`. */
  const local = new THREE.Vector3();
  const vaEncima = (m: Muneco, centro: THREE.Vector3, q: THREE.Quaternion) => {
    const t = m.partes.pelvis.translation();
    local.set(t.x - centro.x, t.y - centro.y, t.z - centro.z).applyQuaternion(q.clone().invert());
    const alto = local.y - medio.y;
    return (
      Math.abs(local.x) <= medio.x + a.encima.margen &&
      Math.abs(local.z) <= medio.z + a.encima.margen &&
      alto > 0 &&
      alto < a.encima.alto
    );
  };

  /** Lleva la plataforma (y la bomba, y lo que va encima) a la pose de `s`. `ya`: sin pasar por el medio. */
  // La plataforma se mueve a saltitos (no con velocidad de cinemático): así no arrastra los pies de los que van
  // encima, que se corren con ella igual que la bomba
  const mover = (munecos: readonly Muneco[] | null, ya: boolean) => {
    const pose = sacarPose(s, porElDesvio);
    const antesC = new THREE.Vector3().copy(plataforma.translation());
    const antesQ = cuaternion(plataforma.rotation());
    const delta = pose.giro.clone().multiply(antesQ.clone().invert());
    const p = new THREE.Vector3();
    /** Corre el cuerpo con la plataforma: mismo giro y mismo corrimiento, alrededor de su centro. */
    const llevar = (c: RAPIER.RigidBody) => {
      p.copy(c.translation()).sub(antesC).applyQuaternion(delta).add(pose.centro);
      c.setTranslation(vector(p), true);
      c.setRotation(delta.clone().multiply(cuaternion(c.rotation())), true);
    };
    if (munecos) {
      montados = 0;
      for (const m of munecos) {
        if (!vaEncima(m, antesC, antesQ)) continue;
        montados++;
        for (const parte of Object.values(m.partes)) llevar(parte);
      }
    }
    if (ya) {
      bomba.setTranslation(vector(enLaBomba(pose.giro, pose.centro)), true);
      bomba.setRotation(pose.giro, true);
      bomba.setLinvel(CERO, true);
      bomba.setAngvel(CERO, true);
    } else llevar(bomba);
    plataforma.setTranslation(vector(pose.centro), true);
    plataforma.setRotation(pose.giro, true);
    return pose;
  };

  const dresina: Dresina = {
    cual: "dresina",
    nombre: p.nombre,
    plataforma,
    bomba,
    get avance() {
      return s;
    },
    get velocidad() {
      return v;
    },
    get porElDesvio() {
      return porElDesvio && s >= via.cambio;
    },
    get bombeos() {
      return bombeos;
    },
    get inclinacion() {
      return anguloRelativo(cuaternion(plataforma.rotation()), cuaternion(bomba.rotation()), EJE_Z);
    },
    get montados() {
      return montados;
    },
    get enElTope() {
      return enElTope;
    },
    seguir(nueva, cambiar) {
      via = nueva;
      cambio = cambiar ?? (() => false);
      dresina.poner(0);
    },
    poner(donde, desvio = false) {
      porElDesvio = desvio;
      s = limitar(donde, 0, finDeVia());
      v = 0;
      mover(null, true);
    },
    frenar() {
      v = 0;
      // El vaivén que le queda a la bomba no cuenta como bombeo
      ultimoLado = 0;
      sinBombear = a.frenada;
    },
    alBombear(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };

  const punta = new THREE.Vector3();
  let tirando = 0;
  /** Después de frenar, cuántos pasos más no cuenta los bombeos. */
  let sinBombear = 0;
  h.antes((munecos) => {
    // El que agarra una manija se cuelga de ella y la baja con su peso (si el otro no agarra la suya)
    let tiran = 0;
    const lados = new Set<number>();
    const qBomba = cuaternion(bomba.rotation()).invert();
    for (const m of munecos) {
      if (manosEn(m, bomba) === 0) continue;
      // Tira de la punta de su lado (la de la manija que agarra, o la más cerca si agarra el balancín)
      const agarrada = ["brazoIzquierdo", "brazoDerecho"]
        .map((b) => manijas.get(m.agarrado(b as "brazoIzquierdo" | "brazoDerecho")?.handle ?? -1))
        .find((l) => l !== undefined);
      const t = m.partes.pelvis.translation();
      const x = punta.set(t.x, t.y, t.z).sub(bomba.translation()).applyQuaternion(qBomba).x;
      lados.add(agarrada ?? (x < 0 ? -1 : 1));
    }
    if (lados.size === 1) tiran = lados.has(1) ? 1 : -1;
    // La bisagra de la bomba lleva hacia abajo la punta del que se cuelga; sin nadie (o con los dos), solo roza
    if (tiran !== tirando && junta instanceof rapier.RevoluteImpulseJoint) {
      tirando = tiran;
      if (tiran === 0) junta.configureMotorVelocity(0, a.rozamiento);
      // Bajar la punta de +x es girar hacia −z (ángulo negativo)
      else junta.configureMotorVelocity(-tiran * a.bajar, a.tiron);
    }
    // Bombear: la bomba pasó del todo de un lado al otro
    const inclinacion = dresina.inclinacion;
    const lado = inclinacion >= p.angulo * a.umbral ? 1 : inclinacion <= -p.angulo * a.umbral ? -1 : 0;
    sinBombear = Math.max(0, sinBombear - 1);
    if (sinBombear > 0) ultimoLado = 0;
    else if (lado !== 0 && lado !== ultimoLado) {
      if (ultimoLado !== 0) {
        bombeos++;
        v = Math.min(p.velocidad, v + p.impulso);
        for (const aviso of avisos) aviso();
      }
      ultimoLado = lado;
    }
    // Andar por la vía: la cuesta la frena (o la apura de bajada) y los rieles la frenan de a poco
    const pendiente = sacarPose(s, porElDesvio).pendiente;
    v += (GRAVEDAD * pendiente - p.roce * v) * PASO;
    if (Math.abs(v) < 0.01 && Math.abs(pendiente) < 0.005) v = 0;
    v = limitar(v, -p.velocidad, p.velocidad);
    const antes = s;
    s += v * PASO;
    // En el cambio decide por dónde sigue
    if (antes < via.cambio && s >= via.cambio) porElDesvio = cambio();
    const fin = finDeVia();
    enElTope = false;
    if (s <= 0) {
      s = 0;
      v = Math.max(0, v);
    } else if (s >= fin) {
      s = fin;
      v = Math.min(0, v);
      enElTope = true;
    }
    mover(munecos, false);
  });
  return dresina;
}

/** La plataforma de la dresina, del tamaño de `medio`, con el poste de la bomba (de `bomba` de alto). */
function crearImagenDresina(medio: THREE.Vector3, bomba: number, h: Herramientas): THREE.Object3D {
  const madera: THREE.BufferGeometry[] = [];
  const hierro: THREE.BufferGeometry[] = [];
  // Tablas a lo ancho, con luz entre ellas, sobre dos largueros
  const tablas = Math.max(3, Math.round((medio.x * 2) / 0.2));
  for (let i = 0; i < tablas; i++) {
    const x = -medio.x + ((i + 0.5) * medio.x * 2) / tablas;
    madera.push(
      new THREE.BoxGeometry((medio.x * 2) / tablas - 0.02, 0.06, medio.z * 2).translate(x, medio.y - 0.03, 0),
    );
  }
  for (const s of [-1, 1])
    hierro.push(new THREE.BoxGeometry(medio.x * 2, medio.y * 2 - 0.06, 0.1).translate(0, -0.03, s * medio.z * 0.7));
  // Cuatro ruedas, por debajo
  for (const x of [-medio.x * 0.6, medio.x * 0.6])
    for (const z of [-1, 1]) {
      hierro.push(
        new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14)
          .rotateX(Math.PI / 2)
          .translate(x, -medio.y - 0.08, z * medio.z * 0.72),
      );
    }
  // El poste de la bomba, con dos patas abiertas para que se lea firme
  hierro.push(new THREE.CylinderGeometry(0.05, 0.07, bomba, 8).translate(0, medio.y + bomba / 2, 0));
  for (const s of [-1, 1])
    hierro.push(
      new THREE.BoxGeometry(0.05, bomba * 0.55, 0.05).rotateZ(s * 0.35).translate(s * 0.1, medio.y + bomba * 0.25, 0),
    );
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(juntar(madera), h.madera), new THREE.Mesh(juntar(hierro), h.oscuro));
  return grupo;
}

// ── El racimo ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Racimo {
  readonly cual: "racimo";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly agarrado: number;
  /** Si cuelga de un gancho (el de la grúa o el de la romana). */
  readonly colgado: boolean;
  /** Si está donde empezó (no lo movieron todavía o ya volvió). */
  readonly enSuLugar: boolean;
  /** Lo pone donde estaba al empezar, quieto y dormido. Pasa solo si se cae al vacío o queda tirado en el suelo. */
  volver(): void;
  /** Lo cuelga de la punta de su tallo en `punto` (en el mundo) de ese cuerpo, con una rótula. */
  colgarDe(cuerpo: RAPIER.RigidBody, punto: THREE.Vector3Like): void;
  /** Lo suelta del gancho. */
  descolgar(): void;
}

export function armarRacimo(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "racimo" }>): Racimo {
  const { rapier, mundo } = h;
  const a = AJUSTES_TREN.racimo;
  const { centro, medio, giro } = p.caja;
  // Empieza dormido: así se queda quieto en su gancho hasta que lo agarren (la mano lo despierta)
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setSleeping(true));
  const radio = Math.max(0.05, Math.min(medio.x, medio.z));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(medio.y, radio).setMass(p.masa).setFriction(0.9).setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenRacimo({ alto: medio.y * 2, radio, semilla: p.nombre.length }, h.oscuro);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let agarrado = 0;
  let colgado: RAPIER.ImpulseJoint | null = null;
  let tirado = 0;
  const racimo: Racimo = {
    cual: "racimo",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get colgado() {
      return colgado !== null;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.05;
    },
    volver() {
      racimo.descolgar();
      devolver(cuerpo, centro, giro);
      cuerpo.sleep();
    },
    colgarDe(otro, punto) {
      racimo.descolgar();
      const q = cuaternion(otro.rotation()).invert();
      const t = otro.translation();
      const ancla = new THREE.Vector3(punto.x - t.x, punto.y - t.y, punto.z - t.z).applyQuaternion(q);
      colgado = mundo.createImpulseJoint(
        rapier.JointData.spherical(vector(ancla), { x: 0, y: medio.y, z: 0 }),
        otro,
        cuerpo,
        true,
      );
      colgado.setContactsEnabled(false);
    },
    descolgar() {
      if (colgado && mundo.getImpulseJoint(colgado.handle)) mundo.removeImpulseJoint(colgado, true);
      colgado = null;
    },
  };
  h.despues((munecos, fuera) => {
    agarrado = cuantosAgarran(munecos, cuerpo);
    const t = cuerpo.translation();
    const enElSuelo = agarrado === 0 && colgado === null && t.y < centro.y - a.bajo;
    tirado = enElSuelo ? tirado + PASO : 0;
    if (fuera(t) || tirado > a.vuelveSolo) {
      racimo.volver();
      tirado = 0;
    }
  });
  return racimo;
}

/** Un racimo de guineos de `alto`, colgando de su tallo: manos de dedos que apuntan hacia arriba alrededor del tallo,
 * más gordas abajo. `dorado`: el de los mínimos dorados del secreto, de dedos chiquitos y claros que brillan (sin
 * color: el único color del juego son los pañuelos). */
export function crearImagenRacimo(
  o: { alto: number; radio: number; semilla?: number; dorado?: boolean },
  material?: THREE.Material,
): THREE.Group {
  const grupo = new THREE.Group();
  const { alto, radio } = o;
  const semilla = o.semilla ?? 1;
  const tallo: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(radio * 0.12, radio * 0.16, alto * 1.15, 6).translate(0, alto * 0.08, 0),
    // La flor (la bellota) que cuelga abajo
    new THREE.ConeGeometry(radio * 0.22, alto * 0.22, 6).rotateX(Math.PI).translate(0, -alto * 0.6, 0),
  ];
  const dedos: THREE.BufferGeometry[] = [];
  const manos = 5;
  const largoDedo = o.dorado ? radio * 0.55 : radio * 0.85;
  const gruesoDedo = o.dorado ? radio * 0.11 : radio * 0.17;
  for (let i = 0; i < manos; i++) {
    const y = alto * (0.35 - (i / (manos - 1)) * 0.7);
    const abierto = radio * (0.45 + 0.3 * Math.sin(((i + 0.5) / manos) * Math.PI));
    const cuantos = o.dorado ? 9 : 7;
    for (let j = 0; j < cuantos; j++) {
      const angulo = (j / cuantos) * Math.PI * 2 + i * 0.7 + semilla;
      dedos.push(
        new THREE.CapsuleGeometry(gruesoDedo, largoDedo, 3, 6)
          // Cada dedo apunta hacia afuera y hacia arriba, curvado como un guineo
          .rotateZ(-0.55)
          .translate(abierto, largoDedo * 0.25, 0)
          .rotateY(angulo)
          .translate(0, y, 0),
      );
    }
  }
  const oscuro = material ?? materialTela(COLORES.silueta, { repetir: 1, pelusa: false });
  if (o.dorado) {
    // Los mínimos dorados: claros y con un brillo blanco, como los ojos, y unas chispas alrededor
    const claro = new THREE.MeshStandardMaterial({
      name: "dorado",
      color: COLORES.siluetaLejana,
      emissive: COLORES.ojo,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.2,
    });
    grupo.add(new THREE.Mesh(juntar(tallo), oscuro), new THREE.Mesh(juntar(dedos), claro));
    const chispas: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4 + semilla;
      chispas.push(
        new THREE.OctahedronGeometry(radio * 0.12)
          .scale(0.5, 1.6, 0.5)
          .translate(Math.cos(a) * radio * 1.5, alto * (0.5 - (i % 4) * 0.3), Math.sin(a) * radio * 1.5),
      );
    }
    grupo.add(new THREE.Mesh(juntar(chispas), materialOjo()));
  } else {
    grupo.add(new THREE.Mesh(juntar([...tallo, ...dedos]), oscuro));
  }
  return grupo;
}

// ── El sombrero ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Sombrero {
  readonly cual: "sombrero";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly agarrado: number;
  readonly enSuLugar: boolean;
  /** Si ya lo tiene puesto el Duende. */
  readonly puesto: boolean;
  /** Lo pone donde estaba al empezar, quieto y dormido. */
  volver(): void;
  /** Se lo pone alguien: deja de caerse y de volver solo, y va donde lo lleven (`llevar`). */
  ponerse(): void;
  llevar(posicion: THREE.Vector3Like, giro: THREE.Quaternion): void;
}

export function armarSombrero(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "sombrero" }>): Sombrero {
  const { rapier, mundo } = h;
  const a = AJUSTES_TREN.racimo;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setSleeping(true));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(medio.y, Math.max(medio.x, medio.z))
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenSombrero(Math.max(medio.x, medio.z), medio.y * 2, h.oscuro);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let agarrado = 0;
  let puesto = false;
  let tirado = 0;
  const sombrero: Sombrero = {
    cual: "sombrero",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.05;
    },
    get puesto() {
      return puesto;
    },
    volver() {
      devolver(cuerpo, centro, giro);
      cuerpo.sleep();
    },
    ponerse() {
      if (puesto) return;
      puesto = true;
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    },
    llevar(posicion, q) {
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(q);
    },
  };
  h.despues((munecos, fuera) => {
    if (puesto) return;
    agarrado = cuantosAgarran(munecos, cuerpo);
    const t = cuerpo.translation();
    tirado = agarrado === 0 && t.y < centro.y - a.bajo ? tirado + PASO : 0;
    if (fuera(t) || tirado > a.vuelveSolo * 2) {
      sombrero.volver();
      tirado = 0;
    }
  });
  return sombrero;
}

/** El sombrerón del Duende: un ala ancha y una copa puntuda, con una cinta. */
export function crearImagenSombrero(radio: number, alto: number, material: THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(radio, radio * 0.97, alto * 0.14, 24).translate(0, -alto * 0.43, 0),
        new THREE.ConeGeometry(radio * 0.45, alto * 0.86, 14).translate(0, alto * 0.07, 0),
      ]),
      material,
    ),
  );
  // La cinta, un poco más clara para que se lea la forma
  const cinta = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.42, radio * 0.44, alto * 0.1, 14).translate(0, -alto * 0.3, 0),
    new THREE.MeshStandardMaterial({ name: "cinta", color: COLORES.siluetaLejana, roughness: 0.8 }),
  );
  grupo.add(cinta);
  return grupo;
}

// ── La grúa ──────────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoGrua = "arriba" | "bajando" | "subiendo" | "llevando" | "girando" | "soltando" | "volviendo";

export interface Grua {
  readonly cual: "grua";
  readonly nombre: string;
  /** El brazo (gira arriba del mástil) y el gancho: cinemáticos, los mueve esta pieza. */
  readonly brazo: RAPIER.RigidBody;
  readonly gancho: RAPIER.RigidBody;
  readonly estado: EstadoGrua;
  /** A qué altura está el gancho sobre la base del mástil (m) y cuánto giró el brazo desde donde recoge (rad). */
  readonly altura: number;
  readonly giro: number;
  /** El racimo que lleva enganchado, o `null`. */
  readonly racimo: Racimo | null;
  /** Lo que manda la palanca de la cabina en este paso: mientras es `true`, el gancho baja a recoger. */
  mandar(bajar: boolean): void;
  /** Llama a `aviso` al enganchar un racimo y al soltarlo. Devuelven cómo dejar de escuchar. */
  alEnganchar(aviso: (racimo: Racimo) => void): () => void;
  alSoltar(aviso: (racimo: Racimo) => void): () => void;
  /** La deja arriba, quieta, donde recoge (al retomar). */
  volver(): void;
}

export function armarGrua(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "grua" }>): Grua {
  const { rapier, mundo } = h;
  const a = AJUSTES_TREN.grua;
  const { medio, giro } = p.caja;
  const base = h.enElMundo(p, 0, -medio.y, 0);
  const cima = h.enElMundo(p, 0, medio.y, 0);
  // El mástil: choca como su caja
  const mastil = h.fijo(h.enElMundo(p, 0, 0, 0), giro);
  mundo.createCollider(rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z), mastil);
  h.escena.add(posar(crearImagenMastil(medio, h), h.enElMundo(p, 0, 0, 0), giro));

  // El brazo apunta hacia el frente de la caja (su +z) cuando recoge, y gira `p.giro` hacia la izquierda para soltar
  const frente = EJE_Z.clone().applyQuaternion(giro);
  const rumboRecoger = Math.atan2(frente.x, frente.z);
  const giroBrazo = (angulo: number) => new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumboRecoger + angulo);
  const sinChoques = () => rapier.ColliderDesc.ball(0.2).setSensor(true).setCollisionGroups(0);
  const brazo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(cima.x, cima.y, cima.z).setRotation(giroBrazo(0)),
  );
  mundo.createCollider(sinChoques(), brazo);
  const imagenBrazo = crearImagenBrazo(p.brazo, h);
  imagenBrazo.name = p.nombre;
  h.mover(brazo, imagenBrazo);

  const puntaDe = (angulo: number) =>
    new THREE.Vector3(0, 0, p.brazo).applyQuaternion(giroBrazo(angulo)).add(cima).setY(cima.y);
  const ganchoEn = (angulo: number, altura: number) => puntaDe(angulo).setY(base.y + altura);
  const inicio = ganchoEn(0, p.alto);
  const gancho = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(inicio.x, inicio.y, inicio.z),
  );
  const colisionador = mundo.createCollider(sinChoques(), gancho);
  const imagenGancho = crearImagenGancho(h);
  h.mover(gancho, imagenGancho);
  h.solida({ nombre: p.nombre, objeto: imagenBrazo, cuerpo: brazo, colisionador });
  // El cable, de la punta del brazo al gancho: se estira cada vez que se dibuja
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1, 5), h.oscuro);
  h.escena.add(cable);

  let estado: EstadoGrua = "arriba";
  let altura = p.alto;
  let angulo = 0;
  let bajar = false;
  let espera = 0;
  let racimo: Racimo | null = null;
  const enganches = new Set<(r: Racimo) => void>();
  const sueltas = new Set<(r: Racimo) => void>();
  /** Lleva `x` hacia `objetivo` a `velocidad` por segundo; devuelve si llegó. */
  const acercar = (x: number, objetivo: number, velocidad: number) => {
    const paso = velocidad * PASO;
    return Math.abs(objetivo - x) <= paso ? objetivo : x + Math.sign(objetivo - x) * paso;
  };

  /** El racimo agarrado más cerca del gancho, si le queda a menos de `enganchar`. */
  const racimoAMano = (): Racimo | null => {
    const g = gancho.translation();
    let mejor: Racimo | null = null;
    let distancia: number = a.enganchar;
    for (const pieza of h.lista) {
      if (pieza.cual !== "racimo" || pieza.agarrado === 0 || pieza.colgado) continue;
      const t = pieza.cuerpo.translation();
      const d = Math.hypot(t.x - g.x, t.y - g.y, t.z - g.z);
      if (d < distancia + 0.3) {
        distancia = d - 0.3;
        mejor = pieza;
      }
    }
    return mejor;
  };

  const grua: Grua = {
    cual: "grua",
    nombre: p.nombre,
    brazo,
    gancho,
    get estado() {
      return estado;
    },
    get altura() {
      return altura;
    },
    get giro() {
      return angulo;
    },
    get racimo() {
      return racimo;
    },
    mandar(valor) {
      bajar = valor;
    },
    alEnganchar(aviso) {
      enganches.add(aviso);
      return () => {
        enganches.delete(aviso);
      };
    },
    alSoltar(aviso) {
      sueltas.add(aviso);
      return () => {
        sueltas.delete(aviso);
      };
    },
    volver() {
      if (racimo) soltarRacimo();
      estado = "arriba";
      altura = p.alto;
      angulo = 0;
      espera = 0;
      const g = ganchoEn(angulo, altura);
      gancho.setTranslation(vector(g), true);
      brazo.setRotation(giroBrazo(angulo), true);
      gancho.setNextKinematicTranslation(vector(g));
      brazo.setNextKinematicRotation(giroBrazo(angulo));
    },
  };
  const enganchar = (r: Racimo) => {
    // Una rótula en el gancho: el racimo cuelga de la punta de su tallo
    r.colgarDe(gancho, gancho.translation());
    racimo = r;
    for (const aviso of enganches) aviso(r);
  };

  h.antes(() => {
    switch (estado) {
      case "arriba":
        altura = acercar(altura, p.alto, a.subir);
        angulo = acercar(angulo, 0, a.girar);
        if (bajar) estado = "bajando";
        break;
      case "bajando":
        altura = acercar(altura, p.bajo, a.subir);
        if (!bajar) estado = racimo ? "llevando" : "subiendo";
        break;
      case "subiendo":
        altura = acercar(altura, p.alto, a.subir);
        if (bajar) estado = "bajando";
        else if (altura === p.alto) estado = "arriba";
        break;
      case "llevando":
        altura = acercar(altura, p.alto, a.subir);
        if (altura === p.alto) estado = "girando";
        break;
      case "girando":
        // Frena al llegar, para que el racimo no salga columpiándose
        angulo = acercar(angulo, p.giro, Math.max(0.12, Math.min(a.girar, Math.abs(p.giro - angulo) * 1.5)));
        if (angulo === p.giro) {
          estado = "soltando";
          espera = a.quieto + a.esperar;
        }
        break;
      case "soltando":
        espera -= PASO;
        // Quieto un ratito sobre la tolva (que se le pase el vaivén) y lo suelta
        if (racimo && espera <= a.esperar) {
          racimo.cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
          racimo.cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
          soltarRacimo();
        }
        if (espera <= 0) estado = "volviendo";
        break;
      case "volviendo":
        angulo = acercar(angulo, 0, a.girar);
        if (angulo === 0) estado = "arriba";
        break;
    }
    brazo.setNextKinematicRotation(giroBrazo(angulo));
    gancho.setNextKinematicTranslation(vector(ganchoEn(angulo, altura)));
  });
  const soltarRacimo = () => {
    if (!racimo) return;
    const suelto = racimo;
    suelto.descolgar();
    racimo = null;
    for (const aviso of sueltas) aviso(suelto);
  };
  // Enganchar: con el gancho abajo, el racimo que alguien le acerca agarrado
  h.despues(() => {
    if (estado !== "bajando" || racimo || altura > p.bajo + 0.3) return;
    const r = racimoAMano();
    if (r) enganchar(r);
  });

  const punta = new THREE.Vector3();
  const medioCamino = new THREE.Vector3();
  h.dibujar(() => {
    // La punta del brazo según su imagen (también en el invitado, que recibe el brazo y el gancho en la foto)
    punta.set(0, -0.1, p.brazo).applyQuaternion(imagenBrazo.quaternion).add(imagenBrazo.position);
    const arriba = imagenGancho.position.clone().setY(imagenGancho.position.y + 0.22);
    const largo = punta.distanceTo(arriba);
    medioCamino.addVectors(punta, arriba).multiplyScalar(0.5);
    cable.position.copy(medioCamino);
    cable.scale.set(1, Math.max(0.01, largo), 1);
    cable.quaternion.setFromUnitVectors(ARRIBA, punta.clone().sub(arriba).normalize());
  });
  return grua;
}

const posar = (o: THREE.Object3D, posicion: THREE.Vector3, giro: THREE.Quaternion) => {
  o.position.copy(posicion);
  o.quaternion.copy(giro);
  return o;
};

/** El mástil de reticulado: cuatro parantes, anillos y diagonales, del tamaño de `medio`. */
function crearImagenMastil(medio: THREE.Vector3, h: Herramientas): THREE.Object3D {
  const partes: THREE.BufferGeometry[] = [];
  const g = 0.05;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      partes.push(new THREE.BoxGeometry(g, medio.y * 2, g).translate(sx * (medio.x - g), 0, sz * (medio.z - g)));
  const tramos = Math.max(2, Math.round((medio.y * 2) / 0.7));
  const paso = (medio.y * 2) / tramos;
  for (let i = 0; i <= tramos; i++) {
    const y = -medio.y + i * paso;
    for (const s of [-1, 1]) {
      partes.push(new THREE.BoxGeometry(medio.x * 2, g * 0.7, g * 0.7).translate(0, y, s * (medio.z - g)));
      partes.push(new THREE.BoxGeometry(g * 0.7, g * 0.7, medio.z * 2).translate(s * (medio.x - g), y, 0));
    }
    if (i === tramos) break;
    const diagonal = Math.hypot(medio.x * 2, paso);
    const inclinacion = Math.atan2(paso, medio.x * 2);
    for (const s of [-1, 1]) {
      partes.push(
        new THREE.BoxGeometry(diagonal, g * 0.6, g * 0.6)
          .rotateZ(i % 2 === 0 ? inclinacion : -inclinacion)
          .translate(0, y + paso / 2, s * (medio.z - g)),
      );
      partes.push(
        new THREE.BoxGeometry(diagonal, g * 0.6, g * 0.6)
          .rotateZ(i % 2 === 0 ? -inclinacion : inclinacion)
          .rotateY(Math.PI / 2)
          .translate(s * (medio.x - g), y + paso / 2, 0),
      );
    }
  }
  // La base: un dado de cemento oscuro
  partes.push(new THREE.BoxGeometry(medio.x * 3, 0.25, medio.z * 3).translate(0, -medio.y + 0.125, 0));
  return new THREE.Mesh(juntar(partes), h.oscuro);
}

/** El brazo de la grúa, de reticulado, a lo largo de su +z hasta `largo`, con el contrapeso atrás. */
function crearImagenBrazo(largo: number, h: Herramientas): THREE.Object3D {
  const partes: THREE.BufferGeometry[] = [];
  const g = 0.045;
  const alto = 0.4;
  const atras = 1.1;
  // Dos cordones abajo y uno arriba, de punta a punta
  for (const s of [-1, 1])
    partes.push(new THREE.BoxGeometry(g, g, largo + atras).translate(s * 0.16, -0.1, (largo - atras) / 2));
  partes.push(new THREE.BoxGeometry(g, g, largo + atras).translate(0, alto - 0.1, (largo - atras) / 2));
  const tramos = Math.max(2, Math.round((largo + atras) / 0.5));
  const paso = (largo + atras) / tramos;
  for (let i = 0; i < tramos; i++) {
    const z = -atras + (i + 0.5) * paso;
    const d = Math.hypot(paso, alto);
    for (const s of [-1, 1]) {
      partes.push(
        new THREE.BoxGeometry(g * 0.7, d, g * 0.7)
          .rotateX(i % 2 === 0 ? Math.atan2(paso, alto) : -Math.atan2(paso, alto))
          .translate(s * 0.08, alto / 2 - 0.1, z),
      );
    }
  }
  // El contrapeso y la cabeza de la punta, con su roldana
  partes.push(new THREE.BoxGeometry(0.6, 0.5, 0.5).translate(0, -0.2, -atras + 0.25));
  partes.push(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12).rotateZ(Math.PI / 2).translate(0, -0.1, largo));
  return new THREE.Group().add(new THREE.Mesh(juntar(partes), h.oscuro));
}

/** El gancho: un motón con su roldana y el gancho abierto abajo. */
function crearImagenGancho(h: Herramientas): THREE.Object3D {
  return new THREE.Group().add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(0.16, 0.24, 0.12).translate(0, 0.12, 0),
        new THREE.TorusGeometry(0.08, 0.022, 6, 12, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, -0.08, 0),
      ]),
      h.oscuro,
    ),
  );
}

/** Una mata de guineo (banano): el tallo y las hojas grandes caídas, de `alto`. Con `racimo`, cuelga uno. */
export function crearBanano(alto: number, semilla: number, conRacimo = false): THREE.Group {
  const grupo = new THREE.Group();
  const verde = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, alto, 8).translate(0, alto / 2, 0), verde);
  grupo.add(tallo);
  const hojas: THREE.BufferGeometry[] = [];
  const cuantas = 7;
  for (let i = 0; i < cuantas; i++) {
    const a = (i / cuantas) * Math.PI * 2 + semilla * 1.3;
    const largo = alto * (0.55 + 0.15 * Math.sin(semilla + i * 2.1));
    const caida = 0.35 + 0.35 * ((i * 7 + semilla) % 3) * 0.5;
    // Una hoja larga y ancha, en dos tramos: sube y después se dobla para abajo
    const ancho = largo * 0.22;
    const tramo1 = new THREE.SphereGeometry(1, 10, 4)
      .scale(ancho / 2, 0.02, (largo * 0.55) / 2)
      .translate(0, 0, (largo * 0.55) / 2)
      .rotateX(-0.5);
    const tramo2 = new THREE.SphereGeometry(1, 10, 4)
      .scale(ancho / 2.3, 0.02, (largo * 0.5) / 2)
      .translate(0, 0, (largo * 0.5) / 2)
      .rotateX(caida)
      .translate(0, largo * 0.55 * Math.sin(0.5), largo * 0.55 * Math.cos(0.5));
    for (const g of [tramo1, tramo2]) hojas.push(g.rotateY(a).translate(0, alto * 0.95, 0));
  }
  grupo.add(new THREE.Mesh(juntar(hojas), verde));
  if (conRacimo) {
    const r = crearImagenRacimo({ alto: 0.6, radio: 0.2, semilla });
    r.position.set(0.25, alto * 0.72, 0);
    grupo.add(r);
  }
  return grupo;
}

/** Los rieles de una vía, solo imagen: dos rieles con durmientes cada 60 cm por los puntos de `puntos` (sobre el
 * riel). Donde `caballete(x, z)` dice que no hay piso, cada 1.6 m un caballete que baja hasta `fondo`. */
export function crearRieles(
  puntos: readonly (readonly [number, number, number])[],
  o: { ancho?: number; caballete?: (x: number, z: number) => boolean; fondo?: number } = {},
): THREE.Group {
  const ancho = o.ancho ?? 1.0;
  const fondo = o.fondo ?? -4;
  const hierro: THREE.BufferGeometry[] = [];
  const madera: THREE.BufferGeometry[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const d = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const q = new THREE.Quaternion();
  let desdeDurmiente = 0;
  let desdeCaballete = 0;
  for (let i = 1; i < puntos.length; i++) {
    const p0 = puntos[i - 1];
    const p1 = puntos[i];
    if (!p0 || !p1) continue;
    a.set(...p0);
    b.set(...p1);
    d.subVectors(b, a);
    const largo = d.length();
    if (largo === 0) continue;
    d.normalize();
    lado.set(-d.z, 0, d.x).normalize();
    // El tramo de riel: una barra a lo largo, girada hacia donde va
    q.setFromUnitVectors(EJE_X, d);
    for (const s of [-1, 1]) {
      const centro = a
        .clone()
        .add(b)
        .multiplyScalar(0.5)
        .addScaledVector(lado, (s * ancho) / 2);
      const riel = new THREE.BoxGeometry(largo + 0.02, 0.07, 0.06);
      riel.applyQuaternion(q);
      hierro.push(riel.translate(centro.x, centro.y - 0.035, centro.z));
    }
    for (let t = desdeDurmiente; t < largo; t += 0.6) {
      const p = a.clone().addScaledVector(d, t);
      const durmiente = new THREE.BoxGeometry(0.16, 0.06, ancho + 0.5);
      durmiente.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.atan2(-d.z, d.x)));
      madera.push(durmiente.translate(p.x, p.y - 0.1, p.z));
      desdeDurmiente = t + 0.6 - largo;
    }
    if (o.caballete) {
      for (let t = desdeCaballete; t < largo; t += 1.6) {
        const p = a.clone().addScaledVector(d, t);
        desdeCaballete = t + 1.6 - largo;
        if (!o.caballete(p.x, p.z)) continue;
        const alto = p.y - 0.13 - fondo;
        for (const s of [-1, 1]) {
          const pata = new THREE.BoxGeometry(0.14, alto, 0.14).rotateX(s * 0.12);
          pata.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.atan2(-d.z, d.x)));
          const pie = p.clone().addScaledVector(lado, s * (ancho / 2 + 0.15));
          madera.push(pata.translate(pie.x, p.y - 0.13 - alto / 2, pie.z));
        }
        const cruz = new THREE.BoxGeometry(0.08, 0.1, ancho + 0.7);
        cruz.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.atan2(-d.z, d.x)));
        madera.push(cruz.clone().translate(p.x, p.y - 0.6, p.z), cruz.translate(p.x, p.y - 1.8, p.z));
      }
    }
  }
  const grupo = new THREE.Group();
  grupo.name = "rieles";
  const oscuro = materialTela(COLORES.siluetaHonda, { repetir: 2, pelusa: false });
  const corteza = materialTela(COLORES.silueta, { repetir: 2, pelusa: false });
  if (hierro.length) grupo.add(new THREE.Mesh(juntar(hierro), oscuro));
  if (madera.length) grupo.add(new THREE.Mesh(juntar(madera), corteza));
  return grupo;
}

/** Un gancho que cuelga de una varilla de `largo` (solo imagen): la punta del gancho en el origen. */
export function crearGancho(largo: number): THREE.Group {
  const oscuro = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  return new THREE.Group().add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.012, 0.012, largo, 5).translate(0, largo / 2 + 0.08, 0),
        new THREE.TorusGeometry(0.06, 0.014, 5, 10, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, 0.02, 0),
      ]),
      oscuro,
    ),
  );
}
