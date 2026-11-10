// Escena del muñeco (TU-03): un muñeco de trapo sobre suelo plano con unos obstáculos bajos.
// Teclado: W/S o ↑/↓ para caminar, A/D o ←/→ para girar. La cámara lo sigue suave.
//
// Parámetros para capturas que salen siempre igual (con `congelar=N`):
//   &andar=<-1..1>  avanzar fijo, sin teclado
//   &girar=<-1..1>  girar fijo, sin teclado
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type EntradaMuneco } from "../muneco";
import { COLORES } from "./colores";
import type { Escena } from "./tipos";

/** Desde dónde mira la cámara, relativo al muñeco, y qué tan rápido lo alcanza (1/s). */
const CAMARA = { desfase: new THREE.Vector3(3, 1.1, 2.8), mirarArriba: 0.45, seguir: 3 };

const TECLAS: Record<string, keyof EntradaMuneco | undefined> = {
  KeyW: "avanzar",
  ArrowUp: "avanzar",
  KeyS: "avanzar",
  ArrowDown: "avanzar",
  KeyA: "girar",
  ArrowLeft: "girar",
  KeyD: "girar",
  ArrowRight: "girar",
};
const SIGNO: Record<string, number> = { KeyS: -1, ArrowDown: -1, KeyD: -1, ArrowRight: -1 };

export function crearEscenaMuneco(rapier: Rapier, mundo: RAPIER.World): Escena {
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLORES.niebla);
  escena.fog = new THREE.Fog(COLORES.niebla, 6, 26);

  escena.add(new THREE.HemisphereLight(0xffffff, 0x8a8a86, 2.2));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(-4, 10, 6);
  escena.add(sol);

  // Suelo claro de niebla, para que la silueta del muñeco se lea
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORES.niebla).multiplyScalar(0.86), roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(0.8));

  // Obstáculos bajos: tablas y un tronco caído que el muñeco pasa por encima
  const oscuro = new THREE.MeshStandardMaterial({ color: COLORES.siluetaLejana, roughness: 1 });
  const tabla = (x: number, z: number, ancho: number, alto: number, fondo: number, giro = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), oscuro);
    m.position.set(x, alto / 2, z);
    m.rotation.y = giro;
    escena.add(m);
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(ancho / 2, alto / 2, fondo / 2)
        .setTranslation(x, alto / 2, z)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro)),
    );
  };
  tabla(3.2, 0, 0.5, 0.06, 2.4);
  tabla(6, 0.6, 0.8, 0.12, 1.6, 0.3);
  tabla(-2.5, -2, 1.6, 0.1, 0.6, 0.6);
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 10), oscuro);
  tronco.rotation.x = Math.PI / 2;
  tronco.position.set(9, 0.09, 0);
  escena.add(tronco);
  mundo.createCollider(
    rapier.ColliderDesc.capsule(1.5, 0.09)
      .setTranslation(9, 0.09, 0)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)),
  );

  // Pinos al fondo, cada vez más tragados por la niebla
  for (let i = 0; i < 14; i++) {
    const tronco = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.32, 16, 8),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? COLORES.silueta : COLORES.siluetaLejana, roughness: 1 }),
    );
    tronco.position.set(-12 + i * 2.6, 8, -5 - (i % 3) * 5);
    escena.add(tronco);
  }

  // El muñeco mira hacia +x: al caminar cruza la pantalla de izquierda a derecha
  const muneco = crearMuneco(rapier, mundo, { rumbo: Math.PI / 2 });
  const malla = crearMallaMuneco(muneco);
  escena.add(malla.grupo);

  // Entrada: fija por la dirección (para capturas) o del teclado
  const parametros = new URLSearchParams(location.search);
  const fija = parametros.has("andar") || parametros.has("girar");
  const entrada: EntradaMuneco = {
    avanzar: Number(parametros.get("andar") ?? 0) || 0,
    girar: Number(parametros.get("girar") ?? 0) || 0,
  };
  const apretadas = new Set<string>();
  const leerTeclado = () => {
    entrada.avanzar = 0;
    entrada.girar = 0;
    for (const codigo of apretadas) {
      const eje = TECLAS[codigo];
      if (eje) entrada[eje] += SIGNO[codigo] ?? 1;
    }
  };
  if (!fija) {
    window.addEventListener("keydown", (e) => {
      if (!TECLAS[e.code]) return;
      e.preventDefault();
      apretadas.add(e.code);
      leerTeclado();
    });
    window.addEventListener("keyup", (e) => {
      apretadas.delete(e.code);
      leerTeclado();
    });
    window.addEventListener("blur", () => {
      apretadas.clear();
      leerTeclado();
    });
  }

  // Cámara: el punto que mira sigue a la pelvis con un retraso suave, calculado a paso fijo
  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  const seguido = { antes: new THREE.Vector3(), ahora: new THREE.Vector3().copy(muneco.partes.pelvis.translation()) };
  seguido.antes.copy(seguido.ahora);
  const suavizado = 1 - Math.exp(-CAMARA.seguir * PASO);
  const mirar = new THREE.Vector3();

  return {
    nombre: "muneco",
    escena,
    camara,
    pasar() {
      muneco.pasar(entrada);
      mundo.step();
      malla.guardar();
      seguido.antes.copy(seguido.ahora);
      seguido.ahora.lerp(mirar.copy(muneco.partes.pelvis.translation()), suavizado);
    },
    dibujar(alfa) {
      malla.dibujar(alfa);
      mirar.lerpVectors(seguido.antes, seguido.ahora, alfa);
      mirar.y = CAMARA.mirarArriba;
      camara.position.copy(mirar).add(CAMARA.desfase);
      camara.lookAt(mirar.x, mirar.y + 0.25, mirar.z);
    },
  };
}
