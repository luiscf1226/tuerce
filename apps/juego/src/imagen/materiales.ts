// Materiales de la imagen. Cualquier malla se viste con `materialTela()` (siluetas oscuras de costal) y los
// muñecos llevan `materialPanuelo("rojo" | "turquesa")`, los únicos colores del juego.
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { COLOR_PANUELO, type Panuelo } from "./paleta";
import {
  type Lamina,
  nubeDeNiebla,
  ramaDePino,
  ramitaDeHojas,
  rayarCorteza,
  siluetaDeAbeto,
  type Tela,
  tejerTela,
} from "./texturas";

export type Repetir = number | readonly [number, number];

/** Convierte una lámina de píxeles en textura de Three.js (con mipmaps, para que de lejos no titile). */
export function aTextura(lamina: Lamina, { srgb = false, repetir = true } = {}): THREE.DataTexture {
  const textura = new THREE.DataTexture(lamina.datos, lamina.ancho, lamina.alto);
  textura.wrapS = repetir ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  textura.wrapT = textura.wrapS;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.anisotropy = 4;
  textura.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  textura.needsUpdate = true;
  return textura;
}

// Cada textura se genera una sola vez por página; las copias con otra repetición comparten los píxeles.
const guardadas = new Map<string, THREE.Texture>();
function compartida(clave: string, crear: () => THREE.Texture): THREE.Texture {
  let textura = guardadas.get(clave);
  if (!textura) {
    textura = crear();
    guardadas.set(clave, textura);
  }
  return textura;
}

function repetida(clave: string, crear: () => THREE.Texture, repetir: Repetir): THREE.Texture {
  const [rx, ry] = typeof repetir === "number" ? [repetir, repetir] : repetir;
  if (rx === 1 && ry === 1) return compartida(clave, crear);
  return compartida(`${clave}@${rx}x${ry}`, () => {
    const copia = compartida(clave, crear).clone();
    copia.repeat.set(rx, ry);
    return copia;
  });
}

let tela: Tela | undefined;
let corteza: Tela | undefined;
const laTela = () => {
  tela ??= tejerTela(256, 1);
  return tela;
};
const laCorteza = () => {
  corteza ??= rayarCorteza(256, 2);
  return corteza;
};

export interface OpcionesTela {
  /** Cuántas veces se repite el tejido sobre la malla (según sus UV). */
  repetir?: Repetir;
  /** Qué tanto se nota el relieve del tejido. */
  relieve?: number;
  /**
   * Pelusa: un brillo suave en los bordes, como el fieltro a contraluz. Más caro de dibujar; apagarlo en
   * superficies grandes (lomas, suelo).
   */
  pelusa?: boolean;
}

/** Tela de costal oscura: color, relieve y aspereza del tejido. Para muñecos, sombreros y siluetas. */
export function materialTela(
  color: THREE.ColorRepresentation = COLORES.silueta,
  opciones: OpcionesTela = {},
): THREE.MeshStandardMaterial {
  const repetir = opciones.repetir ?? 2;
  const comun = {
    name: "tela",
    color,
    map: repetida("tela-color", () => aTextura(laTela().color, { srgb: true }), repetir),
    bumpMap: repetida("tela-relieve", () => aTextura(laTela().relieve), repetir),
    bumpScale: opciones.relieve ?? 4,
    roughnessMap: repetida("tela-relieve", () => aTextura(laTela().relieve), repetir),
    roughness: 1,
    metalness: 0,
  };
  if (opciones.pelusa === false) return new THREE.MeshStandardMaterial(comun);
  return new THREE.MeshPhysicalMaterial({ ...comun, sheen: 1, sheenColor: 0x3c3c3a, sheenRoughness: 0.6 });
}

/** Corteza oscura para troncos y ramas gruesas. */
export function materialCorteza(color: THREE.ColorRepresentation = COLORES.silueta, opciones: OpcionesTela = {}) {
  const repetir = opciones.repetir ?? [2, 4];
  return new THREE.MeshStandardMaterial({
    name: "corteza",
    color,
    map: repetida("corteza-color", () => aTextura(laCorteza().color, { srgb: true }), repetir),
    bumpMap: repetida("corteza-relieve", () => aTextura(laCorteza().relieve), repetir),
    bumpScale: opciones.relieve ?? 4,
    roughnessMap: repetida("corteza-relieve", () => aTextura(laCorteza().relieve), repetir),
    roughness: 1,
    metalness: 0,
  });
}

/** El pañuelo de cada muñeco: la misma tela, pero con su color. Se ve de los dos lados. */
export function materialPanuelo(cual: Panuelo, opciones: OpcionesTela = {}) {
  const material = materialTela(COLOR_PANUELO[cual], { relieve: 1.5, ...opciones });
  material.name = `panuelo-${cual}`;
  material.side = THREE.DoubleSide;
  return material;
}

/** Los dos puntos blancos de los ojos. */
export function materialOjo() {
  return new THREE.MeshBasicMaterial({ name: "ojo", color: COLORES.ojo });
}

const RECORTES = {
  rama: () => ramaDePino(256, 128, 4),
  abeto: () => siluetaDeAbeto(128, 256, 5),
  hojas: () => ramitaDeHojas(256, 6),
} as const;
export type Recorte = keyof typeof RECORTES;

/**
 * Silueta recortada sobre un plano (ramas de pino, abetos lejanos, matas): opaca donde hay forma y
 * transparente fuera de ella, con borde suavizado por el antialias.
 */
export function materialRecorte(cual: Recorte, color: THREE.ColorRepresentation = COLORES.silueta) {
  return new THREE.MeshStandardMaterial({
    name: `recorte-${cual}`,
    color,
    map: compartida(`recorte-${cual}`, () => aTextura(RECORTES[cual](), { srgb: true, repetir: false })),
    alphaTest: 0.5,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
  });
}

/** Jirones de niebla que se repiten de lado a lado (cada capa lleva su propia copia para correrla). */
export function texturaNiebla(): THREE.Texture {
  const textura = compartida("niebla", () => {
    const t = aTextura(nubeDeNiebla(256, 128, 3), { srgb: true });
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }).clone();
  return textura;
}
