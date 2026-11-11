import { defineConfig } from "vitest/config";

export default defineConfig({
  build: { target: "es2022", chunkSizeWarningLimit: 4096 },
  // Las escenas de los niveles (niveles/*/escena.glb, TU-11)
  assetsInclude: ["**/*.glb"],
  test: { environment: "node" },
});
