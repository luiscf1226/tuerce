// Cada nivel de la historia tiene su guía, con un tramo por punto de control de su .glb, y textos que caben en la
// hoja de la misión.
import { describe, expect, it } from "vitest";
import { NIVELES } from "../niveles/lista";
import { HISTORIA } from "../niveles/orden";
import { leerDelDisco } from "../niveles/prueba";
import { GUIAS } from "./guias";

describe("la guía de cada nivel", () => {
  it.each(HISTORIA.map((n) => n.clave))("%s: un tramo por punto de control", async (clave) => {
    const guia = GUIAS[clave];
    const datos = NIVELES[clave];
    if (!guia || !datos) throw new Error(`${clave} sin guía`);
    const plano = await leerDelDisco(datos.carpeta);
    expect(guia.tramos).toHaveLength(plano.puntos.length - 1);
  });

  it("los textos son cortos y no quedan vacíos", () => {
    for (const [clave, guia] of Object.entries(GUIAS)) {
      const donde = (que: string) => `${clave}: ${que}`;
      expect(guia.meta.length, donde(guia.meta)).toBeGreaterThan(10);
      expect(guia.meta.length, donde(guia.meta)).toBeLessThanOrEqual(100);
      expect(guia.secreto.length, donde(guia.secreto)).toBeGreaterThan(10);
      expect(guia.secreto.length, donde(guia.secreto)).toBeLessThanOrEqual(80);
      for (const paso of guia.tramos) {
        expect(paso.que.length, donde(paso.que)).toBeGreaterThan(3);
        expect(paso.que.length, donde(paso.que)).toBeLessThanOrEqual(32);
        expect(paso.pista.length, donde(paso.pista)).toBeGreaterThan(20);
        expect(paso.pista.length, donde(paso.pista)).toBeLessThanOrEqual(160);
      }
    }
  });
});
