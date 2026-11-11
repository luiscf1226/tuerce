// El formato de nivel: leer el .glb del nivel de prueba del disco y lo que el formato rechaza.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { adentro, ErrorDeNivel, leerPlano, volumenDe } from "./formato";
import { leerDelDisco } from "./prueba";

/** Una escena mínima válida: dos salidas y un suelo, más lo que se agregue. */
function escenaMinima(...extras: THREE.Object3D[]) {
  const raiz = new THREE.Group();
  raiz.userData = { nivel: 7, nombre: "Mínimo" };
  const suelo = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10));
  suelo.position.y = -0.5;
  suelo.userData = { tipo: "solido" };
  raiz.add(suelo);
  for (const jugador of [1, 2]) {
    const salida = new THREE.Object3D();
    salida.position.set(0, 0, jugador - 1.5);
    salida.userData = { tipo: "salida", jugador };
    raiz.add(salida);
  }
  raiz.add(...extras);
  return raiz;
}
const nodo = (userData: Record<string, unknown>, nombre = "nodo") => {
  const o = new THREE.Object3D();
  o.name = nombre;
  o.userData = userData;
  return o;
};

describe("formato de nivel", () => {
  it("lee el nivel de prueba del disco: salidas, puntos de control en orden, sólidos y adornos", async () => {
    const plano = await leerDelDisco("99-prueba");
    expect(plano.numero).toBe(99);
    expect(plano.nombre).toBe("Prueba");
    expect(plano.vacio).toBe(-4);
    expect(plano.puntos.map((p) => [p.orden, p.nombre])).toEqual([
      [0, "salida"],
      [1, "control-1"],
      [2, "control-2"],
      [3, "control-3"],
    ]);
    // La salida: el rojo a la derecha (+z mirando hacia +x) y el turquesa a la izquierda
    const [rojo, turquesa] = plano.puntos[0]?.lugares ?? [];
    expect(rojo?.posicion.toArray()).toEqual([-4, 0, 0.5]);
    expect(turquesa?.posicion.toArray()).toEqual([-4, 0, -0.5]);
    expect(rojo?.rumbo).toBeCloseTo(Math.PI / 2);
    // Cada punto de control reaparece sobre la base de su zona, que apoya en el suelo
    const arriba = plano.puntos[2];
    expect(arriba?.lugares[0].posicion.y).toBeCloseTo(1.5);
    expect(arriba?.zona && adentro(arriba.zona, { x: 17, y: 2, z: 2.5 })).toBe(true);
    expect(arriba?.zona && adentro(arriba.zona, { x: 18, y: 2, z: 0 })).toBe(false);

    const solidos = Object.fromEntries(plano.solidos.map((s) => [s.nombre, s]));
    expect(Object.keys(solidos).sort()).toEqual(["compuerta", "escalon", "huacal", "orilla", "patio", "tablon"]);
    expect(solidos.huacal?.cuerpo).toBe("dinamico");
    expect(solidos.huacal?.masa).toBe(8);
    expect(solidos.compuerta?.cuerpo).toBe("cinematico");
    expect(solidos.patio?.material).toBe("suelo");
    expect(solidos.tablon?.material).toBe("corteza");
    expect(plano.vacios).toHaveLength(1);
    expect(plano.adornos.filter((a) => a.forma === "pino")).toHaveLength(10);
    expect(plano.nieblas.length).toBeGreaterThan(0);
  });

  it("sin `vacio` en la escena, el vacío empieza 3 m por debajo del sólido más bajo", () => {
    const plano = leerPlano(escenaMinima());
    expect(plano.vacio).toBeCloseTo(-4);
    expect(plano.puntos).toHaveLength(1);
  });

  it("la zona de un vacío de Blender es el cubo de ±1 escalado y girado", () => {
    const o = nodo({ tipo: "control", orden: 1 });
    o.position.set(5, 1, 0);
    o.scale.set(3, 1, 0.5);
    o.rotation.y = Math.PI / 2;
    const v = volumenDe(o);
    expect(adentro(v, { x: 5, y: 1, z: 2.9 })).toBe(true);
    expect(adentro(v, { x: 5.6, y: 1, z: 0 })).toBe(false);
    expect(adentro(v, { x: 5, y: 2.1, z: 0 })).toBe(false);
  });

  it("rechaza lo que está mal, con el nombre del nodo", () => {
    expect(() => leerPlano(new THREE.Group())).toThrow(ErrorDeNivel);
    const sinSalida = escenaMinima();
    sinSalida.remove(sinSalida.children[2] as THREE.Object3D);
    expect(() => leerPlano(sinSalida)).toThrow(/salidas/);
    expect(() => leerPlano(escenaMinima(nodo({ tipo: "puerta" }, "rara")))).toThrow(/«rara».*tipo/);
    expect(() => leerPlano(escenaMinima(nodo({ tipo: "control", orden: 2 }, "dos")))).toThrow(/de 1 en 1/);
    expect(() => leerPlano(escenaMinima(nodo({ tipo: "solido" }, "sin-malla")))).toThrow(/«sin-malla».*malla/);
    expect(() => leerPlano(escenaMinima(nodo({ tipo: "salida", jugador: 3 }, "tercero")))).toThrow(/1 o 2/);
    const mala = new THREE.Mesh(new THREE.BoxGeometry());
    mala.name = "masa-rara";
    mala.userData = { tipo: "solido", cuerpo: "dinamico", masa: "mucha" };
    expect(() => leerPlano(escenaMinima(mala))).toThrow(/«masa-rara».*masa/);
  });

  it("lo que no tiene `tipo` es solo imagen", () => {
    const plano = leerPlano(escenaMinima(new THREE.Mesh(new THREE.BoxGeometry())));
    expect(plano.solidos).toHaveLength(1);
  });
});
