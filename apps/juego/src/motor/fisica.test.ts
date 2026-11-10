import { describe, expect, it } from "vitest";
import { PASO } from "./bucle";
import { crearMundo } from "./fisica";

describe("físicas con Rapier", () => {
  it("el mundo avanza de a 1/60 s", async () => {
    const { mundo } = await crearMundo();
    expect(mundo.timestep).toBeCloseTo(PASO);
  });

  it("una caja soltada desde 5 m cae y queda quieta sobre el suelo", async () => {
    const { rapier, mundo } = await crearMundo();
    mundo.createCollider(rapier.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0));
    const caja = mundo.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
    mundo.createCollider(rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5), caja);

    // caída libre: tras 0.5 s debe haber bajado g·t²/2 ≈ 1.23 m
    for (let i = 0; i < 30; i++) mundo.step();
    expect(caja.translation().y).toBeCloseTo(5 - (9.81 * 0.5 ** 2) / 2, 1);

    for (let i = 0; i < 180; i++) mundo.step();
    expect(caja.translation().y).toBeCloseTo(0.5, 1);
    expect(Math.abs(caja.linvel().y)).toBeLessThan(0.05);
  });

  it("es determinista: dos mundos iguales dan el mismo resultado", async () => {
    const correr = async () => {
      const { rapier, mundo } = await crearMundo();
      mundo.createCollider(rapier.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0));
      const caja = mundo.createRigidBody(
        rapier.RigidBodyDesc.dynamic().setTranslation(0.3, 4, 0).setAngvel({ x: 1, y: 2, z: 0 }),
      );
      mundo.createCollider(rapier.ColliderDesc.cuboid(0.5, 0.5, 0.5), caja);
      for (let i = 0; i < 120; i++) mundo.step();
      return caja.translation();
    };
    expect(await correr()).toEqual(await correr());
  });
});
