// El borde de los claros (el tutorial y la escena `dos`): el suelo se acaba a 60 m y más allá no hay nada. Quien se
// cae por el borde reaparece de pie donde empezó, como en los niveles cuando alguien cae al vacío.
import type { Muneco } from "../muneco";

/** Por debajo de esta altura (m) de la pelvis, ya se cayó del claro. */
export const ALTURA_DE_CAIDA = -4;

export interface Salida {
  readonly x: number;
  readonly z: number;
  readonly rumbo: number;
}

/** Después de `mundo.step()`: el que cayó vuelve a su salida. Devuelve a quiénes hizo reaparecer. */
export function reaparecerSiCayeron(
  munecos: readonly [Muneco, Muneco],
  salidas: readonly [Salida, Salida],
  alReaparecer?: (jugador: 0 | 1) => void,
): (0 | 1)[] {
  const volvieron: (0 | 1)[] = [];
  for (const j of [0, 1] as const) {
    if (munecos[j].partes.pelvis.translation().y >= ALTURA_DE_CAIDA) continue;
    const salida = salidas[j];
    munecos[j].reaparecer({ x: salida.x, y: 0, z: salida.z }, salida.rumbo);
    alReaparecer?.(j);
    volvieron.push(j);
  }
  return volvieron;
}
