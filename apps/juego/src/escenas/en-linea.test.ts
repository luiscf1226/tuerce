// La escena en línea sin navegador: dónde busca la sala y que se arma quieta hasta que haya conexión.
import { describe, expect, it, vi } from "vitest";
import { crearMundo } from "../motor/fisica";
import { crearEscenaDos } from "./dos";
import { baseDeSala, type CrearEscenaDeDos, crearEscenaEnLinea } from "./en-linea";
import type { AvanceDeNivel } from "./tipos";

describe("en línea", () => {
  it("busca la sala configurada, la local en desarrollo, la de vista previa en un PR y si no la de producción", () => {
    expect(baseDeSala("tuerce.x.workers.dev", false, "https://mi-sala.dev/")).toBe("https://mi-sala.dev");
    expect(baseDeSala("192.168.1.20", true)).toBe("http://192.168.1.20:8798");
    expect(baseDeSala("pr-12-tuerce.luiscf1226.workers.dev", false)).toBe(
      "https://tuerce-sala-preview.luiscf1226.workers.dev",
    );
    expect(baseDeSala("tuerce.luiscf1226.workers.dev", false)).toBe("https://tuerce-sala.luiscf1226.workers.dev");
  });

  it("sin conexión no simula: los muñecos esperan donde arrancan", async () => {
    const { rapier, mundo } = await crearMundo();
    const escena = crearEscenaEnLinea(rapier, mundo, new URLSearchParams("j1=andar:1"));
    const antes = escena.munecos[0].partes.pelvis.translation();
    for (let i = 0; i < 60; i++) escena.pasar();
    escena.dibujar(1);
    const despues = escena.munecos[0].partes.pelvis.translation();
    expect(Math.hypot(despues.x - antes.x, despues.z - antes.z)).toBeLessThan(1e-6);
    expect(escena.nombre).toBe("en-linea");
  });

  it("usa la escena de base que se le pase y deja ver su avance; sin avance funciona igual", async () => {
    const { rapier, mundo } = await crearMundo();
    const avance: AvanceDeNivel = { nivel: 99, puntoDeControl: () => 2, alCambiar: () => () => {}, irA: vi.fn() };
    let enRed: Parameters<CrearEscenaDeDos>[3] | undefined;
    const conAvance: CrearEscenaDeDos = (r, m, p, red) => {
      enRed = red;
      return { ...crearEscenaDos(r, m, p, red), avance };
    };
    const escena = crearEscenaEnLinea(rapier, mundo, new URLSearchParams(), conAvance);
    expect(escena.avance).toBe(avance);
    // La red decide las entradas: sin conexión, no se simula
    expect(enRed).toBeDefined();
    expect(escena.nombre).toBe("en-linea");

    const otro = await crearMundo();
    expect(crearEscenaEnLinea(otro.rapier, otro.mundo, new URLSearchParams()).avance).toBeUndefined();
  });
});
