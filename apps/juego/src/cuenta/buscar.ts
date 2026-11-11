// Pantalla «buscar pareja»: quien no tiene con quién jugar entra a la cola de su región y queda con la primera
// persona que aparezca ahí. Se abre con `?escena=buscar`. La cola está en convex/cola.ts.
import type { ConvexClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { LATIDO_MS } from "../../../../convex/regiones";
import { NOMBRE_REGION, REGIONES, type Region, regionDetectada } from "./region";
import { abrirSesion, crearPanel } from "./sesion";
import "./invitar.css";

type Estado = FunctionReturnType<typeof api.cola.estadoCola>;

function mensajeDeError(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === "string") return error.data;
  console.error(error);
  return "Algo falló al hablar con Convex. Probá de nuevo.";
}

function elemento<K extends keyof HTMLElementTagNameMap>(
  padre: HTMLElement,
  etiqueta: K,
  clase?: string,
): HTMLElementTagNameMap[K] {
  const nuevo = padre.appendChild(document.createElement(etiqueta));
  if (clase) nuevo.className = clase;
  return nuevo;
}

export async function abrirBuscar(): Promise<void> {
  const panel = crearPanel("buscar");
  await abrirSesion(panel, (convex) => montarBuscar(convex, panel.panel, panel.estado));
}

/** Monta la búsqueda ya con sesión. Devuelve cómo desmontarla (al cerrar la sesión). */
export function montarBuscar(convex: ConvexClient, padre: HTMLElement, estado: { listo: boolean }): () => void {
  const seccion = elemento(padre, "section", "invitar buscar");
  const intro = elemento(seccion, "p");
  intro.textContent = "¿No tenés con quién jugar? Te juntamos con otra persona de tu región.";

  const inicio = elemento(seccion, "form", "unirme");
  const etiqueta = elemento(inicio, "label");
  etiqueta.textContent = "Tu región ";
  const selector = elemento(etiqueta, "select");
  selector.setAttribute("aria-label", "Tu región");
  const detectada = regionDetectada();
  for (const region of REGIONES) {
    const opcion = elemento(selector, "option");
    opcion.value = region;
    opcion.textContent = NOMBRE_REGION[region];
  }
  selector.value = detectada;
  const buscar = elemento(inicio, "button");
  buscar.type = "submit";
  buscar.textContent = "Buscar";
  const pista = elemento(seccion, "small");
  pista.textContent = `Por tu hora parece que estás en ${NOMBRE_REGION[detectada]}. Si no, cambiala.`;

  const esperando = elemento(seccion, "div", "mia");
  esperando.hidden = true;
  const buscando = elemento(esperando, "p", "listos");
  const reloj = elemento(esperando, "small");
  const cancelar = elemento(esperando, "button");
  cancelar.type = "button";
  cancelar.textContent = "Cancelar";

  const listos = elemento(seccion, "p", "listos");
  listos.hidden = true;
  // Ya juntos, a jugar: la escena en línea toma la pareja más reciente y le pide a Convex el pase de su sala
  const jugar = elemento(seccion, "a", "jugar");
  jugar.href = "?escena=en-linea";
  jugar.textContent = "Jugar en línea";
  jugar.hidden = true;
  const otraVez = elemento(seccion, "button");
  otraVez.type = "button";
  otraVez.textContent = "Buscar otra vez";
  otraVez.hidden = true;
  const aviso = elemento(seccion, "p", "aviso");
  const invitar = elemento(seccion, "a", "otra-forma");
  invitar.href = "?escena=invitar";
  invitar.textContent = "¿Ya tenés compa? Invitalo con un código";

  // Mientras espera, el juego avisa cada tanto que la persona sigue acá; si deja de avisar, la cola la saca.
  let latido: ReturnType<typeof setInterval> | undefined;
  let segundero: ReturnType<typeof setInterval> | undefined;
  const pararLatido = () => {
    clearInterval(latido);
    clearInterval(segundero);
    latido = undefined;
    segundero = undefined;
  };
  const latir = (region: Region, desde: number) => {
    const contar = () => {
      const segundos = Math.max(0, Math.round((Date.now() - desde) / 1000));
      reloj.textContent = `Esperando hace ${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
    };
    contar();
    if (latido) return;
    segundero = setInterval(contar, 1000);
    latido = setInterval(() => {
      convex.mutation(api.cola.buscarPareja, { region }).catch((error) => {
        aviso.textContent = mensajeDeError(error);
      });
    }, LATIDO_MS);
  };

  /** Pone la pantalla según cómo va la búsqueda (sirve igual para la respuesta de una mutación o de la consulta). */
  const mostrar = (actual: Estado) => {
    inicio.hidden = actual !== null;
    pista.hidden = actual !== null;
    esperando.hidden = actual?.estado !== "esperando";
    listos.hidden = actual?.estado !== "emparejados";
    jugar.hidden = listos.hidden;
    otraVez.hidden = actual?.estado !== "emparejados";
    if (actual?.estado === "esperando") {
      selector.value = actual.region;
      buscando.textContent = `Buscando a alguien en ${NOMBRE_REGION[actual.region]}…`;
      latir(actual.region, actual.desde);
    } else pararLatido();
    if (actual?.estado === "emparejados") {
      listos.textContent = `Ya son pareja: ${actual.nombres[0]} y ${actual.nombres[1]}`;
      aviso.textContent = "";
    }
  };

  inicio.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    buscar.disabled = true;
    aviso.textContent = "";
    try {
      const region = REGIONES.find((r) => r === selector.value) ?? detectada;
      mostrar(await convex.mutation(api.cola.buscarPareja, { region }));
    } catch (error) {
      aviso.textContent = mensajeDeError(error);
    } finally {
      buscar.disabled = false;
    }
  });

  const salir = async () => {
    pararLatido();
    try {
      await convex.mutation(api.cola.dejarDeBuscar, {});
      mostrar(null);
    } catch (error) {
      aviso.textContent = mensajeDeError(error);
    }
  };
  cancelar.addEventListener("click", () => void salir());
  otraVez.addEventListener("click", () => void salir());

  // Si cierra la pestaña esperando, intenta salir de la cola; si no llega, la cola la saca sola en dos minutos.
  const alIrse = () => {
    if (latido) void convex.mutation(api.cola.dejarDeBuscar, {});
  };
  addEventListener("pagehide", alIrse);

  // En vivo: a quien espera le aparece la pareja apenas otra persona lo encuentra.
  const dejarDeMirar = convex.onUpdate(api.cola.estadoCola, {}, (actual) => {
    mostrar(actual);
    estado.listo = true;
  });

  return () => {
    dejarDeMirar();
    pararLatido();
    removeEventListener("pagehide", alIrse);
    seccion.remove();
  };
}
