import { describe, expect, it } from "vitest";
import { REGIONES, regionDeZona } from "./region";

describe("región por zona horaria", () => {
  it.each([
    ["America/Tegucigalpa", "centroamerica"],
    ["America/Guatemala", "centroamerica"],
    ["America/Costa_Rica", "centroamerica"],
    ["America/Panama", "centroamerica"],
    ["America/Mexico_City", "mexico"],
    ["America/Tijuana", "mexico"],
    ["America/Havana", "caribe"],
    ["America/Santo_Domingo", "caribe"],
    ["America/Puerto_Rico", "caribe"],
    ["America/Bogota", "andes"],
    ["America/Lima", "andes"],
    ["America/La_Paz", "andes"],
    ["Pacific/Galapagos", "andes"],
    ["America/Sao_Paulo", "brasil"],
    ["America/Manaus", "brasil"],
    ["America/Santiago", "cono-sur"],
    ["America/Argentina/Buenos_Aires", "cono-sur"],
    ["America/Argentina/Cordoba", "cono-sur"],
    ["America/Montevideo", "cono-sur"],
    ["America/Asuncion", "cono-sur"],
    ["America/New_York", "norteamerica"],
    ["America/Los_Angeles", "norteamerica"],
    ["America/Indiana/Indianapolis", "norteamerica"],
    ["America/Toronto", "norteamerica"],
    ["Pacific/Honolulu", "norteamerica"],
    ["Europe/Madrid", "otra"],
    ["Etc/UTC", "otra"],
    ["", "otra"],
    [undefined, "otra"],
  ] as const)("%s → %s", (zona, region) => {
    expect(regionDeZona(zona)).toBe(region);
  });

  it("solo devuelve regiones que Convex conoce", () => {
    for (const zona of Intl.supportedValuesOf("timeZone")) expect(REGIONES).toContain(regionDeZona(zona));
  });

  it("ninguna zona de Latinoamérica cae en Norteamérica", () => {
    const latinas = Intl.supportedValuesOf("timeZone").filter((z) =>
      /Tegucigalpa|Managua|Havana|Bogota|Caracas|Lima|Santiago|Sao_Paulo|Mexico|Montevideo|Asuncion|Guayaquil/.test(z),
    );
    expect(latinas.length).toBeGreaterThan(10);
    for (const zona of latinas) expect(regionDeZona(zona)).not.toBe("norteamerica");
  });
});
