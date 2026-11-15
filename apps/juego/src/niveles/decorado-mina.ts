// Lo que se ve en La mina (TU-46) y no choca ni se mueve solo: las vigas de los túneles, la jaula del pozo (sobre su
// piso, que mueve el guion), el sol de piedra de los espejos, la pepita del secreto y el salar que refleja el cielo.
// Solo imagen: lo arma el guion en `alEmpezar`, que corre igual en los dos jugadores.
import * as THREE from "three";
import { COLORES } from "../escenas/colores";
import { juntar, materialCorteza, materialTela } from "../imagen";

type Punto = { readonly x: number; readonly y: number; readonly z: number };

/** Un tramo de túnel con vigas: de `desde` a `hasta` en x, sobre el piso `piso`; sin marco cerca de cada `salvo`. */
export interface TramoDeVigas {
  readonly desde: number;
  readonly hasta: number;
  readonly piso: number;
  readonly salvo?: readonly number[];
}

/** Los marcos de vigas de los túneles: un pie contra el fondo con su travesaño y su puntal, y uno adelante, bajo
 * (1.2 m), para no tapar a la pareja. Con lámparas de carburo colgadas, claras. */
export function crearVigas(tramos: readonly TramoDeVigas[], cada = 3.2, alto = 3.4): THREE.Group {
  const madera: THREE.BufferGeometry[] = [];
  const lamparas: THREE.BufferGeometry[] = [];
  for (const t of tramos) {
    let i = 0;
    for (let x = t.desde; x < t.hasta; x += cada, i++) {
      if (t.salvo?.some((s) => Math.abs(x - s) < 0.6)) continue;
      const techo = t.piso + alto;
      madera.push(new THREE.BoxGeometry(0.2, alto, 0.2).translate(x, t.piso + alto / 2, -3.05));
      madera.push(new THREE.BoxGeometry(0.24, 0.22, 1.6).translate(x, techo - 0.11, -2.4));
      madera.push(new THREE.BoxGeometry(0.18, 1.2, 0.18).translate(x, t.piso + 0.6, 3.1));
      madera.push(new THREE.BoxGeometry(0.12, 1.2, 0.12).rotateX(-0.6).translate(x, techo - 0.55, -2.75));
      if (i % 3 === 1) lamparas.push(new THREE.SphereGeometry(0.06, 8, 6).translate(x, techo - 0.45, -1.75));
    }
  }
  const grupo = new THREE.Group();
  grupo.name = "vigas";
  grupo.add(new THREE.Mesh(juntar(madera), materialCorteza(COLORES.silueta, { repetir: [1, 2] })));
  if (lamparas.length)
    grupo.add(new THREE.Mesh(juntar(lamparas), new THREE.MeshBasicMaterial({ name: "lampara", color: COLORES.ojo })));
  return grupo;
}

/** Viste de reja de barrotes la malla de una caja (la de la galería): barrotes de punta a punta de su z, con tres
 * travesaños. Choca igual que antes; solo cambia lo que se ve. */
export function vestirReja(malla: THREE.Object3D): void {
  if (!(malla instanceof THREE.Mesh)) return;
  malla.geometry.computeBoundingBox();
  const caja = malla.geometry.boundingBox;
  if (!caja) return;
  const [x, alto, z0, z1] = [(caja.min.x + caja.max.x) / 2, caja.max.y - caja.min.y, caja.min.z, caja.max.z];
  const barrotes: THREE.BufferGeometry[] = [];
  for (let z = z0 + 0.1; z < z1; z += 0.22)
    barrotes.push(new THREE.CylinderGeometry(0.025, 0.025, alto, 6).translate(x, caja.min.y + alto / 2, z));
  for (const y of [0.15, alto * 0.55, alto - 0.08])
    barrotes.push(new THREE.BoxGeometry(0.08, 0.08, z1 - z0).translate(x, caja.min.y + y, (z0 + z1) / 2));
  malla.geometry = juntar(barrotes);
}

/** Las piedras de un derrumbe, amontonadas sobre la caja que choca (de `desde` a `hasta`), sin azar. */
export function crearDerrumbe(desde: Punto, hasta: Punto): THREE.Mesh {
  const piedras: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 26; i++) {
    const x = desde.x + ((i * 0.6180339) % 1) * (hasta.x - desde.x);
    const z = desde.z + ((i * 0.4142135 + 0.21) % 1) * (hasta.z - desde.z);
    const radio = 0.2 + (i % 4) * 0.08;
    const y = hasta.y - radio * 0.3 + ((i * 0.7548776) % 1) * 0.25;
    piedras.push(new THREE.DodecahedronGeometry(radio, 0).rotateY(i).translate(x, y, z));
  }
  return new THREE.Mesh(juntar(piedras), materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false }));
}

/** La jaula del pozo, sobre su piso (de 1.4 × 1.4 m): cuatro esquineros de `alto`, barandas a los costados y el
 * travesaño de arriba, de donde cuelga. */
export function crearJaula(alto: number): THREE.Mesh {
  const hierro: THREE.BufferGeometry[] = [];
  for (const x of [-0.65, 0.65])
    for (const z of [-0.65, 0.65]) hierro.push(new THREE.BoxGeometry(0.05, alto, 0.05).translate(x, alto / 2, z));
  for (const z of [-0.65, 0.65]) {
    hierro.push(new THREE.BoxGeometry(1.35, 0.04, 0.04).translate(0, 0.9, z));
    hierro.push(new THREE.BoxGeometry(1.35, 0.05, 0.05).translate(0, alto, z));
  }
  hierro.push(new THREE.BoxGeometry(0.05, 0.05, 1.35).translate(0, alto, 0));
  const jaula = new THREE.Mesh(juntar(hierro), materialTela(COLORES.siluetaHonda, { repetir: 1, pelusa: false }));
  jaula.name = "jaula";
  return jaula;
}

/** El sol de piedra donde tiene que llegar el haz: un disco con sus rayos tallados, contra la pared del fondo. */
export function crearSolDePiedra(donde: Punto, radio: number): THREE.Group {
  const piedra = materialTela(COLORES.siluetaLejana, { repetir: 1, pelusa: false });
  const partes: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(radio * 0.7, radio * 0.75, 0.08, 20)];
  for (let i = 0; i < 12; i++) {
    partes.push(
      new THREE.BoxGeometry(0.06, 0.06, radio * 0.45).translate(0, 0, radio * 0.95).rotateY((i / 12) * Math.PI * 2),
    );
  }
  const disco = new THREE.Mesh(juntar(partes), piedra);
  disco.rotation.x = Math.PI / 2;
  const grupo = new THREE.Group();
  grupo.name = "sol";
  grupo.add(disco);
  grupo.position.set(donde.x, donde.y, donde.z + 0.02);
  return grupo;
}

/** La pepita de plata del secreto, en su nicho: clara y con brillo, sin color. */
export function crearPepita(donde: Punto): THREE.Mesh {
  const plata = new THREE.MeshStandardMaterial({
    name: "plata",
    color: COLORES.agua,
    emissive: COLORES.niebla,
    emissiveIntensity: 0.4,
    metalness: 0.8,
    roughness: 0.25,
  });
  const pepita = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0).scale(1, 0.7, 0.9), plata);
  pepita.name = "pepita";
  pepita.position.set(donde.x, donde.y + 0.09, donde.z);
  return pepita;
}

/** El salar, a la altura `y` desde `desde` (x) hacia el este: una costra blanca que refleja el cielo, con sus celdas
 * de sal, y los cerros del fondo con su reflejo cabeza abajo, que se ve a través del agua. */
export function crearSalar(y: number, desde: number): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "salar";
  const espejo = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 70).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      name: "salar",
      color: COLORES.niebla,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
    }),
  );
  // Un poco hundido: los rieles quedan arriba y los durmientes, metidos en la sal
  espejo.position.set(desde + 44, y - 0.08, -10);
  grupo.add(espejo);
  // Las celdas de sal: un panal de hexágonos (cada uno dibuja tres de sus lados), en gris claro
  const lineas: THREE.BufferGeometry[] = [];
  const r = 0.8;
  const lado = (x: number, z: number, k: number) => {
    const a = (k * Math.PI) / 3;
    const b = ((k + 1) * Math.PI) / 3;
    const [x0, z0, x1, z1] = [x + r * Math.cos(a), z + r * Math.sin(a), x + r * Math.cos(b), z + r * Math.sin(b)];
    lineas.push(
      new THREE.BoxGeometry(r, 0.01, 0.03)
        .rotateY(-Math.atan2(z1 - z0, x1 - x0))
        .translate((x0 + x1) / 2, y - 0.07, (z0 + z1) / 2),
    );
  };
  for (let i = 0; i <= 26; i++)
    for (let j = -4; j <= 4; j++) {
      const x = desde + 0.6 + i * r * 1.5;
      const z = j * r * Math.sqrt(3) + (i % 2) * r * (Math.sqrt(3) / 2);
      for (const k of [0, 1, 2]) lado(x, z, k);
    }
  grupo.add(new THREE.Mesh(juntar(lineas), new THREE.MeshBasicMaterial({ name: "sal", color: COLORES.agua })));
  const cerros: THREE.BufferGeometry[] = [];
  for (const [dx, z, r, alto] of [
    [19, -40, 18, 14],
    [44, -48, 22, 18],
    [-1, -55, 26, 12],
    [69, -42, 16, 10],
  ] as const) {
    cerros.push(new THREE.ConeGeometry(r, alto, 7).translate(desde + dx, y + alto / 2, z));
    cerros.push(new THREE.ConeGeometry(r, alto, 7).rotateX(Math.PI).translate(desde + dx, y - alto / 2 - 0.05, z));
  }
  grupo.add(
    new THREE.Mesh(
      juntar(cerros),
      new THREE.MeshStandardMaterial({ name: "cerros", color: COLORES.siluetaLejana, roughness: 1 }),
    ),
  );
  return grupo;
}
