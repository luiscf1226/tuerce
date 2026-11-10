// Texturas hechas a mano con código (sin imágenes que descargar): la tela de costal de los muñecos, la corteza,
// la niebla que se corre y las siluetas recortadas de ramas, abetos y matas. Son funciones puras que devuelven
// píxeles RGBA; `materiales.ts` las convierte en texturas de Three.js. La fila 0 es la de abajo (v = 0).
import { azarEn, crearAzar, fbmPeriodico, ruidoPeriodico } from "./ruido";

export interface Lamina {
  readonly ancho: number;
  readonly alto: number;
  /** RGBA, 4 bytes por píxel, fila por fila desde abajo. */
  readonly datos: Uint8Array;
}

export function nuevaLamina(ancho: number, alto: number): Lamina {
  if (!Number.isInteger(ancho) || !Number.isInteger(alto) || ancho < 1 || alto < 1) {
    throw new Error(`tamaño de textura inválido: ${ancho}×${alto}`);
  }
  return { ancho, alto, datos: new Uint8Array(ancho * alto * 4) };
}

const limitar = (v: number, min = 0, max = 1) => Math.min(Math.max(v, min), max);
const byte = (v: number) => Math.round(limitar(v) * 255);
const pasoSuave = (a: number, b: number, v: number) => {
  const t = limitar((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function poner(l: Lamina, x: number, y: number, r: number, g: number, b: number, a: number) {
  const i = (y * l.ancho + x) * 4;
  l.datos[i] = byte(r);
  l.datos[i + 1] = byte(g);
  l.datos[i + 2] = byte(b);
  l.datos[i + 3] = byte(a);
}

/** Lámina blanca y transparente: las siluetas se pintan solo en el canal alfa y el material pone el color. */
function laminaRecorte(ancho: number, alto: number): Lamina {
  const l = nuevaLamina(ancho, alto);
  for (let i = 0; i < l.datos.length; i += 4) {
    l.datos[i] = 255;
    l.datos[i + 1] = 255;
    l.datos[i + 2] = 255;
  }
  return l;
}

function sumarAlfa(l: Lamina, x: number, y: number, a: number) {
  if (x < 0 || y < 0 || x >= l.ancho || y >= l.alto || a <= 0) return;
  const i = (y * l.ancho + x) * 4 + 3;
  const nuevo = byte(a);
  if (nuevo > (l.datos[i] ?? 0)) l.datos[i] = nuevo;
}

/** Un trazo de (x0, y0) a (x1, y1) en píxeles, que se afina de `g0` a `g1` de grosor, con borde suave. */
export function pintarTrazo(l: Lamina, x0: number, y0: number, x1: number, y1: number, g0: number, g1 = g0) {
  const margen = Math.max(g0, g1) + 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(Math.min(y0, y1) - margen); y <= Math.ceil(Math.max(y0, y1) + margen); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - margen); x <= Math.ceil(Math.max(x0, x1) + margen); x++) {
      const t = limitar(((x - x0) * dx + (y - y0) * dy) / largo2);
      const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t));
      sumarAlfa(l, x, y, (g0 + (g1 - g0) * t) / 2 - d + 0.5);
    }
  }
}

/** Una hoja en punta que nace en (x, y) y apunta hacia `angulo` (radianes). */
export function pintarHoja(l: Lamina, x: number, y: number, angulo: number, largo: number, ancho: number) {
  const ux = Math.cos(angulo);
  const uy = Math.sin(angulo);
  const r = largo + ancho;
  for (let py = Math.floor(y - r); py <= Math.ceil(y + r); py++) {
    for (let px = Math.floor(x - r); px <= Math.ceil(x + r); px++) {
      const s = (px - x) * ux + (py - y) * uy;
      if (s < 0 || s > largo) continue;
      const t = -(px - x) * uy + (py - y) * ux;
      const media = (ancho / 2) * Math.sin((Math.PI * s) / largo) ** 0.7;
      sumarAlfa(l, px, py, media - Math.abs(t) + 0.5);
    }
  }
}

export interface Tela {
  /** Tono en gris (sRGB): se multiplica por el color del material. */
  readonly color: Lamina;
  /** R: altura del tejido (para `bumpMap`); G: aspereza (para `roughnessMap`). */
  readonly relieve: Lamina;
}

/**
 * Tela de costal: hilos gruesos que pasan uno arriba y otro abajo, con fibras, grosores desparejos y manchas.
 * Se repite sin costuras.
 */
export function tejerTela(tamano = 256, semilla = 1, hilos = Math.max(4, Math.round(tamano / 8))): Tela {
  const color = nuevaLamina(tamano, tamano);
  const relieve = nuevaLamina(tamano, tamano);
  const perfil = (d: number, g: number) => (d >= g ? 0 : Math.sqrt(1 - (d / g) ** 2));
  for (let y = 0; y < tamano; y++) {
    const fy = ((y + 0.5) * hilos) / tamano;
    const j = Math.floor(fy);
    const v = fy - j;
    for (let x = 0; x < tamano; x++) {
      const fx = ((x + 0.5) * hilos) / tamano;
      const i = Math.floor(fx);
      const u = fx - i;
      const horizontalArriba = (i + j) % 2 === 0;
      // hilo horizontal (fila j) y vertical (columna i): grosor y tono propios de cada hilo
      const gH = 0.36 + 0.12 * azarEn(j, 7, semilla);
      const gV = 0.36 + 0.12 * azarEn(i, 11, semilla);
      const fibraH = ruidoPeriodico(fx * 3, fy * 14, [hilos * 3, hilos * 14], semilla + 5);
      const fibraV = ruidoPeriodico(fx * 14, fy * 3, [hilos * 14, hilos * 3], semilla + 6);
      const sobre = (arriba: boolean, a: number) =>
        arriba ? 0.72 + 0.28 * Math.sin(Math.PI * a) : 0.62 - 0.22 * Math.sin(Math.PI * a);
      const hH = perfil(Math.abs(v - 0.5), gH) * sobre(horizontalArriba, u) * (0.8 + 0.35 * fibraH);
      const hV = perfil(Math.abs(u - 0.5), gV) * sobre(!horizontalArriba, v) * (0.8 + 0.35 * fibraV);
      const h = limitar(Math.max(hH, hV));
      const tono = hH >= hV ? 0.78 + 0.22 * azarEn(j, 3, semilla) : 0.78 + 0.22 * azarEn(i, 4, semilla);
      const mancha = 0.78 + 0.4 * fbmPeriodico((x / tamano) * 4, (y / tamano) * 4, 4, 4, semilla + 9);
      const pelusa = 0.94 + 0.12 * azarEn(x, y, semilla + 13);
      const gris = h <= 0 ? 0.4 : (0.6 + 0.4 * h) * tono * mancha * pelusa;
      poner(color, x, y, gris, gris, gris, 1);
      poner(relieve, x, y, h, 0.82 + 0.18 * (1 - h), 0, 1);
    }
  }
  return { color, relieve };
}

/** Corteza: surcos largos a lo largo del tronco (v) y placas entre ellos. Se repite sin costuras. */
export function rayarCorteza(tamano = 256, semilla = 2): Tela {
  const color = nuevaLamina(tamano, tamano);
  const relieve = nuevaLamina(tamano, tamano);
  for (let y = 0; y < tamano; y++) {
    for (let x = 0; x < tamano; x++) {
      const n = fbmPeriodico((x / tamano) * 18, (y / tamano) * 3, [18, 3], 4, semilla);
      const cresta = 1 - Math.abs(2 * n - 1);
      const h = cresta ** 1.6;
      const mancha = 0.8 + 0.35 * fbmPeriodico((x / tamano) * 5, (y / tamano) * 5, 5, 3, semilla + 3);
      const gris = (0.3 + 0.7 * h) * mancha * (0.93 + 0.14 * azarEn(x, y, semilla + 1));
      poner(color, x, y, gris, gris, gris, 1);
      poner(relieve, x, y, h, 0.85 + 0.15 * (1 - h), 0, 1);
    }
  }
  return { color, relieve };
}

/**
 * Jirones de niebla: blanco con transparencia de ruido, más espeso abajo y que se desvanece arriba y abajo
 * (el borde del plano no se ve). Se repite de lado a lado para poder correrla.
 */
export function nubeDeNiebla(ancho = 256, alto = 128, semilla = 3): Lamina {
  const l = laminaRecorte(ancho, alto);
  for (let y = 0; y < alto; y++) {
    const v = (y + 0.5) / alto;
    const envoltura = pasoSuave(0, 0.3, v) * (1 - pasoSuave(0.3, 1, v));
    for (let x = 0; x < ancho; x++) {
      const n = fbmPeriodico((x / ancho) * 5, v * 2.5, [5, 64], 5, semilla);
      const a = pasoSuave(0.25, 0.75, n) * envoltura;
      const i = (y * ancho + x) * 4 + 3;
      l.datos[i] = byte(a);
    }
  }
  return l;
}

/**
 * Rama de pino que cuelga: nace en el borde izquierdo (pegada al tronco), cae hacia la punta y lleva agujas
 * a los dos lados y ramitas secundarias.
 */
export function ramaDePino(ancho = 256, alto = 128, semilla = 4): Lamina {
  const l = laminaRecorte(ancho, alto);
  const azar = crearAzar(semilla);
  const eje = (u: number) => ({ x: u * ancho * 0.97, y: alto * (0.72 - 0.32 * u * u) });
  const agujas = (u0: number, u1: number, punto: (u: number) => { x: number; y: number }, largoBase: number) => {
    for (let u = u0; u < u1; u += 2.2 / ancho) {
      const p = punto(u);
      const q = punto(Math.min(u + 0.01, 1));
      const angulo = Math.atan2(q.y - p.y, q.x - p.x);
      const largo = largoBase * (1 - 0.55 * u) * (0.75 + 0.5 * azar());
      for (const lado of [1, -1]) {
        const a = angulo + lado * (0.85 + 0.25 * azar()) - 0.25;
        pintarTrazo(l, p.x, p.y, p.x + Math.cos(a) * largo, p.y + Math.sin(a) * largo, 1.3, 0.6);
      }
    }
  };
  // el eje principal y sus agujas
  for (let u = 0; u < 1; u += 1 / ancho) {
    const p = eje(u);
    const q = eje(u + 1 / ancho);
    pintarTrazo(l, p.x, p.y, q.x, q.y, 5 * (1 - u) + 1.2);
  }
  agujas(0.08, 1, eje, alto * 0.24);
  // ramitas que salen del eje, también con agujas
  for (const u of [0.28, 0.45, 0.62, 0.78]) {
    for (const lado of [1, -1]) {
      const base = eje(u);
      const largo = ancho * (0.3 - 0.18 * u) * (0.8 + 0.3 * azar());
      const a = lado * 0.55 - 0.35;
      const punto = (t: number) => ({
        x: base.x + Math.cos(a) * largo * t,
        y: base.y + Math.sin(a) * largo * t - alto * 0.08 * t * t,
      });
      pintarTrazo(l, base.x, base.y, punto(1).x, punto(1).y, 2, 0.8);
      agujas(0, 1, punto, alto * 0.16);
    }
  }
  return l;
}

/** Abeto entero visto de lejos: pisos de ramas que cuelgan, punta fina y un poco de tronco abajo. */
export function siluetaDeAbeto(ancho = 128, alto = 256, semilla = 5): Lamina {
  const l = laminaRecorte(ancho, alto);
  const azar = crearAzar(semilla);
  const centro = ancho / 2;
  const punta = alto * 0.985;
  const base = alto * 0.1;
  pintarTrazo(l, centro, 0, centro, punta, ancho * 0.05, 1);
  const pisos = 7 + Math.floor(azar() * 4);
  for (let y = punta; y > base; y -= 1.3) {
    const t = (punta - y) / (punta - base);
    const piso = (t * pisos) % 1;
    const media = ancho * 0.47 * t ** 0.9 * (0.55 + 0.45 * piso);
    for (const lado of [1, -1]) {
      const largo = media * (0.8 + 0.3 * azar());
      const caida = largo * (0.25 + 0.2 * azar());
      pintarTrazo(l, centro, y, centro + lado * largo, y - caida, 1.6, 0.8);
    }
  }
  return l;
}

/** Mata de primer plano: tallos que se abren desde abajo con hojas en punta, alternadas. */
export function ramitaDeHojas(tamano = 256, semilla = 6, tallos = 5): Lamina {
  const l = laminaRecorte(tamano, tamano);
  const azar = crearAzar(semilla);
  for (let k = 0; k < tallos; k++) {
    const abre = tallos === 1 ? 0 : (k / (tallos - 1) - 0.5) * 1.5 + (azar() - 0.5) * 0.25;
    const largo = tamano * (0.6 + 0.35 * azar()) * (1 - 0.35 * Math.abs(abre));
    const curva = (azar() - 0.5) * 0.8;
    const punto = (t: number) => {
      const a = Math.PI / 2 - abre - curva * t;
      return {
        x: tamano / 2 + Math.cos(a) * largo * t + abre * tamano * 0.08 * t,
        y: Math.sin(a) * largo * t * 0.98,
      };
    };
    for (let t = 0; t < 1; t += 0.02) {
      const p = punto(t);
      const q = punto(t + 0.02);
      pintarTrazo(l, p.x, p.y, q.x, q.y, 3 * (1 - t) + 1);
    }
    let lado = azar() < 0.5 ? 1 : -1;
    for (let t = 0.22; t < 0.98; t += 0.1 + 0.04 * azar()) {
      const p = punto(t);
      const q = punto(t + 0.02);
      const dir = Math.atan2(q.y - p.y, q.x - p.x);
      const hoja = tamano * (0.16 - 0.07 * t) * (0.8 + 0.4 * azar());
      pintarHoja(l, p.x, p.y, dir + lado * (0.75 + 0.3 * azar()), hoja, hoja * 0.42);
      lado = -lado;
    }
    const tope = punto(1);
    const fin = punto(0.97);
    pintarHoja(l, fin.x, fin.y, Math.atan2(tope.y - fin.y, tope.x - fin.x), tamano * 0.1, tamano * 0.04);
  }
  return l;
}
