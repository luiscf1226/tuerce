// Las piezas que estrena La mina (TU-46), tal como las dice la escena: la vagoneta (que se empuja por su vía o baja
// sola la cuesta), el espejo y la grieta por donde entra el sol del salar, la ofrenda, las velas y El Tío. Como
// formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en
// piezas-mina.ts y tio.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

/** `valor`, pero al menos `minimo` lejos de 0 (con su signo; 0 cuenta como positivo). */
function lejosDeCero(valor: number, minimo: number): number {
  return Math.abs(valor) >= minimo ? valor : valor < 0 ? -minimo : minimo;
}

export const PIEZAS_DE_LA_MINA = ["vagoneta", "espejo", "grieta", "ofrenda", "velas", "tio"] as const;
export type TipoDePiezaDeLaMina = (typeof PIEZAS_DE_LA_MINA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de la mina tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaMinaEnPlano =
  | (Base & {
      /** Una vagoneta del tamaño de la caja (las ruedas abajo), mirando hacia su +x. Va por su vía (el guion se la
       * da; si no, derecho hacia su +x): se empuja caminando contra ella, la cuesta la apura o la frena y los rieles
       * la frenan de a poco. Lleva al que va adentro. */
      readonly cual: "vagoneta";
      readonly masa: number;
      /** Cuánto la frenan los rieles (1/s): con mucho, se para apenas la dejan de empujar. */
      readonly roce: number;
      /** Más rápido que esto no va (m/s). */
      readonly velocidad: number;
      /** El alto de las ruedas (m): la caja que choca empieza más arriba. */
      readonly ruedas: number;
      /** Sin otra vía, cuánto anda hacia su +x (m). */
      readonly recorrido: number;
    })
  | (Base & {
      /** Un espejo del tamaño de la caja (de ancho su x, de alto su y), de dos caras, sobre un poste que baja hasta el
       * piso. Gira sobre el poste: un brazo a la altura de las manos, hacia su frente, se empuja caminando. Un resorte
       * lo vuelve al reposo; empujado del todo (`giro`), queda **orientado** mientras lo sostienen. */
      readonly cual: "espejo";
      /** Cuánto gira desde el reposo hasta su tope (radianes, positivo a la izquierda visto desde arriba). */
      readonly giro: number;
      /** Qué parte del giro cuenta como orientado. */
      readonly umbral: number;
      /** La fuerza en la punta del brazo para tenerlo en el tope (N). */
      readonly fuerza: number;
      /** El largo del brazo (m) y a qué altura sobre el piso va. */
      readonly brazo: number;
      readonly manija: number;
      /** Cuánto baja el poste desde la base de la caja hasta el piso (m). */
      readonly poste: number;
      readonly masa: number;
    })
  | (Base & {
      /** La grieta por donde entra el sol: un haz claro que sale del centro de la caja hacia su frente (el −Y de
       * Blender) y rebota en los espejos que encuentra. Lo para lo fijo y lo cinemático. */
      readonly cual: "grieta";
      /** Hasta dónde llega cada tramo del haz (m). */
      readonly largo: number;
      /** Cuántas veces rebota, a lo sumo. */
      readonly rebotes: number;
    })
  | (Base & {
      /** La ofrenda para El Tío: un atado de coca, un cigarro y un trago, del tamaño de la caja. Quieta en su lugar
       * hasta que la agarran; tirada en el suelo, vuelve sola. Si pasa por las velas (a menos de su `radio`), es un
       * susto: ¡pum!, vuelve a su lugar y el que la llevaba aparece frente a ella. */
      readonly cual: "ofrenda";
      readonly masa: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** Una hilera de velas a lo largo del lado más largo de su caja, paradas en su base. Lo que pase a menos de
       * `radio` de una (de costado) se acerca demasiado a la llama. */
      readonly cual: "velas";
      readonly cuantas: number;
      readonly radio: number;
    })
  | (Base & {
      /** El Tío de la mina: un diablito sentado en el medio de la base de su caja, mirando hacia su frente. Mira al
       * muñeco más cercano (a menos de `vista`) y estira la mano. La ofrenda suelta a menos de `alcance` de su mano se
       * la queda: desde ahí está contento. Cinemático, sin azar. */
      readonly cual: "tio";
      readonly vista: number;
      readonly alcance: number;
    });

/** Lee las propiedades de una pieza de la mina (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaMina(cual: TipoDePiezaDeLaMina, base: Base, entre: LeerEntre): PiezaDeLaMinaEnPlano {
  const GRADOS = Math.PI / 180;
  switch (cual) {
    case "vagoneta":
      return {
        ...base,
        cual,
        masa: entre("masa", 40, 5, 500),
        roce: entre("roce", 2, 0, 20),
        velocidad: entre("velocidad", 2, 0.2, 10),
        ruedas: entre("ruedas", 0.3, 0.05, 1),
        recorrido: entre("recorrido", 10, 0, 60),
      };
    case "espejo":
      return {
        ...base,
        cual,
        // Con 0 el espejo no gira: la rigidez del motor sería infinita (NaN en el mundo)
        giro: lejosDeCero(entre("giro", 35, -120, 120), 5) * GRADOS,
        umbral: entre("umbral", 0.9, 0.3, 1),
        fuerza: entre("fuerza", 15, 1, 200),
        brazo: entre("brazo", 0.9, 0.3, 2),
        manija: entre("manija", 1.0, 0.4, 2),
        poste: entre("poste", 1.5, 0, 5),
        masa: entre("masa", 6, 0.5, 100),
      };
    case "grieta":
      return { ...base, cual, largo: entre("largo", 20, 1, 100), rebotes: Math.round(entre("rebotes", 4, 0, 10)) };
    case "ofrenda":
      return { ...base, cual, masa: entre("masa", 0.6, 0.05, 5), vuelve: entre("vuelve", 3, 0.5, 60) };
    case "velas":
      return { ...base, cual, cuantas: Math.round(entre("cuantas", 4, 1, 30)), radio: entre("radio", 0.45, 0.1, 2) };
    case "tio":
      return { ...base, cual, vista: entre("vista", 5, 0.5, 30), alcance: entre("alcance", 0.9, 0.2, 5) };
  }
}
