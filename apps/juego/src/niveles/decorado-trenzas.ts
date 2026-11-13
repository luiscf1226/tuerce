// Lo que el guion de Las trenzas (TU-40, niveles/07-trenzas/guion.ts) arma con three y no es una pieza: las hojas de
// los portones, que giran sobre sus bisagras, y el decorado (el volcán, las fachadas, los arcos, las ruinas, la fuente,
// el campanario y el barrilete del secreto). Las x son las del nivel antes de correrlo (`dx`), como en
// scripts/niveles/trenzas.mjs.
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialOjo, materialTela } from "../imagen";

/** Las hojas de un portón (cuerpos cinemáticos): cada una gira 90° sobre su bisagra vertical (x, z), su punta hacia
 * +x. `hacia`: +1 si la hoja está del lado −z de su bisagra… al revés, −1. */
export function crearHojas(
  hojas: readonly {
    readonly cuerpo: RAPIER.RigidBody;
    readonly bisagra: { x: number; z: number };
    readonly hacia: number;
  }[],
) {
  const lista = hojas.map((h) => ({
    ...h,
    t0: new THREE.Vector3().copy(h.cuerpo.translation()),
    q0: new THREE.Quaternion().copy(h.cuerpo.rotation()),
    pivote: new THREE.Vector3(h.bisagra.x, 0, h.bisagra.z),
  }));
  const eje = new THREE.Vector3(0, 1, 0);
  return {
    /** Las pone abiertas en esa fracción (de 0 a 1, suavizada). Con `ya`, de una vez. */
    abrir(f: number, ya = false) {
      const s = f * f * (3 - 2 * f);
      for (const h of lista) {
        const q = new THREE.Quaternion().setFromAxisAngle(eje, (h.hacia * s * Math.PI) / 2);
        const p = h.t0.clone().sub(h.pivote).applyQuaternion(q).add(h.pivote);
        const r = q.clone().multiply(h.q0);
        if (ya) {
          h.cuerpo.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
          h.cuerpo.setRotation(r, true);
        }
        h.cuerpo.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
        h.cuerpo.setNextKinematicRotation(r);
      }
    },
  };
}

// ── El decorado ─────────────────────────────────────────────────────────────────────────────────────────────

/** Una arcada contra la fachada del fondo, de `x0` a `x1`: `n` arcos de medio punto, con pilares de 0.4 m, de `alto`
 * hasta arriba y apoyada en `base`. Es un relieve de 25 cm, pegado a la fachada (en z = −3.2): no sale a la calle. */
function arcada(x0: number, x1: number, n: number, alto: number, base: number): THREE.BufferGeometry[] {
  const pilar = 0.4;
  const fondo = 0.25;
  const ancho = (x1 - x0) / n;
  const luz = ancho - pilar;
  const arranque = Math.max(0.5, alto - luz / 2 - 0.4);
  return Array.from({ length: n }, (_, i) => {
    const forma = new THREE.Shape();
    forma.moveTo(-ancho / 2, 0);
    forma.lineTo(-luz / 2, 0);
    forma.lineTo(-luz / 2, arranque);
    forma.absarc(0, arranque, luz / 2, Math.PI, 0, true);
    forma.lineTo(luz / 2, 0);
    forma.lineTo(ancho / 2, 0);
    forma.lineTo(ancho / 2, alto);
    forma.lineTo(-ancho / 2, alto);
    forma.lineTo(-ancho / 2, 0);
    return new THREE.ExtrudeGeometry(forma, { depth: fondo, bevelEnabled: false, curveSegments: 16 }).translate(
      x0 + ancho * (i + 0.5),
      base,
      -3.2,
    );
  });
}

/** El barrilete: un rombo de papel con sus varas en cruz y la cola de moñitos. Sin color: papel claro y varas
 * oscuras. Mira hacia +z. */
export function crearBarrilete(): THREE.Group {
  const grupo = new THREE.Group();
  const papel = new THREE.MeshStandardMaterial({
    name: "papel",
    color: COLORES.ojo,
    emissive: COLORES.ojo,
    emissiveIntensity: 0.25,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const forma = new THREE.Shape();
  forma.moveTo(0, 0.42);
  forma.lineTo(0.28, 0.08);
  forma.lineTo(0, -0.42);
  forma.lineTo(-0.28, 0.08);
  forma.lineTo(0, 0.42);
  grupo.add(new THREE.Mesh(new THREE.ShapeGeometry(forma), papel));
  const varas = materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false });
  grupo.add(
    new THREE.Mesh(
      juntar([
        new THREE.BoxGeometry(0.02, 0.84, 0.02).translate(0, 0, 0.012),
        new THREE.BoxGeometry(0.56, 0.02, 0.02).translate(0, 0.08, 0.012),
      ]),
      varas,
    ),
  );
  // La cola: un hilo que cuelga con moñitos
  const cola: THREE.BufferGeometry[] = [];
  const puntos: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) puntos.push(new THREE.Vector3(Math.sin(i * 0.7) * 0.08, -0.42 - i * 0.09, 0));
  cola.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(puntos), 20, 0.006, 3, false));
  for (let i = 2; i <= 10; i += 2) {
    const p = puntos[i];
    if (p) cola.push(new THREE.BoxGeometry(0.1, 0.035, 0.01).rotateZ(i * 0.4).translate(p.x, p.y, p.z));
  }
  grupo.add(new THREE.Mesh(juntar(cola), papel));
  return grupo;
}

/** Lo que se ve de Las trenzas y no choca: el volcán, las ventanas y los aleros de las fachadas, los arcos, las ruinas
 * de la iglesia, el caño de la fuente y el campanario con el barrilete. `dx`: lo que va corrido el nivel en x;
 * `alta`: la altura de la plaza del Sombrerón. */
export function dibujarDecoradoTrenzas(escena: THREE.Scene, dx: number, alta: number) {
  const DX = dx;
  const ALTA = alta;
  const piedra = materialTela(COLORES.siluetaLejana, { repetir: 2, pelusa: false });
  const oscura = materialTela(COLORES.siluetaHonda, { repetir: 2, pelusa: false });
  const madera = materialCorteza(COLORES.silueta, { repetir: [1, 2] });
  const lejana = new THREE.MeshStandardMaterial({ name: "lejana", color: COLORES.siluetaLejana, roughness: 1 });
  const agregar = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const malla = new THREE.Mesh(g, m);
    escena.add(malla);
    return malla;
  };

  // El volcán al fondo, con su vecino más chico, entre la niebla
  agregar(
    juntar([
      new THREE.CylinderGeometry(2.2, 20, 17, 40, 1, true).translate(DX + 46, 7.5, -21),
      new THREE.CylinderGeometry(1.5, 13, 11, 32, 1, true).translate(DX + 10, 4.5, -19),
    ]),
    lejana,
  );

  // Ventanas, puertas y balcones en las fachadas (las mismas para todas: x de las ventanas y su altura)
  const huecos: THREE.BufferGeometry[] = [];
  const rejas: THREE.BufferGeometry[] = [];
  const aleros: THREE.BufferGeometry[] = [];
  const fachadas: readonly (readonly [number, number, number, number])[] = [
    [-8, -2, 4.2, 0],
    [-2, 3, 5, 0],
    [3, 7, 3.8, 0],
    [7.9, 13, 4.6, 0],
    [13, 18, 3.6, 0],
    [18, 23.5, 5.2, 0],
    [23.5, 28.6, 4.4, 0],
    [28.6, 32.2, 3.4, 0],
    [46, 51, 3.2, 0],
    [52, 56, 3.6, 0],
    [60.4, 65, 3.8, 0],
    [65, 73, 5, 0],
    [73, 80.4, 4.2, ALTA],
  ];
  for (const [i, [x0, x1, alto, base]] of fachadas.entries()) {
    const n = Math.max(1, Math.floor((x1 - x0) / 2.2));
    for (let k = 0; k < n; k++) {
      const x = DX + x0 + ((k + 0.5) * (x1 - x0)) / n;
      const puerta = (k + i) % 3 === 0;
      const [ancho, altoHueco, y] = puerta ? [1.1, 2.1, base + 1.05] : [0.8, 1.2, base + Math.min(alto - 1, 2.2)];
      huecos.push(new THREE.BoxGeometry(ancho, altoHueco, 0.06).translate(x, y, -3.19));
      if (!puerta) {
        // La reja de la ventana, salida hacia la calle
        for (let b = -2; b <= 2; b++)
          rejas.push(new THREE.BoxGeometry(0.03, altoHueco + 0.1, 0.03).translate(x + b * 0.17, y, -3.05));
        rejas.push(new THREE.BoxGeometry(ancho + 0.1, 0.04, 0.2).translate(x, y - altoHueco / 2 - 0.05, -3.1));
        rejas.push(new THREE.BoxGeometry(ancho + 0.1, 0.04, 0.2).translate(x, y + altoHueco / 2 + 0.05, -3.1));
      }
    }
    // El alero de tejas
    aleros.push(new THREE.BoxGeometry(x1 - x0, 0.12, 0.7).translate(DX + (x0 + x1) / 2, base + alto + 0.06, -3.0));
  }
  agregar(juntar(huecos), oscura);
  agregar(juntar(rejas), oscura);
  agregar(juntar(aleros), madera);

  // El arco de la calle: lo que se ve es el pilar del fondo, con su torrecita y el reloj (un arco que cruzara la calle
  // taparía a los que desatan el nudo: la cámara mira desde el este y desde arriba)
  agregar(
    juntar([
      new THREE.BoxGeometry(0.9, 1.6, 1.4).translate(DX + 7.45, 5.8, -3.8),
      new THREE.ConeGeometry(0.85, 0.9, 4).rotateY(Math.PI / 4).translate(DX + 7.45, 7.05, -3.8),
    ]),
    piedra,
  );
  agregar(new THREE.CircleGeometry(0.4, 20).translate(DX + 7.45, 5.85, -3.09), materialOjo());
  agregar(
    juntar([
      new THREE.BoxGeometry(0.04, 0.32, 0.02).translate(DX + 7.45, 5.95, -3.07),
      new THREE.BoxGeometry(0.24, 0.04, 0.02).translate(DX + 7.55, 5.85, -3.07),
    ]),
    oscura,
  );
  // Los portales: arcadas pegadas a las fachadas del fondo, en la calle de la mula y en la plaza del Sombrerón
  agregar(
    juntar([
      ...arcada(8.2, 13, 2, 3.6, 0),
      ...arcada(18.2, 23.3, 2, 4, 0),
      ...arcada(73.4, 80.2, 3, 3.6, ALTA),
    ]).translate(DX, 0, 0),
    piedra,
  );

  // Las aldabas del portón, de donde se amarran las cuerdas
  agregar(
    juntar(
      [-0.25, 0.25].map((z) =>
        new THREE.TorusGeometry(0.1, 0.02, 6, 12).rotateY(Math.PI / 2).translate(DX + 7.27, 1.0, z),
      ),
    ),
    oscura,
  );

  // Las ruinas de la iglesia: la arcada de la nave, desde el fondo del foso (a una se le cayó la clave), y columnas
  const ruinas: THREE.BufferGeometry[] = [...arcada(33.6, 37.4, 1, 9, -3), ...arcada(40.6, 45.4, 1, 9, -3)];
  ruinas.push(new THREE.BoxGeometry(0.8, 6.2, 0.6).translate(37.9, 0.1, -2.9));
  ruinas.push(new THREE.BoxGeometry(0.8, 4.4, 0.6).translate(40.1, -0.8, -2.9));
  for (const [x, z, alto] of [
    [33.4, -2.7, 4.5],
    [44.8, -2.7, 3.2],
  ] as const) {
    ruinas.push(new THREE.CylinderGeometry(0.3, 0.34, alto, 12).translate(x, alto / 2, z));
  }
  agregar(juntar(ruinas).translate(DX, 0, 0), piedra);

  // La fuente: el caño, el chorro que cae y la pila con agua
  agregar(
    juntar([
      new THREE.CylinderGeometry(0.05, 0.06, 0.45, 8).rotateX(Math.PI / 2).translate(DX + 47.6, 1.55, -2.3),
      new THREE.SphereGeometry(0.25, 12, 8).scale(1, 1, 0.4).translate(DX + 47.6, 1.6, -2.5),
      new THREE.BoxGeometry(1.8, 0.5, 0.15).translate(DX + 47.6, 1.5, -2.55),
    ]),
    piedra,
  );
  const agua = new THREE.MeshStandardMaterial({
    name: "chorro",
    color: COLORES.agua,
    transparent: true,
    opacity: 0.75,
    roughness: 0.1,
  });
  agregar(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 8).translate(DX + 47.6, 1.37, -2.12), agua);
  agregar(new THREE.BoxGeometry(1.4, 0.02, 0.55).translate(DX + 47.6, 1.12, -2.85), agua);

  // El campanario: las columnas y el techo del cuerpo de campanas, las campanas y el barrilete escondido
  const torre: THREE.BufferGeometry[] = [];
  const arriba = ALTA + 2.9;
  for (const [x, z] of [
    [81.75, -3.05],
    [83.85, -3.05],
    [81.75, -0.75],
    [83.85, -0.75],
  ] as const) {
    torre.push(new THREE.BoxGeometry(0.28, 1.8, 0.28).translate(DX + x, arriba + 0.9, z));
  }
  torre.push(new THREE.BoxGeometry(2.6, 0.25, 2.9).translate(DX + 82.8, arriba + 1.9, -1.9));
  torre.push(new THREE.ConeGeometry(1.9, 1.3, 4).rotateY(Math.PI / 4).translate(DX + 82.8, arriba + 2.65, -1.9));
  agregar(juntar(torre), piedra);
  agregar(
    juntar([
      new THREE.CylinderGeometry(0.18, 0.32, 0.5, 14, 1, true).translate(DX + 82.2, arriba + 1.45, -2.7),
      new THREE.CylinderGeometry(0.12, 0.22, 0.35, 12, 1, true).translate(DX + 83.4, arriba + 1.5, -2.7),
    ]),
    new THREE.MeshStandardMaterial({ name: "campana", color: COLORES.siluetaHonda, side: THREE.DoubleSide }),
  );
  const barrilete = crearBarrilete();
  barrilete.position.set(DX + 82.8, ALTA + 3.5, -2.1);
  barrilete.rotation.set(0.15, 0.4, 0.35);
  escena.add(barrilete);
}
