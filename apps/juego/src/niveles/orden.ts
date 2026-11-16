// La historia: los 17 niveles en orden, del patio a la medianoche (docs/plan.html, «Historia»). No importa las
// escenas (lista.ts) para que el menú y las pantallas de la cuenta la usen sin bajar ningún .glb.

export interface NivelDeLaHistoria {
  /** La clave de `?escena=nivel&nivel=<clave>` (la de NIVELES en lista.ts). */
  readonly clave: string;
  /** El número de la carpeta (00 a 16). */
  readonly numero: number;
  readonly titulo: string;
  readonly lugar: string;
}

export const HISTORIA: readonly NivelDeLaHistoria[] = [
  { clave: "patio", numero: 0, titulo: "El patio", lugar: "Honduras" },
  { clave: "pinar", numero: 1, titulo: "El pinar", lugar: "Honduras" },
  { clave: "poza", numero: 2, titulo: "La poza", lugar: "Honduras" },
  { clave: "calle", numero: 3, titulo: "La calle empedrada", lugar: "Honduras" },
  { clave: "xibalba", numero: 4, titulo: "Xibalbá", lugar: "Honduras" },
  { clave: "tren", numero: 5, titulo: "El tren bananero", lugar: "Honduras" },
  { clave: "rio", numero: 6, titulo: "Río Plátano", lugar: "Honduras" },
  { clave: "trenzas", numero: 7, titulo: "Las trenzas", lugar: "Antigua, Guatemala" },
  { clave: "cafetal", numero: 8, titulo: "El cafetal", lugar: "Izalco, El Salvador" },
  { clave: "canales", numero: 9, titulo: "Los canales", lugar: "Xochimilco, México" },
  { clave: "garrucha", numero: 10, titulo: "La garrucha", lugar: "Eje cafetero, Colombia" },
  { clave: "llano", numero: 11, titulo: "El llano", lugar: "Los Llanos, Venezuela" },
  { clave: "puente", numero: 12, titulo: "El puente de paja", lugar: "Q’eswachaka, Perú" },
  { clave: "mina", numero: 13, titulo: "La mina", lugar: "Potosí, Bolivia" },
  { clave: "minga", numero: 14, titulo: "La minga", lugar: "Chiloé, Chile" },
  { clave: "pampa", numero: 15, titulo: "La pampa", lugar: "La Pampa, Argentina" },
  { clave: "medianoche", numero: 16, titulo: "La medianoche", lugar: "Amazonía, Brasil" },
];

/** El primer nivel de la historia. */
export const PRIMER_NIVEL = "patio";

/** El nivel de la historia con esa clave, o undefined si no es de la historia (98-piezas, 99-prueba). */
export function nivelDeLaHistoria(clave: string): NivelDeLaHistoria | undefined {
  return HISTORIA.find((n) => n.clave === clave);
}

/** El que sigue en la historia; null después del último (la medianoche) o si la clave no es de la historia. */
export function siguienteNivel(clave: string): NivelDeLaHistoria | null {
  const i = HISTORIA.findIndex((n) => n.clave === clave);
  if (i < 0) return null;
  return HISTORIA[i + 1] ?? null;
}

/** Si es el último de la historia: al ganarlo viene el final. */
export function esElUltimo(clave: string): boolean {
  return HISTORIA[HISTORIA.length - 1]?.clave === clave;
}
