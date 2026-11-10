// Los módulos de funciones que carga convex-test: todo convex/ menos pruebas, tipos y configuración
// (los nombres con dos puntos, que Convex tampoco sube).
export const modulos = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.*.ts"]);

// Vite (y por lo tanto Vitest) arma la lista con import.meta.glob.
declare global {
  interface ImportMeta {
    glob(patrones: string | string[]): Record<string, () => Promise<unknown>>;
  }
}
