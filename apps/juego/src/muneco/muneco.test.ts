// El muñeco en Node: Rapier corre igual que en el navegador, así que se puede probar que se para, camina y gira.
import { describe, expect, it } from "vitest";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, NOMBRES_PARTES, QUIETO } from "./muneco";

const GRADOS = Math.PI / 180;
const INCLINACION_MAXIMA = 15 * GRADOS;
/** La cabeza mide 1.21 m de alto parado; si baja de esto, el muñeco se cayó o se dobló. */
const CABEZA_DE_PIE = 1.05;

async function armar() {
  const { rapier, mundo } = await crearMundo();
  mundo.createCollider(rapier.ColliderDesc.cuboid(50, 0.5, 50).setTranslation(0, -0.5, 0).setFriction(0.8));
  const muneco = crearMuneco(rapier, mundo);
  /** Corre `segundos` de pasos y devuelve lo peor que pasó: inclinación más alta y cabeza más baja. */
  const correr = (segundos: number, entrada: EntradaMuneco | ((paso: number) => EntradaMuneco) = QUIETO) => {
    let inclinacion = 0;
    let cabeza = Number.POSITIVE_INFINITY;
    for (let i = 0; i < segundos * PASOS_POR_SEGUNDO; i++) {
      muneco.pasar(typeof entrada === "function" ? entrada(i) : entrada);
      mundo.step();
      inclinacion = Math.max(inclinacion, muneco.inclinacion());
      cabeza = Math.min(cabeza, muneco.partes.cabeza.translation().y);
    }
    return { inclinacion, cabeza };
  };
  return { muneco, mundo, correr };
}

describe("muñeco de trapo", () => {
  it("se queda de pie solo durante 10 segundos", async () => {
    const { muneco, correr } = await armar();
    correr(1); // se acomoda al empezar
    const peor = correr(10);
    console.log(
      `quieto: inclinación máx ${(peor.inclinacion / GRADOS).toFixed(1)}°, cabeza mín ${peor.cabeza.toFixed(2)} m`,
    );
    expect(peor.inclinacion).toBeLessThan(INCLINACION_MAXIMA);
    expect(peor.cabeza).toBeGreaterThan(CABEZA_DE_PIE);
    expect(muneco.enElSuelo).toBe(true);
    const p = muneco.partes.pelvis.translation();
    expect(Math.hypot(p.x, p.z)).toBeLessThan(0.1);
  });

  it("camina hacia adelante 5 segundos sin caerse", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    const inicio = muneco.partes.pelvis.translation();
    const peor = correr(5, { avanzar: 1, girar: 0 });
    const fin = muneco.partes.pelvis.translation();
    const recorrido = fin.z - inicio.z;
    console.log(
      `andar: ${recorrido.toFixed(2)} m en 5 s, se desvió ${Math.abs(fin.x - inicio.x).toFixed(2)} m, ` +
        `inclinación máx ${(peor.inclinacion / GRADOS).toFixed(1)}°, cabeza mín ${peor.cabeza.toFixed(2)} m`,
    );
    expect(recorrido).toBeGreaterThan(5);
    expect(Math.abs(fin.x - inicio.x)).toBeLessThan(0.5);
    expect(peor.inclinacion).toBeLessThan(INCLINACION_MAXIMA);
    expect(peor.cabeza).toBeGreaterThan(CABEZA_DE_PIE);
  });

  it("gira más de 90° (en el lugar y caminando) sin caerse", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    // Suma los cambios del rumbo real paso a paso, para que dar la vuelta entera no se confunda con no girar
    let girado = 0;
    let anterior = muneco.rumboReal();
    const medir = () => {
      const ahora = muneco.rumboReal();
      girado += Math.atan2(Math.sin(ahora - anterior), Math.cos(ahora - anterior));
      anterior = ahora;
    };
    let peorInclinacion = 0;
    let peorCabeza = Number.POSITIVE_INFINITY;
    for (const entrada of [
      { avanzar: 0, girar: 1 },
      { avanzar: 1, girar: -0.6 },
    ]) {
      girado = 0;
      for (let i = 0; i < 2 * PASOS_POR_SEGUNDO; i++) {
        const peor = correr(1 / PASOS_POR_SEGUNDO, entrada);
        peorInclinacion = Math.max(peorInclinacion, peor.inclinacion);
        peorCabeza = Math.min(peorCabeza, peor.cabeza);
        medir();
      }
      console.log(`girar ${JSON.stringify(entrada)}: ${(girado / GRADOS).toFixed(0)}° en 2 s`);
      expect(Math.abs(girado)).toBeGreaterThan(90 * GRADOS);
      expect(Math.sign(girado)).toBe(Math.sign(entrada.girar));
    }
    console.log(
      `girar: inclinación máx ${(peorInclinacion / GRADOS).toFixed(1)}°, cabeza mín ${peorCabeza.toFixed(2)} m`,
    );
    expect(peorInclinacion).toBeLessThan(INCLINACION_MAXIMA);
    expect(peorCabeza).toBeGreaterThan(CABEZA_DE_PIE);
  });

  it("se recupera de un empujón de costado", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    // Un empujón de 1 m/s de costado a la altura del pecho, como el de un compañero
    muneco.partes.torso.applyImpulse({ x: muneco.masa * 1, y: 0, z: 0 }, true);
    const golpe = correr(1);
    const despues = correr(3);
    console.log(
      `empujón: inclinación máx ${(golpe.inclinacion / GRADOS).toFixed(1)}° durante el golpe, ` +
        `${(muneco.inclinacion() / GRADOS).toFixed(1)}° al final; cabeza mín ${golpe.cabeza.toFixed(2)} m`,
    );
    expect(golpe.cabeza).toBeGreaterThan(CABEZA_DE_PIE - 0.1);
    expect(despues.inclinacion).toBeLessThan(INCLINACION_MAXIMA);
    expect(muneco.inclinacion()).toBeLessThan(5 * GRADOS);
    expect(Math.hypot(muneco.partes.pelvis.linvel().x, muneco.partes.pelvis.linvel().z)).toBeLessThan(0.1);
  });

  it("es determinista: dos corridas iguales dan las mismas posiciones", async () => {
    const corrida = async () => {
      const { muneco, correr } = await armar();
      correr(4, (i) => ({ avanzar: i < 120 ? 1 : 0.5, girar: Math.sin(i / 30) }));
      return NOMBRES_PARTES.map((n) => muneco.partes[n].translation());
    };
    expect(await corrida()).toEqual(await corrida());
  });

  it("sin firmeza cae como un trapo", async () => {
    const { muneco, correr } = await armar();
    correr(1);
    muneco.firmeza = 0;
    correr(3);
    expect(muneco.partes.cabeza.translation().y).toBeLessThan(0.7);
  });
});
