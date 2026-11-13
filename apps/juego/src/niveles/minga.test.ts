// El nivel 14, La minga (TU-47), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, la marea tapa la playa,
// El Caleuche corta la música si alguien se cae, y lo que se mueve viaja en la foto de la red. Para no repetir el
// camino entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x
// de las pruebas son las del nivel antes de correrlo `DX` (como en scripts/niveles/minga.mjs).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DX, MAREA, PALAFITOS } from "../../../../niveles/14-minga/guion";
import { PASO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import { mareaEn } from "./piezas-minga";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
const ESTE = Math.PI / 2;
const OESTE = -Math.PI / 2;
const NORTE = Math.PI;
/** Las alturas, como en scripts/niveles/minga.mjs. */
const ARENA = 0;
const P = 1.2;
const CUBIERTA = 3;
const PISO_CHALUPA = 0.385;

async function armarMinga() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("14-minga");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.minga?.crearGuion() });
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
type Minga = Awaited<ReturnType<typeof armarMinga>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no). */
function hasta(n: Minga, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

describe("La minga (niveles/14-minga)", () => {
  describe("la marea de la caleta", () => {
    it("baja, sube, se queda arriba y vuelve a bajar, siempre igual", async () => {
      const n = await armarMinga();
      const ciclo = MAREA.enBaja + MAREA.subiendo + MAREA.enAlta + MAREA.bajando;
      expect(mareaEn(0, MAREA)).toBe(MAREA.baja);
      expect(mareaEn(MAREA.enBaja + MAREA.subiendo + 1, MAREA)).toBe(MAREA.alta);
      expect(mareaEn(ciclo + 1, MAREA)).toBe(MAREA.baja);
      // El agua de la caleta la sigue, paso a paso
      const segundos = MAREA.enBaja + MAREA.subiendo / 2;
      n.correr(Math.round(segundos / PASO));
      // (el guion la pone antes de cada paso: la de ahora es la del paso anterior)
      expect(n.nivel.agua("marea").nivel).toBeCloseTo(mareaEn((n.nivel.pasos - 1) * PASO, MAREA), 3);
      expect(n.nivel.agua("marea").nivel).toBeGreaterThan(MAREA.baja + 0.3);
    });

    it("con la marea alta, el que se queda en la playa cae al agua y reaparece en el corredor, junto al otro", async () => {
      const n = await armarMinga();
      n.poner(0, 17.5, ARENA, 1.5);
      n.poner(1, 11, P, -0.4);
      const pasos = hasta(n, Math.round(16 / PASO), () => n.nivel.aguas.caidas[0] > 0);
      expect(pasos).toBeGreaterThan(Math.round(MAREA.enBaja / PASO));
      n.correr(30);
      expect(n.pelvis(0).y).toBeGreaterThan(P + 0.3);
      expect(n.nivel.aguas.caidas[1]).toBe(0);
    });
  });

  describe("misión 1: cruzar los palafitos antes de que suba la marea", () => {
    it("esperando la bajamar en cada palafito, llegan a la explanada", async () => {
      const n = await armarMinga();
      const pasos = cruzarLaCaleta(n, true);
      console.log(`caleta: llegan en ${pasos} pasos (${(pasos * PASO).toFixed(1)} s)`);
      expect(pasos).toBeGreaterThan(0);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    });

    it("sin esperar en el segundo palafito, la marea los alcanza en la playa", async () => {
      const n = await armarMinga();
      cruzarLaCaleta(n, false);
      expect(n.nivel.aguas.caidas[0] + n.nivel.aguas.caidas[1]).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(0);
    });

    it("el curanto del secreto está en la playa, detrás del segundo palafito", async () => {
      const n = await armarMinga();
      n.poner(0, 30, ARENA, 1);
      n.poner(1, 24.5, P, -0.4);
      expect(n.nivel.secreto).toBe(false);
      const pasos = hasta(
        n,
        400,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 33, -2.55);
        },
      );
      expect(pasos).toBeGreaterThan(-1);
    });
  });

  describe("misión 2: la minga, mover la casa entre los dos", () => {
    it("tirando cada uno de un cabo, la casa llega a su sitio sobre los troncos y se abre la tranquera", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(1);
      const casa = n.nivel.minga("casa");
      const pasos = tirarLaCasa(n, [0, 1], 2400);
      console.log(`minga: llega en ${pasos} pasos`);
      expect(pasos).toBeGreaterThan(0);
      expect(casa.avance).toBeCloseTo(casa.recorrido, 3);
      expect(casa.seSalio).toBe(false);
      // A hombro: sin salirse de los troncos
      expect(n.nivel.logro).toBe(true);
      // La tranquera se hunde y pasan al muelle
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(100);
      expect(n.nivel.pieza("tranquera").cuerpo?.translation().y).toBeLessThan(P - 1);
      const llegan = hasta(
        n,
        400,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          n.entradas[0] = n.haciaDonde(0, 63, 1.2);
        },
      );
      expect(llegan).toBeGreaterThan(-1);
    });

    it("solo, con un cabo, la casa no se mueve: es una casa entera", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(1);
      const casa = n.nivel.minga("casa");
      n.poner(1, 46, P, 2.5);
      expect(tirarLaCasa(n, [0], 600)).toBe(-1);
      expect(casa.tiradores).toEqual([0, null]);
      expect(casa.jaladas[0]).toBeGreaterThan(0.45);
      expect(casa.avance).toBe(0);
    });

    it("solo, con los dos cabos (uno en cada mano), tampoco", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(1);
      const casa = n.nivel.minga("casa");
      n.poner(1, 46, P, 2.5);
      n.poner(0, 51.4, P, 0, OESTE);
      n.entradas[0] = QUIETO;
      n.correr(20);
      // Las dos manijas, juntas delante de él, una para cada mano
      const delante = (lado: number) => ({ x: DX + 51.4 - 0.42, y: P + 1.17, z: lado * 0.2 });
      const agarra = hasta(
        n,
        120,
        () => casa.tiradores[0] === 0 && casa.tiradores[1] === 0,
        () => {
          casa.manijas.forEach((m, i) => {
            if (casa.tiradores[i] === 0) return;
            m.setTranslation(delante(i === 0 ? -1 : 1), true);
            m.setLinvel({ x: 0, y: 0, z: 0 }, true);
          });
          n.entradas[0] = { ...n.girarHacia(0, OESTE), ...AMBOS, avanzar: 0.3 };
        },
      );
      expect(agarra).toBeGreaterThan(-1);
      n.correr(600, () => {
        n.entradas[0] = { ...n.girarHacia(0, OESTE), ...AMBOS, avanzar: -1 };
      });
      expect(casa.tiradores).toEqual([0, 0]);
      expect(Math.min(...casa.jaladas)).toBeGreaterThan(0.45);
      expect(casa.avance).toBe(0);
    });

    it("tirando torcido se sale de los troncos y se atasca; los vecinos la vuelven a poner, pero no hay logro", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(1);
      const casa = n.nivel.minga("casa");
      let salio = 0;
      casa.alSalirse(() => salio++);
      // El turquesa tira hacia afuera (hacia +z) un buen rato; después, derecho
      let paso = 0;
      const pasos = tirarLaCasa(n, [0, 1], 3600, (j) => {
        paso++;
        return j === 1 && paso < 900 ? -0.5 : 0;
      });
      expect(salio).toBeGreaterThan(0);
      expect(casa.seSalio).toBe(true);
      expect(pasos).toBeGreaterThan(0);
      expect(casa.desvio).toBeLessThan(0.36);
      expect(n.nivel.logro).toBe(false);
    });
  });

  describe("misión 3: amarrar la chalupa con dos cabos", () => {
    it("cada uno lleva su cabo a su bita: se amarra, se arrima al muelle y por ella se llega al ancla", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(2);
      const chalupa = n.nivel.chalupa("chalupa");
      expect(chalupa.estado).toBe("suelta");
      const pasos = amarrar(n, [0, 1]);
      console.log(`chalupa: amarrada en ${pasos} pasos`);
      expect(pasos).toBeGreaterThan(0);
      expect(chalupa.estado).toBe("amarrada");
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(480);
      const c = enNivel(chalupa.cuerpo.translation());
      expect(Math.hypot(c.x - 80, c.z + 1.8)).toBeLessThan(0.2);
      // Bajan del muelle a la chalupa y la cruzan hasta los brazos del ancla
      const llega = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 3,
        () => {
          n.entradas[0] = n.haciaDonde(0, 81.2, -3.25);
        },
      );
      expect(llega).toBeGreaterThan(-1);
      expect(n.nivel.aguas.caidas[0]).toBe(0);
    });

    it("solo, con un cabo en su bita, no se amarra", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(2);
      const chalupa = n.nivel.chalupa("chalupa");
      n.poner(1, 70, P, 2);
      expect(amarrar(n, [0], 600)).toBe(-1);
      expect(chalupa.cabos[0]).toBe(0);
      const t = chalupa.manijas[0].translation();
      expect(Math.hypot(t.x - chalupa.bitas[0].x, t.z - chalupa.bitas[0].z)).toBeLessThan(0.5);
      expect(chalupa.estado).toBe("suelta");
    });

    it("solo, con los dos cabos en las manos, no alcanza las dos bitas (están a 5 m)", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(2);
      const chalupa = n.nivel.chalupa("chalupa");
      n.poner(1, 70, P, 2);
      n.poner(0, 80, P, 0, NORTE);
      n.entradas[0] = QUIETO;
      n.correr(20);
      const delante = (lado: number) => ({ x: DX + 80 + lado * 0.2, y: P + 1.17, z: -0.42 });
      const agarra = hasta(
        n,
        120,
        () => chalupa.cabos[0] === 0 && chalupa.cabos[1] === 0,
        () => {
          chalupa.manijas.forEach((m, i) => {
            if (chalupa.cabos[i] === 0) return;
            m.setTranslation(delante(i === 0 ? 1 : -1), true);
            m.setLinvel({ x: 0, y: 0, z: 0 }, true);
          });
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS };
        },
      );
      expect(agarra).toBeGreaterThan(-1);
      // Con los dos, va a una bita y después a la otra
      for (const b of chalupa.bitas) {
        const bita = enNivel(b);
        hasta(
          n,
          300,
          () => Math.hypot(n.pelvis(0).x - bita.x, n.pelvis(0).z - bita.z - 0.6) < 0.2,
          () => {
            n.entradas[0] = { ...n.haciaDonde(0, bita.x, bita.z + 0.6), ...AMBOS };
          },
        );
        n.correr(90, () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS };
        });
      }
      expect(chalupa.cabos).toEqual([0, 0]);
      expect(chalupa.estado).not.toBe("amarrada");
    });

    it("suelta, la chalupa queda lejos: saltando del muelle no se llega al ancla", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(2);
      n.poner(0, 81.2, P, -0.4, NORTE);
      n.entradas[0] = QUIETO;
      n.correr(10);
      let salto = 0;
      hasta(
        n,
        300,
        () => n.nivel.aguas.caidas[0] > 0,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), avanzar: 1, saltar: salto++ === 5 };
        },
      );
      expect(n.nivel.aguas.caidas[0]).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(2);
    });
  });

  describe("misión 4: subir al Caleuche por el ancla", () => {
    it("parados en sus brazos, la suben hasta la borda y pasan a la cubierta", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(3);
      const ancla = n.nivel.ancla("ancla");
      n.correr(30);
      expect(ancla.encima).toBe(2);
      const arriba = hasta(n, 600, () => ancla.estado === "arriba");
      expect(arriba).toBeGreaterThan(-1);
      expect(n.pelvis(0).y).toBeGreaterThan(CUBIERTA + 0.3);
      const llegan = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 4 && n.pelvis(0).z < -4.4 && n.pelvis(1).z < -4.4,
        () => {
          // Por el portalón: primero derecho hacia adentro de la cubierta, después a su lugar
          for (const [j, destino] of [
            [0, { x: 83.4, z: -5.0 }],
            [1, { x: 82.6, z: -5.8 }],
          ] as const) {
            const p = n.pelvis(j);
            n.entradas[j] = p.z > -4.2 ? n.haciaDonde(j, p.x, -4.6) : n.haciaDonde(j, destino.x, destino.z);
          }
        },
      );
      expect(llegan).toBeGreaterThan(-1);
      // Sin nadie, la vuelven a bajar
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      expect(hasta(n, 900, () => ancla.estado === "abajo")).toBeGreaterThan(-1);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    });
  });

  describe("misión 5: bailar en cubierta sin caerse al agua", () => {
    it("con los dos a bordo empieza la fiesta; aguantan la canción y El Caleuche baja la plancha a la meta", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(4);
      const caleuche = n.nivel.caleuche("caleuche");
      expect(caleuche.estado).toBe("fondeado");
      let rolido = 0;
      const pasos = bailar(n, () => {
        rolido = Math.max(rolido, Math.abs(caleuche.rolido));
      });
      console.log(`fiesta: contento en ${pasos} pasos, rolido máximo ${((rolido * 180) / Math.PI).toFixed(1)}°`);
      expect(pasos).toBeGreaterThan(Math.round((caleuche.compases * 0.8) / PASO));
      expect(caleuche.estado).toBe("contento");
      expect(caleuche.cortes).toBe(0);
      expect(rolido).toBeGreaterThan(0.08);
      // Baja la plancha y bajan por ella al muelle de la fiesta
      n.correr(150);
      const meta = hasta(
        n,
        1200,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          // Al medio de la popa y por la plancha
          n.entradas[0] = n.haciaDonde(0, n.pelvis(0).x < 98.5 ? 99 : 105, -5.6);
        },
      );
      expect(meta).toBeGreaterThan(-1);
    });

    it("si uno se cae al agua, se corta la música; cuando vuelve a estar a bordo, empieza de nuevo", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(4);
      const caleuche = n.nivel.caleuche("caleuche");
      n.correr(30);
      expect(hasta(n, 200, () => caleuche.estado === "de fiesta")).toBeGreaterThan(-1);
      n.correr(240);
      expect(caleuche.compas).toBeGreaterThan(2);
      // El turquesa se tira por la borda
      n.poner(1, 88, 0.5, -2.6);
      n.correr(2);
      expect(caleuche.estado).toBe("fondeado");
      expect(caleuche.cortes).toBe(1);
      // Reaparece junto al rojo, en la cubierta, y vuelve a sonar desde el principio
      expect(hasta(n, 300, () => caleuche.estado === "de fiesta")).toBeGreaterThan(-1);
      expect(caleuche.compas).toBe(0);
      expect(n.nivel.aguas.caidas[1]).toBe(1);
    });

    it("con uno solo a bordo no hay fiesta", async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(4);
      const caleuche = n.nivel.caleuche("caleuche");
      n.poner(1, 70, P, 2);
      n.correr(300);
      expect(caleuche.aBordo).toBe(1);
      expect(caleuche.estado).toBe("fondeado");
      expect(caleuche.rolido).toBe(0);
    });
  });

  describe("retomar", () => {
    for (const punto of [0, 1, 2, 3, 4, 5]) {
      it(`en el punto ${punto}, todo queda como debe y los dos quedan de pie`, async () => {
        const n = await armarMinga();
        n.nivel.avance.irA(punto);
        n.correr(90);
        const casa = n.nivel.minga("casa");
        expect(casa.estado === "llego").toBe(punto >= 2);
        const tranquera = n.nivel.pieza("tranquera").cuerpo?.translation().y ?? 0;
        expect(tranquera < P).toBe(punto >= 2);
        expect(n.nivel.chalupa("chalupa").estado === "amarrada").toBe(punto >= 3);
        expect(n.nivel.caleuche("caleuche").estado === "contento").toBe(punto >= 5);
        expect(n.nivel.aguas.caidas).toEqual([0, 0]);
        for (const j of [0, 1] as const) {
          expect(n.munecos[j].estado).toBe("de pie");
          expect(n.nivel.cayo(j)).toBe(false);
        }
        expect(n.nivel.puntoDeControl).toBe(punto);
      });
    }
  });

  it("dos corridas iguales dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarMinga();
      n.nivel.avance.irA(1);
      tirarLaCasa(n, [0, 1], 300);
      const todo: number[] = [];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una.length).toBeGreaterThan(0);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica todo, ve la marea, la casa, la chalupa amarrada y la fiesta", async () => {
    const anfitrion = await armarMinga();
    const invitado = await armarMinga();
    // El anfitrión: la casa andando y atascada, la chalupa amarrada, el ancla a medio subir y El Caleuche de fiesta
    anfitrion.nivel.avance.irA(1);
    let paso = 0;
    tirarLaCasa(anfitrion, [0, 1], 900, (j) => {
      paso++;
      return j === 1 && paso < 900 ? -0.6 : 0;
    });
    anfitrion.nivel.chalupa("chalupa").amarrar();
    anfitrion.poner(0, 80.8, PISO_CHALUPA, -3.22);
    anfitrion.poner(1, 86, CUBIERTA, -5.6);
    anfitrion.entradas[0] = QUIETO;
    anfitrion.entradas[1] = QUIETO;
    anfitrion.correr(150);
    const casa = anfitrion.nivel.minga("casa");
    const ancla = anfitrion.nivel.ancla("ancla");
    expect(ancla.estado).toBe("subiendo");
    expect(anfitrion.nivel.caleuche("caleuche").estado).toBe("fondeado");
    // Los dos a bordo: arranca la fiesta
    anfitrion.poner(0, 85, CUBIERTA, -5.6);
    anfitrion.correr(150);
    expect(anfitrion.nivel.caleuche("caleuche").estado).toBe("de fiesta");

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const pasarFoto = () => {
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
    };
    pasarFoto();
    pasarFoto();
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["casa", "chalupa", "ancla", "caleuche"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // Lo que ve el invitado, sin correr el guion: cuánto anduvo la casa, la chalupa amarrada, el ancla y la fiesta
    const casaAlla = invitado.nivel.minga("casa");
    expect(casaAlla.avance).toBeCloseTo(casa.avance, 2);
    expect(casaAlla.desvio).toBeCloseTo(casa.desvio, 2);
    expect(invitado.nivel.chalupa("chalupa").estado).toBe("amarrada");
    expect(invitado.nivel.ancla("ancla").altura).toBeCloseTo(ancla.altura, 2);
    expect(invitado.nivel.caleuche("caleuche").estado).toBe("de fiesta");
    // La marea (y el agua del puerto) le llega con su marcador, como todo lo que se mueve
    deAlla.forEach((c, i) => {
      const real = deAca[i];
      if (real) expect(posicion(c).distanceTo(posicion(real))).toBeLessThan(0.003);
    });
    // Y El Caleuche contento, con la plancha abajo
    anfitrion.nivel.caleuche("caleuche").contentar();
    anfitrion.correr(1);
    pasarFoto();
    pasarFoto();
    expect(invitado.nivel.caleuche("caleuche").estado).toBe("contento");
  });
});

/** Cada uno agarra la manija de su cabo (`quien[0]` la del lado −z, `quien[1]` la del +z) y camina para atrás,
 * hacia el este, hasta que la casa llega. Devuelve en cuántos pasos (o −1). */
function tirarLaCasa(n: Minga, quien: readonly (0 | 1)[], pasos: number, torcer?: (j: 0 | 1) => number) {
  const casa = n.nivel.minga("casa");
  casa.manijas.forEach((m, i) => {
    const j = quien[i];
    if (j === undefined) return;
    const t = enNivel(m.translation());
    n.poner(j, t.x + 0.42, P, t.z, OESTE);
  });
  for (const j of quien) n.entradas[j] = QUIETO;
  n.correr(20);
  // Con los brazos alzados, se arriman hasta agarrarla
  const agarran = hasta(
    n,
    120,
    () => quien.every((j, i) => casa.tiradores[i] === j),
    () => {
      quien.forEach((j, i) => {
        n.entradas[j] = { ...n.girarHacia(j, OESTE), ...AMBOS, avanzar: casa.tiradores[i] === j ? 0 : 0.4 };
      });
    },
  );
  if (agarran < 0) return -1;
  return hasta(
    n,
    pasos,
    () => casa.estado === "llego",
    () => {
      for (const j of quien) {
        const rumbo = OESTE + (torcer?.(j) ?? 0);
        n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS, avanzar: -1 };
      }
    },
  );
}

/** Cruzan la caleta desde la salida: al primer palafito, al segundo y a la explanada, cada tramo en una bajamar
 * (salen de cada corredor cuando la marea empieza a bajar). Con `esperar` falso, del primer palafito siguen derecho
 * hasta la explanada. Devuelve en cuántos pasos llegaron al punto 1 (o −1). */
function cruzarLaCaleta(n: Minga, esperar: boolean) {
  const [p1, p2] = PALAFITOS;
  const ciclo = MAREA.enBaja + MAREA.subiendo + MAREA.enAlta + MAREA.bajando;
  /** Cuando la marea empieza a bajar: ahí se sale de un corredor. */
  const salir = () => {
    const t = (n.nivel.pasos * PASO) % ciclo;
    const baja = MAREA.enBaja + MAREA.subiendo + MAREA.enAlta;
    return t > baja - 0.2 && t < baja + 0.6;
  };
  // Los tramos: hasta dónde caminar (x de cada uno; los dos van por su carril) y si ahí se espera
  const tramos: { x: number; z: number; espera: boolean }[] = [
    { x: (p1.x0 + p1.x1) / 2, z: -0.4, espera: true },
    ...(esperar ? [{ x: (p2.x0 + p2.x1) / 2, z: -0.4, espera: true }] : []),
    { x: 43.6, z: 1.2, espera: false },
  ];
  const carril = [0.35, -0.35];
  let k = 0;
  let esperando = false;
  const llegaron = (x: number) => [0, 1].every((j) => n.pelvis(j as 0 | 1).x > x - 0.4);
  return hasta(
    n,
    Math.round(80 / PASO),
    () => n.nivel.puntoDeControl >= 1 || n.nivel.aguas.caidas[0] + n.nivel.aguas.caidas[1] > 0,
    () => {
      const tramo = tramos[k];
      if (!tramo) return;
      if (llegaron(tramo.x) && tramo.espera && !esperando) esperando = true;
      if (esperando) {
        n.entradas[0] = QUIETO;
        n.entradas[1] = QUIETO;
        if (salir()) {
          esperando = false;
          k++;
        }
        return;
      }
      for (const j of [0, 1] as const) {
        const p = n.pelvis(j);
        // Por la playa, por el carril de adelante; subiendo y bajando los palafitos, por el medio de la rampa
        const enRampa = PALAFITOS.some((q) => p.x > q.x0 - 2.9 && p.x < q.x1 + 2.9);
        const z = enRampa || tramo.z < 0 ? -0.4 + (carril[j] ?? 0) : tramo.z + (carril[j] ?? 0);
        n.entradas[j] = n.haciaDonde(j, Math.max(p.x + 1.5, Math.min(tramo.x, p.x + 1.5)), z);
      }
    },
  );
}

/** Cada uno agarra un cabo de la chalupa del poste (`quien[0]` el de proa, `quien[1]` el de popa) y lo lleva a su
 * bita. Devuelve en cuántos pasos se amarró (o −1). */
function amarrar(n: Minga, quien: readonly (0 | 1)[], pasos = 900) {
  const chalupa = n.nivel.chalupa("chalupa");
  chalupa.manijas.forEach((m, i) => {
    const j = quien[i];
    if (j === undefined) return;
    const t = enNivel(m.translation());
    n.poner(j, t.x, P, t.z + 0.45, NORTE);
  });
  for (const j of quien) n.entradas[j] = QUIETO;
  n.correr(20);
  const agarran = hasta(
    n,
    120,
    () => quien.every((j, i) => chalupa.cabos[i] === j),
    () => {
      quien.forEach((j, i) => {
        n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS, avanzar: chalupa.cabos[i] === j ? 0 : 0.4 };
      });
    },
  );
  if (agarran < 0) return -1;
  return hasta(
    n,
    pasos,
    () => chalupa.estado === "amarrada",
    () => {
      quien.forEach((j, i) => {
        const b = chalupa.bitas[i];
        if (!b) return;
        const bita = enNivel(b);
        // Detrás de la bita (del lado de tierra), con el cabo en las manos por encima de ella
        const lejos = Math.hypot(n.pelvis(j).x - bita.x, n.pelvis(j).z - bita.z - 0.45);
        n.entradas[j] =
          lejos > 0.15
            ? { ...n.haciaDonde(j, bita.x, bita.z + 0.45), ...AMBOS, avanzar: Math.min(1, lejos * 2) }
            : { ...n.girarHacia(j, NORTE), ...AMBOS };
      });
    },
  );
}

/** Los dos, en la cubierta, bailan quedándose cerca del medio hasta que El Caleuche queda contento. Devuelve en
 * cuántos pasos (o −1). */
function bailar(n: Minga, mirar?: () => void) {
  const caleuche = n.nivel.caleuche("caleuche");
  const lugares = [
    { x: 87, z: -5.2 },
    { x: 87, z: -6.0 },
  ];
  return hasta(
    n,
    Math.round(30 / PASO),
    () => caleuche.estado === "contento",
    () => {
      for (const j of [0, 1] as const) {
        const l = lugares[j];
        if (!l) continue;
        const p = n.pelvis(j);
        const lejos = Math.hypot(p.x - l.x, p.z - l.z);
        n.entradas[j] = lejos > 0.35 ? { ...n.haciaDonde(j, l.x, l.z), avanzar: Math.min(1, lejos) } : QUIETO;
      }
      mirar?.();
    },
  );
}
