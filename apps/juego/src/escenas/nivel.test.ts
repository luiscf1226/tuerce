// La escena `nivel` con el nivel de prueba leído del disco: se arma, expone su avance (TU-22) y reaparece.
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { NIVELES } from "../niveles/lista";
import { leerDelDisco } from "../niveles/prueba";
import { armarEscenaNivel } from "./nivel";

async function escenaDePrueba(parametros: string) {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("99-prueba");
  const guion = NIVELES.prueba?.crearGuion() ?? {};
  return armarEscenaNivel(rapier, mundo, plano, guion, new URLSearchParams(parametros));
}

describe("escena nivel", () => {
  it("se arma, avanza y dibuja sin errores, y expone el avance del nivel 99", async () => {
    const e = await escenaDePrueba("j1=&j2=");
    for (let i = 0; i < 10; i++) e.pasar();
    e.dibujar(0.5);
    expect(e.nombre).toBe("nivel");
    expect(e.avance?.nivel).toBe(99);
    expect(e.avance?.puntoDeControl()).toBe(0);
  });

  it("`&punto=2` empieza en ese punto de control, arriba del escalón", async () => {
    const e = await escenaDePrueba("j1=&j2=&punto=2");
    for (let i = 0; i < 30; i++) e.pasar();
    expect(e.avance?.puntoDeControl()).toBe(2);
    for (const m of e.munecos) expect(m.partes.pelvis.translation().y).toBeGreaterThan(1.8);
  });

  it("contrarreloj: el reloj no arranca hasta que alguno se mueve", async () => {
    const e = await escenaDePrueba("j1=&j2=&contrarreloj");
    for (let i = 0; i < 60; i++) e.pasar();
    expect(e.reloj?.pasos).toBe(0);
    expect(e.avance?.meta).toBe(3);
    // Sin `&contrarreloj` no hay reloj
    expect((await escenaDePrueba("j1=&j2=")).reloj).toBeUndefined();
  });

  it("contrarreloj: cuenta pasos y se para justo al llegar a la meta", async () => {
    const e = await escenaDePrueba("j1=andar:1&j2=andar:1&contrarreloj&punto=2");
    const reloj = e.reloj;
    if (!reloj) throw new Error("sin reloj");
    let llegada = -1;
    reloj.alLlegar((pasos) => {
      llegada = pasos;
    });
    let pasos = 0;
    while (!reloj.llego && pasos < 900) {
      e.pasar();
      pasos++;
    }
    expect(e.avance?.puntoDeControl()).toBe(3);
    expect(reloj.llego).toBe(true);
    // Arrancó en el primer paso (los dos andan desde el principio) y contó también el de la llegada
    expect(llegada).toBe(pasos);
    for (let i = 0; i < 60; i++) e.pasar();
    expect(reloj.pasos).toBe(llegada);
  });

  it("la toma de las capturas: el turquesa cae del patio y reaparece junto al rojo", async () => {
    const e = await escenaDePrueba("j1=&j2=andar:1,girar:-0.15");
    const [rojo, turquesa] = e.munecos;
    let cayo = false;
    let separacion = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 340; i++) {
      e.pasar();
      const t = turquesa.partes.pelvis.translation();
      if (cayo && t.y > 0 && separacion === Number.POSITIVE_INFINITY) {
        const r = rojo.partes.pelvis.translation();
        separacion = Math.hypot(r.x - t.x, r.z - t.z);
      }
      cayo ||= t.y < -1;
    }
    expect(cayo).toBe(true);
    expect(separacion).toBeLessThan(1);
    expect(turquesa.estado).toBe("de pie");
  });
});
