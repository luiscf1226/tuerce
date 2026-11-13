// pnpm niveles: arma niveles/08-cafetal/escena.glb, el nivel 8 (TU-41): El cafetal, en Izalco (El Salvador).
// Cafetales en la falda del volcán, patios de secado, un beneficio y El Cipitío, un cipote barrigón que tira
// piedritas y se ríe. Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La
// convención está en niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x, subiendo por terrazas: el cafetal (y = 0), el
// patio de secado (1.4) y la terraza del beneficio (3.5). Mide 82 m, de −46 a 36: cabe en la foto de la red (±64 m)
// sin correrlo. Cada misión termina en un punto de control:
//   1. los canastos, de a dos: uno, en el tapesco del cafetal, lanza los canastos (salta y los suelta en el aire);
//      el otro, en el patio (1.4 m, se trepa colgándose: con un canasto en las manos no), los atrapa y los vacía en
//      el recibidero, lejos del borde. El canasto que toca el suelo se riega. Con tres, baja el portón → punto 1
//   2. las piedras del Cipitío: el muro de la terraza mide 2.1 m (no se trepa); El Cipitío, en la rama del palo de
//      jocote, le tira piedras a los pies al que se acerca. Una piedra al pie del muro es un escalón → punto 2
//   3. la zaranda, de a dos: se la mueve entre los dos, uno de cada manija, hasta que la llave cae en la repisa de
//      atrás; la llave abre el candado de la puerta del beneficio → punto 3
//   4. la polea: se cuelgan los dos sacos del gancho y, colgándose de la manija, suben a la troja; con los dos
//      arriba se abre la puerta de atrás → punto 4
//   5. el guineo: El Cipitío se sentó en el portillo de la tapia y le tira piedrazos al que se acerca. Al que le
//      trae un guineo (de la mata de atrás del beneficio) no le tira: se lo come, se sube a la tapia y deja pasar
//      → punto 5, la meta
// El secreto: el sombrero puntudo del Cipitío, arriba de la piedra grande de detrás de la meta (dos gradas de 1.4 m).
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 8,
  nombre: "El cafetal",
  vacio: -3,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** Las alturas: el cafetal, el patio de secado y la terraza del beneficio. */
const Y0 = 0;
const Y1 = 1.4;
const Y2 = 3.5;

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

// ── 1. El cafetal, el tapesco y el patio de secado ──────────────────────────────────────────────────────────────
bloque("cafetal", [-46, -2, -3.2], [-27.8, Y0, 3.2]);
// El tapesco: una tarima de 80 cm con su grada, y los tres canastos llenos, cada uno en su poste (a la altura de
// las manos del que está en el tapesco), contra la punta que da al patio
bloque("grada-tapesco", [-32.6, Y0, -2.4], [-31.8, Y0 + 0.4, 1.0], { material: "corteza" });
bloque("tapesco", [-31.8, Y0, -2.4], [-29.0, Y0 + 0.8, 1.0], { material: "corteza" });
for (const [i, z] of [-1.8, -0.6, 0.6].entries()) {
  bloque(`poste-canasto-${i + 1}`, [-29.3, Y0 + 0.8, z - 0.05], [-29.2, Y0 + 1.8, z + 0.05], { material: "corteza" });
  pieza(`canasto-${i + 1}`, "canasto", [-29.25, Y0 + 1.8 + 0.16, z], [0.44, 0.32, 0.44], { masa: 1.5 });
}
// El patio de secado: 1.4 m sobre el cafetal (se trepa colgándose). El que atrapa se para a un metro del borde
bloque("patio", [-27.8, -2, -3.2], [-12.0, Y1, 3.2]);
// El recibidero: un cajón de tablas a ras del suelo (se entra caminando), a más de 6 m del borde (hasta ahí no
// llega un canasto tirado)
bloque("recibidero-oeste", [-23.2, Y1, -2.8], [-23.1, Y1 + 0.12, -0.4], { material: "corteza" });
bloque("recibidero-este", [-20.9, Y1, -2.8], [-20.8, Y1 + 0.12, -0.4], { material: "corteza" });
bloque("recibidero-atras", [-23.1, Y1, -2.8], [-20.9, Y1 + 0.12, -2.7], { material: "corteza" });
bloque("recibidero-frente", [-23.1, Y1, -0.5], [-20.9, Y1 + 0.12, -0.4], { material: "corteza" });
// El portón del patio: baja cuando hay tres canastos en el recibidero
bloque("porton-patio", [-18.2, Y1, -3.2], [-17.8, Y1 + 2.4, 3.2], { cuerpo: "cinematico", material: "corteza" });

// ── 2. El muro de la terraza y El Cipitío ───────────────────────────────────────────────────────────────────────
// El muro: 2.1 m (no se trepa: hasta 1.65); con una piedra de 50 cm al pie, sí. El Cipitío, sentado en la rama del
// palo de jocote que sale por encima del muro, mira al patio
bloque("terraza", [-12.0, -2, -3.2], [36, Y2, 3.2]);
pieza(
  "cipitio",
  "cipitio",
  [-12.45, Y2 + 0.55 + 0.5, -1.7],
  [0.9, 1.0, 0.9],
  {
    vista: 5.5,
    cada: 2.2,
    piedras: 4,
    corto: 0,
    cerca: 0,
    empujon: 0,
    vuelo: 0.9,
  },
  -Math.PI / 2,
);

// ── 3. La zaranda y la puerta del beneficio ─────────────────────────────────────────────────────────────────────
// La zaranda cuelga de la ramada con las manijas a la altura de las manos; la llave cae por detrás y queda colgando
// de un clavo (se llega pasando por debajo de la zaranda con los brazos abajo: alzados, se agarra la bandeja)
pieza("zaranda", "zaranda", [-5.5, Y2 + 1.25, 0], [2.0, 0.12, 1.0], {
  masa: 12,
  recorrido: 0.35,
  zarandeos: 6,
  umbral: 0.7,
  llave: 0.6,
  vuelve: 4,
});
// El paral con el clavo de donde queda colgando la llave (detrás de ella, más lejos de lo que llegan las manos)
bloque("paral-llave", [-5.56, Y2, -1.5], [-5.44, Y2 + 1.95, -1.38], { material: "corteza" });
for (const x of [-7.6, -3.4])
  for (const z of [-1.4, 1.4])
    bloque(`ramada-${x}-${z}`, [x - 0.08, Y2, z - 0.08], [x + 0.08, Y2 + 3, z + 0.08], {
      material: "corteza",
    });
bloque("ramada-techo", [-7.9, Y2 + 3, -1.7], [-3.1, Y2 + 3.12, 1.7], { material: "corteza" });
// La pared del beneficio, con su puerta (la abre la llave en el candado, a su lado). La parte de adelante (hacia la
// cámara) no se ve: deja ver adentro
bloque("beneficio-oeste-atras", [-0.2, Y2, -3.2], [0.2, Y2 + 4.5, -0.7], { material: "tela" });
bloque("beneficio-oeste-frente", [-0.2, Y2, 0.7], [0.2, Y2 + 4.5, 3.2], { invisible: 1 });
bloque("beneficio-oeste-dintel", [-0.2, Y2 + 2.4, -0.7], [0.2, Y2 + 4.5, 0.7], { material: "tela" });
bloque("puerta-beneficio", [-0.1, Y2, -0.7], [0.1, Y2 + 2.4, 0.7], { cuerpo: "cinematico", material: "corteza" });
bloque("candado", [-0.32, Y2 + 1.15, -1.02], [-0.2, Y2 + 1.35, -0.88], { material: "honda" });

// ── 4. La polea, los sacos y la troja ───────────────────────────────────────────────────────────────────────────
// Los dos sacos en su tarima, contra el borde de adelante (se agarran desde adelante)
bloque("tarima-sacos", [2.0, Y2, -2.9], [3.4, Y2 + 0.85, -2.1], { material: "corteza" });
pieza("saco-1", "saco", [2.35, Y2 + 0.85 + 0.275, -2.28], [0.45, 0.55, 0.4], { masa: 4, vuelve: 3 });
pieza("saco-2", "saco", [3.05, Y2 + 0.85 + 0.275, -2.28], [0.45, 0.55, 0.4], { masa: 4, vuelve: 3 });
// La polea: la manija a 1.75 m (se salta para colgarse) al oeste y el gancho a 1.25 m al este; colgándose, el gancho
// sube 2.8 m, hasta arriba de la troja
pieza("polea", "polea", [7.0, Y2 + 2.3, -0.4], [1.6, 4.6, 0.5], {
  manija: 1.75,
  gancho: 1.25,
  recorrido: 0.4,
  subir: 2.8,
  bajada: 0.35,
  subida: 0.25,
});
// La troja: un tapanco a 2.6 m (no se trepa), sobre sus parales
bloque("troja", [8.4, Y2 + 2.45, -3.2], [13.0, Y2 + 2.6, 0.6], { material: "corteza" });
for (const [x, z] of [
  [8.5, 0.5],
  [12.9, 0.5],
])
  bloque(`troja-paral-${x}`, [x - 0.08, Y2, z - 0.08], [x + 0.08, Y2 + 2.45, z + 0.08], { material: "corteza" });
// La pared de atrás del beneficio, con la puerta que se abre con los dos sacos en la troja
bloque("beneficio-este-atras", [15.8, Y2, -3.2], [16.2, Y2 + 4.5, -0.7], { material: "tela" });
bloque("beneficio-este-frente", [15.8, Y2, 0.7], [16.2, Y2 + 4.5, 3.2], { invisible: 1 });
bloque("beneficio-este-dintel", [15.8, Y2 + 2.4, -0.7], [16.2, Y2 + 4.5, 0.7], { material: "tela" });
bloque("puerta-troja", [15.9, Y2, -0.7], [16.1, Y2 + 2.4, 0.7], { cuerpo: "cinematico", material: "corteza" });
bloque("beneficio-fondo", [0.2, Y2, -3.2], [15.8, Y2 + 4.5, -2.9], { material: "tela" });

// ── 5. El guineo y el portillo ──────────────────────────────────────────────────────────────────────────────────
// El guineo cuelga de su mata (la dibuja el guion), a la altura de las manos
pieza("guineo", "guineo", [20.0, Y2 + 1.25, -1.6], [0.24, 0.08, 0.08], { masa: 0.3, vuelve: 3 });
// La tapia de piedra (2.4 m) con un portillo de 1.2 m en el medio: ahí se sienta El Cipitío
bloque("tapia-atras", [26.8, Y2, -3.2], [27.2, Y2 + 2.4, -0.6], { material: "honda" });
// La de adelante (hacia la cámara) se ve baja, para que se vea el portillo; lo de arriba no se ve pero ataja igual
bloque("tapia-frente", [26.8, Y2, 0.6], [27.2, Y2 + 0.8, 3.2], { material: "honda" });
bloque("tapia-frente-alta", [26.8, Y2 + 0.8, 0.6], [27.2, Y2 + 2.4, 3.2], { invisible: 1 });

// ── La meta y la piedra del secreto ─────────────────────────────────────────────────────────────────────────────
// La piedra grande: dos gradas de 1.4 m (se trepan colgándose); arriba, el sombrero puntudo del Cipitío
bloque("piedra-grande-1", [32.0, Y2, -3.2], [36, Y2 + 1.4, -0.6], { material: "honda" });
bloque("piedra-grande-2", [34.0, Y2 + 1.4, -3.2], [36, Y2 + 2.8, -1.6], { material: "honda" });
vacio("secreto", [35.0, Y2 + 2.8 + 0.5, -2.4], [0.5, 0.5, 0.5], { tipo: "secreto" }, 0);

// ── Bordes: el talud del volcán al fondo (−z) y una pared invisible del lado de la cámara (+z) ──────────────────
bloque("talud-cafetal", [-46, -2, -4.6], [-27.8, 3.6, -3.2], { material: "tela" });
bloque("talud-patio", [-27.8, -2, -4.6], [-12.0, 5.2, -3.2], { material: "tela" });
bloque("talud-terraza", [-12.0, -2, -4.6], [36, 9, -3.2], { material: "tela" });
bloque("borde-cafetal", [-46, Y0, 3.2], [-27.8, Y0 + 2.5, 3.5], { invisible: 1 });
bloque("borde-patio", [-27.8, Y1, 3.2], [-12.0, Y1 + 2.5, 3.5], { invisible: 1 });
bloque("borde-terraza", [-12.0, Y2, 3.2], [36, Y2 + 3, 3.5], { invisible: 1 });
bloque("borde-oeste", [-46.3, -2, -3.2], [-46, 4, 3.2], { invisible: 1 });
bloque("borde-este", [36, Y2, -3.2], [36.3, Y2 + 5, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-44.5, Y0, 0.7], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-44.5, Y0, -0.7], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El 1 pasando el portón del patio (al llegar, el portón ya bajó)
vacio("control-1", [-16.4, Y1 + 1, 0], [2.6, 1, 1.0], { tipo: "control", orden: 1 });
// El 2 arriba del muro de la terraza
vacio("control-2", [-10.6, Y2 + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 2 });
// El 3 adentro del beneficio, pasando la puerta
vacio("control-3", [1.1, Y2 + 1, 0.6], [2.0, 1, 0.7], { tipo: "control", orden: 3 });
// El 4 afuera, pasando la puerta de atrás
vacio("control-4", [17.6, Y2 + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 4 });
// El 5, la meta, pasando el portillo
vacio("control-5", [29.6, Y2 + 1, 0.6], [1.6, 1, 0.9], { tipo: "control", orden: 5 });

// ── Adornos: el cafetal ─────────────────────────────────────────────────────────────────────────────────────────
// El volcán de Izalco, al fondo: un cono pelado que se asoma entre la niebla
imagen("volcan", new THREE.ConeGeometry(26, 30, 40, 1, true), [-6, 4, -34]);
// Los cafetos, en hileras a los lados del camino, y matas en las terrazas
const cafetos = [];
for (let x = -45; x < -33; x += 1.6) cafetos.push([x, Y0, -2.6], [x + 0.8, Y0, 2.7]);
for (let x = -26.5; x < -24; x += 1.6) cafetos.push([x, Y1, 2.7]);
for (let x = -17; x < -13; x += 1.7) cafetos.push([x, Y1, 2.7]);
for (let x = -11; x < -8.5; x += 1.6) cafetos.push([x, Y2, 2.7]);
for (let x = 18.5; x < 26; x += 1.7) cafetos.push([x, Y2, 2.7]);
for (let x = 28; x < 31.5; x += 1.6) cafetos.push([x, Y2, 2.7]);
for (const [i, [x, y, z]] of cafetos.entries()) {
  adorno(`cafeto-${i + 1}`, [x, y, z], { forma: "mata", alto: 1.1 + (i % 3) * 0.2, semilla: 80 + i });
}
// Los árboles de sombra (pinos, como en la falda del volcán), detrás del talud
for (let i = 0; i < 18; i++) {
  const x = -46 + i * 5;
  adorno(`pino-${i + 1}`, [x, -1, -7 - (i % 3) * 2.5], { forma: "pino", alto: 9 + (i % 4) * 1.5, semilla: 120 + i });
}
for (const [i, [x, y, z, r]] of [
  [-40.5, Y0, 2.6, 0.4],
  [-34.2, Y0, -2.7, 0.35],
  [-19.4, Y1, 2.6, 0.4],
  [-8.2, Y2, -2.6, 0.45],
  [24.4, Y2, -2.7, 0.4],
  [31.0, Y2, 2.6, 0.35],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 150 + i });
}

// Niebla: la del volcán, entre los cafetos y en el patio
vacio("niebla-1", [-38, 1.2, -5.5], [10, 2.5, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [-18, 3, -6], [14, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.1 }, 0);
vacio("niebla-3", [10, 5, -6.5], [18, 3.5, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-4", [-10, 8, -14], [40, 7, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.16 }, 0);
vacio("niebla-5", [0, 12, -24], [50, 10, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.2 }, 0);

await exportar("08-cafetal");
