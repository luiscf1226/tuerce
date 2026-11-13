// Las piezas que estrena La medianoche (TU-49), tal como las dice la escena: el nenúfar gigante (la vitória-régia que
// flota amarrada a su tallo), la montaria (la canoa amazónica que se rema de a dos, al mismo ritmo), los fuegos
// artificiales de Año Nuevo (que se encienden juntos) y El Curupira. Como formato.ts, no toca Rapier: solo lee las
// propiedades y pone los valores por omisión. Cómo se arman está en piezas-medianoche.ts y curupira.ts; la
// convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LA_MEDIANOCHE = ["nenufar", "montaria", "fuegos", "curupira"] as const;
export type TipoDePiezaDeLaMedianoche = (typeof PIEZAS_DE_LA_MEDIANOCHE)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de La medianoche tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaMedianocheEnPlano =
  | (Base & {
      /** Un nenúfar gigante: una hoja redonda (de radio el mayor de la X y la Z de la caja; de grueso, su alto) que
       * flota y se ladea con el peso, amarrada por su tallo al lugar donde empieza. */
      readonly cual: "nenufar";
      readonly masa: number;
      /** Qué tan fuerte la vuelve a su lugar el tallo (N por metro). */
      readonly tallo: number;
    })
  | (Base & {
      /** La montaria: una canoa del tamaño de la caja, con el piso arriba de la caja, que avanza hacia el + de su
       * lado más largo. Tiene dos puestos, la proa y la popa, cada uno con su remo (el de la proa a la izquierda y el
       * de la popa a la derecha). Rema el que va de pie en su puesto, cada vez que alza los brazos. */
      readonly cual: "montaria";
      readonly masa: number;
      /** Lo que empuja una palada (N) y cuánto dura (s). */
      readonly remo: number;
      readonly palada: number;
      /** Dos paladas que empiezan con menos de `compas` segundos entre una y otra van al mismo ritmo. */
      readonly compas: number;
      /** Qué parte de su fuerza tiene una palada fuera de ritmo (o sola). */
      readonly fuera: number;
      /** A cuánto del medio, de costado, se clava cada remo (m): solo, el remo tuerce la montaria. */
      readonly lado: number;
    })
  | (Base & {
      /** Los fuegos artificiales: un castillo de morteros en el medio de la caja y una mecha a cada punta de su lado
       * más largo, con un chispero colgado a la altura de las manos. Se encienden con los dos chisperos agarrados a la
       * vez; entonces las mechas arden hasta el castillo y salen los cohetes, que estallan atrás de la caja, sobre el
       * río. */
      readonly cual: "fuegos";
      /** Cuántos cohetes, cada cuánto sale uno (s) y cuánto arde la mecha antes del primero (s). */
      readonly cohetes: number;
      readonly cada: number;
      readonly mecha: number;
      /** Cuánto tienen que estar agarrados los dos chisperos a la vez para que prenda (s). */
      readonly juntos: number;
      /** Dónde estallan: a qué alto sobre la caja (m), a cuánto detrás de ella (m, hacia su −z) y de qué tamaño (m). */
      readonly altura: number;
      readonly fondo: number;
      readonly radio: number;
      /** El alto del chispero sobre la base de la caja (m). */
      readonly chispero: number;
      /** Cambia por dónde sale cada cohete. */
      readonly semilla: number;
    })
  | (Base & {
      /** El Curupira, el guardián del bosque con los pies al revés, de pie en el medio de la base de su caja y
       * mirando hacia su frente (lo que mide, el alto de la caja). Lo mueve el guion: se ríe del que se perdió,
       * pide el árbol y se alegra cuando se lo plantan. */
      readonly cual: "curupira";
      /** Cuánto dura una carcajada (s). */
      readonly reir: number;
    });

/** Lee las propiedades de una pieza de La medianoche (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaMedianoche(
  cual: TipoDePiezaDeLaMedianoche,
  base: Base,
  entre: LeerEntre,
): PiezaDeLaMedianocheEnPlano {
  switch (cual) {
    case "nenufar":
      return { ...base, cual, masa: entre("masa", 20, 1, 500), tallo: entre("tallo", 250, 0, 5000) };
    case "montaria":
      return {
        ...base,
        cual,
        masa: entre("masa", 50, 1, 2000),
        remo: entre("remo", 95, 1, 3000),
        palada: entre("palada", 0.55, 0.1, 5),
        compas: entre("compas", 0.25, 0.02, 2),
        fuera: entre("fuera", 0.15, 0, 1),
        lado: entre("lado", 0.35, 0, 3),
      };
    case "fuegos":
      return {
        ...base,
        cual,
        cohetes: Math.round(entre("cohetes", 8, 1, 30)),
        cada: entre("cada", 0.8, 0.05, 10),
        mecha: entre("mecha", 2, 0, 20),
        juntos: entre("juntos", 0.4, 0, 10),
        altura: entre("altura", 5.5, 1, 40),
        fondo: entre("fondo", 13, 0, 50),
        radio: entre("radio", 3.6, 0.5, 20),
        chispero: entre("chispero", 1.05, 0.2, 3),
        semilla: Math.round(entre("semilla", 1, 0, 1e6)),
      };
    case "curupira":
      return { ...base, cual, reir: entre("reir", 2.2, 0.2, 20) };
  }
}
