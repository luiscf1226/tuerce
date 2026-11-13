// pnpm niveles: arma niveles/06-rio/escena.glb, el nivel 6 (TU-28): el Río Plátano, en La Mosquitia (Honduras).
// Selva, un río ancho, puentes colgantes y las huellas enormes del Sisimite, un gigante peludo con los pies al revés.
// Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md; el agua es la de La poza (TU-24).
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x; el río baja hacia −x. El agua del río está
// en y = 0 y la tierra en 0.3. Todo va corrido 53 m hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. el pipante, de a dos: amarrado junto al muelle. Uno empuja con la pértiga desde la popa y el otro lleva el
//      rumbo desde la proa, río arriba contra la corriente y entre dos piedras, hasta el embarcadero → punto 1
//   2. los rápidos: una quebrada brava cruza el camino; se pasa por un vado de piedras mientras la corriente baja
//      troncos por tres carriles. El tronco que lo alcanza tira al agua al que esté en el vado → punto 2
//   3. las huellas: el camino se parte en dos por un matorral. Los dedos de las huellas apuntan al de adelante, pero
//      el Sisimite tiene los pies al revés: se fue por el de atrás. El de adelante termina en un lodazal → punto 3
//   4. el puente colgante, de a dos: le faltan las tablas de dos huecos (1.6 m). Las dos tablas (9 kg, 5 m) están
//      sobre caballetes; se llevan entre los dos, en fila, y se sueltan tendidas sobre cada hueco → punto 4
//   5. el Sisimite, dormido en el cañón de lado a lado: se lo trepa de los pies al pecho → punto 5, en la cumbre.
//      Se despierta si alguien le cae encima de lo alto o le pisa la cara
//   6. la palmera, de a dos: uno la dobla jalando la soga y el otro se mete en el cogollo; al soltarla lo lanza
//      sobre el barranco. Del otro lado tira la liana (estaba colgada junto a la ceiba): queda colgando junto a la
//      orilla de acá y el otro cruza columpiándose → punto 6, la meta, a la entrada de la ciudad perdida
// El secreto: la figura de jade, arriba del templo de la ciudad perdida, detrás de la meta.
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 6,
  nombre: "Río Plátano",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** El agua del río y la tierra. */
const AGUA = 0;
const G = 0.3;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 124 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -53;
/** El fondo de los barrancos (hasta ahí bajan los bloques de la orilla). */
const HONDO = -6;

/** Una zona de agua: de x0 a x1 y de z0 a z1, del fondo a la superficie. `hacia`: adonde corre (`-x` o `+z`). */
function agua(nombre, x0, x1, z0, z1, fondo, superficie, extras = {}, hacia = "+z") {
  const haciaMenosX = hacia === "-x";
  const [sx, sz] = haciaMenosX ? [(z1 - z0) / 2, (x1 - x0) / 2] : [(x1 - x0) / 2, (z1 - z0) / 2];
  vacio(
    nombre,
    [(x0 + x1) / 2, (fondo + superficie) / 2, (z0 + z1) / 2],
    [sx, (superficie - fondo) / 2, sz],
    { tipo: "agua", ...extras },
    haciaMenosX ? -Math.PI / 2 : 0,
  );
}

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Una piedra redonda que choca: una bola aplastada, redonda también en la imagen. */
function bolon(nombre, [x, y, z], radio, alto = radio) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 14, 10).scale(1, alto / radio, 1));
  m.name = nombre;
  m.position.set(x, y, z);
  m.userData = { tipo: "solido", forma: "malla", material: "honda" };
  escena.add(m);
}

/** Un tronco de árbol de pie que choca (un cilindro). */
function arbol(nombre, [x, z], radio, alto, base = G) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.8, radio, alto, 14));
  m.name = nombre;
  m.position.set(x, base + alto / 2, z);
  m.userData = { tipo: "solido", forma: "cilindro", material: "corteza" };
  escena.add(m);
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

// ── 1. La playa, el muelle y el pipante ─────────────────────────────────────────────────────────────────────────
bloque("playa", [-8.5, -2, -3.2], [0, G, 3.2]);
// El muelle, del lado del fondo (−z): el pipante está amarrado a su lado, con el piso a la altura de las tablas
bloque("muelle", [-1, -0.2, -3.2], [6.5, G, -2.1], { material: "corteza" });
for (const x of [1, 3.5, 6])
  bloque(`muelle-pilote-${x}`, [x - 0.1, -2, -2.3], [x + 0.1, -0.2, -2.1], { material: "corteza" });
pieza("pipante", "pipante", [3.0, 0.14, -1.55], [4.4, 0.3, 0.9], { masa: 30, pertiga: 70, lado: 0.45, timon: 6 });
// El remanso (quieto) frente a la playa; el río (baja a 0.75 m/s hacia −x) con dos piedras que hay que esquivar; y
// otro remanso al pie del embarcadero, donde el pipante llega solo
agua("remanso", 0, 8, -3.2, 3.2, -2, AGUA, { arrastre: 1.5 }, "-x");
agua("rio", 8, 22, -2.6, 2.6, -2, AGUA, { corriente: 0.75, arrastre: 1.5 }, "-x");
agua("remanso-arriba", 22, 25, -2.6, 2.6, -2, AGUA, { arrastre: 1.5 }, "-x");
bloque("lecho-rio", [0, -2.6, -3.2], [25, -2, 3.2], { material: "honda" });
bolon("piedra-rio-1", [12.8, -0.1, 0.7], 0.8);
bolon("piedra-rio-2", [17.6, -0.1, -1.3], 0.8);
// El embarcadero, de lado a lado
bloque("embarcadero", [25, -2, -3.2], [28.5, G, 3.2], { material: "corteza" });

// ── 2. Los rápidos ──────────────────────────────────────────────────────────────────────────────────────────────
// La quebrada baja de atrás (−z) hacia la cámara (+z) a 2.4 m/s; el vado, una fila de piedras planas a ras del agua.
// Los troncos salen de debajo de la cascada del fondo y bajan por tres carriles (los mueve el guion)
agua("rapidos", 28.5, 36.5, -3.6, 3.2, -1.5, 0.1, { corriente: 2.4, arrastre: 2 });
agua("cascada", 28.5, 36.5, -3.9, -3.6, 0.1, 2.2, { imagen: "chorro" }, "+z");
bloque("lecho-rapidos", [28.5, -2.1, -3.9], [36.5, -1.5, 3.2], { material: "honda" });
for (let i = 0; i < 8; i++) {
  const x = 28.5 + i;
  bloque(`vado-${i + 1}`, [x, -1.5, -0.6 + 0.04 * Math.sin(i * 2)], [x + 1, G, 0.6 - 0.05 * Math.cos(i * 3)], {
    material: "honda",
  });
}
for (const [i, x] of [29.9, 32.5, 35.1].entries()) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 12).rotateZ(Math.PI / 2));
  m.name = `tronco-rio-${i + 1}`;
  m.position.set(x, -1, -4.2);
  m.userData = { tipo: "solido", cuerpo: "cinematico", material: "corteza" };
  escena.add(m);
}

// ── 3. Las huellas ──────────────────────────────────────────────────────────────────────────────────────────────
// El camino se parte en dos carriles por un matorral (alto y espeso: no se lo trepa). El de adelante (+z) termina en
// un lodazal que se lo traga a uno; el de atrás sigue
bloque("orilla-rapidos", [36.5, HONDO, -3.2], [45, G, 3.2]);
bloque("carril-atras", [45, HONDO, -3.2], [48.5, G, 0.35]);
agua("lodazal", 45, 48.5, 0.35, 3.2, -1.5, G - 0.05, { arrastre: 4 });
bloque("lecho-lodazal", [45, -2, 0.35], [48.5, -1.5, 3.2], { material: "honda" });
bloque("matorral", [41, G, -0.35], [48.5, G + 1.3, 0.35], { material: "honda" });
bloque("matorral-alto", [41, G + 1.3, -0.35], [48.5, G + 3.5, 0.35], { invisible: 1 });

// ── 4. El puente colgante ───────────────────────────────────────────────────────────────────────────────────────
bloque("antes-del-puente", [48.5, HONDO, -3.2], [61, G, 3.2]);
// Las dos tablas, cada una sobre dos caballetes a la altura de las manos alzadas, una detrás de la otra (se llevan
// en fila con la mano derecha: cada uno camina 45 cm a la izquierda de la tabla, por al lado de los caballetes)
for (const [i, [x, a, b]] of [
  [58.3, 56.6, 60.0],
  [52.6, 51.2, 54.0],
].entries()) {
  for (const [k, xc] of [a, b].entries())
    bloque(
      `caballete-${i + 1}${k === 0 ? "a" : "b"}`,
      [xc - 0.12, G, 0.12 - 0.15],
      [xc + 0.12, G + 0.85, 0.12 + 0.15],
      {
        material: "corteza",
      },
    );
  pieza(`puente-${i + 1}`, "tronco", [x, G + 0.91, 0.12], [5.0, 0.12, 0.6], { masa: 9 });
}
// El puente: 10 m sobre la cañada, con el piso a la altura de la tierra en las puntas y dos huecos de 1.6 m
pieza("puente", "puente", [66, G - 0.2, 0], [10, 0.4, 1.0], { comba: 0.25, huecos: 2, hueco: 1.6, mecer: 0.04 });

// ── 5. El cañón del Sisimite ────────────────────────────────────────────────────────────────────────────────────
bloque("despues-del-puente", [71, HONDO, -3.2], [97, G, 3.2]);
// El cañón: 3.4 m de ancho, de pared a pared; el Sisimite lo llena de lado a lado, con los pies hacia el oeste
bloque("canon-atras", [73.5, G, -4.4], [86.5, G + 5, -1.7], { material: "tela" });
bloque("canon-frente", [73.5, G, 1.7], [86.5, G + 5, 3.5], { invisible: 1 });
pieza("sisimite", "sisimite", [80, G + 1.3, 0], [12, 2.6, 3.4], { aterrizaje: 3.6, revolverse: 3, empujon: 2.5 });

// ── 6. La palmera y el barranco ─────────────────────────────────────────────────────────────────────────────────
// La palmera mira hacia el barranco (+x): se dobla hacia atrás jalando su soga, que cuelga de costado (+z)
pieza(
  "palmera",
  "palmera",
  [95.6, G + 1.7, 0],
  [0.36, 3.4, 0.36],
  { angulo: 85, soga: 2.4, lado: 1.3, fuerza: 20, lanzar: 6.5, elevacion: 35 },
  Math.PI / 2,
);
// El barranco (2.2 m, ni se salta) y la otra orilla, la de la ciudad perdida
bloque("barranco-fondo", [97, HONDO, -3.2], [99.2, -4, 3.2], { material: "honda" });
bloque("ciudad", [99.2, HONDO, -3.2], [115, G, 3.2]);
// La ceiba de la otra orilla y su rama, que pasa por encima del barranco. La liana cuelga sobre el barranco a 30 cm
// de la orilla de acá, con la punta a 1 m del suelo, como el bejuco del pinar; el guion la empieza recogida junto a
// la ceiba (del otro lado) y la suelta cuando la tiran
arbol("ceiba", [104.6, -2.1], 0.9, 11);
imagen(
  "rama-de-la-ceiba",
  (() => {
    const desde = new THREE.Vector3(104.4, G + 4.6, -1.7);
    const hasta = new THREE.Vector3(96.8, G + 3.95, 0);
    const g = new THREE.CylinderGeometry(0.12, 0.3, desde.distanceTo(hasta), 10);
    g.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), hasta.clone().sub(desde).normalize()),
    );
    return g;
  })(),
  [(104.4 + 96.8) / 2, G + (4.6 + 3.95) / 2, -0.85],
);
pieza("liana", "bejuco", [97.3, G + 2.45, 0], [0.08, 2.9, 0.08]);

// ── La ciudad perdida: la meta y el templo del secreto ──────────────────────────────────────────────────────────
// El templo, al fondo: dos gradas de 1.4 m (se trepan colgándose) y arriba, en su nicho, la figura de jade
bloque("templo-1", [109, G, -3.2], [115, G + 1.4, -0.4], { material: "tela" });
bloque("templo-2", [111, G + 1.4, -3.2], [115, G + 2.8, -1.4], { material: "tela" });
bloque("nicho-izquierda", [111.6, G + 2.8, -3.2], [111.9, G + 3.9, -2.2], { material: "honda" });
bloque("nicho-derecha", [113.1, G + 2.8, -3.2], [113.4, G + 3.9, -2.2], { material: "honda" });
bloque("nicho-fondo", [111.6, G + 2.8, -3.2], [113.4, G + 4.2, -2.9], { material: "honda" });
vacio("secreto", [112.5, G + 3.3, -2.4], [0.5, 0.5, 0.5], { tipo: "secreto" }, 0);
// Una estela labrada y columnas caídas
bloque("estela", [107.2, G, 1.6], [107.8, G + 2.4, 2.0], { material: "tela" });
adorno("columna-caida", [103.2, G + 0.25, 2.2], { forma: "tronco", alto: 2.4, radio: 0.28, semilla: 21 }, 0.4);

// ── Bordes: la peña del fondo (−z) y una pared invisible del lado de la cámara (+z) ─────────────────────────────
bloque("pena-playa", [-8.5, -2, -4.4], [8, 3.6, -3.2], { material: "tela" });
bloque("pena-rio", [8, -2, -4.4], [22, 4.4, -2.6], { material: "tela" });
bloque("pena-embarcadero", [22, -2, -4.4], [28.5, 4.4, -3.2], { material: "tela" });
bloque("pena-rapidos", [28.5, -2, -5.2], [36.5, 4.4, -3.9], { material: "tela" });
bloque("pena-huellas", [36.5, G, -4.4], [73.5, 4.6, -3.2], { material: "tela" });
bloque("pena-palmera", [86.5, G, -4.4], [115, 5.6, -3.2], { material: "tela" });
bloque("borde-playa", [-8.5, G, 3.2], [0, G + 2, 3.5], { invisible: 1 });
bloque("borde-remanso", [0, -2, 3.2], [8, 2.5, 3.5], { invisible: 1 });
bloque("borde-rio", [8, -2, 2.6], [25, 3, 2.9], { invisible: 1 });
bloque("borde-embarcadero", [25, G, 3.2], [28.5, G + 2, 3.5], { invisible: 1 });
bloque("borde-rapidos", [28.5, -2, 3.2], [36.5, 2.5, 3.5], { invisible: 1 });
bloque("borde-este", [115, HONDO, -3.2], [115.3, 6, 3.2], { invisible: 1 });
bloque("borde-oeste", [-8.8, -2, -3.2], [-8.5, 3, 3.2], { invisible: 1 });
bloque("borde-selva", [36.5, G, 3.2], [115, G + 4, 3.5], { invisible: 1 });
// La cañada del puente y el barranco: también cerrados de los lados (para no bajar por la orilla)
bloque("borde-canada", [61, HONDO, 3.2], [71, G + 2, 3.5], { invisible: 1 });
bloque("borde-canada-atras", [61, HONDO, -4.4], [71, G + 3, -3.2], { material: "tela" });
// Del lado de acá del río, bolones a ras del agua (se ven, y el pipante los topa)
for (const [i, [x, z, r]] of [
  [1.5, 3.4, 0.55],
  [4.6, 3.5, 0.7],
  [9.4, 2.95, 0.6],
  [14.6, 3.0, 0.75],
  [19.4, 2.95, 0.55],
  [23.4, 3.0, 0.65],
].entries()) {
  bolon(`bolon-orilla-${i + 1}`, [x, AGUA - 0.1, z], r, r * 0.8);
}

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-7.4, G, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-7.4, G, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [26.6, G + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 1 });
vacio("control-2", [37.6, G + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 2 });
vacio("control-3", [49.3, G + 1, 0], [2.6, 1, 0.6], { tipo: "control", orden: 3 });
vacio("control-4", [72.3, G + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 4 });
// El 5 en la cumbre del Sisimite, sobre su pecho
vacio("control-5", [81.8, G + 2.6 + 1, 0], [1.4, 1, 0.6], { tipo: "control", orden: 5 });
// El 6, la meta, a la entrada de la ciudad perdida (aparece cuando tiran la liana)
vacio("control-6", [106.3, G + 1, 0.6], [1.6, 1, 0.8], { tipo: "control", orden: 6 });

// ── Adornos: la selva ───────────────────────────────────────────────────────────────────────────────────────────
// Abetos lejanos detrás de la peña (las palmeras de la selva las pone el guion); matas y rocas en las orillas
for (let i = 0; i < 26; i++) {
  const x = -12 + i * 5;
  adorno(`abeto-${i + 1}`, [x, -4, -14 - (i % 3) * 3], { forma: "abeto", alto: 10 + (i % 4) * 2 });
}
for (const [i, [x, y, z, alto]] of [
  [-8, G, 2.6, 1],
  [-6, G, -2.8, 0.9],
  [27.8, G, 2.6, 0.8],
  [38.4, G, -2.8, 1.1],
  [41.5, G, 2.8, 0.9],
  [43.2, G, 0.45, 1.2],
  [46.8, G + 1.3, 0, 1.0],
  [44.2, G + 1.3, 0, 1.1],
  [42.0, G + 1.3, 0, 0.9],
  [49.6, G, 2.8, 1.0],
  [55.4, G, -2.8, 0.9],
  [72.6, G, 2.6, 1.0],
  [88.0, G, -2.8, 1.2],
  [93.4, G, 2.7, 0.9],
  [101.6, G, 2.7, 1.1],
  [108.6, G, 2.8, 1.0],
  [114.2, G + 1.4, -0.8, 0.9],
].entries()) {
  adorno(`mata-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 40 + i });
}
for (const [i, [x, y, z, r]] of [
  [-7.2, G, -2.6, 0.45],
  [-3.4, G, 2.7, 0.35],
  [27.2, G, -2.7, 0.4],
  [37.0, G, 2.6, 0.5],
  [60.2, G, 2.5, 0.4],
  [71.8, G, -2.6, 0.45],
  [87.2, G, 2.5, 0.35],
  [100.4, G, -2.6, 0.5],
  [110.2, G, 2.4, 0.4],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 70 + i });
}

// Niebla: el vapor del río, de los rápidos y de la cañada, y capas entre los árboles
vacio("niebla-rio", [14, 0.6, 0], [9, 1.2, 1], { tipo: "niebla", opacidad: 0.4, velocidad: -0.1 }, 0);
vacio("niebla-rapidos", [32.5, 0.8, -2.5], [4, 1.4, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.08 }, 0);
vacio("niebla-canada", [66, -1.5, 0], [5, 1.8, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.06 }, 0);
vacio("niebla-barranco", [98, -1.2, 0], [3, 1.5, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.07 }, 0);
vacio("niebla-1", [5, 1.5, -6], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [40, 2.5, -6.5], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [80, 2.5, -6.5], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-4", [25, 3, -10], [30, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-5", [90, 4, -10], [30, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-6", [52, 5, -15], [64, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("06-rio");
