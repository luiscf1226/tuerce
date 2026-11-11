import type RAPIER from "@dimforge/rapier3d-compat";
import type { VistasPartidas } from "../imagen";
import type { Rapier } from "../motor/fisica";
import type { Juego } from "../ui";
import type { Interfaz } from "../ui/menu";
import { crearEscenaAgarre } from "./agarre";
import { crearEscenaDos } from "./dos";
import { abrirEscenaEnLinea } from "./en-linea";
import { crearEscenaMano } from "./mano";
import { crearEscenaMuneco } from "./muneco";
import { crearEscenaNivel } from "./nivel";
import { crearEscenaPinar } from "./pinar";
import { crearEscenaPrueba } from "./prueba";
import { crearEscenaRopero } from "./ropero";
import type { Escena } from "./tipos";

/** Lo que una escena puede sumar a `Escena`: la pantalla partida de la cámara de los dos (TU-09), y el menú y la
 * pausa (TU-15): `main.ts` llama a `interfaz.cuadro()` en cada cuadro y no avanza las físicas si `juego.corren` es
 * falso. */
export type EscenaDeJuego = Escena & {
  readonly vistas?: VistasPartidas;
  readonly juego?: Juego;
  readonly interfaz?: Interfaz;
};

// Cada escena se abre con `?escena=<nombre>`. Las capturas automáticas recorren esta lista. Las que bajan algo antes
// de armarse (los niveles, que bajan su .glb) devuelven una promesa.
export const ESCENAS: Record<string, (rapier: Rapier, mundo: RAPIER.World) => EscenaDeJuego | Promise<EscenaDeJuego>> =
  {
    prueba: crearEscenaPrueba,
    muneco: crearEscenaMuneco,
    pinar: crearEscenaPinar,
    agarre: crearEscenaAgarre,
    dos: crearEscenaDos,
    mano: crearEscenaMano,
    // En línea (TU-21, TU-22): un nivel con el otro jugador en su casa; guarda y retoma el avance de la pareja.
    "en-linea": abrirEscenaEnLinea,
    // Un nivel con el formato nuevo (TU-11): escena glTF, guion y puntos de control. `&nivel=prueba` por ahora.
    nivel: crearEscenaNivel,
    // El ropero (TU-29): los dos muñecos con sus prendas y el panel para elegir; `&vitrina=1|2` las muestra todas.
    ropero: crearEscenaRopero,
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
