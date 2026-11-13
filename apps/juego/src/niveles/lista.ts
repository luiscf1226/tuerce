// Los niveles del juego: cada uno es una carpeta de niveles/ con su escena (.glb) y su guion. Se abren con
// `?escena=nivel&nivel=<nombre>`.
import escenaPatio from "../../../../niveles/00-patio/escena.glb?url";
import { crearGuion as guionPatio } from "../../../../niveles/00-patio/guion";
import escenaPinar from "../../../../niveles/01-pinar/escena.glb?url";
import { crearGuion as guionPinar } from "../../../../niveles/01-pinar/guion";
import escenaPoza from "../../../../niveles/02-poza/escena.glb?url";
import { crearGuion as guionPoza } from "../../../../niveles/02-poza/guion";
import escenaCalle from "../../../../niveles/03-calle/escena.glb?url";
import { crearGuion as guionCalle } from "../../../../niveles/03-calle/guion";
import escenaXibalba from "../../../../niveles/04-xibalba/escena.glb?url";
import { crearGuion as guionXibalba } from "../../../../niveles/04-xibalba/guion";
import escenaTren from "../../../../niveles/05-tren/escena.glb?url";
import { crearGuion as guionTren } from "../../../../niveles/05-tren/guion";
import escenaRio from "../../../../niveles/06-rio/escena.glb?url";
import { crearGuion as guionRio } from "../../../../niveles/06-rio/guion";
// Las trenzas (TU-40)
import escenaTrenzas from "../../../../niveles/07-trenzas/escena.glb?url";
import { crearGuion as guionTrenzas } from "../../../../niveles/07-trenzas/guion";
// El cafetal (TU-41)
import escenaCafetal from "../../../../niveles/08-cafetal/escena.glb?url";
import { crearGuion as guionCafetal } from "../../../../niveles/08-cafetal/guion";
// Los canales (TU-42)
import escenaCanales from "../../../../niveles/09-canales/escena.glb?url";
import { crearGuion as guionCanales } from "../../../../niveles/09-canales/guion";
// La garrucha (TU-43)
import escenaGarrucha from "../../../../niveles/10-garrucha/escena.glb?url";
import { crearGuion as guionGarrucha } from "../../../../niveles/10-garrucha/guion";
// El llano (TU-44)
import escenaLlano from "../../../../niveles/11-llano/escena.glb?url";
import { crearGuion as guionLlano } from "../../../../niveles/11-llano/guion";
// La medianoche (TU-49)
import escenaMedianoche from "../../../../niveles/16-medianoche/escena.glb?url";
import { crearGuion as guionMedianoche } from "../../../../niveles/16-medianoche/guion";
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
  // Nivel 3 (TU-25): Comayagua, Honduras. Seis misiones y la Carreta sin bueyes
  calle: {
    carpeta: "03-calle",
    escena: escenaCalle,
    crearGuion: guionCalle,
    // Amarrados no: uno sostiene el freno mientras el otro cruza la calle (9 m), y las campanas están a 7 m
    sinTrampas: ["mecate"],
  },
  // Nivel 4 (TU-26): Copán, Honduras. Seis misiones y los murciélagos de Xibalbá
  xibalba: { carpeta: "04-xibalba", escena: escenaXibalba, crearGuion: guionXibalba },
  // Nivel 5 (TU-27): El Progreso, Honduras. Vagones, dresina, cambio de vía, grúa y el Duende
  tren: {
    carpeta: "05-tren",
    escena: escenaTren,
    crearGuion: guionTren,
    // Amarrados no: el que cuida el cambio se queda en la loma mientras el otro baja con la dresina, y la palanca de
    // la grúa y las del portón final quedan lejos del racimo y del portón
    sinTrampas: ["mecate"],
  },
  // Nivel 6 (TU-28): el Río Plátano, La Mosquitia. El pipante, el puente colgante, la palmera y el Sisimite
  rio: {
    carpeta: "06-rio",
    escena: escenaRio,
    crearGuion: guionRio,
    // Amarrados no: la palmera lanza a uno solo al otro lado del barranco, y el otro se queda jalando la soga
    sinTrampas: ["mecate"],
  },
  // Las trenzas (TU-40): Antigua, Guatemala. El nudo, la mula, el balde de agua y el Sombrerón
  trenzas: {
    carpeta: "07-trenzas",
    escena: escenaTrenzas,
    crearGuion: guionTrenzas,
    // Amarrados no: los cabos del nudo quedan a 4 m, y en la fuente uno se queda de cada lado del pretil
    sinTrampas: ["mecate"],
  },
  // El cafetal (TU-41)
  // Nivel 8: Izalco, El Salvador. Los canastos, la zaranda, la polea y El Cipitío
  cafetal: {
    carpeta: "08-cafetal",
    escena: escenaCafetal,
    crearGuion: guionCafetal,
    // Amarrados no: el que lanza los canastos y el que los atrapa quedan a más de 3 m, en terrazas distintas
    sinTrampas: ["mecate"],
  },
  // Los canales (TU-42): nivel 9, Xochimilco. La trajinera, el agua de La Llorona, las chinampas y la piñata
  canales: {
    carpeta: "09-canales",
    escena: escenaCanales,
    crearGuion: guionCanales,
    // Amarrados no: el que jala la soga de la piñata queda a más de 3 m de ella
    sinTrampas: ["mecate"],
  },
  // La garrucha (TU-43). Nivel 10: el Eje cafetero, Colombia. La garrucha, la carrera contra La Patasola, la chiva,
  // la palma de cera y las lianas
  garrucha: {
    carpeta: "10-garrucha",
    escena: escenaGarrucha,
    crearGuion: guionGarrucha,
    // Amarrados no: el que jala la manija se queda en la finca mientras el otro cruza el cañón en la canasta (13 m)
    sinTrampas: ["mecate"],
  },
  // El llano (TU-44): Los Llanos, Venezuela. El Silbón, el molino, el ganado, la hamaca y el saco
  llano: {
    carpeta: "11-llano",
    escena: escenaLlano,
    crearGuion: guionLlano,
    // Amarrados no: uno frena el molino lejos de las aspas, y la hamaca lanza a uno solo al otro lado del caño
    sinTrampas: ["mecate"],
  },
  // La medianoche (TU-49): nivel 16, la Amazonía (Brasil), el último. Las huellas del Curupira, los nenúfares
  // gigantes, la montaria, el árbol del Curupira y los fuegos artificiales de Año Nuevo
  medianoche: {
    carpeta: "16-medianoche",
    escena: escenaMedianoche,
    crearGuion: guionMedianoche,
    // Amarrados no: los dos chisperos de cada castillo de fuegos quedan a más de 4 m uno del otro
    sinTrampas: ["mecate"],
  },
};
export const NIVEL_INICIAL = "prueba";
