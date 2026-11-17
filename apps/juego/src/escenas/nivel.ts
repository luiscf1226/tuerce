// Un nivel con el formato nuevo (TU-11), para dos jugadores en el mismo lugar como la escena `dos`: la escena sale
// de un .glb de niveles/ y su guion, con puntos de control y reaparición junto al compañero. Están los 17 de la
// historia (niveles/00-patio a 16-medianoche, en orden en src/niveles/orden.ts) y dos de prueba (98-piezas, 99-prueba).
//
// Parámetros (además de los de `dos`: `&j1=`, `&j2=`, `&ayuda`, `&menu`):
//   &nivel=patio     qué nivel abrir (ver src/niveles/lista.ts); sin él, El patio
//   &punto=N         empieza en ese punto de control, como al retomar un avance guardado
//   &vista=todo      la cámara quieta, lejos, mirando el nivel entero (para las capturas)
//   &vista=x,y,z     la cámara quieta mirando ese punto desde la dirección de siempre (el nido del secreto)
//   &contrarreloj    una carrera (TU-32): desde la salida y con el reloj arriba, que arranca cuando alguno se mueve
//                    y se para en la meta. Sin red, el tiempo queda en este navegador (en línea lo guarda Convex,
//                    ver en-linea.ts). `&punto` solo vale en el mismo lugar, para probar.
//   &noche[=semilla] Noche de tuerce (TU-33): de noche y con una trampa sorpresa; `&trampa=<nombre>` la fuerza
//                    (ver src/niveles/noche.ts). En línea la elige el anfitrión y el invitado la recibe en las fotos.
//   &ganar=N         para probar (en desarrollo, o con `?congelar=` para las capturas): en el paso N la pareja
//                    alcanza la meta sin caminar hasta ahí, como si llegara (en La medianoche se encienden los fuegos);
//                    con `&punto=` la meta, cuenta como llegar ahí mismo
//
// La meta (TU-57): fuera del contrarreloj, un rato después de llegar aparece «Nivel ganado» con «Siguiente nivel» y
// «Menú» (src/ui/llegada.ts) y los muñecos dejan de recibir entrada; después de La medianoche, el final. En línea
// lo muestra en-linea.ts.
//
// El secreto y el logro del nivel (TU-29) se avisan arriba al centro (src/ropero/aviso.ts); en línea, además, se
// guardan en Convex. La hoja de la misión (src/ui/mision.ts), arriba a la izquierda, los lista con la meta.
//
// En línea (`?escena=en-linea`) se juega esta misma escena: `enRed` decide las entradas de cada paso, como en `dos`.
// El invitado no simula: no corre el guion, ni los puntos de control, ni las caídas; los cuerpos (también la
// compuerta) llegan en la foto del anfitrión.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { type CamaraDeDos, crearCamaraDeDos, despejadoEnElMundo, ENCUADRE } from "../camara";
import { crearAyuda } from "../entrada/ayuda";
import { crearControles, entradaQuieta } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import { materialOjo, materialPanuelo, materialTela, type Panuelo } from "../imagen";
import { objetivosDelNivel } from "../misiones/nivel";
import { crearTablero } from "../misiones/tablero";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type Muneco } from "../muneco";
import { armarNivel, cargarNivel, crearNivel, type GuionDeNivel, type Nivel, type PlanoDeNivel } from "../niveles";
import { anotarTiempoAqui, crearReloj, formatearTiempo, marcarGanadoAqui, seMueve } from "../niveles/contrarreloj";
import { NIVEL_INICIAL, NIVELES } from "../niveles/lista";
import { crearNoche, leerNoche, type Noche } from "../niveles/noche";
// La medianoche (TU-49)
import type { Fuegos } from "../niveles/piezas-medianoche";
import { avisarPremios } from "../ropero/aviso";
import { vestuarioDe } from "../ropero/vestuario";
import { crearJuego, crearSenas } from "../ui";
import { crearMarcador, mostrarLlegada } from "../ui/contrarreloj";
import {
  accionesDeLaMeta,
  esperaDelPanel,
  finDeNivel,
  loQueSigue,
  mostrarFinal,
  mostrarNivelGanado,
} from "../ui/llegada";
import { crearInterfaz } from "../ui/menu";
import { crearHojaDeMision } from "../ui/mision";
import { mostrarCartel } from "../ui/noche";
import { COLORES } from "./colores";
import type { PasoEnRed } from "./dos";
import type { EscenaDeJuego } from "./index";
import type { AvanceDeNivel, Vestir } from "./tipos";

/** La cámara: hacia dónde queda de lo que mira, un poco más alta que en `dos` para ver los huecos. */
const DIRECCION_CAMARA = new THREE.Vector3(0.35, 0.42, 1);
/** Con `&vista=todo`: desde dónde y hacia dónde mira la cámara quieta, para un nivel de hasta `largo` metros (los
 * más largos, como El pinar, la alejan en proporción y la centran). */
const VISTA_TODO = { desde: new THREE.Vector3(9, 10, 24), hacia: new THREE.Vector3(9, -0.5, 0), largo: 32 };
/** Con `&vista=x,y,z`: a cuánto del punto queda la cámara. */
const VISTA_PUNTO = 7;
/** La medianoche (TU-49): con fuegos artificiales en el cielo, la cámara se aleja (m) y mira hacia arriba (radianes),
 * con la pareja abajo, mirándolos desde la playa. */
const MIRAR_AL_CIELO = { atras: 3, angulo: 0.3 };

export type EscenaNivel = EscenaDeJuego & {
  readonly munecos: readonly [Muneco, Muneco];
  readonly nivel: Nivel;
  readonly camaraDeDos: CamaraDeDos;
  readonly vestir: Vestir;
  /** La Noche de tuerce (TU-33): de día mientras no tenga trampa. */
  readonly noche: Noche;
};

/** Baja el .glb del nivel que pide la dirección (`&nivel=`) y devuelve cómo armar su escena. */
export async function bajarNivel(
  parametros: URLSearchParams,
): Promise<(rapier: Rapier, mundo: RAPIER.World, parametros: URLSearchParams, enRed?: PasoEnRed) => EscenaNivel> {
  const cual = parametros.get("nivel") ?? NIVEL_INICIAL;
  const datos = NIVELES[cual];
  if (!datos) throw new Error(`No existe el nivel «${cual}». Hay: ${Object.keys(NIVELES).join(", ")}`);
  const plano = await cargarNivel(datos.escena);
  return (rapier, mundo, parametros, enRed) =>
    armarEscenaNivel(rapier, mundo, plano, datos.crearGuion(), parametros, enRed);
}

/** Baja el .glb del nivel que pide la dirección y arma la escena. */
export async function crearEscenaNivel(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): Promise<EscenaNivel> {
  return (await bajarNivel(parametros))(rapier, mundo, parametros);
}

/** Arma la escena con un plano ya leído (las pruebas lo leen del disco). */
export function armarEscenaNivel(
  rapier: Rapier,
  mundo: RAPIER.World,
  plano: PlanoDeNivel,
  guion: GuionDeNivel,
  parametros: URLSearchParams,
  enRed?: PasoEnRed,
): EscenaNivel {
  const armado = armarNivel(rapier, mundo, plano);
  const { escena } = armado;
  const salida = plano.puntos[0];
  if (!salida) throw new Error("el nivel no tiene salida");

  // Los dos muñecos de verdad, en la salida, con la tela y los pañuelos de la imagen
  const vestir = (indice: 0 | 1, panuelo: Panuelo) => {
    const { posicion, rumbo } = salida.lugares[indice];
    const muneco = crearMuneco(rapier, mundo, { posicion, rumbo, indice });
    const malla = crearMallaMuneco(
      muneco,
      {
        cuerpo: materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 }),
        panuelo: materialPanuelo(panuelo, { repetir: 2 }),
        ojos: materialOjo(),
      },
      vestuarioDe(parametros, indice),
    );
    escena.add(malla.grupo);
    return { muneco, malla };
  };
  const jugadores = [vestir(0, "rojo"), vestir(1, "turquesa")] as const;
  const munecos = [jugadores[0].muneco, jugadores[1].muneco] as const;
  const nivel = crearNivel({ rapier, mundo, plano, armado, munecos, guion });

  const controles = crearControles({ parametros });
  const conPantalla = typeof document !== "undefined";
  if (conPantalla && (!controles.fija || parametros.has("ayuda"))) {
    crearAyuda(controles, { siempre: parametros.has("ayuda") });
  }
  const juego = crearJuego(conPantalla && (!controles.fija || parametros.has("menu")) ? "menu" : "jugando");
  const interfaz = conPantalla ? crearInterfaz(juego, controles) : undefined;
  if (conPantalla) avisarPremios(nivel.premios);
  const quietas = [entradaQuieta(), entradaQuieta()] as const;
  const senas = crearSenas(rapier, mundo, escena, munecos);
  const noche = crearNoche(
    { rapier, mundo, escena, munecos, jirones: armado.niebla.grupo, ...(conPantalla ? { cartel: mostrarCartel } : {}) },
    // De noche no hay contrarreloj: la luna o el viento cambiarían los tiempos de la tabla, que es de día
    parametros.has("contrarreloj")
      ? undefined
      : leerNoche(parametros, undefined, NIVELES[parametros.get("nivel") ?? NIVEL_INICIAL]?.sinTrampas),
  );

  const camaraDeDos = crearCamaraDeDos({ direccion: DIRECCION_CAMARA, despejado: despejadoEnElMundo(rapier, mundo) });
  const vista = parametros.get("vista");
  const punto3 = vista?.split(",").map(Number);
  const vistaPunto =
    punto3?.length === 3 && punto3.every(Number.isFinite) ? new THREE.Vector3().fromArray(punto3) : null;
  const vistaTodo = vista === "todo" || vistaPunto !== null;
  const camara = vistaTodo ? new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200) : camaraDeDos.camara;
  if (vistaPunto) {
    camara.position.copy(DIRECCION_CAMARA).setLength(VISTA_PUNTO).add(vistaPunto);
    camara.lookAt(vistaPunto);
  }
  /** Con `&vista=todo`, cuánto más lejos que lo de siempre queda la cámara (1 para los niveles cortos). */
  let lejos = 1;
  if (vistaTodo && !vistaPunto) {
    const limites = new THREE.Box3();
    for (const s of plano.solidos) limites.union(new THREE.Box3().setFromObject(s.objeto));
    const largo = limites.max.x - limites.min.x;
    if (largo <= VISTA_TODO.largo) {
      camara.position.copy(VISTA_TODO.desde);
      camara.lookAt(VISTA_TODO.hacia);
    } else {
      lejos = largo / VISTA_TODO.largo;
      const x = (limites.min.x + limites.max.x) / 2;
      const y = Math.max(0, (limites.min.y + limites.max.y) / 2);
      camara.position.set(x, VISTA_TODO.desde.y * lejos + y, VISTA_TODO.desde.z * lejos);
      camara.lookAt(x, VISTA_TODO.hacia.y + y, 0);
    }
  }
  if (vistaTodo) {
    // Desde lejos, la niebla se corre para que el nivel entero se lea
    if (escena.fog instanceof THREE.Fog) {
      const atras = VISTA_TODO.desde.z * (lejos - 1);
      escena.fog.near = plano.niebla.cerca + 12 + atras;
      escena.fog.far = plano.niebla.lejos + 22 + atras;
    }
  }
  // La medianoche (TU-49): los fuegos artificiales del nivel, que piden mirar al cielo
  const fuegos = armado.piezasDeJuego.lista.filter((p): p is Fuegos => p.cual === "fuegos");
  const seguirConLaCamara = () =>
    camaraDeDos.seguir(munecos[0].partes.pelvis.translation(), munecos[1].partes.pelvis.translation());

  /** Al reaparecer, la malla salta al lugar nuevo sin dibujarse a mitad de camino. */
  const saltarMalla = (jugador: 0 | 1) => {
    jugadores[jugador].malla.guardar();
    jugadores[jugador].malla.guardar();
  };
  // El avance de la escena: el del nivel, pero las mallas saltan al lugar nuevo (al retomar un avance guardado o el
  // mundo que devolvió el invitado) en vez de dibujarse un cuadro a mitad de camino
  const saltarMallas = () => {
    saltarMalla(0);
    saltarMalla(1);
  };
  const avance: AvanceDeNivel = {
    ...nivel.avance,
    irA(n) {
      nivel.avance.irA(n);
      saltarMallas();
    },
    retomar(n) {
      nivel.avance.retomar(n);
      saltarMallas();
    },
  };
  // Contrarreloj (TU-32): desde la salida. Llegar a la meta gana el nivel (y abre su contrarreloj) y para el reloj
  const clave = parametros.get("nivel") ?? NIVEL_INICIAL;
  const reloj = parametros.has("contrarreloj") ? crearReloj() : undefined;
  // La meta (TU-57): en el mismo lugar y fuera del contrarreloj, el panel «Nivel ganado» (o el final) un rato después
  const fin = finDeNivel(clave);
  const conPanel = !enRed && conPantalla && !reloj;
  /** El paso en que llegaron a la meta, y si ya se mostró el panel (desde ahí los muñecos no reciben entrada). */
  let llegaronEn: number | undefined;
  let conElPanel = false;
  nivel.avance.alCambiar((alcanzado) => {
    if (alcanzado < nivel.avance.meta) return;
    reloj?.llegar();
    if (!enRed && conPantalla) marcarGanadoAqui(clave);
    llegaronEn ??= pasos;
  });
  const mostrarLaMeta = () => {
    conElPanel = true;
    if (fin.cual === "final") mostrarFinal();
    else
      mostrarNivelGanado({
        nombre: plano.nombre,
        nota: fin.cual === "siguiente" ? loQueSigue(fin.siguiente) : "",
        acciones: accionesDeLaMeta(fin),
      });
  };
  const ganar = Number(parametros.get("ganar"));
  const ganarEn =
    !enRed && parametros.has("ganar") && Number.isFinite(ganar) && (import.meta.env.DEV || parametros.has("congelar"))
      ? ganar
      : undefined;
  const marcador = reloj && conPantalla ? crearMarcador(`Contrarreloj · ${plano.nombre}`) : undefined;
  if (reloj && conPantalla && !enRed) {
    reloj.alLlegar((pasos) => {
      const mejor = anotarTiempoAqui(clave, pasos);
      mostrarLlegada({
        titulo: `Llegaron a la meta · ${plano.nombre}`,
        pasos,
        nota: mejor < pasos ? `Su mejor aquí: ${formatearTiempo(mejor)}` : "¡Su mejor tiempo aquí!",
        acciones: [
          { texto: "Otra carrera", fuerte: true, alApretar: () => location.reload() },
          { texto: "Tablas en línea", href: "?escena=tabla" },
        ],
      });
    });
  }

  // La misión del nivel: llegar a la meta y, si quieren, el secreto y el logro. La hoja va arriba a la izquierda,
  // salvo en el contrarreloj (que tiene su reloj) y con la cámara quieta de las capturas del nivel entero
  const tablero = crearTablero(objetivosDelNivel(nivel.avance, nivel.premios));
  if (conPantalla && !reloj && !vistaTodo)
    crearHojaDeMision(tablero, { titulo: `Misión · ${plano.nombre}`, modo: "lista" });

  let pasos = 0;
  const punto = Number(parametros.get("punto"));
  if (parametros.has("punto") && Number.isFinite(punto) && !(reloj && enRed)) avance.irA(punto);
  seguirConLaCamara();

  return {
    nombre: "nivel",
    escena,
    camara,
    ...(vistaTodo ? {} : { vistas: camaraDeDos.vistas }),
    camaraDeDos,
    juego,
    ...(interfaz ? { interfaz } : {}),
    munecos,
    nivel,
    avance,
    ...(reloj ? { reloj } : {}),
    premios: nivel.premios,
    vestir: (jugador, vestuario) => jugadores[jugador].malla.vestir(vestuario),
    noche,
    pasar() {
      if (pasos === ganarEn) {
        nivel.avance.retomar(nivel.avance.meta);
        llegaronEn ??= pasos; // también si ya estaban en la meta (`&punto=` la meta)
      }
      if (conPanel && !conElPanel && llegaronEn !== undefined && pasos - llegaronEn >= esperaDelPanel(fin))
        mostrarLaMeta();
      const leidas = noche.entradas(juego.atienden && !conElPanel ? controles.leer() : quietas);
      const entradas = enRed ? enRed(leidas) : leidas;
      if (entradas) {
        const rojo = senas.entrada(0, entradas[0]);
        const turquesa = senas.entrada(1, entradas[1]);
        nivel.antes([rojo, turquesa]);
        munecos[0].pasar(rojo);
        munecos[1].pasar(turquesa);
        noche.antes();
        if (juego.atienden) noche.anunciar();
        mundo.step();
        // El reloj cuenta este paso antes de los puntos de control: el paso que llega a la meta también vale
        if (reloj && (reloj.pasos > 0 || seMueve(entradas[0]) || seMueve(entradas[1]))) reloj.pasar();
        for (const { jugador } of nivel.despues()) saltarMalla(jugador);
      }
      senas.apuntar();
      jugadores[0].malla.guardar();
      jugadores[1].malla.guardar();
      armado.guardar();
      tablero.pasar();
      seguirConLaCamara();
      pasos++;
    },
    dibujar(alfa) {
      jugadores[0].malla.dibujar(alfa);
      jugadores[1].malla.dibujar(alfa);
      noche.dibujar(alfa);
      const segundos = (pasos - 1 + alfa) * PASO;
      armado.dibujar(alfa, segundos);
      senas.dibujar(segundos);
      if (reloj) marcador?.poner(reloj.pasos, reloj.llego);
      if (vistaTodo) return;
      camaraDeDos.dibujar(alfa);
      // La medianoche (TU-49): con fuegos en el cielo (y la pantalla sin partir), la cámara se aleja y mira arriba
      const cielo = camaraDeDos.partida ? 0 : Math.max(0, ...fuegos.map((f) => f.cielo));
      if (cielo > 0.001) {
        camara.translateZ(cielo * MIRAR_AL_CIELO.atras);
        camara.rotateX(cielo * MIRAR_AL_CIELO.angulo);
      }
      if (escena.fog instanceof THREE.Fog) {
        // La niebla espesa (TU-33) acorta la del nivel, pero no la de la cámara: los dos se siguen viendo
        const atras = cielo * MIRAR_AL_CIELO.atras;
        escena.fog.near = plano.niebla.cerca * noche.niebla + camaraDeDos.distancia - ENCUADRE.cerca + atras;
        escena.fog.far = plano.niebla.lejos * noche.niebla + camaraDeDos.distancia - ENCUADRE.cerca + atras;
      }
    },
  };
}
