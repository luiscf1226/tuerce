import { describe, expect, it } from "vitest";
import { desenmarcar, enmarcar, escribirSenal, leerAviso, MAX_DATOS, MAX_SALA, revisarTamano, tamano } from "./marco";

const bytes = (...n: number[]) => new Uint8Array(n).buffer;

describe("marco del repetidor", () => {
  it("texto y binario vuelven iguales, con su canal", () => {
    expect(desenmarcar(enmarcar("hola ñandú", true))).toEqual({ datos: "hola ñandú", fiable: true });
    expect(desenmarcar(enmarcar("foto", false))).toEqual({ datos: "foto", fiable: false });
    const vuelta = desenmarcar(enmarcar(bytes(1, 2, 250), false));
    expect(vuelta?.fiable).toBe(false);
    expect(vuelta?.datos).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(vuelta?.datos as ArrayBuffer)]).toEqual([1, 2, 250]);
  });

  it("un texto del juego que parece aviso de la sala viaja como binario y no se confunde", () => {
    const marco = enmarcar('{"t":"listos"}', true);
    expect(marco).toBeInstanceOf(ArrayBuffer);
    expect(desenmarcar(marco)?.datos).toBe('{"t":"listos"}');
  });

  it("vacío también viaja", () => {
    expect(desenmarcar(enmarcar("", true))).toEqual({ datos: "", fiable: true });
    expect(desenmarcar(enmarcar(new ArrayBuffer(0), true))?.datos).toEqual(new ArrayBuffer(0));
  });

  it("descarta marcos desconocidos", () => {
    expect(desenmarcar(new ArrayBuffer(0))).toBeNull();
    expect(desenmarcar(bytes(0x80, 1))).toBeNull();
  });

  it("lo más grande que se puede mandar cabe en la sala ya enmarcado; un byte más falla fuerte", () => {
    const justo = new ArrayBuffer(MAX_DATOS);
    expect(() => revisarTamano(justo)).not.toThrow();
    expect(enmarcar(justo, true).byteLength).toBe(MAX_SALA);
    expect(() => revisarTamano(new ArrayBuffer(MAX_DATOS + 1))).toThrow(RangeError);
    // Los textos cuentan en UTF-8: «ñ» ocupa 2 bytes.
    expect(tamano("ñ")).toBe(2);
    expect(() => revisarTamano("ñ".repeat(MAX_DATOS / 2 + 1))).toThrow(RangeError);
  });
});

describe("avisos de la sala", () => {
  it("lee hola, listos, se_fue y señales", () => {
    expect(leerAviso('{"t":"hola","rol":"invitado"}')).toEqual({ t: "hola", rol: "invitado" });
    expect(leerAviso('{"t":"listos"}')).toEqual({ t: "listos" });
    expect(leerAviso('{"t":"se_fue","rol":"anfitrion"}')).toEqual({ t: "se_fue", rol: "anfitrion" });
    expect(leerAviso('{"t":"senal","intento":"a1","fin":true}')).toEqual({ t: "senal", intento: "a1", fin: true });
  });

  it("ignora lo que no conoce", () => {
    expect(leerAviso("no es json")).toBeNull();
    expect(leerAviso('{"t":"hola","rol":"rey"}')).toBeNull();
    expect(leerAviso('{"t":"senal"}')).toBeNull();
    expect(leerAviso('{"t":"otra"}')).toBeNull();
    expect(leerAviso("3")).toBeNull();
  });

  it("una señal que no cabe en la sala falla fuerte", () => {
    expect(escribirSenal({ t: "senal", intento: "a", fin: true })).toBe('{"t":"senal","intento":"a","fin":true}');
    expect(() =>
      escribirSenal({ t: "senal", intento: "a", sdp: { type: "offer", sdp: "x".repeat(MAX_SALA) } }),
    ).toThrow(RangeError);
  });
});
