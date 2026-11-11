// La voz con una conexión y un WebRTC de mentira: apagada al empezar, solo con conexión directa y el micrófono
// se suelta al apagar o al caer al repetidor. Que el audio llegue de verdad lo prueba `pnpm prueba:red` en Chromium.
import { describe, expect, it, vi } from "vitest";
import type { EstadoRed, Via } from "./conexion";
import type { Datos } from "./marco";
import { type ConexionVoz, crearVoz } from "./voz";

function conexionFalsa(inicial: EstadoRed) {
  const datos = new Set<(d: Datos, via: Via) => void>();
  const estados = new Set<(e: EstadoRed) => void>();
  const enviados: string[] = [];
  let estado = inicial;
  const conexion: ConexionVoz & { cambiar(e: EstadoRed): void; enviados: string[] } = {
    rol: "anfitrion",
    get estado() {
      return estado;
    },
    enviados,
    enviar(d) {
      if (typeof d === "string") enviados.push(d);
    },
    alRecibir(o) {
      datos.add(o);
      return () => datos.delete(o);
    },
    alCambiarEstado(o) {
      estados.add(o);
      return () => estados.delete(o);
    },
    servidoresIce: async () => [],
    cambiar(e) {
      estado = e;
      for (const o of estados) o(e);
    },
  };
  return conexion;
}

function microfonoFalso() {
  const pista = { kind: "audio", stop: vi.fn() };
  const flujo = { getTracks: () => [pista], getAudioTracks: () => [pista] } as unknown as MediaStream;
  return { pista, flujo };
}

function webrtcFalso() {
  const cerradas = vi.fn();
  const pistas: unknown[] = [];
  const crear = () =>
    ({
      addTrack: (pista: unknown) => {
        pistas.push(pista);
        return { replaceTrack: async (p: unknown) => void pistas.push(p) };
      },
      close: cerradas,
      signalingState: "stable",
    }) as unknown as RTCPeerConnection;
  return { crear, cerradas, pistas };
}

describe("voz", () => {
  it("empieza apagada y prende el micrófono solo cuando se pide", async () => {
    const conexion = conexionFalsa("directa");
    const { pista, flujo } = microfonoFalso();
    const pedirMicrofono = vi.fn(async () => flujo);
    const rtc = webrtcFalso();
    const voz = crearVoz(conexion, { pedirMicrofono, crearConexion: rtc.crear, reproducir: () => {} });
    expect(voz.estado).toBe("apagada");
    expect(pedirMicrofono).not.toHaveBeenCalled();
    await voz.prender();
    expect(voz.estado).toBe("encendida");
    expect(rtc.pistas).toEqual([pista]);
    voz.apagar();
    expect(voz.estado).toBe("apagada");
    expect(pista.stop).toHaveBeenCalled();
  });

  it("por el repetidor no hay voz: ni pide el micrófono", async () => {
    const conexion = conexionFalsa("repetidor");
    const pedirMicrofono = vi.fn(async () => microfonoFalso().flujo);
    const voz = crearVoz(conexion, { pedirMicrofono, crearConexion: webrtcFalso().crear, reproducir: () => {} });
    expect(voz.estado).toBe("no_disponible");
    await voz.prender();
    expect(voz.estado).toBe("no_disponible");
    expect(pedirMicrofono).not.toHaveBeenCalled();
  });

  it("si lo directo se cae a media charla, corta la voz y suelta el micrófono; al volver queda apagada", async () => {
    const conexion = conexionFalsa("directa");
    const { pista, flujo } = microfonoFalso();
    const rtc = webrtcFalso();
    const voz = crearVoz(conexion, {
      pedirMicrofono: async () => flujo,
      crearConexion: rtc.crear,
      reproducir: () => {},
    });
    await voz.prender();
    conexion.cambiar("repetidor");
    expect(voz.estado).toBe("no_disponible");
    expect(pista.stop).toHaveBeenCalled();
    expect(rtc.cerradas).toHaveBeenCalled();
    conexion.cambiar("directa");
    expect(voz.estado).toBe("apagada");
  });

  it("sin permiso del micrófono lo dice", async () => {
    const voz = crearVoz(conexionFalsa("directa"), {
      pedirMicrofono: async () => {
        throw new Error("NotAllowedError");
      },
      crearConexion: webrtcFalso().crear,
      reproducir: () => {},
    });
    await voz.prender();
    expect(voz.estado).toBe("sin_permiso");
  });

  it("si se apaga mientras se pedía el permiso, el micrófono se suelta enseguida", async () => {
    const { pista, flujo } = microfonoFalso();
    let dar: (f: MediaStream) => void = () => {};
    const voz = crearVoz(conexionFalsa("directa"), {
      pedirMicrofono: () => new Promise((r) => (dar = r)),
      crearConexion: webrtcFalso().crear,
      reproducir: () => {},
    });
    const prendiendo = voz.prender();
    voz.apagar();
    dar(flujo);
    await prendiendo;
    expect(voz.estado).toBe("apagada");
    expect(pista.stop).toHaveBeenCalled();
  });
});
