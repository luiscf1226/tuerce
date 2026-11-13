// Las piezas que estrenan Los canales de Xochimilco (TU-42), menos La Llorona (llorona.ts). Cada una sale de un nodo
// `tipo: pieza` de la escena (formato-canales.ts) y se arma con las herramientas de piezas.ts, como las del río:
//
//   trajinera  una lancha plana que flota (agua.ts) y gira solo alrededor de +y, con un arco en la proa. Tiene dos
//              pértigas, una de cada lado de la popa: empuja la de un lado el que va de pie en ese lado de la popa
//              con los brazos alzados. Una sola la tuerce (se clava de costado); las dos, derecho. Puede llevar flores
//              en el piso: cada golpe fuerte (un cambio brusco de velocidad) bota una al agua. Al que va a bordo,
//              quieto, la trajinera lo lleva.
//   chinampa   una chinampa flotante, un islote de tierra y raíces: se hunde mientras alguien está parado encima
//              (más rápido con dos) y vuelve a subir sola cuando queda vacía.
//   pinata     una piñata colgada de una soga entre dos postes. La soga baja hasta una manija junto a un poste:
//              jalándola caminando hacia atrás (como la tranca del pinar), la piñata baja; al soltarla, sube sola.
//              Abajo se le pega: la mano o la cabeza que llega rápido cuenta un golpe; con los que aguanta, se rompe.
//
// Todo lo que se mueve (la trajinera y sus flores, las chinampas, la piñata y su manija) viaja en la foto de la red.
// El invitado no simula: cuenta las flores que ve a bordo, mueve las pértigas si la trajinera avanza, dibuja la soga
// y rompe la piñata (con sus dulces) cuando la ve desaparecer.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { llevaAlQuePisa, type Muneco, type NombreParte } from "../muneco";
import type { PiezaDeLosCanalesEnPlano } from "./formato-canales";
import type { Herramientas } from "./piezas";

/** El bit de grupo de choque de lo suelto de los canales (la manija de la piñata): choca con todo menos con los
 * muñecos (bits 1 y 2); grupos del resolvedor sin filtro: se la encuentra para agarrarla, pero no empuja. */
const BIT_CANALES = 1 << 8;
const GRUPOS_CANALES = ((BIT_CANALES << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_CANALES << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
/** Donde se esconde lo que ya no está (una flor hundida, la piñata rota): bajo el nivel, dentro de la foto. */
export const ESCONDIDO = -40;

/** Los números de las piezas de los canales que no se ponen desde Blender. */
export const AJUSTES_CANALES = {
  trajinera: {
    /** Qué parte del largo, desde atrás, es la popa: ahí se para el que empuja. */
    popa: 0.4,
    /** Por debajo y por encima del piso, la pelvis de uno que va a bordo (m). */
    bordo: [0.15, 1.2],
    /** El alto de las bordas sobre el piso (m). */
    borda: 0.14,
    /** Entre un golpe que bota una flor y el siguiente que cuenta (pasos). */
    entreGolpes: 30,
    /** La flor botada: cuánto vuela (s), cuánto flota antes de hundirse (s) y qué tan rápido se aleja (m/s). */
    vuelo: 0.6,
    flota: 6,
    deriva: 0.25,
    /** Las flores van en el medio del piso, en dos filas, desde esta fracción del largo (desde la popa) hasta la otra. */
    flores: [0.38, 0.8],
  },
  chinampa: {
    /** Encima: la pelvis entre tanto y tanto sobre la tierra (m), y hasta tanto afuera del borde. */
    encima: [0.1, 1.2],
    borde: 0.05,
    /** Se mece apenas: cuánto (m) y cada cuánto (s). */
    mecer: { alto: 0.025, periodo: 3.4 },
  },
  pinata: {
    /** La soga de arriba, entre los postes: cuánto baja la piñata desde ahí en reposo (m). */
    colgar: 0.55,
    /** El radio de la piñata (m): una bola con siete picos. */
    radio: 0.32,
    /** La manija: su alto sobre el suelo, cuánto queda hacia adentro del poste, su masa y su medio largo. */
    manija: { alto: 1.05, adentro: 0.75, masa: 1.5, medio: 0.22 },
    /** Qué tan rápido sigue a la soga (1/s). */
    seguir: 10,
    /** Lo que alcanza a pegarle: la mano (el brazo, desde su centro) y la cabeza, más el radio de la piñata (m). */
    alcance: { brazo: 0.32, cabeza: 0.26 },
    /** Entre dos golpes del mismo muñeco (pasos). */
    entreGolpes: 24,
    /** Cuánto se mece con cada golpe (radianes) y qué tan rápido se aquieta (1/s). */
    mecer: 0.45,
    aquietar: 1.2,
  },
} as const;

/** El giro que lleva el eje x del marco de la pieza al lado más largo de su caja (en el plano). */
function marcoLargo(giro: THREE.Quaternion, medio: THREE.Vector3) {
  const enX = medio.x >= medio.z;
  const ajuste = enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2);
  return {
    giro: giro.clone().multiply(ajuste),
    mitad: enX ? medio.x : medio.z,
    medioAncho: enX ? medio.z : medio.x,
  };
}

/** Un cilindro de `radio` de `a` a `b` (para sogas y palos). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 5): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// ── La trajinera ────────────────────────────────────────────────────────────────────────────────────────────

/** Quién empuja con cada pértiga: 0 el rojo, 1 el turquesa, o nadie. */
export type Pertiguero = 0 | 1 | null;

export interface Trajinera {
  readonly cual: "trajinera";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Quién empuja con la pértiga de la izquierda y quién con la de la derecha (mirando hacia la proa). */
  readonly pertigas: readonly [Pertiguero, Pertiguero];
  /** Cuántos muñecos van a bordo. */
  readonly aBordo: number;
  /** Hacia dónde mira la proa (radianes alrededor de +y, como el rumbo de los muñecos). */
  readonly rumbo: number;
  /** Cuántas flores lleva a bordo (también en el invitado, que las ve), de cuántas. */
  readonly flores: number;
  readonly totalFlores: number;
  /** Los cuerpos de las flores (cinemáticos, sin choques): van en el piso y, botadas, flotan y se hunden. */
  readonly cuerposDeFlores: readonly RAPIER.RigidBody[];
  /** Llama a `aviso` cada vez que un golpe bota una flor. Devuelve cómo dejar de escuchar. */
  alBotarFlor(aviso: (quedan: number) => void): () => void;
  /** Su centro (en el piso) y su giro al empezar. */
  readonly casa: { readonly centro: THREE.Vector3; readonly giro: THREE.Quaternion };
  /** Si ese punto (una pelvis) va a bordo: encima del piso de la trajinera. */
  encima(p: THREE.Vector3Like): boolean;
  /** La lleva quieta a ese centro (el de su caja), con el giro de cuando empezó. Las flores que llevaba, siguen. */
  llevar(centro: THREE.Vector3Like): void;
  /** La pone donde empezó, quieta y con todas sus flores (si se fue lejos sin nadie). */
  volver(): void;
}

/** Una flor: a bordo (en su lugar del piso), volando al agua, flotando o ya hundida. */
type EstadoFlor =
  | { readonly cual: "a bordo" }
  | { readonly cual: "volando"; readonly desde: THREE.Vector3; readonly hacia: THREE.Vector3; t: number }
  | { readonly cual: "flotando"; readonly donde: THREE.Vector3; readonly deriva: THREE.Vector3; t: number }
  | { readonly cual: "hundida" };

export function armarTrajinera(
  h: Herramientas,
  p: Extract<PiezaDeLosCanalesEnPlano, { cual: "trajinera" }>,
): Trajinera {
  const { rapier, mundo } = h;
  const a = AJUSTES_CANALES.trajinera;
  const { centro, medio } = p.caja;
  const { giro, mitad, medioAncho } = marcoLargo(p.caja.giro, medio);
  const alto = medio.y;
  // Solo gira alrededor de +y: así no se vuelca con los dos de un lado, y el agua la lleva y la frena
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).enabledRotations(false, true, false).setCanSleep(false).setAngularDamping(0.5),
  );
  // Lleva al que va a bordo: anda respecto de la trajinera y, quieto, va con ella
  llevaAlQuePisa(cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(mitad, alto, medioAncho).setMass(p.masa).setFriction(0.9),
    cuerpo,
  );
  // El arco: su viga de arriba choca (no pasa bajo un puente bajo); los postes no, para no estorbar en el piso
  const xArco = mitad * 0.78;
  if (p.arco > 0) {
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(0.06, 0.12, medioAncho)
        .setTranslation(xArco, alto + p.arco - 0.12, 0)
        .setMass(0.01)
        .setFriction(0.5),
      cuerpo,
    );
  }

  const imagen = crearImagenTrajinera(h.madera, h.oscuro, mitad, alto, medioAncho, p.arco);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const local = new THREE.Vector3();
  const giroAhora = new THREE.Quaternion();
  /** El punto en el marco de la trajinera (0 en su centro, +x hacia la proa, +z a la derecha). */
  const enLaTrajinera = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroAhora.copy(cuerpo.rotation()).invert();
    return local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroAhora);
  };
  const encima = (q: THREE.Vector3Like) => {
    const l = enLaTrajinera(q);
    const y = l.y - alto;
    return Math.abs(l.x) <= mitad + 0.1 && Math.abs(l.z) <= medioAncho + 0.15 && y > a.bordo[0] && y < a.bordo[1];
  };
  const rumboAhora = () => {
    const adelante = EJE_X.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation()));
    return Math.atan2(adelante.x, adelante.z);
  };

  // Las flores: en dos filas a lo largo del medio del piso. Cuerpos cinemáticos sin choques: los mueve esta pieza
  const lugares: THREE.Vector3[] = [];
  for (let i = 0; i < p.flores; i++) {
    const fila = i % 2 === 0 ? -1 : 1;
    const columnas = Math.ceil(p.flores / 2);
    const k = Math.floor(i / 2);
    const f = columnas > 1 ? k / (columnas - 1) : 0.5;
    const x = -mitad + 2 * mitad * (a.flores[0] + (a.flores[1] - a.flores[0]) * f);
    lugares.push(new THREE.Vector3(x, alto, fila * medioAncho * 0.42));
  }
  const enElPiso = (l: THREE.Vector3) =>
    l.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation())).add(new THREE.Vector3().copy(cuerpo.translation()));
  const flores = lugares.map((l) => {
    const donde = enElPiso(l);
    const c = mundo.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(donde.x, donde.y, donde.z).setRotation(giro),
    );
    const maceta = crearMaceta(h.oscuro);
    h.mover(c, maceta);
    return c;
  });
  const estados: EstadoFlor[] = lugares.map(() => ({ cual: "a bordo" }));
  const avisos = new Set<(quedan: number) => void>();
  const aBordoAhora = () => estados.filter((e) => e.cual === "a bordo").length;
  /** Pone cada flor donde le toca: en su lugar del piso o volando, flotando o escondida. */
  const ubicarFlores = () => {
    const q = giroAhora.copy(cuerpo.rotation()).clone();
    flores.forEach((c, i) => {
      const e = estados[i];
      const l = lugares[i];
      if (!e || !l) return;
      if (e.cual === "a bordo") {
        const d = enElPiso(l);
        c.setTranslation(d, true);
        c.setRotation(q, true);
      } else if (e.cual === "volando") {
        const f = limitar(e.t / a.vuelo, 0, 1);
        c.setTranslation(
          {
            x: e.desde.x + (e.hacia.x - e.desde.x) * f,
            y: e.desde.y + (e.hacia.y - e.desde.y) * f + 1.2 * Math.sin(Math.PI * f),
            z: e.desde.z + (e.hacia.z - e.desde.z) * f,
          },
          true,
        );
      } else if (e.cual === "flotando") {
        const hundirse = limitar((e.t - a.flota) / 1.5, 0, 1);
        c.setTranslation(
          {
            x: e.donde.x + e.deriva.x * e.t,
            y: e.donde.y - 0.6 * hundirse + 0.02 * Math.sin(e.t * 2.3),
            z: e.donde.z + e.deriva.z * e.t,
          },
          true,
        );
      } else c.setTranslation({ x: centro.x, y: ESCONDIDO, z: centro.z }, true);
    });
  };

  let pertigas: [Pertiguero, Pertiguero] = [null, null];
  let aBordo = 0;
  h.antes((munecos, entradas) => {
    const com = cuerpo.worldCom();
    aBordo = 0;
    pertigas = [null, null];
    munecos.forEach((mu, i) => {
      const pelvis = mu.partes.pelvis.translation();
      if (!encima(pelvis)) return;
      aBordo++;
      // De pie en la popa, con los brazos alzados: empuja la pértiga de su lado
      const e = entradas?.[i];
      if (mu.estado !== "de pie" || i > 1 || (!e?.brazoIzquierdo && !e?.brazoDerecho)) return;
      const l = enLaTrajinera(pelvis);
      if (l.x / mitad > -1 + 2 * a.popa) return;
      const lado = l.z > 0 ? 1 : 0;
      pertigas[lado] ??= i as 0 | 1;
    });
    const q = giroAhora.copy(cuerpo.rotation());
    const adelante = EJE_X.clone().applyQuaternion(q).setY(0).normalize();
    const derecha = EJE_Z.clone().applyQuaternion(q).setY(0).normalize();
    const t = cuerpo.translation();
    // Cada pértiga se clava de su lado: empuja hacia adelante y, sola, la hace girar
    pertigas.forEach((quien, lado) => {
      if (quien === null) return;
      const s = lado === 1 ? p.lado : -p.lado;
      cuerpo.applyImpulseAtPoint(
        { x: adelante.x * p.pertiga * PASO, y: 0, z: adelante.z * p.pertiga * PASO },
        { x: t.x + derecha.x * s, y: com.y, z: t.z + derecha.z * s },
        true,
      );
    });
  });

  // Los golpes: un cambio brusco de su velocidad (de costado o de frente) bota una flor por la borda
  const velocidadAntes = new THREE.Vector3().copy(cuerpo.linvel());
  let ultimoGolpe = -a.entreGolpes;
  let pasos = 0;
  h.despues(() => {
    pasos++;
    const v = cuerpo.linvel();
    const cambio = Math.hypot(v.x - velocidadAntes.x, v.z - velocidadAntes.z);
    velocidadAntes.set(v.x, v.y, v.z);
    if (cambio > p.golpe && pasos - ultimoGolpe >= a.entreGolpes) {
      ultimoGolpe = pasos;
      // La primera que queda a bordo, desde la proa: sale por el lado de afuera de su fila
      let cual = -1;
      let masAdelante = -Infinity;
      estados.forEach((e, i) => {
        const l = lugares[i];
        if (e.cual === "a bordo" && l && l.x > masAdelante) {
          masAdelante = l.x;
          cual = i;
        }
      });
      const l = lugares[cual];
      if (l) {
        const desde = enElPiso(l);
        const afuera = l.clone().setZ(Math.sign(l.z || 1) * (medioAncho + 0.9));
        const hacia = enElPiso(afuera);
        hacia.y = centro.y + alto * 0.2;
        estados[cual] = { cual: "volando", desde, hacia, t: 0 };
        const quedan = aBordoAhora();
        for (const aviso of avisos) aviso(quedan);
      }
    }
    // Lo que vuela cae al agua, flota a la deriva y se hunde
    estados.forEach((e, i) => {
      if (e.cual === "volando") {
        e.t += PASO;
        if (e.t >= a.vuelo) {
          const lejos = e.hacia.clone().sub(new THREE.Vector3().copy(cuerpo.translation())).setY(0).normalize();
          estados[i] = { cual: "flotando", donde: e.hacia.clone(), deriva: lejos.multiplyScalar(a.deriva), t: 0 };
        }
      } else if (e.cual === "flotando") {
        e.t += PASO;
        if (e.t > a.flota + 1.5) estados[i] = { cual: "hundida" };
      }
    });
    ubicarFlores();
  });

  // Las pértigas: en el anfitrión, las mueve el que empuja; en el invitado, se mueven si la trajinera avanza. Y las
  // flores: el invitado cuenta las que ve en el piso
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let fase = 0;
  let empujan: [boolean, boolean] = [false, false];
  let floresVistas = p.flores;
  h.guardar(() => {
    const t = new THREE.Vector3().copy(cuerpo.translation());
    const avance =
      t
        .clone()
        .sub(antes)
        .dot(EJE_X.clone().applyQuaternion(giroAhora.copy(cuerpo.rotation()))) / PASO;
    antes.copy(t);
    empujan = simulado ? [pertigas[0] !== null, pertigas[1] !== null] : [avance > 0.15, avance > 0.15];
    if (empujan[0] || empujan[1]) fase += PASO * 1.6;
    floresVistas = flores.filter((c) => {
      const l = enLaTrajinera(c.translation());
      return Math.abs(l.x) < mitad && Math.abs(l.z) < medioAncho && Math.abs(l.y - alto) < 0.2;
    }).length;
  });
  h.dibujar(() => imagen.posar(empujan, fase));

  const casa = { centro: centro.clone().addScaledVector(ARRIBA, alto), giro: giro.clone() };
  const llevar = (donde: THREE.Vector3Like) => {
    cuerpo.setTranslation({ x: donde.x, y: donde.y, z: donde.z }, true);
    cuerpo.setRotation(giro, true);
    cuerpo.setLinvel(CERO, true);
    cuerpo.setAngvel(CERO, true);
    velocidadAntes.set(0, 0, 0);
    ubicarFlores();
  };
  return {
    cual: "trajinera",
    nombre: p.nombre,
    cuerpo,
    get pertigas() {
      return pertigas;
    },
    get aBordo() {
      return aBordo;
    },
    get rumbo() {
      return rumboAhora();
    },
    get flores() {
      return simulado ? aBordoAhora() : floresVistas;
    },
    totalFlores: p.flores,
    cuerposDeFlores: flores,
    alBotarFlor(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    casa,
    encima,
    llevar,
    volver() {
      for (let i = 0; i < estados.length; i++) estados[i] = { cual: "a bordo" };
      llevar(centro);
    },
  };
}

/** Una maceta de barro con su ramo: la flor que va en la trajinera. En su marco, el pie en y = 0. */
function crearMaceta(oscuro: THREE.Material): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "flor";
  grupo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.2, 10).translate(0, 0.1, 0), oscuro));
  // Las flores (cempasúchil, sin color: grises claros) en un ramo redondo, con hojas oscuras
  const petalos = materialTela(COLORES.agua, { repetir: 1, pelusa: false });
  const cabezas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 0.09 + 0.03 * (i % 2);
    cabezas.push(
      new THREE.IcosahedronGeometry(0.065, 0).translate(
        Math.cos(a) * r,
        0.36 + 0.05 * Math.sin(i * 1.7),
        Math.sin(a) * r,
      ),
    );
  }
  grupo.add(new THREE.Mesh(juntar(cabezas), petalos));
  const hojas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26;
    hojas.push(
      new THREE.ConeGeometry(0.035, 0.22, 4)
        .rotateZ(0.6)
        .rotateY(a)
        .translate(Math.cos(a) * 0.07, 0.27, -Math.sin(a) * 0.07),
    );
  }
  grupo.add(new THREE.Mesh(juntar(hojas), oscuro));
  return grupo;
}

/** La trajinera: una lancha plana de tablas, con bordas, bancas y una mesa larga en el medio, un techo de tablas
 * sobre cuatro postes y el arco de la proa (donde va su nombre, en tablitas claras), y dos pértigas en la popa. En el
 * marco del cuerpo: +x hacia la proa, el piso arriba de la caja (y = `alto`). También de adorno (las amarradas). */
export function crearImagenTrajinera(
  madera: THREE.Material,
  oscuro: THREE.Material,
  mitad: number,
  alto: number,
  medioAncho: number,
  arco: number,
) {
  const a = AJUSTES_CANALES.trajinera;
  const grupo = new THREE.Group();
  const piso = alto;
  // El casco: una caja que se angosta y sube un poco hacia la proa
  const casco = new THREE.BoxGeometry(2 * mitad, 2 * alto + a.borda, 2 * medioAncho, 12, 1, 1);
  const v = new THREE.Vector3();
  const posiciones = casco.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    const s = v.x / mitad;
    const proa = Math.max(0, s - 0.6) / 0.4;
    const abajo = v.y < 0;
    posiciones.setXYZ(i, v.x, v.y + (abajo ? 0.12 * proa : 0.06 * proa), v.z * (1 - 0.18 * proa * proa));
  }
  casco.computeVertexNormals();
  casco.translate(0, a.borda / 2, 0);
  grupo.add(new THREE.Mesh(casco, madera));
  // Las bordas, las bancas de los costados y la mesa larga del medio
  const partes: THREE.BufferGeometry[] = [
    ...[-1, 1].map((l) =>
      new THREE.BoxGeometry(2 * mitad * 0.96, 0.06, 0.08).translate(0, piso + a.borda + 0.03, l * (medioAncho - 0.04)),
    ),
    ...[-1, 1].map((l) =>
      new THREE.BoxGeometry(2 * mitad * 0.42, 0.06, 0.3).translate(mitad * 0.1, piso + 0.4, l * (medioAncho - 0.2)),
    ),
    new THREE.BoxGeometry(2 * mitad * 0.36, 0.05, 0.38).translate(mitad * 0.12, piso + 0.62, 0),
    new THREE.BoxGeometry(0.06, 0.6, 0.06).translate(mitad * 0.12, piso + 0.31, 0),
  ];
  grupo.add(new THREE.Mesh(juntar(partes), oscuro));
  // El techo: tablas sobre cuatro postes, más bajo que el arco
  if (arco > 0) {
    const techo = Math.min(1.85, arco - 0.2);
    const desde = -mitad * 0.25;
    const hasta = mitad * 0.62;
    const postes = [desde, hasta].flatMap((x) =>
      [-1, 1].map((l) =>
        new THREE.CylinderGeometry(0.03, 0.03, techo, 6).translate(x, piso + techo / 2, l * (medioAncho - 0.08)),
      ),
    );
    grupo.add(
      new THREE.Mesh(
        juntar([
          ...postes,
          new THREE.BoxGeometry(hasta - desde + 0.3, 0.06, 2 * medioAncho + 0.1).translate(
            (desde + hasta) / 2,
            piso + techo,
            0,
          ),
        ]),
        madera,
      ),
    );
    // El arco de la proa: dos postes y un tablero de arriba en medio punto, con su nombre en tablitas claras
    const xArco = mitad * 0.78;
    const tablero = new THREE.Shape();
    const w = medioAncho + 0.05;
    tablero.moveTo(-w, 0);
    tablero.lineTo(w, 0);
    tablero.lineTo(w, 0.28);
    tablero.absarc(0, 0.28, w, 0, Math.PI, false);
    tablero.lineTo(-w, 0);
    const hueco = new THREE.Path();
    hueco.moveTo(-w + 0.12, 0.1);
    hueco.lineTo(w - 0.12, 0.1);
    hueco.lineTo(w - 0.12, 0.28);
    hueco.absarc(0, 0.28, w - 0.12, 0, Math.PI, false);
    hueco.lineTo(-w + 0.12, 0.1);
    tablero.holes.push(hueco);
    const alzado = arco - 0.28 - w;
    const geometriaTablero = new THREE.ExtrudeGeometry(tablero, { depth: 0.05, bevelEnabled: false, curveSegments: 16 })
      .rotateY(Math.PI / 2)
      .translate(xArco - 0.025, piso + alzado, 0);
    grupo.add(
      new THREE.Mesh(
        juntar([
          geometriaTablero,
          ...[-1, 1].map((l) =>
            new THREE.BoxGeometry(0.07, alzado + 0.28, 0.07).translate(xArco, piso + (alzado + 0.28) / 2, l * w),
          ),
          new THREE.BoxGeometry(0.12, 0.24, 2 * w).translate(xArco, piso + arco - 0.12, 0),
        ]),
        oscuro,
      ),
    );
    // El nombre: tablitas claras de distinto ancho, como letras vistas de lejos, sobre la viga
    const letras: THREE.BufferGeometry[] = [];
    for (let i = 0, z = -w * 0.7; i < 7; i++) {
      const ancho = 0.07 + 0.05 * ((i * 7) % 3);
      letras.push(new THREE.BoxGeometry(0.02, 0.12, ancho).translate(xArco + 0.065, piso + arco - 0.12, z + ancho / 2));
      z += ancho + 0.05;
    }
    grupo.add(new THREE.Mesh(juntar(letras), materialTela(COLORES.agua, { repetir: 1, pelusa: false })));
  }
  // Las pértigas: dos palos largos, uno de cada lado de la popa, del agua hasta arriba
  const pertigas = [-1, 1].map((l) => {
    const pertiga = new THREE.Group();
    pertiga.position.set(-mitad * 0.72, piso + 1.25, l * (medioAncho + 0.05));
    const largo = 3.6;
    pertiga.add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, largo, 6).translate(0, -largo * 0.45, 0), madera),
    );
    grupo.add(pertiga);
    return { pertiga, lado: l };
  });
  return {
    grupo,
    /** Si empuja cada pértiga (izquierda, derecha) y cuánto lleva empujando (van y vienen). */
    posar(empujan: readonly [boolean, boolean], fase: number) {
      for (const { pertiga, lado } of pertigas) {
        const empuja = empujan[lado < 0 ? 0 : 1];
        const golpe = empuja ? Math.sin(fase * Math.PI * 2 + (lado > 0 ? 0.6 : 0)) : -1;
        // Inclinadas hacia atrás y afuera; al empujar se van más atrás
        pertiga.rotation.set(lado * 0.22, 0, -0.3 - 0.25 * (golpe + 1));
      }
    },
  };
}

// ── La chinampa flotante ────────────────────────────────────────────────────────────────────────────────────

export interface Chinampa {
  readonly cual: "chinampa";
  readonly nombre: string;
  /** El islote (cinemático): lo mueve esta pieza. */
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuánto está hundida (m: 0 en su lugar). */
  readonly hundida: number;
  /** Cuántos muñecos están parados encima. */
  readonly encima: number;
  /** La altura de su tierra ahora (m). */
  readonly tierra: number;
  /** La deja a flote y quieta. */
  volver(): void;
}

export function armarChinampa(h: Herramientas, p: Extract<PiezaDeLosCanalesEnPlano, { cual: "chinampa" }>): Chinampa {
  const { rapier, mundo } = h;
  const a = AJUSTES_CANALES.chinampa;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(centro.x, centro.y, centro.z).setRotation(giro),
  );
  // Lo cinemático lleva siempre al que lo pisa; se marca igual, por si un día flota de verdad
  llevaAlQuePisa(cuerpo);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setFriction(1),
    cuerpo,
  );
  const imagen = crearImagenChinampa(h.oscuro, medio, centro.x * 7.3 + centro.z * 3.1);
  imagen.name = p.nombre;
  h.mover(cuerpo, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo, colisionador });

  const local = new THREE.Vector3();
  const inversa = giro.clone().invert();
  let hundida = 0;
  let encima = 0;
  let parados = 0;
  let pasos = 0;
  /** Cuánto mecerse en ese paso (siempre igual: por el número de paso). */
  const mecerse = (n: number) => a.mecer.alto * Math.sin((2 * Math.PI * n * PASO) / a.mecer.periodo + centro.x);
  h.antes((munecos) => {
    pasos++;
    const t = cuerpo.translation();
    encima = 0;
    for (const m of munecos) {
      const pelvis = m.partes.pelvis.translation();
      local.set(pelvis.x - t.x, pelvis.y - t.y, pelvis.z - t.z).applyQuaternion(inversa);
      const y = local.y - medio.y;
      const sobre =
        Math.abs(local.x) <= medio.x + a.borde &&
        Math.abs(local.z) <= medio.z + a.borde &&
        y > a.encima[0] &&
        y < a.encima[1];
      if (sobre && m.enElSuelo) encima++;
    }
    // Aguanta un momento y después se hunde, más rápido con más peso; vacía, vuelve a subir
    parados = encima > 0 ? parados + 1 : 0;
    if (encima > 0 && parados * PASO > p.aguante) hundida += p.hundir * encima * PASO;
    else if (encima === 0) hundida -= p.subir * PASO;
    hundida = limitar(hundida, 0, p.fondo);
    cuerpo.setNextKinematicTranslation({ x: centro.x, y: centro.y - hundida + mecerse(pasos), z: centro.z });
  });

  return {
    cual: "chinampa",
    nombre: p.nombre,
    cuerpo,
    get hundida() {
      return hundida;
    },
    get encima() {
      return encima;
    },
    get tierra() {
      return cuerpo.translation().y + medio.y;
    },
    volver() {
      hundida = 0;
      parados = 0;
      cuerpo.setTranslation({ x: centro.x, y: centro.y, z: centro.z }, true);
    },
  };
}

/** Una chinampa flotante: un islote de tierra con raíces que cuelgan, juncos en el borde y una mata. En el marco de
 * la caja (`medio`, su media medida). */
function crearImagenChinampa(oscuro: THREE.Material, medio: THREE.Vector3, semilla: number): THREE.Group {
  const grupo = new THREE.Group();
  const tierra = new THREE.BoxGeometry(medio.x * 2, medio.y * 2, medio.z * 2, 6, 2, 6);
  const v = new THREE.Vector3();
  const posiciones = tierra.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    // Los bordes de abajo redondeados, como un terrón
    const abajo = v.y < 0 ? 0.75 + 0.1 * Math.sin(v.x * 9 + semilla) : 1;
    posiciones.setXYZ(i, v.x * abajo, v.y, v.z * abajo);
  }
  tierra.computeVertexNormals();
  grupo.add(new THREE.Mesh(tierra, materialTela(COLORES.suelo, { repetir: 2 })));
  const plantas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 0.45 + semilla;
    const x = Math.cos(a) * medio.x * 0.92;
    const z = Math.sin(a) * medio.z * 0.92;
    const altoJunco = 0.35 + 0.25 * Math.abs(Math.sin(a * 3.1));
    plantas.push(
      new THREE.ConeGeometry(0.02, altoJunco, 3)
        .rotateZ(0.15 * Math.sin(a * 5))
        .translate(x, medio.y + altoJunco / 2, z),
    );
  }
  // Una mata baja en un rincón y raíces que cuelgan bajo el agua
  plantas.push(
    new THREE.IcosahedronGeometry(0.22, 0).scale(1.2, 0.7, 1).translate(medio.x * 0.45, medio.y + 0.12, -medio.z * 0.4),
  );
  for (let i = 0; i < 6; i++) {
    const x = (i / 5 - 0.5) * medio.x * 1.4;
    plantas.push(
      new THREE.CylinderGeometry(0.015, 0.008, 0.5, 3).translate(x, -medio.y - 0.2, ((i % 3) - 1) * medio.z * 0.5),
    );
  }
  grupo.add(new THREE.Mesh(juntar(plantas), oscuro));
  return grupo;
}

// ── La piñata ───────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoPinata = "colgada" | "rota";

export interface Pinata {
  readonly cual: "pinata";
  readonly nombre: string;
  /** La piñata (cinemática, sin choques): baja con la soga y se mece con los golpes. */
  readonly cuerpo: RAPIER.RigidBody;
  /** La manija de la soga, que se jala hacia atrás. */
  readonly manija: RAPIER.RigidBody;
  /** Colgada o rota (también en el invitado, que la ve desaparecer). */
  readonly estado: EstadoPinata;
  /** Cuánto se jaló la soga (de 0 a 1) y cuánto bajó la piñata (de 0, arriba, a 1). */
  readonly jalada: number;
  readonly bajada: number;
  /** Cuántos golpes lleva y cuántos aguanta. */
  readonly golpes: number;
  readonly aguanta: number;
  /** Llama a `aviso` con cada golpe (con quién pegó); `alRomper`, cuando se rompe. Devuelven cómo dejar de escuchar. */
  alGolpear(aviso: (jugador: 0 | 1) => void): () => void;
  alRomper(aviso: () => void): () => void;
  /** La rompe sin golpes (al retomar más adelante). */
  romper(): void;
}

export function armarPinata(h: Herramientas, p: Extract<PiezaDeLosCanalesEnPlano, { cual: "pinata" }>): Pinata {
  const { rapier, mundo } = h;
  const a = AJUSTES_CANALES.pinata;
  const { medio } = p.caja;
  const { giro, mitad } = marcoLargo(p.caja.giro, medio);
  const piso = p.caja.centro.y - medio.y;
  const altoSoga = medio.y * 2;
  /** Un punto en el marco de la piñata (x a lo largo de la soga, y desde el suelo, z hacia su frente). */
  const enElMundo = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(giro).add(new THREE.Vector3(p.caja.centro.x, piso, p.caja.centro.z));
  const frente = EJE_Z.clone().applyQuaternion(giro);
  const reposo = enElMundo(0, altoSoga - a.colgar - a.radio, 0);

  // Los dos postes y la soga de arriba (fijos)
  const postes = [-1, 1].map((l) => enElMundo(l * mitad, altoSoga / 2, 0));
  for (const poste of postes) {
    const c = h.fijo(poste, giro);
    mundo.createCollider(rapier.ColliderDesc.cylinder(altoSoga / 2, 0.08).setFriction(0.8), c);
  }
  const imagenPostes = new THREE.Mesh(
    juntar([
      ...postes.map((poste) =>
        new THREE.CylinderGeometry(0.07, 0.09, altoSoga, 8).translate(poste.x, poste.y, poste.z),
      ),
      palo(enElMundo(-mitad, altoSoga - 0.05, 0), enElMundo(mitad, altoSoga - 0.05, 0), 0.015),
    ]),
    h.madera,
  );
  h.escena.add(imagenPostes);

  // La piñata: cinemática y sin choques (la mano no se traba en ella: el golpe se cuenta por cercanía)
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(reposo.x, reposo.y, reposo.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(a.radio).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenPinata(h.oscuro, a.radio);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  // La manija de la soga: junto al poste de la punta −, y se jala hacia atrás con un resorte que la devuelve
  const inicio = enElMundo(-mitad + a.manija.adentro, a.manija.alto, 0);
  const haciaAtras = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI));
  const ancla = h.fijo(inicio, haciaAtras);
  const manija = mundo.createRigidBody(h.dinamico(inicio, haciaAtras).setLinearDamping(1).setAngularDamping(2));
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.manija.medio, 0.03, 0.03)
      .setMass(a.manija.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_CANALES)
      .setSolverGroups(SIN_EMPUJAR),
    manija,
  );
  const datos = rapier.JointData.prismatic(CERO, CERO, EJE_Z);
  datos.limitsEnabled = true;
  datos.limits = [0, p.soga];
  const junta = mundo.createImpulseJoint(datos, ancla, manija, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.PrismaticImpulseJoint) {
    const rigidez = p.fuerza / p.soga;
    junta.configureMotorModel(rapier.MotorModel.ForceBased);
    junta.configureMotorPosition(0, rigidez, 2 * 0.9 * Math.sqrt(rigidez * a.manija.masa));
  }
  const imagenManija = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(0.035, 0.035, a.manija.medio * 2, 8).rotateZ(Math.PI / 2),
      new THREE.SphereGeometry(0.05, 8, 6),
    ]),
    h.madera,
  );
  h.mover(manija, imagenManija);
  // La soga: de la piñata a la soga de arriba, por ella hasta el poste y abajo hasta la manija (se rehace cada cuadro)
  const materialSoga = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const tramos = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 5).translate(0, 0.5, 0), materialSoga);
    h.escena.add(m);
    return m;
  });
  const tender = (m: THREE.Mesh, desde: THREE.Vector3, hasta: THREE.Vector3) => {
    const tramo = hasta.clone().sub(desde);
    m.position.copy(desde);
    m.quaternion.setFromUnitVectors(ARRIBA, tramo.clone().normalize());
    m.scale.set(1, Math.max(0.001, tramo.length()), 1);
  };
  const medioDeArriba = enElMundo(0, altoSoga - 0.05, 0);
  const posteDeArriba = enElMundo(-mitad, altoSoga - 0.1, 0);

  let estado: EstadoPinata = "colgada";
  let jalada = 0;
  let bajada = 0;
  let golpes = 0;
  /** El mecerse de los golpes: un péndulo de costado (radianes y radianes por segundo), hacia el frente y de lado. */
  const mecer = { x: 0, z: 0, vx: 0, vz: 0 };
  const ultimoGolpe = [-1000, -1000];
  let pasos = 0;
  const avisosGolpe = new Set<(jugador: 0 | 1) => void>();
  const avisosRomper = new Set<() => void>();
  /** Dónde va la piñata colgando (sin mecerse) con la soga bajada así. */
  const colgando = (b: number) => reposo.clone().addScaledVector(ARRIBA, -p.baja * b);
  /** Dónde va con el péndulo: la soga mide lo que cuelga desde arriba. */
  const dondeVa = () => {
    const c = colgando(bajada);
    const largo = medioDeArriba.y - c.y;
    const derecha = EJE_X.clone().applyQuaternion(giro);
    return c
      .addScaledVector(frente, Math.sin(mecer.z) * largo)
      .addScaledVector(derecha, Math.sin(mecer.x) * largo)
      .addScaledVector(ARRIBA, largo * (2 - Math.cos(mecer.x) - Math.cos(mecer.z)));
  };
  const velocidad = new THREE.Vector3();
  const antesDonde = new THREE.Vector3().copy(reposo);
  const romper = () => {
    if (estado === "rota") return;
    estado = "rota";
    for (const aviso of avisosRomper) aviso();
  };

  h.antes(() => {
    pasos++;
    const t = manija.translation();
    const atras = (inicio.x - t.x) * frente.x + (inicio.y - t.y) * frente.y + (inicio.z - t.z) * frente.z;
    jalada = limitar(atras / p.soga, 0, 1);
    bajada += (jalada - bajada) * Math.min(1, a.seguir * PASO);
    // El péndulo: se aquieta solo
    const w = Math.sqrt(9.81 / Math.max(0.3, medioDeArriba.y - colgando(bajada).y));
    for (const eje of ["x", "z"] as const) {
      const v = eje === "x" ? "vx" : "vz";
      mecer[v] += (-w * w * Math.sin(mecer[eje]) - 2 * a.aquietar * mecer[v]) * PASO;
      mecer[eje] += mecer[v] * PASO;
    }
    if (estado === "rota") {
      cuerpo.setNextKinematicTranslation({ x: reposo.x, y: ESCONDIDO, z: reposo.z });
      return;
    }
    const d = dondeVa();
    velocidad.copy(d).sub(antesDonde).divideScalar(PASO);
    antesDonde.copy(d);
    cuerpo.setNextKinematicTranslation(d);
  });

  // Los golpes: la mano (el brazo) o la cabeza que llega rápido a la piñata
  const partes: readonly NombreParte[] = ["brazoIzquierdo", "brazoDerecho", "cabeza"];
  h.despues((munecos) => {
    if (estado === "rota") return;
    const c = cuerpo.translation();
    munecos.forEach((m: Muneco, i) => {
      if (i > 1 || pasos - (ultimoGolpe[i] ?? 0) < a.entreGolpes) return;
      for (const nombre of partes) {
        const parte = m.partes[nombre];
        const q = parte.translation();
        const alcance = a.radio + (nombre === "cabeza" ? a.alcance.cabeza : a.alcance.brazo);
        const d = new THREE.Vector3(q.x - c.x, q.y - c.y, q.z - c.z);
        if (d.length() > alcance) continue;
        const v = parte.linvel();
        const relativa = new THREE.Vector3(v.x - velocidad.x, v.y - velocidad.y, v.z - velocidad.z);
        // Que llegue hacia ella, y rápido
        if (relativa.dot(d) >= 0 || relativa.length() < p.pegar) continue;
        ultimoGolpe[i] = pasos;
        golpes++;
        // Se mece hacia donde la empujaron
        const empujon = relativa.clone().setY(0);
        const derecha = EJE_X.clone().applyQuaternion(giro);
        mecer.vx += empujon.dot(derecha) * a.mecer;
        mecer.vz += empujon.dot(frente) * a.mecer;
        for (const aviso of avisosGolpe) aviso(i as 0 | 1);
        if (golpes >= p.golpes) romper();
        break;
      }
    });
  });

  // En el invitado, la piñata rota es la que desaparece; y la soga se dibuja con lo que se ve
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let vista: EstadoPinata = "colgada";
  const dondeSeRompio = new THREE.Vector3().copy(reposo);
  let rotaHace = -1;
  h.guardar(() => {
    const t = cuerpo.translation();
    const ahora: EstadoPinata = t.y < ESCONDIDO / 2 ? "rota" : "colgada";
    if (ahora === "colgada") dondeSeRompio.copy(t);
    if (ahora === "rota" && vista === "colgada") rotaHace = 0;
    else if (rotaHace >= 0) rotaHace += PASO;
    vista = ahora;
  });
  h.dibujar(() => {
    const pieza = imagen.grupo.position;
    const rota = vista === "rota";
    imagen.dulces(rota ? rotaHace : -1, dondeSeRompio);
    const mano = imagenManija.position.clone();
    tender(
      tramos[0] as THREE.Mesh,
      rota ? medioDeArriba.clone().addScaledVector(ARRIBA, -0.6) : pieza.clone(),
      medioDeArriba,
    );
    tender(tramos[1] as THREE.Mesh, medioDeArriba, posteDeArriba);
    tender(tramos[2] as THREE.Mesh, posteDeArriba, mano);
  });

  return {
    cual: "pinata",
    nombre: p.nombre,
    cuerpo,
    manija,
    get estado() {
      return simulado ? estado : vista;
    },
    get jalada() {
      return jalada;
    },
    get bajada() {
      return bajada;
    },
    get golpes() {
      return golpes;
    },
    aguanta: p.golpes,
    alGolpear(aviso) {
      avisosGolpe.add(aviso);
      return () => {
        avisosGolpe.delete(aviso);
      };
    },
    alRomper(aviso) {
      avisosRomper.add(aviso);
      return () => {
        avisosRomper.delete(aviso);
      };
    },
    romper() {
      golpes = Math.max(golpes, p.golpes);
      romper();
      cuerpo.setTranslation({ x: reposo.x, y: ESCONDIDO, z: reposo.z }, true);
    },
  };
}

/** La piñata de siete picos: una bola de papel con siete conos alrededor, flecos que cuelgan de cada punta, y los
 * dulces que saltan al romperla. En el marco de la piñata: el centro en 0. */
function crearImagenPinata(oscuro: THREE.Material, radio: number) {
  const grupo = new THREE.Group();
  const papel = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const picos: THREE.BufferGeometry[] = [new THREE.IcosahedronGeometry(radio, 1)];
  const flecos: THREE.BufferGeometry[] = [];
  // Seis picos alrededor (un poco inclinados hacia abajo) y uno abajo
  const direcciones = [
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a), -0.15, Math.sin(a)).normalize();
    }),
    new THREE.Vector3(0, -1, 0),
  ];
  for (const d of direcciones) {
    const largo = radio * 1.3;
    const cono = new THREE.ConeGeometry(radio * 0.32, largo, 8).translate(0, largo / 2, 0);
    cono.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, d));
    cono.translate(d.x * radio * 0.85, d.y * radio * 0.85, d.z * radio * 0.85);
    picos.push(cono);
    const punta = d.clone().multiplyScalar(radio * 0.85 + largo);
    for (let k = 0; k < 3; k++) {
      const fleco = 0.18 + 0.06 * k;
      flecos.push(
        new THREE.BoxGeometry(0.012, fleco, 0.03).translate(
          punta.x + (k - 1) * 0.02,
          punta.y - fleco / 2,
          punta.z + ((k * 5) % 3) * 0.01,
        ),
      );
    }
  }
  const forma = new THREE.Group();
  forma.add(new THREE.Mesh(juntar(picos), papel));
  forma.add(new THREE.Mesh(juntar(flecos), oscuro));
  grupo.add(forma);
  // Los dulces: pedacitos que saltan desde donde se rompió y caen al suelo (siempre igual)
  const dulces = new THREE.Group();
  const claro = materialOjo();
  const caidas: { readonly mesh: THREE.Mesh; readonly v: THREE.Vector3 }[] = [];
  for (let i = 0; i < 24; i++) {
    const a = i * 2.39996;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), i % 3 === 0 ? claro : papel);
    caidas.push({
      mesh,
      v: new THREE.Vector3(Math.cos(a) * (1 + (i % 4) * 0.4), 1.5 + (i % 5) * 0.4, Math.sin(a) * (1 + (i % 3) * 0.5)),
    });
    dulces.add(mesh);
  }
  dulces.visible = false;
  return {
    grupo,
    /** Rota hace `segundos` (−1: entera): los dulces saltan desde `donde` y caen al suelo, 1.5 m más abajo. */
    dulces(segundos: number, donde: THREE.Vector3) {
      forma.visible = segundos < 0;
      if (segundos < 0) {
        if (dulces.parent) dulces.parent.remove(dulces);
        dulces.visible = false;
        return;
      }
      if (!dulces.parent) grupo.parent?.add(dulces);
      dulces.visible = true;
      dulces.position.copy(donde);
      for (const [i, { mesh, v }] of caidas.entries()) {
        const t = segundos;
        const y = Math.max(-1.5 + 0.015, v.y * t - 4.9 * t * t);
        const sigue = y > -1.5 + 0.015 ? t : Math.min(t, (v.y + Math.sqrt(v.y * v.y + 4 * 4.9 * 1.5)) / 9.8);
        mesh.position.set(v.x * sigue * 0.5, y, v.z * sigue * 0.5);
        mesh.rotation.set(i + t * 6, i * 2 + t * 4, 0);
      }
    },
  };
}

// ── Adornos de los canales (los pone el guion) ──────────────────────────────────────────────────────────────

/** Un ahuejote, el sauce flaco y alto que bordea las chinampas: un tronco derecho y una copa angosta como una
 * llama. En su marco: el pie en y = 0. */
export function crearAhuejote(madera: THREE.Material, hojas: THREE.Material, alto: number, semilla: number) {
  const grupo = new THREE.Group();
  const tronco = alto * 0.35;
  grupo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, tronco, 7).translate(0, tronco / 2, 0), madera));
  const copa = new THREE.ConeGeometry(0.55 + 0.1 * Math.sin(semilla), alto - tronco * 0.6, 8, 6, false);
  const v = new THREE.Vector3();
  const posiciones = copa.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    // Panzona abajo y despeinada
    const panza = 1 + 0.35 * Math.sin((v.y / (alto - tronco * 0.6) + 0.5) * Math.PI);
    const ruido = 1 + 0.12 * Math.sin(v.y * 7 + Math.atan2(v.z, v.x) * 3 + semilla);
    posiciones.setXYZ(i, v.x * panza * ruido, v.y, v.z * panza * ruido);
  }
  copa.computeVertexNormals();
  copa.translate(0, tronco * 0.4 + (alto - tronco * 0.6) / 2, 0);
  grupo.add(new THREE.Mesh(copa, hojas));
  return grupo;
}

/** El alebrije: una criatura de papel, mitad perro, mitad dragón, con alas y cola enroscada, dormido hecho bolita.
 * Sin color: es lo único claro y con dibujitos de la chinampa. En su marco: echado sobre y = 0, la cabeza hacia +x. */
export function crearAlebrije(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "alebrije";
  const papel = new THREE.MeshStandardMaterial({
    name: "alebrije",
    color: COLORES.ojo,
    roughness: 0.6,
    emissive: COLORES.siluetaLejana,
    emissiveIntensity: 0.4,
  });
  const dibujos = new THREE.MeshStandardMaterial({
    name: "alebrije-dibujos",
    color: COLORES.siluetaHonda,
    roughness: 1,
  });
  const cuerpo = juntar([
    new THREE.SphereGeometry(0.32, 14, 10).scale(1.4, 0.7, 1).translate(0, 0.22, 0),
    new THREE.SphereGeometry(0.17, 12, 8).scale(1.2, 0.9, 1).translate(0.46, 0.18, 0.12),
    new THREE.ConeGeometry(0.08, 0.2, 6).rotateZ(-Math.PI / 2).translate(0.66, 0.14, 0.14),
    // Las orejas y los cuernos
    ...[-1, 1].map((l) => new THREE.ConeGeometry(0.045, 0.22, 5).rotateZ(-0.5).translate(0.44, 0.36, 0.12 + l * 0.08)),
    // Las alas plegadas
    ...[-1, 1].map((l) =>
      new THREE.ConeGeometry(0.22, 0.5, 3)
        .rotateZ(Math.PI / 2 + 0.3)
        .scale(1, 1, 0.25)
        .translate(-0.08, 0.42, l * 0.16),
    ),
    // La cola enroscada alrededor
    ...Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI * 0.6 + i * 0.36;
      const r = 0.48 - i * 0.015;
      return new THREE.SphereGeometry(0.075 - i * 0.005, 8, 6).translate(Math.cos(a) * r, 0.06, Math.sin(a) * r * 0.8);
    }),
  ]);
  grupo.add(new THREE.Mesh(cuerpo, papel));
  // Los dibujitos: puntos, rayas y espirales oscuros sobre el lomo
  const marcas: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.39996;
    const x = Math.cos(a) * 0.35 * ((i % 4) / 4 + 0.3);
    const z = Math.sin(a) * 0.26 * ((i % 3) / 3 + 0.4);
    const y = 0.22 + 0.21 * Math.sqrt(Math.max(0, 1 - (x / 0.45) ** 2 - (z / 0.32) ** 2));
    marcas.push(new THREE.SphereGeometry(0.025 + 0.01 * (i % 2), 6, 4).scale(1, 0.4, 1).translate(x, y, z));
  }
  // Los ojos cerrados: dos rayitas
  for (const l of [-1, 1])
    marcas.push(new THREE.BoxGeometry(0.06, 0.012, 0.012).translate(0.56, 0.24, 0.12 + l * 0.07));
  grupo.add(new THREE.Mesh(juntar(marcas), dibujos));
  return grupo;
}

/** El papel picado de la feria: hilos que cuelgan entre dos puntos (`[desde, hasta]`), con banderitas de papel
 * cada 45 cm. `hilo`, el material del hilo; las banderitas son de papel gris, de dos caras. */
export function crearPapelPicado(
  hilo: THREE.Material,
  tramos: readonly (readonly [THREE.Vector3Like, THREE.Vector3Like])[],
): THREE.Group {
  const hilos: THREE.BufferGeometry[] = [];
  const banderitas: THREE.BufferGeometry[] = [];
  for (const [a, b] of tramos) {
    const desde = new THREE.Vector3().copy(a);
    const hasta = new THREE.Vector3().copy(b);
    const n = Math.max(1, Math.round(desde.distanceTo(hasta) / 0.45));
    const giro = Math.atan2(hasta.x - desde.x, hasta.z - desde.z);
    /** El punto `k` del hilo, que cuelga en el medio. */
    const punto = (k: number) =>
      desde
        .clone()
        .lerp(hasta, k / n)
        .addScaledVector(ARRIBA, -0.35 * Math.sin((Math.PI * k) / n));
    for (let k = 0; k < n; k++) {
      const p = punto(k);
      const q = punto(k + 1);
      hilos.push(palo(p, q, 0.006, 3));
      banderitas.push(
        new THREE.PlaneGeometry(0.3, 0.36)
          .translate(0, -0.18, 0)
          .rotateY(giro + Math.PI / 2)
          .translate((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2),
      );
    }
  }
  const grupo = new THREE.Group();
  grupo.name = "papel picado";
  grupo.add(new THREE.Mesh(juntar(hilos), hilo));
  const papel = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  papel.side = THREE.DoubleSide;
  grupo.add(new THREE.Mesh(juntar(banderitas), papel));
  return grupo;
}
