// Las piezas que estrena El puente de paja (TU-45), menos la llama (llama.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-puente.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   qeswa     tres hebras de paja entre dos torcedores (un palo de través que gira sobre su estaca). Agarrado con las
//             dos manos, el torcedor gira con el que lo agarra al girar. La cuerda se trenza solo si los dos giran a
//             la vez y para lados contrarios; si uno suelta antes de terminar, se destuerce.
//   chaka     el puente colgante. Empieza flojo, colgando en el cañón y sin piso. Se tensa jalando su soga hacia atrás
//             (una manija con resorte, como la tranca) y se amarra sosteniendo el amarre del estribo con las dos manos
//             mientras está tenso: ahí se teje el piso. Amarrado, se mece con los que caminan encima (más cuanto más
//             rápido y más en el medio) y se calma solo; si se mece más de la cuenta, se voltea y bota a los de encima.
//   bocatoma  una losa que tapa la boca de un canal: se abre jalándola de su travesaño y se cierra empujándola.
//   anden     la terraza sembrada: el guion la riega mientras le llega agua y con eso las matas se paran.
//
// Todo lo que se mueve (los torcedores, cada tramo del puente, la soga, la losa) viaja en la foto de la red. El estado
// que no se ve en un cuerpo (lo trenzado, si el puente está amarrado, lo regado) lo lleva un marcador cinemático sin
// choques, como el nudo de Las trenzas: el invitado lo lee en `guardar` y dibuja con eso.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearMata, juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelPuenteEnPlano } from "./formato-puente";
import { crearImagenLlama } from "./llama";
import { crearInterruptor, type Herramientas } from "./piezas";
import { crearImagenTecho } from "./piezas-llano";
import { manosEn } from "./piezas-pinar";
import { puntosDeTrenza } from "./piezas-trenzas";

/** El bit de grupo de choque de lo suelto del puente de paja (los torcedores, la soga, el amarre, las losas): choca con
 * todo menos con los muñecos (bits 1 y 2). Las manos lo encuentran igual. */
const BIT_PUENTE = 1 << 13;
export const GRUPOS_PUENTE = ((BIT_PUENTE << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se lo encuentra (para agarrarlo) pero no empuja ni lo empujan. */
const SIN_EMPUJAR = (BIT_PUENTE << 16) >>> 0;
/** Las barandas del puente: solo atajan a los muñecos. */
const SOLO_MUNECOS = ((BIT_PUENTE << 16) | 0b110) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const suave = (t: number) => {
  const x = limitar(t, 0, 1);
  return x * x * (3 - 2 * x);
};
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** Los números de las piezas del puente de paja que no se ponen desde Blender. */
export const AJUSTES_PUENTE = {
  qeswa: {
    /** El torcedor: medio largo del palo de través (m) y cuánto se frena solo (1/s). */
    palo: 0.22,
    frenar: 2,
    /** Desde qué velocidad (rad/s) un torcedor cuenta como que está girando (no un temblor de las manos). */
    girando: 0.3,
    /** Cuánto gira el marcador de la cuerda de suelta a trenzada (radianes) y cuánto baja trenzada (m). */
    giro: 2.5,
    bajar: 0.4,
  },
  chaka: {
    /** El largo de cada tramo del piso (m), su grueso y el alto de las barandas (m). */
    tramo: 1,
    grueso: 0.08,
    baranda: 0.8,
    /** La manija de la soga: a cuánto detrás de la punta − está sin jalar (m), su alto sobre el piso y su masa. */
    soga: { atras: 1.6, alto: 1.0, masa: 1.5, medio: 0.22 },
    /** El amarre: a cuánto detrás de la punta − (m) y a qué alto sobre el piso. */
    amarre: { atras: 0.6, alto: 1.0, medio: 0.22 },
    /** Qué tan rápido sigue la tensión a la soga (1/s). */
    seguir: 6,
    /** Desde qué tensión soltar la soga cuenta como «se les soltó la cuerda». */
    soltar: 0.5,
    /** Quién está encima: hasta dónde del costado del piso (m) y de alto sobre él (m). */
    encima: { costado: 0.2, alto: 1.5 },
    /** A qué velocidad (m/s) se mece del todo el que camina encima. */
    andar: 1.6,
    /** Lo que se mece solo con el viento (radianes). */
    viento: 0.015,
    /** Al voltearse: cuánto gira (radianes), en cuánto (s), cuánto se queda volteado (s) y en cuánto se endereza. */
    volteo: { angulo: 2.3, girar: 0.35, quedarse: 1.6, enderezar: 1.6 },
    /** Con qué velocidad bota a los de encima (m/s, de lado y hacia arriba). */
    botar: { lado: 3.6, arriba: 1.2 },
    /** Cuánto baja el marcador si no está amarrado (m). */
    marcador: 2,
  },
  bocatoma: {
    /** Cuánto se frena la losa (N·s/m): queda donde la dejan. */
    frenar: 60,
    /** Deja de estar abierta al volver esta fracción por debajo del umbral. */
    histeresis: 0.1,
    /** La densidad de la losa, para el agua (kg/m³). */
    densidad: 2600,
  },
  anden: {
    /** Cuánto baja el marcador (m): de ahí sube lo que está regado. */
    marcador: 3,
  },
} as const;

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

/** Un tubo que pasa por esos puntos (para sogas y trenzas). */
function tubo(puntos: readonly THREE.Vector3[], radio: number, lados = 5): THREE.BufferGeometry {
  if (puntos.length < 2) return new THREE.BufferGeometry();
  const curva = new THREE.CatmullRomCurve3([...puntos]);
  return new THREE.TubeGeometry(curva, Math.max(4, puntos.length * 2), radio, lados, false);
}

/** Un palo de `radio` de `a` a `b`. */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 5): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Cuántos muñecos tienen agarrado ese cuerpo. */
const cuantosAgarran = (munecos: readonly Muneco[], cuerpo: RAPIER.RigidBody) =>
  munecos.filter((m) => manosEn(m, cuerpo) > 0).length;

/** Lo que giró `q` alrededor de `eje` (en el marco de `base`), en (−π, π]. */
function giroAlrededor(base: THREE.Quaternion, q: RAPIER.Rotation, eje: THREE.Vector3): number {
  const r = base
    .clone()
    .invert()
    .multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return envolver(2 * Math.atan2(s, r.w));
}

/** Un marcador: un cuerpo cinemático sin choques que lleva un estado en su altura o en su giro (para el invitado). */
function crearMarcador(h: Herramientas, donde: THREE.Vector3Like, giro: THREE.Quaternion) {
  const cuerpo = h.mundo.createRigidBody(
    h.rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(donde.x, donde.y, donde.z).setRotation(giro),
  );
  const colisionador = h.mundo.createCollider(
    h.rapier.ColliderDesc.ball(0.1).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  /** Lo pone ahí (de una vez con `ya`; si no, en el próximo paso). */
  const poner = (p: THREE.Vector3Like, q: THREE.Quaternion, ya: boolean) => {
    if (ya) {
      cuerpo.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    cuerpo.setNextKinematicRotation(q);
  };
  return { cuerpo, colisionador, poner };
}

/** Un palo de través agarrable (de las dos manos), con su resorte o su freno lo pone cada pieza. */
function travesano(h: Herramientas, donde: THREE.Vector3, giro: THREE.Quaternion, medio: number, masa: number) {
  const cuerpo = h.mundo.createRigidBody(h.dinamico(donde, giro).setCanSleep(false));
  h.mundo.createCollider(
    h.rapier.ColliderDesc.cuboid(0.035, 0.035, medio)
      .setMass(masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_PUENTE)
      .setSolverGroups(SIN_EMPUJAR),
    cuerpo,
  );
  return cuerpo;
}

// ── La qeswa ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Qeswa {
  readonly cual: "qeswa";
  readonly nombre: string;
  /** Los dos torcedores (el de la punta − y el de la +). */
  readonly torcedores: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** El marcador de la cuerda (cinemático, sin choques): su giro dice cuánto se trenzó. */
  readonly marcador: RAPIER.RigidBody;
  /** Cuánto se trenzó: 0 suelta, 1 trenzada. */
  readonly progreso: number;
  readonly trenzada: boolean;
  /** Lo trenzado que se ve, de 0 a 1, según el marcador (también en el invitado, que no corre `despues`). */
  readonly vista: number;
  /** Si alguien agarra cada torcedor. */
  readonly agarrados: readonly [boolean, boolean];
  /** Cuánto giró cada torcedor en el último paso (radianes; positivo, hacia la izquierda, mirado desde arriba). */
  readonly giros: readonly [number, number];
  /** Cuántas veces alguien soltó su torcedor con la cuerda a medio trenzar. */
  readonly soltadas: number;
  /** La deja trenzada de una vez (al retomar). */
  trenzar(): void;
  /** Llama a `aviso` cuando queda trenzada. Devuelve cómo dejar de escuchar. */
  alTrenzar(aviso: () => void): () => void;
  /** Llama a `aviso` cada vez que alguien suelta su torcedor a medio trenzar. */
  alSoltar(aviso: () => void): () => void;
}

export function armarQeswa(h: Herramientas, p: Extract<PiezaDelPuenteEnPlano, { cual: "qeswa" }>): Qeswa {
  const { mundo, rapier } = h;
  const a = AJUSTES_PUENTE.qeswa;
  const { centro, medio } = p.caja;
  const { giro, mitad } = marcoLargo(p.caja.giro, medio);
  const eje = EJE_X.clone().applyQuaternion(giro);
  const pie = centro.y - medio.y;
  /** El medio de la cuerda, a la altura de los torcedores (arriba de la caja). */
  const medioCuerda = new THREE.Vector3(centro.x, centro.y + medio.y, centro.z);

  // Los torcedores: un palo de través sobre una bisagra vertical, en cada punta, arriba de la caja
  const torcedores = ([-1, 1] as const).map((lado) => {
    const donde = medioCuerda.clone().addScaledVector(eje, lado * mitad);
    const ancla = h.fijo(donde, giro);
    const cuerpo = travesano(h, donde, giro, a.palo, p.masa);
    cuerpo.setAngularDamping(a.frenar);
    const junta = mundo.createImpulseJoint(
      rapier.JointData.revolute(CERO, CERO, { x: 0, y: 1, z: 0 }),
      ancla,
      cuerpo,
      true,
    );
    junta.setContactsEnabled(false);
    return { cuerpo, donde, lado, angulo: 0, antes: 0, agarrado: false };
  });
  const [t0, t1] = torcedores;
  if (!t0 || !t1) throw new Error("la qeswa sin torcedores");

  const marcador = crearMarcador(h, medioCuerda, giro);
  const imagen = crearImagenQeswa(h, torcedores.map((t) => t.donde) as [THREE.Vector3, THREE.Vector3], pie, a.palo);
  imagen.cuerda.name = p.nombre;
  h.escena.add(imagen.grupo);
  h.mover(marcador.cuerpo, imagen.nudo);
  h.solida({ nombre: p.nombre, objeto: imagen.nudo, cuerpo: marcador.cuerpo, colisionador: marcador.colisionador });
  for (const t of torcedores) h.mover(t.cuerpo, imagen.palo());

  let progreso = 0;
  let trenzada = false;
  let soltadas = 0;
  let giros: [number, number] = [0, 0];
  const avisos = new Set<() => void>();
  const avisosSoltar = new Set<() => void>();
  const ponerMarcador = (ya: boolean) => {
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, progreso * a.giro));
    marcador.poner({ x: medioCuerda.x, y: medioCuerda.y - (trenzada ? a.bajar : 0), z: medioCuerda.z }, q, ya);
  };
  const terminar = () => {
    trenzada = true;
    progreso = 1;
    for (const aviso of avisos) aviso();
  };

  h.antes(() => ponerMarcador(false));
  h.despues((munecos) => {
    // Lo que giró cada torcedor en este paso
    torcedores.forEach((t, i) => {
      const angulo = giroAlrededor(giro, t.cuerpo.rotation(), ARRIBA);
      const d = envolver(angulo - t.antes);
      t.antes = angulo;
      t.angulo += d;
      giros[i as 0 | 1] = d;
      const agarrado = cuantosAgarran(munecos, t.cuerpo) > 0;
      // Soltar el torcedor con la cuerda a medio trenzar
      if (t.agarrado && !agarrado && !trenzada && progreso > 0) {
        soltadas++;
        for (const aviso of avisosSoltar) aviso();
      }
      t.agarrado = agarrado;
    });
    giros = [giros[0], giros[1]];
    if (trenzada) return;
    const [d0, d1] = giros;
    if (t0.agarrado && t1.agarrado) {
      // Los dos a la vez y para lados contrarios: la cuerda se trenza con lo que gira el más lento
      const lento = Math.min(Math.abs(d0), Math.abs(d1));
      if (d0 * d1 < 0 && lento > a.girando * PASO) progreso += lento / (2 * Math.PI * p.vueltas);
    } else progreso -= PASO / p.destorcer;
    progreso = limitar(progreso, 0, 1);
    if (progreso >= 1) terminar();
  });

  // La imagen, con los cuerpos como quedaron (también en el invitado): lo trenzado sale del giro del marcador
  let visto = 0;
  let lista = false;
  const giroInverso = giro.clone().invert();
  h.guardar(() => {
    const q = giroInverso.clone().multiply(new THREE.Quaternion().copy(marcador.cuerpo.rotation()));
    visto = limitar((2 * Math.atan2(q.w < 0 ? -q.x : q.x, Math.abs(q.w))) / a.giro, 0, 1);
    lista = marcador.cuerpo.translation().y < medioCuerda.y - a.bajar / 2;
  });
  h.dibujar(() => imagen.posar(lista ? 1 : visto));

  return {
    cual: "qeswa",
    nombre: p.nombre,
    torcedores: [t0.cuerpo, t1.cuerpo],
    marcador: marcador.cuerpo,
    get progreso() {
      return progreso;
    },
    get trenzada() {
      return trenzada;
    },
    get vista() {
      return lista ? 1 : visto;
    },
    get agarrados() {
      return [t0.agarrado, t1.agarrado] as const;
    },
    get giros() {
      return giros;
    },
    get soltadas() {
      return soltadas;
    },
    trenzar() {
      if (!trenzada) terminar();
      ponerMarcador(true);
    },
    alTrenzar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    alSoltar(aviso) {
      avisosSoltar.add(aviso);
      return () => {
        avisosSoltar.delete(aviso);
      };
    },
  };
}

/** La qeswa: dos estacas con su gancho, tres hebras de paja de gancho a gancho (sueltas, casi derechas; trenzadas,
 * apretadas y con muchas vueltas) y un nudito en el medio (lo mueve el marcador). Los palos de través los mueve cada
 * torcedor. */
function crearImagenQeswa(
  h: Herramientas,
  puntas: readonly [THREE.Vector3, THREE.Vector3],
  pie: number,
  medio: number,
) {
  const grupo = new THREE.Group();
  const paja = materialTela(COLORES.siluetaLejana, { repetir: 1, relieve: 3, pelusa: true });
  const estacas: THREE.BufferGeometry[] = [];
  for (const q of puntas) {
    estacas.push(
      palo(new THREE.Vector3(q.x, pie - 0.1, q.z), new THREE.Vector3(q.x, q.y - 0.06, q.z), 0.045, 6),
      new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8).translate(q.x, q.y - 0.05, q.z),
    );
  }
  grupo.add(new THREE.Mesh(juntar(estacas), h.oscuro));
  const hebras: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), paja);
    grupo.add(m);
    hebras.push(m);
  }
  // Los manojos de paja sin trenzar, tirados junto a cada estaca
  const manojos: THREE.BufferGeometry[] = [];
  for (const [k, q] of puntas.entries()) {
    for (let i = 0; i < 7; i++) {
      const a = new THREE.Vector3(q.x + 0.3 * Math.cos(i * 2.4 + k), pie + 0.02, q.z + 0.45 + 0.08 * Math.sin(i * 1.7));
      const b = a.clone().add(new THREE.Vector3(0.5 * Math.sin(i * 0.9 + k), 0.04, -0.2 * Math.cos(i * 1.3)));
      manojos.push(palo(a, b, 0.015, 3));
    }
  }
  grupo.add(new THREE.Mesh(juntar(manojos), paja));
  const nudo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), paja);
  const cuerda = new THREE.Group();
  grupo.add(cuerda);
  const desde = puntas[0].clone().setY(puntas[0].y + 0.06);
  const hasta = puntas[1].clone().setY(puntas[1].y + 0.06);
  let ultimo = -1;
  return {
    grupo,
    cuerda,
    nudo,
    /** El palo de través de un torcedor (centrado en su eje), con sus dos puños gastados. */
    palo: () =>
      new THREE.Mesh(
        juntar([
          new THREE.BoxGeometry(0.07, 0.07, medio * 2),
          new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6).translate(0, 0.1, 0),
        ]),
        h.madera,
      ),
    /** `trenzado` de 0 (suelta) a 1 (trenzada). */
    posar(trenzado: number) {
      const t = Math.round(trenzado * 100) / 100;
      nudo.scale.setScalar(0.4 + 0.8 * t);
      if (t === ultimo) return;
      ultimo = t;
      for (const [i, m] of hebras.entries()) {
        m.geometry.dispose();
        m.geometry = tubo(
          puntosDeTrenza(desde, hasta, i, {
            vueltas: 0.15 + 2.2 * t,
            ancho: 0.07 * (1 - 0.6 * t),
            comba: 0.25 * (1 - t) + 0.06,
            pasos: 48,
          }),
          0.022 + 0.008 * t,
        );
      }
    },
  };
}

// ── La chaka ───────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoChaka = "flojo" | "firme" | "volteado" | "enderezandose";

export interface Chaka {
  readonly cual: "chaka";
  readonly nombre: string;
  /** Los tramos del piso (cinemáticos), de la punta − a la +. */
  readonly tramos: readonly RAPIER.RigidBody[];
  /** La manija de la soga (suelta, con resorte). */
  readonly soga: RAPIER.RigidBody;
  /** El amarre del estribo (fijo, se agarra). */
  readonly amarre: RAPIER.RigidBody;
  /** El marcador: amarrado o no (su altura) y lo amarrado (su giro). */
  readonly marcador: RAPIER.RigidBody;
  readonly estado: EstadoChaka;
  /** De 0 (flojo) a 1 (tenso). */
  readonly tension: number;
  /** Cuánto se sacó la soga, de 0 a 1. */
  readonly jalada: number;
  /** Cuánto se amarró, de 0 a 1, y si ya está amarrado. */
  readonly amarrando: number;
  readonly amarrado: boolean;
  /** Lo que se ve según el marcador (también en el invitado): si tiene el piso tejido y cuánto se amarró. */
  readonly vista: { readonly amarrado: boolean; readonly amarrando: number };
  /** Cuánto está ladeado ahora (radianes; positivo, baja el costado +z de su marco) y cuánto se mece (radianes). */
  readonly ladeo: number;
  readonly mecida: number;
  /** Cuántos están encima, cuántas veces se volteó y cuántas veces se les soltó la soga con el puente tenso. */
  readonly carga: number;
  readonly volteadas: number;
  readonly soltadas: number;
  /** Si ese punto está sobre el piso del puente (encima, de pie o caminando). */
  encima(p: THREE.Vector3Like): boolean;
  /** Lo deja amarrado de una vez (al retomar). */
  amarrar(): void;
  /** Llama a `aviso` al quedar amarrado. */
  alAmarrar(aviso: () => void): () => void;
  /** Llama a `aviso` cada vez que se voltea. */
  alVoltear(aviso: () => void): () => void;
  /** Llama a `aviso` cada vez que se les suelta la soga con el puente tenso (sin amarrar). */
  alSoltar(aviso: () => void): () => void;
}

export function armarChaka(h: Herramientas, p: Extract<PiezaDelPuenteEnPlano, { cual: "chaka" }>): Chaka {
  const { mundo, rapier } = h;
  const a = AJUSTES_PUENTE.chaka;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const largo = mitad * 2;
  const arriba = medio.y;
  const giroInverso = giro.clone().invert();
  /** Un punto del marco del puente (x a lo largo, y hacia arriba desde el centro de la caja) en el mundo. */
  const enElMundo = (u: number, y: number, z: number) => new THREE.Vector3(u, y, z).applyQuaternion(giro).add(centro);
  /** Un punto del mundo en el marco del puente. */
  const enElPuente = (q: THREE.Vector3Like) =>
    new THREE.Vector3(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
  /** El peso que tiene cada punto a lo largo (1 en el medio, 0 en las puntas amarradas). */
  const peso = (u: number) => Math.max(0, 1 - (u / mitad) ** 2);

  // Los tramos del piso: cada uno un cuerpo cinemático con su piso y sus dos barandas
  const n = Math.max(2, Math.round(largo / a.tramo));
  const largoTramo = largo / n;
  const tramos = Array.from({ length: n }, (_, i) => {
    const u = -mitad + (i + 0.5) * largoTramo;
    const donde = enElMundo(u, arriba, 0);
    const cuerpo = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(donde.x, donde.y, donde.z).setRotation(giro),
    );
    const piso = mundo.createCollider(
      rapier.ColliderDesc.cuboid(largoTramo / 2 + 0.03, a.grueso / 2, medioAncho)
        .setTranslation(0, -a.grueso / 2, 0)
        .setFriction(1),
      cuerpo,
    );
    const barandas = [-1, 1].map((lado) =>
      mundo.createCollider(
        rapier.ColliderDesc.cuboid(largoTramo / 2 + 0.03, a.baranda / 2, 0.03)
          .setTranslation(0, a.baranda / 2, lado * (medioAncho + 0.03))
          .setCollisionGroups(SOLO_MUNECOS),
        cuerpo,
      ),
    );
    return { cuerpo, u, colisionadores: [piso, ...barandas] };
  });

  // La soga para tensarlo: una manija detrás de la punta −, de costado (+z), que sale hacia atrás con un resorte
  const sogaReposo = enElMundo(-mitad - a.soga.atras, arriba + a.soga.alto, p.lado);
  const anclaSoga = h.fijo(sogaReposo, giro);
  const soga = travesano(h, sogaReposo, giro, a.soga.medio, a.soga.masa);
  soga.setLinearDamping(1);
  soga.setAngularDamping(2);
  {
    const datos = rapier.JointData.prismatic(CERO, CERO, { x: -1, y: 0, z: 0 });
    datos.limitsEnabled = true;
    datos.limits = [0, p.tensar];
    const junta = mundo.createImpulseJoint(datos, anclaSoga, soga, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.PrismaticImpulseJoint) {
      const rigidez = p.fuerza / p.tensar;
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * a.soga.masa));
    }
  }
  // El amarre: un palo de través fijo sobre el estribo, del otro costado (−z)
  const dondeAmarre = enElMundo(-mitad - a.amarre.atras, arriba + a.amarre.alto, -p.lado);
  const amarre = h.fijo(dondeAmarre, giro);
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.amarre.medio, 0.04, 0.04)
      .setCollisionGroups(GRUPOS_PUENTE)
      .setSolverGroups(SIN_EMPUJAR),
    amarre,
  );

  // El marcador, bajo el amarre: más bajo mientras no está amarrado; su giro, lo amarrado
  const marcadorArriba = dondeAmarre.clone();
  const marcador = crearMarcador(h, marcadorArriba.clone().setY(marcadorArriba.y - a.marcador), giro);

  const imagen = crearImagenChaka(h, {
    largoTramo,
    medioAncho,
    baranda: a.baranda,
    n,
    puntas: [enElMundo(-mitad, arriba, 0), enElMundo(mitad, arriba, 0)],
    costado: new THREE.Vector3(0, 0, 1).applyQuaternion(giro),
  });
  imagen.grupo.name = p.nombre;
  h.escena.add(imagen.grupo);
  tramos.forEach((t, i) => {
    const o = imagen.tramos[i];
    if (o) h.mover(t.cuerpo, o);
  });
  h.mover(soga, imagen.manija);
  const primero = tramos[0];
  if (primero?.colisionadores[0])
    h.solida({
      nombre: p.nombre,
      objeto: imagen.grupo,
      cuerpo: primero.cuerpo,
      colisionador: primero.colisionadores[0],
    });

  let estado: EstadoChaka = "flojo";
  let tension = 0;
  let jalada = 0;
  let amarrando = 0;
  let amarrado = false;
  let mecida = 0;
  let fase = 0;
  let ladeo = 0;
  /** Al voltearse: hacia qué lado y desde qué ladeo, y cuánto lleva (s). */
  let volteo = { lado: 1, desde: 0, tiempo: 0 };
  let carga = 0;
  let volteadas = 0;
  let soltadas = 0;
  let sogaAgarrada = false;
  let pasos = 0;
  const avisosAmarrar = new Set<() => void>();
  const avisosVoltear = new Set<() => void>();
  const avisosSoltar = new Set<() => void>();
  let colisionesPrendidas = true;
  const prenderPiso = (si: boolean) => {
    if (si === colisionesPrendidas) return;
    colisionesPrendidas = si;
    for (const t of tramos) for (const c of t.colisionadores) c.setEnabled(si);
  };
  prenderPiso(false);

  /** La comba ahora, con la tensión. */
  const combaAhora = () => p.flojo + (p.comba - p.flojo) * suave(tension);
  /** Dónde va cada tramo con esta comba y este ladeo (de una vez con `ya`). */
  const ponerTramos = (ya: boolean) => {
    const comba = combaAhora();
    for (const t of tramos) {
      const y = arriba - comba * peso(t.u);
      const pendiente = Math.atan((2 * comba * t.u) / (mitad * mitad));
      const q = giro
        .clone()
        .multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, pendiente))
        .multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, ladeo * peso(t.u)));
      const donde = enElMundo(t.u, y, 0);
      if (ya) {
        t.cuerpo.setTranslation(donde, true);
        t.cuerpo.setRotation(q, true);
      }
      t.cuerpo.setNextKinematicTranslation(donde);
      t.cuerpo.setNextKinematicRotation(q);
    }
  };
  const ponerMarcador = (ya: boolean) => {
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, amarrando * 2));
    marcador.poner(marcadorArriba.clone().setY(marcadorArriba.y - (amarrado ? 0 : a.marcador)), q, ya);
  };
  const quedarAmarrado = () => {
    amarrado = true;
    amarrando = 1;
    tension = 1;
    estado = "firme";
    prenderPiso(true);
    for (const aviso of avisosAmarrar) aviso();
  };

  /** Dónde está ese punto respecto del piso: a lo largo, de costado y de alto sobre el piso de ahí. */
  const sobreElPiso = (q: THREE.Vector3Like) => {
    const l = enElPuente(q);
    const comba = combaAhora();
    return { u: l.x, z: l.z, alto: l.y - (arriba - comba * peso(l.x)) };
  };
  const estaEncima = (q: THREE.Vector3Like) => {
    const s = sobreElPiso(q);
    return (
      Math.abs(s.u) < mitad && Math.abs(s.z) < medioAncho + a.encima.costado && s.alto > -0.2 && s.alto < a.encima.alto
    );
  };

  h.antes((munecos) => {
    pasos++;
    // La soga: lo que se sacó la manija es lo tenso que se quiere el puente (amarrado, ya no se afloja)
    const t = soga.translation();
    const atras = enElPuente(t).x - enElPuente(sogaReposo).x;
    jalada = limitar(-atras / p.tensar, 0, 1);
    const objetivo = amarrado ? 1 : jalada;
    tension += (objetivo - tension) * Math.min(1, a.seguir * PASO);
    // Lo que se mece: cada uno que camina encima lo mece más (más en el medio y más rápido); solo se calma
    let empuje = 0;
    let corrido = 0;
    carga = 0;
    if (estado === "firme") {
      for (const m of munecos) {
        const pelvis = m.partes.pelvis.translation();
        if (!estaEncima(pelvis)) continue;
        carga++;
        const s = sobreElPiso(pelvis);
        const v = m.partes.pelvis.linvel();
        const rapidez = Math.hypot(v.x, v.z);
        empuje += limitar(rapidez / a.andar, 0, 1) * peso(s.u);
        corrido += s.z * peso(s.u);
      }
    }
    mecida += (p.mecer * empuje - p.calma * mecida) * PASO;
    fase += (2 * Math.PI * PASO) / p.periodo;
    const viento = a.viento * Math.sin(pasos * PASO * 0.9) * Math.sin(pasos * PASO * 0.37);
    if (estado === "firme") {
      ladeo = p.ladear * corrido + mecida * Math.sin(fase) + viento;
      if (Math.abs(ladeo) >= p.voltear) {
        // Se voltea: bota a los de encima hacia el lado que bajó
        estado = "volteado";
        volteadas++;
        volteo = { lado: Math.sign(ladeo) || 1, desde: ladeo, tiempo: 0 };
        prenderPiso(false);
        const costado = new THREE.Vector3(0, 0, volteo.lado).applyQuaternion(giro);
        for (const m of munecos) {
          if (!estaEncima(m.partes.pelvis.translation())) continue;
          for (const parte of Object.values(m.partes)) {
            const masa = parte.mass();
            parte.applyImpulse(
              { x: costado.x * a.botar.lado * masa, y: a.botar.arriba * masa, z: costado.z * a.botar.lado * masa },
              true,
            );
          }
        }
        for (const aviso of avisosVoltear) aviso();
      }
    } else if (estado === "volteado") {
      volteo.tiempo += PASO;
      const f = suave(volteo.tiempo / a.volteo.girar);
      ladeo = volteo.desde + (volteo.lado * a.volteo.angulo - volteo.desde) * f;
      if (volteo.tiempo >= a.volteo.girar + a.volteo.quedarse) {
        estado = "enderezandose";
        volteo.tiempo = 0;
      }
    } else if (estado === "enderezandose") {
      volteo.tiempo += PASO;
      ladeo = volteo.lado * a.volteo.angulo * (1 - suave(volteo.tiempo / a.volteo.enderezar));
      mecida = 0;
      if (volteo.tiempo >= a.volteo.enderezar) {
        estado = "firme";
        ladeo = 0;
        prenderPiso(true);
      }
    } else ladeo = 0;
    ponerTramos(false);
    ponerMarcador(false);
  });

  h.despues((munecos) => {
    // Soltar la soga con el puente tenso, sin amarrar
    const agarrada = cuantosAgarran(munecos, soga) > 0;
    if (sogaAgarrada && !agarrada && !amarrado && tension >= a.soltar) {
      soltadas++;
      for (const aviso of avisosSoltar) aviso();
    }
    sogaAgarrada = agarrada;
    if (amarrado) return;
    // Se amarra sosteniendo el amarre con las dos manos mientras está tenso; si no, el nudo se corre
    const sosteniendo = munecos.some((m) => manosEn(m, amarre) >= 2);
    if (sosteniendo && tension >= p.umbral) amarrando += PASO / p.amarrar;
    else amarrando -= (2 * PASO) / p.amarrar;
    amarrando = limitar(amarrando, 0, 1);
    if (amarrando >= 1) quedarAmarrado();
  });

  // La imagen, con los cuerpos como llegaron (también en el invitado): amarrado (el piso tejido) y lo amarrado,
  // del marcador; la soga, de su manija al piso de la punta −
  let visto = { amarrado: false, amarrando: 0 };
  h.guardar(() => {
    const y = marcador.cuerpo.translation().y;
    const q = giroInverso.clone().multiply(new THREE.Quaternion().copy(marcador.cuerpo.rotation()));
    visto = {
      amarrado: y > marcadorArriba.y - a.marcador / 2,
      amarrando: limitar((2 * Math.atan2(q.w < 0 ? -q.x : q.x, Math.abs(q.w))) / 2, 0, 1),
    };
  });
  const puntaPiso = enElMundo(-mitad, arriba, p.lado * 0.5);
  h.dibujar(() => {
    imagen.posar(visto.amarrado, visto.amarrando, puntaPiso, imagen.manija.position, dondeAmarre);
  });

  return {
    cual: "chaka",
    nombre: p.nombre,
    tramos: tramos.map((t) => t.cuerpo),
    soga,
    amarre,
    marcador: marcador.cuerpo,
    get estado() {
      return estado;
    },
    get tension() {
      return tension;
    },
    get jalada() {
      return jalada;
    },
    get amarrando() {
      return amarrando;
    },
    get amarrado() {
      return amarrado;
    },
    get vista() {
      return visto;
    },
    get ladeo() {
      return ladeo;
    },
    get mecida() {
      return mecida;
    },
    get carga() {
      return carga;
    },
    get volteadas() {
      return volteadas;
    },
    get soltadas() {
      return soltadas;
    },
    encima: estaEncima,
    amarrar() {
      if (!amarrado) quedarAmarrado();
      mecida = 0;
      ladeo = 0;
      ponerTramos(true);
      ponerMarcador(true);
    },
    alAmarrar(aviso) {
      avisosAmarrar.add(aviso);
      return () => {
        avisosAmarrar.delete(aviso);
      };
    },
    alVoltear(aviso) {
      avisosVoltear.add(aviso);
      return () => {
        avisosVoltear.delete(aviso);
      };
    },
    alSoltar(aviso) {
      avisosSoltar.add(aviso);
      return () => {
        avisosSoltar.delete(aviso);
      };
    },
  };
}

/** El puente de paja: cada tramo, en su marco (+x a lo largo, el piso en y = 0), lleva su parte tejida (ya amarrado):
 * el piso de palitos atravesados con su estera y las sogas que bajan del pasamano al piso. Las cuatro sogas del piso y
 * los dos pasamanos van enteros de horcón a horcón, por los tramos como estén (flojo, cuelgan hasta el cañón). La
 * manija de la soga, la soga hasta el piso de la punta y el amarre con su nudo. */
function crearImagenChaka(
  h: Herramientas,
  o: {
    largoTramo: number;
    medioAncho: number;
    baranda: number;
    n: number;
    /** Las dos puntas del piso, en el mundo, y hacia dónde queda el costado +z del puente. */
    puntas: readonly [THREE.Vector3, THREE.Vector3];
    costado: THREE.Vector3;
  },
) {
  const grupo = new THREE.Group();
  const paja = materialTela(COLORES.siluetaLejana, { repetir: 1, relieve: 3, pelusa: true });
  const soga = materialTela(COLORES.silueta, { repetir: 1, relieve: 3, pelusa: false });
  const mitad = o.largoTramo / 2 + 0.03;
  const piso: THREE.BufferGeometry[] = [];
  // Los palitos del piso, atravesados y un poco chuecos, y encima una estera de paja
  const palitos = Math.max(3, Math.round(o.largoTramo / 0.14));
  for (let i = 0; i < palitos; i++) {
    const u = -mitad + ((i + 0.5) * 2 * mitad) / palitos;
    piso.push(
      new THREE.BoxGeometry(0.06, 0.04, o.medioAncho * 2 + 0.12)
        .rotateY(0.05 * Math.sin(i * 2.3))
        .translate(u, -0.04, 0.02 * Math.sin(i * 1.7)),
    );
  }
  const geoPiso = juntar(piso);
  const colgantes: THREE.BufferGeometry[] = [];
  for (const lado of [-1, 1]) {
    const z = lado * (o.medioAncho + 0.03);
    for (const u of [-mitad * 0.5, mitad * 0.5]) {
      colgantes.push(palo(new THREE.Vector3(u, -0.05, z), new THREE.Vector3(u, o.baranda, z), 0.012, 4));
      colgantes.push(palo(new THREE.Vector3(u, 0.1, z), new THREE.Vector3(u + mitad * 0.5, o.baranda, z), 0.01, 4));
    }
  }
  const geoColgantes = juntar(colgantes);
  const estera = new THREE.BoxGeometry(o.largoTramo + 0.06, 0.02, o.medioAncho * 1.6).translate(0, -0.005, 0);
  const tramos: THREE.Group[] = [];
  const pisos: THREE.Object3D[] = [];
  for (let i = 0; i < o.n; i++) {
    const t = new THREE.Group();
    const tejido = new THREE.Group();
    tejido.add(new THREE.Mesh(geoPiso, h.madera), new THREE.Mesh(geoColgantes, soga), new THREE.Mesh(estera, paja));
    tejido.visible = false;
    t.add(tejido);
    pisos.push(tejido);
    tramos.push(t);
  }
  // Las seis sogas largas: (alto sobre el piso, de costado, grueso)
  const largas = [-1, 1].flatMap((lado) => [
    { y: -0.05, z: lado * (o.medioAncho + 0.03), radio: 0.03 },
    { y: -0.05, z: lado * (o.medioAncho + 0.03) * 0.4, radio: 0.03 },
    { y: o.baranda, z: lado * (o.medioAncho + 0.03), radio: 0.035 },
  ]);
  const mallasLargas = largas.map(() => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), soga);
    grupo.add(m);
    return m;
  });
  // Los horcones de las cabeceras, de donde se amarran las sogas largas
  const horcones: THREE.BufferGeometry[] = [];
  const [puntaA, puntaB] = o.puntas;
  const adelante = puntaB.clone().sub(puntaA).setY(0).normalize();
  for (const [k, punta] of o.puntas.entries()) {
    const afuera = adelante.clone().multiplyScalar(k === 0 ? -0.25 : 0.25);
    for (const lado of [-1, 1]) {
      const pie = punta
        .clone()
        .add(afuera)
        .addScaledVector(o.costado, lado * (o.medioAncho + 0.12));
      horcones.push(palo(pie.clone().setY(pie.y - 0.4), pie.clone().setY(pie.y + o.baranda + 0.25), 0.07, 7));
    }
  }
  grupo.add(new THREE.Mesh(juntar(horcones), h.oscuro));
  /** Dónde se amarra cada soga larga en un horcón (k: la cabecera). */
  const amarreLarga = (k: number, l: (typeof largas)[number]) =>
    o.puntas[k]
      ?.clone()
      .addScaledVector(adelante, k === 0 ? -0.25 : 0.25)
      .addScaledVector(o.costado, l.z)
      .setY((o.puntas[k]?.y ?? 0) + Math.max(0.05, l.y + 0.05)) ?? new THREE.Vector3();
  // La manija de la soga y la soga hasta la punta del puente
  const manija = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.44), h.madera);
  const cuerdaSoga = new THREE.Mesh(new THREE.BufferGeometry(), soga);
  grupo.add(cuerdaSoga);
  // El nudo del amarre: unas vueltas de soga que crecen al amarrar
  const nudo = new THREE.Mesh(
    juntar([
      new THREE.TorusGeometry(0.12, 0.04, 6, 14).rotateY(Math.PI / 2),
      new THREE.TorusGeometry(0.1, 0.04, 6, 14).rotateY(Math.PI / 2).translate(0.07, 0, 0),
      new THREE.TorusGeometry(0.1, 0.04, 6, 14).rotateY(Math.PI / 2).translate(-0.07, 0, 0),
    ]),
    soga,
  );
  const amarreImagen = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.08, 0.08), h.madera);
  grupo.add(amarreImagen, nudo);
  let ultimaSoga = "";
  let ultimosTramos = "";
  const punto = new THREE.Vector3();
  return {
    grupo,
    tramos,
    manija,
    /** El piso tejido (amarrado), lo amarrado, y la soga de la punta del puente a la manija. Las sogas largas siguen
     * a los tramos como estén dibujados. */
    posar(amarrado: boolean, amarrando: number, punta: THREE.Vector3, mano: THREE.Vector3, dondeAmarre: THREE.Vector3) {
      for (const p of pisos) p.visible = amarrado;
      nudo.scale.setScalar(0.3 + 0.7 * Math.max(amarrando, amarrado ? 1 : 0));
      nudo.position.copy(dondeAmarre);
      amarreImagen.position.copy(dondeAmarre);
      const claveTramos = tramos
        .map((t) => [t.position.x, t.position.y, t.position.z, t.quaternion.x, t.quaternion.y].map((v) => v.toFixed(3)))
        .join(",");
      if (claveTramos !== ultimosTramos) {
        ultimosTramos = claveTramos;
        for (const [j, l] of largas.entries()) {
          const puntos = [amarreLarga(0, l)];
          for (const t of tramos) {
            for (const u of [-o.largoTramo / 2, 0]) {
              punto.set(u, l.y, l.z).applyQuaternion(t.quaternion).add(t.position);
              puntos.push(punto.clone());
            }
          }
          const ultimo = tramos[tramos.length - 1];
          if (ultimo)
            puntos.push(
              punto
                .set(o.largoTramo / 2, l.y, l.z)
                .applyQuaternion(ultimo.quaternion)
                .add(ultimo.position)
                .clone(),
            );
          puntos.push(amarreLarga(1, l));
          const m = mallasLargas[j];
          if (!m) continue;
          m.geometry.dispose();
          m.geometry = tubo(puntos, l.radio, 5);
        }
      }
      const clave = [mano.x, mano.y, mano.z].map((v) => v.toFixed(3)).join(",");
      if (clave === ultimaSoga) return;
      ultimaSoga = clave;
      const medio = punta.clone().lerp(mano, 0.5);
      medio.y -= 0.25 * (1 - Math.min(1, punta.distanceTo(mano) / 3.5));
      cuerdaSoga.geometry.dispose();
      cuerdaSoga.geometry = tubo([punta, medio, mano], 0.03);
    },
  };
}

// ── La bocatoma ────────────────────────────────────────────────────────────────────────────────────────────

export interface Bocatoma {
  readonly cual: "bocatoma";
  readonly nombre: string;
  /** La losa (suelta, sobre su riel). */
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto salió, de 0 (cerrada) a 1 (abierta del todo). */
  readonly abertura: number;
  readonly abierta: boolean;
  /** La abre o la cierra de una vez (al retomar). */
  poner(abierta: boolean): void;
  /** Llama a `aviso` cuando se abre o se cierra. */
  alCambiar(aviso: (abierta: boolean) => void): () => void;
}

export function armarBocatoma(h: Herramientas, p: Extract<PiezaDelPuenteEnPlano, { cual: "bocatoma" }>): Bocatoma {
  const { mundo, rapier } = h;
  const a = AJUSTES_PUENTE.bocatoma;
  const { centro, medio, giro } = p.caja;
  const frente = EJE_Z.clone().applyQuaternion(giro);
  const ancla = h.fijo(centro, giro);
  const inicio = p.abierta ? centro.clone().addScaledVector(frente, p.recorrido) : centro.clone();
  const cuerpo = mundo.createRigidBody(h.dinamico(inicio, giro).setCanSleep(false).setLinearDamping(2));
  cuerpo.userData = { densidad: a.densidad };
  const grupos = (c: RAPIER.ColliderDesc) => c.setCollisionGroups(GRUPOS_PUENTE).setSolverGroups(SIN_EMPUJAR);
  // La losa, el palo que sube de su frente y el travesaño para las manos
  const alto = p.manija - medio.y;
  const colisionador = mundo.createCollider(
    grupos(rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setMass(p.masa)),
    cuerpo,
  );
  mundo.createCollider(
    grupos(
      rapier.ColliderDesc.cuboid(0.035, alto / 2, 0.035)
        .setTranslation(0, alto / 2, medio.z + 0.05)
        .setMass(0.5),
    ),
    cuerpo,
  );
  mundo.createCollider(
    grupos(
      rapier.ColliderDesc.cuboid(0.22, 0.035, 0.035)
        .setTranslation(0, alto, medio.z + 0.1)
        .setMass(0.5),
    ),
    cuerpo,
  );
  const datos = rapier.JointData.prismatic(CERO, CERO, { x: 0, y: 0, z: 1 });
  datos.limitsEnabled = true;
  datos.limits = [0, p.recorrido];
  const junta = mundo.createImpulseJoint(datos, ancla, cuerpo, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.PrismaticImpulseJoint) {
    // Un freno: queda donde la dejan
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorVelocity(0, a.frenar);
  }
  const imagen = new THREE.Group();
  imagen.name = p.nombre;
  const piedra = materialTela(COLORES.roca, { repetir: 1, relieve: 5, pelusa: false });
  imagen.add(
    new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, medio.y * 2, medio.z * 2), piedra),
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(0.07, alto, 0.07).translate(0, alto / 2, medio.z + 0.05),
        new THREE.BoxGeometry(0.44, 0.07, 0.07).translate(0, alto, medio.z + 0.1),
      ]),
      h.madera,
    ),
  );
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  const interruptor = crearInterruptor();
  const abertura = () => {
    const t = cuerpo.translation();
    const d = (t.x - centro.x) * frente.x + (t.y - centro.y) * frente.y + (t.z - centro.z) * frente.z;
    return limitar(d / p.recorrido, 0, 1);
  };
  interruptor.poner(abertura(), p.umbral, p.umbral - a.histeresis);
  h.despues(() => interruptor.poner(abertura(), p.umbral, p.umbral - a.histeresis));

  return {
    cual: "bocatoma",
    nombre: p.nombre,
    cuerpo,
    get abertura() {
      return abertura();
    },
    get abierta() {
      return interruptor.prendido;
    },
    poner(abierta) {
      const donde = abierta ? centro.clone().addScaledVector(frente, p.recorrido) : centro.clone();
      cuerpo.setTranslation(donde, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
      interruptor.poner(abierta ? 1 : 0, p.umbral, p.umbral - a.histeresis);
    },
    alCambiar: (aviso) => interruptor.alCambiar(aviso),
  };
}

// ── El andén ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Anden {
  readonly cual: "anden";
  readonly nombre: string;
  /** El marcador (cinemático, sin choques): su altura dice cuánto se regó; su giro, si le está llegando agua. */
  readonly marcador: RAPIER.RigidBody;
  /** Cuánto se regó, de 0 (seco) a 1 (regado). */
  readonly humedad: number;
  readonly regada: boolean;
  /** Si le llegó agua en el último paso. */
  readonly mojandose: boolean;
  /** Lo que se ve según el marcador (también en el invitado): lo regado y si le está llegando agua. */
  readonly vista: { readonly humedad: number; readonly mojandose: boolean };
  /** Le llega agua (o no) en este paso: lo manda el guion. */
  regar(si: boolean): void;
  /** Lo deja regado de una vez (al retomar). */
  mojar(): void;
  /** Llama a `aviso` cuando queda regado. */
  alRegar(aviso: () => void): () => void;
}

export function armarAnden(h: Herramientas, p: Extract<PiezaDelPuenteEnPlano, { cual: "anden" }>): Anden {
  const a = AJUSTES_PUENTE.anden;
  const { centro, medio, giro } = p.caja;
  const tierra = centro.y - medio.y;
  const abajo = new THREE.Vector3(centro.x, tierra - a.marcador, centro.z);
  const marcador = crearMarcador(h, abajo, giro);
  const imagen = crearImagenAnden(medio, p.surcos);
  imagen.grupo.name = p.nombre;
  imagen.grupo.position.set(centro.x, tierra, centro.z);
  imagen.grupo.quaternion.copy(giro);
  h.escena.add(imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo: marcador.cuerpo, colisionador: marcador.colisionador });

  let humedad = p.regada ? 1 : 0;
  let regada = p.regada;
  let mojandose = false;
  let pidio = false;
  const avisos = new Set<() => void>();
  const ponerMarcador = (ya: boolean) => {
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, mojandose ? Math.PI / 2 : 0));
    marcador.poner({ x: abajo.x, y: abajo.y + humedad, z: abajo.z }, q, ya);
  };
  ponerMarcador(true);
  h.antes(() => {
    mojandose = pidio;
    pidio = false;
    if (mojandose && !regada) {
      humedad = Math.min(1, humedad + PASO / p.regar);
      if (humedad >= 1) {
        regada = true;
        for (const aviso of avisos) aviso();
      }
    }
    ponerMarcador(false);
  });

  // La imagen, del marcador (también en el invitado): las matas se paran con lo regado y el agua corre si le llega
  let visto = { humedad: humedad, mojandose: false };
  h.guardar(() => {
    const t = marcador.cuerpo.translation();
    const q = giro.clone().invert().multiply(new THREE.Quaternion().copy(marcador.cuerpo.rotation()));
    visto = { humedad: limitar(t.y - abajo.y, 0, 1), mojandose: Math.abs(q.y) > 0.35 };
  });
  let segundos = 0;
  h.dibujar(() => {
    segundos += 1 / 60;
    imagen.posar(visto.humedad, visto.mojandose, segundos);
  });

  return {
    cual: "anden",
    nombre: p.nombre,
    marcador: marcador.cuerpo,
    get humedad() {
      return humedad;
    },
    get regada() {
      return regada;
    },
    get mojandose() {
      return mojandose;
    },
    get vista() {
      return visto;
    },
    regar(si) {
      if (si) pidio = true;
    },
    mojar() {
      humedad = 1;
      if (!regada) {
        regada = true;
        for (const aviso of avisos) aviso();
      }
      ponerMarcador(true);
    },
    alRegar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** El andén: surcos de tierra a lo largo de su X con matas de papa (lacias si está seco, paradas si está regado) y un
 * hilo de agua entre los surcos que brilla y corre mientras le llega agua. En su marco, con la tierra en y = 0. */
function crearImagenAnden(medio: THREE.Vector3, surcos: number) {
  const grupo = new THREE.Group();
  const tierra = materialTela(COLORES.siluetaLejana, { repetir: 2, relieve: 4, pelusa: false });
  const lomos: THREE.BufferGeometry[] = [];
  const ancho = (medio.z * 2) / surcos;
  for (let i = 0; i < surcos; i++) {
    // Un lomo de tierra: medio cilindro acostado a lo largo de x
    const z = -medio.z + (i + 0.5) * ancho;
    lomos.push(
      new THREE.CylinderGeometry(ancho * 0.3, ancho * 0.3, medio.x * 2 - 0.2, 10, 1, false, 0, Math.PI)
        .rotateZ(Math.PI / 2)
        .rotateX(-Math.PI / 2)
        .scale(1, 0.35, 1)
        .translate(0, 0, z),
    );
  }
  grupo.add(new THREE.Mesh(juntar(lomos), tierra));
  // El agua de los surcos: unas cintas claras que suben al mojarse
  const agua = new THREE.MeshStandardMaterial({
    color: COLORES.agua,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0,
  });
  const cintas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < surcos - 1; i++) {
    const z = -medio.z + (i + 1) * ancho;
    cintas.push(new THREE.BoxGeometry(medio.x * 2 - 0.3, 0.02, ancho * 0.3).translate(0, 0.01, z));
  }
  cintas.push(new THREE.BoxGeometry(0.25, 0.02, medio.z * 2 - 0.1).translate(0, 0.01, -medio.z + 0.15));
  const hilo = new THREE.Mesh(juntar(cintas), agua);
  grupo.add(hilo);
  // Las matas: una cada 45 cm a lo largo de cada surco
  const matas: THREE.Object3D[] = [];
  const porSurco = Math.max(1, Math.floor((medio.x * 2 - 0.4) / 0.45));
  for (let i = 0; i < surcos; i++) {
    const z = -medio.z + (i + 0.5) * ancho;
    for (let k = 0; k < porSurco; k++) {
      const x = -medio.x + 0.3 + (k + 0.5) * ((medio.x * 2 - 0.6) / porSurco);
      const mata = crearMata(Math.min(0.6, medio.y * 1.6), 400 + i * 31 + k, COLORES.silueta);
      mata.position.set(x, 0.04, z + 0.04 * Math.sin(k * 2.1 + i));
      mata.rotation.y = k * 1.7 + i;
      grupo.add(mata);
      matas.push(mata);
    }
  }
  let ultimo = -1;
  return {
    grupo,
    /** `humedad` de 0 a 1; `mojandose` si le llega agua ahora. */
    posar(humedad: number, mojandose: boolean, segundos: number) {
      agua.opacity = mojandose ? 0.75 + 0.1 * Math.sin(segundos * 6) : 0.35 * humedad;
      hilo.position.y = mojandose ? 0.03 : 0;
      const h2 = Math.round(humedad * 50) / 50;
      if (h2 === ultimo) return;
      ultimo = h2;
      for (const [i, m] of matas.entries()) {
        // Secas, lacias y caídas para un lado; regadas, paradas
        m.scale.set(1, 0.55 + 0.45 * h2, 1);
        m.rotation.z = (1 - h2) * 0.6 * Math.sin(i * 1.3);
      }
    },
  };
}

// ── Lo que arma el guion: las puertas que bajan y el decorado ─────────────────────────────────────────────────

/** Una puerta (un sólido cinemático) que baja `cuanto` metros en `pasos` y queda abajo. La mueve el guion (`pasar`
 * en cada paso); en línea viaja en la foto como cualquier cinemático. */
export function crearPuertaQueBaja(cuerpo: RAPIER.RigidBody, cuanto: number, pasos: number) {
  const arriba = new THREE.Vector3().copy(cuerpo.translation());
  let abierta = false;
  let paso = 0;
  const poner = (ya: boolean) => {
    const f = suave(paso / pasos);
    const donde = { x: arriba.x, y: arriba.y - cuanto * f, z: arriba.z };
    if (ya) cuerpo.setTranslation(donde, true);
    cuerpo.setNextKinematicTranslation(donde);
  };
  return {
    get abierta() {
      return abierta;
    },
    /** La empieza a bajar (de una vez con `ya`, al retomar). */
    abrir(ya = false) {
      abierta = true;
      if (ya) {
        paso = pasos;
        poner(true);
      }
    },
    pasar() {
      if (abierta && paso < pasos) paso++;
      poner(false);
    },
  };
}

interface Lugar3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Lo que solo se ve en El puente de paja: el quipu del secreto, el techo de paja del tambo y las otras llamas del
 * corral (quietas). `dx`: lo que va corrido el nivel en x. */
export function dibujarDecoradoPuente(
  escena: THREE.Scene,
  dx: number,
  d: {
    readonly quipu: Lugar3;
    readonly techo: Lugar3;
    readonly llamas: readonly (Lugar3 & { readonly rumbo: number })[];
  },
) {
  const paja = materialTela(COLORES.siluetaLejana, { repetir: 2, relieve: 3, pelusa: true });
  const techo = crearImagenTecho(paja, 6.6, 4.2, 2.75);
  techo.position.set(dx + d.techo.x, d.techo.y, d.techo.z);
  escena.add(techo);
  const quipu = crearQuipu();
  quipu.position.set(dx + d.quipu.x, d.quipu.y, d.quipu.z);
  quipu.rotation.y = 0.3;
  escena.add(quipu);
  const oscuro = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  for (const [i, l] of d.llamas.entries()) {
    const llama = crearImagenLlama(oscuro, 0.7, 1.7, 0.25);
    llama.grupo.position.set(dx + l.x, l.y, l.z);
    llama.grupo.rotation.y = l.rumbo;
    const cabeza = new THREE.Vector3(0.6, 1.4, 0);
    llama.posar(i * 0.3, 0, "tranquila", cabeza, cabeza);
    escena.add(llama.grupo);
  }
}

/** El quipu: una cuerda madre de la que cuelgan cuerdas con nudos, tirada entre las piedras. Lo único claro del
 * pedregal (sin color nuevo: el blanco de los ojos). */
export function crearQuipu(): THREE.Group {
  const grupo = new THREE.Group();
  const cuerda = materialOjo();
  const nudos: THREE.BufferGeometry[] = [];
  const cuerdas: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(0.018, 0.018, 0.9, 5).rotateZ(Math.PI / 2).translate(0, 0.03, 0),
  ];
  for (let i = 0; i < 9; i++) {
    const x = -0.4 + i * 0.1;
    const largo = 0.32 + 0.12 * Math.sin(i * 2.3);
    cuerdas.push(
      new THREE.CylinderGeometry(0.009, 0.009, largo, 4)
        .rotateX(Math.PI / 2)
        .rotateY(0.15 * Math.sin(i))
        .translate(x, 0.015, largo / 2),
    );
    for (let k = 0; k < 1 + (i % 3); k++) {
      nudos.push(new THREE.SphereGeometry(0.02, 6, 4).translate(x, 0.02, 0.08 + k * 0.09));
    }
  }
  grupo.add(new THREE.Mesh(juntar(cuerdas), cuerda), new THREE.Mesh(juntar(nudos), cuerda));
  return grupo;
}
