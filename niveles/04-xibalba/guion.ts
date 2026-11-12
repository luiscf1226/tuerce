// El guion del nivel 4, Xibalbá de juguete (TU-26). Lo que la escena no puede decir:
//   · La entrada de la muralla se hunde cuando los dos pisan a la vez la plancha doble, y queda abierta.
//   · La reja se hunde cuando la estela queda alineada (el glifo del sol mirando la reja).
//   · El portón de la cancha se hunde cuando la pelota pasa por el aro (de adelante hacia atrás, por adentro).
//   · El bloque que queda tirado sin servir (ni en su altar ni contra la pared del templo) vuelve a su altar: del
//     suelo no se lo puede levantar (las manos agarran a la altura del pecho).
//   · La antorcha apagada se vuelve a prender acercándole la llama al brasero de la entrada del túnel.
//   · La llave de jade se encaja sola al llegar a la cerradura de la puerta del fondo del túnel, y la puerta se
//     hunde.
//   · La losa de la tumba sube con el contrapeso: tanto como se hunde el plato (con las dos piedras, del todo).
//   · Lo invisible del lado de la cámara (las `-baranda`) ataja solo a los muñecos: la cámara no lo ve.
//   · El logro, «Con luz»: llegar al punto 5 sin que los murciélagos hayan apagado la antorcha ni una vez.
//   · La guacamaya dorada del secreto (la zona `secreto` del .glb la encuentra sola) y el fuego del brasero se
//     dibujan acá.
// Los bloques, la pelota, la antorcha y la llave que caen al vacío o quedan tirados vuelven solos a su lugar.
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import {
  crearFuego,
  crearGuacamayaDorada,
  crearSoga,
  type Soga,
  soloParaMunecos,
} from "../../apps/juego/src/niveles/piezas-xibalba";

/** Las alturas del suelo, como en scripts/niveles/xibalba.mjs. */
const Y1 = 1.8;
const Y2 = 4.1;
/** Las compuertas que se hunden: cuánto y en cuántos pasos. */
const HUNDIR = { metros: 2.7, pasos: 40 };
/** El aro: su centro, su plano (z) y el radio del hueco (sin el grueso). */
const ARO = { x: 23, y: 2.05, z: -1.15, hueco: 0.5 };
/** Dónde sirve el bloque: contra la pared del templo, sobre la terraza. */
const CONTRA_LA_PARED = { x: 40.4 };
/** Tirado sin servir tantos pasos, el bloque vuelve a su altar (y las piedras del contrapeso, a su repisa). */
const BLOQUE_QUIETO = 180;
/** Las piedras del contrapeso: dónde sirven (en su repisa, o encima del plato). */
const PIEDRAS = ["piedra-1", "piedra-2"] as const;
/** La cerradura de la puerta de jade (la llave entra si llega a `cerca`), y cómo queda encajada. */
const CERRADURA = { x: 54.92, y: Y2 + 1.15, z: 0.9, cerca: 0.45 };
/** El fuego del brasero: acercarle la llama a menos de `cerca` la prende. */
const BRASERO = { x: 44.75, y: Y2 + 1.65, z: -1.45, cerca: 0.8 };
/** La losa sube `metros` con el plato hundido del todo; con menos de `desde`, nada. */
const LOSA = { metros: 2.4, desde: 0.25, hasta: 0.85 };
/** La polea del contrapeso: de ahí bajan las sogas al plato y a la losa. */
const POLEA = { x: 58.4, y: Y2 + 3.5, z: 1.9 };
/** Dónde va la guacamaya dorada: en lo alto del templo, al pie de la crestería. */
const DORADA = { x: 48.9, y: Y2 + 4.5, z: -2.1 };

const suave = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Una compuerta cinemática que se hunde: cuánto está abierta, de 0 a 1. */
interface Compuerta {
  readonly nombre: string;
  arriba: { x: number; y: number; z: number };
  abierta: number;
}

/** Lleva la compuerta hacia abierta o cerrada, un paso de su recorrido (o de una vez, con `ya`). */
function hundir(nivel: NivelEnJuego, c: Compuerta, abrir: boolean, ya = false) {
  const cuerpo = nivel.pieza(c.nombre).cuerpo;
  if (!cuerpo) return;
  const objetivo = abrir ? 1 : 0;
  const falta = objetivo - c.abierta;
  c.abierta = ya ? objetivo : c.abierta + Math.sign(falta) * Math.min(1 / HUNDIR.pasos, Math.abs(falta));
  const destino = { x: c.arriba.x, y: c.arriba.y - HUNDIR.metros * suave(c.abierta), z: c.arriba.z };
  if (ya) cuerpo.setTranslation(destino, true);
  cuerpo.setNextKinematicTranslation(destino);
}

export function crearGuion(): GuionDeNivel {
  const entrada: Compuerta = { nombre: "entrada", arriba: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const reja: Compuerta = { nombre: "reja", arriba: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const porton: Compuerta = { nombre: "porton", arriba: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const puerta: Compuerta = { nombre: "puerta-jade", arriba: { x: 0, y: 0, z: 0 }, abierta: 0 };
  let losaAbajo = { x: 0, y: 0, z: 0 };
  let pisaron = false;
  let anotaron = false;
  let pelotaZ = Number.POSITIVE_INFINITY;
  let bloqueQuieto = 0;
  const piedrasQuietas = new Map<string, number>();
  let sinApagar = true;
  /** Las sogas del contrapeso: de la polea al plato y a la losa (se estiran cada paso). */
  const sogas: Soga[] = [];

  /** Si el bloque está donde sirve: en su altar, contra la pared del templo o en el aire (lo llevan). */
  const bloqueSirve = (nivel: NivelEnJuego) => {
    const bloque = nivel.bloque("bloque");
    if (bloque.cargadores > 0) return true;
    const t = bloque.cuerpo.translation();
    const v = bloque.cuerpo.linvel();
    if (Math.hypot(v.x, v.y, v.z) > 0.05) return true;
    if (t.x > CONTRA_LA_PARED.x && t.y > Y1 && t.y < Y1 + 0.6) return true;
    return t.y > 0.85 && t.x < 32.5;
  };

  /** Si la piedra está donde sirve: en su repisa, encima del plato o en las manos de alguien (o todavía rodando). */
  const piedraSirve = (nivel: NivelEnJuego, nombre: string) => {
    const piedra = nivel.bloque(nombre);
    if (piedra.cargadores > 0) return true;
    const t = piedra.cuerpo.translation();
    const v = piedra.cuerpo.linvel();
    if (Math.hypot(v.x, v.y, v.z) > 0.05) return true;
    if (t.y > Y2 + 0.8) return true;
    const plato = nivel.plancha("plato").placa.translation();
    return Math.hypot(t.x - plato.x, t.z - plato.z) < 0.6;
  };

  return {
    alEmpezar(nivel) {
      // Las barandas (lo invisible del lado de la cámara) atajan solo a los muñecos
      for (const s of nivel.plano.solidos)
        if (s.nombre.endsWith("-baranda")) soloParaMunecos(nivel.pieza(s.nombre).colisionador);
      for (const c of [entrada, reja, porton, puerta]) {
        c.arriba = { ...(nivel.pieza(c.nombre).cuerpo?.translation() ?? c.arriba) };
      }
      losaAbajo = { ...(nivel.pieza("losa").cuerpo?.translation() ?? losaAbajo) };
      nivel.murcielagos("murcielagos").alApagar(() => {
        sinApagar = false;
      });
      const dorada = crearGuacamayaDorada();
      dorada.position.set(DORADA.x, DORADA.y, DORADA.z);
      nivel.escena.add(dorada);
      const fuego = crearFuego();
      fuego.position.set(BRASERO.x, Y2 + 1.5, BRASERO.z);
      nivel.escena.add(fuego);
      for (let i = 0; i < 2; i++) {
        const soga = crearSoga();
        sogas.push(soga);
        nivel.escena.add(soga.objeto);
      }
      const placa = nivel.plancha("plato").placa.translation();
      sogas[0]?.estirar(POLEA, { x: placa.x, y: placa.y + 0.05, z: placa.z });
      sogas[1]?.estirar(POLEA, { x: losaAbajo.x, y: losaAbajo.y + 1.5, z: 0 });
    },
    alAlcanzar(punto, nivel) {
      // Cruzaron el túnel sin que se apagara la antorcha
      if (punto === 5 && sinApagar) nivel.lograr();
    },
    alRetomar(punto, nivel) {
      // Retomando más adelante, lo de antes ya quedó hecho
      pisaron ||= punto >= 1;
      anotaron ||= punto >= 3;
      hundir(nivel, entrada, punto >= 1, true);
      if (punto >= 2) nivel.estela("estela").alinear();
      hundir(nivel, reja, punto >= 2, true);
      hundir(nivel, porton, punto >= 3, true);
      if (punto >= 4) nivel.bloque("bloque").ponerEn({ x: 41.2, y: Y1 + 0.25, z: 0.6 });
      if (punto >= 5) {
        nivel.llave("llave").encajar(CERRADURA);
      }
      hundir(nivel, puerta, punto >= 5, true);
      nivel.antorcha("antorcha").volver();
      nivel.murcielagos("murcielagos").volver();
    },
    cadaPaso(nivel) {
      // 1. La plancha doble: con los dos encima a la vez se abre la entrada, y queda abierta
      pisaron ||= nivel.doble("planchas").pisada;
      hundir(nivel, entrada, pisaron);
      // 2. La estela alineada hunde la reja
      hundir(nivel, reja, nivel.estela("estela").alineada);
      // 3. La pelota por el aro: cruza su plano de adelante hacia atrás, por el hueco
      const pelota = nivel.pelota("pelota").cuerpo.translation();
      if (!anotaron && pelotaZ > ARO.z && pelota.z <= ARO.z) {
        anotaron = Math.hypot(pelota.x - ARO.x, pelota.y - ARO.y) < ARO.hueco;
      }
      pelotaZ = pelota.z;
      hundir(nivel, porton, anotaron);
      // 4. El bloque tirado sin servir vuelve a su altar
      bloqueQuieto = bloqueSirve(nivel) ? 0 : bloqueQuieto + 1;
      if (bloqueQuieto > BLOQUE_QUIETO) {
        nivel.bloque("bloque").volver();
        bloqueQuieto = 0;
      }
      for (const nombre of PIEDRAS) {
        const quieta = piedraSirve(nivel, nombre) ? 0 : (piedrasQuietas.get(nombre) ?? 0) + 1;
        piedrasQuietas.set(nombre, quieta > BLOQUE_QUIETO ? 0 : quieta);
        if (quieta > BLOQUE_QUIETO) nivel.bloque(nombre).volver();
      }
      // 5. La antorcha apagada se prende en el brasero; la llave en su cerradura abre la puerta de jade
      const antorcha = nivel.antorcha("antorcha");
      if (!antorcha.encendida) {
        const l = antorcha.llama();
        if (Math.hypot(l.x - BRASERO.x, l.y - BRASERO.y, l.z - BRASERO.z) < BRASERO.cerca) antorcha.encender();
      }
      const llave = nivel.llave("llave");
      if (!llave.encajada) {
        const t = llave.cuerpo.translation();
        if (Math.hypot(t.x - CERRADURA.x, t.y - CERRADURA.y, t.z - CERRADURA.z) < CERRADURA.cerca) {
          llave.encajar(CERRADURA);
        }
      }
      hundir(nivel, puerta, llave.encajada);
      // 6. La losa sube con el contrapeso
      const plato = nivel.plancha("plato");
      const losa = nivel.pieza("losa").cuerpo;
      const sube = LOSA.metros * suave((plato.hundida - LOSA.desde) / (LOSA.hasta - LOSA.desde));
      const arriba = { x: losaAbajo.x, y: losaAbajo.y + sube, z: losaAbajo.z };
      losa?.setNextKinematicTranslation(arriba);
      const placa = plato.placa.translation();
      sogas[0]?.estirar(POLEA, { x: placa.x, y: placa.y + 0.05, z: placa.z });
      sogas[1]?.estirar(POLEA, { x: arriba.x, y: arriba.y + 1.5, z: 0 });
    },
  };
}
