// Pase para entrar a la sala de la pareja (Worker `workers/sala`). Solo lo reciben los dos de la pareja.
// SALA_SECRETO es el mismo en este despliegue de Convex y en su sala (ver docs/ENTORNOS.md).
// La referencia es para que el juego, que importa los tipos de `_generated/api`, también sepa qué es `process`.
/// <reference path="./entorno.d.ts" />
import { ConvexError, v } from "convex/values";
import { DURACION_PASE_MS, firmarPase, salaDePareja } from "../workers/sala/src/pase";
import { mutation } from "./_generated/server";
import { yoObligatorio } from "./cuenta";

/** Un pase de unos 2 minutos para /sala/<sala>?pase=… y /turn?pase=… */
export const pedirPase = mutation({
  args: { parejaId: v.id("parejas") },
  handler: async (ctx, { parejaId }): Promise<{ pase: string; sala: string; vence: number }> => {
    const yo = await yoObligatorio(ctx);
    const pareja = await ctx.db.get(parejaId);
    if (!pareja || (pareja.a !== yo._id && pareja.b !== yo._id)) throw new ConvexError("Esa pareja no es tuya");
    const secreto = process.env.SALA_SECRETO;
    if (!secreto) throw new ConvexError("Falta SALA_SECRETO en este despliegue de Convex");
    const ahora = Date.now();
    const sala = salaDePareja(parejaId);
    const vence = ahora + DURACION_PASE_MS;
    const pase = await firmarPase({ sala, usuario: yo._id, vence }, secreto);
    await ctx.db.patch(parejaId, { ultimaVez: ahora });
    return { pase, sala, vence };
  },
});
