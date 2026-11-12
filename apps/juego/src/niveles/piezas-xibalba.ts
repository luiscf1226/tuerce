// Las piezas que estrena Xibalbá (TU-26), menos los murciélagos (murcielagos.ts). Cada una sale de un nodo
// `tipo: pieza` de la escena (formato-xibalba.ts) y se arma con las herramientas de piezas.ts, como las de siempre:
//
//   bloque      un bloque de piedra labrada. El que pesa más de lo que levanta un muñeco solo (5 kg) no se mueve
//               de costado mientras no lo agarren los dos: ni empujándolo ni arrastrándolo. Entre dos se levanta
//   doble       dos planchas de piedra, una en cada punta: queda pisada solo con las dos hundidas a la vez
//   estela      una estela labrada que gira sobre su eje con dos varas para empujarla. Trabada mientras no la
//               agarren los dos; al girarla `angulo`, los glifos quedan alineados y se queda ahí
//   pelota      una pelota de hule que rebota; tirada en el suelo vuelve sola a su lugar
//   antorcha    se lleva con las dos manos en el travesaño (así no se ladea); tirada, vuelve encendida a su lugar
//   llave       la llave de jade: se lleva con una mano o con las dos, y se encaja en su cerradura (el guion)
//   guacamayas  vuelan en círculos dentro de su caja; solo imagen
//
// Lo que se mueve viaja en la foto de la red, como todo. El fuego de la antorcha también: es un cuerpo cinemático
// sin choques que va en la punta cuando está encendida y bien abajo cuando no, así el invitado lo ve igual.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import { AJUSTES, type Muneco } from "../muneco";
import type { PiezaDeXibalbaEnPlano } from "./formato-xibalba";
import { AJUSTES_PIEZAS, crearInterruptor, type Herramientas } from "./piezas";
import { GRUPOS_SUELTO, manosEn } from "./piezas-pinar";

type Plano<C extends PiezaDeXibalbaEnPlano["cual"]> = Extract<PiezaDeXibalbaEnPlano, { cual: C }>;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
/** Un travesaño: una cápsula de Rapier (de pie sobre su y) acostada a lo largo de x. */
const ACOSTADO = new THREE.Quaternion().setFromAxisAngle(EJE_Z, Math.PI / 2);

/** Los números de las piezas de Xibalbá que no se ponen desde Blender. */
export const AJUSTES_XIBALBA = {
  /** La estela: el rozamiento en su eje mientras la giran los dos (N·m·s/rad); si no, queda trabada del todo. */
  estela: { girando: 4, varas: 0.05, tolerancia: (2 * Math.PI) / 180 },
  /** La antorcha: el resorte que la tiene derecha cuando la llevan con las dos manos (rad/s y amortiguación). */
  antorcha: { frecuencia: 12, amortiguacion: 1, radio: 0.035, llamaApagada: 30 },
  /** La luz del fuego: blanca, como la de los ojos (el único color del juego son los pañuelos). */
  luz: { intensidad: 7, alcance: 7 },
} as const;

/** Las barandas: chocan solo con los muñecos (bits 1 y 2). Ni la cámara ni lo suelto las ven. */
const BIT_BARANDA = 1 << 6;
export const GRUPOS_BARANDA = ((BIT_BARANDA << 16) | 0b110) >>> 0;

/** Hace del colisionador una baranda: lo que da hacia la cámara puede ser bajo, y aun así no se trepa. */
export function soloParaMunecos(colisionador: RAPIER.Collider) {
  colisionador.setCollisionGroups(GRUPOS_BARANDA);
}

/** Cuántos muñecos tienen agarrado ese cuerpo (con una mano o con las dos). */
const cuantosAgarran = (munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody) =>
  munecos.filter((m) => manosEn(m, cuerpo) > 0).length;

/** Lo pone donde estaba al empezar, quieto. */
function devolver(cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3, giro: THREE.Quaternion) {
  cuerpo.setTranslation(vector(posicion), true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
}

/** El ángulo (radianes) que giró `q` respecto de `base` alrededor de `eje` (en el marco de `base`). */
function anguloRelativo(base: THREE.Quaternion, q: RAPIER.Rotation, eje: THREE.Vector3): number {
  const r = base
    .clone()
    .invert()
    .multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return 2 * Math.atan2(r.w < 0 ? -s : s, Math.abs(r.w));
}

/** La piedra labrada de Xibalbá: gris clara, áspera. Y sus relieves, más oscuros. */
function materialesDePiedra() {
  return {
    piedra: new THREE.MeshStandardMaterial({ name: "piedra", color: 0x77776f, roughness: 1, metalness: 0 }),
    relieve: new THREE.MeshStandardMaterial({ name: "relieve", color: 0x4a4a46, roughness: 1, metalness: 0 }),
  };
}
let piedras: ReturnType<typeof materialesDePiedra> | undefined;
const deLaPiedra = () => {
  piedras ??= materialesDePiedra();
  return piedras;
};

/** Un glifo maya de juguete sobre una cara: un marco, una espiral y dos puntos. En el marco de la cara: centrado en
 * (0, 0), saliendo hacia +z, de `lado` de ancho. */
function glifo(lado: number, semilla = 0): THREE.BufferGeometry[] {
  const g = lado / 2;
  const fondo = lado * 0.06;
  const partes: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    partes.push(new THREE.BoxGeometry(lado, lado * 0.08, fondo).translate(0, s * (g - lado * 0.04), fondo / 2));
    partes.push(new THREE.BoxGeometry(lado * 0.08, lado, fondo).translate(s * (g - lado * 0.04), 0, fondo / 2));
  }
  partes.push(
    new THREE.TorusGeometry(g * 0.42, lado * 0.05, 5, 14, Math.PI * 1.6).rotateZ(semilla).translate(0, 0, fondo / 2),
  );
  partes.push(
    new THREE.SphereGeometry(lado * 0.07, 6, 4).translate(
      g * 0.18 * Math.cos(semilla),
      g * 0.18 * Math.sin(semilla),
      fondo / 2,
    ),
  );
  for (const s of [-1, 1])
    partes.push(new THREE.SphereGeometry(lado * 0.06, 6, 4).translate(s * g * 0.62, -g * 0.62, fondo / 2));
  return partes;
}

// ── El bloque pesado ───────────────────────────────────────────────────────────────────────────────────────

export interface Bloque {
  readonly cual: "bloque";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly cargadores: number;
  /** Si se mueve de costado: siempre, si uno solo lo levanta; entre dos, si no. */
  readonly libre: boolean;
  /** Lo pone donde estaba al empezar, quieto. Pasa solo si cae al vacío. */
  volver(): void;
  /** Lo pone ahí, quieto (al retomar más adelante). */
  ponerEn(posicion: THREE.Vector3Like, giro?: THREE.Quaternion): void;
}

export function armarBloque(h: Herramientas, p: Plano<"bloque">): Bloque {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(1).setLinearDamping(0.1));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setMass(p.masa).setFriction(p.rozamiento),
    cuerpo,
  );
  const { piedra, relieve } = deLaPiedra();
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  objeto.add(new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, medio.z * 2), piedra));
  // Un glifo en cada cara de costado
  const lado = Math.min(medio.x, medio.y, medio.z) * 1.4;
  const caras: THREE.BufferGeometry[] = [];
  for (const [i, [rot, d]] of (
    [
      [0, medio.z],
      [Math.PI, medio.z],
      [Math.PI / 2, medio.x],
      [-Math.PI / 2, medio.x],
    ] as const
  ).entries()) {
    for (const parte of glifo(lado, i * 1.3)) caras.push(parte.translate(0, 0, d).rotateY(rot));
  }
  objeto.add(new THREE.Mesh(juntar(caras), relieve));
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  const pesado = p.masa > AJUSTES.cargar.kilos;
  const adelante = EJE_Z.clone().applyQuaternion(giro);
  let libre = true;
  const soltar = (nuevo: boolean) => {
    if (nuevo === libre) return;
    libre = nuevo;
    cuerpo.setEnabledTranslations(libre, true, libre, true);
    cuerpo.setEnabledRotations(libre, libre, libre, true);
    if (libre) return;
    // Trabado, cae derecho: lo que traía de costado se pierde (si no, seguiría de largo atravesando todo) y se
    // endereza, mirando hacia donde miraba
    cuerpo.setLinvel({ x: 0, y: cuerpo.linvel().y, z: 0 }, true);
    cuerpo.setAngvel(CERO, true);
    const largo = EJE_Z.clone().applyQuaternion(new THREE.Quaternion().copy(cuerpo.rotation()));
    const rumbo = Math.atan2(largo.x, largo.z) - Math.atan2(adelante.x, adelante.z);
    cuerpo.setRotation(giro.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo)), true);
  };
  soltar(!pesado);
  let cargadores = 0;
  const bloque: Bloque = {
    cual: "bloque",
    nombre: p.nombre,
    cuerpo,
    get cargadores() {
      return cargadores;
    },
    get libre() {
      return libre;
    },
    volver: () => devolver(cuerpo, centro, giro),
    ponerEn(posicion, otroGiro = giro) {
      devolver(cuerpo, new THREE.Vector3().copy(posicion), otroGiro);
    },
  };
  h.despues((munecos, fuera) => {
    cargadores = cuantosAgarran(munecos, cuerpo);
    soltar(!pesado || cargadores >= 2);
    if (fuera(cuerpo.translation())) bloque.volver();
  });
  return bloque;
}

// ── La plancha doble ───────────────────────────────────────────────────────────────────────────────────────

export interface Doble {
  readonly cual: "doble";
  readonly nombre: string;
  readonly placas: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** Cuánto se hundió cada placa: 0 arriba, 1 del todo. */
  readonly hundidas: readonly [number, number];
  /** Si están pisadas las dos a la vez. */
  readonly pisada: boolean;
  /** Llama a `aviso` cada vez que cambia `pisada`. Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: (pisada: boolean) => void): () => void;
}

export function armarDoble(h: Herramientas, p: Plano<"doble">): Doble {
  const { rapier, mundo } = h;
  const a = AJUSTES_PIEZAS.plancha;
  const { medio, giro } = p.caja;
  const enX = medio.x >= medio.z;
  const lado = enX ? medio.z : medio.x;
  const mitad = enX ? medio.x : medio.z;
  const altoPlaca = medio.y * 2 - p.hundir;
  const { piedra, relieve } = deLaPiedra();
  const arriba = ARRIBA.clone().applyQuaternion(giro);
  const rigidez = (p.peso * -GRAVEDAD) / p.hundir;
  const objetivo = (a.masa * -GRAVEDAD) / rigidez + a.precarga * p.hundir;

  const placas = [-1, 1].map((s, i) => {
    const [cx, cz] = enX ? [s * (mitad - lado), 0] : [0, s * (mitad - lado)];
    const reposo = h.enElMundo(p, cx, -medio.y + p.hundir + altoPlaca / 2, cz);
    const ancla = h.fijo(reposo, giro);
    const base = Math.max(0.01, lado - a.margen);
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(base, p.hundir / 2, base).setTranslation(0, -altoPlaca / 2 - p.hundir / 2, 0),
      ancla,
    );
    const placa = mundo.createRigidBody(h.dinamico(reposo, giro));
    const colisionador = mundo.createCollider(
      rapier.ColliderDesc.cuboid(lado, altoPlaca / 2, lado)
        .setMass(a.masa)
        .setFriction(0.9),
      placa,
    );
    const datos = rapier.JointData.prismatic(CERO, CERO, ARRIBA);
    datos.limitsEnabled = true;
    datos.limits = [-p.hundir, 0];
    const junta = mundo.createImpulseJoint(datos, ancla, placa, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.PrismaticImpulseJoint) {
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorPosition(objetivo, rigidez, 2 * 0.7 * Math.sqrt(rigidez * (a.masa + p.peso)));
    }
    // La placa: una losa con un glifo arriba (distinto en cada una) y su base oscura
    const imagen = new THREE.Group();
    imagen.name = i === 0 ? p.nombre : `${p.nombre}-2`;
    imagen.add(new THREE.Mesh(new THREE.BoxGeometry(lado * 2, altoPlaca, lado * 2), piedra));
    const marca = juntar(glifo(lado * 1.4, i * 2.1).map((g) => g.rotateX(-Math.PI / 2).translate(0, altoPlaca / 2, 0)));
    imagen.add(new THREE.Mesh(marca, relieve));
    h.mover(placa, imagen);
    const imagenBase = new THREE.Mesh(new THREE.BoxGeometry(base * 2, p.hundir, base * 2), h.oscuro);
    imagenBase.position.copy(h.enElMundo(p, cx, -medio.y + p.hundir / 2, cz));
    imagenBase.quaternion.copy(giro);
    h.escena.add(imagenBase);
    if (i === 0) h.solida({ nombre: p.nombre, objeto: imagen, cuerpo: placa, colisionador });
    return { placa, reposo };
  });
  // Entre las dos, un canal labrado en el piso: se lee que van juntas
  const largoCanal = (mitad - lado) * 2 - lado * 2;
  if (largoCanal > 0.05) {
    const canal = new THREE.Mesh(
      new THREE.BoxGeometry(enX ? largoCanal : 0.12, 0.012, enX ? 0.12 : largoCanal),
      relieve,
    );
    canal.position.copy(h.enElMundo(p, 0, -medio.y + 0.006, 0));
    canal.quaternion.copy(giro);
    h.escena.add(canal);
  }

  const interruptor = crearInterruptor();
  const hundidas: [number, number] = [0, 0];
  h.despues(() => {
    placas.forEach(({ placa, reposo }, i) => {
      const t = placa.translation();
      const bajo = (reposo.x - t.x) * arriba.x + (reposo.y - t.y) * arriba.y + (reposo.z - t.z) * arriba.z;
      hundidas[i] = limitar(bajo / p.hundir, 0, 1);
    });
    interruptor.poner(Math.min(hundidas[0], hundidas[1]), a.pisar, a.soltar);
  });
  const [primera, segunda] = placas;
  if (!primera || !segunda) throw new Error("la plancha doble necesita sus dos placas");
  return {
    cual: "doble",
    nombre: p.nombre,
    placas: [primera.placa, segunda.placa],
    hundidas,
    get pisada() {
      return interruptor.prendido;
    },
    alCambiar: interruptor.alCambiar,
  };
}

// ── La estela que se gira entre dos ───────────────────────────────────────────────────────────────────────

export interface Estela {
  readonly cual: "estela";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto se la giró desde el principio (radianes, de 0 a su `angulo`). */
  readonly angulo: number;
  /** Si la agarran los dos (y entonces gira). */
  readonly girando: boolean;
  /** Si ya se la giró del todo: los glifos quedaron alineados y se queda así. */
  readonly alineada: boolean;
  /** Llama a `aviso` cuando quedan alineados los glifos. Devuelve cómo dejar de escuchar. */
  alAlinear(aviso: () => void): () => void;
  /** La deja girada del todo (al retomar más adelante). */
  alinear(): void;
}

export function armarEstela(h: Herramientas, p: Plano<"estela">): Estela {
  const { rapier, mundo } = h;
  const x = AJUSTES_XIBALBA.estela;
  const { centro, medio, giro } = p.caja;
  const pie = h.enElMundo(p, 0, -medio.y, 0);
  const ancla = h.fijo(pie, giro);
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro));
  // Un poquito más arriba que el piso, para que gire sin rozarlo
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y - 0.03, medio.z)
      .setTranslation(0, 0.03, 0)
      .setMass(p.masa * 0.85)
      .setFriction(0.9),
    cuerpo,
  );
  // Las dos varas, a lo largo de su x, a `altura` de la base: una a cada lado, desde la cara hasta `brazo`
  const largoVara = Math.max(0.2, p.brazo - medio.x);
  const yVara = -medio.y + p.altura;
  for (const s of [-1, 1]) {
    mundo.createCollider(
      rapier.ColliderDesc.capsule(Math.max(0.01, largoVara / 2 - x.varas), x.varas)
        .setRotation(ACOSTADO)
        .setTranslation(s * (medio.x + largoVara / 2), yVara, 0)
        .setMass(p.masa * 0.075)
        .setFriction(0.9),
      cuerpo,
    );
  }
  const datos = rapier.JointData.revolute(CERO, { x: 0, y: -medio.y, z: 0 }, ARRIBA);
  const junta = mundo.createImpulseJoint(datos, ancla, cuerpo, true);
  junta.setContactsEnabled(false);
  const bisagra = junta instanceof rapier.RevoluteImpulseJoint ? junta : null;
  // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
  bisagra?.setLimits(0, p.angulo);
  bisagra?.configureMotorModel(rapier.MotorModel.ForceBased);
  bisagra?.configureMotorVelocity(0, x.girando);
  // Trabada mientras no la agarren los dos: no gira ni un poquito
  cuerpo.lockRotations(true, false);

  const objeto = imagenEstela(medio, largoVara, yVara, h.madera, p.nombre);
  h.mover(cuerpo, objeto);
  // El pedestal, quieto debajo
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(medio.x * 2 + 0.5, 0.12, medio.z * 2 + 0.5),
    deLaPiedra().relieve,
  );
  pedestal.position.copy(pie).addScaledVector(ARRIBA, 0.06);
  pedestal.quaternion.copy(giro);
  h.escena.add(pedestal);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let angulo = 0;
  let girando = false;
  let alineada = false;
  const avisos = new Set<() => void>();
  const estela: Estela = {
    cual: "estela",
    nombre: p.nombre,
    cuerpo,
    get angulo() {
      return angulo;
    },
    get girando() {
      return girando;
    },
    get alineada() {
      return alineada;
    },
    alAlinear(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    alinear() {
      const girada = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, p.angulo));
      cuerpo.setRotation(girada, true);
      cuerpo.setTranslation(vector(centro), true);
      cuerpo.setAngvel(CERO, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.lockRotations(true, true);
      angulo = p.angulo;
      girando = false;
      if (alineada) return;
      alineada = true;
      for (const aviso of avisos) aviso();
    },
  };
  h.despues((munecos) => {
    if (alineada) return;
    angulo = limitar(anguloRelativo(giro, cuerpo.rotation(), ARRIBA), 0, p.angulo);
    const ahora = cuantosAgarran(munecos, cuerpo) >= 2;
    if (ahora !== girando) {
      girando = ahora;
      cuerpo.lockRotations(!girando, true);
      if (!girando) cuerpo.setAngvel(CERO, true);
    }
    if (angulo >= p.angulo - x.tolerancia) estela.alinear();
  });
  return estela;
}

/** La estela: una losa alta con un señor labrado al frente (tocado, cara, brazos cruzados y el glifo del sol en el
 * pecho, el que se alinea), columnas de glifos a los lados y las dos varas de madera. */
function imagenEstela(
  medio: THREE.Vector3,
  largoVara: number,
  yVara: number,
  madera: THREE.Material,
  nombre: string,
): THREE.Group {
  const { piedra, relieve } = deLaPiedra();
  const [w, h, d] = [medio.x, medio.y, medio.z];
  const grupo = new THREE.Group();
  grupo.name = nombre;
  grupo.add(new THREE.Mesh(new THREE.BoxGeometry(w * 2, h * 2, d * 2), piedra));
  const frente: THREE.BufferGeometry[] = [];
  const cara = (g: THREE.BufferGeometry) => frente.push(g.translate(0, 0, d));
  // El tocado: tres gradas que se abren hacia arriba y unas plumas
  for (let i = 0; i < 3; i++)
    cara(new THREE.BoxGeometry(w * (1.2 + i * 0.25), h * 0.08, 0.06).translate(0, h * (0.55 + i * 0.11), 0.03));
  for (let i = -3; i <= 3; i++)
    cara(new THREE.BoxGeometry(w * 0.12, h * 0.16, 0.05).rotateZ(i * 0.18).translate(i * w * 0.2, h * 0.9, 0.025));
  // La cara, con los ojos cerrados y la nariz grande
  cara(new THREE.SphereGeometry(w * 0.42, 12, 10).scale(1, 1.25, 0.35).translate(0, h * 0.32, 0.02));
  for (const s of [-1, 1])
    cara(new THREE.BoxGeometry(w * 0.2, h * 0.012, 0.04).translate(s * w * 0.17, h * 0.36, w * 0.14));
  cara(new THREE.BoxGeometry(w * 0.1, h * 0.08, 0.08).translate(0, h * 0.29, w * 0.14));
  // Los brazos cruzados y el glifo del sol en el pecho (el que se alinea)
  for (const s of [-1, 1])
    cara(new THREE.BoxGeometry(w * 1.3, h * 0.06, 0.06).rotateZ(s * 0.35).translate(0, -h * 0.05, 0.03));
  cara(new THREE.TorusGeometry(w * 0.38, w * 0.07, 6, 18).translate(0, -h * 0.3, 0.04));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cara(
      new THREE.BoxGeometry(w * 0.08, w * 0.2, 0.05)
        .rotateZ(a)
        .translate(Math.sin(a) * w * 0.58, -h * 0.3 - Math.cos(a) * w * 0.58, 0.03),
    );
  }
  cara(new THREE.SphereGeometry(w * 0.16, 8, 6).scale(1, 1, 0.5).translate(0, -h * 0.3, 0.05));
  // Las piernas, bajo la falda
  for (const s of [-1, 1])
    cara(new THREE.BoxGeometry(w * 0.32, h * 0.32, 0.05).translate(s * w * 0.28, -h * 0.72, 0.025));
  grupo.add(new THREE.Mesh(juntar(frente), relieve));
  // Columnas de glifos en los costados y atrás
  const costados: THREE.BufferGeometry[] = [];
  const lado = Math.min(d * 1.5, h * 0.22);
  for (let i = 0; i < 5; i++) {
    const y = h * (0.75 - i * 0.38);
    for (const [rot, dist] of [
      [Math.PI / 2, w],
      [-Math.PI / 2, w],
      [Math.PI, d],
    ] as const) {
      for (const g of glifo(lado, i * 0.9 + rot)) costados.push(g.translate(0, y, dist).rotateY(rot));
    }
  }
  grupo.add(new THREE.Mesh(juntar(costados), relieve));
  // Las varas
  const varas = juntar(
    [-1, 1].map((s) =>
      new THREE.CylinderGeometry(0.045, 0.05, largoVara, 8)
        .rotateZ(Math.PI / 2)
        .translate(s * (w + largoVara / 2), yVara, 0),
    ),
  );
  grupo.add(new THREE.Mesh(varas, madera));
  return grupo;
}

// ── Lo suelto que vuelve solo a su lugar: la pelota, la antorcha y la llave ───────────────────────────────

/** Cuenta cuánto lleva tirado (sin nadie que lo agarre y fuera de su lugar) y lo devuelve a los `vuelve` segundos,
 * o si cae al vacío. `quieto` dice si no está tirado aunque esté fuera de su lugar (la llave encajada). */
function volverSolo(
  h: Herramientas,
  cuerpo: RAPIER.RigidBody,
  centro: THREE.Vector3,
  vuelve: number,
  volver: () => void,
  quieto: () => boolean = () => false,
) {
  let agarrado = 0;
  let tirado = 0;
  const enSuLugar = () => {
    const t = cuerpo.translation();
    return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.08;
  };
  h.despues((munecos, fuera) => {
    agarrado = cuantosAgarran(munecos, cuerpo);
    tirado = agarrado > 0 || quieto() || enSuLugar() ? 0 : tirado + PASO;
    if (fuera(cuerpo.translation()) || tirado > vuelve) {
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

// ── La pelota de hule ──────────────────────────────────────────────────────────────────────────────────────

export interface Pelota {
  readonly cual: "pelota";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly radio: number;
  /** Cuántos muñecos la tienen agarrada. */
  readonly agarrada: number;
  readonly enSuLugar: boolean;
  /** La pone en su lugar, quieta. Pasa sola si queda tirada `vuelve` segundos o cae al vacío. */
  volver(): void;
}

export function armarPelota(h: Herramientas, p: Plano<"pelota">): Pelota {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const radio = Math.min(medio.x, medio.y, medio.z);
  // Empieza dormida, quieta en su soporte, hasta que la agarren
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).setLinearDamping(0.05).setAngularDamping(0.4).setCcdEnabled(true).setSleeping(true),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(radio).setMass(p.masa).setFriction(0.9).setRestitution(p.rebote),
    cuerpo,
  );
  // La imagen: hule negro, con una costura que se ve girar
  const hule = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false, relieve: 1 });
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  objeto.add(new THREE.Mesh(new THREE.SphereGeometry(radio, 18, 14), hule));
  objeto.add(new THREE.Mesh(new THREE.TorusGeometry(radio * 0.99, radio * 0.05, 5, 24), h.madera));
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  const volver = () => {
    devolver(cuerpo, centro, giro);
    cuerpo.sleep();
  };
  const suelto = volverSolo(h, cuerpo, centro, p.vuelve, volver);
  return {
    cual: "pelota",
    nombre: p.nombre,
    cuerpo,
    radio,
    get agarrada() {
      return suelto.agarrado;
    },
    get enSuLugar() {
      return suelto.enSuLugar();
    },
    volver,
  };
}

// ── La antorcha ────────────────────────────────────────────────────────────────────────────────────────────

export interface Antorcha {
  readonly cual: "antorcha";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** El fuego: un cuerpo cinemático sin choques, en la punta si está encendida (y si no, bien abajo). */
  readonly fuego: RAPIER.RigidBody;
  readonly encendida: boolean;
  /** Cuántos muñecos la tienen agarrada. */
  readonly agarrada: number;
  /** Quién la lleva con las dos manos (0 el rojo, 1 el turquesa), o `null`. */
  readonly llevador: 0 | 1 | null;
  /** Si alguien la lleva bien: con las dos manos. Así va derecha. */
  readonly bienLlevada: boolean;
  readonly enSuLugar: boolean;
  /** Dónde está la llama (la punta), en el mundo. */
  llama(): THREE.Vector3;
  encender(): void;
  apagar(): void;
  /** Llama a `aviso` cuando se apaga. Devuelve cómo dejar de escuchar. */
  alApagar(aviso: () => void): () => void;
  /** La pone en su lugar, encendida (junto al fuego). Pasa sola si queda tirada `vuelve` segundos. */
  volver(): void;
}

export function armarAntorcha(h: Herramientas, p: Plano<"antorcha">): Antorcha {
  const { rapier, mundo } = h;
  const x = AJUSTES_XIBALBA.antorcha;
  const { centro, medio, giro } = p.caja;
  // El palo a lo alto, el travesaño a lo ancho, a un tercio de abajo, y la canasta del fuego arriba
  const yTravesano = -medio.y + medio.y * 2 * 0.3;
  const yCanasta = medio.y - 0.09;
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).setLinearDamping(0.2).setAngularDamping(1.5).setSleeping(true),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(medio.y - x.radio, x.radio)
      .setMass(p.masa * 0.5)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.capsule(Math.max(0.01, medio.x - x.radio), x.radio)
      .setRotation(ACOSTADO)
      .setTranslation(0, yTravesano, 0)
      .setMass(p.masa * 0.3)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.ball(0.09)
      .setTranslation(0, yCanasta, 0)
      .setMass(p.masa * 0.2)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  // El fuego: viaja en la foto de la red, así el invitado lo ve prendido o apagado
  const fuego = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y + medio.y, centro.z),
  );

  const imagen = new THREE.Group();
  imagen.name = p.nombre;
  imagen.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(x.radio * 0.9, x.radio * 1.1, medio.y * 2 - 0.12, 8).translate(0, -0.06, 0),
        new THREE.CylinderGeometry(x.radio, x.radio, medio.x * 2, 8).rotateZ(Math.PI / 2).translate(0, yTravesano, 0),
      ]),
      h.madera,
    ),
  );
  // La canasta: un cuenco de varillas oscuras
  const canasta: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.1, 0.05, 0.12, 10, 1, true).translate(0, yCanasta, 0),
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    canasta.push(
      new THREE.BoxGeometry(0.015, 0.16, 0.015)
        .rotateX(0.35)
        .rotateY(a)
        .translate(Math.sin(a) * 0.08, yCanasta, Math.cos(a) * 0.08),
    );
  }
  imagen.add(new THREE.Mesh(juntar(canasta), h.oscuro));
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });
  // La llama: blanca, como la luz de los ojos, con su luz. Sigue al cuerpo del fuego
  const llamaImagen = new THREE.Group();
  const llamaMaterial = materialOjo();
  const lengua = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 8).translate(0, 0.15, 0), llamaMaterial);
  const brasa = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), llamaMaterial);
  const luz = new THREE.PointLight(COLORES.ojo, 0, AJUSTES_XIBALBA.luz.alcance, 2);
  luz.position.y = 0.2;
  llamaImagen.add(lengua, brasa, luz);
  h.mover(fuego, llamaImagen);

  let encendida = true;
  let llevador: 0 | 1 | null = null;
  const avisos = new Set<() => void>();
  const arriba = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const punta = () => {
    q.copy(cuerpo.rotation());
    return arriba.set(0, medio.y, 0).applyQuaternion(q).add(cuerpo.translation());
  };
  const ponerFuego = () => {
    const t = punta();
    fuego.setTranslation({ x: t.x, y: encendida ? t.y : t.y - x.llamaApagada, z: t.z }, true);
  };
  ponerFuego();
  const volver = () => {
    devolver(cuerpo, centro, giro);
    cuerpo.sleep();
    encendida = true;
    ponerFuego();
  };
  const suelto = volverSolo(h, cuerpo, centro, p.vuelve, volver);
  const antorcha: Antorcha = {
    cual: "antorcha",
    nombre: p.nombre,
    cuerpo,
    fuego,
    get encendida() {
      return encendida;
    },
    get agarrada() {
      return suelto.agarrado;
    },
    get llevador() {
      return llevador;
    },
    get bienLlevada() {
      return llevador !== null;
    },
    get enSuLugar() {
      return suelto.enSuLugar();
    },
    llama: () => punta().clone(),
    encender() {
      encendida = true;
      ponerFuego();
    },
    apagar() {
      if (!encendida) return;
      encendida = false;
      ponerFuego();
      for (const aviso of avisos) aviso();
    },
    alApagar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver,
  };

  // Llevada con las dos manos, un resorte la tiene derecha (como el muñeco a su tronco)
  const inercia = (p.masa * (medio.y * 2) ** 2) / 12;
  const k = inercia * x.frecuencia ** 2;
  const c = 2 * x.amortiguacion * inercia * x.frecuencia;
  const eje = new THREE.Vector3();
  h.antes(() => {
    if (llevador === null) return;
    q.copy(cuerpo.rotation());
    eje.set(0, 1, 0).applyQuaternion(q).cross(ARRIBA);
    const w = cuerpo.angvel();
    cuerpo.applyTorqueImpulse(
      { x: (k * eje.x - c * w.x) * PASO, y: (k * eje.y - c * w.y * 0.2) * PASO, z: (k * eje.z - c * w.z) * PASO },
      true,
    );
  });
  h.despues((munecos) => {
    llevador = null;
    munecos.forEach((m, i) => {
      if (manosEn(m, cuerpo) === 2) llevador = i === 0 ? 0 : 1;
    });
    ponerFuego();
  });
  let pasos = 0;
  h.guardar(() => {
    pasos++;
  });
  h.dibujar(() => {
    // Prendida si el fuego anda en la punta (también en el invitado, que lo recibe en la foto)
    const prendida = llamaImagen.position.y > imagen.position.y - 5;
    const t = pasos * PASO;
    const titila = 1 + 0.12 * Math.sin(t * 23) + 0.08 * Math.sin(t * 37 + 1);
    lengua.scale.set(1, titila, 1);
    lengua.rotation.z = 0.12 * Math.sin(t * 9);
    luz.intensity = prendida ? AJUSTES_XIBALBA.luz.intensidad * titila : 0;
    llamaImagen.visible = prendida;
  });
  return antorcha;
}

// ── La llave de jade ───────────────────────────────────────────────────────────────────────────────────────

export interface Llave {
  readonly cual: "llave";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos la tienen agarrada. */
  readonly agarrada: number;
  readonly enSuLugar: boolean;
  /** Si ya está encajada en su cerradura. */
  readonly encajada: boolean;
  /** La encaja ahí (derecha, como empezó): queda quieta y ya no se saca. */
  encajar(posicion: THREE.Vector3Like): void;
  /** La pone en su lugar, suelta. Pasa sola si queda tirada `vuelve` segundos o cae al vacío. */
  volver(): void;
}

export function armarLlave(h: Herramientas, p: Plano<"llave">): Llave {
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
  const objeto = imagenLlave(medio, p.nombre);
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let encajada = false;
  const volver = () => {
    encajada = false;
    colisionador.setCollisionGroups(GRUPOS_SUELTO);
    cuerpo.lockTranslations(false, true);
    cuerpo.lockRotations(false, true);
    devolver(cuerpo, centro, giro);
    cuerpo.sleep();
  };
  const suelto = volverSolo(h, cuerpo, centro, p.vuelve, volver, () => encajada);
  return {
    cual: "llave",
    nombre: p.nombre,
    cuerpo,
    get agarrada() {
      return suelto.agarrado;
    },
    get enSuLugar() {
      return suelto.enSuLugar();
    },
    get encajada() {
      return encajada;
    },
    encajar(posicion) {
      encajada = true;
      // Encajada ya no choca con nada: no estorba el paso
      colisionador.setCollisionGroups(0);
      devolver(cuerpo, new THREE.Vector3().copy(posicion), giro);
      cuerpo.lockTranslations(true, true);
      cuerpo.lockRotations(true, true);
    },
    volver,
  };
}

/** El jade sin color: una piedra clara y pulida, más clara que todo lo de alrededor, con un brillo propio. */
function materialJade() {
  return new THREE.MeshStandardMaterial({
    name: "jade",
    color: 0xd6d8d2,
    emissive: 0x9a9c97,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.1,
  });
}

/** La llave: una placa de jade con una carita labrada (ojos, nariz, boca), redondeada arriba y con un agujero. */
function imagenLlave(medio: THREE.Vector3, nombre: string): THREE.Group {
  const [w, h, d] = [medio.x, medio.y, medio.z];
  const grupo = new THREE.Group();
  grupo.name = nombre;
  const placa = juntar([
    new THREE.BoxGeometry(w * 2, h * 1.4, d * 2).translate(0, -h * 0.3, 0),
    new THREE.CylinderGeometry(w, w, d * 2, 16, 1, false, 0, Math.PI)
      .rotateX(Math.PI / 2)
      .rotateZ(Math.PI / 2)
      .translate(0, h * 0.4, 0),
  ]);
  grupo.add(new THREE.Mesh(placa, materialJade()));
  const labrado = juntar([
    ...[-1, 1].map((s) => new THREE.BoxGeometry(w * 0.45, h * 0.08, 0.02).translate(s * w * 0.42, h * 0.25, d)),
    new THREE.BoxGeometry(w * 0.2, h * 0.3, 0.025).translate(0, 0, d),
    new THREE.BoxGeometry(w * 0.9, h * 0.08, 0.02).translate(0, -h * 0.35, d),
    new THREE.TorusGeometry(w * 0.18, w * 0.05, 5, 12).translate(0, h * 0.62, d * 0.5),
    ...[-1, 1].map((s) => new THREE.BoxGeometry(w * 0.12, h * 0.6, 0.02).translate(s * w * 0.85, -h * 0.35, d)),
  ]);
  grupo.add(
    new THREE.Mesh(labrado, new THREE.MeshStandardMaterial({ name: "jade-labrado", color: 0x8a8c87, roughness: 0.5 })),
  );
  return grupo;
}

// ── El fuego del brasero y las sogas del contrapeso (los arma el guion) ──────────────────────────────────

/** El fuego quieto de un brasero: una llama blanca con su luz. */
export function crearFuego(): THREE.Group {
  const fuego = new THREE.Group();
  fuego.name = "fuego-brasero";
  const llama = materialOjo();
  fuego.add(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 9).translate(0, 0.22, 0), llama));
  for (const [i, a] of [0, 2.1, 4.2].entries()) {
    const lengua = new THREE.ConeGeometry(0.08, 0.28 - i * 0.03, 6);
    fuego.add(new THREE.Mesh(lengua.translate(Math.cos(a) * 0.12, 0.14, Math.sin(a) * 0.12), llama));
  }
  const luz = new THREE.PointLight(COLORES.ojo, 5, 6, 2);
  luz.position.y = 0.4;
  fuego.add(luz);
  return fuego;
}

export interface Soga {
  readonly objeto: THREE.Object3D;
  /** La tiende de un punto al otro. */
  estirar(desde: THREE.Vector3Like, hasta: THREE.Vector3Like): void;
}

/** Una soga oscura y delgada que se tiende entre dos puntos. */
export function crearSoga(): Soga {
  const objeto = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 1, 5),
    new THREE.MeshStandardMaterial({ name: "soga", color: COLORES.silueta, roughness: 1 }),
  );
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  return {
    objeto,
    estirar(desde, hasta) {
      a.copy(desde);
      b.copy(hasta);
      objeto.position.addVectors(a, b).multiplyScalar(0.5);
      objeto.scale.set(1, Math.max(0.01, a.distanceTo(b)), 1);
      objeto.quaternion.setFromUnitVectors(ARRIBA, b.sub(a).normalize());
    },
  };
}

// ── Las guacamayas ─────────────────────────────────────────────────────────────────────────────────────────

/** Una guacamaya mirando hacia +z: cuerpo, cabeza con el pico curvo, la cola larga y dos alas que se mueven. */
export function crearGuacamaya(material: THREE.Material): { grupo: THREE.Group; alas: readonly THREE.Object3D[] } {
  const grupo = new THREE.Group();
  const cuerpo = juntar([
    new THREE.CapsuleGeometry(0.075, 0.2, 4, 10).rotateX(Math.PI / 2 - 0.25),
    new THREE.SphereGeometry(0.075, 10, 8).translate(0, 0.06, 0.16),
    // El pico curvo, grande
    new THREE.ConeGeometry(0.035, 0.09, 6).rotateX(Math.PI / 2 + 0.9).translate(0, 0.03, 0.235),
    // La cola, larga: dos plumas que se abren un poco
    ...[-1, 1].map((s) =>
      new THREE.BoxGeometry(0.035, 0.008, 0.5)
        .translate(0, 0, -0.25)
        .rotateY(s * 0.06)
        .rotateX(-0.2)
        .translate(s * 0.012, -0.05, -0.12),
    ),
  ]);
  grupo.add(new THREE.Mesh(cuerpo, material));
  const alas = [-1, 1].map((s) => {
    const ala = new THREE.Group();
    ala.position.set(s * 0.05, 0.03, 0.02);
    // Un ala ancha que se angosta hacia la punta, con plumas sueltas
    const forma = new THREE.Shape();
    forma.moveTo(0, 0.08);
    forma.lineTo(s * 0.42, 0.02);
    forma.lineTo(s * 0.46, -0.06);
    forma.lineTo(s * 0.3, -0.1);
    forma.lineTo(0, -0.08);
    const geo = new THREE.ShapeGeometry(forma).rotateX(-Math.PI / 2);
    ala.add(new THREE.Mesh(geo, material));
    grupo.add(ala);
    return ala;
  });
  return { grupo, alas };
}

/** La guacamaya dorada del secreto: posada, con las alas plegadas, de un metal claro y pulido que brilla (el
 * dorado sin color: más claro que todo y con su propio brillo). */
export function crearGuacamayaDorada(): THREE.Group {
  const oro = new THREE.MeshStandardMaterial({
    name: "dorada",
    color: 0xe8e6de,
    emissive: 0xb8b6ae,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.85,
    side: THREE.DoubleSide,
  });
  const { grupo, alas } = crearGuacamaya(oro);
  // Posada derecha, con las alas plegadas a los costados y la cola larga colgando
  for (const [i, ala] of alas.entries()) {
    ala.rotation.set(0, (i === 0 ? -1 : 1) * 0.15, (i === 0 ? 1 : -1) * 1.5);
    ala.scale.setScalar(0.6);
  }
  grupo.rotation.x = -1.15;
  grupo.scale.setScalar(2.4);
  const posada = new THREE.Group();
  posada.name = "guacamaya-dorada";
  // De perfil a la cámara: se lee el pico y la cola
  posada.rotation.y = Math.PI / 2;
  grupo.position.y = 0.55;
  posada.add(grupo);
  // La percha: un poste corto con su travesaño, oscuro (así el dorado claro se lee encima)
  const percha = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(0.05, 0.07, 0.4, 8).translate(0, 0.2, 0),
      new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8).rotateZ(Math.PI / 2).translate(0, 0.4, 0),
    ]),
    new THREE.MeshStandardMaterial({ name: "percha", color: COLORES.siluetaHonda, roughness: 1 }),
  );
  posada.add(percha);
  const brillo = new THREE.PointLight(COLORES.ojo, 2.5, 3.5, 2);
  brillo.position.set(0, 0.6, 0.4);
  posada.add(brillo);
  return posada;
}

export interface Guacamayas {
  readonly cual: "guacamayas";
  readonly nombre: string;
  readonly cuantas: number;
}

export function armarGuacamayas(h: Herramientas, p: Plano<"guacamayas">): Guacamayas {
  const { centro, medio, giro } = p.caja;
  const material = materialTela(COLORES.silueta, { repetir: 1, pelusa: false });
  material.side = THREE.DoubleSide;
  // Cada una da vueltas por su elipse, a su altura y a su ritmo; todas hacia el mismo lado
  const vuelos = Array.from({ length: p.cuantas }, (_, i) => {
    const { grupo, alas } = crearGuacamaya(material);
    grupo.name = `${p.nombre}-${i + 1}`;
    h.escena.add(grupo);
    const u = (i + 0.5) / p.cuantas;
    return {
      grupo,
      alas,
      fase: i * 2.399,
      radioX: medio.x * (0.45 + 0.5 * ((i * 0.618) % 1)),
      radioZ: medio.z * (0.4 + 0.5 * ((i * 0.382) % 1)),
      alto: (u - 0.5) * 1.6 * medio.y,
      vuelta: 0.08 + 0.05 * ((i * 0.73) % 1),
      aleteo: 7 + (i % 3),
    };
  });
  let pasos = 0;
  h.guardar(() => {
    pasos++;
  });
  const local = new THREE.Vector3();
  const siguiente = new THREE.Vector3();
  h.dibujar((alfa) => {
    const t = (pasos - 1 + alfa) * PASO;
    for (const v of vuelos) {
      const a = t * v.vuelta * Math.PI * 2 + v.fase;
      local.set(Math.cos(a) * v.radioX, v.alto + 0.4 * Math.sin(a * 2), Math.sin(a) * v.radioZ);
      siguiente.set(Math.cos(a + 0.05) * v.radioX, local.y, Math.sin(a + 0.05) * v.radioZ);
      local.applyQuaternion(giro).add(centro);
      siguiente.applyQuaternion(giro).add(centro);
      v.grupo.position.copy(local);
      v.grupo.lookAt(siguiente);
      // Planea un rato y aletea otro
      const planea = Math.sin(a * 1.7) > 0.4;
      const ala = planea ? 0.1 : 0.7 * Math.sin(t * v.aleteo * Math.PI * 2);
      for (const [i, ala3] of v.alas.entries()) ala3.rotation.z = (i === 0 ? -1 : 1) * ala;
    }
  });
  return { cual: "guacamayas", nombre: p.nombre, cuantas: p.cuantas };
}
