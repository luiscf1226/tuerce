// El tutorial: las lecciones se cumplen jugando de verdad (entrada fija, físicas deterministas de Rapier).
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearEscenaTutorial } from "./tutorial";

async function tutorial(direccion: string) {
  const { rapier, mundo } = await crearMundo();
  return crearEscenaTutorial(rapier, mundo, new URLSearchParams(direccion));
}

describe("el tutorial", () => {
  it("se arma con las seis lecciones y empieza por caminar", async () => {
    const t = await tutorial("j1=&j2=");
    for (let i = 0; i < 10; i++) t.pasar();
    t.dibujar(0.5);
    expect(t.nombre).toBe("tutorial");
    expect(t.tablero.objetivos.map((o) => o.id)).toEqual([
      "caminar",
      "saltar",
      "agarrar",
      "cacao",
      "cantaro",
      "festejar",
    ]);
    expect(t.tablero.actual).toBe(0);
  });

  it("quietos no se cumple nada", async () => {
    const t = await tutorial("j1=&j2=");
    for (let i = 0; i < 3 * 60; i++) t.pasar();
    expect(t.tablero.actual).toBe(0);
    expect(t.tablero.medida(0).cuenta).toBe(0);
  });

  it("caminando los dos, pasan a saltar; si camina uno solo, va uno de dos", async () => {
    const dos = await tutorial("j1=andar:1&j2=andar:1");
    for (let i = 0; i < 3 * 60; i++) dos.pasar();
    expect(dos.tablero.actual).toBe(1);

    const uno = await tutorial("j1=andar:1&j2=");
    for (let i = 0; i < 3 * 60; i++) uno.pasar();
    expect(uno.tablero.actual).toBe(0);
    expect(uno.tablero.medida(0).cuenta).toBe(1);
  });

  it("saltando los dos, pasan a agarrar", async () => {
    const t = await tutorial("leccion=2&j1=saltar@20&j2=saltar@30");
    for (let i = 0; i < 90; i++) t.pasar();
    expect(t.tablero.actual).toBe(2);
  });

  it("entre los dos llevan el cántaro del tocón al círculo de piedras", async () => {
    const t = await tutorial("leccion=5&j1=andar:0.6,izq&j2=andar:0.6,der");
    let llego = -1;
    for (let i = 0; i < 10 * 60 && llego < 0; i++) {
      t.pasar();
      if (t.tablero.actual > 4) llego = i;
    }
    expect(llego, "el cántaro no llegó al círculo").toBeGreaterThan(0);
  });

  it("con un gesto cada uno, terminan", async () => {
    const t = await tutorial("leccion=6&j1=gesto:festejar&j2=gesto:saludar");
    for (let i = 0; i < 10; i++) t.pasar();
    expect(t.tablero.terminado).toBe(true);
  });
});
