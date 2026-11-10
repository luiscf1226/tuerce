// Lo que el juego deja ver desde afuera (consola del navegador, capturas automáticas, pruebas en Chromium).
export interface EstadoTuerce {
  escena: string;
  listo: boolean;
  pasosTotales: number;
  pasosPorSegundo: number;
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
