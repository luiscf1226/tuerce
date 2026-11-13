// Lo que la cámara de los dos usa para saber si algo sólido tapa a un jugador: un rayo en el mundo de físicas que
// solo ve lo quieto (suelo, paredes, escalones) y lo que se mueve por guion (una compuerta). No ve a los muñecos ni
// lo suelto (cajas, huacales, bejucos), ni las zonas (sensores): eso no tiene por qué mover la cámara.
import type RAPIER from "@dimforge/rapier3d-compat";
import type { Rapier } from "../motor/fisica";
import type { Punto } from "./camara";

/** Los grupos de choque de los muñecos son los bits 1 y 2: el rayo no los ve. */
const GRUPOS = ((1 << 16) | (0xffff & ~0b110)) >>> 0;

/** El `despejado` de `crearCamaraDeDos` para este mundo. */
export function despejadoEnElMundo(
  rapier: Rapier,
  mundo: RAPIER.World,
): (desde: Punto, hacia: Punto, largo: number) => number {
  const banderas = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  return (desde, hacia, largo) => {
    rayo.origin = { x: desde.x, y: desde.y, z: desde.z };
    rayo.dir = { x: hacia.x, y: hacia.y, z: hacia.z };
    const golpe = mundo.castRay(rayo, largo, true, banderas, GRUPOS);
    return golpe ? golpe.timeOfImpact : largo;
  };
}
