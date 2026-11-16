import { describe, expect, it } from "vitest";
import { SUELOS } from "../imagen/suelos";
import { VESTIDO_COMUN, VESTIDOS, vestidoDe } from "./vestido";

describe("cómo se viste cada nivel", () => {
  it("los 17 niveles de la historia tienen su suelo", () => {
    for (let n = 0; n <= 16; n++) {
      expect(VESTIDOS[n], `nivel ${n}`).toBeDefined();
      expect(SUELOS).toContain(vestidoDe(n).suelo);
    }
  });

  it("cada lugar con lo suyo", () => {
    expect(vestidoDe(0).suelo).toBe("tierra");
    expect(vestidoDe(1)).toEqual({ suelo: "pinocha", abajo: "hojas", arriba: "pino" });
    expect(vestidoDe(7).suelo).toBe("empedrado");
    expect(vestidoDe(13)).toEqual({ suelo: "piedra", abajo: "piedras", arriba: null });
  });

  it("los de prueba llevan el común", () => {
    expect(vestidoDe(99)).toBe(VESTIDO_COMUN);
    expect(vestidoDe(98)).toBe(VESTIDO_COMUN);
  });
});
