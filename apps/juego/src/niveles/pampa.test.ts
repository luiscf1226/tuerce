// El nivel 15, La pampa (TU-48), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, La Luz Mala a veces
// guía mal (con azar de semilla) y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada
// prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x de las pruebas son
// las del nivel antes de correrlo `DX` (como en scripts/niveles/pampa.mjs): `pelvis`, `poner` y `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { CAMINO, DX, POSADEROS, SENUELOS } from "../../../../niveles/15-pampa/guion";
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
/** La llanura, como en scripts/niveles/pampa.mjs. */
const G = 0;
/** La orilla de enfrente de la cañada. */
const CANADA_ESTE = 84;

async function armarPampa() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("15-pampa");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.pampa?.crearGuion() });
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
type Pampa = Awaited<ReturnType<typeof armarPampa>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Pampa, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina hasta (x, z) y se queda quieto; devuelve en cuántos pasos llegó (o −1). */
function irA(n: Pampa, j: 0 | 1, x: number, z: number, pasos = 900, cerca = 0.3, extra: Partial<EntradaMuneco> = {}) {
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

describe("La pampa (niveles/15-pampa)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarPampa();
    expect(plano.numero).toBe(15);
    expect(plano.nombre).toBe("La pampa");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "boleadoras boleadoras",
      "candil candil",
      "chambergo chambergo",
      "luz-mala luz-mala",
      "molino molino",
      "palanca palanca-rama",
      "palanca pasador",
      "pampero pampero",
      "pampero pampero-potrero",
      "pie-de-amigo pie-de-amigo",
      "tranquera tranquera",
    ]);
    expect(nivel.tranquera("tranquera").angulo).toBeCloseTo(0, 3);
    expect(nivel.chambergo("chambergo").estado).toBe("volando");
    expect(nivel.pieDeAmigo("pie-de-amigo").activo).toBe(false);
    expect(() => nivel.candil("tranquera")).toThrow(/candil «tranquera»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: seguir a la Luz por el bañado, que a veces guía bien y a veces no", () => {
    it("siguiéndola de parada en parada cruzan, aunque a veces se equivoca y los mete al agua", async () => {
      const n = await armarPampa();
      const luz = n.nivel.luzMala("luz-mala");
      const { paso, caidas } = seguirALaLuz(n, 12000);
      expect(paso).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(1);
      // Con esta semilla se equivoca: el que la siguió cayó al agua y ella volvió a buscarlos
      expect(luz.extravios).toBeGreaterThan(0);
      expect(caidas).toBeGreaterThan(0);
      expect(luz.vueltas).toBeGreaterThan(0);
      // Al final se va a los postes del alambrado de la pampa
      n.correr(1200);
      expect(luz.guio).toBe(true);
      expect(luz.estado).not.toBe("encerrada");
      const [x, z] = POSADEROS[0] ?? [0, 0];
      expect(Math.hypot(enNivel(luz.cuerpo.translation()).x - x, luz.cuerpo.translation().z - z)).toBeLessThan(15);
    });

    it("cada vez que se equivoca va titubeando (ladeada) hacia un señuelo sobre el agua honda", async () => {
      const n = await armarPampa();
      const luz = n.nivel.luzMala("luz-mala");
      let ladeada = 0;
      const desde: number[] = [];
      luz.alExtraviarse((parada) => desde.push(parada));
      seguirALaLuz(n, 12000, () => {
        if (luz.estado !== "despistada") return;
        const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().copy(luz.cuerpo.rotation()), "YXZ");
        ladeada = Math.max(ladeada, Math.abs(e.z));
      });
      expect(desde.length).toBe(luz.extravios);
      for (const parada of desde) expect(SENUELOS[parada]).not.toBeNull();
      expect(ladeada).toBeGreaterThan(0.3);
      // Los señuelos están sobre el agua: debajo no hay calzada
      for (const s of SENUELOS) {
        if (!s) continue;
        expect(n.nivel.aguas.en({ x: DX + s[0], y: -0.3, z: s[1] })).toBeDefined();
        expect(pisoBajo(n, s[0], s[1])).toBeLessThan(-1.5);
      }
    });

    it("la calzada no se ve: el que se manda derecho hacia la otra orilla cae al agua", async () => {
      const n = await armarPampa();
      let caidas = 0;
      let antes = n.pelvis(0);
      n.correr(900, () => {
        n.entradas[0] = n.haciaDonde(0, 32, 0.6);
        if (n.pelvis(0).distanceTo(antes) > 1.5) caidas++;
        antes = n.pelvis(0);
      });
      expect(caidas).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(0);
    });
  });

  describe("misión 2: la tranquera, de a dos: uno la sostiene contra el viento y el otro pasa", () => {
    it("de a dos: el rojo la abre y la sostiene, el turquesa pasa y corre el pasador; pasan los dos: «Contra el viento»", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(1);
      const tranquera = n.nivel.tranquera("tranquera");
      n.poner(0, 39.1, G, 1.0);
      n.poner(1, 36.5, G, 1.6);
      n.correr(30);
      expect(abrirTranquera(n, 0, 1.45)).toBeGreaterThan(0);
      expect(tranquera.sostenida).toBe(1);
      // El turquesa pasa por el hueco y corre el pasador del otro lado
      const sostener = () => {
        n.entradas[0] = sostenerTranquera(n, 0);
      };
      expect(irA(n, 1, 40.8, 0.6, 900, 0.3)).toBeGreaterThan(0);
      hasta(
        n,
        300,
        () => Math.hypot(n.pelvis(1).x - 40.75, n.pelvis(1).z + 1) < 0.2,
        () => {
          sostener();
          n.entradas[1] = n.haciaDonde(1, 40.75, -1.0);
        },
      );
      const trabo = hasta(
        n,
        400,
        () => tranquera.trabada,
        () => {
          sostener();
          n.entradas[1] = { ...n.girarHacia(1, ESTE), ...AMBOS, avanzar: 0.8 };
        },
      );
      expect(trabo).toBeGreaterThan(0);
      expect(tranquera.golpes).toBe(0);
      // Ya trabada, el rojo la suelta, rodea la punta y pasa
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
      expect(tranquera.angulo).toBeGreaterThan((60 * Math.PI) / 180);
      expect(irA(n, 0, 36.2, -2.4, 400, 0.3)).toBeGreaterThan(-1);
      expect(irA(n, 0, 36.2, 0.6, 400, 0.3)).toBeGreaterThan(-1);
      expect(irA(n, 0, 41.5, 0.6, 600, 0.3)).toBeGreaterThan(0);
      expect(n.nivel.logro).toBe(true);
      expect(irA(n, 0, 45, 0.3, 600, 0.4)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(2);
    });

    it("solo no se puede: al soltarla el viento la cierra de golpe antes de que llegue al hueco", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(1);
      const tranquera = n.nivel.tranquera("tranquera");
      n.poner(0, 39.1, G, 1.0);
      n.correr(30);
      expect(abrirTranquera(n, 0, 1.45)).toBeGreaterThan(0);
      n.correr(400, () => {
        const p = n.pelvis(0);
        n.entradas[0] = p.x < 37.2 && p.z < 0 ? n.haciaDonde(0, 36.8, 0.8) : n.haciaDonde(0, 42, 0.6);
      });
      expect(tranquera.golpes).toBe(1);
      expect(tranquera.angulo).toBeLessThan(0.1);
      expect(n.pelvis(0).x).toBeLessThan(40);
      // Ni empujándola: la sombra de la tranquera no se deja, y no se abre hacia el campo
      n.correr(240, () => {
        n.entradas[0] = n.haciaDonde(0, 42, 0);
      });
      expect(n.pelvis(0).x).toBeLessThan(40);
      expect(tranquera.angulo).toBeLessThan(0.1);
      // Ni saltando el alambrado
      n.poner(0, 38.8, G, 2.4);
      n.correr(240, (i) => {
        n.entradas[0] = { ...n.haciaDonde(0, 42, 2.4), saltar: i % 40 === 20 };
      });
      expect(n.pelvis(0).x).toBeLessThan(40);
      expect(n.nivel.puntoDeControl).toBe(1);
    });

    it("si la suelta mientras el otro está en el medio, la tranquera lo voltea hacia atrás, y ya no hay logro", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(1);
      const tranquera = n.nivel.tranquera("tranquera");
      let volteado: number | null = null;
      tranquera.alPortazo((j) => {
        volteado = j;
      });
      n.poner(0, 39.1, G, 1.0);
      n.poner(1, 37.6, G, 1.0, ESTE);
      n.correr(30);
      expect(abrirTranquera(n, 0, 1.45)).toBeGreaterThan(0);
      // El turquesa se mete en el medio, por donde barre la tranquera, y se queda ahí; el rojo la suelta
      expect(irA(n, 1, 38.6, -0.4, 300, 0.25)).toBeGreaterThan(0);
      n.correr(10, () => {
        n.entradas[0] = sostenerTranquera(n, 0);
      });
      n.entradas[0] = QUIETO;
      n.correr(120);
      expect(volteado).toBe(1);
      expect(tranquera.portazos).toBeGreaterThan(0);
      expect(n.pelvis(1).x).toBeLessThan(40);
      // Cuando se levanta, la tranquera ya está cerrada: del lado de acá
      n.correr(300, () => {
        n.entradas[1] = n.munecos[1].estado === "de pie" ? n.haciaDonde(1, 42, 0.4) : QUIETO;
      });
      expect(n.pelvis(1).x).toBeLessThan(40);
      expect(tranquera.angulo).toBeLessThan(0.1);
      expect(tranquera.golpes).toBeGreaterThan(0);
      // Aunque después pasen bien, ya no es «Contra el viento»
      expect(n.nivel.logro).toBe(false);
    });
  });

  describe("misión 3: bajar el chambergo volador con las boleadoras", () => {
    it("se descuelgan las boleadoras, se las tira saltando cuando el chambergo pasa bajo, cae y se abre el portón", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(2);
      const chambergo = n.nivel.chambergo("chambergo");
      const boleadoras = n.nivel.boleadoras("boleadoras");
      let cazador: 0 | 1 | null = null;
      chambergo.alAtrapar((j) => {
        cazador = j;
      });
      // Vuela de verdad: sube y baja y anda por todo el potrero
      let [bajo, alto] = [10, 0];
      n.correr(600, () => {
        const y = chambergo.cuerpo.translation().y;
        bajo = Math.min(bajo, y);
        alto = Math.max(alto, y);
      });
      expect(bajo).toBeLessThan(1.6);
      expect(alto).toBeGreaterThan(2.6);
      expect(cazarElChambergo(n, 0, 6000)).toBeGreaterThan(0);
      expect(cazador).toBe(0);
      expect(boleadoras.estado).toBe("enredadas");
      // Cae al suelo con las boleadoras enredadas, y el portón del puesto se abre
      n.correr(240);
      expect(chambergo.estado).toBe("en el suelo");
      expect(chambergo.cuerpo.translation().y).toBeLessThan(0.2);
      expect(
        new THREE.Vector3().copy(boleadoras.cuerpo.translation()).distanceTo(chambergo.cuerpo.translation()),
      ).toBeLessThan(0.5);
      expect(irA(n, 0, 66.5, 1.6, 900, 0.4)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(3);
    });

    it("no se lo baja con la mano ni con las boleadoras en la mano o caídas: tienen que volar", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(2);
      const chambergo = n.nivel.chambergo("chambergo");
      const boleadoras = n.nivel.boleadoras("boleadoras");
      // Llevadas en la mano, justo donde está el chambergo: no cuenta
      n.poner(0, 47.6, G, -1.2, NORTE);
      n.correr(10);
      expect(
        hasta(
          n,
          200,
          () => boleadoras.estado === "llevadas",
          () => {
            n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: 0.4 };
          },
        ),
      ).toBeGreaterThan(-1);
      n.correr(60, () => {
        boleadoras.cuerpo.setTranslation(chambergo.cuerpo.translation(), true);
      });
      expect(boleadoras.estado).toBe("llevadas");
      expect(chambergo.atrapado).toBe(false);
      // Soltadas sin saltar se caen: tampoco
      n.entradas[0] = QUIETO;
      n.correr(5);
      expect(boleadoras.estado).toBe("tiradas");
      n.correr(60, () => {
        boleadoras.cuerpo.setTranslation(chambergo.cuerpo.translation(), true);
      });
      expect(chambergo.atrapado).toBe(false);
      // Y el portón sigue cerrado: no se pasa
      n.poner(0, 62, G, 0);
      n.correr(300, () => {
        n.entradas[0] = n.haciaDonde(0, 66.5, 0);
      });
      expect(n.pelvis(0).x).toBeLessThan(64);
      expect(n.nivel.puntoDeControl).toBe(2);
    });
  });

  describe("misión 4: subir al ombú haciendo escalera con el compañero", () => {
    it("de a dos: el rojo hace pie de amigo, el turquesa sube por sus manos a la horqueta, baja la rama gacha y cruzan por la rama larga", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(3);
      const pie = n.nivel.pieDeAmigo("pie-de-amigo");
      n.poner(0, 72.55, G, -1.3, ESTE);
      n.poner(1, 73.7, G, -0.1, NORTE);
      n.correr(20);
      const hacerPie = () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
      };
      n.correr(20, hacerPie);
      expect(pie.activo).toBe(true);
      expect(pie.quien).toBe(0);
      // El turquesa se trepa a las manos del rojo, se da vuelta y se trepa a la horqueta
      expect(trepar(n, 1, NORTE, -0.8, G + 1.1, hacerPie)).toBeGreaterThan(-1);
      expect(pie.pisado).toBe(true);
      n.entradas[1] = QUIETO;
      n.correr(30, () => {
        hacerPie();
        n.entradas[1] = n.girarHacia(1, ESTE);
      });
      expect(trepar(n, 1, ESTE, 74, G + 2.6, hacerPie)).toBeGreaterThan(-1);
      expect(n.pelvis(1).y).toBeGreaterThan(2.9);
      n.entradas[0] = QUIETO;
      // Arriba, frente a la palanca, la empuja: la rama gacha baja hasta el suelo y el rojo sube caminando
      n.correr(20, () => {
        n.entradas[1] = n.girarHacia(1, ESTE);
      });
      expect(
        hasta(
          n,
          300,
          () => n.nivel.palanca("palanca-rama").activa,
          () => {
            n.entradas[1] = { ...n.girarHacia(1, ESTE), ...AMBOS, avanzar: 0.8 };
          },
        ),
      ).toBeGreaterThan(-1);
      n.entradas[1] = QUIETO;
      n.correr(150);
      expect(irA(n, 0, 72.0, -1.6, 200, 0.3)).toBeGreaterThan(-1);
      expect(irA(n, 0, 66.2, -1.2, 600, 0.3)).toBeGreaterThan(0);
      expect(irA(n, 0, 65.9, 0, 300, 0.3)).toBeGreaterThan(-1);
      expect(irA(n, 0, 74.6, 0, 900, 0.3)).toBeGreaterThan(0);
      expect(n.pelvis(0).y).toBeGreaterThan(2.9);
      // Los dos por la rama larga, sobre la cañada, a la otra orilla
      expect(irA(n, 1, 76.6, 0.05, 400, 0.3)).toBeGreaterThan(-1);
      expect(irA(n, 1, 87, 0.05, 900, 0.4)).toBeGreaterThan(0);
      expect(irA(n, 0, 87, 0.5, 1200, 0.4)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(4);
    });

    it("solo no se puede: la horqueta no se trepa desde el suelo, y sin nadie que haga pie no hay escalón", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(3);
      const pie = n.nivel.pieDeAmigo("pie-de-amigo");
      // Derecho al tronco: se cuelga y no llega
      n.poner(1, 73.2, G, 0.0, ESTE);
      n.correr(20);
      expect(trepar(n, 1, ESTE, 74, G + 2.6)).toBe(-1);
      expect(n.pelvis(1).y).toBeLessThan(1);
      // Donde iría el escalón no hay nada mientras nadie hace pie
      n.poner(1, 73.7, G, -0.1, NORTE);
      n.correr(20);
      expect(trepar(n, 1, NORTE, -0.8, G + 1.1)).toBe(-1);
      expect(pie.activo).toBe(false);
      // El que hace pie no pisa sus propias manos: el escalón es solo para el otro
      n.poner(0, 72.55, G, -1.3, ESTE);
      n.correr(30, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
      });
      expect(pie.activo).toBe(true);
      const grupos = pie.escalon.collider(0).collisionGroups();
      expect(grupos & 0b010).toBe(0);
      expect(grupos & 0b100).not.toBe(0);
      // Y la cañada no se salta
      n.poner(0, 77.4, G, 1.5);
      n.correr(300, (i) => {
        n.entradas[0] = { ...n.haciaDonde(0, 86, 1.5), saltar: i === 20 };
      });
      expect(n.pelvis(0).x).toBeLessThan(CANADA_ESTE);
      expect(n.nivel.puntoDeControl).toBe(3);
    });
  });

  describe("misión 5: encerrar a la Luz en el candil para alumbrar el camino", () => {
    it("se descuelga el candil, se lo acerca a la Luz posada en un poste, queda encerrada, alumbra y aparece la meta", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(4);
      const luz = n.nivel.luzMala("luz-mala");
      const candil = n.nivel.candil("candil");
      let quien: 0 | 1 | null = null;
      luz.alEncerrar((j) => {
        quien = j;
      });
      expect(luz.estado).toBe("posada");
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeLessThan(-50);
      n.poner(0, 89.5, G, -1.6, NORTE);
      n.correr(20);
      expect(
        hasta(
          n,
          200,
          () => candil.agarrado > 0,
          () => {
            n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: 0.4 };
          },
        ),
      ).toBeGreaterThan(-1);
      expect(encerrarLaLuz(n, 0, 3600)).toBeGreaterThan(0);
      expect(quien).toBe(0);
      expect(luz.candil).toBe(candil);
      expect(candil.encendido).toBe(true);
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeGreaterThan(0);
      // Encerrada, va donde va el candil
      n.correr(60, () => {
        n.entradas[0] = n.haciaDonde(0, 96, 0, AMBOS);
      });
      expect(new THREE.Vector3().copy(luz.cuerpo.translation()).distanceTo(candil.cuerpo.translation())).toBeLessThan(
        0.1,
      );
      expect(irA(n, 0, 104, 0, 900, 0.5, AMBOS)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(5);
    });

    it("se espanta del que se le acerca sin candil, y un candil tirado no la encierra: tiene que estar en la mano", async () => {
      const n = await armarPampa();
      n.nivel.avance.irA(4);
      const luz = n.nivel.luzMala("luz-mala");
      const candil = n.nivel.candil("candil");
      const posada = enNivel(luz.cuerpo.translation());
      n.poner(1, posada.x, G, -1.0, NORTE);
      n.correr(30);
      expect(
        hasta(
          n,
          300,
          () => luz.estado === "revoloteando",
          () => {
            n.entradas[1] = n.haciaDonde(1, posada.x, -2.3);
          },
        ),
      ).toBeGreaterThan(-1);
      expect(luz.estado).toBe("revoloteando");
      // El candil suelto, justo donde se posa la Luz: no la encierra
      n.entradas[1] = QUIETO;
      n.poner(1, 90, G, 1.5);
      for (let i = 0; i < 900; i++) {
        candil.cuerpo.setTranslation(luz.cuerpo.translation(), true);
        n.correr(1);
      }
      expect(luz.estado).not.toBe("encerrada");
      expect(candil.encendido).toBe(false);
      // Y sin la Luz no aparece la meta
      n.correr(300, () => {
        n.entradas[0] = n.haciaDonde(0, 104, 0);
      });
      expect(n.nivel.puntoDeControl).toBe(4);
    });
  });

  it("el secreto: un mate olvidado en la copa del ombú", async () => {
    const n = await armarPampa();
    n.nivel.avance.irA(4);
    n.poner(0, 76.0, G + 2.6, -1.9, ESTE);
    n.correr(20);
    expect(trepar(n, 0, ESTE, 76.5, G + 4.0)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        300,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 77, -1.9);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("al retomar en cada punto, todo queda como debe estar ahí", async () => {
    for (let punto = 0; punto <= 5; punto++) {
      const n = await armarPampa();
      n.nivel.avance.irA(punto);
      n.correr(120);
      const luz = n.nivel.luzMala("luz-mala");
      const tranquera = n.nivel.tranquera("tranquera");
      const chambergo = n.nivel.chambergo("chambergo");
      const rama = n.nivel.pieza("rama-gacha").cuerpo?.translation();
      const porton = n.nivel.pieza("porton-puesto").cuerpo?.rotation();
      expect(luz.guio, `punto ${punto}`).toBe(punto >= 1);
      expect(tranquera.trabada, `punto ${punto}`).toBe(punto >= 2);
      if (punto >= 2) expect(tranquera.angulo).toBeGreaterThan(1.2);
      expect(chambergo.atrapado, `punto ${punto}`).toBe(punto >= 3);
      if (punto >= 3) expect(chambergo.cuerpo.translation().y).toBeLessThan(0.2);
      expect(Math.abs(porton?.y ?? 0) > 0.5, `punto ${punto}`).toBe(punto >= 3);
      expect((rama?.y ?? 9) < 2, `punto ${punto}`).toBe(punto >= 4);
      expect(luz.estado === "encerrada", `punto ${punto}`).toBe(punto >= 5);
      expect((n.plano.puntos[5]?.zona?.centro.y ?? -100) > 0, `punto ${punto}`).toBe(punto >= 5);
      // Los dos están de pie donde retoman, sin caerse
      expect(n.nivel.cayo(0) || n.nivel.cayo(1), `punto ${punto}`).toBe(false);
      expect(n.nivel.puntoDeControl).toBe(punto);
    }
  });

  it("es determinista: dos corridas iguales, con la Luz, el viento, la tranquera y el chambergo, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarPampa();
      seguirALaLuz(n, 2500);
      const todo: number[] = [n.nivel.luzMala("luz-mala").extravios, n.nivel.pampero("pampero").rafagas];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ve el viento, la tranquera, el escalón y la Luz en el candil", async () => {
    const anfitrion = await armarPampa();
    const invitado = await armarPampa();
    anfitrion.nivel.avance.irA(3);
    invitado.nivel.avance.irA(3);
    // El anfitrión: el rojo hace pie de amigo y la tranquera se abre un poco
    anfitrion.poner(0, 72.55, G, -1.3, ESTE);
    anfitrion.correr(40, () => {
      anfitrion.entradas[0] = { ...anfitrion.girarHacia(0, ESTE), ...AMBOS };
    });
    expect(anfitrion.nivel.pieDeAmigo("pie-de-amigo").activo).toBe(true);
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
          punto: 3,
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
    for (const nombre of [
      "tranquera",
      "boleadoras",
      "chambergo",
      "pie-de-amigo",
      "candil",
      "luz-mala",
      "porton-puesto",
      "rama-gacha",
    ]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // El escalón del pie de amigo, donde lo puso el anfitrión (el invitado no corre `antes`)
    const escalon = invitado.nivel.pieDeAmigo("pie-de-amigo").escalon.translation();
    expect(escalon.y).toBeGreaterThan(0.9);
    // El viento: el marcador del pampero llega corrido lo que sopla
    const pampero = anfitrion.nivel.pampero("pampero");
    expect(
      invitado.nivel.pampero("pampero").marcador.translation().x -
        anfitrion.nivel.pampero("pampero").marcador.translation().x,
    ).toBeCloseTo(0, 2);
    expect(pampero.soplo).toBeGreaterThan(0.3);
    // La Luz en el candil: el invitado no sabe que está encerrada, pero la ve adentro y el candil se prende
    anfitrion.nivel.avance.irA(5);
    anfitrion.correr(60);
    expect(anfitrion.nivel.candil("candil").encendido).toBe(true);
    for (let i = 0; i < 60; i++) enviar();
    expect(invitado.nivel.candil("candil").encendido).toBe(false);
    let brilla = 0;
    invitado.armado.escena.traverse((o) => {
      if (o.name !== "candil") return;
      o.traverse((luz) => {
        if (luz instanceof THREE.PointLight) brilla = Math.max(brilla, luz.intensity);
      });
    });
    expect(brilla).toBeGreaterThan(3);
  });
});

/** El piso bajo (x, z) del nivel, sin contar el agua (−10 si no hay nada). */
function pisoBajo(n: Pampa, x: number, z: number) {
  const rayo = new n.rapier.Ray({ x: x + DX, y: 5, z }, { x: 0, y: -1, z: 0 });
  const golpe = n.mundo.castRay(
    rayo,
    20,
    true,
    n.rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | n.rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    ((1 << 16) | (0xffff & ~0b110)) >>> 0,
  );
  return golpe ? 5 - golpe.timeOfImpact : -10;
}

/** El que lleva el candil va al poste donde está posada la Luz, se para frente a él y le acerca el candil con los
 * brazos alzados; si se va a otro poste, la sigue. Devuelve en cuántos pasos la encerró (o −1). */
function encerrarLaLuz(n: Pampa, j: 0 | 1, pasos: number) {
  const luz = n.nivel.luzMala("luz-mala");
  return hasta(
    n,
    pasos,
    () => luz.estado === "encerrada",
    () => {
      const l = enNivel(luz.cuerpo.translation());
      const p = n.pelvis(j);
      const x = luz.estado === "posada" ? l.x : p.x;
      if (Math.abs(p.x - x) > 0.15 || p.z < -2.45 || p.z > -2.2) n.entradas[j] = n.haciaDonde(j, x, -2.3, AMBOS);
      else n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS };
    },
  );
}

/** Trepa un escalón con la cara en `cara` (a lo largo de x si mira al este, de z si mira al norte): se para a
 * 40 cm de la cara, alza los brazos, salta, se cuelga y trepa hasta quedar arriba de pie, más alto que `arriba`.
 * `cadaPaso` mueve al otro mientras tanto. */
function trepar(n: Pampa, j: 0 | 1, rumbo: number, cara: number, arriba: number, cadaPaso?: () => void) {
  const haciaX = Math.abs(Math.sin(rumbo)) > 0.5;
  const signo = haciaX ? Math.sign(Math.sin(rumbo)) : Math.sign(Math.cos(rumbo));
  const a = (j2: 0 | 1) => (haciaX ? n.pelvis(j2).x : n.pelvis(j2).z);
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && (a(j) - cara) * signo > 0.1;
  hasta(
    n,
    240,
    () => Math.abs(a(j) - (cara - 0.4 * signo)) < 0.05 && n.munecos[j].estado === "de pie",
    () => {
      cadaPaso?.();
      const falta = (cara - 0.4 * signo - a(j)) * signo;
      n.entradas[j] = { ...n.girarHacia(j, rumbo), avanzar: Math.max(-0.5, Math.min(0.5, falta * 4)) };
    },
  );
  n.entradas[j] = { ...QUIETO, ...AMBOS };
  n.correr(15, () => cadaPaso?.());
  let paso = 0;
  return hasta(n, 300, subio, () => {
    cadaPaso?.();
    n.entradas[j] = { ...QUIETO, ...AMBOS, saltar: paso < 3, avanzar: paso > 40 ? 1 : 0 };
    paso++;
  });
}

/** Con qué brazos tiene agarrado ese cuerpo (solo esos siguen alzados: el otro suelta lo que haya agarrado). */
function brazosEn(n: Pampa, j: 0 | 1, cuerpo: RAPIER.RigidBody): Partial<EntradaMuneco> {
  const m = n.munecos[j];
  const con = (b: "brazoIzquierdo" | "brazoDerecho") => m.agarrado(b)?.parent()?.handle === cuerpo.handle;
  return { brazoIzquierdo: con("brazoIzquierdo"), brazoDerecho: con("brazoDerecho") };
}

/** El que va a cazar el chambergo: descuelga las boleadoras, se para en el potrero, mira hacia donde va a estar el
 * chambergo y, cuando le queda a tiro (a unos 2 m, bajo), salta y las suelta en el aire. Si erra, espera a que
 * vuelvan a su poste y va a buscarlas. Devuelve en cuántos pasos lo enredó (o −1). */
function cazarElChambergo(n: Pampa, j: 0 | 1, pasos: number, donde: readonly [number, number] = [55, 0]) {
  const ch = n.nivel.chambergo("chambergo");
  const bol = n.nivel.boleadoras("boleadoras");
  let antes = enNivel(ch.cuerpo.translation());
  let tiro = -1;
  return hasta(
    n,
    pasos,
    () => ch.atrapado,
    () => {
      const ahora = enNivel(ch.cuerpo.translation());
      const v = ahora.clone().sub(antes).multiplyScalar(60);
      antes = ahora;
      const p = n.pelvis(j);
      const manos = brazosEn(n, j, bol.cuerpo);
      if (tiro >= 0) {
        // Saltó: suelta en el aire y espera a que caigan
        n.entradas[j] = tiro < 1 ? { ...QUIETO, ...manos, saltar: true } : tiro < 12 ? { ...QUIETO, ...manos } : QUIETO;
        tiro++;
        if (tiro > 20 && bol.estado !== "volando") tiro = -1;
        return;
      }
      if (bol.estado !== "llevadas") {
        // A buscarlas a su poste, cuando vuelvan
        if (bol.estado !== "en su lugar") {
          n.entradas[j] = QUIETO;
          return;
        }
        if (Math.hypot(47.6 - p.x, -1.3 - p.z) > 0.3) n.entradas[j] = n.haciaDonde(j, 47.6, -1.3);
        else n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS, avanzar: 0.4 };
        return;
      }
      if (Math.hypot(donde[0] - p.x, donde[1] - p.z) > 0.5 && p.x < donde[0] - 0.5) {
        n.entradas[j] = n.haciaDonde(j, donde[0], donde[1], manos);
        return;
      }
      // A tiro: donde va a estar en 0.6 s
      const futuro = ahora.clone().addScaledVector(v, 0.6);
      const rumbo = Math.atan2(futuro.x - p.x, futuro.z - p.z);
      const lejos = Math.hypot(futuro.x - p.x, futuro.z - p.z);
      const falta = Math.atan2(Math.sin(rumbo - n.munecos[j].rumbo), Math.cos(rumbo - n.munecos[j].rumbo));
      n.entradas[j] = { ...n.girarHacia(j, rumbo), ...manos };
      if (Math.abs(falta) < 0.15 && lejos > 1.6 && lejos < 2.6 && futuro.y > 1.3 && futuro.y < 2.3) tiro = 0;
    },
  );
}

/** Cruzan el bañado detrás de la Luz: el rojo va adonde ella se para (también cuando se equivoca); el turquesa lo
 * sigue una parada atrás, por las que el rojo ya pisó. El que cae reaparece junto al otro. Devuelve en cuántos pasos
 * llegó alguno al punto 1 (o −1) y cuántas veces cayó el rojo. */
function seguirALaLuz(n: Pampa, pasos: number, cadaPaso?: () => void) {
  const luz = n.nivel.luzMala("luz-mala");
  let destino: THREE.Vector3 | null = null;
  /** La parada más adelantada que pisó el rojo y la del turquesa. */
  let pisada = 0;
  let turquesa = 0;
  let caidas = 0;
  let antes = n.pelvis(0);
  const paso = hasta(
    n,
    pasos,
    () => n.nivel.puntoDeControl >= 1,
    () => {
      cadaPaso?.();
      cadaPaso?.();
      const l = enNivel(luz.cuerpo.translation());
      if (luz.estado === "esperando" || (luz.estado === "despistada" && destino)) destino = l.clone();
      const p = n.pelvis(0);
      if (p.distanceTo(antes) > 1.5) {
        // Cayó y apareció junto al turquesa: espera a que la Luz vuelva a pararse
        caidas++;
        destino = null;
      }
      antes = p;
      // La Luz siguió porque el rojo llegó a su parada: el turquesa ya puede ir hasta ahí
      const dejada = CAMINO[luz.parada - 1];
      if (luz.estado === "volando" && dejada && Math.hypot(dejada[0] - p.x, dejada[1] - p.z) < 1.3) {
        pisada = Math.max(pisada, luz.parada - 1);
      }
      n.entradas[0] =
        destino && Math.hypot(destino.x - p.x, destino.z - p.z) > 0.4 ? conCuidado(n, 0, destino.x, destino.z) : QUIETO;
      const q = n.pelvis(1);
      const punto = CAMINO[turquesa];
      if (!punto) return;
      const cerca = Math.hypot(punto[0] - q.x, punto[1] - q.z) < 0.35;
      if (cerca && turquesa < pisada - 1) turquesa++;
      n.entradas[1] = cerca ? QUIETO : conCuidado(n, 1, punto[0], punto[1]);
    },
  );
  return { paso, caidas };
}

/** Ir hacia (x, z) con cuidado, por una calzada angosta: primero gira en el lugar y después camina. */
function conCuidado(n: Pampa, j: 0 | 1, x: number, z: number): EntradaMuneco {
  const p = n.pelvis(j);
  const rumbo = Math.atan2(x - p.x, z - p.z);
  const falta = Math.abs(Math.atan2(Math.sin(rumbo - n.munecos[j].rumbo), Math.cos(rumbo - n.munecos[j].rumbo)));
  return { ...n.girarHacia(j, rumbo), avanzar: falta < 0.35 ? 1 : 0 };
}

/** La manija de la tranquera, en las x del nivel. */
function manijaDe(n: Pampa) {
  const t = n.nivel.tranquera("tranquera");
  const h = t.hoja.translation();
  const r = t.hoja.rotation();
  return enNivel(new THREE.Vector3(1.2, 0.45, 0.1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(h));
}

/** Lo que aprieta el que sostiene la tranquera: mira a la manija con los brazos alzados y se queda (o retrocede si
 * se cierra un poco). */
function sostenerTranquera(n: Pampa, j: 0 | 1): EntradaMuneco {
  const m = manijaDe(n);
  const p = n.pelvis(j);
  const t = n.nivel.tranquera("tranquera");
  return { ...n.girarHacia(j, Math.atan2(m.x - p.x, m.z - p.z)), ...AMBOS, avanzar: t.angulo < 1.45 ? -0.6 : 0 };
}

/** El que está frente a la manija la agarra y camina para atrás hasta abrirla `hasta` radianes. */
function abrirTranquera(n: Pampa, j: 0 | 1, hastaAngulo: number) {
  const t = n.nivel.tranquera("tranquera");
  hasta(
    n,
    120,
    () => t.sostenida > 0,
    () => {
      n.entradas[j] = { ...n.girarHacia(j, ESTE), ...AMBOS, avanzar: 0.4 };
    },
  );
  return hasta(
    n,
    600,
    () => t.angulo > hastaAngulo,
    () => {
      const m = manijaDe(n);
      const p = n.pelvis(j);
      n.entradas[j] = { ...n.girarHacia(j, Math.atan2(m.x - p.x, m.z - p.z)), ...AMBOS, avanzar: -0.8 };
    },
  );
}
