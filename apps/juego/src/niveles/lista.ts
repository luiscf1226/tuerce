// Los niveles del juego: cada uno es una carpeta de niveles/ con su escena (.glb) y su guion. Se abren con
// `?escena=nivel&nivel=<nombre>`.
import escenaPatio from "../../../../niveles/00-patio/escena.glb?url";
import { crearGuion as guionPatio } from "../../../../niveles/00-patio/guion";
import escenaPinar from "../../../../niveles/01-pinar/escena.glb?url";
import { crearGuion as guionPinar } from "../../../../niveles/01-pinar/guion";
import escenaPoza from "../../../../niveles/02-poza/escena.glb?url";
import { crearGuion as guionPoza } from "../../../../niveles/02-poza/guion";
import escenaPiezas from "../../../../niveles/98-piezas/escena.glb?url";
import { crearGuion as guionPiezas } from "../../../../niveles/98-piezas/guion";
import escenaPrueba from "../../../../niveles/99-prueba/escena.glb?url";
import { crearGuion as guionPrueba } from "../../../../niveles/99-prueba/guion";
import type { GuionDeNivel } from "./guion";
import type { NombreTrampa } from "./noche";

export interface DatosDeNivel {
  /** La carpeta en niveles/ (las pruebas leen el .glb de ahí). */
  readonly carpeta: string;
  /** La dirección del .glb, que arma Vite. */
  readonly escena: string;
  /** Un guion nuevo para cada partida (guarda su propio estado). */
  readonly crearGuion: () => GuionDeNivel;
  /** Las trampas de la noche de tuerce (TU-33) que este nivel no admite porque lo harían imposible. */
  readonly sinTrampas?: readonly NombreTrampa[];
}

export const NIVELES: Record<string, DatosDeNivel> = {
  // El nivel 0 (TU-13): el patio de Tegucigalpa, el 31 de diciembre por la mañana
  patio: { carpeta: "00-patio", escena: escenaPatio, crearGuion: guionPatio },
  prueba: { carpeta: "99-prueba", escena: escenaPrueba, crearGuion: guionPrueba },
  // Las piezas de juego (TU-12): huacales, plancha, palanca, bejucos y balancín
  piezas: { carpeta: "98-piezas", escena: escenaPiezas, crearGuion: guionPiezas },
  // Nivel 1 (TU-14): La Esperanza, Honduras. Seis misiones y el Cadejo
  pinar: {
    carpeta: "01-pinar",
    escena: escenaPinar,
    crearGuion: guionPinar,
    // Amarrados no: en el balancín uno hace contrapeso en tierra y el otro baja en la otra orilla, a más de 8 m
    sinTrampas: ["mecate"],
  },
  // Nivel 2 (TU-24): el río Guayape, Honduras. El agua, la balsa, la compuerta y La Sucia
  poza: {
    carpeta: "02-poza",
    escena: escenaPoza,
    crearGuion: guionPoza,
    // Amarrados no: en la represa uno sostiene la palanca y el otro trepa lejos; en el tendedero baja uno solo
    sinTrampas: ["mecate"],
  },
};
export const NIVEL_INICIAL = "prueba";
