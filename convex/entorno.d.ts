// Convex lee las variables de cada despliegue con process.env (se ponen con `npx convex env set`).
declare const process: { env: Record<string, string | undefined> };
