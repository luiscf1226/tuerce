// Las piezas que estrena El tren bananero (TU-27), tal como las dice la escena: el vagón, la dresina, la grúa, el
// racimo, el sombrero y el Duende. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por
// omisión. Cómo se arman está en piezas-tren.ts y duende.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DEL_TREN = ["vagon", "dresina", "grua", "racimo", "sombrero", "duende"] as const;
export type TipoDePiezaDelTren = (typeof PIEZAS_DEL_TREN)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del tren tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelTrenEnPlano =
  | (Base & {
      /** Un vagón sobre rieles: rueda a lo largo de su lado más largo y se engancha al que toca de punta. */
      readonly cual: "vagon";
      readonly masa: number;
      /** Cuánto rueda hacia su frente (su +x, o su +z de glTF si es más largo así) y hacia atrás (m). */
      readonly adelante: number;
      readonly atras: number;
      /** El roce de las ruedas: cuánto lo frenan los rieles (N por m/s). */
      readonly roce: number;
    })
  | (Base & {
      /** La dresina: una plataforma con una bomba de balancín que se mueve a puro bombeo por su vía. */
      readonly cual: "dresina";
      /** Cuánto la apura cada bombeo (m/s) y cuánto la frenan los rieles (1/s). */
      readonly impulso: number;
      readonly roce: number;
      /** Hasta dónde se inclina la bomba hacia cada lado (radianes). */
      readonly angulo: number;
      /** A qué altura sobre la plataforma está el eje de la bomba (m). */
      readonly bomba: number;
      /** Más rápido que esto no va (m/s). */
      readonly velocidad: number;
      /** Sin otra vía, hasta dónde rueda hacia su frente (m). */
      readonly recorrido: number;
    })
  | (Base & {
      /** La grúa: su caja es el mástil; el brazo gira arriba y el gancho cuelga de la punta. */
      readonly cual: "grua";
      /** El largo del brazo (m). */
      readonly brazo: number;
      /** Cuánto gira el brazo desde donde recoge (su frente) hasta donde suelta (radianes, a la izquierda). */
      readonly giro: number;
      /** A qué altura sobre la base del mástil baja el gancho a recoger y a cuál lo sube (m). */
      readonly bajo: number;
      readonly alto: number;
    })
  | (Base & {
      /** Un racimo de guineos: se agarra, se carga, se engancha en la grúa y pesa en la báscula. */
      readonly cual: "racimo";
      readonly masa: number;
    })
  | (Base & { readonly cual: "sombrero"; readonly masa: number })
  | (Base & {
      /** El Duende: su caja es su casa. Cambia las palancas que le encargan cuando nadie las ve. */
      readonly cual: "duende";
      /** A cuánto de una palanca tiene que haber alguien para que el Duende no se atreva (m). */
      readonly vista: number;
      /** Cuánto tarda en ir por debajo de la tierra de un agujero a otro (s). */
      readonly viaje: number;
    });

/** Lee las propiedades de una pieza del tren (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelTren(cual: TipoDePiezaDelTren, base: Base, entre: LeerEntre): PiezaDelTrenEnPlano {
  const GRADOS = Math.PI / 180;
  switch (cual) {
    case "vagon":
      return {
        ...base,
        cual,
        masa: entre("masa", 30, 1, 1000),
        adelante: entre("adelante", 0, 0, 60),
        atras: entre("atras", 0, 0, 60),
        roce: entre("roce", 40, 0, 2000),
      };
    case "dresina":
      return {
        ...base,
        cual,
        impulso: entre("impulso", 0.55, 0.05, 5),
        roce: entre("roce", 0.2, 0, 5),
        angulo: entre("angulo", 10, 5, 45) * GRADOS,
        bomba: entre("bomba", 1.15, 0.5, 2),
        velocidad: entre("velocidad", 2.2, 0.2, 10),
        recorrido: entre("recorrido", 10, 0, 60),
      };
    case "grua":
      return {
        ...base,
        cual,
        brazo: entre("brazo", 3.2, 0.5, 20),
        giro: entre("giro", 90, -180, 180) * GRADOS,
        bajo: entre("bajo", 1.7, 0.3, 20),
        alto: entre("alto", 3.6, 0.5, 20),
      };
    case "racimo":
      return { ...base, cual, masa: entre("masa", 4, 0.2, 50) };
    case "sombrero":
      return { ...base, cual, masa: entre("masa", 0.4, 0.05, 5) };
    case "duende":
      return { ...base, cual, vista: entre("vista", 3.5, 0.5, 20), viaje: entre("viaje", 0.4, 0.1, 10) };
  }
}
