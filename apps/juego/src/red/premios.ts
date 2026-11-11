// El secreto y el logro de la pareja entre la escena y Convex (TU-29), como el avance (avance.ts). La escena dice
// qué ganó la pareja (PremiosDeNivel, ver escenas/tipos.ts). El anfitrión es el que simula, así que es el que se da
// cuenta y lo guarda (convex/ropero.ts les da la prenda y el logro a los dos). Los dos miran lo guardado: así el
// invitado, que no simula, también ve el aviso, y lo que ya estaba ganado de antes se marca sin avisar.
import type { Premio, PremiosDeNivel } from "../escenas/tipos";
import type { Rol } from "./marco";

/** Dónde viven los premios de la pareja (Convex en el juego; uno de mentira en las pruebas). */
export interface GuardadoDePremios {
  /** Mira lo guardado para ese nivel: avisa al empezar y cada vez que cambia. Devuelve cómo dejar de mirar. */
  mirar(nivel: number, aviso: (ganado: Readonly<Record<Premio, boolean>>) => void): () => void;
  guardar(nivel: number, premio: Premio): Promise<unknown>;
}

const PREMIOS: readonly Premio[] = ["secreto", "logro"];

/** Une los premios de la escena con lo guardado. Devuelve cómo dejar de hacerlo. */
export function sincronizarPremios(premios: PremiosDeNivel, guardado: GuardadoDePremios, rol: Rol): () => void {
  let primera = true;
  const dejarDeMirar = guardado.mirar(premios.nivel, (ganado) => {
    for (const p of PREMIOS) {
      if (!ganado[p] || premios.tiene(p)) continue;
      // Lo que ya estaba guardado al entrar no se vuelve a festejar
      if (primera) premios.marcar(p);
      else premios.ganar(p);
    }
    primera = false;
  });
  const dejarDeGuardar =
    rol === "anfitrion"
      ? premios.alGanar((premio) => {
          guardado.guardar(premios.nivel, premio).catch((error: unknown) => {
            console.warn(`Tuerce · premios: no se pudo guardar el ${premio}`, error);
          });
        })
      : () => {};
  return () => {
    dejarDeMirar();
    dejarDeGuardar();
  };
}
