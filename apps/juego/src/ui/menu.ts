// El menú de inicio y la pausa (TU-15): paneles claros sobre la escena viva, con la letra de la marca (Fraunces y
// Karla, como prototipo/tuerce.html) y rayas cortadas como costuras.
//
// Con el teclado: ↑/↓ (o W/S) para elegir, Enter o Espacio para apretar, Esc para volver. Con un mando: cruceta o
// palanca, A para apretar, B para volver. La pausa (Esc, P o Start) la pide cualquiera de los dos.
import { DESCRIPCION_CONTROLES } from "../entrada/ayuda";
import type { Controles } from "../entrada/mandos";
import { ganadosAqui } from "../niveles/contrarreloj";
import { enEscritorio, salirDelJuego } from "./escritorio";
import type { Juego } from "./juego";
import "./menu.css";

export const FUENTES =
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Karla:wght@400;600;800&display=swap";

export interface Interfaz {
  /** Una vez por cuadro (aunque las físicas estén paradas): mira si alguien pidió pausa y lee el mando en el menú. */
  cuadro(): void;
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

function boton(texto: string, alApretar: () => void, clase = "boton"): HTMLButtonElement {
  const b = elemento("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", alApretar);
  return b;
}

function enlace(texto: string, destino: string): HTMLAnchorElement {
  const a = elemento("a", "boton boton-claro", texto);
  a.href = destino;
  return a;
}

/** Contrarreloj (TU-32): correr aquí un nivel que la pareja ya ganó en este navegador, y las tablas en línea. */
function lineaContrarreloj(): HTMLElement {
  const linea = elemento("div", "menu-linea");
  linea.append(elemento("span", "menu-nota", "Contrarreloj"));
  const ganado = ganadosAqui()[0];
  if (ganado) linea.append(enlace("Aquí", `?escena=nivel&nivel=${encodeURIComponent(ganado)}&contrarreloj`));
  linea.append(enlace("Tablas", "?escena=tabla"));
  return linea;
}

/** Noche de tuerce (TU-33): este nivel (el de siempre si no es un nivel) de noche y con una trampa sorpresa. Cada
 * vez que se entra sale otra semilla. */
function lineaNoche(): HTMLElement {
  const linea = elemento("div", "menu-linea");
  linea.append(elemento("span", "menu-nota", "Noche de tuerce"));
  const actual = new URLSearchParams(location.search);
  const nivel = actual.get("escena") === "nivel" ? actual.get("nivel") : null;
  const ir = (escena: string) => `?escena=${escena}${nivel ? `&nivel=${encodeURIComponent(nivel)}` : ""}&noche`;
  linea.append(enlace("Aquí", ir("nivel")), enlace("En línea", ir("en-linea")));
  return linea;
}

/** El logo de la portada: TUERCE con la E caída y los dos pañuelos al lado. */
function logo(): HTMLElement {
  const h = elemento("h1", "menu-logo");
  h.setAttribute("aria-label", "Tuerce");
  const giros = ["-4deg", "3deg", "-2deg", "6deg", "-7deg"];
  [..."TUERC"].forEach((letra, i) => {
    const s = h.appendChild(elemento("span", "", letra));
    s.style.setProperty("--r", giros[i] ?? "0deg");
  });
  h.appendChild(elemento("span", "caida", "E"));
  for (const color of ["rojo", "turquesa"]) h.appendChild(elemento("i", color)).setAttribute("aria-hidden", "true");
  return h;
}

/** La tabla de controles de los dos jugadores. */
function controles(): HTMLElement {
  const caja = elemento("div", "menu-controles");
  for (const jugador of DESCRIPCION_CONTROLES) {
    const bloque = caja.appendChild(elemento("section", `j ${jugador.clase}`));
    bloque.appendChild(elemento("h3", "", jugador.nombre));
    const lista = bloque.appendChild(elemento("dl", ""));
    for (const [tecla, que] of jugador.filas) {
      lista.appendChild(elemento("dt", "", tecla));
      lista.appendChild(elemento("dd", "", que));
    }
  }
  return caja;
}

export function crearInterfaz(juego: Juego, mandos: Controles): Interfaz {
  if (!document.querySelector("link[data-fuentes]")) {
    const fuentes = document.head.appendChild(document.createElement("link"));
    fuentes.rel = "stylesheet";
    fuentes.href = FUENTES;
    fuentes.dataset.fuentes = "";
  }

  const capa = document.body.appendChild(elemento("div", "menu-capa"));
  const panel = capa.appendChild(elemento("div", "menu-panel"));
  panel.setAttribute("role", "dialog");
  let viendoControles = false;

  const pintar = () => {
    const estado = juego.estado;
    capa.hidden = estado === "jugando";
    if (estado === "jugando") {
      viendoControles = false;
      return;
    }
    const hijos: HTMLElement[] = [];
    if (viendoControles) {
      hijos.push(elemento("p", "menu-ceja", "Controles"), controles(), elemento("hr", "costura"));
      hijos.push(
        boton("Volver", () => {
          viendoControles = false;
          pintar();
        }),
      );
    } else if (estado === "menu") {
      hijos.push(logo(), elemento("p", "menu-ceja", "Físicas flojas · amistad firme"), elemento("hr", "costura"));
      hijos.push(boton("Jugar aquí de a dos", () => juego.jugar(), "boton boton-fuerte"));
      const linea = elemento("div", "menu-linea");
      linea.append(elemento("span", "menu-nota", "Jugar en línea"), enlace("Invitar", "?escena=invitar"));
      linea.append(enlace("Buscar", "?escena=buscar"));
      hijos.push(linea, lineaContrarreloj(), lineaNoche(), elemento("hr", "costura"));
      // El ropero (TU-29): sombreros, peinados, máscaras y pañuelos, lo ganado y los logros
      hijos.push(enlace("Ropero", "?escena=ropero"));
      hijos.push(
        boton("Controles", () => {
          viendoControles = true;
          pintar();
        }),
      );
      if (enEscritorio) hijos.push(boton("Salir", salirDelJuego));
    } else {
      hijos.push(elemento("h2", "menu-titulo", "Pausa"), elemento("hr", "costura"));
      hijos.push(boton("Seguir", () => juego.seguir(), "boton boton-fuerte"));
      hijos.push(
        boton("Controles", () => {
          viendoControles = true;
          pintar();
        }),
      );
      hijos.push(boton("Salir al menú", () => juego.salirAlMenu()));
    }
    panel.className = `menu-panel ${viendoControles ? "con-controles" : estado}`;
    panel.replaceChildren(...hijos);
    elegibles()[0]?.focus({ preventScroll: true });
  };

  const elegibles = () => [...panel.querySelectorAll<HTMLElement>("button, a")];
  const mover = (paso: number) => {
    const lista = elegibles();
    const actual = lista.indexOf(document.activeElement as HTMLElement);
    lista[(actual + paso + lista.length) % lista.length]?.focus();
  };
  const volver = () => {
    if (viendoControles) {
      viendoControles = false;
      pintar();
    }
  };

  // El teclado del juego no deja que Enter o las flechas lleguen a los botones: el menú los atiende por su cuenta.
  window.addEventListener("keydown", (e) => {
    if (capa.hidden || e.repeat) return;
    if (e.code === "ArrowDown" || e.code === "KeyS" || e.code === "Tab") mover(e.shiftKey ? -1 : 1);
    else if (e.code === "ArrowUp" || e.code === "KeyW") mover(-1);
    else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")
      (document.activeElement as HTMLElement | null)?.click();
    else return;
    e.preventDefault();
  });

  juego.alCambiar(pintar);
  pintar();

  // El mando en el menú: botones apretados en el cuadro anterior, para reaccionar al apretar y no al mantener.
  let antes = 0;
  const BITS = { a: 1, b: 2, arriba: 4, abajo: 8 };
  return {
    cuadro() {
      // Viendo los controles, la pausa (Esc) vuelve; si no, alterna la pausa (en el menú no hace nada)
      if (mandos.pedirPausa()) {
        if (viendoControles) volver();
        else juego.pausar();
      }
      if (capa.hidden || typeof navigator.getGamepads !== "function") return;
      let ahora = 0;
      for (const m of navigator.getGamepads()) {
        if (!m?.connected) continue;
        const y = m.axes[1] ?? 0;
        if (m.buttons[0]?.pressed) ahora |= BITS.a;
        if (m.buttons[1]?.pressed) ahora |= BITS.b;
        if (m.buttons[12]?.pressed || y < -0.6) ahora |= BITS.arriba;
        if (m.buttons[13]?.pressed || y > 0.6) ahora |= BITS.abajo;
      }
      const recien = ahora & ~antes;
      antes = ahora;
      if (recien & BITS.arriba) mover(-1);
      if (recien & BITS.abajo) mover(1);
      if (recien & BITS.a) (document.activeElement as HTMLElement | null)?.click();
      if (recien & BITS.b) {
        if (viendoControles) volver();
        else if (juego.estado === "pausa") juego.seguir();
      }
    },
  };
}
