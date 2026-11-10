import { describe, expect, it } from "vitest";
import type { EntradaMuneco } from "../muneco";
import {
  type Asignacion,
  aplicarZonaMuerta,
  BOTON,
  cambiarDeJugador,
  crearControles,
  type EntradaJugador,
  entradaQuieta,
  entradasFijas,
  leerMando,
  leerTeclasDe,
  type MandoLeido,
  quitarMando,
  SIN_MANDOS,
  sumarMando,
  TECLAS,
} from "./mandos";

/** Un `Gamepad` de mentira con mapeo estándar: 4 ejes y 17 botones sueltos. */
function mando(index: number, { ejes = [0, 0], botones = {} as Record<number, number> } = {}): MandoLeido {
  return {
    index,
    connected: true,
    axes: [...ejes, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: (botones[i] ?? 0) > 0.5, value: botones[i] ?? 0 })),
  };
}

const quieta = (cambios: Partial<EntradaJugador> = {}): EntradaJugador => ({ ...entradaQuieta(), ...cambios });

describe("teclado compartido", () => {
  it("ninguna tecla es de los dos jugadores", () => {
    const uno = Object.keys(TECLAS[0]);
    const dos = Object.keys(TECLAS[1]);
    expect(uno.filter((t) => dos.includes(t))).toEqual([]);
  });

  it("cada jugador tiene las siete acciones", () => {
    for (const mapa of TECLAS) {
      expect(new Set(Object.values(mapa))).toEqual(
        new Set(["adelante", "atras", "izquierda", "derecha", "saltar", "brazoIzquierdo", "brazoDerecho"]),
      );
    }
  });

  it("no usa el Control: Ctrl+W del otro jugador cerraría la pestaña", () => {
    for (const mapa of TECLAS) expect(Object.keys(mapa).some((t) => t.startsWith("Control"))).toBe(false);
  });

  it("jugador 1: WASD, Espacio, Q y E", () => {
    expect(leerTeclasDe(0, ["KeyW", "KeyA", "Space", "KeyQ"])).toEqual(
      quieta({ avanzar: 1, girar: 1, saltar: true, brazoIzquierdo: true }),
    );
    expect(leerTeclasDe(0, ["KeyS", "KeyD", "KeyE"])).toEqual(quieta({ avanzar: -1, girar: -1, brazoDerecho: true }));
  });

  it("jugador 2: flechas, Enter, coma y punto (o 1 y 3 del numérico)", () => {
    expect(leerTeclasDe(1, ["ArrowUp", "ArrowRight", "Enter", "Period"])).toEqual(
      quieta({ avanzar: 1, girar: -1, saltar: true, brazoDerecho: true }),
    );
    expect(leerTeclasDe(1, ["ArrowDown", "Numpad1", "Numpad3"])).toEqual(
      quieta({ avanzar: -1, brazoIzquierdo: true, brazoDerecho: true }),
    );
  });

  it("las teclas de un jugador no mueven al otro", () => {
    const todas = [...Object.keys(TECLAS[0])];
    expect(leerTeclasDe(1, todas)).toEqual(entradaQuieta());
    expect(leerTeclasDe(0, Object.keys(TECLAS[1]))).toEqual(entradaQuieta());
  });

  it("teclas opuestas se anulan", () => {
    expect(leerTeclasDe(0, ["KeyW", "KeyS", "KeyA", "KeyD"])).toEqual(entradaQuieta());
  });

  it("la entrada sirve como la del muñeco", () => {
    const entrada: EntradaMuneco = leerTeclasDe(0, ["KeyW"]);
    expect(entrada.avanzar).toBe(1);
  });
});

describe("mando", () => {
  it("la palanca hacia arriba camina y hacia la izquierda gira a la izquierda", () => {
    const e = leerMando(mando(0, { ejes: [-1, -1] }));
    expect(e.avanzar).toBeCloseTo(Math.SQRT1_2, 5);
    expect(e.girar).toBeCloseTo(Math.SQRT1_2, 5);
    expect(leerMando(mando(0, { ejes: [0, 1] })).avanzar).toBeCloseTo(-1, 5);
  });

  it("dentro de la zona muerta no se mueve, y fuera arranca de 0 sin salto", () => {
    expect(leerMando(mando(0, { ejes: [0.12, -0.12] }))).toEqual(entradaQuieta());
    expect(aplicarZonaMuerta(0, -0.21)[1]).toBeCloseTo(-0.0125, 4);
    expect(aplicarZonaMuerta(0, -0.6)[1]).toBeCloseTo(-0.5, 5);
    expect(aplicarZonaMuerta(0, -1)[1]).toBeCloseTo(-1, 5);
  });

  it("la cruceta hace lo mismo que la palanca", () => {
    expect(leerMando(mando(0, { botones: { [BOTON.arriba]: 1, [BOTON.derecha]: 1 } }))).toEqual(
      quieta({ avanzar: 1, girar: -1 }),
    );
    expect(leerMando(mando(0, { ejes: [0, -1], botones: { [BOTON.arriba]: 1 } })).avanzar).toBe(1);
  });

  it("A salta; LB o LT el brazo izquierdo; RB o RT el derecho", () => {
    expect(leerMando(mando(0, { botones: { [BOTON.a]: 1 } })).saltar).toBe(true);
    expect(leerMando(mando(0, { botones: { [BOTON.lb]: 1 } })).brazoIzquierdo).toBe(true);
    expect(leerMando(mando(0, { botones: { [BOTON.rt]: 0.6 } })).brazoDerecho).toBe(true);
    // un gatillo apenas rozado no cuenta
    expect(leerMando(mando(0, { botones: { [BOTON.lt]: 0.1 } })).brazoIzquierdo).toBe(false);
  });
});

describe("a quién va cada mando", () => {
  it("el primero va al jugador 2 y el segundo al jugador 1", () => {
    const uno = sumarMando(SIN_MANDOS, 3);
    expect(uno).toEqual([null, 3]);
    expect(sumarMando(uno, 0)).toEqual([0, 3]);
    expect(sumarMando(sumarMando(uno, 0), 5)).toEqual([0, 3]);
    expect(sumarMando(uno, 3)).toBe(uno);
  });

  it("cambiar de jugador mueve el mando o los intercambia", () => {
    expect(cambiarDeJugador([null, 3], 3)).toEqual([3, null]);
    expect(cambiarDeJugador([0, 3], 0)).toEqual([3, 0]);
    expect(cambiarDeJugador([null, 3], 7)).toEqual([null, 3]);
  });

  it("al desconectarse, su jugador vuelve al teclado", () => {
    expect(quitarMando([0, 3], 3)).toEqual([0, null]);
    // y el que llega después ocupa el lugar libre
    expect(sumarMando([0, null], 4)).toEqual([0, 4]);
  });
});

describe("controles vivos", () => {
  /** Controles con mandos de mentira y teclado de mentira. */
  function armar() {
    let conectados: MandoLeido[] = [];
    const oyentes = new Map<string, (e: { code: string; preventDefault(): void }) => void>();
    const teclado = {
      addEventListener: (tipo: string, oyente: (e: { code: string; preventDefault(): void }) => void) =>
        oyentes.set(tipo, oyente),
    } as unknown as Pick<Window, "addEventListener">;
    const controles = crearControles({ parametros: new URLSearchParams(), mandos: () => conectados, teclado });
    const cambios: Asignacion[] = [];
    controles.alCambiar((a) => cambios.push(a));
    const tecla = (tipo: "keydown" | "keyup", code: string) => oyentes.get(tipo)?.({ code, preventDefault() {} });
    return {
      controles,
      cambios,
      tecla,
      conectar: (...m: MandoLeido[]) => {
        conectados = m;
      },
    };
  }

  it("un mando conectado no cuenta hasta que aprieta un botón; entonces juega el jugador 2", () => {
    const { controles, conectar } = armar();
    conectar(mando(0, { ejes: [0, -1] }));
    expect(controles.leer()).toEqual([entradaQuieta(), entradaQuieta()]);
    expect(controles.asignacion).toEqual([null, null]);
    conectar(mando(0, { ejes: [0, -1], botones: { [BOTON.a]: 1 } }));
    const [uno, dos] = controles.leer();
    expect(controles.asignacion).toEqual([null, 0]);
    expect(uno).toEqual(entradaQuieta());
    expect(dos.avanzar).toBeCloseTo(1, 5);
    expect(dos.saltar).toBe(true);
  });

  it("teclado y mando a la vez: el jugador 1 con WASD y el 2 con el mando", () => {
    const { controles, conectar, tecla } = armar();
    conectar(mando(1, { botones: { [BOTON.rb]: 1 } }));
    tecla("keydown", "KeyW");
    const [uno, dos] = controles.leer();
    expect(uno).toEqual(quieta({ avanzar: 1 }));
    expect(dos).toEqual(quieta({ brazoDerecho: true }));
    tecla("keyup", "KeyW");
    expect(controles.leer()[0]).toEqual(entradaQuieta());
  });

  it("dos mandos: uno por jugador; Back los intercambia una sola vez por apretón", () => {
    const { controles, conectar, cambios } = armar();
    conectar(mando(0, { botones: { [BOTON.a]: 1 } }), mando(1, { botones: { [BOTON.a]: 1 } }));
    controles.leer();
    expect(controles.asignacion).toEqual([1, 0]);

    conectar(mando(0, { ejes: [-1, 0] }), mando(1, { ejes: [0, -1] }));
    const [uno, dos] = controles.leer();
    expect(uno.avanzar).toBeCloseTo(1, 5);
    expect(dos.girar).toBeCloseTo(1, 5);

    conectar(mando(0, { botones: { [BOTON.back]: 1 } }), mando(1));
    controles.leer();
    controles.leer(); // sigue apretado: no vuelve a cambiar
    expect(controles.asignacion).toEqual([0, 1]);
    expect(cambios).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  it("si un mando se desconecta, su jugador vuelve al teclado", () => {
    const { controles, conectar, tecla } = armar();
    conectar(mando(0, { botones: { [BOTON.a]: 1 } }));
    controles.leer();
    conectar();
    tecla("keydown", "ArrowUp");
    const [, dos] = controles.leer();
    expect(controles.asignacion).toEqual([null, null]);
    expect(dos.avanzar).toBe(1);
  });

  it("los mandos de `null` (huecos de getGamepads) no molestan", () => {
    const controles = crearControles({ parametros: new URLSearchParams(), mandos: () => [null, null] });
    expect(controles.leer()).toEqual([entradaQuieta(), entradaQuieta()]);
  });
});

describe("entrada fija por la dirección", () => {
  it("j1 y j2 fijan a cada jugador; el que no está se queda quieto", () => {
    expect(entradasFijas(new URLSearchParams("j1=andar:1,girar:0.2,saltar&j2=andar:0.8,der:1"))).toEqual([
      quieta({ avanzar: 1, girar: 0.2, saltar: true }),
      quieta({ avanzar: 0.8, brazoDerecho: true }),
    ]);
    expect(entradasFijas(new URLSearchParams("j2=girar:-2"))).toEqual([entradaQuieta(), quieta({ girar: -1 })]);
  });

  it("&andar= y &girar= siguen valiendo para el jugador 1", () => {
    expect(entradasFijas(new URLSearchParams("andar=0.5&girar=0.3"))).toEqual([
      quieta({ avanzar: 0.5, girar: 0.3 }),
      entradaQuieta(),
    ]);
  });

  it("sin parámetros la entrada no es fija; con ellos teclado y mandos no cuentan", () => {
    expect(entradasFijas(new URLSearchParams("escena=dos"))).toBeUndefined();
    const controles = crearControles({
      parametros: new URLSearchParams("j1=andar:1"),
      mandos: () => [mando(0, { ejes: [0, 1], botones: { [BOTON.a]: 1 } })],
    });
    expect(controles.fija).toBe(true);
    expect(controles.leer()).toEqual([quieta({ avanzar: 1 }), entradaQuieta()]);
    expect(controles.asignacion).toEqual([null, null]);
  });
});
