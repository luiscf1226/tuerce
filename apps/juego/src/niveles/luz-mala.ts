// La Luz Mala (TU-48): una luciérnaga gigante y despistada que alumbra la pampa de noche. Sale de un nodo `tipo:
// pieza, pieza: luz-mala`; su caja dice dónde empieza y cuánto mide.
//
//   · Guía: el guion le da un camino (`guiar`): vuela de parada en parada y en cada una espera a que alguno llegue
//     cerca. En los desvíos que tienen señuelo, a veces se equivoca (azar de semilla, `acierto`): se va titubeando
//     hasta el señuelo, se queda ahí un rato, se da cuenta y vuelve a la parada del desvío. Si alguno se cae (y
//     reaparece atrás) o los pierde, vuelve a buscarlos a la parada que les queda más cerca.
//   · Al final del camino se va a sus posaderos (`posaderos`): se posa en uno, se aburre y se va a otro (azar de
//     semilla). Del que se le acerca sin candil se espanta; el candil, en cambio, le da curiosidad.
//   · Un candil que alguien lleva en la mano y que le llega a `atrapar` la encierra: ya no sale y el candil alumbra.
//
// Es un cuerpo cinemático sin choques, como el Cadejo: lo mueve esta pieza a paso fijo. Viaja en la foto de la red;
// el invitado no la simula: la ve titubear porque llega ladeada (cuando va donde no es se bambolea) y la ve encerrada
// porque está dentro del candil.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDeLaPampaEnPlano } from "./formato-pampa";
import type { Herramientas } from "./piezas";
import type { Candil } from "./piezas-pampa";
import { manosEn } from "./piezas-pinar";

export type EstadoLuz = "esperando" | "volando" | "despistada" | "yendose" | "posada" | "revoloteando" | "encerrada";

export interface LuzMala {
  readonly cual: "luz-mala";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoLuz;
  /** La parada del camino donde espera (o hacia la que va). */
  readonly parada: number;
  /** Cuántas veces se fue por donde no era. */
  readonly extravios: number;
  /** Cuántas veces volvió a buscarlos. */
  readonly vueltas: number;
  /** Si ya terminó de guiar (se fue a sus posaderos o la encerraron). */
  readonly guio: boolean;
  /** El candil donde está encerrada, o `null`. */
  readonly candil: Candil | null;
  /** El camino por donde guía (puntos en el aire, donde se para) y, para cada parada, el señuelo por donde se puede
   * equivocar al salir de ella (o `null`). */
  guiar(camino: readonly THREE.Vector3Like[], senuelos: readonly (THREE.Vector3Like | null)[]): void;
  /** Dónde se posa cuando termina de guiar. */
  posaderos(lista: readonly THREE.Vector3Like[]): void;
  /** Deja de guiar y se va a sus posaderos (`ya`: aparece posada en el primero). */
  irAPosaderos(ya?: boolean): void;
  /** La encierra en ese candil, de una vez (al retomar). */
  encerrar(candil: Candil): void;
  /** Llama a `aviso` cada vez que se equivoca de camino, con la parada de donde salió. */
  alExtraviarse(aviso: (parada: number) => void): () => void;
  /** Llama a `aviso` cuando la encierran, con quién llevaba el candil. */
  alEncerrar(aviso: (jugador: 0 | 1 | null) => void): () => void;
}

/** Los números de La Luz Mala que no se ponen desde Blender. */
export const AJUSTES_LUZ = {
  /** Si nadie queda a menos de esto de su parada (m) por `paciencia` segundos, los fue a buscar. */
  perdidos: 5,
  paciencia: 1.5,
  /** El que aparece de golpe más lejos que esto (m) de donde estaba, se cayó y reapareció: lo va a buscar. */
  reaparecio: 2,
  /** Yéndose a sus posaderos vuela más rápido y más alto (veces su velocidad, m sobre el más alto). */
  yendose: { rapidez: 2, alto: 2.5 },
  /** Cuánto se bambolea despistada (radianes) y qué tan rápido (rad/s). Ladeada más que `ladeada` titila. */
  bambolea: { angulo: 0.45, ritmo: 9 },
  ladeada: 0.15,
  /** Su luz: blanca, como los ojos. */
  luz: { intensidad: 4.5, alcance: 7 },
  /** Encerrada, se achica a esto (veces su tamaño) para caber en el candil. */
  encerrada: 0.22,
} as const;

const vector = (v: THREE.Vector3Like) => ({ x: v.x, y: v.y, z: v.z });
const deCostado = (a: THREE.Vector3Like, b: THREE.Vector3Like) => Math.hypot(a.x - b.x, a.z - b.z);

export function armarLuzMala(h: Herramientas, p: Extract<PiezaDeLaPampaEnPlano, { cual: "luz-mala" }>): LuzMala {
  const { rapier, mundo } = h;
  const a = AJUSTES_LUZ;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  // Un colisionador sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenLuzMala(Math.max(medio.x, medio.y, medio.z));
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const azar = crearAzar(p.semilla ^ 0x1a2b3c);
  let camino: THREE.Vector3[] = [];
  let senuelos: (THREE.Vector3 | null)[] = [];
  let lista: THREE.Vector3[] = [];
  let estado: EstadoLuz = "esperando";
  let parada = 0;
  let posadero = 0;
  let extravios = 0;
  let vueltas = 0;
  let reloj = 0;
  let lejos = 0;
  let candil: Candil | null = null;
  const posicion = new THREE.Vector3().copy(centro);
  const objetivo = new THREE.Vector3().copy(centro);
  let rumbo = 0;
  let t = 0;
  const avisosExtravio = new Set<(parada: number) => void>();
  const avisosEncierro = new Set<(jugador: 0 | 1 | null) => void>();

  const volarA = (destino: THREE.Vector3Like, nuevo: EstadoLuz) => {
    objetivo.copy(destino);
    estado = nuevo;
  };
  /** Avanza hacia el objetivo; devuelve si llegó. */
  const avanzar = (rapidez: number) => {
    const falta = objetivo.clone().sub(posicion);
    const d = falta.length();
    const paso = rapidez * PASO;
    if (d <= paso) {
      posicion.copy(objetivo);
      return true;
    }
    if (Math.hypot(falta.x, falta.z) > 0.05) rumbo = Math.atan2(falta.x, falta.z);
    posicion.addScaledVector(falta, paso / d);
    return false;
  };
  /** El más cerca de ese punto (de costado), y a cuánto. */
  const masCerca = (munecos: readonly Muneco[], punto: THREE.Vector3Like) => {
    let mejor = Number.POSITIVE_INFINITY;
    for (const m of munecos) mejor = Math.min(mejor, deCostado(m.partes.pelvis.translation(), punto));
    return mejor;
  };
  const posarseEn = (k: number) => {
    posadero = k;
    reloj = p.posarse * (0.6 + 0.8 * azar());
  };
  const otroPosadero = () => {
    if (lista.length < 2) return posadero;
    return (posadero + 1 + Math.floor(azar() * (lista.length - 1))) % lista.length;
  };
  const encerrarEn = (c: Candil, jugador: 0 | 1 | null) => {
    if (estado === "encerrada") return;
    estado = "encerrada";
    candil = c;
    c.encender();
    for (const aviso of avisosEncierro) aviso(jugador);
  };

  /** Dónde estaba cada muñeco el paso anterior: el que aparece lejos de golpe, se cayó y reapareció. */
  const antes = [new THREE.Vector3(), new THREE.Vector3()];
  let primero = true;
  /** La parada (hasta la actual) más cerca de ese punto, de costado. */
  const paradaMasCerca = (punto: THREE.Vector3Like) => {
    let mejor = parada;
    let distancia = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= parada; i++) {
      const q = camino[i];
      if (!q) continue;
      const d = deCostado(q, punto);
      if (d < distancia - 0.01) {
        distancia = d;
        mejor = i;
      }
    }
    return mejor;
  };
  /** Vuelve a buscarlos a esa parada. */
  const volverA = (i: number) => {
    const q = camino[i];
    if (!q || i === parada) return;
    vueltas++;
    parada = i;
    volarA(q, "volando");
  };

  h.antes((munecos) => {
    t += PASO;
    let ladeo = 0;
    // Mientras guía, si alguno se cayó (reapareció lejos), vuelve a la parada que le queda más cerca
    const guiando = estado === "esperando" || estado === "volando" || estado === "despistada";
    for (const [j, m] of munecos.entries()) {
      const ahora = m.partes.pelvis.translation();
      const antesJ = antes[j];
      if (!antesJ) continue;
      if (!primero && guiando && camino.length > 0 && antesJ.distanceTo(ahora) > a.reaparecio) {
        volverA(paradaMasCerca(ahora));
      }
      antesJ.copy(ahora);
    }
    primero = false;
    switch (estado) {
      case "esperando": {
        const aca = camino[parada];
        if (!aca) break;
        if (masCerca(munecos, aca) <= p.esperar) {
          lejos = 0;
          const siguiente = camino[parada + 1];
          if (!siguiente) {
            // Llegaron al final: se va a sus posaderos
            const primero = lista[0];
            if (primero) volarA(new THREE.Vector3(primero.x, primero.y + a.yendose.alto, primero.z), "yendose");
            break;
          }
          const senuelo = senuelos[parada];
          if (senuelo && azar() >= p.acierto) {
            // Se equivoca: se va titubeando al señuelo
            extravios++;
            for (const aviso of avisosExtravio) aviso(parada);
            reloj = p.despiste;
            volarA(senuelo, "despistada");
          } else {
            parada++;
            volarA(siguiente, "volando");
          }
          break;
        }
        // ¿Los perdió? Vuelve a la parada que le queda más cerca al más cercano
        if (parada > 0 && masCerca(munecos, aca) > a.perdidos) {
          lejos += PASO;
          if (lejos > a.paciencia) {
            lejos = 0;
            let cerca: Muneco | undefined;
            for (const m of munecos) {
              if (
                !cerca ||
                deCostado(m.partes.pelvis.translation(), aca) < deCostado(cerca.partes.pelvis.translation(), aca)
              )
                cerca = m;
            }
            if (cerca) volverA(paradaMasCerca(cerca.partes.pelvis.translation()));
          }
        } else lejos = 0;
        break;
      }
      case "volando":
        if (avanzar(p.velocidad)) estado = "esperando";
        break;
      case "despistada":
        ladeo = a.bambolea.angulo * Math.sin(t * a.bambolea.ritmo);
        if (avanzar(p.velocidad * 0.8)) {
          reloj -= PASO;
          if (reloj <= 0) {
            // Se da cuenta: vuelve a la parada del desvío y espera ahí a que alguno llegue de nuevo
            volarA(camino[parada] ?? objetivo, "volando");
          }
        }
        break;
      case "yendose":
        if (avanzar(p.velocidad * a.yendose.rapidez)) {
          const primero = lista[0];
          if (primero && objetivo.y > primero.y + 0.01) objetivo.copy(primero);
          else {
            posarseEn(0);
            estado = "posada";
          }
        }
        break;
      case "posada": {
        reloj -= PASO;
        // Del que se acerca sin candil se espanta
        const espantada = munecos.some((m) => {
          if (deCostado(m.partes.pelvis.translation(), posicion) > p.espantar) return false;
          return !h.lista.some((q) => q.cual === "candil" && manosEn(m, q.cuerpo) > 0);
        });
        if (reloj <= 0 || espantada) {
          posarseEn(otroPosadero());
          volarA(lista[posadero] ?? posicion, "revoloteando");
        }
        break;
      }
      case "revoloteando":
        ladeo = 0.12 * Math.sin(t * 5);
        if (avanzar(p.velocidad)) estado = "posada";
        break;
      case "encerrada":
        if (candil) posicion.copy(candil.cuerpo.translation());
        break;
    }
    // Un candil llevado en la mano que le llega cerca, la encierra
    if (estado === "posada" || estado === "revoloteando") {
      for (const q of h.lista) {
        if (q.cual !== "candil") continue;
        const quien = ([0, 1] as const).find((j) => {
          const m = munecos[j];
          return m !== undefined && manosEn(m, q.cuerpo) > 0;
        });
        if (quien === undefined) continue;
        if (posicion.distanceTo(q.cuerpo.translation()) < p.atrapar) {
          encerrarEn(q, quien);
          posicion.copy(q.cuerpo.translation());
          break;
        }
      }
    }
    // Revoloteando un poquito en el lugar, salvo encerrada
    const vuelo = estado === "encerrada" ? 0 : 0.06 * Math.sin(t * 3.1);
    cuerpo.setNextKinematicTranslation({ x: posicion.x, y: posicion.y + vuelo, z: posicion.z });
    cuerpo.setNextKinematicRotation(
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, estado === "encerrada" ? 0 : rumbo, ladeo, "YXZ")),
    );
  });

  // La imagen: aletea, titila si la ve ladeada (despistada) y se achica dentro de un candil
  let pasos = 0;
  let achica = 1;
  h.guardar(() => {
    pasos++;
    const l = cuerpo.translation();
    let adentro = false;
    for (const q of h.lista) {
      if (q.cual !== "candil") continue;
      const c = q.cuerpo.translation();
      if (Math.hypot(l.x - c.x, l.y - c.y, l.z - c.z) < 0.3) adentro = true;
    }
    achica += ((adentro ? a.encerrada : 1) - achica) * 0.15;
  });
  const euler = new THREE.Euler();
  h.dibujar(() => {
    euler.setFromQuaternion(imagen.grupo.quaternion, "YXZ");
    const titila = Math.abs(euler.z) > a.ladeada ? 0.45 + 0.55 * Math.abs(Math.sin(pasos * 0.9)) : 1;
    imagen.posar(pasos * PASO, titila, achica);
  });

  return {
    cual: "luz-mala",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get parada() {
      return parada;
    },
    get extravios() {
      return extravios;
    },
    get vueltas() {
      return vueltas;
    },
    get guio() {
      return estado === "yendose" || estado === "posada" || estado === "revoloteando" || estado === "encerrada";
    },
    get candil() {
      return candil;
    },
    guiar(nuevo, nuevos) {
      camino = nuevo.map((q) => new THREE.Vector3(q.x, q.y, q.z));
      senuelos = nuevos.map((q) => (q ? new THREE.Vector3(q.x, q.y, q.z) : null));
      parada = 0;
      const primera = camino[0];
      if (primera) volarA(primera, "volando");
    },
    posaderos(nuevos) {
      lista = nuevos.map((q) => new THREE.Vector3(q.x, q.y, q.z));
    },
    irAPosaderos(ya = false) {
      if (estado === "encerrada") return;
      const primero = lista[0];
      if (!primero) return;
      if (ya) {
        posicion.copy(primero);
        posarseEn(0);
        objetivo.copy(primero);
        estado = "posada";
        cuerpo.setTranslation(vector(posicion), true);
      } else volarA(new THREE.Vector3(primero.x, primero.y + a.yendose.alto, primero.z), "yendose");
    },
    encerrar(c) {
      encerrarEn(c, null);
      posicion.copy(c.cuerpo.translation());
      cuerpo.setTranslation(vector(posicion), true);
    },
    alExtraviarse(aviso) {
      avisosExtravio.add(aviso);
      return () => {
        avisosExtravio.delete(aviso);
      };
    },
    alEncerrar(aviso) {
      avisosEncierro.add(aviso);
      return () => {
        avisosEncierro.delete(aviso);
      };
    },
  };
}

/** La Luz Mala: una luciérnaga gigante, oscura y con el abdomen que brilla blanco. Mira hacia +z, con `largo` de
 * medio largo. `posar` aletea (`t` en segundos), la hace titilar (de 0 a 1) y la achica. */
function crearImagenLuzMala(largo: number) {
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  const s = largo / 0.5;
  const oscuro = new THREE.MeshStandardMaterial({ name: "luciernaga", color: COLORES.siluetaHonda, roughness: 0.7 });
  // La cabeza con su capucha, el tórax y las patas, las antenas
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.11, 12, 8).scale(1, 0.8, 1.1).translate(0, 0.02, 0.05),
        new THREE.SphereGeometry(0.08, 10, 8).translate(0, 0, 0.2),
        new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
          .scale(1, 0.5, 0.9)
          .translate(0, 0.05, 0.14),
        ...[-1, 1].flatMap((lado) => [
          new THREE.CylinderGeometry(0.008, 0.006, 0.28, 4)
            .rotateX(-1.1)
            .rotateZ(lado * 0.35)
            .translate(lado * 0.05, 0.12, 0.36),
          ...[-0.06, 0.04, 0.13].map((z) =>
            new THREE.CylinderGeometry(0.008, 0.006, 0.18, 4).rotateZ(lado * 1.0).translate(lado * 0.1, -0.08, z),
          ),
        ]),
      ]),
      oscuro,
    ),
  );
  // Los ojos: dos puntos blancos, como los de los muñecos
  const ojos = new THREE.Mesh(
    juntar([-1, 1].map((lado) => new THREE.SphereGeometry(0.024, 6, 5).translate(lado * 0.05, 0.03, 0.26))),
    materialOjo(),
  );
  cuerpo.add(ojos);
  // El abdomen, que brilla
  const brillo = new THREE.MeshStandardMaterial({
    name: "luz-mala",
    color: COLORES.ojo,
    emissive: COLORES.ojo,
    emissiveIntensity: 2,
    roughness: 0.5,
  });
  const abdomen = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 14, 10).scale(1, 0.85, 1.6).translate(0, -0.02, -0.22),
    brillo,
  );
  cuerpo.add(abdomen);
  // Los élitros, oscuros, y las alas de tela, que aletean
  const alas: THREE.Mesh[] = [];
  const tela = new THREE.MeshStandardMaterial({
    name: "alas",
    color: COLORES.siluetaLejana,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const lado of [-1, 1]) {
    const elitro = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI)
        .scale(0.6, 0.35, 2)
        .rotateY(lado * 0.2)
        .translate(lado * 0.06, 0.08, -0.1),
      oscuro,
    );
    cuerpo.add(elitro);
    const ala = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12).scale(1.6, 0.55, 1).rotateX(-Math.PI / 2), tela);
    const pivote = new THREE.Group();
    pivote.position.set(lado * 0.04, 0.1, 0.02);
    ala.position.set(lado * 0.3, 0, -0.06);
    pivote.add(ala);
    pivote.userData.lado = lado;
    cuerpo.add(pivote);
    alas.push(ala);
  }
  const luz = new THREE.PointLight(COLORES.ojo, AJUSTES_LUZ.luz.intensidad, AJUSTES_LUZ.luz.alcance, 2);
  luz.position.set(0, -0.05, -0.22);
  cuerpo.add(luz);
  cuerpo.scale.setScalar(s);
  return {
    grupo,
    posar(t: number, titila: number, achica: number) {
      cuerpo.scale.setScalar(s * achica);
      for (const ala of alas) {
        const pivote = ala.parent;
        if (pivote) pivote.rotation.z = (pivote.userData.lado as number) * (0.25 + 0.6 * Math.sin(t * 38));
      }
      const pulso = 0.8 + 0.2 * Math.sin(t * 2.4);
      brillo.emissiveIntensity = 2 * pulso * titila;
      luz.intensity = AJUSTES_LUZ.luz.intensidad * pulso * titila * (0.5 + 0.5 * achica);
    },
  };
}
