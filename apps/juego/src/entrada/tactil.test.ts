import { describe, expect, it } from "vitest";
import { ejesDePalanca, hayPantallaTactil, RADIO_PALANCA, ZONA_MUERTA_TACTIL } from "./tactil";

describe("la palanca táctil", () => {
  it("cerca del centro no pide nada", () => {
    expect(ejesDePalanca(0, 0)).toEqual({ avanzar: 0, girar: 0 });
    expect(ejesDePalanca(RADIO_PALANCA * ZONA_MUERTA_TACTIL * 0.9, 0)).toEqual({ avanzar: 0, girar: 0 });
  });

  it("arriba avanza, abajo retrocede, a la izquierda gira a la izquierda", () => {
    expect(ejesDePalanca(0, -RADIO_PALANCA)).toEqual({ avanzar: 1, girar: 0 });
    expect(ejesDePalanca(0, RADIO_PALANCA)).toEqual({ avanzar: -1, girar: 0 });
    expect(ejesDePalanca(-RADIO_PALANCA, 0)).toEqual({ avanzar: 0, girar: 1 });
    expect(ejesDePalanca(RADIO_PALANCA, 0)).toEqual({ avanzar: 0, girar: -1 });
  });

  it("pasado el tope no pide más, y a mitad de camino pide menos", () => {
    expect(ejesDePalanca(0, -RADIO_PALANCA * 3).avanzar).toBe(1);
    const mitad = ejesDePalanca(0, -RADIO_PALANCA / 2).avanzar;
    expect(mitad).toBeGreaterThan(0.2);
    expect(mitad).toBeLessThan(0.6);
  });

  it("`?tactil` los pone y `?tactil=0` los saca; sin ventana, no", () => {
    expect(hayPantallaTactil(new URLSearchParams("tactil"))).toBe(true);
    expect(hayPantallaTactil(new URLSearchParams("tactil=0"))).toBe(false);
    expect(hayPantallaTactil(new URLSearchParams(""))).toBe(false);
  });
});
