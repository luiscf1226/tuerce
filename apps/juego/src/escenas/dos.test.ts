// Dos muñecos en el mismo mundo de Rapier: cada uno hace lo que pide su jugador y no se atraviesan.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import { esSaturado } from "../imagen";
import { crearMundo } from "../motor/fisica";
import { crearMuneco } from "../muneco";
import { COLORES } from "./colores";
import { crearEscenaDos } from "./dos";

const andar = (avanzar: number, girar = 0): EntradaJugador => ({ ...entradaQuieta(), avanzar, girar });

describe("escena dos", () => {
  it("se arma y avanza sin errores", async () => {
    const { rapier, mundo } = await crearMundo();
    const dos = crearEscenaDos(rapier, mundo, new URLSearchParams());
    for (let i = 0; i < 10; i++) dos.pasar();
    dos.dibujar(0.5);
    expect(dos.nombre).toBe("dos");
  });

  it("cada muñeco hace lo que pide su jugador", async () => {
    const { rapier, mundo } = await crearMundo();
    const dos = crearEscenaDos(rapier, mundo, new URLSearchParams("j1=andar:1"));
    const [rojo, turquesa] = dos.munecos;
    const inicio = [rojo.partes.pelvis.translation(), turquesa.partes.pelvis.translation()];
    for (let i = 0; i < 3 * 60; i++) dos.pasar();
    const fin = [rojo.partes.pelvis.translation(), turquesa.partes.pelvis.translation()];
    expect((fin[0]?.x ?? 0) - (inicio[0]?.x ?? 0)).toBeGreaterThan(2);
    expect(Math.abs((fin[1]?.x ?? 0) - (inicio[1]?.x ?? 0))).toBeLessThan(0.15);
    expect(fin[1]?.y).toBeGreaterThan(0.3);
  });

  it("la cámara se aleja cuando los dos se separan", async () => {
    const { rapier, mundo } = await crearMundo();
    const dos = crearEscenaDos(rapier, mundo, new URLSearchParams("j1=andar:1,girar:-0.1&j2=andar:1,girar:0.1"));
    const [rojo, turquesa] = dos.munecos;
    dos.pasar();
    dos.dibujar(1);
    const distancia = () => {
      const a = rojo.partes.pelvis.translation();
      const b = turquesa.partes.pelvis.translation();
      return dos.camara.position.distanceTo(new THREE.Vector3((a.x + b.x) / 2, 0.55, (a.z + b.z) / 2));
    };
    const cerca = distancia();
    for (let i = 0; i < 4 * 60; i++) dos.pasar();
    dos.dibujar(1);
    expect(distancia()).toBeGreaterThan(cerca + 1);
  });

  it("lo único con color son los dos pañuelos", async () => {
    const { rapier, mundo } = await crearMundo();
    const dos = crearEscenaDos(rapier, mundo, new URLSearchParams());
    const conColor = new Set<number>();
    dos.escena.traverse((objeto) => {
      if (!(objeto instanceof THREE.Mesh)) return;
      const materiales: THREE.Material[] = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
      for (const m of materiales) {
        if ("color" in m && m.color instanceof THREE.Color && esSaturado(m.color.getHex()))
          conColor.add(m.color.getHex());
      }
    });
    expect([...conColor].sort()).toEqual([COLORES.panueloRojo, COLORES.panueloTurquesa].sort());
  });
});

describe("dos muñecos en un mundo sin ventana", () => {
  async function armar() {
    const { rapier, mundo } = await crearMundo();
    mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
    return { rapier, mundo };
  }

  it("con entradas distintas se mueven cada uno por su lado", async () => {
    const { rapier, mundo } = await armar();
    const a = crearMuneco(rapier, mundo, { posicion: { x: -1, y: 0, z: 0 }, rumbo: 0, indice: 0 });
    const b = crearMuneco(rapier, mundo, { posicion: { x: 1, y: 0, z: 0 }, rumbo: 0, indice: 1 });
    for (let i = 0; i < 3 * 60; i++) {
      a.pasar(andar(1));
      b.pasar(andar(0, 1));
      mundo.step();
    }
    const pa = a.partes.pelvis.translation();
    const pb = b.partes.pelvis.translation();
    // A fue derecho hacia +z sin girar; B giró en el lugar sin irse
    expect(pa.z).toBeGreaterThan(2.5);
    expect(Math.abs(pa.x + 1)).toBeLessThan(0.4);
    expect(Math.abs(a.rumbo)).toBeLessThan(0.01);
    expect(b.rumbo).toBeGreaterThan(1.5);
    expect(Math.hypot(pb.x - 1, pb.z)).toBeLessThan(0.4);
  });

  it("caminando de frente uno contra el otro, chocan y no se atraviesan", async () => {
    const { rapier, mundo } = await armar();
    const a = crearMuneco(rapier, mundo, { posicion: { x: -1.2, y: 0, z: 0 }, rumbo: Math.PI / 2, indice: 0 });
    const b = crearMuneco(rapier, mundo, { posicion: { x: 1.2, y: 0, z: 0 }, rumbo: -Math.PI / 2, indice: 1 });
    let menor = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 4 * 60; i++) {
      // medio segundo para acomodarse y después los dos caminan hacia el otro
      const entrada = i > 30 ? andar(1) : entradaQuieta();
      a.pasar(entrada);
      b.pasar(entrada);
      mundo.step();
      const pa = a.partes.pelvis.translation();
      const pb = b.partes.pelvis.translation();
      menor = Math.min(menor, Math.hypot(pa.x - pb.x, pa.z - pb.z));
      // A viene de la izquierda y B de la derecha: si se cruzaran, A quedaría a la derecha de B
      expect(pa.x, `se atravesaron en el paso ${i}`).toBeLessThan(pb.x);
    }
    console.log(`de frente: lo más cerca que quedaron las pelvis fue ${menor.toFixed(2)} m`);
    expect(menor).toBeGreaterThan(0.2);
    // y se tocaron de verdad: no se quedaron lejos
    expect(menor).toBeLessThan(0.7);
  });
});
