// El guion del nivel 2, La poza (TU-24). Lo que la escena no puede decir:
//   · El punto 1 va en la balsa: aparece cuando se amarra y viaja con ella (el que se cae al río reaparece a bordo).
//     La balsa vacía que quedó lejos del muelle vuelve sola a su lugar (antes del punto 2).
//   · Con los tres troncos sobre el astillero (los caballetes de la orilla) se amarran y la balsa baja sola al agua,
//     junto al muelle. Los troncos tirados en la playa o caídos al agua vuelven a sus caballetes.
//   · La compuerta (mecanismos/compuerta.ts) sube mientras alguien empuja la palanca y corta el chorro que cae sobre
//     el escalón y la represa; pasado el punto 3 queda abierta.
//   · Con las dos piedras en la boca, el agua se va por la acequia: la poza y la quebrada de abajo se secan.
//   · La meta (punto 6) aparece cuando la batea llena queda en la mesa de la orilla.
//   · El logro, «Secos»: llegar a la meta sin que ninguno haya caído al agua.
//   · La pepita de oro del secreto (la zona `secreto` del .glb la encuentra sola) se dibuja acá, en el hoyo.
// Lo que cae al vacío vuelve solo a su lugar (lo hacen las piezas), y la batea botada, al rato, llena.
import type { Lugar, PuntoDeControl } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { type Compuerta, crearCompuerta } from "../../apps/juego/src/niveles/mecanismos/compuerta";
import { crearPepita } from "../../apps/juego/src/niveles/piezas-poza";

/** Las alturas, como en scripts/niveles/poza.mjs. */
const PLAYA = 0.3;
const ISLA = 1.9;
/** El astillero: los caballetes junto al agua donde se dejan los tres troncos (dónde quedan sus centros) y donde se
 * amarran (el centro de la balsa ahí). */
const ASTILLERO = {
  x: [-2.4, -0.8],
  y: [PLAYA + 0.85, PLAYA + 1.2],
  centro: { x: -1.6, y: PLAYA + 1.0, z: 0.4 },
} as const;
/** La boca: donde tienen que quedar las dos piedras (en el hondo entre la isla y el peñón). */
const BOCA = { x: [37.9, 40.3], z: [1.1, 2.6], y: 1.4 } as const;
/** La mesa de la orilla, donde se deja la batea (su cara de arriba). */
const MESA = { x: [41.9, 42.9], z: [-2.5, -0.5], arriba: ISLA + 0.85 } as const;
/** Donde quedan las piedras en la boca (al retomar más allá del punto 5). */
const EN_LA_BOCA = [
  { x: 38.5, y: 1.05, z: 1.95 },
  { x: 39.4, y: 1.05, z: 1.75 },
] as const;
/** Cuánto tarda en vaciarse (m/s) lo que se seca al tapar la boca y en llenarse la acequia. */
const SECAR = 0.4;
/** La balsa vacía, a más de esto de su lugar (m) y tantos pasos sin nadie, vuelve. Un tronco tirado, tantos pasos. */
const BALSA = { lejos: 1.5, pasos: 480 };
const TRONCO = { pasos: 180, pasosEnElAgua: 90 };
/** La pepita de oro, en el hoyo. */
const PEPITA = { x: 28.1, y: -0.3 + 0.05, z: 2.3 };
/** Donde se esconden las zonas de los puntos que todavía no se pueden alcanzar. */
const ESCONDIDA = -100;

/** Una zona y sus lugares, guardados para ponerlos de nuevo (o llevarlos con la balsa). */
type Vector = Lugar["posicion"];
type Giro = NonNullable<PuntoDeControl["zona"]>["giro"];
interface Punto {
  readonly centro: Vector;
  readonly lugares: readonly Vector[];
  /** El giro de la zona (relativo a la balsa, para el punto 1). */
  readonly giro?: Giro;
}

export function crearGuion(): GuionDeNivel {
  let compuerta: Compuerta | undefined;
  /** El punto 1 (en la balsa): su zona y sus lugares en el marco de la balsa amarrada en su lugar. */
  let enLaBalsa: Punto | undefined;
  let meta: Punto | undefined;
  let entregada = false;
  let desviada = false;
  let mojado = false;
  let balsaSola = 0;
  const troncosTirados = new Map<string, number>();

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`La poza: falta el punto ${n}`);
    return p;
  };
  /** Esconde la zona del punto (no se alcanza) o la pone donde estaba. */
  const esconder = (nivel: NivelEnJuego, n: number, guardado: Punto | undefined, ya: boolean) => {
    const zona = punto(nivel, n).zona;
    if (!zona || !guardado) return;
    zona.centro.copy(guardado.centro);
    if (!ya) zona.centro.y = ESCONDIDA;
  };

  /** Lleva el punto 1 con la balsa (zona y lugares). */
  const llevarPunto = (nivel: NivelEnJuego) => {
    const balsa = nivel.balsa("balsa");
    const p = punto(nivel, 1);
    if (!enLaBalsa || !p.zona) return;
    if (balsa.estado !== "amarrada") {
      p.zona.centro.y = ESCONDIDA;
      return;
    }
    const { centro, giro } = balsa.donde();
    p.zona.centro.copy(enLaBalsa.centro).applyQuaternion(giro).add(centro);
    if (enLaBalsa.giro) p.zona.giro.copy(giro).multiply(enLaBalsa.giro);
    p.lugares.forEach((l, i) => {
      const de = enLaBalsa?.lugares[i];
      if (de) l.posicion.copy(de).applyQuaternion(giro).add(centro);
    });
  };

  /** Tapa la boca: la poza y la quebrada de abajo se secan y se llena la acequia. */
  const desviar = (nivel: NivelEnJuego, ya: boolean) => {
    desviada = true;
    for (const n of ["poza", "quebrada-abajo"]) {
      const a = nivel.agua(n);
      a.irA(a.fondo, ya ? undefined : SECAR);
    }
    const acequia = nivel.agua("acequia");
    acequia.irA(acequia.lleno, ya ? undefined : SECAR);
  };
  /** Si las dos piedras quedaron en la boca. */
  const bocaTapada = (nivel: NivelEnJuego) =>
    ["piedra-1", "piedra-2"].every((n) => {
      const t = nivel.piedra(n).cuerpo.translation();
      return t.x > BOCA.x[0] && t.x < BOCA.x[1] && t.z > BOCA.z[0] && t.z < BOCA.z[1] && t.y < BOCA.y;
    });

  /** Si la batea llena quedó sobre la mesa, suelta. */
  const enLaMesa = (nivel: NivelEnJuego) => {
    const batea = nivel.batea("batea");
    const t = batea.cuerpo.translation();
    return (
      batea.llena &&
      batea.cargadores === 0 &&
      t.x > MESA.x[0] &&
      t.x < MESA.x[1] &&
      t.z > MESA.z[0] &&
      t.z < MESA.z[1] &&
      t.y > MESA.arriba &&
      t.y < MESA.arriba + 0.4
    );
  };

  return {
    alEmpezar(nivel) {
      compuerta = crearCompuerta(nivel, {
        hoja: "compuerta",
        palanca: "palanca",
        sube: 1.1,
        pasos: 30,
        bajar: 12,
        corta: ["chorro-escalon", "chorro-represa"],
        larga: ["chorro-compuerta"],
      });
      const acequia = nivel.agua("acequia");
      acequia.irA(acequia.fondo);
      // El punto 1, en el marco de la balsa amarrada en su lugar; el 6, hasta que dejen la batea en la mesa
      const balsa = nivel.balsa("balsa");
      const uno = punto(nivel, 1);
      const inversa = balsa.casa.giro.clone().invert();
      const relativo = (v: Vector) => v.clone().sub(balsa.casa.centro).applyQuaternion(inversa);
      enLaBalsa = {
        centro: relativo(uno.zona?.centro ?? balsa.casa.centro),
        lugares: uno.lugares.map((l) => relativo(l.posicion)),
        ...(uno.zona ? { giro: inversa.clone().multiply(uno.zona.giro) } : {}),
      };
      const seis = punto(nivel, 6);
      meta = seis.zona ? { centro: seis.zona.centro.clone(), lugares: [] } : undefined;
      esconder(nivel, 1, enLaBalsa, false);
      esconder(nivel, 6, meta, false);
      nivel.aguas.alMojar(() => {
        mojado = true;
      });
      // La pepita de oro del secreto, en el hoyo: clara, como los ojos (el único color son los pañuelos)
      const pepita = crearPepita();
      pepita.position.set(PEPITA.x, PEPITA.y, PEPITA.z);
      nivel.escena.add(pepita);
    },
    alAlcanzar(n, nivel) {
      // Pasado el punto 3 la compuerta queda abierta: el que la sostenía también sube
      if (n === 3) compuerta?.abrir();
      // Llegaron a la meta sin que ninguno cayera al agua
      if (n === 6 && !mojado) nivel.lograr();
    },
    alRetomar(n, nivel) {
      if (n >= 1) nivel.balsa("balsa").amarrar(true);
      if (n >= 3) compuerta?.abrir(true);
      if (n >= 5 && !desviada) {
        ["piedra-1", "piedra-2"].forEach((nombre, i) => {
          const c = nivel.piedra(nombre).cuerpo;
          const donde = EN_LA_BOCA[i];
          if (donde) c.setTranslation(donde, true);
        });
        desviar(nivel, true);
      }
      if (n >= 6) {
        entregada = true;
        esconder(nivel, 6, meta, true);
      }
      llevarPunto(nivel);
      nivel.sucia("sucia").volver();
    },
    cadaPaso(nivel) {
      compuerta?.pasar();
      const balsa = nivel.balsa("balsa");
      llevarPunto(nivel);

      // La balsa vacía, lejos del muelle, vuelve sola (antes de llegar al embarcadero)
      if (balsa.estado === "amarrada" && nivel.puntoDeControl < 2) {
        const { centro } = balsa.donde();
        const lejos = Math.hypot(centro.x - balsa.casa.centro.x, centro.z - balsa.casa.centro.z) > BALSA.lejos;
        balsaSola = balsa.aBordo === 0 && lejos ? balsaSola + 1 : 0;
        if (balsaSola > BALSA.pasos) {
          balsa.volver();
          balsaSola = 0;
        }
      }
      if (balsa.estado === "suelta") {
        // Con los tres troncos en el astillero (sueltos y quietos), se amarran y la balsa baja al agua
        const enElAstillero = balsa.troncos.every((tronco) => {
          const t = tronco.cuerpo.translation();
          const v = tronco.cuerpo.linvel();
          return (
            tronco.cargadores === 0 &&
            t.x > ASTILLERO.x[0] &&
            t.x < ASTILLERO.x[1] &&
            t.y > ASTILLERO.y[0] &&
            t.y < ASTILLERO.y[1] &&
            Math.hypot(v.x, v.y, v.z) < 0.1
          );
        });
        if (enElAstillero) balsa.amarrar(false, ASTILLERO.centro);
      }
      // Los troncos tirados en la playa (sin nadie, quietos) o caídos al agua vuelven a sus caballetes: del suelo no
      // se los puede levantar, y del agua no se los puede sacar
      if (balsa.estado === "suelta") {
        for (const tronco of balsa.troncos) {
          const t = tronco.cuerpo.translation();
          const v = tronco.cuerpo.linvel();
          const mojado = nivel.aguas.en({ x: t.x, y: t.y - 0.2, z: t.z }) !== undefined;
          const tirado = tronco.cargadores === 0 && (mojado || (t.y < PLAYA + 0.6 && Math.hypot(v.x, v.y, v.z) < 0.05));
          const pasos = tirado ? (troncosTirados.get(tronco.nombre) ?? 0) + 1 : 0;
          troncosTirados.set(tronco.nombre, pasos);
          if (pasos > (mojado ? TRONCO.pasosEnElAgua : TRONCO.pasos)) {
            tronco.volver();
            troncosTirados.set(tronco.nombre, 0);
          }
        }
      }
      // Las dos piedras en la boca: el agua se va por la acequia
      if (!desviada && bocaTapada(nivel)) desviar(nivel, false);
      // La batea en la mesa: aparece la meta
      if (!entregada && enLaMesa(nivel)) {
        entregada = true;
        esconder(nivel, 6, meta, true);
      }
    },
  };
}
