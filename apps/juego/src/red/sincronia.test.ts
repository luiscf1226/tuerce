// La sincronía de punta a punta en Node, sin navegador: dos mundos de Rapier (anfitrión e invitado) con la escena
// `dos`, unidos por un enlace de mentira con 75 ms de ida, ±20 ms de temblor y 2 % de pérdida. El invitado maneja
// su muñeco con un guion de 5 segundos.
import type RAPIER from "@dimforge/rapier3d-compat";
import { describe, expect, it } from "vitest";
import { type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import { crearEscenaDos } from "../escenas/dos";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import { crearMundo } from "../motor/fisica";
import type { Datos } from "./marco";
import {
  escribirAviso,
  escribirEntradas,
  escribirFoto,
  leerFoto,
  REDUNDANCIA,
  TIPO_FOTO,
  TIPO_MUNDO,
  TIPO_PEDIR_MUNDO,
  TIPO_SIN_MUNDO,
  tipoDe,
} from "./paquetes";
import {
  crearSincronia,
  cuerposMoviles,
  type Enlace,
  ESPERA_MUNDO,
  type OpcionesSincronia,
  REPEDIR_MUNDO,
  type Sincronia,
} from "./sincronia";

interface Red {
  anfitrion: Enlace;
  invitado: Enlace;
  /** Avanza el reloj y entrega lo que ya llegó. */
  avanzar(ms: number): void;
  enviados: number;
  perdidos: number;
}

/** Dos puntas de un canal sin orden ni reenvíos, con latencia, temblor y pérdida. */
function crearRed({ latencia = 75, temblor = 20, perdida = 0.02, semilla = 7 } = {}): Red {
  const azar = crearAzar(semilla);
  let ahora = 0;
  const enCamino: { llega: number; datos: ArrayBuffer; para: Set<(d: Datos) => void> }[] = [];
  const oyentes = { anfitrion: new Set<(d: Datos) => void>(), invitado: new Set<(d: Datos) => void>() };
  const red: Red = {
    enviados: 0,
    perdidos: 0,
    anfitrion: punta("invitado", oyentes.anfitrion),
    invitado: punta("anfitrion", oyentes.invitado),
    avanzar(ms) {
      ahora += ms;
      enCamino.sort((a, b) => a.llega - b.llega);
      while (enCamino[0] && enCamino[0].llega <= ahora) {
        const m = enCamino.shift();
        for (const o of m?.para ?? []) if (m) o(m.datos);
      }
    },
  };
  function punta(otro: keyof typeof oyentes, propios: Set<(d: Datos) => void>): Enlace {
    return {
      enviar(datos) {
        red.enviados++;
        if (azar() < perdida) {
          red.perdidos++;
          return;
        }
        enCamino.push({
          llega: ahora + latencia + (azar() * 2 - 1) * temblor,
          datos: datos.slice(0),
          para: oyentes[otro],
        });
      },
      alRecibir(oyente) {
        propios.add(oyente);
        return () => propios.delete(oyente);
      },
    };
  }
  return red;
}

const entrada = (avanzar: number, girar = 0, extra: Partial<EntradaJugador> = {}): EntradaJugador => ({
  ...entradaQuieta(),
  avanzar,
  girar,
  ...extra,
});

/** El guion del invitado: anda girando, frena, vuelve a andar girando al otro lado y salta. */
function guion(paso: number): EntradaJugador {
  const s = paso * PASO;
  if (s < 1.5) return entrada(1, 0.3);
  if (s < 2.5) return entrada(0);
  if (s < 4) return entrada(1, -0.6);
  return entrada(0.5, 0, { saltar: s > 4.2 && s < 4.3 });
}
/** El anfitrión camina para el otro lado (no se cruzan) y de paso empuja el huacal chico. */
const DEL_ANFITRION = entrada(1, -0.25);

type Instantanea = { paso: number; ack: number; posiciones: Float32Array };
const fotoDe = (cuerpos: RAPIER.RigidBody[], paso: number, ack: number): Instantanea => {
  const posiciones = new Float32Array(cuerpos.length * 3);
  cuerpos.forEach((c, i) => {
    const p = c.translation();
    posiciones.set([p.x, p.y, p.z], 3 * i);
  });
  return { paso, ack, posiciones };
};
const distancia = (a: Float32Array, i: number, b: Float32Array, j = i, soloSuelo = false) =>
  Math.hypot(
    (a[3 * i] ?? 0) - (b[3 * j] ?? 0),
    soloSuelo ? 0 : (a[3 * i + 1] ?? 0) - (b[3 * j + 1] ?? 0),
    (a[3 * i + 2] ?? 0) - (b[3 * j + 2] ?? 0),
  );

describe("sincronía con 75 ms de ida, temblor y 2 % de pérdida", () => {
  it("el invitado ve lo mismo que el anfitrión y su muñeco hace lo que pide", async () => {
    const red = crearRed();
    const a = await crearMundo();
    const b = await crearMundo();
    let anfitrion: Sincronia | undefined;
    let invitado: Sincronia | undefined;
    let pasoInvitado = 0;
    const escenaA = crearEscenaDos(a.rapier, a.mundo, new URLSearchParams(), () =>
      anfitrion ? anfitrion.paso(DEL_ANFITRION) : null,
    );
    const escenaB = crearEscenaDos(b.rapier, b.mundo, new URLSearchParams(), () =>
      invitado ? invitado.paso(guion(pasoInvitado++)) : null,
    );
    anfitrion = crearSincronia({ rol: "anfitrion", enlace: red.anfitrion, mundo: a.mundo, munecos: escenaA.munecos });
    invitado = crearSincronia({ rol: "invitado", enlace: red.invitado, mundo: b.mundo, munecos: escenaB.munecos });
    const cuerposA = cuerposMoviles(a.mundo);
    const cuerposB = cuerposMoviles(b.mundo);
    expect(cuerposA.length).toBe(21);
    const pelvisB = cuerposB.indexOf(escenaB.munecos[1].partes.pelvis);
    const pelvisA = cuerposA.indexOf(escenaA.munecos[1].partes.pelvis);
    expect(pelvisA).toBe(pelvisB);

    // Antes de jugar, el anfitrión le pregunta al invitado si tiene un mundo de antes: no tiene (es nuevo). Esta red
    // pierde paquetes aunque sean fiables, así que puede hacer falta preguntar dos veces.
    for (let i = 0; anfitrion.mundo === "esperando"; i++) {
      expect(i).toBeLessThan(2 * REPEDIR_MUNDO);
      escenaA.pasar();
      anfitrion.despues();
      red.avanzar(1000 / 60); // la respuesta llega al final: la historia empieza en el primer paso simulado
    }
    expect(anfitrion.mundo).toBe("propio");
    expect(anfitrion.medidas.fotos).toBe(0);

    // La historia del anfitrión, paso a paso, para comparar con lo que dibuja el invitado
    const historia: Instantanea[] = [fotoDe(cuerposA, 0, 0)];
    const dibujado: { paso: number; seq: number; posiciones: Float32Array; crudas: Float32Array }[] = [];
    const PASOS = 5 * 60;
    for (let i = 0; i < PASOS; i++) {
      red.avanzar(1000 / 60);
      escenaA.pasar();
      anfitrion.despues();
      historia.push(fotoDe(cuerposA, i + 1, anfitrion.medidas.ack));
      escenaB.pasar();
      const m = invitado.muestra;
      if (m)
        dibujado.push({
          paso: m.paso,
          seq: pasoInvitado,
          posiciones: fotoDe(cuerposB, 0, 0).posiciones,
          crudas: m.posiciones.slice(),
        });
    }

    // Lo que mide la foto
    console.log(
      `  foto de ${anfitrion.medidas.bytesFoto} bytes, ${anfitrion.medidas.fotos} fotos; paquete de entradas de ${6 + 3 * REDUNDANCIA} bytes; ` +
        `perdidos ${red.perdidos}/${red.enviados}; repetidas ${anfitrion.medidas.repetidas}, saltadas ${anfitrion.medidas.saltadas}, ` +
        `invitado esperando ${invitado.medidas.esperando} pasos`,
    );
    expect(anfitrion.medidas.bytesFoto).toBe(239);
    expect(red.perdidos).toBeGreaterThan(0);

    /** El estado del anfitrión en un paso con fracción. */
    const anfitrionEn = (paso: number, cuerpo: number, salida: number[]) => {
      const i = Math.floor(paso);
      const t = paso - i;
      const p0 = historia[i]?.posiciones;
      const p1 = historia[Math.min(i + 1, historia.length - 1)]?.posiciones;
      for (let k = 0; k < 3; k++) salida[k] = (p0?.[3 * cuerpo + k] ?? 0) * (1 - t) + (p1?.[3 * cuerpo + k] ?? 0) * t;
      return salida;
    };

    // 1. Todo lo que dibuja el invitado (sin la predicción) coincide con el anfitrión en el mismo paso
    const tras = dibujado.filter((d) => d.paso > 30);
    let peor = 0;
    let suma = 0;
    let medidos = 0;
    const p = [0, 0, 0];
    for (const d of tras) {
      for (let c = 0; c < cuerposA.length; c++) {
        anfitrionEn(d.paso, c, p);
        const error = Math.hypot(
          (d.crudas[3 * c] ?? 0) - (p[0] ?? 0),
          (d.crudas[3 * c + 1] ?? 0) - (p[1] ?? 0),
          (d.crudas[3 * c + 2] ?? 0) - (p[2] ?? 0),
        );
        peor = Math.max(peor, error);
        suma += error;
        medidos++;
      }
    }
    const medio = suma / medidos;
    // 2. El muñeco propio, con la predicción, contra dónde estuvo de verdad cuando el anfitrión usó esa entrada
    let errorPredicho = 0;
    let errorSinPredecir = 0;
    let peorPredicho = 0;
    let cuantos = 0;
    for (const d of tras) {
      const llego = historia.find((h) => h.ack >= d.seq);
      if (!llego) continue;
      errorPredicho += distancia(d.posiciones, pelvisB, llego.posiciones, pelvisA, true);
      peorPredicho = Math.max(peorPredicho, distancia(d.posiciones, pelvisB, llego.posiciones, pelvisA, true));
      errorSinPredecir += distancia(d.crudas, pelvisB, llego.posiciones, pelvisA, true);
      cuantos++;
    }
    errorPredicho /= cuantos;
    errorSinPredecir /= cuantos;
    // 3. Sin saltos: lo que más se mueve la pelvis propia dibujada de un paso al otro, contra lo del anfitrión
    let saltoInvitado = 0;
    let saltoAnfitrion = 0;
    for (let i = 1; i < tras.length; i++) {
      const antes = tras[i - 1];
      const ahora = tras[i];
      if (antes && ahora)
        saltoInvitado = Math.max(saltoInvitado, distancia(ahora.posiciones, pelvisB, antes.posiciones));
    }
    for (let i = 1; i < historia.length; i++) {
      const antes = historia[i - 1];
      const ahora = historia[i];
      if (antes && ahora)
        saltoAnfitrion = Math.max(saltoAnfitrion, distancia(ahora.posiciones, pelvisA, antes.posiciones));
    }
    const ultimo = dibujado[dibujado.length - 1];
    const atraso = PASOS - (ultimo?.paso ?? 0);
    console.log(
      `  error de lo dibujado ${(medio * 100).toFixed(2)} cm en promedio, ${(peor * 100).toFixed(2)} cm el peor; dibuja ${atraso.toFixed(1)} pasos atrás; ` +
        `muñeco propio: ${(errorPredicho * 100).toFixed(1)} cm con predicción (peor ${(peorPredicho * 100).toFixed(1)}) ` +
        `contra ${(errorSinPredecir * 100).toFixed(1)} cm sin ella; mayor paso dibujado ${(saltoInvitado * 100).toFixed(1)} cm ` +
        `(anfitrión ${(saltoAnfitrion * 100).toFixed(1)} cm)`,
    );
    expect(medio).toBeLessThan(0.005);
    expect(peor).toBeLessThan(0.05);
    expect(atraso).toBeLessThan(15);
    expect(errorPredicho).toBeLessThan(errorSinPredecir / 2);
    expect(errorPredicho).toBeLessThan(0.1);
    expect(saltoInvitado).toBeLessThan(saltoAnfitrion * 1.5 + 0.01);

    // 4. El muñeco del invitado (en el mundo del anfitrión) hizo lo que pidió el guion: lo mismo que en un mundo
    // sin red con las mismas entradas
    const solo = await crearMundo();
    let pasoSolo = 0;
    const referencia = crearEscenaDos(solo.rapier, solo.mundo, new URLSearchParams(), () => [
      DEL_ANFITRION,
      guion(pasoSolo++),
    ]);
    const usadas = anfitrion.medidas.ack;
    for (let i = 0; i < usadas; i++) referencia.pasar();
    const final = escenaA.munecos[1].partes.pelvis.translation();
    const esperado = referencia.munecos[1].partes.pelvis.translation();
    const inicio = historia[0]?.posiciones;
    const recorrido = Math.hypot(final.x - (inicio?.[3 * pelvisA] ?? 0), final.z - (inicio?.[3 * pelvisA + 2] ?? 0));
    const diferencia = Math.hypot(final.x - esperado.x, final.z - esperado.z);
    console.log(
      `  el muñeco del invitado anduvo ${recorrido.toFixed(2)} m y quedó a ${(diferencia * 100).toFixed(1)} cm de donde ` +
        `queda sin red; rumbo ${escenaA.munecos[1].rumbo.toFixed(2)} contra ${referencia.munecos[1].rumbo.toFixed(2)}`,
    );
    expect(recorrido).toBeGreaterThan(2);
    expect(diferencia).toBeLessThan(0.3);
    expect(Math.abs(escenaA.munecos[1].rumbo - referencia.munecos[1].rumbo)).toBeLessThan(0.15);
  });
});

describe("el anfitrión no confía en lo que manda el invitado", () => {
  it("una secuencia enorme no lo congela ni le llena la cola", async () => {
    const { rapier, mundo } = await crearMundo();
    const escena = crearEscenaDos(rapier, mundo, new URLSearchParams(), () => null);
    let oyente: ((datos: Datos) => void) | undefined;
    const enlace: Enlace = {
      enviar() {},
      alRecibir(o) {
        oyente = o;
        return () => {};
      },
    };
    const anfitrion = crearSincronia({ rol: "anfitrion", enlace, mundo, munecos: escena.munecos });
    oyente?.(escribirAviso(TIPO_SIN_MUNDO));
    expect(anfitrion.mundo).toBe("propio");
    const andar = { ...entradaQuieta(), avanzar: 1 };
    const mandar = (seq: number) => oyente?.(escribirEntradas([{ seq, entrada: andar }]));
    mandar(10);
    anfitrion.paso(entradaQuieta());
    const inicio = performance.now();
    mandar(0xffffffff);
    for (let i = 0; i < 5; i++) anfitrion.paso(entradaQuieta());
    // Una avalancha de secuencias distintas tampoco
    for (let seq = 1; seq < 50_000; seq += 7) mandar(seq * 97);
    for (let i = 0; i < 5; i++) anfitrion.paso(entradaQuieta());
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(anfitrion.medidas.esperando).toBeLessThanOrEqual(240);
  });
});

/** Una partida en Node: anfitrión e invitado con la escena `dos`, sobre la red de mentira (sin pérdida). */
async function partida(red: Red) {
  const crearLado = async (
    rol: "anfitrion" | "invitado",
    entrada: () => EntradaJugador,
    avance?: OpcionesSincronia["avance"],
  ) => {
    const { rapier, mundo } = await crearMundo();
    const lado: { sincronia?: Sincronia } = {};
    const escena = crearEscenaDos(rapier, mundo, new URLSearchParams(), () =>
      lado.sincronia ? lado.sincronia.paso(entrada()) : null,
    );
    const enlace = rol === "anfitrion" ? red.anfitrion : red.invitado;
    const sincronia = crearSincronia({ rol, enlace, mundo, munecos: escena.munecos, ...(avance ? { avance } : {}) });
    lado.sincronia = sincronia;
    return { escena, sincronia, mundo, cuerpos: cuerposMoviles(mundo) };
  };
  return { crearLado };
}

const pelvis = (escena: ReturnType<typeof crearEscenaDos>, i: 0 | 1) => {
  const p = escena.munecos[i].partes.pelvis.translation();
  return { x: p.x, y: p.y, z: p.z };
};
const lejos = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("reconexión (TU-22)", () => {
  it("si el anfitrión vuelve sin mundo, el invitado le devuelve el de antes y siguen ahí", async () => {
    const red = crearRed({ perdida: 0 });
    const { crearLado } = await partida(red);
    let andanDos = true;
    const anfitrion1 = await crearLado("anfitrion", () => (andanDos ? entrada(1, 0.3) : entradaQuieta()));
    const invitado = await crearLado("invitado", () => (andanDos ? entrada(1, -0.4) : entradaQuieta()));
    const salidas = [pelvis(anfitrion1.escena, 0), pelvis(anfitrion1.escena, 1)] as const;
    const paso = (a: typeof anfitrion1) => {
      red.avanzar(1000 / 60);
      a.escena.pasar();
      a.sincronia.despues();
      invitado.escena.pasar();
    };
    // Dos segundos andando y uno quietos, para que la última foto sea donde quedaron
    for (let i = 0; i < 180; i++) {
      if (i === 120) andanDos = false;
      paso(anfitrion1);
    }
    expect(anfitrion1.sincronia.mundo).toBe("propio");
    const antes = [pelvis(anfitrion1.escena, 0), pelvis(anfitrion1.escena, 1)] as const;
    expect(lejos(antes[0], salidas[0])).toBeGreaterThan(1);
    expect(lejos(antes[1], salidas[1])).toBeGreaterThan(1);
    const rumbos = anfitrion1.escena.munecos.map((m) => m.rumbo);
    const pasosAntes = anfitrion1.sincronia.medidas.fotos * 2;

    // El anfitrión recarga la página: mundo nuevo, con los muñecos en la salida, en la misma punta de la red
    anfitrion1.sincronia.cerrar();
    red.avanzar(500);
    const anfitrion2 = await crearLado("anfitrion", entradaQuieta);
    expect(lejos(pelvis(anfitrion2.escena, 1), salidas[1])).toBeLessThan(0.01);
    const muestraAntes = invitado.sincronia.muestra?.paso ?? 0;
    for (let i = 0; anfitrion2.sincronia.mundo === "esperando"; i++) {
      expect(i).toBeLessThan(30);
      paso(anfitrion2);
    }
    expect(anfitrion2.sincronia.mundo).toBe("devuelto");
    // Mientras preguntaba no simuló ni mandó fotos
    expect(anfitrion2.sincronia.medidas.fotos).toBe(0);

    for (let i = 0; i < 60; i++) paso(anfitrion2);
    const despues = [pelvis(anfitrion2.escena, 0), pelvis(anfitrion2.escena, 1)] as const;
    console.log(
      `  el anfitrión volvió y los muñecos quedaron a ${(lejos(despues[0], antes[0]) * 100).toFixed(1)} y ` +
        `${(lejos(despues[1], antes[1]) * 100).toFixed(1)} cm de donde estaban`,
    );
    expect(lejos(despues[0], antes[0])).toBeLessThan(0.1);
    expect(lejos(despues[1], antes[1])).toBeLessThan(0.1);
    expect(Math.abs(despues[0].y - antes[0].y)).toBeLessThan(0.1);
    anfitrion2.escena.munecos.forEach((m, i) => {
      expect(Math.abs(m.rumbo - (rumbos[i] ?? 0))).toBeLessThan(0.01);
    });
    // Los pasos siguen desde la foto devuelta: el invitado sigue dibujando sin volver a empezar
    expect(anfitrion2.sincronia.medidas.fotos).toBeGreaterThan(20);
    expect(invitado.sincronia.muestra?.paso ?? 0).toBeGreaterThan(Math.max(muestraAntes, pasosAntes - 10));

    // Y el invitado sigue manejando su muñeco en el mundo devuelto
    andanDos = true;
    for (let i = 0; i < 90; i++) paso(anfitrion2);
    expect(lejos(pelvis(anfitrion2.escena, 1), despues[1])).toBeGreaterThan(0.5);
  });

  it("el punto de control viaja en las fotos y vuelve con el mundo, aunque el anfitrión arranque en 0", async () => {
    /** Un avance de mentira: `retomar` solo avanza, como el de un nivel. */
    const avanceDeMentira = (inicial: number) => {
      const a = {
        punto: inicial,
        retomados: [] as number[],
        puntoDeControl: () => a.punto,
        retomar(p: number) {
          a.retomados.push(p);
          a.punto = Math.max(a.punto, p);
        },
      };
      return a;
    };
    const red = crearRed({ perdida: 0 });
    const { crearLado } = await partida(red);
    const delAnfitrion = avanceDeMentira(0);
    const delInvitado = avanceDeMentira(0);
    const anfitrion1 = await crearLado("anfitrion", entradaQuieta, delAnfitrion);
    const invitado = await crearLado("invitado", entradaQuieta, delInvitado);
    const paso = (a: typeof anfitrion1) => {
      red.avanzar(1000 / 60);
      a.escena.pasar();
      a.sincronia.despues();
      invitado.escena.pasar();
    };
    for (let i = 0; i < 30; i++) paso(anfitrion1);
    delAnfitrion.punto = 2; // la pareja alcanzó el punto 2
    for (let i = 0; i < 30; i++) paso(anfitrion1);
    expect(delInvitado.punto).toBe(2);

    // El anfitrión recarga y Convex no llegó a guardar el 2: arranca en 0, pero el mundo devuelto trae el 2
    anfitrion1.sincronia.cerrar();
    red.avanzar(500);
    const delAnfitrion2 = avanceDeMentira(0);
    const anfitrion2 = await crearLado("anfitrion", entradaQuieta, delAnfitrion2);
    for (let i = 0; anfitrion2.sincronia.mundo === "esperando"; i++) {
      expect(i).toBeLessThan(30);
      paso(anfitrion2);
    }
    expect(anfitrion2.sincronia.mundo).toBe("devuelto");
    expect(delAnfitrion2.retomados).toEqual([2]);
    expect(delAnfitrion2.punto).toBe(2);
  });

  it("si el invitado tampoco tiene mundo, el anfitrión juega con el suyo", async () => {
    const red = crearRed({ perdida: 0 });
    const { crearLado } = await partida(red);
    const anfitrion = await crearLado("anfitrion", entradaQuieta);
    await crearLado("invitado", entradaQuieta);
    for (let i = 0; anfitrion.sincronia.mundo === "esperando"; i++) {
      expect(i).toBeLessThan(30);
      red.avanzar(1000 / 60);
      anfitrion.escena.pasar();
    }
    expect(anfitrion.sincronia.mundo).toBe("propio");
  });

  it("si nadie contesta, pregunta cada medio segundo y a los dos segundos juega con su mundo", async () => {
    const { rapier, mundo } = await crearMundo();
    const escena = crearEscenaDos(rapier, mundo, new URLSearchParams(), () => null);
    const enviados: ArrayBuffer[] = [];
    const enlace: Enlace = { enviar: (d) => enviados.push(d), alRecibir: () => () => {} };
    const anfitrion = crearSincronia({ rol: "anfitrion", enlace, mundo, munecos: escena.munecos });
    for (let i = 0; i < ESPERA_MUNDO; i++) expect(anfitrion.paso(entradaQuieta())).toBeNull();
    expect(anfitrion.mundo).toBe("esperando");
    expect(enviados.map(tipoDe)).toEqual(Array(ESPERA_MUNDO / REPEDIR_MUNDO).fill(TIPO_PEDIR_MUNDO));
    expect(anfitrion.paso(entradaQuieta())).not.toBeNull();
    expect(anfitrion.mundo).toBe("propio");
  });

  it("ya decidido, un mundo que llega tarde no pisa el propio", async () => {
    const { rapier, mundo } = await crearMundo();
    const escena = crearEscenaDos(rapier, mundo, new URLSearchParams(), () => null);
    let oyente: ((datos: Datos) => void) | undefined;
    const enlace: Enlace = {
      enviar() {},
      alRecibir(o) {
        oyente = o;
        return () => {};
      },
    };
    const anfitrion = crearSincronia({ rol: "anfitrion", enlace, mundo, munecos: escena.munecos });
    oyente?.(escribirAviso(TIPO_SIN_MUNDO));
    const cuerpos = cuerposMoviles(mundo);
    const foto = {
      paso: 500,
      ack: 0,
      estados: ["de pie", "de pie"] as const,
      agarres: 0,
      punto: 0,
      rumbos: [0, 0] as [number, number],
      velocidades: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ] as const,
      posiciones: new Float32Array(cuerpos.length * 3).fill(5),
      rotaciones: new Float32Array(cuerpos.length * 4).fill(0.5),
    };
    const antes = pelvis(escena, 0);
    oyente?.(
      escribirFoto({ ...foto, estados: [...foto.estados], velocidades: [...foto.velocidades] }, undefined, TIPO_MUNDO),
    );
    expect(anfitrion.mundo).toBe("propio");
    expect(lejos(pelvis(escena, 0), antes)).toBe(0);
  });

  it("el invitado devuelve la foto más nueva que le llegó, o que no tiene nada", async () => {
    const red = crearRed({ perdida: 0, temblor: 0 });
    const { crearLado } = await partida(red);
    const invitado = await crearLado("invitado", entradaQuieta);
    const respuestas: ArrayBuffer[] = [];
    red.anfitrion.alRecibir((d) => {
      if (typeof d !== "string" && tipoDe(d) !== 0x45) respuestas.push(d);
    });
    const preguntar = () => {
      red.anfitrion.enviar(escribirAviso(TIPO_PEDIR_MUNDO), { fiable: true });
      red.avanzar(100); // llega la pregunta
      red.avanzar(100); // vuelve la respuesta
    };
    preguntar();
    expect(respuestas.map(tipoDe)).toEqual([TIPO_SIN_MUNDO]);

    // Le llegan dos fotos, la nueva primero
    const cuerpos = invitado.cuerpos.length;
    const foto = (paso: number, x: number) => ({
      paso,
      ack: 3,
      estados: ["de pie", "caido"] as ["de pie", "caido"],
      agarres: 0,
      punto: 0,
      rumbos: [0.5, -1] as [number, number],
      velocidades: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
      ] as [{ x: number; y: number; z: number }, { x: number; y: number; z: number }],
      posiciones: new Float32Array(cuerpos * 3).fill(x),
      rotaciones: new Float32Array(cuerpos * 4).map((_, i) => (i % 4 === 3 ? 1 : 0)),
    });
    red.anfitrion.enviar(escribirFoto(foto(40, 2), undefined, TIPO_FOTO), { fiable: false });
    red.avanzar(10);
    red.anfitrion.enviar(escribirFoto(foto(38, 1), undefined, TIPO_FOTO), { fiable: false });
    red.avanzar(200);
    preguntar();
    expect(respuestas.map(tipoDe)).toEqual([TIPO_SIN_MUNDO, TIPO_MUNDO]);
    const devuelta = respuestas[1] && leerFoto(respuestas[1], undefined, TIPO_MUNDO);
    expect(devuelta).toMatchObject({ paso: 40, ack: 3, estados: ["de pie", "caido"] });
    expect(devuelta?.posiciones[0]).toBe(2);
    expect(devuelta?.rumbos[0]).toBeCloseTo(0.5, 3);
  });
});
