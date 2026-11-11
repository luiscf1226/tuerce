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

/** En qué anda el muñeco: parado (o caminando), en el aire, tirado como un trapo o levantándose. */
export type EstadoMuneco = "de pie" | "en el aire" | "caido" | "levantandose";

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
  /** Ángulo entre el eje del torso y la vertical, en radianes. */
  inclinacion(): number;
  /** Hacia dónde mira de verdad el torso, en radianes alrededor de +y. */
  rumboReal(): number;
}

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
  }));
  let fijo: RAPIER.RigidBody | undefined;
  const esferaMano = new rapier.Ball(mb.mano + AJUSTES.agarre.margen);
  const SIN_GIRO = { x: 0, y: 0, z: 0, w: 1 };
  const MANO = { x: 0, y: -mb.largo / 2, z: 0 };
  let tocado: RAPIER.Collider | null = null;
  const alTocar = (c: RAPIER.Collider) => {
    tocado = c;
    return false;
  };

  /** Si la mano toca algo (que no sea el mismo muñeco), lo agarra donde está, sin tironear. */
  const agarrar = (brazo: (typeof brazos)[number]) => {
    mano.set(MANO.x, MANO.y, MANO.z).applyQuaternion(q.copy(brazo.cuerpo.rotation())).add(brazo.cuerpo.translation());
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
  };

  const soltar = (brazo: (typeof brazos)[number]) => {
    if (brazo.junta) mundo.removeImpulseJoint(brazo.junta, true);
    brazo.junta = null;
    brazo.agarrado = null;
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
    const l = AJUSTES.levantarse;

    switch (estado) {
      case "de pie":
        if (golpe || torcido) pasarA("caido");
        else if (apretoSaltar && enElSuelo && espera === 0 && tension > 0.5) {
          const v = AJUSTES.saltar.velocidad;
          for (const [c, m] of conMasa) c.applyImpulse({ x: 0, y: m * v, z: 0 }, true);
          // El salto mismo no cuenta como golpe en el paso siguiente
          centro.y += v;
          pasarA("en el aire");
        } else if (tiempoSinSuelo > AJUSTES.saltar.sinSuelo) pasarA("en el aire");
        break;
      case "en el aire":
        if (golpe || torcido) pasarA("caido");
        else if (enElSuelo && centro.y <= 0 && tiempoEnEstado > 0.1) {
          // Tocó el suelo: si venía muy rápido es una caída de lo alto
          if (centro.y < -AJUSTES.caer.aterrizaje) pasarA("caido");
          else {
            pasarA("de pie");
            espera = AJUSTES.saltar.espera;
          }
        }
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
    decidir(entrada);

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
    if (golpe && golpe.timeOfImpact <= altura + s.alcanceExtra) {
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
      estado === "de pie" ? e.inclinacionAlCaminar * limitar(velocidadAdelante / AJUSTES.andar.velocidad, -1, 1) : 0,
    );
    girarHacia(torso, qObjetivo.copy(qRumbo).multiply(qInclinar), e.torso.frecuencia, e.torso.amortiguacion);
    girarHacia(cabeza, qRumbo, e.cabeza.frecuencia, e.cabeza.amortiguacion);

    // 3. Andar: fuerza horizontal hacia la velocidad deseada, repartida en el tronco según la masa. Al levantarse
    // la velocidad deseada es cero: lo frena para que se pare en el lugar.
    if (enElSuelo && estado !== "en el aire") {
      const a = AJUSTES.andar;
      const deseada = avanzar * a.velocidad;
      let ax = a.respuesta * (adelante.x * deseada - v.x);
      let az = a.respuesta * (adelante.z * deseada - v.z);
      const largo = Math.hypot(ax, az);
      if (largo > a.aceleracionMaxima) {
        ax *= a.aceleracionMaxima / largo;
        az *= a.aceleracionMaxima / largo;
      }
      const mTronco = masa - torso.mass() - cabeza.mass();
      for (const [c, m] of [
        [pelvis, mTronco],
        [torso, torso.mass()],
        [cabeza, cabeza.mass()],
      ] as const) {
        c.applyImpulse({ x: ax * m * PASO * tension, y: 0, z: az * m * PASO * tension }, true);
      }
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
    const encoger = estado === "en el aire";
    const sa = AJUSTES.saltar;
    const caderaPaso = pa.cadera * amplitud * seno;
    caderaIzquierda.configureMotorPosition(encoger ? sa.cadera : -caderaPaso, rigidez, amortiguacion);
    caderaDerecha.configureMotorPosition(encoger ? sa.cadera : caderaPaso, rigidez, amortiguacion);
    const rodillaPaso = pa.rodilla * amplitud;
    rodillaIzquierda.configureMotorPosition(
      encoger ? sa.rodilla : rodillaPaso * Math.max(0, coseno),
      rigidez,
      amortiguacion,
    );
    rodillaDerecha.configureMotorPosition(
      encoger ? sa.rodilla : rodillaPaso * Math.max(0, -coseno),
      rigidez,
      amortiguacion,
    );

    // Brazos: con su botón suben hacia adelante y agarran lo que tocan; sueltos, cuelgan algo abiertos y se
    // balancean al revés que la pierna del mismo lado
    const b = AJUSTES.brazos;
    for (const brazo of brazos) {
      const { cuerpo: c, lado } = brazo;
      const pose = entrada.pose?.[brazo.nombre];
      if (entrada[brazo.nombre] === true) {
        // La mano apunta hacia adelante y arriba: el brazo (su -y) rota hacia +z del rumbo y sube `elevacion`
        qInclinar.setFromAxisAngle(EJE_X, -(Math.PI / 2 + b.alzar.elevacion));
        qObjetivo.copy(qRumbo).multiply(qInclinar);
        girarHacia(c, qObjetivo, b.alzar.frecuencia, b.alzar.amortiguacion, torso);
        if (!brazo.junta && estado !== "caido") agarrar(brazo);
      } else if (pose) {
        // Con pose (señalar, gestos): el brazo (su -y) va hacia esa dirección, con el PD fuerte de alzar
        if (brazo.junta) soltar(brazo);
        haciaPose.set(lado * pose.afuera, pose.arriba, pose.adelante).normalize();
        qObjetivo.setFromUnitVectors(ABAJO, haciaPose).premultiply(qRumbo);
        girarHacia(c, qObjetivo, b.alzar.frecuencia, b.alzar.amortiguacion, torso);
      } else {
        if (brazo.junta) soltar(brazo);
        qInclinar.setFromAxisAngle(EJE_X, lado * b.balanceo * amplitud * seno);
        qObjetivo
          .setFromAxisAngle(EJE_Z, lado * b.abrir)
          .multiply(qInclinar)
          .premultiply(qAux.copy(torso.rotation()));
        girarHacia(c, qObjetivo, b.frecuencia, b.amortiguacion, torso);
      }
    }
  };

  return {
    partes,
    pasar,
    masa,
    get rumbo() {
      return rumbo;
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
