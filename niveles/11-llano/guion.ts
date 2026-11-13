// El guion del nivel 11, El llano (TU-44). Lo que la escena no puede decir:
//   · Quiénes oyen al Silbón (los dos muñecos) y dónde espera su saco después de que lo hallan: junto a su rancho.
//   · Las dos matas del pajonal donde no está: entrar a una antes de hallarlo es un intento fallido. Hallarlo al
//     primer intento (sin pasar por ninguna de las otras) da el logro, «Buen oído». Al hallarlo se abre la talanquera
//     del pajonal.
//   · El freno del molino: mientras alguien sostiene la palanca, el molino para con las aspas en rampa.
//   · El portón del hato se abre (y queda abierto) cuando sacan la tranca; la talanquera del corral, cuando están las
//     tres reses adentro; el puente del caño baja (y queda abajo) con la palanca de la otra orilla.
//   · La meta aparece cuando el Silbón recoge su saco.
//   · El samán y el arpa llanera del secreto (la zona `secreto` del .glb la encuentra sola), el techo del rancho y las
//     palmas de moriche del horizonte se dibujan acá.

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearLevadizo, type Levadizo } from "../../apps/juego/src/niveles/mecanismos/tren";
import {
  crearImagenArpa,
  crearImagenSaman,
  crearImagenTecho,
  crearPuertaConBisagra,
  type PuertaConBisagra,
} from "../../apps/juego/src/niveles/piezas-llano";
import { crearImagenPalmera } from "../../apps/juego/src/niveles/piezas-rio";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/llano.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -49;
/** Las matas del pajonal donde no está el Silbón (x, z), y a cuánto de una (m) ya se la revisó. */
export const ESCONDITES = [
  [6.5, -5.0],
  [11.5, 1.9],
] as const;
const REVISAR = 1.1;
/** Donde espera el Silbón su saco: junto a su rancho (que es bajo para él), mirando hacia el camino (−x). */
export const RANCHO = { x: 91.4, y: 0, z: -0.7, rumbo: -Math.PI / 2 };
/** El medio del techo del rancho. */
const TECHO = { x: 94.1, z: -1.3 };
/** Las talanqueras y el portón: su bisagra (x, z), cuánto giran (radianes; positivo, de +z hacia +x) y en cuántos
 * pasos. */
const PUERTAS = {
  "talanquera-pajonal": { bisagra: [25, 1.2], angulo: -1.75, pasos: 50 },
  porton: { bisagra: [39.75, 2.7], angulo: 1.75, pasos: 50 },
  "talanquera-corral": { bisagra: [62, 1.2], angulo: -1.75, pasos: 50 },
} as const;
type NombreDePuerta = keyof typeof PUERTAS;
/** El samán del conuco y el arpa del secreto, a su sombra. */
const SAMAN = { x: 90.2, z: -6.7 };
const ARPA = { x: 88.6, z: -5.9 };
/** Las palmas de moriche del horizonte: x, z, alto. */
const MORICHES: readonly (readonly [number, number, number])[] = [
  [-6, -10, 8],
  [3, -12.5, 9.5],
  [9, -16, 11],
  [14, -10.5, 7.5],
  [22, -13, 10],
  [27, -18, 12],
  [31, -8.5, 7],
  [39, -15, 10.5],
  [47, -9, 8.5],
  [55, -12, 10],
  [61, -17, 11.5],
  [68, -8.5, 7.5],
  [77, -11, 9],
  [84, -16, 11],
  [97, -9, 8],
  [103, -12, 9.5],
];
/** Donde se esconde la zona de la meta mientras no aparece. */
const ESCONDIDA = -100;

export function crearGuion(): GuionDeNivel {
  const puertas = new Map<NombreDePuerta, PuertaConBisagra>();
  let puente: Levadizo | undefined;
  let bajarPuente = false;
  let meta: Volumen["centro"] | undefined;
  /** Las matas revisadas antes de hallar al Silbón. */
  const revisadas = new Set<number>();

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`El llano: falta el punto ${n}`);
    return p.zona;
  };
  const mostrarMeta = (nivel: NivelEnJuego, ya: boolean) => {
    const zona = punto(nivel, 5);
    if (!meta) return;
    zona.centro.copy(meta);
    if (!ya) zona.centro.y = ESCONDIDA;
  };
  const abrir = (nombre: NombreDePuerta, ya = false) => puertas.get(nombre)?.abrir(ya);

  return {
    alEmpezar(nivel) {
      // El Silbón: lo oyen los dos (también en el invitado, que corre esto) y espera su saco bajo el rancho
      const silbon = nivel.silbon("silbon");
      silbon.oir(nivel.munecos);
      silbon.esperarEn({ x: DX + RANCHO.x, y: RANCHO.y, z: RANCHO.z }, RANCHO.rumbo);
      silbon.alHallar(() => {
        if (revisadas.size === 0) nivel.lograr();
        abrir("talanquera-pajonal");
      });
      for (const [nombre, d] of Object.entries(PUERTAS) as [NombreDePuerta, (typeof PUERTAS)[NombreDePuerta]][]) {
        const cuerpo = nivel.pieza(nombre).cuerpo;
        if (!cuerpo) throw new Error(`El llano: «${nombre}» tiene que ser cinemático`);
        puertas.set(
          nombre,
          crearPuertaConBisagra(cuerpo, { x: DX + d.bisagra[0], z: d.bisagra[1] }, d.angulo, d.pasos),
        );
      }
      // El puente del caño empieza parado sobre su bisagra
      puente = crearLevadizo(nivel, { nombre: "puente-cano", pasos: 90 });
      puente.poner(0, true);
      // La meta, hasta que el Silbón recoja su saco
      meta = punto(nivel, 5).centro.clone();
      mostrarMeta(nivel, false);
      silbon.alRecibir(() => mostrarMeta(nivel, true));
      dibujarElLlano(nivel);
    },
    alRetomar(n, nivel) {
      const silbon = nivel.silbon("silbon");
      if (n >= 1) {
        silbon.hallar();
        abrir("talanquera-pajonal", true);
      }
      if (n >= 2) abrir("porton", true);
      if (n >= 3) {
        nivel.ganado("ganado").encerrar();
        abrir("talanquera-corral", true);
      }
      if (n >= 4) {
        bajarPuente = true;
        puente?.poner(1, true);
      }
      if (n >= 5) {
        silbon.recibir(nivel.saco("saco"));
        mostrarMeta(nivel, true);
      }
    },
    cadaPaso(nivel) {
      // Las matas revisadas antes de hallarlo (para el logro)
      const silbon = nivel.silbon("silbon");
      if (!silbon.hallado) {
        for (const m of nivel.munecos) {
          const t = m.partes.pelvis.translation();
          for (const [i, [x, z]] of ESCONDITES.entries()) {
            if (Math.hypot(t.x - (DX + x), t.z - z) < REVISAR) revisadas.add(i);
          }
        }
      }
      // El freno del molino
      nivel.molino("molino").frenar(nivel.palanca("freno").activa);
      // El portón, la talanquera del corral y el puente
      if (nivel.tranca("tranca").abierta) abrir("porton");
      const ganado = nivel.ganado("ganado");
      if (ganado.encerradas >= ganado.cuantas) abrir("talanquera-corral");
      if (nivel.palanca("palanca-puente").activa) bajarPuente = true;
      puente?.poner(bajarPuente ? 1 : 0);
      for (const p of puertas.values()) p.pasar();
    },
  };
}

/** Lo que solo se ve: el samán y el arpa del secreto, el techo del rancho y las palmas de moriche. */
function dibujarElLlano(nivel: NivelEnJuego) {
  const corteza = materialCorteza(COLORES.silueta, { repetir: [2, 3] });
  const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const saman = crearImagenSaman(corteza, hojas);
  saman.position.set(DX + SAMAN.x, 0, SAMAN.z);
  nivel.escena.add(saman);
  const arpa = crearImagenArpa(corteza);
  arpa.position.set(DX + ARPA.x, 0, ARPA.z);
  arpa.rotation.y = 0.5;
  nivel.escena.add(arpa);
  const techo = crearImagenTecho(hojas, 3.8, 3.6, 3.0);
  techo.position.set(DX + TECHO.x, 0, TECHO.z);
  nivel.escena.add(techo);
  for (const [i, [x, z, alto]] of MORICHES.entries()) {
    const { grupo } = crearImagenPalmera(corteza, hojas, alto, 0.16);
    grupo.position.set(DX + x, 0, z);
    grupo.rotation.set(0.04 * Math.sin(i * 2.1), i * 1.3, 0.04 * Math.cos(i * 1.7));
    nivel.escena.add(grupo);
  }
}
