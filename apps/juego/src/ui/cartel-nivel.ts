// El cartel al entrar a un nivel (TU-62): su número, su nombre y su lugar («03 · La calle empedrada · Comayagua,
// Honduras») en el tercio de arriba, sobre la niebla, y se va solo. Los datos son los de la historia
// (niveles/orden.ts), los mismos del menú. Cuánto se ve sale de los pasos de físicas jugando y no del reloj: con
// `?congelar=N` la imagen sale igual siempre, y con la pausa el cartel se queda quieto.
//
// Lo que no toca la página (el texto y cuánto se ve en cada paso) se prueba en cartel-nivel.test.ts.
import { nivelDeLaHistoria } from "../niveles/orden";
import { cargarFuentes } from "./contrarreloj";
import { numeroConCeros } from "./historia";
import "./cartel-nivel.css";

export interface TextoDelCartel {
  /** «03». */
  readonly numero: string;
  readonly titulo: string;
  readonly lugar: string;
  /** Todo en una línea, para leerlo en voz alta: «03 · La calle empedrada · Comayagua, Honduras». */
  readonly linea: string;
}

/** El cartel de ese nivel, o null si no es de la historia (el de prueba y el de piezas no tienen cartel). */
export function textoDelCartel(clave: string): TextoDelCartel | null {
  const nivel = nivelDeLaHistoria(clave);
  if (!nivel) return null;
  const numero = numeroConCeros(nivel.numero);
  return { numero, titulo: nivel.titulo, lugar: nivel.lugar, linea: `${numero} · ${nivel.titulo} · ${nivel.lugar}` };
}

/** Cuándo se ve el cartel, en pasos jugando: entra mientras se levanta la niebla de la entrada, se queda unos
 * cuatro segundos y se va. */
export const TIEMPOS_CARTEL = { entra: 10, entero: 40, seVa: 250, fuera: 295 } as const;
/** Con menos movimiento (TU-60): aparece y se va casi de una, y se queda un poco menos. */
export const TIEMPOS_CARTEL_CORTO = { entra: 4, entero: 10, seVa: 200, fuera: 208 } as const;

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Cuánto se ve el cartel `pasos` después de empezar a jugar: de 0 (no está) a 1. */
export function visibilidadDelCartel(pasos: number, corto = false): number {
  const { entra, entero, seVa, fuera } = corto ? TIEMPOS_CARTEL_CORTO : TIEMPOS_CARTEL;
  if (pasos <= entra || pasos >= fuera) return 0;
  if (pasos < entero) return suave((pasos - entra) / (entero - entra));
  if (pasos <= seVa) return 1;
  return 1 - suave((pasos - seVa) / (fuera - seVa));
}

// ── En la página ────────────────────────────────────────────────────────────────────────────────────────────────

export interface CartelDelNivel {
  /** Cuánto se ve (0 a 1); en 0 sale de la página. Solo toca la página si cambió algo. `quieto`: sin correrse
   * (menos movimiento, TU-60). */
  poner(visibilidad: number, quieto?: boolean): void;
}

/** Pone el cartel (todavía sin verse) arriba al centro. */
export function crearCartelDelNivel(texto: TextoDelCartel): CartelDelNivel {
  cargarFuentes();
  const cartel = document.createElement("section");
  cartel.className = "cartel-nivel";
  cartel.setAttribute("role", "status");
  cartel.setAttribute("aria-label", texto.linea);
  const numero = cartel.appendChild(document.createElement("p"));
  numero.className = "cartel-nivel-numero";
  numero.textContent = texto.numero;
  numero.setAttribute("aria-hidden", "true");
  const titulo = cartel.appendChild(document.createElement("h2"));
  titulo.textContent = texto.titulo;
  titulo.setAttribute("aria-hidden", "true");
  const lugar = cartel.appendChild(document.createElement("p"));
  lugar.className = "cartel-nivel-lugar";
  lugar.textContent = texto.lugar;
  lugar.setAttribute("aria-hidden", "true");
  let antes = -1;
  return {
    poner(visibilidad, quieto = false) {
      const v = Math.round(visibilidad * 1000) / 1000;
      if (v === antes) return;
      antes = v;
      if (v <= 0) {
        cartel.remove();
        return;
      }
      if (!cartel.isConnected) document.body.appendChild(cartel);
      cartel.style.opacity = String(v);
      // Baja un poquito al entrar y sube al irse, como si la niebla lo trajera y se lo llevara
      cartel.style.setProperty("--corrido", `${quieto ? "0" : ((1 - v) * 10).toFixed(2)}px`);
    },
  };
}
