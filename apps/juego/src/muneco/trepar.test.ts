// Trepar (TU-06), en Node con Rapier sin ventana: saltar, colgarse de un borde con los dos brazos y subir.
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, NOMBRES_PARTES, QUIETO } from "./muneco";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
/** La pared: su cara queda a 40 cm adelante de los pies del muñeco y tiene 3 m de fondo. */
const CARA = 0.4;
/** Cuánto tiene para subir desde que aprieta adelante (s). */
const PLAZO_TREPAR = 2;

async function armar(alto = 1.4) {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(2, alto / 2, 1.5)
      .setTranslation(0, alto / 2, CARA + 1.5)
      .setFriction(0.8),
  );
  const muneco = crearMuneco(rapier, mundo);
  const correr = (segundos: number, entrada: (paso: number) => EntradaMuneco = () => QUIETO, parar = () => false) => {
    let pasos = 0;
    for (; pasos < segundos * PASOS_POR_SEGUNDO && !parar(); pasos++) {
      muneco.pasar(entrada(pasos));
      mundo.step();
    }
    return pasos / PASOS_POR_SEGUNDO;
  };
  /** Se acomoda, salta con los dos brazos arriba y queda colgado del borde. */
  const colgarse = () => {
    correr(1);
    correr(1, (i) => ({ ...QUIETO, ...AMBOS, saltar: i < 3 }));
  };
  const pelvis = () => muneco.partes.pelvis.translation();
  return { rapier, mundo, muneco, correr, colgarse, pelvis, alto };
}

describe("trepar", () => {
  it("salta, se cuelga del borde de 1.4 m con los dos brazos y, apretando adelante, sube y queda de pie arriba", async () => {
    const { muneco, correr, colgarse, pelvis, alto } = await armar(1.4);
    colgarse();
    expect(muneco.colgado).toBe(true);
    expect(muneco.estado).toBe("en el aire");
    const arriba = () => muneco.estado === "de pie" && pelvis().y > alto + 0.3;
    const tardo = correr(PLAZO_TREPAR, () => ({ ...QUIETO, ...AMBOS, avanzar: 1 }), arriba);
    console.log(`trepar: subió el borde de ${alto} m en ${tardo.toFixed(2)} s`);
    expect(arriba()).toBe(true);
    // Arriba suelta solo el borde y, aunque siga con los brazos alzados, no lo vuelve a agarrar
    expect(muneco.agarrado("brazoIzquierdo")).toBeNull();
    expect(muneco.agarrado("brazoDerecho")).toBeNull();
    correr(1.5, () => ({ ...QUIETO, ...AMBOS }));
    expect(muneco.estado).toBe("de pie");
    expect(pelvis().y).toBeGreaterThan(alto + 0.35);
    expect(pelvis().z).toBeGreaterThan(CARA + 0.1);
    expect(muneco.inclinacion()).toBeLessThan(0.3);
  });

  it.each([1.2, 1.6])("también trepa un borde de %s m", async (alto) => {
    const { muneco, correr, colgarse, pelvis } = await armar(alto);
    colgarse();
    const arriba = () => muneco.estado === "de pie" && pelvis().y > alto + 0.3;
    correr(PLAZO_TREPAR, () => ({ ...QUIETO, ...AMBOS, avanzar: 1 }), arriba);
    expect(arriba()).toBe(true);
  });

  it("colgado sin apretar adelante se queda colgado; al soltar los brazos cae abajo, de pie", async () => {
    const { muneco, correr, colgarse, pelvis } = await armar(1.6);
    colgarse();
    let estados = new Set<string>();
    correr(
      2,
      () => ({ ...QUIETO, ...AMBOS }),
      () => {
        estados.add(muneco.estado);
        return false;
      },
    );
    expect([...estados]).toEqual(["en el aire"]);
    expect(muneco.colgado).toBe(true);
    estados = new Set();
    correr(2, () => QUIETO);
    expect(muneco.agarrado("brazoIzquierdo")).toBeNull();
    expect(muneco.colgado).toBe(false);
    expect(muneco.estado).toBe("de pie");
    // Quedó abajo, frente a la pared: no arriba
    expect(pelvis().y).toBeLessThan(0.7);
    expect(pelvis().z).toBeLessThan(CARA);
  });

  it("si suelta los brazos a mitad de la trepada, cae", async () => {
    const { muneco, correr, colgarse, pelvis } = await armar(1.6);
    colgarse();
    correr(0.25, () => ({ ...QUIETO, ...AMBOS, avanzar: 1 }));
    expect(muneco.estado).toBe("trepando");
    const subio = pelvis().y;
    correr(2, () => ({ ...QUIETO, avanzar: 1 }));
    console.log(`soltar trepando: la pelvis iba en ${subio.toFixed(2)} m y quedó en ${pelvis().y.toFixed(2)} m`);
    expect(pelvis().y).toBeLessThan(0.7);
    expect(pelvis().z).toBeLessThan(CARA);
  });

  it("de una rama no se trepa: se queda colgado", async () => {
    const { rapier, mundo } = await crearMundo();
    mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
    mundo.createCollider(
      rapier.ColliderDesc.capsule(1, 0.05)
        .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
        .setTranslation(0, 1.82, 0.3),
    );
    const muneco = crearMuneco(rapier, mundo);
    for (let i = 0; i < 60; i++) {
      muneco.pasar(QUIETO);
      mundo.step();
    }
    for (let i = 0; i < 3 * 60; i++) {
      // Los brazos suben medio segundo antes de saltar, para llegar a la rama
      muneco.pasar({ ...QUIETO, ...AMBOS, saltar: i >= 30 && i < 33, avanzar: i > 90 ? 1 : 0 });
      mundo.step();
      expect(muneco.estado).not.toBe("trepando");
    }
    expect(muneco.colgado).toBe(true);
    expect(muneco.partes.pelvis.translation().y).toBeGreaterThan(0.75);
  });

  it("es determinista: colgarse y trepar da lo mismo dos veces", async () => {
    const corrida = async () => {
      const { muneco, correr, colgarse } = await armar(1.4);
      colgarse();
      correr(2, () => ({ ...QUIETO, ...AMBOS, avanzar: 1 }));
      return NOMBRES_PARTES.map((n) => muneco.partes[n].translation());
    };
    expect(await corrida()).toEqual(await corrida());
  });
});
