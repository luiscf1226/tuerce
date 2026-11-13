// Las piezas que estrena el Río Plátano (TU-28), menos el Sisimite (sisimite.ts). Cada una sale de un nodo
// `tipo: pieza` de la escena (formato-rio.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   pipante   una canoa de un solo tronco que flota (agua.ts) y gira solo alrededor de +y. La empuja el que va de
//             pie en la popa con los brazos alzados: la pértiga se clava de un lado, así que sola la hace girar. El
//             que va en la proa con los brazos alzados lleva el rumbo: el pipante gira hacia donde él mira. Al que va
//             a bordo el pipante lo lleva, como la balsa de La poza.
//   puente    un puente colgante: un piso de tablas que se comba hacia el medio, con barandas de soga, que se mece y
//             baja un poco con cada muñeco encima. Le faltan tablas en sus huecos: una tabla (una pieza `tronco`
//             `<nombre>-1`, `-2`…) que se suelta tendida sobre un hueco, apoyada de los dos lados, queda clavada.
//   palmera   una palmera que se dobla jalando su soga hacia atrás (una manija con resorte, como la tranca del
//             pinar). Doblada del todo, el cogollo toca el suelo; al soltar la soga se endereza de golpe y lanza hacia
//             su frente al que estaba en el cogollo.
//
// Todo lo que se mueve (el pipante, el piso del puente y sus tablas clavadas, el tronco de la palmera y su manija)
// viaja en la foto de la red. El invitado no simula: mueve la pértiga si el pipante avanza y dibuja la soga.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDelRioEnPlano } from "./formato-rio";
import type { Herramientas } from "./piezas";
import { manosEn, type Tronco } from "./piezas-pinar";

/** El bit de grupo de choque de lo suelto del río (la manija de la palmera): choca con todo menos con los muñecos
 * (bits 1 y 2); grupos del resolvedor sin filtro: se la encuentra para agarrarla, pero no empuja ni la empujan. */
const BIT_RIO = 1 << 7;
const GRUPOS_RIO = ((BIT_RIO << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_RIO << 16) >>> 0;
/** Las barandas del puente: solo atajan a los muñecos (las tablas que se llevan en fila pasan por encima). */
const SOLO_MUNECOS = ((BIT_RIO << 16) | 0b110) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const suave = (t: number) => {
  const x = limitar(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Los números de las piezas del río que no se ponen desde Blender. */
export const AJUSTES_RIO = {
  pipante: {
    /** Qué parte del largo, desde cada punta, es la popa (atrás) y la proa (adelante). */
    punta: 0.35,
    /** Por debajo y por encima del piso, la pelvis de uno que va a bordo (m). */
    bordo: [0.15, 1.2],
    /** El giro más fuerte que pone el timonel (N·m). */
    timonMaximo: 140,
    /** El alto de las bordas sobre el piso (m). */
    borda: 0.16,
  },
  puente: {
    /** El largo de cada tabla del piso (m) y su grueso. */
    tabla: 0.5,
    grueso: 0.08,
    /** La baranda de soga: su alto sobre el piso (m). Hasta ahí choca (no deja caerse por el costado). */
    baranda: 0.75,
    /** Una tabla suelta sobre un hueco: cuánto tiene que pasarse de cada lado (m), qué tan cerca del piso tienen
     * que quedar sus puntas (m: una puede quedar sobre la otra tabla), cuánto puede estar torcida (radianes) y qué
     * tan quieta (m/s). Y la tienen que haber tendido entre dos: soltada hasta tantos pasos después de llevarla los
     * dos (la que uno solo arrastra hasta ahí queda chueca y no la clavan). */
    apoyo: 0.15,
    altura: 0.5,
    entreDos: 90,
    torcida: 0.45,
    quieta: 0.6,
    /** En cuántos pasos se acomoda una tabla en su hueco y hacia qué lado del medio queda (m). */
    clavar: 20,
    corrida: -0.1,
    /** Qué tan rápido baja el piso con la carga (1/s) y cuánto se mece al caminarlo (m). */
    bajar: 4,
    mecerse: 0.015,
  },
  palmera: {
    /** Doblada más que esto (de 0 a 1), al soltar la soga se dispara. */
    tensa: 0.85,
    /** Cuánto tarda en enderezarse de golpe (s) y cuánto se pasa y tiembla después (de 0 a 1, s). */
    disparo: 0.4,
    pasarse: 0.12,
    temblar: 1.2,
    /** Qué tan rápido sigue a la soga (1/s). */
    seguir: 12,
    /** Hasta dónde del cogollo cuenta como estar en él: de costado y de alto (m). */
    cogollo: { radio: 0.9, abajo: 0.4, arriba: 1.4 },
    /** La manija: su alto sobre el pie de la palmera, cuánto queda detrás del tronco, su masa y su medio largo. */
    manija: { alto: 1.05, atras: 0.5, masa: 1.5, medio: 0.22 },
  },
} as const;

/** El giro que lleva el eje x del marco de la pieza al lado más largo de su caja (en el plano). */
function marcoLargo(giro: THREE.Quaternion, medio: THREE.Vector3) {
  const enX = medio.x >= medio.z;
  const ajuste = enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2);
  return {
    giro: giro.clone().multiply(ajuste),
    mitad: enX ? medio.x : medio.z,
    medioAncho: enX ? medio.z : medio.x,
  };
}

/** Un cilindro de `radio` de `a` a `b` (para sogas y palos). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 5): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// ── El pipante ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Pipante {
  readonly cual: "pipante";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Quién empuja con la pértiga (en la popa) y quién lleva el rumbo (en la proa): 0 el rojo, 1 el turquesa. */
  readonly pertiguero: 0 | 1 | null;
  readonly timonel: 0 | 1 | null;
  /** Cuántos muñecos van a bordo. */
  readonly aBordo: number;
  /** Hacia dónde mira la proa (radianes alrededor de +y, como el rumbo de los muñecos). */
  readonly rumbo: number;
  /** Su centro (en el piso) y su giro al empezar. */
  readonly casa: { readonly centro: THREE.Vector3; readonly giro: THREE.Quaternion };
  /** Si ese punto (una pelvis) va a bordo: encima del piso del pipante. */
  encima(p: THREE.Vector3Like): boolean;
  /** Lo pone donde empezó, quieto (si se fue lejos sin nadie). */
  volver(): void;
}

export function armarPipante(h: Herramientas, p: Extract<PiezaDelRioEnPlano, { cual: "pipante" }>): Pipante {
  const { rapier, mundo } = h;
  const a = AJUSTES_RIO.pipante;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const alto = medio.y;
  // Solo gira alrededor de +y: así no se vuelca con los dos de un lado, y el agua lo lleva y lo frena
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).enabledRotations(false, true, false).setCanSleep(false).setAngularDamping(0.5),
  );
  // Lleva al que va a bordo: anda respecto del pipante y, quieto, va con él
  llevaAlQuePisa(cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad, alto, medioAncho).setMass(p.masa).setFriction(0.9),
    cuerpo,
  );
  /** Lo que le cuesta girar alrededor de +y (kg·m²), para el timón. */
  const inercia = (p.masa * ((2 * mitad) ** 2 + (2 * medioAncho) ** 2)) / 12;

  const imagen = crearImagenPipante(h, mitad, alto, medioAncho);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const local = new THREE.Vector3();
  const giroAhora = new THREE.Quaternion();
  /** El punto en el marco del pipante (0 en su centro, +x hacia la proa). */
  const enElPipante = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroAhora.copy(cuerpo.rotation()).invert();
    return local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroAhora);
  };
  const encima = (q: THREE.Vector3Like) => {
    const l = enElPipante(q);
    const y = l.y - alto;
    return Math.abs(l.x) <= mitad + 0.1 && Math.abs(l.z) <= medioAncho + 0.15 && y > a.bordo[0] && y < a.bordo[1];
  };
  const rumboAhora = () => {
    const adelante = EJE_X.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation()));
    return Math.atan2(adelante.x, adelante.z);
  };

  let pertiguero: 0 | 1 | null = null;
  let timonel: 0 | 1 | null = null;
  let aBordo = 0;
  h.antes((munecos, entradas) => {
    const w = cuerpo.angvel();
    const com = cuerpo.worldCom();
    aBordo = 0;
    pertiguero = null;
    timonel = null;
    munecos.forEach((mu, i) => {
      const pelvis = mu.partes.pelvis.translation();
      if (!encima(pelvis)) return;
      aBordo++;
      // Con los brazos alzados, de pie: el de la popa empuja y el de la proa lleva el rumbo
      const e = entradas?.[i];
      if (mu.estado !== "de pie" || i > 1 || (!e?.brazoIzquierdo && !e?.brazoDerecho)) return;
      const s = enElPipante(pelvis).x / mitad;
      if (s < -1 + 2 * a.punta) pertiguero ??= i as 0 | 1;
      else if (s > 1 - 2 * a.punta) timonel ??= i as 0 | 1;
    });
    const q = giroAhora.copy(cuerpo.rotation());
    const adelante = EJE_X.clone().applyQuaternion(q).setY(0).normalize();
    const derecha = EJE_Z.clone().applyQuaternion(q).setY(0).normalize();
    // La pértiga se clava de un lado (a la derecha), en la popa: empuja hacia adelante y lo hace girar
    if (pertiguero !== null) {
      const t = cuerpo.translation();
      cuerpo.applyImpulseAtPoint(
        { x: adelante.x * p.pertiga * PASO, y: 0, z: adelante.z * p.pertiga * PASO },
        { x: t.x + derecha.x * p.lado, y: com.y, z: t.z + derecha.z * p.lado },
        true,
      );
    }
    // El timonel lo endereza hacia donde mira: un resorte de giro con su amortiguación
    const quien = timonel === null ? undefined : munecos[timonel];
    if (quien) {
      const error = envolver(quien.rumbo - Math.atan2(adelante.x, adelante.z));
      const torque = inercia * (p.timon * error - 2 * Math.sqrt(p.timon) * w.y);
      cuerpo.applyTorqueImpulse({ x: 0, y: limitar(torque, -a.timonMaximo, a.timonMaximo) * PASO, z: 0 }, true);
    }
  });

  // La pértiga: en el anfitrión, la mueve el que empuja; en el invitado, se mueve si el pipante avanza
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let fase = 0;
  let empuja = false;
  h.guardar(() => {
    const t = new THREE.Vector3().copy(cuerpo.translation());
    const avance =
      t
        .clone()
        .sub(antes)
        .dot(EJE_X.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation()))) / PASO;
    antes.copy(t);
    empuja = simulado ? pertiguero !== null : avance > 0.2;
    if (empuja) fase += PASO * 2.4;
  });
  h.dibujar(() => imagen.posar(empuja, fase));

  const casa = { centro: centro.clone().addScaledVector(ARRIBA, alto), giro: giro.clone() };
  return {
    cual: "pipante",
    nombre: p.nombre,
    cuerpo,
    get pertiguero() {
      return pertiguero;
    },
    get timonel() {
      return timonel;
    },
    get aBordo() {
      return aBordo;
    },
    get rumbo() {
      return rumboAhora();
    },
    casa,
    encima,
    volver() {
      cuerpo.setTranslation({ x: centro.x, y: centro.y, z: centro.z }, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
    },
  };
}

/** El pipante: un tronco ahuecado, con la proa y la popa en punta, el piso adentro y la pértiga en la popa. En el
 * marco del cuerpo: +x hacia la proa, el piso arriba de la caja (y = `alto`). */
function crearImagenPipante(h: Herramientas, mitad: number, alto: number, medioAncho: number) {
  const a = AJUSTES_RIO.pipante;
  const grupo = new THREE.Group();
  const hondo = 2 * alto + a.borda;
  const cuerpo = mitad * 0.72;
  // (el largo del piso de adentro)
  // El casco: media cáscara abierta arriba, con las bordas a `borda` sobre el piso y las puntas afiladas
  const casco = new THREE.SphereGeometry(1, 32, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const v = new THREE.Vector3();
  const posiciones = casco.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    // Más angosto hacia las puntas: un tronco ahuecado, no una tina
    const afilar = 1 - 0.55 * v.x ** 4;
    posiciones.setXYZ(i, v.x * (mitad + 0.05), v.y * hondo, v.z * (medioAncho + 0.03) * afilar);
  }
  casco.computeVertexNormals();
  casco.translate(0, alto + a.borda, 0);
  const madera = h.madera;
  // El casco es abierto: se ve de los dos lados
  const deDosCaras = madera.clone();
  deDosCaras.side = THREE.DoubleSide;
  grupo.add(new THREE.Mesh(casco, deDosCaras));
  // El piso de adentro y dos travesaños donde se paran
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(cuerpo * 2, 0.03, medioAncho * 1.7).translate(0, alto + 0.015, 0),
        ...[-0.55, 0.55].map((s) =>
          new THREE.BoxGeometry(0.1, 0.06, medioAncho * 1.9).translate(s * cuerpo, alto + a.borda * 0.6, 0),
        ),
      ]),
      h.oscuro,
    ),
  );
  // La pértiga: un palo largo que va de la mano del que empuja (arriba, en la popa) al fondo del río, detrás
  const pertiga = new THREE.Group();
  pertiga.position.set(-mitad * 0.62, alto + 1.25, medioAncho * 0.55);
  const largoPertiga = 3.4;
  pertiga.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, largoPertiga, 6).translate(0, -largoPertiga * 0.45, 0),
      madera,
    ),
  );
  grupo.add(pertiga);
  return {
    grupo,
    /** `empuja`: si alguien empuja; `fase`: cuánto lleva empujando (la pértiga va y viene). */
    posar(empuja: boolean, fase: number) {
      const golpe = empuja ? Math.sin(fase * Math.PI * 2) : -1;
      // Inclinada hacia atrás y afuera; al empujar se va más atrás
      pertiga.rotation.set(0.25, 0, -0.35 - 0.25 * (golpe + 1));
    },
  };
}

// ── El puente colgante ──────────────────────────────────────────────────────────────────────────────────────

export interface Puente {
  readonly cual: "puente";
  readonly nombre: string;
  /** El piso (cinemático): las tablas y las barandas. */
  readonly piso: RAPIER.RigidBody;
  /** Sus tablas sueltas, en el orden de sus nombres. */
  readonly tablas: readonly Tronco[];
  /** Si cada hueco ya tiene su tabla (de la primera punta a la otra). */
  readonly huecos: readonly boolean[];
  /** Cuántos huecos quedan sin tabla. */
  readonly faltan: number;
  /** El largo del piso de cada hueco: dónde empieza y dónde termina, en el mundo (a lo largo del puente). */
  hueco(cual: number): { readonly desde: THREE.Vector3; readonly hasta: THREE.Vector3 };
  /** Cuántos muñecos están encima. */
  readonly carga: number;
  /** Clava una tabla en cada hueco que falte, de una vez (al retomar). */
  reparar(): void;
  /** Llama a `aviso` cuando una tabla queda clavada en un hueco. Devuelve cómo dejar de escuchar. */
  alClavar(aviso: (hueco: number) => void): () => void;
}

export function armarPuente(h: Herramientas, p: Extract<PiezaDelRioEnPlano, { cual: "puente" }>): Puente {
  const { rapier, mundo } = h;
  const a = AJUSTES_RIO.puente;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const largo = mitad * 2;
  /** La altura del piso (arriba de las tablas), en el marco del puente, a `u` del medio. */
  const alturaPiso = (u: number) => medio.y - p.comba * (1 - (u / mitad) ** 2);
  const pendiente = (u: number) => (2 * p.comba * u) / (mitad * mitad);
  /** Los huecos: cada uno en el medio de su parte del largo, de `desde` a `hasta` (en u). */
  const huecos = Array.from({ length: p.huecos }, (_, k) => {
    const medioHueco = ((k + 0.5) / p.huecos - 0.5) * largo;
    return { desde: medioHueco - p.hueco / 2, hasta: medioHueco + p.hueco / 2, medio: medioHueco };
  });
  /** Los tramos con piso, entre los huecos. */
  const tramos: [number, number][] = [];
  let desde = -mitad;
  for (const hueco of huecos) {
    tramos.push([desde, hueco.desde]);
    desde = hueco.hasta;
  }
  tramos.push([desde, mitad]);

  const piso = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  /** Una caja del piso o de la baranda, de `u0` a `u1`, siguiendo la comba: `y` sobre el piso, `z` de costado. */
  const tabla = (u0: number, u1: number, medioAlto: number, y: number, z: number, medioZ: number) => {
    const u = (u0 + u1) / 2;
    const angulo = Math.atan(pendiente(u));
    return rapier.ColliderDesc.cuboid((u1 - u0) / 2 / Math.cos(angulo), medioAlto, medioZ)
      .setTranslation(u, alturaPiso(u) + y, z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_Z, angulo))
      .setFriction(0.9);
  };
  let primero: RAPIER.Collider | undefined;
  for (const [u0, u1] of tramos) {
    const n = Math.max(1, Math.ceil((u1 - u0) / a.tabla - 1e-6));
    for (let i = 0; i < n; i++) {
      const forma = tabla(
        u0 + ((u1 - u0) * i) / n,
        u0 + ((u1 - u0) * (i + 1)) / n,
        a.grueso / 2,
        -a.grueso / 2,
        0,
        medioAncho,
      );
      const c = mundo.createCollider(forma, piso);
      primero ??= c;
    }
  }
  // Las barandas: de punta a punta (también sobre los huecos: las sogas siguen ahí)
  const nBaranda = Math.max(1, Math.ceil(largo / a.tabla));
  for (const lado of [-1, 1]) {
    for (let i = 0; i < nBaranda; i++) {
      const u0 = -mitad + (largo * i) / nBaranda;
      const forma = tabla(u0, u0 + largo / nBaranda, a.baranda / 2, a.baranda / 2, lado * (medioAncho + 0.03), 0.03);
      mundo.createCollider(forma.setCollisionGroups(SOLO_MUNECOS), piso);
    }
  }
  const imagen = crearImagenPuente(h, { mitad, medioAncho, alturaPiso, tramos, baranda: a.baranda });
  imagen.name = p.nombre;
  h.mover(piso, imagen);
  if (primero) h.solida({ nombre: p.nombre, objeto: imagen, cuerpo: piso, colisionador: primero });

  let tablas: Tronco[] | undefined;
  const lasTablas = () => {
    tablas ??= Array.from({ length: p.huecos }, (_, i) => {
      const t = h.lista.find((q): q is Tronco => q.cual === "tronco" && q.nombre === `${p.nombre}-${i + 1}`);
      if (!t) throw new Error(`el puente «${p.nombre}» no tiene su tabla «${p.nombre}-${i + 1}»`);
      return t;
    });
    return tablas;
  };
  /** Qué tabla quedó en cada hueco, y cuánto le falta acomodarse (pasos). */
  const clavadas: ({ tabla: Tronco; paso: number; desde: THREE.Vector3; desdeQ: THREE.Quaternion } | null)[] =
    huecos.map(() => null);
  const avisos = new Set<(hueco: number) => void>();
  let bajada = 0;
  let mecida = 0;
  let fase = 0;
  let carga = 0;

  /** El marco del piso ahora: dónde está su centro (con lo que bajó) y su giro (siempre el mismo). */
  const enElPuente = (q: THREE.Vector3Like, t: THREE.Vector3Like = piso.translation()) =>
    new THREE.Vector3(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giro.clone().invert());
  /** Dónde va una tabla clavada en su hueco, en el marco del piso, y su giro. */
  const enSuHueco = (k: number, t: Tronco) => {
    const hueco = huecos[k];
    const u = hueco?.medio ?? 0;
    const grueso = grosorDe(t);
    const angulo = Math.atan(pendiente(u));
    return {
      posicion: new THREE.Vector3(u, alturaPiso(u) + grueso / 2, a.corrida * (medioAncho / 0.5)),
      giro: new THREE.Quaternion().setFromAxisAngle(EJE_Z, angulo).multiply(alineada(t)),
    };
  };
  /** El giro (en el marco de la tabla) que pone su lado largo a lo largo de x y su grueso hacia arriba. */
  const alineadas = new Map<Tronco, THREE.Quaternion>();
  const alineada = (t: Tronco) => {
    let q = alineadas.get(t);
    if (!q) {
      const [p0, p1] = t.puntas();
      const inversa = new THREE.Quaternion().copy(t.cuerpo.rotation()).invert();
      const eje = p1.sub(p0).applyQuaternion(inversa).normalize();
      q = new THREE.Quaternion().setFromUnitVectors(eje, EJE_X);
      alineadas.set(t, q);
    }
    return q;
  };
  const grosores = new Map<Tronco, number>();
  const grosorDe = (t: Tronco) => {
    let g = grosores.get(t);
    if (g === undefined) {
      g = 0.1;
      const c = t.cuerpo.collider(0);
      const he = c.halfExtents();
      if (he) g = Math.min(he.x, he.y, he.z) * 2;
      grosores.set(t, g);
    }
    return g;
  };

  /** Clava la tabla en el hueco: la vuelve cinemática y la acomoda (de una vez, con `ya`). */
  const clavar = (k: number, t: Tronco, ya: boolean) => {
    t.cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    t.cuerpo.setLinvel(CERO, true);
    t.cuerpo.setAngvel(CERO, true);
    const pose = piso.translation();
    const qPiso = new THREE.Quaternion().copy(piso.rotation());
    clavadas[k] = {
      tabla: t,
      paso: ya ? a.clavar : 0,
      desde: enElPuente(t.cuerpo.translation(), pose),
      desdeQ: qPiso.clone().invert().multiply(new THREE.Quaternion().copy(t.cuerpo.rotation())),
    };
    if (ya) {
      const donde = enSuHueco(k, t);
      t.cuerpo.setTranslation(donde.posicion.clone().applyQuaternion(qPiso).add(pose), true);
      t.cuerpo.setRotation(qPiso.clone().multiply(donde.giro), true);
    }
    for (const aviso of avisos) aviso(k);
  };

  h.antes((munecos) => {
    // Cuántos hay encima: el piso baja y se mece al caminarlo
    let andar = 0;
    carga = 0;
    for (const m of munecos) {
      const l = enElPuente(m.partes.pelvis.translation());
      if (Math.abs(l.x) > mitad || Math.abs(l.z) > medioAncho + 0.1) continue;
      const sobre = l.y - alturaPiso(l.x);
      if (sobre < 0 || sobre > 1.4) continue;
      carga++;
      const v = m.partes.pelvis.linvel();
      andar += Math.hypot(v.x, v.z);
    }
    bajada += (-p.mecer * carga - bajada) * Math.min(1, a.bajar * PASO);
    mecida += (a.mecerse * Math.min(1, andar / 1.6) - mecida) * Math.min(1, 2 * PASO);
    fase += PASO * 5;
    const y = bajada + mecida * Math.sin(fase);
    const pose = { x: centro.x, y: centro.y + y, z: centro.z };
    piso.setNextKinematicTranslation(pose);
    // Las tablas clavadas van con el piso (las que se están acomodando, de a poco)
    clavadas.forEach((c, k) => {
      if (!c) return;
      if (c.paso < a.clavar) c.paso++;
      const donde = enSuHueco(k, c.tabla);
      const f = suave(c.paso / a.clavar);
      const posicion = c.desde.clone().lerp(donde.posicion, f).applyQuaternion(giro).add(pose);
      c.tabla.cuerpo.setNextKinematicTranslation(posicion);
      c.tabla.cuerpo.setNextKinematicRotation(giro.clone().multiply(c.desdeQ.clone().slerp(donde.giro, f)));
    });
  });

  // Una tabla suelta, quieta y tendida entre dos sobre un hueco, apoyada de los dos lados, queda clavada
  const sinLosDos = new Map<Tronco, number>();
  h.despues(() => {
    for (const t of lasTablas()) {
      const pasos = t.cargadores >= 2 ? 0 : (sinLosDos.get(t) ?? Number.POSITIVE_INFINITY) + 1;
      sinLosDos.set(t, pasos);
      if (t.cargadores > 0 || pasos > a.entreDos || clavadas.some((c) => c?.tabla === t)) continue;
      const v = t.cuerpo.linvel();
      if (Math.hypot(v.x, v.y, v.z) > a.quieta) continue;
      const [p0, p1] = t.puntas().map((q) => enElPuente(q));
      if (!p0 || !p1) continue;
      const [atras, adelante] = p0.x < p1.x ? [p0, p1] : [p1, p0];
      const torcida = Math.atan2(Math.abs(adelante.z - atras.z), adelante.x - atras.x);
      if (torcida > a.torcida) continue;
      if (Math.abs((atras.z + adelante.z) / 2) > medioAncho + 0.3) continue;
      const apoyada = (q: THREE.Vector3) => Math.abs(q.y - alturaPiso(limitar(q.x, -mitad, mitad))) < a.altura;
      if (!apoyada(atras) || !apoyada(adelante)) continue;
      const k = huecos.findIndex(
        (hueco, i) => !clavadas[i] && atras.x < hueco.desde - a.apoyo && adelante.x > hueco.hasta + a.apoyo,
      );
      if (k >= 0) clavar(k, t, false);
    }
  });

  return {
    cual: "puente",
    nombre: p.nombre,
    piso,
    get tablas() {
      return lasTablas();
    },
    get huecos() {
      return clavadas.map((c) => c !== null);
    },
    get faltan() {
      return clavadas.filter((c) => c === null).length;
    },
    get carga() {
      return carga;
    },
    hueco(cual) {
      const hueco = huecos[cual] ?? { desde: 0, hasta: 0 };
      const punto = (u: number) =>
        new THREE.Vector3(u, alturaPiso(u), 0).applyQuaternion(giro).add(new THREE.Vector3().copy(piso.translation()));
      return { desde: punto(hueco.desde), hasta: punto(hueco.hasta) };
    },
    reparar() {
      const libres = lasTablas().filter((t) => !clavadas.some((c) => c?.tabla === t));
      clavadas.forEach((c, k) => {
        const t = libres.shift();
        if (!c && t) clavar(k, t, true);
      });
    },
    alClavar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** El puente: tablas con luz entre ellas (sin las de los huecos, con astillas en las puntas), dos sogas de abajo,
 * las barandas de soga con sus colgantes y los postes de las puntas. En el marco del piso (+x a lo largo). */
function crearImagenPuente(
  h: Herramientas,
  o: {
    mitad: number;
    medioAncho: number;
    alturaPiso: (u: number) => number;
    tramos: readonly [number, number][];
    baranda: number;
  },
): THREE.Group {
  const grupo = new THREE.Group();
  const tablas: THREE.BufferGeometry[] = [];
  const pendiente = (u: number) => (o.alturaPiso(u + 0.01) - o.alturaPiso(u - 0.01)) / 0.02;
  for (const [u0, u1] of o.tramos) {
    const n = Math.max(1, Math.round((u1 - u0) / 0.28));
    for (let i = 0; i < n; i++) {
      const u = u0 + ((u1 - u0) * (i + 0.5)) / n;
      // Cada tabla un poco distinta: más corta, corrida o torcida
      const corto = 0.04 * Math.sin(i * 7.1 + u0);
      tablas.push(
        new THREE.BoxGeometry(((u1 - u0) / n) * 0.82, 0.06, o.medioAncho * 2 + 0.1 - Math.abs(corto) * 2)
          .rotateY(0.04 * Math.sin(i * 3.3))
          .rotateZ(Math.atan(pendiente(u)))
          .translate(u, o.alturaPiso(u) - 0.03, corto),
      );
    }
  }
  grupo.add(new THREE.Mesh(juntar(tablas), h.madera));
  // Las sogas: dos de abajo (bajo las puntas de las tablas) y dos barandas, con colgantes cada tanto
  const soga = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const sogas: THREE.BufferGeometry[] = [];
  const paso = 0.5;
  const n = Math.max(2, Math.round((o.mitad * 2) / paso));
  for (const lado of [-1, 1]) {
    const z = lado * (o.medioAncho + 0.03);
    for (let i = 0; i < n; i++) {
      const u0 = -o.mitad + (2 * o.mitad * i) / n;
      const u1 = -o.mitad + (2 * o.mitad * (i + 1)) / n;
      const abajo0 = new THREE.Vector3(u0, o.alturaPiso(u0) - 0.07, z);
      const abajo1 = new THREE.Vector3(u1, o.alturaPiso(u1) - 0.07, z);
      // La baranda cuelga menos que el piso: va más alta en el medio
      const arriba = (u: number) => o.alturaPiso(u) * 0.55 + o.alturaPiso(o.mitad) * 0.45 + o.baranda + 0.1;
      const arriba0 = new THREE.Vector3(u0, arriba(u0), z);
      const arriba1 = new THREE.Vector3(u1, arriba(u1), z);
      sogas.push(palo(abajo0, abajo1, 0.022), palo(arriba0, arriba1, 0.026));
      if (i > 0) sogas.push(palo(abajo0, arriba0, 0.012, 4));
    }
  }
  grupo.add(new THREE.Mesh(juntar(sogas), soga));
  // Los postes de las puntas, de donde se amarran las sogas
  const postes: THREE.BufferGeometry[] = [];
  for (const u of [-o.mitad - 0.1, o.mitad + 0.1])
    for (const lado of [-1, 1]) {
      const alto = o.alturaPiso(o.mitad) + o.baranda + 0.4;
      postes.push(
        new THREE.CylinderGeometry(0.07, 0.09, alto + 0.6, 8).translate(u, alto / 2 - 0.3, lado * (o.medioAncho + 0.1)),
      );
    }
  grupo.add(new THREE.Mesh(juntar(postes), h.oscuro));
  return grupo;
}

// ── La palmera ──────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoPalmera = "derecha" | "doblada" | "disparando";

export interface Palmera {
  readonly cual: "palmera";
  readonly nombre: string;
  /** El tronco (cinemático, sin choques): gira sobre su pie. */
  readonly tronco: RAPIER.RigidBody;
  /** La manija de la soga, que se jala hacia atrás. */
  readonly manija: RAPIER.RigidBody;
  readonly estado: EstadoPalmera;
  /** Cuánto está doblada: 0 derecha, 1 del todo (el cogollo en el suelo). */
  readonly doblada: number;
  /** Cuánto se jaló la soga, de 0 a 1. */
  readonly jalada: number;
  /** Dónde está el cogollo ahora (en el mundo). */
  cogollo(): THREE.Vector3;
  /** Cuántas veces lanzó a alguien. */
  readonly lanzados: number;
  /** Llama a `aviso` cuando lanza a alguien (0 el rojo, 1 el turquesa). Devuelve cómo dejar de escuchar. */
  alLanzar(aviso: (jugador: 0 | 1) => void): () => void;
}

export function armarPalmera(h: Herramientas, p: Extract<PiezaDelRioEnPlano, { cual: "palmera" }>): Palmera {
  const { rapier, mundo } = h;
  const a = AJUSTES_RIO.palmera;
  const { medio, giro } = p.caja;
  const alto = medio.y * 2;
  const pie = h.enElMundo(p, 0, -medio.y, 0);
  const frente = EJE_Z.clone().applyQuaternion(giro);
  // Se dobla hacia atrás: gira alrededor del eje frente × arriba
  const eje = frente.clone().cross(ARRIBA).normalize();
  const giroDoblada = (f: number) => new THREE.Quaternion().setFromAxisAngle(eje, f * p.angulo).multiply(giro);

  const tronco = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pie.x, pie.y, pie.z).setRotation(giro),
  );
  // Sin choques: el que pasa por debajo no se lo lleva; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(alto / 2, Math.max(0.05, Math.min(medio.x, medio.z)))
      .setTranslation(0, alto / 2, 0)
      .setSensor(true)
      .setCollisionGroups(0),
    tronco,
  );
  const imagen = crearImagenPalmera(h.madera, h.oscuro, alto, Math.max(0.08, Math.min(medio.x, medio.z)));
  imagen.grupo.name = p.nombre;
  h.mover(tronco, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo: tronco, colisionador });

  // La manija de la soga: junto al tronco, de costado, y se jala hacia atrás con un resorte que la devuelve
  const inicio = pie
    .clone()
    .addScaledVector(eje, p.lado)
    .addScaledVector(ARRIBA, a.manija.alto)
    .addScaledVector(frente, -a.manija.atras);
  const haciaAtras = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI));
  const ancla = h.fijo(inicio, haciaAtras);
  const manija = mundo.createRigidBody(h.dinamico(inicio, haciaAtras).setLinearDamping(1).setAngularDamping(2));
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.manija.medio, 0.03, 0.03)
      .setMass(a.manija.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_RIO)
      .setSolverGroups(SIN_EMPUJAR),
    manija,
  );
  const datos = rapier.JointData.prismatic(CERO, CERO, EJE_Z);
  datos.limitsEnabled = true;
  datos.limits = [0, p.soga];
  const junta = mundo.createImpulseJoint(datos, ancla, manija, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.PrismaticImpulseJoint) {
    const rigidez = p.fuerza / p.soga;
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * a.manija.masa));
  }
  const imagenManija = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(0.035, 0.035, a.manija.medio * 2, 8).rotateZ(Math.PI / 2),
      new THREE.SphereGeometry(0.05, 8, 6),
    ]),
    h.madera,
  );
  h.mover(manija, imagenManija);
  // La soga, del cogollo a la manija (se rehace en cada cuadro)
  const soga = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1, 5).translate(0, 0.5, 0),
    materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false }),
  );
  h.escena.add(soga);

  let estado: EstadoPalmera = "derecha";
  let doblada = 0;
  let jalada = 0;
  let agarrada = false;
  let tiempo = 0;
  let desde = 0;
  let lanzados = 0;
  /** Los que van en el cogollo mientras se dispara, y dónde iban respecto de él. */
  let montados: { jugador: 0 | 1; muneco: Muneco; corrido: THREE.Vector3 }[] = [];
  const avisos = new Set<(jugador: 0 | 1) => void>();
  const cogolloCon = (f: number) => pie.clone().addScaledVector(ARRIBA.clone().applyAxisAngle(eje, f * p.angulo), alto);

  /** Si el muñeco está en el cogollo (con la palmera doblada así). */
  const enElCogollo = (m: Muneco, f: number) => {
    const c = cogolloCon(f);
    const t = m.partes.pelvis.translation();
    return (
      Math.hypot(t.x - c.x, t.z - c.z) < a.cogollo.radio && t.y > c.y - a.cogollo.abajo && t.y < c.y + a.cogollo.arriba
    );
  };
  /** A todas las partes del muñeco, esa velocidad. */
  const llevar = (m: Muneco, v: THREE.Vector3Like) => {
    for (const parte of Object.values(m.partes)) {
      parte.setLinvel(v, true);
      parte.setAngvel(CERO, true);
    }
  };

  h.antes((munecos) => {
    const t = manija.translation();
    const atras = (inicio.x - t.x) * frente.x + (inicio.y - t.y) * frente.y + (inicio.z - t.z) * frente.z;
    jalada = limitar(atras / p.soga, 0, 1);
    const antesAgarrada = agarrada;
    agarrada = munecos.some((m) => manosEn(m, manija) > 0);
    if (estado !== "disparando") {
      doblada += (jalada - doblada) * Math.min(1, a.seguir * PASO);
      estado = doblada > 0.02 ? "doblada" : "derecha";
      // Soltó la soga con la palmera doblada del todo: se dispara con los que estén en el cogollo
      if (antesAgarrada && !agarrada && doblada >= a.tensa) {
        estado = "disparando";
        tiempo = 0;
        desde = doblada;
        const c = cogolloCon(doblada);
        montados = munecos.flatMap((m, i) =>
          i <= 1 && enElCogollo(m, doblada)
            ? [
                {
                  jugador: i as 0 | 1,
                  muneco: m,
                  corrido: new THREE.Vector3().copy(m.partes.pelvis.translation()).sub(c),
                },
              ]
            : [],
        );
      }
    }
    if (estado === "disparando") {
      tiempo += PASO;
      const f = tiempo / a.disparo;
      if (f < 1) {
        doblada = desde * (1 - f * f);
        // Los del cogollo van con él (y se van juntando a la punta)
        const c = cogolloCon(doblada);
        for (const m of montados) {
          const destino = c
            .clone()
            .addScaledVector(m.corrido, 1 - f)
            .addScaledVector(ARRIBA, 0.3 * f);
          const pelvis = m.muneco.partes.pelvis.translation();
          llevar(m.muneco, {
            x: (destino.x - pelvis.x) / PASO,
            y: (destino.y - pelvis.y) / PASO,
            z: (destino.z - pelvis.z) / PASO,
          });
        }
      } else {
        // Derecha de golpe: los lanza hacia su frente, y tiembla un rato
        for (const m of montados) {
          const v = frente
            .clone()
            .multiplyScalar(p.lanzar * Math.cos(p.elevacion))
            .addScaledVector(ARRIBA, p.lanzar * Math.sin(p.elevacion));
          llevar(m.muneco, v);
          lanzados++;
          for (const aviso of avisos) aviso(m.jugador);
        }
        montados = [];
        const temblor = tiempo - a.disparo;
        doblada = -a.pasarse * Math.sin(temblor * 9) * Math.exp(-temblor * 3);
        if (temblor > a.temblar) {
          estado = "derecha";
          doblada = 0;
        }
      }
    }
    tronco.setNextKinematicRotation(giroDoblada(doblada));
  });

  h.dibujar(() => {
    // La soga: del cogollo (donde se ve la palmera) a la manija
    const punta = imagen.grupo.localToWorld(new THREE.Vector3(0, alto * 0.93, 0));
    imagenManija.updateMatrixWorld();
    const mano = imagenManija.position.clone();
    const tramo = mano.clone().sub(punta);
    soga.position.copy(punta);
    soga.quaternion.setFromUnitVectors(ARRIBA, tramo.clone().normalize());
    soga.scale.set(1, tramo.length(), 1);
  });

  return {
    cual: "palmera",
    nombre: p.nombre,
    tronco,
    manija,
    get estado() {
      return estado;
    },
    get doblada() {
      return doblada;
    },
    get jalada() {
      return jalada;
    },
    cogollo: () => cogolloCon(doblada),
    get lanzados() {
      return lanzados;
    },
    alLanzar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** La palmera: un tronco anillado que se angosta y se curva apenas, el cogollo de pencas largas que caen y un racimo
 * de cocos. En el marco del pie: el tronco sube por +y. También de adorno (el guion del río pone varias). */
export function crearImagenPalmera(madera: THREE.Material, oscuro: THREE.Material, alto: number, radio: number) {
  const grupo = new THREE.Group();
  const anillos: THREE.BufferGeometry[] = [];
  const n = Math.max(6, Math.round(alto / 0.22));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const r0 = radio * (1.25 - 0.45 * t0);
    const r1 = radio * (1.25 - 0.45 * t1);
    // Cada anillo un poco más ancho abajo, como las cicatrices de las pencas
    anillos.push(
      new THREE.CylinderGeometry(r1 * 0.92, r0 * 1.04, (alto / n) * 1.02, 10, 1).translate(
        0.04 * Math.sin(t0 * 2.2) * alto * 0.1,
        alto * (t0 + t1) * 0.5,
        0,
      ),
    );
  }
  grupo.add(new THREE.Mesh(juntar(anillos), madera));
  // El cogollo: pencas largas que salen para todos lados y se caen, y los cocos
  const pencas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const angulo = (i / 9) * Math.PI * 2 + 0.3;
    const largo = 1.5 + 0.3 * Math.sin(i * 2.7);
    const penca = new THREE.BoxGeometry(largo, 0.02, 0.26).translate(largo / 2, 0, 0);
    // Se cae hacia la punta: dos tramos
    const caida = new THREE.BoxGeometry(largo * 0.6, 0.02, 0.18)
      .translate((largo * 0.6) / 2, 0, 0)
      .rotateZ(-0.7)
      .translate(largo * 0.95, 0, 0);
    for (const g of [penca, caida]) pencas.push(g.rotateZ(0.25).rotateY(angulo).translate(0, alto, 0));
  }
  for (let i = 0; i < 4; i++)
    pencas.push(
      new THREE.SphereGeometry(0.11, 8, 6).translate(0.13 * Math.cos(i * 1.6), alto - 0.18, 0.13 * Math.sin(i * 1.6)),
    );
  grupo.add(new THREE.Mesh(juntar(pencas), oscuro));
  return { grupo };
}
