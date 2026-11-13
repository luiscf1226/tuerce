// El avance de la pareja entre la escena y el guardado, con un nivel y un Convex de mentira.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AvanceDeNivel } from "../escenas/tipos";
import { type Guardado, guardarAvance, retomarAvance } from "./avance";

/** Un nivel de mentira: `alcanzar` hace como que la pareja llegó a un punto de control. */
function nivelDeMentira(nivel = 99) {
  let punto = 0;
  const avisos = new Set<(p: number) => void>();
  const irA = vi.fn((p: number) => {
    punto = p;
  });
  const avance: AvanceDeNivel = {
    nivel,
    meta: 3,
    puntoDeControl: () => punto,
    alCambiar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
    irA,
    retomar: (p) => {
      punto = Math.max(punto, p);
    },
  };
  const alcanzar = (p: number) => {
    punto = p;
    for (const aviso of avisos) aviso(p);
  };
  return { avance, irA, alcanzar };
}

/** Un guardado en memoria que solo avanza, como convex/avance.ts. */
function guardadoDeMentira(inicial: Record<number, number> = {}) {
  const datos = new Map(Object.entries(inicial).map(([n, p]) => [Number(n), p]));
  const guardado: Guardado = {
    leer: vi.fn(async (nivel: number) => datos.get(nivel) ?? 0),
    guardar: vi.fn(async (nivel: number, punto: number) => {
      datos.set(nivel, Math.max(datos.get(nivel) ?? 0, punto));
    }),
  };
  return { guardado, datos };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("retomar el avance", () => {
  it("pone a la pareja en el punto de control guardado de ese nivel", async () => {
    const { avance, irA } = nivelDeMentira(1);
    const { guardado } = guardadoDeMentira({ 1: 3, 0: 5 });
    expect(await retomarAvance(avance, guardado)).toBe(3);
    expect(guardado.leer).toHaveBeenCalledWith(1);
    expect(irA).toHaveBeenCalledExactlyOnceWith(3);
  });

  it("si lo guardado ya es la meta, vuelve a guardar que ganaron (un avance de antes del contrarreloj)", async () => {
    const ganar = vi.fn(async () => {});
    const { avance } = nivelDeMentira(99);
    const { guardado } = guardadoDeMentira({ 99: 3 });
    expect(await retomarAvance(avance, { ...guardado, ganar })).toBe(3);
    expect(ganar).toHaveBeenCalledExactlyOnceWith(99);
    // A mitad de camino, no
    const otro = nivelDeMentira(99);
    await retomarAvance(otro.avance, { ...guardadoDeMentira({ 99: 2 }).guardado, ganar });
    expect(ganar).toHaveBeenCalledOnce();
  });

  it("sin nada guardado (o algo que no es un punto de control) se queda en la salida", async () => {
    for (const leido of [0, -2, 1.5, Number.NaN]) {
      const { avance, irA } = nivelDeMentira();
      expect(await retomarAvance(avance, { leer: async () => leido, guardar: async () => {} })).toBe(0);
      expect(irA).not.toHaveBeenCalled();
    }
  });

  it("si no se puede leer, se juega desde donde está", async () => {
    const { avance, irA } = nivelDeMentira();
    const guardado: Guardado = { leer: () => Promise.reject(new Error("sin red")), guardar: async () => {} };
    expect(await retomarAvance(avance, guardado)).toBe(0);
    expect(irA).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("guardar el avance", () => {
  it("el anfitrión guarda cada punto de control nuevo, y deja de guardar cuando se le pide", async () => {
    const { avance, alcanzar } = nivelDeMentira(2);
    const { guardado, datos } = guardadoDeMentira();
    const dejar = guardarAvance(avance, guardado, "anfitrion");
    alcanzar(1);
    alcanzar(2);
    await vi.waitFor(() => expect(datos.get(2)).toBe(2));
    expect(guardado.guardar).toHaveBeenNthCalledWith(1, 2, 1);
    expect(guardado.guardar).toHaveBeenNthCalledWith(2, 2, 2);
    dejar();
    alcanzar(3);
    expect(guardado.guardar).toHaveBeenCalledTimes(2);
  });

  it("al llegar a la meta (el último punto) guarda que ganaron el nivel", async () => {
    const { avance, alcanzar } = nivelDeMentira(99);
    const { guardado } = guardadoDeMentira();
    const ganar = vi.fn(async () => {});
    guardarAvance(avance, { ...guardado, ganar }, "anfitrion");
    alcanzar(1);
    alcanzar(2);
    expect(ganar).not.toHaveBeenCalled();
    alcanzar(3);
    expect(ganar).toHaveBeenCalledExactlyOnceWith(99);
    // Sin `ganar` (un guardado viejo) no pasa nada
    const otro = nivelDeMentira();
    guardarAvance(otro.avance, guardadoDeMentira().guardado, "anfitrion");
    expect(() => otro.alcanzar(3)).not.toThrow();
  });

  it("el invitado no guarda", () => {
    const { avance, alcanzar } = nivelDeMentira();
    const { guardado } = guardadoDeMentira();
    guardarAvance(avance, guardado, "invitado");
    alcanzar(1);
    expect(guardado.guardar).not.toHaveBeenCalled();
  });

  it("si guardar falla, lo avisa y el juego sigue", async () => {
    const { avance, alcanzar } = nivelDeMentira();
    const guardado: Guardado = { leer: async () => 0, guardar: () => Promise.reject(new Error("sin red")) };
    guardarAvance(avance, guardado, "anfitrion");
    expect(() => alcanzar(1)).not.toThrow();
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalled());
  });
});
