// En qué anda el juego (TU-15): en el menú de inicio, jugando o en pausa. Sin DOM: lo prueba `juego.test.ts`.
//
//   menú     el menú está sobre la escena viva: las físicas corren, pero los muñecos no reciben entrada
//   jugando  todo anda; pausa (Esc, P o Start, cualquiera de los dos) → pausa
//   pausa    las físicas se paran (main.ts deja de avanzar el bucle); pausa otra vez o «Seguir» → jugando;
//            «Salir al menú» → menú
//
// La pausa del menú no hace nada: desde el menú se entra con «Jugar aquí de a dos».

export type EstadoJuego = "menu" | "jugando" | "pausa";

export interface Juego {
  readonly estado: EstadoJuego;
  /** Si las físicas avanzan (todo menos la pausa). */
  readonly corren: boolean;
  /** Si los muñecos reciben la entrada de los jugadores (solo jugando). */
  readonly atienden: boolean;
  /** Alguien apretó pausa: alterna entre jugar y pausa. */
  pausar(): void;
  /** «Jugar aquí de a dos», desde el menú. */
  jugar(): void;
  /** «Seguir», desde la pausa. */
  seguir(): void;
  /** «Salir al menú», desde la pausa. */
  salirAlMenu(): void;
  /** Avisa cada vez que cambia el estado. */
  alCambiar(aviso: (estado: EstadoJuego) => void): void;
}

export function crearJuego(inicial: EstadoJuego = "menu"): Juego {
  let estado = inicial;
  const avisos: ((estado: EstadoJuego) => void)[] = [];
  const pasarA = (nuevo: EstadoJuego) => {
    if (nuevo === estado) return;
    estado = nuevo;
    for (const aviso of avisos) aviso(estado);
  };
  return {
    get estado() {
      return estado;
    },
    get corren() {
      return estado !== "pausa";
    },
    get atienden() {
      return estado === "jugando";
    },
    pausar() {
      if (estado === "jugando") pasarA("pausa");
      else if (estado === "pausa") pasarA("jugando");
    },
    jugar() {
      if (estado === "menu") pasarA("jugando");
    },
    seguir() {
      if (estado === "pausa") pasarA("jugando");
    },
    salirAlMenu() {
      if (estado === "pausa") pasarA("menu");
    },
    alCambiar(aviso) {
      avisos.push(aviso);
    },
  };
}
