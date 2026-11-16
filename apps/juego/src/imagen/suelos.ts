// Los suelos de los niveles (TU-61): la textura de cada lugar en grises, hecha con código como la tela y la corteza.
// Tierra del patio, pinocha del pinar, empedrado de la calle, piedra oscura de la mina… Cada una se repite sin
// costuras; `materialSuelo` (materiales.ts) la pone en el material y `uvDelMundo` le da a cada malla coordenadas
// en metros del mundo, así la textura tiene el mismo tamaño en todas las piezas del nivel.
import * as THREE from "three";
import { azarEn, crearAzar, fbmPeriodico } from "./ruido";
import { nuevaLamina, type Tela } from "./texturas";

export const SUELOS = [
  "tierra",
  "pinocha",
  "empedrado",
  "piedra",
  "sillar",
  "pasto",
  "hojarasca",
  "grava",
  "arena",
] as const;
export type Suelo = (typeof SUELOS)[number];

export interface DatosDeSuelo {
  /** Cuántos metros del mundo cubre una repetición de la textura. */
  readonly metros: number;
  /** Cuánto se oscurece la textura (1 la deja como está): la piedra de la mina es más oscura que la arena. */
  readonly tono: number;
  /** Qué tanto se nota el relieve. */
  readonly relieve: number;
}

export const DATOS_DE_SUELO: Readonly<Record<Suelo, DatosDeSuelo>> = {
  tierra: { metros: 3, tono: 0.5, relieve: 3 },
  pinocha: { metros: 2.5, tono: 0.55, relieve: 2 },
  empedrado: { metros: 2.4, tono: 0.48, relieve: 5 },
  piedra: { metros: 3, tono: 0.15, relieve: 6 },
  sillar: { metros: 3.2, tono: 0.52, relieve: 4 },
  pasto: { metros: 2.5, tono: 0.55, relieve: 3 },
  hojarasca: { metros: 2.5, tono: 0.55, relieve: 3 },
  grava: { metros: 2, tono: 0.55, relieve: 4 },
  arena: { metros: 4, tono: 0.58, relieve: 2 },
};

/** Qué textura llevan los costados de cada suelo: la roca y la piedra labrada siguen; lo demás es tierra cortada. */
export function costadoDe(cual: Suelo): Suelo | "corte" {
  return cual === "piedra" || cual === "sillar" ? cual : "corte";
}

/** Las caras de los costados (cortes de tierra, bordes de las plataformas) se ven así de más oscuras que las de arriba. */
export const COSTADO = 0.6;

const limitar = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
const pasoSuave = (a: number, b: number, v: number) => {
  const t = limitar((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const envolver = (n: number, periodo: number) => ((n % periodo) + periodo) % periodo;

/** Un lienzo de trabajo: gris (0 a 1) y altura (0 a 1) por píxel, que se repite de lado a lado. */
interface Lienzo {
  readonly tamano: number;
  readonly gris: Float32Array;
  readonly alto: Float32Array;
}

function nuevoLienzo(tamano: number, base: (x: number, y: number) => [number, number]): Lienzo {
  const gris = new Float32Array(tamano * tamano);
  const alto = new Float32Array(tamano * tamano);
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const [g, h] = base(x, y);
      gris[y * tamano + x] = g;
      alto[y * tamano + x] = h;
    }
  }
  return { tamano, gris, alto };
}

/** Pinta una forma con borde suave: `cobertura(px, py)` (en píxeles, relativos al centro) dice cuánto la cubre. */
function pintarForma(
  l: Lienzo,
  cx: number,
  cy: number,
  radio: number,
  cobertura: (dx: number, dy: number) => number,
  tono: number,
  altura: number,
) {
  for (let py = Math.floor(cy - radio); py <= Math.ceil(cy + radio); py++) {
    for (let px = Math.floor(cx - radio); px <= Math.ceil(cx + radio); px++) {
      const c = limitar(cobertura(px - cx, py - cy));
      if (c <= 0) continue;
      const i = envolver(py, l.tamano) * l.tamano + envolver(px, l.tamano);
      l.gris[i] = (l.gris[i] ?? 0) * (1 - c) + tono * c;
      l.alto[i] = Math.max(l.alto[i] ?? 0, altura * c);
    }
  }
}

/** Un trazo recto de grosor `g` en píxeles (aguja de pino, brizna de pasto), que da la vuelta por los bordes. */
function trazo(l: Lienzo, x0: number, y0: number, x1: number, y1: number, g: number, tono: number, altura: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo2 = dx * dx + dy * dy || 1;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const radio = Math.sqrt(largo2) / 2 + g + 1;
  pintarForma(
    l,
    cx,
    cy,
    radio,
    (ox, oy) => {
      const px = cx + ox;
      const py = cy + oy;
      const t = limitar(((px - x0) * dx + (py - y0) * dy) / largo2);
      const d = Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
      return g / 2 - d + 0.5;
    },
    tono,
    altura,
  );
}

/** Una hoja en punta (como `pintarHoja`), con su nervio un poco más oscuro. */
function hoja(l: Lienzo, x: number, y: number, angulo: number, largo: number, ancho: number, tono: number) {
  const ux = Math.cos(angulo);
  const uy = Math.sin(angulo);
  pintarForma(
    l,
    x + (ux * largo) / 2,
    y + (uy * largo) / 2,
    largo / 2 + ancho,
    (ox, oy) => {
      const s = (ox + (ux * largo) / 2) * ux + (oy + (uy * largo) / 2) * uy;
      if (s < 0 || s > largo) return 0;
      const t = -(ox + (ux * largo) / 2) * uy + (oy + (uy * largo) / 2) * ux;
      const media = (ancho / 2) * Math.sin((Math.PI * s) / largo) ** 0.7;
      const borde = media - Math.abs(t) + 0.5;
      return Math.abs(t) < 0.6 && s > largo * 0.1 ? borde * 0.85 : borde;
    },
    tono,
    0.6 + 0.3 * tono,
  );
}

/** Celdas de Voronoi que se repiten: distancia al punto más cercano (d1), al segundo (d2) y cuál es (id). */
export function celdas(x: number, y: number, n: number, semilla: number, suelto = 0.8) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let d1 = Number.POSITIVE_INFINITY;
  let d2 = Number.POSITIVE_INFINITY;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const gx = envolver(cx + i, n);
      const gy = envolver(cy + j, n);
      const px = cx + i + 0.5 + (azarEn(gx, gy, semilla) - 0.5) * suelto;
      const py = cy + j + 0.5 + (azarEn(gx, gy, semilla + 1) - 0.5) * suelto;
      const d = Math.hypot(x - px, y - py);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = gy * n + gx;
      } else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

const mancha = (x: number, y: number, t: number, escala: number, semilla: number) =>
  fbmPeriodico((x / t) * escala, (y / t) * escala, escala, 4, semilla);

function tierra(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const m = mancha(x, y, t, 4, s);
    const fino = mancha(x, y, t, 32, s + 7);
    // grietas finas de tierra seca, que aparecen y se pierden
    const grieta =
      (1 - pasoSuave(0, 0.012, Math.abs(mancha(x, y, t, 3, s + 3) - 0.5))) *
      pasoSuave(0.45, 0.6, mancha(x, y, t, 2, s + 4));
    const g = (0.48 + 0.26 * m) * (0.86 + 0.2 * fino) * (1 - 0.22 * grieta);
    return [g, 0.35 * m + 0.25 * fino - 0.2 * grieta];
  });
  const azar = crearAzar(s + 11);
  for (let k = 0; k < (t * t) / 2400; k++) {
    const r = 1.2 + azar() * 3;
    const tono = 0.4 + azar() * 0.22;
    pintarForma(l, azar() * t, azar() * t, r + 1, (dx, dy) => r - Math.hypot(dx, dy * 1.2) + 0.5, tono, 0.8);
  }
  return l;
}

function pinocha(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const m = mancha(x, y, t, 4, s);
    return [0.42 + 0.22 * m, 0.2 * m];
  });
  const azar = crearAzar(s + 5);
  // capas de agujas: las de abajo más oscuras, las de encima más claras
  for (let k = 0; k < (t * t) / 40; k++) {
    const x = azar() * t;
    const y = azar() * t;
    const a = azar() * Math.PI;
    const largo = t * (0.035 + 0.04 * azar());
    const capa = k / ((t * t) / 40);
    const tono = 0.36 + 0.2 * capa + 0.1 * azar();
    trazo(l, x, y, x + Math.cos(a) * largo, y + Math.sin(a) * largo, 1, tono, 0.3 + 0.6 * capa);
  }
  return l;
}

function empedrado(t: number, s: number, piedras = 8): Lienzo {
  return nuevoLienzo(t, (x, y) => {
    const torcido = 0.25 * (mancha(x, y, t, 3, s + 9) - 0.5);
    const { d1, d2, id } = celdas((x / t) * piedras + torcido, (y / t) * piedras - torcido, piedras, s, 0.75);
    const borde = d2 - d1;
    const piedra = pasoSuave(0.05, 0.22, borde);
    const lomo = Math.sqrt(limitar(1 - d1 * 1.3));
    const tono = 0.5 + 0.22 * azarEn(id, 3, s);
    const grano = 0.85 + 0.25 * mancha(x, y, t, 24, s + 5);
    const g = piedra * tono * grano * (0.82 + 0.25 * lomo) + (1 - piedra) * 0.26;
    return [g, piedra * (0.4 + 0.6 * lomo) * grano];
  });
}

function piedra(t: number, s: number): Lienzo {
  const n = 7;
  return nuevoLienzo(t, (x, y) => {
    const torcido = 0.6 * (mancha(x, y, t, 3, s + 9) - 0.5);
    const { d1, d2, id } = celdas((x / t) * n + torcido, (y / t) * n - torcido, n, s, 0.95);
    // no todas las juntas se ven: la roca es una sola, con grietas que aparecen y se pierden
    const grieta = (1 - pasoSuave(0.01, 0.07, d2 - d1)) * pasoSuave(0.45, 0.62, mancha(x, y, t, 4, s + 21));
    const m = mancha(x, y, t, 8, s + 17);
    const fino = mancha(x, y, t, 40, s + 3);
    const lomo = Math.sqrt(limitar(1 - d1 * 1.1));
    const tono = 0.45 + 0.2 * azarEn(id, 5, s);
    const g = tono * (0.65 + 0.45 * m) * (0.8 + 0.3 * fino) * (0.85 + 0.2 * lomo) * (1 - 0.5 * grieta);
    return [g, (0.3 + 0.4 * m + 0.3 * lomo) * (1 - grieta) + 0.2 * fino];
  });
}

function sillar(t: number, s: number): Lienzo {
  const filas = 4;
  const columnas = 2;
  return nuevoLienzo(t, (x, y) => {
    const v = (y / t) * filas;
    const fila = Math.floor(v);
    const u = (x / t) * columnas + (fila % 2) * 0.5;
    const col = Math.floor(u);
    const fu = u - col;
    const fv = v - fila;
    const desgaste = 0.03 * mancha(x, y, t, 12, s + 3);
    const junta = Math.min(fu * 2, (1 - fu) * 2, fv, 1 - fv) / 0.06 - desgaste * 10;
    const bloque = pasoSuave(0.4, 1.2, junta);
    const id = envolver(col, columnas) * 31 + fila;
    const tono = 0.5 + 0.3 * azarEn(id, 7, s);
    const m = mancha(x, y, t, 6, s + id);
    const poro = mancha(x, y, t, 48, s + 1);
    const musgo = pasoSuave(0.55, 0.75, mancha(x, y, t, 5, s + 31));
    const g = bloque * tono * (0.7 + 0.45 * m) * (0.85 + 0.25 * poro) * (1 - 0.35 * musgo) + (1 - bloque) * 0.25;
    return [g, bloque * (0.6 + 0.3 * m + 0.2 * poro)];
  });
}

function pasto(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const m = mancha(x, y, t, 4, s);
    return [0.42 + 0.2 * m, 0.25 * m];
  });
  const azar = crearAzar(s + 3);
  // briznas cortas y tupidas, casi todas echadas hacia el mismo lado, con matas más oscuras y más claras
  for (let k = 0; k < (t * t) / 18; k++) {
    const x = azar() * t;
    const y = azar() * t;
    const zona = mancha(x, y, t, 6, s + 5);
    const a = -0.6 + (azar() - 0.5) * 1.6 + zona;
    const largo = t * (0.012 + 0.02 * azar());
    const tono = 0.34 + 0.3 * zona + 0.12 * azar();
    trazo(l, x, y, x + Math.cos(a) * largo, y + Math.sin(a) * largo, 1, tono, 0.4 + 0.5 * azar());
  }
  return l;
}

function hojarasca(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const m = mancha(x, y, t, 4, s);
    return [0.3 + 0.12 * m, 0.1 * m];
  });
  const azar = crearAzar(s + 9);
  const hojas = (t * t) / 90;
  for (let k = 0; k < hojas; k++) {
    const largo = t * (0.025 + 0.035 * azar());
    // las de encima, más claras: un colchón de hojas con profundidad
    const tono = 0.3 + 0.22 * (k / hojas) + 0.1 * azar();
    hoja(l, azar() * t, azar() * t, azar() * Math.PI * 2, largo, largo * (0.35 + 0.2 * azar()), tono);
  }
  return l;
}

function grava(t: number, s: number): Lienzo {
  const n = 36;
  return nuevoLienzo(t, (x, y) => {
    const { d1, d2, id } = celdas((x / t) * n, (y / t) * n, n, s, 0.9);
    const piedra = pasoSuave(0.03, 0.2, d2 - d1);
    const lomo = Math.sqrt(limitar(1 - d1 * 1.6));
    const zona = mancha(x, y, t, 4, s + 3);
    const tono = 0.42 + 0.16 * azarEn(id, 9, s) + 0.12 * zona;
    const g = piedra * tono * (0.85 + 0.25 * lomo) + (1 - piedra) * 0.3;
    return [g, piedra * lomo];
  });
}

function arena(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const torcido = mancha(x, y, t, 2, s + 5);
    const onda = 0.5 + 0.5 * Math.sin(((y / t) * 9 + torcido * 2.5) * Math.PI * 2);
    const m = mancha(x, y, t, 5, s);
    const fino = azarEn(x, y, s + 1);
    const g = (0.72 + 0.18 * m) * (0.9 + 0.12 * onda) * (0.94 + 0.1 * fino);
    return [g, 0.45 * onda + 0.2 * m + 0.1 * fino];
  });
  const azar = crearAzar(s + 2);
  // conchitas y piedritas sueltas, apenas más oscuras que la arena
  for (let k = 0; k < (t * t) / 4000; k++) {
    const r = 1 + azar() * 2;
    const tono = 0.55 + 0.12 * azar();
    pintarForma(l, azar() * t, azar() * t, r + 1, (dx, dy) => r - Math.hypot(dx, dy * 1.4) + 0.5, tono, 0.6);
  }
  return l;
}

/** Los costados: tierra cortada en capas (o revoque viejo), con manchas y alguna piedra. */
function corte(t: number, s: number): Lienzo {
  const l = nuevoLienzo(t, (x, y) => {
    const capas = fbmPeriodico((x / t) * 2, (y / t) * 14, [2, 14], 4, s);
    const m = mancha(x, y, t, 5, s + 3);
    const fino = mancha(x, y, t, 40, s + 7);
    const g = (0.5 + 0.18 * capas + 0.14 * m) * (0.88 + 0.2 * fino);
    return [g, 0.4 * capas + 0.3 * fino];
  });
  const azar = crearAzar(s + 4);
  for (let k = 0; k < (t * t) / 2200; k++) {
    const r = 1.5 + azar() * 3.5;
    pintarForma(l, azar() * t, azar() * t, r + 1, (dx, dy) => r - Math.hypot(dx, dy * 1.3) + 0.5, 0.38, 0.7);
  }
  return l;
}

const PINTORES: Readonly<Record<Suelo | "corte", (tamano: number, semilla: number) => Lienzo>> = {
  corte,
  tierra,
  pinocha,
  empedrado,
  piedra,
  sillar,
  pasto,
  hojarasca,
  grava,
  arena,
};

/** La textura de un suelo: tono en gris (sRGB) y relieve (R altura, G aspereza), que se repiten sin costuras. */
export function pintarSuelo(cual: Suelo | "corte", tamano = 256, semilla = 7): Tela {
  const l = PINTORES[cual](tamano, semilla);
  const color = nuevaLamina(tamano, tamano);
  const relieve = nuevaLamina(tamano, tamano);
  for (let i = 0; i < tamano * tamano; i++) {
    const g = Math.round(limitar(l.gris[i] ?? 0) * 255);
    const h = limitar(l.alto[i] ?? 0);
    color.datos.set([g, g, g, 255], i * 4);
    relieve.datos.set([Math.round(h * 255), Math.round((0.8 + 0.2 * (1 - h)) * 255), 0, 255], i * 4);
  }
  return { color, relieve };
}

/** Qué tan clara queda una cara según hacia dónde mira: arriba 1, los costados `COSTADO`, abajo más oscura. */
export function luzDeCara(normalY: number): number {
  return normalY >= 0 ? COSTADO + (1 - COSTADO) * pasoSuave(0.3, 0.8, normalY) : COSTADO * (1 + 0.3 * normalY);
}

/** Hasta qué inclinación una cara cuenta como de arriba (y lleva la textura del suelo): la y de su normal. */
export const DE_ARRIBA = 0.55;

/**
 * Una copia de la geometría con coordenadas de textura en metros del mundo (`matriz` lleva de la malla al mundo):
 * cada cara se proyecta por el eje al que más mira (de arriba, x-z; de costado, x-y o z-y), dividido por `metros`.
 * Además lleva un color por vértice que oscurece los costados (`luzDeCara`) y dos grupos: primero las caras de
 * arriba (material 0, el suelo) y después los costados y lo de abajo (material 1).
 */
export function uvDelMundo(geometria: THREE.BufferGeometry, matriz: THREE.Matrix4, metros: number) {
  const g = geometria.index ? geometria.toNonIndexed() : geometria.clone();
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  const posiciones = g.getAttribute("position");
  const normales = g.getAttribute("normal");
  const matrizNormal = new THREE.Matrix3().getNormalMatrix(matriz);
  const triangulos = Math.floor(posiciones.count / 3);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const caraN = new THREE.Vector3();
  const arriba: number[] = [];
  const costados: number[] = [];
  const normalDeCara: THREE.Vector3[] = [];
  for (let c = 0; c < triangulos; c++) {
    caraN.set(0, 0, 0);
    for (let k = 0; k < 3; k++)
      caraN.add(
        n
          .fromBufferAttribute(normales, c * 3 + k)
          .applyMatrix3(matrizNormal)
          .normalize(),
      );
    caraN.normalize();
    normalDeCara.push(caraN.clone());
    (caraN.y >= DE_ARRIBA ? arriba : costados).push(c);
  }
  const orden = [...arriba, ...costados];
  const nuevas = {
    position: new Float32Array(orden.length * 9),
    normal: new Float32Array(orden.length * 9),
    uv: new Float32Array(orden.length * 6),
    color: new Float32Array(orden.length * 9),
  };
  orden.forEach((c, destino) => {
    const cara = normalDeCara[c] ?? caraN;
    const ax = Math.abs(cara.x);
    const ay = Math.abs(cara.y);
    const az = Math.abs(cara.z);
    for (let k = 0; k < 3; k++) {
      const v = c * 3 + k;
      const d = destino * 3 + k;
      p.fromBufferAttribute(posiciones, v);
      nuevas.position.set([p.x, p.y, p.z], d * 3);
      n.fromBufferAttribute(normales, v);
      nuevas.normal.set([n.x, n.y, n.z], d * 3);
      p.applyMatrix4(matriz);
      const [u, w] = ay >= ax && ay >= az ? [p.x, -p.z] : az >= ax ? [p.x, p.y] : [p.z, p.y];
      nuevas.uv.set([u / metros, w / metros], d * 2);
      const luz = luzDeCara(n.applyMatrix3(matrizNormal).normalize().y);
      nuevas.color.set([luz, luz, luz], d * 3);
    }
  });
  const salida = new THREE.BufferGeometry();
  salida.setAttribute("position", new THREE.BufferAttribute(nuevas.position, 3));
  salida.setAttribute("normal", new THREE.BufferAttribute(nuevas.normal, 3));
  salida.setAttribute("uv", new THREE.BufferAttribute(nuevas.uv, 2));
  salida.setAttribute("color", new THREE.BufferAttribute(nuevas.color, 3));
  salida.addGroup(0, arriba.length * 3, 0);
  salida.addGroup(arriba.length * 3, costados.length * 3, 1);
  salida.computeBoundingBox();
  salida.computeBoundingSphere();
  return salida;
}
