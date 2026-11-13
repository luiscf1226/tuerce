// El Curupira (TU-49): el guardián del bosque amazónico, un niño flaco de pelo parado como llama, con los pies al
// revés: sus huellas apuntan para el lado de donde viene, y así pierde a los que entran a hacerle daño a la selva.
// Sale de un nodo `tipo: pieza, pieza: curupira`; su caja dice dónde está (los pies en el medio de la base) y hacia
// dónde mira (su frente); su alto es lo que mide. No choca con nada.
//
// Lo que hace lo decide el guion:
//   · `reir()`: se ríe del que siguió sus huellas para el lado equivocado y se perdió (se echa para atrás, se agarra
//     la panza y se sacude). Después vuelve a lo que estaba haciendo.
//   · `pedir(donde)`: pide el árbol: se inclina hacia adelante y señala con el brazo.
//   · `alegrar()`: le plantaron el árbol y queda contento para siempre: baila de lado y salta con los brazos arriba.
//   · `mudarse(donde, rumbo)` y `esconder()`: aparece en otro lado del bosque o se va.
//
// Es un cuerpo cinemático sin choques que mueve esta pieza a paso fijo, sin azar. Viaja en la foto de la red: el
// invitado sabe qué hace por cómo lo ve inclinado (para atrás se ríe, para adelante pide, de costado baila) y si
// está escondido por su altura.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { juntar, materialOjo } from "../imagen";
import { PASO } from "../motor/bucle";
import type { PiezaDeLaMedianocheEnPlano } from "./formato-medianoche";
import type { Herramientas } from "./piezas";
import { ESCONDIDO } from "./piezas-canales";

export type EstadoCurupira = "mirando" | "riendo" | "pidiendo" | "contento" | "escondido";

export interface Curupira {
  readonly cual: "curupira";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Lo que está haciendo (también en el invitado, que lo ve inclinado). */
  readonly estado: EstadoCurupira;
  /** Cuántas veces se rió de alguien. */
  readonly risas: number;
  /** Se ríe un rato del que se perdió. */
  reir(): void;
  /** Pide el árbol: mira hacia `donde` y lo señala. */
  pedir(donde: THREE.Vector3Like): void;
  /** Le plantaron el árbol: queda contento para siempre. */
  alegrar(): void;
  /** Aparece parado en `donde` (los pies), mirando hacia `rumbo` (radianes alrededor de +y). */
  mudarse(donde: THREE.Vector3Like, rumbo: number): void;
  /** Se va: no se ve hasta que se mude otra vez. */
  esconder(): void;
  /** Llama a `aviso` cada vez que se ríe. Devuelve cómo dejar de escuchar. */
  alReir(aviso: () => void): () => void;
}

/** Los números del Curupira que no se ponen desde Blender. */
export const AJUSTES_CURUPIRA = {
  /** Cuánto se inclina en cada estado (radianes; positivo, hacia adelante), y cómo se sacude riendo. */
  riendo: { inclinar: -0.32, sacudir: 0.06, ritmo: 2.2 },
  pidiendo: { inclinar: 0.14, mecer: 0.02 },
  /** Contento baila de lado (radianes) y salta (m). */
  contento: { lado: 0.16, mecer: 0.09, ritmo: 1, salto: 0.14 },
  /** El invitado lo ve reírse con menos de esto hacia adelante, pedir con más, y bailar de costado con más de esto. */
  vistaRie: -0.12,
  vistaPide: 0.07,
  vistaBaila: 0.05,
} as const;

const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const ARRIBA = new THREE.Vector3(0, 1, 0);

export function armarCurupira(h: Herramientas, p: Extract<PiezaDeLaMedianocheEnPlano, { cual: "curupira" }>): Curupira {
  const { rapier, mundo } = h;
  const a = AJUSTES_CURUPIRA;
  const { medio, giro } = p.caja;
  const alto = medio.y * 2;
  const pie = h.enElMundo(p, 0, -medio.y, 0);
  const frente = EJE_Z.clone().applyQuaternion(giro);
  let rumbo = Math.atan2(frente.x, frente.z);
  const lugar = pie.clone();

  /** Su giro: mirando hacia `rumbo`, inclinado `adelante` y `costado` (radianes). */
  const pose = (adelante: number, costado: number) =>
    new THREE.Quaternion()
      .setFromAxisAngle(ARRIBA, rumbo)
      .multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, adelante))
      .multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, costado));

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pie.x, pie.y, pie.z).setRotation(pose(0, 0)),
  );
  // Sin choques: está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(alto / 2, 0.2)
      .setTranslation(0, alto / 2, 0)
      .setSensor(true)
      .setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenCurupira(h.oscuro, alto);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let estado: EstadoCurupira = "mirando";
  /** Lo que hacía antes de reírse, para volver a eso. */
  let antesDeReir: EstadoCurupira = "mirando";
  let riendo = 0;
  let risas = 0;
  let pasos = 0;
  let simulado = false;
  let visto: EstadoCurupira = "mirando";
  const avisos = new Set<() => void>();

  const ubicar = (deUna: boolean) => {
    const t = pasos * PASO;
    let adelante = 0.02 * Math.sin(t * 1.3);
    let costado = 0;
    let y = 0;
    if (estado === "riendo")
      adelante = a.riendo.inclinar + a.riendo.sacudir * Math.sin(t * a.riendo.ritmo * Math.PI * 2);
    else if (estado === "pidiendo") adelante = a.pidiendo.inclinar + a.pidiendo.mecer * Math.sin(t * 2);
    else if (estado === "contento") {
      const fase = t * a.contento.ritmo * Math.PI * 2;
      costado = a.contento.lado + a.contento.mecer * Math.sin(fase);
      y = a.contento.salto * Math.abs(Math.sin(fase * 2));
    }
    const donde =
      estado === "escondido" ? { x: lugar.x, y: ESCONDIDO, z: lugar.z } : { x: lugar.x, y: lugar.y + y, z: lugar.z };
    const giroAhora = pose(adelante, costado);
    if (deUna) {
      cuerpo.setTranslation(donde, true);
      cuerpo.setRotation(giroAhora, true);
    } else {
      cuerpo.setNextKinematicTranslation(donde);
      cuerpo.setNextKinematicRotation(giroAhora);
    }
  };

  h.antes(() => {
    pasos++;
    if (estado === "riendo") {
      riendo -= PASO;
      if (riendo <= 0) estado = antesDeReir;
    }
    ubicar(false);
  });
  h.despues(() => {
    simulado = true;
  });

  // Lo que se ve: el estado sale del cuerpo como llegó (en el anfitrión es el mismo que decidió)
  const arriba = new THREE.Vector3();
  const adelanteVisto = new THREE.Vector3();
  const costadoVisto = new THREE.Vector3();
  h.guardar(() => {
    const t = cuerpo.translation();
    if (t.y < ESCONDIDO / 2) {
      visto = "escondido";
      return;
    }
    const q = new THREE.Quaternion().copy(cuerpo.rotation());
    arriba.copy(ARRIBA).applyQuaternion(q);
    const f = EJE_Z.clone().applyQuaternion(q);
    const r = Math.atan2(f.x, f.z);
    adelanteVisto.set(Math.sin(r), 0, Math.cos(r));
    costadoVisto.set(Math.cos(r), 0, -Math.sin(r));
    const inclinado = arriba.dot(adelanteVisto);
    const deLado = arriba.dot(costadoVisto);
    visto =
      inclinado < a.vistaRie
        ? "riendo"
        : inclinado > a.vistaPide
          ? "pidiendo"
          : Math.abs(deLado) > a.vistaBaila
            ? "contento"
            : "mirando";
  });
  let cuadro = 0;
  h.dibujar(() => {
    cuadro++;
    imagen.posar(visto, cuadro);
  });

  return {
    cual: "curupira",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return simulado ? estado : visto;
    },
    get risas() {
      return risas;
    },
    reir() {
      if (estado === "escondido") return;
      if (estado !== "riendo") antesDeReir = estado;
      estado = "riendo";
      riendo = p.reir;
      risas++;
      for (const aviso of avisos) aviso();
    },
    pedir(donde) {
      rumbo = Math.atan2(donde.x - lugar.x, donde.z - lugar.z);
      if (estado === "riendo") antesDeReir = "pidiendo";
      else estado = "pidiendo";
      ubicar(true);
    },
    alegrar() {
      estado = "contento";
      antesDeReir = "contento";
      ubicar(true);
    },
    mudarse(donde, nuevoRumbo) {
      lugar.set(donde.x, donde.y, donde.z);
      rumbo = nuevoRumbo;
      if (estado === "escondido") estado = "mirando";
      ubicar(true);
    },
    esconder() {
      estado = "escondido";
      ubicar(true);
    },
    alReir(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** El Curupira: piernas flacas con los pies al revés (los dedos hacia atrás), la panza, los brazos largos que se
 * mueven según lo que hace, y el pelo parado como una llama. Los ojos, los dos puntos blancos de siempre. En su
 * marco, los pies en y = 0, mirando hacia +z. */
function crearImagenCurupira(oscuro: THREE.Material, alto: number) {
  const grupo = new THREE.Group();
  const h = alto;
  const cuerpo: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    cuerpo.push(new THREE.CylinderGeometry(0.035 * h, 0.03 * h, 0.42 * h, 6).translate(s * 0.07 * h, 0.21 * h, 0));
    // Los pies al revés: el talón adelante y los dedos atrás
    cuerpo.push(new THREE.BoxGeometry(0.07 * h, 0.04 * h, 0.17 * h).translate(s * 0.07 * h, 0.02 * h, -0.06 * h));
    for (let d = 0; d < 3; d++)
      cuerpo.push(
        new THREE.SphereGeometry(0.014 * h, 5, 4).translate(s * 0.07 * h + (d - 1) * 0.022 * h, 0.02 * h, -0.15 * h),
      );
  }
  cuerpo.push(new THREE.SphereGeometry(0.15 * h, 10, 8).scale(1, 1.2, 0.85).translate(0, 0.58 * h, 0));
  grupo.add(new THREE.Mesh(juntar(cuerpo), oscuro));

  // La cabeza, con el pelo de llama y los ojos: se echa para atrás al reírse
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.8 * h, 0);
  const pelo: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.11 * h, 10, 8)];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const largo = (0.16 + 0.07 * ((i * 5) % 3)) * h;
    pelo.push(
      new THREE.ConeGeometry(0.035 * h, largo, 5)
        .translate(0, largo / 2, 0)
        .rotateX(-0.35 - 0.25 * Math.cos(a))
        .rotateZ(0.5 * Math.sin(a))
        .translate(Math.sin(a) * 0.05 * h, 0.06 * h, Math.cos(a) * 0.03 * h - 0.03 * h),
    );
  }
  cabeza.add(new THREE.Mesh(juntar(pelo), oscuro));
  const ojos = juntar(
    [-1, 1].map((s) => new THREE.SphereGeometry(0.018 * h, 8, 6).translate(s * 0.04 * h, 0.01 * h, 0.1 * h)),
  );
  cabeza.add(new THREE.Mesh(ojos, materialOjo()));
  grupo.add(cabeza);

  // Los brazos: cuelgan de los hombros
  const brazos = [-1, 1].map((s) => {
    const hombro = new THREE.Group();
    hombro.position.set(s * 0.14 * h, 0.7 * h, 0);
    hombro.add(
      new THREE.Mesh(
        juntar([
          new THREE.CylinderGeometry(0.025 * h, 0.02 * h, 0.36 * h, 5).translate(0, -0.18 * h, 0),
          new THREE.SphereGeometry(0.03 * h, 6, 5).translate(0, -0.37 * h, 0),
        ]),
        oscuro,
      ),
    );
    grupo.add(hombro);
    return hombro;
  });

  return {
    grupo,
    /** Mueve los brazos y la cabeza según lo que hace. `cuadro` cuenta los dibujos, para que se sacuda. */
    posar(estado: EstadoCurupira, cuadro: number) {
      grupo.visible = estado !== "escondido";
      const [izquierdo, derecho] = brazos;
      if (!izquierdo || !derecho) return;
      const t = cuadro / 60;
      cabeza.rotation.set(0, 0, 0);
      if (estado === "riendo") {
        // Las manos a la panza y la cabeza para atrás
        izquierdo.rotation.set(-1.1, 0, 0.6 + 0.1 * Math.sin(t * 20));
        derecho.rotation.set(-1.1, 0, -0.6 - 0.1 * Math.sin(t * 20));
        cabeza.rotation.x = -0.35;
      } else if (estado === "pidiendo") {
        // Señala con la derecha hacia adelante, donde va el árbol
        izquierdo.rotation.set(0, 0, -0.15);
        derecho.rotation.set(-1.5 + 0.08 * Math.sin(t * 3), 0, 0.1);
      } else if (estado === "contento") {
        izquierdo.rotation.set(-0.3, 0, -2.6 + 0.3 * Math.sin(t * 9));
        derecho.rotation.set(-0.3, 0, 2.6 - 0.3 * Math.sin(t * 9 + 1));
        cabeza.rotation.z = 0.15 * Math.sin(t * 6);
      } else {
        izquierdo.rotation.set(0, 0, -0.15);
        derecho.rotation.set(0, 0, 0.15);
      }
    },
  };
}
