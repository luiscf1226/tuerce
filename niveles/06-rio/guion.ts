// El guion del nivel 6, el Río Plátano (TU-28). Lo que la escena no puede decir:
//   · El pipante vacío que quedó lejos del muelle vuelve solo a su lugar (antes del punto 1).
//   · Los troncos de los rápidos: el guion los baja por sus tres carriles, a la velocidad de la quebrada, uno detrás
//     de otro y siempre igual (por el número de paso). Salen de debajo de la cascada y se hunden al pasar. El tronco
//     que alcanza a alguien en el vado lo tumba al agua.
//   · Las huellas del Sisimite, dibujadas acá: en el carril de adelante los dedos apuntan para adentro (el Sisimite
//     salió de ahí: tiene los pies al revés) y en el de atrás, para afuera (se fue por ahí).
//   · Las tablas del puente tiradas en el suelo (o en el piso del puente, fuera de un hueco) vuelven a sus
//     caballetes: del suelo no se las puede levantar.
//   · La liana empieza recogida del otro lado del barranco, junto a la ceiba. El que la agarra y la suelta la tira:
//     se corre por la rama hasta quedar colgando junto a la orilla de acá. Recién ahí aparece la meta (punto 6).
//   · El logro, «Sin despertarlo»: llegar a la cumbre del Sisimite (punto 5) sin que haya abierto los ojos.
//   · La figura de jade del secreto (la zona `secreto` del .glb la encuentra sola) y las palmeras de la selva se
//     dibujan acá.
// Lo que cae al vacío vuelve solo a su lugar (lo hacen las piezas).

import { COLORES } from "../../apps/juego/src/escenas/colores";
import { materialCorteza, materialTela } from "../../apps/juego/src/imagen";
import { PASO } from "../../apps/juego/src/motor/bucle";
import type { Pieza } from "../../apps/juego/src/niveles/armar";
import type { Volumen } from "../../apps/juego/src/niveles/formato";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { manosEn } from "../../apps/juego/src/niveles/piezas-pinar";
import { crearImagenPalmera } from "../../apps/juego/src/niveles/piezas-rio";
import { crearFiguraDeJade, crearHuella } from "../../apps/juego/src/niveles/sisimite";

/** La tierra y lo que va corrido el nivel en x (para caber en la foto de la red), como en scripts/niveles/rio.mjs:
 * las x de abajo son las de antes de correrlo. */
const G = 0.3;
export const DX = -53;
/** El pipante vacío, a más de esto de su lugar (m) y tantos pasos sin nadie, vuelve. */
const PIPANTE = { lejos: 2, pasos: 480, embarcadero: { x: DX + 22.6, y: 0.14, z: -1.0 } };
/** Los troncos de los rápidos: sus carriles (x), por dónde bajan (z), a qué altura flotan, su velocidad (la de la
 * quebrada), cada cuántos pasos sale uno por carril y cuánto se corren entre carriles. */
export const RAPIDOS = {
  carriles: [DX + 29.9, DX + 32.5, DX + 35.1],
  desde: -4.2,
  hasta: 3.8,
  flota: 0.2,
  hundido: -1,
  velocidad: 2.4,
  periodo: 252,
  corrido: 84,
  /** Se hunde y sale en tantos pasos. */
  hundir: 18,
  /** El tronco tumba al que esté a menos de esto de él (m: a lo largo, de frente) y con este empujón (m/s). */
  alcance: { largo: 0.75, ancho: 0.45 },
  empujon: { adelante: 3.4, arriba: 1.2 },
} as const;
/** Las tablas tiradas: más bajo que esto (m) y quietas tantos pasos, vuelven a los caballetes. */
const TABLA = { bajo: G + 0.6, pasos: 180 };
/** La liana: recogida junto a la ceiba (dónde queda su ancla), y en cuántos pasos la tiran. */
const LIANA = { recogida: { x: DX + 101.8, y: G + 3.9, z: 0 }, pasos: 90, arco: 0.5 };
/** Las huellas: dónde, y hacia dónde apuntan los dedos (+1: hacia +x). */
const HUELLAS: readonly (readonly [number, number, 1 | -1])[] = [
  // En el carril de adelante (el del lodazal), los dedos para adentro
  [41.3, 1.45, 1],
  [42.5, 1.95, 1],
  [43.7, 1.45, 1],
  [44.9, 1.95, 1],
  // En la bifurcación y en el carril de atrás, para afuera
  [39.4, -0.2, -1],
  [40.6, -0.95, -1],
  [41.8, -1.5, -1],
  [43.0, -2.0, -1],
  [44.2, -1.5, -1],
  [45.4, -2.0, -1],
  [46.6, -1.5, -1],
  [47.8, -2.0, -1],
];
/** La figura de jade, en el nicho de arriba del templo. */
const JADE = { x: DX + 112.5, y: G + 2.8, z: -2.6 };
/** Las palmeras de adorno: x, z, alto. */
const PALMERAS: readonly (readonly [number, number, number])[] = [
  [-7, -2.9, 5.2],
  [-1.5, 2.9, 4.4],
  [27.5, -2.9, 5.6],
  [37.8, 2.9, 4.8],
  [50.2, -2.9, 5.4],
  [58.8, 2.9, 4.6],
  [72.8, -2.9, 6.0],
  [89.5, -2.9, 5.0],
  [91.6, 2.9, 4.2],
  [100.8, 2.9, 5.6],
  // Detrás de la peña, más altas
  [-4, -6.5, 9],
  [6, -7.2, 10],
  [17, -6.6, 9.5],
  [33, -7.4, 10.5],
  [45, -6.8, 9],
  [57, -7.6, 11],
  [68, -6.6, 9.5],
  [79, -7.2, 10],
  [91, -6.8, 9.5],
  [104, -7.6, 11],
  [112, -6.6, 9],
];
/** Donde se esconden las zonas de los puntos que todavía no se pueden alcanzar. */
const ESCONDIDA = -100;

type Cuerpo = NonNullable<Pieza["cuerpo"]>;
type Punto = { x: number; y: number; z: number };

export function crearGuion(): GuionDeNivel {
  let troncos: (Cuerpo | null)[] = [];
  /** Hasta qué paso no lo vuelve a tumbar un tronco (a cada uno). */
  const tumbado = [0, 0];
  let pipanteSolo = 0;
  const tablasTiradas = new Map<string, number>();
  let ancla: Cuerpo | undefined;
  let tirada = { x: 0, y: 0, z: 0 };
  let liana: "recogida" | "agarrada" | "tirando" | "tirada" = "recogida";
  let tirando = 0;
  let meta: Volumen["centro"] | undefined;
  let despierto = false;

  const punto = (nivel: NivelEnJuego, n: number) => {
    const p = nivel.plano.puntos[n];
    if (!p?.zona) throw new Error(`Río Plátano: falta el punto ${n}`);
    return p.zona;
  };
  /** La meta aparece cuando tiran la liana. */
  const mostrarMeta = (nivel: NivelEnJuego, ya: boolean) => {
    const zona = punto(nivel, 6);
    if (!meta) return;
    zona.centro.copy(meta);
    if (!ya) zona.centro.y = ESCONDIDA;
  };
  /** Pone el ancla de la liana ahí (la cadena va con ella). */
  const moverLiana = (donde: Punto) => {
    ancla?.setTranslation({ x: donde.x, y: donde.y, z: donde.z }, true);
  };

  /** Dónde va el tronco del carril `k` en el paso `n`: bajando, hundiéndose o escondido. */
  const tronco = (k: number, n: number) => {
    const r = RAPIDOS;
    const t = (n + k * r.corrido) % r.periodo;
    const viaje = Math.round((r.hasta - r.desde) / (r.velocidad * PASO));
    const x = r.carriles[k] ?? 0;
    if (t >= viaje) return { x, y: r.hundido, z: r.desde, activo: false, salto: t === viaje };
    const z = r.desde + r.velocidad * t * PASO;
    const subir = Math.min(1, t / r.hundir, (viaje - t) / r.hundir);
    return { x, y: r.hundido + (r.flota - r.hundido) * subir, z, activo: subir > 0.5, salto: false };
  };

  return {
    alEmpezar(nivel) {
      troncos = RAPIDOS.carriles.map((_, k) => nivel.pieza(`tronco-rio-${k + 1}`).cuerpo);
      troncos.forEach((c, k) => {
        const t = tronco(k, 0);
        c?.setTranslation(t, true);
      });
      // La liana: su ancla es el cuerpo fijo (sin forma) del que cuelga la cadena, medio tramo arriba del primer
      // segmento. Empieza recogida junto a la ceiba
      const [s0, s1] = nivel.bejuco("liana").segmentos;
      if (s0 && s1) {
        const a = s0.translation();
        const b = s1.translation();
        const arriba = { x: a.x + (a.x - b.x) / 2, y: a.y + (a.y - b.y) / 2, z: a.z + (a.z - b.z) / 2 };
        const anclas: Cuerpo[] = [];
        nivel.mundo.forEachRigidBody((c) => {
          const t = c.translation();
          const d = Math.hypot(t.x - arriba.x, t.y - arriba.y, t.z - arriba.z);
          if (c.isFixed() && c.numColliders() === 0 && d < 0.05) anclas.push(c);
        });
        ancla = anclas[0];
        tirada = arriba;
      }
      moverLiana(LIANA.recogida);
      // La meta, hasta que tiren la liana
      meta = punto(nivel, 6).centro.clone();
      mostrarMeta(nivel, false);
      nivel.sisimite("sisimite").alDespertar(() => {
        despierto = true;
      });
      // Las huellas, la figura de jade y las palmeras
      for (const [i, [x, z, hacia]] of HUELLAS.entries()) {
        const huella = crearHuella();
        huella.position.set(DX + x, G + 0.012, z);
        huella.rotation.y = (hacia * Math.PI) / 2;
        // Pie izquierdo y derecho
        if (i % 2 === 1) huella.scale.x = -1;
        nivel.escena.add(huella);
      }
      const jade = crearFiguraDeJade();
      jade.position.set(JADE.x, JADE.y, JADE.z);
      jade.rotation.y = 0.2;
      nivel.escena.add(jade);
      const madera = materialCorteza(COLORES.silueta, { repetir: [2, 3] });
      const hojas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
      for (const [i, [x, z, alto]] of PALMERAS.entries()) {
        const { grupo } = crearImagenPalmera(madera, hojas, alto, 0.13);
        grupo.position.set(DX + x, G, z);
        grupo.rotation.set(0.08 * Math.sin(i * 2.1), i * 1.7, 0.08 * Math.cos(i * 1.3));
        nivel.escena.add(grupo);
      }
    },
    alAlcanzar(n, nivel) {
      // Llegaron a la cumbre del Sisimite sin que abriera los ojos
      if (n === 5 && !despierto) nivel.lograr();
    },
    alRetomar(n, nivel) {
      if (n >= 1) {
        const c = nivel.pipante("pipante").cuerpo;
        c.setTranslation(PIPANTE.embarcadero, true);
      }
      if (n >= 4) nivel.puente("puente").reparar();
      nivel.sisimite("sisimite").volver();
      despierto = false;
      if (n >= 6) {
        liana = "tirada";
        moverLiana(tirada);
        mostrarMeta(nivel, true);
      }
    },
    cadaPaso(nivel) {
      // Los troncos de los rápidos
      troncos.forEach((c, k) => {
        if (!c) return;
        const t = tronco(k, nivel.pasos);
        // Al volver arriba, de un salto (escondido bajo el agua)
        if (t.salto) c.setTranslation(t, true);
        else c.setNextKinematicTranslation(t);
        if (!t.activo) return;
        nivel.munecos.forEach((m, j) => {
          if (nivel.pasos < (tumbado[j] ?? 0)) return;
          const p = m.partes.pelvis.translation();
          const cerca =
            Math.abs(p.x - t.x) < RAPIDOS.alcance.largo &&
            Math.abs(p.z - t.z) < RAPIDOS.alcance.ancho &&
            p.y < t.y + 0.9;
          if (!cerca) return;
          tumbado[j] = nivel.pasos + 60;
          const { adelante, arriba } = RAPIDOS.empujon;
          for (const parte of Object.values(m.partes)) {
            const masa = parte.mass();
            parte.applyImpulse({ x: 0, y: arriba * masa, z: adelante * masa }, true);
          }
        });
      });

      // El pipante vacío, lejos del muelle, vuelve solo (antes de llegar al embarcadero)
      const pipante = nivel.pipante("pipante");
      if (nivel.puntoDeControl < 1) {
        const t = pipante.cuerpo.translation();
        const lejos = Math.hypot(t.x - pipante.casa.centro.x, t.z - pipante.casa.centro.z) > PIPANTE.lejos;
        pipanteSolo = pipante.aBordo === 0 && lejos ? pipanteSolo + 1 : 0;
        if (pipanteSolo > PIPANTE.pasos) {
          pipante.volver();
          pipanteSolo = 0;
        }
      }

      // Las tablas tiradas en el suelo (o en el piso del puente) vuelven a sus caballetes
      for (const tabla of nivel.puente("puente").tablas) {
        const c = tabla.cuerpo;
        const v = c.linvel();
        const tirada = !c.isKinematic() && tabla.cargadores === 0 && c.translation().y < TABLA.bajo;
        const pasos = tirada && Math.hypot(v.x, v.y, v.z) < 0.05 ? (tablasTiradas.get(tabla.nombre) ?? 0) + 1 : 0;
        tablasTiradas.set(tabla.nombre, pasos);
        if (pasos > TABLA.pasos) {
          tabla.volver();
          tablasTiradas.set(tabla.nombre, 0);
        }
      }

      // La liana: el que la agarra y la suelta, la tira
      if (liana === "recogida" || liana === "agarrada") {
        const segmentos = nivel.bejuco("liana").segmentos;
        const agarrada = nivel.munecos.some((m) => segmentos.some((s) => manosEn(m, s) > 0));
        if (agarrada) liana = "agarrada";
        else if (liana === "agarrada") {
          liana = "tirando";
          tirando = 0;
        }
      }
      if (liana === "tirando") {
        tirando++;
        const f = tirando / LIANA.pasos;
        const s = f * f * (3 - 2 * f);
        const r = LIANA.recogida;
        moverLiana({
          x: r.x + (tirada.x - r.x) * s,
          y: r.y + (tirada.y - r.y) * s + LIANA.arco * Math.sin(Math.PI * f),
          z: r.z + (tirada.z - r.z) * s,
        });
        if (tirando >= LIANA.pasos) {
          liana = "tirada";
          mostrarMeta(nivel, true);
        }
      }
    },
  };
}
