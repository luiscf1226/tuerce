// La misión de un nivel de la historia: llegar a la meta (por los puntos de control) y, si quieren, el secreto y el
// logro, con los textos de convex/premios.ts. La hoja de la misión (src/ui/mision.ts) la muestra en la escena `nivel`.
import { PREMIOS } from "../../../../convex/premios";
import type { AvanceDeNivel, PremiosDeNivel } from "../escenas/tipos";
import type { Objetivo } from "./tablero";

export function objetivosDelNivel(
  avance: Pick<AvanceDeNivel, "meta" | "puntoDeControl">,
  premios: Pick<PremiosDeNivel, "nivel" | "tiene">,
): Objetivo[] {
  const objetivos: Objetivo[] = [
    {
      id: "meta",
      titulo: "Lleguen a la meta",
      texto: "Crucen juntos los puntos de control. Si uno cae, reaparece al lado del otro.",
      medir: () => {
        const punto = Math.min(avance.puntoDeControl(), avance.meta);
        return { hecho: punto >= avance.meta, cuenta: punto, total: avance.meta };
      },
    },
  ];
  const datos = PREMIOS[premios.nivel];
  if (!datos) return objetivos;
  objetivos.push(
    {
      id: "secreto",
      titulo: "Encuentren el secreto",
      texto: "Algo quedó escondido fuera del camino. Da una prenda para el ropero.",
      opcional: true,
      medir: () => ({ hecho: premios.tiene("secreto") }),
    },
    {
      id: "logro",
      titulo: `Logro: ${datos.logro.nombre}`,
      // «cargar la escalera…» → «Cargar la escalera…»
      texto: datos.logro.texto.charAt(0).toUpperCase() + datos.logro.texto.slice(1),
      opcional: true,
      medir: () => ({ hecho: premios.tiene("logro") }),
    },
  );
  return objetivos;
}
