import { describe, expect, it } from "vitest";
import { DESCRIPCION_TACTIL } from "../entrada/ayuda";
import { COMO_SE_JUEGA, COMO_SE_JUEGA_TACTIL, proponerTutorial, tutorialHecho } from "./tutorial";

describe("el tutorial en el menú", () => {
  it("se propone primero solo a los que no lo hicieron y no ganaron nada", () => {
    expect(proponerTutorial(false, [])).toBe(true);
    expect(proponerTutorial(true, [])).toBe(false);
    expect(proponerTutorial(false, ["patio"])).toBe(false);
  });

  it("sin almacenamiento, cuenta como no hecho", () => {
    expect(tutorialHecho()).toBe(false);
  });
});

describe("cómo se juega con los dedos", () => {
  const texto = (filas: readonly (readonly [string, string])[]) => filas.flat().join(" ");
  it("no habla de teclas: dice la mitad de cada uno y los botones de la pantalla", () => {
    const todo = `${texto(COMO_SE_JUEGA_TACTIL)} ${DESCRIPCION_TACTIL.map((j) => `${j.nombre} ${texto(j.filas)}`).join(" ")}`;
    expect(todo).not.toMatch(/tecla|\bH\b|Espacio|Enter/);
    expect(todo).toMatch(/mitad izquierda/);
    expect(todo).toMatch(/mitad derecha/);
    for (const boton of ["Agarrar", "Saltar", "¡Eh!"]) expect(todo).toContain(boton);
  });
  it("cubre lo mismo que la versión del teclado", () => {
    expect(COMO_SE_JUEGA_TACTIL.map(([que]) => que)).toEqual(COMO_SE_JUEGA.map(([que]) => que));
  });
});
