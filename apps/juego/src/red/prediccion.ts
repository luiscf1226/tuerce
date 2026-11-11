// La predicción del muñeco propio del invitado (TU-21). El invitado no calcula físicas: ve su muñeco como el
// anfitrión lo tenía hace un rato (lo que tarda la red más el colchón de 100 ms). Sin nada más, su muñeco le
// respondería tarde. Lo que se hace:
//
//   1. Cada foto trae `ack`, la última entrada del invitado que el anfitrión ya usó. Las entradas posteriores
//      todavía no se ven en lo que se dibuja.
//   2. Un «muñeco de mentira» muy simple (la raíz: posición en el suelo, velocidad y rumbo) parte de cómo estaba el
//      muñeco en lo que se dibuja y les aplica esas entradas pendientes con las mismas reglas de andar y girar que
//      usa el muñeco de verdad (AJUSTES.andar). Es un integrador de unas 10 a 20 iteraciones: no cuesta nada.
//   3. Lo que se movió y giró ese muñeco de mentira se le suma a todo el muñeco dibujado (todas sus partes,
//      girando alrededor de la pelvis). Brazos y piernas siguen siendo los del anfitrión, solo que corridos.
//
// No hay vuelta atrás ni repetición de físicas: cuando el anfitrión confirma una entrada, sale de las pendientes y
// su efecto ya viene en la foto, así que la corrección es continua y nunca salta. Lo que no predice: chocar (si
// camina contra un huacal se mete hasta unos centímetros y vuelve), saltar, trepar, caerse ni agarrar; eso lo decide el
// anfitrión y se ve con el retraso de siempre.
import type { EntradaJugador } from "../entrada/mandos";
import { PASO } from "../motor/bucle";
import { AJUSTES, type EstadoMuneco } from "../muneco";

export interface Raiz {
  x: number;
  z: number;
  vx: number;
  vz: number;
  rumbo: number;
}

export interface Desvio {
  x: number;
  z: number;
  rumbo: number;
}

/**
 * Cuánto se va a mover y girar el muñeco con las `pendientes` (de la más vieja a la más nueva), partiendo de
 * `inicio`. `parcial` (0 a 1) es cuánto de la primera falta todavía (el ack interpolado entre dos fotos tiene fracción).
 */
export function predecir(
  inicio: Raiz,
  pendientes: readonly EntradaJugador[],
  estado: EstadoMuneco,
  parcial = 1,
  salida: Desvio = { x: 0, z: 0, rumbo: 0 },
): Desvio {
  salida.x = 0;
  salida.z = 0;
  salida.rumbo = 0;
  // Caído, levantándose o trepando no manda el jugador (o manda distinto): no se predice
  if (estado !== "de pie" && estado !== "en el aire") return salida;
  const a = AJUSTES.andar;
  let { vx, vz, rumbo } = inicio;
  pendientes.forEach((entrada, i) => {
    const dt = PASO * (i === 0 ? parcial : 1);
    const girar = Math.max(-1, Math.min(1, entrada.girar));
    rumbo += girar * a.giro * dt;
    if (estado === "de pie") {
      const deseada = Math.max(-1, Math.min(1, entrada.avanzar)) * a.velocidad;
      let ax = a.respuesta * (Math.sin(rumbo) * deseada - vx);
      let az = a.respuesta * (Math.cos(rumbo) * deseada - vz);
      const largo = Math.hypot(ax, az);
      if (largo > a.aceleracionMaxima) {
        ax *= a.aceleracionMaxima / largo;
        az *= a.aceleracionMaxima / largo;
      }
      vx += ax * dt;
      vz += az * dt;
    }
    salida.x += vx * dt;
    salida.z += vz * dt;
  });
  salida.rumbo = rumbo - inicio.rumbo;
  return salida;
}
