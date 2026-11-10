// Dos jugadores en el mismo lugar (TU-08): un claro del pinar con los dos muñecos de verdad, el del pañuelo rojo
// (jugador 1) y el del turquesa (jugador 2), cada uno con sus controles (ver src/entrada/mandos.ts). La cámara mira
// el punto medio entre los dos y se aleja cuanto más se separan; la pantalla partida llega en otro ticket.
//
// Parámetros para capturas que salen siempre igual (con `congelar=N`):
//   &j1=andar:1,girar:0.2   entrada fija del jugador 1 (también vale `&andar=`/`&girar=`)
//   &j2=andar:0.8           entrada fija del jugador 2
//   &ayuda                  deja la ayuda de los controles a la vista (con entrada fija no aparece)
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { crearAyuda } from "../entrada/ayuda";
import { crearControles } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import {
  crearAbeto,
  crearCapasDeNiebla,
  crearMata,
  crearPino,
  crearRoca,
  crearTroncoCaido,
  crearVelo,
  materialOjo,
  materialPanuelo,
  materialTela,
  type Panuelo,
  vestirDeDia,
} from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type Muneco } from "../muneco";
import { COLORES } from "./colores";
import type { Escena } from "./tipos";

/** Dónde arranca cada muñeco: lado a lado, mirando hacia +x. */
const SALIDAS = [
  { x: 0, z: 0.5, rumbo: Math.PI / 2 },
  { x: 0, z: -0.5, rumbo: Math.PI / 2 },
] as const;
/** La cámara: hacia dónde queda del punto medio, qué tan cerca está con los dos juntos, cuánto se aleja por
 * cada metro que se separan y qué tan rápido sigue (1/s). */
const CAMARA = {
  direccion: new THREE.Vector3(0.45, 0.32, 1).normalize(),
  cerca: 4.2,
  porMetro: 1.25,
  mirarArriba: 0.55,
  seguir: 2.5,
};
/** La niebla con los dos juntos; cuando la cámara se aleja, la niebla se corre con ella para que se sigan leyendo. */
const NIEBLA = { cerca: 3, lejos: 24 };

export function crearEscenaDos(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): Escena & { readonly munecos: readonly [Muneco, Muneco] } {
  const escena = new THREE.Scene();
  vestirDeDia(escena, { cerca: NIEBLA.cerca, lejos: NIEBLA.lejos });
  const azar = crearAzar(8);

  // El suelo del claro: liso y claro, casi del color de la niebla, para que las siluetas se lean
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      name: "suelo",
      color: new THREE.Color(COLORES.niebla).multiplyScalar(0.8),
      roughness: 1,
      metalness: 0,
    }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(0.8));

  // Los dos muñecos de verdad, con la tela y los pañuelos de la imagen
  const vestir = (indice: 0 | 1, panuelo: Panuelo) => {
    const salida = SALIDAS[indice];
    const muneco = crearMuneco(rapier, mundo, {
      posicion: { x: salida.x, y: 0, z: salida.z },
      rumbo: salida.rumbo,
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

  const controles = crearControles({ parametros });
  if (typeof document !== "undefined" && (!controles.fija || parametros.has("ayuda"))) {
    crearAyuda(controles, { siempre: parametros.has("ayuda") });
  }

  // Un tronco caído al fondo del claro, con su colisionador
  const tronco = crearTroncoCaido({ largo: 7, radio: 0.22, semilla: 5, largoMusgo: 0.2, musgo: 30 });
  tronco.position.set(1.5, 0.2, -4.6);
  tronco.rotation.y = 0.18;
  escena.add(tronco);
  mundo.createCollider(
    rapier.ColliderDesc.capsule(3.5, 0.22)
      .setTranslation(1.5, 0.2, -4.6)
      .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.18, Math.PI / 2))),
  );

  // Pinos alrededor del claro: cerca a los lados y cada vez más perdidos al fondo
  const pinos: [number, number, number][] = [
    [-4.2, -2.5, 0.34],
    [5.8, -4.5, 0.38],
    [-1.5, -7, 0.32],
    [2.6, -9, 0.4],
    [-6.5, -9.5, 0.42],
    [7.5, -11, 0.36],
    [0.2, -13.5, 0.4],
    [-3.8, -15, 0.38],
    [4.8, -16, 0.42],
  ];
  pinos.forEach(([x, z, radio], i) => {
    const pino = crearPino({ alto: 18, radio, semilla: 60 + i, ramasDesde: 0.22 + azar() * 0.15, largoRama: 2.4 });
    pino.position.set(x, 0, z);
    escena.add(pino);
  });
  for (let i = 0; i < 24; i++) {
    const z = -12 - azar() * 10;
    const x = (azar() - 0.5) * (14 + Math.abs(z) * 1.4);
    const alto = 6 + azar() * 6;
    const abeto = crearAbeto(alto, alto * 0.42);
    abeto.position.set(x, 0, z);
    abeto.rotation.y = azar() * 0.6 - 0.3;
    escena.add(abeto);
  }

  // Piedras y matas en el borde del claro
  const rocas: [number, number, number][] = [
    [-2.6, -1.4, 0.3],
    [3.8, -2.2, 0.45],
    [-5, 1.5, 0.6],
  ];
  rocas.forEach(([x, z, radio], i) => {
    const roca = crearRoca(radio, 70 + i);
    roca.position.set(x, -radio * 0.15, z);
    escena.add(roca);
  });
  const matas: THREE.Mesh[] = [];
  const mata = (x: number, z: number, alto: number, semilla: number) => {
    const m = crearMata(alto, semilla);
    m.position.set(x, 0, z);
    escena.add(m);
    matas.push(m);
  };
  mata(-3.4, -1.9, 0.7, 11);
  mata(4.6, -1.5, 0.6, 12);
  mata(-1.0, -3.6, 0.55, 13);
  mata(6.2, 2.5, 1.1, 14);
  mata(-5.5, 3.2, 1.3, 15);

  const niebla = crearCapasDeNiebla([
    { y: 0.4, z: -4.5, ancho: 20, alto: 2.5, opacidad: 0.4, velocidad: 0.12 },
    { y: 1.2, z: -8, ancho: 26, alto: 8, opacidad: 0.55, velocidad: -0.15 },
    { y: 2, z: -13, ancho: 34, alto: 12, opacidad: 0.65, velocidad: 0.22 },
    { y: 2.5, z: -19, ancho: 44, alto: 16, opacidad: 0.7, velocidad: -0.2 },
  ]);
  escena.add(niebla.grupo);
  escena.add(crearVelo({ y: 5, z: -6, ancho: 26, alto: 9, opacidad: 0.75 }));

  // Cámara: sigue al punto medio y a la distancia entre los dos, calculado a paso fijo
  const camara = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 140);
  const medio = new THREE.Vector3();
  const objetivo = () => {
    const a = rojo.muneco.partes.pelvis.translation();
    const b = turquesa.muneco.partes.pelvis.translation();
    medio.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const separacion = Math.hypot(a.x - b.x, a.z - b.z);
    return { x: medio.x, z: medio.z, distancia: CAMARA.cerca + CAMARA.porMetro * separacion };
  };
  const inicio = objetivo();
  const seguido = { antes: { ...inicio }, ahora: { ...inicio } };
  const suavizado = 1 - Math.exp(-CAMARA.seguir * PASO);
  const mirar = new THREE.Vector3();

  const inclinacion = matas.map((m) => m.rotation.z);
  let pasos = 0;

  return {
    nombre: "dos",
    escena,
    camara,
    munecos: [rojo.muneco, turquesa.muneco],
    pasar() {
      const [uno, dos] = controles.leer();
      rojo.muneco.pasar(uno);
      turquesa.muneco.pasar(dos);
      mundo.step();
      rojo.malla.guardar();
      turquesa.malla.guardar();
      const meta = objetivo();
      seguido.antes = { ...seguido.ahora };
      seguido.ahora = {
        x: seguido.ahora.x + (meta.x - seguido.ahora.x) * suavizado,
        z: seguido.ahora.z + (meta.z - seguido.ahora.z) * suavizado,
        distancia: seguido.ahora.distancia + (meta.distancia - seguido.ahora.distancia) * suavizado,
      };
      pasos++;
    },
    dibujar(alfa) {
      rojo.malla.dibujar(alfa);
      turquesa.malla.dibujar(alfa);
      const { antes, ahora } = seguido;
      const entre = (a: number, b: number) => a + (b - a) * alfa;
      mirar.set(entre(antes.x, ahora.x), CAMARA.mirarArriba, entre(antes.z, ahora.z));
      const distancia = entre(antes.distancia, ahora.distancia);
      camara.position.copy(mirar).addScaledVector(CAMARA.direccion, distancia);
      camara.lookAt(mirar);
      if (escena.fog instanceof THREE.Fog) {
        escena.fog.near = NIEBLA.cerca + distancia - CAMARA.cerca;
        escena.fog.far = NIEBLA.lejos + distancia - CAMARA.cerca;
      }
      const segundos = (pasos - 1 + alfa) * PASO;
      niebla.mover(segundos);
      matas.forEach((m, i) => {
        m.rotation.z = (inclinacion[i] ?? 0) + 0.025 * Math.sin(segundos * 1.1 + i * 1.7);
      });
    },
  };
}
