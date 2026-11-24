// La música del menú (TU-59): suave, hecha en el momento. Una marimba de palo (senos que se apagan rápido, con un
// golpecito arriba) toca frases en una escala pentatónica sobre un colchón grave que respira. Las frases salen de
// `notasDelCompas` (sin audio y siempre iguales para el mismo compás: lo prueba musica.test.ts), así la música no
// depende del azar y no se repite exacta en mucho rato.

/** La escala: la menor pentatónica, en semitonos desde la fundamental. */
const ESCALA = [0, 3, 5, 7, 10, 12, 15, 17];
/** La fundamental (Hz): un la grave. */
const FUNDAMENTAL = 220;
/** Negras por minuto. */
export const TEMPO = 76;
/** Corcheas por compás (de 4/4). */
const CORCHEAS = 8;
/** Los acordes del colchón, un compás cada uno (grados de la escala). */
const ACORDES = [0, 2, 3, 1] as const;

export interface Nota {
  /** Cuándo empieza, en corcheas desde el principio del compás. */
  readonly corchea: number;
  /** Hz. */
  readonly frecuencia: number;
  /** 0 a 1. */
  readonly fuerza: number;
}

/** Un azar con semilla (mulberry32): la misma semilla, los mismos números. */
function azar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const semitono = (n: number) => FUNDAMENTAL * 2 ** (n / 12);

/** Las notas de la marimba en el compás `n`: una caminata por la escala, con silencios, que vuelve cada 16 compases. */
export function notasDelCompas(n: number): Nota[] {
  const vuelta = ((n % 16) + 16) % 16;
  const r = azar(1000 + vuelta);
  const notas: Nota[] = [];
  let grado = 2 + Math.floor(r() * 3);
  for (let c = 0; c < CORCHEAS; c++) {
    // Más notas en los tiempos fuertes; los compases pares descansan más
    const fuerte = c % 2 === 0;
    const toca = r() < (fuerte ? 0.62 : 0.28) * (vuelta % 4 === 3 ? 0.5 : 1);
    if (!toca) continue;
    grado = Math.min(ESCALA.length - 1, Math.max(0, grado + Math.floor(r() * 5) - 2));
    notas.push({ corchea: c, frecuencia: semitono(ESCALA[grado] ?? 0), fuerza: fuerte ? 0.9 : 0.6 });
  }
  return notas;
}

/** Las frecuencias del colchón en el compás `n`: la raíz y la quinta del acorde, una octava abajo. */
export function colchonDelCompas(n: number): readonly [number, number] {
  const grado = ACORDES[((n % ACORDES.length) + ACORDES.length) % ACORDES.length] ?? 0;
  const raiz = semitono((ESCALA[grado] ?? 0) - 12);
  return [raiz, raiz * 1.5];
}

export interface Musica {
  /** La prende o la apaga (despacio). */
  sonar(si: boolean): void;
  cerrar(): void;
}

/** Corchea en segundos. */
const CORCHEA = 60 / TEMPO / 2;
/** Cuánto antes se programa (s). */
const ADELANTE = 0.4;

export function crearMusica(contexto: BaseAudioContext, destino: AudioNode): Musica {
  const salida = contexto.createGain();
  salida.gain.value = 0;
  // Un poco de eco suave, para que la marimba respire
  const eco = contexto.createDelay(2);
  eco.delayTime.value = CORCHEA * 3;
  const vuelve = contexto.createGain();
  vuelve.gain.value = 0.28;
  const apagado = contexto.createBiquadFilter();
  apagado.type = "lowpass";
  apagado.frequency.value = 1800;
  eco.connect(apagado).connect(vuelve).connect(eco);
  vuelve.connect(salida);
  salida.connect(destino);

  const marimba = (t: number, nota: Nota) => {
    for (const [veces, peso, dura] of [
      [1, 1, 0.9],
      [4, 0.12, 0.08],
    ] as const) {
      const osc = contexto.createOscillator();
      osc.frequency.value = nota.frecuencia * veces;
      const g = contexto.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16 * nota.fuerza * peso, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
      osc.connect(g);
      g.connect(salida);
      g.connect(eco);
      osc.start(t);
      osc.stop(t + dura + 0.05);
    }
  };
  const colchon = (t: number, n: number) => {
    const dura = CORCHEA * CORCHEAS;
    for (const f of colchonDelCompas(n)) {
      const osc = contexto.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      const g = contexto.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.05, t + dura * 0.4);
      g.gain.linearRampToValueAtTime(0, t + dura + 0.3);
      osc.connect(g).connect(salida);
      osc.start(t);
      osc.stop(t + dura + 0.4);
    }
  };

  let prendida = false;
  /** El próximo compás por programar y cuándo empieza (s del contexto). */
  let compas = 0;
  let inicio = 0;
  const programar = () => {
    if (!prendida) return;
    const t = contexto.currentTime;
    if (inicio < t) inicio = t + 0.05;
    while (inicio < t + ADELANTE) {
      colchon(inicio, compas);
      for (const nota of notasDelCompas(compas)) marimba(inicio + nota.corchea * CORCHEA, nota);
      compas++;
      inicio += CORCHEA * CORCHEAS;
    }
  };
  const reloj = setInterval(programar, 100);

  return {
    sonar(si) {
      if (si === prendida) return;
      prendida = si;
      const t = contexto.currentTime;
      salida.gain.cancelScheduledValues(t);
      salida.gain.setTargetAtTime(si ? 1 : 0, t, si ? 0.8 : 0.4);
      if (si) programar();
    },
    cerrar() {
      clearInterval(reloj);
      salida.disconnect();
    },
  };
}
