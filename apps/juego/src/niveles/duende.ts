// El Duende (TU-27): un hombrecito de orejas puntudas que perdió su sombrero y, de puro berrinche, cambia las
// palancas cuando nadie lo ve. Sale de un nodo `tipo: pieza, pieza: duende`; su caja es su casa (se sienta en el
// centro de la base, mirando hacia el frente de la caja).
//
//   · El guion le encarga palancas (`cuidar`), cada una con su agujero al lado. Si una palanca encargada quedó movida,
//     nadie la tiene agarrada y no hay ningún muñeco a menos de `vista` de ella, el Duende se mete en la tierra, sale
//     por el agujero de esa palanca, la vuelve a su lugar y regresa a su casa por debajo de la tierra.
//   · Si le dejan el sombrero en su casa (suelto, a su alcance), se lo pone y se queda contento: ya no toca nada.
//
// Es un cuerpo cinemático sin choques, sin azar: lo mueve esta pieza a paso fijo, así que dos corridas iguales dan lo
// mismo. Viaja en la foto de la red (y el sombrero puesto también); el invitado no lo simula.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelTrenEnPlano } from "./formato-tren";
import type { Herramientas, Palanca } from "./piezas";
import { manosEn } from "./piezas-pinar";
import type { Sombrero } from "./piezas-tren";

export type EstadoDuende = "en casa" | "bajando" | "viajando" | "subiendo" | "cambiando" | "contento";

export interface Duende {
  readonly cual: "duende";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoDuende;
  /** Cuántas palancas cambió. */
  readonly cambios: number;
  /** Si ya tiene su sombrero puesto (y deja las palancas en paz). */
  readonly contento: boolean;
  /** Le encarga una palanca: la que se mueva de donde está ahora la vuelve ahí. `madriguera`: el agujero por donde
   * sale, al lado de la palanca (sobre el piso). */
  cuidar(palanca: Palanca, madriguera: THREE.Vector3Like): void;
  /** Llama a `aviso` cada vez que vuelve una palanca a su lugar. Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: (palanca: Palanca) => void): () => void;
  /** Llama a `aviso` cuando se pone el sombrero. */
  alContentarse(aviso: () => void): () => void;
  /** Le pone el sombrero de una vez (al retomar más allá de donde se lo devolvieron). */
  ponerSombrero(): void;
  /** Lo lleva a su casa, quieto (al retomar). */
  volver(): void;
}

/** Los números del Duende que no se ponen desde Blender. */
export const AJUSTES_DUENDE = {
  /** Cuánto se mete bajo la tierra para que no se lo vea (m) y cuánto tarda en hundirse o en salir (s). */
  hondo: 1.1,
  hundirse: 0.25,
  /** Cuánto tarda en volver la palanca a su lugar (s). */
  cambiar: 0.4,
  /** Movida más que esto (de 0 a 1), la palanca ya está cambiada. */
  movida: 0.25,
  /** El sombrero suelto a menos de esto de él (m, de costado), se lo pone. */
  alcance: 1.1,
  /** Cuánto se agranda su imagen. */
  tamano: 1.35,
  /** Dónde va el sombrero puesto: sobre la cabeza (m). */
  cabeza: 1.12,
} as const;

interface Encargo {
  readonly palanca: Palanca;
  readonly madriguera: THREE.Vector3;
  readonly reposo: { readonly posicion: THREE.Vector3; readonly giro: THREE.Quaternion };
  /** Dónde está la palanca (su base), para ver si alguien la mira. */
  readonly base: THREE.Vector3;
}

const ARRIBA = new THREE.Vector3(0, 1, 0);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function armarDuende(h: Herramientas, p: Extract<PiezaDelTrenEnPlano, { cual: "duende" }>): Duende {
  const { rapier, mundo } = h;
  const a = AJUSTES_DUENDE;
  const { medio, giro } = p.caja;
  const casa = h.enElMundo(p, 0, -medio.y, 0);
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboCasa = Math.atan2(frente.x, frente.z);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(casa.x, casa.y, casa.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumboCasa)),
  );
  // Sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)` y para la foto
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.25).setTranslation(0, 0.4, 0).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenDuende();
  imagen.grupo.name = p.nombre;
  // Más grande que su dibujo (que mide lo de un duende): así se lo ve desde la cámara de los dos
  imagen.grupo.scale.setScalar(AJUSTES_DUENDE.tamano);
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });
  h.escena.add(crearAgujero(casa));

  const encargos: Encargo[] = [];
  let estado: EstadoDuende = "en casa";
  let tiempo = 0;
  let cambios = 0;
  /** Dónde está (sobre el piso) y hacia dónde mira; `hundido` de 0 (afuera) a 1 (bajo tierra). */
  const pos = casa.clone();
  let rumbo = rumboCasa;
  let hundido = 0;
  let desde = casa.clone();
  let hacia = casa.clone();
  let encargo: Encargo | null = null;
  let deVuelta = false;
  const cambiosAvisos = new Set<(palanca: Palanca) => void>();
  const contentos = new Set<() => void>();

  /** Si nadie tiene la palanca agarrada ni anda cerca de ella. */
  const nadieLaVe = (e: Encargo, munecos: readonly Muneco[]) =>
    munecos.every((m) => {
      if (manosEn(m, e.palanca.brazo) > 0) return false;
      const t = m.partes.pelvis.translation();
      return Math.hypot(t.x - e.base.x, t.z - e.base.z) > p.vista;
    });
  const sombreros = () => h.lista.filter((pieza): pieza is Sombrero => pieza.cual === "sombrero");

  const ponerseSombrero = (s: Sombrero) => {
    s.ponerse();
    estado = "contento";
    for (const aviso of contentos) aviso();
  };
  const cabeza = new THREE.Vector3();
  const giroSombrero = new THREE.Quaternion();
  /** El sombrero puesto va sobre la cabeza, con su giro. */
  const llevarSombrero = (ya: boolean) => {
    for (const s of sombreros()) {
      if (!s.puesto) continue;
      cabeza.set(pos.x, pos.y - a.hondo * hundido + a.cabeza, pos.z);
      giroSombrero.setFromAxisAngle(ARRIBA, rumbo).multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, 0.3));
      if (ya) {
        s.cuerpo.setTranslation({ x: cabeza.x, y: cabeza.y, z: cabeza.z }, true);
        s.cuerpo.setRotation(giroSombrero, true);
      }
      s.llevar(cabeza, giroSombrero);
    }
  };

  const ubicar = (ya: boolean) => {
    const donde = { x: pos.x, y: pos.y - a.hondo * hundido, z: pos.z };
    const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);
    if (ya) {
      cuerpo.setTranslation(donde, true);
      cuerpo.setRotation(q, true);
    }
    cuerpo.setNextKinematicTranslation(donde);
    cuerpo.setNextKinematicRotation(q);
    llevarSombrero(ya);
  };

  h.antes((munecos) => {
    tiempo += PASO;
    switch (estado) {
      case "en casa": {
        hundido = 0;
        // ¿Le dejaron el sombrero?
        const sombrero = sombreros().find((s) => {
          if (s.puesto || s.agarrado > 0) return false;
          const t = s.cuerpo.translation();
          return Math.hypot(t.x - pos.x, t.z - pos.z) < a.alcance && t.y > pos.y - 0.3 && t.y < pos.y + 1.6;
        });
        if (sombrero) {
          ponerseSombrero(sombrero);
          break;
        }
        // ¿Alguna palanca encargada quedó movida y sin nadie que la vea?
        const movida = encargos.find((e) => e.palanca.recorrido > a.movida && nadieLaVe(e, munecos));
        if (movida) {
          encargo = movida;
          deVuelta = false;
          desde = casa.clone();
          hacia = movida.madriguera.clone();
          estado = "bajando";
          tiempo = 0;
        }
        break;
      }
      case "bajando":
        hundido = limitar(tiempo / a.hundirse, 0, 1);
        if (hundido >= 1) {
          estado = "viajando";
          tiempo = 0;
        }
        break;
      case "viajando": {
        const t = limitar(tiempo / p.viaje, 0, 1);
        pos.lerpVectors(desde, hacia, t);
        if (t >= 1) {
          // Sale mirando la palanca (o, en su casa, hacia el frente)
          rumbo = encargo && !deVuelta ? rumboHacia(pos, encargo.base) : rumboCasa;
          estado = "subiendo";
          tiempo = 0;
        }
        break;
      }
      case "subiendo":
        hundido = 1 - limitar(tiempo / a.hundirse, 0, 1);
        if (hundido <= 0) {
          estado = deVuelta ? "en casa" : "cambiando";
          tiempo = 0;
        }
        break;
      case "cambiando":
        if (tiempo >= a.cambiar && encargo) {
          // La vuelve a su lugar, si mientras tanto nadie la agarró
          const e = encargo;
          if (munecos.every((m) => manosEn(m, e.palanca.brazo) === 0)) {
            e.palanca.brazo.setTranslation(e.reposo.posicion, true);
            e.palanca.brazo.setRotation(e.reposo.giro, true);
            e.palanca.brazo.setLinvel(CERO, true);
            e.palanca.brazo.setAngvel(CERO, true);
            cambios++;
            for (const aviso of cambiosAvisos) aviso(e.palanca);
          }
          deVuelta = true;
          desde = pos.clone();
          hacia = casa.clone();
          estado = "bajando";
          tiempo = 0;
        }
        break;
      case "contento":
        hundido = 0;
        break;
    }
    ubicar(false);
  });

  // La imagen: se mece un poco; cambiando, empuja con los brazos. Lo mismo en el invitado, con lo que anduvo
  let segundos = 0;
  h.guardar(() => {
    segundos += PASO;
  });
  h.dibujar(() => imagen.posar(segundos, estado === "cambiando", estado === "contento"));

  return {
    cual: "duende",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get cambios() {
      return cambios;
    },
    get contento() {
      return estado === "contento";
    },
    cuidar(palanca, madriguera) {
      const brazo = palanca.brazo;
      const posicion = new THREE.Vector3().copy(brazo.translation());
      const giroBrazo = new THREE.Quaternion().copy(brazo.rotation());
      const agujero = new THREE.Vector3(madriguera.x, madriguera.y, madriguera.z);
      // La base de la palanca: debajo del centro del brazo, a la altura del agujero
      const base = new THREE.Vector3(posicion.x, agujero.y, posicion.z);
      encargos.push({ palanca, madriguera: agujero, reposo: { posicion, giro: giroBrazo }, base });
      h.escena.add(crearAgujero(agujero));
    },
    alCambiar(aviso) {
      cambiosAvisos.add(aviso);
      return () => {
        cambiosAvisos.delete(aviso);
      };
    },
    alContentarse(aviso) {
      contentos.add(aviso);
      return () => {
        contentos.delete(aviso);
      };
    },
    ponerSombrero() {
      pos.copy(casa);
      rumbo = rumboCasa;
      hundido = 0;
      const s = sombreros()[0];
      if (s && !s.puesto) ponerseSombrero(s);
      estado = "contento";
      ubicar(true);
    },
    volver() {
      if (estado === "contento") return;
      estado = "en casa";
      encargo = null;
      pos.copy(casa);
      rumbo = rumboCasa;
      hundido = 0;
      tiempo = 0;
      ubicar(true);
    },
  };
}

const rumboHacia = (de: THREE.Vector3Like, a: THREE.Vector3Like) => Math.atan2(a.x - de.x, a.z - de.z);

/** Un agujero en el piso: una mancha honda y un borde de tierra. */
function crearAgujero(donde: THREE.Vector3Like): THREE.Object3D {
  const oscuro = new THREE.MeshStandardMaterial({ name: "agujero", color: COLORES.siluetaHonda, roughness: 1 });
  const borde = new THREE.MeshStandardMaterial({ name: "borde", color: COLORES.siluetaLejana, roughness: 1 });
  const grupo = new THREE.Group();
  grupo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16), oscuro));
  grupo.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 5, 16).rotateX(Math.PI / 2), borde));
  grupo.position.set(donde.x, donde.y + 0.01, donde.z);
  return grupo;
}

/** El Duende: cabezón, orejas puntudas, nariz larga, panza y pies grandes, de unos 85 cm. Mira hacia +z, con los
 * pies en y = 0. Negro de tela, con los ojos blancos de los muñecos. */
function crearImagenDuende() {
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 3 });
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        // La panza y el pecho
        new THREE.SphereGeometry(0.17, 12, 10).scale(1, 1.15, 0.9).translate(0, 0.32, 0),
        // La cabeza grande, la nariz larga y las orejas puntudas
        new THREE.SphereGeometry(0.16, 14, 10).translate(0, 0.62, 0.02),
        new THREE.ConeGeometry(0.035, 0.16, 6).rotateX(Math.PI / 2).translate(0, 0.6, 0.22),
        ...[-1, 1].map((s) => new THREE.ConeGeometry(0.045, 0.2, 4).rotateZ(-s * 1.2).translate(s * 0.2, 0.68, 0)),
        // Los pies grandes
        ...[-1, 1].map((s) => new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.6, 1.6).translate(s * 0.08, 0.04, 0.05)),
        ...[-1, 1].map((s) => new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6).translate(s * 0.07, 0.12, 0)),
      ]),
      tela,
    ),
  );
  cuerpo.add(
    new THREE.Mesh(
      juntar([-1, 1].map((s) => new THREE.SphereGeometry(0.03, 8, 6).translate(s * 0.06, 0.66, 0.14))),
      materialOjo(),
    ),
  );
  // Los brazos: cruzados de berrinche; cambiando una palanca, para adelante
  const brazos = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(s * 0.15, 0.42, 0);
    g.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 3, 6).translate(0, -0.12, 0), tela));
    cuerpo.add(g);
    return { g, s };
  });
  return {
    grupo,
    posar(t: number, empujando: boolean, contento: boolean) {
      cuerpo.position.y = 0.015 * Math.sin(t * (contento ? 6 : 2.5));
      cuerpo.rotation.z = contento ? 0.08 * Math.sin(t * 3) : 0;
      for (const { g, s } of brazos) {
        if (empujando) {
          g.rotation.set(-1.4, 0, 0);
        } else if (contento) {
          // Saluda con los brazos arriba
          g.rotation.set(0, 0, s * (2.4 + 0.3 * Math.sin(t * 8 + s)));
        } else {
          // Cruzados sobre la panza
          g.rotation.set(-1.2, 0, -s * 0.9);
        }
      }
    },
  };
}
