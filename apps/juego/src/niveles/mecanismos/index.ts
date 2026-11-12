// Mecanismos de los niveles (TU-13): cosas que el guion arma con los sólidos del .glb, sin cambiar el formato.
//   porton    una hoja con bisagra que una aldaba (palanca) destraba mientras alguien la sostiene
//   escalera  se carga entre dos y, al llegar a una pared, se apoya sola como rampa
//   lamina    un techo donde el que se para se resbala hacia abajo
//   camion    maniobra de atrás para adelante y puede llevar un punto de control encima
export { type Camion, crearCamion } from "./camion";
export { crearEscalera, type Escalera } from "./escalera";
export { crearLamina, type Lamina } from "./lamina";
export { crearPorton, type Porton } from "./porton";
