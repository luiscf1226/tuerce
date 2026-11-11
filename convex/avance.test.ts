import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modulos } from "./test.setup";

/** Ana y Beto son pareja; Carla no está en ella. */
async function parejaDeAnaYBeto() {
  const t = convexTest(schema, modulos);
  const ana = t.withIdentity({ subject: "ana", issuer: "prueba" });
  const beto = t.withIdentity({ subject: "beto", issuer: "prueba" });
  const carla = t.withIdentity({ subject: "carla", issuer: "prueba" });
  await ana.mutation(api.usuarios.guardarme, { nombre: "Ana" });
  await beto.mutation(api.usuarios.guardarme, { nombre: "Beto" });
  await carla.mutation(api.usuarios.guardarme, { nombre: "Carla" });
  const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
  const pareja = await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo });
  if (!pareja.ok) throw new Error(pareja.motivo);
  return { t, ana, beto, carla, parejaId: pareja._id };
}

describe("avance de la pareja", () => {
  it("sin nada guardado, la pareja está en la salida", async () => {
    const { ana, parejaId } = await parejaDeAnaYBeto();
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(0);
  });

  it("lo que guarda uno lo lee el otro, y cada nivel va aparte", async () => {
    const { t, ana, beto, parejaId } = await parejaDeAnaYBeto();
    expect(await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 1, puntoDeControl: 2 })).toBe(2);
    expect(await beto.query(api.avance.puntoDeControl, { parejaId, nivel: 1 })).toBe(2);
    expect(await beto.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(0);
    expect(await beto.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 1, puntoDeControl: 3 })).toBe(3);
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 1 })).toBe(3);
    // Un solo documento por pareja y nivel
    const filas = await t.run((ctx) => ctx.db.query("avance").collect());
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ parejaId, nivel: 1, puntoDeControl: 3, misiones: [], secreto: false });
  });

  it("solo avanza: un punto de control más chico no pisa el guardado", async () => {
    const { ana, beto, parejaId } = await parejaDeAnaYBeto();
    await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 99, puntoDeControl: 4 });
    expect(await beto.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 99, puntoDeControl: 1 })).toBe(4);
    expect(await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 99, puntoDeControl: 4 })).toBe(4);
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 99 })).toBe(4);
  });

  it("alguien de afuera no escribe ni lee el avance", async () => {
    const { ana, carla, parejaId } = await parejaDeAnaYBeto();
    await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 0, puntoDeControl: 2 });
    await expect(
      carla.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 0, puntoDeControl: 5 }),
    ).rejects.toThrow(/no es tuya/);
    expect(await carla.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(0);
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(2);
  });

  it("sin sesión no se escribe", async () => {
    const { t, parejaId } = await parejaDeAnaYBeto();
    await expect(
      t.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 0, puntoDeControl: 1 }),
    ).rejects.toThrow(/entrar/);
    expect(await t.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(0);
  });

  it("rechaza números que no son niveles ni puntos de control", async () => {
    const { ana, parejaId } = await parejaDeAnaYBeto();
    for (const nivel of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 1000]) {
      await expect(
        ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel, puntoDeControl: 1 }),
      ).rejects.toThrow(/nivel/);
    }
    for (const puntoDeControl of [-1, 0.5, Number.NaN, 1e9]) {
      await expect(
        ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 0, puntoDeControl }),
      ).rejects.toThrow(/punto de control/);
    }
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 0 })).toBe(0);
  });
});
