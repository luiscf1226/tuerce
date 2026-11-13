// El guion del nivel 7, Las trenzas (TU-40). Lo que la escena no puede decir:
//   · El portón del arco: sus dos hojas se abren (giran hacia el este sobre sus bisagras) cuando se desata el nudo.
//   · El zaguán del mesón: se abre cuando la mula llega cargada al mesón.
//   · Los bultos de la mula tirados en el suelo vuelven al poyo: del suelo no se los puede levantar.
//   · El balde se llena bajo el caño de la fuente.
//   · La meta (punto 5) aparece cuando el Sombrerón se pone su sombrero.
//   · El logro, «Sin un nudo»: llegar a la meta sin que el Sombrerón haya enredado a ninguno de los dos.
//   · El volcán, los arcos, las ventanas de las fachadas, las ruinas de la iglesia, el caño de la fuente, el
//     campanario y el barrilete del secreto (la zona `secreto` del .glb la encuentra sola) se dibujan acá
//     (decorado-trenzas.ts).
// Lo que cae al vacío vuelve solo a su lugar (lo hacen las piezas).

import { crearHojas, dibujarDecoradoTrenzas } from "../../apps/juego/src/niveles/decorado-trenzas";
import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";

/** Lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/trenzas.mjs: las x de
 * abajo son las de antes de correrlo. */
export const DX = -38;
/** La plaza de arriba, la del Sombrerón. */
export const ALTA = 1.5;
/** Las hojas de los portones: cuál, la bisagra (x, z) y hacia dónde giran (+1 la del lado −z). Se abren en tantos
 * pasos. */
const HOJAS = {
  porton: [
    ["porton-1a", 7.3, -3.2, 1],
    ["porton-1b", 7.3, 3.2, -1],
  ],
  zaguan: [
    ["zaguan-a", 28.15, -1.3, 1],
    ["zaguan-b", 28.15, 1.3, -1],
  ],
  pasos: 90,
} as const;
/** El mesón: donde tiene que llegar la mula cargada (x, z). */
export const MESON = { x: [24, 27.6], z: [-3.2, 3.2] } as const;
/** Dónde queda la mula al retomar después del punto 2. */
const MULA_EN_EL_MESON = { x: 26, z: -1.4 };
/** Bajo el caño de la fuente: el balde que se tiene ahí tantos pasos se llena. */
export const CANO = { x: [46.9, 48.3], y: [0.8, 1.7], z: [-2.5, -1.7], pasos: 20 } as const;
/** Los bultos tirados: más bajo que esto (m) y quietos tantos pasos, vuelven al poyo. */
const BULTO = { bajo: 0.45, pasos: 180 };
/** Donde se esconden las zonas de los puntos que todavía no se pueden alcanzar. */
const ESCONDIDA = -100;

type Hojas = ReturnType<typeof crearHojas>;

export function crearGuion(): GuionDeNivel {
  let porton: Hojas | undefined;
  let zaguan: Hojas | undefined;
  /** Cuánto se abrió cada portón (pasos), o −1 si está cerrado. */
  const abriendo = { porton: -1, zaguan: -1 };
  let enElCano = 0;
  const bultosTirados = new Map<string, number>();
  let meta: Volumen["centro"] | undefined;
  let enredado = false;

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`Las trenzas: falta el punto ${n}`);
    return p.zona;
  };
  /** La meta aparece cuando el Sombrerón se pone su sombrero. */
  const mostrarMeta = (nivel: NivelEnJuego, ya: boolean) => {
    const zona = punto(nivel, 5);
    if (!meta) return;
    zona.centro.copy(meta);
    if (!ya) zona.centro.y = ESCONDIDA;
  };
  const hojas = (nivel: NivelEnJuego, cuales: readonly (readonly [string, number, number, number])[]) =>
    crearHojas(
      cuales.map(([nombre, x, z, hacia]) => {
        const cuerpo = nivel.pieza(nombre).cuerpo;
        if (!cuerpo) throw new Error(`Las trenzas: «${nombre}» no se mueve`);
        return { cuerpo, bisagra: { x: DX + x, z }, hacia };
      }),
    );

  return {
    alEmpezar(nivel) {
      porton = hojas(nivel, HOJAS.porton);
      zaguan = hojas(nivel, HOJAS.zaguan);
      nivel.nudo("nudo").alDesatar(() => {
        if (abriendo.porton < 0) abriendo.porton = 0;
      });
      meta = punto(nivel, 5).centro.clone();
      mostrarMeta(nivel, false);
      const sombreron = nivel.sombreron("sombreron");
      sombreron.alPonerse(() => mostrarMeta(nivel, true));
      sombreron.alEnredar(() => {
        enredado = true;
      });
      dibujarDecoradoTrenzas(nivel.escena, DX, ALTA);
    },
    alAlcanzar(n, nivel) {
      // Llegaron a la meta sin que el Sombrerón los enredara ni una vez
      if (n === 5 && !enredado) nivel.lograr();
    },
    alRetomar(n, nivel) {
      if (n >= 1) {
        nivel.nudo("nudo").desatar();
        abriendo.porton = HOJAS.pasos + 1;
        porton?.abrir(1, true);
      }
      if (n >= 2) {
        const mula = nivel.mula("mula");
        mula.ponerEn(DX + MULA_EN_EL_MESON.x, MULA_EN_EL_MESON.z, Math.PI / 2);
        mula.cargar();
        abriendo.zaguan = HOJAS.pasos + 1;
        zaguan?.abrir(1, true);
      }
      if (n >= 4) {
        nivel.brasa("brasa-1").apagar(true);
        nivel.brasa("brasa-2").apagar(true);
      }
      if (n >= 5) nivel.sombreron("sombreron").ponerse();
      else nivel.sombreron("sombreron").volver();
      enredado = false;
    },
    cadaPaso(nivel) {
      // Los portones que se están abriendo
      for (const [cual, lista] of [
        ["porton", porton],
        ["zaguan", zaguan],
      ] as const) {
        const f = abriendo[cual];
        if (f < 0 || f > HOJAS.pasos) continue;
        lista?.abrir(f / HOJAS.pasos);
        abriendo[cual] = f + 1;
      }

      // La mula cargada que llega al mesón: el mesonero abre el zaguán
      const mula = nivel.mula("mula");
      if (abriendo.zaguan < 0 && mula.cargada) {
        const t = mula.cuerpo.translation();
        const x = t.x - DX;
        if (x > MESON.x[0] && x < MESON.x[1] && t.z > MESON.z[0] && t.z < MESON.z[1]) abriendo.zaguan = 0;
      }
      // Los bultos tirados en el suelo vuelven al poyo
      for (const bulto of mula.bultos) {
        const c = bulto.cuerpo;
        if (c.isKinematic()) continue;
        const v = c.linvel();
        const tirado = c.translation().y < BULTO.bajo && Math.hypot(v.x, v.y, v.z) < 0.05;
        const pasos = tirado ? (bultosTirados.get(bulto.nombre) ?? 0) + 1 : 0;
        bultosTirados.set(bulto.nombre, pasos);
        if (pasos > BULTO.pasos) {
          bulto.volver();
          bultosTirados.set(bulto.nombre, 0);
        }
      }

      // El balde bajo el caño de la fuente se llena
      const balde = nivel.balde("balde");
      const b = balde.cuerpo.translation();
      const x = b.x - DX;
      const bajoElCano =
        x > CANO.x[0] && x < CANO.x[1] && b.y > CANO.y[0] && b.y < CANO.y[1] && b.z > CANO.z[0] && b.z < CANO.z[1];
      enElCano = bajoElCano && !balde.lleno ? enElCano + 1 : 0;
      if (enElCano > CANO.pasos) {
        balde.llenar();
        enElCano = 0;
      }
    },
  };
}
