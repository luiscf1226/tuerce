// El nivel 13, La mina (TU-46), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, El Tío se queda con su
// ofrenda, las velas asustan y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada
// prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SOL, VIA_SALIDA, Y0, Y1, YS } from "../../../../niveles/13-mina/guion";
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
const OESTE = -Math.PI / 2;
const NORTE = Math.PI;
const SUR = 0;

async function armarMina() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("13-mina");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.mina?.crearGuion() });
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
  const pelvis = (j: 0 | 1) => new THREE.Vector3().copy(munecos[j].partes.pelvis.translation());
  /** Pone al muñeco de pie en (x, y, z), mirando hacia `rumbo`. */
  const poner = (j: 0 | 1, x: number, y: number, z: number, rumbo = ESTE) =>
    munecos[j].reaparecer({ x, y: y + 0.02, z }, rumbo);
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
  /** Cuántas manos de ese muñeco agarran ese cuerpo. */
  const manos = (j: 0 | 1, cuerpo: RAPIER.RigidBody) =>
    (["brazoIzquierdo", "brazoDerecho"] as const).filter(
      (b) => munecos[j].agarrado(b)?.parent()?.handle === cuerpo.handle,
    ).length;
  return {
    rapier,
    mundo,
    plano,
    armado,
    nivel,
    munecos,
    entradas,
    correr,
    pelvis,
    poner,
    haciaDonde,
    girarHacia,
    manos,
  };
}
type Mina = Awaited<ReturnType<typeof armarMina>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (-1 si no se cumplió). */
function hasta(n: Mina, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina por esos puntos (x, z), uno detrás del otro, con `extra` en la entrada. Devuelve si llegó al último. */
function caminar(
  n: Mina,
  j: 0 | 1,
  puntos: readonly (readonly [number, number])[],
  extra: Partial<EntradaMuneco> = {},
) {
  for (const [x, z] of puntos) {
    const llego = hasta(
      n,
      900,
      () => Math.hypot(n.pelvis(j).x - x, n.pelvis(j).z - z) < 0.3,
      () => {
        n.entradas[j] = n.haciaDonde(j, x, z, extra);
      },
    );
    if (llego < 0) {
      n.entradas[j] = QUIETO;
      return false;
    }
  }
  n.entradas[j] = { ...QUIETO, ...extra };
  return true;
}

/** Misión 1. El de `quien` empuja la vagoneta por la vía caminando detrás de ella, hasta `pasos` o hasta el tope. */
function empujarVagoneta(n: Mina, quien: 0 | 1, pasos: number, hastaS = Number.POSITIVE_INFINITY) {
  const vagoneta = n.nivel.vagoneta("vagoneta");
  return hasta(
    n,
    pasos,
    () => vagoneta.enElTope || vagoneta.avance >= hastaS,
    () => {
      // Camina hacia un punto un poco más adelante del medio de la vagoneta: la empuja por detrás
      const c = vagoneta.cuerpo.translation();
      const q = vagoneta.cuerpo.rotation();
      const adelante = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      n.entradas[quien] = n.haciaDonde(quien, c.x + adelante.x * 1.2, c.z + adelante.z * 1.2);
    },
  );
}

/** El que sostiene la palanca del cambio: parado frente a ella, la empuja hacia la pared con los brazos alzados. */
function sostenerCambio(n: Mina, quien: 0 | 1) {
  const brazo = n.nivel.palanca("cambio").brazo.translation();
  n.poner(quien, brazo.x, Y0, -1.0, NORTE);
  n.correr(10);
  n.entradas[quien] = { ...QUIETO, ...AMBOS, avanzar: 0.6 };
}

/** Se para a `distancia` de una pared que tiene la cara en `cara` (x, mirando al este), alza los brazos, salta, se
 * cuelga y trepa. Devuelve en cuántos pasos subió, o -1. */
function treparHaciaElEste(n: Mina, j: 0 | 1, cara: number, arriba: number, distancia = 0.4) {
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && n.pelvis(j).x > cara + 0.1;
  hasta(
    n,
    240,
    () => Math.abs(n.pelvis(j).x - (cara - distancia)) < 0.05 && n.munecos[j].estado === "de pie",
    () => {
      const falta = cara - distancia - n.pelvis(j).x;
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

/** Misión 2. Se para debajo de la manija de esa polea, mirando hacia ella, salta, se cuelga y la baja hasta que la
 * jaula llega arriba. Devuelve si se colgó y si la jaula llegó. */
function colgarseDeLaManija(n: Mina, j: 0 | 1, polea: "polea-abajo" | "polea-arriba", piso: number) {
  const p = n.nivel.polea(polea);
  const m = p.manija.translation();
  const rumbo = polea === "polea-abajo" ? ESTE : OESTE;
  n.poner(j, m.x + (polea === "polea-abajo" ? -0.3 : 0.3), piso, m.z, rumbo);
  n.correr(10);
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(15);
  let colgo = false;
  let paso = 0;
  const jaula = () => n.nivel.pieza("jaula").cuerpo?.translation().y ?? 0;
  const llego = hasta(
    n,
    500,
    () => jaula() > Y1 - 0.15,
    () => {
      colgo ||= p.colgados > 0;
      n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS, saltar: paso % 90 < 3 };
      paso++;
    },
  );
  return { colgo, llego: llego > -1 };
}

/** Misión 3. Agarra la ofrenda de su repisa, de frente. Devuelve si la agarró. */
function agarrarOfrenda(n: Mina, j: 0 | 1) {
  const ofrenda = n.nivel.ofrenda("ofrenda");
  const o = ofrenda.cuerpo.translation();
  n.poner(j, o.x, Y1, -1.4, NORTE);
  n.correr(10);
  return (
    hasta(
      n,
      200,
      () => n.manos(j, ofrenda.cuerpo) > 0,
      () => {
        n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS, avanzar: 0.4 };
      },
    ) > -1
  );
}
/** El zigzag entre las tres hileras de velas, de la repisa hasta delante del Tío. */
const ZIGZAG: readonly (readonly [number, number])[] = [
  [-12.5, -1.0],
  [-11.0, 2.0],
  [-10.0, 2.0],
  [-8.5, 0],
  [-7.5, -2.2],
  [-6.5, -2.2],
  [-5.5, 0],
  [-4.5, 2.0],
  [-3.5, 2.0],
  [-1.0, -1.5],
];

/** Misión 4. Empuja el brazo de ese espejo caminando contra su punta (desde el costado) hasta su tope. */
function empujarEspejo(n: Mina, j: 0 | 1, cual: 1 | 2) {
  // La punta del brazo en reposo: el espejo 1 gira a la derecha y el 2 a la izquierda; se empuja de costado
  const [x, reposo, lado] = cual === 1 ? [6, -10, -1] : [12, 42.5, 1];
  const r = (reposo * Math.PI) / 180;
  const punta = { x: x + 0.9 * Math.sin(r), z: 0.6 + 0.9 * Math.cos(r) };
  const empuje = { x: lado * Math.cos(r), z: -lado * Math.sin(r) };
  const hacia = Math.atan2(empuje.x, empuje.z);
  n.poner(j, punta.x - empuje.x * 0.5, Y1, punta.z - empuje.z * 0.5, hacia);
  n.correr(10);
  n.entradas[j] = { ...QUIETO, avanzar: 1 };
}

describe("La mina (niveles/13-mina)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarMina();
    expect(plano.numero).toBe(13);
    expect(plano.nombre).toBe("La mina");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "espejo espejo-1",
      "espejo espejo-2",
      "grieta grieta",
      "ofrenda ofrenda",
      "palanca cambio",
      "polea polea-abajo",
      "polea polea-arriba",
      "tio tio",
      "vagoneta vagoneta",
      "vagoneta vagoneta-salida",
      "velas velas-1",
      "velas velas-2",
      "velas velas-3",
    ]);
    expect(nivel.tio("tio").estado).toBe("esperando");
    expect(nivel.vagoneta("vagoneta-salida").frenada).toBe(true);
    expect(nivel.espejo("espejo-1").orientado).toBe(false);
    expect(() => nivel.vagoneta("tio")).toThrow(/vagoneta «tio»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: la vagoneta, uno empuja y el otro mueve el cambio", () => {
    it("de a dos: con el cambio sostenido va por el desvío a la báscula, sube la reja y pasan", async () => {
      const n = await armarMina();
      const vagoneta = n.nivel.vagoneta("vagoneta");
      const reja = () => n.nivel.pieza("reja").cuerpo?.translation().y ?? 0;
      const cerrada = reja();
      n.poner(0, -47.4, Y0, 1.2);
      sostenerCambio(n, 1);
      expect(hasta(n, 200, () => n.nivel.palanca("cambio").activa)).toBeGreaterThan(-1);
      expect(empujarVagoneta(n, 0, 2400)).toBeGreaterThan(-1);
      expect(vagoneta.porElDesvio).toBe(true);
      expect(vagoneta.enElTope).toBe(true);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(180);
      expect(reja()).toBeGreaterThan(cerrada + 2.6);
      // Pasan por detrás de la vagoneta, que quedó en la báscula
      expect(
        caminar(n, 0, [
          [-30.5, -2.3],
          [-26.9, -1.5],
        ]),
      ).toBe(true);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("solo no se puede: sin nadie en el cambio sigue derecho al derrumbe, la reja no sube y vuelve sola", async () => {
      const n = await armarMina();
      const vagoneta = n.nivel.vagoneta("vagoneta");
      const reja = () => n.nivel.pieza("reja").cuerpo?.translation().y ?? 0;
      const cerrada = reja();
      n.poner(0, -47.4, Y0, 1.2);
      n.poner(1, -50, Y0, -1);
      expect(empujarVagoneta(n, 0, 2400)).toBeGreaterThan(-1);
      expect(vagoneta.porElDesvio).toBe(false);
      expect(vagoneta.avance).toBeCloseTo(15, 0);
      n.entradas[0] = { ...QUIETO, avanzar: -0.5 };
      n.correr(60);
      n.entradas[0] = QUIETO;
      expect(reja()).toBeCloseTo(cerrada, 3);
      // A los 3 s en el derrumbe vuelve sola a su lugar
      expect(hasta(n, 240, () => vagoneta.avance === 0)).toBeGreaterThan(-1);
    });

    it("solo no se puede: suelta, se para enseguida (no da tiempo de ir a la palanca, a más de 4 m)", async () => {
      const n = await armarMina();
      const vagoneta = n.nivel.vagoneta("vagoneta");
      n.poner(0, -47.4, Y0, 1.2);
      expect(empujarVagoneta(n, 0, 1200, 5)).toBeGreaterThan(-1);
      const donde = vagoneta.avance;
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(vagoneta.velocidad).toBe(0);
      expect(vagoneta.avance - donde).toBeLessThan(0.5);
      // La palanca, del que empuja cuando la vagoneta pasa el cambio, queda lejos
      const palanca = n.nivel.palanca("cambio").brazo.translation();
      expect(Math.hypot(palanca.x - -40.2, palanca.z - 1.2)).toBeGreaterThan(3.5);
      expect(n.nivel.palanca("cambio").activa).toBe(false);
    });
  });

  describe("misión 2: el pozo, con la polea", () => {
    it("uno se cuelga de la manija de abajo y el otro sube en la jaula; arriba, ese sube al otro", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(1);
      n.poner(0, -19.3, Y0 + 0.1, 0);
      const abajo = colgarseDeLaManija(n, 1, "polea-abajo", Y0);
      expect(abajo).toEqual({ colgo: true, llego: true });
      expect(n.pelvis(0).y).toBeGreaterThan(Y1 + 0.3);
      expect(caminar(n, 0, [[-15.6, 0]])).toBe(true);
      expect(n.nivel.puntoDeControl).toBe(2);
      // El de abajo suelta: la jaula baja sola, se sube; el de arriba se cuelga de la manija de arriba
      n.entradas[1] = QUIETO;
      const jaula = () => n.nivel.pieza("jaula").cuerpo?.translation().y ?? 0;
      expect(hasta(n, 400, () => jaula() < Y0 + 0.1)).toBeGreaterThan(-1);
      n.poner(1, -19.3, Y0 + 0.1, 0);
      const arriba = colgarseDeLaManija(n, 0, "polea-arriba", Y1);
      expect(arriba).toEqual({ colgo: true, llego: true });
      expect(n.pelvis(1).y).toBeGreaterThan(Y1 + 0.3);
      expect(caminar(n, 1, [[-15.6, 0.6]])).toBe(true);
    });

    it("la pared del pozo no se trepa (2.2 m) y desde la jaula no se alcanza la manija de abajo", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(1);
      n.poner(0, -20.0, Y0, 2.2);
      expect(treparHaciaElEste(n, 0, -18.6, Y1)).toBe(-1);
      const manija = n.nivel.polea("polea-abajo").manija.translation();
      expect(manija.x - -20.0).toBeLessThan(-1.2);
    });
  });

  describe("misión 3: la ofrenda del Tío, sin pasar por las velas", () => {
    it("se la lleva entre las velas, se la deja suelta al Tío, que se pone contento y abre su puerta", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(2);
      const ofrenda = n.nivel.ofrenda("ofrenda");
      const tio = n.nivel.tio("tio");
      const puerta = () => n.nivel.pieza("puerta-tio").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      expect(agarrarOfrenda(n, 0)).toBe(true);
      expect(caminar(n, 0, ZIGZAG, AMBOS)).toBe(true);
      expect(ofrenda.sustos).toBe(0);
      expect(ofrenda.agarrado).toBe(1);
      // Mientras la tiene en la mano, El Tío no se la queda
      n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS };
      n.correr(60);
      expect(tio.estado).toBe("esperando");
      expect(tio.mira).toBe(0);
      // Suelta: se la queda
      n.entradas[0] = QUIETO;
      expect(hasta(n, 120, () => tio.estado === "contento")).toBeGreaterThan(-1);
      expect(ofrenda.entregada).toBe(true);
      expect(tio.contento).toBe(true);
      n.correr(180);
      expect(puerta()).toBeGreaterThan(cerrada + 2.6);
      expect(caminar(n, 0, [[2.4, 0]])).toBe(true);
      expect(n.nivel.puntoDeControl).toBe(3);
    });

    it("pasarla por una vela es un susto: el que la llevaba aparece frente a la repisa y la ofrenda vuelve", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(2);
      const ofrenda = n.nivel.ofrenda("ofrenda");
      let asustados: readonly number[] = [];
      ofrenda.alAsustar((j) => {
        asustados = j;
      });
      expect(agarrarOfrenda(n, 1)).toBe(true);
      // Derecho por las velas de la primera hilera
      const vela = n.nivel.velas("velas-1").puntos[1];
      if (!vela) throw new Error("sin vela");
      caminar(n, 1, [[-12.5, vela.z]], AMBOS);
      hasta(
        n,
        300,
        () => ofrenda.sustos > 0,
        () => {
          n.entradas[1] = n.haciaDonde(1, vela.x, vela.z, AMBOS);
        },
      );
      expect(ofrenda.sustos).toBe(1);
      expect(asustados).toEqual([1]);
      expect(n.manos(1, ofrenda.cuerpo)).toBe(0);
      n.entradas[1] = QUIETO;
      n.correr(30);
      expect(ofrenda.enSuLugar).toBe(true);
      expect(n.nivel.tio("tio").contento).toBe(false);
      // Aparece de pie frente a la repisa, para retomar
      expect(Math.abs(n.pelvis(1).x - -13.5)).toBeLessThan(0.6);
      expect(n.pelvis(1).z).toBeGreaterThan(-2.2);
      expect(n.munecos[1].estado).toBe("de pie");
    });
  });

  describe("misión 4: los espejos del salar", () => {
    it("de a dos: cada uno sostiene un espejo en su tope, el haz llega al sol de piedra y sube la puerta de luz", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(3);
      const grieta = n.nivel.grieta("grieta");
      const puerta = () => n.nivel.pieza("puerta-luz").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      empujarEspejo(n, 0, 1);
      empujarEspejo(n, 1, 2);
      expect(
        hasta(n, 200, () => n.nivel.espejo("espejo-1").orientado && n.nivel.espejo("espejo-2").orientado),
      ).toBeGreaterThan(-1);
      n.correr(2);
      expect(grieta.espejos.map((e) => e.nombre)).toEqual(["espejo-1", "espejo-2"]);
      expect(grieta.alumbra(SOL, SOL.radio)).toBe(true);
      // Se apartan hacia adelante: sueltos, los espejos vuelven al reposo (la puerta ya quedó abierta)
      caminar(n, 0, [[4.5, 2.8]]);
      caminar(n, 1, [[13.5, 2.8]]);
      n.correr(200);
      expect(puerta()).toBeGreaterThan(cerrada + 2.6);
      expect(n.nivel.espejo("espejo-1").recorrido).toBeLessThan(0.1);
      expect(grieta.alumbra(SOL, SOL.radio)).toBe(false);
      expect(caminar(n, 1, [[17.0, -1.0]])).toBe(true);
      expect(n.nivel.puntoDeControl).toBe(4);
    });

    it("solo no se puede: con un solo espejo en su tope el haz no llega al sol, y suelto vuelve al reposo", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(3);
      const grieta = n.nivel.grieta("grieta");
      const puerta = () => n.nivel.pieza("puerta-luz").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      for (const cual of [1, 2] as const) {
        empujarEspejo(n, 0, cual);
        expect(hasta(n, 200, () => n.nivel.espejo(`espejo-${cual}`).orientado)).toBeGreaterThan(-1);
        n.correr(30);
        expect(grieta.alumbra(SOL, SOL.radio), `espejo ${cual}`).toBe(false);
        n.entradas[0] = { ...QUIETO, avanzar: -0.6 };
        n.correr(160, (i) => {
          if (i === 40) n.entradas[0] = QUIETO;
          // Ni mientras vuelve al reposo llega el haz al sol
          if (grieta.alumbra(SOL, SOL.radio)) throw new Error(`con el espejo ${cual} solo, el haz llegó al sol`);
        });
        expect(n.nivel.espejo(`espejo-${cual}`).recorrido).toBeLessThan(0.1);
      }
      expect(puerta()).toBeCloseTo(cerrada, 3);
    });
  });

  describe("misión 5: la salida, cuesta abajo en la vagoneta", () => {
    /** Los dos se meten en la vagoneta de salida desde el piso del fondo, caminando hacia ella. */
    const subirse = (n: Mina) => {
      n.poner(0, 19.75, Y1, -0.6, SUR);
      n.poner(1, 20.65, Y1, -0.6, SUR);
      n.correr(10);
      hasta(
        n,
        240,
        () => n.nivel.vagoneta("vagoneta-salida").montados === 2 || !n.nivel.vagoneta("vagoneta-salida").frenada,
        () => {
          n.entradas[0] = n.haciaDonde(0, 19.75, 1.1);
          n.entradas[1] = n.haciaDonde(1, 20.65, 1.1);
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
    };

    it("se meten los dos, se suelta el freno y la vagoneta los baja por el puente de rieles hasta el salar", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(4);
      const vagoneta = n.nivel.vagoneta("vagoneta-salida");
      expect(vagoneta.frenada).toBe(true);
      subirse(n);
      expect(hasta(n, 30, () => !vagoneta.frenada)).toBeGreaterThan(-1);
      expect(hasta(n, 1200, () => n.nivel.puntoDeControl === 5)).toBeGreaterThan(-1);
      expect(vagoneta.montados).toBe(2);
      for (const j of [0, 1] as const) expect(n.pelvis(j).y).toBeLessThan(YS + 1.5);
      const [, , fin] = VIA_SALIDA;
      expect(hasta(n, 600, () => vagoneta.enElTope)).toBeGreaterThan(-1);
      expect(vagoneta.cuerpo.translation().x).toBeCloseTo(fin?.[0] ?? 0, 0);
    });

    it("sin nadie adentro no se mueve; abajo y vacía, vuelve sola a la boca de la mina", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(4);
      const vagoneta = n.nivel.vagoneta("vagoneta-salida");
      n.correr(240);
      expect(vagoneta.avance).toBe(0);
      vagoneta.frenar(false);
      expect(hasta(n, 1200, () => vagoneta.enElTope)).toBeGreaterThan(-1);
      expect(hasta(n, 300, () => vagoneta.avance === 0)).toBeGreaterThan(-1);
      expect(vagoneta.frenada).toBe(true);
    });
  });

  describe("el logro, «Sin chispas»: salir de la mina sin explotar", () => {
    /** Se meten en la vagoneta de salida (sin pasar por lo de antes) y bajan hasta la meta. */
    const bajar = (n: Mina) => {
      n.poner(0, 20.0, Y1 - 0.4, 0.8);
      n.poner(1, 20.5, Y1 - 0.4, 0.8);
      return hasta(n, 1500, () => n.nivel.puntoDeControl === 5);
    };

    it("llegar a la meta sin ningún susto lo da", async () => {
      const n = await armarMina();
      expect(bajar(n)).toBeGreaterThan(-1);
      expect(n.nivel.logro).toBe(true);
    });

    it("con un susto en las velas, no", async () => {
      const n = await armarMina();
      expect(agarrarOfrenda(n, 0)).toBe(true);
      const vela = n.nivel.velas("velas-1").puntos[0];
      if (!vela) throw new Error("sin vela");
      caminar(n, 0, [[-12.5, vela.z]], AMBOS);
      hasta(
        n,
        300,
        () => n.nivel.ofrenda("ofrenda").sustos > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, vela.x, vela.z, AMBOS);
        },
      );
      expect(n.nivel.ofrenda("ofrenda").sustos).toBe(1);
      n.entradas[0] = QUIETO;
      expect(bajar(n)).toBeGreaterThan(-1);
      expect(n.nivel.logro).toBe(false);
    });

    it("retomando un avance de después de la ofrenda no se gana", async () => {
      const n = await armarMina();
      n.nivel.avance.irA(4);
      expect(bajar(n)).toBeGreaterThan(-1);
      expect(n.nivel.logro).toBe(false);
    });
  });

  it("retomar en cada punto deja las piezas como deben estar", async () => {
    for (const punto of [1, 2, 3, 4, 5]) {
      const n = await armarMina();
      const y = (nombre: string) => n.nivel.pieza(nombre).cuerpo?.translation().y ?? 0;
      const cerradas = { reja: y("reja"), tio: y("puerta-tio"), luz: y("puerta-luz") };
      n.nivel.avance.irA(punto);
      n.correr(240);
      expect(n.nivel.puntoDeControl, `punto ${punto}`).toBe(punto);
      expect(y("reja"), `reja en ${punto}`).toBeGreaterThan(cerradas.reja + 2.6);
      expect(n.nivel.vagoneta("vagoneta").porElDesvio, `vagoneta en ${punto}`).toBe(true);
      expect(n.nivel.tio("tio").contento, `Tío en ${punto}`).toBe(punto >= 3);
      expect(n.nivel.ofrenda("ofrenda").entregada).toBe(punto >= 3);
      expect(y("puerta-tio") > cerradas.tio + 2.6, `puerta del Tío en ${punto}`).toBe(punto >= 3);
      expect(y("puerta-luz") > cerradas.luz + 2.6, `puerta de luz en ${punto}`).toBe(punto >= 4);
      const salida = n.nivel.vagoneta("vagoneta-salida");
      expect(salida.enElTope, `vagoneta de salida en ${punto}`).toBe(punto >= 5);
      // La jaula, abajo; los dos, de pie donde reaparecen
      expect(y("jaula")).toBeLessThan(Y0 + 0.1);
      for (const j of [0, 1] as const) expect(n.munecos[j].estado, `jugador ${j} en ${punto}`).toBe("de pie");
    }
  });

  it("el secreto: la pepita de plata en la galería vieja, trepando su repisa de 1.4 m", async () => {
    const n = await armarMina();
    n.nivel.avance.irA(1);
    n.poner(0, -26.4, Y0, -2.5);
    n.correr(20);
    expect(treparHaciaElEste(n, 0, -25.6, Y0 + 1.4)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        200,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, -24.6, -2.6);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con la vagoneta empujada y la ofrenda al Tío, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarMina();
      n.poner(0, -47.4, Y0, 1.2);
      sostenerCambio(n, 1);
      empujarVagoneta(n, 0, 600);
      n.nivel.avance.irA(2);
      agarrarOfrenda(n, 0);
      caminar(n, 0, ZIGZAG.slice(0, 4), AMBOS);
      const todo: number[] = [n.nivel.vagoneta("vagoneta").avance, n.nivel.ofrenda("ofrenda").sustos];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBeGreaterThan(5);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica las piezas nuevas, ve al Tío contento y el haz", async () => {
    const anfitrion = await armarMina();
    const invitado = await armarMina();
    // El anfitrión: la vagoneta empujada un trecho, la ofrenda en el regazo del Tío, la jaula arriba y los dos
    // espejos en su tope
    anfitrion.poner(0, -47.4, Y0, 1.2);
    empujarVagoneta(anfitrion, 0, 200);
    anfitrion.nivel.tio("tio").recibir(anfitrion.nivel.ofrenda("ofrenda"));
    empujarEspejo(anfitrion, 0, 1);
    empujarEspejo(anfitrion, 1, 2);
    expect(
      hasta(
        anfitrion,
        200,
        () => anfitrion.nivel.espejo("espejo-1").orientado && anfitrion.nivel.espejo("espejo-2").orientado,
      ),
    ).toBeGreaterThan(-1);
    anfitrion.correr(2);

    const foto = (n: Mina) => {
      const deAca = cuerposMoviles(n.mundo);
      return leerFoto(
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
    };
    const f = foto(anfitrion);
    if (!f) throw new Error("la foto no se pudo leer");
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(cuerposMoviles(anfitrion.mundo).length);
    deAlla.forEach((c, i) => {
      c.setTranslation(
        { x: f.posiciones[3 * i] ?? 0, y: f.posiciones[3 * i + 1] ?? 0, z: f.posiciones[3 * i + 2] ?? 0 },
        false,
      );
      const r = f.rotaciones;
      c.setRotation({ x: r[4 * i] ?? 0, y: r[4 * i + 1] ?? 0, z: r[4 * i + 2] ?? 0, w: r[4 * i + 3] ?? 1 }, false);
    });
    invitado.armado.guardar();
    invitado.armado.dibujar(1, 0);
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["vagoneta", "vagoneta-salida", "espejo-1", "espejo-2", "ofrenda", "tio", "polea-abajo"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // Sin correr nada, el invitado ve al Tío contento, los espejos en su tope y el haz hasta el sol de piedra
    expect(invitado.nivel.tio("tio").estado).toBe("esperando");
    expect(invitado.nivel.tio("tio").contento).toBe(true);
    expect(invitado.nivel.espejo("espejo-2").recorrido).toBeGreaterThan(0.9);
    expect(invitado.nivel.grieta("grieta").alumbra(SOL, SOL.radio)).toBe(true);
    expect(invitado.nivel.grieta("grieta").camino.length).toBe(anfitrion.nivel.grieta("grieta").camino.length);
  });
});
