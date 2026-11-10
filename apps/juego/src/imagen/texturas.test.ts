import { describe, expect, it } from "vitest";
import {
  type Lamina,
  nubeDeNiebla,
  nuevaLamina,
  ramaDePino,
  ramitaDeHojas,
  rayarCorteza,
  siluetaDeAbeto,
  tejerTela,
} from "./texturas";

const canal = (l: Lamina, x: number, y: number, c: number) => l.datos[(y * l.ancho + x) * 4 + c] ?? -1;

/** Diferencia media del canal rojo entre dos columnas. */
function saltoEntreColumnas(l: Lamina, a: number, b: number) {
  let suma = 0;
  for (let y = 0; y < l.alto; y++) suma += Math.abs(canal(l, a, y, 0) - canal(l, b, y, 0));
  return suma / l.alto;
}

describe("texturas hechas con código", () => {
  it("cada lámina tiene el tamaño pedido, en RGBA", () => {
    const tela = tejerTela(64, 1);
    expect(tela.color).toMatchObject({ ancho: 64, alto: 64 });
    expect(tela.color.datos.length).toBe(64 * 64 * 4);
    expect(tela.relieve.datos.length).toBe(64 * 64 * 4);
    expect(rayarCorteza(32).color.datos.length).toBe(32 * 32 * 4);
    const nube = nubeDeNiebla(64, 32);
    expect(nube).toMatchObject({ ancho: 64, alto: 32 });
    expect(ramaDePino(128, 64).datos.length).toBe(128 * 64 * 4);
    expect(siluetaDeAbeto(32, 64).datos.length).toBe(32 * 64 * 4);
    expect(ramitaDeHojas(64).datos.length).toBe(64 * 64 * 4);
  });

  it("no acepta tamaños inválidos", () => {
    expect(() => nuevaLamina(0, 4)).toThrow();
    expect(() => nuevaLamina(4.5, 4)).toThrow();
  });

  it("la misma semilla da la misma tela y otra semilla da otra", () => {
    expect(tejerTela(32, 3).color.datos).toEqual(tejerTela(32, 3).color.datos);
    expect(tejerTela(32, 3).color.datos).not.toEqual(tejerTela(32, 4).color.datos);
  });

  it("la tela es gris (sin color) y opaca", () => {
    const { color } = tejerTela(64, 1);
    for (let i = 0; i < color.datos.length; i += 4) {
      expect(color.datos[i]).toBe(color.datos[i + 1]);
      expect(color.datos[i]).toBe(color.datos[i + 2]);
      expect(color.datos[i + 3]).toBe(255);
    }
  });

  it("la tela se repite sin costura: el borde no salta más que el interior", () => {
    const { relieve } = tejerTela(128, 1);
    let interior = 0;
    for (let x = 0; x < 127; x++) interior = Math.max(interior, saltoEntreColumnas(relieve, x, x + 1));
    expect(saltoEntreColumnas(relieve, 127, 0)).toBeLessThanOrEqual(interior);
  });

  it("la niebla se desvanece arriba y abajo para que no se vea el borde del plano", () => {
    const nube = nubeDeNiebla(64, 64);
    for (let x = 0; x < 64; x++) {
      expect(canal(nube, x, 0, 3)).toBeLessThan(8);
      expect(canal(nube, x, 63, 3)).toBeLessThan(8);
    }
  });

  it("las siluetas recortadas tienen partes opacas y transparentes", () => {
    for (const l of [ramaDePino(), siluetaDeAbeto(), ramitaDeHojas()]) {
      let opacos = 0;
      for (let i = 3; i < l.datos.length; i += 4) if ((l.datos[i] ?? 0) > 200) opacos++;
      const total = l.ancho * l.alto;
      expect(opacos / total).toBeGreaterThan(0.05);
      expect(opacos / total).toBeLessThan(0.7);
    }
  });
});
