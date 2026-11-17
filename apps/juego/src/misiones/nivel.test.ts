import { describe, expect, it } from "vitest";
import type { Premio } from "../escenas/tipos";
import { objetivosDelNivel } from "./nivel";
import { crearTablero, pasoActual } from "./tablero";

describe("la misión de un nivel", () => {
  it("llegar a la meta cuenta los puntos de control; el secreto y el logro son opcionales", () => {
    let punto = 0;
    const ganados = new Set<Premio>();
    const objetivos = objetivosDelNivel(
      { meta: 5, puntoDeControl: () => punto },
      { nivel: 0, tiene: (p) => ganados.has(p) },
    );
    expect(objetivos.map((o) => o.id)).toEqual(["meta", "secreto", "logro"]);
    expect(objetivos[2]?.titulo).toBe("Logro: A la de tres");
    const tablero = crearTablero(objetivos);
    tablero.pasar();
    expect(tablero.medida(0)).toEqual({ hecho: false, cuenta: 0, total: 5 });
    punto = 2;
    ganados.add("secreto");
    tablero.pasar();
    expect(tablero.medida(0).cuenta).toBe(2);
    expect(tablero.medida(1).hecho).toBe(true);
    expect(tablero.terminado).toBe(false);
    punto = 5;
    tablero.pasar();
    expect(tablero.terminado).toBe(true);
  });

  it("con la guía, la meta dice de qué se trata y trae un consejo por tramo; el secreto, por dónde buscar", () => {
    let punto = 0;
    const guia = {
      meta: "Salgan del patio hasta el camión.",
      secreto: "Miren arriba del palo de mango.",
      tramos: [
        { que: "Levántense", pista: "Caminen un poco y se levantan solos." },
        { que: "Abran el portón", pista: "Uno empuja la aldaba y el otro la hoja.", deADos: true },
      ],
    };
    const objetivos = objetivosDelNivel(
      { meta: 2, puntoDeControl: () => punto },
      { nivel: 0, tiene: () => false },
      guia,
    );
    const tablero = crearTablero(objetivos);
    tablero.pasar();
    const meta = objetivos[0];
    if (!meta) throw new Error("sin meta");
    expect(meta.texto).toBe(guia.meta);
    expect(objetivos[1]?.texto).toBe(guia.secreto);
    expect(pasoActual(meta, tablero.medida(0))?.que).toBe("Levántense");
    punto = 1;
    tablero.pasar();
    expect(pasoActual(meta, tablero.medida(0))?.deADos).toBe(true);
    punto = 2;
    tablero.pasar();
    expect(pasoActual(meta, tablero.medida(0))).toBeNull();
  });

  it("un nivel sin premios (el de piezas) solo tiene la meta", () => {
    expect(objetivosDelNivel({ meta: 2, puntoDeControl: () => 0 }, { nivel: 98, tiene: () => false })).toHaveLength(1);
  });
});
