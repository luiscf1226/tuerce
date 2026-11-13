// Qué tiene puesto cada muñeco (TU-29). En línea, lo que cada uno eligió en su ropero (Convex); en el mismo lugar,
// sin cuentas, lo que eligieron en el ropero de esta máquina con lo del principio (se guarda en el navegador), y si
// no eligieron nada, como en el arte: el rojo con su sombrero y el turquesa con sus trenzas.
//
// Para las capturas: `&ropa1=sombrero:puntudo,mascara:diablito` y `&ropa2=…` visten a cada uno con cualquier prenda.
import { CATEGORIAS, esInicial, leerVestuario, VESTUARIO_INICIAL, type Vestuario } from "../../../../convex/premios";

export type Jugador = 0 | 1;

const LLAVE = (jugador: Jugador) => `tuerce.ropero.${jugador + 1}`;

/** Completa lo que vino de Convex (puede faltar algo, o ser null si nunca eligió) con el vestuario de base. */
export function completar(parcial: Partial<Vestuario> | null | undefined, base: Vestuario): Vestuario {
  return { ...base, ...(parcial ?? {}) };
}

/** Lo elegido en el ropero de esta máquina para jugar sin cuenta (solo lo del principio). */
export function vestuarioLocal(jugador: Jugador): Vestuario {
  const base = VESTUARIO_INICIAL[jugador];
  let guardado: string | null = null;
  try {
    guardado = globalThis.localStorage?.getItem(LLAVE(jugador)) ?? null;
  } catch {
    // Sin almacenamiento (ventana privada, capturas): lo de siempre
  }
  if (!guardado) return base;
  const leido = leerVestuario(guardado, base);
  // Sin cuenta solo vale lo del principio
  return CATEGORIAS.every((c) => esInicial(c, leido[c])) ? leido : base;
}

export function guardarVestuarioLocal(jugador: Jugador, vestuario: Vestuario): void {
  try {
    globalThis.localStorage?.setItem(LLAVE(jugador), aTexto(vestuario));
  } catch {
    // Si no se puede guardar, vale para esta vez
  }
}

/** «panuelo:lazo,sombrero:ninguno,…», como en la dirección. */
export function aTexto(vestuario: Vestuario): string {
  return CATEGORIAS.map((c) => `${c}:${vestuario[c]}`).join(",");
}

/** El vestuario de un jugador en el mismo lugar: `&ropa1=`/`&ropa2=` de la dirección, o el del ropero local. */
export function vestuarioDe(parametros: URLSearchParams, jugador: Jugador): Vestuario {
  const base = vestuarioLocal(jugador);
  const texto = parametros.get(`ropa${jugador + 1}`);
  return texto === null ? base : leerVestuario(texto, VESTUARIO_INICIAL[jugador]);
}
