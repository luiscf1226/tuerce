// Lo que el menú (TU-56) necesita saber de la historia para llevar a la pareja a un nivel: dónde sigue, a qué
// dirección se va y qué niveles puede correr contra el reloj. Sin DOM y sin lista.ts (que baja todos los .glb): lo
// prueba `historia.test.ts`.
import { HISTORIA, type NivelDeLaHistoria, nivelDeLaHistoria, PRIMER_NIVEL } from "../niveles/orden";

/** Dónde sigue la historia en este navegador: el primer nivel que la pareja todavía no ganó aquí. */
export interface DondeSigue {
  readonly nivel: NivelDeLaHistoria;
  /** Si ya ganaron alguno de la historia (entonces es «seguir», no «empezar»). */
  readonly empezada: boolean;
  /** Si ya ganaron los 17: se vuelve a empezar por el patio. */
  readonly terminada: boolean;
}

export function dondeSigue(ganados: readonly string[]): DondeSigue {
  const hechos = new Set(ganados);
  const falta = HISTORIA.find((n) => !hechos.has(n.clave));
  const primero = nivelDeLaHistoria(PRIMER_NIVEL) ?? HISTORIA[0];
  if (!primero) throw new Error("la historia no tiene niveles");
  return {
    nivel: falta ?? primero,
    empezada: HISTORIA.some((n) => hechos.has(n.clave)),
    terminada: falta === undefined,
  };
}

/** Cómo se juega un nivel elegido en el menú. */
export type Modo = "aqui" | "en-linea" | "contrarreloj" | "noche-aqui" | "noche-en-linea";

/** La dirección que abre ese nivel de ese modo. */
export function direccionDelNivel(clave: string, modo: Modo): string {
  const escena = modo === "en-linea" || modo === "noche-en-linea" ? "en-linea" : "nivel";
  const extra = modo === "contrarreloj" ? "&contrarreloj" : modo.startsWith("noche") ? "&noche" : "";
  // Desde el menú ya se eligió jugar aquí: el nivel empieza jugando, sin otro menú encima (`&jugar`)
  const jugar = modo === "aqui" || modo === "noche-aqui" ? "&jugar" : "";
  return `?escena=${escena}&nivel=${encodeURIComponent(clave)}${extra}${jugar}`;
}

/** Un nivel como lo muestra el panel: los de la historia con su número y su lugar; los otros (el de prueba y el de
 * las piezas) solo con su nombre. */
export interface NivelEnElPanel {
  readonly clave: string;
  readonly numero?: number;
  readonly titulo: string;
  readonly lugar: string;
  readonly ganado: boolean;
}

/** Los 17 de la historia en orden, con los ganados aquí marcados. */
export function nivelesDeLaHistoria(ganados: readonly string[]): NivelEnElPanel[] {
  const hechos = new Set(ganados);
  return HISTORIA.map((n) => ({ ...n, ganado: hechos.has(n.clave) }));
}

/** Los que se pueden correr contra el reloj aquí: todos los ganados en este navegador, los de la historia en su orden
 * y después los que no son de la historia. */
export function nivelesDelContrarreloj(ganados: readonly string[]): NivelEnElPanel[] {
  const historia = nivelesDeLaHistoria(ganados).filter((n) => n.ganado);
  const otros = [...new Set(ganados)]
    .filter((clave) => !nivelDeLaHistoria(clave))
    .map((clave) => ({
      clave,
      titulo: clave.charAt(0).toUpperCase() + clave.slice(1),
      lugar: "Fuera de la historia",
      ganado: true,
    }));
  return [...historia, ...otros];
}

/** El número de la carpeta con dos cifras («00» a «16»), como en niveles/. */
export function numeroConCeros(numero: number): string {
  return String(numero).padStart(2, "0");
}
