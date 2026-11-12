// La Carreta sin bueyes (TU-25): la carreta que rueda sola y no frena, con el yugo vacío. Sale de un nodo `tipo:
// pieza, pieza: sin-bueyes`; su caja es la carreta donde empieza, y su recorrido va a lo largo de la x de la caja.
//
//   · Rueda de una punta del recorrido a la otra, espera un momento y vuelve, para siempre. Nunca frena sola.
//   · Mientras anda es un espanto: no choca con nada (pasa a través de lo que encuentra), pero al muñeco que alcanza
//     lo saca del camino, de vuelta hacia donde empieza el recorrido (un empujón que lo tira; no hay derrota).
//   · Solo la para su freno: mientras el guion la frena (una palanca que alguien sostiene), se detiene donde está y
//     se vuelve madera: choca como cualquier carreta. Al soltarla, sigue su camino.
//
// Es un cuerpo cinemático: lo mueve esta pieza a paso fijo, sin azar, así que dos corridas iguales dan lo mismo. Como
// todo lo que se mueve, viaja en la foto de la red; el invitado no lo simula y gira las ruedas con lo que anduvo.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDeLaCalleEnPlano } from "./formato-calle";
import type { Herramientas } from "./piezas";
import { crearImagenCarreta, medidasCarreta } from "./piezas-calle";

export type EstadoSinBueyes = "esperando" | "rodando" | "frenando" | "frenada";

export interface SinBueyes {
  readonly cual: "sin-bueyes";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoSinBueyes;
  /** Por dónde va: los metros desde donde empieza, de 0 a `recorrido`. */
  readonly avance: number;
  /** Su velocidad a lo largo del recorrido (m/s; positiva hacia el fondo). */
  readonly velocidad: number;
  /** Cuántas veces sacó a alguien del camino. */
  readonly sacados: number;
  /** Si está parada por el freno. */
  readonly frenada: boolean;
  /** Mientras `si`, frena hasta pararse donde está; si no, sigue su camino. */
  frenar(si: boolean): void;
  /** Llama a `aviso` cada vez que saca a alguien (0 el rojo, 1 el turquesa). Devuelve cómo dejar de escuchar. */
  alSacar(aviso: (jugador: 0 | 1) => void): () => void;
  /** La vuelve a donde empieza, esperando (al retomar en otro punto). */
  volver(): void;
}

/** Los números de la Carreta sin bueyes que no se ponen desde Blender. */
export const AJUSTES_SIN_BUEYES = {
  /** Cómo arranca (m/s²). */
  arranque: 8,
  /** Lo que alcanza, alrededor de su caja (m): a lo largo y a lo ancho. */
  alcance: { largo: 0.3, ancho: 0.2 },
  /** Cuánto para arriba sale el muñeco que saca (m/s). */
  arriba: 1.6,
  /** A uno que ya sacó no lo vuelve a sacar hasta pasado esto (s). */
  respiro: 1,
  /** Más lento que esto no saca a nadie (m/s). */
  minima: 0.5,
} as const;

/** Mientras anda no choca con nada; frenada, choca con todo. */
const ESPANTO = 0;
const MADERA = 0xffffffff;

export function armarSinBueyes(h: Herramientas, p: Extract<PiezaDeLaCalleEnPlano, { cual: "sin-bueyes" }>): SinBueyes {
  const { rapier, mundo } = h;
  const a = AJUSTES_SIN_BUEYES;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const adelante = new THREE.Vector3(1, 0, 0).applyQuaternion(giro);
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  const m = medidasCarreta(medio);
  // Choca como una caja del piso para arriba (la parte de las ruedas no estorba)
  const desdeElPiso = m.rueda;
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, (medio.y * 2 - desdeElPiso) / 2, medio.z)
      .setTranslation(0, desdeElPiso / 2, 0)
      .setCollisionGroups(ESPANTO),
    cuerpo,
  );
  const imagen = crearImagenCarreta(m, { madera: h.madera, oscuro: h.oscuro }, { yugo: true });
  imagen.caja.name = p.nombre;
  imagen.ruedas.position.set(m.eje, -medio.y + m.rueda, 0);
  imagen.caja.add(imagen.ruedas);
  h.mover(cuerpo, imagen.caja);
  h.solida({ nombre: p.nombre, objeto: imagen.caja, cuerpo, colisionador });

  let estado: EstadoSinBueyes = "esperando";
  let avance = 0;
  let velocidad = 0;
  /** Hacia dónde va o va a ir: 1 hacia el fondo, −1 de vuelta. */
  let sentido = 1;
  let espera = p.espera;
  let frenar = false;
  let sacados = 0;
  const respiro: [number, number] = [0, 0];
  const avisos = new Set<(jugador: 0 | 1) => void>();
  const local = new THREE.Vector3();

  const ubicar = (ya = false) => {
    const destino = centro.clone().addScaledVector(adelante, avance);
    if (ya) cuerpo.setTranslation(destino, true);
    cuerpo.setNextKinematicTranslation(destino);
  };
  const madera = (si: boolean) => colisionador.setCollisionGroups(si ? MADERA : ESPANTO);

  /** Lo saca del camino: hacia donde empieza el recorrido, para arriba, y se cae. */
  const sacar = (jugador: 0 | 1, muneco: Muneco) => {
    for (const parte of Object.values(muneco.partes)) {
      const masa = parte.mass();
      parte.applyImpulse(
        { x: -adelante.x * p.empujon * masa, y: a.arriba * masa, z: -adelante.z * p.empujon * masa },
        true,
      );
    }
    sacados++;
    respiro[jugador] = a.respiro;
    for (const aviso of avisos) aviso(jugador);
  };

  h.antes((munecos) => {
    respiro[0] = Math.max(0, respiro[0] - PASO);
    respiro[1] = Math.max(0, respiro[1] - PASO);
    if (frenar) {
      // El freno: se para donde está y se vuelve madera
      const v = Math.max(0, Math.abs(velocidad) - p.frenada * PASO);
      velocidad = Math.sign(velocidad) * v;
      estado = v > 0 ? "frenando" : "frenada";
      if (estado === "frenada") madera(true);
    } else if (estado === "esperando" || estado === "frenada") {
      madera(false);
      if (estado === "frenada")
        estado = velocidad === 0 && (avance <= 0 || avance >= p.recorrido) ? "esperando" : "rodando";
      espera -= PASO;
      if (estado === "esperando" && espera <= 0) estado = "rodando";
    } else {
      madera(false);
      estado = "rodando";
      velocidad += sentido * a.arranque * PASO;
      velocidad = Math.max(-p.velocidad, Math.min(p.velocidad, velocidad));
    }
    avance += velocidad * PASO;
    // En las puntas, espera y da la vuelta
    if ((sentido > 0 && avance >= p.recorrido) || (sentido < 0 && avance <= 0)) {
      avance = sentido > 0 ? p.recorrido : 0;
      velocidad = 0;
      sentido = -sentido;
      espera = p.espera;
      if (!frenar) estado = "esperando";
    }
    ubicar();

    // Al que alcanza mientras anda, lo saca
    if (Math.abs(velocidad) < a.minima) return;
    const c = centro.clone().addScaledVector(adelante, avance);
    munecos.forEach((muneco, i) => {
      const jugador = i as 0 | 1;
      if (respiro[jugador] > 0 || muneco.estado === "caido" || muneco.estado === "levantandose") return;
      const t = muneco.partes.pelvis.translation();
      local.set(t.x - c.x, t.y - c.y, t.z - c.z).applyQuaternion(giroInverso);
      const dentro =
        Math.abs(local.x) < medio.x + a.alcance.largo &&
        Math.abs(local.z) < medio.z + a.alcance.ancho &&
        local.y > -medio.y - 0.3 &&
        local.y < medio.y + 1.2;
      if (dentro) sacar(jugador, muneco);
    });
  });

  // Las ruedas giran con lo que anduvo (también en el invitado, que recibe el cuerpo en la foto)
  let andado = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    andado = (t.x - centro.x) * adelante.x + (t.y - centro.y) * adelante.y + (t.z - centro.z) * adelante.z;
  });
  h.dibujar(() => imagen.rodar(andado));

  return {
    cual: "sin-bueyes",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get avance() {
      return avance;
    },
    get velocidad() {
      return velocidad;
    },
    get sacados() {
      return sacados;
    },
    get frenada() {
      return estado === "frenada";
    },
    frenar(si) {
      frenar = si;
    },
    alSacar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    volver() {
      avance = 0;
      velocidad = 0;
      sentido = 1;
      espera = p.espera;
      estado = frenar ? "frenada" : "esperando";
      madera(frenar);
      ubicar(true);
    },
  };
}
