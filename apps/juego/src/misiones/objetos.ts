// Los objetos de misión: lo que le da a la pareja algo que hacer además de llegar. Tres clases, que puede usar
// cualquier escena (el tutorial las estrena):
//
//   semilla   Un coleccionable: una mazorca de cacao que flota y gira sobre un aro en el suelo. Se junta con solo tocarla
//             (cualquiera de los dos, con el cuerpo o las manos). No tiene físicas: se mide la distancia.
//   encargo   Algo que hay que llevar a algún lado: un cántaro o un costal. Es un cuerpo suelto de Rapier que se
//             empuja, se agarra y se carga como un huacal; pesado, se lleva mejor entre dos.
//   entrega   Adónde va el encargo: un círculo de piedritas en el suelo. Se llena (el aro se marca) cuando el
//             encargo queda adentro, apoyado.
//
// La imagen sigue las reglas de siempre: siluetas oscuras sobre niebla clara. Lo que es de misión se distingue por
// una banda clara (el blanco de los ojos) y un aro oscuro en el suelo, no por un color nuevo. Las físicas son deterministas: las prueba
// objetos.test.ts con Rapier en Node.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearRoca } from "../imagen";
import type { Rapier } from "../motor/fisica";
import type { Muneco, NombreBrazo, NombreParte } from "../muneco";

type Punto = { readonly x: number; readonly y: number; readonly z: number };

/** Las partes del muñeco que juntan una semilla al tocarla. */
const PARTES_QUE_TOCAN: readonly NombreParte[] = ["pelvis", "torso", "cabeza", "brazoIzquierdo", "brazoDerecho"];
const BRAZOS: readonly NombreBrazo[] = ["brazoIzquierdo", "brazoDerecho"];

/** El aro en el suelo de lo que es de misión: plano y oscuro, que sobre la niebla clara se lee de lejos. */
function aro(radio: number, grosor: number, opacidad: number): THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> {
  const malla = new THREE.Mesh(
    new THREE.RingGeometry(radio - grosor, radio, 40),
    new THREE.MeshBasicMaterial({ color: COLORES.silueta, transparent: true, opacity: opacidad, depthWrite: false }),
  );
  malla.rotation.x = -Math.PI / 2;
  malla.name = "aro de misión";
  return malla;
}

/** La banda clara (el blanco de los ojos) que llevan los objetos de misión: de lejos dice «esto es de la misión». */
function banda(radio: number, grosor: number): THREE.Mesh {
  const malla = new THREE.Mesh(
    new THREE.TorusGeometry(radio, grosor, 6, 30),
    new THREE.MeshBasicMaterial({ color: COLORES.ojo }),
  );
  malla.rotation.x = Math.PI / 2;
  malla.name = "banda de misión";
  return malla;
}

/** Material oscuro de los objetos (la silueta de siempre). */
function materialObjeto(color: number = COLORES.silueta): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
}

// ── Semillas ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface Semillas {
  readonly total: number;
  /** Cuántas juntaron. */
  readonly juntadas: number;
  /** Cuáles quedan, por índice (para las pruebas y las capturas). */
  quedan(): readonly number[];
  /** Mira si algún muñeco toca alguna. Va después de `mundo.step()`. Devuelve cuántas juntaron en este paso. */
  pasar(munecos: readonly Muneco[]): number;
  /** Flotan, giran y las juntadas se achican hasta desaparecer. */
  dibujar(segundos: number): void;
  /** La pone en un lugar (para el guion o las pruebas). */
  readonly grupo: THREE.Group;
}

/** Cerca de cuánto (m) del centro de la semilla tiene que pasar una parte del muñeco para juntarla. */
export const ALCANCE_SEMILLA = 0.5;
/** A qué altura flotan sobre el lugar que se les da (m): a la altura de la cadera. */
const FLOTAN = 0.55;

/** Una mazorca de cacao: alargada, con costillas, en punta de los dos lados. */
function mazorca(): THREE.BufferGeometry {
  const perfil: THREE.Vector2[] = [];
  const largo = 0.3;
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    perfil.push(new THREE.Vector2(0.085 * Math.sin(Math.PI * t) ** 0.8 + 0.004, (t - 0.5) * largo));
  }
  const g = new THREE.LatheGeometry(perfil, 20);
  // Costillas: diez surcos a lo largo
  const p = g.attributes.position;
  if (p) {
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const angulo = Math.atan2(z, x);
      const f = 1 + 0.12 * Math.cos(angulo * 10);
      p.setX(i, x * f);
      p.setZ(i, z * f);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function crearSemillas(escena: THREE.Scene, lugares: readonly Punto[]): Semillas {
  const grupo = new THREE.Group();
  grupo.name = "semillas";
  escena.add(grupo);
  const forma = mazorca();
  const material = materialObjeto(COLORES.siluetaHonda);
  const lista = lugares.map((lugar, i) => {
    const raiz = new THREE.Group();
    raiz.position.set(lugar.x, lugar.y, lugar.z);
    const fruta = new THREE.Group();
    fruta.add(new THREE.Mesh(forma, material), banda(0.093, 0.012));
    fruta.rotation.z = 0.5;
    fruta.position.y = FLOTAN;
    const suelo = aro(0.24, 0.04, 0.55);
    suelo.position.y = 0.01;
    raiz.add(fruta, suelo);
    grupo.add(raiz);
    return {
      raiz,
      fruta,
      suelo,
      juntadaEn: -1,
      fase: i * 1.7,
      centro: { x: lugar.x, y: lugar.y + FLOTAN, z: lugar.z },
    };
  });
  let juntadas = 0;
  let segundosAhora = 0;
  return {
    total: lista.length,
    get juntadas() {
      return juntadas;
    },
    quedan: () => lista.flatMap((s, i) => (s.juntadaEn < 0 ? [i] : [])),
    pasar(munecos) {
      let ahora = 0;
      for (const s of lista) {
        if (s.juntadaEn >= 0) continue;
        const tocada = munecos.some((m) =>
          PARTES_QUE_TOCAN.some((nombre) => {
            const p = m.partes[nombre].translation();
            return Math.hypot(p.x - s.centro.x, p.y - s.centro.y, p.z - s.centro.z) < ALCANCE_SEMILLA;
          }),
        );
        if (tocada) {
          s.juntadaEn = segundosAhora;
          juntadas++;
          ahora++;
        }
      }
      return ahora;
    },
    dibujar(segundos) {
      segundosAhora = segundos;
      for (const s of lista) {
        if (s.juntadaEn >= 0) {
          // Sube y se achica en medio segundo
          const t = Math.min(1, Math.max(0, (segundos - s.juntadaEn) / 0.5));
          s.raiz.visible = t < 1;
          s.fruta.scale.setScalar(1 - t);
          s.fruta.position.y = FLOTAN + t * 0.6;
          s.suelo.material.opacity = 0.55 * (1 - t);
          continue;
        }
        s.fruta.position.y = FLOTAN + 0.05 * Math.sin(segundos * 2 + s.fase);
        s.fruta.rotation.y = segundos * 1.2 + s.fase;
        s.suelo.scale.setScalar(1 + 0.08 * Math.sin(segundos * 3 + s.fase));
      }
    },
    grupo,
  };
}

// ── Encargos ─────────────────────────────────────────────────────────────────────────────────────────────────

export type FormaEncargo = "cantaro" | "costal";

export interface OpcionesEncargo {
  readonly forma: FormaEncargo;
  /** Dónde queda la base del encargo. */
  readonly posicion: Punto;
  /** Kilos (cántaro 6, costal 9: un muñeco solo levanta unos 5). */
  readonly masa?: number;
}

export interface Encargo {
  readonly forma: FormaEncargo;
  readonly cuerpo: RAPIER.RigidBody;
  readonly malla: THREE.Object3D;
  /** Cuántas manos (de los dos muñecos) lo agarran ahora. */
  manos(munecos: readonly Muneco[]): number;
  /** Cuántos muñecos lo agarran con al menos una mano. */
  cargadores(munecos: readonly Muneco[]): number;
  /** Lo vuelve a donde empezó, quieto. */
  volver(): void;
  /** Anota dónde estaba. Va antes de `mundo.step()`. */
  guardar(): void;
  dibujar(alfa: number): void;
}

/** Medidas de cada forma: el cilindro (o la caja) que choca y la masa por omisión. */
const FORMAS: Record<FormaEncargo, { alto: number; radio: number; masa: number }> = {
  cantaro: { alto: 0.56, radio: 0.28, masa: 6 },
  costal: { alto: 0.55, radio: 0.24, masa: 9 },
};

/** Un cántaro de barro: base angosta, panza ancha, cuello y boca. */
function cantaro(alto: number, radio: number): THREE.BufferGeometry {
  const perfil = [
    [0, 0],
    [0.62, 0],
    [0.78, 0.12],
    [1, 0.42],
    [0.92, 0.62],
    [0.5, 0.82],
    [0.4, 0.9],
    [0.5, 1],
    [0.42, 1],
  ].map(([r = 0, y = 0]) => new THREE.Vector2(r * radio, y * alto - alto / 2));
  return new THREE.LatheGeometry(perfil, 22);
}

/** Un costal amarrado arriba: una caja panzona con la boca atada. */
function costal(alto: number, radio: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(radio * 2, alto, radio * 1.6, 6, 6, 6);
  const p = g.attributes.position;
  if (p) {
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / alto + 0.5; // 0 abajo, 1 arriba
      // Panza abajo, se cierra arriba en el amarre
      const f = y > 0.8 ? 0.35 + (1 - y) * 2.5 : 1 - 0.08 * Math.cos(y * Math.PI);
      p.setX(i, p.getX(i) * f);
      p.setZ(i, p.getZ(i) * f);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function crearEncargo(
  rapier: Rapier,
  mundo: RAPIER.World,
  escena: THREE.Scene,
  opciones: OpcionesEncargo,
): Encargo {
  const medidas = FORMAS[opciones.forma];
  const { x, y, z } = opciones.posicion;
  const centro = new THREE.Vector3(x, y + medidas.alto / 2, z);
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.dynamic().setTranslation(centro.x, centro.y, centro.z).setAngularDamping(0.6),
  );
  const forma =
    opciones.forma === "cantaro"
      ? rapier.ColliderDesc.cylinder(medidas.alto / 2, medidas.radio)
      : rapier.ColliderDesc.cuboid(medidas.radio, medidas.alto / 2, medidas.radio * 0.8);
  const colisionador = mundo.createCollider(forma.setMass(opciones.masa ?? medidas.masa).setFriction(0.8), cuerpo);
  const geometria =
    opciones.forma === "cantaro" ? cantaro(medidas.alto, medidas.radio) : costal(medidas.alto, medidas.radio);
  const malla = new THREE.Group();
  malla.name = opciones.forma;
  malla.add(new THREE.Mesh(geometria, materialObjeto()));
  // La banda clara, ceñida a la panza
  const cinta = banda(medidas.radio * 1.02, 0.018);
  cinta.position.y = opciones.forma === "cantaro" ? medidas.alto * -0.08 : medidas.alto * 0.05;
  malla.add(cinta);
  malla.position.copy(centro);
  escena.add(malla);

  const antes = { p: centro.clone(), q: new THREE.Quaternion() };
  const ahora = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
  const manosDe = (m: Muneco) =>
    BRAZOS.filter(
      (b) => m.agarrado(b)?.handle === colisionador.handle || m.agarrado(b)?.parent()?.handle === cuerpo.handle,
    ).length;

  return {
    forma: opciones.forma,
    cuerpo,
    malla,
    manos: (munecos) => munecos.reduce((suma, m) => suma + manosDe(m), 0),
    cargadores: (munecos) => munecos.filter((m) => manosDe(m) > 0).length,
    volver() {
      cuerpo.setTranslation(centro, true);
      cuerpo.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
      cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
    },
    guardar() {
      antes.p.copy(cuerpo.translation());
      antes.q.copy(cuerpo.rotation());
    },
    dibujar(alfa) {
      malla.position.lerpVectors(antes.p, ahora.p.copy(cuerpo.translation()), alfa);
      malla.quaternion.slerpQuaternions(antes.q, ahora.q.copy(cuerpo.rotation()), alfa);
    },
  };
}

// ── Entregas ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Hasta qué altura sobre el círculo (m) cuenta como adentro: alcanza con llegar cargándolo entre los dos. */
export const ALTO_ENTREGA = 1.6;

export interface Entrega {
  readonly centro: Punto;
  readonly radio: number;
  /** Si ese cuerpo está adentro: su centro cae dentro del círculo y a menos de `ALTO_ENTREGA` del suelo (vale llegar cargándolo). */
  contiene(cuerpo: RAPIER.RigidBody): boolean;
  /** Marca el círculo como lleno (el aro se marca y el piso se oscurece). */
  llenar(lleno: boolean): void;
  readonly lleno: boolean;
  dibujar(segundos: number): void;
}

export function crearEntrega(escena: THREE.Scene, centro: Punto, radio = 0.8): Entrega {
  const grupo = new THREE.Group();
  grupo.name = "entrega";
  grupo.position.set(centro.x, centro.y, centro.z);
  const piedras = 11;
  for (let i = 0; i < piedras; i++) {
    const angulo = (i / piedras) * Math.PI * 2;
    const roca = crearRoca(0.09 + (i % 3) * 0.02, 300 + i);
    roca.position.set(Math.cos(angulo) * radio, 0, Math.sin(angulo) * radio);
    grupo.add(roca);
  }
  const borde = aro(radio - 0.12, 0.05, 0.35);
  borde.position.y = 0.012;
  const relleno = new THREE.Mesh(
    new THREE.CircleGeometry(radio - 0.18, 40),
    new THREE.MeshBasicMaterial({ color: COLORES.silueta, transparent: true, opacity: 0, depthWrite: false }),
  );
  relleno.rotation.x = -Math.PI / 2;
  relleno.position.y = 0.01;
  grupo.add(borde, relleno);
  escena.add(grupo);
  let lleno = false;
  return {
    centro,
    radio,
    contiene(cuerpo) {
      const p = cuerpo.translation();
      return Math.hypot(p.x - centro.x, p.z - centro.z) < radio && p.y - centro.y < ALTO_ENTREGA;
    },
    llenar(si) {
      lleno = si;
    },
    get lleno() {
      return lleno;
    },
    dibujar(segundos) {
      relleno.material.opacity = lleno ? 0.22 : 0;
      borde.material.opacity = lleno ? 0.8 : 0.3 + 0.15 * Math.sin(segundos * 2.5);
    },
  };
}
