import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { salaDePareja, verificarPase } from "../workers/sala/src/pase";
import { api } from "./_generated/api";
import schema from "./schema";
import { modulos } from "./test.setup";

const SECRETO = "secreto-de-prueba";

beforeEach(() => {
  process.env.SALA_SECRETO = SECRETO;
});
afterEach(() => {
  delete process.env.SALA_SECRETO;
});

async function parejaDeAnaYBeto() {
  const t = convexTest(schema, modulos);
  const ana = t.withIdentity({ subject: "ana", issuer: "prueba" });
  const beto = t.withIdentity({ subject: "beto", issuer: "prueba" });
  const carla = t.withIdentity({ subject: "carla", issuer: "prueba" });
  const anaId = await ana.mutation(api.usuarios.guardarme, { nombre: "Ana" });
  await beto.mutation(api.usuarios.guardarme, { nombre: "Beto" });
  await carla.mutation(api.usuarios.guardarme, { nombre: "Carla" });
  const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
  const pareja = await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo });
  return { ana, beto, carla, anaId, parejaId: pareja._id };
}

describe("pase para la sala", () => {
  it("los de la pareja reciben un pase que la sala acepta", async () => {
    const { ana, anaId, parejaId } = await parejaDeAnaYBeto();
    const { pase, sala, vence } = await ana.mutation(api.salas.pedirPase, { parejaId });
    expect(sala).toBe(salaDePareja(parejaId));
    expect(vence - Date.now()).toBeGreaterThan(60_000);
    expect(vence - Date.now()).toBeLessThanOrEqual(2 * 60_000);
    expect(await verificarPase(pase, SECRETO)).toEqual({ ok: true, pase: { sala, usuario: anaId, vence } });
  });

  it("alguien de afuera no recibe pase", async () => {
    const { carla, parejaId } = await parejaDeAnaYBeto();
    await expect(carla.mutation(api.salas.pedirPase, { parejaId })).rejects.toThrow(/no es tuya/);
  });

  it("sin SALA_SECRETO lo dice claro", async () => {
    const { beto, parejaId } = await parejaDeAnaYBeto();
    delete process.env.SALA_SECRETO;
    await expect(beto.mutation(api.salas.pedirPase, { parejaId })).rejects.toThrow(/SALA_SECRETO/);
  });
});
