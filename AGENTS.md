# Tuerce · guía para agentes

Juego cooperativo de físicas para **dos jugadores, siempre** (mismo lugar o en línea). Dos muñecos de trapo cruzan
Latinoamérica resolviendo rompecabezas a puro agarrón. El plan completo está en `docs/plan.html`; los tickets en
`docs/TICKETS.md`; las olas en `docs/OLAS.md`. Todo se escribe en español: código, comentarios, commits y PR.

## El proyecto

| Carpeta                           | Qué es                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/juego/`                     | El juego: TypeScript, Three.js, Rapier (físicas a paso fijo de 60 por segundo) y Vite. Se publica como Worker de Cloudflare con archivos estáticos (`wrangler.jsonc`). |
| `apps/juego/src/motor/`           | Bucle de paso fijo (`bucle.ts`) y mundo de Rapier (`fisica.ts`).                                                                                                       |
| `apps/juego/src/escenas/`         | Cada escena se abre con `?escena=<nombre>`; la lista está en `index.ts`.                                                                                               |
| `apps/juego/src/misiones/`        | Misiones: el tablero de objetivos (`tablero.ts`), los objetos de misión (semilla, encargo, entrega) y la misión de cada nivel. El tutorial es `?escena=tutorial`.      |
| `apps/juego/src/cuenta/`          | Entrar con Clerk y que Convex reconozca al usuario (`?escena=entrar`).                                                                                                 |
| `apps/escritorio/`                | El mismo juego empacado para Steam con Tauri v2 (Rust): ventana, ícono, plantillas de Steam. Ver su `README.md`.                                                       |
| `convex/`                         | Datos: `schema.ts`, `auth.config.ts` (Clerk) y funciones. `_generated/` se regenera con `pnpm convex:dev`.                                                             |
| `workers/sala/`                   | Sala de dos (Durable Object): presenta a los jugadores y hace de repetidor.                                                                                            |
| `scripts/`                        | `capturas.mjs` (imágenes y video del juego) y `ci/` (lo que corre la revisión automática).                                                                             |
| `niveles/`, `prototipo/`, `docs/` | Niveles, la propuesta 2D vieja y el plan.                                                                                                                              |

## Comandos

```bash
pnpm install       # instala todo el proyecto (un solo pnpm-lock.yaml en la raíz)
pnpm dev           # juego en http://localhost:5173 y sala en :8798
pnpm check         # Biome (lint y formato) + TypeScript estricto en todo
pnpm test          # pruebas del juego (Vitest), de la sala (dos clientes reales contra wrangler dev) y de la red
pnpm prueba:red    # la red de verdad: dos Chromium, directo, caída al repetidor, repetidor forzado y se_fue
pnpm red:local     # dos direcciones de `?escena=red` para mirar la red a mano (con `pnpm dev` corriendo)
pnpm build         # construye el juego y la sala
pnpm capturas      # abre el juego en Chromium sin ventana y guarda imágenes y video en capturas/
pnpm format        # arregla el formato
pnpm escritorio:dev      # el juego en la ventana de escritorio (Tauri; pide Rust)
pnpm escritorio:empacar  # empaca para este sistema (en Arch: NO_STRIP=true); ver apps/escritorio/README.md
pnpm convex:dev    # sube las funciones de convex/ a tu despliegue de desarrollo y regenera _generated/
```

Antes de dar algo por terminado: `pnpm check && pnpm test && pnpm build`, y `pnpm capturas` si cambia lo que se ve.
Si tocás algo visible, mirá las imágenes de `capturas/` antes de decir que quedó.

## Cómo probar

- **Lógica pura** (bucle, matemáticas, reglas): prueba de Vitest al lado del archivo (`*.test.ts`).
- **Físicas**: Rapier corre igual en Node; armá el mundo, corré `mundo.step()` N veces y revisá posiciones.
  Las físicas son deterministas: dos corridas iguales dan lo mismo.
- **Lo que se ve**: agregá la escena a `ESCENAS` y una toma a `TOMAS` en `scripts/capturas.mjs`.
  `?congelar=N` corre N pasos exactos y se detiene, así la imagen sale igual siempre.
- **Red**: la prueba de la sala levanta `wrangler dev` y conecta dos clientes de verdad. La de la red
  (`scripts/prueba-red.mjs`) abre dos Chromium en `?escena=red` y mira `window.__red`; la máquina de estados de
  `src/red/` se prueba con una sala y un WebRTC de mentira (`conexion.test.ts`).
- El juego expone `window.__tuerce` (`escena`, `listo`, `pasosTotales`, `pasosPorSegundo`) para las pruebas en Chromium.

## Reglas

- TypeScript estricto (`tsconfig.base.json`, con `noUncheckedIndexedAccess`). Sin `any` ni `!`: Biome los rechaza.
- Las físicas siempre avanzan de a `PASO` (1/60 s) desde el bucle; nunca con el tiempo del cuadro.
- La imagen: siluetas oscuras sobre niebla clara, solo modo claro; los pañuelos rojo y turquesa son el único color
  (`src/escenas/colores.ts`). La referencia son `docs/arte/11-*` a `14-*`.
- Dos jugadores siempre: nada de modo de un solo jugador ni compañero bot salvo que se pida.

## Qué no tocar

- **Llaves y secretos**: nunca en el código ni en commits. Viven en `.env.local` (ignorado), en los secretos de
  GitHub y en Cloudflare/Convex. Ver `docs/ENTORNOS.md`.
- `convex/_generated/` se genera solo: no se edita a mano (sí se sube al repo para que la revisión compile).
- `docs/plan.html` se regenera con `node docs/generador/tuerce.mjs`; editá el generador, no el HTML.
- `docs/arte/` es la referencia: no se cambia sin pedirlo.
- `main` solo recibe cambios por pull request con la revisión automática en verde. Nunca unir (merge) sin que
  Luis diga «full send».

## Trabajo por olas

Cada ola (un hito de GitHub) se hace con la skill `ola` (`.agents/skills/ola/SKILL.md`): reparte los tickets en
paralelo, junta todo en la rama `ola-N` y entrega vista previa, capturas y un pull request.
