// Entrada de un muñeco desde el teclado: W/S o ↑/↓ para caminar, A/D o ←/→ para girar, Espacio para saltar,
// Q para el brazo izquierdo y E para el derecho.
// Con `&andar=` o `&girar=` en la dirección la entrada queda fija y el teclado no cuenta: así las capturas
// con `congelar=N` salen siempre igual.
import type { EntradaMuneco } from "../muneco";

type Eje = "avanzar" | "girar";
type Boton = "saltar" | "brazoIzquierdo" | "brazoDerecho";

const TECLAS: Record<string, Eje | undefined> = {
  KeyW: "avanzar",
  ArrowUp: "avanzar",
  KeyS: "avanzar",
  ArrowDown: "avanzar",
  KeyA: "girar",
  ArrowLeft: "girar",
  KeyD: "girar",
  ArrowRight: "girar",
};
const SIGNO: Record<string, number> = { KeyS: -1, ArrowDown: -1, KeyD: -1, ArrowRight: -1 };
const BOTONES: Record<string, Boton | undefined> = { Space: "saltar", KeyQ: "brazoIzquierdo", KeyE: "brazoDerecho" };

/** Suma lo que piden las teclas apretadas, cada eje entre -1 y 1. */
export function leerTeclas(apretadas: Iterable<string>): EntradaMuneco {
  const entrada = { avanzar: 0, girar: 0, saltar: false, brazoIzquierdo: false, brazoDerecho: false };
  for (const codigo of apretadas) {
    const eje = TECLAS[codigo];
    if (eje) entrada[eje] += SIGNO[codigo] ?? 1;
    const boton = BOTONES[codigo];
    if (boton) entrada[boton] = true;
  }
  entrada.avanzar = Math.max(-1, Math.min(1, entrada.avanzar));
  entrada.girar = Math.max(-1, Math.min(1, entrada.girar));
  return entrada;
}

/** Los parámetros de la dirección del juego; vacíos fuera del navegador (pruebas en Node). */
export function parametrosDeLaDireccion(): URLSearchParams {
  return new URLSearchParams(typeof location === "undefined" ? "" : location.search);
}

/** La entrada viva del muñeco: se actualiza sola con el teclado, o queda fija si la dirección lo pide. */
export function crearEntradaTeclado(parametros = parametrosDeLaDireccion()): EntradaMuneco {
  const entrada: EntradaMuneco = {
    avanzar: Number(parametros.get("andar") ?? 0) || 0,
    girar: Number(parametros.get("girar") ?? 0) || 0,
  };
  if (parametros.has("andar") || parametros.has("girar") || typeof window === "undefined") return entrada;

  const apretadas = new Set<string>();
  const actualizar = () => Object.assign(entrada, leerTeclas(apretadas));
  window.addEventListener("keydown", (e) => {
    if (!TECLAS[e.code] && !BOTONES[e.code]) return;
    e.preventDefault();
    apretadas.add(e.code);
    actualizar();
  });
  window.addEventListener("keyup", (e) => {
    apretadas.delete(e.code);
    actualizar();
  });
  window.addEventListener("blur", () => {
    apretadas.clear();
    actualizar();
  });
  return entrada;
}
