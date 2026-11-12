// El nivel 0, El patio (TU-13), con físicas de verdad: cada misión se termina de a dos, con los dos muñecos
// manejados como los manejaría un jugador (andar, girar, saltar, alzar los brazos). Las misiones «de a dos» además
// prueban que uno solo no puede.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
type Manejo = (m: Muneco, paso: number) => EntradaMuneco;
const quieto: Manejo = () => QUIETO;

/** Si la escalera quedó apoyada contra el muro: el mecanismo la deja trabada (dinámica, pero no se mueve). */
const apoyada = (c: RAPIER.RigidBody) => c.isDynamic() && c.effectiveInvMass().x === 0 && c.rotation().z > 0.2;

/** Camina hacia (x, z): gira hacia allá y avanza cuando ya mira más o menos hacia allá. */
function hacia(x: number, z: number, extra: Partial<EntradaMuneco> = {}, velocidad = 1): Manejo {
  return (m) => {
    const p = m.partes.pelvis.translation();
    const rumbo = Math.atan2(x - p.x, z - p.z);
    let diferencia = rumbo - m.rumbo;
    diferencia = Math.atan2(Math.sin(diferencia), Math.cos(diferencia));
    const girar = Math.max(-1, Math.min(1, diferencia * 3));
    return { ...QUIETO, ...extra, girar, avanzar: Math.abs(diferencia) < 0.35 ? velocidad : 0 };
  };
}

async function armarPatio(punto = 0) {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("00-patio");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.patio?.crearGuion() });
  if (punto > 0) nivel.avance.irA(punto);
  const caidas: number[] = [];
  /** Corre hasta `pasos` pasos con el manejo de cada uno, o hasta que `listo()` dé verdadero. Devuelve los pasos. */
  const correr = (pasos: number, rojo: Manejo = quieto, turquesa: Manejo = quieto, listo = () => false) => {
    let i = 0;
    for (; i < pasos && !listo(); i++) {
      const entradas = [rojo(munecos[0], i), turquesa(munecos[1], i)] as const;
      nivel.antes(entradas);
      munecos[0].pasar(entradas[0]);
      munecos[1].pasar(entradas[1]);
      mundo.step();
      for (const r of nivel.despues()) caidas.push(r.jugador);
      armado.guardar();
    }
    return i;
  };
  const pelvis = (j: 0 | 1) => new THREE.Vector3().copy(munecos[j].partes.pelvis.translation());
  const cuerpo = (nombre: string) => {
    const c = nivel.pieza(nombre).cuerpo;
    if (!c) throw new Error(`sin cuerpo: ${nombre}`);
    return c;
  };
  return { rapier, mundo, plano, armado, nivel, munecos, correr, pelvis, cuerpo, caidas };
}

describe("el patio (niveles/00-patio)", () => {
  it("tiene cinco puntos de control, uno por misión, y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo } = await armarPatio();
    expect(plano.numero).toBe(0);
    expect(plano.nombre).toBe("El patio");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  it("`punto=N` empieza después de la misión N, cada uno en su lugar", async () => {
    for (const punto of [1, 2, 3, 4, 5]) {
      const { nivel, correr, munecos } = await armarPatio(punto);
      correr(60);
      expect(nivel.puntoDeControl).toBe(punto);
      for (const m of munecos) expect(m.estado).toBe("de pie");
    }
  });

  it("misión 1: despiertan tirados en el montón de trapos, se levantan y llegan al portón", async () => {
    const { nivel, munecos, correr } = await armarPatio();
    const estados = new Set<string>();
    correr(300, quieto, quieto, () => {
      for (const m of munecos) estados.add(m.estado);
      return false;
    });
    expect(estados.has("caido")).toBe(true);
    expect(munecos.every((m) => m.estado === "de pie")).toBe(true);
    const pasos = correr(900, hacia(0, 0.75), hacia(0, -0.15), () => nivel.puntoDeControl >= 1);
    console.log(`patio · misión 1: llegan al portón en ${pasos} pasos`);
    expect(nivel.puntoDeControl).toBe(1);
  });

  it("misión 2: el portón no abre empujando solo; con uno en la aldaba y el otro empujando, sí", async () => {
    // Solo: el turquesa empuja la hoja y el rojo mira
    const solo = await armarPatio(1);
    const porton = () => solo.nivel.pieza("porton").cuerpo;
    solo.correr(400, quieto, hacia(6, -0.3));
    console.log(
      `patio · misión 2 solo: turquesa en x ${solo.pelvis(1).x.toFixed(2)}, hoja girada ${porton()?.rotation().y.toFixed(3)}`,
    );
    expect(solo.nivel.puntoDeControl).toBe(1);
    expect(solo.pelvis(1).x).toBeLessThan(2);

    // De a dos: el rojo empuja la aldaba con los brazos arriba y el turquesa empuja la hoja
    const dos = await armarPatio(1);
    let activa = false;
    const pasos = dos.correr(
      900,
      (m, i) => {
        activa ||= dos.nivel.palanca("aldaba").activa;
        return hacia(1.6, 0.85, i > 20 ? AMBOS : {}, 0.8)(m, i);
      },
      (m, i) => (i < 60 ? QUIETO : hacia(6, -0.3)(m, i)),
      () => dos.nivel.puntoDeControl >= 2,
    );
    console.log(`patio · misión 2: pasan el portón en ${pasos} pasos (aldaba ${activa})`);
    expect(activa).toBe(true);
    expect(dos.nivel.puntoDeControl).toBe(2);
  });

  it("misión 3: la escalera la cargan los dos hasta el muro, se apoya y suben por ella (y ganan el logro)", async () => {
    const { nivel, correr, pelvis, cuerpo, munecos } = await armarPatio(2);
    const escalera = cuerpo("escalera");
    let baja = Number.POSITIVE_INFINITY;
    let cuando = -1;
    // Los dos, uno de cada lado, alzan los brazos y caminan derecho hacia el muro con la escalera entre ellos
    // (los brazos se alzan después de reaparecer: con el botón ya apretado no se agarra)
    const cargar =
      (z: number): Manejo =>
      (m, i) =>
        hacia(11.4, z, i > 15 ? AMBOS : {}, 0.6)(m, i);
    const pasos = correr(1200, cargar(-0.55), cargar(-1.45), () => {
      if (escalera.translation().y > 1.05) baja = Math.min(baja, escalera.translation().y);
      if (cuando < 0 && escalera.isKinematic()) cuando = nivel.pasos;
      return cuando >= 0 && nivel.pasos > cuando + 60;
    });
    console.log(`patio · misión 3: la escalera se apoya en ${cuando} pasos (cargada a ${baja.toFixed(2)} m o más)`);
    // Apoyada queda trabada (dinámica, para que la cámara no la tome por pared)
    expect(escalera.isKinematic()).toBe(false);
    expect(apoyada(escalera)).toBe(true);
    expect(nivel.logro).toBe(true);
    expect(pasos).toBeLessThan(1200);
    // Arriba, la punta de la escalera queda en el borde del muro
    const z = escalera.translation().z;
    // Sueltan, se hacen atrás hasta el pie de la escalera y suben, uno detrás del otro
    correr(30);
    const subir = (j: 0 | 1) => {
      correr(400, j === 0 ? hacia(8.3, z) : quieto, j === 1 ? hacia(8.3, z) : quieto, () => pelvis(j).x < 8.6);
      correr(400, j === 0 ? hacia(14, z) : quieto, j === 1 ? hacia(14, z) : quieto, () => pelvis(j).x > 13.4);
      console.log(
        `patio · misión 3: ${j === 0 ? "el rojo" : "el turquesa"} arriba en x ${pelvis(j).x.toFixed(2)}, y ${pelvis(j).y.toFixed(2)} (${munecos[j].estado})`,
      );
    };
    subir(0);
    expect(nivel.puntoDeControl).toBe(3);
    subir(1);
    for (const j of [0, 1] as const) expect(pelvis(j).y).toBeGreaterThan(2.5);
  });

  it("misión 3: uno solo no puede apoyar la escalera, y si la botan no hay logro", async () => {
    const solo = await armarPatio(2);
    solo.correr(900, (m, i) => hacia(11.4, -0.55, i > 15 ? AMBOS : {}, 0.6)(m, i));
    expect(solo.cuerpo("escalera").isKinematic()).toBe(false);
    expect(apoyada(solo.cuerpo("escalera"))).toBe(false);

    // Los dos la levantan y la sueltan a medio camino: se bota y vuelve sola a los barriles. La vuelven a cargar
    // hasta el muro, pero ya no hay logro
    const { nivel, correr, cuerpo, pelvis } = await armarPatio(2);
    const escalera = cuerpo("escalera");
    const cargar =
      (z: number): Manejo =>
      (m, i) =>
        hacia(11.4, z, i > 15 ? AMBOS : {}, 0.6)(m, i);
    correr(600, cargar(-0.55), cargar(-1.45), () => escalera.translation().x > 9.45);
    expect(escalera.translation().y).toBeGreaterThan(1.05);
    expect(escalera.isKinematic()).toBe(false);
    correr(30);
    expect(escalera.translation().y).toBeLessThan(0.3);
    correr(120);
    expect(escalera.translation().x).toBeCloseTo(5.5, 1);
    expect(escalera.translation().y).toBeCloseTo(0.93, 1);
    // Vuelven a donde estaban, miran hacia el muro y la cargan otra vez
    correr(400, hacia(4.6, -0.55), hacia(4.6, -1.45), () => pelvis(0).x < 4.9 && pelvis(1).x < 4.9);
    correr(60, hacia(20, -0.55, {}, 0), hacia(20, -1.45, {}, 0));
    correr(1000, cargar(-0.55), cargar(-1.45), () => apoyada(escalera));
    console.log(`patio · misión 3 botándola: apoyada ${apoyada(escalera)}, logro ${nivel.logro}`);
    expect(apoyada(escalera)).toBe(true);
    expect(nivel.logro).toBe(false);
  });

  it("misión 4: caminando suben el techo de lámina; el que se para se resbala para abajo", async () => {
    const { nivel, correr, pelvis } = await armarPatio(3);
    // El rojo sube hasta la mitad del techo y se para: se va para abajo
    correr(400, hacia(30, 0.45), quieto, () => pelvis(0).x > 16);
    const arriba = pelvis(0).x;
    correr(90);
    console.log(
      `patio · misión 4: el rojo se paró en x ${arriba.toFixed(2)} y resbaló hasta ${pelvis(0).x.toFixed(2)}`,
    );
    expect(pelvis(0).x).toBeLessThan(arriba - 0.5);
    // Caminando sin pararse, los dos llegan a la losa
    const pasos = correr(900, hacia(30, 0.45), hacia(30, -0.45), () => pelvis(0).x > 19 && pelvis(1).x > 19);
    console.log(`patio · misión 4: los dos en la losa en ${pasos} pasos`);
    expect(nivel.puntoDeControl).toBe(4);
  });

  it("misión 5: saltan de la losa al camión que maniobra; el primero que sube lo frena", async () => {
    const { nivel, correr, pelvis, cuerpo, munecos, caidas } = await armarPatio(4);
    const camion = cuerpo("camion");
    let antes = camion.translation().z;
    let velocidad = 0;
    const medir = () => {
      const z = camion.translation().z;
      velocidad = (z - antes) * 60;
      antes = z;
      return false;
    };
    /** Va hasta el borde de la losa y espera ahí a que la palangana vaya a quedar debajo; entonces se tira. */
    const saltar = (j: 0 | 1): Manejo => {
      let tirarse = false;
      return (m, i) => {
        const p = pelvis(j);
        // Dónde va a estar el medio de la palangana cuando caiga (en medio segundo)
        const palangana = camion.translation().z - 0.35 + velocidad * 0.6;
        tirarse ||= p.x > 20.3 && Math.abs(palangana - p.z) < 0.8;
        if (tirarse) return { ...QUIETO, avanzar: 1 };
        return p.x < 20.3 ? hacia(20.5, p.z)(m, i) : QUIETO;
      };
    };
    // El camión ya maniobra (arrancó al llegar a la losa)
    correr(60, quieto, quieto, medir);
    expect(Math.abs(velocidad)).toBeGreaterThan(0.3);
    const pasos = correr(1200, saltar(0), quieto, () => medir() || nivel.puntoDeControl >= 5);
    console.log(`patio · misión 5: el rojo cae al camión en ${pasos} pasos (caídas a la calle: ${caidas.length})`);
    expect(nivel.puntoDeControl).toBe(5);
    correr(90, quieto, quieto, medir);
    expect(Math.abs(velocidad)).toBeLessThan(0.01);
    expect(nivel.cayo(0)).toBe(false);
    expect(pelvis(0).y).toBeGreaterThan(2.8);
    // El turquesa salta al camión ya quieto
    correr(600, quieto, saltar(1), () => medir() || (pelvis(1).x > 21.4 && munecos[1].estado === "de pie"));
    expect(nivel.cayo(1)).toBe(false);
    expect(pelvis(1).y).toBeGreaterThan(2.8);
  });

  it("el secreto: la piñata olvidada en el palo de mango", async () => {
    const { nivel, correr } = await armarPatio(2);
    correr(600, hacia(7.9, -2.55), quieto, () => nivel.secreto);
    expect(nivel.secreto).toBe(true);
  });
});
