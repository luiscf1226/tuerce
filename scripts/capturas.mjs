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
  // TU-07: los dos cargan el huacal de 8 kg en el aire, y se dan la mano y el rojo se lleva al turquesa
  { archivo: "dos-cargando", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&congelar=210" },
  { archivo: "mano-llevando", ruta: "/?escena=mano&llevar&congelar=150" },
  { archivo: "dos-separandose", ruta: "/?escena=dos&j1=andar:1,girar:-0.1&j2=andar:1,girar:0.1&congelar=240" },
  // TU-09: la cámara de los dos. Lejos, la pantalla se parte con una costura perpendicular a la recta entre los dos
  { archivo: "dos-pantalla-partida", ruta: "/?escena=dos&j1=andar:1,girar:-0.3&j2=andar:-1,girar:-0.3&congelar=300" },
  // TU-15: el menú de inicio sobre la escena viva (`menu` lo muestra aunque la entrada sea fija), los dos
  // señalando (la marca del turquesa queda en el tronco caído), y uno encogiéndose de hombros mientras el otro festeja
  { archivo: "dos-menu", ruta: "/?escena=dos&j1=&j2=&menu&congelar=60" },
  { archivo: "dos-senalando", ruta: "/?escena=dos&j1=senalar,girar:-0.3&j2=senalar,girar:0.3&congelar=90" },
  { archivo: "dos-festejando", ruta: "/?escena=dos&j1=gesto:encoger&j2=gesto:festejar&congelar=80" },
  // TU-11: el nivel de prueba, armado con el formato nuevo (niveles/99-prueba): entero desde lejos y la salida. El
  // turquesa se cae del patio y reaparece junto al rojo; retomando desde el punto 1 la compuerta ya está hundida
  { archivo: "nivel-entero", ruta: "/?escena=nivel&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "nivel-salida", ruta: "/?escena=nivel&j1=&j2=&congelar=60" },
  { archivo: "nivel-cayendo", ruta: "/?escena=nivel&j1=&j2=andar:1,girar:-0.15&congelar=268" },
  { archivo: "nivel-reaparece", ruta: "/?escena=nivel&j1=&j2=andar:1,girar:-0.15&congelar=330" },
  { archivo: "nivel-compuerta", ruta: "/?escena=nivel&punto=1&j1=andar:1&j2=andar:1&congelar=150" },
  // TU-32: el contrarreloj. El reloj corriendo arriba (arranca cuando se mueven: 2,5 s), la llegada a la meta desde
  // el punto 2 (en el mismo lugar, sin tabla) y la tabla de parejas con datos de mentira (sin cuenta ni red)
  { archivo: "contrarreloj-corriendo", ruta: "/?escena=nivel&contrarreloj&j1=andar:1&j2=andar:1&congelar=150" },
  { archivo: "contrarreloj-llegada", ruta: "/?escena=nivel&contrarreloj&punto=2&j1=andar:1&j2=andar:1&congelar=215" },
  { archivo: "contrarreloj-tabla", ruta: "/?escena=tabla&nivel=prueba&ejemplo" },
  // TU-29: el ropero. Los dos con lo del principio (el rojo con su sombrero, el turquesa con sus trenzas) y el panel
  // para elegir; una cuenta de ejemplo con lo ganado y los logros; las dos vitrinas con todas las prendas; los dos
  // con prendas ganadas en el nivel; y el turquesa que encuentra el secreto del nivel de prueba detrás de la meta
  { archivo: "ropero", ruta: "/?escena=ropero&congelar=60" },
  { archivo: "ropero-cuenta", ruta: "/?escena=ropero&ejemplo&congelar=60" },
  { archivo: "ropero-vitrina-1", ruta: "/?escena=ropero&vitrina=1&congelar=60" },
  { archivo: "ropero-vitrina-2", ruta: "/?escena=ropero&vitrina=2&congelar=60" },
  {
    archivo: "nivel-con-prendas",
    ruta: "/?escena=nivel&j1=&j2=&ropa1=sombrero:puntudo,mascara:diablito,panuelo:capa&ropa2=peinado:colitas,mascara:guacamaya,panuelo:lazo&congelar=60",
  },
  { archivo: "nivel-secreto", ruta: "/?escena=nivel&punto=2&j1=andar:0.5&j2=andar:1,girar:0.06&congelar=252" },
  // TU-12: las piezas de juego (niveles/98-piezas), entero y en la salida. El rojo pisa la plancha y baja la compuerta;
  // el turquesa empuja la palanca y el rojo pasa; el rojo se columpia en un bejuco sobre la quebrada (los brazos se
  // alzan en el paso 15: al reaparecer en un punto no se agarra con el botón ya apretado); el rojo sube al balancín
  // y después lo vuelca
  { archivo: "piezas-entero", ruta: "/?escena=nivel&nivel=piezas&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "piezas-salida", ruta: "/?escena=nivel&nivel=piezas&j1=&j2=&congelar=60" },
  { archivo: "piezas-plancha", ruta: "/?escena=nivel&nivel=piezas&j1=andar:1&j2=&congelar=230" },
  {
    archivo: "piezas-palanca",
    ruta: "/?escena=nivel&nivel=piezas&punto=1&j1=andar:1&j2=andar:1,izq@15,der@15&congelar=175",
  },
  {
    archivo: "piezas-bejuco",
    ruta: "/?escena=nivel&nivel=piezas&punto=2&j1=andar:1,izq@15,der@15&j2=&congelar=110",
  },
  { archivo: "piezas-balancin", ruta: "/?escena=nivel&nivel=piezas&punto=3&j1=andar:1&j2=&congelar=170" },
  { archivo: "piezas-balancin-volcado", ruta: "/?escena=nivel&nivel=piezas&punto=3&j1=andar:1&j2=&congelar=230" },
  // TU-13: el nivel 0, El patio (niveles/00-patio). Entero desde lejos; despiertan tirados en el montón de trapos y
  // se levantan; el rojo empuja la aldaba y el turquesa pasa el portón; los dos cargan la escalera y se apoya en el
  // muro (logro «A la de tres»); suben el techo de lámina; el rojo cae al camión que maniobra (la meta); y el
  // turquesa encuentra la piñata en el palo de mango (el secreto)
  { archivo: "patio-entero", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "patio-1-despiertan", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&congelar=100" },
  { archivo: "patio-1-levantados", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&congelar=260" },
  {
    archivo: "patio-2-porton",
    ruta: "/?escena=nivel&nivel=patio&punto=1&j1=andar:0.8,izq@15,der@15&j2=andar:1&congelar=115",
  },
  {
    archivo: "patio-3-escalera",
    ruta: "/?escena=nivel&nivel=patio&punto=2&j1=andar:0.6,izq@15,der@15&j2=andar:0.6,izq@15,der@15&congelar=200",
  },
  {
    archivo: "patio-3-apoyada",
    ruta: "/?escena=nivel&nivel=patio&punto=2&j1=andar:0.6,izq@15,der@15&j2=andar:0.6,izq@15,der@15&congelar=440",
  },
  { archivo: "patio-4-lamina", ruta: "/?escena=nivel&nivel=patio&punto=3&j1=andar:1&j2=andar:1&congelar=170" },
  { archivo: "patio-5-camion", ruta: "/?escena=nivel&nivel=patio&punto=4&j1=andar:1&j2=&congelar=95" },
  { archivo: "patio-5-meta", ruta: "/?escena=nivel&nivel=patio&punto=4&j1=andar:1&j2=&congelar=170" },
  { archivo: "patio-secreto", ruta: "/?escena=nivel&nivel=patio&punto=2&j1=&j2=andar:1,girar:0.1&congelar=150" },
  // TU-14: el nivel 1, El pinar (niveles/01-pinar), entero, en la salida y una toma por misión: 1. el rojo empuja el
  // cajón contra el cerco; 2. el turquesa sube solo por el balancín y, pasado el eje, se le vuelca; 3. el rojo se
  // columpia en el bejuco sobre el barranco; 4. el rojo agarra el tronco de los caballetes (solo no lo levanta);
  // 5. el Cadejo echado en su corral, persiguiendo al rojo y recién lamido; 6. el rojo agarra la lámpara, que se
  // enciende y abre la puerta de la pulpería (y, ya en la meta, la lámpara encendida y la puerta abierta). Y el nido
  // del secreto, arriba del pino más alto (`vista=x,y,z`: la cámara quieta mirando ese punto)
  { archivo: "pinar-entero", ruta: "/?escena=nivel&nivel=pinar&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "pinar-salida", ruta: "/?escena=nivel&nivel=pinar&j1=&j2=&congelar=60" },
  { archivo: "pinar-1-cerco", ruta: "/?escena=nivel&nivel=pinar&j1=andar:1&j2=andar:1&congelar=230" },
  { archivo: "pinar-2-balancin", ruta: "/?escena=nivel&nivel=pinar&punto=1&j1=&j2=andar:1&congelar=260" },
  { archivo: "pinar-2-volcado", ruta: "/?escena=nivel&nivel=pinar&punto=1&j1=&j2=andar:1&congelar=395" },
  {
    archivo: "pinar-3-bejuco",
    ruta: "/?escena=nivel&nivel=pinar&punto=2&j1=andar:1,izq@15,der@15&j2=&congelar=250",
  },
  { archivo: "pinar-4-tronco", ruta: "/?escena=nivel&nivel=pinar&punto=3&j1=andar:1,der@15&j2=andar:1&congelar=100" },
  { archivo: "pinar-5-cadejo", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=&j2=&vista=41.2,3.8,0&congelar=60" },
  { archivo: "pinar-5-persigue", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=andar:1&j2=&congelar=118" },
  { archivo: "pinar-5-lamida", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=andar:1&j2=&congelar=140" },
  { archivo: "pinar-6-lampara", ruta: "/?escena=nivel&nivel=pinar&punto=5&j1=andar:1,der@15&j2=&congelar=250" },
  { archivo: "pinar-6-encendida", ruta: "/?escena=nivel&nivel=pinar&punto=6&j1=&j2=&vista=50.6,4.6,0&congelar=60" },
  { archivo: "pinar-secreto", ruta: "/?escena=nivel&nivel=pinar&punto=5&j1=&j2=&vista=49.7,7.9,-2.45&congelar=30" },
  // TU-33: Noche de tuerce. El nivel de piezas de noche, entero; con el cartel de la trampa al empezar: amarrados por
  // un mecate (el turquesa se queda y el rojo lo arrastra), la niebla espesa en el de prueba, los dos saltando con
  // gravedad de luna, y la línea del menú
  {
    archivo: "noche-piezas-entero",
    ruta: "/?escena=nivel&nivel=piezas&noche=2&trampa=cruzados&j1=&j2=&vista=todo&congelar=60",
  },
  {
    archivo: "noche-amarrados",
    ruta: "/?escena=nivel&nivel=piezas&noche=7&trampa=mecate&j1=andar:1,girar:-0.15&j2=&congelar=200",
  },
  { archivo: "noche-niebla", ruta: "/?escena=nivel&noche=3&trampa=niebla&j1=andar:1&j2=andar:1&congelar=120" },
  { archivo: "noche-luna", ruta: "/?escena=nivel&noche=1&trampa=luna&j1=saltar@30&j2=saltar@36&congelar=75" },
  { archivo: "noche-menu", ruta: "/?escena=nivel&noche=5&j1=&j2=&menu&congelar=60" },
  // TU-25: el nivel 3, La calle empedrada (niveles/03-calle), entero, en la salida y una toma por misión: 1. los dos
  // empujan la carreta por el callejón de la cuesta, y arriba queda trabada; 2. la Carreta sin bueyes en su calle
  // (con el freno a la entrada) y el rojo que entra y lo saca; 3. la torre del reloj con las pesas y, ya pasado el
  // punto 3, las agujas en las doce y la puerta arriba; 4. el corredor alto con las enredaderas sobre las alfombras,
  // y las pisadas del que pasa por la calle; 5. las dos campanas y la reja; 6. los dos suben a la carreta del mirador,
  // bajando y ya en la plaza. Y el pilón del secreto, arriba de la vitrina del carrito
  { archivo: "calle-entero", ruta: "/?escena=nivel&nivel=calle&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "calle-salida", ruta: "/?escena=nivel&nivel=calle&j1=&j2=&congelar=60" },
  { archivo: "calle-1-cuesta", ruta: "/?escena=nivel&nivel=calle&j1=andar:1&j2=andar:1&congelar=700" },
  { archivo: "calle-1-arriba", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-29,3.2,0&congelar=30" },
  { archivo: "calle-2-sin-bueyes", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-15.5,2.6,0&congelar=150" },
  { archivo: "calle-2-sacado", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=andar:1&j2=&congelar=468" },
  { archivo: "calle-3-reloj", ruta: "/?escena=nivel&nivel=calle&punto=2&j1=&j2=&vista=3.4,5.4,2.4&congelar=30" },
  { archivo: "calle-3-abierta", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=&j2=&vista=3.4,5.4,2.4&congelar=90" },
  { archivo: "calle-4-corredor", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=&j2=&vista=19,4,-0.5&congelar=30" },
  { archivo: "calle-4-pisadas", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=andar:1&j2=andar:1&congelar=420" },
  { archivo: "calle-5-campanas", ruta: "/?escena=nivel&nivel=calle&punto=4&j1=&j2=&vista=32.5,9.5,-2.5&congelar=30" },
  { archivo: "calle-6-subiendo", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=150" },
  { archivo: "calle-6-bajando", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=262" },
  { archivo: "calle-6-plaza", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=420" },
  { archivo: "calle-secreto", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-20.6,4,-2.4&congelar=30" },
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
  // Las letras del menú (Fraunces y Karla) llegan de Google Fonts: se esperan para que la imagen salga con ellas.
  // Primero la hoja de estilos (si la escena la pidió), así `fonts.ready` ya sabe qué letras tiene que bajar
  await pagina
    .waitForFunction(() => [...document.querySelectorAll("link[data-fuentes]")].every((l) => l.sheet), null, {
      timeout: 10_000,
    })
    .catch(() => {});
  await pagina.evaluate(() => new Promise((listo) => requestAnimationFrame(() => listo())));
  await pagina.evaluate(() => document.fonts.ready);
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
