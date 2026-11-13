// El Sisimite (TU-28): un gigante peludo y torpe con los pies al revés, dormido boca arriba en el cañón del Río
// Plátano. Sale de un nodo `tipo: pieza, pieza: sisimite`; su caja es su cama: está acostado a lo largo de su lado
// más largo, con los pies en la punta − y la cabeza hacia la +. No se lo rodea: se lo trepa como a un cerro.
//
//   · Dormido, respira: sube y baja apenas.
//   · Se despierta si alguien le cae encima de lo alto (más rápido que `aterrizaje`: un salto no, una caída sí) o le
//     pisa la cara. Abre los ojos, se revuelve un rato (`revolverse`): se alza, se sacude y tumba a los que tiene
//     encima (no hay derrota), y se vuelve a dormir.
//
// Su forma, para treparlo (de los pies a la cabeza): los pies (1 m) y las canillas (1.25 m más), que se trepan
// colgándose; después, caminando, las rodillas (2.3 m), los muslos en bajada, la panza en subida y el pecho (2.6 m,
// la cumbre). Del pecho se baja por el hombro y el brazo que tiene
// estirado por encima de la cabeza, en escalones de 40 cm, sin tocarle la cara. Todo en un cañón de 3.4 m de ancho
// (las medidas se escalan con su caja).
//
// Es un cuerpo cinemático que mueve esta pieza a paso fijo, sin azar. Viaja en la foto de la red: el invitado sabe
// que tiene los ojos abiertos porque lo ve alzado.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelRioEnPlano } from "./formato-rio";
import type { Herramientas } from "./piezas";

export type EstadoSisimite = "dormido" | "despierto";

export interface Sisimite {
  readonly cual: "sisimite";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoSisimite;
  /** Si tiene los ojos abiertos (también en el invitado, que lo ve alzado). */
  readonly ojos: boolean;
  /** Cuántas veces se despertó. */
  readonly despertares: number;
  /** Si ese punto (una pelvis) está encima de él, de pie. */
  encima(p: THREE.Vector3Like): boolean;
  /** Llama a `aviso` cada vez que se despierta, con quién lo despertó. Devuelve cómo dejar de escuchar. */
  alDespertar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Lo deja dormido y quieto (al retomar en otro punto). */
  volver(): void;
}

/** Los números del Sisimite que no se ponen desde Blender. */
export const AJUSTES_SISIMITE = {
  /** Las medidas de su forma: para una caja de 12 × 2.6 × 3.4 m (se escalan con la caja). */
  medida: { largo: 12, alto: 2.6, ancho: 3.4 },
  /** Respirar: cuánto sube y baja (m) y cada cuánto (s). */
  respirar: { alto: 0.03, periodo: 4.2 },
  /** Despierto: cuánto se alza (m), cuánto se sacude de costado (radianes) y qué tan rápido. */
  alzarse: 0.25,
  sacudir: { angulo: 0.07, ritmo: 8 },
  /** Alzado más que esto (m) tiene los ojos abiertos: así lo sabe el invitado. */
  ojos: 0.12,
  /** Cuánto para arriba salen los que tumba (m/s). */
  arriba: 1.5,
  /** De pie encima de él: la pelvis entre tanto y tanto sobre su forma (m). Cayendo, más cerca que `cerca`. */
  encima: [0.1, 1.2],
  cerca: 0.8,
  /** Encima de la cabeza, más arriba que esto, ya le pisó la cara (m, de la forma). */
  cara: 1.6,
} as const;

/** Una parte de su forma, en las medidas de una caja de 12 × 2.6 × 3.4 m: de `u0` a `u1` a lo largo (de los pies a
 * la cabeza), de `w0` a `w1` de costado (+ hacia el +z de su caja), con la cara de arriba de `de` a `a` de alto. */
interface Parte {
  readonly u: readonly [number, number];
  readonly w: readonly [number, number];
  readonly de: number;
  readonly a: number;
}
const ANCHO = [-1.5, 1.5] as const;
const BRAZO = [-1.6, -0.3] as const;
export const CABEZA = { u: [8.4, 10.2], w: [-0.3, 1.5], arriba: 2.0 } as const;
const FORMA: readonly Parte[] = [
  { u: [0, 1], w: ANCHO, de: 1, a: 1 }, // los pies
  { u: [1, 3.2], w: ANCHO, de: 2.25, a: 2.3 }, // las canillas, hasta las rodillas
  { u: [3.2, 5], w: ANCHO, de: 2.3, a: 1.9 }, // los muslos, en bajada
  { u: [5, 6.4], w: ANCHO, de: 1.9, a: 2.3 }, // la panza, en subida
  { u: [6.4, 7.2], w: ANCHO, de: 2.3, a: 2.6 }, // el pecho
  { u: [7.2, 8.4], w: ANCHO, de: 2.6, a: 2.6 }, // la cumbre
  { u: [8.4, 9.2], w: BRAZO, de: 2.2, a: 2.2 }, // el hombro
  { u: [9.2, 10.2], w: BRAZO, de: 1.8, a: 1.8 }, // el brazo
  { u: [10.2, 11.2], w: BRAZO, de: 1.4, a: 1.4 }, // el antebrazo
  { u: [11.2, 12], w: BRAZO, de: 1, a: 1 }, // la mano
  { u: CABEZA.u, w: CABEZA.w, de: CABEZA.arriba, a: CABEZA.arriba }, // la cabeza
];

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** La altura de su forma en (u, w), en las medidas de siempre, o 0 si ahí no hay nada (el suelo). */
export function alturaDelSisimite(u: number, w: number): number {
  let alto = 0;
  for (const p of FORMA) {
    if (u < p.u[0] || u > p.u[1] || w < p.w[0] || w > p.w[1]) continue;
    alto = Math.max(alto, p.de + ((p.a - p.de) * (u - p.u[0])) / (p.u[1] - p.u[0]));
  }
  return alto;
}

export function armarSisimite(h: Herramientas, p: Extract<PiezaDelRioEnPlano, { cual: "sisimite" }>): Sisimite {
  const { rapier, mundo } = h;
  const a = AJUSTES_SISIMITE;
  const { centro, medio } = p.caja;
  const enX = medio.x >= medio.z;
  const giro = p.caja.giro
    .clone()
    .multiply(enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2));
  const mitad = enX ? medio.x : medio.z;
  const medioAncho = enX ? medio.z : medio.x;
  const escala = new THREE.Vector3(
    (mitad * 2) / a.medida.largo,
    (medio.y * 2) / a.medida.alto,
    (medioAncho * 2) / a.medida.ancho,
  );
  const base = centro.y - medio.y;
  const casa = new THREE.Vector3(centro.x, base, centro.z);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(casa.x, casa.y, casa.z).setRotation(giro),
  );
  // Su forma: una caja por parte (las de bajada o subida, giradas, con otra debajo que la rellena)
  let primero: RAPIER.Collider | undefined;
  const local = (u: number, y: number, w: number) =>
    new THREE.Vector3(u * escala.x - mitad, y * escala.y, w * escala.z);
  for (const parte of FORMA) {
    const [u0, u1] = parte.u;
    const [w0, w1] = parte.w;
    const medioZ = ((w1 - w0) / 2) * escala.z;
    const centroW = (w0 + w1) / 2;
    if (parte.de === parte.a) {
      const c = mundo.createCollider(
        rapier.ColliderDesc.cuboid(((u1 - u0) / 2) * escala.x, (parte.a / 2) * escala.y, medioZ)
          .setTranslation(...local((u0 + u1) / 2, parte.a / 2, centroW).toArray())
          .setFriction(1),
        cuerpo,
      );
      primero ??= c;
      continue;
    }
    const p0 = local(u0, parte.de, centroW);
    const p1 = local(u1, parte.a, centroW);
    const angulo = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const grueso = 0.4;
    const medioCentro = p0.clone().add(p1).multiplyScalar(0.5);
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(p0.distanceTo(p1) / 2, grueso / 2, medioZ)
        .setTranslation(
          medioCentro.x + (Math.sin(angulo) * grueso) / 2,
          medioCentro.y - (Math.cos(angulo) * grueso) / 2,
          medioCentro.z,
        )
        .setRotation(new THREE.Quaternion().setFromAxisAngle(EJE_Z, angulo))
        .setFriction(1),
      cuerpo,
    );
    const relleno = Math.min(parte.de, parte.a) - 0.25;
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(((u1 - u0) / 2) * escala.x, (relleno / 2) * escala.y, medioZ)
        .setTranslation(...local((u0 + u1) / 2, relleno / 2, centroW).toArray())
        .setFriction(1),
      cuerpo,
    );
  }
  const imagen = crearImagenSisimite();
  const grupo = new THREE.Group();
  grupo.name = p.nombre;
  imagen.grupo.position.x = -mitad;
  imagen.grupo.scale.copy(escala);
  grupo.add(imagen.grupo);
  h.mover(cuerpo, grupo);
  if (primero) h.solida({ nombre: p.nombre, objeto: grupo, cuerpo, colisionador: primero });

  const giroInverso = giro.clone().invert();
  /** El punto en sus medidas de siempre: u a lo largo (de los pies), y alto sobre la base y w de costado. */
  const enSusMedidas = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    const l = new THREE.Vector3(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroInverso);
    return { u: (l.x + mitad) / escala.x, y: l.y / escala.y, w: l.z / escala.z };
  };
  /** Cuánto está la pelvis sobre su forma (m), o `null` si no está encima. */
  const sobre = (q: THREE.Vector3Like) => {
    const m = enSusMedidas(q);
    const alto = alturaDelSisimite(m.u, m.w);
    return alto > 0 ? (m.y - alto) * escala.y : null;
  };
  const encima = (q: THREE.Vector3Like) => {
    const s = sobre(q);
    return s !== null && s > a.encima[0] && s < a.encima[1];
  };
  const enLaCara = (q: THREE.Vector3Like) => {
    const m = enSusMedidas(q);
    return (
      m.u > CABEZA.u[0] && m.u < CABEZA.u[1] && m.w > CABEZA.w[0] && m.w < CABEZA.w[1] && m.y > CABEZA.arriba - 0.4
    );
  };

  let estado: EstadoSisimite = "dormido";
  let despierto = 0;
  let pasos = 0;
  let despertares = 0;
  const avisos = new Set<(jugador: 0 | 1) => void>();

  /** Se despierta: abre los ojos y tumba a los que tiene encima, hacia afuera de su cuerpo. */
  const despertar = (jugador: 0 | 1, munecos: readonly Muneco[]) => {
    estado = "despierto";
    despierto = 0;
    despertares++;
    for (const m of munecos) {
      const t = m.partes.pelvis.translation();
      const s = sobre(t);
      if (s === null || s > a.encima[1] + 0.3) continue;
      const lado = enSusMedidas(t).w >= 0 ? 1 : -1;
      const afuera = EJE_Z.clone()
        .applyQuaternion(giro)
        .multiplyScalar(lado * p.empujon);
      for (const parte of Object.values(m.partes)) {
        const masa = parte.mass();
        parte.applyImpulse({ x: afuera.x * masa, y: a.arriba * masa, z: afuera.z * masa }, true);
      }
    }
    for (const aviso of avisos) aviso(jugador);
  };

  h.antes(() => {
    pasos++;
    const t = pasos * PASO;
    let alto = a.respirar.alto * Math.sin((t * 2 * Math.PI) / a.respirar.periodo);
    let sacudida = 0;
    if (estado === "despierto") {
      despierto += PASO;
      const f = despierto / p.revolverse;
      const cuanto = limitar(Math.min(f * 6, (1 - f) * 6), 0, 1);
      alto = a.alzarse * cuanto;
      sacudida = a.sacudir.angulo * cuanto * Math.sin(despierto * a.sacudir.ritmo);
      if (f >= 1) estado = "dormido";
    }
    cuerpo.setNextKinematicTranslation({ x: casa.x, y: casa.y + alto, z: casa.z });
    cuerpo.setNextKinematicRotation(giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, sacudida)));
  });

  // Quién lo despierta: cayéndole encima de lo alto, o pisándole la cara (después de cada paso, en el anfitrión)
  h.despues((munecos) => {
    if (estado === "despierto") return;
    for (const jugador of [0, 1] as const) {
      const m = munecos[jugador];
      if (!m) continue;
      const pelvis = m.partes.pelvis;
      const t = pelvis.translation();
      const s = sobre(t);
      const cayendo = s !== null && s < a.cerca && pelvis.linvel().y < -p.aterrizaje;
      if (cayendo || enLaCara(t)) {
        despertar(jugador, munecos);
        return;
      }
    }
  });

  // Los ojos, con lo alzado que está (también en el invitado)
  let ojos = false;
  h.guardar(() => {
    ojos = cuerpo.translation().y - casa.y > a.ojos;
  });
  h.dibujar(() => imagen.ojos(ojos));

  return {
    cual: "sisimite",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get ojos() {
      return ojos;
    },
    get despertares() {
      return despertares;
    },
    encima,
    alDespertar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      estado = "dormido";
      despierto = 0;
      cuerpo.setTranslation(casa, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setNextKinematicTranslation(casa);
      cuerpo.setNextKinematicRotation(giro);
    },
  };
}

/** El Sisimite, acostado boca arriba en sus medidas de siempre: u a lo largo por +x (de los pies, en 0, a la mano
 * estirada, en 12), alto por +y y de costado por +z. Todo de pelo negro: las piernas dobladas con los pies al revés
 * (los talones afuera y los dedos hacia adentro), la panza, el pecho, la cabeza greñuda con barba, un brazo por
 * encima de la cabeza y el otro a lo largo del cuerpo. Los ojos, cerrados (no se ven) o abiertos (blancos). */
function crearImagenSisimite() {
  const pelo = materialTela(COLORES.siluetaHonda, { repetir: 3, relieve: 6 });
  const grupo = new THREE.Group();
  const azar = crearAzar(28);
  const partes: THREE.BufferGeometry[] = [];
  const v = (u: number, y: number, w: number) => new THREE.Vector3(u, y, w);
  /** Una cápsula de `a` a `b`. */
  const capsula = (a: THREE.Vector3, b: THREE.Vector3, radio: number) => {
    const largo = a.distanceTo(b);
    const g = new THREE.CapsuleGeometry(radio, largo, 6, 14);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const bola = (c: THREE.Vector3, r: THREE.Vector3Like) =>
    new THREE.SphereGeometry(1, 16, 12).scale(r.x, r.y, r.z).translate(c.x, c.y, c.z);

  for (const lado of [-0.75, 0.75]) {
    // El pie al revés: el talón hacia afuera (u 0) y los dedos hacia adentro, contra la canilla
    partes.push(bola(v(0.5, 0.45, lado), { x: 0.55, y: 0.5, z: 0.5 }));
    partes.push(bola(v(0.22, 0.7, lado), { x: 0.3, y: 0.32, z: 0.38 }));
    for (let i = 0; i < 5; i++)
      partes.push(bola(v(1.0, 0.16 + 0.03 * i, lado + (i - 2) * 0.17), { x: 0.13, y: 0.12, z: 0.09 }));
    // La canilla, del tobillo a la rodilla, y el muslo, de la rodilla a la cadera
    partes.push(capsula(v(0.7, 0.6, lado), v(1.2, 1.6, lado), 0.42));
    partes.push(capsula(v(1.3, 1.7, lado), v(2.9, 1.75, lado), 0.55));
    partes.push(capsula(v(2.9, 1.7, lado), v(5.2, 1.0, lado * 0.85), 0.6));
  }
  // La panza y el pecho
  partes.push(bola(v(6.6, 1.1, 0), { x: 2.1, y: 1.25, z: 1.55 }));
  partes.push(bola(v(7.7, 1.45, 0), { x: 1.1, y: 1.15, z: 1.45 }));
  // La cabeza (de cara al cielo), la nariz y la barba sobre el pecho
  partes.push(bola(v(9.3, 1.1, 0.6), { x: 0.95, y: 0.9, z: 0.85 }));
  partes.push(bola(v(9.55, 1.95, 0.6), { x: 0.16, y: 0.14, z: 0.12 }));
  partes.push(bola(v(8.6, 1.5, 0.6), { x: 0.5, y: 0.45, z: 0.55 }));
  // El brazo estirado por encima de la cabeza (del lado −), con la mano abierta en el suelo
  partes.push(capsula(v(8.3, 1.75, -1.0), v(10.0, 1.35, -1.0), 0.45));
  partes.push(capsula(v(10.0, 1.0, -1.0), v(11.3, 0.95, -1.0), 0.4));
  partes.push(bola(v(11.65, 0.5, -1.0), { x: 0.48, y: 0.45, z: 0.55 }));
  for (let i = 0; i < 4; i++) partes.push(capsula(v(11.9, 0.2, -1.3 + i * 0.2), v(12.0, 0.15, -1.35 + i * 0.24), 0.08));
  // El otro brazo, a lo largo del cuerpo, con la mano junto a la cadera
  partes.push(capsula(v(8.0, 1.3, 1.45), v(5.2, 0.5, 1.6), 0.42));
  // Mechones: matas de pelo aplastadas por todo el cuerpo (despeinado), y una greña larga alrededor de la cabeza,
  // regada en el suelo
  for (let i = 0; i < 90; i++) {
    const u = 0.6 + azar() * 8.2;
    const w = (azar() - 0.5) * 2.8;
    const y = Math.max(0.3, alturaDelSisimite(u, w) - 0.22);
    const largo = 0.3 + azar() * 0.35;
    partes.push(
      new THREE.ConeGeometry(0.16, largo, 5)
        .rotateZ(-Math.PI / 2 + 0.35)
        .translate(largo / 2, 0, 0)
        .rotateY(azar() * Math.PI * 2)
        .translate(u, y + 0.1, w),
    );
  }
  for (let i = 0; i < 26; i++) {
    const angulo = (i / 26) * Math.PI * 2;
    const largo = 0.6 + azar() * 0.5;
    partes.push(
      new THREE.ConeGeometry(0.12, largo, 4)
        .rotateZ(-Math.PI / 2)
        .translate(largo / 2 + 0.75, 0, 0)
        .rotateY(angulo)
        .translate(9.3, 0.35 + 0.3 * azar(), 0.6),
    );
  }
  grupo.add(new THREE.Mesh(juntar(partes), pelo));
  // Los ojos: dos puntos blancos, como los de los muñecos, que se ven solo abiertos
  const ojos = new THREE.Mesh(
    juntar(
      [-1, 1].map((l) => new THREE.SphereGeometry(0.11, 10, 8).scale(1, 0.6, 1).translate(9.6, 1.86, 0.6 + l * 0.3)),
    ),
    materialOjo(),
  );
  ojos.visible = false;
  grupo.add(ojos);
  return {
    grupo,
    ojos(abiertos: boolean) {
      ojos.visible = abiertos;
    },
  };
}

/** La huella de un pie del Sisimite (casi 1 m de largo, con los cinco dedos hacia +z): plana y oscura. */
export function crearHuella(): THREE.Mesh {
  // La planta: el talón angosto y la parte de adelante ancha, y los cinco dedos separados (el gordo más grande)
  const g: THREE.BufferGeometry[] = [
    new THREE.CircleGeometry(0.14, 14).scale(1, 1.4, 1).translate(0, -0.26, 0),
    new THREE.CircleGeometry(0.12, 12).scale(1, 1.6, 1).translate(0.01, -0.05, 0),
    new THREE.CircleGeometry(0.2, 16).scale(1, 0.85, 1).translate(0.02, 0.15, 0),
  ];
  const dedos = [
    [-0.15, 0.36, 0.075],
    [-0.04, 0.42, 0.06],
    [0.06, 0.41, 0.055],
    [0.14, 0.37, 0.05],
    [0.21, 0.31, 0.045],
  ] as const;
  for (const [x, y, r] of dedos) g.push(new THREE.CircleGeometry(r, 10).translate(x, y, 0));
  const malla = new THREE.Mesh(
    juntar(g)
      .rotateX(-Math.PI / 2)
      .rotateY(Math.PI),
    // De las dos caras: el pie izquierdo es el derecho al espejo
    new THREE.MeshStandardMaterial({
      name: "huella",
      color: COLORES.siluetaLejana,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  malla.name = "huella";
  return malla;
}

/** La figura de jade del secreto: un señor sentado con las piernas cruzadas, un tocado alto y las manos en las
 * rodillas (35 cm). Sin color nuevo: clara y pulida, la única cosa que brilla en la ciudad perdida, con su luz. */
export function crearFiguraDeJade(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "figura de jade";
  const pulida = new THREE.MeshStandardMaterial({
    name: "jade",
    color: COLORES.ojo,
    roughness: 0.15,
    metalness: 0.2,
    emissive: COLORES.siluetaLejana,
    emissiveIntensity: 0.5,
  });
  const forma = juntar([
    new THREE.BoxGeometry(0.26, 0.07, 0.18).translate(0, 0.035, 0),
    new THREE.CylinderGeometry(0.07, 0.09, 0.14, 8).translate(0, 0.14, 0),
    new THREE.BoxGeometry(0.15, 0.13, 0.12).translate(0, 0.27, 0.01),
    new THREE.BoxGeometry(0.17, 0.06, 0.13).translate(0, 0.36, 0),
    new THREE.BoxGeometry(0.06, 0.03, 0.03).translate(0, 0.27, 0.075),
    ...[-1, 1].map((l) => new THREE.BoxGeometry(0.035, 0.08, 0.05).translate(l * 0.085, 0.27, 0)),
  ]);
  grupo.add(new THREE.Mesh(forma, pulida));
  const brillo = new THREE.PointLight(COLORES.ojo, 1.4, 2, 2);
  brillo.position.set(0, 0.3, 0.25);
  grupo.add(brillo);
  return grupo;
}
