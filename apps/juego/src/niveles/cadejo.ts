// El Cadejo (TU-14): un perrote negro que cuida su corral y persigue al muñeco más cercano para lamerlo. Sale de
// un nodo `tipo: pieza, pieza: cadejo`; su caja es el corral: anda por adentro, sobre la base de la caja, y no sale.
//
//   · Persigue al muñeco más cercano que esté adentro del corral (y de pie: al que ya está en el suelo no lo
//     molesta). Si lo alcanza lo lame: un empujón que lo tira como un trapo (no hay derrota) y se queda contento
//     un rato, quieto, moviendo la cola.
//   · Si hay un hueso suelto adentro del corral, se olvida de los muñecos: va hasta el hueso y lo roe un rato. Al
//     terminar, el hueso vuelve a su lugar (para tirárselo otra vez).
//   · Sin nadie a quien perseguir vuelve a su casa (el centro del corral) y se echa.
//
// Es un cuerpo cinemático sin choques: lo mueve esta pieza a paso fijo, sin azar, así que dos corridas iguales dan
// lo mismo. Como todo lo que se mueve, viaja en la foto de la red; el invitado no lo simula y lo anima con lo que
// anduvo (las patas, la cola, echado o parado).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelPinarEnPlano } from "./formato-pinar";
import type { Herramientas } from "./piezas";
import type { Hueso } from "./piezas-pinar";

export type EstadoCadejo = "echado" | "persiguiendo" | "al hueso" | "royendo" | "contento" | "volviendo";

export interface Cadejo {
  readonly cual: "cadejo";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoCadejo;
  /** Cuántas veces lamió a alguien. */
  readonly lamidas: number;
  /** A quién persigue (0 el rojo, 1 el turquesa), o `null`. */
  readonly persigue: 0 | 1 | null;
  /** Llama a `aviso` cada vez que lame a alguien (0 el rojo, 1 el turquesa). Devuelve cómo dejar de escuchar. */
  alLamer(aviso: (jugador: 0 | 1) => void): () => void;
  /** Lo lleva a su casa, echado (al retomar en otro punto). */
  volver(): void;
}

/** Los números del Cadejo que no se ponen desde Blender. */
export const AJUSTES_CADEJO = {
  /** Del centro del cuerpo a la trompa (m): mide lo que un muñeco de alto, de la cola a la trompa. */
  trompa: 0.6,
  /** Qué tan rápido gira (rad/s) y acelera (m/s²). */
  giro: 5,
  aceleracion: 7,
  /** Lo que se le queda adentro del borde del corral (m). */
  margen: 0.45,
  /** Cuánto para arriba sale el muñeco lamido (m/s). */
  arriba: 1.5,
  /** Cerca de esto del hueso (la trompa), ya lo tiene (m). */
  alcanzarHueso: 0.25,
  /** A esta distancia de su casa ya llegó (m). */
  enCasa: 0.3,
  /** La zancada: cuánto anda en un ciclo de las cuatro patas (m). */
  zancada: 1.1,
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function armarCadejo(h: Herramientas, p: Extract<PiezaDelPinarEnPlano, { cual: "cadejo" }>): Cadejo {
  const { rapier, mundo } = h;
  const a = AJUSTES_CADEJO;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const base = h.enElMundo(p, 0, -medio.y, 0).y;
  // Su casa: el centro del corral, mirando hacia el frente de la caja
  const casa = { x: centro.x, z: centro.z };
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboCasa = Math.atan2(frente.x, frente.z);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(casa.x, base, casa.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumboCasa)),
  );
  // Un colisionador sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setTranslation(0, 0.6, 0).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenCadejo();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  /** El punto en el marco del corral (sin la altura). */
  const local = new THREE.Vector3();
  const adentro = (q: THREE.Vector3Like, alto = 2.5) => {
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
    const y = q.y - base;
    return Math.abs(local.x) <= medio.x && Math.abs(local.z) <= medio.z && y > -0.6 && y < alto;
  };
  /** Lleva un punto del piso adentro del corral, con margen. */
  const encerrar = (x: number, z: number) => {
    local.set(x - centro.x, 0, z - centro.z).applyQuaternion(giroInverso);
    local.x = limitar(local.x, -medio.x + a.margen, medio.x - a.margen);
    local.z = limitar(local.z, -medio.z + a.margen, medio.z - a.margen);
    local.y = 0;
    local.applyQuaternion(giro);
    return { x: centro.x + local.x, z: centro.z + local.z };
  };

  let estado: EstadoCadejo = "echado";
  let pos = { x: casa.x, z: casa.z };
  let rumbo = rumboCasa;
  let rapidez = 0;
  let espera = 0;
  let lamidas = 0;
  let persigue: 0 | 1 | null = null;
  let roido: Hueso | null = null;
  const avisos = new Set<(jugador: 0 | 1) => void>();

  /** Corre hacia (x, z) y devuelve a cuánto quedó la trompa. */
  const correrHacia = (x: number, z: number) => {
    const trompaX = pos.x + Math.sin(rumbo) * a.trompa;
    const trompaZ = pos.z + Math.cos(rumbo) * a.trompa;
    const dx = x - pos.x;
    const dz = z - pos.z;
    const queda = Math.hypot(x - trompaX, z - trompaZ);
    const deseado = Math.atan2(dx, dz);
    const giroMax = a.giro * PASO;
    rumbo = envolver(rumbo + limitar(envolver(deseado - rumbo), -giroMax, giroMax));
    // Frena al llegar y para doblar cerrado (no da vueltas alrededor de lo que persigue)
    const derecho = Math.max(0, Math.cos(envolver(deseado - rumbo)));
    const objetivo = p.velocidad * derecho * limitar(queda / 0.6, 0.3, 1);
    rapidez += limitar(objetivo - rapidez, -a.aceleracion * PASO * 2, a.aceleracion * PASO);
    pos = encerrar(pos.x + Math.sin(rumbo) * rapidez * PASO, pos.z + Math.cos(rumbo) * rapidez * PASO);
    return queda;
  };
  const quedarse = () => {
    rapidez = Math.max(0, rapidez - a.aceleracion * 2 * PASO);
    pos = encerrar(pos.x + Math.sin(rumbo) * rapidez * PASO, pos.z + Math.cos(rumbo) * rapidez * PASO);
  };

  /** El hueso suelto más cercano adentro del corral (que no esté en su lugar, esperando que lo agarren). */
  const huesoSuelto = (): Hueso | null => {
    let mejor: Hueso | null = null;
    let distancia = Number.POSITIVE_INFINITY;
    for (const pieza of h.lista) {
      if (pieza.cual !== "hueso" || pieza.agarrado > 0 || pieza.enSuLugar) continue;
      const t = pieza.cuerpo.translation();
      if (!adentro(t, 1.2)) continue;
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < distancia) {
        distancia = d;
        mejor = pieza;
      }
    }
    return mejor;
  };

  /** El muñeco de pie más cercano adentro del corral. */
  const presa = (munecos: readonly Muneco[]) => {
    let mejor: { jugador: 0 | 1; muneco: Muneco } | null = null;
    let distancia = Number.POSITIVE_INFINITY;
    for (const jugador of [0, 1] as const) {
      const m = munecos[jugador];
      if (!m || m.estado === "caido" || m.estado === "levantandose") continue;
      const t = m.partes.pelvis.translation();
      if (!adentro(t)) continue;
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < distancia) {
        distancia = d;
        mejor = { jugador, muneco: m };
      }
    }
    return mejor;
  };

  /** La lamida: el muñeco sale volando de costado y para arriba, y se cae. */
  const lamer = (jugador: 0 | 1, m: Muneco) => {
    const t = m.partes.pelvis.translation();
    let dx = t.x - pos.x;
    let dz = t.z - pos.z;
    const largo = Math.hypot(dx, dz) || 1;
    dx /= largo;
    dz /= largo;
    for (const parte of Object.values(m.partes)) {
      const masa = parte.mass();
      parte.applyImpulse({ x: dx * p.empujon * masa, y: a.arriba * masa, z: dz * p.empujon * masa }, true);
    }
    lamidas++;
    estado = "contento";
    espera = p.descanso;
    rapidez = 0;
    for (const aviso of avisos) aviso(jugador);
  };

  /** El hueso que roe, en la trompa, en el suelo y atravesado. */
  const enLaTrompa = (hueso: Hueso) => {
    const giroHueso = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo + Math.PI / 2);
    hueso.cuerpo.setTranslation(
      { x: pos.x + Math.sin(rumbo) * (a.trompa + 0.1), y: base + 0.06, z: pos.z + Math.cos(rumbo) * (a.trompa + 0.1) },
      true,
    );
    hueso.cuerpo.setRotation(giroHueso, true);
    hueso.cuerpo.setLinvel({ x: 0, y: 0, z: 0 }, true);
    hueso.cuerpo.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  h.antes((munecos) => {
    persigue = null;
    if (estado === "royendo") {
      espera -= PASO;
      quedarse();
      if (roido && roido.agarrado === 0) enLaTrompa(roido);
      if (espera <= 0) {
        roido?.volver();
        roido = null;
        estado = "volviendo";
      }
    } else if (estado === "contento") {
      espera -= PASO;
      quedarse();
      if (espera <= 0) estado = "volviendo";
    } else {
      const hueso = huesoSuelto();
      const muneco = hueso ? null : presa(munecos);
      if (hueso) {
        const t = hueso.cuerpo.translation();
        estado = "al hueso";
        if (correrHacia(t.x, t.z) < a.alcanzarHueso && Math.abs(t.y - base) < 0.5) {
          estado = "royendo";
          espera = p.roer;
          roido = hueso;
        }
      } else if (muneco) {
        const t = muneco.muneco.partes.pelvis.translation();
        estado = "persiguiendo";
        persigue = muneco.jugador;
        // Lo alcanza cuando la trompa llega a `lamer` del muñeco
        if (correrHacia(t.x, t.z) < p.lamer) lamer(muneco.jugador, muneco.muneco);
      } else if (Math.hypot(casa.x - pos.x, casa.z - pos.z) > a.enCasa) {
        estado = "volviendo";
        correrHacia(casa.x, casa.z);
      } else {
        estado = "echado";
        quedarse();
        rumbo = envolver(rumbo + limitar(envolver(rumboCasa - rumbo), -a.giro * PASO, a.giro * PASO));
      }
    }
    cuerpo.setNextKinematicTranslation({ x: pos.x, y: base, z: pos.z });
    cuerpo.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo));
  });

  // La imagen: con lo que anduvo en cada paso (también en el invitado, que recibe el cuerpo en la foto)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let andado = 0;
  let velocidad = 0;
  let quieto = 0;
  let pasos = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.z - antes.z);
    antes.copy(t);
    andado += d;
    velocidad += (d / PASO - velocidad) * 0.2;
    quieto = velocidad < 0.15 ? quieto + PASO : 0;
    pasos++;
  });
  h.dibujar(() => imagen.posar(andado / a.zancada, velocidad / p.velocidad, quieto, pasos * PASO));

  return {
    cual: "cadejo",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get lamidas() {
      return lamidas;
    },
    get persigue() {
      return persigue;
    },
    alLamer(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      roido?.volver();
      roido = null;
      estado = "echado";
      pos = { x: casa.x, z: casa.z };
      rumbo = rumboCasa;
      rapidez = 0;
      espera = 0;
      const giroCasa = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);
      cuerpo.setTranslation({ x: pos.x, y: base, z: pos.z }, true);
      cuerpo.setRotation(giroCasa, true);
      cuerpo.setNextKinematicTranslation({ x: pos.x, y: base, z: pos.z });
      cuerpo.setNextKinematicRotation(giroCasa);
    },
  };
}

/** El perrote: lomo, pecho, cabeza con orejas y trompa, cuatro patas y la cola. Mira hacia +z, con las patas en
 * y = 0. Todo negro de tela peluda, con los dos ojos blancos de los muñecos y la lengua gris. */
function crearImagenCadejo() {
  const pelo = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 5 });
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);

  // Lomo y pecho, con mechones parados en el espinazo
  const lomo: THREE.BufferGeometry[] = [
    new THREE.CapsuleGeometry(0.25, 0.62, 6, 14).rotateX(Math.PI / 2).translate(0, 0.66, -0.04),
    new THREE.SphereGeometry(0.29, 14, 10).scale(1, 1.05, 1).translate(0, 0.72, 0.3),
  ];
  for (let i = 0; i < 9; i++) {
    const z = -0.42 + i * 0.1;
    lomo.push(
      new THREE.ConeGeometry(0.06, 0.16 + 0.05 * (i % 3), 4)
        .rotateX(-0.5)
        .translate(0.04 * ((i % 2) * 2 - 1), 0.92 + 0.02 * Math.sin(i), z),
    );
  }
  cuerpo.add(new THREE.Mesh(juntar(lomo), pelo));

  // La cabeza, sobre el pecho: cráneo, trompa, orejas caídas, los ojos y la lengua
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 0.9, 0.48);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.21, 14, 10).translate(0, 0.06, 0.06),
        new THREE.BoxGeometry(0.17, 0.15, 0.26).translate(0, -0.02, 0.27),
        new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.02, 0.4),
        ...[-1, 1].map((lado) =>
          new THREE.ConeGeometry(0.08, 0.22, 4).rotateZ(lado * 2.6).translate(lado * 0.18, 0.08, 0.02),
        ),
      ]),
      pelo,
    ),
  );
  cabeza.add(
    new THREE.Mesh(
      juntar([-1, 1].map((lado) => new THREE.SphereGeometry(0.03, 8, 6).translate(lado * 0.08, 0.12, 0.23))),
      materialOjo(),
    ),
  );
  const lengua = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.015, 0.14).translate(0, 0, 0.07),
    new THREE.MeshStandardMaterial({ name: "lengua", color: COLORES.siluetaLejana, roughness: 0.5 }),
  );
  lengua.position.set(0, -0.09, 0.3);
  cabeza.add(lengua);
  cuerpo.add(cabeza);

  // Las patas: cuelgan de la cadera y del hombro y se balancean al andar
  const pata = new THREE.CapsuleGeometry(0.075, 0.36, 4, 8).translate(0, -0.25, 0);
  const patas = [
    [0.13, 0.32, 0],
    [-0.13, 0.32, Math.PI],
    [0.13, -0.36, Math.PI],
    [-0.13, -0.36, 0],
  ].map(([x = 0, z = 0, fase = 0]) => {
    const g = new THREE.Group();
    g.position.set(x, 0.55, z);
    g.add(new THREE.Mesh(pata, pelo));
    cuerpo.add(g);
    return { g, fase };
  });

  // La cola, parada y peluda
  const cola = new THREE.Group();
  cola.position.set(0, 0.8, -0.5);
  cola.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6).translate(0, 0.25, 0).rotateX(-0.7), pelo));
  cuerpo.add(cola);

  return {
    grupo,
    /** `vuelta`: cuántas zancadas lleva; `brio`: qué tan rápido va (0 a 1); `quieto`: hace cuánto no se mueve (s);
     * `t`: los segundos, para la cola. */
    posar(vuelta: number, brio: number, quieto: number, t: number) {
      const f = limitar(brio, 0, 1);
      const angulo = vuelta * Math.PI * 2;
      for (const { g, fase } of patas) g.rotation.x = 0.7 * f * Math.sin(angulo + fase);
      // Corriendo galopa un poco (sube y baja) y saca la lengua
      cuerpo.position.y = 0.04 * f * Math.abs(Math.sin(angulo));
      lengua.visible = f > 0.5;
      // Quieto un rato se echa: el cuerpo baja y las patas se doblan hacia adelante y atrás
      const echado = limitar((quieto - 1) / 0.6, 0, 1);
      cuerpo.position.y -= 0.36 * echado;
      for (const { g } of patas) g.rotation.x += (g.position.z > 0 ? -1.3 : 1.3) * echado;
      cabeza.rotation.x = 0.15 * echado + 0.1 * f;
      cola.rotation.z = Math.sin(t * (echado > 0.5 ? 3 : 12)) * (echado > 0.5 ? 0.25 : 0.5);
    },
  };
}
