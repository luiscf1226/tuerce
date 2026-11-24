// Ayudita en pantalla con los controles de cada jugador y con qué juega cada uno (teclado o mando). Aparece al
// empezar y cada vez que un mando se suma, se va o cambia de jugador, y se desvanece a los pocos segundos.
import { COLORES } from "../escenas/colores";
import { type Asignacion, type Controles, JUGADORES, type Jugador } from "./mandos";
import "./ayuda.css";

/** Cuánto se queda a la vista antes de desvanecerse (ms). */
const A_LA_VISTA = 6000;

const QUIEN = [
  { nombre: "Jugador 1", panuelo: COLORES.panueloRojo },
  { nombre: "Jugador 2", panuelo: COLORES.panueloTurquesa },
] as const;

const TECLADO = [
  ["W S", "caminar"],
  ["A D", "girar"],
  ["Espacio", "saltar"],
  ["Q E", "brazos"],
  ["Z", "señalar"],
  ["X + dirección", "gesto"],
] as const;
const TECLADO_2 = [
  ["↑ ↓", "caminar"],
  ["← →", "girar"],
  ["Enter", "saltar"],
  [", .", "brazos"],
  ["/", "señalar"],
  ["Shift der. + dirección", "gesto"],
] as const;
const MANDO = [
  ["palanca", "caminar y girar"],
  ["A", "saltar"],
  ["LB RB", "brazos"],
  ["Y", "señalar"],
  ["X + dirección", "gesto"],
  ["Back", "cambiar de jugador"],
] as const;

/** Todos los controles, para la pantalla de controles del menú (TU-15). */
export const DESCRIPCION_CONTROLES: readonly {
  nombre: string;
  clase: string;
  filas: readonly (readonly [string, string])[];
}[] = [
  { nombre: "Jugador 1 · teclado", clase: "j1", filas: TECLADO },
  { nombre: "Jugador 2 · teclado", clase: "j2", filas: TECLADO_2 },
  {
    nombre: "Con mando",
    clase: "mando",
    filas: [...MANDO, ["Start", "pausa"]],
  },
  {
    nombre: "Gestos y pausa",
    clase: "gestos",
    filas: [
      ["adelante", "festejar"],
      ["atrás", "encogerse de hombros"],
      ["izquierda", "saludar"],
      ["derecha", "llamar"],
      ["Esc o P", "pausa"],
    ],
  },
];

/** Lo mismo con los dedos (src/entrada/tactil.ts): cada uno en su mitad de la pantalla. La pausa la dice «Cómo se juega». */
const DEDOS: readonly (readonly [string, string])[] = [
  ["palanca", "caminar y girar (arrastren el dedo)"],
  ["Agarrar", "mientras lo sostienen, los dos brazos arriba"],
  ["Saltar", "saltar"],
  ["¡Eh!", "festejar"],
];
export const DESCRIPCION_TACTIL: typeof DESCRIPCION_CONTROLES = [
  { nombre: "Rojo · mitad izquierda", clase: "j1", filas: DEDOS },
  { nombre: "Turquesa · mitad derecha", clase: "j2", filas: DEDOS },
];

/** Con qué juega cada jugador, en palabras. */
export function dispositivoDe(asignacion: Asignacion, jugador: Jugador): string {
  const mando = asignacion[jugador];
  return mando === null ? "teclado" : `mando ${mando + 1}`;
}

/** Pone la ayuda en la página. `siempre` la deja fija (para las capturas). */
export function crearAyuda(controles: Controles, { siempre = false } = {}): HTMLElement {
  const caja = document.body.appendChild(document.createElement("aside"));
  caja.className = "ayuda-jugadores";
  let reloj: ReturnType<typeof setTimeout> | undefined;

  const mostrar = (asignacion: Asignacion) => {
    // Con los dedos, los botones en pantalla ya dicen qué hace cada uno: no hay teclas que explicar
    if (controles.tactil && !siempre) {
      caja.classList.add("oculta");
      return;
    }
    caja.replaceChildren(
      ...JUGADORES.map((j) => {
        const bloque = document.createElement("section");
        const titulo = bloque.appendChild(document.createElement("h2"));
        const punto = titulo.appendChild(document.createElement("span"));
        punto.className = "panuelo";
        punto.style.background = `#${QUIEN[j].panuelo.toString(16).padStart(6, "0")}`;
        titulo.append(QUIEN[j].nombre);
        const con = titulo.appendChild(document.createElement("small"));
        con.textContent = dispositivoDe(asignacion, j);
        const lista = bloque.appendChild(document.createElement("dl"));
        const filas = asignacion[j] === null ? (j === 0 ? TECLADO : TECLADO_2) : MANDO;
        for (const [tecla, que] of filas) {
          lista.appendChild(document.createElement("dt")).textContent = tecla;
          lista.appendChild(document.createElement("dd")).textContent = que;
        }
        return bloque;
      }),
    );
    if (asignacion[0] === null || asignacion[1] === null) {
      const pie = caja.appendChild(document.createElement("p"));
      pie.textContent = "Con un mando: apretá cualquier botón para sumarte.";
    }
    caja.classList.remove("oculta");
    clearTimeout(reloj);
    if (!siempre) reloj = setTimeout(() => caja.classList.add("oculta"), A_LA_VISTA);
  };

  mostrar(controles.asignacion);
  controles.alCambiar(mostrar);
  return caja;
}
