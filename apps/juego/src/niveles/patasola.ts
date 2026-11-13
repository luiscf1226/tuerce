// La Patasola (TU-43): la mujer de una sola pata del monte del Eje cafetero, que anda brincando. Sale de un nodo
// `tipo: pieza, pieza: patasola`; su caja es su carril: corre a lo largo del lado más largo, de la punta − (la
// salida de la carrera) a la + (la meta), con la base de la caja en el suelo.
//
//   · Esperando en la salida, brinca en el lugar.
//   · Cuando alguno de los dos cruza la salida, arranca: brinco tras brinco llega a la meta en `tiempo` segundos,
//     siempre igual (por los pasos, sin azar). Si alguno llega antes, le ganaron (el guion da el logro).
//   · Después se devuelve brincando a la salida y espera a que los dos vuelvan a estar detrás de la línea para correr
//     otra vez.
//
// No choca con nada: no hay derrota, solo la carrera. Es un cuerpo cinemático que viaja en la foto de la red: el
// invitado la dibuja con el cuerpo tal como llega (lo alto que va dice cómo dobla la pata; lo que anda, el pelo).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import type { PiezaDeLaGarruchaEnPlano } from "./formato-garrucha";
import type { Herramientas } from "./piezas";

export type EstadoPatasola = "esperando" | "corriendo" | "volviendo";

export interface Patasola {
  readonly cual: "patasola";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  readonly estado: EstadoPatasola;
  /** Dónde va en su carril: 0 en la salida, 1 en la meta. */
  readonly avance: number;
  /** Lo alto que va sobre el suelo (m), también en el invitado. */
  readonly alto: number;
  /** Cuántas carreras corrió, cuántas le ganaron y cuántas ganó ella. */
  readonly carreras: number;
  readonly perdidas: number;
  readonly ganadas: number;
  /** Llama a `aviso` cuando le ganan, con quién llegó primero. Devuelve cómo dejar de escuchar. */
  alPerder(aviso: (jugador: 0 | 1) => void): () => void;
  /** Llama a `aviso` cuando gana ella. Devuelve cómo dejar de escuchar. */
  alGanar(aviso: () => void): () => void;
  /** En la salida, esperando (al retomar). */
  volver(): void;
}

/** Los números de La Patasola que no se ponen desde Blender. */
export const AJUSTES_PATASOLA = {
  /** Esperando, brinca en el lugar más despacio y más bajito: cada tanto (s) y qué parte del salto. */
  esperando: { brinco: 1.1, salto: 0.5 },
  /** Con qué velocidad se devuelve a la salida (m/s). */
  volver: 2.6,
  /** A cuánto de su carril, de costado, todavía cuenta que alguien pasó la salida o la meta (m). */
  banda: 4,
  /** Detrás de la salida, tanto más atrás, cuenta como haber vuelto (m). */
  detras: 0.3,
  /** Cuánto se agacha al caer (m). */
  agacharse: 0.16,
} as const;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

export function armarPatasola(h: Herramientas, p: Extract<PiezaDeLaGarruchaEnPlano, { cual: "patasola" }>): Patasola {
  const { rapier, mundo } = h;
  const a = AJUSTES_PATASOLA;
  const { centro, medio } = p.caja;
  const enX = medio.x >= medio.z;
  const giro = p.caja.giro
    .clone()
    .multiply(enX ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(ARRIBA, -Math.PI / 2));
  const mitad = enX ? medio.x : medio.z;
  const largo = EJE_X.clone().applyQuaternion(giro).setY(0).normalize();
  const base = centro.clone().addScaledVector(ARRIBA, -medio.y);
  const vuelta = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI));

  const salida = base.clone().addScaledVector(largo, -mitad);
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(salida.x, salida.y, salida.z).setRotation(giro),
  );
  // No choca con nada: está para `nivel.pieza(nombre)` y para que viaje en la foto
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(0.7, 0.25).setTranslation(0, 1.0, 0).setSensor(true).setCollisionGroups(0),
    cuerpo,
  );
  const imagen = crearImagenPatasola();
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  const giroInverso = giro.clone().invert();
  const local = new THREE.Vector3();
  /** El punto en el marco del carril: x a lo largo (0 en el medio), z de costado. */
  const enElCarril = (q: THREE.Vector3Like) =>
    local.set(q.x - centro.x, q.y - centro.y, q.z - centro.z).applyQuaternion(giroInverso);

  let estado: EstadoPatasola = "esperando";
  /** Dónde va a lo largo del carril (m, de −mitad a +mitad). */
  let x = -mitad;
  let t = 0;
  let fase = 0;
  let armada = true;
  let carreras = 0;
  let perdidas = 0;
  let ganadas = 0;
  const avisosPerder = new Set<(jugador: 0 | 1) => void>();
  const avisosGanar = new Set<() => void>();

  /** Dónde estaba cada uno en el paso anterior, a lo largo del carril: la carrera arranca al cruzar la salida (el que
   * aparece ya pasado, al retomar más adelante, no la arranca). */
  const antesDe: (number | undefined)[] = [undefined, undefined];
  h.antes((munecos) => {
    const dos = munecos.slice(0, 2).map((m, j) => {
      const l = enElCarril(m.partes.pelvis.translation());
      const antes = antesDe[j] ?? l.x;
      antesDe[j] = l.x;
      return { x: l.x, cerca: Math.abs(l.z) < a.banda, cruzo: antes < -mitad && l.x >= -mitad };
    });
    switch (estado) {
      case "esperando":
        // Vuelve a correr cuando los dos estén otra vez detrás de la salida
        if (!armada && dos.every((d) => d.x < -mitad - a.detras)) armada = true;
        if (armada && dos.some((d) => d.cerca && d.cruzo)) {
          estado = "corriendo";
          t = 0;
          fase = 0;
          armada = false;
          carreras++;
        }
        break;
      case "corriendo": {
        t += PASO;
        x = -mitad + 2 * mitad * Math.min(1, t / p.tiempo);
        const primero = dos.findIndex((d) => d.cerca && d.x >= mitad);
        if (primero >= 0) {
          perdidas++;
          estado = "volviendo";
          for (const aviso of avisosPerder) aviso(primero as 0 | 1);
        } else if (t >= p.tiempo) {
          ganadas++;
          estado = "volviendo";
          for (const aviso of avisosGanar) aviso();
        }
        break;
      }
      case "volviendo":
        x = Math.max(-mitad, x - a.volver * PASO);
        if (x <= -mitad) estado = "esperando";
        break;
    }
    // Los brincos: corriendo, de a `brinco` segundos; esperando, más lentos y más bajitos
    const brinco = estado === "esperando" ? a.esperando.brinco : p.brinco;
    fase = (fase + PASO / brinco) % 1;
    const salto = (estado === "esperando" ? a.esperando.salto : 1) * p.salto * Math.sin(Math.PI * fase);
    const donde = base.clone().addScaledVector(largo, x).addScaledVector(ARRIBA, salto);
    cuerpo.setNextKinematicTranslation(donde);
    cuerpo.setNextKinematicRotation(estado === "volviendo" ? vuelta : giro);
  });

  // Lo alto que va y lo rápido que anda, con el cuerpo tal como quedó (o como llegó en la foto)
  let alto = 0;
  let rapidez = 0;
  const antes = new THREE.Vector3().copy(cuerpo.translation());
  h.guardar(() => {
    const ahora = new THREE.Vector3().copy(cuerpo.translation());
    alto = Math.max(0, ahora.y - base.y);
    rapidez = Math.hypot(ahora.x - antes.x, ahora.z - antes.z) / PASO;
    antes.copy(ahora);
  });
  h.dibujar(() => imagen.posar(limitar(alto / Math.max(0.05, p.salto), 0, 1), rapidez));

  return {
    cual: "patasola",
    nombre: p.nombre,
    cuerpo,
    get estado() {
      return estado;
    },
    get avance() {
      return (x + mitad) / (2 * mitad);
    },
    get alto() {
      return alto;
    },
    get carreras() {
      return carreras;
    },
    get perdidas() {
      return perdidas;
    },
    get ganadas() {
      return ganadas;
    },
    alPerder(aviso) {
      avisosPerder.add(aviso);
      return () => {
        avisosPerder.delete(aviso);
      };
    },
    alGanar(aviso) {
      avisosGanar.add(aviso);
      return () => {
        avisosGanar.delete(aviso);
      };
    },
    volver() {
      estado = "esperando";
      x = -mitad;
      t = 0;
      fase = 0;
      armada = true;
      antesDe.fill(undefined);
      cuerpo.setTranslation(salida, true);
      cuerpo.setRotation(giro, true);
      cuerpo.setNextKinematicTranslation(salida);
      cuerpo.setNextKinematicRotation(giro);
    },
  };
}

/** La Patasola, mirando hacia +x, con la pezuña en y = 0: alta y flaca, el vestido en jirones hasta la rodilla, los
 * brazos largos con las uñas hacia adelante, la greña larguísima que le tapa la cara y le cae por la espalda, dos
 * ojos que brillan entre el pelo y una sola pata, con pezuña, que se dobla al caer de cada brinco. */
function crearImagenPatasola() {
  const a = AJUSTES_PATASOLA;
  const tela = materialTela(COLORES.siluetaHonda, { repetir: 2, relieve: 4 });
  const azar = crearAzar(43);
  const grupo = new THREE.Group();
  /** Todo lo de la cadera para arriba: baja al agacharse. */
  const arriba = new THREE.Group();
  grupo.add(arriba);
  const muslo = 0.45;
  const canilla = 0.45;
  const pezuna = 0.06;
  const cadera = muslo + canilla + pezuna;
  const partes: THREE.BufferGeometry[] = [];
  const capsula = (de: THREE.Vector3, hasta: THREE.Vector3, radio: number) => {
    const g = new THREE.CapsuleGeometry(radio, Math.max(0.001, de.distanceTo(hasta)), 4, 10);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(ARRIBA, hasta.clone().sub(de).normalize()));
    g.translate((de.x + hasta.x) / 2, (de.y + hasta.y) / 2, (de.z + hasta.z) / 2);
    return g;
  };
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  // El vestido: de la cintura a la rodilla, ancho abajo y en jirones
  partes.push(new THREE.CylinderGeometry(0.17, 0.36, 0.62, 12, 1, true).translate(0, cadera + 0.08, 0));
  for (let i = 0; i < 12; i++) {
    const angulo = (i / 12) * Math.PI * 2;
    const largo = 0.18 + azar() * 0.16;
    partes.push(
      new THREE.ConeGeometry(0.07, largo, 3)
        .rotateX(Math.PI)
        .translate(Math.cos(angulo) * 0.33, cadera - 0.23 - largo / 2, Math.sin(angulo) * 0.33),
    );
  }
  // El torso, flaco, encorvado hacia adelante, y los hombros
  partes.push(capsula(v(0, cadera + 0.35, 0), v(0.08, cadera + 0.75, 0), 0.15));
  partes.push(capsula(v(0.08, cadera + 0.72, -0.2), v(0.08, cadera + 0.72, 0.2), 0.07));
  // Los brazos largos, colgando hacia adelante, con las uñas
  for (const lado of [-1, 1]) {
    const hombro = v(0.08, cadera + 0.72, lado * 0.22);
    const codo = v(0.22, cadera + 0.35, lado * 0.27);
    const muneca = v(0.42, cadera + 0.05, lado * 0.24);
    partes.push(capsula(hombro, codo, 0.045), capsula(codo, muneca, 0.04));
    for (let k = 0; k < 4; k++)
      partes.push(capsula(muneca, muneca.clone().add(v(0.16, -0.06 - 0.02 * k, (k - 1.5) * 0.035)), 0.012));
  }
  // La cabeza y la greña: le tapa la cara y le cae por la espalda hasta las corvas
  const cabeza = v(0.14, cadera + 1.0, 0);
  partes.push(new THREE.SphereGeometry(0.15, 14, 10).scale(1, 1.15, 0.95).translate(cabeza.x, cabeza.y, cabeza.z));
  const pelo: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 34; i++) {
    const angulo = -Math.PI * 0.5 + (i / 33) * Math.PI * 1.9;
    const largo = 0.7 + azar() * 0.7;
    const r = 0.13;
    const raiz = cabeza.clone().add(v(Math.cos(angulo) * r * 0.6 - 0.02, 0.1, Math.sin(angulo) * r));
    pelo.push(
      new THREE.ConeGeometry(0.05, largo, 4).rotateX(Math.PI).translate(raiz.x - 0.02, raiz.y - largo / 2, raiz.z),
    );
  }
  // Los mechones de adelante, sobre la cara
  for (let i = 0; i < 6; i++)
    pelo.push(
      new THREE.ConeGeometry(0.035, 0.35, 3)
        .rotateX(Math.PI)
        .translate(cabeza.x + 0.13, cabeza.y - 0.1, (i - 2.5) * 0.04),
    );
  arriba.add(new THREE.Mesh(juntar(partes), tela));
  const mechas = new THREE.Mesh(juntar(pelo), tela);
  // La greña gira desde la coronilla: hacia atrás cuando corre
  const coronilla = new THREE.Group();
  coronilla.position.set(cabeza.x, cabeza.y + 0.1, 0);
  mechas.position.set(-cabeza.x, -cabeza.y - 0.1, 0);
  coronilla.add(mechas);
  arriba.add(coronilla);
  const ojos = new THREE.Mesh(
    juntar(
      [-1, 1].map((l) => new THREE.SphereGeometry(0.022, 8, 6).translate(cabeza.x + 0.145, cabeza.y + 0.02, l * 0.05)),
    ),
    materialOjo(),
  );
  arriba.add(ojos);

  // La pata: el muslo desde la cadera, la canilla y la pezuña. Se dobla en la rodilla (hacia adelante)
  const pata = new THREE.Group();
  pata.position.set(0, cadera, 0);
  pata.add(new THREE.Mesh(capsula(v(0, 0, 0), v(0, -muslo, 0), 0.075), tela));
  const rodilla = new THREE.Group();
  rodilla.position.set(0, -muslo, 0);
  rodilla.add(new THREE.Mesh(capsula(v(0, 0, 0), v(0, -canilla, 0), 0.055), tela));
  const casco = new THREE.Mesh(
    juntar([
      new THREE.CylinderGeometry(0.06, 0.075, pezuna, 8).translate(0.02, -canilla - pezuna / 2, 0),
      new THREE.BoxGeometry(0.02, pezuna, 0.1).translate(0.08, -canilla - pezuna / 2, 0),
    ]),
    materialTela(COLORES.silueta, { repetir: 1, pelusa: false }),
  );
  rodilla.add(casco);
  pata.add(rodilla);
  grupo.add(pata);

  return {
    grupo,
    /** `alto`: de 0 (en el suelo) a 1 (en lo alto del brinco); `rapidez`: lo que anda (m/s). */
    posar(alto: number, rapidez: number) {
      // Al caer se agacha: la cadera baja y la rodilla se dobla para que la pezuña siga en el suelo
      const agachada = a.agacharse * (1 - alto) ** 2;
      arriba.position.y = -agachada;
      const largoPata = muslo + canilla - agachada;
      const medio = Math.acos(limitar(largoPata / (muslo + canilla), -1, 1));
      pata.position.y = cadera - agachada;
      pata.rotation.z = medio;
      rodilla.rotation.z = -2 * medio;
      // En el aire la pata se va un poco hacia atrás
      pata.rotation.z -= 0.35 * alto;
      coronilla.rotation.z = -limitar(rapidez * 0.12, 0, 0.45);
      arriba.rotation.z = -0.08 * Math.min(1, rapidez / 1.5);
    },
  };
}
