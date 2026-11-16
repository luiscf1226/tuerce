// El fundido en niebla (TU-62): al abrir un nivel, al pasar al siguiente y al reaparecer después de caer al vacío,
// la imagen se va a la niebla y vuelve, en vez de cortar.
//
//   · Al abrir un nivel la escena sale de la niebla (`fundidoDeEntrada`).
//   · «Siguiente nivel» funde la página a la niebla antes de irse (`irConFundido`); la página nueva tiene el mismo
//     fondo (estilo.css) mientras baja el nivel, y después sale de la niebla.
//   · Al caer al vacío la niebla sube mientras se cae (`fundidoDeCaida`) y, al reaparecer, se levanta
//     (`fundidoTrasReaparecer`). Cada jugador tiene el suyo: con la pantalla partida se funde solo su mitad, y con
//     la pantalla entera, un fundido más suave (`SUAVE`), porque el compañero sigue jugando ahí mismo.
//
// Las curvas son de pasos de físicas, no del reloj: con `?congelar=N` la imagen sale igual siempre. Las dibuja
// escenas/orientacion.ts; aquí no se toca la página salvo en `irConFundido`.

/** Pasos que tarda la escena en salir de la niebla al abrir un nivel. */
export const FUNDIDO_ENTRADA = 54;
/** Metros sobre el vacío del nivel desde donde empieza a subir la niebla al caer. */
export const CAIDA = 2.5;
/** Velocidad hacia abajo (m/s) desde la que cuenta como caída: parado en lo más bajo del nivel no hay niebla. */
export const CAYENDO = 1.5;
/** Pasos que tarda en levantarse la niebla después de reaparecer. */
export const FUNDIDO_REAPARECER = 45;
/** Lo más espesa que se pone la niebla de un jugador (de 0 a 1). */
export const PICO = 0.88;
/** Con la pantalla sin partir, la niebla de uno se ve así de suave: el otro sigue jugando en la misma imagen. */
export const SUAVE = 0.55;

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Cuánta niebla hay `pasos` después de abrir el nivel: 1 al principio, 0 desde `FUNDIDO_ENTRADA`. */
export function fundidoDeEntrada(pasos: number): number {
  return 1 - suave(pasos / FUNDIDO_ENTRADA);
}

/** Cuánta niebla hay mientras uno cae: 0 lejos del vacío o sin ir para abajo, `PICO` al llegar al vacío. */
export function fundidoDeCaida(altura: number, vacio: number, velocidadVertical: number): number {
  if (velocidadVertical > -CAYENDO) return 0;
  return PICO * suave((vacio + CAIDA - altura) / CAIDA);
}

/** Cuánta niebla hay `pasos` después de reaparecer: `PICO` al reaparecer, 0 desde `FUNDIDO_REAPARECER`. */
export function fundidoTrasReaparecer(pasos: number): number {
  if (pasos < 0) return 0;
  return PICO * (1 - suave(pasos / FUNDIDO_REAPARECER));
}

/**
 * La niebla de cada vista: la de la cámara del rojo (la única con la pantalla entera) y la de la del turquesa.
 * `costura` va de 0 (la pantalla entera) a 1 (bien partida); entre medio se pasa de una a otra sin saltos.
 * `entrada` (la de abrir el nivel) tapa las dos.
 */
export function nieblaDeLasVistas(
  rojo: number,
  turquesa: number,
  costura: number,
  entrada = 0,
): readonly [number, number] {
  const entera = Math.max(rojo, turquesa) * SUAVE;
  const c = Math.min(1, Math.max(0, costura));
  return [Math.max(entrada, entera + (rojo - entera) * c), Math.max(entrada, entera + (turquesa - entera) * c)];
}

// ── En la página ────────────────────────────────────────────────────────────────────────────────────────────────

/** Cuánto tarda la página en irse a la niebla antes de cambiar de nivel (ms). */
const SALIDA_MS = 550;

/** Funde la página a la niebla y se va a `direccion` (el nivel siguiente). */
export function irConFundido(direccion: string): void {
  if (typeof document === "undefined" || document.querySelector(".fundido-salida")) {
    location.assign(direccion);
    return;
  }
  const velo = document.body.appendChild(document.createElement("div"));
  velo.className = "fundido-salida";
  velo.setAttribute("aria-hidden", "true");
  Object.assign(velo.style, {
    position: "fixed",
    inset: "0",
    zIndex: "20",
    background: "#dcdcd8",
    opacity: "0",
    transition: `opacity ${SALIDA_MS}ms ease-in`,
    pointerEvents: "none",
  });
  // Un cuadro después, para que la transición arranque desde 0
  requestAnimationFrame(() => {
    velo.style.opacity = "1";
  });
  setTimeout(() => location.assign(direccion), SALIDA_MS + 30);
}
