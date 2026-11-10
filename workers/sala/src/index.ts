// Sala de Tuerce: presenta a los DOS jugadores de una pareja para que abran su conexión directa (WebRTC)
// y hace de repetidor si esa conexión no se logra. Cupo fijo: 2. El primero en entrar es el anfitrión
// (su navegador calcula las físicas); el segundo es el invitado.
//
// Falta (fase 3 del plan): exigir el pase firmado que emite Convex y entregar credenciales TURN.
// Hoy cualquiera con el nombre de la sala puede entrar: sirve solo para desarrollo.
import { DurableObject } from "cloudflare:workers";

export interface Env { SALAS: DurableObjectNamespace<Sala> }
type Rol = "anfitrion" | "invitado";
const MAX = 16 * 1024; // una oferta SDP cabe de sobra; las fotos de físicas en modo repetidor también

export class Sala extends DurableObject<Env> {
  private otro(ws: WebSocket) { return this.ctx.getWebSockets().find(w => w !== ws); }

  async fetch(req: Request): Promise<Response> {
    const dentro = this.ctx.getWebSockets();
    if (req.headers.get("Upgrade") !== "websocket") return Response.json({ ocupacion: dentro.length, cupo: 2 });
    if (dentro.length >= 2) return new Response("la sala ya tiene a sus dos jugadores", { status: 409 });
    const rol: Rol = dentro.some(w => w.deserializeAttachment() === "anfitrion") ? "invitado" : "anfitrion";
    const [cliente, servidor] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment(rol);
    servidor.send(JSON.stringify({ t: "hola", rol }));
    if (this.ctx.getWebSockets().length === 2) for (const w of this.ctx.getWebSockets()) w.send(JSON.stringify({ t: "listos" }));
    return new Response(null, { status: 101, webSocket: cliente });
  }
  // Todo lo que manda uno le llega tal cual al otro: señales de WebRTC ({ t: 'senal', ... }) o,
  // en modo repetidor, los botones y las fotos de físicas (texto o binario).
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if ((typeof raw === "string" ? raw.length : raw.byteLength) > MAX) return;
    try { this.otro(ws)?.send(raw); } catch { /* el otro se fue */ }
  }
  webSocketClose(ws: WebSocket) { try { this.otro(ws)?.send(JSON.stringify({ t: "se_fue", rol: ws.deserializeAttachment() })); } catch { /* nadie */ } }
  webSocketError(ws: WebSocket) { this.webSocketClose(ws); }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // /sala/<código de la invitación o id de la sesión>
    const m = new URL(req.url).pathname.match(/^\/sala\/([\w.-]{1,64})$/);
    if (!m) return new Response("Tuerce · salas", { status: 200 });
    return env.SALAS.get(env.SALAS.idFromName(m[1])).fetch(req);
  },
} satisfies ExportedHandler<Env>;
