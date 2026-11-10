import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { esSaturado } from "../imagen";
import { crearMundo } from "../motor/fisica";
import { COLORES } from "./colores";
import { crearEscenaPinar } from "./pinar";

describe("escena pinar", () => {
  it("se arma y avanza sin errores", async () => {
    const { rapier, mundo } = await crearMundo();
    const pinar = crearEscenaPinar(rapier, mundo);
    for (let i = 0; i < 10; i++) pinar.pasar();
    pinar.dibujar(0.5);
    expect(pinar.nombre).toBe("pinar");
    expect(pinar.escena.fog).toBeTruthy();
  });

  it("el muñeco cruza el tronco caminando sin caerse ni salirse", async () => {
    const { rapier, mundo } = await crearMundo();
    const pinar = crearEscenaPinar(rapier, mundo, new URLSearchParams("andar=1"));
    const inicio = pinar.muneco.partes.pelvis.translation().x;
    let peorInclinacion = 0;
    for (let i = 0; i < 4 * 60; i++) {
      pinar.pasar();
      peorInclinacion = Math.max(peorInclinacion, pinar.muneco.inclinacion());
      const pelvis = pinar.muneco.partes.pelvis.translation();
      expect(Math.abs(pelvis.z), `se salió del tronco en el paso ${i}`).toBeLessThan(0.2);
      expect(pelvis.y, `se cayó en el paso ${i}`).toBeGreaterThan(0.3);
    }
    expect(pinar.muneco.partes.pelvis.translation().x - inicio).toBeGreaterThan(3);
    expect(peorInclinacion).toBeLessThan((20 * Math.PI) / 180);
  });

  it("lo único con color son los dos pañuelos", async () => {
    const { rapier, mundo } = await crearMundo();
    const pinar = crearEscenaPinar(rapier, mundo);
    const conColor = new Set<number>();
    pinar.escena.traverse((objeto) => {
      if (!(objeto instanceof THREE.Mesh)) return;
      const materiales: THREE.Material[] = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
      for (const m of materiales) {
        if ("color" in m && m.color instanceof THREE.Color && esSaturado(m.color.getHex()))
          conColor.add(m.color.getHex());
      }
    });
    expect([...conColor].sort()).toEqual([COLORES.panueloRojo, COLORES.panueloTurquesa].sort());
  });
});
