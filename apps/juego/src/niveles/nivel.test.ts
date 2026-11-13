// Puntos de control y reaparición (TU-11) en el nivel de prueba, con un mundo de Rapier de verdad.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { armarNivel } from "./armar";
import type { GuionDeNivel } from "./guion";
import { NIVELES } from "./lista";
import { crearNivel, type Reaparicion } from "./nivel";
import { leerDelDisco } from "./prueba";

async function armar(guion: GuionDeNivel = NIVELES.prueba?.crearGuion() ?? {}) {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("99-prueba");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion });
  const reaparecidos: Reaparicion[] = [];
  /** Corre esos pasos con esas entradas, como la escena. */
  const correr = (pasos: number, rojo: EntradaMuneco = QUIETO, turquesa: EntradaMuneco = QUIETO) => {
    for (let i = 0; i < pasos; i++) {
      nivel.antes();
      munecos[0].pasar(rojo);
      munecos[1].pasar(turquesa);
      mundo.step();
      reaparecidos.push(...nivel.despues());
      armado.guardar();
    }
  };
  const pelvis = (jugador: 0 | 1) => new THREE.Vector3().copy(munecos[jugador].partes.pelvis.translation());
  return { mundo, plano, armado, munecos, nivel, correr, reaparecidos, pelvis };
}

/** El turquesa camina hacia el borde del patio, gira un poco y se cae; el rojo espera quieto en la salida. */
const AL_BORDE: EntradaMuneco = { avanzar: 1, girar: 0.15 };

describe("puntos de control", () => {
  it("se alcanzan en orden, para la pareja, y nunca se vuelve atrás", async () => {
    const { nivel, munecos, plano, correr } = await armar();
    const avisos: number[] = [];
    const dejar = nivel.avance.alCambiar((p) => avisos.push(p));
    correr(30);
    expect(nivel.avance.puntoDeControl()).toBe(0);

    // El turquesa llega al punto 1 (pasado el tablón): lo alcanza la pareja
    const uno = plano.puntos[1]?.lugares[1];
    if (!uno) throw new Error("sin punto 1");
    munecos[1].reaparecer(uno.posicion, uno.rumbo);
    correr(2);
    expect(nivel.avance.puntoDeControl()).toBe(1);
    expect(nivel.puntoDeControl).toBe(1);

    // El rojo salta directo al 3: se avisan el 2 y el 3, en orden
    const tres = plano.puntos[3]?.lugares[0];
    if (!tres) throw new Error("sin punto 3");
    munecos[0].reaparecer(tres.posicion, tres.rumbo);
    correr(2);
    expect(avisos).toEqual([1, 2, 3]);

    // Volver a la zona del 1 no lo cambia
    munecos[0].reaparecer(uno.posicion, uno.rumbo);
    correr(2);
    expect(nivel.avance.puntoDeControl()).toBe(3);
    dejar();
    expect(avisos).toEqual([1, 2, 3]);
    expect(nivel.avance.nivel).toBe(99);
  });

  it("al alcanzar el punto 1, el guion hunde la compuerta", async () => {
    const { nivel, munecos, plano, correr } = await armar();
    const compuerta = nivel.pieza("compuerta").cuerpo;
    const arriba = compuerta?.translation().y ?? 0;
    correr(60);
    expect(compuerta?.translation().y).toBeCloseTo(arriba);
    const uno = plano.puntos[1]?.lugares[0];
    if (!uno) throw new Error("sin punto 1");
    munecos[0].reaparecer(uno.posicion, uno.rumbo);
    correr(120);
    expect((compuerta?.translation().y ?? 0) - arriba).toBeLessThan(-2);
  });

  it("`irA` pone a los dos en el punto, sin avisar, y el guion deja el nivel como al llegar ahí", async () => {
    const { nivel, plano, correr, pelvis } = await armar();
    const avisos: number[] = [];
    nivel.avance.alCambiar((p) => avisos.push(p));
    nivel.avance.irA(2);
    correr(60);
    expect(nivel.avance.puntoDeControl()).toBe(2);
    expect(avisos).toEqual([]);
    for (const jugador of [0, 1] as const) {
      const lugar = plano.puntos[2]?.lugares[jugador].posicion;
      expect(pelvis(jugador).distanceTo(lugar ?? new THREE.Vector3())).toBeLessThan(0.7);
    }
    expect(nivel.pieza("compuerta").cuerpo?.translation().y).toBeLessThan(0);
    // Fuera de rango se queda en los bordes
    nivel.avance.irA(40);
    expect(nivel.avance.puntoDeControl()).toBe(3);
  });

  it("`retomar` fija el punto sin mover a nadie, avisa, solo avanza, y la compuerta no se vuelve a hundir", async () => {
    const { nivel, munecos, plano, correr, pelvis } = await armar();
    const avisos: number[] = [];
    nivel.avance.alCambiar((p) => avisos.push(p));
    correr(10);
    const antes = pelvis(0);
    nivel.avance.retomar(1);
    nivel.avance.retomar(0);
    nivel.avance.retomar(Number.NaN);
    correr(120);
    expect(nivel.avance.puntoDeControl()).toBe(1);
    expect(avisos).toEqual([1]);
    expect(pelvis(0).distanceTo(antes)).toBeLessThan(0.3);
    const compuerta = nivel.pieza("compuerta").cuerpo;
    const abajo = compuerta?.translation().y ?? 0;
    expect(abajo).toBeLessThan(0);
    // Al llegar después al punto 2, el guion no repite lo del punto 1 (la compuerta no sube a hundirse otra vez)
    const dos = plano.puntos[2]?.lugares[0];
    if (!dos) throw new Error("sin punto 2");
    munecos[0].reaparecer(dos.posicion, dos.rumbo);
    let masAlta = abajo;
    for (let i = 0; i < 90; i++) {
      correr(1);
      masAlta = Math.max(masAlta, compuerta?.translation().y ?? 0);
    }
    expect(nivel.avance.puntoDeControl()).toBe(2);
    expect(masAlta - abajo).toBeLessThan(0.01);
  });
});

describe("reaparición", () => {
  it("el que cae al vacío reaparece de pie junto a su compañero, si este está firme", async () => {
    const { munecos, correr, reaparecidos, pelvis, nivel } = await armar();
    for (let i = 0; i < 400 && reaparecidos.length === 0; i++) correr(1, QUIETO, AL_BORDE);
    expect(reaparecidos.length).toBeGreaterThan(0);
    const primera = reaparecidos[0];
    expect(primera?.jugador).toBe(1);
    expect(primera?.junto).toBe(true);
    // Quedó a su izquierda (−z, mirando hacia +x), a menos de un metro del rojo, y no hay derrota: sigue jugando
    expect(primera?.posicion.distanceTo(pelvis(0).setY(0))).toBeLessThan(1);
    expect(primera?.posicion.z).toBeLessThan(pelvis(0).z);
    expect(nivel.avance.puntoDeControl()).toBe(0);
    // Un segundo después de reaparecer está de pie, en el patio, junto al rojo
    const reapareciendo = reaparecidos.length;
    correr(60);
    expect(reaparecidos.length).toBe(reapareciendo);
    expect(munecos[1].estado).toBe("de pie");
    expect(pelvis(1).y).toBeGreaterThan(0.3);
    expect(pelvis(1).distanceTo(pelvis(0))).toBeLessThan(1.2);
  });

  it("si el compañero no está firme, reaparece en el último punto de control", async () => {
    const { munecos, nivel, plano, correr, reaparecidos } = await armar();
    nivel.avance.irA(1);
    correr(30);
    // Los dos caminan hacia atrás, al hueco: el tablón es angosto y van lado a lado, así que caen los dos
    correr(240, { avanzar: -1, girar: 0 }, { avanzar: -1, girar: 0 });
    expect(reaparecidos.length).toBeGreaterThanOrEqual(2);
    const primera = reaparecidos[0];
    expect(primera?.junto).toBe(false);
    expect(primera?.posicion.x).toBeCloseTo(plano.puntos[1]?.lugares[0].posicion.x ?? 0);
    correr(60);
    for (const m of munecos) expect(m.estado).toBe("de pie");
  });

  it("no reaparece junto al compañero del otro lado de una pared", async () => {
    const { munecos, nivel, correr } = await armar();
    nivel.avance.irA(1);
    // El rojo de pie justo antes del escalón; un lugar arriba del escalón no vale: queda tapado o con otro piso
    munecos[0].reaparecer({ x: 15.2, y: 0.03, z: 0.45 }, Math.PI / 2);
    correr(30);
    const donde = nivel.dondeReaparece(1);
    expect(donde.junto).toBe(true);
    expect(donde.posicion.x).toBeLessThan(15.5);
    expect(donde.posicion.y).toBeCloseTo(0.03, 1);
  });

  it("es determinista: dos corridas iguales dan lo mismo", async () => {
    const corrida = async () => {
      const { correr, reaparecidos, pelvis } = await armar();
      correr(330, QUIETO, AL_BORDE);
      return [reaparecidos.map((r) => r.posicion.toArray()), pelvis(1).toArray()];
    };
    expect(await corrida()).toEqual(await corrida());
  });
});

describe("secreto y logro (TU-29)", () => {
  it("el primero que entra a la zona del secreto lo encuentra para la pareja, una sola vez", async () => {
    const { nivel, munecos, correr } = await armar();
    const avisos: string[] = [];
    nivel.premios.alGanar((p) => avisos.push(p));
    correr(10);
    expect(nivel.secreto).toBe(false);
    munecos[1].reaparecer({ x: 23.4, y: 1.53, z: -2.3 }, 0);
    correr(5);
    expect(nivel.secreto).toBe(true);
    expect(nivel.premios.tiene("secreto")).toBe(true);
    munecos[0].reaparecer({ x: 23.4, y: 1.53, z: -2.0 }, 0);
    correr(5);
    expect(avisos).toEqual(["secreto"]);
  });

  it("lo ya guardado se marca sin avisar y la zona no lo vuelve a dar", async () => {
    const { nivel, munecos, correr } = await armar();
    const avisos: string[] = [];
    nivel.premios.alGanar((p) => avisos.push(p));
    nivel.premios.marcar("secreto");
    munecos[1].reaparecer({ x: 23.4, y: 1.53, z: -2.3 }, 0);
    correr(5);
    expect(nivel.secreto).toBe(true);
    expect(avisos).toEqual([]);
  });

  it("el guion da el logro «Mudanza» cuando el huacal llega arriba del escalón", async () => {
    const { nivel, correr } = await armar();
    const avisos: string[] = [];
    nivel.premios.alGanar((p) => avisos.push(p));
    correr(30);
    expect(nivel.logro).toBe(false);
    const huacal = nivel.pieza("huacal").cuerpo;
    huacal?.setTranslation({ x: 18, y: 1.85, z: 0 }, true);
    correr(30);
    expect(nivel.logro).toBe(true);
    expect(avisos).toEqual(["logro"]);
  });
});
