// Los objetos de misión con Rapier en Node: la semilla se junta al tocarla, el encargo pesa y vuelve, y la entrega
// sabe si lo tiene adentro.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { entradaQuieta } from "../entrada/mandos";
import { crearMundo } from "../motor/fisica";
import { crearMuneco } from "../muneco";
import { ALCANCE_SEMILLA, crearEncargo, crearEntrega, crearSemillas } from "./objetos";

async function mundoConSuelo() {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0));
  return { rapier, mundo, escena: new THREE.Scene() };
}

describe("las semillas", () => {
  it("el muñeco que camina hasta una la junta, y las lejanas quedan", async () => {
    const { rapier, mundo, escena } = await mundoConSuelo();
    // Mira hacia +x y camina: la primera le queda en el camino, la segunda lejos a un costado
    const muneco = crearMuneco(rapier, mundo, { posicion: { x: 0, y: 0, z: 0 }, rumbo: Math.PI / 2 });
    const semillas = crearSemillas(escena, [
      { x: 1.2, y: 0, z: 0 },
      { x: 1.2, y: 0, z: 4 },
    ]);
    expect(semillas.pasar([muneco])).toBe(0);
    for (let i = 0; i < 2 * 60; i++) {
      muneco.pasar({ ...entradaQuieta(), avanzar: 1 });
      mundo.step();
      semillas.pasar([muneco]);
    }
    expect(semillas.juntadas).toBe(1);
    expect(semillas.quedan()).toEqual([1]);
    expect(ALCANCE_SEMILLA).toBeGreaterThan(0.3);
    semillas.dibujar(1);
  });
});

describe("el encargo y la entrega", () => {
  it("el cántaro cae y se queda parado en el suelo; dentro del círculo, la entrega lo tiene", async () => {
    const { rapier, mundo, escena } = await mundoConSuelo();
    const cantaro = crearEncargo(rapier, mundo, escena, { forma: "cantaro", posicion: { x: 3, y: 0.3, z: 0 } });
    const entrega = crearEntrega(escena, { x: 3, y: 0, z: 0 }, 0.8);
    const lejos = crearEntrega(escena, { x: -3, y: 0, z: 0 }, 0.8);
    for (let i = 0; i < 90; i++) {
      cantaro.guardar();
      mundo.step();
    }
    cantaro.dibujar(1);
    expect(cantaro.cuerpo.translation().y).toBeLessThan(0.4);
    expect(cantaro.cuerpo.mass()).toBeCloseTo(6);
    expect(entrega.contiene(cantaro.cuerpo)).toBe(true);
    expect(lejos.contiene(cantaro.cuerpo)).toBe(false);
    expect(cantaro.cargadores([])).toBe(0);
  });

  it("el costal pesa más y vuelve a donde empezó", async () => {
    const { rapier, mundo, escena } = await mundoConSuelo();
    const costal = crearEncargo(rapier, mundo, escena, { forma: "costal", posicion: { x: 0, y: 0, z: 0 } });
    expect(costal.cuerpo.mass()).toBeCloseTo(9);
    costal.cuerpo.setTranslation({ x: 5, y: 2, z: 5 }, true);
    costal.volver();
    expect(costal.cuerpo.translation().x).toBeCloseTo(0);
    expect(costal.cuerpo.translation().z).toBeCloseTo(0);
  });
});
