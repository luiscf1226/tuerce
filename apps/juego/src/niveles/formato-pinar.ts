// Las piezas que estrena El pinar (TU-14), tal como las dice la escena: el tronco para cargar entre dos, la tranca,
// el hueso, la lámpara y el Cadejo. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores
// por omisión. Cómo se arman está en piezas-pinar.ts y cadejo.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";

export const PIEZAS_DEL_PINAR = ["tronco", "tranca", "hueso", "lampara", "cadejo"] as const;
export type TipoDePiezaDelPinar = (typeof PIEZAS_DEL_PINAR)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del pinar tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelPinarEnPlano =
  | (Base & {
      /** Un tronco escuadrado del tamaño de la caja, a lo largo de su lado más largo: pesa más de lo que levanta
       * un muñeco solo, así que se carga entre dos. */
      readonly cual: "tronco";
      readonly masa: number;
      readonly rozamiento: number;
    })
  | (Base & {
      /** Una barra a lo largo de su x que se saca jalándola hacia su frente; un resorte la vuelve a meter. */
      readonly cual: "tranca";
      readonly masa: number;
      /** Cuánto sale (m). */
      readonly recorrido: number;
      /** Qué parte del recorrido hay que sacarla para que quede abierta (de 0 a 1). */
      readonly umbral: number;
      /** La fuerza del resorte con la barra afuera del todo (N). */
      readonly fuerza: number;
    })
  | (Base & { readonly cual: "hueso"; readonly masa: number })
  | (Base & {
      /** Un farol que cuelga de una cadena: se enciende al agarrarlo. */
      readonly cual: "lampara";
      readonly masa: number;
      /** El largo de la cadena, desde arriba de la caja hasta el gancho (m). */
      readonly cadena: number;
    })
  | (Base & {
      /** El Cadejo: su caja es su corral. */
      readonly cual: "cadejo";
      /** Corriendo (m/s): un poco más rápido que un muñeco (1.6). */
      readonly velocidad: number;
      /** A cuánto de un muñeco (de su lomo a la pelvis, de costado) lo alcanza y lo lame (m). */
      readonly lamer: number;
      /** Cuánto se queda royendo un hueso (s). */
      readonly roer: number;
      /** Cuánto se queda contento, quieto, después de lamer (s). */
      readonly descanso: number;
      /** La velocidad que le da la lamida al muñeco, de costado (m/s): con más de 3.2 se cae (AJUSTES.caer). */
      readonly empujon: number;
    });

/** Lee un número entre `min` y `max` (o el valor por omisión); el error lleva el nombre del nodo. */
export type LeerEntre = (clave: string, porDefecto: number, min: number, max: number) => number;

/** Lee las propiedades de una pieza del pinar (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelPinar(cual: TipoDePiezaDelPinar, base: Base, entre: LeerEntre): PiezaDelPinarEnPlano {
  switch (cual) {
    case "tronco":
      return { ...base, cual, masa: entre("masa", 9, 1, 100), rozamiento: entre("rozamiento", 0.9, 0, 2) };
    case "tranca":
      return {
        ...base,
        cual,
        masa: entre("masa", 3, 0.2, 50),
        recorrido: entre("recorrido", 0.45, 0.05, 2),
        umbral: entre("umbral", 0.7, 0.1, 1),
        fuerza: entre("fuerza", 20, 1, 500),
      };
    case "hueso":
      return { ...base, cual, masa: entre("masa", 0.6, 0.05, 10) };
    case "lampara":
      return { ...base, cual, masa: entre("masa", 1.5, 0.1, 20), cadena: entre("cadena", 0.5, 0.05, 5) };
    case "cadejo":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 2, 0.2, 10),
        lamer: entre("lamer", 0.75, 0.2, 3),
        roer: entre("roer", 7, 0.5, 60),
        descanso: entre("descanso", 1.5, 0, 20),
        empujon: entre("empujon", 4, 0, 20),
      };
  }
}
