import { expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { NOMBRES_PARTES } from "../muneco";
import { crearEscenaMano } from "./mano";

it("escena mano: se dan la mano y el rojo se lleva al turquesa", async () => {
  const { rapier, mundo } = await crearMundo();
  const mano = crearEscenaMano(rapier, mundo, new URLSearchParams("llevar"));
  const [rojo, turquesa] = mano.munecos;
  for (let i = 0; i < 200; i++) mano.pasar();
  mano.dibujar(0.5);
  const agarra = [rojo.agarrado("brazoIzquierdo"), rojo.agarrado("brazoDerecho")].some((c) =>
    NOMBRES_PARTES.some((n) => turquesa.partes[n] === c?.parent()),
  );
  expect(agarra).toBe(true);
  expect(turquesa.partes.pelvis.translation().z).toBeLessThan(-1);
  expect(turquesa.estado).toBe("de pie");
});
