// El agua (TU-24) en un mundo de Rapier de verdad, con una escena armada a mano: un patio y, al lado, una pileta.
// Lo que flota flota, lo que pesa se hunde, la corriente se lleva lo que flota, el nivel baja cuando se lo pide, y
// el muñeco que cae a un agua que se lo lleva cuenta como caída (y se avisa, para «Secos»); en una que `nadar`, flota.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { leerPlano } from "./formato";
import { crearNivel } from "./nivel";

/** El patio (x de −6 a 0, arriba en y = 0) y una pileta (x de 0 a 8) con el agua a ras del patio, de 2 m de hondo. */
function escena(agua: Record<string, unknown> = {}) {
  const raiz = new THREE.Group();
  raiz.userData = { nivel: 97, nombre: "La pileta", vacio: -10 };
  const caja = (nombre: string, [x, y, z]: number[], [w, h, d]: number[], extras: Record<string, unknown>) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
    m.name = nombre;
    m.position.set(x ?? 0, y ?? 0, z ?? 0);
    m.userData = extras;
    raiz.add(m);
  };
  const vacio = (nombre: string, [x, y, z]: number[], [sx, sy, sz]: number[], extras: Record<string, unknown>) => {
    const o = new THREE.Object3D();
    o.name = nombre;
    o.position.set(x ?? 0, y ?? 0, z ?? 0);
    o.scale.set(sx ?? 1, sy ?? 1, sz ?? 1);
    o.userData = extras;
    raiz.add(o);
  };
  caja("patio", [-3, -0.5, 0], [6, 1, 8], { tipo: "solido" });
  caja("fondo", [4, -2.25, 0], [8, 0.5, 8], { tipo: "solido" });
  caja("pared", [8.25, -1, 0], [0.5, 3, 8], { tipo: "solido" });
  vacio("salida-1", [-4, 0, 1], [1, 1, 1], { tipo: "salida", jugador: 1 });
  vacio("salida-2", [-4, 0, -1], [1, 1, 1], { tipo: "salida", jugador: 2 });
  // El agua: de x 0 a 8, de y −2 a 0 (la superficie a ras del patio)
  vacio("pileta", [4, -1, 0], [4, 1, 4], { tipo: "agua", ...agua });
  caja("huacal", [3, 1, 0], [0.5, 0.5, 0.5], { tipo: "pieza", pieza: "huacal" });
  caja("piedra", [5, 1, 0], [0.5, 0.5, 0.5], { tipo: "pieza", pieza: "huacal", masa: 20 });
  return raiz;
}

async function armar(agua: Record<string, unknown> = {}) {
  const { rapier, mundo } = await crearMundo();
  const plano = leerPlano(escena(agua));
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos });
  const entradas: [EntradaMuneco, EntradaMuneco] = [QUIETO, QUIETO];
  const correr = (pasos: number) => {
    for (let i = 0; i < pasos; i++) {
      nivel.antes(entradas);
      munecos[0].pasar(entradas[0]);
      munecos[1].pasar(entradas[1]);
      mundo.step();
      nivel.despues();
      armado.guardar();
    }
  };
  return { rapier, mundo, plano, armado, nivel, munecos, entradas, correr };
}

describe("el agua (agua.ts)", () => {
  it("se lee de la escena: la superficie arriba de la caja, el fondo abajo, y las propiedades", async () => {
    const { plano, nivel } = await armar({ corriente: 0.5, caer: "nadar" });
    expect(plano.aguas).toHaveLength(1);
    const pileta = nivel.agua("pileta");
    expect(pileta.lleno).toBeCloseTo(0);
    expect(pileta.fondo).toBeCloseTo(-2);
    expect(pileta.corriente).toBe(0.5);
    expect(pileta.caer).toBe("nadar");
    expect(pileta.hondura({ x: 4, y: -0.5, z: 0 })).toBeCloseTo(0.5);
    expect(pileta.hondura({ x: -1, y: -0.5, z: 0 })).toBeNull();
    expect(() => nivel.agua("rio")).toThrow(/agua «rio»/);
    expect(() => leerPlano(escena({ caer: "volar" }))).toThrow(/caer/);
  });

  it("lo liviano flota a ras del agua y lo que pesa más que el agua se hunde", async () => {
    const { nivel, correr } = await armar();
    const huacal = nivel.huacal("huacal").cuerpo;
    const piedra = nivel.huacal("piedra").cuerpo;
    // La piedra: 20 kg en una caja de 50 cm (125 litros) flotaría; dicho que es piedra, se hunde
    nivel.aguas.densidad(piedra, 2500);
    correr(300);
    // El huacal (8 kg en 125 litros) flota casi entero afuera: se hunde 1.6 cm de sus 50
    expect(huacal.translation().y).toBeGreaterThan(0.2);
    expect(huacal.translation().y).toBeLessThan(0.26);
    // Y quedó quieto
    const y = huacal.translation().y;
    correr(30);
    expect(huacal.translation().y).toBeCloseTo(y, 3);
    // La piedra, en el fondo (arriba de la losa, en −2)
    expect(piedra.translation().y).toBeLessThan(-1.6);
  });

  it("la corriente se lleva lo que flota hacia el frente de la zona, y al bajar el nivel baja con él", async () => {
    const { nivel, correr } = await armar({ corriente: 0.6 });
    const huacal = nivel.huacal("huacal").cuerpo;
    correr(120);
    const z0 = huacal.translation().z;
    correr(120);
    // Va hacia +z (el frente de la caja) casi a la velocidad del agua
    const v = (huacal.translation().z - z0) / 2;
    expect(v).toBeGreaterThan(0.45);
    expect(v).toBeLessThan(0.65);

    const pileta = nivel.agua("pileta");
    huacal.setTranslation({ x: 3, y: 0.3, z: 0 }, true);
    pileta.corriente = 0;
    pileta.irA(-1, 0.5);
    correr(60);
    expect(pileta.nivel).toBeCloseTo(-0.5, 1);
    expect(pileta.quieta).toBe(false);
    correr(120);
    expect(pileta.nivel).toBe(-1);
    expect(pileta.quieta).toBe(true);
    expect(huacal.translation().y).toBeLessThan(-0.7);
    expect(huacal.translation().y).toBeGreaterThan(-0.8);
  });

  it("el muñeco que cae a un agua que se lo lleva cuenta como caída: se avisa y reaparece", async () => {
    const { nivel, munecos, entradas, correr } = await armar();
    const mojados: number[] = [];
    nivel.aguas.alMojar((j) => mojados.push(j));
    // El turquesa camina derecho a la pileta; el rojo, quieto
    munecos[1].reaparecer({ x: -1.5, y: 0.02, z: -1 }, Math.PI / 2);
    entradas[1] = { ...QUIETO, avanzar: 1 };
    let cayo = false;
    for (let i = 0; i < 200 && !cayo; i++) {
      correr(1);
      cayo = mojados.length > 0;
    }
    entradas[1] = QUIETO;
    expect(mojados).toEqual([1]);
    expect(nivel.aguas.caidas).toEqual([0, 1]);
    // Reapareció junto al rojo, en el patio y seco
    correr(5);
    const p = munecos[1].partes.pelvis.translation();
    expect(p.x).toBeLessThan(0);
    expect(nivel.aguas.en(p)).toBeUndefined();
  });

  it("en un agua `nadar` el muñeco flota con la cabeza afuera y avanza despacio hacia donde mira", async () => {
    const { nivel, munecos, entradas, correr } = await armar({ caer: "nadar" });
    munecos[0].reaparecer({ x: 2, y: 0.2, z: 0 }, Math.PI / 2);
    correr(240);
    expect(nivel.aguas.caidas[0]).toBe(1);
    expect(nivel.puntoDeControl).toBe(0);
    // No reapareció: sigue en el agua, flotando
    const cabeza = munecos[0].partes.cabeza.translation();
    expect(cabeza.x).toBeGreaterThan(1);
    expect(cabeza.y).toBeGreaterThan(-0.1);
    const x0 = munecos[0].partes.pelvis.translation().x;
    entradas[0] = { ...QUIETO, avanzar: 1 };
    correr(120);
    expect(munecos[0].partes.pelvis.translation().x - x0).toBeGreaterThan(0.8);
  });

  it("el nivel viaja en la foto de la red: cada zona tiene un marcador cinemático a la altura de su superficie", async () => {
    const anfitrion = await armar({ corriente: 0.5 });
    const invitado = await armar({ corriente: 0.5 });
    anfitrion.nivel.agua("pileta").irA(-1.2, 1);
    anfitrion.nivel.agua("pileta").corriente = 0.25;
    anfitrion.correr(90);
    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    deAlla.forEach((c, i) => {
      const t = deAca[i]?.translation();
      if (t) c.setTranslation(t, false);
    });
    invitado.armado.guardar();
    invitado.armado.guardar();
    invitado.armado.dibujar(1, 1);
    const espejo = invitado.armado.escena.getObjectByName("agua pileta")?.children[0];
    expect(espejo?.position.y).toBeCloseTo(-1.2, 3);
  });
});
