// Arma lo que se sube a Steam (ver apps/escritorio/README.md).
//
//   node scripts/armar-steam.mjs                     copia lo que empacó `pnpm escritorio:empacar` en esta máquina a
//                                                    steam/contenido/<sistema>/
//   node scripts/armar-steam.mjs --appid 1234560     además escribe steam/listo/*.vdf con la AppID y los depósitos
//                                                    de cada sistema que haya en steam/contenido/
//   --depots windows=N,macos=N,linux=N               los depósitos, si no son AppID+1, +2 y +3
//   --solo-vdf                                       no copia nada: solo escribe los VDF (por ejemplo con las carpetas
//                                                    que bajaste del workflow «escritorio»)
//   --desc "texto"                                   la descripción de la build que se ve en Steamworks
//
// Cada sistema se empaca en su propio sistema (Tauri no cruza): Linux en Linux, Windows en Windows, macOS en macOS.
// El workflow .github/workflows/escritorio.yml lo hace en las tres máquinas y deja cada carpeta como artefacto.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const lanzamiento = join(raiz, "src-tauri", "target", "release");
const steam = join(raiz, "steam");
const contenido = join(steam, "contenido");
const SISTEMAS = ["windows", "macos", "linux"];

const { values: op } = parseArgs({
  options: {
    appid: { type: "string" },
    depots: { type: "string" },
    desc: { type: "string" },
    "solo-vdf": { type: "boolean", default: false },
  },
});

const sistemaActual = { linux: "linux", win32: "windows", darwin: "macos" }[process.platform];

function archivoQueTermina(carpeta, final) {
  if (!existsSync(carpeta)) return undefined;
  const nombre = readdirSync(carpeta).find((n) => n.endsWith(final));
  return nombre ? join(carpeta, nombre) : undefined;
}

function falta(que) {
  console.error(`No encuentro ${que}. Primero: pnpm escritorio:empacar`);
  process.exit(1);
}

/** Copia lo que empacó Tauri a steam/contenido/<sistema>/, listo para el depósito de ese sistema. */
function armar(sistema) {
  const destino = join(contenido, sistema);
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(destino, { recursive: true });

  if (sistema === "windows") {
    // Tauri mete el juego entero (y el cargador de WebView2) dentro del .exe.
    const exe = join(lanzamiento, "tuerce.exe");
    if (!existsSync(exe)) falta(exe);
    cpSync(exe, join(destino, "tuerce.exe"));
  } else if (sistema === "macos") {
    const app = join(lanzamiento, "bundle", "macos", "Tuerce.app");
    if (!existsSync(app)) falta(app);
    cpSync(app, join(destino, "Tuerce.app"), { recursive: true, verbatimSymlinks: true });
  } else {
    // El AppImage trae WebKitGTK y GStreamer adentro, así no depende de lo que tenga instalado cada Linux (ni del
    // Steam Linux Runtime, que no trae WebKitGTK). Se sube ya abierto: dentro del contenedor de Steam no siempre
    // hay FUSE para montarlo. Steam lo lanza con `AppRun`.
    const appimage = archivoQueTermina(join(lanzamiento, "bundle", "appimage"), ".AppImage");
    if (!appimage) falta("el .AppImage en src-tauri/target/release/bundle/appimage/");
    const temporal = mkdtempSync(join(tmpdir(), "tuerce-appimage-"));
    chmodSync(appimage, 0o755);
    execFileSync(appimage, ["--appimage-extract"], { cwd: temporal, stdio: "ignore" });
    cpSync(join(temporal, "squashfs-root"), destino, { recursive: true, verbatimSymlinks: true });
    rmSync(temporal, { recursive: true, force: true });
  }
  console.log(`Listo ${sistema}: ${destino}`);
}

/** Escribe steam/listo/ con la AppID y los depósitos puestos, para los sistemas que ya tienen carpeta. */
function escribirVdf(appid) {
  if (!/^\d+$/.test(appid)) {
    console.error(`La AppID tiene que ser un número (llegó «${appid}»)`);
    process.exit(1);
  }
  const depots = Object.fromEntries(SISTEMAS.map((s, i) => [s, String(Number(appid) + i + 1)]));
  for (const par of (op.depots ?? "").split(",").filter(Boolean)) {
    const [sistema, id] = par.split("=");
    if (!sistema || !(sistema in depots) || !id || !/^\d+$/.test(id)) {
      console.error(`--depots: «${par}» no es sistema=número (sistemas: ${SISTEMAS.join(", ")})`);
      process.exit(1);
    }
    depots[sistema] = id;
  }

  const presentes = SISTEMAS.filter((s) => existsSync(join(contenido, s)) && readdirSync(join(contenido, s)).length);
  if (!presentes.length) {
    console.error("steam/contenido/ está vacío: no hay nada que subir.");
    process.exit(1);
  }

  const listo = join(steam, "listo");
  rmSync(listo, { recursive: true, force: true });
  mkdirSync(listo, { recursive: true });
  const leer = (n) => readFileSync(join(steam, "plantillas", n), "utf8");
  const version = JSON.parse(readFileSync(join(raiz, "src-tauri", "tauri.conf.json"), "utf8")).version;
  const lineas = presentes.map((s) => `\t\t"${depots[s]}" "depot_build_${s}.vdf"`).join("\n");
  writeFileSync(
    join(listo, "app_build.vdf"),
    leer("app_build.vdf")
      .replace("@APPID@", appid)
      .replace("@DESCRIPCION@", op.desc ?? `Tuerce ${version}`)
      .replace("@DEPOTS@", lineas),
  );
  for (const s of presentes) {
    const depot = leer(`depot_build_${s}.vdf`).replace(`@DEPOT_${s.toUpperCase()}@`, depots[s] ?? "");
    writeFileSync(join(listo, `depot_build_${s}.vdf`), depot);
  }
  console.log(`\nVDF listos en ${listo} (${presentes.map((s) => `${s}=${depots[s]}`).join(", ")}). Para subir:`);
  console.log(`  steamcmd +login <tu-usuario> +run_app_build "${join(listo, "app_build.vdf")}" +quit`);
}

if (!op["solo-vdf"]) {
  if (!sistemaActual) {
    console.error(`No sé empacar en ${process.platform}`);
    process.exit(1);
  }
  armar(sistemaActual);
}
if (op.appid) escribirVdf(op.appid);
else if (op["solo-vdf"]) console.error("--solo-vdf necesita --appid");
