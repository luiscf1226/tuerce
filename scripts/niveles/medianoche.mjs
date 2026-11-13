// pnpm niveles: arma niveles/16-medianoche/escena.glb, el nivel 16 (TU-49): La medianoche, en la Amazonía (Brasil), el
// último del viaje que empezó en el patio de Tegucigalpa la mañana del 31 de diciembre. La selva inundada (el igapó),
// nenúfares gigantes, un río ancho y, al final, una playa con fuegos artificiales. Como los otros, sin Blender: las
// mismas propiedades (`extras`) que se pondrían en Blender. La convención está en niveles/README.md; el agua es la de
// La poza.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. El agua está en y = 0 y la tierra en 0.3.
// Todo va corrido 53 m hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. las huellas del Curupira: la trocha se parte dos veces entre el monte (no se pasa de una a otra). Sus pies
//      están al revés: se fue por donde los dedos apuntan para acá. Las otras trochas acaban en el agua → punto 1
//   2. el igarapé de los nenúfares: se cruza saltando de hoja en hoja, que flotan y se ladean → punto 2, en el muelle
//   3. la montaria, de a dos: río arriba, contra la corriente, por un canal entre los árboles. Remando los dos al mismo
//      ritmo (uno en la proa y otro en la popa) se avanza; fuera de ritmo, no → punto 3, en la tierra firme
//   4. el árbol del Curupira, de a dos: el arbolito (9 kg) espera en un tocón; lo llevan entre los dos hasta el hoyo
//      del claro talado. Plantado, el Curupira se alegra y abre el monte → punto 4
//   5. los fuegos de Año Nuevo, de a dos: en la playa, cada castillo tiene sus dos chisperos lejos uno del otro; se
//      encienden agarrándolos a la vez. El castillo grande trae la meta → punto 5. Encender los tres a la medianoche
//      (en menos de un minuto) da el logro, «Feliz año»
// El secreto: un delfín rosado en el recodo del igarapé, a dos nenúfares del camino.
import { crearEscena } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 16,
  nombre: "La medianoche",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 24,
});

/** El agua y la tierra. */
const W = 0;
const G = 0.3;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 120 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -53;
/** El fondo del agua. */
const FONDO = -2;

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Una zona de agua de x0 a x1 y de z0 a z1, del fondo a la superficie, con su lecho. `hacia`: adónde corre
 * (`x-`, `z+` o nada). */
function agua(nombre, x0, x1, z0, z1, extras = {}, hacia = "") {
  const centro = [(x0 + x1) / 2, (FONDO + W) / 2, (z0 + z1) / 2];
  const alto = (W - FONDO) / 2;
  if (hacia === "x-")
    vacio(
      nombre,
      centro,
      [(z1 - z0) / 2, alto, (x1 - x0) / 2],
      { tipo: "agua", arrastre: 1.5, ...extras },
      -Math.PI / 2,
    );
  else vacio(nombre, centro, [(x1 - x0) / 2, alto, (z1 - z0) / 2], { tipo: "agua", arrastre: 1.5, ...extras }, 0);
  bloque(`lecho-${nombre}`, [x0, FONDO - 0.6, z0], [x1, FONDO, z1], { material: "honda" });
}

/** Una zona (de control o del secreto) de x0 a x1 y de z0 a z1, de `alto` sobre `y`, que mira hacia +x. */
function zona(nombre, extras, [x0, z0], [x1, z1], y = G, alto = 2) {
  vacio(nombre, [(x0 + x1) / 2, y + alto / 2, (z0 + z1) / 2], [(z1 - z0) / 2, alto / 2, (x1 - x0) / 2], extras);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

// ── 1. La selva inundada: las trochas y las huellas del Curupira ─────────────────────────────────────────────────
bloque("claro-salida", [-6, FONDO, -1.4], [2, G, 1.4]);
// La primera bifurcación: la trocha de adelante (hacia la cámara) acaba en el agua; la de atrás sigue
bloque("cruce-1", [2, FONDO, -2.6], [4, G, 2.6]);
bloque("trocha-adelante-1", [4, FONDO, 0.6], [11, G, 2.6]);
bloque("trocha-atras-1", [4, FONDO, -2.6], [14, G, -0.6]);
// La segunda: ahora sigue la de adelante y la de atrás acaba en el agua
bloque("cruce-2", [14, FONDO, -2.6], [16, G, 2.6]);
bloque("trocha-adelante-2", [16, FONDO, 0.6], [26, G, 2.6]);
bloque("trocha-atras-2", [16, FONDO, -2.6], [23, G, -0.6]);
bloque("claro-1", [26, FONDO, -2.6], [29, G, 2.6]);
// El monte entre las trochas: no se trepa ni se ve a través (invisible: lo dibujan las matas y los troncos)
bloque("monte-1", [4, G, -0.6], [14, G + 3, 0.6], { invisible: 1 });
bloque("monte-2", [16, G, -0.6], [26, G + 3, 0.6], { invisible: 1 });
// El tocón del Curupira, en el monte entre las dos primeras trochas: desde ahí mira a los que se pierden
bloque("tocon-curupira", [12.1, G, -0.4], [12.9, G + 1.1, 0.4], { material: "corteza" });
pieza("curupira", "curupira", [12.5, G + 1.1 + 0.6, 0], [0.5, 1.2, 0.5], { reir: 2.2 }, -Math.PI / 2);
agua("igapo", -6, 29, -6, 3.2);

// ── 2. El igarapé de los nenúfares ─────────────────────────────────────────────────────────────────────────────
// Corre hacia la cámara. Cinco hojas de 1.7 m, con medio metro de agua entre una y otra (se saltan caminando)
agua("igarape", 29, 40.2, -9, 3.2, { corriente: 0.4 });
for (const [i, [x, z]] of [
  [30.0, 0.3],
  [32.2, -0.3],
  [34.4, 0.3],
  [36.6, -0.3],
  [38.8, 0.2],
].entries()) {
  pieza(`nenufar-${i + 1}`, "nenufar", [x, W + 0.11, z], [1.7, 0.24, 1.7], { masa: 20, tallo: 250 });
}
// El recodo del secreto: dos hojas río arriba, desde la tercera, y una playita donde sale el delfín
pieza("nenufar-recodo-1", "nenufar", [34.0, W + 0.11, -2.05], [1.7, 0.24, 1.7], { masa: 20, tallo: 250 });
pieza("nenufar-recodo-2", "nenufar", [34.6, W + 0.11, -4.25], [1.7, 0.24, 1.7], { masa: 20, tallo: 250 });
bloque("playa-recodo", [32.4, FONDO, -7.6], [36.8, G, -5.45]);
zona("secreto", { tipo: "secreto" }, [32.8, -7.4], [36.4, -5.6], G, 1.4);

// ── 3. El río de la montaria ───────────────────────────────────────────────────────────────────────────────────
bloque("orilla-muelle", [40.2, FONDO, -2.6], [44, G, 2.6]);
bloque("muelle", [44, FONDO, -1.3], [45.6, G, 1.3], { material: "corteza" });
// La montaria, con la popa contra el muelle; flota con el piso a la altura del muelle
pieza("montaria", "montaria", [47.95, W + 0.14, 0], [4.6, 0.3, 1.0], { masa: 50, remo: 95, palada: 0.55 });
// El canal: corriente en contra hasta el remanso de la tierra firme. A los lados, el igapó, con los árboles tan
// juntos que la canoa no sale del canal (invisibles hasta 2.5 m: los dibuja el guion)
agua("rio", 45.6, 66, -1.3, 1.3, { corriente: 0.5 }, "x-");
agua("remanso", 66, 70, -1.3, 1.3);
agua("igapo-norte", 40.2, 70, -9, -1.3);
agua("igapo-sur", 45.6, 70, 1.3, 3.2);
bloque("arboles-norte", [45.6, FONDO, -1.65], [69.2, 2.5, -1.3], { invisible: 1 });
bloque("arboles-sur", [45.6, FONDO, 1.3], [69.2, 2.5, 1.65], { invisible: 1 });

// ── 4. La tierra firme y el árbol del Curupira ─────────────────────────────────────────────────────────────────
bloque("tierra-firme", [70, FONDO, -3.2], [92, G, 3.2]);
// El arbolito en su tocón, a la altura de las manos (9 kg: uno solo no lo mueve)
bloque("tocon-arbolito", [75.3, G, -0.2], [75.7, G + 0.75, 0.2], { material: "corteza" });
pieza("arbolito", "bloque", [75.5, G + 0.75 + 0.25, 0], [0.5, 0.5, 0.6], { masa: 9 });
// El monte cerrado: un enredo de bejucos con espinas que el Curupira abre cuando le plantan el árbol (3.2 m)
bloque("monte-cerrado", [86, G, -3.2], [86.4, G + 3.2, 3.2], { cuerpo: "cinematico", material: "honda" });

// ── 5. La playa y los fuegos ───────────────────────────────────────────────────────────────────────────────────
bloque("playa", [92, FONDO, -3.2], [113, G, 3.2]);
// Tres castillos, cada uno con su mecha a cada lado; los cohetes estallan atrás, sobre el río. El grande, en el medio
pieza("fuegos-1", "fuegos", [102, G + 1, -1.9], [6, 2, 0.8], { cohetes: 9, semilla: 1 });
pieza("fuegos-2", "fuegos", [95.6, G + 1, -1.9], [4.4, 2, 0.8], { cohetes: 6, semilla: 2 });
pieza("fuegos-3", "fuegos", [108.6, G + 1, -1.9], [4.4, 2, 0.8], { cohetes: 6, semilla: 3 });
agua("rio-grande", 70, 113, -40, -3.2);
// La otra orilla, lejos: el bosque que se ve contra el cielo de los fuegos
bloque("selva-lejana", [30, FONDO, -48], [120, 3, -40], { material: "lejana" });

// ── Bordes: paredes invisibles del lado de la cámara (+z), detrás de la tierra firme y en las puntas ──────────────
bloque("borde-frente", [-6.3, FONDO, 3.2], [113.3, G + 3, 3.5], { invisible: 1 });
bloque("borde-atras-tierra", [70, G, -3.5], [92, G + 3, -3.2], { invisible: 1 });
bloque("borde-oeste", [-6.3, FONDO, -3.2], [-6, G + 3, 3.2], { invisible: 1 });
bloque("borde-este", [113, FONDO, -3.2], [113.3, G + 3, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (miran hacia +x) ────────────────────────────────────────────────────────────────
vacio("salida-rojo", [-4, G, 0.5], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-4, G, -0.5], [1, 1, 1], { tipo: "salida", jugador: 2 });
zona("control-1", { tipo: "control", orden: 1 }, [26.4, -2.4], [28.8, 2.4]);
// El 2 en la orilla de enfrente, junto al muelle de la montaria
zona("control-2", { tipo: "control", orden: 2 }, [40.6, -2.4], [43, 2.4]);
zona("control-3", { tipo: "control", orden: 3 }, [70.4, -2.4], [73, 2.4]);
zona("control-4", { tipo: "control", orden: 4 }, [87.6, -2.4], [90, 2.4]);
// El 5, la meta, en la playa frente al castillo grande: aparece cuando se encienden sus fuegos. Mira al río (−z):
// la pareja queda mirando los fuegos
vacio("control-5", [102, G + 1, 1.4], [2.4, 1, 1.4], { tipo: "control", orden: 5 }, Math.PI);

// ── Adornos: matas en el monte entre las trochas y en las orillas ──────────────────────────────────────────────
const matas = [];
// El monte entre las trochas: matas altas y apretadas
for (const [x0, x1] of [
  [4.3, 14],
  [16.3, 26],
]) {
  for (let x = x0, i = 0; x < x1; x += 0.55, i++)
    matas.push([x, G, ((i * 7) % 5) * 0.08 - 0.16, 1.6 + 0.25 * ((i * 3) % 3)]);
}
matas.push(
  [-5.4, G, 1.1, 0.9],
  [-5.6, G, -1.1, 1],
  [1.6, G, 1.2, 0.8],
  [28.5, G, 2.3, 0.9],
  [28.4, G, -2.3, 1],
  [40.6, G, 2.3, 0.9],
  [43.5, G, -2.4, 1],
  [36.4, G, -5.7, 0.7],
  [70.6, G, 2.6, 0.9],
  [79, G, 2.7, 1],
  [84.6, G, 2.6, 0.9],
  [91.4, G, 2.6, 1],
  [112.4, G, 2.4, 0.9],
  [112.3, G, -2.6, 1],
);
for (const [i, [x, y, z, alto]] of matas.entries())
  adorno(`mata-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 30 + i });
for (const [i, [x, y, z, r]] of [
  [27.2, G, -2.2, 0.3],
  [41.2, G, -2.1, 0.35],
  [92.8, G, 2.5, 0.3],
  [111.6, G, -2.7, 0.35],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 60 + i });
}
// Los troncos talados del claro del árbol
for (const [i, [x, z, rumbo]] of [
  [79.5, 2.2, 0.4],
  [84.5, -2.6, -0.3],
  [80.6, -2.5, 1.2],
].entries()) {
  adorno(`talado-${i + 1}`, [x, G + 0.15, z], { forma: "tronco", alto: 2.4, radio: 0.18, semilla: 80 + i }, rumbo);
}

// Niebla: el vaho de la selva de noche, en capas entre los árboles
vacio("niebla-igapo", [10, 0.7, 0], [12, 1, 1], { tipo: "niebla", opacidad: 0.35, velocidad: 0.06 }, 0);
vacio("niebla-rio", [57, 0.6, 0], [12, 1, 1], { tipo: "niebla", opacidad: 0.35, velocidad: -0.07 }, 0);
vacio("niebla-1", [15, 2, -7], [22, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [55, 2.2, -8], [22, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.1 }, 0);
vacio("niebla-3", [90, 2, -8], [20, 3, 1], { tipo: "niebla", opacidad: 0.4, velocidad: 0.1 }, 0);
vacio("niebla-4", [40, 3.5, -14], [40, 5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: -0.15 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("16-medianoche");
