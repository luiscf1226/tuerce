// El ambiente de cada nivel (TU-59): capas que suenan siempre por debajo (viento en el pinar, el río en la poza, el
// mar en Chiloé, la cueva en Xibalbá y en la mina…) y, de noche (Noche de tuerce, `&noche`), grillos y ranas en vez
// de pájaros. `ambienteDe` dice qué capas y qué tan fuertes (lo prueba ambiente.test.ts); `crearAmbiente` las
// sintetiza con ruido filtrado y osciladores, y cambia de una mezcla a otra despacio.
import { bufferDeRuido } from "./efectos";

export type CapaDeAmbiente = "viento" | "rio" | "mar" | "cueva" | "pajaros" | "grillos" | "ranas" | "fuego";
export const CAPAS_DE_AMBIENTE: readonly CapaDeAmbiente[] = [
  "viento",
  "rio",
  "mar",
  "cueva",
  "pajaros",
  "grillos",
  "ranas",
  "fuego",
];

/** Qué tan fuerte va cada capa (0 a 1); las que faltan, calladas. */
export type Ambiente = Readonly<Partial<Record<CapaDeAmbiente, number>>>;

/** El de día de cada escena: los 17 niveles de la historia (src/niveles/orden.ts), los de prueba y la escena `dos`. */
export const AMBIENTES: Readonly<Record<string, Ambiente>> = {
  // Tegucigalpa, la mañana del 31: pájaros en el patio
  patio: { pajaros: 0.6, viento: 0.2 },
  // La Esperanza: el viento entre los pinos
  pinar: { viento: 0.85, pajaros: 0.3 },
  // El río Guayape
  poza: { rio: 0.8, pajaros: 0.35, viento: 0.2 },
  calle: { viento: 0.35, pajaros: 0.3 },
  // Bajo Copán: la cueva, con su eco y sus goteras
  xibalba: { cueva: 0.85, viento: 0.2 },
  tren: { pajaros: 0.5, viento: 0.25 },
  // La Mosquitia: selva y río
  rio: { rio: 0.6, pajaros: 0.7, ranas: 0.25 },
  // Antigua: viento y el agua de la fuente
  trenzas: { viento: 0.3, pajaros: 0.3, rio: 0.15 },
  cafetal: { pajaros: 0.6, viento: 0.4 },
  // Xochimilco: agua quieta y ranas
  canales: { rio: 0.35, ranas: 0.45, pajaros: 0.3 },
  // El cañón: viento arriba, el río abajo
  garrucha: { viento: 0.6, rio: 0.4, pajaros: 0.3 },
  llano: { viento: 0.6, grillos: 0.25, pajaros: 0.2 },
  // Q'eswachaka: viento de los Andes y el Apurímac
  puente: { viento: 0.9, rio: 0.5 },
  mina: { cueva: 0.9, viento: 0.3 },
  // Chiloé: el mar
  minga: { mar: 0.9, viento: 0.5 },
  pampa: { viento: 1, grillos: 0.3 },
  // La Amazonía en Año Nuevo: ranas, grillos y el río
  medianoche: { ranas: 0.6, grillos: 0.6, rio: 0.4, fuego: 0.2 },
  piezas: { viento: 0.3 },
  prueba: { viento: 0.3 },
  // La escena `dos`: un claro del pinar
  dos: { viento: 0.6, pajaros: 0.3 },
};

/** El ambiente de una escena: el de su nivel (si no está en la lista, un viento suave) y, de noche, sin pájaros y
 * con grillos (y más ranas donde hay agua). */
export function ambienteDe(clave: string, deNoche: boolean): Ambiente {
  const dia = AMBIENTES[clave] ?? { viento: 0.4 };
  if (!deNoche) return dia;
  const hayAgua = (dia.rio ?? 0) > 0 || (dia.mar ?? 0) > 0 || (dia.ranas ?? 0) > 0;
  return {
    ...dia,
    pajaros: 0,
    grillos: Math.max(0.7, dia.grillos ?? 0),
    ...(hayAgua ? { ranas: Math.max(0.5, dia.ranas ?? 0) } : {}),
    viento: (dia.viento ?? 0) * 0.8,
  };
}

/** Lo que suena por debajo, ya armado sobre un contexto. */
export interface SonidoDeAmbiente {
  /** Pasa a esa mezcla en `segundos`. */
  poner(ambiente: Ambiente, segundos?: number): void;
  /** Para todo. */
  cerrar(): void;
}

/** Cuánto pesa cada capa con el volumen en 1 (las de ruido llenan mucho más que los grillos). */
const PESO: Readonly<Record<CapaDeAmbiente, number>> = {
  viento: 0.22,
  rio: 0.16,
  mar: 0.28,
  cueva: 0.3,
  pajaros: 0.18,
  grillos: 0.05,
  ranas: 0.12,
  fuego: 0.2,
};

/** Ruido que no se corta: el buffer en bucle, con su propio comienzo. */
function ruidoSinFin(contexto: BaseAudioContext): AudioBufferSourceNode {
  const fuente = contexto.createBufferSource();
  fuente.buffer = bufferDeRuido(contexto);
  fuente.loop = true;
  return fuente;
}

/** Un oscilador lento que mueve un parámetro alrededor de su valor: `hondo` para arriba y para abajo. */
function vaiven(contexto: BaseAudioContext, ritmo: number, hondo: number, parametro: AudioParam): OscillatorNode {
  const lfo = contexto.createOscillator();
  lfo.frequency.value = ritmo;
  const g = contexto.createGain();
  g.gain.value = hondo;
  lfo.connect(g).connect(parametro);
  lfo.start();
  return lfo;
}

export function crearAmbiente(contexto: BaseAudioContext, destino: AudioNode): SonidoDeAmbiente {
  const paradas: (() => void)[] = [];
  const capas = new Map<CapaDeAmbiente, GainNode>();
  const salida = (capa: CapaDeAmbiente) => {
    const g = contexto.createGain();
    g.gain.value = 0;
    g.connect(destino);
    capas.set(capa, g);
    return g;
  };
  const sostener = (...nodos: AudioScheduledSourceNode[]) => {
    for (const n of nodos) {
      n.start();
      paradas.push(() => n.stop());
    }
  };

  // Viento: ruido grave que sube y baja en ráfagas lentas
  {
    const fuente = ruidoSinFin(contexto);
    const filtro = contexto.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 420;
    filtro.Q.value = 1.2;
    const rafagas = contexto.createGain();
    rafagas.gain.value = 0.7;
    fuente.connect(filtro).connect(rafagas).connect(salida("viento"));
    const lfo1 = vaiven(contexto, 0.07, 260, filtro.frequency);
    const lfo2 = vaiven(contexto, 0.11, 0.3, rafagas.gain);
    paradas.push(() => {
      lfo1.stop();
      lfo2.stop();
    });
    sostener(fuente);
  }
  // Río: ruido medio, apenas inquieto
  {
    const fuente = ruidoSinFin(contexto);
    const filtro = contexto.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 900;
    filtro.Q.value = 0.6;
    const alto = contexto.createBiquadFilter();
    alto.type = "lowpass";
    alto.frequency.value = 2400;
    fuente.connect(filtro).connect(alto).connect(salida("rio"));
    const lfo = vaiven(contexto, 0.9, 150, filtro.frequency);
    paradas.push(() => lfo.stop());
    sostener(fuente);
  }
  // Mar: ruido hondo que va y viene como las olas
  {
    const fuente = ruidoSinFin(contexto);
    const filtro = contexto.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 500;
    const olas = contexto.createGain();
    olas.gain.value = 0.55;
    fuente.connect(filtro).connect(olas).connect(salida("mar"));
    const lfo1 = vaiven(contexto, 0.09, 0.45, olas.gain);
    const lfo2 = vaiven(contexto, 0.09, 300, filtro.frequency);
    paradas.push(() => {
      lfo1.stop();
      lfo2.stop();
    });
    sostener(fuente);
  }
  // Cueva: un zumbido grave y ruido muy apagado
  {
    const fuente = ruidoSinFin(contexto);
    const filtro = contexto.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 180;
    const zumbido = contexto.createOscillator();
    zumbido.frequency.value = 55;
    const gz = contexto.createGain();
    gz.gain.value = 0.25;
    const g = salida("cueva");
    fuente.connect(filtro).connect(g);
    zumbido.connect(gz).connect(g);
    sostener(fuente, zumbido);
  }
  // Grillos: un tono agudo que se prende y apaga muy rápido, a ratos
  {
    const g = salida("grillos");
    for (const [frecuencia, pulso, canto] of [
      [4300, 28, 0.9],
      [4650, 31, 0.63],
    ] as const) {
      const osc = contexto.createOscillator();
      osc.frequency.value = frecuencia;
      const trino = contexto.createGain();
      trino.gain.value = 0;
      const frase = contexto.createGain();
      frase.gain.value = 0;
      osc.connect(trino).connect(frase).connect(g);
      // El trino: una onda cuadrada que abre y cierra; la frase: cantan un rato y paran
      const lfoTrino = contexto.createOscillator();
      lfoTrino.type = "square";
      lfoTrino.frequency.value = pulso;
      const gTrino = contexto.createGain();
      gTrino.gain.value = 0.5;
      lfoTrino.connect(gTrino).connect(trino.gain);
      trino.gain.value = 0.5;
      const lfoFrase = contexto.createOscillator();
      lfoFrase.type = "square";
      lfoFrase.frequency.value = canto;
      const gFrase = contexto.createGain();
      gFrase.gain.value = 0.5;
      lfoFrase.connect(gFrase).connect(frase.gain);
      frase.gain.value = 0.5;
      sostener(osc, lfoTrino, lfoFrase);
    }
  }
  // Fuego: un crepitar de ruido agudo
  {
    const fuente = ruidoSinFin(contexto);
    const filtro = contexto.createBiquadFilter();
    filtro.type = "highpass";
    filtro.frequency.value = 2500;
    const g = salida("fuego");
    const chispas = contexto.createGain();
    chispas.gain.value = 0.3;
    fuente.connect(filtro).connect(chispas).connect(g);
    const lfo = vaiven(contexto, 7.3, 0.3, chispas.gain);
    paradas.push(() => lfo.stop());
    sostener(fuente);
  }

  // Pájaros y ranas: cantos sueltos, cada tanto, programados un poco por delante
  const pajaros = salida("pajaros");
  const ranas = salida("ranas");
  const cantar = (t: number) => {
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const inicio = t + i * (0.09 + Math.random() * 0.05);
      const osc = contexto.createOscillator();
      osc.frequency.setValueAtTime(base * (1 + Math.random() * 0.15), inicio);
      osc.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), inicio + 0.06);
      const g = contexto.createGain();
      g.gain.setValueAtTime(0, inicio);
      g.gain.linearRampToValueAtTime(0.5, inicio + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, inicio + 0.08);
      osc.connect(g).connect(pajaros);
      osc.start(inicio);
      osc.stop(inicio + 0.1);
    }
  };
  const croar = (t: number) => {
    const n = 1 + Math.floor(Math.random() * 3);
    const base = 140 + Math.random() * 90;
    for (let i = 0; i < n; i++) {
      const inicio = t + i * 0.22;
      const osc = contexto.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = base;
      const filtro = contexto.createBiquadFilter();
      filtro.type = "bandpass";
      filtro.frequency.value = base * 4;
      filtro.Q.value = 4;
      const g = contexto.createGain();
      g.gain.setValueAtTime(0, inicio);
      g.gain.linearRampToValueAtTime(0.6, inicio + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, inicio + 0.16);
      osc.connect(filtro).connect(g).connect(ranas);
      osc.start(inicio);
      osc.stop(inicio + 0.18);
    }
  };
  /** Cuándo toca el próximo canto de cada uno (s del contexto). */
  const proximo = { pajaros: 0, ranas: 0, gota: 0 };
  let actual: Ambiente = {};
  const gotear = (t: number) => {
    const osc = contexto.createOscillator();
    const f = 900 + Math.random() * 700;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.05);
    const g = contexto.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const cueva = capas.get("cueva");
    if (cueva) osc.connect(g).connect(cueva);
    osc.start(t);
    osc.stop(t + 0.14);
  };
  const programar = () => {
    const t = contexto.currentTime;
    if ((actual.pajaros ?? 0) > 0 && t >= proximo.pajaros) {
      cantar(t + 0.05);
      proximo.pajaros = t + 1.5 + (Math.random() * 4) / Math.max(0.3, actual.pajaros ?? 0);
    }
    if ((actual.ranas ?? 0) > 0 && t >= proximo.ranas) {
      croar(t + 0.05);
      proximo.ranas = t + 0.8 + Math.random() * 2.5;
    }
    if ((actual.cueva ?? 0) > 0 && t >= proximo.gota) {
      gotear(t + 0.05);
      proximo.gota = t + 1.2 + Math.random() * 3.5;
    }
  };
  const reloj = setInterval(programar, 200);

  return {
    poner(ambiente, segundos = 1.5) {
      actual = ambiente;
      const t = contexto.currentTime;
      for (const capa of CAPAS_DE_AMBIENTE) {
        const g = capas.get(capa);
        g?.gain.setTargetAtTime((ambiente[capa] ?? 0) * PESO[capa], t, segundos / 3);
      }
    },
    cerrar() {
      clearInterval(reloj);
      for (const parar of paradas) {
        try {
          parar();
        } catch {
          // Ya estaba parado
        }
      }
      for (const g of capas.values()) g.disconnect();
    },
  };
}
