// La meta de un nivel de la historia (TU-57): el panel «Nivel ganado» con «Siguiente nivel» y «Menú» y, después de
// La medianoche, el final (Año Nuevo, los dos pañuelos y los créditos). Los mismos paneles claros del contrarreloj
// (contrarreloj.css); el único color son los pañuelos. Se manejan como el menú: flechas (o W/S) para elegir, Enter o
// Espacio para apretar; con un mando, cruceta o palanca y A. Mientras el panel está, los muñecos no reciben entrada
// (lo deciden nivel.ts y en-linea.ts), así que esas teclas ya no saltan.
//
// Lo que no toca la página (qué panel y qué botones, a dónde lleva cada uno) se prueba en llegada.test.ts.
import { esElUltimo, HISTORIA, type NivelDeLaHistoria, siguienteNivel } from "../niveles/orden";
import { type Accion, cargarFuentes, enlaceBoton } from "./contrarreloj";
import "./contrarreloj.css";
import "./llegada.css";

/** Qué viene después de la meta: el nivel siguiente, el final (después de La medianoche) o solo el menú (los
 * niveles que no son de la historia, como el de prueba). */
export type FinDeNivel =
  | { readonly cual: "siguiente"; readonly siguiente: NivelDeLaHistoria }
  | { readonly cual: "final" }
  | { readonly cual: "menu" };

export function finDeNivel(clave: string): FinDeNivel {
  if (esElUltimo(clave)) return { cual: "final" };
  const siguiente = siguienteNivel(clave);
  return siguiente ? { cual: "siguiente", siguiente } : { cual: "menu" };
}

/** Pasos entre llegar a la meta y que aparezca el panel: un respiro para verse llegar. En La medianoche, más, para
 * mirar los fuegos artificiales antes del final. */
export const ESPERA_PANEL = 90;
export const ESPERA_FINAL = 300;

export function esperaDelPanel(fin: FinDeNivel): number {
  return fin.cual === "final" ? ESPERA_FINAL : ESPERA_PANEL;
}

/** Los parámetros de prueba de la escena en línea que pasan al nivel siguiente (la sala y el pase de desarrollo). */
const DE_PRUEBA = ["sala", "pase", "forzar", "espera"] as const;

/** La dirección del nivel con esa clave: en el mismo lugar (`?escena=nivel`) o en línea (`?escena=en-linea`). */
export function direccionDelNivel(clave: string, enLinea: boolean, actual?: URLSearchParams): string {
  const nueva = new URLSearchParams({ escena: enLinea ? "en-linea" : "nivel", nivel: clave });
  if (enLinea && actual) {
    for (const nombre of DE_PRUEBA) {
      const valor = actual.get(nombre);
      if (valor !== null) nueva.set(nombre, valor);
    }
  }
  return `?${nueva}`;
}

/** El menú de inicio. */
export const MENU = "/";

/**
 * Los botones del panel: «Siguiente nivel» (el fuerte) y «Menú»; sin nivel siguiente, solo «Menú»; en el final,
 * «Volver al menú». `alSiguiente` reemplaza el enlace al siguiente (en línea lo coordina el anfitrión).
 */
export function accionesDeLaMeta(fin: FinDeNivel, alSiguiente?: () => void): Accion[] {
  if (fin.cual === "final") return [{ texto: "Volver al menú", fuerte: true, href: MENU }];
  if (fin.cual === "menu") return [{ texto: "Menú", fuerte: true, href: MENU }];
  const siguiente: Accion = alSiguiente
    ? { texto: "Siguiente nivel", fuerte: true, alApretar: alSiguiente }
    : { texto: "Siguiente nivel", fuerte: true, href: direccionDelNivel(fin.siguiente.clave, false) };
  return [siguiente, { texto: "Menú", href: MENU }];
}

/** «Lo que sigue: El pinar · Honduras». */
export function loQueSigue(siguiente: NivelDeLaHistoria): string {
  return `Lo que sigue: ${siguiente.titulo} · ${siguiente.lugar}`;
}

// ── En la página ────────────────────────────────────────────────────────────────────────────────────────────────

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

/** Los botones del panel, como en el panel del contrarreloj. */
function botones(acciones: readonly Accion[]): HTMLElement {
  const caja = elemento("div", "contrarreloj-botones");
  for (const accion of acciones) {
    if ("href" in accion) {
      caja.appendChild(enlaceBoton(accion.texto, accion.href, accion.fuerte));
    } else {
      const b = caja.appendChild(
        elemento("button", accion.fuerte ? "contrarreloj-boton fuerte" : "contrarreloj-boton", accion.texto),
      );
      b.type = "button";
      b.addEventListener("click", accion.alApretar);
    }
  }
  return caja;
}

/** Los dos pañuelos, el rojo y el turquesa. */
function panuelos(clase: string): HTMLElement {
  const caja = elemento("p", clase);
  caja.setAttribute("aria-hidden", "true");
  caja.append(elemento("i", "rojo"), elemento("i", "turquesa"));
  return caja;
}

/** Pone el panel encima del juego y lo atiende con el teclado y los mandos, como el menú. */
function abrir(panel: HTMLElement, clase: string): void {
  cargarFuentes();
  const capa = document.body.appendChild(elemento("div", `contrarreloj-capa ${clase}`));
  capa.appendChild(panel);
  panel.setAttribute("role", "dialog");
  const elegibles = () => [...panel.querySelectorAll<HTMLElement>("button, a")];
  const mover = (paso: number) => {
    const lista = elegibles();
    const actual = lista.indexOf(document.activeElement as HTMLElement);
    lista[(actual + paso + lista.length) % lista.length]?.focus();
  };
  const apretar = () => {
    const activo = document.activeElement as HTMLElement | null;
    if (activo && panel.contains(activo)) activo.click();
    // Al cerrar la pausa el foco quedó en el menú: el primer botón lo trae de vuelta, sin apretar nada
    else elegibles()[0]?.focus({ preventScroll: true });
  };
  elegibles()[0]?.focus({ preventScroll: true });
  /** Si el menú de pausa está abierto, los botones son de él. */
  const tapado = () => document.querySelector(".menu-capa:not([hidden])") !== null;

  window.addEventListener("keydown", (e) => {
    if (e.repeat || tapado()) return;
    if (e.code === "ArrowDown" || e.code === "ArrowRight" || e.code === "KeyS" || e.code === "Tab")
      mover(e.shiftKey ? -1 : 1);
    else if (e.code === "ArrowUp" || e.code === "ArrowLeft" || e.code === "KeyW") mover(-1);
    else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") apretar();
    else return;
    e.preventDefault();
  });

  // Los mandos: al apretar y no al mantener. Lo que ya estaba apretado al abrir no cuenta.
  if (typeof navigator.getGamepads !== "function") return;
  const BITS = { a: 1, atras: 2, adelante: 4 };
  const leer = () => {
    let ahora = 0;
    for (const m of navigator.getGamepads()) {
      if (!m?.connected) continue;
      const x = m.axes[0] ?? 0;
      const y = m.axes[1] ?? 0;
      if (m.buttons[0]?.pressed) ahora |= BITS.a;
      if (m.buttons[12]?.pressed || m.buttons[14]?.pressed || y < -0.6 || x < -0.6) ahora |= BITS.atras;
      if (m.buttons[13]?.pressed || m.buttons[15]?.pressed || y > 0.6 || x > 0.6) ahora |= BITS.adelante;
    }
    return ahora;
  };
  let antes = leer();
  const cuadro = () => {
    const ahora = leer();
    const recien = ahora & ~antes;
    antes = ahora;
    if (!tapado()) {
      if (recien & BITS.atras) mover(-1);
      if (recien & BITS.adelante) mover(1);
      if (recien & BITS.a) apretar();
    }
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

export interface PanelDeMeta {
  /** Cambia la línea de abajo del título («Esperando a tu pareja…»). */
  nota(texto: string): void;
}

/** El panel «Nivel ganado»: el nombre del nivel, una nota y los botones. */
export function mostrarNivelGanado({
  nombre,
  nota,
  acciones,
}: {
  nombre: string;
  nota: string;
  acciones: readonly Accion[];
}): PanelDeMeta {
  const panel = elemento("div", "contrarreloj-panel llegada-panel");
  panel.append(
    elemento("p", "contrarreloj-ceja", "Nivel ganado"),
    elemento("h2", "llegada-nombre", nombre),
    panuelos("llegada-panuelos"),
  );
  const linea = panel.appendChild(elemento("p", "contrarreloj-nota", nota));
  panel.append(elemento("hr", "contrarreloj-costura"), botones(acciones));
  abrir(panel, "llegada-capa");
  return {
    nota(texto) {
      linea.textContent = texto;
    },
  };
}

/** El final, después de La medianoche: Año Nuevo, los dos pañuelos y los créditos, con «Volver al menú». */
export function mostrarFinal(acciones: readonly Accion[] = accionesDeLaMeta({ cual: "final" })): void {
  const panel = elemento("div", "contrarreloj-panel llegada-final");
  panel.setAttribute("aria-label", "El final");
  panel.append(
    elemento("p", "contrarreloj-ceja", "La medianoche · Amazonía, Brasil"),
    elemento("h2", "llegada-ano", "¡Feliz año nuevo!"),
    panuelos("llegada-panuelos grandes"),
    elemento(
      "p",
      "llegada-texto",
      "Salieron del patio en Tegucigalpa la mañana del 31 de diciembre y llegaron juntos a la medianoche.",
    ),
    elemento("hr", "contrarreloj-costura"),
    elemento("p", "llegada-tuerce", "Tuerce"),
  );
  const lugares = panel.appendChild(elemento("ol", "llegada-lugares"));
  for (const n of HISTORIA) {
    const li = lugares.appendChild(elemento("li", ""));
    li.append(elemento("span", "titulo", n.titulo), elemento("span", "lugar", n.lugar));
  }
  panel.append(
    elemento("p", "llegada-firma", "Hecho por Luis Carlos Flores Meza"),
    elemento("hr", "contrarreloj-costura"),
    botones(acciones),
  );
  abrir(panel, "llegada-capa final");
}
