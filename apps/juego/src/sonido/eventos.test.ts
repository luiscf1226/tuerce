// Qué evento dispara qué sonido: el detector con mundos inventados paso a paso (sin físicas ni audio).
import { describe, expect, it } from "vitest";
import { PASO } from "../motor/bucle";
import type { EstadoMuneco } from "../muneco";
import {
  type CuerpoVisto,
  crearDetector,
  type EventoSonido,
  type MunecoVisto,
  type Suelo,
  UMBRALES,
  type VozDePieza,
} from "./eventos";

const quieto = (x = 0, y = 0.5, cambios: Partial<MunecoVisto> = {}): MunecoVisto => ({
  estado: "de pie",
  manos: [false, false],
  pelvis: { x, y, z: 0 },
  agua: 0,
  ...cambios,
});

/** Un detector y cómo darle un paso: el rojo como se pida, el turquesa quieto lejos, y las piezas. */
function probar(suelo: Suelo = "tierra") {
  const detector = crearDetector();
  const pedidos: number[] = [];
  return {
    paso(rojo: MunecoVisto, cuerpos: CuerpoVisto[] = []): EventoSonido[] {
      return detector.mirar({ munecos: [rojo, quieto(10)], cuerpos }, (j) => {
        pedidos.push(j);
        return suelo;
      });
    },
    pedidos,
  };
}

const de = (eventos: EventoSonido[], cual: EventoSonido["cual"]) => eventos.filter((e) => e.cual === cual);

describe("detector de sonidos", () => {
  it("andando suena un paso cada zancada, con el suelo que pisa; quieto, ninguno", () => {
    const d = probar("piedra");
    const eventos: EventoSonido[] = [];
    // 2 s quieto y 2 s andando a 1.5 m/s
    for (let i = 0; i < 120; i++) eventos.push(...d.paso(quieto()));
    expect(eventos).toEqual([]);
    for (let i = 0; i < 120; i++) eventos.push(...d.paso(quieto(i * 1.5 * PASO)));
    const pasos = de(eventos, "paso");
    expect(pasos.length).toBe(Math.floor((119 * 1.5 * PASO) / UMBRALES.zancada));
    expect(pasos.every((e) => e.cual === "paso" && e.suelo === "piedra" && e.jugador === 0)).toBe(true);
    // El suelo se pregunta solo cuando hace falta: una vez por paso, no por cada paso de físicas
    expect(d.pedidos.length).toBe(pasos.length);
  });

  it("en el aire no hay pasos aunque se mueva", () => {
    const d = probar();
    const eventos: EventoSonido[] = [];
    for (let i = 0; i < 60; i++) eventos.push(...d.paso(quieto(i * 2 * PASO, 0.5, { estado: "en el aire" })));
    expect(de(eventos, "paso")).toEqual([]);
  });

  it("saltar: deja el suelo subiendo; aterrizar: vuelve a estar de pie después de bajar rápido", () => {
    const d = probar("madera");
    d.paso(quieto());
    d.paso(quieto());
    // Sube a 4 m/s
    const salto = d.paso(quieto(0, 0.5 + 4 * PASO, { estado: "en el aire" }));
    expect(salto.map((e) => e.cual)).toEqual(["salto"]);
    // Baja a 5 m/s unos pasos y cae de pie
    for (let i = 1; i <= 10; i++) d.paso(quieto(0, 1.5 - i * 5 * PASO, { estado: "en el aire" }));
    const y = 1.5 - 10 * 5 * PASO;
    const llega = d.paso(quieto(0, y, { estado: "de pie" }));
    expect(llega).toHaveLength(1);
    expect(llega[0]).toMatchObject({ cual: "aterrizar", suelo: "madera" });
  });

  it("bajar despacio un escalón no suena a aterrizaje; dejar el suelo cayendo no es salto", () => {
    const d = probar();
    d.paso(quieto());
    d.paso(quieto());
    const cae = d.paso(quieto(0, 0.5 - PASO, { estado: "en el aire" }));
    expect(cae).toEqual([]);
    const llega = d.paso(quieto(0, 0.5 - 2 * PASO, { estado: "de pie" }));
    expect(llega).toEqual([]);
  });

  it("caer como un trapo suena a caída, más fuerte si venía rápido", () => {
    const fuerza = (rapidez: number) => {
      const d = probar();
      d.paso(quieto(0, 3, { estado: "en el aire" }));
      for (let i = 1; i <= 6; i++) d.paso(quieto(0, 3 - i * rapidez * PASO, { estado: "en el aire" }));
      const y = 3 - 6 * rapidez * PASO;
      const e = d.paso(quieto(0, y, { estado: "caido" }));
      expect(e.map((x) => x.cual)).toEqual(["caer"]);
      return e[0]?.fuerza ?? 0;
    };
    expect(fuerza(7)).toBeGreaterThan(fuerza(1));
  });

  it("frenar de golpe sin cambiar de estado es un golpe, y el mismo golpe no suena varias veces", () => {
    const d = probar();
    const eventos: EventoSonido[] = [];
    // Va de costado a 6 m/s (lo empujó algo) y se frena en seco contra una pared
    for (let i = 0; i < 5; i++) eventos.push(...d.paso(quieto(i * 6 * PASO, 0.5, { estado: "en el aire" })));
    for (let i = 0; i < 10; i++) eventos.push(...d.paso(quieto(4 * 6 * PASO, 0.5, { estado: "en el aire" })));
    expect(de(eventos, "golpe")).toHaveLength(1);
  });

  it("agarrar y soltar suenan por mano, al cambiar", () => {
    const d = probar();
    d.paso(quieto());
    expect(d.paso(quieto(0, 0.5, { manos: [true, false] })).map((e) => e.cual)).toEqual(["agarrar"]);
    expect(d.paso(quieto(0, 0.5, { manos: [true, false] }))).toEqual([]);
    expect(d.paso(quieto(0, 0.5, { manos: [true, true] })).map((e) => e.cual)).toEqual(["agarrar"]);
    expect(d.paso(quieto(0, 0.5, { manos: [false, false] })).map((e) => e.cual)).toEqual(["soltar", "soltar"]);
  });

  it("entrar al agua chapotea (los pies y después la pelvis); salir no", () => {
    const d = probar();
    d.paso(quieto());
    expect(d.paso(quieto(0, 0.5, { agua: 1 })).map((e) => e.cual)).toEqual(["chapoteo"]);
    expect(d.paso(quieto(0, 0.5, { agua: 2, estado: "en el aire" })).map((e) => e.cual)).toEqual(["chapoteo"]);
    expect(d.paso(quieto(0, 0.5, { agua: 0, estado: "en el aire" }))).toEqual([]);
  });

  it("reaparecer lejos (o retomar en otro punto) no suena a nada", () => {
    const d = probar();
    d.paso(quieto(0, 0.5, { estado: "en el aire" }));
    d.paso(quieto(0, 0.4, { estado: "en el aire" }));
    const reaparece = d.paso(quieto(30, 0.5, { estado: "de pie", manos: [true, false] }));
    expect(reaparece).toEqual([]);
  });

  describe("piezas", () => {
    const pieza = (voz: VozDePieza, x: number, y: number, giro = 0): CuerpoVisto => ({
      voz,
      posicion: { x, y, z: 0 },
      giro,
    });

    it("el huacal que cae suena a madera al dar contra el suelo, una vez; la piedra, a piedra", () => {
      for (const voz of ["madera", "piedra"] as const) {
        const d = probar();
        const eventos: EventoSonido[] = [];
        let y = 2;
        let v = 0;
        for (let i = 0; i < 40; i++) {
          v += 9.81 * PASO;
          y = Math.max(0.3, y - v * PASO);
          if (y === 0.3) v = 0;
          eventos.push(...d.paso(quieto(), [pieza(voz, 1, y)]));
        }
        const piezas = de(eventos, "pieza");
        expect(piezas, voz).toHaveLength(1);
        expect(piezas[0]).toMatchObject({ voz });
      }
    });

    it("un huacal que se arrastra parejo no suena", () => {
      const d = probar();
      const eventos: EventoSonido[] = [];
      for (let i = 0; i < 60; i++) eventos.push(...d.paso(quieto(), [pieza("madera", i * 0.8 * PASO, 0.3)]));
      expect(eventos).toEqual([]);
    });

    it("la palanca suena al llegar al tope, no mientras gira", () => {
      const d = probar();
      const eventos: EventoSonido[] = [];
      for (let i = 1; i <= 20; i++) eventos.push(...d.paso(quieto(), [pieza("palanca", 0, 1, i * 2 * PASO)]));
      const giro = 20 * 2 * PASO;
      expect(eventos).toEqual([]);
      for (let i = 0; i < 10; i++) eventos.push(...d.paso(quieto(), [pieza("palanca", 0, 1, giro)]));
      expect(eventos.map((e) => e.cual === "pieza" && e.voz)).toEqual(["palanca"]);
    });

    it("la plancha suena al hundirse y al volver a subir", () => {
      const d = probar();
      const eventos: EventoSonido[] = [];
      for (const y of [0.1, 0.1, 0.09, 0.07, 0.05, 0.05, 0.06, 0.08, 0.1, 0.1])
        eventos.push(...d.paso(quieto(), [pieza("plancha", 0, y)]));
      const fuerzas = de(eventos, "pieza").map((e) => (e.cual === "pieza" ? [e.voz, e.fuerza] : []));
      expect(fuerzas).toEqual([
        ["plancha", 1],
        ["plancha", 0.5],
      ]);
    });

    it("la campana suena en la punta de cada vaivén amplio, no en los chiquitos", () => {
      const d = probar();
      const eventos: EventoSonido[] = [];
      // Dos segundos de vaivén amplio (0.6 rad, un vaivén por segundo) y dos de uno chiquito (0.1 rad)
      for (let i = 0; i < 240; i++) {
        const amplitud = i < 120 ? 0.6 : 0.1;
        const giro = Math.abs(amplitud * Math.sin(Math.PI * 2 * i * PASO));
        eventos.push(...d.paso(quieto(), [pieza("campana", 0, 3, giro)]));
      }
      const campanadas = de(eventos, "pieza");
      expect(campanadas.length).toBe(4);
      expect(campanadas.every((e) => e.cual === "pieza" && e.voz === "campana")).toBe(true);
    });

    it("la compuerta suena al arrancar a moverse y da un golpe al parar", () => {
      const d = probar();
      const eventos: EventoSonido[] = [];
      for (let i = 0; i < 30; i++) eventos.push(...d.paso(quieto(), [pieza("compuerta", 0, 0)]));
      for (let i = 1; i <= 30; i++) eventos.push(...d.paso(quieto(), [pieza("compuerta", 0, i * 0.6 * PASO)]));
      const y = 30 * 0.6 * PASO;
      for (let i = 0; i < 30; i++) eventos.push(...d.paso(quieto(), [pieza("compuerta", 0, y)]));
      expect(eventos.map((e) => e.cual === "pieza" && e.voz)).toEqual(["compuerta", "madera"]);
    });
  });

  it("los dos muñecos suenan cada uno con su número de jugador", () => {
    const detector = crearDetector();
    const estado: EstadoMuneco = "de pie";
    const eventos: EventoSonido[] = [];
    for (let i = 0; i < 3; i++) {
      const manos = [i > 1, false] as const;
      eventos.push(
        ...detector.mirar(
          { munecos: [quieto(0, 0.5, { estado, manos }), quieto(5, 0.5, { estado, manos })], cuerpos: [] },
          () => "tierra",
        ),
      );
    }
    expect(eventos.map((e) => (e.cual === "agarrar" ? e.jugador : -1))).toEqual([0, 1]);
  });
});
