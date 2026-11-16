// Las piezas que estrena La calle empedrada (TU-25), menos la Carreta sin bueyes (sin-bueyes.ts). Cada una sale de
// un nodo `tipo: pieza` de la escena (formato-calle.ts) y se arma con las herramientas de piezas.ts:
//
//   carreta    dos ruedas en un riel (la x de su caja, inclinada): la cuesta la lleva, porque sola no frena. Se
//              empuja (90 kg en la cuesta: uno solo no puede) y se monta; con `empina`, la caja gira sobre el eje y
//              se empina si el peso queda detrás
//   pesa       una pesa del reloj colgada de su cadena: el que se cuelga de la manija la baja, y abajo se traba
//   engranaje  una rueda dentada (o una aguja del reloj) que gira con su pesa, y queda donde llegó
//   campana    una campana con su soga: colgarse de la manija la toca
//   alfombra   una alfombra de aserrín en el suelo: el que la pisa la deja marcada
//
// Las pesas, los engranajes y las campanas son cinemáticos: los mueve la pieza, a paso fijo y sin azar. La carreta
// es dinámica. Todo viaja en la foto de la red; lo que se dibuja (las ruedas que giran, las agujas, las pisadas) sale
// de los cuerpos, así el invitado lo ve igual sin simular. Las pisadas se buscan en el mundo, con los cuerpos de los
// muñecos tal como quedaron (también en el invitado).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza } from "../imagen";
import { PASO } from "../motor/bucle";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDeLaCalleEnPlano } from "./formato-calle";
import type { Herramientas } from "./piezas";
import { manosEn } from "./piezas-pinar";

const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const ARRIBA = new THREE.Vector3(0, 1, 0);
const CERO = { x: 0, y: 0, z: 0 };
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Un colisionador que no choca con nada ni lo ven los rayos ni las manos: para que la pieza tenga un cuerpo en
 * `nivel.pieza(nombre)` (y en la foto de la red) sin estorbar. */
const fantasma = (rapier: Herramientas["rapier"]) =>
  rapier.ColliderDesc.ball(0.05).setSensor(true).setCollisionGroups(0);

/** El ángulo (radianes) que giró `q` respecto de `base` alrededor de `eje` (en el marco de `base`). */
function anguloRelativo(base: THREE.Quaternion, q: RAPIER.Rotation, eje: THREE.Vector3): number {
  const r = base
    .clone()
    .invert()
    .multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return 2 * Math.atan2(r.w < 0 ? -s : s, Math.abs(r.w));
}

// ── La imagen de la carreta (también la de la Carreta sin bueyes) ─────────────────────────────────────────────

export interface MedidasCarreta {
  /** Largo, alto y ancho de la caja de la pieza: de abajo de las ruedas a arriba de las barandas. */
  readonly largo: number;
  readonly alto: number;
  readonly ancho: number;
  /** El radio de las ruedas: el eje queda a esa altura sobre la base de la caja. */
  readonly rueda: number;
  /** Dónde va el eje, desde el centro, a lo largo (m). */
  readonly eje: number;
}

/** Las medidas de la carreta de una caja (medio largo, alto y ancho) y dónde va el eje (0 atrás, 1 adelante). */
export function medidasCarreta(medio: THREE.Vector3, eje = 0.5): MedidasCarreta {
  const alto = medio.y * 2;
  return {
    largo: medio.x * 2,
    alto,
    ancho: medio.z * 2,
    rueda: Math.min(0.62, alto * 0.45),
    eje: (eje - 0.5) * medio.x * 2,
  };
}

/** Las tablas de la carreta, en el marco de su caja (centro en el medio, piso a la altura del eje): el piso, las
 * barandas de los lados, la de adelante y (si `cerrada`) la de atrás. */
function tablasCarreta(m: MedidasCarreta, cerrada: boolean) {
  const piso = -m.alto / 2 + m.rueda;
  const grueso = 0.1;
  const baranda = m.alto / 2 - (piso + grueso);
  const y = piso + grueso + baranda / 2;
  const t = 0.06;
  const tablas: { centro: [number, number, number]; medio: [number, number, number] }[] = [
    { centro: [0, piso + grueso / 2, 0], medio: [m.largo / 2, grueso / 2, m.ancho / 2] },
    { centro: [0, y, m.ancho / 2 - t / 2], medio: [m.largo / 2, baranda / 2, t / 2] },
    { centro: [0, y, -m.ancho / 2 + t / 2], medio: [m.largo / 2, baranda / 2, t / 2] },
    { centro: [m.largo / 2 - t / 2, y, 0], medio: [t / 2, baranda / 2, m.ancho / 2] },
  ];
  if (cerrada) tablas.push({ centro: [-m.largo / 2 + t / 2, y, 0], medio: [t / 2, baranda / 2, m.ancho / 2] });
  return { tablas, piso: piso + grueso };
}

/** La rueda de carreta: el aro, la maza y los rayos, sobre el plano xy (gira sobre z). */
function geometriaRueda(radio: number): THREE.BufferGeometry {
  const partes: THREE.BufferGeometry[] = [
    new THREE.TorusGeometry(radio - 0.04, 0.045, 6, 28),
    new THREE.CylinderGeometry(0.09, 0.09, 0.18, 10).rotateX(Math.PI / 2),
  ];
  for (let i = 0; i < 10; i++) {
    partes.push(
      new THREE.BoxGeometry(0.035, radio - 0.08, 0.035)
        .translate(0, (radio - 0.08) / 2, 0)
        .rotateZ((i / 10) * Math.PI * 2),
    );
  }
  return juntar(partes);
}

/** La carreta de la referencia (docs/arte/13-carreta): tablas con luz entre ellas, dos ruedas grandes de rayos, las
 * varas hacia adelante y, en la sin bueyes, el yugo vacío colgando. Mira hacia +x. Devuelve la caja (sin las ruedas) y
 * las ruedas aparte, que giran con lo andado. */
export function crearImagenCarreta(
  m: MedidasCarreta,
  materiales: { madera: THREE.Material; oscuro: THREE.Material },
  { cerrada = true, yugo = false } = {},
) {
  const { madera, oscuro } = materiales;
  const caja = new THREE.Group();
  const { piso } = tablasCarreta(m, cerrada);
  const partes: THREE.BufferGeometry[] = [];
  // El piso de tablas y las barandas de tablas sueltas, con luz entre ellas
  partes.push(new THREE.BoxGeometry(m.largo, 0.1, m.ancho).translate(0, piso - 0.05, 0));
  const alto = m.alto / 2 - piso;
  const filas = 3;
  for (let f = 0; f < filas; f++) {
    const y = piso + ((f + 0.5) * alto) / filas;
    const h = (alto / filas) * 0.72;
    for (const lado of [-1, 1])
      partes.push(new THREE.BoxGeometry(m.largo, h, 0.05).translate(0, y, lado * (m.ancho / 2 - 0.03)));
    partes.push(new THREE.BoxGeometry(0.05, h, m.ancho).translate(m.largo / 2 - 0.03, y, 0));
    if (cerrada) partes.push(new THREE.BoxGeometry(0.05, h, m.ancho).translate(-m.largo / 2 + 0.03, y, 0));
  }
  caja.add(new THREE.Mesh(juntar(partes), madera));
  // Los parales de las esquinas y del medio, y los herrajes (oscuros)
  const parales: THREE.BufferGeometry[] = [];
  for (const x of [-m.largo / 2 + 0.05, 0, m.largo / 2 - 0.05])
    for (const lado of [-1, 1])
      parales.push(
        new THREE.BoxGeometry(0.08, alto + 0.08, 0.08).translate(x, piso + alto / 2, lado * (m.ancho / 2 + 0.01)),
      );
  // Las varas: dos palos que salen de adelante y se juntan en el yugo (o en la punta, que descansa en el suelo)
  const largoVaras = 1.4;
  const yVaras = piso - 0.02;
  for (const lado of [-1, 1]) {
    const desde = new THREE.Vector3(m.largo / 2, yVaras, lado * 0.32);
    const hasta = new THREE.Vector3(m.largo / 2 + largoVaras, yVaras - (yugo ? -0.15 : 0.25), lado * 0.12);
    const largo = desde.distanceTo(hasta);
    const vara = new THREE.CylinderGeometry(0.035, 0.045, largo, 6);
    const q = new THREE.Quaternion().setFromUnitVectors(ARRIBA, hasta.clone().sub(desde).normalize());
    vara.applyQuaternion(q).translate((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, (desde.z + hasta.z) / 2);
    parales.push(vara);
  }
  if (yugo) {
    // El yugo vacío, atravesado en la punta de las varas, con sus dos argollas donde irían los bueyes
    const x = m.largo / 2 + largoVaras;
    parales.push(new THREE.BoxGeometry(0.12, 0.1, 1.5).translate(x, yVaras + 0.2, 0));
    for (const lado of [-1, 1])
      parales.push(new THREE.TorusGeometry(0.14, 0.025, 5, 10).translate(x, yVaras + 0.02, lado * 0.45));
  }
  caja.add(new THREE.Mesh(juntar(parales), oscuro));

  // Las ruedas, a los lados del eje
  const ruedas = new THREE.Group();
  const geometria = geometriaRueda(m.rueda);
  const unaRueda: THREE.Object3D[] = [];
  for (const lado of [-1, 1]) {
    const r = new THREE.Mesh(geometria, oscuro);
    r.position.set(0, 0, lado * (m.ancho / 2 + 0.1));
    ruedas.add(r);
    unaRueda.push(r);
  }
  ruedas.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, m.ancho + 0.3, 6).rotateX(Math.PI / 2), oscuro));
  return {
    caja,
    ruedas,
    /** Gira las ruedas con lo andado hacia +x (m). */
    rodar(andado: number) {
      for (const r of unaRueda) r.rotation.z = -andado / m.rueda;
    },
  };
}

// ── La carreta ──────────────────────────────────────────────────────────────────────────────────────────────

export interface Carreta {
  readonly cual: "carreta";
  readonly nombre: string;
  /** La caja: lo que se empuja y sobre lo que se para uno. */
  readonly cuerpo: RAPIER.RigidBody;
  /** El eje con las ruedas, que corre por el riel (es la caja misma si no se empina). */
  readonly eje: RAPIER.RigidBody;
  /** Cuánto anduvo por el riel desde donde empezó (m; positivo hacia el +x de la caja). */
  readonly avance: number;
  /** Su velocidad por el riel (m/s). */
  readonly velocidad: number;
  /** Cuánto se empinó la caja hacia atrás sobre el eje (radianes; negativo si cabecea hacia adelante). */
  readonly empinada: number;
  /** Cuántos muñecos están arriba de ella (su pelvis sobre el piso de la caja). */
  readonly encima: number;
  /** Si está frenada (o trabada para siempre). */
  readonly frenada: boolean;
  readonly trabada: boolean;
  /** La frena donde está (una cuña); `false` la suelta, salvo que esté trabada. */
  frenar(si: boolean): void;
  /** La traba donde está, para siempre (al llegar arriba de la cuesta). */
  trabar(): void;
  /** La pone a `avance` metros por el riel, quieta y derecha (al retomar un avance). */
  ponerEn(avance: number): void;
  /** La vuelve a donde empezó, quieta y derecha; sigue frenada si lo estaba. */
  volver(): void;
}

/** Los números de la carreta que no se ponen desde Blender. */
export const AJUSTES_CARRETA = {
  /** Lo que pesan las ruedas y el eje, cuando la caja se empina aparte (kg). */
  ruedas: 30,
  /** Al llegar, frena así (m/s²). */
  frenarAlLlegar: 2,
  /** La fuerza para seguir esa velocidad al llegar (N·s/m). */
  firmezaAlLlegar: 900,
} as const;

export function armarCarreta(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "carreta" }>): Carreta {
  const { rapier, mundo } = h;
  const a = AJUSTES_CARRETA;
  const { centro, medio, giro } = p.caja;
  const m = medidasCarreta(medio, p.eje);
  const empina = p.empina > 0;
  const { tablas, piso } = tablasCarreta(m, !empina);
  // El riel: la x de la caja, inclinada `pendiente` sobre su z
  const rielLocal = new THREE.Vector3(Math.cos(p.pendiente), Math.sin(p.pendiente), 0);
  const riel = rielLocal.clone().applyQuaternion(giro);
  const puntoEje = h.enElMundo(p, m.eje, -medio.y + m.rueda, 0);

  // La caja: el piso y las barandas. Fija al eje, o aparte, con una bisagra sobre el eje
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(empina ? 0.5 : 0));
  // Lleva al que va montado: anda respecto de la carreta y, quieto, va con ella
  llevaAlQuePisa(cuerpo);
  let colisionador: RAPIER.Collider | undefined;
  const total = tablas.reduce((s, t) => s + t.medio[0] * t.medio[1] * t.medio[2], 0);
  for (const t of tablas) {
    const c = mundo.createCollider(
      rapier.ColliderDesc.cuboid(...t.medio)
        .setTranslation(...t.centro)
        .setMass((p.masa * t.medio[0] * t.medio[1] * t.medio[2]) / total)
        .setFriction(0.9),
      cuerpo,
    );
    colisionador ??= c;
  }
  if (!colisionador) throw new Error(`«${p.nombre}»: la carreta no tiene tablas`);
  // Las varas y el yugo, adelante: no chocan, pero pesan (la caja descansa hacia adelante)
  if (p.contrapeso > 0) {
    mundo.createCollider(
      rapier.ColliderDesc.ball(0.1)
        .setTranslation(medio.x + 0.7, piso - 0.05, 0)
        .setCollisionGroups(0)
        .setMass(p.contrapeso),
      cuerpo,
    );
  }

  // El ancla del riel, fija, donde empieza el eje; el eje corre por ella
  const ancla = h.fijo(empina ? puntoEje : centro, giro);
  let eje = cuerpo;
  if (empina) {
    eje = mundo.createRigidBody(h.dinamico(puntoEje, giro));
    // Las ruedas: pesan y tienen su inercia (con poca, la bisagra y el riel no se entienden), pero no chocan
    mundo.createCollider(rapier.ColliderDesc.ball(m.rueda).setCollisionGroups(0).setMass(a.ruedas), eje);
    // La bisagra: la caja gira sobre el eje (su z); hacia atrás se empina hasta `empina`, hacia adelante cabecea
    const enLaCaja = puntoEje.clone().sub(centro).applyQuaternion(giro.clone().invert());
    const bisagra = mundo.createImpulseJoint(
      rapier.JointData.revolute(CERO, vector(enLaCaja), EJE_Z),
      eje,
      cuerpo,
      true,
    );
    bisagra.setContactsEnabled(false);
    if (bisagra instanceof rapier.RevoluteImpulseJoint) {
      // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
      bisagra.setLimits(-p.cabecea, p.empina);
      bisagra.configureMotorModel(rapier.MotorModel.ForceBased);
      bisagra.configureMotorVelocity(0, 8);
    }
  }
  const datos = rapier.JointData.prismatic(CERO, CERO, vector(rielLocal));
  datos.limitsEnabled = true;
  datos.limits = [-p.atras, p.adelante];
  const junta = mundo.createImpulseJoint(datos, ancla, eje, true);
  junta.setContactsEnabled(false);
  const rielDe = junta instanceof rapier.PrismaticImpulseJoint ? junta : null;
  if (!rielDe) throw new Error(`«${p.nombre}»: no se pudo armar el riel`);
  rielDe.configureMotorModel(rapier.MotorModel.ForceBased);
  rielDe.configureMotorVelocity(0, p.rozamiento);

  // La imagen: la caja sigue a la caja y las ruedas al eje
  const imagen = crearImagenCarreta(m, { madera: h.madera, oscuro: h.oscuro }, { cerrada: !empina });
  imagen.caja.name = p.nombre;
  h.mover(cuerpo, imagen.caja);
  const ruedasEnLaCaja = new THREE.Vector3(m.eje, -medio.y + m.rueda, 0);
  if (empina) h.mover(eje, imagen.ruedas);
  else {
    imagen.ruedas.position.copy(ruedasEnLaCaja);
    imagen.caja.add(imagen.ruedas);
  }
  h.solida({ nombre: p.nombre, objeto: imagen.caja, cuerpo, colisionador });

  const inicio = new THREE.Vector3().copy(eje.translation());
  const inicioCaja = centro.clone();
  let avance = 0;
  let velocidad = 0;
  let empinada = 0;
  let encima = 0;
  let frenada = false;
  let trabada = false;
  const giroInverso = giro.clone().invert();
  const local = new THREE.Vector3();

  const medir = () => {
    const t = eje.translation();
    avance = (t.x - inicio.x) * riel.x + (t.y - inicio.y) * riel.y + (t.z - inicio.z) * riel.z;
    const v = eje.linvel();
    velocidad = v.x * riel.x + v.y * riel.y + v.z * riel.z;
    empinada = empina ? anguloRelativo(new THREE.Quaternion().copy(eje.rotation()), cuerpo.rotation(), EJE_Z) : 0;
  };
  const sujetar = () => {
    if (trabada || frenada) rielDe.setLimits(avance, avance);
    else rielDe.setLimits(-p.atras, p.adelante);
    eje.wakeUp();
  };
  const ponerEn = (donde: number) => {
    const d = limitar(donde, -p.atras, p.adelante);
    const t = riel.clone().multiplyScalar(d);
    eje.setTranslation(vector(inicio.clone().add(t)), true);
    eje.setRotation(giro, true);
    eje.setLinvel(CERO, true);
    eje.setAngvel(CERO, true);
    if (empina) {
      // La caja descansa cabeceada sobre el eje
      const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, -p.cabecea));
      const c = inicioCaja.clone().sub(puntoEje).applyQuaternion(giroInverso).applyQuaternion(q);
      cuerpo.setTranslation(vector(c.add(puntoEje).add(t)), true);
      cuerpo.setRotation(q, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
    }
    medir();
    sujetar();
  };

  h.antes(() => {
    if (frenada || trabada || p.llegada <= 0) return;
    // En los últimos metros frena sola, para parar en la punta sin golpe
    const falta = p.adelante - avance;
    if (falta < p.llegada && velocidad > 0) {
      const v = Math.sqrt(2 * a.frenarAlLlegar * Math.max(0, falta - 0.05));
      rielDe.configureMotorVelocity(Math.min(velocidad, v), a.firmezaAlLlegar);
    } else rielDe.configureMotorVelocity(0, p.rozamiento);
  });
  h.despues((munecos: readonly Muneco[]) => {
    medir();
    // Los que están arriba: su pelvis sobre el piso de la caja
    const q = new THREE.Quaternion().copy(cuerpo.rotation()).invert();
    const c = cuerpo.translation();
    encima = 0;
    for (const mu of munecos) {
      const pv = mu.partes.pelvis.translation();
      local.set(pv.x - c.x, pv.y - c.y, pv.z - c.z).applyQuaternion(q);
      if (Math.abs(local.x) < medio.x && Math.abs(local.z) < medio.z && local.y > piso && local.y < piso + 1.3)
        encima++;
    }
  });
  // Las ruedas giran con lo andado (también en el invitado, que recibe los cuerpos en la foto)
  let andado = 0;
  h.guardar(() => {
    const t = eje.translation();
    andado = (t.x - inicio.x) * riel.x + (t.y - inicio.y) * riel.y + (t.z - inicio.z) * riel.z;
  });
  h.dibujar(() => imagen.rodar(andado));

  medir();
  if (empina) ponerEn(0);
  return {
    cual: "carreta",
    nombre: p.nombre,
    cuerpo,
    eje,
    get avance() {
      return avance;
    },
    get velocidad() {
      return velocidad;
    },
    get empinada() {
      return empinada;
    },
    get encima() {
      return encima;
    },
    get frenada() {
      return frenada || trabada;
    },
    get trabada() {
      return trabada;
    },
    frenar(si) {
      if (si === frenada) return;
      frenada = si;
      medir();
      sujetar();
    },
    trabar() {
      if (trabada) return;
      trabada = true;
      medir();
      sujetar();
    },
    ponerEn,
    volver: () => ponerEn(0),
  };
}

// ── Lo que se baja colgándose: la manija de la pesa y la de la soga de la campana ─────────────────────────────────

/** Un cuerpo cinemático que baja mientras alguien cuelga de él (en el aire, con alguna mano) y sube solo. */
function crearColgadero(
  h: Herramientas,
  cuerpo: RAPIER.RigidBody,
  { recorrido, bajada, subida }: { recorrido: number; bajada: number; subida: number },
) {
  const arriba = new THREE.Vector3().copy(cuerpo.translation());
  let bajado = 0;
  let colgados = 0;
  let trabado = false;
  const poner = (fraccion: number, ya = false) => {
    bajado = limitar(fraccion, 0, 1);
    const destino = vector(arriba.clone().addScaledVector(ARRIBA, -bajado * recorrido));
    if (ya) cuerpo.setTranslation(destino, true);
    cuerpo.setNextKinematicTranslation(destino);
  };
  h.antes((munecos) => {
    colgados = munecos.filter((m) => m.estado === "en el aire" && manosEn(m, cuerpo) > 0).length;
    if (trabado) return poner(1);
    poner(bajado + (colgados > 0 ? bajada / recorrido : -subida / recorrido) * PASO);
  });
  return {
    get bajado() {
      return bajado;
    },
    get colgados() {
      return colgados;
    },
    /** Lo deja abajo del todo, trabado. */
    trabar() {
      trabado = true;
      poner(1, true);
    },
    poner,
  };
}

// ── La pesa del reloj ─────────────────────────────────────────────────────────────────────────────────────────

export interface Pesa {
  readonly cual: "pesa";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto bajó: 0 arriba, 1 abajo del todo. */
  readonly bajada: number;
  /** Cuántos muñecos cuelgan de ella. */
  readonly colgados: number;
  /** Si llegó abajo del todo: ahí se traba (y el engranaje que mueve queda donde llegó). */
  readonly llego: boolean;
  /** La deja abajo, trabada (al retomar un avance más allá del reloj). */
  bajar(): void;
}

export function armarPesa(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "pesa" }>): Pesa {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  // La manija: un travesaño abajo, a lo ancho (la x de la caja), para las dos manos; la pesa arriba
  const radioManija = 0.035;
  const yManija = -medio.y + radioManija;
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(Math.max(0.01, medio.x - radioManija), radioManija)
      .setTranslation(0, yManija, 0)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_Z, Math.PI / 2))
      .setFriction(0.9),
    cuerpo,
  );
  const radioPesa = Math.min(medio.z, medio.x * 0.6);
  const altoPesa = medio.y * 1.1;
  mundo.createCollider(
    rapier.ColliderDesc.cylinder(altoPesa / 2, radioPesa).setTranslation(0, medio.y - altoPesa / 2, 0),
    cuerpo,
  );
  const colgadero = crearColgadero(h, cuerpo, p);

  // La imagen: el cilindro de hierro con su gancho, la varilla y la manija
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  objeto.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(radioPesa, radioPesa, altoPesa, 14).translate(0, medio.y - altoPesa / 2, 0),
        new THREE.CylinderGeometry(radioPesa * 0.5, radioPesa, 0.08, 14).translate(0, medio.y + 0.04, 0),
        new THREE.TorusGeometry(0.05, 0.015, 5, 10).translate(0, medio.y + 0.12, 0),
        new THREE.CylinderGeometry(0.015, 0.015, medio.y * 2 - altoPesa).translate(
          0,
          (yManija + medio.y - altoPesa) / 2,
          0,
        ),
      ]),
      h.oscuro,
    ),
  );
  objeto.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radioManija, radioManija, medio.x * 2, 8)
        .rotateZ(Math.PI / 2)
        .translate(0, yManija, 0),
      h.madera,
    ),
  );
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  // La cadena, del gancho al muro: se estira cada vez que se dibuja
  const salida = h.enElMundo(p, 0, medio.y + p.cadena, 0);
  const cadena = estirable(h, 0.014);

  let llego = false;
  h.despues(() => {
    if (!llego && colgadero.bajado > 0.98) {
      llego = true;
      colgadero.trabar();
    }
  });
  const gancho = new THREE.Vector3();
  h.dibujar(() => {
    gancho
      .set(0, medio.y + 0.12, 0)
      .applyQuaternion(objeto.quaternion)
      .add(objeto.position);
    cadena(gancho, salida);
  });
  return {
    cual: "pesa",
    nombre: p.nombre,
    cuerpo,
    get bajada() {
      return colgadero.bajado;
    },
    get colgados() {
      return colgadero.colgados;
    },
    get llego() {
      return llego;
    },
    bajar() {
      llego = true;
      colgadero.trabar();
    },
  };
}

/** Una cadena o una soga entre dos puntos, que se estira cada vez que se dibuja. */
function estirable(h: Herramientas, radio: number, material: THREE.Material = h.oscuro) {
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 5), material);
  h.escena.add(malla);
  const medio = new THREE.Vector3();
  const direccion = new THREE.Vector3();
  return (desde: THREE.Vector3, hasta: THREE.Vector3) => {
    const largo = desde.distanceTo(hasta);
    malla.position.copy(medio.addVectors(desde, hasta).multiplyScalar(0.5));
    malla.scale.set(1, Math.max(0.01, largo), 1);
    malla.quaternion.setFromUnitVectors(ARRIBA, direccion.copy(hasta).sub(desde).normalize());
  };
}

// ── El engranaje (o la aguja del reloj) ───────────────────────────────────────────────────────────────────────

export interface Engranaje {
  readonly cual: "engranaje";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Hacia dónde apunta, en radianes desde arriba, como las agujas del reloj. */
  readonly angulo: number;
}

export function armarEngranaje(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "engranaje" }>): Engranaje {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(fantasma(rapier), cuerpo);
  const radio = Math.min(medio.x, medio.y);
  const grueso = Math.max(0.02, medio.z * 2);
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  if (p.aguja) {
    // La aguja: apunta hacia arriba (+y), angosta en la punta, con su contrapeso del otro lado
    const forma = new THREE.Shape();
    const ancho = radio * 0.1;
    forma.moveTo(-ancho, -radio * 0.22);
    forma.lineTo(ancho, -radio * 0.22);
    forma.lineTo(ancho * 0.55, radio * 0.78);
    forma.lineTo(0, radio * 0.95);
    forma.lineTo(-ancho * 0.55, radio * 0.78);
    forma.closePath();
    const geometria = new THREE.ExtrudeGeometry(forma, { depth: grueso, bevelEnabled: false }).translate(
      0,
      0,
      -grueso / 2,
    );
    objeto.add(
      new THREE.Mesh(
        juntar([
          geometria,
          new THREE.CylinderGeometry(ancho * 1.6, ancho * 1.6, grueso * 1.5, 10).rotateX(Math.PI / 2),
        ]),
        h.oscuro,
      ),
    );
  } else {
    // La rueda dentada: el aro con sus dientes, los rayos y la maza
    const partes: THREE.BufferGeometry[] = [
      new THREE.TorusGeometry(radio * 0.82, radio * 0.09, 6, 32).scale(1, 1, grueso / (radio * 0.18)),
      new THREE.CylinderGeometry(radio * 0.16, radio * 0.16, grueso * 1.4, 12).rotateX(Math.PI / 2),
    ];
    for (let i = 0; i < p.dientes; i++) {
      partes.push(
        new THREE.BoxGeometry(radio * 0.16, radio * 0.2, grueso)
          .translate(0, radio * 0.92, 0)
          .rotateZ((i / p.dientes) * Math.PI * 2),
      );
    }
    for (let i = 0; i < 5; i++) {
      partes.push(
        new THREE.BoxGeometry(radio * 0.08, radio * 0.75, grueso * 0.7)
          .translate(0, radio * 0.42, 0)
          .rotateZ((i / 5) * Math.PI * 2),
      );
    }
    objeto.add(new THREE.Mesh(juntar(partes), h.oscuro));
  }
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  /** Lo más que bajó su pesa: el engranaje no vuelve atrás (un trinquete). */
  let fraccion = 0;
  let angulo = p.desde;
  let pesa: Pesa | undefined;
  const nombrePesa = `pesa-${p.pesa}`;
  const girar = (a: number) => {
    angulo = a;
    // Como las agujas, visto desde el frente (su +z): hacia la derecha es girar hacia −z
    cuerpo.setNextKinematicRotation(giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, -a)));
  };
  cuerpo.setRotation(giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, -p.desde)), true);
  girar(p.desde);
  h.antes(() => {
    pesa ??= h.lista.find((x): x is Pesa => x.cual === "pesa" && x.nombre === nombrePesa);
    if (!pesa) throw new Error(`«${p.nombre}»: no hay una pesa «${nombrePesa}» que lo mueva`);
    fraccion = Math.max(fraccion, pesa.llego ? 1 : pesa.bajada);
    girar(p.desde + p.vueltas * Math.PI * 2 * fraccion);
  });
  return {
    cual: "engranaje",
    nombre: p.nombre,
    cuerpo,
    get angulo() {
      return angulo;
    },
  };
}

// ── La campana ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Campana {
  readonly cual: "campana";
  readonly nombre: string;
  /** La campana, que se columpia sobre su yugo. */
  readonly cuerpo: RAPIER.RigidBody;
  /** La manija de la soga. */
  readonly manija: RAPIER.RigidBody;
  /** Cuánto bajó la manija: 0 arriba, 1 abajo del todo (ahí suena). */
  readonly bajada: number;
  readonly colgados: number;
  /** Si sonó hace menos de `sonar` segundos. */
  readonly sonando: boolean;
  /** Cuántas veces sonó. */
  readonly campanadas: number;
  /** Llama a `aviso` cada vez que suena. Devuelve cómo dejar de escuchar. */
  alSonar(aviso: () => void): () => void;
}

/** Los números de la campana que no se ponen desde Blender. */
export const AJUSTES_CAMPANA = {
  /** El vaivén al sonar: cuánto se columpia (rad), cada cuánto va y vuelve (s) y cuánto tarda en calmarse (s). */
  vaiven: { angulo: 0.6, periodo: 1.5, calma: 1.6 },
  /** Para volver a sonar, la manija tiene que subir hasta acá (fracción del recorrido). */
  rearmar: 0.5,
} as const;

/** El perfil de una campana (radio, alto), de la boca a la corona, para el torno. */
function perfilCampana(radio: number, alto: number): THREE.Vector2[] {
  const puntos: [number, number][] = [
    [0, 0.95],
    [0.36, 0.95],
    [0.5, 0.82],
    [0.55, 0.55],
    [0.62, 0.3],
    [0.8, 0.12],
    [1.0, 0],
    [0.92, 0.02],
    [0.74, 0.1],
    [0.5, 0.35],
    [0.4, 0.8],
    [0, 0.88],
  ];
  return puntos.map(([r, y]) => new THREE.Vector2(r * radio, y * alto));
}

export function armarCampana(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "campana" }>): Campana {
  const { rapier, mundo } = h;
  const a = AJUSTES_CAMPANA;
  const { medio, giro } = p.caja;
  // La campana gira sobre su yugo (arriba del centro de la caja), sobre la x de la caja
  const yugo = h.enElMundo(p, 0, medio.y, 0);
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(yugo.x, yugo.y, yugo.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(fantasma(rapier), cuerpo);
  // La manija, abajo de la soga
  const radioManija = 0.035;
  const posManija = h.enElMundo(p, 0, -medio.y - p.soga, p.adelante);
  const manija = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(posManija.x, posManija.y, posManija.z)
      .setRotation(giro),
  );
  mundo.createCollider(
    rapier.ColliderDesc.capsule(0.22, radioManija)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_Z, Math.PI / 2))
      .setFriction(0.9),
    manija,
  );
  const colgadero = crearColgadero(h, manija, { recorrido: p.recorrido, bajada: 0.5, subida: 0.4 });

  // La imagen: la campana (de bronce viejo, oscura), el badajo, el yugo de madera y las ondas del sonido
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  const alto = medio.y * 2 * 0.85;
  const bronce = new THREE.Mesh(
    new THREE.LatheGeometry(perfilCampana(Math.min(medio.x, medio.z), alto), 20).translate(0, -alto - 0.12, 0),
    h.oscuro,
  );
  objeto.add(bronce);
  objeto.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6).translate(0, -alto - 0.05, 0), h.oscuro));
  objeto.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(medio.x * 2.6, 0.18, 0.22).translate(0, 0, 0),
        new THREE.BoxGeometry(0.05, 0.05, p.adelante + 0.1).translate(0, 0.04, (p.adelante + 0.1) / 2),
      ]),
      h.madera,
    ),
  );
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  const imagenManija = new THREE.Mesh(
    new THREE.CylinderGeometry(radioManija, radioManija, 0.5, 8).rotateZ(Math.PI / 2),
    h.madera,
  );
  h.mover(manija, imagenManija);
  const soga = estirable(h, 0.02, materialCorteza(COLORES.silueta, { repetir: [1, 8] }));
  const brazoSoga = new THREE.Vector3();
  const nudo = new THREE.Vector3();
  // Las ondas: anillos claros que salen de la campana cuando suena (el sonido, sin sonido)
  const onda = new THREE.MeshBasicMaterial({ color: COLORES.ojo, transparent: true, opacity: 0, depthWrite: false });
  const ondas = [0, 1, 2].map(() => {
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 4, 40), onda);
    anillo.visible = false;
    h.escena.add(anillo);
    return anillo;
  });

  let sonando = 0;
  let campanadas = 0;
  let armada = true;
  let vaiven = 0;
  const avisos = new Set<() => void>();
  h.despues(() => {
    sonando = Math.max(0, sonando - PASO);
    if (armada && colgadero.bajado > 0.98) {
      armada = false;
      sonando = p.sonar;
      vaiven = 0;
      campanadas++;
      for (const aviso of avisos) aviso();
    } else if (!armada && colgadero.bajado < a.rearmar) armada = true;
  });
  // El vaivén: se columpia sobre el yugo desde la última campanada y se calma
  h.antes(() => {
    vaiven += PASO;
    const v = a.vaiven;
    const angulo =
      campanadas > 0 ? v.angulo * Math.exp(-vaiven / v.calma) * Math.sin((vaiven / v.periodo) * Math.PI * 2) : 0;
    cuerpo.setNextKinematicRotation(giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, angulo)));
  });
  // Las ondas salen mientras la campana se columpia (también en el invitado: lo dice el cuerpo de la foto)
  let fuerza = 0;
  h.guardar(() => {
    const giroAhora = new THREE.Quaternion().copy(cuerpo.rotation());
    fuerza = Math.max(fuerza * 0.985, Math.abs(anguloRelativo(giro, giroAhora, EJE_X)) / a.vaiven.angulo);
  });
  let t = 0;
  h.dibujar(() => {
    t += 1 / 60;
    brazoSoga.set(0, 0.04, p.adelante).applyQuaternion(objeto.quaternion).add(objeto.position);
    nudo.copy(imagenManija.position);
    soga(nudo, brazoSoga);
    const centroCampana = objeto.position.clone().addScaledVector(ARRIBA, -alto * 0.6);
    ondas.forEach((anillo, i) => {
      const fase = (t * 0.9 + i / 3) % 1;
      anillo.visible = fuerza > 0.12;
      anillo.position.copy(centroCampana);
      anillo.rotation.set(Math.PI / 2, 0, 0);
      const r = 0.9 + fase * 2.4;
      anillo.scale.set(r, r, r);
      onda.opacity = 0.55 * Math.min(1, fuerza);
    });
  });
  return {
    cual: "campana",
    nombre: p.nombre,
    cuerpo,
    manija,
    get bajada() {
      return colgadero.bajado;
    },
    get colgados() {
      return colgadero.colgados;
    },
    get sonando() {
      return sonando > 0;
    },
    get campanadas() {
      return campanadas;
    },
    alSonar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

// ── La alfombra de aserrín ─────────────────────────────────────────────────────────────────────────────────────

export interface Alfombra {
  readonly cual: "alfombra";
  readonly nombre: string;
  /** Cuántas pisadas tiene. */
  readonly pisadas: number;
  /** Si nadie la pisó todavía. */
  readonly intacta: boolean;
  /** Llama a `aviso` en cada pisada nueva. Devuelve cómo dejar de escuchar. */
  alPisar(aviso: () => void): () => void;
}

/** Los números de la alfombra que no se ponen desde Blender. */
export const AJUSTES_ALFOMBRA = {
  /** Lo que cuenta como pisarla: algo de un muñeco hasta esta altura sobre ella (m). */
  alto: 0.22,
  /** Una pisada nueva cada tanto que anda el mismo muñeco (m). */
  entre: 0.35,
  /** Cuántas pisadas se dibujan, a lo sumo. */
  maximo: 80,
} as const;

/** El dibujo de la alfombra: aserrín claro con flores, grecas y un borde, en grises (el único color del juego son
 * los pañuelos). Una textura hecha a mano, que funciona también en Node. */
function texturaAlfombra(semilla: number, ancho: number, alto: number): THREE.DataTexture {
  const w = 256;
  const h = Math.max(64, Math.round((w * alto) / ancho / 8) * 8);
  const datos = new Uint8Array(w * h * 4);
  let s = (semilla * 9301 + 49297) % 233280;
  const azar = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const flores: [number, number, number][] = [];
  for (let i = 0; i < 7; i++) flores.push([0.2 + azar() * 0.6, 0.18 + azar() * 0.64, 0.06 + azar() * 0.05]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      const borde = Math.min(u, v, 1 - u, 1 - v);
      let g = 176 + (azar() - 0.5) * 26;
      if (borde < 0.05) g = 70;
      else if (borde < 0.08) g = 205;
      else if (borde < 0.11 && (Math.floor(u * 24) + Math.floor(v * 24)) % 2 === 0) g = 96;
      // El rombo del centro y las flores
      const rombo = Math.abs(u - 0.5) * 1.6 + Math.abs(v - 0.5);
      if (rombo > 0.32 && rombo < 0.36) g = 60;
      for (const [fu, fv, r] of flores) {
        const d = Math.hypot(u - fu, (v - fv) * (h / w));
        const petalos = Math.cos(Math.atan2(v - fv, u - fu) * 6);
        if (d < r * (0.65 + 0.35 * petalos)) g = d < r * 0.3 ? 225 : 110;
      }
      const i = (y * w + x) * 4;
      const gris = limitar(Math.round(g), 0, 255);
      datos[i] = gris;
      datos[i + 1] = gris;
      datos[i + 2] = gris;
      datos[i + 3] = 255;
    }
  }
  const textura = new THREE.DataTexture(datos, w, h);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearMipmapLinearFilter;
  textura.generateMipmaps = true;
  textura.needsUpdate = true;
  return textura;
}

export function armarAlfombra(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "alfombra" }>): Alfombra {
  const { rapier, mundo } = h;
  const a = AJUSTES_ALFOMBRA;
  const { centro, medio, giro } = p.caja;
  const objeto = new THREE.Mesh(
    new THREE.BoxGeometry(medio.x * 2, Math.max(0.01, medio.y * 2), medio.z * 2),
    new THREE.MeshStandardMaterial({
      name: "aserrin",
      map: texturaAlfombra(p.semilla, medio.x, medio.z),
      roughness: 1,
      metalness: 0,
    }),
  );
  objeto.name = p.nombre;
  objeto.position.copy(centro);
  objeto.quaternion.copy(giro);
  h.escena.add(objeto);
  // Las pisadas: manchas oscuras de aserrín revuelto
  const manchas = new THREE.InstancedMesh(
    new THREE.CircleGeometry(0.13, 10).rotateX(-Math.PI / 2).scale(1, 1, 1.5),
    new THREE.MeshStandardMaterial({ name: "pisada", color: COLORES.silueta, roughness: 1 }),
    a.maximo,
  );
  manchas.count = 0;
  manchas.frustumCulled = false;
  h.escena.add(manchas);

  let pisadas = 0;
  const avisos = new Set<() => void>();
  /** Dónde dejó la última pisada cada muñeco (por el bit de su grupo de choque). */
  const ultima = new Map<number, THREE.Vector3>();
  const forma = new rapier.Cuboid(medio.x, a.alto / 2, medio.z);
  const consulta = h.enElMundo(p, 0, medio.y + a.alto / 2, 0);
  const marca = new THREE.Matrix4();
  const giroMancha = new THREE.Quaternion();
  const escala = new THREE.Vector3(1, 1, 1);
  // Solo los muñecos: sus grupos de choque son los bits 1 y 2 (ver muneco.ts)
  const grupos = ((0xffff << 16) | 0b110) >>> 0;
  h.guardar(() => {
    const vistos = new Map<number, THREE.Vector3>();
    mundo.intersectionsWithShape(
      consulta,
      giro,
      forma,
      (c) => {
        const bits = (c.collisionGroups() >>> 16) & 0b110;
        const cuerpo = c.parent();
        if (!bits || !cuerpo) return true;
        const t = cuerpo.translation();
        if (!vistos.has(bits)) vistos.set(bits, new THREE.Vector3(t.x, centro.y, t.z));
        return true;
      },
      undefined,
      grupos,
    );
    for (const [bits, donde] of vistos) {
      const antes = ultima.get(bits);
      if (antes && antes.distanceTo(donde) < a.entre) continue;
      ultima.set(bits, donde);
      pisadas++;
      if (manchas.count < a.maximo) {
        giroMancha.setFromAxisAngle(ARRIBA, (pisadas * 2.39996) % (Math.PI * 2));
        marca.compose(donde.clone().setY(centro.y + medio.y + 0.004), giroMancha, escala);
        manchas.setMatrixAt(manchas.count, marca);
        manchas.count++;
        manchas.instanceMatrix.needsUpdate = true;
      }
      for (const aviso of avisos) aviso();
    }
  });
  return {
    cual: "alfombra",
    nombre: p.nombre,
    get pisadas() {
      return pisadas;
    },
    get intacta() {
      return pisadas === 0;
    },
    alPisar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

// ── Lo que dibuja el guion: la esfera del reloj y el pilón del secreto ─────────────────────────────────────────

/** La esfera del reloj: un disco claro con su borde y las doce marcas, mirando hacia su +z. */
export function crearEsfera(radio: number): THREE.Group {
  const esfera = new THREE.Group();
  esfera.name = "esfera";
  esfera.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radio, radio, 0.06, 40).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ name: "esfera", color: COLORES.siluetaLejana, roughness: 0.9 }),
    ),
  );
  const marcas: THREE.BufferGeometry[] = [new THREE.TorusGeometry(radio, 0.07, 6, 40)];
  for (let i = 0; i < 12; i++) {
    const largo = i % 3 === 0 ? 0.22 : 0.12;
    marcas.push(
      new THREE.BoxGeometry(0.06, largo, 0.04)
        .translate(0, radio - 0.1 - largo / 2, 0.04)
        .rotateZ((i / 12) * Math.PI * 2),
    );
  }
  esfera.add(new THREE.Mesh(juntar(marcas), materialCorteza(COLORES.siluetaHonda, { repetir: [1, 1] })));
  return esfera;
}

/** El pilón del secreto: un pilón de madera (el mortero de pilar maíz) con su mano atravesada. */
export function crearPilon(): THREE.Group {
  const pilon = new THREE.Group();
  pilon.name = "pilon";
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 1] });
  const perfil = [
    [0.0, 0.0],
    [0.16, 0.0],
    [0.12, 0.08],
    [0.1, 0.2],
    [0.17, 0.32],
    [0.19, 0.46],
    [0.15, 0.46],
    [0.13, 0.36],
    [0.0, 0.34],
  ].map(([r = 0, y = 0]) => new THREE.Vector2(r, y));
  pilon.add(new THREE.Mesh(new THREE.LatheGeometry(perfil, 14), madera));
  const mano = new THREE.CapsuleGeometry(0.035, 0.6, 4, 8).rotateZ(0.55).translate(0.12, 0.62, 0);
  pilon.add(new THREE.Mesh(mano, madera));
  return pilon;
}

/** Un tramo de calle para empedrar: de `x0` a `x1` y de `z0` a `z1`, con el suelo a `y0` en x0 y a `y1` en x1 (una
 * cuesta). */
export interface Tramo {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1?: number;
}

/** El empedrado (solo imagen): piedras bola apenas asomadas sobre el suelo, en filas corridas, más oscuras que la
 * tierra de abajo (TU-61, niveles/vestido.ts), como en docs/arte/13-carreta. Todas en una sola malla. */
export function crearEmpedrado(tramos: readonly Tramo[], paso = 0.26): THREE.InstancedMesh {
  let s = 12345;
  const azar = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const piedras: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const donde = new THREE.Vector3();
  for (const t of tramos) {
    const pendiente = Math.atan2((t.y1 ?? t.y0) - t.y0, t.x1 - t.x0);
    const largo = (t.x1 - t.x0) / Math.cos(pendiente);
    const filas = Math.floor((t.z1 - t.z0) / paso);
    const columnas = Math.floor(largo / paso);
    for (let f = 0; f < filas; f++) {
      for (let c = 0; c < columnas; c++) {
        const a = ((c + 0.5 + (f % 2) * 0.5 + (azar() - 0.5) * 0.25) * paso) / largo;
        if (a > 1) continue;
        const x = t.x0 + a * (t.x1 - t.x0);
        const y = t.y0 + a * ((t.y1 ?? t.y0) - t.y0);
        const z = t.z0 + (f + 0.5 + (azar() - 0.5) * 0.25) * paso;
        q.setFromAxisAngle(ARRIBA, azar() * Math.PI).premultiply(
          new THREE.Quaternion().setFromAxisAngle(EJE_Z, pendiente),
        );
        escala.set(paso * (0.4 + azar() * 0.12), 0.035, paso * (0.36 + azar() * 0.1));
        piedras.push(new THREE.Matrix4().compose(donde.set(x, y + 0.005, z), q, escala));
      }
    }
  }
  const color = new THREE.Color(COLORES.niebla).multiplyScalar(0.13);
  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 5),
    new THREE.MeshStandardMaterial({ name: "empedrado", color, roughness: 1, metalness: 0 }),
    piedras.length,
  );
  malla.name = "empedrado";
  piedras.forEach((m, i) => {
    malla.setMatrixAt(i, m);
  });
  malla.instanceMatrix.needsUpdate = true;
  return malla;
}
