// pnpm niveles: arma niveles/04-xibalba/escena.glb, el nivel 4 (TU-26): Xibalbá de juguete, en Copán, Honduras.
// Pirámides, estelas y túneles de piedra clara, con guacamayas por todas partes; en el túnel viven los murciélagos
// de Xibalbá, que apagan las antorchas. Como los otros, sin Blender: las mismas propiedades (`extras`) que se
// pondrían en Blender. La convención está en niveles/README.md.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. Cada misión termina en un punto de control:
//   1. la plaza: la entrada de la muralla se abre con los dos parados en la plancha doble (una placa a cada lado,
//      a 2 m una de otra) → punto 1
//   2. el patio de la estela: se la gira entre los dos con sus varas (trabada si la agarra uno solo) hasta que el
//      glifo del sol mira la reja → la reja se hunde → punto 2
//   3. el juego de pelota: la pelota de hule, en su soporte frente al aro; meterla por el aro (agarrarla, saltar y
//      soltarla) abre el portón → punto 3
//   4. la escalinata: el bloque de 9 kg en su altar (uno solo no lo levanta ni lo arrastra); lo suben los dos grada
//      por grada (30 cm) hasta el pie del templo (2.3 m, más de lo que se trepa), lo dejan contra la pared y desde
//      el bloque se trepa → punto 4 arriba del templo
//   5. el túnel de los murciélagos: uno lleva la antorcha (con las dos manos) y el otro la llave de jade; la llave
//      en la cerradura de la puerta del fondo la abre → punto 5
//   6. la tumba: la losa sube con el contrapeso (dos piedras en el plato) → punto 6 adentro, la meta
// El secreto: la guacamaya dorada en lo alto del templo; se sube por tres escalones de 1.5 m junto a la entrada
// del túnel.
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 4,
  nombre: "Xibalbá de juguete",
  vacio: -4,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** Las alturas del suelo: la plaza, la terraza arriba de la escalinata y el templo. */
const Y0 = 0;
const Y1 = 1.8;
const Y2 = 4.1;

/** Una baranda: choca solo con los muñecos (el guion le pone sus grupos de choque), no se ve, y la cámara y lo
 * suelto no la ven. Así lo que da hacia la cámara puede ser bajo sin que se pueda trepar. */
function baranda(nombre, centro, medidas) {
  solido(`${nombre}-baranda`, centro, medidas, { invisible: 1 });
}

/** Una pared de piedra a lo largo de z (cruza el camino), con un hueco en el medio de `hueco[0]` a `hueco[1]` y su
 * dintel arriba. Del lado de la cámara es baja (para que no tape) y lo demás es baranda. */
function muralla(nombre, x, alto, hueco = [-0.8, 0.8], y = Y0, grueso = 0.8) {
  const [h0, h1] = hueco;
  solido(`${nombre}-1`, [x, y + alto / 2, (-3.5 + h0) / 2], [grueso, alto, h0 + 3.5], { material: "tela" });
  solido(`${nombre}-2`, [x, y + 0.45, (h1 + 3.5) / 2], [grueso, 0.9, 3.5 - h1], { material: "tela" });
  baranda(`${nombre}-2`, [x, y + alto / 2, (h1 + 3.5) / 2], [grueso, alto, 3.5 - h1]);
  solido(`${nombre}-dintel`, [x, y + 2.6 + (alto - 2.6) / 2, (h0 + h1) / 2], [grueso, alto - 2.6, h1 - h0], {
    material: "tela",
  });
}

/** Los costados del camino: atrás un muro alto de piedra y adelante un parapeto bajo, que no le tapa la cámara (y
 * su baranda, que no deja pasar). */
function costados(nombre, x0, x1, y = Y0, alto = 2.6) {
  solido(`${nombre}-atras`, [(x0 + x1) / 2, y + alto / 2, -3.35], [x1 - x0, alto, 0.3], { material: "tela" });
  solido(`${nombre}-adelante`, [(x0 + x1) / 2, y + 0.45, 3.35], [x1 - x0, 0.9, 0.3], { material: "tela" });
  baranda(`${nombre}-adelante`, [(x0 + x1) / 2, y + 1.5, 3.35], [x1 - x0, 3, 0.3]);
}

/** Una ceiba de lejos: el tronco con sus raíces de tabla y la copa ancha, en capas. */
function ceiba(nombre, [x, y, z], alto, gris = 0x707070) {
  imagen(`${nombre}-tronco`, new THREE.CylinderGeometry(0.35, 0.7, alto, 10), [x, y + alto / 2, z], gris);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.6 + 0.4;
    const raiz = new THREE.BoxGeometry(0.12, 1.6, 1.4).rotateY(a).translate(Math.cos(a) * 0.5, 0.8, -Math.sin(a) * 0.5);
    imagen(`${nombre}-raiz-${i + 1}`, raiz, [x, y, z], gris);
  }
  for (const [i, [dx, dy, r]] of [
    [0, 0, 5],
    [-3.5, -1.2, 3.5],
    [3.8, -0.8, 3.8],
    [0.8, 1.2, 3.2],
  ].entries()) {
    const copa = new THREE.SphereGeometry(r, 12, 8).scale(1, 0.32, 0.8);
    imagen(`${nombre}-copa-${i + 1}`, copa, [x + dx, y + alto + dy, z], gris);
  }
  for (const [i, s] of [-1, 1].entries()) {
    const rama = new THREE.CylinderGeometry(0.12, 0.22, 4.5, 6).rotateZ(s * 1.05);
    imagen(`${nombre}-rama-${i + 1}`, rama, [x + s * 1.8, y + alto - 1.4, z], gris);
  }
}

/** Una malla que solo se ve (no choca): un gris propio, para lo de lejos. */
function imagen(nombre, geometria, [x, y, z], gris = 0x8a8a86, rumbo = 0) {
  const m = new THREE.Mesh(geometria, new THREE.MeshStandardMaterial({ color: gris, roughness: 1 }));
  m.name = nombre;
  m.position.set(x, y, z);
  m.rotation.y = rumbo;
  escena.add(m);
  return m;
}

/** Una pirámide escalonada de lejos, con su templo arriba. */
function piramide(nombre, [x, y, z], ancho, gradas, alto, gris) {
  for (let i = 0; i < gradas; i++) {
    const w = ancho * (1 - (i / gradas) * 0.62);
    imagen(`${nombre}-grada-${i + 1}`, new THREE.BoxGeometry(w, alto, w * 0.8), [x, y + alto * (i + 0.5), z], gris);
  }
  // La escalinata al frente y el templo con su crestería
  imagen(
    `${nombre}-escalinata`,
    new THREE.BoxGeometry(ancho * 0.16, alto * gradas, ancho * 0.25).translate(0, 0, 0).rotateX(-0.6),
    [x, y + (alto * gradas) / 2, z + ancho * 0.36],
    gris + 0x060606,
  );
  const arriba = y + alto * gradas;
  imagen(
    `${nombre}-templo`,
    new THREE.BoxGeometry(ancho * 0.3, alto * 2.2, ancho * 0.22),
    [x, arriba + alto * 1.1, z],
    gris,
  );
  imagen(
    `${nombre}-cresteria`,
    new THREE.BoxGeometry(ancho * 0.2, alto * 1.6, ancho * 0.06),
    [x, arriba + alto * 3, z],
    gris,
  );
}

// ── 1. La plaza y la plancha doble ──────────────────────────────────────────────────────────────────────────────
solido("plaza", [13.25, -0.5, 0], [40.5, 1, 6.4]);
costados("plaza", -7, 5.6);
// La plancha doble frente a la muralla: una placa a cada lado de la entrada, a 2 m una de otra
pieza("planchas", "doble", [4.4, Y0 + 0.06, 0], [0.8, 0.12, 3.6], { peso: 15 });
muralla("muralla-1", 6.0, 3.4);
solido("entrada", [6.0, Y0 + 1.3, 0], [0.5, 2.6, 1.6], { cuerpo: "cinematico", material: "honda" });
// Dos estelas viejas en la plaza, de adorno (chocan)
solido("estela-vieja-1", [-2.2, Y0 + 1.4, -2.6], [0.8, 2.8, 0.5], { material: "lejana" });
solido("estela-vieja-2", [1.6, Y0 + 1.1, -2.7], [0.7, 2.2, 0.45], { material: "lejana" });

// ── 2. El patio de la estela ────────────────────────────────────────────────────────────────────────────────────
costados("patio", 6.4, 15.6);
// La estela gira hacia la izquierda vista desde arriba: su frente (el glifo del sol, hacia la cámara) tiene que
// quedar mirando la reja (+x). Las varas a 1 m del piso, hasta 1.5 m del eje
pieza("estela", "estela", [11.5, Y0 + 1.5, 0], [0.8, 3, 0.6], { angulo: 90, brazo: 1.5, altura: 1.0, masa: 40 });
muralla("muralla-2", 16.0, 3.4);
solido("reja", [16.0, Y0 + 1.3, 0], [0.5, 2.6, 1.6], { cuerpo: "cinematico", material: "honda" });
// El glifo del sol arriba de la reja: el mismo que el de la estela
{
  const sol = [new THREE.TorusGeometry(0.32, 0.06, 6, 18)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    sol.push(new THREE.BoxGeometry(0.07, 0.17, 0.05).rotateZ(a).translate(Math.sin(a) * 0.5, -Math.cos(a) * 0.5, 0));
  }
  sol.push(new THREE.SphereGeometry(0.13, 8, 6));
  for (const [i, g] of sol.entries())
    imagen(`glifo-sol-${i + 1}`, g.rotateY(-Math.PI / 2), [15.56, Y0 + 3.0, 0], 0x4a4a46);
}

// ── 3. El juego de pelota ───────────────────────────────────────────────────────────────────────────────────────
costados("cancha", 16.4, 29.6, Y0, 2.4);
// Las banquetas inclinadas de la cancha, atrás y adelante (adelante bajita)
solido("banqueta-atras", [23, Y0 + 0.35, -2.85], [13.2, 0.7, 0.7], { material: "lejana" });
solido("banqueta-adelante", [23, Y0 + 0.2, 2.95], [13.2, 0.4, 0.5], { material: "lejana" });
// Los tres marcadores en el piso de la cancha (de adorno)
for (const [i, x] of [18.5, 23, 27.5].entries()) {
  imagen(`marcador-${i + 1}`, new THREE.CylinderGeometry(0.38, 0.38, 0.03, 20), [x, Y0 + 0.015, 0.6], 0x5a5a56);
}
// El aro, de pie sobre su poste, mirando hacia la cámara: la pelota pasa de adelante (+z) hacia atrás (−z). Choca
// con su forma de verdad (`forma: malla`), así la pelota que le pega al borde rebota
const ARO = { x: 23, y: 2.05, z: -1.15, radio: 0.62, grueso: 0.12 };
{
  const aro = new THREE.Mesh(new THREE.TorusGeometry(ARO.radio, ARO.grueso, 10, 28));
  aro.name = "aro";
  aro.position.set(ARO.x, ARO.y, ARO.z);
  aro.userData = { tipo: "solido", forma: "malla", material: "lejana" };
  escena.add(aro);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, ARO.y - ARO.radio, 12));
  poste.name = "poste-aro";
  poste.position.set(ARO.x, Y0 + (ARO.y - ARO.radio) / 2, ARO.z);
  poste.userData = { tipo: "solido", forma: "cilindro", material: "lejana" };
  escena.add(poste);
}
// El soporte de la pelota, frente al aro: se agarra, se retrocede un poco, se salta y se suelta
solido("soporte-pelota", [ARO.x, Y0 + 0.42, 0.6], [0.2, 0.84, 0.2], { material: "honda" });
pieza("pelota", "pelota", [ARO.x, Y0 + 0.84 + 0.22, 0.6], [0.44, 0.44, 0.44], { masa: 1.5, rebote: 0.6 });
muralla("muralla-3", 30.0, 3.4);
solido("porton", [30.0, Y0 + 1.3, 0], [0.5, 2.6, 1.6], { cuerpo: "cinematico", material: "honda" });

// ── 4. La escalinata y el bloque ────────────────────────────────────────────────────────────────────────────────
costados("pie", 30.4, 33.5);
// El altar con el bloque, a la altura de las manos
solido("altar", [31.95, Y0 + 0.375, 0], [0.4, 0.75, 0.4], { material: "honda" });
pieza("bloque", "bloque", [31.95, Y0 + 0.75 + 0.25, 0], [0.5, 0.5, 0.6], { masa: 9 });
// Cinco gradas de 30 cm (se suben caminando, con el bloque entre los dos) y la terraza
const GRADA = { alto: 0.3, fondo: 0.8, desde: 33.5 };
for (let k = 1; k <= 5; k++) {
  const x0 = GRADA.desde + GRADA.fondo * (k - 1);
  const arriba = Y0 + GRADA.alto * k;
  solido(`grada-${k}`, [x0 + GRADA.fondo / 2, (arriba - 1) / 2, 0], [GRADA.fondo, arriba + 1, 6.4], {
    material: k % 2 ? "suelo" : "lejana",
  });
  costados(`grada-${k}`, x0, x0 + GRADA.fondo, arriba, 1.2);
}
solido("terraza", [39.5, (Y1 - 1) / 2, 0], [4, Y1 + 1, 6.4]);
costados("terraza", 37.5, 41.5, Y1);
// El pie del templo: 2.3 m más arriba que la terraza (más de lo que se trepa). Del lado de la cámara (z > 1.2) la
// cara se mete 2.3 m: así la cámara no choca con el templo cuando los dos están al pie
solido("templo", [52.15, (Y2 - 1) / 2, -1], [20.7, Y2 + 1, 4.4]);
solido("templo-adelante", [53.3, (Y2 - 1) / 2, 2.2], [18.4, Y2 + 1, 2]);
solido("templo-cara", [41.65, (Y2 - 1) / 2, -1], [0.3, Y2 + 1, 4.4], { material: "tela" });
solido("templo-cara-lado", [42.95, (Y2 - 1) / 2, 1.35], [2.3, Y2 + 1, 0.3], { material: "tela" });
solido("templo-cara-2", [43.95, (Y2 - 1) / 2, 2.35], [0.3, Y2 + 1, 2.3], { material: "tela" });
solido("terraza-rincon", [42.65, (Y1 - 1) / 2, 2.35], [2.3, Y1 + 1, 2.3]);
solido("rincon-adelante", [42.65, Y1 + 0.45, 3.35], [2.3, 0.9, 0.3], { material: "tela" });
baranda("rincon-adelante", [42.65, Y1 + 1.5, 3.35], [2.3, 3, 0.3]);

// ── 5. El túnel de los murciélagos ──────────────────────────────────────────────────────────────────────────────
costados("templo-frente", 44.1, 46, Y2, 1.2);
// El fuego (brasero) con la antorcha al lado, y la llave de jade en su pedestal
// El brasero es alto (1.5 m): la antorcha apagada se vuelve a prender acercándole la llama. La antorcha, parada
// en su poste con el travesaño a la altura de las manos (a lo ancho, para agarrarla de frente con las dos)
solido("brasero", [44.75, Y2 + 0.75, -1.45], [0.5, 1.5, 0.5], { forma: "cilindro", material: "honda" });
solido("soporte-antorcha", [44.2, Y2 + 0.35, -0.95], [0.18, 0.7, 0.18], { material: "honda" });
pieza("antorcha", "antorcha", [44.2, Y2 + 0.7 + 0.65, -0.95], [0.5, 1.3, 0.1], { masa: 1.2 }, Math.PI / 2);
solido("pedestal-llave", [44.7, Y2 + 0.4, 1.2], [0.3, 0.8, 0.3], { material: "honda" });
pieza("llave", "llave", [44.7, Y2 + 0.8 + 0.2, 1.2], [0.36, 0.4, 0.06], { masa: 0.8 }, Math.PI / 2);
// El túnel: de 46 a 55, 3 m de ancho y 2.6 de alto. Atrás el muro del templo (alto: arriba está la crestería),
// adelante un parapeto bajo (no le tapa la cámara); arriba, dinteles (de ellos cuelgan los murciélagos) y un
// techo que tapa solo la mitad de atrás
const TUNEL = { x0: 46, x1: 55, z0: -1.5, z1: 1.5, alto: 2.6 };
{
  const { x0, x1, z0, z1, alto } = TUNEL;
  // Piedra clara: los murciélagos, oscuros, se leen encima
  solido("tunel-atras", [(x0 + x1) / 2, Y2 + 2.25, z0 - 0.5], [x1 - x0 + 0.8, 4.5, 1], { material: "lejana" });
  solido("tunel-adelante", [(x0 + x1) / 2, Y2 + 0.45, (z1 + 3.5) / 2], [x1 - x0, 0.9, 3.5 - z1], { material: "tela" });
  baranda("tunel-adelante", [(x0 + x1) / 2, Y2 + alto / 2, z1 + 0.1], [x1 - x0, alto, 0.2]);
  solido("tunel-techo", [(x0 + x1) / 2, Y2 + alto + 0.2, (z0 - 0.2) / 2 - 0.25], [x1 - x0, 0.4, -z0 + 0.7], {
    material: "tela",
  });
  for (const [i, x] of [47.5, 50.5, 53.5].entries()) {
    solido(`dintel-${i + 1}`, [x, Y2 + alto + 0.15, 0.25], [0.4, 0.3, 3.5], { material: "tela" });
  }
  // La boca del túnel: el marco de piedra, y el piso oscuro de adentro (de adorno)
  solido("boca-atras", [x0 + 0.2, Y2 + 2.25, -2.6], [0.4, 4.5, 1.2], { material: "tela" });
  imagen("piso-tunel", new THREE.BoxGeometry(x1 - x0, 0.01, z1 - z0), [(x0 + x1) / 2, Y2 + 0.006, 0], 0x33332f);
  pieza("murcielagos", "murcielagos", [(x0 + x1) / 2, Y2 + alto / 2, 0], [x1 - x0, alto, z1 - z0], { perchas: 3 });
  // La puerta de jade, al fondo, con su cerradura labrada al medio (la llave entra ahí)
  solido("puerta-jade", [x1 + 0.15, Y2 + 1.3, 0], [0.3, 2.6, z1 - z0], { cuerpo: "cinematico", material: "tela" });
  solido("puerta-marco-atras", [x1 + 0.15, Y2 + 2.25, -2.3], [0.5, 4.5, 1.6], { material: "tela" });
  solido("puerta-marco-adelante", [x1 + 0.15, Y2 + 0.45, 2.5], [0.5, 0.9, 2], { material: "tela" });
  baranda("puerta-marco-adelante", [x1 + 0.15, Y2 + 1.5, 2.5], [0.5, 3, 2]);
}

// ── 6. La tumba y el contrapeso ─────────────────────────────────────────────────────────────────────────────────
costados("tumba", 55.4, 62.5, Y2, 3.2);
solido("tumba-fondo", [62.65, Y2 + 1.6, 0], [0.3, 3.2, 6.4], { material: "tela" });
// El plato del contrapeso (una plancha) y, enfrente, las dos piedras en su repisa
pieza("plato", "plancha", [57.6, Y2 + 0.06, 2.1], [1.2, 0.12, 1.2], { peso: 8 });
solido("repisa", [56.9, Y2 + 0.375, -2.55], [1.6, 0.75, 0.5], { material: "honda" });
pieza("piedra-1", "bloque", [56.4, Y2 + 0.75 + 0.175, -2.45], [0.35, 0.35, 0.35], { masa: 4 });
pieza("piedra-2", "bloque", [57.4, Y2 + 0.75 + 0.175, -2.45], [0.35, 0.35, 0.35], { masa: 4 });
// La losa de la tumba, que sube con el contrapeso, y la viga de la polea encima
solido("losa", [59.4, Y2 + 1.5, 0], [0.35, 3, 3], { cuerpo: "cinematico", material: "tela" });
solido("losa-marco-atras", [59.4, Y2 + 1.6, -2.3], [0.5, 3.2, 1.6], { material: "tela" });
solido("losa-marco-adelante", [59.4, Y2 + 0.45, 2.5], [0.5, 0.9, 2], { material: "tela" });
baranda("losa-marco-adelante", [59.4, Y2 + 1.6, 2.5], [0.5, 3.2, 2]);
solido("viga", [58.4, Y2 + 3.5, 1.9], [2.6, 0.2, 0.2], { material: "corteza" });
// El sarcófago, adentro (de adorno, pero choca)
solido("sarcofago", [61.6, Y2 + 0.45, -1.4], [1.2, 0.9, 1.8], { material: "lejana" });

// ── El secreto: la guacamaya dorada en lo alto del templo ───────────────────────────────────────────────────────
// Tres escalones de piedra labrada de 1.5 m junto a la boca del túnel; arriba, el muro del templo y la crestería
for (const [i, [x, hasta]] of [
  [43.4, 1.5],
  [44.6, 3.0],
  [45.8, 4.5],
].entries()) {
  solido(`escalon-${i + 1}`, [x, Y2 + hasta / 2, -2.6], [1.2, hasta, 0.9], { material: "tela" });
}
solido("cresteria", [52.5, Y2 + 4.5 + 1.2, -2.35], [6, 2.4, 0.3], { material: "tela" });
vacio("secreto", [48.4, Y2 + 4.5 + 0.45, -2.1], [0.5, 0.4, 0.45], { tipo: "secreto" }, 0);

// ── Salidas y puntos de control (zonas de 1 × 2 × 6 m, rotadas para mirar hacia +x) ───────────────────────────────
// Cada uno derecho hacia su placa
vacio("salida-rojo", [-4.5, Y0, 1.4], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-4.5, Y0, -1.4], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [8.0, Y0 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 1 });
vacio("control-2", [17.8, Y0 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 2 });
vacio("control-3", [31.35, Y0 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 3 });
vacio("control-4", [42.9, Y2 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 4 });
vacio("control-5", [56.3, Y2 + 1, 0], [3, 1, 0.5], { tipo: "control", orden: 5 });
vacio("control-6", [61.0, Y2 + 1, 0.9], [1.5, 1, 0.6], { tipo: "control", orden: 6 });

// ── Adornos ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Las pirámides de lejos, entre la niebla, y las ceibas de la selva
piramide("piramide-1", [16, -1, -17], 22, 8, 1.9, 0x8a8a86);
piramide("piramide-2", [50, -1, -22], 26, 9, 2.1, 0x90908c);
piramide("piramide-3", [-8, -1, -24], 16, 6, 1.8, 0x96968f);
ceiba("ceiba-1", [-4, -1, -8], 13, 0x5e5e5b);
ceiba("ceiba-2", [33, -1, -10], 15, 0x6a6a66);
ceiba("ceiba-3", [64, -1, -9], 14, 0x666662);
ceiba("ceiba-4", [27, -1, -28], 16, 0x9a9a95);
const matas = [
  [-6, Y0, 2.6, 1.1],
  [-0.5, Y0, -2.7, 0.9],
  [3.0, Y0, 2.7, 0.8],
  [9, Y0, -2.8, 1],
  [14, Y0, 2.7, 0.9],
  [19, Y0, 2.6, 0.7],
  [28.6, Y0, -2.5, 0.9],
  [31, Y0, 2.6, 1],
  [39, Y1, -2.7, 0.9],
  [43, Y2, 2.7, 0.8],
  [57.5, Y2, -1.0, 0.6],
];
for (const [i, [x, y, z, alto]] of matas.entries()) {
  vacio(`mata-${i + 1}`, [x, y, z], [1, 1, 1], { tipo: "adorno", forma: "mata", alto, semilla: 60 + i }, 0);
}
// Guacamayas por todas partes: sobre la plaza, sobre la cancha y sobre el templo
pieza("guacamayas-plaza", "guacamayas", [4, 8.5, -5], [22, 3, 9], { cuantas: 4 });
pieza("guacamayas-cancha", "guacamayas", [24, 9, -6], [18, 3, 10], { cuantas: 3 });
pieza("guacamayas-templo", "guacamayas", [50, 13, -7], [26, 4, 12], { cuantas: 5 });

// Niebla: capas entre la plaza y las pirámides, y el humo frío del túnel
vacio("niebla-1", [6, 1.5, -6], [16, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.12 }, 0);
vacio("niebla-2", [30, 3, -7], [18, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.1 }, 0);
vacio("niebla-3", [14, 3, -12], [24, 6, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.16 }, 0);
vacio("niebla-4", [48, 6, -12], [24, 6, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.14 }, 0);
vacio("niebla-5", [26, 5, -20], [40, 10, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.2 }, 0);

await exportar("04-xibalba");
