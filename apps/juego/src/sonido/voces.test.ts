// El límite de voces: no más de MAX a la vez y el mismo sonido no se repite antes de su separación.
import { describe, expect, it } from "vitest";
import { crearLimite, MAX_VOCES } from "./voces";

describe("límite de voces", () => {
  it("el mismo sonido no suena 60 veces por segundo: en un segundo de pedidos por paso, a lo más 1/separación", () => {
    const limite = crearLimite();
    let sonaron = 0;
    for (let paso = 0; paso < 60; paso++) if (limite.pedir("pieza:madera", paso / 60, 0.15, 0.07)) sonaron++;
    expect(sonaron).toBeGreaterThan(1);
    expect(sonaron).toBeLessThanOrEqual(Math.ceil(1 / 0.07));
  });

  it("sonidos distintos sí suenan juntos, hasta el máximo de voces", () => {
    const limite = crearLimite(4);
    const dejados = ["a", "b", "c", "d", "e", "f"].map((clave) => limite.pedir(clave, 0, 1, 0.1));
    expect(dejados).toEqual([true, true, true, true, false, false]);
    expect(limite.sonando(0.5)).toBe(4);
  });

  it("al terminar una voz se libera su lugar", () => {
    const limite = crearLimite(2);
    expect(limite.pedir("a", 0, 0.2, 0)).toBe(true);
    expect(limite.pedir("b", 0, 1, 0)).toBe(true);
    expect(limite.pedir("c", 0.1, 0.2, 0)).toBe(false);
    expect(limite.pedir("c", 0.25, 0.2, 0)).toBe(true);
    expect(limite.sonando(0.25)).toBe(2);
  });

  it("por omisión deja sonar MAX_VOCES a la vez", () => {
    const limite = crearLimite();
    for (let i = 0; i < MAX_VOCES + 3; i++) limite.pedir(`v${i}`, 0, 1, 0);
    expect(limite.sonando(0)).toBe(MAX_VOCES);
  });
});
