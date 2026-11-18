// Los efectos de sonido: cortos, suaves y sintetizados con Web Audio (sin archivos), para que se sienta lo que pasa:
// juntar algo de la misión, cumplir un objetivo, agarrar con una mano, ganar un nivel y apretar un botón del menú.
// Como el silbido (niveles/silbido-audio.ts): donde no hay Web Audio (Node, las pruebas) no hace nada, y el navegador
// no deja sonar nada hasta el primer toque o la primera tecla.
//
// Se apagan con el botón «Sonido» del menú; queda anotado en este navegador.

export type Efecto = "juntar" | "cumplido" | "agarrar" | "ganado" | "toque";

/** Una nota: cuándo empieza (s, desde que suena el efecto), cuánto dura (s), su frecuencia (Hz) y su forma. */
export interface Nota {
  readonly desde: number;
  readonly dura: number;
  readonly hz: number;
  readonly forma: OscillatorType;
  /** Volumen de 0 a 1 (antes del volumen general). */
  readonly fuerte: number;
  /** Si la nota baja (o sube) hasta esta frecuencia mientras suena. */
  readonly hastaHz?: number;
}

// Notas de una pentatónica de do (suena a feria, nunca desafina con el silbido)
const DO = 523.25;
const RE = 587.33;
const MI = 659.25;
const SOL = 783.99;
const LA = 880;
const DO2 = 1046.5;

/** Cómo suena cada efecto. */
export const EFECTOS: Readonly<Record<Efecto, readonly Nota[]>> = {
  // Dos notas que suben, como una moneda de madera
  juntar: [
    { desde: 0, dura: 0.09, hz: MI, forma: "triangle", fuerte: 0.7 },
    { desde: 0.07, dura: 0.16, hz: LA, forma: "triangle", fuerte: 0.7 },
  ],
  // Tres notas: ¡bien!
  cumplido: [
    { desde: 0, dura: 0.12, hz: DO, forma: "triangle", fuerte: 0.6 },
    { desde: 0.1, dura: 0.12, hz: MI, forma: "triangle", fuerte: 0.6 },
    { desde: 0.2, dura: 0.3, hz: SOL, forma: "triangle", fuerte: 0.7 },
  ],
  // Un golpecito sordo, de trapo
  agarrar: [{ desde: 0, dura: 0.07, hz: 220, hastaHz: 120, forma: "sine", fuerte: 0.55 }],
  // La tonada del final: cinco notas que suben y la última larga
  ganado: [
    { desde: 0, dura: 0.14, hz: DO, forma: "triangle", fuerte: 0.6 },
    { desde: 0.13, dura: 0.14, hz: RE, forma: "triangle", fuerte: 0.6 },
    { desde: 0.26, dura: 0.14, hz: MI, forma: "triangle", fuerte: 0.6 },
    { desde: 0.39, dura: 0.14, hz: SOL, forma: "triangle", fuerte: 0.65 },
    { desde: 0.52, dura: 0.6, hz: DO2, forma: "triangle", fuerte: 0.7 },
  ],
  // Un clic chiquito
  toque: [{ desde: 0, dura: 0.035, hz: 1400, hastaHz: 900, forma: "sine", fuerte: 0.35 }],
};

/** El volumen general: los efectos acompañan, no tapan. */
export const VOLUMEN = 0.12;
/** Cuánto (s) tarda en subir y en apagarse cada nota, para que no chasquee. */
const ATAQUE = 0.008;

/** Cuánto dura un efecto entero (s). */
export function duracionDe(efecto: Efecto): number {
  return Math.max(...EFECTOS[efecto].map((n) => n.desde + n.dura));
}

// ── Prendido o apagado, anotado en este navegador ──────────────────────────────────────────────────────────

export const CLAVE_SONIDO = "tuerce-sonido";
type Guardado = Pick<Storage, "getItem" | "setItem">;

function guardado(): Guardado | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Si los efectos suenan (por omisión, sí). */
export function sonidoPrendido(almacen: Guardado | undefined = guardado()): boolean {
  try {
    return almacen?.getItem(CLAVE_SONIDO) !== "no";
  } catch {
    return true;
  }
}

export function prenderSonido(prendido: boolean, almacen: Guardado | undefined = guardado()): void {
  try {
    almacen?.setItem(CLAVE_SONIDO, prendido ? "si" : "no");
  } catch {
    // Sin almacenamiento (ventana privada): vale solo por ahora
  }
  apagadoAhora = !prendido;
}

let apagadoAhora: boolean | undefined;

// ── El audio ───────────────────────────────────────────────────────────────────────────────────────────────

let contexto: AudioContext | null | undefined;
/** Para no amontonar: la última vez (s del contexto) que sonó cada efecto. */
const ultimaVez = new Map<Efecto, number>();
/** Lo mínimo (s) entre dos veces el mismo efecto. */
const ENTRE_VECES = 0.06;

function elContexto(): AudioContext | null {
  if (contexto !== undefined) return contexto;
  const Contexto = typeof window === "undefined" ? undefined : window.AudioContext;
  if (!Contexto) return (contexto = null);
  try {
    contexto = new Contexto();
  } catch {
    return (contexto = null);
  }
  // El navegador lo deja mudo hasta que alguien toca algo
  const despertar = () => {
    void contexto?.resume().catch(() => {});
  };
  for (const evento of ["pointerdown", "keydown"] as const) window.addEventListener(evento, despertar);
  return contexto;
}

/** Suena un efecto (si hay audio y el sonido está prendido). */
export function sonar(efecto: Efecto): void {
  if (apagadoAhora ?? !sonidoPrendido()) {
    apagadoAhora = true;
    return;
  }
  apagadoAhora = false;
  const ctx = elContexto();
  if (!ctx || ctx.state !== "running") return;
  const ahora = ctx.currentTime;
  if (ahora - (ultimaVez.get(efecto) ?? -1) < ENTRE_VECES) return;
  ultimaVez.set(efecto, ahora);
  for (const nota of EFECTOS[efecto]) {
    const empieza = ahora + nota.desde;
    const termina = empieza + nota.dura;
    const oscilador = ctx.createOscillator();
    oscilador.type = nota.forma;
    oscilador.frequency.setValueAtTime(nota.hz, empieza);
    if (nota.hastaHz) oscilador.frequency.exponentialRampToValueAtTime(nota.hastaHz, termina);
    const volumen = ctx.createGain();
    volumen.gain.setValueAtTime(0, empieza);
    volumen.gain.linearRampToValueAtTime(nota.fuerte * VOLUMEN, empieza + ATAQUE);
    volumen.gain.exponentialRampToValueAtTime(0.0001, termina);
    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(empieza);
    oscilador.stop(termina + 0.02);
  }
}
