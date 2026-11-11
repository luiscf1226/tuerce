// El formato de nivel (TU-11): cómo se lee una escena glTF hecha en Blender. Cada nodo dice qué es con sus
// propiedades personalizadas (en glTF, `extras`; en three, `userData`); lo que no dice nada es solo imagen.
// La convención completa, para quien arma niveles, está en niveles/README.md.
//
// Este archivo no carga nada ni toca Rapier: recibe el árbol de three que dejó GLTFLoader y devuelve el plano del
// nivel. Así se prueba en Node leyendo el .glb del disco.
import * as THREE from "three";

export const TIPOS = ["solido", "salida", "control", "vacio", "adorno", "niebla"] as const;
export type Tipo = (typeof TIPOS)[number];
export const FORMAS = ["caja", "cilindro", "malla"] as const;
export type Forma = (typeof FORMAS)[number];
export const CUERPOS = ["fijo", "cinematico", "dinamico"] as const;
export type TipoDeCuerpo = (typeof CUERPOS)[number];
/** Cómo se ve un sólido. El color de los materiales de Blender no se usa: la imagen la pone el juego. */
export const MATERIALES = ["suelo", "tela", "corteza", "honda", "lejana"] as const;
export type Material = (typeof MATERIALES)[number];
export const ADORNOS = ["pino", "abeto", "roca", "mata", "tronco"] as const;
export type FormaDeAdorno = (typeof ADORNOS)[number];

/** Una caja girada en el mundo: zona de un punto de control o del vacío. */
export interface Volumen {
  readonly centro: THREE.Vector3;
  /** Medio ancho, medio alto y medio fondo, en el marco de la caja. */
  readonly medio: THREE.Vector3;
  readonly giro: THREE.Quaternion;
}

export interface Solido {
  readonly nombre: string;
  /** El nodo de la escena, con sus mallas. */
  readonly objeto: THREE.Object3D;
  readonly forma: Forma;
  readonly cuerpo: TipoDeCuerpo;
  /** Kilos, solo para los dinámicos. */
  readonly masa: number;
  readonly rozamiento: number;
  readonly material: Material;
  /** Solo choca, no se ve (una pasarela invisible, una pared de los bordes). */
  readonly invisible: boolean;
}

/** Un lugar donde poner a un muñeco: dónde quedan los pies y hacia dónde mira (radianes alrededor de +y). */
export interface Lugar {
  readonly posicion: THREE.Vector3;
  readonly rumbo: number;
}

export interface PuntoDeControl {
  /** 0 es la salida; los demás, en el orden en que se alcanzan. */
  readonly orden: number;
  readonly nombre: string;
  /** Al entrar acá la pareja lo alcanza. La salida (0) no tiene zona. */
  readonly zona: Volumen | null;
  /** Dónde reaparece cada jugador (0 el rojo, 1 el turquesa). */
  readonly lugares: readonly [Lugar, Lugar];
}

export interface Adorno {
  readonly forma: FormaDeAdorno;
  readonly objeto: THREE.Object3D;
  readonly alto: number;
  readonly radio: number;
  readonly semilla: number;
}

export interface CapaDeNieblaDelNivel {
  readonly objeto: THREE.Object3D;
  readonly opacidad: number;
  readonly velocidad: number;
}

export interface PlanoDeNivel {
  /** Número del nivel (99 para el de prueba). */
  readonly numero: number;
  readonly nombre: string;
  /** Por debajo de esta altura, el muñeco cayó al vacío. */
  readonly vacio: number;
  /** La niebla con los dos juntos: desde y hasta qué distancia de la cámara (metros). */
  readonly niebla: { readonly cerca: number; readonly lejos: number };
  /** Todos los puntos de control, empezando por la salida (orden 0). */
  readonly puntos: readonly PuntoDeControl[];
  readonly solidos: readonly Solido[];
  /** Zonas que cuentan como caída aunque estén más arriba que `vacio` (el fondo de un pozo, un río). */
  readonly vacios: readonly Volumen[];
  readonly adornos: readonly Adorno[];
  readonly nieblas: readonly CapaDeNieblaDelNivel[];
  /** La raíz de la escena del glTF, tal como la dejó el cargador. */
  readonly raiz: THREE.Object3D;
}

/** Separación entre los dos muñecos al reaparecer en un punto de control (metros). */
export const SEPARACION = 0.9;

/** Un error del formato, con el nombre del nodo para encontrarlo rápido en Blender. */
export class ErrorDeNivel extends Error {
  override readonly name = "ErrorDeNivel";
}

type Extras = Record<string, unknown>;

const extrasDe = (o: THREE.Object3D): Extras => o.userData as Extras;

function leerNumero(extras: Extras, clave: string, donde: string): number | undefined;
function leerNumero(extras: Extras, clave: string, donde: string, porDefecto: number): number;
function leerNumero(extras: Extras, clave: string, donde: string, porDefecto?: number) {
  const valor = extras[clave];
  if (valor === undefined) return porDefecto;
  if (typeof valor !== "number" || !Number.isFinite(valor))
    throw new ErrorDeNivel(`«${donde}»: \`${clave}\` tiene que ser un número y es ${JSON.stringify(valor)}`);
  return valor;
}

function leerOpcion<T extends string>(
  extras: Extras,
  clave: string,
  opciones: readonly T[],
  donde: string,
  porDefecto: T,
): T {
  const valor = extras[clave] ?? porDefecto;
  if (typeof valor !== "string" || !(opciones as readonly string[]).includes(valor))
    throw new ErrorDeNivel(`«${donde}»: \`${clave}\` es ${JSON.stringify(valor)}; vale ${opciones.join(", ")}`);
  return valor as T;
}

const ARRIBA = new THREE.Vector3(0, 1, 0);

/** Hacia dónde mira un nodo: su +z (el adelante de glTF) proyectado en el piso. */
export function rumboDe(o: THREE.Object3D): number {
  const adelante = new THREE.Vector3(0, 0, 1).applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion()));
  return Math.atan2(adelante.x, adelante.z);
}

/** La caja de las mallas del nodo, en su propio marco (sin su escala). Vacía si el nodo no tiene mallas. */
export function cajaLocal(o: THREE.Object3D): THREE.Box3 {
  const caja = new THREE.Box3();
  o.updateWorldMatrix(true, true);
  const inversa = o.matrixWorld.clone().invert();
  o.traverse((hijo) => {
    if (!(hijo instanceof THREE.Mesh)) return;
    const geometria = hijo.geometry as THREE.BufferGeometry;
    geometria.computeBoundingBox();
    if (!geometria.boundingBox) return;
    const relativa = inversa.clone().multiply(hijo.matrixWorld);
    caja.union(geometria.boundingBox.clone().applyMatrix4(relativa));
  });
  return caja;
}

/** La zona de un nodo: la caja de sus mallas o, si no tiene (un vacío de Blender), el cubo de ±1 escalado. */
export function volumenDe(o: THREE.Object3D): Volumen {
  o.updateWorldMatrix(true, true);
  const posicion = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  o.matrixWorld.decompose(posicion, giro, escala);
  const caja = cajaLocal(o);
  if (caja.isEmpty()) caja.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const medio = caja.getSize(new THREE.Vector3()).multiply(escala).multiplyScalar(0.5);
  const centro = caja.getCenter(new THREE.Vector3()).multiply(escala).applyQuaternion(giro).add(posicion);
  return { centro, medio, giro };
}

/** Si el punto queda adentro de la caja. */
export function adentro(v: Volumen, p: THREE.Vector3Like): boolean {
  const local = new THREE.Vector3(p.x, p.y, p.z).sub(v.centro).applyQuaternion(v.giro.clone().invert());
  return Math.abs(local.x) <= v.medio.x && Math.abs(local.y) <= v.medio.y && Math.abs(local.z) <= v.medio.z;
}

/** Los dos lugares lado a lado alrededor de `centro`, mirando hacia `rumbo`: el rojo a la derecha y el turquesa a
 * la izquierda, como en la escena `dos` (así se agarran de las manos de adentro). */
export function ladoALado(centro: THREE.Vector3, rumbo: number, separacion = SEPARACION): [Lugar, Lugar] {
  const izquierda = new THREE.Vector3(1, 0, 0).applyAxisAngle(ARRIBA, rumbo).multiplyScalar(separacion / 2);
  return [
    { posicion: centro.clone().sub(izquierda), rumbo },
    { posicion: centro.clone().add(izquierda), rumbo },
  ];
}

/** Lee la escena de un glTF (lo que deja GLTFLoader en `gltf.scene`) y devuelve el plano del nivel. */
export function leerPlano(raiz: THREE.Object3D): PlanoDeNivel {
  raiz.updateWorldMatrix(true, true);
  const extrasEscena = extrasDe(raiz);
  const numero = leerNumero(extrasEscena, "nivel", "escena");
  if (numero === undefined) throw new ErrorDeNivel("la escena no dice qué nivel es: falta `nivel` en sus propiedades");
  const nombre = typeof extrasEscena.nombre === "string" ? extrasEscena.nombre : `Nivel ${numero}`;

  const salidas: (Lugar | undefined)[] = [undefined, undefined];
  const controles: PuntoDeControl[] = [];
  const solidos: Solido[] = [];
  const vacios: Volumen[] = [];
  const adornos: Adorno[] = [];
  const nieblas: CapaDeNieblaDelNivel[] = [];

  raiz.traverse((o) => {
    if (o === raiz) return;
    const extras = extrasDe(o);
    if (extras.tipo === undefined) return;
    const donde = o.name || "(sin nombre)";
    const tipo = leerOpcion(extras, "tipo", TIPOS, donde, "solido");
    switch (tipo) {
      case "solido": {
        const cuerpo = leerOpcion(extras, "cuerpo", CUERPOS, donde, "fijo");
        const forma = leerOpcion(extras, "forma", FORMAS, donde, "caja");
        if (cajaLocal(o).isEmpty()) throw new ErrorDeNivel(`«${donde}»: un sólido necesita una malla`);
        solidos.push({
          nombre: o.name,
          objeto: o,
          forma,
          cuerpo,
          masa: leerNumero(extras, "masa", donde, 10),
          rozamiento: leerNumero(extras, "rozamiento", donde, 0.8),
          material: leerOpcion(extras, "material", MATERIALES, donde, "suelo"),
          invisible: extras.invisible === true || extras.invisible === 1,
        });
        break;
      }
      case "salida": {
        const jugador = leerNumero(extras, "jugador", donde);
        if (jugador !== 1 && jugador !== 2) throw new ErrorDeNivel(`«${donde}»: \`jugador\` tiene que ser 1 o 2`);
        if (salidas[jugador - 1]) throw new ErrorDeNivel(`hay dos salidas para el jugador ${jugador}`);
        salidas[jugador - 1] = { posicion: o.getWorldPosition(new THREE.Vector3()), rumbo: rumboDe(o) };
        break;
      }
      case "control": {
        const orden = leerNumero(extras, "orden", donde);
        if (orden === undefined || !Number.isInteger(orden) || orden < 1)
          throw new ErrorDeNivel(`«${donde}»: \`orden\` tiene que ser un entero desde 1`);
        const zona = volumenDe(o);
        // Reaparecen sobre la base de la zona, que tiene que apoyar en el suelo
        const base = new THREE.Vector3(0, -zona.medio.y, 0).applyQuaternion(zona.giro).add(zona.centro);
        controles.push({ orden, nombre: o.name, zona, lugares: ladoALado(base, rumboDe(o)) });
        break;
      }
      case "vacio":
        vacios.push(volumenDe(o));
        break;
      case "adorno": {
        const forma = leerOpcion(extras, "forma", ADORNOS, donde, "pino");
        adornos.push({
          forma,
          objeto: o,
          alto: leerNumero(extras, "alto", donde, 1),
          radio: leerNumero(extras, "radio", donde, 0.3),
          semilla: leerNumero(extras, "semilla", donde, 1),
        });
        break;
      }
      case "niebla":
        nieblas.push({
          objeto: o,
          opacidad: leerNumero(extras, "opacidad", donde, 0.5),
          velocidad: leerNumero(extras, "velocidad", donde, 0.15),
        });
        break;
    }
  });

  const [rojo, turquesa] = salidas;
  if (!rojo || !turquesa) throw new ErrorDeNivel("faltan las salidas: un nodo `salida` con `jugador` 1 y otro con 2");
  controles.sort((a, b) => a.orden - b.orden);
  controles.forEach((c, i) => {
    if (c.orden !== i + 1)
      throw new ErrorDeNivel(
        `los puntos de control van de 1 en 1: después del ${i} viene «${c.nombre}» con ${c.orden}`,
      );
  });
  const salida: PuntoDeControl = { orden: 0, nombre: "salida", zona: null, lugares: [rojo, turquesa] };

  // Si la escena no dice dónde empieza el vacío, es 3 m por debajo del sólido más bajo
  let masBajo = Number.POSITIVE_INFINITY;
  for (const s of solidos) {
    if (s.cuerpo !== "fijo") continue;
    masBajo = Math.min(masBajo, new THREE.Box3().setFromObject(s.objeto).min.y);
  }
  const vacio = leerNumero(extrasEscena, "vacio", "escena", Number.isFinite(masBajo) ? masBajo - 3 : -10);
  const niebla = {
    cerca: leerNumero(extrasEscena, "nieblaCerca", "escena", 3),
    lejos: leerNumero(extrasEscena, "nieblaLejos", "escena", 24),
  };

  return { numero, nombre, vacio, niebla, puntos: [salida, ...controles], solidos, vacios, adornos, nieblas, raiz };
}
