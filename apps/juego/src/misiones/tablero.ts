// Las misiones: qué tiene que hacer la pareja y cuánto le falta. Sin DOM ni físicas: cada objetivo sabe medirse
// (`medir`) y el tablero los recorre en cada paso, anota los cumplidos (lo cumplido queda cumplido aunque después se
// deshaga: el cántaro que sale rodando del círculo no descuenta) y avisa cuando cambia algo. Lo prueba tablero.test.ts.
//
// Dos maneras de recorrerlos:
//   en orden  (el tutorial) solo se mide el objetivo de turno; los de después esperan, así una lección no se
//             cumple sola antes de que la expliquen.
//   sueltos   (los niveles) se miden todos en cada paso, en cualquier orden.

/** Cómo va un objetivo: cumplido o no, y si se cuenta (dos de dos jugadores, tres de cinco semillas), cuánto. */
export interface Medida {
  readonly hecho: boolean;
  readonly cuenta?: number;
  readonly total?: number;
}

/** Las teclas que pide un objetivo, por jugador, para mostrarlas en la hoja de la misión. */
export interface Teclas {
  readonly rojo: string;
  readonly turquesa: string;
  readonly mando: string;
}

/** Un tramo de la misión: qué hay que hacer para llegar al próximo punto de control, y cómo. */
export interface Paso {
  /** Corto y en imperativo: «Abran el portón». */
  readonly que: string;
  /** Cómo se hace, en una o dos líneas: qué agarrar, dónde y quién hace qué. */
  readonly pista: string;
  /** Si hace falta que los dos lo hagan a la vez. */
  readonly deADos?: boolean;
}

export interface Objetivo {
  /** Para las pruebas y el `data-` de la hoja. */
  readonly id: string;
  /** Corto, en imperativo y de a dos: «Caminen», «Carguen el cántaro». */
  readonly titulo: string;
  /** Cómo se hace, en una o dos líneas. */
  readonly texto: string;
  readonly teclas?: Teclas;
  /** Opcional: no hace falta para terminar (el secreto y el logro de un nivel). */
  readonly opcional?: boolean;
  /** Si se cuenta por tramos (la meta, por puntos de control), el consejo de cada uno: `pasos[cuenta]` es el que va. */
  readonly pasos?: readonly Paso[];
  /** Cómo va ahora. Se llama una vez por paso mientras no esté cumplido. */
  medir(): Medida;
  /** Se llama una vez cuando le toca el turno (en orden) o al empezar (sueltos): para anotar desde dónde se mide. */
  empezar?(): void;
}

export interface Tablero {
  readonly objetivos: readonly Objetivo[];
  /** La última medida de cada objetivo (los cumplidos quedan con `hecho`). */
  medida(indice: number): Medida;
  /** En orden: el índice del objetivo de turno (`objetivos.length` al terminar). Sueltos: el primero sin cumplir. */
  readonly actual: number;
  /** Cuántos de los obligatorios están cumplidos, y cuántos son. */
  readonly cumplidos: number;
  readonly obligatorios: number;
  /** Si se cumplieron todos los obligatorios. */
  readonly terminado: boolean;
  /** Mide lo que toca. Va una vez por paso de físicas, después de `mundo.step()`. */
  pasar(): void;
  /** Avisa cada vez que cambia una medida (para repintar la hoja) o se cumple un objetivo. */
  alCambiar(aviso: (cumplido: Objetivo | null) => void): () => void;
}

const SIN_EMPEZAR: Medida = { hecho: false };

function iguales(a: Medida, b: Medida): boolean {
  return a.hecho === b.hecho && a.cuenta === b.cuenta && a.total === b.total;
}

export function crearTablero(objetivos: readonly Objetivo[], { enOrden = false } = {}): Tablero {
  const medidas: Medida[] = objetivos.map(() => SIN_EMPEZAR);
  const empezados = objetivos.map(() => false);
  const avisos = new Set<(cumplido: Objetivo | null) => void>();
  const avisar = (cumplido: Objetivo | null) => {
    for (const aviso of avisos) aviso(cumplido);
  };
  const primeroSinCumplir = () => {
    const i = medidas.findIndex((m, j) => !m.hecho && !objetivos[j]?.opcional);
    return i < 0 ? objetivos.length : i;
  };
  const empezar = (i: number) => {
    if (empezados[i]) return;
    empezados[i] = true;
    objetivos[i]?.empezar?.();
  };
  const medirUno = (i: number) => {
    const objetivo = objetivos[i];
    const antes = medidas[i];
    if (!objetivo || !antes || antes.hecho) return;
    empezar(i);
    const ahora = objetivo.medir();
    if (iguales(antes, ahora)) return;
    // Lo cumplido queda cumplido, con la cuenta llena
    medidas[i] = ahora.hecho && ahora.total !== undefined ? { ...ahora, cuenta: ahora.total } : ahora;
    avisar(ahora.hecho ? objetivo : null);
  };
  const obligatorios = objetivos.filter((o) => !o.opcional).length;

  return {
    objetivos,
    medida: (i) => medidas[i] ?? SIN_EMPEZAR,
    get actual() {
      return primeroSinCumplir();
    },
    get cumplidos() {
      return medidas.filter((m, i) => m.hecho && !objetivos[i]?.opcional).length;
    },
    obligatorios,
    get terminado() {
      return primeroSinCumplir() === objetivos.length;
    },
    pasar() {
      if (enOrden) {
        // El de turno; si se cumple, el siguiente empieza a medirse en el paso que viene
        const i = primeroSinCumplir();
        if (i < objetivos.length) medirUno(i);
        // Los opcionales no tienen turno: se miden siempre
        objetivos.forEach((o, j) => {
          if (o.opcional) medirUno(j);
        });
      } else {
        for (let i = 0; i < objetivos.length; i++) medirUno(i);
      }
    },
    alCambiar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
}

/** «2 de 5», o nada si el objetivo no se cuenta. */
export function textoDeCuenta(medida: Medida): string {
  if (medida.total === undefined || medida.total <= 1) return "";
  return `${medida.cuenta ?? 0} de ${medida.total}`;
}

/** El tramo que va ahora: el de la cuenta, o ninguno si el objetivo no tiene pasos o ya se cumplió. */
export function pasoActual(objetivo: Pick<Objetivo, "pasos">, medida: Medida): Paso | null {
  if (medida.hecho || !objetivo.pasos) return null;
  return objetivo.pasos[medida.cuenta ?? 0] ?? null;
}

/** Cuenta cuántos de los dos jugadores ya lo hicieron: cada uno queda anotado la primera vez que `hizo(j)` es cierto. */
export function porJugador(hizo: (jugador: 0 | 1) => boolean): { medir(): Medida; reiniciar(): void } {
  const ya = [false, false];
  return {
    medir() {
      for (const j of [0, 1] as const) if (!ya[j] && hizo(j)) ya[j] = true;
      const cuenta = ya.filter(Boolean).length;
      return { hecho: cuenta === 2, cuenta, total: 2 };
    },
    reiniciar() {
      ya[0] = ya[1] = false;
    },
  };
}
