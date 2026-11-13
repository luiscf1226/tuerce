// pnpm niveles: arma niveles/10-garrucha/escena.glb, el nivel 10 (TU-43): La garrucha, en el Eje cafetero
// (Colombia). Montañas verdes (acá, en siluetas y grises), palmas de cera altísimas y cables sobre los cañones. Como
// los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. La finca está en y = 0.3, la loma de la
// carrera y la bodega en 2.3 y la plataforma de la palma y la otra orilla del cañón en 8.3. Todo va corrido 52 m hacia
// −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. la garrucha, de a dos: una canasta colgada de un cable sobre el cañón del río, de la finca a la loma. Uno va
//      en la canasta y el otro jala la manija de la soga, caminando hacia atrás, una y otra vez → punto 1, en la loma.
//      Vacía, la canasta baja sola: el que llegó jala la manija de arriba y sube al otro
//   2. la carrera de saltos contra La Patasola: cuatro zanjas en la loma; ella corre brincando por su carril, detrás
//      → punto 2, pasada la meta. Ganarle da el logro, «En una pata»
//   3. la chiva, de a dos: parqueada junto a la bodega, con el techo a la altura del piso. Con la carga (un huacal de
//      8 kg, que espera en una tarima: entre los dos, cada uno con el brazo de adentro) y los dos en el techo, arranca, vadea el río y pasa dos baches: si la carga no la sostienen los dos, salta
//      del techo, la chiva frena y se devuelve → punto 3, en la otra loma
//   4. la palma de cera: se trepa con la manea, un aro de soga alrededor del tronco → punto 4, en su plataforma
//   5. el cañón de las lianas: tres lianas cuelgan de un cable, con dos farallones entre ellas → punto 5, la meta
// El secreto: una orquídea en lo alto de la palma más alta, detrás de la meta (también con manea).
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 10,
  nombre: "La garrucha",
  vacio: -4,
  nieblaCerca: 3,
  nieblaLejos: 28,
});

/** La finca, la loma y lo alto. */
const G = 0.3;
const G2 = 2.3;
const D = 8.3;
/** El fondo de los cañones (hasta ahí bajan los bloques de las orillas). */
const HONDO = -6;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 120 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -52;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

/** Algo que solo se ve (sin `tipo`): una malla con su forma. */
function imagen(nombre, geometria, [x, y, z]) {
  const m = new THREE.Mesh(geometria);
  m.name = nombre;
  m.position.set(x, y, z);
  escena.add(m);
}

/** Un palo de `a` a `b` (para imagen). */
function palo(a, b, radio) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(radio, radio, va.distanceTo(vb), 8);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()),
  );
  return { g, centro: va.clone().add(vb).multiplyScalar(0.5).toArray() };
}

// ── La finca y la garrucha ──────────────────────────────────────────────────────────────────────────────────
bloque("finca", [-8, HONDO, -3.2], [12, G, 3.2]);
// La garrucha: el piso de la canasta va de (12.53, finca) a (25.47, loma); las manijas, 1.4 m detrás de cada punta y
// 1.3 m hacia el fondo (−z)
pieza("garrucha", "garrucha", [19, (G + G2) / 2, 0], [12.94, G2 - G, 0.9], {
  velocidad: 1.4,
  soga: 2.2,
  multiplica: 3.2,
  bajar: 1.2,
  fuerza: 20,
  lado: -1.3,
  atras: 1.4,
});
// El cañón del río, abajo, con su agua (solo se ve: el que cae, cae al vacío)
imagen("rio-abajo", new THREE.BoxGeometry(14, 0.1, 6.4), [19, HONDO + 1.4, 0]);

// ── La loma: la carrera contra La Patasola ──────────────────────────────────────────────────────────────────
// Cuatro zanjas de 70 cm a lo ancho de la loma, que se saltan. Al fondo (−z), el carril de La Patasola
const ZANJAS = [34.5, 38.5, 42.5, 46.5];
const tramos = [26, ...ZANJAS.flatMap((x) => [x, x + 0.7]), 60];
for (let i = 0; i < tramos.length; i += 2) {
  bloque(`loma-${i / 2 + 1}`, [tramos[i], HONDO, -3.2], [tramos[i + 1], G2, 3.2]);
}
pieza("patasola", "patasola", [41, G2 + 1, -2.3], [20, 2, 0.5], { tiempo: 15, salto: 0.45, brinco: 0.5 });
// La salida y la meta de la carrera: dos postes de guadua con una cinta (solo se ven)
for (const [nombre, x] of [
  ["salida-carrera", 31],
  ["meta-carrera", 51],
]) {
  for (const z of [-3.0, 3.0]) {
    const { g, centro } = palo([x, G2, z], [x, G2 + 2.1, z], 0.06);
    imagen(`${nombre}-poste${z < 0 ? "-fondo" : ""}`, g, centro);
  }
  const { g, centro } = palo([x, G2 + 2.0, -3.0], [x, G2 + 2.0, 3.0], 0.02);
  imagen(`${nombre}-cinta`, g, centro);
}

// ── La bodega y la chiva ────────────────────────────────────────────────────────────────────────────────────
// La carga, en la bodega (el final de la loma); la chiva, parqueada con el techo a la altura del piso, del lado de
// la calle. La calle, 2 m más abajo, cruza el río por un vado: no se baja ahí (el que cae, cae al vacío)
// La carga espera en una tarima, a la altura de las manos alzadas: se agarra entre los dos, cada uno con el brazo de
// adentro, y se lleva al techo caminando
bloque("tarima", [58.0, G2, -0.25], [58.5, G2 + 0.7, 0.25], { material: "corteza" });
pieza("chiva-carga", "huacal", [58.25, G2 + 1.0, 0], [0.6, 0.6, 0.6], { masa: 8 });
pieza("chiva", "chiva", [63.1, (G + G2) / 2, 0], [6, G2 - G, 2.2], {
  recorrido: 13.85,
  velocidad: 2,
  baches: 2,
  bache: 0.1,
});
bloque("calle-1", [60, HONDO, -3.2], [67, G, 3.2]);
bloque("vado", [67, HONDO, -3.2], [73, G - 0.6, 3.2], { material: "honda" });
bloque("calle-2", [73, HONDO, -3.2], [80, G, 3.2]);
vacio("vado-agua", [70, G - 0.15, 0], [3.2, 0.4, 3], { tipo: "agua", corriente: 1.2, arrastre: 2 }, 0);
vacio("hondonada", [70, (HONDO + G2 - 0.6) / 2, 0], [3.2, (G2 - 0.6 - HONDO) / 2, 9.95], { tipo: "vacio" });
// La bodega: un galpón de guadua al fondo, con bultos (solo se ven)
for (const x of [55, 57.5, 60])
  for (const z of [-3.1, -1.9]) {
    const { g, centro } = palo([x, G2, z], [x, G2 + 3 + (z < -2.5 ? 0.4 : 0), z], 0.07);
    imagen(`bodega-paral-${x}-${z}`, g, centro);
  }
imagen("bodega-techo", new THREE.BoxGeometry(5.6, 0.1, 1.8).rotateX(-0.2), [57.5, G2 + 3.2, -2.5]);
for (const [i, [x, z]] of [
  [55.8, -2.7],
  [56.5, -2.6],
  [56.15, -2.65],
].entries()) {
  imagen(`bulto-${i + 1}`, new THREE.SphereGeometry(0.32, 10, 8).scale(1, 0.75, 0.8), [
    x,
    G2 + 0.25 + (i === 2 ? 0.45 : 0),
    z,
  ]);
}

// ── La otra loma y la palma de cera ─────────────────────────────────────────────────────────────────────────
bloque("otra-loma", [80, HONDO, -3.2], [89, G2, 3.2]);
// La palma: el tronco, de la loma a la plataforma (6 m), con su manea. La plataforma de guadua se apoya en lo alto
// del tronco y sale hacia el cañón; su borde de este lado queda junto a la manea (por ahí se encarama)
pieza("palma", "palma", [86.5, G2 + 3, 0], [0.56, D - G2, 0.56], { manea: 1, velocidad: 0.9, copa: 4.5 });
bloque("plataforma", [86.22, D - 0.2, -1.3], [89, D, 1.3], { material: "corteza" });

// ── El cañón de las lianas ──────────────────────────────────────────────────────────────────────────────────
// Dos farallones entre la plataforma y la otra orilla, a 2 m uno de otro. Las lianas cuelgan de un cable, a 30 cm
// de cada borde, con la punta a 1 m de la altura de donde se agarran
bloque("farallon-1", [91, HONDO, -1], [92.6, D, 1], { material: "tela" });
bloque("farallon-2", [94.6, HONDO, -1], [96.2, D, 1], { material: "tela" });
bloque("orilla", [98.2, HONDO, -3.2], [112, D, 3.2]);
/** El cable de las lianas: de la copa de la palma a la palma más alta. */
const CABLE = { desde: [86.5, D + 4.3], hasta: [106, D + 4.7] };
const alturaCable = (x) =>
  CABLE.desde[1] + ((CABLE.hasta[1] - CABLE.desde[1]) * (x - CABLE.desde[0])) / (CABLE.hasta[0] - CABLE.desde[0]);
for (const [i, x] of [89.3, 92.9, 96.5].entries()) {
  const arriba = alturaCable(x) - 0.03;
  const abajo = D + 1;
  pieza(`liana-${i + 1}`, "bejuco", [x, (arriba + abajo) / 2, 0], [0.08, arriba - abajo, 0.08]);
}
{
  const { g, centro } = palo([CABLE.desde[0], CABLE.desde[1], 0], [CABLE.hasta[0], CABLE.hasta[1], 0], 0.035);
  imagen("cable-lianas", g, centro);
}

// ── La meta y la palma más alta (el secreto) ────────────────────────────────────────────────────────────────
pieza("palma-alta", "palma", [106, D + 2.5, 0], [0.5, 5, 0.5], { manea: 1, velocidad: 0.9, copa: 3 });
bloque("nido", [105.75, D + 4.8, -1], [107.4, D + 5, 1], { material: "corteza" });
vacio("secreto", [106.9, D + 5.5, 0], [0.5, 0.5, 0.5], { tipo: "secreto" }, 0);

// ── Bordes: el monte del fondo (−z) y paredes invisibles del lado de la cámara (+z, solo atajan a los muñecos) ──
bloque("monte-finca", [-8, G, -4.4], [12, G + 1.6, -3.2], { material: "tela" });
bloque("monte-loma", [26, G2, -4.4], [80, G2 + 1.6, -3.2], { material: "tela" });
bloque("monte-calle", [60, HONDO, -4.4], [80, G2, -3.2], { material: "tela" });
bloque("monte-otra-loma", [80, G2, -4.4], [89, G2 + 1.6, -3.2], { material: "tela" });
bloque("monte-orilla", [98.2, D, -4.4], [112, D + 1.6, -3.2], { material: "tela" });
bloque("borde-oeste", [-8.3, G, -3.2], [-8, G + 2, 3.2], { invisible: 1 });
bloque("borde-finca", [-8, G, 3.2], [12, G + 2, 3.5], { invisible: 1 });
bloque("borde-loma", [26, G2, 3.2], [60, G2 + 2, 3.5], { invisible: 1 });
bloque("borde-otra-loma", [80, G2, 3.2], [89, G2 + 2, 3.5], { invisible: 1 });
bloque("borde-orilla", [98.2, D, 3.2], [112, D + 2, 3.5], { invisible: 1 });
bloque("borde-este", [112, D, -3.2], [112.3, D + 2, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-6, G, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-6, G, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [28.2, G2 + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 1 });
vacio("control-2", [53.4, G2 + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 2 });
vacio("control-3", [82.1, G2 + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 3 });
vacio("control-4", [88.1, D + 1, 0], [1.2, 1, 0.7], { tipo: "control", orden: 4 });
vacio("control-5", [101.3, D + 1, 0], [2.6, 1, 1], { tipo: "control", orden: 5 });

// ── Adornos: el cafetal ─────────────────────────────────────────────────────────────────────────────────────
// Matas de café en la finca, en la loma y en la otra orilla (las palmas de cera y las montañas las pone el guion)
for (const [i, [x, y, z, alto]] of [
  [-7, G, 2.6, 1.1],
  [-4.5, G, 2.7, 1.0],
  [-2, G, 2.6, 1.2],
  [0.5, G, 2.7, 1.0],
  [3, G, 2.6, 1.1],
  [-6, G, -2.7, 1.0],
  [-3, G, -2.8, 1.2],
  [0, G, -2.7, 1.1],
  [4, G, -2.8, 1.0],
  [7, G, 2.6, 0.9],
  [27.5, G2, 2.7, 1.0],
  [32.5, G2, 2.8, 1.1],
  [36.8, G2, 2.7, 0.9],
  [40.8, G2, 2.8, 1.1],
  [44.8, G2, 2.7, 1.0],
  [49, G2, 2.8, 1.0],
  [53, G2, 2.7, 1.1],
  [81, G2, 2.7, 1.0],
  [84, G2, -2.8, 1.1],
  [87.5, G2, 2.7, 1.0],
  [100, D, 2.6, 1.0],
  [103.5, D, -2.7, 1.1],
  [109, D, 2.6, 1.0],
  [110.5, D, -2.7, 1.2],
].entries()) {
  adorno(`cafe-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 10 + i });
}
for (const [i, [x, y, z, r]] of [
  [-7.4, G, -2.6, 0.4],
  [10.6, G, 2.5, 0.35],
  [25.6, G2, 2.6, 0.45],
  [58.8, G2, 2.5, 0.4],
  [80.6, G2, -2.6, 0.45],
  [99, D, -2.6, 0.4],
  [111.2, D, 2.4, 0.4],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 60 + i });
}

// Niebla: la del cañón del río, la de la hondonada, la del cañón de las lianas y las capas entre las montañas
vacio("niebla-rio", [19, -2.5, 0], [8, 2, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.08 }, 0);
vacio("niebla-hondonada", [70, -1, 0], [10, 1.6, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.07 }, 0);
vacio("niebla-canon", [94, 2.5, 0], [6, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.06 }, 0);
vacio("niebla-1", [10, 2, -7], [20, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.14 }, 0);
vacio("niebla-2", [50, 4, -7.5], [22, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [95, 8, -7.5], [20, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-4", [30, 5, -12], [34, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-5", [85, 8, -12], [34, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-6", [52, 9, -18], [64, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("10-garrucha");
