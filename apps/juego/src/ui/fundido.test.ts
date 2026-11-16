// El fundido en niebla (TU-62): las curvas, en pasos de físicas.
import { describe, expect, it } from "vitest";
import {
  CAIDA,
  CAYENDO,
  FUNDIDO_ENTRADA,
  FUNDIDO_REAPARECER,
  fundidoDeCaida,
  fundidoDeEntrada,
  fundidoTrasReaparecer,
  nieblaDeLasVistas,
  PICO,
  SUAVE,
} from "./fundido";

describe("el fundido", () => {
  it("al abrir el nivel la escena sale de la niebla antes del primer segundo", () => {
    expect(fundidoDeEntrada(0)).toBe(1);
    expect(fundidoDeEntrada(FUNDIDO_ENTRADA / 2)).toBeCloseTo(0.5);
    expect(fundidoDeEntrada(FUNDIDO_ENTRADA)).toBe(0);
    expect(FUNDIDO_ENTRADA).toBeLessThan(60);
  });

  it("al caer, la niebla sube al acercarse al vacío; parado o subiendo no hay niebla", () => {
    const vacio = -5;
    expect(fundidoDeCaida(vacio + CAIDA + 1, vacio, -6)).toBe(0);
    expect(fundidoDeCaida(vacio + CAIDA / 2, vacio, -6)).toBeCloseTo(PICO / 2);
    expect(fundidoDeCaida(vacio, vacio, -6)).toBeCloseTo(PICO);
    expect(fundidoDeCaida(vacio, vacio, 0)).toBe(0);
    expect(fundidoDeCaida(vacio, vacio, -CAYENDO / 2)).toBe(0);
  });

  it("al reaparecer empieza espesa y se levanta", () => {
    expect(fundidoTrasReaparecer(0)).toBeCloseTo(PICO);
    expect(fundidoTrasReaparecer(FUNDIDO_REAPARECER)).toBe(0);
    expect(fundidoTrasReaparecer(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("con la pantalla partida, cada uno en su mitad; entera, más suave para los dos", () => {
    expect(nieblaDeLasVistas(0.8, 0, 1)).toEqual([0.8, 0]);
    expect(nieblaDeLasVistas(0, 0.8, 1)).toEqual([0, 0.8]);
    const [rojo, turquesa] = nieblaDeLasVistas(0.8, 0, 0);
    expect(rojo).toBeCloseTo(0.8 * SUAVE);
    expect(turquesa).toBeCloseTo(0.8 * SUAVE);
    // Entre medio, de una a otra sin saltos
    const [medio] = nieblaDeLasVistas(0.8, 0, 0.5);
    expect(medio).toBeGreaterThan(0.8 * SUAVE);
    expect(medio).toBeLessThan(0.8);
  });

  it("la entrada tapa las dos vistas", () => {
    expect(nieblaDeLasVistas(0, 0, 1, 1)).toEqual([1, 1]);
    expect(nieblaDeLasVistas(0, 0.2, 0, 0.6)).toEqual([0.6, 0.6]);
  });
});
