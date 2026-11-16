// Entrar a un nivel y no perderse (TU-62): el cartel con el número, el nombre y el lugar del nivel; el fundido en
// niebla al abrirlo y al reaparecer; y la luciérnaga que, después de 2 minutos sin llegar al próximo punto de
// control, señala hacia dónde seguir. Lo arma la escena del nivel (nivel.ts) y sirve igual en línea: todo sale de
// los pasos y de lo que se ve (dónde están los muñecos, el punto de control), así el invitado, que no simula, ve lo
// mismo que el anfitrión. Las cuentas están en ui/cartel-nivel.ts, ui/fundido.ts y niveles/pista.ts.
//
// Parámetros de la dirección:
//   &pista       la luciérnaga desde el principio, sin esperar los 2 minutos (para las capturas y para probar)
// Sin cartel con `&punto=` (se retoma a mitad del nivel), `&vista=` (la cámara quieta de las capturas) ni
// `&contrarreloj` (la carrera ya lleva el nombre arriba). Con `&vista=` tampoco hay fundido.
// Con «menos movimiento» (las Opciones, TU-60) los fundidos y el cartel son cortos y el cartel no se corre.
import * as THREE from "three";
import { menosMovimiento } from "../ajustes";
import type { CamaraDeDos } from "../camara";
import { PASO } from "../motor/bucle";
import type { Muneco } from "../muneco";
import type { PlanoDeNivel } from "../niveles";
import { acercarAlCuadro, crearEspera, destinoDeLaPista, type Espera, vueloDeLuciernaga } from "../niveles/pista";
import { type CartelDelNivel, crearCartelDelNivel, textoDelCartel, visibilidadDelCartel } from "../ui/cartel-nivel";
import { fundidoDeCaida, fundidoDeEntrada, fundidoTrasReaparecer, nieblaDeLasVistas } from "../ui/fundido";
import type { AvanceDeNivel } from "./tipos";

/** Si un muñeco se movió más que esto en un solo paso, reapareció (metros). */
const SALTO = 2;
/** Las capas de las dos cortinas de niebla: cada una la ve solo su cámara. */
const CAPA = { rojo: 29, turquesa: 30 } as const;
/** La luz de la luciérnaga: el punto, el halo y lo que alumbra alrededor. */
const LUCIERNAGA = {
  /** El punto, casi blanco, y el halo, cálido: sobre la niebla clara de día se lee por lo cálido. */
  color: 0xfff6e2,
  colorHalo: 0xffd27e,
  /** Lado del halo (metros). */
  halo: 0.9,
  /** Lado del punto del medio (metros). */
  punto: 0.2,
  /** Lo que alumbra a las siluetas de alrededor. */
  intensidad: 2.6,
  alcance: 3.2,
  /** Cuántos rastros la siguen, y cuántos pasos atrás va cada uno. */
  rastros: 3,
  atras: 7,
};

export interface Orientacion {
  /** En línea: si ya están conectados los dos. Antes no corre el cartel ni la cuenta de la pista. */
  conectados: boolean;
  /** Un paso de físicas, al final del paso de la escena. `jugando`: los muñecos reciben entrada (fuera del menú y
   * sin el panel de la meta). */
  pasar(jugando: boolean): void;
  dibujar(alfa: number): void;
  /** La cuenta de la pista (para las pruebas). */
  readonly pista: Espera;
}

export interface OpcionesOrientacion {
  readonly escena: THREE.Scene;
  readonly plano: PlanoDeNivel;
  readonly clave: string;
  readonly avance: AvanceDeNivel;
  readonly munecos: readonly [Muneco, Muneco];
  /** La cámara de los dos, o nada con la cámara quieta de `&vista=` (entonces no hay fundido). */
  readonly camaraDeDos?: CamaraDeDos;
  readonly parametros: URLSearchParams;
  /** Si hay página (en las pruebas de Node no hay cartel). */
  readonly conPantalla: boolean;
  /** En línea: el cartel y la pista esperan a que estén conectados. */
  readonly enRed: boolean;
}

export function crearOrientacion(o: OpcionesOrientacion): Orientacion {
  const { escena, plano, avance, munecos, parametros } = o;
  const carrera = parametros.has("contrarreloj");
  const quieta = parametros.has("vista");
  const texto = textoDelCartel(o.clave);
  const cartel: CartelDelNivel | undefined =
    o.conPantalla && texto && !parametros.has("punto") && !quieta && !carrera ? crearCartelDelNivel(texto) : undefined;
  const pista = crearEspera({ meta: avance.meta, forzada: parametros.has("pista") });
  const conPista = !carrera && !quieta;

  let pasos = 0;
  /** Pasos jugando (y conectados): de esto sale el cartel. */
  let pasosJugando = 0;
  let conectados = !o.enRed;

  // ── El fundido: una cortina de niebla delante de cada cámara ──────────────────────────────────────────────────
  const cortinas = o.camaraDeDos ? armarCortinas(escena, o.camaraDeDos) : undefined;
  /** Por jugador: la altura y la velocidad de la pelvis del paso anterior, y hace cuánto reapareció. */
  const antes = [new THREE.Vector3(), new THREE.Vector3()] as const;
  const desdeQueReaparecio = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const caida = [0, 0];
  /** La niebla de cada jugador y la de la entrada, en el paso anterior y en este, para dibujar entre medio. */
  const niebla = { antes: [0, 0, 1], ahora: [0, 0, 1] };

  // ── La luciérnaga ─────────────────────────────────────────────────────────────────────────────────────────────
  const luciernaga = conPista ? armarLuciernaga(escena) : undefined;
  const vuelo = {
    antes: new THREE.Vector3(),
    ahora: new THREE.Vector3(),
    salidaAntes: new THREE.Vector3(),
    salida: new THREE.Vector3(),
    brilloAntes: 0,
    brillo: 0,
  };
  const rastro: THREE.Vector3[] = [];
  const dondeSeVe = { luz: new THREE.Vector3(), salida: new THREE.Vector3(), rastro: [] as THREE.Vector3[] };
  const medio = new THREE.Vector3();

  const pasarFundido = () => {
    const corto = menosMovimiento();
    for (const j of [0, 1] as const) {
      const p = munecos[j].partes.pelvis.translation();
      const vy = (p.y - antes[j].y) / PASO;
      const salto = pasos > 0 && antes[j].distanceTo(p) > SALTO;
      desdeQueReaparecio[j] = salto ? 0 : (desdeQueReaparecio[j] ?? 0) + 1;
      caida[j] = pasos > 0 ? fundidoDeCaida(p.y, plano.vacio, vy) : 0;
      antes[j].set(p.x, p.y, p.z);
    }
    const de = (j: 0 | 1) => Math.max(caida[j] ?? 0, fundidoTrasReaparecer(desdeQueReaparecio[j] ?? 0, corto));
    niebla.antes = niebla.ahora;
    niebla.ahora = [de(0), de(1), fundidoDeEntrada(pasos + 1, corto)];
  };

  const pasarLuciernaga = () => {
    if (!luciernaga) return;
    vuelo.antes.copy(vuelo.ahora);
    vuelo.salidaAntes.copy(vuelo.salida);
    vuelo.brilloAntes = vuelo.brillo;
    const hacia = pista.encendida ? destinoDeLaPista(plano, avance.puntoDeControl()) : null;
    if (!hacia) {
      vuelo.brillo = 0;
      rastro.length = 0;
      return;
    }
    const a = munecos[0].partes.pelvis.translation();
    const b = munecos[1].partes.pelvis.translation();
    medio.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    const { brillo, salida } = vueloDeLuciernaga(medio, hacia, pista.pasos, vuelo.ahora);
    vuelo.salida.copy(salida);
    // El primer paso encendida no viene de ningún lado
    if (vuelo.brilloAntes === 0) {
      vuelo.antes.copy(vuelo.ahora);
      vuelo.salidaAntes.copy(vuelo.salida);
    }
    vuelo.brillo = brillo;
    rastro.unshift(vuelo.ahora.clone());
    rastro.length = Math.min(rastro.length, LUCIERNAGA.rastros * LUCIERNAGA.atras + 1);
  };

  return {
    get conectados() {
      return conectados;
    },
    set conectados(valor) {
      conectados = valor;
    },
    pista,
    pasar(jugando) {
      const enJuego = jugando && conectados;
      if (enJuego) pasosJugando++;
      pista.pasar(avance.puntoDeControl(), enJuego && conPista);
      pasarFundido();
      pasarLuciernaga();
      pasos++;
    },
    dibujar(alfa) {
      const corto = menosMovimiento();
      cartel?.poner(visibilidadDelCartel(pasosJugando, corto), corto);
      const entre = (i: number) => lerp(niebla.antes[i] ?? 0, niebla.ahora[i] ?? 0, alfa);
      cortinas?.poner(entre(0), entre(1), entre(2));
      if (luciernaga) {
        const brillo = lerp(vuelo.brilloAntes, vuelo.brillo, alfa);
        const { luz, salida } = dondeSeVe;
        luz.lerpVectors(vuelo.antes, vuelo.ahora, alfa);
        salida.lerpVectors(vuelo.salidaAntes, vuelo.salida, alfa);
        // Con la pantalla entera, que no se salga del cuadro (la cámara ya está puesta para este cuadro)
        const camara = o.camaraDeDos && !o.camaraDeDos.vistas.partida ? o.camaraDeDos.camara : undefined;
        dondeSeVe.rastro = rastro.map((p) => p.clone());
        if (camara) {
          camara.updateMatrixWorld();
          acercarAlCuadro(salida, luz, camara);
          for (const p of dondeSeVe.rastro) acercarAlCuadro(salida, p, camara);
        }
        luciernaga.poner(luz, brillo, dondeSeVe.rastro);
      }
    },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Una cortina de niebla pegada delante de cada cámara: la del rojo (la pantalla entera, o su mitad) y la del
 * turquesa (su mitad con la pantalla partida). Pasan por la imagen como todo lo demás (grano, viñeta). Cuánta niebla
 * lleva cada una se decide al dibujarse, con la costura de ese cuadro: así la pantalla que se parte o se junta pasa
 * sin saltos de un fundido al otro. */
function armarCortinas(escena: THREE.Scene, camaraDeDos: CamaraDeDos) {
  const plano = new THREE.PlaneGeometry(1, 1);
  const enfrente = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 0, -0.2),
    new THREE.Quaternion(),
    new THREE.Vector3(20, 20, 1),
  );
  const color = () => (escena.fog instanceof THREE.Fog ? escena.fog.color : new THREE.Color(0xdedfdc));
  let jugadores: readonly [number, number] = [0, 0];
  let entrada = 0;
  const cortina = (camara: THREE.Camera, capa: number, cual: 0 | 1) => {
    const material = new THREE.MeshBasicMaterial({
      color: color().clone(),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const malla = new THREE.Mesh(plano, material);
    malla.name = "cortina de niebla";
    malla.frustumCulled = false;
    malla.renderOrder = 10_000;
    malla.matrixAutoUpdate = false;
    malla.matrixWorldAutoUpdate = false;
    malla.visible = false;
    malla.layers.set(capa);
    camara.layers.enable(capa);
    // Justo antes de dibujarse: delante de la cámara que la dibuja, y con la niebla que le toca a esa vista
    malla.onBeforeRender = (_pintor, _escena, camaraQueDibuja) => {
      malla.matrixWorld.multiplyMatrices(camaraQueDibuja.matrixWorld, enfrente);
      material.opacity = nieblaDeLasVistas(jugadores[0], jugadores[1], camaraDeDos.vistas.costura, entrada)[cual];
      // De noche la niebla es otra
      material.color.copy(color());
    };
    escena.add(malla);
    return malla;
  };
  const mallas = [cortina(camaraDeDos.camara, CAPA.rojo, 0), cortina(camaraDeDos.vistas.camaraB, CAPA.turquesa, 1)];
  return {
    poner(rojo: number, turquesa: number, deEntrada: number) {
      jugadores = [rojo, turquesa];
      entrada = deEntrada;
      const alguna = Math.max(rojo, turquesa, entrada) > 0.002;
      for (const m of mallas) m.visible = alguna;
    },
  };
}

/** Un halo redondo y suave, de blanco a nada, hecho a mano (sirve también sin página, en las pruebas). */
function texturaDeHalo(lado = 64): THREE.DataTexture {
  const datos = new Uint8Array(lado * lado * 4);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = (x + 0.5) / lado - 0.5;
      const dy = (y + 0.5) / lado - 0.5;
      const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) * 2);
      const a = (1 - r) ** 2.2;
      const i = (y * lado + x) * 4;
      datos[i] = 255;
      datos[i + 1] = 255;
      datos[i + 2] = 255;
      datos[i + 3] = Math.round(a * 255);
    }
  }
  const textura = new THREE.DataTexture(datos, lado, lado);
  textura.magFilter = THREE.LinearFilter;
  textura.minFilter = THREE.LinearFilter;
  textura.needsUpdate = true;
  return textura;
}

/** La luciérnaga: un punto de luz cálida con su halo, unos rastros que se apagan detrás y una luz que alumbra las
 * siluetas de alrededor. No la tapa la niebla del nivel. Apagada, no se dibuja (la luz queda en 0 para que la escena
 * no cambie de sombreado al encenderla). */
function armarLuciernaga(escena: THREE.Scene) {
  const halo = texturaDeHalo();
  const sprite = (lado: number, opacidad: number, color = LUCIERNAGA.color) => {
    const material = new THREE.SpriteMaterial({
      map: halo,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    const s = new THREE.Sprite(material);
    s.scale.setScalar(lado);
    s.visible = false;
    s.renderOrder = 9_000;
    s.userData.opacidad = opacidad;
    escena.add(s);
    return s;
  };
  const grupoHalo = sprite(LUCIERNAGA.halo, 0.85, LUCIERNAGA.colorHalo);
  const punto = sprite(LUCIERNAGA.punto, 1);
  const rastros = Array.from({ length: LUCIERNAGA.rastros }, (_, i) =>
    sprite(LUCIERNAGA.punto * (0.9 - i * 0.2), 0.6 - i * 0.15, LUCIERNAGA.colorHalo),
  );
  const luz = new THREE.PointLight(LUCIERNAGA.colorHalo, 0, LUCIERNAGA.alcance, 2);
  escena.add(luz);
  const encender = (s: THREE.Sprite, donde: THREE.Vector3, brillo: number) => {
    s.visible = brillo > 0.003;
    s.position.copy(donde);
    (s.material as THREE.SpriteMaterial).opacity = brillo * (s.userData.opacidad as number);
  };
  return {
    poner(donde: THREE.Vector3, brillo: number, rastro: readonly THREE.Vector3[]) {
      encender(grupoHalo, donde, brillo);
      encender(punto, donde, brillo);
      rastros.forEach((s, i) => {
        const atras = rastro[(i + 1) * LUCIERNAGA.atras];
        if (atras) encender(s, atras, brillo);
        else s.visible = false;
      });
      luz.position.copy(donde);
      luz.intensity = LUCIERNAGA.intensidad * brillo;
    },
  };
}
