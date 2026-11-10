// Invitación con código: uno crea un código de 5 letras (o un enlace con él), el otro lo acepta y quedan como pareja.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { juntar, nombreDe, yoObligatorio, yoSiHay } from "./cuenta";

/** Sin I, O, 0 ni 1: se confunden al dictarlos o al leerlos en una pantalla chica. */
export const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const LARGO = 5;
export const DURACION_MS = 15 * 60 * 1000;
/** Códigos equivocados que se aceptan por usuario en VENTANA_MS: con 32^5 códigos posibles, adivinar uno vivo
 * a este ritmo lleva años. */
export const MAX_FALLIDOS = 10;
export const VENTANA_MS = 10 * 60 * 1000;

/** Lo que la persona escribió, en mayúsculas y sin espacios ni guiones. */
export function normalizarCodigo(texto: string): string {
  return texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Con azar criptográfico: 32 letras dividen justo a 256, así que ninguna sale más que otra. */
function codigoAlAzar(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(LARGO));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/** Cuántos códigos equivocados lleva el usuario en la ventana actual (y el documento, si existe). */
async function fallidosDe(ctx: MutationCtx, usuarioId: Id<"usuarios">) {
  const doc = await ctx.db
    .query("intentosCodigo")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
    .unique();
  const vigente = doc !== null && Date.now() - doc.desde < VENTANA_MS;
  return { doc, fallidos: vigente ? doc.fallidos : 0, vigente };
}

/** La invitación más reciente con ese código. Los códigos no se repiten entre invitaciones vivas. */
async function porCodigo(ctx: QueryCtx, codigo: string): Promise<Doc<"invitaciones"> | null> {
  return await ctx.db
    .query("invitaciones")
    .withIndex("por_codigo", (q) => q.eq("codigo", codigo))
    .order("desc")
    .first();
}

/** Los nombres para «Ya son pareja: A y B»: primero quien invitó, después quien aceptó. */
async function nombresDePareja(ctx: QueryCtx, de: Id<"usuarios">, pareja: Doc<"parejas">): Promise<[string, string]> {
  const otro = pareja.a === de ? pareja.b : pareja.a;
  return [await nombreDe(ctx, de), await nombreDe(ctx, otro)];
}

/** Crea mi invitación, o devuelve la que ya tengo viva y sin usar. Vence en unos 15 minutos. */
export const crearInvitacion = mutation({
  args: {},
  handler: async (ctx): Promise<{ codigo: string; vence: number }> => {
    const yo = await yoObligatorio(ctx);
    const ahora = Date.now();
    const vivas = await ctx.db
      .query("invitaciones")
      .withIndex("por_de", (q) => q.eq("de", yo._id).gt("vence", ahora))
      .collect();
    const mia = vivas.find((inv) => !inv.parejaId);
    if (mia) return { codigo: mia.codigo, vence: mia.vence };

    for (let intento = 0; intento < 20; intento++) {
      const codigo = codigoAlAzar();
      const choca = await porCodigo(ctx, codigo);
      if (choca && choca.vence > ahora) continue;
      const vence = ahora + DURACION_MS;
      await ctx.db.insert("invitaciones", { codigo, de: yo._id, vence });
      return { codigo, vence };
    }
    throw new ConvexError("No se pudo crear un código libre; probá de nuevo");
  },
});

/**
 * Acepto el código de otra persona y quedamos como pareja. Aceptar dos veces el mismo código da la misma pareja.
 * Un código equivocado (que no existe, venció o ya lo usó otra persona) no lanza error: devuelve `{ ok: false }`
 * y queda anotado, porque un error desharía la anotación. Pasado MAX_FALLIDOS en la ventana, ya no se prueba más.
 */
export const aceptarInvitacion = mutation({
  args: { codigo: v.string() },
  handler: async (ctx, args) => {
    const yo = await yoObligatorio(ctx);
    const codigo = normalizarCodigo(args.codigo);
    if (codigo.length !== LARGO) throw new ConvexError(`El código tiene ${LARGO} letras`);
    const intentos = await fallidosDe(ctx, yo._id);
    if (intentos.fallidos >= MAX_FALLIDOS)
      throw new ConvexError("Probaste demasiados códigos equivocados: esperá unos minutos y pedí el enlace");

    const fallar = async (motivo: string) => {
      if (intentos.doc && intentos.vigente) await ctx.db.patch(intentos.doc._id, { fallidos: intentos.fallidos + 1 });
      else if (intentos.doc) await ctx.db.patch(intentos.doc._id, { desde: Date.now(), fallidos: 1 });
      else await ctx.db.insert("intentosCodigo", { usuarioId: yo._id, desde: Date.now(), fallidos: 1 });
      return { ok: false as const, motivo };
    };

    const invitacion = await porCodigo(ctx, codigo);
    if (!invitacion) return await fallar(`No hay ninguna invitación con el código ${codigo}`);
    if (invitacion.de === yo._id) throw new ConvexError("Ese es tu propio código: pasáselo a la otra persona");

    if (invitacion.parejaId) {
      const pareja = await ctx.db.get(invitacion.parejaId);
      if (pareja && (pareja.a === yo._id || pareja.b === yo._id)) {
        return { ok: true as const, ...pareja, nombres: await nombresDePareja(ctx, invitacion.de, pareja) };
      }
      return await fallar("Esa invitación ya la usó otra persona: pedí un código nuevo");
    }
    if (invitacion.vence <= Date.now()) return await fallar("Esa invitación venció: pedí un código nuevo");

    const pareja = await juntar(ctx, invitacion.de, yo._id);
    await ctx.db.patch(invitacion._id, { parejaId: pareja._id });
    return { ok: true as const, ...pareja, nombres: await nombresDePareja(ctx, invitacion.de, pareja) };
  },
});

/**
 * Cómo va una invitación, para que la pantalla de quien la creó cambie sola cuando la otra persona entra.
 * Solo la ven quien la creó y quien la aceptó; para los demás (o si no existe) es null.
 */
export const estadoInvitacion = query({
  args: { codigo: v.string() },
  handler: async (ctx, args) => {
    const yo = await yoSiHay(ctx);
    if (!yo) return null;
    const invitacion = await porCodigo(ctx, normalizarCodigo(args.codigo));
    if (!invitacion) return null;
    const pareja = invitacion.parejaId ? await ctx.db.get(invitacion.parejaId) : null;
    const esMia = invitacion.de === yo._id;
    const laAcepte = pareja !== null && (pareja.a === yo._id || pareja.b === yo._id);
    if (!esMia && !laAcepte) return null;
    return {
      codigo: invitacion.codigo,
      vence: invitacion.vence,
      pareja: pareja ? { parejaId: pareja._id, nombres: await nombresDePareja(ctx, invitacion.de, pareja) } : null,
    };
  },
});
