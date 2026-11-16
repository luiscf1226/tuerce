// Qué suena en cada paso (TU-59), sin audio: el detector mira lo que se ve del mundo después de cada paso de físicas
// (dónde está cada muñeco, en qué anda, qué manos agarran, dónde están las piezas) y devuelve los eventos de sonido
// que pasaron en ese paso. Lo prueba eventos.test.ts.
//
// Solo lee: no toca ningún cuerpo, así que las físicas siguen igual de deterministas con o sin sonido. Y no lee nada
// que solo sepa quien simula: las velocidades salen de cuánto se movió cada cosa de un paso al otro, y el estado y
// los agarres de los muñecos son los mismos que viajan en la foto de la red. Así, en línea, el invitado (que no
// simula y pone los cuerpos donde dice la foto) oye lo mismo que ve, igual que el anfitrión.
//
// Lo que se oye, y de dónde sale:
//   paso        de pie y andando: cada `zancada` metros recorridos, con el suelo que pisa
//   salto       pasa de «de pie» a «en el aire» subiendo
//   aterrizar   pasa de «en el aire» a estar de pie (o a levantarse) después de bajar rápido
//   caer        pasa a «caido» (se fue al suelo como un trapo)
//   golpe       el muñeco frena de golpe sin cambiar de estado (choca contra una pared, le cae algo)
//   agarrar     una mano empieza a agarrar algo; `soltar`, deja de agarrar
//   chapoteo    los pies o la pelvis entran al agua
//   pieza       una pieza suena con su voz: madera o piedra al chocar, la palanca al llegar al tope, la plancha al
//               hundirse o subir, la campana en cada vaivén y la compuerta (o el portón) al arrancar a moverse
import type * as THREE from "three";
import { PASO } from "../motor/bucle";
import type { EstadoMuneco } from "../muneco";

/** Lo que pisa un muñeco: según el material del sólido (y el nivel), o el agua. */
export type Suelo = "tierra" | "pasto" | "hojas" | "piedra" | "madera" | "tela" | "agua";
export const SUELOS: readonly Suelo[] = ["tierra", "pasto", "hojas", "piedra", "madera", "tela", "agua"];

/** Cómo suena una pieza. */
export type VozDePieza = "madera" | "piedra" | "palanca" | "plancha" | "campana" | "compuerta";

export type Jugador = 0 | 1;

export type EventoSonido =
  | {
      readonly cual: "paso";
      readonly jugador: Jugador;
      readonly suelo: Suelo;
      readonly fuerza: number;
      readonly x: number;
    }
  | { readonly cual: "salto"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | {
      readonly cual: "aterrizar";
      readonly jugador: Jugador;
      readonly suelo: Suelo;
      readonly fuerza: number;
      readonly x: number;
    }
  | { readonly cual: "caer"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | { readonly cual: "golpe"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | { readonly cual: "agarrar"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | { readonly cual: "soltar"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | { readonly cual: "chapoteo"; readonly jugador: Jugador; readonly fuerza: number; readonly x: number }
  | { readonly cual: "pieza"; readonly voz: VozDePieza; readonly fuerza: number; readonly x: number };

export type CualEvento = EventoSonido["cual"];

/** Un muñeco como se ve después del paso. */
export interface MunecoVisto {
  readonly estado: EstadoMuneco;
  /** Si agarra algo con la mano izquierda y con la derecha. */
  readonly manos: readonly [boolean, boolean];
  readonly pelvis: THREE.Vector3Like;
  /** 0 seco, 1 con los pies en el agua, 2 con la pelvis bajo el agua. */
  readonly agua: 0 | 1 | 2;
}

/** Una pieza como se ve después del paso: dónde está y cuánto giró desde como empezó (radianes, sin signo). */
export interface CuerpoVisto {
  readonly voz: VozDePieza;
  readonly posicion: THREE.Vector3Like;
  readonly giro: number;
}

export interface Vista {
  readonly munecos: readonly [MunecoVisto, MunecoVisto];
  readonly cuerpos: readonly CuerpoVisto[];
}

export const UMBRALES = {
  /** Metros andados entre dos pasos. */
  zancada: 0.55,
  /** Más despacio que esto (m/s) no suenan los pasos. */
  andar: 0.35,
  /** Subiendo a más de esto (m/s) al dejar el suelo, es un salto. */
  salto: 1.2,
  /** Bajando a más de esto (m/s) al tocar el suelo, suena el aterrizaje. */
  aterrizar: 1.8,
  /** El muñeco frena tanto (m/s) en `ventana` pasos: un golpe. */
  golpe: 3.5,
  /** Una pieza que frena tanto (m/s) en `ventana` pasos: choca. */
  choque: 1.3,
  /** Los pasos en que se mira cuánto frenó algo. */
  ventana: 3,
  /** Después de sonar, los pasos en que la misma cosa no vuelve a sonar igual (el mismo choque se ve varios pasos). */
  calma: 8,
  /** Más rápido que esto (m/s) no es moverse: es reaparecer o retomar en otro lado. Se olvida lo de antes. */
  salton: 25,
  /** La palanca: girando a más de esto (rad/s) y después casi quieta, llegó al tope. */
  palanca: { gira: 0.9, quieta: 0.15 },
  /** La plancha: hundida más que `abajo` metros suena al hundirse; menos que `arriba`, al subir. */
  plancha: { abajo: 0.035, arriba: 0.015 },
  /** La campana suena en cada vaivén que se aleja más que esto (rad) de colgar derecha. */
  campana: 0.2,
  /** La compuerta arranca cuando se mueve a más de esto (m/s) después de estar quieta. */
  compuerta: { mueve: 0.05, quieta: 0.005 },
  /** Bajando a más de esto (m/s) al entrar al agua, el chapoteo suena del todo. */
  chapoteo: 4,
} as const;

/** Lo que el detector recuerda de algo que se mueve: las últimas velocidades y cuándo sonó. */
interface Rastro {
  antes: { x: number; y: number; z: number } | null;
  /** Las últimas rapideces (m/s), la más nueva al final. */
  rapideces: number[];
  /** La última velocidad vertical (m/s). */
  vy: number;
  /** La velocidad vertical más baja (la más rápida bajando) de los últimos pasos. */
  bajando: number;
  calma: number;
}

const nuevoRastro = (): Rastro => ({ antes: null, rapideces: [], vy: 0, bajando: 0, calma: 0 });

/** Anota la posición nueva; devuelve la velocidad horizontal o `null` si saltó lejos (reaparecer) o es la primera. */
function seguir(r: Rastro, p: THREE.Vector3Like): number | null {
  const a = r.antes;
  r.antes = { x: p.x, y: p.y, z: p.z };
  if (r.calma > 0) r.calma--;
  if (!a) return null;
  const vx = (p.x - a.x) / PASO;
  const vy = (p.y - a.y) / PASO;
  const vz = (p.z - a.z) / PASO;
  const rapidez = Math.hypot(vx, vy, vz);
  if (rapidez > UMBRALES.salton) {
    r.rapideces.length = 0;
    r.vy = 0;
    r.bajando = 0;
    return null;
  }
  r.rapideces.push(rapidez);
  if (r.rapideces.length > UMBRALES.ventana + 1) r.rapideces.shift();
  r.vy = vy;
  r.bajando = Math.min(vy, r.bajando * 0.8);
  return Math.hypot(vx, vz);
}

/** Cuánto frenó en la ventana: la rapidez más alta de antes menos la de ahora. */
function frenada(r: Rastro): number {
  const n = r.rapideces.length;
  if (n < 2) return 0;
  const ahora = r.rapideces[n - 1] ?? 0;
  let maximo = 0;
  for (let i = 0; i < n - 1; i++) maximo = Math.max(maximo, r.rapideces[i] ?? 0);
  return maximo - ahora;
}

const entre01 = (n: number) => Math.min(1, Math.max(0, n));

interface MemoriaMuneco {
  rastro: Rastro;
  estado: EstadoMuneco | null;
  manos: [boolean, boolean];
  agua: 0 | 1 | 2;
  andado: number;
}

interface MemoriaCuerpo {
  rastro: Rastro;
  giro: number;
  /** Rapidez del giro (rad/s) del paso anterior. */
  vgiro: number;
  /** Si el giro venía creciendo (la campana se alejaba de colgar derecha). */
  creciendo: boolean;
  /** La plancha: si está hundida. La compuerta: si se está moviendo. */
  prendida: boolean;
  /** Dónde empezó (para cuánto se hundió la plancha). */
  inicio: number | null;
  quieta: number;
}

export interface Detector {
  /** Mira el mundo después de un paso y devuelve lo que sonó. `sueloDe` dice qué pisa cada muñeco (se pregunta solo
   * cuando hace falta, porque cuesta un rayo). */
  mirar(vista: Vista, sueloDe: (jugador: Jugador) => Suelo): EventoSonido[];
}

export function crearDetector(): Detector {
  const munecos: [MemoriaMuneco, MemoriaMuneco] = [0, 1].map(() => ({
    rastro: nuevoRastro(),
    estado: null,
    manos: [false, false] as [boolean, boolean],
    agua: 0 as const,
    andado: 0,
  })) as [MemoriaMuneco, MemoriaMuneco];
  const cuerpos: MemoriaCuerpo[] = [];

  const mirarMuneco = (
    jugador: Jugador,
    m: MunecoVisto,
    sueloDe: (jugador: Jugador) => Suelo,
    eventos: EventoSonido[],
  ) => {
    const mem = munecos[jugador];
    const r = mem.rastro;
    const bajaba = r.bajando;
    const horizontal = seguir(r, m.pelvis);
    const x = m.pelvis.x;
    const antes = mem.estado;
    mem.estado = m.estado;
    if (horizontal === null || antes === null) {
      // Recién aparece (o reapareció en otro lado): no suena nada de lo que cambió
      mem.manos = [m.manos[0], m.manos[1]];
      mem.agua = m.agua;
      mem.andado = 0;
      return;
    }

    // El estado: salto, aterrizaje, caída
    let sono = false;
    if (antes !== m.estado) {
      if (antes === "de pie" && m.estado === "en el aire" && r.vy > UMBRALES.salto) {
        eventos.push({ cual: "salto", jugador, fuerza: entre01(r.vy / 5), x });
        sono = true;
      } else if (m.estado === "caido") {
        const fuerza = entre01(Math.max(0.3, -bajaba / 8, frenada(r) / 8));
        eventos.push({ cual: "caer", jugador, fuerza, x });
        sono = true;
      } else if (
        antes === "en el aire" &&
        (m.estado === "de pie" || m.estado === "levantandose") &&
        -bajaba > UMBRALES.aterrizar
      ) {
        eventos.push({ cual: "aterrizar", jugador, suelo: sueloDe(jugador), fuerza: entre01(-bajaba / 7), x });
        sono = true;
      }
      if (sono) r.calma = UMBRALES.calma;
    }
    // Un golpe sin cambiar de estado
    if (!sono && r.calma === 0) {
      const frena = frenada(r);
      if (frena > UMBRALES.golpe) {
        eventos.push({ cual: "golpe", jugador, fuerza: entre01(frena / 10), x });
        r.calma = UMBRALES.calma;
      }
    }

    // Los pasos
    if (m.estado === "de pie" && horizontal > UMBRALES.andar) {
      mem.andado += horizontal * PASO;
      if (mem.andado >= UMBRALES.zancada) {
        mem.andado -= UMBRALES.zancada;
        eventos.push({ cual: "paso", jugador, suelo: sueloDe(jugador), fuerza: entre01(horizontal / 3.5), x });
      }
    } else if (m.estado !== "de pie") mem.andado = UMBRALES.zancada / 2;

    // Las manos
    for (const i of [0, 1] as const) {
      const ahora = m.manos[i];
      if (ahora !== mem.manos[i]) eventos.push({ cual: ahora ? "agarrar" : "soltar", jugador, fuerza: 0.7, x });
      mem.manos[i] = ahora;
    }

    // El agua: suena al entrar (al salir no)
    if (m.agua > mem.agua) {
      const fuerza = entre01(Math.max(m.agua === 2 ? 0.6 : 0.35, -bajaba / UMBRALES.chapoteo));
      eventos.push({ cual: "chapoteo", jugador, fuerza, x });
    }
    mem.agua = m.agua;
  };

  const mirarCuerpo = (i: number, c: CuerpoVisto, eventos: EventoSonido[]) => {
    let mem = cuerpos[i];
    if (!mem) {
      mem = {
        rastro: nuevoRastro(),
        giro: c.giro,
        vgiro: 0,
        creciendo: false,
        prendida: false,
        inicio: null,
        quieta: 0,
      };
      cuerpos[i] = mem;
    }
    const r = mem.rastro;
    const primera = r.antes === null;
    const horizontal = seguir(r, c.posicion);
    const vgiro = (c.giro - mem.giro) / PASO;
    const giroAntes = mem.giro;
    mem.giro = c.giro;
    mem.inicio ??= c.posicion.y;
    if (horizontal === null) {
      mem.vgiro = 0;
      if (!primera) mem.inicio = c.posicion.y;
      return;
    }
    const x = c.posicion.x;
    const rapidez = r.rapideces[r.rapideces.length - 1] ?? 0;

    switch (c.voz) {
      case "palanca": {
        // Llega al tope: venía girando rápido y se frena de golpe
        if (Math.abs(mem.vgiro) > UMBRALES.palanca.gira && Math.abs(vgiro) < UMBRALES.palanca.quieta && r.calma === 0) {
          eventos.push({ cual: "pieza", voz: "palanca", fuerza: entre01(Math.abs(mem.vgiro) / 4), x });
          r.calma = UMBRALES.calma;
        }
        break;
      }
      case "plancha": {
        const hundida = mem.inicio - c.posicion.y;
        if (!mem.prendida && hundida > UMBRALES.plancha.abajo) {
          mem.prendida = true;
          eventos.push({ cual: "pieza", voz: "plancha", fuerza: 1, x });
        } else if (mem.prendida && hundida < UMBRALES.plancha.arriba) {
          mem.prendida = false;
          eventos.push({ cual: "pieza", voz: "plancha", fuerza: 0.5, x });
        }
        break;
      }
      case "campana": {
        // Suena en la punta de cada vaivén: el giro dejó de crecer, lejos de colgar derecha
        const creciendo = c.giro > giroAntes;
        if (mem.creciendo && !creciendo && giroAntes > UMBRALES.campana)
          eventos.push({ cual: "pieza", voz: "campana", fuerza: entre01(giroAntes / 0.8), x });
        mem.creciendo = creciendo;
        break;
      }
      case "compuerta": {
        // Arranca a moverse después de estar quieta; al pararse, un golpe de madera
        if (!mem.prendida && rapidez > UMBRALES.compuerta.mueve && mem.quieta > 10) {
          mem.prendida = true;
          eventos.push({ cual: "pieza", voz: "compuerta", fuerza: 1, x });
        } else if (mem.prendida && rapidez < UMBRALES.compuerta.quieta) {
          mem.prendida = false;
          eventos.push({ cual: "pieza", voz: "madera", fuerza: 0.6, x });
        }
        mem.quieta = rapidez < UMBRALES.compuerta.quieta ? mem.quieta + 1 : 0;
        break;
      }
      case "madera":
      case "piedra": {
        const frena = frenada(r);
        if (frena > UMBRALES.choque && r.calma === 0) {
          eventos.push({ cual: "pieza", voz: c.voz, fuerza: entre01(frena / 6), x });
          r.calma = UMBRALES.calma;
        }
        break;
      }
    }
    mem.vgiro = vgiro;
  };

  return {
    mirar(vista, sueloDe) {
      const eventos: EventoSonido[] = [];
      mirarMuneco(0, vista.munecos[0], sueloDe, eventos);
      mirarMuneco(1, vista.munecos[1], sueloDe, eventos);
      vista.cuerpos.forEach((c, i) => {
        mirarCuerpo(i, c, eventos);
      });
      return eventos;
    },
  };
}
