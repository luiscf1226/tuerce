// Lo que comparten las pantallas de la cuenta (`entrar`, `invitar`): Clerk abre la sesión (Google o correo),
// Convex confirma quién soy y guarda mi usuario. Necesita VITE_CLERK_PUBLISHABLE_KEY y VITE_CONVEX_URL
// (ver docs/ENTORNOS.md).
import type { Clerk as ClerkTipo } from "@clerk/clerk-js";
import { ConvexClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { type EstadoTuerce, publicarEstado } from "../estado";

const llave = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const urlConvex = import.meta.env.VITE_CONVEX_URL;

/** El dominio de Clerk va escondido en la llave pública: pk_test_<base64 de "dominio$">. */
export function dominioDeClerk(llavePublica: string): string {
  const codificado = llavePublica.split("_")[2];
  if (!codificado) throw new Error("La llave pública de Clerk no tiene el formato pk_test_… o pk_live_…");
  return atob(codificado).replace(/\$$/, "");
}

/** Los componentes visuales de Clerk se bajan de su propio dominio, como pide su guía para JavaScript sin React. */
function cargarInterfazDeClerk(dominio: string): Promise<void> {
  return new Promise((listo, fallo) => {
    const script = document.createElement("script");
    script.src = `https://${dominio}/npm/@clerk/ui@1/dist/ui.browser.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => listo();
    script.onerror = () => fallo(new Error("No se pudo bajar la interfaz de Clerk"));
    document.head.append(script);
  });
}

/** Token para Convex: con la integración de Convex activada en Clerk el token normal ya sirve; si no, la plantilla «convex». */
async function tokenParaConvex(clerk: ClerkTipo, renovar: boolean): Promise<string | null> {
  const sesion = clerk.session;
  if (!sesion) return null;
  try {
    const aud = sesion.lastActiveToken?.jwt?.claims.aud;
    const integrada = aud === "convex" || (Array.isArray(aud) && aud.includes("convex"));
    return await sesion.getToken(integrada ? { skipCache: renovar } : { template: "convex", skipCache: renovar });
  } catch {
    return null;
  }
}

/** El panel claro de las pantallas de cuenta: título, un mensaje y la caja donde Clerk dibuja lo suyo. */
export interface Panel {
  estado: EstadoTuerce;
  panel: HTMLElement;
  mensaje: HTMLElement;
  caja: HTMLDivElement;
}

export function crearPanel(escena: string): Panel {
  const estado = publicarEstado({ escena, listo: false, pasosTotales: 0, pasosPorSegundo: 0 });
  const panel = document.body.appendChild(document.createElement("main"));
  panel.className = "entrar";
  const titulo = panel.appendChild(document.createElement("h1"));
  titulo.textContent = "Tuerce";
  const mensaje = panel.appendChild(document.createElement("p"));
  const caja = panel.appendChild(document.createElement("div"));
  return { estado, panel, mensaje, caja };
}

/**
 * Abre la sesión en el panel. Sin sesión muestra la entrada de Clerk; con sesión, el botón de la cuenta, y cuando
 * Convex ya me reconoce y guardó mi usuario llama a `alEntrar` una sola vez. Lo que `alEntrar` devuelva se llama
 * al cerrar la sesión, para desmontar lo que haya puesto.
 */
export async function abrirSesion(
  { estado, mensaje, caja }: Panel,
  alEntrar: (convex: ConvexClient) => (() => void) | undefined,
): Promise<void> {
  if (!llave || !urlConvex) {
    mensaje.textContent =
      "Falta configurar Clerk y Convex en este entorno (VITE_CLERK_PUBLISHABLE_KEY y VITE_CONVEX_URL).";
    estado.listo = true;
    return;
  }

  const [{ Clerk }] = await Promise.all([import("@clerk/clerk-js"), cargarInterfazDeClerk(dominioDeClerk(llave))]);
  const clerk = new Clerk(llave);
  await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });

  const convex = new ConvexClient(urlConvex);
  let salir: (() => void) | undefined;
  let montado: "entrar" | "dentro" | undefined;

  // Clerk avisa cada vez que algo cambia en la sesión (y una vez al suscribirse): solo se vuelve a montar
  // cuando se pasa de no tener sesión a tenerla, o al revés.
  const mostrar = () => {
    const ahora = clerk.isSignedIn ? "dentro" : "entrar";
    if (ahora === montado) return;
    if (montado === "entrar") clerk.unmountSignIn(caja);
    if (montado === "dentro") clerk.unmountUserButton(caja);
    montado = ahora;
    salir?.();
    salir = undefined;
    if (!clerk.isSignedIn) {
      mensaje.textContent = "Entrá con Google o con tu correo.";
      // Al volver de Google, regresar a esta misma pantalla (con su código, si lo hay) y no a la portada.
      clerk.mountSignIn(caja, { forceRedirectUrl: location.href, signUpForceRedirectUrl: location.href });
      estado.listo = true;
      return;
    }
    mensaje.textContent = "Entraste. Preguntándole a Convex quién sos…";
    clerk.mountUserButton(caja);
    let avisado = false;
    convex.setAuth(
      ({ forceRefreshToken }) => tokenParaConvex(clerk, forceRefreshToken),
      async (reconocido) => {
        if (!reconocido) {
          mensaje.textContent = "Clerk te reconoce pero Convex no: revisá la integración de Convex en Clerk.";
          return;
        }
        const perfil = clerk.user;
        const nombre = perfil?.fullName ?? perfil?.username ?? perfil?.primaryEmailAddress?.emailAddress.split("@")[0];
        try {
          await convex.mutation(api.usuarios.guardarme, nombre ? { nombre } : {});
        } catch (error) {
          mensaje.textContent = "No se pudo guardar tu usuario en Convex. Probá de nuevo.";
          console.error(error);
          return;
        }
        // Convex vuelve a avisar cuando renueva el token: lo de la pantalla se monta una sola vez por sesión.
        if (avisado || montado !== "dentro") return;
        avisado = true;
        salir = alEntrar(convex);
      },
    );
  };

  clerk.addListener(mostrar);
}

declare global {
  interface Window {
    __internal_ClerkUICtor?: NonNullable<NonNullable<Parameters<ClerkTipo["load"]>[0]>["ui"]>["ClerkUI"];
  }
}
