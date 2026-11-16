// Los ajustes de este navegador que no son el volumen (TU-60): por ahora, «menos movimiento». Los volúmenes los
// guarda el sonido (src/sonido/mezcla.ts, `tuerce:volumenes`); esto va aparte en `tuerce:ajustes`.
//
//   menos movimiento   sin sacudidas y con los fundidos y el cartel de TU-62 cortos (ui/fundido.ts,
//                      ui/cartel-nivel.ts) y sin las animaciones de los avisos (la clase `menos-movimiento` de la
//                      página, ver estilo.css). Quien nunca lo tocó arranca con lo que pide su sistema
//                      (`prefers-reduced-motion`).
//
// Sin DOM: el almacén y lo que prefiere el sistema se pasan (las pruebas usan unos de mentira). Todo lo que toca el
// almacén va con try/catch: en una ventana privada puede no estar o tirar error, y entonces vale para esta partida.
import { type Almacen, almacenDelNavegador } from "./sonido/mezcla";

export interface Ajustes {
  readonly menosMovimiento: boolean;
}

/** La llave en localStorage. */
export const LLAVE_AJUSTES = "tuerce:ajustes";

/** Lo guardado; lo que falta (o si está roto), lo que pide el sistema. */
export function leerAjustes(almacen: Almacen | undefined, prefiereMenosMovimiento: boolean): Ajustes {
  let guardado: unknown;
  try {
    const texto = almacen?.getItem(LLAVE_AJUSTES);
    guardado = texto ? JSON.parse(texto) : undefined;
  } catch {
    guardado = undefined;
  }
  const menos =
    guardado && typeof guardado === "object" ? (guardado as Record<string, unknown>).menosMovimiento : undefined;
  return { menosMovimiento: typeof menos === "boolean" ? menos : prefiereMenosMovimiento };
}

export interface Ajustador {
  ajustes(): Ajustes;
  /** Cambia uno, lo guarda y avisa. */
  fijar<K extends keyof Ajustes>(nombre: K, valor: Ajustes[K]): void;
  /** Avisa cada vez que cambia alguno. Devuelve cómo dejar de avisar. */
  alCambiar(aviso: (ajustes: Ajustes) => void): () => void;
}

export function crearAjustes(almacen: Almacen | undefined, prefiereMenosMovimiento: boolean): Ajustador {
  let actuales = leerAjustes(almacen, prefiereMenosMovimiento);
  const avisos = new Set<(ajustes: Ajustes) => void>();
  return {
    ajustes: () => actuales,
    fijar(nombre, valor) {
      if (actuales[nombre] === valor) return;
      actuales = { ...actuales, [nombre]: valor };
      try {
        almacen?.setItem(LLAVE_AJUSTES, JSON.stringify(actuales));
      } catch {
        // Sin dónde guardar, vale para esta partida
      }
      for (const aviso of avisos) aviso(actuales);
    },
    alCambiar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
}

/** Si el sistema pide menos movimiento. */
function sistemaPideMenos(): boolean {
  try {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

let delJuego: Ajustador | undefined;
/** Los ajustes de esta página (nacen la primera vez que alguien los pide). */
export function ajustesDelJuego(): Ajustador {
  delJuego ??= crearAjustes(almacenDelNavegador(), sistemaPideMenos());
  return delJuego;
}

/** Si va con menos movimiento: sin sacudidas ni fundidos largos. */
export function menosMovimiento(): boolean {
  return ajustesDelJuego().ajustes().menosMovimiento;
}
