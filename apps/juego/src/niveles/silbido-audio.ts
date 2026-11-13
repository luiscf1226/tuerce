// El silbido del Silbón con Web Audio (TU-44): sintetizado, sin archivos. Solo lee la cuenta de silbido.ts (qué
// volumen y qué paneo le toca a cada jugador) y la tonada (`notaEn`). Una voz por jugador, las dos en la misma tonada:
// un silbido (una onda seno con su vibrato) que pasa por su volumen y su paneo.
//
// Donde no hay audio (las pruebas de Node, un navegador sin Web Audio) no hace nada. El navegador no deja sonar nada
// hasta que el jugador toca algo: la primera tecla o el primer toque lo despiertan.
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

/** El audio del silbido, si hay Web Audio; si no, uno que no hace nada. */
export function crearAudioDelSilbido(voces = 2): AudioDelSilbido {
  const Contexto = typeof window === "undefined" ? undefined : window.AudioContext;
  if (!Contexto) return NADA;
  let contexto: AudioContext;
  try {
    contexto = new Contexto();
  } catch {
    return NADA;
  }
  const despertar = () => {
    if (contexto.state === "suspended") contexto.resume().catch(() => {});
  };
  window.addEventListener("keydown", despertar);
  window.addEventListener("pointerdown", despertar);

  const salidas = Array.from({ length: voces }, () => {
    const silbido = contexto.createOscillator();
    silbido.type = "sine";
    const vibrato = contexto.createOscillator();
    vibrato.frequency.value = VIBRATO.ritmo;
    const hondo = contexto.createGain();
    hondo.gain.value = VIBRATO.hondo;
    vibrato.connect(hondo).connect(silbido.frequency);
    const volumen = contexto.createGain();
    volumen.gain.value = 0;
    const paneo = contexto.createStereoPanner();
    silbido.connect(volumen).connect(paneo).connect(contexto.destination);
    silbido.start();
    vibrato.start();
    return { silbido, vibrato, volumen, paneo };
  });

  return {
    poner(t, lista) {
      const ahora = contexto.currentTime;
      const nota = notaEn(t);
      // Cada nota entra y sale suave, como el aire de un silbido
      const soplo = nota ? Math.sin(Math.PI * Math.min(1, nota.dentro * 1.15)) : 0;
      for (const [i, s] of salidas.entries()) {
        const v = lista[i];
        const fuerza = v ? v.volumen * soplo * FUERTE : 0;
        s.volumen.gain.setTargetAtTime(fuerza, ahora, SUAVE.volumen);
        if (nota) s.silbido.frequency.setTargetAtTime(nota.frecuencia, ahora, SUAVE.nota);
        s.paneo.pan.setTargetAtTime(v?.paneo ?? 0, ahora, SUAVE.paneo);
      }
    },
    cerrar() {
      window.removeEventListener("keydown", despertar);
      window.removeEventListener("pointerdown", despertar);
      for (const s of salidas) {
        s.silbido.stop();
        s.vibrato.stop();
      }
      contexto.close().catch(() => {});
    },
  };
}
