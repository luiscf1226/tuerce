// Leer el .glb de un nivel. `parsearGlb` recibe los bytes (del disco en las pruebas, de la red en el navegador) y
// `cargarNivel` los baja de una dirección. Los dos devuelven el plano del nivel (ver formato.ts).
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { leerPlano, type PlanoDeNivel } from "./formato";

export async function parsearGlb(bytes: ArrayBuffer): Promise<PlanoDeNivel> {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  // Las propiedades de la escena de Blender quedan en `gltf.scene.userData` (los `extras` de la escena de glTF)
  return leerPlano(gltf.scene);
}

export async function cargarNivel(direccion: string): Promise<PlanoDeNivel> {
  const respuesta = await fetch(direccion);
  if (!respuesta.ok) throw new Error(`no se pudo bajar el nivel ${direccion}: ${respuesta.status}`);
  return parsearGlb(await respuesta.arrayBuffer());
}
