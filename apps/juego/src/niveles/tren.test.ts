// El nivel 5, El tren bananero (TU-27), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con
// los muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, el Duende vuelve
// las palancas que nadie ve, y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero, cada
// prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PLAZO } from "../../../../niveles/05-tren/guion";
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

async function armarTren() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("05-tren");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.tren?.crearGuion() });
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
  /** La entrada para ir caminando hacia (x, z): gira hacia allá y avanza cuando ya casi mira hacia allá. */
  const haciaDonde = (j: 0 | 1, x: number, z: number, extra: Partial<EntradaMuneco> = {}): EntradaMuneco => {
    const p = pelvis(j);
    const rumbo = Math.atan2(x - p.x, z - p.z);
    const d = Math.atan2(Math.sin(rumbo - munecos[j].rumbo), Math.cos(rumbo - munecos[j].rumbo));
    return { ...girarHacia(j, rumbo), avanzar: Math.abs(d) < 0.5 ? 1 : 0, ...extra };
  };
  return { rapier, mundo, plano, armado, nivel, munecos, entradas, correr, pelvis, poner, haciaDonde, girarHacia };
}
type Tren = Awaited<ReturnType<typeof armarTren>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (−1 si no se cumplió). */
function hasta(n: Tren, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Uno solo bombeando: baja su manija, cruza la plataforma (por debajo del balancín), se da vuelta y baja la otra. */
function bombearSolo(n: Tren, j: 0 | 1) {
  const dresina = n.nivel.dresina("dresina");
  let lado: 0 | 1 = 0;
  return () => {
    const signo = lado === 0 ? -1 : 1;
    const rumbo = lado === 0 ? ESTE : OESTE;
    const local = n.pelvis(j).x - dresina.plataforma.translation().x;
    const meta = signo * 0.92;
    const giro = Math.abs(Math.atan2(Math.sin(rumbo - n.munecos[j].rumbo), Math.cos(rumbo - n.munecos[j].rumbo)));
    if (signo * dresina.inclinacion < -0.1) {
      // Ya bajó esta: a la otra punta
      lado = lado === 0 ? 1 : 0;
      n.entradas[j] = QUIETO;
    } else if (Math.abs(local - meta) > 0.08) {
      const hacia = meta > local ? ESTE : OESTE;
      n.entradas[j] = { ...n.girarHacia(j, hacia), avanzar: Math.min(1, Math.abs(meta - local) * 3 + 0.2) };
    } else if (giro > 0.2) n.entradas[j] = n.girarHacia(j, rumbo);
    else n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS };
  };
}

describe("el tren bananero (niveles/05-tren)", () => {
  it("tiene sus piezas, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarTren();
    expect(plano.numero).toBe(5);
    expect(plano.nombre).toBe("El tren bananero");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "dresina dresina",
      "duende duende",
      "grua grua",
      "palanca cambio",
      "palanca palanca-a",
      "palanca palanca-b",
      "palanca palanca-grua",
      "plancha bascula",
      "racimo racimo-1",
      "racimo racimo-2",
      "racimo racimo-3",
      "racimo racimo-grande",
      "sombrero sombrero",
      "vagon vagon-1",
      "vagon vagon-2",
    ]);
    expect(nivel.duende("duende").estado).toBe("en casa");
    expect(() => nivel.vagon("dresina")).toThrow(/vagon «dresina»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  it("`punto=N` empieza después de la misión N, los dos de pie en su lugar", async () => {
    for (const punto of [1, 2, 3, 4, 5, 6]) {
      const n = await armarTren();
      n.nivel.avance.irA(punto);
      n.correr(60);
      expect(n.nivel.puntoDeControl).toBe(punto);
      for (const m of n.munecos) expect(m.estado, `punto ${punto}`).toBe("de pie");
    }
  });

  it("retomando en el punto 3 la dresina queda al final del desvío, también la primera vez", async () => {
    const n = await armarTren();
    const dresina = n.nivel.dresina("dresina");
    n.nivel.avance.irA(3);
    const primera = dresina.avance;
    n.nivel.avance.irA(3);
    expect(primera).toBeCloseTo(dresina.avance, 3);
    expect(dresina.porElDesvio).toBe(true);
  });

  describe("misión 1: enganchar los dos vagones", () => {
    it("el tren tapa el paso a nivel; empujando la plataforma hasta el furgón se enganchan, el tren sale y se pasa", async () => {
      const n = await armarTren();
      const plataforma = n.nivel.vagon("vagon-1");
      const furgon = n.nivel.vagon("vagon-2");
      // Con el tren ahí no se pasa: el turquesa camina derecho hacia el paso a nivel y se topa con el furgón
      n.poner(1, -18.2, 0, 1.6, NORTE);
      expect(
        hasta(
          n,
          240,
          () => n.nivel.puntoDeControl >= 1,
          () => {
            n.entradas[1] = n.haciaDonde(1, -18.2, -3);
          },
        ),
      ).toBe(-1);
      n.entradas[1] = QUIETO;
      // El rojo entra a la vía por detrás de la plataforma y la empuja hacia el furgón
      n.poner(0, -27, 0, 0, ESTE);
      n.correr(20);
      const enganche = hasta(
        n,
        900,
        () => plataforma.enganchados.length > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, -15, 0);
        },
      );
      console.log(`tren · misión 1: la plataforma se engancha en ${enganche} pasos`);
      expect(enganche).toBeGreaterThan(0);
      expect(furgon.enganchados).toContain(plataforma);
      n.entradas[0] = QUIETO;
      // El tren sale y deja libre el paso a nivel
      n.correr(60 * 12);
      expect(n.nivel.pieza("locomotora").cuerpo?.translation().y ?? 0).toBeLessThan(-10);
      const paso = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 1,
        () => {
          n.entradas[1] = n.haciaDonde(1, -18.2, -3);
        },
      );
      expect(paso).toBeGreaterThan(0);
    });

    it("el cerco del andén es delgado: colgándose y saltando no se trepa", async () => {
      const n = await armarTren();
      n.poner(0, -23, 0, -0.55, NORTE);
      n.correr(20);
      let paso = 0;
      n.correr(400, () => {
        n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, saltar: paso % 60 < 3, avanzar: 1 };
        paso++;
      });
      expect(n.pelvis(0).z).toBeGreaterThan(-1.0);
      expect(n.nivel.puntoDeControl).toBe(0);
    });

    it("sin engancharse, el tren no sale: la plataforma empujada a medias no llega al furgón", async () => {
      const n = await armarTren();
      n.poner(0, -27, 0, 0, ESTE);
      n.correr(20);
      n.correr(60, () => {
        n.entradas[0] = n.haciaDonde(0, -15, 0);
      });
      n.entradas[0] = QUIETO;
      n.correr(240);
      expect(n.nivel.vagon("vagon-1").enganchados).toHaveLength(0);
      expect(n.nivel.pieza("locomotora").cuerpo?.translation().x).toBeCloseTo(-14.5, 1);
    });
  });

  describe("misión 2: la dresina, a puro bombeo, sube la cuesta", () => {
    /** Los dos sobre la plataforma, el rojo atrás y el turquesa adelante, cada uno mirando su manija. */
    const montados = async () => {
      const n = await armarTren();
      n.nivel.avance.irA(1);
      n.poner(0, -14.3, 0, -4.0, ESTE);
      n.poner(1, -12.5, 0, -4.0, OESTE);
      n.correr(30);
      return n;
    };
    /** Un bombeador: cuando le toca, alza los brazos para agarrar su manija y la baja colgándose; abajo la suelta y
     * le toca al otro. Si no la agarró, suelta y vuelve a probar. Mientras no le toca se acomoda a 92 cm del centro
     * de la plataforma (como un jugador que se corre hasta su lugar). `turno` dice a quién le toca. */
    const bombear = (n: Tren, j: 0 | 1, turno: { de: 0 | 1 }) => {
      const dresina = n.nivel.dresina("dresina");
      const lado = j === 0 ? -1 : 1;
      const rumbo = j === 0 ? ESTE : OESTE;
      let alzado = 0;
      let descanso = 0;
      return () => {
        const local = n.pelvis(j).x - dresina.plataforma.translation().x;
        const avanzar = Math.max(-0.5, Math.min(0.5, (lado * 0.92 - local) * 4 * -lado));
        const agarra =
          n.munecos[j].agarrado("brazoDerecho") !== null || n.munecos[j].agarrado("brazoIzquierdo") !== null;
        if (turno.de === j && lado * dresina.inclinacion < -0.12) turno.de = j === 0 ? 1 : 0;
        if (turno.de !== j) {
          alzado = 0;
          n.entradas[j] = { ...n.girarHacia(j, rumbo), avanzar };
          return;
        }
        if (descanso > 0) {
          descanso--;
          n.entradas[j] = { ...n.girarHacia(j, rumbo), avanzar };
          return;
        }
        alzado++;
        if (!agarra && alzado > 40) {
          alzado = 0;
          descanso = 12;
        }
        n.entradas[j] = { ...n.girarHacia(j, rumbo), ...AMBOS };
      };
    };

    it("de a dos, cada uno baja su manija cuando está arriba, y la dresina sube por el puente hasta la loma", async () => {
      const n = await montados();
      const dresina = n.nivel.dresina("dresina");
      const turno: { de: 0 | 1 } = { de: 0 };
      const rojo = bombear(n, 0, turno);
      const turquesa = bombear(n, 1, turno);
      const llego = hasta(
        n,
        60 * 60,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          rojo();
          turquesa();
        },
      );
      console.log(`tren · misión 2: llegan a la loma en ${llego} pasos, ${dresina.bombeos} bombeos`);
      expect(llego).toBeGreaterThan(0);
      expect(dresina.montados).toBe(2);
      // En la loma se frena y se bajan caminando
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(120);
      expect(Math.abs(dresina.velocidad)).toBeLessThan(0.05);
      expect(dresina.avance).toBeGreaterThan(17.5);
      expect(dresina.avance).toBeLessThan(20.4);
    });

    it("solo no sube: entre una manija y la otra hay que dar la vuelta, y la cuesta lo devuelve", async () => {
      const n = await montados();
      const dresina = n.nivel.dresina("dresina");
      // El turquesa se baja; el rojo baja su manija, cruza la plataforma, se da vuelta y baja la otra
      n.poner(1, -18, 0, -2.5, ESTE);
      let masLejos = 0;
      const solo = bombearSolo(n, 0);
      const llego = hasta(
        n,
        60 * 60,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          masLejos = Math.max(masLejos, dresina.avance);
          solo();
        },
      );
      console.log(`tren · misión 2 solo: ${dresina.bombeos} bombeos, lo más lejos ${masLejos.toFixed(2)} m`);
      expect(dresina.bombeos).toBeGreaterThan(3);
      expect(llego).toBe(-1);
      expect(masLejos).toBeLessThan(6);
    });
  });

  describe("misión 3: uno cuida el cambio y el otro baja con la dresina", () => {
    /** Desde la loma (punto 2): el rojo en la dresina, atrás; el turquesa en la loma, al oeste de la palanca. */
    const enLaLoma = async () => {
      const n = await armarTren();
      n.nivel.avance.irA(2);
      n.poner(0, 4.83, 0.8, -4.0, ESTE);
      n.poner(1, 9.8, 0.8, -1.8, ESTE);
      n.correr(30);
      return n;
    };

    it("de a dos: el turquesa deja la palanca hacia el desvío y se queda; el rojo baja al bananal", async () => {
      const n = await enLaLoma();
      const dresina = n.nivel.dresina("dresina");
      const cambio = n.nivel.palanca("cambio");
      const rojo = bombearSolo(n, 0);
      const llego = hasta(
        n,
        60 * 40,
        () => n.nivel.puntoDeControl >= 3,
        () => {
          // El turquesa empuja la palanca con los brazos arriba y se queda ahí, mirándola
          n.entradas[1] = cambio.activa ? QUIETO : n.haciaDonde(1, 11.5, -1.8, { ...AMBOS, avanzar: 0.8 });
          // El rojo bombea solo (en lo plano alcanza) y después se queda quieto: la bajada la lleva sola
          if (dresina.avance < 20.6) rojo();
          else n.entradas[0] = QUIETO;
        },
      );
      console.log(
        `tren · misión 3: llegan al bananal en ${llego} pasos (el Duende cambió ${n.nivel.duende("duende").cambios})`,
      );
      expect(llego).toBeGreaterThan(0);
      expect(dresina.porElDesvio).toBe(true);
      expect(n.nivel.duende("duende").cambios).toBe(0);
    });

    it("solo no: mientras va a la dresina el Duende vuelve la palanca, y la dresina sigue derecho al puente roto (con el secreto)", async () => {
      const n = await enLaLoma();
      const dresina = n.nivel.dresina("dresina");
      const cambio = n.nivel.palanca("cambio");
      const duende = n.nivel.duende("duende");
      // El rojo se queda lejos, en la estación; el turquesa mueve la palanca y se va a la dresina
      n.poner(0, -18, 0, -2.4, ESTE);
      expect(
        hasta(
          n,
          300,
          () => cambio.activa,
          () => {
            n.entradas[1] = n.haciaDonde(1, 11.5, -1.8, { ...AMBOS, avanzar: 0.8 });
          },
        ),
      ).toBeGreaterThan(0);
      n.entradas[1] = QUIETO;
      n.correr(10);
      let visto = false;
      hasta(
        n,
        600,
        () => n.pelvis(1).x < 5.1 && n.pelvis(1).z < -3.5,
        () => {
          visto ||= duende.estado !== "en casa";
          n.entradas[1] = n.pelvis(1).x > 5.6 ? n.haciaDonde(1, 5.4, -2.6) : n.haciaDonde(1, 4.9, -4.0);
        },
      );
      n.entradas[1] = QUIETO;
      n.correr(30, () => {
        visto ||= duende.estado !== "en casa";
      });
      expect(visto).toBe(true);
      expect(duende.cambios).toBe(1);
      expect(cambio.activa).toBe(false);
      // Baja solo en la dresina: va derecho hasta el puente roto
      const turquesa = bombearSolo(n, 1);
      hasta(
        n,
        60 * 30,
        () => dresina.enElTope,
        () => {
          if (dresina.avance < 20.6) turquesa();
          else n.entradas[1] = QUIETO;
        },
      );
      expect(dresina.enElTope).toBe(true);
      expect(dresina.porElDesvio).toBe(false);
      expect(n.nivel.puntoDeControl).toBe(2);
      // Ahí, en el rellano del puente roto, cuelga el racimo de mínimos dorados: el secreto
      expect(
        hasta(
          n,
          400,
          () => n.nivel.secreto,
          () => {
            n.entradas[1] = n.haciaDonde(1, 24.5, -3.9);
          },
        ),
      ).toBeGreaterThan(0);
      // Sin salida: se tira al vacío y reaparece en tierra firme; la dresina sola vuelve a la loma
      n.poner(1, 24.6, -5, -3.9);
      n.correr(60 * 4);
      expect(n.pelvis(1).x).toBeLessThan(12);
      expect(n.munecos[1].estado).toBe("de pie");
      expect(dresina.avance).toBeCloseTo(19.17, 1);
    });
  });

  describe("misión 4: la grúa, uno la maneja y el otro engancha el racimo", () => {
    /** Desde el punto 3: el rojo al oeste de la palanca de la caseta; el turquesa frente al racimo grande. */
    const enElBananal = async () => {
      const n = await armarTren();
      n.nivel.avance.irA(3);
      n.poner(0, 27.4, 0, -10.7, ESTE);
      n.poner(1, 33.62, 0, -11, ESTE);
      n.correr(30);
      return n;
    };
    const empujarPalanca = (n: Tren) => n.haciaDonde(0, 28.9, -10.7, { ...AMBOS, avanzar: 0.8 });

    it("de a dos: el rojo empuja la palanca y el gancho baja; el turquesa le acerca el racimo, se engancha y va a la tolva", async () => {
      const n = await enElBananal();
      const grua = n.nivel.grua("grua");
      const palanca = n.nivel.palanca("palanca-grua");
      let alzo = 0;
      const enganchado = hasta(
        n,
        900,
        () => grua.racimo !== null,
        () => {
          n.entradas[0] = empujarPalanca(n);
          // Con el gancho abajo, el turquesa agarra el racimo (con los brazos arriba)
          if (grua.altura < 2.2) alzo++;
          n.entradas[1] = alzo > 0 ? { ...n.girarHacia(1, ESTE), ...AMBOS } : QUIETO;
        },
      );
      console.log(`tren · misión 4: el racimo se engancha en ${enganchado} pasos`);
      expect(enganchado).toBeGreaterThan(0);
      expect(palanca.activa).toBe(true);
      // Los dos sueltan: la grúa lo sube, gira y lo suelta en la tolva; el portón de la empacadora baja
      n.entradas[0] = n.girarHacia(0, OESTE);
      n.entradas[1] = QUIETO;
      n.correr(30, () => {
        n.entradas[0] = { ...n.girarHacia(0, OESTE), avanzar: -0.6 };
      });
      n.entradas[0] = QUIETO;
      const enLaTolva = hasta(n, 60 * 15, () => grua.estado === "volviendo");
      expect(enLaTolva).toBeGreaterThan(0);
      n.correr(120);
      const r = n.nivel.racimo("racimo-grande").cuerpo.translation();
      expect(Math.hypot(r.x - 31, r.z + 14.2)).toBeLessThan(0.6);
      expect(r.y).toBeGreaterThan(1.5);
      expect(n.nivel.pieza("porton-empacadora").cuerpo?.translation().y ?? 0).toBeLessThan(-1);
      const paso = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          n.entradas[1] = n.pelvis(1).x < 38.5 ? n.haciaDonde(1, 38.8, -9.25) : n.haciaDonde(1, 42, -9.25);
        },
      );
      expect(paso).toBeGreaterThan(0);
    });

    it("solo no: al soltar la palanca el gancho sube antes de que llegue al racimo", async () => {
      const n = await enElBananal();
      const grua = n.nivel.grua("grua");
      n.poner(1, 25, 0, -13, ESTE);
      // El rojo baja el gancho y corre al racimo
      expect(
        hasta(
          n,
          400,
          () => grua.altura < 1.8,
          () => {
            n.entradas[0] = empujarPalanca(n);
          },
        ),
      ).toBeGreaterThan(0);
      let abajo = Number.POSITIVE_INFINITY;
      hasta(
        n,
        600,
        () => n.pelvis(0).x > 33.55,
        () => {
          n.entradas[0] =
            n.pelvis(0).z < -10.2 && n.pelvis(0).x < 30 ? n.haciaDonde(0, 29.5, -9.8) : n.haciaDonde(0, 33.65, -11);
        },
      );
      n.correr(60, () => {
        abajo = Math.min(abajo, grua.altura);
        n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
      });
      expect(abajo).toBeGreaterThan(2.8);
      expect(grua.racimo).toBe(null);
      n.correr(240);
      expect(n.nivel.pieza("porton-empacadora").cuerpo?.translation().y ?? 0).toBeGreaterThan(1);
    });
  });

  describe("misión 5: pesar racimos hasta que baje el puente", () => {
    /** El muñeco agarra el racimo de su colgadero (desde el sur), lo lleva hasta la báscula y lo suelta encima. */
    const llevar = (n: Tren, j: 0 | 1, nombre: string, x: number) => {
      const racimo = n.nivel.racimo(nombre);
      const r = racimo.cuerpo.translation();
      // Frente al racimo, mirando al norte
      expect(
        hasta(
          n,
          600,
          () => Math.hypot(n.pelvis(j).x - r.x, n.pelvis(j).z - (r.z + 0.5)) < 0.08,
          () => {
            const p = n.pelvis(j);
            const d = Math.hypot(p.x - r.x, p.z - (r.z + 0.5));
            // Por el costado de la romana (sin chocar su poste), y después derecho al racimo
            if (p.z > -9.4 && p.x > 44.4) n.entradas[j] = n.haciaDonde(j, 44.0, -9.8);
            else
              n.entradas[j] =
                d > 0.4 ? n.haciaDonde(j, r.x, r.z + 0.5) : { ...n.haciaDonde(j, r.x, r.z + 0.5), avanzar: 0.3 };
          },
        ),
      ).toBeGreaterThan(-1);
      // Alza los brazos; si no lo agarró, los baja y prueba otra vez (un pasito más cerca)
      for (let intento = 0; intento < 4 && racimo.agarrado === 0; intento++) {
        n.correr(15, () => {
          n.entradas[j] = { ...n.girarHacia(j, NORTE), avanzar: intento > 0 ? 0.3 : 0 };
        });
        n.correr(40, () => {
          n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS };
        });
      }
      expect(racimo.agarrado, `${nombre} agarrado`).toBe(1);
      // Con el racimo en alto, al sur de la romana, y de ahí hacia el norte hasta que el racimo quede bajo su gancho
      hasta(
        n,
        600,
        () => n.pelvis(j).z > -6.6 && Math.abs(n.pelvis(j).x - x) < 0.15,
        () => {
          const p = n.pelvis(j);
          n.entradas[j] =
            p.z < -6.6 && p.x > 44.6 && p.x < 46.4
              ? n.haciaDonde(j, 46.8, -7.2, AMBOS)
              : n.haciaDonde(j, x, -6.4, AMBOS);
        },
      );
      hasta(
        n,
        300,
        () => racimo.cuerpo.translation().z < -7.95,
        () => {
          n.entradas[j] = { ...n.girarHacia(j, NORTE), ...AMBOS, avanzar: 0.4 };
        },
      );
      n.entradas[j] = QUIETO;
      n.correr(60);
      const t = racimo.cuerpo.translation();
      console.log(
        `tren · misión 5: ${nombre} en ${t.x.toFixed(2)}, ${t.y.toFixed(2)}, ${t.z.toFixed(2)} (colgado: ${racimo.colgado})`,
      );
      expect(racimo.colgado).toBe(true);
      // Se va para atrás, para dejar lugar
      n.correr(40, () => {
        n.entradas[j] = { ...n.girarHacia(j, NORTE), avanzar: -0.6 };
      });
      n.entradas[j] = QUIETO;
    };

    it("uno solo cuelga los tres racimos en la romana: el puente baja y se cruza el canal", async () => {
      const n = await armarTren();
      n.nivel.avance.irA(4);
      const bascula = n.nivel.plancha("bascula");
      const puente = () => n.nivel.pieza("puente").cuerpo?.rotation().z ?? 0;
      n.poner(1, 41, 0, -6, ESTE);
      n.correr(20);
      llevar(n, 0, "racimo-1", 45.15);
      llevar(n, 0, "racimo-2", 45.85);
      n.correr(60);
      console.log(`tren · misión 5: con dos racimos, hundida ${bascula.hundida.toFixed(2)}`);
      // Con dos no alcanza: el puente queda a medio bajar
      expect(Math.abs(puente())).toBeGreaterThan(0.1);
      llevar(n, 0, "racimo-3", 45.5);
      n.correr(180);
      console.log(`tren · misión 5: báscula hundida ${bascula.hundida.toFixed(2)}`);
      expect(Math.abs(puente())).toBeLessThan(0.02);
      const paso = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = n.pelvis(0).x < 47.5 ? n.haciaDonde(0, 47.6, -8) : n.haciaDonde(0, 53.5, -8);
        },
      );
      expect(paso).toBeGreaterThan(0);
    });
  });

  describe("misión 6: devolverle el sombrero al Duende", () => {
    /** Desde el punto 5: cada uno empuja una palanca del portón final (con los brazos arriba, hacia el este). */
    const empujarPalancas = (n: Tren) => {
      const a = n.nivel.palanca("palanca-a");
      const b = n.nivel.palanca("palanca-b");
      return hasta(
        n,
        900,
        () => a.activa && b.activa,
        () => {
          n.entradas[0] = a.activa ? QUIETO : n.haciaDonde(0, 55.1, -2.8, { ...AMBOS, avanzar: 0.8 });
          n.entradas[1] = b.activa ? QUIETO : n.haciaDonde(1, 55.1, -13.2, { ...AMBOS, avanzar: 0.8 });
        },
      );
    };
    /** Los dos van al portón final (el rojo primero, el turquesa detrás). */
    const alPorton = (n: Tren, pasos: number) =>
      hasta(
        n,
        pasos,
        () => n.nivel.puntoDeControl >= 6,
        () => {
          n.entradas[0] = n.pelvis(0).x < 58.3 ? n.haciaDonde(0, 58.4, -8) : n.haciaDonde(0, 61.5, -8);
          n.entradas[1] = n.pelvis(1).x < 58.3 ? n.haciaDonde(1, 58.4, -8.2) : n.haciaDonde(1, 61.5, -8.2);
        },
      );

    it("sin el sombrero, el Duende vuelve las palancas en cuanto nadie las ve, y el portón se cierra antes de llegar", async () => {
      const n = await armarTren();
      n.nivel.avance.irA(5);
      const duende = n.nivel.duende("duende");
      n.poner(0, 53.6, 0, -2.8, ESTE);
      n.poner(1, 53.6, 0, -13.2, ESTE);
      n.correr(20);
      expect(empujarPalancas(n)).toBeGreaterThan(0);
      // Las dos movidas: el portón baja. Mientras las cuidan, el Duende no se atreve
      n.correr(90);
      expect(n.nivel.pieza("porton-final").cuerpo?.translation().y ?? 9).toBeLessThan(-0.5);
      expect(duende.cambios).toBe(0);
      // Se van al portón: el Duende sale por un agujero, vuelve una palanca y el portón se cierra
      expect(alPorton(n, 600)).toBe(-1);
      console.log(`tren · misión 6 sin sombrero: el Duende cambió ${duende.cambios} palancas`);
      expect(duende.cambios).toBeGreaterThan(0);
      expect(n.nivel.pieza("porton-final").cuerpo?.translation().y ?? 0).toBeGreaterThan(0.5);
    });

    it("con el sombrero puesto, el Duende deja las palancas en paz: el portón queda abierto y llegan a la meta", async () => {
      const n = await armarTren();
      n.nivel.avance.irA(5);
      const duende = n.nivel.duende("duende");
      const sombrero = n.nivel.sombrero("sombrero");
      // El rojo agarra el sombrero del perchero de la garita
      n.poner(0, 53.9, 0, -2.75, NORTE);
      n.poner(1, 53.6, 0, -13.2, ESTE);
      n.correr(20);
      for (let intento = 0; intento < 4 && sombrero.agarrado === 0; intento++) {
        n.correr(15, () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), avanzar: intento > 0 ? 0.3 : 0 };
        });
        n.correr(40, () => {
          n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS };
        });
      }
      expect(sombrero.agarrado).toBe(1);
      // Se lo lleva al Duende y lo suelta delante de él: primero da un paso atrás, para despegarlo del perchero
      n.correr(30, () => {
        n.entradas[0] = { ...n.girarHacia(0, NORTE), ...AMBOS, avanzar: -0.6 };
      });
      expect(
        hasta(
          n,
          1200,
          () => n.pelvis(0).z < -13.1,
          () => {
            // Rodeando el perchero y la garita
            const z = n.pelvis(0).z;
            if (z > -4.0) n.entradas[0] = n.haciaDonde(0, 54.5, -4.3, AMBOS);
            else if (z > -6) n.entradas[0] = n.haciaDonde(0, 54.2, -6.3, AMBOS);
            else n.entradas[0] = n.haciaDonde(0, 52.4, -13.4, AMBOS);
          },
        ),
      ).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      expect(hasta(n, 120, () => duende.contento)).toBeGreaterThan(-1);
      expect(sombrero.puesto).toBe(true);
      // Ahora mueven las palancas, se van al portón y pasan
      n.poner(0, 53.6, 0, -2.8, ESTE);
      n.correr(20);
      expect(empujarPalancas(n)).toBeGreaterThan(0);
      const llego = alPorton(n, 900);
      console.log(`tren · misión 6: llegan a la meta en ${llego} pasos`);
      expect(llego).toBeGreaterThan(0);
      expect(duende.cambios).toBe(0);
    });
  });

  describe("el logro «Puntual»: llegar antes de que pite el tren", () => {
    /** Engancha los vagones (empujando la plataforma) y después pone a la pareja en cada punto de control, en orden. */
    const recorrer = async (esperar: number) => {
      const n = await armarTren();
      n.poner(0, -27, 0, 0, ESTE);
      n.correr(20);
      hasta(
        n,
        900,
        () => n.nivel.vagon("vagon-1").enganchados.length > 0,
        () => {
          n.entradas[0] = n.haciaDonde(0, -15, 0);
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(esperar);
      for (const punto of [1, 2, 3, 4, 5, 6]) {
        const lugar = n.plano.puntos[punto]?.lugares[0].posicion;
        if (!lugar) throw new Error(`sin punto ${punto}`);
        n.poner(0, lugar.x, lugar.y, lugar.z);
        n.poner(1, lugar.x, lugar.y, lugar.z + 0.9);
        n.correr(5);
        expect(n.nivel.puntoDeControl).toBe(punto);
      }
      return n;
    };

    it("a tiempo: llegan a la meta con el tren todavía de viaje", async () => {
      const n = await recorrer(60 * 10);
      expect(n.nivel.logro).toBe(true);
    });

    it("tarde: el tren llega a la estación de llegada, pita y ya no hay logro", async () => {
      const n = await recorrer(PLAZO + 60 * 4);
      const loco = n.nivel.pieza("locomotora").cuerpo?.translation();
      expect(loco?.x).toBeCloseTo(59.9, 0);
      expect(loco?.y).toBeCloseTo(0, 1);
      expect(n.nivel.logro).toBe(false);
    });

    it("retomando un avance guardado no se gana (no se sabe cuánto tardaron): el tren ya llegó", async () => {
      const n = await armarTren();
      n.nivel.avance.irA(5);
      const lugar = n.plano.puntos[6]?.lugares[0].posicion;
      if (!lugar) throw new Error("sin meta");
      n.poner(0, lugar.x, lugar.y, lugar.z);
      n.correr(5);
      expect(n.nivel.puntoDeControl).toBe(6);
      expect(n.nivel.logro).toBe(false);
      expect(n.nivel.pieza("locomotora").cuerpo?.translation().x).toBeCloseTo(59.9, 0);
    });
  });

  it("es determinista: dos corridas iguales, con la dresina, el tren y el Duende, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarTren();
      // El rojo engancha los vagones; en la loma, el turquesa mueve el cambio y se va: el Duende lo vuelve
      n.poner(0, -27, 0, 0, ESTE);
      n.poner(1, 9.8, 0.8, -1.8, ESTE);
      n.correr(30);
      n.correr(600, (i) => {
        n.entradas[0] = n.haciaDonde(0, -15, 0);
        n.entradas[1] = i < 200 ? n.haciaDonde(1, 11.5, -1.8, { ...AMBOS, avanzar: 0.8 }) : n.haciaDonde(1, 3, -2);
      });
      const todo: number[] = [n.nivel.duende("duende").cambios];
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

  it("en línea: con la foto del anfitrión, el invitado ubica el tren, la dresina, la grúa, el Duende y las piezas nuevas", async () => {
    const anfitrion = await armarTren();
    const invitado = await armarTren();
    // El anfitrión: el tren saliendo (le dieron un empujón a la plataforma), la dresina en el puente y la grúa bajando
    anfitrion.nivel.vagon("vagon-1").cuerpo.setLinvel({ x: 7, y: 0, z: 0 }, true);
    anfitrion.correr(90);
    anfitrion.nivel.dresina("dresina").poner(5);
    anfitrion.correr(200, () => {
      anfitrion.nivel.grua("grua").mandar(true);
    });
    expect(anfitrion.nivel.pieza("locomotora").cuerpo?.translation().x ?? 0).toBeGreaterThan(-14);

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const foto = leerFoto(
      escribirFoto({
        paso: 210,
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
    const dresinaAca = anfitrion.nivel.dresina("dresina");
    const dresinaAlla = invitado.nivel.dresina("dresina");
    expect(posicion(dresinaAlla.bomba).distanceTo(posicion(dresinaAca.bomba))).toBeLessThan(0.003);
    expect(
      posicion(invitado.nivel.grua("grua").gancho).distanceTo(posicion(anfitrion.nivel.grua("grua").gancho)),
    ).toBeLessThan(0.003);
    for (const nombre of [
      "locomotora",
      "vapor",
      "reloj-aguja",
      "vagon-1",
      "vagon-2",
      "dresina",
      "grua",
      "duende",
      "racimo-grande",
      "sombrero",
      "senal-cambio",
      "puente",
      "porton-final",
    ]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
  });
});
