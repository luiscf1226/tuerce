// Las piezas que estrena Las trenzas (TU-40), tal como las dice la escena: el nudo de dos cabos, la mula, el balde de
// agua, las piedras calientes, el Sombrerón y su sombrero gigante. Como formato.ts, no toca Rapier: solo lee las
// propiedades y pone los valores por omisión. Cómo se arman está en piezas-trenzas.ts y sombreron.ts; la
// convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LAS_TRENZAS = ["nudo", "mula", "balde", "brasa", "sombreron", "sombrerote"] as const;
export type TipoDePiezaDeLasTrenzas = (typeof PIEZAS_DE_LAS_TRENZAS)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de Las trenzas tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLasTrenzasEnPlano =
  | (Base & {
      /** Dos cuerdas trenzadas a lo largo del lado más largo de la caja, con un nudo en el medio y un cabo en cada
       * punta. Se desata jalando los dos cabos a la vez hacia afuera; jalando uno solo, se aprieta. */
      readonly cual: "nudo";
      /** Cuánto sale cada cabo (m), desde qué parte del recorrido cuenta como jalado y la fuerza del resorte que
       * lo vuelve a meter (N, con el cabo afuera del todo). */
      readonly recorrido: number;
      readonly umbral: number;
      readonly fuerza: number;
      /** Cuánto hay que jalar de los dos a la vez para desatarlo (s). */
      readonly desatar: number;
      readonly masa: number;
    })
  | (Base & {
      /** Una mula del tamaño de la caja, mirando hacia el + de su lado más largo. No da un paso sin su carga (los
       * huacales `<nombre>-1`, `-2`…, que se sueltan junto a su costado, en alto); cargada, sigue al que la lleva de la rienda. */
      readonly cual: "mula";
      readonly velocidad: number;
      /** El largo de la rienda (m). */
      readonly rienda: number;
      /** Cuántos bultos lleva. */
      readonly carga: number;
      /** Qué tan rápido gira (rad/s). */
      readonly giro: number;
    })
  | (Base & {
      /** Un balde de madera del tamaño de la caja. Se llena (el guion) y se lleva en la mano; lleno, se derrama si
       * nadie lo tiene agarrado. Tirado en el suelo, vuelve solo a su lugar. */
      readonly cual: "balde";
      readonly masa: number;
      /** Cuánto aguanta lleno sin que nadie lo agarre (s) y a los cuántos segundos tirado vuelve (s). */
      readonly suelto: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** Una piedra caliente del tamaño de la caja: quema (empuja hacia atrás y tumba) al que la toca. Se apaga con
       * un balde lleno que llega a `alcance` de ella: se hunde a ras del suelo y ya se camina. */
      readonly cual: "brasa";
      readonly empujon: number;
      readonly alcance: number;
    })
  | (Base & {
      /** El Sombrerón: su caja es su plaza. Sin su sombrero, persigue al muñeco de pie más cercano que entre y le
       * hace trenzas (lo enreda: lo tumba); después toca la guitarra un rato. Si su sombrero llega a la plaza, va
       * por él y se lo pone, y ya no molesta. */
      readonly cual: "sombreron";
      readonly velocidad: number;
      /** A cuánto alcanza al muñeco (m), cuánto toca la guitarra después (s) y con qué lo tumba (m/s). */
      readonly alcance: number;
      readonly tocar: number;
      readonly empujon: number;
    })
  | (Base & {
      /** El sombrero gigante del Sombrerón: una rueda del tamaño de la caja, de canto, que rueda a lo largo del
       * lado más largo de la caja. Se empuja caminando contra él; en la cuesta, si lo sueltan, rueda para abajo. */
      readonly cual: "sombrerote";
      readonly masa: number;
      readonly rozamiento: number;
    });

/** Lee las propiedades de una pieza de Las trenzas (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLasTrenzas(
  cual: TipoDePiezaDeLasTrenzas,
  base: Base,
  entre: LeerEntre,
): PiezaDeLasTrenzasEnPlano {
  switch (cual) {
    case "nudo":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 0.5, 0.1, 3),
        umbral: entre("umbral", 0.7, 0.1, 1),
        fuerza: entre("fuerza", 25, 1, 500),
        desatar: entre("desatar", 2.5, 0.1, 30),
        masa: entre("masa", 1, 0.1, 20),
      };
    case "mula":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 1.2, 0.1, 10),
        rienda: entre("rienda", 1.3, 0.3, 5),
        carga: Math.round(entre("carga", 2, 0, 4)),
        giro: entre("giro", 1.8, 0.1, 20),
      };
    case "balde":
      return {
        ...base,
        cual,
        masa: entre("masa", 3, 0.2, 20),
        suelto: entre("suelto", 0.3, 0, 10),
        vuelve: entre("vuelve", 3, 0.5, 60),
      };
    case "brasa":
      return { ...base, cual, empujon: entre("empujon", 3.4, 0, 20), alcance: entre("alcance", 0.9, 0.1, 5) };
    case "sombreron":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 1, 0.1, 10),
        alcance: entre("alcance", 0.7, 0.1, 5),
        tocar: entre("tocar", 4, 0, 60),
        empujon: entre("empujon", 3.6, 0, 20),
      };
    case "sombrerote":
      return { ...base, cual, masa: entre("masa", 5, 0.2, 100), rozamiento: entre("rozamiento", 1, 0, 3) };
  }
}
