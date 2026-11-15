// El guion del nivel 14, La minga (TU-47), en Chiloé. Lo que la escena no puede decir:
//   · La marea de la caleta: bajamar, sube, pleamar y baja, siempre igual desde que empieza el nivel. Con la marea
//     alta la playa queda bajo el agua y solo se salvan los corredores de los palafitos.
//   · La tranquera del sitio nuevo se hunde en el suelo cuando la casa de la minga llega. Si llegó sin salirse nunca
//     de los troncos, el logro, «A hombro».
//   · Los palafitos (casa, techo, pilotes y corredor), los de atrás sobre el agua, el bosque mojado con sus nalcas, la
//     iglesia de madera en la loma y el curanto enterrado del secreto (la zona `secreto` del .glb lo encuentra sola)
//     se dibujan acá.
// En línea, el invitado no corre este guion: la marea le llega con el marcador del agua y la tranquera en la foto.

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { crearAbeto, crearPino, materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import { PASO } from "../../apps/juego/src/motor/bucle";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import {
  crearCuranto,
  crearIglesiaChilota,
  crearNalca,
  crearPalafito,
  type Marea,
  mareaEn,
} from "../../apps/juego/src/niveles/piezas-minga";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/minga.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -52;
/** Las alturas: la playa y lo alto (corredores, explanada y muelle). */
const ARENA = 0;
const P = 1.2;
/** La marea de la caleta (m y s): diez segundos seca, tres subiendo, seis tapada y tres bajando. */
export const MAREA: Marea = { baja: -0.4, alta: 0.9, enBaja: 10, subiendo: 3, enAlta: 6, bajando: 3 };
/** Los palafitos de la playa, donde se espera la bajamar: de dónde a dónde va su corredor en x. */
export const PALAFITOS = [
  { x0: 8.6, x1: 13.6 },
  { x0: 22, x1: 27 },
] as const;
/** La tranquera: cuánto baja (m) y en cuántos pasos. */
const TRANQUERA = { bajar: 2.7, pasos: 90 };
/** El curanto del secreto. */
const CURANTO = { x: DX + 33, z: -2.55 };
/** Los palafitos de atrás, sobre el agua de la caleta: x del medio, largo, alto y qué gris. */
const DE_ATRAS: readonly (readonly [number, number, number, number])[] = [
  [3.5, 4.4, 2.6, COLORES.siluetaLejana],
  [9, 5, 3, COLORES.silueta],
  [15, 4.2, 2.4, COLORES.siluetaHonda],
  [20.5, 5.4, 2.8, COLORES.siluetaLejana],
  [27, 4.6, 2.6, COLORES.silueta],
  [33.5, 5.2, 3.1, COLORES.siluetaLejana],
  [39, 4.4, 2.5, COLORES.siluetaHonda],
];
/** El bosque mojado de la punta y de las lomas de atrás: x, z, alto. */
const BOSQUE: readonly (readonly [number, number, number])[] = [
  ...[44, 46.5, 49, 51.5, 54, 56.5, 59, 61.5].map((x, i) => [x, -5.2 - (i % 3) * 1.1, 6 + (i % 4)] as const),
  ...[-4, 4, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108].map(
    (x, i) => [x + (i % 3) * 1.4, -14 - (i % 4) * 1.6, 8 + (i % 5) * 1.3] as const,
  ),
];
/** Las nalcas al pie del bosque y en la costanera: x, y, z, alto. */
const NALCAS: readonly (readonly [number, number, number, number])[] = [
  [-4.6, P, -2.6, 1.4],
  [44.4, P, -3.6, 1.6],
  [48, P, -4.4, 1.9],
  [53.4, P, -3.7, 1.5],
  [58.8, P, -4.2, 1.8],
  [62.6, P, -3.8, 1.4],
];

type Punto = { x: number; y: number; z: number };

export function crearGuion(): GuionDeNivel {
  let tranqueraAbierta = false;
  let tranqueraBajando = -1;
  let tranqueraArriba: Punto | undefined;

  /** Pone la tranquera a medio bajar (de 0, cerrada, a 1, abajo). */
  const ponerTranquera = (nivel: NivelEnJuego, f: number, deUna: boolean) => {
    const c = nivel.pieza("tranquera").cuerpo;
    if (!c || !tranqueraArriba) return;
    const s = f * f * (3 - 2 * f);
    const donde = { x: tranqueraArriba.x, y: tranqueraArriba.y - TRANQUERA.bajar * s, z: tranqueraArriba.z };
    if (deUna) c.setTranslation(donde, true);
    else c.setNextKinematicTranslation(donde);
  };
  const abrirTranquera = () => {
    if (!tranqueraAbierta) tranqueraBajando = 0;
    tranqueraAbierta = true;
  };
  /** La marea a esta altura del nivel. */
  const llevarMarea = (nivel: NivelEnJuego) => nivel.agua("marea").irA(mareaEn(nivel.pasos * PASO, MAREA));

  return {
    alEmpezar(nivel) {
      const t = nivel.pieza("tranquera").cuerpo?.translation();
      if (t) tranqueraArriba = { x: t.x, y: t.y, z: t.z };
      llevarMarea(nivel);
      const casa = nivel.minga("casa");
      casa.alLlegar(() => {
        abrirTranquera();
        if (!casa.seSalio) nivel.lograr();
      });

      // Los palafitos de la playa: su casa, su techo, sus pilotes y su corredor, sobre lo que choca del .glb
      const grises = [COLORES.siluetaLejana, COLORES.silueta];
      for (const [i, { x0, x1 }] of PALAFITOS.entries()) {
        const p = crearPalafito(grises[i % grises.length] ?? COLORES.silueta, {
          largo: x1 - x0,
          fondo: 3.6,
          corredor: 1.6,
          alto: 2.4,
          pilotes: P - ARENA + 0.4,
        });
        p.position.set(DX + (x0 + x1) / 2, P, 0.4);
        nivel.escena.add(p);
      }
      // Los de atrás, sobre el agua de la caleta, mirando a la playa
      for (const [i, [x, largo, alto, gris]] of DE_ATRAS.entries()) {
        const p = crearPalafito(gris, { largo, fondo: 3.4, corredor: 1, alto, pilotes: 3 });
        p.position.set(DX + x, P + 0.3 + (i % 2) * 0.2, -4.1);
        nivel.escena.add(p);
      }
      // El curanto del secreto
      const curanto = crearCuranto();
      curanto.position.set(CURANTO.x, ARENA, CURANTO.z);
      nivel.escena.add(curanto);
      // El bosque mojado: pinos en la punta, abetos en las lomas de atrás, y las nalcas
      for (const [i, [x, z, alto]] of BOSQUE.entries()) {
        const arbol =
          z > -8
            ? crearPino({ alto, radio: 0.16, semilla: 300 + i, ramasDesde: 0.3, largoRama: 1.6, caida: 0.5 })
            : crearAbeto(alto, alto * 0.45, i % 2 === 0 ? COLORES.siluetaLejana : COLORES.silueta);
        arbol.position.set(DX + x, z > -8 ? P : 0.5, z);
        nivel.escena.add(arbol);
      }
      const verde = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
      for (const [i, [x, y, z, alto]] of NALCAS.entries()) {
        const nalca = crearNalca(verde, alto, 7 + i * 3);
        nalca.position.set(DX + x, y, z);
        nivel.escena.add(nalca);
      }
      // La iglesia de madera, en la loma de atrás de la caleta
      const iglesia = crearIglesiaChilota(materialCorteza(COLORES.siluetaLejana, { repetir: [4, 2] }));
      iglesia.position.set(DX + 24, 1.5, -18);
      iglesia.rotation.y = 0.25;
      nivel.escena.add(iglesia);
    },

    alRetomar(n, nivel) {
      if (n >= 2) {
        nivel.minga("casa").llevarAlFinal();
        tranqueraAbierta = true;
        tranqueraBajando = -1;
        ponerTranquera(nivel, 1, true);
      }
      if (n >= 3) {
        nivel.chalupa("chalupa").amarrar();
        nivel.ancla("ancla").volver();
      }
      if (n >= 5) nivel.caleuche("caleuche").contentar();
    },

    cadaPaso(nivel) {
      llevarMarea(nivel);
      // La tranquera se hunde cuando llega la casa
      if (tranqueraBajando >= 0) {
        tranqueraBajando++;
        ponerTranquera(nivel, Math.min(1, tranqueraBajando / TRANQUERA.pasos), false);
        if (tranqueraBajando >= TRANQUERA.pasos) tranqueraBajando = -1;
      }
    },
  };
}
