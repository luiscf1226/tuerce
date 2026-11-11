import type * as THREE from "three";
import type { Vestuario } from "../../../../convex/premios";

/** El avance de un nivel: qué punto de control alcanzó la pareja. Lo guarda la red en Convex (TU-22). */
export interface AvanceDeNivel {
  /** Número del nivel (0 = El patio, 1 = El pinar…; el de prueba usa 99). */
  readonly nivel: number;
  /** El último punto de control alcanzado por la pareja (0 = la salida). */
  puntoDeControl(): number;
  /** Avisa cada vez que la pareja alcanza un punto de control nuevo. Devuelve cómo dejar de avisar. */
  alCambiar(aviso: (puntoDeControl: number) => void): () => void;
  /** Pone a los dos muñecos en ese punto de control (al retomar un avance guardado). */
  irA(puntoDeControl: number): void;
  /**
   * Fija el punto de control sin mover a los muñecos, si es más adelante que el actual: el anfitrión, al retomar el
   * mundo que le devolvió el invitado; el invitado, con el punto que viene en las fotos. Avisa como un punto nuevo.
   */
  retomar(puntoDeControl: number): void;
}

/** Le cambia la ropa a un muñeco de la escena (0 el rojo, 1 el turquesa): en línea, lo que cada uno eligió (TU-29). */
export type Vestir = (jugador: 0 | 1, vestuario: Vestuario) => void;

/** Lo que se gana en un nivel (TU-29): el secreto y el logro. Qué da cada uno está en convex/premios.ts. */
export type Premio = "secreto" | "logro";

export interface PremiosDeNivel {
  /** Número del nivel. */
  readonly nivel: number;
  /** Si la pareja ya lo ganó. */
  tiene(premio: Premio): boolean;
  /** Lo gana (si es nuevo, avisa). Lo llaman el nivel (la zona del secreto, el guion) y, en línea, Convex. */
  ganar(premio: Premio): void;
  /** Lo marca como ganado sin avisar: ya estaba guardado de antes. */
  marcar(premio: Premio): void;
  /** Avisa cada vez que la pareja gana algo nuevo. Devuelve cómo dejar de avisar. */
  alGanar(aviso: (premio: Premio) => void): () => void;
}

export interface Escena {
  readonly nombre: string;
  readonly escena: THREE.Scene;
  readonly camara: THREE.PerspectiveCamera;
  /** Un paso de físicas de 1/60 s. */
  pasar(): void;
  /** Dibuja interpolando entre el paso anterior y el actual (`alfa` de 0 a 1). */
  dibujar(alfa: number): void;
  /** El avance del nivel, en las escenas que son un nivel (TU-11). En línea se guarda en Convex y se retoma (TU-22). */
  readonly avance?: AvanceDeNivel;
  /** El secreto y el logro, en las escenas que son un nivel (TU-29). En línea se guardan en Convex. */
  readonly premios?: PremiosDeNivel;
}
