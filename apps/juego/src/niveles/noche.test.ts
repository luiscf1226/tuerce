// La Noche de tuerce (TU-33): la semilla elige la trampa, y cada trampa hace lo que dice, con físicas de verdad
// (un patio plano y dos muñecos). Que los niveles se sigan pudiendo jugar con cada una: escenas/noche.test.ts.
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import { vestirDeDia } from "../imagen";
import { saturacion } from "../imagen/paleta";
import { crearMundo } from "../motor/fisica";
import { crearMuneco, type Muneco } from "../muneco";
import { escribirFoto, leerFoto } from "../red/paquetes";
import {
  COLORES_NOCHE,
  crearNoche,
  crearResbalon,
  crearViento,
  cruzar,
  LUNA,
  leerNoche,
  MECATE,
  NIEBLA_ESPESA,
  type NombreTrampa,
  numeroDeTrampa,
  ROZAMIENTO_JABON,
  TRAMPAS,
  trampaDeNumero,
  trampaDeSemilla,
  trampaPorNombre,
  VIENTO,
} from "./noche";

const entrada = (cambios: Partial<EntradaJugador> = {}): EntradaJugador => ({ ...entradaQuieta(), ...cambios });
const trampa = (nombre: NombreTrampa) => {
  const t = trampaPorNombre(nombre);
  if (!t) throw new Error(`falta la trampa ${nombre}`);
  return t;
};

/** Un patio plano de 60 × 60 m con los dos muñecos, de día, y la noche con esa trampa (o sin ninguna). */
async function patio(nombre?: NombreTrampa, semilla = 1) {
  const { rapier, mundo } = await crearMundo();
  const escena = new THREE.Scene();
  vestirDeDia(escena);
  mundo.createCollider(rapier.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.8));
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: { x: indice * 1.2, y: 0, z: 0 }, rumbo: 0, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const noche = crearNoche(
    { rapier, mundo, escena, munecos },
    nombre ? { semilla, trampa: trampa(nombre) } : undefined,
  );
  /** Corre esos pasos como la escena: la entrada pasa por la trampa, los muñecos, la trampa y el paso. */
  const correr = (pasos: number, rojo = entrada(), turquesa = entrada()) => {
    for (let i = 0; i < pasos; i++) {
      const [a, b] = noche.entradas([rojo, turquesa]);
      munecos[0].pasar(a);
      munecos[1].pasar(b);
      noche.antes();
      mundo.step();
    }
  };
  const pelvis = (i: 0 | 1) => new THREE.Vector3().copy(munecos[i].partes.pelvis.translation());
  return { rapier, mundo, escena, munecos, noche, correr, pelvis };
}

describe("la semilla elige la trampa", () => {
  it("con la misma semilla sale la misma, y entre muchas semillas salen todas", () => {
    for (const semilla of [0, 1, 7, 42, 123456, 0xffffffff]) {
      expect(trampaDeSemilla(semilla)).toBe(trampaDeSemilla(semilla));
    }
    const salieron = new Set(Array.from({ length: 300 }, (_, s) => trampaDeSemilla(s).nombre));
    expect([...salieron].sort()).toEqual(TRAMPAS.map((t) => t.nombre).sort());
  });

  it("hay al menos 4 trampas, con nombre, título y cartel, y caben en los 4 bits de la foto", () => {
    expect(TRAMPAS.length).toBeGreaterThanOrEqual(4);
    expect(TRAMPAS.length).toBeLessThanOrEqual(15);
    expect(new Set(TRAMPAS.map((t) => t.nombre)).size).toBe(TRAMPAS.length);
    for (const t of TRAMPAS) {
      expect(t.titulo.length).toBeGreaterThan(3);
      expect(t.cartel.length).toBeGreaterThan(10);
      expect(trampaDeNumero(numeroDeTrampa(t))).toBe(t);
    }
    expect(numeroDeTrampa(undefined)).toBe(0);
    expect(trampaDeNumero(0)).toBeUndefined();
  });

  it("lee la dirección: `&noche` al azar, `&noche=N` fija la semilla y `&trampa=` la fuerza", () => {
    const azar = () => 99;
    expect(leerNoche(new URLSearchParams("escena=nivel"), azar)).toBeUndefined();
    expect(leerNoche(new URLSearchParams("noche"), azar)).toEqual({ semilla: 99, trampa: trampaDeSemilla(99) });
    expect(leerNoche(new URLSearchParams("noche=7"), azar)).toEqual({ semilla: 7, trampa: trampaDeSemilla(7) });
    expect(leerNoche(new URLSearchParams("noche=7&trampa=luna"), azar)).toEqual({ semilla: 7, trampa: trampa("luna") });
    expect(leerNoche(new URLSearchParams("trampa=mecate"), azar)?.trampa.nombre).toBe("mecate");
    expect(() => leerNoche(new URLSearchParams("noche&trampa=sapo"), azar)).toThrow(/trampa «sapo»/);
    // Sin `azar`, una semilla de verdad al azar
    expect(Number.isInteger(leerNoche(new URLSearchParams("noche"))?.semilla)).toBe(true);
  });

  it("en línea la trampa viaja en la foto sin agrandarla, y los agarres siguen ahí", () => {
    const foto = {
      paso: 10,
      ack: 3,
      estados: ["de pie", "en el aire"] as const,
      agarres: 0b1011,
      rumbos: [0.5, -1] as [number, number],
      velocidades: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ] as [THREE.Vector3Like, THREE.Vector3Like],
      punto: 1,
      reloj: 0,
      posiciones: new Float32Array(6),
      rotaciones: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1]),
    };
    const deDia = escribirFoto({ ...foto, estados: [...foto.estados] });
    for (const t of TRAMPAS) {
      const paquete = escribirFoto({ ...foto, estados: [...foto.estados], trampa: numeroDeTrampa(t) });
      expect(paquete.byteLength).toBe(deDia.byteLength);
      const leida = leerFoto(paquete);
      expect(leida?.agarres).toBe(0b1011);
      expect(trampaDeNumero(leida?.trampa ?? 0)).toBe(t);
    }
    expect(leerFoto(deDia)?.trampa).toBe(0);
  });
});

describe("cada trampa hace lo que dice", () => {
  it("brazos cruzados: el giro al revés y los brazos y gestos de costado cambiados", () => {
    const e = entrada({ avanzar: 1, girar: 0.5, brazoIzquierdo: true, saltar: true, gesto: "saludar" });
    expect(cruzar(e)).toEqual({ ...e, girar: -0.5, brazoIzquierdo: false, brazoDerecho: true, gesto: "llamar" });
    expect(cruzar(cruzar(e))).toEqual(e);
    expect(e.girar).toBe(0.5); // no cambia la original
  });

  it("brazos cruzados con físicas: apretando girar a la izquierda, el muñeco gira a la derecha", async () => {
    const deDia = await patio();
    const cruzados = await patio("cruzados");
    deDia.correr(60, entrada({ girar: 1 }));
    cruzados.correr(60, entrada({ girar: 1 }));
    expect(deDia.munecos[0].rumbo).toBeGreaterThan(1);
    expect(cruzados.munecos[0].rumbo).toBeCloseTo(-deDia.munecos[0].rumbo, 5);
  });

  it("piso jabonoso: la entrada llega y se va de a poco, y el piso no agarra", async () => {
    const resbalon = crearResbalon();
    const andando = Array.from({ length: 30 }, () => resbalon(entrada({ avanzar: 1 })).avanzar);
    expect(andando[0]).toBeLessThan(0.05);
    expect(andando[29]).toBeGreaterThan(0.4);
    expect(andando[29]).toBeLessThan(0.6);
    const soltando = Array.from({ length: 30 }, () => resbalon(entrada()).avanzar);
    expect(soltando[29]).toBeGreaterThan(0.1);

    // Con físicas: suelta el botón y se sigue de largo bastante más que en seco
    const deDia = await patio();
    const jabon = await patio("jabon");
    const suelo = (mundo: typeof jabon.mundo) => {
      let r = Number.NaN;
      mundo.forEachCollider((c) => {
        if (!c.parent() || c.parent()?.isFixed()) r = c.friction();
      });
      return r;
    };
    expect(suelo(jabon.mundo)).toBeCloseTo(ROZAMIENTO_JABON);
    for (const p of [deDia, jabon]) p.correr(150, entrada({ avanzar: 1 }));
    const antes = [deDia.pelvis(0).z, jabon.pelvis(0).z];
    for (const p of [deDia, jabon]) p.correr(90);
    const deLargo = [deDia.pelvis(0).z - (antes[0] ?? 0), jabon.pelvis(0).z - (antes[1] ?? 0)];
    expect(deLargo[1]).toBeGreaterThan((deLargo[0] ?? 0) + 0.4);
    // Quitada la trampa, el piso vuelve a agarrar como antes
    jabon.noche.poner(undefined);
    expect(suelo(jabon.mundo)).toBeCloseTo(0.8);
  });

  it("ventarrón: calma al empezar, ráfagas de a ratos, siempre las mismas con la misma semilla", () => {
    const viento = crearViento(5);
    const otraVez = crearViento(5);
    const fuerza = (paso: number) => Math.hypot(viento(paso).x, viento(paso).z);
    for (let paso = 0; paso < VIENTO.primera[0]; paso++) expect(fuerza(paso)).toBe(0);
    const pasos = Array.from({ length: 3600 }, (_, i) => i);
    const soplando = pasos.filter((p) => fuerza(p) > 0.1).length;
    expect(soplando).toBeGreaterThan(400); // un buen rato…
    expect(soplando).toBeLessThan(2400); // …pero no todo el tiempo
    for (const p of pasos) expect(fuerza(p)).toBeLessThanOrEqual(VIENTO.fuerza + 1e-9);
    // Pedido en cualquier orden, da lo mismo
    for (const p of [3000, 10, 1500, 700]) expect(otraVez(p)).toEqual(viento(p));
    const serie = (semilla: number) => pasos.map(crearViento(semilla));
    expect(serie(6)).not.toEqual(serie(5));
  });

  it("ventarrón con físicas: en una ráfaga, los muñecos quietos se corren hacia donde sopla", async () => {
    const semilla = 3;
    const viento = crearViento(semilla);
    const sopla = (p: number) => Math.hypot(viento(p).x, viento(p).z) > 0;
    let inicio = 0;
    while (!sopla(inicio)) inicio++;
    let fin = inicio;
    while (sopla(fin)) fin++;
    const v = viento(Math.round((inicio + fin) / 2));
    const { correr, pelvis } = await patio("viento", semilla);
    correr(inicio);
    const antes = pelvis(0);
    correr(fin - inicio + 30);
    const corrido = pelvis(0).sub(antes);
    corrido.y = 0;
    expect(corrido.dot(new THREE.Vector3(v.x, 0, v.z).normalize())).toBeGreaterThan(0.8);
    expect(corrido.normalize().dot(new THREE.Vector3(v.x, 0, v.z).normalize())).toBeGreaterThan(0.9);
  });

  it("gravedad de luna: saltan bastante más alto, y de pie siguen a la altura de siempre", async () => {
    const alto = async (nombre?: NombreTrampa) => {
      const { correr, pelvis } = await patio(nombre);
      correr(60);
      const dePie = pelvis(0).y;
      let tope = 0;
      correr(1, entrada({ saltar: true }));
      for (let i = 0; i < 150; i++) {
        correr(1);
        tope = Math.max(tope, pelvis(0).y - dePie);
      }
      return { dePie, tope };
    };
    const deDia = await alto();
    const luna = await alto("luna");
    expect(luna.dePie).toBeCloseTo(deDia.dePie, 2);
    expect(LUNA).toBeLessThan(1);
    expect(luna.tope).toBeGreaterThan(deDia.tope * 1.6);
  });

  it("amarrados: el que se va arrastra al otro y nunca se alejan más que el mecate", async () => {
    const { correr, pelvis, escena } = await patio("mecate");
    correr(30);
    const turquesa = pelvis(1);
    let lejos = 0;
    for (let i = 0; i < 300; i++) {
      correr(1, entrada({ avanzar: 1 }));
      lejos = Math.max(lejos, pelvis(0).distanceTo(pelvis(1)));
    }
    expect(lejos).toBeLessThan(MECATE + 0.15);
    expect(pelvis(1).distanceTo(turquesa)).toBeGreaterThan(1.5);
    expect(escena.getObjectByName("mecate")).toBeDefined();
  });

  it("amarrados: si uno reaparece lejos el mecate se suelta, y se vuelve a atar al juntarse", async () => {
    const { correr, pelvis, munecos, mundo } = await patio("mecate");
    correr(30);
    const nudos = () => {
      let n = 0;
      mundo.impulseJoints.forEach(() => {
        n++;
      });
      return n;
    };
    const conMecate = nudos();
    const rojo = pelvis(0);
    munecos[1].reaparecer({ x: 12, y: 0, z: 0 }, 0);
    correr(5);
    expect(nudos()).toBe(conMecate - 1);
    expect(pelvis(0).distanceTo(rojo)).toBeLessThan(0.1); // el rojo no salió volando
    munecos[1].reaparecer({ x: 1, y: 0, z: 0 }, 0);
    correr(5);
    expect(nudos()).toBe(conMecate);
  });

  it("niebla espesa: la niebla del nivel queda más corta; las otras trampas no la tocan", async () => {
    const { noche } = await patio("niebla");
    expect(noche.niebla).toBe(NIEBLA_ESPESA);
    noche.poner(trampa("luna"));
    expect(noche.niebla).toBe(1);
  });

  it("la noche oscurece la escena con grises (el único color siguen siendo los pañuelos) y al quitarla vuelve el día", async () => {
    for (const hex of Object.values(COLORES_NOCHE)) expect(saturacion(hex)).toBeLessThan(0.05);
    const { escena, noche } = await patio();
    const fondo = (escena.background as THREE.Color).getHex();
    const luces = () => escena.children.flatMap((o) => (o instanceof THREE.Light ? [o.intensity] : []));
    const deDia = luces();
    noche.poner(trampa("cruzados"));
    expect((escena.background as THREE.Color).getHex()).toBe(COLORES_NOCHE.niebla);
    expect((escena.fog as THREE.Fog).color.getHex()).toBe(COLORES_NOCHE.niebla);
    luces().forEach((i, n) => {
      expect(i).toBeLessThan(deDia[n] ?? 0);
    });
    // Cambiar de trampa no oscurece dos veces
    noche.poner(trampa("niebla"));
    luces().forEach((i, n) => {
      expect(i).toBeGreaterThan((deDia[n] ?? 0) * 0.25);
    });
    noche.poner(undefined);
    expect((escena.background as THREE.Color).getHex()).toBe(fondo);
    expect(luces()).toEqual(deDia);
  });

  it("el cartel sale una vez por trampa", async () => {
    const { rapier, mundo, escena, munecos } = await patio();
    const carteles: string[] = [];
    const noche = crearNoche(
      { rapier, mundo, escena, munecos, cartel: (t) => carteles.push(t.nombre) },
      { semilla: 1, trampa: trampa("luna") },
    );
    noche.anunciar();
    noche.anunciar();
    noche.poner(trampa("luna"));
    noche.anunciar();
    noche.poner(trampa("jabon"));
    noche.anunciar();
    expect(carteles).toEqual(["luna", "jabon"]);
  });

  it("es determinista: dos corridas iguales con la misma semilla dan lo mismo", async () => {
    for (const nombre of ["viento", "mecate", "jabon"] as const) {
      const corrida = async () => {
        const { correr, pelvis } = await patio(nombre, 11);
        correr(400, entrada({ avanzar: 1, girar: 0.2 }), entrada({ avanzar: 0.5 }));
        return [pelvis(0).toArray(), pelvis(1).toArray()];
      };
      expect(await corrida()).toEqual(await corrida());
    }
  });
});
