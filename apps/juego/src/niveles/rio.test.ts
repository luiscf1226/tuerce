// El nivel 6, el Río Plátano (TU-28), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, el Sisimite se
// despierta si le caen encima, y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada
// prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca). Las x de las pruebas son
// las del nivel antes de correrlo `DX` (como en scripts/niveles/rio.mjs): `pelvis`, `poner` y `enNivel` las cambian.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { DX, RAPIDOS } from "../../../../niveles/06-rio/guion";
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
/** La tierra, como en scripts/niveles/rio.mjs. */
const G = 0.3;

async function armarRio() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("06-rio");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.rio?.crearGuion() });
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
type Rio = Awaited<ReturnType<typeof armarRio>>;

/** Un punto del mundo en las x del nivel antes de correrlo. */
const enNivel = (p: THREE.Vector3Like) => new THREE.Vector3(p.x - DX, p.y, p.z);

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Rio, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Sube un escalón fijo (o el Sisimite) que tiene la cara en `cara` (x, mirando al este): se para a 40 cm de la
 * cara, alza los brazos, salta, se cuelga y trepa hasta quedar arriba de pie, más alto que `arriba`. */
function treparHaciaElEste(n: Rio, j: 0 | 1, cara: number, arriba: number) {
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

/** El rumbo de ir de `a` a `b`. */
const rumboHacia = (a: THREE.Vector3Like, b: { x: number; z: number }) => Math.atan2(b.x - a.x, b.z - a.z);

/** El camino del pipante río arriba: por el lado de la piedra de atrás, cruza delante de la segunda y llega al
 * embarcadero. */
const RUTA = [
  { x: 14.2, z: -1.4 },
  { x: 16.4, z: 0.5 },
  { x: 19.6, z: 0.6 },
  { x: 25.5, z: -0.6 },
];

/** Desde la salida del punto 0, con el rojo en la popa y el turquesa en la proa: empujan (los de `pertiga`) y
 * llevan el rumbo (los de `timon`) siguiendo la ruta hasta que el pipante topa con el embarcadero; ahí bajan
 * caminando. Devuelve en cuántos pasos llegaron al punto 1 (o −1). */
function navegar(n: Rio, quienes: { pertiga?: 0 | 1; timon?: 0 | 1 }, pasos: number) {
  const pipante = n.nivel.pipante("pipante");
  let tramo = 0;
  let llego = false;
  return hasta(
    n,
    pasos,
    () => n.nivel.puntoDeControl >= 1,
    () => {
      const c = enNivel(pipante.cuerpo.translation());
      const destino = RUTA[tramo];
      if (destino && Math.hypot(destino.x - c.x, destino.z - c.z) < 1.2) tramo++;
      llego ||= c.x > 22.4;
      if (llego) {
        for (const j of [0, 1] as const) n.entradas[j] = n.haciaDonde(j, 26.6, n.pelvis(j).z);
        return;
      }
      if (quienes.pertiga !== undefined) n.entradas[quienes.pertiga] = { ...QUIETO, ...AMBOS };
      if (quienes.timon !== undefined) {
        const j = quienes.timon;
        const hacia = RUTA[Math.min(tramo, RUTA.length - 1)] ?? { x: 26, z: 0 };
        n.entradas[j] = { ...n.girarHacia(j, rumboHacia(c, hacia)), ...AMBOS };
      }
    },
  );
}

describe("el Río Plátano (niveles/06-rio)", () => {
  it("tiene sus piezas, su agua, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarRio();
    expect(plano.numero).toBe(6);
    expect(plano.nombre).toBe("Río Plátano");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.aguas.map((a) => a.nombre).sort()).toEqual([
      "cascada",
      "lodazal",
      "rapidos",
      "remanso",
      "remanso-arriba",
      "rio",
    ]);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "bejuco liana",
      "palmera palmera",
      "pipante pipante",
      "puente puente",
      "sisimite sisimite",
      "tronco puente-1",
      "tronco puente-2",
    ]);
    expect(nivel.puente("puente").faltan).toBe(2);
    expect(nivel.sisimite("sisimite").estado).toBe("dormido");
    expect(() => nivel.pipante("puente")).toThrow(/pipante «puente»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: el pipante, uno con la pértiga y el otro con el rumbo", () => {
    it("el pipante flota junto al muelle y se sube a él caminando", async () => {
      const n = await armarRio();
      const pipante = n.nivel.pipante("pipante");
      n.poner(0, 1.6, G, -2.6, 0);
      n.correr(60);
      const piso = pipante.cuerpo.translation().y + 0.15;
      expect(piso).toBeGreaterThan(0.2);
      expect(piso).toBeLessThan(0.36);
      hasta(
        n,
        200,
        () => pipante.encima(n.munecos[0].partes.pelvis.translation()),
        () => {
          n.entradas[0] = n.haciaDonde(0, 1.6, -1.5);
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(pipante.encima(n.munecos[0].partes.pelvis.translation())).toBe(true);
      expect(pipante.aBordo).toBe(1);
    });

    it("de a dos: el rojo empuja en la popa, el turquesa lleva el rumbo en la proa y llegan al embarcadero", async () => {
      const n = await armarRio();
      n.poner(0, 1.7, G, -1.55);
      n.poner(1, 4.3, G, -1.55);
      n.correr(30);
      const pasos = navegar(n, { pertiga: 0, timon: 1 }, 2400);
      console.log(`pipante: llegan en ${pasos} pasos`);
      expect(pasos).toBeGreaterThan(0);
    });

    it("con el pipante en marcha, el de la proa camina hacia atrás por el piso sin salir disparado", async () => {
      const n = await armarRio();
      const pipante = n.nivel.pipante("pipante");
      n.poner(0, 1.7, G, -1.55);
      n.poner(1, 4.3, G, -1.55);
      n.correr(30);
      navegar(n, { pertiga: 0, timon: 1 }, 800);
      expect(Math.hypot(pipante.cuerpo.linvel().x, pipante.cuerpo.linvel().z)).toBeGreaterThan(0.7);
      const adelante = new THREE.Vector3(1, 0, 0).applyQuaternion(pipante.cuerpo.rotation());
      const sobre = () => {
        const p = n.munecos[1].partes.pelvis.translation();
        const c = pipante.cuerpo.translation();
        return (p.x - c.x) * adelante.x + (p.z - c.z) * adelante.z;
      };
      const antes = sobre();
      // Antes de TU-28 el empujón de la embarcación le ganaba al andar y lo lanzaba hacia la proa
      n.correr(40, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        n.entradas[1] = { ...QUIETO, avanzar: -1 };
      });
      expect(sobre()).toBeLessThan(antes - 0.4);
      expect(pipante.encima(n.munecos[1].partes.pelvis.translation())).toBe(true);
    });

    it("solo con la pértiga el pipante da vueltas y no llega", async () => {
      const n = await armarRio();
      const pipante = n.nivel.pipante("pipante");
      n.poner(0, 1.7, G, -1.55);
      n.poner(1, -8, G, 1.5);
      n.correr(30);
      // Empujando solo, el pipante se tuerce (la pértiga se clava de un lado) y se va contra la orilla
      let giro = 0;
      let antes = pipante.rumbo;
      n.correr(600, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        giro += Math.abs(Math.atan2(Math.sin(pipante.rumbo - antes), Math.cos(pipante.rumbo - antes)));
        antes = pipante.rumbo;
      });
      expect(giro).toBeGreaterThan(1);
      expect(pipante.pertiguero).toBe(0);
      expect(pipante.timonel).toBe(null);
      const pasos = navegar(n, { pertiga: 0 }, 1800);
      expect(pasos).toBe(-1);
      expect(enNivel(pipante.cuerpo.translation()).x).toBeLessThan(18);
    });

    it("solo con el rumbo el pipante no avanza: la corriente se lo lleva", async () => {
      const n = await armarRio();
      const pipante = n.nivel.pipante("pipante");
      n.poner(1, 4.3, G, -1.55);
      n.poner(0, -8, G, 1.5);
      n.correr(30);
      const pasos = navegar(n, { timon: 1 }, 1200);
      expect(pasos).toBe(-1);
      expect(pipante.timonel).toBe(1);
      expect(enNivel(pipante.cuerpo.translation()).x).toBeLessThan(8);
    });

    it("el pipante vacío que quedó lejos vuelve solo a su lugar", async () => {
      const n = await armarRio();
      const pipante = n.nivel.pipante("pipante");
      pipante.cuerpo.setTranslation({ x: DX + 10, y: 0.14, z: 0 }, true);
      n.correr(600);
      expect(enNivel(pipante.cuerpo.translation()).x).toBeCloseTo(3, 0);
    });
  });

  describe("misión 2: los rápidos, esquivando troncos", () => {
    /** Los lugares seguros del vado: antes del primer carril, entre carriles y después del último. */
    const SEGUROS = [28.9, 31.2, 33.8, 36.1];
    /** Si el carril `k` se puede cruzar ya: su tronco pasó el vado o está escondido. */
    const libre = (n: Rio, k: number) => {
      const t = n.nivel.pieza(`tronco-rio-${k + 1}`).cuerpo?.translation();
      return !t || t.z > 1.1 || t.y < -0.5;
    };

    it("se cruza el vado esperando entre carriles a que pase cada tronco", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(1);
      n.correr(20);
      const lugar = [0, 0];
      const z = [0.25, -0.25];
      const llego = hasta(
        n,
        2400,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          for (const j of [0, 1] as const) {
            const i = lugar[j] ?? 0;
            const x = SEGUROS[i];
            const zj = z[j] ?? 0;
            if (x === undefined) {
              n.entradas[j] = n.haciaDonde(j, 37.8, zj);
              continue;
            }
            if (Math.abs(n.pelvis(j).x - x) > 0.2) n.entradas[j] = n.haciaDonde(j, x, zj);
            else if (i === SEGUROS.length - 1 || libre(n, i)) {
              lugar[j] = i + 1;
              n.entradas[j] = n.haciaDonde(j, SEGUROS[i + 1] ?? 37.8, zj);
            } else n.entradas[j] = n.girarHacia(j, ESTE);
          }
        },
      );
      expect(llego).toBeGreaterThan(0);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    });

    it("el tronco tumba al agua al que se queda parado en su carril", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(1);
      n.poner(0, (RAPIDOS.carriles[0] ?? 0) - DX, G, 0);
      n.correr(RAPIDOS.periodo + 30);
      expect(n.nivel.aguas.caidas[0]).toBeGreaterThan(0);
      // Reaparece junto al compañero, en el embarcadero
      expect(n.pelvis(0).x).toBeLessThan(28.5);
    });

    it("los troncos bajan siempre igual: salen de la cascada, cruzan el vado y se hunden", async () => {
      const n = await armarRio();
      const tronco = () => n.nivel.pieza("tronco-rio-1").cuerpo?.translation() ?? { x: 0, y: 0, z: 0 };
      const zs: number[] = [];
      n.correr(RAPIDOS.periodo, () => zs.push(tronco().z));
      expect(Math.min(...zs)).toBeLessThan(-4);
      expect(Math.max(...zs)).toBeGreaterThan(3.5);
      // Una vuelta después, el mismo lugar
      const z0 = tronco().z;
      n.correr(RAPIDOS.periodo);
      expect(tronco().z).toBeCloseTo(z0, 5);
    });
  });

  describe("misión 3: las huellas del Sisimite, que apuntan para donde no es", () => {
    it("por el carril de atrás (para donde apuntan los talones) se llega al punto 3", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(2);
      n.correr(20);
      let tramo = 0;
      const camino = [
        { x: 40.2, z: -1.6 },
        { x: 48.2, z: -1.6 },
        { x: 49.4, z: 0 },
      ];
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 3,
        () => {
          const p = n.pelvis(0);
          const d = camino[tramo];
          if (d && Math.hypot(d.x - p.x, d.z - p.z) < 0.3) tramo++;
          const destino = camino[Math.min(tramo, camino.length - 1)] ?? { x: 50, z: 0 };
          n.entradas[0] = n.haciaDonde(0, destino.x, destino.z);
        },
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("el carril de adelante (para donde apuntan los dedos) termina en el lodazal", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(2);
      n.correr(20);
      hasta(
        n,
        900,
        () => n.nivel.aguas.caidas[0] > 0,
        () => {
          const p = n.pelvis(0);
          n.entradas[0] = p.x < 40.5 ? n.haciaDonde(0, 40.5, 1.6) : n.haciaDonde(0, 50, 1.6);
        },
      );
      expect(n.nivel.aguas.caidas[0]).toBe(1);
      expect(n.nivel.puntoDeControl).toBe(2);
    });

    it("el matorral entre los dos carriles no se trepa", async () => {
      const n = await armarRio();
      n.poner(0, 44, G, 1.0, 0);
      n.poner(1, 39, G, 0);
      n.correr(20);
      let paso = 0;
      n.correr(400, () => {
        n.entradas[0] = { ...n.girarHacia(0, Math.PI), ...AMBOS, saltar: paso++ % 60 < 3, avanzar: 1 };
      });
      expect(n.pelvis(0).z).toBeGreaterThan(0.3);
    });
  });

  describe("misión 4: el puente colgante, con las tablas entre los dos", () => {
    /** Los de `quienes` agarran la tabla con la mano derecha (parados a su izquierda, uno detrás del otro, desde
     * `x`) y caminan juntos hacia el este hasta que el de adelante llega a `hastaX`; ahí la sueltan. */
    const llevar = (n: Rio, x: number, quienes: readonly (0 | 1)[], hastaX: number, manos = { brazoDerecho: true }) => {
      quienes.forEach((j, k) => {
        n.poner(j, x - k * 1.0, G, -0.33);
      });
      n.correr(30);
      for (const j of quienes) n.entradas[j] = { ...QUIETO, ...manos };
      n.correr(40);
      const adelante = quienes[0] ?? 0;
      hasta(
        n,
        900,
        () => n.pelvis(adelante).x > hastaX,
        () => {
          for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), ...manos, avanzar: 1 };
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(150);
    };

    it("de a dos: llevan las dos tablas en fila, las tienden sobre los huecos y se cruza el puente", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(3);
      const puente = n.nivel.puente("puente");
      llevar(n, 58.25, [0, 1], 62.5);
      expect(puente.huecos).toEqual([true, false]);
      // La segunda: pasan por encima de la primera
      llevar(n, 52.55, [0, 1], 67.5);
      expect(puente.huecos).toEqual([true, true]);
      expect(puente.faltan).toBe(0);
      const llego = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          for (const j of [0, 1] as const) n.entradas[j] = n.haciaDonde(j, 72.5, j === 0 ? -0.1 : -0.3);
        },
      );
      expect(llego).toBeGreaterThan(0);
    });

    it("uno solo no la levanta (9 kg; un muñeco levanta 5): la tabla no queda en el hueco", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(3);
      n.poner(1, 50, G, 2.5);
      const puente = n.nivel.puente("puente");
      const tabla = n.nivel.tronco("puente-1");
      llevar(n, 58.25, [0], 62.5, { brazoDerecho: true });
      expect(puente.faltan).toBe(2);
      // Ni con las dos manos
      llevar(n, 58.25, [0], 62.5, AMBOS);
      expect(puente.faltan).toBe(2);
      expect(tabla.cuerpo.isKinematic()).toBe(false);
    });

    it("sin las tablas el hueco no se salta", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(3);
      n.poner(0, 62.3, G - 0.15, -0.1);
      n.correr(20);
      let paso = 0;
      n.correr(240, () => {
        n.entradas[0] = { ...n.girarHacia(0, ESTE), avanzar: 1, saltar: paso++ > 30 && paso < 34 };
      });
      expect(n.pelvis(0).x).toBeLessThan(65);
      expect(n.nivel.puntoDeControl).toBe(3);
    });

    it("la tabla que queda tirada en el suelo vuelve a sus caballetes", async () => {
      const n = await armarRio();
      const tabla = n.nivel.tronco("puente-2");
      tabla.cuerpo.setTranslation({ x: DX + 52, y: G + 0.3, z: 1.6 }, true);
      n.correr(300);
      expect(tabla.cuerpo.translation().y).toBeGreaterThan(G + 0.85);
      expect(enNivel(tabla.cuerpo.translation()).x).toBeCloseTo(52.6, 1);
    });
  });

  describe("misión 5: el Sisimite dormido", () => {
    /** Desde el punto 4, el rojo trepa los pies y las canillas y camina por los muslos y la panza hasta el pecho. */
    const treparlo = (n: Rio) => {
      expect(treparHaciaElEste(n, 0, 74.0, G + 1.0)).toBeGreaterThan(-1);
      expect(treparHaciaElEste(n, 0, 75.0, G + 2.25)).toBeGreaterThan(-1);
      expect(treparHaciaElEste(n, 0, 75.0, G + 1.65)).toBeGreaterThan(-1);
      expect(treparHaciaElEste(n, 0, 76.3, G + 2.2)).toBeGreaterThan(-1);
      return hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = n.haciaDonde(0, 81.8, 0);
        },
      );
    };

    it("se lo trepa como a un cerro hasta la cumbre, sin despertarlo: gana el logro", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(4);
      n.poner(1, 71.8, G, -1.5);
      n.correr(20);
      const sisimite = n.nivel.sisimite("sisimite");
      expect(treparlo(n)).toBeGreaterThan(0);
      expect(sisimite.despertares).toBe(0);
      expect(sisimite.ojos).toBe(false);
      expect(n.nivel.logro).toBe(true);
    });

    it("si le caen encima de lo alto abre los ojos, se revuelve y los tumba; sin logro", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(4);
      n.correr(20);
      const sisimite = n.nivel.sisimite("sisimite");
      n.poner(1, 79.4, G + 4.2, 0);
      n.correr(60);
      expect(sisimite.despertares).toBe(1);
      expect(sisimite.estado).toBe("despierto");
      n.correr(20);
      expect(sisimite.ojos).toBe(true);
      // Se vuelve a dormir
      n.correr(240);
      expect(sisimite.estado).toBe("dormido");
      expect(sisimite.ojos).toBe(false);
      n.poner(1, 71.8, G, -1.5);
      expect(treparlo(n)).toBeGreaterThan(0);
      expect(n.nivel.logro).toBe(false);
    });

    it("pisarle la cara lo despierta", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(5);
      n.correr(30);
      const sisimite = n.nivel.sisimite("sisimite");
      expect(sisimite.despertares).toBe(0);
      hasta(
        n,
        300,
        () => sisimite.despertares > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, 84, 0.6);
        },
      );
      expect(sisimite.despertares).toBe(1);
    });

    it("de la cumbre se baja por el brazo, sin tocarle la cara", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(5);
      n.correr(30);
      const sisimite = n.nivel.sisimite("sisimite");
      let tramo = 0;
      const camino = [
        { x: 82.2, z: -0.95 },
        { x: 86.6, z: -0.95 },
      ];
      const bajo = hasta(
        n,
        900,
        () => n.pelvis(0).x > 86.4 && n.pelvis(0).y < G + 0.8,
        () => {
          const p = n.pelvis(0);
          const d = camino[tramo];
          if (d && Math.hypot(d.x - p.x, d.z - p.z) < 0.3) tramo++;
          const destino = camino[Math.min(tramo, camino.length - 1)] ?? { x: 88, z: -0.95 };
          n.entradas[0] = n.haciaDonde(0, destino.x, destino.z);
        },
      );
      expect(bajo).toBeGreaterThan(0);
      expect(sisimite.despertares).toBe(0);
    });
  });

  describe("misión 6: la palmera que lanza y la liana", () => {
    /** El rojo agarra la manija de la soga y camina para atrás hasta doblar la palmera del todo. */
    const doblar = (n: Rio) => {
      const palmera = n.nivel.palmera("palmera");
      n.poner(0, 94.65, G, 1.3);
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      return hasta(
        n,
        600,
        () => palmera.doblada > 0.95,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: -0.7 };
        },
      );
    };

    it("de a dos: uno la dobla, el otro vuela del cogollo al otro lado, tira la liana y el otro cruza", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(5);
      const palmera = n.nivel.palmera("palmera");
      n.poner(1, 92.4, G, 0);
      expect(doblar(n)).toBeGreaterThan(0);
      n.correr(20);
      expect(palmera.estado).toBe("doblada");
      // Suelta la soga: el turquesa sale volando
      n.entradas[0] = QUIETO;
      n.correr(10);
      expect(palmera.estado).toBe("disparando");
      const llego = hasta(n, 900, () => n.munecos[1].estado === "de pie" && n.pelvis(1).x > 99.5);
      expect(llego).toBeGreaterThan(0);
      expect(palmera.lanzados).toBe(1);
      expect(n.nivel.puntoDeControl).toBe(5);
      // Del otro lado: agarra la liana recogida junto a la ceiba y la suelta (la tira)
      const liana = n.nivel.bejuco("liana");
      const agarro = hasta(
        n,
        600,
        () => liana.segmentos.some((s) => n.munecos[1].agarrado("brazoDerecho")?.parent()?.handle === s.handle),
        () => {
          n.entradas[1] = n.haciaDonde(1, 101.8, 0, AMBOS);
        },
      );
      expect(agarro).toBeGreaterThan(-1);
      n.entradas[1] = QUIETO;
      n.correr(150);
      const punta = liana.segmentos[liana.segmentos.length - 1]?.translation();
      expect(punta && enNivel(punta).x).toBeCloseTo(97.3, 0);
      // El rojo se columpia en la liana sobre el barranco y llega a la meta
      n.poner(0, 96.25, G, 0);
      n.correr(20);
      let colgo = false;
      let solto = false;
      const cruzo = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 6,
        () => {
          const p = n.pelvis(0);
          const v = n.munecos[0].partes.pelvis.linvel();
          colgo ||= liana.colgados > 0;
          if (colgo && !solto && p.x > 99.45 && v.x > 0) solto = true;
          n.entradas[0] = solto
            ? n.haciaDonde(0, 106.3, 0.6)
            : { ...QUIETO, ...AMBOS, avanzar: colgo ? Math.sign(v.x) : 1 };
        },
      );
      expect(colgo).toBe(true);
      expect(cruzo).toBeGreaterThan(0);
    });

    it("solo no se puede: al soltar la soga la palmera se endereza antes de que llegue al cogollo", async () => {
      const n = await armarRio();
      n.nivel.avance.irA(5);
      const palmera = n.nivel.palmera("palmera");
      n.poner(1, 88, G, -2);
      expect(doblar(n)).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.correr(2, () => {});
      const cogollo = enNivel(palmera.cogollo());
      hasta(
        n,
        120,
        () => palmera.estado === "derecha",
        () => {
          n.entradas[0] = n.haciaDonde(0, cogollo.x, cogollo.z);
        },
      );
      expect(palmera.lanzados).toBe(0);
      expect(n.pelvis(0).x).toBeLessThan(97);
      // Y sin nadie que tire la liana, la meta no aparece
      expect(n.plano.puntos[6]?.zona?.centro.y).toBeLessThan(-50);
    });
  });

  it("el secreto: la figura de jade, trepando las dos gradas del templo de la ciudad perdida", async () => {
    const n = await armarRio();
    n.nivel.avance.irA(6);
    n.poner(0, 107.5, G, -1.8);
    n.correr(20);
    expect(treparHaciaElEste(n, 0, 109, G + 1.4)).toBeGreaterThan(-1);
    expect(treparHaciaElEste(n, 0, 111, G + 2.8)).toBeGreaterThan(-1);
    expect(
      hasta(
        n,
        200,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 112.5, -2.3);
        },
      ),
    ).toBeGreaterThan(-1);
  });

  it("es determinista: dos corridas iguales, con el pipante, los troncos y el Sisimite, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarRio();
      n.poner(0, 1.7, G, -1.55);
      n.poner(1, 4.3, G, -1.55);
      navegar(n, { pertiga: 0, timon: 1 }, 400);
      n.poner(1, 79.4, G + 4.2, 0);
      n.correr(60);
      const todo: number[] = [n.nivel.sisimite("sisimite").despertares];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[0]).toBe(1);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica y dibuja las piezas nuevas (y ve al Sisimite despierto)", async () => {
    const anfitrion = await armarRio();
    const invitado = await armarRio();
    // El anfitrión: el pipante andando, una tabla clavada, la palmera doblada y el Sisimite despierto
    anfitrion.poner(0, 1.7, G, -1.55);
    anfitrion.poner(1, 4.3, G, -1.55);
    navegar(anfitrion, { pertiga: 0, timon: 1 }, 200);
    anfitrion.nivel.puente("puente").reparar();
    const manija = anfitrion.nivel.palmera("palmera").manija;
    anfitrion.poner(1, 79.4, G + 4.2, 0);
    anfitrion.correr(60, () => manija.setTranslation({ x: DX + 93, y: G + 1.05, z: 1.3 }, true));
    expect(anfitrion.nivel.sisimite("sisimite").ojos).toBe(true);

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
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["pipante", "puente", "palmera", "sisimite", "puente-1", "puente-2", "tronco-rio-1"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // La palmera doblada (su giro) y los ojos abiertos del Sisimite, como en el anfitrión
    const giro = (c: RAPIER.RigidBody) => new THREE.Quaternion().copy(c.rotation());
    expect(
      giro(invitado.nivel.palmera("palmera").tronco).angleTo(giro(anfitrion.nivel.palmera("palmera").tronco)),
    ).toBeLessThan(0.01);
    expect(anfitrion.nivel.palmera("palmera").doblada).toBeGreaterThan(0.5);
    expect(invitado.nivel.sisimite("sisimite").ojos).toBe(true);
  });
});
