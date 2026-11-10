// Reglas de color de la imagen: todo es gris salvo los dos pañuelos.
import { COLORES } from "../escenas/colores";

/** Por encima de esto un color ya se lee como color y no como gris. */
export const UMBRAL_SATURACION = 0.2;

/**
 * Cuánto color tiene un color 0xRRGGBB, de 0 (gris) a 1 (color puro): la distancia entre su canal más alto y el
 * más bajo. A diferencia de la saturación HSL, un blanco o un negro con un tinte mínimo da casi 0.
 */
export function saturacion(hex: number): number {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  return Math.max(r, g, b) - Math.min(r, g, b);
}

export const esSaturado = (hex: number) => saturacion(hex) > UMBRAL_SATURACION;

/** Nombres de la paleta que tienen color de verdad (deberían ser solo los dos pañuelos). */
export function coloresSaturados(paleta: Readonly<Record<string, number>> = COLORES): string[] {
  return Object.entries(paleta)
    .filter(([, hex]) => esSaturado(hex))
    .map(([nombre]) => nombre);
}

export type Panuelo = "rojo" | "turquesa";
export const COLOR_PANUELO: Record<Panuelo, number> = {
  rojo: COLORES.panueloRojo,
  turquesa: COLORES.panueloTurquesa,
};
