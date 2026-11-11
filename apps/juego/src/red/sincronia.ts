// Físicas sincronizadas entre los dos (TU-21). El anfitrión calcula todo; el invitado manda lo que aprieta y dibuja
// lo que el anfitrión le cuenta. Formato de los paquetes en paquetes.ts.
//
// Anfitrión
//   · Usa la entrada local para su muñeco (el rojo) y la del invitado, que llega por la red, para el turquesa. Las
//     entradas del invitado se usan de a una y en orden (así un salto de un solo paso no se pierde); si no llegó
//     ninguna nueva repite la última, y si se juntan más de MAX_COLA se saltan las viejas (juntando sus botones).
//     Medio segundo sin noticias del invitado: su muñeco se queda quieto.
//   · Cada 2 pasos (30 por segundo) manda por el canal rápido una foto de todos los cuerpos que se mueven (los
//     pedazos de los dos muñecos y los huacales), con el paso y el `ack` de la última entrada del invitado que usó.
//     Los agarres los decide él: el invitado ve la mano pegada al huacal porque así viene en la foto.
//
// Invitado
//   · No calcula físicas: en cada paso manda su entrada (con las 2 anteriores, por si se pierde alguna) y pone
//     cada cuerpo donde dice el colchón de fotos (interpolar.ts), 100 ms en el pasado.
//   · Su propio muñeco además se corre hacia donde va a estar con las entradas que el anfitrión todavía no usó
//     (prediccion.ts). La corrección es continua, así que no salta.
//
// Los cuerpos se reconocen por orden: los dos arman la misma escena, así que los cuerpos dinámicos de Rapier
// (ordenados por su `handle`) son los mismos en los dos lados. La foto dice cuántos son y si no coincide se tira.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import type { Muneco } from "../muneco";
import { crearBufferFotos, type Muestra, RETRASO_PASOS } from "./interpolar";
import type { Datos, Rol } from "./marco";
import {
  type EntradaNumerada,
  escribirEntradas,
  escribirFoto,
  type Foto,
  leerEntradas,
  leerFoto,
  type Vector,
} from "./paquetes";
import { type Desvio, predecir } from "./prediccion";

/** Lo que la sincronía necesita de la conexión (una `Conexion` sirve tal cual; las pruebas pasan una de mentira). */
export interface Enlace {
  enviar(datos: ArrayBuffer, opciones: { fiable: boolean }): void;
  alRecibir(oyente: (datos: Datos) => void): () => void;
}

/** Qué muñeco es de quién: el anfitrión juega con el rojo y el invitado con el turquesa. */
export const MUNECO_DE: Readonly<Record<Rol, 0 | 1>> = { anfitrion: 0, invitado: 1 };
/** Cada cuántos pasos manda foto el anfitrión: 2 = 30 por segundo. */
export const PASOS_POR_FOTO = 2;
/** Entradas del invitado esperando que, si se pasan, se saltan las más viejas. */
const MAX_COLA = 4;
/** Pasos sin entradas nuevas del invitado para darlo por quieto. */
const SIN_NOTICIAS = 30;
/** Entradas propias que recuerda el invitado (las pendientes nunca son tantas). */
const HISTORIAL = 240;
/** Qué tanto se acerca por paso el desvío dibujado a la predicción nueva (suaviza el ruido de las fotos). */
const SUAVIZAR = 0.5;

export interface Medidas {
  /** Anfitrión: fotos mandadas. Invitado: fotos recibidas. */
  fotos: number;
  /** Bytes de la última foto. */
  bytesFoto: number;
  /** Anfitrión: paquetes de entradas recibidos. Invitado: mandados. */
  entradas: number;
  /** Anfitrión: pasos en que repitió la última entrada del invitado porque no había una nueva. */
  repetidas: number;
  /** Anfitrión: entradas del invitado que se saltó para no atrasarse. */
  saltadas: number;
  /** La última entrada del invitado usada (anfitrión) o confirmada en lo que se dibuja (invitado). */
  ack: number;
  /** Invitado: pasos en que se dibujó quieto porque no había foto nueva. */
  esperando: number;
}

export interface Sincronia {
  readonly rol: Rol;
  /**
   * Al principio de cada paso, con la entrada local. El anfitrión devuelve las entradas de los dos muñecos para
   * simular; el invitado pone los cuerpos donde toca y devuelve `null` (ese paso no se simula).
   */
  paso(local: EntradaJugador): readonly [EntradaJugador, EntradaJugador] | null;
  /** Después de `mundo.step()` (el anfitrión manda la foto cuando toca). */
  despues(): void;
  readonly medidas: Readonly<Medidas>;
  /** Invitado: lo que se dibujó en el último paso, sin la predicción (para pruebas). */
  readonly muestra: Muestra | undefined;
  /** Invitado: el desvío de la predicción que se aplicó en el último paso. */
  readonly desvio: Readonly<Desvio>;
  cerrar(): void;
}

export interface OpcionesSincronia {
  rol: Rol;
  enlace: Enlace;
  mundo: RAPIER.World;
  munecos: readonly [Muneco, Muneco];
  /** Desde dónde se miden las posiciones de la foto (el centro del nivel). */
  origen?: Vector;
  /** El colchón del invitado en pasos (6 = 100 ms). */
  retraso?: number;
  /** El invitado predice su muñeco (true por omisión). */
  predecir?: boolean;
}

/** Los cuerpos que viajan en la foto: los dinámicos, en el orden en que se crearon. */
export function cuerposMoviles(mundo: RAPIER.World): RAPIER.RigidBody[] {
  const lista: RAPIER.RigidBody[] = [];
  mundo.forEachRigidBody((c) => {
    if (c.isDynamic()) lista.push(c);
  });
  return lista.sort((a, b) => a.handle - b.handle);
}

export function crearSincronia(op: OpcionesSincronia): Sincronia {
  return op.rol === "anfitrion" ? crearAnfitrion(op) : crearInvitado(op);
}

function medidasNuevas(): Medidas {
  return { fotos: 0, bytesFoto: 0, entradas: 0, repetidas: 0, saltadas: 0, ack: 0, esperando: 0 };
}

const SIN_DESVIO: Desvio = { x: 0, z: 0, rumbo: 0 };

function crearAnfitrion({ enlace, mundo, munecos, origen }: OpcionesSincronia): Sincronia {
  const cuerpos = cuerposMoviles(mundo);
  const medidas = medidasNuevas();
  const cola = new Map<number, EntradaJugador>();
  let aplicada = 0;
  let mayor = 0;
  let remota = entradaQuieta();
  let sinNoticias = 0;
  let pasos = 0;

  const dejar = enlace.alRecibir((datos) => {
    if (typeof datos === "string") return;
    const entradas = leerEntradas(datos);
    const nueva = entradas?.[entradas.length - 1];
    if (!entradas || !nueva) return;
    medidas.entradas++;
    // El invitado volvió a empezar (recargó la página): se sigue desde lo que manda ahora
    if (nueva.seq + HISTORIAL < aplicada) {
      cola.clear();
      aplicada = mayor = Math.max(0, nueva.seq - entradas.length);
    }
    for (const { seq, entrada } of entradas) if (seq > aplicada && !cola.has(seq)) cola.set(seq, entrada);
    mayor = Math.max(mayor, nueva.seq);
  });

  const juntarBotones = (a: EntradaJugador, b: EntradaJugador) => {
    a.saltar ||= b.saltar;
    a.brazoIzquierdo ||= b.brazoIzquierdo;
    a.brazoDerecho ||= b.brazoDerecho;
    a.senalar ||= b.senalar;
    a.gesto ??= b.gesto;
  };

  /** La entrada del invitado para este paso. */
  const siguiente = (): EntradaJugador => {
    if (cola.size === 0) {
      medidas.repetidas++;
      if (++sinNoticias > SIN_NOTICIAS) remota = entradaQuieta();
      return remota;
    }
    sinNoticias = 0;
    // Primero la que sigue; si se perdió (aun con las copias), la más vieja que haya
    let seq = aplicada + 1;
    if (!cola.has(seq)) seq = Math.min(...cola.keys());
    const elegida = { ...(cola.get(seq) ?? remota) };
    cola.delete(seq);
    aplicada = seq;
    // Muy atrasado: se saltan las viejas, sin perder los botones que traían
    while (mayor - aplicada > MAX_COLA) {
      const saltada = cola.get(aplicada + 1);
      if (saltada) {
        Object.assign(elegida, { avanzar: saltada.avanzar, girar: saltada.girar });
        juntarBotones(elegida, saltada);
        medidas.saltadas++;
      }
      cola.delete(aplicada + 1);
      aplicada++;
    }
    remota = elegida;
    return remota;
  };

  const posiciones = new Float32Array(cuerpos.length * 3);
  const rotaciones = new Float32Array(cuerpos.length * 4);
  const agarres = () => {
    let bits = 0;
    munecos.forEach((m, i) => {
      if (m.agarrado("brazoIzquierdo")) bits |= 1 << (2 * i);
      if (m.agarrado("brazoDerecho")) bits |= 1 << (2 * i + 1);
    });
    return bits;
  };

  return {
    rol: "anfitrion",
    paso(local) {
      return [local, siguiente()];
    },
    despues() {
      pasos++;
      if (pasos % PASOS_POR_FOTO !== 0) return;
      cuerpos.forEach((c, i) => {
        const p = c.translation();
        const q = c.rotation();
        posiciones.set([p.x, p.y, p.z], 3 * i);
        rotaciones.set([q.x, q.y, q.z, q.w], 4 * i);
      });
      const [rojo, turquesa] = munecos;
      const foto: Foto = {
        paso: pasos,
        ack: aplicada,
        estados: [rojo.estado, turquesa.estado],
        agarres: agarres(),
        rumbos: [rojo.rumbo, turquesa.rumbo],
        velocidades: [rojo.partes.pelvis.linvel(), turquesa.partes.pelvis.linvel()],
        posiciones,
        rotaciones,
      };
      const paquete = escribirFoto(foto, origen);
      medidas.fotos++;
      medidas.bytesFoto = paquete.byteLength;
      medidas.ack = aplicada;
      enlace.enviar(paquete, { fiable: false });
    },
    medidas,
    muestra: undefined,
    desvio: SIN_DESVIO,
    cerrar: dejar,
  };
}

function crearInvitado({
  enlace,
  mundo,
  munecos,
  origen,
  retraso = RETRASO_PASOS,
  ...op
}: OpcionesSincronia): Sincronia {
  const conPrediccion = op.predecir ?? true;
  const cuerpos = cuerposMoviles(mundo);
  const medidas = medidasNuevas();
  const colchon = crearBufferFotos({ retraso });
  const historial: EntradaNumerada[] = [];
  let seq = 0;
  let pasoLocal = 0;
  let muestra: Muestra | undefined;

  const propio = munecos[MUNECO_DE.invitado];
  const indice = new Map(cuerpos.map((c, i) => [c.handle, i]));
  const partesPropias = Object.values(propio.partes).flatMap((c) => {
    const i = indice.get(c.handle);
    return i === undefined ? [] : [i];
  });
  const pelvis = indice.get(propio.partes.pelvis.handle) ?? 0;

  const dejar = enlace.alRecibir((datos) => {
    if (typeof datos === "string") return;
    const foto = leerFoto(datos, origen);
    if (!foto || foto.posiciones.length !== cuerpos.length * 3) return;
    medidas.fotos++;
    medidas.bytesFoto = datos.byteLength;
    colchon.recibir(foto, pasoLocal);
  });

  const deseado: Desvio = { x: 0, z: 0, rumbo: 0 };
  const desvio: Desvio = { x: 0, z: 0, rumbo: 0 };
  const pendientes: EntradaJugador[] = [];
  const giro = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const centro = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0);

  const predecirPropio = (m: Muestra) => {
    const ack = Math.min(m.ack, seq);
    const confirmadas = Math.floor(ack);
    pendientes.length = 0;
    const primera = historial[0]?.seq ?? seq + 1;
    for (let s = Math.max(confirmadas + 1, primera); s <= seq; s++) {
      const e = historial[s - primera];
      if (e) pendientes.push(e.entrada);
    }
    const v = m.velocidades[MUNECO_DE.invitado];
    predecir(
      {
        x: m.posiciones[3 * pelvis] ?? 0,
        z: m.posiciones[3 * pelvis + 2] ?? 0,
        vx: v.x,
        vz: v.z,
        rumbo: m.rumbos[MUNECO_DE.invitado],
      },
      pendientes,
      m.estados[MUNECO_DE.invitado],
      1 - (ack - confirmadas),
      deseado,
    );
    desvio.x += (deseado.x - desvio.x) * SUAVIZAR;
    desvio.z += (deseado.z - desvio.z) * SUAVIZAR;
    desvio.rumbo += (deseado.rumbo - desvio.rumbo) * SUAVIZAR;
  };

  const colocar = (m: Muestra) => {
    const r = m.rotaciones;
    cuerpos.forEach((c, i) => {
      c.setTranslation(
        { x: m.posiciones[3 * i] ?? 0, y: m.posiciones[3 * i + 1] ?? 0, z: m.posiciones[3 * i + 2] ?? 0 },
        false,
      );
      c.setRotation({ x: r[4 * i] ?? 0, y: r[4 * i + 1] ?? 0, z: r[4 * i + 2] ?? 0, w: r[4 * i + 3] ?? 1 }, false);
    });
    if (!conPrediccion) return;
    predecirPropio(m);
    // Todo el muñeco propio gira alrededor de la pelvis y se corre lo que dice la predicción
    centro.set(m.posiciones[3 * pelvis] ?? 0, 0, m.posiciones[3 * pelvis + 2] ?? 0);
    giro.setFromAxisAngle(ARRIBA, desvio.rumbo);
    for (const i of partesPropias) {
      const c = cuerpos[i];
      if (!c) continue;
      p.copy(c.translation()).sub(centro).applyQuaternion(giro).add(centro);
      p.x += desvio.x;
      p.z += desvio.z;
      c.setTranslation(p, false);
      c.setRotation(q.copy(c.rotation()).premultiply(giro), false);
    }
  };

  return {
    rol: "invitado",
    paso(local) {
      seq++;
      historial.push({ seq, entrada: { ...local } });
      if (historial.length > HISTORIAL) historial.shift();
      enlace.enviar(escribirEntradas(historial), { fiable: false });
      medidas.entradas++;
      pasoLocal++;
      muestra = colchon.muestrear(pasoLocal);
      if (muestra) {
        medidas.ack = muestra.ack;
        if (muestra.esperando) medidas.esperando++;
        colocar(muestra);
      }
      return null;
    },
    despues() {},
    medidas,
    get muestra() {
      return muestra;
    },
    desvio,
    cerrar: dejar,
  };
}
