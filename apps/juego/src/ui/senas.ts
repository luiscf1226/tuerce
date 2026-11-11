// Señalar y gestos (TU-15): para que los dos se entiendan sin hablar.
//
// Señalar: el brazo derecho del muñeco apunta hacia adelante y en el suelo (o en lo que apunte) aparece una marca
// suave, un anillo blanco de niebla con el color de su pañuelo. Lo apuntado sale de un rayo de Rapier desde la
// cabeza hacia donde mira, un poco hacia abajo, que no ve al propio muñeco.
//
// Gestos: saludar, llamar («vení»), festejar y encogerse de hombros. Son poses de los brazos que el muñeco sigue con
// su PD de siempre (`EntradaMuneco.pose`, un agregado chiquito en src/muneco), así que se mueven como trapo y no
// tocan el resto del cuerpo. Duran al menos `DURACION_GESTO` aunque la tecla se suelte antes.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { EntradaJugador, Gesto } from "../entrada/mandos";
import { COLORES } from "../escenas/colores";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import type { EntradaMuneco, Muneco, PoseBrazo, PoseBrazos } from "../muneco";

/** Hacia abajo que mira el rayo de señalar (rad): desde la cabeza llega al suelo a unos 6 m. */
export const INCLINACION_SENAL = 0.2;
/** Hasta dónde llega el rayo de señalar (m). */
export const ALCANCE_SENAL = 16;
/** Lo mínimo que dura un gesto (s). */
export const DURACION_GESTO = 1.2;

export interface Apuntado {
  /** Dónde pega el rayo. */
  punto: THREE.Vector3;
  /** La normal de lo que tocó, para apoyar la marca. */
  normal: THREE.Vector3;
}

/** Un rayo de Rapier reutilizable para `objetivoDeSenal`. */
export function crearRayo(rapier: Rapier): RAPIER.Ray {
  return new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
}

/**
 * Lo que señala `muneco`: un rayo desde la cabeza hacia donde mira (`rumboReal`), `INCLINACION_SENAL` hacia abajo,
 * hasta `ALCANCE_SENAL`. No cuenta las partes del propio muñeco. Escribe en `salida` y la devuelve, o `null` si no
 * pega en nada.
 */
export function objetivoDeSenal(
  mundo: RAPIER.World,
  muneco: Muneco,
  rayo: RAPIER.Ray,
  salida: Apuntado,
): Apuntado | null {
  const cabeza = muneco.partes.cabeza.translation();
  const rumbo = muneco.rumboReal();
  const horizontal = Math.cos(INCLINACION_SENAL);
  rayo.dir.x = Math.sin(rumbo) * horizontal;
  rayo.dir.y = -Math.sin(INCLINACION_SENAL);
  rayo.dir.z = Math.cos(rumbo) * horizontal;
  rayo.origin.x = cabeza.x;
  rayo.origin.y = cabeza.y;
  rayo.origin.z = cabeza.z;
  const propio = (c: RAPIER.Collider) => {
    const cuerpo = c.parent();
    return cuerpo === null || !Object.values(muneco.partes).some((p) => p.handle === cuerpo.handle);
  };
  const golpe = mundo.castRayAndGetNormal(
    rayo,
    ALCANCE_SENAL,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    propio,
  );
  if (!golpe) return null;
  salida.punto.set(
    rayo.origin.x + rayo.dir.x * golpe.timeOfImpact,
    rayo.origin.y + rayo.dir.y * golpe.timeOfImpact,
    rayo.origin.z + rayo.dir.z * golpe.timeOfImpact,
  );
  salida.normal.set(golpe.normal.x, golpe.normal.y, golpe.normal.z);
  return salida;
}

/** La pose del brazo que señala: derecho hacia adelante, apenas por encima de la horizontal. */
export const POSE_SENALAR: Readonly<PoseBrazo> = { afuera: 0.1, arriba: 0.15, adelante: 1 };

/** Escribe en `salida` la pose de `gesto` a los `t` segundos de empezado. */
export function poseDeGesto(gesto: Gesto, t: number, izquierdo: PoseBrazo, derecho: PoseBrazo): PoseBrazos {
  const fijar = (p: PoseBrazo, afuera: number, arriba: number, adelante: number) => {
    p.afuera = afuera;
    p.arriba = arriba;
    p.adelante = adelante;
    return p;
  };
  switch (gesto) {
    case "saludar":
      // La mano derecha arriba, yendo y viniendo de costado
      return { brazoDerecho: fijar(derecho, 0.45 + 0.45 * Math.sin(t * 10), 1, 0.2) };
    case "llamar":
      // La derecha adelante, subiendo y bajando hacia el cuerpo: «vení»
      return { brazoDerecho: fijar(derecho, 0.05, 0.35 + 0.55 * Math.sin(t * 8), 1) };
    case "festejar":
      // Los dos brazos arriba en V, saltando
      fijar(izquierdo, 0.5, 1, 0.15 + 0.3 * Math.sin(t * 12));
      return { brazoIzquierdo: izquierdo, brazoDerecho: fijar(derecho, 0.5, 1, 0.15 + 0.3 * Math.sin(t * 12 + 1)) };
    case "encoger":
      // Los brazos abiertos a los costados, apenas levantados: «ni idea»
      fijar(izquierdo, 1, -0.25 + 0.2 * Math.sin(t * 5), 0.5);
      return { brazoIzquierdo: izquierdo, brazoDerecho: fijar(derecho, 1, -0.25 + 0.2 * Math.sin(t * 5), 0.5) };
  }
}

/** Un gesto en curso: cuál y hace cuánto empezó. */
export interface GestoEnCurso {
  gesto: Gesto | null;
  tiempo: number;
}

/** Avanza un paso el gesto en curso según lo que pide el jugador: empieza al pedirlo, cambia si pide otro y se termina
 * cuando ya no lo pide y pasó `DURACION_GESTO`. */
export function avanzarGesto(enCurso: GestoEnCurso, pedido: Gesto | null): GestoEnCurso {
  if (pedido && pedido !== enCurso.gesto) {
    enCurso.gesto = pedido;
    enCurso.tiempo = 0;
  } else if (enCurso.gesto) {
    enCurso.tiempo += PASO;
    if (!pedido && enCurso.tiempo >= DURACION_GESTO) enCurso.gesto = null;
  }
  return enCurso;
}

export interface Senas {
  /** La entrada del muñeco `j` con la pose de señalar o del gesto; llamar una vez por paso antes de `pasar`. */
  entrada(j: 0 | 1, jugador: EntradaJugador): EntradaMuneco;
  /** Después de `mundo.step()`: busca lo que señala cada uno. */
  apuntar(): void;
  /** Ubica las marcas (`segundos` para que respiren). */
  dibujar(segundos: number): void;
}

/** Las marcas de señalar y las poses de los dos muñecos de una escena. */
export function crearSenas(
  rapier: Rapier,
  mundo: RAPIER.World,
  escena: THREE.Scene,
  munecos: readonly [Muneco, Muneco],
): Senas {
  const anillo = new THREE.RingGeometry(0.17, 0.24, 40);
  const centro = new THREE.RingGeometry(0.07, 0.11, 32);
  const blanco = new THREE.MeshBasicMaterial({
    name: "marca",
    color: COLORES.ojo,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const delJugador = [0, 1].map((j) => {
    const color = new THREE.MeshBasicMaterial({
      name: "marca del pañuelo",
      color: j === 0 ? COLORES.panueloRojo : COLORES.panueloTurquesa,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const marca = new THREE.Group();
    marca.add(new THREE.Mesh(anillo, blanco), new THREE.Mesh(centro, color));
    marca.visible = false;
    escena.add(marca);
    return {
      marca,
      rayo: crearRayo(rapier),
      apuntado: { punto: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) },
      senala: false,
      llego: false,
      gesto: { gesto: null, tiempo: 0 } as GestoEnCurso,
      izquierdo: { afuera: 0, arriba: -1, adelante: 0 },
      derecho: { afuera: 0, arriba: -1, adelante: 0 },
      salida: { avanzar: 0, girar: 0 } as EntradaMuneco,
    };
  });
  const haciaArriba = new THREE.Vector3(0, 0, 1);

  return {
    entrada(j, jugador) {
      const d = delJugador[j];
      if (!d) return jugador;
      avanzarGesto(d.gesto, jugador.gesto);
      d.senala = jugador.senalar;
      const pose: PoseBrazos = d.gesto.gesto ? poseDeGesto(d.gesto.gesto, d.gesto.tiempo, d.izquierdo, d.derecho) : {};
      if (d.senala) pose.brazoDerecho = POSE_SENALAR;
      Object.assign(d.salida, jugador);
      d.salida.pose = pose;
      return d.salida;
    },
    apuntar() {
      munecos.forEach((muneco, j) => {
        const d = delJugador[j];
        if (!d) return;
        d.llego = d.senala && muneco.estado !== "caido" && objetivoDeSenal(mundo, muneco, d.rayo, d.apuntado) !== null;
      });
    },
    dibujar(segundos) {
      for (const d of delJugador) {
        d.marca.visible = d.llego;
        if (!d.llego) continue;
        d.marca.position.copy(d.apuntado.punto).addScaledVector(d.apuntado.normal, 0.02);
        d.marca.quaternion.setFromUnitVectors(haciaArriba, d.apuntado.normal);
        d.marca.scale.setScalar(1 + 0.08 * Math.sin(segundos * 4));
      }
    },
  };
}
