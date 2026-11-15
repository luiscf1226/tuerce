// Las piezas que estrena La medianoche (TU-49), menos El Curupira (curupira.ts). Cada una sale de un nodo
// `tipo: pieza` de la escena (formato-medianoche.ts) y se arma con las herramientas de piezas.ts, como las del río:
//
//   nenufar   una hoja de vitória-régia, el nenúfar gigante del Amazonas: flota de verdad en el agua (agua.ts), se
//             ladea y se hunde un poco con el que salta encima, y su tallo la vuelve a su lugar si la corriente o un
//             salto la corren. Al que va encima, quieto, lo lleva.
//   montaria  la canoa amazónica de un solo tronco. Flota y gira solo alrededor de +y. Tiene dos puestos con su remo:
//             el de la proa rema a la izquierda y el de la popa a la derecha. Cada vez que el del puesto alza los
//             brazos da una palada; dos paladas que empiezan juntas (con menos de `compas` entre una y otra) van al
//             mismo ritmo y empujan con toda su fuerza, derecho. Fuera de ritmo (o solo) cada palada empuja apenas y
//             tuerce la canoa hacia el otro lado: contra la corriente, no se avanza.
//   fuegos    los fuegos artificiales de Año Nuevo: un castillo de morteros con una mecha a cada lado, cada una con
//             su chispero colgado de una estaca. Se encienden agarrando los dos chisperos a la vez (están lejos uno
//             del otro: hacen falta los dos). Las mechas arden hasta el castillo y los cohetes suben y estallan
//             grandes sobre el río, en rojo, turquesa y blanco. Nadie se quema: los muñecos prenden la fiesta desde
//             las puntas de las mechas.
//
// Todo lo que se mueve viaja en la foto de la red: los nenúfares, la montaria y sus remos (cuerpos cinemáticos sin
// choques que mueve la canoa), los chisperos, las chispas de las mechas y cada cohete. El invitado no simula: cada
// cohete le dice con su altura si está guardado, con su giro si ya estalló y cuánto, y así dibuja los mismos
// estallidos; la canoa le llega con sus remos en la mano.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialOjo, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import { llevaAlQuePisa, type Muneco } from "../muneco";
import type { PiezaDeLaMedianocheEnPlano } from "./formato-medianoche";
import { COLORES_NOCHE } from "./noche";
import type { Herramientas } from "./piezas";
import { ESCONDIDO } from "./piezas-canales";
import { manosEn } from "./piezas-pinar";

type Plano<C extends PiezaDeLaMedianocheEnPlano["cual"]> = Extract<PiezaDeLaMedianocheEnPlano, { cual: C }>;

/** El bit de grupo de choque de lo suelto de La medianoche (los chisperos): choca con todo menos con los muñecos
 * (bits 1 y 2); grupos del resolvedor sin filtro: se lo encuentra para agarrarlo, pero no empuja. */
const BIT_MEDIANOCHE = 1 << 11;
const GRUPOS_MEDIANOCHE = ((BIT_MEDIANOCHE << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_MEDIANOCHE << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const ABAJO = new THREE.Vector3(0, -1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Los números de las piezas de La medianoche que no se ponen desde Blender. */
export const AJUSTES_MEDIANOCHE = {
  nenufar: {
    /** Encima: la pelvis entre tanto y tanto sobre la hoja (m), y hasta tanto afuera del borde. */
    encima: [0.1, 1.3],
    borde: 0.1,
    /** El tallo frena lo que se corre: esta fracción de la amortiguación crítica. */
    amortiguar: 0.9,
    /** Y el giro sobre su tallo (1/s). */
    giro: 3,
  },
  montaria: {
    /** Por debajo y por encima del piso, la pelvis de uno que va a bordo (m). */
    bordo: [0.1, 1.2],
    /** Desde el medio, qué parte de la mitad del largo ya es la proa (o la popa). */
    puesto: 0.1,
    /** El remo: su largo (m), dónde lo agarran las manos (sobre el piso y desde el medio, en partes de la mitad) y
     * cuánto barre hacia adelante y hacia atrás (radianes). */
    remo: { largo: 1.45, alto: 0.95, donde: 0.5, barrer: 0.6 },
  },
  fuegos: {
    /** El castillo de morteros, en el medio de la caja (m). */
    castillo: { ancho: 0.9, alto: 0.75, fondo: 0.6 },
    /** El chispero cuelga de su estaca con un cordel así de largo (m), y pesa tanto (kg). */
    cordel: 0.3,
    masaChispero: 0.5,
    /** Lo que tarda cada cohete en subir y cuánto dura su estallido (s). */
    subida: 1.5,
    estallido: 2.6,
    /** Las chispas de cada estallido, cuánto caen al final (m) y su tamaño (m). */
    chispas: 170,
    caida: 2.4,
    tamano: 0.9,
    /** El giro de un cohete que estalla: va de `giro[0]` a `giro[1]` radianes alrededor de +y mientras dura. */
    giro: [0.12, 1.42],
    /** Con algo en el cielo, la cámara mira hacia arriba: qué tan rápido llega (1/s) y cuánto se queda después (s). */
    mirar: 1.2,
    quedarse: 2.5,
  },
} as const;

/** El giro que lleva el eje x del marco de la pieza al lado más largo de su caja (en el plano). */
function marcoLargo(giro: THREE.Quaternion, medio: THREE.Vector3) {
  const enX = medio.x >= medio.z;
  const ajuste = enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2);
  return { giro: giro.clone().multiply(ajuste), mitad: enX ? medio.x : medio.z, medioAncho: enX ? medio.z : medio.x };
}

/** Un cilindro de `radio` de `a` a `b` (para cordeles y palos). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 5): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Una superficie de `nu` × `nv` cuadros que sale de `f(u, v)` (u y v de 0 a 1), con normales y uv. */
function superficie(nu: number, nv: number, f: (u: number, v: number) => THREE.Vector3): THREE.BufferGeometry {
  const posiciones: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      const p = f(i / nu, j / nv);
      posiciones.push(p.x, p.y, p.z);
      uvs.push(i / nu, j / nv);
    }
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** La textura de una chispa: un punto redondo que se apaga hacia el borde. Una sola por página. */
let laChispa: THREE.DataTexture | undefined;
function texturaChispa(): THREE.DataTexture {
  if (laChispa) return laChispa;
  const n = 32;
  const datos = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
      const a = limitar(1 - d, 0, 1);
      const i = (y * n + x) * 4;
      datos.set([255, 255, 255, Math.round(255 * Math.min(1, a * a * 2.2))], i);
    }
  laChispa = new THREE.DataTexture(datos, n, n);
  laChispa.needsUpdate = true;
  return laChispa;
}

/** Puntos de luz (chispas, estallidos): no los tapa la niebla, que de noche son lo que más se ve. */
function materialDeLuz(color: number, tamano: number): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    name: "luz-de-fuegos",
    color,
    size: tamano,
    map: texturaChispa(),
    transparent: true,
    depthWrite: false,
    fog: false,
    sizeAttenuation: true,
  });
}

// ── El nenúfar gigante ────────────────────────────────────────────────────────────────────────────────────────

export interface Nenufar {
  readonly cual: "nenufar";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos están parados encima. */
  readonly encima: number;
  /** Cuánto está ladeada la hoja (radianes desde la horizontal). */
  readonly ladeo: number;
  /** Dónde la amarra su tallo (el centro de su caja). */
  readonly casa: THREE.Vector3;
  /** La pone en su lugar, quieta. */
  volver(): void;
}

export function armarNenufar(h: Herramientas, p: Plano<"nenufar">): Nenufar {
  const { rapier, mundo } = h;
  const a = AJUSTES_MEDIANOCHE.nenufar;
  const { centro, medio, giro } = p.caja;
  const radio = Math.max(medio.x, medio.z);
  const alto = medio.y;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setCanSleep(false).setAngularDamping(0.4));
  // Lleva al que salta encima: anda respecto de la hoja y, quieto, va con ella
  llevaAlQuePisa(cuerpo);
  // Un prisma de 16 lados (y no un cilindro): el agua mide lo que se hunde de cada lado en una grilla sobre su caja,
  // así la hoja se ladea y se endereza sola
  const vertices: number[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    for (const y of [-alto, alto]) vertices.push(Math.cos(ang) * radio, y, Math.sin(ang) * radio);
  }
  const forma = rapier.ColliderDesc.convexHull(new Float32Array(vertices));
  if (!forma) throw new Error(`«${p.nombre}»: no se pudo armar la hoja`);
  const colisionador = mundo.createCollider(forma.setMass(p.masa).setFriction(1.1), cuerpo);
  const imagen = crearImagenNenufar(radio, alto);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  const casa = centro.clone();
  const local = new THREE.Vector3();
  const q = new THREE.Quaternion();
  let encima = 0;
  // El tallo: un resorte de costado hacia su lugar, casi críticamente amortiguado, y el giro que se frena
  const amortiguacion = a.amortiguar * 2 * Math.sqrt(p.tallo * p.masa);
  h.antes(() => {
    const t = cuerpo.translation();
    const v = cuerpo.linvel();
    cuerpo.applyImpulse(
      {
        x: (-p.tallo * (t.x - casa.x) - amortiguacion * v.x) * PASO,
        y: 0,
        z: (-p.tallo * (t.z - casa.z) - amortiguacion * v.z) * PASO,
      },
      true,
    );
    const w = cuerpo.angvel();
    cuerpo.setAngvel({ x: w.x, y: w.y * Math.exp(-a.giro * PASO), z: w.z }, true);
  });
  h.despues((munecos, fuera) => {
    q.copy(cuerpo.rotation()).invert();
    const t = cuerpo.translation();
    encima = 0;
    for (const m of munecos) {
      const pelvis = m.partes.pelvis.translation();
      local.set(pelvis.x - t.x, pelvis.y - t.y, pelvis.z - t.z).applyQuaternion(q);
      const y = local.y - alto;
      if (Math.hypot(local.x, local.z) <= radio + a.borde && y > a.encima[0] && y < a.encima[1]) encima++;
    }
    if (fuera(t)) nenufar.volver();
  });

  const nenufar: Nenufar = {
    cual: "nenufar",
    nombre: p.nombre,
    cuerpo,
    get encima() {
      return encima;
    },
    get ladeo() {
      return ARRIBA.clone().applyQuaternion(q.copy(cuerpo.rotation())).angleTo(ARRIBA);
    },
    casa,
    volver() {
      cuerpo.setTranslation({ x: casa.x, y: casa.y, z: casa.z }, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
    },
  };
  return nenufar;
}

/** La hoja de la vitória-régia: un plato enorme con el borde levantado y las nervaduras que salen del medio. En su
 * marco, el centro de la caja (la hoja de arriba en y = `alto`). */
function crearImagenNenufar(radio: number, alto: number): THREE.Group {
  const grupo = new THREE.Group();
  const hoja = materialTela(COLORES.siluetaHonda, { repetir: 2, pelusa: false });
  const nervios = materialTela(COLORES.silueta, { repetir: 1, pelusa: false });
  // El plato: casi a ras del agua, con el borde que sube y se dobla hacia afuera
  const plato = new THREE.CylinderGeometry(radio * 0.98, radio * 0.9, alto * 0.6, 36).translate(0, alto * 0.7, 0);
  const borde = superficie(36, 3, (u, v) => {
    const a = u * Math.PI * 2;
    const r = radio * (0.98 + 0.05 * v);
    // Una muesca en el borde, como las hojas de verdad
    const y = alto + 0.02 + 0.13 * Math.sin((v * Math.PI) / 2) * (Math.abs(Math.sin(a / 2)) > 0.05 ? 1 : 0.3);
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
  const bordeAdentro = borde.clone();
  bordeAdentro.index?.array.reverse();
  bordeAdentro.computeVertexNormals();
  grupo.add(new THREE.Mesh(juntar([plato, borde, bordeAdentro]), hoja));
  // Las nervaduras: salen del medio, se abren en dos hacia el borde y se afinan
  const rayas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.2;
    const largo = radio * (0.5 + 0.06 * (i % 3));
    rayas.push(
      new THREE.BoxGeometry(largo, 0.01, 0.03)
        .translate(largo / 2, 0, 0)
        .rotateY(a)
        .translate(0, alto + 0.01, 0),
    );
    for (const s of [-1, 1]) {
      rayas.push(
        new THREE.BoxGeometry(radio * 0.4, 0.008, 0.016)
          .translate(largo + radio * 0.2 - 0.05, 0, 0)
          .rotateY(a + s * 0.16)
          .translate(0, alto + 0.01, 0),
      );
    }
  }
  grupo.add(new THREE.Mesh(juntar(rayas), nervios));
  return grupo;
}

/** La flor blanca de la vitória-régia, que se abre de noche: para poner al lado de una hoja (su base en y = 0). */
export function crearFlorDeNenufar(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "flor-de-nenufar";
  const petalos: THREE.BufferGeometry[] = [];
  for (let capa = 0; capa < 2; capa++) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + capa * 0.35;
      petalos.push(
        new THREE.SphereGeometry(0.07, 6, 4)
          .scale(0.55, 0.25, 1.6)
          .translate(0, 0, 0.1)
          .rotateX(-0.5 - capa * 0.5)
          .rotateY(a)
          .translate(0, 0.05 + capa * 0.04, 0),
      );
    }
  }
  grupo.add(new THREE.Mesh(juntar(petalos), materialOjo()));
  return grupo;
}

// ── La montaria ───────────────────────────────────────────────────────────────────────────────────────────────

/** Quién rema en cada puesto: 0 el rojo, 1 el turquesa, o nadie. */
export type Remero = 0 | 1 | null;

export interface Montaria {
  readonly cual: "montaria";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Los remos de la proa y de la popa (cuerpos cinemáticos sin choques: los mueve la canoa). */
  readonly remos: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  /** Quién va en la proa y quién en la popa, de pie en su puesto. */
  readonly remeros: readonly [Remero, Remero];
  /** Cuántos muñecos van a bordo. */
  readonly aBordo: number;
  /** Cuántas paladas dieron, y cuántas de ellas al mismo ritmo que la del otro puesto. */
  readonly paladas: number;
  readonly aCompas: number;
  /** Hacia dónde mira la proa (radianes alrededor de +y, como el rumbo de los muñecos). */
  readonly rumbo: number;
  /** Su centro (en el piso) y su giro al empezar. */
  readonly casa: { readonly centro: THREE.Vector3; readonly giro: THREE.Quaternion };
  /** Si ese punto (una pelvis) va a bordo. */
  encima(p: THREE.Vector3Like): boolean;
  /** La lleva quieta a ese centro (el de su caja), con el giro de cuando empezó. */
  llevar(centro: THREE.Vector3Like): void;
  /** La pone donde empezó, quieta. */
  volver(): void;
}

export function armarMontaria(h: Herramientas, p: Plano<"montaria">): Montaria {
  const { rapier, mundo } = h;
  const a = AJUSTES_MEDIANOCHE.montaria;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const alto = medio.y;
  // Solo gira alrededor de +y: no se vuelca con los dos de un lado, y el agua la lleva y la frena
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).enabledRotations(false, true, false).setCanSleep(false).setAngularDamping(0.6),
  );
  llevaAlQuePisa(cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad, alto, medioAncho).setMass(p.masa).setFriction(0.9),
    cuerpo,
  );
  const imagen = crearImagenMontaria(mitad, alto, medioAncho);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  // Los remos: el de la proa a la izquierda (−z de la canoa) y el de la popa a la derecha
  const lados = [-1, 1] as const;
  const manos = lados.map(
    (s, k) => new THREE.Vector3((k === 0 ? 1 : -1) * mitad * a.remo.donde, alto + a.remo.alto, s * (medioAncho + 0.08)),
  );
  const remos = lados.map(() => {
    const c = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z),
    );
    h.mover(c, crearImagenRemo(a.remo.largo));
    return c;
  }) as [RAPIER.RigidBody, RAPIER.RigidBody];

  const giroAhora = new THREE.Quaternion();
  const local = new THREE.Vector3();
  const enLaCanoa = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroAhora.copy(cuerpo.rotation()).invert();
    return local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroAhora);
  };
  const encima = (q: THREE.Vector3Like) => {
    const l = enLaCanoa(q);
    const y = l.y - alto;
    return Math.abs(l.x) <= mitad + 0.1 && Math.abs(l.z) <= medioAncho + 0.2 && y > a.bordo[0] && y < a.bordo[1];
  };

  // Las paladas: dónde empezó la última de cada puesto (en pasos) y si fue al mismo ritmo que la del otro
  const duracion = Math.max(1, Math.round(p.palada / PASO));
  const ventana = Math.round(p.compas / PASO);
  const inicio: [number, number] = [-1e9, -1e9];
  const juntas: [boolean, boolean] = [false, false];
  const brazosAntes: [boolean, boolean] = [false, false];
  let remeros: [Remero, Remero] = [null, null];
  let aBordo = 0;
  let paladas = 0;
  let aCompas = 0;
  let pasos = 0;

  /** Cómo va la palada de ese puesto: de 0 (empieza) a 1 (termina), o −1 si no está remando. */
  const progreso = (k: 0 | 1) => {
    const t = pasos - inicio[k];
    return t >= 0 && t < duracion ? t / duracion : -1;
  };

  h.antes((munecos, entradas) => {
    pasos++;
    aBordo = 0;
    remeros = [null, null];
    munecos.forEach((mu, i) => {
      if (i > 1) return;
      const e = entradas?.[i];
      const alza = !!(e?.brazoIzquierdo || e?.brazoDerecho);
      const venia = brazosAntes[i] ?? false;
      brazosAntes[i] = alza;
      const pelvis = mu.partes.pelvis.translation();
      if (!encima(pelvis)) return;
      aBordo++;
      if (mu.estado !== "de pie") return;
      const l = enLaCanoa(pelvis);
      const k = l.x > mitad * a.puesto ? 0 : l.x < -mitad * a.puesto ? 1 : null;
      if (k === null || remeros[k] !== null) return;
      remeros[k] = i as 0 | 1;
      // Una palada nueva cada vez que alza los brazos, si ya terminó la anterior
      if (!alza || venia || progreso(k) >= 0) return;
      inicio[k] = pasos;
      paladas++;
      const otro = k === 0 ? 1 : 0;
      const alRitmo = pasos - inicio[otro] <= ventana;
      juntas[k] = alRitmo;
      if (alRitmo) {
        juntas[otro] = true;
        aCompas += 2;
      }
    });

    const q = giroAhora.copy(cuerpo.rotation());
    const adelante = EJE_X.clone().applyQuaternion(q).setY(0).normalize();
    const derecha = EJE_Z.clone().applyQuaternion(q).setY(0).normalize();
    const t = cuerpo.translation();
    const com = cuerpo.worldCom();
    for (const k of [0, 1] as const) {
      const f = progreso(k);
      if (f < 0) continue;
      // La fuerza de la palada crece y se apaga (en promedio, `remo`); fuera de ritmo, apenas
      const fuerza = p.remo * (juntas[k] ? 1 : p.fuera) * (Math.PI / 2) * Math.sin(Math.PI * (f + 0.5 / duracion));
      const s = lados[k] * p.lado;
      cuerpo.applyImpulseAtPoint(
        { x: adelante.x * fuerza * PASO, y: 0, z: adelante.z * fuerza * PASO },
        { x: t.x + derecha.x * s, y: com.y, z: t.z + derecha.z * s },
        true,
      );
    }
  });

  // Los remos siguen a la canoa: en reposo, alzados hacia adelante; remando, barren de adelante hacia atrás en el agua
  const direccion = new THREE.Vector3();
  const donde = new THREE.Vector3();
  const giroRemo = new THREE.Quaternion();
  const ubicarRemos = () => {
    const q = new THREE.Quaternion().copy(cuerpo.rotation());
    const t = new THREE.Vector3().copy(cuerpo.translation());
    for (const k of [0, 1] as const) {
      const f = progreso(k);
      const s = lados[k];
      if (f < 0) direccion.set(0.55, -0.45, s * 0.75);
      else {
        const barre = a.remo.barrer * Math.cos(Math.PI * f);
        direccion.set(Math.sin(barre), -Math.cos(barre), s * 0.3);
      }
      direccion.normalize().applyQuaternion(q);
      giroRemo.setFromUnitVectors(ABAJO, direccion);
      const m = manos[k];
      if (!m) continue;
      donde.copy(m).applyQuaternion(q).add(t);
      remos[k].setTranslation(donde, true);
      remos[k].setRotation(giroRemo, true);
    }
  };
  ubicarRemos();
  h.despues(() => ubicarRemos());

  const casa = { centro: centro.clone().addScaledVector(ARRIBA, alto), giro: giro.clone() };
  const llevar = (d: THREE.Vector3Like) => {
    cuerpo.setTranslation({ x: d.x, y: d.y, z: d.z }, true);
    cuerpo.setRotation(giro, true);
    cuerpo.setLinvel(CERO, true);
    cuerpo.setAngvel(CERO, true);
    ubicarRemos();
  };
  return {
    cual: "montaria",
    nombre: p.nombre,
    cuerpo,
    remos,
    get remeros() {
      return remeros;
    },
    get aBordo() {
      return aBordo;
    },
    get paladas() {
      return paladas;
    },
    get aCompas() {
      return aCompas;
    },
    get rumbo() {
      const adelante = EJE_X.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation()));
      return Math.atan2(adelante.x, adelante.z);
    },
    casa,
    encima,
    llevar,
    volver: () => llevar(centro),
  };
}

/** La montaria: un tronco ahuecado, más angosto y levantado en las puntas, con dos bancos. En su marco, el centro de
 * la caja (el piso, donde se pisa, en y = `alto`; la proa hacia +x). */
function crearImagenMontaria(mitad: number, alto: number, medioAncho: number): THREE.Group {
  const grupo = new THREE.Group();
  const madera = materialCorteza(COLORES.silueta, { repetir: [3, 1] });
  madera.side = THREE.DoubleSide;
  const hondo = alto * 2 + 0.1;
  const casco = superficie(28, 10, (u, v) => {
    const x = (u * 2 - 1) * mitad;
    const n = Math.abs(u * 2 - 1);
    const ancho = Math.sqrt(Math.max(0, 1 - n ** 6)) * 0.94 + 0.06;
    const fi = v * Math.PI;
    const alza = 0.16 * n ** 5;
    return new THREE.Vector3(
      x,
      alto + alza - Math.sin(fi) * hondo * Math.sqrt(ancho),
      Math.cos(fi) * medioAncho * ancho,
    );
  });
  grupo.add(new THREE.Mesh(casco, madera));
  // La borda: un listón a cada lado; y los dos bancos, en los puestos
  const partes: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 20; i++) {
      const u0 = i / 20;
      const u1 = (i + 1) / 20;
      const punto = (u: number) => {
        const n = Math.abs(u * 2 - 1);
        const ancho = Math.sqrt(Math.max(0, 1 - n ** 6)) * 0.94 + 0.06;
        return new THREE.Vector3((u * 2 - 1) * mitad, alto + 0.16 * n ** 5, s * medioAncho * ancho);
      };
      partes.push(palo(punto(u0), punto(u1), 0.03, 4));
    }
  }
  for (const x of [mitad * 0.5, -mitad * 0.5])
    partes.push(new THREE.BoxGeometry(0.22, 0.04, medioAncho * 1.8).translate(x, alto - 0.12, 0));
  grupo.add(new THREE.Mesh(juntar(partes), materialCorteza(COLORES.siluetaHonda, { repetir: [1, 1] })));
  return grupo;
}

/** Un remo: en su marco, las manos en el origen y la pala abajo, a `largo`. */
function crearImagenRemo(largo: number): THREE.Group {
  const grupo = new THREE.Group();
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 2] });
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.022, 0.022, largo, 6).translate(0, 0.15 - largo / 2, 0),
        // La muleta de arriba y la pala, como una hoja
        new THREE.BoxGeometry(0.14, 0.03, 0.03).translate(0, 0.15, 0),
        new THREE.SphereGeometry(0.1, 8, 6).scale(1, 2.4, 0.18).translate(0, 0.15 - largo + 0.1, 0),
      ]),
      madera,
    ),
  );
  return grupo;
}

// ── Los fuegos artificiales ─────────────────────────────────────────────────────────────────────────────────────

export type EstadoFuegos = "apagados" | "chispeando" | "mecha" | "disparando" | "quemados";

export interface Fuegos {
  readonly cual: "fuegos";
  readonly nombre: string;
  /** Apagados; chispeando (un chispero agarrado, el otro no); la mecha ardiendo; disparando; o ya quemados. Lo
   * decide el anfitrión. */
  readonly estado: EstadoFuegos;
  /** Si ya se encendieron (ardiendo, disparando o quemados). */
  readonly encendidos: boolean;
  /** Los dos chisperos (se agarran) y si cada uno está agarrado. */
  readonly chisperos: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  readonly agarrados: readonly [boolean, boolean];
  /** Las chispas de cada mecha y los cohetes (cuerpos cinemáticos sin choques). */
  readonly chispas: readonly [RAPIER.RigidBody, RAPIER.RigidBody];
  readonly cohetes: readonly RAPIER.RigidBody[];
  /** Cuántos cohetes estallaron hasta ahora (también en el invitado, que los ve). */
  readonly estallidos: number;
  /** De 0 a 1: cuánto pide la cámara mirar al cielo (hay cohetes subiendo o estallando). Se calcula con los
   * cuerpos, así que también vale en el invitado. */
  readonly cielo: number;
  /** Prende la mecha (lo hacen los chisperos; también el guion). Si ya estaban encendidos, nada. */
  encender(): void;
  /** Los deja quemados, sin función (al retomar más adelante). */
  quemar(): void;
  /** Llama a `aviso` cuando se encienden. Devuelve cómo dejar de escuchar. */
  alEncender(aviso: () => void): () => void;
}

/** Lo que sabe la imagen de un cohete, sacado de su cuerpo: guardado, subiendo o estallando (y cuánto). */
type VistaCohete =
  | { readonly cual: "guardado" }
  | { readonly cual: "subiendo"; readonly donde: THREE.Vector3 }
  | { readonly cual: "estallando"; readonly donde: THREE.Vector3; readonly avance: number };

/** Los colores de los estallidos: los de los dos pañuelos (la luz blanca de los ojos es la del destello y la estela). */
const COLORES_FUEGOS = [COLORES.panueloRojo, COLORES.panueloTurquesa] as const;

export function armarFuegos(h: Herramientas, p: Plano<"fuegos">): Fuegos {
  const { rapier, mundo, escena } = h;
  const a = AJUSTES_MEDIANOCHE.fuegos;
  const { medio } = p.caja;
  const { giro, mitad } = marcoLargo(p.caja.giro, medio);
  const enLaCaja = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(giro).add(p.caja.centro);
  const base = -medio.y;
  const c = a.castillo;

  // El castillo: un armazón fijo con sus morteros, en el medio
  const centroCastillo = enLaCaja(0, base + c.alto / 2, 0);
  const fijo = h.fijo(centroCastillo, giro);
  const colisionador = mundo.createCollider(rapier.ColliderDesc.cuboid(c.ancho / 2, c.alto / 2, c.fondo / 2), fijo);
  const castillo = crearImagenCastillo(c.ancho, c.alto, c.fondo, p.cohetes);
  castillo.name = p.nombre;
  castillo.position.copy(centroCastillo);
  castillo.quaternion.copy(giro);
  escena.add(castillo);
  h.solida({ nombre: p.nombre, objeto: castillo, cuerpo: fijo, colisionador });

  // Las mechas: de cada punta al castillo, sobre el suelo. Al final de cada una, una estaca con su chispero colgado
  const imagenFija: THREE.BufferGeometry[] = [];
  const puntas = [-1, 1].map((s) => enLaCaja(s * mitad, base + 0.02, 0));
  const finesDeMecha = [-1, 1].map((s) => enLaCaja((s * c.ancho) / 2, base + 0.02, 0));
  const ganchos = [-1, 1].map((s) => enLaCaja(s * mitad, base + p.chispero + a.cordel, 0.12));
  for (const [i, s] of [-1, 1].entries()) {
    const punta = puntas[i] ?? centroCastillo;
    imagenFija.push(palo(punta, finesDeMecha[i] ?? punta, 0.012, 4));
    // La estaca y su brazo, del que cuelga el cordel
    imagenFija.push(
      palo(enLaCaja(s * mitad, base, -0.08), enLaCaja(s * mitad, base + p.chispero + a.cordel + 0.1, -0.08), 0.03),
    );
    imagenFija.push(palo(enLaCaja(s * mitad, base + p.chispero + a.cordel + 0.06, -0.1), ganchos[i] ?? punta, 0.018));
  }
  escena.add(new THREE.Mesh(juntar(imagenFija), h.oscuro));

  const chisperos = ganchos.map((gancho) => {
    const ancla = h.fijo(gancho, giro);
    const cuerpo = mundo.createRigidBody(
      h.dinamico(gancho.clone().addScaledVector(ARRIBA, -a.cordel), giro).setLinearDamping(0.6).setAngularDamping(2),
    );
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(0.14, 0.05, 0.05)
        .setMass(a.masaChispero)
        .setCollisionGroups(GRUPOS_MEDIANOCHE)
        .setSolverGroups(SIN_EMPUJAR),
      cuerpo,
    );
    const junta = mundo.createImpulseJoint(
      rapier.JointData.spherical(CERO, { x: 0, y: a.cordel, z: 0 }),
      ancla,
      cuerpo,
      true,
    );
    junta.setContactsEnabled(false);
    h.mover(cuerpo, crearImagenChispero());
    return cuerpo;
  }) as [RAPIER.RigidBody, RAPIER.RigidBody];
  // Los cordeles, del gancho al chispero: se estiran al dibujar
  const cordeles = ganchos.map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), h.oscuro);
    escena.add(m);
    return m;
  });

  // Las chispas de las mechas y los cohetes: guardados bajo el nivel hasta que salen
  const guardado = enLaCaja(0, 0, 0).setY(ESCONDIDO);
  const cinematico = () =>
    mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(guardado.x, guardado.y, guardado.z),
    );
  const chispas = [cinematico(), cinematico()] as [RAPIER.RigidBody, RAPIER.RigidBody];
  const cohetes = Array.from({ length: p.cohetes }, cinematico);
  // Por dónde sale y dónde estalla cada uno: siempre igual (azar con semilla), detrás de la caja, sobre el río
  const azar = crearAzar(p.semilla * 7919 + 17);
  const boca = enLaCaja(0, base + c.alto + 0.05, 0);
  const destinos = cohetes.map(() =>
    enLaCaja(
      (azar() * 2 - 1) * p.radio * 1.4,
      base + p.altura * (0.8 + 0.4 * azar()),
      -p.fondo * (0.8 + 0.35 * azar()),
    ),
  );
  /** El giro que dice cuánto va un estallido (0 a 1). */
  const giroDeEstallido = (avance: number) =>
    new THREE.Quaternion().setFromAxisAngle(ARRIBA, a.giro[0] + (a.giro[1] - a.giro[0]) * avance);

  let estado: EstadoFuegos = "apagados";
  let pasosEstado = 0;
  let juntos = 0;
  let agarrados: [boolean, boolean] = [false, false];
  const avisos = new Set<() => void>();
  const encender = () => {
    if (estado === "mecha" || estado === "disparando" || estado === "quemados") return;
    estado = "mecha";
    pasosEstado = 0;
    for (const aviso of avisos) aviso();
  };

  /** Pone las chispas y los cohetes donde les toca según el estado (en el anfitrión, que lo decide). */
  const donde = new THREE.Vector3();
  const ubicar = () => {
    const t = pasosEstado * PASO;
    chispas.forEach((chispa, i) => {
      const chispero = chisperos[i];
      const punta = puntas[i];
      const fin = finesDeMecha[i];
      if (!chispero || !punta || !fin) return;
      if (estado === "chispeando" && agarrados[i]) {
        chispa.setNextKinematicTranslation(chispero.translation());
      } else if (estado === "mecha") {
        // Arde de la punta al castillo
        donde.copy(punta).lerp(fin, limitar(t / Math.max(0.01, p.mecha), 0, 1));
        donde.y += 0.04;
        chispa.setNextKinematicTranslation(donde);
      } else chispa.setNextKinematicTranslation(guardado);
    });
    cohetes.forEach((cohete, i) => {
      const destino = destinos[i];
      if (!destino) return;
      const ti = t - i * p.cada;
      if (estado !== "disparando" || ti < 0 || ti > a.subida + a.estallido) {
        cohete.setNextKinematicTranslation(guardado);
        cohete.setNextKinematicRotation(giro);
        return;
      }
      if (ti < a.subida) {
        // Sube frenando, derecho al lugar donde estalla
        const f = ti / a.subida;
        const subir = 1 - (1 - f) * (1 - f);
        donde.set(
          boca.x + (destino.x - boca.x) * f,
          boca.y + (destino.y - boca.y) * subir,
          boca.z + (destino.z - boca.z) * f,
        );
        cohete.setNextKinematicTranslation(donde);
        cohete.setNextKinematicRotation(new THREE.Quaternion());
      } else {
        cohete.setNextKinematicTranslation(destino);
        cohete.setNextKinematicRotation(giroDeEstallido((ti - a.subida) / a.estallido));
      }
    });
  };

  h.despues((munecos: readonly Muneco[]) => {
    agarrados = chisperos.map((ch) => munecos.some((m) => manosEn(m, ch) > 0)) as [boolean, boolean];
    if (estado === "apagados" || estado === "chispeando") {
      // Los dos chisperos a la vez, un ratito: prende. Uno solo, chispea y nada más
      const ambos = agarrados[0] && agarrados[1];
      juntos = ambos ? juntos + 1 : 0;
      estado = agarrados[0] || agarrados[1] ? "chispeando" : "apagados";
      if (ambos && juntos * PASO >= p.juntos) encender();
    } else if (estado === "mecha") {
      pasosEstado++;
      if (pasosEstado * PASO >= p.mecha) {
        estado = "disparando";
        pasosEstado = 0;
      }
    } else if (estado === "disparando") {
      pasosEstado++;
      if (pasosEstado * PASO > (p.cohetes - 1) * p.cada + a.subida + a.estallido) estado = "quemados";
    }
    ubicar();
  });

  // ── La imagen (en los dos, con los cuerpos como llegan) ──
  const vistas: VistaCohete[] = cohetes.map(() => ({ cual: "guardado" }));
  const vistasAntes: VistaCohete[] = cohetes.map(() => ({ cual: "guardado" }));
  let estallidos = 0;
  const yaEstallaron = new Set<number>();
  let cielo = 0;
  let quedarse = 0;
  const leerCohete = (cohete: RAPIER.RigidBody): VistaCohete => {
    const t = cohete.translation();
    if (t.y < ESCONDIDO / 2) return { cual: "guardado" };
    const r = cohete.rotation();
    const angulo = 2 * Math.acos(Math.min(1, Math.abs(r.w)));
    const p3 = new THREE.Vector3(t.x, t.y, t.z);
    if (angulo < a.giro[0] / 2) return { cual: "subiendo", donde: p3 };
    return { cual: "estallando", donde: p3, avance: limitar((angulo - a.giro[0]) / (a.giro[1] - a.giro[0]), 0, 1) };
  };
  h.guardar(() => {
    let algo = false;
    cohetes.forEach((cohete, i) => {
      vistasAntes[i] = vistas[i] ?? { cual: "guardado" };
      const v = leerCohete(cohete);
      vistas[i] = v;
      if (v.cual !== "guardado") algo = true;
      if (v.cual === "estallando" && !yaEstallaron.has(i)) {
        yaEstallaron.add(i);
        estallidos++;
      }
      if (v.cual === "guardado") yaEstallaron.delete(i);
    });
    // La mecha ardiendo también levanta la mirada: los dos chispas afuera
    if (chispas.every((ch) => ch.translation().y > ESCONDIDO / 2) && !agarrados.some(Boolean)) algo = true;
    quedarse = algo ? a.quedarse : Math.max(0, quedarse - PASO);
    const meta = quedarse > 0 ? 1 : 0;
    cielo += (meta - cielo) * (1 - Math.exp(-a.mirar * PASO));
  });

  // Los estallidos: cada cohete con sus chispas (direcciones al azar con semilla), su cabeza y su estela
  const imagenes = cohetes.map((_, i) => {
    const color = COLORES_FUEGOS[i % COLORES_FUEGOS.length] ?? COLORES.ojo;
    const dirs: THREE.Vector3[] = [];
    for (let k = 0; k < a.chispas; k++) {
      const z = azar() * 2 - 1;
      const fi = azar() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      // Un poco desparejas, como las de verdad
      dirs.push(new THREE.Vector3(r * Math.cos(fi), z, r * Math.sin(fi)).multiplyScalar(0.82 + 0.18 * azar()));
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(a.chispas * 3), 3));
    const estallido = new THREE.Points(geometria, materialDeLuz(color, a.tamano));
    estallido.frustumCulled = false;
    estallido.visible = false;
    escena.add(estallido);
    // El corazón blanco del estallido, que dura poco
    const destello = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3)),
      materialDeLuz(COLORES.ojo, 3),
    );
    destello.frustumCulled = false;
    destello.visible = false;
    escena.add(destello);
    const estela = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Float32Array(10 * 3), 3),
      ),
      materialDeLuz(COLORES.ojo, 0.22),
    );
    estela.frustumCulled = false;
    estela.visible = false;
    escena.add(estela);
    return { estallido, destello, estela, dirs, color, pasado: [] as THREE.Vector3[] };
  });
  // Las chispas de las mechas
  const brillos = chispas.map(() => {
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(12 * 3), 3));
    const puntos = new THREE.Points(geometria, materialDeLuz(COLORES.ojo, 0.12));
    puntos.frustumCulled = false;
    puntos.visible = false;
    escena.add(puntos);
    return puntos;
  });
  // La luz de los estallidos sobre la playa: del color del último
  const luz = new THREE.PointLight(COLORES.ojo, 0, 45, 1);
  luz.position.copy(enLaCaja(0, base + 5, -3));
  escena.add(luz);
  let cuadro = 0;
  const actual = new THREE.Vector3();
  const anclaCordel = new THREE.Vector3();
  h.dibujar((alfa) => {
    cuadro++;
    let brillo = 0;
    let colorLuz: number = COLORES.ojo;
    imagenes.forEach((im, i) => {
      const v = vistas[i] ?? { cual: "guardado" };
      const antes = vistasAntes[i] ?? v;
      im.estallido.visible = v.cual === "estallando";
      im.destello.visible = false;
      im.estela.visible = v.cual === "subiendo";
      if (v.cual === "subiendo") {
        actual
          .copy(antes.cual === "guardado" ? v.donde : antes.cual === "subiendo" ? antes.donde : v.donde)
          .lerp(v.donde, alfa);
        im.pasado.unshift(actual.clone());
        if (im.pasado.length > 10) im.pasado.length = 10;
        const pos = im.estela.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let k = 0; k < 10; k++) {
          const q = im.pasado[Math.min(k, im.pasado.length - 1)] ?? actual;
          pos.setXYZ(k, q.x, q.y - k * 0.05, q.z);
        }
        pos.needsUpdate = true;
      } else im.pasado.length = 0;
      if (v.cual !== "estallando") return;
      const avance = antes.cual === "estallando" ? antes.avance + (v.avance - antes.avance) * alfa : v.avance;
      // Se abre rápido y frena; al final caen y se apagan
      const abrir = 1 - (1 - avance) ** 3;
      const pos = im.estallido.geometry.getAttribute("position") as THREE.BufferAttribute;
      im.dirs.forEach((d, k) => {
        pos.setXYZ(
          k,
          v.donde.x + d.x * p.radio * abrir,
          v.donde.y + d.y * p.radio * abrir - a.caida * avance * avance,
          v.donde.z + d.z * p.radio * abrir,
        );
      });
      pos.needsUpdate = true;
      const material = im.estallido.material as THREE.PointsMaterial;
      material.opacity = limitar(1.15 - avance ** 1.6, 0, 1);
      material.size = a.tamano * (1 - 0.5 * avance) * (avance > 0.7 && (cuadro + k0(i)) % 4 < 2 ? 0.6 : 1);
      if (avance < 0.12) {
        im.destello.visible = true;
        im.destello.position.copy(v.donde);
        (im.destello.material as THREE.PointsMaterial).opacity = 1 - avance / 0.12;
      }
      const b = (1 - avance) ** 2;
      if (b > brillo) {
        brillo = b;
        colorLuz = im.color;
      }
    });
    luz.intensity = brillo * 10;
    luz.color.set(colorLuz);
    // Las chispas de las mechas: titilan alrededor de su cuerpo
    brillos.forEach((puntos, i) => {
      const chispa = chispas[i];
      if (!chispa) return;
      const t = chispa.translation();
      puntos.visible = t.y > ESCONDIDO / 2;
      if (!puntos.visible) return;
      const pos = puntos.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let k = 0; k < 12; k++) {
        const fi = (k * 2.4 + cuadro * 0.9 + i) % (Math.PI * 2);
        const r = 0.05 + 0.12 * (((k * 37 + cuadro * 13) % 17) / 17);
        pos.setXYZ(
          k,
          t.x + Math.cos(fi) * r,
          t.y + 0.04 + (((k * 11 + cuadro * 7) % 13) / 13) * 0.22,
          t.z + Math.sin(fi) * r,
        );
      }
      pos.needsUpdate = true;
    });
    // Los cordeles de los chisperos
    cordeles.forEach((cordel, i) => {
      const gancho = ganchos[i];
      const ch = chisperos[i];
      if (!gancho || !ch) return;
      const t = ch.translation();
      anclaCordel.set(t.x, t.y + 0.05, t.z);
      cordel.position.addVectors(anclaCordel, gancho).multiplyScalar(0.5);
      cordel.scale.set(1, Math.max(0.01, anclaCordel.distanceTo(gancho)), 1);
      cordel.quaternion.setFromUnitVectors(ARRIBA, gancho.clone().sub(anclaCordel).normalize());
    });
  });

  return {
    cual: "fuegos",
    nombre: p.nombre,
    get estado() {
      return estado;
    },
    get encendidos() {
      return estado === "mecha" || estado === "disparando" || estado === "quemados";
    },
    chisperos,
    get agarrados() {
      return agarrados;
    },
    chispas,
    cohetes,
    get estallidos() {
      return estallidos;
    },
    get cielo() {
      return cielo;
    },
    encender,
    quemar() {
      estado = "quemados";
      pasosEstado = 0;
      ubicar();
    },
    alEncender(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** Un número chico distinto para cada cohete (para que no titilen todos a la vez). */
const k0 = (i: number) => (i * 3) % 4;

/** El castillo: un armazón de cañas con su fila de morteros. En su marco, el centro (de `alto`). */
function crearImagenCastillo(ancho: number, alto: number, fondo: number, morteros: number): THREE.Group {
  const grupo = new THREE.Group();
  const partes: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      partes.push(
        new THREE.CylinderGeometry(0.03, 0.035, alto, 5).translate((sx * ancho) / 2.2, 0, (sz * fondo) / 2.2),
      );
  for (const y of [-alto * 0.3, alto * 0.3]) {
    partes.push(new THREE.BoxGeometry(ancho, 0.04, 0.04).translate(0, y, fondo / 2.2));
    partes.push(new THREE.BoxGeometry(ancho, 0.04, 0.04).translate(0, y, -fondo / 2.2));
  }
  const n = Math.max(1, morteros);
  const filas = 2;
  const columnas = Math.ceil(n / filas);
  for (let i = 0; i < n; i++) {
    const x = ((i % columnas) / Math.max(1, columnas - 1) - 0.5) * ancho * 0.75;
    const z = (Math.floor(i / columnas) - 0.5) * fondo * 0.45;
    partes.push(new THREE.CylinderGeometry(0.06, 0.065, alto * 0.55, 8).translate(x, alto * 0.25, z));
  }
  grupo.add(new THREE.Mesh(juntar(partes), materialCorteza(COLORES.silueta, { repetir: [1, 1] })));
  return grupo;
}

/** El chispero: un palito con su argolla (el cordel cuelga de la argolla). En su marco, su centro. */
function crearImagenChispero(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.03, 0.03, 0.28, 6).rotateZ(Math.PI / 2),
        new THREE.TorusGeometry(0.04, 0.01, 4, 10).translate(0, 0.05, 0),
      ]),
      materialCorteza(COLORES.siluetaHonda, { repetir: [1, 1] }),
    ),
  );
  // La cabeza de fósforo, clara
  grupo.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6).translate(0.15, 0, 0), materialOjo()));
  return grupo;
}

// ── Lo que solo se ve (lo pone el guion) ────────────────────────────────────────────────────────────────────────

/** El arbolito que pide El Curupira: un terrón envuelto en costal (del tamaño de `medio`, su media caja) con el
 * plantón encima. En su marco, el centro del terrón. */
export function crearImagenArbolito(medio: THREE.Vector3Like): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "arbolito";
  const costal = materialTela(COLORES.silueta, { repetir: 1 });
  const terron = new THREE.SphereGeometry(1, 12, 8).scale(medio.x * 1.05, medio.y * 1.1, medio.z * 1.05);
  grupo.add(new THREE.Mesh(terron, costal));
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 2] });
  const tallo = new THREE.CylinderGeometry(0.03, 0.05, 1.5, 6).translate(0, medio.y + 0.7, 0);
  const ramas: THREE.BufferGeometry[] = [tallo];
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4;
    const y = medio.y + 0.75 + i * 0.16;
    ramas.push(
      palo(new THREE.Vector3(0, y, 0), new THREE.Vector3(Math.cos(a) * 0.3, y + 0.22, Math.sin(a) * 0.3), 0.014, 4),
    );
  }
  grupo.add(new THREE.Mesh(juntar(ramas), madera));
  const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  const copa: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1;
    copa.push(
      new THREE.SphereGeometry(0.2 + 0.04 * (i % 3), 7, 5)
        .scale(1, 0.7, 1)
        .translate(Math.cos(a) * 0.26, medio.y + 1.25 + 0.12 * (i % 3), Math.sin(a) * 0.26),
    );
  }
  copa.push(new THREE.SphereGeometry(0.24, 7, 5).translate(0, medio.y + 1.55, 0));
  grupo.add(new THREE.Mesh(juntar(copa), hojas));
  return grupo;
}

/** El hoyo donde va el árbol: la tierra removida alrededor. En su marco, el suelo en y = 0. */
export function crearImagenHoyo(radio: number): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "hoyo";
  // La boca, honda y oscura, y alrededor la tierra sacada en terrones
  grupo.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radio * 0.7, radio * 0.7, 0.02, 20).translate(0, 0.005, 0),
      materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false }),
    ),
  );
  const terrones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.3 * Math.sin(i * 3.1);
    const r = radio * (0.95 + 0.25 * ((i * 7) % 3) * 0.5);
    terrones.push(
      new THREE.SphereGeometry(0.07 + 0.03 * ((i * 5) % 3), 6, 4)
        .scale(1, 0.55, 1)
        .translate(Math.cos(a) * r, 0.02, Math.sin(a) * r),
    );
  }
  grupo.add(new THREE.Mesh(juntar(terrones), materialTela(COLORES.silueta, { repetir: 1, pelusa: false })));
  return grupo;
}

/** Un árbol del igapó, el bosque inundado: tronco alto con raíces de tabla (sapopemas) y copa ancha. En su marco, el
 * pie en y = 0. */
export function crearArbolDeIgapo(madera: THREE.Material, hojas: THREE.Material, alto: number, semilla: number) {
  const grupo = new THREE.Group();
  const azar = crearAzar(semilla * 131 + 7);
  const radio = 0.16 + alto * 0.018;
  const tronco: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(radio * 0.7, radio, alto, 8).translate(0, alto / 2, 0),
  ];
  // Las sapopemas: tablas que bajan del tronco y se abren en el suelo
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + azar();
    const largo = 0.7 + azar() * 0.7;
    const forma = new THREE.Shape();
    forma.moveTo(0, 0);
    forma.lineTo(largo, 0);
    forma.quadraticCurveTo(radio, 0.2, 0, 1.2 + azar() * 0.8);
    forma.lineTo(0, 0);
    tronco.push(
      new THREE.ExtrudeGeometry(forma, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025).rotateY(-a),
    );
  }
  // Ramas hacia la copa
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + azar();
    const y = alto * (0.7 + 0.08 * i);
    tronco.push(
      palo(
        new THREE.Vector3(0, y, 0),
        new THREE.Vector3(Math.cos(a) * alto * 0.2, y + alto * 0.12, Math.sin(a) * alto * 0.2),
        radio * 0.35,
        5,
      ),
    );
  }
  grupo.add(new THREE.Mesh(juntar(tronco), madera));
  const copa: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1 + azar();
    const r = alto * (0.1 + 0.05 * azar());
    copa.push(
      new THREE.SphereGeometry(r, 8, 6)
        .scale(1.3, 0.55, 1.3)
        .translate(Math.cos(a) * alto * 0.17, alto * (0.86 + 0.08 * azar()), Math.sin(a) * alto * 0.17),
    );
  }
  grupo.add(new THREE.Mesh(juntar(copa), hojas));
  return grupo;
}

/** El delfín rosado (el boto) del recodo del río: sin color nuevo, es lo único claro y brillante del agua. En su
 * marco, el lomo hacia +y y la trompa hacia +x. */
export function crearDelfin(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "delfin";
  const piel = new THREE.MeshStandardMaterial({
    name: "delfin",
    color: COLORES.niebla,
    emissive: COLORES.ojo,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });
  const partes = [
    new THREE.SphereGeometry(0.3, 14, 10).scale(2.6, 0.95, 1),
    // La trompa larga y la frente redonda del boto
    new THREE.CylinderGeometry(0.05, 0.08, 0.5, 8).rotateZ(-Math.PI / 2).translate(0.95, -0.06, 0),
    new THREE.SphereGeometry(0.22, 10, 8).translate(0.55, 0.08, 0),
    // La aleta de atrás y la cola
    new THREE.ConeGeometry(0.1, 0.22, 5).scale(1.6, 1, 0.3).translate(-0.1, 0.3, 0),
    new THREE.SphereGeometry(0.2, 8, 4).scale(0.5, 0.12, 1.6).translate(-0.85, 0, 0),
  ];
  grupo.add(new THREE.Mesh(juntar(partes), piel));
  return grupo;
}

/** La luna llena de la medianoche: un disco claro que no tapa la niebla. */
export function crearLuna(radio: number): THREE.Mesh {
  const luna = new THREE.Mesh(
    new THREE.SphereGeometry(radio, 20, 14),
    new THREE.MeshBasicMaterial({ name: "luna", color: COLORES_NOCHE.luna, fog: false }),
  );
  luna.name = "luna";
  return luna;
}

/** Baja las luces de la escena (veces su intensidad): la medianoche, más oscura que la noche de tuerce. */
export function bajarLasLuces(escena: THREE.Scene, veces: number): void {
  for (const luz of escena.children) if (luz instanceof THREE.Light) luz.intensity *= veces;
}
