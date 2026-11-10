import { defineConfig } from "vitest/config";

export default defineConfig({
  build: { target: "es2022", chunkSizeWarningLimit: 4096 },
  test: { environment: "node" },
});
