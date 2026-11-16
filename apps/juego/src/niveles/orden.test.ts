import { describe, expect, it } from "vitest";
import { NIVELES } from "./lista";
import { esElUltimo, HISTORIA, nivelDeLaHistoria, PRIMER_NIVEL, siguienteNivel } from "./orden";

describe("la historia", () => {
  it("tiene los 17 niveles en orden y cada uno existe en la lista, con su carpeta", () => {
    expect(HISTORIA.map((n) => n.numero)).toEqual([...Array(17).keys()]);
    for (const n of HISTORIA) {
      const datos = NIVELES[n.clave];
      expect(datos, n.clave).toBeDefined();
      expect(datos?.carpeta.startsWith(String(n.numero).padStart(2, "0"))).toBe(true);
    }
  });

  it("va del patio a la medianoche, sin los niveles de prueba", () => {
    expect(HISTORIA[0]?.clave).toBe(PRIMER_NIVEL);
    expect(siguienteNivel("patio")?.clave).toBe("pinar");
    expect(siguienteNivel("pampa")?.clave).toBe("medianoche");
    expect(siguienteNivel("medianoche")).toBeNull();
    expect(esElUltimo("medianoche")).toBe(true);
    expect(esElUltimo("pampa")).toBe(false);
    expect(siguienteNivel("prueba")).toBeNull();
    expect(nivelDeLaHistoria("piezas")).toBeUndefined();
  });
});
