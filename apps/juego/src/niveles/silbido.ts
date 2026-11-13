// El silbido del Silbón (TU-44), la cuenta sola: qué volumen y qué paneo le toca a cada jugador. Es una función pura,
// sin audio, para que se pruebe en Node; el audio (silbido-audio.ts) y las ondas que se ven (silbon.ts) solo la leen.
//
// El Silbón silba al revés: si suena cerca, está lejos; si suena lejos, está cerca. El volumen crece con la
// distancia (bajito al lado de él, fuerte de lejos) y el paneo también va al revés: el silbido viene del lado
// contrario al que está. Así, el que camina hacia donde suena más fuerte se aleja, y el que entiende el truco va
// hacia donde suena bajito, del otro lado.

/** Un punto en el mundo. */
export interface Punto {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Lo que le toca a un jugador: el volumen (de 0 a 1) y el paneo (de −1, todo a la izquierda, a 1, a la derecha). */
export interface Silbido {
  readonly volumen: number;
  readonly paneo: number;
}

export const AJUSTES_SILBIDO = {
  /** Más cerca que esto (m, de costado), el silbido suena lo más bajito: `minimo`. */
  cerca: 1.5,
  /** Más lejos que esto, suena con todo. */
  lejos: 18,
  minimo: 0.06,
  /** A esta distancia de costado (m, a lo largo de x: la pantalla) el paneo ya es del todo de un lado. */
  ancho: 6,
} as const;

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** El silbido que oye el que está en `oyente` con el Silbón en `silbon`. La pantalla mira hacia −z, así que la
 * derecha es +x: el paneo va al revés de hacia dónde queda el Silbón en x. */
export function silbido(silbon: Punto, oyente: Punto, ajustes: typeof AJUSTES_SILBIDO = AJUSTES_SILBIDO): Silbido {
  const dx = silbon.x - oyente.x;
  const dz = silbon.z - oyente.z;
  const d = Math.hypot(dx, dz);
  const t = limitar((d - ajustes.cerca) / (ajustes.lejos - ajustes.cerca), 0, 1);
  // Suave en las puntas, para que acercarse se note de a poco
  const subida = t * t * (3 - 2 * t);
  const volumen = ajustes.minimo + (1 - ajustes.minimo) * subida;
  const paneo = -limitar(dx / ajustes.ancho, -1, 1);
  return { volumen, paneo: paneo === 0 ? 0 : paneo };
}

/** Lo que oye cada jugador; si el Silbón no silba (ya lo hallaron), nada. */
export function silbidos(silbon: Punto | null, oyentes: readonly Punto[]): readonly Silbido[] {
  return oyentes.map((o) => (silbon ? silbido(silbon, o) : { volumen: 0, paneo: 0 }));
}

/** Las notas del silbido: sube por la escala (do re mi fa sol la si) y vuelve a empezar después de un silencio. En
 * hercios, cada una de `NOTA` segundos. */
export const ESCALA = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77] as const;
export const NOTA = 0.32;
export const SILENCIO = 1.1;

/** La nota que suena a los `t` segundos (o `null` en el silencio), y qué tanto va de ella (de 0 a 1). */
export function notaEn(t: number): { frecuencia: number; dentro: number } | null {
  const vuelta = ESCALA.length * NOTA + SILENCIO;
  const r = ((t % vuelta) + vuelta) % vuelta;
  const i = Math.floor(r / NOTA);
  const frecuencia = ESCALA[i];
  if (frecuencia === undefined) return null;
  return { frecuencia, dentro: (r - i * NOTA) / NOTA };
}
