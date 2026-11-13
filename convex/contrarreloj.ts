// El contrarreloj (TU-32): cualquier nivel ya ganado, contra el reloj y contra otras parejas.
//
//   · `ganarNivel`: la pareja llegó a la meta jugando el nivel (lo manda el anfitrión, ver apps/juego/src/red/avance.ts).
//     Solo con eso se abre el contrarreloj de ese nivel.
//   · `registrarTiempo`: terminaron una carrera. Los tiempos son pasos de físicas del anfitrión (60 por segundo), no
//     milisegundos: así los cuenta el juego y así no dependen de qué tan rápido dibuje cada máquina. Se guarda el
//     mejor en `avance.mejorTiempo` y en `tiempos`, una fila por pareja y nivel.
//   · `tabla`: las mejores parejas de un nivel, con los nombres de los dos, y dónde queda la propia.
//   · `nivelesGanados`: qué niveles ganó la pareja y su mejor tiempo en cada uno.
//
// La tabla es de confianza: el servidor no ve la carrera, así que cualquiera de los dos de la pareja podría mandar un
// tiempo inventado (siempre en un nivel del juego que ganaron, y no más corto que el mínimo de ese nivel). Igual que
// el avance, el secreto y el logro (ver ropero.ts).
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
import { avanceDe, esEnteroEntre, MAX_NIVEL, parejaMia } from "./avance";
import { nombreDe, yoObligatorio, yoSiHay } from "./cuenta";
import { NIVELES_CON_PREMIOS } from "./premios";

/** Pasos de físicas por segundo: los tiempos se cuentan en pasos. */
export const PASOS_POR_SEGUNDO = 60;
/** Ningún nivel se cruza en menos de 10 s: un tiempo más corto es un error o una trampa. */
export const TIEMPO_MINIMO = 10 * PASOS_POR_SEGUNDO;
/**
 * El tiempo mínimo de cada nivel en pasos, cuando se sabe uno más ajustado que TIEMPO_MINIMO: lo que tarda en cruzarlo
 * en línea recta un muñeco a toda velocidad. Un nivel nuevo pone acá el suyo.
 */
const MINIMO_POR_NIVEL: Readonly<Record<number, number>> = {};
/** Los niveles del juego: los del plan (los que tienen secreto y logro) y el de piezas. Otro número no existe. */
const NIVELES = new Set<number>([...NIVELES_CON_PREMIOS, 98]);

/** Si `nivel` es uno de los del juego. */
export const existeNivel = (nivel: number) => esEnteroEntre(nivel, MAX_NIVEL) && NIVELES.has(nivel);
/** El tiempo más corto que se acepta en `nivel`, en pasos. */
export const tiempoMinimo = (nivel: number) => Math.max(TIEMPO_MINIMO, MINIMO_POR_NIVEL[nivel] ?? 0);
/** Cuántas parejas se cuentan, como mucho, para dar el puesto de la propia fuera de la tabla. */
export const CONTAR_HASTA = 1000;

/** Más de dos horas no es una carrera. */
export const TIEMPO_MAXIMO = 2 * 60 * 60 * PASOS_POR_SEGUNDO;
/** Cuántas parejas muestra la tabla. */
export const PUESTOS = 10;

/** Una fila de la tabla: el puesto (los empates comparten), los dos de la pareja y su mejor tiempo en pasos. */
export interface FilaDeTabla {
  puesto: number;
  nombres: [string, string];
  tiempo: number;
  /** Si es la pareja de quien pregunta. */
  propia: boolean;
  /** El puesto es «más de» `puesto - 1`: hay demasiadas parejas adelante para contarlas. */
  masDe?: boolean;
}

async function nombresDe(ctx: QueryCtx, parejaId: Id<"parejas">): Promise<[string, string]> {
  const pareja = await ctx.db.get(parejaId);
  if (!pareja) return ["Alguien", "Alguien"];
  return [await nombreDe(ctx, pareja.a), await nombreDe(ctx, pareja.b)];
}

/** La pareja llegó a la meta de `nivel`: se abre su contrarreloj. */
export const ganarNivel = mutation({
  args: { parejaId: v.id("parejas"), nivel: v.number() },
  handler: async (ctx, { parejaId, nivel }): Promise<void> => {
    if (!existeNivel(nivel)) throw new ConvexError("Ese nivel no existe");
    const yo = await yoObligatorio(ctx);
    if (!(await parejaMia(ctx, yo, parejaId))) throw new ConvexError("Esa pareja no es tuya");
    const guardado = await avanceDe(ctx, parejaId, nivel);
    if (!guardado) {
      await ctx.db.insert("avance", { parejaId, nivel, puntoDeControl: 0, misiones: [], secreto: false, ganado: true });
      return;
    }
    if (!guardado.ganado) await ctx.db.patch(guardado._id, { ganado: true });
  },
});

/** Terminaron una carrera de `nivel` en `tiempo` pasos. Devuelve el mejor tiempo de la pareja y si este lo mejoró. */
export const registrarTiempo = mutation({
  args: { parejaId: v.id("parejas"), nivel: v.number(), tiempo: v.number() },
  handler: async (ctx, { parejaId, nivel, tiempo }): Promise<{ mejor: number; mejoro: boolean }> => {
    if (!existeNivel(nivel)) throw new ConvexError("Ese nivel no existe");
    if (!Number.isInteger(tiempo) || tiempo < tiempoMinimo(nivel) || tiempo > TIEMPO_MAXIMO) {
      throw new ConvexError("Ese tiempo no es posible");
    }
    const yo = await yoObligatorio(ctx);
    if (!(await parejaMia(ctx, yo, parejaId))) throw new ConvexError("Esa pareja no es tuya");
    const avance = await avanceDe(ctx, parejaId, nivel);
    if (!avance?.ganado) throw new ConvexError("Primero tienen que ganar ese nivel");

    const fila = await ctx.db
      .query("tiempos")
      .withIndex("por_pareja", (q) => q.eq("parejaId", parejaId).eq("nivel", nivel))
      .unique();
    const anterior = fila?.tiempo ?? avance.mejorTiempo;
    if (anterior !== undefined && anterior <= tiempo) return { mejor: anterior, mejoro: false };
    if (fila) await ctx.db.patch(fila._id, { tiempo });
    else await ctx.db.insert("tiempos", { nivel, parejaId, tiempo });
    await ctx.db.patch(avance._id, { mejorTiempo: tiempo });
    return { mejor: tiempo, mejoro: true };
  },
});

/** Las mejores PUESTOS parejas de `nivel` y, si quien pregunta es de `parejaId`, dónde queda esa pareja. */
export const tabla = query({
  args: { nivel: v.number(), parejaId: v.optional(v.id("parejas")) },
  handler: async (ctx, { nivel, parejaId }): Promise<{ filas: FilaDeTabla[]; propia: FilaDeTabla | null }> => {
    if (!esEnteroEntre(nivel, MAX_NIVEL)) return { filas: [], propia: null };
    const yo = await yoSiHay(ctx);
    const mia = yo && parejaId && (await parejaMia(ctx, yo, parejaId)) ? parejaId : undefined;

    const primeras = await ctx.db
      .query("tiempos")
      .withIndex("por_nivel", (q) => q.eq("nivel", nivel))
      .take(PUESTOS);
    const filas: FilaDeTabla[] = [];
    for (const [i, fila] of primeras.entries()) {
      const anterior = filas[i - 1];
      filas.push({
        // Empatados comparten puesto: 1, 2, 2, 4
        puesto: anterior && anterior.tiempo === fila.tiempo ? anterior.puesto : i + 1,
        nombres: await nombresDe(ctx, fila.parejaId),
        tiempo: fila.tiempo,
        propia: fila.parejaId === mia,
      });
    }

    let propia = filas.find((f) => f.propia) ?? null;
    if (!propia && mia) {
      const fila = await ctx.db
        .query("tiempos")
        .withIndex("por_pareja", (q) => q.eq("parejaId", mia).eq("nivel", nivel))
        .unique();
      if (fila) {
        // El puesto es uno más que las parejas con mejor tiempo. Se cuentan hasta CONTAR_HASTA, para que la consulta
        // (que se vuelve a correr con cada tiempo nuevo del nivel) no lea la tabla entera: más allá, «más de 1000»
        const antes = await ctx.db
          .query("tiempos")
          .withIndex("por_nivel", (q) => q.eq("nivel", nivel).lt("tiempo", fila.tiempo))
          .take(CONTAR_HASTA);
        propia = {
          puesto: antes.length + 1,
          ...(antes.length >= CONTAR_HASTA ? { masDe: true } : {}),
          nombres: await nombresDe(ctx, mia),
          tiempo: fila.tiempo,
          propia: true,
        };
      }
    }
    return { filas, propia };
  },
});

/** Los niveles que ganó la pareja, con su mejor tiempo si ya corrieron alguno. Solo para los dos de la pareja. */
export const nivelesGanados = query({
  args: { parejaId: v.id("parejas") },
  handler: async (ctx, { parejaId }): Promise<{ nivel: number; mejorTiempo: number | null }[]> => {
    const yo = await yoSiHay(ctx);
    if (!yo || !(await parejaMia(ctx, yo, parejaId))) return [];
    const avances = await ctx.db
      .query("avance")
      .withIndex("por_pareja_nivel", (q) => q.eq("parejaId", parejaId))
      .collect();
    return avances.filter((a) => a.ganado).map((a) => ({ nivel: a.nivel, mejorTiempo: a.mejorTiempo ?? null }));
  },
});
