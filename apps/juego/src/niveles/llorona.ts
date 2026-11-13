// La Llorona (TU-42): el alma en pena de Xochimilco, de pie en su chinampa, vestida de blanco y con el rebozo sobre la
// cabeza. Sale de un nodo `tipo: pieza, pieza: llorona`; su caja dice dónde está (los pies abajo de la caja) y hacia
// dónde mira (su frente). Es un fantasma: no choca con nada.
//
//   · Llora: se dobla hacia adelante con las manos en la cara y se le caen las lágrimas. Su `llanto` (de 0 a 1) lo
//     usa el guion para subir el agua: llora tanto que se inunda el canal.
//   · Se ríe de los porrazos: un muñeco que se cae delante de ella (pasa a «caido» a menos de `publico` metros, del
//     lado de su frente) le saca una carcajada: se echa para atrás, se agarra la panza y se sacude. Cada carcajada le
//     baja el llanto; con `risas` carcajadas deja de llorar para siempre y se queda tranquila.
//   · Si pasa `olvido` sin reírse, se olvida de una carcajada y vuelve a llorar más.
//
// Es un cuerpo cinemático sin choques que mueve esta pieza a paso fijo, sin azar. Viaja en la foto de la red: el
// invitado sabe si llora, se ríe o está tranquila por cuánto la ve inclinada.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { EstadoMuneco } from "../muneco";
import type { PiezaDeLosCanalesEnPlano } from "./formato-canales";
import type { Herramientas } from "./piezas";

export type EstadoLlorona = "llorando" | "riendo" | "tranquila";

export interface Llorona {
  readonly cual: "llorona";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Llorando, riéndose o tranquila (también en el invitado, que la ve inclinada). */
  readonly estado: EstadoLlorona;
  /** Cuántas carcajadas lleva (de `risas`) y cuántas le hacen falta para dejar de llorar. */
  readonly risas: number;
  readonly faltan: number;
  /** Cuánto llora, de 0 (nada) a 1 (a mares): baja con cada carcajada; tranquila, 0. */
  readonly llanto: number;
  /** Llama a `aviso` con cada carcajada (con quién se cayó). Devuelve cómo dejar de escuchar. */
  alReir(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando deja de llorar para siempre. */
  alCalmarse(aviso: () => void): () => void;
  /** La deja tranquila (al retomar más adelante). */
  calmar(): void;
}

/** Los números de La Llorona que no se ponen desde Blender. */
export const AJUSTES_LLORONA = {
  /** Cuánto dura una carcajada (s). */
  reir: 2.4,
  /** Inclinada hacia adelante al llorar y hacia atrás al reírse (radianes), y cuánto se sacude (radianes, por
   * segundo). El invitado la ve llorar con más de `vistaLlora` y reírse con menos de `vistaRie`. */
  llorar: { inclinar: 0.22, sollozo: 0.04, ritmo: 1.6 },
  carcajada: { inclinar: -0.26, sacudir: 0.07, ritmo: 7 },
  vistaLlora: 0.12,
  vistaRie: -0.12,
  /** Flota apenas sobre su chinampa: cuánto sube y baja (m) y cada cuánto (s). */
  flotar: { alto: 0.06, periodo: 3.2 },
  /** Las lágrimas: cuántas a la vez y cuánto tardan en caer (s). */
  lagrimas: { cuantas: 10, caer: 0.7 },
} as const;

export function armarLlorona(h: Herramientas, p: Extract<PiezaDeLosCanalesEnPlano, { cual: "llorona" }>): Llorona {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLORONA;
  const { medio, giro } = p.caja;
  const pie = h.enElMundo(p, 0, -medio.y, 0);
  const alto = medio.y * 2;
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro).setY(0).normalize();
  const costado = new THREE.Vector3(1, 0, 0).applyQuaternion(giro);
  /** Su giro, inclinada `angulo` hacia adelante (alrededor de su eje de costado, desde los pies). */
  const inclinada = (angulo: number) => new THREE.Quaternion().setFromAxisAngle(costado, angulo).multiply(giro);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pie.x, pie.y, pie.z)
      .setRotation(inclinada(a.llorar.inclinar)),
  );
  // Sin choques: es un fantasma; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cylinder(alto / 2, Math.max(0.1, Math.min(medio.x, medio.z)))
      .setTranslation(0, alto / 2, 0)
      .setSensor(true)
      .setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenLlorona(alto);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  let estado: EstadoLlorona = "llorando";
  let risas = 0;
  let desdeRisa = 0;
  let riendo = 0;
  let pasos = 0;
  const antes: EstadoMuneco[] = ["de pie", "de pie"];
  const avisosRisa = new Set<(jugador: 0 | 1) => void>();
  const avisosCalma = new Set<() => void>();
  const calmar = () => {
    if (estado === "tranquila") return;
    estado = "tranquila";
    risas = p.risas;
    for (const aviso of avisosCalma) aviso();
  };

  h.antes(() => {
    pasos++;
    const t = pasos * PASO;
    let angulo = 0;
    if (estado === "llorando")
      angulo = a.llorar.inclinar + a.llorar.sollozo * Math.sin(t * a.llorar.ritmo * Math.PI * 2);
    else if (estado === "riendo")
      angulo = a.carcajada.inclinar + a.carcajada.sacudir * Math.sin(t * a.carcajada.ritmo * Math.PI * 2);
    else angulo = 0.03 * Math.sin(t * 0.8);
    const y = a.flotar.alto * (1 + Math.sin((2 * Math.PI * t) / a.flotar.periodo)) * 0.5;
    cuerpo.setNextKinematicTranslation({ x: pie.x, y: pie.y + y, z: pie.z });
    cuerpo.setNextKinematicRotation(inclinada(angulo));
  });

  h.despues((munecos) => {
    // Los porrazos que ve: alguien que se acaba de caer, delante de ella y cerca
    munecos.forEach((m, i) => {
      if (i > 1) return;
      const ahora = m.estado;
      const venia = antes[i];
      antes[i] = ahora;
      if (ahora !== "caido" || venia === "caido" || estado === "tranquila") return;
      const q = m.partes.pelvis.translation();
      const d = new THREE.Vector3(q.x - pie.x, 0, q.z - pie.z);
      if (d.length() > p.publico || d.dot(frente) <= 0) return;
      risas++;
      desdeRisa = 0;
      riendo = a.reir;
      estado = "riendo";
      for (const aviso of avisosRisa) aviso(i as 0 | 1);
      if (risas >= p.risas) {
        // Se ríe la última carcajada y después queda tranquila
        risas = p.risas;
        for (const aviso of avisosCalma) aviso();
      }
    });
    if (estado === "riendo") {
      riendo -= PASO;
      if (riendo <= 0) estado = risas >= p.risas ? "tranquila" : "llorando";
    } else if (estado === "llorando" && risas > 0) {
      desdeRisa += PASO;
      if (desdeRisa > p.olvido) {
        risas--;
        desdeRisa = 0;
      }
    }
  });

  // En el invitado: llora, se ríe o está tranquila según cuánto la ve inclinada
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let vista: EstadoLlorona = "llorando";
  let segundos = 0;
  h.guardar(() => {
    segundos += PASO;
    const q = new THREE.Quaternion().copy(cuerpo.rotation()).multiply(giro.clone().invert());
    // El ángulo alrededor del costado: la inclinación hacia adelante
    const s = q.x * costado.x + q.y * costado.y + q.z * costado.z;
    const angulo = 2 * Math.atan2(q.w < 0 ? -s : s, Math.abs(q.w));
    vista = angulo > a.vistaLlora ? "llorando" : angulo < a.vistaRie ? "riendo" : "tranquila";
  });
  h.dibujar(() => imagen.posar(simulado ? estado : vista, segundos));

  return {
    cual: "llorona",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return simulado ? estado : vista;
    },
    get risas() {
      return risas;
    },
    faltan: p.risas,
    get llanto() {
      return estado === "tranquila" || risas >= p.risas ? 0 : 1 - risas / p.risas;
    },
    alReir(aviso) {
      avisosRisa.add(aviso);
      return () => {
        avisosRisa.delete(aviso);
      };
    },
    alCalmarse(aviso) {
      avisosCalma.add(aviso);
      return () => {
        avisosCalma.delete(aviso);
      };
    },
    calmar() {
      calmar();
      cuerpo.setRotation(inclinada(0), true);
    },
  };
}

/** La Llorona: un vestido largo blanco que se abre hacia el suelo, el rebozo que le tapa la cabeza y cae por la
 * espalda, y los brazos (a la cara al llorar, a la panza al reírse, sueltos tranquila). Con las lágrimas que caen. En
 * su marco: los pies en y = 0, mirando hacia +z. */
function crearImagenLlorona(alto: number) {
  const grupo = new THREE.Group();
  const escala = alto / 2.2;
  // Blanca y un poco transparente: lo único claro del canal, como un velo de niebla
  const blanco = new THREE.MeshStandardMaterial({
    name: "llorona",
    color: COLORES.ojo,
    roughness: 0.9,
    emissive: COLORES.niebla,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.88,
  });
  const sombra = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  // El vestido: un perfil que gira, angosto en la cintura y abierto y desflecado abajo
  const perfil = [
    [0.05, 0],
    [0.42, 0.02],
    [0.36, 0.3],
    [0.26, 0.8],
    [0.17, 1.2],
    [0.2, 1.4],
    [0.17, 1.55],
    [0.08, 1.62],
  ].map(([r, y]) => new THREE.Vector2(r ?? 0, y ?? 0));
  const vestido = new THREE.LatheGeometry(perfil, 18);
  const v = new THREE.Vector3();
  const posiciones = vestido.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    // El ruedo, desflecado y ondulado
    const abajo = Math.max(0, 1 - v.y / 0.4);
    const onda = 1 + 0.12 * abajo * Math.sin(Math.atan2(v.z, v.x) * 7);
    posiciones.setXYZ(i, v.x * onda, v.y - 0.06 * abajo * Math.abs(Math.sin(Math.atan2(v.z, v.x) * 5)), v.z * onda);
  }
  vestido.computeVertexNormals();
  const torso = new THREE.Group();
  grupo.add(torso);
  torso.add(new THREE.Mesh(vestido, blanco));
  // La cabeza con el rebozo: una capucha que cae por la espalda hasta la cintura; la cara, una sombra honda
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.72, 0);
  torso.add(cabeza);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.16, 14, 10).scale(1, 1.15, 1),
        new THREE.ConeGeometry(0.24, 0.9, 12, 1, true).translate(0, -0.35, -0.1).rotateX(0.15),
      ]),
      blanco,
    ),
  );
  cabeza.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8).scale(1, 1.2, 0.6).translate(0, -0.02, 0.1), sombra));
  // Los brazos: mangas largas, del hombro al codo y del codo a la mano
  const brazos = [-1, 1].map((l) => {
    const hombro = new THREE.Group();
    hombro.position.set(l * 0.2, 1.48, 0);
    hombro.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.32, 8).translate(0, -0.16, 0), blanco));
    const codo = new THREE.Group();
    codo.position.set(0, -0.32, 0);
    codo.add(
      new THREE.Mesh(
        juntar([
          new THREE.CylinderGeometry(0.07, 0.1, 0.3, 8).translate(0, -0.15, 0),
          new THREE.SphereGeometry(0.045, 6, 5).translate(0, -0.33, 0),
        ]),
        blanco,
      ),
    );
    hombro.add(codo);
    torso.add(hombro);
    return { hombro, codo, lado: l };
  });
  // Las lágrimas: gotas que caen de la cara al agua (se ven desde lejos: claras y grandes)
  const gota = new THREE.SphereGeometry(0.05, 6, 5).scale(0.7, 1.5, 0.7);
  const agua = new THREE.MeshBasicMaterial({ name: "lagrima", color: COLORES.ojo, transparent: true, opacity: 0.85 });
  const lagrimas = Array.from({ length: AJUSTES_LLORONA.lagrimas.cuantas }, () => {
    const m = new THREE.Mesh(gota, agua);
    grupo.add(m);
    return m;
  });
  grupo.scale.setScalar(escala);
  return {
    grupo,
    posar(estado: EstadoLlorona, t: number) {
      const llora = estado === "llorando";
      const rie = estado === "riendo";
      cabeza.rotation.x = llora ? 0.4 : rie ? -0.45 + 0.1 * Math.sin(t * 40) : 0.05;
      for (const { hombro, codo, lado } of brazos) {
        // Llorando, las manos a la cara; riéndose, a la panza (y se sacude); tranquila, sueltas
        if (llora) {
          hombro.rotation.set(-1.25, 0, -lado * 0.3);
          codo.rotation.set(-1.7, 0, 0);
        } else if (rie) {
          hombro.rotation.set(-0.45 + 0.08 * Math.sin(t * 40 + lado), 0, lado * 0.25);
          codo.rotation.set(-1.4, 0, 0);
        } else {
          hombro.rotation.set(0.05, 0, lado * (0.12 + 0.03 * Math.sin(t * 0.9)));
          codo.rotation.set(-0.15, 0, 0);
        }
      }
      const { cuantas, caer } = AJUSTES_LLORONA.lagrimas;
      lagrimas.forEach((m, i) => {
        m.visible = llora;
        if (!llora) return;
        const f = ((t + (i * caer) / cuantas) % caer) / caer;
        const lado = i % 2 === 0 ? -1 : 1;
        m.position.set(lado * (0.08 + 0.1 * f), 1.6 - 1.6 * f * f, 0.35 + 0.3 * f);
      });
    },
  };
}
