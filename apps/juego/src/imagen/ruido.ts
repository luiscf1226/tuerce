// Azar y ruido deterministas para las texturas y para repartir árboles y piedras sin Math.random:
// la misma semilla da siempre la misma imagen, así las capturas salen iguales en cada corrida.

/** Generador de números de 0 a 1 (mulberry32). */
export function crearAzar(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un número de 0 a 1 fijo para cada celda entera (x, y). */
export function azarEn(x: number, y: number, semilla: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(semilla | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const suave = (t: number) => t * t * (3 - 2 * t);
const envolver = (n: number, periodo: number) => ((n % periodo) + periodo) % periodo;

/** Cada cuántas celdas se repite el ruido: un número para x e y, o `[x, y]` para ruido estirado. */
export type Periodo = number | readonly [number, number];

/** Ruido de valor que se repite cada `periodo` celdas: las texturas hechas con él no tienen costuras. */
export function ruidoPeriodico(x: number, y: number, periodo: Periodo, semilla: number): number {
  const [px, py] = typeof periodo === "number" ? [periodo, periodo] : periodo;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = suave(x - x0);
  const sy = suave(y - y0);
  const xa = envolver(x0, px);
  const xb = envolver(x0 + 1, px);
  const ya = envolver(y0, py);
  const yb = envolver(y0 + 1, py);
  const arriba = azarEn(xa, ya, semilla) + (azarEn(xb, ya, semilla) - azarEn(xa, ya, semilla)) * sx;
  const abajo = azarEn(xa, yb, semilla) + (azarEn(xb, yb, semilla) - azarEn(xa, yb, semilla)) * sx;
  return arriba + (abajo - arriba) * sy;
}

/** Varias capas de ruido periódico, cada una el doble de fina y la mitad de fuerte. Devuelve de 0 a 1. */
export function fbmPeriodico(x: number, y: number, periodo: Periodo, octavas: number, semilla: number): number {
  const [px, py] = typeof periodo === "number" ? [periodo, periodo] : periodo;
  let suma = 0;
  let total = 0;
  let fuerza = 1;
  let escala = 1;
  for (let o = 0; o < octavas; o++) {
    suma += fuerza * ruidoPeriodico(x * escala, y * escala, [px * escala, py * escala], semilla + o * 101);
    total += fuerza;
    fuerza *= 0.5;
    escala *= 2;
  }
  return suma / total;
}
