// pnpm niveles: arma niveles/13-mina/escena.glb, el nivel 13 (TU-46): La mina, en Potosí (Bolivia). Túneles con
// vigas en el Cerro Rico, vagonetas, un pozo con su jaula, la galería del Tío (un diablito que quiere su ofrenda) y,
// al salir, el salar blanco que refleja el cielo. Como los otros, sin Blender: las mismas propiedades (`extras`) que se
// pondrían en Blender. La convención está en niveles/README.md; los rieles, las vigas y el salar los dibuja el guion.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x: la galería de abajo (y = 0), la de arriba
// (2.2 m, pasando el pozo) y el salar (−3.4), cuesta abajo. Mide 104 m (de −52 a 52): cabe en la foto de la red sin
// correrlo. Cada misión termina en un punto de control:
//   1. la vagoneta, de a dos: uno la empuja por la vía y el otro sostiene la palanca del cambio, lejos de la vía.
//      Derecho, la vía se acaba en un derrumbe; por el desvío llega a la báscula de la reja, que sube → punto 1
//   2. el pozo: la jaula sube con la polea. Uno se cuelga de la manija de abajo y el otro sube en la jaula; arriba,
//      el que subió se cuelga de la manija de arriba y sube al otro → punto 2
//   3. la ofrenda: se la lleva de su repisa al Tío entre las velas (sin pasar por ellas: ¡pum!, un susto). El Tío se
//      queda con la que le dejan suelta al alcance de la mano y abre su puerta → punto 3
//   4. los espejos del salar, de a dos: el sol entra por una grieta; cada uno sostiene un espejo en su tope y el haz
//      llega al sol de piedra, que abre la puerta de luz → punto 4
//   5. la salida: la vagoneta en la boca de la mina; con alguien adentro se le suelta el freno y baja la cuesta por un
//      puente de rieles hasta el salar → punto 5, la meta
// El secreto: la pepita de plata en la galería vieja, una repisa de 1.4 m (se trepa colgándose) entre la reja y el
// pozo. El logro, «Sin chispas»: salir de la mina sin explotar (sin pasar nunca la ofrenda por las velas).
import { crearEscena } from "./comun.mjs";

const { solido, pieza, vacio, exportar } = crearEscena({
  nivel: 13,
  nombre: "La mina",
  vacio: -6,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** Las alturas: la galería de abajo, la de arriba y el salar. */
const Y0 = 0;
const Y1 = 2.2;
const YS = -3.4;
const GRADOS = Math.PI / 180;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

// ── 1. La galería de abajo: la vagoneta, el cambio, el derrumbe y la reja ───────────────────────────────────────
bloque("galeria-baja", [-52, -2, -3.2], [-18.6, Y0, 3.2]);
// La vagoneta, con sus ruedas sobre la vía (el guion se la da: derecho al derrumbe, o por el desvío a la báscula)
pieza("vagoneta", "vagoneta", [-46, Y0 + 0.5, 1.2], [1.5, 1.0, 1.0], {
  masa: 40,
  roce: 2.5,
  velocidad: 1.6,
  ruedas: 0.3,
});
// La palanca del cambio, contra la pared del fondo, a más de 4 m de donde se empuja la vagoneta al pasar el cambio:
// se la empuja desde adelante (hacia la pared) y vuelve sola al soltarla
pieza("cambio", "palanca", [-38.5, Y0 + 0.65, -2.2], [0.6, 1.3, 0.3], { angulo: 35, vuelve: 1 });
// El derrumbe tapa la vía derecha (bajo: no se pasa por arriba, la reja lo cubre)
bloque("derrumbe", [-30.6, Y0, 0.2], [-28.4, Y0 + 1.0, 3.2], { material: "honda" });
// La báscula al final del desvío (la vagoneta que llega ahí sube la reja) y la reja, de lado a lado
bloque("bascula", [-29.9, Y0, -1.5], [-28.4, Y0 + 0.04, -0.3], { material: "corteza" });
bloque("reja", [-28.4, Y0, -3.2], [-28.1, Y0 + 3.0, 3.2], { cuerpo: "cinematico", material: "honda" });

// ── 2. El pozo: la jaula y sus dos poleas ──────────────────────────────────────────────────────────────────────
// La galería vieja: una repisa de 1.4 m al fondo (se trepa colgándose), sin salida, con la pepita del secreto
bloque("galeria-vieja", [-25.6, Y0, -3.2], [-22.6, Y0 + 1.4, -1.8], { material: "honda" });
vacio("secreto", [-24.6, Y0 + 1.4 + 0.5, -2.6], [0.5, 0.5, 0.5], { tipo: "secreto" }, 0);
// La galería de arriba empieza en la pared del pozo (2.2 m: no se trepa)
bloque("galeria-alta", [-18.6, -2, -3.2], [19.3, Y1, 3.2]);
// La jaula: un piso de tablas que sube y baja por el pozo, colgado de las dos poleas (lo mueve el guion)
bloque("jaula", [-20.0, Y0, -0.7], [-18.6, Y0 + 0.1, 0.7], { cuerpo: "cinematico", material: "corteza" });
// La polea de abajo: la manija al oeste de la jaula (a 1.4 m de ella: desde la jaula no se alcanza) y el gancho sobre
// la jaula. Colgándose de la manija, el gancho sube 2.1 m: la jaula queda a ras de la galería de arriba
pieza("polea-abajo", "polea", [-20.35, 2.3, -0.35], [2.1, 4.6, 0.5], {
  manija: 1.75,
  gancho: 2.0,
  recorrido: 0.4,
  subir: Y1 - 0.1,
  bajada: 0.2,
  subida: 0.2,
});
// La polea de arriba: la misma, mirando al revés, con la manija en la galería de arriba (a 1.75 m de su piso)
pieza(
  "polea-arriba",
  "polea",
  [-18.15, 2.3, 0.35],
  [2.3, 4.6, 0.5],
  { manija: Y1 + 1.75, gancho: 2.0, recorrido: 0.4, subir: Y1 - 0.1, bajada: 0.2, subida: 0.2 },
  Math.PI,
);

// ── 3. La ofrenda, las velas y El Tío ─────────────────────────────────────────────────────────────────────────
// La repisa de la ofrenda, contra el fondo; la ofrenda, a la altura de las manos (se agarra desde adelante)
bloque("repisa-ofrenda", [-13.9, Y1, -3.2], [-13.1, Y1 + 0.95, -2.3], { material: "honda" });
pieza("ofrenda", "ofrenda", [-13.5, Y1 + 0.95 + 0.11, -2.45], [0.3, 0.22, 0.22], { masa: 0.6, vuelve: 3 });
// Tres hileras de velas en el suelo, cada una con el paso de un lado distinto: hay que ir en zigzag
pieza("velas-1", "velas", [-10.5, Y1 + 0.125, -1.05], [0.3, 0.25, 3.9], { cuantas: 4, radio: 0.45 });
pieza("velas-2", "velas", [-7.5, Y1 + 0.125, 1.05], [0.3, 0.25, 3.9], { cuantas: 4, radio: 0.45 });
pieza("velas-3", "velas", [-4.5, Y1 + 0.125, -1.05], [0.3, 0.25, 3.9], { cuantas: 4, radio: 0.45 });
// El Tío, sentado en su altar contra el fondo, mirando a la galería; y su puerta, que abre al tener su ofrenda
pieza("tio", "tio", [-1.2, Y1 + 0.8, -2.3], [1.0, 1.6, 1.0], { vista: 5, alcance: 1.0 });
bloque("puerta-tio", [0.4, Y1, -3.2], [0.8, Y1 + 3.0, 3.2], { cuerpo: "cinematico", material: "corteza" });

// ── 4. Los espejos del salar ───────────────────────────────────────────────────────────────────────────────────
// El sol entra por una grieta del fondo, a 2 m (sobre las cabezas), hacia la galería
pieza("grieta", "grieta", [6.0, Y1 + 2.0, -3.1], [0.12, 0.9, 0.04], { largo: 14, rebotes: 3 });
// Dos espejos sobre sus postes: en reposo el haz se pierde; en su tope, el primero lo manda hacia el este y el
// segundo de vuelta hacia el oeste, al sol de piedra del fondo (el guion), donde el primero solo nunca llega. Cada uno
// vuelve solo al soltarlo
pieza(
  "espejo-1",
  "espejo",
  [6.0, Y1 + 2.0, 0.6],
  [1.2, 0.8, 0.04],
  { giro: -35, umbral: 0.97, poste: 1.6, manija: 1.0, brazo: 0.9 },
  -10 * GRADOS,
);
pieza(
  "espejo-2",
  "espejo",
  [12.0, Y1 + 2.0, 0.6],
  [1.2, 0.8, 0.04],
  { giro: 35, umbral: 0.97, poste: 1.6, manija: 1.0, brazo: 0.9 },
  42.5 * GRADOS,
);
// La puerta de luz: sube cuando el haz llega al sol de piedra
bloque("puerta-luz", [15.0, Y1, -3.2], [15.4, Y1 + 3.0, 3.2], { cuerpo: "cinematico", material: "honda" });

// ── 5. La boca de la mina y la cuesta al salar ──────────────────────────────────────────────────────────────────
// La boca: el piso sigue a los dos lados de la zanja de la vía, hasta el barranco
bloque("boca-fondo", [19.3, -2, -3.2], [22.0, Y1, 0.2]);
bloque("boca-frente", [19.3, -2, 1.4], [22.0, Y1, 3.2]);
// La vagoneta de salida, en su zanja: el borde a ras del piso, para meterse caminando. Va cuesta abajo (la frena el
// guion hasta que alguien se sube)
pieza("vagoneta-salida", "vagoneta", [20.2, Y1 - 1.07 + 0.5, 0.8], [1.7, 1.0, 1.0], {
  masa: 40,
  roce: 0.35,
  velocidad: 3.5,
  ruedas: 0.3,
});
// La zanja no tiene fondo: el que cae ahí cae al barranco
vacio("zanja", [20.65, Y1 - 2.6, 0.8], [0.6, 1.0, 1.35], { tipo: "vacio" });
// El salar, al pie de la cuesta
// (su costra la dibuja el guion: un espejo de agua sobre la sal)
bloque("salar", [41.0, -6, -9], [58.0, YS, 9], { invisible: 1 });

// ── Bordes: la roca del cerro al fondo (−z) y una pared invisible del lado de la cámara (+z) ────────────────────
bloque("roca-baja", [-52, -2, -4.6], [-18.6, 6, -3.2], { material: "honda" });
bloque("roca-alta", [-18.6, -2, -4.6], [22.0, 8, -3.2], { material: "honda" });
bloque("borde-baja", [-52, Y0, 3.2], [-18.6, Y0 + 3, 3.5], { invisible: 1 });
bloque("borde-alta", [-18.6, Y1, 3.2], [22.0, Y1 + 3, 3.5], { invisible: 1 });
bloque("borde-oeste", [-52.3, -2, -3.2], [-52, 6, 3.2], { invisible: 1 });
bloque("borde-salar-fondo", [41.0, YS, -3.0], [58.0, YS + 3, -2.7], { invisible: 1 });
bloque("borde-salar-frente", [41.0, YS, 4.0], [58.0, YS + 3, 4.3], { invisible: 1 });
bloque("borde-salar-este", [56.0, YS, -3.0], [56.3, YS + 3, 4.0], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-50, Y0, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-50, Y0, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El 1 pasando la reja
vacio("control-1", [-26.9, Y0 + 1, 0.4], [2.6, 1, 0.9], { tipo: "control", orden: 1 });
// El 2 arriba del pozo, pasando la manija de arriba
vacio("control-2", [-15.6, Y1 + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 2 });
// El 3 pasando la puerta del Tío
vacio("control-3", [2.4, Y1 + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 3 });
// El 4 pasando la puerta de luz, en la boca de la mina
vacio("control-4", [17.0, Y1 + 1, -1.0], [1.9, 1, 0.9], { tipo: "control", orden: 4 });
// El 5, la meta, en el salar: se llega en la vagoneta
vacio("control-5", [45.0, YS + 1.2, 0.8], [2.2, 1.2, 2.5], { tipo: "control", orden: 5 });

// ── Adornos: las rocas del salar, los cerros y la niebla ────────────────────────────────────────────────────────
for (const [i, [x, z, r]] of [
  [44.5, -2.2, 0.35],
  [51.0, 3.2, 0.3],
  [53.5, -2.0, 0.45],
].entries()) {
  adorno(`roca-salar-${i + 1}`, [x, YS - 0.05, z], { forma: "roca", radio: r, semilla: 300 + i });
}
for (const [i, [x, y, z, r]] of [
  [-44.0, Y0, -2.8, 0.4],
  [-33.0, Y0, -2.9, 0.35],
  [-21.5, Y0, 2.7, 0.4],
  [-15.0, Y1, 2.8, 0.35],
  [8.5, Y1, -2.8, 0.4],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 320 + i });
}
vacio("niebla-1", [-36, 1.5, -5.5], [16, 3, 1], { tipo: "niebla", opacidad: 0.35, velocidad: 0.06 }, 0);
vacio("niebla-2", [-2, 3.5, -5.5], [20, 3, 1], { tipo: "niebla", opacidad: 0.35, velocidad: -0.06 }, 0);
vacio("niebla-3", [38, 0, -10], [22, 4, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.15 }, 0);
vacio("niebla-4", [30, 2, -22], [40, 8, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);

await exportar("13-mina");
