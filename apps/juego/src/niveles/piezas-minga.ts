// Las piezas que estrena La minga (TU-47), menos El Caleuche (caleuche.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-minga.ts) y se arma con las herramientas de piezas.ts, como las de los canales:
//
//   minga    la casa de la minga, sobre un camino de troncos. De sus dos esquinas de adelante sale un cabo con su
//            manija: cada uno tira de uno, caminando para atrás. La casa anda solo mientras los dos cabos están
//            tirados, cada uno por un muñeco distinto (solo no se mueve: es una casa entera), y va hacia donde tiran
//            los dos juntos: si uno tira torcido, se corre de costado y, si una esquina pasa la punta de los troncos,
//            se sale y se atasca hasta que los vecinos la vuelven a poner. Es cinemática: la mueve esta pieza.
//   chalupa  el bote chilote, que flota (agua.ts) y gira solo alrededor de +y. Suelto queda fondeado lejos del
//            muelle; sus dos cabos (proa y popa) cuelgan de un poste en la orilla del muelle. Con los dos cabos en sus
//            bitas a la vez (cada uno en una mano) se amarra: se arrima al muelle y ahí se queda. Lleva al que pisa.
//   ancla    el ancla del Caleuche, colgada de su cadena: abajo, con alguien parado en sus brazos, la suben hasta la
//            borda; arriba, sin nadie, la vuelven a bajar. Cinemática.
//
// Y la marea (`mareaEn`), que el guion usa para subir y bajar el agua de la caleta: sube, se queda, baja y se queda.
//
// Todo lo que se mueve (la casa y sus manijas, la chalupa y las suyas, el ancla) viaja en la foto de la red. El
// invitado no simula: saca de los cuerpos cuánto anduvo la casa, si se salió, si la chalupa está amarrada y dónde va
// el ancla, y dibuja los cabos y la cadena con los cuerpos tal como llegan.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDeLaMingaEnPlano } from "./formato-minga";
import type { Herramientas } from "./piezas";

/** El bit de grupo de choque de lo suelto de La minga (las manijas de los cabos): choca con todo
 * menos con los muñecos (bits 1 y 2); grupos del resolvedor sin filtro: se lo encuentra para agarrarlo, pero no
 * empuja. */
const BIT_MINGA = 1 << 15;
const GRUPOS_MINGA = ((BIT_MINGA << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_MINGA << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const suave = (t: number) => {
  const f = limitar(t, 0, 1);
  return f * f * (3 - 2 * f);
};

/** Los números de las piezas de La minga que no se ponen desde Blender. */
export const AJUSTES_MINGA = {
  minga: {
    /** Los troncos del camino: su radio y cada cuánto va uno (m). */
    radioTronco: 0.12,
    separacion: 0.8,
    /** El gancho de cada cabo: a qué alto de la base de la casa y cuánto hacia adentro de la esquina (m). */
    gancho: { alto: 1.15, adentro: 0.2 },
    /** Suelta, la manija cuelga del gancho: tanto más abajo y tanto más adelante (m), y vuelve ahí a este ritmo (1/s). */
    colgar: { abajo: 0.1, adelante: 0.35, ritmo: 6 },
    manija: { masa: 0.6, medio: 0.28 },
    /** Más torcido que esto (de lo que tiran los dos, hacia adelante), no anda: lo tiran de costado. */
    adelanteMinimo: 0.5,
    /** Con los cabos apenas tirados anda a esta parte de su velocidad. */
    lento: 0.4,
    /** Salida de los troncos: cuánto se ladea (radianes) y se hunde (m). */
    ladeo: 0.07,
    hundirse: 0.08,
  },
  chalupa: {
    /** A bordo: la pelvis entre tanto y tanto sobre el piso (m). */
    bordo: [0.1, 1.2],
    /** El resorte que la lleva a su lugar, fondeada o amarrada: frecuencia (rad/s) y amortiguación (1 = crítica). */
    fondeada: { frecuencia: 0.8, amortiguacion: 1 },
    amarrada: { frecuencia: 2.2, amortiguacion: 1 },
    /** Los bitones de la chalupa, donde se atan los cabos: cuánto hacia adentro de cada punta (m). */
    biton: 0.4,
    /** Las bitas del muelle: su radio y su alto; y el poste de la orilla donde cuelgan los cabos al empezar (m). */
    bita: { radio: 0.11, alto: 0.55, afuera: 0.4 },
    poste: { adentro: 0.25, alto: 1.15, separacion: 0.9 },
    manija: { masa: 0.6, medio: 0.28 },
    /** Suelta, la manija vuelve a su clavo del poste a este ritmo (1/s). */
    recoger: 5,
    /** Amarrada, se arrima al muelle hasta quedar a tanto de su lugar (de costado) antes de correrse a él (m). */
    arrimar: 0.25,
  },
  ancla: {
    /** Los brazos del ancla, donde se para el que sube: medio largo (a lo largo de su x), medio fondo y grueso (m). */
    brazos: { medio: 0.6, fondo: 0.3, grueso: 0.12 },
    /** La caña: su alto sobre los brazos (m). */
    cana: { alto: 1.5 },
    /** Encima: la pelvis entre tanto y tanto sobre los brazos (m), y hasta tanto afuera de ellos. */
    encima: [0.15, 1.3],
    borde: 0.15,
    /** El escobén, donde entra la cadena: tanto más arriba de lo alto de la caja y tanto hacia su −z (m). */
    escoben: { arriba: 0.9, atras: 0.5 },
  },
} as const;

// ── La marea ────────────────────────────────────────────────────────────────────────────────────────────────

/** El ciclo de la marea: bajamar y pleamar (m), y cuánto dura cada parte (s). */
export interface Marea {
  readonly baja: number;
  readonly alta: number;
  readonly enBaja: number;
  readonly subiendo: number;
  readonly enAlta: number;
  readonly bajando: number;
}

/** La altura del agua a los `segundos` de empezar: en bajamar, sube, en pleamar y baja (y otra vez). */
export function mareaEn(segundos: number, m: Marea): number {
  const ciclo = m.enBaja + m.subiendo + m.enAlta + m.bajando;
  let t = ((segundos % ciclo) + ciclo) % ciclo;
  if (t < m.enBaja) return m.baja;
  t -= m.enBaja;
  if (t < m.subiendo) return m.baja + (m.alta - m.baja) * suave(t / m.subiendo);
  t -= m.subiendo;
  if (t < m.enAlta) return m.alta;
  t -= m.enAlta;
  return m.alta + (m.baja - m.alta) * suave(t / m.bajando);
}

// ── Lo común ────────────────────────────────────────────────────────────────────────────────────────────────

/** Quién tiene agarrado ese cuerpo (el primero de los dos), o nadie. */
function quienAgarra(munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody): 0 | 1 | null {
  for (const [i, m] of munecos.entries()) {
    if (i > 1) break;
    for (const brazo of ["brazoIzquierdo", "brazoDerecho"] as const) {
      if (m.agarrado(brazo)?.parent()?.handle === cuerpo.handle) return i as 0 | 1;
    }
  }
  return null;
}

/** Una manija de cabo: un palito suelto que se agarra con las manos y no empuja a los muñecos. */
function crearManija(h: Herramientas, donde: THREE.Vector3, giro: THREE.Quaternion, masa: number, medio: number) {
  const cuerpo = h.mundo.createRigidBody(
    h.dinamico(donde, giro).setLinearDamping(1.5).setAngularDamping(3).setCanSleep(false),
  );
  h.mundo.createCollider(
    h.rapier.ColliderDesc.cuboid(medio, 0.035, 0.035)
      .setMass(masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_MINGA)
      .setSolverGroups(SIN_EMPUJAR),
    cuerpo,
  );
  const imagen = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(0.035, 0.035, medio * 2, 8).rotateZ(Math.PI / 2),
      new THREE.SphereGeometry(0.05, 8, 6),
    ]),
    h.madera,
  );
  h.mover(cuerpo, imagen);
  return cuerpo;
}

/** Lleva la manija suelta hacia `donde` como un resorte (sin el peso), para que quede colgando de su gancho. */
function recogerManija(manija: RAPIER.RigidBody, donde: THREE.Vector3, ritmo: number) {
  const t = manija.translation();
  const v = manija.linvel();
  const m = manija.mass();
  const k = ritmo * ritmo;
  const c = 2 * ritmo;
  manija.applyImpulse(
    {
      x: m * (k * (donde.x - t.x) - c * v.x) * PASO,
      y: m * (k * (donde.y - t.y) - c * v.y - GRAVEDAD) * PASO,
      z: m * (k * (donde.z - t.z) - c * v.z) * PASO,
    },
    true,
  );
}

/** Una soga que cuelga entre dos puntos: tramos de cilindro sobre una parábola, más honda cuanto más floja. */
export function crearSoga(escena: THREE.Scene, material: THREE.Material, radio = 0.018, tramos = 8) {
  const mallas = Array.from({ length: tramos }, () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 5).translate(0, 0.5, 0), material);
    escena.add(m);
    return m;
  });
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const punto = (desde: THREE.Vector3, hasta: THREE.Vector3, panza: number, u: number, en: THREE.Vector3) =>
    en.lerpVectors(desde, hasta, u).addScaledVector(ARRIBA, -4 * panza * u * (1 - u));
  return {
    mallas,
    /** La tiende de `desde` a `hasta`; `largo` es lo que mide (más que la distancia, cuelga). */
    tender(desde: THREE.Vector3Like, hasta: THREE.Vector3Like, largo: number) {
      const d0 = new THREE.Vector3().copy(desde);
      const d1 = new THREE.Vector3().copy(hasta);
      const d = d0.distanceTo(d1);
      // Lo que sobra queda enrollado: la panza tiene tope
      const panza = largo > d ? Math.min(0.35, 0.3 * Math.sqrt(largo * largo - d * d)) : 0;
      mallas.forEach((m, i) => {
        punto(d0, d1, panza, i / tramos, a);
        punto(d0, d1, panza, (i + 1) / tramos, b);
        const tramo = b.clone().sub(a);
        m.position.copy(a);
        m.quaternion.setFromUnitVectors(ARRIBA, tramo.clone().normalize());
        m.scale.set(1, Math.max(0.001, tramo.length()), 1);
      });
    },
  };
}

// ── La casa de la minga ─────────────────────────────────────────────────────────────────────────────────────

/** Cómo anda la casa: quieta, andando, atascada fuera de los troncos o ya en su sitio. */
export type EstadoMinga = "quieta" | "andando" | "atascada" | "llego";

export interface Minga {
  readonly cual: "minga";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Las manijas de los dos cabos: la del lado −z de la casa y la del +z. */
  readonly manijas: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** Quién tira de cada cabo (0 el rojo, 1 el turquesa) y cuánto (0 flojo, 1 del todo). */
  readonly tiradores: readonly [0 | 1 | null, 0 | 1 | null];
  readonly jaladas: readonly [number, number];
  /** Cuánto anduvo por el camino (m, hasta `recorrido`) y cuánto se corrió de costado (m, + hacia su +z). */
  readonly avance: number;
  readonly desvio: number;
  readonly recorrido: number;
  readonly estado: EstadoMinga;
  /** Si alguna vez se salió de los troncos (para el logro), y cuántas veces. */
  readonly seSalio: boolean;
  readonly salidas: number;
  /** Llama a `aviso` cuando llega a su sitio, o cuando se sale de los troncos. Devuelven cómo dejar de escuchar. */
  alLlegar(aviso: () => void): () => void;
  alSalirse(aviso: () => void): () => void;
  /** La deja en su sitio, ya llegada (al retomar). */
  llevarAlFinal(): void;
  /** La pone donde empezó, sin haberse salido. */
  volver(): void;
}

export function armarMinga(h: Herramientas, p: Extract<PiezaDeLaMingaEnPlano, { cual: "minga" }>): Minga {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINGA.minga;
  const { centro, medio, giro } = p.caja;
  const adelante = EJE_X.clone().applyQuaternion(giro).setY(0).normalize();
  const lado = EJE_Z.clone().applyQuaternion(giro).setY(0).normalize();
  const base = centro.y - medio.y;

  // La casa: cinemática, con sus paredes (choca) y el techo de dos aguas
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(centro.x, centro.y, centro.z)
      .setRotation({ x: giro.x, y: giro.y, z: giro.z, w: giro.w }),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setFriction(0.8),
    cuerpo,
  );
  const imagen = crearImagenCasa(h.madera, h.oscuro, medio);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  // El camino de troncos: desde atrás de la casa hasta donde llega su frente
  const medioTronco = medio.z + p.margen;
  const desde = -medio.x - 0.3;
  const hasta = p.recorrido + medio.x + 0.3;
  const troncos: THREE.Mesh[] = [];
  const geometriaTronco = new THREE.CylinderGeometry(a.radioTronco, a.radioTronco * 1.08, medioTronco * 2, 9).rotateX(
    Math.PI / 2,
  );
  const corteza = materialCorteza(COLORES.silueta, { repetir: [1, 2] });
  for (let x = desde; x <= hasta; x += a.separacion) {
    const t = new THREE.Mesh(geometriaTronco, corteza);
    t.position
      .copy(centro)
      .addScaledVector(adelante, x)
      .setY(base - a.radioTronco);
    t.quaternion.copy(giro);
    t.rotateZ(x * 1.7);
    h.escena.add(t);
    troncos.push(t);
  }

  // Los cabos: un gancho en cada esquina de adelante, y su manija colgando
  const ganchoLocal = [-1, 1].map(
    (s) => new THREE.Vector3(medio.x, -medio.y + a.gancho.alto, s * (medio.z - a.gancho.adentro)),
  );
  const enLaCasa = (l: THREE.Vector3) =>
    l.clone().applyQuaternion(new THREE.Quaternion().copy(cuerpo.rotation())).add(cuerpo.translation());
  const colgando = (l: THREE.Vector3) =>
    enLaCasa(l.clone().add(new THREE.Vector3(a.colgar.adelante, -a.colgar.abajo, 0)));
  const giroManija = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI / 2));
  const manijas = ganchoLocal.map((l) => {
    const m = crearManija(h, colgando(l), giroManija, a.manija.masa, a.manija.medio);
    // El cabo: no se estira más que su largo y lo que da
    const junta = mundo.createImpulseJoint(
      rapier.JointData.rope(p.cabo + p.estirar, { x: l.x, y: l.y, z: l.z }, CERO),
      cuerpo,
      m,
      true,
    );
    junta.setContactsEnabled(false);
    return m;
  }) as [RAPIER.RigidBody, RAPIER.RigidBody];
  const materialCabo = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const sogas = manijas.map(() => crearSoga(h.escena, materialCabo, 0.02));

  let avance = 0;
  let desvio = 0;
  let estado: EstadoMinga = "quieta";
  let seSalio = false;
  let salidas = 0;
  let atascada = 0;
  /** Para qué lado se salió (−1 o 1). */
  let ladoSalida = 1;
  let tiradores: [0 | 1 | null, 0 | 1 | null] = [null, null];
  let jaladas: [number, number] = [0, 0];
  const avisosLlegar = new Set<() => void>();
  const avisosSalir = new Set<() => void>();

  const ubicar = (deUna: boolean) => {
    const donde = centro.clone().addScaledVector(adelante, avance).addScaledVector(lado, desvio);
    let q = giro.clone();
    if (estado === "atascada") {
      donde.y -= a.hundirse;
      q = q.multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, ladoSalida * a.ladeo));
    }
    if (deUna) {
      cuerpo.setTranslation(donde, true);
      cuerpo.setRotation(q, true);
    } else {
      cuerpo.setNextKinematicTranslation(donde);
      cuerpo.setNextKinematicRotation(q);
    }
  };
  const ponerManijas = () => {
    manijas.forEach((m, i) => {
      const l = ganchoLocal[i];
      if (!l) return;
      m.setTranslation(colgando(l), true);
      m.setRotation(giroManija, true);
      m.setLinvel(CERO, true);
      m.setAngvel(CERO, true);
    });
  };

  h.antes((munecos) => {
    const tirones: THREE.Vector3[] = [];
    tiradores = [null, null];
    jaladas = [0, 0];
    manijas.forEach((m, i) => {
      const l = ganchoLocal[i];
      if (!l) return;
      const gancho = enLaCasa(l);
      const quien = quienAgarra(munecos, m);
      tiradores[i] = quien;
      const t = new THREE.Vector3().copy(m.translation());
      const cabo = t.clone().sub(gancho);
      const largo = cabo.length();
      if (quien === null) {
        // Suelta, vuelve a colgar del gancho
        recogerManija(m, colgando(l), a.colgar.ritmo);
        return;
      }
      // Tirada: pasado su largo, el cabo se resiste como un resorte (lo que tira el muñeco)
      const estirado = largo - p.cabo;
      if (estirado > 0) {
        const f = (p.fuerza * Math.min(1.5, estirado / p.estirar) * PASO) / Math.max(largo, 0.001);
        m.applyImpulse({ x: -cabo.x * f, y: -cabo.y * f, z: -cabo.z * f }, true);
      }
      const jalada = limitar(estirado / p.estirar, 0, 1);
      jaladas[i] = jalada;
      tirones.push(cabo.setY(0).normalize().multiplyScalar(jalada));
    });

    if (estado === "llego") return;
    if (estado === "atascada") {
      atascada += PASO;
      if (atascada >= p.atasco) {
        // Los vecinos la vuelven a poner en los troncos
        desvio = 0;
        estado = "quieta";
        ubicar(false);
      }
      return;
    }
    // Anda solo si cada cabo lo tira un muñeco distinto, los dos pasados el umbral
    const [j0, j1] = jaladas;
    const dosDistintos = tiradores[0] !== null && tiradores[1] !== null && tiradores[0] !== tiradores[1];
    const suma = new THREE.Vector3();
    for (const t of tirones) suma.add(t);
    const haciaAdelante = suma.lengthSq() > 0 ? suma.clone().normalize().dot(adelante) : 0;
    if (!dosDistintos || j0 < p.umbral || j1 < p.umbral || haciaAdelante < a.adelanteMinimo) {
      estado = "quieta";
      ubicar(false);
      return;
    }
    estado = "andando";
    const fuerza = Math.min(j0, j1);
    const rapido = p.velocidad * (a.lento + (1 - a.lento) * limitar((fuerza - p.umbral) / (1 - p.umbral), 0, 1));
    const dir = suma.normalize();
    avance += dir.dot(adelante) * rapido * PASO;
    desvio += dir.dot(lado) * rapido * PASO;
    if (avance >= p.recorrido) {
      avance = p.recorrido;
      estado = "llego";
      ubicar(false);
      for (const aviso of avisosLlegar) aviso();
      return;
    }
    // Una esquina pasó la punta de los troncos: se sale y se atasca
    if (Math.abs(desvio) > p.margen) {
      ladoSalida = Math.sign(desvio);
      estado = "atascada";
      atascada = 0;
      seSalio = true;
      salidas++;
      ubicar(false);
      for (const aviso of avisosSalir) aviso();
      return;
    }
    ubicar(false);
  });

  // Lo que ve el invitado (y el dibujo): cuánto anduvo, si se salió, y los troncos que ruedan bajo la casa
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let avanceVisto = 0;
  let desvioVisto = 0;
  let estadoVisto: EstadoMinga = "quieta";
  const giroInverso = giro.clone().invert();
  h.guardar(() => {
    const t = new THREE.Vector3().copy(cuerpo.translation()).sub(centro);
    avanceVisto = t.dot(adelante);
    desvioVisto = t.dot(lado);
    const q = new THREE.Quaternion().copy(cuerpo.rotation()).premultiply(giroInverso);
    const ladeado = 2 * Math.asin(limitar(Math.hypot(q.x, q.z), 0, 1)) > a.ladeo / 2;
    estadoVisto = ladeado ? "atascada" : avanceVisto >= p.recorrido - 0.01 ? "llego" : "quieta";
  });
  const giroTronco = new THREE.Quaternion();
  h.dibujar(() => {
    const anduvo = imagen.position.clone().sub(centro).dot(adelante);
    troncos.forEach((t, i) => {
      const x = desde + i * a.separacion;
      // Los que quedan bajo la casa ruedan con lo que anduvo
      if (x > anduvo - medio.x - 0.2 && x < anduvo + medio.x + 0.2) {
        giroTronco.setFromAxisAngle(EJE_Z, -anduvo / a.radioTronco + i * 1.7);
        t.quaternion.copy(giro).multiply(giroTronco);
      }
    });
    manijas.forEach((m, i) => {
      const l = ganchoLocal[i];
      const soga = sogas[i];
      if (!l || !soga) return;
      const gancho = l.clone().applyQuaternion(imagen.quaternion).add(imagen.position);
      soga.tender(gancho, m.translation(), p.cabo + 0.05);
    });
  });

  return {
    cual: "minga",
    nombre: p.nombre,
    cuerpo,
    manijas,
    get tiradores() {
      return tiradores;
    },
    get jaladas() {
      return jaladas;
    },
    get avance() {
      return simulado ? avance : avanceVisto;
    },
    get desvio() {
      return simulado ? desvio : desvioVisto;
    },
    recorrido: p.recorrido,
    get estado() {
      return simulado ? estado : estadoVisto;
    },
    get seSalio() {
      return seSalio;
    },
    get salidas() {
      return salidas;
    },
    alLlegar(aviso) {
      avisosLlegar.add(aviso);
      return () => {
        avisosLlegar.delete(aviso);
      };
    },
    alSalirse(aviso) {
      avisosSalir.add(aviso);
      return () => {
        avisosSalir.delete(aviso);
      };
    },
    llevarAlFinal() {
      avance = p.recorrido;
      desvio = 0;
      estado = "llego";
      ubicar(true);
      ponerManijas();
    },
    volver() {
      avance = 0;
      desvio = 0;
      estado = "quieta";
      seSalio = false;
      ubicar(true);
      ponerManijas();
    },
  };
}

/** La casa chilota: paredes de tejuelas, una puerta, ventanas y el techo de dos aguas con su chimenea. En su marco,
 * centrada en su caja (`medio`: las paredes), con el frente hacia +x. */
export function crearImagenCasa(madera: THREE.Material, oscuro: THREE.Material, medio: THREE.Vector3Like) {
  const grupo = new THREE.Group();
  const tejuelas = materialCorteza(COLORES.siluetaLejana, { repetir: [3, 6], relieve: 6 });
  grupo.add(new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, medio.z * 2), tejuelas));
  // El techo de dos aguas, a lo largo de su x, que sale un poco de las paredes
  const alero = 0.18;
  const alto = Math.min(1.1, medio.z * 0.8);
  const ancho = Math.hypot(medio.z + alero, alto);
  const inclinacion = Math.atan2(alto, medio.z + alero);
  const techo = new THREE.Group();
  for (const s of [-1, 1]) {
    const agua = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2 + alero * 2, 0.07, ancho), madera);
    agua.position.set(0, medio.y + alto / 2, (s * (medio.z + alero)) / 2);
    agua.rotation.x = s * inclinacion;
    techo.add(agua);
  }
  // Los dos frontones (triángulos) y la chimenea
  const fronton = new THREE.Shape();
  fronton.moveTo(-medio.z, 0);
  fronton.lineTo(medio.z, 0);
  fronton.lineTo(0, alto);
  fronton.closePath();
  const geometriaFronton = new THREE.ShapeGeometry(fronton).rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(geometriaFronton, tejuelas);
    f.position.set(s * medio.x, medio.y, 0);
    f.material.side = THREE.DoubleSide;
    techo.add(f);
  }
  techo.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.8, 0.3).translate(-medio.x * 0.5, medio.y + alto * 0.7, -medio.z * 0.35),
      oscuro,
    ),
  );
  grupo.add(techo);
  // La puerta y las ventanas del frente (+x) y de los costados
  const hueco = (ancho: number, alto: number) => new THREE.BoxGeometry(0.04, alto, ancho);
  const frente = [
    hueco(0.7, 1.3).translate(medio.x + 0.01, -medio.y + 0.65, 0),
    hueco(0.5, 0.5).translate(medio.x + 0.01, medio.y * 0.35, medio.z * 0.6),
    hueco(0.5, 0.5).translate(medio.x + 0.01, medio.y * 0.35, -medio.z * 0.6),
  ];
  const costados = [-1, 1].flatMap((s) => [
    new THREE.BoxGeometry(0.55, 0.5, 0.04).translate(medio.x * 0.45, medio.y * 0.35, s * (medio.z + 0.01)),
    new THREE.BoxGeometry(0.55, 0.5, 0.04).translate(-medio.x * 0.45, medio.y * 0.35, s * (medio.z + 0.01)),
  ]);
  grupo.add(new THREE.Mesh(juntar([...frente, ...costados]), oscuro));
  // La viga de abajo (la solera, donde va sobre los troncos)
  grupo.add(
    new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2 + 0.2, 0.14, medio.z * 2 + 0.1).translate(0, -medio.y, 0), madera),
  );
  return grupo;
}

// ── La chalupa ──────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoChalupa = "suelta" | "amarrando" | "amarrada";

export interface Chalupa {
  readonly cual: "chalupa";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Las manijas de los cabos de proa y de popa. */
  readonly manijas: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** Lo alto de cada bita del muelle (proa y popa), donde se amarra su cabo. */
  readonly bitas: readonly [THREE.Vector3, THREE.Vector3];
  /** Quién tiene cada cabo en la mano. */
  readonly cabos: readonly [0 | 1 | null, 0 | 1 | null];
  readonly estado: EstadoChalupa;
  /** Cuánto falta para que se amarre, de 0 a 1 (con los dos cabos en sus bitas). */
  readonly amarrando: number;
  /** Cuántos muñecos van a bordo. */
  readonly aBordo: number;
  /** Si ese punto (una pelvis) va a bordo. */
  encima(p: THREE.Vector3Like): boolean;
  /** Llama a `aviso` cuando queda amarrada. Devuelve cómo dejar de escuchar. */
  alAmarrar(aviso: () => void): () => void;
  /** La deja amarrada junto al muelle, con los cabos en sus bitas (al retomar). */
  amarrar(): void;
  /** La deja suelta y fondeada, con los cabos colgando del poste. */
  volver(): void;
}

export function armarChalupa(h: Herramientas, p: Extract<PiezaDeLaMingaEnPlano, { cual: "chalupa" }>): Chalupa {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINGA.chalupa;
  const { centro, medio } = p.caja;
  // A lo largo de su lado más largo; el muelle queda del lado +z de ese marco
  const enX = medio.x >= medio.z;
  const giro = enX
    ? p.caja.giro.clone()
    : p.caja.giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2));
  const mitad = enX ? medio.x : medio.z;
  const medioAncho = enX ? medio.z : medio.x;
  const alto = medio.y;
  const adelante = EJE_X.clone().applyQuaternion(giro);
  const haciaElMuelle = EJE_Z.clone().applyQuaternion(giro);
  const enElMarco = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(giro).add(centro);
  const amarradaEn = centro.clone();
  const fondeadaEn = centro.clone().addScaledVector(adelante, -p.corrida).addScaledVector(haciaElMuelle, -p.fondeo);

  const cuerpo = mundo.createRigidBody(
    h
      .dinamico(fondeadaEn, giro)
      .enabledRotations(false, true, false)
      .setCanSleep(false)
      .setAngularDamping(0.8)
      .setLinearDamping(0.2),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad, alto, medioAncho).setMass(p.masa).setFriction(0.9),
    cuerpo,
  );
  llevaAlQuePisa(cuerpo);
  const imagen = crearImagenChalupa(h.madera, h.oscuro, mitad, alto, medioAncho);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  // Los bitones (en la chalupa, del lado del muelle) y las bitas del muelle, una frente a cada punta
  const bitonLocal = [1, -1].map((s) => new THREE.Vector3(s * (mitad - a.biton), alto, medioAncho - 0.12));
  const bitas = [1, -1].map((s) =>
    enElMarco(s * (mitad - a.biton + a.bita.afuera), alto + p.alto + a.bita.alto, medioAncho + p.muelle),
  ) as [THREE.Vector3, THREE.Vector3];
  const imagenBitas = new THREE.Mesh(
    juntar(
      bitas.flatMap((b) => [
        new THREE.CylinderGeometry(a.bita.radio, a.bita.radio * 1.1, a.bita.alto, 9).translate(
          b.x,
          b.y - a.bita.alto / 2,
          b.z,
        ),
        new THREE.CylinderGeometry(a.bita.radio * 1.5, a.bita.radio * 1.5, 0.06, 9).translate(b.x, b.y, b.z),
      ]),
    ),
    h.oscuro,
  );
  h.escena.add(imagenBitas);
  for (const b of bitas) {
    const c = h.fijo(b.clone().addScaledVector(ARRIBA, -a.bita.alto / 2), new THREE.Quaternion());
    mundo.createCollider(rapier.ColliderDesc.cylinder(a.bita.alto / 2, a.bita.radio).setFriction(0.8), c);
  }
  // El poste de la orilla: los dos cabos cuelgan de sus clavos, en el medio del muelle
  const clavos = [1, -1].map((s) =>
    enElMarco((s * a.poste.separacion) / 2, alto + p.alto + a.poste.alto, medioAncho + a.poste.adentro),
  );
  // La barandilla de la orilla: dos postes y un pasamanos; los cabos cuelgan de sus clavos
  const barandilla = [-1, 1].map((s) =>
    enElMarco((s * (a.poste.separacion + 0.5)) / 2, alto + p.alto, medioAncho + a.poste.adentro + 0.1),
  );
  const pasamanos = enElMarco(0, alto + p.alto + a.poste.alto + 0.1, medioAncho + a.poste.adentro + 0.1);
  h.escena.add(
    new THREE.Mesh(
      juntar([
        ...barandilla.map((b) =>
          new THREE.CylinderGeometry(0.07, 0.08, a.poste.alto + 0.14, 7).translate(
            b.x,
            b.y + (a.poste.alto + 0.14) / 2,
            b.z,
          ),
        ),
        new THREE.BoxGeometry(a.poste.separacion + 0.62, 0.07, 0.09)
          .applyQuaternion(giro)
          .translate(pasamanos.x, pasamanos.y, pasamanos.z),
      ]),
      h.madera,
    ),
  );

  // A lo largo del muelle: el que la agarra mira hacia el agua
  const giroManija = giro.clone();
  const manijas = clavos.map((c, i) => {
    const m = crearManija(h, c, giroManija, a.manija.masa, a.manija.medio);
    const l = bitonLocal[i] ?? new THREE.Vector3();
    const junta = mundo.createImpulseJoint(
      rapier.JointData.rope(p.cabo, { x: l.x, y: l.y, z: l.z }, CERO),
      cuerpo,
      m,
      true,
    );
    junta.setContactsEnabled(false);
    return m;
  }) as [RAPIER.RigidBody, RAPIER.RigidBody];
  const materialCabo = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const sogas = manijas.map(() => crearSoga(h.escena, materialCabo, 0.018, 10));

  const local = new THREE.Vector3();
  const giroAhora = new THREE.Quaternion();
  const enLaChalupa = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroAhora.copy(cuerpo.rotation()).invert();
    return local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroAhora);
  };
  const encima = (q: THREE.Vector3Like) => {
    const l = enLaChalupa(q);
    const y = l.y - alto;
    return Math.abs(l.x) <= mitad + 0.1 && Math.abs(l.z) <= medioAncho + 0.1 && y > a.bordo[0] && y < a.bordo[1];
  };
  const rumboDe = (q: THREE.Quaternion) => {
    const x = EJE_X.clone().applyQuaternion(q);
    return Math.atan2(x.x, x.z);
  };
  const rumboFijo = rumboDe(giro);
  // Lo que pesa de verdad y su inercia alrededor de +y (para el resorte que la lleva a su lugar)
  const inercia = (p.masa * ((2 * mitad) ** 2 + (2 * medioAncho) ** 2)) / 12;

  let estado: EstadoChalupa = "suelta";
  let enBitas = 0;
  let aBordo = 0;
  let cabos: [0 | 1 | null, 0 | 1 | null] = [null, null];
  const avisos = new Set<() => void>();

  const fijarManijas = () => {
    manijas.forEach((m, i) => {
      const b = bitas[i];
      if (!b) return;
      m.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      m.setTranslation(b, true);
      m.setNextKinematicTranslation(b);
      m.setRotation(giroManija, true);
    });
  };
  const soltarManijas = () => {
    manijas.forEach((m, i) => {
      const c = clavos[i];
      if (!c) return;
      m.setBodyType(rapier.RigidBodyType.Dynamic, true);
      m.setTranslation(c, true);
      m.setRotation(giroManija, true);
      m.setLinvel(CERO, true);
      m.setAngvel(CERO, true);
    });
  };
  const llevar = (donde: THREE.Vector3) => {
    cuerpo.setTranslation(donde, true);
    cuerpo.setRotation(giro, true);
    cuerpo.setLinvel(CERO, true);
    cuerpo.setAngvel(CERO, true);
  };

  h.antes((munecos) => {
    aBordo = munecos.filter((m) => encima(m.partes.pelvis.translation())).length;
    cabos = [null, null];
    if (estado !== "amarrada") {
      manijas.forEach((m, i) => {
        const quien = quienAgarra(munecos, m);
        cabos[i] = quien;
        const c = clavos[i];
        if (quien === null && c) recogerManija(m, c, a.recoger);
      });
    }
    // El resorte que la lleva a su lugar: fondeada lejos, o amarrada junto al muelle
    const r = estado === "amarrada" ? a.amarrada : a.fondeada;
    const t = cuerpo.translation();
    // Amarrada, los cabos la arriman primero al muelle y después la corren a su lugar (así no pasa por debajo del
    // ancla ni de lo que haya junto al muelle)
    let destino = fondeadaEn;
    if (estado === "amarrada") {
      const corrida = new THREE.Vector3().copy(t).sub(amarradaEn);
      const afuera = corrida.dot(haciaElMuelle);
      destino =
        Math.abs(afuera) > a.arrimar ? amarradaEn.clone().addScaledVector(adelante, corrida.dot(adelante)) : amarradaEn;
    }
    const v = cuerpo.linvel();
    const w2 = r.frecuencia * r.frecuencia;
    const c = 2 * r.amortiguacion * r.frecuencia;
    cuerpo.applyImpulse(
      {
        x: p.masa * (w2 * (destino.x - t.x) - c * v.x) * PASO,
        y: 0,
        z: p.masa * (w2 * (destino.z - t.z) - c * v.z) * PASO,
      },
      true,
    );
    const giroQueFalta = Math.atan2(
      Math.sin(rumboFijo - rumboDe(giroAhora.copy(cuerpo.rotation()))),
      Math.cos(rumboFijo - rumboDe(giroAhora)),
    );
    cuerpo.applyTorqueImpulse({ x: 0, y: inercia * (w2 * giroQueFalta - c * cuerpo.angvel().y) * PASO, z: 0 }, true);
  });

  // Amarrarla: los dos cabos, cada uno en una mano y en su bita, a la vez
  h.despues(() => {
    if (estado === "amarrada") return;
    const enSuBita = manijas.every((m, i) => {
      const b = bitas[i];
      if (!b || cabos[i] === null) return false;
      const t = m.translation();
      return Math.hypot(t.x - b.x, t.z - b.z) <= p.alcance;
    });
    enBitas = enSuBita ? enBitas + PASO : 0;
    estado = enBitas > 0 ? "amarrando" : "suelta";
    if (enBitas >= p.nudo) {
      estado = "amarrada";
      fijarManijas();
      for (const aviso of avisos) aviso();
    }
  });

  // El invitado la ve amarrada si las dos manijas están en sus bitas; y los cabos se dibujan con lo que llega
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let estadoVisto: EstadoChalupa = "suelta";
  h.guardar(() => {
    const atadas = manijas.every((m, i) => {
      const b = bitas[i];
      return b ? new THREE.Vector3().copy(m.translation()).distanceTo(b) < 0.05 : false;
    });
    estadoVisto = atadas ? "amarrada" : "suelta";
  });
  h.dibujar(() => {
    manijas.forEach((m, i) => {
      const l = bitonLocal[i];
      const soga = sogas[i];
      if (!l || !soga) return;
      const biton = l.clone().applyQuaternion(imagen.quaternion).add(imagen.position);
      soga.tender(biton, m.translation(), p.cabo * 0.92);
    });
  });

  return {
    cual: "chalupa",
    nombre: p.nombre,
    cuerpo,
    manijas,
    bitas,
    get cabos() {
      return cabos;
    },
    get estado() {
      return simulado ? estado : estadoVisto;
    },
    get amarrando() {
      return estado === "amarrada" ? 1 : limitar(enBitas / p.nudo, 0, 1);
    },
    get aBordo() {
      return aBordo;
    },
    encima,
    alAmarrar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    amarrar() {
      estado = "amarrada";
      enBitas = p.nudo;
      llevar(amarradaEn);
      fijarManijas();
    },
    volver() {
      estado = "suelta";
      enBitas = 0;
      llevar(fondeadaEn);
      soltarManijas();
    },
  };
}

/** La chalupa chilota: casco de tablas con la proa en punta (hacia +x), cuadernas, dos bancadas y un par de remos.
 * En su marco, centrada en su caja (el piso arriba). */
export function crearImagenChalupa(
  madera: THREE.Material,
  oscuro: THREE.Material,
  mitad: number,
  alto: number,
  medioAncho: number,
) {
  const grupo = new THREE.Group();
  // El casco: una forma de bote, más angosta en la proa, extruida hacia arriba
  const forma = new THREE.Shape();
  forma.moveTo(-mitad, -medioAncho * 0.85);
  forma.lineTo(mitad * 0.55, -medioAncho);
  forma.quadraticCurveTo(mitad * 1.05, -medioAncho * 0.6, mitad * 1.12, 0);
  forma.quadraticCurveTo(mitad * 1.05, medioAncho * 0.6, mitad * 0.55, medioAncho);
  forma.lineTo(-mitad, medioAncho * 0.85);
  forma.closePath();
  const casco = new THREE.ExtrudeGeometry(forma, { depth: alto * 2, bevelEnabled: false })
    .rotateX(-Math.PI / 2)
    .translate(0, -alto, 0);
  const materialCasco = materialCorteza(COLORES.silueta, { repetir: [3, 1] });
  grupo.add(new THREE.Mesh(casco, materialCasco));
  // Las bordas: tablas finas por el contorno, sobre el piso
  const contorno = forma.getPoints(10);
  const bordas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i];
    const b = contorno[(i + 1) % contorno.length];
    if (!a || !b) continue;
    const largo = Math.hypot(b.x - a.x, b.y - a.y);
    if (largo < 0.01) continue;
    bordas.push(
      new THREE.BoxGeometry(largo + 0.04, 0.22, 0.05)
        .rotateY(-Math.atan2(-(b.y - a.y), b.x - a.x))
        .translate((a.x + b.x) / 2, alto + 0.11, -(a.y + b.y) / 2),
    );
  }
  grupo.add(new THREE.Mesh(juntar(bordas), materialCasco));
  // El piso (un poco más claro) y las bancadas
  const tablas = [
    new THREE.BoxGeometry(mitad * 1.8, 0.03, medioAncho * 1.6).translate(-mitad * 0.05, alto + 0.01, 0),
    new THREE.BoxGeometry(0.22, 0.05, medioAncho * 1.7).translate(-mitad * 0.35, alto + 0.32, 0),
    new THREE.BoxGeometry(0.22, 0.05, medioAncho * 1.7).translate(mitad * 0.3, alto + 0.32, 0),
  ];
  grupo.add(new THREE.Mesh(juntar(tablas), madera));
  // Los remos, cruzados sobre las bancadas
  const remos = [-1, 1].map((s) =>
    new THREE.BoxGeometry(mitad * 1.3, 0.04, 0.06)
      .rotateY(s * 0.12)
      .translate(-mitad * 0.05, alto + 0.38, s * medioAncho * 0.4),
  );
  grupo.add(new THREE.Mesh(juntar(remos), oscuro));
  return grupo;
}

// ── El ancla del Caleuche ───────────────────────────────────────────────────────────────────────────────────

export type EstadoAncla = "abajo" | "subiendo" | "arriba" | "bajando";

export interface Ancla {
  readonly cual: "ancla";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoAncla;
  /** Dónde va: 0 abajo, 1 arriba. */
  readonly altura: number;
  /** Cuántos muñecos van parados en sus brazos (o agarrados de ella). */
  readonly encima: number;
  /** Llama a `aviso` cada vez que llega arriba. Devuelve cómo dejar de escuchar. */
  alLlegarArriba(aviso: () => void): () => void;
  /** La deja abajo, quieta. */
  volver(): void;
}

export function armarAncla(h: Herramientas, p: Extract<PiezaDeLaMingaEnPlano, { cual: "ancla" }>): Ancla {
  const { rapier, mundo } = h;
  const a = AJUSTES_MINGA.ancla;
  const { centro, medio, giro } = p.caja;
  // Lo alto de los brazos (donde se pisa) va de lo bajo de la caja a lo alto
  const abajo = centro.clone().setY(centro.y - medio.y - a.brazos.grueso / 2);
  const arribaDonde = centro.clone().setY(centro.y + medio.y - a.brazos.grueso / 2);
  const recorrido = arribaDonde.y - abajo.y;

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(abajo.x, abajo.y, abajo.z)
      .setRotation({ x: giro.x, y: giro.y, z: giro.z, w: giro.w }),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.brazos.medio, a.brazos.grueso / 2, a.brazos.fondo).setFriction(1),
    cuerpo,
  );
  // La caña es solo imagen: si chocara, el rayo de la suspensión del que se para justo en el medio la pisaría
  const imagen = crearImagenAncla(h.oscuro, a.brazos.medio, a.cana.alto);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  // La cadena, del arganeo (arriba de la caña) al escobén
  const escoben = centro
    .clone()
    .setY(centro.y + medio.y + a.escoben.arriba)
    .addScaledVector(EJE_Z.clone().applyQuaternion(giro), -a.escoben.atras);
  const eslabones = 48;
  const cadena = new THREE.InstancedMesh(new THREE.TorusGeometry(0.06, 0.018, 5, 8), h.oscuro, eslabones);
  cadena.frustumCulled = false;
  h.escena.add(cadena);

  const giroInverso = new THREE.Quaternion();
  const local = new THREE.Vector3();
  const encimaDe = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroInverso.copy(cuerpo.rotation()).invert();
    local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroInverso);
    return (
      Math.abs(local.x) <= a.brazos.medio + a.borde &&
      Math.abs(local.z) <= a.brazos.fondo + a.borde &&
      local.y > a.encima[0] &&
      local.y < a.encima[1]
    );
  };

  let estado: EstadoAncla = "abajo";
  let altura = 0;
  let encima = 0;
  let espera = 0;
  const avisos = new Set<() => void>();
  h.antes((munecos) => {
    encima = munecos.filter((m) => encimaDe(m.partes.pelvis.translation()) || quienAgarra([m], cuerpo) !== null).length;
    if (estado === "abajo") {
      espera = encima > 0 ? espera + PASO : 0;
      if (espera >= p.espera) estado = "subiendo";
    } else if (estado === "subiendo") {
      altura = Math.min(1, altura + (p.velocidad * PASO) / recorrido);
      if (altura >= 1) {
        estado = "arriba";
        espera = 0;
        for (const aviso of avisos) aviso();
      }
    } else if (estado === "arriba") {
      espera = encima === 0 ? espera + PASO : 0;
      if (espera >= p.arriba) estado = "bajando";
    } else {
      // Bajando: si alguien se sube, la vuelven a subir
      if (encima > 0) estado = "subiendo";
      else {
        altura = Math.max(0, altura - (p.velocidad * PASO) / recorrido);
        if (altura <= 0) {
          estado = "abajo";
          espera = 0;
        }
      }
    }
    cuerpo.setNextKinematicTranslation(abajo.clone().lerp(arribaDonde, altura));
  });

  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let alturaVista = 0;
  let estadoVisto: EstadoAncla = "abajo";
  h.guardar(() => {
    const y = cuerpo.translation().y;
    const nueva = limitar((y - abajo.y) / recorrido, 0, 1);
    estadoVisto =
      nueva > alturaVista + 1e-4
        ? "subiendo"
        : nueva < alturaVista - 1e-4
          ? "bajando"
          : nueva > 0.99
            ? "arriba"
            : "abajo";
    alturaVista = nueva;
  });
  const matriz = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  const punto = new THREE.Vector3();
  h.dibujar(() => {
    const arganeo = imagen.position.clone().addScaledVector(ARRIBA, a.brazos.grueso / 2 + a.cana.alto + 0.08);
    const tramo = escoben.clone().sub(arganeo);
    const largo = tramo.length();
    const n = Math.min(eslabones, Math.ceil(largo / 0.1));
    const dir = tramo.clone().normalize();
    for (let i = 0; i < eslabones; i++) {
      if (i >= n) {
        matriz.makeScale(0, 0, 0);
        cadena.setMatrixAt(i, matriz);
        continue;
      }
      punto.copy(arganeo).addScaledVector(dir, (i + 0.5) * (largo / n));
      // Cada eslabón girado 90° del anterior, a lo largo de la cadena
      q.setFromUnitVectors(EJE_X, dir).multiply(
        new THREE.Quaternion().setFromAxisAngle(EJE_X, (i % 2) * (Math.PI / 2)),
      );
      matriz.compose(punto, q, s);
      cadena.setMatrixAt(i, matriz);
    }
    cadena.instanceMatrix.needsUpdate = true;
  });

  return {
    cual: "ancla",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return simulado ? estado : estadoVisto;
    },
    get altura() {
      return simulado ? altura : alturaVista;
    },
    get encima() {
      return encima;
    },
    alLlegarArriba(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      estado = "abajo";
      altura = 0;
      espera = 0;
      cuerpo.setTranslation(abajo, true);
      cuerpo.setNextKinematicTranslation(abajo);
    },
  };
}

/** El ancla de almirantazgo: los brazos con sus uñas (a lo largo de su x), la caña, el cepo arriba y el arganeo. En
 * su marco, lo de arriba de los brazos en y = brazos/2 (donde se pisa). */
export function crearImagenAncla(oscuro: THREE.Material, medioBrazos: number, cana: number) {
  const grupo = new THREE.Group();
  const partes: THREE.BufferGeometry[] = [];
  // Los brazos: un arco que sube hacia las puntas, con su uña
  for (const s of [-1, 1]) {
    partes.push(
      new THREE.BoxGeometry(medioBrazos, 0.12, 0.16).rotateZ(s * 0.18).translate((s * medioBrazos) / 2, 0.02, 0),
      new THREE.ConeGeometry(0.16, 0.34, 4).rotateZ(s * -0.6).translate(s * medioBrazos * 0.98, 0.2, 0),
    );
  }
  // La plataforma donde se pisa (la cruz, ancha)
  partes.push(new THREE.BoxGeometry(medioBrazos * 1.2, 0.08, 0.5).translate(0, 0.02, 0));
  // La caña, el cepo (cruzado) y el arganeo
  partes.push(new THREE.BoxGeometry(0.12, cana, 0.12).translate(0, 0.06 + cana / 2, 0));
  partes.push(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 7).rotateX(Math.PI / 2).translate(0, 0.06 + cana - 0.18, 0));
  partes.push(new THREE.TorusGeometry(0.1, 0.025, 6, 10).translate(0, 0.06 + cana + 0.05, 0));
  grupo.add(new THREE.Mesh(juntar(partes), oscuro));
  return grupo;
}

// ── Adornos de La minga (los pone el guion) ─────────────────────────────────────────────────────────────────

/** Un palafito: la casa de tejuelas sobre pilotes, con su corredor adelante (+z) y el techo de dos aguas a lo largo
 * de x. «De colores» en Chiloé; acá, cada uno de un gris. En su marco: el piso del corredor en y = 0, de x −largo/2 a
 * +largo/2; la casa ocupa z de −fondo a −corredor, el corredor de −corredor a 0; los pilotes bajan `pilotes` metros. */
export function crearPalafito(
  gris: number,
  {
    largo,
    fondo,
    corredor,
    alto,
    pilotes,
  }: { largo: number; fondo: number; corredor: number; alto: number; pilotes: number },
) {
  const grupo = new THREE.Group();
  const tejuelas = materialCorteza(gris, { repetir: [Math.round(largo), 3], relieve: 6 });
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 3] });
  const hondo = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const casa = fondo - corredor;
  const zc = -corredor - casa / 2;
  grupo.add(new THREE.Mesh(new THREE.BoxGeometry(largo, alto, casa).translate(0, alto / 2, zc), tejuelas));
  // Techo de dos aguas (la cumbrera a lo largo de x)
  const subida = Math.min(1.2, casa * 0.45);
  const alero = 0.25;
  const ancho = Math.hypot(casa / 2 + alero, subida);
  const angulo = Math.atan2(subida, casa / 2 + alero);
  for (const s of [-1, 1]) {
    const agua = new THREE.Mesh(new THREE.BoxGeometry(largo + 0.4, 0.08, ancho), madera);
    agua.position.set(0, alto + subida / 2, zc + (s * (casa / 2 + alero)) / 2);
    agua.rotation.x = s * angulo;
    grupo.add(agua);
  }
  const fronton = new THREE.Shape();
  fronton.moveTo(-casa / 2, 0);
  fronton.lineTo(casa / 2, 0);
  fronton.lineTo(0, subida);
  fronton.closePath();
  const geometriaFronton = new THREE.ShapeGeometry(fronton).rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(geometriaFronton, tejuelas);
    f.position.set((s * largo) / 2, alto, zc);
    grupo.add(f);
  }
  // Puerta y ventanas hacia el corredor
  const huecos = [
    new THREE.BoxGeometry(0.75, 1.5, 0.04).translate(-largo * 0.25, 0.75, -corredor + 0.01),
    new THREE.BoxGeometry(0.6, 0.55, 0.04).translate(largo * 0.05, alto * 0.55, -corredor + 0.01),
    new THREE.BoxGeometry(0.6, 0.55, 0.04).translate(largo * 0.3, alto * 0.55, -corredor + 0.01),
  ];
  grupo.add(new THREE.Mesh(juntar(huecos), hondo));
  // Los pilotes, bajo la casa y el corredor, y la baranda del corredor (de adorno, abierta en las puntas)
  const palos: THREE.BufferGeometry[] = [];
  for (let x = -largo / 2 + 0.2; x <= largo / 2 - 0.1; x += 1.2) {
    for (const z of [-fondo + 0.2, -corredor - 0.2, -0.15]) {
      palos.push(new THREE.CylinderGeometry(0.1, 0.12, pilotes, 6).translate(x, -pilotes / 2, z));
    }
  }
  palos.push(new THREE.BoxGeometry(largo, 0.18, fondo).translate(0, -0.09, -fondo / 2));
  grupo.add(new THREE.Mesh(juntar(palos), madera));
  return grupo;
}

/** El curanto enterrado del secreto: un montículo de tierra tapado con hojas de nalca, con su vapor. En su marco, el
 * pie en y = 0. Las hojas y el vapor son lo único claro de la playa. */
export function crearCuranto(): THREE.Group {
  const grupo = new THREE.Group();
  const tierra = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.45, 0.8),
    materialTela(COLORES.suelo, { repetir: 1, pelusa: false }),
  );
  grupo.add(tierra);
  // Las hojas de nalca, grandes y claras, sobre el montículo
  const claro = materialTela(COLORES.niebla, { repetir: 1, pelusa: false });
  claro.side = THREE.DoubleSide;
  for (let i = 0; i < 5; i++) {
    const hoja = new THREE.Mesh(new THREE.CircleGeometry(0.32, 7).rotateX(-Math.PI / 2 + 0.35), claro);
    const ang = (i / 5) * Math.PI * 2;
    hoja.position.set(Math.cos(ang) * 0.22, 0.2, Math.sin(ang) * 0.18);
    hoja.rotation.y = -ang;
    grupo.add(hoja);
  }
  // Las piedras calientes asomando y el vapor que sube
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), materialTela(COLORES.silueta, { pelusa: false }));
    p.position.set(Math.cos(i * 1.9) * 0.5, 0.03, Math.sin(i * 1.9) * 0.4);
    grupo.add(p);
  }
  const vapor = materialOjo();
  vapor.transparent = true;
  vapor.opacity = 0.45;
  for (let i = 0; i < 3; i++) {
    const v = new THREE.Mesh(new THREE.SphereGeometry(0.12 + i * 0.05, 8, 6), vapor);
    v.position.set(0.05 * Math.sin(i * 2), 0.42 + i * 0.28, 0.04 * Math.cos(i * 3));
    v.name = `vapor-${i}`;
    grupo.add(v);
  }
  return grupo;
}

/** La iglesia de madera de Chiloé, de lejos: la nave de tejuelas, el pórtico y la torre de tres cuerpos. En su
 * marco: el pie en y = 0, el frente hacia +x. */
export function crearIglesiaChilota(material: THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  const partes = [
    new THREE.BoxGeometry(9, 3.2, 4.4).translate(-4.5, 1.6, 0),
    // El techo de la nave
    new THREE.CylinderGeometry(0.01, 3, 1.6, 4, 1)
      .rotateY(Math.PI / 4)
      .scale(3.1, 1, 0.74)
      .translate(-4.5, 4, 0),
    // El pórtico con sus arcos (de lejos, una caja más baja) y la torre, cada cuerpo más angosto
    new THREE.BoxGeometry(1.4, 2.8, 4.4).translate(0.7, 1.4, 0),
    new THREE.BoxGeometry(1.8, 2.2, 1.8).translate(0.2, 4.3, 0),
    new THREE.BoxGeometry(1.4, 1.6, 1.4).translate(0.2, 6.2, 0),
    new THREE.BoxGeometry(1, 1.2, 1).translate(0.2, 7.6, 0),
    new THREE.ConeGeometry(0.75, 2.4, 4).rotateY(Math.PI / 4).translate(0.2, 9.4, 0),
  ];
  grupo.add(new THREE.Mesh(juntar(partes), material));
  return grupo;
}

/** Una nalca: hojas enormes, ásperas y lobuladas, sobre tallos gruesos que salen de una mata baja, del bosque
 * mojado. En su marco, el pie en y = 0. */
export function crearNalca(material: THREE.Material, alto: number, semilla: number): THREE.Group {
  const grupo = new THREE.Group();
  const hojas = 4 + (semilla % 3);
  const radio = alto * 0.36;
  // La hoja: un disco con lóbulos, un poco ahuecado
  const hoja = new THREE.CircleGeometry(radio, 18);
  const pos = hoja.getAttribute("position");
  for (let j = 0; j < pos.count; j++) {
    const x = pos.getX(j);
    const y = pos.getY(j);
    const r = Math.hypot(x, y) / radio;
    const lobulo = 1 + 0.16 * Math.sin(Math.atan2(y, x) * 7 + semilla);
    pos.setXYZ(j, x * lobulo, y * lobulo, -0.25 * r * r * radio);
  }
  hoja.computeVertexNormals();
  hoja.rotateX(-Math.PI / 2);
  for (let i = 0; i < hojas; i++) {
    const ang = semilla * 1.3 + (i / hojas) * Math.PI * 2;
    const largo = alto * (0.6 + 0.3 * Math.abs(Math.sin(semilla * 2 + i)));
    const afuera = 0.25 + 0.2 * Math.abs(Math.cos(semilla + i));
    const punta = new THREE.Vector3(Math.cos(ang) * afuera * largo, largo, Math.sin(ang) * afuera * largo);
    const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 1, 5).translate(0, 0.5, 0), material);
    tallo.quaternion.setFromUnitVectors(ARRIBA, punta.clone().normalize());
    tallo.scale.set(1, punta.length(), 1);
    grupo.add(tallo);
    const h = new THREE.Mesh(hoja, material);
    h.position.copy(punta);
    // Inclinada hacia afuera, como un paraguas vencido
    h.rotation.set(Math.sin(ang) * 0.6, -ang, -Math.cos(ang) * 0.6);
    grupo.add(h);
  }
  return grupo;
}
