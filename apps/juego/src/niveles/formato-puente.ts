// Las piezas que estrena El puente de paja (TU-45), tal como las dice la escena: la qeswa (la cuerda de paja que se
// trenza entre dos, cada uno girando su torcedor para su lado), la chaka (el puente colgante que uno tensa y el otro
// amarra, que se mece con los que lo cruzan y se voltea si se mece de más), la bocatoma (la losa que abre o cierra la
// boca de un canal), el andén (la terraza sembrada que se riega) y la llama carguera, que escupe si la apuran. Como
// formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en
// piezas-puente.ts y llama.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DEL_PUENTE = ["qeswa", "chaka", "bocatoma", "anden", "carguera"] as const;
export type TipoDePiezaDelPuente = (typeof PIEZAS_DEL_PUENTE)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del puente de paja tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelPuenteEnPlano =
  | (Base & {
      /** La qeswa: tres hebras de paja a lo largo del lado más largo de la caja, con un torcedor (un palo de través
       * que gira sobre una estaca) en cada punta, a la altura del medio de la caja. Se trenza cuando los dos
       * torcedores giran a la vez y para lados contrarios. */
      readonly cual: "qeswa";
      /** Cuántas vueltas tiene que dar cada torcedor (girando los dos a la vez y al revés) para trenzarla. */
      readonly vueltas: number;
      /** En cuántos segundos se destuerce del todo si alguno suelta su torcedor antes de terminar. */
      readonly destorcer: number;
      /** La masa de cada torcedor (kg). */
      readonly masa: number;
    })
  | (Base & {
      /** La chaka: el puente colgante, a lo largo del lado más largo de la caja, con el piso arriba de la caja en las
       * puntas. Empieza flojo, colgando al fondo del cañón y sin piso: se tensa jalando la soga de su punta −
       * (caminando hacia atrás) y se amarra sosteniendo el amarre con las dos manos mientras está tenso. Amarrado,
       * tiene piso; se mece con los que caminan encima y, si se mece más de `voltear`, se voltea. */
      readonly cual: "chaka";
      /** Cuánto se comba hacia el medio tenso (m) y flojo (m). */
      readonly comba: number;
      readonly flojo: number;
      /** Lo que se jala la soga para tensarlo (m) y con qué fuerza se resiste la soga jalada del todo (N). */
      readonly tensar: number;
      readonly fuerza: number;
      /** A qué costado de la punta − van la soga (+) y el amarre (−) (m, de lado). */
      readonly lado: number;
      /** Qué parte del recorrido de la soga es «tenso», y cuánto hay que sostener el amarre así (s). */
      readonly umbral: number;
      readonly amarrar: number;
      /** Cuánto se mece cada uno que camina encima a todo lo que da (rad/s), cuánto se calma solo (1/s) y su periodo
       * (s). */
      readonly mecer: number;
      readonly calma: number;
      readonly periodo: number;
      /** Cuánto lo ladea cada metro que uno se corre del medio (rad/m). */
      readonly ladear: number;
      /** Mecido más que esto, se voltea (radianes). */
      readonly voltear: number;
    })
  | (Base & {
      /** La bocatoma: una losa de piedra (del tamaño de la caja, cerrada) que tapa la boca de un canal, con un palo y
       * un travesaño para las manos. Se abre jalándola hacia su frente (caminando para atrás) y se cierra
       * empujándola; queda donde la dejan. */
      readonly cual: "bocatoma";
      /** Cuánto sale la losa (m) y qué parte de eso es «abierta». */
      readonly recorrido: number;
      readonly umbral: number;
      /** A qué altura sobre la base de la caja va el travesaño (m). */
      readonly manija: number;
      readonly masa: number;
      /** Si empieza abierta (1) o cerrada (0). */
      readonly abierta: boolean;
    })
  | (Base & {
      /** El andén: la terraza sembrada (la base de la caja es la tierra; de alto, las matas). El guion la riega
       * (`regar`) mientras le llega agua; con `regar` segundos de agua queda regada. */
      readonly cual: "anden";
      readonly regar: number;
      /** Cuántos surcos tiene, a lo largo de su X. */
      readonly surcos: number;
      /** Si empieza ya regada (1). */
      readonly regada: boolean;
    })
  | (Base & {
      /** La llama carguera, con su carga en el lomo: su caja es ella de pie (la base en el suelo), mirando hacia el +
       * de su lado más largo. Sigue al que la lleva de la rienda, a su paso. Si la apuran (la rienda tirante más de
       * `paciencia`, o alguien la arrea de atrás), se enoja: le escupe, se echa y se vuelve a su casa. */
      readonly cual: "carguera";
      /** A qué velocidad anda (m/s; un muñeco anda a 1.6) y cuánto gira (rad/s). */
      readonly velocidad: number;
      readonly giro: number;
      /** El largo de la rienda (m). */
      readonly rienda: number;
      /** Cuánto aguanta la rienda tirante antes de enojarse (s). */
      readonly paciencia: number;
      /** Cuánto se queda echada después de escupir (s). */
      readonly echarse: number;
      /** Con qué velocidad tumba el escupitajo (m/s: con más de 3.2 tumba). */
      readonly escupir: number;
      /** A cuánto de su anca (m) el que se le viene encima la arrea. */
      readonly arrear: number;
    });

/** Lee las propiedades de una pieza del puente de paja (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelPuente(cual: TipoDePiezaDelPuente, base: Base, entre: LeerEntre): PiezaDelPuenteEnPlano {
  const grados = Math.PI / 180;
  switch (cual) {
    case "qeswa":
      return {
        ...base,
        cual,
        vueltas: entre("vueltas", 3, 0.25, 50),
        destorcer: entre("destorcer", 4, 0.2, 60),
        masa: entre("masa", 1, 0.1, 20),
      };
    case "chaka":
      return {
        ...base,
        cual,
        comba: entre("comba", 0.6, 0, 5),
        flojo: entre("flojo", 4, 0.5, 30),
        tensar: entre("tensar", 2.4, 0.3, 10),
        fuerza: entre("fuerza", 25, 1, 500),
        lado: entre("lado", 1.3, 0.2, 10),
        umbral: entre("umbral", 0.85, 0.1, 1),
        amarrar: entre("amarrar", 2.5, 0.1, 30),
        mecer: entre("mecer", 0.3, 0, 10),
        calma: entre("calma", 0.35, 0.01, 10),
        periodo: entre("periodo", 2.4, 0.3, 20),
        ladear: entre("ladear", 0.35, 0, 5),
        voltear: entre("voltear", 32, 5, 85) * grados,
      };
    case "bocatoma":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 0.5, 0.1, 3),
        umbral: entre("umbral", 0.7, 0.1, 1),
        manija: entre("manija", 1, 0.2, 3),
        masa: entre("masa", 6, 0.5, 100),
        abierta: entre("abierta", 0, 0, 1) >= 0.5,
      };
    case "anden":
      return {
        ...base,
        cual,
        regar: entre("regar", 5, 0.1, 120),
        surcos: Math.round(entre("surcos", 4, 1, 20)),
        regada: entre("regada", 0, 0, 1) >= 0.5,
      };
    case "carguera":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 0.9, 0.1, 10),
        giro: entre("giro", 1.8, 0.1, 20),
        rienda: entre("rienda", 1.4, 0.4, 5),
        paciencia: entre("paciencia", 1.5, 0.1, 30),
        echarse: entre("echarse", 3, 0.2, 30),
        escupir: entre("escupir", 3.6, 0, 20),
        arrear: entre("arrear", 0.6, 0.1, 5),
      };
  }
}
