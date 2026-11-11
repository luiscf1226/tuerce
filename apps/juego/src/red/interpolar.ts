// El colchón de fotos del invitado (TU-21): guarda las fotos que llegan del anfitrión y dibuja el mundo un poco en
// el pasado, interpolando entre las dos fotos que rodean ese momento. Así una foto que llega tarde o que se pierde
// no se nota: casi siempre hay otra más nueva esperando.
//
// El reloj es el paso local del invitado (60 por segundo, igual que el del anfitrión). Por cada foto que llega se
// anota `paso del anfitrión − paso local`; el máximo del último segundo es el de la foto que menos tardó, o sea, la
// mejor estimación de por dónde va el anfitrión ahora. Se dibuja `retraso` pasos (100 ms) antes de eso. El
// desfase no salta: se corre de a poco (el dibujo va un 5 % más rápido o más lento; 15 % si quedó muy atrás),
// salvo que la diferencia pase de un segundo (el anfitrión se trabó o volvió a empezar). Si se acaban las fotos
// (se perdieron varias seguidas), el dibujo se queda en la última y después se pone al día de a poco.
import { envolver, type Foto, type Vector } from "./paquetes";

export const RETRASO_PASOS = 6;
/** Cuántos pasos locales se recuerdan los desfases para elegir el de la foto más rápida. */
const VENTANA = 60;
/** Cuánto puede correrse el desfase por paso: 0,05 = el dibujo va hasta un 5 % más rápido o más lento. */
const AJUSTE = 0.05;
/** Lo mismo cuando quedó más atrás que el colchón entero. */
const AJUSTE_RAPIDO = 0.15;
/** Con una diferencia más grande que esto (en pasos) el desfase salta de una. */
const SALTO = 60;
/** Una foto tanto más vieja que la última es que el anfitrión volvió a empezar. */
const REINICIO = 120;
/** Fotos que se guardan como mucho. */
const MAX_FOTOS = 32;

/** El mundo del anfitrión en un momento entre dos fotos. */
export interface Muestra {
  /** Qué paso del anfitrión se está dibujando (con fracción). */
  paso: number;
  /** Cuántas entradas del invitado ya están en lo que se dibuja (con fracción). */
  ack: number;
  /** Si se pasó de la última foto y se quedó quieto en ella (llegan tarde). */
  esperando: boolean;
  estados: Foto["estados"];
  agarres: number;
  rumbos: [number, number];
  velocidades: [Vector, Vector];
  posiciones: Float32Array;
  rotaciones: Float32Array;
}

export interface BufferFotos {
  /** Guarda una foto que llegó en el paso local `ahora`. Las repetidas o demasiado viejas se tiran. */
  recibir(foto: Foto, ahora: number): void;
  /** El mundo a dibujar en el paso local `ahora`; `undefined` si todavía no llegó ninguna foto. */
  muestrear(ahora: number): Muestra | undefined;
  /** El desfase actual entre el paso del anfitrión y el local (sin el retraso); `undefined` sin fotos. */
  readonly desfase: number | undefined;
  readonly fotos: number;
}

export function crearBufferFotos({ retraso = RETRASO_PASOS } = {}): BufferFotos {
  const fotos: Foto[] = [];
  const desfases: { ahora: number; desfase: number }[] = [];
  let desfase: number | undefined;
  let ultimoAhora: number | undefined;
  let muestra: Muestra | undefined;

  const objetivo = (ahora: number) => {
    while (desfases.length > 1 && (desfases[0]?.ahora ?? ahora) < ahora - VENTANA) desfases.shift();
    let mayor = Number.NEGATIVE_INFINITY;
    for (const d of desfases) mayor = Math.max(mayor, d.desfase);
    return mayor;
  };

  const reiniciar = () => {
    fotos.length = 0;
    desfases.length = 0;
    desfase = undefined;
  };

  return {
    recibir(foto, ahora) {
      const ultima = fotos[fotos.length - 1];
      // El anfitrión volvió a empezar (recargó la página): lo viejo ya no sirve
      if (ultima && foto.paso + REINICIO < ultima.paso) reiniciar();
      const primera = fotos[0];
      if (primera && foto.paso < primera.paso) return;
      let i = fotos.length;
      while (i > 0 && (fotos[i - 1]?.paso ?? 0) > foto.paso) i--;
      if (fotos[i - 1]?.paso === foto.paso) return;
      fotos.splice(i, 0, foto);
      if (fotos.length > MAX_FOTOS) fotos.shift();
      desfases.push({ ahora, desfase: foto.paso - ahora });
    },

    muestrear(ahora) {
      if (fotos.length === 0) return undefined;
      const meta = objetivo(ahora);
      const pasos = ultimoAhora === undefined ? 1 : Math.max(0, ahora - ultimoAhora);
      ultimoAhora = ahora;
      if (desfase === undefined || Math.abs(meta - desfase) > SALTO) desfase = meta;
      else {
        const diferencia = meta - desfase;
        const ajuste = (Math.abs(diferencia) > retraso ? AJUSTE_RAPIDO : AJUSTE) * pasos;
        desfase += Math.max(-ajuste, Math.min(ajuste, diferencia));
      }

      let objetivoPaso = ahora + desfase - retraso;
      // Sin fotos tan nuevas: se queda en la última (el reloj espera) en vez de inventar
      const ultima = fotos[fotos.length - 1];
      const esperando = ultima !== undefined && objetivoPaso > ultima.paso;
      if (ultima && esperando) {
        desfase -= objetivoPaso - ultima.paso;
        objetivoPaso = ultima.paso;
      }
      // Las fotos que ya quedaron atrás se tiran (se deja una antes del momento que se dibuja)
      while (fotos.length > 2 && (fotos[1]?.paso ?? 0) <= objetivoPaso) fotos.shift();

      const a = fotos[0];
      const b = fotos[1];
      if (!a) return undefined;
      let fraccion = 0;
      let hasta = a;
      if (b && objetivoPaso > a.paso) {
        hasta = b;
        fraccion = Math.min(1, (objetivoPaso - a.paso) / (b.paso - a.paso));
      }

      muestra = mezclar(a, hasta, fraccion, muestra);
      muestra.esperando = esperando;
      return muestra;
    },

    get desfase() {
      return desfase;
    },
    get fotos() {
      return fotos.length;
    },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpVector = (a: Vector, b: Vector, t: number): Vector => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});

/** Interpola dos fotos. Reusa `salida` si tiene el mismo número de cuerpos. */
export function mezclar(a: Foto, b: Foto, t: number, salida?: Muestra): Muestra {
  const n = a.posiciones.length;
  const mismos = b.posiciones.length === n;
  const m: Muestra =
    salida && salida.posiciones.length === n
      ? salida
      : {
          paso: 0,
          ack: 0,
          esperando: false,
          estados: a.estados,
          agarres: 0,
          rumbos: [0, 0],
          velocidades: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
          posiciones: new Float32Array(n),
          rotaciones: new Float32Array((n / 3) * 4),
        };
  const fin = mismos ? b : a;
  const u = mismos ? t : 0;
  m.paso = lerp(a.paso, fin.paso, u);
  m.ack = lerp(a.ack, fin.ack, u);
  m.estados = u < 0.5 ? a.estados : fin.estados;
  m.agarres = u < 0.5 ? a.agarres : fin.agarres;
  m.rumbos = [
    a.rumbos[0] + envolver(fin.rumbos[0] - a.rumbos[0]) * u,
    a.rumbos[1] + envolver(fin.rumbos[1] - a.rumbos[1]) * u,
  ];
  m.velocidades = [
    lerpVector(a.velocidades[0], fin.velocidades[0], u),
    lerpVector(a.velocidades[1], fin.velocidades[1], u),
  ];
  for (let i = 0; i < n; i++) m.posiciones[i] = lerp(a.posiciones[i] ?? 0, fin.posiciones[i] ?? 0, u);
  // Rotaciones: nlerp por el camino corto (entre dos fotos giran poco, así que es casi igual a slerp)
  const ra = a.rotaciones;
  const rb = fin.rotaciones;
  for (let i = 0; i < ra.length; i += 4) {
    const punto =
      (ra[i] ?? 0) * (rb[i] ?? 0) +
      (ra[i + 1] ?? 0) * (rb[i + 1] ?? 0) +
      (ra[i + 2] ?? 0) * (rb[i + 2] ?? 0) +
      (ra[i + 3] ?? 0) * (rb[i + 3] ?? 0);
    const s = punto < 0 ? -1 : 1;
    let largo = 0;
    for (let k = 0; k < 4; k++) {
      const v = lerp(ra[i + k] ?? 0, s * (rb[i + k] ?? 0), u);
      m.rotaciones[i + k] = v;
      largo += v * v;
    }
    largo = Math.sqrt(largo) || 1;
    for (let k = 0; k < 4; k++) m.rotaciones[i + k] = (m.rotaciones[i + k] ?? 0) / largo;
  }
  return m;
}
