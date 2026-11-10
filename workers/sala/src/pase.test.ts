import { describe, expect, it } from "vitest";
import { DURACION_PASE_MS, firmarPase, salaDePareja, verificarPase } from "./pase";

const SECRETO = "secreto-de-prueba";
const ahora = 1_800_000_000_000;
const pase = { sala: salaDePareja("j57abc"), usuario: "k97xyz", vence: ahora + DURACION_PASE_MS };

describe("pase firmado", () => {
  it("firmar y revisar con el mismo secreto da el mismo pase", async () => {
    const token = await firmarPase(pase, SECRETO);
    expect(await verificarPase(token, SECRETO, ahora)).toEqual({ ok: true, pase });
  });

  it("un pase tocado no pasa", async () => {
    const token = await firmarPase(pase, SECRETO);
    const [, firma] = token.split(".");
    const otroUsuario = await firmarPase({ ...pase, usuario: "intruso" }, SECRETO);
    const [datosAjenos] = otroUsuario.split(".");
    expect(await verificarPase(`${datosAjenos}.${firma}`, SECRETO, ahora)).toEqual({
      ok: false,
      motivo: "firma inválida",
    });
    // Un carácter distinto al principio de la firma (el último de base64 puede ser solo relleno).
    const primero = firma?.[0] === "A" ? "B" : "A";
    const [datos] = token.split(".");
    expect(await verificarPase(`${datos}.${primero}${firma?.slice(1)}`, SECRETO, ahora)).toEqual({
      ok: false,
      motivo: "firma inválida",
    });
  });

  it("firmado con otro secreto no pasa", async () => {
    const token = await firmarPase(pase, "otro-secreto");
    expect(await verificarPase(token, SECRETO, ahora)).toEqual({ ok: false, motivo: "firma inválida" });
  });

  it("un pase vencido no pasa", async () => {
    const token = await firmarPase(pase, SECRETO);
    expect(await verificarPase(token, SECRETO, pase.vence)).toEqual({ ok: false, motivo: "pase vencido" });
  });

  it("basura y vacío no pasan", async () => {
    for (const token of ["", "abc", "a.b.c", "!!.??", "e30.e30"]) {
      expect((await verificarPase(token, SECRETO, ahora)).ok).toBe(false);
    }
    expect((await verificarPase(await firmarPase(pase, SECRETO), "", ahora)).ok).toBe(false);
  });

  it("el nombre de la sala cabe en lo que acepta la sala", () => {
    expect(salaDePareja("jd7f5sqcmh1xwg0t1q2gm1e1rx7k9c2v")).toMatch(/^[\w.-]{1,64}$/);
  });
});
