// Modelo de datos de Tuerce en Convex. Ver docs/ARQUITECTURA.md.
// El avance es de la PAREJA; cada jugador conserva sus desbloqueos para jugar con otra persona.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  usuarios: defineTable({ nombre: v.string(), esInvitado: v.boolean(), tokenIdentifier: v.optional(v.string()) }).index(
    "por_token",
    ["tokenIdentifier"],
  ),
  perfiles: defineTable({
    usuarioId: v.id("usuarios"),
    panuelo: v.string(),
    sombrero: v.string(),
    peinado: v.string(),
    mascara: v.string(),
  }).index("por_usuario", ["usuarioId"]),
  // a < b siempre, para que una pareja tenga un solo documento
  parejas: defineTable({ a: v.id("usuarios"), b: v.id("usuarios"), ultimaVez: v.number() })
    .index("por_a", ["a", "b"])
    .index("por_b", ["b"]),
  invitaciones: defineTable({
    codigo: v.string(),
    de: v.id("usuarios"),
    vence: v.number(),
    parejaId: v.optional(v.id("parejas")),
  })
    .index("por_codigo", ["codigo"])
    .index("por_de", ["de", "vence"]),
  // códigos de invitación equivocados por usuario, para cortar a quien intente adivinarlos
  intentosCodigo: defineTable({ usuarioId: v.id("usuarios"), desde: v.number(), fallidos: v.number() }).index(
    "por_usuario",
    ["usuarioId"],
  ),
  // quién busca pareja (ver cola.ts): `desde` es el orden de llegada, `visto` el último «sigo acá» y `parejaId`
  // la pareja que le tocó, para avisarle a quien esperaba
  cola: defineTable({
    usuarioId: v.id("usuarios"),
    region: v.string(),
    desde: v.number(),
    visto: v.number(),
    parejaId: v.optional(v.id("parejas")),
  })
    // `parejaId` en el índice: la fila de espera de una región son las entradas sin pareja, en orden de llegada,
    // y las ya emparejadas no la traban
    .index("por_region", ["region", "parejaId", "desde"])
    .index("por_usuario", ["usuarioId"])
    .index("por_visto", ["visto"]),
  sesiones: defineTable({
    parejaId: v.id("parejas"),
    nivel: v.number(),
    anfitrion: v.id("usuarios"),
    sala: v.string(),
    estado: v.union(v.literal("jugando"), v.literal("esperando"), v.literal("cerrada")),
  }).index("por_pareja", ["parejaId", "estado"]),
  avance: defineTable({
    parejaId: v.id("parejas"),
    nivel: v.number(),
    puntoDeControl: v.number(),
    misiones: v.array(v.boolean()),
    secreto: v.boolean(),
    // contrarreloj (TU-32, ver contrarreloj.ts): si la pareja ya llegó a la meta, y su mejor tiempo en pasos
    ganado: v.optional(v.boolean()),
    mejorTiempo: v.optional(v.number()),
  }).index("por_pareja_nivel", ["parejaId", "nivel"]),
  desbloqueos: defineTable({ usuarioId: v.id("usuarios"), cosa: v.string(), nivel: v.number() }).index("por_usuario", [
    "usuarioId",
    "cosa",
  ]),
  logros: defineTable({ usuarioId: v.id("usuarios"), logroId: v.string() }).index("por_usuario", [
    "usuarioId",
    "logroId",
  ]),
  // la tabla del contrarreloj (TU-32): una fila por pareja y nivel con su mejor tiempo, en pasos de físicas
  tiempos: defineTable({ nivel: v.number(), parejaId: v.id("parejas"), tiempo: v.number() })
    .index("por_nivel", ["nivel", "tiempo"])
    .index("por_pareja", ["parejaId", "nivel"]),
  reportes: defineTable({ de: v.id("usuarios"), a: v.id("usuarios"), motivo: v.string() }),
});
