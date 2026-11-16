// El avance de la pareja entre la escena y Convex (TU-22). La escena dice en qué punto de control va (AvanceDeNivel,
// ver escenas/tipos.ts); acá solo se lee lo guardado al empezar y se guarda cada punto nuevo. Quién guarda lo decide
// en-linea.ts: el anfitrión, que es el que calcula las físicas y por lo tanto el que sabe a dónde llegaron.
import type { AvanceDeNivel } from "../escenas/tipos";
import type { Rol } from "./marco";

/** Dónde vive el avance de la pareja (Convex en el juego; uno de mentira en las pruebas). */
export interface Guardado {
  /** El último punto de control guardado de la pareja en ese nivel (0 si ninguno). */
  leer(nivel: number): Promise<number>;
  /** Guarda que la pareja llegó a ese punto de control. El guardado solo avanza: uno más chico no lo pisa. */
  guardar(nivel: number, puntoDeControl: number): Promise<unknown>;
  /** Guarda que la pareja llegó a la meta: el nivel quedó ganado y se abre su contrarreloj (TU-32). */
  ganar?(nivel: number): Promise<unknown>;
}

/**
 * Lee lo guardado y, si es más adelante que donde está la escena, pone ahí a los dos muñecos. Devuelve el punto de
 * control en que quedó. Si no se puede leer (sin red, Convex caído) se juega desde donde está: no es para trabar.
 *
 * Un nivel ya ganado (lo guardado es la meta) no se retoma: volver a abrirlo es jugarlo otra vez desde la salida. Los
 * dos de la pareja leen lo mismo de Convex, así que los dos arrancan en la salida y no hace falta ponerse de acuerdo.
 * Como el guardado solo avanza, la meta queda guardada mientras lo vuelven a jugar: si lo dejan a medias, la próxima
 * vez también empiezan desde la salida.
 */
export async function retomarAvance(avance: AvanceDeNivel, guardado: Guardado): Promise<number> {
  let leido = 0;
  try {
    leido = await guardado.leer(avance.nivel);
  } catch (error) {
    console.warn("Tuerce · avance: no se pudo leer el avance guardado; se arranca desde acá", error);
  }
  if (!Number.isInteger(leido)) leido = 0;
  if (avance.meta > 0 && leido >= avance.meta) {
    // Ya habían llegado a la meta: se vuelve a guardar que ganaron (no repite nada), por si aquella vez no se pudo o
    // el avance es de antes del contrarreloj. Si no, ese nivel nunca abriría su contrarreloj.
    guardado.ganar?.(avance.nivel).catch((error: unknown) => {
      console.warn("Tuerce · avance: no se pudo guardar que ganaron el nivel", error);
    });
    return avance.puntoDeControl();
  }
  if (leido > avance.puntoDeControl()) avance.irA(leido);
  return avance.puntoDeControl();
}

/** Guarda cada punto de control nuevo que alcanza la pareja, y que ganó el nivel al llegar a la meta. Solo el
 * anfitrión: el invitado no simula, así que sus puntos de control son los que ve en las fotos y guardarlos sería
 * repetir. Devuelve cómo dejar de guardar. */
export function guardarAvance(avance: AvanceDeNivel, guardado: Guardado, rol: Rol): () => void {
  if (rol !== "anfitrion") return () => {};
  return avance.alCambiar((punto) => {
    guardado.guardar(avance.nivel, punto).catch((error: unknown) => {
      console.warn(`Tuerce · avance: no se pudo guardar el punto de control ${punto}`, error);
    });
    if (punto < avance.meta || !guardado.ganar) return;
    guardado.ganar(avance.nivel).catch((error: unknown) => {
      console.warn("Tuerce · avance: no se pudo guardar que ganaron el nivel", error);
    });
  });
}
