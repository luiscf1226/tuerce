// Muestra la vista previa y las capturas en el pull request: guarda las imágenes en la rama `capturas`
// (así GitHub las puede mostrar aunque el repo sea privado) y deja un solo comentario que se actualiza.
//   node scripts/ci/comentar-pr.mjs [url de la vista previa]
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// SHA es el último commit del PR; GITHUB_SHA en un pull_request es el commit de unión que arma GitHub.
const { PR, GITHUB_REPOSITORY: repo } = process.env;
const sha = process.env.SHA || process.env.GITHUB_SHA || "local";
const vistaPrevia = process.argv[2] || "";
const corto = sha.slice(0, 7);
const correr = (cmd, args, opciones = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opciones }).trim();
const resumen = JSON.parse(readFileSync("capturas/resumen.json", "utf8"));

const RAMA = "capturas";
const carpeta = `pr-${PR}/${corto}`;
const copia = mkdtempSync(join(tmpdir(), "capturas-"));
const git = (...args) => correr("git", ["-C", copia, ...args]);
correr("git", ["config", "--global", "user.name", "github-actions[bot]"]);
correr("git", ["config", "--global", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
const existe = correr("git", ["ls-remote", "--heads", "origin", RAMA]) !== "";
if (existe) {
  correr("git", ["fetch", "--depth=1", "origin", RAMA]);
  correr("git", ["worktree", "add", "-B", RAMA, copia, "FETCH_HEAD"]);
} else {
  correr("git", ["worktree", "add", "--orphan", "-b", RAMA, copia]);
}
cpSync("capturas", join(copia, carpeta), { recursive: true });
git("add", carpeta);
git("commit", "-q", "-m", `capturas de #${PR} en ${corto}`);
// Dos PR pueden guardar capturas al mismo tiempo: si el push choca, traer lo nuevo y volver a intentar.
for (let intento = 1; ; intento++) {
  try {
    git("push", "-q", "origin", RAMA);
    break;
  } catch (error) {
    if (intento === 5 || !existe) throw error;
    git("pull", "-q", "--rebase", "origin", RAMA);
  }
}
rmSync(copia, { recursive: true, force: true });

const archivo = (nombre) => `https://github.com/${repo}/blob/${RAMA}/${carpeta}/${nombre}?raw=true`;
const marca = "<!-- tuerce:vista-previa -->";
const cuerpo = [
  marca,
  `### Vista previa · ${corto}`,
  vistaPrevia
    ? `**Para jugarlo:** ${vistaPrevia}`
    : "_Sin vista previa: faltan las llaves de Cloudflare (docs/ENTORNOS.md)._",
  "",
  ...resumen.tomas.map((t) => `**${t.archivo}** · \`${t.ruta}\`\n\n<img src="${archivo(t.imagen)}" width="640">\n`),
  resumen.video
    ? `**Video** (${resumen.video.segundos} s, ${resumen.video.pasosPorSegundo} pasos de físicas por segundo): [${resumen.video.archivo}](${archivo(resumen.video.archivo)})`
    : "",
].join("\n");

const comentarios = JSON.parse(correr("gh", ["api", `repos/${repo}/issues/${PR}/comments`, "--paginate"]));
const anterior = comentarios.find((c) => c.body.startsWith(marca));
const ruta = anterior ? `repos/${repo}/issues/comments/${anterior.id}` : `repos/${repo}/issues/${PR}/comments`;
correr("gh", ["api", ruta, "-X", anterior ? "PATCH" : "POST", "-F", "body=@-"], { input: cuerpo });
console.log(`comentario ${anterior ? "actualizado" : "creado"} en #${PR}`);
