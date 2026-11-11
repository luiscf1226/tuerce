// Lo directo sin WebRTC (el webview de escritorio en Linux): se cae enseguida, para pasar a la sala sin esperar.
import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirDirectaWebRTC } from "./directa";

describe("directa sin WebRTC", () => {
  afterEach(() => vi.unstubAllGlobals());

  const opciones = (alCaer: (motivo: string) => void) => ({
    rol: "anfitrion" as const,
    intento: "x",
    iceServers: [],
    enviarSenal: () => {},
    alAbrir: () => {},
    alCaer,
    alRecibir: () => {},
  });

  it("avisa que se cayó apenas empieza (después de devolverse) y no manda nada", async () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    const alCaer = vi.fn();
    const directa = abrirDirectaWebRTC(opciones(alCaer));
    expect(alCaer).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(alCaer).toHaveBeenCalledOnce();
    expect(directa.enviar("hola", true)).toBe(false);
  });

  it("si ya la cerraron, no avisa", async () => {
    vi.stubGlobal("RTCPeerConnection", undefined);
    const alCaer = vi.fn();
    abrirDirectaWebRTC(opciones(alCaer)).cerrar();
    await Promise.resolve();
    expect(alCaer).not.toHaveBeenCalled();
  });
});
