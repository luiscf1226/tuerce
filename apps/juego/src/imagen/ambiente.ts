// Luz de día detrás de la niebla y niebla por capas: lo cercano es una silueta oscura y lo lejano se va
// aclarando hasta perderse en blanco, como en docs/arte/11-pinar.
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { texturaNiebla } from "./materiales";
import { crearAzar } from "./ruido";

export interface OpcionesDia {
  /**
   * Niebla de profundidad: hasta `cerca` metros de la cámara no hay niebla (las siluetas del frente quedan
   * oscuras) y a `lejos` metros ya todo es blanco.
   */
  cerca?: number;
  lejos?: number;
  /** De dónde viene el sol (queda escondido detrás de la niebla, arriba y un poco atrás). */
  sol?: THREE.Vector3Like;
}

/** Fondo y niebla blancos, cielo claro que baña todo y un sol suave que apenas marca los bordes. */
export function vestirDeDia(escena: THREE.Scene, opciones: OpcionesDia = {}) {
  escena.background = new THREE.Color(COLORES.niebla);
  escena.fog = new THREE.Fog(COLORES.niebla, opciones.cerca ?? 2.5, opciones.lejos ?? 16);

  // Cielo blanco arriba, suelo gris abajo: la luz difusa de un día nublado.
  const cielo = new THREE.HemisphereLight(0xf2f2ef, 0x6a6a64, 4.5);
  escena.add(cielo);
  const sol = new THREE.DirectionalLight(0xfffcf4, 2.5);
  const desde = opciones.sol ?? { x: 3, y: 9, z: -4 };
  sol.position.set(desde.x, desde.y, desde.z);
  escena.add(sol);
  // Un relleno flojo desde la cámara para que las siluetas no queden negras del todo.
  const relleno = new THREE.DirectionalLight(0xffffff, 0.6);
  relleno.position.set(-2, 3, 8);
  escena.add(relleno);
  return { cielo, sol, relleno };
}

export interface CapaDeNiebla {
  x?: number;
  y: number;
  z: number;
  ancho: number;
  alto: number;
  /** Qué tan espesa es la capa, de 0 a 1. */
  opacidad: number;
  /** Metros por segundo que se corre hacia el costado. */
  velocidad?: number;
  /** Cuántos jirones caben a lo ancho. */
  jirones?: number;
}

export interface Niebla {
  readonly grupo: THREE.Group;
  /** Corre los jirones según el tiempo de juego (en segundos); no crea nada nuevo. */
  mover(segundos: number): void;
}

/** Planos de niebla a distintas profundidades que se corren despacio: dan las capas entre siluetas. */
export function crearCapasDeNiebla(capas: readonly CapaDeNiebla[], semilla = 21): Niebla {
  const azar = crearAzar(semilla);
  const grupo = new THREE.Group();
  grupo.name = "niebla";
  const moviles: { textura: THREE.Texture; inicio: number; paso: number }[] = [];
  for (const capa of capas) {
    const textura = texturaNiebla();
    const jirones = capa.jirones ?? Math.max(1, Math.round(capa.ancho / 12));
    textura.repeat.set(jirones, 1);
    const inicio = azar();
    textura.offset.x = inicio;
    const material = new THREE.MeshBasicMaterial({
      name: "niebla",
      color: COLORES.niebla,
      map: textura,
      transparent: true,
      opacity: capa.opacidad,
      depthWrite: false,
    });
    const plano = new THREE.Mesh(new THREE.PlaneGeometry(capa.ancho, capa.alto), material);
    plano.position.set(capa.x ?? 0, capa.y, capa.z);
    grupo.add(plano);
    moviles.push({ textura, inicio, paso: ((capa.velocidad ?? 0.15) / capa.ancho) * jirones });
  }
  return {
    grupo,
    mover(segundos) {
      for (const m of moviles) m.textura.offset.x = (m.inicio + m.paso * segundos) % 1;
    },
  };
}

/**
 * Velo de luz: un plano de niebla transparente abajo y espeso arriba. Puesto detrás de las siluetas cercanas,
 * hace que los troncos se pierdan en blanco a medida que suben, como en las referencias.
 */
export function crearVelo(capa: Omit<CapaDeNiebla, "velocidad" | "jirones">): THREE.Mesh {
  const geometria = new THREE.PlaneGeometry(capa.ancho, capa.alto);
  const pos = geometria.getAttribute("position");
  const colores = new Float32Array(pos.count * 4);
  const color = new THREE.Color(COLORES.niebla);
  for (let i = 0; i < pos.count; i++) {
    colores.set([color.r, color.g, color.b, pos.getY(i) > 0 ? 1 : 0], i * 4);
  }
  geometria.setAttribute("color", new THREE.BufferAttribute(colores, 4));
  const material = new THREE.MeshBasicMaterial({
    name: "velo",
    vertexColors: true,
    transparent: true,
    opacity: capa.opacidad,
    depthWrite: false,
  });
  const velo = new THREE.Mesh(geometria, material);
  velo.name = "velo";
  velo.position.set(capa.x ?? 0, capa.y, capa.z);
  return velo;
}
