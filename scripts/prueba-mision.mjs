// pnpm prueba:mision — juega el tutorial («Cómo jugar») de punta a punta en Chromium sin ventana, como lo haría
// una pareja nueva: entra a la portada, aprieta «Cómo jugar», cumple las seis lecciones (caminar, saltar, agarrar,
// juntar el cacao, llevar el cántaro entre los dos y festejar), espera el «¡Ya saben jugar!» y aprieta «Empezar la
// historia», que abre El patio con su misión. Lo hace dos veces:
//
//   escritorio  1280×720, los dos jugadores en el mismo teclado (W A S D … y las flechas)
//   móvil       un Pixel 7 con los controles táctiles: dedos de verdad (eventos de toque de Chromium, varios a la vez)
//
// Maneja a los muñecos mirando `window.__tuerce.jugadores` (dónde está cada uno y hacia dónde mira) y la misión en
// `window.__tuerce.mision`. Falla si algo queda trabado o si la página tira un error en la consola. Guarda imágenes
// en capturas/mision/.
//
//   pnpm prueba:mision                              contra `pnpm dev` (http://localhost:5173)
//   URL_JUEGO=https://… pnpm prueba:mision          contra otra dirección (una vista previa, producción)
//   SOLO=movil pnpm prueba:mision                   uno solo (escritorio o movil)
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, devices } from "playwright";

const BASE = (process.env.URL_JUEGO ?? "http://localhost:5173").replace(/\/$/, "");
const SALIDA = "capturas/mision";
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const envolver = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const limitar = (v) => Math.max(-1, Math.min(1, v));

// ── Las manos: teclado o dedos ─────────────────────────────────────────────────────────────────────────────
const QUIETO = { avanzar: 0, girar: 0, agarrar: false, saltar: false, gesto: false };

/** Los dos jugadores en el teclado: suelta y aprieta solo lo que cambió. */
function manosDeTeclado(pagina) {
  const TECLAS = [
    {
      adelante: "KeyW",
      atras: "KeyS",
      izquierda: "KeyA",
      derecha: "KeyD",
      saltar: "Space",
      brazos: ["KeyQ", "KeyE"],
      gesto: "KeyX",
    },
    {
      adelante: "ArrowUp",
      atras: "ArrowDown",
      izquierda: "ArrowLeft",
      derecha: "ArrowRight",
      saltar: "Enter",
      brazos: ["Comma", "Period"],
      gesto: "ShiftRight",
    },
  ];
  const apretadas = new Set();
  return {
    async poner(entradas) {
      const quiero = new Set();
      entradas.forEach((e, j) => {
        const t = TECLAS[j];
        if (e.gesto) quiero.add(t.gesto).add(t.adelante);
        else {
          if (e.avanzar > 0.3) quiero.add(t.adelante);
          if (e.avanzar < -0.3) quiero.add(t.atras);
          if (e.girar > 0.3) quiero.add(t.izquierda);
          if (e.girar < -0.3) quiero.add(t.derecha);
        }
        if (e.saltar) quiero.add(t.saltar);
        if (e.agarrar) for (const b of t.brazos) quiero.add(b);
      });
      for (const k of [...apretadas])
        if (!quiero.has(k)) {
          await pagina.keyboard.up(k);
          apretadas.delete(k);
        }
      for (const k of quiero)
        if (!apretadas.has(k)) {
          await pagina.keyboard.down(k);
          apretadas.add(k);
        }
    },
  };
}

/** Los dos jugadores con los dedos: la palanca de cada mitad y sus botones, con toques de verdad (varios a la vez). */
async function manosTactiles(pagina) {
  const cdp = await pagina.context().newCDPSession(pagina);
  const lugares = await pagina.evaluate(() =>
    [0, 1].map((j) => {
      const zona = document.querySelector(`.tactil-lado[data-jugador="${j}"]`);
      const base = zona.querySelector(".tactil-base").getBoundingClientRect();
      const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      const botones = Object.fromEntries(
        [...zona.querySelectorAll(".tactil-boton")].map((b) => [b.dataset.boton, centro(b.getBoundingClientRect())]),
      );
      return { palanca: centro(base), botones };
    }),
  );
  const RADIO = 56;
  /** Los dedos apoyados: id → {x, y}. */
  const dedos = new Map();
  const mandar = async (tipo) => {
    const touchPoints = [...dedos].map(([id, p]) => ({ id, x: Math.round(p.x), y: Math.round(p.y) }));
    await cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints });
  };
  const apoyar = async (id, p) => {
    dedos.set(id, p);
    await mandar("touchStart");
  };
  const mover = async (id, p) => {
    dedos.set(id, p);
    await mandar("touchMove");
  };
  // Chromium suelta los dedos que faltan en la lista: con otros apoyados va un touchMove; touchEnd, sin ninguno
  const levantar = async (id) => {
    dedos.delete(id);
    await mandar(dedos.size > 0 ? "touchMove" : "touchEnd");
  };
  return {
    async poner(entradas) {
      for (const [j, e] of entradas.entries()) {
        const l = lugares[j];
        // La palanca: dedo 10 + j
        const palanca = 10 + j;
        // Como un dedo apurado: la palanca a tope hacia donde va (adelante, a un lado o en diagonal)
        const a = Math.abs(e.avanzar) > 0.3 ? Math.sign(e.avanzar) : 0;
        const g = Math.abs(e.girar) > 0.3 ? Math.sign(e.girar) : 0;
        const quiere = !e.gesto && (a !== 0 || g !== 0);
        if (quiere) {
          const p = { x: l.palanca.x - g * RADIO, y: l.palanca.y - a * RADIO };
          if (!dedos.has(palanca)) await apoyar(palanca, l.palanca);
          await mover(palanca, p);
        } else if (dedos.has(palanca)) await levantar(palanca);
        // Los botones: dedos 20 + j…
        for (const [n, boton] of ["agarrar", "saltar", "gesto"].entries()) {
          const id = 20 + j * 3 + n;
          if (e[boton] && !dedos.has(id)) await apoyar(id, l.botones[boton]);
          if (!e[boton] && dedos.has(id)) await levantar(id);
        }
      }
    },
  };
}

// ── Manejar a los muñecos ──────────────────────────────────────────────────────────────────────────────────
const estado = (pagina) =>
  pagina.evaluate(() => ({
    mision: window.__tuerce.mision,
    jugadores: window.__tuerce.jugadores,
    pendientes: window.__tuerce.pendientes ?? [],
    pasos: window.__tuerce.pasosTotales,
  }));
/** Cada cuántos pasos de físicas se corrige el rumbo. Se cuenta en pasos y no en milisegundos: sin tarjeta de video
 * (Chromium con SwiftShader, sobre todo en la pantalla grande de un teléfono) las físicas pueden ir más lentas que
 * el reloj, y un conductor apurado se pasa de largo. */
const PASOS_POR_DECISION = 5;

/** Qué pedir para ir hacia `meta` (x, z): girar hacia ella y caminar cuando más o menos se mira hacia allá. */
function hacia(jugador, meta, { cerca = 0.35, lento = false } = {}) {
  const dx = meta.x - jugador.x;
  const dz = meta.z - jugador.z;
  const distancia = Math.hypot(dx, dz);
  if (distancia < cerca) return { ...QUIETO, llego: true };
  const error = envolver(Math.atan2(dx, dz) - jugador.rumbo);
  const girar = limitar(error * 2.5);
  // Cerca, despacio y solo si mira hacia allá: si no, da vueltas alrededor sin llegar
  const avanzar = distancia < 0.8 ? (Math.abs(error) < 0.35 ? 0.45 : 0) : Math.abs(error) < 0.6 ? (lento ? 0.6 : 1) : 0;
  return { ...QUIETO, girar, avanzar, llego: false };
}

/** Repite `paso` (que devuelve lo que pide cada jugador) hasta que la misión pase de `objetivo` o se acabe el tiempo. */
async function hastaQuePase(pagina, manos, objetivo, paso, segundos = 120) {
  const fin = Date.now() + segundos * 1000;
  let ultimo;
  while (Date.now() < fin) {
    ultimo = await estado(pagina);
    if (ultimo.mision.actual !== objetivo) {
      await manos.poner([QUIETO, QUIETO]);
      return;
    }
    await manos.poner(paso(ultimo));
    const hasta = ultimo.pasos + PASOS_POR_DECISION;
    await pagina
      .waitForFunction((n) => window.__tuerce.pasosTotales >= n, hasta, { timeout: 5000, polling: 16 })
      .catch(() => {});
    if (process.env.DEPURAR)
      console.log(
        JSON.stringify(ultimo.jugadores.map((j) => [j.x.toFixed(2), j.z.toFixed(2), j.rumbo.toFixed(2), j.manos])),
      );
  }
  await manos.poner([QUIETO, QUIETO]);
  throw new Error(`La lección «${objetivo}» no se cumplió en ${segundos} s: ${JSON.stringify(ultimo)}`);
}

async function jugarElTutorial(pagina, manos, foto) {
  const espera = async (id) => {
    await pagina.waitForFunction((id) => window.__tuerce?.mision?.actual === id, id, { timeout: 20_000 });
  };
  await espera("caminar");
  await foto("1-caminar");
  await hastaQuePase(pagina, manos, "caminar", () => [
    { ...QUIETO, avanzar: 1 },
    { ...QUIETO, avanzar: 1 },
  ]);
  console.log("  ✓ caminar");

  let vuelta = 0;
  await hastaQuePase(pagina, manos, "saltar", () => {
    const salta = vuelta++ % 6 < 2;
    return [
      { ...QUIETO, saltar: salta },
      { ...QUIETO, saltar: salta },
    ];
  });
  console.log("  ✓ saltar");

  // Agarrar: se acercan el uno al otro y alzan los brazos al estar cerca (las cajas ruedan: no tienen lugar fijo)
  await foto("2-agarrar");
  await hastaQuePase(
    pagina,
    manos,
    "agarrar",
    ({ jugadores }) =>
      jugadores.map((j, i) => {
        const otro = jugadores[1 - i];
        const h = hacia(j, otro, { cerca: 0.05, lento: true });
        return { ...h, avanzar: j.manos > 0 ? 0 : h.avanzar, agarrar: Math.hypot(otro.x - j.x, otro.z - j.z) < 1.3 };
      }),
    180,
  );
  console.log("  ✓ agarrar");

  // El cacao: cada uno va a la mazorca que le queda más cerca (y no a la misma que el otro)
  await foto("3-cacao");
  await hastaQuePase(
    pagina,
    manos,
    "cacao",
    ({ jugadores, pendientes }) => {
      const lejos = (j, p) => Math.hypot(p.x - j.x, p.z - j.z);
      const elegidas = [];
      return jugadores.map((j) => {
        const libres = pendientes.filter((p) => !elegidas.includes(p));
        const meta = (libres.length ? libres : pendientes).sort((a, b) => lejos(j, a) - lejos(j, b))[0];
        if (!meta) return QUIETO;
        elegidas.push(meta);
        return hacia(j, meta, { cerca: 0.1 });
      });
    },
    300,
  );
  console.log("  ✓ cacao");

  // El cántaro: cada uno a su lado del tocón, mirando hacia el círculo, y adelante juntos con los brazos arriba
  // Por detrás, sin pasar al lado del tocón
  const lados = [0.5, -0.5].map((z) => [
    { x: -0.9, z: Math.sign(z) * 1.7 },
    { x: -0.9, z },
    { x: 0, z },
  ]);
  const tramo = [0, 0];
  const derechos = [false, false];
  let listos = false;
  await hastaQuePase(
    pagina,
    manos,
    "cantaro",
    ({ jugadores }) => {
      if (!listos) {
        const pide = jugadores.map((j, i) => {
          // Primero los tramos del camino; ya en su lugar (tramo = largo), que mire hacia +x
          if (tramo[i] < lados[i].length) {
            const ultimo = tramo[i] === lados[i].length - 1;
            const h = hacia(j, lados[i][tramo[i]], { cerca: ultimo ? 0.25 : 0.35, lento: ultimo });
            if (h.llego) tramo[i]++;
            return { ...h, llego: false };
          }
          // Con el teclado el giro es todo o nada: cerca del rumbo, toques cortos para no pasarse. Ya derecho, espera
          // quieto al otro
          if (derechos[i]) return { ...QUIETO, llego: true };
          const error = envolver(Math.PI / 2 - j.rumbo);
          const derecho = Math.abs(error) <= 0.2;
          derechos[i] = derecho;
          const toque = Math.abs(error) > 0.6 || vuelta % 3 === 0;
          return { ...QUIETO, girar: derecho || !toque ? 0 : Math.sign(error), llego: derecho };
        });
        vuelta++;
        if (pide.every((p) => p.llego)) listos = true;
        return pide;
      }
      return jugadores.map(() => ({ ...QUIETO, avanzar: 0.6, agarrar: true }));
    },
    300,
  );
  console.log("  ✓ cántaro");
  await foto("4-cantaro");

  await hastaQuePase(pagina, manos, "festejar", () => [
    { ...QUIETO, gesto: true },
    { ...QUIETO, gesto: true },
  ]);
  console.log("  ✓ festejar");
}

async function probar(navegador, nombre, opciones) {
  console.log(`· ${nombre}`);
  const contexto = await navegador.newContext(opciones);
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(`error: ${e.message}`));
  pagina.on("console", (m) => {
    if (m.type() === "error") errores.push(`consola: ${m.text()}`);
  });
  pagina.on("response", (r) => {
    if (r.status() >= 400) errores.push(`${r.status()} ${r.url()}`);
  });
  pagina.on("framenavigated", (f) => {
    if (f === pagina.mainFrame()) console.log(`  (abre ${f.url().replace(BASE, "")})`);
  });
  const foto = (que) => pagina.screenshot({ path: join(SALIDA, `${nombre}-${que}.png`) });

  // La portada: «Cómo jugar» es lo primero que se ve
  await pagina.goto(`${BASE}/`);
  await pagina.waitForFunction(() => window.__tuerce?.listo === true, null, { timeout: 60_000 });
  await dormir(1500);
  await foto("0-portada");
  const tutorial = pagina.locator("[data-tutorial]");
  await tutorial.waitFor({ state: "visible" });
  await tutorial.click();
  await pagina.waitForFunction(() => window.__tuerce?.escena === "tutorial" && window.__tuerce?.listo, null, {
    timeout: 60_000,
  });
  await dormir(800);

  const manos = opciones.hasTouch ? await manosTactiles(pagina) : manosDeTeclado(pagina);
  if (opciones.hasTouch) {
    const visibles = await pagina.locator(".tactil-lado").count();
    if (visibles !== 2) throw new Error("En el teléfono no aparecieron los controles táctiles");
  }
  const inicio = Date.now();
  await jugarElTutorial(pagina, manos, foto).catch(async (e) => {
    await foto("fallo");
    throw e;
  });

  // El final: «¡Ya saben jugar!» y a la historia
  const empezar = pagina.getByText("Empezar la historia");
  await empezar.waitFor({ state: "visible", timeout: 20_000 });
  await foto("5-listos");
  console.log(`  tutorial completo en ${Math.round((Date.now() - inicio) / 1000)} s`);
  await empezar.click();
  await pagina.waitForFunction(() => window.__tuerce?.escena === "nivel" && window.__tuerce?.listo, null, {
    timeout: 90_000,
  });
  await dormir(2000);
  await foto("6-patio");
  const mision = await pagina.evaluate(() => window.__tuerce.mision);
  if (!mision || mision.terminada) throw new Error(`El patio no abrió con su misión: ${JSON.stringify(mision)}`);
  console.log(`  ✓ El patio abre con su misión (${mision.total} objetivos, va «${mision.actual}»)`);

  await contexto.close();
  if (errores.length) throw new Error(`${nombre}: la página tuvo errores:\n${errores.join("\n")}`);
}

await mkdir(SALIDA, { recursive: true });
const navegador = await chromium.launch({ args: ARGS });
try {
  const solo = process.env.SOLO;
  if (!solo || solo === "escritorio") await probar(navegador, "escritorio", { viewport: { width: 1280, height: 720 } });
  if (!solo || solo === "movil") await probar(navegador, "movil", devices["Pixel 7"]);
  console.log("Listo: el tutorial se completa de punta a punta.");
} finally {
  await navegador.close();
}
