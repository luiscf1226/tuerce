// Pantalla «entrar»: Clerk abre la sesión (Google o correo) y Convex confirma quién soy.
// Se abre con `?escena=entrar`. La sesión compartida está en `sesion.ts`.
import { api } from "../../../../convex/_generated/api";
import { abrirSesion, crearPanel } from "./sesion";

export async function abrirEntrar(): Promise<void> {
  const panel = crearPanel("entrar");
  await abrirSesion(panel, (convex) =>
    convex.onUpdate(api.usuarios.yo, {}, (yo) => {
      if (yo) panel.mensaje.textContent = `Hola, ${yo.nombre}. Convex ya sabe quién sos.`;
      panel.estado.listo = true;
    }),
  );
}
