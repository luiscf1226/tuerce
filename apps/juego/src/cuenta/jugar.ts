// Ya son pareja (`invitar` o `buscar`): a jugar en línea. «Seguir la historia» abre el primer nivel que la pareja no
// ganó todavía (Convex lo sabe por `ganarNivel`, ver convex/contrarreloj.ts) y «Elegir otro nivel» deja abrir
// cualquiera de los 17. Un nivel ganado se vuelve a jugar desde la salida (src/red/avance.ts).
import type { ConvexClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { HISTORIA, type NivelDeLaHistoria } from "../niveles/orden";

/** La dirección para jugar en línea ese nivel con la pareja más reciente (la que se acaba de juntar). */
export function enlaceEnLinea(clave: string): string {
  return `?escena=en-linea&nivel=${encodeURIComponent(clave)}`;
}

/** El primer nivel de la historia que la pareja no ganó; null si ya ganaron los 17. */
export function primeroSinGanar(ganados: Iterable<number>): NivelDeLaHistoria | null {
  const ya = new Set(ganados);
  return HISTORIA.find((n) => !ya.has(n.numero)) ?? null;
}

function elemento<K extends keyof HTMLElementTagNameMap>(
  padre: HTMLElement,
  etiqueta: K,
  clase?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const nuevo = padre.appendChild(document.createElement(etiqueta));
  if (clase) nuevo.className = clase;
  if (texto !== undefined) nuevo.textContent = texto;
  return nuevo;
}

export interface Jugar {
  /** Lo muestra para esa pareja y le pregunta a Convex qué niveles ganó (una vez por pareja). */
  mostrar(parejaId: Id<"parejas">): void;
  esconder(): void;
}

/** Pone, escondido, el «Seguir la historia» y la lista de niveles. */
export function montarJugar(convex: ConvexClient, padre: HTMLElement): Jugar {
  const caja = elemento(padre, "div", "jugar-en-linea");
  caja.hidden = true;
  const seguir = elemento(caja, "a", "jugar", "Seguir la historia");
  const cual = elemento(caja, "small");
  const otros = elemento(caja, "details", "niveles");
  elemento(otros, "summary", undefined, "Elegir otro nivel");
  const lista = elemento(otros, "ol");

  const pintar = (ganados: readonly number[]) => {
    const siguiente = primeroSinGanar(ganados);
    const nivel = siguiente ?? HISTORIA[0];
    if (!nivel) return;
    seguir.textContent = siguiente ? "Seguir la historia" : "Empezar la historia de nuevo";
    seguir.href = enlaceEnLinea(nivel.clave);
    cual.textContent = siguiente
      ? `Nivel ${nivel.numero} · ${nivel.titulo} · ${nivel.lugar}`
      : "Ya ganaron los 17 niveles. Cualquiera se vuelve a jugar desde la salida.";
    lista.replaceChildren();
    for (const n of HISTORIA) {
      const fila = elemento(lista, "li");
      const enlace = elemento(fila, "a", undefined, `${n.numero} · ${n.titulo}`);
      enlace.href = enlaceEnLinea(n.clave);
      elemento(fila, "small", undefined, ganados.includes(n.numero) ? `${n.lugar} · ganado` : n.lugar);
    }
  };
  pintar([]);

  let deQuien: Id<"parejas"> | undefined;
  return {
    mostrar(parejaId) {
      caja.hidden = false;
      if (parejaId === deQuien) return;
      deQuien = parejaId;
      convex
        .query(api.contrarreloj.nivelesGanados, { parejaId })
        .then((ganados) => {
          if (deQuien === parejaId) pintar(ganados.map((g) => g.nivel));
        })
        // Sin saber qué ganaron, la historia se sigue desde el patio: no es para trabar
        .catch((error: unknown) => console.warn("Tuerce · jugar: no se pudo saber qué niveles ganaron", error));
    },
    esconder() {
      caja.hidden = true;
    },
  };
}
