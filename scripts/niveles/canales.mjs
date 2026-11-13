// pnpm niveles: arma niveles/09-canales/escena.glb, el nivel 9 (TU-42): Los canales de Xochimilco (México). Canales,
// chinampas con flores, trajineras (sin color: siluetas y grises) y una feria. Como los otros, sin Blender: las mismas
// propiedades (`extras`) que se pondrían en Blender. La convención está en niveles/README.md; el agua es la de La poza.
//
// El recorrido va de oeste a este (+x), con la pareja mirando hacia +x. El agua está en y = 0 (en el canal de la
// Llorona, hasta 0.25 mientras llora), las chinampas de los dos primeros tramos en 0.55 y la tierra del resto en 0.3.
// Todo va corrido 45 m hacia −x (`DX`), para que quepa en la foto de la red. Cada misión termina en un punto de control:
//   1. la trajinera, de a dos: amarrada al muelle, en un canal angosto con corriente en contra. Cada uno empuja con la
//      pértiga de su lado, de pie en la popa; con una sola no le gana a la corriente y se tuerce → punto 1, en la
//      chinampa de La Llorona
//   2. La Llorona llora tanto que el canal está crecido: el arco de la trajinera no pasa bajo el puente. Se ríe de los
//      porrazos: tirándose de la tarima de los mariachis delante de ella, a la tercera carcajada deja de llorar y baja
//      el agua. La trajinera pasa bajo el puente hasta el embarcadero → punto 2
//   3. las chinampas flotantes de la ciénaga, que se hunden con el que se para encima: se cruzan saltando de una en
//      una, sin quedarse → punto 3, a la entrada de la feria
//   4. la piñata, de a dos: cuelga alta entre dos postes; uno jala la soga (la manija está lejos de la piñata) y el
//      otro le pega. Rota, se abre la reja del embarcadero de las flores → punto 4
//   5. la trajinera de las flores, entre las chinampas, hasta el embarcadero de la feria: cada golpe fuerte bota una
//      flor → punto 5, la meta. Llegar con todas da el logro, «Ni una flor menos»
// El secreto: un alebrije dormido en una chinampa de la ciénaga, a un salto del camino.
import { crearEscena, THREE } from "./comun.mjs";

const { escena, solido, pieza, vacio, exportar } = crearEscena({
  nivel: 9,
  nombre: "Los canales",
  vacio: -3.5,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

/** El agua, el agua crecida por el llanto de La Llorona, las chinampas altas (1 y 2) y la tierra de lo demás. */
const AGUA = 0;
const CRECIDA = 0.25;
const GC = 0.55;
const G = 0.3;
/** Al final, todo se corre `DX` en x: la foto de la red mide las posiciones en int16 desde el origen (±64 m, ver
 * src/red/paquetes.ts) y el nivel mide 104 m. Las coordenadas de abajo son las de antes de correrlo; el guion y las
 * pruebas usan las mismas, más `DX`. */
const DX = -45;
/** El fondo de los canales. */
const FONDO = -2;

/** Una zona de agua: de x0 a x1 y de z0 a z1, del fondo a la superficie; corre hacia −x. */
function agua(nombre, x0, x1, z0, z1, superficie, extras = {}) {
  vacio(
    nombre,
    [(x0 + x1) / 2, (FONDO + superficie) / 2, (z0 + z1) / 2],
    [(z1 - z0) / 2, (superficie - FONDO) / 2, (x1 - x0) / 2],
    { tipo: "agua", arrastre: 1.5, ...extras },
    -Math.PI / 2,
  );
}

/** Un sólido entre dos esquinas (x0, y0, z0) y (x1, y1, z1). */
function bloque(nombre, [x0, y0, z0], [x1, y1, z1], extras = {}) {
  return solido(nombre, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], extras);
}

/** Algo que solo se ve (sin `tipo`): una malla con su forma, del gris de las siluetas (COLORES.silueta). */
const silueta = new THREE.MeshStandardMaterial({ color: 0x3c3c3c, roughness: 1, metalness: 0 });
function imagen(nombre, geometria, [x, y, z]) {
  const m = new THREE.Mesh(geometria, silueta);
  m.name = nombre;
  m.position.set(x, y, z);
  escena.add(m);
}

/** Un adorno de la escena (no choca). */
function adorno(nombre, [x, y, z], extras, rumbo = 0) {
  vacio(nombre, [x, y, z], [1, 1, 1], { tipo: "adorno", ...extras }, rumbo);
}

// ── 1. El muelle de salida y el canal ──────────────────────────────────────────────────────────────────────────
bloque("chinampa-salida", [-7, FONDO, -3.2], [-1.5, GC, 3.2]);
bloque("muelle-salida", [-1.5, FONDO, -3.2], [0, GC, 3.2], { material: "corteza" });
// La trajinera, amarrada con la popa contra el muelle, en el carril del fondo; flota con el piso a la altura del muelle
pieza("trajinera", "trajinera", [3.05, CRECIDA + 0.14, -1.6], [6, 0.3, 1.9], { masa: 80, pertiga: 72, lado: 0.7 });
// El canal: con corriente en contra hasta la mitad (0.6 m/s hacia −x) y quieto después, crecido por el llanto
agua("canal", 0, 13, -2.8, 3.2, CRECIDA, { corriente: 0.6 });
agua("remanso", 13, 31, -2.8, 3.2, CRECIDA);
bloque("lecho-canal", [0, FONDO - 0.6, -3.2], [31, FONDO, 3.2], { material: "honda" });
// La orilla del fondo: una chinampa larga con una cerca de ahuejotes que no deja bajarse (invisible)
bloque("bordo-atras", [0, FONDO, -4.4], [31, GC, -2.8]);
bloque("cerca-atras", [0, GC, -3.1], [31, GC + 3, -2.8], { invisible: 1 });
// Del lado de acá, la chinampa de las flores, que deja el carril del fondo justo para la trajinera (2.4 m)
bloque("chinampa-flores", [2.5, FONDO, -0.4], [14.5, GC, 3.2]);

// ── 2. La chinampa de La Llorona, el puente y el embarcadero ───────────────────────────────────────────────────
bloque("chinampa-llorona", [17, FONDO, -0.4], [29, GC, 3.2]);
// La tarima de los mariachis: 1.5 m, se trepa colgándose; del otro lado, el porrazo queda delante de La Llorona
bloque("tarima", [20.5, GC, 0.3], [22, GC + 1.5, 2.5], { material: "corteza" });
pieza("llorona", "llorona", [24.6, GC + 1.1, 1.4], [0.8, 2.2, 0.8], { risas: 3, olvido: 20, publico: 6 }, -Math.PI / 2);
// El puente: su viga baja sobre el carril (con el canal crecido, el arco de la trajinera choca contra ella). Se ven
// sus pilares en las dos orillas, las barandas y la escalera que baja a la chinampa
bloque("puente", [26.6, 2.5, -3.3], [27.8, 2.85, -0.4], { material: "corteza" });
for (const [i, z] of [-3.05, -0.15].entries())
  bloque(`pilar-puente-${i + 1}`, [26.75, GC, z - 0.2], [27.65, 2.5, z + 0.2], { material: "corteza" });
imagen(
  "barandas-del-puente",
  (() => {
    const partes = [];
    for (const x of [26.65, 27.75]) {
      const pasamanos = new THREE.BoxGeometry(0.06, 0.06, 3.3).translate(x, 3.55, -1.65);
      partes.push(pasamanos);
      for (let k = 0; k <= 6; k++)
        partes.push(new THREE.BoxGeometry(0.05, 0.7, 0.05).translate(x, 3.2, -3.3 + k * 0.55));
    }
    // La escalera que baja a la chinampa de La Llorona (se ve; no se sube)
    for (let k = 0; k < 8; k++)
      partes.push(new THREE.BoxGeometry(1.1, 0.06, 0.28).translate(27.2, 2.75 - k * 0.27, 0.15 + k * 0.28));
    const g = new THREE.BufferGeometry();
    // Junta las partes a mano (sin el BufferGeometryUtils de three en Node)
    let total = 0;
    const listas = partes.map((p) => p.toNonIndexed());
    for (const p of listas) total += p.getAttribute("position").count;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    let k = 0;
    for (const p of listas) {
      pos.set(p.getAttribute("position").array, k * 3);
      nor.set(p.getAttribute("normal").array, k * 3);
      k += p.getAttribute("position").count;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    return g;
  })(),
  [0, 0, 0],
);
bloque("embarcadero-cienaga", [31, FONDO, -3.2], [35, G, 3.2], { material: "corteza" });

// ── 3. La ciénaga de las chinampas flotantes ───────────────────────────────────────────────────────────────────
agua("cienaga", 35, 45.7, -3.2, 3.2, AGUA, { arrastre: 2 });
bloque("lecho-cienaga", [35, FONDO - 0.6, -3.2], [45.7, FONDO, 3.2], { material: "honda" });
// Cinco chinampas de 1.3 m, con 70 cm de agua entre una y otra (se saltan caminando)
for (const [i, [x, z]] of [
  [36.35, 0.2],
  [38.35, -0.25],
  [40.35, 0.25],
  [42.35, -0.2],
  [44.35, 0.2],
].entries()) {
  pieza(`chinampa-${i + 1}`, "chinampa", [x, G - 0.4, z], [1.3, 0.8, 1.5], { hundir: 0.3, aguante: 0.25, subir: 0.2 });
}
// La chinampa del alebrije: firme, a un salto (hacia el fondo) de la segunda
bloque("chinampa-alebrije", [37.6, FONDO, -3.2], [39.1, G, -1.75]);
vacio("secreto", [38.35, G + 0.5, -2.45], [0.7, 0.5, 0.6], { tipo: "secreto" }, 0);

// ── 4. La feria y la piñata ────────────────────────────────────────────────────────────────────────────────────
bloque("feria", [45.7, FONDO, -3.2], [62.5, G, 3.2]);
// La piñata entre dos postes (a lo ancho), con la manija junto al poste del fondo: se jala caminando hacia el este
pieza("pinata", "pinata", [54, G + 2.2, 0], [0.3, 4.4, 5.4], { soga: 2.4, baja: 2, golpes: 4, pegar: 1, fuerza: 20 });
// Los puestos de la feria, con su toldo
for (const [i, [x0, z0, x1, z1]] of [
  [47.6, 2.2, 50.2, 3.2],
  [57.2, 2.3, 59.4, 3.2],
  [48.2, -3.2, 51.2, -2.5],
].entries()) {
  bloque(`puesto-${i + 1}`, [x0, G, z0], [x1, G + 0.9, z1], { material: "corteza" });
  bloque(`toldo-${i + 1}`, [x0 - 0.1, G + 2.1, z0 - 0.15], [x1 + 0.1, G + 2.2, z1 + 0.15], { material: "tela" });
}
// La reja del embarcadero de las flores: la baja el guion cuando se rompe la piñata (3.2 m: no se trepa)
bloque("reja-feria", [59.6, G, -3.2], [59.9, G + 3.2, 3.2], { cuerpo: "cinematico", material: "honda" });
bloque("muelle-flores", [62.5, FONDO, -3.2], [64, G, 3.2], { material: "corteza" });

// ── 5. El canal de las flores y el embarcadero de la feria ─────────────────────────────────────────────────────
pieza("trajinera-flores", "trajinera", [67.05, AGUA + 0.14, -1.1], [6, 0.3, 1.9], {
  masa: 80,
  pertiga: 72,
  lado: 0.7,
  flores: 8,
  golpe: 0.4,
});
agua("remanso-flores", 64, 70, -2.8, 3.2, AGUA);
agua("canal-flores", 70, 88, -2.8, 3.2, AGUA, { corriente: 0.3 });
agua("remanso-final", 88, 92, -2.8, 3.2, AGUA);
bloque("lecho-flores", [64, FONDO - 0.6, -3.2], [92, FONDO, 3.2], { material: "honda" });
bloque("bordo-flores", [64, FONDO, -4.4], [92, GC, -2.8]);
bloque("cerca-flores", [64, GC, -3.1], [92, GC + 3, -2.8], { invisible: 1 });
// Dos chinampas de flores en el medio del canal: la primera se pasa por detrás, la segunda por delante
bloque("isla-1", [72, FONDO, 0.6], [76, GC, 3.2]);
bloque("isla-2", [83, FONDO, -2.8], [87, GC, -0.6]);
bloque("embarcadero-final", [92, FONDO, -3.2], [97, G, 3.2], { material: "corteza" });

// ── Atrás: otro canal con trajineras amarradas (se ve, no se llega) ────────────────────────────────────────────
agua("canal-de-atras", -7, 97, -9, -4.4, AGUA, { arrastre: 1 });
bloque("lecho-de-atras", [-7, FONDO - 0.6, -9], [97, FONDO, -4.4], { material: "honda" });
bloque("chinampas-lejanas", [-7, FONDO, -14], [97, G, -9], { material: "lejana" });
// Donde no llega la orilla del fondo de los canales, la tierra sigue hasta el canal de atrás
bloque("bordo-atras-salida", [-7, FONDO, -4.4], [0, GC, -3.2]);
bloque("bordo-atras-cienaga", [31, FONDO, -4.4], [64, G, -3.2]);
bloque("bordo-atras-final", [92, FONDO, -4.4], [97, G, -3.2]);

// ── Bordes: paredes invisibles del lado de la cámara (+z), del fondo de la ciénaga y la feria, y las puntas ─────
bloque("borde-frente", [-7, FONDO, 3.2], [97, GC + 3, 3.5], { invisible: 1 });
bloque("borde-atras-cienaga", [31, FONDO, -3.5], [64, G + 3, -3.2], { invisible: 1 });
bloque("borde-atras-salida", [-7, FONDO, -3.5], [0, GC + 3, -3.2], { invisible: 1 });
bloque("borde-oeste", [-7.3, FONDO, -3.2], [-7, GC + 3, 3.2], { invisible: 1 });
bloque("borde-este", [97, FONDO, -3.2], [97.3, G + 3, 3.2], { invisible: 1 });

// ── Salidas y puntos de control (zonas de vacíos rotados para mirar hacia +x: [medio z, medio alto, medio x]) ───
vacio("salida-rojo", [-3.2, GC, -1.1], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-3.2, GC, -2.1], [1, 1, 1], { tipo: "salida", jugador: 2 });
// El 1 en la chinampa de La Llorona, al bajarse de la trajinera
vacio("control-1", [18.6, GC + 1, 1.4], [1.6, 1, 0.9], { tipo: "control", orden: 1 });
vacio("control-2", [33.3, G + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 2 });
vacio("control-3", [47.6, G + 1, 0], [2.6, 1, 0.8], { tipo: "control", orden: 3 });
// El 4 detrás de la reja, en el muelle de las flores
vacio("control-4", [61.6, G + 1, 0], [2.6, 1, 0.9], { tipo: "control", orden: 4 });
// El 5, la meta, en el embarcadero de la feria
vacio("control-5", [93.6, G + 1, 0], [2.6, 1, 1], { tipo: "control", orden: 5 });

// ── Adornos: matas y rocas en las chinampas (los ahuejotes, las trajineras amarradas y la feria los pone el guion) ─
for (const [i, [x, y, z, alto]] of [
  [-6.2, GC, 2.6, 0.9],
  [-5.6, GC, -2.7, 1],
  [4.2, GC, 2.4, 0.8],
  [7.4, GC, 1.2, 1],
  [10.6, GC, 2.6, 0.9],
  [13.4, GC, 0.6, 0.8],
  [17.6, GC, 2.8, 1],
  [28.2, GC, 2.6, 0.9],
  [34.4, G, 2.7, 0.8],
  [38.9, G, -2.9, 0.5],
  [46.8, G, -2.7, 0.9],
  [73.2, GC, 2.4, 1],
  [75.2, GC, 1.4, 0.8],
  [84, GC, -1.6, 1],
  [86.2, GC, -2.3, 0.9],
  [96.2, G, 2.6, 0.9],
].entries()) {
  adorno(`mata-${i + 1}`, [x, y, z], { forma: "mata", alto, semilla: 40 + i });
}
for (const [i, [x, y, z, r]] of [
  [-6.6, GC, -1.8, 0.35],
  [29, GC, -0.2, 0.3],
  [62.8, G, 2.6, 0.35],
  [94.6, G, -2.6, 0.4],
].entries()) {
  adorno(`roca-${i + 1}`, [x, y - 0.05, z], { forma: "roca", radio: r, semilla: 70 + i });
}

// Niebla: el vapor de los canales al amanecer, y capas entre los ahuejotes
vacio("niebla-canal", [8, 0.8, 0], [8, 1.1, 1], { tipo: "niebla", opacidad: 0.4, velocidad: -0.08 }, 0);
vacio("niebla-cienaga", [41, 0.6, 0], [6, 1, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.06 }, 0);
vacio("niebla-flores", [80, 0.8, 0], [10, 1.1, 1], { tipo: "niebla", opacidad: 0.4, velocidad: -0.07 }, 0);
vacio("niebla-1", [10, 1.8, -6], [20, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.14 }, 0);
vacio("niebla-2", [50, 2.2, -6.5], [20, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: -0.12 }, 0);
vacio("niebla-3", [85, 2.2, -6.5], [16, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.1 }, 0);
vacio("niebla-4", [25, 3, -11], [32, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.16 }, 0);
vacio("niebla-5", [75, 3.5, -11], [32, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: 0.15 }, 0);
vacio("niebla-6", [45, 5, -16], [64, 9, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.2 }, 0);

for (const o of escena.children) o.position.x += DX;
await exportar("09-canales");
