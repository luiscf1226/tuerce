// La Sucia (TU-24): la lavandera gruñona del río Guayape. Sale de un nodo `tipo: pieza, pieza: sucia`; su caja es su
// lavadero: lava en el fondo de la caja, mirando hacia su frente, y al que se meta en la caja le tira agua.
//
//   · Lava `lavar` segundos restregando la ropa en la piedra con su guacal (un cuenco).
//   · Al terminar, si hay alguien en su caja, se voltea hacia el más cercano y alza el guacal (`apuntar` segundos:
//     lo que tienen para salirse) y se lo tira: el mojado sale empujado hacia afuera (no hay derrota). Si se fue de
//     la caja antes, el agua cae al suelo. Después vuelve a lavar.
//   · Sin nadie en su caja, lava y lava.
//
// Es cinemática, sin choques y sin azar: dos corridas iguales dan lo mismo. Su cuerpo y el del guacal viajan en la
// foto de la red como todo lo que se mueve; el invitado no la simula: la dibuja con lo que ve (los brazos van al
// guacal y el agua sale del guacal cuando lo tira).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import { crearGotas } from "./agua";
import type { PiezaDeLaPozaEnPlano } from "./formato-poza";
import type { Herramientas } from "./piezas";

export type EstadoSucia = "lavando" | "apuntando" | "tirando";

export interface Sucia {
  readonly cual: "sucia";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Su guacal, que se mueve con ella (cinemático). */
  readonly guacal: RAPIER.RigidBody;
  readonly estado: EstadoSucia;
  /** A quién le apunta o le tira (0 el rojo, 1 el turquesa), o `null`. */
  readonly apunta: 0 | 1 | null;
  /** Cuántas veces mojó a alguien. */
  readonly salpicadas: number;
  /** Cuánto le falta para terminar de lavar (s): mientras lava, se puede pasar. */
  readonly falta: number;
  /** Llama a `aviso` cada vez que moja a alguien. Devuelve cómo dejar de escuchar. */
  alSalpicar(aviso: (jugador: 0 | 1) => void): () => void;
  /** La pone a lavar desde el principio (al retomar). */
  volver(): void;
}

/** Los números de La Sucia que no se ponen desde Blender. */
export const AJUSTES_SUCIA = {
  /** Qué tan rápido se voltea (rad/s). */
  giro: 4,
  /** Cuánto dura el tirón del guacal (s). */
  tirar: 0.35,
  /** Hasta dónde llega el agua desde ella (m): más lejos, aunque esté en la caja, no lo moja. */
  alcance: 4.5,
  /** Lo que sube el mojado (m/s). */
  arriba: 0.8,
  /** Del pie a las manos, donde lleva el guacal al lavar (m). */
  manos: 0.75,
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function armarSucia(h: Herramientas, p: Extract<PiezaDeLaPozaEnPlano, { cual: "sucia" }>): Sucia {
  const { rapier, mundo } = h;
  const a = AJUSTES_SUCIA;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  // Su lugar: al fondo de la caja (40 cm adentro), sobre la base, mirando hacia el frente
  const casa = h.enElMundo(p, 0, -medio.y, -medio.z + 0.4);
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboCasa = Math.atan2(frente.x, frente.z);
  const giroDe = (rumbo: number) => new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(casa.x, casa.y, casa.z).setRotation(giroDe(rumboCasa)),
  );
  // Sin grupos: no choca ni la ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setTranslation(0, 0.8, 0).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  // El guacal empieza en la piedra de lavar, en sus manos
  const guacal0 = new THREE.Vector3(0, a.manos - 0.08, 0.58).applyQuaternion(giroDe(rumboCasa)).add(casa);
  const guacal = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(guacal0.x, guacal0.y, guacal0.z)
      .setRotation(giroDe(rumboCasa)),
  );
  const imagen = crearImagenSucia();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  const imagenGuacal = imagen.guacal;
  imagenGuacal.name = `${p.nombre} guacal`;
  h.mover(guacal, imagenGuacal);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });
  // El lavadero: una piedra plana delante de ella y una pila de ropa al lado
  const lavadero = new THREE.Group();
  const piedra = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.55, 0.5, 9).scale(1.3, 1, 0.8),
    materialTela(COLORES.roca, { repetir: 1, relieve: 2, pelusa: false }),
  );
  piedra.position.set(0, 0.25, 0.62);
  const pila = new THREE.Mesh(
    juntar([
      new THREE.SphereGeometry(0.28, 9, 6).scale(1.2, 0.5, 1).translate(0, 0.1, 0),
      new THREE.SphereGeometry(0.2, 8, 6).scale(1.1, 0.5, 1).translate(0.05, 0.24, 0.02),
    ]),
    materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false }),
  );
  pila.position.set(-0.75, 0, 0.25);
  lavadero.add(piedra, pila);
  lavadero.position.copy(casa);
  lavadero.quaternion.copy(giroDe(rumboCasa));
  h.escena.add(lavadero);
  const gotas = crearGotas(h.escena);

  /** Si el punto está en su caja (a lo alto, desde la base hasta 2.5 m). */
  const local = new THREE.Vector3();
  const enLaCaja = (q: THREE.Vector3Like) => {
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
    const y = q.y - casa.y;
    return Math.abs(local.x) <= medio.x && Math.abs(local.z) <= medio.z && y > -0.5 && y < 2.5;
  };
  /** El más cercano de los dos en la caja (de pie o no), o `null`. */
  const objetivo = (munecos: readonly Muneco[]): 0 | 1 | null => {
    let mejor: 0 | 1 | null = null;
    let distancia = Number.POSITIVE_INFINITY;
    for (const j of [0, 1] as const) {
      const m = munecos[j];
      if (!m) continue;
      const t = m.partes.pelvis.translation();
      if (!enLaCaja(t)) continue;
      const d = Math.hypot(t.x - casa.x, t.z - casa.z);
      if (d < distancia && d < a.alcance) {
        distancia = d;
        mejor = j;
      }
    }
    return mejor;
  };

  let estado: EstadoSucia = "lavando";
  let tiempo = p.lavar;
  let rumbo = rumboCasa;
  let apunta: 0 | 1 | null = null;
  let salpicadas = 0;
  let pasos = 0;
  const avisos = new Set<(jugador: 0 | 1) => void>();

  /** Dónde lleva el guacal, en su marco (adelante +z): restregando en la piedra, alzado, o tirándolo. */
  const guacalEn = (t: number) => {
    if (estado === "lavando") {
      const restriega = Math.sin(t * 7) * 0.16;
      return new THREE.Vector3(restriega, a.manos - 0.12 + Math.abs(Math.cos(t * 7)) * 0.04, 0.58);
    }
    if (estado === "apuntando") {
      const alzado = limitar(1 - tiempo / p.apuntar, 0, 1);
      return new THREE.Vector3(0.18, a.manos + 0.75 * alzado, 0.35 - 0.3 * alzado);
    }
    // Tirando: de atrás del hombro hacia adelante, rápido
    const t2 = limitar(1 - tiempo / a.tirar, 0, 1);
    return new THREE.Vector3(0.18 - 0.1 * t2, a.manos + 0.75 - 0.35 * t2, 0.05 + 0.85 * t2);
  };

  const mover = () => {
    const q = giroDe(rumbo);
    cuerpo.setNextKinematicRotation(q);
    cuerpo.setNextKinematicTranslation(casa);
    const g = guacalEn(pasos * PASO)
      .applyQuaternion(q)
      .add(casa);
    guacal.setNextKinematicTranslation(g);
    guacal.setNextKinematicRotation(q);
  };

  /** El agua le cae al que apuntó, si sigue en la caja: sale empujado hacia afuera (de ella) y un poco para arriba. */
  const mojar = (m: Muneco, jugador: 0 | 1) => {
    const t = m.partes.pelvis.translation();
    if (!enLaCaja(t) || Math.hypot(t.x - casa.x, t.z - casa.z) > a.alcance) return;
    let dx = t.x - casa.x;
    let dz = t.z - casa.z;
    const largo = Math.hypot(dx, dz) || 1;
    dx /= largo;
    dz /= largo;
    for (const parte of Object.values(m.partes)) {
      const masa = parte.mass();
      parte.applyImpulse({ x: dx * p.empujon * masa, y: a.arriba * masa, z: dz * p.empujon * masa }, true);
    }
    salpicadas++;
    for (const aviso of avisos) aviso(jugador);
  };

  h.antes((munecos) => {
    pasos++;
    tiempo -= PASO;
    if (estado === "lavando") {
      rumbo = envolver(rumbo + limitar(envolver(rumboCasa - rumbo), -a.giro * PASO, a.giro * PASO));
      if (tiempo <= 0) {
        apunta = objetivo(munecos);
        if (apunta === null) tiempo = p.lavar;
        else {
          estado = "apuntando";
          tiempo = p.apuntar;
        }
      }
    } else if (estado === "apuntando") {
      // Lo sigue con la mirada mientras alza el guacal
      const m = apunta === null ? undefined : munecos[apunta];
      if (m) {
        const t = m.partes.pelvis.translation();
        const deseado = Math.atan2(t.x - casa.x, t.z - casa.z);
        rumbo = envolver(rumbo + limitar(envolver(deseado - rumbo), -a.giro * PASO, a.giro * PASO));
      }
      if (tiempo <= 0) {
        estado = "tirando";
        tiempo = a.tirar;
      }
    } else if (tiempo <= 0) {
      const m = apunta === null ? undefined : munecos[apunta];
      if (m && apunta !== null) mojar(m, apunta);
      estado = "lavando";
      tiempo = p.lavar;
      apunta = null;
    }
    mover();
  });

  // La imagen: los brazos van al guacal; al tirarlo (también en el invitado) sale el agua del guacal
  const antes = new THREE.Vector3().copy(guacal.translation());
  const velocidad = new THREE.Vector3();
  let segundos = 0;
  h.guardar(() => {
    const t = guacal.translation();
    velocidad.set(t.x - antes.x, t.y - antes.y, t.z - antes.z).divideScalar(PASO);
    antes.copy(t);
    segundos += PASO;
    // El tirón: el guacal va rápido hacia adelante y hacia abajo
    if (velocidad.length() > 2.2 && velocidad.y < 0.5) {
      for (let i = 0; i < 4; i++) {
        const abre = (i - 1.5) * 0.35;
        gotas.gota(
          t,
          {
            x: velocidad.x * 1.6 + Math.cos(i * 1.9) * abre,
            y: 1.6 + i * 0.25,
            z: velocidad.z * 1.6 + Math.sin(i * 1.9) * abre,
          },
          0.9,
        );
      }
    }
  });
  h.dibujar((alfa) => {
    imagen.posar(imagenGuacal.position, (pasos - 1 + alfa) * PASO);
    gotas.mover(segundos);
  });

  return {
    cual: "sucia",
    nombre: p.nombre,
    cuerpo,
    guacal,
    get estado() {
      return estado;
    },
    get apunta() {
      return apunta;
    },
    get salpicadas() {
      return salpicadas;
    },
    get falta() {
      return estado === "lavando" ? tiempo : 0;
    },
    alSalpicar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      estado = "lavando";
      tiempo = p.lavar;
      apunta = null;
      rumbo = rumboCasa;
      cuerpo.setRotation(giroDe(rumbo), true);
      mover();
    },
  };
}

/** La lavandera: falda ancha, cuerpo robusto, pañoleta y los dos ojos blancos. Mira hacia +z, los pies en y = 0.
 * Todo de tela oscura; la pañoleta gris (el único color del juego son los pañuelos de los muñecos). */
function crearImagenSucia() {
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 4 });
  const panoleta = materialTela(COLORES.siluetaLejana, { repetir: 2, relieve: 3, pelusa: false });
  const grupo = new THREE.Group();
  // Falda y cuerpo, inclinada un poco hacia adelante (sobre la piedra)
  const cuerpo = new THREE.Group();
  cuerpo.rotation.x = 0.18;
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.24, 0.5, 0.75, 14).translate(0, 0.375, 0),
        new THREE.SphereGeometry(0.3, 14, 10).scale(1, 1.15, 0.9).translate(0, 0.95, 0),
        // Las trenzas gruesas, colgando por la espalda
        new THREE.CapsuleGeometry(0.045, 0.35, 4, 6).translate(-0.1, 1.05, -0.2),
        new THREE.CapsuleGeometry(0.045, 0.35, 4, 6).translate(0.1, 1.05, -0.2),
      ]),
      tela,
    ),
  );
  // La cabeza con la pañoleta amarrada
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.42, 0.05);
  cabeza.add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), tela));
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.225, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 0.02, -0.01),
        new THREE.ConeGeometry(0.07, 0.22, 5).rotateX(-2.4).translate(0, -0.06, -0.24),
      ]),
      panoleta,
    ),
  );
  cabeza.add(
    new THREE.Mesh(
      juntar([-1, 1].map((lado) => new THREE.SphereGeometry(0.028, 8, 6).translate(lado * 0.075, 0.01, 0.195))),
      materialOjo(),
    ),
  );
  // Las cejas fruncidas: gruñona
  cabeza.add(
    new THREE.Mesh(
      juntar(
        [-1, 1].map((lado) =>
          new THREE.BoxGeometry(0.075, 0.016, 0.02).rotateZ(lado * -0.45).translate(lado * 0.075, 0.065, 0.2),
        ),
      ),
      new THREE.MeshStandardMaterial({ name: "cejas", color: COLORES.siluetaHonda }),
    ),
  );
  cuerpo.add(cabeza);
  grupo.add(cuerpo);
  // Los brazos: de los hombros al guacal (se estiran al dibujar)
  const brazo = new THREE.CylinderGeometry(0.06, 0.07, 1, 7).translate(0, 0.5, 0);
  const brazos = [-1, 1].map((lado) => {
    const b = new THREE.Mesh(brazo, tela);
    grupo.add(b);
    return { b, lado };
  });
  // El guacal: un cuenco de morro (va aparte: lo mueve su propio cuerpo)
  const guacal = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55).scale(1, 0.75, 1),
    materialTela(COLORES.silueta, { repetir: 1, pelusa: false }),
  );
  (guacal.material as THREE.Material).side = THREE.DoubleSide;
  const hombro = new THREE.Vector3();
  const mano = new THREE.Vector3();
  return {
    grupo,
    guacal,
    /** Los brazos al guacal (que está en `donde`, en el mundo) y la cabeza que se mueve al restregar. */
    posar(donde: THREE.Vector3, t: number) {
      grupo.updateMatrixWorld();
      for (const { b, lado } of brazos) {
        hombro.set(lado * 0.27, 1.12, 0.12).applyMatrix4(grupo.matrixWorld);
        mano.copy(donde).add(new THREE.Vector3(lado * 0.12, 0.05, 0).applyQuaternion(grupo.quaternion));
        const largo = Math.max(0.2, hombro.distanceTo(mano));
        b.position.copy(hombro).applyMatrix4(grupo.matrixWorld.clone().invert());
        b.scale.set(1, largo, 1);
        const d = mano.clone().sub(hombro).normalize().applyQuaternion(grupo.quaternion.clone().invert());
        b.quaternion.setFromUnitVectors(ARRIBA, d);
      }
      cabeza.rotation.z = Math.sin(t * 3.5) * 0.06;
    },
  };
}
