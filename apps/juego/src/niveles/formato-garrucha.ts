// Las piezas que estrena La garrucha (TU-43), tal como las dice la escena: la garrucha (una canasta colgada de un
// cable sobre el cañón, que se jala desde las estaciones), la chiva (el bus de escalera que lleva carga en el techo),
// la palma de cera (que se trepa con una manea) y La Patasola. Como formato.ts, no toca Rapier: solo lee las
// propiedades y pone los valores por omisión. Cómo se arman está en piezas-garrucha.ts y patasola.ts; la
// convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LA_GARRUCHA = ["garrucha", "chiva", "palma", "patasola"] as const;
export type TipoDePiezaDeLaGarrucha = (typeof PIEZAS_DE_LA_GARRUCHA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de La garrucha tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaGarruchaEnPlano =
  | (Base & {
      /** La garrucha: una canasta colgada de un cable a lo largo del lado más largo de la caja. Va de la estación de
       * abajo (la punta −, con el piso de la canasta abajo de la caja) a la de arriba (la punta +, con el piso arriba
       * de la caja). Cada estación tiene una manija en la soga: jalándola caminando hacia atrás, la canasta sube. */
      readonly cual: "garrucha";
      /** Lo más rápido que anda la canasta (m/s). */
      readonly velocidad: number;
      /** Cuánto se jala cada manija, como mucho (m), y cuántos metros de cable anda la canasta por metro de soga. */
      readonly soga: number;
      readonly multiplica: number;
      /** Qué tan rápido baja sola la canasta vacía (m/s). */
      readonly bajar: number;
      /** La fuerza del resorte que devuelve cada manija, con la soga jalada del todo (N). */
      readonly fuerza: number;
      /** Las manijas: a cuánto de costado del cable (m, + hacia el + de lo ancho de la caja) y cuánto detrás de la
       * punta de su estación. */
      readonly lado: number;
      readonly atras: number;
    })
  | (Base & {
      /** La chiva, del tamaño de la caja (de la calle hasta arriba del techo), mirando hacia el + de su lado más
       * largo. Su carga es el huacal `<nombre>-carga`: con la carga y los dos en el techo arranca, pasa los baches y
       * para `recorrido` metros más adelante. Si algo se cae del techo, frena y se devuelve. */
      readonly cual: "chiva";
      /** Cuánto anda (m) y lo más rápido que va (m/s). */
      readonly recorrido: number;
      readonly velocidad: number;
      /** Cuántos baches tiene el camino (repartidos a lo largo) y cuánto salta la chiva en cada uno (m). */
      readonly baches: number;
      readonly bache: number;
    })
  | (Base & {
      /** Una palma de cera de pie, del tamaño de la caja: arriba de la caja termina lo que se trepa (ahí va su
       * plataforma) y encima va el cogollo. Con `manea`, un aro de soga alrededor del tronco: agarrado con las dos
       * manos, adelante lo sube y atrás lo baja. */
      readonly cual: "palma";
      readonly manea: boolean;
      /** Qué tan rápido sube la manea (m/s). */
      readonly velocidad: number;
      /** Cuánto sube el cogollo por encima de la caja (m): solo se ve. */
      readonly copa: number;
    })
  | (Base & {
      /** La Patasola: corre brincando en una sola pata a lo largo del lado más largo de su caja, de la punta − (la
       * salida de la carrera) a la + (la meta). Arranca cuando alguno de los dos pasa la salida. */
      readonly cual: "patasola";
      /** En cuánto llega a la meta (s). */
      readonly tiempo: number;
      /** Cuánto alto brinca (m) y cada cuánto (s). */
      readonly salto: number;
      readonly brinco: number;
    });

/** Lee las propiedades de una pieza de La garrucha (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaGarrucha(
  cual: TipoDePiezaDeLaGarrucha,
  base: Base,
  entre: LeerEntre,
): PiezaDeLaGarruchaEnPlano {
  switch (cual) {
    case "garrucha":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 1.4, 0.1, 10),
        soga: entre("soga", 2.2, 0.3, 10),
        multiplica: entre("multiplica", 3.2, 0.5, 20),
        bajar: entre("bajar", 1.2, 0.1, 10),
        fuerza: entre("fuerza", 20, 1, 500),
        lado: entre("lado", -1.3, -5, 5),
        atras: entre("atras", 1.4, 0, 10),
      };
    case "chiva":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 14, 1, 100),
        velocidad: entre("velocidad", 2, 0.2, 10),
        baches: Math.round(entre("baches", 2, 0, 8)),
        bache: entre("bache", 0.1, 0, 1),
      };
    case "palma":
      return {
        ...base,
        cual,
        manea: entre("manea", 1, 0, 1) >= 0.5,
        velocidad: entre("velocidad", 0.9, 0.1, 5),
        copa: entre("copa", 2.5, 0, 20),
      };
    case "patasola":
      return {
        ...base,
        cual,
        tiempo: entre("tiempo", 15, 1, 120),
        salto: entre("salto", 0.45, 0, 3),
        brinco: entre("brinco", 0.5, 0.1, 5),
      };
  }
}
