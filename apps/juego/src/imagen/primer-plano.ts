// El primer plano (TU-61): plantas y ramas casi negras y desenfocadas en los bordes de la imagen, como las matas de
// abajo en docs/arte/11-pinar y las hojas de arriba en 13-carreta. Enmarcan sin tapar: altas en las orillas y apenas
// asomadas en el centro, donde andan los muñecos.
//
// No viven en el mundo sino delante de la cámara que esté dibujando (con la pantalla partida, cada cámara las ve en
// su lugar): justo antes de dibujarse se ponen frente a ella. Se corren con la x de la cámara más rápido que el
// nivel, que es lo que da el paralaje de lo cercano. Todo sale de semillas: dos dibujos iguales dan lo mismo.
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { aTextura } from "./materiales";
import { crearAzar } from "./ruido";
import { type Lamina, nuevaLamina, pintarHoja, pintarTrazo, ramaDePino } from "./texturas";

/** Lo que crece abajo, en el borde inferior de la imagen. */
export const PLANTAS_DE_ABAJO = ["hojas", "pasto", "piedras"] as const;
export type PlantaDeAbajo = (typeof PLANTAS_DE_ABAJO)[number];
/** Lo que cuelga arriba, en las esquinas de arriba. */
export const RAMAS_DE_ARRIBA = ["pino", "hojas"] as const;
export type RamaDeArriba = (typeof RAMAS_DE_ARRIBA)[number];

export interface OpcionesPrimerPlano {
  abajo: PlantaDeAbajo | null;
  arriba: RamaDeArriba | null;
  semilla?: number;
}

/** A qué distancia de la cámara se ponen (m): delante de todo lo del nivel. */
const DISTANCIA = 0.6;
/** Cuántos metros tiene que correrse la cámara para que el primer plano dé una vuelta entera (2 × `ANCHO_VUELTA`). */
export const METROS_POR_VUELTA = 6;
/** De qué x a qué x de pantalla (-1 izquierda, 1 derecha) dan la vuelta las plantas: un poco más que la pantalla. */
export const ANCHO_VUELTA = 1.4;

/** Dónde queda en la pantalla (x de -ANCHO_VUELTA a ANCHO_VUELTA) una planta de `fase` (0 a 1) con la cámara en `x`. */
export function lugarEnPantalla(fase: number, camaraX: number): number {
  const vuelta = fase - camaraX / METROS_POR_VUELTA;
  return (vuelta - Math.floor(vuelta)) * 2 * ANCHO_VUELTA - ANCHO_VUELTA;
}

/** Qué tan alta se ve una planta según dónde está en la pantalla: entera en las orillas, apenas asomada al medio. */
export function altoSegunLugar(x: number, minimo = 0.3): number {
  const t = Math.min(Math.max((Math.abs(x) - 0.3) / 0.5, 0), 1);
  return minimo + (1 - minimo) * t * t * (3 - 2 * t);
}

/** Desenfoca el alfa de una lámina (dos pasadas de caja de `radio` píxeles). Las orillas quedan suaves. */
export function desenfocar(l: Lamina, radio: number): Lamina {
  const salida = nuevaLamina(l.ancho, l.alto);
  salida.datos.set(l.datos);
  const alfa = new Float32Array(l.ancho * l.alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = l.datos[i * 4 + 3] ?? 0;
  const tmp = new Float32Array(alfa.length);
  const pasada = (de: Float32Array, a: Float32Array, horizontal: boolean) => {
    const largo = horizontal ? l.ancho : l.alto;
    const lineas = horizontal ? l.alto : l.ancho;
    for (let k = 0; k < lineas; k++) {
      for (let i = 0; i < largo; i++) {
        let suma = 0;
        let n = 0;
        for (let j = Math.max(0, i - radio); j <= Math.min(largo - 1, i + radio); j++) {
          suma += de[horizontal ? k * l.ancho + j : j * l.ancho + k] ?? 0;
          n++;
        }
        a[horizontal ? k * l.ancho + i : i * l.ancho + k] = suma / n;
      }
    }
  };
  for (let vez = 0; vez < 2; vez++) {
    pasada(alfa, tmp, true);
    pasada(tmp, alfa, false);
  }
  for (let i = 0; i < alfa.length; i++) salida.datos[i * 4 + 3] = Math.round(alfa[i] ?? 0);
  return salida;
}

/**
 * Apaga el alfa cerca de los bordes de la lámina (`margen`, en fracción), menos en el borde de donde nace la planta:
 * así lo que se sale de la textura no queda cortado en seco.
 */
export function apagarBordes(l: Lamina, margen: number, nace: "abajo" | "izquierda"): Lamina {
  const suave = (v: number) => {
    const t = Math.min(Math.max(v / margen, 0), 1);
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < l.alto; y++) {
    for (let x = 0; x < l.ancho; x++) {
      const u = x / Math.max(1, l.ancho - 1);
      const v = y / Math.max(1, l.alto - 1);
      const f = nace === "abajo" ? suave(u) * suave(1 - u) * suave(1 - v) : suave(v) * suave(1 - v) * suave(1 - u);
      const i = (y * l.ancho + x) * 4 + 3;
      l.datos[i] = Math.round((l.datos[i] ?? 0) * f);
    }
  }
  return l;
}

/** Una mata tupida: tallos que se abren desde abajo cargados de hojas anchas, con la base cerrada. */
export function follaje(tamano = 256, semilla = 61, tallos = 9): Lamina {
  const l = nuevaLamina(tamano, tamano);
  for (let i = 0; i < l.datos.length; i += 4) l.datos.set([255, 255, 255, 0], i);
  const azar = crearAzar(semilla);
  for (let k = 0; k < tallos; k++) {
    const abre = (k / (tallos - 1) - 0.5) * 1.8 + (azar() - 0.5) * 0.3;
    const largo = tamano * (0.55 + 0.4 * azar()) * (1 - 0.3 * Math.abs(abre));
    const curva = (azar() - 0.5) * 0.6 + abre * 0.25;
    const punto = (t: number) => {
      const a = Math.PI / 2 - abre * 0.55 - curva * t;
      return { x: tamano / 2 + Math.cos(a) * largo * t * 0.8, y: Math.sin(a) * largo * t * 0.9 };
    };
    for (let t = 0; t < 1; t += 0.02) {
      const p = punto(t);
      const q = punto(t + 0.02);
      pintarTrazo(l, p.x, p.y, q.x, q.y, 4 * (1 - t) + 1.5);
    }
    let lado = azar() < 0.5 ? 1 : -1;
    for (let t = 0.12; t < 1; t += 0.06 + 0.04 * azar()) {
      const p = punto(t);
      const q = punto(Math.min(t + 0.02, 1));
      const dir = Math.atan2(q.y - p.y, q.x - p.x);
      const hoja = tamano * (0.2 - 0.08 * t) * (0.75 + 0.5 * azar());
      pintarHoja(l, p.x, p.y, dir + lado * (0.5 + 0.5 * azar()), hoja, hoja * 0.5);
      lado = -lado;
    }
    const fin = punto(0.97);
    const tope = punto(1);
    pintarHoja(l, fin.x, fin.y, Math.atan2(tope.y - fin.y, tope.x - fin.x), tamano * 0.14, tamano * 0.06);
  }
  // la base: hojas grandes caídas que cierran el pie de la mata
  for (let k = 0; k < 14; k++) {
    const x = tamano * (0.15 + 0.7 * azar());
    const a = Math.PI / 2 + (azar() - 0.5) * 2.4;
    const hoja = tamano * (0.18 + 0.12 * azar());
    pintarHoja(l, x, 0, a, hoja, hoja * 0.5);
  }
  return l;
}

/** Una mata de pasto: briznas que se abren desde abajo, curvas y en punta. */
export function matojoDePasto(tamano = 256, semilla = 31): Lamina {
  const l = nuevaLamina(tamano, tamano);
  for (let i = 0; i < l.datos.length; i += 4) l.datos.set([255, 255, 255, 0], i);
  const azar = crearAzar(semilla);
  for (let k = 0; k < 40; k++) {
    const base = tamano * (0.3 + 0.4 * azar());
    const abre = (azar() - 0.5) * 1.6;
    const largo = tamano * (0.45 + 0.5 * azar()) * (1 - 0.3 * Math.abs(abre));
    const curva = (azar() - 0.5) * 1.2 + abre * 0.6;
    let x = base;
    let y = 0;
    const pasos = 24;
    for (let p = 0; p < pasos; p++) {
      const t = p / pasos;
      const a = Math.PI / 2 - abre * 0.6 - curva * t * t;
      const nx = x + (Math.cos(a) * largo) / pasos;
      const ny = y + (Math.sin(a) * largo) / pasos;
      pintarTrazo(l, x, y, nx, ny, 8 * (1 - t) + 1.2, 8 * (1 - t - 1 / pasos) + 1.2);
      x = nx;
      y = ny;
    }
  }
  return l;
}

/** Piedras redondeadas amontonadas abajo, para lo que no tiene plantas (la mina). */
export function montonDePiedras(tamano = 256, semilla = 41): Lamina {
  const l = nuevaLamina(tamano, tamano);
  for (let i = 0; i < l.datos.length; i += 4) l.datos.set([255, 255, 255, 0], i);
  const azar = crearAzar(semilla);
  for (let k = 0; k < 6; k++) {
    const cx = tamano * (0.15 + 0.7 * azar());
    const rx = tamano * (0.14 + 0.16 * azar());
    const ry = rx * (0.55 + 0.35 * azar());
    const cy = ry * (0.2 + 0.6 * azar());
    for (let y = 0; y < Math.min(tamano, cy + ry + 2); y++) {
      for (let x = Math.max(0, Math.floor(cx - rx - 2)); x < Math.min(tamano, cx + rx + 2); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const a = Math.min(Math.max((1 - d) * rx, 0), 1);
        const i = (y * tamano + x) * 4 + 3;
        l.datos[i] = Math.max(l.datos[i] ?? 0, Math.round(a * 255));
      }
    }
  }
  // unas briznas entre las piedras
  for (let k = 0; k < 5; k++) {
    const x = tamano * azar();
    const alto = tamano * (0.2 + 0.25 * azar());
    pintarHoja(l, x, 0, Math.PI / 2 + (azar() - 0.5) * 0.6, alto, 5);
  }
  return l;
}

const deAbajo = (l: Lamina) => apagarBordes(desenfocar(l, 2), 0.12, "abajo");
const TEXTURAS = {
  "abajo-hojas-1": () => deAbajo(follaje(256, 61, 9)),
  "abajo-hojas-2": () => deAbajo(follaje(256, 67, 7)),
  "abajo-pasto-1": () => deAbajo(matojoDePasto(256, 31)),
  "abajo-pasto-2": () => deAbajo(matojoDePasto(256, 37)),
  "abajo-piedras-1": () => deAbajo(montonDePiedras(256, 41)),
  "abajo-piedras-2": () => deAbajo(montonDePiedras(256, 43)),
  "arriba-pino-1": () => apagarBordes(desenfocar(ramaDePino(256, 128, 71), 2), 0.12, "izquierda"),
  "arriba-pino-2": () => apagarBordes(desenfocar(ramaDePino(256, 128, 73), 2), 0.12, "izquierda"),
  "arriba-hojas-1": () => deAbajo(follaje(256, 81, 6)),
  "arriba-hojas-2": () => deAbajo(follaje(256, 83, 5)),
} as const;
type CualTextura = keyof typeof TEXTURAS;
const hechas = new Map<CualTextura, THREE.Texture>();
const textura = (cual: CualTextura) => {
  let t = hechas.get(cual);
  if (!t) {
    t = aTextura(TEXTURAS[cual](), { srgb: true, repetir: false });
    hechas.set(cual, t);
  }
  return t;
};

/** Una planta del primer plano: dónde da la vuelta, qué tan grande es (en altos de pantalla) y si va espejada. */
export interface Planta {
  readonly borde: "abajo" | "arriba";
  readonly fase: number;
  /** Alto en la orilla, en fracción del alto de la pantalla. */
  readonly alto: number;
  /** Ancho / alto de su textura. */
  readonly proporcion: number;
  readonly espejo: boolean;
  /** Cuánto se hunde por debajo del borde (fracción de su alto). */
  readonly hundida: number;
}

/** Las plantas de un primer plano, repartidas con la semilla. */
export function repartirPlantas(opciones: OpcionesPrimerPlano): (Planta & { textura: CualTextura })[] {
  const azar = crearAzar(opciones.semilla ?? 5);
  const plantas: (Planta & { textura: CualTextura })[] = [];
  if (opciones.abajo) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      plantas.push({
        borde: "abajo",
        fase: (i + 0.3 * azar()) / n,
        alto: opciones.abajo === "piedras" ? 0.34 + 0.1 * azar() : 0.45 + 0.2 * azar(),
        proporcion: 1.2,
        espejo: azar() < 0.5,
        hundida: 0.1 + 0.1 * azar(),
        textura: `abajo-${opciones.abajo}-${i % 2 === 0 ? 1 : 2}` as CualTextura,
      });
    }
  }
  if (opciones.arriba) {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const pino = opciones.arriba === "pino";
      plantas.push({
        borde: "arriba",
        fase: (i + 0.5 + 0.3 * azar()) / n,
        alto: pino ? 0.38 + 0.1 * azar() : 0.42 + 0.14 * azar(),
        proporcion: pino ? 2 : 1.1,
        espejo: azar() < 0.5,
        hundida: pino ? 0.15 : 0.2 + 0.1 * azar(),
        textura: `arriba-${opciones.arriba}-${i % 2 === 0 ? 1 : 2}` as CualTextura,
      });
    }
  }
  return plantas;
}

export interface PrimerPlano {
  readonly grupo: THREE.Group;
}

export function crearPrimerPlano(
  opciones: OpcionesPrimerPlano,
  color: THREE.ColorRepresentation = COLORES.siluetaHonda,
) {
  const grupo = new THREE.Group();
  grupo.name = "primer-plano";
  // Las plantas nacen abajo al centro de su plano; las de arriba cuelgan (se dibujan dadas vuelta)
  const geometria = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const local = new THREE.Matrix4();
  const camaraEnElMundo = new THREE.Vector3();
  for (const planta of repartirPlantas(opciones)) {
    const material = new THREE.MeshBasicMaterial({
      name: "primer-plano",
      color,
      map: textura(planta.textura),
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    });
    const malla = new THREE.Mesh(geometria, material);
    malla.frustumCulled = false;
    malla.matrixAutoUpdate = false;
    malla.renderOrder = 50;
    malla.onBeforeRender = (_pintor, _escena, camara) => {
      if (!(camara instanceof THREE.PerspectiveCamera)) return;
      camaraEnElMundo.setFromMatrixPosition(camara.matrixWorld);
      const medioAlto = DISTANCIA * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
      const medioAncho = medioAlto * camara.aspect;
      const x = lugarEnPantalla(planta.fase, camaraEnElMundo.x);
      const alto = 2 * medioAlto * planta.alto * altoSegunLugar(x, planta.borde === "abajo" ? 0.2 : 0);
      const ancho = alto * planta.proporcion;
      const abajo = planta.borde === "abajo";
      // Las ramas de arriba salen de la orilla más cercana, como si colgaran de un árbol fuera de la imagen; las
      // hojas se dibujan dadas vuelta (cuelgan), la rama de pino ya cuelga en su textura
      const espejo = abajo ? planta.espejo : x > 0;
      const colgada = !abajo && planta.proporcion < 2;
      const y = abajo
        ? -medioAlto - alto * planta.hundida
        : colgada
          ? medioAlto + alto * planta.hundida
          : medioAlto - alto * (1 - planta.hundida);
      local.makeScale(espejo ? -ancho : ancho, colgada ? -alto : alto, 1);
      local.setPosition(x * medioAncho, y, -DISTANCIA);
      malla.matrixWorld.multiplyMatrices(camara.matrixWorld, local);
    };
    grupo.add(malla);
  }
  return { grupo };
}
