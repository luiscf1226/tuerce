// Pantalla «entrar»: Clerk abre la sesión (Google o correo) y Convex confirma quién soy.
// Se abre con `?escena=entrar`. Necesita VITE_CLERK_PUBLISHABLE_KEY y VITE_CONVEX_URL (ver docs/ENTORNOS.md).
import type { Clerk as ClerkTipo } from "@clerk/clerk-js";
import { ConvexClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { publicarEstado } from "../estado";

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

export async function abrirEntrar(): Promise<void> {
  const estado = publicarEstado({ escena: "entrar", listo: false, pasosTotales: 0, pasosPorSegundo: 0 });
  const panel = document.body.appendChild(document.createElement("main"));
  panel.className = "entrar";
  const titulo = panel.appendChild(document.createElement("h1"));
  titulo.textContent = "Tuerce";
  const mensaje = panel.appendChild(document.createElement("p"));
  const caja = panel.appendChild(document.createElement("div"));

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
  let cancelar: (() => void) | undefined;

  const mostrar = () => {
    cancelar?.();
    caja.replaceChildren();
    if (!clerk.isSignedIn) {
      mensaje.textContent = "Entrá con Google o con tu correo.";
      // Al volver de Google, regresar a esta misma pantalla y no a la portada.
      clerk.mountSignIn(caja, { forceRedirectUrl: location.href, signUpForceRedirectUrl: location.href });
      estado.listo = true;
      return;
    }
    mensaje.textContent = "Entraste. Preguntándole a Convex quién sos…";
    clerk.mountUserButton(caja);
    convex.setAuth(
      ({ forceRefreshToken }) => tokenParaConvex(clerk, forceRefreshToken),
      async (reconocido) => {
        if (!reconocido) {
          mensaje.textContent = "Clerk te reconoce pero Convex no: revisá la integración de Convex en Clerk.";
          return;
        }
        const perfil = clerk.user;
        const nombre = perfil?.fullName ?? perfil?.username ?? perfil?.primaryEmailAddress?.emailAddress.split("@")[0];
        await convex.mutation(api.usuarios.guardarme, nombre ? { nombre } : {});
      },
    );
    cancelar = convex.onUpdate(api.usuarios.yo, {}, (yo) => {
      if (yo) mensaje.textContent = `Hola, ${yo.nombre}. Convex ya sabe quién sos.`;
      estado.listo = true;
    });
  };

  clerk.addListener(mostrar);
  mostrar();
}

declare global {
  interface Window {
    __internal_ClerkUICtor?: NonNullable<NonNullable<Parameters<ClerkTipo["load"]>[0]>["ui"]>["ClerkUI"];
  }
}
