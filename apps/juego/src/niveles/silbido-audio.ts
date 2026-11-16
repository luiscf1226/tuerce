// El silbido del Silbón con Web Audio (TU-44): sintetizado, sin archivos. Solo lee la cuenta de silbido.ts (qué
// volumen y qué paneo le toca a cada jugador) y la tonada (`notaEn`). Una voz por jugador, las dos en la misma tonada:
// un silbido (una onda seno con su vibrato) que pasa por su volumen y su paneo.
//
// Suena por el canal de efectos de la salida del juego (src/sonido, TU-59): el mismo AudioContext que todo lo demás,
// que nace con el primer gesto del jugador y que `?mudo` no crea nunca. Antes de eso, o donde no hay audio (las
// pruebas de Node, un navegador sin Web Audio), no hace nada.
import { salidaDelJuego } from "../sonido/global";
import { notaEn, type Silbido } from "./silbido";

export interface AudioDelSilbido {
  /** Lo que suena ahora (`t`: los segundos del nivel) para cada jugador. */
  poner(t: number, voces: readonly Silbido[]): void;
  /** Lo calla y suelta el audio. */
  cerrar(): void;
}

/** Qué tan fuerte suena con el volumen en 1 (el silbido no tiene que tapar todo). */
const FUERTE = 0.16;
/** El vibrato: cada cuánto (Hz) y cuánto (Hz). */
const VIBRATO = { ritmo: 5.5, hondo: 9 };
/** Cuánto tardan en llegar el volumen, la nota y el paneo (s): un silbido se desliza de nota en nota. */
const SUAVE = { volumen: 0.04, nota: 0.025, paneo: 0.1 };

const NADA: AudioDelSilbido = { poner() {}, cerrar() {} };

/** En línea cada máquina oye solo a su jugador (0 el rojo, 1 el turquesa); en el mismo lugar, `null`: los dos. */
let soloOye: 0 | 1 | null = null;
export function oirSolo(jugador: 0 | 1 | null): void {
  soloOye = jugador;
}

/** El audio del silbido, si hay Web Audio; si no, uno que no hace nada. Las voces se arman al despertar la salida. */
export function crearAudioDelSilbido(voces = 2): AudioDelSilbido {
  const salida = salidaDelJuego();
  if (salida.muda) return NADA;
  let contexto: AudioContext | undefined;
  let salidas: { silbido: OscillatorNode; vibrato: OscillatorNode; volumen: GainNode; paneo: StereoPannerNode }[] = [];
  const dejar = salida.alDespertar((c) => {
    contexto = c.contexto;
    const ctx = c.contexto;
    salidas = Array.from({ length: voces }, () => {
      const silbido = ctx.createOscillator();
      silbido.type = "sine";
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = VIBRATO.ritmo;
      const hondo = ctx.createGain();
      hondo.gain.value = VIBRATO.hondo;
      vibrato.connect(hondo).connect(silbido.frequency);
      const volumen = ctx.createGain();
      volumen.gain.value = 0;
      const paneo = ctx.createStereoPanner();
      silbido.connect(volumen).connect(paneo).connect(c.efectos);
      silbido.start();
      vibrato.start();
      return { silbido, vibrato, volumen, paneo };
    });
  });

  return {
    poner(t, lista) {
      if (!contexto) return;
      const ahora = contexto.currentTime;
      const nota = notaEn(t);
      // Cada nota entra y sale suave, como el aire de un silbido
      const soplo = nota ? Math.sin(Math.PI * Math.min(1, nota.dentro * 1.15)) : 0;
      for (const [i, s] of salidas.entries()) {
        const v = soloOye === null || soloOye === i ? lista[i] : undefined;
        const fuerza = v ? v.volumen * soplo * FUERTE : 0;
        s.volumen.gain.setTargetAtTime(fuerza, ahora, SUAVE.volumen);
        if (nota) s.silbido.frequency.setTargetAtTime(nota.frecuencia, ahora, SUAVE.nota);
        s.paneo.pan.setTargetAtTime(v?.paneo ?? 0, ahora, SUAVE.paneo);
      }
    },
    cerrar() {
      dejar();
      for (const s of salidas) {
        s.silbido.stop();
        s.vibrato.stop();
        s.paneo.disconnect();
      }
      salidas = [];
    },
  };
}
