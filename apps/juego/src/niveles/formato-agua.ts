// El agua (TU-24), tal como la dice la escena: un nodo `tipo: agua` es una zona de agua del tamaño de su caja. Arriba
// de la caja está la superficie (que el guion puede subir o bajar) y abajo el fondo. Como formato.ts, no toca Rapier:
// solo lee las propiedades y pone los valores por omisión. Cómo se arma está en agua.ts; la convención, en
// niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";

/** Qué le pasa a un muñeco que cae al agua: `vacio`, se lo lleva (cuenta como caída y reaparece); `nadar`, flota y
 * chapotea despacio hacia donde mira, hasta que hace pie. */
export const CAIDAS_AL_AGUA = ["vacio", "nadar"] as const;
export type CaidaAlAgua = (typeof CAIDAS_AL_AGUA)[number];
/** Cómo se ve: `superficie`, un espejo de agua quieta o corriendo; `chorro`, una cortina que cae (una cascada, lo que
 * sale de una compuerta); `nada`, no se dibuja (solo hace lo suyo). */
export const IMAGENES_DE_AGUA = ["superficie", "chorro", "nada"] as const;
export type ImagenDeAgua = (typeof IMAGENES_DE_AGUA)[number];

export interface AguaDelPlano {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  /** La caja: arriba, la superficie al empezar; abajo, el fondo. Gira solo alrededor de +y. */
  readonly zona: Volumen;
  /** Hacia su frente (el +z de glTF, el −Y de Blender), en m/s. 0: agua quieta. */
  readonly corriente: number;
  /** Qué tan rápido lo que está adentro toma la velocidad del agua (1/s). */
  readonly arrastre: number;
  readonly caer: CaidaAlAgua;
  readonly imagen: ImagenDeAgua;
}

/** Lee un número (o el valor por omisión) y una de varias opciones; el error lleva el nombre del nodo. */
export interface LectorDeAgua {
  numero(clave: string, porDefecto: number, min: number, max: number): number;
  opcion<T extends string>(clave: string, opciones: readonly T[], porDefecto: T): T;
}

/** Lee una zona de agua (`zona`: la caja del nodo, ya leída). */
export function leerAgua(nombre: string, objeto: THREE.Object3D, zona: Volumen, leer: LectorDeAgua): AguaDelPlano {
  return {
    nombre,
    objeto,
    zona,
    corriente: leer.numero("corriente", 0, -20, 20),
    arrastre: leer.numero("arrastre", 2, 0, 30),
    caer: leer.opcion("caer", CAIDAS_AL_AGUA, "vacio"),
    imagen: leer.opcion("imagen", IMAGENES_DE_AGUA, "superficie"),
  };
}
