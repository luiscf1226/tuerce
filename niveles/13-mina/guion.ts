// El guion del nivel 13, La mina (TU-46). Lo que la escena no puede decir:
//   · Las vías: la de la vagoneta de abajo, con su cambio (la palanca «cambio»: el que la sostiene la manda por el
//     desvío), y la de la vagoneta de salida, cuesta abajo hasta el salar. La que llega por el desvío a la báscula
//     sube la reja; la que se queda en el derrumbe vuelve sola a su lugar a los 3 s.
//   · La jaula del pozo: sube con el gancho de la polea que esté más arriba (la de abajo o la de arriba).
//   · El Tío: cuando se queda con su ofrenda abre su puerta.
//   · Los espejos: si el haz de la grieta llega al sol de piedra, sube la puerta de luz.
//   · La vagoneta de salida tiene el freno puesto; se le suelta con los dos adentro, o con uno a los 2 s. Si queda
//     abajo sin nadie y la pareja no llegó a la meta, vuelve sola a la boca de la mina.
//   · El logro, «Sin chispas»: llegar a la meta sin que la ofrenda pase nunca por las velas. Retomando un avance de
//     después de la ofrenda no se gana (no se sabe si explotaron).
//   · Los bordes invisibles del lado de la cámara solo atajan a los muñecos: la cámara no los ve como paredes.
//   · Se dibujan acá los rieles, las vigas de los túneles, la jaula, el sol de piedra, la pepita del secreto (la zona
//     `secreto` del .glb la encuentra sola) y el salar que refleja el cielo.

import { PASO } from "../../apps/juego/src/motor/bucle";
import {
  crearDerrumbe,
  crearJaula,
  crearPepita,
  crearSalar,
  crearSolDePiedra,
  crearVigas,
  vestirReja,
} from "../../apps/juego/src/niveles/decorado-mina";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearVia, type Punto as PuntoDeVia } from "../../apps/juego/src/niveles/mecanismos/via";
import { SOLO_MUNECOS } from "../../apps/juego/src/niveles/piezas-garrucha";
import { crearRieles } from "../../apps/juego/src/niveles/piezas-tren";

/** Las alturas, como en scripts/niveles/mina.mjs: la galería de abajo, la de arriba y el salar. */
export const Y0 = 0;
export const Y1 = 2.2;
export const YS = -3.4;
/** La vía de la vagoneta de abajo: derecho hasta el derrumbe; el desvío sale del cambio (el punto 1) hacia la báscula. */
export const VIA_VAGONETA: readonly PuntoDeVia[] = [
  [-46, Y0, 1.2],
  [-39, Y0, 1.2],
  [-31.35, Y0, 1.2],
];
export const DESVIO_VAGONETA: readonly PuntoDeVia[] = [
  [-36, Y0, -0.9],
  [-29.15, Y0, -0.9],
];
/** La vía de la vagoneta de salida: de la boca de la mina, cuesta abajo por el puente de rieles, hasta el salar. */
export const VIA_SALIDA: readonly PuntoDeVia[] = [
  [20.2, Y1 - 1.07, 0.8],
  [41.0, YS, 0.8],
  [47.5, YS, 0.8],
];
/** La jaula: dónde está su piso abajo, y a qué altura sobre la base de su polea queda el gancho en reposo. */
export const JAULA = { x: -19.3, y: Y0 + 0.05, z: 0, gancho: 2.0, subir: Y1 - 0.1 } as const;
/** El sol de piedra: el haz que le llega a menos de `radio` abre la puerta de luz. */
export const SOL = { x: 4.0, y: Y1 + 2.0, z: -3.15, radio: 0.6 } as const;
/** Cuánto espera (s) la vagoneta en el derrumbe antes de volver, y la de salida con uno solo adentro o abajo vacía. */
export const ESPERAS = { derrumbe: 3, arranque: 2, vacia: 3 } as const;
/** Las puertas que se abren: cuánto suben (m) y a qué velocidad (m/s). */
const PUERTA = { sube: 2.8, velocidad: 1.2 };
/** La pepita del secreto, en la galería vieja. */
const PEPITA = { x: -24.6, y: Y0 + 1.4, z: -2.7 } as const;

type Punto = { readonly x: number; readonly y: number; readonly z: number };

export function crearGuion(): GuionDeNivel {
  const viaVagoneta = crearVia(VIA_VAGONETA, { desde: 1, puntos: DESVIO_VAGONETA });
  const viaSalida = crearVia(VIA_SALIDA);
  /** Las puertas que se están abriendo (su nombre) y cuánto subieron. */
  const abiertas = new Map<string, { desde: Punto; subido: number }>();
  let enElDerrumbe = 0;
  let aBordo = 0;
  let vaciaAbajo = 0;
  let sinChispas = true;
  /** Si la pareja retomó un avance de después de la ofrenda: ya no se sabe si explotaron. */
  let retomadoTarde = false;

  const abrir = (nivel: NivelEnJuego, nombre: string, ya = false) => {
    const c = nivel.pieza(nombre).cuerpo;
    if (!c || abiertas.has(nombre)) return;
    const t = c.translation();
    const puerta = { desde: { x: t.x, y: t.y, z: t.z }, subido: ya ? PUERTA.sube : 0 };
    abiertas.set(nombre, puerta);
    if (ya) c.setTranslation({ x: t.x, y: t.y + PUERTA.sube, z: t.z }, true);
  };

  return {
    alEmpezar(nivel) {
      nivel.vagoneta("vagoneta").seguir(viaVagoneta, () => nivel.palanca("cambio").activa);
      const salida = nivel.vagoneta("vagoneta-salida");
      salida.seguir(viaSalida);
      salida.frenar(true);
      nivel.ofrenda("ofrenda").alAsustar(() => {
        sinChispas = false;
      });
      nivel.tio("tio").alRecibir(() => abrir(nivel, "puerta-tio"));
      for (const nombre of ["borde-baja", "borde-alta", "borde-salar-frente"])
        nivel.pieza(nombre).colisionador.setCollisionGroups(SOLO_MUNECOS);

      // Lo que se ve: los rieles, las vigas, la jaula, el sol de piedra, la pepita y el salar
      nivel.escena.add(crearRieles(VIA_VAGONETA));
      nivel.escena.add(crearRieles([[-39, Y0, 1.2], ...DESVIO_VAGONETA]));
      nivel.escena.add(crearRieles(VIA_SALIDA, { caballete: (x) => x > 22 && x < 40.5, fondo: -7 }));
      nivel.escena.add(
        crearVigas([
          { desde: -50, hasta: -18.6, piso: Y0, salvo: [-28.25] },
          { desde: -17.4, hasta: 19, piso: Y1, salvo: [0.6, 15.2] },
        ]),
      );
      nivel.pieza("jaula").objeto.add(crearJaula(JAULA.gancho - 0.05));
      vestirReja(nivel.pieza("reja").objeto);
      nivel.escena.add(crearDerrumbe({ x: -30.5, y: Y0, z: 0.3 }, { x: -28.5, y: Y0 + 1.0, z: 3.1 }));
      nivel.escena.add(crearSolDePiedra(SOL, SOL.radio));
      nivel.escena.add(crearPepita(PEPITA));
      nivel.escena.add(crearSalar(YS, 41));
    },
    alAlcanzar(n, nivel) {
      if (n === 5 && sinChispas && !retomadoTarde) nivel.lograr();
    },
    alRetomar(n, nivel) {
      if (n >= 1) {
        nivel.vagoneta("vagoneta").poner(viaVagoneta.largoDesvio, true);
        abrir(nivel, "reja", true);
      }
      if (n >= 3) {
        retomadoTarde = true;
        nivel.tio("tio").recibir(nivel.ofrenda("ofrenda"));
        abrir(nivel, "puerta-tio", true);
      }
      if (n >= 4) abrir(nivel, "puerta-luz", true);
      // La vagoneta de salida: en la meta, abajo; antes, esperando con el freno puesto en la boca de la mina
      const salida = nivel.vagoneta("vagoneta-salida");
      salida.frenar(n < 5);
      salida.poner(n >= 5 ? viaSalida.largo : 0);
      aBordo = 0;
      vaciaAbajo = 0;
    },
    cadaPaso(nivel) {
      // Las puertas que se abren suben de a poco
      for (const [nombre, puerta] of abiertas) {
        if (puerta.subido >= PUERTA.sube) continue;
        puerta.subido = Math.min(PUERTA.sube, puerta.subido + PUERTA.velocidad * PASO);
        nivel.pieza(nombre).cuerpo?.setNextKinematicTranslation({
          x: puerta.desde.x,
          y: puerta.desde.y + puerta.subido,
          z: puerta.desde.z,
        });
      }
      // 1. La vagoneta que llega por el desvío a la báscula sube la reja; en el derrumbe, vuelve sola a su lugar
      const vagoneta = nivel.vagoneta("vagoneta");
      if (vagoneta.enElTope && vagoneta.porElDesvio) abrir(nivel, "reja");
      enElDerrumbe = vagoneta.enElTope && !vagoneta.porElDesvio ? enElDerrumbe + PASO : 0;
      if (enElDerrumbe > ESPERAS.derrumbe) {
        vagoneta.poner(0);
        enElDerrumbe = 0;
      }
      // 2. La jaula sube con el gancho que esté más arriba
      const gancho = Math.max(
        nivel.polea("polea-abajo").gancho.translation().y,
        nivel.polea("polea-arriba").gancho.translation().y,
      );
      const subida = Math.min(JAULA.subir, Math.max(0, gancho - JAULA.gancho));
      nivel.pieza("jaula").cuerpo?.setNextKinematicTranslation({ x: JAULA.x, y: JAULA.y + subida, z: JAULA.z });
      // 4. El haz en el sol de piedra sube la puerta de luz
      if (nivel.grieta("grieta").alumbra(SOL, SOL.radio)) abrir(nivel, "puerta-luz");
      // 5. El freno de la vagoneta de salida se suelta con los dos adentro, o con uno a los 2 s
      const salida = nivel.vagoneta("vagoneta-salida");
      if (salida.frenada) {
        aBordo = salida.montados > 0 ? aBordo + PASO : 0;
        if (salida.montados >= 2 || aBordo > ESPERAS.arranque) salida.frenar(false);
      }
      // Abajo y vacía, sin haber llegado a la meta: vuelve a la boca de la mina
      vaciaAbajo = salida.enElTope && salida.montados === 0 && nivel.puntoDeControl < 5 ? vaciaAbajo + PASO : 0;
      if (vaciaAbajo > ESPERAS.vacia) {
        salida.poner(0);
        salida.frenar(true);
        vaciaAbajo = 0;
        aBordo = 0;
      }
    },
  };
}
