# Tuerce

Juego cooperativo de físicas para **dos jugadores, siempre**: en el mismo lugar o en línea. Dos muñecos de Año Viejo
rellenos de trapos cruzan Latinoamérica resolviendo rompecabezas a puro agarrón.

**Cómo se ve:** como Limbo en clave clara. Siluetas oscuras sobre niebla luminosa, solo modo claro, y los dos
pañuelos (rojo y turquesa) como único color. La referencia obligatoria son `docs/arte/11-pinar` a `14-personajes`.

- **Jugar (producción, siempre la última versión de `main`):** https://tuerce.luiscf1226.workers.dev
- **Propuesta con demo jugable:** https://claude.ai/artifact/P9kmTojq7XBSg4m3vTfWmZ (copia en `prototipo/`)
- **Plan (requerimientos, arquitectura y los 17 niveles con sus 91 misiones):** `docs/plan.html` · https://claude.ai/artifact/QVzT8avdwoipVvDm2Leg1z
- **Arte de referencia:** `docs/arte/11-*` a `14-*` (generado con IA). `docs/arte/descartado/` guarda el estilo de colores que se descartó.
- **Trabajo:** por **olas** (`docs/OLAS.md`): cada hito de GitHub es una ola y cada issue un ticket de `docs/TICKETS.md`

## Qué hay aquí

| Carpeta         | Qué es                                                                                | Estado                                                                                 |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `apps/juego/`   | El juego: TypeScript, Three.js, Rapier y Vite                                         | Los 17 niveles desde el menú, de la historia al final, aquí o en línea; ropero y tabla |
| `convex/`       | Datos: esquema, Clerk y funciones de usuario                                          | Proyecto `tuerce` con desarrollo, vista previa y producción                            |
| `workers/sala/` | Sala de dos (Cloudflare Durable Object): presenta a los jugadores y hace de repetidor | En producción (`tuerce-sala`), con pase firmado por Convex y TURN de Cloudflare        |
| `scripts/`      | Capturas automáticas y lo que corre la revisión                                       | `pnpm capturas`                                                                        |
| `niveles/`      | Escenas y guiones de cada nivel                                                       | Del 00-patio al 16-medianoche, más 98-piezas y 99-prueba                               |
| `prototipo/`    | La propuesta con la demo 2D para dos                                                  | Con la imagen nueva (niebla, siluetas de trapo); un solo HTML que se abre directo      |
| `docs/`         | Plan, generador, arte y entornos                                                      | `docs/generador/tuerce.mjs` regenera el plan                                           |

## Cómo se corre

```bash
pnpm install
pnpm dev        # juego en http://localhost:5173 (?escena=prueba, ?escena=entrar) y sala en :8798
pnpm check      # Biome y TypeScript estricto
pnpm test       # pruebas del juego y de la sala
pnpm build
pnpm capturas   # imágenes y video del juego en capturas/
```

Para entrar con Clerk en local hace falta `apps/juego/.env.local` (ver `docs/ENTORNOS.md`).
Los agentes leen `AGENTS.md`.

## Cuentas

Clerk para entrar (Google o correo), Convex para los datos y Cloudflare para publicar y para la sala de dos.
Cómo se separan desarrollo, vista previa y producción, y dónde vive cada llave: `docs/ENTORNOS.md`.

## Lo que sigue

Las olas 0 a 10 están en `main` y en producción (`pnpm prueba:produccion` lo revisa). Queda la prueba con cinco
parejas (TU-16, la juegan personas), la instancia de producción de Clerk cuando haya dominio propio y proteger `main`
(pide GitHub Pro o el repo público); ver `docs/ENTORNOS.md`. Cada ola nueva se hace con la skill `ola`: varios agentes
en paralelo, todo se junta en una rama `ola-N` y se entrega con vista previa, capturas y un pull request; con «full
send» se une a `main`.
