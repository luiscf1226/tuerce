// Qué sonido toca cada evento: cada uno tiene su receta, los pasos suenan distinto en cada suelo y nada se repite
// más seguido de lo que pide su separación.
import { describe, expect, it } from "vitest";
import { duracion, PIEZAS, PISADAS, sonidoDe } from "./efectos";
import { type EventoSonido, SUELOS, type VozDePieza } from "./eventos";

const EVENTOS: EventoSonido[] = [
  { cual: "paso", jugador: 0, suelo: "tierra", fuerza: 0.5, x: 0 },
  { cual: "salto", jugador: 0, fuerza: 0.5, x: 0 },
  { cual: "aterrizar", jugador: 1, suelo: "madera", fuerza: 0.5, x: 0 },
  { cual: "caer", jugador: 0, fuerza: 0.5, x: 0 },
  { cual: "golpe", jugador: 0, fuerza: 0.5, x: 0 },
  { cual: "agarrar", jugador: 1, fuerza: 0.5, x: 0 },
  { cual: "soltar", jugador: 1, fuerza: 0.5, x: 0 },
  { cual: "chapoteo", jugador: 0, fuerza: 0.5, x: 0 },
  ...(Object.keys(PIEZAS) as VozDePieza[]).map((voz): EventoSonido => ({ cual: "pieza", voz, fuerza: 0.5, x: 0 })),
];

describe("efectos", () => {
  it("cada evento tiene una receta que suena, con volumen de 0 a 1 y una clave propia", () => {
    const claves = new Set<string>();
    for (const e of EVENTOS) {
      const r = sonidoDe(e);
      expect(r.capas.length, e.cual).toBeGreaterThan(0);
      expect(duracion(r), e.cual).toBeGreaterThan(0);
      expect(r.volumen, e.cual).toBeGreaterThan(0);
      expect(r.volumen, e.cual).toBeLessThanOrEqual(1);
      expect(r.separacion, e.cual).toBeGreaterThan(0);
      claves.add(r.clave);
    }
    expect(claves.size).toBe(EVENTOS.length);
  });

  it("los pasos suenan distinto en cada suelo, y el del agua chapotea", () => {
    const recetas = SUELOS.map((suelo) => JSON.stringify(PISADAS[suelo]));
    expect(new Set(recetas).size).toBe(SUELOS.length);
    const agua = sonidoDe({ cual: "paso", jugador: 0, suelo: "agua", fuerza: 1, x: 0 });
    expect(agua.capas).toBe(PISADAS.agua);
  });

  it("los pasos de cada jugador se limitan por separado", () => {
    const rojo = sonidoDe({ cual: "paso", jugador: 0, suelo: "tierra", fuerza: 1, x: 0 });
    const turquesa = sonidoDe({ cual: "paso", jugador: 1, suelo: "piedra", fuerza: 1, x: 0 });
    expect(rojo.clave).not.toBe(turquesa.clave);
    // El mismo jugador en otro suelo es la misma clave: no se pisan dos veces en el mismo instante
    expect(sonidoDe({ cual: "paso", jugador: 0, suelo: "agua", fuerza: 1, x: 0 }).clave).toBe(rojo.clave);
  });

  it("más fuerza, más volumen", () => {
    const flojo = sonidoDe({ cual: "caer", jugador: 0, fuerza: 0, x: 0 });
    const fuerte = sonidoDe({ cual: "caer", jugador: 0, fuerza: 1, x: 0 });
    expect(fuerte.volumen).toBeGreaterThan(flojo.volumen);
  });

  it("la campana suena larga y la compuerta no se repite enseguida", () => {
    const campana = sonidoDe({ cual: "pieza", voz: "campana", fuerza: 1, x: 0 });
    expect(duracion(campana)).toBeGreaterThan(1);
    const compuerta = sonidoDe({ cual: "pieza", voz: "compuerta", fuerza: 1, x: 0 });
    expect(compuerta.separacion).toBeGreaterThan(
      sonidoDe({ cual: "pieza", voz: "madera", fuerza: 1, x: 0 }).separacion,
    );
  });
});
