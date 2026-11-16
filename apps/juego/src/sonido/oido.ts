// El oído de una escena (TU-59): después de cada paso mira el mundo (el detector de eventos.ts), averigua qué pisa
// cada muñeco y le pasa lo que sonó al parlante. También lleva el ambiente del nivel (de día o de noche) y la música
// del menú, que suena mientras el juego está en el menú o en pausa.
//
// En línea el invitado no simula: sus muñecos no saben en qué andan ni qué agarran. Para él, `mirarCon` cambia esa
// parte por lo que trae la foto del anfitrión (los estados y los agarres de los dos, src/red/paquetes.ts); las
// posiciones ya son las de la foto. Así los dos oyen lo mismo que ven.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { EstadoMuneco, Muneco } from "../muneco";
import type { Aguas } from "../niveles/agua";
import type { NivelArmado } from "../niveles/armar";
import type { Material } from "../niveles/formato";
import type { PiezaDeJuego, PiezaPorTipo } from "../niveles/piezas";
import type { EstadoJuego, Juego } from "../ui/juego";
import { type Ambiente, ambienteDe } from "./ambiente";
import {
  type CuerpoVisto,
  crearDetector,
  type EventoSonido,
  type Jugador,
  type Suelo,
  type VozDePieza,
} from "./eventos";
import { crearParlante, type Parlante } from "./parlante";

/** Lo que pisa el muñeco sobre el material «suelo» de cada nivel: el pinar tiene pinocha, la calle es empedrada. */
export const SUELO_DEL_NIVEL: Readonly<Record<string, Suelo>> = {
  patio: "tierra",
  pinar: "hojas",
  poza: "tierra",
  calle: "piedra",
  xibalba: "piedra",
  tren: "tierra",
  rio: "hojas",
  trenzas: "piedra",
  cafetal: "tierra",
  canales: "tierra",
  garrucha: "pasto",
  llano: "pasto",
  puente: "piedra",
  mina: "piedra",
  minga: "tierra",
  pampa: "pasto",
  medianoche: "hojas",
  dos: "hojas",
};

/** Qué pisa sobre un sólido de ese material en ese nivel. */
export function sueloDelMaterial(material: Material, nivel: string): Suelo {
  switch (material) {
    case "corteza":
      return "madera";
    case "tela":
      return "tela";
    case "honda":
      return "piedra";
    default:
      return SUELO_DEL_NIVEL[nivel] ?? "tierra";
  }
}

/** Cómo suena cada pieza de juego que suena (las demás, como los espantos, tienen su propio sonido o ninguno). */
export const VOZ_DE_PIEZA: Readonly<Partial<Record<PiezaDeJuego["cual"], VozDePieza>>> = {
  huacal: "madera",
  palanca: "palanca",
  plancha: "plancha",
  campana: "campana",
  balancin: "madera",
  tronco: "madera",
  tranca: "madera",
  batea: "madera",
  canasto: "madera",
  balde: "madera",
  carreta: "madera",
  vagoneta: "madera",
  piedra: "piedra",
  bloque: "piedra",
  estela: "piedra",
  pelota: "piedra",
  pesa: "piedra",
};

/** El cuerpo que suena de una pieza: el que se mueve (el brazo de la palanca, la placa, la campana). */
function cuerpoDePieza(p: PiezaDeJuego, armado: NivelArmado): RAPIER.RigidBody | null {
  switch (p.cual) {
    case "palanca":
      return (p as PiezaPorTipo["palanca"]).brazo;
    case "plancha":
      return (p as PiezaPorTipo["plancha"]).placa;
    case "campana":
      return (p as PiezaPorTipo["campana"]).cuerpo;
    case "balancin":
      return (p as PiezaPorTipo["balancin"]).tabla;
    default:
      return armado.pieza(p.nombre)?.cuerpo ?? null;
  }
}

/** Una pieza que suena: su cuerpo y su voz. */
export interface CuerpoQueSuena {
  readonly voz: VozDePieza;
  readonly cuerpo: RAPIER.RigidBody;
}

/** Los cuerpos de un nivel que suenan: las piezas de juego con voz, los sólidos sueltos del .glb (madera) y los
 * cinemáticos del .glb (compuertas y portones que mueve el guion). */
export function cuerposQueSuenan(armado: NivelArmado): CuerpoQueSuena[] {
  const lista: CuerpoQueSuena[] = [];
  const dePiezas = new Set(armado.piezasDeJuego.lista.map((p) => p.nombre));
  for (const p of armado.piezasDeJuego.lista) {
    const voz = VOZ_DE_PIEZA[p.cual];
    const cuerpo = voz ? cuerpoDePieza(p, armado) : null;
    if (voz && cuerpo) lista.push({ voz, cuerpo });
  }
  for (const s of armado.piezas) {
    if (!s.cuerpo || dePiezas.has(s.nombre)) continue;
    lista.push({ voz: s.cuerpo.isKinematic() ? "compuerta" : "madera", cuerpo: s.cuerpo });
  }
  return lista;
}

/** Lo que trae la foto en línea: el estado de cada muñeco y qué manos agarran (bit 0 izquierda del rojo, 1 derecha
 * del rojo, 2 y 3 lo mismo del turquesa). */
export interface LoQueSeVe {
  readonly estados: readonly [EstadoMuneco, EstadoMuneco];
  readonly agarres: number;
}

export interface OpcionesOido {
  readonly munecos: readonly [Muneco, Muneco];
  readonly cuerpos?: readonly CuerpoQueSuena[];
  readonly aguas?: Aguas;
  /** Los sólidos que se pisan y qué suelo es cada uno. Lo que no está acá (o si no pisa nada) es `suelo`. */
  readonly pisables?: readonly { readonly objeto: THREE.Object3D; readonly suelo: Suelo }[];
  /** Lo que se pisa donde no hay nada de `pisables`. */
  readonly suelo: Suelo;
  /** La clave del ambiente (la del nivel, o `dos`): ver AMBIENTES en ambiente.ts. */
  readonly ambiente: string;
  /** Si es de noche ahora (la Noche de tuerce puede llegar después, en la foto del anfitrión). */
  readonly deNoche?: () => boolean;
  /** El menú y la pausa: con el juego ahí suena la música. */
  readonly juego?: Juego;
}

export interface Oido {
  /** Después de cada paso de físicas (o, en el invitado, después de poner los cuerpos de la foto). */
  pasar(): void;
  /** En línea, el invitado: de dónde sacar el estado y los agarres de los muñecos (`null`: de los muñecos). */
  mirarCon(fuente: (() => LoQueSeVe | undefined) | null): void;
  /** Lo que sonó en el último paso (para las pruebas). */
  readonly ultimos: readonly EventoSonido[];
}

const ABAJO = new THREE.Vector3(0, -1, 0);
/** Desde la pelvis, hasta dónde se busca el suelo (m). */
const HASTA_EL_SUELO = 1.6;
/** De la pelvis a los pies, de pie (m): ver MEDIDAS.pelvis. */
const PELVIS_A_PIES = 0.45;
/** A cuántos metros del centro de los dos un sonido queda del todo a un lado. */
const ANCHO_PANEO = 9;

export function crearOido(op: OpcionesOido, parlante: Parlante = crearParlante()): Oido {
  const detector = crearDetector();
  const { munecos } = op;
  const cuerpos = op.cuerpos ?? [];
  const inicios = cuerpos.map((c) => {
    const q = c.cuerpo.rotation();
    return new THREE.Quaternion(q.x, q.y, q.z, q.w);
  });
  let fuente: (() => LoQueSeVe | undefined) | null = null;
  let ultimos: EventoSonido[] = [];

  // Qué suelo es cada objeto que se pisa (y sus mallas)
  const pisables = op.pisables ?? [];
  const sueloDeObjeto = new Map<THREE.Object3D, Suelo>();
  const objetos: THREE.Object3D[] = [];
  for (const p of pisables) {
    p.objeto.updateWorldMatrix(true, true);
    sueloDeObjeto.set(p.objeto, p.suelo);
    objetos.push(p.objeto);
  }
  const rayo = new THREE.Raycaster();
  rayo.far = HASTA_EL_SUELO;
  const desde = new THREE.Vector3();
  const pies = new THREE.Vector3();

  const sueloDe = (jugador: Jugador): Suelo => {
    const pelvis = munecos[jugador].partes.pelvis.translation();
    pies.set(pelvis.x, pelvis.y - PELVIS_A_PIES, pelvis.z);
    if (op.aguas?.en(pies)) return "agua";
    if (objetos.length === 0) return op.suelo;
    rayo.set(desde.set(pelvis.x, pelvis.y, pelvis.z), ABAJO);
    const golpe = rayo.intersectObjects(objetos, true)[0];
    for (let o: THREE.Object3D | null = golpe?.object ?? null; o; o = o.parent) {
      const s = sueloDeObjeto.get(o);
      if (s) return s;
    }
    return op.suelo;
  };

  const aguaDe = (pelvis: THREE.Vector3Like): 0 | 1 | 2 => {
    if (!op.aguas) return 0;
    if (op.aguas.en(pelvis)) return 2;
    pies.set(pelvis.x, pelvis.y - PELVIS_A_PIES, pelvis.z);
    return op.aguas.en(pies) ? 1 : 0;
  };

  const q = new THREE.Quaternion();
  const vistaDeCuerpo = (c: CuerpoQueSuena, i: number): CuerpoVisto => {
    const r = c.cuerpo.rotation();
    q.set(r.x, r.y, r.z, r.w);
    const inicio = inicios[i];
    const giro = inicio ? 2 * Math.acos(Math.min(1, Math.abs(q.dot(inicio)))) : 0;
    return { voz: c.voz, posicion: c.cuerpo.translation(), giro };
  };

  // El ambiente y la música
  let ambiente: Ambiente | undefined;
  let deNoche = op.deNoche?.() ?? false;
  const ponerAmbiente = () => {
    ambiente = ambienteDe(op.ambiente, deNoche);
    parlante.ambiente(ambiente);
  };
  ponerAmbiente();
  const conMusica = (estado: EstadoJuego) => estado !== "jugando";
  parlante.musica(op.juego ? conMusica(op.juego.estado) : false);
  op.juego?.alCambiar((estado) => parlante.musica(conMusica(estado)));

  return {
    pasar() {
      const visto = fuente?.();
      const munecoVisto = (j: Jugador) => {
        const m = munecos[j];
        const pelvis = m.partes.pelvis.translation();
        return {
          estado: visto ? visto.estados[j] : m.estado,
          manos: visto
            ? ([(visto.agarres >> (2 * j)) & 1, (visto.agarres >> (2 * j + 1)) & 1].map(Boolean) as [boolean, boolean])
            : ([m.agarrado("brazoIzquierdo") !== null, m.agarrado("brazoDerecho") !== null] as const),
          pelvis,
          agua: aguaDe(pelvis),
        };
      };
      // En línea el invitado no tiene foto todavía: no se oye nada (los muñecos están quietos en la salida)
      if (fuente && !visto) {
        ultimos = [];
        return;
      }
      ultimos = detector.mirar(
        { munecos: [munecoVisto(0), munecoVisto(1)], cuerpos: cuerpos.map(vistaDeCuerpo) },
        sueloDe,
      );
      if (ultimos.length > 0) {
        const a = munecos[0].partes.pelvis.translation();
        const b = munecos[1].partes.pelvis.translation();
        const centro = (a.x + b.x) / 2;
        for (const e of ultimos) parlante.efecto(e, Math.max(-0.8, Math.min(0.8, (e.x - centro) / ANCHO_PANEO)));
      }
      const noche = op.deNoche?.() ?? false;
      if (noche !== deNoche) {
        deNoche = noche;
        ponerAmbiente();
      }
    },
    mirarCon(f) {
      fuente = f;
    },
    get ultimos() {
      return ultimos;
    },
  };
}
