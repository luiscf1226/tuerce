// La cámara de los dos (TU-09): encuadra a los dos jugadores y parte la pantalla si se separan.
export { type CamaraDeDos, crearCamaraDeDos, type OpcionesCamaraDeDos, type Punto } from "./camara";
export {
  decidirPartida,
  distanciaDeEncuadre,
  ENCUADRE,
  type Encuadre,
  encuadrar,
  normalDeCorte,
  type OpcionesEncuadre,
  type Rectangulo,
  recorteDelLado,
} from "./encuadre";
