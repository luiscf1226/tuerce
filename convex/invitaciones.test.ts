import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { ALFABETO, DURACION_MS } from "./invitaciones";
import schema from "./schema";
import { modulos } from "./test.setup";

/** Un Convex vacío con dos personas ya guardadas, como quedan después de pasar por `?escena=entrar`. */
async function preparar() {
  const t = convexTest(schema, modulos);
  const ana = t.withIdentity({ subject: "ana", issuer: "prueba" });
  const beto = t.withIdentity({ subject: "beto", issuer: "prueba" });
  const anaId = await ana.mutation(api.usuarios.guardarme, { nombre: "Ana" });
  const betoId = await beto.mutation(api.usuarios.guardarme, { nombre: "Beto" });
  return { t, ana, beto, anaId, betoId };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("invitaciones", () => {
  it("crear y aceptar junta a dos personas en una pareja con a < b", async () => {
    const { t, ana, beto, anaId, betoId } = await preparar();
    const { codigo, vence } = await ana.mutation(api.invitaciones.crearInvitacion, {});
    expect(codigo).toMatch(new RegExp(`^[${ALFABETO}]{5}$`));
    expect(vence).toBeGreaterThan(Date.now() + DURACION_MS - 60_000);

    expect((await ana.query(api.invitaciones.estadoInvitacion, { codigo }))?.pareja).toBeNull();
    const pareja = await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo: codigo.toLowerCase() });
    expect(pareja.nombres).toEqual(["Ana", "Beto"]);
    expect(pareja.a < pareja.b).toBe(true);
    expect([pareja.a, pareja.b].sort()).toEqual([anaId, betoId].sort());

    const guardadas = await t.run((ctx) => ctx.db.query("parejas").collect());
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0]?._id).toBe(pareja._id);

    const estado = await ana.query(api.invitaciones.estadoInvitacion, { codigo });
    expect(estado?.pareja).toEqual({ parejaId: pareja._id, nombres: ["Ana", "Beto"] });
    expect((await ana.query(api.parejas.misParejas, {})).map((p) => p.companero)).toEqual(["Beto"]);
    expect((await beto.query(api.parejas.misParejas, {})).map((p) => p.companero)).toEqual(["Ana"]);
  });

  it("reusa mi invitación viva en vez de crear otra", async () => {
    const { ana } = await preparar();
    const primera = await ana.mutation(api.invitaciones.crearInvitacion, {});
    const segunda = await ana.mutation(api.invitaciones.crearInvitacion, {});
    expect(segunda).toEqual(primera);
  });

  it("no deja aceptar mi propio código", async () => {
    const { ana } = await preparar();
    const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
    await expect(ana.mutation(api.invitaciones.aceptarInvitacion, { codigo })).rejects.toThrow(/propio código/);
  });

  it("rechaza un código vencido", async () => {
    vi.useFakeTimers();
    const { ana, beto } = await preparar();
    const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
    vi.advanceTimersByTime(DURACION_MS + 1000);
    await expect(beto.mutation(api.invitaciones.aceptarInvitacion, { codigo })).rejects.toThrow(/venció/);
    const nueva = await ana.mutation(api.invitaciones.crearInvitacion, {});
    expect(nueva.codigo).not.toBe(codigo);
  });

  it("rechaza un código que no existe", async () => {
    const { beto } = await preparar();
    await expect(beto.mutation(api.invitaciones.aceptarInvitacion, { codigo: "ZZZZZ" })).rejects.toThrow(
      /ninguna invitación/,
    );
  });

  it("aceptar dos veces da la misma pareja", async () => {
    const { t, ana, beto } = await preparar();
    const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
    const primera = await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo });
    const segunda = await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo });
    expect(segunda._id).toBe(primera._id);
    expect(await t.run((ctx) => ctx.db.query("parejas").collect())).toHaveLength(1);

    // Otra invitación entre los mismos dos tampoco duplica la pareja.
    const otra = await beto.mutation(api.invitaciones.crearInvitacion, {});
    const tercera = await ana.mutation(api.invitaciones.aceptarInvitacion, { codigo: otra.codigo });
    expect(tercera._id).toBe(primera._id);
    expect(tercera.nombres).toEqual(["Beto", "Ana"]);
    expect(await t.run((ctx) => ctx.db.query("parejas").collect())).toHaveLength(1);
  });

  it("una tercera persona no puede usar una invitación ya aceptada", async () => {
    const { t, ana, beto } = await preparar();
    const carla = t.withIdentity({ subject: "carla", issuer: "prueba" });
    await carla.mutation(api.usuarios.guardarme, { nombre: "Carla" });
    const { codigo } = await ana.mutation(api.invitaciones.crearInvitacion, {});
    await beto.mutation(api.invitaciones.aceptarInvitacion, { codigo });
    await expect(carla.mutation(api.invitaciones.aceptarInvitacion, { codigo })).rejects.toThrow(/otra persona/);
    expect(await carla.query(api.invitaciones.estadoInvitacion, { codigo })).toBeNull();
  });

  it("sin sesión no se puede crear", async () => {
    const t = convexTest(schema, modulos);
    await expect(t.mutation(api.invitaciones.crearInvitacion, {})).rejects.toThrow(/entrar primero/);
  });
});
