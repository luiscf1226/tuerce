// Señalar con un rayo de Rapier y los gestos.

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearMuneco } from "../muneco";
import { type Apuntado, avanzarGesto, crearRayo, DURACION_GESTO, type GestoEnCurso, objetivoDeSenal } from "./senas";

async function armar(caja?: { x: number; alto: number }) {
  const { rapier, mundo } = await crearMundo();
  const suelo = mundo.createCollider(rapier.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0));
  const pared = caja
    ? mundo.createCollider(rapier.ColliderDesc.cuboid(0.5, caja.alto / 2, 2).setTranslation(caja.x, caja.alto / 2, 0))
    : undefined;
  // Mirando hacia +x
  const muneco = crearMuneco(rapier, mundo, { posicion: { x: 0, y: 0, z: 0 }, rumbo: Math.PI / 2 });
  for (let i = 0; i < 30; i++) {
    muneco.pasar({ avanzar: 0, girar: 0 });
    mundo.step();
  }
  const salida: Apuntado = { punto: new THREE.Vector3(), normal: new THREE.Vector3() };
  return { rapier, mundo, muneco, suelo, pared, salida };
}

describe("señalar", () => {
  it("en el claro, apunta al suelo unos metros adelante", async () => {
    const { rapier, mundo, muneco, salida } = await armar();
    const apuntado = objetivoDeSenal(mundo, muneco, crearRayo(rapier), salida);
    expect(apuntado).not.toBeNull();
    expect(salida.punto.x).toBeGreaterThan(4);
    expect(salida.punto.x).toBeLessThan(8);
    expect(Math.abs(salida.punto.z)).toBeLessThan(0.3);
    expect(salida.punto.y).toBeCloseTo(0, 2);
    expect(salida.normal.y).toBeCloseTo(1);
  });

  it("con algo adelante, apunta a eso y no al suelo de atrás", async () => {
    const { rapier, mundo, muneco, salida } = await armar({ x: 2.5, alto: 2 });
    objetivoDeSenal(mundo, muneco, crearRayo(rapier), salida);
    expect(salida.punto.x).toBeCloseTo(2, 1);
    expect(salida.punto.y).toBeGreaterThan(0.5);
    expect(salida.normal.x).toBeCloseTo(-1);
  });

  it("no se señala a sí mismo, y sin nada al alcance no hay marca", async () => {
    const { rapier, mundo, muneco, suelo, salida } = await armar();
    mundo.removeCollider(suelo, false);
    expect(objetivoDeSenal(mundo, muneco, crearRayo(rapier), salida)).toBeNull();
  });
});

describe("gestos", () => {
  it("empieza al pedirlo y dura al menos un rato aunque se suelte enseguida", () => {
    const enCurso: GestoEnCurso = { gesto: null, tiempo: 0 };
    avanzarGesto(enCurso, "saludar");
    expect(enCurso.gesto).toBe("saludar");
    let pasos = 0;
    while (enCurso.gesto && pasos < 1000) {
      avanzarGesto(enCurso, null);
      pasos++;
    }
    expect(pasos / 60).toBeCloseTo(DURACION_GESTO, 1);
  });

  it("si se pide otro, cambia y vuelve a empezar", () => {
    const enCurso: GestoEnCurso = { gesto: null, tiempo: 0 };
    avanzarGesto(enCurso, "festejar");
    for (let i = 0; i < 30; i++) avanzarGesto(enCurso, "festejar");
    avanzarGesto(enCurso, "encoger");
    expect(enCurso).toEqual({ gesto: "encoger", tiempo: 0 });
  });
});
