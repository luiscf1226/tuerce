// Convex lee las variables de cada despliegue con process.env (se ponen con `npx convex env set`).
declare const process: { env: Record<string, string | undefined> };

// Vite (y por lo tanto Vitest) arma con import.meta.glob la lista de módulos que carga convex-test.
interface ImportMeta {
  glob(patrones: string | string[]): Record<string, () => Promise<unknown>>;
}
