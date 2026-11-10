// El muñeco de trapo: físicas (`crearMuneco`) y dibujo (`crearMallaMuneco`) por separado.
export { AJUSTES, INERCIA_EXTRA, MASAS, MEDIDAS } from "./ajustes";
export { crearMallaMuneco, crearMaterialesMuneco, type MallaMuneco, type MaterialesMuneco } from "./malla";
export {
  crearMuneco,
  type EntradaMuneco,
  type EstadoMuneco,
  type Muneco,
  NOMBRES_PARTES,
  type NombreParte,
  type OpcionesMuneco,
  QUIETO,
} from "./muneco";
