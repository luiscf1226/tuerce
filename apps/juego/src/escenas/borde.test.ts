// El borde de los claros: el que camina más allá del suelo cae y vuelve de pie a donde empezó.
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { ALTURA_DE_CAIDA } from "./borde";
import { crearEscenaTutorial } from "./tutorial";

describe("el borde del claro", () => {
  it("en el tutorial, el que se va caminando y se cae vuelve a su salida", { timeout: 60_000 }, async () => {
    const { rapier, mundo } = await crearMundo();
    const t = crearEscenaTutorial(rapier, mundo, new URLSearchParams("j1=andar:1&j2="));
    let masLejos = 0;
    let volvio = false;
    for (let i = 0; i < 75 * 60 && !volvio; i++) {
      t.pasar();
      const p = t.munecos[0].partes.pelvis.translation();
      expect(p.y).toBeGreaterThan(ALTURA_DE_CAIDA - 2);
      masLejos = Math.max(masLejos, p.x);
      if (masLejos > 55 && Math.abs(p.x) < 2) volvio = true;
    }
    expect(masLejos, "no llegó al borde").toBeGreaterThan(55);
    expect(volvio, "no volvió a su salida").toBe(true);
  });
});
