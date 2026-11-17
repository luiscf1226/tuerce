// Si la pareja ya hizo el tutorial en este navegador (`?escena=tutorial`): mientras no lo hicieron y no ganaron
// ningún nivel, el menú propone «Cómo jugar» primero.
export const CLAVE_TUTORIAL = "tuerce.tutorial";
export const DIRECCION_TUTORIAL = "?escena=tutorial";

export function tutorialHecho(): boolean {
  try {
    return localStorage.getItem(CLAVE_TUTORIAL) === "1";
  } catch {
    return false;
  }
}

export function anotarTutorial(): void {
  try {
    localStorage.setItem(CLAVE_TUTORIAL, "1");
  } catch {
    // Sin almacenamiento (ventana privada): el menú seguirá proponiendo el tutorial, nada más
  }
}

/** Si el menú propone el tutorial antes que la historia. */
export function proponerTutorial(hecho: boolean, ganados: readonly string[]): boolean {
  return !hecho && ganados.length === 0;
}

/** Lo básico, en cuatro líneas, para la pantalla de controles del menú. */
export const COMO_SE_JUEGA: readonly (readonly [string, string])[] = [
  ["Moverse", "Cada uno camina y gira con lo suyo; la cámara sigue a los dos y se parte si se alejan."],
  ["Agarrar", "Un brazo arriba agarra lo que toca mientras sostengan la tecla: cajas, bordes, la mano del otro."],
  ["De a dos", "Lo pesado se carga entre los dos. Para trepar, cuélguense con los dos brazos y salten."],
  [
    "La misión",
    "Arriba a la izquierda dice qué hacer ahora. H abre la ayuda con todos los pasos y los controles; la pausa también la muestra. Lo que lleva una banda clara es de la misión.",
  ],
];
