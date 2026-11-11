// El ropero (TU-29): los dos muñecos de pie en la niebla, de cerca, con el panel para elegir qué se ponen.
//
// Sin cuenta es el ropero de esta máquina para jugar de a dos en el mismo lugar: cada uno elige entre lo del
// principio y queda guardado en el navegador (lo usan las escenas `dos` y `nivel`). Con «Entrar» es el de la cuenta:
// lo ganado en los niveles (Convex), los logros, y lo que elija es lo que el otro ve en línea.
//
// Parámetros:
//   &ropa1=sombrero:puntudo,mascara:diablito   viste al rojo con cualquier prenda (y `&ropa2=` al turquesa)
//   &vitrina=1 | 2                             cinco muñecos con todas las prendas (para las capturas)
//   &ejemplo                                   el ropero de una cuenta de ejemplo, sin guardar nada (capturas)
//   &sinpanel                                  solo los muñecos
import type RAPIER from "@dimforge/rapier3d-compat";
import type { ConvexClient } from "convex/browser";
import * as THREE from "three";
import type { api as Api } from "../../../../convex/_generated/api";
import {
  type Categoria,
  esInicial,
  leerVestuario,
  NIVELES_CON_PREMIOS,
  PREMIOS,
  type Prenda,
  type Vestuario,
} from "../../../../convex/premios";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import { materialOjo, materialPanuelo, materialTela, type Panuelo, vestirDeDia } from "../imagen";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type MallaMuneco, QUIETO, SIN_PRENDAS } from "../muneco";
import { crearPanelDelRopero, type DatosDelRopero, type PestanaDelRopero } from "../ropero/panel";
import { completar, guardarVestuarioLocal, type Jugador, vestuarioDe } from "../ropero/vestuario";
import { COLORES } from "./colores";
import type { EscenaDeJuego } from "./index";

/** Las dos vitrinas: entre las dos, todas las prendas. Cada muñeco con lo que tiene puesto y hacia dónde mira (de
 * frente las máscaras, de costado los picos y copetes, de espaldas las capas y los chongos). */
const VITRINAS: Record<string, readonly (readonly [string, number])[]> = {
  "1": [
    ["sombrero:ala-ancha", 0.4],
    ["sombrero:cucurucho,peinado:grenas,mascara:guacamaya,panuelo:lazo", 1.1],
    ["sombrero:bombin,mascara:jade,panuelo:bufanda", 0.25],
    ["sombrero:puntudo,mascara:alebrije,panuelo:capa", 2.5],
    ["sombrero:chullo,mascara:diablito", -0.4],
  ],
  "2": [
    ["peinado:trenzas,mascara:antifaz", 0.35],
    ["sombrero:boina,peinado:colitas,panuelo:vincha", -0.5],
    ["peinado:copete,panuelo:lazo", 1.2],
    ["peinado:chongo,panuelo:capa", 2.6],
    ["peinado:cresta,mascara:diablito,panuelo:bufanda", -1.2],
  ],
};

export function crearEscenaRopero(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): EscenaDeJuego {
  const escena = new THREE.Scene();
  vestirDeDia(escena, { cerca: 4, lejos: 18 });
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORES.niebla).multiplyScalar(0.8), roughness: 1 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0).setFriction(0.8));

  const vitrina = VITRINAS[parametros.get("vitrina") ?? ""];
  const conPanel = typeof document !== "undefined" && !parametros.has("sinpanel") && !vitrina;

  const telas = {
    rojo: materialPanuelo("rojo", { repetir: 2 }),
    turquesa: materialPanuelo("turquesa", { repetir: 2 }),
  };
  const cuerpo = materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 });
  const ojos = materialOjo();
  const poner = (indice: number, x: number, rumbo: number, panuelo: Panuelo, vestuario: Vestuario) => {
    const muneco = crearMuneco(rapier, mundo, { posicion: { x, y: 0, z: 0 }, rumbo, indice });
    const malla = crearMallaMuneco(muneco, { cuerpo, panuelo: telas[panuelo], ojos }, vestuario);
    escena.add(malla.grupo);
    return { muneco, malla };
  };

  const camara = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
  const munecos: ReturnType<typeof poner>[] = [];
  if (vitrina) {
    vitrina.forEach(([texto, rumbo], i) => {
      const x = (i - (vitrina.length - 1) / 2) * 1.2;
      munecos.push(poner(i, x, rumbo, i % 2 ? "turquesa" : "rojo", leerVestuario(texto, SIN_PRENDAS)));
    });
    camara.position.set(0, 1.25, 7.4);
    camara.lookAt(0, 0.8, 0);
  } else {
    // El panel queda a la derecha: los dos se corren a la izquierda de la pantalla
    const corrido = conPanel ? 0.72 : 0;
    munecos.push(poner(0, -0.45, 0.3, "rojo", vestuarioDe(parametros, 0)));
    munecos.push(poner(1, 0.45, -0.3, "turquesa", vestuarioDe(parametros, 1)));
    camara.position.set(corrido, 1.1, 4.6);
    camara.lookAt(corrido, 0.72, 0);
  }

  if (conPanel) {
    const [rojo, turquesa] = munecos;
    if (rojo && turquesa) montarPanel(parametros, [rojo.malla, turquesa.malla]);
  }

  return {
    nombre: "ropero",
    escena,
    camara,
    pasar() {
      for (const { muneco } of munecos) muneco.pasar(QUIETO);
      mundo.step();
      for (const { malla } of munecos) malla.guardar();
    },
    dibujar(alfa) {
      for (const { malla } of munecos) malla.dibujar(alfa);
    },
  };
}

/** Lo que se tiene sin cuenta: lo del principio. */
const delPrincipio = (categoria: Categoria, prenda: Prenda) => esInicial(categoria, prenda);

function montarPanel(parametros: URLSearchParams, mallas: readonly [MallaMuneco, MallaMuneco]): void {
  const panel = crearPanelDelRopero();

  // Sin cuenta: una pestaña por jugador, con lo del principio, guardado en este navegador
  const local = (): DatosDelRopero => ({
    nota: "Para jugar aquí de a dos, con lo del principio. Lo que ganen en los niveles se guarda con su cuenta.",
    pestanas: ([0, 1] as const).map(
      (jugador: Jugador): PestanaDelRopero => ({
        nombre: jugador === 0 ? "Jugador 1" : "Jugador 2",
        color: jugador === 0 ? "rojo" : "turquesa",
        vestuario: mallas[jugador].vestuario,
        tiene: delPrincipio,
        alElegir(vestuario) {
          mallas[jugador].vestir(vestuario);
          guardarVestuarioLocal(jugador, vestuario);
          panel.mostrar(local());
        },
      }),
    ),
  });

  // Con cuenta: el ropero propio, que se ve en el rojo
  const deLaCuenta = (
    nombre: string,
    ganadas: readonly string[],
    logros: readonly string[],
    guardar: (v: Vestuario) => Promise<unknown>,
  ): DatosDelRopero => {
    const tiene = new Set(ganadas);
    return {
      nota: `${nombre}: lo que elijas es lo que tu pareja ve en línea. El pañuelo toma el color de cada partida.`,
      logros,
      pestanas: [
        {
          nombre: "Tu muñeco",
          color: "rojo",
          vestuario: mallas[0].vestuario,
          tiene: (c, p) => esInicial(c, p) || tiene.has(`${c}:${p}`),
          alElegir(vestuario) {
            const antes = mallas[0].vestuario;
            mallas[0].vestir(vestuario);
            panel.mostrar(deLaCuenta(nombre, ganadas, logros, guardar));
            guardar(vestuario).catch((error: unknown) => {
              console.error(error);
              // Vuelve a lo que estaba guardado, y el aviso va en su propio párrafo: el pie tiene la cuenta de Clerk
              mallas[0].vestir(antes);
              panel.mostrar(deLaCuenta(nombre, ganadas, logros, guardar));
              const aviso = panel.pie.querySelector("p.ropero-error") ?? document.createElement("p");
              aviso.className = "ropero-nota ropero-error";
              aviso.textContent = "No se pudo guardar en Convex. Probá de nuevo.";
              panel.pie.prepend(aviso);
            });
          },
        },
      ],
    };
  };

  if (parametros.has("ejemplo")) {
    // Una cuenta de ejemplo que ya pasó los primeros niveles: encontró cinco secretos y ganó tres logros
    const hasta = NIVELES_CON_PREMIOS.filter((n) => n <= 8);
    const ganadas = hasta.filter((n) => n % 2 === 0 || n === 1).flatMap((n) => PREMIOS[n]?.prenda ?? []);
    const logros = hasta.slice(0, 3).flatMap((n) => PREMIOS[n]?.logro.id ?? []);
    mallas[0].vestir(leerVestuario("sombrero:puntudo,mascara:guacamaya,panuelo:lazo", SIN_PRENDAS));
    panel.mostrar(deLaCuenta("Cuenta de ejemplo", ganadas, logros, async () => undefined));
    return;
  }

  panel.mostrar(local());
  const entrar = panel.pie.appendChild(document.createElement("button"));
  entrar.type = "button";
  entrar.className = "ropero-boton";
  entrar.textContent = "Entrar para ver lo que ganaste";
  entrar.addEventListener("click", () => {
    entrar.remove();
    void abrirCuenta(panel.pie, (convex, api) => {
      const vigilar = convex.onUpdate(api.ropero.miRopero, {}, (ropero) => {
        if (!ropero) return;
        const ganadas = ropero.ganadas.map((g) => g.cosa);
        if (ropero.vestuario) mallas[0].vestir(completar(ropero.vestuario, mallas[0].vestuario));
        panel.mostrar(
          deLaCuenta("Tu ropero", ganadas, ropero.logros, (v) => convex.mutation(api.ropero.elegir, { ...v })),
        );
      });
      return () => {
        vigilar();
        panel.mostrar(local());
      };
    });
  });
  const volver = panel.pie.appendChild(document.createElement("a"));
  volver.className = "ropero-volver";
  volver.href = "?escena=dos";
  volver.textContent = "Volver al juego";
}

/** Abre la sesión (Clerk y Convex se cargan aparte, solo si se pide) en el pie del panel. */
async function abrirCuenta(
  pie: HTMLElement,
  alEntrar: (convex: ConvexClient, api: typeof Api) => () => void,
): Promise<void> {
  const mensaje = pie.appendChild(document.createElement("p"));
  mensaje.className = "ropero-nota";
  mensaje.textContent = "Entrando…";
  const caja = pie.appendChild(document.createElement("div"));
  try {
    const [{ abrirSesion }, { api }] = await Promise.all([
      import("../cuenta/sesion"),
      import("../../../../convex/_generated/api"),
    ]);
    const estado = { escena: "ropero", listo: true, pasosTotales: 0, pasosPorSegundo: 0 };
    await abrirSesion({ estado, panel: pie, mensaje, caja }, (convex) => {
      mensaje.textContent = "";
      return alEntrar(convex, api);
    });
  } catch (error) {
    console.error(error);
    mensaje.textContent = "No se pudo abrir la cuenta.";
  }
}
