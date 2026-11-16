// Los efectos (TU-59): qué receta toca cada evento (`sonidoDe`, sin audio, lo prueba efectos.test.ts) y cómo se
// sintetiza una receta con Web Audio (`tocarReceta`). Todo sale de ruido filtrado y osciladores: no hay archivos.
import type { EventoSonido, Suelo, VozDePieza } from "./eventos";

/** Un pedazo de sonido. Las frecuencias van de `desde` a `hasta` (Hz) a lo largo de `dura` segundos. */
export type Capa =
  /** Ruido blanco por un filtro que se corre: pisadas, roces, chapoteos. */
  | {
      readonly forma: "ruido";
      readonly filtro: BiquadFilterType;
      readonly desde: number;
      readonly hasta: number;
      readonly q: number;
      readonly dura: number;
      readonly volumen: number;
    }
  /** Un oscilador que se desliza: golpes sordos, chasquidos. */
  | {
      readonly forma: "tono";
      readonly onda: OscillatorType;
      readonly desde: number;
      readonly hasta: number;
      readonly dura: number;
      readonly volumen: number;
    }
  /** Una campana: parciales que no son armónicos y se apagan despacio. */
  | { readonly forma: "campana"; readonly frecuencia: number; readonly dura: number; readonly volumen: number };

export interface Receta {
  /** Dos efectos con la misma clave no se repiten antes de `separacion` segundos (ver voces.ts). */
  readonly clave: string;
  readonly capas: readonly Capa[];
  /** De 0 a 1, ya con la fuerza del evento. */
  readonly volumen: number;
  readonly separacion: number;
  /** Cuánto se corre la altura al azar en cada vez (0.08 = ±8 %): así dos pasos no suenan idénticos. */
  readonly variacion: number;
}

const ruido = (filtro: BiquadFilterType, desde: number, hasta: number, q: number, dura: number, volumen = 1): Capa => ({
  forma: "ruido",
  filtro,
  desde,
  hasta,
  q,
  dura,
  volumen,
});
const tono = (onda: OscillatorType, desde: number, hasta: number, dura: number, volumen = 1): Capa => ({
  forma: "tono",
  onda,
  desde,
  hasta,
  dura,
  volumen,
});

/** Cómo suena un pie en cada suelo. */
export const PISADAS: Readonly<Record<Suelo, readonly Capa[]>> = {
  tierra: [ruido("lowpass", 900, 260, 0.8, 0.09), tono("sine", 95, 60, 0.06, 0.5)],
  pasto: [ruido("bandpass", 3200, 1600, 0.9, 0.13, 0.9)],
  hojas: [ruido("bandpass", 2600, 1400, 1.4, 0.15), ruido("highpass", 5000, 3500, 0.7, 0.06, 0.4)],
  piedra: [ruido("bandpass", 2000, 1400, 3, 0.05), tono("triangle", 240, 140, 0.04, 0.5)],
  madera: [tono("triangle", 190, 115, 0.09), ruido("bandpass", 900, 700, 2, 0.07, 0.6)],
  tela: [ruido("lowpass", 600, 250, 0.7, 0.11, 0.8)],
  agua: [ruido("bandpass", 1300, 500, 1.2, 0.2), tono("sine", 500, 900, 0.05, 0.25)],
};

/** Cómo suena cada pieza al sonar. */
export const PIEZAS: Readonly<Record<VozDePieza, readonly Capa[]>> = {
  // Un huacal: tablas huecas
  madera: [tono("triangle", 150, 90, 0.16), ruido("bandpass", 700, 450, 2, 0.14, 0.8)],
  piedra: [ruido("lowpass", 380, 120, 0.9, 0.28), tono("sine", 75, 40, 0.22, 0.9)],
  // El clac del brazo contra su tope
  palanca: [tono("square", 320, 190, 0.05, 0.35), ruido("bandpass", 1300, 1000, 6, 0.08)],
  // Una tabla que se hunde sobre su base
  plancha: [tono("sine", 120, 75, 0.18), ruido("bandpass", 420, 300, 2.5, 0.12, 0.7)],
  campana: [{ forma: "campana", frecuencia: 620, dura: 2.2, volumen: 1 }],
  // Madera que raspa al subir o correrse
  compuerta: [ruido("bandpass", 260, 380, 2.5, 1.1), tono("sawtooth", 52, 58, 1, 0.25)],
};

/** Cuánto tiempo (s) tiene que pasar para que la misma clave suene otra vez. */
const SEPARACION = {
  paso: 0.12,
  salto: 0.25,
  aterrizar: 0.18,
  caer: 0.35,
  golpe: 0.2,
  agarrar: 0.08,
  soltar: 0.08,
  chapoteo: 0.3,
  pieza: 0.07,
  campana: 0.3,
  compuerta: 0.8,
} as const;

/** Del más bajito al más fuerte: la fuerza del evento (0–1) lleva el volumen entre `piso` y 1. */
const conFuerza = (fuerza: number, piso: number) => piso + (1 - piso) * Math.min(1, Math.max(0, fuerza));

/** La receta de un evento: qué capas suenan, qué tan fuerte y cada cuánto puede repetirse. */
export function sonidoDe(evento: EventoSonido): Receta {
  switch (evento.cual) {
    case "paso":
      return {
        clave: `paso:${evento.jugador}`,
        capas: PISADAS[evento.suelo],
        volumen: 0.32 * conFuerza(evento.fuerza, 0.5),
        separacion: SEPARACION.paso,
        variacion: 0.1,
      };
    case "salto":
      return {
        clave: `salto:${evento.jugador}`,
        capas: [ruido("highpass", 1200, 2600, 0.7, 0.12, 0.6), tono("sine", 260, 470, 0.1, 0.35)],
        volumen: 0.35 * conFuerza(evento.fuerza, 0.6),
        separacion: SEPARACION.salto,
        variacion: 0.06,
      };
    case "aterrizar":
      return {
        clave: `aterrizar:${evento.jugador}`,
        capas: [...PISADAS[evento.suelo], tono("sine", 110, 50, 0.16, 0.8)],
        volumen: 0.5 * conFuerza(evento.fuerza, 0.4),
        separacion: SEPARACION.aterrizar,
        variacion: 0.06,
      };
    case "caer":
      // Un trapo relleno que se desploma: sordo, sin rebote
      return {
        clave: `caer:${evento.jugador}`,
        capas: [tono("sine", 120, 42, 0.32), ruido("lowpass", 700, 140, 0.8, 0.26, 0.8)],
        volumen: 0.6 * conFuerza(evento.fuerza, 0.4),
        separacion: SEPARACION.caer,
        variacion: 0.05,
      };
    case "golpe":
      return {
        clave: `golpe:${evento.jugador}`,
        capas: [tono("sine", 170, 70, 0.18), ruido("lowpass", 900, 250, 1, 0.14, 0.7)],
        volumen: 0.5 * conFuerza(evento.fuerza, 0.4),
        separacion: SEPARACION.golpe,
        variacion: 0.08,
      };
    case "agarrar":
      // La mano de trapo que se cierra: un roce corto que sube
      return {
        clave: `agarrar:${evento.jugador}`,
        capas: [ruido("bandpass", 1900, 2800, 3, 0.07), tono("triangle", 520, 680, 0.04, 0.3)],
        volumen: 0.28 * conFuerza(evento.fuerza, 0.6),
        separacion: SEPARACION.agarrar,
        variacion: 0.06,
      };
    case "soltar":
      return {
        clave: `soltar:${evento.jugador}`,
        capas: [ruido("bandpass", 2400, 1500, 3, 0.06), tono("triangle", 600, 430, 0.04, 0.25)],
        volumen: 0.22 * conFuerza(evento.fuerza, 0.6),
        separacion: SEPARACION.soltar,
        variacion: 0.06,
      };
    case "chapoteo":
      return {
        clave: `chapoteo:${evento.jugador}`,
        capas: [
          ruido("lowpass", 2600, 380, 0.7, 0.45),
          ruido("bandpass", 1100, 700, 1.5, 0.3, 0.6),
          tono("sine", 380, 950, 0.08, 0.3),
        ],
        volumen: 0.55 * conFuerza(evento.fuerza, 0.4),
        separacion: SEPARACION.chapoteo,
        variacion: 0.08,
      };
    case "pieza": {
      const separacion =
        evento.voz === "campana"
          ? SEPARACION.campana
          : evento.voz === "compuerta"
            ? SEPARACION.compuerta
            : SEPARACION.pieza;
      return {
        clave: `pieza:${evento.voz}`,
        capas: PIEZAS[evento.voz],
        volumen: (evento.voz === "campana" ? 0.4 : 0.5) * conFuerza(evento.fuerza, 0.35),
        separacion,
        variacion: evento.voz === "campana" ? 0.01 : 0.08,
      };
    }
  }
}

/** Cuánto suena una receta (s): la capa más larga. */
export function duracion(receta: Receta): number {
  return Math.max(0, ...receta.capas.map((c) => c.dura));
}

/** Los parciales de la campana: múltiplos de la fundamental y cuánto pesa cada uno. */
const PARCIALES = [
  { veces: 0.5, peso: 0.35, dura: 1 },
  { veces: 1, peso: 1, dura: 1 },
  { veces: 1.19, peso: 0.45, dura: 0.7 },
  { veces: 1.56, peso: 0.35, dura: 0.6 },
  { veces: 2, peso: 0.3, dura: 0.5 },
  { veces: 2.66, peso: 0.2, dura: 0.35 },
];

let ruidoBlanco: { contexto: BaseAudioContext; buffer: AudioBuffer } | undefined;
/** Un segundo de ruido blanco, el mismo para todos los efectos de un contexto. */
export function bufferDeRuido(contexto: BaseAudioContext): AudioBuffer {
  if (ruidoBlanco?.contexto === contexto) return ruidoBlanco.buffer;
  const buffer = contexto.createBuffer(1, contexto.sampleRate, contexto.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  ruidoBlanco = { contexto, buffer };
  return buffer;
}

/** Una envolvente de golpe: sube en 4 ms y se apaga en `dura`. */
function envolvente(contexto: BaseAudioContext, inicio: number, dura: number, volumen: number): GainNode {
  const g = contexto.createGain();
  g.gain.setValueAtTime(0, inicio);
  g.gain.linearRampToValueAtTime(volumen, inicio + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, inicio + Math.max(0.01, dura));
  return g;
}

/** Toca la receta ya, hacia `destino`, con `volumen` y la altura corrida `altura` veces (1 = tal cual). */
export function tocarReceta(
  contexto: BaseAudioContext,
  destino: AudioNode,
  receta: Receta,
  volumen: number,
  altura: number,
): void {
  const t = contexto.currentTime;
  for (const capa of receta.capas) {
    switch (capa.forma) {
      case "ruido": {
        const fuente = contexto.createBufferSource();
        fuente.buffer = bufferDeRuido(contexto);
        // Cada vez desde otro lugar del buffer, para que no suene igual
        const desde = Math.random() * 0.5;
        const filtro = contexto.createBiquadFilter();
        filtro.type = capa.filtro;
        filtro.Q.value = capa.q;
        filtro.frequency.setValueAtTime(capa.desde * altura, t);
        filtro.frequency.exponentialRampToValueAtTime(Math.max(20, capa.hasta * altura), t + capa.dura);
        const g = envolvente(contexto, t, capa.dura, volumen * capa.volumen);
        fuente.connect(filtro).connect(g).connect(destino);
        fuente.start(t, desde, capa.dura + 0.05);
        break;
      }
      case "tono": {
        const osc = contexto.createOscillator();
        osc.type = capa.onda;
        osc.frequency.setValueAtTime(capa.desde * altura, t);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, capa.hasta * altura), t + capa.dura);
        const g = envolvente(contexto, t, capa.dura, volumen * capa.volumen);
        osc.connect(g).connect(destino);
        osc.start(t);
        osc.stop(t + capa.dura + 0.05);
        break;
      }
      case "campana": {
        for (const p of PARCIALES) {
          const osc = contexto.createOscillator();
          osc.type = "sine";
          osc.frequency.value = capa.frecuencia * altura * p.veces;
          const dura = capa.dura * p.dura;
          const g = envolvente(contexto, t, dura, volumen * capa.volumen * p.peso * 0.4);
          osc.connect(g).connect(destino);
          osc.start(t);
          osc.stop(t + dura + 0.05);
        }
        break;
      }
    }
  }
}
