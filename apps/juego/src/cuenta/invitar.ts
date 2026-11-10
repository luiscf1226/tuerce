// Pantalla «invitar»: uno crea un código de 5 letras (o pasa el enlace con él) y el otro lo escribe o abre el enlace.
// Se abre con `?escena=invitar`; con `&codigo=XXXXX` acepta ese código apenas hay sesión.
import type { ConvexClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "../../../../convex/_generated/api";
import { abrirSesion, crearPanel } from "./sesion";
import "./invitar.css";

/** El enlace que se manda por chat: abre esta misma pantalla con el código puesto. */
export function enlaceDeInvitacion(base: string, codigo: string): string {
  const url = new URL(base);
  url.search = new URLSearchParams({ escena: "invitar", codigo }).toString();
  url.hash = "";
  return url.toString();
}

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

export async function abrirInvitar(): Promise<void> {
  const panel = crearPanel("invitar");
  const codigoDelEnlace = new URLSearchParams(location.search).get("codigo");
  await abrirSesion(panel, (convex) => montarInvitar(convex, panel.panel, codigoDelEnlace, panel.estado));
}

/** Monta la parte de invitar ya con sesión. Exportada para poder probarla con un Convex de mentira. */
export function montarInvitar(
  convex: ConvexClient,
  padre: HTMLElement,
  codigoDelEnlace: string | null,
  estado: { listo: boolean },
): () => void {
  const seccion = elemento(padre, "section", "invitar");
  const crear = elemento(seccion, "button");
  crear.type = "button";
  crear.textContent = "Crear invitación";

  const mia = elemento(seccion, "div", "mia");
  mia.hidden = true;
  const codigoGrande = elemento(mia, "div", "codigo");
  const enlace = elemento(mia, "a", "enlace");
  const copiar = elemento(mia, "button");
  copiar.type = "button";
  copiar.textContent = "Copiar enlace";
  const vence = elemento(mia, "small");

  const formulario = elemento(seccion, "form", "unirme");
  const pregunta = elemento(formulario, "span");
  pregunta.textContent = "¿Te pasaron un código?";
  const campo = elemento(formulario, "input");
  campo.placeholder = "Código";
  campo.maxLength = 5;
  campo.autocomplete = "off";
  campo.setAttribute("aria-label", "Código de tu amigo");
  const unirme = elemento(formulario, "button");
  unirme.type = "submit";
  unirme.textContent = "Unirme";

  const aviso = elemento(seccion, "p", "aviso");
  const listos = elemento(seccion, "p", "listos");
  listos.hidden = true;

  let dejarDeMirar: (() => void) | undefined;

  const yaSonPareja = (nombres: readonly [string, string]) => {
    listos.textContent = `Ya son pareja: ${nombres[0]} y ${nombres[1]}`;
    listos.hidden = false;
    aviso.textContent = "";
    crear.hidden = true;
    formulario.hidden = true;
    mia.hidden = true;
  };

  /** Muestra mi código y queda mirando hasta que la otra persona lo acepte. */
  const mostrarMia = (codigo: string, hasta: number) => {
    codigoGrande.textContent = codigo;
    enlace.href = enlaceDeInvitacion(location.href, codigo);
    enlace.textContent = enlace.href;
    vence.textContent = `Vence a las ${new Date(hasta).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    mia.hidden = false;
    crear.textContent = "Mi invitación";
    aviso.textContent = "Pasale el código o el enlace a la otra persona.";
    dejarDeMirar?.();
    dejarDeMirar = convex.onUpdate(api.invitaciones.estadoInvitacion, { codigo }, (estadoInv) => {
      if (estadoInv?.pareja) yaSonPareja(estadoInv.pareja.nombres);
    });
  };

  const aceptar = async (codigo: string) => {
    aviso.textContent = "Uniéndote…";
    try {
      const pareja = await convex.mutation(api.invitaciones.aceptarInvitacion, { codigo });
      if (pareja.ok) yaSonPareja(pareja.nombres);
      else aviso.textContent = pareja.motivo;
    } catch (error) {
      aviso.textContent = mensajeDeError(error);
    }
  };

  crear.addEventListener("click", async () => {
    crear.disabled = true;
    try {
      const { codigo, vence: hasta } = await convex.mutation(api.invitaciones.crearInvitacion, {});
      mostrarMia(codigo, hasta);
    } catch (error) {
      aviso.textContent = mensajeDeError(error);
    } finally {
      crear.disabled = false;
    }
  });

  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(enlace.href);
      copiar.textContent = "Copiado";
    } catch {
      copiar.textContent = "Copialo a mano";
    }
    setTimeout(() => {
      copiar.textContent = "Copiar enlace";
    }, 2000);
  });

  formulario.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (campo.value.trim()) void aceptar(campo.value);
  });

  // Con el enlace: si el código es mío (lo abrí yo) se muestra como mi invitación; si no, se acepta solo.
  const empezar = async () => {
    if (codigoDelEnlace) {
      campo.value = codigoDelEnlace;
      try {
        const conocida = await convex.query(api.invitaciones.estadoInvitacion, { codigo: codigoDelEnlace });
        if (conocida?.pareja) yaSonPareja(conocida.pareja.nombres);
        else if (conocida && conocida.vence <= Date.now()) aviso.textContent = "Ese código ya venció: creá uno nuevo.";
        else if (conocida) mostrarMia(conocida.codigo, conocida.vence);
        else await aceptar(codigoDelEnlace);
      } catch (error) {
        aviso.textContent = mensajeDeError(error);
      }
    }
    estado.listo = true;
  };
  void empezar();

  return () => {
    dejarDeMirar?.();
    seccion.remove();
  };
}
