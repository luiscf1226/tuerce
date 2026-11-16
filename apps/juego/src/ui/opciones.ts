// Las Opciones (TU-60), desde el menú de inicio y desde la pausa: el volumen general, el de los efectos y el de la
// música (los guarda el sonido, src/sonido), la pantalla completa y «menos movimiento» (src/ajustes.ts). Lo que se
// guarda queda en este navegador.
//
// Los deslizadores se mueven con ←/→ (o A/D) y con la cruceta o la palanca del mando; el menú (menu.ts) los
// atiende con `moverDeslizador`, porque el teclado del juego no deja que las flechas lleguen a la página.
import { ajustesDelJuego } from "../ajustes";
import { CANALES, type Canal, fijarVolumen, volumenes } from "../sonido";
import { alternarPantallaCompleta, enEscritorio, enPantallaCompleta, hayPantallaCompleta } from "./escritorio";

const NOMBRES: Record<Canal, string> = { general: "General", efectos: "Efectos", musica: "Música" };
/** Cuánto sube o baja un volumen con cada toque de ←/→ (de 0 a 100). */
const PASO = 5;

function elemento<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase: string, texto?: string) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/** Pinta lo lleno del deslizador (hilo firme hasta el valor; lo que falta, costura) y el número de al lado. */
function mostrarValor(deslizador: HTMLInputElement): void {
  deslizador.style.setProperty("--lleno", `${deslizador.value}%`);
  const numero = deslizador.parentElement?.querySelector(".valor");
  if (numero) numero.textContent = deslizador.value;
}

/** Un volumen: su nombre, el deslizador (0 a 100) y el número. */
function filaDeVolumen(canal: Canal): HTMLElement {
  const fila = elemento("label", "menu-volumen");
  fila.append(elemento("span", "nombre", NOMBRES[canal]));
  const deslizador = fila.appendChild(elemento("input", "deslizador"));
  deslizador.type = "range";
  deslizador.min = "0";
  deslizador.max = "100";
  deslizador.step = String(PASO);
  deslizador.value = String(Math.round(volumenes()[canal] * 100));
  deslizador.dataset.canal = canal;
  deslizador.setAttribute("aria-label", `Volumen ${NOMBRES[canal].toLowerCase()}`);
  deslizador.addEventListener("input", () => {
    fijarVolumen(canal, Number(deslizador.value) / 100);
    mostrarValor(deslizador);
  });
  fila.append(elemento("span", "valor"));
  mostrarValor(deslizador);
  return fila;
}

/** Un ajuste de sí o no: su nombre (y una nota chica) y un botón que dice cómo está. */
function filaDeAjuste(
  nombre: string,
  nota: string,
  cual: string,
  encendido: boolean | undefined,
  alApretar: () => void,
): HTMLElement {
  const fila = elemento("div", "menu-linea menu-ajuste");
  const texto = fila.appendChild(elemento("span", "menu-nota"));
  texto.append(nombre, elemento("span", "detalle", nota));
  const b = fila.appendChild(
    elemento(
      "button",
      `boton boton-claro interruptor${encendido ? " boton-fuerte" : ""}`,
      encendido === undefined ? "Cambiar" : encendido ? "Sí" : "No",
    ),
  );
  b.type = "button";
  b.dataset.ajuste = cual;
  if (encendido !== undefined) b.setAttribute("aria-pressed", String(encendido));
  b.setAttribute("aria-label", nombre);
  b.addEventListener("click", alApretar);
  return fila;
}

/** Lo que va en el panel de Opciones, entre la ceja y «Volver». `repintar` vuelve a pintar el panel con el foco en
 * ese elemento (al cambiar un ajuste de sí o no). */
export function filasDeOpciones(repintar: (enfocar: string) => void): HTMLElement[] {
  const filas: HTMLElement[] = [elemento("p", "menu-subtitulo", "Volumen")];
  const volumen = elemento("div", "menu-volumenes");
  volumen.append(...CANALES.map(filaDeVolumen));
  filas.push(volumen, elemento("hr", "costura"));
  if (hayPantallaCompleta()) {
    filas.push(
      filaDeAjuste(
        "Pantalla completa",
        enEscritorio ? "También con F11" : "Esc la deja",
        "pantalla",
        enPantallaCompleta(),
        () => {
          alternarPantallaCompleta();
          // En el navegador, el menú repinta cuando la página cambia de verdad (`fullscreenchange`)
        },
      ),
    );
  }
  const ajustes = ajustesDelJuego();
  const menos = ajustes.ajustes().menosMovimiento;
  filas.push(
    filaDeAjuste("Menos movimiento", "Sin sacudidas ni fundidos largos", "menos-movimiento", menos, () => {
      ajustes.fijar("menosMovimiento", !menos);
      repintar('[data-ajuste="menos-movimiento"]');
    }),
  );
  return filas;
}

/** Si el foco está en un deslizador de volumen, lo mueve un paso (`direccion` -1 o 1) y dice que lo atendió. */
export function moverDeslizador(direccion: number): boolean {
  const deslizador = document.activeElement;
  if (!(deslizador instanceof HTMLInputElement) || deslizador.type !== "range") return false;
  if (direccion < 0) deslizador.stepDown();
  else deslizador.stepUp();
  deslizador.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/** Pone la clase `menos-movimiento` en la página mientras esté encendido (los avisos animados la miran en su CSS).
 * Se llama una vez al arrancar, en cualquier escena. */
export function prepararMenosMovimiento(): void {
  const ajustes = ajustesDelJuego();
  const poner = () => document.documentElement.classList.toggle("menos-movimiento", ajustes.ajustes().menosMovimiento);
  ajustes.alCambiar(poner);
  poner();
}
