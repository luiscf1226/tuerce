// pnpm niveles: arma niveles/01-pinar/escena.glb, el nivel 1 (TU-14): La Esperanza, Honduras. Un bosque de pinos con
// neblina clara, cercos de madera y una pulpería al final; lo cuida el Cadejo. Como los otros, sin Blender: las
// mismas propiedades (`extras`) que se pondrían en Blender. La convención está en niveles/README.md.
//
// El recorrido sube de oeste a este (+x), con la pareja mirando hacia +x. Cada misión termina en un punto de control:
//   1. el patio: un cerco de 2.9 m, un cajón largo (1.5 m) y bajo (40 cm) y dos huacales de 50 cm. Un muñeco trepa
//      colgándose solo de lo fijo (no de un huacal, que se mueve): a los huacales se sube de un salto, con impulso.
//      Con el cajón contra el cerco y un huacal apilado encima, adelante, queda una escalera: se salta al cajón, se
//      toma impulso, se salta al huacal (90 cm) y desde ahí se trepa el cerco (2 m). Desde el cajón solo no se
//      llega (2.5 m, aunque se tome impulso). Del otro lado, una leñera en escalones para bajar → punto 1
//   2. una quebrada con un balancín de tronco: el lado de tierra pesa más, así que la punta de la quebrada queda
//      arriba, a la altura de la otra orilla. El que cruza la inclina en cuanto pasa el eje; con el otro de
//      contrapeso en la punta de tierra, no → punto 2 en la otra orilla, 2.85 m más arriba
//   3. un barranco de 2.2 m con un bejuco para cada uno → punto 3
//   4. un tronco de 9 kg sobre dos caballetes (uno solo levanta 5) y una zanja de 1.6 m con la otra orilla 40 cm
//      más alta: lo llevan los dos en fila, el de adelante se para en el borde y lo sueltan → punto 4
//   5. el corral del Cadejo: un hueso en un tocón, a la entrada; al fondo, el portón, que se abre mientras alguien
//      saca la tranca (y queda abierto pasado el punto 5) → punto 5
//   6. la pulpería: la puerta se abre al encender la lámpara del alero → punto 6 adentro, la meta
// El secreto: el nido en el pino más alto, junto a la pulpería; se sube por tres ramas, de a 1.5 m.
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 1,
  nombre: "El pinar",
  vacio: -4,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** Las alturas del suelo: el patio, la otra orilla de la quebrada y la otra orilla de la zanja. */
const Y1 = 0;
const Y2 = 2.85;
const Y3 = Y2 + 0.4;

/** Un sólido redondo (un tocón): como `solido`, pero con malla de cilindro, para que también se vea redondo. */
function tocon(nombre, [x, y, z], radio, alto) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio * 1.1, alto, 14));
  m.name = nombre;
  m.position.set(x, y, z);
  m.userData = { tipo: "solido", forma: "cilindro", material: "corteza" };
  escena.add(m);
}

/** Una loma: el suelo claro arriba (40 cm) y la peña oscura debajo, hasta `abajo`. `desde` es donde empieza la
 * peña (más adentro que el borde de arriba, para dejar una ceja). */
function loma(nombre, x0, x1, arriba, abajo = -2, desde = x0) {
  solido(nombre, [(x0 + x1) / 2, arriba - 0.2, 0], [x1 - x0, 0.4, 6]);
  solido(`${nombre}-pena`, [(desde + x1) / 2, (arriba - 0.4 + abajo) / 2, 0], [x1 - desde, arriba - 0.4 - abajo, 6], {
    material: "tela",
  });
}

/** Un cerco de estacas: choca como una caja (con arriba parejo, para trepar) y se ve como estacas de alto parejo. */
function cerco(nombre, x, z0, z1, alto, y = 0, fondo = 0.3) {
  solido(nombre, [x, y + alto / 2, (z0 + z1) / 2], [fondo, alto, z1 - z0], { invisible: 1 });
  const n = Math.max(1, Math.round((z1 - z0) / 0.3));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
    const ancho = 0.2 + 0.05 * ((i * 7) % 3);
    solido(`${nombre}-estaca-${i + 1}`, [x, y + alto / 2, z], [fondo * 0.85, alto, ancho], { material: "corteza" });
  }
}

/** Un cerco bajo de postes y dos travesaños, para los bordes del camino (no deja caerse distraído). */
function cerquita(nombre, x0, x1, z, y = 0) {
  const n = Math.max(1, Math.round((x1 - x0) / 1.6));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (i * (x1 - x0)) / n;
    solido(`${nombre}-poste-${i + 1}`, [x, y + 0.45, z], [0.14, 0.9, 0.14], { material: "corteza" });
  }
  for (const [j, alto] of [0.42, 0.78].entries()) {
    solido(`${nombre}-travesano-${j + 1}`, [(x0 + x1) / 2, y + alto, z], [x1 - x0, 0.07, 0.07], {
      material: "corteza",
    });
  }
}

// ── 1. El patio y el cerco ───────────────────────────────────────────────────────────────────────────────────────
solido("patio", [3.7, -0.5, 0], [19.4, 1, 6]);
cerquita("cerquita-patio-1", -5.8, 3.4, 2.9);
cerquita("cerquita-patio-2", -5.8, 3.4, -2.9);
// El cajón (para empujarlo contra el cerco), un huacal sobre un tocón, a la altura de las manos alzadas, para
// levantarlo (uno solo puede: pesa 5 kg) y ponerlo encima del cajón, y otro de repuesto. El tocón queda más abajo
// de donde agarran las manos
pieza("cajon", "huacal", [1.0, 0.2, 1.0], [1.5, 0.4, 0.7]);
tocon("tocon-huacal", [0.2, 0.325, -1.6], 0.25, 0.65);
pieza("huacal-1", "huacal", [0.2, 0.9, -1.6], [0.5, 0.5, 0.5], { masa: 5 });
pieza("huacal-2", "huacal", [-1.8, 0.25, -2.1], [0.5, 0.5, 0.5], { masa: 5 }, 0.3);
// Grueso (70 cm), para que arriba quepa uno de pie al terminar de trepar
cerco("cerco", 4.15, -3, 3, 2.9, Y1, 0.7);
// La leñera del otro lado: escalones de 70 cm para bajar sin golpearse
solido("lena-1", [4.8, Y1 + 1.1, 0], [0.6, 2.2, 6], { material: "corteza" });
solido("lena-2", [5.4, Y1 + 0.725, 0], [0.6, 1.45, 6], { material: "corteza" });
solido("lena-3", [6.0, Y1 + 0.35, 0], [0.6, 0.7, 6], { material: "corteza" });

// ── 2. La quebrada y el balancín ────────────────────────────────────────────────────────────────────────────────
// El eje al borde del patio (x = 13.3): 4.9 m de tabla sobre la tierra y 4.2 sobre la quebrada. Con 17° de tope, la
// punta de tierra queda apoyada a ras del suelo y la de la quebrada arriba, junto a la otra orilla
const BALANCIN = { eje: 13.3, tierra: 4.9, quebrada: 4.2, angulo: 17, grueso: 0.2, ancho: 0.8 };
{
  const { eje, tierra, quebrada, angulo, grueso, ancho } = BALANCIN;
  const rad = (angulo * Math.PI) / 180;
  const alto = tierra * Math.sin(rad) + (grueso / 2) * Math.cos(rad) + 0.03;
  const largo = tierra + quebrada;
  pieza("balancin", "balancin", [eje - tierra + largo / 2, alto, 0], [largo, grueso, ancho], {
    apoyo: tierra / largo,
    angulo,
  });
}
// Una laja delante de la punta de tierra, para subirse en dos pasitos
solido("laja", [8.35, 0.05, 0], [0.5, 0.1, 1.2], { material: "honda" });
// La otra orilla, 2.85 m más arriba: la punta del balancín arriba llega a 13 cm de su borde. Abajo la cara se mete
// para adentro (la ceja de arriba sobresale), así la punta de la tabla gira sin trabarse contra ella
loma("loma-1", 17.45, 22.65, Y2, -2, 17.75);
vacio("quebrada", [15.4, -2.2, 0], [2.0, 1.4, 3], { tipo: "vacio" }, 0);

// ── 3. El barranco y los bejucos ────────────────────────────────────────────────────────────────────────────────
// Como en el nivel de piezas: la rama a 4 m, un bejuco para cada uno a 30 cm del borde y con la punta a 1 m del piso
solido("rama", [22.95, Y2 + 4, -1.4], [0.2, 0.2, 4.7], { material: "corteza" });
pieza("bejuco-rojo", "bejuco", [22.95, Y2 + 2.45, 0.45], [0.08, 2.9, 0.08]);
pieza("bejuco-turquesa", "bejuco", [22.95, Y2 + 2.45, -0.45], [0.08, 2.9, 0.08]);
loma("loma-2", 24.8, 33.6, Y2);
vacio("barranco", [23.75, Y2 - 2.6, 0], [1.1, 1.5, 3], { tipo: "vacio" }, 0);

// ── 4. El tronco y la zanja ─────────────────────────────────────────────────────────────────────────────────────
// El tronco a lo largo del camino, sobre dos caballetes angostos, a la altura de las manos alzadas. Se lo carga en
// fila, con la mano derecha, cerca del medio: cada uno camina 45 cm a la izquierda del tronco (por al lado de los
// caballetes). Es largo para que, con el de adelante parado en el borde, la punta llegue bien a la otra orilla y
// los dos carguen lo mismo (cada muñeco levanta a lo sumo 5 kg)
solido("caballete-1", [27.4, Y2 + 0.425, 0.6], [0.25, 0.85, 0.3], { material: "corteza" });
solido("caballete-2", [31.1, Y2 + 0.425, 0.6], [0.25, 0.85, 0.3], { material: "corteza" });
pieza("tronco", "tronco", [29.25, Y2 + 1.0, 0.6], [5.6, 0.3, 0.45]);
// La zanja: 1.6 m y la otra orilla 40 cm más alta (ni se salta ni se le llega con las manos)
loma("loma-3", 35.2, 57.0, Y3);
vacio("zanja", [34.4, Y2 - 2.6, 0], [0.8, 1.5, 3], { tipo: "vacio" }, 0);

// ── 5. El corral del Cadejo ─────────────────────────────────────────────────────────────────────────────────────
// El hueso, a la entrada, afuera del corral: atravesado sobre una horqueta, a la altura de las manos alzadas y a lo
// ancho, para que lo agarren las dos (van separadas 42 cm). El tocón queda más abajo de donde agarran las manos
tocon("tocon-hueso", [37.6, Y3 + 0.275, 2.3], 0.22, 0.55);
solido("horqueta", [37.6, Y3 + 0.725, 2.3], [0.05, 0.35, 0.05], { material: "corteza" });
pieza("hueso", "hueso", [37.6, Y3 + 0.95, 2.3], [0.5, 0.1, 0.1], {}, Math.PI / 2);
// La entrada del corral: dos tramos de cerco bajo y un hueco de 2.4 m en el medio
for (const lado of [-1, 1]) {
  for (const [i, z] of [1.2, 2.05, 2.9].entries()) {
    solido(`corral-poste-${lado > 0 ? "a" : "b"}${i + 1}`, [38.3, Y3 + 0.45, lado * z], [0.14, 0.9, 0.14], {
      material: "corteza",
    });
  }
  for (const [j, alto] of [0.42, 0.78].entries()) {
    solido(`corral-baranda-${lado > 0 ? "a" : "b"}${j + 1}`, [38.3, Y3 + alto, lado * 2.05], [0.07, 0.07, 1.7], {
      material: "corteza",
    });
  }
}
// El Cadejo: su caja es su corral
pieza("cadejo", "cadejo", [41.2, Y3 + 0.5, 0], [5.6, 1, 6]);
// El fondo del corral: un cerco alto con el portón en el medio, que se corre detrás del cerco
cerco("cerco-corral-1", 44.15, -3, -0.8, 2.85, Y3);
cerco("cerco-corral-2", 44.15, 0.8, 3, 2.85, Y3);
solido("porton", [44.38, Y3 + 1.425, 0], [0.12, 2.85, 1.6], { cuerpo: "cinematico", material: "corteza" });
// La tranca, del lado del corral, junto al portón: una barra a lo largo de z que sale hacia −x. Sus ganchos la
// separan 25 cm del cerco, así las manos encuentran primero la barra (y no el cerco de atrás)
pieza("tranca", "tranca", [43.68, Y3 + 1.0, 1.75], [0.9, 0.16, 0.14], { recorrido: 0.45 }, -Math.PI / 2);
solido("tranca-soporte", [43.92, Y3 + 0.85, 1.75], [0.3, 0.1, 0.12], { material: "honda" });

// ── 6. La pulpería ──────────────────────────────────────────────────────────────────────────────────────────────
// Al fondo del camino (hacia −z), con la puerta en el frente y la lámpara del lado de afuera: así la pared no le
// tapa la cámara al que llega
const PULPERIA = { x0: 51, x1: 56, z0: -2.9, z1: 0.8, alto: 3, puerta: [-1.4, -0.2] };
{
  const { x0, x1, z0, z1, alto, puerta } = PULPERIA;
  const g = 0.25;
  const [p0, p1] = puerta;
  solido("pulperia-frente-1", [x0 + g / 2, Y3 + alto / 2, (p1 + z1) / 2], [g, alto, z1 - p1], { material: "tela" });
  solido("pulperia-frente-2", [x0 + g / 2, Y3 + alto / 2, (z0 + p0) / 2], [g, alto, p0 - z0], { material: "tela" });
  solido("pulperia-dintel", [x0 + g / 2, Y3 + 2.5, (p0 + p1) / 2], [g, 1, p1 - p0], { material: "tela" });
  solido("pulperia-fondo", [x1 - g / 2, Y3 + alto / 2, (z0 + z1) / 2], [g, alto, z1 - z0], { material: "tela" });
  solido("pulperia-lado-1", [(x0 + x1) / 2, Y3 + alto / 2, z1 - g / 2], [x1 - x0, alto, g], { material: "tela" });
  solido("pulperia-lado-2", [(x0 + x1) / 2, Y3 + alto / 2, z0 + g / 2], [x1 - x0, alto, g], { material: "tela" });
  // El techo con alero hacia el camino, en dos gradas
  solido("pulperia-techo", [(x0 + x1) / 2 - 0.2, Y3 + alto + 0.1, (z0 + z1) / 2], [x1 - x0 + 1.2, 0.2, z1 - z0 + 1], {
    material: "honda",
  });
  solido("pulperia-cumbrera", [(x0 + x1) / 2, Y3 + alto + 0.45, (z0 + z1) / 2], [x1 - x0 - 0.6, 0.5, z1 - z0 - 1.2], {
    material: "honda",
  });
  // La puerta: se corre dentro de la pared cuando se enciende la lámpara
  solido("puerta", [x0 + g / 2, Y3 + 1, (p0 + p1) / 2], [0.12, 2, p1 - p0], {
    cuerpo: "cinematico",
    material: "honda",
  });
  // La lámpara, colgada del alero junto a la puerta, a la altura de las manos
  pieza("lampara", "lampara", [x0 - 0.45, Y3 + 1.05, 0.66], [0.22, 0.32, 0.22], { cadena: alto - 1.21 });
}

// ── El secreto: el nido en el pino más alto ─────────────────────────────────────────────────────────────────────
// Al pie del pino, tres tocones de leña apilada en escalones de 1.5 m (se trepan colgándose); arriba del último, el nido
const ESCALONES = [
  [47.0, 0, 1.5],
  [48.2, 1.5, 3.0],
  [49.4, 3.0, 4.5],
];
for (const [i, [x, desde, hasta]] of ESCALONES.entries()) {
  solido(`escalon-nido-${i + 1}`, [x, Y3 + (desde + hasta) / 2, -2.45], [1.2, hasta - desde, 0.9], {
    material: "corteza",
  });
}
vacio("secreto", [49.6, Y3 + 4.85, -2.45], [0.4, 0.35, 0.45], { tipo: "secreto" }, 0);

// ── Salidas y puntos de control (zonas de 1 × 2 × 6 m, rotadas para mirar hacia +x) ───────────────────────────────
vacio("salida-rojo", [-4.5, Y1, 1], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-4.5, Y1, -1], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El punto 1 corrido hacia +z: el turquesa reaparece frente al eje del balancín
vacio("control-1", [7.4, Y1 + 1, 0.45], [2.55, 1, 0.5], { tipo: "control", orden: 1 });
vacio("control-2", [18.7, Y2 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 2 });
vacio("control-3", [26.0, Y2 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 3 });
vacio("control-4", [36.4, Y3 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 4 });
vacio("control-5", [45.4, Y3 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 5 });
vacio("control-6", [53.6, Y3 + 1, -1.05], [1.5, 1, 0.8], { tipo: "control", orden: 6 });

// ── Adornos ─────────────────────────────────────────────────────────────────────────────────────────────────────
// El pino más alto (el del nido), el de la rama de los bejucos y más pinos que suben del vacío
vacio(
  "pino-del-nido",
  [48.4, -6, -3.5],
  [1, 1, 1],
  { tipo: "adorno", forma: "pino", alto: 34, radio: 0.5, semilla: 7 },
  0,
);
vacio(
  "pino-de-la-rama",
  [22.95, -6, -4.0],
  [1, 1, 1],
  { tipo: "adorno", forma: "pino", alto: 26, radio: 0.44, semilla: 8 },
  0,
);
const pinos = [
  [-4, -4.5, 0.36],
  [2, -5.5, 0.4],
  [9, -4.3, 0.34],
  [15, -5.0, 0.42],
  [19.5, -4.4, 0.38],
  [27, -4.6, 0.4],
  [32, -5.3, 0.36],
  [38, -4.4, 0.42],
  [42, -5.6, 0.38],
  [53, -4.8, 0.4],
  [-1, -9, 0.4],
  [7, -11, 0.42],
  [17, -10, 0.4],
  [25, -9, 0.44],
  [34, -10.5, 0.4],
  [44, -9.5, 0.42],
  [55, -10, 0.4],
  [11, 4.6, 0.3],
  [31, 4.8, 0.32],
  [47, 4.7, 0.3],
];
for (const [i, [x, z, radio]] of pinos.entries()) {
  vacio(`pino-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "pino", alto: 24, radio, semilla: 20 + i }, 0);
}
for (let i = 0; i < 26; i++) {
  const x = -8 + i * 2.6;
  const z = -13 - (i % 3) * 3;
  vacio(`abeto-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "abeto", alto: 9 + (i % 4) * 1.5 }, 0);
}
const rocas = [
  [-3.2, Y1, -2.4, 0.4],
  [9.5, Y1, 2.4, 0.5],
  [19.4, Y2, -2.4, 0.45],
  [25.6, Y2, 2.5, 0.4],
  [36.2, Y3, -2.5, 0.5],
];
for (const [i, [x, y, z, radio]] of rocas.entries()) {
  vacio(`roca-${i + 1}`, [x, y - 0.05, z], [1, 1, 1], { tipo: "adorno", forma: "roca", radio, semilla: 90 + i }, 0);
}
const matas = [
  [2.6, Y1, 2.5, 0.7],
  [-5.3, Y1, 2.4, 1],
  [11.5, Y1, -2.6, 0.8],
  [21.5, Y2, 2.5, 0.9],
  [32.5, Y2, -2.6, 0.8],
  [39.5, Y3, 2.6, 0.9],
  [49.2, Y3, -2.7, 1.1],
];
for (const [i, [x, y, z, alto]] of matas.entries()) {
  vacio(`mata-${i + 1}`, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "mata", alto, semilla: 30 + i }, 0);
}
vacio(
  "tronco-1",
  [1.0, Y1 + 0.2, -2.65],
  [1, 1, 1],
  {
    tipo: "adorno",
    forma: "tronco",
    alto: 4,
    radio: 0.2,
    semilla: 5,
  },
  0.1,
);

// Niebla: el vapor de la quebrada, del barranco y de la zanja, y capas entre los pinos
vacio("niebla-quebrada", [15.4, -1.2, 0], [5, 1.5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.1 }, 0);
vacio("niebla-barranco", [23.7, Y2 - 1.6, 0], [4, 1.5, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.08 }, 0);
vacio("niebla-zanja", [34.4, Y2 - 1.6, 0], [4, 1.5, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.08 }, 0);
vacio("niebla-1", [8, 0.5, -5], [14, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [30, 3.5, -5.5], [16, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [14, 2, -9], [20, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-4", [42, 4, -9], [20, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-5", [24, 4, -14], [36, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

await exportar("01-pinar");
