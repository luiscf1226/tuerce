// La hoja de la misión: una tarjeta clara arriba a la izquierda que dice qué hay que hacer. Dos maneras:
//
//   lecciones  (el tutorial) la lección de turno en grande: qué hacer, con qué teclas cada jugador y cuánto falta,
//              y abajo una fila de puntos con las lecciones que van.
//   lista      (los niveles) todos los objetivos en una lista, tachados al cumplirse; los opcionales (el secreto y
//              el logro) más chicos. Si la meta trae la guía del nivel, debajo va «Ahora»: el tramo que toca hasta el
//              próximo punto de control y cómo se hace. Con H se abre la ayuda: todos los tramos y los controles de
//              los dos; en la pausa, el menú muestra lo mismo (`resumen`), así también la ve quien juega con mando.
//
// Solo toca la página cuando el tablero avisa que algo cambió. Los textos que no tocan la página (la ceja, el
// estado de cada fila) se prueban en mision.test.ts.
import { DESCRIPCION_CONTROLES } from "../entrada/ayuda";
import { COLORES } from "../escenas/colores";
import { type Medida, type Objetivo, type Paso, pasoActual, type Tablero, textoDeCuenta } from "../misiones/tablero";
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

/** La tecla que abre y cierra la ayuda de la misión. No es de ningún jugador (entrada/mandos.ts). */
export const TECLA_AYUDA = "KeyH";

/** Los controles en una línea por jugador, para la ayuda: lo de moverse y agarrar, sin los gestos. En línea cada
 * pantalla maneja un solo muñeco con cualquiera de los dos lados del teclado (en-linea.ts): una línea con los dos. */
export function controlesEnUnaLinea(
  enLinea = false,
): readonly { quien: string; color: number | null; linea: string }[] {
  const filas = (i: number) => (DESCRIPCION_CONTROLES[i]?.filas ?? []).slice(0, 4);
  const linea = (i: number) =>
    filas(i)
      .map(([tecla, que]) => `${tecla} ${que}`)
      .join(" · ");
  const mando = { quien: "Mando", color: null, linea: linea(2) };
  if (enLinea) {
    const otro = filas(1);
    const teclado = filas(0)
      .map(([tecla, que], i) => `${tecla} / ${otro[i]?.[0] ?? ""} ${que}`)
      .join(" · ");
    return [{ quien: "Teclado", color: null, linea: teclado }, mando];
  }
  return [
    { quien: "Rojo", color: COLORES.panueloRojo, linea: linea(0) },
    { quien: "Turquesa", color: COLORES.panueloTurquesa, linea: linea(1) },
    mando,
  ];
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

/** Lo táctil de una lección para cada jugador: «izquierda · palanca». */
export function filasTactiles(tactil: string): readonly [string, string][] {
  return [
    ["Rojo", `mitad izquierda · ${tactil}`],
    ["Turquesa", `mitad derecha · ${tactil}`],
  ];
}

/** Las teclas de la lección: una fila por jugador, con su pañuelo, y la del mando. Con los dedos, lo táctil. */
function teclasDe(objetivo: Objetivo, tactil: boolean): HTMLElement | null {
  if (!objetivo.teclas) return null;
  const lista = elemento("dl", "mision-teclas");
  const colores = [COLORES.panueloRojo, COLORES.panueloTurquesa];
  const filas: [string, string, number | null][] =
    tactil && objetivo.teclas.tactil
      ? filasTactiles(objetivo.teclas.tactil).map(([q, t], i) => [q, t, colores[i] ?? null])
      : [
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

/** «Ahora»: el tramo que toca, con su pista, y si es de a dos. */
function ahoraDe(paso: Paso): HTMLElement {
  const caja = elemento("div", "mision-ahora");
  caja.append(elemento("p", "mision-ahora-ceja", paso.deADos ? "Ahora · de a dos" : "Ahora"));
  caja.append(elemento("strong", "mision-ahora-que", paso.que), elemento("p", "mision-ahora-pista", paso.pista));
  return caja;
}

/** Todos los tramos de la meta, tachados los que ya pasaron. */
function tramosDe(pasos: readonly Paso[], actual: number): HTMLElement {
  const lista = elemento("ol", "mision-tramos");
  pasos.forEach((p, i) => {
    const estado = i < actual ? "hecho" : i === actual ? "turno" : "pendiente";
    const fila = lista.appendChild(elemento("li", estado));
    fila.append(elemento("strong", "", p.que));
    if (p.deADos) fila.append(elemento("span", "de-a-dos", " · de a dos"));
  });
  return lista;
}

/** Los controles táctiles en una línea por jugador. */
export const CONTROLES_TACTILES: readonly { quien: string; color: number | null; linea: string }[] = [
  { quien: "Rojo", color: COLORES.panueloRojo, linea: "mitad izquierda · palanca, Agarrar, Saltar, ¡Eh!" },
  { quien: "Turquesa", color: COLORES.panueloTurquesa, linea: "mitad derecha · palanca, Agarrar, Saltar, ¡Eh!" },
];

/** Los controles de los dos, una línea cada uno. */
function controlesDe(enLinea: boolean, tactil: boolean): HTMLElement {
  const lista = elemento("dl", "mision-controles");
  for (const { quien, color, linea } of tactil ? CONTROLES_TACTILES : controlesEnUnaLinea(enLinea)) {
    const dt = lista.appendChild(elemento("dt", ""));
    if (color !== null) dt.appendChild(elemento("i", "panuelo")).style.background = hex(color);
    dt.append(quien);
    lista.appendChild(elemento("dd", "", linea));
  }
  return lista;
}

export interface HojaDeMision {
  readonly caja: HTMLElement;
  /** Si la ayuda (todos los tramos y los controles) está abierta. */
  readonly ayuda: boolean;
  /** Abre o cierra la ayuda (lo hace la tecla H). */
  alternarAyuda(abierta?: boolean): void;
  /** Para la pausa: en un nivel, lo que va ahora y todos los tramos (null si la misión no tiene guía); en el
   * tutorial, la lección de turno. */
  resumen(): HTMLElement | null;
  /** Una línea corta que aparece un rato debajo («¡Bien!»). */
  festejar(texto: string): void;
  quitar(): void;
}

export function crearHojaDeMision(
  tablero: Tablero,
  {
    titulo,
    modo,
    enLinea = false,
    tactil = false,
  }: { titulo: string; modo: ModoHoja; enLinea?: boolean; tactil?: boolean },
): HojaDeMision {
  cargarFuentes();
  // `hoja-lista` y no `mision-lista`: esa es la clase de la lista de objetivos, y en la hoja le quitaba el relleno
  const caja = document.body.appendChild(elemento("aside", `mision hoja-${modo}`));
  caja.setAttribute("aria-live", "polite");
  const festejo = elemento("p", "mision-festejo");
  let reloj: ReturnType<typeof setTimeout> | undefined;
  let ayuda = false;
  /** El objetivo con guía (la meta) y por qué tramo va. */
  const guiado = () => {
    const i = tablero.objetivos.findIndex((o) => o.pasos);
    const objetivo = tablero.objetivos[i];
    if (!objetivo?.pasos) return null;
    const medida = tablero.medida(i);
    return { pasos: objetivo.pasos, medida, paso: pasoActual(objetivo, medida) };
  };

  const pintarLecciones = () => {
    const actual = tablero.actual;
    const hijos: HTMLElement[] = [elemento("p", "mision-ceja", cejaDeLecciones(titulo, tablero))];
    const objetivo = tablero.objetivos[actual];
    if (objetivo) {
      const medida = tablero.medida(actual);
      hijos.push(elemento("h2", "mision-titulo", objetivo.titulo), elemento("p", "mision-texto", objetivo.texto));
      const teclas = teclasDe(objetivo, tactil);
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

  /** Una fila de la lista: la marca, el título con su cuenta y la descripción; debajo de la meta, el tramo que toca. */
  const filaDe = (o: Objetivo, i: number, conAhora: boolean) => {
    const medida = tablero.medida(i);
    const fila = elemento("li", `${estadoDeFila(medida, i, tablero.actual)}${o.opcional ? " opcional" : ""}`);
    fila.dataset.objetivo = o.id;
    fila.appendChild(elemento("span", "marca", medida.hecho ? "✓" : "")).setAttribute("aria-hidden", "true");
    const texto = fila.appendChild(elemento("div", "texto"));
    texto.append(elemento("strong", "", o.titulo));
    const cuenta = textoDeCuenta(medida);
    if (cuenta) texto.append(elemento("span", "cuenta", ` · ${cuenta}`));
    texto.append(elemento("small", "", o.texto));
    const paso = conAhora ? pasoActual(o, medida) : null;
    if (paso) texto.append(ahoraDe(paso));
    return fila;
  };

  const pintarLista = () => {
    const lista = elemento("ul", "mision-lista");
    lista.append(...tablero.objetivos.map((o, i) => filaDe(o, i, true)));
    const hijos: HTMLElement[] = [elemento("p", "mision-ceja", titulo), lista];
    const guia = guiado();
    if (ayuda) {
      hijos.push(elemento("hr", "mision-raya"));
      if (guia) {
        hijos.push(
          elemento("p", "mision-ceja", "Los pasos"),
          tramosDe(guia.pasos, guia.medida.hecho ? guia.pasos.length : (guia.medida.cuenta ?? 0)),
        );
      }
      hijos.push(elemento("p", "mision-ceja", "Controles"), controlesDe(enLinea, tactil));
    }
    hijos.push(
      festejo,
      elemento(
        "p",
        "mision-pie",
        tactil
          ? "Pausa (arriba a la derecha) · pasos y pistas"
          : ayuda
            ? "H · cerrar la ayuda"
            : "H · ayuda y controles",
      ),
    );
    caja.classList.toggle("con-ayuda", ayuda);
    caja.replaceChildren(...hijos);
  };

  // El resumen de la pausa se repinta solo cuando cambia el tramo (en línea la partida sigue con la pausa abierta),
  // sin tocar los botones del menú ni su foco
  let resumen: HTMLElement | null = null;
  /** En la pausa del tutorial: la lección de turno, con qué se hace y cuánto falta. */
  const leccionEnLaPausa = (): HTMLElement[] => {
    const hijos: HTMLElement[] = [elemento("p", "menu-ceja", cejaDeLecciones(titulo, tablero))];
    const objetivo = tablero.objetivos[tablero.actual];
    if (!objetivo) return hijos;
    const caja = elemento("div", "mision-ahora");
    caja.append(
      elemento("p", "mision-ahora-ceja", "Ahora"),
      elemento("strong", "mision-ahora-que", objetivo.titulo),
      elemento("p", "mision-ahora-pista", objetivo.texto),
    );
    const teclas = teclasDe(objetivo, tactil);
    if (teclas) caja.append(teclas);
    const cuenta = textoDeCuenta(tablero.medida(tablero.actual));
    if (cuenta) caja.append(elemento("p", "mision-ahora-ceja mision-resumen-cuenta", cuenta));
    hijos.push(caja);
    return hijos;
  };
  const pintarResumen = () => {
    if (resumen && modo === "lecciones") {
      resumen.replaceChildren(...leccionEnLaPausa());
      return;
    }
    const guia = guiado();
    if (!resumen || !guia) return;
    const hijos: HTMLElement[] = [elemento("p", "menu-ceja", titulo)];
    if (guia.paso) hijos.push(ahoraDe(guia.paso));
    hijos.push(tramosDe(guia.pasos, guia.medida.hecho ? guia.pasos.length : (guia.medida.cuenta ?? 0)));
    // El secreto y el logro con su pista: en una pantalla chica la hoja no la muestra
    const extras = tablero.objetivos.flatMap((o, i) => (o.opcional ? [filaDe(o, i, false)] : []));
    if (extras.length > 0) {
      const lista = elemento("ul", "mision-lista");
      lista.append(...extras);
      hijos.push(lista);
    }
    resumen.replaceChildren(...hijos);
  };
  const pintar = () => {
    if (modo === "lecciones") pintarLecciones();
    else pintarLista();
    if (resumen?.isConnected) pintarResumen();
  };
  pintar();
  const dejar = tablero.alCambiar(pintar);
  const alternarAyuda = (abierta = !ayuda) => {
    if (modo !== "lista" || abierta === ayuda) return;
    ayuda = abierta;
    pintar();
  };
  const conTecla = (e: KeyboardEvent) => {
    if (e.code !== TECLA_AYUDA || e.repeat) return;
    alternarAyuda();
  };
  if (modo === "lista") window.addEventListener("keydown", conTecla);
  return {
    caja,
    get ayuda() {
      return ayuda;
    },
    alternarAyuda,
    resumen() {
      if (modo === "lista" && !guiado()) return null;
      resumen = elemento("div", "mision-resumen");
      pintarResumen();
      return resumen;
    },
    festejar(texto) {
      festejo.textContent = texto;
      festejo.classList.remove("se-va");
      clearTimeout(reloj);
      reloj = setTimeout(() => festejo.classList.add("se-va"), 1800);
    },
    quitar() {
      dejar();
      window.removeEventListener("keydown", conTecla);
      caja.remove();
    },
  };
}
