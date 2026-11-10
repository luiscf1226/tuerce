// La entrada de los dos jugadores en el mismo lugar: teclado compartido, dos mandos, o teclado y un mando.
//
//   Jugador 1 (pañuelo rojo)      W/S camina · A/D gira · Espacio salta · Q/E brazo izquierdo/derecho
//   Jugador 2 (pañuelo turquesa)  ↑/↓ camina · ←/→ gira · Enter salta · ,/. (o 1/3 del teclado numérico) brazos
//   Mando (mapeo estándar)        palanca izquierda o cruceta camina y gira · A/Cruz salta · LB/LT brazo
//                                 izquierdo · RB/RT brazo derecho · Back/Select cambia de jugador
//
// Las teclas se leen por `KeyboardEvent.code` (la tecla física), así que dan lo mismo en un teclado en español,
// latinoamericano o inglés. El Control derecho no se usa para saltar: con el jugador 1 apretando W, Ctrl+W cierra
// la pestaña y el navegador no deja impedirlo.
//
// Mandos: el primero que aprieta un botón se suma y va al jugador 2 (el 1 sigue en el teclado); el segundo va al
// jugador 1. Back/Select pasa ese mando al otro jugador (si el otro tenía mando, se lo cambian). Si un mando se
// desconecta, su jugador vuelve al teclado. El teclado de cada jugador sigue andando aunque tenga mando.
//
// `leer()` se llama una vez por paso de físicas: ahí se leen los mandos y las teclas apretadas, así cada paso ve una
// sola entrada. Los eventos del teclado solo anotan qué teclas están apretadas.
//
// Parámetros de la dirección para capturas que salen siempre igual (con `congelar=N`); fijan la entrada de los dos
// jugadores y apagan teclado y mandos:
//   &j1=andar:1,girar:0.2,saltar:1   entrada fija del jugador 1 (claves: andar, girar, saltar, izq, der)
//   &j2=andar:0.8                    entrada fija del jugador 2
//   &andar=…&girar=…                 lo de siempre: entrada fija del jugador 1 (si no hay `j1`)
// El jugador que no aparece se queda quieto.
import { parametrosDeLaDireccion } from "./teclado";

/** Lo que pide cada jugador en un paso. Sirve tal cual como `EntradaMuneco`. */
export interface EntradaJugador {
  /** Hacia adelante (1) o hacia atrás (-1). */
  avanzar: number;
  /** Girar a la izquierda (1) o a la derecha (-1). */
  girar: number;
  saltar: boolean;
  /** Levantar el brazo izquierdo (para agarrar). */
  brazoIzquierdo: boolean;
  brazoDerecho: boolean;
}

export type Jugador = 0 | 1;
export const JUGADORES: readonly Jugador[] = [0, 1];

export function entradaQuieta(): EntradaJugador {
  return { avanzar: 0, girar: 0, saltar: false, brazoIzquierdo: false, brazoDerecho: false };
}

// ── Teclado ────────────────────────────────────────────────────────────────────────────────────────────────

export type Accion = "adelante" | "atras" | "izquierda" | "derecha" | "saltar" | "brazoIzquierdo" | "brazoDerecho";

/** Qué hace cada tecla (por `KeyboardEvent.code`) para cada jugador. Ninguna tecla está en los dos. */
export const TECLAS: readonly [Readonly<Record<string, Accion>>, Readonly<Record<string, Accion>>] = [
  {
    KeyW: "adelante",
    KeyS: "atras",
    KeyA: "izquierda",
    KeyD: "derecha",
    Space: "saltar",
    KeyQ: "brazoIzquierdo",
    KeyE: "brazoDerecho",
  },
  {
    ArrowUp: "adelante",
    ArrowDown: "atras",
    ArrowLeft: "izquierda",
    ArrowRight: "derecha",
    Enter: "saltar",
    NumpadEnter: "saltar",
    Numpad0: "saltar",
    Comma: "brazoIzquierdo",
    Period: "brazoDerecho",
    Numpad1: "brazoIzquierdo",
    Numpad3: "brazoDerecho",
  },
];

/** Si la tecla es de algún jugador (las demás no se tocan, así el navegador sigue andando). */
export function esTeclaDelJuego(codigo: string): boolean {
  return codigo in TECLAS[0] || codigo in TECLAS[1];
}

/** Lo que piden las teclas apretadas para un jugador, cada eje entre -1 y 1. */
export function leerTeclasDe(jugador: Jugador, apretadas: Iterable<string>): EntradaJugador {
  const mapa = TECLAS[jugador];
  const entrada = entradaQuieta();
  for (const codigo of apretadas) {
    switch (mapa[codigo]) {
      case "adelante":
        entrada.avanzar += 1;
        break;
      case "atras":
        entrada.avanzar -= 1;
        break;
      case "izquierda":
        entrada.girar += 1;
        break;
      case "derecha":
        entrada.girar -= 1;
        break;
      case "saltar":
        entrada.saltar = true;
        break;
      case "brazoIzquierdo":
        entrada.brazoIzquierdo = true;
        break;
      case "brazoDerecho":
        entrada.brazoDerecho = true;
        break;
    }
  }
  return limitarEjes(entrada);
}

// ── Mandos ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Lo que se usa de un `Gamepad`: así las pruebas pasan uno de mentira. */
export interface MandoLeido {
  readonly index: number;
  readonly connected: boolean;
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

/** Por debajo de esto la palanca cuenta como suelta (los mandos gastados nunca vuelven a 0 del todo). */
export const ZONA_MUERTA = 0.2;
/** Desde cuánto un gatillo analógico cuenta como apretado. */
const GATILLO = 0.3;

/** Botones del mapeo estándar (https://w3c.github.io/gamepad/#remapping). */
export const BOTON = {
  a: 0,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  arriba: 12,
  abajo: 13,
  izquierda: 14,
  derecha: 15,
} as const;

function apretado(mando: MandoLeido, boton: number): boolean {
  const b = mando.buttons[boton];
  return b !== undefined && (b.pressed || b.value > GATILLO);
}

/** Si el mando tiene algún botón apretado (para sumarse al juego). */
export function algunBoton(mando: MandoLeido): boolean {
  return mando.buttons.some((b) => b.pressed || b.value > GATILLO);
}

/** Palanca con zona muerta circular: dentro no cuenta, y fuera se reescala para que arranque en 0 sin saltos. */
export function aplicarZonaMuerta(x: number, y: number, zona = ZONA_MUERTA): [number, number] {
  const largo = Math.hypot(x, y);
  if (largo <= zona) return [0, 0];
  const escala = Math.min(1, (largo - zona) / (1 - zona)) / largo;
  return [x * escala, y * escala];
}

/** Lo que pide un mando de mapeo estándar. En la palanca, arriba es -y y derecha es +x. */
export function leerMando(mando: MandoLeido, zona = ZONA_MUERTA): EntradaJugador {
  const [x, y] = aplicarZonaMuerta(mando.axes[0] ?? 0, mando.axes[1] ?? 0, zona);
  const cruceta = (mas: number, menos: number) => (apretado(mando, mas) ? 1 : 0) - (apretado(mando, menos) ? 1 : 0);
  return limitarEjes({
    avanzar: -y + cruceta(BOTON.arriba, BOTON.abajo),
    girar: -x + cruceta(BOTON.izquierda, BOTON.derecha),
    saltar: apretado(mando, BOTON.a),
    brazoIzquierdo: apretado(mando, BOTON.lb) || apretado(mando, BOTON.lt),
    brazoDerecho: apretado(mando, BOTON.rb) || apretado(mando, BOTON.rt),
  });
}

/** Junta dos entradas del mismo jugador (teclado y mando): los ejes se suman y los botones valen si alguno está. */
export function juntarEntradas(a: EntradaJugador, b: EntradaJugador): EntradaJugador {
  return limitarEjes({
    avanzar: a.avanzar + b.avanzar,
    girar: a.girar + b.girar,
    saltar: a.saltar || b.saltar,
    brazoIzquierdo: a.brazoIzquierdo || b.brazoIzquierdo,
    brazoDerecho: a.brazoDerecho || b.brazoDerecho,
  });
}

// ── A quién va cada mando ──────────────────────────────────────────────────────────────────────────────────

/** Qué mando (por `Gamepad.index`) tiene cada jugador; `null` es que juega con el teclado. */
export type Asignacion = readonly [number | null, number | null];
export const SIN_MANDOS: Asignacion = [null, null];

export function jugadorDelMando(asignacion: Asignacion, mando: number): Jugador | undefined {
  return JUGADORES.find((j) => asignacion[j] === mando);
}

/** Suma un mando: va al jugador 2 si está libre (el 1 se queda con el teclado), si no al 1. Con los dos ocupados
 * no cambia nada. */
export function sumarMando(asignacion: Asignacion, mando: number): Asignacion {
  if (jugadorDelMando(asignacion, mando) !== undefined) return asignacion;
  if (asignacion[1] === null) return [asignacion[0], mando];
  if (asignacion[0] === null) return [mando, asignacion[1]];
  return asignacion;
}

/** Saca un mando (se desconectó): su jugador vuelve al teclado. */
export function quitarMando(asignacion: Asignacion, mando: number): Asignacion {
  return [asignacion[0] === mando ? null : asignacion[0], asignacion[1] === mando ? null : asignacion[1]];
}

/** Pasa el mando al otro jugador; si el otro tenía mando, se los cambian. */
export function cambiarDeJugador(asignacion: Asignacion, mando: number): Asignacion {
  if (jugadorDelMando(asignacion, mando) === undefined) return asignacion;
  return [asignacion[1], asignacion[0]];
}

// ── Entrada fija por la dirección ──────────────────────────────────────────────────────────────────────────

const CLAVES: Record<string, keyof EntradaJugador> = {
  andar: "avanzar",
  avanzar: "avanzar",
  girar: "girar",
  saltar: "saltar",
  izq: "brazoIzquierdo",
  brazoIzquierdo: "brazoIzquierdo",
  der: "brazoDerecho",
  brazoDerecho: "brazoDerecho",
};

/** Lee `andar:1,girar:0.2,saltar` (una clave sola vale 1). Las claves que no conoce no cuentan. */
export function leerEntradaFija(texto: string): EntradaJugador {
  const entrada = entradaQuieta();
  for (const parte of texto.split(",")) {
    const [clave = "", valor = "1"] = parte.split(":").map((s) => s.trim());
    const campo = CLAVES[clave];
    const numero = Number(valor) || 0;
    if (campo === "avanzar" || campo === "girar") entrada[campo] = numero;
    else if (campo) entrada[campo] = numero !== 0;
  }
  return limitarEjes(entrada);
}

/** La entrada fija de los dos jugadores si la dirección la pide; si no, `undefined`. */
export function entradasFijas(parametros: URLSearchParams): [EntradaJugador, EntradaJugador] | undefined {
  const j1 = parametros.get("j1");
  const j2 = parametros.get("j2");
  const andar = parametros.get("andar");
  const girar = parametros.get("girar");
  if (j1 === null && j2 === null && andar === null && girar === null) return undefined;
  const viejo = [andar !== null && `andar:${andar}`, girar !== null && `girar:${girar}`].filter(Boolean).join(",");
  return [leerEntradaFija(j1 ?? viejo), leerEntradaFija(j2 ?? "")];
}

// ── Los controles vivos ────────────────────────────────────────────────────────────────────────────────────

export interface Controles {
  /** Lee teclado y mandos. Una vez por paso de físicas, antes de `muneco.pasar`. */
  leer(): readonly [EntradaJugador, EntradaJugador];
  /** Qué mando tiene cada jugador ahora. */
  readonly asignacion: Asignacion;
  /** Si la entrada viene fija de la dirección (capturas): teclado y mandos no cuentan. */
  readonly fija: boolean;
  /** Avisa cuando un mando se suma, se va o cambia de jugador. */
  alCambiar(aviso: (asignacion: Asignacion) => void): void;
}

export interface OpcionesControles {
  parametros?: URLSearchParams;
  /** De dónde salen los mandos; por defecto `navigator.getGamepads()`. */
  mandos?: () => readonly (MandoLeido | null)[];
  /** Dónde se escucha el teclado; por defecto `window` (no hay en Node). */
  teclado?: Pick<Window, "addEventListener">;
}

function mandosDelNavegador(): readonly (MandoLeido | null)[] {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return navigator.getGamepads();
}

export function crearControles(opciones: OpcionesControles = {}): Controles {
  const fijas = entradasFijas(opciones.parametros ?? parametrosDeLaDireccion());
  const obtenerMandos = opciones.mandos ?? mandosDelNavegador;
  const avisos: ((a: Asignacion) => void)[] = [];
  let asignacion: Asignacion = SIN_MANDOS;
  /** Si Back estaba apretado en el paso anterior, por mando: cambia de jugador al apretarlo, no mientras se tiene. */
  const backAntes = new Map<number, boolean>();

  const apretadas = new Set<string>();
  const teclado = opciones.teclado ?? (typeof window === "undefined" ? undefined : window);
  if (!fijas && teclado) {
    teclado.addEventListener("keydown", (e) => {
      if (!esTeclaDelJuego(e.code)) return;
      e.preventDefault();
      apretadas.add(e.code);
    });
    teclado.addEventListener("keyup", (e) => {
      apretadas.delete(e.code);
    });
    teclado.addEventListener("blur", () => apretadas.clear());
  }

  const cambiar = (nueva: Asignacion) => {
    if (nueva[0] === asignacion[0] && nueva[1] === asignacion[1]) return;
    asignacion = nueva;
    for (const aviso of avisos) aviso(asignacion);
  };

  return {
    get asignacion() {
      return asignacion;
    },
    fija: fijas !== undefined,
    alCambiar(aviso) {
      avisos.push(aviso);
    },
    leer() {
      if (fijas) return fijas;
      const conectados = new Map<number, MandoLeido>();
      for (const m of obtenerMandos()) if (m?.connected) conectados.set(m.index, m);

      // Los que se fueron sueltan a su jugador
      let nueva = asignacion;
      for (const j of JUGADORES) {
        const indice = nueva[j];
        if (indice !== null && !conectados.has(indice)) {
          nueva = quitarMando(nueva, indice);
          backAntes.delete(indice);
        }
      }
      // Los nuevos se suman al apretar cualquier botón; los de siempre cambian de jugador con Back
      for (const [indice, mando] of conectados) {
        const back = apretado(mando, BOTON.back);
        if (jugadorDelMando(nueva, indice) === undefined) {
          if (algunBoton(mando)) nueva = sumarMando(nueva, indice);
        } else if (back && !backAntes.get(indice)) {
          nueva = cambiarDeJugador(nueva, indice);
        }
        backAntes.set(indice, back);
      }
      cambiar(nueva);

      const salida = JUGADORES.map((j) => {
        const deTeclado = leerTeclasDe(j, apretadas);
        const indice = asignacion[j];
        const mando = indice === null ? undefined : conectados.get(indice);
        return mando ? juntarEntradas(deTeclado, leerMando(mando)) : deTeclado;
      });
      return [salida[0] ?? entradaQuieta(), salida[1] ?? entradaQuieta()];
    },
  };
}

function limitarEjes(e: EntradaJugador): EntradaJugador {
  e.avanzar = Math.max(-1, Math.min(1, e.avanzar));
  e.girar = Math.max(-1, Math.min(1, e.girar));
  return e;
}
