// De la mano (TU-07): los dos muñecos frente a frente en un claro. Alzando los brazos se agarran de las manos; el que
// camina se lleva al otro, que se deja llevar si no aprieta nada. Controles de src/entrada/mandos.ts.
//
// Parámetros para capturas que salen siempre igual (con `congelar=N`):
//   &llevar   los dos alzan los brazos y se dan la mano; desde el paso 70 el rojo camina hacia atrás y se lleva al otro
//   &j1=…&j2=…  entrada fija de cada jugador, como en la escena `dos`
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { crearControles, type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import { materialOjo, materialPanuelo, materialTela, type Panuelo, vestirDeDia } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type Muneco } from "../muneco";
import { COLORES } from "./colores";
import type { Escena } from "./tipos";

/** El guion de `&llevar`: desde qué paso camina el rojo hacia atrás. */
const LLEVAR_DESDE = 70;
const CAMARA = { desfase: new THREE.Vector3(3.4, 1.6, 1.2), seguir: 3 };

export function crearEscenaMano(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): Escena & { readonly munecos: readonly [Muneco, Muneco] } {
  const escena = new THREE.Scene();
  vestirDeDia(escena, { cerca: 4, lejos: 22 });
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORES.niebla).multiplyScalar(0.84), roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(0.8));

  const lejano = new THREE.MeshStandardMaterial({ color: COLORES.siluetaLejana, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 16, 8), lejano);
    tronco.position.set(-10 + i * 2.6, 8, -5 - (i % 3) * 5);
    escena.add(tronco);
  }

  // Frente a frente: el rojo mira hacia +z y el turquesa, enfrente, lo mira a él
  const vestir = (indice: 0 | 1, panuelo: Panuelo) => {
    const muneco = crearMuneco(rapier, mundo, {
      posicion: { x: 0, y: 0, z: indice * 0.75 },
      rumbo: indice * Math.PI,
      indice,
    });
    const malla = crearMallaMuneco(muneco, {
      cuerpo: materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 }),
      panuelo: materialPanuelo(panuelo, { repetir: 2 }),
      ojos: materialOjo(),
    });
    escena.add(malla.grupo);
    return { muneco, malla };
  };
  const rojo = vestir(0, "rojo");
  const turquesa = vestir(1, "turquesa");

  const llevar = parametros.has("llevar");
  const controles = llevar ? undefined : crearControles({ parametros });
  let pasos = 0;
  const leer = (): readonly [EntradaJugador, EntradaJugador] => {
    if (controles) return controles.leer();
    const brazos = { ...entradaQuieta(), brazoIzquierdo: true, brazoDerecho: true };
    return [{ ...brazos, avanzar: pasos >= LLEVAR_DESDE ? -1 : 0 }, brazos];
  };

  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  const medio = () => {
    const a = rojo.muneco.partes.pelvis.translation();
    const b = turquesa.muneco.partes.pelvis.translation();
    return new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const seguido = { antes: medio(), ahora: medio() };
  const suavizado = 1 - Math.exp(-CAMARA.seguir * PASO);
  const mirar = new THREE.Vector3();

  return {
    nombre: "mano",
    escena,
    camara,
    munecos: [rojo.muneco, turquesa.muneco],
    pasar() {
      const [uno, dos] = leer();
      rojo.muneco.pasar(uno);
      turquesa.muneco.pasar(dos);
      mundo.step();
      rojo.malla.guardar();
      turquesa.malla.guardar();
      seguido.antes.copy(seguido.ahora);
      seguido.ahora.lerp(medio(), suavizado);
      pasos++;
    },
    dibujar(alfa) {
      rojo.malla.dibujar(alfa);
      turquesa.malla.dibujar(alfa);
      mirar.lerpVectors(seguido.antes, seguido.ahora, alfa);
      camara.position.copy(mirar).add(CAMARA.desfase);
      camara.lookAt(mirar.x, mirar.y + 0.3, mirar.z);
    },
  };
}
