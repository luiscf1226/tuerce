// `?mudo` y `?congelar=` apagan el sonido; `?mudo` sigue valiendo en la pestaña al navegar.
import { describe, expect, it } from "vitest";
import { LLAVE_MUDO, pideMudo, type Sesion } from "./salida";

const sesion = (): Sesion & { datos: Map<string, string> } => {
  const datos = new Map<string, string>();
  return { datos, getItem: (k) => datos.get(k) ?? null, setItem: (k, v) => void datos.set(k, v) };
};

describe("mudo", () => {
  it("con `?mudo` o `?congelar=` es muda; sin nada, no", () => {
    expect(pideMudo(new URLSearchParams("escena=dos&mudo"))).toBe(true);
    expect(pideMudo(new URLSearchParams("escena=dos&congelar=60"))).toBe(true);
    expect(pideMudo(new URLSearchParams("escena=dos"))).toBe(false);
  });

  it("la pestaña que entró muda sigue muda en la dirección siguiente (el menú la lleva a un nivel)", () => {
    const s = sesion();
    expect(pideMudo(new URLSearchParams("escena=dos&mudo"), s)).toBe(true);
    expect(s.datos.get(LLAVE_MUDO)).toBe("1");
    expect(pideMudo(new URLSearchParams("escena=nivel&nivel=patio"), s)).toBe(true);
    expect(pideMudo(new URLSearchParams("escena=nivel&nivel=patio"), sesion())).toBe(false);
  });

  it("congelar no marca la pestaña: las capturas no la dejan muda para siempre", () => {
    const s = sesion();
    pideMudo(new URLSearchParams("congelar=10"), s);
    expect(pideMudo(new URLSearchParams(""), s)).toBe(false);
  });

  it("una sesión que tira error no rompe nada", () => {
    const rota: Sesion = {
      getItem() {
        throw new Error("bloqueado");
      },
      setItem() {
        throw new Error("bloqueado");
      },
    };
    expect(pideMudo(new URLSearchParams("mudo"), rota)).toBe(true);
    expect(pideMudo(new URLSearchParams(""), rota)).toBe(false);
  });
});
