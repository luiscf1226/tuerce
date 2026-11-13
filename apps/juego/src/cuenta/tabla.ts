// Pantalla de tablas del contrarreloj (TU-32): `?escena=tabla` (todos los niveles) o `&nivel=prueba` (uno). Con la
// cuenta, una tarjeta por nivel con las mejores parejas, dónde queda la propia (la pareja más reciente, como en
// línea) y, si ya ganaron el nivel, el botón para correrlo en línea. La tabla se actualiza sola (Convex).
//
// `&ejemplo` muestra parejas de mentira sin entrar ni hablar con Convex: es para las capturas (scripts/capturas.mjs).
import type { ConvexClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { numeroDeCarpeta } from "../niveles/contrarreloj";
import { type DatosDeNivel, NIVELES } from "../niveles/lista";
import { crearTarjeta, type DatosTabla, enlaceBoton } from "../ui/contrarreloj";
import { abrirSesion, crearPanel } from "./sesion";

/** Los niveles que se muestran: el de `&nivel=` o todos, con su número (de la carpeta) y un título. */
function nivelesPedidos(parametros: URLSearchParams): { clave: string; numero: number; titulo: string }[] {
  const pedido = parametros.get("nivel");
  return Object.entries(NIVELES)
    .filter(([clave]) => !pedido || clave === pedido)
    .map(([clave, datos]: [string, DatosDeNivel]) => {
      const numero = numeroDeCarpeta(datos.carpeta);
      return { clave, numero, titulo: `Nivel ${numero} · ${clave.charAt(0).toUpperCase()}${clave.slice(1)}` };
    });
}

/** Parejas de mentira para las capturas: diez, con un empate, y la propia más abajo. */
export const TABLA_DE_EJEMPLO: DatosTabla = {
  filas: [
    ["Vale", "Tomás", 2538],
    ["Rocío", "Iván", 2611],
    ["Lupe", "Nacho", 2611],
    ["Pilar", "Germán", 2790],
    ["Ana", "Beto", 2855],
    ["Majo", "Santi", 3002],
    ["Cami", "Joaco", 3120],
    ["Flor", "Dante", 3347],
    ["Sol", "Emi", 3510],
    ["Luz", "Pancho", 3698],
  ].map(([a, b, tiempo], i, todas) => ({
    puesto: i > 0 && todas[i - 1]?.[2] === tiempo ? i : i + 1,
    nombres: [String(a), String(b)] as const,
    tiempo: Number(tiempo),
    propia: false,
  })),
  propia: { puesto: 14, nombres: ["Zoe", "Yago"], tiempo: 4102, propia: true },
};

export async function abrirTabla(): Promise<void> {
  const parametros = new URLSearchParams(location.search);
  const panel = crearPanel("tabla");
  panel.panel.classList.add("tablas");
  const niveles = nivelesPedidos(parametros);
  if (parametros.has("ejemplo")) {
    panel.mensaje.textContent = "Contrarreloj · tabla de ejemplo, con parejas de mentira";
    for (const nivel of niveles) {
      const tarjeta = crearTarjeta(panel.panel, nivel.titulo);
      tarjeta.tabla(TABLA_DE_EJEMPLO);
      tarjeta.pie(enlaceBoton("Correr en línea", "#", true));
    }
    panel.estado.listo = true;
    return;
  }
  await abrirSesion(panel, (convex) => {
    const desmontar = montarTablas(convex, panel.panel, niveles, panel.mensaje);
    return () => {
      void desmontar.then((d) => d());
    };
  });
}

/** Ya con sesión: una tarjeta por nivel. Devuelve cómo desmontarlas. */
async function montarTablas(
  convex: ConvexClient,
  padre: HTMLElement,
  niveles: ReturnType<typeof nivelesPedidos>,
  mensaje: HTMLElement,
): Promise<() => void> {
  mensaje.textContent = "Contrarreloj · las parejas más rápidas de cada nivel";
  const pareja = (await convex.query(api.parejas.misParejas, {}))[0];
  const ganados = pareja ? await convex.query(api.contrarreloj.nivelesGanados, { parejaId: pareja.parejaId }) : [];
  const tarjetas: HTMLElement[] = [];
  const dejar: (() => void)[] = [];
  for (const nivel of niveles) {
    const tarjeta = crearTarjeta(padre, nivel.titulo);
    tarjetas.push(padre.lastElementChild as HTMLElement);
    const args = pareja ? { nivel: nivel.numero, parejaId: pareja.parejaId } : { nivel: nivel.numero };
    dejar.push(convex.onUpdate(api.contrarreloj.tabla, args, (datos) => tarjeta.tabla(datos)));
    if (!pareja) {
      tarjeta.pie(enlaceBoton("Invitar a alguien", "?escena=invitar"), "para correr en pareja");
    } else if (ganados.some((g) => g.nivel === nivel.numero)) {
      tarjeta.pie(
        enlaceBoton(
          `Correr con ${pareja.companero}`,
          `?escena=en-linea&nivel=${encodeURIComponent(nivel.clave)}&contrarreloj`,
          true,
        ),
      );
    } else {
      tarjeta.pie(
        enlaceBoton("Jugarlo", `?escena=en-linea&nivel=${encodeURIComponent(nivel.clave)}`),
        `Con ${pareja.companero} todavía no lo ganaron: el contrarreloj se abre al llegar a la meta.`,
      );
    }
  }
  return () => {
    for (const d of dejar) d();
    for (const t of tarjetas) t.remove();
  };
}
