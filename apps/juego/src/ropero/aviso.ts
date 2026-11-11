// El aviso de «encontraron el secreto» y «ganaron el logro» (TU-29): una tarjetita clara arriba al centro que se va
// sola. Dice qué prenda ganaron, para que la busquen en el ropero.
import { NOMBRE_CATEGORIA, nombreDe, PREMIOS, partirCosa } from "../../../../convex/premios";
import type { Premio, PremiosDeNivel } from "../escenas/tipos";
import "./ropero.css";

/** Cuánto se ve el aviso (ms). */
const DURA = 5000;

/** Los textos del aviso de ese premio en ese nivel. */
export function textosDelAviso(nivel: number, premio: Premio): { titulo: string; detalle: string } | undefined {
  const premios = PREMIOS[nivel];
  if (!premios) return undefined;
  if (premio === "logro") return { titulo: `Logro: ${premios.logro.nombre}`, detalle: premios.logro.texto };
  const prenda = partirCosa(premios.prenda);
  const nombre = prenda
    ? `${NOMBRE_CATEGORIA[prenda.categoria].toLowerCase()} «${nombreDe(prenda.categoria, prenda.prenda)}»`
    : premios.prenda;
  return { titulo: "¡Encontraron el secreto!", detalle: `${premios.secreto} Ganaron: ${nombre}.` };
}

/** Muestra un aviso cada vez que la pareja gana algo en el nivel. Devuelve cómo dejar de avisar. */
export function avisarPremios(premios: PremiosDeNivel): () => void {
  const caja = document.body.appendChild(document.createElement("div"));
  caja.className = "premios";
  caja.setAttribute("role", "status");
  caja.setAttribute("aria-live", "polite");
  const dejar = premios.alGanar((premio) => {
    const textos = textosDelAviso(premios.nivel, premio);
    if (!textos) return;
    const tarjeta = caja.appendChild(document.createElement("section"));
    tarjeta.className = `premio premio-${premio}`;
    tarjeta.appendChild(document.createElement("strong")).textContent = textos.titulo;
    tarjeta.appendChild(document.createElement("p")).textContent = textos.detalle;
    setTimeout(() => tarjeta.remove(), DURA);
  });
  return () => {
    dejar();
    caja.remove();
  };
}
