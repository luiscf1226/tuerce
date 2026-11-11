// El contrarreloj (TU-32): un nivel ya ganado, desde la salida, contra el reloj. El reloj cuenta pasos de físicas
// (1/60 s), no el tiempo del cuadro: así es determinista y es el mismo número que se guarda en Convex
// (convex/contrarreloj.ts). En línea lo cuenta el anfitrión, que es el que simula, y viaja en las fotos
// (red/paquetes.ts): el invitado no cuenta, copia.
//
// Sin cuenta (los dos en el mismo lugar) hay reloj pero no tabla: lo ganado y el mejor tiempo quedan en este
// navegador (`localStorage`).
import type { EntradaJugador } from "../entrada/mandos";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";

export interface Reloj {
  /** Pasos de carrera contados hasta ahora. */
  readonly pasos: number;
  /** Si la pareja ya llegó a la meta: el reloj está parado. */
  readonly llego: boolean;
  /** Un paso de físicas de la carrera: suma uno, salvo que ya hayan llegado. */
  pasar(): void;
  /** La pareja llegó a la meta: el reloj se para y avisa (una sola vez). */
  llegar(): void;
  /** Pone el reloj en lo que dice el anfitrión (la foto, o el mundo que devolvió el invitado). */
  fijar(pasos: number): void;
  /** Avisa al llegar a la meta con el tiempo final. Devuelve cómo dejar de avisar. */
  alLlegar(aviso: (pasos: number) => void): () => void;
}

export function crearReloj(): Reloj {
  let pasos = 0;
  let llego = false;
  const avisos = new Set<(pasos: number) => void>();
  return {
    get pasos() {
      return pasos;
    },
    get llego() {
      return llego;
    },
    pasar() {
      if (!llego) pasos++;
    },
    llegar() {
      if (llego) return;
      llego = true;
      for (const aviso of avisos) aviso(pasos);
    },
    fijar(nuevo) {
      if (Number.isInteger(nuevo) && nuevo >= 0) pasos = nuevo;
    },
    alLlegar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
}

/** Si con esa entrada el muñeco se mueve: el reloj arranca con el primer movimiento de cualquiera de los dos (no al
 * abrir la página, que en línea puede ser mientras el otro todavía entra). Señalar y los gestos no cuentan. */
export function seMueve(e: EntradaJugador): boolean {
  return e.avanzar !== 0 || e.girar !== 0 || e.saltar || e.brazoIzquierdo || e.brazoDerecho;
}

/** Pasos → «m:ss.cc» (minutos, segundos y centésimas). Las centésimas se truncan: 59,999 s es «0:59.99». */
export function formatearTiempo(pasos: number): string {
  const centesimas = Math.floor((Math.max(0, pasos) * 100) / PASOS_POR_SEGUNDO);
  const minutos = Math.floor(centesimas / 6000);
  const segundos = Math.floor(centesimas / 100) % 60;
  return `${minutos}:${String(segundos).padStart(2, "0")}.${String(centesimas % 100).padStart(2, "0")}`;
}

/** El número de un nivel según su carpeta de niveles/ («99-prueba» → 99), sin bajar el .glb. */
export function numeroDeCarpeta(carpeta: string): number {
  const numero = Number(carpeta.split("-")[0]);
  if (!Number.isInteger(numero)) throw new Error(`la carpeta «${carpeta}» no empieza con el número del nivel`);
  return numero;
}

// ── Sin cuenta: lo de este navegador ────────────────────────────────────────────────────────────────────────

const LLAVE = "tuerce.contrarreloj";

/** Lo que este navegador recuerda de cada nivel (por su nombre en la lista): si lo ganaron y el mejor tiempo. */
type Recuerdo = Record<string, { ganado?: boolean; mejor?: number }>;

function leerRecuerdo(): Recuerdo {
  try {
    const leido: unknown = JSON.parse(localStorage.getItem(LLAVE) ?? "{}");
    return typeof leido === "object" && leido !== null ? (leido as Recuerdo) : {};
  } catch {
    return {};
  }
}

function guardarRecuerdo(recuerdo: Recuerdo): void {
  try {
    localStorage.setItem(LLAVE, JSON.stringify(recuerdo));
  } catch {
    // Sin almacenamiento (ventana privada): se juega igual, sin recordar
  }
}

/** Los niveles que la pareja ganó jugando en este navegador. */
export function ganadosAqui(): string[] {
  return Object.entries(leerRecuerdo()).flatMap(([nivel, r]) => (r.ganado ? [nivel] : []));
}

export function marcarGanadoAqui(nivel: string): void {
  const recuerdo = leerRecuerdo();
  recuerdo[nivel] = { ...recuerdo[nivel], ganado: true };
  guardarRecuerdo(recuerdo);
}

/** Anota el tiempo si es el mejor de este navegador en ese nivel. Devuelve el mejor que queda. */
export function anotarTiempoAqui(nivel: string, pasos: number): number {
  const recuerdo = leerRecuerdo();
  const antes = recuerdo[nivel]?.mejor;
  const mejor = typeof antes === "number" && antes <= pasos ? antes : pasos;
  recuerdo[nivel] = { ...recuerdo[nivel], ganado: true, mejor };
  guardarRecuerdo(recuerdo);
  return mejor;
}
