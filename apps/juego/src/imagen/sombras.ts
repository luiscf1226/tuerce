// La sombra de contacto (TU-61): una mancha oscura y suave en el suelo debajo de cada muñeco y de las piezas sueltas
// grandes, que deja ver dónde van a caer. Es barata: un rayo hacia abajo por cosa y un plano con un degradé redondo
// (sin mapas de sombras). Con la altura se achica y se aclara, y lejos del suelo desaparece.
//
// El rayo lo pone quien la usa (los niveles lo tiran en el mundo de Rapier), así esto no sabe de físicas.
import * as THREE from "three";
import { aTextura } from "./materiales";
import { nuevaLamina } from "./texturas";

/** Hasta qué altura sobre el suelo se ve la sombra (m). */
export const ALCANCE_SOMBRA = 3;

/** Cómo es la sombra de algo que está a `altura` metros del suelo: de 1 a 0.45 de su tamaño y de 1 a 0 de oscura. */
export function sombraSegunAltura(altura: number, alcance = ALCANCE_SOMBRA): { escala: number; opacidad: number } {
  const t = Math.min(Math.max(altura / alcance, 0), 1);
  return { escala: 1 - 0.55 * t, opacidad: (1 - t) ** 1.6 };
}

/** Lo que encontró el rayo: a cuánto del origen y la normal de la superficie. */
export interface GolpeDeRayo {
  readonly distancia: number;
  readonly normal: THREE.Vector3Like;
}

/** Algo que proyecta sombra. */
export interface FuenteDeSombra {
  /** Desde dónde sale el rayo (y hacia dónde va la sombra) en este cuadro, o `null` si hoy no proyecta. */
  origen(salida: THREE.Vector3): THREE.Vector3 | null;
  /** Cuánto hay del origen al pie de la cosa (m): esa parte del rayo no cuenta como altura. */
  readonly pie: number | (() => number);
  /** Medio ancho de la sombra en x y en z (m), apoyada en el suelo. */
  readonly radio: readonly [number, number] | (() => readonly [number, number]);
  /** Qué tan oscura en el suelo, de 0 a 1. */
  readonly oscuridad: number;
  /** El rayo de esta fuente (para que no se encuentre a sí misma). */
  rayo(origen: THREE.Vector3, largo: number): GolpeDeRayo | null;
}

export interface Sombras {
  readonly grupo: THREE.Group;
  agregar(fuente: FuenteDeSombra): void;
  /** Tira los rayos y acomoda las manchas. Va en el dibujo, después de mover las mallas. */
  actualizar(): void;
}

let mancha: THREE.Texture | undefined;
/** El degradé redondo de la sombra: blanco con transparencia, más densa en el centro y sin borde. */
export function degradeDeSombra(tamano = 64): ReturnType<typeof nuevaLamina> {
  const l = nuevaLamina(tamano, tamano);
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const r = Math.hypot((x + 0.5) / tamano - 0.5, (y + 0.5) / tamano - 0.5) * 2;
      // casi pareja hasta la mitad y después se apaga suave hasta el borde
      const t = Math.min(Math.max((r - 0.3) / 0.7, 0), 1);
      const a = (1 - t * t * (3 - 2 * t)) ** 1.3;
      l.datos.set([255, 255, 255, Math.round(a * 255)], (y * tamano + x) * 4);
    }
  }
  return l;
}

const ARRIBA = new THREE.Vector3(0, 1, 0);

export function crearSombras(color: THREE.ColorRepresentation = 0x000000): Sombras {
  mancha ??= aTextura(degradeDeSombra(), { srgb: false, repetir: false });
  const grupo = new THREE.Group();
  grupo.name = "sombras";
  const plano = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const fuentes: { fuente: FuenteDeSombra; malla: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> }[] = [];
  const origen = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  return {
    grupo,
    agregar(fuente) {
      const material = new THREE.MeshBasicMaterial({
        name: "sombra",
        color,
        map: mancha,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      const malla = new THREE.Mesh(plano, material);
      malla.renderOrder = 1;
      malla.visible = false;
      grupo.add(malla);
      fuentes.push({ fuente, malla });
    },
    actualizar() {
      for (const { fuente, malla } of fuentes) {
        malla.visible = false;
        const desde = fuente.origen(origen);
        if (!desde) continue;
        const pie = typeof fuente.pie === "number" ? fuente.pie : fuente.pie();
        const golpe = fuente.rayo(desde, pie + ALCANCE_SOMBRA);
        if (!golpe) continue;
        const { escala, opacidad } = sombraSegunAltura(golpe.distancia - pie);
        if (opacidad <= 0.01) continue;
        const [rx, rz] = typeof fuente.radio === "function" ? fuente.radio() : fuente.radio;
        normal.copy(golpe.normal);
        if (normal.y < 0.2) continue; // contra una pared no hay sombra de contacto
        malla.position.set(desde.x, desde.y - golpe.distancia, desde.z).addScaledVector(normal, 0.01);
        malla.quaternion.copy(giro.setFromUnitVectors(ARRIBA, normal.normalize()));
        malla.scale.set(rx * escala, 1, rz * escala);
        malla.material.opacity = fuente.oscuridad * opacidad;
        malla.visible = true;
      }
    },
  };
}
