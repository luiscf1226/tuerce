// pnpm niveles: arma niveles/05-tren/escena.glb, el nivel 5 (TU-27): El Progreso, Honduras. Una estación vieja de la
// bananera, vagones, una dresina por rieles entre bananales, una grúa y el Duende, que cambia las palancas cuando nadie
// lo ve. Como los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está
// en niveles/README.md; los rieles, los puentes de caballetes y las matas de guineo los dibuja el guion.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. Cada misión termina en un punto de control:
//   1. la estación: el tren (la locomotora y un furgón) tapa el paso a nivel del cerco del andén. Empujando la
//      plataforma por la vía hasta el furgón se enganchan, y el tren sale → punto 1 del otro lado del cerco
//   2. la dresina, de a dos: sube por un puente de caballetes sobre la quebrada. Cada uno levanta su punta de la
//      bomba, por turnos; solo, la cuesta le gana → punto 2 en la loma
//   3. el cambio de vía, de a dos: uno deja la palanca del cambio hacia el desvío y se queda a cuidarla (si nadie la
//      ve, el Duende la vuelve); el otro baja con la dresina y llega al bananal → punto 3. Derecho, la vía se acaba en
//      un puente roto (con el secreto)
//   4. la grúa, de a dos: uno empuja la palanca de la caseta y el gancho baja; el otro le acerca el racimo grande
//      (9 kg) agarrado y se engancha. Al soltar la palanca la grúa lo sube y lo suelta en la tolva, y se abre el portón
//      de la empacadora → punto 4
//   5. la romana: tres racimos de 4 kg colgados de sus ganchos la hunden y bajan el puente levadizo del canal → punto 5
//   6. el Duende, en su casa al fondo, vuelve las palancas del portón final si nadie las ve: hay que devolverle el
//      sombrero (colgado en un perchero) para que las deje en paz → punto 6, la meta en la estación de llegada
// El secreto: el racimo de mínimos dorados, en el rellano del puente roto. El logro, «Puntual»: llegar a la meta antes
// de que pite el tren (que sale de la estación al enganchar los vagones y llega a la de llegada seis minutos después).
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 5,
  nombre: "El tren bananero",
  vacio: -4,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** Las alturas del suelo: el llano y la loma de arriba de la quebrada. */
const Y0 = 0;
const Y1 = 0.8;
const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });

/** Un terreno: el suelo claro arriba (40 cm) y la peña oscura debajo, hasta −3. */
function suelo(nombre, x0, x1, z0, z1, arriba) {
  solido(nombre, [(x0 + x1) / 2, arriba - 0.2, (z0 + z1) / 2], [x1 - x0, 0.4, z1 - z0]);
  solido(
    `${nombre}-pena`,
    [(x0 + x1) / 2, (arriba - 0.4 - 3) / 2, (z0 + z1) / 2],
    [x1 - x0, arriba - 0.4 + 3, z1 - z0],
    {
      material: "tela",
    },
  );
}
/** El fondo de una zanja de la vía (60 cm más abajo que el suelo), para que la dresina quede a ras. */
function zanja(nombre, x0, x1, z0, z1, arriba) {
  solido(nombre, [(x0 + x1) / 2, arriba - 0.6 - 0.15, (z0 + z1) / 2], [x1 - x0, 0.3, z1 - z0], { material: "honda" });
}
/** Un cerco de estacas a lo largo de x (en `z`): choca como una caja y se ve como estacas. Es delgado (10 cm): arriba
 * no hay dónde pararse, así que no se trepa, y no se salta (1.3 m). Bajo, no le tapa la pareja a la cámara. */
function cercoX(nombre, x0, x1, z, alto = 1.3, y = Y0) {
  solido(nombre, [(x0 + x1) / 2, y + alto / 2, z], [x1 - x0, alto, 0.1], { invisible: 1 });
  const n = Math.max(1, Math.round((x1 - x0) / 0.32));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((i + 0.5) * (x1 - x0)) / n;
    const a = alto - 0.15 * ((i * 5) % 3);
    solido(`${nombre}-estaca-${i + 1}`, [x, y + a / 2, z], [0.2 + 0.04 * ((i * 7) % 3), a, 0.1], {
      material: "corteza",
    });
  }
}
/** Lo mismo a lo largo de z (en `x`). */
function cercoZ(nombre, z0, z1, x, alto = 1.3, y = Y0) {
  solido(nombre, [x, y + alto / 2, (z0 + z1) / 2], [0.1, alto, z1 - z0], { invisible: 1 });
  const n = Math.max(1, Math.round((z1 - z0) / 0.32));
  for (let i = 0; i < n; i++) {
    const z = z0 + ((i + 0.5) * (z1 - z0)) / n;
    const a = alto - 0.15 * ((i * 5) % 3);
    solido(`${nombre}-estaca-${i + 1}`, [x, y + a / 2, z], [0.1, a, 0.2 + 0.04 * ((i * 7) % 3)], {
      material: "corteza",
    });
  }
}
/** Un grupo en la escena con sus propiedades: un objeto de Blender con varias mallas. */
function grupo(nombre, [x, y, z], extras = {}, rumbo = 0) {
  const g = new THREE.Group();
  g.name = nombre;
  g.position.set(x, y, z);
  g.rotation.y = rumbo;
  g.userData = extras;
  escena.add(g);
  return g;
}
function cajita(g, [x, y, z], [ancho, alto, fondo]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), gris);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function cilindro(g, [x, y, z], radio, largo, eje = "y", radioAbajo = radio) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radioAbajo, largo, 16), gris);
  if (eje === "x") m.rotation.z = Math.PI / 2;
  if (eje === "z") m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
/** Una palanca de la vía, mirando hacia −x (se la empuja hacia el este): en reposo inclinada hacia quien llega. */
function palanca(nombre, [x, y, z], extras = {}) {
  pieza(nombre, "palanca", [x, y + 0.6, z], [0.6, 1.2, 0.3], { angulo: 30, ...extras }, -Math.PI / 2);
}

// ── 1. La estación ───────────────────────────────────────────────────────────────────────────────────────────
// El patio al sur de la vía (donde arrancan), la vía del tren en z = 0 y, del otro lado del cerco del andén, el
// patio norte con la estación y la dresina en su zanja
suelo("patio-sur", -30, -11.5, -1.0, 5, Y0);
suelo("patio-norte-1", -30, -11.5, -9, -4.8, Y0);
suelo("patio-norte-2", -30, -11.5, -3.2, -1.0, Y0);
suelo("patio-norte-3", -30, -14.9, -4.8, -3.2, Y0);
zanja("zanja-estacion", -14.9, -11.5, -4.8, -3.2, Y0);
// El cerco del andén, con el paso a nivel (x −19.4 a −17) que tapa el furgón, y el del fondo, al oeste
cercoX("cerco-anden-1", -30, -19.4, -1.0);
cercoX("cerco-anden-2", -17.0, -11.5, -1.0);
cercoZ("cerco-oeste", -9, 5, -30.1);
// El tren: la locomotora (cinemática: la mueve el guion), el furgón enganchado a ella (no rueda) y la plataforma
// suelta, más atrás en la misma vía, que se empuja hasta engancharla
{
  const loco = grupo("locomotora", [-14.5, Y0, 0], { tipo: "solido", cuerpo: "cinematico", material: "honda" });
  cajita(loco, [0, 0.55, 0], [4.2, 0.3, 1.5]);
  cilindro(loco, [0.4, 1.35, 0], 0.62, 2.9, "x");
  cajita(loco, [-1.45, 1.5, 0], [1.3, 1.9, 1.6]);
  cajita(loco, [-1.45, 2.5, 0], [1.6, 0.12, 1.8]);
  cilindro(loco, [1.4, 2.25, 0], 0.14, 0.9, "y", 0.2);
  cilindro(loco, [0.5, 2.05, 0], 0.18, 0.35);
  for (const x of [-1.3, -0.1, 1.1]) for (const z of [-0.62, 0.62]) cilindro(loco, [x, 0.42, z], 0.4, 0.1, "z");
  cajita(loco, [2.05, 0.35, 0], [0.12, 0.5, 1.4]);
}
pieza("vagon-1", "vagon", [-24.8, Y0 + 0.55, 0], [2.4, 1.1, 1.6], { adelante: 3.95, masa: 30 });
pieza("vagon-2", "vagon", [-18.2, Y0 + 1.2, 0], [2.8, 2.4, 1.6], { masa: 60 });
// El vapor del pito: una nube que el guion saca por la chimenea cuando el tren llega (y que no choca con nadie: va
// metida en la caldera hasta entonces)
{
  const vapor = grupo("vapor", [-13.1, Y0 + 1.3, 0], { tipo: "solido", cuerpo: "cinematico", material: "lejana" });
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.3],
    [0.25, 0.2, 0.1, 0.24],
    [-0.2, 0.25, -0.1, 0.22],
    [0.05, 0.45, 0.05, 0.2],
  ]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), gris);
    m.position.set(x, y, z);
    vapor.add(m);
  }
}
// La estación vieja, con su reloj: la aguja la mueve el guion (da una vuelta mientras el tren va de viaje)
solido("estacion", [-23.75, Y0 + 1.8, -7.9], [6.5, 3.6, 2.2], { material: "tela" });
solido("estacion-techo", [-23.75, Y0 + 3.75, -7.6], [7.4, 0.3, 3.2], { material: "honda" });
solido("estacion-alero", [-23.75, Y0 + 2.6, -6.4], [6.8, 0.1, 0.9], { material: "honda" });
for (const x of [-26.8, -20.7])
  solido(`estacion-poste-${x}`, [x, Y0 + 1.3, -6.05], [0.12, 2.6, 0.12], { material: "corteza" });
{
  const esfera = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), gris);
  esfera.name = "reloj";
  esfera.rotation.x = Math.PI / 2;
  esfera.position.set(-23.75, Y0 + 3.05, -6.77);
  esfera.userData = { tipo: "solido", material: "lejana" };
  escena.add(esfera);
  const aguja = grupo("reloj-aguja", [-23.75, Y0 + 3.05, -6.7], {
    tipo: "solido",
    cuerpo: "cinematico",
    material: "honda",
  });
  cajita(aguja, [0, 0.17, 0], [0.05, 0.38, 0.03]);
}
// La dresina en su zanja, a ras del suelo, mirando hacia el este
pieza("dresina", "dresina", [-13.4, Y0 - 0.125, -4.0], [2.8, 0.25, 1.5]);

// ── 2. La quebrada y la loma ──────────────────────────────────────────────────────────────────────────────────
// La vía sube 80 cm por un puente de caballetes (lo dibuja el guion) hasta la loma, donde vuelve a ir en zanja; la
// loma se corta donde la vía baja hacia el bananal
suelo("loma-norte", 2.0, 12, -9, -4.8, Y1);
suelo("loma-sur", 2.0, 12, -3.2, -0.5, Y1);
zanja("zanja-loma", 2.0, 7.0, -4.8, -3.2, Y1);
// El cambio de vía: su palanca al este de la loma (el Duende la vuelve si nadie la ve) y la señal que dice hacia
// dónde está (un disco que gira)
palanca("cambio", [11.0, Y1, -1.8], { vuelve: 0 });
{
  const senal = grupo("senal-cambio", [11.0, Y1, -0.95], { tipo: "solido", cuerpo: "cinematico", material: "honda" });
  cilindro(senal, [0, 0.7, 0], 0.04, 1.4);
  const disco = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), gris);
  disco.rotation.z = Math.PI / 2;
  disco.position.set(0, 1.55, 0);
  senal.add(disco);
}

// ── 3. El puente roto y el bananal ────────────────────────────────────────────────────────────────────────────
// Derecho, la vía se acaba en el puente roto: un rellano chiquito con el secreto, sin salida
suelo("rellano", 23.6, 25.2, -4.9, -3.0, Y0);
vacio("secreto", [24.4, Y0 + 0.8, -3.95], [0.95, 0.8, 0.8], { tipo: "secreto" }, 0);
// El bananal: el desvío entra en su zanja hasta el tope
suelo("bananal-1", 19, 40, -16, -7.75, Y0);
suelo("bananal-2", 25.4, 40, -7.75, -6.4, Y0);
zanja("zanja-bananal", 19, 25.4, -7.75, -6.25, Y0);

// ── 4. La grúa ────────────────────────────────────────────────────────────────────────────────────────────────
// El mástil mirando hacia el racimo (+x); el brazo gira 90° a la izquierda, hasta la tolva. La palanca de la caseta
// queda lejos del racimo: el que la empuja no alcanza a engancharlo
pieza(
  "grua",
  "grua",
  [31, Y0 + 2.1, -11],
  [0.6, 4.2, 0.6],
  { brazo: 3.2, giro: 90, bajo: 1.75, alto: 3.9 },
  Math.PI / 2,
);
palanca("palanca-grua", [28.4, Y0, -10.7]);
solido("caseta-techo", [28.0, Y0 + 2.3, -10.7], [1.6, 0.1, 1.4], { material: "honda" });
for (const [i, [x, z]] of [
  [27.3, -11.35],
  [27.3, -10.05],
].entries())
  solido(`caseta-poste-${i + 1}`, [x, Y0 + 1.15, z], [0.1, 2.3, 0.1], { material: "corteza" });
// El racimo grande (9 kg: ni entre los dos se sube a la tolva) cuelga de su horca
pieza("racimo-grande", "racimo", [34.2, Y0 + 1.25, -11], [0.5, 0.7, 0.5], { masa: 9 });
solido("horca", [34.2, Y0 + 1.15, -11.8], [0.14, 2.3, 0.14], { material: "corteza" });
solido("horca-brazo", [34.2, Y0 + 2.25, -11.45], [0.1, 0.1, 0.8], { material: "corteza" });
// La tolva: un cajón alto sobre patas (no se trepa), con el fondo a 1.5 m
{
  const [x, z] = [31, -14.2];
  solido("tolva-fondo", [x, Y0 + 1.45, z], [1.4, 0.1, 1.4], { material: "corteza" });
  for (const [i, [dx, dz, ancho, fondo]] of [
    [0, -0.65, 1.4, 0.1],
    [0, 0.65, 1.4, 0.1],
    [-0.65, 0, 0.1, 1.4],
    [0.65, 0, 0.1, 1.4],
  ].entries())
    solido(`tolva-lado-${i + 1}`, [x + dx, Y0 + 2.0, z + dz], [ancho, 1.0, fondo], { material: "corteza" });
  for (const [i, [dx, dz]] of [
    [-0.6, -0.6],
    [0.6, -0.6],
    [-0.6, 0.6],
    [0.6, 0.6],
  ].entries())
    solido(`tolva-pata-${i + 1}`, [x + dx, Y0 + 0.7, z + dz], [0.12, 1.4, 0.12], { material: "corteza" });
}
// El muro de la empacadora, con su portón (cinemático: baja mientras el racimo grande está en la tolva)
solido("muro-empacadora-1", [40, Y0 + 1.5, -13.05], [0.3, 3, 5.9], { material: "tela" });
solido("muro-empacadora-2", [40, Y0 + 1.5, -7.45], [0.3, 3, 2.1], { material: "tela" });
solido("porton-empacadora", [40, Y0 + 1.2, -9.25], [0.15, 2.4, 1.5], { cuerpo: "cinematico", material: "corteza" });
solido("muro-empacadora-dintel", [40, Y0 + 2.7, -9.25], [0.3, 0.6, 1.5], { material: "tela" });

// ── 5. La romana y el puente levadizo ────────────────────────────────────────────────────────────────────────
suelo("patio-empacadora", 40, 48, -16, -4, Y0);
// Tres racimos de 4 kg en su colgadero (uno solo los carga)
solido("colgadero", [43.3, Y0 + 2.1, -14.6], [2.8, 0.12, 0.12], { material: "corteza" });
for (const x of [41.85, 44.75])
  solido(`colgadero-poste-${x}`, [x, Y0 + 1.05, -14.6], [0.12, 2.1, 0.12], { material: "corteza" });
for (const [i, x] of [42.5, 43.3, 44.1].entries())
  pieza(`racimo-${i + 1}`, "racimo", [x, Y0 + 1.25, -14.6], [0.4, 0.6, 0.4], { masa: 4 });
// La romana: un plato con resorte (una plancha) arriba de un poste, a 2 m (no se alcanza ni saltando), con tres
// ganchos que cuelgan debajo: el racimo que se suelta junto a un gancho queda colgado, y pesa
pieza("bascula", "plancha", [45.5, Y0 + 2.06, -8.0], [1.3, 0.12, 0.5], { peso: 18, hundir: 0.08 });
solido("bascula-poste", [45.5, Y0 + 1.1, -8.42], [0.14, 2.2, 0.14], { material: "honda" });
solido("bascula-brazo", [45.5, Y0 + 1.97, -8.3], [0.14, 0.1, 0.3], { material: "honda" });
solido("bascula-reloj", [45.5, Y0 + 2.45, -8.42], [0.5, 0.5, 0.08], { material: "lejana" });
// El puente levadizo sobre el canal: su bisagra en la otra orilla. El guion lo baja según el peso de la romana
solido("puente", [49.75, Y0 - 0.1, -8.0], [3.5, 0.2, 1.6], { cuerpo: "cinematico", material: "corteza" });
for (const z of [-8.95, -7.05])
  solido(`puente-poste-${z}`, [51.65, Y0 + 1.6, z], [0.2, 3.2, 0.2], { material: "corteza" });
solido("puente-travesano", [51.65, Y0 + 3.3, -8.0], [0.2, 0.2, 2.1], { material: "corteza" });

// ── 6. La estación de llegada y el Duende ────────────────────────────────────────────────────────────────────
suelo("patio-llegada", 51.5, 63, -16, -2, Y0);
// El cerco del fondo, con el portón final en el medio, y sus dos palancas (el Duende las vuelve si nadie las ve)
cercoZ("cerco-final-1", -16, -8.75, 59);
cercoZ("cerco-final-2", -7.25, -2, 59);
solido("porton-final", [59, Y0 + 0.7, -8], [0.15, 1.4, 1.5], { cuerpo: "cinematico", material: "corteza" });
palanca("palanca-a", [54.6, Y0, -2.8], { vuelve: 0 });
palanca("palanca-b", [54.6, Y0, -13.2], { vuelve: 0 });
// El Duende, en su casa, mirando hacia el patio; su sombrero, en el perchero de la garita
pieza("duende", "duende", [52.4, Y0 + 0.5, -14.3], [1, 1, 1]);
solido("casa-duende", [52.4, Y0 + 0.35, -15.5], [1.3, 0.7, 0.8], { material: "honda" });
pieza("sombrero", "sombrero", [53.9, Y0 + 1.3, -3.4], [0.36, 0.26, 0.36]);
solido("perchero", [53.9, Y0 + 0.585, -3.4], [0.08, 1.17, 0.08], { material: "corteza" });
solido("garita", [52.6, Y0 + 1.3, -4.4], [1.6, 2.6, 1.4], { material: "tela" });
solido("garita-techo", [52.6, Y0 + 2.7, -4.3], [2.0, 0.15, 1.8], { material: "honda" });
// La estación de llegada, detrás de la meta
solido("estacion-llegada", [61.3, Y0 + 1.6, -14.2], [3.4, 3.2, 3.2], { material: "tela" });
solido("estacion-llegada-techo", [61.3, Y0 + 3.35, -13.9], [4.0, 0.3, 4.0], { material: "honda" });

// ── Salidas y puntos de control (zonas mirando hacia +x: su escala x es el medio ancho, en z) ──────────────────
vacio("salida-rojo", [-27.8, Y0, 2.2], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-27.8, Y0, 3.1], [1, 1, 1], { tipo: "salida", jugador: 2 });
// 1: del otro lado del cerco del andén, frente a la estación
vacio("control-1", [-18.2, Y0 + 1, -2.4], [1.2, 1, 0.6], { tipo: "control", orden: 1 });
// 2: en la loma; la zona llega hasta la zanja, así la alcanza el que viene parado en la dresina
vacio("control-2", [7.2, Y1 + 1, -2.4], [1.9, 1, 0.5], { tipo: "control", orden: 2 });
// 3: en el bananal, donde se acaba el desvío
vacio("control-3", [23.95, Y0 + 1, -8.5], [1.75, 1, 1.45], { tipo: "control", orden: 3 });
// 4: pasando el portón de la empacadora
vacio("control-4", [41.5, Y0 + 1, -9.25], [1.2, 1, 0.5], { tipo: "control", orden: 4 });
// 5: del otro lado del canal
vacio("control-5", [53, Y0 + 1, -8], [1.2, 1, 0.5], { tipo: "control", orden: 5 });
// 6, la meta: pasando el portón final, en el andén de llegada
vacio("control-6", [61, Y0 + 1, -8], [1.5, 1, 0.8], { tipo: "control", orden: 6 });

// ── Adornos ───────────────────────────────────────────────────────────────────────────────────────────────────
// Las matas de guineo las arma el guion donde haya un nodo `banano-*` (sin tipo); `alto` en su escala y
const bananos = [
  [-29, -8.2, 3.2],
  [-12.6, -8.3, 3.6],
  [-28.6, 4.2, 2.6],
  [-13, 4.3, 3.0],
  [3.5, -8.4, 3.4],
  [10.6, -8.1, 3.0],
  [20.2, -15, 3.6],
  [22.4, -12.6, 3.2],
  [24.8, -15.3, 3.8],
  [26.6, -12.8, 3.4],
  [36.2, -15.2, 3.6],
  [38.4, -12.9, 3.2],
  [36.8, -8.0, 3.0],
  [38.8, -7.2, 3.6],
  [20.5, -10.4, 2.9],
  [42, -5, 3.0],
  [47, -15.4, 3.4],
  [52.2, -15.3, 3.2],
  [62.5, -3, 3.4],
];
for (const [i, [x, z, alto]] of bananos.entries()) {
  const o = new THREE.Object3D();
  o.name = `banano-${i + 1}`;
  o.position.set(x, x > 1.5 && x < 12.5 ? Y1 : Y0, z);
  o.scale.set(1, alto, 1);
  escena.add(o);
}
// El bananal de lejos: matas sobre el vacío, detrás de todo
for (let i = 0; i < 30; i++) {
  const o = new THREE.Object3D();
  o.name = `banano-lejos-${i + 1}`;
  o.position.set(-30 + i * 3.1, -2.5, -19 - (i % 3) * 2.6);
  o.scale.set(1, 4.5 + (i % 4) * 0.6, 1);
  escena.add(o);
}
const rocas = [
  [-21.5, Y0, 4.2, 0.4],
  [-15.6, Y0, -8.5, 0.45],
  [5.6, Y1, -8.6, 0.4],
  [29.5, Y0, -15.4, 0.5],
  [46.8, Y0, -4.6, 0.4],
];
for (const [i, [x, y, z, radio]] of rocas.entries()) {
  vacio(`roca-${i + 1}`, [x, y - 0.05, z], [1, 1, 1], { tipo: "adorno", forma: "roca", radio, semilla: 50 + i }, 0);
}
const matas = [
  [-25.8, Y0, 4.4, 0.8],
  [-16.2, Y0, 4.3, 1],
  [8.4, Y1, -0.9, 0.7],
  [33.5, Y0, -15.4, 0.9],
  [43.6, Y0, -4.6, 0.8],
  [55.4, Y0, -2.6, 0.9],
];
for (const [i, [x, y, z, alto]] of matas.entries()) {
  vacio(`mata-${i + 1}`, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "mata", alto, semilla: 60 + i }, 0);
}
// Niebla: el vapor de la quebrada, del canal y capas detrás de los bananales
vacio("niebla-quebrada", [-4.5, -1.2, -1], [7, 1.5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.1 }, 0);
vacio("niebla-bajada", [16, -1.2, -1], [6, 1.5, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.08 }, 0);
vacio("niebla-canal", [49.8, -1.4, -6], [2.5, 1.5, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.06 }, 0);
vacio("niebla-1", [-18, 1, -12], [14, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [12, 2, -18], [20, 4, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.12 }, 0);
vacio("niebla-3", [45, 2, -20], [20, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.16 }, 0);
vacio("niebla-4", [16, 4, -25], [40, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.2 }, 0);

await exportar("05-tren");
