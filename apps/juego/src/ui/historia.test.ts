import { describe, expect, it } from "vitest";
import { NIVEL_INICIAL } from "../niveles/lista";
import { HISTORIA, PRIMER_NIVEL } from "../niveles/orden";
import { direccionDelNivel, dondeSigue, nivelesDeLaHistoria, nivelesDelContrarreloj, numeroConCeros } from "./historia";

describe("dónde sigue la historia", () => {
  it("sin nada ganado empieza en el patio", () => {
    const sigue = dondeSigue([]);
    expect(sigue.nivel.clave).toBe("patio");
    expect(sigue.empezada).toBe(false);
    expect(sigue.terminada).toBe(false);
  });

  it("sigue en el primero de la historia que no ganaron, aunque hayan ganado otros más adelante", () => {
    expect(dondeSigue(["patio", "pinar"]).nivel.clave).toBe("poza");
    expect(dondeSigue(["patio", "poza", "mina"]).nivel.clave).toBe("pinar");
    expect(dondeSigue(["patio"]).empezada).toBe(true);
  });

  it("los niveles que no son de la historia no cuentan", () => {
    const sigue = dondeSigue(["prueba", "piezas"]);
    expect(sigue.nivel.clave).toBe("patio");
    expect(sigue.empezada).toBe(false);
  });

  it("con los 17 ganados vuelve a empezar por el patio", () => {
    const sigue = dondeSigue(HISTORIA.map((n) => n.clave));
    expect(sigue.nivel.clave).toBe(PRIMER_NIVEL);
    expect(sigue.terminada).toBe(true);
  });

  it("el nivel de siempre (sin `&nivel=`) es el primero de la historia", () => {
    expect(NIVEL_INICIAL).toBe(PRIMER_NIVEL);
  });
});

describe("direcciones de los niveles", () => {
  it("aquí, en línea, contra el reloj y de noche", () => {
    expect(direccionDelNivel("patio", "aqui")).toBe("?escena=nivel&nivel=patio");
    expect(direccionDelNivel("rio", "en-linea")).toBe("?escena=en-linea&nivel=rio");
    expect(direccionDelNivel("pinar", "contrarreloj")).toBe("?escena=nivel&nivel=pinar&contrarreloj");
    expect(direccionDelNivel("poza", "noche-aqui")).toBe("?escena=nivel&nivel=poza&noche");
    expect(direccionDelNivel("poza", "noche-en-linea")).toBe("?escena=en-linea&nivel=poza&noche");
  });
});

describe("el panel de niveles", () => {
  it("muestra los 17 en orden, con número, título y lugar, y marca los ganados", () => {
    const niveles = nivelesDeLaHistoria(["pinar", "prueba"]);
    expect(niveles).toHaveLength(17);
    expect(niveles.map((n) => n.numero)).toEqual([...Array(17).keys()]);
    expect(niveles[1]).toMatchObject({
      clave: "pinar",
      titulo: "El pinar",
      lugar: "La Esperanza, Honduras",
      ganado: true,
    });
    expect(niveles.filter((n) => n.ganado).map((n) => n.clave)).toEqual(["pinar"]);
    expect(numeroConCeros(niveles[16]?.numero ?? -1)).toBe("16");
    expect(numeroConCeros(0)).toBe("00");
  });

  it("el contrarreloj ofrece todos los ganados: los de la historia en orden y después los otros", () => {
    const niveles = nivelesDelContrarreloj(["mina", "prueba", "patio", "mina"]);
    expect(niveles.map((n) => n.clave)).toEqual(["patio", "mina", "prueba"]);
    expect(niveles[2]).toMatchObject({ titulo: "Prueba", lugar: "Fuera de la historia" });
    expect(nivelesDelContrarreloj([])).toEqual([]);
  });
});
