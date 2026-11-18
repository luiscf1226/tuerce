// Suena el golpecito de «agarrar» cuando una mano que estaba suelta agarra algo. Se llama una vez por paso, después
// de `mundo.step()`.
import type { Muneco, NombreBrazo } from "../muneco";
import { type Efecto, sonar } from "./efectos";

const BRAZOS: readonly NombreBrazo[] = ["brazoIzquierdo", "brazoDerecho"];

export function crearOidoDeManos(
  munecos: readonly Pick<Muneco, "agarrado">[],
  sonarEfecto: (efecto: Efecto) => void = sonar,
): { pasar(): void } {
  const antes = munecos.map(() => BRAZOS.map(() => false));
  return {
    pasar() {
      munecos.forEach((m, i) => {
        BRAZOS.forEach((brazo, k) => {
          const agarra = m.agarrado(brazo) !== null;
          const fila = antes[i];
          if (!fila) return;
          if (agarra && !fila[k]) sonarEfecto("agarrar");
          fila[k] = agarra;
        });
      });
    },
  };
}
