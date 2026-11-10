// Pruebas de las funciones de Convex con convex-test: un Convex de mentira en memoria, en el entorno «edge-runtime»
// que se parece al de Convex. Se corren desde la raíz con `pnpm test:convex`.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "edge-runtime", include: ["**/*.test.ts"], server: { deps: { inline: ["convex-test"] } } },
});
