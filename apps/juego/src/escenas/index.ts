import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../motor/fisica";
import { crearEscenaMuneco } from "./muneco";
import { crearEscenaPinar } from "./pinar";
import { crearEscenaPrueba } from "./prueba";
import type { Escena } from "./tipos";

// Cada escena se abre con `?escena=<nombre>`. Las capturas automáticas recorren esta lista.
export const ESCENAS: Record<string, (rapier: Rapier, mundo: RAPIER.World) => Escena> = {
  prueba: crearEscenaPrueba,
  muneco: crearEscenaMuneco,
  pinar: crearEscenaPinar,
};
export const ESCENA_INICIAL = "pinar";

// Pantallas de la cuenta y de depuración: no son escenas de físicas y se cargan aparte, para no meter Clerk ni Convex en el juego.
export const PANTALLAS: Record<string, () => Promise<void>> = {
  entrar: async () => (await import("../cuenta/entrar")).abrirEntrar(),
  invitar: async () => (await import("../cuenta/invitar")).abrirInvitar(),
  // Depuración de la red (TU-20): estado de la conexión y ping entre los dos.
  red: async () => (await import("./red")).abrirRed(),
};
