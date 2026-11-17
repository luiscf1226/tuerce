import { describe, expect, it } from "vitest";
import type { Premio } from "../escenas/tipos";
import { objetivosDelNivel } from "./nivel";
import { crearTablero } from "./tablero";

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

  it("un nivel sin premios (el de piezas) solo tiene la meta", () => {
    expect(objetivosDelNivel({ meta: 2, puntoDeControl: () => 0 }, { nivel: 98, tiene: () => false })).toHaveLength(1);
  });
});
