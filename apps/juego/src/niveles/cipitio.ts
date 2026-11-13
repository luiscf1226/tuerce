// El Cipitío (TU-41): un cipote barrigón, con los pies al revés y un mechón en la coronilla (su sombrero puntudo lo
// perdió: es el secreto del nivel), que les tira piedritas a los que se le acercan y se ríe. Sale de un nodo `tipo:
// pieza, pieza: cipitio`: se sienta en el medio de la base de su caja, mirando hacia su frente.
//
//   · Tira. Cada `cada` segundos, al muñeco más cercano que esté a menos de `vista` (de costado, sin contar la
//     altura) y que no le traiga un guineo, le tira una piedra: la saca del morral, apunta un momento y la lanza para
//     que caiga donde va a estar el muñeco cuando llegue (le adelanta lo que camina), `corto` antes, hacia él, pero
//     nunca más cerca de él que `cerca`. Después se ríe. Si `empujon` no es 0, la piedra que pasa junto al muñeco le
//     da un piedrazo que lo tumba (no hay derrota).
//   · Las piedras son de verdad (dinámicas, 4 kg, no giran): se quedan donde caen y sirven de escalón. Los muñecos
//     las atraviesan (no las empujan ni los empujan), pero las pisan: el rayo de su suspensión sí las ve, así que la
//     que cae a los pies de uno lo sube encima. Se agarran solo a la altura de las manos, o sea nunca del suelo.
//   · Con el morral vacío recoge (vuelven a su mano) la piedra tirada más vieja de las que tiene a la vista, si no
//     está al pie de él; las de lejos (las que dejó en otro lado) no las toca. Las que caen al vacío vuelven al
//     morral.
//   · Un guineo suelto (que nadie agarra) a menos de `alcance` de su boca, se lo come: desde ahí está contento y no
//     tira más. El guion lo puede mudar (`mudarse`) y cambiarle la puntería.
//
// Es un cuerpo cinemático que mueve esta pieza a paso fijo, sin azar. Viaja en la foto de la red con sus piedras y
// el guineo: el invitado lo ve reírse (se echa para atrás), alzar el brazo (tiene una piedra en la mano) y comer (el
// guineo en la boca), todo con los cuerpos tal como llegan.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearRoca, juntar, materialCorteza, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import type { Muneco } from "../muneco";
import type { PiezaDelCafetalEnPlano } from "./formato-cafetal";
import type { Herramientas } from "./piezas";
import type { Guineo } from "./piezas-cafetal";
import { GRUPOS_SUELTO, manosEn } from "./piezas-pinar";

export type EstadoCipitio = "sentado" | "apuntando" | "riendo" | "comiendo" | "contento";

/** Su puntería: lo que dice la escena y lo que el guion le cambia al mudarlo. */
export interface Punteria {
  vista: number;
  cada: number;
  corto: number;
  cerca: number;
  empujon: number;
  vuelo: number;
  /** Si su cuerpo ataja a los muñecos (sentado en un portillo, lo tapa). */
  estorba: boolean;
}

export interface Cipitio {
  readonly cual: "cipitio";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoCipitio;
  /** Sus piedras (las del morral están escondidas). */
  readonly piedras: readonly RAPIER.RigidBody[];
  /** Cuántas tiró y cuántos piedrazos dio. */
  readonly tiradas: number;
  readonly pegadas: number;
  /** Si ya se comió un guineo (no tira más). */
  readonly contento: boolean;
  /** Si se está riendo (también en el invitado: lo ve echado para atrás). */
  readonly riendo: boolean;
  /** Si tiene una piedra en la mano (el brazo alzado) o un guineo en la boca (también en el invitado). */
  readonly conPiedra: boolean;
  readonly masticando: boolean;
  /** Dónde está sentado (sus pies) y hacia dónde mira. */
  readonly asiento: THREE.Vector3;
  readonly rumbo: number;
  /** Llama a `aviso` cada vez que tira, con a quién. */
  alTirar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando se come el guineo. */
  alComer(aviso: () => void): () => void;
  /** Lo lleva a sentarse ahí, mirando hacia `rumbo`, y le cambia la puntería (lo que no se diga queda igual). */
  mudarse(donde: THREE.Vector3Like, rumbo: number, punteria?: Partial<Punteria>): void;
  /** Lo deja contento (como si ya se hubiera comido el guineo: al retomar). */
  contentar(): void;
  /** Guarda todas sus piedras en el morral y lo deja sentado. */
  recogerPiedras(): void;
}

/** Los números del Cipitío que no se ponen desde Blender. */
export const AJUSTES_CIPITIO = {
  /** Cada piedra: medio ancho, medio alto y medio fondo (m), y su peso. Media de alto: 50 cm, un escalón. */
  piedra: { medio: { x: 0.3, y: 0.25, z: 0.25 }, masa: 4 },
  /** Dónde esconde el morral (debajo de todo, quieto). */
  morral: -40,
  /** Lo que tarda en apuntar con la piedra en la mano y lo que se ríe después (s). */
  apuntar: 0.35,
  risa: 1.1,
  /** Lo que le adelanta al que camina, a lo sumo (m). */
  adelanto: 1.5,
  /** El piedrazo alcanza a menos de esto de la pelvis o del pecho (m), y lo levanta tanto (m/s). */
  pegar: 0.55,
  arriba: 1.2,
  /** Se come el guineo suelto a menos de esto de su boca (m). Tarda tanto en comérselo (s). */
  alcance: 1.0,
  comer: 1.5,
  /** Con el morral vacío recoge la piedra tirada más vieja, si está a más de esto de él (de costado, m) y a menos
   * de su `vista` más esto. */
  recoger: 1.6,
  /** Cuánto gira por segundo hacia el que apunta (rad/s). */
  giro: 7,
  /** Echado para atrás más que esto (rad), se está riendo: así lo sabe el invitado. */
  risaVisible: 0.12,
  /** Su cuerpo, sentado (para atajar en un portillo): radio y alto (m). */
  cuerpo: { radio: 0.45, alto: 1.0 },
  /** Su mano de tirar y su boca, sentado y mirando hacia +z (m). */
  mano: { x: -0.22, y: 1.05, z: 0.18 },
  boca: { x: 0, y: 0.82, z: 0.2 },
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

type EstadoPiedra = "morral" | "mano" | "volando" | "tirada";

export function armarCipitio(h: Herramientas, p: Extract<PiezaDelCafetalEnPlano, { cual: "cipitio" }>): Cipitio {
  const { rapier, mundo } = h;
  const a = AJUSTES_CIPITIO;
  const { centro, medio } = p.caja;
  const asiento = new THREE.Vector3(centro.x, centro.y - medio.y, centro.z);
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(p.caja.giro);
  let rumboBase = Math.atan2(frente.x, frente.z);
  let rumbo = rumboBase;
  const punteria: Punteria = {
    vista: p.vista,
    cada: p.cada,
    corto: p.corto,
    cerca: p.cerca,
    empujon: p.empujon,
    vuelo: p.vuelo,
    estorba: false,
  };

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(asiento.x, asiento.y, asiento.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo)),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(a.cuerpo.alto / 2, a.cuerpo.radio)
      .setTranslation(0, a.cuerpo.alto / 2, 0)
      .setFriction(0.5),
    cuerpo,
  );
  colisionador.setEnabled(punteria.estorba);
  const imagen = crearImagenCipitio();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  // Las piedras: escondidas en el morral (cinemáticas, sin choques) hasta que las tira
  const mp = a.piedra.medio;
  const piedras = Array.from({ length: p.piedras }, (_, i) => {
    const c = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(asiento.x, a.morral - i, asiento.z)
        .lockRotations()
        .setAngularDamping(4),
    );
    const col = mundo.createCollider(
      rapier.ColliderDesc.cuboid(mp.x, mp.y, mp.z)
        .setMass(a.piedra.masa)
        .setFriction(1)
        .setRestitution(0)
        .setCollisionGroups(0),
      c,
    );
    const objeto = crearImagenPiedra(mp, i);
    objeto.name = `${p.nombre}-piedra-${i + 1}`;
    h.mover(c, objeto);
    return { cuerpo: c, colisionador: col, estado: "morral" as EstadoPiedra, desde: 0, pego: false, orden: 0 };
  });

  let estado: EstadoCipitio = "sentado";
  let espera = 0;
  let apuntando = 0;
  let risa = 0;
  let comiendo = 0;
  let pasos = 0;
  let tiradas = 0;
  let pegadas = 0;
  let objetivo: 0 | 1 = 0;
  let enMano: (typeof piedras)[number] | undefined;
  let guineo: Guineo | undefined;
  const avisosTirar = new Set<(jugador: 0 | 1) => void>();
  const avisosComer = new Set<() => void>();

  const giro = new THREE.Quaternion();
  const inclinar = new THREE.Quaternion();
  /** Un punto de su cuerpo (sentado, mirando hacia +z) en el mundo, con el rumbo de ahora. */
  const punto = (l: { x: number; y: number; z: number }, salida = new THREE.Vector3()) =>
    salida.set(l.x, l.y, l.z).applyAxisAngle(ARRIBA, rumbo).add(asiento);

  const guardar = (piedra: (typeof piedras)[number], i: number) => {
    piedra.estado = "morral";
    piedra.pego = false;
    piedra.colisionador.setCollisionGroups(0);
    piedra.cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
    piedra.cuerpo.setTranslation({ x: asiento.x, y: a.morral - i, z: asiento.z }, true);
  };
  /** Saca una piedra del morral; si no hay, recoge la tirada más vieja que esté lejos de él. */
  const sacarPiedra = () => {
    const libre = piedras.find((q) => q.estado === "morral");
    if (libre) return libre;
    const lejos = piedras
      .filter((q) => {
        if (q.estado !== "tirada") return false;
        const t = q.cuerpo.translation();
        const d = Math.hypot(t.x - asiento.x, t.z - asiento.z);
        return d > a.recoger && d < punteria.vista + a.recoger;
      })
      .sort((x, y) => x.orden - y.orden)[0];
    return lejos;
  };
  /** Con quién se las agarra: el más cercano a menos de `vista` (de costado) que no trae un guineo. */
  const elegir = (munecos: readonly Muneco[]): 0 | 1 | null => {
    let mejor: 0 | 1 | null = null;
    let distancia = punteria.vista;
    for (const j of [0, 1] as const) {
      const m = munecos[j];
      if (!m) continue;
      const conGuineo = h.lista.some((q) => q.cual === "guineo" && manosEn(m, q.cuerpo) > 0);
      if (conGuineo) continue;
      const t = m.partes.pelvis.translation();
      const d = Math.hypot(t.x - asiento.x, t.z - asiento.z);
      if (d < distancia) {
        distancia = d;
        mejor = j;
      }
    }
    return mejor;
  };
  /** La lanza para que caiga donde va a estar el muñeco, `corto` antes y nunca más cerca que `cerca`. */
  const tirar = (piedra: (typeof piedras)[number], m: Muneco) => {
    const pelvis = m.partes.pelvis.translation();
    const v = m.partes.pelvis.linvel();
    const T = punteria.vuelo;
    const adelanto = new THREE.Vector3(v.x * T, 0, v.z * T);
    if (adelanto.length() > a.adelanto) adelanto.setLength(a.adelanto);
    const destino = new THREE.Vector3(pelvis.x, 0, pelvis.z).add(adelanto);
    const haciaEl = new THREE.Vector3(asiento.x - destino.x, 0, asiento.z - destino.z);
    const lejos = haciaEl.length();
    if (lejos > 1e-6) {
      destino.addScaledVector(haciaEl, Math.min(punteria.corto, lejos) / lejos);
      const ahora = Math.hypot(destino.x - asiento.x, destino.z - asiento.z);
      if (ahora < punteria.cerca) {
        destino.addScaledVector(haciaEl, -(punteria.cerca - ahora) / lejos);
      }
    }
    // La altura: la de los pies del muñeco (de pie, la pelvis va a medio metro del suelo), más media piedra
    destino.y = pelvis.y - 0.5 + mp.y;
    const desde = piedra.cuerpo.translation();
    piedra.estado = "volando";
    piedra.desde = pasos;
    piedra.pego = false;
    piedra.cuerpo.setBodyType(rapier.RigidBodyType.Dynamic, true);
    piedra.colisionador.setCollisionGroups(GRUPOS_SUELTO);
    piedra.cuerpo.setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo), true);
    piedra.cuerpo.setAngvel(CERO, true);
    piedra.cuerpo.setLinvel(
      {
        x: (destino.x - desde.x) / T,
        y: (destino.y - desde.y) / T - 0.5 * GRAVEDAD * T,
        z: (destino.z - desde.z) / T,
      },
      true,
    );
    tiradas++;
    for (const aviso of avisosTirar) aviso(objetivo);
  };

  const mano = new THREE.Vector3();
  const boca = new THREE.Vector3();
  h.antes((munecos) => {
    pasos++;
    espera -= PASO;
    let haciaRumbo = rumboBase;
    if (estado === "riendo") {
      risa -= PASO;
      if (risa <= 0) estado = "sentado";
    }
    if (estado === "sentado" && espera <= 0) {
      const j = elegir(munecos);
      const piedra = j === null ? undefined : sacarPiedra();
      if (j !== null && piedra) {
        objetivo = j;
        enMano = piedra;
        piedra.estado = "mano";
        piedra.colisionador.setCollisionGroups(0);
        piedra.cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        estado = "apuntando";
        apuntando = a.apuntar;
      }
    }
    if (estado === "apuntando") {
      const m = munecos[objetivo];
      if (m) {
        const t = m.partes.pelvis.translation();
        haciaRumbo = Math.atan2(t.x - asiento.x, t.z - asiento.z);
      }
      apuntando -= PASO;
      if (apuntando <= 0 && enMano && m) {
        tirar(enMano, m);
        enMano = undefined;
        estado = "riendo";
        risa = a.risa;
        espera = punteria.cada;
      }
    }
    if (estado === "riendo") {
      const m = munecos[objetivo];
      if (m) {
        const t = m.partes.pelvis.translation();
        haciaRumbo = Math.atan2(t.x - asiento.x, t.z - asiento.z);
      }
    }
    if (estado === "comiendo") {
      comiendo -= PASO;
      if (comiendo <= 0) estado = "contento";
    }
    // Gira de a poco hacia donde mira
    const d = envolver(haciaRumbo - rumbo);
    rumbo += limitar(d, -a.giro * PASO, a.giro * PASO);
    // Riéndose se echa para atrás y se sacude; contento, se mece
    const t = pasos * PASO;
    let echado = 0;
    let saltito = 0;
    if (estado === "riendo") {
      const f = limitar(Math.min((a.risa - risa) * 6, risa * 4), 0, 1);
      echado = 0.28 * f;
      saltito = 0.05 * f * Math.abs(Math.sin(t * 16));
    } else if (estado === "comiendo" || estado === "contento") {
      echado = 0.16 + 0.06 * Math.sin(t * 5);
      saltito = 0.02 * Math.abs(Math.sin(t * 9));
    }
    giro.setFromAxisAngle(ARRIBA, rumbo).multiply(inclinar.setFromAxisAngle(EJE_X, -echado));
    cuerpo.setNextKinematicTranslation({ x: asiento.x, y: asiento.y + saltito, z: asiento.z });
    cuerpo.setNextKinematicRotation(giro);
    // La piedra en la mano y el guineo en la boca
    punto(a.mano, mano);
    if (enMano) enMano.cuerpo.setNextKinematicTranslation({ x: mano.x, y: mano.y + mp.y, z: mano.z });
    if (guineo) {
      punto(a.boca, boca);
      guineo.cuerpo.setNextKinematicTranslation({ x: boca.x, y: boca.y, z: boca.z });
      guineo.cuerpo.setNextKinematicRotation(giro);
    }
  });

  let orden = 0;
  h.despues((munecos, fuera) => {
    for (const [i, piedra] of piedras.entries()) {
      if (piedra.estado !== "volando" && piedra.estado !== "tirada") continue;
      const t = piedra.cuerpo.translation();
      if (fuera(t)) {
        guardar(piedra, i);
        continue;
      }
      if (piedra.estado !== "volando") continue;
      // El piedrazo: la que pasa junto a un muñeco lo tumba hacia afuera
      if (punteria.empujon > 0 && !piedra.pego) {
        for (const j of [0, 1] as const) {
          const m = munecos[j];
          if (!m) continue;
          const cerca = [m.partes.pelvis, m.partes.torso].some((parte) => {
            const q = parte.translation();
            return Math.hypot(q.x - t.x, q.y - t.y, q.z - t.z) < a.pegar;
          });
          if (!cerca) continue;
          piedra.pego = true;
          pegadas++;
          const q = m.partes.pelvis.translation();
          const afuera = new THREE.Vector3(q.x - asiento.x, 0, q.z - asiento.z);
          if (afuera.lengthSq() < 1e-6) afuera.set(-Math.sin(rumbo), 0, -Math.cos(rumbo));
          afuera.setLength(punteria.empujon);
          for (const parte of Object.values(m.partes)) {
            const masa = parte.mass();
            parte.applyImpulse({ x: afuera.x * masa, y: a.arriba * masa, z: afuera.z * masa }, true);
          }
          break;
        }
      }
      // Cayó: quieta, ya es una piedra tirada
      const v = piedra.cuerpo.linvel();
      if (pasos - piedra.desde > 10 && Math.hypot(v.x, v.y, v.z) < 0.15) {
        piedra.estado = "tirada";
        piedra.orden = orden++;
      }
    }
    // El guineo suelto que le queda a la mano, se lo come
    if (estado === "comiendo" || estado === "contento") return;
    punto(a.boca, boca);
    for (const q of h.lista) {
      if (q.cual !== "guineo" || q.comido) continue;
      if (munecos.some((m) => manosEn(m, q.cuerpo) > 0)) continue;
      const t = q.cuerpo.translation();
      if (Math.hypot(t.x - boca.x, t.y - boca.y, t.z - boca.z) > a.alcance) continue;
      q.comer();
      guineo = q;
      if (enMano) {
        const i = piedras.indexOf(enMano);
        guardar(enMano, i);
        enMano = undefined;
      }
      estado = "comiendo";
      comiendo = a.comer;
      for (const aviso of avisosComer) aviso();
      return;
    }
  });

  // Lo que se ve, con los cuerpos como llegan (también en el invitado): si se ríe (echado para atrás), si tiene una
  // piedra en la mano (el brazo alzado) y si tiene un guineo en la boca
  let riendo = false;
  let brazo = 0;
  let masticando = false;
  const arribaDelCuerpo = new THREE.Vector3();
  const manoAhora = new THREE.Vector3();
  const bocaAhora = new THREE.Vector3();
  /** Los pasos que vio pasar, también el invitado (que no corre `antes`): con eso se mueve la boca. */
  let vistos = 0;
  h.guardar(() => {
    vistos++;
    const q = cuerpo.rotation();
    arribaDelCuerpo.copy(ARRIBA).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    riendo = Math.acos(limitar(arribaDelCuerpo.y, -1, 1)) > a.risaVisible;
    const t = cuerpo.translation();
    const r = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
    manoAhora
      .set(a.mano.x, a.mano.y + mp.y, a.mano.z)
      .applyAxisAngle(ARRIBA, r)
      .add(t);
    bocaAhora.set(a.boca.x, a.boca.y, a.boca.z).applyAxisAngle(ARRIBA, r).add(t);
    brazo = piedras.some((pq) => {
      const s = pq.cuerpo.translation();
      return Math.hypot(s.x - manoAhora.x, s.y - manoAhora.y, s.z - manoAhora.z) < 0.2;
    })
      ? 1
      : 0;
    masticando = h.lista.some((g) => {
      if (g.cual !== "guineo") return false;
      const s = g.cuerpo.translation();
      return Math.hypot(s.x - bocaAhora.x, s.y - bocaAhora.y, s.z - bocaAhora.z) < 0.12;
    });
  });
  let alzado = 0;
  h.dibujar(() => {
    alzado += (brazo - alzado) * 0.25;
    imagen.posar(alzado, riendo, masticando, vistos * PASO);
  });

  const cipitio: Cipitio = {
    cual: "cipitio",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    piedras: piedras.map((q) => q.cuerpo),
    get tiradas() {
      return tiradas;
    },
    get pegadas() {
      return pegadas;
    },
    get contento() {
      return estado === "comiendo" || estado === "contento";
    },
    get riendo() {
      return riendo;
    },
    get conPiedra() {
      return brazo === 1;
    },
    get masticando() {
      return masticando;
    },
    asiento,
    get rumbo() {
      return rumbo;
    },
    alTirar(aviso) {
      avisosTirar.add(aviso);
      return () => {
        avisosTirar.delete(aviso);
      };
    },
    alComer(aviso) {
      avisosComer.add(aviso);
      return () => {
        avisosComer.delete(aviso);
      };
    },
    mudarse(donde, nuevoRumbo, cambios = {}) {
      Object.assign(punteria, cambios);
      colisionador.setEnabled(punteria.estorba);
      asiento.set(donde.x, donde.y, donde.z);
      rumboBase = nuevoRumbo;
      rumbo = nuevoRumbo;
      giro.setFromAxisAngle(ARRIBA, rumbo);
      cuerpo.setTranslation({ x: asiento.x, y: asiento.y, z: asiento.z }, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setNextKinematicTranslation({ x: asiento.x, y: asiento.y, z: asiento.z });
      cuerpo.setNextKinematicRotation(giro);
      if (enMano) {
        guardar(enMano, piedras.indexOf(enMano));
        enMano = undefined;
      }
      if (estado === "apuntando" || estado === "riendo") estado = "sentado";
      espera = punteria.cada / 2;
    },
    contentar() {
      if (enMano) guardar(enMano, piedras.indexOf(enMano));
      enMano = undefined;
      estado = "contento";
    },
    recogerPiedras() {
      piedras.forEach(guardar);
      enMano = undefined;
      if (estado === "apuntando" || estado === "riendo") estado = "sentado";
    },
  };
  return cipitio;
}

/** Una piedra de río, abollada, del tamaño de la caja de la piedra (siempre igual para cada una). */
function crearImagenPiedra(m: { x: number; y: number; z: number }, semilla: number) {
  const roca = crearRoca(1, 300 + semilla);
  const g = roca.geometry;
  g.computeBoundingBox();
  const caja = g.boundingBox ?? new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const centro = caja.getCenter(new THREE.Vector3());
  const tam = caja.getSize(new THREE.Vector3());
  g.translate(-centro.x, -centro.y, -centro.z);
  g.scale((m.x * 2.1) / tam.x, (m.y * 2.05) / tam.y, (m.z * 2.1) / tam.z);
  const grupo = new THREE.Group();
  grupo.add(roca);
  return grupo;
}

/** El Cipitío sentado, mirando hacia +z: panzón, cabezón, con un mechón parado y los pies al revés (los dedos
 * hacia atrás). De trapo oscuro, como todo; los ojos son dos puntos blancos y la risa, una boca abierta. */
function crearImagenCipitio() {
  const tela = materialTela(COLORES.silueta, { repetir: 1.5, relieve: 5 });
  const honda = materialTela(COLORES.siluetaHonda, { repetir: 1, relieve: 3 });
  const grupo = new THREE.Group();
  // Lo que se echa para atrás al reírse: todo menos las piernas
  const arriba = new THREE.Group();
  grupo.add(arriba);
  const bola = (x: number, y: number, z: number, rx: number, ry: number, rz: number) =>
    new THREE.SphereGeometry(1, 14, 10).scale(rx, ry, rz).translate(x, y, z);
  const capsula = (a: THREE.Vector3, b: THREE.Vector3, radio: number) => {
    const g = new THREE.CapsuleGeometry(radio, a.distanceTo(b), 4, 10);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
    return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // Las piernas sentadas: muslos hacia adelante y canillas colgando, con los pies al revés (talón adelante)
  const piernas: THREE.BufferGeometry[] = [];
  for (const l of [-1, 1]) {
    piernas.push(capsula(v(l * 0.12, 0.42, 0.02), v(l * 0.14, 0.42, 0.3), 0.075));
    piernas.push(capsula(v(l * 0.14, 0.42, 0.32), v(l * 0.14, 0.12, 0.34), 0.065));
    // El pie: el talón hacia adelante y los dedos hacia atrás
    piernas.push(bola(l * 0.14, 0.06, 0.3, 0.07, 0.05, 0.13));
    for (let i = 0; i < 3; i++) piernas.push(bola(l * 0.14 + (i - 1) * 0.03, 0.05, 0.19, 0.022, 0.022, 0.03));
  }
  grupo.add(new THREE.Mesh(juntar(piernas), tela));
  // La panza (grandota), el pecho y la cabeza con su mechón
  arriba.add(
    new THREE.Mesh(
      juntar([
        bola(0, 0.52, 0.04, 0.27, 0.24, 0.27),
        bola(0, 0.7, 0, 0.2, 0.14, 0.17),
        bola(0, 0.94, 0.02, 0.19, 0.18, 0.18),
        bola(-0.17, 0.95, 0.02, 0.05, 0.07, 0.03),
        bola(0.17, 0.95, 0.02, 0.05, 0.07, 0.03),
      ]),
      tela,
    ),
  );
  const mechon = new THREE.Mesh(
    juntar([
      new THREE.ConeGeometry(0.05, 0.2, 5).rotateZ(0.3).translate(-0.03, 1.18, 0),
      new THREE.ConeGeometry(0.04, 0.16, 5).rotateZ(-0.4).translate(0.04, 1.16, 0.02),
    ]),
    honda,
  );
  arriba.add(mechon);
  const ojos = new THREE.Mesh(
    juntar([-1, 1].map((l) => new THREE.SphereGeometry(0.03, 8, 6).translate(l * 0.07, 0.98, 0.18))),
    materialOjo(),
  );
  arriba.add(ojos);
  const boca = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(0.07, 0.02, 0.03), honda);
  boca.position.set(0, 0.88, 0.18);
  arriba.add(boca);
  // Los brazos, cada uno con su hombro (para alzarlo)
  const brazos = [-1, 1].map((l) => {
    const hombro = new THREE.Group();
    hombro.position.set(l * 0.2, 0.7, 0.02);
    hombro.add(
      new THREE.Mesh(
        juntar([capsula(v(0, 0, 0), v(l * 0.05, -0.28, 0.08), 0.05), bola(l * 0.06, -0.33, 0.1, 0.06, 0.06, 0.06)]),
        tela,
      ),
    );
    arriba.add(hombro);
    return hombro;
  });
  return {
    grupo,
    /** `alzado`: el brazo de tirar (el derecho, −x) de 0 (abajo) a 1 (arriba, con la piedra); `riendo`: abre la boca. */
    posar(alzado: number, riendo: boolean, masticando: boolean, t: number) {
      const [derecho, izquierdo] = brazos;
      if (derecho) derecho.rotation.set(-2.6 * alzado, 0, -0.3 * alzado);
      // Comiendo, la otra mano a la boca
      if (izquierdo) izquierdo.rotation.set(masticando ? -1.9 : 0, 0, masticando ? -0.5 : 0);
      const abierta = riendo
        ? 1 + 1.6 * Math.abs(Math.sin(t * 16))
        : masticando
          ? 1 + 0.8 * Math.abs(Math.sin(t * 9))
          : 1;
      boca.scale.set(0.07, 0.02 * abierta, 0.03);
    },
  };
}

/** El sombrero puntudo del Cipitío (el secreto): un ala ancha y una copa altísima, doblada en la punta. */
export function crearSombreroPuntudo(): THREE.Group {
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 1, relieve: 4 });
  const grupo = new THREE.Group();
  const copa = new THREE.ConeGeometry(0.2, 0.75, 14, 6);
  const pos = copa.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + 0.375;
    // La punta se dobla de lado
    pos.setX(i, pos.getX(i) + 0.18 * (y / 0.75) ** 3);
  }
  copa.computeVertexNormals();
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.46, 0.48, 0.03, 20),
        copa.translate(0, 0.39, 0),
        new THREE.TorusGeometry(0.2, 0.025, 5, 16).rotateX(Math.PI / 2).translate(0, 0.06, 0),
      ]),
      tela,
    ),
  );
  return grupo;
}

/** El palo de jocote del Cipitío: el tronco desde `pie`, dos ramas para arriba y la rama gruesa que llega hasta
 * `rama` (donde se sienta él). */
export function crearPaloDeJocote(pie: THREE.Vector3Like, rama: THREE.Vector3Like): THREE.Mesh {
  const corteza = materialCorteza(COLORES.silueta, { repetir: [2, 3] });
  const tronco = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) => {
    const g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), 9);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
    return g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  };
  const base = new THREE.Vector3(pie.x, pie.y, pie.z);
  const horqueta = base.clone().add(new THREE.Vector3(0, 2.2, 0));
  return new THREE.Mesh(
    juntar([
      tronco(base, horqueta, 0.28, 0.2),
      tronco(horqueta, horqueta.clone().add(new THREE.Vector3(0.6, 2.4, -0.4)), 0.18, 0.08),
      tronco(horqueta, horqueta.clone().add(new THREE.Vector3(-0.4, 2.1, -0.6)), 0.16, 0.07),
      tronco(
        horqueta.clone().add(new THREE.Vector3(0, -0.3, 0)),
        new THREE.Vector3(rama.x, rama.y, rama.z),
        0.15,
        0.08,
      ),
    ]),
    corteza,
  );
}
