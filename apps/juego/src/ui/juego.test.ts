// La máquina de la pausa: menú, jugando y pausa.
import { describe, expect, it } from "vitest";
import { crearJuego, type EstadoJuego } from "./juego";

describe("menú y pausa", () => {
  it("arranca en el menú: la escena corre pero nadie maneja a los muñecos", () => {
    const juego = crearJuego();
    expect(juego.estado).toBe("menu");
    expect(juego.corren).toBe(true);
    expect(juego.atienden).toBe(false);
  });

  it("en el menú la pausa no hace nada; «Jugar aquí de a dos» entra", () => {
    const juego = crearJuego();
    juego.pausar();
    expect(juego.estado).toBe("menu");
    juego.jugar();
    expect(juego.estado).toBe("jugando");
    expect(juego.atienden).toBe(true);
  });

  it("jugando, la pausa para las físicas y otra pausa sigue", () => {
    const juego = crearJuego("jugando");
    juego.pausar();
    expect(juego.estado).toBe("pausa");
    expect(juego.corren).toBe(false);
    expect(juego.atienden).toBe(false);
    juego.pausar();
    expect(juego.estado).toBe("jugando");
    expect(juego.corren).toBe(true);
  });

  it("desde la pausa: «Seguir» vuelve a jugar y «Salir al menú» vuelve al menú", () => {
    const juego = crearJuego("jugando");
    juego.pausar();
    juego.seguir();
    expect(juego.estado).toBe("jugando");
    juego.pausar();
    juego.salirAlMenu();
    expect(juego.estado).toBe("menu");
    expect(juego.corren).toBe(true);
  });

  it("los botones fuera de lugar no hacen nada", () => {
    const juego = crearJuego("jugando");
    juego.jugar();
    juego.seguir();
    juego.salirAlMenu();
    expect(juego.estado).toBe("jugando");
  });

  it("avisa cada cambio, una sola vez", () => {
    const juego = crearJuego();
    const cambios: EstadoJuego[] = [];
    juego.alCambiar((e) => cambios.push(e));
    juego.jugar();
    juego.jugar();
    juego.pausar();
    juego.salirAlMenu();
    expect(cambios).toEqual(["jugando", "pausa", "menu"]);
  });
});
