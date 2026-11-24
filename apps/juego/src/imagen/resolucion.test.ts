import { describe, expect, it } from "vitest";
import { crearResolucionAdaptable, densidadDeDibujo } from "./resolucion";

/** Dibuja `cuadros` cuadros separados por `cada` segundos, desde `desde`. Devuelve el último instante. */
function dibujar(r: ReturnType<typeof crearResolucionAdaptable>, desde: number, cuadros: number, cada: number) {
  let t = desde;
  for (let i = 0; i < cuadros; i++) {
    t += cada;
    r.cuadro(t);
  }
  return t;
}

describe("resolución que se adapta", () => {
  it("a 60 cuadros por segundo se queda en resolución completa", () => {
    const r = crearResolucionAdaptable();
    dibujar(r, 0, 600, 1 / 60);
    expect(r.escala).toBe(1);
  });

  it("si la máquina no da abasto baja de a poco hasta la mínima y ahí se queda", () => {
    const r = crearResolucionAdaptable({ minima: 0.35 });
    let t = dibujar(r, 0, 50, 1 / 20);
    expect(r.escala).toBe(0.75);
    t = dibujar(r, t, 30, 1 / 20);
    expect(r.escala).toBe(0.5);
    t = dibujar(r, t, 30, 1 / 20);
    expect(r.escala).toBe(0.35);
    dibujar(r, t, 100, 1 / 5);
    expect(r.escala).toBe(0.35);
  });

  it("los primeros cuadros lentos (sombreadores compilando) no cuentan", () => {
    const r = crearResolucionAdaptable({ calentamiento: 1 });
    let t = 0;
    r.cuadro(t);
    t = dibujar(r, t, 1, 0.9);
    dibujar(r, t, 300, 1 / 60);
    expect(r.escala).toBe(1);
  });

  it("una máquina muy lenta (un cuadro por segundo) baja de una vez a la mínima, en pocos segundos", () => {
    const r = crearResolucionAdaptable({ minima: 0.35 });
    dibujar(r, 0, 4, 1);
    expect(r.escala).toBe(0.35);
  });

  it("si va apenas lenta baja solo un paso", () => {
    const r = crearResolucionAdaptable();
    dibujar(r, 0, 60, 1 / 28);
    expect(r.escala).toBe(0.75);
  });

  it("un tirón suelto no baja la resolución", () => {
    const r = crearResolucionAdaptable();
    let t = dibujar(r, 0, 120, 1 / 60);
    t = dibujar(r, t, 1, 1.5);
    dibujar(r, t, 300, 1 / 60);
    expect(r.escala).toBe(1);
  });

  it("una pausa larga (pestaña escondida) no cuenta como lentitud", () => {
    const r = crearResolucionAdaptable();
    let t = dibujar(r, 0, 120, 1 / 60);
    r.reiniciar();
    t = dibujar(r, t, 1, 10);
    dibujar(r, t, 120, 1 / 60);
    expect(r.escala).toBe(1);
  });

  it("sin tarjeta de video baja directo a la mínima y no baja más", () => {
    const r = crearResolucionAdaptable({ minima: 0.35 });
    r.bajarAlMinimo();
    expect(r.escala).toBe(0.35);
    dibujar(r, 0, 20, 1);
    expect(r.escala).toBe(0.35);
  });
});

describe("densidad de dibujo", () => {
  it("en la computadora llega hasta 2", () => {
    expect(densidadDeDibujo(1, false)).toBe(1);
    expect(densidadDeDibujo(2, false)).toBe(2);
    expect(densidadDeDibujo(3, false)).toBe(2);
  });
  it("con los dedos se queda en 1.5 aunque la pantalla tenga más", () => {
    expect(densidadDeDibujo(2.625, true)).toBe(1.5);
    expect(densidadDeDibujo(3.5, true)).toBe(1.5);
    expect(densidadDeDibujo(1, true)).toBe(1);
  });
});
