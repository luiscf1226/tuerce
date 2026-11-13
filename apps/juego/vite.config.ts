import { defineConfig } from "vitest/config";

export default defineConfig({
  build: { target: "es2022", chunkSizeWarningLimit: 4096 },
  // Las escenas de los niveles (niveles/*/escena.glb, TU-11)
  assetsInclude: ["**/*.glb"],
  // Las pruebas de los niveles corren miles de pasos de físicas reales: con la máquina cargada (la revisión, o varios
  // agentes a la vez) algunas pasan de los 5 s de siempre sin estar mal
  test: { environment: "node", testTimeout: 20_000 },
});
