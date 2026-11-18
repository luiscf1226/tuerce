// Lo que el juego deja ver desde afuera (consola del navegador, capturas automáticas, pruebas en Chromium).
export interface EstadoTuerce {
  escena: string;
  listo: boolean;
  pasosTotales: number;
  pasosPorSegundo: number;
  /** La misión de la escena, si tiene: qué objetivo va (el id), cuántos van y si ya terminó. */
  readonly mision?: { actual: string | null; cumplidos: number; total: number; terminada: boolean };
  /** Lo que queda por juntar en la escena (x, z). */
  readonly pendientes?: readonly { x: number; z: number }[];
  /** Dónde está cada muñeco (la pelvis) y hacia dónde mira, en radianes alrededor de +y. */
  readonly jugadores?: readonly { x: number; y: number; z: number; rumbo: number; estado: string; manos: number }[];
}

declare global {
  interface Window {
    __tuerce?: EstadoTuerce;
  }
}

export function publicarEstado(estado: EstadoTuerce): EstadoTuerce {
  window.__tuerce = estado;
  return estado;
}
