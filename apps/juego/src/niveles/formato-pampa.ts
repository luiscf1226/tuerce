// Las piezas que estrena La pampa (TU-48), tal como las dice la escena: el pampero (el viento que sopla a ráfagas), la
// tranquera que el viento cierra de golpe, las boleadoras, el chambergo que se lleva el viento, el pie de amigo (la
// escalerita que hace uno con las manos para que suba el otro), el candil (el farol donde se encierra la Luz) y La
// Luz Mala. Como formato.ts, no toca Rapier: solo lee las propiedades y pone los valores por omisión. Cómo se arman
// está en piezas-pampa.ts y luz-mala.ts; la convención, en niveles/README.md.
import type * as THREE from "three";
import type { Volumen } from "./formato";
import type { LeerEntre } from "./formato-pinar";

export const PIEZAS_DE_LA_PAMPA = [
  "pampero",
  "tranquera",
  "boleadoras",
  "chambergo",
  "pie-de-amigo",
  "candil",
  "luz-mala",
] as const;
export type TipoDePiezaDeLaPampa = (typeof PIEZAS_DE_LA_PAMPA)[number];

interface Base {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  readonly caja: Volumen;
}

/** Una pieza de la pampa tal como la dice la escena, con los valores por omisión ya puestos. */
export type PiezaDeLaPampaEnPlano =
  | (Base & {
      /** El pampero: su caja es donde sopla, hacia su frente (el −Y de Blender). Sopla siempre un poco y, a ratos, en
       * ráfagas: empuja a los muñecos que están adentro, cierra las tranqueras y se lleva el chambergo. */
      readonly cual: "pampero";
      /** Lo que empuja a un muñeco en lo más fuerte de una ráfaga (m/s²). */
      readonly fuerza: number;
      /** Qué parte de la fuerza sopla entre ráfaga y ráfaga (de 0 a 1). */
      readonly calma: number;
      /** Cada cuánto viene una ráfaga y cuánto dura, en promedio (s). */
      readonly cada: number;
      readonly dura: number;
      /** El azar de las ráfagas (siempre el mismo con la misma semilla). */
      readonly semilla: number;
    })
  | (Base & {
      /** La tranquera: una puerta de varas del tamaño de la caja, larga a lo largo de su X, con la bisagra en su punta
       * −x y la manija en la +x. Se abre solo hacia su frente (jalándola) y el viento la cierra de golpe al soltarla. */
      readonly cual: "tranquera";
      /** Lo que hay que hacer en la manija para sostenerla abierta contra el viento, sin ráfaga (N). */
      readonly fuerza: number;
      /** Cuánto se abre, a lo sumo (radianes). */
      readonly abrir: number;
      readonly masa: number;
    })
  | (Base & {
      /** Las boleadoras: tres bolas atadas, colgadas donde está la caja hasta que las agarran. Se lanzan saltando y
       * soltándolas en el aire; tiradas en el suelo, vuelven solas a su lugar. */
      readonly cual: "boleadoras";
      readonly masa: number;
      /** Tiradas en el suelo, a los cuántos segundos vuelven (s). */
      readonly vuelve: number;
    })
  | (Base & {
      /** El chambergo que se llevó el viento: vuela dentro de su caja, subiendo y bajando con el pampero. No se
       * alcanza con la mano: solo lo bajan unas boleadoras bien tiradas que le pasan cerca. */
      readonly cual: "chambergo";
      /** A qué velocidad vuela con el viento quieto (m/s). */
      readonly velocidad: number;
      /** A cuánto de él (m) tienen que pasar las boleadoras para enredarlo. */
      readonly enredar: number;
      /** El azar de su vuelo (siempre el mismo con la misma semilla). */
      readonly semilla: number;
    })
  | (Base & {
      /** El pie de amigo: su caja es donde se para el que hace la escalerita (la base en el suelo), mirando hacia su
       * frente. Parado ahí con los dos brazos alzados, sus manos son un escalón para el otro. */
      readonly cual: "pie-de-amigo";
      /** A qué altura queda el escalón sobre la base de la caja (m). */
      readonly alto: number;
      /** Dónde queda el escalón: desde cuánto y hasta cuánto delante del medio de la caja (m). */
      readonly desde: number;
      readonly hasta: number;
      /** Su ancho (m), a lo ancho de la caja. */
      readonly ancho: number;
    })
  | (Base & {
      /** El candil: un farol de lata del tamaño de la caja, quieto en su gancho hasta que lo agarran. Ahí adentro se
       * encierra la Luz. Tirado mucho rato (o caído al vacío), vuelve a su gancho. */
      readonly cual: "candil";
      readonly masa: number;
    })
  | (Base & {
      /** La Luz Mala: una luciérnaga gigante y despistada, del tamaño de la caja, que empieza ahí. Guía por el
       * camino que le da el guion, pero a veces se equivoca (con azar de semilla); después revolotea entre sus
       * posaderos hasta que la encierran en un candil. */
      readonly cual: "luz-mala";
      /** A qué velocidad vuela (m/s). */
      readonly velocidad: number;
      /** A cuánto de cada parada (m, de costado) tiene que llegar alguno para que siga. */
      readonly esperar: number;
      /** Qué tan seguido acierta el camino en cada desvío (de 0 a 1). */
      readonly acierto: number;
      /** Cuánto se queda donde no era antes de darse cuenta (s). */
      readonly despiste: number;
      /** Cuánto se queda posada, en promedio (s). */
      readonly posarse: number;
      /** A cuánto se espanta del que se le acerca sin candil, y a cuánto del candil queda encerrada (m). */
      readonly espantar: number;
      readonly atrapar: number;
      /** El azar de sus despistes (siempre el mismo con la misma semilla). */
      readonly semilla: number;
    });

/** Lee las propiedades de una pieza de la pampa (`base`: nombre, objeto y caja ya leídos). */
export function leerPiezaDeLaPampa(cual: TipoDePiezaDeLaPampa, base: Base, entre: LeerEntre): PiezaDeLaPampaEnPlano {
  const grados = Math.PI / 180;
  const semilla = () => Math.round(entre("semilla", 1, 0, 1e6));
  switch (cual) {
    case "pampero":
      return {
        ...base,
        cual,
        fuerza: entre("fuerza", 3, 0, 30),
        calma: entre("calma", 0.35, 0, 1),
        cada: entre("cada", 6, 0.5, 120),
        dura: entre("dura", 2.5, 0.2, 60),
        semilla: semilla(),
      };
    case "tranquera":
      return {
        ...base,
        cual,
        fuerza: entre("fuerza", 16, 0, 200),
        abrir: entre("abrir", 100, 20, 170) * grados,
        masa: entre("masa", 4, 0.5, 100),
      };
    case "boleadoras":
      return { ...base, cual, masa: entre("masa", 1.2, 0.2, 5), vuelve: entre("vuelve", 2.5, 0.2, 60) };
    case "chambergo":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 1.3, 0.1, 10),
        enredar: entre("enredar", 0.75, 0.1, 5),
        semilla: semilla(),
      };
    case "pie-de-amigo":
      return {
        ...base,
        cual,
        alto: entre("alto", 1.1, 0.2, 3),
        desde: entre("desde", 0.75, 0, 5),
        hasta: entre("hasta", 1.35, 0.1, 6),
        ancho: entre("ancho", 1, 0.2, 5),
      };
    case "candil":
      return { ...base, cual, masa: entre("masa", 1, 0.2, 10) };
    case "luz-mala":
      return {
        ...base,
        cual,
        velocidad: entre("velocidad", 2.2, 0.1, 20),
        esperar: entre("esperar", 1.1, 0.2, 10),
        acierto: entre("acierto", 0.6, 0, 1),
        despiste: entre("despiste", 2.5, 0, 30),
        posarse: entre("posarse", 3.5, 0.2, 60),
        espantar: entre("espantar", 1.3, 0, 10),
        atrapar: entre("atrapar", 0.55, 0.1, 5),
        semilla: semilla(),
      };
  }
}
