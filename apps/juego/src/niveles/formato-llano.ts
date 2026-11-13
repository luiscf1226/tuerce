// Las piezas que estrena El llano (TU-44), tal como las dice la escena: el Silbón (el flaco altísimo que silba al
// revés), el molino de viento que se frena, el ganado que se arrea hasta el corral, la hamaca que estira uno y lanza
// al otro, y el saco de cachivaches del Silbón. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los
// valores por omisión. Cómo se arman está en piezas-llano.ts y silbon.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DEL_LLANO = ["silbon", "molino", "ganado", "hamaca", "saco"] as const;
export type TipoDePiezaDelLlano = (typeof PIEZAS_DEL_LLANO)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del llano tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelLlanoEnPlano =
  | (Base & {
      /** El Silbón: su caja es donde está escondido, agachado en el pajonal (la base en el suelo; de alto, lo que
       * mide de pie). Silba mientras está escondido: fuerte de lejos y bajito de cerca. Lo halla el primero que llega
       * a `hallar` de él. */
      readonly cual: "silbon";
      /** A cuánto de él (m, de costado) hay que llegar para hallarlo. */
      readonly hallar: number;
      /** A qué velocidad camina (m/s). */
      readonly velocidad: number;
      /** A cuánto de él (m) tiene que quedar su saco para que lo agarre. */
      readonly alcance: number;
    })
  | (Base & {
      /** El molino de viento: su caja es la rueda (el eje en el centro, las aspas a lo largo de su X e Y, de radio
       * el mayor de los dos; de grueso, su Z). Dos aspas largas, que el viento hace girar sobre la Z de la caja. Con
       * el freno, la rueda para con las aspas tendidas `angulo` (una rampa del pozo hasta arriba). */
      readonly cual: "molino";
      /** Cuánto suben las aspas paradas, desde el oeste (−x) hacia el este (+x) de la caja (radianes). */
      readonly angulo: number;
      /** Qué tan rápido gira con el viento (rad/s), cuánto tarda en agarrar viento y en frenar (rad/s²). */
      readonly viento: number;
      readonly arranque: number;
      readonly frenada: number;
    })
  | (Base & {
      /** El ganado: su caja es el potrero, con el corral en su punta + (los últimos `corral` metros de su X). Las
       * reses pastan sueltas y se apartan del muñeco que se les acerca; la que entra al corral se queda ahí. */
      readonly cual: "ganado";
      readonly cuantas: number;
      /** El largo del corral, en la punta +x de la caja (m). */
      readonly corral: number;
      /** A cuánto de un muñeco (m) se espanta una res, y a qué velocidad se aparta (m/s). */
      readonly huir: number;
      readonly velocidad: number;
      /** Cuánto pesa cada una (kg): un muñeco no la mueve empujando. */
      readonly masa: number;
      /** El azar de cómo pastan (siempre el mismo con la misma semilla). */
      readonly semilla: number;
    })
  | (Base & {
      /** La hamaca: colgada a lo ancho de la X de la caja, entre dos horcones, mirando hacia su frente (el −Y de
       * Blender). Su cabuya se jala hacia atrás caminando (como la palmera del río) y estira la hamaca hacia atrás
       * hasta el suelo; soltada del todo, lanza hacia su frente al que esté adentro. */
      readonly cual: "hamaca";
      /** Cuánto se estira hacia atrás (m: también lo que se jala la cabuya). */
      readonly estirar: number;
      /** A qué costado de la hamaca cuelga la manija de la cabuya (m, a lo largo de su X; negativo, del otro lado). */
      readonly lado: number;
      /** La fuerza con que la hamaca se resiste, estirada del todo (N). */
      readonly fuerza: number;
      /** A qué altura cuelga el medio de la hamaca sobre la base de la caja (m). */
      readonly colgar: number;
      /** Con qué velocidad sale volando el de adentro (m/s) y hacia qué tan arriba (radianes). */
      readonly lanzar: number;
      readonly elevacion: number;
    })
  | (Base & {
      /** El saco de cachivaches del Silbón: un saco del tamaño de la caja, que se carga con una mano o con las dos. */
      readonly cual: "saco";
      readonly masa: number;
    });

/** Lee las propiedades de una pieza del llano (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelLlano(cual: TipoDePiezaDelLlano, base: Base, entre: LeerEntre): PiezaDelLlanoEnPlano {
  const grados = Math.PI / 180;
  switch (cual) {
    case "silbon":
      return {
        ...base,
        cual,
        hallar: entre("hallar", 1.3, 0.3, 10),
        velocidad: entre("velocidad", 1.4, 0.1, 10),
        alcance: entre("alcance", 1.6, 0.3, 10),
      };
    case "molino":
      return {
        ...base,
        cual,
        angulo: entre("angulo", 15, 0, 60) * grados,
        viento: entre("viento", 1.6, 0.1, 10),
        arranque: entre("arranque", 1.2, 0.05, 50),
        frenada: entre("frenada", 2.5, 0.05, 50),
      };
    case "ganado":
      return {
        ...base,
        cual,
        cuantas: Math.round(entre("cuantas", 3, 1, 12)),
        corral: entre("corral", 5, 0.5, 100),
        huir: entre("huir", 3.2, 0.5, 20),
        velocidad: entre("velocidad", 1.4, 0.1, 10),
        masa: entre("masa", 250, 10, 2000),
        semilla: Math.round(entre("semilla", 1, 0, 1e6)),
      };
    case "hamaca":
      return {
        ...base,
        cual,
        estirar: entre("estirar", 2.2, 0.3, 10),
        lado: entre("lado", -1.8, -10, 10),
        fuerza: entre("fuerza", 25, 1, 500),
        colgar: entre("colgar", 0.55, 0.1, 5),
        lanzar: entre("lanzar", 8, 0, 30),
        elevacion: entre("elevacion", 38, 0, 85) * grados,
      };
    case "saco":
      return { ...base, cual, masa: entre("masa", 3, 0.2, 50) };
  }
}
