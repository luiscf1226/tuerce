// Lo que se ve del contrarreloj (TU-32): el reloj arriba al centro mientras corren, el panel de la llegada con el
// tiempo y la tabla de parejas, y las tarjetas de la pantalla de tablas (`?escena=tabla`). Misma letra y mismos
// paneles claros que el menú (menu.css); el único color son los dos pañuelos, que marcan la pareja propia.
import { formatearTiempo } from "../niveles/contrarreloj";
import { FUENTES } from "./menu";
import "./contrarreloj.css";

/** Una fila de la tabla de un nivel (la misma forma que devuelve convex/contrarreloj.ts). */
export interface FilaTabla {
  readonly puesto: number;
  readonly nombres: readonly [string, string];
  /** En pasos de físicas. */
  readonly tiempo: number;
  readonly propia: boolean;
}

export interface DatosTabla {
  readonly filas: readonly FilaTabla[];
  /** La fila de la pareja propia, aunque no entre entre las mejores. */
  readonly propia: FilaTabla | null;
}

/** Un botón o un enlace del panel de llegada. */
export type Accion = { texto: string; fuerte?: boolean } & ({ href: string } | { alApretar: () => void });

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

/** Fraunces y Karla, las mismas del menú (una sola vez por página). */
export function cargarFuentes(): void {
  if (document.querySelector("link[data-fuentes]")) return;
  const fuentes = document.head.appendChild(document.createElement("link"));
  fuentes.rel = "stylesheet";
  fuentes.href = FUENTES;
  fuentes.dataset.fuentes = "";
}

/** El reloj de la carrera, arriba al centro. `poner` en cada cuadro: solo toca la página si cambió algo. */
export function crearMarcador(titulo: string): { poner(pasos: number, llego: boolean): void } {
  cargarFuentes();
  const caja = document.body.appendChild(elemento("div", "contrarreloj-marcador"));
  caja.appendChild(elemento("span", "contrarreloj-ceja", titulo));
  // Un span y no un <output>: estilo.css ya usa `output` para el medidor de `&depurar`
  const tiempo = caja.appendChild(elemento("span", "contrarreloj-tiempo", formatearTiempo(0)));
  let antes = "";
  return {
    poner(pasos, llego) {
      const texto = formatearTiempo(pasos);
      if (texto !== antes) tiempo.textContent = antes = texto;
      caja.classList.toggle("llego", llego);
    },
  };
}

/** La tabla de un nivel: las mejores parejas y, separada, la propia si no entró. */
export function crearTabla(datos: DatosTabla): HTMLElement {
  if (datos.filas.length === 0 && !datos.propia) {
    return elemento("p", "contrarreloj-vacia", "Todavía ninguna pareja corrió este nivel.");
  }
  const lista = elemento("ol", "contrarreloj-tabla");
  const fila = (f: FilaTabla) => {
    const li = lista.appendChild(elemento("li", f.propia ? "propia" : ""));
    li.appendChild(elemento("span", "puesto", String(f.puesto)));
    const nombres = li.appendChild(elemento("span", "nombres", `${f.nombres[0]} y ${f.nombres[1]}`));
    if (f.propia) {
      nombres.prepend(elemento("i", "rojo"), elemento("i", "turquesa"));
    }
    li.appendChild(elemento("span", "tiempo", formatearTiempo(f.tiempo)));
  };
  for (const f of datos.filas) fila(f);
  if (datos.propia && !datos.filas.some((f) => f.propia)) {
    lista.appendChild(elemento("li", "salto", "···")).setAttribute("aria-hidden", "true");
    fila(datos.propia);
  }
  return lista;
}

/** Una tarjeta de nivel para la pantalla de tablas: título, la tabla (que llega después) y abajo lo que se puede hacer. */
export function crearTarjeta(
  padre: HTMLElement,
  titulo: string,
): { tabla(datos: DatosTabla): void; pie(...hijos: (HTMLElement | string)[]): void } {
  cargarFuentes();
  const tarjeta = padre.appendChild(elemento("section", "contrarreloj-tarjeta"));
  tarjeta.appendChild(elemento("h2", "", titulo));
  let tabla: HTMLElement = tarjeta.appendChild(elemento("p", "contrarreloj-vacia", "Buscando la tabla…"));
  const pie = tarjeta.appendChild(elemento("div", "contrarreloj-pie"));
  return {
    tabla(datos) {
      const nueva = crearTabla(datos);
      tabla.replaceWith(nueva);
      tabla = nueva;
    },
    pie(...hijos) {
      pie.replaceChildren(...hijos);
    },
  };
}

/** Un enlace con forma de botón, como los del menú. */
export function enlaceBoton(texto: string, href: string, fuerte = false): HTMLAnchorElement {
  const a = elemento("a", fuerte ? "contrarreloj-boton fuerte" : "contrarreloj-boton", texto);
  a.href = href;
  return a;
}

export interface Llegada {
  /** Pone (o cambia) la tabla del nivel. */
  tabla(datos: DatosTabla): void;
  /** Una línea debajo del tiempo («¡Su mejor tiempo!», «Guardando…»). */
  nota(texto: string): void;
}

/** El panel de la llegada: el tiempo final, una nota, la tabla si hay y los botones. */
export function mostrarLlegada({
  titulo,
  pasos,
  nota = "",
  acciones,
}: {
  titulo: string;
  pasos: number;
  nota?: string;
  acciones: readonly Accion[];
}): Llegada {
  cargarFuentes();
  const capa = document.body.appendChild(elemento("div", "contrarreloj-capa"));
  const panel = capa.appendChild(elemento("div", "contrarreloj-panel"));
  panel.setAttribute("role", "dialog");
  panel.appendChild(elemento("p", "contrarreloj-ceja", titulo));
  panel.appendChild(elemento("h2", "contrarreloj-final", formatearTiempo(pasos)));
  const linea = panel.appendChild(elemento("p", "contrarreloj-nota", nota));
  let tabla: HTMLElement | undefined;
  const costura = panel.appendChild(elemento("hr", "contrarreloj-costura"));
  const botones = panel.appendChild(elemento("div", "contrarreloj-botones"));
  for (const accion of acciones) {
    const clase = accion.fuerte ? "contrarreloj-boton fuerte" : "contrarreloj-boton";
    if ("href" in accion) {
      botones.appendChild(enlaceBoton(accion.texto, accion.href, accion.fuerte));
    } else {
      const b = botones.appendChild(elemento("button", clase, accion.texto));
      b.type = "button";
      b.addEventListener("click", accion.alApretar);
    }
  }
  const elegibles = () => [...botones.querySelectorAll<HTMLElement>("button, a")];
  elegibles()[0]?.focus({ preventScroll: true });
  // El teclado del juego se queda con Enter y las flechas: el panel los atiende por su cuenta, como el menú
  window.addEventListener("keydown", (e) => {
    const lista = elegibles();
    const actual = lista.indexOf(document.activeElement as HTMLElement);
    if (e.code === "ArrowRight" || e.code === "ArrowDown" || e.code === "Tab") {
      lista[(actual + (e.shiftKey ? -1 : 1) + lista.length) % lista.length]?.focus();
    } else if (e.code === "ArrowLeft" || e.code === "ArrowUp") {
      lista[(actual - 1 + lista.length) % lista.length]?.focus();
    } else if (e.code === "Enter" || e.code === "NumpadEnter") {
      (document.activeElement as HTMLElement | null)?.click();
    } else return;
    e.preventDefault();
  });
  return {
    tabla(datos) {
      const nueva = crearTabla(datos);
      if (tabla) tabla.replaceWith(nueva);
      else panel.insertBefore(nueva, costura);
      tabla = nueva;
    },
    nota(texto) {
      linea.textContent = texto;
    },
  };
}
