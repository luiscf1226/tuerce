// Mecanismos del nivel 5 (TU-27), que el guion arma con los sólidos y las piezas del .glb:
//   tren       la locomotora (un sólido cinemático) y sus vagones (piezas `vagon`): sale de la estación cuando se lo
//              piden, se esconde mientras va de viaje y llega a otra estación a la hora, con un pito de vapor (otro
//              sólido cinemático que sale por la chimenea)
//   levadizo   un puente (sólido cinemático) que gira sobre una bisagra en una punta: parado o tendido
//   romana     una balanza colgante: una plancha (pieza) alta con ganchos debajo; el racimo que se suelta junto a un
//              gancho libre queda colgado de él, y su peso hunde la plancha
import * as THREE from "three";
import { PASOS_POR_SEGUNDO } from "../../motor/bucle";
import type { NivelEnJuego } from "../guion";
import type { Racimo } from "../piezas-tren";
import { cuerpoDe, suave } from "./comun";
import { crearVia, type Punto } from "./via";

export interface CarroDelTren {
  /** La pieza `vagon` (o, sin nombre de vagón, la locomotora). */
  readonly vagon?: string;
  /** A qué altura sobre el riel va su centro y cuánto mide de largo (m). */
  readonly alto: number;
  readonly largo: number;
}

export interface OpcionesTren {
  /** El sólido cinemático de la locomotora (su origen sobre el riel) y el de su vapor. */
  readonly locomotora: string;
  readonly vapor: string;
  /** Los vagones, de adelante para atrás. */
  readonly vagones: readonly CarroDelTren[];
  /** El largo de la locomotora (m). */
  readonly largo: number;
  /** Por dónde sale (desde el principio de la vía, en x creciente al principio) y por dónde llega. */
  readonly salida: readonly Punto[];
  readonly llegada: readonly Punto[];
  /** Cuánto tarda el viaje, desde que se lo pide hasta que pita en la llegada (pasos). */
  readonly plazo: number;
}

export const AJUSTES_TREN_VIAJE = {
  /** Cuánto espera para arrancar (s), su aceleración (m/s²) hasta `rapido` (m/s) y cuánto tarda en llegar (s). */
  arrancar: 1.5,
  aceleracion: 0.8,
  rapido: 4,
  llegar: 20,
  /** Al llegar se lo ve venir desde tantos metros atrás. */
  desde: 30,
  /** El vapor, en el marco de la locomotora: la boca de la chimenea y adentro de la caldera. Sube tanto (m) en
   * tanto (s). */
  chimenea: [1.4, 2.4, 0],
  adentro: [1.4, 1.3, 0],
  sube: 2.2,
  pita: 2.5,
  /** Donde se esconde mientras va de viaje: bajo tierra. */
  escondido: -30,
  /** Entre carro y carro (m). */
  enganche: 0.15,
} as const;

export interface Tren {
  /** Si ya salió (y en qué paso se lo pidió). */
  readonly salio: boolean;
  readonly salidaEn: number | null;
  /** Si ya llegó y pitó. */
  readonly pito: boolean;
  /** Que salga: arranca al rato, en el paso actual cuenta el plazo. */
  salir(): void;
  /** Ya llegó (al retomar): quieto en la estación de llegada, sin pitar. */
  yaLlego(): void;
  /** Cuánto del viaje pasó, de 0 a 1. */
  readonly viaje: number;
  /** Cada paso, antes de `mundo.step()`. */
  pasar(): void;
}

export function crearTren(nivel: NivelEnJuego, op: OpcionesTren): Tren {
  const a = AJUSTES_TREN_VIAJE;
  const salida = crearVia(op.salida);
  const llegada = crearVia(op.llegada);
  const locomotora = cuerpoDe(nivel, op.locomotora);
  const vapor = cuerpoDe(nivel, op.vapor);
  const x0 = op.salida[0]?.[0] ?? 0;
  const enLaVia = (x: number) => x - x0;
  const arriba = new THREE.Vector3(0, 1, 0);

  let salidaEn: number | null = null;
  /** Dónde iba cada carro en la vía de salida al salir (m): la locomotora y los vagones. */
  let desde: number[] = [];
  let escondido = false;
  let pito = false;
  let llego = false;

  /** Pone el carro `i` (0 la locomotora) en esa pose, con su centro `alto` sobre el riel. */
  const ponerCarro = (i: number, pose: { posicion: THREE.Vector3; giro: THREE.Quaternion }, ya = false) => {
    const carro = i === 0 ? { alto: 0, vagon: undefined } : op.vagones[i - 1];
    if (!carro) return;
    const centro = pose.posicion.clone().addScaledVector(arriba, carro.alto);
    if (carro.vagon === undefined) {
      if (ya) {
        locomotora.setTranslation(centro, true);
        locomotora.setRotation(pose.giro, true);
      }
      locomotora.setNextKinematicTranslation(centro);
      locomotora.setNextKinematicRotation(pose.giro);
    } else nivel.vagon(carro.vagon).llevar(centro, pose.giro);
  };
  /** El vapor: metido en la caldera, o saliendo por la chimenea (`t` de 0 a 1 mientras sube). */
  const ponerVapor = (pose: { posicion: THREE.Vector3; giro: THREE.Quaternion }, t: number | null, ya = false) => {
    const donde = new THREE.Vector3(...(t === null ? a.adentro : a.chimenea))
      .applyQuaternion(pose.giro)
      .add(pose.posicion);
    if (t !== null) donde.addScaledVector(arriba, a.sube * t);
    if (ya) vapor.setTranslation(donde, true);
    vapor.setNextKinematicTranslation(donde);
  };
  /** Dónde va cada carro llegando, con la locomotora en `s` de la vía de llegada. */
  const enLaLlegada = (s: number, ya = false) => {
    let donde = s;
    const loco = llegada.pose(donde);
    ponerCarro(0, loco, ya);
    let largoAntes = op.largo;
    op.vagones.forEach((v, i) => {
      donde -= largoAntes / 2 + a.enganche + v.largo / 2;
      largoAntes = v.largo;
      ponerCarro(i + 1, llegada.pose(donde), ya);
    });
    return loco;
  };
  /** Al final de la vía de llegada, con la trompa en la punta. */
  const finDeLlegada = () => llegada.largo - op.largo / 2;

  const tren: Tren = {
    get salio() {
      return salidaEn !== null;
    },
    get salidaEn() {
      return salidaEn;
    },
    get pito() {
      return pito;
    },
    get viaje() {
      return salidaEn === null ? 0 : llego ? 1 : Math.min(1, (nivel.pasos - salidaEn) / op.plazo);
    },
    salir() {
      if (salidaEn !== null) return;
      salidaEn = nivel.pasos;
      desde = [
        enLaVia(locomotora.translation().x),
        ...op.vagones.map((v) => (v.vagon ? enLaVia(nivel.vagon(v.vagon).cuerpo.translation().x) : 0)),
      ];
    },
    yaLlego() {
      llego = true;
      salidaEn ??= nivel.pasos - op.plazo;
      escondido = true;
      const loco = enLaLlegada(finDeLlegada(), true);
      ponerVapor(loco, null, true);
    },
    pasar() {
      if (salidaEn === null || llego) return;
      const t = (nivel.pasos - salidaEn) / PASOS_POR_SEGUNDO - a.arrancar;
      const llegaEn = op.plazo / PASOS_POR_SEGUNDO - a.arrancar;
      if (t <= 0) return;
      if (!escondido) {
        const acelerando = a.rapido / a.aceleracion;
        const corrido = t < acelerando ? 0.5 * a.aceleracion * t * t : a.rapido * (t - acelerando / 2);
        const loco = salida.pose((desde[0] ?? 0) + corrido);
        ponerCarro(0, loco);
        op.vagones.forEach((_, i) => {
          ponerCarro(i + 1, salida.pose((desde[i + 1] ?? 0) + corrido));
        });
        ponerVapor(loco, null);
        // Lejos, en la niebla, se esconde hasta la hora de llegar
        if ((desde[0] ?? 0) + corrido > salida.largo - op.largo / 2) {
          escondido = true;
          const abajo = (x: number) => ({
            posicion: new THREE.Vector3(x, a.escondido, 0),
            giro: new THREE.Quaternion(),
          });
          ponerCarro(0, abajo(0), true);
          op.vagones.forEach((_, i) => {
            ponerCarro(i + 1, abajo(6 * (i + 1)), true);
          });
          ponerVapor(abajo(0), null, true);
        }
        return;
      }
      if (t < llegaEn - a.llegar) return;
      // Llegando, de a poco; al llegar pita
      const loco = enLaLlegada(finDeLlegada() - a.desde * (1 - suave((t - (llegaEn - a.llegar)) / a.llegar)));
      const pitando = (t - llegaEn) / a.pita;
      pito ||= pitando >= 0;
      ponerVapor(loco, pitando >= 0 && pitando <= 1 ? pitando : null);
      if (pitando > 1) llego = true;
    },
  };
  return tren;
}

export interface Levadizo {
  /** De 0 (parado sobre su bisagra) a 1 (tendido). */
  readonly bajado: number;
  /** Lo lleva hacia `objetivo`, a lo sumo `1 / pasos` por paso (o de una vez, con `ya`). */
  poner(objetivo: number, ya?: boolean): void;
}

/** Un puente levadizo: el sólido cinemático `nombre`, tendido en la escena, gira sobre su punta de +x (la bisagra)
 * hasta quedar parado. */
export function crearLevadizo(nivel: NivelEnJuego, op: { nombre: string; pasos: number }): Levadizo {
  const cuerpo = cuerpoDe(nivel, op.nombre);
  const tendido = new THREE.Vector3().copy(cuerpo.translation());
  const giroTendido = new THREE.Quaternion().copy(cuerpo.rotation());
  const caja = new THREE.Box3().setFromObject(nivel.pieza(op.nombre).objeto);
  // La bisagra: arriba de la punta de +x
  const bisagra = new THREE.Vector3(caja.max.x, caja.max.y, tendido.z);
  const desdeBisagra = tendido.clone().sub(bisagra);
  const eje = new THREE.Vector3(0, 0, 1);
  let bajado = 1;
  return {
    get bajado() {
      return bajado;
    },
    poner(objetivo, ya = false) {
      const paso = 1 / op.pasos;
      bajado = ya ? objetivo : bajado + Math.max(-paso, Math.min(paso, objetivo - bajado));
      const giro = new THREE.Quaternion().setFromAxisAngle(eje, (-Math.PI / 2) * (1 - suave(bajado)));
      const centro = desdeBisagra.clone().applyQuaternion(giro).add(bisagra);
      const q = giro.clone().multiply(giroTendido);
      if (ya) {
        cuerpo.setTranslation(centro, true);
        cuerpo.setRotation(q, true);
      }
      cuerpo.setNextKinematicTranslation(centro);
      cuerpo.setNextKinematicRotation(q);
    },
  };
}

export interface Romana {
  /** El racimo que cuelga de cada gancho (o `null`). */
  readonly colgados: readonly (Racimo | null)[];
  /** Cuelga ese racimo del primer gancho libre (al retomar). */
  colgar(racimo: Racimo): void;
  /** Cada paso, después de los muñecos (cuando ya soltaron lo que soltaron). */
  pasar(): void;
}

/** Una romana: los `ganchos` (en el mundo, en fila a lo largo de x) cuelgan de la plancha `plancha`. El racimo que se
 * suelta debajo de ellos (o a menos de `alcance` de la fila) se cuelga del gancho libre más cerca. */
export function crearRomana(
  nivel: NivelEnJuego,
  op: { plancha: string; ganchos: readonly Punto[]; alcance?: number },
): Romana {
  const alcance = op.alcance ?? 0.75;
  const placa = nivel.plancha(op.plancha).placa;
  const colgados: (Racimo | null)[] = op.ganchos.map(() => null);
  /** El medio de los ganchos y cuánto se abren a lo largo (x). */
  const centro = { x: 0, y: 0, z: 0 };
  for (const [x, y, z] of op.ganchos) {
    centro.x += x / op.ganchos.length;
    centro.y += y / op.ganchos.length;
    centro.z += z / op.ganchos.length;
  }
  const ancho = Math.max(...op.ganchos.map((g) => Math.abs(g[0] - centro.x)));
  const racimos = () => nivel.plano.piezas.filter((p) => p.cual === "racimo").map((p) => nivel.racimo(p.nombre));
  const colgarEn = (r: Racimo, i: number) => {
    const g = op.ganchos[i];
    if (!g) return;
    r.colgarDe(placa, { x: g[0], y: g[1], z: g[2] });
    colgados[i] = r;
  };
  return {
    colgados,
    colgar(r) {
      const i = colgados.indexOf(null);
      if (i < 0) return;
      const g = op.ganchos[i];
      if (g) r.cuerpo.setTranslation({ x: g[0], y: g[1] - 0.35, z: g[2] }, true);
      colgarEn(r, i);
    },
    pasar() {
      // Si alguien se llevó un racimo colgado (lo descolgó), el gancho queda libre
      colgados.forEach((r, i) => {
        if (r && !r.colgado) colgados[i] = null;
      });
      for (const r of racimos()) {
        if (r.agarrado > 0 || r.colgado) continue;
        // El racimo que se suelta debajo del plato (o cerca) va al gancho libre más cerca
        const t = r.cuerpo.translation();
        if (Math.abs(t.x - centro.x) > ancho + alcance || Math.abs(t.z - centro.z) > alcance) continue;
        if (t.y < centro.y - 1.1 || t.y > centro.y + 0.5) continue;
        let i = -1;
        let mejor = Number.POSITIVE_INFINITY;
        op.ganchos.forEach((g, k) => {
          const d = Math.hypot(t.x - g[0], t.z - g[2]);
          if (colgados[k] === null && d < mejor) {
            mejor = d;
            i = k;
          }
        });
        if (i >= 0) colgarEn(r, i);
      }
    },
  };
}
