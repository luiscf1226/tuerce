import { describe, expect, it, vi } from "vitest";
import { entradaQuieta } from "../entrada/mandos";
import { crearReloj, formatearTiempo, numeroDeCarpeta, seMueve } from "./contrarreloj";

describe("reloj del contrarreloj", () => {
  it("cuenta pasos hasta llegar, se para y avisa una sola vez con el tiempo final", () => {
    const reloj = crearReloj();
    const aviso = vi.fn();
    reloj.alLlegar(aviso);
    for (let i = 0; i < 125; i++) reloj.pasar();
    expect(reloj.pasos).toBe(125);
    reloj.llegar();
    reloj.llegar();
    for (let i = 0; i < 10; i++) reloj.pasar();
    expect(reloj.pasos).toBe(125);
    expect(reloj.llego).toBe(true);
    expect(aviso).toHaveBeenCalledTimes(1);
    expect(aviso).toHaveBeenCalledWith(125);
  });

  it("el invitado copia lo que dice el anfitrión, y descarta números que no son pasos", () => {
    const reloj = crearReloj();
    reloj.fijar(300);
    expect(reloj.pasos).toBe(300);
    for (const raro of [-1, 1.5, Number.NaN]) reloj.fijar(raro);
    expect(reloj.pasos).toBe(300);
  });

  it("deja de avisar a quien se borró", () => {
    const reloj = crearReloj();
    const aviso = vi.fn();
    reloj.alLlegar(aviso)();
    reloj.llegar();
    expect(aviso).not.toHaveBeenCalled();
  });
});

describe("formatearTiempo", () => {
  it("minutos, segundos y centésimas, truncadas", () => {
    expect(formatearTiempo(0)).toBe("0:00.00");
    expect(formatearTiempo(1)).toBe("0:00.01");
    expect(formatearTiempo(60)).toBe("0:01.00");
    expect(formatearTiempo(2537)).toBe("0:42.28");
    expect(formatearTiempo(60 * 60 - 1)).toBe("0:59.98");
    expect(formatearTiempo(60 * 60 * 61 + 30)).toBe("61:00.50");
  });
});

describe("numeroDeCarpeta", () => {
  it("lee el número del nivel de su carpeta", () => {
    expect(numeroDeCarpeta("99-prueba")).toBe(99);
    expect(numeroDeCarpeta("00-el-patio")).toBe(0);
    expect(() => numeroDeCarpeta("prueba")).toThrow(/número/);
  });
});

describe("seMueve", () => {
  it("andar, girar, saltar o levantar un brazo arrancan el reloj; quieto, señalar o un gesto no", () => {
    expect(seMueve(entradaQuieta())).toBe(false);
    expect(seMueve({ ...entradaQuieta(), senalar: true, gesto: "festejar" })).toBe(false);
    expect(seMueve({ ...entradaQuieta(), avanzar: 0.2 })).toBe(true);
    expect(seMueve({ ...entradaQuieta(), girar: -1 })).toBe(true);
    expect(seMueve({ ...entradaQuieta(), saltar: true })).toBe(true);
    expect(seMueve({ ...entradaQuieta(), brazoDerecho: true })).toBe(true);
  });
});
