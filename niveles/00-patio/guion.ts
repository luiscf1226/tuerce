// El guion del nivel 0, El patio (TU-13). Tegucigalpa, 31 de diciembre por la mañana: los dos muñecos despiertan en
// el montón de trapos. Cada misión termina en un punto de control (`&punto=N` empieza después de la misión N):
//   1. Levantarse del montón de trapos: empiezan tirados de espaldas y se levantan solos.
//   2. De a dos, el portón: la hoja está trabada mientras nadie empuje la aldaba (mecanismos/porton.ts).
//   3. De a dos, la escalera: pesa demasiado para uno; cargada por los dos hasta el muro, se apoya sola como rampa
//      (mecanismos/escalera.ts). El logro, «A la de tres», es llevarla sin botarla: que no toque el suelo con una
//      punta desde que la levantan hasta que queda apoyada.
//   4. El techo de lámina resbala: caminando se sube; el que se para, se va para abajo (mecanismos/lamina.ts).
//   5. El camión de la mudanza maniobra en la calle desde que llegan a la losa; la meta va en su palangana
//      (mecanismos/camion.ts). Frena cuando sube el primero.
// El secreto, la piñata olvidada en el palo de mango, es la zona `secreto` del .glb.
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import {
  type Camion,
  crearCamion,
  crearEscalera,
  crearLamina,
  crearPorton,
  type Escalera,
  type Lamina,
  type Porton,
} from "../../apps/juego/src/niveles/mecanismos";

/** Al empezar en la salida se los voltea de espaldas sobre los trapos con este empujón en la cabeza (N·s). Siguen
 * flojos hasta que quedan tirados (o hasta el paso `DESPERTAR`); después se levantan solos. */
const VOLTEAR = 2.2;
const DESPERTAR = 150;

export function crearGuion(): GuionDeNivel {
  let porton: Porton | undefined;
  let escalera: Escalera | undefined;
  let lamina: Lamina | undefined;
  let camion: Camion | undefined;
  /** Quiénes siguen flojos en el montón de trapos. */
  const dormidos = [false, false];

  const despertar = (nivel: NivelEnJuego, cual: 0 | 1) => {
    dormidos[cual] = false;
    nivel.munecos[cual].firmeza = 1;
  };

  return {
    alEmpezar(nivel) {
      porton = crearPorton(nivel, {
        hoja: "porton",
        aldaba: "aldaba",
        bisagra: { x: 2, y: 1.22, z: -1.72 },
        abre: 1.7,
      });
      escalera = crearEscalera(nivel, {
        nombre: "escalera",
        // El centro de la escalera (que mide 4.2 m), con su punta a menos de un metro del muro
        pie: { desde: { x: 9.7, y: 0, z: -3 }, hasta: { x: 11.5, y: 2.5, z: 3 } },
        pared: { x: 13, arriba: 2.2, suelo: 0 },
        z: [-2.6, 2.6],
      });
      lamina = crearLamina(nivel, { nombre: "lamina", bajada: { x: -1, z: 0 }, resbalar: 6 });
      camion = crearCamion(nivel, { nombre: "camion", eje: { x: 0, z: 1 }, amplitud: 3.2, periodo: 16, punto: 5 });
      // Despiertan tirados en el montón de trapos: flojos y de espaldas
      nivel.munecos.forEach((m, i) => {
        dormidos[i] = true;
        m.firmeza = 0;
        m.partes.cabeza.applyImpulse({ x: -Math.sin(m.rumbo) * VOLTEAR, y: 0, z: -Math.cos(m.rumbo) * VOLTEAR }, true);
      });
    },
    alRetomar(punto, nivel) {
      if (punto >= 1) for (const cual of [0, 1] as const) if (dormidos[cual]) despertar(nivel, cual);
      if (punto >= 2) porton?.abrir();
      if (punto >= 3) escalera?.apoyar(true);
      if (punto >= 4) camion?.arrancar();
      if (punto >= 5) camion?.frenar(true);
    },
    alAlcanzar(punto) {
      if (punto === 4) camion?.arrancar();
      if (punto === 5) camion?.frenar();
    },
    cadaPaso(nivel) {
      for (const cual of [0, 1] as const) {
        if (dormidos[cual] && (nivel.munecos[cual].estado === "caido" || nivel.pasos >= DESPERTAR))
          despertar(nivel, cual);
      }
      porton?.pasar();
      escalera?.pasar();
      if (escalera?.apoyada && escalera.cargada && !escalera.botada) nivel.lograr();
      lamina?.pasar();
      camion?.pasar();
    },
  };
}
