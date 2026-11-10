// Mis parejas: con quién ya jugué, la más reciente primero.
import { query } from "./_generated/server";
import { nombreDe, yoSiHay } from "./cuenta";

export const misParejas = query({
  args: {},
  handler: async (ctx) => {
    const yo = await yoSiHay(ctx);
    if (!yo) return [];
    const comoA = await ctx.db
      .query("parejas")
      .withIndex("por_a", (q) => q.eq("a", yo._id))
      .collect();
    const comoB = await ctx.db
      .query("parejas")
      .withIndex("por_b", (q) => q.eq("b", yo._id))
      .collect();
    const todas = [...comoA, ...comoB].sort((x, y) => y.ultimaVez - x.ultimaVez);
    return await Promise.all(
      todas.map(async (pareja) => {
        const companeroId = pareja.a === yo._id ? pareja.b : pareja.a;
        return {
          parejaId: pareja._id,
          companeroId,
          companero: await nombreDe(ctx, companeroId),
          ultimaVez: pareja.ultimaVez,
        };
      }),
    );
  },
});
