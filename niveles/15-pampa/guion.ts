// El guion del nivel 15, La pampa (TU-48). Lo que la escena no puede decir:
//   · El camino de La Luz Mala por el bañado (sus paradas, sobre las vueltas de la calzada escondida) y los señuelos
//     donde se puede equivocar (sobre el agua honda, pasando la punta de cada ramal que se corta). Después se posa en
//     los postes del alambrado del final.
//   · El pasador de la tranquera: con la tranquera abierta más de 60° y el pasador corrido, queda trabada abierta.
//     Los dos del otro lado sin que la tranquera se haya cerrado de golpe nunca (nadie la soltó) da el logro,
//     «Contra el viento».
//   · El portón del puesto se abre (y queda abierto) cuando las boleadoras bajan el chambergo.
//   · La rama gacha del ombú baja (y queda abajo) con la palanca de la horqueta: así sube el que hizo pie.
//   · La meta aparece cuando la Luz queda encerrada en el candil: el camino ya tiene luz.
//   · El ombú (el tronco, las raíces y la copa) y el mate del secreto (la zona `secreto` del .glb lo encuentra
//     sola) se dibujan acá.

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearPuertaConBisagra, type PuertaConBisagra } from "../../apps/juego/src/niveles/piezas-llano";
import {
  crearImagenGancho,
  crearImagenMate,
  crearImagenOmbu,
  crearRamaGacha,
  type RamaGacha,
} from "../../apps/juego/src/niveles/piezas-pampa";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/pampa.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -52;
/** A qué alto vuela la Luz sobre la calzada (m). */
const VUELO = 1.6;
/** Las paradas de la Luz por el bañado (x, z): las vueltas de la calzada, de la orilla de la salida a la otra. */
export const CAMINO: readonly (readonly [number, number])[] = [
  [3.4, 0],
  [8, 0],
  [8, -3],
  [13, -3],
  [13, 2.2],
  [18, 2.2],
  [18, -3],
  [23, -3],
  [23, 2.2],
  [27, 2.2],
  [27, 0],
  [31.5, 0],
];
/** Por dónde se puede equivocar al salir de cada parada: pasando la punta de un ramal que se corta (o `null`). */
export const SENUELOS: readonly (readonly [number, number] | null)[] = [
  null,
  [11.6, 0],
  null,
  [16.4, -3],
  null,
  [21.4, 2.2],
  null,
  [26.2, -3],
  null,
  null,
  null,
  null,
];
/** Los postes del alambrado del final, donde se posa la Luz (x, z, alto del poste). */
export const POSADEROS: readonly (readonly [number, number])[] = [
  [92.5, -2.9],
  [97.5, -2.9],
  [95, -2.9],
  [100, -2.9],
  [102.5, -2.9],
];
const ALTO_POSTE = 1.15;
/** La tranquera queda trabada con el pasador si está abierta más que esto (radianes). */
const TRABAR = (60 * Math.PI) / 180;
/** Pasada la tranquera (x): del otro lado. */
const TRANQUERA_X = 40.6;
/** El portón del puesto: su bisagra (x, z), cuánto gira (radianes; positivo, de +z hacia +x) y en cuántos pasos. */
const PORTON = { bisagra: [64, -1.2], angulo: 1.75, pasos: 50 } as const;
/** La rama gacha: su bisagra en el borde de la horqueta (x, y, z), cuánto mide y sus dos ángulos (radianes sobre el
 * horizonte, hacia el oeste): parada hacia la copa y gacha hasta el suelo. Baja en tantos pasos. */
const RAMA = {
  bisagra: [74, 2.49, 0] as const,
  largo: 7.6,
  arriba: (75 * Math.PI) / 180,
  abajo: -Math.asin(2.6 / 7.6),
  pasos: 100,
};
/** El ombú: el medio del tronco (x, z) y el mate del secreto. */
const OMBU = { x: 75.75, z: -1.1 };
const MATE = { x: 77, y: 4.0, z: -1.9 };
/** Los ganchos de los postes: de dónde salen y dónde cuelga lo que tienen (x, y, z). */
const GANCHOS: readonly (readonly [readonly [number, number, number], readonly [number, number, number]])[] = [
  [
    [47.6, 1.55, -2.38],
    [47.6, 1.55, -1.9],
  ],
  [
    [89.5, 1.72, -2.68],
    [89.5, 1.72, -2.3],
  ],
];
/** Donde se esconde la zona de la meta mientras no aparece. */
const ESCONDIDA = -100;

export function crearGuion(): GuionDeNivel {
  let porton: PuertaConBisagra | undefined;
  let rama: RamaGacha | undefined;
  let bajarRama = false;
  let meta: Volumen["centro"] | undefined;
  /** Si la tranquera se trabó jugando (no al retomar): el logro es para el que cruzó contra el viento. */
  let trabadaJugando = false;

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`La pampa: falta el punto ${n}`);
    return p.zona;
  };
  const mostrarMeta = (nivel: NivelEnJuego, ya: boolean) => {
    const zona = punto(nivel, 5);
    if (!meta) return;
    zona.centro.copy(meta);
    if (!ya) zona.centro.y = ESCONDIDA;
  };

  return {
    alEmpezar(nivel) {
      // La Luz: su camino por el bañado y, después, los postes donde se posa (también en el invitado, que corre esto)
      const luz = nivel.luzMala("luz-mala");
      luz.guiar(
        CAMINO.map(([x, z]) => ({ x: DX + x, y: VUELO, z })),
        SENUELOS.map((s) => (s ? { x: DX + s[0], y: VUELO, z: s[1] } : null)),
      );
      luz.posaderos(POSADEROS.map(([x, z]) => ({ x: DX + x, y: ALTO_POSTE + 0.17, z })));
      // El portón del puesto
      const cuerpo = nivel.pieza("porton-puesto").cuerpo;
      if (!cuerpo) throw new Error("La pampa: «porton-puesto» tiene que ser cinemático");
      porton = crearPuertaConBisagra(
        cuerpo,
        { x: DX + PORTON.bisagra[0], z: PORTON.bisagra[1] },
        PORTON.angulo,
        PORTON.pasos,
      );
      nivel.chambergo("chambergo").alAtrapar(() => porton?.abrir());
      // La rama gacha empieza parada, hacia la copa
      const cuerpoRama = nivel.pieza("rama-gacha").cuerpo;
      if (!cuerpoRama) throw new Error("La pampa: «rama-gacha» tiene que ser cinemática");
      rama = crearRamaGacha(cuerpoRama, {
        bisagra: { x: DX + RAMA.bisagra[0], y: RAMA.bisagra[1], z: RAMA.bisagra[2] },
        largo: RAMA.largo,
        arriba: RAMA.arriba,
        abajo: RAMA.abajo,
        pasos: RAMA.pasos,
      });
      rama.poner(0, true);
      // La meta, hasta que la Luz quede encerrada
      meta = punto(nivel, 5).centro.clone();
      mostrarMeta(nivel, false);
      luz.alEncerrar(() => mostrarMeta(nivel, true));
      dibujarLaPampa(nivel);
    },
    alAlcanzar(n, nivel) {
      // Si llegaron a la otra orilla sin ella (o antes de que se diera cuenta), la Luz se va a sus postes igual
      const luz = nivel.luzMala("luz-mala");
      if (n >= 1 && !luz.guio) luz.irAPosaderos();
    },
    alRetomar(n, nivel) {
      const luz = nivel.luzMala("luz-mala");
      if (n >= 1) luz.irAPosaderos(true);
      if (n >= 2) nivel.tranquera("tranquera").trabar(true);
      if (n >= 3) {
        nivel.chambergo("chambergo").atrapar();
        porton?.abrir(true);
      }
      if (n >= 4) {
        bajarRama = true;
        rama?.poner(1, true);
      }
      if (n >= 5) {
        luz.encerrar(nivel.candil("candil"));
        mostrarMeta(nivel, true);
      }
    },
    cadaPaso(nivel) {
      // La tranquera: el pasador la traba si está bien abierta. El logro, si pasaron los dos sin que se cerrara
      const tranquera = nivel.tranquera("tranquera");
      if (!tranquera.trabada && nivel.palanca("pasador").activa && tranquera.angulo > TRABAR) {
        tranquera.trabar();
        trabadaJugando = true;
      }
      if (trabadaJugando && tranquera.golpes === 0 && !nivel.logro) {
        const pasaron = nivel.munecos.every((m) => m.partes.pelvis.translation().x > DX + TRANQUERA_X);
        if (pasaron) nivel.lograr();
      }
      // El portón del puesto y la rama gacha
      if (nivel.chambergo("chambergo").atrapado) porton?.abrir();
      porton?.pasar();
      if (nivel.palanca("palanca-rama").activa) bajarRama = true;
      rama?.poner(bajarRama ? 1 : 0);
    },
  };
}

/** Lo que solo se ve: el ombú (raíces, tronco y copa) y el mate del secreto. */
function dibujarLaPampa(nivel: NivelEnJuego) {
  const corteza = materialCorteza(COLORES.silueta, { repetir: [3, 2] });
  const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const ombu = crearImagenOmbu(corteza, hojas, { x: 1.75, z: 1.5 }, 2.6, {
    x: 77 - OMBU.x,
    z: -1.9 - OMBU.z,
    mx: 0.5,
    mz: 0.7,
    alto: 1.4,
  });
  ombu.position.set(DX + OMBU.x, 0, OMBU.z);
  nivel.escena.add(ombu);
  for (const [[x0, y0, z0], [x1, y1, z1]] of GANCHOS) {
    nivel.escena.add(crearImagenGancho({ x: DX + x0, y: y0, z: z0 }, { x: DX + x1, y: y1, z: z1 }, hojas));
  }
  const mate = crearImagenMate(corteza);
  mate.position.set(DX + MATE.x, MATE.y, MATE.z);
  mate.rotation.y = 0.6;
  nivel.escena.add(mate);
}
