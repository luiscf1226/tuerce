// La cámara de los dos con jugadores de mentira: se separan hasta partir la pantalla y vuelven a juntarse.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearCamaraDeDos } from "./camara";

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
