// Los murciélagos de Xibalbá (TU-26): una bandada que vive en un túnel y apaga las antorchas. Sale de un nodo
// `tipo: pieza, pieza: murcielagos`; su caja es el túnel: cuelgan de perchas en el techo y no salen de ahí.
//
//   · Duermen colgados mientras haya luz para todos. Una antorcha alumbra hasta `radio` de su llama.
//   · Si una antorcha encendida queda desatendida adentro del túnel (nadie la lleva con las dos manos), o pasa por
//     debajo de una percha (a menos de `despertar`, de costado), vuelan hasta la llama y la apagan.
//   · Al que anda a oscuras adentro del túnel lo espantan: un aletazo que lo tira hacia la entrada (el −x de la
//     caja). No hay derrota: con la antorcha prendida de nuevo (en el fuego de la entrada) se vuelve a intentar.
//   · Después de apagar o de espantar se quedan quietos arriba un rato (`descanso`).
//
// Es un cuerpo cinemático sin choques, el centro de la bandada, que mueve esta pieza a paso fijo y sin azar: dos
// corridas iguales dan lo mismo. Viaja en la foto de la red; el invitado no lo simula y anima la bandada con lo que
// anduvo (volando alrededor del centro o, quietos un rato, colgados de sus perchas).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDeXibalbaEnPlano } from "./formato-xibalba";
import type { Herramientas } from "./piezas";
import type { Antorcha } from "./piezas-xibalba";

export type EstadoMurcielagos = "colgados" | "a la antorcha" | "espantando" | "descansando" | "volviendo";

export interface Murcielagos {
  readonly cual: "murcielagos";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoMurcielagos;
  /** Cuántas antorchas apagaron. */
  readonly apagadas: number;
  /** Cuántas veces espantaron a alguien. */
  readonly espantados: number;
  /** Dónde cuelgan, en el mundo. */
  readonly perchas: readonly THREE.Vector3[];
  /** Llama a `aviso` cada vez que apagan una antorcha. Devuelve cómo dejar de escuchar. */
  alApagar(aviso: () => void): () => void;
  /** Llama a `aviso` cada vez que espantan a alguien (0 el rojo, 1 el turquesa). */
  alEspantar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Los cuelga de sus perchas, dormidos (al retomar en otro punto). */
  volver(): void;
}

/** Los números de los murciélagos que no se ponen desde Blender. */
export const AJUSTES_MURCIELAGOS = {
  /** A esta distancia de lo que buscan ya lo alcanzan (m). */
  alcanzar: 0.45,
  /** Cuánto para arriba sale el muñeco espantado (m/s). */
  arriba: 1.5,
  /** Cuánto tiene que estar desatendida una antorcha para que vayan a apagarla (s). */
  desatendida: 0.3,
  /** Qué tan rápido aceleran (m/s²). */
  aceleracion: 14,
  /** A esta distancia de la percha de en medio ya llegaron a colgarse (m). */
  enCasa: 0.2,
  /** Lo que bajan desde el techo para colgarse (m). */
  bajoElTecho: 0.3,
} as const;

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function armarMurcielagos(
  h: Herramientas,
  p: Extract<PiezaDeXibalbaEnPlano, { cual: "murcielagos" }>,
): Murcielagos {
  const { rapier, mundo } = h;
  const a = AJUSTES_MURCIELAGOS;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const base = h.enElMundo(p, 0, -medio.y, 0).y;
  const techo = h.enElMundo(p, 0, medio.y, 0).y;
  // Las perchas: repartidas a lo largo de x, alternando de lado
  const perchas = Array.from({ length: p.perchas }, (_, k) =>
    h.enElMundo(
      p,
      -medio.x + ((k + 0.5) * medio.x * 2) / p.perchas,
      medio.y - a.bajoElTecho,
      (k % 2 === 0 ? 1 : -1) * medio.z * 0.5,
    ),
  );
  const casa = perchas[Math.floor(p.perchas / 2)]?.clone() ?? centro.clone();
  /** Hacia dónde salen volando los espantados: la entrada del túnel. */
  const entrada = new THREE.Vector3(-1, 0, 0).applyQuaternion(giro);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(casa.x, casa.y, casa.z),
  );
  // Un colisionador sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const centroImagen = new THREE.Group();
  centroImagen.name = p.nombre;
  h.mover(cuerpo, centroImagen);
  h.solida({ nombre: p.nombre, objeto: centroImagen, cuerpo, colisionador });

  const local = new THREE.Vector3();
  /** Si el punto está adentro del túnel. */
  const adentro = (q: THREE.Vector3Like) => {
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
    return Math.abs(local.x) <= medio.x && Math.abs(local.z) <= medio.z && q.y > base - 0.6 && q.y < techo + 0.5;
  };
  const antorchas = () => h.lista.filter((x): x is Antorcha => x.cual === "antorcha");
  /** Si a ese punto le llega la luz de alguna antorcha encendida. */
  const conLuz = (q: THREE.Vector3Like) =>
    antorchas().some((t) => {
      if (!t.encendida) return false;
      const l = t.llama();
      return Math.hypot(l.x - q.x, l.y - q.y, l.z - q.z) <= p.radio;
    });

  let estado: EstadoMurcielagos = "colgados";
  const pos = casa.clone();
  const vel = new THREE.Vector3();
  let espera = 0;
  let apagadas = 0;
  let espantados = 0;
  const desatendidas = new Map<string, number>();
  const avisosApagar = new Set<() => void>();
  const avisosEspantar = new Set<(jugador: 0 | 1) => void>();
  const deseada = new THREE.Vector3();

  /** Vuela hacia `q` y devuelve a cuánto quedó. */
  const volarHacia = (q: THREE.Vector3Like) => {
    deseada.set(q.x - pos.x, q.y - pos.y, q.z - pos.z);
    const falta = deseada.length();
    deseada.setLength(p.velocidad * limitar(falta / 0.8, 0.2, 1));
    const cambio = deseada.sub(vel);
    const tope = a.aceleracion * PASO;
    if (cambio.length() > tope) cambio.setLength(tope);
    vel.add(cambio);
    pos.addScaledVector(vel, PASO);
    return Math.hypot(q.x - pos.x, q.y - pos.y, q.z - pos.z);
  };

  /** El aletazo: el muñeco sale volando hacia la entrada y para arriba, y se cae. */
  const espantar = (jugador: 0 | 1, m: Muneco) => {
    for (const parte of Object.values(m.partes)) {
      const masa = parte.mass();
      parte.applyImpulse(
        { x: entrada.x * p.empujon * masa, y: a.arriba * masa, z: entrada.z * p.empujon * masa },
        true,
      );
    }
    espantados++;
    estado = "descansando";
    espera = p.descanso;
    for (const aviso of avisosEspantar) aviso(jugador);
  };

  /** La antorcha que hay que ir a apagar: encendida adentro, y desatendida o debajo de una percha. */
  const antorchaQueMolesta = (): Antorcha | null => {
    for (const t of antorchas()) {
      if (!t.encendida) {
        desatendidas.delete(t.nombre);
        continue;
      }
      const l = t.llama();
      if (!adentro(l)) {
        desatendidas.delete(t.nombre);
        continue;
      }
      const sola = t.bienLlevada ? 0 : (desatendidas.get(t.nombre) ?? 0) + PASO;
      desatendidas.set(t.nombre, sola);
      if (sola > a.desatendida) return t;
      if (perchas.some((q) => Math.hypot(q.x - l.x, q.z - l.z) < p.despertar)) return t;
    }
    return null;
  };

  /** El muñeco de pie más cercano que anda a oscuras adentro del túnel. */
  const aOscuras = (munecos: readonly Muneco[]) => {
    let mejor: { jugador: 0 | 1; muneco: Muneco } | null = null;
    let distancia = Number.POSITIVE_INFINITY;
    for (const jugador of [0, 1] as const) {
      const m = munecos[jugador];
      if (!m || m.estado === "caido" || m.estado === "levantandose") continue;
      const t = m.partes.pelvis.translation();
      if (!adentro(t) || conLuz(t)) continue;
      const d = Math.hypot(t.x - pos.x, t.y - pos.y, t.z - pos.z);
      if (d < distancia) {
        distancia = d;
        mejor = { jugador, muneco: m };
      }
    }
    return mejor;
  };

  h.antes((munecos) => {
    if (estado === "descansando") {
      espera -= PASO;
      volarHacia(casa);
      if (espera <= 0) estado = "volviendo";
    } else {
      const antorcha = antorchaQueMolesta();
      const presa = antorcha ? null : aOscuras(munecos);
      if (antorcha) {
        estado = "a la antorcha";
        if (volarHacia(antorcha.llama()) < a.alcanzar) {
          antorcha.apagar();
          apagadas++;
          desatendidas.delete(antorcha.nombre);
          estado = "descansando";
          espera = p.descanso;
          for (const aviso of avisosApagar) aviso();
        }
      } else if (presa) {
        const t = presa.muneco.partes.pelvis.translation();
        estado = "espantando";
        if (volarHacia({ x: t.x, y: t.y + 0.4, z: t.z }) < a.alcanzar + 0.2) espantar(presa.jugador, presa.muneco);
      } else if (pos.distanceTo(casa) > a.enCasa || vel.length() > 0.05) {
        estado = "volviendo";
        volarHacia(casa);
      } else {
        estado = "colgados";
        vel.set(0, 0, 0);
        pos.copy(casa);
      }
    }
    cuerpo.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
  });

  // La imagen: con lo que anduvo el centro en cada paso (también en el invitado, que lo recibe en la foto)
  const bandada = crearBandada(p.cuantos);
  for (const m of bandada) h.escena.add(m.grupo);
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let quieto = 10;
  let pasos = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.y - antes.y, t.z - antes.z);
    antes.copy(t);
    quieto = d < 0.002 ? quieto + PASO : 0;
    pasos++;
  });
  const volando = new THREE.Vector3();
  const colgado = new THREE.Vector3();
  h.dibujar((alfa) => {
    const t = (pasos - 1 + alfa) * PASO;
    // Quietos un rato, se cuelgan de sus perchas; si no, revolotean alrededor del centro
    const cuelgan = limitar((quieto - 0.6) / 0.8, 0, 1);
    const c = centroImagen.position;
    for (const [i, m] of bandada.entries()) {
      const fase = i * 2.39;
      const vuelta = t * (2.2 + (i % 3) * 0.5) + fase;
      const radio = 0.35 + 0.35 * ((i * 0.618) % 1);
      volando.set(
        c.x + Math.cos(vuelta) * radio,
        c.y + 0.25 * Math.sin(vuelta * 2 + fase),
        c.z + Math.sin(vuelta) * radio,
      );
      const percha = perchas[i % perchas.length] ?? casa;
      const fila = Math.floor(i / perchas.length);
      colgado.set(percha.x + (fila - 1) * 0.16, percha.y, percha.z + ((i * 0.37) % 0.3) - 0.15);
      m.grupo.position.lerpVectors(volando, colgado, cuelgan);
      // Volando miran hacia donde van y aletean; colgados, cabeza abajo y con las alas cerradas
      m.grupo.rotation.set(Math.PI * cuelgan, -vuelta * (1 - cuelgan), 0);
      const aleteo = (1 - cuelgan) * Math.sin(t * 22 + fase) * 0.9 + cuelgan * 1.3;
      m.alas[0]?.rotation.set(0, 0, aleteo);
      m.alas[1]?.rotation.set(0, 0, -aleteo);
    }
  });

  const murcielagos: Murcielagos = {
    cual: "murcielagos",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get apagadas() {
      return apagadas;
    },
    get espantados() {
      return espantados;
    },
    perchas,
    alApagar(aviso) {
      avisosApagar.add(aviso);
      return () => {
        avisosApagar.delete(aviso);
      };
    },
    alEspantar(aviso) {
      avisosEspantar.add(aviso);
      return () => {
        avisosEspantar.delete(aviso);
      };
    },
    volver() {
      estado = "colgados";
      pos.copy(casa);
      vel.set(0, 0, 0);
      espera = 0;
      desatendidas.clear();
      cuerpo.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      cuerpo.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
    },
  };
  return murcielagos;
}

/** Cada murciélago: un cuerpito peludo con orejas, dos ojitos blancos y dos alas de piel que aletean. Mira hacia
 * +z, con las alas hacia los costados. */
function crearBandada(cuantos: number) {
  const pelo = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false, relieve: 3 });
  const piel = new THREE.MeshStandardMaterial({
    name: "ala",
    color: COLORES.siluetaHonda,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const ojos = materialOjo();
  const cuerpo = juntar([
    new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.9, 1.3),
    new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.02, 0.09),
    ...[-1, 1].map((s) => new THREE.ConeGeometry(0.018, 0.06, 4).translate(s * 0.025, 0.075, 0.09)),
  ]);
  const ojitos = juntar([-1, 1].map((s) => new THREE.SphereGeometry(0.009, 5, 4).translate(s * 0.02, 0.03, 0.135)));
  const ala = (s: number) => {
    const forma = new THREE.Shape();
    forma.moveTo(0, 0.05);
    forma.lineTo(s * 0.12, 0.06);
    forma.lineTo(s * 0.24, 0.02);
    forma.lineTo(s * 0.2, -0.03);
    forma.lineTo(s * 0.14, -0.01);
    forma.lineTo(s * 0.09, -0.05);
    forma.lineTo(s * 0.05, -0.02);
    forma.lineTo(0, -0.05);
    return new THREE.ShapeGeometry(forma).rotateX(-Math.PI / 2);
  };
  const alas = [ala(1), ala(-1)];
  return Array.from({ length: cuantos }, (_, i) => {
    const grupo = new THREE.Group();
    grupo.name = `murcielago-${i + 1}`;
    grupo.add(new THREE.Mesh(cuerpo, pelo), new THREE.Mesh(ojitos, ojos));
    const dos = alas.map((g) => {
      const pivote = new THREE.Group();
      pivote.add(new THREE.Mesh(g, piel));
      grupo.add(pivote);
      return pivote;
    });
    grupo.scale.setScalar(1.3);
    return { grupo, alas: dos };
  });
}
