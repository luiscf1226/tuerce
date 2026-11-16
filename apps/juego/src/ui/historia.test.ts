import { describe, expect, it } from "vitest";
import { NIVEL_INICIAL } from "../niveles/lista";
import { HISTORIA, PRIMER_NIVEL } from "../niveles/orden";
import {
  borrarPuntoAqui,
  direccionDelNivel,
  direccionDesdeLaSalida,
  direccionParaSeguir,
  dondeSigue,
  guardarPuntoAqui,
  LLAVE_RETOMAR,
  nivelesDeLaHistoria,
  nivelesDelContrarreloj,
  numeroConCeros,
  puntosGuardadosAqui,
} from "./historia";

/** Un localStorage de mentira. */
function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (llave: string) => datos.get(llave) ?? null,
    setItem: (llave: string, valor: string) => void datos.set(llave, valor),
  };
}

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

describe("empezar el nivel de nuevo", () => {
  it("la misma dirección, desde la salida", () => {
    expect(direccionDesdeLaSalida("?escena=nivel&nivel=poza&punto=2")).toBe("?escena=nivel&nivel=poza");
    expect(direccionDesdeLaSalida("?escena=nivel&nivel=pinar&noche=4&pausa&ganar=30")).toBe(
      "?escena=nivel&nivel=pinar&noche=4",
    );
    expect(direccionDesdeLaSalida("?escena=nivel&nivel=mina&contrarreloj=")).toBe(
      "?escena=nivel&nivel=mina&contrarreloj=",
    );
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

describe("retomar aquí", () => {
  it("guarda el último punto de control alcanzado en cada nivel, no la salida", () => {
    const a = almacen();
    guardarPuntoAqui("patio", 0, a);
    expect(puntosGuardadosAqui(a)).toEqual({});
    guardarPuntoAqui("patio", 1, a);
    guardarPuntoAqui("patio", 2, a);
    guardarPuntoAqui("pinar", 1, a);
    expect(puntosGuardadosAqui(a)).toEqual({ patio: 2, pinar: 1 });
    // Si vuelven a empezarlo y llegan al 1, el último alcanzado es el 1
    guardarPuntoAqui("patio", 1, a);
    expect(puntosGuardadosAqui(a).patio).toBe(1);
  });

  it("«Seguir la historia» retoma el nivel donde sigue en su punto guardado", () => {
    const a = almacen();
    guardarPuntoAqui("poza", 2, a);
    guardarPuntoAqui("mina", 3, a);
    const sigue = dondeSigue(["patio", "pinar"], puntosGuardadosAqui(a));
    expect(sigue.nivel.clave).toBe("poza");
    expect(sigue.punto).toBe(2);
    expect(direccionParaSeguir(sigue)).toBe("?escena=nivel&nivel=poza&punto=2");
    // Sin punto guardado en el que sigue, desde la salida
    const sinPunto = dondeSigue(["patio"], puntosGuardadosAqui(a));
    expect(sinPunto.punto).toBeUndefined();
    expect(direccionParaSeguir(sinPunto)).toBe("?escena=nivel&nivel=pinar");
  });

  it("un punto en el patio ya cuenta como historia empezada", () => {
    const sigue = dondeSigue([], { patio: 1 });
    expect(sigue.empezada).toBe(true);
    expect(sigue.punto).toBe(1);
    expect(dondeSigue([], { pinar: 1 }).empezada).toBe(false);
  });

  it("al ganar el nivel se borra su punto y la historia sigue en el próximo desde la salida", () => {
    const a = almacen();
    guardarPuntoAqui("poza", 2, a);
    guardarPuntoAqui("mina", 1, a);
    borrarPuntoAqui("poza", a);
    expect(puntosGuardadosAqui(a)).toEqual({ mina: 1 });
    borrarPuntoAqui("poza", a); // ya no estaba: nada
    const sigue = dondeSigue(["patio", "pinar", "poza"], puntosGuardadosAqui(a));
    expect(sigue.nivel.clave).toBe("calle");
    expect(sigue.punto).toBeUndefined();
  });

  it("con todo ganado no se retoma nada", () => {
    const sigue = dondeSigue(
      HISTORIA.map((n) => n.clave),
      { patio: 2 },
    );
    expect(sigue.terminada).toBe(true);
    expect(sigue.punto).toBeUndefined();
  });

  it("lo roto o raro se ignora, y sin almacén no pasa nada", () => {
    expect(puntosGuardadosAqui(almacen({ [LLAVE_RETOMAR]: "{roto" }))).toEqual({});
    expect(
      puntosGuardadosAqui(almacen({ [LLAVE_RETOMAR]: JSON.stringify({ patio: "2", pinar: -1, poza: 1.5, mina: 2 }) })),
    ).toEqual({ mina: 2 });
    expect(puntosGuardadosAqui(undefined)).toEqual({});
    guardarPuntoAqui("patio", 1, undefined);
    borrarPuntoAqui("patio", undefined);
  });
});
