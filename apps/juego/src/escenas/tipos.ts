import type * as THREE from "three";

export interface Escena {
  readonly nombre: string;
  readonly escena: THREE.Scene;
  readonly camara: THREE.PerspectiveCamera;
  /** Un paso de físicas de 1/60 s. */
  pasar(): void;
  /** Dibuja interpolando entre el paso anterior y el actual (`alfa` de 0 a 1). */
  dibujar(alfa: number): void;
}
