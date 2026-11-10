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
] as const;
const TECLADO_2 = [
  ["↑ ↓", "caminar"],
  ["← →", "girar"],
  ["Enter", "saltar"],
  [", .", "brazos"],
] as const;
const MANDO = [
  ["palanca", "caminar y girar"],
  ["A", "saltar"],
  ["LB RB", "brazos"],
  ["Back", "cambiar de jugador"],
] as const;

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
