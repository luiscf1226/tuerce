// pnpm capturas: abre el juego en Chromium sin ventana, recorre las escenas clave, guarda una imagen de cada una
// y un video corto en capturas/. El pull request de cada ola las muestra (ver .github/workflows/revision.yml).
//
//   pnpm capturas                         construye el juego y lo sirve en local
//   CAPTURAS_URL=https://… pnpm capturas  usa una vista previa ya publicada
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

// Para sumar una escena: agregala en apps/juego/src/escenas/index.ts y acá.
// `congelar` corre ese número exacto de pasos de físicas, así la imagen sale igual en cada corrida.
const TOMAS = [
  { archivo: "prueba-inicio", ruta: "/?escena=prueba&congelar=1" },
  { archivo: "prueba-cajas-en-el-suelo", ruta: "/?escena=prueba&congelar=240" },
  // TU-03: el muñeco de pie solo, a media caminata y girando mientras camina (`andar` y `girar` fijan la entrada)
  { archivo: "muneco-de-pie", ruta: "/?escena=muneco&congelar=240" },
  { archivo: "muneco-caminando", ruta: "/?escena=muneco&andar=1&congelar=110" },
  { archivo: "muneco-girando", ruta: "/?escena=muneco&andar=0.7&girar=0.6&congelar=200" },
  // La imagen del juego (TU-10): compararla con docs/arte/11-pinar.jpg
  { archivo: "pinar", ruta: "/?escena=pinar&congelar=1" },
  // La meta de la ola 1: el muñeco caminando en el pinar
  { archivo: "pinar-caminando", ruta: "/?escena=pinar&andar=1&congelar=150" },
  { archivo: "pinar-niebla-corrida", ruta: "/?escena=pinar&congelar=600" },
  // TU-04 y TU-05: un salto en lo más alto, tirado después de saltar de un escalón de 1.5 m, una caja arrastrada
  // con el brazo derecho y colgado de una rama con los dos (`saltar`, `brazos` y `esperar` son el guion)
  { archivo: "agarre-salto", ruta: "/?escena=agarre&salida=claro&saltar=30&congelar=48" },
  { archivo: "agarre-caido", ruta: "/?escena=agarre&salida=borde&andar=1&saltar=22&congelar=240" },
  { archivo: "agarre-caja", ruta: "/?escena=agarre&brazos=d&andar=-1&esperar=40&congelar=110" },
  { archivo: "agarre-colgado", ruta: "/?escena=agarre&salida=rama&brazos=id&saltar=40&congelar=150" },
  // TU-06: frente al escalón de 1.5 m, con los dos brazos arriba, salta, se cuelga y trepa: a mitad y ya arriba
  {
    archivo: "agarre-trepando",
    ruta: "/?escena=agarre&salida=pared&brazos=id&saltar=20&andar=1&esperar=50&congelar=62",
  },
  {
    archivo: "agarre-arriba",
    ruta: "/?escena=agarre&salida=pared&brazos=id&saltar=20&andar=1&esperar=50&congelar=112",
  },
  // TU-08: dos jugadores en el mismo lugar. `j1`/`j2` fijan la entrada de cada uno; `ayuda` deja ver los controles
  { archivo: "dos-de-pie", ruta: "/?escena=dos&j1=&j2=&ayuda&congelar=60" },
  { archivo: "dos-caminando", ruta: "/?escena=dos&j1=andar:1&j2=andar:0.8&congelar=150" },
  // La meta de la ola 2: los dos saltan juntos, y los dos agarran el huacal pesado con un brazo cada uno
  { archivo: "dos-saltando", ruta: "/?escena=dos&j1=saltar@30&j2=saltar@36&congelar=48" },
  { archivo: "dos-agarrando", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&congelar=150" },
  { archivo: "dos-separandose", ruta: "/?escena=dos&j1=andar:1,girar:-0.1&j2=andar:1,girar:0.1&congelar=240" },
];
const VIDEO = { archivo: "dos", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&depurar", segundos: 5 };
const TAMANO = { width: 1280, height: 720 };
const SALIDA = "capturas";
const PUERTO = 4173;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Chromium sin ventana no tiene GPU: SwiftShader dibuja WebGL por software.
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function servirJuego() {
  const build = spawnSync("pnpm", ["--filter", "tuerce-juego", "build"], { stdio: "inherit" });
  if (build.status !== 0) throw new Error("no se pudo construir el juego");
  const vite = spawn(
    "node_modules/.bin/vite",
    ["preview", "--host", "127.0.0.1", "--port", String(PUERTO), "--strictPort"],
    {
      cwd: "apps/juego",
      stdio: "ignore",
    },
  );
  const base = `http://127.0.0.1:${PUERTO}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (i > 100) throw new Error("vite preview no arrancó");
    await dormir(200);
  }
  return {
    base,
    cerrar: () => {
      try {
        vite.kill("SIGTERM");
      } catch {}
    },
  };
}

async function esperarListo(pagina) {
  await pagina.waitForFunction(() => window.__tuerce?.listo === true, null, { timeout: 30_000 });
  const error = await pagina
    .locator(".error")
    .textContent({ timeout: 100 })
    .catch(() => null);
  if (error) throw new Error(`el juego mostró un error: ${error}`);
}

const servidor = process.env.CAPTURAS_URL
  ? { base: process.env.CAPTURAS_URL.replace(/\/$/, ""), cerrar: () => {} }
  : await servirJuego();
const resumen = { base: servidor.base, tomas: [], video: null };
let navegador;
try {
  navegador = await chromium.launch({ args: ARGS });
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });

  const errores = [];
  const contexto = await navegador.newContext({ viewport: TAMANO });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => errores.push(e.message));
  for (const toma of TOMAS) {
    await pagina.goto(servidor.base + toma.ruta);
    await esperarListo(pagina);
    await pagina.screenshot({ path: join(SALIDA, `${toma.archivo}.png`) });
    resumen.tomas.push({ ...toma, imagen: `${toma.archivo}.png` });
    console.log(`  imagen  ${toma.archivo}.png`);
  }
  await contexto.close();

  const carpetaVideo = join(SALIDA, ".video");
  const grabando = await navegador.newContext({ viewport: TAMANO, recordVideo: { dir: carpetaVideo, size: TAMANO } });
  const enVivo = await grabando.newPage();
  enVivo.on("pageerror", (e) => errores.push(e.message));
  await enVivo.goto(servidor.base + VIDEO.ruta);
  await esperarListo(enVivo);
  await dormir(VIDEO.segundos * 1000);
  const estado = await enVivo.evaluate(() => window.__tuerce);
  await grabando.close();
  const [webm] = await readdir(carpetaVideo);
  await rename(join(carpetaVideo, webm), join(SALIDA, `${VIDEO.archivo}.webm`));
  await rm(carpetaVideo, { recursive: true });
  resumen.video = { ...VIDEO, archivo: `${VIDEO.archivo}.webm`, pasosPorSegundo: estado.pasosPorSegundo };
  console.log(`  video   ${VIDEO.archivo}.webm (${estado.pasosPorSegundo} pasos de físicas por segundo)`);

  if (errores.length) throw new Error(`errores en la página:\n${errores.join("\n")}`);
  await writeFile(join(SALIDA, "resumen.json"), `${JSON.stringify(resumen, null, 2)}\n`);
  console.log(`PASA capturas: ${resumen.tomas.length} imágenes y 1 video en ${SALIDA}/`);
} catch (e) {
  console.error("FALLA capturas:", e.message);
  process.exitCode = 1;
} finally {
  await navegador?.close();
  servidor.cerrar();
}
