// La red entre los dos jugadores: conexión directa (WebRTC) con la sala de repetidor de respaldo. Ver conexion.ts.
export { type Conexion, conectar, type EstadoRed, type OpcionesConexion, type Via } from "./conexion";
export { type Datos, MAX_DATOS, type Rol } from "./marco";
