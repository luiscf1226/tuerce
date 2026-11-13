// El nivel 9, Los canales de Xochimilco (TU-42), en un mundo de Rapier de verdad, en Node: cada misión se puede
// terminar con los muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, La
// Llorona se ríe de los porrazos y baja el agua, y lo que se mueve viaja en la foto de la red. Para no repetir el
// camino entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x
// de las pruebas son las del nivel antes de correrlo `DX` (como en scripts/niveles/canales.mjs).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DX, LLANTO, TRAJINERA } from "../../../../niveles/09-canales/guion";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import type { Trajinera } from "./piezas-canales";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
const ESTE = Math.PI / 2;
const OESTE = -Math.PI / 2;
/** Las alturas, como en scripts/niveles/canales.mjs. */
const G = 0.3;
const GC = 0.55;

async function armarCanales() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("09-canales");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.canales?.crearGuion() });
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
type Canales = Awaited<ReturnType<typeof armarCanales>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no). */
function hasta(n: Canales, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

describe("Los canales (niveles/09-canales)", () => {
  describe("misión 1: la trajinera, cada uno con la pértiga de su lado", () => {
    it("flota junto al muelle con el piso a su altura, y se sube a ella caminando", async () => {
      const n = await armarCanales();
      const t = n.nivel.trajinera("trajinera");
      n.correr(60);
      const piso = t.cuerpo.translation().y + 0.15;
      expect(piso).toBeGreaterThan(GC - 0.05);
      expect(piso).toBeLessThan(GC + 0.05);
      // Del muelle a la popa, caminando
      expect(
        hasta(
          n,
          300,
          () => t.encima(n.munecos[0].partes.pelvis.translation()) && n.pelvis(0).x > 0.9,
          () => {
            n.entradas[0] = n.haciaDonde(0, 1.2, -1.1);
          },
        ),
      ).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(t.aBordo).toBe(1);
    });

    it("de a dos: cada uno empuja de su lado y llegan a la chinampa de La Llorona", async () => {
      const n = await armarCanales();
      subirALaPopa(n);
      const pasos = navegar(n, "trajinera", [{ x: 30, z: -1.6 }], 2400, {
        parar: (c) => c.x > 20.5,
        bajar: { x: 18.6, z: 1.4 },
        listo: () => n.nivel.puntoDeControl >= 1,
      });
      console.log(`trajinera: llegan en ${pasos} pasos`);
      expect(pasos).toBeGreaterThan(0);
      expect(n.nivel.llorona("llorona").risas).toBe(0);
    });

    it("con la trajinera en marcha, uno camina hacia atrás por el piso sin salir disparado", async () => {
      const n = await armarCanales();
      const t = n.nivel.trajinera("trajinera");
      subirALaPopa(n);
      // Ya en el remanso, andando: el rojo empuja en la popa y el turquesa va adelante, en la proa
      t.llevar({ x: DX + 15, y: LLANTO.crecida + TRAJINERA.flota, z: -1.6 });
      n.poner(0, 12.6, GC, -1.1);
      n.poner(1, 16.8, GC, -1.6);
      n.correr(20);
      t.cuerpo.setLinvel({ x: 0.9, y: 0, z: 0 }, true);
      n.correr(30, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
      });
      expect(t.cuerpo.linvel().x).toBeGreaterThan(0.5);
      const sobre = () => n.munecos[1].partes.pelvis.translation().x - t.cuerpo.translation().x;
      const antes = sobre();
      n.correr(40, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        n.entradas[1] = { ...n.girarHacia(1, ESTE), avanzar: -1 };
      });
      expect(sobre()).toBeLessThan(antes - 0.4);
      expect(sobre()).toBeGreaterThan(antes - 1.6);
      expect(t.encima(n.munecos[1].partes.pelvis.translation())).toBe(true);
    });

    it("con una sola pértiga no le gana a la corriente: se tuerce y no llega", async () => {
      const n = await armarCanales();
      const t = n.nivel.trajinera("trajinera");
      subirALaPopa(n);
      n.poner(1, -6, GC, 1.5);
      n.correr(30);
      // Empujando solo con la de la derecha, se tuerce hacia la izquierda y se atora en el carril
      let giro = 0;
      n.correr(1800, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        giro = Math.max(giro, Math.abs(Math.atan2(Math.sin(t.rumbo - ESTE), Math.cos(t.rumbo - ESTE))));
      });
      expect(t.pertigas).toEqual([null, 0]);
      expect(giro).toBeGreaterThan(0.05);
      expect(enNivel(t.cuerpo.translation()).x).toBeLessThan(6);
      expect(n.nivel.puntoDeControl).toBe(0);
    });

    it("solo, pasándose de un lado al otro de la popa, tampoco: la corriente se la lleva de vuelta", async () => {
      const n = await armarCanales();
      const t = n.nivel.trajinera("trajinera");
      subirALaPopa(n);
      n.poner(1, -6, GC, 1.5);
      n.correr(30);
      // Empuja de un lado y se cruza al otro, una y otra vez, enderezándola
      let lado = 1;
      let fase = 0;
      let maximo = 0;
      n.correr(3600, () => {
        const c = t.cuerpo.translation();
        const derecha = new THREE.Vector3(0, 0, 1).applyQuaternion(t.cuerpo.rotation());
        const objetivo = new THREE.Vector3(c.x, 0, c.z).addScaledVector(derecha, lado * 0.55);
        const p = n.munecos[0].partes.pelvis.translation();
        const lejos = Math.hypot(objetivo.x - p.x, objetivo.z - p.z);
        if (fase > 0) {
          fase--;
          n.entradas[0] = { ...QUIETO, ...AMBOS };
          if (fase === 0) lado = -lado;
        } else if (lejos > 0.15) n.entradas[0] = n.haciaDonde(0, objetivo.x - DX, objetivo.z);
        else fase = 90;
        maximo = Math.max(maximo, enNivel(c).x);
      });
      expect(maximo).toBeLessThan(7);
      expect(n.nivel.puntoDeControl).toBe(0);
    });

    it("la trajinera vacía que quedó lejos del muelle vuelve sola", async () => {
      const n = await armarCanales();
      const t = n.nivel.trajinera("trajinera");
      t.llevar({ x: DX + 10, y: LLANTO.crecida + TRAJINERA.flota, z: -1.6 });
      n.correr(TRAJINERA.pasos + 20);
      expect(enNivel(t.cuerpo.translation()).x).toBeCloseTo(3.05, 1);
    });
  });

  describe("misión 2: La Llorona, que llora tanto que sube el agua", () => {
    it("con el canal crecido, el arco de la trajinera no pasa bajo el puente", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(1);
      const t = n.nivel.trajinera("trajinera");
      expect(n.nivel.agua("canal").nivel).toBeCloseTo(LLANTO.crecida, 2);
      n.poner(0, 19.8, GC, -1.1);
      n.poner(1, 19.8, GC, -2.1);
      n.correr(30);
      expect(t.aBordo).toBe(2);
      n.correr(900, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        n.entradas[1] = { ...QUIETO, ...AMBOS };
      });
      // La proa queda contra el puente (26.6): el arco va a 2.3 m del centro
      expect(enNivel(t.cuerpo.translation()).x).toBeLessThan(24.4);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("se ríe de los porrazos delante de ella: a la tercera carcajada deja de llorar, baja el agua y la trajinera pasa", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(1);
      const llorona = n.nivel.llorona("llorona");
      const risas: number[] = [];
      llorona.alReir((j) => risas.push(j));
      for (const j of [0, 1, 0] as const) {
        expect(porrazo(n, j)).toBeGreaterThan(-1);
        n.correr(30);
      }
      expect(risas).toEqual([0, 1, 0]);
      expect(llorona.risas).toBe(3);
      expect(llorona.llanto).toBe(0);
      n.correr(240);
      expect(llorona.estado).toBe("tranquila");
      expect(n.nivel.agua("canal").nivel).toBeCloseTo(LLANTO.tranquila, 2);
      expect(n.nivel.agua("remanso").nivel).toBeCloseTo(LLANTO.tranquila, 2);
      // Se suben a la trajinera (que los esperó en su parada) y la llevan bajo el puente hasta el embarcadero
      n.poner(0, 19.8, GC, -1.1);
      n.poner(1, 19.8, GC, -2.1);
      n.correr(40);
      const pasos = navegar(n, "trajinera", [{ x: 40, z: -1.6 }], 1500, {
        parar: (c) => c.x > 27.4,
        bajar: { x: 33.3, z: 0 },
        listo: () => n.nivel.puntoDeControl >= 2,
      });
      expect(pasos).toBeGreaterThan(0);
    });

    it("con cada carcajada baja un poco el agua, pero el arco recién pasa cuando deja de llorar", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(1);
      expect(porrazo(n, 0)).toBeGreaterThan(-1);
      expect(porrazo(n, 1)).toBeGreaterThan(-1);
      n.correr(240);
      const agua = n.nivel.agua("canal").nivel;
      expect(agua).toBeLessThan(LLANTO.crecida - 0.05);
      expect(agua).toBeGreaterThan(0.11);
      expect(n.nivel.llorona("llorona").estado).toBe("llorando");
    });

    it("si pasan 20 s sin reírse, se olvida de la carcajada; y los porrazos a sus espaldas no los ve", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(1);
      const llorona = n.nivel.llorona("llorona");
      expect(porrazo(n, 0)).toBeGreaterThan(-1);
      expect(llorona.risas).toBe(1);
      n.correr(Math.round(21 / (1 / 60)));
      expect(llorona.risas).toBe(0);
      // Detrás de ella (la mira hacia el oeste), uno cae de 1.6 m: no se ríe
      n.poner(1, 26.6, GC + 1.6, 1.6);
      expect(hasta(n, 120, () => n.munecos[1].estado === "caido")).toBeGreaterThan(-1);
      n.correr(30);
      expect(llorona.risas).toBe(0);
    });
  });

  describe("misión 3: las chinampas flotantes que se hunden", () => {
    it("se cruzan saltando de una en una, sin quedarse, hasta la feria", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(2);
      n.poner(0, 34.2, G, 0.2);
      n.poner(1, 32, G, 1.5);
      n.correr(20);
      expect(cruzarLaCienaga(n, 0)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(3);
      expect(n.nivel.aguas.caidas[0]).toBe(0);
    });

    it("el que se queda parado en una se hunde con ella y cae al agua; vacía, vuelve a subir", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(2);
      const chinampa = n.nivel.chinampa("chinampa-1");
      n.poner(0, 36.35, G, 0.2);
      n.poner(1, 32, G, 1.5);
      n.correr(60);
      expect(chinampa.encima).toBe(1);
      const cayo = hasta(n, 600, () => n.nivel.aguas.caidas[0] > 0);
      expect(cayo).toBeGreaterThan(60);
      expect(chinampa.hundida).toBeGreaterThan(0.5);
      n.correr(600);
      expect(chinampa.hundida).toBe(0);
      expect(chinampa.tierra).toBeCloseTo(G, 1);
    });

    it("con los dos encima se hunde el doble de rápido", async () => {
      const una = await armarCanales();
      una.nivel.avance.irA(2);
      una.poner(0, 36.1, G, 0.2);
      una.correr(60);
      const dos = await armarCanales();
      dos.nivel.avance.irA(2);
      dos.poner(0, 36.1, G, 0.2);
      dos.poner(1, 36.65, G, 0.2);
      dos.correr(60);
      expect(dos.nivel.chinampa("chinampa-1").encima).toBe(2);
      expect(dos.nivel.chinampa("chinampa-1").hundida).toBeGreaterThan(una.nivel.chinampa("chinampa-1").hundida * 1.8);
    });
  });

  describe("misión 4: la piñata, uno jala la soga y el otro le pega", () => {
    it("de a dos: el rojo jala la soga, el turquesa le pega hasta romperla y se abre la reja", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(3);
      const pinata = n.nivel.pinata("pinata");
      n.poner(1, 53.2, G, 0, ESTE);
      expect(jalar(n, 0)).toBeGreaterThan(-1);
      n.correr(30);
      expect(pinata.bajada).toBeGreaterThan(0.9);
      // El turquesa salta con los brazos alzados debajo de la piñata, una y otra vez
      const golpes: number[] = [];
      pinata.alGolpear((j) => golpes.push(j));
      const rota = hasta(
        n,
        1500,
        () => pinata.estado === "rota",
        (i) => {
          n.entradas[0] = { ...n.girarHacia(0, OESTE), ...AMBOS, avanzar: -0.7 };
          n.entradas[1] = { ...n.haciaDonde(1, 54, 0), ...AMBOS, saltar: i % 50 === 0 };
          if (Math.hypot(n.pelvis(1).x - 54, n.pelvis(1).z) < 0.3) n.entradas[1] = { ...n.entradas[1], avanzar: 0 };
        },
      );
      console.log(`piñata: rota en ${rota} pasos, golpes ${golpes.join(",")}`);
      expect(rota).toBeGreaterThan(-1);
      expect(golpes.every((j) => j === 1)).toBe(true);
      expect(golpes).toHaveLength(4);
      // La reja se hunde y se llega al muelle de las flores
      n.entradas[0] = QUIETO;
      n.correr(150);
      expect(
        hasta(
          n,
          900,
          () => n.nivel.puntoDeControl >= 4,
          () => {
            n.entradas[1] = n.haciaDonde(1, 61.6, 0);
          },
        ),
      ).toBeGreaterThan(-1);
    });

    it("solo no se puede: al soltar la soga la piñata sube antes de que llegue debajo", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(3);
      const pinata = n.nivel.pinata("pinata");
      n.poner(1, 48, G, 2);
      expect(jalar(n, 0)).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      n.correr(2);
      hasta(
        n,
        240,
        () => false,
        (i) => {
          n.entradas[0] = { ...n.haciaDonde(0, 54, 0), ...AMBOS, saltar: i % 40 === 20 };
        },
      );
      expect(pinata.golpes).toBe(0);
      expect(pinata.bajada).toBeLessThan(0.1);
      // Y sin bajarla, saltando debajo no se la alcanza
      n.correr(300, (i) => {
        n.entradas[0] = { ...n.haciaDonde(0, 54, 0), ...AMBOS, saltar: i % 40 === 20 };
      });
      expect(pinata.golpes).toBe(0);
      expect(n.nivel.pieza("reja-feria").cuerpo?.translation().y).toBeGreaterThan(G);
    });
  });

  describe("misión 5: la trajinera de las flores hasta el embarcadero", () => {
    it("llegan con todas las flores, despacito: gana el logro «Ni una flor menos»", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(4);
      const t = n.nivel.trajinera("trajinera-flores");
      n.poner(0, 64.8, G, -0.6);
      n.poner(1, 64.8, G, -1.6);
      n.correr(40);
      expect(t.aBordo).toBe(2);
      const pasos = navegar(n, "trajinera-flores", RUTA_FLORES, 4000, {
        parar: (c) => c.x > 87.6,
        arrimar: 92,
        bajar: { x: 93.6, z: 0.6 },
        listo: () => n.nivel.puntoDeControl >= 5,
      });
      console.log(`flores: llegan en ${pasos} pasos con ${t.flores}`);
      expect(pasos).toBeGreaterThan(0);
      expect(t.flores).toBe(8);
      expect(n.nivel.logro).toBe(true);
    });

    it("cada golpe fuerte bota una flor al agua: contra la chinampa se pierden flores y no hay logro", async () => {
      const n = await armarCanales();
      n.nivel.avance.irA(4);
      const t = n.nivel.trajinera("trajinera-flores");
      const botadas: number[] = [];
      t.alBotarFlor((quedan) => botadas.push(quedan));
      n.poner(0, 64.8, G, -0.6);
      n.poner(1, 64.8, G, -1.6);
      n.correr(40);
      // Derecho contra la segunda chinampa (la del fondo), sin frenar
      navegar(
        n,
        "trajinera-flores",
        [
          { x: 75, z: -1.1 },
          { x: 95, z: -1.6 },
        ],
        1500,
        {},
      );
      expect(botadas.length).toBeGreaterThan(0);
      expect(t.flores).toBe(8 - botadas.length);
      // Las botadas flotan un rato y se hunden
      n.correr(600);
      const hundidas = t.cuerposDeFlores.filter((c) => c.translation().y < -10).length;
      expect(hundidas).toBe(botadas.length);
      // Si la dejan sola, vuelve a su muelle con todas sus flores
      n.poner(0, 64.4, G, 0);
      n.poner(1, 64.4, G, 1);
      n.correr(TRAJINERA.pasos + 30);
      expect(t.flores).toBe(8);
      expect(enNivel(t.cuerpo.translation()).x).toBeCloseTo(67.05, 1);
    });
  });

  it("el secreto: el alebrije dormido en la chinampa del fondo, a un salto de la segunda", async () => {
    const n = await armarCanales();
    n.nivel.avance.irA(2);
    n.poner(0, 38.35, G, 0, Math.PI);
    n.correr(10);
    let antes = false;
    const encontro = hasta(
      n,
      300,
      () => n.nivel.secreto,
      () => {
        const p = n.pelvis(0);
        const saltar = !antes && p.z < -0.85;
        antes ||= saltar;
        n.entradas[0] = { ...n.haciaDonde(0, 38.35, -2.5), saltar };
      },
    );
    expect(encontro).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con la trajinera, las chinampas y la piñata, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarCanales();
      subirALaPopa(n);
      navegar(n, "trajinera", [{ x: 30, z: -1.6 }], 300, {});
      n.poner(0, 36.35, G, 0.2);
      n.poner(1, 54, G, 0);
      n.correr(120);
      const todo: number[] = [n.nivel.chinampa("chinampa-1").hundida];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBeGreaterThan(0);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica las piezas, cuenta las flores y ve reír a La Llorona", async () => {
    const anfitrion = await armarCanales();
    const invitado = await armarCanales();
    // El anfitrión: la trajinera andando, la de las flores con un golpe (una flor menos), la piñata bajada, una
    // chinampa hundida y La Llorona riéndose de un porrazo
    subirALaPopa(anfitrion);
    navegar(anfitrion, "trajinera", [{ x: 30, z: -1.6 }], 200, {});
    const flores = anfitrion.nivel.trajinera("trajinera-flores");
    flores.cuerpo.setLinvel({ x: -1.5, y: 0, z: 0 }, true);
    anfitrion.correr(30);
    expect(flores.flores).toBe(7);
    anfitrion.nivel
      .pinata("pinata")
      .manija.setTranslation(
        new THREE.Vector3().copy(anfitrion.nivel.pinata("pinata").manija.translation()).add({ x: 2.4, y: 0, z: 0 }),
        true,
      );
    // El rojo se cae de lo alto delante de La Llorona; el turquesa se para en una chinampa
    anfitrion.poner(0, 22.6, GC + 1.6, 1.4);
    anfitrion.entradas[0] = QUIETO;
    expect(hasta(anfitrion, 120, () => anfitrion.munecos[0].estado === "caido")).toBeGreaterThan(-1);
    anfitrion.poner(1, 40.35, G, 0.25);
    anfitrion.entradas[1] = QUIETO;
    anfitrion.correr(40, () => {
      const m = anfitrion.nivel.pinata("pinata").manija;
      const p = m.translation();
      m.setTranslation({ x: Math.max(p.x, DX + 54 + 2.3), y: p.y, z: p.z }, true);
    });
    expect(anfitrion.nivel.llorona("llorona").estado).toBe("riendo");
    expect(anfitrion.nivel.chinampa("chinampa-3").hundida).toBeGreaterThan(0.05);
    expect(anfitrion.nivel.pinata("pinata").bajada).toBeGreaterThan(0.5);

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
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["trajinera", "trajinera-flores", "chinampa-3", "pinata", "llorona"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // Lo que ve el invitado, sin correr el guion: las flores que quedan, La Llorona riéndose y el agua crecida
    expect(invitado.nivel.trajinera("trajinera-flores").flores).toBe(7);
    expect(invitado.nivel.llorona("llorona").estado).toBe("riendo");
    // El agua crecida le llega con su marcador, como todo lo que se mueve
    deAlla.forEach((c, i) => {
      const real = deAca[i];
      if (real) expect(posicion(c).distanceTo(posicion(real))).toBeLessThan(0.003);
    });
    // Y la piñata rota, cuando el anfitrión la rompe
    anfitrion.nivel.pinata("pinata").romper();
    anfitrion.correr(1);
    pasarFoto();
    expect(invitado.nivel.pinata("pinata").estado).toBe("rota");
  });
});

/** El rojo y el turquesa, de pie en la popa de la trajinera amarrada: el rojo a la derecha y el turquesa a la
 * izquierda (mirando hacia la proa, al este). */
function subirALaPopa(n: Canales) {
  n.poner(0, 0.8, GC, -1.1);
  n.poner(1, 0.8, GC, -2.1);
  n.correr(30);
}

/** El camino de la trajinera de las flores: detrás de la primera chinampa, cruza y pasa delante de la segunda. */
const RUTA_FLORES = [
  { x: 75, z: -1.1 },
  { x: 80.5, z: 1.3 },
  { x: 95, z: 1.3 },
];

/** Llevan la trajinera por la ruta: el rojo empuja con la pértiga de la derecha y el turquesa con la de la izquierda.
 * Para girar, empuja solo el del lado de afuera de la vuelta (la pértiga de la derecha la tuerce hacia la izquierda).
 * Pasado `parar` dejan de empujar; con `arrimar` (la x del muelle), empujan despacito hasta tocarlo; y con `bajar`,
 * caminan hasta ahí. Devuelve en cuántos pasos se cumplió `listo` (o −1). */
function navegar(
  n: Canales,
  nombre: string,
  ruta: readonly { x: number; z: number }[],
  pasos: number,
  op: {
    parar?: (centro: THREE.Vector3) => boolean;
    arrimar?: number;
    bajar?: { x: number; z: number };
    listo?: () => boolean;
  },
) {
  const t: Trajinera = n.nivel.trajinera(nombre);
  let tramo = 0;
  let parada = false;
  let bajando = false;
  return hasta(
    n,
    pasos,
    () => op.listo?.() ?? false,
    () => {
      const c = enNivel(t.cuerpo.translation());
      const destino = ruta[Math.min(tramo, ruta.length - 1)] ?? { x: c.x + 10, z: c.z };
      if (tramo < ruta.length - 1 && Math.hypot(destino.x - c.x, destino.z - c.z) < 1.5) tramo++;
      parada ||= op.parar?.(c) ?? false;
      if (parada) {
        const proa = c.x + 3;
        const v = t.cuerpo.linvel().x;
        // Arrimarse: pequeños empujones hasta tocar el muelle; ahí (o ya quieta, sin muelle) se bajan
        const arrimada = op.arrimar === undefined ? Math.abs(v) < 0.08 : proa > op.arrimar - 0.1;
        bajando ||= arrimada;
        if (!bajando && op.arrimar !== undefined && v < 0.2) {
          n.entradas[0] = { ...QUIETO, ...AMBOS };
          n.entradas[1] = { ...QUIETO, ...AMBOS };
          return;
        }
        for (const j of [0, 1] as const)
          n.entradas[j] = op.bajar && bajando ? n.haciaDonde(j, op.bajar.x, op.bajar.z) : QUIETO;
        return;
      }
      const deseado = Math.atan2(destino.x - c.x, destino.z - c.z);
      const e = Math.atan2(Math.sin(deseado - t.rumbo), Math.cos(deseado - t.rumbo));
      n.entradas[0] = e > -0.05 ? { ...QUIETO, ...AMBOS } : QUIETO;
      n.entradas[1] = e < 0.05 ? { ...QUIETO, ...AMBOS } : QUIETO;
    },
  );
}

/** Uno trepa la tarima de los mariachis (colgándose) y se tira del otro lado, delante de La Llorona: se queda tirado
 * y se levanta. Devuelve en cuántos pasos se cayó (o −1). */
function porrazo(n: Canales, j: 0 | 1) {
  n.poner(j, 20.05, GC, 1.4);
  n.entradas[j] = QUIETO;
  n.correr(15);
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(15);
  let paso = 0;
  const arriba = hasta(
    n,
    300,
    () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > GC + 1.7 && n.pelvis(j).x > 20.6,
    () => {
      n.entradas[j] = { ...QUIETO, ...AMBOS, saltar: paso < 3, avanzar: paso > 40 ? 1 : 0 };
      paso++;
    },
  );
  if (arriba < 0) return -1;
  const cayo = hasta(
    n,
    300,
    () => n.munecos[j].estado === "caido",
    () => {
      n.entradas[j] = n.haciaDonde(j, 23.2, 1.4);
    },
  );
  n.entradas[j] = QUIETO;
  hasta(n, 400, () => n.munecos[j].estado === "de pie");
  // Se hace a un lado, para que el próximo no le caiga encima
  hasta(
    n,
    200,
    () => n.pelvis(j).z > 2.7,
    () => {
      n.entradas[j] = n.haciaDonde(j, 23.4, 2.9);
    },
  );
  n.entradas[j] = QUIETO;
  return cayo;
}

/** Cruza la ciénaga saltando de chinampa en chinampa hasta la feria. Devuelve en cuántos pasos llegó al punto 3. */
function cruzarLaCienaga(n: Canales, j: 0 | 1, mirar?: () => void) {
  const islas = [
    { x: 36.35, z: 0.2, borde: 35 },
    { x: 38.35, z: -0.25, borde: 37 },
    { x: 40.35, z: 0.25, borde: 39 },
    { x: 42.35, z: -0.2, borde: 41 },
    { x: 44.35, z: 0.2, borde: 43 },
    { x: 47.6, z: 0, borde: 45 },
  ];
  let k = 0;
  let salto = 0;
  return hasta(
    n,
    1200,
    () => n.nivel.puntoDeControl >= 3,
    () => {
      const p = n.pelvis(j);
      const isla = islas[k] ?? { x: 48, z: 0, borde: 45 };
      if (p.x > isla.x - 0.4 && k < islas.length - 1) k++;
      const destino = islas[k] ?? isla;
      // Salta desde el borde de donde está
      const borde = destino.borde;
      const saltar = salto === 0 && n.munecos[j].estado === "de pie" && p.x > borde - 0.12 && p.x < borde + 0.3;
      if (saltar) salto = 30;
      if (salto > 0) salto--;
      n.entradas[j] = { ...n.haciaDonde(j, destino.x, destino.z), saltar };
      mirar?.();
    },
  );
}

/** Uno agarra la manija de la soga de la piñata (está junto al poste del fondo) y camina para atrás, hacia el este,
 * hasta bajarla del todo. Devuelve en cuántos pasos (o −1). */
function jalar(n: Canales, j: 0 | 1) {
  const pinata = n.nivel.pinata("pinata");
  const m = enNivel(pinata.manija.translation());
  n.poner(j, m.x + 0.45, G, m.z, OESTE);
  n.correr(20);
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(30);
  return hasta(
    n,
    600,
    () => pinata.jalada > 0.97,
    () => {
      n.entradas[j] = { ...n.girarHacia(j, OESTE), ...AMBOS, avanzar: -0.7 };
    },
  );
}
