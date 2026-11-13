// Parado en algo que se mueve y lo lleva (`llevaAlQuePisa`: el pipante, la balsa, un vagón), el muñeco anda respecto
// de eso: a la velocidad de siempre hacia adelante o hacia atrás, por rápido que vaya lo de abajo.
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { AJUSTES } from "./ajustes";
import { crearMuneco, llevaAlQuePisa, QUIETO } from "./muneco";

/** Una plancha de 30 kg sobre hielo, que se mantiene a `velocidad` (m/s) hacia +z, con el muñeco parado encima. */
async function armar(velocidad: number) {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 200).setTranslation(0, -0.5, 0).setFriction(0));
  const plancha = mundo.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 0.1, 0).lockRotations());
  mundo.createCollider(rapier.ColliderDesc.cuboid(1, 0.1, 6).setMass(30).setFriction(0.9), plancha);
  llevaAlQuePisa(plancha);
  const muneco = crearMuneco(rapier, mundo, { posicion: { x: 0, y: 0.2, z: 0 } });
  const correr = (pasos: number, avanzar: number) => {
    for (let i = 0; i < pasos; i++) {
      plancha.setLinvel({ x: 0, y: plancha.linvel().y, z: velocidad }, true);
      muneco.pasar({ ...QUIETO, avanzar });
      mundo.step();
    }
  };
  /** Cuánto se corrió el muñeco sobre la plancha en `segundos`, en m/s. */
  const relativa = (segundos: number, avanzar: number) => {
    const antes = muneco.partes.pelvis.translation().z - plancha.translation().z;
    correr(segundos * PASOS_POR_SEGUNDO, avanzar);
    return (muneco.partes.pelvis.translation().z - plancha.translation().z - antes) / segundos;
  };
  return { muneco, correr, relativa };
}

describe("el suelo que lleva", () => {
  for (const velocidad of [1.5, 1.9, 3]) {
    it(`sobre una plancha a ${velocidad} m/s anda a su paso, adelante y atrás, y quieto no se corre`, async () => {
      const { correr, relativa } = await armar(velocidad);
      correr(PASOS_POR_SEGUNDO, 0);
      expect(Math.abs(relativa(2, 0))).toBeLessThan(0.1);
      // Ni lo lanza hacia adelante ni le gana a la plancha hacia atrás (antes salía disparado por la proa)
      const v = AJUSTES.andar.velocidad;
      const atras = relativa(1.5, -1);
      expect(atras).toBeLessThan(-0.5 * v);
      expect(atras).toBeGreaterThan(-1.3 * v);
      correr(PASOS_POR_SEGUNDO, 0);
      const adelante = relativa(1.5, 1);
      expect(adelante).toBeGreaterThan(0.5 * v);
      expect(adelante).toBeLessThan(1.3 * v);
    });
  }
});
