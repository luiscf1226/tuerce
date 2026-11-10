// Saltar, caer y levantarse (TU-04), en Node con Rapier sin ventana.
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type EstadoMuneco, NOMBRES_PARTES, QUIETO } from "./muneco";

const GRADOS = Math.PI / 180;
/** Parado, la cabeza queda a 1.21 m: por encima de esto está de pie de verdad. */
const CABEZA_DE_PIE = 1.05;
/** Cuánto tiene para levantarse después de caer: quedarse quieto (1 s), recuperar la firmeza (1.1 s) y algo más. */
const PLAZO_LEVANTARSE = 4.5;

/** Suelo plano y, si se pide, un escalón de 1.5 m de alto que termina en z = 0.5, con el muñeco arriba. */
async function armar({ borde = false } = {}) {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
  if (borde)
    mundo.createCollider(rapier.ColliderDesc.cuboid(2, 0.75, 2).setTranslation(0, 0.75, -1.5).setFriction(0.8));
  const muneco = crearMuneco(rapier, mundo, { posicion: borde ? { x: 0, y: 1.5, z: -0.6 } : undefined });
  const estados = new Set<EstadoMuneco>();
  /** Corre pasos hasta `segundos` o hasta que `parar` diga que sí; devuelve lo que pasó en el camino. */
  const correr = (
    segundos: number,
    entrada: (paso: number) => EntradaMuneco = () => QUIETO,
    parar: () => boolean = () => false,
  ) => {
    let inclinacion = 0;
    let pelvis = Number.NEGATIVE_INFINITY;
    let pasos = 0;
    for (; pasos < segundos * PASOS_POR_SEGUNDO && !parar(); pasos++) {
      muneco.pasar(entrada(pasos));
      mundo.step();
      estados.add(muneco.estado);
      inclinacion = Math.max(inclinacion, muneco.inclinacion());
      pelvis = Math.max(pelvis, muneco.partes.pelvis.translation().y);
    }
    return { inclinacion, pelvis, segundos: pasos / PASOS_POR_SEGUNDO };
  };
  const dePie = () => muneco.estado === "de pie";
  return { muneco, correr, estados, dePie };
}

describe("saltar, caer y levantarse", () => {
  it("salta: la pelvis sube más de 30 cm y cae de pie", async () => {
    const { muneco, correr, estados } = await armar();
    correr(1);
    const antes = muneco.partes.pelvis.translation().y;
    estados.clear();
    // El botón queda apretado medio segundo: salta una sola vez, al apretarlo
    const salto = correr(2.5, (i) => ({ ...QUIETO, saltar: i < 30 }));
    console.log(
      `salto: la pelvis subió ${((salto.pelvis - antes) * 100).toFixed(0)} cm; ` +
        `inclinación máx ${(salto.inclinacion / GRADOS).toFixed(1)}°`,
    );
    expect(salto.pelvis - antes).toBeGreaterThan(0.3);
    expect(estados.has("en el aire")).toBe(true);
    expect(estados.has("caido")).toBe(false);
    expect(muneco.estado).toBe("de pie");
    expect(salto.inclinacion).toBeLessThan(15 * GRADOS);
    expect(muneco.partes.cabeza.translation().y).toBeGreaterThan(CABEZA_DE_PIE);
  });

  it("no salta en el aire ni dos veces con el mismo apretón", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    let saltos = 0;
    let antes = muneco.estado;
    correr(
      3,
      (i) => ({ ...QUIETO, saltar: i % 20 < 10 }),
      () => {
        if (antes === "de pie" && muneco.estado === "en el aire") saltos++;
        antes = muneco.estado;
        return false;
      },
    );
    // Con 3 s de apretar y soltar cada 1/3 s, entran unos 4 saltos de ~0.6 s más la espera; nunca 9
    expect(saltos).toBeGreaterThan(1);
    expect(saltos).toBeLessThan(6);
  });

  it("un empujón fuerte lo tira y se levanta solo", async () => {
    const { muneco, correr, estados, dePie } = await armar();
    correr(1);
    // Un empujón de 4 m/s al centro de masa, de costado a la altura del pecho
    muneco.partes.torso.applyImpulse({ x: muneco.masa * 4, y: 0, z: 0 }, true);
    const caida = correr(1.5);
    expect(muneco.estado).toBe("caido");
    expect(caida.inclinacion).toBeGreaterThan(60 * GRADOS);
    expect(muneco.partes.cabeza.translation().y).toBeLessThan(0.5);
    const levantarse = correr(PLAZO_LEVANTARSE, undefined, dePie);
    console.log(
      `empujón: cayó a ${(caida.inclinacion / GRADOS).toFixed(0)}° y se levantó en ` +
        `${(caida.segundos + levantarse.segundos).toFixed(1)} s`,
    );
    expect(estados.has("levantandose")).toBe(true);
    expect(muneco.estado).toBe("de pie");
    correr(0.5);
    expect(muneco.inclinacion()).toBeLessThan(15 * GRADOS);
    expect(muneco.partes.cabeza.translation().y).toBeGreaterThan(CABEZA_DE_PIE);
  });

  it("bajar caminando de un escalón de 1.5 m lo tira y se levanta solo", async () => {
    const { muneco, correr, dePie } = await armar({ borde: true });
    correr(0.5);
    // Camina hasta que se cae; ahí suelta todo
    const caida = correr(
      4,
      () => ({ avanzar: 1, girar: 0 }),
      () => muneco.estado === "caido",
    );
    expect(muneco.estado).toBe("caido");
    const tirado = correr(1);
    const levantarse = correr(PLAZO_LEVANTARSE, undefined, dePie);
    console.log(
      `escalón: cayó a ${(Math.max(caida.inclinacion, tirado.inclinacion) / GRADOS).toFixed(0)}° ` +
        `y se levantó ${(tirado.segundos + levantarse.segundos).toFixed(1)} s después`,
    );
    expect(Math.max(caida.inclinacion, tirado.inclinacion)).toBeGreaterThan(60 * GRADOS);
    expect(muneco.estado).toBe("de pie");
    correr(0.5);
    expect(muneco.partes.pelvis.translation().y).toBeLessThan(0.7); // abajo, no de vuelta en el escalón
    expect(muneco.inclinacion()).toBeLessThan(15 * GRADOS);
    expect(muneco.partes.cabeza.translation().y).toBeGreaterThan(CABEZA_DE_PIE);
  });

  it("es determinista: saltar, caer y levantarse dan lo mismo dos veces", async () => {
    const corrida = async () => {
      const { muneco, correr } = await armar();
      correr(1, (i) => ({ avanzar: 0.5, girar: 0, saltar: i > 20 && i < 25 }));
      muneco.partes.torso.applyImpulse({ x: muneco.masa * 4, y: 0, z: 1 }, true);
      correr(5);
      return { estado: muneco.estado, posiciones: NOMBRES_PARTES.map((n) => muneco.partes[n].translation()) };
    };
    expect(await corrida()).toEqual(await corrida());
  });
});
