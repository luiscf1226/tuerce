import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../motor/fisica";
import { crearEscenaMuneco } from "./muneco";
import { crearEscenaPrueba } from "./prueba";
import type { Escena } from "./tipos";

// Cada escena se abre con `?escena=<nombre>`. Las capturas automáticas recorren esta lista.
export const ESCENAS: Record<string, (rapier: Rapier, mundo: RAPIER.World) => Escena> = {
  prueba: crearEscenaPrueba,
  muneco: crearEscenaMuneco,
};
export const ESCENA_INICIAL = "prueba";
