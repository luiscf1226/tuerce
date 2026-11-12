// La escalera para cargar entre dos (TU-13): un sólido dinámico del .glb, largo a lo largo de su x. Es pesada para
// uno solo (cada muñeco levanta 5 kg: ver AJUSTES.cargar del muñeco), así que la levantan los dos, uno de cada lado.
// Entre los dos la llevan derecha: mientras la agarran los dos, un torque la mantiene horizontal (cada mano solo
// sostiene peso, y con las manos a un lado del centro se iría de punta). Cuando llega cargada por los dos al pie de una pared, apuntando hacia ella, se apoya sola contra la pared: queda
// quieta, como una rampa del suelo hasta arriba de la pared. Mientras se apoya se la mueve como cinemática; apoyada
// queda dinámica pero trabada del todo: así el rayo de la cámara (que no mira lo dinámico) no la toma por una pared. Si en algún momento después de levantarla toca el suelo
// con una punta, se botó (el logro del patio es no botarla). Tirada en el suelo no se alcanza con las manos: si queda
// ahí un rato sin nadie, vuelve sola a donde empezó.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PASO } from "../../motor/bucle";
import { adentro, type Volumen } from "../formato";
import type { NivelEnJuego } from "../guion";
import { agarra, cuaternion, cuerpoDe, suave, vector } from "./comun";

export const AJUSTES_ESCALERA = {
  /** Cargada: el centro más alto que esto sobre el suelo, con los dos agarrándola (m). */
  cargada: 1.05,
  /** Se botó: una punta a menos de esto del suelo (m). */
  botada: 0.12,
  /** Para apoyarla, las dos puntas tienen que ir más alto que esto (m) y apuntar hacia la pared (radianes). */
  enAlto: 0.4,
  apuntar: 0.6,
  /** Cuánto tarda en apoyarse (s). */
  apoyarse: 0.7,
  /** Tirada: el centro a menos de esto del suelo (m), sin nadie, durante este tiempo (s), vuelve a donde empezó. */
  tirada: { alto: 0.3, tiempo: 2 },
  /** Llevarla derecha entre los dos: frecuencia (rad/s) y amortiguación (1 = crítica) del torque que la nivela. */
  nivelar: { frecuencia: 7, amortiguacion: 0.9 },
} as const;

export interface OpcionesEscalera {
  /** El sólido dinámico de la escalera. */
  readonly nombre: string;
  /** Dónde tiene que estar su centro para apoyarse, al pie de la pared: una caja derecha, de una esquina a la otra. */
  readonly pie: { readonly desde: THREE.Vector3Like; readonly hasta: THREE.Vector3Like };
  /** La pared: su cara (x), lo alto de arriba (y) y la altura del suelo donde apoya la punta de abajo. La escalera
   * sube hacia +x. */
  readonly pared: { readonly x: number; readonly arriba: number; readonly suelo: number };
  /** Entre qué z puede quedar apoyada (lo ancho de la pared). */
  readonly z: readonly [number, number];
}

export interface Escalera {
  readonly cuerpo: RAPIER.RigidBody;
  /** Si la levantaron entre los dos alguna vez. */
  readonly cargada: boolean;
  /** Si tocó el suelo con una punta después de levantarla. */
  readonly botada: boolean;
  /** Si ya está apoyada contra la pared (o apoyándose). */
  readonly apoyada: boolean;
  /** Cuántos muñecos la tienen agarrada. */
  readonly agarrada: number;
  /** Lo bajo de sus dos puntas (m). */
  readonly puntaMasBaja: number;
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
  /** La apoya en la pared; con `ya`, de una vez (al retomar un avance). */
  apoyar(ya?: boolean): void;
}

export function crearEscalera(nivel: NivelEnJuego, op: OpcionesEscalera): Escalera {
  const a = AJUSTES_ESCALERA;
  const cuerpo = cuerpoDe(nivel, op.nombre);
  const forma = nivel.pieza(op.nombre).colisionador.shape;
  if (!(forma instanceof nivel.rapier.Cuboid)) throw new Error(`«${op.nombre}»: la escalera tiene que ser una caja`);
  const medio = forma.halfExtents;
  const desde = new THREE.Vector3().copy(op.pie.desde);
  const hasta = new THREE.Vector3().copy(op.pie.hasta);
  const pie: Volumen = {
    centro: desde.clone().add(hasta).multiplyScalar(0.5),
    medio: hasta.clone().sub(desde).multiplyScalar(0.5),
    giro: new THREE.Quaternion(),
  };
  const inicio = { p: vector(cuerpo.translation()), q: cuaternion(cuerpo.rotation()) };
  const largo = new THREE.Vector3();

  let cargada = false;
  let botada = false;
  let apoyada = false;
  let agarrada = 0;
  /** Cuántos pasos lleva tirada en el suelo sin nadie. */
  let tirada = 0;
  /** Al apoyarse: desde dónde, hacia dónde y cuántos pasos lleva. */
  let viaje: { p0: THREE.Vector3; q0: THREE.Quaternion; p1: THREE.Vector3; q1: THREE.Quaternion; paso: number } | null =
    null;

  /** El largo de la escalera en el mundo (medio largo, de su centro a una punta). */
  const medioLargo = () => largo.set(medio.x, 0, 0).applyQuaternion(cuaternion(cuerpo.rotation()));
  const puntaMasBaja = () => {
    const c = cuerpo.translation();
    const l = medioLargo();
    return Math.min(c.y - l.y, c.y + l.y) - op.pared.suelo - medio.y;
  };

  /** Dónde queda apoyada: la punta de arriba, por su cara de arriba, en el borde de la pared; la de abajo, en el
   * suelo. */
  const apoyo = () => {
    // El ángulo que deja la punta de abajo en el suelo: alto = largo·sen θ + grueso·cos θ (se resuelve a mano)
    const alto = op.pared.arriba - op.pared.suelo;
    let angulo = Math.asin(Math.min(1, alto / (2 * medio.x)));
    for (let i = 0; i < 6; i++) {
      const f = 2 * medio.x * Math.sin(angulo) + 2 * medio.y * Math.cos(angulo) - alto;
      const df = 2 * medio.x * Math.cos(angulo) - 2 * medio.y * Math.sin(angulo);
      angulo -= f / df;
    }
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angulo);
    const d = new THREE.Vector3(Math.cos(angulo), Math.sin(angulo), 0);
    const n = new THREE.Vector3(-Math.sin(angulo), Math.cos(angulo), 0);
    const z = Math.min(op.z[1], Math.max(op.z[0], cuerpo.translation().z));
    const arriba = new THREE.Vector3(op.pared.x, op.pared.arriba, z);
    const centro = arriba.addScaledVector(d, -medio.x).addScaledVector(n, -medio.y);
    return { p: centro, q };
  };

  /** Ya contra la pared: dinámica, quieta y trabada. */
  const trabar = (p: THREE.Vector3, q: THREE.Quaternion) => {
    cuerpo.setBodyType(nivel.rapier.RigidBodyType.Dynamic, true);
    cuerpo.setTranslation(vector(p), true);
    cuerpo.setRotation(q, true);
    cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
    cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
    cuerpo.lockTranslations(true, true);
    cuerpo.lockRotations(true, true);
  };

  const apoyar = (ya = false) => {
    if (apoyada && !ya) return;
    apoyada = true;
    const destino = apoyo();
    if (ya) {
      viaje = null;
      trabar(destino.p, destino.q);
      return;
    }
    cuerpo.setBodyType(nivel.rapier.RigidBodyType.KinematicPositionBased, true);
    viaje = {
      p0: new THREE.Vector3().copy(cuerpo.translation()),
      q0: cuaternion(cuerpo.rotation()),
      p1: destino.p,
      q1: destino.q,
      paso: 0,
    };
  };

  /** Un torque que lleva su largo a la horizontal, sin tocar hacia dónde apunta. */
  const nivelar = () => {
    const { frecuencia: w, amortiguacion: z } = a.nivelar;
    const l = medioLargo().normalize();
    const horizontal = new THREE.Vector3(l.x, 0, l.z);
    if (horizontal.lengthSq() < 1e-6) return;
    const eje = new THREE.Vector3().crossVectors(l, horizontal.normalize());
    const angulo = Math.asin(Math.min(1, eje.length()));
    if (angulo < 1e-4) return;
    eje.normalize();
    const inercia = (cuerpo.mass() * (2 * medio.x) ** 2) / 12;
    const giro = cuerpo.angvel();
    const vel = giro.x * eje.x + giro.y * eje.y + giro.z * eje.z;
    const torque = inercia * (w * w * angulo - 2 * z * w * vel) * PASO;
    cuerpo.applyTorqueImpulse({ x: eje.x * torque, y: eje.y * torque, z: eje.z * torque }, true);
  };

  const volver = () => {
    cuerpo.setTranslation(inicio.p, true);
    cuerpo.setRotation(inicio.q, true);
    cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
    cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  return {
    cuerpo,
    get cargada() {
      return cargada;
    },
    get botada() {
      return botada;
    },
    get apoyada() {
      return apoyada;
    },
    get agarrada() {
      return agarrada;
    },
    get puntaMasBaja() {
      return puntaMasBaja();
    },
    apoyar,
    pasar() {
      agarrada = nivel.munecos.filter((m) => agarra(m, cuerpo)).length;
      if (viaje) {
        // Apoyándose: de donde la traían hasta la pared, sin golpes
        viaje.paso++;
        const t = suave((viaje.paso * PASO) / a.apoyarse);
        cuerpo.setNextKinematicTranslation(vector(viaje.p0.clone().lerp(viaje.p1, t)));
        cuerpo.setNextKinematicRotation(viaje.q0.clone().slerp(viaje.q1, t));
        if (t >= 1) {
          trabar(viaje.p1, viaje.q1);
          viaje = null;
        }
        return;
      }
      if (apoyada) return;
      const c = cuerpo.translation();
      // Si se cayó del solar, vuelve a los barriles (y cuenta como botada)
      if (c.y < nivel.plano.vacio) {
        botada ||= cargada;
        volver();
        return;
      }
      if (agarrada === 2) nivelar();
      tirada = agarrada === 0 && c.y - op.pared.suelo < a.tirada.alto ? tirada + 1 : 0;
      if (tirada * PASO >= a.tirada.tiempo) {
        tirada = 0;
        volver();
        return;
      }
      const baja = puntaMasBaja();
      if (cargada && baja < a.botada) botada = true;
      if (agarrada === 2 && c.y - op.pared.suelo > a.cargada) cargada = true;
      // Llegó cargada por los dos al pie de la pared, apuntando hacia ella: se apoya
      const l = medioLargo();
      const rumbo = Math.abs(Math.atan2(l.z, Math.abs(l.x)));
      if (agarrada === 2 && baja > a.enAlto && rumbo < a.apuntar && adentro(pie, c)) apoyar();
    },
  };
}
