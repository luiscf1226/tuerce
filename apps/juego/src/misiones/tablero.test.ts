import { describe, expect, it } from "vitest";
import { crearTablero, type Medida, type Objetivo, porJugador, textoDeCuenta } from "./tablero";

/** Un objetivo que devuelve lo que diga `valor` y anota cuántas veces lo midieron y si empezó. */
function objetivo(id: string, valor: { actual: Medida }, opcional = false) {
  const registro = { medido: 0, empezado: 0 };
  const o: Objetivo = {
    id,
    titulo: id,
    texto: "",
    opcional,
    medir() {
      registro.medido++;
      return valor.actual;
    },
    empezar() {
      registro.empezado++;
    },
  };
  return { o, registro };
}

describe("el tablero de misiones", () => {
  it("en orden solo mide el de turno y pasa al siguiente al cumplirlo", () => {
    const a = { actual: { hecho: false } as Medida };
    const b = { actual: { hecho: true } as Medida };
    const oa = objetivo("a", a);
    const ob = objetivo("b", b);
    const tablero = crearTablero([oa.o, ob.o], { enOrden: true });
    tablero.pasar();
    tablero.pasar();
    expect(oa.registro.medido).toBe(2);
    // El segundo ya se cumpliría, pero no le toca
    expect(ob.registro.medido).toBe(0);
    expect(ob.registro.empezado).toBe(0);
    expect(tablero.actual).toBe(0);

    a.actual = { hecho: true };
    tablero.pasar();
    expect(tablero.actual).toBe(1);
    tablero.pasar();
    expect(ob.registro.empezado).toBe(1);
    expect(tablero.terminado).toBe(true);
    expect(tablero.cumplidos).toBe(2);
  });

  it("sueltos mide todos en cada paso", () => {
    const a = { actual: { hecho: false } as Medida };
    const b = { actual: { hecho: true } as Medida };
    const tablero = crearTablero([objetivo("a", a).o, objetivo("b", b).o]);
    tablero.pasar();
    expect(tablero.medida(1).hecho).toBe(true);
    expect(tablero.actual).toBe(0);
    expect(tablero.terminado).toBe(false);
  });

  it("lo cumplido queda cumplido aunque después se deshaga, y con la cuenta llena", () => {
    const a = { actual: { hecho: true, cuenta: 4, total: 5 } as Medida };
    const oa = objetivo("a", a);
    const tablero = crearTablero([oa.o]);
    tablero.pasar();
    a.actual = { hecho: false, cuenta: 0, total: 5 };
    tablero.pasar();
    expect(tablero.medida(0)).toEqual({ hecho: true, cuenta: 5, total: 5 });
    // Cumplido, ya no se mide
    expect(oa.registro.medido).toBe(1);
  });

  it("los opcionales no hacen falta para terminar", () => {
    const a = { actual: { hecho: true } as Medida };
    const secreto = { actual: { hecho: false } as Medida };
    const tablero = crearTablero([objetivo("a", a).o, objetivo("secreto", secreto, true).o], { enOrden: true });
    tablero.pasar();
    expect(tablero.terminado).toBe(true);
    expect(tablero.obligatorios).toBe(1);
  });

  it("avisa cuando cambia una medida y cuando se cumple, no en cada paso", () => {
    const a = { actual: { hecho: false, cuenta: 0, total: 2 } as Medida };
    const oa = objetivo("a", a);
    const tablero = crearTablero([oa.o]);
    const avisos: (string | null)[] = [];
    tablero.alCambiar((cumplido) => avisos.push(cumplido?.id ?? null));
    tablero.pasar(); // de «sin empezar» a 0 de 2
    tablero.pasar(); // igual: no avisa
    a.actual = { hecho: false, cuenta: 1, total: 2 };
    tablero.pasar();
    a.actual = { hecho: true, cuenta: 2, total: 2 };
    tablero.pasar();
    expect(avisos).toEqual([null, null, "a"]);
  });
});

describe("la cuenta", () => {
  it("dice cuántos de cuántos, salvo si es uno solo", () => {
    expect(textoDeCuenta({ hecho: false, cuenta: 2, total: 5 })).toBe("2 de 5");
    expect(textoDeCuenta({ hecho: false })).toBe("");
    expect(textoDeCuenta({ hecho: false, cuenta: 0, total: 1 })).toBe("");
  });

  it("por jugador: cada uno queda anotado la primera vez", () => {
    let rojo = false;
    let turquesa = false;
    const cuenta = porJugador((j) => (j === 0 ? rojo : turquesa));
    expect(cuenta.medir()).toEqual({ hecho: false, cuenta: 0, total: 2 });
    rojo = true;
    expect(cuenta.medir().cuenta).toBe(1);
    rojo = false;
    turquesa = true;
    expect(cuenta.medir()).toEqual({ hecho: true, cuenta: 2, total: 2 });
  });
});
