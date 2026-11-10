# Tuerce

Juego cooperativo de físicas para **dos jugadores, siempre**: en el mismo lugar o en línea. Dos muñecos de Año Viejo
rellenos de trapos cruzan Latinoamérica resolviendo rompecabezas a puro agarrón.

**Cómo se ve:** como Limbo en clave clara. Siluetas oscuras sobre niebla luminosa, solo modo claro, y los dos
pañuelos (rojo y turquesa) como único color. La referencia obligatoria son `docs/arte/11-pinar` a `14-personajes`.

- **Propuesta con demo jugable:** https://claude.ai/artifact/P9kmTojq7XBSg4m3vTfWmZ (copia en `prototipo/`)
- **Plan (requerimientos, arquitectura y los 17 niveles con sus 91 misiones):** `docs/plan.html` · https://claude.ai/artifact/QVzT8avdwoipVvDm2Leg1z
- **Arte de referencia:** `docs/arte/11-*` a `14-*` (generado con IA). `docs/arte/descartado/` guarda el estilo de colores que se descartó.
- **Trabajo:** los issues y los hitos de este repositorio, uno por ticket de `docs/TICKETS.md`

## Qué hay aquí

| Carpeta | Qué es | Estado |
|---|---|---|
| `apps/juego/` | El juego: TypeScript, Three.js y Rapier | Vacío: empieza en la fase 1 (el muñeco) |
| `convex/` | Modelo de datos (`schema.ts`): parejas, invitaciones, cola, avance | Solo el esquema |
| `workers/sala/` | Sala de dos (Cloudflare Durable Object): presenta a los jugadores y hace de repetidor | Funciona en local; sin pase firmado ni TURN todavía |
| `niveles/` | Escenas y guiones de cada nivel | Vacío |
| `prototipo/` | La propuesta con la demo 2D para dos | Con el estilo descartado; se rehace en TU-36 |
| `docs/` | Plan, generador y arte | `docs/generador/tuerce.mjs` regenera el plan |

## Cómo se corre

```bash
pnpm install && pnpm --dir workers/sala install

pnpm convex:check   # revisa los tipos del esquema
pnpm sala:test      # levanta la sala en local, conecta a los dos jugadores y cruza una señal; debe imprimir PASA
```

## Cuentas

Clerk para entrar (Google o correo), Convex para los datos y Cloudflare para publicar y para la sala de dos.

## Lo que sigue

Fase 1 del plan: el muñeco (ragdoll activo en Rapier) con dos jugadores en el mismo teclado, dentro de `apps/juego/`.
