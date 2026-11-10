// Buscar pareja: quien no tiene con quién jugar entra a la cola de su región y queda junto con la persona que lleva
// más tiempo esperando ahí. Las mutaciones de Convex son serializables, así que dos que llegan a la vez no pueden
// quedarse con la misma persona: no hace falta ningún candado.
//
// Cada entrada de la cola lleva `desde` (cuándo empezó a esperar: el orden de llegada) y `visto` (la última vez que
// el juego dijo «sigo acá»). Mientras espera, el juego vuelve a llamar a `buscarPareja` cada LATIDO_MS; una entrada
// sin noticias en VIGENCIA_MS es de alguien que se fue y no se empareja. Al emparejar, las dos entradas se quedan con
// el `parejaId` para que `estadoCola` le avise al instante a quien estaba esperando.
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, type QueryCtx, query } from "./_generated/server";
import { juntar, nombreDe, yoObligatorio, yoSiHay } from "./cuenta";
import { esRegion, LATIDO_MS, type Region, VIGENCIA_MS } from "./regiones";

export { LATIDO_MS, VIGENCIA_MS };

/** Cuántas entradas viejas se miran (y se borran) por llamada antes de rendirse. */
const REVISAR_A_LO_SUMO = 50;

export type EstadoCola =
  | { estado: "esperando"; region: Region; desde: number }
  | { estado: "emparejados"; parejaId: Id<"parejas">; nombres: [string, string] };

async function miEntrada(ctx: QueryCtx, usuarioId: Id<"usuarios">): Promise<Doc<"cola"> | null> {
  return await ctx.db
    .query("cola")
    .withIndex("por_usuario", (q) => q.eq("usuarioId", usuarioId))
    .unique();
}

const vigente = (entrada: Doc<"cola">, ahora: number) => ahora - entrada.visto < VIGENCIA_MS;

/** «Ya son pareja: yo y vos», con mi nombre primero. */
async function emparejados(ctx: QueryCtx, yo: Id<"usuarios">, parejaId: Id<"parejas">): Promise<EstadoCola | null> {
  const pareja = await ctx.db.get(parejaId);
  if (!pareja) return null;
  const otro = pareja.a === yo ? pareja.b : pareja.a;
  return { estado: "emparejados", parejaId, nombres: [await nombreDe(ctx, yo), await nombreDe(ctx, otro)] };
}

/**
 * La persona que lleva más tiempo esperando en la región (sin contarme a mí). Las entradas sin noticias que
 * aparecen en el camino se borran de una vez.
 */
async function primeroEnEspera(ctx: MutationCtx, region: Region, yo: Id<"usuarios">, ahora: number) {
  const fila = await ctx.db
    .query("cola")
    .withIndex("por_region", (q) => q.eq("region", region))
    .order("asc")
    .take(REVISAR_A_LO_SUMO);
  for (const entrada of fila) {
    if (entrada.parejaId || entrada.usuarioId === yo) continue;
    if (!vigente(entrada, ahora)) {
      await ctx.db.delete(entrada._id);
      continue;
    }
    return entrada;
  }
  return null;
}

/**
 * Busco pareja en mi región. Si alguien más está esperando ahí, quedamos como pareja (se crea o se reusa) y salimos
 * los dos de la cola. Si no, entro a la cola, o, si ya estaba, aviso que sigo acá. Si ya me habían emparejado, me
 * devuelve esa pareja: para buscar otra, primero `dejarDeBuscar`.
 */
export const buscarPareja = mutation({
  args: { region: v.string() },
  handler: async (ctx, args): Promise<EstadoCola> => {
    const yo = await yoObligatorio(ctx);
    const region = args.region;
    if (!esRegion(region)) throw new ConvexError(`No conozco la región «${region}»`);
    const ahora = Date.now();

    const mia = await miEntrada(ctx, yo._id);
    if (mia?.parejaId && vigente(mia, ahora)) {
      const ya = await emparejados(ctx, yo._id, mia.parejaId);
      if (ya) return ya;
    }

    const otro = await primeroEnEspera(ctx, region, yo._id, ahora);
    if (otro) {
      const pareja = await juntar(ctx, otro.usuarioId, yo._id);
      await ctx.db.patch(otro._id, { parejaId: pareja._id, visto: ahora });
      const resultado = { region, desde: mia?.desde ?? ahora, visto: ahora, parejaId: pareja._id };
      if (mia) await ctx.db.replace(mia._id, { usuarioId: yo._id, ...resultado });
      else await ctx.db.insert("cola", { usuarioId: yo._id, ...resultado });
      const listo = await emparejados(ctx, yo._id, pareja._id);
      if (!listo) throw new Error("La pareja recién hecha no aparece");
      return listo;
    }

    // Nadie más espera: entro a la fila. Si ya estaba en la misma región conservo mi lugar; si cambié de región
    // (o mi entrada era vieja o de una pareja anterior), vuelvo a empezar.
    const conservo = mia && !mia.parejaId && mia.region === region && vigente(mia, ahora);
    const desde = conservo ? mia.desde : ahora;
    if (mia) await ctx.db.replace(mia._id, { usuarioId: yo._id, region, desde, visto: ahora });
    else await ctx.db.insert("cola", { usuarioId: yo._id, region, desde, visto: ahora });
    return { estado: "esperando", region, desde };
  },
});

/** Salgo de la cola (o borro el aviso de la pareja que ya me tocó). */
export const dejarDeBuscar = mutation({
  args: {},
  handler: async (ctx) => {
    const yo = await yoObligatorio(ctx);
    const mia = await miEntrada(ctx, yo._id);
    if (mia) await ctx.db.delete(mia._id);
  },
});

/**
 * Cómo va mi búsqueda, en vivo: null si no estoy buscando (o mi entrada ya venció), «esperando» mientras tanto y
 * «emparejados» apenas alguien me encuentra.
 */
export const estadoCola = query({
  args: {},
  handler: async (ctx): Promise<EstadoCola | null> => {
    const yo = await yoSiHay(ctx);
    if (!yo) return null;
    const mia = await miEntrada(ctx, yo._id);
    if (!mia) return null;
    if (mia.parejaId) return await emparejados(ctx, yo._id, mia.parejaId);
    // Una consulta no puede mirar la hora (Convex la cachea): la vigencia la decide `buscarPareja` y la limpieza.
    if (!esRegion(mia.region)) return null;
    return { estado: "esperando", region: mia.region, desde: mia.desde };
  },
});

/** Borra las entradas sin noticias en VIGENCIA_MS, emparejadas o no. La corre `crons.ts`. */
export const limpiar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ahora = Date.now();
    let borradas = 0;
    for (const entrada of await ctx.db.query("cola").take(500)) {
      if (vigente(entrada, ahora)) continue;
      await ctx.db.delete(entrada._id);
      borradas++;
    }
    return borradas;
  },
});
