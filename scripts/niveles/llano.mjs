// pnpm niveles: arma niveles/11-llano/escena.glb, el nivel 11 (TU-44): El llano, en Los Llanos de Venezuela.
// Sabana plana, molinos de viento, corrales y hamacas; anda por ahí el Silbón, un flaco altísimo que silba al revés.
// Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x, sobre la sabana (y = 0). Todo va corrido
// 49 m hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. el pajonal: el Silbón está escondido en una de tres matas y silba al revés (bajito de cerca, fuerte de lejos).
//      Al hallarlo se va y la talanquera del pajonal se abre → punto 1. Hallarlo al primer intento da el logro
//   2. el molino, de a dos: la empalizada del hato no se trepa. Uno empuja el freno y el molino para con las aspas
//      tendidas en rampa del pozo a las pacas; el otro sube por ellas, baja del otro lado, saca la tranca y el portón
//      se abre → punto 2
//   3. el ganado: tres reses pastan en el potrero; se las arrea hasta el corral (se apartan del que se acerca) y,
//      con las tres adentro, la talanquera del corral se abre → punto 3
//   4. la hamaca, de a dos: uno jala la cabuya hacia atrás y el otro se mete en la hamaca; al soltarla sale disparado
//      sobre el caño. Del otro lado baja el puente con la palanca y el otro cruza → punto 4
//   5. el saco: arriba de la troja está el saco de cachivaches del Silbón, que espera junto a su rancho. Se lo dejan al
//      lado, lo recoge, se va contento y aparece la meta → punto 5
// El secreto: un arpa llanera bajo el samán, en el conuco cercado de atrás.
import { crearEscena } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 11,
  nombre: "El llano",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** La sabana. */
const G = 0;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 104 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -49;
/** El molino: el eje, el radio de las aspas y su ancho; el pozo debajo y las pacas a donde llega la rampa. */
const MOLINO = { x: 34, y: 1.15, z: -1.55, radio: 4.2, ancho: 0.55 };
const POZO = { x0: 29.94, x1: 38.25, z0: -2.35, z1: -0.75, fondo: -4.4 };

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

/** Una zona de agua: de x0 a x1 y de z0 a z1, del fondo a la superficie. */
function agua(nombre, x0, x1, z0, z1, fondo, superficie, extras = {}) {
  vacio(
    nombre,
    [(x0 + x1) / 2, (fondo + superficie) / 2, (z0 + z1) / 2],
    [(x1 - x0) / 2, (superficie - fondo) / 2, (z1 - z0) / 2],
    { tipo: "agua", ...extras },
    0,
  );
}

/** Una cerca de alambre con sus estantillos, derecha a lo largo de x o de z: no se trepa (es delgada) ni se salta
 * (un muro invisible más alto). */
function cerca(nombre, [x0, z0], [x1, z1], alto = 1.4) {
  const largo = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(largo / 2));
  const aLoLargoDeX = z0 === z1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    solido(`${nombre}-estantillo-${i + 1}`, [x, G + alto / 2, z], [0.13, alto, 0.13], { material: "corteza" });
  }
  for (const [j, y] of [0.45, 0.85, 1.25].entries()) {
    if (y > alto) continue;
    const medidas = aLoLargoDeX ? [largo, 0.025, 0.025] : [0.025, 0.025, largo];
    solido(`${nombre}-alambre-${j + 1}`, [(x0 + x1) / 2, G + y, (z0 + z1) / 2], medidas, { material: "honda" });
  }
  const pared = aLoLargoDeX ? [largo, alto + 1.4, 0.1] : [0.1, alto + 1.4, largo];
  solido(`${nombre}-pared`, [(x0 + x1) / 2, G + (alto + 1.4) / 2, (z0 + z1) / 2], pared, { invisible: 1 });
}

/** Una talanquera (un portón de varas) a lo largo de z, en x: la mueve el guion. */
function talanquera(nombre, x, z0, z1, alto = 1.8) {
  bloque(nombre, [x - 0.06, G, z0], [x + 0.06, G + alto, z1], { cuerpo: "cinematico", material: "corteza" });
}

// ── 1. El pajonal ───────────────────────────────────────────────────────────────────────────────────────────────
// Más ancho que el camino hacia atrás (−z): ahí están las tres matas donde puede estar escondido el Silbón
bloque("pajonal", [-3, -2, -7.6], [25, G, 3.2]);
// El Silbón, agachado en la mata del fondo (la tercera): su caja es él de pie
pieza("silbon", "silbon", [18.5, G + 1.6, -5.2], [0.6, 3.2, 0.6], { hallar: 1.3, velocidad: 1.4, alcance: 1.6 });
// Las tres matas (escondites): una mata grande y dos chicas en cada una
for (const [i, [x, z]] of [
  [6.5, -5.0],
  [11.5, 1.9],
  [18.5, -5.2],
].entries()) {
  adorno(`escondite-${i + 1}`, [x, G, z], { forma: "mata", alto: 2.3, semilla: 101 + i });
  adorno(`escondite-${i + 1}-b`, [x + 0.7, G, z + 0.4], { forma: "mata", alto: 1.6, semilla: 111 + i });
  adorno(`escondite-${i + 1}-c`, [x - 0.6, G, z - 0.3], { forma: "mata", alto: 1.8, semilla: 121 + i });
}
// La cerca del pajonal y su talanquera (se abre al hallar al Silbón)
cerca("cerca-pajonal-atras", [25, -7.6], [25, -1.2]);
cerca("cerca-pajonal-frente", [25, 1.2], [25, 3.2]);
talanquera("talanquera-pajonal", 25, -1.2, 1.2);

// ── 2. El molino y la empalizada del hato ───────────────────────────────────────────────────────────────────────
// La sabana alrededor del pozo del molino (las aspas bajan hasta el fondo)
bloque("suelo-molino", [25, -2, -3.2], [POZO.x0, G, 3.2]);
bloque("suelo-molino-frente", [POZO.x0, -2, POZO.z1], [POZO.x1, G, 3.2]);
bloque("suelo-molino-atras", [POZO.x0, -2, -3.2], [POZO.x1, G, POZO.z0]);
bloque("pozo-fondo", [POZO.x0, POZO.fondo - 0.4, POZO.z0], [POZO.x1, POZO.fondo, POZO.z1], { material: "honda" });
for (const [i, z] of [POZO.z0, POZO.z1].entries()) {
  bloque(`pozo-pared-${i + 1}`, [POZO.x0, POZO.fondo, z - 0.05], [POZO.x1, -2, z + 0.05], { material: "honda" });
}
vacio("pozo", [(POZO.x0 + POZO.x1) / 2, -3, (POZO.z0 + POZO.z1) / 2], [4.2, 1.2, 0.8], { tipo: "vacio" }, 0);
// El molino: dos aspas de 4.2 m, con el eje en el borde de atrás del camino; frenado, la rampa sube 15°
pieza("molino", "molino", [MOLINO.x, MOLINO.y, MOLINO.z], [MOLINO.radio * 2, MOLINO.radio * 2, MOLINO.ancho * 2], {
  angulo: 15,
  viento: 1.6,
  arranque: 1.2,
  frenada: 2.5,
});
// El freno: una palanca junto al pozo, que se empuja hacia el este
pieza("freno", "palanca", [31.4, G + 0.6, -0.25], [0.6, 1.2, 0.3], { angulo: 30 }, -Math.PI / 2);
// Las pacas de heno contra la empalizada (2.25 m: no se trepan), con un borde de tablas hacia el molino
bloque("pacas", [POZO.x1, G, -3.2], [41.25, G + 2.25, -0.75], { material: "tela" });
bloque("pacas-borde", [38.12, G + 2.15, POZO.z0], [POZO.x1, G + 2.25, POZO.z1], { material: "corteza" });
bloque("paca-escalon", [41.25, G, -2.7], [42.05, G + 1.1, -1.3], { material: "tela" });
// La empalizada del hato (2.6 m, de troncos) con el portón, y la tranca del lado de adentro (se jala hacia el este)
bloque("empalizada-1", [39.6, G, -0.75], [39.9, G + 2.6, 0.5], { material: "corteza" });
bloque("empalizada-2", [39.6, G, 2.7], [39.9, G + 2.6, 3.2], { material: "corteza" });
bloque("empalizada-alta", [39.6, G + 2.6, -0.75], [39.9, G + 4, 3.2], { invisible: 1 });
bloque("porton", [39.65, G, 0.5], [39.85, G + 2.3, 2.7], { cuerpo: "cinematico", material: "corteza" });
pieza("tranca", "tranca", [40.22, G + 1.0, -0.1], [0.9, 0.16, 0.14], { recorrido: 0.45 }, Math.PI / 2);
solido("tranca-soporte", [39.98, G + 0.85, -0.1], [0.3, 0.1, 0.12], { material: "honda" });

// ── 3. El potrero y el corral ───────────────────────────────────────────────────────────────────────────────────
bloque("suelo-potrero", [POZO.x1, -2, -3.2], [70.6, G, 3.2]);
// El ganado: tres reses en el potrero; el corral, los últimos 5 m (de x = 57 a 62)
pieza("ganado", "ganado", [51.1, G + 0.75, 0], [21.8, 1.5, 6], {
  cuantas: 3,
  corral: 5,
  huir: 3.2,
  velocidad: 1.4,
  masa: 250,
  semilla: 7,
});
cerca("cerca-potrero-atras", [41.25, -3.2], [62, -3.2]);
cerca("cerca-corral-atras", [57, -3.2], [57, -2.6]);
cerca("cerca-corral-frente", [57, 2.6], [57, 3.2]);
cerca("cerca-corral-salida-atras", [62, -3.2], [62, -1.2]);
cerca("cerca-corral-salida-frente", [62, 1.2], [62, 3.2]);
talanquera("talanquera-corral", 62, -1.2, 1.2);
// El comedero de las reses, contra la cerca de atrás del corral
bloque("comedero", [57.4, G, -3.1], [61.6, G + 0.45, -2.75], { material: "corteza" });

// ── 4. La hamaca y el caño ──────────────────────────────────────────────────────────────────────────────────────
// La hamaca, entre dos horcones a lo ancho del camino, mirando al caño; su cabuya cuelga del lado de la cámara
pieza(
  "hamaca",
  "hamaca",
  [68.5, G + 0.85, 0],
  [2.6, 1.7, 0.3],
  { estirar: 2.2, lado: -1.9, fuerza: 25, colgar: 0.55, lanzar: 8, elevacion: 38 },
  Math.PI / 2,
);
// El caño (3.2 m, ni se salta), con agua que se lleva al que cae
agua("cano", 70.6, 73.8, -3.2, 3.2, -2.2, -0.5, { caer: "vacio", arrastre: 2 });
bloque("cano-lecho", [70.6, -2.6, -3.2], [73.8, -2.2, 3.2], { material: "honda" });
// El puente de tablas: tendido sobre el caño en la escena; el guion lo empieza parado sobre su bisagra (la punta del
// este) y lo baja con la palanca de la otra orilla
bloque("puente-cano", [70.45, G - 0.12, 1.6], [73.95, G, 2.8], { cuerpo: "cinematico", material: "corteza" });
pieza("palanca-puente", "palanca", [76.2, G + 0.6, 1.3], [0.6, 1.2, 0.3], { angulo: 30 }, -Math.PI / 2);

// ── 5. La troja, el conuco del samán y el rancho del Silbón ────────────────────────────────────────────────────
bloque("suelo-este", [73.8, -2, -3.2], [101, G, 3.2]);
// La troja: un tablado de 1.5 m (se trepa colgándose) con el saco arriba
bloque("troja", [80, G, -3.2], [83, G + 1.5, -1.4], { material: "corteza" });
for (const [i, [x, z]] of [
  [80.1, -1.5],
  [82.9, -1.5],
].entries()) {
  bloque(`troja-horcon-${i + 1}`, [x - 0.08, G + 1.5, z - 0.08], [x + 0.08, G + 2.8, z + 0.08], {
    material: "corteza",
  });
}
// El saco, sobre un banco de la troja: a la altura de las manos alzadas del que está arriba
bloque("troja-banco", [81.4, G + 1.5, -2.6], [81.9, G + 2.15, -2.0], { material: "corteza" });
pieza("saco", "saco", [81.65, G + 2.15 + 0.31, -2.3], [0.5, 0.6, 0.6], { masa: 3 });
// El conuco del samán, detrás de la tapia de bahareque (1.4 m, ancha: se trepa colgándose)
bloque("suelo-conuco", [85, -2, -7.6], [92, G, -3.2]);
bloque("tapia-conuco", [85, G, -3.5], [92, G + 1.4, -3.2], { material: "tela" });
bloque("tapia-conuco-oeste", [84.7, G, -7.6], [85, G + 2.6, -3.2], { material: "tela" });
bloque("tapia-conuco-este", [92, G, -7.6], [92.3, G + 2.6, -3.2], { material: "tela" });
vacio("secreto", [88.6, G + 0.6, -5.9], [0.7, 0.6, 0.7], { tipo: "secreto" }, 0);
// El rancho del Silbón: cuatro horcones y su techo de palma (el techo lo pone el guion)
for (const [i, [x, z]] of [
  [92.6, -2.9],
  [95.6, -2.9],
  [92.6, 0.3],
  [95.6, 0.3],
].entries()) {
  bloque(`rancho-horcon-${i + 1}`, [x - 0.09, G, z - 0.09], [x + 0.09, G + 2.9, z + 0.09], { material: "corteza" });
}

// ── Bordes: cercas de atrás, una pared invisible del lado de la cámara (+z) y las puntas ───────────────────────
bloque("borde-pajonal-atras", [-3, G, -7.9], [25, G + 3, -7.6], { invisible: 1 });
cerca("cerca-pajonal-fondo", [-3, -7.6], [25, -7.6]);
cerca("cerca-molino-atras", [25, -3.2], [POZO.x1, -3.2]);
bloque("borde-este-atras", [62, G, -3.5], [85, G + 3, -3.2], { invisible: 1 });
bloque("borde-conuco-atras", [84.7, G, -7.9], [92.3, G + 3, -7.6], { material: "tela" });
bloque("borde-rancho-atras", [92.3, G, -3.5], [101, G + 3, -3.2], { invisible: 1 });
bloque("borde-frente", [-3, -2, 3.2], [101, G + 3, 3.5], { invisible: 1 });
bloque("borde-oeste", [-3.3, -2, -7.6], [-3, G + 3, 3.2], { invisible: 1 });
bloque("borde-este", [101, -2, -3.2], [101.3, G + 3, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [0, G, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [0, G, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [27.4, G + 1, 0], [3, 1, 0.9], { tipo: "control", orden: 1 });
vacio("control-2", [43.8, G + 1, 1], [2, 1, 0.8], { tipo: "control", orden: 2 });
vacio("control-3", [64, G + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 3 });
vacio("control-4", [76.6, G + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 4 });
// La meta, pasando el rancho (aparece cuando el Silbón recoge su saco)
vacio("control-5", [98.4, G + 1, 0], [2.6, 1, 1], { tipo: "control", orden: 5 });

// ── Adornos: el pajonal y matas sueltas (las palmas de moriche del horizonte las pone el guion) ─────────────────────────────────────────────
for (let i = 0; i < 46; i++) {
  // El pajonal: matas bajas regadas (de semilla fija), sin tapar el camino del medio
  const x = -2 + ((i * 37) % 26) + 0.4 * Math.sin(i * 3.1);
  const z = -7.2 + ((i * 53) % 61) / 10;
  if (Math.abs(z) < 1.3) continue;
  adorno(`paja-${i + 1}`, [x, G, z], { forma: "mata", alto: 0.6 + 0.35 * ((i * 7) % 5) * 0.25, semilla: 200 + i });
}
for (const [i, [x, z, alto]] of [
  [27.5, -2.8, 0.9],
  [43.5, -2.8, 0.8],
  [54.2, 2.9, 0.7],
  [64.6, -2.8, 1.0],
  [66.8, 2.9, 0.8],
  [77.8, 2.8, 0.9],
  [86.2, 2.8, 0.8],
  [99.6, -2.7, 1.0],
].entries()) {
  adorno(`mata-${i + 1}`, [x, G, z], { forma: "mata", alto, semilla: 300 + i });
}
// Niebla: la del pajonal (más espesa: ahí se busca de oído), la del caño y capas sobre la sabana
vacio("niebla-pajonal-1", [8, 0.9, -4.5], [10, 1.4, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.1 }, 0);
vacio("niebla-pajonal-2", [16, 1.2, -6.8], [12, 1.8, 1], { tipo: "niebla", opacidad: 0.55, velocidad: -0.08 }, 0);
vacio("niebla-cano", [72.2, -0.2, 0], [3, 1, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.06 }, 0);
vacio("niebla-1", [20, 2, -10], [26, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.14 }, 0);
vacio("niebla-2", [60, 2, -8], [26, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.12 }, 0);
vacio("niebla-3", [92, 2.5, -10], [20, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.12 }, 0);
vacio("niebla-4", [48, 5, -16], [64, 8, 1], { tipo: "niebla", opacidad: 0.65, velocidad: 0.2 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("11-llano");
