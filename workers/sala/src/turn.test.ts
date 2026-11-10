import { describe, expect, it, vi } from "vitest";
import { DURACION_TURN_S, leerServidoresIce, STUN_PUBLICO, servidoresIce } from "./turn";

const LLAVES = { TURN_KEY_ID: "llave-123", TURN_KEY_API_TOKEN: "token-abc" };

// Lo que contesta Cloudflare Realtime TURN a generate-ice-servers.
const CLOUDFLARE = {
  iceServers: [
    { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
    {
      urls: [
        "turn:turn.cloudflare.com:3478?transport=udp",
        "turn:turn.cloudflare.com:53?transport=udp",
        "turns:turn.cloudflare.com:443?transport=tcp",
      ],
      username: "usuario-temporal",
      credential: "clave-temporal",
    },
  ],
};

describe("servidores ICE", () => {
  it("sin llaves da el STUN público y lo dice, sin llamar a Cloudflare", async () => {
    const pedir = vi.fn<typeof fetch>();
    const respuesta = await servidoresIce({}, pedir);
    expect(respuesta).toEqual({ iceServers: [{ urls: [STUN_PUBLICO] }], respaldo: true, aviso: expect.any(String) });
    expect(respuesta.aviso).toMatch(/TURN_KEY_ID/);
    expect(pedir).not.toHaveBeenCalled();
  });

  it("con llaves le pide a Cloudflare credenciales de un día y saca el puerto 53", async () => {
    const pedir = vi.fn<typeof fetch>(async () => Response.json(CLOUDFLARE));
    const respuesta = await servidoresIce(LLAVES, pedir);
    expect(pedir).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/llave-123/credentials/generate-ice-servers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        body: JSON.stringify({ ttl: DURACION_TURN_S }),
      }),
    );
    expect(respuesta).toEqual({
      respaldo: false,
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478"] },
        {
          urls: ["turn:turn.cloudflare.com:3478?transport=udp", "turns:turn.cloudflare.com:443?transport=tcp"],
          username: "usuario-temporal",
          credential: "clave-temporal",
        },
      ],
    });
  });

  it("si Cloudflare falla o contesta algo raro, vuelve al STUN público", async () => {
    const malas = [
      vi.fn<typeof fetch>(async () => new Response("no", { status: 401 })),
      vi.fn<typeof fetch>(async () => Response.json({ algo: "raro" })),
      vi.fn<typeof fetch>(async () => {
        throw new Error("sin red");
      }),
    ];
    for (const pedir of malas) {
      const respuesta = await servidoresIce(LLAVES, pedir);
      expect(respuesta.respaldo).toBe(true);
      expect(respuesta.iceServers).toEqual([{ urls: [STUN_PUBLICO] }]);
      expect(respuesta.aviso).toBeTruthy();
    }
  });

  it("acepta un solo objeto y urls como texto, y salta lo que no sirve", () => {
    expect(leerServidoresIce({ iceServers: { urls: "turn:x:3478", username: "u", credential: "c", otra: 1 } })).toEqual(
      [{ urls: ["turn:x:3478"], username: "u", credential: "c" }],
    );
    expect(leerServidoresIce({ iceServers: [null, { urls: 5 }, { urls: ["stun:x:53"] }] })).toEqual([]);
    expect(leerServidoresIce("nada")).toEqual([]);
  });
});
