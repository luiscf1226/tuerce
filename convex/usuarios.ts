// El usuario de Tuerce nace la primera vez que llega un token de Clerk.
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Quién soy según Convex, o null si no hay sesión o todavía no me he guardado. */
export const yo = query({
  args: {},
  handler: async (ctx) => {
    const identidad = await ctx.auth.getUserIdentity();
    if (!identidad) return null;
    return await ctx.db
      .query("usuarios")
      .withIndex("por_token", (q) => q.eq("tokenIdentifier", identidad.tokenIdentifier))
      .unique();
  },
});

/**
 * Crea mi usuario si no existe y actualiza mi nombre si cambió. Devuelve mi id.
 * El token de Clerk para Convex no trae el nombre, así que el juego lo manda desde el perfil de Clerk;
 * es solo el nombre que se muestra, la identidad sale del token.
 */
export const guardarme = mutation({
  args: { nombre: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identidad = await ctx.auth.getUserIdentity();
    if (!identidad) throw new ConvexError("Hay que entrar primero");
    const nombre = (args.nombre?.trim().slice(0, 40) || identidad.name) ?? identidad.nickname ?? "Sin nombre";
    const existente = await ctx.db
      .query("usuarios")
      .withIndex("por_token", (q) => q.eq("tokenIdentifier", identidad.tokenIdentifier))
      .unique();
    if (existente) {
      if (existente.nombre !== nombre) await ctx.db.patch(existente._id, { nombre });
      return existente._id;
    }
    return await ctx.db.insert("usuarios", { nombre, esInvitado: false, tokenIdentifier: identidad.tokenIdentifier });
  },
});
