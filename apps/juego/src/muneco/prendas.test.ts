// Las prendas del ropero (TU-29) sobre la malla del muñeco: todas se arman, cuelgan de la cabeza o del torso, y al
// cambiar de ropa no queda nada de la anterior.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CATEGORIAS, PRENDAS, VESTUARIO_INICIAL, type Vestuario } from "../../../../convex/premios";
import { crearMundo } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, SIN_PRENDAS } from ".";

async function armar(vestuario?: Vestuario) {
  const { rapier, mundo } = await crearMundo();
  const muneco = crearMuneco(rapier, mundo);
  return crearMallaMuneco(muneco, undefined, vestuario);
}

const mallasDe = (o: THREE.Object3D) => {
  let n = 0;
  o.traverse((h) => {
    if (h instanceof THREE.Mesh) n++;
  });
  return n;
};

/** Qué tan alto llega lo más alto del muñeco (con sombrero o sin él). */
const altura = (grupo: THREE.Object3D) => {
  grupo.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(grupo).max.y;
};

describe("prendas", () => {
  it("cada prenda de cada categoría se arma sobre el muñeco", async () => {
    const malla = await armar();
    const base = mallasDe(malla.grupo);
    for (const c of CATEGORIAS) {
      for (const prenda of PRENDAS[c]) {
        malla.vestir({ ...SIN_PRENDAS, [c]: prenda } as Vestuario);
        expect(malla.vestuario[c]).toBe(prenda);
        // Sin sombrero ni máscara queda como sin nada; el pañuelo siempre está, con otra forma
        if (c === "panuelo") expect(mallasDe(malla.grupo), prenda).toBeGreaterThanOrEqual(base);
        else if (prenda !== "ninguno" && prenda !== "ninguna")
          expect(mallasDe(malla.grupo), `${c}:${prenda}`).toBeGreaterThan(base);
      }
    }
  });

  it("al cambiar de ropa no queda nada de la anterior", async () => {
    const malla = await armar(VESTUARIO_INICIAL[0]);
    const conSombrero = mallasDe(malla.grupo);
    malla.vestir({ panuelo: "capa", sombrero: "chullo", peinado: "grenas", mascara: "diablito" });
    malla.vestir(VESTUARIO_INICIAL[0]);
    expect(mallasDe(malla.grupo)).toBe(conSombrero);
  });

  it("los sombreros siguen a la cabeza: el puntudo es más alto que la cabeza pelada", async () => {
    const pelada = await armar(SIN_PRENDAS);
    pelada.dibujar(1);
    const puntudo = await armar({ ...SIN_PRENDAS, sombrero: "puntudo" });
    puntudo.dibujar(1);
    expect(altura(puntudo.grupo)).toBeGreaterThan(altura(pelada.grupo) + 0.3);
  });
});
