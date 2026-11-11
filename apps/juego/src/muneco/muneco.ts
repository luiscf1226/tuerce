// El muñeco de trapo: un ragdoll activo hecho de cuerpos rígidos y articulaciones de Rapier.
//
// Cómo se mantiene en pie (la receta clásica de los ragdolls activos):
//   1. Suspensión: un rayo desde la pelvis hasta el suelo y un resorte que la sostiene a la altura de estar de pie.
//   2. Erguirse: pelvis, torso y cabeza reciben cada uno un torque PD que los lleva a estar derechos y mirando al rumbo.
//   3. Andar: una fuerza horizontal empuja el tronco hacia la velocidad deseada, solo si hay suelo bajo los pies.
//   4. Paso: caderas y rodillas son articulaciones de bisagra con motores de posición que siguen un ciclo de pasos
//      al ritmo de la velocidad real. Los brazos cuelgan de los hombros y se balancean al revés que las piernas.
//
// Encima de eso, una máquina de estados (TU-04): «de pie», «en el aire» (saltó o se le fue el suelo), «caido» (se
// pasó de inclinación o recibió un golpe fuerte: el tono baja a cero y cae como un trapo) y «levantandose» (tras un
// segundo quieto, el tono vuelve de a poco y los mismos torques lo enderezan; nada se teletransporta).
// Cada brazo es un cuerpo propio unido al torso con una rótula. Con su botón apretado sube hacia adelante y, si la
// mano toca algo, lo agarra con otra rótula entre la mano y eso (una caja, el mundo quieto, el otro muñeco) hasta que
// se suelta el botón (TU-05).
//
// Trepar (TU-06): colgado de un borde quieto con las dos manos, `avanzar` lo hace subir (estado «trepando»). Primero
// se iza hasta tener los hombros a la altura de las manos y después suelta el borde y se encarama, pataleando, hasta
// quedar con la pelvis arriba; ahí vuelve a estar «de pie». Es una fuerza en el tronco, como la de andar.
//
// Con el compañero y con las cosas (TU-07):
//   - Cargar: el brazo alzado que sostiene algo suelto se pone más firme cuanto más pesa su parte de la carga, pero
//     cada muñeco tiene un tope de fuerza en los brazos. Un huacal de 8 kg lo levantan dos; uno solo lo arrastra.
//   - De la mano: el que va de la mano del otro (o al que el otro tiene agarrado) y no camina, se deja llevar.
//   - Subir al otro: el que cuelga de la mano del compañero, con el compañero bien más arriba y firme, sube hacia la
//     mano que lo tiene; el de arriba lo termina de subir caminando.
//   - Lanzar: lo que se suelta en el aire, poco después de saltar, sale lanzado hacia adelante y arriba.
//
// Uso: en cada paso de físicas llamá `muneco.pasar(entrada)` y después `mundo.step()`.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { GRAVEDAD } from "../motor/fisica";
import { AJUSTES, INERCIA_EXTRA, MASAS, MEDIDAS } from "./ajustes";

export interface EntradaMuneco {
  /** Hacia adelante (1) o hacia atrás (-1), según hacia dónde mira el muñeco. */
  avanzar: number;
  /** Girar a la izquierda (1) o a la derecha (-1). */
  girar: number;
  /** Saltar: salta al apretarlo (no al mantenerlo apretado), si está de pie. */
  saltar?: boolean;
  /** Mientras está apretado, el brazo izquierdo sube hacia adelante y agarra lo que toca. */
  brazoIzquierdo?: boolean;
  /** Lo mismo para el brazo derecho. */
  brazoDerecho?: boolean;
  /** Pose de los brazos sueltos (señalar y gestos, TU-15): el brazo va hacia esa dirección sin agarrar nada. El
   * botón de agarrar le gana a la pose. */
  pose?: PoseBrazos;
}

/** Hacia dónde apunta la mano, en el marco del muñeco: `afuera` hacia el costado de ese brazo, `arriba` y
 * `adelante` hacia donde mira. No hace falta que mida 1. */
export interface PoseBrazo {
  afuera: number;
  arriba: number;
  adelante: number;
}

export type PoseBrazos = Partial<Record<NombreBrazo, PoseBrazo>>;

/** En qué anda el muñeco: parado (o caminando), en el aire (o colgado), trepando, tirado como un trapo o
 * levantándose. */
export type EstadoMuneco = "de pie" | "en el aire" | "trepando" | "caido" | "levantandose";

export const QUIETO: EntradaMuneco = { avanzar: 0, girar: 0 };

export type NombreBrazo = "brazoIzquierdo" | "brazoDerecho";

export type NombreParte =
  | "pelvis"
  | "torso"
  | "cabeza"
  | "brazoIzquierdo"
  | "brazoDerecho"
  | "musloIzquierdo"
  | "musloDerecho"
  | "canillaIzquierda"
  | "canillaDerecha";

export const NOMBRES_PARTES: readonly NombreParte[] = [
  "pelvis",
  "torso",
  "cabeza",
  "brazoIzquierdo",
  "brazoDerecho",
  "musloIzquierdo",
  "musloDerecho",
  "canillaIzquierda",
  "canillaDerecha",
];

export interface OpcionesMuneco {
  /** Dónde quedan los pies al empezar. */
  posicion?: { x: number; y: number; z: number };
  /** Hacia dónde mira al empezar, en radianes alrededor de +y (0 = hacia +z). */
  rumbo?: number;
  /** Número de jugador (0 o 1). Separa los grupos de choque: las partes de un muñeco no chocan entre sí,
   * pero sí con el otro muñeco y con el mundo. */
  indice?: number;
}

export interface Muneco {
  readonly partes: Readonly<Record<NombreParte, RAPIER.RigidBody>>;
  /** Aplica las fuerzas del equilibrio y del paso. Va antes de cada `mundo.step()`. */
  pasar(entrada: EntradaMuneco): void;
  /** Hacia dónde quiere mirar, en radianes alrededor de +y. */
  readonly rumbo: number;
  /** Cambia hacia dónde quiere mirar sin girarlo de a poco: al ponerlo en otro lugar (retomar una partida en
   * línea, TU-22). */
  orientar(rumbo: number): void;
  /** Si el rayo de la pelvis encontró suelo en el último paso. */
  readonly enElSuelo: boolean;
  /** En qué anda: «de pie», «en el aire», «caido» o «levantandose». */
  readonly estado: EstadoMuneco;
  /** Tope de 0 (trapo flojo) a 1 (normal) que pone el juego. Con 0 queda tirado y no se levanta. */
  firmeza: number;
  /** La firmeza de verdad en este paso, de 0 a 1: el tope de `firmeza` por el tono del estado (baja al caer y
   * sube al levantarse). Escala todas las fuerzas del equilibrio y los motores. */
  readonly tension: number;
  /** Masa total en kilos. */
  readonly masa: number;
  /** Lo que tiene agarrado esa mano (el colisionador que tocó), o `null` si no agarra nada. */
  agarrado(brazo: NombreBrazo): RAPIER.Collider | null;
  /** Si cuelga (o se apoya) con las dos manos de algo quieto que le queda más arriba del torso: un borde, una rama. */
  readonly colgado: boolean;
  /** Ángulo entre el eje del torso y la vertical, en radianes. */
  inclinacion(): number;
  /** Hacia dónde mira de verdad el torso, en radianes alrededor de +y. */
  rumboReal(): number;
  /** Lo lleva de pie, quieto y con las manos sueltas a `posicion` (donde quedan los pies), mirando hacia `rumbo`.
   * Para reaparecer después de caer al vacío (TU-11). Si el compañero lo tenía agarrado, también lo suelta. */
  reaparecer(posicion: { x: number; y: number; z: number }, rumbo: number): void;
}

/** Lo que un muñeco deja ver a los otros del mismo mundo (TU-07). */
interface Vecino {
  readonly masa: number;
  readonly pelvis: RAPIER.RigidBody;
  readonly partes: ReadonlySet<RAPIER.RigidBody>;
  estado(): EstadoMuneco;
  /** El cuerpo que agarra cada mano (o `null`). */
  sujetados(): readonly (RAPIER.RigidBody | null)[];
  /** Le suma la misma velocidad a todas sus partes (al lanzarlo). */
  empujar(dv: THREE.Vector3): void;
  /** Suelta lo que tenga agarrado de esos cuerpos (el otro muñeco reaparece en otro lado). */
  soltarDe(cuerpos: ReadonlySet<RAPIER.RigidBody>): void;
}
/** Los muñecos de cada mundo: así una mano sabe si lo que agarra es el otro muñeco y cuántas manos sostienen algo. */
const VECINOS = new WeakMap<RAPIER.World, Vecino[]>();

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const ABAJO = new THREE.Vector3(0, -1, 0);

export function crearMuneco(rapier: Rapier, mundo: RAPIER.World, opciones: OpcionesMuneco = {}): Muneco {
  const origen = new THREE.Vector3(opciones.posicion?.x ?? 0, opciones.posicion?.y ?? 0, opciones.posicion?.z ?? 0);
  let rumbo = opciones.rumbo ?? 0;
  const giroInicial = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);

  // Grupos de choque: 16 bits de pertenencia arriba y 16 de filtro abajo. Cada muñeco tiene su bit y no se choca
  // a sí mismo; el rayo de la suspensión usa el mismo filtro para no pisarse los propios pies.
  const bit = 1 << (1 + (opciones.indice ?? 0));
  const grupos = ((bit << 16) | (0xffff & ~bit)) >>> 0;
  const gruposRayo = ((0xffff << 16) | (0xffff & ~bit)) >>> 0;

  const { pelvis: mp, torso: mt, cabeza: mc, brazo: mb, cadera, muslo: mm, canilla: mk, pie } = MEDIDAS;

  const cuerpo = (x: number, y: number, z = 0) => {
    const p = new THREE.Vector3(x, y, z).applyQuaternion(giroInicial).add(origen);
    return mundo.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y, p.z)
        .setRotation(giroInicial)
        .setCanSleep(false)
        .setLinearDamping(AJUSTES.amortiguacion.lineal)
        .setAngularDamping(AJUSTES.amortiguacion.angular),
    );
  };
  const pegar = (
    desc: RAPIER.ColliderDesc,
    masa: number,
    a: RAPIER.RigidBody,
    rozamiento: number = AJUSTES.rozamiento.cuerpo,
  ) => mundo.createCollider(desc.setMass(masa).setFriction(rozamiento).setCollisionGroups(grupos), a);

  // Tronco
  const pelvis = cuerpo(0, mp.y);
  pegar(rapier.ColliderDesc.ball(mp.radio), MASAS.pelvis, pelvis);
  const torso = cuerpo(0, mt.y);
  pegar(rapier.ColliderDesc.capsule(mt.medioAlto, mt.radio), MASAS.torso, torso);
  const cabeza = cuerpo(0, mc.y);
  pegar(rapier.ColliderDesc.ball(mc.radio), MASAS.cabeza, cabeza);
  for (const [c, extra] of [
    [pelvis, INERCIA_EXTRA.pelvis],
    [torso, INERCIA_EXTRA.torso],
    [cabeza, INERCIA_EXTRA.cabeza],
  ] as const) {
    c.setAdditionalMassProperties(
      0,
      { x: 0, y: 0, z: 0 },
      { x: extra, y: extra, z: extra },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );
    c.recomputeMassPropertiesFromColliders();
  }

  // Brazos: un solo tramo con la mano redonda en la punta
  const brazo = (lado: 1 | -1) => {
    const b = cuerpo(lado * mb.hombroX, mb.hombroY - mb.largo / 2);
    pegar(rapier.ColliderDesc.capsule(mb.largo / 2, mb.radio), MASAS.brazo * 0.7, b);
    pegar(rapier.ColliderDesc.ball(mb.mano).setTranslation(0, -mb.largo / 2, 0), MASAS.brazo * 0.3, b);
    return b;
  };
  const brazoIzquierdo = brazo(1);
  const brazoDerecho = brazo(-1);

  // Piernas: muslo y canilla; el pie va pegado a la canilla
  const rodillaY = cadera.y - mm.largo;
  const pierna = (lado: 1 | -1) => {
    const muslo = cuerpo(lado * cadera.x, cadera.y - mm.largo / 2);
    pegar(rapier.ColliderDesc.capsule(mm.largo / 2, mm.radio), MASAS.muslo, muslo);
    const canilla = cuerpo(lado * cadera.x, rodillaY - mk.largo / 2);
    pegar(rapier.ColliderDesc.capsule(mk.largo / 2, mk.radio), MASAS.canilla * 0.6, canilla);
    pegar(
      rapier.ColliderDesc.cuboid(pie.medioAncho, pie.medioAlto, pie.medioLargo).setTranslation(
        0,
        pie.medioAlto - (rodillaY - mk.largo / 2),
        pie.adelante,
      ),
      MASAS.canilla * 0.4,
      canilla,
      AJUSTES.rozamiento.pie,
    );
    return { muslo, canilla };
  };
  const izquierda = pierna(1);
  const derecha = pierna(-1);

  // Articulaciones. Las anclas van en el marco local de cada cuerpo; todos empiezan con la misma rotación, así que
  // el ángulo cero de cada bisagra es la pose de pie.
  const local = (a: RAPIER.RigidBody, x: number, y: number) => {
    const centro = new THREE.Vector3().copy(a.translation()).sub(origen).applyQuaternion(giroInicial.clone().invert());
    return { x: x - centro.x, y: y - centro.y, z: -centro.z };
  };
  const rotula = (a: RAPIER.RigidBody, b: RAPIER.RigidBody, x: number, y: number) =>
    mundo.createImpulseJoint(rapier.JointData.spherical(local(a, x, y), local(b, x, y)), a, b, true);
  const bisagra = (a: RAPIER.RigidBody, b: RAPIER.RigidBody, x: number, y: number, min: number, max: number) => {
    const j = mundo.createImpulseJoint(
      rapier.JointData.revolute(local(a, x, y), local(b, x, y), { x: 1, y: 0, z: 0 }),
      a,
      b,
      true,
    ) as RAPIER.RevoluteImpulseJoint;
    j.setLimits(min, max);
    j.configureMotorModel(rapier.MotorModel.ForceBased);
    return j;
  };

  rotula(pelvis, torso, 0, (mp.y + mt.y) / 2);
  rotula(torso, cabeza, 0, MEDIDAS.cuello);
  rotula(torso, brazoIzquierdo, mb.hombroX, mb.hombroY);
  rotula(torso, brazoDerecho, -mb.hombroX, mb.hombroY);
  // Cadera: ángulo negativo lleva la pierna hacia adelante. Rodilla: positivo dobla la canilla hacia atrás.
  const caderaIzquierda = bisagra(pelvis, izquierda.muslo, cadera.x, cadera.y, -1.6, 1);
  const caderaDerecha = bisagra(pelvis, derecha.muslo, -cadera.x, cadera.y, -1.6, 1);
  const rodillaIzquierda = bisagra(izquierda.muslo, izquierda.canilla, cadera.x, rodillaY, 0, 2.3);
  const rodillaDerecha = bisagra(derecha.muslo, derecha.canilla, -cadera.x, rodillaY, 0, 2.3);

  const partes: Record<NombreParte, RAPIER.RigidBody> = {
    pelvis,
    torso,
    cabeza,
    brazoIzquierdo,
    brazoDerecho,
    musloIzquierdo: izquierda.muslo,
    musloDerecho: derecha.muslo,
    canillaIzquierda: izquierda.canilla,
    canillaDerecha: derecha.canilla,
  };
  /** Dónde queda cada parte en la pose de pie, en el marco del muñeco (pies en el origen, mirando hacia +z). */
  const poseDePie = NOMBRES_PARTES.map(
    (n) =>
      [
        partes[n],
        new THREE.Vector3().copy(partes[n].translation()).sub(origen).applyQuaternion(giroInicial.clone().invert()),
      ] as const,
  );
  /** Cada cuerpo con su masa, para sumar el centro de masa sin cruzar a Rapier de más. */
  const conMasa = NOMBRES_PARTES.map((n) => [partes[n], partes[n].mass()] as const);
  const masa = conMasa.reduce((suma, [, m]) => suma + m, 0);
  const peso = masa * -GRAVEDAD;

  let fase = 0;
  let enElSuelo = false;
  let firmeza = 1;

  // La máquina de estados (TU-04)
  let estado: EstadoMuneco = "de pie";
  /** El tono del estado: 1 de pie, baja a 0 al caer y vuelve a subir al levantarse. */
  let tono = 1;
  /** `firmeza` por `tono`: lo que escala de verdad las fuerzas en este paso. */
  let tension = 1;
  let tiempoEnEstado = 0;
  let tiempoSinSuelo = 0;
  let tiempoQuieto = 0;
  /** Lo que falta para poder volver a saltar (s). */
  let espera = 0;
  let saltarAntes = false;
  /** Tiempo desde el último salto (s): lo que se suelta poco después sale lanzado (TU-07). */
  let desdeSalto = Number.POSITIVE_INFINITY;
  /** El compañero que lo tiene de la mano desde bien más arriba (TU-07), y el punto por donde lo tiene. */
  let deLaMano: Vecino | undefined;
  const agarreDeLaMano = new THREE.Vector3();
  /** Si cuelga con las dos manos de algo quieto, y el punto medio entre las dos manos (TU-06). */
  let colgado = false;
  const agarre = new THREE.Vector3();
  /** La trepada en curso: la altura de arriba del borde, dónde lo agarró y si ya lo soltó para encaramarse. */
  const trepada = { borde: 0, ancla: new THREE.Vector3(), encaramado: false, fase: 0 };
  /** Velocidad del centro de masa en este paso y en el anterior: su diferencia mide los golpes. */
  const centro = new THREE.Vector3();
  const centroAntes = new THREE.Vector3();

  // Objetos de trabajo, para no crear basura en cada paso
  const q = new THREE.Quaternion();
  const qObjetivo = new THREE.Quaternion();
  const qRumbo = new THREE.Quaternion();
  const qInclinar = new THREE.Quaternion();
  const haciaPose = new THREE.Vector3();
  const qAux = new THREE.Quaternion();
  const error = new THREE.Vector3();
  const w = new THREE.Vector3();
  const w2 = new THREE.Vector3();
  const torque = new THREE.Vector3();
  const adelante = new THREE.Vector3();
  const eje = new THREE.Vector3();
  const mano = new THREE.Vector3();
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const rayoBorde = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const qAncla = new THREE.Quaternion();
  const ancla = new THREE.Vector3();

  // Agarrar (TU-05). Cada brazo guarda su rótula con lo agarrado. Lo que no tiene cuerpo (el suelo, un borde
  // quieto) se agarra con un cuerpo fijo propio, que se crea la primera vez que hace falta.
  const brazos = (
    [
      ["brazoIzquierdo", brazoIzquierdo, 1],
      ["brazoDerecho", brazoDerecho, -1],
    ] as const
  ).map(([nombre, cuerpo, lado]) => ({
    nombre,
    cuerpo,
    lado,
    junta: null as RAPIER.ImpulseJoint | null,
    agarrado: null as RAPIER.Collider | null,
    /** El cuerpo agarrado (o el cuerpo fijo propio, si lo agarrado no tiene cuerpo) y el punto, en su marco. */
    otro: null as RAPIER.RigidBody | null,
    ancla: new THREE.Vector3(),
    /** Soltó solo (al terminar de trepar): no vuelve a agarrar hasta que se suelte el botón. */
    esperar: false,
  }));
  let fijo: RAPIER.RigidBody | undefined;
  const esferaMano = new rapier.Ball(mb.mano + AJUSTES.agarre.margen);
  const SIN_GIRO = { x: 0, y: 0, z: 0, w: 1 };
  const MANO = { x: 0, y: -mb.largo / 2, z: 0 };
  const HOMBRO_SOBRE_TORSO = mb.hombroY - mt.y;
  let tocado: RAPIER.Collider | null = null;
  const alTocar = (c: RAPIER.Collider) => {
    tocado = c;
    return false;
  };

  /** Si la mano toca algo (que no sea el mismo muñeco), lo agarra donde está, sin tironear. */
  const agarrar = (brazo: (typeof brazos)[number]) => {
    mano.set(MANO.x, MANO.y, MANO.z).applyQuaternion(q.copy(brazo.cuerpo.rotation())).add(brazo.cuerpo.translation());
    // Mientras el brazo sube todavía no agarra: así no se queda pegado a una pared a la altura de la cadera
    if (mano.y < torso.translation().y + HOMBRO_SOBRE_TORSO - AJUSTES.agarre.bajoElHombro) return;
    tocado = null;
    mundo.intersectionsWithShape(
      mano,
      SIN_GIRO,
      esferaMano,
      alTocar,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      gruposRayo,
    );
    const c = tocado as RAPIER.Collider | null;
    if (!c) return;
    let otro = c.parent();
    if (!otro) {
      fijo ??= mundo.createRigidBody(rapier.RigidBodyDesc.fixed());
      otro = fijo;
    }
    // La mano queda unida a ese punto del otro cuerpo, en su marco local
    mano.sub(otro.translation()).applyQuaternion(q.copy(otro.rotation()).invert());
    brazo.junta = mundo.createImpulseJoint(
      rapier.JointData.spherical(MANO, { x: mano.x, y: mano.y, z: mano.z }),
      brazo.cuerpo,
      otro,
      true,
    );
    brazo.agarrado = c;
    brazo.otro = otro;
    brazo.ancla.copy(mano);
  };

  const soltar = (brazo: (typeof brazos)[number]) => {
    if (brazo.junta) mundo.removeImpulseJoint(brazo.junta, true);
    brazo.junta = null;
    brazo.agarrado = null;
    brazo.otro = null;
  };

  /** Dónde está ahora, en el mundo, el punto que agarra esa mano. */
  const anclaDe = (brazo: (typeof brazos)[number], salida: THREE.Vector3) => {
    if (!brazo.otro) return salida.copy(brazo.cuerpo.translation());
    return salida.copy(brazo.ancla).applyQuaternion(qAncla.copy(brazo.otro.rotation())).add(brazo.otro.translation());
  };

  // Con el compañero (TU-07)
  const propias = new Set(NOMBRES_PARTES.map((n) => partes[n]));
  const vecinos = VECINOS.get(mundo) ?? [];
  VECINOS.set(mundo, vecinos);
  /** El muñeco (otro que este) al que pertenece ese cuerpo. */
  const duenoDe = (c: RAPIER.RigidBody | null) =>
    c ? vecinos.find((v) => v.partes !== propias && v.partes.has(c)) : undefined;

  /** Cuántos kilos le toca sostener a esa mano: lo que pesa lo agarrado repartido entre todas las manos (de los dos
   * muñecos) que lo agarran. Lo quieto no pesa, y al otro muñeco no se lo carga: se lo arrastra. */
  const cargaDe = (brazo: (typeof brazos)[number]) => {
    const o = brazo.otro;
    if (!o?.isDynamic() || duenoDe(o)) return 0;
    let manos = 0;
    for (const v of vecinos) for (const s of v.sujetados()) if (s === o) manos++;
    return o.mass() / Math.max(1, manos);
  };

  /** Cargar (TU-07): sostiene `kilos` de `cuerpo` desde el punto `donde`, con un resorte que lleva ese punto a la
   * altura de la mano alzada. El muñeco carga ese peso en el torso: lo aguanta la suspensión. */
  const sostener = (cuerpo: RAPIER.RigidBody, donde: THREE.Vector3, kilos: number) => {
    const cg = AJUSTES.cargar;
    const objetivo = torso.translation().y + HOMBRO_SOBRE_TORSO + cg.sobreElHombro;
    const vy = cuerpo.velocityAtPoint(donde).y;
    const a = limitar(-GRAVEDAD + cg.frecuencia ** 2 * (objetivo - donde.y) - 2 * cg.frecuencia * vy, 0, 2 * -GRAVEDAD);
    const impulso = kilos * a * PASO * tension;
    cuerpo.applyImpulseAtPoint({ x: 0, y: impulso, z: 0 }, donde, true);
    torso.applyImpulse({ x: 0, y: -impulso, z: 0 }, true);
  };

  /** El compañero que va de la mano: lo tiene agarrado este, o él tiene agarrado a este. */
  const companeroDeLaMano = () => {
    for (const brazo of brazos) {
      const dueno = duenoDe(brazo.otro);
      if (dueno && dueno.estado() !== "caido") return dueno;
    }
    return vecinos.find(
      (v) => v.partes !== propias && v.estado() !== "caido" && v.sujetados().some((s) => s && propias.has(s)),
    );
  };

  /** Si cuelga de la mano del compañero: lo agarra, el compañero está firme y su pelvis queda bien más arriba.
   * Deja en `agarreDeLaMano` el punto por donde lo tiene. */
  const colgadoDelCompanero = () => {
    for (const brazo of brazos) {
      const dueno = duenoDe(brazo.otro);
      if (!dueno || (dueno.estado() !== "de pie" && dueno.estado() !== "trepando")) continue;
      if (dueno.pelvis.translation().y - pelvis.translation().y < AJUSTES.deLaMano.desnivel) continue;
      anclaDe(brazo, agarreDeLaMano);
      return dueno;
    }
    return undefined;
  };

  /** Lanzar (TU-07): lo que suelta esa mano sale hacia adelante y arriba, con un impulso con tope (lo pesado vuela
   * menos). Solo si ninguna otra mano de este muñeco lo sigue agarrando. El muñeco recibe el impulso contrario. */
  const lanzar = (brazo: (typeof brazos)[number]) => {
    const o = brazo.otro;
    if (!o?.isDynamic() || brazos.some((otra) => otra !== brazo && otra.otro === o)) return;
    const la = AJUSTES.lanzar;
    const dueno = duenoDe(o);
    const m = dueno ? dueno.masa : o.mass();
    error.copy(adelante).multiplyScalar(la.adelante).addScaledVector(ARRIBA, la.arriba);
    const impulso = Math.min(m * error.length(), la.impulsoMaximo);
    error.setLength(impulso / m);
    if (dueno) dueno.empujar(error);
    else o.applyImpulse({ x: error.x * m, y: error.y * m, z: error.z * m }, true);
    torso.applyImpulse({ x: -error.x * m, y: -error.y * m, z: -error.z * m }, true);
  };

  /** Si las dos manos agarran algo quieto por encima del torso; deja en `agarre` el punto medio entre las dos. */
  const colgadoDe = () => {
    agarre.set(0, 0, 0);
    for (const brazo of brazos) {
      if (!brazo.otro || brazo.otro.isDynamic()) return false;
      agarre.addScaledVector(anclaDe(brazo, ancla), 0.5);
      if (ancla.y < torso.translation().y) return false;
    }
    return true;
  };

  /** La altura de arriba del borde que agarran las manos: mira desde arriba en dos puntos, uno apenas más adelante
   * del agarre y otro más adentro, y los dos tienen que dar la misma altura. Si no hay nada (una rama fina), arriba
   * sigue la pared (un muro más alto) o es algo suelto, no se puede trepar: `null`. */
  const alturaEn = (adentro: number) => {
    const t = AJUSTES.trepar;
    const o = {
      x: agarre.x + Math.sin(rumbo) * adentro,
      y: agarre.y + t.sobreElAgarre,
      z: agarre.z + Math.cos(rumbo) * adentro,
    };
    rayoBorde.origin = o;
    const g = mundo.castRay(rayoBorde, t.sobreElAgarre + t.bajoElAgarre, true, undefined, gruposRayo);
    if (!g || g.timeOfImpact <= 0 || g.collider.parent()?.isDynamic()) return null;
    return o.y - g.timeOfImpact;
  };
  const buscarBorde = () => {
    const t = AJUSTES.trepar;
    const cerca = alturaEn(t.tanteo[0]);
    const lejos = alturaEn(t.tanteo[1]);
    if (cerca === null || lejos === null || Math.abs(cerca - lejos) > t.desnivel) return null;
    return Math.max(cerca, lejos);
  };

  /** Empuja el tronco con una aceleración (m/s²), repartida según la masa: la pelvis lleva también brazos y piernas. */
  const empujarTronco = (ax: number, ay: number, az: number) => {
    const mTronco = masa - torso.mass() - cabeza.mass();
    for (const [c, m] of [
      [pelvis, mTronco],
      [torso, torso.mass()],
      [cabeza, cabeza.mass()],
    ] as const) {
      c.applyImpulse({ x: ax * m * PASO * tension, y: ay * m * PASO * tension, z: az * m * PASO * tension }, true);
    }
  };

  /** Trepar (TU-06): lleva la pelvis hacia `objetivo` con un resorte que además aguanta el peso. */
  const izarHacia = (objetivo: THREE.Vector3, tope: number = AJUSTES.trepar.aceleracionMaxima) => {
    const t = AJUSTES.trepar;
    const p = pelvis.translation();
    const v = pelvis.linvel();
    const w0 = t.frecuencia;
    const kd = 2 * t.amortiguacion * w0;
    error.set(
      w0 * w0 * (objetivo.x - p.x) - kd * v.x,
      w0 * w0 * (objetivo.y - p.y) - kd * v.y,
      w0 * w0 * (objetivo.z - p.z) - kd * v.z,
    );
    if (error.length() > tope) error.setLength(tope);
    empujarTronco(error.x, error.y - GRAVEDAD, error.z);
  };

  /** Torque PD que gira `cuerpo` hacia `objetivo` (en el mundo). Si hay `padre`, la velocidad es relativa a él y el
   * padre recibe el torque contrario (así el brazo no empuja al muñeco entero). Ganancias de aceleración: se
   * multiplican por la inercia del cuerpo, que Rapier da en el marco del mundo. */
  const girarHacia = (
    c: RAPIER.RigidBody,
    objetivo: THREE.Quaternion,
    frecuencia: number,
    amortiguacion: number,
    padre?: RAPIER.RigidBody,
  ) => {
    errorDeRotacion(q.copy(c.rotation()), objetivo, error);
    w.copy(c.angvel());
    if (padre) w.sub(w2.copy(padre.angvel()));
    const kp = frecuencia * frecuencia * tension;
    const kd = 2 * amortiguacion * frecuencia * tension;
    torque.copy(error).multiplyScalar(kp).addScaledVector(w, -kd);
    porInercia(c.effectiveAngularInertia(), torque).multiplyScalar(PASO);
    c.applyTorqueImpulse(torque, true);
    if (padre) padre.applyTorqueImpulse(torque.negate(), true);
  };

  const inclinacion = () => {
    eje.set(0, 1, 0).applyQuaternion(q.copy(torso.rotation()));
    return Math.acos(limitar(eje.y, -1, 1));
  };

  const pasarA = (nuevo: EstadoMuneco) => {
    estado = nuevo;
    tiempoEnEstado = 0;
    tiempoQuieto = 0;
  };

  /** El rumbo al que se levanta: el del torso enderezado por el camino más corto, así no da vueltas de más. */
  const rumboParaLevantarse = () => {
    q.copy(torso.rotation());
    eje.set(0, 1, 0).applyQuaternion(q);
    qAux.setFromUnitVectors(eje, ARRIBA).multiply(q);
    eje.set(0, 0, 1).applyQuaternion(qAux);
    return Math.atan2(eje.x, eje.z);
  };

  /** Mira cómo quedó el cuerpo y decide el estado; ajusta el tono y la tensión de este paso. */
  const decidir = (entrada: EntradaMuneco) => {
    centroAntes.copy(centro);
    centro.set(0, 0, 0);
    for (const [c, m] of conMasa) {
      const v = c.linvel();
      centro.x += v.x * m;
      centro.y += v.y * m;
      centro.z += v.z * m;
    }
    centro.divideScalar(masa);
    const golpe = centro.distanceTo(centroAntes) > AJUSTES.caer.golpe;
    const torcido = inclinacion() > AJUSTES.caer.inclinacion;
    const apretoSaltar = entrada.saltar === true && !saltarAntes;
    saltarAntes = entrada.saltar === true;

    tiempoEnEstado += PASO;
    tiempoSinSuelo = enElSuelo ? 0 : tiempoSinSuelo + PASO;
    espera = Math.max(0, espera - PASO);
    desdeSalto += PASO;
    const l = AJUSTES.levantarse;
    const t = AJUSTES.trepar;
    /** Ya pasó: la pelvis quedó por encima del borde y bien adentro, no en la orilla. */
    const arribaDelBorde = () => {
      const p = pelvis.translation();
      const adentro = (p.x - trepada.ancla.x) * Math.sin(rumbo) + (p.z - trepada.ancla.z) * Math.cos(rumbo);
      return p.y > trepada.borde + t.arriba && adentro > t.adentro;
    };
    /** Colgado de un borde y apretando hacia adelante: empieza a trepar. */
    const empezarATrepar = () => {
      if (!colgado || entrada.avanzar <= 0) return false;
      const borde = buscarBorde();
      if (borde === null) return false;
      trepada.borde = borde;
      trepada.ancla.copy(agarre);
      trepada.encaramado = false;
      pasarA("trepando");
      return true;
    };

    switch (estado) {
      case "de pie":
        if (golpe || torcido) pasarA("caido");
        else if (apretoSaltar && enElSuelo && espera === 0 && tension > 0.5) {
          const v = AJUSTES.saltar.velocidad;
          for (const [c, m] of conMasa) c.applyImpulse({ x: 0, y: m * v, z: 0 }, true);
          // El salto mismo no cuenta como golpe en el paso siguiente
          centro.y += v;
          desdeSalto = 0;
          pasarA("en el aire");
        } else if (empezarATrepar()) break;
        else if (tiempoSinSuelo > AJUSTES.saltar.sinSuelo) pasarA("en el aire");
        break;
      case "en el aire":
        if (golpe || torcido) pasarA("caido");
        else if (empezarATrepar()) break;
        else if (!colgado && !deLaMano && enElSuelo && centro.y <= 0 && tiempoEnEstado > 0.1) {
          // Tocó el suelo: si venía muy rápido es una caída de lo alto
          if (centro.y < -AJUSTES.caer.aterrizaje) pasarA("caido");
          else {
            pasarA("de pie");
            espera = AJUSTES.saltar.espera;
          }
        }
        break;
      case "trepando":
        // Mientras se iza, soltar una mano o dejar de apretar adelante lo deja colgando (o cayendo)
        if (!trepada.encaramado && (!colgado || entrada.avanzar <= 0)) pasarA("en el aire");
        else if (trepada.encaramado && enElSuelo && arribaDelBorde()) {
          pasarA("de pie");
          espera = AJUSTES.saltar.espera;
        } else if (tiempoEnEstado > t.plazo) pasarA("en el aire");
        break;
      case "caido":
        tiempoQuieto = centro.length() < l.velocidadQuieto ? tiempoQuieto + PASO : 0;
        if (tiempoQuieto >= l.quietud && tono === 0) {
          rumbo = rumboParaLevantarse();
          pasarA("levantandose");
        }
        break;
      case "levantandose":
        if (golpe) pasarA("caido");
        else if (tono === 1 && inclinacion() < l.derecho) pasarA("de pie");
        else if (tiempoEnEstado > l.intento) pasarA("caido");
        break;
    }

    tono = estado === "caido" ? Math.max(0, tono - PASO / AJUSTES.caer.aflojar) : Math.min(1, tono + PASO / l.duracion);
    tension = firmeza * tono;
  };

  const pasar = (entrada: EntradaMuneco) => {
    // El rayo de la suspensión dice si hay suelo; con eso se decide el estado
    const s = AJUSTES.suspension;
    const v = pelvis.linvel();
    const p = pelvis.translation();
    rayo.origin = { x: p.x, y: p.y, z: p.z };
    const golpe = mundo.castRay(
      rayo,
      MEDIDAS.pelvis.y + s.subirAlCaminar + s.alcanceExtra,
      true,
      undefined,
      gruposRayo,
    );
    enElSuelo = golpe !== null;
    colgado = colgadoDe();
    deLaMano = colgadoDelCompanero();
    decidir(entrada);
    const trepando = estado === "trepando";
    if (estado !== "en el aire") deLaMano = undefined;
    /** Colgado en el aire o trepando, el suelo de abajo no lo sostiene: lo sostienen las manos. */
    const deLasManos = trepando || (estado === "en el aire" && (colgado || deLaMano !== undefined));

    // Solo de pie se camina; en el aire todavía se puede girar. Caído o levantándose no manda el jugador.
    const avanzar = estado === "de pie" ? limitar(entrada.avanzar, -1, 1) : 0;
    const girar = estado === "de pie" || estado === "en el aire" ? limitar(entrada.girar, -1, 1) : 0;
    rumbo += girar * AJUSTES.andar.giro * PASO * tension;
    qRumbo.setFromAxisAngle(ARRIBA, rumbo);
    adelante.copy(EJE_Z).applyQuaternion(qRumbo);
    const velocidadAdelante = v.x * adelante.x + v.z * adelante.z;
    const amplitud =
      estado === "de pie"
        ? limitar(Math.abs(velocidadAdelante) / AJUSTES.paso.velocidadPlena + Math.abs(girar) * 0.6, 0, 1)
        : 0;

    // 1. Suspensión (al subir en un salto la fuerza da cero: no empuja hacia abajo, así que no lo frena)
    const altura = MEDIDAS.pelvis.y + s.subirAlCaminar * amplitud;
    if (golpe && golpe.timeOfImpact <= altura + s.alcanceExtra && !deLasManos) {
      const w0 = s.frecuencia;
      const aceleracion = -GRAVEDAD + w0 * w0 * (altura - golpe.timeOfImpact) - 2 * s.amortiguacion * w0 * v.y;
      const empuje = limitar(masa * aceleracion, 0, s.fuerzaMaxima * peso) * tension * PASO;
      pelvis.applyImpulse({ x: 0, y: empuje, z: 0 }, true);
      // Lo que el muñeco pisa recibe su peso (una caja, el otro muñeco)
      const debajo = golpe.collider.parent();
      if (debajo?.isDynamic()) {
        debajo.applyImpulseAtPoint({ x: 0, y: -empuje, z: 0 }, { x: p.x, y: p.y - golpe.timeOfImpact, z: p.z }, true);
      }
    }

    // 2. Erguirse mirando al rumbo; el torso se inclina un poco al caminar
    const e = AJUSTES.erguir;
    girarHacia(pelvis, qRumbo, e.pelvis.frecuencia, e.pelvis.amortiguacion);
    qInclinar.setFromAxisAngle(
      EJE_X,
      trepando
        ? AJUSTES.trepar.inclinar
        : estado === "de pie"
          ? e.inclinacionAlCaminar * limitar(velocidadAdelante / AJUSTES.andar.velocidad, -1, 1)
          : 0,
    );
    girarHacia(torso, qObjetivo.copy(qRumbo).multiply(qInclinar), e.torso.frecuencia, e.torso.amortiguacion);
    girarHacia(cabeza, qRumbo, e.cabeza.frecuencia, e.cabeza.amortiguacion);

    // 3. Andar: fuerza horizontal hacia la velocidad deseada, repartida en el tronco según la masa. Al levantarse
    // la velocidad deseada es cero: lo frena para que se pare en el lugar.
    if (enElSuelo && estado !== "en el aire" && !trepando) {
      const a = AJUSTES.andar;
      const deseada = avanzar * a.velocidad;
      let vx = adelante.x * deseada;
      let vz = adelante.z * deseada;
      // De la mano y sin caminar: se deja llevar a la velocidad del otro
      const guia = avanzar === 0 && girar === 0 && estado === "de pie" ? companeroDeLaMano() : undefined;
      if (guia) {
        const vg = guia.pelvis.linvel();
        vx = vg.x;
        vz = vg.z;
      }
      let ax = a.respuesta * (vx - v.x);
      let az = a.respuesta * (vz - v.z);
      const largo = Math.hypot(ax, az);
      if (largo > a.aceleracionMaxima) {
        ax *= a.aceleracionMaxima / largo;
        az *= a.aceleracionMaxima / largo;
      }
      empujarTronco(ax, 0, az);
    }

    // 3b. Trepar (TU-06): primero se iza colgado de las manos hasta tener los hombros a la altura del agarre; ahí
    // suelta el borde y se encarama: sube por encima y avanza sobre él hasta que el rayo encuentra arriba el suelo.
    if (trepando) {
      const t = AJUSTES.trepar;
      if (!trepada.encaramado) {
        trepada.ancla.copy(agarre);
        mano.copy(agarre).addScaledVector(adelante, -t.izarse.atras);
        mano.y = agarre.y - t.izarse.bajoElAgarre;
        izarHacia(mano);
        if (pelvis.translation().y > agarre.y - t.izarse.soltar) {
          for (const brazo of brazos) {
            soltar(brazo);
            brazo.esperar = true;
          }
          trepada.encaramado = true;
        }
      }
      if (trepada.encaramado) {
        // Mientras no pasa la pelvis por encima del borde, sube pegado a la pared; después avanza sobre él
        const arriba = pelvis.translation().y > trepada.borde + t.encaramarse.pasar;
        mano.copy(trepada.ancla).addScaledVector(adelante, arriba ? t.encaramarse.adelante : -t.encaramarse.atras);
        mano.y = trepada.borde + t.encaramarse.sobreElBorde;
        izarHacia(mano);
      }
    }

    // 3c. Subir de la mano (TU-07): colgado de la mano del compañero, que está bien más arriba, sube hacia ella
    if (deLaMano && estado === "en el aire") {
      const dm = AJUSTES.deLaMano;
      mano.copy(agarreDeLaMano);
      mano.y -= dm.bajoLaMano;
      izarHacia(mano, dm.aceleracionMaxima);
    }

    // 4. Paso: el ciclo avanza con la distancia recorrida (o con el giro, para dar pasitos en el lugar).
    // En el aire encoge las piernas.
    const pa = AJUSTES.paso;
    fase += 2 * Math.PI * PASO * (velocidadAdelante / pa.zancada + Math.abs(girar) * pa.ritmoGiro);
    fase %= 2 * Math.PI;
    const seno = Math.sin(fase);
    const coseno = Math.cos(fase);
    const rigidez = pa.rigidez * tension;
    const amortiguacion = pa.amortiguacionMotor * tension;
    const sa = AJUSTES.saltar;
    if (trepando) {
      // Patalea contra la pared: las piernas van y vienen a su ritmo, al revés una de la otra
      const pt = AJUSTES.trepar.patada;
      trepada.fase = (trepada.fase + 2 * Math.PI * pt.ritmo * PASO) % (2 * Math.PI);
      const ida = Math.sin(trepada.fase);
      caderaIzquierda.configureMotorPosition(pt.cadera * (ida - 0.6), rigidez, amortiguacion);
      caderaDerecha.configureMotorPosition(pt.cadera * (-ida - 0.6), rigidez, amortiguacion);
      rodillaIzquierda.configureMotorPosition(pt.rodilla * (0.5 + 0.5 * ida), rigidez, amortiguacion);
      rodillaDerecha.configureMotorPosition(pt.rodilla * (0.5 - 0.5 * ida), rigidez, amortiguacion);
    } else {
      // En el aire encoge las piernas; colgado de las manos las deja caer, apenas dobladas
      const encoger = estado === "en el aire";
      const cadera = deLasManos ? AJUSTES.trepar.colgado.cadera : sa.cadera;
      const rodilla = deLasManos ? AJUSTES.trepar.colgado.rodilla : sa.rodilla;
      const caderaPaso = pa.cadera * amplitud * seno;
      caderaIzquierda.configureMotorPosition(encoger ? cadera : -caderaPaso, rigidez, amortiguacion);
      caderaDerecha.configureMotorPosition(encoger ? cadera : caderaPaso, rigidez, amortiguacion);
      const rodillaPaso = pa.rodilla * amplitud;
      rodillaIzquierda.configureMotorPosition(
        encoger ? rodilla : rodillaPaso * Math.max(0, coseno),
        rigidez,
        amortiguacion,
      );
      rodillaDerecha.configureMotorPosition(
        encoger ? rodilla : rodillaPaso * Math.max(0, -coseno),
        rigidez,
        amortiguacion,
      );
    }

    // Brazos: con su botón suben hacia adelante y agarran lo que tocan; sueltos, cuelgan algo abiertos y se
    // balancean al revés que la pierna del mismo lado
    const b = AJUSTES.brazos;
    let cargaTotal = 0;
    for (const brazo of brazos) if (entrada[brazo.nombre] === true) cargaTotal += cargaDe(brazo);
    for (const brazo of brazos) {
      const { cuerpo: c, lado } = brazo;
      const pose = entrada.pose?.[brazo.nombre];
      const alzado = entrada[brazo.nombre] === true;
      if (!alzado) brazo.esperar = false;
      if (alzado && trepando && brazo.junta) {
        // Izándose el brazo va suelto: lo tira la rótula del agarre, no hace fuerza contra el torso
      } else if (alzado && !(trepando && trepada.encaramado)) {
        // La mano apunta hacia adelante y arriba: el brazo (su -y) rota hacia +z del rumbo y sube `elevacion`.
        // Colgado apunta más arriba, hacia el agarre, para que el cuerpo quede debajo de las manos.
        const elevacion = deLasManos ? AJUSTES.trepar.colgado.elevacion : b.alzar.elevacion;
        qInclinar.setFromAxisAngle(EJE_X, -(Math.PI / 2 + elevacion));
        qObjetivo.copy(qRumbo).multiply(qInclinar);
        girarHacia(c, qObjetivo, b.alzar.frecuencia, b.alzar.amortiguacion, torso);
        // Cargar: la mano sostiene su parte de lo que agarra, hasta lo que le queda del tope del muñeco
        const kilos = cargaDe(brazo);
        if (kilos > 0 && brazo.otro)
          sostener(brazo.otro, anclaDe(brazo, ancla), kilos * Math.min(1, AJUSTES.cargar.kilos / cargaTotal));
        if (!brazo.junta && !brazo.esperar && estado !== "caido" && !trepando) agarrar(brazo);
      } else if (pose && !alzado) {
        // Con pose (señalar, gestos): el brazo (su -y) va hacia esa dirección, con el PD fuerte de alzar
        if (brazo.junta) soltar(brazo);
        haciaPose.set(lado * pose.afuera, pose.arriba, pose.adelante).normalize();
        qObjetivo.setFromUnitVectors(ABAJO, haciaPose).premultiply(qRumbo);
        girarHacia(c, qObjetivo, b.alzar.frecuencia, b.alzar.amortiguacion, torso);
      } else {
        if (brazo.junta && !alzado) {
          if (estado === "en el aire" && desdeSalto < AJUSTES.lanzar.ventana) lanzar(brazo);
          soltar(brazo);
        }
        qInclinar.setFromAxisAngle(EJE_X, lado * b.balanceo * amplitud * seno);
        qObjetivo
          .setFromAxisAngle(EJE_Z, lado * b.abrir)
          .multiply(qInclinar)
          .premultiply(qAux.copy(torso.rotation()));
        girarHacia(c, qObjetivo, b.frecuencia, b.amortiguacion, torso);
      }
    }
  };

  vecinos.push({
    masa,
    pelvis,
    partes: propias,
    estado: () => estado,
    sujetados: () => brazos.map((b) => b.otro),
    empujar(dv) {
      for (const [c, m] of conMasa) c.applyImpulse({ x: dv.x * m, y: dv.y * m, z: dv.z * m }, true);
    },
    soltarDe(cuerpos) {
      for (const brazo of brazos) if (brazo.otro && cuerpos.has(brazo.otro)) soltar(brazo);
    },
  });

  const reaparecer = (posicion: { x: number; y: number; z: number }, nuevoRumbo: number) => {
    for (const brazo of brazos) {
      soltar(brazo);
      // Si el jugador sigue apretando agarrar, no se prende de lo primero que toque al aparecer
      brazo.esperar = true;
    }
    for (const v of vecinos) if (v.partes !== propias) v.soltarDe(propias);
    const giro = new THREE.Quaternion().setFromAxisAngle(ARRIBA, nuevoRumbo);
    const p = new THREE.Vector3();
    const cero = { x: 0, y: 0, z: 0 };
    for (const [c, local] of poseDePie) {
      p.copy(local).applyQuaternion(giro).add(posicion);
      c.setTranslation(p, true);
      c.setRotation(giro, true);
      c.setLinvel(cero, true);
      c.setAngvel(cero, true);
    }
    rumbo = nuevoRumbo;
    pasarA("de pie");
    tono = 1;
    tension = firmeza;
    fase = 0;
    tiempoSinSuelo = 0;
    espera = 0;
    desdeSalto = Number.POSITIVE_INFINITY;
    deLaMano = undefined;
    colgado = false;
    centro.set(0, 0, 0);
    centroAntes.set(0, 0, 0);
  };

  return {
    partes,
    pasar,
    reaparecer,
    masa,
    get rumbo() {
      return rumbo;
    },
    orientar(nuevo) {
      if (Number.isFinite(nuevo)) rumbo = nuevo;
    },
    get enElSuelo() {
      return enElSuelo;
    },
    get estado() {
      return estado;
    },
    get firmeza() {
      return firmeza;
    },
    set firmeza(valor: number) {
      firmeza = limitar(valor, 0, 1);
      tension = firmeza * tono;
    },
    get tension() {
      return tension;
    },
    agarrado(nombre) {
      return brazos.find((b) => b.nombre === nombre)?.agarrado ?? null;
    },
    get colgado() {
      return colgado;
    },
    inclinacion,
    rumboReal() {
      eje.set(0, 0, 1).applyQuaternion(q.copy(torso.rotation()));
      return Math.atan2(eje.x, eje.z);
    },
  };
}

function limitar(x: number, min: number, max: number) {
  return Math.min(max, Math.max(min, x));
}

/** Rotación que falta para ir de `actual` a `objetivo`, como eje por ángulo en el marco del mundo. */
const diferencia = new THREE.Quaternion();
function errorDeRotacion(actual: THREE.Quaternion, objetivo: THREE.Quaternion, salida: THREE.Vector3) {
  const d = diferencia.copy(objetivo).multiply(actual.invert());
  if (d.w < 0) d.set(-d.x, -d.y, -d.z, -d.w);
  const s = Math.hypot(d.x, d.y, d.z);
  if (s < 1e-9) return salida.set(0, 0, 0);
  const angulo = 2 * Math.atan2(s, d.w);
  return salida.set(d.x, d.y, d.z).multiplyScalar(angulo / s);
}

/** Multiplica el vector por la matriz de inercia (simétrica; Rapier da su triángulo de arriba por filas). */
function porInercia(m: RAPIER.SdpMatrix3, v: THREE.Vector3) {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = m.elements;
  return v.set(a * v.x + b * v.y + c * v.z, b * v.x + d * v.y + e * v.z, c * v.x + e * v.y + f * v.z);
}
