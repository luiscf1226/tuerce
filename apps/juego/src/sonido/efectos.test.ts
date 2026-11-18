import { describe, expect, it } from "vitest";
import type { Muneco } from "../muneco";
import { CLAVE_SONIDO, duracionDe, EFECTOS, type Efecto, prenderSonido, sonar, sonidoPrendido } from "./efectos";
import { crearOidoDeManos } from "./manos";

const almacen = () => {
  const datos = new Map<string, string>();
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
};

describe("los efectos de sonido", () => {
  it("cada efecto tiene notas audibles y cortas", () => {
    for (const [efecto, notas] of Object.entries(EFECTOS)) {
      expect(notas.length, efecto).toBeGreaterThan(0);
      for (const n of notas) {
        expect(n.hz).toBeGreaterThan(80);
        expect(n.hz).toBeLessThan(4000);
        expect(n.dura).toBeGreaterThan(0);
        expect(n.fuerte).toBeGreaterThan(0);
        expect(n.fuerte).toBeLessThanOrEqual(1);
      }
      // Ninguno pasa de un segundo y medio: acompañan, no interrumpen
      expect(duracionDe(efecto as Efecto)).toBeLessThan(1.5);
    }
  });

  it("prendido por omisión; apagado queda anotado", () => {
    const a = almacen();
    expect(sonidoPrendido(a)).toBe(true);
    prenderSonido(false, a);
    expect(a.getItem(CLAVE_SONIDO)).toBe("no");
    expect(sonidoPrendido(a)).toBe(false);
    prenderSonido(true, a);
    expect(sonidoPrendido(a)).toBe(true);
  });

  it("sin Web Audio (Node) sonar no hace nada ni falla", () => {
    expect(() => sonar("juntar")).not.toThrow();
  });

  it("agarrar suena una vez cuando una mano suelta agarra, no mientras sigue agarrando", () => {
    let agarrado: object | null = null;
    const muneco = { agarrado: (brazo: string) => (brazo === "brazoIzquierdo" ? agarrado : null) };
    const sonados: Efecto[] = [];
    const oido = crearOidoDeManos([muneco as unknown as Pick<Muneco, "agarrado">], (e) => sonados.push(e));
    oido.pasar();
    agarrado = {};
    oido.pasar();
    oido.pasar();
    agarrado = null;
    oido.pasar();
    agarrado = {};
    oido.pasar();
    expect(sonados).toEqual(["agarrar", "agarrar"]);
  });
});
