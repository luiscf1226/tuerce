// pnpm niveles: arma niveles/15-pampa/escena.glb, el nivel 15 (TU-48): La pampa, en La Pampa (Argentina). Llanura
// hasta el horizonte, un ombú enorme, tranqueras y un molino; de noche anda La Luz Mala, una luciérnaga gigante y
// despistada. Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención
// está en niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x, sobre la llanura (y = 0). Todo va corrido
// 52 m hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. el bañado: una calzada de tierra apenas bajo el agua, que casi no se ve. La Luz guía de parada en parada,
//      pero a veces se equivoca y se va hacia un señuelo (donde la calzada se corta) → punto 1, en la otra orilla
//   2. la tranquera, de a dos: el pampero la cierra de golpe. Uno la sostiene abierta de la manija, el otro pasa y
//      corre el pasador del otro lado, que la traba abierta → punto 2
//   3. el chambergo: el viento se llevó el sombrero del puestero y lo pasea por el potrero. Se lo baja con las
//      boleadoras; al caer, el portón del puesto se abre → punto 3
//   4. el ombú, de a dos: la horqueta (2.6 m) no se trepa. Uno hace pie de amigo al pie del tronco y el otro sube
//      por sus manos; arriba, baja la rama gacha para el otro, y los dos cruzan la cañada por la rama larga → punto 4
//   5. la Luz, que revolotea entre los postes del alambrado: se la encierra en el candil y alumbra el camino: aparece
//      la meta → punto 5
// El secreto: un mate olvidado arriba, en la copa del ombú.
import { crearEscena } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 15,
  nombre: "La pampa",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 27,
});

/** La llanura. */
const G = 0;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 109 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -52;
/** La calzada escondida del bañado: sus vueltas (x, z) y los ramales que se cortan (desde, hasta). Su ancho. */
const CALZADA = [
  [4, 0],
  [8, 0],
  [8, -3],
  [13, -3],
  [13, 2.2],
  [18, 2.2],
  [18, -3],
  [23, -3],
  [23, 2.2],
  [27, 2.2],
  [27, 0],
  [30, 0],
];
const RAMALES = [
  [
    [8, 0],
    [10.4, 0],
  ],
  [
    [13, -3],
    [15.2, -3],
  ],
  [
    [18, 2.2],
    [20.2, 2.2],
  ],
  [
    [23, -3],
    [25, -3],
  ],
];
const ANCHO_CALZADA = 1.6;
/** La calzada queda apenas bajo el agua (m). */
const BAJO_EL_AGUA = 0.08;
/** El tronco del ombú (una caja: de x0 a x1, de z0 a z1) y la horqueta, arriba. */
const OMBU = { x0: 74, x1: 77.5, z0: -2.6, z1: 0.4, horqueta: 2.6 };
/** La cañada que se cruza por la rama larga. */
const CANADA = { x0: 78, x1: 84, superficie: -0.4, fondo: -2.4 };

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

/** Un alambrado con sus postes, derecho a lo largo de x o de z: no se trepa (es delgado) ni se salta (un muro
 * invisible más alto). */
function alambrado(nombre, [x0, z0], [x1, z1], alto = 1.35) {
  const largo = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(largo / 2.5));
  const aLoLargoDeX = z0 === z1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const z = z0 + ((z1 - z0) * i) / n;
    solido(`${nombre}-poste-${i + 1}`, [x, G + alto / 2, z], [0.12, alto, 0.12], { material: "corteza" });
  }
  for (const [j, y] of [0.35, 0.7, 1.05, 1.3].entries()) {
    if (y > alto) continue;
    const medidas = aLoLargoDeX ? [largo, 0.02, 0.02] : [0.02, 0.02, largo];
    solido(`${nombre}-alambre-${j + 1}`, [(x0 + x1) / 2, G + y, (z0 + z1) / 2], medidas, { material: "honda" });
  }
  const pared = aLoLargoDeX ? [largo, alto + 1.45, 0.1] : [0.1, alto + 1.45, largo];
  solido(`${nombre}-pared`, [(x0 + x1) / 2, G + (alto + 1.45) / 2, (z0 + z1) / 2], pared, { invisible: 1 });
}

/** Un tramo de calzada de (x0, z0) a (x1, z1), derecho a lo largo de x o de z, con el ancho de la calzada y sus
 * puntas cuadradas (así las vueltas no dejan huecos). */
function calzada(nombre, [x0, z0], [x1, z1]) {
  const m = ANCHO_CALZADA / 2;
  bloque(
    nombre,
    [Math.min(x0, x1) - m, -2.2, Math.min(z0, z1) - m],
    [Math.max(x0, x1) + m, G - BAJO_EL_AGUA, Math.max(z0, z1) + m],
    { material: "suelo" },
  );
}

// ── La salida y 1. el bañado ────────────────────────────────────────────────────────────────────────────────────
bloque("suelo-salida", [-3, -2, -3.2], [4, G, 3.2]);
agua("banado", 4, 30, -4.2, 3.2, -2.2, G, { caer: "vacio", arrastre: 2 });
bloque("banado-lecho", [4, -2.6, -4.2], [30, -2.2, 3.2], { material: "honda" });
for (let i = 0; i + 1 < CALZADA.length; i++) calzada(`calzada-${i + 1}`, CALZADA[i], CALZADA[i + 1]);
for (const [i, [desde, hasta]] of RAMALES.entries()) calzada(`ramal-${i + 1}`, desde, hasta);
// La Luz Mala: empieza sobre la orilla, al lado de la primera parada
pieza("luz-mala", "luz-mala", [3.4, G + 1.6, 0], [0.9, 0.7, 1.2], {
  velocidad: 2.2,
  esperar: 1.1,
  acierto: 0.65,
  despiste: 2.5,
  posarse: 3.5,
  espantar: 1.3,
  atrapar: 0.55,
  semilla: 3,
});
// Juncos en el bañado: matas que asoman del agua, lejos de la calzada
for (const [i, [x, z]] of [
  [5.5, -2.6],
  [6.2, 2.4],
  [10.6, -1.6],
  [11, 2.6],
  [15.6, -0.6],
  [16.2, -3.9],
  [20.6, -0.4],
  [21, -3.8],
  [25.4, 0.6],
  [25.8, -1.4],
  [29, -3.4],
  [29, 2.8],
].entries()) {
  adorno(`junco-${i + 1}`, [x, G - 0.2, z], { forma: "mata", alto: 1.1 + 0.15 * (i % 3), semilla: 400 + i });
}

// ── 2. La tranquera y el pampero ────────────────────────────────────────────────────────────────────────────────
bloque("suelo-pampa", [30, -2, -3.2], [CANADA.x0, G, 3.2]);
// El pampero sopla del oeste hacia el este, a lo largo del camino (su frente, girado hacia +x)
pieza(
  "pampero",
  "pampero",
  [39, G + 2, 0],
  [6.4, 4, 16],
  { fuerza: 3, calma: 0.35, cada: 6, dura: 2.5, semilla: 2 },
  Math.PI / 2,
);
// El alambrado y la tranquera: la bisagra al norte (−z) y la manija al sur; se abre hacia el oeste, jalándola
alambrado("alambrado-tranquera-norte", [40, -3.2], [40, -1.68]);
alambrado("alambrado-tranquera-sur", [40, 1.68], [40, 3.2]);
pieza("tranquera", "tranquera", [40, G + 0.7, 0], [3, 1.3, 0.1], { fuerza: 16, abrir: 100, masa: 4 }, -Math.PI / 2);
// El pasador, del lado de adentro (el del campo), junto al poste de la bisagra: se empuja hacia el este
pieza("pasador", "palanca", [41.4, G + 0.6, -1.0], [0.6, 1.2, 0.3], { angulo: 30, vuelve: 0 }, -Math.PI / 2);

// ── 3. El chambergo y las boleadoras ────────────────────────────────────────────────────────────────────────────
pieza(
  "pampero-potrero",
  "pampero",
  [55, G + 2, 0],
  [6.4, 4, 18],
  { fuerza: 2.5, calma: 0.35, cada: 7, dura: 3, semilla: 5 },
  Math.PI / 2,
);
// Las boleadoras, colgadas del gancho de un poste a la altura de las manos (el gancho lo dibuja el guion)
bloque("poste-boleadoras", [47.53, G, -2.52], [47.67, G + 1.6, -2.38], { material: "corteza" });
pieza("boleadoras", "boleadoras", [47.6, G + 1.25, -1.9], [0.36, 0.5, 0.36], { masa: 1.2, vuelve: 2.5 });
// El chambergo vuela por el potrero, de 1.1 a 3.1 m de alto
pieza("chambergo", "chambergo", [56, G + 2.1, 0], [14, 2.4, 5.6], { velocidad: 1.3, enredar: 0.75, semilla: 4 });
// El alambrado del puesto y su portón (lo abre el guion cuando cae el chambergo)
alambrado("alambrado-puesto-norte", [64, -3.2], [64, -1.3]);
alambrado("alambrado-puesto-sur", [64, 1.3], [64, 3.2]);
bloque("porton-puesto", [63.92, G, -1.2], [64.08, G + 2.6, 1.2], { cuerpo: "cinematico", material: "corteza" });
// Las casas del puesto, lejos detrás del alambrado (solo imagen)
bloque("rancho-puesto", [57, G, -13.4], [61.5, G + 2.4, -10.6], { material: "tela" });
bloque("rancho-puesto-techo", [56.6, G + 2.4, -13.8], [61.9, G + 2.8, -10.2], { material: "honda" });
// El molino, girando con el viento al fondo del potrero
pieza("molino", "molino", [50, G + 4.6, -9.5], [8.4, 8.4, 1.1], {
  angulo: 15,
  viento: 1.4,
  arranque: 1.2,
  frenada: 2.5,
});

// ── 4. El ombú ──────────────────────────────────────────────────────────────────────────────────────────────────
// El tronco (lo dibuja el guion: sus raíces, el tronco y la copa): la horqueta, arriba, a 2.6 m
bloque("ombu", [OMBU.x0, G, OMBU.z0], [OMBU.x1, G + OMBU.horqueta, OMBU.z1], { invisible: 1 });
// La copa de atrás, 1.4 m más arriba (se trepa colgándose): ahí está el mate del secreto
bloque("ombu-copa", [76.5, G + OMBU.horqueta, OMBU.z0], [OMBU.x1, G + 4.0, -1.2], { invisible: 1 });
vacio("secreto", [77, G + 4.4, -1.9], [0.5, 0.4, 0.7], { tipo: "secreto" }, 0);
// El pie de amigo, al pie del tronco: el que se para ahí con los brazos alzados hace un escalón contra el tronco
pieza(
  "pie-de-amigo",
  "pie-de-amigo",
  [72.65, G + 0.6, -1.3],
  [0.6, 1.2, 0.6],
  { alto: 1.1, desde: 0.75, hasta: 1.35, ancho: 1 },
  Math.PI / 2,
);
// La rama gacha: la baja el guion con la palanca de la horqueta, del borde de la horqueta hasta el suelo
bloque("rama-gacha", [66, G, -0.4], [73.6, G + 0.22, 0.4], { cuerpo: "cinematico", material: "corteza" });
pieza(
  "palanca-rama",
  "palanca",
  [75.4, G + OMBU.horqueta + 0.6, -1.15],
  [0.6, 1.2, 0.3],
  { angulo: 30, vuelve: 0 },
  -Math.PI / 2,
);
// La rama larga: de la horqueta, en bajada, por encima de la cañada hasta la otra orilla
{
  const [x0, y0, x1, y1] = [OMBU.x1 - 0.1, G + OMBU.horqueta, 85.5, G + 1.0];
  const largo = Math.hypot(x1 - x0, y1 - y0);
  const angulo = Math.atan2(y1 - y0, x1 - x0);
  const grueso = 0.3;
  const rama = solido(
    "rama-larga",
    [(x0 + x1) / 2 + Math.sin(angulo) * (grueso / 2), (y0 + y1) / 2 - Math.cos(angulo) * (grueso / 2), 0.05],
    [largo, grueso, 0.9],
    { material: "corteza" },
  );
  rama.rotation.z = angulo;
}
// La cañada (6 m: no se salta), con agua que se lleva al que cae
agua("canada", CANADA.x0, CANADA.x1, -3.2, 3.2, CANADA.fondo, CANADA.superficie, { caer: "vacio", arrastre: 2 });
bloque("canada-lecho", [CANADA.x0, CANADA.fondo - 0.4, -3.2], [CANADA.x1, CANADA.fondo, 3.2], { material: "honda" });

// ── 5. La Luz en el candil ──────────────────────────────────────────────────────────────────────────────────────
bloque("suelo-este", [CANADA.x1, -2, -3.2], [106, G, 3.2]);
// El candil, colgado del gancho de un poste (el gancho lo dibuja el guion)
bloque("poste-candil", [89.43, G, -2.82], [89.57, G + 1.8, -2.68], { material: "corteza" });
pieza("candil", "candil", [89.5, G + 1.3, -2.3], [0.22, 0.34, 0.22], { masa: 1 });
// Los postes del alambrado donde se posa la Luz
alambrado("alambrado-luz", [90, -2.9], [102.5, -2.9], 1.15);

// ── Bordes: alambrados del norte, una pared invisible del lado de la cámara (+z) y las puntas ───────────────────
bloque("borde-banado-norte", [4, G - 2.2, -4.5], [30, G + 3, -4.2], { invisible: 1 });
bloque("borde-banado-oeste", [3.7, -2.2, -4.5], [4, G, -3.2], { invisible: 1 });
bloque("borde-banado-este", [30, -2.2, -4.5], [30.3, G, -3.2], { invisible: 1 });
alambrado("alambrado-salida-norte", [-3, -3.2], [4, -3.2]);
alambrado("alambrado-norte-1", [30, -3.2], [40, -3.2]);
alambrado("alambrado-norte-2", [40, -3.2], [64, -3.2]);
alambrado("alambrado-norte-3", [64, -3.2], [OMBU.x0, -3.2]);
bloque("borde-ombu-norte", [OMBU.x0, G, -3.5], [CANADA.x1, G + 3, -3.2], { invisible: 1 });
alambrado("alambrado-norte-4", [CANADA.x1, -3.2], [106, -3.2]);
bloque("borde-frente", [-3, -2.6, 3.2], [106, G + 3, 3.5], { invisible: 1 });
bloque("borde-oeste", [-3.3, -2, -3.2], [-3, G + 3, 3.2], { invisible: 1 });
bloque("borde-este", [106, -2, -3.2], [106.3, G + 3, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [0, G, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [0, G, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [33, G + 1, 0], [3, 1, 1], { tipo: "control", orden: 1 });
vacio("control-2", [45, G + 1, 0], [3, 1, 1], { tipo: "control", orden: 2 });
vacio("control-3", [66.5, G + 1, 1.6], [1.4, 1, 0.9], { tipo: "control", orden: 3 });
vacio("control-4", [87, G + 1, 0], [3, 1, 1], { tipo: "control", orden: 4 });
// La meta (aparece cuando la Luz queda encerrada en el candil)
vacio("control-5", [104, G + 1, 0], [3, 1, 1], { tipo: "control", orden: 5 });

// ── Adornos: el pasto de la llanura y la niebla ─────────────────────────────────────────────────────────────────
for (let i = 0; i < 40; i++) {
  // Matas bajas regadas (de semilla fija), sin tapar el camino del medio
  const x = 31 + ((i * 37) % 75) + 0.4 * Math.sin(i * 3.1);
  const z = -3 + ((i * 53) % 61) / 10;
  if (Math.abs(z) < 1.4 || (x > 72 && x < 85) || (x > 38 && x < 42)) continue;
  adorno(`pasto-${i + 1}`, [x, G, z], { forma: "mata", alto: 0.45 + 0.1 * (i % 4), semilla: 500 + i });
}
vacio("niebla-banado-1", [12, 0.6, -2], [12, 1.0, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.1 }, 0);
vacio("niebla-banado-2", [22, 0.9, 1], [10, 1.3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.08 }, 0);
vacio("niebla-canada", [81, -0.1, 0], [3, 1, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.06 }, 0);
vacio("niebla-1", [25, 2, -10], [26, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.16 }, 0);
vacio("niebla-2", [65, 2, -9], [28, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.18 }, 0);
vacio("niebla-3", [98, 2.5, -10], [18, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.14 }, 0);
vacio("niebla-4", [52, 5, -17], [64, 8, 1], { tipo: "niebla", opacidad: 0.65, velocidad: 0.22 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("15-pampa");
