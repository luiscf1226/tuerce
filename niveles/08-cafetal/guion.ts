// El guion del nivel 8, El cafetal (TU-41). Lo que la escena no puede decir:
//   · Los canastos: el que cae en el recibidero cuenta (se vacía); el que cae en otro lado se regó. Con tres
//     vaciados baja el portón del patio. Cada canasto vuelve lleno a su poste (lo hace la pieza).
//   · El logro, «Buen pulso»: atrapar diez canastos seguidos, sin que se riegue ninguno sin atrapar en el medio (el
//     que ya atraparon y después se cae no corta la racha).
//   · El Cipitío: empieza en la rama del palo de jocote, sobre el muro de la terraza, y les tira piedras a los pies
//     (sin piedrazo: son escalones). Cuando la pareja llega arriba (punto 2) se va riendo al portillo de la tapia,
//     y desde ahí tira piedrazos que tumban al que se acerca sin un guineo. Cuando se come el guineo se sube a la
//     tapia, contento, y deja libre el portillo.
//   · La llave de la zaranda abre la puerta del beneficio cuando alguien la lleva hasta el candado.
//   · La polea: el saco que llega arriba del todo se descarga en la troja. Con los dos sacos arriba se abre la
//     puerta de atrás del beneficio.
//   · Se dibujan acá el palo de jocote, la mata de guineo, el café tendido en el patio y el sombrero puntudo del
//     secreto (la zona `secreto` del .glb lo encuentra sola).

import { PASO } from "../../apps/juego/src/motor/bucle";
import { crearPaloDeJocote, crearSombreroPuntudo, type Punteria } from "../../apps/juego/src/niveles/cipitio";
import type { GuionDeNivel, NivelEnJuego } from "../../apps/juego/src/niveles/guion";
import { crearCafeTendido } from "../../apps/juego/src/niveles/piezas-cafetal";
import { crearBanano } from "../../apps/juego/src/niveles/piezas-tren";

/** Las alturas, como en scripts/niveles/cafetal.mjs: el cafetal, el patio de secado y la terraza del beneficio. */
export const Y0 = 0;
export const Y1 = 1.4;
export const Y2 = 3.5;
/** El recibidero (por dentro, con un margen): el canasto que cae ahí se vacía. */
export const RECIBIDERO = { x: [-23.15, -20.85], z: [-2.75, -0.45], y: [Y1 - 0.2, Y1 + 1.2] } as const;
/** Cuántos canastos vaciados bajan el portón, y cuántos atrapados seguidos dan el logro. */
export const CANASTOS = 3;
export const BUEN_PULSO = 10;
/** El candado de la puerta del beneficio: la llave que llega a menos de `cerca` se encaja. */
export const CANDADO = { x: -0.26, y: Y2 + 1.25, z: -0.95, cerca: 0.45 } as const;
/** La troja: dónde quedan los sacos que sube la polea y desde qué altura cuentan como arriba. */
export const TROJA = {
  lugares: [
    { x: 9.3, y: Y2 + 2.6 + 0.28, z: -1.2 },
    { x: 10.1, y: Y2 + 2.6 + 0.28, z: -1.2 },
  ],
  x: [8.4, 13],
  alto: Y2 + 2.5,
} as const;
/** El portillo de la tapia, donde se sienta El Cipitío después del muro, y la tapia, donde se sube contento. */
export const PORTILLO = { x: 27.0, y: Y2, z: 0 } as const;
export const TAPIA = { x: 27.0, y: Y2 + 2.4, z: -1.9 } as const;
const OESTE = -Math.PI / 2;
export const PUNTERIA_PORTILLO: Partial<Punteria> = {
  vista: 6,
  cada: 1.8,
  corto: 0,
  cerca: 0,
  empujon: 3.6,
  vuelo: 0.8,
  estorba: true,
};
/** Las puertas que se abren: cuánto bajan (m) y a qué velocidad (m/s). */
const PUERTA = { baja: 2.5, velocidad: 1.2 };
/** El palo de jocote del Cipitío, la mata de guineo y el sombrero del secreto. */
const JOCOTE = { x: -10.7, z: -2.3 };
const MATA = { x: 20.0, z: -2.1 };
const SOMBRERO = { x: 35.0, y: Y2 + 2.8, z: -2.4 };

type Punto = { readonly x: number; readonly y: number; readonly z: number };

/** Si ese punto está en el recibidero. */
export function enElRecibidero(p: Punto): boolean {
  const r = RECIBIDERO;
  return p.x > r.x[0] && p.x < r.x[1] && p.z > r.z[0] && p.z < r.z[1] && p.y > r.y[0] && p.y < r.y[1];
}

export function crearGuion(): GuionDeNivel {
  let vaciados = 0;
  let racha = 0;
  /** Las puertas que se están abriendo (su nombre) y cuánto bajaron. */
  const abiertas = new Map<string, { desde: Punto; bajado: number }>();
  let enLaTroja = 0;

  const abrir = (nivel: NivelEnJuego, nombre: string, ya = false) => {
    const c = nivel.pieza(nombre).cuerpo;
    if (!c || abiertas.has(nombre)) return;
    const t = c.translation();
    abiertas.set(nombre, { desde: { x: t.x, y: t.y, z: t.z }, bajado: 0 });
    if (ya) {
      const puerta = abiertas.get(nombre);
      if (!puerta) return;
      puerta.bajado = PUERTA.baja;
      c.setTranslation({ x: puerta.desde.x, y: puerta.desde.y - PUERTA.baja, z: puerta.desde.z }, true);
    }
  };
  const alPortillo = (nivel: NivelEnJuego) => nivel.cipitio("cipitio").mudarse(PORTILLO, OESTE, PUNTERIA_PORTILLO);
  const aLaTapia = (nivel: NivelEnJuego) => nivel.cipitio("cipitio").mudarse(TAPIA, OESTE, { estorba: false });
  /** Descarga en la troja el saco que llegó arriba, en el primer lugar libre. */
  const descargar = (nivel: NivelEnJuego) => {
    const polea = nivel.polea("polea");
    if (polea.subida < 0.98 || !polea.saco) return;
    const saco = polea.descolgar();
    const lugar = TROJA.lugares[Math.min(enLaTroja, TROJA.lugares.length - 1)];
    if (saco && lugar) saco.ponerEn(lugar);
  };

  return {
    alEmpezar(nivel) {
      for (const n of [1, 2, 3]) {
        const canasto = nivel.canasto(`canasto-${n}`);
        canasto.alAtrapar(() => {
          racha++;
          if (racha >= BUEN_PULSO) nivel.lograr();
        });
        canasto.alCaer((donde, atrapado) => {
          if (enElRecibidero(donde)) {
            vaciados++;
            if (vaciados >= CANASTOS) abrir(nivel, "porton-patio");
          }
          // Se regó sin que nadie lo atrapara: se corta la racha
          else if (!atrapado) racha = 0;
        });
      }
      nivel.cipitio("cipitio").alComer(() => aLaTapia(nivel));

      // Lo que se ve: el palo de jocote con la rama del Cipitío, la mata de guineo, el café tendido y el sombrero
      const asiento = nivel.cipitio("cipitio").asiento;
      nivel.escena.add(
        crearPaloDeJocote(
          { x: JOCOTE.x, y: Y2, z: JOCOTE.z },
          { x: asiento.x - 0.25, y: asiento.y - 0.08, z: asiento.z },
        ),
      );
      const mata = crearBanano(3.2, 7);
      mata.position.set(MATA.x, Y2, MATA.z);
      nivel.escena.add(mata);
      const sombrero = crearSombreroPuntudo();
      sombrero.position.set(SOMBRERO.x, SOMBRERO.y, SOMBRERO.z);
      sombrero.rotation.set(0.15, 0.6, -0.1);
      nivel.escena.add(sombrero);
      // El café tendido a secar en el patio, menos en el recibidero
      nivel.escena.add(crearCafeTendido([-27.4, -2.9], [-18.4, 2.9], Y1, (x, z) => x > -23.4 && x < -20.6 && z < -0.2));
    },
    alAlcanzar(n, nivel) {
      // Arriba del muro: El Cipitío se va riendo al portillo de la tapia
      if (n === 2) alPortillo(nivel);
    },
    alRetomar(n, nivel) {
      if (n >= 1) {
        vaciados = CANASTOS;
        abrir(nivel, "porton-patio", true);
      }
      if (n >= 2) alPortillo(nivel);
      if (n >= 3) {
        nivel.zaranda("zaranda").encajar(CANDADO);
        abrir(nivel, "puerta-beneficio", true);
      }
      if (n >= 4) {
        for (const [i, lugar] of TROJA.lugares.entries()) nivel.saco(`saco-${i + 1}`).ponerEn(lugar);
        enLaTroja = TROJA.lugares.length;
        abrir(nivel, "puerta-troja", true);
      }
      if (n >= 5) {
        nivel.cipitio("cipitio").contentar();
        aLaTapia(nivel);
      }
    },
    cadaPaso(nivel) {
      // Las puertas que se abren bajan de a poco
      for (const [nombre, puerta] of abiertas) {
        if (puerta.bajado >= PUERTA.baja) continue;
        puerta.bajado = Math.min(PUERTA.baja, puerta.bajado + PUERTA.velocidad * PASO);
        nivel.pieza(nombre).cuerpo?.setNextKinematicTranslation({
          x: puerta.desde.x,
          y: puerta.desde.y - puerta.bajado,
          z: puerta.desde.z,
        });
      }
      // La llave que llega al candado se encaja y abre la puerta del beneficio
      const zaranda = nivel.zaranda("zaranda");
      const llave = zaranda.llave;
      if (llave.suelta && !llave.encajada && llave.agarrada > 0) {
        const t = llave.cuerpo.translation();
        if (Math.hypot(t.x - CANDADO.x, t.y - CANDADO.y, t.z - CANDADO.z) < CANDADO.cerca) {
          zaranda.encajar(CANDADO);
          abrir(nivel, "puerta-beneficio");
        }
      }
      // La polea: el saco que llega arriba se descarga en la troja; con los dos arriba, se abre la puerta de atrás
      descargar(nivel);
      enLaTroja = [1, 2].filter((i) => {
        const t = nivel.saco(`saco-${i}`).cuerpo.translation();
        return t.x > TROJA.x[0] && t.x < TROJA.x[1] && t.y > TROJA.alto;
      }).length;
      if (enLaTroja >= TROJA.lugares.length) abrir(nivel, "puerta-troja");
    },
  };
}
