// Las piezas que estrena El llano (TU-44), menos el Silbón (silbon.ts). Cada una sale de un nodo `tipo: pieza` de
// la escena (formato-llano.ts) y se arma con las herramientas de piezas.ts, como las del río:
//
//   molino   un molino de viento de dos aspas largas que gira sin parar. Con el freno (lo manda el guion), para con
//            las aspas tendidas en rampa, del borde del pozo hasta arriba: así se sube por ellas. Al soltar el freno
//            vuelve a agarrar viento y bota al que esté encima.
//   ganado   reses que pastan sueltas en su potrero y se apartan del muñeco que se les acerca: se las arrea. La que
//            entra al corral (la punta +x del potrero) se queda ahí, en su comedero. Pastan con azar de semilla.
//   hamaca   una hamaca entre dos horcones: jalando su cabuya hacia atrás (una manija con resorte, como la palmera
//            del río) se estira hasta el suelo; soltada del todo, lanza hacia su frente al que esté adentro.
//   saco     el saco de cachivaches del Silbón: se carga con una mano o con las dos. El Silbón lo recoge.
//
// Todo lo que se mueve (las aspas, las reses, el medio de la hamaca y su manija, el saco) viaja en la foto de la red.
// El invitado no simula: anima las patas de las reses con lo que anduvieron y dibuja la hamaca y su cabuya.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PiezaDelLlanoEnPlano } from "./formato-llano";
import type { Herramientas } from "./piezas";
import { manosEn } from "./piezas-pinar";

/** El bit de grupo de choque de lo suelto del llano (el saco, la manija de la hamaca): choca con todo menos con los
 * muñecos (bits 1 y 2), que lo agarran igual. */
const BIT_LLANO = 1 << 11;
const GRUPOS_LLANO = ((BIT_LLANO << 16) | (0xffff & ~0b110)) >>> 0;
/** Grupos del resolvedor sin filtro: se la encuentra para agarrarla, pero no empuja ni la empujan. */
const SIN_EMPUJAR = (BIT_LLANO << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const envolver = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** `x` llevado a [0, m). */
const modulo = (x: number, m: number) => ((x % m) + m) % m;

/** Los números de las piezas del llano que no se ponen desde Blender. */
export const AJUSTES_LLANO = {
  molino: {
    /** El grueso de las aspas (m). */
    grueso: 0.14,
    /** Frenando, nunca más despacio que esto hasta llegar a la rampa (rad/s). */
    arrastre: 0.3,
  },
  ganado: {
    /** La caja de cada res: medio ancho, medio alto y medio largo (m). */
    res: { ancho: 0.34, alto: 0.6, largo: 0.85 },
    /** Pastando: a qué velocidad andan (m/s), cada cuánto cambian de idea (s) y qué parte del tiempo comen quietas. */
    pastar: { velocidad: 0.3, cada: [2, 4.5], quietas: 0.45 },
    /** Qué tan rápido toman la velocidad que quieren (1/s). */
    seguir: 4,
    /** A cuánto de la cerca del potrero dejan de ir hacia ella (m). */
    margen: 0.9,
    /** En el corral: a qué velocidad van al comedero (m/s), cuánto se separan ahí (m) y a cuánto de la cerca de
     * atrás (−z) quedan. */
    comedero: { velocidad: 0.8, separacion: 1.4, atras: 0.9 },
    /** Una zancada (m). */
    zancada: 1.1,
  },
  hamaca: {
    /** Estirada más que esto (de 0 a 1), al soltar la cabuya se dispara. */
    tensa: 0.85,
    /** Cuánto tarda en volver de golpe (s), cuánto se pasa y tiembla después (de 0 a 1, s). */
    disparo: 0.25,
    pasarse: 0.12,
    temblar: 1.2,
    /** Qué tan rápido sigue a la cabuya (1/s). */
    seguir: 12,
    /** Estirada del todo, a qué altura sobre la base queda el medio (m). */
    suelo: 0.28,
    /** Hasta dónde del medio cuenta como estar adentro: de costado y de alto (m). */
    adentro: { radio: 0.8, abajo: 0.25, arriba: 1.2 },
    /** La manija: su alto sobre la base, cuánto queda detrás del medio, su masa y su medio largo (m, kg). */
    manija: { alto: 1.05, atras: 0.3, masa: 1.5, medio: 0.22 },
    /** El ancho de la tela (m) y a qué altura se ata a los horcones, desde arriba de la caja (m). */
    ancho: 0.95,
    atada: 0.15,
  },
  saco: {
    /** Más bajo que esto bajo donde empezó (m), y tantos segundos sin nadie, vuelve solo. */
    bajo: 1.2,
    vuelveSolo: 30,
  },
} as const;

/** Un cilindro de `radio` de `a` a `b` (para palos y sogas). */
function palo(a: THREE.Vector3, b: THREE.Vector3, radio: number, lados = 6): THREE.BufferGeometry {
  const largo = Math.max(0.001, a.distanceTo(b));
  const g = new THREE.CylinderGeometry(radio, radio, largo, lados, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, b.clone().sub(a).normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// ── El molino ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Molino {
  readonly cual: "molino";
  readonly nombre: string;
  /** La rueda de las aspas (cinemática): gira sobre la z de la caja. */
  readonly rueda: RAPIER.RigidBody;
  /** Cuánto giró la rueda desde las aspas horizontales (radianes, de 0 a 2π). */
  readonly giro: number;
  /** Qué tan rápido gira (rad/s). */
  readonly velocidad: number;
  /** Si está parada con las aspas en rampa. */
  readonly parada: boolean;
  /** Con el freno puesto, para en la próxima rampa; sin él, agarra viento. Lo llama el guion en cada paso. */
  frenar(si: boolean): void;
}

export function armarMolino(h: Herramientas, p: Extract<PiezaDelLlanoEnPlano, { cual: "molino" }>): Molino {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLANO.molino;
  const { centro, medio, giro } = p.caja;
  const radio = Math.max(medio.x, medio.y);
  const ancho = medio.z;
  const giroDe = (angulo: number) => giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_Z, angulo));

  // Empieza girando, con las aspas paradas
  let angulo = Math.PI / 2;
  let velocidad = p.viento;
  let freno = false;
  let parada = false;
  const rueda = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(centro.x, centro.y, centro.z)
      .setRotation(giroDe(angulo)),
  );
  // Las dos aspas son una sola tabla larga que pasa por el eje: paradas, una rampa sin escalones
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.cuboid(radio, a.grueso / 2, ancho).setFriction(1.2),
    rueda,
  );
  const imagen = crearImagenRueda(h, radio, ancho, a.grueso);
  imagen.name = p.nombre;
  h.mover(rueda, imagen);
  h.solida({ nombre: p.nombre, objeto: imagen, cuerpo: rueda, colisionador });
  // El horcón de atrás con el eje, la cola y el techito (solo imagen)
  const torre = crearImagenTorre(h, radio, ancho);
  torre.position.copy(centro);
  torre.quaternion.copy(giro);
  h.escena.add(torre);

  h.antes(() => {
    if (freno) {
      if (!parada) {
        // Lo que falta hasta la próxima rampa, hacia donde gira; frena para llegar justo ahí
        const falta = modulo(p.angulo - angulo, Math.PI);
        velocidad = Math.max(Math.min(velocidad, Math.sqrt(2 * p.frenada * falta)), Math.min(a.arrastre, velocidad));
        if (velocidad < a.arrastre) velocidad = a.arrastre;
        if (falta <= velocidad * PASO) {
          angulo += falta;
          velocidad = 0;
          parada = true;
        } else angulo += velocidad * PASO;
      }
    } else {
      parada = false;
      velocidad = Math.min(p.viento, velocidad + p.arranque * PASO);
      angulo += velocidad * PASO;
    }
    angulo = modulo(angulo, 2 * Math.PI);
    rueda.setNextKinematicRotation(giroDe(angulo));
  });

  return {
    cual: "molino",
    nombre: p.nombre,
    rueda,
    get giro() {
      return angulo;
    },
    get velocidad() {
      return velocidad;
    },
    get parada() {
      return parada;
    },
    frenar(si) {
      freno = si;
    },
  };
}

/** La rueda: dos aspas largas de varas y tablillas, con su eje. En el marco de la rueda: las aspas a lo largo de x,
 * de grueso en y y de ancho en z. */
function crearImagenRueda(h: Herramientas, radio: number, ancho: number, grueso: number) {
  const grupo = new THREE.Group();
  const varas: THREE.BufferGeometry[] = [];
  // El palo del medio, de punta a punta, y los dos largueros de cada aspa
  varas.push(new THREE.BoxGeometry(radio * 2, grueso, 0.16));
  for (const z of [-ancho + 0.05, ancho - 0.05])
    varas.push(new THREE.BoxGeometry(radio * 2 - 0.9, grueso * 0.8, 0.07).translate(0, 0, z));
  // Las tablillas de través, con luz entre ellas (menos cerca del eje)
  const tablillas: THREE.BufferGeometry[] = [];
  for (let x = 0.55; x < radio - 0.1; x += 0.32) {
    for (const s of [-1, 1])
      tablillas.push(new THREE.BoxGeometry(0.2, grueso * 0.6, ancho * 2 - 0.04).translate(s * x, grueso * 0.15, 0));
  }
  grupo.add(new THREE.Mesh(juntar(varas), h.madera));
  grupo.add(new THREE.Mesh(juntar(tablillas), h.madera));
  // El cubo del eje
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.2, 0.2, ancho * 2 + 0.3, 12).rotateX(Math.PI / 2),
        new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8).rotateX(Math.PI / 2).translate(0, 0, -ancho - 0.6),
      ]),
      h.oscuro,
    ),
  );
  return grupo;
}

/** El horcón del molino: detrás de la rueda (−z), con su eje, el techito y la cola que lo pone de cara al viento. */
function crearImagenTorre(h: Herramientas, radio: number, ancho: number) {
  const grupo = new THREE.Group();
  const atras = -ancho - 1.2;
  const partes: THREE.BufferGeometry[] = [
    // El horcón, desde el fondo del pozo
    new THREE.BoxGeometry(0.26, radio + 2.2, 0.26).translate(0, (-radio + 2.2) / 2 - 0.4, atras),
    // Dos riostras
    palo(new THREE.Vector3(0, -radio * 0.6, atras - 1.4), new THREE.Vector3(0, 0.6, atras), 0.07),
    palo(new THREE.Vector3(0, -radio * 0.6, atras + 0.5), new THREE.Vector3(0, -0.5, atras), 0.06),
    // La cola: una vara hacia atrás y la veleta
    new THREE.BoxGeometry(0.08, 0.08, 2.4).translate(0, 1.5, atras - 1.2),
    new THREE.BoxGeometry(0.05, 1, 1.1).translate(0, 1.5, atras - 2.2),
  ];
  grupo.add(new THREE.Mesh(juntar(partes), h.madera));
  // El techito de palma sobre el eje
  grupo.add(new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.6, 6).translate(0, 1.1, atras), h.oscuro));
  return grupo;
}

// ── El ganado ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Ganado {
  readonly cual: "ganado";
  readonly nombre: string;
  /** Las reses (cuerpos sueltos, que no se voltean). */
  readonly reses: readonly RAPIER.RigidBody[];
  readonly cuantas: number;
  /** Cuántas entraron al corral (y ahí se quedan). */
  readonly encerradas: number;
  /** Si esa res está en el corral. */
  enElCorral(i: number): boolean;
  /** Llama a `aviso` cada vez que entra una al corral, con cuántas van. Devuelve cómo dejar de escuchar. */
  alEncerrar(aviso: (encerradas: number) => void): () => void;
  /** Las pone a todas en el corral, en su comedero (al retomar). */
  encerrar(): void;
}

export function armarGanado(h: Herramientas, p: Extract<PiezaDelLlanoEnPlano, { cual: "ganado" }>): Ganado {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLANO.ganado;
  const { centro, medio, giro } = p.caja;
  const giroInverso = giro.clone().invert();
  const base = h.enElMundo(p, 0, -medio.y, 0).y;
  const azar = crearAzar(p.semilla * 7919 + 13);
  /** Un punto del mundo en el marco del potrero (sin la altura) y al revés. */
  const aLocal = (x: number, z: number) =>
    new THREE.Vector3(x - centro.x, 0, z - centro.z).applyQuaternion(giroInverso);
  const aMundo = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyQuaternion(giro).add(centro);
  const inicioCorral = medio.x - p.corral;
  /** Hacia dónde mira el potrero (su +z), como rumbo: el giro de la caja alrededor de +y. */
  const rumboCaja = Math.atan2(2 * giro.y * giro.w, 1 - 2 * giro.y * giro.y);
  /** Dónde come la res que entra `k`-ésima al corral (en el marco del potrero). */
  const comedero = (k: number) => {
    const c = a.comedero;
    return new THREE.Vector3(
      inicioCorral + p.corral / 2 + (k - (p.cuantas - 1) / 2) * c.separacion,
      0,
      -medio.z + c.atras,
    );
  };

  interface Res {
    readonly cuerpo: RAPIER.RigidBody;
    readonly azar: () => number;
    rumbo: number;
    vx: number;
    vz: number;
    /** Lo que quiere hacer pastando: hacia dónde y hasta cuándo. */
    idea: { rumbo: number; anda: boolean; hasta: number };
    /** En qué lugar del comedero (o −1 si anda suelta). */
    comedero: number;
  }
  const reses: Res[] = [];
  let encerradas = 0;
  let tiempo = 0;
  const avisos = new Set<(encerradas: number) => void>();
  const { res: r } = a;
  for (let k = 0; k < p.cuantas; k++) {
    // Repartidas en la parte de atrás del potrero (lejos del corral), cada una con su azar
    const largo = 2 * medio.x - p.corral;
    const lx = -medio.x + largo * (0.25 + (0.45 * (k + 0.5 + 0.3 * azar())) / p.cuantas);
    const lz = (azar() * 2 - 1) * Math.max(0, medio.z - 1.3);
    const enMundo = aMundo(lx, lz);
    const rumbo = Math.atan2(Math.sin(k * 2.1), Math.cos(k * 2.1));
    const cuerpo = mundo.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(enMundo.x, base + 0.02, enMundo.z)
        .setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, rumbo))
        .lockRotations()
        .setCanSleep(false),
    );
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(r.ancho, r.alto, r.largo)
        .setTranslation(0, r.alto, 0)
        .setMass(p.masa)
        .setFriction(0.05),
      cuerpo,
    );
    const imagen = crearImagenRes(k);
    imagen.grupo.name = `${p.nombre}-${k + 1}`;
    h.mover(cuerpo, imagen.grupo);
    reses.push({
      cuerpo,
      azar: crearAzar(p.semilla * 104729 + k * 7907 + 1),
      rumbo,
      vx: 0,
      vz: 0,
      idea: { rumbo, anda: false, hasta: 0 },
      comedero: -1,
    });
    // Las patas, con lo que anduvo cada una (también en el invitado)
    const antes = new THREE.Vector3().copy(cuerpo.translation());
    let andado = 0;
    let brio = 0;
    h.guardar(() => {
      const t = cuerpo.translation();
      const d = Math.hypot(t.x - antes.x, t.z - antes.z);
      antes.copy(t);
      if (d < 0.5) andado += d;
      brio += (d / PASO / p.velocidad - brio) * 0.2;
    });
    h.dibujar(() => imagen.posar(andado / a.zancada, brio));
  }
  const primera = reses[0];
  if (primera) {
    const colisionador = primera.cuerpo.collider(0);
    h.solida({ nombre: p.nombre, objeto: new THREE.Group(), cuerpo: primera.cuerpo, colisionador });
  }

  /** La velocidad que quiere la res, pastando o espantada. */
  const deseada = (res: Res, munecos: readonly Muneco[]) => {
    const t = res.cuerpo.translation();
    const local = aLocal(t.x, t.z);
    // En el corral: va a su comedero y se queda
    if (res.comedero >= 0) {
      const destino = comedero(res.comedero);
      const falta = destino.clone().sub(local);
      const d = falta.length();
      // Comiendo, mira hacia el comedero (la cerca de atrás, su −z)
      if (d < 0.12) return { dir: new THREE.Vector3(), rapidez: 0, mirar: rumboCaja + Math.PI };
      return { dir: falta.normalize(), rapidez: Math.min(a.comedero.velocidad, d * 2), mirar: null };
    }
    // Espantada por el muñeco más cercano: se aparta de él
    let susto: THREE.Vector3 | null = null;
    let cerca = p.huir;
    for (const m of munecos) {
      const q = m.partes.pelvis.translation();
      const d = Math.hypot(q.x - t.x, q.z - t.z);
      if (d < cerca) {
        cerca = d;
        susto = aLocal(q.x, q.z);
      }
    }
    let dir: THREE.Vector3;
    let rapidez: number;
    if (susto) {
      dir = local.clone().sub(susto).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      rapidez = p.velocidad;
    } else {
      // Pastando: cada tanto cambia de idea (andar un rato hacia algún lado o comer quieta)
      if (tiempo >= res.idea.hasta) {
        const [desde, hasta] = a.pastar.cada;
        res.idea = {
          rumbo: res.azar() * Math.PI * 2,
          anda: res.azar() > a.pastar.quietas,
          hasta: tiempo + desde + (hasta - desde) * res.azar(),
        };
      }
      dir = new THREE.Vector3(Math.sin(res.idea.rumbo), 0, Math.cos(res.idea.rumbo));
      rapidez = res.idea.anda ? a.pastar.velocidad : 0;
    }
    // La cerca del potrero: no va hacia ella; arrinconada, se escurre a lo largo de la cerca hacia el corral
    const m = a.margen;
    if (local.x < -medio.x + m && dir.x < 0) dir.x = 0;
    if (local.x > medio.x - m && dir.x > 0) dir.x = 0;
    if (local.z < -medio.z + m && dir.z < 0) dir.z = 0;
    if (local.z > medio.z - m && dir.z > 0) dir.z = 0;
    if (dir.length() < 0.25 && susto) dir.set(1, 0, 0);
    if (dir.lengthSq() > 1e-6) dir.normalize();
    return { dir, rapidez, mirar: null };
  };

  h.antes((munecos) => {
    tiempo += PASO;
    for (const res of reses) {
      const { dir, rapidez, mirar } = deseada(res, munecos);
      const quiere = dir.applyQuaternion(giro).multiplyScalar(rapidez);
      const f = Math.min(1, a.seguir * PASO);
      res.vx += (quiere.x - res.vx) * f;
      res.vz += (quiere.z - res.vz) * f;
      const v = res.cuerpo.linvel();
      res.cuerpo.setLinvel({ x: res.vx, y: v.y, z: res.vz }, true);
      // Mira hacia donde va (o hacia el comedero, comiendo)
      const objetivo =
        mirar !== null ? mirar : Math.hypot(res.vx, res.vz) > 0.08 ? Math.atan2(res.vx, res.vz) : res.rumbo;
      res.rumbo = envolver(res.rumbo + limitar(envolver(objetivo - res.rumbo), -3 * PASO, 3 * PASO));
      res.cuerpo.setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, res.rumbo), true);
    }
  });

  h.despues(() => {
    for (const res of reses) {
      if (res.comedero >= 0) continue;
      const t = res.cuerpo.translation();
      const local = aLocal(t.x, t.z);
      if (local.x < inicioCorral || Math.abs(local.z) > medio.z) continue;
      res.comedero = encerradas;
      encerradas++;
      for (const aviso of avisos) aviso(encerradas);
    }
  });

  return {
    cual: "ganado",
    nombre: p.nombre,
    reses: reses.map((res) => res.cuerpo),
    cuantas: p.cuantas,
    get encerradas() {
      return encerradas;
    },
    enElCorral: (i) => (reses[i]?.comedero ?? -1) >= 0,
    alEncerrar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
    encerrar() {
      for (const res of reses) {
        if (res.comedero < 0) res.comedero = encerradas++;
        const lugar = comedero(res.comedero);
        const enMundo = aMundo(lugar.x, lugar.z);
        res.vx = 0;
        res.vz = 0;
        res.cuerpo.setTranslation({ x: enMundo.x, y: base + 0.02, z: enMundo.z }, true);
        res.cuerpo.setLinvel(CERO, true);
        res.rumbo = envolver(rumboCaja + Math.PI);
        res.cuerpo.setRotation(new THREE.Quaternion().setFromAxisAngle(ARRIBA, res.rumbo), true);
      }
    },
  };
}

/** Una res cebú del llano: lomo largo con la giba en la cruz, la papada, la cabeza con cuernos y orejas caídas, cuatro
 * patas y la cola. Mira hacia +z, con las patas en y = 0. */
function crearImagenRes(semilla: number) {
  const azar = crearAzar(semilla * 31 + 5);
  const pelo = materialTela(azar() > 0.5 ? COLORES.silueta : COLORES.siluetaHonda, { repetir: 2, relieve: 3 });
  const grupo = new THREE.Group();
  const cuerpo = new THREE.Group();
  grupo.add(cuerpo);
  cuerpo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CapsuleGeometry(0.36, 0.95, 6, 14).rotateX(Math.PI / 2).translate(0, 1.0, -0.05),
        // El pecho, la giba (chata, en la cruz) y la papada
        new THREE.SphereGeometry(0.38, 12, 10).scale(1, 1, 1.1).translate(0, 1.02, 0.45),
        new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.7, 1.3).translate(0, 1.36, 0.42),
        new THREE.BoxGeometry(0.1, 0.34, 0.36).translate(0, 0.72, 0.62),
      ]),
      pelo,
    ),
  );
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.12, 0.82);
  cabeza.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(0.3, 0.32, 0.56).translate(0, -0.08, 0.24),
        new THREE.SphereGeometry(0.16, 10, 8).scale(1, 0.85, 1).translate(0, -0.16, 0.5),
        // Los cuernos, para afuera y para arriba, y las orejas caídas
        ...[-1, 1].map((lado) =>
          new THREE.ConeGeometry(0.045, 0.42, 6)
            .translate(0, 0.21, 0)
            .rotateZ(lado * -0.9)
            .translate(lado * 0.14, 0.06, 0.04),
        ),
        ...[-1, 1].map((lado) =>
          new THREE.BoxGeometry(0.24, 0.04, 0.12).rotateZ(lado * 0.8).translate(lado * 0.22, -0.08, 0.1),
        ),
      ]),
      pelo,
    ),
  );
  cuerpo.add(cabeza);
  const pata = new THREE.CapsuleGeometry(0.065, 0.6, 4, 8).translate(0, -0.36, 0);
  const patas = [
    [0.2, 0.42, 0],
    [-0.2, 0.42, Math.PI],
    [0.2, -0.5, Math.PI],
    [-0.2, -0.5, 0],
  ].map(([x = 0, z = 0, fase = 0]) => {
    const g = new THREE.Group();
    g.position.set(x, 0.74, z);
    g.add(new THREE.Mesh(pata, pelo));
    cuerpo.add(g);
    return { g, fase };
  });
  const cola = new THREE.Group();
  cola.position.set(0, 1.12, -0.62);
  cola.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5).translate(0, -0.35, 0).rotateX(0.25), pelo));
  cuerpo.add(cola);
  const fase0 = azar() * 6;
  return {
    grupo,
    /** `vuelta`: cuántas zancadas lleva; `brio`: qué tan rápido va (0 a 1). */
    posar(vuelta: number, brio: number) {
      const f = limitar(brio, 0, 1);
      const angulo = vuelta * Math.PI * 2;
      for (const { g, fase } of patas) g.rotation.x = 0.55 * f * Math.sin(angulo + fase);
      cuerpo.position.y = 0.03 * f * Math.abs(Math.sin(angulo));
      // Quieta, baja la cabeza a comer y mueve la cola
      cabeza.rotation.x = 0.55 * (1 - f);
      cola.rotation.z = 0.25 * Math.sin(vuelta * 3 + fase0 + (1 - f) * angulo);
    },
  };
}

// ── La hamaca ───────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoHamaca = "colgada" | "estirada" | "disparando";

export interface Hamaca {
  readonly cual: "hamaca";
  readonly nombre: string;
  /** El medio de la hamaca (cinemático, sin choques): de él cuelga la tela. */
  readonly bolsa: RAPIER.RigidBody;
  /** La manija de la cabuya, que se jala hacia atrás. */
  readonly manija: RAPIER.RigidBody;
  readonly estado: EstadoHamaca;
  /** Cuánto está estirada: 0 colgada, 1 del todo (el medio en el suelo). */
  readonly estirada: number;
  /** Cuánto se jaló la cabuya, de 0 a 1. */
  readonly jalada: number;
  /** Dónde está el medio de la hamaca ahora (en el mundo). */
  medio(): THREE.Vector3;
  /** Si ese punto (una pelvis) está adentro de la hamaca, con la hamaca como está. */
  adentro(p: THREE.Vector3Like): boolean;
  /** Cuántas veces lanzó a alguien. */
  readonly lanzados: number;
  /** Llama a `aviso` cuando lanza a alguien (0 el rojo, 1 el turquesa). Devuelve cómo dejar de escuchar. */
  alLanzar(aviso: (jugador: 0 | 1) => void): () => void;
}

export function armarHamaca(h: Herramientas, p: Extract<PiezaDelLlanoEnPlano, { cual: "hamaca" }>): Hamaca {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLANO.hamaca;
  const { medio, giro } = p.caja;
  const frente = EJE_Z.clone().applyQuaternion(giro);
  const costado = EJE_X.clone().applyQuaternion(giro);
  const piso = h.enElMundo(p, 0, -medio.y, 0);
  const reposo = piso.clone().addScaledVector(ARRIBA, p.colgar);
  /** El medio de la hamaca estirada `e` (negativa: pasada hacia adelante). */
  const medioCon = (e: number) =>
    reposo
      .clone()
      .addScaledVector(frente, -p.estirar * e)
      .addScaledVector(ARRIBA, -(p.colgar - a.suelo) * limitar(e, 0, 1));

  // Los dos horcones, fijos, a los lados de la caja; la tela se ata cerca de arriba
  const altoHorcon = medio.y * 2;
  const atadas = [-1, 1].map((s) => h.enElMundo(p, s * medio.x, medio.y - a.atada, 0));
  for (const s of [-1, 1]) {
    const pie = h.enElMundo(p, s * medio.x, -medio.y + altoHorcon / 2, 0);
    const horcon = h.fijo(pie, giro);
    mundo.createCollider(rapier.ColliderDesc.cylinder(altoHorcon / 2, 0.09), horcon);
  }
  const horcones = new THREE.Mesh(
    juntar([-1, 1].map((s) => new THREE.CylinderGeometry(0.08, 0.1, altoHorcon + 0.1, 8).translate(s * medio.x, 0, 0))),
    h.madera,
  );
  horcones.position.copy(h.enElMundo(p, 0, 0, 0));
  horcones.quaternion.copy(giro);
  h.escena.add(horcones);

  // El medio de la hamaca: cinemático y sin choques (se mete el que quiere); está para `nivel.pieza(nombre)`
  const bolsa = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(reposo.x, reposo.y, reposo.z).setRotation(giro),
  );
  const colisionador = mundo.createCollider(rapier.ColliderDesc.ball(0.3).setSensor(true).setCollisionGroups(0), bolsa);
  const tela = crearImagenTela(materialTela(COLORES.silueta, { repetir: 2, relieve: 3 }));
  tela.malla.name = p.nombre;
  h.escena.add(tela.malla);
  h.solida({ nombre: p.nombre, objeto: tela.malla, cuerpo: bolsa, colisionador });

  // La manija de la cabuya: a un costado, y se jala hacia atrás con un resorte que la devuelve
  const inicio = piso
    .clone()
    .addScaledVector(costado, p.lado)
    .addScaledVector(ARRIBA, a.manija.alto)
    .addScaledVector(frente, -a.manija.atras);
  const haciaAtras = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI));
  const ancla = h.fijo(inicio, haciaAtras);
  const manija = mundo.createRigidBody(h.dinamico(inicio, haciaAtras).setLinearDamping(1).setAngularDamping(2));
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(a.manija.medio, 0.03, 0.03)
      .setMass(a.manija.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_LLANO)
      .setSolverGroups(SIN_EMPUJAR),
    manija,
  );
  const datos = rapier.JointData.prismatic(CERO, CERO, EJE_Z);
  datos.limitsEnabled = true;
  datos.limits = [0, p.estirar];
  const junta = mundo.createImpulseJoint(datos, ancla, manija, true);
  junta.setContactsEnabled(false);
  if (junta instanceof rapier.PrismaticImpulseJoint) {
    const rigidez = p.fuerza / p.estirar;
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
  const cabuya = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 1, 5).translate(0, 0.5, 0),
    materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false }),
  );
  h.escena.add(cabuya);

  let estado: EstadoHamaca = "colgada";
  let estirada = 0;
  let jalada = 0;
  let agarrada = false;
  let tiempo = 0;
  let desde = 0;
  let lanzados = 0;
  let montados: { jugador: 0 | 1; muneco: Muneco; corrido: THREE.Vector3 }[] = [];
  const avisos = new Set<(jugador: 0 | 1) => void>();

  const adentroCon = (q: THREE.Vector3Like, e: number) => {
    const c = medioCon(e);
    return (
      Math.hypot(q.x - c.x, q.z - c.z) < a.adentro.radio && q.y > c.y - a.adentro.abajo && q.y < c.y + a.adentro.arriba
    );
  };
  const llevar = (m: Muneco, v: THREE.Vector3Like) => {
    for (const parte of Object.values(m.partes)) {
      parte.setLinvel(v, true);
      parte.setAngvel(CERO, true);
    }
  };

  h.antes((munecos) => {
    const t = manija.translation();
    const atras = (inicio.x - t.x) * frente.x + (inicio.y - t.y) * frente.y + (inicio.z - t.z) * frente.z;
    jalada = limitar(atras / p.estirar, 0, 1);
    const antesAgarrada = agarrada;
    agarrada = munecos.some((m) => manosEn(m, manija) > 0);
    if (estado !== "disparando") {
      estirada += (jalada - estirada) * Math.min(1, a.seguir * PASO);
      estado = estirada > 0.02 ? "estirada" : "colgada";
      // Soltó la cabuya con la hamaca estirada del todo: se dispara con los que estén adentro
      if (antesAgarrada && !agarrada && estirada >= a.tensa) {
        estado = "disparando";
        tiempo = 0;
        desde = estirada;
        const c = medioCon(estirada);
        montados = munecos.flatMap((m, i) =>
          i <= 1 && adentroCon(m.partes.pelvis.translation(), estirada)
            ? [
                {
                  jugador: i as 0 | 1,
                  muneco: m,
                  corrido: new THREE.Vector3().copy(m.partes.pelvis.translation()).sub(c),
                },
              ]
            : [],
        );
      }
    }
    if (estado === "disparando") {
      tiempo += PASO;
      const f = tiempo / a.disparo;
      if (f < 1) {
        estirada = desde * (1 - f * f);
        // Los de adentro van con el medio (y se juntan a él, un poco más arriba)
        const c = medioCon(estirada);
        for (const m of montados) {
          const destino = c
            .clone()
            .addScaledVector(m.corrido, 1 - f)
            .addScaledVector(ARRIBA, 0.3 * f);
          const pelvis = m.muneco.partes.pelvis.translation();
          llevar(m.muneco, {
            x: (destino.x - pelvis.x) / PASO,
            y: (destino.y - pelvis.y) / PASO,
            z: (destino.z - pelvis.z) / PASO,
          });
        }
      } else {
        // Colgada de golpe: los lanza hacia su frente, y tiembla un rato
        for (const m of montados) {
          const v = frente
            .clone()
            .multiplyScalar(p.lanzar * Math.cos(p.elevacion))
            .addScaledVector(ARRIBA, p.lanzar * Math.sin(p.elevacion));
          llevar(m.muneco, v);
          lanzados++;
          for (const aviso of avisos) aviso(m.jugador);
        }
        montados = [];
        const temblor = tiempo - a.disparo;
        estirada = -a.pasarse * Math.sin(temblor * 9) * Math.exp(-temblor * 3);
        if (temblor > a.temblar) {
          estado = "colgada";
          estirada = 0;
        }
      }
    }
    if (estado === "disparando") {
      // La cabuya se va con la hamaca: la manija vuelve de golpe con ella
      const d = p.estirar * Math.max(0, estirada);
      manija.setTranslation(
        { x: inicio.x - frente.x * d, y: inicio.y - frente.y * d, z: inicio.z - frente.z * d },
        true,
      );
      manija.setLinvel(CERO, true);
    }
    const c = medioCon(estirada);
    bolsa.setNextKinematicTranslation({ x: c.x, y: c.y, z: c.z });
  });

  // La tela: de los dos horcones al medio, como esté el medio (también en el invitado, que lo recibe en la foto)
  const centro = new THREE.Vector3();
  h.dibujar(() => {
    centro.copy(bolsa.translation());
    tela.poner(atadas[0] ?? centro, centro, atadas[1] ?? centro, frente);
    imagenManija.updateMatrixWorld();
    const mano = imagenManija.position.clone();
    const tramo = mano.clone().sub(centro);
    cabuya.position.copy(centro);
    cabuya.quaternion.setFromUnitVectors(ARRIBA, tramo.clone().normalize());
    cabuya.scale.set(1, tramo.length(), 1);
  });

  return {
    cual: "hamaca",
    nombre: p.nombre,
    bolsa,
    manija,
    get estado() {
      return estado;
    },
    get estirada() {
      return estirada;
    },
    get jalada() {
      return jalada;
    },
    medio: () => medioCon(estirada),
    adentro: (q) => adentroCon(q, estirada),
    get lanzados() {
      return lanzados;
    },
    alLanzar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** La tela de la hamaca: una cinta que cuelga de `a` a `b` pasando por `medio`, angosta en las puntas (donde se junta
 * en las cabuyas) y ancha en el medio, con un dibujo de rayas. Se rehace en cada cuadro. */
function crearImagenTela(material: THREE.Material) {
  const a = AJUSTES_LLANO.hamaca;
  const largo = 24;
  const anchos = 5;
  const geometria = new THREE.PlaneGeometry(1, 1, largo, anchos - 1);
  const malla = new THREE.Mesh(geometria, material);
  malla.frustumCulled = false;
  const posiciones = geometria.getAttribute("position");
  const control = new THREE.Vector3();
  const punto = new THREE.Vector3();
  return {
    malla,
    /** De `a` a `b` por `medio`; `frente`: hacia dónde se abre la tela a lo ancho. */
    poner(desde: THREE.Vector3, medio: THREE.Vector3, hasta: THREE.Vector3, frente: THREE.Vector3) {
      // La curva que pasa por el medio: el control, al doble de lejos que el medio de la recta
      control.copy(medio).multiplyScalar(2).addScaledVector(desde, -0.5).addScaledVector(hasta, -0.5);
      for (let j = 0; j < anchos; j++) {
        const w = j / (anchos - 1) - 0.5;
        for (let i = 0; i <= largo; i++) {
          const u = i / largo;
          const k = 1 - u;
          punto
            .copy(desde)
            .multiplyScalar(k * k)
            .addScaledVector(control, 2 * k * u)
            .addScaledVector(hasta, u * u);
          // Se abre en el medio y se junta en las puntas; las orillas un poco más altas (hace bolsa)
          const abre = Math.sin(Math.PI * u);
          punto.addScaledVector(frente, w * a.ancho * abre).addScaledVector(ARRIBA, Math.abs(w) * 0.25 * abre);
          posiciones.setXYZ(j * (largo + 1) + i, punto.x, punto.y, punto.z);
        }
      }
      posiciones.needsUpdate = true;
      geometria.computeVertexNormals();
    },
  };
}

// ── El saco ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface Saco {
  readonly cual: "saco";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Cuántos muñecos lo tienen agarrado. */
  readonly agarrado: number;
  /** Si ya se lo dieron al Silbón (y lo lleva él). */
  readonly entregado: boolean;
  /** Si está quieto donde empezó. */
  readonly enSuLugar: boolean;
  /** Se lo dan al Silbón: ya no es suelto, lo lleva él (`llevar`). */
  entregar(): void;
  /** Ya entregado, lo pone ahí (lo llama el Silbón en cada paso; `ya`: de una vez). */
  llevar(posicion: THREE.Vector3Like, giro: THREE.Quaternion, ya?: boolean): void;
  /** Lo pone donde empezó, quieto. */
  volver(): void;
}

export function armarSaco(h: Herramientas, p: Extract<PiezaDelLlanoEnPlano, { cual: "saco" }>): Saco {
  const { rapier, mundo } = h;
  const a = AJUSTES_LLANO.saco;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(
    h.dinamico(centro, giro).setAngularDamping(2).setLinearDamping(0.2).setSleeping(true),
  );
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.roundCuboid(
      medio.x * 0.8,
      medio.y * 0.8,
      medio.z * 0.8,
      Math.min(medio.x, medio.y, medio.z) * 0.2,
    )
      .setMass(p.masa)
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_LLANO),
    cuerpo,
  );
  const objeto = crearImagenSaco(medio, h.oscuro);
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });

  let agarrado = 0;
  let entregado = false;
  let tirado = 0;
  const saco: Saco = {
    cual: "saco",
    nombre: p.nombre,
    cuerpo,
    get agarrado() {
      return agarrado;
    },
    get entregado() {
      return entregado;
    },
    get enSuLugar() {
      const t = cuerpo.translation();
      return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.05;
    },
    entregar() {
      if (entregado) return;
      entregado = true;
      cuerpo.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
      colisionador.setCollisionGroups(0);
    },
    llevar(posicion, q, ya = false) {
      if (ya) {
        cuerpo.setTranslation({ x: posicion.x, y: posicion.y, z: posicion.z }, true);
        cuerpo.setRotation(q, true);
      }
      cuerpo.setNextKinematicTranslation({ x: posicion.x, y: posicion.y, z: posicion.z });
      cuerpo.setNextKinematicRotation(q);
    },
    volver() {
      cuerpo.setTranslation({ x: centro.x, y: centro.y, z: centro.z }, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setLinvel(CERO, true);
      cuerpo.setAngvel(CERO, true);
      cuerpo.sleep();
    },
  };
  h.despues((munecos, fuera) => {
    if (entregado) return;
    agarrado = munecos.filter((m) => manosEn(m, cuerpo) > 0).length;
    const t = cuerpo.translation();
    // Tirado lejos y abajo mucho rato (o caído al vacío), vuelve a su lugar
    tirado = agarrado === 0 && t.y < centro.y - a.bajo ? tirado + PASO : 0;
    if (fuera(t) || tirado > a.vuelveSolo) {
      saco.volver();
      tirado = 0;
    }
  });
  return saco;
}

/** El saco: un costal panzón, amarrado arriba con su cabuya y con bultos de los cachivaches. */
function crearImagenSaco(medio: THREE.Vector3, material: THREE.Material) {
  const grupo = new THREE.Group();
  const r = Math.min(medio.x, medio.z);
  const partes: THREE.BufferGeometry[] = [
    new THREE.SphereGeometry(r, 14, 10).scale(1, medio.y / r, 1).translate(0, -medio.y * 0.12, 0),
    new THREE.CylinderGeometry(r * 0.22, r * 0.45, medio.y * 0.35, 10).translate(0, medio.y * 0.72, 0),
    new THREE.ConeGeometry(r * 0.4, medio.y * 0.3, 8).rotateX(Math.PI).translate(0, medio.y * 1.0, 0),
    // Los bultos: una olla, un palo que se asoma
    new THREE.SphereGeometry(r * 0.45, 8, 6).translate(r * 0.55, -medio.y * 0.1, r * 0.35),
    new THREE.CylinderGeometry(0.02, 0.02, medio.y * 1.1, 5).rotateZ(0.35).translate(-r * 0.25, medio.y * 0.85, 0),
  ];
  grupo.add(new THREE.Mesh(juntar(partes), material));
  return grupo;
}

// ── Lo del guion del llano ──────────────────────────────────────────────────────────────────────────────────────

/** Una puerta que gira sobre una bisagra de pie (una talanquera, un portón): un sólido cinemático del nivel. */
export interface PuertaConBisagra {
  /** De 0 (cerrada) a 1 (abierta del todo). */
  readonly abierta: number;
  /** Si se está abriendo (o ya se abrió): una vez que empieza, no se cierra. */
  readonly abriendo: boolean;
  /** Que se abra de a poco (o de una vez, con `ya`). */
  abrir(ya?: boolean): void;
  /** En cada paso del guion: la mueve si se está abriendo. */
  pasar(): void;
}

/** La puerta `cuerpo` gira `angulo` (radianes alrededor de +y: positivo, de +z hacia +x) sobre la bisagra de pie que
 * pasa por (x, z), en `pasos` pasos. */
export function crearPuertaConBisagra(
  cuerpo: RAPIER.RigidBody,
  bisagra: { readonly x: number; readonly z: number },
  angulo: number,
  pasos: number,
): PuertaConBisagra {
  const eje = new THREE.Vector3(bisagra.x, 0, bisagra.z);
  const desde = new THREE.Vector3().copy(cuerpo.translation());
  const giro = new THREE.Quaternion().copy(cuerpo.rotation());
  let abierta = 0;
  let abriendo = false;
  const mover = (ya: boolean) => {
    const f = abierta * abierta * (3 - 2 * abierta);
    const q = new THREE.Quaternion().setFromAxisAngle(ARRIBA, angulo * f);
    const centro = desde.clone().sub(eje).applyQuaternion(q).add(eje);
    const g = q.multiply(giro);
    if (ya) {
      cuerpo.setTranslation({ x: centro.x, y: centro.y, z: centro.z }, true);
      cuerpo.setRotation(g, true);
    }
    cuerpo.setNextKinematicTranslation({ x: centro.x, y: centro.y, z: centro.z });
    cuerpo.setNextKinematicRotation(g);
  };
  return {
    get abierta() {
      return abierta;
    },
    get abriendo() {
      return abriendo;
    },
    abrir(ya = false) {
      abriendo = true;
      if (ya) {
        abierta = 1;
        mover(true);
      }
    },
    pasar() {
      if (!abriendo || abierta >= 1) return;
      abierta = Math.min(1, abierta + 1 / pasos);
      mover(false);
    },
  };
}

/** El samán: un tronco grueso y torcido que se abre en ramas, y una copa ancha y chata como un paraguas. En el marco
 * de su pie. */
export function crearImagenSaman(madera: THREE.Material, hojas: THREE.Material) {
  const grupo = new THREE.Group();
  const ramas: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.4, 0.6, 3.2, 12).translate(0, 1.6, 0)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    ramas.push(
      new THREE.CylinderGeometry(0.12, 0.25, 3.4, 8).translate(0, 1.7, 0).rotateZ(1.0).rotateY(a).translate(0, 2.9, 0),
    );
  }
  grupo.add(new THREE.Mesh(juntar(ramas), madera));
  const copa: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = i === 0 ? 0 : 3.2 + 0.6 * Math.sin(i * 2.3);
    copa.push(
      new THREE.SphereGeometry(2.2 + 0.4 * Math.cos(i * 1.7), 12, 8)
        .scale(1, 0.32, 1)
        .translate(Math.cos(a) * r, 4.9 + 0.3 * Math.sin(i * 3.1), Math.sin(a) * r),
    );
  }
  grupo.add(new THREE.Mesh(juntar(copa), hojas));
  return grupo;
}

/** El arpa llanera: la columna, el clavijero curvo arriba, la caja de resonancia en diagonal y las cuerdas claras.
 * En el marco de su pie: la columna sube por +y. */
export function crearImagenArpa(madera: THREE.Material) {
  const grupo = new THREE.Group();
  const caja = new THREE.Vector3(0.75, 0.1, 0);
  const arriba = new THREE.Vector3(0.12, 1.25, 0);
  const largo = caja.distanceTo(arriba);
  const resonancia = new THREE.BoxGeometry(0.22, largo, 0.16)
    .translate(0, largo / 2, 0)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, arriba.clone().sub(caja).normalize()))
    .translate(caja.x, caja.y, caja.z);
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.CylinderGeometry(0.04, 0.05, 1.3, 8).translate(0, 0.65, 0),
        resonancia,
        new THREE.TorusGeometry(0.42, 0.04, 6, 16, Math.PI * 0.8).rotateZ(0.15).translate(0.36, 1.05, 0),
      ]),
      madera,
    ),
  );
  const cuerdas: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 9; i++) {
    const abajo = caja.clone().lerp(arriba, i / 9);
    const alto = 1.12 + 0.25 * Math.sin(Math.PI * (abajo.x / 0.8));
    cuerdas.push(
      new THREE.CylinderGeometry(0.005, 0.005, alto - abajo.y, 4).translate(abajo.x - 0.03, (alto + abajo.y) / 2, 0),
    );
  }
  grupo.add(
    new THREE.Mesh(
      juntar(cuerdas),
      new THREE.MeshStandardMaterial({ name: "cuerdas", color: COLORES.ojo, roughness: 0.4 }),
    ),
  );
  return grupo;
}

/** Un techo de palma a dos aguas, de `ancho` (x) por `fondo` (z), con la cumbrera a `alto`. En el marco del medio. */
export function crearImagenTecho(hojas: THREE.Material, ancho: number, fondo: number, alto: number) {
  const aguas = [-1, 1].map((lado) =>
    new THREE.BoxGeometry(ancho, 0.12, fondo / 2 + 0.3)
      .translate(0, 0, lado * (fondo / 4 + 0.1))
      .rotateX(lado * 0.5)
      .translate(0, alto, 0),
  );
  return new THREE.Mesh(juntar(aguas), hojas);
}
