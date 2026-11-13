// El Silbón (TU-44): un flaco altísimo, de sombrero, que anda por el llano silbando al revés: si suena cerca, está
// lejos. Sale de un nodo `tipo: pieza, pieza: silbon`; su caja es donde está escondido, agachado en el pajonal.
//
//   · Escondido no se ve (está hundido en el pajonal) y silba: a cada jugador le toca su volumen y su paneo
//     (silbido.ts), fuerte de lejos y bajito de cerca. Suena con Web Audio (silbido-audio.ts) y, para el que juega
//     sin sonido, se ve: unas ondas sobre cada muñeco que se cierran en vez de abrirse, más marcadas cuanto más
//     fuerte suena y corridas hacia el lado de donde viene el silbido.
//   · El primero que llega a `hallar` de él lo halla: se alza, mira al que lo halló, se va caminando y se lo traga el
//     pajonal. Si el guion le dijo dónde esperar (`esperarEn`), aparece ahí, de pie, esperando su saco.
//   · Esperando, el saco de cachivaches (piezas-llano.ts) que le dejan a menos de `alcance` (suelto: nadie lo tiene
//     agarrado) lo recoge, se pone contento y se va con él.
//
// Es un cuerpo cinemático, sin choques y sin azar, que mueve esta pieza a paso fijo. Viaja en la foto de la red: el
// invitado sabe que silba porque lo ve hundido en su escondite, y calcula el silbido y las ondas con los cuerpos tal
// como llegan.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelLlanoEnPlano } from "./formato-llano";
import type { Herramientas } from "./piezas";
import type { Saco } from "./piezas-llano";
import { type Silbido, silbidos } from "./silbido";
import { type AudioDelSilbido, crearAudioDelSilbido } from "./silbido-audio";

export type EstadoSilbon = "escondido" | "saliendo" | "yendose" | "esperando" | "contento" | "ido";

export interface Silbon {
  readonly cual: "silbon";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoSilbon;
  /** Si ya lo hallaron. */
  readonly hallado: boolean;
  /** Si silba (escondido). También en el invitado: lo ve hundido en su escondite. */
  readonly silba: boolean;
  /** Si ya tiene su saco. */
  readonly conSaco: boolean;
  /** Lo que oye cada muñeco de `oir` ahora, con los cuerpos como están (también en el invitado). */
  silbidos(): readonly Silbido[];
  /** Quiénes lo oyen: los dos muñecos (el guion los da en `alEmpezar`, que corre también en el invitado). */
  oir(munecos: readonly Muneco[]): void;
  /** Dónde espera su saco después de que lo hallan (los pies) y hacia dónde mira. */
  esperarEn(donde: THREE.Vector3Like, rumbo: number): void;
  /** Llama a `aviso` cuando lo hallan, con quién. Devuelve cómo dejar de escuchar. */
  alHallar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando recoge su saco. Devuelve cómo dejar de escuchar. */
  alRecibir(aviso: () => void): () => void;
  /** Lo deja ya hallado, esperando su saco (al retomar), sin avisar. */
  hallar(): void;
  /** Le da su saco y lo deja ido (al retomar), sin avisar. */
  recibir(saco: Saco): void;
}

/** Los números del Silbón que no se ponen desde Blender. */
export const AJUSTES_SILBON = {
  /** Escondido, cuánto queda hundido bajo su base (m): no se lo ve. Más hundido que `silba` y a menos de `cerca` de
   * su escondite, silba (así lo sabe el invitado). */
  hundido: 3.4,
  silba: 1,
  cerca: 0.5,
  /** Cuánto tarda en alzarse (s), cuánto se queda mirando al que lo halló y cuánto camina mientras se hunde. */
  salir: 1,
  mirar: 1.8,
  irse: 3.6,
  /** Contento con su saco, cuánto se queda antes de irse (s). */
  festejar: 2.2,
  /** Qué tan rápido gira (rad/s) y cuánto mide una zancada (m). */
  giro: 3,
  zancada: 1.5,
  /** Dónde lleva el saco: corrido a su derecha, a esta altura (en partes de lo que mide) y adelante (m). */
  mano: { lado: -0.42, alto: 0.42, adelante: 0.12 },
  /** Las ondas: cuántas por muñeco, cada cuánto se cierra una (s), de qué radio a qué radio (m), qué tan marcadas
   * con el silbido fuerte y a qué altura sobre la pelvis; hacia qué lado se corren con el paneo (m). */
  ondas: { cuantas: 3, periodo: 1.25, desde: 0.95, hasta: 0.2, opacidad: 0.5, alto: 0.95, corrida: 0.4 },
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
/** Hacia dónde mira la cámara de siempre (escenas/nivel.ts): las ondas se dibujan de frente a ella. */
const HACIA_LA_CAMARA = new THREE.Vector3(0.35, 0.42, 1).normalize();
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const suave = (t: number) => {
  const x = limitar(t, 0, 1);
  return x * x * (3 - 2 * x);
};

export function armarSilbon(h: Herramientas, p: Extract<PiezaDelLlanoEnPlano, { cual: "silbon" }>): Silbon {
  const { rapier, mundo } = h;
  const a = AJUSTES_SILBON;
  const { medio, giro } = p.caja;
  const alto = medio.y * 2;
  const base = h.enElMundo(p, 0, -medio.y, 0);
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboEscondite = Math.atan2(frente.x, frente.z);

  let pos = { x: base.x, y: base.y - a.hundido, z: base.z };
  let rumbo = rumboEscondite;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo)),
  );
  // Sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(alto * 0.4, 0.2)
      .setTranslation(0, alto / 2, 0)
      .setSensor(true)
      .setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenSilbon(alto);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let estado: EstadoSilbon = "escondido";
  let tiempo = 0;
  let espera: { donde: THREE.Vector3; rumbo: number } | null = null;
  let saco: Saco | null = null;
  let oyentes: readonly Muneco[] = [];
  /** Quién lo halló (al que mira al alzarse). */
  let hallador: 0 | 1 = 0;
  const avisosHallar = new Set<(jugador: 0 | 1) => void>();
  const avisosRecibir = new Set<() => void>();

  const ponerEn = (x: number, y: number, z: number, r: number, ya = false) => {
    pos = { x, y, z };
    rumbo = r;
    const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);
    if (ya) {
      cuerpo.setTranslation(pos, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation(pos);
    cuerpo.setNextKinematicRotation(q);
  };
  const girarHacia = (deseado: number) => {
    const max = a.giro * PASO;
    return envolver(rumbo + limitar(envolver(deseado - rumbo), -max, max));
  };
  /** Donde lleva el saco, en el mundo. */
  const mano = () =>
    new THREE.Vector3(a.mano.lado, alto * a.mano.alto, a.mano.adelante)
      .applyAxisAngle(ARRIBA, rumbo)
      .add(new THREE.Vector3(pos.x, pos.y, pos.z));
  const llevarSaco = (ya = false) => {
    if (!saco) return;
    saco.llevar(mano(), new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo), ya);
  };
  /** Aparece de pie donde espera (o se queda hundido donde está, si nadie le dijo dónde). */
  const irAEsperar = (ya: boolean) => {
    if (espera) {
      estado = "esperando";
      ponerEn(espera.donde.x, espera.donde.y, espera.donde.z, espera.rumbo, ya);
    } else {
      estado = "ido";
      ponerEn(pos.x, base.y - a.hundido, pos.z, rumbo, ya);
    }
  };

  h.antes(() => {
    tiempo += PASO;
    switch (estado) {
      case "escondido":
        ponerEn(base.x, base.y - a.hundido, base.z, rumboEscondite);
        break;
      case "saliendo": {
        // Se alza y se queda mirando al que lo halló; después se va
        const f = suave(tiempo / a.salir);
        const quien = oyentes[hallador]?.partes.pelvis.translation();
        const r = quien ? girarHacia(Math.atan2(quien.x - pos.x, quien.z - pos.z)) : rumbo;
        ponerEn(base.x, base.y - a.hundido * (1 - f), base.z, r);
        if (tiempo > a.salir + a.mirar) {
          estado = "yendose";
          tiempo = 0;
        }
        break;
      }
      case "yendose":
      case "ido": {
        // Camina hacia atrás de su escondite (o de donde esperaba) y se lo traga el pajonal
        const r = girarHacia(estado === "yendose" ? rumboEscondite + Math.PI : (espera?.rumbo ?? rumbo) + Math.PI);
        const f = tiempo / a.irse;
        const v = p.velocidad * limitar(1.4 - f, 0, 1);
        const abajo =
          (estado === "yendose" ? base.y : (espera?.donde.y ?? base.y)) - a.hundido * suave((f - 0.3) / 0.7);
        ponerEn(pos.x + Math.sin(r) * v * PASO, abajo, pos.z + Math.cos(r) * v * PASO, r);
        llevarSaco();
        if (estado === "yendose" && f >= 1) irAEsperar(true);
        break;
      }
      case "esperando": {
        // Mira al muñeco más cercano y espera su saco
        let cerca: THREE.Vector3Like | null = null;
        let d = Number.POSITIVE_INFINITY;
        for (const m of oyentes) {
          const t = m.partes.pelvis.translation();
          const dm = Math.hypot(t.x - pos.x, t.z - pos.z);
          if (dm < d) {
            d = dm;
            cerca = t;
          }
        }
        const r = cerca && d < 8 ? girarHacia(Math.atan2(cerca.x - pos.x, cerca.z - pos.z)) : rumbo;
        ponerEn(pos.x, pos.y, pos.z, r);
        for (const pieza of h.lista) {
          if (pieza.cual !== "saco" || pieza.entregado || pieza.agarrado > 0) continue;
          const t = pieza.cuerpo.translation();
          const cercaDeEl = Math.hypot(t.x - pos.x, t.z - pos.z) < p.alcance;
          if (!cercaDeEl || t.y < pos.y - 0.5 || t.y > pos.y + alto * 0.8) continue;
          saco = pieza;
          pieza.entregar();
          estado = "contento";
          tiempo = 0;
          llevarSaco();
          for (const aviso of avisosRecibir) aviso();
          break;
        }
        break;
      }
      case "contento":
        ponerEn(pos.x, pos.y, pos.z, rumbo);
        llevarSaco();
        if (tiempo > a.festejar) {
          estado = "ido";
          tiempo = 0;
        }
        break;
    }
  });

  h.despues((munecos) => {
    if (estado !== "escondido") return;
    for (const jugador of [0, 1] as const) {
      const t = munecos[jugador]?.partes.pelvis.translation();
      if (!t || Math.hypot(t.x - base.x, t.z - base.z) > p.hallar) continue;
      estado = "saliendo";
      tiempo = 0;
      hallador = jugador;
      for (const aviso of avisosHallar) aviso(jugador);
      return;
    }
  });

  /** Si silba, con el cuerpo como está (el del anfitrión o el de la foto). */
  const silbaAhora = () => {
    const t = cuerpo.translation();
    return t.y < base.y - a.silba && Math.hypot(t.x - base.x, t.z - base.z) < a.cerca;
  };
  const oirAhora = () =>
    silbidos(
      silbaAhora() ? cuerpo.translation() : null,
      oyentes.map((m) => m.partes.pelvis.translation()),
    );

  // La imagen: con lo que anduvo en cada paso (también en el invitado, que recibe el cuerpo en la foto)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let andado = 0;
  let brio = 0;
  let pasos = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.z - antes.z);
    antes.copy(t);
    // Los saltos (aparecer donde espera) no son pasos
    if (d < 0.5) {
      andado += d;
      brio += (d / PASO / p.velocidad - brio) * 0.15;
    }
    pasos++;
  });
  const ondas = crearOndas(h.escena);
  let audio: AudioDelSilbido | null = null;
  /** Cuántos cuadros seguidos se dibujaron sin un paso nuevo: en pausa el silbido se calla en vez de quedar fijo. */
  let sinPasos = 0;
  let pasosDibujados = 0;
  h.dibujar(() => {
    sinPasos = pasos === pasosDibujados ? sinPasos + 1 : 0;
    pasosDibujados = pasos;
    const t = pasos * PASO;
    imagen.posar(andado / a.zancada, brio, t);
    const lo = oirAhora();
    ondas.poner(
      t,
      oyentes.map((m) => m.partes.pelvis.translation()),
      lo,
    );
    if (oyentes.length > 0) {
      audio ??= crearAudioDelSilbido(oyentes.length);
      audio.poner(t, sinPasos > 12 ? [] : lo);
    }
  });

  return {
    cual: "silbon",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get hallado() {
      return estado !== "escondido";
    },
    get silba() {
      return silbaAhora();
    },
    get conSaco() {
      return saco !== null;
    },
    silbidos: oirAhora,
    oir(munecos) {
      oyentes = munecos;
    },
    esperarEn(donde, r) {
      espera = { donde: new THREE.Vector3().copy(donde), rumbo: r };
    },
    alHallar(aviso) {
      avisosHallar.add(aviso);
      return () => {
        avisosHallar.delete(aviso);
      };
    },
    alRecibir(aviso) {
      avisosRecibir.add(aviso);
      return () => {
        avisosRecibir.delete(aviso);
      };
    },
    hallar() {
      if (estado !== "escondido" && estado !== "saliendo" && estado !== "yendose") return;
      tiempo = 0;
      irAEsperar(true);
    },
    recibir(s) {
      saco = s;
      s.entregar();
      estado = "ido";
      tiempo = a.irse;
      const donde = espera?.donde ?? base;
      ponerEn(donde.x, donde.y - a.hundido, donde.z, espera?.rumbo ?? rumbo, true);
      llevarSaco(true);
    },
  };
}

/** Las ondas del silbido, para el que juega sin sonido: sobre cada muñeco, anillos que se cierran (al revés que las
 * ondas de un sonido, que se abren), más marcados cuanto más fuerte suena y corridos hacia el lado de donde viene. */
function crearOndas(escena: THREE.Scene) {
  const a = AJUSTES_SILBON.ondas;
  const geometria = new THREE.RingGeometry(0.9, 1, 48);
  const grupos: { grupo: THREE.Group; anillos: { malla: THREE.Mesh; material: THREE.MeshBasicMaterial }[] }[] = [];
  const deFrente = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), HACIA_LA_CAMARA);
  const grupoDe = (i: number) => {
    let g = grupos[i];
    if (!g) {
      const grupo = new THREE.Group();
      grupo.quaternion.copy(deFrente);
      const anillos = Array.from({ length: a.cuantas }, () => {
        const material = new THREE.MeshBasicMaterial({
          name: "ondas-del-silbido",
          color: COLORES.siluetaHonda,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const malla = new THREE.Mesh(geometria, material);
        grupo.add(malla);
        return { malla, material };
      });
      escena.add(grupo);
      g = { grupo, anillos };
      grupos[i] = g;
    }
    return g;
  };
  return {
    /** `t`: los segundos; `donde`: la pelvis de cada uno; `lo`: lo que oye cada uno. */
    poner(t: number, donde: readonly THREE.Vector3Like[], lo: readonly Silbido[]) {
      for (const [i, p] of donde.entries()) {
        const { grupo, anillos } = grupoDe(i);
        const s = lo[i] ?? { volumen: 0, paneo: 0 };
        grupo.visible = s.volumen > 0.001;
        if (!grupo.visible) continue;
        grupo.position.set(p.x + s.paneo * a.corrida, p.y + a.alto, p.z);
        for (const [k, { malla, material }] of anillos.entries()) {
          const fase = (((t / a.periodo + k / a.cuantas) % 1) + 1) % 1;
          // Se cierra: de grande a chico
          malla.scale.setScalar(a.desde + (a.hasta - a.desde) * fase);
          material.opacity = a.opacidad * s.volumen * Math.sin(Math.PI * fase);
        }
      }
    },
  };
}

/** El Silbón: piernas larguísimas, un tronco flaco, brazos que le llegan a las rodillas, la cabeza chica con los dos
 * ojos blancos y un sombrero de ala ancha. Mira hacia +z, con los pies en y = 0; mide `alto`. */
function crearImagenSilbon(alto: number) {
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 3 });
  const grupo = new THREE.Group();
  const s = alto / 3.2;
  const cadera = 1.7 * s;
  const hombro = 2.62 * s;

  const piernas = [-1, 1].map((lado) => {
    const g = new THREE.Group();
    g.position.set(lado * 0.11 * s, cadera, 0);
    g.add(
      new THREE.Mesh(
        juntar([
          new THREE.CapsuleGeometry(0.06 * s, cadera - 0.16 * s, 4, 8).translate(0, -cadera / 2, 0),
          new THREE.BoxGeometry(0.11 * s, 0.06 * s, 0.26 * s).translate(0, -cadera + 0.03 * s, 0.07 * s),
        ]),
        tela,
      ),
    );
    grupo.add(g);
    return g;
  });
  // El tronco, flaco y un poco encorvado, con la camisa suelta
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CapsuleGeometry(0.13 * s, hombro - cadera - 0.1 * s, 4, 10)
          .translate(0, (cadera + hombro) / 2, 0)
          .rotateX(0.04),
        new THREE.ConeGeometry(0.2 * s, 0.45 * s, 10, 1, true).translate(0, cadera + 0.12 * s, 0),
      ]),
      tela,
    ),
  );
  const brazos = [-1, 1].map((lado) => {
    const g = new THREE.Group();
    g.position.set(lado * 0.2 * s, hombro, 0);
    const largo = 1.25 * s;
    g.add(
      new THREE.Mesh(
        juntar([
          new THREE.CapsuleGeometry(0.045 * s, largo, 4, 8).translate(0, -largo / 2, 0),
          new THREE.SphereGeometry(0.07 * s, 8, 6).translate(0, -largo - 0.04 * s, 0),
        ]),
        tela,
      ),
    );
    g.rotation.z = lado * 0.08;
    grupo.add(g);
    return g;
  });
  // La cabeza chica, el cuello largo y el sombrero de ala ancha, algo caído hacia adelante
  const cabeza = new THREE.Group();
  cabeza.position.set(0, hombro + 0.12 * s, 0.03 * s);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.16 * s, 8).translate(0, 0.02 * s, 0),
        new THREE.SphereGeometry(0.13 * s, 12, 10).scale(0.9, 1.15, 0.95).translate(0, 0.2 * s, 0.02 * s),
        new THREE.CylinderGeometry(0.42 * s, 0.42 * s, 0.025 * s, 24).translate(0, 0.33 * s, 0),
        new THREE.CylinderGeometry(0.13 * s, 0.16 * s, 0.2 * s, 14).translate(0, 0.43 * s, 0),
      ]).rotateX(0.12),
      tela,
    ),
  );
  cabeza.add(
    new THREE.Mesh(
      juntar(
        [-1, 1].map((lado) => new THREE.SphereGeometry(0.022 * s, 8, 6).translate(lado * 0.05 * s, 0.22 * s, 0.13 * s)),
      ),
      materialOjo(),
    ),
  );
  grupo.add(cabeza);

  return {
    grupo,
    /** `vuelta`: cuántas zancadas lleva; `brio`: qué tan rápido va (0 a 1); `t`: los segundos. */
    posar(vuelta: number, brio: number, t: number) {
      const f = limitar(brio, 0, 1);
      const angulo = vuelta * Math.PI * 2;
      for (const [i, g] of piernas.entries()) g.rotation.x = 0.45 * f * Math.sin(angulo + i * Math.PI);
      for (const [i, g] of brazos.entries()) g.rotation.x = -0.35 * f * Math.sin(angulo + i * Math.PI);
      // Quieto, se mece apenas, como quien silba
      cabeza.rotation.z = 0.05 * Math.sin(t * 1.3) * (1 - f);
    },
  };
}
