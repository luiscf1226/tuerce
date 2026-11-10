// Modelo de datos de Tuerce en Convex. Ver docs/ARQUITECTURA.md.
// El avance es de la PAREJA; cada jugador conserva sus desbloqueos para jugar con otra persona.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  usuarios: defineTable({ nombre: v.string(), esInvitado: v.boolean(), tokenIdentifier: v.optional(v.string()) })
    .index("por_token", ["tokenIdentifier"]),
  perfiles: defineTable({ usuarioId: v.id("usuarios"), panuelo: v.string(), sombrero: v.string(), peinado: v.string(), mascara: v.string() })
    .index("por_usuario", ["usuarioId"]),
  // a < b siempre, para que una pareja tenga un solo documento
  parejas: defineTable({ a: v.id("usuarios"), b: v.id("usuarios"), ultimaVez: v.number() })
    .index("por_a", ["a", "b"]).index("por_b", ["b"]),
  invitaciones: defineTable({ codigo: v.string(), de: v.id("usuarios"), vence: v.number(), parejaId: v.optional(v.id("parejas")) })
    .index("por_codigo", ["codigo"]),
  // quién busca pareja; una mutación empareja a los dos primeros de la misma región
  cola: defineTable({ usuarioId: v.id("usuarios"), region: v.string(), desde: v.number() })
    .index("por_region", ["region", "desde"]).index("por_usuario", ["usuarioId"]),
  sesiones: defineTable({ parejaId: v.id("parejas"), nivel: v.number(), anfitrion: v.id("usuarios"), sala: v.string(), estado: v.union(v.literal("jugando"), v.literal("esperando"), v.literal("cerrada")) })
    .index("por_pareja", ["parejaId", "estado"]),
  avance: defineTable({ parejaId: v.id("parejas"), nivel: v.number(), puntoDeControl: v.number(), misiones: v.array(v.boolean()), secreto: v.boolean(), mejorTiempo: v.optional(v.number()) })
    .index("por_pareja_nivel", ["parejaId", "nivel"]),
  desbloqueos: defineTable({ usuarioId: v.id("usuarios"), cosa: v.string(), nivel: v.number() })
    .index("por_usuario", ["usuarioId", "cosa"]),
  logros: defineTable({ usuarioId: v.id("usuarios"), logroId: v.string() })
    .index("por_usuario", ["usuarioId", "logroId"]),
  tiempos: defineTable({ nivel: v.number(), parejaId: v.id("parejas"), tiempo: v.number() })
    .index("por_nivel", ["nivel", "tiempo"]),
  reportes: defineTable({ de: v.id("usuarios"), a: v.id("usuarios"), motivo: v.string() }),
});
