// Lo que comparten los mecanismos de los niveles (TU-13): cosas armadas desde el guion con los sólidos del .glb, sin
// tocar el formato. Cada mecanismo recibe el nivel en juego y los nombres de sus sólidos.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { Muneco } from "../../muneco";
import type { NivelEnJuego } from "../guion";

export const BRAZOS = ["brazoIzquierdo", "brazoDerecho"] as const;

/** El cuerpo del sólido con ese nombre; si no tiene (es fijo), es un error del nivel. */
export function cuerpoDe(nivel: NivelEnJuego, nombre: string): RAPIER.RigidBody {
  const cuerpo = nivel.pieza(nombre).cuerpo;
  if (!cuerpo)
    throw new Error(`el nivel «${nivel.plano.nombre}»: «${nombre}» tiene que moverse (dinámico o cinemático)`);
  return cuerpo;
}

/** Si ese muñeco tiene agarrado ese cuerpo con alguna mano. */
export function agarra(muneco: Muneco, cuerpo: RAPIER.RigidBody): boolean {
  return BRAZOS.some((b) => muneco.agarrado(b)?.parent()?.handle === cuerpo.handle);
}

/** Lleva de 0 a 1 sin golpes al principio ni al final. */
export const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export const cuaternion = (q: RAPIER.Rotation) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
export const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
