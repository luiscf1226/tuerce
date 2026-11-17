// La hoja de la misión: una tarjeta clara arriba a la izquierda que dice qué hay que hacer. Dos maneras:
//
//   lecciones  (el tutorial) la lección de turno en grande: qué hacer, con qué teclas cada jugador y cuánto falta,
//              y abajo una fila de puntos con las lecciones que van.
//   lista      (los niveles) todos los objetivos en una lista, tachados al cumplirse; los opcionales (el secreto y
//              el logro) más chicos.
//
// Solo toca la página cuando el tablero avisa que algo cambió. Los textos que no tocan la página (la ceja, el
// estado de cada fila) se prueban en mision.test.ts.
import { COLORES } from "../escenas/colores";
import { type Medida, type Objetivo, type Tablero, textoDeCuenta } from "../misiones/tablero";
import { cargarFuentes } from "./contrarreloj";
import "./mision.css";

export type ModoHoja = "lecciones" | "lista";

/** «Cómo jugar · 3 de 6», o «Cómo jugar · ¡listos!» al terminar. */
export function cejaDeLecciones(titulo: string, tablero: Pick<Tablero, "actual" | "obligatorios">): string {
  if (tablero.actual >= tablero.obligatorios) return `${titulo} · ¡listos!`;
  return `${titulo} · ${tablero.actual + 1} de ${tablero.obligatorios}`;
}

/** Cómo se ve una fila de la lista: cumplida, la de turno (la primera sin cumplir) o pendiente. */
export function estadoDeFila(medida: Medida, indice: number, actual: number): "hecho" | "turno" | "pendiente" {
  if (medida.hecho) return "hecho";
  return indice === actual ? "turno" : "pendiente";
}

function elemento<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** Las teclas de la lección: una fila por jugador, con su pañuelo, y la del mando. */
function teclasDe(objetivo: Objetivo): HTMLElement | null {
  if (!objetivo.teclas) return null;
  const lista = elemento("dl", "mision-teclas");
  const filas: [string, string, number | null][] = [
    ["Rojo", objetivo.teclas.rojo, COLORES.panueloRojo],
    ["Turquesa", objetivo.teclas.turquesa, COLORES.panueloTurquesa],
    ["Mando", objetivo.teclas.mando, null],
  ];
  for (const [quien, teclas, color] of filas) {
    const dt = lista.appendChild(elemento("dt", ""));
    if (color !== null) dt.appendChild(elemento("i", "panuelo")).style.background = hex(color);
    dt.append(quien);
    lista.appendChild(elemento("dd", "", teclas));
  }
  return lista;
}

export interface HojaDeMision {
  readonly caja: HTMLElement;
  /** Una línea corta que aparece un rato debajo («¡Bien!»). */
  festejar(texto: string): void;
  quitar(): void;
}

export function crearHojaDeMision(
  tablero: Tablero,
  { titulo, modo }: { titulo: string; modo: ModoHoja },
): HojaDeMision {
  cargarFuentes();
  const caja = document.body.appendChild(elemento("aside", `mision mision-${modo}`));
  caja.setAttribute("aria-live", "polite");
  const festejo = elemento("p", "mision-festejo");
  let reloj: ReturnType<typeof setTimeout> | undefined;

  const pintarLecciones = () => {
    const actual = tablero.actual;
    const hijos: HTMLElement[] = [elemento("p", "mision-ceja", cejaDeLecciones(titulo, tablero))];
    const objetivo = tablero.objetivos[actual];
    if (objetivo) {
      const medida = tablero.medida(actual);
      hijos.push(elemento("h2", "mision-titulo", objetivo.titulo), elemento("p", "mision-texto", objetivo.texto));
      const teclas = teclasDe(objetivo);
      if (teclas) hijos.push(teclas);
      const cuenta = textoDeCuenta(medida);
      if (cuenta) hijos.push(elemento("p", "mision-cuenta", cuenta));
      caja.dataset.objetivo = objetivo.id;
    } else {
      hijos.push(elemento("h2", "mision-titulo", "¡Ya saben jugar!"));
      caja.dataset.objetivo = "listo";
    }
    const puntos = elemento("ol", "mision-puntos");
    puntos.setAttribute("aria-hidden", "true");
    tablero.objetivos.forEach((o, i) => {
      if (o.opcional) return;
      puntos.appendChild(elemento("li", estadoDeFila(tablero.medida(i), i, actual)));
    });
    hijos.push(puntos, festejo);
    caja.replaceChildren(...hijos);
  };

  const pintarLista = () => {
    const actual = tablero.actual;
    const lista = elemento("ul", "mision-lista");
    tablero.objetivos.forEach((o, i) => {
      const medida = tablero.medida(i);
      const fila = lista.appendChild(
        elemento("li", `${estadoDeFila(medida, i, actual)}${o.opcional ? " opcional" : ""}`),
      );
      fila.dataset.objetivo = o.id;
      fila.appendChild(elemento("span", "marca", medida.hecho ? "✓" : "")).setAttribute("aria-hidden", "true");
      const texto = fila.appendChild(elemento("span", "texto"));
      texto.append(elemento("strong", "", o.titulo));
      const cuenta = textoDeCuenta(medida);
      if (cuenta) texto.append(elemento("span", "cuenta", ` · ${cuenta}`));
      texto.append(elemento("small", "", o.texto));
    });
    caja.replaceChildren(elemento("p", "mision-ceja", titulo), lista, festejo);
  };

  const pintar = modo === "lecciones" ? pintarLecciones : pintarLista;
  pintar();
  const dejar = tablero.alCambiar(pintar);
  return {
    caja,
    festejar(texto) {
      festejo.textContent = texto;
      festejo.classList.remove("se-va");
      clearTimeout(reloj);
      reloj = setTimeout(() => festejo.classList.add("se-va"), 1800);
    },
    quitar() {
      dejar();
      caja.remove();
    },
  };
}
