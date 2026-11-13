// Las piezas que estrena La mina (TU-46), menos El Tío (tio.ts). Cada una sale de un nodo `tipo: pieza` de la
// escena (formato-mina.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   vagoneta  una vagoneta de mina por su vía (mecanismos/via.ts, la del tren), con su cambio. Se empuja caminando
//             contra ella, como un vagón, pero no se sale de la vía: en cada paso la pieza la vuelve a poner sobre
//             los rieles y le deja solo la velocidad a lo largo (la del empujón, más la que le da la cuesta y menos
//             la que le quitan los rieles). Con el freno puesto no se mueve. Lleva al que va adentro
//   espejo    un espejo de dos caras sobre un poste: gira con un brazo que se empuja; un resorte lo vuelve al reposo,
//             así que queda orientado (en su tope) solo mientras alguien lo sostiene
//   grieta    la grieta por donde entra el sol del salar: un haz claro que rebota en los espejos que encuentra
//   ofrenda   la ofrenda para El Tío. Si pasa por las velas, es un susto (¡pum!): vuelve a su lugar y el que la
//             llevaba aparece frente a ella, para retomar. Nadie explota de verdad
//   velas     una hilera de velas paradas en el suelo: solo imagen, y dónde está cada llama
//
// La vagoneta choca solo con los muñecos (pasa por el piso y las paredes, que la vía ya esquiva), así nada la roza
// más que los rieles. El haz, el fuego de las velas y el humo del susto se calculan con los cuerpos tal como llegan:
// el invitado los dibuja igual sin correr nada.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDeLaMinaEnPlano } from "./formato-mina";
import { crearVia, type Via } from "./mecanismos/via";
import { crearInterruptor, type Herramientas } from "./piezas";
import { GRUPOS_SUELTO, manosEn } from "./piezas-pinar";

type Plano<C extends PiezaDeLaMinaEnPlano["cual"]> = Extract<PiezaDeLaMinaEnPlano, { cual: C }>;

/** La vagoneta choca solo con los muñecos (bits 1 y 2, ver muneco.ts): no la roza ni el piso ni las paredes. */
const BIT_MINA = 1 << 14;
const GRUPOS_VAGONETA = ((BIT_MINA << 16) | 0b110) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const cuaternion = (q: RAPIER.Rotation) => new THREE.Quaternion(q.x, q.y, q.z, q.w);

/** Los números de las piezas de la mina que no se ponen desde Blender. */
export const AJUSTES_MINA = {
  vagoneta: {
    /** El grueso de las paredes y del piso de la caja (m). */
    pared: 0.05,
    /** Lo que la frenan los rieles además del roce, aunque vaya despacio (m/s²): así se para del todo. */
    rozar: 0.2,
    /** Lo que va adentro: la pelvis hasta cuánto por fuera de la caja (m), y debajo del borde. */
    adentro: { margen: 0.05 },
  },
  espejo: {
    /** El radio del brazo y el alto de la manija vertical de su punta (m). */
    radioBrazo: 0.05,
    manija: 0.32,
    /** El poste: su radio (m). */
    poste: 0.07,
    /** Deja de estar orientado al volver esta fracción por debajo del umbral. */
    histeresis: 0.08,
  },
  grieta: {
    /** El grueso del haz y el de su resplandor (m). */
    haz: 0.05,
    resplandor: 0.22,
  },
  ofrenda: {
    /** Tirada más abajo que esto de su lugar (m), cuenta como en el suelo. */
    bajo: 0.4,
    /** El que la llevaba al pasar por las velas aparece a tanto de ella, hacia su frente (m). */
    retomar: 0.9,
    /** Lo que dura el humo del susto (s). */
    humo: 1.2,
  },
} as const;

/** El ángulo (radianes) que giró `q` respecto de `base` alrededor de `eje` (en el marco de `base`). */
function anguloRelativo(base: THREE.Quaternion, q: THREE.Quaternion, eje: THREE.Vector3): number {
  const r = base.clone().invert().multiply(q);
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return 2 * Math.atan2(r.w < 0 ? -s : s, Math.abs(r.w));
}

/** La distancia de `p` al tramo de `a` a `b`. */
function distanciaAlTramo(p: THREE.Vector3Like, a: THREE.Vector3, b: THREE.Vector3): number {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3(p.x - a.x, p.y - a.y, p.z - a.z);
  const t = limitar(ab.lengthSq() > 0 ? ap.dot(ab) / ab.lengthSq() : 0, 0, 1);
  return ap.sub(ab.multiplyScalar(t)).length();
}

/** Un material de luz: claro, sin sombra ni color (la paleta no tiene otro). */
function materialLuz(opacidad: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    name: "luz",
    color: COLORES.ojo,
    transparent: true,
    opacity: opacidad,
    depthWrite: false,
  });
}

/** Un cilindro de largo 1 sobre su y que se estira de un punto a otro cada vez que se dibuja. */
function tramo(material: THREE.Material, radio: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 8, 1, true), material);
  m.frustumCulled = false;
  return m;
}
const medioTramo = new THREE.Vector3();
const direccionTramo = new THREE.Vector3();
function estirar(m: THREE.Object3D, desde: THREE.Vector3, hasta: THREE.Vector3) {
  m.position.copy(medioTramo.addVectors(desde, hasta).multiplyScalar(0.5));
  m.scale.set(1, Math.max(0.001, desde.distanceTo(hasta)), 1);
  m.quaternion.setFromUnitVectors(ARRIBA, direccionTramo.copy(hasta).sub(desde).normalize());
}

// ── La vagoneta ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Vagoneta {
  readonly cual: "vagoneta";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto anduvo por su vía desde el principio (m) y a qué velocidad va (m/s, negativa si va para atrás). */
  readonly avance: number;
  readonly velocidad: number;
  /** Si pasó el cambio por el desvío. */
  readonly porElDesvio: boolean;
  /** Si llegó al final de su vía (o del desvío). */
  readonly enElTope: boolean;
  /** Cuántos muñecos van adentro. */
  readonly montados: number;
  /** Si tiene el freno puesto. */
  readonly frenada: boolean;
  /** Le da su vía: desde el principio, y en el cambio pregunta `cambio()` (si va por el desvío). La deja quieta al
   * principio de la vía. */
  seguir(via: Via, cambio?: () => boolean): void;
  /** La pone quieta a `s` metros del principio (por el desvío o no). */
  poner(s: number, porElDesvio?: boolean): void;
  /** Le pone (o le quita) el freno: frenada no se mueve, ni empujada ni de bajada. */
  frenar(si: boolean): void;
}

export function armarVagoneta(h: Herramientas, p: Plano<"vagoneta">): Vagoneta {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINA.vagoneta;
  const { centro, medio, giro } = p.caja;
  const ruedas = Math.min(p.ruedas, medio.y);
  // La vía por omisión: derecho hacia su frente (su +x), desde donde apoyan las ruedas
  const apoyo = h.enElMundo(p, 0, -medio.y, 0);
  const frente = EJE_X.clone().applyQuaternion(giro).multiplyScalar(p.recorrido).add(apoyo);
  let via: Via = crearVia([apoyo.toArray(), frente.toArray()]);
  let cambio: () => boolean = () => false;

  // La caja que choca: el piso arriba de las ruedas y cuatro paredes hasta arriba; solo con los muñecos
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(centro.x, centro.y, centro.z)
      .setRotation(giro)
      .setGravityScale(0)
      .setCanSleep(false)
      .lockRotations(),
  );
  llevaAlQuePisa(cuerpo);
  const alto = medio.y * 2 - ruedas;
  const pisoY = -medio.y + ruedas + a.pared / 2;
  const paredY = -medio.y + ruedas + alto / 2;
  const caja = (mx: number, my: number, mz: number, x: number, y: number, z: number, masa: number) =>
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(mx, my, mz)
        .setTranslation(x, y, z)
        .setMass(masa)
        .setFriction(0.9)
        .setCollisionGroups(GRUPOS_VAGONETA),
      cuerpo,
    );
  const colisionador = caja(medio.x, a.pared / 2, medio.z, 0, pisoY, 0, p.masa * 0.4);
  for (const s of [-1, 1]) {
    caja(a.pared / 2, alto / 2, medio.z, s * (medio.x - a.pared / 2), paredY, 0, p.masa * 0.15);
    caja(medio.x, alto / 2, a.pared / 2, 0, paredY, s * (medio.z - a.pared / 2), p.masa * 0.15);
  }

  const imagen = crearImagenVagoneta(medio, ruedas, h);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  let s = 0;
  let v = 0;
  let porElDesvio = false;
  let enElTope = false;
  let montados = 0;
  let frenada = false;
  /** El centro de la caja con las ruedas apoyadas en `pose.posicion`. */
  const sacarPose = (donde: number, desvio: boolean) => {
    const pose = via.pose(donde, desvio);
    const centroAhi = new THREE.Vector3(0, medio.y, 0).applyQuaternion(pose.giro).add(pose.posicion);
    const adelante = EJE_X.clone().applyQuaternion(pose.giro);
    return { centro: centroAhi, giro: pose.giro, adelante, pendiente: pose.pendiente };
  };
  const finDeVia = () => (porElDesvio && s >= via.cambio ? via.largoDesvio : via.largo);
  /** Para contar como en el tope: el empujón de cada paso la corre apenas (m). */
  const TOPE = 0.002;
  /** La pone en la pose de `s`, con la velocidad a lo largo de la vía. */
  const asentar = (ya: boolean) => {
    const pose = sacarPose(s, porElDesvio);
    cuerpo.setTranslation(vector(pose.centro), true);
    cuerpo.setRotation(pose.giro, true);
    cuerpo.setLinvel(vector(pose.adelante.multiplyScalar(v)), true);
    cuerpo.setAngvel(CERO, true);
    if (ya) mundo.propagateModifiedBodyPositionsToColliders();
  };
  asentar(true);

  /** Si el muñeco va adentro: con la pelvis dentro de la caja (en su marco), entre el piso y el borde. */
  const local = new THREE.Vector3();
  const vaAdentro = (m: Muneco) => {
    const t = m.partes.pelvis.translation();
    const c = cuerpo.translation();
    local.set(t.x - c.x, t.y - c.y, t.z - c.z).applyQuaternion(cuaternion(cuerpo.rotation()).invert());
    const sobreElPiso = local.y - pisoY;
    return (
      Math.abs(local.x) <= medio.x + a.adentro.margen &&
      Math.abs(local.z) <= medio.z + a.adentro.margen &&
      sobreElPiso > 0 &&
      sobreElPiso < alto
    );
  };

  h.antes((munecos) => {
    montados = munecos.filter(vaAdentro).length;
    // Lo que anduvo en el paso de antes (el empujón incluido), a lo largo de la vía; lo de costado no cuenta
    const pose = sacarPose(s, porElDesvio);
    const t = cuerpo.translation();
    const antes = s;
    if (frenada) v = 0;
    else {
      s += (t.x - pose.centro.x) * pose.adelante.x;
      s += (t.y - pose.centro.y) * pose.adelante.y;
      s += (t.z - pose.centro.z) * pose.adelante.z;
      const lv = cuerpo.linvel();
      v = lv.x * pose.adelante.x + lv.y * pose.adelante.y + lv.z * pose.adelante.z;
      // La cuesta la apura (o la frena) y los rieles la frenan de a poco
      v += (GRAVEDAD * pose.pendiente - p.roce * v) * PASO;
      v -= Math.sign(v) * Math.min(Math.abs(v), a.rozar * PASO);
      if (Math.abs(v) < 0.01 && Math.abs(pose.pendiente) < 0.005) v = 0;
      v = limitar(v, -p.velocidad, p.velocidad);
    }
    // En el cambio decide por dónde sigue
    if (antes < via.cambio && s >= via.cambio) porElDesvio = cambio();
    const fin = finDeVia();
    enElTope = false;
    if (s <= 0) {
      s = 0;
      v = Math.max(0, v);
    } else if (s >= fin - TOPE) {
      s = Math.min(s, fin);
      v = Math.min(0, v);
      enElTope = true;
    }
    asentar(false);
  });

  // Las ruedas giran con lo que anduvo (también en el invitado, con los cuerpos como llegan)
  const ruedasImagen = imagen.getObjectByName("ruedas");
  const radioRueda = ruedas * 0.55;
  const donde = new THREE.Vector3().copy(cuerpo.translation());
  let vueltas = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const adelante = EJE_X.clone().applyQuaternion(cuaternion(cuerpo.rotation()));
    vueltas -=
      ((t.x - donde.x) * adelante.x + (t.y - donde.y) * adelante.y + (t.z - donde.z) * adelante.z) / radioRueda;
    donde.copy(t);
  });
  h.dibujar(() => {
    if (!ruedasImagen) return;
    for (const rueda of ruedasImagen.children) rueda.rotation.z = vueltas;
  });

  const vagoneta: Vagoneta = {
    cual: "vagoneta",
    nombre: p.nombre,
    cuerpo,
    get avance() {
      return s;
    },
    get velocidad() {
      return v;
    },
    get porElDesvio() {
      return porElDesvio && s >= via.cambio;
    },
    get enElTope() {
      return enElTope;
    },
    get montados() {
      return montados;
    },
    get frenada() {
      return frenada;
    },
    seguir(nueva, cambiar) {
      via = nueva;
      cambio = cambiar ?? (() => false);
      vagoneta.poner(0);
    },
    poner(dondeVa, desvio = false) {
      porElDesvio = desvio;
      s = limitar(dondeVa, 0, desvio && dondeVa >= via.cambio ? via.largoDesvio : via.largo);
      v = 0;
      enElTope = s >= finDeVia() - TOPE;
      asentar(true);
      donde.copy(cuerpo.translation());
    },
    frenar(si) {
      frenada = si;
      if (si) v = 0;
    },
  };
  return vagoneta;
}

/** Una vagoneta de mina del tamaño de `medio`, mirando hacia +x: una caja de fierro más ancha arriba, con sus
 * flejes y remaches, un poco de mineral adentro y cuatro ruedas (en el grupo «ruedas», para que giren). */
function crearImagenVagoneta(medio: THREE.Vector3, ruedas: number, h: Herramientas): THREE.Object3D {
  const hierro: THREE.BufferGeometry[] = [];
  const madera: THREE.BufferGeometry[] = [];
  const fondo = -medio.y + ruedas;
  const alto = medio.y * 2 - ruedas;
  const p = AJUSTES_MINA.vagoneta.pared;
  // El piso y las paredes, de tablas sobre un bastidor de fierro
  madera.push(new THREE.BoxGeometry(medio.x * 2 - 0.04, p, medio.z * 2 - 0.04).translate(0, fondo + p / 2, 0));
  for (const s of [-1, 1]) {
    madera.push(new THREE.BoxGeometry(p, alto, medio.z * 2).translate(s * (medio.x - p / 2), fondo + alto / 2, 0));
    madera.push(new THREE.BoxGeometry(medio.x * 2, alto, p).translate(0, fondo + alto / 2, s * (medio.z - p / 2)));
  }
  // Los flejes: arriba (el borde), al medio y abajo, alrededor de la caja
  for (const y of [fondo + 0.04, fondo + alto / 2, fondo + alto - 0.03]) {
    for (const s of [-1, 1]) {
      hierro.push(new THREE.BoxGeometry(0.03, 0.06, medio.z * 2 + 0.04).translate(s * (medio.x + 0.01), y, 0));
      hierro.push(new THREE.BoxGeometry(medio.x * 2 + 0.04, 0.06, 0.03).translate(0, y, s * (medio.z + 0.01)));
    }
  }
  // Los enganches de las puntas y el chasis entre las ruedas
  for (const s of [-1, 1])
    hierro.push(new THREE.BoxGeometry(0.16, 0.08, 0.12).translate(s * (medio.x + 0.08), fondo + 0.1, 0));
  for (const s of [-1, 1])
    hierro.push(new THREE.BoxGeometry(medio.x * 1.8, 0.08, 0.06).translate(0, fondo - 0.04, s * medio.z * 0.7));
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(juntar(madera), h.madera), new THREE.Mesh(juntar(hierro), h.oscuro));
  // Un montoncito de mineral adentro, abajo (no tapa al que va montado)
  const mineral: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const x = -medio.x * 0.7 + ((i * 0.6180339) % 1) * medio.x * 1.4;
    const z = -medio.z * 0.6 + ((i * 0.4142135 + 0.3) % 1) * medio.z * 1.2;
    mineral.push(new THREE.IcosahedronGeometry(0.08 + (i % 3) * 0.025, 0).translate(x, fondo + p + 0.06, z));
  }
  grupo.add(new THREE.Mesh(juntar(mineral), h.oscuro));
  // Las ruedas, cada una en su lugar, girando sobre su z
  const radio = ruedas * 0.55;
  const ruedasGrupo = new THREE.Group();
  ruedasGrupo.name = "ruedas";
  const geometria = juntar([
    new THREE.CylinderGeometry(radio, radio, 0.06, 14).rotateX(Math.PI / 2),
    new THREE.BoxGeometry(radio * 1.7, 0.04, 0.07),
    new THREE.BoxGeometry(0.04, radio * 1.7, 0.07),
  ]);
  for (const x of [-medio.x * 0.6, medio.x * 0.6])
    for (const z of [-1, 1]) {
      const rueda = new THREE.Mesh(geometria, h.oscuro);
      rueda.position.set(x, -medio.y + radio, z * medio.z * 0.72);
      ruedasGrupo.add(rueda);
    }
  grupo.add(ruedasGrupo);
  return grupo;
}

// ── El espejo ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Espejo {
  readonly cual: "espejo";
  readonly nombre: string;
  /** El marco que gira: el espejo, el brazo y su manija. */
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto se lo giró desde el reposo: 0 en reposo, 1 en su tope. */
  readonly recorrido: number;
  /** Si está en su tope (más allá de su `umbral`). */
  readonly orientado: boolean;
  /** Llama a `aviso` cada vez que queda orientado o deja de estarlo. Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: (orientado: boolean) => void): () => void;
  /** Dónde corta el espejo el rayo que sale de `desde` hacia `hacia` (normalizado): la distancia, o `null` si no lo
   * toca. Y hacia dónde mira ahora (su frente, en el mundo). */
  cortar(desde: THREE.Vector3, hacia: THREE.Vector3): number | null;
  normal(salida: THREE.Vector3): THREE.Vector3;
}

export function armarEspejo(h: Herramientas, p: Plano<"espejo">): Espejo {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINA.espejo;
  const { centro, medio, giro } = p.caja;
  // El eje, a la altura del brazo, sobre el piso que está `poste` debajo de la caja
  const piso = centro.y - medio.y - p.poste;
  const eje = new THREE.Vector3(centro.x, piso + p.manija, centro.z);
  const alEspejo = centro.y - eje.y;
  // El poste es fijo, del piso a la base del espejo (ahí no lo cruza el haz)
  const ancla = h.fijo(eje, giro);
  const altoPoste = Math.max(0.1, centro.y - medio.y - piso);
  mundo.createCollider(
    rapier.ColliderDesc.cylinder(altoPoste / 2, a.poste).setTranslation(0, piso + altoPoste / 2 - eje.y, 0),
    ancla,
  );
  // El marco: el brazo hacia su frente (+z) con la manija en la punta, y el espejo arriba, que no choca
  const marco = mundo.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(eje.x, eje.y, eje.z)
      .setRotation(giro)
      .setAngularDamping(1)
      .setCanSleep(false),
  );
  const acostado = new THREE.Quaternion().setFromAxisAngle(EJE_X, Math.PI / 2);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(p.brazo / 2 - a.radioBrazo, a.radioBrazo)
      .setTranslation(0, 0, p.brazo / 2)
      .setRotation(acostado)
      .setMass(p.masa * 0.3)
      .setFriction(0.9),
    marco,
  );
  mundo.createCollider(
    rapier.ColliderDesc.capsule(a.manija / 2, a.radioBrazo * 0.8)
      .setTranslation(0, 0, p.brazo)
      .setMass(p.masa * 0.1)
      .setFriction(0.9),
    marco,
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, 0.02)
      .setTranslation(0, alEspejo, 0)
      .setMass(p.masa * 0.6)
      .setCollisionGroups(0),
    marco,
  );
  const junta = mundo.createImpulseJoint(rapier.JointData.revolute(CERO, CERO, vector(ARRIBA)), ancla, marco, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.RevoluteImpulseJoint) {
    // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
    junta.setLimits(Math.min(0, p.giro), Math.max(0, p.giro));
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    // El resorte lo lleva al reposo: en el tope hace falta `fuerza` en la punta del brazo
    const rigidez = (p.fuerza * p.brazo) / Math.abs(p.giro);
    const inercia = p.masa * (p.brazo * p.brazo * 0.3 + medio.x * medio.x * 0.2);
    junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * inercia));
  }

  // La imagen: el espejo (claro, que refleja) en su marco de madera, el brazo y la manija; el poste y su base aparte
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  const luna = new THREE.MeshStandardMaterial({
    name: "espejo",
    color: COLORES.agua,
    emissive: COLORES.niebla,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.6,
  });
  const vidrio = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, 0.03), luna);
  vidrio.position.y = alEspejo;
  const borde = 0.05;
  const listones = new THREE.Mesh(
    juntar([
      ...[-1, 1].map((s) =>
        new THREE.BoxGeometry(medio.x * 2 + borde * 2, borde, 0.06).translate(
          0,
          alEspejo + s * (medio.y + borde / 2),
          0,
        ),
      ),
      ...[-1, 1].map((s) =>
        new THREE.BoxGeometry(borde, medio.y * 2, 0.06).translate(s * (medio.x + borde / 2), alEspejo, 0),
      ),
      // La horquilla que lo une al poste
      new THREE.BoxGeometry(0.08, alEspejo - medio.y, 0.08).translate(0, (alEspejo - medio.y) / 2, 0),
    ]),
    h.madera,
  );
  const brazo = new THREE.Mesh(
    new THREE.CylinderGeometry(a.radioBrazo * 0.8, a.radioBrazo, p.brazo, 8)
      .rotateX(Math.PI / 2)
      .translate(0, 0, p.brazo / 2),
    h.madera,
  );
  const manija = new THREE.Mesh(
    new THREE.CapsuleGeometry(a.radioBrazo * 0.8, a.manija, 4, 8).translate(0, 0, p.brazo),
    h.oscuro,
  );
  objeto.add(vidrio, listones, brazo, manija);
  h.mover(marco, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo: marco, colisionador });
  const poste = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(a.poste * 0.8, a.poste, altoPoste, 10).translate(0, altoPoste / 2, 0),
      new THREE.CylinderGeometry(0.28, 0.34, 0.16, 10).translate(0, 0.08, 0),
    ]),
    h.oscuro,
  );
  poste.position.set(eje.x, piso, eje.z);
  h.escena.add(poste);

  const interruptor = crearInterruptor();
  let recorrido = 0;
  h.guardar(() => {
    recorrido = limitar(anguloRelativo(giro, cuaternion(marco.rotation()), ARRIBA) / p.giro, 0, 1);
  });
  h.despues(() => {
    interruptor.poner(recorrido, p.umbral, p.umbral - a.histeresis);
  });

  const centroAhora = new THREE.Vector3();
  const n = new THREE.Vector3();
  const lado = new THREE.Vector3();
  const punto = new THREE.Vector3();
  return {
    cual: "espejo",
    nombre: p.nombre,
    cuerpo: marco,
    get recorrido() {
      return recorrido;
    },
    get orientado() {
      return interruptor.prendido;
    },
    alCambiar: interruptor.alCambiar,
    normal(salida) {
      return salida.copy(EJE_Z).applyQuaternion(cuaternion(marco.rotation()));
    },
    cortar(desde, hacia) {
      const q = cuaternion(marco.rotation());
      n.copy(EJE_Z).applyQuaternion(q);
      const dn = hacia.dot(n);
      if (Math.abs(dn) < 1e-4) return null;
      centroAhora.set(0, alEspejo, 0).applyQuaternion(q).add(marco.translation());
      const t = centroAhora.clone().sub(desde).dot(n) / dn;
      if (t < 1e-3) return null;
      punto.copy(desde).addScaledVector(hacia, t).sub(centroAhora);
      lado.copy(EJE_X).applyQuaternion(q);
      if (Math.abs(punto.dot(lado)) > medio.x || Math.abs(punto.y) > medio.y) return null;
      return t;
    },
  };
}

// ── La grieta (el haz de sol) ────────────────────────────────────────────────────────────────────────────────

export interface Grieta {
  readonly cual: "grieta";
  readonly nombre: string;
  /** Por dónde va el haz: el punto de la grieta y donde termina cada tramo (en un espejo, en una pared o lejos). */
  readonly camino: readonly THREE.Vector3[];
  /** Los espejos en los que rebota, en orden. */
  readonly espejos: readonly Espejo[];
  /** Si el haz pasa a menos de `radio` de ese punto. */
  alumbra(punto: THREE.Vector3Like, radio: number): boolean;
}

export function armarGrieta(h: Herramientas, p: Plano<"grieta">): Grieta {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINA.grieta;
  const { centro, medio, giro } = p.caja;
  const inicio = centro.clone();
  const direccion = EJE_Z.clone().applyQuaternion(giro).normalize();
  const camino: THREE.Vector3[] = [inicio.clone()];
  const espejos: Espejo[] = [];
  const rayo = new rapier.Ray(CERO, CERO);
  const n = new THREE.Vector3();

  /** Lo que para el haz: lo fijo y lo cinemático que choca (no los muñecos ni lo suelto, ni las zonas). Se le pregunta
   * a cada colisionador, no al mundo: el invitado no corre pasos, y las consultas del mundo se arman al correrlos. La
   * lista se arma una vez (con todo ya armado); lo que después deja de chocar (la ofrenda del Tío) se salta. */
  let candidatos: RAPIER.Collider[] | null = null;
  const parar = (o: THREE.Vector3, d: THREE.Vector3, hasta: number) => {
    if (!candidatos) {
      const lista: RAPIER.Collider[] = [];
      mundo.forEachCollider((c) => {
        if (!c.isSensor() && !c.parent()?.isDynamic()) lista.push(c);
      });
      candidatos = lista;
    }
    rayo.origin = vector(o);
    rayo.dir = vector(d);
    let cerca = hasta;
    for (const c of candidatos) {
      if (c.collisionGroups() === 0 || c.parent()?.isDynamic()) continue;
      const t = c.castRay(rayo, cerca, true);
      if (t >= 0 && t < cerca) cerca = t;
    }
    return cerca;
  };

  /** Sigue el haz desde la grieta: rebota en el espejo más cercano que corta, y lo para lo fijo y lo cinemático. */
  const trazar = () => {
    mundo.propagateModifiedBodyPositionsToColliders();
    camino.length = 1;
    espejos.length = 0;
    const o = inicio.clone();
    const d = direccion.clone();
    for (let i = 0; i <= p.rebotes; i++) {
      let hasta = p.largo;
      let espejo: Espejo | null = null;
      for (const otra of h.lista) {
        if (otra.cual !== "espejo") continue;
        const t = otra.cortar(o, d);
        if (t !== null && t < hasta) {
          hasta = t;
          espejo = otra;
        }
      }
      const pared = parar(o, d, hasta);
      if (pared < hasta) {
        hasta = pared;
        espejo = null;
      }
      o.addScaledVector(d, hasta);
      camino.push(o.clone());
      if (!espejo) break;
      espejos.push(espejo);
      espejo.normal(n);
      d.addScaledVector(n, -2 * d.dot(n)).normalize();
    }
  };

  // La imagen: la grieta (una raja clara en la roca) y el haz, un tramo por rebote, con su resplandor
  const raja = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, 0.02), materialLuz(0.95));
  raja.position.copy(centro);
  raja.quaternion.copy(giro);
  h.escena.add(raja);
  const haz = materialLuz(0.6);
  const resplandor = materialLuz(0.13);
  const tramos = Array.from({ length: p.rebotes + 1 }, () => {
    const t = new THREE.Group().add(tramo(haz, a.haz), tramo(resplandor, a.resplandor));
    h.escena.add(t);
    return t;
  });
  const mancha = new THREE.Mesh(new THREE.SphereGeometry(a.resplandor * 1.3, 12, 8), materialLuz(0.35));
  h.escena.add(mancha);
  h.guardar(trazar);
  h.dibujar(() => {
    tramos.forEach((t, i) => {
      const desde = camino[i];
      const hasta = camino[i + 1];
      t.visible = desde !== undefined && hasta !== undefined;
      if (desde && hasta) for (const m of t.children) estirar(m, desde, hasta);
    });
    const fin = camino[camino.length - 1];
    if (fin) mancha.position.copy(fin);
  });

  return {
    cual: "grieta",
    nombre: p.nombre,
    camino,
    espejos,
    alumbra(punto, radio) {
      for (let i = 1; i < camino.length; i++) {
        const desde = camino[i - 1];
        const hasta = camino[i];
        if (desde && hasta && distanciaAlTramo(punto, desde, hasta) < radio) return true;
      }
      return false;
    },
  };
}

// ── Las velas ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Velas {
  readonly cual: "velas";
  readonly nombre: string;
  /** Dónde está la base de cada vela (en el suelo). */
  readonly puntos: readonly THREE.Vector3[];
  /** Si ese punto pasa por una vela: a menos de su radio, de costado, y no muy por encima. */
  cerca(punto: THREE.Vector3Like): boolean;
}

export function armarVelas(h: Herramientas, p: Plano<"velas">): Velas {
  const { medio } = p.caja;
  const enX = medio.x >= medio.z;
  const mitad = enX ? medio.x : medio.z;
  const alto = medio.y * 2;
  const puntos = Array.from({ length: p.cuantas }, (_, i) => {
    const t = -mitad + ((i + 0.5) * mitad * 2) / p.cuantas;
    return h.enElMundo(p, enX ? t : 0, -medio.y, enX ? 0 : t);
  });

  // La imagen: cada vela en su piedrita, con su llama y la luz que hace en el suelo (lo que no hay que pisar)
  const cera = new THREE.MeshStandardMaterial({ name: "cera", color: COLORES.agua, roughness: 0.7 });
  const piedras: THREE.BufferGeometry[] = [];
  const velas: THREE.BufferGeometry[] = [];
  const llamas: THREE.Mesh[] = [];
  const fuego = materialLuz(0.95);
  const charco = materialLuz(0.1);
  const geometriaLlama = new THREE.ConeGeometry(0.035, 0.12, 8).translate(0, 0.06, 0);
  for (const [i, b] of puntos.entries()) {
    const ancho = 0.04 + (i % 2) * 0.012;
    const altoVela = alto * (0.7 + ((i * 0.37) % 0.3));
    piedras.push(new THREE.DodecahedronGeometry(0.11, 0).scale(1, 0.5, 1).translate(b.x, b.y + 0.04, b.z));
    velas.push(
      new THREE.CylinderGeometry(ancho, ancho * 1.1, altoVela, 8).translate(b.x, b.y + 0.08 + altoVela / 2, b.z),
    );
    const llama = new THREE.Mesh(geometriaLlama, fuego);
    llama.position.set(b.x, b.y + 0.08 + altoVela, b.z);
    h.escena.add(llama);
    llamas.push(llama);
    const luz = new THREE.Mesh(new THREE.CircleGeometry(p.radio, 24).rotateX(-Math.PI / 2), charco);
    luz.position.set(b.x, b.y + 0.015, b.z);
    h.escena.add(luz);
  }
  h.escena.add(new THREE.Mesh(juntar(piedras), h.oscuro), new THREE.Mesh(juntar(velas), cera));
  // Las llamas tiritan (sin azar: con los pasos)
  let pasos = 0;
  h.guardar(() => {
    pasos++;
  });
  h.dibujar(() => {
    llamas.forEach((llama, i) => {
      const t = pasos * PASO * 9 + i * 1.7;
      llama.scale.set(1, 0.85 + 0.25 * Math.sin(t) * Math.sin(t * 0.43 + i), 1);
      llama.rotation.z = 0.12 * Math.sin(t * 0.7 + i);
    });
  });

  return {
    cual: "velas",
    nombre: p.nombre,
    puntos,
    cerca(punto) {
      return puntos.some(
        (b) => Math.hypot(punto.x - b.x, punto.z - b.z) < p.radio && punto.y > b.y - 0.3 && punto.y < b.y + 2.5,
      );
    },
  };
}

// ── La ofrenda ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Ofrenda {
  readonly cual: "ofrenda";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos la tienen agarrada. */
  readonly agarrado: number;
  readonly enSuLugar: boolean;
  /** Si ya se la dieron a El Tío (la tiene él). */
  readonly entregada: boolean;
  /** Cuántas veces pasó por las velas. */
  readonly sustos: number;
  /** Se la da a El Tío: deja de chocar y la mueve él (`llevar`). */
  entregar(): void;
  llevar(posicion: THREE.Vector3Like, giro: THREE.Quaternion): void;
  /** Llama a `aviso` cuando pasa por las velas, con quiénes la llevaban. Devuelve cómo dejar de escuchar. */
  alAsustar(aviso: (llevaban: readonly (0 | 1)[]) => void): () => void;
  /** La pone en su lugar, quieta (si no la tiene El Tío). Pasa sola si queda tirada o cae al vacío. */
  volver(): void;
}

export function armarOfrenda(h: Herramientas, p: Plano<"ofrenda">): Ofrenda {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINA.ofrenda;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setSleeping(true));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenOfrenda(medio, h);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  // Donde aparece el que la llevaba al pasar por las velas: frente a ella, en el piso que haya ahí
  const frente = EJE_Z.clone().applyQuaternion(giro).setY(0).normalize();
  let retomar: { posicion: THREE.Vector3; rumbo: number } | null = null;
  const dondeRetomar = () => {
    if (retomar) return retomar;
    const arriba = centro.clone().addScaledVector(frente, a.retomar);
    const golpe = mundo.castRay(
      new rapier.Ray(vector(arriba), { x: 0, y: -1, z: 0 }),
      20,
      true,
      rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    );
    const piso = golpe ? arriba.y - golpe.timeOfImpact : centro.y - 1;
    retomar = { posicion: new THREE.Vector3(arriba.x, piso, arriba.z), rumbo: Math.atan2(-frente.x, -frente.z) };
    return retomar;
  };

  let agarrado = 0;
  let tirado = 0;
  let entregada = false;
  let sustos = 0;
  const avisos = new Set<(llevaban: readonly (0 | 1)[]) => void>();
  const ofrenda: Ofrenda = {
    cual: "ofrenda",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.08;
    },
    get entregada() {
      return entregada;
    },
    get sustos() {
      return sustos;
    },
    entregar() {
      if (entregada) return;
      entregada = true;
      colisionador.setCollisionGroups(0);
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    },
    llevar(posicion, q) {
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(q);
    },
    alAsustar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      if (entregada) return;
      cuerpo.setTranslation(vector(centro), true);
      cuerpo.setRotation(giro, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
      mundo.propagateModifiedBodyPositionsToColliders();
      cuerpo.sleep();
    },
  };

  h.despues((munecos, fuera) => {
    agarrado = munecos.filter((m) => manosEn(m, cuerpo) > 0).length;
    if (entregada) return;
    const t = cuerpo.translation();
    // Pasó por las velas: ¡pum! El que la llevaba aparece frente a su lugar (suelta todo) y ella vuelve
    if (h.lista.some((otra) => otra.cual === "velas" && otra.cerca(t))) {
      const llevaban = ([0, 1] as const).filter((j) => {
        const m = munecos[j];
        return m !== undefined && manosEn(m, cuerpo) > 0;
      });
      const r = dondeRetomar();
      for (const j of llevaban) {
        const lado = (j === 0 ? 1 : -1) * 0.35;
        const m = munecos[j];
        m?.reaparecer(
          { x: r.posicion.x + frente.z * lado, y: r.posicion.y, z: r.posicion.z - frente.x * lado },
          r.rumbo,
        );
      }
      ofrenda.volver();
      agarrado = 0;
      tirado = 0;
      sustos++;
      for (const aviso of avisos) aviso(llevaban);
      return;
    }
    // Tirada en el suelo (o caída al vacío), vuelve sola
    tirado = agarrado === 0 && t.y < centro.y - a.bajo ? tirado + PASO : 0;
    if (fuera(t) || tirado > p.vuelve) {
      ofrenda.volver();
      tirado = 0;
    }
  });

  // El humo del susto: si la ofrenda saltó de golpe a su lugar desde otro lado (también en el invitado)
  const humo = new THREE.Group();
  const bocanada = new THREE.MeshBasicMaterial({
    name: "humo",
    color: COLORES.niebla,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const fogonazo = materialLuz(0);
  const bolas = Array.from({ length: 7 }, (_, i) => {
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.22 + (i % 3) * 0.06, 10, 8), i === 0 ? fogonazo : bocanada);
    humo.add(bola);
    return bola;
  });
  humo.visible = false;
  h.escena.add(humo);
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let desdeSusto = Number.POSITIVE_INFINITY;
  h.guardar(() => {
    const t = cuerpo.translation();
    const salto = Math.hypot(t.x - antes.x, t.y - antes.y, t.z - antes.z);
    const enCasa = Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.1;
    if (salto > 0.8 && enCasa) {
      humo.position.copy(antes);
      desdeSusto = 0;
    } else desdeSusto += PASO;
    antes.copy(t);
  });
  h.dibujar(() => {
    const t = desdeSusto / a.humo;
    humo.visible = t < 1;
    if (!humo.visible) return;
    bocanada.opacity = 0.75 * (1 - t);
    fogonazo.opacity = Math.max(0, 1 - t * 4);
    bolas.forEach((bola, i) => {
      const angulo = i * 2.39996;
      const r = i === 0 ? 0 : 0.15 + t * 0.6;
      bola.position.set(Math.cos(angulo) * r, t * (0.4 + (i % 3) * 0.2), Math.sin(angulo) * r);
      bola.scale.setScalar(i === 0 ? 1 + t * 3 : 0.6 + t * 1.6);
    });
  });
  return ofrenda;
}

/** La ofrenda: un atado de tela con hojas de coca que asoman, una botellita y un cigarro, del tamaño de `medio`. */
function crearImagenOfrenda(medio: THREE.Vector3, h: Herramientas): THREE.Group {
  const grupo = new THREE.Group();
  const tela = materialTela(COLORES.siluetaLejana, { repetir: 1, relieve: 6 });
  const atado = new THREE.SphereGeometry(1, 12, 8).scale(medio.x * 0.75, medio.y * 0.85, medio.z * 0.85);
  const nudo = new THREE.ConeGeometry(medio.x * 0.3, medio.y * 0.6, 6).translate(-medio.x * 0.2, medio.y * 0.85, 0);
  grupo.add(new THREE.Mesh(juntar([atado, nudo]), tela));
  const hojas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++)
    hojas.push(
      new THREE.SphereGeometry(0.035, 6, 4)
        .scale(1, 0.25, 0.55)
        .rotateZ(0.4 * i - 0.8)
        .translate(-medio.x * 0.1 + i * 0.03, medio.y * 0.9, (i - 2) * 0.02),
    );
  grupo.add(new THREE.Mesh(juntar(hojas), h.oscuro));
  const botella = new THREE.CylinderGeometry(medio.z * 0.28, medio.z * 0.32, medio.y * 1.3, 8).translate(
    medio.x * 0.72,
    medio.y * 0.1,
    0,
  );
  const cuello = new THREE.CylinderGeometry(medio.z * 0.1, medio.z * 0.14, medio.y * 0.5, 6).translate(
    medio.x * 0.72,
    medio.y * 1.0,
    0,
  );
  grupo.add(new THREE.Mesh(juntar([botella, cuello]), h.oscuro));
  const cigarro = new THREE.CylinderGeometry(0.012, 0.012, medio.x * 0.9, 6)
    .rotateZ(Math.PI / 2)
    .translate(0, medio.y * 0.55, medio.z * 0.8);
  grupo.add(new THREE.Mesh(cigarro, new THREE.MeshStandardMaterial({ name: "cigarro", color: COLORES.agua })));
  return grupo;
}
