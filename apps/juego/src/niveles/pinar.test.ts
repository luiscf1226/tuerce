// El nivel 1, El pinar (TU-14), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, el Cadejo persigue,
// lame y se distrae con el hueso, y lo que se mueve viaja en la foto de la red. Para no repetir el camino entero,
// cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un poco más cerca).
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
/** Las alturas del suelo: el patio, la otra orilla de la quebrada y la otra orilla de la zanja. */
const Y2 = 2.85;
const Y3 = Y2 + 0.4;

async function armarPinar() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("01-pinar");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.pinar?.crearGuion() });
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
type Pinar = Awaited<ReturnType<typeof armarPinar>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Pinar, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Sube un escalón fijo (una pared con piso arriba) que tiene la cara en `cara` (x, mirando al este): se para a
 * 40 cm de la cara, alza los brazos, salta, se cuelga y trepa. */
function treparHaciaElEste(n: Pinar, j: 0 | 1, cara: number, arriba: number) {
  const subio = () => n.munecos[j].estado === "de pie" && n.pelvis(j).y > arriba + 0.3 && n.pelvis(j).x > cara + 0.1;
  // Acomodarse a 40 cm de la cara
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

describe("el pinar (niveles/01-pinar)", () => {
  it("tiene sus piezas, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarPinar();
    expect(plano.numero).toBe(1);
    expect(plano.nombre).toBe("El pinar");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "balancin balancin",
      "bejuco bejuco-rojo",
      "bejuco bejuco-turquesa",
      "cadejo cadejo",
      "huacal cajon",
      "huacal huacal-1",
      "huacal huacal-2",
      "hueso hueso",
      "lampara lampara",
      "tranca tranca",
      "tronco tronco",
    ]);
    expect(nivel.cadejo("cadejo").estado).toBe("echado");
    expect(() => nivel.tronco("hueso")).toThrow(/tronco «hueso»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: apilar huacales para pasar el cerco", () => {
    it("uno solo levanta el huacal del tocón y lo pone encima del cajón, contra el cerco", async () => {
      const n = await armarPinar();
      const cajon = n.nivel.huacal("cajon").cuerpo;
      const huacal = n.nivel.huacal("huacal-1").cuerpo;
      // El rojo empuja el cajón contra el cerco
      n.poner(0, -0.3, 0, 1.0);
      n.poner(1, -0.32, 0, -1.6);
      n.correr(20);
      const contraElCerco = hasta(
        n,
        400,
        () => cajon.translation().x > 2.95,
        () => {
          n.entradas[0] = n.haciaDonde(0, 5, 1.0);
        },
      );
      expect(contraElCerco).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      // El turquesa agarra el huacal del tocón, retrocede, lo lleva por al lado del cajón y lo suelta encima
      n.entradas[1] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      expect(n.munecos[1].agarrado("brazoDerecho")?.parent()?.handle).toBe(huacal.handle);
      n.entradas[1] = { ...QUIETO, ...AMBOS, avanzar: -1 };
      n.correr(30);
      // Rodea el cajón por el lado de +z y llega en diagonal (hacia el sureste), con el huacal adelante: así no lo
      // choca contra el cerco y lo deja sobre la punta del cajón
      const diagonal = (3 * Math.PI) / 4;
      let enDiagonal = false;
      const encima = hasta(
        n,
        900,
        () => huacal.translation().x > 3.35 && huacal.translation().z < 1.25,
        () => {
          const p = n.pelvis(1);
          enDiagonal ||= Math.hypot(p.x - 2.35, p.z - 2.3) < 0.2;
          const [x, z] = p.z < 2.0 ? [1.0, 2.4] : [2.35, 2.3];
          if (!enDiagonal) n.entradas[1] = n.haciaDonde(1, x, z, { ...AMBOS });
          else n.entradas[1] = { ...n.girarHacia(1, diagonal), ...AMBOS, avanzar: 0.5 };
        },
      );
      expect(encima).toBeGreaterThan(0);
      n.entradas[1] = QUIETO;
      n.correr(120);
      // Quedó encima del cajón (40 cm), en la punta del cerco
      const t = huacal.translation();
      expect(t.y).toBeGreaterThan(0.6);
      expect(t.y).toBeLessThan(0.8);
      expect(t.x).toBeGreaterThan(3.2);
      expect(Math.abs(t.z - cajon.translation().z)).toBeLessThan(0.3);
    });

    it("con la escalera (cajón y huacal encima) se sube saltando y se trepa el cerco; sin el huacal, no", async () => {
      for (const conHuacal of [true, false]) {
        const n = await armarPinar();
        const cajon = n.nivel.huacal("cajon").cuerpo;
        cajon.setTranslation({ x: 3.05, y: 0.2, z: 1.0 }, true);
        if (conHuacal) n.nivel.huacal("huacal-1").cuerpo.setTranslation({ x: 3.53, y: 0.65, z: 1.0 }, true);
        n.correr(30);
        n.poner(0, 1.4, 0, 1.0);
        n.correr(20);
        // Corre, salta al cajón, toma impulso, salta al huacal y desde ahí trepa el cerco
        // En el suelo corre y salta al cajón; arriba del cajón retrocede para tomar impulso y salta al huacal;
        // arriba del huacal alza los brazos y salta hasta colgarse del cerco, y trepa
        let salto = -100;
        let impulso = false;
        const subio = hasta(
          n,
          1500,
          () => n.nivel.puntoDeControl >= 1,
          (i) => {
            const p = n.pelvis(0);
            const m = n.munecos[0];
            const enElCajon = p.y > 0.75 && p.y < 1.25;
            const encima = p.y > 1.25;
            const frente = enElCajon ? 3.3 : 2.3;
            if (enElCajon && m.estado === "de pie" && p.x > 3.0) impulso = true;
            if (!enElCajon || p.x < 2.55) impulso = false;
            if (!encima && !impulso && m.estado === "de pie" && i - salto > 30 && p.x > frente - 0.45) salto = i;
            n.entradas[0] = {
              ...n.girarHacia(0, ESTE),
              ...(encima ? AMBOS : {}),
              avanzar: impulso ? -1 : 1,
              saltar: (i - salto < 3 && !encima) || (encima && m.estado === "de pie" && i % 60 < 3),
            };
          },
        );
        if (conHuacal) expect(subio, "con la escalera pasa").toBeGreaterThan(0);
        else expect(subio, "con el cajón solo no pasa").toBe(-1);
      }
    });
  });
  describe("misión 2: el balancín de tronco sobre la quebrada", () => {
    /** El rojo sube a la tabla y espera antes del eje; con `contrapeso`, el turquesa se sube atrás y se queda en la
     * punta de tierra. Después el rojo sigue derecho hasta la otra orilla. */
    const cruzar = async (contrapeso: boolean) => {
      const n = await armarPinar();
      const balancin = n.nivel.balancin("balancin");
      n.poner(0, 7.4, 0, 0);
      n.poner(1, 6.6, 0, contrapeso ? 0 : -2.2);
      n.correr(150);
      // En reposo pesa más el lado de tierra: la punta de la quebrada queda arriba, junto a la otra orilla
      expect(balancin.inclinacion).toBeLessThan(-0.25);
      hasta(
        n,
        400,
        () => n.pelvis(0).x > 11.5,
        () => {
          n.entradas[0] = n.haciaDonde(0, 20, 0);
        },
      );
      n.entradas[0] = QUIETO;
      if (contrapeso) {
        hasta(
          n,
          300,
          () => n.pelvis(1).x > 9.2,
          () => {
            n.entradas[1] = n.haciaDonde(1, 20, 0);
          },
        );
        n.entradas[1] = QUIETO;
        n.correr(30);
      }
      let peor = balancin.inclinacion;
      const llego = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 2,
        () => {
          n.entradas[0] = n.haciaDonde(0, 20, 0);
          peor = Math.max(peor, balancin.inclinacion);
        },
      );
      return { n, llego, peor };
    };

    it("con el turquesa de contrapeso en la punta de tierra, el rojo cruza a la otra orilla", async () => {
      const { n, llego, peor } = await cruzar(true);
      expect(llego).toBeGreaterThan(0);
      expect(peor).toBeLessThan(-0.25);
      expect(n.pelvis(0).y).toBeGreaterThan(Y2 + 0.3);
    });

    it("solo, la tabla se vuelca en cuanto pasa el eje y se cae a la quebrada", async () => {
      const { n, llego, peor } = await cruzar(false);
      expect(llego).toBe(-1);
      expect(peor).toBeGreaterThan(0.25);
      // (empezó junto al punto 1, del lado de acá)
      expect(n.nivel.puntoDeControl).toBe(1);
    });
  });

  it("misión 3: se columpia en el bejuco sobre el barranco, se suelta encima de la otra orilla y llega al punto 3", async () => {
    const n = await armarPinar();
    n.poner(0, 21.9, Y2, 0.45);
    n.poner(1, 19.5, Y2, -1);
    n.correr(20);
    const bejuco = n.nivel.bejuco("bejuco-rojo");
    let colgo = false;
    let solto = false;
    const llego = hasta(
      n,
      600,
      () => n.nivel.puntoDeControl >= 3,
      () => {
        const p = n.pelvis(0);
        const v = n.munecos[0].partes.pelvis.linvel();
        colgo ||= bejuco.colgados > 0;
        // Colgado, adelante y atrás a tiempo; se suelta yendo hacia adelante, ya sobre la otra orilla
        if (colgo && !solto && p.x > 24.9 && v.x > 0) solto = true;
        n.entradas[0] = solto
          ? { ...QUIETO, avanzar: 1 }
          : { ...QUIETO, ...AMBOS, avanzar: colgo ? Math.sign(v.x) : 1 };
      },
    );
    expect(colgo).toBe(true);
    expect(llego).toBeGreaterThan(0);
  });

  describe("misión 4: el tronco entre los dos, tendido como puente", () => {
    /** Los muñecos agarran el tronco con la mano derecha, parados a su izquierda, y caminan juntos hasta que el de
     * adelante (el rojo) llega al borde de la zanja; ahí lo sueltan. */
    const llevar = (n: Pinar, quienes: readonly (0 | 1)[]) => {
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      for (const j of quienes) n.entradas[j] = { ...QUIETO, brazoDerecho: true };
      n.correr(40);
      const tronco = n.nivel.tronco("tronco");
      expect(tronco.cargadores).toBe(quienes.length);
      let masAlto = 0;
      const adelante = quienes[0] ?? 0;
      hasta(
        n,
        500,
        () => n.pelvis(adelante).x > 33.3,
        () => {
          for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), brazoDerecho: true, avanzar: 1 };
          const [a, b] = tronco.puntas();
          masAlto = Math.max(masAlto, Math.min(a.y, b.y));
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(150);
      return { tronco, masAlto };
    };

    it("lo llevan los dos en fila, lo tienden de una orilla a la otra y se cruza caminando por él", async () => {
      const n = await armarPinar();
      n.poner(1, 28.3, Y2, 0.15);
      n.poner(0, 29.3, Y2, 0.15);
      n.correr(30);
      const { tronco, masAlto } = llevar(n, [0, 1]);
      // Lo llevaron en el aire: las dos puntas bien arriba del suelo
      expect(masAlto).toBeGreaterThan(Y2 + 0.5);
      const [a, b] = tronco.puntas();
      expect(Math.min(a.x, b.x)).toBeLessThan(33.6);
      expect(Math.max(a.x, b.x)).toBeGreaterThan(35.4);
      // El turquesa se sube por la punta de atrás y cruza
      const [atras, adelante] = a.x < b.x ? [a, b] : [b, a];
      const inicio = atras.clone().lerp(adelante, 0.15);
      n.munecos[1].reaparecer(
        { x: inicio.x, y: inicio.y + 0.2, z: inicio.z },
        Math.atan2(adelante.x - atras.x, adelante.z - atras.z),
      );
      n.poner(0, 30, Y2, -1.5);
      n.correr(10);
      const cruzo = hasta(
        n,
        500,
        () => n.nivel.puntoDeControl >= 4,
        () => {
          n.entradas[1] = n.haciaDonde(1, adelante.x + 2, adelante.z);
        },
      );
      expect(cruzo).toBeGreaterThan(0);
    });

    it("uno solo no lo levanta (pesa 9 kg y un muñeco levanta 5): no queda de puente", async () => {
      const n = await armarPinar();
      n.poner(0, 28.8, Y2, 0.15);
      n.poner(1, 25.5, Y2, -1.5);
      n.correr(30);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(40);
      const tronco = n.nivel.tronco("tronco");
      expect(tronco.cargadores).toBe(1);
      hasta(
        n,
        500,
        () => n.pelvis(0).x > 33.3,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 1 };
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(150);
      const [a, b] = tronco.puntas();
      expect(Math.max(a.x, b.x)).toBeLessThan(35.2);
    });

    it("el tronco que queda tirado en el suelo vuelve a sus caballetes", async () => {
      const n = await armarPinar();
      const tronco = n.nivel.tronco("tronco");
      tronco.cuerpo.setTranslation({ x: 29, y: Y2 + 0.2, z: -1.5 }, true);
      n.correr(240);
      expect(tronco.cuerpo.translation().y).toBeGreaterThan(Y2 + 0.9);
      expect(tronco.cuerpo.translation().z).toBeCloseTo(0.6, 1);
    });
  });

  describe("misión 5: el corral del Cadejo", () => {
    /** Desde el punto 4: el turquesa delante del hueso, el rojo afuera del corral. */
    const enLaEntrada = async () => {
      const n = await armarPinar();
      n.nivel.avance.irA(4);
      n.poner(1, 37.2, Y3, 2.3);
      n.poner(0, 37.4, Y3, 1.2);
      n.correr(20);
      return n;
    };
    /** El turquesa agarra el hueso y lo tira al corral (salta y lo suelta en el aire). */
    const tirarElHueso = (n: Pinar) => {
      n.entradas[1] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      expect(n.nivel.hueso("hueso").agarrado).toBe(1);
      n.correr(20, (i) => {
        n.entradas[1] = { ...QUIETO, ...(i < 10 ? AMBOS : {}), saltar: i < 3 };
      });
    };
    /** Del jugador `j` hacia (x, z), entrando al corral por el hueco del medio. */
    const porLaEntrada = (n: Pinar, j: 0 | 1, x: number, z: number, extra: Partial<EntradaMuneco> = {}) =>
      n.pelvis(j).x < 38.9 ? n.haciaDonde(j, 39.2, 0.2, extra) : n.haciaDonde(j, x, z, extra);

    it("el Cadejo persigue al que entra al corral y lo lame: se cae, y el logro se pierde", async () => {
      const n = await enLaEntrada();
      const cadejo = n.nivel.cadejo("cadejo");
      const lamidos: number[] = [];
      cadejo.alLamer((j) => lamidos.push(j));
      let persiguio = false;
      let cayo = false;
      hasta(
        n,
        300,
        () => lamidos.length > 0,
        () => {
          n.entradas[0] = porLaEntrada(n, 0, 43, 0);
          persiguio ||= cadejo.persigue === 0;
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(10, () => {
        cayo ||= n.munecos[0].estado === "caido";
      });
      expect(persiguio).toBe(true);
      expect(lamidos).toEqual([0]);
      expect(cayo).toBe(true);
      // Pasan igual (no hay derrota), pero sin el logro
      n.nivel.tranca("tranca").barra.setTranslation({ x: 43.2, y: Y3 + 1, z: 1.75 }, true);
      n.poner(1, 45.2, Y3, 0);
      n.correr(10);
      expect(n.nivel.puntoDeControl).toBe(5);
      expect(n.nivel.logro).toBe(false);
    });

    it("con el hueso tirado se olvida de los muñecos y lo roe; al terminar el hueso vuelve a su lugar", async () => {
      const n = await enLaEntrada();
      const cadejo = n.nivel.cadejo("cadejo");
      const hueso = n.nivel.hueso("hueso");
      tirarElHueso(n);
      hasta(n, 240, () => cadejo.estado === "royendo");
      expect(cadejo.estado).toBe("royendo");
      // El rojo pasa caminando al lado y no lo lame
      const lamidas = cadejo.lamidas;
      n.correr(240, () => {
        n.entradas[0] = porLaEntrada(n, 0, 43, -1.5);
      });
      expect(cadejo.lamidas).toBe(lamidas);
      expect(cadejo.estado).toBe("royendo");
      n.entradas[0] = QUIETO;
      const termino = hasta(n, 400, () => hueso.enSuLugar);
      expect(termino).toBeGreaterThan(0);
    });

    it("de a dos: uno le tira el hueso y el otro saca la tranca; el del hueso pasa por el portón, gana el logro", async () => {
      const n = await enLaEntrada();
      const tranca = n.nivel.tranca("tranca");
      const cadejo = n.nivel.cadejo("cadejo");
      tirarElHueso(n);
      // El rojo va a la tranca (40 cm delante de ella), la agarra y camina para atrás; el turquesa espera junto
      // al portón y pasa cuando se abre
      let enLaTranca = false;
      let alzo = 0;
      const paso = hasta(
        n,
        900,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          const r = n.pelvis(0);
          enLaTranca ||= r.x > 43.1 && Math.abs(r.z - 1.75) < 0.25;
          if (!enLaTranca) n.entradas[0] = porLaEntrada(n, 0, 43.2, 1.75);
          else if (alzo < 30) {
            n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS };
            alzo++;
          } else n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
          n.entradas[1] = tranca.abierta
            ? n.haciaDonde(1, 46, 0)
            : porLaEntrada(n, 1, 43.2, -0.2, { avanzar: n.pelvis(1).x > 42.9 ? 0 : 1 });
        },
      );
      expect(paso).toBeGreaterThan(0);
      expect(cadejo.lamidas).toBe(0);
      expect(n.nivel.logro).toBe(true);
      // Pasado el punto 5 el portón queda abierto: el de la tranca suelta y pasa también
      n.entradas[0] = QUIETO;
      n.correr(30);
      const porton = n.nivel.pieza("porton").cuerpo?.translation();
      expect(porton?.z).toBeLessThan(-1.5);
    });

    it("solo no se puede: el portón está abierto mientras alguien sostiene la tranca y se cierra al soltarla", async () => {
      const n = await enLaEntrada();
      const tranca = n.nivel.tranca("tranca");
      const porton = () => n.nivel.pieza("porton").cuerpo?.translation().z ?? 0;
      tirarElHueso(n);
      n.poner(1, 37, Y3, -2.5);
      n.poner(0, 43.2, Y3, 1.75);
      n.correr(10);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      hasta(
        n,
        120,
        () => tranca.abierta,
        () => {
          n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
        },
      );
      n.correr(30);
      expect(tranca.abierta).toBe(true);
      expect(porton()).toBeLessThan(-1.5);
      // Suelta y corre al portón: se cierra antes de que llegue
      const llego = hasta(
        n,
        300,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = n.haciaDonde(0, 46, 0);
        },
      );
      expect(llego).toBe(-1);
      expect(porton()).toBeCloseTo(0, 2);
    });
  });

  it("misión 6: en la pulpería, agarrar la lámpara la enciende, se abre la puerta y adentro está la meta", async () => {
    const n = await armarPinar();
    n.nivel.avance.irA(5);
    const lampara = n.nivel.lampara("lampara");
    const puerta = () => n.nivel.pieza("puerta").cuerpo?.translation().z ?? 0;
    // Con la puerta cerrada no se entra
    const cerrada = puerta();
    n.poner(0, 49.8, Y3, -0.8);
    n.correr(10);
    expect(
      hasta(
        n,
        200,
        () => n.nivel.puntoDeControl >= 6,
        () => {
          n.entradas[0] = n.haciaDonde(0, 56, -0.8);
        },
      ),
    ).toBe(-1);
    // La lámpara cuelga junto a la puerta, a la altura de las manos
    n.poner(0, 50.1, Y3, 0.55);
    n.entradas[0] = QUIETO;
    n.correr(10);
    n.entradas[0] = { ...QUIETO, ...AMBOS };
    n.correr(30);
    expect(lampara.encendida).toBe(true);
    n.entradas[0] = QUIETO;
    n.correr(60);
    expect(puerta()).toBeGreaterThan(cerrada + 1.2);
    n.poner(0, 50.0, Y3, -0.8);
    n.correr(10);
    expect(
      hasta(
        n,
        300,
        () => n.nivel.puntoDeControl >= 6,
        () => {
          n.entradas[0] = n.haciaDonde(0, 56, -1.0);
        },
      ),
    ).toBeGreaterThan(0);
  });

  it("el secreto: trepando los tres escalones del pino más alto se llega al nido", async () => {
    const n = await armarPinar();
    n.nivel.avance.irA(5);
    n.poner(0, 45.7, Y3, -2.45);
    n.poner(1, 45.4, Y3, 1);
    n.correr(20);
    for (const [cara, arriba] of [
      [46.4, Y3 + 1.5],
      [47.6, Y3 + 3.0],
      [48.8, Y3 + 4.5],
    ] as const) {
      expect(treparHaciaElEste(n, 0, cara, arriba), `escalón de ${cara}`).toBeGreaterThan(0);
    }
    expect(
      hasta(
        n,
        120,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 49.7, -2.45);
        },
      ),
    ).toBeGreaterThan(-1);
    expect(n.nivel.secreto).toBe(true);
  });

  it("es determinista: dos corridas iguales, con el Cadejo persiguiendo y lamiendo, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarPinar();
      n.nivel.avance.irA(4);
      n.correr(300, () => {
        n.entradas[0] = n.haciaDonde(0, 42, 1);
        n.entradas[1] = n.haciaDonde(1, 41, -1.5);
      });
      const todo: number[] = [n.nivel.cadejo("cadejo").lamidas];
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

  it("en línea: con la foto del anfitrión, el invitado ubica al Cadejo, al tronco y a las piezas nuevas, y los dibuja ahí", async () => {
    const anfitrion = await armarPinar();
    const invitado = await armarPinar();
    // El anfitrión: los dos en el corral, el Cadejo corriendo detrás de uno
    anfitrion.nivel.avance.irA(4);
    anfitrion.correr(150, () => {
      anfitrion.entradas[0] = anfitrion.haciaDonde(0, 42, 1);
    });
    expect(anfitrion.nivel.cadejo("cadejo").estado).not.toBe("echado");

    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const foto = leerFoto(
      escribirFoto({
        paso: 150,
        ack: 0,
        estados: ["de pie", "de pie"],
        agarres: 0,
        rumbos: [0, 0],
        velocidades: [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
        ],
        punto: 4,
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
    for (const nombre of ["cadejo", "tronco", "tranca", "hueso", "lampara", "porton", "puerta"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
  });
});
