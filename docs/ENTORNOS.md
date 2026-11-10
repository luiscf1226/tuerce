# Entornos y secretos

Tres entornos separados. Las llaves viven en los secretos de GitHub, en Cloudflare y en Convex; **nunca en el código**.

| | Desarrollo | Vista previa | Producción |
|---|---|---|---|
| Cuándo | En tu máquina (`pnpm dev`) | Cada pull request | Cada cambio en `main` |
| Juego (Cloudflare) | `localhost:5173` | `pr-N-tuerce.luiscf1226.workers.dev` (versión con alias del Worker `tuerce`) | https://tuerce.luiscf1226.workers.dev |
| Sala (Cloudflare) | `wrangler dev` en `:8798` | `tuerce-sala-preview.luiscf1226.workers.dev` (`--env preview`) | `tuerce-sala.luiscf1226.workers.dev` |
| Datos (Convex, proyecto `tuerce`) | `careful-ptarmigan-335` (tu despliegue personal) | `vista-previa` · `wary-okapi-498` | `produccion` · `glad-ocelot-369` |
| Cuentas (Clerk, app `Tuerce`) | instancia de desarrollo | instancia de desarrollo | instancia de desarrollo por ahora; la de producción pide un dominio propio |

## Dónde está cada llave

| Nombre | Dónde | Para qué |
|---|---|---|
| `CONVEX_DEPLOY_KEY_PREVIEW` | Secreto de GitHub | Subir funciones al despliegue `vista-previa` |
| `CONVEX_DEPLOY_KEY_PROD` | Secreto de GitHub | Subir funciones a `produccion` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Secretos de GitHub | Publicar el juego y la sala. Es el token «tuerce-github» de Cloudflare: solo Workers de esta cuenta. Sin él la revisión salta la publicación y lo dice en el PR |
| `VITE_CLERK_PUBLISHABLE_KEY_PREVIEW` / `_PROD` | Variables de GitHub | Llave **pública** de Clerk que va dentro del juego |
| `CLERK_JWT_ISSUER_DOMAIN` | Variables de cada despliegue de Convex (`npx convex env set`) | Para que Convex acepte los tokens de Clerk (`convex/auth.config.ts`) |
| `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY` | `apps/juego/.env.local` (ignorado por git) | Desarrollo local. Copiá `apps/juego/.env.example` |
| `CONVEX_DEPLOYMENT` | `.env.local` en la raíz (ignorado) | Lo escribe `npx convex dev` |
| `SALA_SECRETO` | Variable de cada despliegue de Convex (`npx convex env set SALA_SECRETO …`) **y** secreto de la sala del mismo entorno (`wrangler secret put SALA_SECRETO`, con `--env preview` para la vista previa). En local, `workers/sala/.dev.vars` | Convex firma el pase de 2 minutos (`pedirPase`) y la sala lo revisa. Tiene que ser **el mismo valor** en `vista-previa` y `tuerce-sala-preview`, y en `produccion` y `tuerce-sala`. Sin él la sala no deja entrar a nadie |
| `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` | Secretos de la sala (`wrangler secret put`, en `tuerce-sala` y `tuerce-sala-preview`). En local, opcional en `workers/sala/.dev.vars` | Llave de Cloudflare Realtime TURN: `GET /turn?pase=…` entrega credenciales TURN de un día para redes cerradas. Sin ellas responde solo el STUN público y lo avisa (`respaldo: true`) |

En la revisión automática, `convex deploy` pone `VITE_CONVEX_URL` sola al construir el juego.

## Empezar en una máquina nueva

```bash
pnpm install
pnpm convex:dev                         # entra a Convex, elige el proyecto «tuerce» y crea tu despliegue de desarrollo
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://divine-clam-6554.clerk.accounts.dev
cp apps/juego/.env.example apps/juego/.env.local   # y poné tu VITE_CONVEX_URL (está en .env.local de la raíz)
npx convex env set SALA_SECRETO "$(openssl rand -hex 32)"   # y copialo a workers/sala/.dev.vars (abajo)
pnpm dev                                # http://localhost:5173/?escena=entrar
```

### La sala en local: `workers/sala/.dev.vars`

`wrangler dev` lee los secretos de la sala de `workers/sala/.dev.vars` (no se sube: `.gitignore` lo ignora). Poné el
mismo `SALA_SECRETO` que en tu despliegue de Convex (`npx convex env get SALA_SECRETO`), así los pases que firma tu
Convex sirven en tu sala local:

```
SALA_SECRETO=<el mismo valor que en tu Convex de desarrollo>
# Opcional, para probar TURN de verdad:
# TURN_KEY_ID=…
# TURN_KEY_API_TOKEN=…
```

`pnpm test` no lo necesita: la prueba de la sala levanta `wrangler dev --var SALA_SECRETO:prueba` y firma sus
propios pases.

Estado (10 de noviembre de 2026): `SALA_SECRETO` está puesto en los tres Convex y en las dos salas (un valor por
entorno) y la llave TURN «tuerce-sala» de Cloudflare Realtime está en las dos salas.

## Pendiente

- **Una sola vista previa de datos**: todos los PR comparten el despliegue `vista-previa` de Convex y la sala
  `tuerce-sala-preview`; el último PR en publicarse es el que manda. Con dos PR abiertos a la vez, abrí la vista previa
  del último. Un Convex por PR necesita llaves de vista previa (plan pago).

- **Clerk en producción**: crear la instancia de producción cuando haya dominio (por ejemplo `tuerce.lcfapps.com`),
  cambiar `VITE_CLERK_PUBLISHABLE_KEY_PROD` y `CLERK_JWT_ISSUER_DOMAIN` en `produccion`.
- **Proteger `main`**: GitHub no permite reglas de rama en repos privados del plan gratis. Con GitHub Pro (o el repo
  público) se activa «solo por pull request con la revisión en verde» con:
  `gh api -X PUT repos/luiscf1226/tuerce/branches/main/protection --input docs/proteccion-main.json`.
