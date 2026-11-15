// El Caleuche (TU-47): el barco fantasma de Chiloé, que de noche anda con todas las luces prendidas y música a bordo.
// Acá no asusta: anda de fiesta. Sale de un nodo `tipo: pieza`, `pieza: caleuche` (formato-minga.ts), y su caja es el
// casco, con la cubierta arriba, la proa hacia su −x y la popa hacia su +x.
//
//   fondeado   espera, con los faroles prendidos y la tripulación quieta, a que suban los invitados.
//   de fiesta  con los dos a bordo (un segundo), suena la música: `compases` compases en que la cubierta se mece de
//              babor a estribor, cada vez más, hasta `rolido`. Si uno se sale de la cubierta (se cae al agua, se cuelga
//              de la borda), se corta la música y, cuando los dos vuelven a estar a bordo, empieza de nuevo.
//   contento   terminó la canción con los dos a bordo: deja de mecerse y baja la plancha de la popa hasta el muelle.
//
// El casco y la plancha son cinemáticos: los mueve esta pieza y viajan en la foto. La tripulación, los faroles y las
// velas son imagen. El invitado no simula: sabe que hay fiesta porque ve mecerse el casco, y que el Caleuche está
// contento porque ve la plancha abajo.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialOjo, materialTela } from "../imagen";
import { PASO } from "../motor/bucle";
import type { PiezaDeLaMingaEnPlano } from "./formato-minga";
import type { Herramientas } from "./piezas";

const ARRIBA = new THREE.Vector3(0, 1, 0);
const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const limitar = (x: number, min: number, max: number) => Math.min(max, Math.max(min, x));

/** Los números del Caleuche que no se ponen desde Blender. */
export const AJUSTES_CALEUCHE = {
  /** Las bordas: alto de las de los costados y de las de proa y popa, y su grueso (m). */
  borda: { costado: 0.5, puntas: 0.9, grueso: 0.12 },
  /** El portalón de la borda de adelante (por donde llega el ancla) y la abertura de la popa (la plancha), anchos (m). */
  portalon: 1.4,
  abertura: 1.1,
  /** A bordo: la pelvis entre tanto y tanto sobre la cubierta (m), y hasta tanto afuera de la borda. */
  bordo: [-0.15, 1.4],
  borde: 0.1,
  /** Con los dos a bordo, cuánto espera para que empiece la música (s). */
  pausa: 1,
  /** El rolido empieza en esta parte del máximo y crece hasta el final de la canción. */
  rolidoInicial: 0.35,
  /** Sin música, qué tan rápido se aquieta el casco (1/s). */
  aquietar: 2,
  /** La plancha: cuánto tarda en bajar (s), su ancho y su grueso (m). */
  plancha: { bajar: 2, ancho: 1, grueso: 0.08 },
  /** Los palos: dónde van a lo largo del casco (de 0, la proa, a 1, la popa), su alto sobre la cubierta y su radio. */
  palos: { donde: [0.28, 0.55, 0.8], alto: 6, radio: 0.13 },
} as const;

export type EstadoCaleuche = "fondeado" | "de fiesta" | "contento";

export interface Caleuche {
  readonly cual: "caleuche";
  readonly nombre: string;
  /** El casco (cinemático): se mece con la música. */
  readonly cuerpo: RAPIER.RigidBody;
  /** La plancha de la popa (cinemática): parada tapa la abertura; baja cuando el Caleuche queda contento. */
  readonly plancha: RAPIER.RigidBody;
  readonly estado: EstadoCaleuche;
  /** Cuántos compases van de la canción, de cuántos. */
  readonly compas: number;
  readonly compases: number;
  /** Cuánto está mecido el casco ahora (radianes, + hacia su +z). */
  readonly rolido: number;
  /** Cuántos muñecos están a bordo, y cuántas veces se cortó la música. */
  readonly aBordo: number;
  readonly cortes: number;
  /** Si ese punto (una pelvis) está a bordo: sobre la cubierta, entre las bordas. */
  aBordoDe(p: THREE.Vector3Like): boolean;
  /** Avisos: se cortó la música, y terminó la canción (queda contento). Devuelven cómo dejar de escuchar. */
  alCortar(aviso: () => void): () => void;
  alContento(aviso: () => void): () => void;
  /** Lo deja contento, quieto y con la plancha abajo (al retomar). */
  contentar(): void;
}

export function armarCaleuche(h: Herramientas, p: Extract<PiezaDeLaMingaEnPlano, { cual: "caleuche" }>): Caleuche {
  const { rapier, mundo } = h;
  const a = AJUSTES_CALEUCHE;
  const { centro, medio, giro } = p.caja;
  const mx = medio.x;
  const mz = medio.z;
  const my = medio.y;

  // El casco: la cubierta arriba de la caja, las bordas y los palos. Gira (se mece) alrededor de su x, por su centro
  const cuerpo = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(centro.x, centro.y, centro.z)
      .setRotation({ x: giro.x, y: giro.y, z: giro.z, w: giro.w }),
  );
  const colisionador = mundo.createCollider(rapier.ColliderDesc.cuboid(mx, my, mz).setFriction(1), cuerpo);
  const caja = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    mundo.createCollider(
      rapier.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
        .setTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
        .setFriction(0.8),
      cuerpo,
    );
  const g = a.borda.grueso;
  const portalon = -mx + p.portalon;
  // La borda de adelante (+z), abierta en el portalón; la de atrás, entera
  caja(-mx, portalon - a.portalon / 2, my, my + a.borda.costado, mz - g, mz);
  caja(portalon + a.portalon / 2, mx, my, my + a.borda.costado, mz - g, mz);
  caja(-mx, mx, my, my + a.borda.costado, -mz, -mz + g);
  // Proa entera; popa abierta donde va la plancha
  caja(-mx, -mx + g, my, my + a.borda.puntas, -mz, mz);
  caja(mx - g, mx, my, my + a.borda.puntas, -mz, -a.abertura / 2);
  caja(mx - g, mx, my, my + a.borda.puntas, a.abertura / 2, mz);
  for (const f of a.palos.donde) {
    mundo.createCollider(
      rapier.ColliderDesc.cylinder(a.palos.alto / 2, a.palos.radio).setTranslation(
        -mx + 2 * mx * f,
        my + a.palos.alto / 2,
        0,
      ),
      cuerpo,
    );
  }
  const imagen = crearImagenCaleuche(h.madera, h.oscuro, medio, p.portalon);
  imagen.grupo.name = p.nombre;
  h.mover(cuerpo, imagen.grupo);
  h.solida({ nombre: p.nombre, objeto: imagen.grupo, cuerpo, colisionador });

  // La plancha: con la bisagra en el borde de la popa, sobre la cubierta. Parada tapa la abertura
  const bajada = Math.atan2(p.bajada, p.plancha);
  const giroDelCasco = new THREE.Quaternion();
  /** Dónde va la plancha con el casco así y abierta tanto (0 parada, 1 abajo). */
  const poseDePlancha = (casco: THREE.Quaternion, cascoEn: THREE.Vector3Like, f: number) => {
    const angulo = Math.PI / 2 + (-bajada - Math.PI / 2) * f;
    // En el marco del casco: gira alrededor de su z en la bisagra; el centro de la tabla, a medio largo
    const giroLocal = new THREE.Quaternion().setFromAxisAngle(EJE_Z, angulo);
    const centroLocal = new THREE.Vector3(p.plancha / 2, a.plancha.grueso / 2, 0)
      .applyQuaternion(giroLocal)
      .add(new THREE.Vector3(mx, my, 0));
    const q = casco.clone().multiply(giroLocal);
    const donde = centroLocal.applyQuaternion(casco).add(cascoEn);
    return { donde, q };
  };
  const inicio = poseDePlancha(giro, centro, 0);
  const plancha = mundo.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(inicio.donde.x, inicio.donde.y, inicio.donde.z)
      .setRotation({ x: inicio.q.x, y: inicio.q.y, z: inicio.q.z, w: inicio.q.w }),
  );
  mundo.createCollider(
    rapier.ColliderDesc.cuboid(p.plancha / 2, a.plancha.grueso / 2, a.plancha.ancho / 2).setFriction(1),
    plancha,
  );
  const imagenPlancha = new THREE.Group();
  imagenPlancha.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(p.plancha, a.plancha.grueso, a.plancha.ancho),
        // Los listones para no resbalar
        ...Array.from({ length: Math.floor(p.plancha / 0.4) }, (_, i) =>
          new THREE.BoxGeometry(0.05, 0.04, a.plancha.ancho).translate(
            -p.plancha / 2 + 0.3 + i * 0.4,
            a.plancha.grueso / 2 + 0.02,
            0,
          ),
        ),
      ]),
      h.madera,
    ),
  );
  h.mover(plancha, imagenPlancha);

  const giroInverso = new THREE.Quaternion();
  const local = new THREE.Vector3();
  const aBordoDe = (q: THREE.Vector3Like) => {
    const t = cuerpo.translation();
    giroInverso.copy(cuerpo.rotation()).invert();
    local.set(q.x - t.x, q.y - t.y, q.z - t.z).applyQuaternion(giroInverso);
    const y = local.y - my;
    return Math.abs(local.x) <= mx + a.borde && Math.abs(local.z) <= mz + a.borde && y > a.bordo[0] && y < a.bordo[1];
  };

  let estado: EstadoCaleuche = "fondeado";
  let tiempo = 0;
  let juntos = 0;
  let rolido = 0;
  let abierta = 0;
  let aBordo = 0;
  let cortes = 0;
  const total = p.compases * p.compas;
  const avisosCortar = new Set<() => void>();
  const avisosContento = new Set<() => void>();
  const ponerCasco = (deUna: boolean) => {
    const q = giro.clone().multiply(new THREE.Quaternion().setFromAxisAngle(EJE_X, rolido));
    const pl = poseDePlancha(q, centro, suave(abierta));
    if (deUna) {
      cuerpo.setRotation(q, true);
      plancha.setTranslation(pl.donde, true);
      plancha.setRotation(pl.q, true);
    } else {
      cuerpo.setNextKinematicRotation(q);
      plancha.setNextKinematicTranslation(pl.donde);
      plancha.setNextKinematicRotation(pl.q);
    }
  };

  h.antes((munecos) => {
    aBordo = munecos.filter((m) => aBordoDe(m.partes.pelvis.translation())).length;
    if (estado === "fondeado") {
      juntos = aBordo >= 2 ? juntos + PASO : 0;
      if (juntos >= a.pausa) {
        estado = "de fiesta";
        tiempo = 0;
      }
    } else if (estado === "de fiesta") {
      if (aBordo < 2) {
        // Uno se salió de la cubierta: se corta la música
        estado = "fondeado";
        juntos = 0;
        cortes++;
        for (const aviso of avisosCortar) aviso();
      } else {
        tiempo += PASO;
        if (tiempo >= total) {
          estado = "contento";
          for (const aviso of avisosContento) aviso();
        }
      }
    }
    if (estado === "de fiesta") {
      const crece = a.rolidoInicial + (1 - a.rolidoInicial) * limitar(tiempo / total, 0, 1);
      // Un vaivén por cada dos compases, que entra suave
      rolido = p.rolido * crece * Math.sin((Math.PI * tiempo) / p.compas) * limitar(tiempo / p.compas, 0, 1);
    } else rolido *= Math.max(0, 1 - a.aquietar * PASO);
    if (estado === "contento") abierta = Math.min(1, abierta + PASO / a.plancha.bajar);
    ponerCasco(false);
  });

  // Lo que ve el invitado: la fiesta por el rolido, y el Caleuche contento por la plancha abajo
  let simulado = false;
  h.despues(() => {
    simulado = true;
  });
  let estadoVisto: EstadoCaleuche = "fondeado";
  let rolidoVisto = 0;
  let reloj = 0;
  h.guardar(() => {
    const q = giroDelCasco.copy(cuerpo.rotation()).premultiply(giro.clone().invert());
    const nuevo = 2 * Math.atan2(q.x, q.w);
    const meciendo = Math.abs(nuevo) > 0.004 || Math.abs(nuevo - rolidoVisto) > 1e-4;
    rolidoVisto = nuevo;
    const ql = giroDelCasco.copy(cuerpo.rotation()).invert().multiply(new THREE.Quaternion().copy(plancha.rotation()));
    const arriba = EJE_X.clone().applyQuaternion(ql).dot(ARRIBA);
    estadoVisto = arriba < 0.5 ? "contento" : meciendo ? "de fiesta" : "fondeado";
    const deFiesta = (simulado ? estado : estadoVisto) === "de fiesta";
    if (deFiesta) reloj += PASO;
  });
  h.dibujar(() => {
    const e = simulado ? estado : estadoVisto;
    imagen.animar(e, reloj, p.compas);
  });

  return {
    cual: "caleuche",
    nombre: p.nombre,
    cuerpo,
    plancha,
    get estado() {
      return simulado ? estado : estadoVisto;
    },
    get compas() {
      return estado === "contento" ? p.compases : estado === "de fiesta" ? Math.floor(tiempo / p.compas) : 0;
    },
    compases: p.compases,
    get rolido() {
      return simulado ? rolido : rolidoVisto;
    },
    get aBordo() {
      return aBordo;
    },
    get cortes() {
      return cortes;
    },
    aBordoDe,
    alCortar(aviso) {
      avisosCortar.add(aviso);
      return () => {
        avisosCortar.delete(aviso);
      };
    },
    alContento(aviso) {
      avisosContento.add(aviso);
      return () => {
        avisosContento.delete(aviso);
      };
    },
    contentar() {
      estado = "contento";
      tiempo = total;
      rolido = 0;
      abierta = 1;
      ponerCasco(true);
    },
  };
}

function suave(t: number) {
  const f = limitar(t, 0, 1);
  return f * f * (3 - 2 * f);
}

/** El Caleuche: el casco negro con la proa en punta (hacia −x), la fila de ojos de buey prendidos, tres palos con
 * velas rotas (claras, como niebla), los faroles colgados entre los palos y la tripulación de fantasmas que baila.
 * En su marco, centrado en su caja (`medio`), la cubierta arriba. */
export function crearImagenCaleuche(
  madera: THREE.Material,
  oscuro: THREE.Material,
  medio: THREE.Vector3Like,
  portalon: number,
) {
  const a = AJUSTES_CALEUCHE;
  const grupo = new THREE.Group();
  const mx = medio.x;
  const my = medio.y;
  const mz = medio.z;
  // El casco: un costado de barco (con la proa en punta y la popa alta), extruido a lo ancho
  const forma = new THREE.Shape();
  forma.moveTo(-mx * 0.92, -my);
  forma.lineTo(mx * 0.95, -my);
  forma.lineTo(mx, my);
  forma.lineTo(-mx, my);
  forma.quadraticCurveTo(-mx - 1.2, my + 0.5, -mx - 1.6, my + 1.2);
  forma.quadraticCurveTo(-mx - 0.9, 0, -mx * 0.92, -my);
  const casco = new THREE.ExtrudeGeometry(forma, { depth: mz * 2, bevelEnabled: false }).translate(0, 0, -mz);
  const tablas = materialCorteza(COLORES.siluetaHonda, { repetir: [6, 2] });
  grupo.add(new THREE.Mesh(casco, tablas));
  // Las bordas, como las que chocan: la de adelante abierta en el portalón y la de la popa donde va la plancha
  const g = a.borda.grueso;
  const tabla = (x0: number, x1: number, alto: number, z0: number, z1: number) =>
    new THREE.BoxGeometry(x1 - x0, alto, z1 - z0).translate((x0 + x1) / 2, my + alto / 2, (z0 + z1) / 2);
  const p0 = -mx + portalon - a.portalon / 2;
  const p1 = -mx + portalon + a.portalon / 2;
  grupo.add(
    new THREE.Mesh(
      juntar([
        tabla(-mx, p0, a.borda.costado, mz - g, mz),
        tabla(p1, mx, a.borda.costado, mz - g, mz),
        tabla(-mx, mx, a.borda.costado, -mz, -mz + g),
        tabla(-mx, -mx + g, a.borda.puntas, -mz, mz),
        tabla(mx - g, mx, a.borda.puntas, -mz, -a.abertura / 2),
        tabla(mx - g, mx, a.borda.puntas, a.abertura / 2, mz),
      ]),
      tablas,
    ),
  );
  // La cubierta (más clara) y el bauprés
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(mx * 2 - 0.1, 0.04, mz * 2 - 0.1).translate(0, my + 0.02, 0),
        new THREE.CylinderGeometry(0.07, 0.1, 4, 6).rotateZ(Math.PI / 2 - 0.3).translate(-mx - 2.2, my + 1.6, 0),
      ]),
      madera,
    ),
  );
  // Los ojos de buey: una fila de luces en cada costado
  const ojos: THREE.BufferGeometry[] = [];
  for (let x = -mx + 1.6; x < mx - 0.8; x += 1.4) {
    for (const s of [-1, 1])
      ojos.push(
        new THREE.CircleGeometry(0.13, 10)
          .translate(x, my - 0.6, 0)
          .rotateY(s < 0 ? Math.PI : 0)
          .translate(0, 0, s * (mz + 0.01)),
      );
  }
  const luz = materialOjo();
  luz.side = THREE.DoubleSide;
  grupo.add(new THREE.Mesh(juntar(ojos), luz));
  // Los palos, las vergas y las velas rotas
  const palos: THREE.BufferGeometry[] = [];
  const velas: THREE.BufferGeometry[] = [];
  for (const [i, f] of a.palos.donde.entries()) {
    const x = -mx + 2 * mx * f;
    const alto = a.palos.alto + (i === 1 ? 1 : 0);
    palos.push(new THREE.CylinderGeometry(a.palos.radio * 0.7, a.palos.radio, alto, 7).translate(x, my + alto / 2, 0));
    for (const [k, y] of [alto * 0.45, alto * 0.8].entries()) {
      const largo = 3.6 - k * 1.1;
      palos.push(new THREE.CylinderGeometry(0.05, 0.05, largo, 5).rotateX(Math.PI / 2).translate(x, my + y, 0));
      // La vela, deshilachada abajo
      const vela = new THREE.PlaneGeometry(largo * 0.9, alto * 0.3, 6, 3).rotateY(Math.PI / 2);
      const pos = vela.getAttribute("position");
      for (let j = 0; j < pos.count; j++) {
        const vy = pos.getY(j);
        const vz = pos.getZ(j);
        const roto = vy < -alto * 0.1 ? 0.25 * Math.abs(Math.sin(vz * 5 + i + k)) : 0;
        pos.setXYZ(j, 0.15 * Math.cos(vz * 1.2), vy + roto, vz);
      }
      vela.computeVertexNormals();
      velas.push(vela.translate(x + 0.1, my + y - alto * 0.16, 0));
    }
  }
  grupo.add(new THREE.Mesh(juntar(palos), madera));
  const tela = materialTela(COLORES.niebla, { repetir: 2, pelusa: false });
  tela.side = THREE.DoubleSide;
  tela.transparent = true;
  tela.opacity = 0.75;
  grupo.add(new THREE.Mesh(juntar(velas), tela));
  // Los faroles: colgados de una guirnalda de proa a popa, sobre los palos
  const guirnalda: THREE.Vector3[] = [];
  const puntas = [
    new THREE.Vector3(-mx - 1.6, my + 1.2, 0),
    ...a.palos.donde.map(
      (f, i) => new THREE.Vector3(-mx + 2 * mx * f, my + a.palos.alto * 0.92 + (i === 1 ? 1 : 0), 0),
    ),
    new THREE.Vector3(mx, my + a.borda.puntas + 0.6, 0),
  ];
  for (let i = 0; i < puntas.length - 1; i++) {
    const p0 = puntas[i];
    const p1 = puntas[i + 1];
    if (!p0 || !p1) continue;
    for (let k = 1; k < 5; k++) {
      const u = k / 5;
      guirnalda.push(
        p0
          .clone()
          .lerp(p1, u)
          .addScaledVector(ARRIBA, -0.9 * u * (1 - u) * 2),
      );
    }
  }
  const faroles = new THREE.Group();
  const vidrio = materialOjo();
  for (const [i, g] of guirnalda.entries()) {
    const farol = new THREE.Group();
    farol.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), vidrio));
    farol.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 6).translate(0, 0.12, 0), oscuro));
    farol.position.copy(g);
    farol.userData = { fase: i * 0.7 };
    faroles.add(farol);
  }
  grupo.add(faroles);
  // La tripulación: fantasmas claros y medio transparentes, con dos ojos, en la banda de atrás de la cubierta
  const sabana = materialTela(COLORES.niebla, { repetir: 1, pelusa: false });
  sabana.transparent = true;
  sabana.opacity = 0.6;
  const fantasmas: THREE.Group[] = [];
  const lugares = [
    [-mx + 3.2, -mz + 0.5],
    [-mx + 6.8, -mz + 0.55],
    [-0.4, -mz + 0.5],
    [mx - 5.4, -mz + 0.6],
    [mx - 2.2, -mz + 0.5],
  ] as const;
  for (const [i, [x, z]] of lugares.entries()) {
    const f = new THREE.Group();
    const cuerpo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 1.45),
        new THREE.Vector2(0.18, 1.4),
        new THREE.Vector2(0.24, 1.2),
        new THREE.Vector2(0.26, 0.6),
        new THREE.Vector2(0.34, 0.08),
        new THREE.Vector2(0.3, 0.0),
      ],
      10,
    );
    f.add(new THREE.Mesh(cuerpo, sabana));
    for (const s of [-1, 1]) {
      const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), oscuro);
      ojo.position.set(0.22, 1.22, s * 0.07);
      f.add(ojo);
    }
    // Los brazos (mangas) en alto, para bailar
    for (const s of [-1, 1]) {
      const brazo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 5).translate(0, 0.25, 0), sabana);
      brazo.position.set(0, 1.05, s * 0.22);
      brazo.rotation.x = s * 0.6;
      brazo.name = s < 0 ? "brazo-izquierdo" : "brazo-derecho";
      f.add(brazo);
    }
    f.position.set(x, my, z);
    f.rotation.y = Math.PI / 2 - 0.4 + i * 0.3;
    f.userData = { fase: i * 1.3 };
    fantasmas.push(f);
    grupo.add(f);
  }

  return {
    grupo,
    /** Mueve a la tripulación y los faroles: quietos fondeado, bailando al compás de fiesta, saludando contentos. */
    animar(estado: EstadoCaleuche, reloj: number, compas: number) {
      for (const f of fantasmas) {
        const fase = (f.userData as { fase: number }).fase;
        const pulso = (Math.PI * reloj) / compas + fase;
        const baila = estado === "de fiesta";
        f.position.y = my + (baila ? 0.12 * Math.abs(Math.sin(pulso)) : estado === "contento" ? 0.04 : 0);
        f.rotation.z = baila ? 0.15 * Math.sin(pulso) : 0;
        for (const b of f.children) {
          if (b.name === "brazo-izquierdo") b.rotation.x = baila ? -0.6 - 0.8 * Math.abs(Math.sin(pulso)) : -0.3;
          if (b.name === "brazo-derecho")
            b.rotation.x = baila ? 0.6 + 0.8 * Math.abs(Math.cos(pulso)) : estado === "contento" ? 2.6 : 0.3;
        }
      }
      for (const farol of faroles.children) {
        const fase = (farol.userData as { fase: number }).fase;
        farol.rotation.x = estado === "de fiesta" ? 0.25 * Math.sin((Math.PI * reloj) / compas + fase) : 0;
      }
    },
  };
}
