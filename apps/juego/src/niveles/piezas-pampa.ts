// Las piezas que estrena La pampa (TU-48), menos La Luz Mala (luz-mala.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-pampa.ts) y se arma con las herramientas de piezas.ts, como las del llano:
//
//   pampero       el viento de la pampa: sopla siempre un poco hacia el frente de su caja y, a ratos, en ráfagas
//                 (azar de semilla). Empuja a los muñecos que están adentro, cierra las tranqueras y apura al chambergo.
//   tranquera     una puerta de varas que se abre jalándola de la manija, solo hacia su frente. El viento la cierra
//                 de golpe si nadie la sostiene. Los muñecos atraviesan la hoja (la agarran de la manija), pero los
//                 ataja su sombra: un cuerpo cinemático que la sigue y no se deja empujar.
//   boleadoras    tres bolas atadas: se lanzan saltando y soltándolas en el aire. Tiradas, vuelven solas.
//   chambergo     el sombrero que se llevó el viento: vuela solo dentro de su caja y no se alcanza con la mano. Unas
//                 boleadoras que vuelan de verdad y le pasan cerca lo enredan, y cae.
//   pie-de-amigo  parado en su caja con los dos brazos alzados, un muñeco hace la escalerita: sus manos son un
//                 escalón para el otro (solo para el otro).
//   candil        un farol de lata que se lleva en la mano: ahí adentro se encierra la Luz.
//
// Todo lo que se mueve (el marcador del pampero, la hoja y su sombra, las boleadoras, el chambergo, el escalón y el
// candil) viaja en la foto de la red. El invitado no simula: ve el viento por el marcador, hace girar las boleadoras
// que ve volar y prende el candil si ve la Luz adentro.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
import { adentro } from "./formato";
import type { PiezaDeLaPampaEnPlano } from "./formato-pampa";
import type { Herramientas } from "./piezas";
import { manosEn } from "./piezas-pinar";

type Plano<C extends PiezaDeLaPampaEnPlano["cual"]> = Extract<PiezaDeLaPampaEnPlano, { cual: C }>;

/** El bit de grupo de choque de la pampa. Lo suelto (las boleadoras, el candil, la manija de la tranquera) choca con
 * todo menos con los muñecos (bits 1 y 2), que lo agarran igual. */
const BIT_PAMPA = 1 << 6;
export const GRUPOS_PAMPA = ((BIT_PAMPA << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se lo encuentra para agarrarlo, pero no empuja ni lo empujan. */
const SIN_EMPUJAR = (BIT_PAMPA << 16) >>> 0;
/** Lo que choca solo con los muñecos (la sombra de la tranquera): la cámara y el rayo del piso no lo ven. */
const SOLO_MUNECOS = ((BIT_PAMPA << 16) | 0b110) >>> 0;
/** El rayo que busca el piso: no ve a los muñecos (bits 1 y 2), como el de nivel.ts. */
const SOLO_EL_PISO = ((1 << 16) | (0xffff & ~0b110)) >>> 0;
/** Donde se esconde lo que no está (el escalón sin nadie que haga pie), lejos de todo. */
export const ESCONDIDO_PAMPA = -40;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Los números de las piezas de la pampa que no se ponen desde Blender. */
export const AJUSTES_PAMPA = {
  pampero: {
    /** Las rayas del viento: cuántas, su largo (m) y a qué velocidad corren, con calma y en lo más fuerte (m/s). */
    rayas: 34,
    largo: 1.4,
    velocidad: [3, 11],
  },
  tranquera: {
    /** Cuánto se resiste el viento según sople: con calma, `calma` veces la fuerza; en lo más fuerte, `rafaga`. */
    calma: 0.85,
    rafaga: 1.35,
    /** El roce de la bisagra (N·m·s/rad): para que no tiemble. */
    roce: 3,
    /** Abierta más que esto (radianes) y cerrada de nuevo (menos que `cerrada`), fue un golpe: la soltaron. */
    golpe: 0.5,
    cerrada: 0.06,
    /** Abierta más que esto (de 0 a 1 de lo que se abre), ya se pasa. */
    abierta: 0.55,
    /** La manija: cuánto antes de la punta va (m), su alto sobre la base, cuánto sobresale por delante, y su medio
     * largo, medio ancho y medio grueso. */
    manija: { punta: 0.3, alto: 1.15, adelante: 0.1, medio: 0.24, ancho: 0.1, grueso: 0.07 },
    /** La sombra que ataja a los muñecos: hasta qué alto (m) y desde y hasta cuánto detrás de la hoja. */
    sombra: { alto: 2.7, atras: [0.06, 0.24] },
    /** El portazo al que quedó del lado de adentro: cerrándose más rápido que `cerrando` (rad/s) con él a menos de
     * `cerca` detrás de la hoja (m), o con la tranquera abierta menos que `angulo` (radianes). Hasta `afuera` más allá
     * de la punta. Sale volteado (m/s: con más de 3.2, se cae) y la tranquera rebota (rad/s). */
    portazo: {
      cerrando: 0.3,
      cerca: 0.9,
      angulo: 0.35,
      afuera: 0.3,
      empujon: 3.6,
      frente: 1.2,
      arriba: 1.2,
      rebote: 1.6,
      espera: 0.6,
    },
  },
  boleadoras: {
    /** Soltadas más rápido que esto (m/s), van volando; si no, solo se cayeron. */
    lanzadas: 2.2,
    /** Radio de su choque (m): una pelota que encuentran las manos. */
    radio: 0.17,
    /** Tiradas más abajo que esto de su lugar (m), cuentan como en el suelo. */
    bajo: 0.4,
  },
  chambergo: {
    /** Para que cuente, lo que tienen que haber volado las boleadoras desde que las soltaron (m): no se lo enreda
     * llevándolas en la mano. */
    vuelo: 1,
    /** Qué parte de la caja recorre (de 0 a 1), a lo largo y a lo ancho. */
    recorre: 0.85,
    /** Con el viento quieto vuela a `calma` veces su velocidad; en lo más fuerte, a `rafaga` veces. */
    calma: 0.75,
    rafaga: 1.5,
  },
  pieDeAmigo: {
    /** El grueso del escalón (m). */
    grueso: 0.14,
    /** Cuánto más allá de su caja todavía se hace pie (m). */
    margen: 0.15,
  },
  candil: {
    /** Más bajo que esto bajo donde empezó (m), y tantos segundos sin nadie, vuelve solo. */
    bajo: 0.5,
    vuelveSolo: 20,
    /** La luz: blanca, como los ojos (el único color del juego son los pañuelos). */
    luz: { intensidad: 6, alcance: 8 },
    /** A esta distancia de la Luz (m), la ve adentro (para el invitado). */
    adentro: 0.3,
  },
} as const;

/** Si ese colisionador está tocando algo (después del paso). */
function tocaAlgo(mundo: RAPIER.World, colisionador: RAPIER.Collider): boolean {
  let toca = false;
  mundo.contactPairsWith(colisionador, (otro) => {
    if (toca) return;
    mundo.contactPair(colisionador, otro, (manifold) => {
      if (manifold.numContacts() > 0) toca = true;
    });
  });
  return toca;
}

/** Lo pone ahí, quieto (y mueve ya sus colisionadores, para que los rayos no lo vean en el lugar viejo). */
function devolver(mundo: RAPIER.World, cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3Like, giro: THREE.Quaternion) {
  cuerpo.setTranslation(vector(posicion), true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
  mundo.propagateModifiedBodyPositionsToColliders();
}

/** Lo cuelga: cinemático, quieto donde está. */
function colgar(rapier: Rapier, cuerpo: RAPIER.RigidBody) {
  cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
}

/** Lo descuelga: suelto otra vez (la mano que lo agarró sigue unida). */
function descolgar(rapier: Rapier, cuerpo: RAPIER.RigidBody) {
  cuerpo.setBodyType(rapier.RigidBodyType.Dynamic, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
}

/** Un cilindro de `radio` de `a` a `b` (para palos y cordones). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 6): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** El pampero que sopla donde está ese punto (el primero de la lista), o `null`. */
function pamperoEn(h: Herramientas, p: THREE.Vector3Like): Pampero | null {
  for (const q of h.lista) if (q.cual === "pampero" && q.adentro(p)) return q;
  return null;
}

// ── El pampero ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Pampero {
  readonly cual: "pampero";
  readonly nombre: string;
  /** El marcador (cinemático, sin choques): en el medio de la caja, corrido en x lo que sopla. Viaja en la foto. */
  readonly marcador: RAPIER.RigidBody;
  /** Qué tan fuerte sopla ahora: `calma` entre ráfagas, 1 en lo más fuerte de una. */
  readonly soplo: number;
  /** Cuántas ráfagas sopló. */
  readonly rafagas: number;
  /** Hacia dónde sopla: horizontal, de largo 1. */
  readonly direccion: THREE.Vector3;
  /** Si ese punto está donde sopla. */
  adentro(p: THREE.Vector3Like): boolean;
}

export function armarPampero(h: Herramientas, p: Plano<"pampero">): Pampero {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.pampero;
  const { centro, medio, giro } = p.caja;
  const direccion = new THREE.Vector3(0, 0, 1).applyQuaternion(giro).setY(0).normalize();
  const marcador = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x + p.calma, centro.y, centro.z),
  );

  // Las ráfagas: cuándo empieza la próxima y cuánto dura (en pasos), con azar de semilla
  const azar = crearAzar(p.semilla ^ 0x51ed27);
  const pasos = (s: number) => Math.max(1, Math.round(s / PASO));
  let paso = 0;
  let inicio = pasos(p.cada * (0.4 + 0.6 * azar()));
  let dura = pasos(p.dura * (0.6 + 0.8 * azar()));
  let soplo = p.calma;
  let rafagas = 0;

  h.antes((munecos) => {
    paso++;
    if (paso >= inicio + dura) {
      inicio = paso + pasos(p.cada * (0.5 + azar()));
      dura = pasos(p.dura * (0.6 + 0.8 * azar()));
    }
    const t = (paso - inicio) / dura;
    if (t >= 0 && t < 1) {
      if (paso === inicio) rafagas++;
      soplo = p.calma + (1 - p.calma) * Math.sin(Math.PI * t);
    } else soplo = p.calma;
    marcador.setNextKinematicTranslation({ x: centro.x + soplo, y: centro.y, z: centro.z });
    // Empuja a los muñecos que están adentro: todas sus partes, como el ventarrón de la noche de tuerce
    const empuje = p.fuerza * soplo * PASO;
    for (const m of munecos) {
      if (!adentro(p.caja, m.partes.pelvis.translation())) continue;
      for (const c of Object.values(m.partes)) {
        const masa = c.mass() * empuje;
        c.applyImpulse({ x: direccion.x * masa, y: 0, z: direccion.z * masa }, true);
      }
    }
  });

  // Las rayas del viento: corren hacia donde sopla, más rápido y más marcadas cuanto más sopla. Lo que sopla lo
  // dice el marcador, así el invitado las ve igual
  const largo = Math.abs(new THREE.Vector3(medio.x, 0, medio.z).applyQuaternion(giro).dot(direccion)) || medio.z;
  const ancho = new THREE.Vector3(direccion.z, 0, -direccion.x);
  const anchoMedio = Math.abs(new THREE.Vector3(medio.x, 0, medio.z).applyQuaternion(giro).dot(ancho)) || medio.x;
  const material = new THREE.MeshBasicMaterial({
    name: "viento",
    color: COLORES.siluetaLejana,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const geometria = new THREE.BoxGeometry(0.012, 0.012, a.largo);
  const rayas: { malla: THREE.Mesh; u: number; v: number; y: number; rapidez: number }[] = [];
  const azarRayas = crearAzar(p.semilla ^ 0x7a1);
  const rumbo = Math.atan2(direccion.x, direccion.z);
  for (let i = 0; i < a.rayas; i++) {
    const malla = new THREE.Mesh(geometria, material);
    malla.rotation.y = rumbo;
    malla.name = `${p.nombre}-raya`;
    h.escena.add(malla);
    rayas.push({
      malla,
      u: (azarRayas() * 2 - 1) * largo,
      v: (azarRayas() * 2 - 1) * anchoMedio,
      y: centro.y - medio.y + 0.3 + azarRayas() * Math.min(2.6, medio.y * 2 - 0.3),
      rapidez: 0.7 + 0.6 * azarRayas(),
    });
  }
  let visto = p.calma;
  const ubicar = () => {
    for (const r of rayas) {
      r.malla.position
        .copy(centro)
        .addScaledVector(direccion, r.u)
        .addScaledVector(ancho, r.v)
        .setY(r.y + 0.08 * Math.sin(r.u * 1.7 + r.v));
    }
  };
  ubicar();
  h.guardar(() => {
    visto = limitar(marcador.translation().x - centro.x, 0, 1);
    const rapidez = a.velocidad[0] + (a.velocidad[1] - a.velocidad[0]) * visto;
    for (const r of rayas) {
      r.u += rapidez * r.rapidez * PASO;
      if (r.u > largo) r.u -= 2 * largo;
    }
    ubicar();
  });
  h.dibujar(() => {
    material.opacity = 0.06 + 0.4 * visto * visto;
  });

  return {
    cual: "pampero",
    nombre: p.nombre,
    marcador,
    get soplo() {
      return soplo;
    },
    get rafagas() {
      return rafagas;
    },
    direccion,
    adentro: (q) => adentro(p.caja, q),
  };
}

// ── La tranquera ─────────────────────────────────────────────────────────────────────────────────────────────

export interface Tranquera {
  readonly cual: "tranquera";
  readonly nombre: string;
  /** La hoja de varas: dinámica, la mueven el viento y las manos. Los muñecos la atraviesan y la agarran de la
   * manija, que sobresale por delante. */
  readonly hoja: RAPIER.RigidBody;
  /** Su sombra, que ataja a los muñecos: un cuerpo cinemático que va donde va la hoja, un poco detrás de ella, y no
   * se deja empujar. */
  readonly sombra: RAPIER.RigidBody;
  /** Cuánto está abierta (radianes, hacia su frente; 0 cerrada). */
  readonly angulo: number;
  /** De 0 (cerrada) a 1 (abierta del todo). */
  readonly apertura: number;
  /** Si está abierta lo bastante para pasar. */
  readonly abierta: boolean;
  /** Cuántos muñecos la tienen agarrada de la manija. */
  readonly sostenida: number;
  /** Si quedó trabada abierta (`trabar`): el viento ya no la cierra. */
  readonly trabada: boolean;
  /** Cuántas veces se cerró de golpe: la abrieron y la soltaron. */
  readonly golpes: number;
  /** Cuántas veces le pegó a alguien que se quedó en el medio (lo voltea hacia afuera y rebota). */
  readonly portazos: number;
  /** La traba abierta donde está (o, con `ya`, abierta casi del todo, de una vez). */
  trabar(ya?: boolean): void;
  /** Llama a `aviso` cada vez que se cierra de golpe. Devuelve cómo dejar de escuchar. */
  alGolpe(aviso: () => void): () => void;
  /** Llama a `aviso` cada vez que le pega a alguien, con quién. Devuelve cómo dejar de escuchar. */
  alPortazo(aviso: (jugador: 0 | 1) => void): () => void;
  /** La cierra y la destraba. */
  volver(): void;
}

export function armarTranquera(h: Herramientas, p: Plano<"tranquera">): Tranquera {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.tranquera;
  const { centro, medio, giro } = p.caja;
  const base = -medio.y;
  const bisagra = h.enElMundo(p, -medio.x, 0, 0);
  const largo = medio.x * 2;

  // Los dos postes, fijos: el de la bisagra y el de la manija. Atajan hasta arriba, como la sombra
  const postes = h.fijo(centro, giro);
  for (const x of [-medio.x - 0.09, medio.x + 0.09]) {
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(0.09, a.sombra.alto / 2, 0.12).setTranslation(x, base + a.sombra.alto / 2, 0),
      postes,
    );
  }

  // La hoja: su peso repartido a lo largo (sin choques) y la manija cerca de la punta, que sobresale por delante,
  // se agarra y no empuja
  const ancla = h.fijo(bisagra, giro);
  const hoja = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(0.2));
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setMass(p.masa).setCollisionGroups(0).setSolverGroups(0),
    hoja,
  );
  const m = a.manija;
  const manija = new THREE.Vector3(medio.x - m.punta, base + m.alto, m.adelante);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(m.ancho, m.medio, m.grueso)
      .setTranslation(manija.x, manija.y, manija.z)
      .setMass(0.3)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_PAMPA)
      .setSolverGroups(SIN_EMPUJAR),
    hoja,
  );
  const junta = mundo.createImpulseJoint(
    rapier.JointData.revolute(CERO, { x: -medio.x, y: 0, z: 0 }, ARRIBA),
    ancla,
    hoja,
    true,
  );
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.RevoluteImpulseJoint) {
    // En una bisagra, Rapier ignora los topes de JointData: van después de crearla. Abrirse hacia el frente (+z de la
    // caja) es girar hacia −y
    junta.setLimits(-p.abrir, 0);
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorVelocity(0, a.roce);
  }

  // La sombra: va donde va la hoja (un paso después), un poco detrás, de punta a punta y hasta arriba. Ataja a los
  // muñecos; las manos que vienen de atrás la tocan antes que a la manija
  const s = a.sombra;
  const sombra = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x + 0.02, s.alto / 2, (s.atras[1] - s.atras[0]) / 2)
      .setTranslation(0.02, base + s.alto / 2, -(s.atras[0] + s.atras[1]) / 2)
      .setCollisionGroups(SOLO_MUNECOS),
    sombra,
  );

  const objeto = crearImagenTranquera(h, medio, manija);
  objeto.name = p.nombre;
  h.mover(hoja, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo: hoja, colisionador });
  const imagenPostes = new THREE.Mesh(
    juntar(
      [-medio.x - 0.09, medio.x + 0.09].map((x) =>
        new THREE.CylinderGeometry(0.09, 0.11, medio.y * 2 + 0.45, 8).translate(x, 0.45 / 2, 0),
      ),
    ),
    h.madera,
  );
  imagenPostes.position.copy(centro);
  imagenPostes.quaternion.copy(giro);
  h.escena.add(imagenPostes);

  const giroInverso = giro.clone().invert();
  const d = new THREE.Vector3();
  const q = new THREE.Quaternion();
  /** Cuánto está abierta, con la hoja como está ahora. */
  const medir = () => {
    d.copy(EJE_X).applyQuaternion(q.copy(hoja.rotation())).applyQuaternion(giroInverso);
    return Math.max(0, Math.atan2(d.z, d.x));
  };
  let angulo = 0;
  let anterior = 0;
  let maximo = 0;
  let sostenida = 0;
  let trabada = false;
  let golpes = 0;
  let portazos = 0;
  const espera: [number, number] = [0, 0];
  const avisosGolpe = new Set<() => void>();
  const avisosPortazo = new Set<(jugador: 0 | 1) => void>();
  const ponerAbierta = (theta: number) => {
    const rot = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, -theta));
    const c = new THREE.Vector3(medio.x, 0, 0).applyQuaternion(rot).add(bisagra);
    hoja.setTranslation(vector(c), true);
    hoja.setRotation(rot, true);
    hoja.setLinvel(CERO, true);
    hoja.setAngvel(CERO, true);
    sombra.setTranslation(vector(c), true);
    sombra.setRotation(rot, true);
    mundo.propagateModifiedBodyPositionsToColliders();
    angulo = theta;
    anterior = theta;
  };

  h.antes(() => {
    // La sombra sigue a la hoja
    sombra.setNextKinematicTranslation(hoja.translation());
    sombra.setNextKinematicRotation(hoja.rotation());
    if (trabada) return;
    // El viento la cierra: un empuje parejo (lo que hay que hacer en la manija no depende de cuánto esté abierta),
    // más fuerte en las ráfagas
    const theta = medir();
    if (theta <= 0.002) return;
    const pampero = pamperoEn(h, bisagra);
    const soplo = pampero ? pampero.soplo : 0.5;
    const torque = p.fuerza * largo * (a.calma + (a.rafaga - a.calma) * soplo);
    hoja.applyTorqueImpulse({ x: 0, y: torque * PASO, z: 0 }, true);
  });

  /** Dónde está ese punto respecto de la hoja: a lo largo (desde la bisagra), delante de la hoja como está y delante
   * de la hoja cerrada (m, en el plano). */
  const local = new THREE.Vector3();
  const relativo = (punto: THREE.Vector3Like, theta: number) => {
    local.copy(punto).sub(bisagra).applyQuaternion(giroInverso);
    const [c, sn] = [Math.cos(theta), Math.sin(theta)];
    return { aLoLargo: local.x * c + local.z * sn, delante: -local.x * sn + local.z * c, delanteCerrada: local.z };
  };
  h.despues((munecos) => {
    angulo = medir();
    const cerrando = (anterior - angulo) / PASO;
    anterior = angulo;
    sostenida = munecos.filter((mu) => manosEn(mu, hoja) > 0).length;
    if (trabada) return;
    // El portazo: el que quedó del lado de adentro (entre la hoja y donde cierra) cuando se le viene encima, o
    // cuando ya casi cierra, sale volteado hacia afuera y la tranquera rebota. Así nadie pasa al otro lado
    // arrastrado por la tranquera
    for (const j of [0, 1] as const) {
      espera[j] = Math.max(0, espera[j] - PASO);
      const mu = munecos[j];
      if (!mu || espera[j] > 0) continue;
      const r = relativo(mu.partes.pelvis.translation(), angulo);
      const adentro =
        r.aLoLargo > -0.2 && r.aLoLargo < largo + a.portazo.afuera && r.delante < -0.1 && r.delanteCerrada > -0.05;
      if (!adentro) continue;
      const encima = cerrando > a.portazo.cerrando && r.delante > -a.portazo.cerca;
      if (!encima && angulo > a.portazo.angulo) continue;
      portazos++;
      espera[j] = a.portazo.espera;
      // Hacia afuera: lejos de la bisagra y hacia el frente de la hoja cerrada
      const afuera = new THREE.Vector3(local.x, 0, local.z).normalize().multiplyScalar(a.portazo.empujon);
      afuera.z += a.portazo.frente;
      afuera.applyQuaternion(giro);
      for (const c of Object.values(mu.partes)) {
        c.setLinvel({ x: afuera.x, y: a.portazo.arriba, z: afuera.z }, true);
      }
      hoja.setAngvel({ x: 0, y: -a.portazo.rebote, z: 0 }, true);
      for (const aviso of avisosPortazo) aviso(j);
    }
    maximo = Math.max(maximo, angulo);
    if (angulo < a.cerrada) {
      if (maximo > a.golpe) {
        golpes++;
        for (const aviso of avisosGolpe) aviso();
      }
      maximo = 0;
    }
  });
  h.guardar(() => {
    angulo = medir();
  });

  return {
    cual: "tranquera",
    nombre: p.nombre,
    hoja,
    sombra,
    get angulo() {
      return angulo;
    },
    get apertura() {
      return limitar(angulo / p.abrir, 0, 1);
    },
    get abierta() {
      return angulo / p.abrir >= a.abierta;
    },
    get sostenida() {
      return sostenida;
    },
    get trabada() {
      return trabada;
    },
    get golpes() {
      return golpes;
    },
    get portazos() {
      return portazos;
    },
    trabar(ya = false) {
      if (ya) ponerAbierta(p.abrir * 0.9);
      if (trabada) return;
      trabada = true;
      maximo = 0;
      hoja.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      hoja.setNextKinematicTranslation(hoja.translation());
      hoja.setNextKinematicRotation(hoja.rotation());
    },
    alGolpe(aviso) {
      avisosGolpe.add(aviso);
      return () => {
        avisosGolpe.delete(aviso);
      };
    },
    alPortazo(aviso) {
      avisosPortazo.add(aviso);
      return () => {
        avisosPortazo.delete(aviso);
      };
    },
    volver() {
      trabada = false;
      maximo = 0;
      hoja.setBodyType(rapier.RigidBodyType.Dynamic, true);
      ponerAbierta(0);
    },
  };
}

/** La tranquera: dos parantes, cinco varas, la diagonal de la riostra y la manija de hierro, en el marco de la hoja
 * (larga a lo largo de su x, con la bisagra en −x). */
function crearImagenTranquera(h: Herramientas, medio: THREE.Vector3, manija: THREE.Vector3) {
  const grupo = new THREE.Group();
  const [mx, my] = [medio.x, medio.y];
  const varas: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(0.11, my * 2, 0.1).translate(-mx + 0.06, 0, 0),
    new THREE.BoxGeometry(0.11, my * 2, 0.1).translate(mx - 0.06, 0, 0),
    new THREE.BoxGeometry(0.08, my * 2, 0.06).translate(0, 0, 0),
  ];
  for (let i = 0; i < 5; i++) {
    const y = -my + 0.12 + ((my * 2 - 0.24) * i) / 4;
    varas.push(new THREE.BoxGeometry(mx * 2 - 0.1, 0.07, 0.05).translate(0, y, 0.03));
  }
  varas.push(palo(new THREE.Vector3(-mx + 0.1, -my + 0.1, -0.03), new THREE.Vector3(mx - 0.1, my - 0.1, -0.03), 0.035));
  grupo.add(new THREE.Mesh(juntar(varas), h.madera));
  // La manija: un asa de hierro que sobresale por delante, con sus dos soportes
  const asa = AJUSTES_PAMPA.tranquera.manija;
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.022, 0.022, asa.medio * 2, 6).translate(manija.x, manija.y, manija.z),
        ...[-1, 1].map((s) =>
          new THREE.BoxGeometry(0.03, 0.03, manija.z + 0.04).translate(
            manija.x,
            manija.y + s * (asa.medio - 0.02),
            manija.z / 2,
          ),
        ),
      ]),
      h.oscuro,
    ),
  );
  return grupo;
}

// ── Las boleadoras ───────────────────────────────────────────────────────────────────────────────────────────

export type EstadoBoleadoras = "en su lugar" | "llevadas" | "volando" | "tiradas" | "enredadas";

export interface Boleadoras {
  readonly cual: "boleadoras";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** En su lugar (colgadas, quietas), llevadas, volando (las lanzaron y no tocaron nada), tiradas o enredadas. */
  readonly estado: EstadoBoleadoras;
  /** Quién las soltó por última vez (0 o 1), o `null`. */
  readonly lanzador: 0 | 1 | null;
  /** Lo que volaron desde que las soltaron (m). */
  readonly recorrido: number;
  /** Cuántas veces las lanzaron. */
  readonly tiros: number;
  /** Quedan enredadas en algo: ya no son sueltas ni chocan, van donde las lleven (`llevar`). */
  enredar(): void;
  /** Enredadas, las pone ahí (`ya`: de una vez). */
  llevar(posicion: THREE.Vector3Like, giro: THREE.Quaternion, ya?: boolean): void;
  /** Las cuelga en su lugar, quietas. */
  volver(): void;
}

export function armarBoleadoras(h: Herramientas, p: Plano<"boleadoras">): Boleadoras {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.boleadoras;
  const { centro, giro } = p.caja;
  // Colgadas en su gancho son cinemáticas (no se caen aunque las roce algo); la mano que las agarra las descuelga
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(1).setLinearDamping(0.05));
  colgar(rapier, cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(a.radio)
      .setMass(p.masa)
      .setFriction(0.8)
      .setRestitution(0.1)
      .setCollisionGroups(GRUPOS_PAMPA),
    cuerpo,
  );
  const imagen = crearImagenBoleadoras(h.oscuro, h.madera);
  imagen.grupo.name = p.nombre;
  h.escena.add(imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let estado: EstadoBoleadoras = "en su lugar";
  let lanzador: 0 | 1 | null = null;
  let ultimo: 0 | 1 | null = null;
  let tiros = 0;
  let tirado = 0;
  const soltadas = new THREE.Vector3();
  const boleadoras: Boleadoras = {
    cual: "boleadoras",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get lanzador() {
      return lanzador;
    },
    get recorrido() {
      if (estado !== "volando") return 0;
      const t = cuerpo.translation();
      return Math.hypot(t.x - soltadas.x, t.y - soltadas.y, t.z - soltadas.z);
    },
    get tiros() {
      return tiros;
    },
    enredar() {
      if (estado === "enredadas") return;
      estado = "enredadas";
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      colisionador.setCollisionGroups(0);
    },
    llevar(posicion, q, ya = false) {
      if (ya) {
        cuerpo.setTranslation(vector(posicion), true);
        cuerpo.setRotation(q, true);
      }
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(q);
    },
    volver() {
      if (estado === "enredadas") colisionador.setCollisionGroups(GRUPOS_PAMPA);
      colgar(rapier, cuerpo);
      devolver(mundo, cuerpo, centro, giro);
      estado = "en su lugar";
      lanzador = null;
      ultimo = null;
      tirado = 0;
    },
  };
  h.despues((munecos, fuera) => {
    if (estado === "enredadas") return;
    const quienes = ([0, 1] as const).filter((j) => {
      const m = munecos[j];
      return m !== undefined && manosEn(m, cuerpo) > 0;
    });
    if (quienes.length > 0) {
      if (estado === "en su lugar") descolgar(rapier, cuerpo);
      estado = "llevadas";
      const [solo] = quienes;
      if (quienes.length === 1 && solo !== undefined) ultimo = solo;
      tirado = 0;
      return;
    }
    const t = cuerpo.translation();
    if (estado === "llevadas") {
      // Las soltaron: si salieron rápido (las lanzó saltando), van volando
      const v = cuerpo.linvel();
      if (Math.hypot(v.x, v.y, v.z) > a.lanzadas) {
        estado = "volando";
        lanzador = ultimo;
        tiros++;
        soltadas.copy(t);
      } else estado = "tiradas";
    }
    if (estado === "volando" && tocaAlgo(mundo, colisionador)) estado = "tiradas";
    if (fuera(t)) {
      boleadoras.volver();
      return;
    }
    // Tiradas en el suelo un rato, vuelven solas a su poste
    if (estado === "tiradas" && t.y < centro.y - a.bajo) {
      tirado += PASO;
      if (tirado > p.vuelve) boleadoras.volver();
    }
  });

  // La imagen sigue al cuerpo sin girar con él: colgadas, las bolas cuelgan; volando, giran abiertas
  const antes = new THREE.Vector3().copy(centro);
  const ahora = new THREE.Vector3().copy(centro);
  let giroBolas = 0;
  let abiertas = 0;
  h.guardar(() => {
    antes.copy(ahora);
    ahora.copy(cuerpo.translation());
    const rapidez = antes.distanceTo(ahora) / PASO;
    // Enredadas en el chambergo (el invitado lo sabe porque las ve pegadas a él) quedan abiertas alrededor del ala
    const enredadas = h.lista.some((q) => {
      if (q.cual !== "chambergo") return false;
      const c = q.cuerpo.translation();
      return Math.hypot(c.x - ahora.x, c.y - ahora.y, c.z - ahora.z) < 0.4;
    });
    const objetivo = enredadas || rapidez > a.lanzadas ? 1 : 0;
    abiertas += (objetivo - abiertas) * 0.25;
    if (!enredadas) giroBolas += (4 + 14 * abiertas) * PASO;
  });
  h.dibujar((alfa) => {
    imagen.grupo.position.lerpVectors(antes, ahora, alfa);
    imagen.posar(abiertas, giroBolas);
  });
  return boleadoras;
}

/** Las boleadoras: tres bolas de piedra forradas en cuero, con sus tientos atados a un nudo. `posar` las abre (de 0,
 * colgando, a 1, girando en un plano) y las gira. */
function crearImagenBoleadoras(oscuro: THREE.Material, cuero: THREE.Material) {
  const grupo = new THREE.Group();
  const bola = new THREE.SphereGeometry(0.07, 10, 8);
  const bolas: THREE.Mesh[] = [];
  const tientos: THREE.Mesh[] = [];
  const tiento = new THREE.CylinderGeometry(0.008, 0.008, 1, 4).translate(0, 0.5, 0);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(bola, i === 2 ? cuero : oscuro);
    const t = new THREE.Mesh(tiento, oscuro);
    grupo.add(b, t);
    bolas.push(b);
    tientos.push(t);
  }
  grupo.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), oscuro));
  const largos = [0.55, 0.55, 0.42];
  const punta = new THREE.Vector3();
  return {
    grupo,
    posar(abiertas: number, giro: number) {
      for (let i = 0; i < 3; i++) {
        const largo = largos[i] ?? 0.5;
        const angulo = giro + (i * Math.PI * 2) / 3;
        // Colgando: casi derecho para abajo, un poco abiertas; volando, en un plano que gira
        const caida = (1 - abiertas) * (Math.PI / 2 - 0.25) + 0.05;
        punta.set(Math.cos(angulo) * Math.cos(caida), -Math.sin(caida), Math.sin(angulo) * Math.cos(caida));
        punta.multiplyScalar(largo);
        bolas[i]?.position.copy(punta);
        const t = tientos[i];
        if (t) {
          t.quaternion.setFromUnitVectors(ARRIBA, punta.clone().normalize());
          t.scale.set(1, largo, 1);
        }
      }
    },
  };
}

// ── El chambergo ─────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoChambergo = "volando" | "cayendo" | "en el suelo";

export interface Chambergo {
  readonly cual: "chambergo";
  readonly nombre: string;
  /** Cinemático y sin choques: lo lleva el viento (no se lo agarra con la mano). */
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoChambergo;
  /** Si ya lo enredaron unas boleadoras. */
  readonly atrapado: boolean;
  /** Quién tiró las boleadoras que lo enredaron (0 o 1), o `null`. */
  readonly cazador: 0 | 1 | null;
  /** Llama a `aviso` cuando lo enredan, con quién tiró. Devuelve cómo dejar de escuchar. */
  alAtrapar(aviso: (jugador: 0 | 1 | null) => void): () => void;
  /** Lo deja enredado en el suelo, de una vez (al retomar). */
  atrapar(): void;
}

export function armarChambergo(h: Herramientas, p: Plano<"chambergo">): Chambergo {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.chambergo;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  // Un colisionador sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const objeto = crearImagenChambergo(h.oscuro);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  // Su vuelo: subiendo y bajando, a lo largo y a lo ancho de su caja, con frecuencias y fases de semilla. El
  // pampero lo apura
  const azar = crearAzar(p.semilla ^ 0xc4a3b);
  const fase: readonly [number, number, number] = [azar() * 6.28, azar() * 6.28, azar() * 6.28];
  const x = medio.x * a.recorre;
  const z = medio.z * a.recorre;
  const y = medio.y * 0.8;
  const frecuencia: readonly [number, number, number] = [
    (p.velocidad / x) * (0.55 + 0.25 * azar()),
    (p.velocidad / y) * (0.35 + 0.2 * azar()),
    (p.velocidad / z) * (0.35 + 0.2 * azar()),
  ];
  /** Donde cae: el piso bajo ese punto (lo que no se mueve, sin los muñecos), o la base de su caja. */
  let suelo = centro.y - medio.y;
  let buscarSuelo = false;
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const pisoBajo = (q: THREE.Vector3Like) => {
    rayo.origin = { x: q.x, y: q.y, z: q.z };
    const golpe = mundo.castRay(
      rayo,
      30,
      true,
      rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      SOLO_EL_PISO,
    );
    return golpe ? q.y - golpe.timeOfImpact : centro.y - medio.y;
  };
  const donde = (t: number) =>
    new THREE.Vector3(
      x * Math.sin(frecuencia[0] * t + fase[0]),
      y * Math.sin(frecuencia[1] * t + fase[1]) + 0.1 * Math.sin(5.3 * t),
      z * Math.sin(frecuencia[2] * t + fase[2]),
    )
      .applyQuaternion(giro)
      .add(centro);
  let t = 0;
  let giroPropio = 0;
  let estado: EstadoChambergo = "volando";
  let cazador: 0 | 1 | null = null;
  let enredadas: Boleadoras | null = null;
  const posicion = donde(0);
  const caida = new THREE.Vector3();
  const avisos = new Set<(jugador: 0 | 1 | null) => void>();
  const giroDe = (inclinado: number) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(inclinado * Math.sin(t * 2.3), giroPropio, inclinado * 0.6));
  const llevarBoleadoras = (ya: boolean) =>
    enredadas?.llevar(
      new THREE.Vector3(posicion.x + 0.12, posicion.y + 0.02, posicion.z - 0.08),
      new THREE.Quaternion(),
      ya,
    );
  cuerpo.setTranslation(vector(posicion), true);

  h.antes(() => {
    if (estado === "volando") {
      const pampero = pamperoEn(h, posicion);
      const soplo = pampero ? pampero.soplo : 0.4;
      t += PASO * (a.calma + (a.rafaga - a.calma) * soplo);
      giroPropio += PASO * (1.5 + 2.5 * soplo);
      posicion.copy(donde(t));
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(giroDe(0.5));
      return;
    }
    if (estado === "cayendo") {
      // Cae como cae un sombrero con unas bolas enredadas: derecho y planeando un poco
      caida.y -= 9.81 * PASO;
      caida.multiplyScalar(0.985);
      posicion.addScaledVector(caida, PASO);
      if (posicion.y <= suelo + 0.08) {
        posicion.y = suelo + 0.08;
        estado = "en el suelo";
      }
      giroPropio += PASO * 0.8;
      cuerpo.setNextKinematicTranslation(vector(posicion));
      cuerpo.setNextKinematicRotation(giroDe(estado === "en el suelo" ? 0 : 0.3));
      llevarBoleadoras(false);
      return;
    }
    llevarBoleadoras(false);
  });
  const atrapar = (b: Boleadoras | null, jugador: 0 | 1 | null) => {
    if (estado !== "volando") return;
    estado = "cayendo";
    cazador = jugador;
    caida.set(0, 0, 0);
    buscarSuelo = true;
    if (b) {
      b.enredar();
      enredadas = b;
      llevarBoleadoras(true);
    }
    for (const aviso of avisos) aviso(jugador);
  };
  h.despues(() => {
    if (buscarSuelo) {
      buscarSuelo = false;
      suelo = pisoBajo(posicion);
    }
    if (estado !== "volando") return;
    // Lo enredan unas boleadoras que vuelan de verdad (no llevadas en la mano) y le pasan cerca
    for (const b of h.lista) {
      if (b.cual !== "boleadoras" || b.estado !== "volando" || b.recorrido < a.vuelo) continue;
      const q = b.cuerpo.translation();
      if (Math.hypot(q.x - posicion.x, q.y - posicion.y, q.z - posicion.z) < p.enredar) {
        atrapar(b, b.lanzador);
        return;
      }
    }
  });

  return {
    cual: "chambergo",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get atrapado() {
      return estado !== "volando";
    },
    get cazador() {
      return cazador;
    },
    alAtrapar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    atrapar() {
      const b = h.lista.find((q): q is Boleadoras => q.cual === "boleadoras") ?? null;
      atrapar(b, null);
      // Cae desde el medio de su caja: el piso se busca después del primer paso (antes, los rayos no ven nada)
      posicion.copy(centro);
      buscarSuelo = true;
      cuerpo.setTranslation(vector(posicion), true);
      cuerpo.setNextKinematicTranslation(vector(posicion));
      llevarBoleadoras(true);
    },
  };
}

/** El chambergo: ala ancha y copa baja y chata, con su cinta y el barbijo colgando. */
function crearImagenChambergo(material: THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.34, 0.33, 0.025, 24),
        new THREE.CylinderGeometry(0.15, 0.17, 0.16, 16).translate(0, 0.09, 0),
        new THREE.TorusGeometry(0.2, 0.012, 4, 20).rotateX(Math.PI / 2).translate(0, 0.012, 0),
        // El barbijo: un tiento que cuelga del ala
        new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4).rotateZ(0.3).translate(0.16, -0.1, 0),
      ]),
      material,
    ),
  );
  grupo.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.171, 0.172, 0.035, 16).translate(0, 0.035, 0),
      new THREE.MeshStandardMaterial({ name: "cinta", color: COLORES.siluetaLejana, roughness: 0.8 }),
    ),
  );
  return grupo;
}

// ── El pie de amigo ──────────────────────────────────────────────────────────────────────────────────────────

export interface PieDeAmigo {
  readonly cual: "pie-de-amigo";
  readonly nombre: string;
  /** El escalón (cinemático): las manos del que hace pie. Escondido mientras nadie lo hace. */
  readonly escalon: RAPIER.RigidBody;
  /** Quién hace pie (0 o 1), o `null`. */
  readonly quien: 0 | 1 | null;
  readonly activo: boolean;
  /** Si el otro está parado encima. */
  readonly pisado: boolean;
}

export function armarPieDeAmigo(h: Herramientas, p: Plano<"pie-de-amigo">): PieDeAmigo {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.pieDeAmigo;
  const { centro, medio, giro } = p.caja;
  const fondo = (p.hasta - p.desde) / 2;
  const arriba = -medio.y + p.alto;
  const lugar = h.enElMundo(p, 0, arriba - a.grueso / 2, (p.desde + p.hasta) / 2);
  const escondido = { x: lugar.x, y: ESCONDIDO_PAMPA, z: lugar.z };
  const escalon = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(escondido.x, escondido.y, escondido.z)
      .setRotation(giro),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(p.ancho / 2, a.grueso / 2, fondo)
      .setFriction(1)
      .setCollisionGroups(0),
    escalon,
  );
  const objeto = crearImagenPoncho(p.ancho, a.grueso, fondo * 2);
  objeto.name = p.nombre;
  h.mover(escalon, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo: escalon, colisionador });

  const giroInverso = giro.clone().invert();
  const local = new THREE.Vector3();
  /** Si ese muñeco está parado en la caja, de pie y con los dos brazos alzados. */
  const haciendoPie = (m: Muneco, alzados: boolean) => {
    if (!alzados || m.estado !== "de pie") return false;
    local.copy(m.partes.pelvis.translation()).sub(centro).applyQuaternion(giroInverso);
    return (
      Math.abs(local.x) <= medio.x + a.margen &&
      Math.abs(local.z) <= medio.z + a.margen &&
      local.y > -medio.y - 0.2 &&
      local.y < -medio.y + 1.2
    );
  };
  let quien: 0 | 1 | null = null;
  let pisado = false;
  h.antes((munecos, entradas) => {
    const alzados = (j: 0 | 1) => Boolean(entradas?.[j]?.brazoIzquierdo && entradas?.[j]?.brazoDerecho);
    const puede = (j: 0 | 1) => {
      const m = munecos[j];
      return m !== undefined && haciendoPie(m, alzados(j));
    };
    const antes = quien;
    if (quien === null || !puede(quien)) quien = puede(0) ? 0 : puede(1) ? 1 : null;
    if (quien === antes) return;
    if (quien === null) {
      escalon.setTranslation(escondido, true);
      escalon.setNextKinematicTranslation(escondido);
      colisionador.setCollisionGroups(0);
    } else {
      // Solo el otro lo pisa: el que hace pie lo atraviesa (y la cámara no lo ve)
      const otro = 1 << (1 + (1 - quien));
      colisionador.setCollisionGroups(((BIT_PAMPA << 16) | otro) >>> 0);
      escalon.setTranslation(vector(lugar), true);
      escalon.setNextKinematicTranslation(vector(lugar));
    }
  });
  h.despues((munecos) => {
    pisado = false;
    if (quien === null) return;
    const m = munecos[1 - quien];
    if (!m) return;
    local.copy(m.partes.pelvis.translation()).sub(lugar).applyQuaternion(giroInverso);
    pisado = Math.abs(local.x) < p.ancho / 2 && Math.abs(local.z) < fondo && local.y > 0.2 && local.y < 0.9;
  });

  return {
    cual: "pie-de-amigo",
    nombre: p.nombre,
    escalon,
    get quien() {
      return quien;
    },
    get activo() {
      return quien !== null;
    },
    get pisado() {
      return pisado;
    },
  };
}

/** El escalón del pie de amigo: un poncho doblado sobre las manos juntas. */
function crearImagenPoncho(ancho: number, grueso: number, fondo: number): THREE.Group {
  const grupo = new THREE.Group();
  const tela = materialTela(COLORES.silueta, { repetir: 1, relieve: 5 });
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(ancho, grueso * 0.8, fondo * 0.9),
        new THREE.CylinderGeometry(grueso * 0.45, grueso * 0.45, fondo * 0.9, 8)
          .rotateX(Math.PI / 2)
          .translate(-ancho / 2, 0, 0),
        new THREE.CylinderGeometry(grueso * 0.45, grueso * 0.45, fondo * 0.9, 8)
          .rotateX(Math.PI / 2)
          .translate(ancho / 2, 0, 0),
        // Los flecos que cuelgan
        ...[-0.3, -0.1, 0.1, 0.3].map((f) =>
          new THREE.BoxGeometry(0.02, grueso * 1.6, 0.02).translate(f * ancho, -grueso, fondo * 0.45),
        ),
      ]),
      tela,
    ),
  );
  return grupo;
}

// ── El candil ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Candil {
  readonly cual: "candil";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly agarrado: number;
  /** Si tiene la Luz adentro. */
  readonly encendido: boolean;
  /** Si está quieto en su gancho. */
  readonly enSuLugar: boolean;
  /** Lo prende (tiene la Luz adentro). */
  encender(): void;
  /** Llama a `aviso` cuando se prende. Devuelve cómo dejar de escuchar. */
  alEncender(aviso: () => void): () => void;
  /** Lo cuelga en su gancho, quieto. */
  volver(): void;
}

export function armarCandil(h: Herramientas, p: Plano<"candil">): Candil {
  const { rapier, mundo } = h;
  const a = AJUSTES_PAMPA.candil;
  const { centro, medio, giro } = p.caja;
  // Colgado en su gancho es cinemático; la mano que lo agarra lo descuelga
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setLinearDamping(0.2));
  colgar(rapier, cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_PAMPA),
    cuerpo,
  );
  const imagen = crearImagenCandil(medio, h.oscuro);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let agarrado = 0;
  let encendido = false;
  let tirado = 0;
  const avisos = new Set<() => void>();
  const candil: Candil = {
    cual: "candil",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get encendido() {
      return encendido;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.05;
    },
    encender() {
      if (encendido) return;
      encendido = true;
      for (const aviso of avisos) aviso();
    },
    alEncender(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      colgar(rapier, cuerpo);
      devolver(mundo, cuerpo, centro, giro);
      tirado = 0;
    },
  };
  h.despues((munecos, fuera) => {
    agarrado = munecos.filter((m) => manosEn(m, cuerpo) > 0).length;
    if (agarrado > 0 && cuerpo.isKinematic()) descolgar(rapier, cuerpo);
    const t = cuerpo.translation();
    // Tirado lejos y abajo mucho rato (o caído al vacío), vuelve a su gancho
    tirado = agarrado === 0 && t.y < centro.y - a.bajo ? tirado + PASO : 0;
    if (fuera(t) || tirado > a.vuelveSolo) candil.volver();
  });
  // Prendido si tiene la Luz adentro: el invitado no lo sabe, pero ve la Luz ahí
  let prendido = 0;
  h.guardar(() => {
    let adentroLaLuz = encendido;
    const t = cuerpo.translation();
    for (const q of h.lista) {
      if (q.cual !== "luz-mala") continue;
      const l = q.cuerpo.translation();
      if (Math.hypot(l.x - t.x, l.y - t.y, l.z - t.z) < a.adentro) adentroLaLuz = true;
    }
    prendido += ((adentroLaLuz ? 1 : 0) - prendido) * 0.08;
  });
  h.dibujar(() => {
    imagen.prender(prendido);
  });
  return candil;
}

/** El candil: un farol de lata con su vidrio, el techito agujereado y el asa de alambre. `prender` le da luz. */
function crearImagenCandil(medio: THREE.Vector3, oscuro: THREE.Material) {
  const [x, y, z] = [medio.x, medio.y, medio.z];
  const grupo = new THREE.Group();
  const lata = juntar([
    new THREE.CylinderGeometry(Math.max(x, z) * 0.55, Math.max(x, z) * 1.15, y * 0.45, 8).translate(0, y * 0.78, 0),
    new THREE.CylinderGeometry(Math.max(x, z) * 1.05, Math.max(x, z) * 1.05, y * 0.18, 8).translate(0, -y * 0.9, 0),
    ...[0, 1, 2, 3].map((i) => {
      const angulo = (i * Math.PI) / 2 + Math.PI / 4;
      return new THREE.BoxGeometry(x * 0.12, y * 1.5, z * 0.12).translate(
        Math.cos(angulo) * x * 0.85,
        -y * 0.05,
        Math.sin(angulo) * z * 0.85,
      );
    }),
    new THREE.TorusGeometry(Math.max(x, z) * 0.7, 0.012, 5, 14, Math.PI).translate(0, y * 1.0, 0),
  ]);
  grupo.add(new THREE.Mesh(lata, oscuro));
  // Apagado, el vidrio es oscuro (tiznado); con la Luz adentro, blanco como los ojos
  const vidrio = new THREE.MeshStandardMaterial({
    name: "vidrio",
    color: COLORES.siluetaHonda,
    emissive: COLORES.ojo,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  grupo.add(
    new THREE.Mesh(new THREE.CylinderGeometry(x * 0.8, x * 0.8, y * 1.45, 10).translate(0, -y * 0.05, 0), vidrio),
  );
  const luz = new THREE.PointLight(COLORES.ojo, 0, AJUSTES_PAMPA.candil.luz.alcance, 2);
  grupo.add(luz);
  return {
    grupo,
    prender(cuanto: number) {
      vidrio.emissiveIntensity = 2.4 * cuanto;
      luz.intensity = AJUSTES_PAMPA.candil.luz.intensidad * cuanto;
    },
  };
}

// ── Lo del guion de la pampa ─────────────────────────────────────────────────────────────────────────────────

/** Una rama (un sólido cinemático, largo a lo largo de su x) que gira sobre su bisagra, a lo largo de z: de parada
 * (0) a gacha (1). */
export interface RamaGacha {
  /** De 0 (parada) a 1 (gacha). */
  readonly bajada: number;
  /** La lleva un paso hacia `objetivo` (o de una vez, con `ya`). */
  poner(objetivo: number, ya?: boolean): void;
}

/** La rama `cuerpo`, con una punta en `bisagra`: sus ángulos (radianes sobre el horizonte, hacia −x) parada y gacha, y
 * en cuántos pasos baja. */
export function crearRamaGacha(
  cuerpo: RAPIER.RigidBody,
  op: {
    readonly bisagra: THREE.Vector3Like;
    readonly largo: number;
    readonly arriba: number;
    readonly abajo: number;
    readonly pasos: number;
  },
): RamaGacha {
  const bisagra = new THREE.Vector3().copy(op.bisagra);
  const eje = new THREE.Vector3(0, 0, 1);
  let bajada = 0;
  return {
    get bajada() {
      return bajada;
    },
    poner(objetivo, ya = false) {
      const paso = 1 / op.pasos;
      bajada = ya ? objetivo : bajada + Math.max(-paso, Math.min(paso, objetivo - bajada));
      const f = bajada * bajada * (3 - 2 * bajada);
      const angulo = op.arriba + (op.abajo - op.arriba) * f;
      const direccion = new THREE.Vector3(-Math.cos(angulo), Math.sin(angulo), 0);
      const centro = bisagra.clone().addScaledVector(direccion, op.largo / 2);
      const giro = new THREE.Quaternion().setFromAxisAngle(eje, Math.PI - angulo);
      if (ya) {
        cuerpo.setTranslation(vector(centro), true);
        cuerpo.setRotation(giro, true);
      }
      cuerpo.setNextKinematicTranslation(vector(centro));
      cuerpo.setNextKinematicRotation(giro);
    },
  };
}

/** El ombú: un tronco panzón y blando, con raíces que se abren como lomos por el suelo (hacia atrás y hacia el este:
 * del lado del pie de amigo y de la rama gacha no hay), ramas gruesas que salen de la horqueta hacia atrás y una copa
 * enorme y chata, alta. En el marco del medio de su pie; `medio` es lo que mide la horqueta de cada lado (x, z) y
 * `alto`, a qué altura está. La copa de atrás (donde está el mate) va en `copa`: su medio y su medio largo y ancho. */
export function crearImagenOmbu(
  madera: THREE.Material,
  hojas: THREE.Material,
  medio: { readonly x: number; readonly z: number },
  alto: number,
  copa: { readonly x: number; readonly z: number; readonly mx: number; readonly mz: number; readonly alto: number },
): THREE.Group {
  const grupo = new THREE.Group();
  const partes: THREE.BufferGeometry[] = [
    // El tronco, del ancho de la horqueta, apenas más ancho abajo
    new THREE.CylinderGeometry(1, 1.04, alto, 14, 3).scale(medio.x, 1, medio.z).translate(0, alto / 2, 0),
    // El borde de la horqueta, un poco abultado
    new THREE.TorusGeometry(1, 0.06, 5, 20)
      .rotateX(Math.PI / 2)
      .scale(medio.x, 1, medio.z)
      .translate(0, alto - 0.04, 0),
    // La copa de atrás, donde está el mate
    new THREE.CylinderGeometry(0.95, 1, copa.alto, 10)
      .scale(copa.mx, 1, copa.mz)
      .translate(copa.x, alto + copa.alto / 2, copa.z),
  ];
  // Las raíces: lomos bajos que salen del pie, hacia atrás (−z) y hacia el este (+x)
  for (const [i, a] of [-2.5, -2.0, -1.5, -1.0, -0.45, 0.15].entries()) {
    const largo = 1.4 + 0.5 * (i % 3);
    const raiz = new THREE.ConeGeometry(0.42, largo, 6).rotateZ(-Math.PI / 2).scale(1, 0.55, 1);
    raiz.translate(largo / 2, 0.12, 0).rotateY(-a);
    raiz.translate(Math.cos(a) * medio.x * 0.9, 0, Math.sin(a) * medio.z * 0.9);
    partes.push(raiz);
  }
  // Las ramas gruesas: salen del borde de atrás de la horqueta, hacia arriba y hacia atrás
  for (const [i, [x, dx, dy, dz]] of [
    [-1.0, -2.2, 3.6, -2.0],
    [0.2, 0.4, 4.4, -2.6],
    [1.2, 2.6, 3.4, -1.8],
    [1.5, 3.4, 2.2, 0.2],
  ].entries()) {
    const desde = new THREE.Vector3(x ?? 0, alto - 0.2, -medio.z * 0.75);
    const hasta = desde.clone().add(new THREE.Vector3(dx, dy, dz));
    partes.push(palo(desde, hasta, 0.28 - 0.03 * i, 8));
  }
  grupo.add(new THREE.Mesh(juntar(partes), madera));
  // La copa: matas enormes y chatas, altas y corridas hacia atrás para que se vea la horqueta
  const copaDeHojas: THREE.BufferGeometry[] = [];
  const matas: readonly (readonly [number, number, number, number])[] = [
    [-2.6, 8.2, -3.8, 3.2],
    [1.4, 8.8, -4.6, 3.6],
    [4.6, 7.8, -3.0, 2.8],
    [-0.4, 9.4, -2.4, 2.8],
    [3.4, 7.2, -0.6, 2.0],
    [-3.8, 7.0, -1.4, 2.0],
  ];
  for (const [x, y, z, r] of matas) {
    copaDeHojas.push(new THREE.SphereGeometry(r, 14, 9).scale(1.3, 0.5, 1.1).translate(x, y, z));
  }
  grupo.add(new THREE.Mesh(juntar(copaDeHojas), hojas));
  return grupo;
}

/** El mate del secreto: una calabacita con su bombilla, olvidada en la copa del ombú. */
export function crearImagenMate(material: THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.11, 12, 10).scale(1, 0.95, 1).translate(0, 0.1, 0),
        new THREE.CylinderGeometry(0.075, 0.09, 0.05, 12).translate(0, 0.2, 0),
        new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10).translate(0, 0.005, 0),
      ]),
      material,
    ),
  );
  // La bombilla, de metal: clara, como lo único que brilla allá arriba
  const bombilla = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5).rotateZ(0.35).translate(0.04, 0.3, 0),
    new THREE.MeshStandardMaterial({ name: "bombilla", color: COLORES.ojo, metalness: 0.6, roughness: 0.3 }),
  );
  grupo.add(bombilla);
  return grupo;
}

/** Un gancho de alambre que sale de un poste: una vara de `desde` a `hasta` y la punta doblada hacia abajo. */
export function crearImagenGancho(
  desde: THREE.Vector3Like,
  hasta: THREE.Vector3Like,
  material: THREE.Material,
): THREE.Mesh {
  const a = new THREE.Vector3().copy(desde);
  const b = new THREE.Vector3().copy(hasta);
  return new THREE.Mesh(juntar([palo(a, b, 0.015), palo(b, b.clone().setY(b.y - 0.08), 0.012)]), material);
}
