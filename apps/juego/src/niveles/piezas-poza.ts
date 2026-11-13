// Las piezas que estrena La poza (TU-24), menos La Sucia (sucia.ts). Cada una sale de un nodo `tipo: pieza` de la
// escena (formato-poza.ts) y se arma con las herramientas de piezas.ts, como las del pinar:
//
//   balsa      los troncos `<nombre>-1`, `-2`… (piezas `tronco` del pinar: 9 kg, de a dos) se amarran solos cuando
//              están los tres flotando donde dice su caja. Amarrada flota entera (agua.ts) y tiene dos remos: el que
//              va a bordo junto a un remo y alza los brazos, rema. Cada remo empuja de su lado: con uno solo la balsa
//              da vueltas; con los dos, va derecho. Al que va a bordo la balsa lo lleva (si no, se quedaría quieto
//              mientras ella avanza: los muñecos andan respecto del mundo).
//   tendedero  una cuerda en bajada con una polea: el que agarra la manija con las dos manos (o se cuelga) baja
//              por ella como en tirolesa, frena al final y suelta. Sin nadie, la polea vuelve sola arriba.
//   batea      una batea de madera llena de pepitas (9 kg: de a dos). Si se ladea más de lo que aguanta, se bota:
//              las pepitas saltan y al rato vuelve llena a su lugar.
//   piedra     una piedra redonda que se empuja (rueda) y se hunde en el agua.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialOjo, materialTela } from "../imagen";
import { crearAzar } from "../imagen/ruido";
import { PASO } from "../motor/bucle";
import { GRAVEDAD } from "../motor/fisica";
import type { EntradaMuneco, Muneco } from "../muneco";
import { AJUSTES } from "../muneco/ajustes";
import { crearGotas } from "./agua";
import type { PiezaDeLaPozaEnPlano } from "./formato-poza";
import type { Herramientas } from "./piezas";
import { GRUPOS_SUELTO, manosEn, type Tronco } from "./piezas-pinar";

/** El bit de grupo de choque de lo suelto de la poza (la manija de la polea): choca con todo menos con los muñecos
 * (bits 1 y 2); grupos del resolvedor sin filtro: se la encuentra para agarrarla, pero no empuja ni la empujan. */
const BIT_POZA = 1 << 6;
const GRUPOS_POZA = ((BIT_POZA << 16) | (0xffff & ~0b110)) >>> 0;
const SIN_EMPUJAR = (BIT_POZA << 16) >>> 0;

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const CERO = { x: 0, y: 0, z: 0 };
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));
const suave = (t: number) => {
  const x = limitar(t, 0, 1);
  return x * x * (3 - 2 * x);
};
const BRAZOS = ["brazoIzquierdo", "brazoDerecho"] as const;

/** Los números de las piezas de la poza que no se ponen desde Blender. */
export const AJUSTES_POZA = {
  balsa: {
    /** Qué tan cerca de la altura de su caja tienen que estar los troncos (flotando, no en la orilla) (m). */
    flotando: 0.2,
    /** Cuántos pasos tarda en amarrarlos (se acomodan solos, uno al lado del otro) y, si se amarran en tierra, en
     * bajarla al agua. */
    amarrar: 45,
    botar: 150,
    /** Dónde va cada remo a lo largo de la balsa (fracción del medio largo, hacia atrás) y qué tan cerca tiene que
     * estar el remero (m, a lo largo). */
    remo: -0.15,
    alcance: 0.9,
    /** Por debajo y por encima de la cubierta, la pelvis de uno que va a bordo (m). */
    bordo: [0.15, 1.2],
    /** Qué tan rápido el que va quieto a bordo toma la velocidad de la balsa (1/s). */
    agarre: 40,
  },
  tendedero: {
    /** Lo que frena la polea con alguien colgado, en fracción de lo que la empuja la bajada. */
    rozamiento: 0.15,
    /** Cómo frena al llegar al final (m/s²) y a qué velocidad vuelve sola arriba (m/s). */
    frenar: 5,
    volver: 1.2,
    /** La manija: un travesaño de este medio largo (m) para las dos manos. */
    manija: 0.24,
  },
  batea: {
    /** Botada, vuelve llena a su lugar después de esto (s). Tirada en otro lado sin que nadie la toque, también. */
    volver: 2,
    abandonada: 12,
    /** Cuánto más abajo que el fondo de su caja va su centro de masa (m), y cuánto se frena su giro: así, agarrada
     * de las puntas, cuelga derecha y no se mece. */
    lastre: 0.35,
    amortiguar: 8,
  },
} as const;

/** Lo pone donde estaba al empezar, quieto. */
function devolver(cuerpo: RAPIER.RigidBody, posicion: THREE.Vector3Like, giro: THREE.Quaternion) {
  cuerpo.setTranslation({ x: posicion.x, y: posicion.y, z: posicion.z }, true);
  cuerpo.setRotation(giro, true);
  cuerpo.setLinvel(CERO, true);
  cuerpo.setAngvel(CERO, true);
}

/** Si el muñeco tiene esa mano alzada (la mano más arriba que el hombro): con eso se rema, también en el invitado. */
function alzada(m: Muneco, brazo: (typeof BRAZOS)[number]): boolean {
  return m.partes[brazo].translation().y > m.partes.torso.translation().y + 0.12;
}

/** Lleva al muñeco que va de pie sobre una embarcación (la balsa; el pipante del Río Plátano, TU-28): le suma lo
 * que el andar le quitaría por ir con ella (los muñecos andan respecto del mundo), con la velocidad de la embarcación
 * debajo de su pelvis (`v` y el giro `w` alrededor de su centro de masa `com`). Y el que no camina se queda donde
 * está, como si los pies agarraran las tablas (`agarre`, 1/s). */
export function llevarABordo(
  mu: Muneco,
  { v, w, com }: { v: THREE.Vector3Like; w: THREE.Vector3Like; com: THREE.Vector3Like },
  entrada: EntradaMuneco | undefined,
  agarre: number,
) {
  if (!mu.enElSuelo || mu.estado === "en el aire" || mu.estado === "trepando") return;
  const pelvis = mu.partes.pelvis.translation();
  // La velocidad de la embarcación debajo de la pelvis (con su giro)
  const r = { x: pelvis.x - com.x, z: pelvis.z - com.z };
  const vx = v.x + w.y * r.z;
  const vz = v.z - w.y * r.x;
  const k = AJUSTES.andar.respuesta * PASO * mu.tension;
  const quieto = Math.abs(entrada?.avanzar ?? 0) < 0.05;
  const vp = mu.partes.pelvis.linvel();
  const pie = quieto ? agarre * PASO * mu.tension : 0;
  const dx = vx * k + (vx - vp.x) * pie;
  const dz = vz * k + (vz - vp.z) * pie;
  const tronco = mu.masa - mu.partes.torso.mass() - mu.partes.cabeza.mass();
  for (const [c, masa] of [
    [mu.partes.pelvis, tronco],
    [mu.partes.torso, mu.partes.torso.mass()],
    [mu.partes.cabeza, mu.partes.cabeza.mass()],
  ] as const) {
    c.applyImpulse({ x: dx * masa, y: 0, z: dz * masa }, true);
  }
}

// ── La balsa ────────────────────────────────────────────────────────────────────────────────────────────────

export type EstadoBalsa = "suelta" | "amarrando" | "amarrada";

export interface Balsa {
  readonly cual: "balsa";
  readonly nombre: string;
  /** Sus troncos, en el orden de sus nombres. */
  readonly troncos: readonly Tronco[];
  readonly estado: EstadoBalsa;
  /** Quién rema en cada remo, el de la izquierda y el de la derecha (0 el rojo, 1 el turquesa), o `null`. */
  readonly remeros: readonly [0 | 1 | null, 0 | 1 | null];
  /** Cuántos muñecos van a bordo. */
  readonly aBordo: number;
  /** El centro de la balsa (en su cubierta) y su giro, en el mundo: los del tronco del medio. */
  donde(): { centro: THREE.Vector3; giro: THREE.Quaternion };
  /** Lo mismo, amarrada en su lugar (su caja). */
  readonly casa: { readonly centro: THREE.Vector3; readonly giro: THREE.Quaternion };
  /** Si ese punto (una pelvis) va a bordo: encima de la balsa amarrada. */
  encima(p: THREE.Vector3Like): boolean;
  /** Amarra los troncos: los acomoda uno al lado del otro y los une. Con `astillero`, los amarra ahí (en tierra) y
   * después baja la balsa al agua hasta su caja; si no, donde está su caja. Con `ya`, de una vez (al retomar). */
  amarrar(ya?: boolean, astillero?: THREE.Vector3Like): void;
  /** La pone amarrada en su caja, quieta (si se fue lejos sin nadie). */
  volver(): void;
  /** Llama a `aviso` cuando queda amarrada. Devuelve cómo dejar de escuchar. */
  alAmarrar(aviso: () => void): () => void;
}

export function armarBalsa(h: Herramientas, p: Extract<PiezaDeLaPozaEnPlano, { cual: "balsa" }>): Balsa {
  const { rapier, mundo } = h;
  const a = AJUSTES_POZA.balsa;
  const { centro, medio, giro } = p.caja;
  const enX = medio.x >= medio.z;
  const largo = enX ? EJE_X : EJE_Z;
  const ancho = enX ? EJE_Z : EJE_X;
  const mitad = enX ? medio.x : medio.z;
  const medioAncho = enX ? medio.z : medio.x;
  // Hacia dónde avanza (+ del lado largo) y su derecha (adelante × arriba), en el marco de la caja
  const derecha = largo.clone().cross(ARRIBA);
  const n = p.troncos;
  const raiz = Math.floor((n - 1) / 2);
  /** El corrimiento de cada lugar a lo ancho, en el marco de la caja: de la izquierda a la derecha. */
  const lugares = Array.from({ length: n }, (_, i) =>
    derecha.clone().multiplyScalar((i - (n - 1) / 2) * ((medioAncho * 2) / n)),
  );

  let troncos: Tronco[] | undefined;
  /** El giro de cada tronco que lleva su lado largo al de la balsa (en el marco de la caja). */
  const ajustes = new Map<Tronco, THREE.Quaternion>();
  const losTroncos = () => {
    if (troncos) return troncos;
    troncos = Array.from({ length: n }, (_, i) => {
      const t = h.lista.find((q): q is Tronco => q.cual === "tronco" && q.nombre === `${p.nombre}-${i + 1}`);
      if (!t) throw new Error(`la balsa «${p.nombre}» no tiene su tronco «${p.nombre}-${i + 1}»`);
      return t;
    });
    for (const t of troncos) {
      const [p0, p1] = t.puntas();
      const q = new THREE.Quaternion().copy(t.cuerpo.rotation());
      const local = p1.sub(p0).applyQuaternion(q.clone().invert()).setY(0).normalize();
      ajustes.set(t, new THREE.Quaternion().setFromUnitVectors(local, largo).invert());
    }
    return troncos;
  };

  let estado: EstadoBalsa = "suelta";
  let paso = 0;
  /** De dónde sale cada tronco al amarrar y adónde va (en el mundo). */
  let viaje: {
    tronco: Tronco;
    desde: THREE.Vector3;
    desdeQ: THREE.Quaternion;
    /** Donde se amarra (en el astillero), si no es donde va a flotar. */
    medio: THREE.Vector3 | null;
    a: THREE.Vector3;
    aQ: THREE.Quaternion;
  }[] = [];
  const avisos = new Set<() => void>();
  let remeros: [0 | 1 | null, 0 | 1 | null] = [null, null];
  let aBordo = 0;

  /** El giro con que queda un tronco en la balsa: el de la caja, con su lado largo a lo largo (o al revés, si así
   * le queda más cerca de como está). */
  const giroEnLaBalsa = (t: Tronco, actual?: THREE.Quaternion) => {
    const base = giro.clone().multiply(ajustes.get(t) ?? new THREE.Quaternion());
    if (!actual) return base;
    const vuelta = giro
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(ARRIBA, Math.PI))
      .multiply(ajustes.get(t) ?? new THREE.Quaternion());
    return Math.abs(base.dot(actual)) >= Math.abs(vuelta.dot(actual)) ? base : vuelta;
  };

  /** Adónde va cada tronco: el del medio (el que manda) al medio, los otros por cómo están a lo ancho. */
  const planear = (ya: boolean, astillero?: THREE.Vector3Like) => {
    const lista = losTroncos();
    const delMedio = lista[raiz];
    const otros = lista.filter((t) => t !== delMedio);
    const anchoMundo = derecha.clone().applyQuaternion(giro);
    otros.sort(
      (t1, t2) =>
        new THREE.Vector3().copy(t1.cuerpo.translation()).dot(anchoMundo) -
        new THREE.Vector3().copy(t2.cuerpo.translation()).dot(anchoMundo),
    );
    const orden = [...otros.slice(0, raiz), delMedio, ...otros.slice(raiz)];
    const altura =
      ya || astillero
        ? centro.y
        : orden.reduce((s, t) => s + (t?.cuerpo.translation().y ?? centro.y), 0) / Math.max(1, orden.length);
    viaje = orden.flatMap((t, i) => {
      const lugar = lugares[i];
      if (!t || !lugar) return [];
      const desde = new THREE.Vector3().copy(t.cuerpo.translation());
      const desdeQ = new THREE.Quaternion().copy(t.cuerpo.rotation());
      const enLaBalsa = lugar.clone().applyQuaternion(giro);
      const destino = enLaBalsa.clone().add(centro).setY(altura);
      const medio =
        astillero && !ya ? enLaBalsa.clone().add(new THREE.Vector3(astillero.x, astillero.y, astillero.z)) : null;
      return [{ tronco: t, desde, desdeQ, medio, a: destino, aQ: giroEnLaBalsa(t, ya ? undefined : desdeQ) }];
    });
  };

  /** Une los troncos al del medio con juntas fijas. (No de varios cuerpos: a esos Rapier no les aplica los empujes
   * del agua y la balsa se hundiría.) */
  const unir = () => {
    const delMedio = losTroncos()[raiz];
    if (!delMedio) return;
    const qr = new THREE.Quaternion().copy(delMedio.cuerpo.rotation());
    const tr = new THREE.Vector3().copy(delMedio.cuerpo.translation());
    const inversa = qr.clone().invert();
    for (const v of viaje) {
      if (v.tronco === delMedio) continue;
      const ancla = new THREE.Vector3().copy(v.tronco.cuerpo.translation()).sub(tr).applyQuaternion(inversa);
      const relativo = inversa.clone().multiply(new THREE.Quaternion().copy(v.tronco.cuerpo.rotation()));
      const junta = mundo.createImpulseJoint(
        rapier.JointData.fixed(ancla, relativo, CERO, { x: 0, y: 0, z: 0, w: 1 }),
        delMedio.cuerpo,
        v.tronco.cuerpo,
        true,
      );
      junta.setContactsEnabled(false);
    }
    estado = "amarrada";
    for (const aviso of avisos) aviso();
  };

  /** El marco de la balsa en el mundo: el del tronco del medio, llevado al de la caja. */
  const marco = () => {
    const delMedio = losTroncos()[raiz];
    const t = new THREE.Vector3().copy(delMedio?.cuerpo.translation() ?? centro);
    const qr = new THREE.Quaternion().copy(delMedio?.cuerpo.rotation() ?? giro);
    const q = qr.multiply((delMedio && ajustes.get(delMedio)?.clone().invert()) ?? new THREE.Quaternion());
    const lugar = lugares[raiz] ?? new THREE.Vector3();
    return { centro: t.sub(lugar.clone().applyQuaternion(q)), giro: q };
  };

  const local = new THREE.Vector3();
  /** El punto en el marco de la balsa (0 en el centro de su caja). */
  const enLaBalsa = (q: THREE.Vector3Like) => {
    const m = marco();
    return local.set(q.x, q.y, q.z).sub(m.centro).applyQuaternion(m.giro.invert());
  };
  const encima = (q: THREE.Vector3Like) => {
    if (estado !== "amarrada") return false;
    const l = enLaBalsa(q);
    const y = l.y - medio.y;
    return (
      Math.abs(l.dot(largo)) <= mitad + 0.15 &&
      Math.abs(l.dot(ancho)) <= medioAncho + 0.15 &&
      y > a.bordo[0] &&
      y < a.bordo[1]
    );
  };

  // La imagen de lo que pone la balsa (las amarras y los remos): sigue al tronco del medio y se ve amarrada
  const imagen = new THREE.Group();
  imagen.name = `${p.nombre} amarras`;
  imagen.visible = false;
  const soga = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const remos: { pivote: THREE.Group; lado: number; fase: number; rema: boolean }[] = [];
  let enLaImagen = false;
  const armarImagen = () => {
    if (enLaImagen) return;
    const delMedio = losTroncos()[raiz];
    if (!delMedio) return;
    enLaImagen = true;
    // Del marco de la balsa al del tronco del medio
    const aRaiz = ajustes.get(delMedio)?.clone() ?? new THREE.Quaternion();
    const lugarRaiz = lugares[raiz] ?? new THREE.Vector3();
    const enRaiz = (v: THREE.Vector3) => v.clone().sub(lugarRaiz).applyQuaternion(aRaiz);
    const giroRaiz = (q: THREE.Quaternion) => aRaiz.clone().multiply(q);
    const atravesado = new THREE.Quaternion().setFromUnitVectors(ARRIBA, ancho);
    for (const s of [-0.62, 0.62]) {
      const amarra = new THREE.Mesh(
        new THREE.CylinderGeometry(medio.y * 0.55, medio.y * 0.55, medioAncho * 2.04, 10, 1, true),
        soga,
      );
      amarra.position.copy(enRaiz(largo.clone().multiplyScalar(s * mitad)));
      amarra.quaternion.copy(giroRaiz(atravesado));
      amarra.scale.set(1, 1, 1.05);
      imagen.add(amarra);
    }
    // Los remos: un palo que sale por la borda de cada lado, con la pala en el agua; gira en su horquilla
    for (const lado of [-1, 1]) {
      const pivote = new THREE.Group();
      pivote.position.copy(
        enRaiz(
          largo
            .clone()
            .multiplyScalar(a.remo * mitad)
            .addScaledVector(derecha, lado * (medioAncho + 0.04))
            .addScaledVector(ARRIBA, medio.y + 0.1),
        ),
      );
      pivote.quaternion.copy(giroRaiz(new THREE.Quaternion()));
      const remo = new THREE.Group();
      const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), h.madera);
      // El palo, de la manija (adentro, a la altura de las manos) a la pala (afuera, en el agua)
      const manija = derecha
        .clone()
        .multiplyScalar(-lado * 0.45)
        .addScaledVector(ARRIBA, 0.65);
      const pala = derecha
        .clone()
        .multiplyScalar(lado * 1.1)
        .addScaledVector(ARRIBA, -0.55);
      palo.position.copy(manija.clone().add(pala).multiplyScalar(0.5));
      palo.quaternion.setFromUnitVectors(ARRIBA, pala.clone().sub(manija).normalize());
      const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.2), h.madera);
      hoja.position.copy(pala);
      hoja.quaternion.copy(palo.quaternion);
      const horquilla = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 6, 10), h.oscuro);
      horquilla.quaternion.setFromUnitVectors(EJE_Z, largo);
      remo.add(palo, hoja);
      pivote.add(remo, horquilla);
      imagen.add(pivote);
      remos.push({ pivote: remo, lado, fase: 0, rema: false });
    }
    h.mover(delMedio.cuerpo, imagen);
  };

  /** Si los troncos están en la balsa, uno al lado del otro (también en el invitado, que no amarra nada). */
  const enFormacion = () => {
    const lista = losTroncos();
    const delMedio = lista[raiz];
    if (!delMedio) return false;
    const m = marco();
    const inversa = m.giro.clone().invert();
    return lista.every((t) => {
      const l = new THREE.Vector3().copy(t.cuerpo.translation()).sub(m.centro).applyQuaternion(inversa);
      return lugares.some((lugar) => Math.hypot(l.x - lugar.x, l.z - lugar.z) < 0.08 && Math.abs(l.y) < 0.08);
    });
  };

  h.antes((munecos, entradas) => {
    const lista = losTroncos();
    if (estado === "amarrando") {
      paso++;
      // Primero se juntan donde están (o en su lugar, si están flotando ahí); después, si se amarraron en tierra,
      // la balsa baja entera al agua hasta su lugar
      const juntar = suave(paso / a.amarrar);
      const botar = suave((paso - a.amarrar) / a.botar);
      for (const v of viaje) {
        const c = v.tronco.cuerpo;
        const donde = v.medio
          ? paso <= a.amarrar
            ? v.desde.clone().lerp(v.medio, juntar)
            : v.medio.clone().lerp(v.a, botar)
          : v.desde.clone().lerp(v.a, juntar);
        c.setTranslation(donde, true);
        c.setRotation(v.desdeQ.clone().slerp(v.aQ, juntar), true);
        c.setLinvel(CERO, true);
        c.setAngvel(CERO, true);
      }
      if (paso >= a.amarrar + (viaje.some((v) => v.medio) ? a.botar : 0)) unir();
      return;
    }
    if (estado !== "amarrada") return;
    const raizCuerpo = lista[raiz]?.cuerpo;
    if (!raizCuerpo) return;
    const m = marco();
    const adelante = largo.clone().applyQuaternion(m.giro).setY(0).normalize();
    const aLaDerecha = derecha.clone().applyQuaternion(m.giro).setY(0).normalize();
    const v = raizCuerpo.linvel();
    const w = raizCuerpo.angvel();
    const com = raizCuerpo.worldCom();

    // A bordo: la balsa lleva al que va encima (le suma lo que el andar le quitaría por ir con ella)
    aBordo = 0;
    const nuevos: [0 | 1 | null, 0 | 1 | null] = [null, null];
    munecos.forEach((mu, i) => {
      const pelvis = mu.partes.pelvis.translation();
      if (!encima(pelvis)) return;
      aBordo++;
      llevarABordo(mu, { v, w, com }, entradas?.[i], a.agarre);
      // Remar: de pie junto a su remo, con los brazos alzados (con el botón de agarrar)
      if (mu.estado !== "de pie" || i > 1) return;
      const e = entradas?.[i];
      if (!e?.brazoIzquierdo && !e?.brazoDerecho) return;
      const l = enLaBalsa(pelvis);
      const lado = l.dot(derecha);
      if (Math.abs(lado) < 0.1 || Math.abs(l.dot(largo) - a.remo * mitad) > a.alcance) return;
      const cual = lado < 0 ? 0 : 1;
      nuevos[cual] ??= i as 0 | 1;
    });
    remeros = nuevos;
    // Cada remo empuja hacia adelante desde su borda: solo, hace girar la balsa
    nuevos.forEach((remero, cual) => {
      if (remero === null) return;
      const s = cual === 0 ? -1 : 1;
      const punto = m.centro
        .clone()
        .addScaledVector(adelante, a.remo * mitad)
        .addScaledVector(aLaDerecha, s * (medioAncho + 0.1));
      raizCuerpo.applyImpulseAtPoint(
        { x: adelante.x * p.remo * PASO, y: 0, z: adelante.z * p.remo * PASO },
        { x: punto.x, y: com.y, z: punto.z },
        true,
      );
    });
  });

  // Si se amarró en el anfitrión, el invitado lo ve en la foto: troncos uno al lado del otro
  let remoSimulado = false;
  h.despues(() => {
    remoSimulado = true;
    if (estado !== "suelta") return;
    const lista = losTroncos();
    const listos = lista.every((t) => {
      if (t.cargadores > 0) return false;
      const l = new THREE.Vector3().copy(t.cuerpo.translation()).sub(centro).applyQuaternion(giro.clone().invert());
      return (
        Math.abs(l.x) < medio.x + p.astillero && Math.abs(l.z) < medio.z + p.astillero && Math.abs(l.y) < a.flotando
      );
    });
    if (listos) balsa.amarrar();
  });
  let velocidadAntes = new THREE.Vector3();
  h.guardar(() => {
    if (!troncos) losTroncos();
    const formada = estado === "amarrada" || (!remoSimulado && enFormacion());
    if (formada) armarImagen();
    imagen.visible = formada;
    const delMedio = losTroncos()[raiz]?.cuerpo;
    if (!delMedio) return;
    const v = new THREE.Vector3().copy(delMedio.translation());
    const avance = v.clone().sub(velocidadAntes).dot(largo.clone().applyQuaternion(marco().giro)) / PASO;
    velocidadAntes = v;
    for (const remo of remos) {
      // En el anfitrión rema el que rema; en el invitado, los remos se mueven si la balsa avanza
      remo.rema = remoSimulado ? remeros[remo.lado < 0 ? 0 : 1] !== null : avance > 0.15;
      if (remo.rema) remo.fase += PASO * 5;
    }
  });
  h.dibujar(() => {
    for (const remo of remos) {
      // El remo va y viene alrededor de la horquilla (a lo largo de la balsa) y sube la pala al volver
      const golpe = remo.rema ? Math.sin(remo.fase) : 0;
      remo.pivote.quaternion
        .setFromAxisAngle(ARRIBA, golpe * 0.5 * remo.lado)
        .multiply(new THREE.Quaternion().setFromAxisAngle(largo, Math.max(0, Math.cos(remo.fase)) * 0.25 * remo.lado));
    }
  });

  const balsa: Balsa = {
    cual: "balsa",
    nombre: p.nombre,
    get troncos() {
      return losTroncos();
    },
    get estado() {
      return estado;
    },
    get remeros() {
      return remeros;
    },
    get aBordo() {
      return aBordo;
    },
    casa: { centro: centro.clone().addScaledVector(ARRIBA, medio.y), giro: giro.clone() },
    donde() {
      const m = marco();
      return { centro: m.centro.addScaledVector(ARRIBA, medio.y), giro: m.giro };
    },
    encima,
    amarrar(ya = false, astillero) {
      if (estado !== "suelta" && !ya) return;
      if (estado === "amarrada") return;
      planear(ya, astillero);
      if (ya) {
        for (const v of viaje) devolver(v.tronco.cuerpo, v.a, v.aQ);
        unir();
      } else {
        estado = "amarrando";
        paso = 0;
      }
    },
    volver() {
      if (estado !== "amarrada") return;
      const lista = losTroncos();
      lista.forEach((t) => {
        const v = viaje.find((x) => x.tronco === t);
        if (!v) return;
        devolver(t.cuerpo, v.a.clone().setY(centro.y), giroEnLaBalsa(t, v.aQ));
      });
    },
    alAmarrar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
  return balsa;
}

// ── El tendedero ────────────────────────────────────────────────────────────────────────────────────────────

export interface Tendedero {
  readonly cual: "tendedero";
  readonly nombre: string;
  /** La polea (cinemática), con la manija que se agarra. */
  readonly polea: RAPIER.RigidBody;
  /** Dónde va la polea: 0 arriba, 1 al final de la cuerda. */
  readonly recorrido: number;
  /** Cuántos muñecos cuelgan de la manija (agarrados y en el aire). */
  readonly colgados: number;
  /** La polea, arriba y quieta. */
  volver(): void;
}

export function armarTendedero(h: Herramientas, p: Extract<PiezaDeLaPozaEnPlano, { cual: "tendedero" }>): Tendedero {
  const { rapier, mundo } = h;
  const a = AJUSTES_POZA.tendedero;
  const { medio, giro } = p.caja;
  const enX = medio.x >= medio.z;
  const mitad = enX ? medio.x : medio.z;
  const a0 = h.enElMundo(p, enX ? -mitad : 0, medio.y, enX ? 0 : -mitad);
  const a1 = h.enElMundo(p, enX ? mitad : 0, -medio.y, enX ? 0 : mitad);
  const largo = a0.distanceTo(a1);
  const direccion = a1.clone().sub(a0).normalize();
  const bajada = -direccion.y * -GRAVEDAD;
  const aLoAncho = (enX ? EJE_Z : EJE_X).clone().applyQuaternion(giro);
  /** La manija, colgando debajo de la polea en `s` metros de cuerda. */
  const manijaEn = (s: number) => a0.clone().addScaledVector(direccion, s).addScaledVector(ARRIBA, -p.manija);

  const polea = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(...manijaEn(0).toArray())
      .setRotation(giro),
  );
  const travesano = new THREE.Quaternion().setFromUnitVectors(ARRIBA, enX ? EJE_Z : EJE_X);
  const colisionador = mundo.createCollider(
    rapier.ColliderDesc.capsule(a.manija, 0.04)
      .setRotation(travesano)
      .setCollisionGroups(GRUPOS_POZA)
      .setSolverGroups(SIN_EMPUJAR),
    polea,
  );
  // La polea: una ruedita en la cuerda, el palo que baja hasta la manija y la manija a lo ancho
  const imagenPolea = new THREE.Group();
  imagenPolea.name = p.nombre;
  const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), h.oscuro);
  rueda.position.y = p.manija;
  rueda.quaternion.setFromUnitVectors(EJE_Z, enX ? EJE_Z : EJE_X);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, p.manija, 5), h.oscuro);
  palo.position.y = p.manija / 2;
  const manija = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, a.manija * 2, 4, 8), h.madera);
  manija.quaternion.copy(travesano);
  imagenPolea.add(rueda, palo, manija);
  h.mover(polea, imagenPolea);
  h.solida({ nombre: p.nombre, objeto: imagenPolea, cuerpo: polea, colisionador });

  // La cuerda y los dos postes (hasta 3 m más abajo de cada punta), y la ropa colgada en un hilo al lado
  const fija = new THREE.Group();
  fija.name = `${p.nombre} cuerda`;
  const cuerda = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, largo, 5), h.oscuro);
  cuerda.position.copy(a0.clone().add(a1).multiplyScalar(0.5));
  cuerda.quaternion.setFromUnitVectors(ARRIBA, direccion);
  fija.add(cuerda);
  for (const punta of [a0, a1]) {
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 8), h.madera);
    poste.position.copy(punta).addScaledVector(ARRIBA, -1.5);
    const cruz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.8), h.madera);
    cruz.position.copy(punta).addScaledVector(ARRIBA, 0.05);
    cruz.quaternion.setFromUnitVectors(EJE_Z, aLoAncho);
    fija.add(poste, cruz);
  }
  const hilo = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, largo, 4), h.oscuro);
  hilo.position.copy(cuerda.position).addScaledVector(aLoAncho, p.hilo);
  hilo.quaternion.copy(cuerda.quaternion);
  if (p.ropa > 0) fija.add(hilo);
  const prendas: THREE.Object3D[] = [];
  const azar = crearAzar(p.nombre.length * 31 + Math.round(a0.x * 7));
  const telas = [
    materialTela(COLORES.silueta, { repetir: 1, pelusa: false }),
    materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false }),
  ];
  for (let i = 0; i < p.ropa; i++) {
    const t = (i + 1) / (p.ropa + 1);
    const prenda = crearPrenda(azar, telas[i % 2] ?? h.oscuro);
    prenda.position.copy(a0.clone().lerp(a1, t)).addScaledVector(aLoAncho, p.hilo);
    prenda.quaternion.setFromUnitVectors(EJE_X, new THREE.Vector3(direccion.x, 0, direccion.z).normalize());
    prendas.push(prenda);
    fija.add(prenda);
  }
  h.escena.add(fija);

  let s = 0;
  let u = 0;
  let colgados = 0;
  h.antes((munecos) => {
    // Cuelga el que la tiene agarrada en el aire; con las dos manos ya arranca (se larga desde la orilla)
    let agarran = 0;
    let dos = false;
    colgados = 0;
    for (const m of munecos) {
      const manos = manosEn(m, polea);
      if (manos === 0) continue;
      agarran++;
      if (manos === 2) dos = true;
      if (!m.enElSuelo) colgados++;
    }
    if (colgados > 0 || dos) {
      u += bajada * (1 - a.rozamiento) * PASO;
      u = Math.min(u, p.velocidad, Math.sqrt(2 * a.frenar * Math.max(0, largo - s)));
    } else if (agarran > 0) u = 0;
    else u = s > 0 ? -a.volver : 0;
    s = limitar(s + u * PASO, 0, largo);
    if (s === 0 && u < 0) u = 0;
    polea.setNextKinematicTranslation(manijaEn(s));
  });
  // La ropa se mece un poco (con los pasos: en las capturas sale igual siempre)
  let pasos = 0;
  h.guardar(() => {
    pasos++;
  });
  h.dibujar((alfa) => {
    const t = (pasos - 1 + alfa) * PASO * 1.3;
    prendas.forEach((prenda, i) => {
      prenda.rotation.x = 0.08 * Math.sin(t + i * 1.7);
    });
  });
  return {
    cual: "tendedero",
    nombre: p.nombre,
    polea,
    get recorrido() {
      return s / largo;
    },
    get colgados() {
      return colgados;
    },
    volver() {
      s = 0;
      u = 0;
      polea.setTranslation(manijaEn(0), true);
      polea.setNextKinematicTranslation(manijaEn(0));
    },
  };
}

/** Una prenda colgada de un hilo (una camisa, una sábana, un pantalón): un recorte de tela que cuelga hacia −y. */
function crearPrenda(azar: () => number, material: THREE.Material): THREE.Object3D {
  const cual = Math.floor(azar() * 3);
  const g = new THREE.Group();
  const ancho = 0.45 + azar() * 0.25;
  const forma = new THREE.Shape();
  if (cual === 0) {
    // Una camisa: hombros, mangas y faldón
    forma.moveTo(-ancho / 2, 0);
    forma.lineTo(-ancho / 2 - 0.18, -0.12);
    forma.lineTo(-ancho / 2 - 0.1, -0.28);
    forma.lineTo(-ancho / 2 + 0.02, -0.2);
    forma.lineTo(-ancho / 2 + 0.04, -0.62);
    forma.lineTo(ancho / 2 - 0.04, -0.62);
    forma.lineTo(ancho / 2 - 0.02, -0.2);
    forma.lineTo(ancho / 2 + 0.1, -0.28);
    forma.lineTo(ancho / 2 + 0.18, -0.12);
    forma.lineTo(ancho / 2, 0);
  } else if (cual === 1) {
    // Un pantalón
    forma.moveTo(-ancho / 2, 0);
    forma.lineTo(-ancho / 2 - 0.03, -0.75);
    forma.lineTo(-0.04, -0.75);
    forma.lineTo(0, -0.25);
    forma.lineTo(0.04, -0.75);
    forma.lineTo(ancho / 2 + 0.03, -0.75);
    forma.lineTo(ancho / 2, 0);
  } else {
    // Una sábana, con el borde de abajo ondulado
    const largo = 0.7 + azar() * 0.3;
    forma.moveTo(-ancho, 0);
    forma.lineTo(-ancho, -largo);
    for (let i = 1; i <= 6; i++) forma.lineTo(-ancho + (i * ancho * 2) / 6, -largo + (i % 2) * 0.05);
    forma.lineTo(ancho, 0);
  }
  forma.closePath();
  const tela = new THREE.Mesh(new THREE.ShapeGeometry(forma), material);
  (tela.material as THREE.Material).side = THREE.DoubleSide;
  g.add(tela);
  // Las pinzas
  const pinza = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.025), materialOjo());
  for (const x of [-ancho / 2.2, ancho / 2.2]) {
    const pz = pinza.clone();
    pz.position.set(x, -0.02, 0);
    g.add(pz);
  }
  return g;
}

// ── La batea ────────────────────────────────────────────────────────────────────────────────────────────────

export interface Batea {
  readonly cual: "batea";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** Si tiene sus pepitas (no se botó). */
  readonly llena: boolean;
  /** Cuántos muñecos la tienen agarrada. */
  readonly cargadores: number;
  /** Cuánto está ladeada (radianes). */
  readonly ladeo: number;
  /** Cuántas veces se botó. */
  readonly botadas: number;
  /** La pone llena en su lugar, quieta. */
  volver(): void;
  /** Llama a `aviso` cada vez que se bota. Devuelve cómo dejar de escuchar. */
  alBotar(aviso: () => void): () => void;
}

export function armarBatea(h: Herramientas, p: Extract<PiezaDeLaPozaEnPlano, { cual: "batea" }>): Batea {
  const { rapier, mundo } = h;
  const a = AJUSTES_POZA.batea;
  const { centro, medio, giro } = p.caja;
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(a.amortiguar));
  const colisionador = mundo.createCollider(
    // Los muñecos la atraviesan (como al tronco) pero la agarran igual: si no, los brazos que suben a agarrarla le
    // pegarían por debajo y la voltearían
    // El peso va abajo (las pepitas en el fondo): agarrada de las puntas cuelga derecha, no se da vuelta
    rapier.ColliderDesc.cuboid(medio.x, medio.y, medio.z)
      .setMassProperties(
        p.masa,
        { x: 0, y: -medio.y - a.lastre, z: 0 },
        {
          x: (p.masa * (medio.y ** 2 + medio.z ** 2)) / 3,
          y: (p.masa * (medio.x ** 2 + medio.z ** 2)) / 3,
          z: (p.masa * (medio.x ** 2 + medio.y ** 2)) / 3,
        },
        { x: 0, y: 0, z: 0, w: 1 },
      )
      .setFriction(0.9)
      .setCollisionGroups(GRUPOS_SUELTO),
    cuerpo,
  );
  // La imagen: una batea ovalada, honda en el medio, con el borde grueso y las pepitas adentro
  const objeto = new THREE.Group();
  objeto.name = p.nombre;
  const perfil: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    perfil.push(new THREE.Vector2(0.02 + t * 0.98, -medio.y + medio.y * 2 * t ** 1.6));
  }
  perfil.push(new THREE.Vector2(1.04, medio.y), new THREE.Vector2(0.97, medio.y * 0.85));
  const cuenco = new THREE.Mesh(new THREE.LatheGeometry(perfil, 20).scale(medio.x, 1, medio.z), h.madera);
  (cuenco.material as THREE.Material).side = THREE.DoubleSide;
  objeto.add(cuenco);
  const pepitas = new THREE.Group();
  const azar = crearAzar(17);
  const pepita = new THREE.IcosahedronGeometry(0.03, 0);
  const brillo = materialOjo();
  for (let i = 0; i < p.pepitas; i++) {
    const r = Math.sqrt(azar()) * 0.55;
    const ang = azar() * Math.PI * 2;
    const m = new THREE.Mesh(pepita, brillo);
    m.position.set(Math.cos(ang) * r * medio.x, -medio.y * 0.55 + azar() * 0.03, Math.sin(ang) * r * medio.z);
    m.rotation.set(azar() * 3, azar() * 3, 0);
    m.scale.setScalar(0.8 + azar() * 0.6);
    pepitas.add(m);
  }
  objeto.add(pepitas);
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  const gotas = crearGotas(h.escena);

  let llena = true;
  let botadas = 0;
  let cargadores = 0;
  let vacia = 0;
  let quieta = 0;
  const avisos = new Set<() => void>();
  const arriba = new THREE.Vector3();
  const ladeoDe = () => {
    arriba.set(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(cuerpo.rotation()));
    return Math.acos(limitar(arriba.y, -1, 1));
  };
  const enSuLugar = () => {
    const t = cuerpo.translation();
    return Math.hypot(t.x - centro.x, t.y - centro.y, t.z - centro.z) < 0.03;
  };
  const derramar = () => {
    const t = cuerpo.translation();
    for (let i = 0; i < p.pepitas; i++)
      gotas.gota(
        t,
        { x: Math.cos(i * 2.4) * 1.2, y: 1.5 + (i % 3) * 0.4, z: Math.sin(i * 2.4) * 1.2 },
        0.6 + (i % 4) * 0.1,
      );
  };
  const batea: Batea = {
    cual: "batea",
    nombre: p.nombre,
    cuerpo,
    get llena() {
      return llena;
    },
    get cargadores() {
      return cargadores;
    },
    get ladeo() {
      return ladeoDe();
    },
    get botadas() {
      return botadas;
    },
    volver() {
      devolver(cuerpo, centro, giro);
      llena = true;
      vacia = 0;
      quieta = 0;
    },
    alBotar(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },
  };
  h.despues((munecos, fuera) => {
    cargadores = munecos.filter((m) => manosEn(m, cuerpo) > 0).length;
    if (llena && (ladeoDe() > p.derrame || fuera(cuerpo.translation()))) {
      llena = false;
      botadas++;
      for (const aviso of avisos) aviso();
    }
    // Botada, al rato vuelve llena; tirada lejos sin que nadie la toque, también
    vacia = llena || cargadores > 0 ? 0 : vacia + PASO;
    const v = cuerpo.linvel();
    quieta = cargadores === 0 && !enSuLugar() && Math.hypot(v.x, v.y, v.z) < 0.05 ? quieta + PASO : 0;
    if (vacia > a.volver || quieta > a.abandonada || fuera(cuerpo.translation())) batea.volver();
  });
  // La imagen: las pepitas se ven mientras está llena (en el invitado: hasta que se ladea, y de nuevo al volver)
  let vista = true;
  let segundos = 0;
  h.guardar(() => {
    segundos += PASO;
    const ahora = ladeoDe() <= p.derrame && (vista || enSuLugar());
    if (vista && !ahora) derramar();
    vista = ahora;
    pepitas.visible = vista;
  });
  h.dibujar((alfa) => gotas.mover(segundos - PASO + alfa * PASO));
  return batea;
}

// ── La piedra ───────────────────────────────────────────────────────────────────────────────────────────────

export interface Piedra {
  readonly cual: "piedra";
  readonly nombre: string;
  readonly cuerpo: RAPIER.RigidBody;
  /** La pone donde estaba al empezar, quieta. Pasa sola si cae al vacío. */
  volver(): void;
}

export function armarPiedra(h: Herramientas, p: Extract<PiezaDeLaPozaEnPlano, { cual: "piedra" }>): Piedra {
  const { rapier, mundo } = h;
  const { centro, medio, giro } = p.caja;
  const radio = Math.min(medio.x, medio.y, medio.z);
  const cuerpo = mundo.createRigidBody(h.dinamico(centro, giro).setAngularDamping(2.5).setLinearDamping(0.3));
  // Para el agua: pesa como piedra, aunque la bola sea grande (agua.ts lee la densidad del `userData`)
  cuerpo.userData = { densidad: p.densidad };
  const colisionador = mundo.createCollider(rapier.ColliderDesc.ball(radio).setMass(p.masa).setFriction(1), cuerpo);
  // Una bola de río, gastada y un poco abollada
  const azar = crearAzar(p.nombre.length * 13 + 5);
  const geometria = new THREE.IcosahedronGeometry(radio, 3);
  const v = new THREE.Vector3();
  const posiciones = geometria.getAttribute("position");
  for (let i = 0; i < posiciones.count; i++) {
    v.fromBufferAttribute(posiciones, i);
    const bollo = 1 + 0.05 * Math.sin(v.x * 9 + azar()) * Math.cos(v.z * 7);
    v.multiplyScalar(bollo);
    posiciones.setXYZ(i, v.x, v.y, v.z);
  }
  geometria.computeVertexNormals();
  const objeto = new THREE.Mesh(
    juntar([geometria]),
    materialTela(COLORES.roca, { repetir: 1, relieve: 2, pelusa: false }),
  );
  objeto.name = p.nombre;
  h.mover(cuerpo, objeto);
  h.solida({ nombre: p.nombre, objeto, cuerpo, colisionador });
  const piedra: Piedra = { cual: "piedra", nombre: p.nombre, cuerpo, volver: () => devolver(cuerpo, centro, giro) };
  h.despues((_, fuera) => {
    if (fuera(cuerpo.translation())) piedra.volver();
  });
  return piedra;
}

/** Las manos de un muñeco que agarran ese cuerpo, para las pruebas y el guion. */
export function agarraCon(m: Muneco, cuerpo: RAPIER.RigidBody): number {
  return BRAZOS.filter((b) => m.agarrado(b)?.parent()?.handle === cuerpo.handle).length;
}
export { alzada };

/** La pepita de oro del secreto de la poza (la pone el guion en el hoyo): clara como los ojos, con un brillito (el
 * único color del juego son los pañuelos). */
export function crearPepita(): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "pepita";
  grupo.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0).scale(1.3, 0.8, 1), materialOjo()));
  const brillo = new THREE.PointLight(COLORES.ojo, 1.2, 1.6, 2);
  brillo.position.y = 0.25;
  grupo.add(brillo);
  return grupo;
}
