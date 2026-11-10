// pnpm red:local — para mirar la red a mano (`?escena=red`): firma dos pases para una sala nueva y escribe las dos
// direcciones, una por jugador (abrilas en dos ventanas, o en dos máquinas de la misma red cambiando 127.0.0.1).
// Antes: `pnpm sala:dev` (sala en :8798) y `pnpm --filter tuerce-juego dev` (juego en :5173).
// El secreto sale de workers/sala/.dev.vars (SALA_SECRETO) si existe; si no, levantá la sala con
// `pnpm --filter tuerce-sala exec wrangler dev --port 8798 --var SALA_SECRETO:prueba`.
//
//   pnpm red:local                    directo si se puede
//   pnpm red:local -- --repetidor     simula una red donde lo directo no pasa
import { readFile } from "node:fs/promises";
import { firmarPase } from "../workers/sala/src/pase.ts";

const SALA = process.env.SALA_URL ?? "http://127.0.0.1:8798";
const JUEGO = process.env.JUEGO_URL ?? "http://127.0.0.1:5173";
const vars = await readFile("workers/sala/.dev.vars", "utf8").catch(() => "");
const secreto = process.env.SALA_SECRETO ?? vars.match(/^SALA_SECRETO=(.*)$/m)?.[1]?.trim() ?? "prueba";
const extra = process.argv.includes("--repetidor") ? "&forzar=repetidor" : "";

const sala = `a-mano-${Date.now()}`;
const vence = Date.now() + 60 * 60_000; // una hora: en local no hace falta pedir otro para reconectar
for (const usuario of ["ana", "beto"]) {
  const pase = await firmarPase({ sala, usuario, vence }, secreto);
  console.log(
    `${usuario}: ${JUEGO}/?escena=red&sala=${encodeURIComponent(`${SALA}/sala/${sala}`)}&pase=${pase}${extra}`,
  );
}
