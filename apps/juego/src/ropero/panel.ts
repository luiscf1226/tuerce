// El panel del ropero (TU-29): una pestaña por muñeco, cada categoría con sus prendas (las que se tienen se eligen;
// las que faltan dicen en qué nivel se ganan, sin contar el secreto) y la lista de logros. No sabe de Convex ni de
// la escena: recibe los datos y avisa qué se eligió.
import {
  CATEGORIAS,
  type Categoria,
  leerVestuario,
  NIVELES_CON_PREMIOS,
  NOMBRE_CATEGORIA,
  nivelQueDa,
  nombreDe,
  PREMIOS,
  PRENDAS,
  type Prenda,
  type Vestuario,
} from "../../../../convex/premios";
import { FUENTES } from "../ui/menu";
import "./ropero.css";

export interface PestanaDelRopero {
  readonly nombre: string;
  /** El color del pañuelo de ese muñeco, para la pestaña. */
  readonly color: "rojo" | "turquesa";
  readonly vestuario: Vestuario;
  /** Si esa prenda se puede poner (la del principio o una ganada). */
  tiene(categoria: Categoria, prenda: Prenda): boolean;
  alElegir(vestuario: Vestuario): void;
}

export interface DatosDelRopero {
  readonly pestanas: readonly PestanaDelRopero[];
  /** Los logros ganados (ids), o `undefined` si no hay cuenta para guardarlos. */
  readonly logros?: readonly string[];
  /** Una línea debajo del título (de quién es el ropero, si se guarda o no). */
  readonly nota: string;
}

export interface PanelDelRopero {
  readonly caja: HTMLElement;
  /** Donde va la entrada de la cuenta, al pie. */
  readonly pie: HTMLElement;
  mostrar(datos: DatosDelRopero): void;
}

function elemento<K extends keyof HTMLElementTagNameMap>(
  padre: HTMLElement,
  etiqueta: K,
  clase = "",
  texto?: string,
): HTMLElementTagNameMap[K] {
  const e = padre.appendChild(document.createElement(etiqueta));
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Dónde se gana una prenda, sin contar el secreto: «Secreto del nivel 3 · La calle empedrada». */
export function dondeSeGana(categoria: Categoria, prenda: Prenda): string {
  const nivel = nivelQueDa(`${categoria}:${prenda}`);
  if (nivel === undefined) return "Desde el principio";
  const nombre = PREMIOS[nivel]?.nombre ?? "";
  return nivel === 99 ? `Secreto del nivel de prueba` : `Secreto del nivel ${nivel} · ${nombre}`;
}

export function crearPanelDelRopero(): PanelDelRopero {
  // La letra de la marca, como el menú
  if (!document.querySelector("link[data-fuentes]")) {
    const fuentes = document.head.appendChild(document.createElement("link"));
    fuentes.rel = "stylesheet";
    fuentes.href = FUENTES;
    fuentes.dataset.fuentes = "";
  }
  const caja = document.body.appendChild(document.createElement("aside"));
  caja.className = "ropero";
  caja.setAttribute("aria-label", "Ropero");
  const contenido = elemento(caja, "div", "ropero-contenido");
  const pie = elemento(caja, "div", "ropero-pie");
  let elegida = 0;
  let ultimos: DatosDelRopero | undefined;

  const mostrar = (datos: DatosDelRopero) => {
    ultimos = datos;
    elegida = Math.min(elegida, datos.pestanas.length - 1);
    contenido.replaceChildren();
    elemento(contenido, "h1", "ropero-titulo", "Ropero");
    elemento(contenido, "p", "ropero-nota", datos.nota);

    if (datos.pestanas.length > 1) {
      const pestanas = elemento(contenido, "div", "ropero-pestanas");
      pestanas.setAttribute("role", "tablist");
      datos.pestanas.forEach((p, i) => {
        const b = elemento(pestanas, "button", `ropero-pestana ${p.color}`, p.nombre);
        b.type = "button";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", String(i === elegida));
        b.addEventListener("click", () => {
          elegida = i;
          if (ultimos) mostrar(ultimos);
        });
      });
    }

    const pestana = datos.pestanas[elegida];
    if (pestana) {
      for (const categoria of CATEGORIAS) {
        const seccion = elemento(contenido, "section", "ropero-categoria");
        elemento(seccion, "h2", "", NOMBRE_CATEGORIA[categoria]);
        const opciones = elemento(seccion, "div", "ropero-opciones");
        for (const prenda of PRENDAS[categoria] as readonly Prenda[]) {
          const tiene = pestana.tiene(categoria, prenda);
          const puesta = pestana.vestuario[categoria] === prenda;
          const b = elemento(opciones, "button", `ropero-prenda${puesta ? " puesta" : ""}${tiene ? "" : " falta"}`);
          b.type = "button";
          b.setAttribute("aria-pressed", String(puesta));
          b.disabled = !tiene;
          elemento(b, "span", "", nombreDe(categoria, prenda));
          if (!tiene) elemento(b, "small", "", dondeSeGana(categoria, prenda));
          b.title = tiene ? nombreDe(categoria, prenda) : dondeSeGana(categoria, prenda);
          b.addEventListener("click", () =>
            pestana.alElegir(leerVestuario(`${categoria}:${prenda}`, pestana.vestuario)),
          );
        }
      }
    }

    const logros = elemento(contenido, "section", "ropero-logros");
    const ganados = new Set(datos.logros ?? []);
    const lista = NIVELES_CON_PREMIOS.filter((n) => n !== 99 || ganados.has(PREMIOS[n]?.logro.id ?? ""));
    const cuantos = lista.filter((n) => ganados.has(PREMIOS[n]?.logro.id ?? "")).length;
    elemento(logros, "h2", "", datos.logros ? `Logros · ${cuantos} de ${lista.length}` : "Logros");
    if (!datos.logros) elemento(logros, "p", "ropero-nota", "Se guardan con tu cuenta, jugando en línea.");
    const ol = elemento(logros, "ol", "");
    for (const n of lista) {
      const p = PREMIOS[n];
      if (!p) continue;
      const li = elemento(ol, "li", ganados.has(p.logro.id) ? "ganado" : "");
      elemento(li, "strong", "", p.logro.nombre);
      elemento(li, "span", "", ` · ${p.logro.texto}`);
    }
  };

  return { caja, pie, mostrar };
}
