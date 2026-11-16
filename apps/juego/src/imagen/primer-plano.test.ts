import { describe, expect, it } from "vitest";
import {
  ANCHO_VUELTA,
  altoSegunLugar,
  apagarBordes,
  desenfocar,
  follaje,
  lugarEnPantalla,
  METROS_POR_VUELTA,
  repartirPlantas,
} from "./primer-plano";
import { nuevaLamina } from "./texturas";

describe("el primer plano", () => {
  it("las plantas dan la vuelta dentro del ancho y se corren al revés que la cámara", () => {
    for (let x = -30; x <= 30; x += 0.7) {
      const p = lugarEnPantalla(0.3, x);
      expect(p).toBeGreaterThanOrEqual(-ANCHO_VUELTA);
      expect(p).toBeLessThan(ANCHO_VUELTA);
    }
    expect(lugarEnPantalla(0.5, 0.5)).toBeLessThan(lugarEnPantalla(0.5, 0));
    expect(lugarEnPantalla(0.4, METROS_POR_VUELTA)).toBeCloseTo(lugarEnPantalla(0.4, 0));
  });

  it("son altas en las orillas y apenas asoman en el centro, donde andan los muñecos", () => {
    expect(altoSegunLugar(0, 0.2)).toBeCloseTo(0.2);
    expect(altoSegunLugar(1, 0.2)).toBeCloseTo(1);
    expect(altoSegunLugar(-1.2, 0.2)).toBeCloseTo(1);
    expect(altoSegunLugar(0.5, 0.2)).toBeGreaterThan(0.2);
    expect(altoSegunLugar(0.5, 0.2)).toBeLessThan(1);
  });

  it("se reparten igual con la misma semilla", () => {
    const opciones = { abajo: "hojas", arriba: "pino", semilla: 4 } as const;
    expect(repartirPlantas(opciones)).toEqual(repartirPlantas(opciones));
    expect(repartirPlantas({ abajo: null, arriba: null })).toEqual([]);
    const plantas = repartirPlantas(opciones);
    expect(plantas.filter((p) => p.borde === "abajo").length).toBeGreaterThan(0);
    expect(plantas.filter((p) => p.borde === "arriba").length).toBeGreaterThan(0);
  });

  it("el desenfoque reparte el alfa sin perderlo y sin tocar el color", () => {
    const l = nuevaLamina(16, 16);
    l.datos.fill(255);
    for (let i = 3; i < l.datos.length; i += 4) l.datos[i] = 0;
    l.datos[(8 * 16 + 8) * 4 + 3] = 255;
    const borrosa = desenfocar(l, 1);
    const alfa = (x: number, y: number) => borrosa.datos[(y * 16 + x) * 4 + 3] ?? 0;
    expect(alfa(8, 8)).toBeLessThan(255);
    expect(alfa(9, 8)).toBeGreaterThan(0);
    expect(alfa(0, 0)).toBe(0);
    expect(borrosa.datos[0]).toBe(255);
  });

  it("los bordes de la textura quedan apagados, menos el de donde nace la planta", () => {
    const l = apagarBordes(follaje(64, 3), 0.15, "abajo");
    const alfa = (x: number, y: number) => l.datos[(y * 64 + x) * 4 + 3] ?? 0;
    for (let y = 0; y < 64; y++) {
      expect(alfa(0, y)).toBe(0);
      expect(alfa(63, y)).toBe(0);
    }
    for (let x = 0; x < 64; x++) expect(alfa(x, 63)).toBe(0);
    // abajo al centro, donde nace, queda tupida
    expect(alfa(32, 1)).toBeGreaterThan(200);
  });
});
