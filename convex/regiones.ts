// Lo que comparten `cola.ts` y la pantalla de buscar pareja del juego: las regiones y cada cuánto avisar «sigo acá».
// Es solo datos (sin funciones de Convex), así el juego lo importa sin cargar código del servidor.
// `apps/juego/src/cuenta/region.ts` adivina la región por la zona horaria.

/** Cada cuánto el juego avisa que la persona sigue buscando. */
export const LATIDO_MS = 30 * 1000;
/** Sin aviso en este tiempo, la entrada es de alguien que se fue. */
export const VIGENCIA_MS = 2 * 60 * 1000;

export const REGIONES = [
  "centroamerica",
  "mexico",
  "caribe",
  "andes",
  "brasil",
  "cono-sur",
  "norteamerica",
  "otra",
] as const;

export type Region = (typeof REGIONES)[number];

export const NOMBRE_REGION: Record<Region, string> = {
  centroamerica: "Centroamérica",
  mexico: "México",
  caribe: "El Caribe",
  andes: "Los Andes",
  brasil: "Brasil",
  "cono-sur": "El Cono Sur",
  norteamerica: "Norteamérica",
  otra: "Otra parte del mundo",
};

export function esRegion(texto: string): texto is Region {
  return (REGIONES as readonly string[]).includes(texto);
}
