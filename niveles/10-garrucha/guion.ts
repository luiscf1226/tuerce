// El guion del nivel 10, La garrucha (TU-43). Lo que la escena no puede decir:
//   · Los bordes invisibles del lado de la cámara solo atajan a los muñecos: así la cámara no los ve como paredes y
//     no se pega a los dos (con las palmas y los cañones, la cámara queda alta y lejos).
//   · El logro, «En una pata»: ganarle la carrera a La Patasola (llegar a la meta antes que ella).
//   · Al retomar, la canasta en la estación de abajo, La Patasola esperando en la salida, la chiva donde debe (en la
//     bodega antes del punto 3, en la otra loma después) y las maneas abajo.
//   · Las palmas de cera del paisaje, las montañas del fondo (en siluetas y grises: las «montañas verdes»), unos
//     guaduales y la orquídea del secreto, en lo alto de la palma más alta (la zona `secreto` del .glb la encuentra
//     sola), se dibujan acá.
// Lo que cae al vacío vuelve solo a su lugar (lo hacen las piezas); la carga de la chiva también.

import type { GuionDeNivel } from "../../apps/juego/src/niveles/guion";
import { adornarCafetal, SOLO_MUNECOS } from "../../apps/juego/src/niveles/piezas-garrucha";

/** La finca, la loma y lo alto, y lo que va corrido el nivel en x (para caber en la foto de la red), como en
 * scripts/niveles/garrucha.mjs: las x de abajo son las de antes de correrlo. */
export const G = 0.3;
export const G2 = 2.3;
export const D = 8.3;
export const DX = -52;
/** La orquídea, en el nido de lo alto de la palma más alta. */
const ORQUIDEA = { x: DX + 106.9, y: D + 5, z: 0 };
/** Las palmas de cera del paisaje: x, z, la altura del pie (abajo, en la niebla) y lo alto. Ninguna llega tan alto
 * como la del secreto (16.3 m). */
const PALMAS: readonly (readonly [number, number, number, number])[] = [
  [-5, -6.5, -6, 17.3],
  [3, -8, -6, 19.3],
  [9, -5.5, -6, 15.3],
  [15, -9, -6, 18.0],
  [22, -7, -6, 17.0],
  [30, -6, -6, 19.3],
  [37, -8.5, -6, 20.8],
  [45, -6.2, -6, 18.3],
  [52, -9, -6, 21.3],
  [58, -7, -6, 19.8],
  [66, -8, -6, 19.3],
  [74, -6.5, -6, 18.3],
  [83, -6, -6, 19.3],
  [91, -8.5, -6, 20.0],
  [99, -6, -6, 20.8],
  [104, -8, -6, 21.3],
  [110, -6.5, -6, 20.3],
];
/** Las montañas del fondo: x, z, alto, ancho. */
const MONTANAS: readonly (readonly [number, number, number, number])[] = [
  [-10, -26, 16, 22],
  [12, -30, 22, 28],
  [35, -24, 14, 20],
  [58, -32, 24, 30],
  [80, -25, 15, 22],
  [104, -30, 20, 26],
  [124, -26, 14, 20],
];
/** Los guaduales: x, z, la altura del pie y cuántas guaduas. */
const GUADUALES: readonly (readonly [number, number, number, number])[] = [
  [-1, -4.6, G, 9],
  [24, 4.8, G2 - 1, 7],
  [56, 4.6, G2, 8],
  [84, 4.6, G2, 7],
];

export function crearGuion(): GuionDeNivel {
  return {
    alEmpezar(nivel) {
      // Los bordes del lado de la cámara: solo para los muñecos
      for (const nombre of ["borde-finca", "borde-loma", "borde-otra-loma", "borde-orilla"])
        nivel.pieza(nombre).colisionador.setCollisionGroups(SOLO_MUNECOS);
      // El logro: ganarle la carrera a La Patasola
      nivel.patasola("patasola").alPerder(() => nivel.lograr());

      // La orquídea, las palmas de cera, las montañas y los guaduales
      adornarCafetal(nivel.escena, {
        dx: DX,
        madera: ["salida-carrera", "meta-carrera", "bodega"],
        oscuras: ["cable-lianas", "bulto", "rio-abajo"],
        orquidea: ORQUIDEA,
        palmas: PALMAS,
        montanas: MONTANAS,
        guaduales: GUADUALES,
      });
    },
    alRetomar(n, nivel) {
      nivel.garrucha("garrucha").volver();
      nivel.patasola("patasola").volver();
      const chiva = nivel.chiva("chiva");
      if (n >= 3) chiva.llegar();
      else {
        chiva.volver();
        chiva.carga.volver();
      }
      nivel.palma("palma").volver();
      nivel.palma("palma-alta").volver();
    },
  };
}
