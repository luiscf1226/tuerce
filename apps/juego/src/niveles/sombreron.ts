// El Sombrerón (TU-40): un hombrecito de negro, con botas, cinturón de hebilla y guitarra, que le hace trenzas a todo
// (a la crin de las mulas, a las cuerdas, a la gente). Perdió su sombrero gigante, que rodó cuesta abajo. Sale de un
// nodo `tipo: pieza, pieza: sombreron`; su caja es su plaza: anda por adentro, sobre la base de la caja, y no sale.
//
//   · Sin su sombrero, persigue al muñeco de pie más cercano que entre a la plaza. Si lo alcanza le hace trenzas:
//     lo enreda (un empujón que lo tumba; no hay derrota) y después se queda tocando la guitarra un rato.
//   · Si su sombrero llega a la plaza, se olvida de los muñecos: va por él y se lo pone. Con el sombrero puesto ya
//     no molesta a nadie: vuelve a su casa (el centro de la caja) y toca la guitarra.
//   · Sin nadie a quien perseguir vuelve a su casa.
//
// Es un cuerpo cinemático sin choques, como el Cadejo: lo mueve esta pieza a paso fijo, sin azar. Viaja en la foto
// de la red; el invitado no lo simula: lo anima con lo que anduvo, lo ve agachado cuando hace trenzas (el cuerpo baja)
// y ve su sombrero puesto (el sombrero también viaja en la foto).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDeLasTrenzasEnPlano } from "./formato-trenzas";
import type { Herramientas } from "./piezas";
import { manosEn } from "./piezas-pinar";
import { puntosDeTrenza, type Sombrerote } from "./piezas-trenzas";

export type EstadoSombreron = "en casa" | "persiguiendo" | "trenzando" | "tocando" | "al sombrero" | "con sombrero";

export interface Sombreron {
  readonly cual: "sombreron";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoSombreron;
  /** Si ya tiene puesto su sombrero. */
  readonly conSombrero: boolean;
  /** Cuántas veces enredó a alguien. */
  readonly enredos: number;
  /** A quién persigue (0 el rojo, 1 el turquesa), o `null`. */
  readonly persigue: 0 | 1 | null;
  /** Llama a `aviso` cada vez que enreda a alguien. Devuelve cómo dejar de escuchar. */
  alEnredar(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando se pone el sombrero. Devuelve cómo dejar de escuchar. */
  alPonerse(aviso: () => void): () => void;
  /** Se pone el sombrero de una vez, en su casa (al retomar). */
  ponerse(): void;
  /** Lo lleva a su casa (al retomar en otro punto). */
  volver(): void;
}

/** Los números del Sombrerón que no se ponen desde Blender. */
export const AJUSTES_SOMBRERON = {
  /** Qué tan rápido gira (rad/s) y acelera (m/s²). */
  giro: 5,
  aceleracion: 5,
  /** Lo que se le queda adentro del borde de su plaza (m). */
  margen: 0.4,
  /** Cuánto para arriba sale el enredado (m/s). */
  arriba: 1.2,
  /** Cuánto tarda en hacer las trenzas (s) y cuánto se agacha mientras (m: así lo ve el invitado). */
  trenzar: 1,
  agacharse: 0.12,
  /** A esta distancia del borde del ala de su sombrero ya lo alcanza (m). */
  alcanzarSombrero: 0.35,
  /** Dónde va el sombrero en la cabeza (m sobre el suelo) y a esta distancia de su casa ya llegó (m). */
  cabeza: 1.2,
  enCasa: 0.3,
  /** La zancada (m por paso doble). */
  zancada: 0.55,
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
/** El ángulo `a` llevado a (−π, π]. */
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function armarSombreron(
  h: Herramientas,
  p: Extract<PiezaDeLasTrenzasEnPlano, { cual: "sombreron" }>,
): Sombreron {
  const { rapier, mundo } = h;
  const a = AJUSTES_SOMBRERON;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const base = h.enElMundo(p, 0, -medio.y, 0).y;
  const casa = { x: centro.x, z: centro.z };
  const frente = new THREE.Vector3(0, 0, 1).applyQuaternion(giro);
  const rumboCasa = Math.atan2(frente.x, frente.z);

  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(casa.x, base, casa.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumboCasa)),
  );
  // Un colisionador sin grupos: no choca ni lo ven los rayos ni las manos; está para `nivel.pieza(nombre)`
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.ball(0.3).setTranslation(0, 0.6, 0).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenSombreron();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const local = new THREE.Vector3();
  const adentro = (q: THREE.Vector3Like, alto = 2.5) => {
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);
    const y = q.y - base;
    return Math.abs(local.x) <= medio.x && Math.abs(local.z) <= medio.z && y > -0.6 && y < alto;
  };
  const encerrar = (x: number, z: number) => {
    local.set(x - centro.x, 0, z - centro.z).applyQuaternion(giroInverso);
    local.x = limitar(local.x, -medio.x + a.margen, medio.x - a.margen);
    local.z = limitar(local.z, -medio.z + a.margen, medio.z - a.margen);
    local.y = 0;
    local.applyQuaternion(giro);
    return { x: centro.x + local.x, z: centro.z + local.z };
  };

  let estado: EstadoSombreron = "en casa";
  let pos = { x: casa.x, z: casa.z };
  let rumbo = rumboCasa;
  let rapidez = 0;
  let espera = 0;
  let enredos = 0;
  let persigue: 0 | 1 | null = null;
  let sombrero: Sombrerote | null = null;
  const avisosEnredar = new Set<(jugador: 0 | 1) => void>();
  const avisosPonerse = new Set<() => void>();

  /** Camina hacia (x, z) y devuelve a cuánto quedó. */
  const caminarHacia = (x: number, z: number) => {
    const dx = x - pos.x;
    const dz = z - pos.z;
    const queda = Math.hypot(dx, dz);
    const deseado = Math.atan2(dx, dz);
    const giroMax = a.giro * PASO;
    rumbo = envolver(rumbo + limitar(envolver(deseado - rumbo), -giroMax, giroMax));
    const derecho = Math.max(0, Math.cos(envolver(deseado - rumbo)));
    const objetivo = p.velocidad * derecho * limitar(queda / 0.5, 0.25, 1);
    rapidez += limitar(objetivo - rapidez, -a.aceleracion * PASO * 2, a.aceleracion * PASO);
    pos = encerrar(pos.x + Math.sin(rumbo) * rapidez * PASO, pos.z + Math.cos(rumbo) * rapidez * PASO);
    return queda;
  };
  const quedarse = () => {
    rapidez = Math.max(0, rapidez - a.aceleracion * 2 * PASO);
    pos = encerrar(pos.x + Math.sin(rumbo) * rapidez * PASO, pos.z + Math.cos(rumbo) * rapidez * PASO);
  };
  const mirarA = (r: number) => {
    rumbo = envolver(rumbo + limitar(envolver(r - rumbo), -a.giro * PASO, a.giro * PASO));
  };

  /** Su sombrero, si anda suelto adentro de la plaza. */
  const sombreroSuelto = (munecos: readonly Muneco[]): Sombrerote | null => {
    for (const pieza of h.lista) {
      if (pieza.cual !== "sombrerote" || pieza.puesto) continue;
      // Mientras alguien lo tiene agarrado no se lo pone: el muñeco quedaría colgado de su cabeza
      if (munecos.some((m) => manosEn(m, pieza.cuerpo) > 0)) continue;
      if (adentro(pieza.cuerpo.translation(), 3)) return pieza;
    }
    return null;
  };

  /** El muñeco de pie más cercano adentro de la plaza. */
  const presa = (munecos: readonly Muneco[]) => {
    let mejor: { jugador: 0 | 1; muneco: Muneco } | null = null;
    let distancia = Number.POSITIVE_INFINITY;
    for (const jugador of [0, 1] as const) {
      const m = munecos[jugador];
      if (!m || m.estado === "caido" || m.estado === "levantandose") continue;
      const t = m.partes.pelvis.translation();
      if (!adentro(t)) continue;
      const d = Math.hypot(t.x - pos.x, t.z - pos.z);
      if (d < distancia) {
        distancia = d;
        mejor = { jugador, muneco: m };
      }
    }
    return mejor;
  };

  /** Le hace trenzas: el muñeco queda enredado y se cae. */
  const enredar = (jugador: 0 | 1, m: Muneco) => {
    const t = m.partes.pelvis.translation();
    let dx = t.x - pos.x;
    let dz = t.z - pos.z;
    const largo = Math.hypot(dx, dz) || 1;
    dx /= largo;
    dz /= largo;
    for (const parte of Object.values(m.partes)) {
      const masa = parte.mass();
      parte.applyImpulse({ x: dx * p.empujon * masa, y: a.arriba * masa, z: dz * p.empujon * masa }, true);
    }
    enredos++;
    estado = "trenzando";
    espera = a.trenzar;
    rapidez = 0;
    for (const aviso of avisosEnredar) aviso(jugador);
  };

  /** Se pone el sombrero: queda en su cabeza, con la copa para arriba. */
  const ponerseEl = (s: Sombrerote) => {
    s.ponerse();
    sombrero = s;
    estado = "con sombrero";
    rapidez = 0;
    for (const aviso of avisosPonerse) aviso();
  };
  const llevarSombrero = (ya: boolean, y: number) => {
    if (!sombrero) return;
    const q = new THREE.Quaternion()
      .setFromAxisAngle(ARRIBA, rumbo)
      .multiply(new THREE.Quaternion().setFromUnitVectors(sombrero.eje, ARRIBA));
    const donde = { x: pos.x, y: y + a.cabeza, z: pos.z };
    if (ya) {
      sombrero.cuerpo.setTranslation(donde, true);
      sombrero.cuerpo.setRotation(q, true);
    }
    sombrero.cuerpo.setNextKinematicTranslation(donde);
    sombrero.cuerpo.setNextKinematicRotation(q);
  };

  h.antes((munecos) => {
    persigue = null;
    if (estado === "con sombrero") {
      // Con el sombrero puesto vuelve a su casa y toca
      if (Math.hypot(casa.x - pos.x, casa.z - pos.z) > a.enCasa) caminarHacia(casa.x, casa.z);
      else {
        quedarse();
        mirarA(rumboCasa);
      }
    } else if (estado === "trenzando") {
      espera -= PASO;
      quedarse();
      if (espera <= 0) {
        estado = "tocando";
        espera = p.tocar;
      }
    } else if (estado === "tocando") {
      espera -= PASO;
      quedarse();
      if (espera <= 0) estado = "en casa";
    } else {
      const suyo = sombreroSuelto(munecos);
      const muneco = suyo ? null : presa(munecos);
      if (suyo) {
        const t = suyo.cuerpo.translation();
        estado = "al sombrero";
        if (caminarHacia(t.x, t.z) < suyo.radio + a.alcanzarSombrero) ponerseEl(suyo);
      } else if (muneco) {
        const t = muneco.muneco.partes.pelvis.translation();
        estado = "persiguiendo";
        persigue = muneco.jugador;
        if (caminarHacia(t.x, t.z) < p.alcance) enredar(muneco.jugador, muneco.muneco);
      } else if (Math.hypot(casa.x - pos.x, casa.z - pos.z) > a.enCasa) {
        estado = "en casa";
        caminarHacia(casa.x, casa.z);
      } else {
        estado = "en casa";
        quedarse();
        mirarA(rumboCasa);
      }
    }
    const y = base - (estado === "trenzando" ? a.agacharse : 0);
    cuerpo.setNextKinematicTranslation({ x: pos.x, y, z: pos.z });
    cuerpo.setNextKinematicRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo));
    llevarSombrero(false, base);
  });

  // La imagen: con lo que anduvo, agachado si baja (hace trenzas), y tocando si está quieto (también en el invitado)
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  let andado = 0;
  let velocidad = 0;
  let quieto = 0;
  let agachado = 0;
  let segundos = 0;
  h.guardar(() => {
    const t = cuerpo.translation();
    const d = Math.hypot(t.x - antes.x, t.z - antes.z);
    antes.copy(t);
    andado += d;
    velocidad += (d / PASO - velocidad) * 0.2;
    quieto = velocidad < 0.1 ? quieto + PASO : 0;
    agachado = t.y < base - a.agacharse / 2 ? Math.min(1, agachado + PASO * 6) : Math.max(0, agachado - PASO * 4);
    segundos += PASO;
  });
  h.dibujar(() => imagen.posar(andado / a.zancada, velocidad / p.velocidad, quieto, agachado, segundos));

  return {
    cual: "sombreron",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get conSombrero() {
      return sombrero !== null;
    },
    get enredos() {
      return enredos;
    },
    get persigue() {
      return persigue;
    },
    alEnredar(aviso) {
      avisosEnredar.add(aviso);
      return () => {
        avisosEnredar.delete(aviso);
      };
    },
    alPonerse(aviso) {
      avisosPonerse.add(aviso);
      return () => {
        avisosPonerse.delete(aviso);
      };
    },
    ponerse() {
      pos = { x: casa.x, z: casa.z };
      rumbo = rumboCasa;
      const suyo = h.lista.find((q): q is Sombrerote => q.cual === "sombrerote");
      if (suyo && !sombrero) ponerseEl(suyo);
      const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);
      cuerpo.setTranslation({ x: pos.x, y: base, z: pos.z }, true);
      cuerpo.setRotation(q, true);
      llevarSombrero(true, base);
    },
    volver() {
      if (sombrero) return;
      estado = "en casa";
      pos = { x: casa.x, z: casa.z };
      rumbo = rumboCasa;
      rapidez = 0;
      espera = 0;
      const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo);
      cuerpo.setTranslation({ x: pos.x, y: base, z: pos.z }, true);
      cuerpo.setRotation(q, true);
      cuerpo.setNextKinematicTranslation({ x: pos.x, y: base, z: pos.z });
      cuerpo.setNextKinematicRotation(q);
    },
  };
}

/** El Sombrerón: bajito, de negro, con botas, un cinturón con hebilla que brilla, el pelo revuelto (sin su sombrero)
 * y la guitarra colgada al frente. Mira hacia +z, con los pies en y = 0. */
function crearImagenSombreron() {
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 4 });
  const claro = new THREE.MeshStandardMaterial({
    name: "hebilla",
    color: COLORES.siluetaLejana,
    emissive: COLORES.siluetaLejana,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.4,
  });
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  // Panza, chaqueta corta y la cabeza redonda, con el pelo revuelto y un bigote
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.24, 14, 10).scale(1, 1.15, 0.9).translate(0, 0.62, 0),
        new THREE.CylinderGeometry(0.2, 0.25, 0.3, 12).translate(0, 0.78, 0),
        new THREE.SphereGeometry(0.19, 14, 10).translate(0, 1.02, 0.02),
        ...Array.from({ length: 9 }, (_, i) =>
          new THREE.ConeGeometry(0.04, 0.12, 4)
            .rotateZ(Math.sin(i * 1.9) * 0.9)
            .rotateX(Math.cos(i * 2.7) * 0.7)
            .translate(Math.sin(i * 2.2) * 0.1, 1.18, Math.cos(i * 2.2) * 0.09 - 0.02),
        ),
        new THREE.BoxGeometry(0.16, 0.035, 0.04).translate(0, 0.96, 0.19),
      ]),
      tela,
    ),
  );
  cuerpo.add(
    new THREE.Mesh(
      juntar([-1, 1].map((lado) => new THREE.SphereGeometry(0.026, 8, 6).translate(lado * 0.07, 1.05, 0.18))),
      materialOjo(),
    ),
  );
  // El cinturón y su hebilla
  cuerpo.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03).translate(0, 0.5, 0.24), claro));
  // Las piernas con sus botas: se mueven al andar
  const pierna = juntar([
    new THREE.CylinderGeometry(0.06, 0.05, 0.36, 8).translate(0, -0.18, 0),
    new THREE.BoxGeometry(0.11, 0.09, 0.2).translate(0, -0.37, 0.04),
  ]);
  const piernas = [-1, 1].map((lado) => {
    const g = new THREE.Group();
    g.position.set(lado * 0.09, 0.42, 0);
    g.add(new THREE.Mesh(pierna, tela));
    cuerpo.add(g);
    return g;
  });
  // La guitarra, al frente, y los brazos que la tocan (o que hacen trenzas)
  const guitarra = new THREE.Group();
  guitarra.position.set(0.02, 0.62, 0.24);
  guitarra.rotation.z = 0.9;
  guitarra.add(
    new THREE.Mesh(
      juntar([
        new THREE.SphereGeometry(0.13, 12, 8).scale(1, 1, 0.35).translate(0, -0.05, 0),
        new THREE.SphereGeometry(0.1, 12, 8).scale(1, 1, 0.35).translate(0, 0.1, 0),
        new THREE.BoxGeometry(0.04, 0.38, 0.03).translate(0, 0.36, 0),
      ]),
      tela,
    ),
  );
  guitarra.add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 10).translate(0, 0.02, 0.05), claro));
  cuerpo.add(guitarra);
  const brazo = new THREE.CylinderGeometry(0.045, 0.04, 0.32, 6).translate(0, -0.16, 0);
  const brazos = [-1, 1].map((lado) => {
    const g = new THREE.Group();
    g.position.set(lado * 0.22, 0.86, 0);
    g.add(new THREE.Mesh(brazo, tela));
    cuerpo.add(g);
    return g;
  });
  // La trenza que hace: aparece entre las manos cuando se agacha
  const trenza = new THREE.Mesh(
    juntar(
      [0, 1, 2].map(
        (i) =>
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(
              puntosDeTrenza(new THREE.Vector3(0, 0.75, 0.3), new THREE.Vector3(0, 0.25, 0.42), i, {
                vueltas: 10,
                ancho: 0.03,
                pasos: 14,
              }),
            ),
            20,
            0.014,
            4,
            false,
          ),
      ),
    ),
    tela,
  );
  cuerpo.add(trenza);
  return {
    grupo,
    /** `vuelta`: pasos dobles; `brio` de 0 a 1; `quieto` (s); `agachado` de 0 a 1; `t` (s). */
    posar(vuelta: number, brio: number, quieto: number, agachado: number, t: number) {
      const f = limitar(brio, 0, 1);
      const angulo = vuelta * Math.PI * 2;
      const [izquierda, derecha] = piernas;
      if (izquierda && derecha) {
        izquierda.rotation.x = 0.6 * f * Math.sin(angulo);
        derecha.rotation.x = -0.6 * f * Math.sin(angulo);
      }
      cuerpo.position.y = 0.03 * f * Math.abs(Math.sin(angulo));
      // Agachado, haciendo trenzas: inclinado hacia adelante con las manos abajo, rápido
      cuerpo.rotation.x = 0.45 * agachado;
      trenza.visible = agachado > 0.3;
      // Quieto un rato toca la guitarra: la mano derecha rasguea
      const toca = limitar((quieto - 0.4) / 0.4, 0, 1) * (1 - agachado);
      const [bIzq, bDer] = brazos;
      if (bIzq && bDer) {
        bIzq.rotation.set(-0.9 * toca - 1.1 * agachado, 0, -0.5 * toca);
        bDer.rotation.set(-0.5 * toca - 1.1 * agachado + 0.25 * toca * Math.sin(t * 14), 0, 0.4 * toca);
        if (agachado > 0.3) {
          bIzq.rotation.z = 0.3 * Math.sin(t * 18);
          bDer.rotation.z = -0.3 * Math.sin(t * 18 + 1);
        }
      }
      guitarra.visible = agachado < 0.5;
    },
  };
}
