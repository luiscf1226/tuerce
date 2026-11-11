// Lo que viaja entre los dos mientras juegan (TU-21), en binario y lo más chico posible:
//
//   · Entradas (invitado → anfitrión, canal rápido, en cada paso: 60 por segundo). 15 bytes:
//       [0x45 «E»] [seq u32 de la más nueva] [cuántas u8] y por cada una, de la más nueva a la más vieja:
//       [avanzar i8] [girar i8] [botones u8: saltar, brazo izquierdo, brazo derecho, señalar y 3 bits de gesto]
//     La pausa no viaja: cada uno pausa su pantalla.
//     Van las últimas 3: si se pierde un paquete, el siguiente trae lo que faltaba.
//
//   · Foto (anfitrión → invitado, canal rápido, cada 2 pasos: 30 por segundo). 28 + 10 bytes por cuerpo:
//       [0x46 «F»] [paso u32] [ack u32: la última entrada del invitado que ya se usó, 0 = ninguna]
//       [estados u8: 3 bits por muñeco] [agarres u8: 1 bit por mano] [rumbo i16 × 2]
//       [velocidad de la pelvis i16 × 3 × 2, en mm/s] [cuántos cuerpos u8]
//       y por cada cuerpo móvil: [posición i16 × 3, en 1/512 m desde el origen de la escena]
//                                [rotación u32: cuaternión «los tres más chicos», 2 + 3 × 10 bits]
//     Con los 18 pedazos de los dos muñecos y 3 huacales son 238 bytes: unos 7 KB por segundo.
import { type EntradaJugador, GESTOS } from "../entrada/mandos";
import type { EstadoMuneco } from "../muneco";

export const TIPO_ENTRADAS = 0x45;
export const TIPO_FOTO = 0x46;

/** Cuántas entradas viajan en cada paquete: la nueva y las dos anteriores. */
export const REDUNDANCIA = 3;
/** Posiciones en 1/512 m: con int16 alcanza para ±64 m desde el origen, a 2 mm. */
export const ESCALA_POSICION = 512;
/** Velocidades en mm/s: ±32 m/s. */
const ESCALA_VELOCIDAD = 1000;
const ESCALA_RUMBO = 32767 / Math.PI;
/** Lo más grande que puede ser cada uno de los tres componentes que viajan (el cuarto es el más grande). */
const RAIZ_MEDIO = Math.SQRT1_2;
/** 10 bits, pero con un número par de intervalos para que el 0 sea exacto. */
const DIEZ_BITS = 1022;

/** Cada estado del muñeco con su número en la foto (3 bits). */
const NUMERO_DE_ESTADO = { "de pie": 0, "en el aire": 1, trepando: 2, caido: 3, levantandose: 4 } satisfies Record<
  EstadoMuneco,
  number
>;
export const ESTADOS = Object.keys(NUMERO_DE_ESTADO) as EstadoMuneco[];

export interface Vector {
  x: number;
  y: number;
  z: number;
}

export interface EntradaNumerada {
  seq: number;
  entrada: EntradaJugador;
}

/** Una foto del mundo del anfitrión en un paso. */
export interface Foto {
  paso: number;
  /** La última entrada del invitado que el anfitrión usó en este paso (0 si todavía ninguna). */
  ack: number;
  /** El estado de cada muñeco (ver ESTADOS). */
  estados: [EstadoMuneco, EstadoMuneco];
  /** Qué manos agarran algo: bit 0 izquierda del rojo, 1 derecha del rojo, 2 y 3 lo mismo del turquesa. */
  agarres: number;
  rumbos: [number, number];
  /** Velocidad de la pelvis de cada muñeco (para predecir el propio). */
  velocidades: [Vector, Vector];
  /** x, y, z de cada cuerpo, en orden. */
  posiciones: Float32Array;
  /** x, y, z, w de cada cuerpo, en orden. */
  rotaciones: Float32Array;
}

export function bytesDeFoto(cuerpos: number): number {
  return 28 + 10 * cuerpos;
}

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const entero16 = (x: number) => limitar(Math.round(x), -32768, 32767);

/** Ángulo entre -π y π. */
export function envolver(angulo: number): number {
  return angulo - 2 * Math.PI * Math.round(angulo / (2 * Math.PI));
}

// ── Cuaterniones: «los tres más chicos» ─────────────────────────────────────────────────────────────────────

/**
 * Comprime un cuaternión unitario en 32 bits: cuál componente es el más grande (2 bits) y los otros tres en 10 bits
 * cada uno. El más grande se reconstruye porque el largo es 1; se lo deja positivo (q y -q son la misma rotación).
 * Error por componente de hasta 0,0007.
 */
export function comprimirCuaternion(x: number, y: number, z: number, w: number): number {
  const c = [x, y, z, w];
  let mayor = 0;
  for (let i = 1; i < 4; i++) if (Math.abs(c[i] ?? 0) > Math.abs(c[mayor] ?? 0)) mayor = i;
  const signo = (c[mayor] ?? 0) < 0 ? -1 : 1;
  let bits = mayor;
  for (let i = 0; i < 4; i++) {
    if (i === mayor) continue;
    const v = limitar(((c[i] ?? 0) * signo) / RAIZ_MEDIO, -1, 1);
    bits = bits * 1024 + Math.round(((v + 1) / 2) * DIEZ_BITS);
  }
  return bits >>> 0;
}

/** Lo contrario de `comprimirCuaternion`: escribe x, y, z, w en `salida` desde `desde`. */
export function descomprimirCuaternion(bits: number, salida: Float32Array | number[], desde = 0): void {
  let resto = bits >>> 0;
  const tres: number[] = [];
  for (let i = 0; i < 3; i++) {
    tres.unshift((((resto % 1024) / DIEZ_BITS) * 2 - 1) * RAIZ_MEDIO);
    resto = Math.floor(resto / 1024);
  }
  const mayor = resto & 3;
  const [a = 0, b = 0, c = 0] = tres;
  const grande = Math.sqrt(Math.max(0, 1 - a * a - b * b - c * c));
  let j = 0;
  for (let i = 0; i < 4; i++) salida[desde + i] = i === mayor ? grande : (tres[j++] ?? 0);
}

// ── Entradas ────────────────────────────────────────────────────────────────────────────────────────────────

const SALTAR = 1;
const IZQUIERDO = 2;
const DERECHO = 4;
const SENALAR = 8;
/** El gesto va en los bits 4 a 6: 0 es ninguno, 1 a 4 los de GESTOS. */
const GESTO = 16;

/** Las últimas entradas (la más nueva al final, con seq seguidos) → paquete. Manda hasta REDUNDANCIA. */
export function escribirEntradas(historial: readonly EntradaNumerada[]): ArrayBuffer {
  const van = historial.slice(-REDUNDANCIA).reverse();
  const nueva = van[0];
  if (!nueva) throw new RangeError("No hay entradas para mandar");
  const buffer = new ArrayBuffer(6 + 3 * van.length);
  const vista = new DataView(buffer);
  vista.setUint8(0, TIPO_ENTRADAS);
  vista.setUint32(1, nueva.seq);
  vista.setUint8(5, van.length);
  van.forEach(({ entrada: e }, i) => {
    const o = 6 + 3 * i;
    vista.setInt8(o, limitar(Math.round(e.avanzar * 127), -127, 127));
    vista.setInt8(o + 1, limitar(Math.round(e.girar * 127), -127, 127));
    const gesto = e.gesto ? GESTOS.indexOf(e.gesto) + 1 : 0;
    vista.setUint8(
      o + 2,
      (e.saltar ? SALTAR : 0) |
        (e.brazoIzquierdo ? IZQUIERDO : 0) |
        (e.brazoDerecho ? DERECHO : 0) |
        (e.senalar ? SENALAR : 0) |
        (gesto * GESTO),
    );
  });
  return buffer;
}

/** Paquete → entradas, de la más vieja a la más nueva. `null` si no es un paquete de entradas. */
export function leerEntradas(datos: ArrayBuffer): EntradaNumerada[] | null {
  if (datos.byteLength < 6) return null;
  const vista = new DataView(datos);
  if (vista.getUint8(0) !== TIPO_ENTRADAS) return null;
  const seq = vista.getUint32(1);
  const cuantas = vista.getUint8(5);
  if (datos.byteLength !== 6 + 3 * cuantas) return null;
  const salida: EntradaNumerada[] = [];
  for (let i = cuantas - 1; i >= 0; i--) {
    if (seq - i < 1) continue;
    const o = 6 + 3 * i;
    const botones = vista.getUint8(o + 2);
    salida.push({
      seq: seq - i,
      entrada: {
        avanzar: vista.getInt8(o) / 127,
        girar: vista.getInt8(o + 1) / 127,
        saltar: (botones & SALTAR) !== 0,
        brazoIzquierdo: (botones & IZQUIERDO) !== 0,
        brazoDerecho: (botones & DERECHO) !== 0,
        pausa: false,
        senalar: (botones & SENALAR) !== 0,
        gesto: GESTOS[Math.floor(botones / GESTO) - 1] ?? null,
      },
    });
  }
  return salida;
}

// ── Fotos ───────────────────────────────────────────────────────────────────────────────────────────────────

export function escribirFoto(foto: Foto, origen: Vector = { x: 0, y: 0, z: 0 }): ArrayBuffer {
  const cuerpos = foto.posiciones.length / 3;
  if (cuerpos > 255) throw new RangeError(`Demasiados cuerpos para una foto: ${cuerpos}`);
  const buffer = new ArrayBuffer(bytesDeFoto(cuerpos));
  const vista = new DataView(buffer);
  vista.setUint8(0, TIPO_FOTO);
  vista.setUint32(1, foto.paso >>> 0);
  vista.setUint32(5, foto.ack >>> 0);
  vista.setUint8(9, NUMERO_DE_ESTADO[foto.estados[0]] | (NUMERO_DE_ESTADO[foto.estados[1]] << 3));
  vista.setUint8(10, foto.agarres & 0xf);
  vista.setInt16(11, entero16(envolver(foto.rumbos[0]) * ESCALA_RUMBO));
  vista.setInt16(13, entero16(envolver(foto.rumbos[1]) * ESCALA_RUMBO));
  let o = 15;
  for (const v of foto.velocidades) {
    for (const c of [v.x, v.y, v.z]) {
      vista.setInt16(o, entero16(c * ESCALA_VELOCIDAD));
      o += 2;
    }
  }
  vista.setUint8(o++, cuerpos);
  const { posiciones: p, rotaciones: r } = foto;
  for (let i = 0; i < cuerpos; i++) {
    vista.setInt16(o, entero16(((p[3 * i] ?? 0) - origen.x) * ESCALA_POSICION));
    vista.setInt16(o + 2, entero16(((p[3 * i + 1] ?? 0) - origen.y) * ESCALA_POSICION));
    vista.setInt16(o + 4, entero16(((p[3 * i + 2] ?? 0) - origen.z) * ESCALA_POSICION));
    vista.setUint32(o + 6, comprimirCuaternion(r[4 * i] ?? 0, r[4 * i + 1] ?? 0, r[4 * i + 2] ?? 0, r[4 * i + 3] ?? 1));
    o += 10;
  }
  return buffer;
}

/** Paquete → foto. `null` si no es una foto o está cortada. */
export function leerFoto(datos: ArrayBuffer, origen: Vector = { x: 0, y: 0, z: 0 }): Foto | null {
  if (datos.byteLength < 28) return null;
  const vista = new DataView(datos);
  if (vista.getUint8(0) !== TIPO_FOTO) return null;
  const cuerpos = vista.getUint8(27);
  if (datos.byteLength !== bytesDeFoto(cuerpos)) return null;
  const estados = vista.getUint8(9);
  const velocidad = (o: number): Vector => ({
    x: vista.getInt16(o) / ESCALA_VELOCIDAD,
    y: vista.getInt16(o + 2) / ESCALA_VELOCIDAD,
    z: vista.getInt16(o + 4) / ESCALA_VELOCIDAD,
  });
  const posiciones = new Float32Array(3 * cuerpos);
  const rotaciones = new Float32Array(4 * cuerpos);
  let o = 28;
  for (let i = 0; i < cuerpos; i++) {
    posiciones[3 * i] = vista.getInt16(o) / ESCALA_POSICION + origen.x;
    posiciones[3 * i + 1] = vista.getInt16(o + 2) / ESCALA_POSICION + origen.y;
    posiciones[3 * i + 2] = vista.getInt16(o + 4) / ESCALA_POSICION + origen.z;
    descomprimirCuaternion(vista.getUint32(o + 6), rotaciones, 4 * i);
    o += 10;
  }
  return {
    paso: vista.getUint32(1),
    ack: vista.getUint32(5),
    estados: [ESTADOS[estados & 7] ?? "de pie", ESTADOS[(estados >> 3) & 7] ?? "de pie"],
    agarres: vista.getUint8(10) & 0xf,
    rumbos: [vista.getInt16(11) / ESCALA_RUMBO, vista.getInt16(13) / ESCALA_RUMBO],
    velocidades: [velocidad(15), velocidad(21)],
    posiciones,
    rotaciones,
  };
}
