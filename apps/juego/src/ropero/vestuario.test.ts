import { describe, expect, it } from "vitest";
import { leerVestuario, VESTUARIO_INICIAL } from "../../../../convex/premios";
import { aTexto, completar, vestuarioDe } from "./vestuario";

describe("vestuario", () => {
  it("sin nada elegido, el rojo con su sombrero y el turquesa con sus trenzas", () => {
    const p = new URLSearchParams();
    expect(vestuarioDe(p, 0).sombrero).toBe("ala-ancha");
    expect(vestuarioDe(p, 1).peinado).toBe("trenzas");
  });

  it("`&ropa1=` viste con cualquier prenda y deja lo demás como en el arte; lo que no existe se ignora", () => {
    const p = new URLSearchParams("ropa1=mascara:diablito,sombrero:corona&ropa2=peinado:cresta");
    expect(vestuarioDe(p, 0)).toEqual({ ...VESTUARIO_INICIAL[0], mascara: "diablito" });
    expect(vestuarioDe(p, 1)).toEqual({ ...VESTUARIO_INICIAL[1], peinado: "cresta" });
  });

  it("lo que llega de Convex se completa, y el texto va y vuelve", () => {
    expect(completar(null, VESTUARIO_INICIAL[1])).toEqual(VESTUARIO_INICIAL[1]);
    expect(completar({ sombrero: "boina" }, VESTUARIO_INICIAL[1]).sombrero).toBe("boina");
    const v = { panuelo: "lazo", sombrero: "bombin", peinado: "chongo", mascara: "jade" } as const;
    expect(leerVestuario(aTexto(v), VESTUARIO_INICIAL[0])).toEqual(v);
  });
});
