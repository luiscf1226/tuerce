// Convex acepta los tokens de Clerk. CLERK_JWT_ISSUER_DOMAIN es la «Frontend API URL» de Clerk y se pone en cada
// despliegue de Convex (desarrollo, vista previa y producción), nunca en el código. Ver docs/ENTORNOS.md.
import type { AuthConfig } from "convex/server";

const dominio = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!dominio) throw new Error("Falta CLERK_JWT_ISSUER_DOMAIN en las variables de este despliegue de Convex");

export default {
  providers: [{ domain: dominio, applicationID: "convex" }],
} satisfies AuthConfig;
