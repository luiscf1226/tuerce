// Bucle de paso fijo: las físicas avanzan siempre de a 1/60 s, sin importar los cuadros por segundo de la pantalla.
// Lo que sobra de tiempo se guarda para el siguiente cuadro y sirve para interpolar el dibujo.
export const PASOS_POR_SEGUNDO = 60;
export const PASO = 1 / PASOS_POR_SEGUNDO;

// Si la pestaña se congela (o la máquina se traba) no intentamos ponernos al día de golpe.
const MAX_PASOS_POR_CUADRO = 5;
const TOLERANCIA = 1e-9;

export interface Bucle {
  /** Suma `segundos` de tiempo real, corre los pasos que caben y devuelve cuántos corrió. */
  avanzar(segundos: number): number;
  /** Cuánto del siguiente paso ya pasó, de 0 a 1. Sirve para interpolar entre el estado anterior y el actual. */
  readonly alfa: number;
  readonly pasosTotales: number;
}

export function crearBucle(pasar: () => void): Bucle {
  let acumulado = 0;
  let pasosTotales = 0;
  return {
    avanzar(segundos) {
      acumulado += Math.min(Math.max(segundos, 0), PASO * MAX_PASOS_POR_CUADRO);
      let pasos = 0;
      while (acumulado + TOLERANCIA >= PASO) {
        pasar();
        acumulado -= PASO;
        pasos++;
      }
      if (acumulado < 0) acumulado = 0;
      pasosTotales += pasos;
      return pasos;
    },
    get alfa() {
      return acumulado / PASO;
    },
    get pasosTotales() {
      return pasosTotales;
    },
  };
}
