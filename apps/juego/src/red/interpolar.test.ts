// El colchón de fotos del invitado con un reloj de mentira: fotos cada 2 pasos que llegan con temblor, desordenadas
// o que no llegan. Lo dibujado tiene que avanzar parejo, sin saltos ni vueltas atrás.
import { describe, expect, it } from "vitest";
import { crearAzar } from "../imagen/ruido";
import { crearBufferFotos, mezclar } from "./interpolar";
import type { Foto } from "./paquetes";

/** Una foto de un solo cuerpo que avanza 1 cm por paso en x y gira alrededor de y. */
function fotoEn(paso: number): Foto {
  const angulo = paso * 0.02;
  return {
    paso,
    ack: paso,
    estados: ["de pie", "de pie"],
    agarres: 0,
    punto: 0,
    rumbos: [angulo, 0],
    velocidades: [
      { x: 0.6, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ],
    posiciones: Float32Array.of(paso * 0.01, 1, 0),
    rotaciones: Float32Array.of(0, Math.sin(angulo / 2), 0, Math.cos(angulo / 2)),
  };
}

/** Corre `pasos` pasos: el anfitrión saca foto cada 2 y llega `latencia ± temblor` pasos después, si no se pierde. */
function simular({ latencia = 4.5, temblor = 1.2, perdida = 0.02, pasos = 600, semilla = 1 } = {}) {
  const azar = crearAzar(semilla);
  const colchon = crearBufferFotos();
  const enCamino: { llega: number; foto: Foto }[] = [];
  const dibujados: { local: number; paso: number; x: number; esperando: boolean }[] = [];
  for (let local = 1; local <= pasos; local++) {
    if (local % 2 === 0 && azar() >= perdida) {
      enCamino.push({ llega: local + latencia + (azar() * 2 - 1) * temblor, foto: fotoEn(local) });
    }
    for (const m of enCamino.filter((m) => m.llega <= local)) colchon.recibir(m.foto, local);
    enCamino.splice(0, enCamino.length, ...enCamino.filter((m) => m.llega > local));
    const muestra = colchon.muestrear(local);
    if (muestra)
      dibujados.push({ local, paso: muestra.paso, x: muestra.posiciones[0] ?? 0, esperando: muestra.esperando });
  }
  return dibujados;
}

describe("colchón de fotos", () => {
  it("sin fotos no hay nada que dibujar", () => {
    expect(crearBufferFotos().muestrear(10)).toBeUndefined();
  });

  it("interpola posición y rotación entre dos fotos", () => {
    const m = mezclar(fotoEn(10), fotoEn(12), 0.5);
    expect(m.paso).toBe(11);
    expect(m.posiciones[0]).toBeCloseTo(0.11, 5);
    expect(m.rotaciones[1]).toBeCloseTo(Math.sin(0.11), 4);
    expect(m.rumbos[0]).toBeCloseTo(0.22, 5);
  });

  it("con temblor y 2 % de pérdida avanza parejo, unos 100 ms detrás de la foto más rápida", () => {
    const dibujados = simular().slice(120);
    let peorPaso = 0;
    let esperando = 0;
    for (let i = 1; i < dibujados.length; i++) {
      const antes = dibujados[i - 1];
      const ahora = dibujados[i];
      if (!antes || !ahora) continue;
      // Un paso local avanza un paso del anfitrión (±5 %): nunca para atrás ni de golpe
      peorPaso = Math.max(peorPaso, Math.abs(ahora.paso - antes.paso - 1));
      expect(ahora.x).toBeGreaterThanOrEqual(antes.x);
      if (ahora.esperando) esperando++;
    }
    expect(peorPaso).toBeLessThan(0.051);
    expect(esperando).toBe(0);
    // Detrás: lo que tarda la foto más rápida (4,5 − 1,2 pasos) más el colchón (6 pasos)
    const ultimo = dibujados[dibujados.length - 1];
    const atraso = (ultimo?.local ?? 0) - (ultimo?.paso ?? 0);
    expect(atraso).toBeGreaterThan(8);
    expect(atraso).toBeLessThan(11);
  });

  it("si se pierden varias seguidas se queda quieto en la última y después sigue sin saltar", () => {
    const colchon = crearBufferFotos();
    const xs: number[] = [];
    for (let local = 1; local <= 200; local++) {
      // De 100 a 130 no llega nada (un corte de medio segundo)
      if (local % 2 === 0 && (local < 100 || local > 130)) colchon.recibir(fotoEn(local), local + 0);
      const m = colchon.muestrear(local);
      if (m) xs.push(m.posiciones[0] ?? 0);
    }
    for (let i = 1; i < xs.length; i++) expect(xs[i] ?? 0).toBeGreaterThanOrEqual((xs[i - 1] ?? 0) - 1e-6);
    // Después del corte recupera de a poco: nunca más de 2 cm (2 pasos) en un paso
    for (let i = 1; i < xs.length; i++) expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeLessThan(0.02);
  });

  it("las fotos repetidas o viejas se tiran y si el anfitrión vuelve a empezar, se reinicia", () => {
    const colchon = crearBufferFotos();
    for (let paso = 2; paso <= 400; paso += 2) {
      colchon.recibir(fotoEn(paso), paso);
      colchon.recibir(fotoEn(paso), paso);
      colchon.muestrear(paso);
    }
    expect(colchon.fotos).toBeLessThanOrEqual(4);
    colchon.recibir(fotoEn(2), 402);
    expect(colchon.fotos).toBe(1);
  });
});
