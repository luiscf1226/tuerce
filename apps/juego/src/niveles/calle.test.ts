// El nivel 3, La calle empedrada (TU-25), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar
// con los muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, la Carreta sin
// bueyes saca de la calle al que encuentra, y lo que se mueve viaja en la foto de la red. Para no repetir el camino
// entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
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
/** Las alturas del suelo: la calle de abajo, la de arriba, el corredor alto y la plaza (scripts/niveles/calle.mjs). */
const Y0 = 0;
const Y1 = 1.9;
const G = Y1 + 2;

async function armarCalle() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("03-calle");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.calle?.crearGuion() });
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
  return { rapier, mundo, plano, armado, nivel, munecos, entradas, correr, pelvis, poner, haciaDonde, girarHacia };
}
type Calle = Awaited<ReturnType<typeof armarCalle>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no). */
function hasta(n: Calle, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Sube un escalón fijo (una pared con piso arriba) que tiene la cara en `cara` (x, mirando al este): se para a
 * 40 cm de la cara, alza los brazos, salta, se cuelga y trepa. */
function treparHaciaElEste(n: Calle, j: 0 | 1, cara: number, arriba: number) {
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

describe("la calle empedrada (niveles/03-calle)", () => {
  it("tiene sus piezas, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarCalle();
    expect(plano.numero).toBe(3);
    expect(plano.nombre).toBe("La calle empedrada");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "alfombra alfombra-1",
      "alfombra alfombra-2",
      "alfombra alfombra-3",
      "bejuco enredadera-roja",
      "bejuco enredadera-turquesa",
      "campana campana-1",
      "campana campana-2",
      "carreta carreta",
      "carreta carreta-mirador",
      "engranaje horario",
      "engranaje minutero",
      "engranaje rueda-1",
      "engranaje rueda-2",
      "huacal estorbo-1",
      "huacal estorbo-2",
      "palanca freno",
      "pesa pesa-1",
      "pesa pesa-2",
      "sin-bueyes carreta-sin-bueyes",
    ]);
    expect(nivel.sinBueyes("carreta-sin-bueyes").estado).toBe("esperando");
    expect(() => nivel.carreta("freno")).toThrow(/carreta «freno»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: la carreta cuesta arriba", () => {
    /** Los que empujan (`quienes`) se ponen detrás de la carreta, al pie de la cuesta, y caminan contra ella. */
    const empujar = async (quienes: readonly (0 | 1)[], pasos: number) => {
      const n = await armarCalle();
      const carreta = n.nivel.carreta("carreta");
      n.poner(0, -37.7, Y0, 0.38);
      n.poner(1, -37.7, Y0, -0.38);
      n.correr(20);
      let mas = 0;
      const trabo = hasta(
        n,
        pasos,
        () => carreta.trabada,
        () => {
          for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), avanzar: 1 };
          mas = Math.max(mas, carreta.avance);
        },
      );
      return { n, carreta, trabo, mas };
    };

    it("los dos la empujan hasta arriba, se traba y pasan por al lado hasta el punto 1", async () => {
      const { n, carreta, trabo } = await empujar([0, 1], 900);
      console.log(`cuesta: trabada en ${trabo} pasos`);
      expect(trabo).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
      // Trabada no se va para atrás
      const arriba = carreta.avance;
      expect(arriba).toBeGreaterThan(7);
      // Pasan por el lado de la cámara, donde la cuesta ya es ancha
      for (const j of [0, 1] as const) {
        let rodeo = false;
        const llego = hasta(
          n,
          500,
          () => n.pelvis(j).x > -25.5,
          () => {
            const p = n.pelvis(j);
            rodeo ||= p.z > 1.4;
            n.entradas[j] = rodeo ? n.haciaDonde(j, -24, 1.6) : n.haciaDonde(j, p.x + 0.4, 1.8);
          },
        );
        expect(llego, `jugador ${j}`).toBeGreaterThan(0);
        n.entradas[j] = QUIETO;
      }
      expect(n.nivel.puntoDeControl).toBe(1);
      expect(carreta.avance).toBeCloseTo(arriba, 2);
    });

    it("solo no se puede: uno solo no la mueve cuesta arriba", async () => {
      for (const j of [0, 1] as const) {
        const { carreta, trabo, mas } = await empujar([j], 900);
        expect(trabo).toBe(-1);
        expect(mas).toBeLessThan(0.3);
        expect(carreta.avance).toBeLessThan(0.3);
      }
    });
  });

  describe("misión 2: la Carreta sin bueyes y el freno", () => {
    /** Desde el punto 1: el rojo frente al freno (todavía sin tocarlo), el turquesa a la entrada de la calle. */
    const enLaPlazuela = async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(1);
      n.poner(0, -16.25, Y1, -1.7);
      n.poner(1, -15.8, Y1, 1.5);
      return n;
    };
    /** El turquesa va por la calle, empuja lo que estorba por el zaguán y sigue hasta el punto 2. */
    const cruzar = (n: Calle) => (n.pelvis(1).x < -14.6 ? n.haciaDonde(1, -14.3, 0) : n.haciaDonde(1, -2.5, 0));

    it("de a dos: uno empuja el freno, la carreta se para y el otro quita los huacales del zaguán y pasa", async () => {
      const n = await enLaPlazuela();
      const sinBueyes = n.nivel.sinBueyes("carreta-sin-bueyes");
      const freno = n.nivel.palanca("freno");
      let activo = 0;
      let empujar = false;
      let vuelta = false;
      const paso = hasta(
        n,
        1500,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          // El rojo agarra el freno y, cuando la carreta vuelve a la plazuela, lo empuja hacia la calle y lo sostiene
          vuelta ||= sinBueyes.avance > 5;
          empujar ||= vuelta && sinBueyes.estado === "esperando" && sinBueyes.avance === 0;
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: empujar ? 0.8 : 0 };
          if (freno.activa) activo++;
          // El turquesa espera a que la carreta esté frenada
          n.entradas[1] = sinBueyes.frenada ? cruzar(n) : QUIETO;
        },
      );
      console.log(
        `freno: pasan en ${paso} pasos, freno activo ${activo}, carreta en ${sinBueyes.avance.toFixed(2)} (${sinBueyes.estado}), sacados ${sinBueyes.sacados}`,
      );
      expect(paso).toBeGreaterThan(0);
      expect(sinBueyes.sacados).toBe(0);
      expect(n.nivel.huacal("estorbo-1").cuerpo.translation().x).toBeGreaterThan(-4.9);
      // Pasado el punto 2 queda frenada: el rojo suelta el freno y pasa también (el turquesa sigue un poco, para no
      // quedarse tapando la salida del zaguán con los huacales que empujó)
      const tambien = hasta(
        n,
        900,
        () => n.pelvis(0).x > -4.4,
        () => {
          n.entradas[1] = n.pelvis(1).x < -2.8 ? n.haciaDonde(1, -2.5, 0.6) : QUIETO;
          const p = n.pelvis(0);
          n.entradas[0] = p.z < -0.3 && p.x < -14.6 ? n.haciaDonde(0, -14.6, 0) : n.haciaDonde(0, -2.5, 0);
        },
      );
      expect(tambien).toBeGreaterThan(0);
      expect(sinBueyes.frenada).toBe(true);
      expect(sinBueyes.sacados).toBe(0);
    });

    it("solo no se puede: la carreta rueda sola, no frena y al que encuentra en la calle lo saca", async () => {
      const n = await enLaPlazuela();
      const sinBueyes = n.nivel.sinBueyes("carreta-sin-bueyes");
      n.poner(0, -24, Y1, 2);
      let masLejos = -99;
      const paso = hasta(
        n,
        2400,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          n.entradas[1] = cruzar(n);
          masLejos = Math.max(masLejos, n.pelvis(1).x);
        },
      );
      console.log(`solo: más lejos ${masLejos.toFixed(2)}, sacado ${sinBueyes.sacados} veces`);
      expect(paso).toBe(-1);
      expect(sinBueyes.sacados).toBeGreaterThan(2);
      expect(masLejos).toBeLessThan(-6.5);
    });
  });

  describe("misión 3: la torre del reloj", () => {
    /** El muñeco se para debajo de la manija de la pesa (en el rincón al costado de la torre, mirando hacia ella),
     * alza los brazos, salta y se cuelga hasta que llega abajo. */
    const colgarse = (n: Calle, j: 0 | 1, pesa: string, x: number) => {
      const p = n.nivel.pesa(pesa);
      n.poner(j, x, Y1, 2.4, Math.PI);
      n.correr(10);
      n.entradas[j] = { ...QUIETO, ...AMBOS };
      n.correr(15);
      let colgo = false;
      let paso = 0;
      const llego = hasta(
        n,
        400,
        () => p.llego,
        () => {
          colgo ||= p.colgados > 0;
          n.entradas[j] = { ...n.girarHacia(j, Math.PI), ...AMBOS, saltar: paso % 90 < 3 };
          paso++;
        },
      );
      n.entradas[j] = QUIETO;
      n.correr(30);
      return { colgo, llego };
    };

    it("colgados de las dos pesas, las agujas llegan a las doce, la puerta sube y pasan al punto 3", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(2);
      n.poner(1, -1, Y1, 1.5);
      const puerta = () => n.nivel.pieza("puerta-torre").cuerpo?.translation().y ?? 0;
      const cerrada = puerta();
      // Con la puerta cerrada no se pasa
      n.poner(0, -0.5, Y1, 0);
      expect(
        hasta(
          n,
          240,
          () => n.nivel.puntoDeControl >= 3,
          () => {
            n.entradas[0] = n.haciaDonde(0, 9, 0);
          },
        ),
      ).toBe(-1);
      n.entradas[0] = QUIETO;
      const una = colgarse(n, 0, "pesa-1", 2.6);
      console.log(`pesa 1: colgó ${una.colgo}, llegó en ${una.llego}`);
      expect(una.colgo).toBe(true);
      expect(una.llego).toBeGreaterThan(0);
      // Con una sola pesa abajo, el minutero está en las doce pero la puerta sigue cerrada
      expect(n.nivel.engranaje("minutero").angulo % (Math.PI * 2)).toBeCloseTo(0, 2);
      n.correr(60);
      expect(puerta()).toBeCloseTo(cerrada, 2);
      // La otra pesa (también el mismo muñeco: no es de a dos)
      const otra = colgarse(n, 0, "pesa-2", 4.1);
      expect(otra.llego).toBeGreaterThan(0);
      expect(n.nivel.engranaje("horario").angulo % (Math.PI * 2)).toBeCloseTo(0, 2);
      n.correr(90);
      expect(puerta()).toBeGreaterThan(cerrada + 2.3);
      n.poner(0, 0.8, Y1, -0.2);
      expect(
        hasta(
          n,
          400,
          () => n.nivel.puntoDeControl >= 3,
          () => {
            n.entradas[0] = n.haciaDonde(0, 9, 0);
          },
        ),
      ).toBeGreaterThan(0);
    });
  });

  describe("misión 4: los balcones y las alfombras de aserrín", () => {
    const alfombrasIntactas = (n: Calle) => [1, 2, 3].every((i) => n.nivel.alfombra(`alfombra-${i}`).intacta);

    /** Del jugador `j`: sube la escalinata, camina por el corredor hasta el borde del callejón, se cuelga de su
     * enredadera, se columpia y se suelta sobre el otro tramo. */
    const cruzarElCorredor = (n: Calle, j: 0 | 1, z: number, enredadera: string) => {
      const enElBorde = hasta(
        n,
        700,
        () => n.pelvis(j).x > 17.2,
        () => {
          n.entradas[j] = n.haciaDonde(j, 18.2, z);
        },
      );
      expect(enElBorde, `jugador ${j} en el borde`).toBeGreaterThan(0);
      expect(n.pelvis(j).y).toBeGreaterThan(G + 0.3);
      const bejuco = n.nivel.bejuco(enredadera);
      let colgo = false;
      let solto = false;
      const cruzo = hasta(
        n,
        700,
        () => n.pelvis(j).x > 21.3 && n.munecos[j].estado === "de pie",
        () => {
          const p = n.pelvis(j);
          const v = n.munecos[j].partes.pelvis.linvel();
          colgo ||= bejuco.colgados > 0;
          if (colgo && !solto && p.x > 20.8 && v.x > 0) solto = true;
          n.entradas[j] = solto ? n.haciaDonde(j, 23, z) : { ...QUIETO, ...AMBOS, avanzar: colgo ? Math.sign(v.x) : 1 };
        },
      );
      expect(colgo, `jugador ${j} se colgó`).toBe(true);
      expect(cruzo, `jugador ${j} cruzó`).toBeGreaterThan(0);
      expect(n.pelvis(j).y).toBeGreaterThan(G + 0.3);
      n.entradas[j] = QUIETO;
    };

    it("por el corredor alto, columpiándose en la enredadera sobre el callejón: punto 4 sin pisar, y el logro", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(3);
      n.poner(0, 7.6, Y1, -1.2);
      n.poner(1, 6.4, Y1, -1.85);
      n.correr(20);
      cruzarElCorredor(n, 0, -1.2, "enredadera-roja");
      cruzarElCorredor(n, 1, -1.85, "enredadera-turquesa");
      // Bajan por la otra escalinata, al final de la calle
      for (const j of [0, 1] as const) {
        const llego = hasta(
          n,
          600,
          () => n.pelvis(j).x > 30,
          () => {
            n.entradas[j] = n.pelvis(j).x < 29.3 ? n.haciaDonde(j, 29.6, -1.5) : n.haciaDonde(j, 31, 0);
          },
        );
        expect(llego).toBeGreaterThan(0);
        n.entradas[j] = QUIETO;
      }
      expect(n.nivel.puntoDeControl).toBe(4);
      expect(alfombrasIntactas(n)).toBe(true);
      expect(n.nivel.logro).toBe(true);
    });

    it("por la calle se llega igual, pero las alfombras quedan pisadas y no hay logro", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(3);
      n.poner(0, 7.6, Y1, 1.2);
      n.poner(1, 6.6, Y1, 2.0);
      n.correr(20);
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          n.entradas[0] = n.haciaDonde(0, 31, 1.2);
        },
      );
      expect(llego).toBeGreaterThan(0);
      const pisadas = [1, 2, 3].map((i) => n.nivel.alfombra(`alfombra-${i}`).pisadas);
      console.log(`por la calle: pisadas ${pisadas}`);
      expect(pisadas.every((p) => p > 3)).toBe(true);
      expect(n.nivel.logro).toBe(false);
    });
  });

  describe("misión 5: las dos campanas", () => {
    const SUR = Math.PI;
    /** El muñeco `j` debajo de la manija de la campana en `x`, con los brazos arriba, listo para saltar. */
    const debajo = (n: Calle, j: 0 | 1, x: number) => {
      n.poner(j, x, Y1, -2.1, SUR);
    };
    /** Los que están en `quienes` saltan y se cuelgan de su manija hasta que suena (o pasan los pasos). */
    const colgarse = (n: Calle, quienes: readonly (0 | 1)[], pasos: number) => {
      let paso = 0;
      n.correr(pasos, () => {
        for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, SUR), ...AMBOS, saltar: paso > 15 && paso < 19 };
        paso++;
      });
      for (const j of quienes) n.entradas[j] = QUIETO;
    };
    const reja = (n: Calle) => n.nivel.pieza("reja").cuerpo?.translation().y ?? 0;

    it("de a dos: tocan las dos campanas al mismo tiempo, sube la reja y pasan al punto 5", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(4);
      const cerrada = reja(n);
      debajo(n, 0, 31.5);
      debajo(n, 1, 38.5);
      n.correr(10);
      colgarse(n, [0, 1], 150);
      const [una, otra] = [n.nivel.campana("campana-1"), n.nivel.campana("campana-2")];
      console.log(`campanas: ${una.campanadas} y ${otra.campanadas}, reja ${reja(n) - cerrada}`);
      expect(una.campanadas).toBe(1);
      expect(otra.campanadas).toBe(1);
      n.correr(60);
      expect(reja(n)).toBeGreaterThan(cerrada + 2.5);
      for (const j of [0, 1] as const) {
        expect(
          hasta(
            n,
            600,
            () => n.pelvis(j).x > 43.2,
            () => {
              n.entradas[j] = n.haciaDonde(j, 44, 0);
            },
          ),
        ).toBeGreaterThan(0);
        n.entradas[j] = QUIETO;
      }
      expect(n.nivel.puntoDeControl).toBe(5);
    });

    it("solo no se puede: toca una, corre a la otra y la toca, pero ya no suenan juntas", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(4);
      const cerrada = reja(n);
      n.poner(1, 30, Y1, 1.5);
      debajo(n, 0, 31.5);
      n.correr(10);
      colgarse(n, [0], 120);
      expect(n.nivel.campana("campana-1").campanadas).toBe(1);
      // Corre a la otra campana tan rápido como puede
      const corrio = hasta(
        n,
        600,
        () => n.pelvis(0).x > 38.4,
        () => {
          n.entradas[0] = n.haciaDonde(0, 38.5, -2.1);
        },
      );
      expect(corrio).toBeGreaterThan(0);
      console.log(`solo: corrió entre campanas ${corrio} pasos`);
      // (se acomoda justo debajo de la manija: ya llegó, son los mismos pasos)
      n.entradas[0] = QUIETO;
      debajo(n, 0, 38.5);
      n.correr(10);
      colgarse(n, [0], 120);
      expect(n.nivel.campana("campana-2").campanadas).toBe(1);
      n.correr(60);
      expect(reja(n)).toBeCloseTo(cerrada, 2);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 5,
          () => {
            n.entradas[0] = n.haciaDonde(0, 44, 0);
          },
        ),
      ).toBe(-1);
    });
  });

  describe("misión 6: la bajada en la carreta hasta la plaza", () => {
    /** Desde el punto 5, los dos suben a la carreta por atrás y caminan hasta adelante del eje. */
    const subir = async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(5);
      n.correr(20);
      const carreta = n.nivel.carreta("carreta-mirador");
      const [x0, x1] = [47.85, 47.6];
      const arriba = hasta(
        n,
        600,
        () => n.pelvis(0).x > x0 - 0.1 && n.pelvis(1).x > x1 - 0.1,
        () => {
          n.entradas[0] =
            n.pelvis(0).x > x0 - 0.1 ? n.girarHacia(0, ESTE) : n.haciaDonde(0, x0, 0.35, { avanzar: 0.7 });
          n.entradas[1] =
            n.pelvis(1).x > x1 - 0.1 ? n.girarHacia(1, ESTE) : n.haciaDonde(1, x1, -0.35, { avanzar: 0.7 });
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      return { n, carreta, arriba };
    };

    it("suben los dos adelante del eje, la carreta baja sola sin volcar y llegan a la plaza (la meta)", async () => {
      const { n, carreta, arriba } = await subir();
      expect(arriba).toBeGreaterThan(0);
      let peor = carreta.empinada;
      let rapida = 0;
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 6,
        () => {
          peor = Math.max(peor, carreta.empinada);
          rapida = Math.max(rapida, carreta.velocidad);
        },
      );
      console.log(
        `bajada: llegó en ${llego} pasos, a lo más ${rapida.toFixed(2)} m/s y ${((peor * 180) / Math.PI).toFixed(1)}° empinada`,
      );
      expect(llego).toBeGreaterThan(0);
      expect(peor).toBeLessThan(0);
      // Para en la punta del riel, sin golpe: los dos siguen de pie arriba
      n.correr(120);
      expect(carreta.avance).toBeGreaterThan(11.8);
      expect(carreta.velocidad).toBeCloseTo(0, 1);
      expect(n.munecos.every((m) => m.estado === "de pie")).toBe(true);
      expect(carreta.encima).toBe(2);
    });

    it("con uno solo arriba no sale: espera a los dos", async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(5);
      const carreta = n.nivel.carreta("carreta-mirador");
      hasta(
        n,
        400,
        () => n.pelvis(0).x > 47.7,
        () => {
          n.entradas[0] = n.haciaDonde(0, 47.85, 0.3, { avanzar: 0.7 });
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(240);
      expect(carreta.encima).toBe(1);
      expect(carreta.frenada).toBe(true);
      expect(carreta.avance).toBeCloseTo(0, 2);
    });

    it("si en la bajada los dos se van para atrás, se empina y vuelca: caen a la barranca y la carreta vuelve", async () => {
      const { n, carreta } = await subir();
      // Ya bajando, los dos caminan hacia atrás
      hasta(n, 120, () => carreta.avance > 1.5);
      expect(carreta.frenada).toBe(false);
      let empino = 0;
      let volco = -1;
      n.correr(240, (i) => {
        // Hasta la parte de atrás de la caja (85 cm detrás del eje), y ahí se quedan
        const atras = carreta.cuerpo.translation().x - 0.85;
        for (const j of [0, 1] as const) {
          const falta = n.pelvis(j).x - atras;
          n.entradas[j] = { ...n.girarHacia(j, ESTE), avanzar: falta > 0.05 ? -0.6 : 0 };
        }
        empino = Math.max(empino, carreta.empinada);
        if (volco < 0 && n.munecos.every((m) => m.estado !== "de pie")) volco = i;
      });
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      console.log(
        `vuelco en ${volco}: empinada ${((empino * 180) / Math.PI).toFixed(1)}°, punto ${n.nivel.puntoDeControl}, rojo en ${n.pelvis(0).x.toFixed(2)}`,
      );
      expect(empino).toBeGreaterThan(0.15);
      // Cayeron a la barranca y reaparecieron en el mirador; la carreta vuelve a esperarlos
      expect(n.nivel.puntoDeControl).toBe(5);
      expect(n.pelvis(0).x).toBeLessThan(46);
      expect(n.pelvis(1).x).toBeLessThan(46);
      const volvio = hasta(n, 600, () => carreta.avance < 0.01 && carreta.frenada);
      expect(volvio).toBeGreaterThan(0);
    });
  });

  it("el secreto: trepando el mostrador y la vitrina del carrito del parque se encuentra el pilón", async () => {
    const n = await armarCalle();
    n.nivel.avance.irA(1);
    n.poner(0, -23.4, Y1, -2.4);
    n.correr(20);
    expect(treparHaciaElEste(n, 0, -22.4, Y1 + 1.0), "el mostrador").toBeGreaterThan(0);
    expect(treparHaciaElEste(n, 0, -21.2, Y1 + 2.0), "la vitrina").toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        120,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, -20.6, -2.4);
        },
      ),
    ).toBeGreaterThan(-1);
    expect(n.nivel.secreto).toBe(true);
  });

  it("es determinista: dos corridas iguales, con la Carreta sin bueyes sacando gente, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarCalle();
      n.nivel.avance.irA(1);
      n.poner(0, -15.0, Y1, 0);
      n.correr(400, () => {
        n.entradas[0] = n.haciaDonde(0, -2, 0);
        n.entradas[1] = n.haciaDonde(1, -20, -1);
      });
      const todo: number[] = [n.nivel.sinBueyes("carreta-sin-bueyes").sacados];
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

  it("en línea: con la foto del anfitrión, el invitado ubica las carretas, las pesas, las agujas y las campanas", async () => {
    const anfitrion = await armarCalle();
    const invitado = await armarCalle();
    // El anfitrión: la Carreta sin bueyes rodando, una pesa abajo (con su engranaje y su aguja) y la carreta del
    // mirador bajando sola
    anfitrion.nivel.avance.irA(1);
    anfitrion.nivel.pesa("pesa-1").bajar();
    anfitrion.nivel.carreta("carreta-mirador").frenar(false);
    anfitrion.correr(90);
    expect(anfitrion.nivel.sinBueyes("carreta-sin-bueyes").avance).toBeGreaterThan(0.5);
    expect(anfitrion.nivel.carreta("carreta-mirador").avance).toBeGreaterThan(0.5);

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const foto = leerFoto(
      escribirFoto({
        paso: 90,
        ack: 0,
        estados: ["de pie", "de pie"],
        agarres: 0,
        rumbos: [0, 0],
        velocidades: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        punto: 1,
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
    const giro = (c: RAPIER.RigidBody) => new THREE.Quaternion().copy(c.rotation());
    for (const nombre of [
      "carreta",
      "carreta-sin-bueyes",
      "carreta-mirador",
      "pesa-1",
      "minutero",
      "rueda-1",
      "campana-1",
      "puerta-torre",
      "reja",
    ]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.quaternion.angleTo(giro(real)), nombre).toBeLessThan(0.003);
    }
  });
});
