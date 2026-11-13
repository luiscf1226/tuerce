// El ropero, los secretos y los logros (TU-29, RF-17 y RF-20): qué prendas hay, cuáles se tienen desde el principio
// y qué da cada nivel. Es solo datos (sin funciones de Convex), como `regiones.ts`: lo usan `ropero.ts` para
// validar y el juego para vestir a los muñecos (`apps/juego/src/ropero/`).
//
// Cada nivel tiene un secreto y un logro (los textos son los del plan, docs/generador/niveles-tuerce.mjs). Encontrar
// el secreto le da a los dos de la pareja la prenda del nivel; el logro queda en la lista de cada uno.
//
// El color del pañuelo no se elige: es la identidad del jugador en cada partida (rojo el 1, turquesa el 2). Lo que se
// elige es la forma de cada prenda.

export const CATEGORIAS = ["panuelo", "sombrero", "peinado", "mascara"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const PRENDAS = {
  panuelo: ["triangulo", "lazo", "bufanda", "vincha", "capa"],
  sombrero: ["ninguno", "ala-ancha", "cucurucho", "bombin", "puntudo", "chullo", "boina"],
  peinado: ["ninguno", "trenzas", "grenas", "copete", "chongo", "colitas", "cresta"],
  mascara: ["ninguna", "antifaz", "guacamaya", "jade", "alebrije", "diablito"],
} as const satisfies Record<Categoria, readonly string[]>;

export type Prenda<C extends Categoria = Categoria> = (typeof PRENDAS)[C][number];

/** Lo que lleva puesto un muñeco: una forma de cada categoría. */
export type Vestuario = { readonly [C in Categoria]: Prenda<C> };

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  panuelo: "Pañuelo",
  sombrero: "Sombrero",
  peinado: "Peinado",
  mascara: "Máscara",
};

export const NOMBRE_PRENDA: { readonly [C in Categoria]: Record<Prenda<C>, string> } = {
  panuelo: {
    triangulo: "Triángulo",
    lazo: "Lazo",
    bufanda: "Bufanda",
    vincha: "Vincha",
    capa: "Capa",
  },
  sombrero: {
    ninguno: "Sin sombrero",
    "ala-ancha": "Ala ancha",
    cucurucho: "Cucurucho de fiesta",
    bombin: "Bombín",
    puntudo: "Puntudo",
    chullo: "Chullo",
    boina: "Boina",
  },
  peinado: {
    ninguno: "Pelón",
    trenzas: "Trenzas",
    grenas: "Greñas de nido",
    copete: "Copete",
    chongo: "Chongo",
    colitas: "Colitas",
    cresta: "Cresta",
  },
  mascara: {
    ninguna: "Sin máscara",
    antifaz: "Antifaz",
    guacamaya: "Guacamaya",
    jade: "Jade",
    alebrije: "Alebrije",
    diablito: "Diablito",
  },
};

/** Lo que se tiene desde el principio, sin ganar nada: una de cada categoría (y quitarse el sombrero o la máscara). */
export const INICIALES: { readonly [C in Categoria]: readonly Prenda<C>[] } = {
  panuelo: ["triangulo"],
  sombrero: ["ninguno", "ala-ancha"],
  peinado: ["ninguno", "trenzas"],
  mascara: ["ninguna", "antifaz"],
};

/** Cómo arranca cada uno, como en docs/arte/14-personajes: el rojo con su sombrero y el turquesa con sus trenzas. */
export const VESTUARIO_INICIAL: readonly [Vestuario, Vestuario] = [
  { panuelo: "triangulo", sombrero: "ala-ancha", peinado: "ninguno", mascara: "ninguna" },
  { panuelo: "triangulo", sombrero: "ninguno", peinado: "trenzas", mascara: "ninguna" },
];

/** Una prenda ganable, como se guarda en `desbloqueos.cosa`: «categoría:prenda» (`sombrero:puntudo`). */
export type Cosa = `${Categoria}:${string}`;

export function cosa<C extends Categoria>(categoria: C, prenda: Prenda<C>): Cosa {
  return `${categoria}:${prenda}`;
}

export interface PremiosDeNivel {
  readonly nombre: string;
  /** El secreto escondido en el nivel. El ropero no lo cuenta hasta que se encuentra. */
  readonly secreto: string;
  /** Lo que da el secreto, a los dos de la pareja. */
  readonly prenda: Cosa;
  readonly logro: { readonly id: string; readonly nombre: string; readonly texto: string };
}

const nivel = (nombre: string, secreto: string, prenda: Cosa, logroId: string, logro: string): PremiosDeNivel => {
  const [titulo = logro, ...resto] = logro.split(": ");
  return { nombre, secreto, prenda, logro: { id: logroId, nombre: titulo, texto: resto.join(": ") || titulo } };
};

/** Qué da cada nivel, por número (el 99 es el de prueba, niveles/99-prueba). */
export const PREMIOS: Readonly<Record<number, PremiosDeNivel>> = {
  0: nivel(
    "El patio",
    "La piñata olvidada en el palo de mango.",
    cosa("sombrero", "cucurucho"),
    "a-la-de-tres",
    "A la de tres: cargar la escalera sin botarla.",
  ),
  1: nivel(
    "El pinar",
    "El nido en el pino más alto.",
    cosa("peinado", "grenas"),
    "ni-una-lamida",
    "Ni una lamida: pasar sin que el Cadejo los alcance.",
  ),
  2: nivel(
    "La poza",
    "Una pepita de oro en el fondo de la poza.",
    cosa("panuelo", "lazo"),
    "secos",
    "Secos: terminar sin caer al agua.",
  ),
  3: nivel(
    "La calle empedrada",
    "El pilón escondido en el carrito del parque.",
    cosa("sombrero", "bombin"),
    "ni-una-pisada",
    "Ni una pisada: dejar las alfombras intactas.",
  ),
  4: nivel(
    "Xibalbá de juguete",
    "La guacamaya dorada en lo alto del templo.",
    cosa("mascara", "guacamaya"),
    "con-luz",
    "Con luz: cruzar el túnel sin que se apague la antorcha.",
  ),
  5: nivel(
    "El tren bananero",
    "El racimo de mínimos dorados.",
    cosa("peinado", "copete"),
    "puntual",
    "Puntual: llegar antes de que pite el tren.",
  ),
  6: nivel(
    "Río Plátano",
    "La figura de jade de la ciudad perdida.",
    cosa("mascara", "jade"),
    "sin-despertarlo",
    "Sin despertarlo: subir al Sisimite sin que abra los ojos.",
  ),
  7: nivel(
    "Las trenzas",
    "Un barrilete escondido en el campanario.",
    cosa("panuelo", "bufanda"),
    "sin-un-nudo",
    "Sin un nudo: no enredarse ni una vez.",
  ),
  8: nivel(
    "El cafetal",
    "El sombrero puntudo del Cipitío.",
    cosa("sombrero", "puntudo"),
    "buen-pulso",
    "Buen pulso: atrapar diez canastos seguidos.",
  ),
  9: nivel(
    "Los canales",
    "Un alebrije dormido en una chinampa.",
    cosa("mascara", "alebrije"),
    "ni-una-flor-menos",
    "Ni una flor menos: llegar con todas las flores.",
  ),
  10: nivel(
    "La garrucha",
    "Una orquídea en la palma más alta.",
    cosa("peinado", "chongo"),
    "en-una-pata",
    "En una pata: ganarle la carrera a la Patasola.",
  ),
  11: nivel(
    "El llano",
    "Un arpa llanera bajo el samán.",
    cosa("panuelo", "vincha"),
    "buen-oido",
    "Buen oído: hallarlo al primer intento.",
  ),
  12: nivel(
    "El puente de paja",
    "Un quipu escondido entre las piedras.",
    cosa("sombrero", "chullo"),
    "tejedores",
    "Tejedores: armar el puente sin soltar la cuerda.",
  ),
  13: nivel(
    "La mina",
    "Una pepita de plata en la galería vieja.",
    cosa("mascara", "diablito"),
    "sin-chispas",
    "Sin chispas: salir de la mina sin explotar.",
  ),
  14: nivel(
    "La minga",
    "Un curanto enterrado en la playa.",
    cosa("peinado", "colitas"),
    "a-hombro",
    "A hombro: mover la casa sin que se salga de los troncos.",
  ),
  15: nivel(
    "La pampa",
    "Un mate olvidado en el ombú.",
    cosa("sombrero", "boina"),
    "contra-el-viento",
    "Contra el viento: cruzar sin soltar la tranquera.",
  ),
  16: nivel(
    "La medianoche",
    "Un delfín rosado en el recodo del río.",
    cosa("panuelo", "capa"),
    "feliz-ano",
    "Feliz año: encender todos los fuegos a la medianoche.",
  ),
  99: nivel(
    "Prueba",
    "La mata detrás de la meta.",
    cosa("peinado", "cresta"),
    "mudanza",
    "Mudanza: subir el huacal hasta arriba del escalón.",
  ),
};

/** Los números de nivel que tienen premios, en orden. */
export const NIVELES_CON_PREMIOS: readonly number[] = Object.keys(PREMIOS)
  .map(Number)
  .sort((a, b) => a - b);

export function esCategoria(texto: string): texto is Categoria {
  return (CATEGORIAS as readonly string[]).includes(texto);
}

export function esPrenda<C extends Categoria>(categoria: C, texto: string): texto is Prenda<C> {
  return (PRENDAS[categoria] as readonly string[]).includes(texto);
}

/** Si esa prenda se tiene desde el principio. */
export function esInicial<C extends Categoria>(categoria: C, prenda: Prenda<C>): boolean {
  return (INICIALES[categoria] as readonly string[]).includes(prenda);
}

/** La categoría y la prenda de una cosa («sombrero:puntudo»), o `undefined` si no existe. */
export function partirCosa(c: string): { categoria: Categoria; prenda: Prenda } | undefined {
  const [categoria = "", prenda = ""] = c.split(":");
  return esCategoria(categoria) && esPrenda(categoria, prenda) ? { categoria, prenda } : undefined;
}

/** El nombre para mostrar de una prenda. */
export function nombreDe<C extends Categoria>(categoria: C, prenda: Prenda<C>): string {
  return (NOMBRE_PRENDA[categoria] as Record<string, string>)[prenda] ?? prenda;
}

/** El nivel cuyo secreto da esa prenda, o `undefined` si no se gana en ninguno (las iniciales). */
export function nivelQueDa(c: Cosa): number | undefined {
  return NIVELES_CON_PREMIOS.find((n) => PREMIOS[n]?.prenda === c);
}

/** Lee un vestuario de texto («sombrero:puntudo,mascara:diablito»): lo que falta o no existe queda como en `base`. */
export function leerVestuario(texto: string, base: Vestuario): Vestuario {
  const v: Record<Categoria, string> = { ...base };
  for (const parte of texto.split(",")) {
    const [categoria = "", prenda = ""] = parte.split(":").map((s) => s.trim());
    if (esCategoria(categoria) && esPrenda(categoria, prenda)) v[categoria] = prenda;
  }
  return v as Vestuario;
}
