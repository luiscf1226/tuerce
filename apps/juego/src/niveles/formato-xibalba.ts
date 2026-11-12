// Las piezas que estrena Xibalbá (TU-26), tal como las dice la escena: el bloque pesado, la plancha doble, la
// estela que se gira entre dos, la pelota de hule, la antorcha, la llave de jade, los murciélagos y las guacamayas.
// Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en
// piezas-xibalba.ts y murcielagos.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";

export const PIEZAS_DE_XIBALBA = [
  "bloque",
  "doble",
  "estela",
  "pelota",
  "antorcha",
  "llave",
  "murcielagos",
  "guacamayas",
] as const;
export type TipoDePiezaDeXibalba = (typeof PIEZAS_DE_XIBALBA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

const GRADOS = Math.PI / 180;

/** Una pieza de Xibalbá tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeXibalbaEnPlano =
  | (Base & {
      /** Un bloque de piedra labrada del tamaño de la caja. Si pesa más de lo que levanta un muñeco solo, entre
       * menos de dos no se mueve de costado (ni empujándolo): solo cae. */
      readonly cual: "bloque";
      readonly masa: number;
      readonly rozamiento: number;
    })
  | (Base & {
      /** Dos planchas, una en cada punta del lado más largo de la caja (cuadradas, del ancho del lado corto):
       * queda pisada solo con las dos hundidas a la vez. */
      readonly cual: "doble";
      /** Los kilos que hunden del todo cada placa. */
      readonly peso: number;
      readonly hundir: number;
    })
  | (Base & {
      /** Una estela de piedra (la caja) que gira sobre su eje de pie, con dos varas a lo largo de su x para
       * empujarla. Trabada mientras no la agarren los dos. */
      readonly cual: "estela";
      readonly masa: number;
      /** Cuánto hay que girarla, hacia la izquierda vista desde arriba, para alinear los glifos (radianes). */
      readonly angulo: number;
      /** Hasta dónde llegan las varas, desde el eje (m). */
      readonly brazo: number;
      /** A qué altura van las varas, desde la base de la caja (m). */
      readonly altura: number;
    })
  | (Base & {
      /** Una pelota de hule (una esfera dentro de la caja) que rebota. */
      readonly cual: "pelota";
      readonly masa: number;
      readonly rebote: number;
      /** Tirada en el suelo sin que nadie la agarre, a los cuántos segundos vuelve sola a su lugar. */
      readonly vuelve: number;
    })
  | (Base & {
      /** Una antorcha grande (la caja: el travesaño a lo ancho y el palo a lo alto), encendida. Se lleva con las
       * dos manos en el travesaño. */
      readonly cual: "antorcha";
      readonly masa: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** La llave de jade: una placa labrada del tamaño de la caja. */
      readonly cual: "llave";
      readonly masa: number;
      readonly vuelve: number;
    })
  | (Base & {
      /** Los murciélagos de Xibalbá: su caja es el túnel donde viven. */
      readonly cual: "murcielagos";
      readonly cuantos: number;
      /** Hasta dónde alumbra una antorcha encendida (m): más lejos de la llama es oscuridad. */
      readonly radio: number;
      /** Volando (m/s). */
      readonly velocidad: number;
      /** Lo que sale disparado el muñeco espantado, hacia el −x de la caja (m/s): con más de 3.2 se cae. */
      readonly empujon: number;
      /** Después de espantar a alguien o de apagar una antorcha, cuánto se quedan quietos arriba (s). */
      readonly descanso: number;
      /** Cuántas perchas hay en el techo, repartidas a lo largo de la caja y a los lados (cada una con sus
       * murciélagos colgados). */
      readonly perchas: number;
      /** Una antorcha encendida a menos de esto de una percha (de costado) los despierta (m). */
      readonly despertar: number;
    })
  | (Base & {
      /** Guacamayas que vuelan en círculos dentro de su caja; solo imagen, sin cuerpo. */
      readonly cual: "guacamayas";
      readonly cuantas: number;
    });

/** Lee un número entre `min` y `max` (o el valor por omisión); el error lleva el nombre del nodo. */
export type LeerEntre = (clave: string, porDefecto: number, min: number, max: number) => number;

/** Lee las propiedades de una pieza de Xibalbá (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeXibalba(cual: TipoDePiezaDeXibalba, base: Base, entre: LeerEntre): PiezaDeXibalbaEnPlano {
  switch (cual) {
    case "bloque":
      return { ...base, cual, masa: entre("masa", 9, 0.5, 200), rozamiento: entre("rozamiento", 1, 0, 2) };
    case "doble":
      return { ...base, cual, peso: entre("peso", 15, 0.5, 500), hundir: entre("hundir", 0.06, 0.01, 0.5) };
    case "estela":
      return {
        ...base,
        cual,
        masa: entre("masa", 40, 1, 1000),
        angulo: entre("angulo", 90, 5, 180) * GRADOS,
        brazo: entre("brazo", 1.5, 0.3, 5),
        altura: entre("altura", 1.0, 0.2, 5),
      };
    case "pelota":
      return {
        ...base,
        cual,
        masa: entre("masa", 1.5, 0.1, 20),
        rebote: entre("rebote", 0.6, 0, 1),
        vuelve: entre("vuelve", 5, 0.5, 120),
      };
    case "antorcha":
      return { ...base, cual, masa: entre("masa", 1.2, 0.1, 20), vuelve: entre("vuelve", 4, 0.5, 120) };
    case "llave":
      return { ...base, cual, masa: entre("masa", 0.8, 0.05, 20), vuelve: entre("vuelve", 4, 0.5, 120) };
    case "murcielagos":
      return {
        ...base,
        cual,
        cuantos: Math.round(entre("cuantos", 9, 1, 40)),
        radio: entre("radio", 3, 0.5, 10),
        velocidad: entre("velocidad", 4.5, 0.5, 20),
        empujon: entre("empujon", 4, 0, 20),
        descanso: entre("descanso", 1.5, 0, 20),
        perchas: Math.round(entre("perchas", 3, 1, 12)),
        despertar: entre("despertar", 0.9, 0, 5),
      };
    case "guacamayas":
      return { ...base, cual, cuantas: Math.round(entre("cuantas", 6, 1, 30)) };
  }
}
