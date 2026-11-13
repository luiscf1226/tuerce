// Las piezas que estrena El cafetal (TU-41), menos El Cipitío (cipitio.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-cafetal.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   canasto  un canasto de corte lleno de café. Se lanza con lo que ya hace el muñeco (saltar y soltarlo en el aire,
//            como la pelota de Xibalbá) y se atrapa con los brazos alzados: la mano que lo toca en el aire lo agarra.
//            Suelto, en cuanto toca algo que no sea una mano se vacía y vuelve lleno a su lugar; el guion mira dónde
//            cayó (en el recibidero cuenta, en el suelo se regó). Los muñecos lo atraviesan, así no rebota en el que
//            lo va a atrapar.
//   zaranda  la zaranda del café: una bandeja colgada que se mueve a lo largo de su x, trabada mientras no la agarren
//            los dos (uno de cada punta). Cada vez que pasa de una punta a la otra es un zarandeo; con los que pide,
//            la llave que estaba entre el café cae por detrás y queda colgando de su cordón (de un clavo), a la
//            altura de las manos y sin nada alrededor que las manos agarren primero. Al agarrarla se descuelga.
//   polea    una polea con torno: el que se cuelga de la manija la baja y el gancho sube; sin nadie, vuelven. Se le
//            cuelga un costal acercándoselo al gancho cuando está abajo.
//   costal     un costal de café: se carga (uno solo puede), se cuelga del gancho de la polea. Tirado, vuelve solo.
//   guineo   un guineo maduro colgado de su mata, para El Cipitío. Tirado, vuelve solo.
//
// Todo lo que se mueve (los canastos, la bandeja de la zaranda y su llave, la manija y el gancho de la polea, los
// costales y el guineo) viaja en la foto de la red. El invitado no simula: dibuja las sogas con los cuerpos como llegan.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelCafetalEnPlano } from "./formato-cafetal";
import type { Herramientas } from "./piezas";
import { GRUPOS_SUELTO, manosEn } from "./piezas-pinar";

type Plano<C extends PiezaDelCafetalEnPlano["cual"]> = Extract<PiezaDelCafetalEnPlano, { cual: C }>;

/** La bandeja de la zaranda no empuja ni la empujan (grupos del resolvedor sin filtro): los muñecos la atraviesan
 * pero la agarran igual, como al bejuco. */
const BIT_CAFETAL = 1 << 12;
const SIN_EMPUJAR = (BIT_CAFETAL << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Los números de las piezas del cafetal que no se ponen desde Blender. */
export const AJUSTES_CAFETAL = {
  canasto: {
    /** Para que cuente como atrapado, lo que tiene que haber volado desde que lo soltaron (m): pasarlo de mano en mano
     * no es atraparlo. Del tapesco al patio vuela más de 2 m. */
    vueloMinimo: 1.2,
  },
  zaranda: {
    /** Trabada, el resorte que la tiene donde quedó (N/m) y su amortiguación (N·s/m). Suelta, solo el roce. */
    trabada: { rigidez: 6000, amortiguacion: 600 },
    roce: 6,
    /** Cuánto más allá de cada punta va su manija (m) y su radio. */
    manija: 0.1,
    radioManija: 0.035,
    /** De dónde cuelga: cuánto más arriba que la bandeja (m), para las sogas. */
    sogas: 1.6,
    /** La llave: sus medidas (m) y su peso (kg). Tirada más abajo que esto de donde cayó, cuenta como en el suelo. */
    /** La llave: un manojo colgando de su argolla, ancho para que lo toque una mano (las dos van a 42 cm). */
    llave: { medio: { x: 0.15, y: 0.12, z: 0.04 }, masa: 0.3, bajo: 0.5 },
  },
  polea: {
    /** El radio de la manija (a lo ancho, la z de la caja) y su largo. */
    radioManija: 0.035,
    largoManija: 0.5,
    /** El gancho engancha el costal que le acercan a menos de esto (m), si está abajo (menos de `abajo` de su subida). */
    enganchar: 0.4,
    abajo: 0.08,
  },
  suelto: {
    /** Tirado más abajo que esto de su lugar (m), cuenta como en el suelo. */
    bajo: 0.4,
  },
} as const;

/** Cuántos muñecos tienen agarrado ese cuerpo (con una mano o con las dos). */
const cuantosAgarran = (munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody) =>
  munecos.filter((m) => manosEn(m, cuerpo) > 0).length;

/** Lo pone ahí, quieto. Los colisionadores se mueven ya: si no, hasta el paso siguiente los rayos (la suspensión
 * de un muñeco parado donde estaba) lo verían en el lugar viejo y lo empujarían desde ahí. */
function devolver(mundo: RAPIER.World, cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3Like, giro: THREE.Quaternion) {
  cuerpo.setTranslation(vector(posicion), true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
  mundo.propagateModifiedBodyPositionsToColliders();
}

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

/** Una soga entre dos puntos, que se estira cada vez que se dibuja. */
function soga(h: Herramientas, radio = 0.012) {
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 5), h.oscuro);
  h.escena.add(malla);
  const medio = new THREE.Vector3();
  const direccion = new THREE.Vector3();
  return (desde: THREE.Vector3, hasta: THREE.Vector3) => {
    malla.position.copy(medio.addVectors(desde, hasta).multiplyScalar(0.5));
    malla.scale.set(1, Math.max(0.01, desde.distanceTo(hasta)), 1);
    malla.quaternion.setFromUnitVectors(ARRIBA, direccion.copy(hasta).sub(desde).normalize());
  };
}

// ── El canasto ───────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoCanasto = "en su lugar" | "llevado" | "volando";

export interface Canasto {
  readonly cual: "canasto";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** En su lugar (lleno, quieto), llevado (alguien lo agarra) o volando (lo soltaron y no ha tocado nada). */
  readonly estado: EstadoCanasto;
  /** Quién lo soltó por última vez (0 o 1), o `null`. */
  readonly lanzador: 0 | 1 | null;
  /** Cuántas veces lo atraparon en el aire y cuántas cayó. */
  readonly atrapadas: number;
  readonly caidas: number;
  /** Llama a `aviso` cuando alguien que no es el que lo soltó lo agarra en el aire. */
  alAtrapar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando cae (tocó algo suelto, antes de volver a su lugar), con dónde quedó y si alguien lo
   * había atrapado en el aire desde que salió de su lugar. */
  alCaer(aviso: (donde: THREE.Vector3, atrapado: boolean) => void): () => void;
  /** Lo pone en su lugar, lleno y quieto. */
  volver(): void;
}

export function armarCanasto(h: Herramientas, p: Plano<"canasto">): Canasto {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  // Empieza dormido: así se queda quieto en su poste hasta que lo agarren (la mano lo despierta)
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(1.5).setSleeping(true));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenCanasto(medio, h);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let estado: EstadoCanasto = "en su lugar";
  let lanzador: 0 | 1 | null = null;
  /** Dónde lo soltaron la última vez. */
  const soltadoEn = new THREE.Vector3();
  const a = AJUSTES_CAFETAL.canasto;
  /** Quién lo tenía solo, la última vez que lo tuvo uno solo. */
  let ultimo: 0 | 1 | null = null;
  let atrapadas = 0;
  let caidas = 0;
  /** Si lo atraparon en el aire desde que salió de su lugar. */
  let atrapado = false;
  const avisosAtrapar = new Set<(jugador: 0 | 1) => void>();
  const avisosCaer = new Set<(donde: THREE.Vector3, atrapado: boolean) => void>();
  const volver = () => {
    devolver(mundo, cuerpo, centro, giro);
    cuerpo.sleep();
    estado = "en su lugar";
    lanzador = null;
    ultimo = null;
    atrapado = false;
  };
  h.despues((munecos, fuera) => {
    const quienes = ([0, 1] as const).filter((j) => {
      const m = munecos[j];
      return m !== undefined && manosEn(m, cuerpo) > 0;
    });
    if (quienes.length > 0) {
      // Atrapado: lo agarra en el aire uno que no es el que lo soltó
      const [solo] = quienes;
      // y que voló de verdad: pasarlo de mano en mano no cuenta
      const t = cuerpo.translation();
      const voló = Math.hypot(t.x - soltadoEn.x, t.y - soltadoEn.y, t.z - soltadoEn.z) > a.vueloMinimo;
      if (estado === "volando" && solo !== undefined && quienes.length === 1 && solo !== lanzador && voló) {
        atrapadas++;
        atrapado = true;
        for (const aviso of avisosAtrapar) aviso(solo);
      }
      estado = "llevado";
      if (quienes.length === 1 && solo !== undefined) ultimo = solo;
      return;
    }
    if (estado === "llevado") {
      estado = "volando";
      lanzador = ultimo;
      soltadoEn.copy(cuerpo.translation());
    }
    if (estado !== "volando") return;
    // Suelto: en cuanto toca algo (los muñecos no cuentan: lo atraviesan) se vacía y vuelve
    const t = cuerpo.translation();
    if (fuera(t) || tocaAlgo(mundo, colisionador)) {
      caidas++;
      const donde = new THREE.Vector3().copy(t);
      for (const aviso of avisosCaer) aviso(donde, atrapado);
      volver();
    }
  });
  return {
    cual: "canasto",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get lanzador() {
      return lanzador;
    },
    get atrapadas() {
      return atrapadas;
    },
    get caidas() {
      return caidas;
    },
    alAtrapar(aviso) {
      avisosAtrapar.add(aviso);
      return () => {
        avisosAtrapar.delete(aviso);
      };
    },
    alCaer(aviso) {
      avisosCaer.add(aviso);
      return () => {
        avisosCaer.delete(aviso);
      };
    },
    volver,
  };
}

/** El canasto de corte: tejido, más ancho arriba, con el mecapal (la faja) y el café que asoma, como granos oscuros.
 * Tejido claro (el bejuco pelado) para que se lea contra el cafetal. */
function crearImagenCanasto(medio: THREE.Vector3, h: Herramientas): THREE.Group {
  const grupo = new THREE.Group();
  const radio = Math.min(medio.x, medio.z);
  const tejido = materialTela(COLORES.siluetaLejana, { repetir: 1.5, relieve: 6 });
  const cesta = new THREE.CylinderGeometry(radio, radio * 0.78, medio.y * 2, 14, 3, true);
  // Las varas del tejido: costillas de arriba abajo
  const varas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    varas.push(
      new THREE.CylinderGeometry(0.012, 0.012, medio.y * 2, 4)
        .rotateZ(Math.atan2(radio * 0.22, medio.y * 2) * Math.cos(a))
        .rotateX(-Math.atan2(radio * 0.22, medio.y * 2) * Math.sin(a))
        .translate(Math.cos(a) * radio * 0.9, 0, Math.sin(a) * radio * 0.9),
    );
  }
  varas.push(new THREE.TorusGeometry(radio, 0.02, 5, 16).rotateX(Math.PI / 2).translate(0, medio.y, 0));
  varas.push(new THREE.CircleGeometry(radio * 0.78, 12).rotateX(Math.PI / 2).translate(0, -medio.y, 0));
  grupo.add(new THREE.Mesh(cesta, tejido), new THREE.Mesh(juntar(varas), tejido));
  // El café: un montoncito de granos que asoma
  const granos: THREE.BufferGeometry[] = [new THREE.SphereGeometry(radio * 0.92, 12, 6, 0, Math.PI * 2, 0, 0.9)];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = radio * 0.55 * Math.sqrt((i + 1) / 9);
    granos.push(new THREE.SphereGeometry(0.035, 6, 5).translate(Math.cos(a) * r, radio * 0.25, Math.sin(a) * r));
  }
  const cafe = new THREE.Mesh(juntar(granos), h.oscuro);
  cafe.position.y = medio.y - radio * 0.65;
  grupo.add(cafe);
  return grupo;
}

// ── La zaranda y su llave ────────────────────────────────────────────────────────────────────────────────────

export interface Zaranda {
  readonly cual: "zaranda";
  readonly nombre: string;
  readonly bandeja: RAPIER.RigidBody;
  /** Cuánto se corrió del medio, a lo largo de su x: de −1 a 1 (las puntas del recorrido). */
  readonly corrido: number;
  /** Si está trabada (no la agarran los dos). */
  readonly trabada: boolean;
  /** Cuántos zarandeos lleva. */
  readonly zarandeos: number;
  /** La llave: si ya cayó, si cuelga de su clavo, cuántos la agarran y si está encajada. */
  readonly llave: {
    readonly cuerpo: RAPIER.RigidBody;
    readonly suelta: boolean;
    readonly colgada: boolean;
    readonly agarrada: number;
    readonly encajada: boolean;
  };
  /** Llama a `aviso` cuando cae la llave. */
  alSoltar(aviso: () => void): () => void;
  /** Deja caer la llave ya (al retomar). */
  soltarLlave(): void;
  /** Encaja la llave ahí: queda quieta y ya no se saca. */
  encajar(posicion: THREE.Vector3Like): void;
  /** Vuelve a colgar la llave de su clavo. Pasa solo si queda tirada o cae al vacío. */
  volverLlave(): void;
}

export function armarZaranda(h: Herramientas, p: Plano<"zaranda">): Zaranda {
  const { rapier, mundo } = h;
  const a = AJUSTES_CAFETAL.zaranda;
  const { centro, medio, giro } = p.caja;
  const ancla = h.fijo(centro, giro);
  const bandeja = mundo.createRigidBody(h.dinamico(centro, giro).setLinearDamping(0.5).setAngularDamping(2));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setCollisionGroups(GRUPOS_SUELTO)
      .setSolverGroups(SIN_EMPUJAR),
    bandeja,
  );
  // Las manijas: un travesaño a lo ancho (la z de la caja) en cada punta, para las dos manos
  const xManija = medio.x + a.manija;
  for (const lado of [-1, 1]) {
    mundo.createCollider(
      rapier.ColliderDesc.capsule(medio.z, a.radioManija)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_X, Math.PI / 2))
        .setTranslation(lado * xManija, 0, 0)
        .setMass(0.2)
        .setFriction(0.9)
        .setCollisionGroups(GRUPOS_SUELTO)
        .setSolverGroups(SIN_EMPUJAR),
      bandeja,
    );
  }
  const datos = rapier.JointData.prismatic(CERO, CERO, EJE_X);
  datos.limitsEnabled = true;
  datos.limits = [-p.recorrido, p.recorrido];
  const junta = mundo.createImpulseJoint(datos, ancla, bandeja, true);
  junta.setContactsEnabled(false);
  const prismatica = junta instanceof rapier.PrismaticImpulseJoint ? junta : null;
  prismatica?.configureMotorModel(rapier.MotorModel.ForceBased);

  const objeto = crearImagenZaranda(medio, xManija, a.radioManija, h);
  objeto.name = p.nombre;
  h.mover(bandeja, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo: bandeja, colisionador });
  // Las cuatro sogas, de las esquinas a la viga
  const sogas = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ sx, sz, dibujar: soga(h) })));

  // La llave: escondida entre el café (cinemática, va con la bandeja) hasta que cae por detrás y queda colgada de su
  // clavo (cinemática, quieta) hasta que la agarran
  const ml = a.llave.medio;
  const cae = h.enElMundo(p, 0, 0, -(medio.z + p.llave));
  const llave = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  const colisionadorLlave = mundo.createCollider(
    rapier.ColliderDesc.cuboid(ml.x, ml.y, ml.z).setMass(a.llave.masa).setFriction(0.9).setCollisionGroups(0),
    llave,
  );
  const imagenLlave = crearImagenLlave(ml);
  imagenLlave.name = `${p.nombre}-llave`;
  h.mover(llave, imagenLlave);

  const ejeX = EJE_X.clone().applyQuaternion(giro);
  let corrido = 0;
  let trabada = true;
  let trabadaEn = 0;
  let zarandeos = 0;
  let lado = 0;
  let suelta = false;
  let colgada = false;
  let encajada = false;
  let agarrada = 0;
  let tirada = 0;
  const avisos = new Set<() => void>();
  const volverLlave = () => {
    if (!suelta || encajada) return;
    colgada = true;
    llave.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    devolver(mundo, llave, cae, giro);
    llave.setNextKinematicTranslation(vector(cae));
  };
  const soltarLlave = () => {
    if (suelta) return;
    suelta = true;
    colisionadorLlave.setCollisionGroups(GRUPOS_SUELTO);
    volverLlave();
    for (const aviso of avisos) aviso();
  };

  h.antes((munecos) => {
    // Trabada mientras no la agarren los dos: el resorte la tiene donde quedó
    const agarran = cuantosAgarran(munecos, bandeja);
    const ahora = agarran < 2;
    if (ahora && !trabada) trabadaEn = corrido * p.recorrido;
    trabada = ahora;
    if (trabada) prismatica?.configureMotorPosition(trabadaEn, a.trabada.rigidez, a.trabada.amortiguacion);
    else prismatica?.configureMotorVelocity(0, a.roce);
    // La llave escondida va con la bandeja
    if (!suelta) llave.setNextKinematicTranslation(bandeja.translation());
  });
  h.despues((munecos, fuera) => {
    // Los zarandeos: cada vez que llega a la punta contraria
    if (!trabada) {
      const umbral = p.umbral;
      if (corrido > umbral && lado !== 1) {
        if (lado === -1) zarandeos++;
        lado = 1;
      } else if (corrido < -umbral && lado !== -1) {
        if (lado === 1) zarandeos++;
        lado = -1;
      }
      if (zarandeos >= p.zarandeos) soltarLlave();
    }
    // La llave colgada que agarran se descuelga; tirada en el suelo (o en el vacío) vuelve a su clavo
    agarrada = cuantosAgarran(munecos, llave);
    if (colgada && agarrada > 0 && !encajada) {
      colgada = false;
      llave.setBodyType(rapier.RigidBodyType.Dynamic, true);
    }
    if (suelta && !colgada && !encajada) {
      const t = llave.translation();
      tirada = agarrada === 0 && t.y < cae.y - a.llave.bajo ? tirada + PASO : 0;
      if (fuera(t) || tirada > p.vuelve) {
        volverLlave();
        tirada = 0;
      }
    }
  });
  h.guardar(() => {
    const t = bandeja.translation();
    corrido = limitar(
      ((t.x - centro.x) * ejeX.x + (t.y - centro.y) * ejeX.y + (t.z - centro.z) * ejeX.z) / p.recorrido,
      -1,
      1,
    );
  });
  const esquina = new THREE.Vector3();
  const viga = new THREE.Vector3();
  // El cordón de la llave, del clavo a la argolla (solo mientras cuelga: la llave está quieta en su lugar)
  const cordon = soga(h, 0.006);
  const clavo = cae.clone().add(new THREE.Vector3(0, ml.y + 0.12, 0));
  const argolla = new THREE.Vector3();
  const enLaBandeja = new THREE.Vector3();
  h.dibujar(() => {
    const t = llave.translation();
    // Escondida entre el café (va con la bandeja) no se ve
    imagenLlave.visible = enLaBandeja.copy(t).distanceTo(bandeja.translation()) > 0.05;
    const cuelga = Math.hypot(t.x - cae.x, t.y - cae.y, t.z - cae.z) < 0.01;
    argolla.set(t.x, t.y + ml.y, t.z);
    if (cuelga) cordon(clavo, argolla);
    else cordon(clavo, clavo);
    for (const s of sogas) {
      esquina
        .set(s.sx * medio.x * 0.9, medio.y, s.sz * medio.z * 0.9)
        .applyQuaternion(objeto.quaternion)
        .add(objeto.position);
      viga.copy(h.enElMundo(p, s.sx * medio.x * 0.9, medio.y + a.sogas, s.sz * medio.z * 0.9));
      s.dibujar(esquina, viga);
    }
  });

  return {
    cual: "zaranda",
    nombre: p.nombre,
    bandeja,
    get corrido() {
      return corrido;
    },
    get trabada() {
      return trabada;
    },
    get zarandeos() {
      return zarandeos;
    },
    llave: {
      cuerpo: llave,
      get suelta() {
        return suelta;
      },
      get colgada() {
        return colgada;
      },
      get agarrada() {
        return agarrada;
      },
      get encajada() {
        return encajada;
      },
    },
    alSoltar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    soltarLlave,
    encajar(posicion) {
      soltarLlave();
      encajada = true;
      colgada = false;
      colisionadorLlave.setCollisionGroups(0);
      llave.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      devolver(mundo, llave, posicion, giro);
      llave.setNextKinematicTranslation(vector(posicion));
    },
    volverLlave,
  };
}

/** La zaranda: un marco de reglas con la malla de alambre (una rejilla de varitas) y el café encima, y una manija en
 * cada punta. */
function crearImagenZaranda(medio: THREE.Vector3, xManija: number, radioManija: number, h: Herramientas) {
  const grupo = new THREE.Group();
  const marco: THREE.BufferGeometry[] = [];
  const g = 0.05;
  for (const s of [-1, 1]) {
    marco.push(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, g).translate(0, 0, s * (medio.z - g / 2)));
    marco.push(new THREE.BoxGeometry(g, medio.y * 2, medio.z * 2).translate(s * (medio.x - g / 2), 0, 0));
    // Los largueros hasta la manija
    for (const z of [-1, 1])
      marco.push(
        new THREE.BoxGeometry(xManija - medio.x + 0.02, 0.03, 0.03).translate(
          s * (medio.x + (xManija - medio.x) / 2),
          0,
          z * (medio.z - g / 2),
        ),
      );
    marco.push(
      new THREE.CylinderGeometry(radioManija, radioManija, medio.z * 2, 8)
        .rotateX(Math.PI / 2)
        .translate(s * xManija, 0, 0),
    );
  }
  grupo.add(new THREE.Mesh(juntar(marco), h.madera));
  // La malla: varitas finas a lo largo y a lo ancho
  const malla: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 12; i++)
    malla.push(
      new THREE.BoxGeometry(medio.x * 2, 0.008, 0.008).translate(0, -medio.y * 0.6, -medio.z + (i * medio.z) / 6),
    );
  for (let i = 1; i < 20; i++)
    malla.push(
      new THREE.BoxGeometry(0.008, 0.008, medio.z * 2).translate(-medio.x + (i * medio.x) / 10, -medio.y * 0.6, 0),
    );
  grupo.add(new THREE.Mesh(juntar(malla), h.oscuro));
  // El café: granos regados sobre la malla
  const granos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const u = ((i * 0.618) % 1) * 2 - 1;
    const w = ((i * 0.377 + 0.13) % 1) * 2 - 1;
    granos.push(new THREE.SphereGeometry(0.03, 5, 4).translate(u * medio.x * 0.85, -medio.y * 0.3, w * medio.z * 0.8));
  }
  grupo.add(new THREE.Mesh(juntar(granos), h.oscuro));
  return grupo;
}

/** El manojo de llaves del beneficio: una argolla grande de hierro y tres llaves viejas colgando, de distinto largo.
 * Claro (hierro gastado) para que se vea contra lo oscuro. */
function crearImagenLlave(m: { x: number; y: number; z: number }) {
  const hierro = new THREE.MeshStandardMaterial({
    name: "hierro",
    color: COLORES.siluetaLejana,
    roughness: 0.45,
    metalness: 0.5,
  });
  const radio = m.y * 0.35;
  const arriba = m.y - radio;
  const partes: THREE.BufferGeometry[] = [new THREE.TorusGeometry(radio, 0.012, 6, 16).translate(0, arriba, 0)];
  for (const [i, dx] of [-1, 0, 1].entries()) {
    const x = dx * m.x * 0.55;
    const largo = m.y * (1.1 + 0.25 * ((i + 1) % 2));
    const tope = arriba - radio * 0.8;
    // El ojo, la caña y los dientes, colgando de la argolla
    partes.push(new THREE.TorusGeometry(0.03, 0.009, 5, 10).translate(x, tope - 0.03, 0));
    partes.push(new THREE.CylinderGeometry(0.011, 0.011, largo, 6).translate(x, tope - 0.06 - largo / 2, 0));
    partes.push(new THREE.BoxGeometry(0.035, 0.02, 0.012).translate(x + 0.018, tope - 0.06 - largo + 0.03, 0));
    partes.push(new THREE.BoxGeometry(0.025, 0.016, 0.012).translate(x + 0.014, tope - 0.06 - largo + 0.065, 0));
  }
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(juntar(partes), hierro));
  return grupo;
}

// ── La polea ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface Polea {
  readonly cual: "polea";
  readonly nombre: string;
  readonly manija: RAPIER.RigidBody;
  readonly gancho: RAPIER.RigidBody;
  /** Cuánto subió el gancho: 0 abajo, 1 arriba del todo. */
  readonly subida: number;
  /** Cuántos muñecos cuelgan de la manija. */
  readonly colgados: number;
  /** El costal que cuelga del gancho, o `null`. */
  readonly costal: Costal | null;
  /** Descuelga el costal que tenga (y lo devuelve). */
  descolgar(): Costal | null;
}

export function armarPolea(h: Herramientas, p: Plano<"polea">): Polea {
  const { rapier, mundo } = h;
  const a = AJUSTES_CAFETAL.polea;
  const { medio, giro } = p.caja;
  const manijaAbajo = h.enElMundo(p, -medio.x, -medio.y + p.manija, 0);
  const ganchoAbajo = h.enElMundo(p, medio.x, -medio.y + p.gancho, 0);
  const kinematico = (donde: THREE.Vector3) =>
    mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(donde.x, donde.y, donde.z).setRotation(giro),
    );
  // La manija: un travesaño a lo ancho (la z de la caja), para colgarse con las dos manos
  const manija = kinematico(manijaAbajo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(a.largoManija / 2, a.radioManija)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_X, Math.PI / 2))
      .setFriction(0.9),
    manija,
  );
  // El gancho: no choca con nada (solo se le cuelgan los costales)
  const gancho = kinematico(ganchoAbajo);
  mundo.createCollider(rapier.ColliderDesc.ball(0.05).setSensor(true).setCollisionGroups(0), gancho);

  const imagenManija = new THREE.Mesh(
    new THREE.CylinderGeometry(a.radioManija, a.radioManija, a.largoManija, 8).rotateX(Math.PI / 2),
    h.madera,
  );
  imagenManija.name = p.nombre;
  h.mover(manija, imagenManija);
  h.solida({ nombre: p.nombre, objeto: imagenManija, cuerpo: manija, colisionador });
  const imagenGancho = crearImagenGancho(h);
  h.mover(gancho, imagenGancho);
  // El armazón: dos parales y la viga con la rueda arriba
  const armazon = new THREE.Mesh(
    juntar([
      ...[-1, 1].map((s) => new THREE.BoxGeometry(0.14, medio.y * 2, 0.14).translate(s * (medio.x + 0.25), 0, -0.35)),
      new THREE.BoxGeometry(medio.x * 2 + 0.64, 0.16, 0.16).translate(0, medio.y - 0.08, -0.35),
      new THREE.BoxGeometry(0.1, 0.1, 0.36).translate(-medio.x, medio.y - 0.08, -0.17),
      new THREE.BoxGeometry(0.1, 0.1, 0.36).translate(medio.x, medio.y - 0.08, -0.17),
    ]),
    h.madera,
  );
  armazon.position.copy(h.enElMundo(p, 0, 0, 0));
  armazon.quaternion.copy(giro);
  h.escena.add(armazon);
  const ruedas = new THREE.Mesh(
    juntar([-1, 1].map((s) => new THREE.TorusGeometry(0.1, 0.025, 6, 14).translate(s * medio.x, medio.y - 0.22, 0))),
    h.oscuro,
  );
  ruedas.position.copy(armazon.position);
  ruedas.quaternion.copy(giro);
  h.escena.add(ruedas);
  const sogaManija = soga(h, 0.014);
  const sogaArriba = soga(h, 0.014);
  const sogaGancho = soga(h, 0.014);
  const ruedaManija = h.enElMundo(p, -medio.x, medio.y - 0.22, 0);
  const ruedaGancho = h.enElMundo(p, medio.x, medio.y - 0.22, 0);

  const arribaY = ARRIBA.clone().applyQuaternion(giro);
  let bajado = 0;
  let colgados = 0;
  let costal: Costal | null = null;
  const poner = (fraccion: number) => {
    bajado = limitar(fraccion, 0, 1);
    manija.setNextKinematicTranslation(vector(manijaAbajo.clone().addScaledVector(arribaY, -bajado * p.recorrido)));
    gancho.setNextKinematicTranslation(vector(ganchoAbajo.clone().addScaledVector(arribaY, bajado * p.subir)));
  };
  h.antes((munecos) => {
    colgados = munecos.filter((m) => m.estado === "en el aire" && manosEn(m, manija) > 0).length;
    poner(bajado + (colgados > 0 ? p.bajada / p.recorrido : -p.subida / p.recorrido) * PASO);
  });
  const punta = new THREE.Vector3();
  h.despues(() => {
    // Engancha el costal que le acercan, con el gancho abajo
    if (costal || bajado > a.abajo) return;
    const g = gancho.translation();
    for (const otra of h.lista) {
      if (otra.cual !== "costal" || otra.colgado) continue;
      otra.punta(punta);
      if (Math.hypot(punta.x - g.x, punta.y - g.y, punta.z - g.z) > a.enganchar) continue;
      otra.colgarDe(gancho);
      costal = otra;
      return;
    }
  });
  let subida = 0;
  h.guardar(() => {
    const t = gancho.translation();
    subida = limitar(
      ((t.x - ganchoAbajo.x) * arribaY.x + (t.y - ganchoAbajo.y) * arribaY.y + (t.z - ganchoAbajo.z) * arribaY.z) /
        p.subir,
      0,
      1,
    );
  });
  const ojo = new THREE.Vector3();
  h.dibujar(() => {
    sogaManija(imagenManija.position, ruedaManija);
    sogaArriba(ruedaManija, ruedaGancho);
    ojo.copy(imagenGancho.position).addScaledVector(arribaY, 0.12);
    sogaGancho(ojo, ruedaGancho);
  });
  return {
    cual: "polea",
    nombre: p.nombre,
    manija,
    gancho,
    get subida() {
      return subida;
    },
    get colgados() {
      return colgados;
    },
    get costal() {
      return costal;
    },
    descolgar() {
      const s = costal;
      s?.descolgar();
      costal = null;
      return s;
    },
  };
}

function crearImagenGancho(h: Herramientas): THREE.Object3D {
  return new THREE.Mesh(
    juntar([
      new THREE.TorusGeometry(0.07, 0.016, 5, 12, Math.PI * 1.4).rotateZ(Math.PI * 0.8).translate(0, -0.02, 0),
      new THREE.CylinderGeometry(0.016, 0.016, 0.14, 5).translate(0, 0.1, 0),
    ]),
    h.oscuro,
  );
}

// ── Lo suelto: el costal y el guineo ───────────────────────────────────────────────────────────────────────────

export interface Costal {
  readonly cual: "costal";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly agarrado: number;
  /** Si cuelga del gancho de la polea. */
  readonly colgado: boolean;
  readonly enSuLugar: boolean;
  /** El punto de arriba del costal (de donde se cuelga), en el mundo. */
  punta(salida: THREE.Vector3): THREE.Vector3;
  /** Lo cuelga de ese cuerpo por su punta (con una rótula). */
  colgarDe(cuerpo: RAPIER.RigidBody): void;
  descolgar(): void;
  /** Lo deja ahí, derecho y quieto (en la troja). */
  ponerEn(posicion: THREE.Vector3Like): void;
  /** Lo pone en su lugar, quieto. Pasa solo si queda tirado o cae al vacío. */
  volver(): void;
}

export function armarCostal(h: Herramientas, p: Plano<"costal">): Costal {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setSleeping(true));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenCostal(medio);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let colgado: RAPIER.ImpulseJoint | null = null;
  const suelto = volverSolo(
    h,
    cuerpo,
    centro,
    p.vuelve,
    () => colgado !== null,
    () => costal.volver(),
  );
  const costal: Costal = {
    cual: "costal",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return suelto.agarrado;
    },
    get colgado() {
      return colgado !== null;
    },
    get enSuLugar() {
      return suelto.enSuLugar();
    },
    punta(salida) {
      return salida
        .set(0, medio.y, 0)
        .applyQuaternion(new THREE.Quaternion().copy(cuerpo.rotation()))
        .add(cuerpo.translation());
    },
    colgarDe(otro) {
      costal.descolgar();
      cuerpo.wakeUp();
      colgado = mundo.createImpulseJoint(
        rapier.JointData.spherical(CERO, { x: 0, y: medio.y, z: 0 }),
        otro,
        cuerpo,
        true,
      );
      colgado.setContactsEnabled(false);
    },
    descolgar() {
      if (colgado && mundo.getImpulseJoint(colgado.handle)) mundo.removeImpulseJoint(colgado, true);
      colgado = null;
    },
    ponerEn(posicion) {
      costal.descolgar();
      devolver(mundo, cuerpo, posicion, giro);
    },
    volver() {
      costal.descolgar();
      devolver(mundo, cuerpo, centro, giro);
      cuerpo.sleep();
    },
  };
  return costal;
}

/** El costal de yute: un costal panzón amarrado arriba, con su costura. */
function crearImagenCostal(medio: THREE.Vector3): THREE.Group {
  const grupo = new THREE.Group();
  const yute = materialTela(COLORES.siluetaLejana, { repetir: 1, relieve: 8 });
  const cuerpo = new THREE.SphereGeometry(1, 14, 10).scale(medio.x, medio.y * 0.92, medio.z);
  const amarre = new THREE.CylinderGeometry(medio.x * 0.18, medio.x * 0.45, medio.y * 0.3, 8).translate(
    0,
    medio.y * 0.82,
    0,
  );
  grupo.add(new THREE.Mesh(juntar([cuerpo, amarre]), yute));
  return grupo;
}

export interface Guineo {
  readonly cual: "guineo";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly agarrado: number;
  readonly enSuLugar: boolean;
  /** Si ya se lo comió El Cipitío (lo tiene en la mano). */
  readonly comido: boolean;
  /** Se lo da a El Cipitío: deja de chocar y lo mueve él. */
  comer(): void;
  /** Lo pone en su mata, quieto. */
  volver(): void;
}

export function armarGuineo(h: Herramientas, p: Plano<"guineo">): Guineo {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2).setSleeping(true));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  const objeto = crearImagenGuineo(medio, h);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  let comido = false;
  const guineo: Guineo = {
    cual: "guineo",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return suelto.agarrado;
    },
    get enSuLugar() {
      return suelto.enSuLugar();
    },
    get comido() {
      return comido;
    },
    comer() {
      if (comido) return;
      comido = true;
      colisionador.setCollisionGroups(0);
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    },
    volver() {
      if (comido) return;
      devolver(mundo, cuerpo, centro, giro);
      cuerpo.sleep();
    },
  };
  const suelto = volverSolo(
    h,
    cuerpo,
    centro,
    p.vuelve,
    () => comido,
    () => guineo.volver(),
  );
  return guineo;
}

/** El guineo: una media luna gorda con su pezón, claro (maduro). */
function crearImagenGuineo(medio: THREE.Vector3, h: Herramientas): THREE.Group {
  const grupo = new THREE.Group();
  const largo = Math.max(medio.x, medio.y, medio.z) * 2;
  const curva = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-largo / 2, largo * 0.12, 0),
    new THREE.Vector3(0, -largo * 0.22, 0),
    new THREE.Vector3(largo / 2, largo * 0.12, 0),
  );
  const cascara = new THREE.MeshStandardMaterial({ name: "guineo", color: COLORES.siluetaLejana, roughness: 0.6 });
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(curva, 10, largo * 0.11, 7, false), cascara));
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.012, 0.018, largo * 0.14, 5)
          .rotateZ(-0.9)
          .translate(largo * 0.55, largo * 0.18, 0),
        new THREE.SphereGeometry(largo * 0.05, 5, 4).translate(-largo * 0.5, largo * 0.12, 0),
      ]),
      h.oscuro,
    ),
  );
  return grupo;
}

/** Lo suelto que, tirado en el suelo (más bajo que su lugar), vuelve solo a los `vuelve` segundos; y si cae al
 * vacío, ya. `quieto`: mientras dé `true`, no cuenta (colgado de un gancho, en la mano de El Cipitío). */
function volverSolo(
  h: Herramientas,
  cuerpo: RAPIER.RigidBody,
  centro: THREE.Vector3,
  vuelve: number,
  quieto: () => boolean,
  volver: () => void,
) {
  let agarrado = 0;
  let tirado = 0;
  const enSuLugar = () => {
    const t = cuerpo.translation();
    return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.08;
  };
  h.despues((munecos, fuera) => {
    agarrado = cuantosAgarran(munecos, cuerpo);
    if (quieto()) {
      tirado = 0;
      return;
    }
    const t = cuerpo.translation();
    tirado = agarrado === 0 && t.y < centro.y - AJUSTES_CAFETAL.suelto.bajo ? tirado + PASO : 0;
    if (fuera(t) || tirado > vuelve) {
      volver();
      tirado = 0;
    }
  });
  return {
    get agarrado() {
      return agarrado;
    },
    enSuLugar,
  };
}

/** El café tendido a secar en un patio: granos regados de (x0, z0) a (x1, z1), a la altura `y`, menos donde
 * `salvo` diga. Siempre igual (sin azar). */
export function crearCafeTendido(
  [x0, z0]: readonly [number, number],
  [x1, z1]: readonly [number, number],
  y: number,
  salvo: (x: number, z: number) => boolean = () => false,
): THREE.Mesh {
  const granos: THREE.BufferGeometry[] = [];
  const cuantos = Math.round(Math.abs((x1 - x0) * (z1 - z0)) * 10);
  for (let i = 0; i < cuantos; i++) {
    const x = x0 + ((i * 0.6180339) % 1) * (x1 - x0);
    const z = z0 + ((i * 0.4142135 + 0.27) % 1) * (z1 - z0);
    if (salvo(x, z)) continue;
    granos.push(new THREE.SphereGeometry(0.05, 5, 3).scale(1, 0.45, 1).translate(x, y + 0.012, z));
  }
  return new THREE.Mesh(juntar(granos), new THREE.MeshStandardMaterial({ name: "cafe", color: COLORES.siluetaHonda }));
}
