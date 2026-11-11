// Jugar en línea (TU-21): un nivel para dos (la escena `nivel`, TU-11), pero cada uno en su casa.
// `?escena=en-linea` juega el nivel que pida `&nivel=` (el de prueba si no pide ninguno); `&base=dos` juega la
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
//      invitado le devuelve el mundo (src/red/sincronia.ts). Si se fueron los dos, se retoma del punto guardado.
//   6. Ropero, secretos y logros (TU-29). Cada muñeco lleva lo que su dueño eligió en el ropero (Convex, por la
//      pareja). Si la escena es un nivel, el anfitrión guarda el secreto y el logro cuando la pareja los gana, y los
//      dos miran lo guardado para avisarlo (src/red/premios.ts).
//
// Para probar sin Convex (solo en desarrollo): `?escena=en-linea&sala=<url de la sala>&pase=<pase>`, como la
// pantalla `red` (ver scripts/prueba-red.mjs). También valen `forzar=repetidor` y `espera=<ms>`, y las entradas
// fijas `&j1=` de la escena `dos` para manejar el muñeco propio.
import type RAPIER from "@dimforge/rapier3d-compat";
import type { ConvexClient } from "convex/browser";
import type { api as Api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { VESTUARIO_INICIAL } from "../../../../convex/premios";
import { juntarEntradas } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
import { type Conexion, conectar, type EstadoRed, type Rol } from "../red";
import { type Guardado, guardarAvance, retomarAvance } from "../red/avance";
import { sincronizarPremios } from "../red/premios";
import { crearSincronia, type Medidas, type OrigenMundo, type Sincronia } from "../red/sincronia";
import { crearVoz, type EstadoVoz, type Voz } from "../red/voz";
import { completar } from "../ropero/vestuario";
import type { Juego } from "../ui/juego";
import { crearEscenaDos, type PasoEnRed } from "./dos";
import type { EscenaDeJuego } from "./index";
import { bajarNivel } from "./nivel";
import type { AvanceDeNivel, PremiosDeNivel, Vestir } from "./tipos";
import "./en-linea.css";

/** Lo que en línea necesita de la escena de base: los dos muñecos (rojo y turquesa) y, si es un nivel, su avance. */
export type EscenaDeDos = EscenaDeJuego & { readonly munecos: readonly [Muneco, Muneco]; readonly vestir?: Vestir };
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
  /** La voz: en qué anda y cuántas pistas de audio del otro llegaron. */
  voz?: Pick<Voz, "estado" | "pistasRemotas">;
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
  const dos = crearBase(rapier, mundo, parametros, (locales) => {
    if (!sincronia || !jugando) return null;
    // Todos los controles de esta máquina (teclado de los dos lados y mandos) manejan el muñeco propio
    return sincronia.paso(juntarEntradas(locales[0], locales[1]));
  });
  // En línea no hay menú de inicio («jugar aquí de a dos»): se entra jugando. La pausa es de cada pantalla: tapa
  // la propia y deja de mandar botones, pero las físicas siguen, porque si el anfitrión las parara al otro se le
  // congelaría el juego sin explicación.
  dos.juego?.jugar();
  const juego: Juego | undefined = dos.juego && Object.create(dos.juego, { corren: { get: () => true } });

  const avance = dos.avance;
  const prueba: EstadoEnLinea = {
    estado: "sin_conexion",
    get mundo() {
      return sincronia?.mundo;
    },
    get puntoDeControl() {
      return avance?.puntoDeControl();
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
    void obtenerConexion(parametros, ui, avance)
      .then((entrada) => {
        if (!entrada) return;
        const { conexion, guardado, cuenta } = entrada;
        sincronia = crearSincronia({
          rol: conexion.rol,
          enlace: conexion,
          mundo,
          munecos: dos.munecos,
          ...(avance ? { avance } : {}),
        });
        if (avance && guardado) guardarAvance(avance, guardado, conexion.rol);
        if (cuenta) usarCuenta(cuenta, conexion.rol, dos.vestir, dos.premios);
        prueba.rol = conexion.rol;
        prueba.medidas = sincronia.medidas;
        const mostrar = (estado: EstadoRed) => {
          prueba.estado = estado;
          jugando = estado === "directa" || estado === "repetidor";
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
    },
    dibujar: (alfa) => dos.dibujar(alfa),
  };
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
): Promise<{ conexion: Conexion; guardado?: Guardado; cuenta?: Cuenta } | undefined> {
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
          };
          if (avance) {
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
          resolver({ conexion, guardado, cuenta: { convex, api, parejaId } });
        })().catch(rechazar);
        return undefined;
      },
    ).catch(rechazar);
  });
}
