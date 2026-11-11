// Armar un nivel a partir de su plano (formato.ts): los cuerpos de Rapier de cada sólido y la imagen de la escena,
// con los materiales del juego (siluetas oscuras sobre niebla clara) en lugar de los de Blender.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import {
  crearAbeto,
  crearCapasDeNiebla,
  crearMata,
  crearPino,
  crearRoca,
  crearTroncoCaido,
  materialCorteza,
  materialTela,
  type Niebla,
  vestirDeDia,
} from "../imagen";
import type { Rapier } from "../motor/fisica";
import { type Adorno, cajaLocal, type Material, type PlanoDeNivel, rumboDe, type Solido } from "./formato";

/** Un sólido del nivel ya armado: su nodo y su colisionador (y su cuerpo, si se mueve). */
export interface Pieza {
  readonly nombre: string;
  readonly objeto: THREE.Object3D;
  /** El cuerpo de Rapier de los cinemáticos y dinámicos; los fijos van sin cuerpo. */
  readonly cuerpo: RAPIER.RigidBody | null;
  readonly colisionador: RAPIER.Collider;
}

export interface NivelArmado {
  readonly escena: THREE.Scene;
  readonly piezas: readonly Pieza[];
  readonly niebla: Niebla;
  /** La pieza con ese nombre (el del nodo en Blender), o `undefined`. */
  pieza(nombre: string): Pieza | undefined;
  /** Anota dónde quedó cada pieza que se mueve. Va después de cada `mundo.step()`. */
  guardar(): void;
  /** Mueve las piezas entre el paso anterior y el actual (`alfa` de 0 a 1) y corre la niebla. */
  dibujar(alfa: number, segundos: number): void;
}

/** Un material por nombre, compartido por todas las piezas del nivel. */
function crearMateriales(): (cual: Material) => THREE.Material {
  const hechos = new Map<Material, THREE.Material>();
  const hacer = (cual: Material): THREE.Material => {
    switch (cual) {
      // El suelo casi del color de la niebla, como el claro de la escena `dos`: así las siluetas se leen encima
      case "suelo":
        return new THREE.MeshStandardMaterial({
          name: "suelo",
          color: new THREE.Color(COLORES.niebla).multiplyScalar(0.8),
          roughness: 1,
          metalness: 0,
        });
      case "tela":
        return materialTela(COLORES.silueta, { repetir: 2, pelusa: false });
      case "corteza":
        return materialCorteza(COLORES.silueta, { repetir: [1, 1] });
      case "honda":
        return materialTela(COLORES.siluetaHonda, { repetir: 2, pelusa: false });
      case "lejana":
        return new THREE.MeshStandardMaterial({ name: "lejana", color: COLORES.siluetaLejana, roughness: 1 });
    }
  };
  return (cual) => {
    let m = hechos.get(cual);
    if (!m) {
      m = hacer(cual);
      hechos.set(cual, m);
    }
    return m;
  };
}

/** Los vértices y triángulos de las mallas del nodo, llevados por `matriz` (del marco de cada malla al de destino). */
function triangulos(o: THREE.Object3D, destino: THREE.Matrix4): { vertices: Float32Array; indices: Uint32Array } {
  const vertices: number[] = [];
  const indices: number[] = [];
  const v = new THREE.Vector3();
  o.updateWorldMatrix(true, true);
  o.traverse((hijo) => {
    if (!(hijo instanceof THREE.Mesh)) return;
    const geometria = hijo.geometry as THREE.BufferGeometry;
    const posiciones = geometria.getAttribute("position");
    const base = vertices.length / 3;
    const matriz = destino.clone().multiply(hijo.matrixWorld);
    for (let i = 0; i < posiciones.count; i++) {
      v.fromBufferAttribute(posiciones, i).applyMatrix4(matriz);
      vertices.push(v.x, v.y, v.z);
    }
    const indice = geometria.getIndex();
    if (indice) for (let i = 0; i < indice.count; i++) indices.push(base + indice.getX(i));
    else for (let i = 0; i < posiciones.count; i++) indices.push(base + i);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}

/** La forma de Rapier del sólido, en el marco de su nodo (con la escala ya aplicada) o del mundo si es fijo. */
function formaDe(rapier: Rapier, s: Solido, enElMundo: boolean): RAPIER.ColliderDesc {
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  s.objeto.updateWorldMatrix(true, true);
  s.objeto.matrixWorld.decompose(posicion, giro, escala);

  if (s.forma === "malla") {
    // Fijo: los vértices en el mundo. Con cuerpo: en el marco del nodo, solo escalados.
    const destino = enElMundo
      ? new THREE.Matrix4()
      : new THREE.Matrix4().makeScale(escala.x, escala.y, escala.z).multiply(s.objeto.matrixWorld.clone().invert());
    const { vertices, indices } = triangulos(s.objeto, destino);
    if (s.cuerpo === "dinamico") {
      const casco = rapier.ColliderDesc.convexHull(vertices);
      if (!casco) throw new Error(`«${s.nombre}»: no se pudo armar su forma convexa`);
      return casco;
    }
    return rapier.ColliderDesc.trimesh(vertices, indices);
  }

  const caja = cajaLocal(s.objeto);
  const medio = caja.getSize(new THREE.Vector3()).multiply(escala).multiplyScalar(0.5);
  const centro = caja.getCenter(new THREE.Vector3()).multiply(escala);
  const desc =
    s.forma === "caja"
      ? rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      : rapier.ColliderDesc.cylinder(medio.y, Math.max(medio.x, medio.z));
  if (enElMundo) {
    desc.setTranslation(...centro.applyQuaternion(giro).add(posicion).toArray()).setRotation(giro);
  } else {
    desc.setTranslation(centro.x, centro.y, centro.z);
  }
  return desc;
}

function crearAdorno(a: Adorno): THREE.Object3D {
  switch (a.forma) {
    case "pino":
      return crearPino({ alto: a.alto, radio: a.radio, semilla: a.semilla, ramasDesde: 0.3, largoRama: 2.4 });
    case "abeto":
      return crearAbeto(a.alto, a.alto * 0.42);
    case "roca":
      return crearRoca(a.radio, a.semilla);
    case "mata":
      return crearMata(a.alto, a.semilla);
    case "tronco":
      // Acostado a lo largo de su +x, como el tronco caído de la escena `dos`; `alto` es su largo
      return crearTroncoCaido({ largo: a.alto, radio: a.radio, semilla: a.semilla, musgo: 30 });
  }
}

export function armarNivel(rapier: Rapier, mundo: RAPIER.World, plano: PlanoDeNivel): NivelArmado {
  const escena = new THREE.Scene();
  vestirDeDia(escena, plano.niebla);
  escena.add(plano.raiz);
  const material = crearMateriales();

  // Lo que no es imagen (zonas, salidas, marcas de niebla y de adornos) no se dibuja
  plano.raiz.traverse((o) => {
    const tipo = (o.userData as { tipo?: unknown }).tipo;
    if (tipo === "control" || tipo === "vacio" || tipo === "salida") o.visible = false;
    if ((tipo === "adorno" || tipo === "niebla") && o instanceof THREE.Mesh) o.visible = false;
  });

  const piezas: Pieza[] = [];
  const moviles: {
    pieza: Pieza;
    antes: THREE.Vector3;
    ahora: THREE.Vector3;
    antesQ: THREE.Quaternion;
    ahoraQ: THREE.Quaternion;
  }[] = [];
  for (const s of plano.solidos) {
    // La imagen: todas las mallas del sólido con el material del juego
    s.objeto.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = material(s.material);
    });
    if (s.invisible) s.objeto.visible = false;

    const forma = formaDe(rapier, s, s.cuerpo === "fijo").setFriction(s.rozamiento);
    if (s.cuerpo === "fijo") {
      piezas.push({ nombre: s.nombre, objeto: s.objeto, cuerpo: null, colisionador: mundo.createCollider(forma) });
      continue;
    }
    const posicion = s.objeto.getWorldPosition(new THREE.Vector3());
    const giro = s.objeto.getWorldQuaternion(new THREE.Quaternion());
    const desc =
      s.cuerpo === "dinamico" ? rapier.RigidBodyDesc.dynamic() : rapier.RigidBodyDesc.kinematicPositionBased();
    const cuerpo = mundo.createRigidBody(desc.setTranslation(posicion.x, posicion.y, posicion.z).setRotation(giro));
    if (s.cuerpo === "dinamico") forma.setMass(s.masa);
    const pieza = { nombre: s.nombre, objeto: s.objeto, cuerpo, colisionador: mundo.createCollider(forma, cuerpo) };
    piezas.push(pieza);
    // El nodo cuelga de la escena para seguir a su cuerpo con su posición en el mundo
    escena.attach(s.objeto);
    moviles.push({ pieza, antes: posicion.clone(), ahora: posicion, antesQ: giro.clone(), ahoraQ: giro });
  }

  for (const a of plano.adornos) {
    const adorno = crearAdorno(a);
    adorno.position.copy(a.objeto.getWorldPosition(new THREE.Vector3()));
    adorno.rotation.y = rumboDe(a.objeto);
    escena.add(adorno);
  }

  const niebla = crearCapasDeNiebla(
    plano.nieblas.map((n) => {
      const p = n.objeto.getWorldPosition(new THREE.Vector3());
      const escala = n.objeto.getWorldScale(new THREE.Vector3());
      return {
        x: p.x,
        y: p.y,
        z: p.z,
        ancho: escala.x * 2,
        alto: escala.y * 2,
        opacidad: n.opacidad,
        velocidad: n.velocidad,
      };
    }),
  );
  escena.add(niebla.grupo);

  return {
    escena,
    piezas,
    niebla,
    pieza: (nombre) => piezas.find((p) => p.nombre === nombre),
    guardar() {
      for (const q of moviles) {
        if (!q.pieza.cuerpo) continue;
        q.antes.copy(q.ahora);
        q.antesQ.copy(q.ahoraQ);
        q.ahora.copy(q.pieza.cuerpo.translation());
        q.ahoraQ.copy(q.pieza.cuerpo.rotation());
      }
    },
    dibujar(alfa, segundos) {
      for (const q of moviles) {
        q.pieza.objeto.position.lerpVectors(q.antes, q.ahora, alfa);
        q.pieza.objeto.quaternion.slerpQuaternions(q.antesQ, q.ahoraQ, alfa);
      }
      niebla.mover(segundos);
    },
  };
}
