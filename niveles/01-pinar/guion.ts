// El guion del nivel 1, El pinar (TU-14). Lo que la escena no puede decir:
//   · El portón del corral se corre mientras la tranca está afuera, y pasado el punto 5 queda abierto (así el que
//     la sostenía también pasa).
//   · La puerta de la pulpería se abre al encender la lámpara del alero (y queda abierta).
//   · El tronco que quedó tirado en el suelo sin servir de puente vuelve a sus caballetes: del suelo no se lo
//     puede levantar (las manos agarran a la altura del pecho).
//   · El balancín empieza ya inclinado como queda en reposo (la punta de la quebrada arriba): si arrancara derecho
//     tardaría unos segundos en bajar, y el que llega rápido pasaría por debajo.
//   · El logro, «Ni una lamida»: llegar al punto 5 sin que el Cadejo haya lamido a ninguno de los dos.
//   · El nido del secreto (la zona `secreto` del .glb lo encuentra sola) se dibuja acá, sobre el escalón más alto.
// Los huacales y el tronco que caen al vacío vuelven solos a su lugar, y el hueso, cuando el Cadejo lo termina.
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearNido } from "../../apps/juego/src/niveles/piezas-pinar";

/** El portón y la puerta: hacia dónde se corren (z) y en cuántos pasos. */
const PORTON = { nombre: "porton", correr: -1.75, pasos: 20 };
const PUERTA = { nombre: "puerta", correr: 1.25, pasos: 50 };
/** El tronco tirado: más bajo que esto sobre el piso de la loma es que está en el suelo (m); quieto tantos pasos,
 * vuelve. Entre estas x está la zanja: si cruza de una orilla a la otra, es el puente y se queda. */
const TRONCO = { bajo: 0.7, quieto: 180, zanja: [33.6, 35.2] as const, piso: 2.85 };
/** El balancín: su eje (x, sobre el borde de la quebrada) y el tope, como en scripts/niveles/pinar.mjs. */
const BALANCIN = { eje: 13.3, angulo: (17 * Math.PI) / 180 };
/** Dónde va el nido: sobre el escalón más alto del pino. */
const NIDO = { x: 49.7, y: 3.25 + 4.5, z: -2.45 };

/** Una cosa que el guion corre (cinemática): cuánto está abierta, de 0 a 1. */
interface Corredera {
  readonly nombre: string;
  readonly correr: number;
  readonly pasos: number;
  inicio: { x: number; y: number; z: number };
  abierta: number;
}

/** Lleva la corredera hacia abierta o cerrada, un paso de su recorrido (o de una vez, con `ya`). */
function mover(nivel: NivelEnJuego, c: Corredera, abrir: boolean, ya = false) {
  const cuerpo = nivel.pieza(c.nombre).cuerpo;
  if (!cuerpo) return;
  const objetivo = abrir ? 1 : 0;
  const falta = objetivo - c.abierta;
  c.abierta = ya ? objetivo : c.abierta + Math.sign(falta) * Math.min(1 / c.pasos, Math.abs(falta));
  const t = c.abierta * c.abierta * (3 - 2 * c.abierta);
  const destino = { x: c.inicio.x, y: c.inicio.y, z: c.inicio.z + c.correr * t };
  if (ya) cuerpo.setTranslation(destino, true);
  cuerpo.setNextKinematicTranslation(destino);
}

/** Pone la tabla del balancín en su tope, girada sobre el eje: baja la punta de tierra y sube la de la quebrada. */
function inclinarBalancin(nivel: NivelEnJuego) {
  const tabla = nivel.balancin("balancin").tabla;
  const t = tabla.translation();
  const { eje, angulo } = BALANCIN;
  // La tabla empieza derecha, con el eje a su altura: se la gira `angulo` alrededor de +z, sobre el eje
  const dx = t.x - eje;
  tabla.setTranslation({ x: eje + dx * Math.cos(angulo), y: t.y + dx * Math.sin(angulo), z: t.z }, true);
  tabla.setRotation({ x: 0, y: 0, z: Math.sin(angulo / 2), w: Math.cos(angulo / 2) }, true);
}

export function crearGuion(): GuionDeNivel {
  const porton: Corredera = { ...PORTON, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const puerta: Corredera = { ...PUERTA, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  let lamido = false;
  let troncoQuieto = 0;

  /** Si el tronco está tendido de una orilla de la zanja a la otra. */
  const esPuente = (nivel: NivelEnJuego) => {
    const [a, b] = nivel.tronco("tronco").puntas();
    const [desde, hasta] = TRONCO.zanja;
    return Math.min(a.x, b.x) < desde && Math.max(a.x, b.x) > hasta;
  };

  return {
    alEmpezar(nivel) {
      porton.inicio = { ...(nivel.pieza(PORTON.nombre).cuerpo?.translation() ?? porton.inicio) };
      puerta.inicio = { ...(nivel.pieza(PUERTA.nombre).cuerpo?.translation() ?? puerta.inicio) };
      nivel.cadejo("cadejo").alLamer(() => {
        lamido = true;
      });
      inclinarBalancin(nivel);
      const nido = crearNido();
      nido.position.set(NIDO.x, NIDO.y, NIDO.z);
      nivel.escena.add(nido);
    },
    alAlcanzar(punto, nivel) {
      // Pasaron el corral sin una sola lamida
      if (punto === 5 && !lamido) nivel.lograr();
    },
    alRetomar(punto, nivel) {
      // Retomando más allá del corral el portón ya quedó abierto; más allá de la pulpería, la lámpara encendida
      mover(nivel, porton, punto >= 5, true);
      mover(nivel, puerta, punto >= 6, true);
      if (punto >= 6) nivel.lampara("lampara").encender();
      nivel.cadejo("cadejo").volver();
    },
    cadaPaso(nivel) {
      mover(nivel, porton, nivel.tranca("tranca").abierta || nivel.puntoDeControl >= 5);
      mover(nivel, puerta, nivel.lampara("lampara").encendida || nivel.puntoDeControl >= 6);

      // El tronco tirado en el suelo, sin nadie que lo tenga y sin servir de puente, vuelve a sus caballetes
      const tronco = nivel.tronco("tronco");
      const t = tronco.cuerpo.translation();
      const v = tronco.cuerpo.linvel();
      const tirado = tronco.cargadores === 0 && t.y < TRONCO.piso + TRONCO.bajo && Math.hypot(v.x, v.y, v.z) < 0.05;
      troncoQuieto = tirado && !esPuente(nivel) ? troncoQuieto + 1 : 0;
      if (troncoQuieto > TRONCO.quieto) {
        tronco.volver();
        troncoQuieto = 0;
      }
    },
  };
}
