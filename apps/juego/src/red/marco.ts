// Lo que viaja por el WebSocket de la sala, para que los datos del juego y los avisos no se mezclen:
//   · texto  → siempre un aviso en JSON: los de la sala (`hola`, `listos`, `se_fue`) o una señal de WebRTC (`senal`).
//   · binario → siempre datos del juego en modo repetidor, con un byte de cabecera delante (ver `enmarcar`).
// Así un texto del juego que parezca un aviso (`{"t":"listos"}`) nunca se confunde: va enmarcado como binario.

export type Rol = "anfitrion" | "invitado";
export type Datos = string | ArrayBuffer;

/** Lo más que deja pasar la sala por mensaje (MAX en workers/sala/src/index.ts); lo que se pasa, lo tira callada. */
export const MAX_SALA = 16 * 1024;
/** Lo más que puede mandar el juego por mensaje: lo de la sala menos el byte de cabecera del marco. */
export const MAX_DATOS = MAX_SALA - 1;

// Cabecera del marco: el bit 0 dice si es binario (si no, texto en UTF-8) y el bit 1 si iba por el canal rápido.
const BINARIO = 0b01;
const RAPIDO = 0b10;
const CONOCIDOS = BINARIO | RAPIDO;

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

/** Cuántos bytes ocupa en la red (los textos van en UTF-8). */
export function tamano(datos: Datos): number {
  return typeof datos === "string" ? codificador.encode(datos).byteLength : datos.byteLength;
}

/** Falla fuerte si no cabe: la sala lo tiraría sin avisar y el otro nunca lo vería. */
export function revisarTamano(datos: Datos): void {
  const bytes = tamano(datos);
  if (bytes > MAX_DATOS)
    throw new RangeError(`Mensaje de ${bytes} bytes: la red acepta hasta ${MAX_DATOS}. Partilo en pedazos.`);
}

/** Datos del juego → marco binario para el repetidor: [cabecera, ...bytes]. */
export function enmarcar(datos: Datos, fiable: boolean): ArrayBuffer {
  const binario = typeof datos !== "string";
  const cuerpo = binario ? new Uint8Array(datos) : codificador.encode(datos);
  const marco = new Uint8Array(1 + cuerpo.byteLength);
  marco[0] = (binario ? BINARIO : 0) | (fiable ? 0 : RAPIDO);
  marco.set(cuerpo, 1);
  return marco.buffer;
}

/** Marco binario del repetidor → datos del juego. `null` si no es un marco conocido. */
export function desenmarcar(marco: ArrayBuffer): { datos: Datos; fiable: boolean } | null {
  const bytes = new Uint8Array(marco);
  const cabecera = bytes[0];
  if (cabecera === undefined || (cabecera & ~CONOCIDOS) !== 0) return null;
  const cuerpo = bytes.slice(1);
  return {
    datos: cabecera & BINARIO ? cuerpo.buffer : decodificador.decode(cuerpo),
    fiable: (cabecera & RAPIDO) === 0,
  };
}

/** Señal de WebRTC entre los dos, de ida y vuelta por la sala. `intento` separa un intento de conexión del siguiente. */
export interface Senal {
  t: "senal";
  intento: string;
  /** Oferta (la manda el anfitrión) o respuesta (el invitado). */
  sdp?: { type: "offer" | "answer"; sdp: string };
  candidato?: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
  /** Quien la manda abandonó este intento (no abrió a tiempo o se cayó): el otro también lo suelta. */
  fin?: true;
}

export type Aviso = { t: "hola"; rol: Rol } | { t: "listos" } | { t: "se_fue"; rol?: Rol } | Senal;

/** Lee un texto de la sala. `null` si no es un aviso conocido (se ignora). */
export function leerAviso(texto: string): Aviso | null {
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof valor !== "object" || valor === null) return null;
  const aviso = valor as Record<string, unknown>;
  switch (aviso.t) {
    case "hola":
      return aviso.rol === "anfitrion" || aviso.rol === "invitado" ? { t: "hola", rol: aviso.rol } : null;
    case "listos":
      return { t: "listos" };
    case "se_fue":
      return aviso.rol === "anfitrion" || aviso.rol === "invitado" ? { t: "se_fue", rol: aviso.rol } : { t: "se_fue" };
    case "senal":
      return typeof aviso.intento === "string" ? (aviso as unknown as Senal) : null;
    default:
      return null;
  }
}

/** Señal → texto para la sala. Falla fuerte si no cabe (una oferta SDP normal ocupa 1 a 3 KB). */
export function escribirSenal(senal: Senal): string {
  const texto = JSON.stringify(senal);
  if (tamano(texto) > MAX_SALA)
    throw new RangeError(`Señal de ${tamano(texto)} bytes: la sala acepta hasta ${MAX_SALA}`);
  return texto;
}
