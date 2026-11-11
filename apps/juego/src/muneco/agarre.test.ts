// Brazos por separado y agarre (TU-05), en Node con Rapier sin ventana.
import type RAPIER from "@dimforge/rapier3d-compat";
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { MEDIDAS } from "./ajustes";
import { crearMuneco, type EntradaMuneco, NOMBRES_PARTES, QUIETO } from "./muneco";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };

/** Altura de la mano: la punta del brazo, medio largo por debajo de su centro en el marco del brazo. */
function alturaMano(brazo: RAPIER.RigidBody) {
  const r = brazo.rotation();
  const abajo = 1 - 2 * (r.x * r.x + r.z * r.z); // componente y del eje y local
  return brazo.translation().y - abajo * (MEDIDAS.brazo.largo / 2);
}

async function armar() {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
  const muneco = crearMuneco(rapier, mundo);
  const correr = (segundos: number, entrada: (paso: number) => EntradaMuneco = () => QUIETO, cada = () => {}) => {
    for (let i = 0; i < segundos * PASOS_POR_SEGUNDO; i++) {
      muneco.pasar(entrada(i));
      mundo.step();
      cada();
    }
  };
  /** Una caja de 50 cm y 3 kg a la altura de las manos, adelante, sobre un pedestal angosto. */
  const caja = () => {
    const c = mundo.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 1.1, 0.55));
    mundo.createCollider(rapier.ColliderDesc.cuboid(0.25, 0.25, 0.25).setMass(3).setFriction(0.6), c);
    mundo.createCollider(rapier.ColliderDesc.cuboid(0.15, 0.42, 0.15).setTranslation(0, 0.42, 0.75));
    return c;
  };
  /** Una rama quieta y horizontal, al alcance de las manos solo saltando. */
  const rama = () =>
    mundo.createCollider(
      rapier.ColliderDesc.capsule(1, 0.05)
        .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        .setTranslation(0, 1.82, 0.3),
    );
  return { rapier, mundo, muneco, correr, caja, rama };
}

describe("brazos y agarre", () => {
  it("cada brazo sube con su botón y el otro sigue colgando", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    const { brazoIzquierdo, brazoDerecho } = muneco.partes;
    const colgando = alturaMano(brazoIzquierdo);
    correr(0.5, () => ({ ...QUIETO, brazoIzquierdo: true }));
    console.log(
      `brazo: la mano izquierda pasó de ${colgando.toFixed(2)} m a ${alturaMano(brazoIzquierdo).toFixed(2)} m; ` +
        `la derecha quedó en ${alturaMano(brazoDerecho).toFixed(2)} m`,
    );
    expect(alturaMano(brazoIzquierdo)).toBeGreaterThan(MEDIDAS.brazo.hombroY + 0.15);
    expect(alturaMano(brazoDerecho)).toBeLessThan(colgando + 0.05);
    // Al soltar el botón el brazo vuelve a colgar
    correr(1);
    expect(alturaMano(brazoIzquierdo)).toBeLessThan(colgando + 0.05);
    expect(muneco.estado).toBe("de pie");
  });

  it("agarra una caja, la arrastra caminando y la suelta al soltar el botón", async () => {
    const { muneco, correr, caja } = await armar();
    const c = caja();
    correr(1);
    correr(0.5, () => ({ ...QUIETO, ...AMBOS }));
    expect(muneco.agarrado("brazoIzquierdo")?.parent()).toBe(c);
    expect(muneco.agarrado("brazoDerecho")?.parent()).toBe(c);
    const inicio = c.translation().z;
    // Camina hacia atrás: la caja viene con él
    correr(2, () => ({ avanzar: -1, girar: 0, ...AMBOS }));
    const arrastrada = inicio - c.translation().z;
    // Suelta y sigue caminando: la caja se queda
    correr(0.3, () => ({ avanzar: -1, girar: 0 }));
    expect(muneco.agarrado("brazoIzquierdo")).toBeNull();
    const soltada = c.translation().z;
    correr(1.5, () => ({ avanzar: -1, girar: 0 }));
    const despues = Math.abs(c.translation().z - soltada);
    const lejos = c.translation().z - muneco.partes.pelvis.translation().z;
    console.log(
      `caja: arrastrada ${arrastrada.toFixed(2)} m; después de soltarla se movió ${despues.toFixed(2)} m ` +
        `y quedó a ${lejos.toFixed(2)} m del muñeco`,
    );
    expect(arrastrada).toBeGreaterThan(1.5);
    // Desde TU-07 la caja de 3 kg va en el aire (uno solo la levanta): al soltarla cae y se desliza un poco
    expect(despues).toBeLessThan(0.6);
    expect(lejos).toBeGreaterThan(1.5);
    expect(muneco.estado).toBe("de pie");
  });

  it("saltando con los dos brazos arriba se cuelga de una rama 2 s", async () => {
    const { muneco, correr, rama } = await armar();
    const r = rama();
    correr(1);
    correr(0.5, () => ({ ...QUIETO, ...AMBOS }));
    correr(0.5, (i) => ({ ...QUIETO, ...AMBOS, saltar: i < 3 }));
    expect(muneco.agarrado("brazoIzquierdo")).toBe(r);
    expect(muneco.agarrado("brazoDerecho")).toBe(r);
    let pelvis = Number.POSITIVE_INFINITY;
    let pies = Number.POSITIVE_INFINITY;
    correr(
      2,
      () => ({ ...QUIETO, ...AMBOS }),
      () => {
        pelvis = Math.min(pelvis, muneco.partes.pelvis.translation().y);
        pies = Math.min(
          pies,
          muneco.partes.canillaIzquierda.translation().y,
          muneco.partes.canillaDerecha.translation().y,
        );
      },
    );
    console.log(`colgado: pelvis mín ${pelvis.toFixed(2)} m, canillas mín ${pies.toFixed(2)} m`);
    // Parado la pelvis va a 0.5 m: colgado queda bien arriba y con los pies en el aire
    expect(pelvis).toBeGreaterThan(0.75);
    expect(pies).toBeGreaterThan(0.3);
    expect(muneco.estado).toBe("en el aire");
    // Al soltar cae parado
    correr(2);
    expect(muneco.estado).toBe("de pie");
  });

  it("agarra la mano del otro muñeco", async () => {
    const { rapier, mundo, muneco, correr } = await armar();
    // El otro, enfrente y mirándolo, con el brazo alzado
    const otro = crearMuneco(rapier, mundo, { posicion: { x: 0, y: 0, z: 0.75 }, rumbo: Math.PI, indice: 1 });
    correr(
      1,
      () => ({ ...QUIETO, ...AMBOS }),
      () => otro.pasar({ ...QUIETO, ...AMBOS }),
    );
    const agarradoPorUno = muneco.agarrado("brazoIzquierdo")?.parent() ?? muneco.agarrado("brazoDerecho")?.parent();
    expect(NOMBRES_PARTES.some((n) => otro.partes[n] === agarradoPorUno)).toBe(true);
  });

  it("es determinista: agarrar y arrastrar da lo mismo dos veces", async () => {
    const corrida = async () => {
      const { muneco, correr, caja } = await armar();
      const c = caja();
      correr(1);
      correr(2, (i) => ({ avanzar: i > 30 ? -1 : 0, girar: 0, brazoDerecho: true, brazoIzquierdo: i < 60 }));
      return [c.translation(), ...NOMBRES_PARTES.map((n) => muneco.partes[n].translation())];
    };
    expect(await corrida()).toEqual(await corrida());
  });
});
