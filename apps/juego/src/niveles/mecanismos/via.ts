// Una vía (TU-27): tramos rectos de riel, uno detrás del otro, y a lo sumo un cambio de vía con su desvío. La
// recorren la dresina y el tren del nivel 5: dada la distancia andada desde el principio (`s`, en metros), dice dónde
// está y hacia dónde mira lo que va encima. Solo son cuentas: no arma cuerpos ni imagen.
//
// Lo que va por la vía mira hacia su +x (el frente de la dresina, la trompa de la locomotora). En las esquinas el
// rumbo se suaviza (mira hacia donde va a estar un poco más adelante), así no gira de golpe.
import * as THREE from "three";

export type Punto = readonly [number, number, number];

export interface PoseEnLaVia {
  readonly posicion: THREE.Vector3;
  readonly giro: THREE.Quaternion;
  /** La subida del tramo: el seno del ángulo con el piso (positivo si sube hacia adelante). */
  readonly pendiente: number;
}

export interface Via {
  /** El largo de la vía principal y el del desvío, contado desde el principio (m). */
  readonly largo: number;
  readonly largoDesvio: number;
  /** Dónde está el cambio (m desde el principio); sin desvío, al final de la principal. */
  readonly cambio: number;
  /** Dónde y cómo queda lo que va a `s` metros del principio, por la principal o por el desvío. */
  pose(s: number, desvio?: boolean): PoseEnLaVia;
}

/** Cuánto antes y después de un punto se mira para suavizar el rumbo en las esquinas (m). */
const SUAVIZAR = 0.7;
const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);

/** Una línea de tramos rectos: dónde queda el punto a `s` metros del primero, y la pendiente del tramo. */
function crearLinea(puntos: readonly Punto[]) {
  const p = puntos.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const desde: number[] = [0];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    desde.push((desde[i - 1] ?? 0) + (a && b ? a.distanceTo(b) : 0));
  }
  const largo = desde[desde.length - 1] ?? 0;
  /** El tramo donde cae `s` (sin salirse de la línea). */
  const tramo = (s: number) => {
    let i = 1;
    while (i < p.length - 1 && (desde[i] ?? 0) < s) i++;
    return i;
  };
  return {
    largo,
    punto(s: number, destino = new THREE.Vector3()) {
      const i = tramo(s);
      const a = p[i - 1] ?? new THREE.Vector3();
      const b = p[i] ?? a;
      const largoTramo = (desde[i] ?? 0) - (desde[i - 1] ?? 0);
      const t = largoTramo > 0 ? (s - (desde[i - 1] ?? 0)) / largoTramo : 0;
      return destino.lerpVectors(a, b, t);
    },
    pendiente(s: number) {
      const i = tramo(s);
      const a = p[i - 1] ?? new THREE.Vector3();
      const b = p[i] ?? a;
      const largoTramo = a.distanceTo(b);
      return largoTramo > 0 ? (b.y - a.y) / largoTramo : 0;
    },
  };
}

/**
 * Arma la vía. `principal` son los puntos de la vía, en orden; el desvío sale del punto `desvio.desde` de la principal
 * y sigue por sus `puntos`.
 */
export function crearVia(principal: readonly Punto[], desvio?: { desde: number; puntos: readonly Punto[] }): Via {
  if (principal.length < 2) throw new Error("una vía necesita por lo menos dos puntos");
  const recta = crearLinea(principal);
  const comun = desvio ? principal.slice(0, desvio.desde + 1) : principal;
  const cambio = desvio ? crearLinea(comun).largo : recta.largo;
  const torcida = desvio ? crearLinea([...comun, ...desvio.puntos]) : recta;
  const antes = new THREE.Vector3();
  const despues = new THREE.Vector3();
  const qGiro = new THREE.Quaternion();
  const qCabeceo = new THREE.Quaternion();
  return {
    largo: recta.largo,
    largoDesvio: torcida.largo,
    cambio,
    pose(s, porElDesvio = false) {
      const linea = porElDesvio ? torcida : recta;
      const t = Math.min(linea.largo, Math.max(0, s));
      const posicion = linea.punto(t);
      // El rumbo: hacia donde va a estar un poco más adelante, desde donde estaba un poco antes
      linea.punto(Math.max(0, t - SUAVIZAR), antes);
      linea.punto(Math.min(linea.largo, t + SUAVIZAR), despues);
      const d = despues.sub(antes);
      const horizontal = Math.hypot(d.x, d.z) || 1;
      // Girar +x hacia (dx, dz) es girar −atan2(dz, dx) alrededor de +y; el cabeceo sube el frente (alrededor de z)
      qGiro.setFromAxisAngle(ARRIBA, Math.atan2(-d.z, d.x));
      qCabeceo.setFromAxisAngle(EJE_Z, Math.atan2(d.y, horizontal));
      return { posicion, giro: qGiro.clone().multiply(qCabeceo), pendiente: linea.pendiente(t) };
    },
  };
}
