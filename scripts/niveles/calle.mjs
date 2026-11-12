// pnpm niveles: arma niveles/03-calle/escena.glb, el nivel 3 (TU-25): Comayagua, Honduras. Calles coloniales en
// subida, balcones, alfombras de aserrín, la torre del reloj y el campanario; la ronda la Carreta sin bueyes. Como
// los otros, sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en
// niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. Hacia −z quedan las casas altas; hacia +z
// (donde está la cámara), tapias bajas y delgadas (no se trepan: arriba no hay donde pararse). Cada misión termina
// en un punto de control:
//   1. el callejón de la cuesta (12°), justo del ancho de la carreta: la empujan los dos hasta arriba, donde se
//      traba, y pasan por al lado → punto 1 en la plazuela (con el parquecito y el carrito del secreto)
//   2. la calle de la Carreta sin bueyes: rueda sola de la plazuela al fondo y de vuelta, sin frenar, y al que
//      encuentra lo saca de la calle. El freno (una palanca) la para mientras alguien lo empuja; al fondo, dos
//      huacales tapan el zaguán → punto 2 en la calle de la torre
//   3. la torre del reloj: colgados de las dos pesas, las agujas llegan a las doce y la puerta sube → punto 3
//   4. la calle de las alfombras de aserrín: se pasa por el corredor alto de las casas (con una enredadera para
//      columpiarse sobre el callejón) → punto 4 al bajar
//   5. el atrio: dos campanas, cada una con su soga, a 7 m una de otra; si suenan juntas, sube la reja → punto 5 en
//      el mirador
//   6. la carreta del mirador: suben los dos y baja sola por el riel, sobre la barranca, hasta la plaza → punto 6
//      (la meta). Si se empina (los dos atrás), vuelca.
// El secreto: el pilón escondido arriba de la vitrina del carrito del parque (se trepa por el mostrador).
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { crearEscena, raiz, THREE } from "./comun.mjs";

const { mergeGeometries } = await import(
  pathToFileURL(join(raiz, "apps/juego/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js")).href
);

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 3,
  nombre: "La calle empedrada",
  vacio: -6,
  nieblaCerca: 3,
  nieblaLejos: 28,
});

/** Las alturas del suelo: la calle de abajo, la de arriba (después de la cuesta) y la plaza. */
const Y0 = 0;
const Y1 = 1.9;
/** El riel de la carreta del mirador: baja 12° a lo largo de 12 m (ver la misión 6). */
const RIEL = { pendiente: 12, largo: 12 };
const BAJA = RIEL.largo * Math.sin((RIEL.pendiente * Math.PI) / 180);
/** La plaza: 70 cm más abajo que el piso de la carreta cuando llega (se baja de un saltito). */
const YP = Y1 - BAJA - 0.7;

/** Lo que es solo imagen (no choca) va con el color de las siluetas: el juego no le cambia el material. */
const silueta = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 1, metalness: 0 });
const honda = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1, metalness: 0 });
const lejana = new THREE.MeshStandardMaterial({ color: 0x6e6e6b, roughness: 1, metalness: 0 });
const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });

/** Una caja girada (en radianes, sobre x, y, z): una rampa, un tejado. */
function girada(nombre, [x, y, z], [ancho, alto, fondo], [rx, ry, rz], extras) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), gris);
  m.name = nombre;
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.userData = extras;
  escena.add(m);
  return m;
}
/** Una malla que es solo imagen. */
function imagen(nombre, geometria, [x, y, z], material = silueta, [rx, ry, rz] = [0, 0, 0]) {
  const m = new THREE.Mesh(geometria, material);
  m.name = nombre;
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  escena.add(m);
  return m;
}
/** Una rampa de suelo de (x0, y0) a (x1, y1) a lo ancho de z0 a z1, con su relleno debajo hasta `abajo`. */
function rampa(nombre, [x0, y0], [x1, y1], [z0, z1], extras = {}, abajo = -2) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const largo = Math.hypot(dx, dy);
  const angulo = Math.atan2(dy, dx);
  const grueso = 0.4;
  // El centro de la caja: el medio de la cara de arriba, metido medio grueso hacia adentro
  const cx = (x0 + x1) / 2 + Math.sin(angulo) * (grueso / 2);
  const cy = (y0 + y1) / 2 - Math.cos(angulo) * (grueso / 2);
  girada(nombre, [cx, cy, (z0 + z1) / 2], [largo, grueso, z1 - z0], [0, 0, angulo], { tipo: "solido", ...extras });
  // El relleno: escalones de piedra debajo de la rampa, que no asoman
  const tramos = Math.max(1, Math.ceil(largo / 1.5));
  for (let i = 0; i < tramos; i++) {
    const xa = x0 + (dx * i) / tramos;
    const xb = x0 + (dx * (i + 1)) / tramos;
    const arriba = Math.min(y0 + (dy * i) / tramos, y0 + (dy * (i + 1)) / tramos) - 0.35;
    if (arriba <= abajo) continue;
    solido(
      `${nombre}-relleno-${i + 1}`,
      [(xa + xb) / 2, (arriba + abajo) / 2, (z0 + z1) / 2],
      [xb - xa, arriba - abajo, z1 - z0],
      {
        material: "tela",
      },
    );
  }
}
/** Una tapia baja y delgada (20 cm): no deja pasar, y como arriba no hay donde pararse, no se trepa. Con su caballete
 * de tejas encima. */
function tapia(nombre, x0, x1, z, y, alto = 1.05) {
  solido(nombre, [(x0 + x1) / 2, y + alto / 2, z], [x1 - x0, alto, 0.2], { material: "tela" });
  imagen(
    `${nombre}-caballete`,
    new THREE.CylinderGeometry(0.12, 0.12, x1 - x0, 3, 1).rotateZ(Math.PI / 2),
    [(x0 + x1) / 2, y + alto + 0.03, z],
    honda,
  );
}
/** Un tejado de dos aguas a lo largo de x, sobre una casa de `z0` a `z1`, con alero. */
function tejado(nombre, x0, x1, z0, z1, y, alero = 0.5) {
  const fondo = z1 - z0 + alero * 2;
  const caida = 0.42;
  const medio = fondo / 2 / Math.cos(caida);
  for (const lado of [-1, 1]) {
    girada(
      `${nombre}-${lado > 0 ? "a" : "b"}`,
      [(x0 + x1) / 2, y + Math.sin(caida) * (medio / 2), (z0 + z1) / 2 + (lado * fondo) / 4],
      [x1 - x0 + alero * 2, 0.16, medio],
      [lado * caida, 0, 0],
      { tipo: "solido", material: "honda" },
    );
  }
}
/** Una casa de la calle: muros (tela), una puerta oscura, ventanas con rejas y el tejado. `frente`: la z de la
 * fachada que da a la calle; `hacia`: −1 si la casa queda hacia −z de su fachada. */
function casa(nombre, x0, x1, frente, hacia, y, alto, { puerta = true, ventanas = true, fondo = 4 } = {}) {
  const z0 = hacia < 0 ? frente - fondo : frente;
  const z1 = hacia < 0 ? frente : frente + fondo;
  solido(nombre, [(x0 + x1) / 2, y + alto / 2, (z0 + z1) / 2], [x1 - x0, alto, z1 - z0], { material: "tela" });
  tejado(`${nombre}-tejado`, x0, x1, z0, z1, y + alto);
  const cara = frente - hacia * 0.03;
  const ancho = x1 - x0;
  if (puerta) {
    const xp = x0 + ancho * 0.3;
    imagen(`${nombre}-puerta`, new THREE.BoxGeometry(0.9, 2.1, 0.06), [xp, y + 1.05, cara], honda);
  }
  if (ventanas) {
    for (let i = 0; i < Math.max(1, Math.floor(ancho / 2.6)); i++) {
      const xv = x0 + ancho * (0.62 + i * 0.5) - Math.floor(i) * 0.4;
      if (xv > x1 - 0.6) break;
      const v = new THREE.Group();
      v.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.05), honda));
      for (let b = 0; b < 5; b++) {
        const barra = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.15, 0.03), silueta);
        barra.position.set(-0.32 + b * 0.16, 0, -hacia * 0.06);
        v.add(barra);
      }
      v.position.set(xv, y + 1.6, cara);
      v.name = `${nombre}-ventana-${i + 1}`;
      escena.add(v);
    }
  }
}
/** Un farol de pared: un brazo de hierro y el farol (solo imagen). */
function farol(nombre, [x, y, z], hacia) {
  const g = new THREE.Group();
  g.name = nombre;
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5).translate(0, 0.3, -hacia * 0.25), honda));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.3, 6).translate(0, 0, -hacia * 0.45), honda));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 6).translate(0, 0.2, -hacia * 0.45), honda));
  g.position.set(x, y, z);
  escena.add(g);
}

// ── La calle de abajo y la salida ──────────────────────────────────────────────────────────────────────────────
solido("calle-abajo", [-42.5, Y0 - 0.5, 0], [11, 1, 7]);
casa("casa-abajo-1", -48, -42.5, -3.5, -1, Y0, 4.2);
casa("casa-abajo-2", -42.5, -37, -3.5, -1, Y0, 5.2);
tapia("tapia-abajo", -48, -37, 3.6, Y0, 1.0);
solido("muro-oeste", [-48.1, Y0 + 1.5, 0], [0.2, 3, 7], { material: "tela" });
farol("farol-abajo", [-41, Y0 + 2.6, -3.5], -1);

// ── 1. El callejón de la cuesta y la carreta ───────────────────────────────────────────────────────────────────
// La cuesta sube de x −37 (Y0) a −28 (Y1): 12°. Los primeros 6 m es un callejón justo del ancho de la carreta
// (1.64 m); los últimos 3 se abren a lo ancho, para pasar por al lado de la carreta trabada arriba
const CUESTA = { x0: -37, x1: -28, angosto: -31 };
const PENDIENTE = Math.atan2(Y1 - Y0, CUESTA.x1 - CUESTA.x0);
/** La altura de la cuesta en x. */
const enLaCuesta = (x) => Y0 + (x - CUESTA.x0) * Math.tan(PENDIENTE);
{
  const { x0, x1, angosto } = CUESTA;
  rampa("cuesta-angosta", [x0, Y0], [angosto, enLaCuesta(angosto)], [-0.85, 0.85]);
  rampa("cuesta-ancha", [angosto, enLaCuesta(angosto)], [x1, Y1], [-3.5, 3.6]);
  // El callejón: la casa del fondo (alta) y, del lado de la cámara, una tapia delgada que sube con la cuesta, 90 cm
  // sobre ella
  casa("callejon-casa", x0, angosto, -0.85, -1, Y0 - 1, 7.5, { fondo: 2.65, puerta: false });
  const largo = (angosto - x0) / Math.cos(PENDIENTE);
  const xm = (x0 + angosto) / 2;
  girada(
    "callejon-tapia",
    [xm - Math.sin(PENDIENTE) * 0.35, enLaCuesta(xm) + Math.cos(PENDIENTE) * 0.35, 0.95],
    [largo, 1.1, 0.2],
    [0, 0, PENDIENTE],
    { tipo: "solido", material: "tela" },
  );
  // El jardín detrás de la tapia, bajo (la cámara mira por encima), cerrado con tapias delgadas por las dos puntas
  solido("callejon-jardin", [xm, (Y0 + 0.3 - 1) / 2, 2.4], [angosto - x0, 1.3, 2.7], { material: "tela" });
  solido("callejon-cierre-abajo", [x0 - 0.1, Y0 + 0.55, 2.35], [0.2, 1.1, 2.6], { material: "tela" });
  const arriba = enLaCuesta(angosto) + 1.1;
  solido("callejon-cierre-arriba", [angosto + 0.1, (Y0 + 0.3 + arriba) / 2, 2.35], [0.2, arriba - Y0 - 0.3, 2.6], {
    material: "tela",
  });
  tapia("callejon-tapia-afuera", x0, angosto, 3.75, Y0 + 0.3, 0.9);
  for (let i = 0; i < 4; i++) {
    vacio(
      `callejon-mata-${i + 1}`,
      [x0 + 0.9 + i * 1.5, Y0 + 0.3, 2.4],
      [1, 1, 1],
      { tipo: "adorno", forma: "mata", alto: 0.9 + (i % 2) * 0.4, semilla: 60 + i },
      0,
    );
  }
  // El tope de la carreta abajo: una piedra
  imagen("tope-carreta", new THREE.BoxGeometry(0.3, 0.3, 1.2), [x0 - 0.15, Y0 + 0.15, 0], honda);
}
// Las casas del tramo ancho de arriba
casa("casa-cuesta-1", -31, -24, -3.5, -1, Y1 - 1.2, 6.2);
tapia("tapia-cuesta", -31, -24, 3.7, Y1 - 1.2, 2.2);
// La carreta: su caja va inclinada con la cuesta, la parte de atrás a 15 cm del pie y las ruedas sobre el suelo
{
  const angulo = PENDIENTE;
  const s = 0.15 + 0.9;
  const sobre = 0.02 + 0.525;
  const x = CUESTA.x0 + Math.cos(angulo) * s - Math.sin(angulo) * sobre;
  const y = Y0 + Math.sin(angulo) * s + Math.cos(angulo) * sobre;
  girada("carreta", [x, y, 0], [1.8, 1.05, 1.5], [0, 0, angulo], {
    tipo: "pieza",
    pieza: "carreta",
    masa: 90,
    adelante: 7.1,
  });
}

// ── La plazuela de arriba y el parquecito ──────────────────────────────────────────────────────────────────────
solido("plazuela", [-21.2, Y1 - 0.5, 0], [13.6, 1, 7.4]);
solido("plazuela-pena", [-21.2, (Y1 - 1 - 2) / 2, 0], [13.6, Y1 - 1 + 2, 7.4], { material: "tela" });
casa("casa-plazuela-1", -28, -21, -3.7, -1, Y1, 5.5);
casa("casa-plazuela-2", -21, -14.4, -3.7, -1, Y1, 6.4, { puerta: false });
tapia("tapia-plazuela", -28, -14.4, 3.8, Y1, 1.05);
farol("farol-plazuela", [-18, Y1 + 2.8, -3.7], -1);
// El carrito del parque: un mostrador bajo (1 m) y la vitrina (2 m). El pilón está escondido arriba de la vitrina;
// se sube al mostrador y de ahí a la vitrina, trepando
const CARRITO = { x0: -22.4, medio: -21.2, x1: -20.0, z0: -2.9, z1: -1.9 };
{
  const { x0, medio, x1, z0, z1 } = CARRITO;
  solido("carrito-mostrador", [(x0 + medio) / 2, Y1 + 0.5, (z0 + z1) / 2], [medio - x0, 1.0, z1 - z0], {
    material: "corteza",
  });
  solido("carrito-vitrina", [(medio + x1) / 2, Y1 + 1.0, (z0 + z1) / 2], [x1 - medio, 2.0, z1 - z0], {
    material: "corteza",
  });
  // Las ruedas, las varas y el letrero (solo imagen)
  for (const x of [x0 + 0.4, x1 - 0.4]) {
    imagen(
      `carrito-rueda-${x < medio ? 1 : 2}`,
      new THREE.TorusGeometry(0.28, 0.05, 6, 16),
      [x, Y1 + 0.3, z1 + 0.04],
      honda,
    );
  }
  imagen("carrito-varas", new THREE.BoxGeometry(0.9, 0.05, 0.05), [x0 - 0.4, Y1 + 0.75, (z0 + z1) / 2], honda);
  imagen("carrito-letrero", new THREE.BoxGeometry(1.1, 0.3, 0.04), [(medio + x1) / 2, Y1 + 1.55, z1 + 0.03], honda);
}
vacio(
  "secreto",
  [(CARRITO.medio + CARRITO.x1) / 2, Y1 + 2.45, (CARRITO.z0 + CARRITO.z1) / 2],
  [0.55, 0.4, 0.45],
  {
    tipo: "secreto",
  },
  0,
);
// Una banca del parque y unos árboles
solido("banca", [-24.8, Y1 + 0.22, -2.6], [1.4, 0.45, 0.45], { material: "corteza" });

// ── 2. La calle de la Carreta sin bueyes ────────────────────────────────────────────────────────────────────────
// La calle angosta va de x −14.4 a −5.4, del ancho de la carreta. La Carreta sin bueyes descansa en la plazuela
// (su caja, con el centro en x −17) y rueda sola hasta el fondo de la calle y de vuelta. El freno es una palanca
// junto a la entrada: mientras alguien la empuja hacia la calle, la carreta se para
const CALLE = { x0: -14.4, x1: -5.4, fondo: 0.8 };
solido("calle-carreta", [(CALLE.x0 + CALLE.x1) / 2, Y1 - 0.5, 0], [CALLE.x1 - CALLE.x0, 1, 3.2]);
solido("calle-carreta-pena", [(CALLE.x0 + CALLE.x1) / 2, (Y1 - 1 - 2) / 2, 0], [CALLE.x1 - CALLE.x0, Y1 + 1, 3.2], {
  material: "tela",
});
casa("casa-carreta-1", CALLE.x0, -9.4, -0.85, -1, Y1, 6.8, { fondo: 2.85 });
casa("casa-carreta-2", -9.4, CALLE.x1, -0.85, -1, Y1, 5.6, { fondo: 2.85 });
tapia("tapia-carreta", CALLE.x0, CALLE.x1, 0.95, Y1, 1.05);
// La esquina entre la plazuela y el jardín de la calle: que nadie baje al jardín
solido("tapia-esquina", [CALLE.x0 + 0.1, Y1 + 0.52, 2.4], [0.2, 1.05, 2.9], { material: "tela" });
// Del otro lado de la tapia, un jardín que no se pisa (más bajo)
solido("jardin-carreta", [(CALLE.x0 + CALLE.x1) / 2, Y1 - 1.5, 2.3], [CALLE.x1 - CALLE.x0, 1, 2.5], {
  material: "tela",
});
// El fondo: el muro con el zaguán (1.2 m de ancho, 2.3 de alto), que lleva a la calle de la torre
{
  const x = CALLE.x1 + CALLE.fondo / 2;
  solido("zaguan-muro-1", [x, Y1 + 2.5, -2.15], [CALLE.fondo, 5, 3.0], { material: "tela" });
  solido("zaguan-muro-2", [x, Y1 + 2.5, 2.1], [CALLE.fondo, 5, 3.0], { material: "tela" });
  solido("zaguan-dintel", [x, Y1 + 3.65, 0], [CALLE.fondo, 2.7, 1.2], { material: "tela" });
  solido("zaguan-piso", [x, Y1 - 0.5, 0], [CALLE.fondo, 1, 1.2]);
}
// Lo que estorba: dos huacales en el zaguán, uno sobre otro
pieza("estorbo-1", "huacal", [CALLE.x1 + 0.4, Y1 + 0.275, 0], [0.55, 0.55, 0.55], { masa: 5 });
pieza("estorbo-2", "huacal", [CALLE.x1 + 0.4, Y1 + 0.825, 0], [0.55, 0.55, 0.55], { masa: 5 });
// La Carreta sin bueyes: rueda de x −17 a −6.8 (10.2 m) a 3.5 m/s y espera 1 s en cada punta
pieza("carreta-sin-bueyes", "sin-bueyes", [-17, Y1 + 0.675, 0], [1.8, 1.05, 1.5], { recorrido: 10.2, espera: 1 });
// El freno, junto a la entrada de la calle, inclinado hacia la plazuela: se lo empuja hacia la calle
pieza("freno", "palanca", [-15.4, Y1 + 0.6, -1.7], [0.6, 1.2, 0.3], { angulo: 30 }, -Math.PI / 2);
imagen("freno-poste", new THREE.BoxGeometry(0.12, 2.4, 0.12), [-15.4, Y1 + 1.2, -2.05], honda);

// ── 3. La calle de la torre y la torre del reloj ───────────────────────────────────────────────────────────────
solido("calle-torre", [2.45, Y1 - 0.5, 0], [14.1, 1, 6.8]);
solido("calle-torre-pena", [2.45, (Y1 - 1 - 2) / 2, 0], [14.1, Y1 + 1, 6.8], { material: "tela" });
casa("casa-torre-1", -4.6, 1.6, -3.4, -1, Y1, 5.0);
casa("casa-torre-2", 5.6, 9.5, -3.4, -1, Y1, 4.6, { puerta: false });
tapia("tapia-torre-1", -4.6, 5.6, 3.4, Y1);
tapia("tapia-torre-2", 5.6, 9.5, 3.4, Y1);
// Del lado de la cámara, al costado de la torre, queda un rincón cerrado por una tapia baja (no se rodea la torre):
// ahí cuelgan las pesas
solido("tapia-torre-cierre", [5.5, Y1 + 0.52, 2.6], [0.2, 1.05, 1.6], { material: "tela" });
// La torre: de x 1.6 a 5.6, con el arco del paso (1.8 m de ancho, 2.6 de alto) y la esfera del reloj arriba
const TORRE = { x0: 1.6, x1: 5.6, z0: -3.6, z1: 1.8, arco: 0.9, altoArco: 2.6, alto: 12 };
{
  const { x0, x1, z0, z1, arco, altoArco, alto } = TORRE;
  const xm = (x0 + x1) / 2;
  solido("torre-pilar-1", [xm, Y1 + alto / 2, (z0 - arco) / 2], [x1 - x0, alto, -arco - z0], { material: "tela" });
  solido("torre-pilar-2", [xm, Y1 + alto / 2, (z1 + arco) / 2], [x1 - x0, alto, z1 - arco], { material: "tela" });
  solido("torre-arco", [xm, Y1 + (altoArco + alto) / 2, 0], [x1 - x0, alto - altoArco, arco * 2], { material: "tela" });
  // El remate: un cuerpo más angosto con su cúpula y la cruz (lejos de todo: solo choca como caja)
  solido("torre-remate", [xm, Y1 + alto + 1.5, (z0 + z1) / 2], [x1 - x0 - 0.8, 3, z1 - z0 - 0.8], {
    material: "honda",
  });
  imagen(
    "torre-cupula",
    new THREE.SphereGeometry(1.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    [xm, Y1 + alto + 3, (z0 + z1) / 2],
    honda,
  );
  imagen("torre-cruz", new THREE.BoxGeometry(0.08, 1.0, 0.08), [xm, Y1 + alto + 4.9, (z0 + z1) / 2], honda);
  imagen("torre-cruz-2", new THREE.BoxGeometry(0.08, 0.08, 0.5), [xm, Y1 + alto + 5.1, (z0 + z1) / 2], honda);
  // La ventana del mecanismo, donde se ven los engranajes
  imagen("torre-ventana", new THREE.BoxGeometry(2.4, 1.4, 0.04), [xm, Y1 + 3.65, z1 + 0.02], honda);
}
// La puerta del arco: sube cuando las dos agujas llegan a las doce
solido("puerta-torre", [TORRE.x0 + 0.12, Y1 + TORRE.altoArco / 2, 0], [0.12, TORRE.altoArco, TORRE.arco * 2], {
  cuerpo: "cinematico",
  material: "honda",
});
// Las dos pesas, colgadas de sus cadenas en la cara de la torre que da a la cámara, a 30 cm de ella: la manija a
// 1.75 m del suelo, a lo ancho (la x de su caja). La de los minutos y la de las horas; las cadenas entran a la
// ventana del mecanismo
for (const [i, x] of [2.6, 4.1].entries()) {
  pieza(`pesa-${i + 1}`, "pesa", [x, Y1 + 1.75 + 0.36, TORRE.z1 + 0.3], [0.5, 0.72, 0.3], {
    recorrido: 0.4,
    cadena: 0.75,
  });
}
// Los engranajes del mecanismo (en la ventana) y las agujas de la esfera: los mueven las pesas. Van en la cara de la
// torre que mira hacia la cámara (+z)
pieza("rueda-1", "engranaje", [3.05, Y1 + 3.7, TORRE.z1 + 0.06], [0.9, 0.9, 0.08], {
  pesa: 1,
  vueltas: 1,
  dientes: 14,
});
pieza("rueda-2", "engranaje", [3.8, Y1 + 3.55, TORRE.z1 + 0.06], [0.62, 0.62, 0.08], {
  pesa: 2,
  vueltas: -1.4,
  dientes: 10,
});
const ESFERA = { x: (TORRE.x0 + TORRE.x1) / 2, y: Y1 + 7.2, z: TORRE.z1 + 0.06, radio: 1.15 };
pieza("minutero", "engranaje", [ESFERA.x, ESFERA.y, ESFERA.z + 0.04], [2.0, 2.0, 0.05], {
  pesa: 1,
  vueltas: 0.5,
  desde: 180,
  aguja: 1,
});
pieza("horario", "engranaje", [ESFERA.x, ESFERA.y, ESFERA.z + 0.08], [1.3, 1.3, 0.05], {
  pesa: 2,
  vueltas: 2 / 3,
  desde: 120,
  aguja: 1,
});

// ── 4. La calle de las alfombras y el corredor alto ────────────────────────────────────────────────────────────
// La calle de x 9.5 a 31; el corredor alto de las casas del fondo, a 2 m (G), de z −2.2 a −0.8, con su baranda.
// Se sube por una escalinata (rampa de x 8.5 a 12.5) y se baja por otra (de 25 a 29). En el medio, el callejón
// (de 18.5 a 20.65): se cruza columpiándose en la enredadera que cuelga de la viga
const G = Y1 + 2.0;
const CORREDOR = {
  z0: -2.2,
  z1: -0.8,
  subida: [8.5, 12.5],
  tramo1: [12.5, 18.5],
  tramo2: [20.65, 25.0],
  bajada: [25.0, 29.0],
};
solido("calle-alfombras", [20.25, Y1 - 0.5, 0], [21.5, 1, 6.8]);
solido("calle-alfombras-pena", [20.25, (Y1 - 1 - 2) / 2, 0], [21.5, Y1 + 1, 6.8], { material: "tela" });
{
  const { z0, z1, subida, tramo1, tramo2, bajada } = CORREDOR;
  const zm = (z0 + z1) / 2;
  // La escalinata: una rampa que choca (invisible) y los escalones que se ven
  const escalinata = (nombre, [xa, xb], sube) => {
    rampa(nombre, sube ? [xa, Y1] : [xa, G], sube ? [xb, G] : [xb, Y1], [z0, z1], { invisible: 1 }, Y1 + 0.05);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const alto = ((i + 1) * (G - Y1)) / n;
      const x = sube ? xa + ((i + 0.5) * (xb - xa)) / n : xb - ((i + 0.5) * (xb - xa)) / n;
      imagen(
        `${nombre}-escalon-${i + 1}`,
        new THREE.BoxGeometry((xb - xa) / n, alto, z1 - z0),
        [x, Y1 + alto / 2, zm],
        silueta,
      );
    }
  };
  escalinata("subida", subida, true);
  escalinata("bajada", bajada, false);
  // Los dos tramos del corredor: el piso y la baranda del lado de la calle (choca como una caja delgada). Junto al
  // callejón el corredor queda abierto metro y medio: ahí cuelga la enredadera, y la mano no tiene que agarrar la baranda
  for (const [i, [xa, xb]] of [tramo1, tramo2].entries()) {
    solido(`corredor-${i + 1}`, [(xa + xb) / 2, G - 0.1, zm], [xb - xa, 0.2, z1 - z0], { material: "corteza" });
    const [ra, rb] = i === 0 ? [xa, xb - 1.5] : [xa + 1.5, xb];
    solido(`corredor-${i + 1}-baranda`, [(ra + rb) / 2, G + 0.45, z1 - 0.04], [rb - ra, 0.9, 0.08], { invisible: 1 });
    const balaustres = [new THREE.BoxGeometry(rb - ra, 0.07, 0.1).translate(0, 0.47, 0)];
    const n = Math.round((rb - ra) / 0.25);
    for (let k = 0; k < n; k++) {
      balaustres.push(
        new THREE.CylinderGeometry(0.03, 0.04, 0.85, 5).translate(-(rb - ra) / 2 + ((k + 0.5) * (rb - ra)) / n, 0, 0),
      );
    }
    imagen(
      `corredor-${i + 1}-baranda-imagen`,
      mergeGeometries(balaustres),
      [(ra + rb) / 2, G + 0.43, z1 - 0.04],
      silueta,
    );
    // Los pilares de madera que lo sostienen
    for (let x = xa + 0.2; x < xb; x += 2.0) {
      solido(
        `corredor-${i + 1}-pilar-${Math.round(x * 10)}`,
        [x, (Y1 + G - 0.2) / 2, z1 - 0.1],
        [0.16, G - 0.2 - Y1, 0.16],
        {
          material: "corteza",
        },
      );
    }
  }
  // Las casas del corredor (detrás) y el callejón entre ellas
  casa("casa-alfombras-1", 8.5, 18.5, z0, -1, Y1, 6.2, { fondo: 3 });
  casa("casa-alfombras-2", 20.65, 31, z0, -1, Y1, 5.8, { fondo: 3 });
  solido("callejon-alfombras-fondo", [19.6, Y1 + 3, z0 - 3.2], [2.2, 6, 0.4], { material: "honda" });
  // La viga sobre el callejón y la enredadera para cada uno (como los bejucos del pinar: a 30 cm del borde y con
  // la punta a 1 m del piso del corredor)
  solido("viga", [18.8, G + 4, zm - 0.3], [0.2, 0.2, z1 - z0 + 1.6], { material: "corteza" });
  pieza("enredadera-roja", "bejuco", [18.8, G + 2.45, -1.2], [0.08, 2.9, 0.08]);
  pieza("enredadera-turquesa", "bejuco", [18.8, G + 2.45, -1.85], [0.08, 2.9, 0.08]);
}
tapia("tapia-alfombras", 9.5, 31, 3.4, Y1, 1.05);
// Las alfombras de aserrín: tres, de pared a pared, entre las escalinatas
for (const [i, x] of [14.6, 19.15, 23.7].entries()) {
  pieza(`alfombra-${i + 1}`, "alfombra", [x, Y1 + 0.01, 0.55], [4.0, 0.02, 5.5], { semilla: i + 1 });
}

// ── 5. El atrio y las campanas ──────────────────────────────────────────────────────────────────────────────────
// La fachada de la iglesia hacia −z, con dos espadañas de campana a 7 m una de otra; cada campana con su soga, que
// baja delante de la fachada hasta una manija a 1.75 m. Al fondo, la reja del mirador
const ATRIO = { x0: 29, x1: 41.5, z0: -3.2, z1: 2.4 };
solido("atrio", [(ATRIO.x0 + ATRIO.x1) / 2, Y1 - 0.5, -0.4], [ATRIO.x1 - ATRIO.x0, 1, 6.8]);
solido("atrio-pena", [(ATRIO.x0 + ATRIO.x1) / 2, (Y1 - 1 - 2) / 2, -0.4], [ATRIO.x1 - ATRIO.x0, Y1 + 1, 6.8], {
  material: "tela",
});
solido("iglesia", [(ATRIO.x0 + ATRIO.x1) / 2, Y1 + 4.5, ATRIO.z0 - 2], [ATRIO.x1 - ATRIO.x0, 9, 4], {
  material: "tela",
});
imagen("iglesia-puerta", new THREE.BoxGeometry(2, 3.4, 0.06), [35, Y1 + 1.7, ATRIO.z0 + 0.02], honda);
imagen(
  "iglesia-rosetón",
  new THREE.CylinderGeometry(0.7, 0.7, 0.06, 16).rotateX(Math.PI / 2),
  [35, Y1 + 5.2, ATRIO.z0 + 0.02],
  honda,
);
tapia("tapia-atrio", ATRIO.x0, ATRIO.x1, ATRIO.z1 + 0.1, Y1);
const CAMPANAS = [31.5, 38.5];
for (const [i, x] of CAMPANAS.entries()) {
  // La espadaña: un muro alto con el arco donde cuelga la campana (claro: la campana se recorta contra la niebla)
  solido(`espadana-${i + 1}`, [x, Y1 + 9.4, ATRIO.z0 - 0.4], [2.4, 3.4, 0.8], { material: "tela" });
  imagen(`espadana-${i + 1}-arco`, new THREE.BoxGeometry(1.5, 1.9, 0.82), [x, Y1 + 9.2, ATRIO.z0 - 0.4], lejana);
  imagen(
    `espadana-${i + 1}-remate`,
    new THREE.ConeGeometry(0.9, 1, 4).rotateY(Math.PI / 4),
    [x, Y1 + 11.6, ATRIO.z0 - 0.4],
    honda,
  );
  pieza(`campana-${i + 1}`, "campana", [x, Y1 + 9.2, ATRIO.z0 + 0.1], [1.0, 1.1, 1.0], {
    soga: 6.9,
    adelante: 0.7,
    recorrido: 0.35,
  });
}
// La reja del mirador: sube cuando las dos campanas suenan juntas
solido("reja", [ATRIO.x1, Y1 + 1.4, -0.4], [0.12, 2.8, 6.8], { cuerpo: "cinematico", material: "honda" });
solido("reja-dintel", [ATRIO.x1, Y1 + 4.3, -0.4], [0.5, 0.6, 6.8], { material: "tela" });

// ── 6. El mirador, la carreta y la bajada a la plaza ──────────────────────────────────────────────────────────
// La carreta espera con el piso al ras del mirador (y = Y1) y la parte de atrás abierta, contra el borde (x 46). Su
// riel baja 12° hacia +x sobre la barranca; la caja se empina si el peso queda detrás del eje
const MIRADOR = { x0: ATRIO.x1, x1: 46 };
solido("mirador", [(MIRADOR.x0 + MIRADOR.x1) / 2, Y1 - 0.5, -0.4], [MIRADOR.x1 - MIRADOR.x0, 1, 6.8]);
solido(
  "mirador-pena",
  [(MIRADOR.x0 + MIRADOR.x1) / 2, (Y1 - 1 - 6) / 2, -0.4],
  [MIRADOR.x1 - MIRADOR.x0, Y1 + 5, 6.8],
  {
    material: "tela",
  },
);
tapia("tapia-mirador", MIRADOR.x0, MIRADOR.x1, ATRIO.z1 + 0.1, Y1, 1.0);
solido("mirador-fondo", [(MIRADOR.x0 + MIRADOR.x1) / 2, Y1 + 0.5, ATRIO.z0 - 0.1], [MIRADOR.x1 - MIRADOR.x0, 1, 0.2], {
  material: "tela",
});
// La caja mide 1.2 de alto: las ruedas tienen 54 cm de radio y el piso (10 cm) queda encima del eje
pieza("carreta-mirador", "carreta", [MIRADOR.x1 + 1.2, Y1 - 0.64 + 0.6, 0], [2.4, 1.2, 1.5], {
  masa: 40,
  adelante: RIEL.largo,
  pendiente: -RIEL.pendiente,
  empina: 18,
  cabecea: 4,
  contrapeso: 14,
  rozamiento: 80,
  llegada: 3,
});
// El riel: dos hierros delgados sobre caballetes, de solo imagen (no se camina por ahí)
{
  const rad = (RIEL.pendiente * Math.PI) / 180;
  const largo = RIEL.largo + 3;
  const x = MIRADOR.x1 + 0.6 + (Math.cos(rad) * largo) / 2;
  const y = Y1 - 0.64 - 0.03 - (Math.sin(rad) * largo) / 2;
  for (const z of [-0.62, 0.62]) {
    imagen(`riel-${z < 0 ? 1 : 2}`, new THREE.BoxGeometry(largo, 0.06, 0.06), [x, y, z], honda, [0, 0, -rad]);
  }
  for (let i = 0; i < 6; i++) {
    const s = 1 + i * 2.6;
    const xs = MIRADOR.x1 + 0.6 + Math.cos(rad) * s;
    const ys = Y1 - 0.64 - 0.06 - Math.sin(rad) * s;
    const alto = ys + 6;
    imagen(`caballete-riel-${i + 1}`, new THREE.BoxGeometry(0.14, alto, 1.4), [xs, ys - alto / 2, 0], silueta);
  }
}
// La barranca (cuenta como caída) y su fondo, lejos
vacio("barranca", [51, Y1 - 5.5, 0], [5.2, 2.5, 4.5], { tipo: "vacio" }, 0);
solido("barranca-fondo", [51, -7.5, 0], [10, 1, 9], { material: "lejana" });

// La plaza, abajo: la carreta llega con el piso 70 cm sobre ella
const PLAZA = { x0: 55.5, x1: 62 };
solido("plaza", [(PLAZA.x0 + PLAZA.x1) / 2, YP - 0.5, 0], [PLAZA.x1 - PLAZA.x0, 1, 8]);
solido("plaza-pena", [(PLAZA.x0 + PLAZA.x1) / 2, (YP - 1 - 6) / 2, 0], [PLAZA.x1 - PLAZA.x0, YP + 5, 8], {
  material: "tela",
});
solido("plaza-fondo", [PLAZA.x1 + 0.2, YP + 3, 0], [0.4, 6, 8], { material: "tela" });
tapia("tapia-plaza", PLAZA.x0, PLAZA.x1, 4.1, YP, 1.0);
solido("plaza-casa", [(PLAZA.x0 + PLAZA.x1) / 2, YP + 3, -4.5], [PLAZA.x1 - PLAZA.x0, 6, 1], { material: "tela" });
// La pila de la plaza
solido("pila", [61, YP + 0.35, 1.6], [1.8, 0.7, 1.8], { forma: "cilindro", material: "tela" });
imagen("pila-surtidor", new THREE.CylinderGeometry(0.12, 0.2, 1.2, 8), [61, YP + 1.2, 1.6], silueta);

// ── Salidas y puntos de control (zonas de 1 × 2 m de fondo y alto, rotadas para mirar hacia +x) ───────────────────
vacio("salida-rojo", [-43.5, Y0, 0.6], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-43.5, Y0, -0.6], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [-26.3, Y1 + 1, 0], [3.4, 1, 0.5], { tipo: "control", orden: 1 });
vacio("control-2", [-3.4, Y1 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 2 });
vacio("control-3", [7.5, Y1 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 3 });
vacio("control-4", [30.0, Y1 + 1, 0], [2.6, 1, 0.5], { tipo: "control", orden: 4 });
vacio("control-5", [43.6, Y1 + 1, 0], [2.6, 1, 0.5], { tipo: "control", orden: 5 });
// La meta: donde para la carreta, sobre la plaza (alcanza con llegar arriba de ella); se reaparece al costado
vacio("control-6", [59.5, YP + 1.6, -1.8], [3.2, 1.6, 1.6], { tipo: "control", orden: 6 });

// ── Adornos y niebla ──────────────────────────────────────────────────────────────────────────────────────────
// La catedral a lo lejos, detrás de la plaza (solo choca como caja; nadie llega ahí)
solido("catedral", [57, Y1 + 4, -16], [14, 10, 6], { material: "lejana" });
solido("catedral-torre", [52, Y1 + 9, -15], [3, 20, 3], { material: "lejana" });
imagen(
  "catedral-cupula",
  new THREE.SphereGeometry(2.6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  [60, Y1 + 9, -16],
  lejana,
);
// Tejados lejos, detrás de las casas del fondo
for (let i = 0; i < 14; i++) {
  const x = -46 + i * 8;
  const alto = 5 + (i % 3) * 1.5;
  solido(`lejos-${i + 1}`, [x, Y1 + alto / 2 - 1, -10 - (i % 2) * 3], [6.5, alto, 4], { material: "lejana" });
}
// Cerros con árboles al fondo
for (let i = 0; i < 22; i++) {
  const x = -50 + i * 5.3;
  vacio(
    `abeto-${i + 1}`,
    [x, -4, -20 - (i % 3) * 3],
    [1, 1, 1],
    { tipo: "adorno", forma: "abeto", alto: 9 + (i % 4) * 2 },
    0,
  );
}
const matas = [
  [-45, Y0, 3.0, 0.8],
  [-25.5, Y1, -3.0, 1.0],
  [-16.2, Y1, 3.2, 0.8],
  [-3.6, Y1, 2.8, 0.9],
  [9.0, Y1, 2.8, 0.8],
  [42.5, Y1, 1.9, 0.9],
  [57, YP, 3.4, 1.0],
];
for (const [i, [x, y, z, alto]] of matas.entries()) {
  vacio(`mata-${i + 1}`, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "mata", alto, semilla: 40 + i }, 0);
}
vacio(
  "pino-del-parque",
  [-23.6, Y1, -3.0],
  [1, 1, 1],
  { tipo: "adorno", forma: "pino", alto: 9, radio: 0.22, semilla: 4 },
  0,
);
vacio(
  "pino-de-la-plaza",
  [58, YP, -3.4],
  [1, 1, 1],
  { tipo: "adorno", forma: "pino", alto: 10, radio: 0.25, semilla: 9 },
  0,
);
// Niebla: capas entre las casas y sobre la barranca
vacio("niebla-1", [-30, 3, -7], [16, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.12 }, 0);
vacio("niebla-2", [0, 4, -8], [18, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: -0.1 }, 0);
vacio("niebla-3", [30, 4, -8], [18, 3, 1], { tipo: "niebla", opacidad: 0.5, velocidad: 0.14 }, 0);
vacio("niebla-barranca", [51, Y1 - 3, 0], [6, 1.6, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.1 }, 0);
vacio("niebla-4", [10, 6, -14], [40, 6, 1], { tipo: "niebla", opacidad: 0.65, velocidad: 0.2 }, 0);
vacio("niebla-5", [50, 6, -18], [30, 7, 1], { tipo: "niebla", opacidad: 0.7, velocidad: -0.16 }, 0);

await exportar("03-calle");
