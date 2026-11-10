// Ayudas compartidas por las funciones que necesitan saber quién llama y armar parejas.
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Mi usuario de Tuerce, o null si no hay sesión o todavía no me guardé (`guardarme`). */
export async function yoSiHay(ctx: QueryCtx): Promise<Doc<"usuarios"> | null> {
  const identidad = await ctx.auth.getUserIdentity();
  if (!identidad) return null;
  return await ctx.db
    .query("usuarios")
    .withIndex("por_token", (q) => q.eq("tokenIdentifier", identidad.tokenIdentifier))
    .unique();
}

/** Mi usuario de Tuerce. Falla con un mensaje claro si no hay sesión o si todavía no me guardé. */
export async function yoObligatorio(ctx: QueryCtx): Promise<Doc<"usuarios">> {
  if (!(await ctx.auth.getUserIdentity())) throw new ConvexError("Hay que entrar primero");
  const yo = await yoSiHay(ctx);
  if (!yo) throw new ConvexError("Tu usuario todavía no está guardado; volvé a entrar");
  return yo;
}

/** Los dos ids en el orden que pide el esquema: a < b, así una pareja tiene un solo documento. */
export function ordenar(x: Id<"usuarios">, y: Id<"usuarios">): { a: Id<"usuarios">; b: Id<"usuarios"> } {
  return x < y ? { a: x, b: y } : { a: y, b: x };
}

/** Busca la pareja de esos dos usuarios o la crea. En los dos casos la marca como vista ahora. */
export async function juntar(ctx: MutationCtx, x: Id<"usuarios">, y: Id<"usuarios">): Promise<Doc<"parejas">> {
  if (x === y) throw new ConvexError("No podés hacer pareja con vos mismo");
  const { a, b } = ordenar(x, y);
  const ahora = Date.now();
  const existente = await ctx.db
    .query("parejas")
    .withIndex("por_a", (q) => q.eq("a", a).eq("b", b))
    .unique();
  if (existente) {
    await ctx.db.patch(existente._id, { ultimaVez: ahora });
    return { ...existente, ultimaVez: ahora };
  }
  const nueva = await ctx.db.get(await ctx.db.insert("parejas", { a, b, ultimaVez: ahora }));
  if (!nueva) throw new Error("La pareja recién creada no aparece");
  return nueva;
}

/** El nombre que se muestra de un usuario. */
export async function nombreDe(ctx: QueryCtx, id: Id<"usuarios">): Promise<string> {
  return (await ctx.db.get(id))?.nombre ?? "Alguien";
}
