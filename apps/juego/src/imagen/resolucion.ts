// Resolución que se adapta: si la máquina no llega a dibujar a tiempo, la escena se dibuja con menos píxeles
// (el grano y la niebla disimulan la diferencia) y las físicas no se atrasan. Solo baja, nunca sube: así no
// salta de un lado a otro. Dibujar cuesta según los píxeles (escala²), así que cuando va muy lenta baja de una
// vez lo que haga falta en lugar de ir de a un paso.

export interface OpcionesResolucion {
  /** Segundos por cuadro a partir de los cuales se considera lento (1/30: menos de 30 cuadros por segundo). */
  lento?: number;
  /** La escala más baja permitida (0.5 = la mitad de píxeles por lado). */
  minima?: number;
  /** Cuánto baja como mínimo cada vez. */
  paso?: number;
  /** Segundos que se ignoran al principio (se compilan los sombreadores y los primeros cuadros tardan). */
  calentamiento?: number;
  /** Segundos de cada medición. */
  ventana?: number;
}

/** Mediciones lentas seguidas que hacen falta para bajar: un tirón suelto no alcanza. */
const LENTAS_PARA_BAJAR = 2;

export interface ResolucionAdaptable {
  readonly escala: number;
  /** Avisa que se dibujó un cuadro en el instante `ahora` (segundos). Devuelve `true` si cambió la escala. */
  cuadro(ahora: number): boolean;
  /** Olvida la medición en curso (la pestaña estuvo escondida: ese hueco no es lentitud). */
  reiniciar(): void;
  /** Baja directo a la escala mínima (por ejemplo, si no hay tarjeta de video). */
  bajarAlMinimo(): void;
}

export function crearResolucionAdaptable(opciones: OpcionesResolucion = {}): ResolucionAdaptable {
  const lento = opciones.lento ?? 1 / 30;
  const minima = opciones.minima ?? 0.35;
  const paso = opciones.paso ?? 0.25;
  const calentamiento = opciones.calentamiento ?? 1;
  const ventana = opciones.ventana ?? 0.5;
  let escala = 1;
  let primero = Number.NaN;
  let inicioVentana = Number.NaN;
  let cuadros = 0;
  let lentas = 0;
  return {
    get escala() {
      return escala;
    },
    cuadro(ahora) {
      if (Number.isNaN(primero)) primero = ahora;
      if (escala <= minima || ahora - primero < calentamiento) return false;
      if (Number.isNaN(inicioVentana)) {
        inicioVentana = ahora;
        cuadros = 0;
        lentas = 0;
        return false;
      }
      cuadros++;
      const pasado = ahora - inicioVentana;
      if (pasado < ventana) return false;
      const porCuadro = pasado / cuadros;
      inicioVentana = ahora;
      cuadros = 0;
      lentas = porCuadro > lento ? lentas + 1 : 0;
      if (lentas < LENTAS_PARA_BAJAR) return false;
      lentas = 0;
      escala = Math.max(minima, Math.min(escala - paso, escala * Math.sqrt(lento / porCuadro)));
      return true;
    },
    reiniciar() {
      inicioVentana = Number.NaN;
      lentas = 0;
    },
    bajarAlMinimo() {
      escala = minima;
    },
  };
}
