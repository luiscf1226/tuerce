// La máquina de estados de la conexión con una sala y un WebRTC de mentira. Lo de verdad (dos Chromium, wrangler dev)
// lo prueba `pnpm prueba:red`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CODIGO_REEMPLAZADA,
  type Conexion,
  conectar,
  type Dependencias,
  direccionesDeSala,
  ESPERA_DIRECTA_MS,
  type EstadoRed,
  type EventosSocket,
  type OpcionesConexion,
  REINTENTAR_DIRECTA_MS,
  type Via,
} from "./conexion";
import type { OpcionesDirecta } from "./directa";
import { type Datos, desenmarcar, enmarcar, MAX_DATOS, type Senal } from "./marco";

interface SocketFalso {
  url: string;
  eventos: EventosSocket;
  enviados: (string | ArrayBuffer)[];
  cerrado: boolean;
}
interface DirectaFalsa {
  op: OpcionesDirecta;
  senales: Senal[];
  enviados: { datos: Datos; fiable: boolean }[];
  abierta: boolean;
  cerrada: boolean;
}

function mundo() {
  const sockets: SocketFalso[] = [];
  const directas: DirectaFalsa[] = [];
  const deps: Dependencias = {
    crearSocket(url, eventos) {
      const s: SocketFalso = { url, eventos, enviados: [], cerrado: false };
      sockets.push(s);
      return { enviar: (d) => s.enviados.push(d), cerrar: () => (s.cerrado = true), atorado: 0 };
    },
    abrirDirecta(op) {
      const d: DirectaFalsa = { op, senales: [], enviados: [], abierta: false, cerrada: false };
      directas.push(d);
      return {
        intento: op.intento,
        recibirSenal: (s) => d.senales.push(s),
        enviar: (datos, fiable) => d.abierta && !d.cerrada && d.enviados.push({ datos, fiable }) > 0,
        cerrar: () => (d.cerrada = true),
      };
    },
    pedirIce: vi.fn(async () => [{ urls: ["stun:prueba"] }]),
  };
  const socket = () => {
    const s = sockets.at(-1);
    if (!s) throw new Error("no hay socket");
    return s;
  };
  const directa = () => {
    const d = directas.at(-1);
    if (!d) throw new Error("no hay directa");
    return d;
  };
  const llega = (aviso: object) => socket().eventos.alRecibir(JSON.stringify(aviso));
  const abrir = (d = directa()) => {
    d.abierta = true;
    d.op.alAbrir();
  };
  /** Señales y marcos que mandó un socket. */
  const senales = (s = socket()) =>
    s.enviados.filter((x): x is string => typeof x === "string").map((x) => JSON.parse(x) as Senal);
  const marcos = (s = socket()) =>
    s.enviados.filter((x): x is ArrayBuffer => typeof x !== "string").map((x) => desenmarcar(x));
  return { sockets, directas, deps, socket, directa, llega, abrir, senales, marcos };
}

/** Entra a la sala con el rol dado; devuelve la conexión, los estados vistos y lo recibido. */
async function entrar(m: ReturnType<typeof mundo>, rol: "anfitrion" | "invitado", op: Partial<OpcionesConexion> = {}) {
  const promesa = conectar({ urlSala: "https://sala.prueba/sala/pareja-1", pase: "pase1", ...op }, m.deps);
  m.socket().eventos.alAbrir();
  m.llega({ t: "hola", rol });
  const conexion: Conexion = await promesa;
  const estados: EstadoRed[] = [];
  const recibidos: [Datos, Via][] = [];
  conexion.alCambiarEstado((e) => estados.push(e));
  conexion.alRecibir((d, v) => recibidos.push([d, v]));
  return { conexion, estados, recibidos };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("direcciones de la sala", () => {
  it("pasa de http a ws y de https a wss, con el pase en las dos", () => {
    expect(direccionesDeSala("https://sala.prueba/sala/pareja-1", "p")).toEqual({
      socket: "wss://sala.prueba/sala/pareja-1?pase=p",
      turn: "https://sala.prueba/turn?pase=p",
    });
    expect(direccionesDeSala("http://127.0.0.1:8798/sala/x", "p").socket).toBe("ws://127.0.0.1:8798/sala/x?pase=p");
    expect(direccionesDeSala("ws://127.0.0.1:8798/sala/x", "p").turn).toBe("http://127.0.0.1:8798/turn?pase=p");
  });
});

describe("conexión directa", () => {
  it("el anfitrión ofrece al llegar `listos`; si abre, todo va directo", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion");
    expect(conexion.rol).toBe("anfitrion");
    expect(conexion.estado).toBe("conectando");
    expect(m.deps.pedirIce).toHaveBeenCalledWith("https://sala.prueba/turn?pase=pase1");

    m.llega({ t: "listos" });
    await flush();
    expect(m.directa().op.rol).toBe("anfitrion");
    expect(m.directa().op.iceServers).toEqual([{ urls: ["stun:prueba"] }]);
    expect(conexion.estado).toBe("conectando");

    m.abrir();
    expect(estados).toEqual(["directa"]);
    conexion.enviar("botones");
    conexion.enviar(new ArrayBuffer(4), { fiable: false });
    expect(m.directa().enviados.map((e) => e.fiable)).toEqual([true, false]);
    expect(m.marcos()).toEqual([]); // nada del juego por la sala
  });

  it("si lo directo no abre a tiempo, pasa al repetidor, lo avisa y los datos van enmarcados por la sala", async () => {
    const m = mundo();
    const { conexion, estados, recibidos } = await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    const intento = m.directa().op.intento;

    await vi.advanceTimersByTimeAsync(ESPERA_DIRECTA_MS);
    expect(estados).toEqual(["repetidor"]);
    expect(m.directa().cerrada).toBe(true);
    expect(m.senales()).toContainEqual({ t: "senal", intento, fin: true });

    conexion.enviar('{"t":"listos"}');
    conexion.enviar(new Uint8Array([7]).buffer, { fiable: false });
    const [texto, binario] = m.marcos();
    expect(texto).toEqual({ datos: '{"t":"listos"}', fiable: true });
    expect(binario?.fiable).toBe(false);

    m.socket().eventos.alRecibir(enmarcar("del otro", false));
    expect(recibidos).toEqual([["del otro", "repetidor"]]);
  });

  it("si lo directo se cae a media partida sigue por la sala y el anfitrión vuelve a intentar", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion", { reintentarDirectaMs: 1000 });
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    const primera = m.directa();

    primera.op.alCaer("prueba");
    expect(conexion.estado).toBe("repetidor");
    expect(m.senales()).toContainEqual({ t: "senal", intento: primera.op.intento, fin: true });
    conexion.enviar("sigue");
    expect(m.marcos()).toEqual([{ datos: "sigue", fiable: true }]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(m.directas).toHaveLength(2);
    expect(m.directa().op.intento).not.toBe(primera.op.intento);
    m.abrir();
    expect(estados).toEqual(["directa", "repetidor", "directa"]);
  });

  it("deja de reintentar después de MAX_REINTENTOS intentos fallidos", async () => {
    const m = mundo();
    await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    m.directa().op.alCaer("prueba");
    for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(REINTENTAR_DIRECTA_MS + ESPERA_DIRECTA_MS);
    expect(m.directas).toHaveLength(4); // la primera y tres reintentos
  });

  it("el invitado sigue la oferta del anfitrión, aunque lleguen señales antes de tener los servidores ICE", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "invitado");
    m.llega({ t: "listos" });
    await flush();
    expect(m.directas).toHaveLength(0);

    const oferta = { t: "senal", intento: "x1", sdp: { type: "offer", sdp: "v=0" } };
    const candidato = { t: "senal", intento: "x1", candidato: { candidate: "c" } };
    m.llega(oferta);
    m.llega(candidato);
    m.llega({ t: "senal", intento: "viejo", candidato: { candidate: "c" } });
    await flush();
    expect(m.directa().op.rol).toBe("invitado");
    expect(m.directa().senales).toEqual([oferta, candidato]);

    m.abrir();
    expect(conexion.estado).toBe("directa");
    m.llega({ t: "senal", intento: "x1", fin: true });
    expect(conexion.estado).toBe("repetidor");
    expect(m.directa().cerrada).toBe(true);
    // El invitado no reintenta solo: espera la próxima oferta.
    await vi.advanceTimersByTimeAsync(REINTENTAR_DIRECTA_MS * 2);
    expect(m.directas).toHaveLength(1);
  });

  it("con `forzar: repetidor` no pide TURN y no cruza candidatos", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "anfitrion", { forzar: "repetidor" });
    m.llega({ t: "listos" });
    await flush();
    expect(m.deps.pedirIce).not.toHaveBeenCalled();
    expect(m.directa().op.bloquearIce).toBe(true);
    await vi.advanceTimersByTimeAsync(ESPERA_DIRECTA_MS);
    expect(conexion.estado).toBe("repetidor");
  });

  it("lo que no cabe falla fuerte por cualquier camino", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "anfitrion");
    expect(() => conexion.enviar(new ArrayBuffer(MAX_DATOS + 1))).toThrow(RangeError);
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    expect(() => conexion.enviar("x".repeat(MAX_DATOS + 1))).toThrow(RangeError);
  });
});

describe("el otro se va y la sala se corta", () => {
  it("`se_fue` cierra lo directo; al volver el otro empieza de nuevo", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    m.llega({ t: "se_fue", rol: "invitado" });
    expect(conexion.estado).toBe("se_fue");
    expect(m.directa().cerrada).toBe(true);
    conexion.enviar("nadie");
    expect(m.marcos()).toEqual([]);

    m.llega({ t: "listos" });
    await flush();
    expect(conexion.estado).toBe("conectando");
    m.abrir();
    expect(estados).toEqual(["directa", "se_fue", "conectando", "directa"]);
  });

  it("si se cae el WebSocket con lo directo vivo, sigue directo y reconecta con un pase nuevo", async () => {
    const m = mundo();
    const pedirPase = vi.fn(async () => "pase2");
    const { conexion } = await entrar(m, "anfitrion", { pedirPase });
    m.llega({ t: "listos" });
    await flush();
    m.abrir();

    m.socket().eventos.alCerrar(1006);
    expect(conexion.estado).toBe("directa");
    await vi.advanceTimersByTimeAsync(500);
    expect(pedirPase).toHaveBeenCalledOnce();
    expect(m.sockets).toHaveLength(2);
    expect(m.socket().url).toBe("wss://sala.prueba/sala/pareja-1?pase=pase2");
  });

  it("en el repetidor, al cortarse la sala pasa a «conectando» y vuelve sin mostrar «se_fue»", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    await vi.advanceTimersByTimeAsync(ESPERA_DIRECTA_MS);
    m.socket().eventos.alCerrar(1006);
    expect(conexion.estado).toBe("conectando");

    await vi.advanceTimersByTimeAsync(500);
    m.socket().eventos.alAbrir();
    m.llega({ t: "hola", rol: "anfitrion" });
    m.llega({ t: "listos" });
    await vi.advanceTimersByTimeAsync(2000);
    expect(estados).toEqual(["repetidor", "conectando", "repetidor"]);
  });

  it("al volver a entrar, si no llega `listos` es que el otro se fue", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "invitado");
    m.llega({ t: "listos" });
    m.socket().eventos.alCerrar(1006);
    await vi.advanceTimersByTimeAsync(500);
    m.socket().eventos.alAbrir();
    m.llega({ t: "hola", rol: "invitado" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(conexion.estado).not.toBe("se_fue");
    await vi.advanceTimersByTimeAsync(1000);
    expect(conexion.estado).toBe("se_fue");
  });

  it("el anfitrión que vuelve a entrar sigue de anfitrión y vuelve a ofrecer lo directo", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    // Se cae todo: la sala y lo directo
    m.directa().op.alCaer("prueba");
    m.socket().eventos.alCerrar(1006);
    await vi.advanceTimersByTimeAsync(500);
    m.socket().eventos.alAbrir();
    m.llega({ t: "hola", rol: "anfitrion" });
    m.llega({ t: "listos" });
    await flush();
    expect(conexion.rol).toBe("anfitrion");
    expect(m.directas).toHaveLength(2);
    m.abrir();
    expect(estados.at(-1)).toBe("directa");
  });

  it("el invitado que vuelve a entrar sigue de invitado y espera la oferta nueva", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "invitado");
    m.llega({ t: "listos" });
    m.llega({ t: "senal", intento: "x1", sdp: { type: "offer", sdp: "v=0" } });
    await flush();
    m.abrir();
    m.directa().op.alCaer("prueba");
    m.socket().eventos.alCerrar(1006);
    await vi.advanceTimersByTimeAsync(500);
    m.socket().eventos.alAbrir();
    m.llega({ t: "hola", rol: "invitado" });
    m.llega({ t: "listos" });
    await flush();
    expect(conexion.rol).toBe("invitado");
    expect(m.directas).toHaveLength(1); // no ofrece: espera
    m.llega({ t: "senal", intento: "x2", sdp: { type: "offer", sdp: "v=0" } });
    await flush();
    expect(m.directa().op.rol).toBe("invitado");
    m.abrir();
    expect(conexion.estado).toBe("directa");
  });

  it("si al volver la sala le diera otro rol, la página sigue con el suyo", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "invitado");
    m.llega({ t: "listos" });
    m.socket().eventos.alCerrar(1006);
    await vi.advanceTimersByTimeAsync(500);
    m.socket().eventos.alAbrir();
    m.llega({ t: "hola", rol: "anfitrion" });
    m.llega({ t: "listos" });
    await flush();
    expect(conexion.rol).toBe("invitado");
    expect(m.directas).toHaveLength(0); // un invitado no ofrece
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/sigue de invitado/));
  });

  it("si la sala la reemplaza (entraste desde otro lado) se cierra y no reconecta", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "anfitrion");
    m.socket().eventos.alCerrar(CODIGO_REEMPLAZADA);
    expect(conexion.estado).toBe("cerrada");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(m.sockets).toHaveLength(1);
  });

  it("se rinde después de muchas reconexiones fallidas", async () => {
    const m = mundo();
    const { conexion } = await entrar(m, "anfitrion");
    for (let i = 0; i < 20 && conexion.estado !== "cerrada"; i++) {
      m.socket().eventos.alCerrar(1006);
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(conexion.estado).toBe("cerrada");
    expect(m.sockets.length).toBeLessThan(12);
  });

  it("si la sala no deja entrar, `conectar` falla", async () => {
    const m = mundo();
    const promesa = conectar({ urlSala: "https://sala.prueba/sala/x", pase: "vencido" }, m.deps);
    m.socket().eventos.alCerrar(1006);
    await expect(promesa).rejects.toThrow(/no dejó entrar/);
  });

  it("`cerrar` lo suelta todo y no reconecta", async () => {
    const m = mundo();
    const { conexion, estados } = await entrar(m, "anfitrion");
    m.llega({ t: "listos" });
    await flush();
    m.abrir();
    conexion.cerrar();
    expect(estados.at(-1)).toBe("cerrada");
    expect(m.directa().cerrada).toBe(true);
    expect(m.socket().cerrado).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(m.sockets).toHaveLength(1);
  });
});
