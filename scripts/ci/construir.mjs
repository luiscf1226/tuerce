// Construye el juego para un entorno. Si hay llave de Convex, primero sube las funciones a ese entorno
// (cada llave apunta a un solo despliegue: «vista-previa» o «produccion») y construye el juego apuntando a él;
// si no, construye con las variables VITE_* que haya.
//   node scripts/ci/construir.mjs vista-previa | produccion
import { execFileSync } from "node:child_process";

const entorno = process.argv[2];
if (entorno !== "vista-previa" && entorno !== "produccion")
  throw new Error("uso: construir.mjs vista-previa|produccion");

const correr = (cmd, args) => execFileSync(cmd, args, { stdio: "inherit" });
const construirJuego = "pnpm --filter tuerce-juego build";

if (process.env.CONVEX_DEPLOY_KEY) {
  correr("pnpm", ["exec", "convex", "deploy", "--cmd", construirJuego, "--cmd-url-env-var-name", "VITE_CONVEX_URL"]);
} else {
  if (!process.env.VITE_CONVEX_URL)
    console.log(`Sin llave de Convex para ${entorno}: el juego se construye sin datos.`);
  correr("pnpm", ["--filter", "tuerce-juego", "build"]);
}
