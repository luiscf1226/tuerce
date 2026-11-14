// Las piezas que estrena La minga (TU-47), tal como las dice la escena: la casa de la minga (que se tira entre dos
// sobre troncos, con dos cabos), la chalupa (que se amarra al muelle con dos cabos), el ancla del Caleuche (que sube a
// quien se le para encima) y El Caleuche, el barco fantasma que en realidad anda de fiesta. Como formato.ts, no toca
// Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en piezas-minga.ts y
// caleuche.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

const GRADOS = Math.PI / 180;

export const PIEZAS_DE_LA_MINGA = ["minga", "chalupa", "ancla", "caleuche"] as const;
export type TipoDePiezaDeLaMinga = (typeof PIEZAS_DE_LA_MINGA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de La minga tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaMingaEnPlano =
  | (Base & {
      /** La casa de la minga, del tamaño de la caja, sobre un camino de troncos que sigue `recorrido` metros hacia el
       * +x de la caja. De las dos esquinas de adelante sale un cabo de `cabo` metros con su manija: se mueve solo
       * mientras cada cabo lo tira un muñeco distinto, y va hacia donde tiran los dos. Si una esquina pasa la punta
       * de los troncos, se sale y se atasca. */
      readonly cual: "minga";
      readonly recorrido: number;
      readonly cabo: number;
      /** Cuánto se estira cada cabo jalado del todo (m), con qué fuerza (N) y desde qué parte cuenta como tirar. */
      readonly estirar: number;
      readonly fuerza: number;
      readonly umbral: number;
      /** Con los dos cabos jalados del todo, cuánto anda (m/s). */
      readonly velocidad: number;
      /** Cuánto salen los troncos de cada lado de la casa (m). */
      readonly margen: number;
      /** Salida de los troncos, cuánto tarda en volver a ponerse en ellos (s). */
      readonly atasco: number;
    })
  | (Base & {
      /** La chalupa: un bote del tamaño de la caja, donde queda amarrada (con el muelle de su lado +z) y con la proa
       * hacia su +x. Suelta, está fondeada `fondeo` metros más afuera y `corrida` metros hacia su −x. Tiene dos
       * cabos (proa y popa) con su manija, que empiezan en el muelle; las bitas van `muelle` metros adentro del muelle
       * y `alto` metros sobre el piso de la chalupa. Se amarra con los dos cabos en sus bitas a la vez. */
      readonly cual: "chalupa";
      readonly masa: number;
      readonly cabo: number;
      readonly fondeo: number;
      readonly corrida: number;
      readonly muelle: number;
      readonly alto: number;
      /** Cuánto hay que tener los dos cabos en sus bitas (s) y a cuánto de la bita cuenta (m). */
      readonly nudo: number;
      readonly alcance: number;
    })
  | (Base & {
      /** El ancla del Caleuche: cuelga de su cadena entre lo bajo de la caja (el agua) y lo alto (la borda). Abajo,
       * con alguien parado en sus brazos, la suben; arriba, sin nadie, la vuelven a bajar. */
      readonly cual: "ancla";
      /** Qué tan rápido sube y baja (m/s), cuánto espera abajo con alguien encima y arriba sin nadie (s). */
      readonly velocidad: number;
      readonly espera: number;
      readonly arriba: number;
    })
  | (Base & {
      /** El Caleuche: el casco del tamaño de la caja (la cubierta arriba), con la proa hacia su −x y la popa hacia su
       * +x. Con los dos a bordo empieza la fiesta: `compases` compases de `compas` segundos en que la cubierta se
       * mece, cada vez más, hasta `rolido`. Si uno se sale de la cubierta, se corta la música y vuelve a empezar.
       * Al terminar baja la plancha de la popa, de `plancha` metros, hasta `bajada` más abajo. */
      readonly cual: "caleuche";
      readonly compases: number;
      readonly compas: number;
      /** Radianes. */
      readonly rolido: number;
      readonly plancha: number;
      readonly bajada: number;
      /** Dónde está el portalón de la borda de adelante (+z), por donde llega el ancla: a cuántos metros de la proa. */
      readonly portalon: number;
    });

/** Lee las propiedades de una pieza de La minga (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaMinga(cual: TipoDePiezaDeLaMinga, base: Base, entre: LeerEntre): PiezaDeLaMingaEnPlano {
  switch (cual) {
    case "minga":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 8, 0.5, 60),
        cabo: entre("cabo", 2, 0.5, 10),
        estirar: entre("estirar", 0.4, 0.05, 3),
        fuerza: entre("fuerza", 24, 1, 500),
        umbral: entre("umbral", 0.45, 0.05, 0.95),
        velocidad: entre("velocidad", 0.7, 0.05, 5),
        margen: entre("margen", 0.3, 0.05, 3),
        atasco: entre("atasco", 3, 0.5, 30),
      };
    case "chalupa":
      return {
        ...base,
        cual,
        masa: entre("masa", 150, 1, 3000),
        cabo: entre("cabo", 6.5, 0.5, 20),
        fondeo: entre("fondeo", 2.6, 0, 20),
        corrida: entre("corrida", 5, -30, 30),
        muelle: entre("muelle", 1, 0.2, 5),
        alto: entre("alto", 0.8, 0, 5),
        nudo: entre("nudo", 1, 0.1, 10),
        alcance: entre("alcance", 0.5, 0.1, 2),
      };
    case "ancla":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 0.6, 0.05, 5),
        espera: entre("espera", 0.6, 0.05, 10),
        arriba: entre("arriba", 2.5, 0.05, 30),
      };
    case "caleuche":
      return {
        ...base,
        cual,
        compases: Math.round(entre("compases", 24, 1, 200)),
        compas: entre("compas", 0.8, 0.2, 5),
        rolido: entre("rolido", 7, 0, 30) * GRADOS,
        plancha: entre("plancha", 3.4, 0.5, 10),
        bajada: entre("bajada", 0.6, -3, 3),
        // Al menos medio portalón (1,4 m de ancho en caleuche.ts): si no, la borda queda con medio ancho negativo
        portalon: entre("portalon", 1, 0.7, 50),
      };
  }
}
