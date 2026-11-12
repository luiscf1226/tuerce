// La lámina que resbala (TU-13): un sólido fijo del .glb (un techo inclinado) donde el que está parado se resbala
// hacia abajo. Caminando hacia arriba se sube (más despacio); quieto, se va para abajo. El que se agarra de algo con
// las manos no se resbala.
import * as THREE from "three";
import { PASO } from "../../motor/bucle";
import { NOMBRES_PARTES } from "../../muneco";
import type { NivelEnJuego } from "../guion";
import { BRAZOS } from "./comun";

export const AJUSTES_LAMINA = {
  /** Hasta dónde busca la lámina bajo la pelvis (m). */
  alcance: 0.9,
} as const;

export interface OpcionesLamina {
  /** El sólido fijo de la lámina. */
  readonly nombre: string;
  /** Hacia dónde se resbala (en el piso; no hace falta que mida 1). */
  readonly bajada: { readonly x: number; readonly z: number };
  /** Con cuánta aceleración se resbala (m/s²). Andar llega a 9: más que esto no se sube. */
  readonly resbalar: number;
}

export interface Lamina {
  /** Si cada muñeco (el rojo y el turquesa) se resbaló en el último paso. */
  readonly resbalando: readonly [boolean, boolean];
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
}

export function crearLamina(nivel: NivelEnJuego, op: OpcionesLamina): Lamina {
  const { rapier, mundo } = nivel;
  const lamina = nivel.pieza(op.nombre).colisionador;
  const bajada = new THREE.Vector3(op.bajada.x, 0, op.bajada.z).normalize();
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const resbalando: [boolean, boolean] = [false, false];

  return {
    resbalando,
    pasar() {
      nivel.munecos.forEach((m, i) => {
        resbalando[i] = false;
        // Agarrado de algo, no se resbala
        if (BRAZOS.some((b) => m.agarrado(b) !== null)) return;
        rayo.origin = m.partes.pelvis.translation();
        const golpe = mundo.castRay(
          rayo,
          AJUSTES_LAMINA.alcance,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          (c) => c.handle === lamina.handle,
        );
        if (!golpe) return;
        resbalando[i] = true;
        for (const nombre of NOMBRES_PARTES) {
          const parte = m.partes[nombre];
          const impulso = parte.mass() * op.resbalar * PASO;
          parte.applyImpulse({ x: bajada.x * impulso, y: 0, z: bajada.z * impulso }, true);
        }
      });
    },
  };
}
