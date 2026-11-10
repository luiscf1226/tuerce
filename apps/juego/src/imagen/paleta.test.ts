import { describe, expect, it } from "vitest";
import { COLORES } from "../escenas/colores";
import { COLOR_PANUELO, coloresSaturados, esSaturado, saturacion } from "./paleta";

describe("paleta", () => {
  it("los grises no tienen saturación y los colores puros tienen toda", () => {
    expect(saturacion(0x000000)).toBe(0);
    expect(saturacion(0x808080)).toBe(0);
    expect(saturacion(0xffffff)).toBe(0);
    expect(saturacion(0xff0000)).toBeCloseTo(1);
    expect(saturacion(0x00ffff)).toBeCloseTo(1);
  });

  it("los únicos colores saturados son los dos pañuelos", () => {
    expect(coloresSaturados(COLORES).sort()).toEqual(["panueloRojo", "panueloTurquesa"]);
  });

  it("los tintes leves de la niebla y las siluetas siguen siendo grises", () => {
    for (const [nombre, hex] of Object.entries(COLORES)) {
      if (nombre.startsWith("panuelo")) continue;
      expect(saturacion(hex), nombre).toBeLessThan(0.05);
    }
  });

  it("cada pañuelo tiene su color y los dos se leen como color", () => {
    expect(COLOR_PANUELO.rojo).toBe(COLORES.panueloRojo);
    expect(COLOR_PANUELO.turquesa).toBe(COLORES.panueloTurquesa);
    expect(esSaturado(COLOR_PANUELO.rojo)).toBe(true);
    expect(esSaturado(COLOR_PANUELO.turquesa)).toBe(true);
  });
});
