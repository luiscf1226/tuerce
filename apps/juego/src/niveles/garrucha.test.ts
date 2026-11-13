// El nivel 10, La garrucha (TU-43), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, a La Patasola se le
// gana corriendo y saltando (y caminando no), y lo que se mueve viaja en la foto de la red. Para no repetir el camino
// entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x de las
// pruebas son las del nivel antes de correrlo `DX` (como en scripts/niveles/garrucha.mjs): `pelvis`, `poner` y
// `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { D, DX, G, G2 } from "../../../../niveles/10-garrucha/guion";
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

async function armarGarrucha() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("10-garrucha");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.garrucha?.crearGuion() });
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
type Garrucha = Awaited<ReturnType<typeof armarGarrucha>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Garrucha, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Si el muñeco tiene ese cuerpo agarrado con las dos manos. */
const conLasDos = (m: Muneco, c: RAPIER.RigidBody) =>
  m.agarrado("brazoIzquierdo")?.parent()?.handle === c.handle &&
  m.agarrado("brazoDerecho")?.parent()?.handle === c.handle;

/** El que jala: camina hasta la manija (`x` de la manija en reposo, en `z`), la agarra con las dos manos mirando
 * hacia el cañón (`rumbo`) y camina para atrás hasta jalarla del todo; la suelta, vuelve y otra vez, hasta que se
 * cumpla `listo`. Devuelve en cuántos pasos (o −1). */
function jalar(n: Garrucha, j: 0 | 1, manija: 0 | 1, rumbo: number, listo: () => boolean, pasos: number) {
  const garrucha = n.nivel.garrucha("garrucha");
  const cuerpo = garrucha.manijas[manija];
  let fase: "ir" | "agarrar" | "jalar" | "soltar" = "ir";
  let espera = 0;
  return hasta(n, pasos, listo, () => {
    const m = n.munecos[j];
    const t = enNivel(cuerpo.translation());
    const haciaAtras = { x: -Math.sin(rumbo), z: -Math.cos(rumbo) };
    switch (fase) {
      case "ir": {
        // Hasta quedar a 45 cm detrás de la manija, para agarrarla mirando hacia el cañón
        const x = t.x + haciaAtras.x * 0.45;
        const z = t.z + haciaAtras.z * 0.45;
        const p = n.pelvis(j);
        if (Math.hypot(p.x - x, p.z - z) > 0.12) n.entradas[j] = n.haciaDonde(j, x, z);
        else {
          fase = "agarrar";
          espera = 0;
        }
        break;
      }
      case "agarrar":
        // Alza los brazos y se arrima de a poco hasta que las manos la alcanzan
        n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS, avanzar: espera > 20 ? 0.25 : 0 };
        espera++;
        if (conLasDos(m, cuerpo)) fase = "jalar";
        else if (espera > 90) fase = "ir";
        break;
      case "jalar":
        n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS, avanzar: -0.7 };
        if (garrucha.jalada(manija) > 0.97 || !conLasDos(m, cuerpo)) {
          fase = "soltar";
          espera = 0;
        }
        break;
      case "soltar":
        n.entradas[j] = QUIETO;
        espera++;
        if (espera > 30) fase = "ir";
        break;
    }
  });
}

describe("La garrucha (niveles/10-garrucha)", () => {
  it("tiene sus piezas, cinco puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarGarrucha();
    expect(plano.numero).toBe(10);
    expect(plano.nombre).toBe("La garrucha");
    expect(plano.puntos).toHaveLength(6);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "bejuco liana-1",
      "bejuco liana-2",
      "bejuco liana-3",
      "chiva chiva",
      "garrucha garrucha",
      "huacal chiva-carga",
      "palma palma",
      "palma palma-alta",
      "patasola patasola",
    ]);
    expect(nivel.garrucha("garrucha").recorrido).toBe(0);
    expect(nivel.chiva("chiva").estado).toBe("parada");
    expect(nivel.patasola("patasola").estado).toBe("esperando");
    expect(() => nivel.chiva("garrucha")).toThrow(/chiva «garrucha»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: la garrucha, uno en la canasta y el otro jalando la soga", () => {
    it("de a dos: el rojo va en la canasta, el turquesa jala desde la finca y el rojo llega a la loma", async () => {
      const n = await armarGarrucha();
      const garrucha = n.nivel.garrucha("garrucha");
      // El rojo se sube a la canasta caminando desde el muelle de la finca
      n.poner(0, 11.2, G, 0);
      n.poner(1, 9.5, G, -0.2);
      n.correr(20);
      const subio = hasta(
        n,
        300,
        () => garrucha.encima(n.munecos[0].partes.pelvis.translation()) && n.pelvis(0).x > 12.45,
        () => {
          n.entradas[0] = n.haciaDonde(0, 12.6, 0);
        },
      );
      expect(subio).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      n.correr(40);
      expect(garrucha.aBordo).toBe(1);
      // El turquesa jala la manija de abajo una y otra vez
      const arriba = jalar(n, 1, 0, ESTE, () => garrucha.recorrido > 0.999, 3000);
      console.log(`garrucha: arriba en ${arriba} pasos`);
      expect(arriba).toBeGreaterThan(0);
      expect(garrucha.encima(n.munecos[0].partes.pelvis.translation())).toBe(true);
      // El rojo se baja en la loma: punto 1
      n.entradas[1] = QUIETO;
      const llego = hasta(
        n,
        300,
        () => n.nivel.puntoDeControl >= 1,
        () => {
          n.entradas[0] = n.haciaDonde(0, 28.5, 0);
        },
      );
      expect(llego).toBeGreaterThan(-1);
      // Vacía, la canasta baja sola a la finca
      n.entradas[0] = QUIETO;
      expect(hasta(n, 1200, () => garrucha.recorrido === 0)).toBeGreaterThan(0);
    });

    it("de a dos, de vuelta: el que llegó jala la manija de arriba y sube al otro", async () => {
      const n = await armarGarrucha();
      const garrucha = n.nivel.garrucha("garrucha");
      n.poner(1, 11.2, G, 0);
      n.poner(0, 28.3, G2, 0.6, OESTE);
      n.correr(20);
      hasta(
        n,
        300,
        () => garrucha.encima(n.munecos[1].partes.pelvis.translation()) && n.pelvis(1).x > 12.45,
        () => {
          n.entradas[1] = n.haciaDonde(1, 12.6, 0);
        },
      );
      n.entradas[1] = QUIETO;
      n.correr(40);
      const arriba = jalar(n, 0, 1, OESTE, () => garrucha.recorrido > 0.999, 3000);
      expect(arriba).toBeGreaterThan(0);
      expect(garrucha.encima(n.munecos[1].partes.pelvis.translation())).toBe(true);
    });

    it("solo no se puede: en la canasta sin nadie que jale no se mueve, y la que sube vacía se devuelve", async () => {
      const n = await armarGarrucha();
      const garrucha = n.nivel.garrucha("garrucha");
      n.poner(0, 11.2, G, 0);
      n.poner(1, -6, G, 0);
      hasta(
        n,
        300,
        () => garrucha.encima(n.munecos[0].partes.pelvis.translation()) && n.pelvis(0).x > 12.45,
        () => {
          n.entradas[0] = n.haciaDonde(0, 12.6, 0);
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(600);
      expect(garrucha.recorrido).toBe(0);
      // Desde la canasta no se alcanza la manija: el rojo se baja y la jala él solo, con la canasta vacía
      hasta(
        n,
        300,
        () => n.pelvis(0).x < 11.6,
        () => {
          n.entradas[0] = n.haciaDonde(0, 11, 0);
        },
      );
      jalar(n, 0, 0, ESTE, () => garrucha.recorrido > 0.3, 1200);
      expect(garrucha.recorrido).toBeGreaterThan(0.3);
      expect(garrucha.aBordo).toBe(0);
      // Suelta la manija y la canasta vacía baja sola
      n.entradas[0] = QUIETO;
      expect(hasta(n, 1200, () => garrucha.recorrido === 0)).toBeGreaterThan(0);
    });
  });

  describe("misión 2: la carrera de saltos contra La Patasola", () => {
    /** Las zanjas de la loma (dónde empiezan; miden 70 cm). */
    const ZANJAS = [34.5, 38.5, 42.5, 46.5];
    /** El rojo corre hacia el este, saltando antes de cada zanja, hasta pasar la meta. `andar`: qué tan rápido. */
    const correrCarrera = (n: Garrucha, andar: number, salto: number, pasos: number) => {
      let siguiente = 0;
      return hasta(
        n,
        pasos,
        () => n.pelvis(0).x > 53.2,
        () => {
          const p = n.pelvis(0);
          const zanja = ZANJAS[siguiente];
          let saltar = false;
          if (zanja !== undefined && p.x > zanja - salto) {
            saltar = true;
            siguiente++;
          }
          n.entradas[0] = { ...n.haciaDonde(0, 60, 0), avanzar: andar, saltar };
        },
      );
    };

    it("corriendo y saltando las zanjas, el rojo le gana: el logro «En una pata»", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(1);
      const patasola = n.nivel.patasola("patasola");
      n.correr(30);
      const pasos = correrCarrera(n, 1, 0.3, 1800);
      console.log(`carrera: el rojo llega en ${pasos} pasos; ella va en ${patasola.avance.toFixed(2)}`);
      expect(pasos).toBeGreaterThan(0);
      expect(patasola.carreras).toBe(1);
      expect(patasola.perdidas).toBe(1);
      expect(n.nivel.logro).toBe(true);
      expect(n.nivel.puntoDeControl).toBe(2);
      // Ya no corre: se devuelve a la salida y espera
      expect(hasta(n, 900, () => patasola.estado === "esperando")).toBeGreaterThan(0);
      expect(patasola.avance).toBe(0);
    });

    it("si se queda mirando al salir, gana ella: no hay logro, pero se sigue igual", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(1);
      const patasola = n.nivel.patasola("patasola");
      n.correr(5);
      // El rojo pasa la salida y se queda 4 s mirando
      n.poner(0, 31.3, G2, 0);
      n.correr(240);
      expect(patasola.estado).toBe("corriendo");
      const pasos = correrCarrera(n, 1, 0.3, 3000);
      console.log(`carrera despacio: llega en ${pasos} pasos`);
      expect(pasos).toBeGreaterThan(0);
      expect(patasola.ganadas).toBe(1);
      expect(patasola.perdidas).toBe(0);
      expect(n.nivel.logro).toBe(false);
      expect(n.nivel.puntoDeControl).toBe(2);
    });

    it("retomando más adelante (pasada la salida), no arranca ni da el logro", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(2);
      n.correr(120);
      const patasola = n.nivel.patasola("patasola");
      expect(patasola.carreras).toBe(0);
      expect(n.nivel.logro).toBe(false);
    });

    it("solo arranca cuando alguno pasa la salida, y para otra carrera los dos tienen que volver detrás", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(1);
      const patasola = n.nivel.patasola("patasola");
      n.correr(300);
      expect(patasola.estado).toBe("esperando");
      expect(patasola.carreras).toBe(0);
      // El rojo pasa la línea y se queda: ella corre y gana
      n.poner(0, 31.6, G2, 0);
      n.correr(10);
      expect(patasola.estado).toBe("corriendo");
      expect(hasta(n, 1200, () => patasola.ganadas === 1)).toBeGreaterThan(0);
      expect(hasta(n, 900, () => patasola.estado === "esperando")).toBeGreaterThan(0);
      // Con el rojo todavía adelante de la línea, no vuelve a arrancar
      n.correr(120);
      expect(patasola.estado).toBe("esperando");
      expect(patasola.carreras).toBe(1);
      // Los dos detrás, y otra vez adelante: otra carrera
      n.poner(0, 29, G2, 0);
      n.correr(5);
      n.poner(0, 31.6, G2, 0);
      n.correr(5);
      expect(patasola.carreras).toBe(2);
    });
  });

  describe("misión 3: la chiva, con la carga en el techo sin que se caiga nada", () => {
    /** Los dos, lado a lado frente a la tarima de la bodega, mirando hacia la chiva: caminan con el brazo de adentro
     * alzado (el izquierdo del rojo, el derecho del turquesa), agarran la carga y la llevan hasta el medio del techo.
     * `sostienen`: quiénes alzan el brazo (el otro camina igual). Devuelve en cuántos pasos llegaron (o −1). */
    const cargar = (n: Garrucha, sostienen: readonly (0 | 1)[]) => {
      const chiva = n.nivel.chiva("chiva");
      n.nivel.avance.irA(2);
      n.poner(0, 56.9, G2, 0.5);
      n.poner(1, 56.9, G2, -0.5);
      n.correr(20);
      const pasos = hasta(
        n,
        900,
        () =>
          [0, 1].every(
            (j) => chiva.encima(n.munecos[j as 0 | 1].partes.pelvis.translation()) && n.pelvis(j as 0 | 1).x > 62.5,
          ),
        () => {
          for (const j of [0, 1] as const) {
            const brazo = sostienen.includes(j) ? (j === 0 ? { brazoIzquierdo: true } : { brazoDerecho: true }) : {};
            const p = n.pelvis(j);
            n.entradas[j] =
              p.x > 62.8
                ? { ...QUIETO, ...brazo }
                : { ...n.haciaDonde(j, 64, j === 0 ? 0.5 : -0.5), avanzar: 0.6, ...brazo };
          }
        },
      );
      // Ya arriba, quietos y sin soltarla
      for (const j of [0, 1] as const)
        n.entradas[j] = {
          ...QUIETO,
          ...(sostienen.includes(j) ? (j === 0 ? { brazoIzquierdo: true } : { brazoDerecho: true }) : {}),
        };
      return pasos;
    };

    it("de a dos: con la carga y los dos en el techo arranca, pasa los baches sosteniéndola y llega", async () => {
      const n = await armarGarrucha();
      const chiva = n.nivel.chiva("chiva");
      expect(cargar(n, [0, 1])).toBeGreaterThan(-1);
      expect(chiva.cargada).toBe(true);
      expect(hasta(n, 200, () => chiva.estado === "andando")).toBeGreaterThan(-1);
      let caidas = 0;
      chiva.alCaer(() => caidas++);
      const llego = hasta(n, 1200, () => chiva.estado !== "andando");
      console.log(`chiva: llega en ${llego} pasos`);
      expect(chiva.estado).toBe("llego");
      expect(chiva.caidas).toBe(0);
      expect(caidas).toBe(0);
      expect(chiva.cargada).toBe(true);
      expect(chiva.encima(n.munecos[0].partes.pelvis.translation())).toBe(true);
      expect(chiva.encima(n.munecos[1].partes.pelvis.translation())).toBe(true);
      expect(n.munecos[0].agarrado("brazoIzquierdo")?.parent()?.handle).toBe(chiva.carga.cuerpo.handle);
      // Sueltan la carga y se bajan en la otra loma: punto 3
      n.correr(30, () => {
        n.entradas[0] = QUIETO;
        n.entradas[1] = QUIETO;
      });
      const bajaron = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 3,
        () => {
          n.entradas[0] = n.haciaDonde(0, 82.3, 0.5);
          n.entradas[1] = n.haciaDonde(1, 82.3, -0.5);
        },
      );
      expect(bajaron).toBeGreaterThan(0);
    });

    it("con uno solo sosteniéndola, en el primer bache salta del techo: la chiva frena, se devuelve y la carga vuelve a la bodega", async () => {
      const n = await armarGarrucha();
      const chiva = n.nivel.chiva("chiva");
      // Entre los dos la suben; ya en el techo el turquesa la suelta
      expect(cargar(n, [0, 1])).toBeGreaterThan(-1);
      n.entradas[1] = QUIETO;
      expect(hasta(n, 200, () => chiva.estado === "andando")).toBeGreaterThan(-1);
      expect(hasta(n, 900, () => chiva.caidas > 0)).toBeGreaterThan(0);
      expect(chiva.recorrido).toBeLessThan(0.5);
      // La carga salta del techo y se lleva al rojo, que reaparece junto al turquesa
      expect(hasta(n, 120, () => !chiva.cargada)).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      expect(hasta(n, 1200, () => chiva.estado === "parada")).toBeGreaterThan(0);
      expect(chiva.recorrido).toBe(0);
      n.correr(60);
      const carga = enNivel(chiva.carga.cuerpo.translation());
      expect(carga.x).toBeCloseTo(58.25, 0);
      expect(carga.y).toBeGreaterThan(G2 + 0.7);
    });

    it("con uno solo en el techo no arranca", async () => {
      const n = await armarGarrucha();
      const chiva = n.nivel.chiva("chiva");
      n.nivel.avance.irA(2);
      chiva.carga.cuerpo.setTranslation({ x: DX + 63.6, y: G2 + 0.35, z: 0 }, true);
      n.poner(0, 62.5, G2, 0);
      n.poner(1, 56, G2, 0);
      n.correr(300);
      expect(chiva.cargada).toBe(true);
      expect(chiva.encima(n.munecos[0].partes.pelvis.translation())).toBe(true);
      expect(chiva.estado).toBe("parada");
    });
  });

  /** Trepa la palma con la manea: se arrima al tronco desde el oeste, agarra la manea con las dos manos y aprieta
   * adelante hasta quedar de pie arriba, más alto que `arriba`. Devuelve en cuántos pasos (o −1). */
  function treparPalma(n: Garrucha, j: 0 | 1, nombre: string, tronco: number, arriba: number, radio = 0.28) {
    const lejos = radio + 0.34;
    const palma = n.nivel.palma(nombre);
    const manea = palma.manea;
    if (!manea) throw new Error("sin manea");
    hasta(
      n,
      300,
      () => Math.abs(n.pelvis(j).x - (tronco - lejos)) < 0.05 && Math.abs(n.pelvis(j).z) < 0.04,
      () => {
        const p = n.pelvis(j);
        n.entradas[j] = {
          ...n.haciaDonde(j, tronco - lejos, 0),
          avanzar: Math.min(1, Math.hypot(tronco - lejos - p.x, p.z) * 4),
        };
      },
    );
    // Derecho hacia el tronco, y recién ahí alza los brazos
    n.correr(30, () => {
      n.entradas[j] = n.girarHacia(j, ESTE);
    });
    const agarro = hasta(
      n,
      120,
      () => conLasDos(n.munecos[j], manea),
      (i) => {
        n.entradas[j] = { ...n.girarHacia(j, ESTE), ...AMBOS, avanzar: i > 20 ? 0.3 : 0 };
      },
    );
    if (agarro < 0) return -1;
    return hasta(
      n,
      1200,
      () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && n.pelvis(j).x > tronco,
      () => {
        n.entradas[j] = { ...QUIETO, ...AMBOS, avanzar: 1 };
      },
    );
  }

  describe("misión 4: la palma de cera", () => {
    it("se trepa con la manea hasta la plataforma: punto 4; la manea vuelve sola abajo para el otro", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(3);
      const palma = n.nivel.palma("palma");
      n.correr(20);
      const subio = treparPalma(n, 0, "palma", 86.5, D);
      console.log(`palma: arriba en ${subio} pasos`);
      expect(subio).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      const llego = hasta(
        n,
        300,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          n.entradas[0] = n.haciaDonde(0, 88.2, 0);
        },
      );
      expect(llego).toBeGreaterThan(-1);
      n.entradas[0] = QUIETO;
      expect(hasta(n, 600, () => palma.altura === 0)).toBeGreaterThan(0);
      // El turquesa sube igual
      expect(treparPalma(n, 1, "palma", 86.5, D)).toBeGreaterThan(0);
    });

    it("colgado de la manea, sin apretar se queda quieto, y apretando atrás baja", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(3);
      const palma = n.nivel.palma("palma");
      n.correr(20);
      n.poner(0, 85.88, G2, 0);
      n.correr(10);
      const agarro = hasta(
        n,
        120,
        () => palma.trepando === 0,
        (i) => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: i > 20 ? 0.3 : 0 };
        },
      );
      expect(agarro).toBeGreaterThan(-1);
      n.correr(120, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: 1 };
      });
      const medio = palma.altura;
      expect(medio).toBeGreaterThan(0.2);
      n.correr(60, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
      });
      expect(palma.altura).toBeCloseTo(medio, 3);
      n.correr(60, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -1 };
      });
      expect(palma.altura).toBeLessThan(medio - 0.1);
    });
  });

  describe("misión 5: el cañón, de liana en liana", () => {
    /** Las lianas: dónde cuelgan y dónde empieza el piso de enfrente (un farallón o la otra orilla). */
    const LIANAS = [
      { x: 89.3, enfrente: 91 },
      { x: 92.9, enfrente: 94.6 },
      { x: 96.5, enfrente: 98.2 },
    ];
    /** Desde 1.05 m antes de la liana `k`, el muñeco salta, se cuelga, se columpia y la suelta sobre el piso de
     * enfrente. Devuelve si quedó de pie del otro lado. */
    const columpiarse = (n: Garrucha, j: 0 | 1, k: number) => {
      const liana = LIANAS[k];
      if (!liana) throw new Error("no hay esa liana");
      const bejuco = n.nivel.bejuco(`liana-${k + 1}`);
      hasta(
        n,
        300,
        () => Math.abs(n.pelvis(j).x - (liana.x - 1.05)) < 0.05 && Math.abs(n.pelvis(j).z) < 0.08,
        () => {
          const p = n.pelvis(j);
          n.entradas[j] = {
            ...n.haciaDonde(j, liana.x - 1.05, 0),
            avanzar: Math.min(1, Math.hypot(liana.x - 1.05 - p.x, p.z) * 4),
          };
        },
      );
      n.correr(20, () => {
        n.entradas[j] = n.girarHacia(j, ESTE);
      });
      let colgo = false;
      let solto = false;
      const cruzo = hasta(
        n,
        900,
        () => solto && n.munecos[j].estado === "de pie" && n.pelvis(j).x > liana.enfrente + 0.1,
        () => {
          const p = n.pelvis(j);
          const v = n.munecos[j].partes.pelvis.linvel();
          colgo ||= bejuco.colgados > 0;
          if (colgo && !solto && p.x > liana.enfrente + 0.25 && v.x > 0) solto = true;
          n.entradas[j] = solto ? QUIETO : { ...QUIETO, ...AMBOS, avanzar: colgo ? Math.sign(v.x) : 1 };
        },
      );
      n.entradas[j] = QUIETO;
      return cruzo > 0;
    };

    it("de la plataforma a un farallón, al otro y a la otra orilla: la meta (punto 5)", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(4);
      n.correr(20);
      for (const k of [0, 1, 2]) expect(columpiarse(n, 0, k), `liana ${k + 1}`).toBe(true);
      const llego = hasta(
        n,
        400,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = n.haciaDonde(0, 101.3, 0);
        },
      );
      expect(llego).toBeGreaterThan(-1);
    });

    it("el que cae al cañón reaparece junto al compañero, si está de pie", async () => {
      const n = await armarGarrucha();
      n.nivel.avance.irA(4);
      n.poner(1, 92, D, 0);
      n.correr(30);
      n.poner(0, 90, D + 0.5, 0);
      const volvio = hasta(n, 400, () => n.pelvis(0).y > D && n.pelvis(0).x > 91 && n.munecos[0].estado === "de pie");
      expect(volvio).toBeGreaterThan(0);
    });
  });

  it("el secreto: la orquídea, trepando la palma más alta detrás de la meta", async () => {
    const n = await armarGarrucha();
    n.nivel.avance.irA(5);
    n.correr(20);
    expect(treparPalma(n, 0, "palma-alta", 106, D + 5, 0.25)).toBeGreaterThan(0);
    expect(
      hasta(
        n,
        300,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 106.9, 0);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con la garrucha, la chiva y La Patasola, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarGarrucha();
      const garrucha = n.nivel.garrucha("garrucha");
      n.poner(0, 11.2, G, 0);
      n.poner(1, 9.5, G, -0.2);
      hasta(
        n,
        300,
        () => garrucha.encima(n.munecos[0].partes.pelvis.translation()) && n.pelvis(0).x > 12.45,
        () => {
          n.entradas[0] = n.haciaDonde(0, 12.6, 0);
        },
      );
      n.entradas[0] = QUIETO;
      jalar(n, 1, 0, ESTE, () => garrucha.recorrido > 0.5, 900);
      n.poner(1, 31.6, G2, 0);
      n.correr(240);
      const todo: number[] = [garrucha.recorrido, n.nivel.patasola("patasola").avance];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBeGreaterThan(0.4);
    expect(una[1]).toBeGreaterThan(0.1);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica y dibuja la canasta, la chiva, la manea y La Patasola", async () => {
    const anfitrion = await armarGarrucha();
    const invitado = await armarGarrucha();
    // El anfitrión: la canasta a medio camino, la chiva andando, La Patasola corriendo y la manea arriba
    const garrucha = anfitrion.nivel.garrucha("garrucha");
    anfitrion.poner(0, 11.2, G, 0);
    anfitrion.poner(1, 9.5, G, -0.2);
    hasta(
      anfitrion,
      300,
      () => garrucha.encima(anfitrion.munecos[0].partes.pelvis.translation()) && anfitrion.pelvis(0).x > 12.45,
      () => {
        anfitrion.entradas[0] = anfitrion.haciaDonde(0, 12.6, 0);
      },
    );
    anfitrion.entradas[0] = QUIETO;
    jalar(anfitrion, 1, 0, ESTE, () => garrucha.recorrido > 0.4, 900);
    anfitrion.nivel.chiva("chiva").llegar();
    anfitrion.poner(1, 31.6, G2, 0);
    anfitrion.correr(77);
    const patasola = anfitrion.nivel.patasola("patasola");
    expect(patasola.estado).toBe("corriendo");

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const foto = leerFoto(
      escribirFoto({
        paso: 900,
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
    // Dos fotos seguidas (como llegan en la red): el invitado guarda después de ubicar los cuerpos
    for (let k = 0; k < 2; k++) {
      deAlla.forEach((c, i) => {
        c.setTranslation(
          { x: foto.posiciones[3 * i] ?? 0, y: foto.posiciones[3 * i + 1] ?? 0, z: foto.posiciones[3 * i + 2] ?? 0 },
          false,
        );
        const r = foto.rotaciones;
        c.setRotation({ x: r[4 * i] ?? 0, y: r[4 * i + 1] ?? 0, z: r[4 * i + 2] ?? 0, w: r[4 * i + 3] ?? 1 }, false);
      });
      invitado.armado.guardar();
    }
    invitado.armado.dibujar(1, 0);
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["garrucha", "chiva", "patasola", "chiva-carga"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // La Patasola en lo alto de su brinco, como en el anfitrión (el invitado no corre su guion)
    expect(invitado.nivel.patasola("patasola").alto).toBeCloseTo(patasola.alto, 2);
    expect(invitado.nivel.patasola("patasola").estado).toBe("esperando");
    const manijas = [anfitrion, invitado].map((n) => posicion(n.nivel.garrucha("garrucha").manijas[0]));
    expect(manijas[0]?.distanceTo(manijas[1] ?? new THREE.Vector3())).toBeLessThan(0.003);
  });
});
