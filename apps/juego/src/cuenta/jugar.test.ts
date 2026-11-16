import { describe, expect, it } from "vitest";
import { HISTORIA } from "../niveles/orden";
import { enlaceEnLinea, primeroSinGanar } from "./jugar";

describe("jugar en línea después de juntarse", () => {
  it("abre la escena en línea con el nivel pedido", () => {
    expect(enlaceEnLinea("patio")).toBe("?escena=en-linea&nivel=patio");
    const parametros = new URLSearchParams(enlaceEnLinea("medianoche"));
    expect(parametros.get("escena")).toBe("en-linea");
    expect(parametros.get("nivel")).toBe("medianoche");
  });

  it("la historia sigue en el primer nivel que la pareja no ganó", () => {
    expect(primeroSinGanar([])?.clave).toBe("patio");
    expect(primeroSinGanar([0, 1, 2])?.clave).toBe("calle");
    // Ganaron algunos salteados (eligiéndolos de la lista): sigue el primero que falta
    expect(primeroSinGanar([0, 2, 3])?.clave).toBe("pinar");
    // Los de prueba (98 y 99) no cuentan
    expect(primeroSinGanar([98, 99])?.clave).toBe("patio");
  });

  it("con los 17 ganados no queda ninguno por seguir", () => {
    expect(primeroSinGanar(HISTORIA.map((n) => n.numero))).toBeNull();
    expect(primeroSinGanar(HISTORIA.slice(0, -1).map((n) => n.numero))?.clave).toBe("medianoche");
  });
});
