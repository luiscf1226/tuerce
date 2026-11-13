// La compuerta de una represa (TU-24, La poza): una hoja cinemática del .glb que sube mientras alguien sostiene su
// palanca (una pieza `palanca` con `vuelve`) y baja sola al soltarla, más rápido de lo que sube. Abierta desvía el
// agua: corta unas zonas de agua (un chorro que cae sobre el camino) y larga otras (lo que sale por la compuerta).
// `abrir()` la deja abierta para siempre (pasado su punto de control, o al retomar).
import * as THREE from "three";
import type { Agua } from "../agua";
import type { NivelEnJuego } from "../guion";
import type { Palanca } from "../piezas";
import { cuerpoDe, suave, vector } from "./comun";

export interface OpcionesCompuerta {
  /** La hoja: un sólido cinemático. */
  readonly hoja: string;
  /** La palanca (pieza) que la sube mientras está activa. */
  readonly palanca: string;
  /** Cuánto sube (m) y en cuántos pasos; al soltarla baja en `bajar` pasos. */
  readonly sube: number;
  readonly pasos: number;
  readonly bajar: number;
  /** Las aguas que se cortan al abrirla (se vacían) y las que se largan (se llenan), y a qué velocidad (m/s). */
  readonly corta?: readonly string[];
  readonly larga?: readonly string[];
  readonly velocidadAgua?: number;
}

export interface Compuerta {
  /** De 0 (cerrada) a 1 (arriba del todo). */
  readonly abierta: number;
  /** Si el agua ya está desviada del todo: las que corta, secas. */
  readonly desviada: boolean;
  /** La deja abierta para siempre; con `ya`, de una vez (con el agua ya desviada). */
  abrir(ya?: boolean): void;
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
}

export function crearCompuerta(nivel: NivelEnJuego, op: OpcionesCompuerta): Compuerta {
  const cuerpo = cuerpoDe(nivel, op.hoja);
  const palanca: Palanca = nivel.palanca(op.palanca);
  const abajo = new THREE.Vector3().copy(cuerpo.translation());
  const corta: Agua[] = (op.corta ?? []).map((n) => nivel.agua(n));
  const larga: Agua[] = (op.larga ?? []).map((n) => nivel.agua(n));
  const velocidad = op.velocidadAgua ?? 8;
  // Lo que se larga empieza seco
  for (const a of larga) a.irA(a.fondo);
  let abierta = 0;
  let siempre = false;

  const ponerAgua = (abrir: boolean, ya: boolean) => {
    for (const a of corta) a.irA(abrir ? a.fondo : a.lleno, ya ? undefined : velocidad);
    for (const a of larga) a.irA(abrir ? a.lleno : a.fondo, ya ? undefined : velocidad);
  };
  const mover = (ya: boolean) => {
    const donde = vector(abajo.clone().setY(abajo.y + op.sube * suave(abierta)));
    if (ya) cuerpo.setTranslation(donde, true);
    cuerpo.setNextKinematicTranslation(donde);
  };

  return {
    get abierta() {
      return abierta;
    },
    get desviada() {
      return corta.every((a) => a.nivel <= a.fondo);
    },
    abrir(ya = false) {
      siempre = true;
      if (!ya) return;
      abierta = 1;
      mover(true);
      ponerAgua(true, true);
    },
    pasar() {
      const abrir = siempre || palanca.activa;
      abierta = abrir ? Math.min(1, abierta + 1 / op.pasos) : Math.max(0, abierta - 1 / op.bajar);
      mover(false);
      // El agua se desvía mientras la compuerta está abierta más de la mitad
      ponerAgua(abierta > 0.5, false);
    },
  };
}
