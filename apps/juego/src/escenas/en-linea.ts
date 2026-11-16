// Jugar en línea (TU-21): un nivel para dos (la escena `nivel`, TU-11), pero cada uno en su casa.
// `?escena=en-linea` juega el nivel que pida `&nivel=` (El patio si no pide ninguno); `&base=dos` juega la
// escena `dos`, sin puntos de control (ver `abrirEscenaEnLinea`).
//
//   1. Entra con la cuenta (Clerk y Convex, como `invitar`) y toma la pareja más reciente (`misParejas`). Si no hay,
//      pide invitar a alguien primero. Con la pareja, Convex firma un pase para su sala (`pedirPase`).
//   2. Se conecta a la sala (src/red): el primero que entró alguna vez es el anfitrión (pañuelo rojo) y calcula las físicas; el
//      segundo es el invitado (pañuelo turquesa) y ve lo que el anfitrión le manda (src/red/sincronia.ts).
//   3. Cada uno maneja su muñeco con sus controles de siempre (los del jugador 1, los del 2 o un mando: todos van
//      al muñeco propio).
//   4. La voz (TU-34, src/red/voz.ts) está apagada: el botón del micrófono la prende. Solo con conexión directa.
//   5. Avance y reconexión (TU-22). Si la escena de base tiene puntos de control (`avance`, los niveles), antes de
//      entrar a la sala se lee de Convex el último que alcanzó la pareja y los muñecos arrancan ahí; después, el
//      anfitrión guarda cada punto nuevo (src/red/avance.ts). Si uno se cae o recarga, el otro ve «tu pareja se
//      fue» y al volver siguen donde estaban: cada uno conserva su rol, y si el que vuelve es el anfitrión, el
//      invitado le devuelve el mundo (src/red/sincronia.ts). Si se fueron los dos, se retoma del punto guardado;
//      un nivel ya ganado empieza otra vez desde la salida (TU-58).
//   6. Contrarreloj (TU-32, `&contrarreloj`): solo en un nivel que la pareja ya ganó (Convex lo sabe por
//      `ganarNivel`, que el anfitrión manda al llegar a la meta). Se corre desde la salida, sin retomar ni guardar
//      puntos de control. El reloj lo cuenta el anfitrión y viaja en las fotos; al llegar, el anfitrión registra el
//      tiempo y los dos ven la tabla de parejas, que se actualiza sola. «Otra carrera» la arranca el anfitrión: su
//      página vuelve a empezar, no acepta el mundo de la carrera terminada, y el invitado, al ver que el reloj volvió
//      a cero, también vuelve a empezar.
//   6. Ropero, secretos y logros (TU-29). Cada muñeco lleva lo que su dueño eligió en el ropero (Convex, por la
//      pareja). Si la escena es un nivel, el anfitrión guarda el secreto y el logro cuando la pareja los gana, y los
//      dos miran lo guardado para avisarlo (src/red/premios.ts).
//   7. Noche de tuerce (TU-33, `&noche`): la trampa la elige el anfitrión con su semilla y viaja en las fotos; el
//      invitado pone la misma, aunque haya abierto de día (src/niveles/noche.ts).
//   8. La meta (TU-57), fuera del contrarreloj: cuando la pareja llega (el invitado lo sabe por el punto de control
//      de las fotos), los dos ven «Nivel ganado» y su muñeco deja de recibir entrada. «Siguiente nivel» lo aprieta el
//      anfitrión: le avisa al invitado, el invitado contesta y se va primero, y el anfitrión lo sigue
//      (src/red/siguiente.ts). Al invitado el botón le dice que lo decide su pareja. Después de La medianoche, los
//      dos ven el final y vuelven al menú cada uno.
//
// Para probar sin Convex (solo en desarrollo): `?escena=en-linea&sala=<url de la sala>&pase=<pase>`, como la
// pantalla `red` (ver scripts/prueba-red.mjs). También valen `forzar=repetidor` y `espera=<ms>`, y las entradas
// fijas `&j1=` de la escena `dos` para manejar el muñeco propio.
import type RAPIER from "@dimforge/rapier3d-compat";
import type { ConvexClient } from "convex/browser";
import type { api as Api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { VESTUARIO_INICIAL } from "../../../../convex/premios";
import { entradaQuieta, juntarEntradas } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
import { formatearTiempo } from "../niveles/contrarreloj";
import { NIVEL_INICIAL } from "../niveles/lista";
import { type Noche, numeroDeTrampa, trampaDeNumero } from "../niveles/noche";
import { HISTORIA, nivelDeLaHistoria } from "../niveles/orden";
import { oirSolo } from "../niveles/silbido-audio";
import { type Conexion, conectar, type EstadoRed, type Rol } from "../red";
import { type Guardado, guardarAvance, retomarAvance } from "../red/avance";
import { sincronizarPremios } from "../red/premios";
import { crearSiguiente, type Siguiente } from "../red/siguiente";
import { crearSincronia, type Medidas, type OrigenMundo, type Sincronia } from "../red/sincronia";
import { crearVoz, type EstadoVoz, type Voz } from "../red/voz";
import { completar } from "../ropero/vestuario";
import type { Oido } from "../sonido";
import { type DatosTabla, mostrarLlegada } from "../ui/contrarreloj";
import { irConFundido } from "../ui/fundido";
import type { Juego } from "../ui/juego";
import {
  accionesDeLaMeta,
  direccionDelNivel,
  esperaDelPanel,
  finDeNivel,
  loQueSigue,
  mostrarFinal,
  mostrarNivelGanado,
  type PanelDeMeta,
} from "../ui/llegada";
import type { AccionesDelNivel } from "../ui/menu";
import { crearEscenaDos, type PasoEnRed } from "./dos";
import type { EscenaDeJuego } from "./index";
import { bajarNivel } from "./nivel";
import type { Orientacion } from "./orientacion";
import type { AvanceDeNivel, PremiosDeNivel, Vestir } from "./tipos";
import "./en-linea.css";

/** Lo que en línea necesita de la escena de base: los dos muñecos (rojo y turquesa) y, si es un nivel, su avance. */
export type EscenaDeDos = EscenaDeJuego & {
  readonly munecos: readonly [Muneco, Muneco];
  readonly vestir?: Vestir;
  /** La Noche de tuerce (TU-33), si la escena es un nivel. */
  readonly noche?: Noche;
  /** El cartel, el fundido y la luciérnaga (TU-62), si la escena es un nivel: esperan a que estén conectados. */
  readonly orientacion?: Orientacion;
  /** El sonido (TU-59). */
  readonly oido?: Oido;
  /** Lo que ofrece la pausa sobre el nivel (TU-60), si la escena es un nivel. */
  readonly pausa?: AccionesDelNivel;
};
/** Arma una escena de dos jugadores; `enRed` decide las entradas de cada paso (o que no se simule). */
export type CrearEscenaDeDos = (
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams,
  enRed: PasoEnRed,
) => EscenaDeDos;
/** La escena de la lista (`?escena=en-linea`): baja el nivel que pide la dirección y lo juega en línea; con
 * `&base=dos`, la escena `dos`. */
export async function abrirEscenaEnLinea(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): Promise<EscenaDeDos> {
  if (parametros.get("base") === "dos") return crearEscenaEnLinea(rapier, mundo, parametros, crearEscenaDos);
  return crearEscenaEnLinea(rapier, mundo, parametros, await bajarNivel(parametros));
}

/** Lo que la escena deja ver a las pruebas en Chromium (`window.__enLinea`). */
export interface EstadoEnLinea {
  estado: EstadoRed | "sin_conexion";
  rol?: Rol;
  /** Dónde está la pelvis de cada muñeco (rojo y turquesa) en este mundo. */
  munecos(): { x: number; y: number; z: number }[];
  medidas?: Readonly<Medidas>;
  /** De dónde salió el mundo del anfitrión: «devuelto» si volvió y el invitado le devolvió el de antes (TU-22). */
  readonly mundo?: OrigenMundo;
  /** El punto de control de la pareja, si la escena de base los tiene. */
  readonly puntoDeControl?: number;
  /** El reloj de la carrera en pasos, si es un contrarreloj (TU-32). */
  readonly reloj?: number;
  /** La voz: en qué anda y cuántas pistas de audio del otro llegaron. */
  voz?: Pick<Voz, "estado" | "pistasRemotas">;
  /** El panel de la meta que se ve (TU-57): «Nivel ganado» o el final. */
  llegada?: "nivel" | "final";
  /** El número del nivel al que van, si el anfitrión ya eligió «Siguiente nivel». */
  readonly siguiente?: number;
}

declare global {
  interface Window {
    __enLinea?: EstadoEnLinea;
  }
}

const SALA_PRODUCCION = "https://tuerce-sala.luiscf1226.workers.dev";
const SALA_VISTA_PREVIA = "https://tuerce-sala-preview.luiscf1226.workers.dev";

/** Dónde está la sala: VITE_SALA_URL si está; en desarrollo la local (:8798, en la misma máquina que el juego);
 * en una vista previa (`pr-N-…`) la de vista previa; si no, la de producción. */
export function baseDeSala(host: string, desarrollo: boolean, configurada?: string): string {
  if (configurada) return configurada.replace(/\/$/, "");
  if (desarrollo) return `http://${host}:8798`;
  return host.startsWith("pr-") ? SALA_VISTA_PREVIA : SALA_PRODUCCION;
}

const NOMBRES: Record<Rol, string> = { anfitrion: "pañuelo rojo", invitado: "pañuelo turquesa" };
const ESTADOS: Record<EstadoRed, string> = {
  conectando: "esperando a tu pareja…",
  directa: "conectados directo",
  repetidor: "conectados por la sala",
  se_fue: "tu pareja se fue: esperando que vuelva…",
  cerrada: "se cerró la conexión",
};

export function crearEscenaEnLinea(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
  crearBase: CrearEscenaDeDos = crearEscenaDos,
): EscenaDeDos {
  let sincronia: Sincronia | undefined;
  let jugando = false;
  /** El tiempo con que terminó la carrera: si el reloj del anfitrión vuelve a empezar, arrancó otra. */
  let final: number | undefined;
  // La meta (TU-57): el paso en que llegaron, el panel (desde ahí el muñeco propio no recibe entrada) y el aviso de
  // pasar juntos al nivel siguiente
  const clave = parametros.get("nivel") ?? NIVEL_INICIAL;
  const fin = finDeNivel(clave);
  let pasos = 0;
  let llegaronEn: number | undefined;
  let conElPanel = false;
  let panel: PanelDeMeta | undefined;
  let siguiente: Siguiente | undefined;
  let rol: Rol | undefined;
  const dos = crearBase(rapier, mundo, parametros, (locales) => {
    if (!sincronia || !jugando) return null;
    // Todos los controles de esta máquina (teclado de los dos lados y mandos) manejan el muñeco propio
    return sincronia.paso(conElPanel ? entradaQuieta() : juntarEntradas(locales[0], locales[1]));
  });
  // En línea no hay menú de inicio («jugar aquí de a dos»): se entra jugando. La pausa es de cada pantalla: tapa
  // la propia y deja de mandar botones, pero las físicas siguen, porque si el anfitrión las parara al otro se le
  // congelaría el juego sin explicación.
  dos.juego?.jugar();
  const juego: Juego | undefined = dos.juego && Object.create(dos.juego, { corren: { get: () => true } });

  const avance = dos.avance;
  const noche = dos.noche;
  // Una carrera solo si la escena es un nivel con reloj
  const reloj = avance && parametros.has("contrarreloj") ? dos.reloj : undefined;
  const prueba: EstadoEnLinea = {
    estado: "sin_conexion",
    get mundo() {
      return sincronia?.mundo;
    },
    get puntoDeControl() {
      return avance?.puntoDeControl();
    },
    get reloj() {
      return reloj?.pasos;
    },
    get siguiente() {
      return siguiente?.yendo;
    },
    munecos: () =>
      dos.munecos.map((m) => {
        const p = m.partes.pelvis.translation();
        return { x: p.x, y: p.y, z: p.z };
      }),
  };

  if (typeof document !== "undefined") {
    window.__enLinea = prueba;
    const ui = crearInterfaz();
    void obtenerConexion(parametros, ui, avance, reloj !== undefined)
      .then((entrada) => {
        if (!entrada) return;
        const { conexion, guardado, carrera, cuenta } = entrada;
        // El silbido del Silbón (TU-44): cada uno oye solo lo que le toca a su muñeco
        oirSolo(conexion.rol === "anfitrion" ? 0 : 1);
        const meta = avance?.meta ?? 0;
        sincronia = crearSincronia({
          rol: conexion.rol,
          enlace: conexion,
          mundo,
          munecos: dos.munecos,
          ...(avance ? { avance } : {}),
          // Una carrera ya terminada no se retoma: el anfitrión que vuelve arranca otra desde la salida
          ...(reloj ? { reloj, aceptarMundo: (foto) => foto.punto < meta } : {}),
          ...(noche
            ? {
                trampa: {
                  leer: () => numeroDeTrampa(noche.trampa),
                  fijar: (numero: number) => {
                    noche.poner(trampaDeNumero(numero));
                    noche.anunciar();
                  },
                },
              }
            : {}),
        });
        // El sonido (TU-59): el invitado no simula, así que oye con el estado y los agarres que trae la foto
        if (conexion.rol === "invitado") dos.oido?.mirarCon(() => sincronia?.muestra);
        if (avance && guardado) guardarAvance(avance, guardado, conexion.rol);
        rol = conexion.rol;
        // La pausa (TU-60): «Volver al punto de control» lo decide el anfitrión, que simula; el invitado lo ve en
        // las fotos. «Empezar el nivel de nuevo» no se ofrece en línea: los dos tendrían que irse juntos a la salida
        // y el avance guardado de la pareja (src/red/avance.ts) los traería de vuelta al punto.
        // En el contrarreloj no: volver al punto en plena carrera es un atajo
        if (dos.pausa && avance && !reloj) {
          if (conexion.rol === "anfitrion") dos.pausa.volverAlPunto = () => avance.irA(avance.puntoDeControl());
          else dos.pausa.nota = "Volver al punto de control lo decide tu pareja (pañuelo rojo).";
        }
        if (avance && !reloj) {
          const historia = nivelDeLaHistoria(clave);
          if (historia) {
            siguiente = crearSiguiente({
              rol: conexion.rol,
              enlace: conexion,
              actual: historia.numero,
              ir: (numero) => {
                const destino = HISTORIA.find((n) => n.numero === numero);
                if (destino) irConFundido(direccionDelNivel(destino.clave, true, parametros));
              },
              alSeguir: () => panel?.nota("Tu pareja eligió seguir: ¡vamos!"),
            });
          }
          avance.alCambiar((punto) => {
            if (punto >= meta) llegaronEn ??= pasos;
          });
          // El anfitrión que retoma un nivel ya ganado arranca en la meta (el invitado lo sabrá por las fotos)
          if (avance.puntoDeControl() >= meta) llegaronEn = pasos;
        }
        if (reloj && carrera) {
          reloj.alLlegar((pasos) => {
            final = pasos;
            mostrarCarrera(pasos, conexion.rol, carrera);
          });
        }
        if (cuenta) usarCuenta(cuenta, conexion.rol, dos.vestir, dos.premios);
        prueba.rol = conexion.rol;
        prueba.medidas = sincronia.medidas;
        const mostrar = (estado: EstadoRed) => {
          prueba.estado = estado;
          jugando = estado === "directa" || estado === "repetidor";
          if (dos.orientacion) dos.orientacion.conectados = jugando;
          ui.estado(conexion.rol, estado);
        };
        mostrar(conexion.estado);
        conexion.alCambiarEstado(mostrar);
        const voz = crearVoz(conexion);
        prueba.voz = voz;
        ui.voz(voz);
      })
      .catch((error: unknown) => {
        console.error(error);
        ui.mensaje(String(error instanceof Error ? error.message : error));
      });
  }

  /** El panel de la meta: «Nivel ganado» (el siguiente lo elige el anfitrión) o, después de La medianoche, el final. */
  function mostrarLaMeta(rol: Rol): void {
    conElPanel = true;
    if (typeof document === "undefined") return;
    if (fin.cual === "final") {
      prueba.llegada = "final";
      mostrarFinal();
      return;
    }
    prueba.llegada = "nivel";
    const anfitrion = rol === "anfitrion";
    let nota = fin.cual === "siguiente" ? loQueSigue(fin.siguiente) : "";
    if (fin.cual === "siguiente" && !anfitrion) nota += ". Elige tu pareja (pañuelo rojo).";
    if (siguiente?.yendo !== undefined && !anfitrion) nota = "Tu pareja eligió seguir: ¡vamos!";
    panel = mostrarNivelGanado({
      nombre: nivelDeLaHistoria(clave)?.titulo ?? "Llegaron a la meta",
      nota,
      acciones: accionesDeLaMeta(fin, () => {
        if (fin.cual !== "siguiente") return;
        if (!anfitrion) panel?.nota("Lo decide tu pareja (pañuelo rojo).");
        else if (siguiente?.pedir(fin.siguiente.numero)) panel?.nota("Esperando a tu pareja…");
      }),
    });
  }

  return {
    nombre: "en-linea",
    escena: dos.escena,
    camara: dos.camara,
    munecos: dos.munecos,
    ...(avance ? { avance } : {}),
    ...(dos.vistas ? { vistas: dos.vistas } : {}),
    ...(juego ? { juego } : {}),
    ...(dos.interfaz ? { interfaz: dos.interfaz } : {}),
    pasar() {
      dos.pasar();
      if (jugando) sincronia?.despues();
      pasos++;
      if (!conElPanel && rol && llegaronEn !== undefined && pasos - llegaronEn >= esperaDelPanel(fin))
        mostrarLaMeta(rol);
      siguiente?.paso();
      if (final !== undefined && reloj && reloj.pasos < final && typeof location !== "undefined") location.reload();
    },
    dibujar: (alfa) => dos.dibujar(alfa),
  };
}

/** Lo que la carrera necesita de Convex (TU-32). */
interface Carrera {
  /** Registra el tiempo de la pareja (lo hace el anfitrión). */
  registrar(pasos: number): Promise<{ mejor: number; mejoro: boolean }>;
  /** La tabla del nivel, ahora y cada vez que cambie. Devuelve cómo dejar de mirarla. */
  mirarTabla(aviso: (datos: DatosTabla) => void): () => void;
}

/** Al llegar a la meta: el panel con el tiempo y la tabla. El anfitrión registra el tiempo y arranca otra carrera. */
function mostrarCarrera(pasos: number, rol: Rol, carrera: Carrera): void {
  const anfitrion = rol === "anfitrion";
  // Recargar corta la mutación: «Otra carrera» espera a que el tiempo se guarde (o falle)
  let guardando = anfitrion;
  const llegada = mostrarLlegada({
    titulo: "Llegaron a la meta",
    pasos,
    nota: anfitrion ? "Guardando el tiempo…" : "",
    acciones: [
      anfitrion
        ? {
            texto: "Otra carrera",
            fuerte: true,
            alApretar: () => (guardando ? llegada.nota("Esperá: guardando el tiempo…") : location.reload()),
          }
        : {
            texto: "Otra carrera",
            fuerte: true,
            alApretar: () => llegada.nota("La arranca tu pareja (pañuelo rojo)."),
          },
      { texto: "Tablas", href: "?escena=tabla" },
    ],
  });
  carrera.mirarTabla((datos) => llegada.tabla(datos));
  if (!anfitrion) return;
  carrera
    .registrar(pasos)
    .then(({ mejor, mejoro }) =>
      llegada.nota(mejoro ? "¡Su mejor tiempo!" : `Su mejor tiempo: ${formatearTiempo(mejor)}`),
    )
    .catch((error: unknown) => {
      console.warn("Tuerce · contrarreloj: no se pudo registrar el tiempo", error);
      llegada.nota("No se pudo guardar este tiempo.");
    })
    .finally(() => {
      guardando = false;
    });
}

interface Interfaz {
  caja: HTMLElement;
  /** Un mensaje (y un enlace opcional), con la caja de la cuenta debajo. */
  mensaje(texto: string, enlace?: { texto: string; href: string }): void;
  /** Ya conectado: quién sos y cómo va la conexión. */
  estado(rol: Rol, estado: EstadoRed): void;
  /** Donde Clerk dibuja la entrada o el botón de la cuenta. */
  cuenta: HTMLDivElement;
  /** Pone el botón del micrófono. */
  voz(voz: Voz): void;
}

const TEXTOS_VOZ: Record<EstadoVoz, string> = {
  no_disponible: "Voz: solo con conexión directa (ahora van por la sala)",
  apagada: "Prender micrófono",
  pidiendo: "Pidiendo el micrófono…",
  encendida: "Apagar micrófono",
  sin_permiso: "Sin micrófono: revisá el permiso del navegador",
};

function crearInterfaz(): Interfaz {
  const caja = document.body.appendChild(document.createElement("aside"));
  caja.className = "en-linea";
  const titulo = caja.appendChild(document.createElement("h1"));
  titulo.textContent = "En línea";
  const linea = caja.appendChild(document.createElement("p"));
  linea.className = "en-linea-estado";
  linea.textContent = "Entrando…";
  const enlace = caja.appendChild(document.createElement("a"));
  enlace.hidden = true;
  const cuenta = caja.appendChild(document.createElement("div"));
  const ayuda = caja.appendChild(document.createElement("p"));
  ayuda.className = "en-linea-ayuda";
  ayuda.hidden = true;
  ayuda.textContent = "W S caminar · A D girar · Espacio saltar · Q E brazos (también las flechas o un mando)";
  const microfono = document.createElement("button");
  microfono.type = "button";
  microfono.className = "en-linea-microfono";
  return {
    caja,
    cuenta,
    voz(voz) {
      const pintar = (estado: EstadoVoz) => {
        microfono.textContent = TEXTOS_VOZ[estado];
        microfono.dataset.estado = estado;
        microfono.disabled = estado === "no_disponible" || estado === "pidiendo";
        microfono.setAttribute("aria-pressed", String(estado === "encendida"));
      };
      pintar(voz.estado);
      voz.alCambiar(pintar);
      microfono.onclick = () => {
        if (voz.estado === "encendida") voz.apagar();
        else voz.prender().catch((error: unknown) => console.warn("Tuerce · voz: no se pudo prender", error));
        // Que las teclas sigan yendo al juego y Espacio no vuelva a apretar el botón
        microfono.blur();
      };
      caja.insertBefore(microfono, ayuda);
    },
    mensaje(texto, vinculo) {
      linea.textContent = texto;
      enlace.hidden = !vinculo;
      if (vinculo) {
        enlace.textContent = vinculo.texto;
        enlace.href = vinculo.href;
      }
    },
    estado(rol, estado) {
      linea.textContent = `Sos el ${rol === "anfitrion" ? "anfitrión" : "invitado"} (${NOMBRES[rol]}) · ${ESTADOS[estado]}`;
      linea.dataset.estado = estado;
      enlace.hidden = true;
      cuenta.hidden = true;
      ayuda.hidden = false;
      caja.classList.add("jugando");
    },
  };
}

/** Lo que hace falta de la cuenta para el ropero y los premios de la pareja. */
interface Cuenta {
  convex: ConvexClient;
  api: typeof Api;
  parejaId: Id<"parejas">;
}

/** Viste a cada muñeco con lo que eligió su dueño y guarda los premios del nivel (TU-29). */
function usarCuenta(
  { convex, api, parejaId }: Cuenta,
  rol: Rol,
  vestir: Vestir | undefined,
  premios: PremiosDeNivel | undefined,
): void {
  // El anfitrión es el rojo (jugador 1) y el invitado el turquesa
  const mio = rol === "anfitrion" ? 0 : 1;
  const otro = mio === 0 ? 1 : 0;
  if (vestir) {
    convex.onUpdate(api.ropero.vestuariosDePareja, { parejaId }, (vestuarios) => {
      if (!vestuarios) return;
      vestir(mio, completar(vestuarios.mio, VESTUARIO_INICIAL[mio]));
      vestir(otro, completar(vestuarios.companero, VESTUARIO_INICIAL[otro]));
    });
  }
  if (premios) {
    sincronizarPremios(
      premios,
      {
        mirar: (nivel, aviso) => convex.onUpdate(api.ropero.premiosDeNivel, { parejaId, nivel }, aviso),
        guardar: (nivel, premio) =>
          premio === "secreto"
            ? convex.mutation(api.ropero.encontrarSecreto, { parejaId, nivel })
            : convex.mutation(api.ropero.lograr, { parejaId, nivel }),
      },
      rol,
    );
  }
}

/**
 * El pase y la sala: de la dirección (solo en desarrollo, sin avance guardado) o de Convex, con la pareja más
 * reciente. Con Convex, antes de entrar a la sala se retoma el avance guardado de la pareja (si la escena lo tiene):
 * así, cuando llega el otro, el mundo ya está en el punto de control y no se mueve nada debajo de la red.
 */
async function obtenerConexion(
  parametros: URLSearchParams,
  ui: Interfaz,
  avance: AvanceDeNivel | undefined,
  contrarreloj = false,
): Promise<{ conexion: Conexion; guardado?: Guardado; carrera?: Carrera; cuenta?: Cuenta } | undefined> {
  const pase = parametros.get("pase");
  const sala = parametros.get("sala");
  const numero = (nombre: string) => {
    const valor = Number(parametros.get(nombre) ?? Number.NaN);
    return Number.isFinite(valor) ? valor : undefined;
  };
  if (import.meta.env.DEV && pase && sala) {
    ui.mensaje("Entrando a la sala de prueba…");
    const conexion = await conectar({
      urlSala: sala,
      pase,
      forzar: parametros.get("forzar") === "repetidor" ? "repetidor" : undefined,
      esperaDirectaMs: numero("espera"),
    });
    return { conexion };
  }

  // Clerk y Convex se cargan aparte, solo en esta escena
  const [{ abrirSesion }, { api }] = await Promise.all([
    import("../cuenta/sesion"),
    import("../../../../convex/_generated/api"),
  ]);
  const estado = { escena: "en-linea", listo: false, pasosTotales: 0, pasosPorSegundo: 0 };
  return new Promise((resolver, rechazar) => {
    void abrirSesion(
      { estado, panel: ui.caja, mensaje: ui.caja.querySelector("p") ?? ui.caja, caja: ui.cuenta },
      (convex) => {
        void (async () => {
          const parejas = await convex.query(api.parejas.misParejas, {});
          const pareja = parejas[0];
          if (!pareja) {
            ui.mensaje("Primero invitá a alguien: se juega en línea con tu pareja.", {
              texto: "Invitar a alguien",
              href: "?escena=invitar",
            });
            resolver(undefined);
            return;
          }
          const { parejaId } = pareja;
          const guardado: Guardado = {
            leer: (nivel) => convex.query(api.avance.puntoDeControl, { parejaId, nivel }),
            guardar: (nivel, puntoDeControl) =>
              convex.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel, puntoDeControl }),
            ganar: (nivel) => convex.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel }),
          };
          let carrera: Carrera | undefined;
          if (avance && contrarreloj) {
            // El contrarreloj se abre solo en niveles ganados, y se corre desde la salida
            const { nivel } = avance;
            const ganados = await convex.query(api.contrarreloj.nivelesGanados, { parejaId });
            if (!ganados.some((g) => g.nivel === nivel)) {
              const jugarlo = new URLSearchParams(parametros);
              jugarlo.delete("contrarreloj");
              ui.mensaje(
                `Con ${pareja.companero} todavía no ganaron este nivel: el contrarreloj se abre al llegar a la meta.`,
                { texto: "Jugarlo", href: `?${jugarlo}` },
              );
              resolver(undefined);
              return;
            }
            carrera = {
              registrar: (tiempo) => convex.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel, tiempo }),
              mirarTabla: (aviso) => convex.onUpdate(api.contrarreloj.tabla, { nivel, parejaId }, aviso),
            };
          } else if (avance) {
            ui.mensaje(`Buscando dónde se quedaron con ${pareja.companero}…`);
            await retomarAvance(avance, guardado);
          }
          const pedir = () => convex.mutation(api.salas.pedirPase, { parejaId });
          const primero = await pedir();
          ui.mensaje(`Entrando a la sala con ${pareja.companero}…`);
          const base = baseDeSala(location.hostname, import.meta.env.DEV, import.meta.env.VITE_SALA_URL);
          const conexion = await conectar({
            urlSala: `${base}/sala/${primero.sala}`,
            pase: primero.pase,
            pedirPase: async () => (await pedir()).pase,
          });
          const cuenta: Cuenta = { convex, api, parejaId };
          resolver(carrera ? { conexion, carrera, cuenta } : { conexion, guardado, cuenta });
        })().catch(rechazar);
        return undefined;
      },
    ).catch(rechazar);
  });
}
