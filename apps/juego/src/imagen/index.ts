// La imagen de Tuerce: lo que hace que cada nivel se vea como docs/arte/11-pinar a 14-personajes.
//
//   crearImagen(pintor, escena, camara)  tono, antialias, grano y viñeta; main.ts dibuja siempre por acá
//   vestirDeDia(escena)                  fondo y niebla blancos, luz de día nublado
//   crearCapasDeNiebla([...])            jirones de niebla a distintas profundidades que se corren
//   crearVelo({...})                     niebla que se espesa hacia arriba, detrás de lo cercano
//   materialTela(color?) / materialPanuelo("rojo" | "turquesa") / materialOjo()   para vestir mallas
//   crearPino, crearAbeto, crearTroncoCaido, crearRoca, crearMata               formas de las referencias
export {
  type CapaDeNiebla,
  crearCapasDeNiebla,
  crearVelo,
  type Niebla,
  type OpcionesDia,
  vestirDeDia,
} from "./ambiente";
export {
  crearAbeto,
  crearMata,
  crearPino,
  crearRoca,
  crearTroncoCaido,
  juntar,
  type OpcionesPino,
  type OpcionesTronco,
} from "./formas";
export {
  aTextura,
  materialCorteza,
  materialOjo,
  materialPanuelo,
  materialRecorte,
  materialTela,
  type OpcionesTela,
} from "./materiales";
export { COLOR_PANUELO, coloresSaturados, esSaturado, type Panuelo, saturacion } from "./paleta";
export { crearImagen, type Imagen, type OpcionesImagen, type VistasPartidas } from "./post";
