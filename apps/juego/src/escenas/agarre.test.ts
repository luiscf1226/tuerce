import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { QUIETO } from "../muneco";
import { crearEscenaAgarre } from "./agarre";
import { crearGuion } from "./guion";

async function armar(direccion: string) {
  const { rapier, mundo } = await crearMundo();
  return crearEscenaAgarre(rapier, mundo, new URLSearchParams(direccion));
}

describe("guion de entrada", () => {
  it("sin parámetros de guion no hay guion", () => {
    expect(crearGuion(new URLSearchParams("andar=1"))).toBeUndefined();
  });

  it("aprieta saltar unos pasos, alza los brazos y espera para andar", () => {
    const guion = crearGuion(new URLSearchParams("saltar=10&brazos=d&soltar=20&esperar=5"));
    const entrada = { ...QUIETO, avanzar: 1 };
    const en = (paso: number) => {
      guion?.(paso, entrada);
      return { ...entrada };
    };
    expect(en(0)).toMatchObject({ avanzar: 0, saltar: false, brazoIzquierdo: false, brazoDerecho: true });
    expect(en(5).avanzar).toBe(1);
    expect(en(12).saltar).toBe(true);
    expect(en(15).saltar).toBe(false);
    expect(en(20).brazoDerecho).toBe(false);
  });
});

describe("escena agarre", () => {
  it("se arma y avanza sin errores", async () => {
    const agarre = await armar("");
    for (let i = 0; i < 10; i++) agarre.pasar();
    agarre.dibujar(0.5);
    expect(agarre.nombre).toBe("agarre");
    expect(agarre.muneco.estado).toBe("de pie");
  });

  it("con el guion de la captura agarra la caja y la arrastra", async () => {
    const agarre = await armar("brazos=id&andar=-1&esperar=40");
    for (let i = 0; i < 150; i++) agarre.pasar();
    const agarrada = agarre.muneco.agarrado("brazoDerecho")?.parent();
    expect(agarrada?.isDynamic()).toBe(true);
    expect(agarrada?.translation().x).toBeLessThan(0);
  });

  it("con el guion de la captura se cuelga de la rama", async () => {
    const agarre = await armar("salida=rama&brazos=id&saltar=40");
    for (let i = 0; i < 200; i++) agarre.pasar();
    expect(agarre.muneco.agarrado("brazoIzquierdo")).not.toBeNull();
    expect(agarre.muneco.estado).toBe("en el aire");
    expect(agarre.muneco.partes.pelvis.translation().y).toBeGreaterThan(0.75);
  });

  it("con el guion de la captura salta del escalón, cae y queda tirado", async () => {
    const agarre = await armar("salida=borde&andar=1&saltar=22");
    const estados: string[] = [];
    let antes = "";
    for (let i = 0; i < 240; i++) {
      agarre.pasar();
      if (antes !== agarre.muneco.estado) estados.push(`${i}: ${agarre.muneco.estado}`);
      antes = agarre.muneco.estado;
    }
    console.log(`escalón: ${estados.join(" → ")}`);
    expect(agarre.muneco.estado).toBe("caido");
    expect(agarre.muneco.partes.cabeza.translation().y).toBeLessThan(0.5);
  });
});
