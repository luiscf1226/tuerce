// El nivel 8, El cafetal (TU-41), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, El Cipitío tira sus
// piedras y se come el guineo, y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada
// prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { BUEN_PULSO, CANDADO, enElRecibidero, PORTILLO, TAPIA, Y0, Y1, Y2 } from "../../../../niveles/08-cafetal/guion";
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

async function armarCafetal() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("08-cafetal");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.cafetal?.crearGuion() });
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
type Cafetal = Awaited<ReturnType<typeof armarCafetal>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (-1 si no se cumplió). */
function hasta(n: Cafetal, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Se para a `distancia` de una pared que tiene la cara en `cara` (x, mirando al este), alza los brazos, salta, se
 * cuelga y trepa. Devuelve en cuántos pasos subió, o -1. */
function treparHaciaElEste(n: Cafetal, j: 0 | 1, cara: number, arriba: number, distancia = 0.4) {
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

/** Misión 1. El de `quien` en el tapesco agarra el canasto `k` (1 a 3), retrocede, salta y lo suelta en el aire. */
function lanzarCanasto(n: Cafetal, quien: 0 | 1, k: number) {
  const canasto = n.nivel.canasto(`canasto-${k}`);
  const z = canasto.cuerpo.translation().z;
  n.poner(quien, -30.5, Y0 + 0.8, z);
  n.entradas[quien] = QUIETO;
  n.correr(20);
  // Se acerca con los brazos alzados hasta agarrarlo
  hasta(
    n,
    150,
    () => n.manos(quien, canasto.cuerpo) > 0,
    () => {
      n.entradas[quien] = { ...n.girarHacia(quien, ESTE), ...AMBOS, avanzar: 0.4 };
    },
  );
  n.entradas[quien] = { ...QUIETO, ...AMBOS };
  n.correr(10);
  const agarro = n.manos(quien, canasto.cuerpo) > 0;
  // Retrocede hasta quedar a 80 cm del poste
  hasta(
    n,
    120,
    () => n.pelvis(quien).x < -30.05,
    () => {
      n.entradas[quien] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
    },
  );
  n.entradas[quien] = { ...QUIETO, ...AMBOS };
  n.correr(30);
  // Salta y lo suelta en el aire
  n.correr(12, (i) => {
    n.entradas[quien] = { ...QUIETO, ...(i < 10 ? AMBOS : {}), saltar: i < 3 };
  });
  n.entradas[quien] = QUIETO;
  return agarro;
}

/** El que atrapa: parado en el patio, frente al canasto `k`, con los brazos alzados mirando al tapesco. */
function esperarCanasto(n: Cafetal, quien: 0 | 1, k: number) {
  const z = n.nivel.canasto(`canasto-${k}`).cuerpo.translation().z;
  n.poner(quien, -26.75, Y1, z, OESTE);
  // Recién puesto, suelta los brazos un momento (si no, no agarra nada: ver `reaparecer`)
  n.entradas[quien] = QUIETO;
  n.correr(5);
  n.entradas[quien] = { ...QUIETO, ...AMBOS };
}

/** El que lo atrapó lo lleva al recibidero, se mete y lo suelta adentro. */
function vaciarCanasto(n: Cafetal, quien: 0 | 1) {
  const adentro = new THREE.Vector3(-22.3, 0, -1.6);
  hasta(
    n,
    600,
    () => Math.hypot(n.pelvis(quien).x - adentro.x, n.pelvis(quien).z - adentro.z) < 0.2,
    () => {
      n.entradas[quien] = n.haciaDonde(quien, adentro.x, adentro.z, { ...AMBOS, avanzar: 0.6 });
    },
  );
  n.entradas[quien] = QUIETO;
  n.correr(60);
}

describe("El cafetal (niveles/08-cafetal)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarCafetal();
    expect(plano.numero).toBe(8);
    expect(plano.nombre).toBe("El cafetal");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "canasto canasto-1",
      "canasto canasto-2",
      "canasto canasto-3",
      "cipitio cipitio",
      "guineo guineo",
      "polea polea",
      "saco saco-1",
      "saco saco-2",
      "zaranda zaranda",
    ]);
    expect(nivel.canasto("canasto-1").estado).toBe("en su lugar");
    expect(nivel.zaranda("zaranda").trabada).toBe(true);
    expect(nivel.cipitio("cipitio").estado).toBe("sentado");
    expect(() => nivel.canasto("saco-1")).toThrow(/canasto «saco-1»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: los canastos, uno los lanza y el otro los atrapa", () => {
    it("el que está en el patio atrapa en el aire el canasto que el otro lanza desde el tapesco", async () => {
      const n = await armarCafetal();
      esperarCanasto(n, 1, 2);
      expect(lanzarCanasto(n, 0, 2)).toBe(true);
      const canasto = n.nivel.canasto("canasto-2");
      expect(hasta(n, 90, () => n.manos(1, canasto.cuerpo) > 0)).toBeGreaterThan(-1);
      expect(canasto.atrapadas).toBe(1);
      expect(canasto.estado).toBe("llevado");
      expect(canasto.lanzador).toBe(0);
    });

    it("de a dos: con tres canastos vaciados en el recibidero baja el portón del patio y pasan", async () => {
      const n = await armarCafetal();
      const porton = () => n.nivel.pieza("porton-patio").cuerpo?.translation().y ?? 0;
      const cerrado = porton();
      for (const k of [1, 2, 3]) {
        const canasto = n.nivel.canasto(`canasto-${k}`);
        esperarCanasto(n, 1, k);
        lanzarCanasto(n, 0, k);
        expect(
          hasta(n, 90, () => n.manos(1, canasto.cuerpo) > 0),
          `canasto ${k}`,
        ).toBeGreaterThan(-1);
        // Mientras no hay tres, el portón sigue cerrado
        expect(porton()).toBeCloseTo(cerrado, 3);
        let cayo: THREE.Vector3 | undefined;
        const dejar = canasto.alCaer((donde) => {
          cayo = donde;
        });
        vaciarCanasto(n, 1);
        dejar();
        expect(cayo && enElRecibidero(cayo), `canasto ${k} en el recibidero`).toBe(true);
        expect(canasto.estado).toBe("en su lugar");
      }
      n.correr(150);
      expect(porton()).toBeLessThan(cerrado - 2.4);
      expect(
        hasta(
          n,
          900,
          () => n.nivel.puntoDeControl >= 1,
          () => {
            n.entradas[1] = n.haciaDonde(1, -16, 0);
          },
        ),
      ).toBeGreaterThan(0);
    });

    it("solo no se puede: el canasto que nadie atrapa cae en el patio y se riega (lejos del recibidero)", async () => {
      const n = await armarCafetal();
      n.poner(1, -40, Y0, 0);
      const canasto = n.nivel.canasto("canasto-2");
      let cayo: THREE.Vector3 | undefined;
      canasto.alCaer((donde) => {
        cayo = donde;
      });
      lanzarCanasto(n, 0, 2);
      n.correr(120);
      expect(cayo).toBeDefined();
      if (!cayo) return;
      // Cayó en el patio, a más de dos metros del recibidero
      expect(cayo.y).toBeGreaterThan(Y1);
      expect(cayo.x).toBeLessThan(-25.2);
      expect(enElRecibidero(cayo)).toBe(false);
      expect(canasto.estado).toBe("en su lugar");
      expect(n.nivel.pieza("porton-patio").cuerpo?.translation().y ?? 0).toBeGreaterThan(Y1);
    });

    it("solo no se puede: con un canasto en las manos no se trepa al patio, y sin él sí", async () => {
      const n = await armarCafetal();
      const canasto = n.nivel.canasto("canasto-3");
      // Lo agarra en el tapesco, se baja al callejón de entre el tapesco y el patio e intenta treparse
      lanzarCanasto(n, 0, 3);
      n.poner(0, -30.5, Y0 + 0.8, canasto.cuerpo.translation().z);
      n.entradas[0] = QUIETO;
      n.correr(10);
      hasta(
        n,
        150,
        () => n.manos(0, canasto.cuerpo) > 0,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      expect(n.manos(0, canasto.cuerpo)).toBeGreaterThan(0);
      // Del tapesco al callejón, caminando con el canasto alzado
      n.correr(400, () => {
        const p = n.pelvis(0);
        n.entradas[0] =
          p.z < 1.6 && p.x < -29 ? n.haciaDonde(0, -30.5, 2.2, AMBOS) : n.haciaDonde(0, -28.4, 2.2, AMBOS);
      });
      expect(n.manos(0, canasto.cuerpo)).toBeGreaterThan(0);
      let paso = 0;
      n.correr(300, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, saltar: paso < 3, avanzar: paso > 40 ? 1 : 0 };
        paso++;
      });
      expect(n.pelvis(0).y).toBeLessThan(Y1);
      // Sin el canasto, se trepa colgándose
      n.entradas[0] = QUIETO;
      n.correr(30);
      expect(treparHaciaElEste(n, 0, -27.8, Y1)).toBeGreaterThan(-1);
    });

    it("el logro, «Buen pulso»: diez canastos atrapados seguidos; uno que se riega sin atrapar corta la racha", async () => {
      const n = await armarCafetal();
      const atrapar = (k: number) => {
        const canasto = n.nivel.canasto(`canasto-${k}`);
        esperarCanasto(n, 1, k);
        lanzarCanasto(n, 0, k);
        const atrapo = hasta(n, 90, () => n.manos(1, canasto.cuerpo) > 0) > -1;
        // Lo suelta en el patio: se cae, pero ya lo habían atrapado (no corta la racha)
        n.entradas[1] = QUIETO;
        n.correr(60);
        return atrapo;
      };
      for (let i = 0; i < BUEN_PULSO - 1; i++) expect(atrapar((i % 3) + 1), `canasto ${i + 1}`).toBe(true);
      expect(n.nivel.logro).toBe(false);
      // Uno que nadie atrapa: se riega y la racha vuelve a empezar
      n.poner(1, -40, Y0, 0);
      lanzarCanasto(n, 0, 1);
      n.correr(120);
      expect(atrapar(2)).toBe(true);
      expect(n.nivel.logro).toBe(false);
      for (let i = 0; i < BUEN_PULSO - 1; i++) expect(atrapar((i % 3) + 1), `canasto ${i + 1}`).toBe(true);
      expect(n.nivel.logro).toBe(true);
    });
  });

  describe("misión 2: las piedras del Cipitío, de escalón", () => {
    it("El Cipitío le tira una piedra a los pies al que está al pie del muro: queda encima, trepa y llegan arriba", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(1);
      const cipitio = n.nivel.cipitio("cipitio");
      n.poner(1, -17, Y1, 1.5);
      n.poner(0, -12.4, Y1, 0);
      n.correr(10);
      // Tira (a él, que está más cerca), se ríe y la piedra cae a sus pies: el muñeco queda parado encima
      expect(hasta(n, 200, () => cipitio.tiradas > 0)).toBeGreaterThan(-1);
      expect(hasta(n, 60, () => cipitio.riendo)).toBeGreaterThan(-1);
      n.correr(90);
      const piedra = cipitio.piedras.find((c) => c.translation().y > Y1 && c.translation().y < Y1 + 1);
      expect(piedra).toBeDefined();
      if (!piedra) return;
      expect(Math.abs(piedra.translation().x - -12.4)).toBeLessThan(0.3);
      expect(n.pelvis(0).y).toBeGreaterThan(Y1 + 0.5 + 0.35);
      // Desde la piedra se trepa el muro (2.1 m) y se llega al punto 2
      expect(treparHaciaElEste(n, 0, -12.0, Y2)).toBeGreaterThan(-1);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 2,
          () => {
            n.entradas[0] = n.haciaDonde(0, -10.4, 0);
          },
        ),
      ).toBeGreaterThan(-1);
      // El Cipitío se fue al portillo de la tapia; la piedra se quedó al pie del muro, y el otro también trepa
      expect(cipitio.asiento.x).toBeCloseTo(PORTILLO.x, 3);
      expect(Math.abs(piedra.translation().x - -12.4)).toBeLessThan(0.3);
      n.poner(1, -13.4, Y1, piedra.translation().z);
      n.entradas[1] = QUIETO;
      n.correr(20);
      hasta(
        n,
        300,
        () => n.pelvis(1).y > Y1 + 0.5 + 0.35,
        () => {
          n.entradas[1] = { ...n.girarHacia(1, ESTE), avanzar: 0.6, saltar: n.pelvis(1).x > -12.95 };
        },
      );
      expect(treparHaciaElEste(n, 1, -12.0, Y2)).toBeGreaterThan(-1);
    });

    it("sin piedra no se trepa el muro: 2.1 m es más de lo que alcanza", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(1);
      const cipitio = n.nivel.cipitio("cipitio");
      // Que no tire (lo dejamos sin vista)
      cipitio.mudarse(cipitio.asiento, cipitio.rumbo, { vista: 0 });
      n.poner(1, -17, Y1, 1.5);
      n.poner(0, -13, Y1, 0);
      n.correr(10);
      expect(treparHaciaElEste(n, 0, -12.0, Y2)).toBe(-1);
      expect(cipitio.tiradas).toBe(0);
      expect(n.nivel.puntoDeControl).toBe(1);
    });
  });

  describe("misión 3: la zaranda entre los dos, hasta que cae la llave", () => {
    /** Los dos (o uno solo) agarran la zaranda de su manija y la mueven para un lado y para el otro. */
    const zarandear = (n: Cafetal, quienes: readonly (0 | 1)[], pasos: number) => {
      const zaranda = n.nivel.zaranda("zaranda");
      n.nivel.avance.irA(2);
      n.poner(0, -7.0, Y2, 0, ESTE);
      n.poner(1, quienes.includes(1) ? -4.0 : -10, Y2, 0, OESTE);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(20);
      hasta(
        n,
        200,
        () => quienes.every((j) => n.manos(j, zaranda.bandeja) > 0),
        () => {
          for (const j of quienes)
            n.entradas[j] = { ...QUIETO, ...AMBOS, avanzar: n.manos(j, zaranda.bandeja) > 0 ? 0 : 0.4 };
        },
      );
      let minimo = 0;
      let maximo = 0;
      n.correr(pasos, (i) => {
        const s = Math.floor(i / 50) % 2 === 0 ? 1 : -1;
        // El de la punta oeste tira para atrás mientras el del este empuja, y al revés
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -s * 0.8 };
        if (quienes.includes(1)) n.entradas[1] = { ...QUIETO, ...AMBOS, avanzar: s * 0.8 };
        minimo = Math.min(minimo, zaranda.corrido);
        maximo = Math.max(maximo, zaranda.corrido);
      });
      return { minimo, maximo };
    };

    it("de a dos: la zarandean, cae la llave, la llevan al candado, se abre la puerta y entran al beneficio", async () => {
      const n = await armarCafetal();
      const zaranda = n.nivel.zaranda("zaranda");
      const puerta = () => n.nivel.pieza("puerta-beneficio").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      const { minimo, maximo } = zarandear(n, [0, 1], 700);
      expect(minimo).toBeLessThan(-0.7);
      expect(maximo).toBeGreaterThan(0.7);
      expect(zaranda.zarandeos).toBeGreaterThanOrEqual(6);
      expect(zaranda.llave.suelta).toBe(true);
      // Sueltan la zaranda; la llave quedó en la repisa de atrás, a la altura de las manos
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
      const llave = zaranda.llave.cuerpo;
      expect(llave.translation().y).toBeGreaterThan(Y2 + 1.1);
      expect(llave.translation().z).toBeLessThan(-0.6);
      // El rojo va por la llave: pasa por debajo de la zaranda con los brazos abajo y los alza frente a la repisa
      n.poner(0, -5.5, Y2, 0.2, NORTE);
      n.entradas[0] = QUIETO;
      n.correr(10);
      hasta(
        n,
        200,
        () => n.pelvis(0).z < -0.6,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), avanzar: 0.4 };
        },
      );
      const agarro = hasta(
        n,
        200,
        () => n.manos(0, llave) > 0,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      expect(agarro).toBeGreaterThan(-1);
      // Y la lleva al candado, junto a la puerta
      expect(puerta()).toBeCloseTo(cerrada, 3);
      expect(
        hasta(
          n,
          900,
          () => zaranda.llave.encajada,
          () => {
            const p = n.pelvis(0);
            n.entradas[0] =
              p.z > -0.55
                ? n.haciaDonde(0, -2.5, -0.95, AMBOS)
                : n.haciaDonde(0, CANDADO.x, CANDADO.z, { ...AMBOS, avanzar: 0.5 });
          },
        ),
      ).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      n.correr(150);
      expect(puerta()).toBeLessThan(cerrada - 2.4);
      expect(
        hasta(
          n,
          600,
          () => n.nivel.puntoDeControl >= 3,
          () => {
            n.entradas[0] = n.haciaDonde(0, 1.2, 0);
          },
        ),
      ).toBeGreaterThan(-1);
    });

    it("solo no se puede: con uno solo la zaranda está trabada y la llave no cae", async () => {
      const n = await armarCafetal();
      const zaranda = n.nivel.zaranda("zaranda");
      const { minimo, maximo } = zarandear(n, [0], 700);
      expect(n.manos(0, zaranda.bandeja)).toBeGreaterThan(0);
      expect(zaranda.trabada).toBe(true);
      expect(Math.max(-minimo, maximo)).toBeLessThan(0.1);
      expect(zaranda.zarandeos).toBe(0);
      expect(zaranda.llave.suelta).toBe(false);
      expect(n.nivel.pieza("puerta-beneficio").cuerpo?.translation().y ?? 0).toBeGreaterThan(Y2 - 0.01);
    });
  });

  describe("misión 4: los sacos a la troja, con la polea", () => {
    /** El muñeco agarra el saco de la tarima (de frente), lo lleva al gancho de la polea y lo suelta: queda colgado. */
    const colgarSaco = (n: Cafetal, j: 0 | 1, k: number) => {
      const saco = n.nivel.saco(`saco-${k}`);
      const polea = n.nivel.polea("polea");
      const t = saco.cuerpo.translation();
      n.poner(j, t.x, Y2, -1.4, NORTE);
      n.entradas[j] = QUIETO;
      n.correr(10);
      hasta(
        n,
        200,
        () => n.manos(j, saco.cuerpo) > 0,
        () => {
          n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      const agarro = n.manos(j, saco.cuerpo) > 0;
      // Hasta el gancho, que espera abajo a la altura de las manos
      const g = polea.gancho.translation();
      hasta(
        n,
        800,
        () => polea.saco === saco,
        () => {
          const p = n.pelvis(j);
          n.entradas[j] =
            p.z < -0.9
              ? n.haciaDonde(j, p.x, -0.2, AMBOS)
              : n.haciaDonde(j, g.x - 0.45, g.z, { ...AMBOS, avanzar: 0.5 });
        },
      );
      n.entradas[j] = QUIETO;
      n.correr(40);
      return { agarro, colgado: polea.saco === saco };
    };
    /** Se para debajo de la manija, mirando hacia ella, salta, se cuelga y la baja hasta que el gancho llega arriba. */
    const colgarseDeLaManija = (n: Cafetal, j: 0 | 1) => {
      const polea = n.nivel.polea("polea");
      const m = polea.manija.translation();
      n.poner(j, m.x - 0.3, Y2, m.z, ESTE);
      n.correr(10);
      n.entradas[j] = { ...QUIETO, ...AMBOS };
      n.correr(15);
      let colgo = false;
      let paso = 0;
      const llego = hasta(
        n,
        400,
        () => polea.subida > 0.98,
        () => {
          colgo ||= polea.colgados > 0;
          n.entradas[j] = { ...n.girarHacia(j, ESTE), ...AMBOS, saltar: paso % 90 < 3 };
          paso++;
        },
      );
      n.entradas[j] = QUIETO;
      n.correr(30);
      return { colgo, llego };
    };

    it("se cuelgan los sacos del gancho y, colgándose de la manija, suben a la troja; con los dos se abre la puerta", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(3);
      n.poner(1, 1.0, Y2, 1.5);
      const puerta = () => n.nivel.pieza("puerta-troja").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      for (const k of [1, 2]) {
        const saco = n.nivel.saco(`saco-${k}`);
        expect(colgarSaco(n, 0, k), `saco ${k}`).toEqual({ agarro: true, colgado: true });
        // Sin nadie en la manija el saco cuelga abajo
        expect(saco.cuerpo.translation().y).toBeLessThan(Y2 + 1.5);
        const { colgo, llego } = colgarseDeLaManija(n, 0);
        expect(colgo).toBe(true);
        expect(llego).toBeGreaterThan(-1);
        // Arriba se descarga en la troja, y ahí se queda
        n.correr(60);
        expect(saco.colgado).toBe(false);
        expect(saco.cuerpo.translation().y).toBeGreaterThan(Y2 + 2.6);
        if (k === 1) expect(puerta()).toBeCloseTo(cerrada, 3);
      }
      n.correr(150);
      expect(puerta()).toBeLessThan(cerrada - 2.4);
      expect(
        hasta(
          n,
          900,
          () => n.nivel.puntoDeControl >= 4,
          () => {
            n.entradas[0] = n.haciaDonde(0, 17.6, 0);
          },
        ),
      ).toBeGreaterThan(-1);
    });

    it("la troja no se trepa (2.6 m) y el saco tirado en el suelo vuelve a su tarima", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(3);
      n.poner(1, 1.0, Y2, 1.5);
      expect(treparHaciaElEste(n, 0, 8.4, Y2 + 2.6)).toBe(-1);
      const saco = n.nivel.saco("saco-1");
      n.poner(0, saco.cuerpo.translation().x, Y2, -1.4, NORTE);
      n.entradas[0] = QUIETO;
      n.correr(10);
      hasta(
        n,
        200,
        () => n.manos(0, saco.cuerpo) > 0,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      expect(n.manos(0, saco.cuerpo)).toBeGreaterThan(0);
      n.correr(60, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.5 };
      });
      n.entradas[0] = QUIETO;
      n.correr(30);
      expect(saco.enSuLugar).toBe(false);
      expect(hasta(n, 400, () => saco.enSuLugar)).toBeGreaterThan(0);
    });
  });

  describe("misión 5: cambiarle las piedras al Cipitío por un guineo", () => {
    it("al que se acerca sin guineo le tira piedrazos que lo tumban: no pasa del portillo", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(4);
      const cipitio = n.nivel.cipitio("cipitio");
      expect(cipitio.asiento.x).toBeCloseTo(PORTILLO.x, 3);
      n.poner(1, 18, Y2, 1.5);
      n.poner(0, 21, Y2, 0);
      n.correr(10);
      let caidas = 0;
      let antes = n.munecos[0].estado;
      n.correr(1500, () => {
        n.entradas[0] = n.haciaDonde(0, 30, 0);
        const ahora = n.munecos[0].estado;
        if (ahora === "caido" && antes !== "caido") caidas++;
        antes = ahora;
      });
      expect(cipitio.tiradas).toBeGreaterThan(3);
      expect(cipitio.pegadas).toBeGreaterThan(1);
      expect(caidas).toBeGreaterThan(1);
      expect(n.pelvis(0).x).toBeLessThan(PORTILLO.x - 0.3);
      expect(n.nivel.puntoDeControl).toBe(4);
    });

    it("al que le trae un guineo no le tira: se lo come, se sube a la tapia y deja pasar a los dos", async () => {
      const n = await armarCafetal();
      n.nivel.avance.irA(4);
      const cipitio = n.nivel.cipitio("cipitio");
      const guineo = n.nivel.guineo("guineo");
      n.poner(1, 18, Y2, 1.5);
      // Agarra el guineo de su mata
      const g = guineo.cuerpo.translation();
      n.poner(0, g.x, Y2, -0.9, NORTE);
      n.entradas[0] = QUIETO;
      n.correr(10);
      hasta(
        n,
        200,
        () => n.manos(0, guineo.cuerpo) > 0,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      expect(n.manos(0, guineo.cuerpo)).toBeGreaterThan(0);
      // Se lo lleva hasta el portillo: con el guineo en la mano, no le tira
      hasta(
        n,
        900,
        () => n.pelvis(0).x > PORTILLO.x - 1.05,
        () => {
          const p = n.pelvis(0);
          n.entradas[0] = p.z < -0.3 ? n.haciaDonde(0, p.x + 0.5, 0, AMBOS) : n.haciaDonde(0, PORTILLO.x, 0, AMBOS);
        },
      );
      expect(cipitio.tiradas).toBe(0);
      expect(n.manos(0, guineo.cuerpo)).toBeGreaterThan(0);
      // Se lo suelta delante: se lo come y se sube contento a la tapia
      n.entradas[0] = QUIETO;
      expect(hasta(n, 60, () => guineo.comido)).toBeGreaterThan(-1);
      expect(cipitio.contento).toBe(true);
      expect(cipitio.asiento.x).toBeCloseTo(TAPIA.x, 3);
      expect(cipitio.asiento.y).toBeCloseTo(TAPIA.y, 3);
      // Ya no tira: pasan los dos por el portillo hasta la meta
      n.poner(1, 24, Y2, 0.5);
      expect(
        hasta(
          n,
          900,
          () => n.nivel.puntoDeControl >= 5,
          () => {
            n.entradas[0] = n.haciaDonde(0, 30.2, 0.8);
            n.entradas[1] = n.haciaDonde(1, 29.6, 0);
          },
        ),
      ).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      n.correr(300, () => {
        n.entradas[1] = n.haciaDonde(1, 29.0, 0);
      });
      expect(n.pelvis(1).x).toBeGreaterThan(PORTILLO.x + 0.5);
      expect(cipitio.tiradas).toBe(0);
    });
  });

  it("el secreto: el sombrero puntudo del Cipitío, trepando las dos gradas de la piedra grande", async () => {
    const n = await armarCafetal();
    n.nivel.avance.irA(5);
    n.poner(0, 30.8, Y2, -1.8);
    n.correr(20);
    expect(treparHaciaElEste(n, 0, 32.0, Y2 + 1.4)).toBeGreaterThan(-1);
    expect(treparHaciaElEste(n, 0, 34.0, Y2 + 2.8)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        200,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 35, -2.4);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con un canasto atrapado y El Cipitío tirando piedrazos, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarCafetal();
      esperarCanasto(n, 1, 1);
      lanzarCanasto(n, 0, 1);
      n.correr(60);
      n.nivel.avance.irA(4);
      n.poner(0, 22, Y2, 0);
      n.correr(400, () => {
        n.entradas[0] = n.haciaDonde(0, 30, 0);
      });
      const cipitio = n.nivel.cipitio("cipitio");
      const todo: number[] = [n.nivel.canasto("canasto-1").atrapadas, cipitio.tiradas, cipitio.pegadas];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBe(1);
    expect(una[1]).toBeGreaterThan(0);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica y dibuja las piezas nuevas (y ve al Cipitío tirando)", async () => {
    const anfitrion = await armarCafetal();
    const invitado = await armarCafetal();
    // El anfitrión: la llave colgada, un saco colgado del gancho a medio subir y El Cipitío en el portillo, con una
    // piedra en la mano, apuntándole al rojo
    anfitrion.nivel.avance.irA(4);
    anfitrion.nivel.zaranda("zaranda").soltarLlave();
    const polea = anfitrion.nivel.polea("polea");
    anfitrion.nivel.saco("saco-1").colgarDe(polea.gancho);
    const cipitio = anfitrion.nivel.cipitio("cipitio");
    anfitrion.poner(0, 22.5, Y2, 0);
    anfitrion.correr(10);
    expect(hasta(anfitrion, 200, () => cipitio.estado === "apuntando")).toBeGreaterThan(-1);
    anfitrion.correr(3);
    expect(cipitio.conPiedra).toBe(true);
    expect(cipitio.riendo).toBe(false);

    const foto = (n: Cafetal) => {
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
    const ubicar = () => {
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
    };
    ubicar();
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["canasto-1", "zaranda", "polea", "saco-1", "saco-2", "guineo", "cipitio"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // La llave, el gancho y las piedras también viajan; el invitado ve la piedra en la mano del Cipitío
    const cuerposDe = (n: Cafetal) => [
      n.nivel.zaranda("zaranda").llave.cuerpo,
      n.nivel.polea("polea").gancho,
      ...n.nivel.cipitio("cipitio").piedras,
    ];
    const alla = cuerposDe(invitado);
    cuerposDe(anfitrion).forEach((c, i) => {
      const otro = alla[i];
      if (!otro) throw new Error("falta un cuerpo");
      expect(posicion(otro).distanceTo(posicion(c))).toBeLessThan(0.003);
    });
    expect(invitado.nivel.cipitio("cipitio").conPiedra).toBe(true);
    expect(invitado.nivel.cipitio("cipitio").riendo).toBe(false);
    // Después de tirar se ríe (echado para atrás): el invitado también lo ve
    expect(hasta(anfitrion, 100, () => cipitio.riendo)).toBeGreaterThan(-1);
    anfitrion.correr(6);
    ubicar();
    expect(invitado.nivel.cipitio("cipitio").riendo).toBe(true);
    expect(invitado.nivel.cipitio("cipitio").conPiedra).toBe(false);
  });
});
