// Controles táctiles: los dos en el mismo teléfono o tableta. La pantalla se parte en dos mitades: la izquierda es
// del rojo y la derecha del turquesa. Cada mitad tiene una palanca que aparece donde se apoya el dedo (arriba camina,
// abajo retrocede, a los lados gira, como la palanca de un mando) y tres botones del lado de adentro:
//
//   Agarrar   mientras se sostiene, los dos brazos arriba: lo que toquen las manos queda agarrado
//   Saltar
//   ¡Eh!      un gesto (festejar), para entenderse sin hablar
//
// Arriba al centro, la pausa. Aparecen solos en pantallas táctiles (sin mouse) o con `?tactil`; con entrada fija
// (capturas) no. Se usan eventos de puntero, así cada dedo es un puntero y los dos juegan a la vez.
import { type EntradaJugador, entradaQuieta, type Jugador } from "./mandos";
import "./tactil.css";

/** Cuánto (px) se arrastra la palanca hasta el tope. */
export const RADIO_PALANCA = 56;
/** Lo que no cuenta cerca del centro, en fracción del radio (como la zona muerta del mando). */
export const ZONA_MUERTA_TACTIL = 0.18;

/** De cuánto se arrastró el dedo (px, y crece hacia abajo) a lo que pide el jugador: arriba avanza, a la izquierda
 * gira a la izquierda. Con zona muerta y tope en 1. */
export function ejesDePalanca(dx: number, dy: number, radio = RADIO_PALANCA): { avanzar: number; girar: number } {
  const largo = Math.hypot(dx, dy);
  if (largo < radio * ZONA_MUERTA_TACTIL) return { avanzar: 0, girar: 0 };
  // Fuera de la zona muerta la fuerza va de 0 a 1, para que no salte de golpe
  const fuerza = (Math.min(1, largo / radio) - ZONA_MUERTA_TACTIL) / (1 - ZONA_MUERTA_TACTIL);
  return { avanzar: limpiar((-dy / largo) * fuerza), girar: limpiar((-dx / largo) * fuerza) };
}

const limpiar = (v: number) => (Math.abs(v) < 1e-9 ? 0 : Math.max(-1, Math.min(1, v)));

/** Si esta pantalla se maneja con los dedos: sin mouse fino (teléfonos y tabletas) o con `?tactil` en la dirección. */
export function hayPantallaTactil(parametros: URLSearchParams): boolean {
  if (parametros.has("tactil")) return parametros.get("tactil") !== "0";
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;
}

export interface Tactil {
  /** Lo que piden los dedos de ese jugador ahora. */
  leer(jugador: Jugador): EntradaJugador;
  /** Si se apretó la pausa desde la última vez que se preguntó. */
  pedirPausa(): boolean;
}

type BotonTactil = "agarrar" | "saltar" | "gesto";
const BOTONES: readonly { boton: BotonTactil; texto: string }[] = [
  { boton: "agarrar", texto: "Agarrar" },
  { boton: "saltar", texto: "Saltar" },
  { boton: "gesto", texto: "¡Eh!" },
];

interface Lado {
  palanca: { puntero: number; x0: number; y0: number; dx: number; dy: number } | null;
  /** Qué punteros sostienen cada botón. */
  botones: Record<BotonTactil, Set<number>>;
}

/** Pone los controles en la página. */
export function crearTactil(): Tactil {
  const lados: [Lado, Lado] = [nuevoLado(), nuevoLado()];
  let pausas = 0;
  document.documentElement.classList.add("con-tactil");

  const capa = document.body.appendChild(document.createElement("div"));
  capa.className = "tactil";
  const pausa = capa.appendChild(document.createElement("button"));
  pausa.type = "button";
  pausa.className = "tactil-pausa";
  pausa.setAttribute("aria-label", "Pausa");
  pausa.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    pausas++;
  });

  ([0, 1] as const).forEach((jugador) => {
    const lado = lados[jugador];
    const zona = capa.appendChild(document.createElement("div"));
    zona.className = `tactil-lado ${jugador === 0 ? "rojo" : "turquesa"}`;
    zona.dataset.jugador = String(jugador);
    const base = zona.appendChild(document.createElement("div"));
    base.className = "tactil-base";
    const perilla = base.appendChild(document.createElement("div"));
    perilla.className = "tactil-perilla";
    const botonera = zona.appendChild(document.createElement("div"));
    botonera.className = "tactil-botones";

    const moverPerilla = () => {
      const p = lado.palanca;
      zona.classList.toggle("activa", p !== null);
      if (!p) {
        base.style.removeProperty("left");
        base.style.removeProperty("top");
        perilla.style.transform = "";
        return;
      }
      const caja = zona.getBoundingClientRect();
      base.style.left = `${p.x0 - caja.left}px`;
      base.style.top = `${p.y0 - caja.top}px`;
      const largo = Math.hypot(p.dx, p.dy);
      const tope = largo > RADIO_PALANCA ? RADIO_PALANCA / largo : 1;
      perilla.style.transform = `translate(${p.dx * tope}px, ${p.dy * tope}px)`;
    };

    zona.addEventListener("pointerdown", (e) => {
      if (lado.palanca || (e.target instanceof Element && e.target.closest(".tactil-botones"))) return;
      e.preventDefault();
      zona.setPointerCapture?.(e.pointerId);
      lado.palanca = { puntero: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
      moverPerilla();
    });
    zona.addEventListener("pointermove", (e) => {
      const p = lado.palanca;
      if (!p || p.puntero !== e.pointerId) return;
      p.dx = e.clientX - p.x0;
      p.dy = e.clientY - p.y0;
      moverPerilla();
    });
    const soltar = (e: PointerEvent) => {
      if (lado.palanca?.puntero !== e.pointerId) return;
      lado.palanca = null;
      moverPerilla();
    };
    zona.addEventListener("pointerup", soltar);
    zona.addEventListener("pointercancel", soltar);

    for (const { boton, texto } of BOTONES) {
      const b = botonera.appendChild(document.createElement("button"));
      b.type = "button";
      b.className = `tactil-boton ${boton}`;
      b.dataset.boton = boton;
      b.textContent = texto;
      const sostienen = lado.botones[boton];
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        b.setPointerCapture?.(e.pointerId);
        sostienen.add(e.pointerId);
        b.classList.add("apretado");
        navigator.vibrate?.(8);
      });
      const dejar = (e: PointerEvent) => {
        sostienen.delete(e.pointerId);
        b.classList.toggle("apretado", sostienen.size > 0);
      };
      b.addEventListener("pointerup", dejar);
      b.addEventListener("pointercancel", dejar);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  });
  // Al irse de la página (otra pestaña, una llamada) no queda nada apretado
  window.addEventListener("blur", () => {
    for (const lado of lados) {
      lado.palanca = null;
      for (const s of Object.values(lado.botones)) s.clear();
    }
    for (const b of capa.querySelectorAll(".apretado")) b.classList.remove("apretado");
    for (const z of capa.querySelectorAll(".activa")) z.classList.remove("activa");
  });

  return {
    leer(jugador) {
      const lado = lados[jugador];
      const entrada = entradaQuieta();
      if (lado.palanca) Object.assign(entrada, ejesDePalanca(lado.palanca.dx, lado.palanca.dy));
      const agarra = lado.botones.agarrar.size > 0;
      entrada.brazoIzquierdo = agarra;
      entrada.brazoDerecho = agarra;
      entrada.saltar = lado.botones.saltar.size > 0;
      if (lado.botones.gesto.size > 0) {
        entrada.gesto = "festejar";
        entrada.avanzar = 0;
        entrada.girar = 0;
      }
      return entrada;
    },
    pedirPausa() {
      const pedida = pausas > 0;
      pausas = 0;
      return pedida;
    },
  };
}

function nuevoLado(): Lado {
  return { palanca: null, botones: { agarrar: new Set(), saltar: new Set(), gesto: new Set() } };
}
