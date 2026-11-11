/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_CONVEX_URL?: string;
  /** La sala (workers/sala) para jugar en línea; si falta, se deduce del host (ver escenas/en-linea.ts). */
  readonly VITE_SALA_URL?: string;
}
