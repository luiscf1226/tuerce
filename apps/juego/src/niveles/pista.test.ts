// La pista (TU-62): cuándo se enciende la luciérnaga (en pasos de físicas) y hacia dónde vuela.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { ALCANCE, CICLO, crearEspera, destinoDeLaPista, ESPERA_PISTA, vueloDeLuciernaga } from "./pista";
import { leerDelDisco } from "./prueba";

describe("la espera de la pista", () => {
  it("son 2 minutos de pasos de físicas", () => {
    expect(ESPERA_PISTA).toBe(2 * 60 * PASOS_POR_SEGUNDO);
  });

  it("se enciende después de 2 minutos jugando sin llegar al próximo punto, y no antes", () => {
    const espera = crearEspera({ meta: 4 });
    for (let i = 0; i < ESPERA_PISTA; i++) espera.pasar(1, true);
    expect(espera.encendida).toBe(false);
    espera.pasar(1, true);
    expect(espera.encendida).toBe(true);
    expect(espera.pasos).toBe(1);
    for (let i = 0; i < 9; i++) espera.pasar(1, true);
    expect(espera.pasos).toBe(10);
  });

  it("un punto de control nuevo la apaga y la cuenta vuelve a empezar", () => {
    const espera = crearEspera({ meta: 4 });
    for (let i = 0; i <= ESPERA_PISTA; i++) espera.pasar(1, true);
    expect(espera.encendida).toBe(true);
    espera.pasar(2, true);
    expect(espera.encendida).toBe(false);
    expect(espera.pasos).toBe(0);
    for (let i = 0; i < ESPERA_PISTA - 1; i++) espera.pasar(2, true);
    expect(espera.encendida).toBe(false);
    espera.pasar(2, true);
    expect(espera.encendida).toBe(true);
  });

  it("solo cuentan los pasos jugando: en el menú, en la pausa o esperando a la pareja no corre", () => {
    const espera = crearEspera({ meta: 4 });
    for (let i = 0; i < ESPERA_PISTA * 2; i++) espera.pasar(0, false);
    expect(espera.encendida).toBe(false);
    for (let i = 0; i <= ESPERA_PISTA; i++) espera.pasar(0, i % 2 === 0);
    expect(espera.encendida).toBe(false);
  });

  it("en la meta no hay pista", () => {
    const espera = crearEspera({ meta: 3, forzada: true });
    espera.pasar(3, true);
    expect(espera.encendida).toBe(false);
  });

  it("forzada (`&pista`) está encendida desde el primer paso, hasta el próximo punto de control", () => {
    const espera = crearEspera({ meta: 3, forzada: true });
    expect(espera.encendida).toBe(false);
    espera.pasar(0, true);
    expect(espera.encendida).toBe(true);
    espera.pasar(1, true);
    expect(espera.encendida).toBe(false);
  });
});

describe("hacia dónde señala", () => {
  it("al medio de la zona del próximo punto de control, un metro sobre su base; en la meta, a ningún lado", async () => {
    const plano = await leerDelDisco("99-prueba");
    const meta = plano.puntos.length - 1;
    for (let punto = 0; punto < meta; punto++) {
      const zona = plano.puntos[punto + 1]?.zona;
      const destino = destinoDeLaPista(plano, punto);
      if (!zona || !destino) throw new Error(`sin destino desde el punto ${punto}`);
      expect(destino.x).toBeCloseTo(zona.centro.x, 5);
      expect(destino.z).toBeCloseTo(zona.centro.z, 5);
      expect(destino.y).toBeCloseTo(zona.centro.y - zona.medio.y + 1, 5);
    }
    expect(destinoDeLaPista(plano, meta)).toBeNull();
  });
});

describe("el vuelo de la luciérnaga", () => {
  const desde = new THREE.Vector3(0, 0.9, 0);
  const lejos = new THREE.Vector3(20, 1, -2);

  it("sale de la pareja apagada, brilla a mitad del vuelo y se apaga al final", () => {
    expect(vueloDeLuciernaga(desde, lejos, CICLO * 2).brillo).toBe(0);
    expect(vueloDeLuciernaga(desde, lejos, CICLO * 2 + CICLO / 2).brillo).toBeGreaterThan(0.95);
    expect(vueloDeLuciernaga(desde, lejos, CICLO * 3 - 1).brillo).toBeLessThan(0.01);
  });

  it("el primer vuelo aparece de a poco", () => {
    expect(vueloDeLuciernaga(desde, lejos, CICLO / 4).brillo).toBeLessThan(
      vueloDeLuciernaga(desde, lejos, CICLO + CICLO / 4).brillo,
    );
  });

  it("avanza hacia el destino, sin alejarse de la pareja más que su alcance", () => {
    let antes = Number.POSITIVE_INFINITY;
    for (let p = CICLO; p < CICLO + CICLO * 0.85; p += 10) {
      const { posicion } = vueloDeLuciernaga(desde, lejos, p);
      const falta = posicion.distanceTo(lejos);
      expect(falta).toBeLessThan(antes + 0.3); // el vaivén la mece un poco, pero va para allá
      antes = falta;
      expect(posicion.distanceTo(desde)).toBeLessThan(ALCANCE + 1.2);
    }
    expect(antes).toBeLessThan(lejos.distanceTo(desde) - ALCANCE + 1);
  });

  it("con el destino cerca, llega y se queda ahí sin pasarse", () => {
    const cerca = new THREE.Vector3(2, 1.4, 0);
    const { posicion } = vueloDeLuciernaga(desde, cerca, CICLO + Math.round(CICLO * 0.9));
    expect(posicion.distanceTo(cerca)).toBeLessThan(0.25);
  });

  it("siempre lo mismo para los mismos datos (en línea los dos la ven igual)", () => {
    const a = vueloDeLuciernaga(desde, lejos, 1234);
    const b = vueloDeLuciernaga(desde.clone(), lejos.clone(), 1234);
    expect(a.posicion.toArray()).toEqual(b.posicion.toArray());
    expect(a.brillo).toBe(b.brillo);
  });
});
