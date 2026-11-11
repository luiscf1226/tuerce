// El ropero de cada jugador, los secretos y los logros (TU-29). La tabla de qué da cada nivel está en premios.ts.
//
// El avance es de la PAREJA, pero lo ganado es de cada uno: cuando la pareja encuentra el secreto de un nivel, los
// dos ganan su prenda (y `avance.secreto` queda marcado para la pareja); cuando ganan el logro, queda en la lista de
// los dos. Así cada uno conserva lo suyo para jugar con otra persona. Lo que se elige para ponerse va en `perfiles`.
//
// Quien llama tiene que ser de la pareja. La prenda no la elige el juego: sale de la tabla, así nadie se desbloquea
// algo que no existe o que no da ese nivel.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { parejaMia } from "./avance";
import { yoObligatorio, yoSiHay } from "./cuenta";
import { CATEGORIAS, type Cosa, esInicial, esPrenda, PREMIOS, type PremiosDeNivel, type Vestuario } from "./premios";

function premiosDe(nivel: number): PremiosDeNivel {
  const premios = Number.isInteger(nivel) ? PREMIOS[nivel] : undefined;
  if (!premios) throw new ConvexError("Ese nivel no tiene secreto ni logro");
  return premios;
}

async function parejaObligatoria(ctx: QueryCtx, yo: Doc<"usuarios">, parejaId: Id<"parejas">) {
  const pareja = await parejaMia(ctx, yo, parejaId);
  if (!pareja) throw new ConvexError("Esa pareja no es tuya");
  return pareja;
}

function perfilDe(ctx: QueryCtx, usuarioId: Id<"usuarios">) {
  return ctx.db
    .query("perfiles")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
    .unique();
}

async function desbloqueosDe(ctx: QueryCtx, usuarioId: Id<"usuarios">) {
  return await ctx.db
    .query("desbloqueos")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
    .collect();
}

/** El vestuario guardado, solo con lo que todavía es válido (si una prenda dejó de existir, no se devuelve). */
function vestuarioDe(perfil: Doc<"perfiles"> | null): Partial<Vestuario> | null {
  if (!perfil) return null;
  const v: Partial<Record<keyof Vestuario, string>> = {};
  for (const c of CATEGORIAS) if (esPrenda(c, perfil[c])) v[c] = perfil[c];
  return v as Partial<Vestuario>;
}

async function ganar(ctx: MutationCtx, usuarioId: Id<"usuarios">, que: Cosa, nivel: number): Promise<boolean> {
  const ya = await ctx.db
    .query("desbloqueos")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId).eq("cosa", que))
    .first();
  if (ya) return false;
  await ctx.db.insert("desbloqueos", { usuarioId, cosa: que, nivel });
  return true;
}

async function anotarLogro(ctx: MutationCtx, usuarioId: Id<"usuarios">, logroId: string): Promise<boolean> {
  const ya = await ctx.db
    .query("logros")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId).eq("logroId", logroId))
    .first();
  if (ya) return false;
  await ctx.db.insert("logros", { usuarioId, logroId });
  return true;
}

/** Mi ropero: lo que me puse (null si nunca elegí), las prendas que gané (con el nivel) y mis logros. */
export const miRopero = query({
  args: {},
  handler: async (ctx) => {
    const yo = await yoSiHay(ctx);
    if (!yo) return null;
    const desbloqueos = await desbloqueosDe(ctx, yo._id);
    const logros = await ctx.db
      .query("logros")
      .withIndex("por_usuario", (q) => q.eq("usuarioId", yo._id))
      .collect();
    return {
      vestuario: vestuarioDe(await perfilDe(ctx, yo._id)),
      ganadas: desbloqueos.map((d) => ({ cosa: d.cosa, nivel: d.nivel })),
      logros: logros.map((l) => l.logroId),
    };
  },
});

/** Me pongo estas prendas. Solo valen las que existen y que tengo (las del principio o las que gané). */
export const elegir = mutation({
  args: { panuelo: v.string(), sombrero: v.string(), peinado: v.string(), mascara: v.string() },
  handler: async (ctx, elegido): Promise<Vestuario> => {
    const yo = await yoObligatorio(ctx);
    const ganadas = new Set((await desbloqueosDe(ctx, yo._id)).map((d) => d.cosa));
    for (const c of CATEGORIAS) {
      const prenda = elegido[c];
      if (!esPrenda(c, prenda)) throw new ConvexError(`No existe esa prenda: ${c} «${prenda}»`);
      if (!esInicial(c, prenda) && !ganadas.has(`${c}:${prenda}`))
        throw new ConvexError(`Todavía no ganaste esa prenda: ${c} «${prenda}»`);
    }
    const vestuario = elegido as Vestuario;
    const perfil = await perfilDe(ctx, yo._id);
    if (perfil) await ctx.db.patch(perfil._id, vestuario);
    else await ctx.db.insert("perfiles", { usuarioId: yo._id, ...vestuario });
    return vestuario;
  },
});

/** Lo que tienen puesto los dos de la pareja, para vestir a cada muñeco en línea (null el que nunca eligió). */
export const vestuariosDePareja = query({
  args: { parejaId: v.id("parejas") },
  handler: async (ctx, { parejaId }) => {
    const yo = await yoSiHay(ctx);
    const pareja = yo && (await parejaMia(ctx, yo, parejaId));
    if (!yo || !pareja) return null;
    const otro = pareja.a === yo._id ? pareja.b : pareja.a;
    return {
      mio: vestuarioDe(await perfilDe(ctx, yo._id)),
      companero: vestuarioDe(await perfilDe(ctx, otro)),
    };
  },
});

/**
 * La pareja encontró el secreto de `nivel`: queda marcado en su avance y los dos ganan la prenda del nivel.
 * Devuelve la prenda y si era nueva para quien llama.
 */
export const encontrarSecreto = mutation({
  args: { parejaId: v.id("parejas"), nivel: v.number() },
  handler: async (ctx, { parejaId, nivel }): Promise<{ prenda: Cosa; nueva: boolean }> => {
    const premios = premiosDe(nivel);
    const yo = await yoObligatorio(ctx);
    const pareja = await parejaObligatoria(ctx, yo, parejaId);
    const avance = await ctx.db
      .query("avance")
      .withIndex("por_pareja_nivel", (q) => q.eq("parejaId", parejaId).eq("nivel", nivel))
      .unique();
    if (!avance) await ctx.db.insert("avance", { parejaId, nivel, puntoDeControl: 0, misiones: [], secreto: true });
    else if (!avance.secreto) await ctx.db.patch(avance._id, { secreto: true });
    const otro = pareja.a === yo._id ? pareja.b : pareja.a;
    const nueva = await ganar(ctx, yo._id, premios.prenda, nivel);
    await ganar(ctx, otro, premios.prenda, nivel);
    return { prenda: premios.prenda, nueva };
  },
});

/** La pareja ganó el logro de `nivel` (lo decide el guion del nivel): queda en la lista de los dos. */
export const lograr = mutation({
  args: { parejaId: v.id("parejas"), nivel: v.number() },
  handler: async (ctx, { parejaId, nivel }): Promise<{ logro: string; nuevo: boolean }> => {
    const { logro } = premiosDe(nivel);
    const yo = await yoObligatorio(ctx);
    const pareja = await parejaObligatoria(ctx, yo, parejaId);
    const otro = pareja.a === yo._id ? pareja.b : pareja.a;
    const nuevo = await anotarLogro(ctx, yo._id, logro.id);
    await anotarLogro(ctx, otro, logro.id);
    return { logro: logro.id, nuevo };
  },
});

/**
 * Si la pareja ya encontró el secreto de `nivel` y si los dos ya tienen su logro. Para avisar en línea al que no simula.
 * El logro cuenta solo si lo tienen los dos: si uno lo ganó con otra pareja, el guion tiene que poder darlo de nuevo.
 */
export const premiosDeNivel = query({
  args: { parejaId: v.id("parejas"), nivel: v.number() },
  handler: async (ctx, { parejaId, nivel }) => {
    const premios = Number.isInteger(nivel) ? PREMIOS[nivel] : undefined;
    const yo = await yoSiHay(ctx);
    const pareja = yo && premios ? await parejaMia(ctx, yo, parejaId) : null;
    if (!premios || !pareja) return { secreto: false, logro: false };
    const avance = await ctx.db
      .query("avance")
      .withIndex("por_pareja_nivel", (q) => q.eq("parejaId", parejaId).eq("nivel", nivel))
      .unique();
    const tiene = async (usuarioId: Id<"usuarios">) =>
      (await ctx.db
        .query("logros")
        .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId).eq("logroId", premios.logro.id))
        .first()) !== null;
    return { secreto: avance?.secreto ?? false, logro: (await tiene(pareja.a)) && (await tiene(pareja.b)) };
  },
});
