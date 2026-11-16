import { describe, expect, it } from "vitest";
import { HISTORIA } from "../niveles/orden";
import { nivelesPedidos, tituloDeTarjeta } from "./tabla";

describe("pantalla de tablas", () => {
  it("sin `&nivel=` muestra los 17 niveles de la historia, en orden y sin los de prueba", () => {
    const niveles = nivelesPedidos(null);
    expect(niveles.map((n) => n.numero)).toEqual([...Array(17).keys()]);
    expect(niveles.map((n) => n.clave)).not.toContain("prueba");
    expect(niveles.map((n) => n.clave)).not.toContain("piezas");
  });

  it("con `&nivel=` muestra ese, y ninguno si no es de la historia", () => {
    expect(nivelesPedidos("garrucha").map((n) => n.numero)).toEqual([10]);
    expect(nivelesPedidos("prueba")).toEqual([]);
    expect(nivelesPedidos("piezas")).toEqual([]);
  });

  it("el título de cada tarjeta es el nombre del nivel, no la clave", () => {
    expect(HISTORIA.map(tituloDeTarjeta).slice(0, 4)).toEqual([
      "Nivel 0 · El patio",
      "Nivel 1 · El pinar",
      "Nivel 2 · La poza",
      "Nivel 3 · La calle empedrada",
    ]);
  });
});
