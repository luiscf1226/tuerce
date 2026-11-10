// pnpm prueba:red — la red de verdad, con dos Chromium sin ventana (TU-20):
//   a) los dos llegan a «directa» y se mandan mensajes de ida y vuelta por los dos canales; el ping mide;
//   b) si lo directo se cae a media partida pasan al repetidor sin dejar de hablarse, y vuelven a lo directo;
//   c) con lo directo imposible (`?forzar=repetidor`: no se cruzan candidatos ICE) los dos quedan en «repetidor»
//      y se siguen mandando mensajes por la sala;
//   d) si uno cierra la página, el otro ve «se_fue».
// Levanta `wrangler dev` de la sala con un secreto de prueba, sirve el juego con Vite y firma sus propios pases.
import { spawn, spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { firmarPase } from "../workers/sala/src/pase.ts";

const PUERTO_SALA = 8799;
const PUERTO_JUEGO = 5179;
const SECRETO = "prueba-red";
const SALA = `http://127.0.0.1:${PUERTO_SALA}`;
const JUEGO = `http://127.0.0.1:${PUERTO_JUEGO}`;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const procesos = [];
const levantar = (comando, args, cwd) => {
  const p = spawn(comando, args, { cwd, stdio: "ignore", detached: true });
  procesos.push(p);
  return p;
};
const apagar = () => {
  for (const p of procesos)
    try {
      process.kill(-p.pid, "SIGKILL");
    } catch {}
};
const esperarServidor = async (url, nombre) => {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    if (i > 150) throw new Error(`${nombre} no arrancó`);
    await dormir(200);
  }
};

let corrida = 0;
/** Dos direcciones (una por jugador) para una sala nueva: las salas recuerdan a su pareja. */
const pareja = async (extra = "") => {
  const sala = `red-${Date.now()}-${corrida++}`;
  const vence = Date.now() + 10 * 60_000;
  const direccion = async (usuario) => {
    const pase = await firmarPase({ sala, usuario, vence }, SECRETO);
    const urlSala = encodeURIComponent(`${SALA}/sala/${sala}`);
    return `${JUEGO}/?escena=red&sala=${urlSala}&pase=${pase}${extra}`;
  };
  return [await direccion("ana"), await direccion("beto")];
};

const estado = (pagina) => pagina.evaluate(() => window.__red?.estado);
const esperarEstado = async (pagina, buscado, ms = 15_000) => {
  try {
    await pagina.waitForFunction((e) => window.__red?.estado === e, buscado, { timeout: ms, polling: 50 });
  } catch {
    const visto = await pagina.evaluate(() => window.__red?.estados);
    throw new Error(`no llegó a «${buscado}»; pasó por ${JSON.stringify(visto)}`);
  }
};
const enviar = (pagina, datos, fiable, binario = false) =>
  pagina.evaluate(([d, f, b]) => window.__red?.enviar(d, f, b), [datos, fiable, binario]);
/** Espera a que `pagina` reciba `datos`; devuelve por dónde llegó. */
const esperarMensaje = async (pagina, datos, ms = 5000) => {
  try {
    const via = await pagina.waitForFunction((d) => window.__red?.recibidos.find((r) => r.datos === d)?.via, datos, {
      timeout: ms,
      polling: 20,
    });
    return await via.jsonValue();
  } catch {
    const recibidos = await pagina.evaluate(() => window.__red?.recibidos);
    throw new Error(`no llegó «${datos}»; llegaron ${JSON.stringify(recibidos)}`);
  }
};
/** Ida y vuelta de los dos lados por los dos canales (texto y binario). Devuelve las vías vistas. */
const cruzar = async (a, b, etiqueta) => {
  const vias = new Set();
  for (const [de, para, quien] of [
    [a, b, "a"],
    [b, a, "b"],
  ]) {
    for (const fiable of [true, false]) {
      // El canal rápido puede perder alguno: se manda de nuevo hasta que llegue.
      const texto = `${etiqueta}-${quien}-${fiable ? "fiable" : "rapido"}`;
      const binario = `${texto}-bin`;
      for (let intento = 0; ; intento++) {
        await enviar(de, texto, fiable);
        await enviar(de, binario, fiable, true);
        try {
          vias.add(await esperarMensaje(para, texto, fiable ? 5000 : 1000));
          vias.add(await esperarMensaje(para, binario, fiable ? 5000 : 1000));
          break;
        } catch (e) {
          if (fiable || intento >= 5) throw e;
        }
      }
    }
  }
  return vias;
};
const revisar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

// `pnpm test` corre esta prueba también en la revisión automática, que no siempre trae Chromium: si falta, se baja.
async function lanzarChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (!/Executable doesn't exist/.test(String(error))) throw error;
    console.log("  falta Chromium de Playwright: se baja una vez (pnpm exec playwright install chromium)");
    const bajada = spawnSync("pnpm", ["exec", "playwright", "install", "chromium"], { stdio: "inherit" });
    if (bajada.status !== 0) throw new Error("no se pudo bajar Chromium");
    return await chromium.launch();
  }
}

const inicio = Date.now();
let navegador;
try {
  levantar(
    "pnpm",
    ["exec", "wrangler", "dev", "--port", String(PUERTO_SALA), "--var", `SALA_SECRETO:${SECRETO}`],
    "workers/sala",
  );
  levantar(
    "node_modules/.bin/vite",
    ["--host", "127.0.0.1", "--port", String(PUERTO_JUEGO), "--strictPort"],
    "apps/juego",
  );
  await Promise.all([esperarServidor(`${SALA}/`, "wrangler dev"), esperarServidor(JUEGO, "vite")]);
  navegador = await lanzarChromium();
  const abrir = async (url) => {
    const pagina = await (await navegador.newContext()).newPage();
    pagina.on("pageerror", (e) => console.log("error en la página:", e.message));
    await pagina.goto(url);
    return pagina;
  };

  // a) Directo: los dos llegan a «directa» y se hablan por los dos canales.
  const [urlA, urlB] = await pareja("&reintentar=1000");
  const a = await abrir(urlA);
  await a.waitForFunction(() => window.__red?.rol, null, { timeout: 30_000 });
  const b = await abrir(urlB);
  await Promise.all([esperarEstado(a, "directa"), esperarEstado(b, "directa")]);
  revisar((await a.evaluate(() => window.__red?.rol)) === "anfitrion", "el primero no es el anfitrión");
  revisar((await b.evaluate(() => window.__red?.rol)) === "invitado", "el segundo no es el invitado");
  const viasDirectas = await cruzar(a, b, "directo");
  revisar(
    viasDirectas.has("fiable") && viasDirectas.has("rapido") && !viasDirectas.has("repetidor"),
    `lo directo no usó los dos canales: ${[...viasDirectas]}`,
  );
  await a.waitForFunction(() => (window.__red?.ida ?? 0) > 0, null, { timeout: 5000 });
  const ida = await a.evaluate(() => window.__red?.ida);
  console.log(`  a) directa en los dos, mensajes por fiable y rápido, ping ${ida} ms`);

  // b) Lo directo se cae a media partida: los dos siguen por la sala y después vuelven a lo directo.
  await a.evaluate(() => window.__red?.cortarDirecta());
  await Promise.all([esperarEstado(a, "repetidor", 5000), esperarEstado(b, "repetidor", 5000)]);
  const viasCaida = await cruzar(a, b, "caida");
  revisar(viasCaida.has("repetidor"), `después de la caída no pasó por la sala: ${[...viasCaida]}`);
  await Promise.all([esperarEstado(a, "directa"), esperarEstado(b, "directa")]);
  await cruzar(a, b, "de-vuelta");
  console.log("  b) se cortó lo directo: siguieron por la sala y volvieron a lo directo");

  // d) Uno cierra la página: el otro ve «se_fue».
  await a.close();
  await esperarEstado(b, "se_fue", 5000);
  await b.close();
  console.log("  d) al cerrar una página, la otra ve «se_fue»");

  // c) Lo directo imposible: los dos quedan en el repetidor y se siguen hablando.
  const [urlC, urlD] = await pareja("&forzar=repetidor&espera=2000");
  const c = await abrir(urlC);
  await c.waitForFunction(() => window.__red?.rol, null, { timeout: 30_000 });
  const d = await abrir(urlD);
  await Promise.all([esperarEstado(c, "repetidor"), esperarEstado(d, "repetidor")]);
  const viasRepetidor = await cruzar(c, d, "repetidor");
  revisar(
    viasRepetidor.size === 1 && viasRepetidor.has("repetidor"),
    `en el repetidor algo fue directo: ${[...viasRepetidor]}`,
  );
  const estados = await c.evaluate(() => window.__red?.estados);
  revisar(!estados?.includes("directa"), `con lo directo forzado llegó a «directa»: ${estados}`);
  await c.waitForFunction(() => (window.__red?.ida ?? 0) > 0, null, { timeout: 5000 });
  console.log(
    `  c) sin directo los dos quedan en el repetidor y se hablan; ping ${await c.evaluate(() => window.__red?.ida)} ms`,
  );
  revisar((await estado(d)) === "repetidor", "el invitado dejó el repetidor");

  console.log(`PASA red: directa, caída al repetidor y vuelta, repetidor forzado y se_fue (${Date.now() - inicio} ms)`);
  await navegador.close();
  apagar();
  process.exit(0);
} catch (error) {
  console.log("FALLA red:", error instanceof Error ? error.message : error);
  await navegador?.close().catch(() => {});
  apagar();
  process.exit(1);
}
