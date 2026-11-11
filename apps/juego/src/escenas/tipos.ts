import type * as THREE from "three";

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
}
