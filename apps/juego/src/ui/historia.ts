// Lo que el menú (TU-56) necesita saber de la historia para llevar a la pareja a un nivel: dónde sigue, a qué
// dirección se va y qué niveles puede correr contra el reloj. Sin DOM y sin lista.ts (que baja todos los .glb): lo
// prueba `historia.test.ts`.
//
// Retomar aquí (TU-60): cuando la pareja alcanza un punto de control jugando en este navegador (no en el
// contrarreloj ni de noche), se guarda (`guardarPuntoAqui`), y «Seguir la historia» abre ese nivel ahí
// (`&punto=`). Al ganarlo se borra. Va en localStorage (`tuerce:retomar`), un punto por nivel, con try/catch.
import { HISTORIA, type NivelDeLaHistoria, nivelDeLaHistoria, PRIMER_NIVEL } from "../niveles/orden";
import { type Almacen, almacenDelNavegador } from "../sonido/mezcla";

/** Dónde sigue la historia en este navegador: el primer nivel que la pareja todavía no ganó aquí. */
export interface DondeSigue {
  readonly nivel: NivelDeLaHistoria;
  /** Si ya ganaron alguno de la historia (entonces es «seguir», no «empezar»). */
  readonly empezada: boolean;
  /** Si ya ganaron los 17: se vuelve a empezar por el patio. */
  readonly terminada: boolean;
  /** El punto de control de ese nivel donde se quedaron aquí (TU-60), si alcanzaron alguno. */
  readonly punto?: number;
}

/** `puntos`: los puntos de control guardados aquí, por nivel (`puntosGuardadosAqui`). */
export function dondeSigue(ganados: readonly string[], puntos: PuntosGuardados = {}): DondeSigue {
  const hechos = new Set(ganados);
  const falta = HISTORIA.find((n) => !hechos.has(n.clave));
  const primero = nivelDeLaHistoria(PRIMER_NIVEL) ?? HISTORIA[0];
  if (!primero) throw new Error("la historia no tiene niveles");
  const punto = falta ? puntos[falta.clave] : undefined;
  return {
    nivel: falta ?? primero,
    // Llegar a un punto de control del patio ya es haberla empezado
    empezada: HISTORIA.some((n) => hechos.has(n.clave)) || punto !== undefined,
    terminada: falta === undefined,
    ...(punto !== undefined ? { punto } : {}),
  };
}

/** A dónde lleva «Seguir la historia»: el nivel donde sigue y, si se quedaron a mitad, su punto de control. */
export function direccionParaSeguir(sigue: DondeSigue): string {
  const direccion = direccionDelNivel(sigue.nivel.clave, "aqui");
  return sigue.punto === undefined ? direccion : `${direccion}&punto=${sigue.punto}`;
}

/** «Empezar el nivel de nuevo» (TU-60): la misma dirección, pero desde la salida (sin `&punto=`, ni los de prueba
 * que lo llevan a otro lado: `&ganar=` y `&pausa`). */
export function direccionDesdeLaSalida(busqueda: string): string {
  const parametros = new URLSearchParams(busqueda);
  for (const nombre of ["punto", "ganar", "pausa"]) parametros.delete(nombre);
  return `?${parametros}`;
}

// ── Retomar aquí (TU-60) ────────────────────────────────────────────────────────────────────────────────────────

/** El último punto de control alcanzado aquí en cada nivel a medio jugar (de 1 en adelante: 0 es la salida). */
export type PuntosGuardados = Readonly<Record<string, number>>;

/** La llave en localStorage. */
export const LLAVE_RETOMAR = "tuerce:retomar";

/** Los puntos guardados en este navegador (sin almacén, o si está roto, ninguno). */
export function puntosGuardadosAqui(almacen: Almacen | undefined = almacenDelNavegador()): PuntosGuardados {
  let leido: unknown;
  try {
    const texto = almacen?.getItem(LLAVE_RETOMAR);
    leido = texto ? JSON.parse(texto) : undefined;
  } catch {
    leido = undefined;
  }
  if (!leido || typeof leido !== "object") return {};
  const puntos: Record<string, number> = {};
  for (const [clave, punto] of Object.entries(leido)) {
    if (typeof punto === "number" && Number.isInteger(punto) && punto > 0) puntos[clave] = punto;
  }
  return puntos;
}

function escribirPuntos(puntos: PuntosGuardados, almacen: Almacen | undefined): void {
  try {
    almacen?.setItem(LLAVE_RETOMAR, JSON.stringify(puntos));
  } catch {
    // Sin dónde guardar (ventana privada): se juega igual, sin recordar
  }
}

/** La pareja alcanzó ese punto de control de ese nivel jugando aquí: se retoma ahí. La salida (0) no se guarda. */
export function guardarPuntoAqui(
  clave: string,
  punto: number,
  almacen: Almacen | undefined = almacenDelNavegador(),
): void {
  if (!Number.isInteger(punto) || punto <= 0) return;
  const puntos = puntosGuardadosAqui(almacen);
  if (puntos[clave] === punto) return;
  escribirPuntos({ ...puntos, [clave]: punto }, almacen);
}

/** Ganaron ese nivel: ya no hay nada que retomar en él. */
export function borrarPuntoAqui(clave: string, almacen: Almacen | undefined = almacenDelNavegador()): void {
  const puntos = puntosGuardadosAqui(almacen);
  if (!(clave in puntos)) return;
  const { [clave]: _ganado, ...quedan } = puntos;
  escribirPuntos(quedan, almacen);
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
