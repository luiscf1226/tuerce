// Los volúmenes: se guardan en el almacén, se recortan a 0–1, avisan y sobreviven a un almacén roto.
import { describe, expect, it } from "vitest";
import { type Almacen, crearMezcla, LLAVE_VOLUMENES, leerVolumenes, VOLUMENES_INICIALES } from "./mezcla";

const memoria = (inicial: Record<string, string> = {}): Almacen & { datos: Record<string, string> } => {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (llave) => datos[llave] ?? null,
    setItem: (llave, valor) => {
      datos[llave] = valor;
    },
  };
};

describe("mezcla de volúmenes", () => {
  it("sin nada guardado arranca con los iniciales", () => {
    expect(crearMezcla(memoria()).volumenes()).toEqual(VOLUMENES_INICIALES);
    expect(crearMezcla(undefined).volumenes()).toEqual(VOLUMENES_INICIALES);
  });

  it("guarda lo que se fija y otra mezcla con el mismo almacén lo lee", () => {
    const almacen = memoria();
    const mezcla = crearMezcla(almacen);
    mezcla.fijarVolumen("musica", 0.25);
    mezcla.fijarVolumen("efectos", 0.5);
    expect(JSON.parse(almacen.datos[LLAVE_VOLUMENES] ?? "{}")).toMatchObject({ musica: 0.25, efectos: 0.5 });
    expect(crearMezcla(almacen).volumenes()).toEqual({ ...VOLUMENES_INICIALES, musica: 0.25, efectos: 0.5 });
  });

  it("recorta a 0–1 y lo que no es número queda en 0", () => {
    const mezcla = crearMezcla(memoria());
    mezcla.fijarVolumen("general", 3);
    expect(mezcla.volumenes().general).toBe(1);
    mezcla.fijarVolumen("general", -1);
    expect(mezcla.volumenes().general).toBe(0);
    mezcla.fijarVolumen("efectos", Number.NaN);
    expect(mezcla.volumenes().efectos).toBe(0);
  });

  it("avisa a quien escucha y deja de avisar al soltarlo", () => {
    const mezcla = crearMezcla(memoria());
    const vistos: number[] = [];
    const dejar = mezcla.alCambiarVolumen((v) => vistos.push(v.musica));
    mezcla.fijarVolumen("musica", 0.3);
    mezcla.fijarVolumen("musica", 0.3); // igual: no avisa
    dejar();
    mezcla.fijarVolumen("musica", 0.9);
    expect(vistos).toEqual([0.3]);
  });

  it("lo guardado roto o fuera de rango no rompe nada", () => {
    expect(leerVolumenes(memoria({ [LLAVE_VOLUMENES]: "{no es json" }))).toEqual(VOLUMENES_INICIALES);
    expect(leerVolumenes(memoria({ [LLAVE_VOLUMENES]: '{"general":7,"musica":"alto"}' }))).toEqual({
      ...VOLUMENES_INICIALES,
      general: 1,
    });
  });

  it("un almacén que tira error (ventana privada) no rompe: vale para esta partida", () => {
    const roto: Almacen = {
      getItem() {
        throw new Error("bloqueado");
      },
      setItem() {
        throw new Error("bloqueado");
      },
    };
    const mezcla = crearMezcla(roto);
    expect(mezcla.volumenes()).toEqual(VOLUMENES_INICIALES);
    mezcla.fijarVolumen("efectos", 0.2);
    expect(mezcla.volumenes().efectos).toBe(0.2);
  });
});
