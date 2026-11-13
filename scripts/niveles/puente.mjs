// pnpm niveles: arma niveles/12-puente/escena.glb, el nivel 12 (TU-45): El puente de paja, Q'eswachaka (Perú).
// Un cañón andino, terrazas con canales de agua y un puente tejido a mano; andan por ahí las llamas, que escupen si
// las apurás. Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La
// convención está en niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. Todo va corrido 42 m hacia −x (`DX`), para
// que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. la qeswa, de a dos: cada uno agarra un torcedor y gira para su lado (uno a la izquierda, el otro a la
//      derecha) hasta que la cuerda queda trenzada; la puerta de la pirca baja → punto 1
//   2. tender el puente, de a dos: uno jala la soga hacia atrás y lo tensa; el otro sostiene el amarre del estribo
//      con las dos manos hasta que queda amarrado y se teje el piso → punto 2, en la cabecera
//   3. cruzarlo sin que se voltee: se mece con los que caminan encima y se calma solo; mecido de más, se voltea
//      → punto 3, en la otra orilla
//   4. los canales: el agua baja por la acequia y se va por la primera bocatoma abierta. Hay que cerrar la de arriba
//      y abrir las de abajo para regar las tres terrazas; con las tres regadas se abre la puerta de arriba → punto 4
//   5. la llama carguera: se la lleva de la rienda por el camino hasta el patio del tambo, sin apurarla; al llegar
//      aparece la meta → punto 5
// El secreto: un quipu escondido entre las piedras, arriba del pedregal de la pampa.
import { crearEscena } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 12,
  nombre: "El puente de paja",
  vacio: -6,
  nieblaCerca: 3,
  nieblaLejos: 28,
});

/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 90 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -42;
/** El puente: de la cabecera del oeste a la del este, a la altura de la pampa. */
const PUENTE = { x0: 24, x1: 38, ancho: 1.1 };
/** Las terrazas del este: de dónde a dónde (x) y su altura. Atrás, la acequia madre (de z0 a z1, 30 cm de hondo). */
const TERRAZAS = [
  { x0: 38, x1: 47, y: 0 },
  { x0: 47, x1: 53, y: 1.3 },
  { x0: 53, x1: 59.2, y: 2.6 },
];
const ACEQUIA = { z0: -6.5, z1: -6.1, hondo: 0.3 };
/** El fondo de todo: la pampa y las terrazas van de acá para arriba. */
const ABAJO = -2;
/** Lo de atrás (−z) y lo de adelante (+z, el lado de la cámara). */
const ATRAS = -7.2;
const FRENTE = 3.2;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

/** Una zona de agua que corre hacia −x (la acequia baja hacia el oeste): de x0 a x1 y de z0 a z1, del fondo a la
 * superficie. Girada para que su frente (hacia donde corre) sea −x. */
function acequia(nombre, x0, x1, z0, z1, fondo, superficie, extras = {}) {
  vacio(
    nombre,
    [(x0 + x1) / 2, (fondo + superficie) / 2, (z0 + z1) / 2],
    [(z1 - z0) / 2, (superficie - fondo) / 2, (x1 - x0) / 2],
    { tipo: "agua", caer: "nadar", arrastre: 1, ...extras },
    -Math.PI / 2,
  );
}

/** Una pirca (muro de piedra) a lo largo de z, en x, de z0 a z1, de `alto` sobre `y`. */
function pirca(nombre, x, z0, z1, y, alto) {
  bloque(nombre, [x - 0.2, y, z0], [x + 0.2, y + alto, z1], { material: "tela" });
}

/** Una puerta de palos en una pirca (la baja el guion), con lo de arriba invisible para que no se salte. */
function puerta(nombre, x, y, alto) {
  pirca(`${nombre}-pirca-atras`, x, ATRAS, -1.2, y, alto);
  pirca(`${nombre}-pirca-frente`, x, 1.2, FRENTE, y, alto);
  bloque(nombre, [x - 0.15, y, -1.2], [x + 0.15, y + alto - 0.1, 1.2], { cuerpo: "cinematico", material: "corteza" });
  bloque(`${nombre}-alto`, [x - 0.2, y + alto - 0.1, -1.2], [x + 0.2, y + alto + 1.6, 1.2], { invisible: 1 });
}

// ── 1. La pampa: la qeswa y el pedregal del secreto ───────────────────────────────────────────────────────────
bloque("pampa", [-3, ABAJO, ATRAS], [PUENTE.x0, 0, FRENTE]);
// La qeswa: 6 m de paja entre dos torcedores, a la altura de las manos (arriba de su caja), al costado del camino
pieza("qeswa", "qeswa", [7, 0.5, -1.8], [6, 1, 0.3], { vueltas: 3, destorcer: 4, masa: 1 });
// El pedregal del fondo (1.35 m, se trepa colgándose): arriba, entre las piedras, está el quipu
bloque("pedregal", [8.5, 0, ATRAS], [12.5, 1.35, -3.8], { material: "honda" });
bloque("pedregal-piedra-1", [8.5, 1.35, ATRAS], [9.6, 2.3, -5.4], { material: "tela" });
bloque("pedregal-piedra-2", [11.0, 1.35, ATRAS], [12.5, 2.0, -5.9], { material: "tela" });
vacio("secreto", [10.3, 1.35 + 0.6, -6.2], [0.6, 0.6, 0.6], { tipo: "secreto" }, 0);
// La pirca de la pampa y su puerta (baja cuando la qeswa queda trenzada)
puerta("puerta-pampa", 15, 0, 2.4);

// ── 2. La cabecera del oeste: la soga, el amarre y el puente ───────────────────────────────────────────────────
// El puente: 14 m de cabecera a cabecera, con el piso arriba de su caja en las puntas. Su soga sale hacia atrás del
// lado de la cámara; el amarre, sobre el estribo del otro costado
pieza("chaka", "chaka", [(PUENTE.x0 + PUENTE.x1) / 2, -0.5, 0], [PUENTE.x1 - PUENTE.x0, 1, PUENTE.ancho], {
  comba: 0.6,
  flojo: 4,
  tensar: 2.4,
  fuerza: 25,
  lado: 1.3,
  umbral: 0.85,
  amarrar: 2.5,
  mecer: 0.3,
  calma: 0.35,
  periodo: 2.4,
  ladear: 0.35,
  voltear: 32,
});
// El estribo: la piedra bajo el amarre, y la piedra de la cabecera de donde sale la soga
bloque("estribo", [23.15, 0, -1.6], [23.65, 0.8, -1.4], { material: "tela" });
bloque("cabecera-oeste", [23.4, 0, 0.75], [23.75, 0.5, 1.05], { material: "tela" });
// El cañón: los barrancos, el río del fondo (se lleva al que cae) y el vacío
bloque("barranco-oeste", [PUENTE.x0 - 2, -16, ATRAS - 2], [PUENTE.x0, ABAJO, FRENTE + 3], { material: "honda" });
bloque("barranco-este", [PUENTE.x1, -16, ATRAS - 2], [PUENTE.x1 + 2, ABAJO, FRENTE + 3], { material: "honda" });
bloque("cauce", [PUENTE.x0, -16.5, ATRAS - 2], [PUENTE.x1, -16, FRENTE + 3], { material: "honda" });
vacio(
  "rio",
  [(PUENTE.x0 + PUENTE.x1) / 2, -15.2, -0.5],
  [(PUENTE.x1 - PUENTE.x0) / 2, 0.8, 6.5],
  { tipo: "agua", caer: "vacio", corriente: 1.6, arrastre: 2 },
  0,
);
vacio("canon", [(PUENTE.x0 + PUENTE.x1) / 2, -6, -0.5], [(PUENTE.x1 - PUENTE.x0) / 2, 3, 6.5], { tipo: "vacio" }, 0);

// ── 3 y 4. La otra orilla y las terrazas, con la acequia madre atrás ───────────────────────────────────────────
for (const [i, t] of TERRAZAS.entries()) {
  const k = i + 1;
  // La acequia empieza donde termina la cabecera (más al oeste no hay canal)
  const desde = k === 1 ? 41.3 : t.x0;
  bloque(`terraza-${k}`, [t.x0, ABAJO, ACEQUIA.z1], [t.x1, t.y, FRENTE]);
  if (k === 1) bloque("terraza-1-cabecera", [t.x0, ABAJO, ATRAS], [desde, t.y, ACEQUIA.z1]);
  bloque(`terraza-${k}-acequia`, [desde, ABAJO, ACEQUIA.z0], [t.x1, t.y - ACEQUIA.hondo, ACEQUIA.z1], {
    material: "honda",
  });
  bloque(`terraza-${k}-atras`, [desde, ABAJO, ATRAS], [t.x1, t.y, ACEQUIA.z0]);
  // La acequia madre de esta terraza y el salto con que baja a la de abajo (en su punta del oeste)
  acequia(`madre-${k}`, desde, t.x1, ACEQUIA.z0, ACEQUIA.z1, t.y - ACEQUIA.hondo, t.y - 0.08, { corriente: 0.8 });
  const abajo = k === 1 ? t.y - 1.2 : (TERRAZAS[i - 1]?.y ?? 0) - ACEQUIA.hondo;
  acequia(`salto-${k}`, desde - 0.05, desde + 0.05, ACEQUIA.z0, ACEQUIA.z1, abajo, t.y - 0.08, { imagen: "chorro" });
  // El andén sembrado y su bocatoma: la losa en la boca de la acequia, con el travesaño hacia el andén
  const medio = (t.x0 + t.x1) / 2 + (k === 1 ? 1.6 : 0);
  pieza(`anden-${k}`, "anden", [medio, t.y + 0.3, -4.0], [4.4, 0.6, 2.8], {
    regar: 5,
    surcos: 4,
    regada: k === 3 ? 1 : 0,
  });
  pieza(`bocatoma-${k}`, "bocatoma", [medio, t.y - 0.075, -6.0], [0.6, 0.45, 0.12], {
    recorrido: 0.5,
    umbral: 0.7,
    manija: 1.3,
    masa: 6,
    abierta: k === 3 ? 1 : 0,
  });
}
// El ojo de agua: de donde sale la acequia, en la pirca de arriba
bloque("ojo-de-agua", [59.2, 2.3, ACEQUIA.z0 - 0.2], [59.6, 3.2, ACEQUIA.z1 + 0.2], { material: "honda" });
// La puerta de arriba (baja con las tres terrazas regadas)
puerta("puerta-terrazas", 59.4, 2.6, 2.4);

// ── 5. El camino de la llama y el tambo ───────────────────────────────────────────────────────────────────────
const ALTO = 2.6;
bloque("puna", [59.2, ABAJO, ATRAS], [88, ALTO, FRENTE]);
// La llama carguera, delante de su corral, mirando al camino
pieza("llama", "carguera", [64.5, ALTO + 0.9, -1.0], [1.5, 1.8, 0.5], {
  velocidad: 0.9,
  giro: 1.8,
  rienda: 1.4,
  paciencia: 1.5,
  echarse: 3,
  escupir: 3.6,
  arrear: 0.6,
});
// El corral de las llamas (pircas bajas)
bloque("corral-oeste", [61.2, ALTO, -6.4], [61.5, ALTO + 0.9, -2.6], { material: "tela" });
bloque("corral-este", [66.5, ALTO, -6.4], [66.8, ALTO + 0.9, -2.6], { material: "tela" });
bloque("corral-fondo", [61.2, ALTO, -6.7], [66.8, ALTO + 0.9, -6.4], { material: "tela" });
// El camino de piedra, entre pircas bajas, hasta el patio del tambo
bloque("camino-norte", [67, ALTO, -2.3], [77, ALTO + 1.0, -1.9], { material: "tela" });
bloque("camino-sur", [67, ALTO, 1.9], [77, ALTO + 1.0, 2.3], { material: "tela" });
// El tambo: la casa de piedra (el techo de paja lo pone el guion) al fondo del patio
bloque("tambo", [79.5, ALTO, -7], [85.5, ALTO + 2.6, -3.6], { material: "tela" });

// ── Bordes: el fondo y una pared invisible del lado de la cámara; las puntas ──────────────────────────────────
bloque("borde-atras", [-3, 0, ATRAS - 0.3], [88, ALTO + 3, ATRAS], { invisible: 1 });
bloque("borde-frente-oeste", [-3, 0, FRENTE], [PUENTE.x0, 3, FRENTE + 0.3], { invisible: 1 });
bloque("borde-frente-este", [PUENTE.x1, 0, FRENTE], [88, ALTO + 3, FRENTE + 0.3], { invisible: 1 });
bloque("borde-oeste", [-3.3, 0, ATRAS], [-3, 3, FRENTE], { invisible: 1 });
bloque("borde-este", [88, ALTO, ATRAS], [88.3, ALTO + 3, FRENTE], { invisible: 1 });
// Los cerros del fondo (lejos, solo para la vista) y las paredes del cañón detrás del puente
for (const [i, [x, alto, z]] of [
  [-2, 9, -12],
  [12, 13, -15],
  [22, 8, -11],
  [31, 16, -18],
  [44, 10, -12],
  [58, 14, -16],
  [72, 11, -12.5],
  [86, 15, -17],
].entries()) {
  bloque(`cerro-${i + 1}`, [x - 7, 0, z - 4], [x + 7, alto, z + 2.5], { material: "lejana" });
}

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [0, 0, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [0, 0, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [17, 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 1 });
// En la cabecera (aparece cuando el puente queda amarrado)
vacio("control-2", [23, 1, 0], [1.0, 1, 0.6], { tipo: "control", orden: 2 });
vacio("control-3", [39.6, 1, 0], [1.6, 1, 0.9], { tipo: "control", orden: 3 });
vacio("control-4", [61.2, ALTO + 1, 0.4], [1.4, 1, 0.8], { tipo: "control", orden: 4 });
// La meta, pasando el patio del tambo (aparece cuando llega la llama)
vacio("control-5", [85, ALTO + 1, 0], [1.6, 1, 1.2], { tipo: "control", orden: 5 });

// ── Adornos: ichu (paja brava) por todos lados, piedras sueltas y la niebla del cañón ─────────────────────────
for (let i = 0; i < 40; i++) {
  const x = -2 + ((i * 41) % 25) + 0.3 * Math.sin(i * 2.7);
  const z = -6.8 + ((i * 57) % 95) / 10;
  if (Math.abs(z) < 1.4 || (x > 3 && x < 11 && z > -2.6 && z < -1)) continue;
  if (x > 8.3 && x < 12.7 && z < -3.6) continue;
  adorno(`ichu-${i + 1}`, [x, 0, z], { forma: "mata", alto: 0.5 + 0.1 * (i % 4), semilla: 500 + i });
}
for (const [i, [x, y, z, alto]] of [
  [39.2, 0, 2.6, 0.7],
  [46.4, 0, 2.7, 0.6],
  [52.5, 1.3, 2.8, 0.7],
  [58.6, 2.6, 2.7, 0.6],
  [68, ALTO, 2.8, 0.8],
  [74, ALTO, -2.9, 0.7],
  [78, ALTO, 2.8, 0.7],
  [87, ALTO, -2.5, 0.8],
].entries()) {
  adorno(`ichu-este-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 600 + i });
}
for (const [i, [x, y, z, radio]] of [
  [9.2, 2.3, -6.6, 0.45],
  [11.8, 2.0, -6.6, 0.35],
  [13.6, 0, 2.6, 0.35],
  [21.5, 0, -4.8, 0.5],
  [40.4, 0, -6.5, 0.4],
  [62, ALTO, 2.6, 0.35],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y, z], { forma: "roca", radio, semilla: 700 + i });
}
vacio("niebla-canon-1", [31, -3, -1], [9, 3, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.12 }, 0);
vacio("niebla-canon-2", [31, -8, -5], [10, 4, 1], { tipo: "niebla", opacidad: 0.65, velocidad: -0.08 }, 0);
vacio("niebla-1", [8, 2.5, -10], [16, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.14 }, 0);
vacio("niebla-2", [52, 4, -10], [18, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.1 }, 0);
vacio("niebla-3", [78, 5, -10], [14, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.12 }, 0);
vacio("niebla-4", [42, 8, -20], [56, 9, 1], { tipo: "niebla", opacidad: 0.65, velocidad: 0.2 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("12-puente");
