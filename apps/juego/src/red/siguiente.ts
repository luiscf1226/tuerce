// Pasar juntos al nivel siguiente (TU-57). Como «Otra carrera» en el contrarreloj, decide el anfitrión y el invitado
// lo sigue; pero acá cambia la página de los dos, así que el aviso va explícito y con respuesta (paquetes.ts):
//
//   1. El anfitrión aprieta «Siguiente nivel»: manda SIGUIENTE con el número del nivel (canal fiable) y lo repite
//      cada REPETIR_SIGUIENTE pasos mientras no le contesten. Si el invitado está recargando o se le cortó la red,
//      lo recibe al volver.
//   2. El invitado contesta VOY con el mismo número y, ESPERA_IR pasos después (para que el VOY salga antes de cerrar
//      la página), se va a ese nivel. Si ya está en ese nivel (su página nueva recibió un SIGUIENTE repetido de la
//      vieja del anfitrión) contesta VOY y se queda.
//   3. Con el VOY, el anfitrión se va. Así el invitado llega primero (o a la par) y cuando el anfitrión le pregunta
//      por el mundo de antes (sincronia.ts), su página nueva no tiene ninguno: se juega el nivel nuevo desde la
//      salida o desde el punto guardado.
import type { Rol } from "./marco";
import { escribirSiguiente, leerSiguiente, TIPO_SIGUIENTE, TIPO_VOY, tipoDe } from "./paquetes";
import type { Enlace } from "./sincronia";

/** Anfitrión: cada cuántos pasos repite el pedido mientras el invitado no contesta (medio segundo). */
export const REPETIR_SIGUIENTE = 30;
/** Invitado: pasos entre contestar VOY e irse, para que la respuesta salga antes de cerrar la página. */
export const ESPERA_IR = 6;

export interface OpcionesSiguiente {
  rol: Rol;
  enlace: Enlace;
  /** El número (en la historia) del nivel que se está jugando. */
  actual: number;
  /** Cambia de página al nivel con ese número (una sola vez). */
  ir(nivel: number): void;
  /** Invitado: el anfitrión eligió seguir a ese nivel (para avisarlo antes de irse). */
  alSeguir?(nivel: number): void;
}

export interface Siguiente {
  /** Anfitrión: pide pasar al nivel con ese número. El invitado no pide: devuelve false. */
  pedir(nivel: number): boolean;
  /** Una vez por paso: el anfitrión repite el pedido; el invitado se va cuando toca. */
  paso(): void;
  /** El nivel al que van, si ya se eligió (anfitrión: esperando el VOY; invitado: por irse). */
  readonly yendo: number | undefined;
  cerrar(): void;
}

export function crearSiguiente({ rol, enlace, actual, ir, alSeguir }: OpcionesSiguiente): Siguiente {
  let yendo: number | undefined;
  let ido = false;
  let pasos = 0;
  /** Invitado: pasos que faltan para irse. */
  let faltan = 0;

  const irse = (nivel: number) => {
    if (ido) return;
    ido = true;
    ir(nivel);
  };

  const dejar = enlace.alRecibir((datos) => {
    if (typeof datos === "string") return;
    const tipo = tipoDe(datos);
    if (rol === "anfitrion") {
      if (tipo !== TIPO_VOY) return;
      const nivel = leerSiguiente(datos, TIPO_VOY);
      if (nivel !== null && nivel === yendo) irse(nivel);
      return;
    }
    if (tipo !== TIPO_SIGUIENTE) return;
    const nivel = leerSiguiente(datos, TIPO_SIGUIENTE);
    if (nivel === null) return;
    // Se contesta siempre, también a los repetidos: el VOY de antes pudo perderse al cerrar la página
    enlace.enviar(escribirSiguiente(TIPO_VOY, nivel), { fiable: true });
    if (nivel === actual || yendo !== undefined) return;
    yendo = nivel;
    faltan = ESPERA_IR;
    alSeguir?.(nivel);
  });

  return {
    pedir(nivel) {
      if (rol !== "anfitrion" || ido) return false;
      if (yendo !== nivel) pasos = 0;
      yendo = nivel;
      enlace.enviar(escribirSiguiente(TIPO_SIGUIENTE, nivel), { fiable: true });
      return true;
    },
    paso() {
      if (yendo === undefined || ido) return;
      if (rol === "anfitrion") {
        if (++pasos % REPETIR_SIGUIENTE === 0)
          enlace.enviar(escribirSiguiente(TIPO_SIGUIENTE, yendo), { fiable: true });
        return;
      }
      if (--faltan <= 0) irse(yendo);
    },
    get yendo() {
      return yendo;
    },
    cerrar: dejar,
  };
}
