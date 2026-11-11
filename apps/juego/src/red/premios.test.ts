// El secreto y el logro de la pareja entre la escena y el guardado, con premios y un Convex de mentira.
import { describe, expect, it, vi } from "vitest";
import type { Premio, PremiosDeNivel } from "../escenas/tipos";
import { type GuardadoDePremios, sincronizarPremios } from "./premios";

function premiosDeMentira(nivel = 99) {
  const ganados = new Set<Premio>();
  const avisos = new Set<(p: Premio) => void>();
  const festejados: Premio[] = [];
  const premios: PremiosDeNivel = {
    nivel,
    tiene: (p) => ganados.has(p),
    ganar(p) {
      if (ganados.has(p)) return;
      ganados.add(p);
      for (const aviso of avisos) aviso(p);
    },
    marcar: (p) => ganados.add(p),
    alGanar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
  };
  premios.alGanar((p) => festejados.push(p));
  return { premios, festejados };
}

/** Un Convex en memoria: guardar avisa a los que miran, como una consulta reactiva. */
function guardadoDeMentira(inicial: Partial<Record<Premio, boolean>> = {}) {
  const datos: Record<Premio, boolean> = { secreto: false, logro: false, ...inicial };
  const mirones = new Set<(g: Record<Premio, boolean>) => void>();
  const guardado: GuardadoDePremios = {
    mirar(_nivel, aviso) {
      mirones.add(aviso);
      aviso({ ...datos });
      return () => mirones.delete(aviso);
    },
    guardar: vi.fn(async (_nivel: number, premio: Premio) => {
      datos[premio] = true;
      for (const m of mirones) m({ ...datos });
    }),
  };
  return { guardado, datos };
}

describe("premios en línea", () => {
  it("lo ganado de antes se marca sin avisar, y la zona del secreto ya no lo vuelve a dar", () => {
    const { premios, festejados } = premiosDeMentira();
    const { guardado } = guardadoDeMentira({ secreto: true });
    sincronizarPremios(premios, guardado, "anfitrion");
    expect(premios.tiene("secreto")).toBe(true);
    premios.ganar("secreto");
    expect(festejados).toEqual([]);
    expect(guardado.guardar).not.toHaveBeenCalled();
  });

  it("el anfitrión guarda lo que gana la pareja", async () => {
    const { premios, festejados } = premiosDeMentira(4);
    const { guardado, datos } = guardadoDeMentira();
    sincronizarPremios(premios, guardado, "anfitrion");
    premios.ganar("logro");
    expect(guardado.guardar).toHaveBeenCalledWith(4, "logro");
    await Promise.resolve();
    expect(datos.logro).toBe(true);
    expect(festejados).toEqual(["logro"]);
  });

  it("el invitado no guarda, pero se entera por lo guardado y avisa", () => {
    const anfitrion = premiosDeMentira();
    const invitado = premiosDeMentira();
    const { guardado } = guardadoDeMentira();
    sincronizarPremios(anfitrion.premios, guardado, "anfitrion");
    sincronizarPremios(invitado.premios, guardado, "invitado");
    invitado.premios.alGanar(() => {});
    anfitrion.premios.ganar("secreto");
    expect(guardado.guardar).toHaveBeenCalledTimes(1);
    expect(invitado.festejados).toEqual(["secreto"]);
    expect(anfitrion.festejados).toEqual(["secreto"]);
  });
});
