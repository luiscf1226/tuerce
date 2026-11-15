// El nivel 12, El puente de paja (TU-45), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con
// los muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, la llama escupe si
// la apuran, y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada prueba pone a los
// muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x de las pruebas son las del nivel
// antes de correrlo `DX` (como en scripts/niveles/puente.mjs): `pelvis`, `poner` y `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DX, PATIO, TERRAZAS } from "../../../../niveles/12-puente/guion";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import { manosEn } from "./piezas-pinar";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };
const ESTE = Math.PI / 2;
const OESTE = -Math.PI / 2;
const NORTE = Math.PI;

async function armarPuente() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("12-puente");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.puente?.crearGuion() });
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
  /** La entrada para ir caminando hacia (x, z): gira hacia allá y avanza. */
  const haciaDonde = (j: 0 | 1, x: number, z: number, extra: Partial<EntradaMuneco> = {}): EntradaMuneco => {
    const p = pelvis(j);
    return { ...girarHacia(j, Math.atan2(x - p.x, z - p.z)), avanzar: 1, ...extra };
  };
  /** La entrada para girar en el lugar hasta mirar hacia `rumbo`. */
  const girarHacia = (j: 0 | 1, rumbo: number): EntradaMuneco => {
    const d = Math.atan2(Math.sin(rumbo - munecos[j].rumbo), Math.cos(rumbo - munecos[j].rumbo));
    return { ...QUIETO, girar: Math.max(-1, Math.min(1, d * 3)) };
  };
  return { rapier, mundo, plano, armado, nivel, munecos, entradas, correr, pelvis, poner, haciaDonde, girarHacia };
}
type Puente = Awaited<ReturnType<typeof armarPuente>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (o −1). */
function hasta(n: Puente, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina hasta (x, z) y se queda quieto; devuelve en cuántos pasos llegó (o −1). */
function irA(n: Puente, j: 0 | 1, x: number, z: number, pasos = 900, cerca = 0.3, extra: Partial<EntradaMuneco> = {}) {
  const llego = hasta(
    n,
    pasos,
    () => Math.hypot(n.pelvis(j).x - x, n.pelvis(j).z - z) < cerca,
    () => {
      n.entradas[j] = n.haciaDonde(j, x, z, extra);
    },
  );
  n.entradas[j] = { ...QUIETO, ...extra, avanzar: 0 };
  return llego;
}

/** Los torcedores de la qeswa: el rojo, al oeste del de la punta −, mirando al este; el turquesa, al este del de la
 * punta +, mirando al oeste. Cada uno lo agarra con las dos manos. */
function agarrarTorcedores(n: Puente, quienes: readonly (0 | 1)[]) {
  for (const j of quienes) {
    n.entradas[j] = QUIETO;
    n.poner(j, j === 0 ? 3.6 : 10.4, 0, -1.8, j === 0 ? ESTE : OESTE);
  }
  n.correr(30);
  for (const j of quienes) n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(40);
}

/** El rojo agarra la manija de la soga del puente (mirando al este, hacia el puente). */
function agarrarSoga(n: Puente) {
  n.entradas[0] = QUIETO;
  n.poner(0, 21.9, 0, 1.3, ESTE);
  n.correr(30);
  n.entradas[0] = { ...QUIETO, ...AMBOS };
  n.correr(40);
}

/** El turquesa agarra el amarre del estribo (mirando al norte). */
function agarrarAmarre(n: Puente, j: 0 | 1 = 1) {
  n.entradas[j] = QUIETO;
  n.poner(j, 23.4, 0, -0.9, NORTE);
  n.correr(30);
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(40);
}

/** Tienden el puente: el rojo jala la soga caminando hacia atrás y el turquesa sostiene el amarre. Devuelve en
 * cuántos pasos quedó amarrado (o −1). */
function tenderElPuente(n: Puente) {
  agarrarSoga(n);
  agarrarAmarre(n);
  const chaka = n.nivel.chaka("chaka");
  return hasta(
    n,
    900,
    () => chaka.amarrado,
    () => {
      n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.8 };
      n.entradas[1] = { ...QUIETO, ...AMBOS };
    },
  );
}

/** Cruza el puente hacia el este de a poco: camina mientras se mece poco y se para a esperar que se calme. */
function cruzarDeAPoco(n: Puente, j: 0 | 1, pasos = 3000) {
  const chaka = n.nivel.chaka("chaka");
  let andando = true;
  return hasta(
    n,
    pasos,
    () => n.nivel.puntoDeControl >= 3,
    () => {
      if (andando && chaka.mecida > 0.3) andando = false;
      if (!andando && chaka.mecida < 0.1) andando = true;
      n.entradas[j] = andando ? n.haciaDonde(j, 40, 0) : { ...n.girarHacia(j, ESTE) };
    },
  );
}

/** Trepa un escalón fijo con la cara en `cara` (z, mirando al norte, hacia −z): como `treparHaciaElEste`. */
function treparHaciaElNorte(n: Puente, j: 0 | 1, cara: number, arriba: number) {
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && n.pelvis(j).z < cara - 0.1;
  hasta(
    n,
    240,
    () => Math.abs(n.pelvis(j).z - (cara + 0.4)) < 0.05 && n.munecos[j].estado === "de pie",
    () => {
      const falta = n.pelvis(j).z - (cara + 0.4);
      n.entradas[j] = { ...n.girarHacia(j, NORTE), avanzar: Math.max(-0.5, Math.min(0.5, falta * 4)) };
    },
  );
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(15);
  let paso = 0;
  return hasta(n, 300, subio, () => {
    n.entradas[j] = { ...QUIETO, ...AMBOS, saltar: paso < 3, avanzar: paso > 40 ? 1 : 0 };
    paso++;
  });
}

/** Las bocatomas: su x, y la terraza de cada una (de abajo hacia arriba). */
const BOCATOMAS = [44.1, 50, 56.1] as const;

/** El muñeco `j` se para frente al travesaño de la bocatoma `k` (1, 2 o 3), lo agarra y la abre (jalando hacia
 * atrás) o la cierra (empujando). Después la suelta. */
function moverBocatoma(n: Puente, j: 0 | 1, k: 1 | 2 | 3, abrir: boolean) {
  const x = BOCATOMAS[k - 1] ?? 0;
  const y = TERRAZAS[k - 1] ?? 0;
  const bocatoma = n.nivel.bocatoma(`bocatoma-${k}`);
  n.entradas[j] = QUIETO;
  n.poner(j, x, y, abrir ? -5.4 : -4.9, NORTE);
  n.correr(30);
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(40);
  const listo = hasta(
    n,
    300,
    () => bocatoma.abierta === abrir && (abrir ? bocatoma.abertura > 0.95 : bocatoma.abertura < 0.05),
    () => {
      n.entradas[j] = { ...QUIETO, ...AMBOS, avanzar: abrir ? -0.8 : 0.8 };
    },
  );
  n.entradas[j] = QUIETO;
  n.correr(20);
  return listo;
}

/** Trepa un escalón fijo con la cara en `cara` (x, mirando al este): se para a 40 cm de la cara, alza los brazos,
 * salta, se cuelga y trepa hasta quedar arriba de pie, más alto que `arriba`. */
function treparHaciaElEste(n: Puente, j: 0 | 1, cara: number, arriba: number) {
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && n.pelvis(j).x > cara + 0.1;
  hasta(
    n,
    240,
    () => Math.abs(n.pelvis(j).x - (cara - 0.4)) < 0.05 && n.munecos[j].estado === "de pie",
    () => {
      const falta = cara - 0.4 - n.pelvis(j).x;
      n.entradas[j] = { ...n.girarHacia(j, ESTE), avanzar: Math.max(-0.5, Math.min(0.5, falta * 4)) };
    },
  );
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(15);
  let paso = 0;
  return hasta(n, 300, subio, () => {
    n.entradas[j] = { ...QUIETO, ...AMBOS, saltar: paso < 3, avanzar: paso > 40 ? 1 : 0 };
    paso++;
  });
}

/** El rojo agarra la rienda de la llama (delante de su cabeza, mirando al oeste, hacia ella). */
function agarrarRienda(n: Puente) {
  n.entradas[0] = QUIETO;
  n.poner(0, 66.0, TERRAZAS[2], -1.0, OESTE);
  n.correr(30);
  n.entradas[0] = { ...QUIETO, ...AMBOS };
  n.correr(40);
}

/** El rojo lleva a la llama de la rienda hasta el patio del tambo. Con `deAPoco`, se para cuando la rienda se pone
 * tirante (y la apura) hasta que la llama lo alcanza; si no, camina de corrido. Devuelve en cuántos pasos llegó la
 * llama (o −1). */
function llevarLaLlama(n: Puente, deAPoco: boolean, pasos = 3000) {
  const llama = n.nivel.carguera("llama");
  let andando = true;
  return hasta(
    n,
    pasos,
    () => llama.estado === "contenta" || (!deAPoco && llama.enojos > 0),
    () => {
      if (deAPoco) {
        if (andando && llama.apuro > 0.3) andando = false;
        if (!andando && llama.apuro === 0) andando = true;
      }
      const destino = n.pelvis(0).x < 67.5 ? { x: 68, z: 0 } : { x: 82.6, z: 0 };
      n.entradas[0] =
        andando && n.pelvis(0).x < 82.4 ? n.haciaDonde(0, destino.x, destino.z, AMBOS) : { ...QUIETO, ...AMBOS };
    },
  );
}

describe("El puente de paja (niveles/12-puente)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarPuente();
    expect(plano.numero).toBe(12);
    expect(plano.nombre).toBe("El puente de paja");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "anden anden-1",
      "anden anden-2",
      "anden anden-3",
      "bocatoma bocatoma-1",
      "bocatoma bocatoma-2",
      "bocatoma bocatoma-3",
      "carguera llama",
      "chaka chaka",
      "qeswa qeswa",
    ]);
    expect(nivel.chaka("chaka").estado).toBe("flojo");
    expect(nivel.bocatoma("bocatoma-3").abierta).toBe(true);
    expect(nivel.bocatoma("bocatoma-1").abierta).toBe(false);
    expect(nivel.anden("anden-3").regada).toBe(true);
    expect(nivel.anden("anden-1").regada).toBe(false);
    expect(() => nivel.chaka("qeswa")).toThrow(/chaka «qeswa»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: la qeswa, cada uno girando su torcedor para su lado", () => {
    it("de a dos: girando al revés la cuerda se trenza, baja la puerta de la pirca y pasan", async () => {
      const n = await armarPuente();
      const qeswa = n.nivel.qeswa("qeswa");
      agarrarTorcedores(n, [0, 1]);
      expect(manosEn(n.munecos[0], qeswa.torcedores[0])).toBe(2);
      expect(manosEn(n.munecos[1], qeswa.torcedores[1])).toBe(2);
      const trenzo = hasta(
        n,
        1500,
        () => qeswa.trenzada,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
          n.entradas[1] = { ...QUIETO, ...AMBOS, girar: -1 };
        },
      );
      console.log(`qeswa: trenzada en ${trenzo} pasos`);
      expect(trenzo).toBeGreaterThan(0);
      expect(qeswa.soltadas).toBe(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(80);
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 1,
        () => (n.entradas[0] = n.haciaDonde(0, 17, 0)),
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("solo no se puede: un torcedor solo gira en vano, y la puerta no deja pasar", async () => {
      const n = await armarPuente();
      const qeswa = n.nivel.qeswa("qeswa");
      agarrarTorcedores(n, [0]);
      n.poner(1, 13, 0, 1);
      n.correr(600, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
      });
      expect(Math.abs(qeswa.giros[0])).toBeGreaterThan(0.01);
      expect(qeswa.progreso).toBe(0);
      n.entradas[0] = QUIETO;
      hasta(
        n,
        400,
        () => n.nivel.puntoDeControl >= 1,
        () => (n.entradas[1] = n.haciaDonde(1, 17, 0)),
      );
      expect(n.nivel.puntoDeControl).toBe(0);
      expect(n.pelvis(1).x).toBeLessThan(15);
    });

    it("girando los dos para el mismo lado no se trenza; soltando a medias se destuerce", async () => {
      const n = await armarPuente();
      const qeswa = n.nivel.qeswa("qeswa");
      agarrarTorcedores(n, [0, 1]);
      n.correr(300, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
        n.entradas[1] = { ...QUIETO, ...AMBOS, girar: 1 };
      });
      expect(qeswa.progreso).toBe(0);
      n.correr(240, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
        n.entradas[1] = { ...QUIETO, ...AMBOS, girar: -1 };
      });
      const medio = qeswa.progreso;
      expect(medio).toBeGreaterThan(0.1);
      expect(medio).toBeLessThan(1);
      n.entradas[1] = QUIETO;
      n.correr(60);
      expect(qeswa.soltadas).toBe(1);
      expect(qeswa.progreso).toBeLessThan(medio);
    });
  });

  describe("misión 2: tender el puente, uno tensa y el otro amarra", () => {
    it("de a dos: uno jala la soga, el otro sostiene el amarre; queda amarrado, con piso, y aparece la cabecera", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(1);
      const chaka = n.nivel.chaka("chaka");
      expect(chaka.tension).toBeLessThan(0.05);
      const amarro = tenderElPuente(n);
      console.log(`chaka: amarrado en ${amarro} pasos`);
      expect(amarro).toBeGreaterThan(0);
      expect(chaka.estado).toBe("firme");
      // El turquesa ya está en la cabecera: alcanzan el punto 2
      n.correr(5);
      expect(n.nivel.puntoDeControl).toBe(2);
      // Ya pueden soltar: queda tenso, y el piso aguanta al que se para encima
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(120);
      expect(chaka.tension).toBeGreaterThan(0.99);
      n.poner(0, 26, 0, 0);
      n.correr(60);
      expect(n.munecos[0].estado).toBe("de pie");
      expect(chaka.encima(n.munecos[0].partes.pelvis.translation())).toBe(true);
      // Retomado del punto 1: no hay logro
      expect(n.nivel.logro).toBe(false);
    });

    it("solo no se puede: la soga soltada se afloja antes de llegar al amarre, y el amarre solo no amarra", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(1);
      const chaka = n.nivel.chaka("chaka");
      n.poner(1, 17, 0, -2);
      agarrarSoga(n);
      hasta(
        n,
        400,
        () => chaka.jalada > 0.95,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.8 };
        },
      );
      expect(chaka.tension).toBeGreaterThan(0.85);
      // Suelta y corre al amarre
      n.entradas[0] = QUIETO;
      n.correr(10);
      expect(chaka.soltadas).toBe(1);
      expect(irA(n, 0, 23.4, -0.9, 600, 0.2)).toBeGreaterThan(0);
      expect(chaka.tension).toBeLessThan(0.1);
      // Ya llegó tarde: aunque lo agarre bien, sin el otro en la soga el amarre no amarra
      agarrarAmarre(n, 0);
      n.correr(300, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
      });
      expect(manosEn(n.munecos[0], chaka.amarre)).toBe(2);
      expect(chaka.amarrando).toBe(0);
      expect(chaka.amarrado).toBe(false);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("sin amarrar, el puente no tiene piso: el que se mete cae al cañón y reaparece", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(1);
      n.poner(0, 23, 0, 0);
      const caidas: number[] = [];
      n.correr(300, () => {
        n.entradas[0] = n.haciaDonde(0, 30, 0);
        if (n.nivel.cayo(0)) caidas.push(n.nivel.pasos);
      });
      expect(n.pelvis(0).x).toBeLessThan(25);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("el logro, «Tejedores»: trenzan la qeswa y tienden el puente sin soltar la cuerda", async () => {
      const n = await armarPuente();
      const qeswa = n.nivel.qeswa("qeswa");
      agarrarTorcedores(n, [0, 1]);
      hasta(
        n,
        1500,
        () => qeswa.trenzada,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
          n.entradas[1] = { ...QUIETO, ...AMBOS, girar: -1 };
        },
      );
      expect(qeswa.trenzada).toBe(true);
      // Ya trenzada la sueltan (eso no cuenta) y van a la cabecera
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(30);
      expect(tenderElPuente(n)).toBeGreaterThan(0);
      expect(n.nivel.logro).toBe(true);
    });

    it("sin el logro si se les soltó la cuerda: el que tensa suelta la soga a medio amarrar", async () => {
      const n = await armarPuente();
      const qeswa = n.nivel.qeswa("qeswa");
      agarrarTorcedores(n, [0, 1]);
      hasta(
        n,
        1500,
        () => qeswa.trenzada,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
          n.entradas[1] = { ...QUIETO, ...AMBOS, girar: -1 };
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(30);
      const chaka = n.nivel.chaka("chaka");
      agarrarSoga(n);
      agarrarAmarre(n);
      n.correr(150, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.8 };
      });
      expect(chaka.amarrando).toBeGreaterThan(0);
      expect(chaka.amarrado).toBe(false);
      // Suelta: el puente se afloja y lo amarrado se corre
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(chaka.soltadas).toBe(1);
      expect(chaka.amarrando).toBeLessThan(0.3);
      expect(tenderElPuente(n)).toBeGreaterThan(0);
      expect(n.nivel.logro).toBe(false);
    });
  });

  describe("misión 3: cruzar el puente sin que se voltee", () => {
    it("caminando de a poco (parándose cuando se mece mucho) se cruza", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(2);
      const chaka = n.nivel.chaka("chaka");
      expect(chaka.estado).toBe("firme");
      const llego = cruzarDeAPoco(n, 0);
      console.log(`chaka: cruzado de a poco en ${llego} pasos, mecida máxima ${chaka.mecida.toFixed(2)}`);
      expect(llego).toBeGreaterThan(0);
      expect(chaka.volteadas).toBe(0);
    });

    it("de corrido se mece de más y se voltea: el que iba encima cae y reaparece", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(2);
      const chaka = n.nivel.chaka("chaka");
      let cayo = false;
      hasta(
        n,
        900,
        () => chaka.volteadas > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, 40, 0);
        },
      );
      expect(chaka.volteadas).toBe(1);
      const x = n.pelvis(0).x;
      console.log(`chaka: se volteó con el rojo en x = ${x.toFixed(1)}`);
      expect(x).toBeLessThan(37);
      n.entradas[0] = QUIETO;
      n.correr(300, () => {
        if (n.nivel.cayo(0)) cayo = true;
      });
      expect(n.nivel.puntoDeControl).toBe(2);
      expect(n.pelvis(0).x).toBeLessThan(24.5);
      expect(cayo || n.pelvis(0).y > -1).toBe(true);
      // Se endereza solo
      n.correr(200);
      expect(chaka.estado).toBe("firme");
      expect(Math.abs(chaka.ladeo)).toBeLessThan(0.1);
    });

    it("los dos a la vez lo mecen el doble: se voltea más pronto", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(2);
      const chaka = n.nivel.chaka("chaka");
      n.poner(0, 24.6, 0, 0.25);
      n.poner(1, 24.6, 0, -0.25);
      const solos = hasta(
        n,
        900,
        () => chaka.volteadas > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, 40, 0.25);
          n.entradas[1] = n.haciaDonde(1, 40, -0.25);
        },
      );
      console.log(`chaka: con los dos encima se volteó a los ${solos} pasos`);
      expect(solos).toBeGreaterThan(0);
      expect(solos).toBeLessThan(200);
    });
  });

  describe("misión 4: los canales, abrir y cerrar las bocatomas para regar las terrazas", () => {
    it("el agua se va por la primera bocatoma abierta: la de arriba se lleva toda", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(3);
      n.correr(120);
      expect(n.nivel.agua("madre-3").nivel).toBeCloseTo(n.nivel.agua("madre-3").lleno, 2);
      expect(n.nivel.agua("madre-2").nivel).toBeCloseTo(n.nivel.agua("madre-2").fondo, 2);
      expect(n.nivel.anden("anden-3").mojandose).toBe(true);
      // Abrir la de abajo no sirve mientras la de arriba esté abierta
      expect(moverBocatoma(n, 0, 1, true)).toBeGreaterThan(0);
      n.correr(400);
      expect(n.nivel.anden("anden-1").humedad).toBe(0);
      expect(n.nivel.agua("madre-1").nivel).toBeCloseTo(n.nivel.agua("madre-1").fondo, 2);
      // Cerrando la de arriba el agua baja: llega a la primera abierta (la de abajo, con la del medio cerrada)
      expect(moverBocatoma(n, 1, 3, false)).toBeGreaterThan(0);
      n.correr(120);
      expect(n.nivel.agua("madre-2").nivel).toBeCloseTo(n.nivel.agua("madre-2").lleno, 2);
      expect(n.nivel.agua("salto-2").nivel).toBeCloseTo(n.nivel.agua("salto-2").lleno, 2);
      expect(n.nivel.anden("anden-1").mojandose).toBe(true);
      expect(n.nivel.anden("anden-3").mojandose).toBe(false);
    });

    it("cerrando la de arriba y abriendo las de abajo se riegan las tres, baja la puerta y pasan", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(3);
      // Suben las terrazas: de la otra orilla a la segunda y a la tercera, colgándose
      expect(irA(n, 0, 46.2, 0, 600, 0.3)).toBeGreaterThan(0);
      expect(treparHaciaElEste(n, 0, 47, TERRAZAS[1])).toBeGreaterThan(0);
      expect(irA(n, 0, 52.2, 0, 600, 0.3)).toBeGreaterThan(0);
      expect(treparHaciaElEste(n, 0, 53, TERRAZAS[2])).toBeGreaterThan(0);
      // El rojo cierra la de arriba y el turquesa abre la del medio: se riega la segunda
      expect(moverBocatoma(n, 0, 3, false)).toBeGreaterThan(0);
      expect(moverBocatoma(n, 1, 2, true)).toBeGreaterThan(0);
      const segunda = hasta(n, 600, () => n.nivel.anden("anden-2").regada);
      expect(segunda).toBeGreaterThan(0);
      expect(n.nivel.anden("anden-1").humedad).toBe(0);
      // Cierra la del medio y abre la de abajo: se riega la primera
      expect(moverBocatoma(n, 1, 2, false)).toBeGreaterThan(0);
      expect(moverBocatoma(n, 1, 1, true)).toBeGreaterThan(0);
      const primera = hasta(n, 600, () => n.nivel.anden("anden-1").regada);
      console.log(`canales: la segunda regada en ${segunda} pasos, la primera en ${primera}`);
      expect(primera).toBeGreaterThan(0);
      // Con las tres regadas baja la puerta de arriba: el rojo (en la tercera terraza) pasa
      n.correr(80);
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 4,
        () => (n.entradas[0] = n.haciaDonde(0, 61.2, 0.4)),
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("sin regar las tres, la puerta de arriba no deja pasar", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(3);
      n.poner(0, 57, TERRAZAS[2], 0);
      n.correr(400, () => {
        n.entradas[0] = n.haciaDonde(0, 61.2, 0.4);
      });
      expect(n.nivel.puntoDeControl).toBe(3);
      expect(n.pelvis(0).x).toBeLessThan(59.3);
    });
  });

  describe("misión 5: la llama carguera, de la rienda y sin apurarla", () => {
    it("llevándola a su paso (parando cuando la rienda se pone tirante) llega al tambo y aparece la meta", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(4);
      const llama = n.nivel.carguera("llama");
      agarrarRienda(n);
      expect(manosEn(n.munecos[0], llama.rienda)).toBeGreaterThan(0);
      const llego = llevarLaLlama(n, true);
      console.log(`llama: llega al tambo en ${llego} pasos`);
      expect(llego).toBeGreaterThan(0);
      expect(llama.enojos).toBe(0);
      expect(llama.estado).toBe("contenta");
      const t = enNivel(llama.cuerpo.translation());
      expect(Math.hypot(t.x - PATIO.x, t.z - PATIO.z)).toBeLessThan(PATIO.radio);
      n.entradas[0] = QUIETO;
      n.correr(20);
      const meta = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 5,
        () => (n.entradas[0] = n.haciaDonde(0, 85, 0)),
      );
      expect(meta).toBeGreaterThan(0);
    });

    it("apurada (de corrido, con la rienda tirante) se enoja: escupe al que la lleva, se echa y se vuelve a su casa", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(4);
      const llama = n.nivel.carguera("llama");
      let escupido: 0 | 1 | null = null;
      llama.alEscupir((j) => {
        escupido = j;
      });
      agarrarRienda(n);
      const enojo = llevarLaLlama(n, false, 1200);
      console.log(`llama: se enoja a los ${enojo} pasos`);
      expect(enojo).toBeGreaterThan(0);
      expect(llama.estado).toBe("escupiendo");
      n.entradas[0] = QUIETO;
      // El escupitajo vuela y lo tumba
      const escupio = hasta(n, 120, () => llama.escupidas > 0);
      expect(escupio).toBeGreaterThan(0);
      expect(escupido).toBe(0);
      n.correr(10);
      expect(n.munecos[0].estado).toBe("caido");
      expect(llama.estado).toBe("echada");
      // Se echa un rato y se vuelve sola a su casa; la meta no aparece
      const volvio = hasta(n, 1800, () => llama.estado === "tranquila");
      expect(volvio).toBeGreaterThan(0);
      const t = enNivel(llama.cuerpo.translation());
      expect(Math.hypot(t.x - (llama.casa.x - DX), t.z - llama.casa.z)).toBeLessThan(0.2);
      n.correr(60, () => (n.entradas[0] = n.haciaDonde(0, 85, 0)));
      expect(n.nivel.puntoDeControl).toBe(4);
    });

    it("también se enoja con el que se le viene encima por detrás", async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(4);
      const llama = n.nivel.carguera("llama");
      let enojada: 0 | 1 | null = null;
      llama.alEnojar((j) => {
        enojada = j;
      });
      n.poner(1, 61.5, TERRAZAS[2], -1.0, ESTE);
      const arreo = hasta(
        n,
        600,
        () => llama.enojos > 0,
        () => (n.entradas[1] = n.haciaDonde(1, 64.5, -1.0)),
      );
      expect(arreo).toBeGreaterThan(0);
      expect(enojada).toBe(1);
    });
  });

  it("el secreto: el quipu entre las piedras, arriba del pedregal", async () => {
    const n = await armarPuente();
    n.poner(0, 10.3, 0, -3.3, NORTE);
    n.correr(20);
    expect(treparHaciaElNorte(n, 0, -3.8, 1.35)).toBeGreaterThan(-1);
    const encontro = hasta(
      n,
      400,
      () => n.nivel.secreto,
      () => (n.entradas[0] = n.haciaDonde(0, 10.3, -6.2)),
    );
    expect(encontro).toBeGreaterThan(-1);
  });

  it("retomar en cada punto deja cada pieza como queda al llegar ahí", async () => {
    for (const punto of [1, 2, 3, 4, 5]) {
      const n = await armarPuente();
      n.nivel.avance.irA(punto);
      n.correr(120);
      expect(n.nivel.puntoDeControl, `punto ${punto}`).toBe(punto);
      expect(n.nivel.qeswa("qeswa").trenzada).toBe(true);
      expect(n.nivel.pieza("puerta-pampa").cuerpo?.translation().y ?? 0).toBeLessThan(-1);
      const chaka = n.nivel.chaka("chaka");
      expect(chaka.amarrado).toBe(punto >= 2);
      if (punto >= 2) {
        expect(chaka.estado).toBe("firme");
        expect(chaka.tension).toBeGreaterThan(0.99);
      }
      const regadas = [1, 2, 3].filter((k) => n.nivel.anden(`anden-${k}`).regada).length;
      expect(regadas).toBe(punto >= 4 ? 3 : 1);
      const puerta = n.nivel.pieza("puerta-terrazas").cuerpo?.translation().y ?? 0;
      expect(puerta < TERRAZAS[2]).toBe(punto >= 4);
      const llama = n.nivel.carguera("llama");
      expect(llama.estado).toBe(punto >= 5 ? "contenta" : "tranquila");
      // Los dos quedan de pie en su punto (nadie cae del puente ni de las terrazas)
      expect(n.munecos.every((m) => m.estado === "de pie")).toBe(true);
    }
  });

  it("es determinista: dos corridas iguales, con el puente, el agua y la llama, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarPuente();
      n.nivel.avance.irA(2);
      n.correr(200, () => {
        n.entradas[0] = n.haciaDonde(0, 33, 0);
        n.entradas[1] = n.haciaDonde(1, 50, -5);
      });
      const todo: number[] = [n.nivel.chaka("chaka").ladeo, n.nivel.chaka("chaka").mecida];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica las piezas y ve lo trenzado, el puente y lo regado", async () => {
    const anfitrion = await armarPuente();
    const invitado = await armarPuente();
    // El anfitrión: la qeswa a medio trenzar, el puente tenso con la soga, una bocatoma abierta y la llama andando
    agarrarTorcedores(anfitrion, [0, 1]);
    anfitrion.correr(200, () => {
      anfitrion.entradas[0] = { ...QUIETO, ...AMBOS, girar: 1 };
      anfitrion.entradas[1] = { ...QUIETO, ...AMBOS, girar: -1 };
    });
    const qeswa = anfitrion.nivel.qeswa("qeswa");
    expect(qeswa.progreso).toBeGreaterThan(0.2);
    const enviar = () => {
      const deAca = cuerposMoviles(anfitrion.mundo);
      const deAlla = cuerposMoviles(invitado.mundo);
      expect(deAlla.length).toBe(deAca.length);
      const foto = leerFoto(
        escribirFoto({
          paso: 260,
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
    enviar();
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    const giro = (c: RAPIER.RigidBody) => new THREE.Quaternion().copy(c.rotation());
    for (const [i, t] of qeswa.torcedores.entries()) {
      const alla = invitado.nivel.qeswa("qeswa").torcedores[i];
      expect(alla && giro(alla).angleTo(giro(t))).toBeLessThan(0.01);
    }
    // Lo trenzado viaja en el giro del marcador
    const marcador = (q: typeof qeswa) => giro(q.marcador);
    expect(marcador(invitado.nivel.qeswa("qeswa")).angleTo(marcador(qeswa))).toBeLessThan(0.01);
    expect(invitado.nivel.qeswa("qeswa").vista).toBeCloseTo(qeswa.progreso, 2);
    expect(invitado.nivel.qeswa("qeswa").progreso).toBe(0);

    // El puente amarrado y mecido, una bocatoma abierta y la llama a medio camino
    anfitrion.nivel.avance.irA(2);
    anfitrion.poner(0, 30, 0, 0.3);
    anfitrion.correr(90, () => {
      anfitrion.entradas[0] = anfitrion.haciaDonde(0, 34, 0.3);
    });
    const chaka = anfitrion.nivel.chaka("chaka");
    expect(Math.abs(chaka.ladeo)).toBeGreaterThan(0.01);
    anfitrion.nivel.bocatoma("bocatoma-1").poner(true);
    anfitrion.nivel.carguera("llama").ponerEn(DX + 72, 0, ESTE);
    anfitrion.correr(30);
    enviar();
    for (const nombre of ["chaka", "bocatoma-1", "llama", "puerta-pampa", "anden-3"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    for (const [i, t] of chaka.tramos.entries()) {
      const alla = invitado.nivel.chaka("chaka").tramos[i];
      expect(alla && giro(alla).angleTo(giro(t))).toBeLessThan(0.01);
    }
    // El invitado no corre el guion ni las piezas: el piso tejido, lo regado y la llama los ve en los marcadores
    const alla = invitado.nivel.chaka("chaka");
    expect(alla.amarrado).toBe(false);
    expect(alla.vista.amarrado).toBe(true);
    expect(invitado.nivel.anden("anden-3").vista.humedad).toBeCloseTo(1, 2);
    expect(invitado.nivel.anden("anden-1").vista.humedad).toBeCloseTo(0, 3);
    expect(invitado.nivel.anden("anden-3").vista.mojandose).toBe(anfitrion.nivel.anden("anden-3").mojandose);
    expect(invitado.nivel.carguera("llama").vista).toBe(anfitrion.nivel.carguera("llama").estado);
  });
});
