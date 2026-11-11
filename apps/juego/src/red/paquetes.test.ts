// Los paquetes de la partida en línea: ida y vuelta de fotos y entradas, y el error de comprimir rotaciones.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { entradaQuieta } from "../entrada/mandos";
import { crearAzar } from "../imagen/ruido";
import {
  bytesDeFoto,
  comprimirCuaternion,
  descomprimirCuaternion,
  type EntradaNumerada,
  escribirEntradas,
  escribirFoto,
  type Foto,
  leerEntradas,
  leerFoto,
  REDUNDANCIA,
} from "./paquetes";

const azar = crearAzar(3);
const cuaternionAlAzar = () =>
  new THREE.Quaternion(azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1, azar() * 2 - 1).normalize();

describe("cuaterniones «los tres más chicos»", () => {
  it("vuelven con error de componente menor a 0,01 y casi sin ángulo de diferencia", () => {
    let peorComponente = 0;
    let peorAngulo = 0;
    const salida = [0, 0, 0, 0];
    for (let i = 0; i < 5000; i++) {
      const q = cuaternionAlAzar();
      descomprimirCuaternion(comprimirCuaternion(q.x, q.y, q.z, q.w), salida);
      const [x = 0, y = 0, z = 0, w = 0] = salida;
      const vuelta = new THREE.Quaternion(x, y, z, w);
      // q y -q son la misma rotación: se compara con el signo que corresponda
      const signo = q.dot(vuelta) < 0 ? -1 : 1;
      peorComponente = Math.max(
        peorComponente,
        Math.abs(q.x - signo * x),
        Math.abs(q.y - signo * y),
        Math.abs(q.z - signo * z),
        Math.abs(q.w - signo * w),
      );
      peorAngulo = Math.max(peorAngulo, q.angleTo(vuelta));
    }
    expect(peorComponente).toBeLessThan(0.01);
    expect(peorComponente).toBeLessThan(0.002);
    expect(peorAngulo).toBeLessThan(0.005);
  });

  it("la identidad y los ejes vuelven exactos", () => {
    const salida = [0, 0, 0, 0];
    for (const q of [
      [0, 0, 0, 1],
      [1, 0, 0, 0],
      [0, -1, 0, 0],
    ] as const) {
      descomprimirCuaternion(comprimirCuaternion(q[0], q[1], q[2], q[3]), salida);
      const signo = Math.sign(q.find((c) => c !== 0) ?? 1);
      salida.forEach((c, i) => {
        expect(c * signo).toBeCloseTo(q[i] ?? 0, 3);
      });
    }
  });
});

describe("fotos", () => {
  const cuerpos = 21;
  const foto: Foto = {
    paso: 123_456,
    ack: 98_765,
    estados: ["trepando", "levantandose"],
    agarres: 0b1010,
    punto: 3,
    rumbos: [1.2, -3],
    velocidades: [
      { x: 1.5, y: -2, z: 0.25 },
      { x: 0, y: 3.2, z: -1 },
    ],
    posiciones: Float32Array.from({ length: cuerpos * 3 }, () => (azar() * 2 - 1) * 30),
    rotaciones: new Float32Array(cuerpos * 4),
  };
  for (let i = 0; i < cuerpos; i++) foto.rotaciones.set(cuaternionAlAzar().toArray(), 4 * i);

  it("van y vuelven: posiciones a 2 mm, rotaciones a 0,002 y todo lo demás igual", () => {
    const paquete = escribirFoto(foto);
    expect(paquete.byteLength).toBe(bytesDeFoto(cuerpos));
    expect(paquete.byteLength).toBe(239);
    const vuelta = leerFoto(paquete);
    expect(vuelta).not.toBeNull();
    if (!vuelta) return;
    expect(vuelta.paso).toBe(foto.paso);
    expect(vuelta.ack).toBe(foto.ack);
    expect(vuelta.estados).toEqual(foto.estados);
    expect(vuelta.agarres).toBe(foto.agarres);
    expect(vuelta.punto).toBe(3);
    expect(vuelta.rumbos[0]).toBeCloseTo(1.2, 3);
    expect(vuelta.rumbos[1]).toBeCloseTo(-3, 3);
    expect(vuelta.velocidades[0].x).toBeCloseTo(1.5, 2);
    expect(vuelta.velocidades[1].y).toBeCloseTo(3.2, 2);
    for (let i = 0; i < foto.posiciones.length; i++)
      expect(Math.abs((vuelta.posiciones[i] ?? 0) - (foto.posiciones[i] ?? 0))).toBeLessThan(0.002);
    for (let i = 0; i < cuerpos; i++) {
      const a = new THREE.Quaternion().fromArray(foto.rotaciones, 4 * i);
      const b = new THREE.Quaternion().fromArray(vuelta.rotaciones, 4 * i);
      expect(a.angleTo(b)).toBeLessThan(0.005);
    }
  });

  it("las posiciones se miden desde el origen de la escena", () => {
    const lejos = { ...foto, posiciones: Float32Array.from(foto.posiciones, (p) => p + 1000) };
    const origen = { x: 1000, y: 1000, z: 1000 };
    const vuelta = leerFoto(escribirFoto(lejos, origen), origen);
    expect(Math.abs((vuelta?.posiciones[0] ?? 0) - (lejos.posiciones[0] ?? 0))).toBeLessThan(0.002);
  });

  it("lo que no es una foto, o vino cortado, no se lee", () => {
    const paquete = escribirFoto(foto);
    expect(leerFoto(paquete.slice(0, 100))).toBeNull();
    expect(leerFoto(new ArrayBuffer(4))).toBeNull();
    expect(leerFoto(escribirEntradas([{ seq: 1, entrada: entradaQuieta() }]))).toBeNull();
  });
});

describe("entradas", () => {
  const historial: EntradaNumerada[] = [
    { seq: 9, entrada: { ...entradaQuieta(), avanzar: 1 } },
    { seq: 10, entrada: { ...entradaQuieta(), avanzar: 0.5, girar: -1, saltar: true, brazoDerecho: true } },
    { seq: 11, entrada: { ...entradaQuieta(), avanzar: -0.25, girar: 0.75, brazoIzquierdo: true, senalar: true } },
    { seq: 12, entrada: { ...entradaQuieta(), girar: 0.1, saltar: true, brazoIzquierdo: true, gesto: "encoger" } },
  ];

  it("cada paquete lleva las últimas 3, en 15 bytes", () => {
    const paquete = escribirEntradas(historial);
    expect(paquete.byteLength).toBe(6 + 3 * REDUNDANCIA);
    const vuelta = leerEntradas(paquete);
    expect(vuelta?.map((e) => e.seq)).toEqual([10, 11, 12]);
    for (const e of vuelta ?? []) {
      const original = historial.find((h) => h.seq === e.seq)?.entrada;
      expect(e.entrada.avanzar).toBeCloseTo(original?.avanzar ?? 9, 1);
      expect(e.entrada.girar).toBeCloseTo(original?.girar ?? 9, 1);
      expect(e.entrada.saltar).toBe(original?.saltar);
      expect(e.entrada.brazoIzquierdo).toBe(original?.brazoIzquierdo);
      expect(e.entrada.brazoDerecho).toBe(original?.brazoDerecho);
      expect(e.entrada.senalar).toBe(original?.senalar);
      expect(e.entrada.gesto).toBe(original?.gesto);
      expect(e.entrada.pausa).toBe(false);
    }
  });

  it("si se pierde un paquete, el siguiente trae lo que faltaba", () => {
    const recibidas = new Map<number, unknown>();
    for (let fin = 1; fin <= historial.length; fin++) {
      if (fin === 2 || fin === 3) continue; // se pierden dos seguidos
      for (const e of leerEntradas(escribirEntradas(historial.slice(0, fin))) ?? []) recibidas.set(e.seq, e);
    }
    expect([...recibidas.keys()].sort((a, b) => a - b)).toEqual([9, 10, 11, 12]);
  });

  it("al principio van las que hay", () => {
    const vuelta = leerEntradas(escribirEntradas(historial.slice(0, 1)));
    expect(vuelta?.map((e) => e.seq)).toEqual([9]);
    expect(leerEntradas(new ArrayBuffer(3))).toBeNull();
  });
});
