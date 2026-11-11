// El guion del nivel de piezas (TU-12). Dos compuertas que se abren con las piezas:
//   · compuerta-1 baja mientras la plancha está pisada: uno se para encima y el otro pasa, o le ponen un huacal.
//   · compuerta-2 baja mientras la palanca está activa (alguien la empuja), y pasado el punto 2 queda abajo: así
//     el que la sostenía también pasa.
// Los huacales que caen al vacío vuelven solos a su lugar (lo hacen las piezas).
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";

/** Cuánto se hunde cada compuerta (su alto, 2.4 m, y un poco más) y en cuántos pasos. */
const HUNDIR = { metros: 2.45, pasos: 40 };

export function crearGuion(): GuionDeNivel {
  /** Para cada compuerta: su altura arriba y cuánto está abierta (0 cerrada, 1 abajo del todo). */
  const compuertas = new Map<string, { arriba: number; abierta: number }>();

  /** Lleva la compuerta hacia abierta o cerrada, un paso de su recorrido (o de una vez, con `ya`). */
  const mover = (nivel: NivelEnJuego, nombre: string, abrir: boolean, ya = false) => {
    const c = compuertas.get(nombre);
    const cuerpo = nivel.pieza(nombre).cuerpo;
    if (!c || !cuerpo) return;
    const objetivo = abrir ? 1 : 0;
    c.abierta = ya
      ? objetivo
      : c.abierta + Math.sign(objetivo - c.abierta) * Math.min(1 / HUNDIR.pasos, Math.abs(objetivo - c.abierta));
    const t = c.abierta;
    const p = cuerpo.translation();
    cuerpo.setNextKinematicTranslation({ x: p.x, y: c.arriba - HUNDIR.metros * t * t * (3 - 2 * t), z: p.z });
  };

  return {
    alEmpezar(nivel) {
      for (const nombre of ["compuerta-1", "compuerta-2"]) {
        compuertas.set(nombre, { arriba: nivel.pieza(nombre).cuerpo?.translation().y ?? 0, abierta: 0 });
      }
    },
    alRetomar(punto, nivel) {
      // Retomando desde el punto 2 o más allá, la compuerta de la palanca ya quedó abajo
      mover(nivel, "compuerta-2", punto >= 2, true);
    },
    cadaPaso(nivel) {
      mover(nivel, "compuerta-1", nivel.plancha("plancha").pisada);
      mover(nivel, "compuerta-2", nivel.palanca("palanca").activa || nivel.puntoDeControl >= 2);
    },
  };
}
