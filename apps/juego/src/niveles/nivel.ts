// Un nivel en juego (TU-11): los dos muñecos en el nivel armado, los puntos de control y la reaparición. Nunca hay
// derrota (RF-16): el que cae al vacío reaparece junto a su compañero si este está de pie en terreno firme, y si no,
// en el último punto de control que alcanzó la pareja.
//
// Cada paso de la escena:   nivel.antes()   →   muñecos.pasar() y mundo.step()   →   nivel.despues()
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { AvanceDeNivel, Premio, PremiosDeNivel } from "../escenas/tipos";
import type { Rapier } from "../motor/fisica";
import type { EntradaMuneco, Muneco } from "../muneco";
import type { NivelArmado, Pieza } from "./armar";
import { adentro, type Lugar, type PlanoDeNivel, type TipoDePieza } from "./formato";
import type { GuionDeNivel, NivelEnJuego } from "./guion";
import type { PiezaPorTipo } from "./piezas";

/** Hasta dónde se puede alejar un muñeco de lo sólido, de costado, antes de contar como fuera del nivel (metros). */
const MARGEN = 12;
/** Dónde probar a ponerlo junto al compañero, en orden, en el marco del compañero (z adelante, x hacia el lado de
 * siempre: el rojo a la derecha del turquesa y el turquesa a la izquierda del rojo, como en la salida). */
const JUNTO = [
  [0.8, -0.2],
  [-0.8, -0.2],
  [0, -0.8],
  [0.7, -0.7],
  [-0.7, -0.7],
  [0, 0.8],
] as const;
/** Cuánto más alto o más bajo que los pies del compañero puede quedar el piso donde reaparece (metros). */
const DESNIVEL = 0.35;
/** Un poquito por encima del piso, para que no aparezca con los pies adentro. */
const SOBRE_EL_PISO = 0.03;

export type Jugador = 0 | 1;

/** Dónde reapareció un jugador: junto al compañero o en el punto de control. */
export interface Reaparicion extends Lugar {
  readonly jugador: Jugador;
  readonly junto: boolean;
}

export interface Nivel extends NivelEnJuego {
  readonly avance: AvanceDeNivel;
  readonly premios: PremiosDeNivel;
  /** Antes de los muñecos y de `mundo.step()`: el guion y las piezas (con las entradas de los dos, para columpiarse
   * en los bejucos). */
  antes(entradas?: readonly [EntradaMuneco, EntradaMuneco]): void;
  /** Después de `mundo.step()`: puntos de control y caídas. Devuelve quién reapareció en este paso. */
  despues(): readonly Reaparicion[];
  /** Si ese muñeco cayó al vacío o salió del nivel. */
  cayo(jugador: Jugador): boolean;
  /** Dónde reaparecería ese jugador ahora (`companeroCayo`: si el otro también cayó en este paso). */
  dondeReaparece(jugador: Jugador, companeroCayo?: boolean): Reaparicion;
}

export interface OpcionesNivel {
  readonly rapier: Rapier;
  readonly mundo: RAPIER.World;
  readonly plano: PlanoDeNivel;
  readonly armado: NivelArmado;
  readonly munecos: readonly [Muneco, Muneco];
  readonly guion?: GuionDeNivel;
}

export function crearNivel({ rapier, mundo, plano, armado, munecos, guion = {} }: OpcionesNivel): Nivel {
  // El rayo hacia el piso no ve a los muñecos (sus grupos de choque son los bits 1 y 2) ni lo que está suelto
  const grupos = ((1 << 16) | (0xffff & ~0b110)) >>> 0;
  const banderas = rapier.QueryFilterFlags.EXCLUDE_DYNAMIC | rapier.QueryFilterFlags.EXCLUDE_SENSORS;
  const rayo = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  const ARRIBA = new THREE.Vector3(0, 1, 0);

  /** El borde de lo sólido, con margen: afuera de esto el muñeco salió del nivel. */
  const limites = new THREE.Box3();
  for (const s of plano.solidos) limites.union(new THREE.Box3().setFromObject(s.objeto));
  limites.expandByVector(new THREE.Vector3(MARGEN, 0, MARGEN));

  let punto = 0;
  let pasos = 0;
  const avisos = new Set<(punto: number) => void>();
  const ganados = new Set<Premio>();
  const avisosDePremios = new Set<(premio: Premio) => void>();
  const premios: PremiosDeNivel = {
    nivel: plano.numero,
    tiene: (premio) => ganados.has(premio),
    ganar(premio) {
      if (ganados.has(premio)) return;
      ganados.add(premio);
      for (const aviso of avisosDePremios) aviso(premio);
    },
    marcar(premio) {
      ganados.add(premio);
    },
    alGanar(aviso) {
      avisosDePremios.add(aviso);
      return () => avisosDePremios.delete(aviso);
    },
  };

  /** La altura del piso firme bajo (x, z) mirando desde `desde` hacia abajo `alcance` metros, o `null`. */
  const pisoEn = (x: number, desde: number, z: number, alcance: number) => {
    rayo.origin = { x, y: desde, z };
    rayo.dir = { x: 0, y: -1, z: 0 };
    const golpe = mundo.castRay(rayo, alcance, true, banderas, grupos);
    return golpe ? desde - golpe.timeOfImpact : null;
  };
  /** Si hay algo sólido en línea recta entre los dos puntos (una pared entre el compañero y el lugar). */
  const tapado = (de: THREE.Vector3, a: THREE.Vector3) => {
    const d = a.clone().sub(de);
    const largo = d.length();
    rayo.origin = de;
    rayo.dir = d.normalize();
    return mundo.castRay(rayo, largo, true, banderas, grupos) !== null;
  };

  /** Si ese punto quedó en el vacío o fuera del nivel. */
  const fuera = (p: THREE.Vector3Like) => {
    if (p.y < plano.vacio) return true;
    if (p.x < limites.min.x || p.x > limites.max.x || p.z < limites.min.z || p.z > limites.max.z) return true;
    return plano.vacios.some((v) => adentro(v, p));
  };
  /** Un muñeco cayó si quedó en el vacío o bajo un agua que se lo lleva (TU-24: los huacales no se ahogan, flotan). */
  const cayo = (jugador: Jugador) => {
    const p = munecos[jugador].partes.pelvis.translation();
    return fuera(p) || armado.aguas.seLoLleva(p);
  };

  /** Si el muñeco está de pie en terreno firme: no cayó, tiene los pies en el suelo y no anda en otra cosa. */
  const firme = (jugador: Jugador) => {
    const m = munecos[jugador];
    return m.estado === "de pie" && m.enElSuelo && !cayo(jugador);
  };

  /** `companeroCayo`: si el compañero también cayó en este paso (aunque ya lo hayan puesto de vuelta). */
  const dondeReaparece = (jugador: Jugador, companeroCayo = false): Reaparicion => {
    const otro: Jugador = jugador === 0 ? 1 : 0;
    const companero = munecos[otro];
    if (!companeroCayo && firme(otro)) {
      const pelvis = new THREE.Vector3().copy(companero.partes.pelvis.translation());
      const pies = pisoEn(pelvis.x, pelvis.y, pelvis.z, 2);
      if (pies !== null) {
        const rumbo = companero.rumbo;
        const lugar = new THREE.Vector3();
        for (const [x, z] of JUNTO) {
          lugar
            .set(jugador === 0 ? -x : x, 0, z)
            .applyAxisAngle(ARRIBA, rumbo)
            .add(pelvis);
          const piso = pisoEn(lugar.x, pies + 1.5, lugar.z, 1.5 + DESNIVEL + 0.5);
          if (piso === null || Math.abs(piso - pies) > DESNIVEL) continue;
          lugar.y = piso;
          if (plano.vacios.some((v) => adentro(v, lugar))) continue;
          if (armado.aguas.en({ x: lugar.x, y: piso + 0.5, z: lugar.z })) continue;
          if (tapado(pelvis, new THREE.Vector3(lugar.x, pelvis.y, lugar.z))) continue;
          return { jugador, junto: true, posicion: lugar.clone().setY(piso + SOBRE_EL_PISO), rumbo };
        }
      }
    }
    const enElPunto = plano.puntos[punto]?.lugares[jugador];
    if (!enElPunto) throw new Error(`no existe el punto de control ${punto}`);
    const posicion = enElPunto.posicion.clone();
    posicion.y += SOBRE_EL_PISO;
    return { jugador, junto: false, posicion, rumbo: enElPunto.rumbo };
  };

  const reaparecer = (jugador: Jugador, companeroCayo: boolean) => {
    const donde = dondeReaparece(jugador, companeroCayo);
    munecos[jugador].reaparecer(donde.posicion, donde.rumbo);
    return donde;
  };

  /** La pieza de juego de esa clase y con ese nombre (TU-12). */
  const deJuego = <C extends TipoDePieza>(cual: C, nombre: string): PiezaPorTipo[C] => {
    const pieza = armado.piezasDeJuego.buscar(cual, nombre);
    if (!pieza) throw new Error(`el nivel «${plano.nombre}» no tiene ${cual} «${nombre}»`);
    return pieza;
  };

  const ultimo = plano.puntos.length - 1;
  const avance: AvanceDeNivel = {
    nivel: plano.numero,
    meta: ultimo,
    puntoDeControl: () => punto,
    alCambiar(aviso) {
      avisos.add(aviso);
      return () => avisos.delete(aviso);
    },
    irA(nuevo) {
      punto = Math.max(0, Math.min(ultimo, Math.floor(nuevo)));
      const lugares = plano.puntos[punto]?.lugares;
      if (!lugares) return;
      for (const jugador of [0, 1] as const) {
        const { posicion, rumbo } = lugares[jugador];
        munecos[jugador].reaparecer(posicion.clone().setY(posicion.y + SOBRE_EL_PISO), rumbo);
      }
      guion.alRetomar?.(punto, nivel);
    },
    retomar(nuevo) {
      const n = Math.max(0, Math.min(ultimo, Math.floor(nuevo)));
      if (!(n > punto)) return;
      punto = n;
      guion.alRetomar?.(punto, nivel);
      for (const aviso of avisos) aviso(punto);
    },
  };

  const nivel: Nivel = {
    plano,
    rapier,
    mundo,
    escena: armado.escena,
    munecos,
    get pasos() {
      return pasos;
    },
    get puntoDeControl() {
      return punto;
    },
    pieza(nombre): Pieza {
      const pieza = armado.pieza(nombre);
      if (!pieza) throw new Error(`el nivel «${plano.nombre}» no tiene una pieza «${nombre}»`);
      return pieza;
    },
    get secreto() {
      return ganados.has("secreto");
    },
    get logro() {
      return ganados.has("logro");
    },
    encontrarSecreto: () => premios.ganar("secreto"),
    lograr: () => premios.ganar("logro"),
    huacal: (nombre) => deJuego("huacal", nombre),
    palanca: (nombre) => deJuego("palanca", nombre),
    plancha: (nombre) => deJuego("plancha", nombre),
    balancin: (nombre) => deJuego("balancin", nombre),
    bejuco: (nombre) => deJuego("bejuco", nombre),
    tronco: (nombre) => deJuego("tronco", nombre),
    tranca: (nombre) => deJuego("tranca", nombre),
    hueso: (nombre) => deJuego("hueso", nombre),
    lampara: (nombre) => deJuego("lampara", nombre),
    cadejo: (nombre) => deJuego("cadejo", nombre),
    agua(nombre) {
      const agua = armado.aguas.buscar(nombre);
      if (!agua) throw new Error(`el nivel «${plano.nombre}» no tiene un agua «${nombre}»`);
      return agua;
    },
    aguas: armado.aguas,
    balsa: (nombre) => deJuego("balsa", nombre),
    tendedero: (nombre) => deJuego("tendedero", nombre),
    batea: (nombre) => deJuego("batea", nombre),
    piedra: (nombre) => deJuego("piedra", nombre),
    sucia: (nombre) => deJuego("sucia", nombre),
    bloque: (nombre) => deJuego("bloque", nombre),
    doble: (nombre) => deJuego("doble", nombre),
    estela: (nombre) => deJuego("estela", nombre),
    pelota: (nombre) => deJuego("pelota", nombre),
    antorcha: (nombre) => deJuego("antorcha", nombre),
    llave: (nombre) => deJuego("llave", nombre),
    murcielagos: (nombre) => deJuego("murcielagos", nombre),
    guacamayas: (nombre) => deJuego("guacamayas", nombre),
    vagon: (nombre) => deJuego("vagon", nombre),
    dresina: (nombre) => deJuego("dresina", nombre),
    grua: (nombre) => deJuego("grua", nombre),
    racimo: (nombre) => deJuego("racimo", nombre),
    sombrero: (nombre) => deJuego("sombrero", nombre),
    duende: (nombre) => deJuego("duende", nombre),
    carreta: (nombre) => deJuego("carreta", nombre),
    sinBueyes: (nombre) => deJuego("sin-bueyes", nombre),
    pesa: (nombre) => deJuego("pesa", nombre),
    engranaje: (nombre) => deJuego("engranaje", nombre),
    campana: (nombre) => deJuego("campana", nombre),
    alfombra: (nombre) => deJuego("alfombra", nombre),
    pipante: (nombre) => deJuego("pipante", nombre),
    puente: (nombre) => deJuego("puente", nombre),
    palmera: (nombre) => deJuego("palmera", nombre),
    sisimite: (nombre) => deJuego("sisimite", nombre),
    // El cafetal (TU-41)
    canasto: (nombre) => deJuego("canasto", nombre),
    zaranda: (nombre) => deJuego("zaranda", nombre),
    polea: (nombre) => deJuego("polea", nombre),
    saco: (nombre) => deJuego("saco", nombre),
    guineo: (nombre) => deJuego("guineo", nombre),
    cipitio: (nombre) => deJuego("cipitio", nombre),
    avance,
    premios,
    antes(entradas) {
      guion.cadaPaso?.(nivel);
      armado.piezasDeJuego.antes(munecos, entradas);
      armado.aguas.antes(munecos, entradas);
    },
    despues() {
      pasos++;
      // Puntos de control: el primero de los dos que entra a la zona lo alcanza para la pareja
      let nuevo = punto;
      for (const m of munecos) {
        const p = m.partes.pelvis.translation();
        for (let i = nuevo + 1; i <= ultimo; i++) {
          const zona = plano.puntos[i]?.zona;
          if (zona && adentro(zona, p)) nuevo = i;
        }
      }
      while (punto < nuevo) {
        punto++;
        guion.alAlcanzar?.(punto, nivel);
        for (const aviso of avisos) aviso(punto);
      }
      // El secreto: el primero de los dos que entra en su zona lo encuentra para la pareja
      if (!ganados.has("secreto")) {
        const encontrado = munecos.some((m) => plano.secretos.some((z) => adentro(z, m.partes.pelvis.translation())));
        if (encontrado) premios.ganar("secreto");
      }
      // El agua: quién cayó (antes de que reaparezca)
      armado.aguas.despues(munecos);
      // Caídas: no hay derrota, se reaparece. Después las piezas: los huacales que cayeron vuelven a su lugar
      const cayeron = ([0, 1] as const).filter(cayo);
      const reaparecidos = cayeron.map((jugador) => reaparecer(jugador, cayeron.length === 2));
      armado.piezasDeJuego.despues(munecos, fuera);
      return reaparecidos;
    },
    cayo,
    dondeReaparece,
  };
  guion.alEmpezar?.(nivel);
  return nivel;
}
