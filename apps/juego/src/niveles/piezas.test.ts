// Las piezas de juego (TU-12) en un mundo de Rapier de verdad, en Node: se arman desde una escena como la que deja
// el .glb, se corren pasos y se miran posiciones. Las físicas son deterministas: dos corridas iguales dan lo mismo.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { PASO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type EntradaMuneco, type Muneco, QUIETO } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import { cuerposMoviles } from "../red/sincronia";
import { armarNivel } from "./armar";
import { ErrorDeNivel, leerPlano } from "./formato";
import { NIVELES } from "./lista";
import { crearNivel } from "./nivel";
import { armarPiezas, type PiezasDeJuego } from "./piezas";
import { leerDelDisco } from "./prueba";

const AMBOS = { brazoIzquierdo: true, brazoDerecho: true };

/** Una caja de la escena: centro, medidas y propiedades (como un objeto de Blender con sus Custom Properties). */
function caja(nombre: string, [x, y, z]: number[], [ancho, alto, fondo]: number[], extras: Record<string, unknown>) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo));
  m.name = nombre;
  m.position.set(x ?? 0, y ?? 0, z ?? 0);
  m.userData = extras;
  return m;
}
const pieza = (cual: string, nombre: string, centro: number[], medidas: number[], extras = {}) =>
  caja(nombre, centro, medidas, { tipo: "pieza", pieza: cual, ...extras });

/** Una escena con suelo en y = 0 (de x −10 a 10), las salidas y las piezas; la arma en un mundo nuevo. */
async function armar(...objetos: THREE.Object3D[]) {
  const { rapier, mundo } = await crearMundo();
  const raiz = new THREE.Group();
  raiz.userData = { nivel: 98, vacio: -3 };
  raiz.add(caja("suelo", [0, -0.5, 0], [20, 1, 20], { tipo: "solido" }));
  for (const jugador of [1, 2]) {
    const salida = new THREE.Object3D();
    salida.position.set(-8, 0, jugador);
    salida.userData = { tipo: "salida", jugador };
    raiz.add(salida);
  }
  raiz.add(...objetos);
  const plano = leerPlano(raiz);
  mundo.createCollider(rapier.ColliderDesc.cuboid(10, 0.5, 10).setTranslation(0, -0.5, 0).setFriction(0.8));
  const piezas = armarPiezas(rapier, mundo, new THREE.Scene(), plano.piezas);
  const munecos: Muneco[] = [];
  const entradas: EntradaMuneco[] = [];
  const fuera = (p: THREE.Vector3Like) => p.y < plano.vacio;
  /** Corre esos pasos como el nivel: piezas, muñecos, el paso y el estado de las piezas. */
  const correr = (pasos: number, cadaPaso?: (paso: number) => void) => {
    for (let i = 0; i < pasos; i++) {
      cadaPaso?.(i);
      piezas.antes(munecos, entradas);
      munecos.forEach((m, j) => {
        m.pasar(entradas[j] ?? QUIETO);
      });
      mundo.step();
      piezas.despues(munecos, fuera);
    }
  };
  /** Un muñeco con los pies en (x, y, z), mirando hacia `rumbo`. */
  const poner = (x: number, y: number, z: number, rumbo = 0) => {
    const m = crearMuneco(rapier, mundo, { posicion: { x, y, z }, rumbo, indice: munecos.length });
    munecos.push(m);
    entradas.push(QUIETO);
    return m;
  };
  return { rapier, mundo, piezas, correr, poner, entradas };
}

const enLaLista = <T>(lista: PiezasDeJuego, f: (p: PiezasDeJuego) => T | undefined): T => {
  const p = f(lista);
  if (!p) throw new Error("falta la pieza");
  return p;
};
const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());

describe("formato de las piezas", () => {
  it("lee cada pieza con sus valores por omisión y rechaza lo que no sirve", () => {
    const raiz = new THREE.Group();
    raiz.userData = { nivel: 1 };
    raiz.add(caja("suelo", [0, -0.5, 0], [4, 1, 4], { tipo: "solido" }));
    for (const jugador of [1, 2]) {
      const salida = new THREE.Object3D();
      salida.userData = { tipo: "salida", jugador };
      raiz.add(salida);
    }
    raiz.add(
      pieza("huacal", "h", [0, 0.3, 0], [0.6, 0.6, 0.6]),
      pieza("palanca", "p", [1, 0.65, 0], [0.3, 1.3, 0.3], { angulo: 30, vuelve: 0 }),
      pieza("plancha", "pl", [2, 0.06, 0], [1, 0.12, 1]),
      pieza("balancin", "b", [3, 0.5, 0], [4, 0.3, 0.5], { apoyo: 0.3 }),
      pieza("bejuco", "be", [4, 2, 0], [0.1, 2.4, 0.1]),
    );
    const plano = leerPlano(raiz);
    const por = Object.fromEntries(plano.piezas.map((p) => [p.nombre, p]));
    expect(por.h).toMatchObject({ cual: "huacal", masa: 8, rozamiento: 0.7 });
    expect(por.p).toMatchObject({ cual: "palanca", umbral: 0.75, vuelve: false });
    expect(por.p?.cual === "palanca" && por.p.angulo).toBeCloseTo(Math.PI / 6);
    expect(por.pl).toMatchObject({ cual: "plancha", peso: 10, hundir: 0.06 });
    expect(por.b).toMatchObject({ cual: "balancin", masa: 25, apoyo: 0.3 });
    expect(por.be).toMatchObject({ cual: "bejuco", masa: 4, segmentos: 8 });

    const con = (o: THREE.Object3D) => () => leerPlano(Object.assign(raiz.clone(), { userData: raiz.userData }).add(o));
    expect(con(pieza("rueda", "r", [0, 0, 0], [1, 1, 1]))).toThrow(ErrorDeNivel);
    expect(con(pieza("plancha", "honda", [0, 0, 0], [1, 0.1, 1], { hundir: 0.2 }))).toThrow(/hundir/);
    expect(con(pieza("balancin", "torcido", [0, 0, 0], [3, 0.3, 0.3], { apoyo: 1.5 }))).toThrow(/apoyo/);
    const vacio = new THREE.Object3D();
    vacio.name = "sin-malla";
    vacio.userData = { tipo: "pieza", pieza: "huacal" };
    expect(con(vacio)).toThrow(/malla/);
  });
});

describe("huacal", () => {
  it("se apila: tres huacales uno sobre otro aguantan, y con un muñeco arriba también", async () => {
    const { piezas, correr, poner } = await armar(
      pieza("huacal", "abajo", [0, 0.3, 0], [0.6, 0.6, 0.6]),
      pieza("huacal", "medio", [0.05, 0.9, 0], [0.6, 0.6, 0.6]),
      pieza("huacal", "arriba", [-0.05, 1.5, 0.03], [0.6, 0.6, 0.6]),
    );
    const arriba = enLaLista(piezas, (p) => p.buscar("huacal", "arriba")).cuerpo;
    correr(180);
    expect(posicion(arriba).y).toBeCloseTo(1.5, 1);
    expect(Math.hypot(posicion(arriba).x + 0.05, posicion(arriba).z - 0.03)).toBeLessThan(0.05);

    const muneco = poner(-0.05, 1.8, 0.03);
    correr(240);
    expect(posicion(arriba).y).toBeCloseTo(1.5, 1);
    expect(muneco.estado).toBe("de pie");
    expect(muneco.partes.pelvis.translation().y).toBeGreaterThan(2.2);
  });

  it("si se cae al vacío vuelve a donde empezó", async () => {
    const { piezas, correr } = await armar(pieza("huacal", "h", [9.8, 0.3, 0], [0.6, 0.6, 0.6]));
    const h = enLaLista(piezas, (p) => p.buscar("huacal", "h")).cuerpo;
    h.setLinvel({ x: 3, y: 0, z: 0 }, true);
    let cayo = false;
    correr(120, () => {
      cayo ||= h.translation().y < 0;
    });
    expect(cayo).toBe(true);
    expect(posicion(h).distanceTo(new THREE.Vector3(9.8, 0.3, 0))).toBeLessThan(0.05);
  });
});

describe("plancha de presión", () => {
  it("se hunde con un muñeco encima, avisa, y vuelve a subir cuando se va", async () => {
    const { piezas, correr, poner } = await armar(pieza("plancha", "pl", [0, 0.06, 0], [1.2, 0.12, 1.2]));
    const plancha = enLaLista(piezas, (p) => p.buscar("plancha", "pl"));
    const avisos: boolean[] = [];
    plancha.alCambiar((pisada) => avisos.push(pisada));
    correr(120);
    expect(plancha.hundida).toBeLessThan(0.05);
    expect(plancha.pisada).toBe(false);

    const muneco = poner(0, 0.15, 0);
    correr(120);
    expect(plancha.pisada).toBe(true);
    expect(plancha.hundida).toBeGreaterThan(0.8);
    expect(avisos).toEqual([true]);

    muneco.reaparecer({ x: 4, y: 0.02, z: 0 }, 0);
    correr(60);
    expect(plancha.pisada).toBe(false);
    expect(plancha.hundida).toBeLessThan(0.05);
    expect(avisos).toEqual([true, false]);
  });

  it("un huacal de 8 kg encima hace de contrapeso; uno de 2 kg no alcanza", async () => {
    const { piezas, correr } = await armar(
      pieza("plancha", "pesada", [0, 0.06, 0], [1.2, 0.12, 1.2]),
      pieza("huacal", "h", [0, 0.42, 0], [0.6, 0.6, 0.6]),
      pieza("plancha", "liviana", [3, 0.06, 0], [1.2, 0.12, 1.2]),
      pieza("huacal", "chico", [3, 0.32, 0], [0.4, 0.4, 0.4], { masa: 2 }),
    );
    correr(120);
    expect(enLaLista(piezas, (p) => p.buscar("plancha", "pesada")).pisada).toBe(true);
    const liviana = enLaLista(piezas, (p) => p.buscar("plancha", "liviana"));
    expect(liviana.pisada).toBe(false);
    expect(liviana.hundida).toBeGreaterThan(0.05);
  });
});

describe("palanca", () => {
  /** Una palanca mirando hacia +z (en reposo se inclina hacia allá) y una fuerza en la manija hacia −z. */
  const jalar = async (vuelve: number) => {
    const armado = await armar(pieza("palanca", "p", [0, 0.65, 0], [0.6, 1.3, 0.3], { vuelve }));
    const palanca = enLaLista(armado.piezas, (p) => p.buscar("palanca", "p"));
    const empujar = (fuerza: number) => () => {
      const b = palanca.brazo;
      const manija = new THREE.Vector3(0, 0.55, 0).applyQuaternion(new THREE.Quaternion().copy(b.rotation()));
      b.applyImpulseAtPoint({ x: 0, y: 0, z: -fuerza * PASO }, manija.add(b.translation()), true);
    };
    return { ...armado, palanca, empujar };
  };

  it("en reposo no está activa; jalada hacia atrás se activa y, al soltarla, vuelve sola", async () => {
    const { palanca, correr, empujar } = await jalar(1);
    const avisos: boolean[] = [];
    palanca.alCambiar((activa) => avisos.push(activa));
    correr(60);
    expect(palanca.recorrido).toBeLessThan(0.05);
    expect(palanca.activa).toBe(false);
    correr(90, empujar(60));
    expect(palanca.recorrido).toBeGreaterThan(0.9);
    expect(palanca.activa).toBe(true);
    correr(90);
    expect(palanca.recorrido).toBeLessThan(0.1);
    expect(palanca.activa).toBe(false);
    expect(avisos).toEqual([true, false]);
  });

  it("con poca fuerza no llega; sin `vuelve` queda del lado donde se la deja", async () => {
    const debil = await jalar(1);
    debil.correr(120, debil.empujar(8));
    expect(debil.palanca.activa).toBe(false);

    const { palanca, correr, empujar } = await jalar(0);
    correr(90, empujar(40));
    correr(120);
    expect(palanca.activa).toBe(true);
    expect(palanca.recorrido).toBeGreaterThan(0.9);
  });

  it("un muñeco la agarra con los brazos arriba y la empuja caminando: queda activa", async () => {
    // El muñeco mira hacia −z, al frente de la palanca, que se le inclina encima
    const { palanca, correr, poner, entradas } = await jalar(1);
    const muneco = poner(0, 0, 1.3, Math.PI);
    correr(60);
    entradas[0] = { ...QUIETO, ...AMBOS };
    correr(30);
    entradas[0] = { ...QUIETO, ...AMBOS, avanzar: 1 };
    let activa = false;
    correr(180, () => {
      activa ||= palanca.activa;
    });
    expect(muneco.agarrado("brazoIzquierdo") ?? muneco.agarrado("brazoDerecho")).not.toBeNull();
    expect(activa).toBe(true);
  });
});

describe("balancín", () => {
  it("el peso de un lado lo baja y sube el otro", async () => {
    const { piezas, correr, poner } = await armar(pieza("balancin", "b", [0, 0.6, 0], [4, 0.3, 0.6]));
    const balancin = enLaLista(piezas, (p) => p.buscar("balancin", "b"));
    const extremo = (lado: number) =>
      new THREE.Vector3(lado * 2, 0, 0)
        .applyQuaternion(new THREE.Quaternion().copy(balancin.tabla.rotation()))
        .add(balancin.tabla.translation()).y;
    correr(60);
    expect(Math.abs(balancin.inclinacion)).toBeLessThan(0.05);

    // Un muñeco en el extremo +x: baja ese lado hasta el tope (15°) y el otro sube medio metro
    const muneco = poner(1.6, 0.8, 0);
    correr(180);
    expect(balancin.inclinacion).toBeGreaterThan(0.2);
    expect(extremo(1)).toBeLessThan(0.35);
    expect(extremo(-1)).toBeGreaterThan(1.05);
    expect(muneco.estado).toBe("de pie");

    // Otro muñeco, más afuera del lado de arriba, le gana: ahora baja el −x
    poner(-1.85, 1.3, 0);
    correr(240);
    expect(balancin.inclinacion).toBeLessThan(0);
  });

  it("con el apoyo corrido, el lado largo pesa más y queda abajo", async () => {
    const { piezas, correr } = await armar(pieza("balancin", "b", [0, 0.9, 0], [4, 0.3, 0.6], { apoyo: 0.3 }));
    const balancin = enLaLista(piezas, (p) => p.buscar("balancin", "b"));
    correr(180);
    expect(balancin.inclinacion).toBeCloseTo((15 * Math.PI) / 180, 1);
  });
});

describe("bejuco", () => {
  it("cuelga derecho de su punta sin estirarse, y empujado se columpia de un lado al otro", async () => {
    const { piezas, correr } = await armar(pieza("bejuco", "be", [0, 3, 0], [0.1, 2.4, 0.1]));
    const bejuco = enLaLista(piezas, (p) => p.buscar("bejuco", "be"));
    const ultimo = bejuco.segmentos.at(-1);
    if (!ultimo) throw new Error("sin segmentos");
    expect(bejuco.segmentos).toHaveLength(8);
    correr(120);
    expect(posicion(ultimo).x).toBeCloseTo(0, 2);
    // El centro del último segmento: 2.4 m menos medio segmento (15 cm) por debajo de la punta, en y = 4.2
    expect(posicion(ultimo).y).toBeCloseTo(4.2 - 2.4 + 0.15, 1);

    // Los segmentos son parte de una cadena: se empujan con fuerzas (un impulso suelto no les llega)
    let cruces = 0;
    let antes = 0;
    let lejos = 0;
    correr(360, (i) => {
      ultimo.resetForces(true);
      if (i < 10) ultimo.addForce({ x: 30, y: 0, z: 0 }, true);
      const x = ultimo.translation().x;
      if (Math.sign(x) !== Math.sign(antes) && antes !== 0) cruces++;
      antes = x;
      lejos = Math.max(lejos, Math.abs(x));
    });
    expect(lejos).toBeGreaterThan(0.5);
    expect(cruces).toBeGreaterThanOrEqual(4);
  });

  /** El bejuco cuelga justo pasado el borde del suelo (z = 10), hasta 1 m de alto, y un muñeco camina hacia él con
   * los brazos arriba hasta agarrarlo con las dos manos. */
  const agarrarlo = async () => {
    const armado = await armar(pieza("bejuco", "be", [0, 2.4, 10.3], [0.1, 2.8, 0.1]));
    const bejuco = enLaLista(armado.piezas, (p) => p.buscar("bejuco", "be"));
    const muneco = armado.poner(0, 0, 9.3, 0);
    const conLasDos = () => muneco.agarrado("brazoIzquierdo") !== null && muneco.agarrado("brazoDerecho") !== null;
    armado.correr(30);
    armado.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: 1 };
    for (let i = 0; i < 120 && !conLasDos(); i++) armado.correr(1);
    armado.entradas[0] = { ...QUIETO, ...AMBOS };
    /** Corre `pasos` y devuelve hasta dónde llegó la pelvis (z); con `columpiarse` aprieta adelante mientras va
     * hacia adelante y atrás mientras vuelve. */
    const columpio = (pasos: number, columpiarse: boolean) => {
      let lejos = 0;
      armado.correr(pasos, () => {
        const pelvis = muneco.partes.pelvis;
        if (columpiarse) armado.entradas[0] = { ...QUIETO, ...AMBOS, avanzar: Math.sign(pelvis.linvel().z) };
        lejos = Math.max(lejos, pelvis.translation().z);
      });
      return lejos;
    };
    return { ...armado, bejuco, muneco, conLasDos, columpio };
  };

  it("un muñeco lo agarra con las dos manos y, siguiendo de largo, sale del borde colgado", async () => {
    const { bejuco, muneco, conLasDos, correr } = await agarrarlo();
    expect(conLasDos()).toBe(true);
    correr(30);
    expect(bejuco.colgados).toBe(1);
    expect(muneco.enElSuelo).toBe(false);
    expect(muneco.partes.pelvis.translation().z).toBeGreaterThan(10.3);
  });

  it("colgado, apretando adelante y atrás a tiempo se columpia más lejos que quieto", async () => {
    const quieto = (await agarrarlo()).columpio(90, false);
    const columpiandose = await agarrarlo();
    const lejos = columpiandose.columpio(90, true);
    console.log(`bejuco: quieto llega a z = ${quieto.toFixed(2)}; columpiándose, a ${lejos.toFixed(2)}`);
    expect(columpiandose.bejuco.colgados).toBe(1);
    expect(lejos).toBeGreaterThan(quieto + 0.5);
  });
});

describe("determinismo", () => {
  it("dos corridas iguales con todas las piezas dan lo mismo", async () => {
    const correrUna = async () => {
      const { mundo, correr, poner, entradas } = await armar(
        pieza("huacal", "h", [-3, 0.3, 0], [0.6, 0.6, 0.6]),
        pieza("plancha", "pl", [-1.5, 0.06, 0], [1.2, 0.12, 1.2]),
        pieza("palanca", "p", [0, 0.65, 0], [0.6, 1.3, 0.3]),
        pieza("balancin", "b", [3, 0.6, 0], [4, 0.3, 0.6]),
        pieza("bejuco", "be", [6, 3, 0], [0.1, 2.4, 0.1]),
      );
      poner(-4, 0, 0, Math.PI / 2);
      entradas[0] = { ...QUIETO, avanzar: 1, girar: 0.05 };
      correr(300);
      const todo: number[] = [];
      mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    expect(await correrUna()).toEqual(await correrUna());
  });
});

describe("el nivel de piezas (niveles/98-piezas)", () => {
  async function armarNivelDePiezas() {
    const { rapier, mundo } = await crearMundo();
    const plano = await leerDelDisco("98-piezas");
    const armado = armarNivel(rapier, mundo, plano);
    const salida = plano.puntos[0]?.lugares;
    if (!salida) throw new Error("sin salida");
    const munecos = [0, 1].map((indice) =>
      crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
    ) as unknown as readonly [Muneco, Muneco];
    const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.piezas?.crearGuion() });
    const correr = (pasos: number, cadaPaso?: () => void, rojo: EntradaMuneco = QUIETO) => {
      for (let i = 0; i < pasos; i++) {
        cadaPaso?.();
        nivel.antes([rojo, QUIETO]);
        munecos[0].pasar(rojo);
        munecos[1].pasar(QUIETO);
        mundo.step();
        nivel.despues();
        armado.guardar();
      }
    };
    const altura = (nombre: string) => nivel.pieza(nombre).cuerpo?.translation().y ?? Number.NaN;
    return { mundo, plano, armado, nivel, munecos, correr, altura };
  }

  it("tiene todas las piezas, y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarNivelDePiezas();
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "balancin balancin",
      "bejuco bejuco-rojo",
      "bejuco bejuco-turquesa",
      "huacal huacal-1",
      "huacal huacal-2",
      "huacal huacal-3",
      "palanca palanca",
      "plancha plancha",
    ]);
    expect(nivel.bejuco("bejuco-rojo").segmentos.length).toBeGreaterThan(5);
    expect(() => nivel.palanca("plancha")).toThrow(/palanca «plancha»/);
    // La foto lleva la cuenta en un byte y las posiciones a ±64 m del origen (red/paquetes.ts)
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  it("la compuerta 1 baja mientras alguien pisa la plancha y sube cuando se va", async () => {
    const { nivel, munecos, correr, altura } = await armarNivelDePiezas();
    correr(30);
    const arriba = altura("compuerta-1");
    munecos[0].reaparecer({ x: 0.5, y: 0.15, z: 1 }, Math.PI / 2);
    correr(90);
    expect(nivel.plancha("plancha").pisada).toBe(true);
    expect(altura("compuerta-1")).toBeLessThan(arriba - 2.4);
    munecos[0].reaparecer({ x: -3, y: 0.02, z: 1 }, Math.PI / 2);
    correr(90);
    expect(altura("compuerta-1")).toBeCloseTo(arriba, 2);
  });

  it("la compuerta 2 baja mientras empujan la palanca, y pasado el punto 2 queda abajo", async () => {
    const { nivel, plano, munecos, correr, altura } = await armarNivelDePiezas();
    correr(30);
    const arriba = altura("compuerta-2");
    const palanca = nivel.palanca("palanca");
    // La palanca mira hacia −x: se la empuja hacia +x desde la manija
    const empujar = () => {
      const b = palanca.brazo;
      const manija = new THREE.Vector3(0, 0.55, 0).applyQuaternion(new THREE.Quaternion().copy(b.rotation()));
      b.applyImpulseAtPoint({ x: 60 * PASO, y: 0, z: 0 }, manija.add(b.translation()), true);
    };
    correr(90, empujar);
    expect(palanca.activa).toBe(true);
    expect(altura("compuerta-2")).toBeLessThan(arriba - 2.4);
    correr(120);
    expect(palanca.activa).toBe(false);
    expect(altura("compuerta-2")).toBeCloseTo(arriba, 2);

    const dos = plano.puntos[2]?.lugares[0];
    if (!dos) throw new Error("sin punto 2");
    munecos[0].reaparecer(dos.posicion, dos.rumbo);
    correr(60);
    expect(nivel.puntoDeControl).toBe(2);
    expect(altura("compuerta-2")).toBeLessThan(arriba - 2.4);
  });

  it("en línea: con la foto del anfitrión, el invitado ubica cada pieza (y cada segmento del bejuco) y la dibuja ahí", async () => {
    const anfitrion = await armarNivelDePiezas();
    const invitado = await armarNivelDePiezas();
    // El anfitrión: el rojo, desde el punto 2, agarra su bejuco y se columpia sobre la quebrada
    const dos = anfitrion.plano.puntos[2]?.lugares[0];
    if (!dos) throw new Error("sin punto 2");
    anfitrion.munecos[0].reaparecer(dos.posicion, dos.rumbo);
    anfitrion.correr(10);
    anfitrion.correr(70, undefined, { ...QUIETO, ...AMBOS, avanzar: 1 });
    expect(anfitrion.nivel.bejuco("bejuco-rojo").colgados).toBe(1);

    // La foto, como la manda el anfitrión, y el invitado (que no simula) pone cada cuerpo en su lugar
    const deAca = cuerposMoviles(anfitrion.mundo);
    const deAlla = cuerposMoviles(invitado.mundo);
    expect(deAlla.length).toBe(deAca.length);
    const posiciones = new Float32Array(
      deAca.flatMap((c) => [c.translation().x, c.translation().y, c.translation().z]),
    );
    const rotaciones = new Float32Array(
      deAca.flatMap((c) => [c.rotation().x, c.rotation().y, c.rotation().z, c.rotation().w]),
    );
    const paquete = escribirFoto({
      paso: 80,
      ack: 0,
      estados: ["en el aire", "de pie"],
      agarres: 0,
      rumbos: [0, 0],
      velocidades: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      punto: 2,
      reloj: 0,
      posiciones,
      rotaciones,
    });
    const foto = leerFoto(paquete);
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

    // Cada segmento del bejuco y cada pieza quedan donde los tiene el anfitrión, y su imagen también
    const bejucos = [anfitrion.nivel.bejuco("bejuco-rojo"), invitado.nivel.bejuco("bejuco-rojo")] as const;
    bejucos[0].segmentos.forEach((s, i) => {
      const otro = bejucos[1].segmentos[i];
      expect(otro && posicion(otro).distanceTo(posicion(s))).toBeLessThan(0.003);
    });
    // (y el bejuco no está colgando quieto: va columpiándose, lejos de donde cuelga)
    const punta = bejucos[1].segmentos.at(-1);
    expect(punta && posicion(punta).x).toBeGreaterThan(12.6);
    for (const p of invitado.armado.piezasDeJuego.solidas) {
      const real = anfitrion.nivel.pieza(p.nombre).cuerpo;
      if (!real) continue;
      expect(p.objeto.position.distanceTo(posicion(real))).toBeLessThan(0.003);
    }
  });
});
