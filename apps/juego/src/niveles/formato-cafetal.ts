// Las piezas que estrena El cafetal (TU-41), tal como las dice la escena: el canasto (que se lanza y se atrapa), la
// zaranda (que se mueve entre dos hasta que suelta la llave), la polea que sube los sacos, el saco, el guineo y El
// Cipitío. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman
// está en piezas-cafetal.ts y cipitio.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DEL_CAFETAL = ["canasto", "zaranda", "polea", "saco", "guineo", "cipitio"] as const;
export type TipoDePiezaDelCafetal = (typeof PIEZAS_DEL_CAFETAL)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del cafetal tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelCafetalEnPlano =
  | (Base & {
      /** Un canasto de corte lleno de café, del tamaño de la caja. Quieto en su lugar hasta que lo agarran; se lanza
       * saltando y soltándolo en el aire, y se atrapa con los brazos alzados. Suelto, en cuanto toca algo que no sea
       * una mano se vacía y vuelve lleno a su lugar. */
      readonly cual: "canasto";
      readonly masa: number;
    })
  | (Base & {
      /** La zaranda del café: una bandeja colgada del tamaño de la caja, con una manija en cada punta de su x. Se
       * mueve a lo largo de su x, `recorrido` hacia cada lado, solo si la agarran los dos (uno de cada punta). Cada
       * vez que pasa de una punta a la otra es un zarandeo; con `zarandeos`, la llave cae por detrás. */
      readonly cual: "zaranda";
      readonly masa: number;
      /** Cuánto se mueve hacia cada lado (m). */
      readonly recorrido: number;
      /** Cuántos zarandeos hacen falta para que caiga la llave. */
      readonly zarandeos: number;
      /** Qué parte del recorrido cuenta como llegar a una punta. */
      readonly umbral: number;
      /** Cuánto detrás de la caja (su −z, el +Y de Blender) cae la llave (m). */
      readonly llave: number;
      /** Tirada en el suelo, a los cuántos segundos vuelve la llave a donde cayó. */
      readonly vuelve: number;
    })
  | (Base & {
      /** Una polea con torno: su caja es el armazón. La manija cuelga en la punta −x de su caja, a `manija` de su
       * base; el gancho, en la punta +x, a `gancho`. El que se cuelga de la manija la baja `recorrido` y el gancho
       * sube `subir`; sin nadie, la manija sube y el gancho baja solos. */
      readonly cual: "polea";
      readonly manija: number;
      readonly gancho: number;
      readonly recorrido: number;
      readonly subir: number;
      /** Qué tan rápido baja la manija con alguien colgado y sube sola (m/s). */
      readonly bajada: number;
      readonly subida: number;
    })
  | (Base & {
      /** Un saco de café del tamaño de la caja. Quieto en su lugar hasta que lo agarran; se cuelga del gancho de la
       * polea acercándoselo. Tirado en el suelo, vuelve solo. */
      readonly cual: "saco";
      readonly masa: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** Un guineo maduro, colgado de su mata. Quieto en su lugar hasta que lo agarran; tirado, vuelve solo. */
      readonly cual: "guineo";
      readonly masa: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** El Cipitío: un cipote barrigón, con los pies al revés, que se sienta en la base de su caja mirando hacia su
       * frente y les tira piedritas a los que se le acercan (a menos de `vista`). Se ríe. Al que le trae un guineo no
       * le tira: se lo come. */
      readonly cual: "cipitio";
      readonly vista: number;
      /** Cada cuánto tira una piedra (s). */
      readonly cada: number;
      /** Cuántas piedras tiene en el morral. */
      readonly piedras: number;
      /** Cuánto antes del que apunta cae la piedra (m): le falla la puntería. */
      readonly corto: number;
      /** Nunca más cerca de él que esto (m): las piedras caen al pie de lo que tenga delante. */
      readonly cerca: number;
      /** El piedrazo al que alcanza la piedra en el aire (m/s): con más de 3.2 lo tumba; 0, no le hace nada. */
      readonly empujon: number;
      /** Cuánto vuela cada piedra (s). */
      readonly vuelo: number;
    });

/** Lee las propiedades de una pieza del cafetal (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelCafetal(cual: TipoDePiezaDelCafetal, base: Base, entre: LeerEntre): PiezaDelCafetalEnPlano {
  switch (cual) {
    case "canasto":
      return { ...base, cual, masa: entre("masa", 1.5, 0.2, 5) };
    case "zaranda":
      return {
        ...base,
        cual,
        masa: entre("masa", 12, 1, 200),
        recorrido: entre("recorrido", 0.35, 0.05, 2),
        zarandeos: Math.round(entre("zarandeos", 6, 1, 50)),
        umbral: entre("umbral", 0.7, 0.2, 0.95),
        llave: entre("llave", 0.3, 0, 2),
        vuelve: entre("vuelve", 4, 0.5, 60),
      };
    case "polea":
      return {
        ...base,
        cual,
        manija: entre("manija", 1.75, 0.5, 4),
        gancho: entre("gancho", 1.25, 0.3, 4),
        recorrido: entre("recorrido", 0.5, 0.05, 2),
        subir: entre("subir", 2.8, 0.2, 10),
        bajada: entre("bajada", 0.35, 0.05, 5),
        subida: entre("subida", 0.25, 0.05, 5),
      };
    case "saco":
      return { ...base, cual, masa: entre("masa", 4, 0.5, 30), vuelve: entre("vuelve", 3, 0.5, 60) };
    case "guineo":
      return { ...base, cual, masa: entre("masa", 0.3, 0.05, 3), vuelve: entre("vuelve", 3, 0.5, 60) };
    case "cipitio":
      return {
        ...base,
        cual,
        vista: entre("vista", 6, 0.5, 30),
        cada: entre("cada", 1.8, 0.3, 30),
        piedras: Math.round(entre("piedras", 4, 1, 12)),
        corto: entre("corto", 1, 0, 10),
        cerca: entre("cerca", 1.2, 0, 10),
        empujon: entre("empujon", 0, 0, 20),
        vuelo: entre("vuelo", 0.9, 0.3, 3),
      };
  }
}
