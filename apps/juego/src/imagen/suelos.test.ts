import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { COSTADO, costadoDe, DATOS_DE_SUELO, luzDeCara, pintarSuelo, SUELOS, uvDelMundo } from "./suelos";

describe("los suelos", () => {
  it("cada suelo sale igual con la misma semilla y en grises", () => {
    for (const cual of SUELOS) {
      const a = pintarSuelo(cual, 32, 7);
      const b = pintarSuelo(cual, 32, 7);
      expect(a.color.datos).toEqual(b.color.datos);
      expect(a.relieve.datos).toEqual(b.relieve.datos);
      const d = a.color.datos;
      for (let i = 0; i < d.length; i += 4) {
        expect(d[i]).toBe(d[i + 1]);
        expect(d[i]).toBe(d[i + 2]);
        expect(d[i + 3]).toBe(255);
      }
    }
  });

  it("no son lisos: hay tonos distintos, y la piedra de la mina es más oscura que la arena", () => {
    for (const cual of SUELOS) {
      const d = pintarSuelo(cual, 64).color.datos;
      let min = 255;
      let max = 0;
      for (let i = 0; i < d.length; i += 4) {
        min = Math.min(min, d[i] ?? 0);
        max = Math.max(max, d[i] ?? 0);
      }
      expect(max - min, cual).toBeGreaterThan(40);
    }
    expect(DATOS_DE_SUELO.piedra.tono).toBeLessThan(DATOS_DE_SUELO.arena.tono);
  });

  it("los costados son tierra cortada, salvo la roca y la piedra labrada", () => {
    expect(costadoDe("pinocha")).toBe("corte");
    expect(costadoDe("piedra")).toBe("piedra");
    expect(costadoDe("sillar")).toBe("sillar");
  });

  it("arriba la luz entera, los costados más oscuros y abajo más todavía", () => {
    expect(luzDeCara(1)).toBeCloseTo(1);
    expect(luzDeCara(0)).toBeCloseTo(COSTADO);
    expect(luzDeCara(-1)).toBeLessThan(COSTADO);
  });

  it("las coordenadas van en metros del mundo, primero las caras de arriba", () => {
    const caja = new THREE.BoxGeometry(2, 1, 2);
    const matriz = new THREE.Matrix4().makeTranslation(10, 0, 4);
    const g = uvDelMundo(caja, matriz, 2);
    const uv = g.getAttribute("uv");
    const pos = g.getAttribute("position");
    const color = g.getAttribute("color");
    expect(g.groups).toEqual([
      { start: 0, count: 6, materialIndex: 0 },
      { start: 6, count: 30, materialIndex: 1 },
    ]);
    // las caras de arriba: u = x/2, v = -z/2 en el mundo
    for (let i = 0; i < 6; i++) {
      expect(pos.getY(i)).toBeCloseTo(0.5);
      expect(uv.getX(i)).toBeCloseTo((pos.getX(i) + 10) / 2);
      expect(uv.getY(i)).toBeCloseTo(-(pos.getZ(i) + 4) / 2);
      expect(color.getX(i)).toBeCloseTo(1);
    }
    for (let i = 6; i < 36; i++) expect(color.getX(i)).toBeLessThanOrEqual(COSTADO + 1e-6);
  });
});
