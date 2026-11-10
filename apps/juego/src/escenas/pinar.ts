// El pinar de docs/arte/11-pinar: un tronco caído hace de puente sobre un arroyo, los pinos se pierden en la
// niebla y dos muñecos (de muestra, quietos) cruzan con su pañuelo rojo y turquesa. Sirve para mirar la imagen
// del juego; los muñecos de verdad son de TU-03.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  crearAbeto,
  crearCapasDeNiebla,
  crearMata,
  crearPino,
  crearRoca,
  crearTroncoCaido,
  crearVelo,
  juntar,
  materialOjo,
  materialPanuelo,
  materialTela,
  type Panuelo,
  vestirDeDia,
} from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { COLORES } from "./colores";
import type { Escena } from "./tipos";

/** Altura del agua del arroyo; el tronco cruza por encima, con su cara de arriba en y = 0. */
const AGUA = -1.45;

/** Muñeco de muestra, quieto: cabeza, cuerpo, brazos y piernas de tela, ojos blancos y su pañuelo. */
export function crearMunecoQuieto(panuelo: Panuelo, { sombrero = false, trenzas = false } = {}): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = `muneco-${panuelo}`;
  const tela: THREE.BufferGeometry[] = [];
  const poner = (g: THREE.BufferGeometry, x: number, y: number, z = 0, rz = 0, rx = 0) => {
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(x, y, z);
    tela.push(g);
  };
  for (const lado of [-1, 1]) {
    poner(new THREE.CapsuleGeometry(0.062, 0.18, 4, 10), lado * 0.075, 0.15, 0, 0, lado * 0.18);
    poner(new THREE.CapsuleGeometry(0.075, 0.04, 4, 10).scale(1, 0.8, 1.4), lado * 0.075, 0.04, 0.035, 0, 0);
    poner(new THREE.CapsuleGeometry(0.045, 0.26, 4, 10), lado * 0.19, 0.44, 0.02, lado * 0.3, -0.2);
  }
  if (trenzas) {
    // vestido acampanado y dos trenzas que caen a los lados de la cabeza
    poner(new THREE.CylinderGeometry(0.11, 0.24, 0.36, 16, 2), 0, 0.42);
    for (const lado of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        poner(new THREE.SphereGeometry(0.042, 10, 8), lado * (0.2 + i * 0.03), 0.76 - i * 0.065);
      poner(new THREE.SphereGeometry(0.05, 10, 8).scale(1, 1.4, 1), lado * 0.31, 0.47);
    }
  } else {
    poner(new THREE.CapsuleGeometry(0.14, 0.2, 4, 12).scale(1, 1, 0.8), 0, 0.44);
  }
  poner(new THREE.SphereGeometry(0.205, 24, 16), 0, 0.82);
  if (sombrero) {
    poner(new THREE.CylinderGeometry(0.36, 0.37, 0.025, 28), 0, 0.98, 0, 0.12, -0.1);
    poner(new THREE.CylinderGeometry(0.15, 0.19, 0.17, 20), -0.01, 1.06, 0, 0.12, -0.1);
  }
  grupo.add(new THREE.Mesh(juntar(tela), materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 })));

  // pañuelo: un aro al cuello, la punta que cae adelante y dos colas que vuelan hacia atrás
  const pano: THREE.BufferGeometry[] = [];
  pano.push(new THREE.TorusGeometry(0.12, 0.05, 8, 20).rotateX(Math.PI / 2).translate(0, 0.63, 0));
  pano.push(new THREE.ConeGeometry(0.15, 0.24, 3).rotateX(Math.PI).scale(1, 1, 0.4).translate(0, 0.52, 0.13));
  for (const lado of [-1, 1]) {
    const cola = new THREE.ConeGeometry(0.05, 0.24, 4);
    cola.rotateZ(lado * 1.25).translate(lado * 0.22, 0.6, 0.02);
    pano.push(cola);
  }
  grupo.add(new THREE.Mesh(juntar(pano), materialPanuelo(panuelo, { repetir: 2 })));

  const ojos = juntar(
    [-1, 1].map((lado) => new THREE.SphereGeometry(0.022, 10, 8).translate(lado * 0.075, 0.84, 0.19)),
  );
  grupo.add(new THREE.Mesh(ojos, materialOjo()));
  return grupo;
}

export function crearEscenaPinar(rapier: Rapier, mundo: RAPIER.World): Escena {
  const escena = new THREE.Scene();
  vestirDeDia(escena);
  const azar = crearAzar(11);

  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 120);
  camara.position.set(0, 0.45, 3.8);
  camara.lookAt(0, 0.5, 0);

  // El tronco caído que hace de puente (y su colisionador, para cuando caminen los muñecos de verdad)
  const tronco = crearTroncoCaido({ largo: 14, radio: 0.15, semilla: 3, largoMusgo: 0.45, musgo: 70 });
  tronco.position.set(0.6, -0.15, 0);
  tronco.rotation.y = 0.03;
  escena.add(tronco);
  mundo.createCollider(
    rapier.ColliderDesc.capsule(7, 0.15)
      .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
      .setTranslation(0.6, -0.15, 0),
  );

  // Los dos muñecos de muestra, cruzando
  const nino = crearMunecoQuieto("rojo", { sombrero: true });
  nino.position.set(-0.85, 0, 0);
  nino.rotation.y = 0.55;
  const nina = crearMunecoQuieto("turquesa", { trenzas: true });
  nina.position.set(0.55, 0, 0);
  nina.rotation.y = 0.4;
  escena.add(nino, nina);

  // El pino que enmarca a la izquierda, con las ramas hacia la escena
  const grande = crearPino({
    alto: 16,
    radio: 0.34,
    semilla: 1,
    ramasDesde: 0.215,
    largoRama: 2.1,
    haciaDonde: 0.35,
    caida: 0.12,
  });
  grande.position.set(-2.4, AGUA, -0.5);
  escena.add(grande);

  // Troncos de pino a media distancia: la niebla los va aclarando
  const medios: [number, number, number][] = [
    [-1.2, -5, 0.3],
    [1.1, -7.5, 0.38],
    [3.0, -4.2, 0.3],
    [-3.7, -8.5, 0.42],
    [4.6, -9.5, 0.36],
    [0.0, -12.5, 0.4],
    [-6.2, -13, 0.45],
    [6.8, -14, 0.4],
    [-2.6, -16, 0.38],
    [2.8, -17.5, 0.42],
  ];
  medios.forEach(([x, z, radio], i) => {
    const pino = crearPino({ alto: 20, radio, semilla: 30 + i, ramasDesde: 0.2 + azar() * 0.15, largoRama: 2.6 });
    pino.position.set(x, AGUA, z);
    escena.add(pino);
  });

  // Abetos del fondo, enteros, cada fila más perdida en la niebla
  for (let i = 0; i < 26; i++) {
    const z = -7 - azar() * 8;
    const x = (azar() - 0.5) * (10 + Math.abs(z) * 1.3);
    const alto = 6 + azar() * 6;
    const abeto = crearAbeto(alto, alto * 0.42);
    abeto.position.set(x, AGUA + (x > 3 ? 1.5 : 0), z);
    abeto.rotation.y = azar() * 0.6 - 0.3;
    escena.add(abeto);
  }

  // La loma de la derecha, al fondo
  const loma = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    materialTela(COLORES.silueta, { repetir: 6, pelusa: false }),
  );
  loma.scale.set(9, 3, 5);
  loma.position.set(8.5, AGUA - 0.4, -9.5);
  escena.add(loma);

  // El arroyo y sus piedras
  const agua = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 60),
    new THREE.MeshStandardMaterial({ name: "agua", color: COLORES.agua, roughness: 0.4, metalness: 0 }),
  );
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(0, AGUA, -20);
  escena.add(agua);
  mundo.createCollider(rapier.ColliderDesc.cuboid(40, 0.1, 30).setTranslation(0, AGUA - 0.1, -20));
  const rocas: [number, number, number][] = [
    [-1.5, -1.3, 0.45],
    [0.3, -2.6, 0.4],
    [1.5, -0.9, 0.3],
    [-0.5, -5, 0.6],
    [2.7, -3.4, 0.5],
    [-3.2, -3.6, 0.55],
    [1.0, -7, 0.7],
    [3.4, 0.3, 1.0],
  ];
  rocas.forEach(([x, z, radio], i) => {
    const roca = crearRoca(radio, 50 + i);
    roca.position.set(x, AGUA - radio * 0.15, z);
    escena.add(roca);
  });

  // Matas: unas junto al tronco y otras muy cerca de la cámara, casi negras
  const matas: THREE.Mesh[] = [];
  const mata = (x: number, y: number, z: number, alto: number, semilla: number) => {
    const m = crearMata(alto, semilla);
    m.position.set(x, y, z);
    escena.add(m);
    matas.push(m);
  };
  mata(-1.85, -0.25, -0.3, 0.75, 1);
  mata(2.3, -0.2, -0.25, 0.55, 2);
  mata(-1.15, -1.0, 1.9, 2.0, 3);
  mata(-0.6, -0.95, 2.4, 1.1, 4);
  mata(-1.4, -0.6, 1.2, 1.3, 7);
  mata(1.1, -0.95, 2.1, 1.7, 5);
  mata(1.55, -0.55, 1.3, 1.2, 6);
  const monte = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12),
    materialTela(COLORES.siluetaHonda, { repetir: 4, pelusa: false }),
  );
  monte.scale.set(1.4, 0.7, 0.8);
  monte.position.set(-1.25, -1.0, 1.6);
  escena.add(monte);

  // Niebla por capas: bajo el tronco (el vapor del arroyo), entre los pinos y al fondo
  const niebla = crearCapasDeNiebla([
    { y: AGUA + 0.15, z: -1.2, ancho: 14, alto: 1.2, opacidad: 0.5, velocidad: 0.12 },
    { y: AGUA + 0.4, z: 0.9, ancho: 8, alto: 1.4, opacidad: 0.45, velocidad: -0.1 },
    { y: 0.2, z: -3.2, ancho: 16, alto: 6, opacidad: 0.5, velocidad: 0.2 },
    { y: 0.8, z: -6, ancho: 22, alto: 9, opacidad: 0.6, velocidad: -0.15 },
    { y: 1.5, z: -10, ancho: 30, alto: 12, opacidad: 0.65, velocidad: 0.25 },
    { y: 2, z: -15, ancho: 40, alto: 16, opacidad: 0.7, velocidad: -0.2 },
  ]);
  escena.add(niebla.grupo);
  // y detrás de los muñecos, los troncos se pierden en blanco hacia arriba
  escena.add(crearVelo({ y: 3.2, z: -3.8, ancho: 18, alto: 6, opacidad: 0.75 }));
  escena.add(crearVelo({ y: 5, z: -8, ancho: 30, alto: 10, opacidad: 0.8 }));

  const inclinacion = matas.map((m) => m.rotation.z);
  let pasos = 0;
  return {
    nombre: "pinar",
    escena,
    camara,
    pasar() {
      mundo.step();
      pasos++;
    },
    dibujar(alfa) {
      const segundos = (pasos - 1 + alfa) * PASO;
      niebla.mover(segundos);
      matas.forEach((m, i) => {
        m.rotation.z = (inclinacion[i] ?? 0) + 0.025 * Math.sin(segundos * 1.1 + i * 1.7);
      });
    },
  };
}
