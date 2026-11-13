// El guion del nivel 9, Los canales de Xochimilco (TU-42). Lo que la escena no puede decir:
//   · El llanto de La Llorona sube el agua del canal y del remanso: a mares, el canal está crecido (25 cm) y el arco
//     de la trajinera no pasa bajo el puente. Cada carcajada lo baja un poco; tranquila, baja del todo.
//   · La trajinera vacía que quedó lejos de su lugar vuelve sola: al muelle antes del punto 1, junto a la chinampa de
//     La Llorona antes del 2. La de las flores, a su muelle (con todas sus flores) antes del 5.
//   · Rota la piñata, la reja del embarcadero de las flores se hunde en el suelo.
//   · El logro, «Ni una flor menos»: llegar a la meta (punto 5) con todas las flores en la trajinera.
//   · Los ahuejotes, las trajineras amarradas en el canal de atrás, el papel picado de la feria y el alebrije
//     dormido del secreto (la zona `secreto` del .glb lo encuentra sola) se dibujan acá.
// En línea, el invitado no corre este guion: el nivel del agua le llega con su marcador y la reja en la foto.

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import {
  crearAhuejote,
  crearAlebrije,
  crearImagenTrajinera,
  crearPapelPicado,
} from "../../apps/juego/src/niveles/piezas-canales";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/canales.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -45;
/** Las alturas: el agua, la chinampa de La Llorona y la tierra del resto. */
const G = 0.3;
const GC = 0.55;
/** El agua del canal de La Llorona: crecida (a mares), lo que baja con cada carcajada, y tranquila (m, m/s). */
export const LLANTO = {
  crecida: 0.25,
  risa: 0.12,
  tranquila: 0,
  velocidad: 0.05,
  aguas: ["canal", "remanso"],
} as const;
/** La trajinera vacía, a más de esto de su lugar (m) y tantos pasos sin nadie, vuelve. Su parada junto a la chinampa
 * de La Llorona y su lugar en el embarcadero de la ciénaga (centros de su caja, sin el alto del agua). */
export const TRAJINERA = {
  lejos: 2,
  pasos: 480,
  parada: { x: DX + 22.4, z: -1.6 },
  embarcadero: { x: DX + 28, z: -1.6 },
  /** La caja mide 30 cm de alto: su centro va 14 cm sobre el agua. */
  flota: 0.14,
} as const;
/** La reja de la feria: cuánto baja (m) y en cuántos pasos. */
const REJA = { bajar: 3.4, pasos: 120 };
/** El alebrije del secreto, en su chinampa. */
const ALEBRIJE = { x: DX + 38.3, y: G, z: -2.5 };
/** Los ahuejotes: x, z, alto, y a qué altura está su pie. */
const AHUEJOTES: readonly (readonly [number, number, number, number])[] = [
  // La orilla del fondo de los canales
  ...[-5, -1, 3, 7, 11, 15, 19, 23, 30].map((x, i) => [x, -3.7, 6.5 + (i % 3), GC] as const),
  ...[66, 70, 74, 78, 82, 86, 90].map((x, i) => [x, -3.7, 6.5 + ((i + 1) % 3), GC] as const),
  ...[33, 37, 45, 49, 57, 61, 95].map((x, i) => [x, -3.7, 6 + (i % 2), G] as const),
  // En las chinampas del medio del canal y en la del alebrije (del lado de la cámara no: taparían)
  [85.2, -2.5, 5, GC],
  [38.9, -3.0, 4.6, G],
];
/** Las trajineras amarradas en el canal de atrás: x, z y rumbo. */
const AMARRADAS: readonly (readonly [number, number, number])[] = [
  [2, -5.6, 0.05],
  [9.5, -6.4, -0.08],
  [17, -5.5, 0.1],
  [28, -6.6, 0],
  [44, -5.8, -0.06],
  [56, -6.5, 0.07],
  [71, -5.6, 0],
  [80, -6.4, -0.1],
  [89, -5.6, 0.05],
];
/** El papel picado de la feria: de dónde a dónde va cada hilo (x, z) y a qué alto. */
const PAPEL_PICADO: readonly (readonly [number, number, number, number, number])[] = [
  [47, -3.1, 47, 3.1, 3.6],
  [50.5, -3.1, 50.5, 3.1, 3.8],
  [57.5, -3.1, 57.5, 3.1, 3.7],
  [47, 0, 59.4, 0, 4.0],
];

type Punto = { x: number; y: number; z: number };

export function crearGuion(): GuionDeNivel {
  /** A dónde manda el agua el llanto (para no pedírselo en cada paso). */
  let nivelDelAgua: number = LLANTO.crecida;
  let trajineraSola = 0;
  let floresSola = 0;
  let rejaAbierta = false;
  let rejaBajando = -1;
  let rejaArriba: Punto | undefined;

  /** El agua del canal de La Llorona ahora (la de la primera zona). */
  const aguaAhora = (nivel: NivelEnJuego) => nivel.agua(LLANTO.aguas[0]).nivel;
  /** Lleva el agua del canal y del remanso a esa altura (sin velocidad, de una vez). */
  const llevarAgua = (nivel: NivelEnJuego, altura: number, velocidad?: number) => {
    nivelDelAgua = altura;
    for (const nombre of LLANTO.aguas) nivel.agua(nombre).irA(altura, velocidad);
  };
  /** Lo que el llanto le pide al agua: crecida a mares, un poco menos con cada carcajada, abajo si está tranquila. */
  const aguaDelLlanto = (llanto: number) =>
    llanto <= 0 ? LLANTO.tranquila : LLANTO.risa + (LLANTO.crecida - LLANTO.risa) * llanto;
  /** Pone la reja a medio bajar (de 0, cerrada, a 1, abajo). */
  const ponerReja = (nivel: NivelEnJuego, f: number, deUna: boolean) => {
    const c = nivel.pieza("reja-feria").cuerpo;
    if (!c || !rejaArriba) return;
    const s = f * f * (3 - 2 * f);
    const donde = { x: rejaArriba.x, y: rejaArriba.y - REJA.bajar * s, z: rejaArriba.z };
    if (deUna) c.setTranslation(donde, true);
    else c.setNextKinematicTranslation(donde);
  };

  return {
    alEmpezar(nivel) {
      const reja = nivel.pieza("reja-feria").cuerpo?.translation();
      if (reja) rejaArriba = { x: reja.x, y: reja.y, z: reja.z };
      nivel.pinata("pinata").alRomper(() => {
        if (!rejaAbierta) rejaBajando = 0;
        rejaAbierta = true;
      });

      // Los ahuejotes, las trajineras amarradas, el papel picado y el alebrije
      const madera = materialCorteza(COLORES.silueta, { repetir: [1, 3] });
      const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
      for (const [i, [x, z, alto, pie]] of AHUEJOTES.entries()) {
        const arbol = crearAhuejote(madera, hojas, alto, i * 1.7);
        arbol.position.set(DX + x, pie, z);
        arbol.rotation.y = i * 2.3;
        nivel.escena.add(arbol);
      }
      // «Trajineras de colores»: sin color, cada una de un gris
      const grises = [COLORES.silueta, COLORES.siluetaLejana, COLORES.siluetaHonda];
      for (const [i, [x, z, rumbo]] of AMARRADAS.entries()) {
        const gris = grises[i % grises.length] ?? COLORES.silueta;
        const { grupo } = crearImagenTrajinera(
          materialCorteza(gris, { repetir: [1, 1] }),
          materialTela(grises[(i + 1) % grises.length] ?? COLORES.siluetaHonda, { repetir: 2, pelusa: false }),
          3,
          0.15,
          0.95,
          2.1,
        );
        grupo.position.set(DX + x, 0.14, z);
        grupo.rotation.y = rumbo;
        nivel.escena.add(grupo);
      }
      nivel.escena.add(
        crearPapelPicado(
          hojas,
          PAPEL_PICADO.map(([x0, z0, x1, z1, alto]) => [
            { x: DX + x0, y: G + alto, z: z0 },
            { x: DX + x1, y: G + alto, z: z1 },
          ]),
        ),
      );
      const alebrije = crearAlebrije();
      alebrije.position.set(ALEBRIJE.x, ALEBRIJE.y, ALEBRIJE.z);
      alebrije.rotation.y = 0.5;
      nivel.escena.add(alebrije);
    },

    alAlcanzar(n, nivel) {
      // Llegaron al embarcadero de la feria con todas las flores
      const flores = nivel.trajinera("trajinera-flores");
      if (n === 5 && flores.flores === flores.totalFlores) nivel.lograr();
    },

    alRetomar(n, nivel) {
      const trajinera = nivel.trajinera("trajinera");
      if (n >= 2) {
        nivel.llorona("llorona").calmar();
        llevarAgua(nivel, LLANTO.tranquila);
        const e = TRAJINERA.embarcadero;
        trajinera.llevar({ x: e.x, y: LLANTO.tranquila + TRAJINERA.flota, z: e.z });
      } else if (n >= 1) {
        const p = TRAJINERA.parada;
        trajinera.llevar({ x: p.x, y: aguaAhora(nivel) + TRAJINERA.flota, z: p.z });
      }
      if (n >= 4) {
        nivel.pinata("pinata").romper();
        rejaAbierta = true;
        rejaBajando = -1;
        ponerReja(nivel, 1, true);
      }
    },

    cadaPaso(nivel) {
      // El llanto de La Llorona sube (o baja) el agua de su canal
      const deseada = aguaDelLlanto(nivel.llorona("llorona").llanto);
      if (deseada !== nivelDelAgua) llevarAgua(nivel, deseada, LLANTO.velocidad);

      // La trajinera vacía, lejos de su lugar, vuelve sola (antes del punto 2)
      if (nivel.puntoDeControl < 2) {
        const trajinera = nivel.trajinera("trajinera");
        const t = trajinera.cuerpo.translation();
        const lugar = nivel.puntoDeControl < 1 ? trajinera.casa.centro : TRAJINERA.parada;
        const lejos = Math.hypot(t.x - lugar.x, t.z - lugar.z) > TRAJINERA.lejos;
        trajineraSola = trajinera.aBordo === 0 && lejos ? trajineraSola + 1 : 0;
        if (trajineraSola > TRAJINERA.pasos) {
          if (nivel.puntoDeControl < 1) trajinera.volver();
          else trajinera.llevar({ x: lugar.x, y: aguaAhora(nivel) + TRAJINERA.flota, z: lugar.z });
          trajineraSola = 0;
        }
      }
      // La de las flores, a su muelle con todas sus flores (antes de la meta)
      if (nivel.puntoDeControl < 5) {
        const flores = nivel.trajinera("trajinera-flores");
        const t = flores.cuerpo.translation();
        const lejos =
          Math.hypot(t.x - flores.casa.centro.x, t.z - flores.casa.centro.z) > TRAJINERA.lejos ||
          flores.flores < flores.totalFlores;
        floresSola = flores.aBordo === 0 && lejos ? floresSola + 1 : 0;
        if (floresSola > TRAJINERA.pasos) {
          flores.volver();
          floresSola = 0;
        }
      }

      // La reja se hunde cuando se rompe la piñata
      if (rejaBajando >= 0) {
        rejaBajando++;
        ponerReja(nivel, Math.min(1, rejaBajando / REJA.pasos), false);
        if (rejaBajando >= REJA.pasos) rejaBajando = -1;
      }
    },
  };
}
