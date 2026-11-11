// El guion de un nivel (TU-11): lo que el .glb no puede decir. Cada nivel tiene el suyo en niveles/<carpeta>/guion.ts
// y se engancha en estos momentos; todos son opcionales.
import type RAPIER from "@dimforge/rapier3d-compat";
import type * as THREE from "three";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
import type { Pieza } from "./armar";
import type { PlanoDeNivel } from "./formato";

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
