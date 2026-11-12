// El guion de un nivel (TU-11): lo que el .glb no puede decir. Cada nivel tiene el suyo en niveles/<carpeta>/guion.ts
// y se engancha en estos momentos; todos son opcionales.
import type RAPIER from "@dimforge/rapier3d-compat";
import type * as THREE from "three";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
// La poza (TU-24)
import type { Agua, Aguas } from "./agua";
import type { Pieza } from "./armar";
import type { Cadejo } from "./cadejo";
import type { Duende } from "./duende";
import type { PlanoDeNivel } from "./formato";
import type { Murcielagos } from "./murcielagos";
import type { Balancin, Bejuco, Huacal, Palanca, Plancha } from "./piezas";
import type { Hueso, Lampara, Tranca, Tronco } from "./piezas-pinar";
import type { Balsa, Batea, Piedra, Tendedero } from "./piezas-poza";
import type { Sucia } from "./sucia";
import type { Antorcha, Bloque, Doble, Estela, Guacamayas, Llave, Pelota } from "./piezas-xibalba";
import type { Dresina, Grua, Racimo, Sombrero, Vagon } from "./piezas-tren";

/** Lo que el guion ve del nivel en juego. */
export interface NivelEnJuego {
  readonly plano: PlanoDeNivel;
  readonly rapier: Rapier;
  readonly mundo: RAPIER.World;
  readonly escena: THREE.Scene;
  /** El rojo (jugador 1) y el turquesa (jugador 2). */
  readonly munecos: readonly [Muneco, Muneco];
  /** Pasos de físicas desde que empezó el nivel. */
  readonly pasos: number;
  /** El último punto de control alcanzado por la pareja (0 = la salida). */
  readonly puntoDeControl: number;
  /** El sólido con ese nombre (el del nodo en Blender). Si no existe, es un error del nivel. */
  pieza(nombre: string): Pieza;
  /** Si la pareja ya encontró el secreto del nivel (TU-29). */
  readonly secreto: boolean;
  /** Si la pareja ya ganó el logro del nivel. */
  readonly logro: boolean;
  /** La pareja encontró el secreto. Lo llama sola una zona `secreto` del .glb; el guion, si el secreto es otra cosa
   * (tocar la campana, abrir un cofre). Si ya lo tenían, no hace nada. */
  encontrarSecreto(): void;
  /** La pareja ganó el logro del nivel. Lo decide el guion (llegar a la meta sin caer, no botar la escalera…). */
  lograr(): void;
  /** Las piezas de juego por nombre (TU-12, ver piezas.ts). Si no existe o es de otra clase, es un error del nivel. */
  huacal(nombre: string): Huacal;
  palanca(nombre: string): Palanca;
  plancha(nombre: string): Plancha;
  balancin(nombre: string): Balancin;
  bejuco(nombre: string): Bejuco;
  /** Las que estrena El pinar (TU-14, ver piezas-pinar.ts y cadejo.ts). */
  tronco(nombre: string): Tronco;
  tranca(nombre: string): Tranca;
  hueso(nombre: string): Hueso;
  lampara(nombre: string): Lampara;
  cadejo(nombre: string): Cadejo;
  /** El agua (TU-24, ver agua.ts): la zona con ese nombre, y todas (para `alMojar`, `densidad`…). */
  agua(nombre: string): Agua;
  readonly aguas: Aguas;
  /** Las piezas que estrena La poza (TU-24, ver piezas-poza.ts y sucia.ts). */
  balsa(nombre: string): Balsa;
  tendedero(nombre: string): Tendedero;
  batea(nombre: string): Batea;
  piedra(nombre: string): Piedra;
  sucia(nombre: string): Sucia;
  /** Las que estrena Xibalbá (TU-26, ver piezas-xibalba.ts y murcielagos.ts). */
  bloque(nombre: string): Bloque;
  doble(nombre: string): Doble;
  estela(nombre: string): Estela;
  pelota(nombre: string): Pelota;
  antorcha(nombre: string): Antorcha;
  llave(nombre: string): Llave;
  murcielagos(nombre: string): Murcielagos;
  guacamayas(nombre: string): Guacamayas;
  /** Las que estrena El tren bananero (TU-27, ver piezas-tren.ts y duende.ts). */
  vagon(nombre: string): Vagon;
  dresina(nombre: string): Dresina;
  grua(nombre: string): Grua;
  racimo(nombre: string): Racimo;
  sombrero(nombre: string): Sombrero;
  duende(nombre: string): Duende;
}

export interface GuionDeNivel {
  /** Una vez, con todo armado y los muñecos en la salida. */
  alEmpezar?(nivel: NivelEnJuego): void;
  /** En cada paso, antes de `mundo.step()`: para mover lo cinemático (compuertas, plataformas). */
  cadaPaso?(nivel: NivelEnJuego): void;
  /** La pareja alcanzó un punto de control nuevo (1, 2…). */
  alAlcanzar?(punto: number, nivel: NivelEnJuego): void;
  /** La pareja retoma un avance guardado en ese punto: el guion deja el nivel como estaría al llegar ahí. */
  alRetomar?(punto: number, nivel: NivelEnJuego): void;
}
