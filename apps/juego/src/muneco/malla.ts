// Cómo se ve el muñeco: una malla simple por parte (esferas y cápsulas) que sigue a su cuerpo de Rapier,
// interpolando entre el paso anterior y el actual. La imagen final (tela, costuras, grano) es de TU-10:
// para cambiarla basta con pasar otros materiales. Las prendas del ropero (TU-29) están en prendas.ts.
import * as THREE from "three";
import type { Vestuario } from "../../../../convex/premios";
import { COLORES } from "../escenas/colores";
import { MEDIDAS } from "./ajustes";
import { type Muneco, NOMBRES_PARTES, type NombreParte } from "./muneco";
import { ponerPrendas, sacarPrendas } from "./prendas";

/** Sin nada del ropero: el pañuelo de triángulo y la cabeza pelada (las escenas de prueba del cuerpo). */
export const SIN_PRENDAS: Vestuario = {
  panuelo: "triangulo",
  sombrero: "ninguno",
  peinado: "ninguno",
  mascara: "ninguna",
};

export interface MaterialesMuneco {
  /** El trapo oscuro de todo el cuerpo. */
  cuerpo: THREE.Material;
  /** El pañuelo, el único color del muñeco. */
  panuelo: THREE.Material;
  /** Los dos puntitos de los ojos. */
  ojos: THREE.Material;
  /** Las máscaras del ropero, más negras que el trapo. */
  honda?: THREE.Material;
}

export function crearMaterialesMuneco(panuelo: number = COLORES.panueloRojo): MaterialesMuneco {
  return {
    cuerpo: new THREE.MeshStandardMaterial({ color: COLORES.silueta, roughness: 1 }),
    panuelo: new THREE.MeshStandardMaterial({ color: panuelo, roughness: 0.9, side: THREE.DoubleSide }),
    ojos: new THREE.MeshBasicMaterial({ color: 0xf4f4f0 }),
    honda: new THREE.MeshStandardMaterial({ color: COLORES.siluetaHonda, roughness: 1 }),
  };
}

export interface MallaMuneco {
  readonly grupo: THREE.Group;
  /** Guarda dónde quedó cada parte. Va después de cada `mundo.step()`. */
  guardar(): void;
  /** Mueve las mallas interpolando entre el paso anterior y el actual (`alfa` de 0 a 1). */
  dibujar(alfa: number): void;
  /** Lo que tiene puesto. */
  readonly vestuario: Vestuario;
  /** Le cambia la ropa (el color del pañuelo no cambia: es el del jugador). */
  vestir(vestuario: Vestuario): void;
}

export function crearMallaMuneco(
  muneco: Muneco,
  materiales: MaterialesMuneco = crearMaterialesMuneco(),
  vestuarioInicial: Vestuario = SIN_PRENDAS,
): MallaMuneco {
  const grupo = new THREE.Group();
  const { cuerpo, panuelo, ojos } = materiales;
  const honda = materiales.honda ?? new THREE.MeshStandardMaterial({ color: COLORES.siluetaHonda, roughness: 1 });
  const { pelvis, torso, cabeza, brazo, muslo, canilla, pie } = MEDIDAS;

  const malla = (geometria: THREE.BufferGeometry, material: THREE.Material, padre: THREE.Object3D) => {
    const m = new THREE.Mesh(geometria, material);
    padre.add(m);
    return m;
  };
  const capsula = (radio: number, largo: number) => new THREE.CapsuleGeometry(radio, largo, 6, 14);
  const esfera = (radio: number) => new THREE.SphereGeometry(radio, 20, 14);

  // Un nodo por parte, en el centro de su cuerpo rígido; las mallas cuelgan de él
  const nodos = {} as Record<NombreParte, THREE.Object3D>;
  for (const n of NOMBRES_PARTES) {
    nodos[n] = new THREE.Object3D();
    grupo.add(nodos[n]);
  }

  malla(esfera(pelvis.radio), cuerpo, nodos.pelvis).scale.set(1.05, 0.9, 0.95);
  malla(capsula(torso.radio, torso.medioAlto * 2), cuerpo, nodos.torso).scale.set(1.05, 1, 0.92);

  malla(esfera(cabeza.radio), cuerpo, nodos.cabeza);
  const ojosDeLaCara = [1, -1].map((lado) => {
    const ojo = malla(esfera(0.022), ojos, nodos.cabeza);
    ojo.position.set(lado * 0.075, 0.03, cabeza.radio * 0.93);
    return ojo;
  });

  // El pañuelo y las prendas del ropero cuelgan del cuello y de la cabeza
  let vestuario = vestuarioInicial;
  let puestas: THREE.Object3D[] = [];
  const vestir = (nuevo: Vestuario) => {
    sacarPrendas(puestas);
    const { mallas, cara } = ponerPrendas(nodos, nuevo, { tela: cuerpo, panuelo, honda });
    puestas = mallas;
    for (const ojo of ojosDeLaCara) ojo.position.z = cabeza.radio * 0.93 + cara.ojos;
    vestuario = nuevo;
  };
  vestir(vestuarioInicial);

  for (const n of ["brazoIzquierdo", "brazoDerecho"] as const) {
    malla(capsula(brazo.radio, brazo.largo), cuerpo, nodos[n]);
    malla(esfera(brazo.mano), cuerpo, nodos[n]).position.y = -brazo.largo / 2;
  }
  for (const n of ["musloIzquierdo", "musloDerecho"] as const)
    malla(capsula(muslo.radio, muslo.largo), cuerpo, nodos[n]);
  const centroCanilla = MEDIDAS.cadera.y - muslo.largo - canilla.largo / 2;
  for (const n of ["canillaIzquierda", "canillaDerecha"] as const) {
    malla(capsula(canilla.radio, canilla.largo), cuerpo, nodos[n]);
    // El zapato redondo de trapo, del tamaño de la caja de choque del pie
    const zapato = malla(esfera(1), cuerpo, nodos[n]);
    zapato.position.set(0, pie.medioAlto - centroCanilla, pie.adelante);
    zapato.scale.set(pie.medioAncho * 1.15, pie.medioAlto * 1.3, pie.medioLargo * 1.1);
  }

  const estados = NOMBRES_PARTES.map((n) => {
    const c = muneco.partes[n];
    const ahora = { p: new THREE.Vector3().copy(c.translation()), q: new THREE.Quaternion().copy(c.rotation()) };
    return { cuerpo: c, nodo: nodos[n], antes: { p: ahora.p.clone(), q: ahora.q.clone() }, ahora };
  });

  return {
    grupo,
    get vestuario() {
      return vestuario;
    },
    vestir,
    guardar() {
      for (const e of estados) {
        e.antes.p.copy(e.ahora.p);
        e.antes.q.copy(e.ahora.q);
        e.ahora.p.copy(e.cuerpo.translation());
        e.ahora.q.copy(e.cuerpo.rotation());
      }
    },
    dibujar(alfa) {
      for (const e of estados) {
        e.nodo.position.lerpVectors(e.antes.p, e.ahora.p, alfa);
        e.nodo.quaternion.slerpQuaternions(e.antes.q, e.ahora.q, alfa);
      }
    },
  };
}
