// pnpm niveles: arma niveles/07-trenzas/escena.glb, el nivel 7 (TU-40): Las trenzas, en Antigua (Guatemala). Calles
// de fachadas en grises (los colores de la Antigua, sin color: solo los pañuelos lo tienen), arcos, ruinas de
// iglesias y un volcán al fondo; ahí anda el Sombrerón, que le hace trenzas a todo. Como los otros, sin Blender: las
// mismas propiedades (`extras`) que se pondrían en Blender. La convención está en niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. El suelo está en y = 0. Todo va corrido 38 m
// hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. el nudo, de a dos: las cuerdas trenzadas amarran el portón del arco. Cada uno jala de un cabo (a 4 m uno de
//      otro); jalando los dos a la vez se desatan y el portón se abre → punto 1
//   2. la mula: no da un paso sin su carga. Se suben los dos bultos del poyo a su lomo y se la lleva de la rienda,
//      por al lado de la pila, hasta el mesón; el mesonero abre el zaguán → punto 2
//   3. las ruinas: el piso de la iglesia se hundió; se cruza saltando de arco caído en arco caído → punto 3
//   4. el balde, de a dos: la fuente está de este lado del pretil (delgado, no se trepa) y las piedras calientes del
//      otro. Uno trepa el muro caído; el otro llena el balde y se lo pasa por encima del pretil, de mano en mano; el
//      de allá apaga las dos piedras del pasillo → punto 4
//   5. el sombrero: el del Sombrerón rodó hasta abajo. Se lo empuja rodando cuesta arriba hasta su plaza; él va por
//      él y se lo pone, y aparece la meta → punto 5. Sin su sombrero, al que entra a su plaza le hace trenzas
// El secreto: el barrilete escondido en el campanario, en la plaza del Sombrerón.
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 7,
  nombre: "Las trenzas",
  vacio: -2.5,
  nieblaCerca: 3,
  nieblaLejos: 28,
});

/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 92 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -38;
/** La plaza de arriba (la del Sombrerón). */
const ALTA = 1.5;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

/** Una fachada al fondo (−z): de x0 a x1, con su alto y su gris (los colores de la Antigua, en grises). */
function fachada(nombre, x0, x1, alto, material, base = 0) {
  bloque(nombre, [x0, base, -4.4], [x1, base + alto, -3.2], { material });
}

// ── La salida: la calle del arco ────────────────────────────────────────────────────────────────────────────────
bloque("calle-1", [-8, -1, -3.2], [30, 0, 3.2]);
fachada("fachada-1", -8, -2, 4.2, "lejana");
fachada("fachada-2", -2, 3, 5, "tela");
fachada("fachada-3", 3, 7, 3.8, "suelo");

// ── 1. El nudo y el portón del arco ─────────────────────────────────────────────────────────────────────────────
// El arco cruza la calle; el portón (dos hojas) está amarrado con las cuerdas trenzadas, de lado a lado delante de
// él. Los cabos quedan a 4 m uno de otro, a la altura de las manos
// (la torrecita del reloj la dibuja el guion, sobre el pilar del fondo)
fachada("arco-1-pilar", 7, 7.9, 5, "lejana");
// El portón es bajo (2 m) para que la cámara vea a los que desatan el nudo, y delgado: no se trepa
bloque("porton-1a", [7.3, 0, -3.2], [7.55, 2, 0], { cuerpo: "cinematico", material: "corteza" });
bloque("porton-1b", [7.3, 0, 0], [7.55, 2, 3.2], { cuerpo: "cinematico", material: "corteza" });
pieza("nudo", "nudo", [6.1, 1.0, 0], [0.1, 0.1, 4.0], { recorrido: 0.5, umbral: 0.65, fuerza: 25, desatar: 2.5 });

// ── 2. La mula, la pila y el mesón ──────────────────────────────────────────────────────────────────────────────
fachada("fachada-4", 7.9, 13, 4.6, "suelo");
fachada("fachada-5", 13, 18, 3.6, "honda");
fachada("fachada-6", 18, 23.5, 5.2, "lejana");
fachada("fachada-7", 23.5, 28.6, 4.4, "tela");
// La mula, mirando hacia el este, y sus dos bultos, cada uno sobre su pilar (a la altura de las manos; delgados,
// para que se llegue con las manos)
pieza("mula", "mula", [13.8, 0.55, -1.4], [1.5, 1.1, 0.55], { velocidad: 1.2, rienda: 1.3, carga: 2 });
for (const [i, x] of [11.65, 12.45].entries()) {
  bloque(`pilar-bulto-${i + 1}`, [x - 0.12, 0, 1.93], [x + 0.12, 0.7, 2.17], { material: "tela" });
  pieza(`mula-${i + 1}`, "huacal", [x, 0.88, 2.05], [0.5, 0.36, 0.4], { masa: 4 });
}
// La pila en medio de la calle (hay que llevar a la mula por al lado)
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 0.75, 20));
  m.name = "pila-calle";
  m.position.set(19.5, 0.375, -1.2);
  m.userData = { tipo: "solido", forma: "cilindro", material: "lejana" };
  escena.add(m);
}
// El mesón: un muro con su zaguán (dos hojas que se abren cuando llega la carga)
bloque("meson-a", [28, 0, -3.2], [28.6, 3.6, -1.3], { material: "suelo" });
bloque("meson-b", [28, 0, 1.3], [28.6, 3.6, 3.2], { material: "suelo" });
bloque("meson-dintel", [28, 2.6, -1.3], [28.6, 3.6, 1.3], { material: "suelo" });
bloque("zaguan-a", [28.15, 0, -1.3], [28.4, 2.6, 0], { cuerpo: "cinematico", material: "corteza" });
bloque("zaguan-b", [28.15, 0, 0], [28.4, 2.6, 1.3], { cuerpo: "cinematico", material: "corteza" });

// ── 3. Las ruinas de la iglesia ─────────────────────────────────────────────────────────────────────────────────
bloque("calle-2", [30, -1, -3.2], [34.5, 0, 3.2]);
fachada("fachada-8", 28.6, 32.2, 3.4, "honda");
// La fachada de la iglesia, con su puerta grande
bloque("iglesia-a", [32.2, 0, -3.2], [32.8, 6, -1.6], { material: "lejana" });
bloque("iglesia-b", [32.2, 0, 1.6], [32.8, 6, 3.2], { material: "lejana", invisible: 1 });
bloque("iglesia-dintel", [32.2, 3.4, -1.6], [32.8, 6, 1.6], { material: "lejana" });
// El piso se hundió: abajo, escombros (cuenta como caída); se cruza de arco caído en arco caído
bloque("escombro", [34.5, -3.6, -3.2], [42.3, -3, 3.2], { material: "honda" });
vacio("foso", [38.4, -1.9, 0], [3.9, 1.1, 3.2], { tipo: "vacio" }, 0);
for (const [i, [x0, x1, arriba]] of [
  [35.1, 36.3, 0],
  [36.9, 38.1, 0.2],
  [38.7, 39.9, 0],
  [40.5, 41.7, 0.25],
].entries()) {
  bloque(`arco-caido-${i + 1}`, [x0, -3, -1.1], [x1, arriba, 1.1], { material: "tela" });
}
bloque("nave", [32.8, -1, -4.4], [46, 6, -3.2], { material: "lejana" });
bloque("calle-3", [42.3, -1, -3.2], [65, 0, 3.2]);

// ── 4. La fuente, el pretil y las piedras calientes ─────────────────────────────────────────────────────────────
fachada("fachada-9", 46, 51, 3.2, "suelo");
// La fuente de pared (su caño, de donde se llena el balde, lo dibuja el guion) y el balde en su poyo
bloque("fuente", [46.8, 0, -3.2], [48.4, 1.25, -2.5], { material: "tela" });
bloque("pilar-balde", [45.83, 0, -2.72], [46.07, 0.7, -2.48], { material: "tela" });
pieza("balde", "balde", [45.95, 0.88, -2.6], [0.44, 0.36, 0.44], { masa: 3, suelto: 0.3, vuelve: 3 });
// El pretil: delgado (no se trepa) y bajo (el balde pasa por encima, de mano en mano). Al fondo, el muro caído
// (1.4 m), que se trepa colgándose: con el balde en la mano no se puede
bloque("pretil", [51.4, 0, -1.5], [51.52, 0.85, 3.2], { material: "lejana" });
bloque("muro-caido", [50.9, 0, -3.2], [52, 1.4, -1.5], { material: "tela" });
bloque("muro-caido-escalon", [52, 0, -3.2], [52.7, 0.7, -1.5], { material: "tela" });
fachada("fachada-10", 52, 56, 3.6, "honda");
// El pasillo de la sacristía, con las dos piedras calientes
bloque("pasillo-a", [56, 0, -3.2], [60.4, 3.2, -0.8], { material: "tela" });
bloque("pasillo-b", [56, 0, 0.8], [60.4, 3.2, 3.2], { material: "tela", invisible: 1 });
bloque("pasillo-b-bajo", [56, 0, 0.8], [60.4, 0.6, 3.2], { material: "tela" });
pieza("brasa-1", "brasa", [56.9, 0.225, 0], [0.8, 0.45, 1.6], { empujon: 3.4, alcance: 0.9 });
pieza("brasa-2", "brasa", [58.9, 0.225, 0], [0.8, 0.45, 1.6], { empujon: 3.4, alcance: 0.9 });
fachada("fachada-11", 56, 60.4, 4.4, "tela");

// ── 5. La cuesta y la plaza del Sombrerón ───────────────────────────────────────────────────────────────────────
fachada("fachada-12", 60.4, 65, 3.8, "lejana");
// El sombrero gigante, de canto, al pie de la cuesta
pieza("sombrero", "sombrerote", [63.2, 0.85, 0], [1.7, 1.7, 0.7], { masa: 5, rozamiento: 1 });
// La cuesta: de 0 a 1.5 m en 8 m, con una pared a cada lado
{
  const g = new THREE.BoxGeometry(8, 1, 2.8, 8, 1, 1);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const arriba = p.getY(i) > 0;
    p.setY(i, arriba ? (ALTA * (x + 4)) / 8 : -1);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g);
  m.name = "cuesta";
  m.position.set(69, 0, 0);
  m.userData = { tipo: "solido", forma: "malla", material: "suelo" };
  escena.add(m);
}
bloque("cuesta-pared-a", [65, 0, -3.2], [73, 2.4, -1.4], { material: "tela" });
bloque("cuesta-pared-b", [65, 0, 1.4], [73, 3.4, 1.6], { invisible: 1 });
bloque("cuesta-lado-b", [65, 0, 1.6], [73, 0.4, 3.2], { material: "suelo" });
fachada("fachada-13", 65, 73, 5, "tela");
// La plaza de arriba
bloque("plaza-alta", [73, -1, -3.2], [84, ALTA, 3.2]);
fachada("fachada-14", 73, 80.4, 4.2, "suelo", ALTA);
// El Sombrerón: su caja es su plaza (de 73 a 80.4); su casa, el medio, mirando hacia la cuesta
pieza(
  "sombreron",
  "sombreron",
  [76.7, ALTA + 1.25, 0],
  [6, 2.5, 7.4],
  { velocidad: 1, alcance: 0.7, tocar: 4, empujon: 3.6 },
  -Math.PI / 2,
);
// El campanario: un escalón de 1.45 m y la torre (otros 1.45), que se trepan colgándose; arriba, el barrilete
bloque("campanario-escalon", [80.4, ALTA, -3.2], [81.6, ALTA + 1.45, -1.2], { material: "lejana" });
bloque("campanario", [81.6, ALTA, -3.2], [84, ALTA + 2.9, -0.6], { material: "lejana" });
fachada("fachada-15", 80.4, 84, 5.2, "lejana", ALTA);
vacio("secreto", [82.8, ALTA + 3.4, -1.9], [0.6, 0.5, 0.6], { tipo: "secreto" }, 0);

// ── Bordes ──────────────────────────────────────────────────────────────────────────────────────────────────────
bloque("borde-oeste", [-8.3, -1, -3.2], [-8, 3, 3.2], { invisible: 1 });
bloque("borde-este", [84, ALTA, -3.2], [84.3, 6, 3.2], { invisible: 1 });
bloque("borde-frente", [-8, 0, 3.2], [84, 4, 3.5], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-6.5, 0, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-6.5, 0, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [10.6, 1, 0], [2.4, 1, 0.8], { tipo: "control", orden: 1 });
vacio("control-2", [30.9, 1, 0], [2.4, 1, 0.8], { tipo: "control", orden: 2 });
vacio("control-3", [44.4, 1, 0], [2.4, 1, 0.8], { tipo: "control", orden: 3 });
vacio("control-4", [61.6, 1, 0], [2.4, 1, 0.8], { tipo: "control", orden: 4 });
// El 5, la meta, en la plaza del Sombrerón (aparece cuando se pone el sombrero)
vacio("control-5", [75.4, ALTA + 1, 1.6], [1.2, 1, 1.2], { tipo: "control", orden: 5 });

// ── Adornos: matas y piedras al pie de las fachadas, y la niebla ────────────────────────────────────────────────
for (const [i, [x, y, z, alto]] of [
  [-4.5, 0, -2.9, 0.8],
  [9.6, 0, -2.9, 0.7],
  [16.5, 0, 2.8, 0.9],
  [22.8, 0, -2.9, 0.8],
  [33.6, 0, -2.8, 1.0],
  [44.8, 0, 2.7, 0.9],
  [53.6, 0, 2.7, 1.0],
  [61.0, 0, -2.8, 0.9],
  [74.0, ALTA, -2.8, 0.8],
].entries()) {
  adorno(`mata-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 120 + i });
}
for (const [i, [x, y, z, r]] of [
  [31.2, 0, 2.6, 0.35],
  [43.2, 0, -2.6, 0.45],
  [49.6, 0, 2.6, 0.3],
  [62.4, 0, 2.6, 0.35],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 150 + i });
}
adorno("columna-caida-1", [37.5, -2.7, 2.2], { forma: "tronco", alto: 3, radio: 0.3, semilla: 31 }, 0.5);
adorno("columna-caida-2", [41, -2.75, -2.3], { forma: "tronco", alto: 2.4, radio: 0.28, semilla: 32 }, -0.3);

vacio("niebla-1", [5, 2, -6], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [40, 2.5, -6.5], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.1 }, 0);
vacio("niebla-3", [75, 3, -6.5], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-foso", [38.4, -2, 0], [4, 1.4, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.06 }, 0);
vacio("niebla-4", [20, 4, -12], [30, 5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: -0.16 }, 0);
vacio("niebla-5", [65, 5, -12], [30, 5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.14 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("07-trenzas");
