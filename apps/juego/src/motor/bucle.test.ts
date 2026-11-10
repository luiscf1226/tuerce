import { describe, expect, it } from "vitest";
import { crearBucle, PASO, PASOS_POR_SEGUNDO } from "./bucle";

describe("bucle de paso fijo", () => {
  it("corre 60 pasos por cada segundo, con cuadros parejos", () => {
    let pasos = 0;
    const bucle = crearBucle(() => pasos++);
    for (let i = 0; i < 60; i++) bucle.avanzar(1 / 60);
    expect(pasos).toBe(PASOS_POR_SEGUNDO);
  });

  it("corre 60 pasos por segundo aunque la pantalla vaya a 144 o a 30 cuadros", () => {
    for (const cuadros of [144, 30, 75]) {
      let pasos = 0;
      const bucle = crearBucle(() => pasos++);
      for (let i = 0; i < cuadros * 3; i++) bucle.avanzar(1 / cuadros);
      expect(pasos).toBe(PASOS_POR_SEGUNDO * 3);
    }
  });

  it("guarda el tiempo que sobra y lo entrega como alfa", () => {
    const bucle = crearBucle(() => {});
    expect(bucle.avanzar(PASO * 1.5)).toBe(1);
    expect(bucle.alfa).toBeCloseTo(0.5);
  });

  it("no intenta ponerse al día después de un congelón", () => {
    let pasos = 0;
    const bucle = crearBucle(() => pasos++);
    bucle.avanzar(10);
    expect(pasos).toBe(5);
    expect(bucle.pasosTotales).toBe(5);
  });

  it("ignora tiempos negativos", () => {
    const bucle = crearBucle(() => {});
    expect(bucle.avanzar(-1)).toBe(0);
    expect(bucle.alfa).toBe(0);
  });
});
