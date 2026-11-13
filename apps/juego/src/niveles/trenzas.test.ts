// El nivel 7, Las trenzas (TU-40), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos no se pueden hacer solo, el Sombrerón enreda
// al que entra a su plaza sin el sombrero, y lo que se mueve viaja en la foto de la red. Para no repetir el camino
// entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x de las
// pruebas son las del nivel antes de correrlo `DX` (como en scripts/niveles/trenzas.mjs): `pelvis`, `poner` y
// `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { ALTA, DX } from "../../../../niveles/07-trenzas/guion";
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
const SUR = 0;

async function armarTrenzas() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("07-trenzas");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.trenzas?.crearGuion() });
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
  /** La entrada para ir caminando hacia (x, z): gira hacia allá y avanza cuando ya casi mira hacia allá. */
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
type Trenzas = Awaited<ReturnType<typeof armarTrenzas>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no llegó). */
function hasta(n: Trenzas, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina por esos puntos (x, z), uno detrás de otro, hasta que se cumpla `listo` (con `extra`: los brazos). */
function caminar(
  n: Trenzas,
  j: 0 | 1,
  camino: readonly { x: number; z: number }[],
  pasos: number,
  listo: () => boolean,
  extra: Partial<EntradaMuneco> = {},
) {
  let tramo = 0;
  return hasta(n, pasos, listo, () => {
    const p = n.pelvis(j);
    const d = camino[tramo];
    if (d && tramo < camino.length - 1 && Math.hypot(d.x - p.x, d.z - p.z) < 0.3) tramo++;
    const destino = camino[Math.min(tramo, camino.length - 1)] ?? { x: p.x, z: p.z };
    n.entradas[j] = n.haciaDonde(j, destino.x, destino.z, extra);
  });
}

/** Sube un escalón fijo que tiene la cara en `cara` (x, mirando al este): se para a 40 cm de la cara, alza los
 * brazos, salta, se cuelga y trepa hasta quedar arriba de pie, más alto que `arriba`. */
function treparHaciaElEste(n: Trenzas, j: 0 | 1, cara: number, arriba: number) {
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

/** Los dos agarran su cabo (el rojo el del +z, el turquesa el del −z, mirando hacia el nudo) y, si `jalan`, caminan
 * para atrás. */
function agarrarCabos(n: Trenzas, quienes: readonly (0 | 1)[]) {
  for (const j of quienes) n.poner(j, 6.1, 0, j === 0 ? 2.5 : -2.5, j === 0 ? NORTE : SUR);
  n.correr(30);
  for (const j of quienes) n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(40);
}

/** El rojo agarra el bulto `k` de su pilar y lo suelta junto al costado de la mula (que está donde empezó). */
function cargarBulto(n: Trenzas, k: 0 | 1) {
  const x = k === 0 ? 11.65 : 12.45;
  n.poner(0, x, 0, 1.6, SUR);
  n.correr(20);
  n.entradas[0] = { ...QUIETO, ...AMBOS };
  n.correr(40);
  n.correr(40, () => {
    n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -1 };
  });
  const junto = k === 0 ? 13.5 : 14.1;
  caminar(
    n,
    0,
    [
      { x: junto, z: 0.2 },
      { x: junto, z: -0.75 },
    ],
    400,
    () => n.pelvis(0).z < -0.75,
    AMBOS,
  );
  n.correr(40, () => {
    n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS };
  });
  n.entradas[0] = QUIETO;
  n.correr(30);
}

/** El rojo lleva a la mula de la rienda: se pone delante, la agarra y camina (con la rienda en las manos) por el
 * camino, por al lado de la pila, hasta el mesón. Devuelve en cuántos pasos se abrió el zaguán (o −1). */
function llevarLaMula(n: Trenzas, pasos: number) {
  n.poner(0, 15.35, 0, -1.4, OESTE);
  n.correr(20);
  n.entradas[0] = { ...QUIETO, ...AMBOS };
  n.correr(40);
  const abierto = () => (n.nivel.pieza("zaguan-a").cuerpo?.rotation().y ?? 0) > 0.05;
  return caminar(
    n,
    0,
    [
      { x: 16.5, z: 1.4 },
      { x: 22.5, z: 1.4 },
      { x: 27, z: 0 },
    ],
    pasos,
    abierto,
    AMBOS,
  );
}

/** Lo que tarda en abrirse un portón del todo (pasos), con margen. */
const ABRIRSE = 100;

/** El rojo agarra el balde de su pilar, lo llena bajo el caño y lo lleva hasta el pretil; el turquesa (del otro
 * lado) alza las manos, se arrima, lo agarra, y el rojo lo suelta. Devuelve los brazos con que el turquesa quedó
 * agarrando el balde lleno (el otro lo baja: si no, se agarraría del pretil), o `null`. */
function llenarYPasar(n: Trenzas): Partial<EntradaMuneco> | null {
  const balde = n.nivel.balde("balde");
  caminar(
    n,
    0,
    [
      { x: 47, z: 0 },
      { x: 45.95, z: -1.95 },
    ],
    900,
    () => Math.hypot(n.pelvis(0).x - 45.95, n.pelvis(0).z + 1.95) < 0.15,
  );
  n.correr(30, () => {
    n.entradas[0] = n.girarHacia(0, NORTE);
  });
  n.correr(20, () => {
    n.entradas[0] = { ...n.girarHacia(0, NORTE), avanzar: 0.4 };
  });
  n.entradas[0] = { ...QUIETO, ...AMBOS };
  n.correr(40);
  expect(manosEn(n.munecos[0], balde.cuerpo)).toBeGreaterThan(0);
  n.correr(30, () => {
    n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -1 };
  });
  // Bajo el caño, hasta que se llena
  caminar(
    n,
    0,
    [
      { x: 47.6, z: -1.3 },
      { x: 47.6, z: -1.65 },
    ],
    400,
    () => Math.hypot(n.pelvis(0).x - 47.6, n.pelvis(0).z + 1.65) < 0.15,
    AMBOS,
  );
  expect(
    hasta(
      n,
      120,
      () => balde.lleno,
      () => (n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS }),
    ),
  ).toBeGreaterThan(-1);
  // Hasta el pretil, y por encima, de mano en mano
  caminar(
    n,
    0,
    [
      { x: 50, z: 0.5 },
      { x: 51.0, z: 0.5 },
    ],
    600,
    () => n.pelvis(0).x > 50.95,
    AMBOS,
  );
  n.correr(40, () => {
    n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
  });
  // El turquesa se pone justo enfrente del balde, para agarrarlo con las dos manos
  const bz = balde.cuerpo.translation().z;
  caminar(n, 1, [{ x: 52.4, z: bz }], 600, () => Math.hypot(n.pelvis(1).x - 52.4, n.pelvis(1).z - bz) < 0.1);
  n.entradas[1] = { ...n.girarHacia(1, OESTE), ...AMBOS };
  n.correr(40, () => {
    n.entradas[1] = { ...n.girarHacia(1, OESTE), ...AMBOS };
  });
  hasta(
    n,
    200,
    () => manosEn(n.munecos[1], balde.cuerpo) > 0,
    () => {
      n.entradas[1] = { ...n.girarHacia(1, OESTE), ...AMBOS, avanzar: 0.4 };
    },
  );
  // Baja el brazo que no agarró el balde
  const conElBalde = (brazo: "brazoIzquierdo" | "brazoDerecho") =>
    n.munecos[1].agarrado(brazo)?.parent()?.handle === balde.cuerpo.handle;
  const brazos = { brazoIzquierdo: conElBalde("brazoIzquierdo"), brazoDerecho: conElBalde("brazoDerecho") };
  n.correr(20, () => {
    n.entradas[1] = { ...n.girarHacia(1, OESTE), ...brazos };
  });
  n.entradas[0] = QUIETO;
  n.correr(30, () => {
    n.entradas[0] = { ...QUIETO, avanzar: -0.5 };
  });
  n.entradas[0] = QUIETO;
  return balde.lleno && manosEn(n.munecos[1], balde.cuerpo) > 0 ? brazos : null;
}

describe("Las trenzas (niveles/07-trenzas)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarTrenzas();
    expect(plano.numero).toBe(7);
    expect(plano.nombre).toBe("Las trenzas");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "balde balde",
      "brasa brasa-1",
      "brasa brasa-2",
      "huacal mula-1",
      "huacal mula-2",
      "mula mula",
      "nudo nudo",
      "sombreron sombreron",
      "sombrerote sombrero",
    ]);
    expect(nivel.nudo("nudo").desatado).toBe(false);
    expect(nivel.mula("mula").cargada).toBe(false);
    expect(nivel.sombreron("sombreron").conSombrero).toBe(false);
    expect(() => nivel.mula("nudo")).toThrow(/mula «nudo»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: el nudo, cada uno jalando de un cabo", () => {
    it("de a dos: jalan los dos cabos a la vez, el nudo se desata, se abre el portón y pasan", async () => {
      const n = await armarTrenzas();
      const nudo = n.nivel.nudo("nudo");
      agarrarCabos(n, [0, 1]);
      expect(manosEn(n.munecos[0], nudo.cabos[1])).toBeGreaterThan(0);
      expect(manosEn(n.munecos[1], nudo.cabos[0])).toBeGreaterThan(0);
      const desato = hasta(
        n,
        600,
        () => nudo.desatado,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
          n.entradas[1] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
        },
      );
      console.log(`nudo: se desata en ${desato} pasos`);
      expect(desato).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(ABRIRSE);
      // Las dos hojas giraron hacia el este
      expect(Math.abs(n.nivel.pieza("porton-1a").cuerpo?.rotation().y ?? 0)).toBeGreaterThan(0.6);
      const llego = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 1,
        () => (n.entradas[0] = n.haciaDonde(0, 10.6, 0.5)),
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("solo no se puede: jalando un cabo el nudo se aprieta, y el portón no deja pasar", async () => {
      const n = await armarTrenzas();
      const nudo = n.nivel.nudo("nudo");
      agarrarCabos(n, [0]);
      n.poner(1, -6, 0, -0.7);
      n.correr(600, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
      });
      expect(nudo.jalados).toBe(1);
      expect(nudo.progreso).toBe(0);
      expect(nudo.desatado).toBe(false);
      // Suelta y prueba pasar: el portón sigue cerrado
      n.entradas[0] = QUIETO;
      n.correr(30);
      hasta(
        n,
        400,
        () => n.nivel.puntoDeControl >= 1,
        () => (n.entradas[0] = n.haciaDonde(0, 10.6, 0)),
      );
      expect(n.nivel.puntoDeControl).toBe(0);
      expect(n.pelvis(0).x).toBeLessThan(7.3);
    });
  });

  describe("misión 2: la mula, cargada y de la rienda", () => {
    it("sin su carga la mula no da un paso, por más que la jalen de la rienda", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(1);
      const mula = n.nivel.mula("mula");
      const antes = new THREE.Vector3().copy(mula.cuerpo.translation());
      llevarLaMula(n, 600);
      expect(mula.guia).toBe(0);
      expect(new THREE.Vector3().copy(mula.cuerpo.translation()).distanceTo(antes)).toBeLessThan(0.01);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("se suben los dos bultos a su lomo, se la lleva de la rienda al mesón y el zaguán se abre", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(1);
      const mula = n.nivel.mula("mula");
      cargarBulto(n, 0);
      expect(mula.cargados).toBe(1);
      cargarBulto(n, 1);
      expect(mula.cargados).toBe(2);
      expect(mula.cargada).toBe(true);
      const abrio = llevarLaMula(n, 2400);
      console.log(`mula: llega al mesón en ${abrio} pasos`);
      expect(abrio).toBeGreaterThan(0);
      // Los bultos siguen en su lomo
      for (const b of mula.bultos) {
        expect(b.cuerpo.translation().y).toBeGreaterThan(1);
        expect(new THREE.Vector3().copy(b.cuerpo.translation()).distanceTo(mula.cuerpo.translation())).toBeLessThan(
          1.5,
        );
      }
      n.correr(ABRIRSE);
      const llego = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 2,
        () => (n.entradas[0] = n.haciaDonde(0, 31, 0)),
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("un bulto tirado en el suelo vuelve a su pilar", async () => {
      const n = await armarTrenzas();
      const bulto = n.nivel.huacal("mula-1");
      bulto.cuerpo.setTranslation({ x: DX + 16, y: 0.3, z: 1.5 }, true);
      n.correr(300);
      expect(enNivel(bulto.cuerpo.translation()).x).toBeCloseTo(11.65, 1);
      expect(bulto.cuerpo.translation().y).toBeGreaterThan(0.8);
    });
  });

  describe("misión 3: las ruinas, de arco caído en arco caído", () => {
    /** Camina hacia el este y salta en el borde de cada arco caído (si `saltar`). */
    const cruzar = (n: Trenzas, saltar: boolean) => {
      const bordes = [34.5, 36.3, 38.1, 39.9, 41.7];
      return hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 3 || n.pelvis(0).y < -0.5,
        () => {
          const p = n.pelvis(0);
          const borde = bordes.find((b) => p.x < b + 0.1);
          const salta = saltar && borde !== undefined && p.x > borde - 0.25 && n.munecos[0].estado === "de pie";
          n.entradas[0] = { ...n.haciaDonde(0, 45, p.z * 0.5), saltar: salta };
        },
      );
    };

    it("se cruza el piso hundido de la iglesia saltando de un arco caído a otro", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(2);
      n.correr(20);
      expect(cruzar(n, true)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(3);
    });

    it("sin saltar se cae al foso de escombros, y reaparece", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(2);
      n.correr(20);
      cruzar(n, false);
      expect(n.nivel.puntoDeControl).toBe(2);
      n.correr(60);
      expect(n.pelvis(0).y).toBeGreaterThan(0.3);
      expect(n.pelvis(0).x).toBeLessThan(34.5);
    });
  });

  describe("misión 4: el balde, de mano en mano por encima del pretil", () => {
    it("el muro caído se trepa colgándose; el pretil (delgado) ni se trepa ni se salta", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(3);
      n.poner(1, 50, 0, -2.3);
      n.correr(20);
      expect(treparHaciaElEste(n, 1, 50.9, 1.4)).toBeGreaterThan(-1);
      // Del otro lado, bajando por el escalón
      expect(
        caminar(n, 1, [{ x: 53.5, z: -2.3 }], 400, () => n.pelvis(1).x > 53.3 && n.pelvis(1).y < 0.7),
      ).toBeGreaterThan(0);
      // El pretil: el rojo salta y trepa contra él un buen rato, y sigue de este lado
      n.poner(0, 50.6, 0, 1.5);
      n.correr(20);
      let paso = 0;
      n.correr(500, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 1, saltar: paso++ % 40 < 3 };
      });
      expect(n.pelvis(0).x).toBeLessThan(51.4);
    });

    it("de a dos: uno llena el balde y se lo pasa al otro, que apaga las dos piedras; pasan los dos", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(3);
      const balde = n.nivel.balde("balde");
      const brasas = [n.nivel.brasa("brasa-1"), n.nivel.brasa("brasa-2")];
      // El turquesa ya trepó el muro caído: espera del otro lado del pretil
      n.poner(0, 45, 0, -0.5);
      n.poner(1, 53, 0, 0.5, OESTE);
      n.correr(20);
      for (const [i, brasa] of brasas.entries()) {
        const brazos = llenarYPasar(n);
        expect(brazos, `balde ${i + 1}`).not.toBe(null);
        // El turquesa lleva el balde hasta la piedra y la apaga
        const camino = [
          { x: 53, z: 0.3 },
          { x: 56, z: 0 },
          { x: 59.5, z: 0 },
        ];
        const apago = caminar(n, 1, camino, 900, () => !brasa.caliente, brazos ?? {});
        expect(apago, `piedra ${i + 1}`).toBeGreaterThan(0);
        expect(brasa.quemados).toBe(0);
        // Suelta el balde vacío: vuelve solo a su pilar, del lado de la fuente
        n.entradas[1] = QUIETO;
        n.correr(60);
        caminar(n, 1, [{ x: 53, z: 0.5 }], 900, () => Math.hypot(n.pelvis(1).x - 53, n.pelvis(1).z - 0.5) < 0.2);
        n.correr(200);
        expect(enNivel(balde.cuerpo.translation()).x).toBeCloseTo(45.95, 1);
      }
      expect(balde.derramadas).toBe(0);
      // El rojo trepa el muro caído y los dos pasan el pasillo
      caminar(n, 0, [{ x: 50, z: -2.3 }], 900, () => Math.hypot(n.pelvis(0).x - 50, n.pelvis(0).z + 2.3) < 0.2);
      expect(treparHaciaElEste(n, 0, 50.9, 1.4)).toBeGreaterThan(-1);
      const llego = hasta(
        n,
        1200,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          for (const j of [0, 1] as const) {
            const p = n.pelvis(j);
            n.entradas[j] = p.x < 55 ? n.haciaDonde(j, 55.2, 0) : n.haciaDonde(j, 62, 0);
          }
        },
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("solo no se puede: lleno, el balde que se suelta se derrama, y con él en las manos no se trepa el muro", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(3);
      const balde = n.nivel.balde("balde");
      n.poner(0, 45, 0, -0.5);
      n.poner(1, 40, 0, 0);
      n.correr(20);
      // Lo llena y lo suelta: se derrama
      balde.llenar();
      n.correr(30);
      expect(balde.derramadas).toBe(1);
      expect(balde.lleno).toBe(false);
      // Lo vuelve a llenar y lo lleva al muro caído: trepando, las manos sueltan el balde y no sube
      const lleno = (() => {
        const t = new THREE.Vector3(45.95, 0, -1.95);
        caminar(n, 0, [{ x: t.x, z: t.z }], 600, () => Math.hypot(n.pelvis(0).x - t.x, n.pelvis(0).z - t.z) < 0.15);
        n.correr(30, () => (n.entradas[0] = { ...n.girarHacia(0, NORTE), avanzar: 0.3 }));
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        n.correr(40);
        return manosEn(n.munecos[0], balde.cuerpo) > 0;
      })();
      expect(lleno).toBe(true);
      balde.llenar();
      caminar(
        n,
        0,
        [
          { x: 48, z: -1.2 },
          { x: 50.3, z: -2.3 },
        ],
        900,
        () => n.pelvis(0).x > 50.25,
        AMBOS,
      );
      let paso = 0;
      n.correr(400, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, saltar: paso++ % 60 < 3, avanzar: 1 };
      });
      expect(n.pelvis(0).y).toBeLessThan(1.4);
      expect(n.pelvis(0).x).toBeLessThan(51);
      expect(balde.lleno && enNivel(balde.cuerpo.translation()).x > 51.6).toBe(false);
    });

    it("la piedra caliente quema al que la toca: lo tira para atrás", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(3);
      const brasa = n.nivel.brasa("brasa-1");
      n.poner(0, 54.5, 0, 0);
      n.correr(20);
      n.correr(240, () => (n.entradas[0] = n.haciaDonde(0, 60, 0)));
      expect(brasa.quemados).toBeGreaterThan(0);
      expect(n.pelvis(0).x).toBeLessThan(56.4);
      expect(n.nivel.puntoDeControl).toBe(3);
    });
  });

  describe("misión 5: el sombrero del Sombrerón, cuesta arriba", () => {
    /** El rojo empuja el sombrero cuesta arriba, caminando contra él, hasta que el Sombrerón se lo pone. */
    const rodar = (n: Trenzas) => {
      const sombrero = n.nivel.sombrerote("sombrero");
      const sombreron = n.nivel.sombreron("sombreron");
      n.poner(0, 62, 0, 0);
      n.correr(20);
      return hasta(
        n,
        1800,
        () => sombreron.conSombrero,
        () => {
          n.entradas[0] = n.haciaDonde(0, 80, sombrero.cuerpo.translation().z);
        },
      );
    };

    it("se rueda el sombrero hasta su plaza, el Sombrerón se lo pone, aparece la meta y, sin trenzas, el logro", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(4);
      n.poner(1, 61, 0, -1.5);
      const sombreron = n.nivel.sombreron("sombreron");
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeLessThan(-50);
      const puso = rodar(n);
      console.log(`sombrero: se lo pone en ${puso} pasos`);
      expect(puso).toBeGreaterThan(0);
      expect(sombreron.estado).toBe("con sombrero");
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeGreaterThan(0);
      const llego = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 5,
        () => (n.entradas[0] = n.haciaDonde(0, 75.4, 1.6)),
      );
      expect(llego).toBeGreaterThan(0);
      expect(sombreron.enredos).toBe(0);
      expect(n.nivel.logro).toBe(true);
      // Ya no molesta: se pasea uno por su plaza y no lo enreda
      n.correr(400, () => (n.entradas[0] = n.haciaDonde(0, 77, -1)));
      expect(sombreron.enredos).toBe(0);
    });

    it("sin el sombrero, al que entra a su plaza le hace trenzas (lo tumba): sin logro", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(4);
      const sombreron = n.nivel.sombreron("sombreron");
      n.poner(0, 74, ALTA, 1.5);
      n.correr(20);
      const enredo = hasta(
        n,
        600,
        () => sombreron.enredos > 0,
        () => (n.entradas[0] = n.haciaDonde(0, 74, 2)),
      );
      expect(enredo).toBeGreaterThan(0);
      expect(sombreron.estado).toBe("trenzando");
      n.correr(10);
      expect(n.munecos[0].estado).toBe("caido");
      // Después toca la guitarra un rato y vuelve a perseguir
      n.correr(60);
      expect(sombreron.estado).toBe("tocando");
      n.entradas[0] = QUIETO;
      n.poner(0, 62, 0, 0);
      expect(rodar(n)).toBeGreaterThan(0);
      hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 5,
        () => (n.entradas[0] = n.haciaDonde(0, 75.4, 1.6)),
      );
      expect(n.nivel.puntoDeControl).toBe(5);
      expect(n.nivel.logro).toBe(false);
    });

    it("el sombrero suelto en la cuesta rueda para abajo", async () => {
      const n = await armarTrenzas();
      n.nivel.avance.irA(4);
      const sombrero = n.nivel.sombrerote("sombrero");
      n.poner(0, 62, 0, 0);
      n.correr(20);
      hasta(
        n,
        900,
        () => enNivel(sombrero.cuerpo.translation()).x > 69,
        () => (n.entradas[0] = n.haciaDonde(0, 80, 0)),
      );
      n.poner(0, 60, 0, 1.5);
      n.entradas[0] = QUIETO;
      n.correr(600);
      expect(enNivel(sombrero.cuerpo.translation()).x).toBeLessThan(66);
      expect(n.nivel.sombreron("sombreron").conSombrero).toBe(false);
    });
  });

  it("el secreto: el barrilete en el campanario, trepando el escalón y la torre", async () => {
    const n = await armarTrenzas();
    n.nivel.avance.irA(5);
    n.poner(0, 79.4, ALTA, -2.2);
    n.correr(20);
    expect(treparHaciaElEste(n, 0, 80.4, ALTA + 1.45)).toBeGreaterThan(-1);
    expect(treparHaciaElEste(n, 0, 81.6, ALTA + 2.9)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        200,
        () => n.nivel.secreto,
        () => (n.entradas[0] = n.haciaDonde(0, 82.8, -1.9)),
      ),
    ).toBeGreaterThan(-1);
    expect(n.nivel.sombreron("sombreron").enredos).toBe(0);
  });

  it("es determinista: dos corridas iguales, con el nudo, la mula y el sombrero, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarTrenzas();
      agarrarCabos(n, [0, 1]);
      n.correr(200, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
        n.entradas[1] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
      });
      n.nivel.mula("mula").cargar();
      llevarLaMula(n, 300);
      n.poner(1, 74, ALTA, 1.5);
      n.correr(300, () => (n.entradas[1] = n.haciaDonde(1, 74, 2)));
      const todo: number[] = [n.nivel.nudo("nudo").progreso, n.nivel.sombreron("sombreron").enredos];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBe(1);
    expect(una[1]).toBe(1);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica y dibuja las piezas nuevas", async () => {
    const anfitrion = await armarTrenzas();
    const invitado = await armarTrenzas();
    // El anfitrión: el nudo a medio aflojar, la mula cargada andando, el balde lleno, una piedra apagada y el
    // Sombrerón con su sombrero puesto
    agarrarCabos(anfitrion, [0, 1]);
    anfitrion.correr(90, () => {
      anfitrion.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
      anfitrion.entradas[1] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
    });
    anfitrion.entradas[1] = QUIETO;
    anfitrion.nivel.mula("mula").cargar();
    llevarLaMula(anfitrion, 200);
    anfitrion.nivel.balde("balde").llenar();
    anfitrion.nivel.brasa("brasa-1").apagar(true);
    anfitrion.nivel.sombreron("sombreron").ponerse();
    anfitrion.correr(2);
    const progreso = anfitrion.nivel.nudo("nudo").progreso;
    expect(progreso).toBeGreaterThan(0.1);
    expect(progreso).toBeLessThan(0.9);

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
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
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["nudo", "mula", "mula-1", "balde", "brasa-1", "sombreron", "sombrero", "porton-1a"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // Lo que se ve, leído de los cuerpos: el nudo aflojado, el agua del balde, la piedra apagada y el sombrero puesto
    const buscar = (o: THREE.Object3D, nombre: string) => {
      let hallado: THREE.Mesh | undefined;
      o.traverse((h) => {
        if (h instanceof THREE.Mesh && (h.material as THREE.Material).name === nombre) hallado = h;
      });
      if (!hallado) throw new Error(`sin «${nombre}»`);
      return hallado;
    };
    // El nudo gira con lo que se aflojó (2.5 radianes, de apretado a desatado), sobre el eje de las cuerdas
    const nudo = invitado.nivel.pieza("nudo").objeto;
    expect(
      nudo.quaternion.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)) / 2.5,
    ).toBeCloseTo(progreso, 1);
    expect(buscar(invitado.nivel.pieza("balde").objeto, "agua-balde").visible).toBe(true);
    invitado.armado.dibujar(1, 0);
    const grietas = buscar(invitado.nivel.pieza("brasa-1").objeto, "brasa").material as THREE.MeshStandardMaterial;
    expect(grietas.emissiveIntensity).toBeLessThan(1.2);
    const cabeza = posicion(invitado.nivel.pieza("sombreron").cuerpo ?? anfitrion.mundo.getRigidBody(0));
    expect(
      posicion(invitado.nivel.pieza("sombrero").cuerpo ?? anfitrion.mundo.getRigidBody(0)).distanceTo(cabeza),
    ).toBeLessThan(1.5);
  });
});
