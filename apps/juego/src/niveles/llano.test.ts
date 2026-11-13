// El nivel 11, El llano (TU-44), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, el Silbón silba al
// revés, y lo que se mueve viaja en la foto de la red (también el silbido, que el invitado calcula con los cuerpos
// que le llegan). Para no repetir el camino entero, cada prueba pone a los muñecos donde empieza su misión (como
// `&punto=N`, o un poco más cerca). Las x de las pruebas son las del nivel antes de correrlo `DX` (como en
// scripts/niveles/llano.mjs): `pelvis`, `poner` y `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DX, ESCONDITES, RANCHO } from "../../../../niveles/11-llano/guion";
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
/** La sabana, como en scripts/niveles/llano.mjs. */
const G = 0;
/** El escondite del Silbón (la tercera mata). */
const SILBON = { x: 18.5, z: -5.2 };

async function armarLlano() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("11-llano");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.llano?.crearGuion() });
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
type Llano = Awaited<ReturnType<typeof armarLlano>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Llano, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Camina hasta (x, z) y se queda quieto; devuelve en cuántos pasos llegó (o −1). */
function irA(n: Llano, j: 0 | 1, x: number, z: number, pasos = 900, cerca = 0.3, extra: Partial<EntradaMuneco> = {}) {
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

describe("El llano (niveles/11-llano)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarLlano();
    expect(plano.numero).toBe(11);
    expect(plano.nombre).toBe("El llano");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "ganado ganado",
      "hamaca hamaca",
      "molino molino",
      "palanca freno",
      "palanca palanca-puente",
      "saco saco",
      "silbon silbon",
      "tranca tranca",
    ]);
    expect(nivel.silbon("silbon").estado).toBe("escondido");
    expect(nivel.silbon("silbon").silba).toBe(true);
    expect(nivel.ganado("ganado").reses).toHaveLength(3);
    expect(() => nivel.molino("hamaca")).toThrow(/molino «hamaca»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: el Silbón en el pajonal, que silba al revés", () => {
    it("suena al revés: fuerte desde la salida, bajito junto a su mata; a cada uno lo suyo", async () => {
      const n = await armarLlano();
      const silbon = n.nivel.silbon("silbon");
      n.correr(10);
      const [rojo, turquesa] = silbon.silbidos();
      expect(rojo?.volumen).toBeGreaterThan(0.8);
      // Está a la derecha (+x) del que está en la salida, pero suena a la izquierda
      expect(rojo?.paneo).toBeLessThan(-0.9);
      n.poner(0, SILBON.x - 2, G, SILBON.z + 1.2);
      n.correr(10);
      const [cerca, lejos] = silbon.silbidos();
      expect(cerca?.volumen).toBeLessThan(0.15);
      expect(lejos?.volumen).toBeCloseTo(turquesa?.volumen ?? 0, 2);
      expect(silbon.silba).toBe(true);
    });

    it("yendo derecho a su mata (donde suena más bajito) lo hallan al primer intento: buen oído", async () => {
      const n = await armarLlano();
      const silbon = n.nivel.silbon("silbon");
      let quien: 0 | 1 | null = null;
      silbon.alHallar((j) => {
        quien = j;
      });
      expect(irA(n, 0, SILBON.x - 0.7, SILBON.z + 0.3, 1200, 0.2)).toBeGreaterThan(0);
      expect(quien).toBe(0);
      expect(silbon.hallado).toBe(true);
      expect(n.nivel.logro).toBe(true);
      // Se alza, se va y la talanquera se abre: los dos pasan al punto 1
      n.correr(40);
      expect(silbon.silba).toBe(false);
      expect(silbon.silbidos().every((s) => s.volumen === 0)).toBe(true);
      const paso = hasta(
        n,
        1500,
        () => n.nivel.puntoDeControl >= 1,
        () => {
          n.entradas[0] = n.pelvis(0).x < 23 ? n.haciaDonde(0, 23, 0) : n.haciaDonde(0, 27.4, 0);
        },
      );
      expect(paso).toBeGreaterThan(0);
      // Después aparece bajo su rancho, esperando su saco
      n.correr(300);
      expect(silbon.estado).toBe("esperando");
      expect(
        enNivel(silbon.cuerpo.translation()).distanceTo(new THREE.Vector3(RANCHO.x, RANCHO.y, RANCHO.z)),
      ).toBeLessThan(0.05);
    });

    it("el que revisa antes una mata donde no está lo halla igual, pero sin el logro", async () => {
      const n = await armarLlano();
      const silbon = n.nivel.silbon("silbon");
      const [x, z] = ESCONDITES[0];
      expect(irA(n, 1, x - 0.6, z + 0.6, 900, 0.3)).toBeGreaterThan(0);
      expect(silbon.hallado).toBe(false);
      expect(irA(n, 1, SILBON.x - 0.7, SILBON.z + 0.3, 1200, 0.2)).toBeGreaterThan(0);
      expect(silbon.hallado).toBe(true);
      expect(n.nivel.logro).toBe(false);
    });

    it("sin hallarlo, la talanquera del pajonal no deja pasar", async () => {
      const n = await armarLlano();
      n.poner(0, 22, G, 0);
      n.correr(400, () => {
        n.entradas[0] = n.haciaDonde(0, 27.4, 0);
      });
      expect(n.pelvis(0).x).toBeLessThan(25);
      expect(n.nivel.puntoDeControl).toBe(0);
    });
  });

  describe("misión 2: el molino, uno lo frena y el otro sube por las aspas", () => {
    /** El rojo, frente al freno; el turquesa, al pie de las aspas. */
    const enElMolino = async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(1);
      n.poner(0, 30.55, G, -0.25);
      n.poner(1, 29.3, G, -1.55);
      n.correr(30);
      return n;
    };
    const frenar = (n: Llano) => ({ ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 0.8 });

    it("frenado, para con las aspas en rampa, del borde del pozo hasta las pacas", async () => {
      const n = await enElMolino();
      const molino = n.nivel.molino("molino");
      expect(molino.velocidad).toBeGreaterThan(1);
      const paro = hasta(
        n,
        900,
        () => molino.parada,
        () => {
          n.entradas[0] = frenar(n);
        },
      );
      expect(paro).toBeGreaterThan(0);
      expect(n.nivel.palanca("freno").activa).toBe(true);
      expect(molino.giro % Math.PI).toBeCloseTo((15 * Math.PI) / 180, 3);
      // Al soltar el freno (y apartarse) vuelve a agarrar viento
      n.correr(60, () => {
        n.entradas[0] = { ...n.girarHacia(0, OESTE), avanzar: 1 };
      });
      n.entradas[0] = QUIETO;
      n.correr(120);
      expect(molino.parada).toBe(false);
      expect(molino.velocidad).toBeGreaterThan(1.5);
    });

    it("de a dos: el rojo frena, el turquesa sube por las aspas, baja de las pacas, saca la tranca y pasan", async () => {
      const n = await enElMolino();
      const molino = n.nivel.molino("molino");
      const tranca = n.nivel.tranca("tranca");
      hasta(
        n,
        900,
        () => molino.parada,
        () => {
          n.entradas[0] = frenar(n);
        },
      );
      // Sube por la rampa hasta las pacas y baja por el escalón del otro lado
      let alto = 0;
      const subio = hasta(
        n,
        1500,
        () => n.pelvis(1).x > 41.6 && n.pelvis(1).y < 0.7 && n.munecos[1].estado === "de pie",
        () => {
          n.entradas[0] = frenar(n);
          n.entradas[1] = n.haciaDonde(1, 42.5, -1.55);
          alto = Math.max(alto, n.pelvis(1).y);
        },
      );
      expect(subio).toBeGreaterThan(0);
      expect(alto).toBeGreaterThan(2.6);
      // Ya del otro lado, el rojo suelta el freno; el turquesa va a la tranca, la agarra y camina para atrás
      n.entradas[0] = QUIETO;
      expect(irA(n, 1, 42.6, 0.4, 600, 0.25)).toBeGreaterThan(0);
      expect(irA(n, 1, 40.72, -0.1, 600, 0.1)).toBeGreaterThan(0);
      // Primero se da vuelta hacia la tranca; después alza los brazos, la agarra y camina para atrás
      hasta(
        n,
        120,
        () => Math.abs(Math.atan2(Math.sin(OESTE - n.munecos[1].rumbo), Math.cos(OESTE - n.munecos[1].rumbo))) < 0.05,
        () => {
          n.entradas[1] = n.girarHacia(1, OESTE);
        },
      );
      let alzo = 0;
      let abierto = false;
      const paso = hasta(
        n,
        1500,
        () => n.nivel.puntoDeControl >= 2 && n.pelvis(0).x > 41,
        () => {
          if (!tranca.abierta && alzo < 30) {
            n.entradas[1] = { ...n.girarHacia(1, OESTE), ...AMBOS };
            alzo++;
          } else n.entradas[1] = abierto ? QUIETO : { ...QUIETO, ...AMBOS, avanzar: -0.6 };
          // El rojo pasa por el portón cuando se abre (y queda abierto)
          const porton = n.nivel.pieza("porton").cuerpo?.translation();
          abierto ||= porton !== undefined && enNivel(porton).x < 39;
          n.entradas[0] = !abierto
            ? QUIETO
            : n.pelvis(0).x < 38.6
              ? n.haciaDonde(0, 38.6, 1.6)
              : n.haciaDonde(0, 43.8, 1.6);
        },
      );
      console.log(
        `molino: pasan en ${paso} pasos (tranca ${tranca.recorrido.toFixed(2)}, turquesa en ${n.pelvis(1).x.toFixed(2)}, ${n.pelvis(1).z.toFixed(2)}; rojo en ${n.pelvis(0).x.toFixed(2)}, ${n.pelvis(0).z.toFixed(2)})`,
      );
      expect(paso).toBeGreaterThan(0);
    });

    it("solo no se puede: sin el freno las aspas giran y botan al que se sube; la empalizada y las pacas no se trepan", async () => {
      const n = await enElMolino();
      n.poner(0, 25.5, G, 2.5);
      let alto = 0;
      n.correr(1200, () => {
        n.entradas[1] = n.haciaDonde(1, 42.5, -1.55);
        alto = Math.max(alto, n.pelvis(1).y);
      });
      expect(alto).toBeLessThan(2.3);
      expect(n.pelvis(1).x).toBeLessThan(39.6);
      // Ni frenando y corriendo después: al soltar el freno, las aspas se van antes de que llegue arriba
      const m = await enElMolino();
      const molino = m.nivel.molino("molino");
      m.poner(1, 25.5, G, 2.5);
      m.poner(0, 30.55, G, -0.25);
      hasta(
        m,
        900,
        () => molino.parada,
        () => {
          m.entradas[0] = frenar(m);
        },
      );
      alto = 0;
      m.correr(900, () => {
        m.entradas[0] = m.pelvis(0).x < 29.5 ? m.haciaDonde(0, 42.5, -1.55) : m.haciaDonde(0, 29.3, -1.55);
        alto = Math.max(alto, m.pelvis(0).y);
      });
      expect(alto).toBeLessThan(2.3);
      expect(m.nivel.puntoDeControl).toBe(1);
      // Y por el frente, la empalizada no deja pasar
      m.poner(0, 37.5, G, 1.6);
      m.correr(300, () => {
        m.entradas[0] = m.haciaDonde(0, 43.8, 1.6);
      });
      expect(m.pelvis(0).x).toBeLessThan(39.6);
    });
  });

  describe("misión 3: arrear el ganado hasta el corral", () => {
    it("las reses pastan solas y no se salen del potrero", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(2);
      n.poner(0, 43.8, G, 2.5);
      n.poner(1, 43.8, G, 1.5);
      const ganado = n.nivel.ganado("ganado");
      const antes = ganado.reses.map((r) => enNivel(r.translation()));
      n.correr(1800);
      const despues = ganado.reses.map((r) => enNivel(r.translation()));
      expect(despues.some((p, i) => p.distanceTo(antes[i] ?? p) > 0.3)).toBe(true);
      for (const p of despues) {
        expect(p.x).toBeGreaterThan(40.2);
        expect(p.x).toBeLessThan(57);
        expect(Math.abs(p.z)).toBeLessThan(3.1);
      }
      expect(ganado.encerradas).toBe(0);
    });

    it("los dos las arrean caminando detrás: entran las tres al corral, se abre la talanquera y pasan", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(2);
      const ganado = n.nivel.ganado("ganado");
      n.poner(0, 42.5, G, 1.6);
      n.poner(1, 42.5, G, -1.4);
      n.correr(20);
      const filas = [1.6, -1.4] as const;
      const paso = hasta(
        n,
        4800,
        () => n.nivel.puntoDeControl >= 3,
        () => {
          for (const j of [0, 1] as const) {
            if (ganado.encerradas < ganado.cuantas) {
              // Caminan despacio hacia el corral, cada uno por su fila, empujando con el susto
              const atrasada = Math.min(
                ...ganado.reses.filter((_, i) => !ganado.enElCorral(i)).map((r) => enNivel(r.translation()).x),
              );
              const x = Math.min(56.5, atrasada - 1.5);
              n.entradas[j] = n.pelvis(j).x < x ? n.haciaDonde(j, x + 0.5, filas[j]) : QUIETO;
            } else n.entradas[j] = n.pelvis(j).x < 61.5 ? n.haciaDonde(j, 61.5, 0.2) : n.haciaDonde(j, 64, 0);
          }
        },
      );
      console.log(`ganado: pasan en ${paso} pasos (${ganado.encerradas} encerradas)`);
      expect(ganado.encerradas).toBe(3);
      expect(paso).toBeGreaterThan(0);
    });

    it("con reses afuera del corral, la talanquera no se abre", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(2);
      n.poner(0, 59, G, 1.5);
      n.correr(300, () => {
        n.entradas[0] = n.haciaDonde(0, 64, 0);
      });
      expect(n.pelvis(0).x).toBeLessThan(62);
      expect(n.nivel.puntoDeControl).toBe(2);
    });
  });

  describe("misión 4: la hamaca, uno la estira y el otro sale disparado", () => {
    /** El rojo agarra la manija de la cabuya y camina para atrás hasta estirar la hamaca del todo. */
    const estirar = (n: Llano) => {
      const hamaca = n.nivel.hamaca("hamaca");
      n.poner(0, 67.75, G, 1.9);
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      return hasta(
        n,
        600,
        () => hamaca.estirada > 0.95,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: -0.7 };
        },
      );
    };

    it("de a dos: uno la estira, el otro se mete, sale volando sobre el caño, baja el puente y el otro cruza", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(3);
      const hamaca = n.nivel.hamaca("hamaca");
      n.poner(1, 64.8, G, 0);
      expect(estirar(n)).toBeGreaterThan(0);
      // El turquesa se mete en la hamaca estirada
      expect(
        hasta(
          n,
          400,
          () => hamaca.adentro(n.munecos[1].partes.pelvis.translation()) && n.munecos[1].estado === "de pie",
          () => {
            n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
            const medio = enNivel(hamaca.medio());
            n.entradas[1] = n.haciaDonde(1, medio.x, medio.z);
          },
        ),
      ).toBeGreaterThan(-1);
      n.entradas[1] = QUIETO;
      n.correr(20, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
      });
      expect(hamaca.estado).toBe("estirada");
      // Suelta la cabuya: el turquesa sale volando
      n.entradas[0] = QUIETO;
      n.correr(10);
      expect(hamaca.estado).toBe("disparando");
      const llego = hasta(n, 900, () => n.munecos[1].estado === "de pie" && n.pelvis(1).x > 74.2);
      expect(llego).toBeGreaterThan(0);
      expect(hamaca.lanzados).toBe(1);
      // Del otro lado empuja la palanca del puente; el puente baja y el rojo cruza
      // (rodeando la palanca, que está entre el caño y donde cayó)
      expect(irA(n, 1, 75.2, 0.2, 900, 0.25)).toBeGreaterThan(0);
      expect(irA(n, 1, 75.35, 1.3, 600, 0.15)).toBeGreaterThan(0);
      const puente = n.nivel.pieza("puente-cano").cuerpo;
      const bajo = hasta(
        n,
        600,
        () => (puente?.translation().y ?? 1) < 0,
        () => {
          n.entradas[1] = { ...n.girarHacia(1, ESTE), ...AMBOS, avanzar: 0.8 };
        },
      );
      expect(bajo).toBeGreaterThan(0);
      n.entradas[1] = QUIETO;
      n.correr(90);
      const cruzo = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 4 && n.pelvis(0).x > 74,
        () => {
          n.entradas[0] = n.pelvis(0).x < 69.8 ? n.haciaDonde(0, 69.8, 2.2) : n.haciaDonde(0, 76.6, 2.2);
        },
      );
      expect(cruzo).toBeGreaterThan(0);
    });

    it("solo no se puede: al soltar la cabuya la hamaca vuelve antes de que llegue a meterse", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(3);
      const hamaca = n.nivel.hamaca("hamaca");
      n.poner(1, 63, G, -2.5);
      expect(estirar(n)).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.correr(2);
      const medio = enNivel(hamaca.medio());
      hasta(
        n,
        200,
        () => hamaca.estado === "colgada",
        () => {
          n.entradas[0] = n.haciaDonde(0, medio.x, medio.z);
        },
      );
      expect(hamaca.lanzados).toBe(0);
      expect(n.pelvis(0).x).toBeLessThan(70.6);
      // Y el caño no se salta
      n.poner(0, 69.5, G, 0);
      n.correr(240, (i) => {
        n.entradas[0] = { ...n.haciaDonde(0, 77, 0), saltar: i === 40 };
      });
      expect(n.pelvis(0).x).toBeLessThan(73.8);
    });
  });

  describe("misión 5: devolverle al Silbón su saco de cachivaches", () => {
    it("se trepa la troja, se baja el saco, se lo dejan junto al Silbón, lo recoge y aparece la meta", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(4);
      const silbon = n.nivel.silbon("silbon");
      const saco = n.nivel.saco("saco");
      expect(silbon.estado).toBe("esperando");
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeLessThan(-50);
      n.poner(1, 79.3, G, -2.3);
      n.correr(20);
      expect(trepar(n, 1, ESTE, 80, G + 1.5)).toBeGreaterThan(-1);
      // Baja los brazos, agarra el saco con las dos manos y se baja de la troja con él
      n.entradas[1] = QUIETO;
      n.correr(15);
      const agarro = hasta(
        n,
        300,
        () => saco.agarrado > 0,
        () => {
          n.entradas[1] = { ...n.haciaDonde(1, 81.65, -2.3, AMBOS), avanzar: 0.5 };
        },
      );
      expect(agarro).toBeGreaterThan(-1);
      const bajo = hasta(
        n,
        600,
        () => n.pelvis(1).y < 0.7 && n.munecos[1].estado === "de pie",
        () => {
          // Para atrás, con el saco en las manos, hasta caer de la troja
          n.entradas[1] = { ...n.girarHacia(1, ESTE), ...AMBOS, avanzar: -0.6 };
        },
      );
      expect(bajo).toBeGreaterThan(0);
      expect(saco.agarrado).toBe(1);
      // Lo lleva al rancho (por delante de la troja) y lo suelta junto al Silbón
      expect(irA(n, 1, 80.5, 0, 600, 0.4, AMBOS)).toBeGreaterThan(0);
      expect(
        hasta(
          n,
          900,
          () => Math.hypot(n.pelvis(1).x - RANCHO.x, n.pelvis(1).z - RANCHO.z) < 1.4,
          () => {
            n.entradas[1] = n.haciaDonde(1, RANCHO.x, RANCHO.z, AMBOS);
          },
        ),
      ).toBeGreaterThan(0);
      n.entradas[1] = QUIETO;
      const recogio = hasta(n, 300, () => silbon.conSaco);
      expect(recogio).toBeGreaterThan(-1);
      expect(saco.entregado).toBe(true);
      expect(n.plano.puntos[5]?.zona?.centro.y).toBeGreaterThan(0);
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[1] = n.haciaDonde(1, 98.4, 0);
        },
      );
      expect(llego).toBeGreaterThan(0);
      // Se va contento, con su saco, y se lo traga el pajonal
      n.correr(500);
      expect(silbon.estado).toBe("ido");
      expect(silbon.cuerpo.translation().y).toBeLessThan(-2);
    });

    it("sin el saco, la meta no aparece", async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(4);
      n.correr(600, () => {
        n.entradas[0] = n.haciaDonde(0, 98.4, 0);
      });
      expect(n.nivel.puntoDeControl).toBe(4);
    });
  });

  it("el secreto: el arpa llanera bajo el samán, trepando la tapia del conuco", async () => {
    const n = await armarLlano();
    n.nivel.avance.irA(4);
    n.poner(0, 88.6, G, -2.7, NORTE);
    n.correr(20);
    expect(trepar(n, 0, NORTE, -3.2, G + 1.4)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        400,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 88.6, -5.9);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con el molino, las reses y la hamaca, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarLlano();
      n.nivel.avance.irA(2);
      n.poner(0, 44, G, 1.5);
      n.correr(400, () => {
        n.entradas[0] = n.haciaDonde(0, 52, 0.5);
      });
      const manija = n.nivel.hamaca("hamaca").manija;
      n.correr(60, () => manija.setTranslation({ x: DX + 66.5, y: G + 1.05, z: 1.9 }, true));
      const todo: number[] = [n.nivel.molino("molino").giro];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica las piezas nuevas y oye el silbido igual", async () => {
    const anfitrion = await armarLlano();
    const invitado = await armarLlano();
    // El anfitrión: las reses andando, la hamaca estirada y los muñecos en el pajonal (el Silbón escondido)
    anfitrion.poner(0, 46, G, 0.5);
    anfitrion.correr(200, () => {
      anfitrion.entradas[0] = anfitrion.haciaDonde(0, 52, 0.5);
    });
    const manija = anfitrion.nivel.hamaca("hamaca").manija;
    anfitrion.poner(0, 10, G, -3);
    anfitrion.poner(1, 15, G, -4.5);
    anfitrion.correr(60, () => manija.setTranslation({ x: DX + 66.2, y: G + 1.05, z: 1.9 }, true));
    expect(anfitrion.nivel.hamaca("hamaca").estirada).toBeGreaterThan(0.5);

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
    for (const nombre of ["molino", "ganado", "hamaca", "saco", "silbon", "porton", "puente-cano"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    const giro = (c: RAPIER.RigidBody) => new THREE.Quaternion().copy(c.rotation());
    expect(
      giro(invitado.nivel.molino("molino").rueda).angleTo(giro(anfitrion.nivel.molino("molino").rueda)),
    ).toBeLessThan(0.01);
    for (const [i, res] of anfitrion.nivel.ganado("ganado").reses.entries()) {
      const alla = invitado.nivel.ganado("ganado").reses[i];
      expect(alla && posicion(alla).distanceTo(posicion(res))).toBeLessThan(0.003);
    }
    expect(
      posicion(invitado.nivel.hamaca("hamaca").bolsa).distanceTo(posicion(anfitrion.nivel.hamaca("hamaca").bolsa)),
    ).toBeLessThan(0.003);
    // El silbido: el invitado lo calcula con los cuerpos de la foto y oye lo mismo que el anfitrión
    expect(invitado.nivel.silbon("silbon").silba).toBe(true);
    const aca = anfitrion.nivel.silbon("silbon").silbidos();
    const alla = invitado.nivel.silbon("silbon").silbidos();
    // El turquesa está más cerca: lo oye más bajito
    expect(aca[1]?.volumen).toBeLessThan(aca[0]?.volumen ?? 0);
    for (const [i, s] of aca.entries()) {
      expect(alla[i]?.volumen).toBeCloseTo(s.volumen, 2);
      expect(alla[i]?.paneo).toBeCloseTo(s.paneo, 2);
    }
    // Lo hallan en el anfitrión: el invitado lo ve alzado y deja de oírlo
    anfitrion.poner(1, SILBON.x - 1, G, SILBON.z + 0.5);
    anfitrion.correr(90);
    expect(anfitrion.nivel.silbon("silbon").hallado).toBe(true);
    enviar();
    expect(invitado.nivel.silbon("silbon").silba).toBe(false);
    expect(
      invitado.nivel
        .silbon("silbon")
        .silbidos()
        .every((s) => s.volumen === 0),
    ).toBe(true);
  });
});

/** Trepa un escalón fijo con la cara en `cara` (a lo largo de x si mira al este, de z si mira al norte): se para a
 * 40 cm de la cara, alza los brazos, salta, se cuelga y trepa hasta quedar arriba de pie, más alto que `arriba`. */
function trepar(n: Llano, j: 0 | 1, rumbo: number, cara: number, arriba: number) {
  const haciaX = Math.abs(Math.sin(rumbo)) > 0.5;
  const signo = haciaX ? Math.sign(Math.sin(rumbo)) : Math.sign(Math.cos(rumbo));
  const a = (j2: 0 | 1) => (haciaX ? n.pelvis(j2).x : n.pelvis(j2).z);
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && (a(j) - cara) * signo > 0.1;
  hasta(
    n,
    240,
    () => Math.abs(a(j) - (cara - 0.4 * signo)) < 0.05 && n.munecos[j].estado === "de pie",
    () => {
      const falta = (cara - 0.4 * signo - a(j)) * signo;
      n.entradas[j] = { ...n.girarHacia(j, rumbo), avanzar: Math.max(-0.5, Math.min(0.5, falta * 4)) };
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
