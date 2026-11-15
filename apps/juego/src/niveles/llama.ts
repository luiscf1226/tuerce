// La llama carguera (TU-45): la criatura de El puente de paja. Sale de un nodo `tipo: pieza` con `pieza: carguera`
// (formato-puente.ts). Lleva su carga en el lomo y sigue a su paso al que la lleva de la rienda (una manija colgada
// del bozal con una soga de verdad, de Rapier, como la mula de Las trenzas), sin meterse en las paredes ni tirarse a
// los huecos. No le gusta que la apuren: con la rienda tirante más de `paciencia` (el que la lleva camina más rápido
// que ella) o con alguien que se le viene encima por detrás, se enoja, se da vuelta y le escupe (el escupitajo vuela
// y lo tumba: no hay derrota), se echa un rato y se vuelve sola a su casa. Cinemática, sin choques con lo suelto y
// sin azar: dos corridas iguales dan lo mismo.
//
// En línea viajan en la foto su cuerpo, la manija de la rienda, el escupitajo (escondido 40 m abajo mientras no
// vuela) y un marcador sin choques cuya altura sobre ella dice en qué anda: el invitado la dibuja echada, con las
// orejas para atrás o escupiendo con eso.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import type { PiezaDelPuenteEnPlano } from "./formato-puente";
import type { Herramientas } from "./piezas";
import { manosEn } from "./piezas-pinar";

/** El bit de grupo de choque de El puente de paja (el mismo de piezas-puente.ts): la manija de la rienda choca con
 * todo menos con los muñecos (bits 1 y 2), y las manos la encuentran igual. */
const BIT_PUENTE = 1 << 13;
const GRUPOS_PUENTE = ((BIT_PUENTE << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se la encuentra (para agarrarla) pero no empuja ni la empujan. */
const SIN_EMPUJAR = (BIT_PUENTE << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const ESTADOS_LLAMA = ["tranquila", "escupiendo", "echada", "volviendo", "contenta"] as const;
export type EstadoLlama = (typeof ESTADOS_LLAMA)[number];

/** Los números de la llama que no se ponen desde Blender. */
export const AJUSTES_LLAMA = {
  /** Qué tan rápido acelera y frena (m/s²). */
  aceleracion: 2.5,
  /** Empieza a andar con la rienda más tirante que esto (fracción del largo), anda a todo lo que da pasada la
   * siguiente, y desde `apurada` cuenta como que la apuran. */
  tirante: 0.55,
  plena: 0.85,
  apurada: 0.95,
  /** Cuánto se le pasa el apuro cuando ya no la apuran (veces más rápido de lo que sube). */
  calmarse: 1,
  /** El que se le viene encima por detrás: más rápido que esto hacia ella (m/s), y cuántas veces más rápido la
   * enoja que la rienda tirante. */
  arrear: 0.5,
  arreada: 4,
  /** La altura de la manija de la rienda, quieta (m), y su resorte cuando nadie la agarra (rad/s). */
  alturaRienda: 1.0,
  resorte: 7,
  /** Lo más alto y lo más bajo que sube o baja de un paso (m). */
  escalon: 0.35,
  /** Al escupir: cuánto tarda en darse vuelta y soltarlo (s) y cuánto vuela (s); cuánto para arriba sale el
   * escupido (m/s). */
  apuntar: 0.3,
  vuelo: 0.35,
  arriba: 1.2,
  /** Echada: cuánto baja (m). */
  echada: 0.45,
  /** A cuánto de su casa ya llegó (m), y qué tan rápido gira para mirar como al principio (rad/s). */
  enCasa: 0.12,
  /** La zancada (m por ciclo de las cuatro patas). */
  zancada: 0.9,
  /** El escupitajo, escondido: cuánto más abajo (m). */
  escondido: 40,
  /** El marcador: a cuánto sobre ella (m), más uno por cada estado. */
  marcador: 3,
} as const;

export interface Carguera {
  readonly cual: "carguera";
  readonly nombre: string;
  /** El cuerpo (cinemático): su origen está en el suelo, entre las patas. */
  readonly cuerpo: RAPIER.RigidBody;
  /** La manija de la rienda (suelta, colgada de una soga de verdad). */
  readonly rienda: RAPIER.RigidBody;
  /** El escupitajo (cinemático, sin choques): escondido mientras no vuela. */
  readonly escupitajo: RAPIER.RigidBody;
  /** El marcador del estado (cinemático, sin choques), sobre ella. */
  readonly marcador: RAPIER.RigidBody;
  readonly estado: EstadoLlama;
  /** En qué anda según su marcador: lo que dibuja (también en el invitado, que no corre `antes`). */
  readonly vista: EstadoLlama;
  /** Quién la lleva de la rienda (0 el rojo, 1 el turquesa), o `null`. */
  readonly guia: 0 | 1 | null;
  /** Qué tan rápido anda ahora (m/s) y hacia dónde mira (radianes alrededor de +y). */
  readonly rapidez: number;
  readonly rumbo: number;
  /** Cuánto la están apurando, de 0 a 1 (con 1 se enoja). */
  readonly apuro: number;
  /** Cuántas veces se enojó y cuántas veces le dio a alguien con el escupitajo. */
  readonly enojos: number;
  readonly escupidas: number;
  /** Dónde está su casa (a donde vuelve al enojarse). */
  readonly casa: { readonly x: number; readonly z: number; readonly rumbo: number };
  /** La pone ahí, tranquila y quieta, mirando hacia `rumbo` (al retomar). */
  ponerEn(x: number, z: number, rumbo: number): void;
  /** La pone en su casa, tranquila. */
  volver(): void;
  /** Llegó a donde la llevaban: se queda ahí contenta y ya no se enoja (lo manda el guion). */
  llegar(): void;
  /** Llama a `aviso` cada vez que se enoja (con quién la apuró). */
  alEnojar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cada vez que el escupitajo le da a alguien. */
  alEscupir(aviso: (jugador: 0 | 1) => void): () => void;
}

/** El giro de la llama con ese rumbo (su x local hacia adelante). */
const giroDe = (r: number) => new THREE.Quaternion().setFromAxisAngle(ARRIBA, r - Math.PI / 2);

export function armarCarguera(h: Herramientas, p: Extract<PiezaDelPuenteEnPlano, { cual: "carguera" }>): Carguera {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLAMA;
  const { centro, medio } = p.caja;
  const enX = medio.x >= medio.z;
  const ajuste = enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2);
  const giroCaja = p.caja.giro.clone().multiply(ajuste);
  const mitad = enX ? medio.x : medio.z;
  const medioAncho = enX ? medio.z : medio.x;
  const alto = medio.y * 2;
  const lomo = alto * 0.55;
  const adelanteInicial = EJE_X.clone().applyQuaternion(giroCaja);
  let rumbo = Math.atan2(adelanteInicial.x, adelanteInicial.z);
  let base = centro.y - medio.y;
  let pos = { x: centro.x, z: centro.z };
  const casa = { x: centro.x, z: centro.z, rumbo, base };

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, base, pos.z).setRotation(giroDe(rumbo)),
  );
  // El cuerpo con la carga y el pescuezo con la cabeza: choca con los muñecos
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.62, alto * 0.13, medioAncho).setTranslation(-mitad * 0.12, lomo, 0),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.5, lomo * 0.42, medioAncho * 0.4).setTranslation(
      -mitad * 0.12,
      lomo * 0.42,
      0,
    ),
    cuerpo,
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad * 0.12, alto * 0.22, medioAncho * 0.35).setTranslation(
      mitad * 0.62,
      alto * 0.72,
      0,
    ),
    cuerpo,
  );
  const imagen = crearImagenLlama(h.oscuro, mitad, alto, medioAncho);
  imagen.grupo.name = p.nombre;
  h.escena.add(imagen.rienda);
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  // La rienda: una manija colgada del bozal con una soga de verdad; sin nadie, un resorte la tiene delante de la cabeza
  const bozal = { x: mitad * 0.85, y: alto * 0.82, z: 0 };
  const descanso = () => {
    const q = giroDe(rumbo);
    const p0 = new THREE.Vector3(mitad + 0.3, 0, 0).applyQuaternion(q);
    return new THREE.Vector3(pos.x + p0.x, base + a.alturaRienda, pos.z + p0.z);
  };
  const rienda = mundo.createRigidBody(
    h.dinamico(descanso(), giroDe(rumbo)).setLinearDamping(2).setAngularDamping(3).setCanSleep(false),
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(0.035, 0.035, 0.2)
      .setMass(0.4)
      .setCollisionGroups(GRUPOS_PUENTE)
      .setSolverGroups(SIN_EMPUJAR),
    rienda,
  );
  const soga = mundo.createImpulseJoint(rapier.JointData.rope(p.rienda, bozal, CERO), cuerpo, rienda, true);
  soga.setContactsEnabled(false);
  const imagenManija = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), h.oscuro);
  h.mover(rienda, imagenManija);

  // El escupitajo y el marcador del estado: cinemáticos y sin choques
  const sinChoques = (c: RAPIER.RigidBody) =>
    mundo.createCollider(rapier.ColliderDesc.ball(0.05).setSensor(true).setCollisionGroups(0), c);
  const escondite = () => ({ x: casa.x, y: casa.base - a.escondido, z: casa.z });
  const escupitajo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(casa.x, casa.base - a.escondido, casa.z),
  );
  sinChoques(escupitajo);
  const imagenEscupitajo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), materialOjo());
  h.mover(escupitajo, imagenEscupitajo);
  const marcador = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, base + a.marcador, pos.z),
  );
  sinChoques(marcador);

  // El rayo que busca piso y paredes: no ve a los muñecos, ni lo suelto, ni a ella
  const grupos = ((1 << 16) | (0xffff & ~0b110)) >>> 0;
  const banderas = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const lanzar = (origen: THREE.Vector3Like, dir: THREE.Vector3Like, largo: number) => {
    rayo.origin = vector(origen);
    rayo.dir = vector(dir);
    return mundo.castRay(rayo, largo, true, banderas, grupos, undefined, cuerpo);
  };
  const pisoBajo = (x: number, z: number) => {
    const golpe = lanzar({ x, y: base + 0.8, z }, { x: 0, y: -1, z: 0 }, 0.8 + a.escalon + 0.2);
    return golpe ? base + 0.8 - golpe.timeOfImpact : null;
  };

  let estado: EstadoLlama = "tranquila";
  let guia: 0 | 1 | null = null;
  let rapidez = 0;
  let apuro = 0;
  let enojos = 0;
  let escupidas = 0;
  /** A quién le escupe, cuánto lleva en el estado (s) y desde dónde salió el escupitajo. */
  let objetivo: 0 | 1 = 0;
  let tiempo = 0;
  const salida = new THREE.Vector3();
  let volando = false;
  const avisosEnojo = new Set<(jugador: 0 | 1) => void>();
  const avisosEscupir = new Set<(jugador: 0 | 1) => void>();

  const ponerCuerpo = (ya: boolean) => {
    const q = giroDe(rumbo);
    const y = base - (estado === "echada" ? a.echada : 0);
    if (ya) {
      cuerpo.setTranslation({ x: pos.x, y, z: pos.z }, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation({ x: pos.x, y, z: pos.z });
    cuerpo.setNextKinematicRotation(q);
    const m = { x: pos.x, y: y + a.marcador + ESTADOS_LLAMA.indexOf(estado), z: pos.z };
    if (ya) marcador.setTranslation(m, true);
    marcador.setNextKinematicTranslation(m);
  };
  const esconderEscupitajo = (ya: boolean) => {
    volando = false;
    if (ya) escupitajo.setTranslation(escondite(), true);
    escupitajo.setNextKinematicTranslation(escondite());
  };
  const enojarse = (jugador: 0 | 1) => {
    estado = "escupiendo";
    objetivo = jugador;
    tiempo = 0;
    apuro = 0;
    rapidez = 0;
    enojos++;
    for (const aviso of avisosEnojo) aviso(jugador);
  };
  /** La boca, en el mundo. */
  const boca = () =>
    new THREE.Vector3(mitad * 1.02, alto * 0.86, 0)
      .applyQuaternion(giroDe(rumbo))
      .add(new THREE.Vector3(pos.x, base, pos.z));

  /** Anda hacia `rumboDeseado` a lo sumo `objetivoRapidez`, sin meterse en las paredes ni tirarse a los huecos. */
  const andar = (rumboDeseado: number, objetivoRapidez: number, girar: boolean) => {
    const error = envolver(rumboDeseado - rumbo);
    const giroMax = p.giro * PASO;
    if (girar) rumbo = envolver(rumbo + limitar(error, -giroMax, giroMax));
    const deseada = objetivoRapidez * Math.max(0, Math.cos(error));
    rapidez += limitar(deseada - rapidez, -a.aceleracion * PASO * 2, a.aceleracion * PASO);
    if (rapidez <= 1e-4) return;
    const adelante = new THREE.Vector3(Math.sin(rumbo), 0, Math.cos(rumbo));
    const costado = new THREE.Vector3(Math.cos(rumbo), 0, -Math.sin(rumbo));
    const dx = adelante.x * rapidez * PASO;
    const dz = adelante.z * rapidez * PASO;
    let tapado = false;
    for (const y of [0.35, alto * 0.7])
      for (const s of [-0.8, 0, 0.8]) {
        const o = new THREE.Vector3(pos.x, base + y, pos.z)
          .addScaledVector(adelante, mitad * 0.7)
          .addScaledVector(costado, s * medioAncho);
        if (lanzar(o, adelante, mitad * 0.4 + 0.12 + rapidez * PASO)) tapado = true;
      }
    const frente = new THREE.Vector3(pos.x + dx, 0, pos.z + dz).addScaledVector(adelante, mitad * 0.7);
    const pisoAdelante = pisoBajo(frente.x, frente.z);
    if (pisoAdelante === null || Math.abs(pisoAdelante - base) > a.escalon) tapado = true;
    if (tapado) {
      rapidez = 0;
      return;
    }
    pos = { x: pos.x + dx, z: pos.z + dz };
    const piso = pisoBajo(pos.x, pos.z);
    if (piso !== null) base += (piso - base) * 0.3;
  };

  h.antes((munecos) => {
    guia = null;
    munecos.forEach((m, i) => {
      if (guia === null && i <= 1 && manosEn(m, rienda) > 0) guia = i as 0 | 1;
    });
    // Sin nadie en la rienda, la manija vuelve a colgar delante de la cabeza
    const r = rienda.translation();
    if (guia === null) {
      const d = descanso();
      const v = rienda.linvel();
      const k = a.resorte * a.resorte;
      const c = 2 * a.resorte;
      const masa = rienda.mass();
      rienda.applyImpulse(
        {
          x: (k * (d.x - r.x) - c * v.x) * masa * PASO,
          y: ((k * (d.y - r.y) - c * v.y) * masa - GRAVEDAD * masa) * PASO,
          z: (k * (d.z - r.z) - c * v.z) * masa * PASO,
        },
        true,
      );
    }
    const q = giroDe(rumbo);
    const b = new THREE.Vector3(bozal.x, 0, 0).applyQuaternion(q);
    const distancia = Math.hypot(r.x - (pos.x + b.x), r.z - (pos.z + b.z));
    tiempo += PASO;

    if (estado === "tranquila") {
      // De la rienda: anda hacia el que la lleva, a su paso
      let quiere = 0;
      let hacia = rumbo;
      if (guia !== null) {
        hacia = Math.atan2(r.x - pos.x, r.z - pos.z);
        const tirante = (distancia - a.tirante * p.rienda) / ((a.plena - a.tirante) * p.rienda);
        quiere = p.velocidad * limitar(tirante, 0, 1);
        andar(hacia, quiere, tirante > 0);
      } else andar(rumbo, 0, false);
      // ¿La apuran? La rienda tirante del todo, o alguien que se le viene encima por detrás
      let apurador: 0 | 1 | null = guia !== null && distancia >= a.apurada * p.rienda ? guia : null;
      let arreada = false;
      const inversa = giroDe(rumbo).invert();
      munecos.forEach((m, i) => {
        if (i > 1 || m.estado === "caido") return;
        const t = m.partes.pelvis.translation();
        const l = new THREE.Vector3(t.x - pos.x, 0, t.z - pos.z).applyQuaternion(inversa);
        if (l.x > -mitad * 0.6 || l.x < -mitad - p.arrear || Math.abs(l.z) > medioAncho + 0.35) return;
        const v = new THREE.Vector3().copy(m.partes.pelvis.linvel()).setY(0).applyQuaternion(inversa);
        if (v.x - rapidez > a.arrear) {
          apurador ??= i as 0 | 1;
          arreada = true;
        }
      });
      // Arreada por detrás se enoja más rápido: el que se le viene encima la alcanza enseguida
      if (apurador !== null) apuro += (PASO / p.paciencia) * (arreada ? a.arreada : 1);
      else apuro = Math.max(0, apuro - (a.calmarse * PASO) / p.paciencia);
      if (apuro >= 1) enojarse(apurador ?? 0);
    } else if (estado === "escupiendo") {
      // Se da vuelta hacia el que la apuró y le escupe
      const m = munecos[objetivo];
      const t = m ? new THREE.Vector3().copy(m.partes.pelvis.translation()) : new THREE.Vector3(pos.x, base, pos.z);
      rumbo = envolver(rumbo + limitar(envolver(Math.atan2(t.x - pos.x, t.z - pos.z) - rumbo), -6 * PASO, 6 * PASO));
      if (!volando && tiempo >= a.apuntar) {
        volando = true;
        salida.copy(boca());
      }
      if (volando) {
        const f = limitar((tiempo - a.apuntar) / a.vuelo, 0, 1);
        const donde = salida.clone().lerp(t.clone().setY(t.y + 0.25), f);
        donde.y += 0.4 * 4 * f * (1 - f);
        escupitajo.setNextKinematicTranslation(vector(donde));
        if (f >= 1) {
          // Le dio: lo tumba hacia atrás
          if (m && m.estado !== "caido") {
            const dx = t.x - pos.x;
            const dz = t.z - pos.z;
            const largo = Math.max(1e-3, Math.hypot(dx, dz));
            for (const parte of Object.values(m.partes)) {
              const masa = parte.mass();
              parte.applyImpulse(
                { x: (dx / largo) * p.escupir * masa, y: a.arriba * masa, z: (dz / largo) * p.escupir * masa },
                true,
              );
            }
            escupidas++;
            for (const aviso of avisosEscupir) aviso(objetivo);
          }
          esconderEscupitajo(false);
          estado = "echada";
          tiempo = 0;
        }
      }
    } else if (estado === "echada") {
      rapidez = 0;
      if (tiempo >= p.echarse) {
        estado = "volviendo";
        tiempo = 0;
      }
    } else if (estado === "volviendo") {
      // Se vuelve sola a su casa (con la rienda o sin ella)
      const lejos = Math.hypot(casa.x - pos.x, casa.z - pos.z);
      if (lejos > a.enCasa) andar(Math.atan2(casa.x - pos.x, casa.z - pos.z), p.velocidad, true);
      else {
        rapidez = 0;
        const error = envolver(casa.rumbo - rumbo);
        rumbo = envolver(rumbo + limitar(error, -p.giro * PASO, p.giro * PASO));
        if (Math.abs(error) < 0.05) {
          estado = "tranquila";
          tiempo = 0;
        }
      }
      // Si se atascó contra algo, igual llega (no se queda a medio camino para siempre)
      // (se la pone en la casa de una, como `volver()`: con setNextKinematicTranslation Rapier lo tomaría como un
      // barrido de varios metros en un paso y arrastraría al que tiene la rienda)
      if (tiempo > 30) {
        estado = "tranquila";
        tiempo = 0;
        ponerEn(casa.x, casa.z, casa.rumbo);
      }
    } else {
      // Contenta: se queda donde llegó
      rapidez = 0;
    }
    ponerCuerpo(false);
  });

  // La imagen: las patas con lo que anduvo, echada, las orejas y el pescuezo según el marcador, y la rienda (también
  // en el invitado, que lo lee de los cuerpos)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let andado = 0;
  let brio = 0;
  let visto: EstadoLlama = "tranquila";
  let enElAire = false;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.z - antes.z);
    antes.copy(t);
    andado += d;
    brio += (d / PASO / p.velocidad - brio) * 0.2;
    const k = Math.round(marcador.translation().y - t.y - a.marcador);
    visto = ESTADOS_LLAMA[k] ?? "tranquila";
    enElAire = escupitajo.translation().y > t.y - a.escondido / 2;
  });
  h.dibujar(() => {
    const bozalMundo = new THREE.Vector3(bozal.x, bozal.y, bozal.z)
      .applyQuaternion(imagen.grupo.quaternion)
      .add(imagen.grupo.position);
    imagen.posar(andado / a.zancada, brio, visto, bozalMundo, imagenManija.position);
    imagenEscupitajo.visible = enElAire;
  });

  const ponerEn = (x: number, z: number, r: number) => {
    pos = { x, z };
    rumbo = r;
    rapidez = 0;
    apuro = 0;
    base = pisoBajo(x, z) ?? casa.base;
    ponerCuerpo(true);
    const d = descanso();
    rienda.setTranslation(vector(d), true);
    rienda.setRotation(giroDe(rumbo), true);
    rienda.setLinvel(CERO, true);
    rienda.setAngvel(CERO, true);
    esconderEscupitajo(true);
  };

  return {
    cual: "carguera",
    nombre: p.nombre,
    cuerpo,
    rienda,
    escupitajo,
    marcador,
    get estado() {
      return estado;
    },
    get vista() {
      return visto;
    },
    get guia() {
      return guia;
    },
    get rapidez() {
      return rapidez;
    },
    get rumbo() {
      return rumbo;
    },
    get apuro() {
      return apuro;
    },
    get enojos() {
      return enojos;
    },
    get escupidas() {
      return escupidas;
    },
    casa: { x: casa.x, z: casa.z, rumbo: casa.rumbo },
    ponerEn(x, z, r) {
      if (estado !== "contenta") estado = "tranquila";
      tiempo = 0;
      ponerEn(x, z, r);
    },
    volver() {
      estado = "tranquila";
      tiempo = 0;
      ponerEn(casa.x, casa.z, casa.rumbo);
    },
    llegar() {
      estado = "contenta";
      rapidez = 0;
      apuro = 0;
      esconderEscupitajo(false);
      ponerCuerpo(false);
    },
    alEnojar(aviso) {
      avisosEnojo.add(aviso);
      return () => {
        avisosEnojo.delete(aviso);
      };
    },
    alEscupir(aviso) {
      avisosEscupir.add(aviso);
      return () => {
        avisosEscupir.delete(aviso);
      };
    },
  };
}

/** La llama: el cuerpo lanudo con la carga a los costados (dos atados de paja y un costal), cuatro patas flacas, el
 * pescuezo largo y la cabeza con sus orejas de banano, y la cola corta. Mira hacia +x del marco del cuerpo, con las
 * patas en y = 0. Echada dobla las patas; enojada echa las orejas para atrás; escupiendo tira el pescuezo hacia
 * atrás y alza la trompa. */
export function crearImagenLlama(oscuro: THREE.Material, mitad: number, alto: number, medioAncho: number) {
  const lana = materialTela(COLORES.silueta, { repetir: 2, relieve: 5 });
  const carga = materialTela(COLORES.siluetaLejana, { repetir: 2, relieve: 3 });
  const grupo = new THREE.Group();
  const lomo = alto * 0.55;
  const cuerpoLlama = new THREE.Mesh(
    juntar([
      new THREE.SphereGeometry(1, 14, 10)
        .scale(mitad * 0.62, alto * 0.14, medioAncho * 0.85)
        .translate(-mitad * 0.12, lomo, 0),
      new THREE.SphereGeometry(1, 8, 6).scale(0.12, 0.1, 0.1).translate(-mitad * 0.78, lomo + 0.05, 0),
    ]),
    lana,
  );
  grupo.add(cuerpoLlama);
  // La carga: un atado de paja de cada lado y un costal arriba, amarrados con una cincha
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.16, 0.16, mitad * 0.8, 8)
          .rotateZ(Math.PI / 2)
          .translate(-mitad * 0.12, lomo + 0.02, medioAncho + 0.08),
        new THREE.CylinderGeometry(0.16, 0.16, mitad * 0.8, 8)
          .rotateZ(Math.PI / 2)
          .translate(-mitad * 0.12, lomo + 0.02, -medioAncho - 0.08),
        new THREE.BoxGeometry(mitad * 0.55, 0.22, medioAncho * 1.4).translate(
          -mitad * 0.12,
          lomo + alto * 0.14 + 0.08,
          0,
        ),
      ]),
      carga,
    ),
    new THREE.Mesh(
      new THREE.TorusGeometry(medioAncho * 1.05, 0.025, 4, 16).rotateY(Math.PI / 2).translate(-mitad * 0.1, lomo, 0),
      oscuro,
    ),
  );
  // Las patas: delante y detrás, de cada lado (cada una gira desde la cadera)
  const patas: THREE.Object3D[] = [];
  const largoPata = lomo - alto * 0.08;
  for (const [x, z] of [
    [mitad * 0.35, medioAncho * 0.45],
    [mitad * 0.35, -medioAncho * 0.45],
    [-mitad * 0.55, medioAncho * 0.45],
    [-mitad * 0.55, -medioAncho * 0.45],
  ] as const) {
    const cadera = new THREE.Group();
    cadera.position.set(x, largoPata, z);
    cadera.add(
      new THREE.Mesh(
        juntar([
          new THREE.CylinderGeometry(0.045, 0.035, largoPata, 6).translate(0, -largoPata / 2, 0),
          new THREE.BoxGeometry(0.09, 0.05, 0.07).translate(0.02, -largoPata + 0.025, 0),
        ]),
        lana,
      ),
    );
    grupo.add(cadera);
    patas.push(cadera);
  }
  // El pescuezo con la cabeza, que gira desde la cruz
  const cruz = new THREE.Group();
  cruz.position.set(mitad * 0.45, lomo + 0.05, 0);
  const largoPescuezo = alto * 0.38;
  cruz.add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, largoPescuezo, 8).translate(0, largoPescuezo / 2, 0), lana),
  );
  const cabeza = new THREE.Group();
  cabeza.position.set(0, largoPescuezo, 0);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(1, 10, 8).scale(0.13, 0.1, 0.09).translate(0.06, 0.02, 0),
        new THREE.CylinderGeometry(0.05, 0.065, 0.16, 8).rotateZ(Math.PI / 2).translate(0.2, -0.01, 0),
      ]),
      lana,
    ),
  );
  const ojos = new THREE.Mesh(
    juntar([
      new THREE.SphereGeometry(0.018, 6, 4).translate(0.12, 0.05, 0.07),
      new THREE.SphereGeometry(0.018, 6, 4).translate(0.12, 0.05, -0.07),
    ]),
    materialOjo(),
  );
  cabeza.add(ojos);
  // Las orejas de banano, que se echan para atrás al enojarse
  const orejas = [-1, 1].map((lado) => {
    const o = new THREE.Group();
    o.position.set(-0.01, 0.09, lado * 0.05);
    o.add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5).translate(0, 0.08, 0).rotateX(lado * -0.15), lana));
    cabeza.add(o);
    return o;
  });
  cruz.add(cabeza);
  grupo.add(cruz);
  // La cola, corta y parada
  grupo.add(
    new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6).rotateZ(1.9).translate(-mitad * 0.86, lomo + 0.08, 0), lana),
  );

  const rienda = new THREE.Mesh(
    new THREE.BufferGeometry(),
    materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false }),
  );
  let ultimo = "";
  let echadaVista = 0;
  let pescuezo = 0;
  return {
    grupo,
    /** La soga de la rienda (va suelta en la escena: la arma `posar`). */
    rienda,
    /** `fase` de las patas (ciclos), `brio` de 0 a 1, en qué anda, y la rienda del bozal a la manija. */
    posar(fase: number, brio: number, estado: EstadoLlama, bozal: THREE.Vector3, manija: THREE.Vector3) {
      const echada = estado === "echada" ? 1 : 0;
      echadaVista += (echada - echadaVista) * 0.15;
      const paso = Math.min(1, brio) * 0.45;
      patas.forEach((pata, i) => {
        const desfase = i === 0 || i === 3 ? 0 : Math.PI;
        pata.rotation.z =
          Math.sin(fase * Math.PI * 2 + desfase) * paso * (1 - echadaVista) + echadaVista * (i < 2 ? 1.4 : -1.4);
        pata.scale.y = 1 - 0.45 * echadaVista;
      });
      // El pescuezo: derecho; para atrás al escupir; más bajo echada
      const objetivo = estado === "escupiendo" ? -0.45 : estado === "contenta" ? 0.1 : 0.05 * Math.sin(fase * Math.PI);
      pescuezo += (objetivo - pescuezo) * 0.2;
      cruz.rotation.z = pescuezo;
      cabeza.rotation.z = estado === "escupiendo" ? 0.5 : -pescuezo;
      const enojada = estado === "escupiendo" || estado === "echada" || estado === "volviendo";
      for (const o of orejas) o.rotation.z += ((enojada ? -1.2 : 0) - o.rotation.z) * 0.2;
      const clave = [bozal.x, bozal.y, bozal.z, manija.x, manija.y, manija.z].map((v) => v.toFixed(3)).join(",");
      if (clave === ultimo) return;
      ultimo = clave;
      const medio = bozal.clone().lerp(manija, 0.5);
      medio.y -= Math.max(0, 0.3 - bozal.distanceTo(manija) * 0.2);
      rienda.geometry.dispose();
      rienda.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([bozal, medio, manija]), 8, 0.015, 4, false);
    },
  };
}
