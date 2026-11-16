import { describe, expect, it } from "vitest";
import { crearAjustes, LLAVE_AJUSTES, leerAjustes } from "./ajustes";

/** Un localStorage de mentira. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (llave: string) => datos.get(llave) ?? null,
    setItem: (llave: string, valor: string) => void datos.set(llave, valor),
  };
}

describe("los ajustes de este navegador", () => {
  it("sin nada guardado, menos movimiento es lo que pide el sistema", () => {
    expect(leerAjustes(almacen(), false).menosMovimiento).toBe(false);
    expect(leerAjustes(almacen(), true).menosMovimiento).toBe(true);
    expect(leerAjustes(undefined, true).menosMovimiento).toBe(true);
  });

  it("lo guardado gana sobre lo que pide el sistema", () => {
    const a = almacen({ [LLAVE_AJUSTES]: JSON.stringify({ menosMovimiento: false }) });
    expect(leerAjustes(a, true).menosMovimiento).toBe(false);
  });

  it("algo roto o raro se ignora", () => {
    expect(leerAjustes(almacen({ [LLAVE_AJUSTES]: "{no es json" }), true).menosMovimiento).toBe(true);
    expect(leerAjustes(almacen({ [LLAVE_AJUSTES]: '{"menosMovimiento":"sí"}' }), false).menosMovimiento).toBe(false);
    const rompe = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    const ajustes = crearAjustes(rompe, false);
    expect(ajustes.ajustes().menosMovimiento).toBe(false);
    // Sin dónde guardar, vale igual para esta partida
    ajustes.fijar("menosMovimiento", true);
    expect(ajustes.ajustes().menosMovimiento).toBe(true);
  });

  it("al cambiarlo se guarda, avisa y se lee igual la próxima vez", () => {
    const a = almacen();
    const ajustes = crearAjustes(a, false);
    const avisos: boolean[] = [];
    const dejar = ajustes.alCambiar((nuevos) => avisos.push(nuevos.menosMovimiento));
    ajustes.fijar("menosMovimiento", true);
    ajustes.fijar("menosMovimiento", true); // igual que antes: no avisa
    expect(avisos).toEqual([true]);
    expect(leerAjustes(a, false).menosMovimiento).toBe(true);
    dejar();
    ajustes.fijar("menosMovimiento", false);
    expect(avisos).toEqual([true]);
    expect(crearAjustes(a, true).ajustes().menosMovimiento).toBe(false);
  });
});
