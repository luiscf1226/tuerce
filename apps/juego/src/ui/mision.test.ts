import { describe, expect, it } from "vitest";
import { cejaDeLecciones, estadoDeFila } from "./mision";

describe("la hoja de la misión", () => {
  it("la ceja dice qué lección va, y al final que están listos", () => {
    expect(cejaDeLecciones("Cómo jugar", { actual: 2, obligatorios: 6 })).toBe("Cómo jugar · 3 de 6");
    expect(cejaDeLecciones("Cómo jugar", { actual: 6, obligatorios: 6 })).toBe("Cómo jugar · ¡listos!");
  });

  it("cada fila: hecha, de turno o pendiente", () => {
    expect(estadoDeFila({ hecho: true }, 0, 1)).toBe("hecho");
    expect(estadoDeFila({ hecho: false }, 1, 1)).toBe("turno");
    expect(estadoDeFila({ hecho: false }, 2, 1)).toBe("pendiente");
  });
});
