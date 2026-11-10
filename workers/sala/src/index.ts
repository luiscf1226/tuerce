// Sala de Tuerce: presenta a los DOS jugadores de una pareja para que abran su conexión directa (WebRTC)
// y hace de repetidor si esa conexión no se logra. Cupo fijo: 2. El primero en entrar es el anfitrión
// (su navegador calcula las físicas); el segundo es el invitado.
//
// Para entrar hace falta un pase firmado que emite Convex (`pedirPase`, ver src/pase.ts): /sala/<nombre>?pase=…
// La sala recuerda a los dos primeros usuarios con pase y no deja entrar a un tercero. Si uno vuelve a entrar
// (otra pestaña, se cortó la red), su conexión nueva reemplaza a la vieja y conserva el rol.
// GET /turn?pase=… entrega los servidores ICE (TURN de Cloudflare, o STUN público si faltan las llaves). Lo
// atiende la sala del pase, que no da más de TURN_POR_HORA credenciales a cada usuario: cada una se cobra.
import { DurableObject } from "cloudflare:workers";
import { verificarPase } from "./pase";
import { type LlavesTurn, servidoresIce } from "./turn";

export interface Env extends LlavesTurn {
  SALAS: DurableObjectNamespace<Sala>;
  /** El mismo secreto que SALA_SECRETO en Convex. Sin él la sala no deja entrar a nadie. */
  SALA_SECRETO?: string;
}
type Rol = "anfitrion" | "invitado";
interface Conexion {
  rol: Rol;
  usuario: string;
  /** Lo reemplazó una conexión nueva del mismo usuario: ya no cuenta ni avisa al irse. */
  reemplazada?: boolean;
}
const MAX = 16 * 1024; // una oferta SDP cabe de sobra; las fotos de físicas en modo repetidor también
/** Cabecera con la que el Worker le pasa a la sala el usuario del pase ya revisado. */
const USUARIO = "X-Tuerce-Usuario";
const CORS = { "Access-Control-Allow-Origin": "*" };
/** Credenciales TURN por usuario y por hora: alcanza para reconectar varias veces, no para juntar un montón. */
const TURN_POR_HORA = 6;
const HORA_MS = 60 * 60 * 1000;

function conexion(ws: WebSocket): Conexion {
  const datos = ws.deserializeAttachment() as Partial<Conexion> | null;
  return {
    rol: datos?.rol === "invitado" ? "invitado" : "anfitrion",
    usuario: datos?.usuario ?? "",
    reemplazada: datos?.reemplazada,
  };
}

export class Sala extends DurableObject<Env> {
  /** Las conexiones que cuentan (sin las reemplazadas que todavía se están cerrando). */
  private vivas() {
    return this.ctx.getWebSockets().filter((w) => !conexion(w).reemplazada);
  }
  private otro(ws: WebSocket) {
    return this.vivas().find((w) => w !== ws);
  }

  override async fetch(req: Request): Promise<Response> {
    if (new URL(req.url).pathname === "/turn") return this.turn(req.headers.get(USUARIO) ?? "");
    const dentro = this.vivas();
    if (req.headers.get("Upgrade") !== "websocket") return Response.json({ ocupacion: dentro.length, cupo: 2 });
    const usuario = req.headers.get(USUARIO);
    if (!usuario) return new Response("falta el pase", { status: 401 });

    // Los dos primeros usuarios con pase quedan anotados: la sala es de esa pareja.
    const conocidos = (await this.ctx.storage.get<string[]>("usuarios")) ?? [];
    if (!conocidos.includes(usuario)) {
      if (conocidos.length >= 2) return new Response("la sala ya tiene a sus dos jugadores", { status: 409 });
      await this.ctx.storage.put("usuarios", [...conocidos, usuario]);
    }

    const vieja = dentro.find((w) => conexion(w).usuario === usuario);
    let rol: Rol;
    if (vieja) {
      rol = conexion(vieja).rol;
      vieja.serializeAttachment({ ...conexion(vieja), reemplazada: true } satisfies Conexion);
      try {
        vieja.close(4000, "entraste desde otro lado");
      } catch {
        /* ya estaba cerrada */
      }
    } else {
      if (dentro.length >= 2) return new Response("la sala ya tiene a sus dos jugadores", { status: 409 });
      rol = dentro.some((w) => conexion(w).rol === "anfitrion") ? "invitado" : "anfitrion";
    }

    const { 0: cliente, 1: servidor } = new WebSocketPair();
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ rol, usuario } satisfies Conexion);
    servidor.send(JSON.stringify({ t: "hola", rol }));
    const vivas = this.vivas();
    if (vivas.length === 2) for (const w of vivas) w.send(JSON.stringify({ t: "listos" }));
    return new Response(null, { status: 101, webSocket: cliente });
  }
  /** Servidores ICE para un usuario con pase de esta sala, con tope por hora. */
  private async turn(usuario: string): Promise<Response> {
    if (!usuario) return new Response("falta el pase", { status: 401, headers: CORS });
    const clave = `turn:${usuario}`;
    const ahora = Date.now();
    const cuenta = (await this.ctx.storage.get<{ desde: number; n: number }>(clave)) ?? { desde: ahora, n: 0 };
    const vigente = ahora - cuenta.desde < HORA_MS ? cuenta : { desde: ahora, n: 0 };
    if (vigente.n >= TURN_POR_HORA)
      return new Response("demasiados pedidos de TURN; probá en un rato", { status: 429, headers: CORS });
    await this.ctx.storage.put(clave, { desde: vigente.desde, n: vigente.n + 1 });
    return Response.json(await servidoresIce(this.env), { headers: { ...CORS, "Cache-Control": "no-store" } });
  }

  // Todo lo que manda uno le llega tal cual al otro: señales de WebRTC ({ t: 'senal', ... }) o,
  // en modo repetidor, los botones y las fotos de físicas (texto o binario).
  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if ((typeof raw === "string" ? raw.length : raw.byteLength) > MAX) return;
    if (conexion(ws).reemplazada) return;
    try {
      this.otro(ws)?.send(raw);
    } catch {
      /* el otro se fue */
    }
  }
  override webSocketClose(ws: WebSocket) {
    const { rol, reemplazada } = conexion(ws);
    if (reemplazada) return;
    try {
      this.otro(ws)?.send(JSON.stringify({ t: "se_fue", rol }));
    } catch {
      /* nadie */
    }
  }
  override webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pase = url.searchParams.get("pase") ?? "";

    if (url.pathname === "/turn") {
      const revision = await verificarPase(pase, env.SALA_SECRETO ?? "");
      if (!revision.ok) return new Response(revision.motivo, { status: 401, headers: CORS });
      const sala = env.SALAS.get(env.SALAS.idFromName(revision.pase.sala));
      return sala.fetch(new Request(url, { headers: { [USUARIO]: revision.pase.usuario } }));
    }

    // /sala/<nombre de la sala, ver salaDePareja en src/pase.ts>
    const nombre = url.pathname.match(/^\/sala\/([\w.-]{1,64})$/)?.[1];
    if (!nombre) return new Response("Tuerce · salas", { status: 200 });
    const sala = env.SALAS.get(env.SALAS.idFromName(nombre));
    if (req.headers.get("Upgrade") !== "websocket") return sala.fetch(req);

    const revision = await verificarPase(pase, env.SALA_SECRETO ?? "");
    if (!revision.ok) return new Response(revision.motivo, { status: 401 });
    if (revision.pase.sala !== nombre) return new Response("el pase es de otra sala", { status: 403 });
    // La cabecera la pone siempre el Worker: si el cliente mandó una, se pisa.
    const cabeceras = new Headers(req.headers);
    cabeceras.set(USUARIO, revision.pase.usuario);
    return sala.fetch(new Request(req, { headers: cabeceras }));
  },
} satisfies ExportedHandler<Env>;
