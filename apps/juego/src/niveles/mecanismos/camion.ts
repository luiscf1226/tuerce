// El camión que arranca (TU-13): un sólido cinemático del .glb que, una vez arrancado, maniobra de atrás para
// adelante a lo largo de un eje (como para salir de una calle angosta), y frena cuando se lo piden. Puede llevar
// consigo un punto de control: su zona y sus lugares viajan con él (la meta del patio va sobre la palangana).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PASO } from "../../motor/bucle";
import type { NivelEnJuego } from "../guion";
import { cuerpoDe, vector } from "./comun";

export const AJUSTES_CAMION = {
  /** Cuánto tarda en arrancar y en frenar del todo (s). */
  arrancar: 1,
  frenar: 0.5,
} as const;

export interface OpcionesCamion {
  /** El sólido cinemático del camión. */
  readonly nombre: string;
  /** Hacia dónde maniobra (en el piso; no hace falta que mida 1). */
  readonly eje: { readonly x: number; readonly z: number };
  /** Hasta dónde va hacia cada lado de donde empezó (m) y cuánto tarda en ir y volver (s). */
  readonly amplitud: number;
  readonly periodo: number;
  /** El punto de control que lleva encima. */
  readonly punto?: number;
}

export interface Camion {
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto se corrió de donde empezó (m, a lo largo del eje). */
  readonly corrido: number;
  /** De 0 (quieto) a 1 (maniobrando). */
  readonly marcha: number;
  arrancar(): void;
  /** Frena; con `ya`, de una vez. */
  frenar(ya?: boolean): void;
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
}

export function crearCamion(nivel: NivelEnJuego, op: OpcionesCamion): Camion {
  const a = AJUSTES_CAMION;
  const cuerpo = cuerpoDe(nivel, op.nombre);
  const inicio = new THREE.Vector3().copy(cuerpo.translation());
  const eje = new THREE.Vector3(op.eje.x, 0, op.eje.z).normalize();
  const omega = (2 * Math.PI) / op.periodo;
  // El punto de control que viaja con el camión: dónde estaban su zona y sus lugares al empezar
  const punto = op.punto === undefined ? undefined : nivel.plano.puntos[op.punto];
  if (op.punto !== undefined && !punto?.zona) throw new Error(`el camión no puede llevar el punto ${op.punto}`);
  const desde = punto
    ? { zona: punto.zona?.centro.clone(), lugares: punto.lugares.map((l) => l.posicion.clone()) }
    : undefined;

  let fase = 0;
  let marcha = 0;
  let objetivo = 0;
  const donde = new THREE.Vector3();

  const corrido = () => op.amplitud * Math.sin(fase);
  const mover = () => {
    donde.copy(inicio).addScaledVector(eje, corrido());
    cuerpo.setNextKinematicTranslation(vector(donde));
    if (punto && desde) {
      const corrimiento = donde.clone().sub(inicio);
      if (desde.zona) punto.zona?.centro.copy(desde.zona).add(corrimiento);
      punto.lugares.forEach((l, i) => {
        const de = desde.lugares[i];
        if (de) l.posicion.copy(de).add(corrimiento);
      });
    }
  };

  return {
    cuerpo,
    get corrido() {
      return corrido();
    },
    get marcha() {
      return marcha;
    },
    arrancar() {
      objetivo = 1;
    },
    frenar(ya = false) {
      objetivo = 0;
      if (ya) marcha = 0;
    },
    pasar() {
      const cambio = PASO / (objetivo > marcha ? a.arrancar : a.frenar);
      marcha = objetivo > marcha ? Math.min(objetivo, marcha + cambio) : Math.max(objetivo, marcha - cambio);
      fase += omega * marcha * PASO;
      mover();
    },
  };
}
