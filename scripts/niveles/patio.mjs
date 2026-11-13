// pnpm niveles: arma niveles/00-patio/escena.glb, el nivel 0 (TU-13). Un patio de barrio de Tegucigalpa el 31 de
// diciembre por la mañana. Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender.
// La convención está en niveles/README.md; lo que se mueve lo arma el guion (niveles/00-patio/guion.ts) con los
// mecanismos de apps/juego/src/niveles/mecanismos/.
//
// El recorrido, de oeste a este (+x), con la pareja mirando hacia +x. Hacia −z queda la tapia del fondo; hacia +z,
// un muro bajo y la ladera (el vacío):
//   1. el patio: la salida en el montón de trapos, la pila, el tendedero → punto 1 frente al portón
//   2. el portón de tablas, trabado: la aldaba (una palanca) lo destraba mientras alguien la empuja → punto 2
//   3. el solar: la escalera acostada sobre dos barriles y el palo de mango (con la piñata, el secreto) → el muro
//      de la casa del vecino (2.2 m, más de lo que se trepa solo) → punto 3 en la repisa, con la escalera apoyada
//   4. el techo de lámina, que resbala → punto 4 en la losa
//   5. la calle (cuenta como caída), con el camión de la mudanza maniobrando → punto 5, la meta, sobre el camión
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, vacio, pieza, exportar } = crearEscena({
  nivel: 0,
  nombre: "El patio",
  vacio: -3,
  nieblaCerca: 3,
  nieblaLejos: 28,
});

/** Lo que es solo imagen (no choca) va con el color de las siluetas: el juego no le cambia el material. */
const silueta = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 1, metalness: 0 });
const honda = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1, metalness: 0 });
const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });

/** Una caja dentro de un grupo (coordenadas del grupo). */
function cajita(grupo, [x, y, z], [ancho, alto, fondo], material = gris) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), material);
  m.position.set(x, y, z);
  grupo.add(m);
  return m;
}
/** Un grupo en la escena con sus propiedades: un objeto de Blender con varias mallas. */
function grupo(nombre, [x, y, z], extras = {}) {
  const g = new THREE.Group();
  g.name = nombre;
  g.position.set(x, y, z);
  g.userData = extras;
  escena.add(g);
  return g;
}
/** Un sólido redondo, de pie: un barril, un tronco, un tinaco. */
function redondo(nombre, [x, y, z], radio, alto, extras = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, alto, 16), gris);
  m.name = nombre;
  m.position.set(x, y, z);
  m.userData = { tipo: "solido", forma: "cilindro", ...extras };
  escena.add(m);
  return m;
}
/** Un cilindro acostado o de pie dentro de un grupo; `eje` dice hacia dónde va su largo. */
function palo(g, [x, y, z], radio, largo, eje = "y", material = silueta) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, largo, 10), material);
  if (eje === "x") m.rotation.z = Math.PI / 2;
  if (eje === "z") m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

// ── El suelo y las tapias ──────────────────────────────────────────────────────────────────────────────────
// El patio y el solar, en y = 0, de x −7.5 a 13 y de z −3 a 3
solido("suelo", [2.75, -0.5, 0], [20.5, 1, 6]);
// La tapia del fondo (baja: se ve la ciudad detrás) y la del oeste
solido("tapia-fondo", [2.75, 0.7, -3.1], [20.5, 1.4, 0.2], { material: "tela" });
solido("tapia-oeste", [-7.6, 0.7, 0], [0.2, 1.4, 6.4], { material: "tela" });
// El muro bajo de adelante, sobre la ladera: la cámara mira por encima
solido("muro-bajo", [2.75, 0.25, 3.1], [20.5, 0.5, 0.2], { material: "tela" });

// ── 1. El patio ───────────────────────────────────────────────────────────────────────────────────────────
// El montón de trapos donde despiertan: una colchoneta baja y bultos de ropa vieja alrededor (solo imagen)
solido("monton", [-5.5, 0.12, 0], [1.9, 0.24, 2.4], { material: "tela" });
const bultos = grupo("bultos", [-5.5, 0, 0]);
for (const [x, y, z, r, s] of [
  [-0.9, 0.22, -1.1, 0.32, 1],
  [0.8, 0.2, -1.0, 0.28, 2],
  [-1.0, 0.2, 0.9, 0.3, 3],
  [0.9, 0.24, 1.05, 0.34, 4],
  [0.1, 0.26, -1.25, 0.26, 5],
  [-0.2, 0.2, 1.3, 0.24, 6],
]) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), s % 2 ? silueta : honda);
  m.scale.set(1.3, 0.6, 1);
  m.rotation.y = s;
  m.position.set(x, y, z);
  bultos.add(m);
}
// Trapos sueltos, livianos, para aprender a agarrar con cada brazo
solido("trapo-1", [-3.6, 0.13, 1.7], [0.34, 0.26, 0.3], { cuerpo: "dinamico", masa: 1.5, material: "tela" });
solido("trapo-2", [-3.9, 0.13, -1.4], [0.3, 0.26, 0.34], { cuerpo: "dinamico", masa: 1.5, material: "tela" });
solido("trapo-3", [-2.4, 0.11, 0.6], [0.28, 0.22, 0.28], { cuerpo: "dinamico", masa: 1, material: "tela" });
// La pila de lavar, contra la tapia del fondo
solido("pila", [-3, 0.45, -2.55], [1.4, 0.9, 0.7], { material: "tela" });
// El tendedero: dos postes y un alambre con ropa colgada (solo imagen, se pasa por debajo)
const tendedero = grupo("tendedero", [0, 0, -2.2]);
palo(tendedero, [-6.6, 1.1, 0], 0.04, 2.2);
palo(tendedero, [-0.6, 1.1, 0], 0.04, 2.2);
palo(tendedero, [-3.6, 2.05, 0], 0.008, 6, "x");
for (const [x, ancho, alto] of [
  [-5.8, 0.5, 0.6],
  [-5.1, 0.35, 0.45],
  [-4.2, 0.8, 0.5],
  [-2.5, 0.45, 0.7],
  [-1.6, 0.6, 0.4],
]) {
  const ropa = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), honda);
  ropa.position.set(x, 2.05 - alto / 2, 0);
  ropa.material.side = THREE.DoubleSide;
  tendedero.add(ropa);
}

// ── 2. El portón ──────────────────────────────────────────────────────────────────────────────────────────
// La tapia del portón (2.4 m: no se trepa) sale por los dos lados más allá de las otras, para que no se la rodee
solido("tapia-porton-a", [2, 1.2, -2.59], [0.2, 2.4, 1.62], { material: "tela" });
solido("tapia-porton-b", [2, 1.2, 1.76], [0.2, 2.4, 3.28], { material: "tela" });
// Los pilares del portón
solido("pilar-a", [2, 1.3, -1.83], [0.32, 2.6, 0.14], { material: "honda" });
solido("pilar-b", [2, 1.3, 0.19], [0.32, 2.6, 0.14], { material: "honda" });
// La hoja: tablas paradas con dos travesaños. La bisagra la pone el guion, del lado de z = −1.72
const hoja = grupo("porton", [2, 1.22, -0.82], { tipo: "solido", cuerpo: "dinamico", masa: 25, material: "corteza" });
for (let i = 0; i < 8; i++) cajita(hoja, [0, 0, -0.75 + i * 0.214], [0.05, 2.36, 0.19]);
for (const y of [-0.8, 0.8]) cajita(hoja, [-0.035, y, 0], [0.03, 0.14, 1.7]);
// La aldaba: una palanca al lado del portón, inclinada hacia quien llega; empujada hacia la tapia, destraba
pieza("aldaba", "palanca", [1.15, 0.6, 0.85], [0.6, 1.2, 0.3], { angulo: 30 }, -Math.PI / 2);

// ── 3. El solar ───────────────────────────────────────────────────────────────────────────────────────────
// La escalera, acostada sobre dos barriles: 4.2 m, para que apoyada en el muro quede como rampa
redondo("barril-1", [4, 0.45, -1], 0.25, 0.9, { material: "honda" });
redondo("barril-2", [7, 0.45, -1], 0.25, 0.9, { material: "honda" });
const escalera = grupo("escalera", [5.5, 0.93, -1], {
  tipo: "solido",
  cuerpo: "dinamico",
  masa: 9,
  material: "corteza",
  rozamiento: 0.8,
});
for (const z of [-0.22, 0.22]) cajita(escalera, [0, 0, z], [4.2, 0.06, 0.06]);
for (let i = 0; i < 12; i++) cajita(escalera, [-1.93 + i * 0.35, 0.005, 0], [0.05, 0.045, 0.44]);
// El palo de mango en el rincón, con la piñata olvidada colgando de una rama (el secreto)
redondo("mango", [8.4, 1.1, -2.35], 0.2, 2.2, { material: "corteza" });
const ramas = grupo("ramas-mango", [8.4, 0, -2.35]);
const rama = palo(ramas, [-0.45, 2.15, 0.1], 0.07, 1.3, "x");
rama.rotation.y = 0.3;
palo(ramas, [0.35, 2.3, 0.05], 0.06, 1, "x").rotation.z = Math.PI / 2 - 0.5;
vacio("copa-1", [8.4, 1.55, -2.4], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 3.2, semilla: 31 }, 0);
vacio("copa-2", [7.6, 1.7, -2.6], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 2.4, semilla: 32 }, 0);
vacio("copa-3", [9.2, 1.8, -2.5], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 2.2, semilla: 33 }, 0);
// La piñata: una estrella de siete picos, gastada, colgando de un mecate
const pinata = grupo("pinata", [7.95, 1.55, -2.3]);
palo(pinata, [0, 0.45, 0], 0.006, 0.6);
const panza = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), honda);
pinata.add(panza);
for (let i = 0; i < 7; i++) {
  const pico = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 6), silueta);
  const a = (i / 7) * Math.PI * 2;
  const dir = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.7, Math.sin(a) * 0.6).normalize();
  pico.position.copy(dir.clone().multiplyScalar(0.27));
  pico.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  pinata.add(pico);
}
for (let i = 0; i < 4; i++) {
  const tira = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.35), honda);
  tira.material.side = THREE.DoubleSide;
  tira.position.set(-0.06 + i * 0.04, -0.33, 0);
  pinata.add(tira);
}
// El secreto: debajo de la piñata, en el rincón entre el mango y la tapia
vacio("secreto", [7.95, 0.6, -2.55], [0.5, 0.6, 0.4], { tipo: "secreto" }, 0);

// ── 4. La casa del vecino: el muro, la repisa, el techo de lámina y la losa ────────────────────────────────────
// El cuerpo de la casa, del solar (y = 0) hasta la repisa (y = 2.2), de x 13 a 21; sale por los lados como la tapia
solido("casa", [17, 0.6, 0], [8, 3.2, 6.8], { material: "tela" });
/** El techo: de la repisa (x 14.2, y 2.2) sube a la losa (x 18.2, y 3.4). */
const TECHO = { desde: [14.2, 2.2], hasta: [18.2, 3.4], ancho: 6.8, grueso: 0.06 };
const [dx, dy] = [TECHO.hasta[0] - TECHO.desde[0], TECHO.hasta[1] - TECHO.desde[1]];
const pendiente = Math.atan2(dy, dx);
const largoTecho = Math.hypot(dx, dy);
const lamina = grupo(
  "lamina",
  [
    (TECHO.desde[0] + TECHO.hasta[0]) / 2 + (Math.sin(pendiente) * TECHO.grueso) / 2,
    (TECHO.desde[1] + TECHO.hasta[1]) / 2 - (Math.cos(pendiente) * TECHO.grueso) / 2,
    0,
  ],
  { tipo: "solido", material: "lejana", rozamiento: 0.2 },
);
lamina.rotation.z = pendiente;
cajita(lamina, [0, 0, 0], [largoTecho, TECHO.grueso, TECHO.ancho]);
// La lámina acanalada: una costilla cada 25 cm, a lo largo de la pendiente (solo imagen)
for (let z = -TECHO.ancho / 2 + 0.1; z < TECHO.ancho / 2; z += 0.25) {
  cajita(lamina, [0, TECHO.grueso / 2 + 0.012, z], [largoTecho, 0.024, 0.05]);
}
// El hastial: el triángulo de pared bajo el techo, en los dos costados
const hastial = new THREE.BufferGeometry();
const [x0, y0] = TECHO.desde;
const [x1, y1] = TECHO.hasta;
const zz = TECHO.ancho / 2;
hastial.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [x0, y0, -zz, x1, y0, -zz, x1, y1, -zz, x0, y0, zz, x1, y0, zz, x1, y1, zz].map((v, i) =>
      i % 3 === 0 ? v - 17 : i % 3 === 1 ? v - y0 : v,
    ),
    3,
  ),
);
hastial.setIndex([0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 0, 3, 5, 0, 5, 2]);
hastial.computeVertexNormals();
const bajoTecho = new THREE.Mesh(hastial, gris);
bajoTecho.name = "bajo-techo";
bajoTecho.position.set(17, y0, 0);
bajoTecho.userData = { tipo: "solido", forma: "malla", material: "tela" };
escena.add(bajoTecho);
// La losa del frente, plana, a la altura de arriba del techo; con un tinaco y una antena
solido("losa", [19.6, 2.8, 0], [2.8, 1.2, 6.8], { material: "tela" });
redondo("tinaco", [19.9, 3.95, -2.7], 0.5, 1.1, { material: "honda" });
const antena = grupo("antena", [18.7, 3.4, 2.9]);
palo(antena, [0, 1.2, 0], 0.025, 2.4);
palo(antena, [0, 2.2, 0], 0.012, 1, "z");
palo(antena, [0, 1.9, 0], 0.012, 0.8, "z");

// ── 5. La calle y el camión de la mudanza ─────────────────────────────────────────────────────────────────
// La calle, más arriba que el solar (el barrio está en la ladera). Caer en ella cuenta como caída
solido("calle", [24.2, 1.1, 0], [6.4, 1, 20]);
vacio("la-calle", [24.2, 1.9, 0], [3.2, 0.6, 10], { tipo: "vacio" }, 0);
// Las casas de enfrente, bajas para que la cámara mire por encima
solido("enfrente-1", [28.4, 2.6, -5], [2, 2, 5], { material: "honda" });
solido("enfrente-2", [28.4, 2.3, 1.2], [2, 1.4, 6], { material: "honda" });
solido("enfrente-3", [28.4, 2.9, 7], [2, 2.6, 4.5], { material: "honda" });
// El camión: lo mueve el guion, de atrás para adelante a lo largo de la calle. La palangana queda a 2.7 m (70 cm
// bajo la losa), sin baranda del lado de la casa; la cabina va hacia +z
const camion = grupo("camion", [22.3, 1.6, 0], {
  tipo: "solido",
  cuerpo: "cinematico",
  forma: "malla",
  material: "honda",
});
cajita(camion, [0, 0.98, 0], [2, 0.24, 3.8]);
cajita(camion, [0.96, 1.35, 0], [0.08, 0.5, 3.8]);
cajita(camion, [0, 1.2, -1.88], [2, 0.2, 0.06]);
cajita(camion, [0, 1.45, 2.75], [2, 1.7, 1.5]);
cajita(camion, [0, 0.95, 3.75], [1.9, 0.9, 0.6]);
cajita(camion, [0, 0.62, 0.8], [1.6, 0.3, 5]);
for (const z of [-1.2, 2.7]) {
  for (const x of [-0.9, 0.9]) {
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 14), gris);
    rueda.rotation.z = Math.PI / 2;
    rueda.position.set(x, 0.42, z);
    camion.add(rueda);
  }
}
// La mudanza en la palangana: un ropero contra la cabina y unas cajas
cajita(camion, [0.4, 1.9, 1.55], [0.8, 1.6, 0.55]);
cajita(camion, [-0.45, 1.35, 1.6], [0.6, 0.5, 0.5]);

// ── Salidas y puntos de control (zonas de 1 × 2 × 6 m, rotadas para mirar hacia +x) ─────────────────────────
// La salida, en el montón de trapos (el rojo a la derecha, hacia +z)
vacio("salida-rojo", [-5.5, 0.24, 0.45], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-5.5, 0.24, -0.45], [1, 1, 1], { tipo: "salida", jugador: 2 });
// 1: frente al portón; el rojo queda frente a la aldaba y el turquesa frente a la hoja
vacio("control-1", [-0.2, 1, 0.3], [3, 1, 0.5], { tipo: "control", orden: 1 });
// 2: en el solar, al lado de la escalera, uno de cada lado
vacio("control-2", [4.8, 1, -1], [3, 1, 0.5], { tipo: "control", orden: 2 });
// 3: arriba del muro, en la repisa
vacio("control-3", [13.6, 3.2, 0], [3, 1, 0.4], { tipo: "control", orden: 3 });
// 4: en la losa, arriba del techo
vacio("control-4", [19.3, 4.4, 0], [3, 1, 0.5], { tipo: "control", orden: 4 });
// 5, la meta: sobre la palangana del camión. El guion la lleva con el camión
vacio("control-5", [22.25, 3.3, -0.35], [1.5, 0.6, 0.9], { tipo: "control", orden: 5 });

// ── Lo de lejos: la ciudad en los cerros, pinos y niebla ───────────────────────────────────────────────────
for (let i = 0; i < 16; i++) {
  const x = -10 + i * 2.7;
  const alto = 2 + ((i * 7) % 5) * 0.7;
  const z = -11 - (i % 3) * 2.5;
  solido(`ciudad-${i + 1}`, [x, -3 + alto / 2 + (i % 4) * 0.6, z], [2.2, alto, 1.8], { material: "lejana" });
}
for (let i = 0; i < 9; i++) {
  const x = -6 + i * 4.1;
  const z = -19 - (i % 2) * 4;
  vacio(
    `pino-${i + 1}`,
    [x, -4, z],
    [1, 1, 1],
    { tipo: "adorno", forma: "pino", alto: 18, radio: 0.32, semilla: 90 + i },
    0,
  );
}
vacio("mata-1", [-6.8, 0, 2.5], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.9, semilla: 41 }, 0);
vacio("mata-2", [11.8, 0, 2.6], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 1.1, semilla: 42 }, 0);
vacio("mata-3", [0.8, 0, -2.6], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.8, semilla: 43 }, 0);
vacio("niebla-1", [4, 0.5, -6], [14, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [10, 2, -10], [18, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.15 }, 0);
vacio("niebla-3", [12, 3, -16], [24, 8, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.2 }, 0);
vacio("niebla-ladera", [6, -1.5, 5], [14, 2, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.1 }, 0);

await exportar("00-patio");
