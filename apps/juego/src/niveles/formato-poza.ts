// Las piezas que estrena La poza (TU-24), tal como las dice la escena: la balsa (troncos amarrados y dos remos), el
// tendedero que se cruza colgado como tirolesa, la batea llena de pepitas, la piedra para desviar el agua y La Sucia.
// Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en
// piezas-poza.ts y sucia.ts; el agua, en formato-agua.ts y agua.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LA_POZA = ["balsa", "tendedero", "batea", "piedra", "sucia"] as const;
export type TipoDePiezaDeLaPoza = (typeof PIEZAS_DE_LA_POZA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de la poza tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaPozaEnPlano =
  | (Base & {
      /** Donde se amarra la balsa y cuánto mide: los troncos van a lo largo de su lado más largo, uno al lado del
       * otro, y la balsa avanza hacia el + de ese lado. Sus troncos son las piezas `tronco` `<nombre>-1`, `-2`… */
      readonly cual: "balsa";
      /** Cuántos troncos lleva. */
      readonly troncos: number;
      /** Lo que empuja cada remo (N). */
      readonly remo: number;
      /** Hasta dónde más allá de su caja pueden estar los troncos, flotando, para amarrarse solos (m). */
      readonly astillero: number;
    })
  | (Base & {
      /** Una cuerda de la punta de arriba del lado −x de la caja a la de abajo del lado +x, con una polea que baja
       * por ella con quien se cuelgue y vuelve sola a la punta de arriba. */
      readonly cual: "tendedero";
      /** La velocidad de la polea, como mucho (m/s). */
      readonly velocidad: number;
      /** Cuánto cuelga la manija debajo de la cuerda (m). */
      readonly manija: number;
      /** Cuántas prendas tiene colgadas en un hilo al lado. */
      readonly ropa: number;
      /** A cuánto va ese hilo, a lo ancho de la caja (m; negativo, del otro lado). */
      readonly hilo: number;
    })
  | (Base & {
      /** Una batea de madera llena de pepitas: si se ladea más de `derrame` (o cae al agua), se bota. */
      readonly cual: "batea";
      readonly masa: number;
      readonly pepitas: number;
      /** Cuánto se puede ladear sin botarla (radianes). */
      readonly derrame: number;
    })
  | (Base & {
      /** Una piedra redonda del tamaño de la caja: se empuja (rueda) y se hunde en el agua. */
      readonly cual: "piedra";
      readonly masa: number;
      /** Para el agua (kg/m³). */
      readonly densidad: number;
    })
  | (Base & {
      /** La Sucia, la lavandera: lava en el fondo de su caja, mirando hacia el frente, y salpica al que entre. */
      readonly cual: "sucia";
      /** Cuánto lava entre salpicada y salpicada (s). */
      readonly lavar: number;
      /** Cuánto tarda en tirar el agua desde que apunta (s): lo que tienen para escapar. */
      readonly apuntar: number;
      /** La velocidad que le da al muñeco mojado, hacia afuera (m/s): con más de 3.2 se cae. */
      readonly empujon: number;
    });

/** Lee las propiedades de una pieza de la poza (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaPoza(cual: TipoDePiezaDeLaPoza, base: Base, entre: LeerEntre): PiezaDeLaPozaEnPlano {
  const grados = Math.PI / 180;
  switch (cual) {
    case "balsa":
      return {
        ...base,
        cual,
        troncos: Math.round(entre("troncos", 3, 1, 8)),
        remo: entre("remo", 30, 1, 1000),
        astillero: entre("astillero", 1.6, 0, 50),
      };
    case "tendedero":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 3.5, 0.5, 15),
        manija: entre("manija", 0.35, 0.1, 2),
        ropa: Math.round(entre("ropa", 5, 0, 30)),
        hilo: entre("hilo", 0.35, -5, 5),
      };
    case "batea":
      return {
        ...base,
        cual,
        masa: entre("masa", 9, 0.5, 100),
        pepitas: Math.round(entre("pepitas", 12, 1, 60)),
        derrame: entre("derrame", 30, 5, 80) * grados,
      };
    case "piedra":
      return { ...base, cual, masa: entre("masa", 30, 1, 500), densidad: entre("densidad", 2600, 100, 20000) };
    case "sucia":
      return {
        ...base,
        cual,
        lavar: entre("lavar", 2.5, 0.2, 30),
        apuntar: entre("apuntar", 0.8, 0.1, 10),
        empujon: entre("empujon", 2.6, 0, 20),
      };
  }
}
