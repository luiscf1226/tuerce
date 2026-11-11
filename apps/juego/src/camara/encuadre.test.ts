// Las cuentas de la cámara de los dos: distancia según la separación, cuándo se parte (con histéresis) y por dónde
// pasa el corte.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  decidirPartida,
  distanciaDeEncuadre,
  ENCUADRE,
  type Encuadre,
  encuadrar,
  normalDeCorte,
  type Rectangulo,
  recorteDelLado,
} from "./encuadre";

const ANCHA = 16 / 9;
const nuevo = (): Encuadre => ({ distancia: 0, radio: 0, hondura: 0, necesaria: 0 });

describe("distancia del encuadre", () => {
  it("con los dos juntos es la distancia de cerca", () => {
    expect(distanciaDeEncuadre(0, 0, 0, ANCHA)).toBeCloseTo(ENCUADRE.cerca);
  });

  it("crece con la separación, sin saltos", () => {
    let antes = distanciaDeEncuadre(0, 0, 0, ANCHA);
    for (let s = 0.25; s <= 20; s += 0.25) {
      const d = distanciaDeEncuadre(s, 0, 0, ANCHA);
      expect(d).toBeGreaterThan(antes);
      expect(d - antes).toBeLessThan(0.5);
      antes = d;
    }
    // y lejos crece lineal: el doble de separación, casi el doble de distancia
    expect(distanciaDeEncuadre(40, 0, 0, ANCHA) / distanciaDeEncuadre(20, 0, 0, ANCHA)).toBeCloseTo(2, 1);
  });

  it("cuenta la relación de aspecto: en pantalla angosta, separados de costado piden más distancia", () => {
    expect(distanciaDeEncuadre(6, 0, 0, 3 / 4)).toBeGreaterThan(distanciaDeEncuadre(6, 0, 0, ANCHA) + 2);
    // a lo alto da lo mismo el ancho de la pantalla
    expect(distanciaDeEncuadre(0, 6, 0, 3 / 4)).toBeCloseTo(distanciaDeEncuadre(0, 6, 0, ANCHA));
  });

  it("cuenta la perspectiva: si uno queda más cerca de la cámara, hace falta alejarse más", () => {
    expect(distanciaDeEncuadre(0, 3, 8, ANCHA)).toBeGreaterThan(distanciaDeEncuadre(0, 3, 0, ANCHA) + 3);
    // el más cercano queda a `ocupar` de media pantalla, medido a su propia hondura
    const t = Math.tan((ENCUADRE.fov * Math.PI) / 360);
    const d = distanciaDeEncuadre(0, 6, 10, ANCHA);
    expect(3 / ((d - 5) * t)).toBeLessThanOrEqual(ENCUADRE.ocupar + 1e-9);
  });

  it("en pantalla ancha cabe más separación de costado que a lo alto", () => {
    expect(distanciaDeEncuadre(6, 0, 0, ANCHA)).toBeLessThan(distanciaDeEncuadre(0, 6, 0, ANCHA));
  });

  it("en el umbral cada jugador queda a `ocupar` de media pantalla", () => {
    // separados de costado justo para llegar a la máxima
    const t = Math.tan((ENCUADRE.fov * Math.PI) / 360);
    const lineal = Math.sqrt(ENCUADRE.maxima ** 2 - ENCUADRE.cerca ** 2);
    const separacion = 2 * lineal * t * ENCUADRE.ocupar * ANCHA;
    const d = distanciaDeEncuadre(separacion, 0, 0, ANCHA);
    expect(d).toBeCloseTo(ENCUADRE.maxima);
    const mediaPantalla = d * t * ANCHA;
    expect(separacion / 2 / mediaPantalla).toBeCloseTo(ENCUADRE.ocupar, 1);
  });
});

describe("partir la pantalla", () => {
  const { maxima, juntar } = ENCUADRE;

  it("parte al pasar la distancia máxima", () => {
    expect(decidirPartida(false, maxima - 0.01)).toBe(false);
    expect(decidirPartida(false, maxima + 0.01)).toBe(true);
  });

  it("junta recién bastante más cerca (histéresis): no titila en el borde", () => {
    expect(decidirPartida(true, maxima - 0.01)).toBe(true);
    expect(decidirPartida(true, maxima * juntar + 0.01)).toBe(true);
    expect(decidirPartida(true, maxima * juntar - 0.01)).toBe(false);
  });

  it("yendo y viniendo alrededor del umbral cambia una sola vez", () => {
    let partida = false;
    let cambios = 0;
    for (let i = 0; i < 200; i++) {
      const d = maxima + Math.sin(i * 0.7) * 0.4; // ruido de ±0.4 m alrededor del umbral
      const nueva = decidirPartida(partida, d);
      if (nueva !== partida) cambios++;
      partida = nueva;
    }
    expect(cambios).toBe(1);
    expect(partida).toBe(true);
  });

  it("hasta el umbral las dos cámaras miran al punto medio y después cada una se queda en su jugador", () => {
    const e = nuevo();
    encuadrar(4, 0, 0, ANCHA, e);
    expect(e.radio).toBeCloseTo(2);
    expect(e.hondura).toBe(0);

    // el radio sigue la separación sin saltos al cruzar el umbral, y después deja de crecer
    let radioAntes = 0;
    let distanciaAntes = ENCUADRE.cerca;
    for (let s = 0.1; s < 30; s += 0.1) {
      encuadrar(s, 0, 0, ANCHA, e);
      expect(Math.abs(e.radio - radioAntes)).toBeLessThan(0.1);
      expect(Math.abs(e.distancia - distanciaAntes)).toBeLessThan(0.3);
      radioAntes = e.radio;
      distanciaAntes = e.distancia;
    }
    expect(e.hondura).toBe(1);
    expect(e.distancia).toBeCloseTo(ENCUADRE.partida);
    expect(e.radio).toBeLessThan(5);
  });

  it("partida del todo, cada jugador sigue en el mismo lugar de la pantalla que en el umbral", () => {
    const t = Math.tan((ENCUADRE.fov * Math.PI) / 360);
    // el jugador queda a `radio` del centro de su cámara: en pantalla, esta fracción de media pantalla
    const enPantalla = (e: Encuadre) => e.radio / (e.distancia * t * ANCHA);
    const umbral = 2 * Math.sqrt(ENCUADRE.maxima ** 2 - ENCUADRE.cerca ** 2) * t * ENCUADRE.ocupar * ANCHA;
    const enUmbral = enPantalla(encuadrar(umbral, 0, 0, ANCHA, nuevo()));
    const lejos = enPantalla(encuadrar(30, 0, 0, ANCHA, nuevo()));
    expect(lejos).toBeCloseTo(enUmbral, 3);
    // cerca del medio de su mitad
    expect(lejos).toBeGreaterThan(0.4);
    expect(lejos).toBeLessThan(0.6);
  });
});

describe("la línea del corte", () => {
  const n = { x: 0, y: 0 };

  it("de costado en pantalla, el corte es vertical", () => {
    normalDeCorte(5, 0, n);
    expect(n).toEqual({ x: 1, y: 0 });
    normalDeCorte(-5, 0.1, n);
    expect(n.x).toBeCloseTo(-1, 2);
  });

  it("uno detrás del otro, el corte es horizontal", () => {
    normalDeCorte(0, 3, n);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
  });

  it("en diagonal, perpendicular a la recta entre los dos", () => {
    normalDeCorte(2, 2, n);
    const linea = { x: -n.y, y: n.x };
    expect(linea.x * 2 + linea.y * 2).toBeCloseTo(0);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1);
  });

  it("con la cámara de la escena dos: separados por x se corta casi vertical, por z casi horizontal", () => {
    const direccion = new THREE.Vector3(0.45, 0.32, 1).normalize();
    const derecha = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direccion).normalize();
    const arriba = new THREE.Vector3().crossVectors(direccion, derecha).normalize();
    const corte = (v: THREE.Vector3) => normalDeCorte(v.dot(derecha), v.dot(arriba), { x: 0, y: 0 });
    const deCostado = corte(new THREE.Vector3(6, 0, 0));
    expect(Math.abs(deCostado.x)).toBeGreaterThan(0.9);
    expect(deCostado.x).toBeGreaterThan(0); // el 2 (a la derecha) va del lado positivo
    const alFondo = corte(new THREE.Vector3(0, 0, -6));
    expect(alFondo.y).toBeGreaterThan(0.5); // el que se va al fondo queda arriba
  });

  it("los dos lados juntos cubren toda la pantalla, y cada uno no mucho más que su mitad", () => {
    const r: Rectangulo = { x: 0, y: 0, ancho: 0, alto: 0 };
    recorteDelLado({ x: 1, y: 0 }, 1, 1280, 720, 4, r);
    expect(r).toEqual({ x: 636, y: 0, ancho: 644, alto: 720 });
    recorteDelLado({ x: 1, y: 0 }, -1, 1280, 720, 4, r);
    expect(r).toEqual({ x: 0, y: 0, ancho: 644, alto: 720 });
    recorteDelLado({ x: 0, y: 1 }, -1, 1280, 720, 0, r);
    expect(r).toEqual({ x: 0, y: 0, ancho: 1280, alto: 360 });
    // en diagonal cada lado es un triángulo o un trapecio: su rectángulo puede ser la pantalla entera
    const d = Math.SQRT1_2;
    recorteDelLado({ x: d, y: d }, 1, 1280, 720, 0, r);
    expect(r.x).toBeGreaterThan(0);
    expect(r.ancho + r.x).toBe(1280);
    expect(r.alto + r.y).toBe(720);
  });
});
