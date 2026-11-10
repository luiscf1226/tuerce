import { describe, expect, it } from "vitest";
import { leerTeclas } from "./teclado";

describe("teclado", () => {
  it("W camina y A gira a la izquierda", () => {
    expect(leerTeclas(["KeyW", "KeyA"])).toEqual({ avanzar: 1, girar: 1 });
  });
  it("las flechas hacen lo mismo y S/D van al revés", () => {
    expect(leerTeclas(["ArrowDown", "ArrowRight"])).toEqual({ avanzar: -1, girar: -1 });
  });
  it("W y ↑ juntas no pasan de 1; teclas opuestas se anulan", () => {
    expect(leerTeclas(["KeyW", "ArrowUp", "KeyA", "KeyD"])).toEqual({ avanzar: 1, girar: 0 });
  });
  it("las demás teclas no cuentan", () => {
    expect(leerTeclas(["Space", "KeyQ"])).toEqual({ avanzar: 0, girar: 0 });
  });
});
