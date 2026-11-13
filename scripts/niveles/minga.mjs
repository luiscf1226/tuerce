// pnpm niveles: arma niveles/14-minga/escena.glb, el nivel 14 (TU-47): La minga, en Chiloé (Chile). Palafitos sobre
// la marea, el bosque mojado, un muelle y El Caleuche, el barco fantasma que en realidad anda de fiesta. Como los
// otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md; el agua es la de La poza.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. La playa de la caleta está en y = 0 y la marea
// la tapa y la destapa (de −0.4 a 0.9, la mueve el guion); los corredores de los palafitos, la explanada y el muelle
// están en 1.2; la cubierta del Caleuche en 3 y el muelle de la fiesta en 2.4. Todo va corrido 52 m hacia −x (`DX`),
// para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. los palafitos: la playa solo se pasa con la marea baja. Del camino al primer palafito, de ahí al segundo y del
//      segundo a la explanada: cada tramo alcanza en una bajamar, dos seguidos no → punto 1, en la explanada
//   2. la minga, de a dos: la casa va sobre un camino de troncos; cada uno tira de un cabo, caminando para atrás. Llega
//      a su sitio y los vecinos abren la tranquera → punto 2. Llevarla sin que se salga de los troncos da el logro,
//      «A hombro»
//   3. la chalupa, de a dos: fondeada lejos del muelle, con sus dos cabos colgando de un poste en la orilla. Cada uno
//      lleva un cabo a su bita (están a 5 m): con los dos a la vez se amarra y se arrima. Cruzándola se llega al
//      ancla del Caleuche, que cuelga del otro lado → punto 3, en los brazos del ancla
//   4. parado en los brazos del ancla, lo suben hasta la borda → punto 4, en la cubierta
//   5. con los dos a bordo empieza la fiesta y la cubierta se mece; aguantando la canción entera sin caerse al agua,
//      El Caleuche baja la plancha de la popa al muelle de la fiesta → punto 5, la meta
// El secreto: un curanto enterrado en la playa, detrás del último palafito (solo con la marea baja).
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 14,
  nombre: "La minga",
  vacio: -2.5,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** La playa, lo alto (camino, palafitos, explanada y muelle), la cubierta del Caleuche y el muelle de la fiesta. */
const ARENA = 0;
const P = 1.2;
const CUBIERTA = 3;
const FIN = 2.4;
/** La marea alta (la caja del agua de la caleta llega hasta acá; el guion la baja y la sube). */
const PLEAMAR = 0.9;
/** El fondo del mar. */
const FONDO = -1.5;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 116 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -52;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Una zona de agua: de x0 a x1 y de z0 a z1, del fondo a la superficie. */
function agua(nombre, x0, x1, z0, z1, superficie, extras = {}) {
  vacio(
    nombre,
    [(x0 + x1) / 2, (FONDO + superficie) / 2, (z0 + z1) / 2],
    [(z1 - z0) / 2, (superficie - FONDO) / 2, (x1 - x0) / 2],
    { tipo: "agua", arrastre: 1.5, ...extras },
    -Math.PI / 2,
  );
}

const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });
/** Una rampa de suelo de (x0, y0) a (x1, y1) a lo ancho de z0 a z1 (invisible: los escalones los pone el guion),
 * con su relleno debajo hasta la arena. */
function rampa(nombre, [x0, y0], [x1, y1], [z0, z1]) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo = Math.hypot(dx, dy);
  const angulo = Math.atan2(dy, dx);
  const grueso = 0.4;
  const m = new THREE.Mesh(new THREE.BoxGeometry(largo, grueso, z1 - z0), gris);
  m.name = nombre;
  m.position.set(
    (x0 + x1) / 2 + Math.sin(angulo) * (grueso / 2),
    (y0 + y1) / 2 - Math.cos(angulo) * (grueso / 2),
    (z0 + z1) / 2,
  );
  m.rotation.set(0, 0, angulo);
  m.userData = { tipo: "solido", material: "corteza" };
  escena.add(m);
  // El relleno: bajo la rampa, hasta la arena, que no asoma
  const tramos = Math.max(1, Math.ceil(largo / 0.8));
  for (let i = 0; i < tramos; i++) {
    const xa = x0 + (dx * i) / tramos;
    const xb = x0 + (dx * (i + 1)) / tramos;
    const arriba = Math.min(y0 + (dy * i) / tramos, y0 + (dy * (i + 1)) / tramos) - 0.3;
    if (arriba <= ARENA) continue;
    bloque(`${nombre}-relleno-${i + 1}`, [xa, ARENA, z0 + 0.05], [xb, arriba, z1 - 0.05], { invisible: 1 });
  }
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

// ── 1. El camino de la costanera, la playa y los palafitos ─────────────────────────────────────────────────────
bloque("costanera", [-6, FONDO, -3.2], [0, P, 3.2]);
rampa("bajada-costanera", [0, P], [2.6, ARENA], [-3.2, 3.2]);
bloque("playa", [0, FONDO, -3.2], [42.6, ARENA, 3.2], { material: "suelo" });
// Los palafitos: el corredor (lo que se pisa) adelante y la casa atrás, con los pilotes rellenos (no se pasa por
// debajo). La casa y el corredor los dibuja el guion; acá, lo que choca
const PALAFITOS = [
  { x0: 8.6, x1: 13.6 },
  { x0: 22, x1: 27 },
];
for (const [i, { x0, x1 }] of PALAFITOS.entries()) {
  const n = i + 1;
  bloque(`corredor-${n}`, [x0, P - 0.2, -1.2], [x1, P, 0.4], { material: "corteza", invisible: 1 });
  bloque(`casa-palafito-${n}`, [x0, P, -3.2], [x1, P + 2.4, -1.2], { invisible: 1 });
  bloque(`pilotes-${n}`, [x0, ARENA, -3.2], [x1, P - 0.2, 0.4], { invisible: 1 });
  rampa(`subida-palafito-${n}`, [x0 - 2.6, ARENA], [x0, P], [-1.2, 0.4]);
  rampa(`bajada-palafito-${n}`, [x1, P], [x1 + 2.6, ARENA], [-1.2, 0.4]);
}
// La caleta: la marea sube y baja sobre la playa; detrás de los palafitos, el mar hondo
agua("marea", 0, 42.6, -9, 3.2, PLEAMAR, { arrastre: 1.2 });
bloque("lecho-caleta", [0, FONDO - 0.5, -9], [42.6, FONDO, -3.2], { material: "honda" });
// El curanto del secreto: enterrado en la playa, detrás del segundo palafito y cerca del mar
vacio("secreto", [33, ARENA + 0.5, -2.55], [0.6, 0.5, 0.55], { tipo: "secreto" }, 0);

// ── 2. La explanada de la minga ────────────────────────────────────────────────────────────────────────────────
rampa("subida-explanada", [40, ARENA], [42.6, P], [-3.2, 3.2]);
bloque("explanada", [42.6, FONDO, -3.2], [64, P, 3.2], { material: "suelo" });
// Detrás de la explanada, la punta de tierra con el bosque (separa la caleta del puerto)
bloque("punta", [42.6, FONDO, -9], [64, P, -3.2], { material: "lejana" });
// La casa sobre los troncos (12 cm de radio, medio enterrados), con los cabos adelante; anda 6.5 m hacia el este
pieza("casa", "minga", [48.6, P + 0.12 + 1.1, 0], [3.2, 2.2, 2.4], {
  recorrido: 6.5,
  cabo: 2,
  estirar: 0.4,
  fuerza: 24,
  umbral: 0.45,
  velocidad: 0.7,
  margen: 0.35,
  atasco: 3,
});
// La tranquera del sitio nuevo: la abre el guion cuando llega la casa (2.6 m: no se trepa)
bloque("tranquera", [61.2, P, -3.2], [61.45, P + 2.6, 3.2], { cuerpo: "cinematico", material: "corteza" });

// ── 3. El muelle y la chalupa ──────────────────────────────────────────────────────────────────────────────────
bloque("muelle", [64, FONDO, -0.8], [86, P, 3.2], { material: "corteza" });
// La chalupa amarrada va junto al muelle (centro en x 80); suelta, fondeada 4 m hacia el oeste y 2.4 m más afuera
pieza("chalupa", "chalupa", [80, 0.185, -1.8], [5, 0.4, 2], {
  masa: 150,
  cabo: 7,
  fondeo: 2.4,
  corrida: 4,
  muelle: 1,
  alto: 0.815,
  nudo: 1,
  alcance: 0.5,
});
// El agua del puerto: quieta, hasta el muelle de la fiesta
agua("puerto", 64, 112, -9, 3.2, 0, { arrastre: 1.5 });
bloque("lecho-puerto", [64, FONDO - 0.5, -9], [112, FONDO, 3.2], { material: "honda" });

// ── 4 y 5. El Caleuche, su ancla y el muelle de la fiesta ──────────────────────────────────────────────────────
// El casco: de x 80 (la proa) a 100 (la popa), con la cubierta a 3 m; el portalón (por donde llega el ancla) a 1.2 m
// de la proa
pieza("caleuche", "caleuche", [90, 1, -5.6], [20, 4, 4], {
  compases: 24,
  compas: 0.8,
  rolido: 7,
  plancha: 3.4,
  bajada: CUBIERTA - FIN,
  portalon: 1.2,
});
// El ancla: sus brazos van de la altura del piso de la chalupa (0.385) a la de la cubierta
pieza("ancla", "ancla", [81.2, (0.385 + CUBIERTA) / 2, -3.22], [1.2, CUBIERTA - 0.385, 0.6], {
  velocidad: 0.6,
  espera: 0.6,
  arriba: 2.5,
});
bloque("muelle-fiesta", [103, FONDO, -7.6], [110, FIN, -3.6], { material: "corteza" });

// ── Bordes: paredes invisibles del lado de la cámara (+z), del fondo de la playa y la explanada, y las puntas ─────
bloque("borde-frente", [-6, FONDO, 3.2], [110, P + 3, 3.5], { invisible: 1 });
bloque("borde-atras-playa", [0, FONDO, -3.5], [64, P + 3, -3.2], { invisible: 1 });
bloque("borde-atras-costanera", [-6, FONDO, -3.5], [0, P + 3, -3.2], { invisible: 1 });
bloque("borde-oeste", [-6.3, FONDO, -3.2], [-6, P + 3, 3.2], { invisible: 1 });
bloque("borde-este", [110, FONDO, -7.6], [110.3, FIN + 3, -3.6], { invisible: 1 });
bloque("borde-fiesta-atras", [103, FONDO, -7.9], [110, FIN + 3, -7.6], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-3, P, 0.6], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-3, P, -0.4], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El 1 arriba de la explanada, pasando la rampa
vacio("control-1", [43.6, P + 1, 1.6], [1.6, 1, 1], { tipo: "control", orden: 1 });
// El 2 pasando la tranquera
vacio("control-2", [63, P + 1, 1.2], [2, 1, 1], { tipo: "control", orden: 2 });
// El 3 en los brazos del ancla, abajo: solo se llega cruzando la chalupa amarrada (desde el muelle no alcanza el
// salto). Mira hacia el Caleuche (−z), así los dos reaparecen lado a lado sobre los brazos
vacio("control-3", [81.2, 0.385 + 0.8, -3.22], [0.6, 0.8, 0.3], { tipo: "control", orden: 3 }, Math.PI);
// El 4 en la cubierta del Caleuche, junto al portalón
vacio("control-4", [83.4, CUBIERTA + 1, -5.2], [1.4, 1, 1.2], { tipo: "control", orden: 4 });
// El 5, la meta, en el muelle de la fiesta
vacio("control-5", [105, FIN + 1, -5.6], [1.6, 1, 1.2], { tipo: "control", orden: 5 });

// ── Adornos: matas y rocas en la costanera, la explanada y el muelle de la fiesta (el bosque, los palafitos de
// atrás y la iglesia los pone el guion) ────────────────────────────────────────────────────────────────────────
for (const [i, [x, y, z, alto]] of [
  [-5.4, P, 2.6, 0.9],
  [-5.6, P, -2.7, 1],
  [43.2, P, -2.7, 0.9],
  [46, P, 2.8, 0.8],
  [52.5, P, -2.8, 1],
  [57.6, P, 2.7, 0.9],
  [63.4, P, -2.7, 0.8],
  [108.8, FIN, -7.1, 0.9],
].entries()) {
  adorno(`mata-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 140 + i });
}
for (const [i, [x, y, z, r]] of [
  [5, ARENA, 2.6, 0.35],
  [17.6, ARENA, 2.8, 0.3],
  [30.5, ARENA, 2.4, 0.4],
  [36.8, ARENA, -2.8, 0.3],
  [44.6, P, 2.4, 0.3],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 170 + i });
}

// Niebla: la garúa de Chiloé, baja sobre el mar, y capas entre el bosque
vacio("niebla-caleta", [20, 0.9, -1], [14, 1, 1], { tipo: "niebla", opacidad: 0.4, velocidad: -0.08 }, 0);
vacio("niebla-puerto", [92, 1, -2], [14, 1.2, 1], { tipo: "niebla", opacidad: 0.4, velocidad: 0.07 }, 0);
vacio("niebla-1", [20, 2.4, -10], [26, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [70, 2.6, -11], [26, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [45, 4, -16], [44, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-4", [55, 6, -22], [64, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: -0.2 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("14-minga");
