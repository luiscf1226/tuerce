// Las piezas que estrena Las trenzas (TU-40), menos el Sombrerón (sombreron.ts). Cada una sale de un nodo
// `tipo: pieza` de la escena (formato-trenzas.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   nudo        dos cuerdas trenzadas con un nudo en el medio y un cabo en cada punta (una barra con resorte que se
//               jala hacia afuera, como la tranca). Jalando los dos cabos a la vez el nudo se afloja de a poco hasta
//               desatarse; jalando uno solo, se aprieta.
//   mula        una mula cinemática, sin azar: no da un paso sin toda su carga (los huacales `<nombre>-1`, `-2`…, que
//               se sueltan junto a su costado, a la altura del lomo, y quedan amarrados encima). Cargada, sigue al que la lleva de la rienda (una manija
//               con una soga de verdad, de Rapier); no se mete en las paredes ni se tira a los huecos.
//   balde       un balde de madera que se llena (el guion) y se lleva en la mano. Lleno, se derrama si nadie lo
//               agarra (un ratito): por eso se pasa de mano en mano. Tirado, vuelve solo a su lugar.
//   brasa       una piedra caliente: quema (empuja y tumba) al que la toca. Un balde lleno que llega cerca la apaga y
//               la piedra se hunde a ras del suelo.
//   sombrerote  el sombrero gigante del Sombrerón: una rueda de canto que solo gira sobre su eje. Se empuja
//               caminando contra ella; en la cuesta, sin nadie, rueda para abajo.
//
// Todo lo que se mueve viaja en la foto de la red. El invitado no simula: el estado que se ve (el nudo aflojado, el
// balde lleno, la piedra apagada) se lee de los cuerpos tal como llegan, en `guardar` y `dibujar`. Para el nudo y el
// balde hay un cuerpo cinemático sin choques (su marcador) que lleva ese estado en su giro o en su altura.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearRoca, juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import type { Muneco } from "../muneco";
import type { PiezaDeLasTrenzasEnPlano } from "./formato-trenzas";
import type { Herramientas, Huacal } from "./piezas";
import { manosEn } from "./piezas-pinar";

/** El bit de grupo de choque de lo suelto de Las trenzas (los cabos, la rienda, el balde): choca con todo menos con
 * los muñecos (bits 1 y 2). Las manos lo encuentran igual. */
const BIT_TRENZAS = 1 << 9;
export const GRUPOS_TRENZAS = ((BIT_TRENZAS << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se lo encuentra (para agarrarlo) pero no empuja ni lo empujan. */
const SIN_EMPUJAR = (BIT_TRENZAS << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Los números de las piezas de Las trenzas que no se ponen desde Blender. */
export const AJUSTES_TRENZAS = {
  nudo: {
    /** Cuánto gira el marcador del nudo (y su imagen) desde apretado hasta desatado (radianes). */
    giro: 2.5,
    /** Desatado, cuánto baja el marcador (m): así lo sabe el invitado. */
    caer: 0.4,
    /** El cabo: una barra de través, para las dos manos (medio largo, m). */
    cabo: 0.22,
  },
  mula: {
    /** Qué tan rápido acelera y frena (m/s²). */
    aceleracion: 3,
    /** Empieza a andar con la rienda más tirante que esto (fracción del largo), y anda a todo lo que da pasada la
     * siguiente fracción. */
    tirante: 0.7,
    plena: 0.9,
    /** La altura de la mano que lleva la rienda, quieta (m), y su resorte cuando nadie la agarra (rad/s). */
    alturaRienda: 0.95,
    resorte: 7,
    /** Lo más alto y lo más bajo que sube o baja de un paso (m). */
    escalon: 0.35,
    /** Un bulto que se suelta a menos de esto de su costado (m) y más alto que `bajo` (m) queda amarrado. */
    costado: 0.55,
    bajo: 0.3,
    /** Los bultos sobre el lomo: dónde van a lo largo (fracción del medio largo). */
    bultos: [-0.38, 0.38],
    /** La zancada (m por ciclo de las cuatro patas). */
    zancada: 1.2,
  },
  balde: {
    /** Lo que se mete el cubo hacia la base al llenarlo, y la altura del marcador lleno (m). */
    marcador: 1,
    /** Tirado más bajo que esto respecto de su lugar (m) y quieto, cuenta como tirado en el suelo. */
    bajo: 0.3,
  },
  brasa: {
    /** Hasta dónde quema, más allá de la piedra (m), y hasta qué altura sobre ella. */
    margen: 0.12,
    alto: 1,
    /** Cuánto para arriba sale el quemado (m/s) y cuántos pasos no lo vuelve a quemar. */
    arriba: 1.4,
    espera: 60,
    /** En cuántos pasos se hunde al apagarse. */
    hundir: 30,
  },
} as const;

/** Lo pone donde estaba al empezar, quieto. */
function devolver(cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3Like, giro: THREE.Quaternion) {
  cuerpo.setTranslation(vector(posicion), true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
}

/** El giro que lleva el eje x del marco de la pieza al lado más largo de su caja (en el plano). */
function marcoLargo(giro: THREE.Quaternion, medio: THREE.Vector3) {
  const enX = medio.x >= medio.z;
  const ajuste = enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2);
  return {
    giro: giro.clone().multiply(ajuste),
    mitad: enX ? medio.x : medio.z,
    medioAncho: enX ? medio.z : medio.x,
  };
}

/** Cuántos muñecos tienen agarrado ese cuerpo. */
const cuantosAgarran = (munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody) =>
  munecos.filter((m) => manosEn(m, cuerpo) > 0).length;

/** Un tubo que pasa por esos puntos (para sogas y trenzas). */
function tubo(puntos: readonly THREE.Vector3[], radio: number): THREE.BufferGeometry {
  if (puntos.length < 2) return new THREE.BufferGeometry();
  const curva = new THREE.CatmullRomCurve3([...puntos]);
  return new THREE.TubeGeometry(curva, Math.max(4, puntos.length * 2), radio, 5, false);
}

/** Una trenza de tres hebras de `a` a `b`: cada hebra da vueltas alrededor de la línea, desfasada un tercio. `vueltas`
 * por metro y `ancho` de la trenza; `comba` la hace colgar hacia el medio. */
export function puntosDeTrenza(
  a: THREE.Vector3,
  b: THREE.Vector3,
  hebra: number,
  { vueltas = 7, ancho = 0.035, comba = 0, pasos = 24 } = {},
): THREE.Vector3[] {
  const eje = b.clone().sub(a);
  const largo = eje.length();
  const dir = largo > 1e-6 ? eje.clone().divideScalar(largo) : EJE_X.clone();
  const lado = Math.abs(dir.y) > 0.9 ? EJE_X.clone() : new THREE.Vector3().crossVectors(dir, ARRIBA).normalize();
  const arriba = new THREE.Vector3().crossVectors(lado, dir).normalize();
  const puntos: THREE.Vector3[] = [];
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const angulo = t * largo * vueltas * Math.PI * 2 + (hebra * Math.PI * 2) / 3;
    const p = a.clone().addScaledVector(eje, t);
    p.addScaledVector(lado, Math.cos(angulo) * ancho).addScaledVector(arriba, Math.sin(angulo * 2) * ancho * 0.5);
    p.y -= comba * 4 * t * (1 - t);
    puntos.push(p);
  }
  return puntos;
}

// ── El nudo ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Nudo {
  readonly cual: "nudo";
  readonly nombre: string;
  /** Los dos cabos (el del − y el del + de su lado largo). */
  readonly cabos: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** El marcador del nudo (cinemático, sin choques): su giro dice cuánto se aflojó. */
  readonly marcador: RAPIER.RigidBody;
  /** Cuánto se aflojó: 0 apretado, 1 desatado. */
  readonly progreso: number;
  readonly desatado: boolean;
  /** Cuántos cabos están jalados ahora (0, 1 o 2). */
  readonly jalados: number;
  /** Cuánto se sacó cada cabo, de 0 a 1. */
  readonly recorridos: readonly [number, number];
  /** Lo desata de una vez (al retomar). */
  desatar(): void;
  /** Llama a `aviso` cuando se desata. Devuelve cómo dejar de escuchar. */
  alDesatar(aviso: () => void): () => void;
}

export function armarNudo(h: Herramientas, p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "nudo" }>): Nudo {
  const { rapier, mundo } = h;
  const a = AJUSTES_TRENZAS.nudo;
  const { centro, medio } = p.caja;
  const { giro, mitad } = marcoLargo(p.caja.giro, medio);
  const eje = EJE_X.clone().applyQuaternion(giro);

  // El marcador: el nudo del medio, que gira al aflojarse y cae al desatarse
  const marcador = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.15).setSensor(true).setCollisionGroups(0),
    marcador,
  );

  // Los cabos: una barra de través en cada punta, que sale hacia afuera con un resorte que la vuelve a meter
  const cabos = ([-1, 1] as const).map((lado) => {
    const inicio = centro.clone().addScaledVector(eje, lado * mitad);
    const ancla = h.fijo(inicio, giro);
    const cabo = mundo.createRigidBody(h.dinamico(inicio, giro).setLinearDamping(1).setAngularDamping(2));
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(0.04, 0.035, a.cabo)
        .setMass(p.masa)
        .setFriction(0.9)
        .setCollisionGroups(GRUPOS_TRENZAS)
        .setSolverGroups(SIN_EMPUJAR),
      cabo,
    );
    const datos = rapier.JointData.prismatic(CERO, CERO, { x: 1, y: 0, z: 0 });
    datos.limitsEnabled = true;
    datos.limits = lado > 0 ? [0, p.recorrido] : [-p.recorrido, 0];
    const junta = mundo.createImpulseJoint(datos, ancla, cabo, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.PrismaticImpulseJoint) {
      const rigidez = p.fuerza / p.recorrido;
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * p.masa));
    }
    return { cabo, inicio, lado };
  });
  const [cabo0, cabo1] = cabos;
  if (!cabo0 || !cabo1) throw new Error("el nudo sin cabos");

  // Las cuerdas van en el mundo (de cabo a cabo); el nudo sigue al marcador: gira al aflojarse y cae al desatarse
  const imagen = crearImagenNudo();
  imagen.nudo.name = p.nombre;
  h.escena.add(imagen.grupo);
  h.mover(marcador, imagen.nudo);
  h.solida({ nombre: p.nombre, objeto: imagen.nudo, cuerpo: marcador, colisionador });
  const imagenesCabos = cabos.map(({ cabo }) => {
    const objeto = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, a.cabo * 2), h.madera);
    h.mover(cabo, objeto);
    return objeto;
  });

  /** Cuánto salió un cabo, de 0 a 1. */
  const sacado = ({ cabo, inicio, lado }: (typeof cabos)[number]) => {
    const t = cabo.translation();
    const afuera = ((t.x - inicio.x) * eje.x + (t.y - inicio.y) * eje.y + (t.z - inicio.z) * eje.z) * lado;
    return limitar(afuera / p.recorrido, 0, 1);
  };

  let progreso = 0;
  let desatado = false;
  let jalados = 0;
  let recorridos: [number, number] = [0, 0];
  const avisos = new Set<() => void>();
  const ponerMarcador = (ya: boolean) => {
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, progreso * a.giro));
    const donde = { x: centro.x, y: centro.y - (desatado ? a.caer : 0), z: centro.z };
    if (ya) {
      marcador.setTranslation(donde, true);
      marcador.setRotation(q, true);
    }
    marcador.setNextKinematicTranslation(donde);
    marcador.setNextKinematicRotation(q);
  };
  const soltarse = () => {
    desatado = true;
    progreso = 1;
    for (const aviso of avisos) aviso();
  };

  h.antes(() => ponerMarcador(false));
  h.despues(() => {
    recorridos = [sacado(cabo0), sacado(cabo1)];
    jalados = recorridos.filter((r) => r >= p.umbral).length;
    if (desatado) return;
    // Los dos a la vez lo aflojan; uno solo lo aprieta
    if (jalados === 2) progreso += PASO / p.desatar;
    else if (jalados === 1) progreso -= PASO / p.desatar;
    progreso = limitar(progreso, 0, 1);
    if (progreso >= 1) soltarse();
  });

  // La imagen, con los cuerpos como quedaron (también en el invitado): el progreso del giro del marcador
  let visto = 0;
  let caido = false;
  const giroInverso = giro.clone().invert();
  h.guardar(() => {
    const q = giroInverso.clone().multiply(new THREE.Quaternion().copy(marcador.rotation()));
    const s = q.x * 1;
    visto = limitar((2 * Math.atan2(q.w < 0 ? -s : s, Math.abs(q.w))) / a.giro, 0, 1);
    caido = marcador.translation().y < centro.y - a.caer / 2;
  });
  h.dibujar(() => {
    const [o0, o1] = imagenesCabos;
    if (!o0 || !o1) return;
    imagen.posar(o0.position, o1.position, imagen.nudo.position, caido ? 1 : visto, caido);
  });

  return {
    cual: "nudo",
    nombre: p.nombre,
    cabos: [cabo0.cabo, cabo1.cabo],
    marcador,
    get progreso() {
      return progreso;
    },
    get desatado() {
      return desatado;
    },
    get jalados() {
      return jalados;
    },
    get recorridos() {
      return recorridos;
    },
    desatar() {
      if (!desatado) soltarse();
      ponerMarcador(true);
    },
    alDesatar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** Las dos cuerdas trenzadas, de cada cabo al nudo del medio. Se rehacen solo cuando algo se movió. */
function crearImagenNudo() {
  const grupo = new THREE.Group();
  const soga = materialTela(COLORES.silueta, { repetir: 1, relieve: 3, pelusa: false });
  const hebras: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), soga);
    grupo.add(m);
    hebras.push(m);
  }
  // El nudo: varias vueltas de soga apretadas una sobre otra
  const nudo = new THREE.Group();
  nudo.add(
    new THREE.Mesh(
      juntar([
        new THREE.TorusGeometry(0.09, 0.035, 6, 14),
        new THREE.TorusGeometry(0.09, 0.035, 6, 14).rotateY(Math.PI / 2),
        new THREE.TorusGeometry(0.08, 0.035, 6, 14).rotateX(Math.PI / 2),
        new THREE.SphereGeometry(0.075, 10, 8),
      ]),
      soga,
    ),
  );
  let ultimo = "";
  const medioA = new THREE.Vector3();
  const medioB = new THREE.Vector3();
  return {
    /** Las cuerdas (en el mundo) y el nudo (lo mueve su marcador). */
    grupo,
    nudo,
    /** De los cabos (`a` y `b`) al `centro`; `flojo` de 0 (apretado) a 1 (desatado). */
    posar(a: THREE.Vector3, b: THREE.Vector3, centro: THREE.Vector3, flojo: number, caido: boolean) {
      const clave = [a.x, a.y, a.z, b.x, b.y, b.z, flojo].map((v) => v.toFixed(3)).join(",");
      nudo.scale.setScalar(caido ? 0.001 : 1 - 0.55 * flojo);
      if (clave === ultimo) return;
      ultimo = clave;
      // Desatadas, cada mitad cuelga de su cabo hasta el suelo; si no, las dos van al nudo
      if (caido) {
        medioA
          .copy(a)
          .lerp(centro, 0.55)
          .setY(centro.y - 0.9);
        medioB
          .copy(b)
          .lerp(centro, 0.55)
          .setY(centro.y - 0.9);
      } else {
        medioA.copy(centro);
        medioB.copy(centro);
      }
      const vueltas = 7 * (1 - 0.6 * flojo);
      for (let i = 0; i < 6; i++) {
        const m = hebras[i];
        if (!m) continue;
        const [desde, hasta] = i < 3 ? [a, medioA] : [b, medioB];
        const comba = caido ? 0.35 : 0.05 + 0.1 * flojo;
        m.geometry.dispose();
        m.geometry = tubo(puntosDeTrenza(desde, hasta, i % 3, { vueltas, ancho: 0.03 + 0.02 * flojo, comba }), 0.02);
      }
    },
  };
}

// ── La mula ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Mula {
  readonly cual: "mula";
  readonly nombre: string;
  /** El cuerpo (cinemático): su origen está en el suelo, entre las patas. */
  readonly cuerpo: RAPIER.RigidBody;
  /** La manija de la rienda (suelta, colgada de una soga de verdad). */
  readonly rienda: RAPIER.RigidBody;
  /** Sus bultos (los huacales `<nombre>-1`, `-2`…). */
  readonly bultos: readonly Huacal[];
  /** Cuántos lleva amarrados en el lomo, y si ya lleva todos. */
  readonly cargados: number;
  readonly cargada: boolean;
  /** Quién la lleva de la rienda (0 el rojo, 1 el turquesa), o `null`. */
  readonly guia: 0 | 1 | null;
  /** Qué tan rápido anda ahora (m/s). */
  readonly rapidez: number;
  /** Hacia dónde mira (radianes alrededor de +y). */
  readonly rumbo: number;
  /** Le amarra todos los bultos de una vez (al retomar). */
  cargar(): void;
  /** La pone ahí, quieta, mirando hacia `rumbo` (al retomar). */
  ponerEn(x: number, z: number, rumbo: number): void;
  /** Llama a `aviso` cada vez que le amarran un bulto. Devuelve cómo dejar de escuchar. */
  alCargar(aviso: (cargados: number) => void): () => void;
}

export function armarMula(h: Herramientas, p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "mula" }>): Mula {
  const { rapier, mundo } = h;
  const a = AJUSTES_TRENZAS.mula;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const alto = medio.y * 2;
  const lomo = alto * 0.85;
  const adelanteInicial = EJE_X.clone().applyQuaternion(giro);
  let rumbo = Math.atan2(adelanteInicial.x, adelanteInicial.z);
  let base = centro.y - medio.y;
  let pos = { x: centro.x, z: centro.z };
  const casa = { x: centro.x, z: centro.z, rumbo, base };
  /** El giro de la mula con ese rumbo (su x local hacia adelante). */
  const giroDe = (r: number) => new THREE.Quaternion().setFromAxisAngle(ARRIBA, r - Math.PI / 2);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, base, pos.z).setRotation(giroDe(rumbo)),
  );
  // El lomo y la panza, las patas y el pescuezo con la cabeza: choca con los muñecos y con lo suelto
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.72, alto * 0.16, medioAncho)
      .setTranslation(-mitad * 0.08, lomo - alto * 0.16, 0)
      .setFriction(0.9),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.6, alto * 0.27, medioAncho * 0.55).setTranslation(
      -mitad * 0.08,
      alto * 0.27,
      0,
    ),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.16, alto * 0.16, medioAncho * 0.5).setTranslation(mitad * 0.82, alto * 0.8, 0),
    cuerpo,
  );
  const imagen = crearImagenMula(h, mitad, alto, medioAncho);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  // La rienda: una manija colgada del bozal con una soga de verdad. Sin nadie, un resorte la tiene a la altura de
  // las manos, delante de la cabeza (si no, quedaría en el suelo, donde las manos no llegan)
  const bozal = { x: mitad * 0.98, y: alto * 0.74, z: 0 };
  const descanso = () => {
    const q = giroDe(rumbo);
    const p0 = new THREE.Vector3(mitad + 0.35, 0, 0).applyQuaternion(q);
    return new THREE.Vector3(pos.x + p0.x, base + a.alturaRienda, pos.z + p0.z);
  };
  const inicioRienda = descanso();
  const rienda = mundo.createRigidBody(
    h.dinamico(inicioRienda, giroDe(rumbo)).setLinearDamping(2).setAngularDamping(3).setCanSleep(false),
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(0.035, 0.035, 0.2)
      .setMass(0.4)
      .setCollisionGroups(GRUPOS_TRENZAS)
      .setSolverGroups(SIN_EMPUJAR),
    rienda,
  );
  const soga = mundo.createImpulseJoint(rapier.JointData.rope(p.rienda, bozal, CERO), cuerpo, rienda, true);
  soga.setContactsEnabled(false);
  const imagenManija = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), h.oscuro);
  h.mover(rienda, imagenManija);

  // El rayo que busca piso y paredes: no ve a los muñecos, ni lo suelto, ni a la mula ni a sus bultos
  const grupos = ((1 << 16) | (0xffff & ~0b110)) >>> 0;
  const banderas = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const propios = new Set<number>();
  const noEsPropio = (c: RAPIER.Collider) => !propios.has(c.handle) && c.parent()?.handle !== cuerpo.handle;
  const lanzar = (origen: THREE.Vector3Like, dir: THREE.Vector3Like, largo: number) => {
    rayo.origin = vector(origen);
    rayo.dir = vector(dir);
    return mundo.castRay(rayo, largo, true, banderas, grupos, undefined, cuerpo, noEsPropio);
  };
  const pisoBajo = (x: number, z: number) => {
    const golpe = lanzar({ x, y: base + 0.8, z }, { x: 0, y: -1, z: 0 }, 0.8 + a.escalon + 0.2);
    return golpe ? base + 0.8 - golpe.timeOfImpact : null;
  };

  let bultos: Huacal[] | undefined;
  const losBultos = () => {
    bultos ??= Array.from({ length: p.carga }, (_, i) => {
      const b = h.lista.find((q): q is Huacal => q.cual === "huacal" && q.nombre === `${p.nombre}-${i + 1}`);
      if (!b) throw new Error(`la mula «${p.nombre}» no tiene su bulto «${p.nombre}-${i + 1}»`);
      return b;
    });
    return bultos;
  };
  /** Qué bulto va en cada lugar del lomo. */
  const amarrados: (Huacal | null)[] = a.bultos.map(() => null);
  const avisos = new Set<(cargados: number) => void>();
  const cargados = () => amarrados.filter((b) => b !== null).length;
  const cargada = () => cargados() >= Math.min(p.carga, a.bultos.length);
  /** Dónde va el bulto del lugar `k`, en el mundo, con la mula en (`x`, `z`, `y`) mirando hacia `r`. */
  const enElLomo = (k: number, b: Huacal, x: number, y: number, z: number, r: number) => {
    const alto = b.cuerpo.collider(0).halfExtents()?.y ?? 0.15;
    const l = new THREE.Vector3((a.bultos[k] ?? 0) * mitad, lomo + alto, 0).applyQuaternion(giroDe(r));
    return { posicion: { x: x + l.x, y: y + l.y, z: z + l.z }, giro: giroDe(r) };
  };
  const amarrar = (k: number, b: Huacal) => {
    amarrados[k] = b;
    propios.add(b.cuerpo.collider(0).handle);
    b.cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    b.cuerpo.setLinvel(CERO, true);
    b.cuerpo.setAngvel(CERO, true);
    for (const aviso of avisos) aviso(cargados());
  };
  const llevarBultos = (ya: boolean) => {
    amarrados.forEach((b, k) => {
      if (!b) return;
      const donde = enElLomo(k, b, pos.x, base, pos.z, rumbo);
      if (ya) {
        b.cuerpo.setTranslation(donde.posicion, true);
        b.cuerpo.setRotation(donde.giro, true);
      }
      b.cuerpo.setNextKinematicTranslation(donde.posicion);
      b.cuerpo.setNextKinematicRotation(donde.giro);
    });
  };
  const ponerCuerpo = (ya: boolean) => {
    const q = giroDe(rumbo);
    if (ya) {
      cuerpo.setTranslation({ x: pos.x, y: base, z: pos.z }, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation({ x: pos.x, y: base, z: pos.z });
    cuerpo.setNextKinematicRotation(q);
    llevarBultos(ya);
  };

  let guia: 0 | 1 | null = null;
  let rapidez = 0;
  h.antes((munecos) => {
    guia = null;
    munecos.forEach((m, i) => {
      if (guia === null && i <= 1 && manosEn(m, rienda) > 0) guia = i as 0 | 1;
    });
    // Sin nadie en la rienda, la manija vuelve a colgar delante de la cabeza
    const r = rienda.translation();
    if (guia === null) {
      const d = descanso();
      const v = rienda.linvel();
      const k = a.resorte * a.resorte;
      const c = 2 * a.resorte;
      const masa = rienda.mass();
      rienda.applyImpulse(
        {
          x: (k * (d.x - r.x) - c * v.x) * masa * PASO,
          y: ((k * (d.y - r.y) - c * v.y) * masa - GRAVEDAD * masa) * PASO,
          z: (k * (d.z - r.z) - c * v.z) * masa * PASO,
        },
        true,
      );
    }
    // Cargada y con la rienda tirante, anda hacia el que la lleva
    const q = giroDe(rumbo);
    const b = new THREE.Vector3(bozal.x, 0, 0).applyQuaternion(q);
    const distancia = Math.hypot(r.x - (pos.x + b.x), r.z - (pos.z + b.z));
    let objetivo = 0;
    if (guia !== null && cargada()) {
      const deseado = Math.atan2(r.x - pos.x, r.z - pos.z);
      const error = envolver(deseado - rumbo);
      const giroMax = p.giro * PASO;
      const tirante = (distancia - a.tirante * p.rienda) / ((a.plena - a.tirante) * p.rienda);
      if (tirante > 0) rumbo = envolver(rumbo + limitar(error, -giroMax, giroMax));
      objetivo = p.velocidad * limitar(tirante, 0, 1) * Math.max(0, Math.cos(error));
    }
    rapidez += limitar(objetivo - rapidez, -a.aceleracion * PASO * 2, a.aceleracion * PASO);
    if (rapidez > 1e-4) {
      const dx = Math.sin(rumbo) * rapidez * PASO;
      const dz = Math.cos(rumbo) * rapidez * PASO;
      // No se mete en las paredes: tantea delante del pecho, abajo y a media altura, de los dos lados
      const adelante = new THREE.Vector3(Math.sin(rumbo), 0, Math.cos(rumbo));
      const costado = new THREE.Vector3(Math.cos(rumbo), 0, -Math.sin(rumbo));
      let tapado = false;
      for (const y of [0.35, alto * 0.75])
        for (const s of [-0.8, 0, 0.8]) {
          const o = new THREE.Vector3(pos.x, base + y, pos.z)
            .addScaledVector(adelante, mitad * 0.7)
            .addScaledVector(costado, s * medioAncho);
          if (lanzar(o, adelante, mitad * 0.35 + 0.15 + rapidez * PASO)) tapado = true;
        }
      // Ni se tira a un hueco: tiene que haber piso delante de las patas
      const frente = new THREE.Vector3(pos.x + dx, 0, pos.z + dz).addScaledVector(adelante, mitad * 0.7);
      const pisoAdelante = pisoBajo(frente.x, frente.z);
      if (pisoAdelante === null || Math.abs(pisoAdelante - base) > a.escalon) tapado = true;
      if (tapado) rapidez = 0;
      else {
        pos = { x: pos.x + dx, z: pos.z + dz };
        const piso = pisoBajo(pos.x, pos.z);
        if (piso !== null) base += (piso - base) * 0.3;
      }
    }
    ponerCuerpo(false);
  });
  h.despues((munecos) => {
    // Un bulto que se suelta junto a la mula, a la altura de su lomo (no del suelo), queda amarrado
    if (cargada()) return;
    const inversa = giroDe(rumbo).invert();
    for (const b of losBultos()) {
      if (amarrados.includes(b) || cuantosAgarran(munecos, b.cuerpo) > 0) continue;
      const t = b.cuerpo.translation();
      const l = new THREE.Vector3(t.x - pos.x, t.y - base, t.z - pos.z).applyQuaternion(inversa);
      if (Math.abs(l.x) > mitad * 0.8 || Math.abs(l.z) > medioAncho + a.costado || l.y < a.bajo || l.y > lomo + 0.9)
        continue;
      const libre = amarrados.indexOf(null);
      if (libre >= 0) amarrar(libre, b);
    }
  });

  // La imagen: las patas con lo que anduvo y la rienda del bozal a la manija (también en el invitado)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let andado = 0;
  let brio = 0;
  let pasos = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.z - antes.z);
    antes.copy(t);
    andado += d;
    brio += (d / PASO / p.velocidad - brio) * 0.2;
    pasos++;
  });
  h.dibujar(() => {
    const bozalMundo = new THREE.Vector3(bozal.x, bozal.y, bozal.z)
      .applyQuaternion(imagen.grupo.quaternion)
      .add(imagen.grupo.position);
    imagen.posar(andado / a.zancada, brio, pasos * PASO, bozalMundo, imagenManija.position);
  });

  return {
    cual: "mula",
    nombre: p.nombre,
    cuerpo,
    rienda,
    get bultos() {
      return losBultos();
    },
    get cargados() {
      return cargados();
    },
    get cargada() {
      return cargada();
    },
    get guia() {
      return guia;
    },
    get rapidez() {
      return rapidez;
    },
    get rumbo() {
      return rumbo;
    },
    cargar() {
      losBultos().forEach((b) => {
        if (amarrados.includes(b)) return;
        const libre = amarrados.indexOf(null);
        if (libre >= 0) amarrar(libre, b);
      });
      llevarBultos(true);
    },
    ponerEn(x, z, r) {
      pos = { x, z };
      rumbo = r;
      rapidez = 0;
      base = pisoBajo(x, z) ?? casa.base;
      ponerCuerpo(true);
      const d = descanso();
      devolver(rienda, d, giroDe(rumbo));
    },
    alCargar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** La mula: panza, lomo con su aparejo, cuatro patas, el pescuezo y la cabeza con sus orejas largas, y la crin y la
 * cola trenzadas (las trenzas del Sombrerón). Mira hacia +x del marco del cuerpo, con las patas en y = 0. */
function crearImagenMula(h: Herramientas, mitad: number, alto: number, medioAncho: number) {
  const pelo = materialTela(COLORES.silueta, { repetir: 2, relieve: 4 });
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const lomo = alto * 0.85;
  const largo = mitad * 1.5;
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CapsuleGeometry(alto * 0.17, largo - alto * 0.34, 6, 14)
          .rotateZ(Math.PI / 2)
          .scale(1, 1, medioAncho / (alto * 0.17))
          .translate(-mitad * 0.08, lomo - alto * 0.17, 0),
        // El pescuezo, inclinado hacia arriba y adelante
        new THREE.CylinderGeometry(alto * 0.09, alto * 0.13, alto * 0.42, 10)
          .rotateZ(-0.75)
          .translate(mitad * 0.62, lomo - alto * 0.02, 0),
      ]),
      pelo,
    ),
  );
  // El aparejo: una manta oscura sobre el lomo
  cuerpo.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(mitad * 0.9, 0.05, medioAncho * 2.2).translate(-mitad * 0.08, lomo + 0.01, 0),
      h.oscuro,
    ),
  );
  // La cabeza: larga, con las orejas paradas y los dos ojos blancos
  const cabeza = new THREE.Group();
  cabeza.position.set(mitad * 0.82, alto * 0.8, 0);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.CapsuleGeometry(alto * 0.085, mitad * 0.28, 4, 10)
          .rotateZ(Math.PI / 2 + 0.5)
          .translate(mitad * 0.1, -alto * 0.03, 0),
        ...[-1, 1].map((lado) =>
          new THREE.ConeGeometry(0.045, alto * 0.26, 5)
            .rotateX(lado * 0.25)
            .translate(-mitad * 0.02, alto * 0.16, lado * 0.06),
        ),
      ]),
      pelo,
    ),
  );
  cabeza.add(
    new THREE.Mesh(
      juntar([-1, 1].map((lado) => new THREE.SphereGeometry(0.022, 8, 6).translate(mitad * 0.04, 0.03, lado * 0.075))),
      materialOjo(),
    ),
  );
  cuerpo.add(cabeza);
  // La crin y la cola, trenzadas
  const trenzas: THREE.BufferGeometry[] = [];
  const crinA = new THREE.Vector3(mitad * 0.3, lomo + 0.02, 0);
  const crinB = new THREE.Vector3(mitad * 0.78, alto * 0.95, 0);
  const colaA = new THREE.Vector3(-mitad * 0.82, lomo - 0.04, 0);
  const colaB = new THREE.Vector3(-mitad * 0.98, lomo - alto * 0.5, 0);
  for (let i = 0; i < 3; i++) {
    trenzas.push(tubo(puntosDeTrenza(crinA, crinB, i, { vueltas: 9, ancho: 0.025, pasos: 16 }), 0.018));
    trenzas.push(tubo(puntosDeTrenza(colaA, colaB, i, { vueltas: 10, ancho: 0.025, pasos: 16 }), 0.02));
  }
  cuerpo.add(new THREE.Mesh(juntar(trenzas), h.oscuro));
  // Las patas: cuelgan de la cadera y del hombro y se balancean al andar
  const pata = new THREE.CylinderGeometry(0.045, 0.035, lomo - alto * 0.3, 6).translate(0, -(lomo - alto * 0.3) / 2, 0);
  const patas = [
    [mitad * 0.45, medioAncho * 0.55, 0],
    [mitad * 0.45, -medioAncho * 0.55, Math.PI],
    [-mitad * 0.55, medioAncho * 0.55, Math.PI],
    [-mitad * 0.55, -medioAncho * 0.55, 0],
  ].map(([x = 0, z = 0, fase = 0]) => {
    const g = new THREE.Group();
    g.position.set(x, lomo - alto * 0.3, z);
    g.add(new THREE.Mesh(pata, pelo));
    cuerpo.add(g);
    return { g, fase };
  });
  // La rienda: del bozal a la manija, en el mundo
  const rienda = new THREE.Mesh(new THREE.BufferGeometry(), h.oscuro);
  h.escena.add(rienda);
  let ultima = "";
  return {
    grupo,
    /** `vuelta`: zancadas; `brio`: de 0 a 1; `t`: segundos; la rienda de `bozal` a `manija` (en el mundo). */
    posar(vuelta: number, brio: number, t: number, bozal: THREE.Vector3, manija: THREE.Vector3) {
      const f = limitar(brio, 0, 1);
      const angulo = vuelta * Math.PI * 2;
      for (const { g, fase } of patas) g.rotation.z = 0.5 * f * Math.sin(angulo + fase);
      cuerpo.position.y = 0.02 * f * Math.abs(Math.sin(angulo));
      cabeza.rotation.z = 0.06 * Math.sin(t * 1.3) - 0.08 * f;
      const clave = [bozal.x, bozal.y, bozal.z, manija.x, manija.y, manija.z].map((v) => v.toFixed(3)).join(",");
      if (clave === ultima) return;
      ultima = clave;
      const medio = bozal.clone().lerp(manija, 0.5);
      medio.y -= Math.max(0, 0.6 - bozal.distanceTo(manija) * 0.4);
      rienda.geometry.dispose();
      rienda.geometry = tubo([bozal, medio, manija], 0.012);
    },
  };
}

// ── El balde ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Balde {
  readonly cual: "balde";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** El marcador (cinemático, sin choques): un metro más alto con el balde lleno, para el invitado. */
  readonly marcador: RAPIER.RigidBody;
  readonly lleno: boolean;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly cargadores: number;
  /** Cuántas veces se derramó (soltado lleno). */
  readonly derramadas: number;
  /** Dónde empezó (su centro). */
  readonly casa: THREE.Vector3;
  llenar(): void;
  /** Lo vacía: se usó el agua (apagó una piedra). */
  vaciar(): void;
  /** Lo pone donde empezó, quieto y vacío. */
  volver(): void;
  /** Llama a `aviso` cada vez que se derrama. Devuelve cómo dejar de escuchar. */
  alDerramar(aviso: () => void): () => void;
}

export function armarBalde(h: Herramientas, p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "balde" }>): Balde {
  const { rapier, mundo } = h;
  const a = AJUSTES_TRENZAS.balde;
  const { centro, medio, giro } = p.caja;
  const radio = Math.min(medio.x, medio.z);
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setLinearDamping(0.5).setAngularDamping(8));
  // El peso abajo: agarrado de cualquier lado, cuelga casi derecho
  const inercia = (p.masa * radio * radio) / 2;
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(medio.y, radio)
      .setMassProperties(
        p.masa,
        { x: 0, y: -medio.y * 0.7, z: 0 },
        { x: inercia, y: inercia, z: inercia },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setFriction(0.8)
      .setCollisionGroups(GRUPOS_TRENZAS),
    cuerpo,
  );
  const marcador = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z),
  );
  const imagen = crearImagenBalde(h, radio, medio.y);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let lleno = false;
  let cargadores = 0;
  let derramadas = 0;
  let sinManos = 0;
  let tirado = 0;
  const avisos = new Set<() => void>();
  const ponerMarcador = (ya: boolean) => {
    const donde = { x: centro.x, y: centro.y + (lleno ? a.marcador : 0), z: centro.z };
    if (ya) marcador.setTranslation(donde, true);
    marcador.setNextKinematicTranslation(donde);
  };
  const derramar = () => {
    lleno = false;
    derramadas++;
    for (const aviso of avisos) aviso();
  };
  const balde: Balde = {
    cual: "balde",
    nombre: p.nombre,
    cuerpo,
    marcador,
    get lleno() {
      return lleno;
    },
    get cargadores() {
      return cargadores;
    },
    get derramadas() {
      return derramadas;
    },
    casa: centro.clone(),
    llenar() {
      lleno = true;
      sinManos = 0;
      ponerMarcador(true);
    },
    vaciar() {
      lleno = false;
      ponerMarcador(true);
    },
    volver() {
      lleno = false;
      sinManos = 0;
      tirado = 0;
      devolver(cuerpo, centro, giro);
      ponerMarcador(true);
    },
    alDerramar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
  h.antes(() => ponerMarcador(false));
  h.despues((munecos, fuera) => {
    cargadores = cuantosAgarran(munecos, cuerpo);
    if (lleno) {
      // Lleno, nadie lo puede soltar: el agua se derrama si queda sin manos (un ratito)
      sinManos = cargadores === 0 ? sinManos + 1 : 0;
      if (sinManos > p.suelto / PASO) derramar();
    }
    // Tirado en el suelo (o caído), vuelve solo a su lugar
    const t = cuerpo.translation();
    const v = cuerpo.linvel();
    const quieto = Math.hypot(v.x, v.y, v.z) < 0.1;
    tirado = cargadores === 0 && quieto && t.y < centro.y - a.bajo ? tirado + 1 : 0;
    if (tirado > p.vuelve / PASO || fuera(t)) balde.volver();
  });

  // La imagen: el agua adentro según el marcador (también en el invitado)
  let visto = false;
  h.guardar(() => {
    visto = marcador.translation().y > centro.y + a.marcador / 2;
  });
  h.dibujar(() => imagen.posar(visto));
  return balde;
}

/** Un balde de duelas con dos aros, el asa y el agua adentro. Su centro en el medio del balde. */
function crearImagenBalde(h: Herramientas, radio: number, medioAlto: number) {
  const grupo = new THREE.Group();
  const duelas: THREE.BufferGeometry[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const angulo = (i / n) * Math.PI * 2;
    duelas.push(
      new THREE.BoxGeometry(radio * 0.5, medioAlto * 2, 0.025)
        .rotateY(-angulo + Math.PI / 2)
        .translate(Math.cos(angulo) * radio * 0.95, 0, Math.sin(angulo) * radio * 0.95),
    );
  }
  duelas.push(new THREE.CylinderGeometry(radio * 0.92, radio * 0.92, 0.03, 14).translate(0, -medioAlto + 0.02, 0));
  const deDosCaras = (h.madera as THREE.MeshStandardMaterial).clone();
  deDosCaras.side = THREE.DoubleSide;
  grupo.add(new THREE.Mesh(juntar(duelas), deDosCaras));
  // Los aros y el asa, oscuros
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.TorusGeometry(radio * 1.0, 0.018, 4, 18).rotateX(Math.PI / 2).translate(0, medioAlto * 0.6, 0),
        new THREE.TorusGeometry(radio * 1.0, 0.018, 4, 18).rotateX(Math.PI / 2).translate(0, -medioAlto * 0.6, 0),
        new THREE.TorusGeometry(radio * 0.95, 0.014, 4, 14, Math.PI).translate(0, medioAlto * 0.9, 0),
      ]),
      h.oscuro,
    ),
  );
  // El agua: clara, como el agua de La poza
  const agua = new THREE.Mesh(
    new THREE.CylinderGeometry(radio * 0.9, radio * 0.9, 0.02, 14).translate(0, medioAlto * 0.65, 0),
    new THREE.MeshStandardMaterial({ name: "agua-balde", color: COLORES.agua, roughness: 0.15, metalness: 0 }),
  );
  agua.visible = false;
  grupo.add(agua);
  return {
    grupo,
    posar(lleno: boolean) {
      agua.visible = lleno;
    },
  };
}

// ── La piedra caliente ─────────────────────────────────────────────────────────────────────────────────────

export interface Brasa {
  readonly cual: "brasa";
  readonly nombre: string;
  /** La piedra (cinemática): choca. Apagada, se hunde a ras del suelo. */
  readonly cuerpo: RAPIER.RigidBody;
  readonly caliente: boolean;
  /** Cuántas veces quemó a alguien. */
  readonly quemados: number;
  /** La apaga (con `ya`, hundida de una vez: al retomar). */
  apagar(ya?: boolean): void;
  /** Llama a `aviso` cuando se apaga. Devuelve cómo dejar de escuchar. */
  alApagar(aviso: () => void): () => void;
}

export function armarBrasa(h: Herramientas, p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "brasa" }>): Brasa {
  const { rapier, mundo } = h;
  const a = AJUSTES_TRENZAS.brasa;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setFriction(0.9),
    cuerpo,
  );
  const imagen = crearImagenBrasa(medio);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const hundida = centro.y - (medio.y * 2 - 0.02);
  let caliente = true;
  let hundir = 0;
  let quemados = 0;
  const espera = [0, 0];
  const avisos = new Set<() => void>();
  const local = new THREE.Vector3();
  /** Si ese punto toca la piedra (con su margen). */
  const toca = (q: THREE.Vector3Like) => {
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
    const m = a.margen + 0.15;
    return Math.abs(local.x) < medio.x + m && Math.abs(local.z) < medio.z + m && local.y < medio.y + a.alto;
  };
  const brasa: Brasa = {
    cual: "brasa",
    nombre: p.nombre,
    cuerpo,
    get caliente() {
      return caliente;
    },
    get quemados() {
      return quemados;
    },
    apagar(ya = false) {
      if (caliente) for (const aviso of avisos) aviso();
      caliente = false;
      if (ya) {
        hundir = a.hundir;
        cuerpo.setTranslation({ x: centro.x, y: hundida, z: centro.z }, true);
        cuerpo.setNextKinematicTranslation({ x: centro.x, y: hundida, z: centro.z });
      }
    },
    alApagar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
  h.antes((munecos) => {
    if (!caliente) {
      if (hundir < a.hundir) hundir++;
      const f = hundir / a.hundir;
      cuerpo.setNextKinematicTranslation({ x: centro.x, y: centro.y + (hundida - centro.y) * f, z: centro.z });
      return;
    }
    // Quema al que la toca: sale para atrás (alejándose de la piedra) y se cae
    munecos.forEach((m, j) => {
      if (j > 1 || (espera[j] ?? 0) > 0) return;
      const tocan = [m.partes.pelvis, m.partes.canillaIzquierda, m.partes.canillaDerecha].some((c) =>
        toca(c.translation()),
      );
      if (!tocan) return;
      const t = m.partes.pelvis.translation();
      let dx = t.x - centro.x;
      let dz = t.z - centro.z;
      const largo = Math.hypot(dx, dz) || 1;
      dx /= largo;
      dz /= largo;
      for (const parte of Object.values(m.partes)) {
        const masa = parte.mass();
        const v = parte.linvel();
        parte.applyImpulse(
          { x: (dx * p.empujon - v.x) * masa, y: a.arriba * masa, z: (dz * p.empujon - v.z) * masa },
          true,
        );
      }
      quemados++;
      espera[j] = a.espera;
    });
    for (const j of [0, 1]) espera[j] = Math.max(0, (espera[j] ?? 0) - 1);
  });
  h.despues(() => {
    if (!caliente) return;
    // Un balde lleno que llega cerca la apaga
    const arriba = centro.y + medio.y;
    for (const q of h.lista) {
      if (q.cual !== "balde" || !q.lleno) continue;
      const t = q.cuerpo.translation();
      if (Math.hypot(t.x - centro.x, t.z - centro.z) < p.alcance && t.y > arriba - 0.1) {
        q.vaciar();
        brasa.apagar();
        break;
      }
    }
  });

  // Lo que se ve: caliente mientras no se haya hundido (también en el invitado)
  let brilla = 1;
  let vapor = 0;
  let segundos = 0;
  h.guardar(() => {
    const encendida = cuerpo.translation().y > centro.y - 0.05;
    if (!encendida && brilla > 0) vapor = 2.5;
    brilla = encendida ? 1 : Math.max(0, brilla - PASO * 2);
    vapor = Math.max(0, vapor - PASO);
    segundos += PASO;
  });
  h.dibujar(() => imagen.posar(brilla, vapor, segundos));
  return brasa;
}

/** La piedra caliente: una roca con grietas que brillan (claras, sin color: el fuego se lee por el brillo) y humo
 * que sube; apagada, oscura y con un poco de vapor. */
function crearImagenBrasa(medio: THREE.Vector3) {
  const grupo = new THREE.Group();
  const roca = crearRoca(1, 77, COLORES.siluetaHonda);
  roca.geometry.computeBoundingBox();
  const caja = roca.geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
  const tam = caja.getSize(new THREE.Vector3());
  roca.scale.set((medio.x * 2) / tam.x, (medio.y * 2) / tam.y, (medio.z * 2) / tam.z);
  roca.position.y = -medio.y - caja.min.y * roca.scale.y;
  grupo.add(roca);
  const grietas = new THREE.MeshStandardMaterial({
    name: "brasa",
    color: COLORES.ojo,
    emissive: COLORES.ojo,
    emissiveIntensity: 1.2,
    roughness: 0.6,
  });
  const lineas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const x = (((i * 37) % 13) / 13 - 0.5) * medio.x * 1.4;
    const z = (((i * 19) % 11) / 11 - 0.5) * medio.z * 1.4;
    lineas.push(
      new THREE.BoxGeometry(0.03, 0.02, medio.z * (0.4 + 0.1 * (i % 3)))
        .rotateY(i * 1.3)
        .translate(x, medio.y * 0.98, z),
    );
  }
  const brillo = new THREE.Mesh(juntar(lineas), grietas);
  grupo.add(brillo);
  const luz = new THREE.PointLight(COLORES.ojo, 1.5, 2.5, 2);
  luz.position.y = medio.y + 0.3;
  grupo.add(luz);
  // El humo (o el vapor): bolitas claras que suben y se deshacen
  const humoMaterial = new THREE.MeshStandardMaterial({
    name: "humo",
    color: COLORES.niebla,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    roughness: 1,
  });
  const humo = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), humoMaterial);
    grupo.add(m);
    return m;
  });
  return {
    grupo,
    /** `brilla` de 0 a 1, `vapor` (s que le quedan) y `t` (s). */
    posar(brilla: number, vapor: number, t: number) {
      grietas.emissiveIntensity = 1.2 * brilla;
      grietas.color.setScalar(0.15 + 0.85 * brilla).multiply(new THREE.Color(COLORES.ojo));
      luz.intensity = 1.5 * brilla;
      const cuanto = Math.max(brilla, Math.min(1, vapor));
      humo.forEach((m, i) => {
        const f = (t * 0.45 + i / humo.length) % 1;
        m.visible = cuanto > 0.05;
        m.position.set(Math.sin(i * 2.3 + t) * 0.12, medio.y + f * 1.4, Math.cos(i * 1.7) * medio.z * 0.5);
        m.scale.setScalar((0.6 + f * 1.4) * cuanto);
      });
      humoMaterial.opacity = 0.45 * cuanto;
    },
  };
}

// ── El sombrero gigante ────────────────────────────────────────────────────────────────────────────────────

export interface Sombrerote {
  readonly cual: "sombrerote";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** El radio del ala (m). */
  readonly radio: number;
  /** Hacia dónde apunta la copa, en el marco del cuerpo (su eje, sobre el que rueda). */
  readonly eje: THREE.Vector3;
  /** Si ya se lo puso el Sombrerón (cinemático, en su cabeza). */
  readonly puesto: boolean;
  /** Se lo pone el Sombrerón: lo vuelve cinemático (lo mueve él). */
  ponerse(): void;
  /** Lo pone donde empezó, de canto y quieto. */
  volver(): void;
}

export function armarSombrerote(
  h: Herramientas,
  p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "sombrerote" }>,
): Sombrerote {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  // Rueda a lo largo del lado más largo (de los de abajo): su eje es el otro
  const enX = medio.x >= medio.z;
  const radio = medio.y;
  const ancho = enX ? medio.z : medio.x;
  const eje = (enX ? EJE_Z : EJE_X).clone();
  const ejeMundo = eje.clone().applyQuaternion(giro);
  // Solo gira sobre su eje (el del mundo que más se le parece): así no se cae de costado
  const [ex, ey, ez] = [Math.abs(ejeMundo.x), Math.abs(ejeMundo.y), Math.abs(ejeMundo.z)];
  const cuerpo = mundo.createRigidBody(
    h
      .dinamico(centro, giro)
      .enabledRotations(ex >= ey && ex >= ez, ey > ex && ey >= ez, ez > ex && ez > ey)
      .setLinearDamping(0.6)
      .setAngularDamping(1.2)
      .setCanSleep(false),
  );
  const deCanto = new THREE.Quaternion().setFromUnitVectors(ARRIBA, eje);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(ancho, radio).setRotation(deCanto).setMass(p.masa).setFriction(p.rozamiento),
    cuerpo,
  );
  const imagen = crearImagenSombrerote(radio, ancho);
  imagen.quaternion.copy(deCanto);
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  objeto.add(imagen);
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let puesto = false;
  const pieza: Sombrerote = {
    cual: "sombrerote",
    nombre: p.nombre,
    cuerpo,
    radio,
    eje,
    get puesto() {
      return puesto;
    },
    ponerse() {
      if (puesto) return;
      puesto = true;
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
      // En la cabeza no choca con nada
      colisionador.setCollisionGroups(0);
    },
    volver() {
      if (puesto) return;
      devolver(cuerpo, centro, giro);
    },
  };
  h.despues((_, fuera) => {
    if (!puesto && fuera(cuerpo.translation())) pieza.volver();
  });
  return pieza;
}

/** El sombrero: un ala ancha y una copa alta con su cinta trenzada. La copa apunta hacia +y de la imagen. */
function crearImagenSombrerote(radio: number, ancho: number) {
  const fieltro = materialTela(COLORES.siluetaHonda, { repetir: 3, relieve: 3 });
  const grupo = new THREE.Group();
  const ala = -ancho * 0.85;
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(radio, radio * 0.98, 0.07, 32).translate(0, ala, 0),
        new THREE.TorusGeometry(radio * 0.985, 0.045, 6, 32).rotateX(Math.PI / 2).translate(0, ala + 0.02, 0),
        new THREE.CylinderGeometry(radio * 0.42, radio * 0.5, ancho * 1.7, 20).translate(0, ancho * 0.0, 0),
        new THREE.SphereGeometry(radio * 0.42, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)
          .scale(1, 0.45, 1)
          .translate(0, ancho * 0.85, 0),
      ]),
      fieltro,
    ),
  );
  // La cinta, clara, trenzada
  const cinta: THREE.BufferGeometry[] = [];
  const r = radio * 0.49;
  for (let i = 0; i < 3; i++) {
    const puntos: THREE.Vector3[] = [];
    for (let k = 0; k <= 48; k++) {
      const angulo = (k / 48) * Math.PI * 2;
      const fase = angulo * 12 + (i * Math.PI * 2) / 3;
      puntos.push(new THREE.Vector3(Math.cos(angulo) * r, ala + 0.12 + Math.sin(fase) * 0.03, Math.sin(angulo) * r));
    }
    cinta.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos, true), 96, 0.016, 4, true));
  }
  grupo.add(
    new THREE.Mesh(
      juntar(cinta),
      new THREE.MeshStandardMaterial({ name: "cinta", color: COLORES.siluetaLejana, roughness: 0.8 }),
    ),
  );
  return grupo;
}
