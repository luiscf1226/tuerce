// Con el compañero (TU-07), en Node con Rapier sin ventana: de la mano, arrastrar al otro y lanzar.
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, NOMBRES_PARTES, QUIETO } from "./muneco";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };

/** Dos muñecos frente a frente: A mira hacia +z y B, enfrente, lo mira a él. */
async function armar() {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
  const a = crearMuneco(rapier, mundo, { indice: 0 });
  const b = crearMuneco(rapier, mundo, { posicion: { x: 0, y: 0, z: 0.75 }, rumbo: Math.PI, indice: 1 });
  const correr = (segundos: number, ea: EntradaMuneco, eb: EntradaMuneco) => {
    for (let i = 0; i < segundos * PASOS_POR_SEGUNDO; i++) {
      a.pasar(ea);
      b.pasar(eb);
      mundo.step();
    }
  };
  /** Se dan la mano: los dos alzan los brazos hasta agarrarse. */
  const darseLaMano = () => {
    correr(1, QUIETO, QUIETO);
    correr(1, { ...QUIETO, ...AMBOS }, { ...QUIETO, ...AMBOS });
  };
  const deB = (brazo: "brazoIzquierdo" | "brazoDerecho") =>
    NOMBRES_PARTES.some((n) => b.partes[n] === a.agarrado(brazo)?.parent());
  return { rapier, mundo, a, b, correr, darseLaMano, deB };
}

describe("con el compañero", () => {
  it("A tiene a B de la mano y camina: B se deja llevar", async () => {
    const { b, correr, darseLaMano, deB } = await armar();
    darseLaMano();
    expect(deB("brazoIzquierdo") || deB("brazoDerecho")).toBe(true);
    const inicio = b.partes.pelvis.translation().z;
    // A camina hacia atrás 2 s; B no aprieta nada más que los brazos
    correr(2, { ...QUIETO, ...AMBOS, avanzar: -1 }, { ...QUIETO, ...AMBOS });
    const llevado = inicio - b.partes.pelvis.translation().z;
    console.log(`de la mano: B fue llevado ${llevado.toFixed(2)} m`);
    expect(llevado).toBeGreaterThan(1.5);
    expect(b.estado).toBe("de pie");
  });

  it("A arrastra a B flojo, tirado en el suelo", async () => {
    const { b, correr, darseLaMano } = await armar();
    darseLaMano();
    // B se afloja y suelta; A lo sigue teniendo de la mano
    b.firmeza = 0;
    correr(1, { ...QUIETO, ...AMBOS }, QUIETO);
    expect(b.estado).toBe("caido");
    const inicio = b.partes.pelvis.translation().z;
    correr(2.5, { ...QUIETO, ...AMBOS, avanzar: -1 }, QUIETO);
    const arrastrado = inicio - b.partes.pelvis.translation().z;
    console.log(`flojo: B fue arrastrado ${arrastrado.toFixed(2)} m`);
    expect(arrastrado).toBeGreaterThan(1);
  });

  it("lanza: lo que suelta en el aire, justo después de saltar, sale volando", async () => {
    const lanzamiento = async (saltar: boolean) => {
      const { rapier, mundo } = await crearMundo();
      mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
      const muneco = crearMuneco(rapier, mundo);
      const caja = mundo.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 1.1, 0.55));
      mundo.createCollider(rapier.ColliderDesc.cuboid(0.25, 0.25, 0.25).setMass(3).setFriction(0.6), caja);
      mundo.createCollider(rapier.ColliderDesc.cuboid(0.15, 0.42, 0.15).setTranslation(0, 0.42, 0.75));
      const pasos = (n: number, e: (i: number) => EntradaMuneco) => {
        for (let i = 0; i < n; i++) {
          muneco.pasar(e(i));
          mundo.step();
        }
      };
      pasos(60, () => QUIETO);
      // Agarra la caja y retrocede un poco para sacarla del pedestal
      pasos(30, () => ({ ...QUIETO, ...AMBOS }));
      pasos(40, () => ({ ...QUIETO, ...AMBOS, avanzar: -0.6 }));
      pasos(30, () => ({ ...QUIETO, ...AMBOS }));
      expect(muneco.agarrado("brazoDerecho")?.parent()).toBe(caja);
      const inicio = caja.translation().z;
      // Salta y suelta a los 10 pasos (o suelta parado)
      pasos(10, (i) => ({ ...QUIETO, ...AMBOS, saltar: saltar && i < 3 }));
      pasos(120, () => QUIETO);
      return caja.translation().z - inicio;
    };
    const lanzada = await lanzamiento(true);
    const soltada = await lanzamiento(false);
    console.log(`lanzar: la caja voló ${lanzada.toFixed(2)} m; soltada parado se movió ${soltada.toFixed(2)} m`);
    expect(lanzada).toBeGreaterThan(2);
    expect(Math.abs(soltada)).toBeLessThan(0.7);
  });

  it("empuja: caminando contra una caja sin agarrarla, la lleva por delante", async () => {
    const { rapier, mundo } = await crearMundo();
    mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
    const muneco = crearMuneco(rapier, mundo);
    const caja = mundo.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 0.25, 0.6));
    mundo.createCollider(rapier.ColliderDesc.cuboid(0.25, 0.25, 0.25).setMass(3).setFriction(0.7), caja);
    for (let i = 0; i < 3 * PASOS_POR_SEGUNDO; i++) {
      muneco.pasar({ ...QUIETO, avanzar: i > 30 ? 1 : 0 });
      mundo.step();
    }
    const empujada = caja.translation().z - 0.6;
    console.log(`empujar: la caja anduvo ${empujada.toFixed(2)} m`);
    expect(empujada).toBeGreaterThan(1);
    expect(muneco.estado).toBe("de pie");
  });

  it("es determinista: de la mano y arrastrando da lo mismo dos veces", async () => {
    const corrida = async () => {
      const { a, b, correr, darseLaMano } = await armar();
      darseLaMano();
      correr(1, { ...QUIETO, ...AMBOS, avanzar: -1 }, { ...QUIETO, ...AMBOS });
      b.firmeza = 0;
      correr(1, { ...QUIETO, ...AMBOS, avanzar: -1, girar: 0.5 }, QUIETO);
      return [
        ...NOMBRES_PARTES.map((n) => a.partes[n].translation()),
        ...NOMBRES_PARTES.map((n) => b.partes[n].translation()),
      ];
    };
    expect(await corrida()).toEqual(await corrida());
  });
});
