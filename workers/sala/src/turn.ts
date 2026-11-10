// Servidores ICE para WebRTC. Con TURN de Cloudflare (Realtime) la conexión directa se logra hasta en redes cerradas;
// sin las llaves solo queda el STUN público, que alcanza en la mayoría de las casas pero no en todas.
// Las llaves son secretos de la sala: TURN_KEY_ID y TURN_KEY_API_TOKEN (ver docs/ENTORNOS.md).

export const STUN_PUBLICO = "stun:stun.cloudflare.com:3478";

export interface ServidorIce {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface RespuestaIce {
  iceServers: ServidorIce[];
  /** true si no hay TURN y solo va el STUN público. */
  respaldo: boolean;
  /** Por qué no hay TURN, cuando no lo hay. */
  aviso?: string;
}

export interface LlavesTurn {
  TURN_KEY_ID?: string;
  TURN_KEY_API_TOKEN?: string;
}

const respaldo = (aviso: string): RespuestaIce => ({ iceServers: [{ urls: [STUN_PUBLICO] }], respaldo: true, aviso });

function comoLista(valor: unknown): string[] | null {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor) && valor.every((x) => typeof x === "string")) return valor;
  return null;
}

/**
 * Lee la respuesta de Cloudflare: `{ iceServers: [...] }` (o un solo objeto, como en la versión vieja de la API).
 * Saca las direcciones del puerto 53: los navegadores las bloquean y solo hacen esperar.
 */
export function leerServidoresIce(json: unknown): ServidorIce[] {
  if (typeof json !== "object" || json === null) return [];
  const crudos = (json as { iceServers?: unknown }).iceServers;
  const lista = Array.isArray(crudos) ? crudos : crudos ? [crudos] : [];
  const servidores: ServidorIce[] = [];
  for (const crudo of lista) {
    if (typeof crudo !== "object" || crudo === null) continue;
    const { urls, username, credential } = crudo as Record<string, unknown>;
    const direcciones = comoLista(urls)?.filter((url) => !/:53(\?|$)/.test(url));
    if (!direcciones?.length) continue;
    const servidor: ServidorIce = { urls: direcciones };
    if (typeof username === "string") servidor.username = username;
    if (typeof credential === "string") servidor.credential = credential;
    servidores.push(servidor);
  }
  return servidores;
}

/** Pide credenciales TURN de un día a Cloudflare. Si algo falta o falla, devuelve el STUN público y lo dice. */
export async function servidoresIce(llaves: LlavesTurn, pedir: typeof fetch = fetch): Promise<RespuestaIce> {
  const { TURN_KEY_ID: id, TURN_KEY_API_TOKEN: token } = llaves;
  if (!id || !token) return respaldo("La sala no tiene TURN_KEY_ID ni TURN_KEY_API_TOKEN: solo STUN público");
  try {
    const respuesta = await pedir(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(id)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );
    if (!respuesta.ok) return respaldo(`Cloudflare TURN respondió ${respuesta.status}: solo STUN público`);
    const iceServers = leerServidoresIce(await respuesta.json());
    if (!iceServers.length) return respaldo("Cloudflare TURN no mandó servidores: solo STUN público");
    return { iceServers, respaldo: false };
  } catch {
    return respaldo("No se pudo hablar con Cloudflare TURN: solo STUN público");
  }
}
