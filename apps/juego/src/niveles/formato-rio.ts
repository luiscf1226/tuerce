// Las piezas que estrena el Río Plátano (TU-28), tal como las dice la escena: el pipante (la canoa de un solo tronco
// que se empuja con pértiga), el puente colgante con huecos que se reparan con tablas, la palmera que hace de
// catapulta y el Sisimite dormido. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por
// omisión. Cómo se arman está en piezas-rio.ts y sisimite.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DEL_RIO = ["pipante", "puente", "palmera", "sisimite"] as const;
export type TipoDePiezaDelRio = (typeof PIEZAS_DEL_RIO)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza del río tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDelRioEnPlano =
  | (Base & {
      /** El pipante: una canoa del tamaño de la caja que avanza hacia el + de su lado más largo. Arriba de la caja
       * va su piso. Empuja el que va de pie en la popa con los brazos alzados (la pértiga); lleva el rumbo el que va
       * en la proa con los brazos alzados: el pipante gira hacia donde él mira. */
      readonly cual: "pipante";
      readonly masa: number;
      /** Lo que empuja la pértiga (N). */
      readonly pertiga: number;
      /** A cuánto del medio, de costado, se clava la pértiga (m): por eso, sin nadie en la proa, el pipante gira. */
      readonly lado: number;
      /** Qué tan fuerte lo endereza el de la proa (1/s²). */
      readonly timon: number;
    })
  | (Base & {
      /** Un puente colgante a lo largo del lado más largo de la caja: el piso, a la altura de arriba de la caja en
       * las puntas, se comba hacia el medio. Le faltan tablas en `huecos` lugares, que se reparan dejando ahí sus
       * tablas (las piezas `tronco` `<nombre>-1`, `-2`…). */
      readonly cual: "puente";
      /** Cuánto baja el medio del piso (m). */
      readonly comba: number;
      /** Cuántos huecos tiene (repartidos a lo largo) y cuánto mide cada uno (m). */
      readonly huecos: number;
      readonly hueco: number;
      /** Cuánto baja el piso con cada muñeco encima (m). */
      readonly mecer: number;
    })
  | (Base & {
      /** Una palmera del tamaño de la caja, de pie, con una soga que cuelga del cogollo hasta la manija, junto al
       * tronco: jalándola caminando hacia atrás la palmera se dobla hacia atrás hasta que el cogollo toca el suelo.
       * Doblada del todo y soltada, se endereza de golpe y lanza hacia su frente al que esté en el cogollo. */
      readonly cual: "palmera";
      /** Cuánto se dobla (radianes). */
      readonly angulo: number;
      /** Cuánto se jala la soga para doblarla del todo (m) y a cuánto del tronco, de costado, cuelga (m). */
      readonly soga: number;
      readonly lado: number;
      /** La fuerza con que la palmera se resiste, con la soga jalada del todo (N). */
      readonly fuerza: number;
      /** Con qué velocidad sale volando el del cogollo (m/s) y hacia qué tan arriba (radianes). */
      readonly lanzar: number;
      readonly elevacion: number;
    })
  | (Base & {
      /** El Sisimite, dormido boca arriba a lo largo del lado más largo de su caja, con la cabeza hacia el +. Se lo
       * trepa como a un cerro. Se despierta si alguien le cae encima de lo alto o le pisa la cara. */
      readonly cual: "sisimite";
      /** Más rápido que esto (m/s) cayéndole encima, lo despierta: un salto no, una caída de 70 cm sí. */
      readonly aterrizaje: number;
      /** Cuánto se revuelve despierto antes de volver a dormirse (s). */
      readonly revolverse: number;
      /** La velocidad que les da a los que tiene encima al revolverse (m/s): con más de 3.2 se caen. */
      readonly empujon: number;
    });

/** Lee las propiedades de una pieza del río (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDelRio(cual: TipoDePiezaDelRio, base: Base, entre: LeerEntre): PiezaDelRioEnPlano {
  const grados = Math.PI / 180;
  switch (cual) {
    case "pipante":
      return {
        ...base,
        cual,
        masa: entre("masa", 30, 1, 1000),
        pertiga: entre("pertiga", 70, 1, 2000),
        lado: entre("lado", 0.45, 0, 5),
        timon: entre("timon", 6, 0, 100),
      };
    case "puente":
      return {
        ...base,
        cual,
        comba: entre("comba", 0.25, 0, 3),
        huecos: Math.round(entre("huecos", 2, 0, 6)),
        hueco: entre("hueco", 1.8, 0.2, 10),
        mecer: entre("mecer", 0.04, 0, 0.5),
      };
    case "palmera":
      return {
        ...base,
        cual,
        angulo: entre("angulo", 85, 10, 90) * grados,
        soga: entre("soga", 2.4, 0.3, 10),
        lado: entre("lado", 1.1, -5, 5),
        fuerza: entre("fuerza", 20, 1, 500),
        lanzar: entre("lanzar", 6.5, 0, 30),
        elevacion: entre("elevacion", 35, 0, 85) * grados,
      };
    case "sisimite":
      return {
        ...base,
        cual,
        aterrizaje: entre("aterrizaje", 3.6, 0.5, 30),
        revolverse: entre("revolverse", 3, 0.2, 30),
        empujon: entre("empujon", 2.5, 0, 20),
      };
  }
}
