// Los tres volúmenes del juego (TU-59): general, efectos y música, de 0 a 1. Se guardan en este navegador
// (localStorage) y los lee y cambia el panel de Opciones (TU-60) con `volumenes()`, `fijarVolumen()` y
// `alCambiarVolumen()` de src/sonido. El ambiente de cada nivel va por los efectos; el menú, por la música.
//
// Sin DOM: el almacén se pasa (en el navegador, `localStorage`) y todo lo que lo toca va con try/catch, porque en
// una ventana privada o con los datos del sitio bloqueados puede no estar o tirar error.

export type Canal = "general" | "efectos" | "musica";
export const CANALES: readonly Canal[] = ["general", "efectos", "musica"];

export type Volumenes = Readonly<Record<Canal, number>>;

/** Con lo que arranca quien nunca tocó nada: la música más bajita que los efectos, para que acompañe. */
export const VOLUMENES_INICIALES: Volumenes = { general: 0.8, efectos: 1, musica: 0.6 };

/** La llave en localStorage. */
export const LLAVE_VOLUMENES = "tuerce:volumenes";

/** Lo que hace falta de `Storage`. */
export interface Almacen {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
}

export interface Mezcla {
  /** Los tres volúmenes de ahora. */
  volumenes(): Volumenes;
  /** Cambia uno (se recorta a 0–1), lo guarda y avisa. */
  fijarVolumen(canal: Canal, valor: number): void;
  /** Avisa cada vez que cambia alguno. Devuelve cómo dejar de avisar. */
  alCambiarVolumen(aviso: (volumenes: Volumenes) => void): () => void;
}

const recortar = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Lo guardado, completado con los iniciales; si no hay nada o está roto, los iniciales. */
export function leerVolumenes(almacen: Almacen | undefined): Volumenes {
  let guardado: unknown;
  try {
    const texto = almacen?.getItem(LLAVE_VOLUMENES);
    guardado = texto ? JSON.parse(texto) : undefined;
  } catch {
    guardado = undefined;
  }
  const v = { ...VOLUMENES_INICIALES };
  if (guardado && typeof guardado === "object") {
    for (const canal of CANALES) {
      const n = (guardado as Record<string, unknown>)[canal];
      if (typeof n === "number") v[canal] = recortar(n);
    }
  }
  return v;
}

export function crearMezcla(almacen: Almacen | undefined): Mezcla {
  let actuales = leerVolumenes(almacen);
  const avisos = new Set<(volumenes: Volumenes) => void>();
  return {
    volumenes: () => actuales,
    fijarVolumen(canal, valor) {
      const n = recortar(valor);
      if (actuales[canal] === n) return;
      actuales = { ...actuales, [canal]: n };
      try {
        almacen?.setItem(LLAVE_VOLUMENES, JSON.stringify(actuales));
      } catch {
        // Sin dónde guardar, vale para esta partida
      }
      for (const aviso of avisos) aviso(actuales);
    },
    alCambiarVolumen(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
}

/** El localStorage del navegador, si se deja usar. */
export function almacenDelNavegador(): Almacen | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
