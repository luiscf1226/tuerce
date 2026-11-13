// El agua (TU-24, estrena en La poza; la reusa el Río Plátano). Cada nodo `tipo: agua` de la escena (formato-agua.ts)
// es una zona: una caja con la superficie arriba y el fondo abajo. Acá se arma su imagen y lo que les hace a los
// cuerpos que están adentro, en cada paso:
//
//   flotar     cada cuerpo dinámico empuja hacia arriba lo que pesa el agua que desaloja: se lo mide en puntos
//              repartidos por sus colisionadores (cada uno con su parte del volumen), así lo que se hunde de un lado
//              se endereza solo. Un cuerpo flota si pesa menos que el agua que ocupa; `densidad()` lo cambia (una
//              piedra se hunde aunque su caja sea grande).
//   arrastre   lo que está mojado toma de a poco la velocidad del agua: frena en el agua quieta y se va con la
//              corriente (`corriente`, m/s hacia el frente de la zona).
//   el nivel   la superficie sube o baja cuando el guion lo pide (`irA`): la poza baja al desviar el agua, el chorro
//              se corta al abrir la compuerta.
//   caer       un muñeco con la pelvis bajo la superficie cayó al agua (`alMojar`, para logros como «Secos»). Si el
//              agua es `caer: vacio` se lo lleva (cuenta como caída: nivel.ts lo hace reaparecer); si es `nadar`,
//              flota y chapotea despacio hacia donde mira hasta que hace pie.
//
// Cada paso, desde el nivel (nivel.ts):  antes()  →  muñecos y mundo.step()  →  despues()  →  guardar()
// El nivel de cada zona (y su corriente) viaja en la foto de la red: cada zona tiene un cuerpo cinemático sin
// colisionadores, un marcador, que está a la altura de su superficie (y corrido en x lo que vale su corriente). El
// invitado no simula: lee el marcador para dibujar el agua donde la ve el anfitrión.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { aTextura } from "../imagen";
import { fbmPeriodico } from "../imagen/ruido";
import { nuevaLamina } from "../imagen/texturas";
import { PASO } from "../motor/bucle";
import { GRAVEDAD, type Rapier } from "../motor/fisica";
import type { EntradaMuneco, Muneco } from "../muneco";
import type { Volumen } from "./formato";
import type { AguaDelPlano, CaidaAlAgua } from "./formato-agua";

/** Los números del agua que no se ponen desde Blender. */
export const AJUSTES_AGUA = {
  /** Lo que pesa un metro cúbico de agua (kg). */
  densidad: 1000,
  /** La de un muñeco de trapo empapado (kg/m³): flota con la cabeza afuera. */
  densidadMuneco: 750,
  /** Sumergido en esta fracción de su volumen, el agua ya lo arrastra del todo (un tronco que flota casi entero
   * afuera igual se va con la corriente). */
  mojadoPleno: 0.02,
  /** El agua frena el giro de lo que está adentro: esta fracción del `arrastre`. */
  giro: 0.6,
  /** Y el subir y bajar de lo que flota, además del `arrastre` (1/s): así se aquieta enseguida. */
  calma: 6,
  /** Cada cuánto va un punto de flotación a lo largo de una caja (m). */
  muestra: 0.5,
  /** Nadar (`caer: nadar`): la velocidad hacia donde mira con `avanzar` (m/s) y qué tan rápido la alcanza (1/s). */
  nadar: { velocidad: 0.9, respuesta: 3 },
  /** Un chapuzón: lo que entra al agua más rápido que esto salpica (m/s), con tantas gotas que duran tanto (s). */
  chapuzon: { velocidad: 1.2, gotas: 12, vida: 0.8, espera: 0.4 },
} as const;

export interface Agua {
  readonly nombre: string;
  readonly zona: Volumen;
  readonly caer: CaidaAlAgua;
  /** La altura de la superficie ahora (m). */
  readonly nivel: number;
  /** La altura de la superficie al empezar: la de arriba de su caja. */
  readonly lleno: number;
  /** La altura del fondo de su caja: con la superficie ahí, no queda agua. */
  readonly fondo: number;
  /** Hacia el frente de la zona (m/s). La cambia el guion (un chorro que se corta, un río que se calma). */
  corriente: number;
  /** Lleva la superficie a `altura` a `velocidad` m/s; sin velocidad, de una vez. */
  irA(altura: number, velocidad?: number): void;
  /** Si la superficie ya está donde se la mandó. */
  readonly quieta: boolean;
  /** Cuánto está ese punto bajo la superficie (m, negativo si está arriba), o `null` si queda fuera de la zona (de
   * costado, o más abajo que el fondo). */
  hondura(p: THREE.Vector3Like): number | null;
}

export interface Aguas {
  readonly lista: readonly Agua[];
  /** La zona con ese nombre, o `undefined`. */
  buscar(nombre: string): Agua | undefined;
  /** El agua que cubre ese punto (está bajo su superficie), o `undefined`. */
  en(p: THREE.Vector3Like): Agua | undefined;
  /** Si ese punto quedó bajo un agua que se lo lleva (`caer: vacio`): para un muñeco es como caer al vacío. */
  seLoLleva(p: THREE.Vector3Like): boolean;
  /** Cambia cuánto pesa un cuerpo por metro cúbico, para el agua (kg/m³): con menos de 1000 flota. Por omisión es su
   * masa entre el volumen de sus colisionadores (un huacal de tablas flota alto; para que una piedra se hunda hay que
   * decirlo, acá o en el `userData` del cuerpo: `{ densidad: 2600 }`). */
  densidad(cuerpo: RAPIER.RigidBody, kgPorMetroCubico: number): void;
  /** Cuántas veces cayó al agua cada uno (0 el rojo, 1 el turquesa). */
  readonly caidas: readonly [number, number];
  /** Llama a `aviso` cada vez que un muñeco cae al agua. Devuelve cómo dejar de escuchar. */
  alMojar(aviso: (jugador: 0 | 1, agua: Agua) => void): () => void;
  /** Antes de los muñecos y de `mundo.step()`: mueve los niveles; flotar, arrastre, corriente y nadar. */
  antes(munecos: readonly Muneco[], entradas?: readonly EntradaMuneco[]): void;
  /** Después de `mundo.step()`: quién cayó al agua (antes de que nivel.ts lo haga reaparecer). */
  despues(munecos: readonly Muneco[]): void;
  /** Anota el nivel de cada zona (del marcador) y los chapuzones. Va después de cada `mundo.step()`, también en el
   * invitado. */
  guardar(): void;
  dibujar(alfa: number, segundos: number): void;
}

/** Un punto donde se mide cuánto está sumergido un cuerpo, en el marco del cuerpo. */
interface Muestra {
  readonly local: THREE.Vector3;
  /** Su parte del volumen del cuerpo (m³). */
  readonly volumen: number;
  /** La media caja que le toca, en los ejes del cuerpo: con el giro del cuerpo da su medio alto en el mundo. */
  readonly medio: THREE.Vector3;
}

interface Flotador {
  readonly muestras: readonly Muestra[];
  readonly volumen: number;
  /** Por cuánto se multiplica el empuje: 1 con su densidad de verdad. */
  escala: number;
}

const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Las muestras de una caja de medio `m` en el marco de su colisionador: una grilla a lo largo y a lo ancho (una sola
 * capa: cuánto se hunde cada columna sale de su alto). */
function grilla(m: THREE.Vector3Like): { local: THREE.Vector3; medio: THREE.Vector3 }[] {
  // Al menos dos por lado (si mide más de 30 cm): así lo que se hunde de un lado se endereza
  const n = (medio: number) =>
    Math.max(medio > 0.15 ? 2 : 1, Math.min(6, Math.round((medio * 2) / AJUSTES_AGUA.muestra)));
  const [nx, nz] = [n(m.x), n(m.z)];
  const lista: { local: THREE.Vector3; medio: THREE.Vector3 }[] = [];
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++)
      lista.push({
        local: new THREE.Vector3(m.x * ((2 * i + 1) / nx - 1), 0, m.z * ((2 * k + 1) / nz - 1)),
        medio: new THREE.Vector3(m.x / nx, m.y, m.z / nz),
      });
  return lista;
}

/** Las muestras de un cuerpo, con lo que tienen sus colisionadores (los sensores no cuentan). */
function muestrasDe(rapier: Rapier, cuerpo: RAPIER.RigidBody): Flotador {
  const muestras: Muestra[] = [];
  let volumen = 0;
  const q = new THREE.Quaternion();
  const t = new THREE.Vector3();
  for (let i = 0; i < cuerpo.numColliders(); i++) {
    const c = cuerpo.collider(i);
    if (c.isSensor()) continue;
    const v = c.volume();
    if (!(v > 0)) continue;
    q.copy(c.rotationWrtParent() ?? { x: 0, y: 0, z: 0, w: 1 });
    t.copy(c.translationWrtParent() ?? { x: 0, y: 0, z: 0 });
    let partes: { local: THREE.Vector3; medio: THREE.Vector3 }[];
    switch (c.shapeType()) {
      case rapier.ShapeType.Cuboid: {
        const m = c.halfExtents() ?? { x: 0.1, y: 0.1, z: 0.1 };
        partes = grilla(m);
        break;
      }
      case rapier.ShapeType.Ball: {
        const r = c.radius();
        partes = [{ local: new THREE.Vector3(), medio: new THREE.Vector3(r, r, r) }];
        break;
      }
      case rapier.ShapeType.Capsule:
      case rapier.ShapeType.Cylinder:
      case rapier.ShapeType.Cone: {
        // A lo largo de su y: dos puntos, cada uno con su mitad
        const r = c.radius();
        const h = c.halfHeight();
        const alto = (h + (c.shapeType() === rapier.ShapeType.Capsule ? r : 0)) / 2;
        partes = [-1, 1].map((s) => ({
          local: new THREE.Vector3(0, (s * (h + r)) / 2, 0),
          medio: new THREE.Vector3(r, Math.max(alto, 0.01), r),
        }));
        break;
      }
      default: {
        // Otra forma (un casco convexo): la caja de sus vértices
        const caja = new THREE.Box3();
        const vertices = c.shapeType() === rapier.ShapeType.ConvexPolyhedron ? c.vertices() : new Float32Array();
        for (let j = 0; j + 2 < vertices.length; j += 3)
          caja.expandByPoint(new THREE.Vector3(vertices[j], vertices[j + 1], vertices[j + 2]));
        if (caja.isEmpty()) continue;
        const centro = caja.getCenter(new THREE.Vector3());
        partes = grilla(caja.getSize(new THREE.Vector3()).multiplyScalar(0.5)).map((p) => ({
          local: p.local.add(centro),
          medio: p.medio,
        }));
      }
    }
    // Del marco del colisionador al del cuerpo; la media caja, en valor absoluto sobre los ejes del cuerpo
    const ejes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((e) =>
      e.applyQuaternion(q),
    );
    for (const p of partes) {
      const medio = new THREE.Vector3();
      for (const [j, e] of ejes.entries()) {
        const m = j === 0 ? p.medio.x : j === 1 ? p.medio.y : p.medio.z;
        medio.x += Math.abs(e.x) * m;
        medio.y += Math.abs(e.y) * m;
        medio.z += Math.abs(e.z) * m;
      }
      muestras.push({ local: p.local.clone().applyQuaternion(q).add(t), volumen: v / partes.length, medio });
    }
    volumen += v;
  }
  return { muestras, volumen, escala: 1 };
}

/** La textura del agua: vetas claras y oscuras, estiradas a lo largo de la corriente (la v de la textura). */
let vetas: THREE.Texture | undefined;
function texturaVetas(): THREE.Texture {
  if (vetas) return vetas;
  const lado = 128;
  const lamina = nuevaLamina(lado, lado);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const r = fbmPeriodico((x / lado) * 12, (y / lado) * 3, [12, 3], 3, 41);
      const g = Math.round(255 * limitar(0.84 + 0.3 * (r - 0.5) * 2, 0, 1));
      const i = (y * lado + x) * 4;
      lamina.datos[i] = g;
      lamina.datos[i + 1] = g;
      lamina.datos[i + 2] = g;
      lamina.datos[i + 3] = 255;
    }
  }
  vetas = aTextura(lamina);
  return vetas;
}

/** Las gotas de los chapuzones: esferitas claras que saltan y caen. */
export function crearGotas(escena: THREE.Scene) {
  const maximo = 160;
  const malla = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.035, 6, 4),
    new THREE.MeshStandardMaterial({ name: "gota", color: COLORES.ojo, roughness: 0.3 }),
    maximo,
  );
  malla.name = "gotas";
  malla.count = 0;
  malla.frustumCulled = false;
  escena.add(malla);
  const gotas: { p: THREE.Vector3; v: THREE.Vector3; vida: number }[] = [];
  let semilla = 1;
  const azar = () => {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  };
  const matriz = new THREE.Matrix4();
  let antes = 0;
  return {
    /** Una salpicada en ese punto (de la superficie), con esa fuerza (m/s). */
    salpicar(donde: THREE.Vector3Like, fuerza: number, cuantas: number = AJUSTES_AGUA.chapuzon.gotas) {
      for (let i = 0; i < cuantas && gotas.length < maximo; i++) {
        const a = azar() * Math.PI * 2;
        const lado = (0.3 + azar() * 0.7) * Math.min(2, fuerza) * 0.6;
        gotas.push({
          p: new THREE.Vector3(donde.x, donde.y, donde.z),
          v: new THREE.Vector3(Math.cos(a) * lado, (1.2 + azar()) * Math.min(3, fuerza) * 0.7, Math.sin(a) * lado),
          vida: AJUSTES_AGUA.chapuzon.vida * (0.6 + azar() * 0.4),
        });
      }
    },
    /** Una gota suelta, con su velocidad (para las salpicadas de La Sucia). */
    gota(donde: THREE.Vector3Like, velocidad: THREE.Vector3Like, vida: number) {
      if (gotas.length >= maximo) return;
      gotas.push({ p: new THREE.Vector3().copy(donde), v: new THREE.Vector3().copy(velocidad), vida });
    },
    mover(segundos: number) {
      const dt = limitar(segundos - antes, 0, 0.1);
      antes = segundos;
      for (let i = gotas.length - 1; i >= 0; i--) {
        const g = gotas[i];
        if (!g) continue;
        g.vida -= dt;
        if (g.vida <= 0) {
          gotas.splice(i, 1);
          continue;
        }
        g.v.y += GRAVEDAD * dt;
        g.p.addScaledVector(g.v, dt);
      }
      malla.count = gotas.length;
      gotas.forEach((g, i) => {
        const s = limitar(g.vida / 0.3, 0.2, 1);
        matriz.makeScale(s, s, s).setPosition(g.p);
        malla.setMatrixAt(i, matriz);
      });
      malla.instanceMatrix.needsUpdate = true;
    },
  };
}
export type Gotas = ReturnType<typeof crearGotas>;

/** La imagen de una zona: un espejo de agua (o una cortina que cae) que sigue al nivel y corre con la corriente. */
function crearImagen(p: AguaDelPlano, lleno: number, fondo: number) {
  const { centro, medio, giro } = p.zona;
  const grupo = new THREE.Group();
  grupo.name = `agua ${p.nombre}`;
  if (p.imagen === "nada") return { grupo, poner: (_nivel: number, _corrido: number) => {} };
  const textura = texturaVetas().clone();
  textura.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    name: "agua",
    // Más oscura que el suelo claro (si no, de lejos se confunde con él), y las vetas claras corren encima
    color: new THREE.Color(COLORES.agua).multiplyScalar(0.72),
    map: textura,
    roughness: 0.32,
    metalness: 0,
    transparent: true,
    opacity: p.imagen === "chorro" ? 0.82 : 0.9,
    side: THREE.DoubleSide,
    depthWrite: p.imagen !== "chorro",
  });
  if (p.imagen === "superficie") {
    // Horizontal, del tamaño de la caja; las vetas corren a lo largo de su z (el frente)
    const espejo = new THREE.Mesh(new THREE.PlaneGeometry(medio.x * 2, medio.z * 2).rotateX(-Math.PI / 2), material);
    textura.repeat.set(Math.max(1, (medio.x * 2) / 3), Math.max(1, (medio.z * 2) / 3));
    espejo.quaternion.copy(giro);
    espejo.position.set(centro.x, lleno, centro.z);
    grupo.add(espejo);
    return {
      grupo,
      poner(nivel: number, corrido: number) {
        espejo.visible = nivel > fondo + 0.01;
        espejo.position.y = nivel;
        textura.offset.set(0, corrido / 3);
      },
    };
  }
  // Un chorro: una cortina vertical a lo ancho de la caja (su x), que cae desde la superficie hasta el fondo
  const alto = Math.max(0.01, lleno - fondo);
  const cortina = new THREE.Mesh(new THREE.PlaneGeometry(medio.x * 2, alto).translate(0, -alto / 2, 0), material);
  textura.repeat.set(Math.max(1, (medio.x * 2) / 1.5), Math.max(1, alto / 1.5));
  cortina.quaternion.copy(giro);
  cortina.position.set(centro.x, lleno, centro.z);
  grupo.add(cortina);
  return {
    grupo,
    poner(nivel: number, corrido: number) {
      const queda = nivel - fondo;
      cortina.visible = queda > 0.01;
      // Al cortarse, el agua deja de llegar desde arriba: la cortina se acorta desde arriba
      cortina.scale.y = Math.max(0.001, queda / alto);
      cortina.position.y = nivel;
      textura.offset.set(0, corrido / 1.5);
    },
  };
}

export function armarAguas(
  rapier: Rapier,
  mundo: RAPIER.World,
  escena: THREE.Scene,
  plano: readonly AguaDelPlano[],
): Aguas & { readonly gotas: Gotas } {
  const a = AJUSTES_AGUA;
  const gotas = crearGotas(escena);
  const caidas: [number, number] = [0, 0];
  const avisos = new Set<(jugador: 0 | 1, agua: Agua) => void>();
  const flotadores = new Map<number, Flotador>();
  const densidades = new Map<number, number>();
  const mojados: [boolean, boolean] = [false, false];
  /** Todo lo que cubren las zonas, con margen: lo que está más lejos ni se mira. */
  const alcance = new THREE.Box3();

  interface Zona {
    readonly agua: Agua;
    readonly marcador: RAPIER.RigidBody;
    readonly giroInverso: THREE.Quaternion;
    readonly frente: THREE.Vector3;
    readonly arrastre: number;
    readonly imagen: ReturnType<typeof crearImagen>;
    nivel: number;
    objetivo: number;
    velocidad: number;
    /** Lo que se ve: el nivel y la corriente que dice el marcador (en el invitado, los del anfitrión). */
    visto: number;
    vistoAntes: number;
    corrienteVista: number;
    corrido: number;
  }
  const zonas: Zona[] = plano.map((p) => {
    p.objeto.visible = false;
    const { centro, medio, giro } = p.zona;
    const lleno = centro.y + medio.y;
    const fondo = centro.y - medio.y;
    const giroInverso = giro.clone().invert();
    const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro).setY(0).normalize();
    const marcador = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x + p.corriente, lleno, centro.z),
    );
    alcance.union(
      new THREE.Box3().setFromCenterAndSize(
        centro,
        new THREE.Vector3(Math.hypot(medio.x, medio.z) * 2, medio.y * 2, Math.hypot(medio.x, medio.z) * 2),
      ),
    );
    const local = new THREE.Vector3();
    const zona: Zona = {
      marcador,
      giroInverso,
      frente,
      arrastre: p.arrastre,
      imagen: crearImagen(p, lleno, fondo),
      nivel: lleno,
      objetivo: lleno,
      velocidad: Number.POSITIVE_INFINITY,
      visto: lleno,
      vistoAntes: lleno,
      corrienteVista: p.corriente,
      corrido: 0,
      agua: {
        nombre: p.nombre,
        zona: p.zona,
        caer: p.caer,
        lleno,
        fondo,
        corriente: p.corriente,
        get nivel() {
          return zona.nivel;
        },
        get quieta() {
          return zona.nivel === zona.objetivo;
        },
        irA(altura, velocidad = Number.POSITIVE_INFINITY) {
          zona.objetivo = altura;
          zona.velocidad = velocidad;
          if (!Number.isFinite(velocidad)) mover(zona);
        },
        hondura(q) {
          local.set(q.x - centro.x, 0, q.z - centro.z).applyQuaternion(giroInverso);
          if (Math.abs(local.x) > medio.x || Math.abs(local.z) > medio.z || q.y < fondo) return null;
          return zona.nivel - q.y;
        },
      },
    };
    escena.add(zona.imagen.grupo);
    return zona;
  });
  alcance.expandByScalar(2);

  /** Un paso del nivel hacia su objetivo, y el marcador a esa altura (corrido en x lo que vale la corriente). */
  function mover(z: Zona) {
    const falta = z.objetivo - z.nivel;
    z.nivel = Math.abs(falta) <= z.velocidad * PASO ? z.objetivo : z.nivel + Math.sign(falta) * z.velocidad * PASO;
    const c = z.agua.zona.centro;
    const donde = { x: c.x + z.agua.corriente, y: z.nivel, z: c.z };
    z.marcador.setNextKinematicTranslation(donde);
    if (!Number.isFinite(z.velocidad)) z.marcador.setTranslation(donde, true);
  }

  /** La zona que cubre ese punto (bajo su superficie, con `margen` de más hacia arriba), y cuánto está debajo. */
  const zonaEn = (p: THREE.Vector3Like, margen = 0): { zona: Zona; hondura: number } | undefined => {
    for (const zona of zonas) {
      const h = zona.agua.hondura(p);
      if (h !== null && h > -margen) return { zona, hondura: h };
    }
    return undefined;
  };

  const flotadorDe = (cuerpo: RAPIER.RigidBody) => {
    let f = flotadores.get(cuerpo.handle);
    if (!f) {
      f = muestrasDe(rapier, cuerpo);
      // La densidad que le dijeron, o la que trae el cuerpo en su `userData` (una piedra: `{ densidad: 2600 }`)
      const propia = (cuerpo.userData as { densidad?: unknown } | undefined)?.densidad;
      const d = densidades.get(cuerpo.handle) ?? (typeof propia === "number" ? propia : undefined);
      if (d !== undefined && f.volumen > 0) f.escala = cuerpo.mass() / d / f.volumen;
      flotadores.set(cuerpo.handle, f);
    }
    return f;
  };

  const q = new THREE.Quaternion();
  const ejeX = new THREE.Vector3();
  const ejeY = new THREE.Vector3();
  const ejeZ = new THREE.Vector3();
  const punto = new THREE.Vector3();
  const agua = new THREE.Vector3();

  /** Flotar y arrastre de un cuerpo dinámico. */
  const mojar = (cuerpo: RAPIER.RigidBody) => {
    const t = cuerpo.translation();
    if (!alcance.containsPoint(punto.set(t.x, t.y, t.z))) return;
    const f = flotadorDe(cuerpo);
    if (f.muestras.length === 0) return;
    q.copy(cuerpo.rotation());
    ejeX.set(1, 0, 0).applyQuaternion(q);
    ejeY.set(0, 1, 0).applyQuaternion(q);
    ejeZ.set(0, 0, 1).applyQuaternion(q);
    let sumergido = 0;
    let arrastre = 0;
    agua.set(0, 0, 0);
    const empuje = a.densidad * -GRAVEDAD * f.escala * PASO;
    for (const m of f.muestras) {
      punto.copy(m.local).applyQuaternion(q).add(t);
      const medioAlto = Math.abs(ejeX.y) * m.medio.x + Math.abs(ejeY.y) * m.medio.y + Math.abs(ejeZ.y) * m.medio.z;
      const en = zonaEn(punto, medioAlto);
      if (!en) continue;
      const parte = limitar((en.hondura + medioAlto) / (2 * medioAlto), 0, 1);
      if (parte <= 0) continue;
      cuerpo.applyImpulseAtPoint({ x: 0, y: empuje * m.volumen * parte, z: 0 }, punto, true);
      const v = m.volumen * parte;
      sumergido += v;
      agua.addScaledVector(en.zona.frente, en.zona.agua.corriente * v);
      arrastre += en.zona.arrastre * v;
    }
    if (sumergido <= 0) return;
    agua.divideScalar(sumergido);
    arrastre /= sumergido;
    // El arrastre: lleva la velocidad hacia la del agua, más fuerte cuanto más mojado (y lo mismo con el giro)
    const mojado = Math.min(1, sumergido / f.volumen / a.mojadoPleno);
    const k = Math.min(1, arrastre * mojado * PASO);
    const ky = Math.min(1, (arrastre + a.calma) * mojado * PASO);
    const v = cuerpo.linvel();
    const masa = cuerpo.mass();
    cuerpo.applyImpulse({ x: (agua.x - v.x) * k * masa, y: -v.y * ky * masa, z: (agua.z - v.z) * k * masa }, true);
    const w = cuerpo.angvel();
    const i = cuerpo.principalInertia();
    const inercia = (i.x + i.y + i.z) / 3;
    const kg = Math.min(1, arrastre * a.giro * mojado * PASO) * inercia;
    cuerpo.applyTorqueImpulse({ x: -w.x * kg, y: -w.y * kg, z: -w.z * kg }, true);
  };

  /** Si el muñeco tiene la pelvis bajo la superficie de algún agua. */
  const bajoElAgua = (m: Muneco) => zonaEn(m.partes.pelvis.translation());

  // Para los chapuzones: dónde estaba cada cuerpo en el paso anterior y si ya salpicó hace poco
  const antesY = new Map<number, number>();
  const espera = new Map<number, number>();

  const aguas: Aguas & { readonly gotas: Gotas } = {
    gotas,
    lista: zonas.map((z) => z.agua),
    buscar: (nombre) => zonas.find((z) => z.agua.nombre === nombre)?.agua,
    en: (p) => zonaEn(p)?.zona.agua,
    seLoLleva(p) {
      const en = zonaEn(p);
      return en !== undefined && en.zona.agua.caer === "vacio";
    },
    densidad(cuerpo, kg) {
      densidades.set(cuerpo.handle, kg);
      flotadores.delete(cuerpo.handle);
    },
    get caidas() {
      return caidas;
    },
    alMojar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    antes(munecos, entradas) {
      for (const z of zonas) mover(z);
      if (zonas.length === 0) return;
      // Los muñecos son de trapo: flotan con la cabeza afuera, no como un corcho
      for (const m of munecos)
        for (const parte of Object.values(m.partes))
          if (!densidades.has(parte.handle)) aguas.densidad(parte, a.densidadMuneco);
      mundo.forEachRigidBody((c) => {
        if (c.isDynamic() && c.isEnabled()) mojar(c);
      });
      // Nadar: con la pelvis bajo un agua `nadar`, avanzar lo lleva despacio hacia donde mira
      munecos.forEach((m, i) => {
        const en = bajoElAgua(m);
        if (en?.zona.agua.caer !== "nadar") return;
        const avanzar = limitar(entradas?.[i]?.avanzar ?? 0, -1, 1);
        const v = m.partes.pelvis.linvel();
        const k = Math.min(1, a.nadar.respuesta * PASO) * m.masa;
        const deseada = avanzar * a.nadar.velocidad;
        const agua = en.zona.frente.clone().multiplyScalar(en.zona.agua.corriente);
        m.partes.pelvis.applyImpulse(
          {
            x: (Math.sin(m.rumbo) * deseada + agua.x - v.x) * k,
            y: 0,
            z: (Math.cos(m.rumbo) * deseada + agua.z - v.z) * k,
          },
          true,
        );
      });
    },
    despues(munecos) {
      munecos.forEach((m, i) => {
        if (i > 1) return;
        const jugador = i as 0 | 1;
        const en = bajoElAgua(m);
        if (en && !mojados[jugador]) {
          caidas[jugador]++;
          const p = m.partes.pelvis.translation();
          gotas.salpicar({ x: p.x, y: en.zona.nivel, z: p.z }, 2.5, 18);
          for (const aviso of avisos) aviso(jugador, en.zona.agua);
        }
        mojados[jugador] = en !== undefined;
      });
    },
    guardar() {
      for (const z of zonas) {
        const t = z.marcador.translation();
        z.vistoAntes = z.visto;
        z.visto = t.y;
        z.corrienteVista = t.x - z.agua.zona.centro.x;
        z.corrido += z.corrienteVista * PASO;
      }
      if (zonas.length === 0) return;
      // Los chapuzones: lo que entra al agua rápido salpica (en el invitado también: mira dónde quedó cada cuerpo)
      mundo.forEachRigidBody((c) => {
        if (!c.isDynamic()) return;
        const t = c.translation();
        const y0 = antesY.get(c.handle);
        antesY.set(c.handle, t.y);
        const quedan = (espera.get(c.handle) ?? 0) - PASO;
        espera.set(c.handle, quedan);
        if (y0 === undefined || quedan > 0 || !alcance.containsPoint(punto.set(t.x, t.y, t.z))) return;
        const en = zonaEn(t);
        if (!en || y0 < en.zona.visto) return;
        const rapidez = (y0 - t.y) / PASO;
        if (rapidez < a.chapuzon.velocidad) return;
        espera.set(c.handle, a.chapuzon.espera);
        gotas.salpicar({ x: t.x, y: en.zona.visto, z: t.z }, rapidez, Math.min(a.chapuzon.gotas, 4 + rapidez * 3));
      });
    },
    dibujar(alfa, segundos) {
      for (const z of zonas) {
        const nivel = z.vistoAntes + (z.visto - z.vistoAntes) * alfa;
        z.imagen.poner(nivel, z.corrido);
      }
      gotas.mover(segundos);
    },
  };
  return aguas;
}
