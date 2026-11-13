// La cámara de los dos (TU-09): encuadra a los dos jugadores con una sola cámara mientras entran y, si se separan
// demasiado, parte la pantalla con un corte de Voronoi (ver `encuadre.ts`). Las cuentas van a paso fijo en
// `seguir` y el dibujo interpola entre el paso anterior y el actual en `dibujar`, como los muñecos.
//
//   const camara = crearCamaraDeDos({ direccion });
//   pasar():       camara.seguir(pelvisDel1, pelvisDel2)
//   dibujar(alfa): camara.dibujar(alfa)
//   crearImagen(pintor, escena, camara.camara, { vistas: camara.vistas })
//
// Con los dos juntos mira al punto medio y se aleja con la separación, un poco adelantada hacia donde caminan. Al
// partirse, cada cámara mira a su jugador corrido hacia el otro; justo en el umbral las dos miran al mismo punto,
// así que la segunda vista aparece y se va sin saltos, y la costura se funde de a poco.
//
// La mira sigue la altura de las pelvis (más despacio que a lo ancho, para que un salto no la sacuda): arriba de un
// escalón la cámara sube con ellos. Y si algo sólido queda entre un jugador y la cámara (`despejado`, un rayo en el
// mundo de físicas), la cámara se acerca rápido hasta tenerlo a la vista y vuelve suave cuando se despeja.
import * as THREE from "three";
import type { VistasPartidas } from "../imagen/post";
import { PASO } from "../motor/bucle";
import { decidirPartida, ENCUADRE, type Encuadre, encuadrar, normalDeCorte, type OpcionesEncuadre } from "./encuadre";

export interface OpcionesCamaraDeDos {
  /** Hacia dónde queda la cámara desde lo que mira (se normaliza). */
  direccion: THREE.Vector3;
  /** Cuánto más arriba de las pelvis mira (m). */
  sobreLaPelvis?: number;
  /** Qué tan rápido sigue (1/s). */
  seguir?: number;
  /** Qué tan rápido sigue la altura (1/s): más lento que `seguir`, así los saltos no la sacuden. */
  subir?: number;
  /** Cuánto queda libre desde `desde` hacia `hacia` (normalizado), hasta `largo` metros: `largo` si no hay nada
   * sólido. Sin esto la cámara no mira si algo tapa (ver `despejadoEnElMundo`). */
  despejado?: (desde: Punto, hacia: Punto, largo: number) => number;
  /** Qué tan rápido se acerca cuando algo tapa (1/s). */
  acercar?: number;
  /** Qué tan rápido aparece y se va la costura (1/s). */
  fundir?: number;
  /** Cuánto se adelanta la mira hacia donde caminan: segundos de camino y tope en metros. */
  adelanto?: { segundos: number; maximo: number };
  encuadre?: Partial<OpcionesEncuadre>;
}

/** Algo con posición (una pelvis de Rapier, un vector). */
export interface Punto {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CamaraDeDos {
  /** La cámara principal: la única sin partir, la del jugador 1 partida. */
  readonly camara: THREE.PerspectiveCamera;
  /** Lo que lee `crearImagen` para partir la pantalla. */
  readonly vistas: VistasPartidas & { readonly camaraB: THREE.PerspectiveCamera };
  /** Distancia de la cámara a lo que mira en el último dibujo (para correr la niebla). */
  readonly distancia: number;
  /** Si la pantalla está partida ahora (con histéresis). */
  readonly partida: boolean;
  /** Un paso de físicas: dónde están los dos jugadores. */
  seguir(a: Punto, b: Punto): void;
  /** Ubica las cámaras interpolando entre el paso anterior y el actual. */
  dibujar(alfa: number): void;
}

/** El estado de la cámara en un paso: lo que se interpola al dibujar. */
interface Toma {
  miraA: THREE.Vector3;
  miraB: THREE.Vector3;
  distancia: number;
  costura: number;
  normal: { x: number; y: number };
}

const crearToma = (): Toma => ({
  miraA: new THREE.Vector3(),
  miraB: new THREE.Vector3(),
  distancia: 0,
  costura: 0,
  normal: { x: 1, y: 0 },
});

function copiarToma(de: Toma, a: Toma) {
  a.miraA.copy(de.miraA);
  a.miraB.copy(de.miraB);
  a.distancia = de.distancia;
  a.costura = de.costura;
  a.normal.x = de.normal.x;
  a.normal.y = de.normal.y;
}

/** Desde dónde sale el rayo que mira si algo tapa: tanto más arriba de la pelvis (el pecho). */
const PECHO = 0.3;
/** Cuánto antes de lo sólido queda la cámara (que el plano cercano no lo corte). */
const MARGEN_DE_PARED = 0.35;
/** Lo más cerca que llega la cámara aunque algo tape. */
const DISTANCIA_MINIMA = 1.6;

export function crearCamaraDeDos(opciones: OpcionesCamaraDeDos): CamaraDeDos {
  const o: OpcionesEncuadre = { ...ENCUADRE, ...opciones.encuadre };
  const direccion = opciones.direccion.clone().normalize();
  const sobreLaPelvis = opciones.sobreLaPelvis ?? 0.05;
  const suavizado = 1 - Math.exp(-(opciones.seguir ?? 2.5) * PASO);
  const subida = 1 - Math.exp(-(opciones.subir ?? 1.6) * PASO);
  const acercamiento = 1 - Math.exp(-(opciones.acercar ?? 8) * PASO);
  const despejado = opciones.despejado;
  const fundido = 1 - Math.exp(-(opciones.fundir ?? 5) * PASO);
  // El seguimiento suave se atrasa `velocidad / seguir`: el adelanto suma ese atraso para quedar de verdad adelante
  const adelanto = opciones.adelanto ?? { segundos: 0.4 + 1 / (opciones.seguir ?? 2.5), maximo: 1.5 };

  const camara = new THREE.PerspectiveCamera(o.fov, 16 / 9, 0.1, 140);
  const camaraB = camara.clone();

  // Los ejes de la pantalla en el mundo: la dirección de la cámara es fija, así que se calculan una sola vez
  const derecha = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direccion).normalize();
  const arriba = new THREE.Vector3().crossVectors(direccion, derecha).normalize();

  const antes = crearToma();
  const ahora = crearToma();
  const encuadre: Encuadre = { distancia: o.cerca, radio: 0, hondura: 0, necesaria: o.cerca };
  const normal = { x: 1, y: 0 };
  let partida = false;
  let primero = true;

  // Lo de cada paso, sin crear objetos
  const previoA = new THREE.Vector3();
  const previoB = new THREE.Vector3();
  const adelantoA = new THREE.Vector3();
  const adelantoB = new THREE.Vector3();
  const adelantoMedio = new THREE.Vector3();
  const entre = new THREE.Vector3();
  const plano = new THREE.Vector3();
  const medio = new THREE.Vector3();
  const metaA = new THREE.Vector3();
  const metaB = new THREE.Vector3();
  const mira = new THREE.Vector3();

  const adelantar = (actual: Punto, previo: THREE.Vector3, salida: THREE.Vector3) => {
    salida.set(actual.x - previo.x, 0, actual.z - previo.z).multiplyScalar(adelanto.segundos / PASO);
    if (salida.length() > adelanto.maximo) salida.setLength(adelanto.maximo);
    previo.set(actual.x, 0, actual.z);
  };

  const vistas = {
    partida: false,
    camaraB,
    normal: { x: 1, y: 0 },
    costura: 0,
  };
  let distancia = o.cerca;

  const ubicarMira = (j: Punto, signo: 1 | -1, propio: THREE.Vector3, meta: THREE.Vector3) => {
    meta.set(j.x, j.y, j.z);
    const hondo = mira.copy(meta).sub(medio).dot(direccion);
    meta.addScaledVector(direccion, -hondo * (1 - encuadre.hondura));
    meta.addScaledVector(plano, signo * encuadre.radio);
    meta.add(mira.copy(adelantoMedio).lerp(propio, encuadre.hondura));
    meta.y += sobreLaPelvis;
  };

  /** Hasta qué distancia puede ir la cámara que mira a `haciaMira` sin que lo sólido tape al jugador `j`. El rayo
   * sale del pecho del jugador hacia donde queda la cámara (la dirección es la misma para todo): lo que encuentra a
   * `libre` metros tapa si la cámara queda más allá, y la cámara queda `hondo + d` metros del jugador a lo largo
   * del rayo. */
  const desde = new THREE.Vector3();
  const distanciaLibre = (j: Punto, haciaMira: THREE.Vector3, deseada: number) => {
    if (!despejado) return deseada;
    desde.set(j.x, j.y + PECHO, j.z);
    const hondo = mira.copy(haciaMira).sub(desde).dot(direccion);
    const largo = deseada + hondo + MARGEN_DE_PARED;
    if (largo <= 0) return deseada;
    const libre = despejado(desde, direccion, largo);
    return libre >= largo ? deseada : libre - hondo - MARGEN_DE_PARED;
  };

  const ubicar = (c: THREE.PerspectiveCamera, haciaMira: THREE.Vector3, d: number) => {
    c.position.copy(haciaMira).addScaledVector(direccion, d);
    c.lookAt(haciaMira);
  };

  const seguirMira = (actual: THREE.Vector3, meta: THREE.Vector3) => {
    actual.x += (meta.x - actual.x) * suavizado;
    actual.z += (meta.z - actual.z) * suavizado;
    actual.y += (meta.y - actual.y) * subida;
  };

  /** La distancia `deseada`, o menos si lo sólido taparía a alguno (cada uno con la mira de su cámara). */
  const acercarSiTapa = (a: Punto, b: Punto, deseada: number) => {
    const libre = Math.min(
      distanciaLibre(a, primero ? metaA : ahora.miraA, deseada),
      distanciaLibre(b, primero ? metaB : ahora.miraB, deseada),
    );
    return Math.min(deseada, Math.max(DISTANCIA_MINIMA, libre));
  };

  return {
    camara,
    vistas,
    get distancia() {
      return distancia;
    },
    get partida() {
      return partida;
    },
    seguir(a, b) {
      if (primero) {
        previoA.set(a.x, 0, a.z);
        previoB.set(b.x, 0, b.z);
      }
      adelantar(a, previoA, adelantoA);
      adelantar(b, previoB, adelantoB);
      adelantoMedio.addVectors(adelantoA, adelantoB).multiplyScalar(0.5);

      // La separación sobre los ejes de la cámara: derecha, arriba y hacia la cámara
      // (la altura cuenta: uno arriba de un escalón y otro abajo también tienen que entrar)
      entre.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const dx = entre.dot(derecha);
      const dy = entre.dot(arriba);
      encuadrar(dx, dy, entre.dot(direccion), camara.aspect, encuadre, o);
      partida = decidirPartida(partida, encuadre.necesaria, o);
      normalDeCorte(dx, dy, normal);
      // Hacia el otro sobre el plano de la cámara (no sobre el suelo: correrse a lo hondo acercaría o alejaría al
      // jugador de la cámara y la perspectiva lo sacaría de su lugar)
      plano.copy(derecha).multiplyScalar(normal.x).addScaledVector(arriba, normal.y);

      // Cada mira: su jugador corrido hacia el otro, más el adelanto. Lo hondo de cada mira va del plano del punto
      // medio (en el umbral, así las dos coinciden) al de su propio jugador (bien partida, así queda donde debe).
      // Mientras no está bien partida el adelanto es el de los dos juntos, por lo mismo.
      medio.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      ubicarMira(a, 1, adelantoA, metaA);
      ubicarMira(b, -1, adelantoB, metaB);

      if (primero) {
        ahora.miraA.copy(metaA);
        ahora.miraB.copy(metaB);
        ahora.distancia = acercarSiTapa(a, b, encuadre.distancia);
        ahora.costura = partida ? 1 : 0;
        ahora.normal.x = normal.x;
        ahora.normal.y = normal.y;
        copiarToma(ahora, antes);
        primero = false;
        return;
      }
      copiarToma(ahora, antes);
      seguirMira(ahora.miraA, metaA);
      seguirMira(ahora.miraB, metaB);
      // Si algo tapa se acerca rápido; al despejarse vuelve con el seguimiento de siempre
      const meta = acercarSiTapa(a, b, encuadre.distancia);
      ahora.distancia += (meta - ahora.distancia) * (meta < ahora.distancia ? acercamiento : suavizado);
      ahora.costura += ((partida ? 1 : 0) - ahora.costura) * fundido;
      ahora.normal.x = normal.x;
      ahora.normal.y = normal.y;
    },
    dibujar(alfa) {
      distancia = antes.distancia + (ahora.distancia - antes.distancia) * alfa;
      mira.lerpVectors(antes.miraA, ahora.miraA, alfa);
      ubicar(camara, mira, distancia);
      metaB.lerpVectors(antes.miraB, ahora.miraB, alfa);
      ubicar(camaraB, metaB, distancia);
      if (camaraB.aspect !== camara.aspect) {
        camaraB.aspect = camara.aspect;
        camaraB.updateProjectionMatrix();
      }

      const costura = antes.costura + (ahora.costura - antes.costura) * alfa;
      // La segunda vista se dibuja mientras se vea la costura o las dos miras no coincidan: así juntar no salta
      vistas.partida = costura > 0.002 || mira.distanceToSquared(metaB) > 1e-4;
      vistas.costura = costura * costura * (3 - 2 * costura);
      normalDeCorte(
        antes.normal.x + (ahora.normal.x - antes.normal.x) * alfa,
        antes.normal.y + (ahora.normal.y - antes.normal.y) * alfa,
        vistas.normal,
      );
    },
  };
}
