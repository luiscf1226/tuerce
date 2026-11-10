// Las formas de las imágenes de referencia, listas para poner en cualquier nivel: pinos con ramas que cuelgan,
// abetos lejanos, el tronco caído, piedras y matas del primer plano. Todo sale de una semilla (siempre igual).
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLORES } from "../escenas/colores";
import { materialCorteza, materialRecorte, materialTela } from "./materiales";
import { crearAzar } from "./ruido";

/** Junta varias geometrías en una sola (una sola llamada de dibujo). */
export function juntar(geometrias: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const sueltas = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const junta = mergeGeometries(sueltas);
  if (!junta) throw new Error("no se pudieron juntar las geometrías");
  return junta;
}

/** Deforma una geometría hacia afuera con ondas suaves al azar, para que nada parezca de computadora. */
function abollar(geometria: THREE.BufferGeometry, fuerza: number, semilla: number, frecuencia = 2) {
  const azar = crearAzar(semilla);
  const ondas = Array.from({ length: 5 }, () => ({
    dir: new THREE.Vector3(azar() - 0.5, azar() - 0.5, azar() - 0.5).normalize(),
    fase: azar() * Math.PI * 2,
    frec: frecuencia * (0.6 + azar()),
  }));
  const pos = geometria.getAttribute("position");
  const normal = geometria.getAttribute("normal");
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    n.fromBufferAttribute(normal, i);
    let d = 0;
    for (const o of ondas) d += Math.sin(p.dot(o.dir) * o.frec + o.fase);
    p.addScaledVector(n, (d / ondas.length) * fuerza);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometria.computeVertexNormals();
}

export interface OpcionesPino {
  alto: number;
  radio: number;
  semilla: number;
  /** Desde qué altura (0 a 1 del tronco) salen las ramas; 1 es sin ramas. */
  ramasDesde?: number;
  /** Largo de las ramas de abajo (metros). */
  largoRama?: number;
  color?: THREE.ColorRepresentation;
  /** Solo ramas hacia un lado (en radianes, hacia donde apuntan), para el árbol que enmarca la escena. */
  haciaDonde?: number;
  /** Cuánto cuelgan las ramas (radianes hacia abajo, en promedio). */
  caida?: number;
}

/** Pino alto: tronco con corteza y pisos de ramas que cuelgan, como los del frente de 11-pinar. */
export function crearPino(o: OpcionesPino): THREE.Group {
  const azar = crearAzar(o.semilla);
  const color = o.color ?? COLORES.silueta;
  const grupo = new THREE.Group();
  grupo.name = "pino";

  const tronco = new THREE.CylinderGeometry(o.radio * 0.45, o.radio, o.alto, 14, Math.ceil(o.alto), true);
  tronco.translate(0, o.alto / 2, 0);
  abollar(tronco, o.radio * 0.08, o.semilla, 3);
  const vueltas = Math.max(1, Math.round(o.radio * 8));
  grupo.add(new THREE.Mesh(tronco, materialCorteza(color, { repetir: [vueltas, Math.round(o.alto / 2)] })));

  const desde = o.ramasDesde ?? 0.45;
  if (desde >= 1) return grupo;
  const largoMax = o.largoRama ?? o.alto * 0.22;
  const ramas: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const euler = new THREE.Euler();
  for (let y = o.alto * desde; y < o.alto * 0.98; y += o.alto * (0.035 + 0.025 * azar())) {
    const t = (y / o.alto - desde) / (1 - desde);
    const cuantas = 3 + Math.floor(azar() * 3);
    for (let k = 0; k < cuantas; k++) {
      const largo = largoMax * (1 - 0.8 * t) * (0.7 + 0.5 * azar());
      const angulo =
        o.haciaDonde === undefined ? ((k + azar() * 0.6) / cuantas) * Math.PI * 2 : o.haciaDonde + (azar() - 0.5) * 1.6;
      const caida = -(o.caida ?? 0.4) * (0.5 + 0.7 * azar()) - 0.15 * (1 - t);
      // la textura de rama nace en u = 0 y su eje está a v ≈ 0.72: ese punto va pegado al tronco
      for (const vuelta of [0, 1.2]) {
        const plano = new THREE.PlaneGeometry(largo, largo * 0.5);
        plano.translate(largo / 2, -largo * 0.11, 0);
        plano.rotateX(vuelta);
        euler.set(0, angulo, caida, "YZX");
        giro.setFromEuler(euler);
        m.compose(new THREE.Vector3(0, y, 0), giro, new THREE.Vector3(1, 1, 1));
        plano.applyMatrix4(m);
        ramas.push(plano);
      }
    }
  }
  const malla = new THREE.Mesh(juntar(ramas), materialRecorte("rama", color));
  malla.name = "ramas";
  grupo.add(malla);
  return grupo;
}

/** Abeto entero de lejos: dos planos cruzados con su silueta. Barato; para las filas del fondo. */
export function crearAbeto(alto: number, ancho: number, color: THREE.ColorRepresentation = COLORES.silueta) {
  const a = new THREE.PlaneGeometry(ancho, alto);
  a.translate(0, alto / 2, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const malla = new THREE.Mesh(juntar([a, b]), materialRecorte("abeto", color));
  malla.name = "abeto";
  return malla;
}

export interface OpcionesTronco {
  largo: number;
  radio: number;
  semilla: number;
  color?: THREE.ColorRepresentation;
  /** Cuántas hebras de musgo cuelgan por debajo. */
  musgo?: number;
  /** Largo de las hebras más largas de musgo (metros). */
  largoMusgo?: number;
}

/** Tronco caído a lo largo del eje x, con muñones de ramas encima y musgo que cuelga. Arriba queda en y = radio. */
export function crearTroncoCaido(o: OpcionesTronco): THREE.Group {
  const azar = crearAzar(o.semilla);
  const color = o.color ?? COLORES.silueta;
  const grupo = new THREE.Group();
  grupo.name = "tronco-caido";

  const cuerpo = new THREE.CylinderGeometry(o.radio, o.radio * 1.08, o.largo, 18, Math.ceil(o.largo * 3), false);
  abollar(cuerpo, o.radio * 0.07, o.semilla, 2.5);
  cuerpo.rotateZ(Math.PI / 2);
  const vueltas = Math.max(2, Math.round(o.radio * 6));
  grupo.add(new THREE.Mesh(cuerpo, materialCorteza(color, { repetir: [vueltas, Math.round(o.largo / 1.5)] })));

  const munones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < Math.round(o.largo / 2.5); i++) {
    const largo = o.radio * (1 + 2.5 * azar());
    const rama = new THREE.ConeGeometry(o.radio * 0.15, largo, 5);
    rama.translate(0, largo / 2, 0);
    rama.rotateZ((azar() - 0.5) * 2.2);
    rama.rotateX((azar() - 0.5) * 0.8);
    rama.translate((azar() - 0.5) * o.largo * 0.9, o.radio * 0.8, (azar() - 0.5) * o.radio);
    munones.push(rama);
  }
  for (let i = 0; i < (o.musgo ?? Math.round(o.largo * 3)); i++) {
    const largo = (o.largoMusgo ?? o.radio * 2) * (0.2 + 0.8 * azar() ** 2);
    const hebra = new THREE.ConeGeometry(0.008 + o.radio * 0.06 * azar(), largo, 4);
    hebra.rotateX(Math.PI);
    hebra.translate((azar() - 0.5) * o.largo * 0.85, -o.radio * 0.85 - largo / 2, (azar() - 0.5) * o.radio * 0.8);
    munones.push(hebra);
  }
  grupo.add(new THREE.Mesh(juntar(munones), materialTela(color, { repetir: 1 })));
  return grupo;
}

/** Piedra redondeada y aplastada, apoyada en y = 0. */
export function crearRoca(radio: number, semilla: number, color: THREE.ColorRepresentation = COLORES.roca) {
  const azar = crearAzar(semilla);
  let geometria: THREE.BufferGeometry = new THREE.IcosahedronGeometry(radio, 3);
  geometria.deleteAttribute("uv");
  geometria = mergeVertices(geometria);
  geometria.computeVertexNormals();
  abollar(geometria, radio * 0.28, semilla, 2.2 / radio);
  geometria.scale(1 + 0.4 * azar(), 0.7 + 0.25 * azar(), 1 + 0.3 * azar());
  geometria.computeBoundingBox();
  geometria.translate(0, -(geometria.boundingBox?.min.y ?? 0) - radio * 0.15, 0);
  geometria.computeVertexNormals();
  const malla = new THREE.Mesh(geometria, materialTela(color, { repetir: 1, relieve: 2, pelusa: false }));
  malla.name = "roca";
  return malla;
}

/** Mata de hojas (varios planos cruzados con la silueta de ramitas), apoyada en y = 0. */
export function crearMata(alto: number, semilla: number, color: THREE.ColorRepresentation = COLORES.siluetaHonda) {
  const azar = crearAzar(semilla);
  const planos: THREE.BufferGeometry[] = [];
  const cuantos = 3 + Math.floor(azar() * 2);
  for (let i = 0; i < cuantos; i++) {
    const tam = alto * (0.7 + 0.45 * azar());
    const plano = new THREE.PlaneGeometry(tam, tam);
    plano.translate(0, tam / 2, 0);
    if (azar() < 0.5) plano.scale(-1, 1, 1);
    plano.rotateZ((azar() - 0.5) * 0.5);
    plano.rotateY((i / cuantos) * Math.PI + azar() * 0.4);
    plano.translate((azar() - 0.5) * alto * 0.4, 0, (azar() - 0.5) * alto * 0.3);
    planos.push(plano);
  }
  const malla = new THREE.Mesh(juntar(planos), materialRecorte("hojas", color));
  malla.name = "mata";
  return malla;
}
