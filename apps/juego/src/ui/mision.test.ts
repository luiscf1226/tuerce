import { describe, expect, it } from "vitest";
import { cejaDeLecciones, controlesEnUnaLinea, estadoDeFila } from "./mision";

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

  it("la ayuda resume los controles de cada uno en una línea", () => {
    const lineas = controlesEnUnaLinea();
    expect(lineas.map((l) => l.quien)).toEqual(["Rojo", "Turquesa", "Mando"]);
    expect(lineas[0]?.linea).toBe("W S caminar · A D girar · Espacio saltar · Q E brazos");
    expect(lineas[1]?.linea).toContain("Enter saltar");
  });

  it("en línea, una sola línea de teclado con los dos lados: los dos manejan el muñeco propio", () => {
    const lineas = controlesEnUnaLinea(true);
    expect(lineas.map((l) => l.quien)).toEqual(["Teclado", "Mando"]);
    expect(lineas[0]?.linea).toContain("Espacio / Enter saltar");
  });
});
