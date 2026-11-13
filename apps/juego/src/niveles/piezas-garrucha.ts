// Las piezas que estrena La garrucha (TU-43), menos La Patasola (patasola.ts). Cada una sale de un nodo `tipo: pieza`
// de la escena (formato-garrucha.ts) y se arma con las herramientas de piezas.ts, como las del río:
//
//   garrucha  una canasta colgada de un cable sobre el cañón, de la estación de abajo a la de arriba. Cada estación
//             tiene una manija en la soga (con resorte, como la de la palmera del río): el que la jala caminando
//             hacia atrás sube la canasta, y al soltarla la manija vuelve sola pero la canasta no (un trinquete), si
//             alguien va adentro. Vacía y sin nadie en las manijas, baja sola a la estación de abajo. El que va en la
//             canasta no alcanza ninguna manija: hacen falta los dos.
//   chiva     el bus de escalera, cinemático. Con su carga (el huacal `<nombre>-carga`) y los dos en el techo,
//             arranca y pasa los baches. En cada bache la carga salta del techo si no la sostienen los dos (y se lleva
//             al que la sostenía solo): la chiva frena, se devuelve y hay que volver a cargarla. Al que va en el
//             techo lo lleva.
//   palma     una palma de cera, altísima. Con su manea (un aro de soga alrededor del tronco), el que la agarra con
//             las dos manos sube apretando adelante y baja apretando atrás; arriba se encarama a la plataforma, como
//             a cualquier borde. Sin nadie, la manea baja sola.
//
// Todo lo que se mueve (la canasta, las manijas, la chiva, la manea) viaja en la foto de la red. El invitado no
// simula: dibuja las sogas y hace girar las ruedas de la chiva con los cuerpos tal como llegan.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDeLaGarruchaEnPlano } from "./formato-garrucha";
import type { Herramientas, Huacal } from "./piezas";
import { manosEn } from "./piezas-pinar";

/** El bit de grupo de choque de lo suelto de La garrucha (las manijas, la manea): choca con todo menos con los
 * muñecos (bits 1 y 2); grupos del resolvedor sin filtro: se la encuentra para agarrarla, pero no empuja ni la
 * empujan. */
const BIT_GARRUCHA = 1 << 10;
const GRUPOS_GARRUCHA = ((BIT_GARRUCHA << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_GARRUCHA << 16) >>> 0;
/** Lo que solo ataja a los muñecos (los bordes invisibles del lado de la cámara): ni el rayo de la cámara ni el de la
 * reaparición lo ven, así que no acercan la cámara ni sirven de piso. */
export const SOLO_MUNECOS = ((BIT_GARRUCHA << 16) | 0b110) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Los números de las piezas de La garrucha que no se ponen desde Blender. */
export const AJUSTES_GARRUCHA = {
  garrucha: {
    /** La canasta: su largo (a lo largo del cable), el alto de sus barandas y el grueso del piso (m). */
    canasta: { largo: 1.0, baranda: 0.75, piso: 0.06 },
    /** El cable va tanto más arriba del piso de la canasta (m). */
    colgar: 2.1,
    /** Por debajo y por encima del piso, la pelvis del que va en la canasta (m). */
    bordo: [0.1, 1.2],
    /** Qué tan rápido toma su velocidad la canasta (m/s²) y qué tan fuerte sigue a la soga (1/s). */
    aceleracion: 1.5,
    seguir: 3,
    /** Las manijas: su alto sobre el piso de su estación, su masa y su medio largo. */
    manija: { alto: 1.05, masa: 1.5, medio: 0.22 },
    /** Las torres de guadua: cuánto más allá de cada punta del recorrido van (m). */
    torre: 0.75,
  },
  chiva: {
    /** Qué tan rápido arranca y frena (m/s²) y con qué velocidad se devuelve (m/s). */
    aceleracion: 1,
    devolverse: 2,
    /** Con la carga y los dos en el techo, tanto rato antes de arrancar (s); parada tras la caída, tanto antes de
     * devolverse (s). */
    arrancar: 1,
    esperar: 1,
    /** Cuánto dura cada bache (s) y cuánto se ladea en él (radianes). */
    golpe: 0.4,
    ladeo: 0.035,
    /** Con qué velocidad salta la carga que no sostienen los dos: hacia arriba y de costado, hacia el − de lo ancho
     * (lejos de la cámara) (m/s). */
    tirar: { arriba: 5, lado: 6 },
    /** La parrilla del techo: el alto de sus barandas (m). */
    baranda: 0.2,
    /** Por encima del techo, la pelvis de uno que va arriba (m). */
    bordo: [0.1, 1.3],
  },
  palma: {
    /** La manea: a qué altura descansa (m sobre el pie), cuánto queda por debajo de lo alto de la caja arriba del
     * todo (m: así las manos quedan junto al borde de la plataforma), su medio alto y cuánto sobresale del tronco. */
    manea: { desde: 1.05, bajo: 0.3, medioAlto: 0.22, grueso: 0.1 },
    /** Qué parte del radio del tronco choca (el alma). */
    alma: 0.45,
    /** Sin nadie, baja sola a esta velocidad (m/s). */
    volver: 2,
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

/** Un cilindro de `radio` de `a` a `b` (para sogas, cables y guaduas). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 6): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Una soga que se rehace en cada cuadro: un cilindro de largo 1 que se estira de un punto a otro. */
function crearSoga(material: THREE.Material, radio = 0.016) {
  const malla = new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 1, 5).translate(0, 0.5, 0), material);
  return {
    malla,
    tender(de: THREE.Vector3, a: THREE.Vector3) {
      const tramo = a.clone().sub(de);
      malla.position.copy(de);
      malla.quaternion.setFromUnitVectors(ARRIBA, tramo.clone().normalize());
      malla.scale.set(1, Math.max(0.001, tramo.length()), 1);
    },
  };
}

// ── La garrucha ─────────────────────────────────────────────────────────────────────────────────────────────

export interface Garrucha {
  readonly cual: "garrucha";
  readonly nombre: string;
  /** La canasta (cinemática): su origen es el medio del piso. */
  readonly canasta: RAPIER.RigidBody;
  /** Las manijas de la soga: la de la estación de abajo y la de arriba. */
  readonly manijas: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** Dónde va la canasta: 0 en la estación de abajo, 1 en la de arriba. */
  readonly recorrido: number;
  /** Cuántos muñecos van en la canasta. */
  readonly aBordo: number;
  /** Quién está jalando una manija en este paso (0 el rojo, 1 el turquesa), o `null`. */
  readonly jalando: 0 | 1 | null;
  /** Cuánto está jalada cada manija, de 0 a 1. */
  jalada(manija: 0 | 1): number;
  /** Si ese punto (una pelvis) va en la canasta. */
  encima(p: THREE.Vector3Like): boolean;
  /** La canasta en la estación de abajo, quieta, y las manijas sueltas (al retomar). */
  volver(): void;
}

export function armarGarrucha(h: Herramientas, p: Extract<PiezaDeLaGarruchaEnPlano, { cual: "garrucha" }>): Garrucha {
  const { rapier, mundo } = h;
  const a = AJUSTES_GARRUCHA.garrucha;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const largo = EJE_X.clone().applyQuaternion(giro).setY(0).normalize();
  const ancho = EJE_Z.clone().applyQuaternion(giro).setY(0).normalize();
  /** El medio del piso de la canasta en cada estación. */
  const abajo = centro.clone().addScaledVector(largo, -mitad).addScaledVector(ARRIBA, -medio.y);
  const arriba = centro.clone().addScaledVector(largo, mitad).addScaledVector(ARRIBA, medio.y);
  const cable = abajo.distanceTo(arriba);
  const enS = (s: number) => abajo.clone().lerp(arriba, s / cable);
  const c = a.canasta;

  const canasta = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(abajo.x, abajo.y, abajo.z).setRotation(giro),
  );
  llevaAlQuePisa(canasta);
  const piso = mundo.createCollider(
    rapier.ColliderDesc.cuboid(c.largo / 2, c.piso / 2, medioAncho)
      .setTranslation(0, -c.piso / 2, 0)
      .setFriction(0.9),
    canasta,
  );
  for (const lado of [-1, 1])
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(c.largo / 2, c.baranda / 2, 0.03)
        .setTranslation(0, c.baranda / 2, lado * (medioAncho + 0.03))
        .setFriction(0.9),
      canasta,
    );
  const { grupo: imagenCanasta, rueda } = crearImagenCanasta(h, medioAncho);
  imagenCanasta.name = p.nombre;
  h.mover(canasta, imagenCanasta);
  h.solida({ nombre: p.nombre, objeto: imagenCanasta, cuerpo: canasta, colisionador: piso });

  // El cable y las torres de guadua de las dos estaciones
  const subida = arriba.clone().sub(abajo).normalize();
  const puntaAbajo = abajo.clone().addScaledVector(ARRIBA, a.colgar).addScaledVector(subida, -a.torre);
  const puntaArriba = arriba.clone().addScaledVector(ARRIBA, a.colgar).addScaledVector(subida, a.torre);
  const fija = new THREE.Group();
  fija.name = `${p.nombre} cable`;
  const guaduas: THREE.BufferGeometry[] = [];
  for (const punta of [puntaAbajo, puntaArriba]) {
    const pie = punta.clone().addScaledVector(ARRIBA, -a.colgar - 3);
    for (const lado of [-1, 1]) {
      const poste = ancho.clone().multiplyScalar(lado * (medioAncho + 0.35));
      guaduas.push(palo(pie.clone().add(poste), punta.clone().add(poste).addScaledVector(ARRIBA, 0.35), 0.07, 8));
      // La riostra, en diagonal
      guaduas.push(
        palo(
          pie.clone().add(poste).addScaledVector(ARRIBA, 2.4),
          punta.clone().add(poste.clone().multiplyScalar(0.3)).addScaledVector(ARRIBA, 0.3),
          0.045,
        ),
      );
    }
    // El travesaño, por donde pasa el cable, con su polea
    guaduas.push(
      palo(
        punta
          .clone()
          .addScaledVector(ancho, -(medioAncho + 0.45))
          .addScaledVector(ARRIBA, 0.25),
        punta
          .clone()
          .addScaledVector(ancho, medioAncho + 0.45)
          .addScaledVector(ARRIBA, 0.25),
        0.06,
        8,
      ),
    );
  }
  fija.add(new THREE.Mesh(juntar(guaduas), h.madera));
  const poleas: THREE.BufferGeometry[] = [];
  for (const punta of [puntaAbajo, puntaArriba])
    poleas.push(
      new THREE.TorusGeometry(0.12, 0.035, 6, 14)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(EJE_Z, ancho))
        .translate(punta.x, punta.y + 0.1, punta.z),
    );
  poleas.push(palo(puntaAbajo, puntaArriba, 0.018, 5));
  fija.add(new THREE.Mesh(juntar(poleas), h.oscuro));
  h.escena.add(fija);

  // Las manijas: una por estación, detrás de la punta y de costado; se jalan hacia atrás, lejos del cañón
  const armarManija = (estacion: THREE.Vector3, hacia: THREE.Vector3) => {
    const inicio = estacion
      .clone()
      .addScaledVector(hacia, c.largo / 2 + p.atras)
      .addScaledVector(ancho, p.lado)
      .addScaledVector(ARRIBA, a.manija.alto);
    const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.atan2(hacia.x, hacia.z));
    const ancla = h.fijo(inicio, q);
    const cuerpo = mundo.createRigidBody(h.dinamico(inicio, q).setLinearDamping(1).setAngularDamping(2));
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(a.manija.medio, 0.03, 0.03)
        .setMass(a.manija.masa)
        .setFriction(0.9)
        .setCollisionGroups(GRUPOS_GARRUCHA)
        .setSolverGroups(SIN_EMPUJAR),
      cuerpo,
    );
    const datos = rapier.JointData.prismatic(CERO, CERO, EJE_Z);
    datos.limitsEnabled = true;
    datos.limits = [0, p.soga];
    const junta = mundo.createImpulseJoint(datos, ancla, cuerpo, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.PrismaticImpulseJoint) {
      const rigidez = p.fuerza / p.soga;
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * a.manija.masa));
    }
    const imagen = new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.035, 0.035, a.manija.medio * 2, 8).rotateZ(Math.PI / 2),
        new THREE.SphereGeometry(0.05, 8, 6),
      ]),
      h.madera,
    );
    h.mover(cuerpo, imagen);
    /** Cuánto se jaló (m), hacia atrás. */
    const jalada = () => {
      const t = cuerpo.translation();
      return limitar((t.x - inicio.x) * hacia.x + (t.y - inicio.y) * hacia.y + (t.z - inicio.z) * hacia.z, 0, p.soga);
    };
    return { cuerpo, jalada, imagen };
  };
  const manijas = [armarManija(abajo, largo.clone().negate()), armarManija(arriba, largo.clone())] as const;

  // Las sogas, de cada manija a la polea de su torre (se rehacen en cada cuadro)
  const materialSoga = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const sogas = [crearSoga(materialSoga), crearSoga(materialSoga)] as const;
  for (const s of sogas) h.escena.add(s.malla);

  const local = new THREE.Vector3();
  const giroInverso = giro.clone().invert();
  const encima = (q: THREE.Vector3Like) => {
    const t = canasta.translation();
    local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroInverso);
    return (
      Math.abs(local.x) <= c.largo / 2 + 0.05 &&
      Math.abs(local.z) <= medioAncho + 0.05 &&
      local.y > a.bordo[0] &&
      local.y < a.bordo[1]
    );
  };

  let s = 0;
  let v = 0;
  let objetivo = 0;
  let aBordo = 0;
  let jalando: 0 | 1 | null = null;
  const previo = [0, 0];
  h.antes((munecos) => {
    aBordo = munecos.filter((m) => encima(m.partes.pelvis.translation())).length;
    // El que jala una manija sube la canasta: solo cuenta lo que se jala, no lo que vuelve (el trinquete)
    let agarrada = false;
    jalando = null;
    manijas.forEach((manija, k) => {
      const j = manija.jalada();
      const quien = munecos.findIndex((m) => manosEn(m, manija.cuerpo) > 0);
      if (quien >= 0) {
        agarrada = true;
        const d = j - (previo[k] ?? 0);
        if (d > 0) {
          objetivo += d * p.multiplica;
          if (quien <= 1) jalando ??= quien as 0 | 1;
        }
      }
      previo[k] = j;
    });
    // Vacía y suelta, baja sola
    if (aBordo === 0 && !agarrada) objetivo -= p.bajar * PASO;
    objetivo = limitar(objetivo, 0, cable);
    const deseada = limitar((objetivo - s) * a.seguir, -Math.max(p.velocidad, p.bajar), p.velocidad);
    v += limitar(deseada - v, -a.aceleracion * PASO, a.aceleracion * PASO);
    s += v * PASO;
    if (s <= 0 || s >= cable) {
      s = limitar(s, 0, cable);
      v = 0;
    }
    canasta.setNextKinematicTranslation(enS(s));
  });

  // La polea de la canasta gira con lo que anda (también en el invitado, con la canasta que llega en la foto)
  const antes = new THREE.Vector3().copy(canasta.translation());
  let vuelta = 0;
  h.guardar(() => {
    const t = new THREE.Vector3().copy(canasta.translation());
    vuelta += t.clone().sub(antes).dot(subida) / 0.09;
    antes.copy(t);
  });
  const tope = new THREE.Vector3();
  h.dibujar(() => {
    rueda.rotation.set(0, 0, -vuelta);
    for (const k of [0, 1] as const) {
      tope.copy(k === 0 ? puntaAbajo : puntaArriba).addScaledVector(ARRIBA, 0.1);
      sogas[k].tender(manijas[k].imagen.position, tope);
    }
  });

  return {
    cual: "garrucha",
    nombre: p.nombre,
    canasta,
    manijas: [manijas[0].cuerpo, manijas[1].cuerpo],
    get recorrido() {
      return s / cable;
    },
    get aBordo() {
      return aBordo;
    },
    get jalando() {
      return jalando;
    },
    jalada: (k) => manijas[k].jalada() / p.soga,
    encima,
    volver() {
      s = 0;
      v = 0;
      objetivo = 0;
      canasta.setTranslation(abajo, true);
      canasta.setNextKinematicTranslation(abajo);
    },
  };
}

/** La canasta: un cajón de tablas con barandas a los costados (las puntas, abiertas: por ahí se sube), cuatro
 * varas que suben hasta el carro del cable y su rueda. En el marco del cuerpo: el piso en y = 0, +x a lo largo. */
function crearImagenCanasta(h: Herramientas, medioAncho: number) {
  const a = AJUSTES_GARRUCHA.garrucha;
  const c = a.canasta;
  const grupo = new THREE.Group();
  const tablas: THREE.BufferGeometry[] = [];
  // El piso, de tablas con luz entre ellas
  for (let i = 0; i < 5; i++) {
    const z = -medioAncho + ((i + 0.5) * 2 * medioAncho) / 5;
    tablas.push(new THREE.BoxGeometry(c.largo, c.piso, (2 * medioAncho) / 5 - 0.02).translate(0, -c.piso / 2, z));
  }
  // Las barandas: tres tablas por lado y los parales de las esquinas
  for (const lado of [-1, 1]) {
    for (const y of [0.15, 0.42, 0.7])
      tablas.push(new THREE.BoxGeometry(c.largo, 0.1, 0.04).translate(0, y, lado * (medioAncho + 0.03)));
    for (const x of [-1, 1])
      tablas.push(
        new THREE.BoxGeometry(0.06, c.baranda + 0.05, 0.06).translate(
          (x * c.largo) / 2,
          c.baranda / 2,
          lado * (medioAncho + 0.03),
        ),
      );
  }
  grupo.add(new THREE.Mesh(juntar(tablas), h.madera));
  // Las varas, de las esquinas al carro, y el carro con su rueda sobre el cable
  const carro = new THREE.Vector3(0, a.colgar - 0.12, 0);
  const varas: THREE.BufferGeometry[] = [];
  for (const x of [-1, 1])
    for (const lado of [-1, 1])
      varas.push(palo(new THREE.Vector3((x * c.largo) / 2, c.baranda, lado * (medioAncho + 0.03)), carro, 0.018, 5));
  varas.push(new THREE.BoxGeometry(0.34, 0.1, 0.08).translate(carro.x, carro.y, carro.z));
  grupo.add(new THREE.Mesh(juntar(varas), h.oscuro));
  const rueda = new THREE.Mesh(
    juntar([
      new THREE.TorusGeometry(0.09, 0.025, 6, 12),
      new THREE.BoxGeometry(0.16, 0.02, 0.02),
      new THREE.BoxGeometry(0.02, 0.16, 0.02),
    ]),
    h.oscuro,
  );
  rueda.position.set(0, a.colgar, 0);
  grupo.add(rueda);
  return { grupo, rueda };
}

// ── La chiva ────────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoChiva = "parada" | "andando" | "frenando" | "devolviendose" | "llego";

export interface Chiva {
  readonly cual: "chiva";
  readonly nombre: string;
  /** La chiva (cinemática): su origen es el medio de su caja. */
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoChiva;
  /** Cuánto anduvo, de 0 (donde la parquearon) a 1 (donde para). */
  readonly recorrido: number;
  /** Cuántas veces se le cayó la carga. */
  readonly caidas: number;
  /** El huacal que hay que llevar en el techo. */
  readonly carga: Huacal;
  /** Si ese punto (una pelvis) va en el techo. */
  encima(p: THREE.Vector3Like): boolean;
  /** Si la carga está en el techo. */
  readonly cargada: boolean;
  /** Llama a `aviso` cuando llega. Devuelve cómo dejar de escuchar. */
  alLlegar(aviso: () => void): () => void;
  /** Llama a `aviso` cuando se le cae la carga. Devuelve cómo dejar de escuchar. */
  alCaer(aviso: () => void): () => void;
  /** La pone donde para, ya llegada (al retomar más adelante). */
  llegar(): void;
  /** La pone donde la parquearon, parada (al retomar). */
  volver(): void;
}

export function armarChiva(h: Herramientas, p: Extract<PiezaDeLaGarruchaEnPlano, { cual: "chiva" }>): Chiva {
  const { rapier, mundo } = h;
  const a = AJUSTES_GARRUCHA.chiva;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const largo = EJE_X.clone().applyQuaternion(giro).setY(0).normalize();
  const techo = medio.y;

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  // Lleva al que va en el techo (lo cinemático ya lleva, pero así queda dicho)
  llevaAlQuePisa(cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad, medio.y, medioAncho).setFriction(0.9),
    cuerpo,
  );
  // La parrilla del techo: barandas a los costados (las puntas, abiertas)
  for (const lado of [-1, 1])
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(mitad, a.baranda / 2, 0.03)
        .setTranslation(0, techo + a.baranda / 2, lado * (medioAncho - 0.03))
        .setFriction(0.9),
      cuerpo,
    );
  const imagen = crearImagenChiva(h, mitad, medio.y, medioAncho);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let carga: Huacal | undefined;
  const laCarga = () => {
    carga ??= h.lista.find((q): q is Huacal => q.cual === "huacal" && q.nombre === `${p.nombre}-carga`);
    if (!carga) throw new Error(`la chiva «${p.nombre}» no tiene su carga «${p.nombre}-carga»`);
    return carga;
  };
  const local = new THREE.Vector3();
  const giroAhora = new THREE.Quaternion();
  const enLaChiva = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroAhora.copy(cuerpo.rotation()).invert();
    return local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroAhora);
  };
  const encima = (q: THREE.Vector3Like) => {
    const l = enLaChiva(q);
    const y = l.y - techo;
    return Math.abs(l.x) <= mitad && Math.abs(l.z) <= medioAncho && y > a.bordo[0] && y < a.bordo[1];
  };
  const cargada = () => {
    const l = enLaChiva(laCarga().cuerpo.translation());
    const y = l.y - techo;
    return Math.abs(l.x) <= mitad + 0.2 && Math.abs(l.z) <= medioAncho + 0.2 && y > -0.2 && y < 1.6;
  };
  /** Cuántos muñecos sostienen la carga. */
  const sosteniendo = (munecos: readonly Muneco[]) => munecos.filter((m) => manosEn(m, laCarga().cuerpo) > 0).length;

  const baches = Array.from({ length: p.baches }, (_, k) => (p.recorrido * (k + 1)) / (p.baches + 1));
  let estado: EstadoChiva = "parada";
  let s = 0;
  let v = 0;
  let listos = 0;
  let espera = 0;
  let siguiente = 0;
  let bache = -1;
  let caidas = 0;
  const avisosLlegar = new Set<() => void>();
  const avisosCaer = new Set<() => void>();
  const caerse = () => {
    estado = "frenando";
    espera = 0;
    caidas++;
    for (const aviso of avisosCaer) aviso();
  };
  const ubicar = (ya: boolean) => {
    let alto = 0;
    let ladeo = 0;
    if (bache >= 0) {
      const f = bache / a.golpe;
      alto = p.bache * Math.sin(Math.PI * f);
      ladeo = a.ladeo * Math.sin(2 * Math.PI * f);
    }
    const donde = centro.clone().addScaledVector(largo, s).addScaledVector(ARRIBA, alto);
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, ladeo));
    if (ya) {
      cuerpo.setTranslation(donde, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation(donde);
    cuerpo.setNextKinematicRotation(q);
  };

  h.antes((munecos) => {
    switch (estado) {
      case "parada": {
        // Arranca con la carga y los dos en el techo
        const todos = munecos.length >= 2 && munecos.every((m) => encima(m.partes.pelvis.translation()));
        listos = todos && cargada() ? listos + 1 : 0;
        if (listos * PASO >= a.arrancar) {
          estado = "andando";
          siguiente = 0;
          listos = 0;
        }
        break;
      }
      case "andando": {
        const falta = p.recorrido - s;
        const frenar = (v * v) / (2 * a.aceleracion) >= falta;
        v = frenar ? Math.max(0.2, v - a.aceleracion * PASO) : Math.min(p.velocidad, v + a.aceleracion * PASO);
        s = Math.min(p.recorrido, s + v * PASO);
        // Un bache: la carga que no sostienen los dos salta del techo, lejos de la cámara
        const b = baches[siguiente];
        if (b !== undefined && s >= b) {
          siguiente++;
          bache = 0;
          if (sosteniendo(munecos) < 2) {
            const c = laCarga().cuerpo;
            const vc = c.linvel();
            const lado = EJE_Z.clone().applyQuaternion(giro);
            const salto = { x: vc.x - lado.x * a.tirar.lado, y: a.tirar.arriba, z: vc.z - lado.z * a.tirar.lado };
            c.setLinvel(salto, true);
            c.setAngvel({ x: 3, y: 1, z: 2 }, true);
            // El que la sostenía solo se va con ella (no hay derrota: reaparece junto al compañero)
            for (const m of munecos)
              if (manosEn(m, c) > 0) for (const parte of Object.values(m.partes)) parte.setLinvel(salto, true);
            caerse();
            break;
          }
        }
        if (!cargada()) caerse();
        else if (s >= p.recorrido) {
          estado = "llego";
          v = 0;
          for (const aviso of avisosLlegar) aviso();
        }
        break;
      }
      case "frenando":
        v = Math.max(0, v - 2 * a.aceleracion * PASO);
        s += v * PASO;
        if (v === 0) {
          espera += PASO;
          if (espera >= a.esperar) estado = "devolviendose";
        }
        break;
      case "devolviendose": {
        const frenar = (v * v) / (2 * a.aceleracion) >= s;
        v = frenar ? Math.max(0.2, v - a.aceleracion * PASO) : Math.min(a.devolverse, v + a.aceleracion * PASO);
        s = Math.max(0, s - v * PASO);
        if (s <= 0) {
          estado = "parada";
          v = 0;
          listos = 0;
          // Hay que volver a cargarla: la carga vuelve a su tarima (la que cayó al vacío ya volvió sola), salvo que
          // alguien la tenga agarrada
          if (sosteniendo(munecos) === 0) laCarga().volver();
        }
        break;
      }
      case "llego":
        break;
    }
    if (bache >= 0) {
      bache += PASO;
      if (bache >= a.golpe) bache = -1;
    }
    ubicar(false);
  });

  // Las ruedas giran con lo que anda (también en el invitado, con la chiva que llega en la foto)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let vuelta = 0;
  h.guardar(() => {
    const t = new THREE.Vector3().copy(cuerpo.translation());
    vuelta += t.clone().sub(antes).dot(largo) / imagen.radioRueda;
    antes.copy(t);
  });
  h.dibujar(() => imagen.rodar(vuelta));

  return {
    cual: "chiva",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get recorrido() {
      return s / p.recorrido;
    },
    get caidas() {
      return caidas;
    },
    get carga() {
      return laCarga();
    },
    encima,
    get cargada() {
      return cargada();
    },
    alLlegar(aviso) {
      avisosLlegar.add(aviso);
      return () => {
        avisosLlegar.delete(aviso);
      };
    },
    alCaer(aviso) {
      avisosCaer.add(aviso);
      return () => {
        avisosCaer.delete(aviso);
      };
    },
    llegar() {
      estado = "llego";
      s = p.recorrido;
      v = 0;
      bache = -1;
      ubicar(true);
    },
    volver() {
      estado = "parada";
      s = 0;
      v = 0;
      bache = -1;
      listos = 0;
      ubicar(true);
    },
  };
}

/** La chiva, el bus de escalera: el capó adelante (+x) con su parrilla y los guardabarros, la cabina abierta con sus
 * bancas, los parales de madera y las franjas pintadas (en grises: el único color es el de los pañuelos), la
 * escalera de atrás, la parrilla del techo y las ruedas (dobles atrás). En el marco de la caja, centrada. */
function crearImagenChiva(h: Herramientas, mitad: number, medioAlto: number, medioAncho: number) {
  const a = AJUSTES_GARRUCHA.chiva;
  const grupo = new THREE.Group();
  const radioRueda = Math.min(0.42, medioAlto * 0.22);
  const suelo = -medioAlto;
  const chasis = suelo + radioRueda * 1.35;
  const techo = medioAlto;
  const capo = Math.min(1.5, mitad * 0.45);
  const cabina = mitad * 2 - capo;
  /** Del fondo de la cabina (atrás, −x) a donde empieza el capó. */
  const x0 = -mitad;
  const x1 = -mitad + cabina;
  const madera: THREE.BufferGeometry[] = [];
  const oscuro: THREE.BufferGeometry[] = [];
  const pintura: THREE.BufferGeometry[] = [];
  type Punto = readonly [number, number, number];
  const caja = (lista: THREE.BufferGeometry[], [xa, ya, za]: Punto, [xb, yb, zb]: Punto) =>
    lista.push(
      new THREE.BoxGeometry(Math.abs(xb - xa), Math.abs(yb - ya), Math.abs(zb - za)).translate(
        (xa + xb) / 2,
        (ya + yb) / 2,
        (za + zb) / 2,
      ),
    );
  // El chasis y el piso de la cabina
  caja(oscuro, [x0 + 0.1, chasis - 0.18, -medioAncho + 0.2], [mitad - 0.1, chasis, medioAncho - 0.2]);
  caja(madera, [x0, chasis, -medioAncho], [x1, chasis + 0.08, medioAncho]);
  // Los costados de abajo (hasta la cintura), con dos franjas pintadas
  const cintura = chasis + 0.75;
  for (const lado of [-1, 1]) {
    const z = lado * (medioAncho - 0.03);
    caja(madera, [x0, chasis, z - 0.03], [x1, cintura, z + 0.03]);
    caja(pintura, [x0, chasis + 0.2, z - 0.045], [x1, chasis + 0.32, z + 0.045]);
    caja(pintura, [x0, cintura - 0.18, z - 0.045], [x1, cintura - 0.1, z + 0.045]);
    // Los parales, uno por banca, del costado al techo
    const bancas = Math.max(2, Math.round(cabina / 0.95));
    for (let i = 0; i <= bancas; i++) {
      const x = x0 + 0.05 + ((cabina - 0.1) * i) / bancas;
      caja(madera, [x - 0.05, cintura, z - 0.05], [x + 0.05, techo - 0.12, z + 0.05]);
    }
    // Las cenefas de arriba, con su franja
    caja(madera, [x0, techo - 0.3, z - 0.04], [mitad, techo - 0.12, z + 0.04]);
    caja(pintura, [x0, techo - 0.26, z - 0.05], [mitad, techo - 0.18, z + 0.05]);
  }
  // Las bancas de lado a lado, con su espaldar
  const bancas = Math.max(2, Math.round(cabina / 0.95));
  for (let i = 0; i < bancas; i++) {
    const x = x0 + ((cabina - 0.1) * (i + 0.5)) / bancas;
    caja(oscuro, [x - 0.18, chasis + 0.4, -medioAncho + 0.08], [x + 0.18, chasis + 0.47, medioAncho - 0.08]);
    caja(oscuro, [x + 0.16, chasis + 0.47, -medioAncho + 0.08], [x + 0.22, chasis + 0.9, medioAncho - 0.08]);
  }
  // El techo y su parrilla
  caja(madera, [x0 - 0.05, techo - 0.12, -medioAncho - 0.05], [mitad + 0.05, techo, medioAncho + 0.05]);
  for (const lado of [-1, 1]) {
    const z = lado * (medioAncho - 0.03);
    caja(oscuro, [x0, techo + a.baranda - 0.03, z - 0.025], [mitad, techo + a.baranda + 0.01, z + 0.025]);
    const postes = Math.round(mitad * 2);
    for (let i = 0; i <= postes; i++) {
      const x = x0 + 0.05 + ((mitad * 2 - 0.1) * i) / postes;
      caja(oscuro, [x - 0.02, techo, z - 0.02], [x + 0.02, techo + a.baranda, z + 0.02]);
    }
  }
  // El capó, con su parrilla y los guardabarros; el parabrisas y la visera
  caja(madera, [x1, chasis, -medioAncho * 0.55], [mitad - 0.15, chasis + 0.75, medioAncho * 0.55]);
  caja(oscuro, [mitad - 0.17, chasis + 0.05, -medioAncho * 0.5], [mitad - 0.05, chasis + 0.7, medioAncho * 0.5]);
  for (let i = -3; i <= 3; i++)
    caja(madera, [mitad - 0.06, chasis + 0.1, i * 0.1 - 0.015], [mitad - 0.02, chasis + 0.65, i * 0.1 + 0.015]);
  for (const lado of [-1, 1]) {
    caja(oscuro, [x1 - 0.1, chasis - 0.05, lado * medioAncho * 0.55], [mitad - 0.1, chasis + 0.12, lado * medioAncho]);
    // Los faroles
    oscuro.push(
      new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10)
        .rotateZ(Math.PI / 2)
        .translate(mitad - 0.04, chasis + 0.55, lado * medioAncho * 0.38),
    );
  }
  caja(oscuro, [x1 - 0.06, cintura, -medioAncho + 0.05], [x1 + 0.02, techo - 0.12, -medioAncho + 0.12]);
  caja(oscuro, [x1 - 0.06, cintura, medioAncho - 0.12], [x1 + 0.02, techo - 0.12, medioAncho - 0.05]);
  caja(oscuro, [x1 - 0.05, techo - 0.4, -medioAncho + 0.1], [x1 + 0.02, techo - 0.3, medioAncho - 0.1]);
  // La escalera de atrás, hasta el techo
  for (const lado of [-1, 1])
    caja(oscuro, [x0 - 0.1, chasis - 0.1, lado * 0.3 - 0.025], [x0 - 0.05, techo, lado * 0.3 + 0.025]);
  for (let y = chasis; y < techo - 0.1; y += 0.32) caja(oscuro, [x0 - 0.1, y, -0.3], [x0 - 0.05, y + 0.04, 0.3]);
  grupo.add(new THREE.Mesh(juntar(madera), h.madera));
  grupo.add(new THREE.Mesh(juntar(oscuro), h.oscuro));
  grupo.add(new THREE.Mesh(juntar(pintura), materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false })));
  // Las ruedas: dos adelante y dobles atrás
  const ruedas: THREE.Object3D[] = [];
  const geometriaRueda = juntar([
    new THREE.CylinderGeometry(radioRueda, radioRueda, 0.22, 16).rotateX(Math.PI / 2),
    new THREE.BoxGeometry(radioRueda * 1.2, 0.06, 0.24),
  ]);
  for (const x of [mitad - capo * 0.55, x0 + 1.0])
    for (const lado of [-1, 1]) {
      const rueda = new THREE.Mesh(geometriaRueda, h.oscuro);
      rueda.position.set(x, suelo + radioRueda, lado * (medioAncho - 0.2));
      grupo.add(rueda);
      ruedas.push(rueda);
    }
  return {
    grupo,
    radioRueda,
    rodar(vuelta: number) {
      for (const r of ruedas) r.rotation.z = -vuelta;
    },
  };
}

// ── La palma de cera ────────────────────────────────────────────────────────────────────────────────────────

export interface Palma {
  readonly cual: "palma";
  readonly nombre: string;
  /** El tronco (fijo). */
  readonly tronco: RAPIER.RigidBody;
  /** La manea (cinemática), o `null` si la palma no tiene. */
  readonly manea: RAPIER.RigidBody | null;
  /** Dónde va la manea: 0 abajo, 1 arriba del todo. */
  readonly altura: number;
  /** Quién va colgado de la manea con las dos manos (0 el rojo, 1 el turquesa), o `null`. */
  readonly trepando: 0 | 1 | null;
  /** La manea abajo, quieta (al retomar). */
  volver(): void;
}

export function armarPalma(h: Herramientas, p: Extract<PiezaDeLaGarruchaEnPlano, { cual: "palma" }>): Palma {
  const { rapier, mundo } = h;
  const a = AJUSTES_GARRUCHA.palma;
  const { medio } = p.caja;
  const alto = medio.y * 2;
  const radio = Math.max(0.1, Math.min(medio.x, medio.z));
  const pie = h.enElMundo(p, 0, -medio.y, 0);
  const recto = new THREE.Quaternion();
  const tronco = h.fijo(pie, recto);
  // Abajo, donde descansa la manea, choca solo el alma del tronco, más delgada que lo que se ve: así las manos que se
  // arriman tocan primero la manea, que sobresale, y no el tronco (la mano agarra lo primero que toca). Más arriba,
  // el tronco entero: el que sube colgado de la manea queda afuera, y arriba no se mete debajo de la plataforma
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(alto / 2, radio * a.alma)
      .setTranslation(0, alto / 2, 0)
      .setFriction(0.8),
    tronco,
  );
  const desdeEntero = Math.min(alto, a.manea.desde + a.manea.medioAlto + 0.5);
  if (desdeEntero < alto)
    mundo.createCollider(
      rapier.ColliderDesc.cylinder((alto - desdeEntero) / 2, radio)
        .setTranslation(0, (alto + desdeEntero) / 2, 0)
        .setFriction(0.8),
      tronco,
    );
  const madera = materialCorteza(COLORES.siluetaLejana, { repetir: [1, Math.max(2, Math.round(alto / 2))] });
  const imagen = crearImagenPalmaDeCera(madera, h.oscuro, alto + p.copa, radio, p.nombre.length * 7);
  imagen.name = p.nombre;
  imagen.position.copy(pie);
  h.escena.add(imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo: tronco, colisionador });

  const m = a.manea;
  const tope = alto - m.bajo;
  let y: number = m.desde;
  let trepando: 0 | 1 | null = null;
  let manea: RAPIER.RigidBody | null = null;
  if (p.manea) {
    const cuerpo = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pie.x, pie.y + y, pie.z),
    );
    mundo.createCollider(
      rapier.ColliderDesc.cylinder(m.medioAlto, radio + m.grueso)
        .setCollisionGroups(GRUPOS_GARRUCHA)
        .setSolverGroups(SIN_EMPUJAR),
      cuerpo,
    );
    const aro = new THREE.Mesh(
      juntar([
        new THREE.TorusGeometry(radio + m.grueso * 0.6, 0.035, 6, 18).rotateX(Math.PI / 2).translate(0, 0.06, 0),
        new THREE.TorusGeometry(radio + m.grueso * 0.6, 0.035, 6, 18).rotateX(Math.PI / 2).translate(0, -0.06, 0),
      ]),
      materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false }),
    );
    aro.name = `${p.nombre} manea`;
    h.mover(cuerpo, aro);
    manea = cuerpo;
    h.antes((munecos, entradas) => {
      // El que la tiene con las dos manos la sube o la baja; sin nadie, baja sola
      let agarrada = false;
      let mando = 0;
      trepando = null;
      munecos.forEach((mu, i) => {
        const manos = manosEn(mu, cuerpo);
        if (manos > 0) agarrada = true;
        if (manos === 2 && trepando === null && i <= 1) {
          trepando = i as 0 | 1;
          mando = entradas?.[i]?.avanzar ?? 0;
        }
      });
      let vy = 0;
      if (trepando !== null) vy = mando > 0.1 ? p.velocidad : mando < -0.1 ? -p.velocidad : 0;
      else if (!agarrada) vy = -a.volver;
      y = limitar(y + vy * PASO, m.desde, tope);
      cuerpo.setNextKinematicTranslation({ x: pie.x, y: pie.y + y, z: pie.z });
    });
  }

  return {
    cual: "palma",
    nombre: p.nombre,
    tronco,
    manea,
    get altura() {
      return (y - m.desde) / (tope - m.desde);
    },
    get trepando() {
      return trepando;
    },
    volver() {
      y = m.desde;
      manea?.setTranslation({ x: pie.x, y: pie.y + y, z: pie.z }, true);
      manea?.setNextKinematicTranslation({ x: pie.x, y: pie.y + y, z: pie.z });
    },
  };
}

/** Una palma de cera: un tronco altísimo y delgado, claro (la cera), con anillos y apenas más grueso a media altura;
 * arriba, el capitel más oscuro y el cogollo de hojas largas que se arquean, cada una con sus foliolos colgando. En
 * el marco del pie: sube por +y hasta `alto`. También de adorno (el guion pone varias). */
export function crearImagenPalmaDeCera(
  madera: THREE.Material,
  hojas: THREE.Material,
  alto: number,
  radio: number,
  semilla = 1,
): THREE.Group {
  const grupo = new THREE.Group();
  const azar = crearAzar(semilla * 131 + 7);
  const tronco: THREE.BufferGeometry[] = [];
  const n = Math.max(8, Math.round(alto / 0.6));
  const capitel = Math.min(1.4, alto * 0.08);
  const fuste = alto - capitel;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    // Más gruesa a media altura (como las de verdad), un poco más angosta arriba
    const r = (t: number) => radio * (1 + 0.18 * Math.sin(Math.PI * t * 0.9) - 0.15 * t);
    tronco.push(
      new THREE.CylinderGeometry(r(t1), r(t0), (fuste / n) * 1.01, 12, 1).translate(0, fuste * (t0 + t1) * 0.5, 0),
    );
    // Un anillo cada tanto
    tronco.push(new THREE.TorusGeometry(r(t0) * 1.01, 0.012, 4, 14).rotateX(Math.PI / 2).translate(0, fuste * t0, 0));
  }
  grupo.add(new THREE.Mesh(juntar(tronco), madera));
  // El capitel (verde en las de verdad: acá, más oscuro) y el cogollo
  const copa: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(radio * 0.75, radio * 0.9, capitel, 10).translate(0, fuste + capitel / 2, 0),
  ];
  const hojasN = 11;
  for (let i = 0; i < hojasN; i++) {
    const angulo = (i / hojasN) * Math.PI * 2 + azar() * 0.4;
    const largo = 2.2 + azar() * 1.1;
    const alzada = 0.5 + azar() * 0.6;
    // El raquis: dos tramos, el primero sube y el segundo se arquea hacia abajo
    const tramos = 9;
    const punto = (t: number) =>
      new THREE.Vector3(largo * t, Math.sin(alzada) * largo * t - 1.6 * largo * t * t * 0.55, 0).applyAxisAngle(
        ARRIBA,
        angulo,
      );
    for (let k = 0; k < tramos; k++) {
      const a = punto(k / tramos).add(new THREE.Vector3(0, alto, 0));
      const b = punto((k + 1) / tramos).add(new THREE.Vector3(0, alto, 0));
      copa.push(palo(a, b, 0.025, 4));
      // Los foliolos, colgando a cada lado
      const lado = new THREE.Vector3(0, 0, 1).applyAxisAngle(ARRIBA, angulo);
      const largoFoliolo = 0.6 * (1 - (k / tramos) * 0.5);
      for (const s of [-1, 1])
        for (const t of [0.25, 0.75]) {
          const raiz = a.clone().lerp(b, t);
          const punta = raiz
            .clone()
            .addScaledVector(lado, s * largoFoliolo * 0.75)
            .addScaledVector(ARRIBA, -largoFoliolo * 0.7);
          copa.push(palo(raiz, punta, 0.035, 3));
        }
    }
  }
  grupo.add(new THREE.Mesh(juntar(copa), hojas));
  return grupo;
}

/** La orquídea del secreto, en lo alto de la palma más alta: una mata de hojas largas y tres flores blancas con su
 * labelo (30 cm). Sin color nuevo: es lo único claro y con luz allá arriba, como la figura de jade del río. */
export function crearOrquidea(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "orquídea";
  const blanca = new THREE.MeshStandardMaterial({
    name: "orquidea",
    color: COLORES.ojo,
    roughness: 0.35,
    emissive: COLORES.siluetaLejana,
    emissiveIntensity: 0.6,
    side: THREE.DoubleSide,
  });
  const hojas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const angulo = (i / 5) * Math.PI * 2;
    hojas.push(new THREE.BoxGeometry(0.32, 0.012, 0.06).translate(0.16, 0, 0).rotateZ(0.35).rotateY(angulo));
  }
  const flores: THREE.BufferGeometry[] = [];
  const tallos: THREE.Vector3[] = [
    new THREE.Vector3(0.06, 0.3, 0.02),
    new THREE.Vector3(-0.05, 0.26, 0.07),
    new THREE.Vector3(0.0, 0.34, -0.06),
  ];
  for (const [k, c] of tallos.entries()) {
    hojas.push(palo(new THREE.Vector3(0, 0, 0), c, 0.008, 4));
    // Cinco pétalos y el labelo, mirando hacia +z
    for (let i = 0; i < 5; i++) {
      const angulo = (i / 5) * Math.PI * 2 + k;
      flores.push(
        new THREE.CircleGeometry(0.045, 8)
          .scale(0.55, 1, 1)
          .translate(0, 0.045, 0)
          .rotateZ(angulo)
          .translate(c.x, c.y, c.z + 0.01),
      );
    }
    flores.push(new THREE.SphereGeometry(0.025, 8, 6).scale(1, 0.8, 1.4).translate(c.x, c.y - 0.02, c.z + 0.03));
  }
  grupo.add(new THREE.Mesh(juntar(hojas), materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false })));
  grupo.add(new THREE.Mesh(juntar(flores), blanca));
  const brillo = new THREE.PointLight(COLORES.ojo, 1.2, 2, 2);
  brillo.position.set(0, 0.35, 0.25);
  grupo.add(brillo);
  return grupo;
}

/** El paisaje del Eje cafetero, que pone el guion: la orquídea del secreto, las palmas de cera (x, z, la altura del
 * pie y lo alto), las montañas del fondo (x, z, alto y ancho: las «montañas verdes», en siluetas y grises) y los
 * guaduales (x, z, la altura del pie y cuántas guaduas). Las x van sin correr: se les suma `dx`. */
export function adornarCafetal(
  escena: THREE.Object3D,
  o: {
    readonly dx: number;
    /** Las mallas de solo imagen del .glb (sin `tipo`) que van de madera y las que van oscuras, por el comienzo de
     * su nombre: el exportador las deja grises claras. */
    readonly madera: readonly string[];
    readonly oscuras: readonly string[];
    readonly orquidea: THREE.Vector3Like;
    readonly palmas: readonly (readonly [number, number, number, number])[];
    readonly montanas: readonly (readonly [number, number, number, number])[];
    readonly guaduales: readonly (readonly [number, number, number, number])[];
  },
): void {
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 2] });
  const oscura = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  escena.traverse((objeto) => {
    if (!(objeto instanceof THREE.Mesh)) return;
    if (o.madera.some((n) => objeto.name.startsWith(n))) objeto.material = madera;
    else if (o.oscuras.some((n) => objeto.name.startsWith(n))) objeto.material = oscura;
  });
  const orquidea = crearOrquidea();
  orquidea.position.copy(o.orquidea);
  orquidea.rotation.y = -0.4;
  escena.add(orquidea);
  const cera = materialCorteza(COLORES.siluetaLejana, { repetir: [1, 6] });
  const hojas = materialTela(COLORES.silueta, { repetir: 1, pelusa: false });
  for (const [i, [x, z, y, alto]] of o.palmas.entries()) {
    const palma = crearImagenPalmaDeCera(cera, hojas, alto, 0.22 + 0.02 * (i % 3), i + 3);
    palma.position.set(o.dx + x, y, z);
    palma.rotation.set(0.03 * Math.sin(i * 2.3), i * 1.9, 0.03 * Math.cos(i * 1.7));
    escena.add(palma);
  }
  const montes: THREE.BufferGeometry[] = [];
  for (const [i, [x, z, alto, ancho]] of o.montanas.entries())
    montes.push(
      new THREE.ConeGeometry(ancho / 2, alto, 7, 1)
        .scale(1, 1, 0.6)
        .rotateY(i * 0.7)
        .translate(o.dx + x, alto / 2 - 6, z),
    );
  const lejana = new THREE.MeshStandardMaterial({ name: "montaña", color: COLORES.siluetaLejana, roughness: 1 });
  escena.add(new THREE.Mesh(juntar(montes), lejana));
  const guadua = materialCorteza(COLORES.silueta, { repetir: [1, 4] });
  const varas: THREE.BufferGeometry[] = [];
  for (const [k, [x, z, y, n]] of o.guaduales.entries())
    for (let i = 0; i < n; i++) {
      const alto = 6 + ((i * 37 + k * 11) % 5);
      const angulo = (i / n) * Math.PI * 2 + k;
      const pie = new THREE.Vector3(o.dx + x + 0.35 * Math.cos(angulo), y, z + 0.35 * Math.sin(angulo));
      const punta = pie
        .clone()
        .add(new THREE.Vector3(Math.cos(angulo) * alto * 0.22, alto, Math.sin(angulo) * alto * 0.22));
      varas.push(palo(pie, punta, 0.06, 6));
    }
  escena.add(new THREE.Mesh(juntar(varas), guadua));
}
