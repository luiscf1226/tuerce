// Lo que decide el panel de la meta sin tocar la página: qué viene, qué botones y a dónde llevan.
import { describe, expect, it, vi } from "vitest";
import { HISTORIA } from "../niveles/orden";
import {
  accionesDeLaMeta,
  direccionDelNivel,
  ESPERA_FINAL,
  ESPERA_PANEL,
  esperaDelPanel,
  finDeNivel,
  loQueSigue,
  MENU,
} from "./llegada";

describe("la meta", () => {
  it("después de cada nivel de la historia viene el siguiente; después de La medianoche, el final", () => {
    const fin = finDeNivel("patio");
    expect(fin.cual === "siguiente" && fin.siguiente.clave).toBe("pinar");
    const pampa = finDeNivel("pampa");
    expect(pampa.cual === "siguiente" && pampa.siguiente.clave).toBe("medianoche");
    expect(finDeNivel("medianoche")).toEqual({ cual: "final" });
    // Los de prueba no son de la historia: solo el menú
    expect(finDeNivel("prueba")).toEqual({ cual: "menu" });
    expect(finDeNivel("piezas")).toEqual({ cual: "menu" });
    for (const n of HISTORIA.slice(0, -1)) expect(finDeNivel(n.clave).cual).toBe("siguiente");
  });

  it("en el mismo lugar: «Siguiente nivel» lleva al siguiente y «Menú» al menú", () => {
    const acciones = accionesDeLaMeta(finDeNivel("trenzas"));
    expect(acciones.map((a) => a.texto)).toEqual(["Siguiente nivel", "Menú"]);
    expect(acciones[0]).toMatchObject({ fuerte: true, href: "?escena=nivel&nivel=cafetal&jugar=" });
    expect(acciones[1]).toMatchObject({ href: MENU });
    expect(MENU).toBe("/");
  });

  it("en línea, «Siguiente nivel» llama a quien lo coordina en vez de ir directo", () => {
    const alSiguiente = vi.fn();
    const [siguiente] = accionesDeLaMeta(finDeNivel("patio"), alSiguiente);
    if (!siguiente || !("alApretar" in siguiente)) throw new Error("sin botón para apretar");
    siguiente.alApretar();
    expect(alSiguiente).toHaveBeenCalledOnce();
  });

  it("en el final solo se vuelve al menú, y en un nivel de prueba solo está el menú", () => {
    expect(accionesDeLaMeta(finDeNivel("medianoche"))).toEqual([{ texto: "Volver al menú", fuerte: true, href: "/" }]);
    expect(accionesDeLaMeta(finDeNivel("prueba"), () => {})).toEqual([{ texto: "Menú", fuerte: true, href: "/" }]);
  });

  it("el final espera más que el panel, para mirar los fuegos", () => {
    expect(esperaDelPanel(finDeNivel("patio"))).toBe(ESPERA_PANEL);
    expect(esperaDelPanel(finDeNivel("medianoche"))).toBe(ESPERA_FINAL);
    expect(ESPERA_FINAL).toBeGreaterThan(ESPERA_PANEL);
  });

  it("la dirección del siguiente: en línea pasa la sala y el pase de prueba, y nada más", () => {
    expect(direccionDelNivel("pinar", false)).toBe("?escena=nivel&nivel=pinar&jugar=");
    expect(direccionDelNivel("pinar", true)).toBe("?escena=en-linea&nivel=pinar");
    const actual = new URLSearchParams("escena=en-linea&nivel=patio&sala=http://x/sala/a&pase=abc&j1=andar:1&noche");
    expect(direccionDelNivel("pinar", true, actual)).toBe(
      `?escena=en-linea&nivel=pinar&sala=${encodeURIComponent("http://x/sala/a")}&pase=abc`,
    );
    const pampa = finDeNivel("pampa");
    if (pampa.cual !== "siguiente") throw new Error("la pampa tiene siguiente");
    expect(loQueSigue(pampa.siguiente)).toBe("Lo que sigue: La medianoche · Amazonía, Brasil");
  });
});
