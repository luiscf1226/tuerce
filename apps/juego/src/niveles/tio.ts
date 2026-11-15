// El Tío de la mina (TU-46): un diablito con cuernos, sentado en su altar en el medio de la base de su caja, mirando
// hacia su frente. Es el dueño de lo que hay adentro del cerro, y quiere su ofrenda:
//
//   esperando   mira al muñeco más cercano (a menos de `vista`) y estira la mano, con la palma para arriba
//   recibiendo  la ofrenda suelta a menos de `alcance` de su mano (nadie la tiene agarrada: lo que tiene una mano
//               encima no está suelto) se la queda: la lleva de a poco a su regazo
//   contento    con la ofrenda en el regazo fuma su cigarro, echado para atrás, y ya no mira a nadie
//
// Es cinemático y sin azar: lo mueve el juego. Choca (no se lo atraviesa), pero no empuja a nadie. En línea, el
// invitado no corre nada: lo ve contento porque ve la ofrenda en su regazo, y lo ve mirar porque gira su cuerpo.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { PiezaDeLaMinaEnPlano } from "./formato-mina";
import type { Herramientas } from "./piezas";
import type { Ofrenda } from "./piezas-mina";

export type EstadoTio = "esperando" | "recibiendo" | "contento";

export interface Tio {
  readonly cual: "tio";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoTio;
  /** Si ya tiene su ofrenda (también en el invitado: la ve en su regazo). */
  readonly contento: boolean;
  /** A quién mira (0 el rojo, 1 el turquesa), o `null`. */
  readonly mira: 0 | 1 | null;
  /** Dónde estira la mano para recibir (en el mundo). */
  mano(salida?: THREE.Vector3): THREE.Vector3;
  /** Se queda ya con esa ofrenda, contento (al retomar). */
  recibir(ofrenda: Ofrenda): void;
  /** Llama a `aviso` cuando se queda con la ofrenda. Devuelve cómo dejar de escuchar. */
  alRecibir(aviso: () => void): () => void;
}

const ARRIBA = new THREE.Vector3(0, 1, 0);

/** Los números del Tío que no se ponen desde Blender. */
export const AJUSTES_TIO = {
  /** Su cuerpo sentado, para que no lo atraviesen (m). */
  cuerpo: { ancho: 0.5, alto: 1.5, fondo: 0.45 },
  /** La mano estirada y el regazo, en su marco (sentado, mirando hacia +z). */
  mano: { x: 0.24, y: 0.95, z: 0.62 },
  regazo: { x: 0, y: 0.78, z: 0.3 },
  /** Cuánto gira para mirar hacia cada lado de su frente (radianes) y a qué velocidad (rad/s). */
  mirar: { tope: 1.1, velocidad: 2 },
  /** Lo que tarda en llevar la ofrenda de la mano al regazo (s). */
  recibir: 0.8,
  /** La ofrenda a menos de esto de su regazo (m): la tiene. */
  tiene: 0.2,
} as const;

const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function armarTio(h: Herramientas, p: Extract<PiezaDeLaMinaEnPlano, { cual: "tio" }>): Tio {
  const { rapier, mundo } = h;
  const a = AJUSTES_TIO;
  const { centro, medio, giro } = p.caja;
  const casa = new THREE.Vector3(centro.x, centro.y - medio.y, centro.z);
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboCasa = Math.atan2(frente.x, frente.z);
  let rumbo = rumboCasa;
  const giroDe = (r: number) => new THREE.Quaternion().setFromAxisAngle(ARRIBA, r);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(casa.x, casa.y, casa.z).setRotation(giroDe(rumbo)),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.cuerpo.ancho / 2, a.cuerpo.alto / 2, a.cuerpo.fondo / 2)
      .setTranslation(0, a.cuerpo.alto / 2, 0)
      .setFriction(0.6),
    cuerpo,
  );
  const imagen = crearImagenTio();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });
  // El altar: un banco de piedra bajo él, con serpentinas (solo imagen)
  const altar = crearAltar();
  altar.position.copy(casa);
  altar.quaternion.copy(giroDe(rumboCasa));
  h.escena.add(altar);

  let estado: EstadoTio = "esperando";
  let mira: 0 | 1 | null = null;
  let ofrenda: Ofrenda | null = null;
  let recibiendo = 0;
  const desde = new THREE.Vector3();
  const avisos = new Set<() => void>();
  /** Un punto de su cuerpo (sentado, mirando hacia +z) en el mundo, con el rumbo `r`. */
  const punto = (l: THREE.Vector3Like, r: number, salida = new THREE.Vector3()) =>
    salida.set(l.x, l.y, l.z).applyAxisAngle(ARRIBA, r).add(casa);

  const quedarse = (o: Ofrenda) => {
    ofrenda = o;
    o.entregar();
  };
  const ponerContento = () => {
    estado = "contento";
    for (const aviso of avisos) aviso();
  };

  h.antes((munecos) => {
    let objetivo = rumboCasa;
    mira = null;
    if (estado === "esperando") {
      // Mira al muñeco más cercano que tenga a la vista
      let cerca = p.vista;
      munecos.forEach((m, j) => {
        const t = m.partes.pelvis.translation();
        const d = Math.hypot(t.x - casa.x, t.z - casa.z);
        if (d >= cerca) return;
        cerca = d;
        mira = j === 0 ? 0 : 1;
        const hacia = Math.atan2(t.x - casa.x, t.z - casa.z);
        objetivo = rumboCasa + limitar(envolver(hacia - rumboCasa), -a.mirar.tope, a.mirar.tope);
      });
      // La ofrenda suelta al alcance de su mano: se la queda
      const mano = punto(a.mano, rumbo);
      for (const otra of h.lista) {
        if (otra.cual !== "ofrenda" || otra.entregada || otra.agarrado > 0) continue;
        const t = otra.cuerpo.translation();
        if (Math.hypot(t.x - mano.x, t.y - mano.y, t.z - mano.z) > p.alcance) continue;
        desde.copy(t);
        quedarse(otra);
        estado = "recibiendo";
        recibiendo = 0;
        break;
      }
    }
    if (estado !== "esperando") objetivo = rumboCasa;
    const paso = a.mirar.velocidad * PASO;
    rumbo = envolver(rumbo + limitar(envolver(objetivo - rumbo), -paso, paso));
    cuerpo.setNextKinematicTranslation(casa);
    cuerpo.setNextKinematicRotation(giroDe(rumbo));
    if (!ofrenda) return;
    // La lleva de la mano al regazo; después la tiene ahí
    const regazo = punto(a.regazo, rumbo);
    if (estado === "recibiendo") {
      recibiendo += PASO;
      const t = limitar(recibiendo / a.recibir, 0, 1);
      ofrenda.llevar(desde.clone().lerp(regazo, t * t * (3 - 2 * t)), giroDe(rumbo));
      if (recibiendo >= a.recibir) ponerContento();
    } else ofrenda.llevar(regazo, giroDe(rumbo));
  });

  // Contento si tiene una ofrenda en el regazo: lo sabe también el invitado, con los cuerpos como llegan
  let tiene = false;
  let pasos = 0;
  const regazoAhora = new THREE.Vector3();
  const q = new THREE.Quaternion();
  h.guardar(() => {
    pasos++;
    const c = cuerpo.translation();
    q.copy(cuerpo.rotation());
    regazoAhora.set(a.regazo.x, a.regazo.y, a.regazo.z).applyQuaternion(q).add(c);
    tiene = h.lista.some((otra) => {
      if (otra.cual !== "ofrenda") return false;
      const t = otra.cuerpo.translation();
      return Math.hypot(t.x - regazoAhora.x, t.y - regazoAhora.y, t.z - regazoAhora.z) < a.tiene;
    });
  });
  h.dibujar(() => {
    imagen.posar(tiene, pasos * PASO);
  });

  return {
    cual: "tio",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get contento() {
      return tiene || estado === "contento";
    },
    get mira() {
      return mira;
    },
    mano(salida = new THREE.Vector3()) {
      return punto(a.mano, rumbo, salida);
    },
    recibir(o) {
      if (ofrenda) return;
      quedarse(o);
      rumbo = rumboCasa;
      const regazo = punto(a.regazo, rumbo);
      o.cuerpo.setTranslation({ x: regazo.x, y: regazo.y, z: regazo.z }, true);
      o.llevar(regazo, giroDe(rumbo));
      ponerContento();
    },
    alRecibir(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** El Tío sentado, mirando hacia +z: panzón, con cuernos, ojos grandes, barbita y los brazos que se mueven. */
function crearImagenTio() {
  const grupo = new THREE.Group();
  const tela = materialTela(COLORES.silueta, { repetir: 2, relieve: 5 });
  const honda = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const claro = new THREE.MeshStandardMaterial({ name: "serpentina", color: COLORES.agua, roughness: 0.8 });
  // Las piernas abiertas, sentado, y las botas
  const piernas: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    piernas.push(new THREE.CapsuleGeometry(0.1, 0.32, 4, 8).rotateX(Math.PI / 2).translate(s * 0.16, 0.55, 0.16));
    piernas.push(new THREE.CapsuleGeometry(0.09, 0.36, 4, 8).translate(s * 0.18, 0.28, 0.36));
    piernas.push(new THREE.BoxGeometry(0.16, 0.1, 0.26).translate(s * 0.18, 0.05, 0.42));
  }
  grupo.add(new THREE.Mesh(juntar(piernas), tela));
  // La panza y el pecho, y la cabeza (que se echa para atrás cuando está contento)
  const torso = new THREE.Group();
  torso.position.set(0, 0.62, 0);
  torso.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.32, 14, 10).scale(1, 1.05, 0.95).translate(0, 0.2, 0.02),
        new THREE.SphereGeometry(0.24, 12, 8).translate(0, 0.52, -0.02),
      ]),
      tela,
    ),
  );
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.86, 0.02);
  const cuernos = [-1, 1].map((s) => {
    const curva = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(s * 0.12, 0.14, 0),
      new THREE.Vector3(s * 0.3, 0.24, 0.02),
      new THREE.Vector3(s * 0.24, 0.46, 0.06),
    );
    return new THREE.TubeGeometry(curva, 8, 0.035, 6, false);
  });
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.2, 14, 10).scale(1, 1.08, 1),
        // La nariz ganchuda, las orejas puntudas y la barbita
        new THREE.ConeGeometry(0.05, 0.14, 6).rotateX(Math.PI / 2 + 0.4).translate(0, -0.01, 0.22),
        ...[-1, 1].map((s) => new THREE.ConeGeometry(0.05, 0.18, 5).rotateZ(-s * 1.1).translate(s * 0.22, 0.04, 0)),
        new THREE.ConeGeometry(0.06, 0.2, 6).rotateX(Math.PI).translate(0, -0.26, 0.1),
      ]),
      tela,
    ),
    new THREE.Mesh(juntar(cuernos), honda),
    // Los ojos grandes y la boca abierta, claros sobre lo oscuro
    new THREE.Mesh(
      juntar([-1, 1].map((s) => new THREE.SphereGeometry(0.045, 10, 8).translate(s * 0.08, 0.05, 0.17))),
      materialOjo(),
    ),
    new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.02).translate(0, -0.09, 0.19), materialOjo()),
  );
  torso.add(cabeza);
  // Las serpentinas del carnaval minero, colgadas del cuello y de los cuernos
  const serpentinas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.22 + i * 0.09;
    serpentinas.push(new THREE.BoxGeometry(0.025, 0.42, 0.01).rotateZ(0.2 * Math.sin(i * 1.7)).translate(x, 0.42, 0.2));
  }
  torso.add(new THREE.Mesh(juntar(serpentinas), claro));
  // Los brazos: el derecho estira la mano (esperando) o se lleva el cigarro a la boca (contento)
  const brazo = (lado: number) => {
    const b = new THREE.Group();
    b.position.set(lado * 0.32, 0.46, 0);
    b.add(
      new THREE.Mesh(
        juntar([
          new THREE.CapsuleGeometry(0.075, 0.42, 4, 8).translate(0, -0.25, 0),
          new THREE.SphereGeometry(0.08, 8, 6).scale(1.1, 0.6, 1.2).translate(0, -0.5, 0),
        ]),
        tela,
      ),
    );
    torso.add(b);
    return b;
  };
  const derecho = brazo(1);
  const izquierdo = brazo(-1);
  const cigarro = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6).rotateX(Math.PI / 2).translate(0, -0.52, 0.06),
    claro,
  );
  derecho.add(cigarro);
  grupo.add(torso);
  // El humo del cigarro: bolitas que suben y se deshacen
  const humo = new THREE.MeshBasicMaterial({
    name: "humo",
    color: COLORES.niebla,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const bocanadas = Array.from({ length: 5 }, () => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), humo);
    grupo.add(b);
    return b;
  });

  /** Lo pone como está: esperando (inclinado hacia adelante, la mano estirada) o contento (echado para atrás,
   * fumando). `t`: los segundos, para el vaivén y el humo. */
  const posar = (contento: boolean, t: number) => {
    const vaiven = Math.sin(t * 1.6);
    torso.rotation.x = contento ? -0.22 + 0.03 * vaiven : 0.12;
    cabeza.rotation.set(contento ? -0.2 : 0.05 * vaiven, contento ? 0 : 0.1 * Math.sin(t * 0.7), 0);
    if (contento) {
      derecho.rotation.set(-2.2 + 0.15 * Math.max(0, Math.sin(t * 0.9)), 0, -0.5);
      izquierdo.rotation.set(-0.5, 0, 0.3);
    } else {
      // La palma para arriba, hacia donde mira
      derecho.rotation.set(-1.25 + 0.06 * vaiven, 0, 0.05);
      izquierdo.rotation.set(-0.35, 0, 0.15);
    }
    cigarro.visible = contento;
    bocanadas.forEach((b, i) => {
      b.visible = contento;
      if (!contento) return;
      const f = (t * 0.5 + i / bocanadas.length) % 1;
      b.position.set(0.12 + f * 0.15, 1.55 + f * 0.9, 0.3 - f * 0.1);
      b.scale.setScalar(0.6 + f * 2.2);
    });
    humo.opacity = 0.45;
  };
  posar(false, 0);
  return { grupo, posar };
}

/** El banco de piedra del Tío, con su ofrenda de siempre: hojas de coca regadas al pie. */
function crearAltar(): THREE.Group {
  const grupo = new THREE.Group();
  const piedra = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(0.9, 0.5, 0.6).translate(0, 0.25, -0.05),
        new THREE.BoxGeometry(1.1, 0.08, 0.8).translate(0, 0.04, 0.05),
      ]),
      piedra,
    ),
  );
  const hojas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const x = -0.5 + ((i * 0.6180339) % 1);
    const z = 0.45 + ((i * 0.4142135) % 1) * 0.35;
    hojas.push(new THREE.SphereGeometry(0.035, 6, 4).scale(1, 0.2, 0.55).rotateY(i).translate(x, 0.09, z));
  }
  grupo.add(new THREE.Mesh(juntar(hojas), materialTela(COLORES.silueta, { repetir: 1, pelusa: false })));
  return grupo;
}
