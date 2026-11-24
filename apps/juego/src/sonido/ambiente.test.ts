// El ambiente de cada nivel: todos los de la historia tienen el suyo, y de noche cantan los grillos.
import { describe, expect, it } from "vitest";
import { HISTORIA } from "../niveles/orden";
import { AMBIENTES, ambienteDe, CAPAS_DE_AMBIENTE } from "./ambiente";

const suena = (a: object) => Object.values(a).some((n) => typeof n === "number" && n > 0);

describe("ambiente", () => {
  it("cada nivel de la historia tiene su ambiente, con capas que existen y de 0 a 1", () => {
    for (const { clave } of HISTORIA) {
      const a = AMBIENTES[clave];
      expect(a, `«${clave}» no tiene ambiente`).toBeDefined();
      expect(suena(a ?? {}), `«${clave}» no suena`).toBe(true);
      for (const [capa, n] of Object.entries(a ?? {})) {
        expect(CAPAS_DE_AMBIENTE).toContain(capa);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it("viento en el pinar, el río en la poza, el mar en la minga y la cueva en la mina", () => {
    expect(ambienteDe("pinar", false).viento).toBeGreaterThan(0.5);
    expect(ambienteDe("poza", false).rio).toBeGreaterThan(0.5);
    expect(ambienteDe("minga", false).mar).toBeGreaterThan(0.5);
    expect(ambienteDe("mina", false).cueva).toBeGreaterThan(0.5);
  });

  it("de noche no hay pájaros y cantan los grillos; donde hay agua, también las ranas", () => {
    for (const { clave } of HISTORIA) {
      const noche = ambienteDe(clave, true);
      expect(noche.pajaros ?? 0, clave).toBe(0);
      expect(noche.grillos ?? 0, clave).toBeGreaterThanOrEqual(0.7);
    }
    expect(ambienteDe("poza", true).ranas ?? 0).toBeGreaterThan(0);
    expect(ambienteDe("pinar", true).ranas ?? 0).toBe(0);
  });

  it("una escena que no está en la lista suena con un viento suave", () => {
    expect(ambienteDe("no-existe", false)).toEqual({ viento: 0.4 });
  });
});
