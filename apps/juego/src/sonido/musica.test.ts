// La música del menú: siempre la misma para el mismo compás, dentro de la escala y sin llenar cada corchea.
import { describe, expect, it } from "vitest";
import { colchonDelCompas, notasDelCompas } from "./musica";

describe("música del menú", () => {
  it("el mismo compás da las mismas notas, y vuelve cada 16", () => {
    expect(notasDelCompas(5)).toEqual(notasDelCompas(5));
    expect(notasDelCompas(3)).toEqual(notasDelCompas(19));
  });

  it("las notas caen dentro del compás, en registro de marimba, y deja silencios", () => {
    let todas = 0;
    for (let n = 0; n < 16; n++) {
      const notas = notasDelCompas(n);
      todas += notas.length;
      for (const nota of notas) {
        expect(nota.corchea).toBeGreaterThanOrEqual(0);
        expect(nota.corchea).toBeLessThan(8);
        expect(nota.frecuencia).toBeGreaterThan(200);
        expect(nota.frecuencia).toBeLessThan(700);
      }
    }
    expect(todas).toBeGreaterThan(16);
    expect(todas).toBeLessThan(16 * 8 * 0.7);
  });

  it("el colchón es una quinta grave", () => {
    const [raiz, quinta] = colchonDelCompas(0);
    expect(quinta / raiz).toBeCloseTo(1.5);
    expect(raiz).toBeLessThan(220);
  });
});
