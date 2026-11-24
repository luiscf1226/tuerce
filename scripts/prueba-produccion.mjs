// pnpm prueba:produccion — prueba de humo contra el juego publicado, con Chromium sin ventana:
//   1. la portada carga, las físicas corren a su ritmo y la página no tira errores;
//   2. los cinco niveles de la ola 9 cargan y sus físicas corren; en el primero, con el teclado, los dos muñecos
//      caminan (la imagen cambia mucho más que con los dos quietos);
//   3. en línea: dos cuentas de prueba de Clerk entran (o se registran la primera vez), una invita, la otra acepta
//      el código y las dos abren el mismo nivel en línea: quedan en la misma sala con roles opuestos, y cada una ve
//      moverse el muñeco que maneja la otra.
// Guarda tres imágenes en capturas/produccion/.
//
//   pnpm prueba:produccion                         contra https://tuerce.luiscf1226.workers.dev
//   URL_JUEGO=https://… pnpm prueba:produccion     contra otra dirección (una vista previa)
//   SIN_EN_LINEA=1 pnpm prueba:produccion          solo los pasos 1 y 2
//
// Las cuentas son de prueba de Clerk (instancia de desarrollo): los correos con `+clerk_test` no reciben nada y el
// código siempre es 424242. Se registran una sola vez; las corridas siguientes entran con el código.
import { randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = (process.env.URL_JUEGO ?? "https://tuerce.luiscf1226.workers.dev").replace(/\/$/, "");
const SALIDA = "capturas/produccion";
const TAMANO = { width: 1280, height: 720 };
// La GPU de la máquina por OpenGL (sin ventana también anda): con SwiftShader, como en scripts/capturas.mjs, las
// físicas se atrasan si la máquina está ocupada. Sin GPU, Chromium cae a SwiftShader.
const ARGS = ["--use-gl=angle", "--use-angle=gl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const NIVELES_OLA_9 = ["puente", "mina", "minga", "pampa", "medianoche"];
const CORREOS = ["tuerce-prueba-a+clerk_test@example.com", "tuerce-prueba-b+clerk_test@example.com"];
const CODIGO_CLERK = "424242";
const MIN_PASOS = 50;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const revisar = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};
const errores = [];

/** Abre una dirección del juego y espera a que esté lista; los errores de la página se juntan en `errores`. */
async function abrir(contexto, ruta) {
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => errores.push(`${ruta}: ${e.message}`));
  await pagina.goto(`${BASE}${ruta}${ruta.includes("?") ? "&" : "?"}mudo`);
  await pagina.waitForFunction(() => window.__tuerce?.listo === true, null, { timeout: 60_000 });
  const aviso = await pagina
    .locator("pre.error")
    .textContent({ timeout: 100 })
    .catch(() => null);
  revisar(!aviso, `${ruta} mostró un error: ${aviso}`);
  return pagina;
}

/** Las físicas van a su ritmo (60 pasos por segundo). Sin GPU, SwiftShader a veces se atrasa un segundo mientras
 * baja o arma algo: vale la mejor de cinco medidas. */
async function pasosPorSegundo(pagina, nombre) {
  await pagina.waitForFunction(() => (window.__tuerce?.pasosPorSegundo ?? 0) > 0, null, { timeout: 20_000 });
  const medidas = [];
  for (let i = 0; i < 5 && !(Math.max(...medidas) > MIN_PASOS); i++) {
    await dormir(1100);
    medidas.push(await pagina.evaluate(() => window.__tuerce?.pasosPorSegundo ?? 0));
  }
  const mejor = Math.max(...medidas);
  revisar(mejor > MIN_PASOS, `${nombre}: ${medidas.join(", ")} pasos por segundo (menos de ${MIN_PASOS})`);
  return { pasosPorSegundo: mejor, pasosTotales: await pagina.evaluate(() => window.__tuerce?.pasosTotales) };
}

/** La imagen achicada a 64×36, en grises: para comparar cuadros sin que el grano cuente. Sale de una captura de
 * pantalla y no del lienzo: WebGL no conserva lo dibujado entre cuadros, y leerlo desde afuera da negro. */
const imagenChica = async (pagina) => {
  const png = (await pagina.screenshot()).toString("base64");
  return pagina.evaluate(async (datos) => {
    const imagen = new Image();
    imagen.src = `data:image/png;base64,${datos}`;
    await imagen.decode();
    const chico = Object.assign(document.createElement("canvas"), { width: 64, height: 36 });
    const ctx = chico.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(imagen, 0, 0, 64, 36);
    const { data } = ctx.getImageData(0, 0, 64, 36);
    return Array.from({ length: 64 * 36 }, (_, i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3);
  }, png);
};
const diferencia = (a, b) => a.reduce((suma, v, i) => suma + Math.abs(v - (b[i] ?? 0)), 0) / a.length;

/** Entra con Clerk con una cuenta de prueba (código 424242); si la cuenta no existe, la registra. */
async function entrarConClerk(pagina, correo) {
  await pagina.locator("#identifier-field").fill(correo);
  await pagina.getByRole("button", { name: "Continue", exact: true }).click();
  const codigo = pagina.locator('input[autocomplete="one-time-code"]').first();
  const noExiste = pagina.getByText("Couldn't find your account").first();
  await codigo.or(noExiste).waitFor({ timeout: 20_000 });
  if (await noExiste.isVisible()) await registrar(pagina, correo);
  else await escribirCodigo(pagina, codigo);
}

async function escribirCodigo(pagina, campo) {
  await campo.click();
  await pagina.keyboard.type(CODIGO_CLERK, { delay: 50 });
}

/** El registro está en las páginas de Clerk; la contraseña se inventa y se olvida: después se entra con el código. */
async function registrar(pagina, correo) {
  await pagina.getByRole("link", { name: "Sign up" }).click();
  await pagina.waitForURL(/\/sign-up/, { timeout: 30_000 });
  await pagina.locator("input[name=emailAddress]").fill(correo);
  await pagina.locator("input[name=password]").fill(`Tuerce-${randomBytes(18).toString("base64url")}`);
  await pagina.getByRole("button", { name: "Continue", exact: true }).click();
  const codigo = pagina.locator('input[autocomplete="one-time-code"]').first();
  try {
    await codigo.waitFor({ timeout: 45_000 });
  } catch {
    const imagen = join(SALIDA, "bloqueo-clerk.png");
    await pagina.screenshot({ path: imagen });
    const texto = (await pagina.locator("h1, p").allTextContents()).join(" ").replace(/\s+/g, " ").trim();
    const donde = pagina.url().replace(/\?.*/, "");
    throw new Error(`el registro de ${correo} no llegó a pedir el código: ${donde} dice «${texto}» (ver ${imagen})`);
  }
  await escribirCodigo(pagina, codigo);
  // Clerk vuelve solo a la pantalla del juego que pidió entrar
  await pagina.waitForURL((url) => url.href.startsWith(BASE), { timeout: 30_000 });
}

/** Abre `invitar` con una cuenta ya adentro (entra si hace falta) y espera el botón de crear invitación. */
async function invitarConCuenta(contexto, correo) {
  const pagina = await abrir(contexto, "/?escena=invitar");
  const crear = pagina.getByRole("button", { name: "Crear invitación" });
  await crear.or(pagina.locator("#identifier-field")).waitFor({ timeout: 30_000 });
  if (!(await crear.isVisible())) await entrarConClerk(pagina, correo);
  await crear.waitFor({ timeout: 30_000 });
  return pagina;
}

const inicio = Date.now();
let navegador;
try {
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });
  navegador = await chromium.launch({ args: ARGS });
  const contexto = await navegador.newContext({ viewport: TAMANO });
  console.log(`  contra ${BASE}`);

  // 1. La portada
  const portada = await abrir(contexto, "/");
  const enPortada = await pasosPorSegundo(portada, "la portada");
  await portada.getByRole("link", { name: /^(Seguir la )?historia/i }).waitFor({ timeout: 10_000 });
  await portada.screenshot({ path: join(SALIDA, "1-portada.png") });
  await portada.close();
  console.log(`  1. portada: lista, menú a la vista, ${enPortada.pasosPorSegundo} pasos por segundo`);

  // 2. Los niveles de la ola 9: cargan y sus físicas corren. En el primero se juega con el teclado
  for (const nivel of NIVELES_OLA_9) {
    const pagina = await abrir(contexto, `/?escena=nivel&nivel=${nivel}`);
    const { pasosPorSegundo: pps, pasosTotales } = await pasosPorSegundo(pagina, nivel);
    let nota = "";
    if (nivel === NIVELES_OLA_9[0]) {
      await pagina.getByRole("button", { name: "Jugar aquí de a dos" }).click();
      await dormir(1500);
      const quietos = await imagenChica(pagina);
      await dormir(2000);
      const cambioQuietos = diferencia(quietos, await imagenChica(pagina));
      // W para el rojo, ↑ para el turquesa: los dos caminan
      await pagina.keyboard.down("KeyW");
      await pagina.keyboard.down("ArrowUp");
      const antes = await imagenChica(pagina);
      await dormir(2000);
      const cambioAndando = diferencia(antes, await imagenChica(pagina));
      await pagina.screenshot({ path: join(SALIDA, `2-nivel-${nivel}.png`) });
      await pagina.keyboard.up("KeyW");
      await pagina.keyboard.up("ArrowUp");
      revisar(
        cambioAndando > 3 * cambioQuietos + 2,
        `${nivel}: con W y ↑ la imagen cambió ${cambioAndando.toFixed(1)} y quietos ${cambioQuietos.toFixed(1)}`,
      );
      nota = `; con W y ↑ la imagen cambia ${cambioAndando.toFixed(1)} (quietos ${cambioQuietos.toFixed(1)})`;
    }
    await pagina.close();
    console.log(`  2. ${nivel}: listo, ${pps} pasos por segundo (${pasosTotales} pasos)${nota}`);
  }
  await contexto.close();

  // 3. En línea, con dos cuentas en dos navegadores aparte
  if (process.env.SIN_EN_LINEA) console.log("  3. en línea: salteado (SIN_EN_LINEA)");
  else {
    const contextos = await Promise.all(CORREOS.map(() => navegador.newContext({ viewport: TAMANO })));
    const [a, b] = await Promise.all(CORREOS.map((correo, i) => invitarConCuenta(contextos[i], correo)));
    await a.getByRole("button", { name: "Crear invitación" }).click();
    const codigo = (await a.locator(".mia .codigo").textContent({ timeout: 20_000 }))?.trim() ?? "";
    revisar(/^[A-Z0-9]{5}$/.test(codigo), `la invitación no dio un código: «${codigo}»`);
    await b.getByLabel("Código de tu amigo").fill(codigo);
    await b.getByRole("button", { name: "Unirme" }).click();
    for (const pagina of [a, b]) await pagina.locator(".listos").filter({ hasText: "Ya son pareja" }).waitFor();
    console.log(`  3. ${CORREOS[0]} invitó con ${codigo} y ${CORREOS[1]} aceptó: ya son pareja`);

    const nivel = NIVELES_OLA_9[0];
    const [pa, pb] = await Promise.all(
      [a, b].map(async (pagina) => {
        await pagina.goto(`${BASE}/?escena=en-linea&nivel=${nivel}&mudo`);
        await pagina.waitForFunction(() => ["directa", "repetidor"].includes(window.__enLinea?.estado ?? ""), null, {
          timeout: 60_000,
          polling: 100,
        });
        return pagina;
      }),
    );
    const roles = await Promise.all([pa, pb].map((p) => p.evaluate(() => window.__enLinea?.rol)));
    const estados = await Promise.all([pa, pb].map((p) => p.evaluate(() => window.__enLinea?.estado)));
    revisar(roles.includes("anfitrion") && roles.includes("invitado"), `roles en línea: ${roles}`);
    const [anfitrion, invitado] = roles[0] === "anfitrion" ? [pa, pb] : [pb, pa];

    // Cada uno camina con W un rato; el otro tiene que ver moverse ese muñeco (rojo el anfitrión, turquesa el invitado)
    const munecos = (pagina) => pagina.evaluate(() => window.__enLinea?.munecos());
    const veMoverse = async (quien, mira, indice) => {
      const antes = (await munecos(mira))[indice];
      await quien.bringToFront();
      await quien.keyboard.down("KeyW");
      let metros = 0;
      for (const limite = Date.now() + 15_000; metros < 1 && Date.now() < limite; ) {
        await dormir(300);
        const ahora = (await munecos(mira))[indice];
        metros = Math.hypot(ahora.x - antes.x, ahora.z - antes.z);
      }
      await quien.keyboard.up("KeyW");
      return metros;
    };
    const rojo = await veMoverse(anfitrion, invitado, 0);
    revisar(rojo >= 1, `el invitado no vio moverse al muñeco del anfitrión (${rojo.toFixed(2)} m)`);
    const turquesa = await veMoverse(invitado, anfitrion, 1);
    revisar(turquesa >= 1, `el anfitrión no vio moverse al muñeco del invitado (${turquesa.toFixed(2)} m)`);
    await invitado.screenshot({ path: join(SALIDA, "3-en-linea-invitado.png") });
    console.log(
      `  3. en línea (${nivel}): misma sala, ${estados.join(" y ")}, anfitrión y invitado; el invitado vio ` +
        `caminar al rojo ${rojo.toFixed(1)} m y el anfitrión al turquesa ${turquesa.toFixed(1)} m`,
    );
    await Promise.all(contextos.map((c) => c.close()));
  }

  revisar(errores.length === 0, `errores en la página:\n${errores.join("\n")}`);
  console.log(`PASA producción: ${BASE} (${Date.now() - inicio} ms); imágenes en ${SALIDA}/`);
} catch (error) {
  console.log("FALLA producción:", error instanceof Error ? error.message : error);
  if (errores.length) console.log(`errores en la página:\n${errores.join("\n")}`);
  // Cómo quedó cada página abierta, para ver qué pasó
  const abiertas = navegador?.contexts().flatMap((c) => c.pages()) ?? [];
  for (const [i, pagina] of abiertas.entries()) {
    const imagen = join(SALIDA, `falla-${i + 1}.png`);
    await pagina.screenshot({ path: imagen }).catch(() => {});
    console.log(`  ${imagen}: ${pagina.url().replace(/\?.*/, "")}`);
  }
  process.exitCode = 1;
} finally {
  await navegador?.close();
}
