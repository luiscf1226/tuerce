// Las cuentas de la cámara de los dos (TU-09), sin Three.js: qué tan lejos va la cámara, cuándo se parte la
// pantalla y por dónde pasa el corte. Las usa `camara.ts`; las pruebas están en `encuadre.test.ts`.
//
// Todo se mide con los ejes de la cámara: `dx` es cuánto se separan los dos a lo ancho de la pantalla, `dy` a lo
// alto y `dz` a lo hondo (en metros, proyectando la separación sobre los ejes derecha, arriba y hacia la cámara).
// Así la relación de aspecto cuenta (en una pantalla ancha cabe más separación de costado que de frente) y también
// la perspectiva: el que queda más cerca de la cámara se ve más lejos del centro.
//
// La pantalla partida es un corte de Voronoi, como en los juegos de Lego: una sola línea por el centro de la
// pantalla, perpendicular a la recta entre los dos jugadores tal como se ven. Cada cámara mira a su jugador corrido
// hacia el otro, sobre el plano de la cámara, una distancia (`radio`) que justo en el umbral es la mitad de la
// separación: ahí las dos cámaras miran al mismo punto medio y ven exactamente lo mismo, así que partir y juntar no
// saltan nunca.

export interface OpcionesEncuadre {
  /** Ángulo vertical de la cámara, en grados. */
  fov: number;
  /** Distancia de la cámara con los dos juntos. */
  cerca: number;
  /** La distancia más lejana con una sola cámara: si hace falta más, la pantalla se parte. */
  maxima: number;
  /** Distancia de cada cámara con la pantalla ya del todo partida (más cerca: cada uno tiene media pantalla). */
  partida: number;
  /** Hasta qué parte de media pantalla llega cada jugador al encuadrarlos (0.5: a mitad de camino del borde). Con
   * la pantalla partida quedan ahí mismo, en el medio de su mitad. */
  ocupar: number;
  /** Histéresis: partida, se junta recién cuando la distancia necesaria baja de `maxima * juntar`. */
  juntar: number;
  /** Cuánto más allá de la máxima (relativo: 0.3 es un 30 % más) tarda en acercarse a la distancia `partida`. */
  transicion: number;
}

export const ENCUADRE: OpcionesEncuadre = {
  fov: 40,
  cerca: 4.2,
  maxima: 10,
  partida: 7.5,
  ocupar: 0.5,
  juntar: 0.88,
  transicion: 0.35,
};

/** La distancia que hace falta para que los dos entren en pantalla a `ocupar` de media pantalla del centro,
 * contando con que el más cercano está `|dz|/2` más cerca de la cámara que el punto medio. Con los dos juntos es
 * `cerca` y crece suave, sin quiebre, con la separación. Sin tope: si pasa de `maxima`, se parte. */
export function distanciaDeEncuadre(
  dx: number,
  dy: number,
  dz: number,
  aspecto: number,
  o: OpcionesEncuadre = ENCUADRE,
): number {
  const t = Math.tan((o.fov * Math.PI) / 360) * o.ocupar;
  const necesaria = Math.max(Math.abs(dx) / (2 * t * aspecto), Math.abs(dy) / (2 * t)) + Math.abs(dz) / 2;
  return Math.hypot(o.cerca, necesaria);
}

/** Si la pantalla queda partida, según cómo estaba y la distancia que haría falta para una sola cámara. Parte al
 * pasar de `maxima` y junta por debajo de `maxima * juntar`: entre medio sigue como estaba, así no titila. */
export function decidirPartida(partida: boolean, distancia: number, o: OpcionesEncuadre = ENCUADRE): boolean {
  return partida ? distancia >= o.maxima * o.juntar : distancia > o.maxima;
}

/** Qué tan metida está la pantalla partida: 0 hasta el umbral y 1 cuando la distancia necesaria pasa la máxima por
 * `transicion`. Suave en los dos extremos. */
export function honduraDePartida(distancia: number, o: OpcionesEncuadre = ENCUADRE): number {
  const x = Math.min(1, Math.max(0, (distancia / o.maxima - 1) / o.transicion));
  return x * x * (3 - 2 * x);
}

export interface Encuadre {
  /** Distancia de la cámara (o de cada cámara, si está partida) a lo que mira. */
  distancia: number;
  /** Cuánto se corre la mira de cada jugador hacia el otro, en metros sobre el plano de la cámara. Con una sola
   * cámara es la mitad de la separación: las dos miran al punto medio. */
  radio: number;
  /** De 0 a 1, ver `honduraDePartida`. */
  hondura: number;
  /** La distancia que haría falta con una sola cámara (para `decidirPartida`). */
  necesaria: number;
}

/**
 * Encuadra a dos jugadores separados `dx` a lo ancho, `dy` a lo alto y `dz` a lo hondo de la cámara. El radio va
 * sobre el plano de la cámara (`dx`, `dy`). Escribe en `salida` (no crea objetos: corre en cada paso).
 *
 * Hasta el umbral: una cámara, mira al punto medio, se aleja con la separación. Pasado el umbral la distancia se
 * acerca de a poco a `partida` y el radio queda en el de la separación del umbral, escalado con la distancia, así
 * cada jugador sigue en el mismo lugar de la pantalla: a `ocupar` de media pantalla, en el medio de su mitad.
 */
export function encuadrar(
  dx: number,
  dy: number,
  dz: number,
  aspecto: number,
  salida: Encuadre,
  o: OpcionesEncuadre = ENCUADRE,
): Encuadre {
  const separacion = Math.hypot(dx, dy);
  const necesaria = distanciaDeEncuadre(dx, dy, dz, aspecto, o);
  salida.necesaria = necesaria;
  if (necesaria <= o.maxima) {
    salida.distancia = necesaria;
    salida.radio = separacion / 2;
    salida.hondura = 0;
    return salida;
  }
  // La parte de la distancia que crece con la separación es lineal en ella: en el umbral valía √(máx² − cerca²)
  const lineal = Math.sqrt(Math.max(necesaria * necesaria - o.cerca * o.cerca, 1e-9));
  const enUmbral = (separacion * Math.sqrt(o.maxima * o.maxima - o.cerca * o.cerca)) / lineal;
  const hondura = honduraDePartida(necesaria, o);
  salida.hondura = hondura;
  salida.distancia = o.maxima + (o.partida - o.maxima) * hondura;
  salida.radio = ((enUmbral / 2) * salida.distancia) / o.maxima;
  return salida;
}

/** La normal del corte en pantalla (con y hacia arriba, en píxeles cuadrados): apunta del jugador 1 al 2 tal como
 * se ven, así que la línea queda perpendicular a la recta entre los dos. El jugador 2 va del lado positivo. */
export function normalDeCorte(dx: number, dy: number, salida: { x: number; y: number }): { x: number; y: number } {
  const largo = Math.hypot(dx, dy);
  salida.x = largo < 1e-9 ? 1 : dx / largo;
  salida.y = largo < 1e-9 ? 0 : dy / largo;
  return salida;
}

export interface Rectangulo {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * El rectángulo más chico (en píxeles, origen abajo a la izquierda) que cubre el lado `lado` del corte dentro de
 * una imagen de `ancho` × `alto`: cada cámara dibuja solo ahí (scissor). `margen` píxeles de más del otro lado,
 * para la costura. El corte pasa por el centro con normal `n`; el lado 1 es hacia donde apunta `n`.
 */
export function recorteDelLado(
  n: { x: number; y: number },
  lado: 1 | -1,
  ancho: number,
  alto: number,
  margen: number,
  salida: Rectangulo,
): Rectangulo {
  const cx = ancho / 2;
  const cy = alto / 2;
  const nx = n.x * lado;
  const ny = n.y * lado;
  // Qué tan adentro del lado está un punto (positivo: adentro)
  const valor = (x: number, y: number) => (x - cx) * nx + (y - cy) * ny + margen;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const sumar = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  // Recorre los cuatro bordes: suma las esquinas de adentro y donde la línea corta cada borde
  for (let i = 0; i < 4; i++) {
    const ax = i === 1 || i === 2 ? ancho : 0;
    const ay = i >= 2 ? alto : 0;
    const bx = i === 0 || i === 1 ? ancho : 0;
    const by = i === 1 || i === 2 ? alto : 0;
    const va = valor(ax, ay);
    const vb = valor(bx, by);
    if (va >= 0) sumar(ax, ay);
    if (va >= 0 !== vb >= 0) {
      const t = va / (va - vb);
      sumar(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  if (minX > maxX) {
    salida.x = salida.y = salida.ancho = salida.alto = 0;
    return salida;
  }
  salida.x = Math.max(0, Math.floor(minX));
  salida.y = Math.max(0, Math.floor(minY));
  salida.ancho = Math.min(ancho, Math.ceil(maxX)) - salida.x;
  salida.alto = Math.min(alto, Math.ceil(maxY)) - salida.y;
  return salida;
}
