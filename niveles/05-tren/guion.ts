// El guion del nivel 5, El tren bananero (TU-27). Lo que la escena no puede decir:
//   · El tren (mecanismos/tren.ts): cuando la plataforma se engancha al furgón, la locomotora sale con los dos vagones
//     y deja libre el paso a nivel. Llega a la estación de llegada `PLAZO` después y pita (sale vapor por la
//     chimenea). El reloj de la estación da una vuelta mientras va de viaje.
//   · La vía de la dresina, con su cambio: por el desvío si la palanca `cambio` está movida cuando la dresina pasa.
//     La señal del cambio gira con la palanca. La dresina se frena al llegar a la loma (punto 2), y si queda sola en
//     el puente roto vuelve a la loma.
//   · El Duende cuida la palanca del cambio y las dos del portón final; con el sombrero puesto las deja en paz.
//   · La grúa baja el gancho mientras alguien empuja la palanca de la caseta.
//   · El portón de la empacadora baja mientras el racimo grande está en la tolva (y queda abierto pasado el punto 4).
//   · El puente levadizo baja según el peso de la romana: los racimos que se sueltan junto a sus
//     ganchos quedan colgados (y queda abajo pasado el punto 5).
//   · El portón final baja mientras las dos palancas están movidas (y queda abierto pasado el punto 6).
//   · El logro, «Puntual»: llegar a la meta antes de que pite el tren, jugando desde la salida (al retomar más
//     adelante no se sabe cuánto tardaron: el tren ya llegó).
//   · Lo que es solo imagen: los rieles y sus puentes de caballetes, las matas de guineo (donde la escena tiene un
//     nodo `banano-*`) y el racimo de mínimos dorados del secreto (la zona `secreto` del .glb lo encuentra sola).
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import {
  crearLevadizo,
  crearRomana,
  crearTren,
  type Levadizo,
  type Romana,
  type Tren,
} from "../../apps/juego/src/niveles/mecanismos/tren";
import { crearVia, type Punto } from "../../apps/juego/src/niveles/mecanismos/via";
import { crearBanano, crearGancho, crearImagenRacimo, crearRieles } from "../../apps/juego/src/niveles/piezas-tren";

const PASOS_POR_SEGUNDO = 60;
/** Cuánto tarda el tren en llegar a la estación de llegada desde que sale (pasos): seis minutos. */
export const PLAZO = 6 * 60 * PASOS_POR_SEGUNDO;

/** La vía de la dresina (la parte de arriba de los rieles): de la estación sube a la loma por el puente de
 * caballetes, baja hacia el bananal y en el cambio sigue derecho hasta el puente roto o se desvía al bananal. */
export const VIA_DRESINA: readonly Punto[] = [
  [-13.4, 0, -4],
  [-11.0, 0, -4],
  [2.0, 0.8, -4],
  [7.0, 0.8, -4],
  [15.0, 0, -4],
  [22.0, 0, -4],
];
export const DESVIO: readonly Punto[] = [
  [18.0, 0, -7],
  [24.0, 0, -7],
];
/** Dónde queda la dresina en la loma, frenada (m de su vía). */
export const EN_LA_LOMA = 19.17;

/** El tren: por dónde sale de la estación (la trompa de la locomotora) y por dónde llega a la de llegada. */
const SALIDA_TREN: readonly Punto[] = [
  [-30, 0, 0],
  [-11, 0, 0],
  [-5, 0, 2.5],
  [14, 0, 2.5],
];
const LLEGADA_TREN: readonly Punto[] = [
  [20, 0, 0.5],
  [62, 0, 0.5],
];
/** Los portones (bajan tanto, en tantos pasos) y el puente levadizo. */
const PORTON_EMPACADORA = { nombre: "porton-empacadora", bajar: 2.5, pasos: 50, cerrar: 50 };
const PORTON_FINAL = { nombre: "porton-final", bajar: 1.5, pasos: 40, cerrar: 12 };
/** La tolva de la grúa: dentro de esta caja, el racimo grande abre el portón de la empacadora. */
const TOLVA = { desde: [30.3, 1.45, -14.9], hasta: [31.7, 2.8, -13.5] } as const;
/** Los ganchos de la romana, debajo de su plato (que está a 1.94 m). */
const GANCHOS: readonly Punto[] = [
  [45.05, 1.3, -8],
  [45.5, 1.3, -8],
  [45.95, 1.3, -8],
];
/** Los agujeros del Duende, al lado de cada palanca que cuida. */
const MADRIGUERAS = {
  cambio: { x: 10.2, y: 0.8, z: -1.0 },
  "palanca-a": { x: 55.4, y: 0, z: -3.5 },
  "palanca-b": { x: 55.4, y: 0, z: -12.5 },
} as const;
/** El racimo de mínimos dorados, en el rellano del puente roto. */
const DORADO = { x: 24.6, y: 0, z: -3.3 };

/** Un giro de `angulo` alrededor de un eje (x, y o z), como cuaternión. */
const giro = (eje: "y" | "z", angulo: number) => {
  const s = Math.sin(angulo / 2);
  return { x: 0, y: eje === "y" ? s : 0, z: eje === "z" ? s : 0, w: Math.cos(angulo / 2) };
};

/** Un portón que el guion baja de a poco: cuánto está abierto, de 0 a 1. */
interface Porton {
  readonly nombre: string;
  readonly bajar: number;
  readonly pasos: number;
  /** En cuántos pasos se cierra (puede ser más rápido que abrirse). */
  readonly cerrar: number;
  inicio: { x: number; y: number; z: number };
  abierta: number;
}

/** Lleva el portón hacia abierto o cerrado, un paso de su recorrido (o de una vez, con `ya`). */
function mover(nivel: NivelEnJuego, c: Porton, abrir: boolean, ya = false) {
  const cuerpo = nivel.pieza(c.nombre).cuerpo;
  if (!cuerpo) return;
  const objetivo = abrir ? 1 : 0;
  const falta = objetivo - c.abierta;
  const paso = 1 / (falta > 0 ? c.pasos : c.cerrar);
  c.abierta = ya ? objetivo : c.abierta + Math.sign(falta) * Math.min(paso, Math.abs(falta));
  const t = c.abierta * c.abierta * (3 - 2 * c.abierta);
  const destino = { x: c.inicio.x, y: c.inicio.y - c.bajar * t, z: c.inicio.z };
  if (ya) cuerpo.setTranslation(destino, true);
  cuerpo.setNextKinematicTranslation(destino);
}

export function crearGuion(): GuionDeNivel {
  const viaDresina = crearVia(VIA_DRESINA, { desde: 4, puntos: DESVIO });
  const empacadora: Porton = { ...PORTON_EMPACADORA, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const final: Porton = { ...PORTON_FINAL, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  let tren: Tren | null = null;
  let puente: Levadizo | null = null;
  let romana: Romana | null = null;
  /** Cuánto se hundió la romana, promediado (de 0 a 1). */
  let pesado = 0;
  let retomado = false;
  let solaEnElTope = 0;

  return {
    alEmpezar(nivel) {
      empacadora.inicio = { ...(nivel.pieza(PORTON_EMPACADORA.nombre).cuerpo?.translation() ?? empacadora.inicio) };
      final.inicio = { ...(nivel.pieza(PORTON_FINAL.nombre).cuerpo?.translation() ?? final.inicio) };
      puente = crearLevadizo(nivel, { nombre: "puente", pasos: 30 });
      puente.poner(0, true);
      romana = crearRomana(nivel, { plancha: "bascula", ganchos: GANCHOS });
      for (const [x, y, z] of GANCHOS) {
        const gancho = crearGancho(1.94 - y - 0.08);
        gancho.position.set(x, y, z);
        nivel.escena.add(gancho);
      }
      const cambio = nivel.palanca("cambio");
      nivel.dresina("dresina").seguir(viaDresina, () => cambio.activa);
      const duende = nivel.duende("duende");
      for (const [nombre, agujero] of Object.entries(MADRIGUERAS)) duende.cuidar(nivel.palanca(nombre), agujero);
      // El tren sale cuando la plataforma se engancha al furgón
      const elTren = crearTren(nivel, {
        locomotora: "locomotora",
        vapor: "vapor",
        largo: 4.2,
        vagones: [
          { vagon: "vagon-2", alto: 1.2, largo: 2.8 },
          { vagon: "vagon-1", alto: 0.55, largo: 2.4 },
        ],
        salida: SALIDA_TREN,
        llegada: LLEGADA_TREN,
        plazo: PLAZO,
      });
      tren = elTren;
      nivel.vagon("vagon-1").alEnganchar(() => elTren.salir());

      // La imagen: los rieles (con caballetes donde no hay piso), las matas de guineo y el racimo dorado
      const sinPiso = (x: number, z: number) => (x > -11.5 && x < 2) || (x > 7 && !(x > 23.5 && z > -5));
      nivel.escena.add(crearRieles(VIA_DRESINA, { caballete: sinPiso }));
      nivel.escena.add(crearRieles([[15, 0, -4], ...DESVIO], { caballete: (x) => x < 19 }));
      nivel.escena.add(crearRieles(SALIDA_TREN, { ancho: 1.2, caballete: (x) => x > -11.5 && x < -2 }));
      nivel.escena.add(crearRieles(LLEGADA_TREN, { ancho: 1.2, caballete: (x) => x > 40 }));
      nivel.plano.raiz.traverse((o) => {
        if (!o.name.startsWith("banano")) return;
        const i = Number(o.name.replace(/\D+/g, "")) || 1;
        const banano = crearBanano(o.scale.y, i, i % 3 === 0);
        o.getWorldPosition(banano.position);
        banano.rotation.y = i * 1.7;
        nivel.escena.add(banano);
      });
      // El racimo dorado cuelga de una mata seca, del lado de la cámara (la mata queda atrás)
      const seco = crearBanano(2.6, 11);
      seco.position.set(DORADO.x + 0.15, DORADO.y, DORADO.z - 0.45);
      nivel.escena.add(seco);
      const dorado = crearImagenRacimo({ alto: 0.7, radio: 0.26, semilla: 3, dorado: true });
      dorado.position.set(DORADO.x, DORADO.y + 1.3, DORADO.z);
      nivel.escena.add(dorado);
    },
    alAlcanzar(punto, nivel) {
      // En la loma la dresina se frena: de ahí se baja al bananal por el cambio
      if (punto === 2) nivel.dresina("dresina").frenar();
      // Puntual: en la meta antes de que pite el tren, jugando desde la salida
      if (punto === 6 && !retomado && tren?.salio && !tren.pito) nivel.lograr();
    },
    alRetomar(punto, nivel) {
      retomado ||= punto >= 1;
      if (punto >= 1) tren?.yaLlego();
      const dresina = nivel.dresina("dresina");
      if (punto >= 3) dresina.poner(viaDresina.largoDesvio, true);
      else if (punto === 2) dresina.poner(EN_LA_LOMA);
      else dresina.poner(0);
      nivel.grua("grua").volver();
      if (punto >= 4) nivel.racimo("racimo-grande").cuerpo.setTranslation({ x: 31, y: 1.9, z: -14.2 }, true);
      mover(nivel, empacadora, punto >= 4, true);
      puente?.poner(punto >= 5 ? 1 : 0, true);
      const duende = nivel.duende("duende");
      if (punto >= 6) duende.ponerSombrero();
      else duende.volver();
      mover(nivel, final, punto >= 6, true);
    },
    cadaPaso(nivel) {
      // El tren y el reloj de la estación, que da una vuelta mientras va de viaje
      tren?.pasar();
      nivel.pieza("reloj-aguja").cuerpo?.setNextKinematicRotation(giro("z", -2 * Math.PI * (tren?.viaje ?? 0)));

      // La señal del cambio gira con la palanca
      const desviado = nivel.palanca("cambio").activa;
      nivel.pieza("senal-cambio").cuerpo?.setNextKinematicRotation(giro("y", desviado ? Math.PI / 2 : 0));
      // La dresina que quedó sola en el puente roto vuelve a la loma
      const dresina = nivel.dresina("dresina");
      const enElPuenteRoto = dresina.enElTope && !dresina.porElDesvio;
      solaEnElTope = enElPuenteRoto && dresina.montados === 0 ? solaEnElTope + 1 : 0;
      if (solaEnElTope > 3 * PASOS_POR_SEGUNDO) {
        dresina.poner(EN_LA_LOMA);
        solaEnElTope = 0;
      }

      // La grúa baja el gancho mientras alguien empuja la palanca de la caseta; el racimo grande en la tolva abre
      // el portón de la empacadora
      nivel.grua("grua").mandar(nivel.palanca("palanca-grua").activa);
      const r = nivel.racimo("racimo-grande").cuerpo.translation();
      const [x0, y0, z0] = TOLVA.desde;
      const [x1, y1, z1] = TOLVA.hasta;
      const enLaTolva = r.x > x0 && r.x < x1 && r.y > y0 && r.y < y1 && r.z > z0 && r.z < z1;
      mover(nivel, empacadora, enLaTolva || nivel.puntoDeControl >= 4);

      // La romana cuelga los racimos que sueltan junto a sus ganchos; el puente levadizo baja con su peso
      romana?.pasar();
      // (el peso, promediado: los racimos colgados se mecen)
      pesado += (nivel.plancha("bascula").hundida - pesado) * 0.03;
      puente?.poner(nivel.puntoDeControl >= 5 ? 1 : Math.min(1, Math.max(0, (pesado - 0.15) / 0.33)));

      // El portón final, mientras las dos palancas están movidas
      const abiertas = nivel.palanca("palanca-a").activa && nivel.palanca("palanca-b").activa;
      mover(nivel, final, abiertas || nivel.puntoDeControl >= 6);
    },
  };
}
