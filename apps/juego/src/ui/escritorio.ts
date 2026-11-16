// Lo poco que cambia cuando el juego corre empacado para escritorio (apps/escritorio, Tauri, TU-35): F11 alterna la
// pantalla completa, el menú de inicio suma «Salir» y el clic derecho no abre el menú del webview. En el navegador
// no hace nada: `isTauri()` solo es cierto dentro de la ventana de Tauri.
import { invoke, isTauri } from "@tauri-apps/api/core";

export const enEscritorio = isTauri();

/** Cierra la ventana (comando `salir` de apps/escritorio/src-tauri/src/lib.rs). */
export function salirDelJuego(): void {
  void invoke("salir");
}

/** Si se puede pedir la pantalla completa desde las Opciones (TU-60): en el escritorio con el comando de la ventana,
 * en el navegador con la Fullscreen API (que algunos, como Safari en el teléfono, no tienen). */
export function hayPantallaCompleta(): boolean {
  return enEscritorio || (typeof document !== "undefined" && document.fullscreenEnabled === true);
}

/** Si está en pantalla completa, en el navegador; en el escritorio no se sabe desde aquí (undefined). */
export function enPantallaCompleta(): boolean | undefined {
  if (enEscritorio) return undefined;
  return typeof document !== "undefined" && document.fullscreenElement !== null;
}

/** Entra o sale de la pantalla completa. */
export function alternarPantallaCompleta(): void {
  if (enEscritorio) {
    void invoke("alternar_pantalla_completa");
    return;
  }
  const pedido = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  pedido.catch(() => {
    // El navegador puede negarla (sin gesto, o en un marco): se sigue en la ventana
  });
}

/** Se llama una vez al arrancar, en cualquier escena. */
export function prepararEscritorio(): void {
  if (!enEscritorio) return;
  window.addEventListener("keydown", (e) => {
    if (e.code !== "F11" || e.repeat) return;
    e.preventDefault();
    void invoke("alternar_pantalla_completa");
  });
  window.addEventListener("contextmenu", (e) => e.preventDefault());
}
