// El nivel 4, Xibalbá de juguete (TU-26), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar
// con los muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, los
// murciélagos apagan la antorcha y espantan al que anda a oscuras, y lo que se mueve viaja en la foto de la red.
// Para no repetir el camino entero, cada prueba pone a los muñecos donde empieza su misión (como `&punto=N`, o un
// poco más cerca).
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
/** Las alturas del suelo: la plaza, la terraza y el templo. */
const Y1 = 1.8;
const Y2 = 4.1;

async function armarXibalba() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("04-xibalba");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.xibalba?.crearGuion() });
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
type Xibalba = Awaited<ReturnType<typeof armarXibalba>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos (-1 si no se cumplió). */
function hasta(n: Xibalba, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Se para a `distancia` de una pared que tiene la cara en `cara` (x, mirando al este), alza los brazos, salta, se
 * cuelga y trepa. Devuelve en cuántos pasos subió, o -1. */
function treparHaciaElEste(n: Xibalba, j: 0 | 1, cara: number, arriba: number, distancia = 0.4) {
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

describe("Xibalbá (niveles/04-xibalba)", () => {
  it("tiene sus piezas, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarXibalba();
    expect(plano.numero).toBe(4);
    expect(plano.nombre).toBe("Xibalbá de juguete");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "antorcha antorcha",
      "bloque bloque",
      "bloque piedra-1",
      "bloque piedra-2",
      "doble planchas",
      "estela estela",
      "guacamayas guacamayas-cancha",
      "guacamayas guacamayas-plaza",
      "guacamayas guacamayas-templo",
      "llave llave",
      "murcielagos murcielagos",
      "pelota pelota",
      "plancha plato",
    ]);
    expect(nivel.murcielagos("murcielagos").estado).toBe("colgados");
    expect(nivel.antorcha("antorcha").encendida).toBe(true);
    expect(() => nivel.estela("bloque")).toThrow(/estela «bloque»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: los dos en la plancha doble abren la entrada", () => {
    const entrada = (n: Xibalba) => n.nivel.pieza("entrada").cuerpo?.translation().y ?? 0;

    it("con uno en cada placa la entrada se hunde, queda abierta y pasan", async () => {
      const n = await armarXibalba();
      const doble = n.nivel.doble("planchas");
      const arriba = entrada(n);
      n.poner(0, 3.2, 0, 1.4);
      n.poner(1, 3.2, 0, -1.4);
      n.correr(10);
      const pisada = hasta(
        n,
        300,
        () => doble.pisada,
        () => {
          n.entradas[0] = n.pelvis(0).x < 4.4 ? n.haciaDonde(0, 4.45, 1.4) : QUIETO;
          n.entradas[1] = n.pelvis(1).x < 4.4 ? n.haciaDonde(1, 4.45, -1.4) : QUIETO;
        },
      );
      expect(pisada).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
      expect(entrada(n)).toBeLessThan(arriba - 2.5);
      // Se bajan de las placas: la entrada sigue abierta, y pasan
      const paso = hasta(
        n,
        600,
        () => n.nivel.puntoDeControl >= 1,
        () => {
          n.entradas[0] = n.pelvis(0).x < 5.2 ? n.haciaDonde(0, 5.3, 0) : n.haciaDonde(0, 9, 0);
          n.entradas[1] = n.pelvis(1).x < 5.2 ? n.haciaDonde(1, 5.3, 0.2) : n.haciaDonde(1, 9, 0);
        },
      );
      expect(paso).toBeGreaterThan(0);
      expect(entrada(n)).toBeLessThan(arriba - 2.5);
    });

    it("solo no se puede: con una sola placa pisada (o el otro lejos) la entrada no se mueve", async () => {
      const n = await armarXibalba();
      const doble = n.nivel.doble("planchas");
      const arriba = entrada(n);
      n.poner(0, 3.2, 0, 1.4);
      n.poner(1, -4, 0, -1.4);
      n.correr(10);
      hasta(
        n,
        200,
        () => false,
        () => {
          n.entradas[0] = n.pelvis(0).x < 4.4 ? n.haciaDonde(0, 4.45, 1.4) : QUIETO;
        },
      );
      // (la placa 0 es la de −z; la 1, la de +z)
      expect(doble.hundidas[1]).toBeGreaterThan(0.6);
      expect(doble.hundidas[0]).toBeLessThan(0.2);
      expect(doble.pisada).toBe(false);
      // Se baja y va a la otra placa: la primera vuelve a subir
      hasta(
        n,
        400,
        () => false,
        () => {
          n.entradas[0] = n.pelvis(0).z > -1.2 ? n.haciaDonde(0, 4.2, -1.4) : QUIETO;
        },
      );
      expect(doble.hundidas[0]).toBeGreaterThan(0.6);
      expect(doble.hundidas[1]).toBeLessThan(0.2);
      expect(doble.pisada).toBe(false);
      expect(entrada(n)).toBeCloseTo(arriba, 3);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 1,
          () => {
            n.entradas[0] = n.haciaDonde(0, 9, 0);
          },
        ),
      ).toBe(-1);
    });
  });

  describe("misión 2: la estela se gira entre los dos", () => {
    /** Cada uno agarra la punta de su vara con las dos manos y camina dando la vuelta: el rojo en la vara del
     * este (empuja hacia −z) y el turquesa en la del oeste (empuja hacia +z). */
    const girar = (n: Xibalba, quienes: readonly (0 | 1)[], pasos = 900) => {
      const estela = n.nivel.estela("estela");
      const eje = { x: 11.5, z: 0 };
      n.nivel.avance.irA(1);
      n.poner(0, eje.x + 1.15, 0, 0.42, Math.PI);
      n.poner(1, eje.x - 1.15, 0, -0.42, 0);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(20);
      for (const j of quienes) n.entradas[j] = { ...QUIETO, ...AMBOS };
      n.correr(40);
      for (const j of quienes) expect(n.manos(j, estela.cuerpo), `manos de ${j}`).toBeGreaterThan(0);
      const tangente = (j: 0 | 1) => {
        const p = n.pelvis(j);
        const a = Math.atan2(p.z - eje.z, p.x - eje.x) - 0.6;
        return n.haciaDonde(j, eje.x + 1.15 * Math.cos(a), eje.z + 1.15 * Math.sin(a), AMBOS);
      };
      return hasta(
        n,
        pasos,
        () => estela.alineada,
        () => {
          for (const j of quienes) n.entradas[j] = tangente(j);
        },
      );
    };

    it("los dos la empujan por sus varas hasta alinear los glifos: la reja se hunde y pasan", async () => {
      const n = await armarXibalba();
      const estela = n.nivel.estela("estela");
      const reja = () => n.nivel.pieza("reja").cuerpo?.translation().y ?? 0;
      const arriba = reja();
      const giro = girar(n, [0, 1]);
      expect(giro).toBeGreaterThan(0);
      expect(estela.angulo).toBeCloseTo(Math.PI / 2, 1);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
      expect(reja()).toBeLessThan(arriba - 2.5);
      // Queda alineada aunque la suelten y la empujen
      n.correr(60, () => {
        n.entradas[0] = n.haciaDonde(0, 11.5, 2);
      });
      expect(estela.angulo).toBeCloseTo(Math.PI / 2, 2);
      n.poner(0, 14.5, 0, 0.2);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 2,
          () => {
            n.entradas[0] = n.haciaDonde(0, 19, 0);
          },
        ),
      ).toBeGreaterThan(0);
    });

    it("solo no se puede: con uno solo en su vara la estela está trabada", async () => {
      const n = await armarXibalba();
      const estela = n.nivel.estela("estela");
      expect(girar(n, [0], 600)).toBe(-1);
      expect(estela.angulo).toBeLessThan(0.05);
      expect(estela.alineada).toBe(false);
    });
  });
  describe("misión 3: el juego de pelota", () => {
    /** El rojo frente al soporte, mirando al aro (−z): agarra la pelota, retrocede, salta y la suelta en el aire. */
    const tirar = (n: Xibalba, soltarEn: number) => {
      const pelota = n.nivel.pelota("pelota");
      n.nivel.avance.irA(2);
      n.poner(0, 23, 0, 0.6 + 0.55, Math.PI);
      n.poner(1, 20, 0, 1.5);
      n.entradas[0] = QUIETO;
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      expect(pelota.agarrada).toBe(1);
      n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
      n.correr(40);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      let masAlta = 0;
      n.correr(150, (i) => {
        n.entradas[0] = { ...QUIETO, ...(i < soltarEn ? AMBOS : {}), saltar: i < 3 };
        const t = pelota.cuerpo.translation();
        if (t.z > -1.4) masAlta = Math.max(masAlta, t.y);
      });
      return masAlta;
    };

    it("agarrar la pelota, saltar y soltarla en el aire la mete por el aro: se abre el portón y pasan", async () => {
      const n = await armarXibalba();
      const porton = () => n.nivel.pieza("porton").cuerpo?.translation().y ?? 0;
      const arriba = porton();
      tirar(n, 10);
      n.correr(60);
      expect(porton()).toBeLessThan(arriba - 2.5);
      n.poner(0, 28.5, 0, 0.2);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 3,
          () => {
            n.entradas[0] = n.haciaDonde(0, 33, 0);
          },
        ),
      ).toBeGreaterThan(0);
    });

    it("soltarla parado no alcanza: cae al suelo, el portón no se abre y la pelota vuelve sola a su soporte", async () => {
      const n = await armarXibalba();
      const porton = () => n.nivel.pieza("porton").cuerpo?.translation().y ?? 0;
      const arriba = porton();
      const pelota = n.nivel.pelota("pelota");
      // Sin saltar: la suelta parado
      n.nivel.avance.irA(2);
      n.poner(0, 23, 0, 1.15, Math.PI);
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.6 };
      n.correr(40);
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(porton()).toBeCloseTo(arriba, 3);
      expect(pelota.enSuLugar).toBe(false);
      expect(hasta(n, 400, () => pelota.enSuLugar)).toBeGreaterThan(0);
    });
  });

  describe("misión 4: el bloque por la escalinata", () => {
    /** Desde el punto 3: los dos frente al altar, uno de cada lado del bloque. Lo agarran y caminan derecho al
     * este, grada por grada, hasta la pared del templo; ahí lo sueltan. */
    const subirlo = (n: Xibalba, quienes: readonly (0 | 1)[]) => {
      const bloque = n.nivel.bloque("bloque");
      n.nivel.avance.irA(3);
      n.poner(0, 31.35, 0, 0.42);
      n.poner(1, 31.35, 0, -0.42);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(20);
      for (const j of quienes) n.entradas[j] = { ...QUIETO, ...AMBOS };
      n.correr(40);
      expect(bloque.cargadores).toBe(quienes.length);
      let lejos = 0;
      const llego = hasta(
        n,
        1500,
        () => bloque.cuerpo.translation().x > 40.9,
        () => {
          for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), ...AMBOS, avanzar: 0.7 };
          const t = bloque.cuerpo.translation();
          lejos = Math.max(lejos, Math.hypot(t.x - 31.95, t.z));
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(90);
      return { bloque, llego, lejos };
    };

    it("lo suben los dos grada por grada, lo dejan contra el templo y desde el bloque se trepa", async () => {
      const n = await armarXibalba();
      const { bloque, llego } = subirlo(n, [0, 1]);
      expect(llego).toBeGreaterThan(0);
      const t = bloque.cuerpo.translation();
      expect(t.y).toBeCloseTo(Y1 + 0.25, 1);
      expect(Math.abs(bloque.cuerpo.rotation().x) + Math.abs(bloque.cuerpo.rotation().z)).toBeLessThan(0.05);
      expect(t.x).toBeGreaterThan(40.6);
      // El rojo se sube al bloque (de un salto, con impulso) y desde ahí trepa el templo
      n.poner(0, 39.2, Y1, t.z);
      n.poner(1, 38.5, Y1, -1.8);
      n.correr(10);
      let salto = -100;
      const subio = hasta(
        n,
        1200,
        () => n.nivel.puntoDeControl >= 4,
        (i) => {
          const p = n.pelvis(0);
          const m = n.munecos[0];
          const encima = p.y > Y1 + 0.85;
          if (!encima && m.estado === "de pie" && i - salto > 40 && p.x > 40.15) salto = i;
          n.entradas[0] = {
            ...n.girarHacia(0, ESTE),
            ...(encima ? AMBOS : {}),
            avanzar: encima ? 0.3 : 1,
            saltar: (i - salto < 3 && !encima) || (encima && m.estado === "de pie" && i % 60 < 3),
          };
        },
      );
      expect(subio).toBeGreaterThan(0);
    });

    it("solo no se puede: uno solo no saca el bloque de su altar (ni alzándolo ni empujándolo), y sin él no se trepa el templo", async () => {
      const n = await armarXibalba();
      const { bloque, llego, lejos } = subirlo(n, [0]);
      expect(llego).toBe(-1);
      // (con los brazos lo alza un poco en el lugar, pero de costado no se mueve ni un centímetro)
      expect(lejos).toBeLessThan(0.01);
      expect(bloque.cuerpo.translation().x).toBeLessThan(32.3);
      // Sin bloque, el templo (2.3 m) no se trepa
      n.poner(0, 40.4, Y1, 1.5);
      n.correr(10);
      expect(treparHaciaElEste(n, 0, 41.5, Y2)).toBe(-1);
      expect(n.nivel.puntoDeControl).toBe(3);
    });
  });
  describe("misión 5: el túnel de los murciélagos", () => {
    /** Las perchas, a lo largo del túnel: por debajo de ellas la antorcha los despierta. El que lleva la antorcha va
     * por el otro lado (en zigzag), después de rodear el poste de la antorcha. */
    const ZIGZAG = [
      [44.7, -0.3],
      [46.2, -0.2],
      [47.5, -0.65],
      [49, -0.1],
      [50.5, 0.65],
      [52, 0.1],
      [53.5, -0.65],
      [54.4, -0.4],
    ] as const;
    /** Una entrada que va de punto en punto (pasa al siguiente a 30 cm de cada uno). */
    const porPuntos = (n: Xibalba, j: 0 | 1, puntos: readonly (readonly [number, number])[]) => {
      let tramo = 0;
      return (extra: Partial<EntradaMuneco> = {}) => {
        const p = n.pelvis(j);
        const [x, z] = puntos[tramo] ?? puntos[puntos.length - 1] ?? [p.x, p.z];
        if (Math.hypot(p.x - x, p.z - z) < 0.3 && tramo < puntos.length - 1) tramo++;
        return n.haciaDonde(j, x, z, extra);
      };
    };
    /** El rojo agarra la antorcha (de frente al travesaño, con `brazos`) y el turquesa la llave. */
    const agarrar = (n: Xibalba, rojo: Partial<EntradaMuneco> | null, turquesa: Partial<EntradaMuneco> | null) => {
      n.nivel.avance.irA(4);
      n.poner(0, 43.75, Y2, -0.95);
      n.poner(1, 44.25, Y2, 1.2);
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(20);
      if (rojo) n.entradas[0] = { ...QUIETO, ...rojo };
      if (turquesa) n.entradas[1] = { ...QUIETO, ...turquesa };
      n.correr(40);
      // Retroceden un poco para sacarlas de su soporte
      if (rojo) n.entradas[0] = { ...QUIETO, ...rojo, avanzar: -0.5 };
      if (turquesa) n.entradas[1] = { ...QUIETO, ...turquesa, avanzar: -0.5 };
      n.correr(30);
      n.entradas[0] = rojo ? { ...QUIETO, ...rojo } : QUIETO;
      n.entradas[1] = turquesa ? { ...QUIETO, ...turquesa } : QUIETO;
      n.correr(20);
    };
    /** El que lleva la antorcha va por el zigzag; el otro, a su lado (del lado de +z) y un poco atrás, después de
     * rodear el pedestal de la llave. */
    const cruzar = (n: Xibalba, pasos: number, listo: () => boolean) => {
      const rojo = porPuntos(n, 0, ZIGZAG);
      const camino: [number, number][] = [];
      return hasta(n, pasos, listo, () => {
        const r = n.pelvis(0);
        const t = n.pelvis(1);
        // El turquesa va por donde pasó el rojo, un metro atrás
        const ultimo = camino[camino.length - 1];
        if (!ultimo || Math.hypot(r.x - ultimo[0], r.z - ultimo[1]) > 0.1) camino.push([r.x, r.z]);
        n.entradas[0] = r.x > 54.3 ? { ...QUIETO, ...AMBOS } : rojo({ ...AMBOS, avanzar: 0.6 });
        // Espera junto al pedestal a que el rojo pase la boca del túnel
        if (r.x < 46.2) {
          const lejos = Math.hypot(t.x - 44.3, t.z - 0.6) > 0.15;
          n.entradas[1] = lejos ? n.haciaDonde(1, 44.3, 0.6, AMBOS) : { ...n.girarHacia(1, ESTE), ...AMBOS };
        } else if (r.x > 54.3) n.entradas[1] = n.haciaDonde(1, 55, 0.9, AMBOS);
        else {
          const atras = camino.find(([x, z]) => Math.hypot(r.x - x, r.z - z) < 1.0) ?? [r.x, r.z];
          const lejos = Math.hypot(t.x - atras[0], t.z - atras[1]) > 0.2;
          n.entradas[1] = n.haciaDonde(1, atras[0], atras[1], { ...AMBOS, avanzar: lejos ? 0.8 : 0 });
        }
      });
    };

    it("de a dos: uno lleva la antorcha y el otro la llave, cruzan con luz, la llave abre la puerta y ganan el logro", async () => {
      const n = await armarXibalba();
      const antorcha = n.nivel.antorcha("antorcha");
      const llave = n.nivel.llave("llave");
      const murcielagos = n.nivel.murcielagos("murcielagos");
      agarrar(n, AMBOS, AMBOS);
      expect(antorcha.llevador).toBe(0);
      expect(antorcha.bienLlevada).toBe(true);
      expect(llave.agarrada).toBe(1);
      const llego = cruzar(n, 2000, () => llave.encajada);
      expect(llego).toBeGreaterThan(0);
      expect(murcielagos.apagadas).toBe(0);
      expect(murcielagos.espantados).toBe(0);
      expect(antorcha.encendida).toBe(true);
      // La puerta de jade se hunde y pasan
      n.correr(60);
      expect(n.nivel.pieza("puerta-jade").cuerpo?.translation().y ?? 9).toBeLessThan(Y2 + 1.3 - 2.5);
      const paso = hasta(
        n,
        400,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = n.haciaDonde(0, 57, 0, AMBOS);
          n.entradas[1] = n.haciaDonde(1, 57, 0.6);
        },
      );
      expect(paso).toBeGreaterThan(0);
      expect(n.nivel.logro).toBe(true);
    });

    it("solo, con la antorcha bien llevada no tiene manos para la llave: llega a la puerta y no se abre", async () => {
      const n = await armarXibalba();
      const murcielagos = n.nivel.murcielagos("murcielagos");
      agarrar(n, AMBOS, null);
      n.poner(1, 42.5, Y2, 1.5);
      const rojo = porPuntos(n, 0, [...ZIGZAG, [56, 0]]);
      const llego = hasta(
        n,
        1200,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = rojo({ ...AMBOS, avanzar: 0.7 });
        },
      );
      expect(llego).toBe(-1);
      expect(n.pelvis(0).x).toBeGreaterThan(53.5);
      expect(murcielagos.apagadas).toBe(0);
      expect(n.nivel.llave("llave").encajada).toBe(false);
    });

    it("solo, con la antorcha en una mano (la otra para la llave) los murciélagos la apagan y lo espantan", async () => {
      const n = await armarXibalba();
      const antorcha = n.nivel.antorcha("antorcha");
      const murcielagos = n.nivel.murcielagos("murcielagos");
      agarrar(n, { brazoIzquierdo: true }, null);
      n.poner(1, 42.5, Y2, 1.5);
      expect(antorcha.agarrada).toBe(1);
      expect(antorcha.bienLlevada).toBe(false);
      const rojo = porPuntos(n, 0, [
        [44.7, -0.3],
        [56, -0.4],
      ]);
      const llego = hasta(
        n,
        1500,
        () => n.nivel.puntoDeControl >= 5,
        () => {
          n.entradas[0] = rojo({ brazoIzquierdo: true, avanzar: 0.7 });
        },
      );
      expect(llego).toBe(-1);
      expect(murcielagos.apagadas).toBeGreaterThan(0);
      expect(antorcha.encendida).toBe(false);
      expect(murcielagos.espantados).toBeGreaterThan(0);
      expect(n.pelvis(0).x).toBeLessThan(54);
    });

    it("a oscuras (la llave sin antorcha) espantan al que entra hacia la entrada, y no llega a la puerta", async () => {
      const n = await armarXibalba();
      const murcielagos = n.nivel.murcielagos("murcielagos");
      const espantados: number[] = [];
      murcielagos.alEspantar((j) => espantados.push(j));
      agarrar(n, null, AMBOS);
      n.poner(0, 42.5, Y2, -1.5);
      let masLejos = 0;
      const turquesa = porPuntos(n, 1, [
        [45.1, 0.55],
        [55, 0],
      ]);
      const llego = hasta(
        n,
        1500,
        () => n.nivel.llave("llave").encajada,
        () => {
          n.entradas[1] = turquesa(AMBOS);
          masLejos = Math.max(masLejos, n.pelvis(1).x);
        },
      );
      expect(llego).toBe(-1);
      expect(espantados.length).toBeGreaterThan(1);
      expect(espantados.every((j) => j === 1)).toBe(true);
      expect(masLejos).toBeLessThan(51);
    });

    it("pasar con la antorcha debajo de una percha los despierta: la apagan (adiós logro) y se prende en el brasero", async () => {
      const n = await armarXibalba();
      const antorcha = n.nivel.antorcha("antorcha");
      const murcielagos = n.nivel.murcielagos("murcielagos");
      agarrar(n, AMBOS, null);
      n.poner(1, 42.5, Y2, 1.5);
      // Derecho por debajo de la primera percha (z = 0.75)
      const rojo = porPuntos(n, 0, [
        [44.7, -0.3],
        [46, 0.6],
        [49, 0.6],
      ]);
      hasta(
        n,
        600,
        () => !antorcha.encendida,
        () => {
          n.entradas[0] = rojo({ ...AMBOS, avanzar: 0.7 });
        },
      );
      expect(antorcha.encendida).toBe(false);
      expect(murcielagos.apagadas).toBe(1);
      // Con la llama junto al fuego del brasero se vuelve a prender
      antorcha.cuerpo.setTranslation({ x: 44.75, y: Y2 + 1.65 - 0.65, z: -1.45 + 0.3 }, true);
      n.correr(2);
      expect(antorcha.encendida).toBe(true);
    });
  });
  describe("misión 6: la tumba se abre con el contrapeso", () => {
    /** El rojo agarra la piedra de la repisa (de frente, mirando a −z), la lleva hasta el plato y la suelta encima. */
    const llevarPiedra = (n: Xibalba, nombre: string, lado: number) => {
      const piedra = n.nivel.bloque(nombre);
      n.poner(0, piedra.cuerpo.translation().x, Y2, -1.95, Math.PI);
      n.entradas[0] = QUIETO;
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(30);
      const t = piedra.cuerpo.translation();
      expect(piedra.cargadores, `${nombre} en ${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}`).toBe(1);
      n.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: -0.5 };
      n.correr(30);
      // Da la vuelta y camina hasta el plato con la piedra adelante; la suelta encima
      const centro = n.nivel.plancha("plato").placa.translation();
      const plato = { x: centro.x + lado * 0.28, z: centro.z };
      hasta(
        n,
        600,
        () => Math.hypot(piedra.cuerpo.translation().x - plato.x, piedra.cuerpo.translation().z - plato.z) < 0.15,
        () => {
          n.entradas[0] = n.haciaDonde(0, plato.x, plato.z + 0.3, { ...AMBOS, avanzar: 0.5 });
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(60);
      return piedra;
    };

    it("solo: con las dos piedras en el plato la losa sube del todo y se entra a la tumba (con una, no alcanza)", async () => {
      const n = await armarXibalba();
      n.nivel.avance.irA(5);
      n.poner(1, 56.0, Y2, 1.4);
      const losa = () => n.nivel.pieza("losa").cuerpo?.translation().y ?? 0;
      const abajo = losa();
      llevarPiedra(n, "piedra-1", -1);
      const conUna = losa() - abajo;
      expect(conUna).toBeLessThan(1.5);
      llevarPiedra(n, "piedra-2", 1);
      n.correr(60);
      expect(n.nivel.plancha("plato").hundida).toBeGreaterThan(0.85);
      expect(losa() - abajo).toBeGreaterThan(2.3);
      n.poner(0, 58.2, Y2, 0.2);
      expect(
        hasta(
          n,
          400,
          () => n.nivel.puntoDeControl >= 6,
          () => {
            n.entradas[0] = n.haciaDonde(0, 61.2, 0.9);
          },
        ),
      ).toBeGreaterThan(0);
    });

    it("sin contrapeso la losa no se mueve y no se entra", async () => {
      const n = await armarXibalba();
      n.nivel.avance.irA(5);
      const losa = () => n.nivel.pieza("losa").cuerpo?.translation().y ?? 0;
      const abajo = losa();
      n.poner(0, 58.2, Y2, 0.2);
      expect(
        hasta(
          n,
          400,
          () => n.nivel.puntoDeControl >= 6,
          () => {
            n.entradas[0] = n.haciaDonde(0, 61.2, 0.9);
          },
        ),
      ).toBe(-1);
      expect(losa()).toBeCloseTo(abajo, 3);
      // Por el costado de la losa hay un marco bajo (90 cm): no se trepa
      n.poner(0, 58.3, Y2, 2.3);
      n.correr(10);
      expect(treparHaciaElEste(n, 0, 59.15, Y2 + 0.9)).toBe(-1);
      expect(
        hasta(
          n,
          300,
          () => n.nivel.puntoDeControl >= 6,
          () => {
            n.entradas[0] = n.haciaDonde(0, 61.2, 2.3, { saltar: n.nivel.pasos % 40 === 0 });
          },
        ),
      ).toBe(-1);
    });
  });

  it("el secreto: trepando los tres escalones junto al túnel se llega a la guacamaya dorada en lo alto del templo", async () => {
    const n = await armarXibalba();
    n.nivel.avance.irA(4);
    n.poner(0, 42.1, Y2, -2.6);
    n.poner(1, 42.9, Y2, 1);
    n.correr(20);
    for (const [cara, arriba] of [
      [42.8, Y2 + 1.5],
      [44.0, Y2 + 3.0],
      [45.2, Y2 + 4.5],
    ] as const) {
      expect(treparHaciaElEste(n, 0, cara, arriba), `escalón de ${cara}`).toBeGreaterThan(0);
    }
    expect(n.nivel.secreto).toBe(false);
    expect(
      hasta(
        n,
        300,
        () => n.nivel.secreto,
        () => {
          n.entradas[0] = n.haciaDonde(0, 48.4, -2.05, { avanzar: 0.6 });
        },
      ),
    ).toBeGreaterThan(0);
  });

  it("al retomar en cada punto, lo de antes ya quedó hecho", async () => {
    const n = await armarXibalba();
    n.nivel.avance.irA(5);
    n.correr(5);
    for (const nombre of ["entrada", "reja", "porton", "puerta-jade"]) {
      expect(n.nivel.pieza(nombre).cuerpo?.translation().y ?? 9, nombre).toBeLessThan(
        -1.2 + (nombre === "puerta-jade" ? Y2 : 0),
      );
    }
    expect(n.nivel.estela("estela").alineada).toBe(true);
    expect(n.nivel.llave("llave").encajada).toBe(true);
    expect(n.nivel.bloque("bloque").cuerpo.translation().x).toBeGreaterThan(40.6);
  });

  it("es determinista: dos corridas iguales, con los murciélagos apagando y espantando, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarXibalba();
      n.nivel.avance.irA(4);
      n.poner(0, 43.75, Y2, -0.95);
      n.correr(20);
      n.entradas[0] = { ...QUIETO, brazoIzquierdo: true };
      n.correr(40);
      n.correr(500, () => {
        n.entradas[0] = n.haciaDonde(0, 52, -0.3, { brazoIzquierdo: true, avanzar: 0.7 });
        n.entradas[1] = n.haciaDonde(1, 50, 0.6);
      });
      const murcielagos = n.nivel.murcielagos("murcielagos");
      const todo: number[] = [murcielagos.apagadas, murcielagos.espantados];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    const una = await correrUna();
    expect(una[1]).toBeGreaterThan(0);
    expect(await correrUna()).toEqual(una);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica la estela, el bloque, la antorcha (y su fuego) y a los murciélagos", async () => {
    const anfitrion = await armarXibalba();
    const invitado = await armarXibalba();
    // El anfitrión: el rojo entra al túnel a oscuras y los murciélagos lo espantan; la estela, girada
    anfitrion.nivel.avance.irA(4);
    anfitrion.nivel.estela("estela").alinear();
    anfitrion.nivel.antorcha("antorcha").apagar();
    anfitrion.correr(150, () => {
      anfitrion.entradas[0] = anfitrion.haciaDonde(0, 50, 0);
    });
    expect(anfitrion.nivel.murcielagos("murcielagos").estado).not.toBe("colgados");

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
    for (const nombre of [
      "estela",
      "bloque",
      "pelota",
      "antorcha",
      "llave",
      "murcielagos",
      "planchas",
      "entrada",
      "losa",
    ]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // La estela girada y el fuego apagado (bien abajo de la antorcha) llegan igual
    const giro = (c: RAPIER.RigidBody) => new THREE.Quaternion().copy(c.rotation());
    expect(
      giro(invitado.nivel.estela("estela").cuerpo).angleTo(giro(anfitrion.nivel.estela("estela").cuerpo)),
    ).toBeLessThan(0.01);
    const fuego = posicion(invitado.nivel.antorcha("antorcha").fuego);
    expect(fuego.distanceTo(posicion(anfitrion.nivel.antorcha("antorcha").fuego))).toBeLessThan(0.003);
    expect(fuego.y).toBeLessThan(posicion(invitado.nivel.antorcha("antorcha").cuerpo).y - 5);
  });
});
