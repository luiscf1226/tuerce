// Las piezas que estrena El pinar (TU-14), menos el Cadejo (cadejo.ts). Cada una sale de un nodo `tipo: pieza` de
// la escena (formato-pinar.ts) y se arma con las herramientas de piezas.ts, como las de siempre:
//
//   tronco   un tronco escuadrado de 9 kg: un muñeco solo levanta 5 (AJUSTES.cargar), así que se carga entre dos
//   tranca   una barra que se saca jalándola hacia su frente; un resorte la vuelve a meter al soltarla
//   hueso    para tirárselo al Cadejo; vuelve a su lugar cuando el Cadejo termina de roerlo
//   lampara  un farol colgado de una cadena: se enciende al agarrarlo y queda encendido
//
// Los muñecos las atraviesan (como al bejuco) pero las agarran igual: la mano las busca con una consulta, que mira
// los grupos de choque. Así el tronco que llevan dos en fila no le pega en la cabeza al de adelante, y el que camina
// sobre el tronco tendido lo pisa igual: el rayo de su suspensión sí lo ve.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearTroncoCaido, juntar, materialCorteza, materialOjo } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelPinarEnPlano } from "./formato-pinar";
import { crearInterruptor, type Herramientas } from "./piezas";

/** El bit de grupo de choque de lo suelto del pinar: choca con todo menos con los muñecos (bits 1 y 2). */
const BIT_SUELTO = 1 << 5;
export const GRUPOS_SUELTO = ((BIT_SUELTO << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se lo encuentra (para agarrarlo) pero no empuja ni lo empujan. */
const SIN_EMPUJAR = (BIT_SUELTO << 16) >>> 0;

const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Cuántas manos de ese muñeco tienen agarrado ese cuerpo. */
export function manosEn(m: Muneco, cuerpo: RAPIER.RigidBody): number {
  let manos = 0;
  for (const brazo of ["brazoIzquierdo", "brazoDerecho"] as const) {
    if (m.agarrado(brazo)?.parent()?.handle === cuerpo.handle) manos++;
  }
  return manos;
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

export interface Tronco {
  readonly cual: "tronco";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly cargadores: number;
  /** Las dos puntas, en el mundo, a lo largo de su lado más largo. */
  puntas(): [THREE.Vector3, THREE.Vector3];
  /** Lo pone donde estaba al empezar, quieto. Pasa solo si se cae al vacío. */
  volver(): void;
}

export function armarTronco(h: Herramientas, p: Extract<PiezaDelPinarEnPlano, { cual: "tronco" }>): Tronco {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const enX = medio.x >= medio.z;
  const mitad = enX ? medio.x : medio.z;
  const ancho = enX ? medio.z : medio.x;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(p.rozamiento)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  // La imagen: un tronco acostado, aplastado al ancho de la caja (arriba queda casi plano para caminarlo)
  const tronco = crearTroncoCaido({ largo: mitad * 2, radio: medio.y, semilla: 14, musgo: Math.round(mitad * 6) });
  tronco.scale.z = ancho / medio.y;
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  if (!enX) tronco.rotation.y = -Math.PI / 2;
  objeto.add(tronco);
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let cargadores = 0;
  const largo = enX ? EJE_X : EJE_Z;
  const pieza: Tronco = {
    cual: "tronco",
    nombre: p.nombre,
    cuerpo,
    get cargadores() {
      return cargadores;
    },
    puntas() {
      const q = new THREE.Quaternion().copy(cuerpo.rotation());
      const c = new THREE.Vector3().copy(cuerpo.translation());
      const eje = largo.clone().applyQuaternion(q).multiplyScalar(mitad);
      return [c.clone().sub(eje), c.add(eje)];
    },
    volver: () => devolver(cuerpo, centro, giro),
  };
  h.despues((munecos, fuera) => {
    cargadores = cuantosAgarran(munecos, cuerpo);
    if (fuera(cuerpo.translation())) pieza.volver();
  });
  return pieza;
}

export interface Tranca {
  readonly cual: "tranca";
  readonly nombre: string;
  readonly barra: RAPIER.RigidBody;
  /** Cuánto se la sacó: 0 metida, 1 afuera del todo. */
  readonly recorrido: number;
  /** Si se la sacó más allá de su `umbral`. */
  readonly abierta: boolean;
  /** Llama a `aviso` cada vez que se abre o se cierra. Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: (abierta: boolean) => void): () => void;
}

export function armarTranca(h: Herramientas, p: Extract<PiezaDelPinarEnPlano, { cual: "tranca" }>): Tranca {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  // La barra va a lo largo de su x; sale hacia su frente (+z), con un resorte que la vuelve a meter
  const ancla = h.fijo(centro, giro);
  const barra = mundo.createRigidBody(h.dinamico(centro, giro).setLinearDamping(1).setAngularDamping(2));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO)
      .setSolverGroups(SIN_EMPUJAR),
    barra,
  );
  const datos = rapier.JointData.prismatic(CERO, CERO, EJE_Z);
  datos.limitsEnabled = true;
  datos.limits = [0, p.recorrido];
  const junta = mundo.createImpulseJoint(datos, ancla, barra, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.PrismaticImpulseJoint) {
    const rigidez = p.fuerza / p.recorrido;
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * p.masa));
  }

  const madera = h.madera;
  const imagenBarra = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, medio.z * 2), madera);
  imagenBarra.name = p.nombre;
  h.mover(barra, imagenBarra);
  // Los ganchos donde descansa la barra: dos horquetas oscuras cerca de las puntas, abiertas hacia el frente
  const ganchos: THREE.BufferGeometry[] = [];
  for (const lado of [-1, 1]) {
    const x = lado * medio.x * 0.75;
    const g = medio.y * 0.6;
    ganchos.push(new THREE.BoxGeometry(g * 2, medio.y * 4, g).translate(x, -medio.y * 0.6, -medio.z - g / 2));
    ganchos.push(new THREE.BoxGeometry(g * 2, g, medio.z * 2 + g).translate(x, -medio.y - g / 2, -g / 2));
  }
  const imagenGanchos = new THREE.Mesh(juntar(ganchos), h.oscuro);
  imagenGanchos.position.copy(centro);
  imagenGanchos.quaternion.copy(giro);
  h.escena.add(imagenGanchos);
  h.solida({ nombre: p.nombre, objeto: imagenBarra, cuerpo: barra, colisionador });

  const interruptor = crearInterruptor();
  const frente = EJE_Z.clone().applyQuaternion(giro);
  let recorrido = 0;
  h.despues(() => {
    const t = barra.translation();
    const afuera = (t.x - centro.x) * frente.x + (t.y - centro.y) * frente.y + (t.z - centro.z) * frente.z;
    recorrido = limitar(afuera / p.recorrido, 0, 1);
    interruptor.poner(recorrido, p.umbral, p.umbral - 0.1);
  });
  return {
    cual: "tranca",
    nombre: p.nombre,
    barra,
    get recorrido() {
      return recorrido;
    },
    get abierta() {
      return interruptor.prendido;
    },
    alCambiar: interruptor.alCambiar,
  };
}

export const AJUSTES_HUESO = {
  /** Tirado sin que nadie lo agarre, a los cuántos segundos vuelve solo (más que lo que tarda el Cadejo en ir a
   * buscarlo y roerlo). */
  vuelveSolo: 14,
} as const;

export interface Hueso {
  readonly cual: "hueso";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado: 0 si está suelto (tirado, o en su lugar). */
  readonly agarrado: number;
  /** Si está donde empezó (no lo movieron todavía o ya volvió). */
  readonly enSuLugar: boolean;
  /** Lo pone donde estaba al empezar, quieto, y lo suelta. Pasa solo si se cae al vacío o el Cadejo lo terminó. */
  volver(): void;
}

export function armarHueso(h: Herramientas, p: Extract<PiezaDelPinarEnPlano, { cual: "hueso" }>): Hueso {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const radio = Math.max(0.02, Math.min(medio.y, medio.z));
  const medioLargo = Math.max(0.01, medio.x - radio);
  // Empieza dormido: así se queda quieto en su horqueta hasta que lo agarren (la mano lo despierta)
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(3).setSleeping(true));
  const acostado = new THREE.Quaternion().setFromAxisAngle(EJE_Z, Math.PI / 2);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(medioLargo, radio)
      .setRotation(acostado)
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  // La imagen: una caña con dos nudos en cada punta, gris claro (para que se vea contra lo oscuro y contra el suelo)
  const partes: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(radio * 0.6, radio * 0.6, medioLargo * 2, 8).rotateZ(Math.PI / 2),
  ];
  for (const lado of [-1, 1])
    for (const z of [-1, 1])
      partes.push(new THREE.SphereGeometry(radio, 10, 8).translate(lado * medioLargo, 0, z * radio * 0.6));
  const hueso = new THREE.MeshStandardMaterial({ name: "hueso", color: COLORES.siluetaLejana, roughness: 0.7 });
  const objeto = new THREE.Mesh(juntar(partes), hueso);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let agarrado = 0;
  /** Cuánto lleva tirado fuera de su lugar sin que nadie lo agarre (s). */
  let tirado = 0;
  const pieza: Hueso = {
    cual: "hueso",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.05;
    },
    volver() {
      devolver(cuerpo, centro, giro);
      cuerpo.sleep();
    },
  };
  h.despues((munecos, fuera) => {
    agarrado = cuantosAgarran(munecos, cuerpo);
    tirado = agarrado > 0 || pieza.enSuLugar ? 0 : tirado + PASO;
    // Del suelo no se lo puede levantar (las manos agarran a la altura del pecho): si el Cadejo no lo encuentra,
    // después de un rato vuelve solo a su lugar
    if (fuera(cuerpo.translation()) || tirado > AJUSTES_HUESO.vuelveSolo) {
      pieza.volver();
      tirado = 0;
    }
  });
  return pieza;
}

export interface Lampara {
  readonly cual: "lampara";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly encendida: boolean;
  /** La enciende (si ya estaba, no hace nada). Pasa sola cuando un muñeco la agarra. */
  encender(): void;
  /** Llama a `aviso` cuando se enciende. Devuelve cómo dejar de escuchar. */
  alEncender(aviso: () => void): () => void;
}

/** La luz de la lámpara: blanca, como la de los ojos (el único color del juego son los pañuelos). */
const LUZ = { color: COLORES.ojo, intensidad: 6, alcance: 7 };

export function armarLampara(h: Herramientas, p: Extract<PiezaDelPinarEnPlano, { cual: "lampara" }>): Lampara {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const gancho = h.enElMundo(p, 0, medio.y + p.cadena, 0);
  const ancla = h.fijo(gancho, giro);
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setLinearDamping(0.3).setAngularDamping(1.5));
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMass(p.masa)
      .setCollisionGroups(GRUPOS_SUELTO)
      .setSolverGroups(SIN_EMPUJAR),
    cuerpo,
  );
  const junta = mundo.createImpulseJoint(
    rapier.JointData.spherical(CERO, { x: 0, y: medio.y + p.cadena, z: 0 }),
    ancla,
    cuerpo,
    true,
  );
  junta.setContactsEnabled(false);

  // El farol: un techito y una base oscuros, cuatro parantes y el vidrio, que se prende
  const [x, y, z] = [medio.x, medio.y, medio.z];
  const marco = juntar([
    new THREE.ConeGeometry(Math.max(x, z) * 1.25, y * 0.5, 4).rotateY(Math.PI / 4).translate(0, y * 0.95, 0),
    new THREE.BoxGeometry(x * 2.1, y * 0.15, z * 2.1).translate(0, -y * 0.92, 0),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => new THREE.BoxGeometry(x * 0.18, y * 1.7, z * 0.18).translate(sx * x * 0.9, 0, sz * z * 0.9)),
    ),
    new THREE.TorusGeometry(y * 0.18, y * 0.04, 6, 12).translate(0, y * 1.35, 0),
  ]);
  const vidrio = new THREE.MeshStandardMaterial({
    name: "vidrio",
    color: COLORES.siluetaLejana,
    emissive: LUZ.color,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  objeto.add(new THREE.Mesh(marco, h.oscuro));
  objeto.add(new THREE.Mesh(new THREE.BoxGeometry(x * 1.6, y * 1.6, z * 1.6), vidrio));
  const luz = new THREE.PointLight(LUZ.color, 0, LUZ.alcance, 2);
  objeto.add(luz);
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  // La cadena, del gancho a la argolla del farol: se estira cada vez que se dibuja
  const cadena = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), h.oscuro);
  h.escena.add(cadena);
  const argolla = new THREE.Vector3();
  const medioCamino = new THREE.Vector3();
  const arriba = new THREE.Vector3(0, 1, 0);

  let encendida = false;
  const avisos = new Set<() => void>();
  const lampara: Lampara = {
    cual: "lampara",
    nombre: p.nombre,
    cuerpo,
    get encendida() {
      return encendida;
    },
    encender() {
      if (encendida) return;
      encendida = true;
      for (const aviso of avisos) aviso();
    },
    alEncender(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
  h.despues((munecos) => {
    if (cuantosAgarran(munecos, cuerpo) > 0) lampara.encender();
  });
  h.dibujar(() => {
    vidrio.emissiveIntensity = encendida ? 1.6 : 0;
    luz.intensity = encendida ? LUZ.intensidad : 0;
    argolla
      .set(0, y * 1.35, 0)
      .applyQuaternion(objeto.quaternion)
      .add(objeto.position);
    const largo = argolla.distanceTo(gancho);
    medioCamino.addVectors(argolla, gancho).multiplyScalar(0.5);
    cadena.position.copy(medioCamino);
    cadena.scale.set(1, Math.max(0.01, largo), 1);
    cadena.quaternion.setFromUnitVectors(arriba, gancho.clone().sub(argolla).normalize());
  });
  return lampara;
}

/** El nido del secreto del pinar (lo pone el guion sobre la rama más alta): un aro de ramitas con tres huevos. */
export function crearNido(): THREE.Group {
  const nido = new THREE.Group();
  nido.name = "nido";
  const ramitas: THREE.BufferGeometry[] = [new THREE.TorusGeometry(0.24, 0.09, 8, 18).rotateX(Math.PI / 2)];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    ramitas.push(
      new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4)
        .rotateZ(Math.PI / 2 + 0.4 * Math.sin(i * 2.3))
        .rotateY(a + 0.6)
        .translate(Math.cos(a) * 0.24, 0.04 * Math.cos(i * 1.7), Math.sin(a) * 0.24),
    );
  }
  nido.add(new THREE.Mesh(juntar(ramitas), materialCorteza(COLORES.silueta, { repetir: [2, 1] })));
  const huevos = juntar(
    [0, 1, 2].map((i) =>
      new THREE.SphereGeometry(0.06, 10, 8)
        .scale(1, 1.25, 1)
        .translate(0.07 * Math.cos(i * 2.1), 0.04, 0.07 * Math.sin(i * 2.1)),
    ),
  );
  nido.add(new THREE.Mesh(huevos, materialOjo()));
  return nido;
}
