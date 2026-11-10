// Rapier (físicas 3D en WebAssembly). La versión `compat` trae el wasm adentro, así que funciona igual en el
// navegador, en las pruebas de Node y en Chromium sin ventana.
import RAPIER from "@dimforge/rapier3d-compat";
import { PASO } from "./bucle";

export type Rapier = typeof RAPIER;
export const GRAVEDAD = -9.81;

let cargado: Promise<Rapier> | undefined;

export function cargarRapier(): Promise<Rapier> {
  cargado ??= RAPIER.init().then(() => RAPIER);
  return cargado;
}

export async function crearMundo(): Promise<{ rapier: Rapier; mundo: RAPIER.World }> {
  const rapier = await cargarRapier();
  const mundo = new rapier.World({ x: 0, y: GRAVEDAD, z: 0 });
  mundo.timestep = PASO;
  return { rapier, mundo };
}
