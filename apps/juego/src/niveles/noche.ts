// Noche de tuerce (TU-33): cualquier nivel, de noche y con una trampa sorpresa. La trampa la elige una semilla:
// con la misma semilla sale la misma. En línea la elige el anfitrión (es el que simula) y viaja en las fotos: el
// invitado la recibe y la muestra (red/paquetes.ts, cuatro bits libres del byte de los agarres).
//
// Parámetros de la escena `nivel` (y `en-linea`):
//   &noche              de noche, con una semilla al azar
//   &noche=<semilla>    de noche, con esa semilla (un entero)
//   &trampa=<nombre>    fuerza esa trampa (para capturas y pruebas); también pone la noche
//
// Las trampas son genéricas: no saben nada del nivel, solo de los dos muñecos, el mundo y la escena. Cada una arma
// su efecto y lo quita sin dejar rastro. Lo que tocan:
//   · la entrada de cada jugador (antes de la red: el invitado manda su entrada ya cambiada, así su predicción
//     coincide con lo que simula el anfitrión),
//   · las físicas en cada paso (solo quien simula: el anfitrión, o los dos en el mismo lugar), siempre de a PASO,
//   · la imagen (el mecate y la niebla espesa, que ven los dos).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { EntradaJugador } from "../entrada/mandos";
import { crearAzar } from "../imagen/ruido";
import { PASO, PASOS_POR_SEGUNDO } from "../motor/bucle";
import { GRAVEDAD, type Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";

/** Los colores de la noche: niebla de luna, todavía clara para que las siluetas oscuras se lean encima. Grises, como
 * todo lo que no es pañuelo (imagen/paleta.ts). */
export const COLORES_NOCHE = {
  niebla: 0x9fa3a8,
  cielo: 0xc8cdd3,
  sueloLuz: 0x46484c,
  luna: 0xe4e8ee,
} as const;

/** Cuánto bajan las luces de día de noche (veces su intensidad). */
const LUCES_NOCHE = { cielo: 0.42, sol: 0.3, relleno: 0.6 } as const;

export type NombreTrampa = "cruzados" | "jabon" | "viento" | "luna" | "mecate" | "niebla";

export interface ContextoTrampa {
  readonly rapier: Rapier;
  readonly mundo: RAPIER.World;
  readonly escena: THREE.Scene;
  readonly munecos: readonly [Muneco, Muneco];
  readonly semilla: number;
}

/** Lo que hace una trampa mientras está puesta. Todo es opcional salvo quitarla. */
export interface Efecto {
  /** Cambia la entrada de un jugador (0 el rojo, 1 el turquesa) en cada paso, antes de la red. */
  entrada?(e: EntradaJugador, jugador: 0 | 1): EntradaJugador;
  /** En cada paso que se simula, después de los muñecos y antes de `mundo.step()`. */
  antes?(): void;
  /** En cada cuadro. */
  dibujar?(alfa: number): void;
  /** Por cuánto se multiplica la distancia de la niebla del nivel (1 = la de siempre). */
  readonly niebla?: number;
  /** Deja el mundo y la escena como estaban. */
  quitar(): void;
}

export interface Trampa {
  readonly nombre: NombreTrampa;
  /** El título del cartel. */
  readonly titulo: string;
  /** La línea graciosa del cartel: qué les tocó. */
  readonly cartel: string;
  armar(contexto: ContextoTrampa): Efecto;
}

// ── Brazos cruzados ─────────────────────────────────────────────────────────────────────────────────────────

/** Izquierda y derecha cambiadas: el giro al revés, los brazos y los gestos de costado también. */
export function cruzar(e: EntradaJugador): EntradaJugador {
  const gesto = e.gesto === "saludar" ? "llamar" : e.gesto === "llamar" ? "saludar" : e.gesto;
  return { ...e, girar: -e.girar, brazoIzquierdo: e.brazoDerecho, brazoDerecho: e.brazoIzquierdo, gesto };
}

// ── Piso jabonoso ───────────────────────────────────────────────────────────────────────────────────────────

/** El piso jabonoso: lo fijo agarra esto (el rozamiento de siempre de los sólidos es 0.8). */
export const ROZAMIENTO_JABON = 0.08;
/** Cuánto tarda el muñeco en hacerle caso al jugador para andar o frenar (s): arranca y se sigue de largo. */
export const RESBALON = 0.7;

/** Un patinador: la entrada de andar le llega de a poco (y se va de a poco al soltarla). Uno por jugador. */
export function crearResbalon(segundos = RESBALON): (e: EntradaJugador) => EntradaJugador {
  const k = 1 - Math.exp(-PASO / segundos);
  let avanzar = 0;
  return (e) => {
    avanzar += (e.avanzar - avanzar) * k;
    if (Math.abs(avanzar) < 1e-3 && e.avanzar === 0) avanzar = 0;
    return { ...e, avanzar };
  };
}

/** Pone ese rozamiento a todo lo fijo del mundo. Devuelve cómo dejarlo como estaba. */
function enjabonar(mundo: RAPIER.World, rozamiento: number): () => void {
  const antes: [RAPIER.Collider, number][] = [];
  mundo.forEachCollider((c) => {
    const cuerpo = c.parent();
    if (cuerpo && !cuerpo.isFixed()) return;
    antes.push([c, c.friction()]);
    c.setFriction(rozamiento);
  });
  return () => {
    for (const [c, r] of antes) c.setFriction(r);
  };
}

// ── Ventarrón ───────────────────────────────────────────────────────────────────────────────────────────────

/** El viento: ráfagas que empujan a los muñecos de a ratos, con calma entre una y otra (en pasos). */
export const VIENTO = {
  /** Aceleración en lo más fuerte de la ráfaga (m/s²). De pie se aguanta (el muñeco llega a 9 para andar o frenar)
   * pero se va corriendo; en el aire o colgado, se lo lleva. */
  fuerza: 7,
  /** Calma antes de la primera ráfaga: les da tiempo de leer el cartel. */
  primera: [3 * PASOS_POR_SEGUNDO, 5 * PASOS_POR_SEGUNDO],
  calma: [4 * PASOS_POR_SEGUNDO, 8 * PASOS_POR_SEGUNDO],
  dura: [2 * PASOS_POR_SEGUNDO, 3.5 * PASOS_POR_SEGUNDO],
} as const;

interface Rafaga {
  inicio: number;
  dura: number;
  x: number;
  z: number;
}

/** El viento de esa semilla: la aceleración horizontal (m/s²) en cada paso. Determinista y sin estado visible: el
 * mismo paso da siempre lo mismo. */
export function crearViento(semilla: number): (paso: number) => { x: number; z: number } {
  const azar = crearAzar(semilla ^ 0x9e3779b9);
  const entre = ([a, b]: readonly [number, number]) => Math.round(a + (b - a) * azar());
  const rafagas: Rafaga[] = [];
  const otra = (desde: number, calma: readonly [number, number]) => {
    const angulo = azar() * 2 * Math.PI;
    const r = { inicio: desde + entre(calma), dura: entre(VIENTO.dura), x: Math.sin(angulo), z: Math.cos(angulo) };
    rafagas.push(r);
    return r;
  };
  otra(0, VIENTO.primera);
  return (paso) => {
    let ultima = rafagas[rafagas.length - 1];
    while (ultima && ultima.inicio + ultima.dura <= paso) ultima = otra(ultima.inicio + ultima.dura, VIENTO.calma);
    // La ráfaga de ese paso: la última que empezó antes
    for (let i = rafagas.length - 1; i >= 0; i--) {
      const r = rafagas[i];
      if (!r || r.inicio > paso) continue;
      const t = (paso - r.inicio) / r.dura;
      if (t >= 1) break;
      const fuerza = VIENTO.fuerza * Math.sin(Math.PI * t);
      return { x: r.x * fuerza, z: r.z * fuerza };
    }
    return { x: 0, z: 0 };
  };
}

/** Empuja todas las partes del muñeco con esa aceleración durante un paso. */
function acelerar(m: Muneco, x: number, y: number, z: number): void {
  for (const c of Object.values(m.partes)) {
    const masa = c.mass();
    c.applyImpulse({ x: x * masa * PASO, y: y * masa * PASO, z: z * masa * PASO }, true);
  }
}

// ── Gravedad de luna ────────────────────────────────────────────────────────────────────────────────────────

/** En el aire pesan esto de lo que pesan (saltan más alto y caen despacio). En el suelo, lo de siempre: andar, la
 * suspensión y las piezas de peso (planchas, balancines) no cambian. */
export const LUNA = 0.4;

// ── Atados por un mecate ────────────────────────────────────────────────────────────────────────────────────

/** El mecate entre las dos pelvis (m): corto, pero cabe un bejuco para cada uno. */
export const MECATE = 2.6;
/** Si quedan más lejos que esto (uno reapareció en el punto de control), el mecate se suelta hasta que se junten. */
const DESATAR = MECATE * 2;

// ── Niebla espesa ───────────────────────────────────────────────────────────────────────────────────────────

/** De la niebla del nivel queda esto: lo de más allá de los dos no se ve. */
export const NIEBLA_ESPESA = 0.4;

// ── El catálogo ─────────────────────────────────────────────────────────────────────────────────────────────

export const TRAMPAS: readonly Trampa[] = [
  {
    nombre: "cruzados",
    titulo: "Brazos cruzados",
    cartel: "Esta noche la izquierda es la derecha. Y la derecha… ya saben.",
    armar: () => ({ entrada: cruzar, quitar() {} }),
  },
  {
    nombre: "jabon",
    titulo: "Piso jabonoso",
    cartel: "Alguien trapeó con jabón. Arranquen con calma y frenen con fe.",
    armar({ mundo }) {
      const resbalones = [crearResbalon(), crearResbalon()] as const;
      const desenjabonar = enjabonar(mundo, ROZAMIENTO_JABON);
      return { entrada: (e, jugador) => resbalones[jugador](e), quitar: desenjabonar };
    },
  },
  {
    nombre: "viento",
    titulo: "Ventarrón",
    cartel: "Sopla de a ratos y no avisa. Agárrense de algo… o del otro.",
    armar({ munecos, semilla }) {
      const viento = crearViento(semilla);
      let paso = 0;
      return {
        antes() {
          const { x, z } = viento(paso++);
          if (x === 0 && z === 0) return;
          for (const m of munecos) acelerar(m, x, 0, z);
        },
        quitar() {},
      };
    },
  },
  {
    nombre: "luna",
    titulo: "Gravedad de luna",
    cartel: "Pesan como pluma de zopilote. Salten, que el piso los espera.",
    armar({ munecos }) {
      return {
        antes() {
          for (const m of munecos) if (m.estado === "en el aire") acelerar(m, 0, -GRAVEDAD * (1 - LUNA), 0);
        },
        quitar() {},
      };
    },
  },
  {
    nombre: "mecate",
    titulo: "Amarrados",
    cartel: "Un mecate corto los une. Donde va uno, va el otro (quiera o no).",
    armar: armarMecate,
  },
  {
    nombre: "niebla",
    titulo: "Niebla espesa",
    cartel: "No se ve ni la mano. Menos mal que son dos.",
    armar: () => ({ niebla: NIEBLA_ESPESA, quitar() {} }),
  },
];

function armarMecate({ rapier, mundo, escena, munecos }: ContextoTrampa): Efecto {
  const [rojo, turquesa] = munecos;
  const centro = { x: 0, y: 0, z: 0 };
  const atar = () =>
    mundo.createImpulseJoint(
      rapier.JointData.rope(MECATE, centro, centro),
      rojo.partes.pelvis,
      turquesa.partes.pelvis,
      true,
    );
  let nudo: RAPIER.ImpulseJoint | undefined = atar();
  const distancia = () => {
    const a = rojo.partes.pelvis.translation();
    const b = turquesa.partes.pelvis.translation();
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  };

  // La imagen: una cuerda oscura que cuelga entre los dos, más floja cuanto más cerca están
  const material = new THREE.MeshStandardMaterial({ name: "mecate", color: 0x2e2e2c, roughness: 1 });
  const cuerda = new THREE.Mesh(new THREE.BufferGeometry(), material);
  cuerda.name = "mecate";
  cuerda.frustumCulled = false;
  escena.add(cuerda);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const medio = new THREE.Vector3();
  const curva = new THREE.QuadraticBezierCurve3(a, medio, b);

  return {
    antes() {
      const d = distancia();
      if (nudo && d > DESATAR) {
        mundo.removeImpulseJoint(nudo, true);
        nudo = undefined;
      } else if (!nudo && d < MECATE) nudo = atar();
    },
    dibujar() {
      a.copy(rojo.partes.pelvis.translation());
      b.copy(turquesa.partes.pelvis.translation());
      const d = a.distanceTo(b);
      cuerda.visible = d < DESATAR;
      if (!cuerda.visible) return;
      medio.addVectors(a, b).multiplyScalar(0.5);
      medio.y -= Math.max(0, MECATE - d) * 0.7;
      cuerda.geometry.dispose();
      cuerda.geometry = new THREE.TubeGeometry(curva, 18, 0.022, 5, false);
    },
    quitar() {
      if (nudo) mundo.removeImpulseJoint(nudo, true);
      nudo = undefined;
      escena.remove(cuerda);
      cuerda.geometry.dispose();
      material.dispose();
    },
  };
}

// ── Semilla y elección ──────────────────────────────────────────────────────────────────────────────────────

/** La trampa de esa semilla: siempre la misma. */
export function trampaDeSemilla(semilla: number): Trampa {
  const i = Math.floor(crearAzar(semilla >>> 0)() * TRAMPAS.length);
  const trampa = TRAMPAS[i] ?? TRAMPAS[0];
  if (!trampa) throw new Error("no hay trampas");
  return trampa;
}

export function trampaPorNombre(nombre: string): Trampa | undefined {
  return TRAMPAS.find((t) => t.nombre === nombre);
}

/** El número de la trampa en la foto de la red: 0 si no hay noche, 1… las del catálogo (caben 15 en 4 bits). */
export function numeroDeTrampa(trampa: Trampa | undefined): number {
  return trampa ? TRAMPAS.indexOf(trampa) + 1 : 0;
}

export function trampaDeNumero(numero: number): Trampa | undefined {
  return numero > 0 ? TRAMPAS[numero - 1] : undefined;
}

/** Una semilla al azar (la de `&noche` sin número). Es lo único al azar: de ahí en adelante todo sale de ella. */
export function semillaAlAzar(): number {
  const uno = new Uint32Array(1);
  crypto.getRandomValues(uno);
  return uno[0] ?? 0;
}

export interface PedidoDeNoche {
  readonly semilla: number;
  readonly trampa: Trampa;
}

/** Lo que pide la dirección: `undefined` si no es de noche. Una trampa que no existe es un error. */
export function leerNoche(parametros: URLSearchParams, azar: () => number = semillaAlAzar): PedidoDeNoche | undefined {
  if (!parametros.has("noche") && !parametros.has("trampa")) return undefined;
  const dada = parametros.get("noche");
  const numero = dada ? Number(dada) : Number.NaN;
  const semilla = Number.isInteger(numero) ? numero >>> 0 : azar() >>> 0;
  const nombre = parametros.get("trampa");
  if (!nombre) return { semilla, trampa: trampaDeSemilla(semilla) };
  const trampa = trampaPorNombre(nombre);
  if (!trampa) throw new Error(`No existe la trampa «${nombre}». Hay: ${TRAMPAS.map((t) => t.nombre).join(", ")}`);
  return { semilla, trampa };
}

// ── La noche en la escena ───────────────────────────────────────────────────────────────────────────────────

/** Oscurece la escena armada por `vestirDeDia` (imagen/ambiente.ts) y los jirones de niebla. Devuelve cómo volver
 * al día. */
export function vestirDeNoche(escena: THREE.Scene, jirones?: THREE.Object3D): () => void {
  const deshacer: (() => void)[] = [];
  const fondo = escena.background;
  escena.background = new THREE.Color(COLORES_NOCHE.niebla);
  deshacer.push(() => {
    escena.background = fondo;
  });
  if (escena.fog instanceof THREE.Fog) {
    const niebla = escena.fog;
    const color = niebla.color.clone();
    niebla.color.set(COLORES_NOCHE.niebla);
    deshacer.push(() => niebla.color.copy(color));
  }
  let soles = 0;
  for (const luz of escena.children) {
    if (!(luz instanceof THREE.Light)) continue;
    const { intensity } = luz;
    const color = luz.color.clone();
    if (luz instanceof THREE.HemisphereLight) {
      const suelo = luz.groundColor.clone();
      luz.intensity *= LUCES_NOCHE.cielo;
      luz.color.set(COLORES_NOCHE.cielo);
      luz.groundColor.set(COLORES_NOCHE.sueloLuz);
      deshacer.push(() => luz.groundColor.copy(suelo));
    } else if (luz instanceof THREE.DirectionalLight) {
      // La primera es el sol (ahora la luna); la otra, el relleno desde la cámara
      luz.intensity *= soles++ === 0 ? LUCES_NOCHE.sol : LUCES_NOCHE.relleno;
      luz.color.set(COLORES_NOCHE.luna);
    }
    deshacer.push(() => {
      luz.intensity = intensity;
      luz.color.copy(color);
    });
  }
  jirones?.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshBasicMaterial)) return;
    const material = o.material;
    const color = material.color.clone();
    material.color.set(COLORES_NOCHE.niebla);
    deshacer.push(() => material.color.copy(color));
  });
  return () => {
    for (const d of deshacer.reverse()) d();
  };
}

export interface Noche {
  /** La trampa puesta, o `undefined` si es de día. */
  readonly trampa: Trampa | undefined;
  /** Por cuánto se multiplica la distancia de la niebla del nivel. */
  readonly niebla: number;
  /** Pone la noche con esa trampa (o el día, con `undefined`). Si ya estaba esa, no hace nada. */
  poner(trampa: Trampa | undefined, semilla?: number): void;
  /** Las entradas de los dos jugadores de esta máquina, con lo que les haga la trampa. */
  entradas(e: readonly [EntradaJugador, EntradaJugador]): readonly [EntradaJugador, EntradaJugador];
  /** Un paso de físicas: después de los muñecos y antes de `mundo.step()`. */
  antes(): void;
  dibujar(alfa: number): void;
  /** Muestra el cartel de la trampa puesta, una vez por trampa. */
  anunciar(): void;
}

export interface OpcionesNoche {
  readonly rapier: Rapier;
  readonly mundo: RAPIER.World;
  readonly escena: THREE.Scene;
  readonly munecos: readonly [Muneco, Muneco];
  /** Los jirones de niebla del nivel, que también se oscurecen. */
  readonly jirones?: THREE.Object3D;
  /** Cómo mostrar el cartel (sin pantalla, nada). */
  readonly cartel?: (trampa: Trampa) => void;
}

export function crearNoche(op: OpcionesNoche, pedido?: PedidoDeNoche): Noche {
  let trampa: Trampa | undefined;
  let efecto: Efecto | undefined;
  let deDia: (() => void) | undefined;
  let anunciada: Trampa | undefined;
  const noche: Noche = {
    get trampa() {
      return trampa;
    },
    get niebla() {
      return efecto?.niebla ?? 1;
    },
    poner(nueva, semilla = 0) {
      if (nueva === trampa) return;
      efecto?.quitar();
      efecto = undefined;
      trampa = nueva;
      if (!nueva) {
        deDia?.();
        deDia = undefined;
        return;
      }
      deDia ??= vestirDeNoche(op.escena, op.jirones);
      efecto = nueva.armar({ ...op, semilla });
    },
    entradas(e) {
      const cambiar = efecto?.entrada;
      if (!cambiar) return e;
      return [cambiar(e[0], 0), cambiar(e[1], 1)];
    },
    antes() {
      efecto?.antes?.();
    },
    dibujar(alfa) {
      efecto?.dibujar?.(alfa);
    },
    anunciar() {
      if (!trampa || anunciada === trampa) return;
      anunciada = trampa;
      op.cartel?.(trampa);
    },
  };
  if (pedido) noche.poner(pedido.trampa, pedido.semilla);
  return noche;
}
