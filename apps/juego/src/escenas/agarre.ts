// Escena de agarre (TU-04 y TU-05): un muñeco, cajas de varios tamaños, una rama para colgarse y un escalón alto
// para caerse. Teclado: W/S o ↑/↓ camina, A/D o ←/→ gira, Espacio salta, Q alza el brazo izquierdo y E el derecho.
// La mano alzada que toca algo lo agarra hasta soltar la tecla.
//
// Parámetros para capturas que salen siempre igual (con `congelar=N`), además de los de `guion.ts`:
//   &salida=caja   (por omisión) frente a una caja sobre un pedestal, a la altura de las manos
//   &salida=claro  en un claro entre cajas sueltas, sin nada adelante
//   &salida=rama   bajo la rama: saltando con los dos brazos arriba se cuelga
//   &salida=borde  arriba del escalón de 1.5 m, mirando al borde
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { crearEntradaTeclado, parametrosDeLaDireccion } from "../entrada/teclado";
import { materialCorteza, materialOjo, materialPanuelo, materialTela, vestirDeDia } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type Muneco } from "../muneco";
import { crearCajas } from "./cajas";
import { COLORES } from "./colores";
import { crearGuion } from "./guion";
import type { Escena } from "./tipos";

/** Dónde arranca el muñeco según `&salida=`; siempre mira hacia +x. */
const SALIDAS: Record<string, { x: number; y: number }> = {
  caja: { x: 0, y: 0 },
  claro: { x: 2.1, y: 0 },
  rama: { x: 4, y: 0 },
  borde: { x: -5.1, y: 1.5 },
};
/** La rama: horizontal, a lo largo de z, apenas adelante del muñeco y al alcance de las manos solo saltando. */
const RAMA = { x: 4.3, y: 1.82, radio: 0.05, largo: 2.4 };
/** El escalón: una caja quieta de 1.5 m de alto que termina en x = -4.5. */
const ESCALON = { x: -6, ancho: 3, alto: 1.5, fondo: 3 };
/** Desde dónde mira la cámara, relativo a la pelvis, y qué tan rápido la alcanza (1/s). */
const CAMARA = { desfase: new THREE.Vector3(2.6, 1.15, 3.2), seguir: 3 };

export function crearEscenaAgarre(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): Escena & { readonly muneco: Muneco } {
  const escena = new THREE.Scene();
  vestirDeDia(escena, { cerca: 4, lejos: 22 });

  // Suelo claro de niebla, para que las siluetas se lean
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORES.niebla).multiplyScalar(0.84), roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(0.8));

  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 1] });
  const lejano = new THREE.MeshStandardMaterial({ color: COLORES.siluetaLejana, roughness: 1 });

  /** Algo quieto con forma de caja: se ve y choca. */
  const quieto = (x: number, y: number, z: number, ancho: number, alto: number, fondo: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), lejano);
    m.position.set(x, y, z);
    escena.add(m);
    mundo.createCollider(rapier.ColliderDesc.cuboid(ancho / 2, alto / 2, fondo / 2).setTranslation(x, y, z));
  };

  // Las cajas: cuerpos libres que se empujan, se agarran y se cargan
  const cajas = crearCajas(rapier, mundo, escena, madera);
  const caja = cajas.poner;

  // Frente a la salida: una caja de 50 cm sobre un pedestal angosto, justo a la altura de las manos alzadas
  quieto(0.75, 0.42, 0, 0.3, 0.84, 0.3);
  caja(0.55, 1.1, 0, 0.5, 3);
  // Cajas sueltas de varios tamaños, a los costados del camino
  caja(1.7, 0.15, -1.3, 0.3, 1.5, 0.4);
  caja(2.5, 0.2, 1.3, 0.4, 2.5, -0.3);
  caja(-1.4, 0.3, -1.5, 0.6, 6, 0.2);
  caja(-2.2, 0.36, 1.4, 0.72, 9, 0.7);
  caja(-1.4, 0.75, -1.5, 0.3, 1.5, 0.9);

  // La rama, entre dos postes
  const rama = new THREE.Mesh(new THREE.CylinderGeometry(RAMA.radio, RAMA.radio, RAMA.largo, 10), madera);
  rama.rotation.x = Math.PI / 2;
  rama.position.set(RAMA.x, RAMA.y, 0);
  escena.add(rama);
  mundo.createCollider(
    rapier.ColliderDesc.capsule(RAMA.largo / 2, RAMA.radio)
      .setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })
      .setTranslation(RAMA.x, RAMA.y, 0),
  );
  for (const z of [-RAMA.largo / 2, RAMA.largo / 2]) quieto(RAMA.x, RAMA.y / 2, z, 0.12, RAMA.y + 0.1, 0.12);

  // El escalón alto
  quieto(ESCALON.x, ESCALON.alto / 2, 0, ESCALON.ancho, ESCALON.alto, ESCALON.fondo);

  // Pinos al fondo, cada vez más tragados por la niebla
  for (let i = 0; i < 14; i++) {
    const tronco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 16, 8),
      i % 3 === 0 ? new THREE.MeshStandardMaterial({ color: COLORES.silueta, roughness: 1 }) : lejano,
    );
    tronco.position.set(-12 + i * 2.6, 8, -5 - (i % 3) * 5);
    escena.add(tronco);
  }

  const salida = SALIDAS[parametros.get("salida") ?? "caja"] ?? SALIDAS.caja ?? { x: 0, y: 0 };
  const muneco = crearMuneco(rapier, mundo, { posicion: { x: salida.x, y: salida.y, z: 0 }, rumbo: Math.PI / 2 });
  const malla = crearMallaMuneco(muneco, {
    cuerpo: materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 }),
    panuelo: materialPanuelo("rojo", { repetir: 2 }),
    ojos: materialOjo(),
  });
  escena.add(malla.grupo);

  const entrada = crearEntradaTeclado(parametros);
  const guion = crearGuion(parametros);
  let pasos = 0;

  // Cámara: el punto que mira sigue a la pelvis con un retraso suave, calculado a paso fijo
  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  const seguido = { antes: new THREE.Vector3(), ahora: new THREE.Vector3().copy(muneco.partes.pelvis.translation()) };
  seguido.antes.copy(seguido.ahora);
  const suavizado = 1 - Math.exp(-CAMARA.seguir * PASO);
  const mirar = new THREE.Vector3();

  return {
    nombre: "agarre",
    escena,
    camara,
    muneco,
    pasar() {
      guion?.(pasos, entrada);
      muneco.pasar(entrada);
      cajas.guardar();
      mundo.step();
      malla.guardar();
      seguido.antes.copy(seguido.ahora);
      seguido.ahora.lerp(mirar.copy(muneco.partes.pelvis.translation()), suavizado);
      pasos++;
    },
    dibujar(alfa) {
      malla.dibujar(alfa);
      cajas.dibujar(alfa);
      mirar.lerpVectors(seguido.antes, seguido.ahora, alfa);
      camara.position.copy(mirar).add(CAMARA.desfase);
      camara.lookAt(mirar.x, mirar.y + 0.3, mirar.z);
    },
  };
}
