// Las piezas de juego (TU-12): huacal, palanca, plancha de presión, balancín y bejuco. Cada una sale de un nodo
// `tipo: pieza` de la escena (formato.ts): su malla solo dice dónde va y cuánto mide, y acá se arma con cuerpos y
// juntas de Rapier y con la imagen del juego. La convención, para quien arma niveles, está en niveles/README.md.
//
//   huacal    una caja de tablas suelta: se empuja, se carga, se apila y hace de contrapeso
//   palanca   un brazo con bisagra en su base; en reposo se inclina hacia su frente y queda «activa» al llevarla
//             hacia atrás. Con `vuelve` un resorte la regresa al soltarla: algo pasa mientras alguien la sostiene
//   plancha   una placa con resorte sobre una base: se hunde con el peso (un muñeco, un huacal) y queda «pisada»
//   balancin  una tabla de tronco con bisagra sobre un poste: el peso de un lado sube el otro
//   bejuco    una cadena de segmentos que cuelga de su punta de arriba: se agarra, se columpia y se jala
//
// Cada paso, desde el nivel (nivel.ts):  antes()  →  muñecos y mundo.step()  →  despues()
// El estado que mira el guion (palanca activa, plancha pisada) se decide en `despues`, que en línea corre solo en
// el anfitrión; el invitado no simula y recibe los cuerpos en la foto (red/sincronia.ts).
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { crearTroncoCaido, juntar, materialCorteza, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import { GRAVEDAD, type Rapier } from "../motor/fisica";
import type { EntradaMuneco, Muneco } from "../muneco";
import type { Pieza } from "./armar";
import { armarCadejo, type Cadejo } from "./cadejo";
// El cafetal (TU-41)
import { armarCipitio, type Cipitio } from "./cipitio";
import { armarDuende, type Duende } from "./duende";
import type { PiezaDelPlano, TipoDePieza, Volumen } from "./formato";
// El puente (TU-45)
import { armarCarguera, type Carguera } from "./llama";
// Los canales (TU-42)
import { armarLlorona, type Llorona } from "./llorona";
import { armarMurcielagos, type Murcielagos } from "./murcielagos";
// La garrucha (TU-43)
import { armarPatasola, type Patasola } from "./patasola";
// El cafetal (TU-41)
import {
  armarCanasto,
  armarCostal,
  armarGuineo,
  armarPolea,
  armarZaranda,
  type Canasto,
  type Costal,
  type Guineo,
  type Polea,
  type Zaranda,
} from "./piezas-cafetal";
import {
  type Alfombra,
  armarAlfombra,
  armarCampana,
  armarCarreta,
  armarEngranaje,
  armarPesa,
  type Campana,
  type Carreta,
  type Engranaje,
  type Pesa,
} from "./piezas-calle";
import {
  armarChinampa,
  armarPinata,
  armarTrajinera,
  type Chinampa,
  type Pinata,
  type Trajinera,
} from "./piezas-canales";
import { armarChiva, armarGarrucha, armarPalma, type Chiva, type Garrucha, type Palma } from "./piezas-garrucha";
// El llano (TU-44)
import {
  armarGanado,
  armarHamaca,
  armarMolino,
  armarSaco,
  type Ganado,
  type Hamaca,
  type Molino,
  type Saco,
} from "./piezas-llano";
// La mina (TU-46)
import {
  armarEspejo,
  armarGrieta,
  armarOfrenda,
  armarVagoneta,
  armarVelas,
  type Espejo,
  type Grieta,
  type Ofrenda,
  type Vagoneta,
  type Velas,
} from "./piezas-mina";
import {
  armarHueso,
  armarLampara,
  armarTranca,
  armarTronco,
  type Hueso,
  type Lampara,
  type Tranca,
  type Tronco,
} from "./piezas-pinar";
// La poza (TU-24)
import {
  armarBalsa,
  armarBatea,
  armarPiedra,
  armarTendedero,
  type Balsa,
  type Batea,
  type Piedra,
  type Tendedero,
} from "./piezas-poza";
import {
  type Anden,
  armarAnden,
  armarBocatoma,
  armarChaka,
  armarQeswa,
  type Bocatoma,
  type Chaka,
  type Qeswa,
} from "./piezas-puente";
// El Río Plátano (TU-28)
import { armarPalmera, armarPipante, armarPuente, type Palmera, type Pipante, type Puente } from "./piezas-rio";
import {
  armarDresina,
  armarGrua,
  armarRacimo,
  armarSombrero,
  armarVagon,
  type Dresina,
  type Grua,
  type Racimo,
  type Sombrero,
  type Vagon,
} from "./piezas-tren";
// Las trenzas (TU-40)
import {
  armarBalde,
  armarBrasa,
  armarMula,
  armarNudo,
  armarSombrerote,
  type Balde,
  type Brasa,
  type Mula,
  type Nudo,
  type Sombrerote,
} from "./piezas-trenzas";
import {
  type Antorcha,
  armarAntorcha,
  armarBloque,
  armarDoble,
  armarEstela,
  armarGuacamayas,
  armarLlave,
  armarPelota,
  type Bloque,
  type Doble,
  type Estela,
  type Guacamayas,
  type Llave,
  type Pelota,
} from "./piezas-xibalba";
import { armarSilbon, type Silbon } from "./silbon";
import { armarSinBueyes, type SinBueyes } from "./sin-bueyes";
import { armarSisimite, type Sisimite } from "./sisimite";
import { armarSombreron, type Sombreron } from "./sombreron";
import { armarSucia, type Sucia } from "./sucia";
import { armarTio, type Tio } from "./tio";

/** Los segmentos del bejuco no empujan ni son empujados por nada (grupos del resolvedor sin filtro): los muñecos
 * lo atraviesan pero lo agarran igual, porque la mano lo busca con una consulta, que mira los grupos de choque. Si
 * chocara, la cabeza lo empujaría antes de que llegaran las manos, y su choque grueso contra la rama hace explotar la
 * cadena (NaN). Los grupos de choque solo ahorran pares: ni entre ellos (se pisan en las juntas) ni con los muñecos
 * (bits 1 y 2, ver muneco.ts). */
const BIT_BEJUCO = 1 << 4;
const GRUPOS_BEJUCO = ((BIT_BEJUCO << 16) | (0xffff & ~(BIT_BEJUCO | 0b110))) >>> 0;
const SIN_EMPUJAR = (BIT_BEJUCO << 16) >>> 0;

/** Los números de las piezas que no se ponen desde Blender. */
export const AJUSTES_PIEZAS = {
  palanca: {
    /** La base fija donde va la bisagra: a lo sumo este alto (m). */
    base: 0.15,
    /** Con `vuelve`, la fuerza en la manija para llevarla del todo al otro lado (N). Más el peso del brazo. */
    fuerza: 25,
    /** Rozamiento en la bisagra sin `vuelve`, para que no rebote (N·m·s/rad). */
    rozamiento: 2,
    /** Deja de estar activa al volver esta fracción por debajo del umbral (para que no parpadee). */
    histeresis: 0.1,
  },
  plancha: {
    /** La placa, liviana: el resorte se calcula con su peso (kg). */
    masa: 2,
    /** Lo que se mete la base hacia adentro, para que se vea el borde de la placa (m). */
    margen: 0.04,
    /** Cuánto empuja de más el resorte con la placa vacía, en fracciones de `hundir`. */
    precarga: 0.1,
    /** Hundida más que esto, queda pisada; menos que `soltar`, deja de estarlo. */
    pisar: 0.5,
    soltar: 0.3,
  },
  balancin: {
    /** El poste: su ancho a lo largo de la tabla, hasta dónde baja y el hueco hasta la tabla (m). */
    poste: { ancho: 0.16, alto: 3, hueco: 0.06 },
    /** Rozamiento en la bisagra (N·m·s/rad). */
    rozamiento: 6,
  },
  bejuco: {
    /** Grosor del choque y de la imagen (m). El choque es mucho más grueso que la imagen: las manos del muñeco van
     * separadas 42 cm, y las dos lo tienen que encontrar al saltarle de frente. */
    radio: 0.15,
    radioImagen: 0.032,
    amortiguacion: { lineal: 0.05, angular: 0.4 },
    /** Columpiarse: colgado y apretando adelante o atrás, el muñeco se impulsa hacia donde mira (m/s²). */
    impulso: 3.5,
  },
} as const;

export interface Huacal {
  readonly cual: "huacal";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Lo pone donde estaba al empezar, quieto. Pasa solo si se cae al vacío. */
  volver(): void;
}

/** Algo que se prende y se apaga (palanca activa, plancha pisada): el guion lo lee o se entera al cambiar. */
interface ConAviso {
  /** Llama a `aviso` cada vez que cambia (en el paso en que cambió). Devuelve cómo dejar de escuchar. */
  alCambiar(aviso: (prendida: boolean) => void): () => void;
}

export interface Palanca extends ConAviso {
  readonly cual: "palanca";
  readonly nombre: string;
  readonly brazo: RAPIER.RigidBody;
  /** Cuánto se la llevó desde el reposo: 0 inclinada hacia su frente, 1 del todo hacia atrás. */
  readonly recorrido: number;
  /** Si se la llevó más allá de su `umbral`. */
  readonly activa: boolean;
}

export interface Plancha extends ConAviso {
  readonly cual: "plancha";
  readonly nombre: string;
  readonly placa: RAPIER.RigidBody;
  /** Cuánto se hundió: 0 arriba, 1 del todo. */
  readonly hundida: number;
  /** Si hay peso encima (hundida más de la mitad). */
  readonly pisada: boolean;
}

export interface Balancin {
  readonly cual: "balancin";
  readonly nombre: string;
  readonly tabla: RAPIER.RigidBody;
  /** Radianes: positivo si baja el extremo hacia el +x de la caja (o hacia su +z de glTF, el −y de Blender, si es
   * más larga en ese sentido); negativo si baja el otro. */
  readonly inclinacion: number;
}

export interface Bejuco {
  readonly cual: "bejuco";
  readonly nombre: string;
  /** Los segmentos, de arriba abajo. */
  readonly segmentos: readonly RAPIER.RigidBody[];
  /** Cuántos muñecos cuelgan de él (agarrados y en el aire). */
  readonly colgados: number;
}

export interface PiezaPorTipo {
  huacal: Huacal;
  palanca: Palanca;
  plancha: Plancha;
  balancin: Balancin;
  bejuco: Bejuco;
  // Las del pinar (TU-14): piezas-pinar.ts y cadejo.ts
  tronco: Tronco;
  tranca: Tranca;
  hueso: Hueso;
  lampara: Lampara;
  cadejo: Cadejo;
  // Las de la poza (TU-24): piezas-poza.ts y sucia.ts
  balsa: Balsa;
  tendedero: Tendedero;
  batea: Batea;
  piedra: Piedra;
  sucia: Sucia;
  // Las de Xibalbá (TU-26): piezas-xibalba.ts y murcielagos.ts
  bloque: Bloque;
  doble: Doble;
  estela: Estela;
  pelota: Pelota;
  antorcha: Antorcha;
  llave: Llave;
  murcielagos: Murcielagos;
  guacamayas: Guacamayas;
  // Las del tren bananero (TU-27): piezas-tren.ts y duende.ts
  vagon: Vagon;
  dresina: Dresina;
  grua: Grua;
  racimo: Racimo;
  sombrero: Sombrero;
  duende: Duende;
  // Las de La calle empedrada (TU-25): piezas-calle.ts y sin-bueyes.ts
  carreta: Carreta;
  "sin-bueyes": SinBueyes;
  pesa: Pesa;
  engranaje: Engranaje;
  campana: Campana;
  alfombra: Alfombra;
  // Las del Río Plátano (TU-28): piezas-rio.ts y sisimite.ts
  pipante: Pipante;
  puente: Puente;
  palmera: Palmera;
  sisimite: Sisimite;
  // Los canales (TU-42): piezas-canales.ts y llorona.ts
  trajinera: Trajinera;
  chinampa: Chinampa;
  pinata: Pinata;
  llorona: Llorona;
  // Las de El llano (TU-44): piezas-llano.ts y silbon.ts
  silbon: Silbon;
  molino: Molino;
  ganado: Ganado;
  hamaca: Hamaca;
  saco: Saco;
  // La garrucha (TU-43): piezas-garrucha.ts y patasola.ts
  garrucha: Garrucha;
  chiva: Chiva;
  palma: Palma;
  patasola: Patasola;
  // Las trenzas (TU-40): piezas-trenzas.ts y sombreron.ts
  nudo: Nudo;
  mula: Mula;
  balde: Balde;
  brasa: Brasa;
  sombreron: Sombreron;
  sombrerote: Sombrerote;
  // El cafetal (TU-41): piezas-cafetal.ts y cipitio.ts
  canasto: Canasto;
  zaranda: Zaranda;
  polea: Polea;
  costal: Costal;
  guineo: Guineo;
  cipitio: Cipitio;
  // El puente (TU-45): piezas-puente.ts y llama.ts
  qeswa: Qeswa;
  chaka: Chaka;
  bocatoma: Bocatoma;
  anden: Anden;
  carguera: Carguera;
  // La mina (TU-46): piezas-mina.ts y tio.ts
  vagoneta: Vagoneta;
  espejo: Espejo;
  grieta: Grieta;
  ofrenda: Ofrenda;
  velas: Velas;
  tio: Tio;
}
export type PiezaDeJuego = PiezaPorTipo[TipoDePieza];

export interface PiezasDeJuego {
  readonly lista: readonly PiezaDeJuego[];
  /** El cuerpo principal de cada pieza, para `nivel.pieza(nombre)`: el huacal, el brazo de la palanca, la placa, la
   * tabla y el primer segmento del bejuco. */
  readonly solidas: readonly Pieza[];
  /** La pieza de esa clase con ese nombre, o `undefined`. */
  buscar<C extends TipoDePieza>(cual: C, nombre: string): PiezaPorTipo[C] | undefined;
  /** Antes de los muñecos y de `mundo.step()`: columpiarse en los bejucos. */
  antes(munecos: readonly Muneco[], entradas?: readonly EntradaMuneco[]): void;
  /** Después de `mundo.step()`: el estado de palancas y planchas (con sus avisos) y los huacales que cayeron
   * (`fuera` dice si un punto quedó en el vacío) vuelven a su lugar. */
  despues(munecos: readonly Muneco[], fuera: (p: THREE.Vector3Like) => boolean): void;
  /** Anota dónde quedó cada cuerpo. Va después de cada `mundo.step()` (y en línea, después de ubicarlos). */
  guardar(): void;
  /** Mueve la imagen entre el paso anterior y el actual (`alfa` de 0 a 1). */
  dibujar(alfa: number): void;
}

/** Lo que necesitan las piezas que se arman en otros archivos (las del pinar): el mundo, la escena y cómo
 * engancharse en cada momento del paso. */
export interface Herramientas {
  readonly rapier: Rapier;
  readonly mundo: RAPIER.World;
  readonly escena: THREE.Scene;
  readonly madera: THREE.Material;
  readonly oscuro: THREE.Material;
  /** Todas las piezas del nivel (se llena mientras se arman): el Cadejo busca ahí los huesos. */
  readonly lista: readonly PiezaDeJuego[];
  /** Pone la imagen en la escena y la hace seguir al cuerpo, interpolando entre pasos. */
  mover(cuerpo: RAPIER.RigidBody, objeto: THREE.Object3D): void;
  /** Un cuerpo fijo en ese lugar. */
  fijo(posicion: THREE.Vector3, giro: THREE.Quaternion): RAPIER.RigidBody;
  /** La descripción de un cuerpo dinámico en ese lugar. */
  dinamico(posicion: THREE.Vector3, giro: THREE.Quaternion): RAPIER.RigidBodyDesc;
  /** Un punto de la caja (en su marco) llevado al mundo. */
  enElMundo(p: { readonly caja: Volumen }, x: number, y: number, z: number): THREE.Vector3;
  /** El cuerpo principal de la pieza, para `nivel.pieza(nombre)`. */
  solida(pieza: Pieza): void;
  antes(f: (munecos: readonly Muneco[], entradas?: readonly EntradaMuneco[]) => void): void;
  despues(f: (munecos: readonly Muneco[], fuera: (p: THREE.Vector3Like) => boolean) => void): void;
  /** Después de anotar dónde quedó cada cuerpo, en cada paso (también en el invitado, que no simula). */
  guardar(f: () => void): void;
  /** Después de mover las imágenes: para animar (las patas del Cadejo, la luz de la lámpara). */
  dibujar(f: (alfa: number) => void): void;
}

/** Un cuerpo que se mueve y su imagen, que lo sigue interpolando entre pasos. */
interface Movil {
  readonly cuerpo: RAPIER.RigidBody;
  readonly objeto: THREE.Object3D;
  readonly antes: THREE.Vector3;
  readonly ahora: THREE.Vector3;
  readonly antesQ: THREE.Quaternion;
  readonly ahoraQ: THREE.Quaternion;
}

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const vector = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z });
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Un interruptor con histéresis y sus avisos. */
export function crearInterruptor() {
  let prendido = false;
  const avisos = new Set<(prendida: boolean) => void>();
  return {
    get prendido() {
      return prendido;
    },
    /** Prende pasado `prender`, apaga por debajo de `apagar`; avisa si cambió. */
    poner(valor: number, prender: number, apagar: number) {
      const nuevo = prendido ? valor >= apagar : valor >= prender;
      if (nuevo === prendido) return;
      prendido = nuevo;
      for (const aviso of avisos) aviso(nuevo);
    },
    alCambiar(aviso: (prendida: boolean) => void) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
}

/** El ángulo (radianes) que giró `q` respecto de `base` alrededor de `eje` (en el marco de `base`). */
function anguloRelativo(base: THREE.Quaternion, q: RAPIER.Rotation, eje: THREE.Vector3): number {
  const r = base
    .clone()
    .invert()
    .multiply(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  const s = r.x * eje.x + r.y * eje.y + r.z * eje.z;
  return 2 * Math.atan2(r.w < 0 ? -s : s, Math.abs(r.w));
}

/** La geometría de un huacal: postes en las esquinas, tablas con luz entre ellas en los costados y un fondo. */
function geometriaHuacal(medio: THREE.Vector3): THREE.BufferGeometry {
  const [w, h, d] = [medio.x * 2, medio.y * 2, medio.z * 2];
  const poste = Math.min(w, d) * 0.1;
  const tabla = Math.min(w, d) * 0.04;
  const altoTabla = h * 0.2;
  const partes: THREE.BufferGeometry[] = [];
  const caja = (x: number, y: number, z: number, ancho: number, alto: number, fondo: number) =>
    partes.push(new THREE.BoxGeometry(ancho, alto, fondo).translate(x, y, z));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) caja((sx * (w - poste)) / 2, 0, (sz * (d - poste)) / 2, poste, h, poste);
  for (const y of [-(h - altoTabla) / 2, 0, (h - altoTabla) / 2]) {
    for (const s of [-1, 1]) {
      caja(0, y, (s * (d - tabla)) / 2, w - poste, altoTabla, tabla);
      caja((s * (w - tabla)) / 2, y, 0, tabla, altoTabla, d - poste);
    }
  }
  caja(0, -(h - tabla) / 2, 0, w - poste, tabla, d - poste);
  return juntar(partes);
}

export function armarPiezas(
  rapier: Rapier,
  mundo: RAPIER.World,
  escena: THREE.Scene,
  plano: readonly PiezaDelPlano[],
): PiezasDeJuego {
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 1] });
  const oscuro = materialTela(COLORES.siluetaHonda, { repetir: 2, pelusa: false });
  const moviles: Movil[] = [];
  const lista: PiezaDeJuego[] = [];
  const solidas: Pieza[] = [];
  /** Lo que hace cada pieza en `antes` y en `despues`. */
  const antesDe: ((munecos: readonly Muneco[], entradas?: readonly EntradaMuneco[]) => void)[] = [];
  const despuesDe: ((munecos: readonly Muneco[], fuera: (p: THREE.Vector3Like) => boolean) => void)[] = [];
  const guardarDe: (() => void)[] = [];
  const dibujarDe: ((alfa: number) => void)[] = [];

  const mover = (cuerpo: RAPIER.RigidBody, objeto: THREE.Object3D) => {
    const p = new THREE.Vector3().copy(cuerpo.translation());
    const q = new THREE.Quaternion().copy(cuerpo.rotation());
    objeto.position.copy(p);
    objeto.quaternion.copy(q);
    escena.add(objeto);
    moviles.push({ cuerpo, objeto, antes: p.clone(), ahora: p, antesQ: q.clone(), ahoraQ: q });
  };
  const fijo = (posicion: THREE.Vector3, giro: THREE.Quaternion) =>
    mundo.createRigidBody(
      rapier.RigidBodyDesc.fixed().setTranslation(posicion.x, posicion.y, posicion.z).setRotation(giro),
    );
  const dinamico = (posicion: THREE.Vector3, giro: THREE.Quaternion) =>
    rapier.RigidBodyDesc.dynamic().setTranslation(posicion.x, posicion.y, posicion.z).setRotation(giro);
  /** Un punto de la caja (en su marco) llevado al mundo. */
  const enElMundo = (p: { readonly caja: Volumen }, x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyQuaternion(p.caja.giro).add(p.caja.centro);

  const armarHuacal = (p: Extract<PiezaDelPlano, { cual: "huacal" }>): Huacal => {
    const { centro, medio, giro } = p.caja;
    const cuerpo = mundo.createRigidBody(dinamico(centro, giro));
    const colisionador = mundo.createCollider(
      rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setMass(p.masa).setFriction(p.rozamiento),
      cuerpo,
    );
    const objeto = new THREE.Mesh(geometriaHuacal(medio), madera);
    objeto.name = p.nombre;
    mover(cuerpo, objeto);
    solidas.push({ nombre: p.nombre, objeto, cuerpo, colisionador });
    const cero = { x: 0, y: 0, z: 0 };
    const huacal: Huacal = {
      cual: "huacal",
      nombre: p.nombre,
      cuerpo,
      volver() {
        cuerpo.setTranslation(vector(centro), true);
        cuerpo.setRotation(giro, true);
        cuerpo.setLinvel(cero, true);
        cuerpo.setAngvel(cero, true);
      },
    };
    despuesDe.push((_, fuera) => {
      if (fuera(cuerpo.translation())) huacal.volver();
    });
    return huacal;
  };

  const armarPalanca = (p: Extract<PiezaDelPlano, { cual: "palanca" }>): Palanca => {
    const a = AJUSTES_PIEZAS.palanca;
    const { medio, giro } = p.caja;
    const altoBase = Math.min(a.base, medio.y * 0.3);
    const largo = medio.y * 2 - altoBase;
    const radio = limitar(medio.z * 0.25, 0.03, 0.06);
    // La manija es un travesaño a lo ancho de la caja (sobre el eje de la bisagra): las dos manos del muñeco van
    // separadas, así que tiene que poder agarrarla cada una de su lado
    const manija = { radio: radio * 1.1, medioLargo: Math.max(radio, medio.x - radio) };
    // La bisagra arriba de la base, con su cuerpo fijo; la base cuelga de ese mismo cuerpo
    const pie = enElMundo(p, 0, -medio.y + altoBase, 0);
    const ancla = fijo(pie, giro);
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(medio.x, altoBase / 2, medio.z).setTranslation(0, -altoBase / 2, 0),
      ancla,
    );
    // En reposo se inclina hacia su frente (+z): girar sobre x lleva +y hacia +z
    const reposo = p.angulo;
    const giroBrazo = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, reposo));
    const centroBrazo = new THREE.Vector3(0, largo / 2, 0).applyQuaternion(giroBrazo).add(pie);
    const brazo = mundo.createRigidBody(dinamico(centroBrazo, giroBrazo).setAngularDamping(0.5));
    const colisionador = mundo.createCollider(
      rapier.ColliderDesc.capsule(largo / 2 - radio, radio)
        .setMass(p.masa * 0.7)
        .setFriction(0.9),
      brazo,
    );
    const travesano = new THREE.Quaternion().setFromAxisAngle(EJE_Z, Math.PI / 2);
    mundo.createCollider(
      rapier.ColliderDesc.capsule(manija.medioLargo, manija.radio)
        .setTranslation(0, largo / 2 - manija.radio, 0)
        .setRotation(travesano)
        .setMass(p.masa * 0.3)
        .setFriction(0.9),
      brazo,
    );
    const datos = rapier.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: -largo / 2, z: 0 }, EJE_X);
    const junta = mundo.createImpulseJoint(datos, ancla, brazo, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.RevoluteImpulseJoint) {
      // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
      junta.setLimits(-p.angulo, p.angulo);
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      if (p.vuelve) {
        // El resorte lleva el brazo al reposo: del todo al otro lado hace falta `fuerza` en la manija, más lo que
        // pesa el brazo inclinado
        const peso = p.masa * -GRAVEDAD * (largo / 2) * Math.sin(p.angulo);
        const rigidez = (a.fuerza * largo + peso) / (2 * p.angulo);
        const inercia = (p.masa * largo * largo) / 3;
        junta.configureMotorPosition(reposo, rigidez, 2 * 0.8 * Math.sqrt(rigidez * inercia));
      } else junta.configureMotorVelocity(0, a.rozamiento);
    }

    const imagenBrazo = new THREE.Group();
    imagenBrazo.name = p.nombre;
    const vara = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.8, radio, largo, 10), madera);
    const imagenManija = new THREE.Mesh(new THREE.CapsuleGeometry(manija.radio, manija.medioLargo * 2, 4, 10), oscuro);
    imagenManija.position.y = largo / 2 - manija.radio;
    imagenManija.quaternion.copy(travesano);
    imagenBrazo.add(vara, imagenManija);
    mover(brazo, imagenBrazo);
    const imagenBase = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, altoBase, medio.z * 2), oscuro);
    imagenBase.position.copy(enElMundo(p, 0, -medio.y + altoBase / 2, 0));
    imagenBase.quaternion.copy(giro);
    escena.add(imagenBase);
    solidas.push({ nombre: p.nombre, objeto: imagenBrazo, cuerpo: brazo, colisionador });

    const interruptor = crearInterruptor();
    let recorrido = 0;
    despuesDe.push(() => {
      recorrido = limitar((reposo - anguloRelativo(giro, brazo.rotation(), EJE_X)) / (2 * p.angulo), 0, 1);
      interruptor.poner(recorrido, p.umbral, p.umbral - a.histeresis);
    });
    return {
      cual: "palanca",
      nombre: p.nombre,
      brazo,
      get recorrido() {
        return recorrido;
      },
      get activa() {
        return interruptor.prendido;
      },
      alCambiar: interruptor.alCambiar,
    };
  };

  const armarPlancha = (p: Extract<PiezaDelPlano, { cual: "plancha" }>): Plancha => {
    const a = AJUSTES_PIEZAS.plancha;
    const { medio, giro } = p.caja;
    const altoPlaca = medio.y * 2 - p.hundir;
    // La placa arriba y la base debajo, de `hundir` de alto: la placa baja hasta apoyarse en ella
    const reposo = enElMundo(p, 0, -medio.y + p.hundir + altoPlaca / 2, 0);
    const ancla = fijo(reposo, giro);
    const base = { x: Math.max(0.01, medio.x - a.margen), z: Math.max(0.01, medio.z - a.margen) };
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(base.x, p.hundir / 2, base.z).setTranslation(0, -altoPlaca / 2 - p.hundir / 2, 0),
      ancla,
    );
    const placa = mundo.createRigidBody(dinamico(reposo, giro));
    const colisionador = mundo.createCollider(
      rapier.ColliderDesc.cuboid(medio.x, altoPlaca / 2, medio.z)
        .setMass(a.masa)
        .setFriction(0.9),
      placa,
    );
    const datos = rapier.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, ARRIBA);
    datos.limitsEnabled = true;
    datos.limits = [-p.hundir, 0];
    const junta = mundo.createImpulseJoint(datos, ancla, placa, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.PrismaticImpulseJoint) {
      // Un resorte que la sostiene arriba con su propio peso y la hunde del todo con `peso` kilos encima
      const rigidez = (p.peso * -GRAVEDAD) / p.hundir;
      const objetivo = (a.masa * -GRAVEDAD) / rigidez + a.precarga * p.hundir;
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorPosition(objetivo, rigidez, 2 * 0.7 * Math.sqrt(rigidez * (a.masa + p.peso)));
    }

    const imagenPlaca = new THREE.Mesh(new THREE.BoxGeometry(medio.x * 2, altoPlaca, medio.z * 2), madera);
    imagenPlaca.name = p.nombre;
    mover(placa, imagenPlaca);
    const imagenBase = new THREE.Mesh(new THREE.BoxGeometry(base.x * 2, p.hundir, base.z * 2), oscuro);
    imagenBase.position.copy(enElMundo(p, 0, -medio.y + p.hundir / 2, 0));
    imagenBase.quaternion.copy(giro);
    escena.add(imagenBase);
    solidas.push({ nombre: p.nombre, objeto: imagenPlaca, cuerpo: placa, colisionador });

    const interruptor = crearInterruptor();
    const arriba = ARRIBA.clone().applyQuaternion(giro);
    let hundida = 0;
    despuesDe.push(() => {
      const t = placa.translation();
      const bajo = (reposo.x - t.x) * arriba.x + (reposo.y - t.y) * arriba.y + (reposo.z - t.z) * arriba.z;
      hundida = limitar(bajo / p.hundir, 0, 1);
      interruptor.poner(hundida, a.pisar, a.soltar);
    });
    return {
      cual: "plancha",
      nombre: p.nombre,
      placa,
      get hundida() {
        return hundida;
      },
      get pisada() {
        return interruptor.prendido;
      },
      alCambiar: interruptor.alCambiar,
    };
  };

  const armarBalancin = (p: Extract<PiezaDelPlano, { cual: "balancin" }>): Balancin => {
    const a = AJUSTES_PIEZAS.balancin;
    const { centro, medio, giro } = p.caja;
    // Va a lo largo de su lado más largo y gira sobre el otro
    const enX = medio.x >= medio.z;
    const largo = enX ? EJE_X : EJE_Z;
    const ejeGiro = enX ? EJE_Z : EJE_X;
    const mitad = enX ? medio.x : medio.z;
    const ancho = enX ? medio.z : medio.x;
    const apoyo = largo.clone().multiplyScalar((p.apoyo - 0.5) * 2 * mitad);
    const pivote = apoyo.clone().applyQuaternion(giro).add(centro);
    const ancla = fijo(pivote, giro);
    // El poste, debajo del eje, con un hueco para que la tabla gire sin rozarlo
    const medioPoste = { largo: a.poste.ancho / 2, alto: a.poste.alto / 2 };
    const [px, pz] = enX ? [medioPoste.largo, ancho] : [ancho, medioPoste.largo];
    mundo.createCollider(
      rapier.ColliderDesc.cuboid(px, medioPoste.alto, pz).setTranslation(
        0,
        -medio.y - a.poste.hueco - medioPoste.alto,
        0,
      ),
      ancla,
    );
    const tabla = mundo.createRigidBody(dinamico(centro, giro).setAngularDamping(0.3));
    const colisionador = mundo.createCollider(
      rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z).setMass(p.masa).setFriction(0.9),
      tabla,
    );
    const datos = rapier.JointData.revolute({ x: 0, y: 0, z: 0 }, vector(apoyo), ejeGiro);
    const junta = mundo.createImpulseJoint(datos, ancla, tabla, true);
    junta.setContactsEnabled(false);
    if (junta instanceof rapier.RevoluteImpulseJoint) {
      // En una bisagra, Rapier ignora los topes de JointData: van después de crearla
      junta.setLimits(-p.angulo, p.angulo);
      junta.configureMotorModel(rapier.MotorModel.ForceBased);
      junta.configureMotorVelocity(0, a.rozamiento);
    }

    // La imagen: un tronco acostado, aplastado a lo ancho de la caja, y el poste que se pierde hacia abajo
    const tronco = crearTroncoCaido({ largo: mitad * 2, radio: medio.y, semilla: 7, musgo: Math.round(mitad * 4) });
    tronco.scale.z = ancho / medio.y;
    const imagenTabla = new THREE.Group();
    imagenTabla.name = p.nombre;
    if (!enX) tronco.rotation.y = -Math.PI / 2;
    imagenTabla.add(tronco);
    mover(tabla, imagenTabla);
    const imagenPoste = new THREE.Mesh(
      new THREE.CylinderGeometry(a.poste.ancho * 0.45, a.poste.ancho * 0.7, a.poste.alto, 10),
      madera,
    );
    imagenPoste.position.copy(pivote).addScaledVector(ARRIBA, -medio.y - a.poste.alto / 2);
    escena.add(imagenPoste);
    solidas.push({ nombre: p.nombre, objeto: imagenTabla, cuerpo: tabla, colisionador });

    const direccion = new THREE.Vector3();
    const giroInverso = giro.clone().invert();
    return {
      cual: "balancin",
      nombre: p.nombre,
      tabla,
      get inclinacion() {
        direccion
          .copy(largo)
          .applyQuaternion(new THREE.Quaternion().copy(tabla.rotation()))
          .applyQuaternion(giroInverso);
        return Math.asin(limitar(-direccion.y, -1, 1));
      },
    };
  };

  const armarBejuco = (p: Extract<PiezaDelPlano, { cual: "bejuco" }>): Bejuco => {
    const a = AJUSTES_PIEZAS.bejuco;
    const { medio } = p.caja;
    const punta = enElMundo(p, 0, medio.y, 0);
    const tramo = (medio.y * 2) / p.segmentos;
    const recto = new THREE.Quaternion();
    // Una cadena de juntas de varios cuerpos (multibody): no se estira aunque cuelgue un muñeco mucho más pesado
    let padre = fijo(punta, recto);
    let anclaPadre = { x: 0, y: 0, z: 0 };
    const segmentos: RAPIER.RigidBody[] = [];
    /** El primer segmento, para `nivel.pieza(nombre)`. */
    let primero: Pieza | undefined;
    const geometria = new THREE.CylinderGeometry(a.radioImagen, a.radioImagen, tramo + a.radioImagen * 2, 7);
    const hoja = new THREE.ConeGeometry(0.05, 0.16, 4).rotateZ(Math.PI / 2.6);
    for (let i = 0; i < p.segmentos; i++) {
      const posicion = punta.clone().addScaledVector(ARRIBA, -tramo * (i + 0.5));
      const cuerpo = mundo.createRigidBody(
        dinamico(posicion, recto).setLinearDamping(a.amortiguacion.lineal).setAngularDamping(a.amortiguacion.angular),
      );
      const colisionador = mundo.createCollider(
        rapier.ColliderDesc.capsule(Math.max(0.005, tramo / 2 - a.radio), a.radio)
          .setMass(p.masa / p.segmentos)
          .setCollisionGroups(GRUPOS_BEJUCO)
          .setSolverGroups(SIN_EMPUJAR),
        cuerpo,
      );
      mundo.createMultibodyJoint(
        rapier.JointData.spherical(anclaPadre, { x: 0, y: tramo / 2, z: 0 }),
        padre,
        cuerpo,
        true,
      );
      padre = cuerpo;
      anclaPadre = { x: 0, y: -tramo / 2, z: 0 };
      segmentos.push(cuerpo);
      const imagen = new THREE.Group();
      imagen.add(new THREE.Mesh(geometria, madera));
      // Una hoja cada tanto, para que se lea como planta y no como soga
      if (i % 2 === 1) {
        const h = new THREE.Mesh(hoja, oscuro);
        h.rotation.y = i * 2.4;
        h.position.set(0.05 * Math.cos(i * 2.4), 0, -0.05 * Math.sin(i * 2.4));
        imagen.add(h);
      }
      mover(cuerpo, imagen);
      primero ??= { nombre: p.nombre, objeto: imagen, cuerpo, colisionador };
    }
    if (primero) solidas.push(primero);

    const propios = new Set(segmentos.map((s) => s.handle));
    /** Si ese muñeco tiene agarrado algún segmento. */
    const agarra = (m: Muneco) =>
      (["brazoIzquierdo", "brazoDerecho"] as const).some((b) => {
        const c = m.agarrado(b)?.parent();
        return c ? propios.has(c.handle) : false;
      });
    let colgados = 0;
    antesDe.push((munecos, entradas) => {
      // Columpiarse: colgado, apretar adelante o atrás lo impulsa hacia donde mira; a tiempo, la hamaca crece
      munecos.forEach((m, i) => {
        const avanzar = limitar(entradas?.[i]?.avanzar ?? 0, -1, 1);
        if (avanzar === 0 || m.estado === "de pie" || m.enElSuelo || !agarra(m)) return;
        const impulso = avanzar * a.impulso * m.masa * PASO;
        m.partes.pelvis.applyImpulse({ x: Math.sin(m.rumbo) * impulso, y: 0, z: Math.cos(m.rumbo) * impulso }, true);
      });
    });
    despuesDe.push((munecos) => {
      colgados = munecos.filter((m) => !m.enElSuelo && agarra(m)).length;
    });
    return {
      cual: "bejuco",
      nombre: p.nombre,
      segmentos,
      get colgados() {
        return colgados;
      },
    };
  };

  const herramientas: Herramientas = {
    rapier,
    mundo,
    escena,
    madera,
    oscuro,
    lista,
    mover,
    fijo,
    dinamico,
    enElMundo,
    solida: (pieza) => solidas.push(pieza),
    antes: (f) => antesDe.push(f),
    despues: (f) => despuesDe.push(f),
    guardar: (f) => guardarDe.push(f),
    dibujar: (f) => dibujarDe.push(f),
  };

  for (const p of plano) {
    // El nodo de Blender no se dibuja: la imagen de cada pieza la arma el juego
    p.objeto.visible = false;
    switch (p.cual) {
      case "huacal":
        lista.push(armarHuacal(p));
        break;
      case "palanca":
        lista.push(armarPalanca(p));
        break;
      case "plancha":
        lista.push(armarPlancha(p));
        break;
      case "balancin":
        lista.push(armarBalancin(p));
        break;
      case "bejuco":
        lista.push(armarBejuco(p));
        break;
      case "tronco":
        lista.push(armarTronco(herramientas, p));
        break;
      case "tranca":
        lista.push(armarTranca(herramientas, p));
        break;
      case "hueso":
        lista.push(armarHueso(herramientas, p));
        break;
      case "lampara":
        lista.push(armarLampara(herramientas, p));
        break;
      case "cadejo":
        lista.push(armarCadejo(herramientas, p));
        break;
      case "balsa":
        lista.push(armarBalsa(herramientas, p));
        break;
      case "tendedero":
        lista.push(armarTendedero(herramientas, p));
        break;
      case "batea":
        lista.push(armarBatea(herramientas, p));
        break;
      case "piedra":
        lista.push(armarPiedra(herramientas, p));
        break;
      case "sucia":
        lista.push(armarSucia(herramientas, p));
        break;
      case "bloque":
        lista.push(armarBloque(herramientas, p));
        break;
      case "doble":
        lista.push(armarDoble(herramientas, p));
        break;
      case "estela":
        lista.push(armarEstela(herramientas, p));
        break;
      case "pelota":
        lista.push(armarPelota(herramientas, p));
        break;
      case "antorcha":
        lista.push(armarAntorcha(herramientas, p));
        break;
      case "llave":
        lista.push(armarLlave(herramientas, p));
        break;
      case "murcielagos":
        lista.push(armarMurcielagos(herramientas, p));
        break;
      case "guacamayas":
        lista.push(armarGuacamayas(herramientas, p));
        break;
      case "vagon":
        lista.push(armarVagon(herramientas, p));
        break;
      case "dresina":
        lista.push(armarDresina(herramientas, p));
        break;
      case "grua":
        lista.push(armarGrua(herramientas, p));
        break;
      case "racimo":
        lista.push(armarRacimo(herramientas, p));
        break;
      case "sombrero":
        lista.push(armarSombrero(herramientas, p));
        break;
      case "duende":
        lista.push(armarDuende(herramientas, p));
        break;
      case "carreta":
        lista.push(armarCarreta(herramientas, p));
        break;
      case "sin-bueyes":
        lista.push(armarSinBueyes(herramientas, p));
        break;
      case "pesa":
        lista.push(armarPesa(herramientas, p));
        break;
      case "engranaje":
        lista.push(armarEngranaje(herramientas, p));
        break;
      case "campana":
        lista.push(armarCampana(herramientas, p));
        break;
      case "alfombra":
        lista.push(armarAlfombra(herramientas, p));
        break;
      case "pipante":
        lista.push(armarPipante(herramientas, p));
        break;
      case "puente":
        lista.push(armarPuente(herramientas, p));
        break;
      case "palmera":
        lista.push(armarPalmera(herramientas, p));
        break;
      case "sisimite":
        lista.push(armarSisimite(herramientas, p));
        break;
      // Los canales (TU-42)
      case "trajinera":
        lista.push(armarTrajinera(herramientas, p));
        break;
      case "chinampa":
        lista.push(armarChinampa(herramientas, p));
        break;
      case "pinata":
        lista.push(armarPinata(herramientas, p));
        break;
      case "llorona":
        lista.push(armarLlorona(herramientas, p));
        break;
      // El llano (TU-44)
      case "silbon":
        lista.push(armarSilbon(herramientas, p));
        break;
      case "molino":
        lista.push(armarMolino(herramientas, p));
        break;
      case "ganado":
        lista.push(armarGanado(herramientas, p));
        break;
      case "hamaca":
        lista.push(armarHamaca(herramientas, p));
        break;
      case "saco":
        lista.push(armarSaco(herramientas, p));
        break;
      // La garrucha (TU-43)
      case "garrucha":
        lista.push(armarGarrucha(herramientas, p));
        break;
      case "chiva":
        lista.push(armarChiva(herramientas, p));
        break;
      case "palma":
        lista.push(armarPalma(herramientas, p));
        break;
      case "patasola":
        lista.push(armarPatasola(herramientas, p));
        break;
      // Las trenzas (TU-40)
      case "nudo":
        lista.push(armarNudo(herramientas, p));
        break;
      case "mula":
        lista.push(armarMula(herramientas, p));
        break;
      case "balde":
        lista.push(armarBalde(herramientas, p));
        break;
      case "brasa":
        lista.push(armarBrasa(herramientas, p));
        break;
      case "sombreron":
        lista.push(armarSombreron(herramientas, p));
        break;
      case "sombrerote":
        lista.push(armarSombrerote(herramientas, p));
        break;
      // El cafetal (TU-41)
      case "canasto":
        lista.push(armarCanasto(herramientas, p));
        break;
      case "zaranda":
        lista.push(armarZaranda(herramientas, p));
        break;
      case "polea":
        lista.push(armarPolea(herramientas, p));
        break;
      case "costal":
        lista.push(armarCostal(herramientas, p));
        break;
      case "guineo":
        lista.push(armarGuineo(herramientas, p));
        break;
      case "cipitio":
        lista.push(armarCipitio(herramientas, p));
        break;
      // El puente (TU-45)
      case "qeswa":
        lista.push(armarQeswa(herramientas, p));
        break;
      case "chaka":
        lista.push(armarChaka(herramientas, p));
        break;
      case "bocatoma":
        lista.push(armarBocatoma(herramientas, p));
        break;
      case "anden":
        lista.push(armarAnden(herramientas, p));
        break;
      case "carguera":
        lista.push(armarCarguera(herramientas, p));
        break;
      // La mina (TU-46)
      case "vagoneta":
        lista.push(armarVagoneta(herramientas, p));
        break;
      case "espejo":
        lista.push(armarEspejo(herramientas, p));
        break;
      case "grieta":
        lista.push(armarGrieta(herramientas, p));
        break;
      case "ofrenda":
        lista.push(armarOfrenda(herramientas, p));
        break;
      case "velas":
        lista.push(armarVelas(herramientas, p));
        break;
      case "tio":
        lista.push(armarTio(herramientas, p));
        break;
    }
  }

  return {
    lista,
    solidas,
    buscar<C extends TipoDePieza>(cual: C, nombre: string) {
      return lista.find((p): p is PiezaPorTipo[C] => p.cual === cual && p.nombre === nombre);
    },
    antes(munecos, entradas) {
      for (const f of antesDe) f(munecos, entradas);
    },
    despues(munecos, fuera) {
      for (const f of despuesDe) f(munecos, fuera);
    },
    guardar() {
      for (const m of moviles) {
        m.antes.copy(m.ahora);
        m.antesQ.copy(m.ahoraQ);
        m.ahora.copy(m.cuerpo.translation());
        m.ahoraQ.copy(m.cuerpo.rotation());
      }
      for (const f of guardarDe) f();
    },
    dibujar(alfa) {
      for (const m of moviles) {
        m.objeto.position.lerpVectors(m.antes, m.ahora, alfa);
        m.objeto.quaternion.slerpQuaternions(m.antesQ, m.ahoraQ, alfa);
      }
      for (const f of dibujarDe) f(alfa);
    },
  };
}
