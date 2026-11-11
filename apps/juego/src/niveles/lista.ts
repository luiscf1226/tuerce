// Los niveles del juego: cada uno es una carpeta de niveles/ con su escena (.glb) y su guion. Se abren con
// `?escena=nivel&nivel=<nombre>`.
import escenaPiezas from "../../../../niveles/98-piezas/escena.glb?url";
import { crearGuion as guionPiezas } from "../../../../niveles/98-piezas/guion";
import escenaPrueba from "../../../../niveles/99-prueba/escena.glb?url";
import { crearGuion as guionPrueba } from "../../../../niveles/99-prueba/guion";
import type { GuionDeNivel } from "./guion";

export interface DatosDeNivel {
  /** La carpeta en niveles/ (las pruebas leen el .glb de ahí). */
  readonly carpeta: string;
  /** La dirección del .glb, que arma Vite. */
  readonly escena: string;
  /** Un guion nuevo para cada partida (guarda su propio estado). */
  readonly crearGuion: () => GuionDeNivel;
}

export const NIVELES: Record<string, DatosDeNivel> = {
  prueba: { carpeta: "99-prueba", escena: escenaPrueba, crearGuion: guionPrueba },
  // Las piezas de juego (TU-12): huacales, plancha, palanca, bejucos y balancín
  piezas: { carpeta: "98-piezas", escena: escenaPiezas, crearGuion: guionPiezas },
};
export const NIVEL_INICIAL = "prueba";
