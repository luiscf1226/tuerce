// El guion del nivel 12, El puente de paja (TU-45). Lo que la escena no puede decir:
//   · La puerta de la pirca de la pampa baja cuando la qeswa queda trenzada.
//   · El punto de la cabecera (2) aparece cuando el puente queda amarrado: antes, el puente no tiene piso.
//   · El logro, «Tejedores»: armar el puente sin soltar la cuerda, de la qeswa al amarre. Se corta si alguien suelta
//     su torcedor con la cuerda a medio trenzar o suelta la soga del puente tenso antes de amarrarlo. Para ganarlo
//     hay que trenzarla en esta partida (retomando del punto 1 en adelante ya no se puede).
//   · El agua: sale del ojo de agua arriba de la tercera terraza, baja por la acequia madre y se va entera por la
//     primera bocatoma abierta (de arriba hacia abajo); esa terraza se riega y las de abajo quedan sin agua. Lo que no
//     entra en ninguna sigue de largo y se va por el caño de la primera. Con las tres regadas baja la puerta de arriba.
//   · La llama: llegando al patio del tambo se queda contenta y aparece la meta.
//   · Se dibujan acá el quipu del secreto (la zona `secreto` del .glb lo encuentra sola), el techo de paja del tambo y
//     las otras llamas del corral.

import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearPuertaQueBaja, dibujarDecoradoPuente } from "../../apps/juego/src/niveles/piezas-puente";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/puente.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -42;
/** Las terrazas (de abajo hacia arriba): su altura. */
export const TERRAZAS = [0, 1.3, 2.6] as const;
/** El patio del tambo: la llama que llega a menos de `radio` de acá se queda contenta. */
export const PATIO = { x: 80.5, z: 0, radio: 1.8 } as const;
/** Las puertas que bajan: cuánto (m) y en cuántos pasos. */
const PUERTAS = { "puerta-pampa": 2.5, "puerta-terrazas": 2.5 } as const;
type NombreDePuerta = keyof typeof PUERTAS;
const BAJAR = 60;
/** Qué tan rápido sube y baja el agua de las acequias (m/s). */
const AGUA = 0.6;
/** Donde se esconden las zonas de los puntos que no aparecieron todavía. */
const ESCONDIDA = -100;
/** El quipu del secreto, entre las piedras del pedregal; el techo del tambo y las llamas del corral (x, z, rumbo). */
const DECORADO = {
  quipu: { x: 10.3, y: 1.35, z: -6.3 },
  techo: { x: 82.5, y: 2.6, z: -5.3 },
  llamas: [
    { x: 62.6, y: 2.6, z: -4.6, rumbo: 0.4 },
    { x: 64.9, y: 2.6, z: -5.5, rumbo: 2.6 },
  ],
} as const;

export function crearGuion(): GuionDeNivel {
  const puertas = new Map<NombreDePuerta, ReturnType<typeof crearPuertaQueBaja>>();
  /** Las zonas de los puntos que aparecen después (la cabecera y la meta), donde van de verdad. */
  const zonas = new Map<number, Volumen["centro"]>();
  /** Si se les soltó la cuerda alguna vez (para el logro), y si la trenzaron en esta partida. */
  let soltaron = false;
  let trenzaronAca = true;

  const zona = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`El puente de paja: falta el punto ${n}`);
    return p.zona;
  };
  const esconder = (nivel: NivelEnJuego, n: number) => {
    const z = zona(nivel, n);
    zonas.set(n, z.centro.clone());
    z.centro.y = ESCONDIDA;
  };
  const mostrar = (nivel: NivelEnJuego, n: number) => {
    const donde = zonas.get(n);
    if (donde) zona(nivel, n).centro.copy(donde);
  };
  const abrir = (nombre: NombreDePuerta, ya = false) => puertas.get(nombre)?.abrir(ya);

  return {
    alEmpezar(nivel) {
      for (const [nombre, cuanto] of Object.entries(PUERTAS) as [NombreDePuerta, number][]) {
        const cuerpo = nivel.pieza(nombre).cuerpo;
        if (!cuerpo) throw new Error(`El puente de paja: «${nombre}» tiene que ser cinemático`);
        puertas.set(nombre, crearPuertaQueBaja(cuerpo, cuanto, BAJAR));
      }
      esconder(nivel, 2);
      esconder(nivel, 5);
      const qeswa = nivel.qeswa("qeswa");
      const chaka = nivel.chaka("chaka");
      qeswa.alTrenzar(() => abrir("puerta-pampa"));
      qeswa.alSoltar(() => {
        soltaron = true;
      });
      chaka.alSoltar(() => {
        soltaron = true;
      });
      chaka.alAmarrar(() => {
        mostrar(nivel, 2);
        if (trenzaronAca && !soltaron) nivel.lograr();
      });
      dibujarDecoradoPuente(nivel.escena, DX, DECORADO);
    },
    alRetomar(n, nivel) {
      if (n >= 1) {
        trenzaronAca = false;
        nivel.qeswa("qeswa").trenzar();
        abrir("puerta-pampa", true);
      }
      if (n >= 2) {
        nivel.chaka("chaka").amarrar();
        mostrar(nivel, 2);
      }
      if (n >= 4) {
        // Como quedan al terminar: las de arriba cerradas, la de abajo abierta, y las tres regadas
        for (const k of [1, 2, 3]) {
          nivel.bocatoma(`bocatoma-${k}`).poner(k === 1);
          nivel.anden(`anden-${k}`).mojar();
        }
        abrir("puerta-terrazas", true);
      }
      if (n >= 5) {
        const llama = nivel.carguera("llama");
        llama.ponerEn(DX + PATIO.x, PATIO.z, Math.PI / 2);
        llama.llegar();
        mostrar(nivel, 5);
      }
    },
    cadaPaso(nivel) {
      // El agua: baja de arriba y se va por la primera bocatoma abierta
      let llega = true;
      for (const k of [3, 2, 1]) {
        const madre = nivel.agua(`madre-${k}`);
        madre.irA(llega ? madre.lleno : madre.fondo, AGUA);
        if (llega && nivel.bocatoma(`bocatoma-${k}`).abierta) {
          nivel.anden(`anden-${k}`).regar(true);
          llega = false;
        }
        const salto = nivel.agua(`salto-${k}`);
        salto.irA(llega ? salto.lleno : salto.fondo, AGUA * 4);
      }
      if ([1, 2, 3].every((k) => nivel.anden(`anden-${k}`).regada)) abrir("puerta-terrazas");
      // La llama, llegando al patio del tambo
      const llama = nivel.carguera("llama");
      if (llama.estado === "tranquila") {
        const t = llama.cuerpo.translation();
        if (Math.hypot(t.x - (DX + PATIO.x), t.z - PATIO.z) < PATIO.radio) {
          llama.llegar();
          mostrar(nivel, 5);
        }
      }
      for (const p of puertas.values()) p.pasar();
    },
  };
}
