// Las piezas que estrenan Los canales de Xochimilco (TU-42), tal como las dice la escena: la trajinera (que se empuja
// con dos pértigas, una de cada lado), la chinampa flotante que se hunde con el que está encima, la piñata (uno jala la
// soga y el otro le pega) y La Llorona. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores
// por omisión. Cómo se arman está en piezas-canales.ts y llorona.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LOS_CANALES = ["trajinera", "chinampa", "pinata", "llorona"] as const;
export type TipoDePiezaDeLosCanales = (typeof PIEZAS_DE_LOS_CANALES)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de los canales tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLosCanalesEnPlano =
  | (Base & {
      /** La trajinera: una lancha plana del tamaño de la caja que avanza hacia el + de su lado más largo, con el piso
       * arriba de la caja y el arco en la proa. Empujan los que van de pie en la popa con los brazos alzados: cada uno
       * con la pértiga de su lado (izquierda o derecha). */
      readonly cual: "trajinera";
      readonly masa: number;
      /** Lo que empuja cada pértiga (N). */
      readonly pertiga: number;
      /** A cuánto del medio, de costado, se clava cada pértiga (m): una sola la hace girar. */
      readonly lado: number;
      /** Cuántas flores lleva (macetas en el piso) y con qué cambio de velocidad en un paso (m/s) bota una. */
      readonly flores: number;
      readonly golpe: number;
      /** El alto del arco sobre el piso (m; 0: sin arco). Su viga de arriba choca: no pasa bajo un puente bajo. */
      readonly arco: number;
    })
  | (Base & {
      /** Una chinampa flotante del tamaño de la caja: se hunde mientras alguien está parado encima y vuelve a
       * subir sola cuando queda vacía. */
      readonly cual: "chinampa";
      /** Cuánto baja por segundo con cada muñeco encima (m/s) y cuánto aguanta antes de empezar (s). */
      readonly hundir: number;
      readonly aguante: number;
      /** Qué tan rápido vuelve a subir vacía (m/s) y hasta cuánto se hunde (m). */
      readonly subir: number;
      readonly fondo: number;
    })
  | (Base & {
      /** Una piñata colgada en el medio de una soga tendida entre dos postes (en las puntas del lado más largo de la
       * caja, del suelo a lo alto de la caja). La soga baja hasta una manija junto al poste del lado −: jalándola
       * caminando hacia atrás, la piñata baja; al soltarla, un resorte la vuelve a subir. Con `golpes` golpes se
       * rompe. */
      readonly cual: "pinata";
      /** Cuánto se jala la soga para bajarla del todo (m) y cuánto baja (m). */
      readonly soga: number;
      readonly baja: number;
      /** La fuerza con que la soga se resiste, jalada del todo (N). */
      readonly fuerza: number;
      /** Cuántos golpes aguanta, y con qué velocidad (m/s) tiene que llegar la mano o la cabeza para que cuente. */
      readonly golpes: number;
      readonly pegar: number;
    })
  | (Base & {
      /** La Llorona, de pie en su caja mirando hacia su frente. Llora (y el guion sube el agua con su llanto); se
       * ríe de los porrazos que ve: un muñeco que se cae delante de ella. Con `risas` carcajadas deja de llorar. */
      readonly cual: "llorona";
      readonly risas: number;
      /** Sin reírse en tanto tiempo (s), se olvida de una carcajada. */
      readonly olvido: number;
      /** Hasta qué distancia ve los porrazos (m), delante de ella. */
      readonly publico: number;
    });

/** Lee las propiedades de una pieza de los canales (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLosCanales(
  cual: TipoDePiezaDeLosCanales,
  base: Base,
  entre: LeerEntre,
): PiezaDeLosCanalesEnPlano {
  switch (cual) {
    case "trajinera":
      return {
        ...base,
        cual,
        masa: entre("masa", 80, 1, 2000),
        pertiga: entre("pertiga", 72, 1, 3000),
        lado: entre("lado", 0.7, 0, 5),
        flores: Math.round(entre("flores", 0, 0, 16)),
        golpe: entre("golpe", 0.4, 0.05, 10),
        arco: entre("arco", 2.1, 0, 5),
      };
    case "chinampa":
      return {
        ...base,
        cual,
        hundir: entre("hundir", 0.3, 0, 5),
        aguante: entre("aguante", 0.25, 0, 10),
        subir: entre("subir", 0.2, 0, 5),
        fondo: entre("fondo", 1, 0, 5),
      };
    case "pinata":
      return {
        ...base,
        cual,
        soga: entre("soga", 2.4, 0.3, 10),
        baja: entre("baja", 2, 0.1, 10),
        fuerza: entre("fuerza", 20, 1, 500),
        golpes: Math.round(entre("golpes", 4, 1, 50)),
        pegar: entre("pegar", 1, 0, 20),
      };
    case "llorona":
      return {
        ...base,
        cual,
        risas: Math.round(entre("risas", 3, 1, 20)),
        olvido: entre("olvido", 20, 1, 600),
        publico: entre("publico", 6, 0.5, 50),
      };
  }
}
