// El silbido del Silbón (TU-44): la cuenta del volumen y el paneo, sin audio.
import { describe, expect, it } from "vitest";
import { AJUSTES_SILBIDO, ESCALA, NOTA, notaEn, SILENCIO, silbido, silbidos } from "./silbido";

const SILBON = { x: 10, y: 0, z: -3 };

describe("el silbido del Silbón", () => {
  it("suena al revés: bajito al lado de él y fuerte de lejos", () => {
    const pegado = silbido(SILBON, { x: 10.5, y: 0, z: -3 });
    const cerca = silbido(SILBON, { x: 6, y: 0, z: -3 });
    const lejos = silbido(SILBON, { x: -12, y: 0, z: 1 });
    expect(pegado.volumen).toBeCloseTo(AJUSTES_SILBIDO.minimo, 5);
    expect(cerca.volumen).toBeGreaterThan(pegado.volumen);
    expect(lejos.volumen).toBeGreaterThan(cerca.volumen);
    expect(lejos.volumen).toBeCloseTo(1, 5);
  });

  it("acercarse lo baja siempre, de a poco", () => {
    let antes = Number.POSITIVE_INFINITY;
    for (let d = 25; d >= 0; d -= 0.25) {
      const { volumen } = silbido(SILBON, { x: SILBON.x - d, y: 0, z: SILBON.z });
      expect(volumen).toBeLessThanOrEqual(antes);
      expect(volumen).toBeGreaterThanOrEqual(AJUSTES_SILBIDO.minimo);
      expect(volumen).toBeLessThanOrEqual(1);
      antes = volumen;
    }
  });

  it("la altura no cuenta: solo la distancia de costado", () => {
    const abajo = silbido(SILBON, { x: 4, y: 0, z: -3 });
    const arriba = silbido(SILBON, { x: 4, y: 3, z: -3 });
    expect(arriba).toEqual(abajo);
  });

  it("viene del lado contrario: con el Silbón a la derecha suena a la izquierda", () => {
    expect(silbido(SILBON, { x: 7, y: 0, z: -3 }).paneo).toBeLessThan(0);
    expect(silbido(SILBON, { x: 13, y: 0, z: -3 }).paneo).toBeGreaterThan(0);
    expect(silbido(SILBON, { x: 10, y: 0, z: 5 }).paneo).toBe(0);
    // Del todo de un lado, pasado el ancho
    expect(silbido(SILBON, { x: -20, y: 0, z: -3 }).paneo).toBe(-1);
    expect(silbido(SILBON, { x: 40, y: 0, z: -3 }).paneo).toBe(1);
  });

  it("a cada jugador lo suyo; sin Silbón escondido, silencio", () => {
    const [rojo, turquesa] = silbidos(SILBON, [
      { x: 9, y: 0, z: -3 },
      { x: -8, y: 0, z: 0 },
    ]);
    expect(rojo?.volumen).toBeLessThan(turquesa?.volumen ?? 0);
    expect(silbidos(null, [{ x: 0, y: 0, z: 0 }])).toEqual([{ volumen: 0, paneo: 0 }]);
  });

  it("la tonada sube por la escala y calla un rato", () => {
    expect(notaEn(0)?.frecuencia).toBe(ESCALA[0]);
    expect(notaEn(NOTA * 2.5)?.frecuencia).toBe(ESCALA[2]);
    expect(notaEn(NOTA * 2.5)?.dentro).toBeCloseTo(0.5, 5);
    expect(notaEn(ESCALA.length * NOTA + SILENCIO / 2)).toBeNull();
    expect(notaEn(ESCALA.length * NOTA + SILENCIO)?.frecuencia).toBe(ESCALA[0]);
  });
});
