// La conexión entre los dos jugadores. El juego solo ve `enviar`, `alRecibir` y el estado; por dentro:
//   1. Pide los servidores ICE a la sala (`/turn?pase=…`) y abre el WebSocket de la sala.
//   2. Cuando la sala avisa `listos`, el anfitrión ofrece una conexión directa (WebRTC) y las señales van por la sala.
//   3. Si los canales directos abren antes de `esperaDirectaMs`, todo va directo («directa»).
//   4. Si no, los datos van por la sala enmarcados («repetidor»; ver marco.ts). La API es la misma: el juego no se entera.
//   5. Si lo directo se cae a media partida, se pasa al repetidor sin perder la sala, y el anfitrión vuelve a intentar.
//   6. Si se cae el WebSocket, se reconecta con un pase nuevo (`pedirPase`); si lo directo sigue vivo, ni se nota.
// Lo que llega por cualquier camino se entrega siempre: así los dos no tienen que ponerse de acuerdo al instante en
// cuál usar, y un cambio de camino no pierde nada más que lo que iba en el aire.
import { type AbrirDirecta, abrirDirectaWebRTC, type Directa } from "./directa";
import {
  type Datos,
  desenmarcar,
  enmarcar,
  escribirSenal,
  leerAviso,
  type Rol,
  revisarTamano,
  type Senal,
} from "./marco";

export type EstadoRed = "conectando" | "directa" | "repetidor" | "se_fue" | "cerrada";
/** Por dónde llegó un mensaje: los dos canales directos o la sala. */
export type Via = "fiable" | "rapido" | "repetidor";

export interface OpcionesConexion {
  /** La sala: `https://<sala>/sala/<nombre>` (también sirve `wss://` o `http://127.0.0.1:8798/…` en local). */
  urlSala: string;
  /** Pase firmado por Convex (`pedirPase`) o por las pruebas. */
  pase: string;
  /** Pide un pase nuevo para reconectar (los pases duran 2 minutos). Sin esto se reusa `pase`. */
  pedirPase?: () => Promise<string>;
  /** `repetidor`: simula una red donde lo directo no pasa (no se cruzan candidatos ICE). Para probar. */
  forzar?: "repetidor";
  /** Cuánto esperar a que abra lo directo antes de pasar al repetidor. */
  esperaDirectaMs?: number;
  /** Después de caerse lo directo a media partida, cuánto esperar para volver a intentarlo. */
  reintentarDirectaMs?: number;
}

export interface Conexion {
  /** El anfitrión calcula las físicas; el invitado las recibe. Lo decide la sala (el primero en entrar). */
  readonly rol: Rol;
  readonly estado: EstadoRed;
  /**
   * Manda texto o binario al otro. `fiable` (por omisión) llega siempre y en orden; sin él puede perderse o
   * desordenarse, pero no se atrasa (para las fotos de físicas). Hasta MAX_DATOS bytes: si no cabe, lanza RangeError.
   * Antes de que llegue el otro (o si se fue), se tira.
   */
  enviar(datos: Datos, opciones?: { fiable?: boolean }): void;
  /** Devuelve con qué dejar de escuchar. */
  alRecibir(oyente: (datos: Datos, via: Via) => void): () => void;
  alCambiarEstado(oyente: (estado: EstadoRed) => void): () => void;
  /** Para pruebas y depuración: corta lo directo como si se hubiera caído la red. */
  cortarDirecta(): void;
  cerrar(): void;
}

/** El WebSocket de la sala, reducido a lo que se usa (así las pruebas lo cambian por uno falso). */
export interface Socket {
  enviar(datos: string | ArrayBuffer): void;
  cerrar(): void;
  /** Bytes que todavía no salieron. */
  readonly atorado: number;
}
export interface EventosSocket {
  alAbrir(): void;
  alRecibir(datos: string | ArrayBuffer): void;
  alCerrar(codigo: number): void;
}

export interface Dependencias {
  crearSocket(url: string, eventos: EventosSocket): Socket;
  abrirDirecta: AbrirDirecta;
  pedirIce(url: string): Promise<RTCIceServer[]>;
}

export const ESPERA_DIRECTA_MS = 5000;
export const REINTENTAR_DIRECTA_MS = 10_000;
/** Cuántas veces vuelve a intentar lo directo después de una caída, antes de quedarse en el repetidor. */
export const MAX_REINTENTOS = 3;
/** Al volver a entrar a la sala, cuánto esperar el `listos` antes de dar por ido al otro. */
const CONFIRMAR_MS = 1500;
/** Reconexiones seguidas que fallan antes de rendirse. */
const MAX_FALLOS = 8;
/** La sala cierra con este código la conexión vieja cuando el mismo usuario entra desde otro lado. */
export const CODIGO_REEMPLAZADA = 4000;
const ATORADO_BYTES = 64 * 1024;

/** Dónde está el WebSocket de la sala y su `/turn`, con el pase puesto. */
export function direccionesDeSala(urlSala: string, pase: string): { socket: string; turn: string } {
  const socket = new URL(urlSala);
  socket.protocol = socket.protocol === "https:" || socket.protocol === "wss:" ? "wss:" : "ws:";
  socket.searchParams.set("pase", pase);
  const turn = new URL("/turn", urlSala);
  turn.protocol = socket.protocol === "wss:" ? "https:" : "http:";
  turn.searchParams.set("pase", pase);
  return { socket: socket.href, turn: turn.href };
}

function nuevoIntento(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const DEPENDENCIAS_NAVEGADOR: Dependencias = {
  crearSocket(url, eventos) {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => eventos.alAbrir();
    ws.onmessage = (e: MessageEvent<string | ArrayBuffer>) => eventos.alRecibir(e.data);
    ws.onclose = (e) => eventos.alCerrar(e.code);
    return {
      enviar: (datos) => ws.send(datos),
      cerrar: () => ws.close(1000, "listo"),
      get atorado() {
        return ws.bufferedAmount;
      },
    };
  },
  abrirDirecta: abrirDirectaWebRTC,
  async pedirIce(url) {
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error(`/turn respondió ${respuesta.status}`);
    const { iceServers } = (await respuesta.json()) as { iceServers?: RTCIceServer[] };
    return Array.isArray(iceServers) ? iceServers : [];
  },
};

/** Entra a la sala. Se resuelve cuando la sala dice el rol (`hola`); falla si no deja entrar. */
export function conectar(op: OpcionesConexion, deps: Dependencias = DEPENDENCIAS_NAVEGADOR): Promise<Conexion> {
  const esperaMs = op.esperaDirectaMs ?? ESPERA_DIRECTA_MS;
  const reintentarMs = op.reintentarDirectaMs ?? REINTENTAR_DIRECTA_MS;
  const forzado = op.forzar === "repetidor";

  return new Promise((resolver, rechazar) => {
    let pase = op.pase;
    let rol: Rol | undefined;
    let estado: EstadoRed = "conectando";
    let cerrada = false;

    let socket: Socket | undefined;
    let socketAbierto = false;
    let fallosSeguidos = 0;

    /** Si el otro está en la sala: nunca llegó, está, o se fue. */
    let companero: "nunca" | "presente" | "se_fue" = "nunca";
    /** Mientras sea true el estado es «conectando»: todavía no se sabe si va directo o por la sala. */
    let esperandoPrimera = true;

    let intentoActual: string | undefined;
    let directa: Directa | undefined;
    let directaAbierta = false;
    /** Señales del intento actual que llegaron antes de crear su conexión (esperando los servidores ICE). */
    let pendientes: Senal[] = [];
    let reintentos = 0;

    let espera: ReturnType<typeof setTimeout> | undefined;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let reconexion: ReturnType<typeof setTimeout> | undefined;
    let confirmar: ReturnType<typeof setTimeout> | undefined;

    const oyentesDatos = new Set<(datos: Datos, via: Via) => void>();
    const oyentesEstado = new Set<(estado: EstadoRed) => void>();

    // Servidores ICE: se piden una vez (la sala tiene tope por hora) y duran horas. Si fallan, se intenta sin ellos:
    // en la misma red alcanza.
    let ice: Promise<RTCIceServer[]> | undefined;
    const servidoresIce = (): Promise<RTCIceServer[]> => {
      if (forzado) return Promise.resolve([]);
      ice ??= deps.pedirIce(direccionesDeSala(op.urlSala, pase).turn).catch((error: unknown) => {
        console.warn("Tuerce · red: sin servidores ICE, se intenta igual", error);
        ice = undefined;
        return [];
      });
      return ice;
    };

    const calcular = (): EstadoRed => {
      if (cerrada) return "cerrada";
      if (companero === "se_fue") return "se_fue";
      if (directaAbierta) return "directa";
      if (companero === "nunca" || esperandoPrimera || !socketAbierto) return "conectando";
      return "repetidor";
    };
    const actualizar = () => {
      const nuevo = calcular();
      if (nuevo === estado) return;
      estado = nuevo;
      for (const oyente of oyentesEstado) oyente(nuevo);
    };
    const emitir = (datos: Datos, via: Via) => {
      for (const oyente of oyentesDatos) oyente(datos, via);
    };

    const mandarSenal = (senal: Senal) => {
      if (socket && socketAbierto) socket.enviar(escribirSenal(senal));
    };

    /** Suelta el intento directo actual. Devuelve si estaba abierto. */
    const abandonar = (avisar: boolean): boolean => {
      clearTimeout(espera);
      const intento = intentoActual;
      const estabaAbierta = directaAbierta;
      directa?.cerrar();
      directa = undefined;
      directaAbierta = false;
      intentoActual = undefined;
      pendientes = [];
      if (avisar && intento) {
        try {
          mandarSenal({ t: "senal", intento, fin: true });
        } catch {
          /* el socket se estaba cerrando */
        }
      }
      return estabaAbierta;
    };

    const programarReintento = () => {
      clearTimeout(reintento);
      if (rol !== "anfitrion" || forzado || reintentos >= MAX_REINTENTOS) return;
      reintentos++;
      reintento = setTimeout(() => {
        if (!cerrada && companero === "presente" && socketAbierto && !intentoActual) void intentarDirecta();
      }, reintentarMs);
    };

    /** Lo directo se cayó, no abrió a tiempo o el otro lo soltó: queda el repetidor. */
    const caida = (avisar: boolean) => {
      const estabaAbierta = abandonar(avisar);
      esperandoPrimera = false;
      if (estabaAbierta || reintentos > 0) programarReintento();
      actualizar();
    };

    const iniciarEspera = () => {
      clearTimeout(espera);
      espera = setTimeout(() => {
        if (!directaAbierta) caida(true);
      }, esperaMs);
    };

    const crearDirecta = (intento: string, iceServers: RTCIceServer[]) => {
      if (!rol) return;
      const esta: Directa = deps.abrirDirecta({
        rol,
        intento,
        iceServers,
        bloquearIce: forzado,
        enviarSenal: mandarSenal,
        alAbrir: () => {
          if (directa !== esta) return;
          clearTimeout(espera);
          directaAbierta = true;
          esperandoPrimera = false;
          reintentos = 0;
          actualizar();
        },
        alCaer: (motivo) => {
          if (directa !== esta) return;
          console.info(`Tuerce · red: lo directo se cayó (${motivo}); sigue por la sala`);
          caida(true);
        },
        alRecibir: (datos, fiable) => emitir(datos, fiable ? "fiable" : "rapido"),
      });
      directa = esta;
      for (const senal of pendientes) esta.recibirSenal(senal);
      pendientes = [];
    };

    /** Empieza un intento directo nuevo. El anfitrión ofrece; el invitado espera la oferta. */
    const intentarDirecta = async () => {
      abandonar(true);
      iniciarEspera();
      if (rol !== "anfitrion") return;
      const intento = nuevoIntento();
      intentoActual = intento;
      const servidores = await servidoresIce();
      if (intentoActual === intento && !cerrada) crearDirecta(intento, servidores);
    };

    const atenderSenal = (senal: Senal) => {
      // El invitado sigue cualquier oferta nueva del anfitrión: un reintento o una sala recién reconectada.
      if (rol === "invitado" && senal.sdp?.type === "offer" && senal.intento !== intentoActual) {
        abandonar(false);
        intentoActual = senal.intento;
        pendientes = [senal];
        iniciarEspera();
        void servidoresIce().then((servidores) => {
          if (intentoActual === senal.intento && !cerrada) crearDirecta(senal.intento, servidores);
        });
        return;
      }
      if (senal.intento !== intentoActual) return; // de un intento viejo
      if (senal.fin) caida(false);
      else if (directa) directa.recibirSenal(senal);
      else pendientes.push(senal);
    };

    const recibirDeSala = (datos: string | ArrayBuffer) => {
      if (typeof datos !== "string") {
        const marco = desenmarcar(datos);
        if (marco) emitir(marco.datos, "repetidor");
        else console.warn("Tuerce · red: llegó un marco desconocido por la sala");
        return;
      }
      const aviso = leerAviso(datos);
      if (!aviso) return;
      switch (aviso.t) {
        case "hola": {
          fallosSeguidos = 0;
          const primera = rol === undefined;
          rol = aviso.rol;
          if (primera) resolver(conexion);
          // Volvimos a entrar: si el otro sigue, la sala manda `listos` enseguida; si no llega, se fue.
          else if (companero === "presente") {
            clearTimeout(confirmar);
            confirmar = setTimeout(() => {
              companero = "se_fue";
              esperandoPrimera = true;
              abandonar(false);
              actualizar();
            }, CONFIRMAR_MS);
          }
          actualizar();
          return;
        }
        case "listos":
          clearTimeout(confirmar);
          clearTimeout(reintento);
          if (companero !== "presente") esperandoPrimera = true;
          companero = "presente";
          reintentos = 0;
          // Si la sala se cortó un momento pero lo directo sigue vivo, no se toca: renegociar lo cortaría
          if (!directaAbierta) void intentarDirecta();
          actualizar();
          return;
        case "se_fue":
          clearTimeout(confirmar);
          clearTimeout(reintento);
          companero = "se_fue";
          esperandoPrimera = true;
          reintentos = 0;
          abandonar(false);
          actualizar();
          return;
        case "senal":
          atenderSenal(aviso);
          return;
      }
    };

    const abrirSocket = () => {
      const este: Socket = deps.crearSocket(direccionesDeSala(op.urlSala, pase).socket, {
        alAbrir: () => {
          if (socket !== este) return;
          socketAbierto = true;
          actualizar();
        },
        alRecibir: (datos) => {
          if (socket === este) recibirDeSala(datos);
        },
        alCerrar: (codigo) => {
          if (socket !== este) return;
          socket = undefined;
          socketAbierto = false;
          // Un «¿sigue el otro?» de una conexión anterior ya no vale: lo arma de nuevo el próximo `hola`
          clearTimeout(confirmar);
          if (cerrada) return;
          if (rol === undefined) {
            terminar();
            rechazar(new Error(`La sala no dejó entrar (código ${codigo}): ¿pase vencido o sala llena?`));
            return;
          }
          if (codigo === CODIGO_REEMPLAZADA) {
            console.info("Tuerce · red: entraste a la sala desde otro lado; esta conexión se cierra");
            terminar();
            return;
          }
          fallosSeguidos++;
          if (fallosSeguidos > MAX_FALLOS) {
            console.error("Tuerce · red: no se pudo volver a entrar a la sala");
            terminar();
            return;
          }
          const demora = Math.min(500 * 2 ** (fallosSeguidos - 1), 8000);
          reconexion = setTimeout(() => void reconectar(), demora);
          actualizar();
        },
      });
      socket = este;
    };

    const reconectar = async () => {
      if (cerrada) return;
      try {
        if (op.pedirPase) pase = await op.pedirPase();
      } catch (error) {
        console.warn("Tuerce · red: no se pudo pedir un pase nuevo; se usa el anterior", error);
      }
      if (!cerrada) abrirSocket();
    };

    const terminar = () => {
      if (cerrada) return;
      cerrada = true;
      for (const t of [espera, reintento, reconexion, confirmar]) clearTimeout(t);
      abandonar(false);
      const viejo = socket;
      socket = undefined;
      socketAbierto = false;
      viejo?.cerrar();
      actualizar();
    };

    const conexion: Conexion = {
      get rol() {
        return rol ?? "anfitrion";
      },
      get estado() {
        return estado;
      },
      enviar(datos, { fiable = true } = {}) {
        revisarTamano(datos);
        if (cerrada) return;
        if (directa && directaAbierta && directa.enviar(datos, fiable)) return;
        if (!socket || !socketAbierto || companero !== "presente") return;
        if (!fiable && socket.atorado > ATORADO_BYTES) return;
        socket.enviar(enmarcar(datos, fiable));
      },
      alRecibir(oyente) {
        oyentesDatos.add(oyente);
        return () => oyentesDatos.delete(oyente);
      },
      alCambiarEstado(oyente) {
        oyentesEstado.add(oyente);
        return () => oyentesEstado.delete(oyente);
      },
      cortarDirecta() {
        if (directa) caida(true);
      },
      cerrar: terminar,
    };

    if (!forzado) void servidoresIce();
    abrirSocket();
  });
}
