// El cartel al entrar a un nivel (TU-62): el texto, de la historia, y cuánto se ve en cada paso.
import { describe, expect, it } from "vitest";
import { HISTORIA } from "../niveles/orden";
import { TIEMPOS_CARTEL, textoDelCartel, visibilidadDelCartel } from "./cartel-nivel";

describe("el texto del cartel", () => {
  it("número con ceros, nombre y lugar, como en el menú", () => {
    expect(textoDelCartel("calle")).toEqual({
      numero: "03",
      titulo: "La calle empedrada",
      lugar: "Comayagua, Honduras",
      linea: "03 · La calle empedrada · Comayagua, Honduras",
    });
    expect(textoDelCartel("medianoche")?.linea).toBe("16 · La medianoche · Amazonía, Brasil");
  });

  it("todos los de la historia tienen cartel; los de prueba no", () => {
    for (const n of HISTORIA) expect(textoDelCartel(n.clave)?.titulo).toBe(n.titulo);
    expect(textoDelCartel("prueba")).toBeNull();
    expect(textoDelCartel("piezas")).toBeNull();
  });
});

describe("cuánto se ve", () => {
  it("entra, se queda y se va solo", () => {
    const { entra, entero, seVa, fuera } = TIEMPOS_CARTEL;
    expect(visibilidadDelCartel(0)).toBe(0);
    expect(visibilidadDelCartel(entra)).toBe(0);
    expect(visibilidadDelCartel((entra + entero) / 2)).toBeCloseTo(0.5);
    expect(visibilidadDelCartel(entero)).toBe(1);
    expect(visibilidadDelCartel(seVa)).toBe(1);
    expect(visibilidadDelCartel((seVa + fuera) / 2)).toBeCloseTo(0.5);
    expect(visibilidadDelCartel(fuera)).toBe(0);
    expect(visibilidadDelCartel(10_000)).toBe(0);
  });

  it("sube sin saltos al entrar y baja sin saltos al irse", () => {
    let antes = 0;
    for (let p = 0; p <= TIEMPOS_CARTEL.entero; p++) {
      const v = visibilidadDelCartel(p);
      expect(v).toBeGreaterThanOrEqual(antes);
      expect(v - antes).toBeLessThan(0.1);
      antes = v;
    }
    for (let p = TIEMPOS_CARTEL.seVa; p <= TIEMPOS_CARTEL.fuera; p++) {
      const v = visibilidadDelCartel(p);
      expect(v).toBeLessThanOrEqual(antes);
      expect(antes - v).toBeLessThan(0.1);
      antes = v;
    }
  });

  it("dura unos cuatro segundos de juego", () => {
    expect(TIEMPOS_CARTEL.fuera / 60).toBeGreaterThan(4);
    expect(TIEMPOS_CARTEL.fuera / 60).toBeLessThan(6);
  });
});
