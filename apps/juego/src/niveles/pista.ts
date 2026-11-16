// La pista (TU-62): si la pareja pasa 2 minutos sin llegar al próximo punto de control, una luz suave, como una
// luciérnaga, sale de donde están y flota hacia allá. Sin texto ni flechas: solo la luz, que se apaga al llegar.
// Aquí está lo que no se dibuja: cuándo se enciende (en pasos de físicas, nunca con el tiempo del cuadro) y por
// dónde vuela. La dibuja escenas/orientacion.ts. En línea, cada lado cuenta sus pasos con la misma regla a partir
// del punto de control que tiene (el invitado lo recibe en las fotos), así los dos ven la misma luciérnaga.
import * as THREE from "three";
import { PASOS_POR_SEGUNDO } from "../motor/bucle";
import type { PlanoDeNivel } from "./formato";

/** Pasos jugando sin llegar al próximo punto de control antes de que aparezca la luciérnaga: 2 minutos. */
export const ESPERA_PISTA = 2 * 60 * PASOS_POR_SEGUNDO;

export interface Espera {
  /**
   * Un paso de físicas: el punto de control de la pareja ahora y si están jugando (fuera del menú, en línea ya
   * conectados, sin el panel de la meta). Solo cuentan los pasos jugando; un punto nuevo vuelve a empezar la cuenta.
   */
  pasar(punto: number, jugando: boolean): void;
  /** Si la luciérnaga está afuera. */
  readonly encendida: boolean;
  /** Pasos desde que se encendió (0 mientras está apagada): de esto sale por dónde va. */
  readonly pasos: number;
}

/** `meta`: el último punto de control (en la meta no hay pista). `forzada` (`&pista`): encendida desde el principio. */
export function crearEspera({ meta, forzada = false }: { meta: number; forzada?: boolean }): Espera {
  let ultimo: number | undefined;
  let sinAvanzar = forzada ? ESPERA_PISTA : 0;
  let enLaMeta = false;
  const encendida = () => !enLaMeta && sinAvanzar > ESPERA_PISTA;
  return {
    pasar(punto, jugando) {
      if (ultimo !== undefined && punto !== ultimo) sinAvanzar = 0;
      ultimo = punto;
      enLaMeta = punto >= meta;
      if (jugando && !enLaMeta) sinAvanzar++;
    },
    get encendida() {
      return encendida();
    },
    get pasos() {
      return encendida() ? sinAvanzar - ESPERA_PISTA : 0;
    },
  };
}

/** A qué altura sobre la base de la zona apunta la luz (metros): a la altura de la cabeza de los muñecos. */
const ALTURA_DESTINO = 1;

/** Hacia dónde señala la pista con la pareja en ese punto de control: el medio de la zona del próximo, un poco
 * sobre su base (o null en la meta). */
export function destinoDeLaPista(plano: PlanoDeNivel, punto: number): THREE.Vector3 | null {
  const zona = plano.puntos[punto + 1]?.zona;
  if (!zona) return null;
  return new THREE.Vector3(0, -zona.medio.y + ALTURA_DESTINO, 0).applyQuaternion(zona.giro).add(zona.centro);
}

/** Cada vuelo de la luciérnaga dura esto (pasos): sale de la pareja, avanza hacia el destino y se apaga. */
export const CICLO = 220;
/** Lo más lejos que vuela de la pareja en cada vuelo (metros). Con la cámara cerca se queda en el cuadro
 * (`acercarAlCuadro`). */
export const ALCANCE = 4;
/** Por encima de la pelvis de los dos sale (metros), y cuánto adelante. */
const SALE = { arriba: 0.75, adelante: 0.6 };
/** Lo más que sube o baja hacia el destino (metros). */
const SUBIDA = { arriba: 1, abajo: 0.6 };
/** El vaivén: cuánto sube y baja y cuánto se mece de costado (metros), y cada cuántos pasos. */
const VAIVEN = { alto: 0.16, periodoAlto: 70, ancho: 0.28, periodoAncho: 130 };
/** El primer vuelo aparece de a poco (pasos). */
const APARECE = 60;

export interface Vuelo {
  /** De dónde sale cada vuelo: sobre las cabezas de los dos. */
  readonly salida: THREE.Vector3;
  readonly posicion: THREE.Vector3;
  /** Cuánto brilla, de 0 (apagada) a 1. */
  readonly brillo: number;
}

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * Dónde va la luciérnaga `pasos` después de encenderse: sale de `desde` (el medio de las dos pelvis), vuela hasta
 * `ALCANCE` metros hacia `hacia` (sin pasarse) meciéndose, se apaga y vuelve a salir. Siempre lo mismo para los
 * mismos datos: las capturas salen iguales y en línea los dos la ven en el mismo lugar.
 */
export function vueloDeLuciernaga(
  desde: THREE.Vector3Like,
  hacia: THREE.Vector3Like,
  pasos: number,
  posicion = new THREE.Vector3(),
): Vuelo {
  const salida = new THREE.Vector3(desde.x, desde.y + SALE.arriba, desde.z);
  // Vuela casi a la altura de las cabezas: si el destino está muy arriba o muy abajo, apenas sube o baja (arriba
  // solo habría cielo, y en la niebla clara no se vería)
  const subida = Math.min(SUBIDA.arriba, Math.max(-SUBIDA.abajo, hacia.y - salida.y));
  const rumbo = new THREE.Vector3(hacia.x - salida.x, subida, hacia.z - salida.z);
  const largo = rumbo.length();
  if (largo > 1e-6) rumbo.divideScalar(largo);
  const adelante = Math.min(SALE.adelante, largo);
  const tramo = Math.max(0, Math.min(ALCANCE, largo) - adelante);
  const s = (pasos % CICLO) / CICLO;
  // Arranca despacio, va y frena al final, como quien busca
  const recorrido = adelante + tramo * suave(s * 1.15);
  posicion.copy(salida).addScaledVector(rumbo, recorrido);
  // El vaivén, de costado (en el piso, a lo ancho del rumbo) y de arriba abajo; se calma al acercarse al destino
  const calma = Math.min(1, (largo - recorrido) / 1.5);
  const costado = new THREE.Vector3(-rumbo.z, 0, rumbo.x);
  if (costado.lengthSq() > 1e-9) costado.normalize();
  posicion.addScaledVector(costado, VAIVEN.ancho * calma * Math.sin((pasos / VAIVEN.periodoAncho) * Math.PI * 2));
  posicion.y += VAIVEN.alto * Math.sin((pasos / VAIVEN.periodoAlto) * Math.PI * 2);
  const brillo = suave(s / 0.12) * (1 - suave((s - 0.78) / 0.22)) * suave(pasos / APARECE);
  return { salida, posicion, brillo };
}

/** Hasta dónde de la pantalla puede ir la luciérnaga (en coordenadas de la cámara, de -1 a 1). */
const CUADRO = { ancho: 0.8, alto: 0.7 };

/**
 * Si `punto` queda fuera de lo que ve la cámara (con la cámara cerca, o a un costado), lo trae de vuelta por la
 * recta hacia `salida` hasta que entre: la luciérnaga sigue señalando hacia el mismo lado, pero sin salirse del
 * cuadro. Cambia `punto` y lo devuelve.
 */
export function acercarAlCuadro(salida: THREE.Vector3, punto: THREE.Vector3, camara: THREE.Camera): THREE.Vector3 {
  const enPantalla = new THREE.Vector3();
  const dentro = (p: THREE.Vector3) => {
    enPantalla.copy(p).project(camara);
    return (
      Math.abs(enPantalla.x) <= CUADRO.ancho && Math.abs(enPantalla.y) <= CUADRO.alto && Math.abs(enPantalla.z) < 1
    );
  };
  if (dentro(punto)) return punto;
  const lejos = punto.clone();
  const p = new THREE.Vector3();
  let bien = 0;
  let mal = 1;
  for (let i = 0; i < 12; i++) {
    const t = (bien + mal) / 2;
    if (dentro(p.lerpVectors(salida, lejos, t))) bien = t;
    else mal = t;
  }
  return punto.lerpVectors(salida, lejos, bien);
}
