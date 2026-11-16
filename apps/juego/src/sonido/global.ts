// La mezcla y la salida del juego: una sola de cada una para toda la página (TU-59). Ver index.ts.
import { almacenDelNavegador, crearMezcla, type Mezcla } from "./mezcla";
import { crearSalida, pideMudo, type Salida, type Sesion } from "./salida";

let mezcla: Mezcla | undefined;
let salida: Salida | undefined;

/** La mezcla de volúmenes del juego (guardada en este navegador). */
export function mezclaDelJuego(): Mezcla {
  mezcla ??= crearMezcla(almacenDelNavegador());
  return mezcla;
}

/** La salida de sonido del juego: muda con `?mudo` (toda la pestaña) o `?congelar=`, y fuera del navegador (las
 * pruebas de Node). */
export function salidaDelJuego(): Salida {
  salida ??= crearSalida(
    mezclaDelJuego(),
    typeof location === "undefined" || pideMudo(new URLSearchParams(location.search), sesionDelNavegador()),
  );
  return salida;
}

function sesionDelNavegador(): Sesion | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}
