// Lo poco que cambia cuando el juego corre empacado para escritorio (apps/escritorio, Tauri, TU-35): F11 alterna la
// pantalla completa, el menú de inicio suma «Salir» y el clic derecho no abre el menú del webview. En el navegador
// no hace nada: `isTauri()` solo es cierto dentro de la ventana de Tauri.
import { invoke, isTauri } from "@tauri-apps/api/core";

export const enEscritorio = isTauri();

/** Cierra la ventana (comando `salir` de apps/escritorio/src-tauri/src/lib.rs). */
export function salirDelJuego(): void {
  void invoke("salir");
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
