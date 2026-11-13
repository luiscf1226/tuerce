// El guion del nivel 3, La calle empedrada (TU-25). Lo que la escena no puede decir:
//   · La carreta de la cuesta se traba al llegar arriba (una cuña): así no se les vuelve encima al pasar.
//   · La Carreta sin bueyes se para mientras alguien empuja el freno; pasado el punto 2 queda frenada (así el que lo
//     sostenía también pasa).
//   · La puerta de la torre sube cuando las dos pesas llegan abajo (las agujas quedan en las doce), y queda abierta.
//   · La reja del mirador sube cuando las dos campanas suenan juntas, y queda abierta.
//   · La carreta del mirador espera frenada hasta que suben los dos y no está empinada; entonces baja sola. Si en la
//     bajada se empina (el peso atrás), vuelca: los dos salen volando a la barranca y la carreta vuelve arriba.
//   · El logro, «Ni una pisada»: llegar al punto 4 con las alfombras intactas.
//   · El pilón del secreto (la zona `secreto` del .glb lo encuentra sola), la esfera del reloj y el empedrado se
//     dibujan acá; y las tapias de los callejones no le tapan la vista a la cámara.
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearEmpedrado, crearEsfera, crearPilon } from "../../apps/juego/src/niveles/piezas-calle";

/** Lo que sube (cinemático): cuánto (m) y en cuántos pasos. */
const PUERTA = { nombre: "puerta-torre", subir: 2.5, pasos: 70 };
const REJA = { nombre: "reja", subir: 2.7, pasos: 50 };
/** La carreta del mirador: con cuánto de empinada vuelca en la bajada (rad), durante cuántos pasos, desde qué
 * velocidad (m/s); cuántos pasos tienen que estar los dos arriba, derechos, para que arranque; cuánto espera abajo
 * antes de volver. */
const MIRADOR = {
  nombre: "carreta-mirador",
  vuelca: (9 * Math.PI) / 180,
  pasosEmpinada: 12,
  rapida: 0.4,
  derecha: (3 * Math.PI) / 180,
  pasosParaSalir: 30,
  esperaAbajo: 90,
};
/** El empujón del vuelco (m/s): hacia atrás, hacia un costado y para arriba. */
const VUELCO = { atras: 3, costado: 2.5, arriba: 3 };
/** Dónde se dibujan la esfera del reloj y el pilón (como en scripts/niveles/calle.mjs). */
const ESFERA = { x: 3.6, y: 1.9 + 7.2, z: 1.84, radio: 1.15 };
/** Las calles empedradas (como en scripts/niveles/calle.mjs): las alfombras y la plaza quedan sin piedras. */
const Y1 = 1.9;
const YP = Y1 - 12 * Math.sin((12 * Math.PI) / 180) - 0.7;
const CALLES = [
  { x0: -48, x1: -37, z0: -3.5, z1: 3.5, y0: 0 },
  { x0: -37, x1: -31, z0: -0.85, z1: 0.85, y0: 0, y1: (6 * Y1) / 9 },
  { x0: -31, x1: -28, z0: -3.5, z1: 3.6, y0: (6 * Y1) / 9, y1: Y1 },
  { x0: -28, x1: -14.4, z0: -3.7, z1: 3.7, y0: Y1 },
  { x0: -14.4, x1: -5.4, z0: -0.85, z1: 0.85, y0: Y1 },
  { x0: -4.6, x1: 12.6, z0: -3.4, z1: 3.4, y0: Y1 },
  { x0: 25.7, x1: 46, z0: -3.2, z1: 2.4, y0: Y1 },
  { x0: 55.5, x1: 62, z0: -4, z1: 4, y0: YP },
];
/** Las tapias delgadas de los callejones, del lado de la cámara: chocan con todo menos con el rayo con que la cámara
 * mira si algo le tapa a los muñecos (su bit de grupo es el 0, ver camara/despejado.ts). Si no, en los callejones
 * angostos la cámara se pegaría a la tapia. */
const TAPIAS = ["callejon-tapia", "tapia-carreta"];
const SIN_LA_CAMARA = ((0xffff << 16) | 0xfffe) >>> 0;
const PILON = { x: -20.6, y: 1.9 + 2.0, z: -2.4 };

type Vector = { x: number; y: number; z: number };
/** El vector `v` girado por el cuaternión `q`, en el piso (sin su altura) y de largo 1. */
function enElPiso(q: Vector & { w: number }, v: Vector): Vector {
  // v + 2w (q × v) + 2 q × (q × v)
  const cx = q.y * v.z - q.z * v.y;
  const cy = q.z * v.x - q.x * v.z;
  const cz = q.x * v.y - q.y * v.x;
  const x = v.x + 2 * (q.w * cx + q.y * cz - q.z * cy);
  const z = v.z + 2 * (q.w * cz + q.x * cy - q.y * cx);
  const largo = Math.hypot(x, z) || 1;
  return { x: x / largo, y: 0, z: z / largo };
}

/** Una cosa que el guion sube (cinemática): cuánto está abierta, de 0 a 1. */
interface Subida {
  readonly nombre: string;
  readonly subir: number;
  readonly pasos: number;
  inicio: { x: number; y: number; z: number };
  abierta: number;
}

/** Lleva la subida hacia abierta o cerrada, un paso de su recorrido (o de una vez, con `ya`). */
function mover(nivel: NivelEnJuego, s: Subida, abrir: boolean, ya = false) {
  const cuerpo = nivel.pieza(s.nombre).cuerpo;
  if (!cuerpo) return;
  const objetivo = abrir ? 1 : 0;
  const falta = objetivo - s.abierta;
  s.abierta = ya ? objetivo : s.abierta + Math.sign(falta) * Math.min(1 / s.pasos, Math.abs(falta));
  const t = s.abierta * s.abierta * (3 - 2 * s.abierta);
  const destino = { x: s.inicio.x, y: s.inicio.y + s.subir * t, z: s.inicio.z };
  if (ya) cuerpo.setTranslation(destino, true);
  cuerpo.setNextKinematicTranslation(destino);
}

export function crearGuion(): GuionDeNivel {
  const puerta: Subida = { ...PUERTA, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  const reja: Subida = { ...REJA, inicio: { x: 0, y: 0, z: 0 }, abierta: 0 };
  let rejaAbierta = false;
  /** La carreta del mirador: si ya salió, si volcó, cuántos pasos lleva cada cosa. */
  const bajada = { salio: false, volco: false, listos: 0, empinada: 0, abajo: 0 };

  const ponerEnElMirador = (nivel: NivelEnJuego) => {
    const carreta = nivel.carreta(MIRADOR.nombre);
    carreta.frenar(false);
    carreta.volver();
    carreta.frenar(true);
    Object.assign(bajada, { salio: false, volco: false, listos: 0, empinada: 0, abajo: 0 });
  };

  /** El vuelco: los que van arriba salen volando hacia atrás y a un costado, a la barranca. */
  const volcar = (nivel: NivelEnJuego) => {
    const carreta = nivel.carreta(MIRADOR.nombre);
    const q = carreta.cuerpo.rotation();
    const atras = enElPiso(q, { x: -1, y: 0, z: 0 });
    const costado = enElPiso(q, { x: 0, y: 0, z: 1 });
    const c = carreta.cuerpo.translation();
    nivel.munecos.forEach((m, i) => {
      const p = m.partes.pelvis.translation();
      if (Math.hypot(p.x - c.x, p.z - c.z) > 1.8) return;
      const lado = i === 0 ? 1 : -1;
      for (const parte of Object.values(m.partes)) {
        const masa = parte.mass();
        parte.applyImpulse(
          {
            x: (atras.x * VUELCO.atras + costado.x * VUELCO.costado * lado) * masa,
            y: VUELCO.arriba * masa,
            z: (atras.z * VUELCO.atras + costado.z * VUELCO.costado * lado) * masa,
          },
          true,
        );
      }
    });
    bajada.volco = true;
  };

  return {
    alEmpezar(nivel) {
      puerta.inicio = { ...(nivel.pieza(PUERTA.nombre).cuerpo?.translation() ?? puerta.inicio) };
      reja.inicio = { ...(nivel.pieza(REJA.nombre).cuerpo?.translation() ?? reja.inicio) };
      nivel.carreta(MIRADOR.nombre).frenar(true);
      const esfera = crearEsfera(ESFERA.radio);
      esfera.position.set(ESFERA.x, ESFERA.y, ESFERA.z);
      nivel.escena.add(esfera);
      nivel.escena.add(crearEmpedrado(CALLES));
      for (const tapia of TAPIAS) nivel.pieza(tapia).colisionador.setCollisionGroups(SIN_LA_CAMARA);
      const pilon = crearPilon();
      pilon.position.set(PILON.x, PILON.y, PILON.z);
      nivel.escena.add(pilon);
    },
    alAlcanzar(punto, nivel) {
      // Pasaron las alfombras sin pisarlas
      if (punto === 4 && [1, 2, 3].every((i) => nivel.alfombra(`alfombra-${i}`).intacta)) nivel.lograr();
    },
    alRetomar(punto, nivel) {
      // Retomando más allá de cada misión, lo de esa misión queda como al pasarla
      const cuesta = nivel.carreta("carreta");
      if (punto >= 1 && !cuesta.trabada) {
        cuesta.ponerEn(7.1);
        cuesta.trabar();
      }
      const sinBueyes = nivel.sinBueyes("carreta-sin-bueyes");
      sinBueyes.frenar(punto >= 2);
      sinBueyes.volver();
      if (punto >= 3) {
        nivel.pesa("pesa-1").bajar();
        nivel.pesa("pesa-2").bajar();
      }
      mover(nivel, puerta, punto >= 3, true);
      rejaAbierta ||= punto >= 5;
      mover(nivel, reja, rejaAbierta, true);
      ponerEnElMirador(nivel);
    },
    cadaPaso(nivel) {
      // 1. La carreta de la cuesta se traba arriba
      const cuesta = nivel.carreta("carreta");
      if (!cuesta.trabada && cuesta.avance > 7.0) cuesta.trabar();

      // 2. El freno de la Carreta sin bueyes (y pasado el punto 2, frenada para siempre)
      nivel.sinBueyes("carreta-sin-bueyes").frenar(nivel.palanca("freno").activa || nivel.puntoDeControl >= 2);

      // 3. La puerta de la torre sube con las dos pesas abajo
      const reloj = nivel.pesa("pesa-1").llego && nivel.pesa("pesa-2").llego;
      mover(nivel, puerta, reloj || nivel.puntoDeControl >= 3);

      // 5. La reja sube cuando las dos campanas suenan juntas
      rejaAbierta ||= nivel.campana("campana-1").sonando && nivel.campana("campana-2").sonando;
      mover(nivel, reja, rejaAbierta || nivel.puntoDeControl >= 5);

      // 6. La carreta del mirador: arranca con los dos arriba y derecha; si se empina en la bajada, vuelca
      const carreta = nivel.carreta(MIRADOR.nombre);
      if (!bajada.salio) {
        bajada.listos = carreta.encima === 2 && carreta.empinada < MIRADOR.derecha ? bajada.listos + 1 : 0;
        if (bajada.listos >= MIRADOR.pasosParaSalir) {
          bajada.salio = true;
          carreta.frenar(false);
        }
        return;
      }
      if (!bajada.volco) {
        const empinada = carreta.velocidad > MIRADOR.rapida && carreta.empinada > MIRADOR.vuelca;
        bajada.empinada = empinada ? bajada.empinada + 1 : 0;
        if (bajada.empinada >= MIRADOR.pasosEmpinada && nivel.puntoDeControl < 6) volcar(nivel);
      }
      // Abajo, quieta y sin llegar a la meta (volcó, o se bajaron en el camino): vuelve al mirador
      const quieta = Math.abs(carreta.velocidad) < 0.05;
      bajada.abajo = quieta && nivel.puntoDeControl < 6 ? bajada.abajo + 1 : 0;
      if (bajada.abajo > MIRADOR.esperaAbajo) ponerEnElMirador(nivel);
    },
  };
}
