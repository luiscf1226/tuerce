import { describe, expect, it } from "vitest";
import { ALCANCE_SOMBRA, degradeDeSombra, sombraSegunAltura } from "./sombras";

describe("la sombra de contacto", () => {
  it("en el suelo es entera y oscura", () => {
    expect(sombraSegunAltura(0)).toEqual({ escala: 1, opacidad: 1 });
  });

  it("se achica y se aclara al subir", () => {
    let antes = sombraSegunAltura(0);
    for (let altura = 0.25; altura <= ALCANCE_SOMBRA; altura += 0.25) {
      const ahora = sombraSegunAltura(altura);
      expect(ahora.escala).toBeLessThan(antes.escala);
      expect(ahora.opacidad).toBeLessThan(antes.opacidad);
      antes = ahora;
    }
  });

  it("desde el alcance ya no se ve, y por debajo del suelo cuenta como en el suelo", () => {
    expect(sombraSegunAltura(ALCANCE_SOMBRA).opacidad).toBe(0);
    expect(sombraSegunAltura(10).opacidad).toBe(0);
    expect(sombraSegunAltura(-0.2)).toEqual(sombraSegunAltura(0));
  });

  it("el degradé es denso al centro y sin borde", () => {
    const l = degradeDeSombra(64);
    const alfa = (x: number, y: number) => l.datos[(y * 64 + x) * 4 + 3] ?? -1;
    expect(alfa(32, 32)).toBeGreaterThan(240);
    expect(alfa(0, 32)).toBeLessThan(3);
    expect(alfa(0, 0)).toBe(0);
    expect(alfa(48, 32)).toBeLessThan(alfa(40, 32));
  });
});
