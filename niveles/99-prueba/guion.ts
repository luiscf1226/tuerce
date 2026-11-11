// El guion del nivel de prueba (TU-11). La compuerta corta el paso después del tablón: cuando la pareja alcanza el
// punto de control 1 se hunde en el suelo en un segundo y medio, y el huacal que se cae al vacío vuelve al patio.
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";

/** Cuánto se hunde la compuerta (su alto, 2 m, y un poco más) y en cuántos pasos. */
const HUNDIR = { metros: 2.05, pasos: 90 };

export function crearGuion(): GuionDeNivel {
  let arriba = 0;
  /** Desde qué paso se hunde la compuerta (o nunca). */
  let desde = Number.POSITIVE_INFINITY;
  let huacal = { x: 0, y: 0, z: 0 };

  const ponerCompuerta = (nivel: NivelEnJuego, bajado: number) => {
    const cuerpo = nivel.pieza("compuerta").cuerpo;
    const p = cuerpo?.translation();
    if (cuerpo && p) cuerpo.setNextKinematicTranslation({ x: p.x, y: arriba - bajado, z: p.z });
  };

  return {
    alEmpezar(nivel) {
      arriba = nivel.pieza("compuerta").cuerpo?.translation().y ?? 0;
      huacal = { ...(nivel.pieza("huacal").cuerpo?.translation() ?? huacal) };
    },
    alAlcanzar(punto, nivel) {
      if (punto === 1) desde = nivel.pasos;
    },
    alRetomar(punto, nivel) {
      // Retomando desde el punto 1 o más allá, la compuerta ya está abajo
      desde = punto >= 1 ? nivel.pasos - HUNDIR.pasos : Number.POSITIVE_INFINITY;
      ponerCompuerta(nivel, punto >= 1 ? HUNDIR.metros : 0);
    },
    cadaPaso(nivel) {
      const t = Math.min(1, Math.max(0, (nivel.pasos - desde) / HUNDIR.pasos));
      if (t > 0) ponerCompuerta(nivel, HUNDIR.metros * (t * t * (3 - 2 * t)));
      const cuerpo = nivel.pieza("huacal").cuerpo;
      if (cuerpo && cuerpo.translation().y < nivel.plano.vacio) {
        cuerpo.setTranslation(huacal, true);
        cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
        cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    },
  };
}
