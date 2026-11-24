// El parlante de una escena (TU-59): toca los efectos que le pasa el oído (con el límite de voces), y arma el
// ambiente y la música cuando la salida despierta. Antes de despertar, los efectos se pierden y el ambiente y la
// música quedan anotados para cuando despierte.
import { type Ambiente, crearAmbiente, type SonidoDeAmbiente } from "./ambiente";
import { duracion, sonidoDe, tocarReceta } from "./efectos";
import type { EventoSonido } from "./eventos";
import { salidaDelJuego } from "./global";
import { crearMusica, type Musica } from "./musica";
import type { Salida } from "./salida";
import { crearLimite } from "./voces";

export interface Parlante {
  /** Toca lo que sonó, corrido hacia un lado (`paneo` de -1 a 1). */
  efecto(evento: EventoSonido, paneo: number): void;
  /** El ambiente que tiene que sonar. */
  ambiente(ambiente: Ambiente): void;
  /** Si suena la música del menú. */
  musica(si: boolean): void;
}

export function crearParlante(salida: Salida = salidaDelJuego()): Parlante {
  const limite = crearLimite();
  let ambiente: Ambiente = {};
  let conMusica = false;
  let sonidoDeAmbiente: SonidoDeAmbiente | undefined;
  let musica: Musica | undefined;
  salida.alDespertar((c) => {
    sonidoDeAmbiente = crearAmbiente(c.contexto, c.efectos);
    sonidoDeAmbiente.poner(ambiente, 2.5);
    musica = crearMusica(c.contexto, c.musica);
    musica.sonar(conMusica);
  });
  return {
    efecto(evento, paneo) {
      const c = salida.canales();
      if (!c) return;
      const receta = sonidoDe(evento);
      if (!limite.pedir(receta.clave, c.contexto.currentTime, duracion(receta), receta.separacion)) return;
      const lado = c.contexto.createStereoPanner();
      lado.pan.value = paneo;
      lado.connect(c.efectos);
      const altura = 1 + (Math.random() * 2 - 1) * receta.variacion;
      tocarReceta(c.contexto, lado, receta, receta.volumen, altura);
    },
    ambiente(nuevo) {
      ambiente = nuevo;
      sonidoDeAmbiente?.poner(nuevo);
    },
    musica(si) {
      conMusica = si;
      musica?.sonar(si);
    },
  };
}
