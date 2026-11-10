# Entornos y secretos

Tres entornos separados. Las llaves viven en los secretos de GitHub, en Cloudflare y en Convex; **nunca en el código**.

| | Desarrollo | Vista previa | Producción |
|---|---|---|---|
| Cuándo | En tu máquina (`pnpm dev`) | Cada pull request | Cada cambio en `main` |
| Juego (Cloudflare) | `localhost:5173` | `pr-N-tuerce.<subdominio>.workers.dev` (versión con alias del Worker `tuerce`) | `tuerce.<subdominio>.workers.dev` |
| Sala (Cloudflare) | `wrangler dev` en `:8798` | Worker `tuerce-sala-preview` (`--env preview`) | Worker `tuerce-sala` |
| Datos (Convex, proyecto `tuerce`) | `careful-ptarmigan-335` (tu despliegue personal) | `vista-previa` · `wary-okapi-498` | `produccion` · `glad-ocelot-369` |
| Cuentas (Clerk, app `Tuerce`) | instancia de desarrollo | instancia de desarrollo | instancia de desarrollo por ahora; la de producción pide un dominio propio |

## Dónde está cada llave

| Nombre | Dónde | Para qué |
|---|---|---|
| `CONVEX_DEPLOY_KEY_PREVIEW` | Secreto de GitHub | Subir funciones al despliegue `vista-previa` |
| `CONVEX_DEPLOY_KEY_PROD` | Secreto de GitHub | Subir funciones a `produccion` |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Secretos de GitHub | Publicar el juego y la sala. Sin ellos la revisión salta la publicación y lo dice en el PR |
| `VITE_CLERK_PUBLISHABLE_KEY_PREVIEW` / `_PROD` | Variables de GitHub | Llave **pública** de Clerk que va dentro del juego |
| `CLERK_JWT_ISSUER_DOMAIN` | Variables de cada despliegue de Convex (`npx convex env set`) | Para que Convex acepte los tokens de Clerk (`convex/auth.config.ts`) |
| `VITE_CONVEX_URL`, `VITE_CLERK_PUBLISHABLE_KEY` | `apps/juego/.env.local` (ignorado por git) | Desarrollo local. Copiá `apps/juego/.env.example` |
| `CONVEX_DEPLOYMENT` | `.env.local` en la raíz (ignorado) | Lo escribe `npx convex dev` |

En la revisión automática, `convex deploy` pone `VITE_CONVEX_URL` sola al construir el juego.

## Empezar en una máquina nueva

```bash
pnpm install
pnpm convex:dev                         # entra a Convex, elige el proyecto «tuerce» y crea tu despliegue de desarrollo
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://divine-clam-6554.clerk.accounts.dev
cp apps/juego/.env.example apps/juego/.env.local   # y poné tu VITE_CONVEX_URL (está en .env.local de la raíz)
pnpm dev                                # http://localhost:5173/?escena=entrar
```

## Pendiente

- **Clerk en producción**: crear la instancia de producción cuando haya dominio (por ejemplo `tuerce.lcfapps.com`),
  cambiar `VITE_CLERK_PUBLISHABLE_KEY_PROD` y `CLERK_JWT_ISSUER_DOMAIN` en `produccion`.
- **Proteger `main`**: GitHub no permite reglas de rama en repos privados del plan gratis. Con GitHub Pro (o el repo
  público) se activa «solo por pull request con la revisión en verde» con:
  `gh api -X PUT repos/luiscf1226/tuerce/branches/main/protection --input docs/proteccion-main.json`.
