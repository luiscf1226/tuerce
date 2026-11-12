// El portón con aldaba (TU-13): una hoja dinámica del .glb con una bisagra vertical que pone este mecanismo, y una
// palanca (la aldaba) que la destraba. Mientras la hoja está cerrada y nadie sostiene la aldaba, la bisagra no gira:
// uno tiene que sostener la aldaba y el otro empujar. Abierta del todo una vez, ya no se vuelve a trabar.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { NivelEnJuego } from "../guion";
import { cuaternion, cuerpoDe, vector } from "./comun";

export const AJUSTES_PORTON = {
  /** Cerrada: la bisagra gira apenas esto hacia cada lado (radianes). */
  juego: 0.01,
  /** Se traba solo si está cerrada: menos que esto (radianes). */
  cerrada: 0.04,
  /** Abierta más que esto, queda abierta para siempre (radianes). Menos de lo que hace falta para pasar (~0.4):
   * si no, el primero pasa por la rendija, la hoja se cierra detrás y se vuelve a trabar con uno de cada lado. */
  abierta: 0.3,
  /** Rozamiento en la bisagra, para que la hoja pese (N·m·s/rad). */
  rozamiento: 12,
} as const;

export interface OpcionesPorton {
  /** El sólido dinámico de la hoja. */
  readonly hoja: string;
  /** La palanca que la destraba mientras está activa. */
  readonly aldaba: string;
  /** Dónde va la bisagra, en el mundo; gira alrededor de la vertical. */
  readonly bisagra: THREE.Vector3Like;
  /** Hasta dónde abre (radianes alrededor de +y: positivo lleva el +z de la hoja hacia +x). */
  readonly abre: number;
}

export interface Porton {
  readonly hoja: RAPIER.RigidBody;
  /** Cuánto se abrió, en radianes desde cerrada (con el signo de `abre`). */
  readonly angulo: number;
  /** Si la bisagra está trabada ahora. */
  readonly trabado: boolean;
  /** Si ya se abrió del todo una vez. */
  readonly abierto: boolean;
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
  /** La deja abierta de una vez (al retomar un avance más allá del portón). */
  abrir(): void;
}

export function crearPorton(nivel: NivelEnJuego, op: OpcionesPorton): Porton {
  const { rapier, mundo } = nivel;
  const a = AJUSTES_PORTON;
  const hoja = cuerpoDe(nivel, op.hoja);
  const aldaba = nivel.palanca(op.aldaba);
  const bisagra = new THREE.Vector3().copy(op.bisagra);
  const centro0 = new THREE.Vector3().copy(hoja.translation());
  const giro0 = cuaternion(hoja.rotation());
  // La bisagra, en el marco de la hoja, y su eje (la vertical del mundo)
  const inversa = giro0.clone().invert();
  const enLaHoja = bisagra.clone().sub(centro0).applyQuaternion(inversa);
  const eje = new THREE.Vector3(0, 1, 0).applyQuaternion(inversa);
  const ancla = mundo.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(bisagra.x, bisagra.y, bisagra.z));
  const datos = rapier.JointData.revolute({ x: 0, y: 0, z: 0 }, vector(enLaHoja), { x: 0, y: 1, z: 0 });
  // El eje de la hoja tiene que ser el mismo que el del ancla: con la hoja derecha, la vertical
  if (Math.abs(eje.y) < 0.999) throw new Error(`«${op.hoja}»: la hoja del portón tiene que estar derecha`);
  const junta = mundo.createImpulseJoint(datos, ancla, hoja, true);
  junta.setContactsEnabled(false);
  const bisagraDe = junta instanceof rapier.RevoluteImpulseJoint ? junta : null;
  if (!bisagraDe) throw new Error(`«${op.hoja}»: no se pudo armar la bisagra`);
  // Los topes se ponen después de crear la junta: los de `JointData` no le llegan
  bisagraDe.setLimits(-a.juego, a.juego);
  bisagraDe.configureMotorModel(rapier.MotorModel.ForceBased);
  bisagraDe.configureMotorVelocity(0, a.rozamiento);

  const [min, max] = op.abre >= 0 ? [-a.juego, op.abre] : [op.abre, a.juego];
  let trabado = true;
  let abierto = false;

  /** Cuánto giró la hoja alrededor de la vertical desde cerrada. */
  const angulo = () => {
    const r = giro0.clone().invert().multiply(cuaternion(hoja.rotation()));
    return 2 * Math.atan2(r.w < 0 ? -r.y : r.y, Math.abs(r.w));
  };
  const trabar = (si: boolean) => {
    if (si === trabado) return;
    trabado = si;
    if (si) bisagraDe.setLimits(-a.juego, a.juego);
    else bisagraDe.setLimits(min, max);
    hoja.wakeUp();
  };

  return {
    hoja,
    get angulo() {
      return angulo();
    },
    get trabado() {
      return trabado;
    },
    get abierto() {
      return abierto;
    },
    pasar() {
      const giro = angulo();
      if (Math.abs(giro) > a.abierta) abierto = true;
      // Se traba cerrada y sin nadie en la aldaba; si está entreabierta, espera a que se cierre
      trabar(!abierto && !aldaba.activa && Math.abs(giro) < a.cerrada);
    },
    abrir() {
      abierto = true;
      trabar(false);
      const giro = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), op.abre * 0.9);
      const centro = centro0.clone().sub(bisagra).applyQuaternion(giro).add(bisagra);
      hoja.setTranslation(vector(centro), true);
      hoja.setRotation(giro.multiply(giro0), true);
      hoja.setLinvel({ x: 0, y: 0, z: 0 }, true);
      hoja.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
  };
}
