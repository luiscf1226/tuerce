// El nivel 16, La medianoche (TU-49), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, el Curupira se ríe del
// que se pierde y se alegra con su árbol, los fuegos se encienden juntos, y lo que se mueve viaja en la foto de la red.
// Para no repetir el camino entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco
// más cerca). Las x de las pruebas son las del nivel antes de correrlo `DX` (como en scripts/niveles/medianoche.mjs).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CURUPIRA, DX, HOYO, MONTARIA } from "../../../../niveles/16-medianoche/guion";
import { PASO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
const ESTE = Math.PI / 2;
const NORTE = Math.PI;
/** El agua y la tierra, como en scripts/niveles/medianoche.mjs. */
const W = 0;
const G = 0.3;

async function armarMedianoche() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("16-medianoche");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.medianoche?.crearGuion() });
  const entradas: [EntradaMuneco, EntradaMuneco] = [QUIETO, QUIETO];
  /** Corre esos pasos como la escena: guion y piezas, muñecos, el paso, puntos de control y caídas. */
  const correr = (pasos: number, cadaPaso?: (paso: number) => void) => {
    for (let i = 0; i < pasos; i++) {
      cadaPaso?.(i);
      nivel.antes(entradas);
      munecos[0].pasar(entradas[0]);
      munecos[1].pasar(entradas[1]);
      mundo.step();
      nivel.despues();
      armado.guardar();
    }
  };
  const pelvis = (j: 0 | 1) => enNivel(munecos[j].partes.pelvis.translation());
  /** Pone al muñeco de pie en (x, y, z), mirando hacia `rumbo`. */
  const poner = (j: 0 | 1, x: number, y: number, z: number, rumbo = ESTE) =>
    munecos[j].reaparecer({ x: x + DX, y: y + 0.02, z }, rumbo);
  /** La entrada para girar en el lugar hasta mirar hacia `rumbo`. */
  const girarHacia = (j: 0 | 1, rumbo: number): EntradaMuneco => {
    const d = Math.atan2(Math.sin(rumbo - munecos[j].rumbo), Math.cos(rumbo - munecos[j].rumbo));
    return { ...QUIETO, girar: Math.max(-1, Math.min(1, d * 3)) };
  };
  /** La entrada para ir caminando hacia (x, z): gira hacia allá y avanza. */
  const haciaDonde = (j: 0 | 1, x: number, z: number, extra: Partial<EntradaMuneco> = {}): EntradaMuneco => {
    const p = pelvis(j);
    return { ...girarHacia(j, Math.atan2(x - p.x, z - p.z)), avanzar: 1, ...extra };
  };
  return { rapier, mundo, plano, armado, nivel, munecos, entradas, correr, pelvis, poner, haciaDonde, girarHacia };
}
type Medianoche = Awaited<ReturnType<typeof armarMedianoche>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no). */
function hasta(n: Medianoche, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina por esos puntos (x, z) uno tras otro, hasta llegar al último (o hasta `listo`). Devuelve en cuántos pasos. */
function caminar(
  n: Medianoche,
  j: 0 | 1,
  puntos: readonly (readonly [number, number])[],
  pasos: number,
  listo?: () => boolean,
) {
  let k = 0;
  return hasta(
    n,
    pasos,
    () => listo?.() ?? k >= puntos.length,
    () => {
      const destino = puntos[k];
      if (!destino) {
        n.entradas[j] = QUIETO;
        return;
      }
      const p = n.pelvis(j);
      if (Math.hypot(destino[0] - p.x, destino[1] - p.z) < 0.35) k++;
      n.entradas[j] = n.haciaDonde(j, destino[0], destino[1]);
    },
  );
}

/** Los nenúfares del camino (x, z) y la orilla de enfrente. */
const HOJAS = [
  [30.0, 0.3],
  [32.2, -0.3],
  [34.4, 0.3],
  [36.6, -0.3],
  [38.8, 0.2],
  [41, 0.1],
] as const;

/** Cruza saltando de hoja en hoja (salta desde cerca del borde de la que pisa) hasta `hojas`. Devuelve en cuántos
 * pasos llegó a la última (o −1). */
function saltarHojas(n: Medianoche, j: 0 | 1, hojas: readonly (readonly [number, number])[], listo: () => boolean) {
  let k = 0;
  let espera = 0;
  return hasta(n, 1500, listo, () => {
    const p = n.pelvis(j);
    const destino = hojas[k];
    if (!destino) {
      n.entradas[j] = QUIETO;
      return;
    }
    const d = Math.hypot(destino[0] - p.x, destino[1] - p.z);
    if (d < 0.5 && k < hojas.length - 1) k++;
    // Salta cuando el borde de la hoja de destino queda a menos de un metro
    const saltar = espera === 0 && n.munecos[j].estado === "de pie" && d < 1.75 && d > 1.1;
    if (saltar) espera = 40;
    if (espera > 0) espera--;
    n.entradas[j] = { ...n.haciaDonde(j, destino[0], destino[1]), saltar };
  });
}

/** Sube a los dos a la montaria desde el muelle: el rojo a la proa y el turquesa a la popa (los de `quienes`). */
function subirALaMontaria(n: Medianoche, quienes: readonly (0 | 1)[] = [0, 1]) {
  const montaria = n.nivel.montaria("montaria");
  n.nivel.avance.irA(2);
  n.poner(0, 44.6, G, -0.25);
  n.poner(1, 44.2, G, 0.25);
  if (!quienes.includes(1)) n.poner(1, 41.5, G, 1.5);
  if (!quienes.includes(0)) n.poner(0, 41.5, G, -1.5);
  n.correr(10);
  const puestos: Record<0 | 1, number> = { 0: 49.1, 1: 46.7 };
  hasta(
    n,
    600,
    () => quienes.every((j) => Math.abs(n.pelvis(j).x - (puestos[j] ?? 0)) < 0.25),
    () => {
      for (const j of quienes) {
        const p = n.pelvis(j);
        const falta = (puestos[j] ?? 0) - p.x;
        n.entradas[j] =
          Math.abs(falta) < 0.25
            ? n.girarHacia(j, ESTE)
            : n.haciaDonde(j, puestos[j] ?? 0, 0, { avanzar: Math.min(1, Math.abs(falta) * 2) });
      }
    },
  );
  for (const j of quienes) n.entradas[j] = n.girarHacia(j, ESTE);
  n.correr(30);
  expect(montaria.aBordo).toBe(quienes.length);
  return montaria;
}

/** Reman: cada uno alza los brazos `arriba` pasos de cada `cada`, empezando en su `desfase`. Al llegar a la tierra
 * firme se bajan caminando. Devuelve en cuántos pasos llegaron al punto 3 (o −1). */
function remar(
  n: Medianoche,
  remeros: readonly { j: 0 | 1; desfase: number }[],
  pasos: number,
  cada = 48,
  arriba = 22,
) {
  const montaria = n.nivel.montaria("montaria");
  let llego = false;
  return hasta(
    n,
    pasos,
    () => n.nivel.puntoDeControl >= 3,
    (i) => {
      llego ||= enNivel(montaria.cuerpo.translation()).x > 66.8;
      for (const { j, desfase } of remeros) {
        if (llego) n.entradas[j] = n.haciaDonde(j, 72, 0);
        else n.entradas[j] = { ...n.girarHacia(j, ESTE), ...((i + cada - desfase) % cada < arriba ? AMBOS : {}) };
      }
    },
  );
}

/** Va a agarrar los chisperos de esos fuegos: cada uno de `quienes` se para frente al suyo (el rojo al de −x, el
 * turquesa al de +x), mirando al río, y alza los brazos. Devuelve en cuántos pasos se encendieron (o −1). */
function encender(n: Medianoche, nombre: string, quienes: readonly (0 | 1)[], pasos = 400) {
  const fuegos = n.nivel.fuegos(nombre);
  for (const j of quienes) {
    const ch = enNivel(fuegos.chisperos[j].translation());
    n.poner(j, ch.x, G, ch.z + 0.42, NORTE);
  }
  n.correr(15);
  return hasta(
    n,
    pasos,
    () => fuegos.encendidos,
    () => {
      for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS };
    },
  );
}

/** Los dos cargan el arbolito desde su tocón, uno de cada lado, caminando al este hasta que el terrón pasa `hastaX`;
 * ahí lo sueltan. Devuelve si llegó y cuánto se alejó del tocón. */
function cargarArbolito(n: Medianoche, quienes: readonly (0 | 1)[], hastaX = HOYO.x - 0.1) {
  const arbolito = n.nivel.bloque("arbolito");
  n.poner(0, 74.9, G, 0.42);
  n.poner(1, 74.9, G, -0.42);
  n.entradas[0] = QUIETO;
  n.entradas[1] = QUIETO;
  n.correr(20);
  for (const j of quienes) n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(40);
  const cargadores = arbolito.cargadores;
  let lejos = 0;
  const llego = hasta(
    n,
    1200,
    () => enNivel(arbolito.cuerpo.translation()).x > hastaX,
    () => {
      for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), ...AMBOS, avanzar: 0.7 };
      const t = enNivel(arbolito.cuerpo.translation());
      lejos = Math.max(lejos, Math.hypot(t.x - 75.5, t.z));
    },
  );
  n.entradas[0] = QUIETO;
  n.entradas[1] = QUIETO;
  n.correr(90);
  return { arbolito, llego, lejos, cargadores };
}

describe("La medianoche (niveles/16-medianoche)", () => {
  it("tiene sus piezas, su agua, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarMedianoche();
    expect(plano.numero).toBe(16);
    expect(plano.nombre).toBe("La medianoche");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "bloque arbolito",
      "curupira curupira",
      "fuegos fuegos-1",
      "fuegos fuegos-2",
      "fuegos fuegos-3",
      "montaria montaria",
      "nenufar nenufar-1",
      "nenufar nenufar-2",
      "nenufar nenufar-3",
      "nenufar nenufar-4",
      "nenufar nenufar-5",
      "nenufar nenufar-recodo-1",
      "nenufar nenufar-recodo-2",
    ]);
    expect(nivel.curupira("curupira").estado).toBe("mirando");
    expect(nivel.fuegos("fuegos-1").estado).toBe("apagados");
    expect(() => nivel.montaria("curupira")).toThrow(/montaria «curupira»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 2: el igarapé de los nenúfares", () => {
    it("las hojas flotan casi a ras de la orilla y se ladean con el que salta encima", async () => {
      const n = await armarMedianoche();
      n.correr(120);
      const hoja = n.nivel.nenufar("nenufar-1");
      const arriba = hoja.cuerpo.translation().y + 0.12;
      expect(arriba).toBeGreaterThan(0.12);
      expect(arriba).toBeLessThan(0.3);
      expect(
        enNivel(hoja.cuerpo.translation()).distanceTo(new THREE.Vector3(30, hoja.cuerpo.translation().y, 0.3)),
      ).toBeLessThan(0.2);
      expect(hoja.ladeo).toBeLessThan(0.02);
      // Uno parado en el borde la ladea y la hunde un poco; la hoja lo lleva
      n.poner(0, 30.55, arriba, 0.3);
      n.correr(60);
      expect(hoja.encima).toBe(1);
      expect(hoja.ladeo).toBeGreaterThan(0.015);
      expect(hoja.cuerpo.translation().y + 0.12).toBeLessThan(arriba);
      expect(n.munecos[0].estado).toBe("de pie");
      // Vacía, el tallo la vuelve a su lugar y se endereza
      n.poner(0, 27.5, G, 0);
      n.correr(240);
      expect(hoja.encima).toBe(0);
      expect(hoja.ladeo).toBeLessThan(0.02);
      expect(
        enNivel(hoja.cuerpo.translation()).distanceTo(new THREE.Vector3(30, hoja.cuerpo.translation().y, 0.3)),
      ).toBeLessThan(0.2);
    });

    it("se cruza saltando de hoja en hoja hasta el muelle de la montaria", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(1);
      n.poner(0, 28.3, G, 0.3);
      n.poner(1, 27, G, -1.5);
      n.correr(20);
      const pasos = saltarHojas(n, 0, HOJAS, () => n.nivel.puntoDeControl >= 2);
      expect(pasos).toBeGreaterThan(0);
      expect(n.nivel.aguas.caidas[0]).toBe(0);
    });
  });
  describe("misión 3: la montaria, remando los dos al mismo ritmo", () => {
    it("de a dos, al mismo ritmo, suben el río contra la corriente hasta la tierra firme", async () => {
      const n = await armarMedianoche();
      const montaria = subirALaMontaria(n);
      const pasos = remar(
        n,
        [
          { j: 0, desfase: 0 },
          { j: 1, desfase: 0 },
        ],
        3000,
      );
      console.log(`montaria: llegan en ${pasos} pasos, ${montaria.aCompas} de ${montaria.paladas} paladas a compás`);
      expect(montaria.aCompas).toBe(montaria.paladas);
      expect(pasos).toBeGreaterThan(0);
    });

    it("fuera de ritmo no avanzan: la corriente se la lleva", async () => {
      const n = await armarMedianoche();
      const montaria = subirALaMontaria(n);
      const pasos = remar(
        n,
        [
          { j: 0, desfase: 0 },
          { j: 1, desfase: 24 },
        ],
        2000,
      );
      expect(pasos).toBe(-1);
      expect(montaria.paladas).toBeGreaterThan(60);
      expect(montaria.aCompas).toBe(0);
      expect(enNivel(montaria.cuerpo.translation()).x).toBeLessThan(50);
    });

    it("solo no se puede: con un remo la corriente se la lleva", async () => {
      const n = await armarMedianoche();
      const montaria = subirALaMontaria(n, [1]);
      const pasos = remar(n, [{ j: 1, desfase: 0 }], 2000);
      expect(pasos).toBe(-1);
      expect(enNivel(montaria.cuerpo.translation()).x).toBeLessThan(50);
    });

    it("solo, aunque reme lo más rápido que puede, tampoco", async () => {
      const n = await armarMedianoche();
      const montaria = subirALaMontaria(n, [0]);
      expect(remar(n, [{ j: 0, desfase: 0 }], 2000, 35, 17)).toBe(-1);
      expect(enNivel(montaria.cuerpo.translation()).x).toBeLessThan(50);
    });

    it("la montaria vacía que quedó lejos del muelle vuelve sola", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(2);
      const montaria = n.nivel.montaria("montaria");
      montaria.llevar({ x: DX + 58, y: W + 0.14, z: 0 });
      n.correr(MONTARIA.pasos + 30);
      expect(enNivel(montaria.cuerpo.translation()).x).toBeLessThan(49);
    });
  });
  describe("misión 1: las huellas del Curupira, que tiene los pies al revés", () => {
    it("siguiendo las huellas que apuntan para acá (la trocha de atrás y después la de adelante) se llega al claro", async () => {
      const n = await armarMedianoche();
      const camino = [
        [3, -1.6],
        [13.2, -1.6],
        [15, 0],
        [16.8, 1.6],
        [25.5, 1.6],
        [27.6, 0],
      ] as const;
      const pasos = caminar(n, 0, camino, 1500, () => n.nivel.puntoDeControl >= 1);
      expect(pasos).toBeGreaterThan(0);
      expect(n.nivel.curupira("curupira").risas).toBe(0);
      expect(n.nivel.aguas.caidas[0]).toBe(0);
      // Al llegar, el Curupira se va del monte
      expect(n.nivel.curupira("curupira").estado).toBe("escondido");
    });

    it("la trocha equivocada acaba en el agua y el Curupira se ríe del que llega ahí; no se pasa a la otra por el monte", async () => {
      const n = await armarMedianoche();
      const curupira = n.nivel.curupira("curupira");
      expect(
        caminar(
          n,
          0,
          [
            [3, 1.6],
            [10.4, 1.6],
          ],
          800,
        ),
      ).toBeGreaterThan(0);
      n.correr(10);
      expect(curupira.risas).toBe(1);
      expect(curupira.estado).toBe("riendo");
      // Por el monte no se pasa a la trocha de atrás: se para, gira y camina hacia allá
      n.correr(60, () => {
        n.entradas[0] = n.girarHacia(0, Math.atan2(-2, -3));
      });
      n.correr(240, () => {
        n.entradas[0] = n.haciaDonde(0, 7, -1.6);
      });
      expect(n.pelvis(0).z).toBeGreaterThan(0.6);
      expect(n.nivel.aguas.caidas[0]).toBe(0);
      // Y siguiendo derecho se cae al agua
      n.entradas[0] = QUIETO;
      n.correr(30);
      const cayo = hasta(
        n,
        600,
        () => n.nivel.aguas.caidas[0] > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, 13, 1.6);
        },
      );
      expect(cayo).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(0);
      // Pasado el rato, deja de reírse
      n.entradas[0] = QUIETO;
      n.correr(180);
      expect(curupira.estado).toBe("mirando");
    });
  });

  describe("misión 4: el árbol que pide el Curupira", () => {
    it("lo llevan entre los dos hasta el hoyo; plantado, el Curupira se alegra y se abre el monte", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(3);
      n.correr(5);
      const curupira = n.nivel.curupira("curupira");
      expect(curupira.estado).toBe("pidiendo");
      const { arbolito, llego, cargadores } = cargarArbolito(n, [0, 1]);
      expect(cargadores).toBe(2);
      expect(llego).toBeGreaterThan(0);
      const t = enNivel(arbolito.cuerpo.translation());
      expect(Math.hypot(t.x - HOYO.x, t.z - HOYO.z)).toBeLessThan(0.05);
      expect(arbolito.cuerpo.isKinematic()).toBe(true);
      expect(curupira.estado).toBe("contento");
      // El monte cerrado se hundió: se pasa caminando hasta el punto 4
      n.correr(120);
      expect(
        caminar(
          n,
          0,
          [
            [84.5, 1.2],
            [88.8, 0],
          ],
          900,
          () => n.nivel.puntoDeControl >= 4,
        ),
      ).toBeGreaterThan(0);
      // Y el Curupira se va a la playa a ver los fuegos
      const c = enNivel(curupira.cuerpo.translation());
      expect(Math.hypot(c.x - CURUPIRA.playa.x, c.z - CURUPIRA.playa.z)).toBeLessThan(0.3);
    });

    it("solo no se puede: el arbolito pesa 9 kg y uno solo no lo mueve de su tocón", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(3);
      const { llego, lejos, cargadores } = cargarArbolito(n, [0]);
      expect(cargadores).toBe(1);
      expect(llego).toBe(-1);
      expect(lejos).toBeLessThan(0.3);
      expect(n.nivel.curupira("curupira").estado).toBe("pidiendo");
      // Y el monte sigue cerrado
      n.poner(0, 85, G, 0);
      n.correr(240, () => {
        n.entradas[0] = n.haciaDonde(0, 88.8, 0);
      });
      expect(n.nivel.puntoDeControl).toBe(3);
    });

    it("soltado lejos del hoyo no se planta", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(3);
      const { arbolito } = cargarArbolito(n, [0, 1], 79);
      expect(arbolito.cuerpo.isKinematic()).toBe(false);
      expect(n.nivel.curupira("curupira").estado).toBe("pidiendo");
    });
  });

  describe("misión 5: los fuegos de Año Nuevo, encendidos entre los dos", () => {
    it("de a dos: cada uno agarra un chispero, prenden las mechas, salen los cohetes y aparece la meta", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(4);
      const fuegos = n.nivel.fuegos("fuegos-1");
      expect(encender(n, "fuegos-1", [0, 1])).toBeGreaterThan(0);
      expect(fuegos.estado).toBe("mecha");
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      // La mecha arde y salen los cohetes: suben y estallan sobre el río, lejos de los muñecos
      n.correr(Math.round(4.5 / PASO));
      expect(fuegos.estado).toBe("disparando");
      expect(fuegos.estallidos).toBeGreaterThan(0);
      const cohete = enNivel(fuegos.cohetes[0]?.translation() ?? { x: 0, y: 0, z: 0 });
      expect(cohete.y).toBeGreaterThan(4);
      expect(cohete.z).toBeLessThan(-10);
      expect(fuegos.cielo).toBeGreaterThan(0.5);
      for (const j of [0, 1] as const) expect(n.munecos[j].estado).toBe("de pie");
      // La meta: en la playa, frente al castillo
      expect(caminar(n, 0, [[102, 1.4]], 600, () => n.nivel.puntoDeControl >= 5)).toBeGreaterThan(0);
      n.correr(Math.round(12 / PASO));
      expect(fuegos.estado).toBe("quemados");
      expect(fuegos.estallidos).toBe(9);
    });

    it("solo no se puede: con un chispero agarrado la mecha chispea y nada más, y la meta no aparece", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(4);
      const fuegos = n.nivel.fuegos("fuegos-1");
      expect(encender(n, "fuegos-1", [0], 300)).toBe(-1);
      expect(fuegos.estado).toBe("chispeando");
      expect(fuegos.agarrados).toEqual([true, false]);
      // Ni corriendo de un chispero al otro: se apaga al soltarlo
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(fuegos.estado).toBe("apagados");
      n.poner(0, 102, G, 1.4);
      n.correr(60);
      expect(n.nivel.puntoDeControl).toBe(4);
    });

    it("el logro, «Feliz año»: los tres castillos encendidos a la medianoche", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(4);
      for (const nombre of ["fuegos-2", "fuegos-1", "fuegos-3"]) {
        expect(encender(n, nombre, [0, 1]), nombre).toBeGreaterThan(0);
        n.entradas[0] = QUIETO;
        n.entradas[1] = QUIETO;
        n.correr(30);
      }
      n.correr(5);
      expect(n.nivel.logro).toBe(true);
    });

    it("sin logro si entre el primero y el último pasa más de un minuto", async () => {
      const n = await armarMedianoche();
      n.nivel.avance.irA(4);
      expect(encender(n, "fuegos-2", [0, 1])).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(Math.round(61 / PASO));
      expect(encender(n, "fuegos-1", [0, 1])).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(30);
      expect(encender(n, "fuegos-3", [0, 1])).toBeGreaterThan(0);
      n.correr(5);
      expect(n.nivel.logro).toBe(false);
    });
  });

  it("el secreto: el delfín rosado del recodo, a dos nenúfares del camino", async () => {
    const n = await armarMedianoche();
    n.nivel.avance.irA(1);
    n.poner(0, 34.4, W + 0.25, 0.3, NORTE);
    n.correr(30);
    const encontro = saltarHojas(
      n,
      0,
      [
        [34.0, -2.05],
        [34.6, -4.25],
        [34.6, -6.4],
      ],
      () => n.nivel.secreto,
    );
    expect(encontro).toBeGreaterThan(0);
  });

  it("retomando cada punto, el nivel queda como estaría al llegar", async () => {
    for (const punto of [1, 2, 3, 4, 5]) {
      const n = await armarMedianoche();
      n.nivel.avance.irA(punto);
      n.correr(30);
      const curupira = n.nivel.curupira("curupira");
      const montaria = enNivel(n.nivel.montaria("montaria").cuerpo.translation());
      const arbolito = n.nivel.bloque("arbolito");
      expect(curupira.estado, `punto ${punto}`).toBe(punto < 3 ? "escondido" : punto === 3 ? "pidiendo" : "contento");
      expect(montaria.x > 60, `punto ${punto}`).toBe(punto >= 3);
      expect(arbolito.cuerpo.isKinematic(), `punto ${punto}`).toBe(punto >= 4);
      expect(n.nivel.pieza("monte-cerrado").cuerpo?.translation().y ?? 0, `punto ${punto}`).toBeLessThan(
        punto >= 4 ? -1.2 : 10,
      );
      expect(n.nivel.fuegos("fuegos-1").encendidos, `punto ${punto}`).toBe(punto >= 5);
      // Los muñecos quedan de pie en su punto, sin caer
      for (const j of [0, 1] as const) expect(n.munecos[j].estado, `punto ${punto}`).toBe("de pie");
      expect(n.nivel.puntoDeControl).toBe(punto);
    }
  });

  it("en línea: con la foto del anfitrión, el invitado ubica las piezas y ve reír al Curupira, el árbol y los fuegos", async () => {
    const anfitrion = await armarMedianoche();
    const invitado = await armarMedianoche();
    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const pasarFoto = (veces = 1) => {
      const foto = leerFoto(
        escribirFoto({
          paso: 300,
          ack: 0,
          estados: ["de pie", "de pie"],
          agarres: 0,
          rumbos: [0, 0],
          velocidades: [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
          ],
          punto: 0,
          reloj: 0,
          posiciones: new Float32Array(deAca.flatMap((c) => [c.translation().x, c.translation().y, c.translation().z])),
          rotaciones: new Float32Array(
            deAca.flatMap((c) => [c.rotation().x, c.rotation().y, c.rotation().z, c.rotation().w]),
          ),
        }),
      );
      if (!foto) throw new Error("la foto no se pudo leer");
      for (let k = 0; k < veces; k++) {
        deAlla.forEach((c, i) => {
          c.setTranslation(
            { x: foto.posiciones[3 * i] ?? 0, y: foto.posiciones[3 * i + 1] ?? 0, z: foto.posiciones[3 * i + 2] ?? 0 },
            false,
          );
          const r = foto.rotaciones;
          c.setRotation({ x: r[4 * i] ?? 0, y: r[4 * i + 1] ?? 0, z: r[4 * i + 2] ?? 0, w: r[4 * i + 3] ?? 1 }, false);
        });
        invitado.armado.guardar();
        invitado.armado.dibujar(1, 0);
      }
    };
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());

    // El Curupira se ríe del que se perdió en la trocha de adelante
    caminar(
      anfitrion,
      0,
      [
        [3, 1.6],
        [10.4, 1.6],
      ],
      800,
    );
    anfitrion.correr(20);
    expect(anfitrion.nivel.curupira("curupira").estado).toBe("riendo");
    pasarFoto();
    expect(invitado.nivel.curupira("curupira").estado).toBe("riendo");

    // Más adelante: el arbolito plantado, el monte abierto, la montaria en la tierra firme remando, el Curupira
    // contento en la playa y los cohetes del castillo grande estallando sobre el río
    anfitrion.nivel.avance.irA(4);
    anfitrion.nivel.fuegos("fuegos-1").encender();
    anfitrion.correr(Math.round(4.4 / PASO));
    const fuegos = anfitrion.nivel.fuegos("fuegos-1");
    expect(fuegos.estado).toBe("disparando");
    pasarFoto(90);
    for (const nombre of ["arbolito", "monte-cerrado", "curupira", "montaria", "nenufar-1", "nenufar-recodo-2"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    const remos = anfitrion.nivel.montaria("montaria").remos;
    invitado.nivel.montaria("montaria").remos.forEach((r, i) => {
      const real = remos[i];
      if (real) expect(posicion(r).distanceTo(posicion(real))).toBeLessThan(0.003);
    });
    // Lo que ve el invitado, sin correr el guion: el Curupira bailando, los estallidos y la cámara que mira al cielo
    expect(invitado.nivel.curupira("curupira").estado).toBe("contento");
    const alla = invitado.nivel.fuegos("fuegos-1");
    expect(alla.estallidos).toBeGreaterThan(0);
    expect(alla.estallidos).toBe(fuegos.estallidos);
    expect(alla.cielo).toBeGreaterThan(0.5);
    expect(invitado.nivel.fuegos("fuegos-2").estallidos).toBe(0);
  });

  it("es determinista: dos corridas iguales, con la montaria, los nenúfares y los fuegos, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarMedianoche();
      subirALaMontaria(n);
      remar(
        n,
        [
          { j: 0, desfase: 0 },
          { j: 1, desfase: 3 },
        ],
        200,
      );
      n.nivel.fuegos("fuegos-2").encender();
      n.correr(200);
      const todo: number[] = [];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(await correrUna()).toEqual(una);
  });
});
