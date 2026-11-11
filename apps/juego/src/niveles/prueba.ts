// Para las pruebas: el .glb de un nivel de niveles/, leído del disco. Vite lo trae como `data:` con sus bytes (el
// juego no tiene los tipos de Node), y `fetch` lo abre igual en Node.
import { parsearGlb } from "./cargar";
import type { PlanoDeNivel } from "./formato";

const ESCENAS = import.meta.glob<string>("../../../../niveles/*/escena.glb", { query: "?inline", import: "default" });

export async function leerDelDisco(carpeta: string): Promise<PlanoDeNivel> {
  const leer = ESCENAS[`../../../../niveles/${carpeta}/escena.glb`];
  if (!leer) throw new Error(`no hay niveles/${carpeta}/escena.glb`);
  return parsearGlb(await (await fetch(await leer())).arrayBuffer());
}
