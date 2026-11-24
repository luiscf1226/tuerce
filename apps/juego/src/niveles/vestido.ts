// Cómo se viste cada nivel (TU-61): la textura de su suelo y lo que hay en el primer plano. Va en código, por número
// de nivel (el `numero` de la escena del .glb), así no hace falta volver a exportar desde Blender. Ver niveles/README.md.
import type { PlantaDeAbajo, RamaDeArriba } from "../imagen/primer-plano";
import type { Suelo } from "../imagen/suelos";

export interface Vestido {
  /** La textura de los sólidos con material `suelo`. */
  readonly suelo: Suelo;
  /** Lo que crece en el borde de abajo de la imagen (`null`, nada). */
  readonly abajo: PlantaDeAbajo | null;
  /** Lo que cuelga en las esquinas de arriba (`null`, nada). */
  readonly arriba: RamaDeArriba | null;
}

/** El de los niveles que no están en la lista (los de prueba). */
export const VESTIDO_COMUN: Vestido = { suelo: "tierra", abajo: "hojas", arriba: null };

export const VESTIDOS: Readonly<Record<number, Vestido>> = {
  // El patio de Tegucigalpa: tierra apisonada y matas del cerco
  0: { suelo: "tierra", abajo: "hojas", arriba: "hojas" },
  // El pinar de La Esperanza: pinocha y ramas de pino colgando (docs/arte/11-pinar)
  1: { suelo: "pinocha", abajo: "hojas", arriba: "pino" },
  // La poza del Guayape: arena de río
  2: { suelo: "arena", abajo: "hojas", arriba: "hojas" },
  // La calle de Comayagua: tierra entre las piedras bola del empedrado, que pone su guion (docs/arte/13-carreta)
  3: { suelo: "tierra", abajo: "hojas", arriba: "hojas" },
  // Xibalbá de juguete, Copán: bloques de piedra labrada
  4: { suelo: "sillar", abajo: "hojas", arriba: "hojas" },
  // El tren de El Progreso: balasto de la vía
  5: { suelo: "grava", abajo: "pasto", arriba: null },
  // El Río Plátano: hojarasca de la selva
  6: { suelo: "hojarasca", abajo: "hojas", arriba: "hojas" },
  // Las trenzas, Antigua: empedrado
  7: { suelo: "empedrado", abajo: "hojas", arriba: "hojas" },
  // El cafetal de Izalco: tierra de las terrazas
  8: { suelo: "tierra", abajo: "hojas", arriba: "hojas" },
  // Los canales de Xochimilco: pasto de las chinampas
  9: { suelo: "pasto", abajo: "pasto", arriba: "hojas" },
  // La garrucha, Eje cafetero: pasto de la finca
  10: { suelo: "pasto", abajo: "hojas", arriba: "hojas" },
  // El llano: pasto abierto, sin árboles encima
  11: { suelo: "pasto", abajo: "pasto", arriba: null },
  // El puente de Q'eswachaka: el ichu de la puna
  12: { suelo: "pasto", abajo: "pasto", arriba: null },
  // La mina de Potosí: piedra oscura, sin plantas
  13: { suelo: "piedra", abajo: "piedras", arriba: null },
  // La minga de Chiloé: arena de la playa
  14: { suelo: "arena", abajo: "pasto", arriba: null },
  // La pampa: pasto
  15: { suelo: "pasto", abajo: "pasto", arriba: null },
  // La medianoche, la Amazonía: hojarasca y hojas grandes
  16: { suelo: "hojarasca", abajo: "hojas", arriba: "hojas" },
};

export function vestidoDe(numero: number): Vestido {
  return VESTIDOS[numero] ?? VESTIDO_COMUN;
}
