// Lo que comparten los niveles que se arman sin Blender (pnpm niveles): three del juego, su GLTFExporter y las
// formas de siempre, con las mismas propiedades (`extras`) que pondría Blender. La convención está en
// niveles/README.md.
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const raiz = join(dirname(fileURLToPath(import.meta.url)), "../..");
// three es del juego: se busca desde apps/juego, con su versión de módulos (la misma que importa el exportador)
const carpetaThree = join(raiz, "apps/juego/node_modules/three");
export const THREE = await import(pathToFileURL(join(carpetaThree, "build/three.module.js")).href);
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

/** Una escena nueva con sus propiedades (Scene Properties de Blender) y cómo ponerle cosas. */
export function crearEscena(propiedades) {
  const escena = new THREE.Scene();
  escena.userData = propiedades;
  const gris = new THREE.MeshStandardMaterial({ color: 0x808080 });

  /** Una caja: centro, medidas y propiedades. */
  function caja(nombre, [x, y, z], [ancho, alto, fondo], extras = {}, rumbo = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), gris);
    m.name = nombre;
    m.position.set(x, y, z);
    m.rotation.y = rumbo;
    m.userData = extras;
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
  /** Exporta la escena a niveles/<carpeta>/escena.glb. */
  async function exportar(carpeta) {
    const glb = await new GLTFExporter().parseAsync(escena, { binary: true });
    const destino = join(raiz, "niveles", carpeta, "escena.glb");
    await writeFile(destino, Buffer.from(glb));
    console.log(`listo: ${destino} (${glb.byteLength} bytes)`);
  }
  return {
    escena,
    exportar,
    vacio,
    /** Un sólido de caja. */
    solido: (nombre, centro, medidas, extras = {}) => caja(nombre, centro, medidas, { tipo: "solido", ...extras }),
    /** Una pieza de juego (TU-12): su caja dice dónde va y cuánto mide. */
    pieza: (nombre, cual, centro, medidas, extras = {}, rumbo = 0) =>
      caja(nombre, centro, medidas, { tipo: "pieza", pieza: cual, ...extras }, rumbo),
  };
}
