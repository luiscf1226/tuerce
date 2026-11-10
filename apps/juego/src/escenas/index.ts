import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../motor/fisica";
import { crearEscenaAgarre } from "./agarre";
import { crearEscenaMuneco } from "./muneco";
import { crearEscenaPinar } from "./pinar";
import { crearEscenaPrueba } from "./prueba";
import type { Escena } from "./tipos";

// Cada escena se abre con `?escena=<nombre>`. Las capturas automáticas recorren esta lista.
export const ESCENAS: Record<string, (rapier: Rapier, mundo: RAPIER.World) => Escena> = {
  prueba: crearEscenaPrueba,
  muneco: crearEscenaMuneco,
  pinar: crearEscenaPinar,
  agarre: crearEscenaAgarre,
};
export const ESCENA_INICIAL = "pinar";

// Pantallas de la cuenta: no son escenas de físicas y se cargan aparte, para no meter Clerk ni Convex en el juego.
export const PANTALLAS: Record<string, () => Promise<void>> = {
  entrar: async () => (await import("../cuenta/entrar")).abrirEntrar(),
  invitar: async () => (await import("../cuenta/invitar")).abrirInvitar(),
  buscar: async () => (await import("../cuenta/buscar")).abrirBuscar(),
};
