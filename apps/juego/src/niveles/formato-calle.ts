// Las piezas que estrena La calle empedrada (TU-25), tal como las dice la escena: la carreta (en su riel), la Carreta
// sin bueyes, las pesas y los engranajes del reloj, las campanas y las alfombras de aserrín. Como formato.ts, no toca
// Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman está en piezas-calle.ts y
// sin-bueyes.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";

export const PIEZAS_DE_LA_CALLE = ["carreta", "sin-bueyes", "pesa", "engranaje", "campana", "alfombra"] as const;
export type TipoDePiezaDeLaCalle = (typeof PIEZAS_DE_LA_CALLE)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

const GRADOS = Math.PI / 180;

/** Una pieza de la calle tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaCalleEnPlano =
  | (Base & {
      /** Una carreta de dos ruedas en su riel, que va a lo largo de la x de su caja (inclinada `pendiente`). Sola
       * no frena: la cuesta la lleva. */
      readonly cual: "carreta";
      readonly masa: number;
      /** Hasta dónde llega por el riel hacia su +x y hacia su −x desde donde empieza (m). */
      readonly adelante: number;
      readonly atras: number;
      /** Cuánto se inclina el riel respecto de la x de la caja (radianes; positivo: sube hacia +x). */
      readonly pendiente: number;
      /** El rozamiento de las ruedas: la fuerza que la frena por cada m/s (N·s/m). */
      readonly rozamiento: number;
      /** Dónde va el eje a lo largo de la caja: 0 atrás, 1 adelante. */
      readonly eje: number;
      /** Cuánto se puede empinar la caja hacia atrás sobre el eje (radianes; 0: va fija al eje). */
      readonly empina: number;
      /** Cuánto cabecea hacia adelante (radianes): ahí descansan las varas. */
      readonly cabecea: number;
      /** Lo que pesan las varas y el yugo, adelante (kg): hacen que la caja descanse hacia adelante. */
      readonly contrapeso: number;
      /** En los últimos metros del riel se frena sola hasta parar en la punta (m; 0: llega de golpe). */
      readonly llegada: number;
    })
  | (Base & {
      /** La Carreta sin bueyes: rueda sola a lo largo de la x de su caja, de donde empieza hasta `recorrido` y de
       * vuelta, sin frenar nunca, y al que encuentra en el camino lo saca. Solo la para su freno (el guion). */
      readonly cual: "sin-bueyes";
      readonly recorrido: number;
      /** Rodando (m/s): más del doble de lo que anda un muñeco (1.6). */
      readonly velocidad: number;
      /** Cuánto espera en cada punta (s). */
      readonly espera: number;
      /** La velocidad con que saca al muñeco que encuentra, hacia el principio del recorrido (m/s). */
      readonly empujon: number;
      /** Cómo frena (m/s²). */
      readonly frenada: number;
    })
  | (Base & {
      /** Una pesa del reloj, colgada de su cadena, con una manija a lo ancho (la x de la caja) abajo. El que se
       * cuelga la baja `recorrido`; abajo del todo, se traba (y el engranaje que mueve queda donde llegó). */
      readonly cual: "pesa";
      readonly recorrido: number;
      /** Bajando con alguien colgado y subiendo sola (m/s). */
      readonly bajada: number;
      readonly subida: number;
      /** El largo de la cadena, desde arriba de la caja hasta donde sale del muro (m). */
      readonly cadena: number;
    })
  | (Base & {
      /** Un engranaje (o una aguja del reloj) que gira en el plano de su caja, sobre su z, con una pesa. */
      readonly cual: "engranaje";
      /** El número de la pesa que lo mueve: la que se llama `pesa-N`. */
      readonly pesa: number;
      /** Cuántas vueltas da cuando la pesa baja todo su recorrido (positivo: como las agujas del reloj). */
      readonly vueltas: number;
      /** Hacia dónde apunta al empezar (radianes desde arriba, como las agujas). */
      readonly desde: number;
      readonly dientes: number;
      /** Una aguja del reloj en vez de una rueda dentada. */
      readonly aguja: boolean;
    })
  | (Base & {
      /** Una campana colgada (su caja), con la soga que baja hasta una manija a lo ancho (la x de la caja). El que se
       * cuelga de la manija la baja `recorrido` y la campana suena. */
      readonly cual: "campana";
      /** El largo de la soga, desde abajo de la campana hasta la manija (m). */
      readonly soga: number;
      /** Cuánto adelante (el +z de la caja) cuelga la soga de la campana (m). */
      readonly adelante: number;
      readonly recorrido: number;
      /** Cuánto cuenta como sonando después de cada campanada (s). */
      readonly sonar: number;
    })
  | (Base & {
      /** Una alfombra de aserrín sobre el suelo, del tamaño de la caja: el que la pisa la deja marcada. */
      readonly cual: "alfombra";
      readonly semilla: number;
    });

/** Lee un número entre `min` y `max` (o el valor por omisión); el error lleva el nombre del nodo. */
export type LeerEntre = (clave: string, porDefecto: number, min: number, max: number) => number;

/** Lee las propiedades de una pieza de la calle (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaCalle(cual: TipoDePiezaDeLaCalle, base: Base, entre: LeerEntre): PiezaDeLaCalleEnPlano {
  switch (cual) {
    case "carreta":
      return {
        ...base,
        cual,
        masa: entre("masa", 90, 5, 1000),
        adelante: entre("adelante", 5, 0, 60),
        atras: entre("atras", 0, 0, 60),
        pendiente: entre("pendiente", 0, -45, 45) * GRADOS,
        rozamiento: entre("rozamiento", 40, 0, 5000),
        eje: entre("eje", 0.5, 0, 1),
        empina: entre("empina", 0, 0, 60) * GRADOS,
        cabecea: entre("cabecea", 4, 0, 30) * GRADOS,
        contrapeso: entre("contrapeso", 12, 0, 200),
        llegada: entre("llegada", 0, 0, 20),
      };
    case "sin-bueyes":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 8, 0.5, 60),
        velocidad: entre("velocidad", 3.5, 0.2, 15),
        espera: entre("espera", 0.6, 0, 30),
        empujon: entre("empujon", 4.5, 0, 20),
        frenada: entre("frenada", 6, 0.5, 50),
      };
    case "pesa":
      return {
        ...base,
        cual,
        recorrido: entre("recorrido", 0.4, 0.05, 3),
        bajada: entre("bajada", 0.35, 0.02, 5),
        subida: entre("subida", 0.15, 0.01, 5),
        cadena: entre("cadena", 2, 0.1, 20),
      };
    case "engranaje":
      return {
        ...base,
        cual,
        pesa: entre("pesa", 1, 1, 99),
        vueltas: entre("vueltas", 1, -20, 20),
        desde: entre("desde", 0, -360, 360) * GRADOS,
        dientes: Math.round(entre("dientes", 12, 3, 80)),
        aguja: entre("aguja", 0, 0, 1) !== 0,
      };
    case "campana":
      return {
        ...base,
        cual,
        soga: entre("soga", 3, 0.1, 30),
        adelante: entre("adelante", 0, -5, 5),
        recorrido: entre("recorrido", 0.35, 0.05, 2),
        sonar: entre("sonar", 1, 0.1, 10),
      };
    case "alfombra":
      return { ...base, cual, semilla: entre("semilla", 1, 0, 1000) };
  }
}
