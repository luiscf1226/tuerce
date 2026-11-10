import { describe, expect, it } from "vitest";
import { leerTeclas } from "./teclado";

const SUELTOS = { saltar: false, brazoIzquierdo: false, brazoDerecho: false };

describe("teclado", () => {
  it("W camina y A gira a la izquierda", () => {
    expect(leerTeclas(["KeyW", "KeyA"])).toEqual({ avanzar: 1, girar: 1, ...SUELTOS });
  });
  it("las flechas hacen lo mismo y S/D van al revés", () => {
    expect(leerTeclas(["ArrowDown", "ArrowRight"])).toEqual({ avanzar: -1, girar: -1, ...SUELTOS });
  });
  it("W y ↑ juntas no pasan de 1; teclas opuestas se anulan", () => {
    expect(leerTeclas(["KeyW", "ArrowUp", "KeyA", "KeyD"])).toEqual({ avanzar: 1, girar: 0, ...SUELTOS });
  });
  it("Espacio salta, Q sube el brazo izquierdo y E el derecho", () => {
    expect(leerTeclas(["Space", "KeyQ"])).toEqual({
      ...SUELTOS,
      avanzar: 0,
      girar: 0,
      saltar: true,
      brazoIzquierdo: true,
    });
    expect(leerTeclas(["KeyE"]).brazoDerecho).toBe(true);
  });
  it("las demás teclas no cuentan", () => {
    expect(leerTeclas(["KeyZ", "Enter"])).toEqual({ avanzar: 0, girar: 0, ...SUELTOS });
  });
});
