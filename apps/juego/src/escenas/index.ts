import type RAPIER from "@dimforge/rapier3d-compat";
import type { VistasPartidas } from "../imagen";
import type { Rapier } from "../motor/fisica";
import { crearEscenaAgarre } from "./agarre";
import { crearEscenaDos } from "./dos";
import { crearEscenaMuneco } from "./muneco";
import { crearEscenaPinar } from "./pinar";
import { crearEscenaPrueba } from "./prueba";
import type { Escena } from "./tipos";

/** Lo que una escena puede sumar a `Escena`: la pantalla partida de la cámara de los dos (TU-09). */
export type EscenaDeJuego = Escena & {
  readonly vistas?: VistasPartidas;
};

// Cada escena se abre con `?escena=<nombre>`. Las capturas automáticas recorren esta lista.
export const ESCENAS: Record<string, (rapier: Rapier, mundo: RAPIER.World) => EscenaDeJuego> = {
  prueba: crearEscenaPrueba,
  muneco: crearEscenaMuneco,
  pinar: crearEscenaPinar,
  agarre: crearEscenaAgarre,
  dos: crearEscenaDos,
};
export const ESCENA_INICIAL = "dos";

// Pantallas de la cuenta y de depuración: no son escenas de físicas y se cargan aparte, para no meter Clerk ni Convex en el juego.
export const PANTALLAS: Record<string, () => Promise<void>> = {
  entrar: async () => (await import("../cuenta/entrar")).abrirEntrar(),
  invitar: async () => (await import("../cuenta/invitar")).abrirInvitar(),
  buscar: async () => (await import("../cuenta/buscar")).abrirBuscar(),
  // Depuración de la red (TU-20): estado de la conexión y ping entre los dos.
  red: async () => (await import("./red")).abrirRed(),
};
