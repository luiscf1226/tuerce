// El avance de la PAREJA en cada nivel (TU-22): el último punto de control que alcanzaron juntos. Lo escribe el
// anfitrión cada vez que llegan a uno nuevo (ver apps/juego/src/escenas/en-linea.ts); al volver a jugar se lee y la
// pareja arranca ahí, salvo que sea la meta: un nivel ganado se vuelve a jugar desde la salida (apps/juego/src/red/
// avance.ts). Solo avanza: un punto de control más chico que el guardado no lo pisa (pasa si el anfitrión
// empezó de cero y vuelve a cruzar los primeros, o si llegan dos avisos desordenados).
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { yoObligatorio, yoSiHay } from "./cuenta";

/** Hasta qué número de nivel se acepta (hay unos pocos; el de prueba es el 99). */
export const MAX_NIVEL = 999;
/** Hasta qué punto de control se acepta en un nivel. */
export const MAX_PUNTO = 999;

export const esEnteroEntre = (n: number, max: number) => Number.isInteger(n) && n >= 0 && n <= max;

/** La pareja, si quien llama es uno de los dos. */
export async function parejaMia(
  ctx: QueryCtx,
  yo: Doc<"usuarios">,
  parejaId: Id<"parejas">,
): Promise<Doc<"parejas"> | null> {
  const pareja = await ctx.db.get(parejaId);
  return pareja && (pareja.a === yo._id || pareja.b === yo._id) ? pareja : null;
}

export function avanceDe(ctx: QueryCtx, parejaId: Id<"parejas">, nivel: number) {
  return ctx.db
    .query("avance")
    .withIndex("por_pareja_nivel", (q) => q.eq("parejaId", parejaId).eq("nivel", nivel))
    .unique();
}

/** Guarda que la pareja alcanzó `puntoDeControl` en `nivel`. Devuelve el punto de control que queda guardado. */
export const guardarPuntoDeControl = mutation({
  args: { parejaId: v.id("parejas"), nivel: v.number(), puntoDeControl: v.number() },
  handler: async (ctx, { parejaId, nivel, puntoDeControl }): Promise<number> => {
    if (!esEnteroEntre(nivel, MAX_NIVEL)) throw new ConvexError("Ese nivel no existe");
    if (!esEnteroEntre(puntoDeControl, MAX_PUNTO)) throw new ConvexError("Ese punto de control no existe");
    const yo = await yoObligatorio(ctx);
    if (!(await parejaMia(ctx, yo, parejaId))) throw new ConvexError("Esa pareja no es tuya");
    const guardado = await avanceDe(ctx, parejaId, nivel);
    if (!guardado) {
      await ctx.db.insert("avance", { parejaId, nivel, puntoDeControl, misiones: [], secreto: false });
      return puntoDeControl;
    }
    if (puntoDeControl <= guardado.puntoDeControl) return guardado.puntoDeControl;
    await ctx.db.patch(guardado._id, { puntoDeControl });
    return puntoDeControl;
  },
});

/** El último punto de control de la pareja en `nivel` (0 = la salida, si nunca llegaron a ninguno). Solo para los
 * dos de la pareja: a cualquier otro le da 0, sin decir si la pareja existe. */
export const puntoDeControl = query({
  args: { parejaId: v.id("parejas"), nivel: v.number() },
  handler: async (ctx, { parejaId, nivel }): Promise<number> => {
    if (!esEnteroEntre(nivel, MAX_NIVEL)) return 0;
    const yo = await yoSiHay(ctx);
    if (!yo || !(await parejaMia(ctx, yo, parejaId))) return 0;
    return (await avanceDe(ctx, parejaId, nivel))?.puntoDeControl ?? 0;
  },
});
