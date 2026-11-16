// La salida de sonido (TU-59): un solo AudioContext para todo el juego, con sus tres canales (general, efectos y
// música) que siguen los volúmenes de la mezcla. El navegador no deja sonar nada hasta que el jugador toca algo,
// así que el contexto se crea recién con la primera tecla, el primer clic o el primer toque; antes de eso los
// efectos no suenan (no se guardan para después) y lo que tiene que sonar siempre (el ambiente, la música, el
// silbido del Silbón) se arma al despertar con `alDespertar`.
//
// `?mudo` no crea nunca el contexto (y la pestaña sigue muda al navegar), y tampoco `?congelar=` (las capturas): las
// pruebas en Chromium corren mudas.
import type { Mezcla, Volumenes } from "./mezcla";

export interface Canales {
  readonly contexto: AudioContext;
  /** Los efectos de los muñecos y las piezas, el ambiente y el silbido. */
  readonly efectos: AudioNode;
  /** La música del menú. */
  readonly musica: AudioNode;
}

export interface Salida {
  /** Si está muda para siempre (`?mudo`, `?congelar`, o un navegador sin Web Audio). */
  readonly muda: boolean;
  /** Los canales, si ya despertó; si no, `null`. */
  canales(): Canales | null;
  /** Llama a `aviso` cuando despierte (o ya, si ya despertó). Devuelve cómo dejar de esperar. */
  alDespertar(aviso: (canales: Canales) => void): () => void;
}

/** La llave en sessionStorage: `?mudo` sigue valiendo al pasar a otra dirección en la misma pestaña (el menú lleva
 * a un nivel, «Siguiente nivel»…), así que una prueba que entra muda sigue muda aunque navegue. */
export const LLAVE_MUDO = "tuerce:mudo";

/** Lo que hace falta de `sessionStorage`. */
export interface Sesion {
  getItem(llave: string): string | null;
  setItem(llave: string, valor: string): void;
}

/** Si la página tiene que ser muda: `?mudo` (y desde ahí toda la pestaña), o `?congelar=` (capturas que siempre salen
 * iguales). */
export function pideMudo(parametros: URLSearchParams, sesion?: Sesion): boolean {
  if (parametros.has("congelar")) return true;
  try {
    if (parametros.has("mudo")) {
      sesion?.setItem(LLAVE_MUDO, "1");
      return true;
    }
    return sesion?.getItem(LLAVE_MUDO) === "1";
  } catch {
    return parametros.has("mudo");
  }
}

/** Cuánto tardan los volúmenes en llegar al valor nuevo (s): sin chasquidos al mover una barra. */
const SUAVE = 0.03;

const MUDA: Salida = { muda: true, canales: () => null, alDespertar: () => () => {} };

export function crearSalida(mezcla: Mezcla, muda: boolean): Salida {
  const Contexto = typeof window === "undefined" ? undefined : window.AudioContext;
  if (muda || !Contexto) return MUDA;

  let canales: Canales | null = null;
  const esperando = new Set<(canales: Canales) => void>();

  const despertar = () => {
    if (canales) {
      if (canales.contexto.state === "suspended") canales.contexto.resume().catch(() => {});
      return;
    }
    let contexto: AudioContext;
    try {
      contexto = new Contexto();
    } catch {
      return;
    }
    // Un compresor al final, para que diez golpes juntos no saturen
    const compresor = contexto.createDynamicsCompressor();
    compresor.threshold.value = -14;
    compresor.ratio.value = 4;
    compresor.connect(contexto.destination);
    const general = contexto.createGain();
    general.connect(compresor);
    const efectos = contexto.createGain();
    efectos.connect(general);
    const musica = contexto.createGain();
    musica.connect(general);
    const poner = (v: Volumenes, suave: boolean) => {
      const t = contexto.currentTime;
      for (const [nodo, n] of [
        [general, v.general],
        [efectos, v.efectos],
        [musica, v.musica],
      ] as const) {
        if (suave) nodo.gain.setTargetAtTime(n, t, SUAVE);
        else nodo.gain.value = n;
      }
    };
    poner(mezcla.volumenes(), false);
    mezcla.alCambiarVolumen((v) => poner(v, true));
    if (contexto.state === "suspended") contexto.resume().catch(() => {});
    canales = { contexto, efectos, musica };
    for (const aviso of esperando) aviso(canales);
    esperando.clear();
  };
  // Siguen escuchando después de despertar: si el navegador lo suspende (otra pestaña), el próximo toque lo retoma
  window.addEventListener("keydown", despertar);
  window.addEventListener("pointerdown", despertar);
  window.addEventListener("touchend", despertar);

  return {
    muda: false,
    canales: () => canales,
    alDespertar(aviso) {
      if (canales) {
        aviso(canales);
        return () => {};
      }
      esperando.add(aviso);
      return () => esperando.delete(aviso);
    },
  };
}
