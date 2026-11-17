// El menú de inicio y la pausa (TU-15): paneles claros sobre la escena viva, con la letra de la marca (Fraunces y
// Karla, como prototipo/tuerce.html) y rayas cortadas como costuras.
//
// Con el teclado: ↑/↓ (o W/S) para elegir, Enter o Espacio para apretar, Esc para volver. Con un mando: cruceta o
// palanca, A para apretar, B para volver. La pausa (Esc, P o Start) la pide cualquiera de los dos.
//
// Cómo jugar: la primera vez (sin tutorial ni niveles ganados en este navegador) el botón fuerte es «Cómo jugar»
// (`?escena=tutorial`) y la historia va debajo; después, «Cómo jugar» queda como un botón más, también en la pausa.
// La pantalla de controles empieza con lo básico en cuatro líneas.
//
// La historia y los niveles (TU-56): sin nivel abierto (la escena `dos`, de fondo), el botón fuerte lleva a la
// historia (al patio, o al primero que la pareja no ganó en este navegador) y «Niveles» abre el panel de los 17,
// para jugarlos aquí o en línea. Sobre un nivel, el botón fuerte juega ese nivel.
import { DESCRIPCION_CONTROLES } from "../entrada/ayuda";
import type { Controles } from "../entrada/mandos";
import { ganadosAqui } from "../niveles/contrarreloj";
import { nivelDeLaHistoria, PRIMER_NIVEL } from "../niveles/orden";
import { enEscritorio, salirDelJuego } from "./escritorio";
import {
  type DondeSigue,
  direccionDelNivel,
  dondeSigue,
  type Modo,
  type NivelEnElPanel,
  nivelesDeLaHistoria,
  nivelesDelContrarreloj,
  numeroConCeros,
} from "./historia";
import type { Juego } from "./juego";
import { COMO_SE_JUEGA, DIRECCION_TUTORIAL, proponerTutorial, tutorialHecho } from "./tutorial";
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

function enlace(texto: string, destino: string, clase = "boton boton-claro"): HTMLAnchorElement {
  const a = elemento("a", clase, texto);
  a.href = destino;
  return a;
}

/** «00 · El patio»: el número de la carpeta y el título. */
function nombreCorto(n: { numero?: number; titulo: string }): string {
  return n.numero === undefined ? n.titulo : `${numeroConCeros(n.numero)} · ${n.titulo}`;
}

/** La historia: empezarla en el patio, seguirla en el primero que no ganaron aquí, o darle otra vuelta. */
function botonHistoria(sigue: DondeSigue, fuerte = true): HTMLAnchorElement {
  const seguir = sigue.empezada && !sigue.terminada;
  const a = enlace(
    seguir ? "Seguir la historia" : "Historia",
    direccionDelNivel(sigue.nivel.clave, "aqui"),
    fuerte ? "boton boton-fuerte con-sub" : "boton boton-claro con-sub",
  );
  a.append(
    elemento("small", "", sigue.terminada ? `Otra vuelta · ${nombreCorto(sigue.nivel)}` : nombreCorto(sigue.nivel)),
  );
  return a;
}

/** Un nivel en el panel: número, título y lugar; los dos pañuelos si la pareja ya lo ganó en este navegador. */
function filaDeNivel(n: NivelEnElPanel, modo: Modo): HTMLAnchorElement {
  const a = enlace("", direccionDelNivel(n.clave, modo), "menu-nivel");
  a.dataset.clave = n.clave;
  a.setAttribute("aria-label", `${nombreCorto(n)}, ${n.lugar}${n.ganado ? ", ganado aquí" : ""}`);
  a.append(elemento("span", "numero", n.numero === undefined ? "··" : numeroConCeros(n.numero)));
  const texto = a.appendChild(elemento("span", "texto"));
  texto.append(elemento("span", "titulo", n.titulo), elemento("span", "lugar", n.lugar));
  if (n.ganado) {
    const marca = a.appendChild(elemento("span", "ganado", "ganado"));
    marca.title = "Ganado en este navegador";
    for (const color of ["rojo", "turquesa"])
      marca.appendChild(elemento("i", color)).setAttribute("aria-hidden", "true");
  }
  return a;
}

function listaDeNiveles(niveles: readonly NivelEnElPanel[], modo: Modo): HTMLElement {
  const lista = elemento("div", "menu-niveles");
  lista.classList.toggle("dos-columnas", niveles.length > 6);
  lista.append(...niveles.map((n) => filaDeNivel(n, modo)));
  return lista;
}

/** Noche de tuerce (TU-33): este nivel (o, si no hay nivel abierto, donde sigue la historia) de noche y con una
 * trampa sorpresa. Cada vez que se entra sale otra semilla. */
function lineaNoche(clave: string): HTMLElement {
  const linea = elemento("div", "menu-linea");
  linea.append(elemento("span", "menu-nota", "Noche de tuerce"));
  linea.append(
    enlace("Aquí", direccionDelNivel(clave, "noche-aqui")),
    enlace("En línea", direccionDelNivel(clave, "noche-en-linea")),
  );
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

/** «Cómo jugar»: el tutorial. Fuerte (con su línea de abajo) cuando el menú lo propone primero. */
function botonTutorial(fuerte: boolean): HTMLAnchorElement {
  const a = enlace("Cómo jugar", DIRECCION_TUTORIAL, fuerte ? "boton boton-fuerte con-sub" : "boton boton-claro");
  a.dataset.tutorial = "";
  if (fuerte) a.append(elemento("small", "", "Primero: moverse, agarrar y cargar de a dos"));
  return a;
}

/** Lo básico en cuatro líneas, arriba de la tabla de controles. */
function comoSeJuega(): HTMLElement {
  const lista = elemento("dl", "menu-como");
  for (const [que, como] of COMO_SE_JUEGA) {
    lista.appendChild(elemento("dt", "", que));
    lista.appendChild(elemento("dd", "", como));
  }
  return lista;
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
  // Lo que muestra el panel: la portada (o la pausa), los controles, los niveles o los del contrarreloj
  type Vista = "inicio" | "controles" | "niveles" | "contrarreloj";
  let vista: Vista = "inicio";
  // En el panel de niveles: jugarlos aquí o en línea
  let modoNiveles: "aqui" | "en-linea" = "aqui";

  // El nivel abierto (sin `&nivel=` es el primero de la historia, como en lista.ts), o null en la escena `dos`
  const direccion = new URLSearchParams(location.search);
  const claveAbierta = direccion.get("escena") === "nivel" ? (direccion.get("nivel") ?? PRIMER_NIVEL) : null;
  const abierto = claveAbierta ? nivelDeLaHistoria(claveAbierta) : undefined;

  const abrir = (cual: Vista) => () => {
    vista = cual;
    pintar();
  };
  /** Un botón que abre otra vista; al volver, el foco regresa a él. */
  const botonQueAbre = (texto: string, cual: Vista, clase?: string) => {
    const b = boton(texto, abrir(cual), clase);
    b.dataset.abre = cual;
    return b;
  };

  const pintar = (enfocar?: string) => {
    const estado = juego.estado;
    capa.hidden = estado === "jugando";
    if (estado === "jugando") {
      vista = "inicio";
      return;
    }
    const ganados = ganadosAqui();
    const sigue = dondeSigue(ganados);
    const hijos: HTMLElement[] = [];
    if (vista === "controles") {
      hijos.push(elemento("p", "menu-ceja", "Cómo se juega"), comoSeJuega(), elemento("hr", "costura"));
      hijos.push(elemento("p", "menu-ceja", "Controles"), controles(), elemento("hr", "costura"));
      const linea = elemento("div", "menu-linea");
      linea.append(
        boton("Volver", () => volver(), "boton boton-claro"),
        enlace("Cómo jugar", DIRECCION_TUTORIAL),
      );
      hijos.push(linea);
    } else if (vista === "niveles") {
      hijos.push(elemento("p", "menu-ceja", "Niveles"));
      const linea = elemento("div", "menu-linea");
      linea.append(elemento("span", "menu-nota", "Jugarlos"));
      for (const [modo, texto] of [
        ["aqui", "Aquí"],
        ["en-linea", "En línea"],
      ] as const) {
        const elegido = modo === modoNiveles;
        const b = boton(
          texto,
          () => {
            modoNiveles = modo;
            pintar(`[data-modo="${modo}"]`);
          },
          `boton boton-claro${elegido ? " boton-fuerte" : ""}`,
        );
        b.dataset.modo = modo;
        b.setAttribute("aria-pressed", String(elegido));
        linea.append(b);
      }
      hijos.push(linea, listaDeNiveles(nivelesDeLaHistoria(ganados), modoNiveles), elemento("hr", "costura"));
      hijos.push(boton("Volver", () => volver()));
      // Al abrirlo, el foco queda en donde sigue la historia
      enfocar ??= `[data-clave="${sigue.nivel.clave}"]`;
    } else if (vista === "contrarreloj") {
      hijos.push(elemento("p", "menu-ceja", "Contrarreloj aquí"));
      hijos.push(elemento("p", "menu-nota centrada", "Los que ya ganaron en este navegador, desde la salida."));
      hijos.push(listaDeNiveles(nivelesDelContrarreloj(ganados), "contrarreloj"), elemento("hr", "costura"));
      const linea = elemento("div", "menu-linea");
      linea.append(
        boton("Volver", () => volver(), "boton boton-claro"),
        enlace("Tablas en línea", "?escena=tabla"),
      );
      hijos.push(linea);
    } else if (estado === "menu") {
      const ceja = abierto ? `${nombreCorto(abierto)} · ${abierto.lugar}` : "Físicas flojas · amistad firme";
      hijos.push(logo(), elemento("p", "menu-ceja", ceja), elemento("hr", "costura"));
      // Sobre un nivel se juega ese; en la escena `dos` (la de fondo) se va a la historia
      // La primera vez (sin tutorial ni niveles ganados en este navegador), «Cómo jugar» va primero
      const primero = !claveAbierta && proponerTutorial(tutorialHecho(), ganados);
      if (claveAbierta) hijos.push(boton("Jugar aquí de a dos", () => juego.jugar(), "boton boton-fuerte"));
      else if (primero) hijos.push(botonTutorial(true), botonHistoria(sigue, false));
      else hijos.push(botonHistoria(sigue));
      hijos.push(botonQueAbre("Niveles", "niveles"));
      const linea = elemento("div", "menu-linea");
      linea.append(elemento("span", "menu-nota", "Jugar en línea"), enlace("Invitar", "?escena=invitar"));
      linea.append(enlace("Buscar", "?escena=buscar"));
      // Contrarreloj (TU-32): correr aquí cualquiera que ya ganaron en este navegador, y las tablas en línea
      const contra = elemento("div", "menu-linea");
      contra.append(elemento("span", "menu-nota", "Contrarreloj"));
      if (ganados.length > 0) contra.append(botonQueAbre("Aquí", "contrarreloj", "boton boton-claro"));
      contra.append(enlace("Tablas", "?escena=tabla"));
      hijos.push(linea, contra, lineaNoche(claveAbierta ?? sigue.nivel.clave), elemento("hr", "costura"));
      // El ropero (TU-29): sombreros, peinados, máscaras y pañuelos, lo ganado y los logros
      hijos.push(enlace("Ropero", "?escena=ropero"));
      if (!primero) hijos.push(botonTutorial(false));
      hijos.push(botonQueAbre("Controles", "controles"));
      if (enEscritorio) hijos.push(boton("Salir", salirDelJuego));
    } else {
      hijos.push(elemento("h2", "menu-titulo", "Pausa"), elemento("hr", "costura"));
      hijos.push(boton("Seguir", () => juego.seguir(), "boton boton-fuerte"));
      hijos.push(botonQueAbre("Controles", "controles"));
      if (direccion.get("escena") !== "tutorial") hijos.push(enlace("Cómo jugar", DIRECCION_TUTORIAL));
      hijos.push(boton("Salir al menú", () => juego.salirAlMenu()));
    }
    panel.className = `menu-panel ${vista === "inicio" ? estado : `con-${vista}`}`;
    panel.replaceChildren(...hijos);
    const foco = (enfocar ? panel.querySelector<HTMLElement>(enfocar) : null) ?? elegibles()[0];
    foco?.focus({ preventScroll: true });
    // En la lista de niveles (que puede tener barra en una pantalla chica), que se vea el elegido
    if (foco?.closest(".menu-niveles")) foco.scrollIntoView({ block: "nearest" });
  };

  const elegibles = () => [...panel.querySelectorAll<HTMLElement>("button, a")];
  const mover = (paso: number) => {
    const lista = elegibles();
    const actual = lista.indexOf(document.activeElement as HTMLElement);
    lista[(actual + paso + lista.length) % lista.length]?.focus();
  };
  const volver = () => {
    if (vista === "inicio") return;
    const desde = vista;
    vista = "inicio";
    pintar(`[data-abre="${desde}"]`);
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

  juego.alCambiar(() => pintar());
  pintar();

  // El mando en el menú: botones apretados en el cuadro anterior, para reaccionar al apretar y no al mantener.
  let antes = 0;
  const BITS = { a: 1, b: 2, arriba: 4, abajo: 8 };
  return {
    cuadro() {
      // Viendo los controles o un panel, la pausa (Esc) vuelve; si no, alterna la pausa (en el menú no hace nada)
      if (mandos.pedirPausa()) {
        if (vista !== "inicio") volver();
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
        if (vista !== "inicio") volver();
        else if (juego.estado === "pausa") juego.seguir();
      }
    },
  };
}
