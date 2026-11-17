import { describe, expect, it } from "vitest";
import { proponerTutorial, tutorialHecho } from "./tutorial";

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
