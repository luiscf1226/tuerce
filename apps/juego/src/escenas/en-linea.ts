// Jugar en línea (TU-21): la escena `dos`, pero cada uno en su casa. `?escena=en-linea`
//
//   1. Entra con la cuenta (Clerk y Convex, como `invitar`) y toma la pareja más reciente (`misParejas`). Si no hay,
//      pide invitar a alguien primero. Con la pareja, Convex firma un pase para su sala (`pedirPase`).
//   2. Se conecta a la sala (src/red): el primero en entrar es el anfitrión (pañuelo rojo) y calcula las físicas; el
//      segundo es el invitado (pañuelo turquesa) y ve lo que el anfitrión le manda (src/red/sincronia.ts).
//   3. Cada uno maneja su muñeco con sus controles de siempre (los del jugador 1, los del 2 o un mando: todos van
//      al muñeco propio).
//
// Para probar sin Convex (solo en desarrollo): `?escena=en-linea&sala=<url de la sala>&pase=<pase>`, como la
// pantalla `red` (ver scripts/prueba-red.mjs). También valen `forzar=repetidor` y `espera=<ms>`, y las entradas
// fijas `&j1=` de la escena `dos` para manejar el muñeco propio.
import type RAPIER from "@dimforge/rapier3d-compat";
import { juntarEntradas } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import type { Rapier } from "../motor/fisica";
import type { Muneco } from "../muneco";
import { type Conexion, conectar, type EstadoRed, type Rol } from "../red";
import { crearSincronia, type Medidas, type Sincronia } from "../red/sincronia";
import { crearEscenaDos } from "./dos";
import type { EscenaDeJuego } from "./index";
import "./en-linea.css";

/** Lo que la escena deja ver a las pruebas en Chromium (`window.__enLinea`). */
export interface EstadoEnLinea {
  estado: EstadoRed | "sin_conexion";
  rol?: Rol;
  /** Dónde está la pelvis de cada muñeco (rojo y turquesa) en este mundo. */
  munecos(): { x: number; y: number; z: number }[];
  medidas?: Readonly<Medidas>;
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
): EscenaDeJuego & { readonly munecos: readonly [Muneco, Muneco] } {
  let sincronia: Sincronia | undefined;
  let jugando = false;
  const dos = crearEscenaDos(rapier, mundo, parametros, (locales) => {
    if (!sincronia || !jugando) return null;
    // Todos los controles de esta máquina (teclado de los dos lados y mandos) manejan el muñeco propio
    return sincronia.paso(juntarEntradas(locales[0], locales[1]));
  });
  // En línea no hay menú de inicio («jugar aquí de a dos»): se entra jugando. La pausa es de cada pantalla.
  dos.juego?.jugar();

  const prueba: EstadoEnLinea = {
    estado: "sin_conexion",
    munecos: () =>
      dos.munecos.map((m) => {
        const p = m.partes.pelvis.translation();
        return { x: p.x, y: p.y, z: p.z };
      }),
  };

  if (typeof document !== "undefined") {
    window.__enLinea = prueba;
    const ui = crearInterfaz();
    void obtenerConexion(parametros, ui)
      .then((conexion) => {
        if (!conexion) return;
        sincronia = crearSincronia({ rol: conexion.rol, enlace: conexion, mundo, munecos: dos.munecos });
        prueba.rol = conexion.rol;
        prueba.medidas = sincronia.medidas;
        const mostrar = (estado: EstadoRed) => {
          prueba.estado = estado;
          jugando = estado === "directa" || estado === "repetidor";
          ui.estado(conexion.rol, estado);
        };
        mostrar(conexion.estado);
        conexion.alCambiarEstado(mostrar);
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
    ...(dos.vistas ? { vistas: dos.vistas } : {}),
    ...(dos.juego ? { juego: dos.juego } : {}),
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
}

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
  return {
    caja,
    cuenta,
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

/** El pase y la sala: de la dirección (solo en desarrollo) o de Convex, con la pareja más reciente. */
async function obtenerConexion(parametros: URLSearchParams, ui: Interfaz): Promise<Conexion | undefined> {
  const pase = parametros.get("pase");
  const sala = parametros.get("sala");
  const numero = (nombre: string) => {
    const valor = Number(parametros.get(nombre) ?? Number.NaN);
    return Number.isFinite(valor) ? valor : undefined;
  };
  if (import.meta.env.DEV && pase && sala) {
    ui.mensaje("Entrando a la sala de prueba…");
    return conectar({
      urlSala: sala,
      pase,
      forzar: parametros.get("forzar") === "repetidor" ? "repetidor" : undefined,
      esperaDirectaMs: numero("espera"),
    });
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
          const pedir = () => convex.mutation(api.salas.pedirPase, { parejaId: pareja.parejaId });
          const primero = await pedir();
          ui.mensaje(`Entrando a la sala con ${pareja.companero}…`);
          const base = baseDeSala(location.hostname, import.meta.env.DEV, import.meta.env.VITE_SALA_URL);
          resolver(
            await conectar({
              urlSala: `${base}/sala/${primero.sala}`,
              pase: primero.pase,
              pedirPase: async () => (await pedir()).pase,
            }),
          );
        })().catch(rechazar);
        return undefined;
      },
    ).catch(rechazar);
  });
}
