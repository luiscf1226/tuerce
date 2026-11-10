// Pase firmado para entrar a una sala. Convex lo emite (convex/salas.ts) solo a los dos de la pareja y la sala lo
// revisa antes de abrir el WebSocket. Los dos lados comparten este archivo y el secreto SALA_SECRETO.
// Solo TypeScript simple y Web Crypto: corre igual en Convex, en el Worker y en Node (pruebas).
//
// Forma: <datos en base64url>.<HMAC-SHA256 de esos datos en base64url>

export interface Pase {
  /** Nombre de la sala (ver `salaDePareja`). */
  sala: string;
  /** Id del usuario en Convex. */
  usuario: string;
  /** Hasta cuándo sirve, en milisegundos desde 1970. */
  vence: number;
}

export type Verificacion = { ok: true; pase: Pase } | { ok: false; motivo: string };

/** Un pase dura poco: alcanza para conectarse; para reconectar se pide otro. */
export const DURACION_PASE_MS = 2 * 60 * 1000;

/** La sala de una pareja. Cabe en lo que acepta la sala: letras, números, punto, guion y guion bajo, hasta 64. */
export function salaDePareja(parejaId: string): string {
  return `pareja-${parejaId}`;
}

const texto = new TextEncoder();

function aBase64url(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(cadena: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[\w-]*$/.test(cadena)) return null;
  try {
    const binario = atob(cadena.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function llave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", texto.encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function firmarPase(pase: Pase, secreto: string): Promise<string> {
  if (!secreto) throw new Error("Falta el secreto para firmar el pase");
  const datos = aBase64url(texto.encode(JSON.stringify({ sala: pase.sala, usuario: pase.usuario, vence: pase.vence })));
  const firma = await crypto.subtle.sign("HMAC", await llave(secreto), texto.encode(datos));
  return `${datos}.${aBase64url(new Uint8Array(firma))}`;
}

function esPase(valor: unknown): valor is Pase {
  if (typeof valor !== "object" || valor === null) return false;
  const { sala, usuario, vence } = valor as Record<string, unknown>;
  return typeof sala === "string" && typeof usuario === "string" && typeof vence === "number";
}

/** Revisa la firma (en tiempo constante, con `verify`) y que no esté vencido. No mira la sala: eso lo hace quien llama. */
export async function verificarPase(token: string, secreto: string, ahora = Date.now()): Promise<Verificacion> {
  if (!secreto) return { ok: false, motivo: "la sala no tiene secreto para revisar pases" };
  const [datos, firma, sobra] = token.split(".");
  const bytesFirma = deBase64url(firma ?? "");
  if (!datos || !bytesFirma || sobra !== undefined) return { ok: false, motivo: "pase mal formado" };
  const valida = await crypto.subtle.verify("HMAC", await llave(secreto), bytesFirma, texto.encode(datos));
  if (!valida) return { ok: false, motivo: "firma inválida" };
  const bytesDatos = deBase64url(datos);
  let pase: unknown;
  try {
    pase = bytesDatos ? JSON.parse(new TextDecoder().decode(bytesDatos)) : null;
  } catch {
    pase = null;
  }
  if (!esPase(pase)) return { ok: false, motivo: "pase mal formado" };
  if (pase.vence <= ahora) return { ok: false, motivo: "pase vencido" };
  return { ok: true, pase: { sala: pase.sala, usuario: pase.usuario, vence: pase.vence } };
}
