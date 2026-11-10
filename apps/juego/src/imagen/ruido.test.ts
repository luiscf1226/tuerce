import { describe, expect, it } from "vitest";
import { azarEn, crearAzar, fbmPeriodico, ruidoPeriodico } from "./ruido";

describe("azar y ruido", () => {
  it("la misma semilla da la misma secuencia, siempre entre 0 y 1", () => {
    const a = crearAzar(42);
    const b = crearAzar(42);
    for (let i = 0; i < 1000; i++) {
      const n = a();
      expect(n).toBe(b());
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
    expect(crearAzar(1)()).not.toBe(crearAzar(2)());
  });

  it("azarEn es fijo por celda", () => {
    expect(azarEn(3, 7, 1)).toBe(azarEn(3, 7, 1));
    expect(azarEn(3, 7, 1)).not.toBe(azarEn(7, 3, 1));
  });

  it("el ruido periódico se repite cada `periodo` celdas (texturas sin costuras)", () => {
    for (const [x, y] of [
      [0.3, 0.7],
      [2.5, 1.25],
      [3.9, 3.1],
    ] as const) {
      expect(ruidoPeriodico(x + 4, y, 4, 9)).toBeCloseTo(ruidoPeriodico(x, y, 4, 9), 10);
      expect(ruidoPeriodico(x, y + 4, 4, 9)).toBeCloseTo(ruidoPeriodico(x, y, 4, 9), 10);
      expect(ruidoPeriodico(x + 3, y + 8, [3, 8], 9)).toBeCloseTo(ruidoPeriodico(x, y, [3, 8], 9), 10);
      expect(fbmPeriodico(x + 5, y, 5, 4, 2)).toBeCloseTo(fbmPeriodico(x, y, 5, 4, 2), 10);
    }
  });

  it("el fbm queda entre 0 y 1", () => {
    for (let i = 0; i < 200; i++) {
      const n = fbmPeriodico(i * 0.173, i * 0.071, 8, 5, 3);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
  });
});
