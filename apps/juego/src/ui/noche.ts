// El cartel de la Noche de tuerce (TU-33): al empezar, qué trampa les tocó. Una tarjeta clara en el tercio de
// abajo que se va sola: no tapa a los muñecos (al centro), ni la ayuda de los controles, ni el reloj de arriba.
import type { Trampa } from "../niveles/noche";
import { FUENTES } from "./menu";
import "./noche.css";

/** Cuánto se ve el cartel (ms). */
const DURA = 6500;

export function mostrarCartel(trampa: Trampa): () => void {
  if (!document.querySelector("link[data-fuentes]")) {
    const fuentes = document.head.appendChild(document.createElement("link"));
    fuentes.rel = "stylesheet";
    fuentes.href = FUENTES;
    fuentes.dataset.fuentes = "";
  }
  document.querySelector(".noche-cartel")?.remove();
  const cartel = document.body.appendChild(document.createElement("section"));
  cartel.className = "noche-cartel";
  cartel.dataset.trampa = trampa.nombre;
  cartel.setAttribute("role", "status");
  cartel.setAttribute("aria-live", "polite");
  const ceja = cartel.appendChild(document.createElement("p"));
  ceja.className = "noche-ceja";
  ceja.textContent = "Noche de tuerce · trampa sorpresa";
  cartel.appendChild(document.createElement("h2")).textContent = trampa.titulo;
  cartel.appendChild(document.createElement("p")).textContent = trampa.cartel;
  const quitar = () => cartel.remove();
  setTimeout(() => cartel.classList.add("se-va"), DURA - 600);
  setTimeout(quitar, DURA);
  return quitar;
}
