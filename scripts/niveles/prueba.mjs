// pnpm niveles: arma niveles/99-prueba/escena.glb, el nivel de prueba del formato (TU-11). En esta máquina no hay
// Blender, así que la escena se arma acá con three y se exporta con su GLTFExporter, con las mismas propiedades
// (`extras`) que pondría Blender. La convención está en niveles/README.md.
//
// El recorrido, de oeste a este (+x), con la pareja mirando hacia +x:
//   el patio (salida y un huacal) → un hueco de 2.5 m con un tablón angosto → punto 1 → una compuerta que el guion
//   baja al llegar al punto 1 → un escalón de 1.5 m para trepar → punto 2 arriba → punto 3, la meta.
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "../..");
// three es del juego: se busca desde apps/juego, con su versión de módulos (la misma que importa el exportador)
const carpetaThree = join(raiz, "apps/juego/node_modules/three");
const THREE = await import(pathToFileURL(join(carpetaThree, "build/three.module.js")).href);
const { GLTFExporter } = await import(pathToFileURL(join(carpetaThree, "examples/jsm/exporters/GLTFExporter.js")).href);

// GLTFExporter lee el .glb armado con FileReader, que en Node no existe
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((r) => {
      this.result = r;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((r) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(r).toString("base64")}`;
      this.onloadend?.();
    });
  }
};

const escena = new THREE.Scene();
// Las propiedades de la escena: qué nivel es, dónde empieza el vacío y la niebla
escena.userData = { nivel: 99, nombre: "Prueba", vacio: -4, nieblaCerca: 3, nieblaLejos: 26 };
const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });

/** Un sólido de caja: centro, medidas y propiedades. */
function caja(nombre, [x, y, z], [ancho, alto, fondo], extras = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), gris);
  m.name = nombre;
  m.position.set(x, y, z);
  m.userData = { tipo: "solido", ...extras };
  escena.add(m);
  return m;
}
/** Un vacío de Blender (sin malla): su escala es la mitad de lo que mide. */
function vacio(nombre, [x, y, z], [sx, sy, sz], extras, rumbo = Math.PI / 2) {
  const o = new THREE.Object3D();
  o.name = nombre;
  o.position.set(x, y, z);
  o.rotation.y = rumbo;
  o.scale.set(sx, sy, sz);
  o.userData = extras;
  escena.add(o);
  return o;
}

// El suelo: tres tramos, de arriba en y = 0, y el escalón de 1.5 m al final
caja("patio", [0, -0.5, 0], [12, 1, 6]);
caja("tablon", [7.25, -0.1, 0], [3, 0.2, 0.6], { material: "corteza" });
caja("orilla", [12, -0.5, 0], [7, 1, 6]);
caja("escalon", [19.75, 0.25, 0], [8.5, 2.5, 6], { material: "tela" });
// Un huacal de 8 kg para cargar entre los dos y la compuerta, que el guion baja
caja("huacal", [-1, 0.3, 1.8], [0.6, 0.6, 0.6], { cuerpo: "dinamico", masa: 8, material: "corteza", rozamiento: 0.7 });
caja("compuerta", [12.5, 1, 0], [0.3, 2, 6], { cuerpo: "cinematico", material: "tela" });

// Las salidas y los puntos de control (zonas de 1 × 2 × 6 m, rotadas para mirar hacia +x)
vacio("salida-rojo", [-4, 0, 0.5], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-4, 0, -0.5], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [10, 1, 0], [3, 1, 0.5], { tipo: "control", orden: 1 });
vacio("control-2", [17, 2.5, 0], [3, 1, 0.5], { tipo: "control", orden: 2 });
vacio("control-3", [22.5, 2.5, 0], [3, 1, 0.5], { tipo: "control", orden: 3 });
// El fondo del hueco: cuenta como caída antes de llegar a la altura del vacío
vacio("hueco", [7.25, -2.5, 0], [1.2, 1.5, 3], { tipo: "vacio" }, 0);

// Adornos: pinos que suben del vacío, abetos al fondo, rocas y matas en los bordes
const pinos = [
  [-5, -4.5, 0.36],
  [3, -5.5, 0.4],
  [9, -4.2, 0.34],
  [14, -6, 0.42],
  [21, -4.8, 0.38],
  [-1, -9, 0.4],
  [7, -11, 0.42],
  [17, -10, 0.4],
  [25, -9, 0.44],
  [5.5, 4.5, 0.3],
];
for (const [i, [x, z, radio]] of pinos.entries()) {
  vacio(`pino-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "pino", alto: 24, radio, semilla: 40 + i }, 0);
}
for (let i = 0; i < 14; i++) {
  const x = -8 + i * 2.6;
  const z = -13 - (i % 3) * 3;
  vacio(`abeto-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "abeto", alto: 9 + (i % 4) * 1.5 }, 0);
}
vacio("roca-1", [-2.5, -0.05, -2.2], [1, 1, 1], { tipo: "adorno", forma: "roca", radio: 0.4, semilla: 71 }, 0);
vacio("roca-2", [13.8, -0.05, 2.3], [1, 1, 1], { tipo: "adorno", forma: "roca", radio: 0.5, semilla: 72 }, 0);
vacio("mata-1", [3.5, 0, -2.4], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.7, semilla: 11 }, 0);
vacio("mata-2", [-5.2, 0, 2.3], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 1, semilla: 12 }, 0);
vacio("mata-3", [16.5, 1.5, -2.3], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.8, semilla: 13 }, 0);
vacio(
  "tronco-1",
  [1.5, 0.2, -2.6],
  [1, 1, 1],
  { tipo: "adorno", forma: "tronco", alto: 5, radio: 0.22, semilla: 5 },
  0.15,
);

// Niebla: el vapor que sube del hueco y capas entre los pinos
vacio("niebla-hueco", [7.25, -1.5, 0], [6, 1.5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.1 }, 0);
vacio("niebla-1", [6, 0.5, -5], [12, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [8, 2, -9], [16, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-3", [10, 3, -14], [22, 8, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

const glb = await new GLTFExporter().parseAsync(escena, { binary: true });
const destino = join(raiz, "niveles/99-prueba/escena.glb");
await writeFile(destino, Buffer.from(glb));
console.log(`listo: ${destino} (${glb.byteLength} bytes)`);
