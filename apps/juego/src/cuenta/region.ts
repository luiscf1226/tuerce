// De qué región es quien juega, adivinado por la zona horaria del navegador (sin pedir ubicación). La persona lo
// puede cambiar en la pantalla de buscar pareja. La lista de regiones vive en convex/regiones.ts.
import { NOMBRE_REGION, REGIONES, type Region } from "../../../../convex/regiones";

export { NOMBRE_REGION, REGIONES, type Region };

/** Zonas horarias de cada región (sin el «America/» del principio cuando lo llevan). */
const ZONAS: Record<Exclude<Region, "norteamerica" | "otra">, readonly string[]> = {
  centroamerica: ["Tegucigalpa", "Guatemala", "El_Salvador", "Managua", "Costa_Rica", "Panama", "Belize"],
  mexico: [
    "Mexico_City",
    "Cancun",
    "Merida",
    "Monterrey",
    "Matamoros",
    "Chihuahua",
    "Ciudad_Juarez",
    "Ojinaga",
    "Mazatlan",
    "Bahia_Banderas",
    "Hermosillo",
    "Tijuana",
    "Ensenada",
    "Santa_Isabel",
  ],
  caribe: [
    "Havana",
    "Santo_Domingo",
    "Puerto_Rico",
    "Port-au-Prince",
    "Jamaica",
    "Barbados",
    "Martinique",
    "Guadeloupe",
    "Port_of_Spain",
    "Curacao",
    "Aruba",
    "Kralendijk",
    "Lower_Princes",
    "Nassau",
    "Cayman",
    "Grand_Turk",
    "Tortola",
    "St_Thomas",
    "Antigua",
    "Anguilla",
    "Dominica",
    "Grenada",
    "Montserrat",
    "St_Barthelemy",
    "St_Kitts",
    "St_Lucia",
    "St_Vincent",
    "Marigot",
    "Guyana",
    "Paramaribo",
    "Cayenne",
  ],
  andes: ["Bogota", "Caracas", "Lima", "Guayaquil", "La_Paz", "Pacific/Galapagos"],
  brasil: [
    "Sao_Paulo",
    "Bahia",
    "Fortaleza",
    "Recife",
    "Maceio",
    "Belem",
    "Araguaina",
    "Santarem",
    "Manaus",
    "Cuiaba",
    "Campo_Grande",
    "Porto_Velho",
    "Boa_Vista",
    "Rio_Branco",
    "Eirunepe",
    "Noronha",
  ],
  "cono-sur": ["Santiago", "Punta_Arenas", "Buenos_Aires", "Montevideo", "Asuncion", "Pacific/Easter"],
};

const REGION_DE_ZONA = new Map<string, Region>(
  Object.entries(ZONAS).flatMap(([region, zonas]) =>
    zonas.map((zona) => [zona.includes("/") ? zona : `America/${zona}`, region as Region] as const),
  ),
);

/** La región de una zona horaria IANA («America/Tegucigalpa» → «centroamerica»). */
export function regionDeZona(zona: string | undefined): Region {
  if (!zona) return "otra";
  const exacta = REGION_DE_ZONA.get(zona);
  if (exacta) return exacta;
  // Argentina tiene una zona por provincia (America/Argentina/Cordoba…).
  if (zona.startsWith("America/Argentina/")) return "cono-sur";
  // El resto de América son Estados Unidos y Canadá (con sus zonas por estado: America/Indiana/…), o Groenlandia.
  if (zona.startsWith("America/") || zona.startsWith("US/") || zona.startsWith("Canada/")) return "norteamerica";
  if (zona === "Pacific/Honolulu") return "norteamerica";
  return "otra";
}

/** La región de este navegador. */
export function regionDetectada(): Region {
  try {
    return regionDeZona(Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return "otra";
  }
}
