// pnpm niveles: arma niveles/02-poza/escena.glb, el nivel 2 (TU-24): La poza, en el río Guayape (Honduras). Un río
// de piedras redondas, tendederos de ropa y una represa de madera; lava ahí La Sucia, que salpica a todos. Como los
// otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x; el río baja hacia −x. El agua del río está
// en y = 0. Cada misión termina en un punto de control:
//   1. la playa: tres troncos sobre caballetes (9 kg: de a dos), uno en cada carril. Se los lleva derecho hasta el
//      astillero, otros caballetes junto al agua, y se los deja ahí (uno solo los arrastra, pero no los sube). Con
//      los tres en el astillero se amarran, la balsa baja sola al agua y queda junto al muelle → punto 1, en la balsa
//      (viaja con ella)
//   2. el río, río arriba: la corriente baja a 0.85 m/s; cada remo empuja de su lado. Con los dos remando la balsa
//      sube derecho; con uno solo da vueltas y la corriente se la lleva → punto 2, en el embarcadero, al pie de la
//      represa (los últimos metros son un remanso: ahí la balsa llega sola)
//   3. la represa: el chorro cae sobre el escalón (1.4 m) y la cara de la represa (1.4 m) y se lleva al que trepa.
//      La palanca del embarcadero alza la compuerta, que desvía el agua mientras alguien la sostiene → punto 3 arriba
//   4. el tendedero: dos cuerdas en bajada sobre la poza, de la represa a la isla, una para cada uno, con una polea
//      que baja con el que se cuelga → punto 4 en la isla
//   5. la boca: la quebrada que llena la poza entra por la boca, entre la isla y un peñón. Con las dos piedras
//      redondas de la isla adentro, se tapa, el agua se va por la acequia y la poza baja; se baja caminando por su
//      fondo en rampa → punto 5, en lo hondo, junto a la batea
//   6. la batea llena de pepitas (9 kg: de a dos) se sube por la rampa hasta la mesa de la orilla, junto al
//      lavadero de La Sucia, sin botarla → punto 6, la meta (aparece al dejarla en la mesa)
// El secreto: la pepita de oro en un hoyo, en lo más hondo de la poza (se llega con la poza vacía).
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 2,
  nombre: "La poza",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** El agua del río, la playa (y el muelle y el embarcadero), el escalón y la represa, la poza llena, la isla. */
const AGUA = 0;
const PLAYA = 0.3;
const ESCALON = 1.7;
const REPRESA = 3.1;
const POZA = 1.5;
const FONDO = -0.3;
const ISLA = 1.9;

/** Una zona de agua: de x0 a x1 y de z0 a z1, del fondo a la superficie. Con `corriente`, hacia −x. */
function agua(nombre, x0, x1, z0, z1, fondo, superficie, extras = {}) {
  const haciaMenosX = (extras.corriente ?? 0) !== 0 || extras.haciaMenosX;
  const { haciaMenosX: _, ...propiedades } = extras;
  const [sx, sz] = haciaMenosX ? [(z1 - z0) / 2, (x1 - x0) / 2] : [(x1 - x0) / 2, (z1 - z0) / 2];
  vacio(
    nombre,
    [(x0 + x1) / 2, (fondo + superficie) / 2, (z0 + z1) / 2],
    [sx, (superficie - fondo) / 2, sz],
    { tipo: "agua", ...propiedades },
    haciaMenosX ? -Math.PI / 2 : 0,
  );
}

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Una rampa a lo largo de x: de (x0, y0) a (x1, y1), de z0 a z1, con la cara de arriba en esa línea. */
function rampa(nombre, [x0, y0], [x1, y1], z0, z1, extras = {}, grueso = 0.4) {
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const angulo = Math.atan2(y1 - y0, x1 - x0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(largo, grueso, z1 - z0));
  m.name = nombre;
  // El centro, medio grueso por debajo de la línea de arriba
  const normal = [-Math.sin(angulo), Math.cos(angulo)];
  m.position.set((x0 + x1) / 2 - (normal[0] * grueso) / 2, (y0 + y1) / 2 - (normal[1] * grueso) / 2, (z0 + z1) / 2);
  m.rotation.z = angulo;
  m.userData = { tipo: "solido", ...extras };
  escena.add(m);
  return m;
}

/** Una piedra de río para pisar o de adorno que choca: una bola aplastada, redonda también en la imagen. */
function bolon(nombre, [x, y, z], radio, alto = radio) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(radio, 14, 10).scale(1, alto / radio, 1));
  m.name = nombre;
  m.position.set(x, y, z);
  m.userData = { tipo: "solido", forma: "malla", material: "honda" };
  escena.add(m);
}

/** Una roca de adorno (no choca). */
function roca(nombre, [x, y, z], radio, semilla) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "roca", radio, semilla }, 0);
}

// ── 1. La playa y los troncos ───────────────────────────────────────────────────────────────────────────────────
// La playa (x de −14.5 a 0, arriba en 0.3) y, adelante, la orilla en bajada hasta el agua
bloque("playa", [-14.5, -2, -3.2], [0, PLAYA, 3.2]);
rampa("orilla", [0, PLAYA], [3.6, PLAYA - 3.6 * Math.tan((15 * Math.PI) / 180)], -2.2, 3.2, { material: "honda" });
// Los tres troncos de la balsa, uno en cada carril, sobre dos caballetes a la altura de las manos alzadas. Se llevan
// en fila con la mano derecha: cada uno camina 45 cm a la izquierda del tronco (por al lado de los caballetes)
// El astillero: otros caballetes iguales junto al agua, en los mismos carriles, donde se dejan para amarrarlos
for (const [i, z] of [-1.1, 0.4, 1.9].entries()) {
  for (const [lugar, x0] of [
    ["caballete", -9],
    ["astillero", -1.6],
  ]) {
    for (const dx of [-1.05, 1.05]) {
      const x = x0 + dx;
      bloque(
        `${lugar}-${i + 1}${dx < 0 ? "a" : "b"}`,
        [x - 0.12, PLAYA, z - 0.15],
        [x + 0.12, PLAYA + 0.85, z + 0.15],
        {
          material: "corteza",
        },
      );
    }
  }
  pieza(`balsa-${i + 1}`, "tronco", [-9, PLAYA + 1.0, z], [3.0, 0.3, 0.42]);
}

// ── El remanso y el muelle ──────────────────────────────────────────────────────────────────────────────────────
// El remanso: agua quieta de x 0 a 12 (2 m de hondo). El muelle, del lado del fondo (−z), de tablas, para subir a la
// balsa: la balsa se amarra a su lado
agua("remanso", -0.2, 12, -3.2, 3.2, -2, AGUA, { arrastre: 1.5 });
bloque("lecho-remanso", [0, -2.6, -3.2], [12, -2, 3.2], { material: "honda" });
bloque("muelle", [-1, -0.2, -3.2], [9.5, PLAYA, -2.2], { material: "corteza" });
for (const x of [1, 3.5, 6, 8.5])
  bloque(`muelle-pilote-${x}`, [x - 0.1, -2, -2.35], [x + 0.1, -0.2, -2.15], { material: "corteza" });
// Donde flota la balsa amarrada, junto al muelle (la amarra el guion, con los troncos en el astillero)
pieza("balsa", "balsa", [5.6, 0.13, -1.55], [3.0, 0.3, 1.26], { troncos: 3, remo: 28, astillero: 0 });

// ── 2. El río ───────────────────────────────────────────────────────────────────────────────────────────────────
// De x 12 a 19 la corriente baja a 0.85 m/s; de 19 a 22, al pie de la represa, un remanso donde la balsa llega sola
agua("rio", 12, 19, -2.6, 2.6, -2, AGUA, { corriente: 0.85, arrastre: 1.5 });
agua("pie-de-la-represa", 19, 22, -2.6, 2.6, -2, AGUA, { arrastre: 1.5, haciaMenosX: true });
bloque("lecho-rio", [12, -2.6, -2.6], [22, -2, 2.6], { material: "honda" });

// ── 3. El embarcadero y la represa ──────────────────────────────────────────────────────────────────────────────
// El embarcadero, de lado a lado; el escalón de piedra (1.4 m) y la represa de madera (otros 1.4 m) con su corona
bloque("embarcadero", [22, -2, -3.2], [24.2, PLAYA, 3.2], { material: "corteza" });
bloque("escalon", [24.2, -2, -1.0], [25.3, ESCALON, 3.2], { material: "tela" });
bloque("represa", [25.3, FONDO - 0.6, -1.0], [26.8, REPRESA, 3.2], { material: "corteza" });
// La torre de la compuerta, del lado del fondo (−z): muy alta para treparla. La compuerta, en su frente, sube mientras
// alguien empuja la palanca del embarcadero; el agua sale por abajo y deja de caer el chorro
bloque("torre", [24.2, -2, -3.2], [26.8, 4.6, -1.0], { material: "corteza" });
bloque("hueco-compuerta", [24.12, PLAYA, -2.7], [24.2, PLAYA + 1.1, -1.5], { material: "honda" });
solido("compuerta", [24.05, PLAYA + 0.6, -2.1], [0.1, 1.2, 1.3], { cuerpo: "cinematico", material: "corteza" });
// La palanca, en el embarcadero junto a la torre, mirando hacia el río (−x): se empuja hacia la represa
pieza("palanca", "palanca", [23.0, PLAYA + 0.6, -1.6], [0.6, 1.2, 0.3], { angulo: 30 }, -Math.PI / 2);
// El chorro: sobre la cara del escalón y sobre la cara de la represa (cae desde la corona). Se lleva al que trepa
agua("chorro-escalon", 23.5, 24.2, -1.0, 3.2, PLAYA, ESCALON + 0.2, {
  caer: "vacio",
  imagen: "chorro",
  haciaMenosX: true,
});
agua("chorro-represa", 24.2, 25.3, -1.0, 3.2, ESCALON, REPRESA + 0.1, {
  caer: "vacio",
  imagen: "chorro",
  haciaMenosX: true,
});
// El chorro que sale por la compuerta abierta (empieza seco: el guion lo larga al abrir). También se lleva al que se
// mete, pero queda lejos de la palanca y del escalón
agua("chorro-compuerta", 23.4, 24.0, -2.7, -1.5, PLAYA, PLAYA + 1.0, {
  caer: "vacio",
  imagen: "chorro",
  haciaMenosX: true,
});

// ── 4. La poza y el tendedero ───────────────────────────────────────────────────────────────────────────────────
// La poza: honda junto a la represa (el fondo en −0.3) y subiendo en rampa hacia la isla
agua("poza", 26.8, 35.4, -3.2, 3.2, FONDO, POZA, { arrastre: 1.5 });
bloque("fondo-poza", [26.8, FONDO - 0.6, -3.2], [29.6, FONDO, 3.2], { material: "suelo" });
rampa("rampa-poza", [29.6, FONDO], [35.4, ISLA], -3.2, 3.2, { material: "suelo" }, 0.6);
// El hoyo de la pepita de oro, en lo más hondo, junto a la represa
bolon("bolon-hoyo-1", [27.5, FONDO, 2.4], 0.5, 0.35);
bolon("bolon-hoyo-2", [28.7, FONDO, 2.6], 0.55, 0.4);
vacio("secreto", [28.1, FONDO + 0.5, 2.3], [0.45, 0.5, 0.45], { tipo: "secreto" }, 0);
// La batea, en lo hondo, sobre una piedra a la altura de las manos (a lo largo de z: uno de cada lado)
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.0, 12));
  m.name = "piedra-batea";
  m.position.set(28.25, FONDO + 0.5, -1.5);
  m.userData = { tipo: "solido", forma: "cilindro", material: "honda" };
  escena.add(m);
}
pieza("batea", "batea", [28.25, FONDO + 1.1, -1.5], [0.55, 0.2, 1.0], { masa: 9, pepitas: 14, derrame: 30 });
// Los dos tendederos: de la corona de la represa a la isla, en bajada; la manija arriba, al alcance de las manos
// (uno al lado del otro, donde aparecen los dos en el punto 3; la ropa, colgada en un hilo del lado de acá)
pieza("tendedero-rojo", "tendedero", [31.4, 4.225, 0.45], [9.9, 0.85, 0.05], { manija: 0.35, ropa: 7, hilo: 0.8 });
pieza("tendedero-turquesa", "tendedero", [31.4, 4.225, -0.45], [9.9, 0.85, 0.05], { manija: 0.35, ropa: 0 });

// ── 5. La isla, la boca y la quebrada ───────────────────────────────────────────────────────────────────────────
bloque("isla", [35.4, FONDO - 0.6, -3.2], [46, ISLA, 1.2]);
// La quebrada que llena la poza baja por el lado de acá (+z). La boca: un hondo entre la isla y el peñón, donde caben
// las dos piedras; tapada, el agua se va por la acequia (más allá del peñón) y la quebrada de abajo y la poza se secan
agua("quebrada", 38, 46, 1.2, 3.2, 0.6, 1.6, { corriente: 0.7, arrastre: 1.5 });
agua("quebrada-abajo", 35.4, 38, 1.2, 3.2, 0.9, 1.6, { corriente: 0.7, arrastre: 1.5 });
bloque("lecho-quebrada", [35.4, 0.3, 1.2], [38, 0.9, 3.2], { material: "honda" });
bloque("lecho-boca", [38, 0.3, 1.2], [40.2, 0.6, 2.5], { material: "honda" });
bloque("lecho-quebrada-arriba", [40.2, 0.3, 1.2], [46, 0.9, 3.2], { material: "honda" });
bloque("peñon", [37.8, 0.3, 2.5], [40.4, 2.5, 3.2], { material: "tela" });
agua("acequia", 40.6, 43, 3.2, 5.2, 0.9, 1.6, { haciaMenosX: true });
bloque("lecho-acequia", [40.6, 0.3, 3.2], [43, 0.9, 5.2], { material: "honda" });
pieza("piedra-1", "piedra", [38.6, ISLA + 0.45, -0.4], [0.9, 0.9, 0.9], { masa: 30 });
pieza("piedra-2", "piedra", [39.6, ISLA + 0.45, -1.6], [0.9, 0.9, 0.9], { masa: 30 });

// ── 6. La orilla de La Sucia ────────────────────────────────────────────────────────────────────────────────────
// La mesa, a la altura de las manos alzadas: se deja ahí la batea. La Sucia lava al fondo, mirando hacia −x
bloque("mesa", [42.0, ISLA, -2.4], [42.8, ISLA + 0.85, -0.6], { material: "corteza" });
// (girada para mirar hacia −x: su caja es [ancho en z, alto, largo en x])
pieza(
  "sucia",
  "sucia",
  [43.1, ISLA + 0.5, -1.4],
  [3.4, 1, 5.0],
  { lavar: 3.5, apuntar: 0.8, empujon: 3.6 },
  -Math.PI / 2,
);
// El rancho de La Sucia, detrás
bloque("rancho-pared", [45.6, ISLA, -3.2], [46, ISLA + 2.4, 1.2], { material: "tela" });
bloque("rancho-techo", [44.4, ISLA + 2.4, -3.6], [46.4, ISLA + 2.6, -2.1], { material: "honda" });
for (const z of [-3.2, -2.4])
  bloque(`rancho-horcon-${z}`, [44.4, ISLA, z], [44.6, ISLA + 2.4, z + 0.2], { material: "corteza" });

// ── Bordes: la peña del fondo (−z) y una pared invisible del lado de la cámara (+z), con bolones ───────────────
bloque("pena-playa", [-14.5, -2, -4.4], [12, 3.6, -3.2], { material: "tela" });
bloque("pena-rio", [12, -2, -4.4], [22, 4.4, -2.6], { material: "tela" });
bloque("pena-represa", [22, -2, -4.4], [26.8, 4.4, -3.2], { material: "tela" });
bloque("pena-poza", [26.8, -2, -4.4], [46, 5.2, -3.2], { material: "tela" });
bloque("borde-playa", [-14.5, PLAYA, 3.2], [0, PLAYA + 2, 3.5], { invisible: 1 });
bloque("borde-remanso", [0, -2, 3.2], [12, 2.5, 3.5], { invisible: 1 });
bloque("borde-rio", [12, -2, 2.6], [22, 3, 2.9], { invisible: 1 });
bloque("borde-embarcadero", [22, PLAYA, 3.2], [24.2, PLAYA + 2, 3.5], { invisible: 1 });
bloque("borde-poza", [26.8, -2, 3.2], [35.4, 4.5, 3.5], { invisible: 1 });
bloque("borde-isla", [35.4, 0.3, 3.2], [46, 4.5, 3.5], { invisible: 1 });
bloque("borde-este", [46, -2, -3.2], [46.3, 5, 3.2], { invisible: 1 });
bloque("borde-oeste", [-14.8, -2, -3.2], [-14.5, 3, 3.2], { invisible: 1 });
// Del lado de acá del río y del remanso, bolones a ras del agua (se ven, y la balsa los topa)
for (const [i, [x, z, r]] of [
  [1.5, 3.4, 0.55],
  [4.2, 3.5, 0.7],
  [7.4, 3.4, 0.6],
  [10.6, 3.5, 0.75],
  [13.5, 2.95, 0.6],
  [15.8, 3.0, 0.7],
  [18.2, 2.95, 0.55],
  [20.6, 3.0, 0.65],
].entries()) {
  bolon(`bolon-orilla-${i + 1}`, [x, AGUA - 0.1, z], r, r * 0.8);
}

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-13.2, PLAYA, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-13.2, PLAYA, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El punto 1 va en la balsa (el guion lo lleva con ella); el 6 aparece cuando la batea queda en la mesa
vacio("control-1", [5.6, 0.28 + 0.6, -1.55], [0.6, 0.6, 1.4], { tipo: "control", orden: 1 });
vacio("control-2", [22.9, PLAYA + 1, 0], [3.1, 1, 0.7], { tipo: "control", orden: 2 });
vacio("control-3", [26.05, REPRESA + 1, 0], [1.6, 1, 0.65], { tipo: "control", orden: 3 });
vacio("control-4", [37.3, ISLA + 1, -1.0], [2.1, 1.2, 1.2], { tipo: "control", orden: 4 });
vacio("control-5", [27.8, FONDO + 1, -0.2], [2.9, 1, 0.9], { tipo: "control", orden: 5 });
vacio("control-6", [41.2, ISLA + 1, -1.5], [1.2, 1, 0.8], { tipo: "control", orden: 6 });

// ── Adornos ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Pinos de Olancho detrás de la peña y del lado de acá, lejos; piedras redondas en la playa y en la isla
const pinos = [
  [-12, -6, 0.42],
  [-6, -5.6, 0.4],
  [0, -6.4, 0.44],
  [7, -5.8, 0.4],
  [14, -6.2, 0.42],
  [21, -5.6, 0.38],
  [29, -6.4, 0.44],
  [36, -5.8, 0.4],
  [43, -6.2, 0.42],
  [-9, -11, 0.4],
  [3, -12, 0.42],
  [17, -11, 0.4],
  [31, -12, 0.44],
  [45, -11, 0.4],
  [-3, 7.5, 0.34],
  [26, 7.8, 0.36],
  [48, 6.5, 0.34],
];
for (const [i, [x, z, radio]] of pinos.entries()) {
  vacio(`pino-${i + 1}`, [x, -4, z], [1, 1, 1], { tipo: "adorno", forma: "pino", alto: 26, radio, semilla: 50 + i }, 0);
}
for (let i = 0; i < 22; i++) {
  const x = -14 + i * 3;
  vacio(
    `abeto-${i + 1}`,
    [x, -4, -15 - (i % 3) * 3],
    [1, 1, 1],
    { tipo: "adorno", forma: "abeto", alto: 9 + (i % 4) * 1.5 },
    0,
  );
}
for (const [i, [x, y, z, r]] of [
  [-14.0, PLAYA, -2.6, 0.45],
  [-8.4, PLAYA, 2.7, 0.35],
  [-2.6, PLAYA, -2.7, 0.5],
  [-1.4, PLAYA, 2.8, 0.3],
  [24.6, PLAYA, -2.8, 0.4],
  [41.0, ISLA, 0.6, 0.35],
  [45.4, ISLA, -2.8, 0.3],
].entries()) {
  roca(`roca-${i + 1}`, [x, y - 0.05, z], r, 80 + i);
}
for (const [i, [x, y, z, alto]] of [
  [-14.0, PLAYA, 2.6, 1],
  [-7.2, PLAYA, -2.8, 0.8],
  [44.8, ISLA, 0.9, 1.1],
  [36.0, ISLA, -2.9, 0.8],
].entries()) {
  vacio(`mata-${i + 1}`, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "mata", alto, semilla: 60 + i }, 0);
}
// Un tronco viejo varado en la playa
vacio(
  "tronco-viejo",
  [-5.5, PLAYA + 0.15, -2.6],
  [1, 1, 1],
  { tipo: "adorno", forma: "tronco", alto: 3.2, radio: 0.18, semilla: 9 },
  0.2,
);

// Niebla: el vapor del río y del chorro, y capas entre los pinos
vacio("niebla-rio", [16, 0.6, 0], [8, 1.2, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.1 }, 0);
vacio("niebla-chorro", [24, 1.2, -1], [3, 1.5, 1], { tipo: "niebla", opacidad: 0.4, velocidad: 0.06 }, 0);
vacio("niebla-poza", [31, 2.0, 0], [6, 1.2, 1], { tipo: "niebla", opacidad: 0.35, velocidad: 0.08 }, 0);
vacio("niebla-1", [0, 1.5, -6], [16, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [24, 2.5, -6.5], [16, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [10, 3, -10], [22, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-4", [38, 4, -10], [20, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-5", [16, 5, -15], [36, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

await exportar("02-poza");
