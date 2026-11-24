// El sonido del juego (TU-59): todo sintetizado con Web Audio, sin archivos.
//
//   mezcla.ts     los tres volúmenes (general, efectos, música), guardados en este navegador
//   salida.ts     el AudioContext (nace con el primer gesto del jugador) y sus canales; `?mudo` lo apaga todo
//                 (y la pestaña sigue muda al navegar)
//   eventos.ts    qué sonó en cada paso, mirando el mundo (pasos según el suelo, saltos, caídas, agarres, agua, piezas)
//   efectos.ts    la receta de cada evento y cómo se sintetiza
//   voces.ts      el límite de voces: cuántos a la vez y cada cuánto el mismo
//   ambiente.ts   el ambiente de cada nivel, de día y de noche
//   musica.ts     la música suave del menú
//   oido.ts       el pegamento de una escena: mira, decide qué pisa cada uno y se lo pasa al parlante
//
// API de volúmenes (para las Opciones, TU-60):
//   volumenes()                      → { general, efectos, musica }, cada uno de 0 a 1
//   fijarVolumen(canal, n)           canal: "general" | "efectos" | "musica"; n se recorta a 0–1, se guarda y suena ya
//   alCambiarVolumen(aviso)          avisa cada vez que cambia alguno; devuelve cómo dejar de avisar
//   estaMudo()                       si esta página no suena nunca (`?mudo`, `?congelar=` o sin Web Audio)
//
// Las escenas `dos` y `nivel` arman su oído (`crearOido`) y lo llaman después de cada paso; en línea, el invitado
// oye con lo que trae la foto (`oido.mirarCon`, ver en-linea.ts).
import { mezclaDelJuego, salidaDelJuego } from "./global";
import type { Canal, Volumenes } from "./mezcla";

export { salidaDelJuego } from "./global";
export type { Canal, Volumenes } from "./mezcla";
export { CANALES, VOLUMENES_INICIALES } from "./mezcla";
export { crearOido, cuerposQueSuenan, type LoQueSeVe, type Oido, sueloDelMaterial } from "./oido";

/** Los tres volúmenes de ahora, de 0 a 1. */
export function volumenes(): Volumenes {
  return mezclaDelJuego().volumenes();
}

/** Cambia un volumen (se recorta a 0–1), lo guarda en este navegador y se oye enseguida. */
export function fijarVolumen(canal: Canal, valor: number): void {
  mezclaDelJuego().fijarVolumen(canal, valor);
}

/** Avisa cada vez que cambia algún volumen. Devuelve cómo dejar de avisar. */
export function alCambiarVolumen(aviso: (volumenes: Volumenes) => void): () => void {
  return mezclaDelJuego().alCambiarVolumen(aviso);
}

/** Si esta página no suena nunca. */
export function estaMudo(): boolean {
  return salidaDelJuego().muda;
}
