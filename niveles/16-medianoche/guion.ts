// El guion del nivel 16, La medianoche (TU-49): la Amazonía, el último nivel. El viaje empezó en el patio de
// Tegucigalpa la mañana del 31 de diciembre (niveles/00-patio) y termina acá, a la medianoche. Lo que la escena no
// puede decir:
//   · Es de noche: la escena se oscurece al empezar (la luna, la niebla de noche).
//   · Las huellas del Curupira, que tiene los pies al revés: en la trocha por donde se fue, los dedos apuntan para
//     acá. El que llega al final de una trocha equivocada (acaba en el agua) le saca una carcajada.
//   · La montaria vacía que quedó lejos del muelle vuelve sola (antes del punto 3).
//   · El arbolito: se lo viste de plantón. Soltado en el hoyo del claro (sin nadie que lo agarre), queda plantado: el
//     Curupira se alegra y el monte cerrado se hunde. El Curupira pide el árbol desde que llegan a la tierra firme, y
//     después espera en la playa a ver los fuegos.
//   · La meta aparece cuando se encienden los fuegos del castillo grande.
//   · El logro, «Feliz año»: encender los tres castillos a la medianoche, en menos de un minuto entre el primero y el
//     último.
//   · Los árboles del igapó, los açaís, el delfín rosado del recodo (el secreto: la zona `secreto` del .glb lo
//     encuentra sola), la flor de los nenúfares, el hoyo del claro y la luna se dibujan acá.
// En línea, el invitado no corre este guion (salvo `alEmpezar`): el arbolito plantado, el monte, el Curupira, los
// fuegos y la montaria le llegan en la foto.

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import { PASO } from "../../apps/juego/src/motor/bucle";
import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { vestirDeNoche } from "../../apps/juego/src/niveles/noche";
import {
  bajarLasLuces,
  crearArbolDeIgapo,
  crearDelfin,
  crearFlorDeNenufar,
  crearImagenArbolito,
  crearImagenHoyo,
  crearLuna,
} from "../../apps/juego/src/niveles/piezas-medianoche";
import { crearImagenPalmera } from "../../apps/juego/src/niveles/piezas-rio";
import { crearHuella } from "../../apps/juego/src/niveles/sisimite";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/medianoche.mjs: las x
 * de abajo son las de antes de correrlo. */
export const DX = -53;
/** El agua y la tierra. */
const W = 0;
const G = 0.3;
/** El final de las trochas equivocadas (x0, z0, x1, z1): el que llega ahí hace reír al Curupira. */
export const PERDIDOS: readonly (readonly [number, number, number, number])[] = [
  [8.6, 0.6, 11, 2.6],
  [20.6, -2.6, 23, -0.6],
];
/** Las huellas del Curupira: x, z y hacia dónde apuntan los dedos (+1: hacia +x). Se fue por donde apuntan para
 * acá (−x): por la trocha de atrás en la primera bifurcación y por la de adelante en la segunda. */
const HUELLAS: readonly (readonly [number, number, number])[] = [
  ...[4.5, 5.3, 6.1, 6.9, 7.7].map((x, i) => [x, -1.6 + (i % 2 ? 0.14 : -0.14), -1] as const),
  ...[4.5, 5.3, 6.1, 6.9, 7.7].map((x, i) => [x, 1.6 + (i % 2 ? 0.14 : -0.14), 1] as const),
  ...[16.5, 17.3, 18.1, 18.9, 19.7].map((x, i) => [x, 1.6 + (i % 2 ? 0.14 : -0.14), -1] as const),
  ...[16.5, 17.3, 18.1, 18.9, 19.7].map((x, i) => [x, -1.6 + (i % 2 ? 0.14 : -0.14), 1] as const),
];
/** La montaria vacía, a más de esto de su lugar (m) y tantos pasos sin nadie, vuelve al muelle. Donde queda al
 * llegar a la tierra firme (el centro de su caja, sin `DX`). */
export const MONTARIA = { lejos: 2, pasos: 480, llegada: { x: 67.6, y: W + 0.14, z: 0 } } as const;
/** El hoyo del claro: dónde, a cuánto (m, de costado) tiene que caer el arbolito y cuánto se hunde al plantarlo. */
export const HOYO = { x: 82, z: 0, radio: 0.55, hundir: 0.32 } as const;
/** El arbolito: la mitad de su alto (el terrón, como en scripts/niveles/medianoche.mjs). */
const ARBOLITO = { medio: 0.25 };
/** El Curupira: donde pide el árbol (junto al hoyo) y donde mira los fuegos (en la playa), con su rumbo. */
export const CURUPIRA = {
  pide: { x: 83.6, z: -1.5 },
  playa: { x: 103.7, z: 0.5, rumbo: Math.PI },
} as const;
/** El monte cerrado: cuánto se hunde (m) y en cuántos pasos. */
const MONTE = { bajar: 3.4, pasos: 150 };
/** El logro: los tres castillos encendidos con menos de tanto entre el primero y el último (s). */
export const MEDIANOCHE = { segundos: 60, fuegos: ["fuegos-1", "fuegos-2", "fuegos-3"] } as const;
/** El delfín: dónde salta (cada `cada` segundos, de x a x + `largo`). */
const DELFIN = { x: 36.4, z: -7.6, cada: 4.5, largo: 1.8 };
/** Cuánto más bajan las luces que en la noche de tuerce (veces su intensidad). */
const NOCHE = { luces: 0.7 };
/** Donde se esconde la zona de la meta mientras no aparece. */
const ESCONDIDA = -100;

/** Los árboles del igapó: x, z, alto. Junto a las trochas, a los lados del canal de la montaria y en la tierra firme. */
const ARBOLES: readonly (readonly [number, number, number])[] = [
  [-5, -3.2, 9],
  [-1.5, -4.6, 11],
  [3, -5.5, 12],
  [7.5, -3.6, 10],
  [9, 0.1, 9.5],
  [11, -5.8, 12.5],
  [15.5, -4.2, 11],
  [19, 0, 10],
  [22.5, 0.1, 8.5],
  [24.5, -4.0, 12],
  [27.5, -5.2, 10],
  [31, -8.6, 12],
  [39.5, -8.2, 13],
  [42, -4, 10],
  ...[46.5, 49.5, 52.5, 55.5, 58.5, 61.5, 64.5, 67.5].map(
    (x, i) => [x, -1.9 - (i % 2) * 0.5, 8 + (i % 3) * 1.5] as const,
  ),
  ...[47, 53, 59, 65].map((x, i) => [x, -5.5 - (i % 2), 12 + (i % 2)] as const),
  [74, -2.9, 11],
  [77.5, -5, 13],
  [88.6, -2.9, 10],
  [91, -4.6, 12],
];
/** Los açaís: x, z, alto. */
const ACAIS: readonly (readonly [number, number, number])[] = [
  [-3, -2.4, 7],
  [5.5, -4.2, 8],
  [33.8, -9.2, 9],
  [37.6, -6.4, 7],
  [86.8, -2.9, 8],
  [93.5, -2.9, 6],
  [111.5, -2.5, 7.5],
];

export function crearGuion(): GuionDeNivel {
  let meta: Volumen["centro"] | undefined;
  let plantado = false;
  let monteBajando = -1;
  let monteArriba: { x: number; y: number; z: number } | undefined;
  let montariaSola = 0;
  /** Cuándo se encendió cada castillo (en pasos), para el logro. */
  const encendidos = new Map<string, number>();
  /** Quién está ahora en el final de cada trocha equivocada (para reírse una vez por llegada). */
  const perdidos = new Set<string>();

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`La medianoche: falta el punto ${n}`);
    return p.zona;
  };
  const mostrarMeta = (nivel: NivelEnJuego, ya: boolean) => {
    if (!meta) return;
    const zona = punto(nivel, 5);
    zona.centro.copy(meta);
    if (!ya) zona.centro.y = ESCONDIDA;
  };
  /** Pone el monte cerrado a medio hundir (de 0, cerrado, a 1, abajo). */
  const ponerMonte = (nivel: NivelEnJuego, f: number, deUna: boolean) => {
    const c = nivel.pieza("monte-cerrado").cuerpo;
    if (!c || !monteArriba) return;
    const s = f * f * (3 - 2 * f);
    const donde = { x: monteArriba.x, y: monteArriba.y - MONTE.bajar * s, z: monteArriba.z };
    if (deUna) c.setTranslation(donde, true);
    else c.setNextKinematicTranslation(donde);
  };
  /** Planta el arbolito en el hoyo: queda quieto (cinemático), hundido en la tierra. */
  const plantar = (nivel: NivelEnJuego, deUna: boolean) => {
    if (plantado) return;
    plantado = true;
    const cuerpo = nivel.bloque("arbolito").cuerpo;
    cuerpo.setBodyType(nivel.rapier.RigidBodyType.KinematicPositionBased, true);
    cuerpo.setTranslation({ x: DX + HOYO.x, y: G + ARBOLITO.medio - HOYO.hundir, z: HOYO.z }, true);
    cuerpo.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    const curupira = nivel.curupira("curupira");
    curupira.alegrar();
    if (deUna) {
      monteBajando = -1;
      ponerMonte(nivel, 1, true);
    } else monteBajando = 0;
  };
  /** El Curupira se va a la playa a ver los fuegos. */
  const alaPlaya = (nivel: NivelEnJuego) => {
    const c = CURUPIRA.playa;
    nivel.curupira("curupira").mudarse({ x: DX + c.x, y: G, z: c.z }, c.rumbo);
  };
  /** Anota que se encendió un castillo y, si ya están los tres a tiempo, da el logro. */
  const anotar = (nivel: NivelEnJuego, nombre: string) => {
    if (!encendidos.has(nombre)) encendidos.set(nombre, nivel.pasos);
    if (encendidos.size < MEDIANOCHE.fuegos.length) return;
    const pasos = [...encendidos.values()];
    if ((Math.max(...pasos) - Math.min(...pasos)) * PASO <= MEDIANOCHE.segundos) nivel.lograr();
  };

  return {
    alEmpezar(nivel) {
      // La medianoche: la escena de noche, también los jirones de niebla
      vestirDeNoche(nivel.escena, nivel.escena.getObjectByName("niebla"));
      // Y más oscura que la noche de tuerce: es la medianoche, que los fuegos alumbren
      bajarLasLuces(nivel.escena, NOCHE.luces);
      // El arbolito: el bloque se viste de plantón con su terrón
      const arbolito = nivel.pieza("arbolito");
      const medio = nivel.plano.piezas.find((p) => p.nombre === "arbolito")?.caja.medio;
      if (medio) {
        for (const hijo of [...arbolito.objeto.children]) arbolito.objeto.remove(hijo);
        arbolito.objeto.add(crearImagenArbolito(medio));
      }
      const monte = nivel.pieza("monte-cerrado").cuerpo?.translation();
      if (monte) monteArriba = { x: monte.x, y: monte.y, z: monte.z };
      // La meta, hasta que se enciendan los fuegos del castillo grande
      meta = punto(nivel, 5).centro.clone();
      mostrarMeta(nivel, false);
      for (const nombre of MEDIANOCHE.fuegos) {
        nivel.fuegos(nombre).alEncender(() => {
          anotar(nivel, nombre);
          if (nombre === "fuegos-1") mostrarMeta(nivel, true);
        });
      }
      dibujarLaSelva(nivel);
    },

    alAlcanzar(n, nivel) {
      const curupira = nivel.curupira("curupira");
      // Se va del monte; reaparece junto al hoyo a pedir su árbol cuando llegan a la tierra firme
      if (n === 1) curupira.esconder();
      if (n === 3 && !plantado) {
        curupira.mudarse({ x: DX + CURUPIRA.pide.x, y: G, z: CURUPIRA.pide.z }, 0);
        curupira.pedir({ x: DX + HOYO.x, y: G, z: HOYO.z });
      }
      if (n === 4) alaPlaya(nivel);
    },

    alRetomar(n, nivel) {
      const curupira = nivel.curupira("curupira");
      if (n >= 1) curupira.esconder();
      if (n >= 3) {
        const l = MONTARIA.llegada;
        nivel.montaria("montaria").llevar({ x: DX + l.x, y: l.y, z: l.z });
        curupira.mudarse({ x: DX + CURUPIRA.pide.x, y: G, z: CURUPIRA.pide.z }, 0);
        curupira.pedir({ x: DX + HOYO.x, y: G, z: HOYO.z });
      }
      if (n >= 4) {
        plantar(nivel, true);
        alaPlaya(nivel);
      }
      // En la meta, el castillo grande ya está encendido: la fiesta empieza otra vez
      if (n >= 5) {
        nivel.fuegos("fuegos-1").encender();
        mostrarMeta(nivel, true);
      }
    },

    cadaPaso(nivel) {
      // El que llega al final de una trocha equivocada hace reír al Curupira (una vez por llegada)
      if (nivel.puntoDeControl < 1) {
        nivel.munecos.forEach((m, i) => {
          const t = m.partes.pelvis.translation();
          PERDIDOS.forEach(([x0, z0, x1, z1], k) => {
            const clave = `${i}-${k}`;
            const adentro = t.x > DX + x0 && t.x < DX + x1 && t.z > z0 && t.z < z1 && t.y > G;
            if (adentro && !perdidos.has(clave)) nivel.curupira("curupira").reir();
            if (adentro) perdidos.add(clave);
            else perdidos.delete(clave);
          });
        });
      }

      // La montaria vacía, lejos del muelle, vuelve sola (antes de llegar a la tierra firme)
      if (nivel.puntoDeControl < 3) {
        const montaria = nivel.montaria("montaria");
        const t = montaria.cuerpo.translation();
        const casa = montaria.casa.centro;
        const lejos = Math.hypot(t.x - casa.x, t.z - casa.z) > MONTARIA.lejos;
        montariaSola = montaria.aBordo === 0 && lejos ? montariaSola + 1 : 0;
        if (montariaSola > MONTARIA.pasos) {
          montaria.volver();
          montariaSola = 0;
        }
      }

      // El arbolito soltado en el hoyo (sin nadie que lo agarre) queda plantado
      if (!plantado) {
        const arbolito = nivel.bloque("arbolito");
        const t = arbolito.cuerpo.translation();
        const v = arbolito.cuerpo.linvel();
        const enElHoyo = Math.hypot(t.x - (DX + HOYO.x), t.z - HOYO.z) < HOYO.radio;
        const enElSuelo = t.y < G + ARBOLITO.medio + 0.12 && Math.hypot(v.x, v.y, v.z) < 0.5;
        if (arbolito.cargadores === 0 && enElHoyo && enElSuelo) plantar(nivel, false);
      }
      if (monteBajando >= 0) {
        monteBajando++;
        ponerMonte(nivel, Math.min(1, monteBajando / MONTE.pasos), false);
        if (monteBajando >= MONTE.pasos) monteBajando = -1;
      }

      // Los castillos que se encendieron (el aviso ya los anota; esto cubre los que se encendieron al retomar)
      for (const nombre of MEDIANOCHE.fuegos) if (nivel.fuegos(nombre).encendidos) anotar(nivel, nombre);
    },
  };
}

/** Lo que solo se ve: los árboles del igapó y los açaís, las huellas, el hoyo, la flor de los nenúfares, el delfín del
 * recodo y la luna. */
function dibujarLaSelva(nivel: NivelEnJuego) {
  const corteza = materialCorteza(COLORES.silueta, { repetir: [2, 3] });
  const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  for (const [i, [x, z, alto]] of ARBOLES.entries()) {
    const arbol = crearArbolDeIgapo(corteza, hojas, alto, i);
    // Los del agua tienen el pie en el agua; los de tierra, en la tierra
    arbol.position.set(DX + x, x > 70 && x < 92 && z > -3.2 ? G : W - 0.3, z);
    arbol.rotation.y = i * 2.3;
    nivel.escena.add(arbol);
  }
  for (const [i, [x, z, alto]] of ACAIS.entries()) {
    const { grupo } = crearImagenPalmera(corteza, hojas, alto, 0.1);
    grupo.position.set(DX + x, W - 0.2, z);
    grupo.rotation.set(0.05 * Math.sin(i * 2.1), i * 1.3, 0.05 * Math.cos(i * 1.7));
    nivel.escena.add(grupo);
  }
  for (const [i, [x, z, hacia]] of HUELLAS.entries()) {
    const huella = crearHuella();
    huella.scale.setScalar(0.26);
    huella.position.set(DX + x, G + 0.006, z);
    huella.rotation.y = (hacia * Math.PI) / 2;
    if (i % 2 === 1) huella.scale.x = -0.26;
    nivel.escena.add(huella);
  }
  const hoyo = crearImagenHoyo(0.45);
  hoyo.position.set(DX + HOYO.x, G, HOYO.z);
  nivel.escena.add(hoyo);
  // Una flor blanca junto a algunas hojas: se mueve con la hoja
  for (const [nombre, x, z] of [
    ["nenufar-2", 0.6, 0.5],
    ["nenufar-4", -0.5, -0.6],
    ["nenufar-recodo-2", 0.4, -0.5],
  ] as const) {
    const flor = crearFlorDeNenufar();
    flor.position.set(x, 0.12, z);
    nivel.pieza(nombre).objeto.add(flor);
  }
  // El delfín rosado del recodo: sale a respirar en un arco cada tanto (con los pasos del nivel, siempre igual)
  const delfin = crearDelfin();
  delfin.scale.setScalar(0.8);
  const malla = delfin.children[0];
  if (malla) {
    malla.onBeforeRender = () => {
      const t = (nivel.pasos * PASO) % DELFIN.cada;
      const f = t / 1.3;
      if (f > 1) {
        delfin.scale.setScalar(0.001);
        return;
      }
      delfin.scale.setScalar(0.8);
      delfin.position.set(DX + DELFIN.x + DELFIN.largo * f, W - 0.35 + 1.0 * Math.sin(Math.PI * f), DELFIN.z);
      delfin.rotation.set(0, 0, (0.5 - f) * 1.8);
    };
  }
  delfin.position.set(DX + DELFIN.x + DELFIN.largo / 2, W + 0.5, DELFIN.z);
  nivel.escena.add(delfin);
  // La luna, alta sobre el río: se ve cuando la cámara mira los fuegos
  const luna = crearLuna(2.2);
  luna.position.set(DX + 80, 16, -44);
  nivel.escena.add(luna);
}
