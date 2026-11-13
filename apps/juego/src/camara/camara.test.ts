// La cámara de los dos con jugadores de mentira: se separan hasta partir la pantalla y vuelven a juntarse, suben a
// un escalón y se esconden detrás de una pared.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearCamaraDeDos } from "./camara";
import { despejadoEnElMundo } from "./despejado";

const direccion = new THREE.Vector3(0.45, 0.32, 1);

/** Los dos se alejan de costado hasta `lejos` metros, se quedan, vuelven y se quedan. */
function idaYVuelta(lejos: number, paso: number): [THREE.Vector3, THREE.Vector3][] {
  const par = (s: number): [THREE.Vector3, THREE.Vector3] => [
    new THREE.Vector3(-s / 2, 0, 0),
    new THREE.Vector3(s / 2, 0, 0),
  ];
  const salida: [THREE.Vector3, THREE.Vector3][] = [];
  for (let s = 0.5; s <= lejos; s += paso) salida.push(par(s));
  for (let i = 0; i < 240; i++) salida.push(par(lejos));
  for (let s = lejos; s >= 0.5; s -= paso) salida.push(par(s));
  for (let i = 0; i < 240; i++) salida.push(par(0.5));
  return salida;
}

describe("cámara de los dos", () => {
  it("parte la pantalla al separarse y la junta al volver, sin saltos", () => {
    const camara = crearCamaraDeDos({ direccion });
    camara.camara.aspect = 16 / 9;
    const antes = new THREE.Vector3();
    const antesB = new THREE.Vector3();
    let sePartio = false;
    let primero = true;
    for (const [a, b] of idaYVuelta(24, 0.02)) {
      camara.seguir(a, b);
      camara.dibujar(1);
      if (!primero) {
        expect(camara.camara.position.distanceTo(antes)).toBeLessThan(0.1);
        expect(camara.vistas.camaraB.position.distanceTo(antesB)).toBeLessThan(0.1);
      }
      // sin la segunda vista solo se ve la principal: tiene que coincidir con la otra, así juntar no salta
      if (!camara.vistas.partida) {
        expect(camara.camara.position.distanceTo(camara.vistas.camaraB.position)).toBeLessThan(0.01);
      }
      sePartio ||= camara.partida;
      antes.copy(camara.camara.position);
      antesB.copy(camara.vistas.camaraB.position);
      primero = false;
    }
    expect(sePartio).toBe(true);
    expect(camara.partida).toBe(false);
    expect(camara.vistas.partida).toBe(false);
  });

  it("bien partida, cada cámara tiene a su jugador cerca del medio de su mitad", () => {
    const camara = crearCamaraDeDos({ direccion });
    camara.camara.aspect = 16 / 9;
    const a = new THREE.Vector3(-12, 0, 0);
    const b = new THREE.Vector3(12, 0, 0);
    for (let i = 0; i < 600; i++) camara.seguir(a, b);
    camara.dibujar(1);
    expect(camara.vistas.partida).toBe(true);
    expect(camara.vistas.costura).toBeGreaterThan(0.99);
    const enPantalla = (c: THREE.PerspectiveCamera, p: THREE.Vector3) => {
      c.updateMatrixWorld();
      return p.clone().setY(0.55).project(c);
    };
    const delUno = enPantalla(camara.camara, a);
    const delDos = enPantalla(camara.vistas.camaraB, b);
    expect(Math.abs(camara.vistas.normal.x)).toBeGreaterThan(0.9);
    expect(delUno.x).toBeLessThan(-0.3);
    expect(delUno.x).toBeGreaterThan(-0.65);
    expect(delDos.x).toBeGreaterThan(0.3);
    expect(delDos.x).toBeLessThan(0.65);
    expect(Math.abs(delUno.y)).toBeLessThan(0.3);
  });

  it("mira un poco adelante de hacia donde caminan", () => {
    const camara = crearCamaraDeDos({ direccion });
    const quieta = crearCamaraDeDos({ direccion });
    for (let i = 0; i < 300; i++) {
      const x = i * 0.02; // 1.2 m/s hacia +x
      camara.seguir({ x, y: 0, z: 0.5 }, { x, y: 0, z: -0.5 });
      quieta.seguir({ x: 5.98, y: 0, z: 0.5 }, { x: 5.98, y: 0, z: -0.5 });
    }
    camara.dibujar(1);
    quieta.dibujar(1);
    const adelanto = camara.camara.position.x - quieta.camara.position.x;
    expect(adelanto).toBeGreaterThan(0.2);
    expect(adelanto).toBeLessThan(1.2);
  });
});

/** Dónde se ve un punto en la pantalla de la cámara (de −1 a 1; `z` mayor que 1 es detrás de la cámara). */
function enPantalla(c: THREE.PerspectiveCamera, p: THREE.Vector3) {
  c.updateMatrixWorld();
  return p.clone().project(c);
}

describe("cámara de los dos con desniveles y paredes", () => {
  // La pelvis de pie queda a 0.5 m del suelo: así siguen la cámara los muñecos de verdad
  const juntos = (y: number): [THREE.Vector3, THREE.Vector3] => [
    new THREE.Vector3(-0.4, y, 0),
    new THREE.Vector3(0.4, y, 0),
  ];

  it("sube con ellos arriba de un escalón de 1.5 m, sin saltos, y los deja en el medio", () => {
    const camara = crearCamaraDeDos({ direccion });
    camara.camara.aspect = 16 / 9;
    const antes = new THREE.Vector3();
    let mayor = 0;
    for (let i = 0; i < 600; i++) {
      // Un segundo abajo y después arriba del escalón (lo peor: suben de golpe)
      const [a, b] = juntos(i < 60 ? 0.5 : 2);
      camara.seguir(a, b);
      camara.dibujar(1);
      if (i > 0) mayor = Math.max(mayor, camara.camara.position.distanceTo(antes));
      antes.copy(camara.camara.position);
    }
    expect(mayor).toBeLessThan(0.05);
    // Igual que en el suelo, pero 1.5 m más arriba
    const enElSuelo = crearCamaraDeDos({ direccion });
    for (let i = 0; i < 600; i++) enElSuelo.seguir(...juntos(0.5));
    enElSuelo.dibujar(1);
    expect(camara.camara.position.y - enElSuelo.camara.position.y).toBeCloseTo(1.5, 3);
    for (const p of juntos(2)) {
      const visto = enPantalla(camara.camara, p);
      expect(Math.abs(visto.x)).toBeLessThan(0.3);
      expect(Math.abs(visto.y)).toBeLessThan(0.3);
    }
  });

  it("con uno arriba del escalón y otro abajo, entran los dos", () => {
    const camara = crearCamaraDeDos({ direccion });
    camara.camara.aspect = 16 / 9;
    const arriba = new THREE.Vector3(0.6, 2, -0.5);
    const abajo = new THREE.Vector3(-0.6, 0.5, 0.5);
    for (let i = 0; i < 600; i++) camara.seguir(arriba, abajo);
    camara.dibujar(1);
    for (const p of [arriba, abajo]) {
      // La cabeza y los pies (la pelvis está a 0.5 m del suelo y la cabeza a 1.21 m)
      for (const alto of [-0.5, 0.75]) {
        const visto = enPantalla(camara.camara, p.clone().setY(p.y + alto));
        expect(Math.abs(visto.x)).toBeLessThan(0.9);
        expect(Math.abs(visto.y)).toBeLessThan(0.9);
      }
    }
  });

  it("si una pared tapa, se acerca de a poco hasta tenerlos a la vista, y vuelve al despejarse", async () => {
    const { rapier, mundo } = await crearMundo();
    mundo.createCollider(rapier.ColliderDesc.cuboid(20, 0.5, 20).setTranslation(0, -0.5, 0));
    const correr = (pared: boolean) => {
      const camara = crearCamaraDeDos({ direccion, despejado: despejadoEnElMundo(rapier, mundo) });
      camara.camara.aspect = 16 / 9;
      const antes = new THREE.Vector3();
      let mayor = 0;
      let muro: RAPIER.Collider | undefined;
      const posiciones: THREE.Vector3[] = [];
      for (let i = 0; i < 480; i++) {
        // Al segundo aparece una pared de 3 m de alto entre ellos y la cámara (z = 2); a los cuatro se va
        if (pared && i === 60)
          muro = mundo.createCollider(rapier.ColliderDesc.cuboid(10, 1.5, 0.1).setTranslation(0, 1.5, 2));
        if (muro && i === 240) {
          mundo.removeCollider(muro, false);
          muro = undefined;
        }
        mundo.step();
        camara.seguir(...juntos(0.5));
        camara.dibujar(1);
        if (i > 0) mayor = Math.max(mayor, camara.camara.position.distanceTo(antes));
        antes.copy(camara.camara.position);
        posiciones.push(camara.camara.position.clone());
      }
      return { mayor, posiciones };
    };
    const libre = correr(false);
    const tapada = correr(true);
    // Sin pared queda detrás de donde va a estar la pared; con ella, delante (la cara de la pared está en z = 1.9)
    expect(libre.posiciones[200]?.z).toBeGreaterThan(2.2);
    expect(tapada.posiciones[200]?.z).toBeLessThan(1.9);
    // Se acerca rápido pero sin saltar (de golpe serían más de 2 m en un paso), y al irse la pared vuelve
    expect(tapada.mayor).toBeLessThan(0.4);
    expect(tapada.posiciones[479]?.distanceTo(libre.posiciones[479] ?? new THREE.Vector3())).toBeLessThan(0.05);
    // Determinista: otra corrida igual da lo mismo
    const otra = correr(true);
    expect(otra.posiciones.map((p) => p.toArray())).toEqual(tapada.posiciones.map((p) => p.toArray()));
  });
});
