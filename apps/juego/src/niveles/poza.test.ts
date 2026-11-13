// El nivel 2, La poza (TU-24), en un mundo de Rapier de verdad, en Node: cada misión se puede terminar con los
// muñecos de verdad (las entradas que apretaría un jugador), las de a dos necesitan a los dos, La Sucia moja al que
// entra a su lavadero, y lo que se mueve (el agua también) viaja en la foto de la red. Para no repetir el camino
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
/** Las alturas, como en scripts/niveles/poza.mjs. */
const PLAYA = 0.3;
const ESCALON = 1.7;
const REPRESA = 3.1;
const FONDO = -0.3;
const ISLA = 1.9;

async function armarPoza() {
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco("02-poza");
  const armado = armarNivel(rapier, mundo, plano);
  const salida = plano.puntos[0]?.lugares;
  if (!salida) throw new Error("sin salida");
  const munecos = [0, 1].map((indice) =>
    crearMuneco(rapier, mundo, { posicion: salida[indice]?.posicion, rumbo: salida[indice]?.rumbo, indice }),
  ) as unknown as readonly [Muneco, Muneco];
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion: NIVELES.poza?.crearGuion() });
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
type Poza = Awaited<ReturnType<typeof armarPoza>>;

/** Corre hasta que se cumpla `listo` (o se acaben los pasos) y devuelve en cuántos pasos. */
function hasta(n: Poza, pasos: number, listo: () => boolean, cadaPaso?: (paso: number) => void) {
  for (let i = 0; i < pasos; i++) {
    if (listo()) return i;
    n.correr(1, () => cadaPaso?.(i));
  }
  return listo() ? pasos : -1;
}

/** Sube un escalón fijo (una pared con piso arriba) que tiene la cara en `cara` (x, mirando al este): se para a
 * 40 cm de la cara, alza los brazos, salta, se cuelga y trepa. */
function treparHaciaElEste(n: Poza, j: 0 | 1, cara: number, arriba: number) {
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

/** Empuja la piedra hacia (x, z): se pone detrás de ella, en la línea hacia allá, y camina contra ella. Para antes del
 * borde de la isla (z 0.75), y termina cuando la piedra se cae a la quebrada. */
function empujar(n: Poza, j: 0 | 1, cuerpo: RAPIER.RigidBody, x: number, z: number) {
  return hasta(
    n,
    900,
    () => cuerpo.translation().z > 1.25,
    () => {
      const s = cuerpo.translation();
      const d = new THREE.Vector3(x - s.x, 0, z - s.z).normalize();
      const atras = new THREE.Vector3(s.x, 0, s.z).addScaledVector(d, -0.75);
      const m = n.pelvis(j);
      const haciaPiedra = new THREE.Vector3(s.x - m.x, 0, s.z - m.z);
      const alineado = haciaPiedra.length() < 1.0 && haciaPiedra.normalize().dot(d) > 0.93;
      if (m.z > 0.75) n.entradas[j] = QUIETO;
      else if (alineado) n.entradas[j] = n.haciaDonde(j, s.x + d.x * 0.5, s.z + d.z * 0.5);
      else {
        // Rodea la piedra por detrás (lejos de ella) para no empujarla de costado
        const cerca = new THREE.Vector3(m.x - s.x, 0, m.z - s.z).length() < 0.7;
        const e = n.haciaDonde(j, atras.x, atras.z);
        const falta = m.distanceTo(new THREE.Vector3(atras.x, m.y, atras.z));
        n.entradas[j] = { ...e, avanzar: cerca ? -0.5 : Math.min(1, falta * 2) };
      }
    },
  );
}

/** Desde el punto 1 (los dos en la balsa, cada uno de su lado, junto a su remo): rema(n) los de `remeros` hasta llegar
 * al embarcadero (o se acaban los pasos). Al llegar, bajan caminando. */
function remar(n: Poza, remeros: readonly (0 | 1)[], pasos: number) {
  for (const j of remeros) n.entradas[j] = { ...QUIETO, ...AMBOS };
  let llego = false;
  return hasta(
    n,
    pasos,
    () => n.nivel.puntoDeControl >= 2,
    () => {
      llego ||= n.nivel.balsa("balsa").donde().centro.x > 20.2;
      if (llego) for (const j of [0, 1] as const) n.entradas[j] = n.haciaDonde(j, 22.9, n.pelvis(j).z);
    },
  );
}

/** Desde el punto 5: los dos agarran la batea de sus puntas (cada uno con la mano de adentro) y la llevan derecho
 * hacia +x hasta la mesa; ahí la sueltan. Devuelve lo más que se ladeó. */
function llevarLaBatea(n: Poza, hastaX = 41.72) {
  const batea = n.nivel.batea("batea");
  n.poner(0, 27.95, FONDO, -0.85);
  n.poner(1, 27.95, FONDO, -2.15);
  n.correr(30);
  n.entradas[0] = { ...QUIETO, brazoIzquierdo: true };
  n.entradas[1] = { ...QUIETO, brazoDerecho: true };
  n.correr(40);
  expect(batea.cargadores).toBe(2);
  let peor = 0;
  hasta(
    n,
    1500,
    () => n.pelvis(0).x > hastaX,
    () => {
      n.entradas[0] = { ...n.girarHacia(0, ESTE), brazoIzquierdo: true, avanzar: 1 };
      n.entradas[1] = { ...n.girarHacia(1, ESTE), brazoDerecho: true, avanzar: 1 };
      peor = Math.max(peor, batea.ladeo);
    },
  );
  n.entradas[0] = QUIETO;
  n.entradas[1] = QUIETO;
  n.correr(60);
  return peor;
}

describe("la poza (niveles/02-poza)", () => {
  it("tiene sus piezas, su agua, seis puntos de control y lo que se mueve cabe en la foto de la red", async () => {
    const { plano, mundo, nivel } = await armarPoza();
    expect(plano.numero).toBe(2);
    expect(plano.nombre).toBe("La poza");
    expect(plano.puntos).toHaveLength(7);
    expect(plano.secretos).toHaveLength(1);
    expect(plano.aguas.map((a) => a.nombre).sort()).toEqual([
      "acequia",
      "chorro-compuerta",
      "chorro-escalon",
      "chorro-represa",
      "pie-de-la-represa",
      "poza",
      "quebrada",
      "quebrada-abajo",
      "remanso",
      "rio",
    ]);
    expect(plano.piezas.map((p) => `${p.cual} ${p.nombre}`).sort()).toEqual([
      "balsa balsa",
      "batea batea",
      "palanca palanca",
      "piedra piedra-1",
      "piedra piedra-2",
      "sucia sucia",
      "tendedero tendedero-rojo",
      "tendedero tendedero-turquesa",
      "tronco balsa-1",
      "tronco balsa-2",
      "tronco balsa-3",
    ]);
    expect(nivel.balsa("balsa").estado).toBe("suelta");
    expect(nivel.sucia("sucia").estado).toBe("lavando");
    expect(() => nivel.batea("balsa")).toThrow(/batea «balsa»/);
    const moviles = cuerposMoviles(mundo);
    expect(moviles.length).toBeLessThan(256);
    for (const c of moviles) {
      const p = c.translation();
      expect(Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))).toBeLessThan(64);
    }
  });

  describe("misión 1: amarrar tres troncos para armar la balsa", () => {
    /** Los de `quienes` agarran el tronco de ese carril con la mano derecha (parados a su izquierda) y caminan juntos
     * hacia el astillero hasta que el de adelante llega a `hastaX`; ahí lo sueltan. */
    const llevar = (n: Poza, carril: number, quienes: readonly (0 | 1)[], hastaX = -1.65) => {
      quienes.forEach((j, k) => {
        n.poner(j, -8.7 - k * 1.0, PLAYA, carril - 0.45);
      });
      n.correr(30);
      for (const j of quienes) n.entradas[j] = { ...QUIETO, brazoDerecho: true };
      n.correr(40);
      const adelante = quienes[0] ?? 0;
      hasta(
        n,
        700,
        () => n.pelvis(adelante).x > hastaX,
        () => {
          for (const j of quienes) n.entradas[j] = { ...n.girarHacia(j, ESTE), brazoDerecho: true, avanzar: 1 };
        },
      );
      n.entradas[0] = QUIETO;
      n.entradas[1] = QUIETO;
      n.correr(60);
    };

    it("lo llevan los dos, derecho por su carril, y lo dejan en el astillero", async () => {
      const n = await armarPoza();
      const tronco = n.nivel.tronco("balsa-2");
      llevar(n, 0.4, [0, 1]);
      const t = tronco.cuerpo.translation();
      expect(t.x).toBeGreaterThan(-2.4);
      expect(t.x).toBeLessThan(-0.8);
      expect(t.y).toBeGreaterThan(PLAYA + 0.85);
      expect(tronco.cargadores).toBe(0);
      // Queda ahí (en el astillero no vuelve a sus caballetes)
      n.correr(300);
      expect(tronco.cuerpo.translation().x).toBeGreaterThan(-2.4);
    });

    it("uno solo no lo levanta (9 kg; un muñeco levanta 5): lo arrastra, pero no lo sube al astillero", async () => {
      const n = await armarPoza();
      const tronco = n.nivel.tronco("balsa-1");
      n.poner(1, -13, PLAYA, 2.5);
      // Ni con las dos manos
      n.poner(0, -8.7, PLAYA, -1.1 - 0.45);
      n.correr(30);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(40);
      expect(tronco.cargadores).toBe(1);
      let masAlto = 0;
      hasta(
        n,
        700,
        () => n.pelvis(0).x > -1.65,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 1 };
          masAlto = Math.max(masAlto, tronco.cuerpo.translation().y);
        },
      );
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(tronco.cuerpo.translation().y).toBeLessThan(PLAYA + 0.6);
      expect(n.nivel.balsa("balsa").estado).toBe("suelta");
      // Tirado en la playa, al rato vuelve a sus caballetes
      n.correr(240);
      expect(tronco.cuerpo.translation().x).toBeCloseTo(-9, 1);
      expect(tronco.cuerpo.translation().y).toBeCloseTo(PLAYA + 1, 1);
    });

    it("con los tres en el astillero se amarran, la balsa baja sola al agua y, subiendo a ella, punto 1", async () => {
      const n = await armarPoza();
      const balsa = n.nivel.balsa("balsa");
      const amarres: number[] = [];
      balsa.alAmarrar(() => amarres.push(n.nivel.pasos));
      // Los dos primeros, en el astillero: todavía no
      balsa.troncos.forEach((t, i) => {
        if (i < 2) t.cuerpo.setTranslation({ x: -1.6, y: PLAYA + 1.0, z: [-1.1, 0.4][i] ?? 0 }, true);
      });
      n.correr(120);
      expect(balsa.estado).toBe("suelta");
      // El tercero lo llevan los dos
      llevar(n, 1.9, [0, 1]);
      expect(hasta(n, 400, () => balsa.estado === "amarrada")).toBeGreaterThan(0);
      expect(amarres).toHaveLength(1);
      n.correr(60);
      // Quedó en su lugar, flotando junto al muelle, uno al lado del otro
      expect(balsa.donde().centro.distanceTo(balsa.casa.centro)).toBeLessThan(0.1);
      // Desde el muelle se sube caminando
      expect(n.nivel.puntoDeControl).toBe(0);
      n.poner(0, 5.4, PLAYA, -2.7, 0);
      n.poner(1, -3, PLAYA, -2.7, 0);
      n.correr(10);
      const subio = hasta(
        n,
        200,
        () => n.nivel.puntoDeControl >= 1,
        () => {
          n.entradas[0] = n.haciaDonde(0, 5.4, -1.0);
        },
      );
      expect(subio).toBeGreaterThan(0);
      n.entradas[0] = QUIETO;
      n.correr(30);
      expect(balsa.aBordo).toBe(1);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    });

    it("el tronco que cae al agua sin amarrar vuelve a sus caballetes", async () => {
      const n = await armarPoza();
      const tronco = n.nivel.tronco("balsa-3");
      tronco.cuerpo.setTranslation({ x: 6, y: 0.5, z: 1.5 }, true);
      n.correr(240);
      expect(tronco.cuerpo.translation().x).toBeCloseTo(-9, 1);
    });
  });

  describe("misión 2: remar cada uno por su lado para ir recto", () => {
    it("con los dos remando la balsa sube derecho contra la corriente hasta el embarcadero → punto 2", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(1);
      n.correr(30);
      const balsa = n.nivel.balsa("balsa");
      expect(balsa.aBordo).toBe(2);
      let torcida = 0;
      const llego = remar(n, [0, 1], 3000);
      expect(llego).toBeGreaterThan(0);
      const r = balsa.donde().giro;
      torcida = Math.abs(2 * Math.atan2(r.y, r.w));
      expect(torcida).toBeLessThan(0.3);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    });

    for (const solo of [0, 1] as const) {
      it(`con uno solo remando (el ${solo === 0 ? "rojo" : "turquesa"}) da vueltas y la corriente no lo deja subir`, async () => {
        const n = await armarPoza();
        n.nivel.avance.irA(1);
        n.correr(30);
        const balsa = n.nivel.balsa("balsa");
        let giro = 0;
        let solos = 0;
        let antes = balsa.donde().giro.clone();
        const llego = hasta(
          n,
          2400,
          () => n.nivel.puntoDeControl >= 2,
          () => {
            n.entradas[solo] = { ...QUIETO, ...AMBOS };
            const ahora = balsa.donde().giro;
            giro += antes.angleTo(ahora);
            antes = ahora.clone();
            if (balsa.remeros.filter((r) => r !== null).length === 1) solos++;
          },
        );
        expect(llego).toBe(-1);
        // Remó casi todo el tiempo (con un solo remo)
        expect(solos).toBeGreaterThan(1800);
        // Se torció (un remo solo la hace girar) y no pasó del remanso al río
        expect(giro).toBeGreaterThan(1);
        expect(balsa.donde().centro.x).toBeLessThan(14);
      });
    }

    it("uno solo que va y viene de un remo al otro tampoco sube contra la corriente", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(1);
      n.correr(30);
      const balsa = n.nivel.balsa("balsa");
      // El turquesa se va del río: se baja al muelle antes de que zarpen
      n.poner(1, 3, PLAYA, -2.7);
      let lado = 0;
      const llego = hasta(
        n,
        2400,
        () => n.nivel.puntoDeControl >= 2,
        (i) => {
          // Rema dos segundos de cada lado (cruza la balsa entre medio)
          const fase = Math.floor(i / 150) % 2;
          if (fase !== lado) lado = fase;
          const { centro, giro } = balsa.donde();
          const derecha = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
          const destino = centro.clone().addScaledVector(derecha, lado === 0 ? 0.42 : -0.42);
          const p = n.pelvis(0);
          if (Math.hypot(p.x - destino.x, p.z - destino.z) > 0.15)
            n.entradas[0] = n.haciaDonde(0, destino.x, destino.z);
          else n.entradas[0] = { ...n.girarHacia(0, Math.atan2(derecha.z, -derecha.x)), ...AMBOS };
        },
      );
      expect(llego).toBe(-1);
      expect(balsa.donde().centro.x).toBeLessThan(15);
    });
  });

  describe("misión 3: uno abre la compuerta de la represa mientras el otro pasa", () => {
    /** El rojo empuja la palanca (y la sostiene); devuelve la palanca. */
    const empujarLaPalanca = (n: Poza) => {
      const palanca = n.nivel.palanca("palanca");
      n.poner(0, 22.3, PLAYA, -1.6);
      n.correr(20);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(20);
      hasta(
        n,
        200,
        () => palanca.activa,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 1 };
        },
      );
      return palanca;
    };

    it("de a dos: con la palanca empujada el chorro se corta y el turquesa trepa el escalón y la represa → punto 3", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(2);
      n.poner(1, 23.2, PLAYA, 1.0);
      const palanca = empujarLaPalanca(n);
      expect(palanca.activa).toBe(true);
      n.correr(40);
      expect(n.nivel.agua("chorro-escalon").nivel).toBeCloseTo(PLAYA);
      expect(n.nivel.agua("chorro-represa").nivel).toBeCloseTo(ESCALON);
      expect(n.nivel.agua("chorro-compuerta").nivel).toBeGreaterThan(1);
      expect(treparHaciaElEste(n, 1, 24.2, ESCALON)).toBeGreaterThan(0);
      expect(treparHaciaElEste(n, 1, 25.3, REPRESA)).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(3);
      expect(n.nivel.aguas.caidas).toEqual([0, 0]);
      // Pasado el punto 3 la compuerta queda abierta: el de la palanca suelta y sube también
      n.entradas[0] = QUIETO;
      n.correr(60);
      expect(n.nivel.agua("chorro-escalon").nivel).toBeCloseTo(PLAYA);
    });

    it("solo no se puede: al soltar la palanca el chorro vuelve antes de que llegue, y se lo lleva", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(2);
      n.poner(1, 22.4, PLAYA, 2.8);
      const palanca = empujarLaPalanca(n);
      expect(palanca.activa).toBe(true);
      n.correr(30);
      // Suelta, corre al escalón (al lado de la palanca) y trepa
      n.entradas[0] = QUIETO;
      hasta(
        n,
        200,
        () => n.pelvis(0).z > 0.8,
        () => {
          n.entradas[0] = n.haciaDonde(0, 23.3, 1.0);
        },
      );
      const subio = treparHaciaElEste(n, 0, 24.2, ESCALON);
      expect(subio).toBe(-1);
      expect(n.nivel.aguas.caidas[0]).toBeGreaterThan(0);
      expect(n.nivel.puntoDeControl).toBe(2);
    });
  });

  it("misión 4: cada uno baja colgado de su tendedero, como en tirolesa, hasta la isla → punto 4", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(3);
    const cuerdas = [n.nivel.tendedero("tendedero-rojo"), n.nivel.tendedero("tendedero-turquesa")] as const;
    n.poner(0, 26.15, REPRESA, 0.45);
    n.poner(1, 26.15, REPRESA, -0.45);
    n.correr(20);
    for (const j of [0, 1] as const) {
      const t = cuerdas[j];
      n.entradas[j] = { ...QUIETO, ...AMBOS };
      let colgo = false;
      const llego = hasta(
        n,
        700,
        () => n.munecos[j].estado === "de pie" && n.pelvis(j).x > 35.6,
        () => {
          colgo ||= t.colgados > 0;
          if (t.recorrido > 0.99) n.entradas[j] = QUIETO;
        },
      );
      expect(colgo, `el ${j} se colgó`).toBe(true);
      expect(llego, `el ${j} llegó a la isla`).toBeGreaterThan(0);
      expect(n.pelvis(j).y).toBeGreaterThan(ISLA + 0.3);
    }
    expect(n.nivel.puntoDeControl).toBe(4);
    expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    // Sin nadie, las poleas vuelven solas arriba
    n.correr(600);
    for (const t of cuerdas) expect(t.recorrido).toBe(0);
  });

  it("misión 4: el que se suelta a medio camino cae a la poza y reaparece", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(3);
    const t = n.nivel.tendedero("tendedero-rojo");
    n.poner(0, 26.15, REPRESA, 0.45);
    n.poner(1, 25.8, REPRESA, 2.4);
    n.correr(20);
    n.entradas[0] = { ...QUIETO, ...AMBOS };
    hasta(n, 400, () => t.recorrido > 0.4);
    n.entradas[0] = QUIETO;
    hasta(n, 200, () => n.nivel.aguas.caidas[0] > 0);
    expect(n.nivel.aguas.caidas[0]).toBe(1);
    // Reapareció arriba, junto al turquesa
    n.correr(5);
    expect(n.pelvis(0).y).toBeGreaterThan(REPRESA);
  });

  it("misión 5: con las dos piedras en la boca el agua se va por la acequia, la poza se seca y se baja → punto 5", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(4);
    n.poner(1, 37.0, ISLA, -2.6);
    const poza = n.nivel.agua("poza");
    const acequia = n.nivel.agua("acequia");
    expect(acequia.nivel).toBeCloseTo(acequia.fondo);
    // Con una sola la boca no se tapa
    n.poner(0, 38.6, ISLA, -1.35, 0);
    n.correr(20);
    expect(empujar(n, 0, n.nivel.piedra("piedra-1").cuerpo, 38.7, 1.9)).toBeGreaterThan(0);
    n.entradas[0] = QUIETO;
    n.correr(180);
    expect(poza.nivel).toBeCloseTo(poza.lleno);
    n.poner(0, 39.6, ISLA, -2.55, 0);
    n.correr(20);
    expect(empujar(n, 0, n.nivel.piedra("piedra-2").cuerpo, 39.5, 1.9)).toBeGreaterThan(0);
    n.entradas[0] = QUIETO;
    expect(hasta(n, 600, () => poza.nivel <= poza.fondo)).toBeGreaterThan(0);
    expect(n.nivel.agua("quebrada-abajo").nivel).toBeCloseTo(n.nivel.agua("quebrada-abajo").fondo);
    n.correr(120);
    expect(acequia.nivel).toBeCloseTo(acequia.lleno);
    expect(n.nivel.aguas.caidas).toEqual([0, 0]);
    // Por el fondo de la poza, en rampa, se baja caminando hasta lo hondo
    const bajo = hasta(
      n,
      900,
      () => n.nivel.puntoDeControl >= 5,
      () => {
        n.entradas[0] = n.haciaDonde(0, 28.0, -0.5);
      },
    );
    expect(bajo).toBeGreaterThan(0);
  });

  it("misión 5: con la poza llena, bajar por la rampa es caer al agua", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(4);
    n.poner(0, 36.0, ISLA, -0.5, -ESTE);
    n.correr(10);
    hasta(
      n,
      400,
      () => n.nivel.aguas.caidas[0] > 0,
      () => {
        n.entradas[0] = n.haciaDonde(0, 28.0, -0.5);
      },
    );
    expect(n.nivel.aguas.caidas[0]).toBe(1);
    expect(n.nivel.puntoDeControl).toBe(4);
  });

  describe("misión 6: llevar la batea llena de pepitas hasta la orilla sin botarla", () => {
    it("de a dos: la suben por la rampa y la dejan en la mesa, llena; aparece la meta → punto 6 y el logro «Secos»", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(5);
      const batea = n.nivel.batea("batea");
      const peor = llevarLaBatea(n);
      expect(peor).toBeLessThan((30 * Math.PI) / 180);
      expect(batea.botadas).toBe(0);
      expect(batea.llena).toBe(true);
      const t = batea.cuerpo.translation();
      expect(t.y).toBeGreaterThan(ISLA + 0.85);
      expect(n.nivel.puntoDeControl).toBe(6);
      expect(n.nivel.logro).toBe(true);
    });

    it("solo no se puede: agarrada por uno se ladea, se bota y vuelve llena a su lugar", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(5);
      const batea = n.nivel.batea("batea");
      n.poner(0, 27.95, FONDO, -0.85);
      n.poner(1, 30.5, FONDO, 1.5);
      n.correr(30);
      n.entradas[0] = { ...QUIETO, ...AMBOS };
      n.correr(40);
      expect(batea.cargadores).toBe(1);
      hasta(
        n,
        300,
        () => !batea.llena,
        () => {
          n.entradas[0] = { ...n.girarHacia(0, ESTE), ...AMBOS, avanzar: 1 };
        },
      );
      expect(batea.llena).toBe(false);
      expect(batea.botadas).toBe(1);
      n.entradas[0] = QUIETO;
      n.correr(200);
      expect(batea.llena).toBe(true);
      expect(batea.cuerpo.translation().x).toBeCloseTo(28.25, 1);
    });

    it("sin la batea en la mesa no hay meta: los dos llegan a la orilla y no pasa nada", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(5);
      n.poner(0, 41.6, ISLA, -0.9);
      n.poner(1, 41.6, ISLA, -2.1);
      n.correr(60);
      expect(n.nivel.puntoDeControl).toBe(5);
    });

    it("La Sucia lava y, al terminar, al que está en su lavadero le tira agua: lo empuja hacia afuera", async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(5);
      const sucia = n.nivel.sucia("sucia");
      const mojados: number[] = [];
      sucia.alSalpicar((j) => mojados.push(j));
      n.poner(1, 42.2, ISLA, -0.4, ESTE);
      n.correr(20);
      expect(sucia.estado).toBe("lavando");
      const x0 = n.pelvis(1).x;
      let apunto = false;
      hasta(
        n,
        400,
        () => mojados.length > 0,
        () => {
          apunto ||= sucia.estado === "apuntando" && sucia.apunta === 1;
        },
      );
      expect(apunto).toBe(true);
      expect(mojados).toEqual([1]);
      let cayo = false;
      n.correr(30, () => {
        cayo ||= n.munecos[1].estado === "caido";
      });
      // El guacalazo lo tumba y lo saca hacia afuera (lejos de ella, hacia −x)
      expect(cayo).toBe(true);
      expect(n.pelvis(1).x).toBeLessThan(x0 - 0.4);
      // Lejos de su lavadero, no le tira a nadie
      n.poner(1, 37.0, ISLA, -1, ESTE);
      n.correr(600);
      expect(sucia.salpicadas).toBe(1);
      expect(sucia.estado).toBe("lavando");
    });
  });

  it("«Secos» se pierde si alguno cayó al agua en el camino", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(5);
    // El turquesa se cae a la quebrada y reaparece
    n.poner(1, 41, 1.0, 2.0);
    n.correr(5);
    expect(n.nivel.aguas.caidas[1]).toBe(1);
    llevarLaBatea(n);
    expect(n.nivel.puntoDeControl).toBe(6);
    expect(n.nivel.logro).toBe(false);
  });

  it("el secreto: con la poza seca, la pepita de oro en el hoyo de lo más hondo", async () => {
    const n = await armarPoza();
    n.nivel.avance.irA(5);
    expect(n.nivel.secreto).toBe(false);
    n.poner(0, 28.1, FONDO, 1.4, 0);
    n.correr(10);
    const encontro = hasta(
      n,
      200,
      () => n.nivel.secreto,
      () => {
        n.entradas[0] = n.haciaDonde(0, 28.1, 2.3);
      },
    );
    expect(encontro).toBeGreaterThan(0);
  });

  it("es determinista: dos corridas iguales, remando y con La Sucia tirando agua, dan lo mismo", async () => {
    const correrUna = async () => {
      const n = await armarPoza();
      n.nivel.avance.irA(1);
      n.correr(300, () => {
        n.entradas[0] = { ...QUIETO, ...AMBOS };
        n.entradas[1] = { ...QUIETO, ...AMBOS };
      });
      const todo: number[] = [];
      n.mundo.forEachRigidBody((c) => {
        const p = c.translation();
        todo.push(p.x, p.y, p.z);
      });
      return todo;
    };
    expect(await correrUna()).toEqual(await correrUna());
  });

  it("en línea: con la foto del anfitrión, el invitado ubica la balsa, las poleas, La Sucia, la batea y el agua", async () => {
    const anfitrion = await armarPoza();
    const invitado = await armarPoza();
    // El anfitrión: la balsa amarrada y remando, una polea a medio camino, La Sucia tirando agua y la poza bajando
    anfitrion.nivel.avance.irA(1);
    anfitrion.nivel.tendedero("tendedero-rojo").polea.setTranslation({ x: 30, y: 4, z: 0.45 }, true);
    anfitrion.nivel.agua("poza").irA(0.4, 1);
    anfitrion.poner(1, 42.2, ISLA, -0.4);
    anfitrion.correr(260, () => {
      anfitrion.entradas[0] = { ...QUIETO, ...AMBOS };
    });
    expect(anfitrion.nivel.balsa("balsa").estado).toBe("amarrada");

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
    invitado.armado.guardar();
    invitado.armado.dibujar(1, 0);
    const posicion = (c: RAPIER.RigidBody) => new THREE.Vector3().copy(c.translation());
    for (const nombre of ["balsa-1", "balsa-2", "balsa-3", "tendedero-rojo", "sucia", "batea", "piedra-1"]) {
      const real = anfitrion.nivel.pieza(nombre).cuerpo;
      const alla = invitado.nivel.pieza(nombre);
      if (!real || !alla.cuerpo) throw new Error(`«${nombre}» no se mueve`);
      expect(posicion(alla.cuerpo).distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
      expect(alla.objeto.position.distanceTo(posicion(real)), nombre).toBeLessThan(0.003);
    }
    // El guacal de La Sucia también viaja (lo lleva en las manos)
    const guacal = (n: Poza) => posicion(n.nivel.sucia("sucia").guacal);
    expect(guacal(invitado).distanceTo(guacal(anfitrion))).toBeLessThan(0.003);
    // Y el agua: el invitado dibuja la poza donde la dejó el anfitrión, y ve la balsa amarrada (las amarras)
    const espejo = invitado.armado.escena.getObjectByName("agua poza")?.children[0];
    expect(espejo?.position.y).toBeCloseTo(anfitrion.nivel.agua("poza").nivel, 2);
    expect(invitado.armado.escena.getObjectByName("balsa amarras")?.visible).toBe(true);
  });
});
