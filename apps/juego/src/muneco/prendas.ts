// Las prendas del ropero (TU-29) armadas en código: siluetas oscuras de trapo sobre la cabeza y el cuello del
// muñeco, que siguen al cuerpo porque cuelgan de los nodos de la cabeza y del torso. El pañuelo es el único color
// (rojo o turquesa, según el jugador); lo que cambia es su forma. Qué prendas hay y cuáles se ganan: convex/premios.ts.
//
// Medidas en el marco de cada nodo: la cabeza en su centro (radio `MEDIDAS.cabeza.radio`), el torso en el suyo; +z
// adelante y +y arriba.
import * as THREE from "three";
import type { Vestuario } from "../../../../convex/premios";
import { crearAzar } from "../imagen/ruido";
import { MEDIDAS } from "./ajustes";

export interface MaterialesPrendas {
  /** El trapo oscuro (sombreros y peinados), el mismo del cuerpo. */
  readonly tela: THREE.Material;
  /** El pañuelo, el único color. */
  readonly panuelo: THREE.Material;
  /** Las máscaras: más negras que el trapo, para que se lean sobre la cara. */
  readonly honda: THREE.Material;
}

/** Lo que una prenda le cambia al resto del muñeco. */
export interface ArregloDeCara {
  /** Cuánto adelantar los ojos (m), para que se vean sobre la máscara. */
  readonly ojos: number;
}

const R: number = MEDIDAS.cabeza.radio;
const CUELLO = MEDIDAS.cuello - MEDIDAS.torso.y;
const RADIO_TORSO = MEDIDAS.torso.radio;

type Vec = readonly [number, number, number];

/** Pone una malla en `padre` con posición, giro (XYZ) y escala. */
function pieza(
  padre: THREE.Object3D,
  geometria: THREE.BufferGeometry,
  material: THREE.Material,
  posicion: Vec = [0, 0, 0],
  giro: Vec = [0, 0, 0],
  escala: Vec = [1, 1, 1],
): THREE.Mesh {
  const m = new THREE.Mesh(geometria, material);
  m.position.set(...posicion);
  m.rotation.set(...giro);
  m.scale.set(...escala);
  padre.add(m);
  return m;
}

/** Un grupo dentro de `padre`, para armar una prenda y moverla entera. */
function grupo(padre: THREE.Object3D, posicion: Vec = [0, 0, 0], giro: Vec = [0, 0, 0]): THREE.Group {
  const g = new THREE.Group();
  g.position.set(...posicion);
  g.rotation.set(...giro);
  padre.add(g);
  return g;
}

const esfera = (radio: number, ancho = 16, alto = 12) => new THREE.SphereGeometry(radio, ancho, alto);
const cono = (radio: number, alto: number, lados = 14) => new THREE.ConeGeometry(radio, alto, lados);
const cilindro = (arriba: number, abajo: number, alto: number, lados = 24) =>
  new THREE.CylinderGeometry(arriba, abajo, alto, lados);
/** Un casquete de esfera: lo de arriba hasta `hasta` (en fracciones de π desde el polo). */
const casquete = (radio: number, hasta: number) =>
  new THREE.SphereGeometry(radio, 24, 12, 0, Math.PI * 2, 0, Math.PI * hasta);
/** Una banda abierta alrededor de la cabeza a la altura `y` (desde adelante, `angulo` radianes para cada lado). */
const banda = (y: number, alto: number, holgura: number, angulo = Math.PI) =>
  new THREE.CylinderGeometry(
    Math.sqrt(R * R - y * y) + holgura,
    Math.sqrt(R * R - y * y) + holgura,
    alto,
    28,
    1,
    true,
    -angulo,
    angulo * 2,
  );

/** Un punto de la superficie de la cabeza: `alto` desde el polo (0 arriba, π/2 el ecuador) y `vuelta` alrededor de y
 * (0 adelante). Devuelve también el giro que apunta el +y de una pieza hacia afuera. */
function sobreLaCabeza(alto: number, vuelta: number, radio = R): { posicion: Vec; giro: THREE.Euler } {
  const normal = new THREE.Vector3(
    Math.sin(alto) * Math.sin(vuelta),
    Math.cos(alto),
    Math.sin(alto) * Math.cos(vuelta),
  );
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const p = normal.multiplyScalar(radio);
  return { posicion: [p.x, p.y, p.z], giro: new THREE.Euler().setFromQuaternion(q) };
}

/** Una mecha o una púa saliendo de la cabeza en ese punto. */
function mecha(
  padre: THREE.Object3D,
  material: THREE.Material,
  alto: number,
  vuelta: number,
  largo: number,
  grosor: number,
  aplastar = 1,
) {
  const { posicion, giro } = sobreLaCabeza(alto, vuelta, R * 0.96);
  const m = pieza(padre, cono(grosor, largo, 8), material, posicion, [0, 0, 0], [aplastar, 1, 1]);
  m.rotation.copy(giro);
  m.translateY(largo / 2);
  return m;
}

// Sombreros ------------------------------------------------------------------------------------------------------

function sombrero(cabeza: THREE.Object3D, cual: Vestuario["sombrero"], tela: THREE.Material) {
  switch (cual) {
    case "ninguno":
      return;
    case "ala-ancha": {
      // El del rojo en el arte: ala ancha caída, copa alta con el centro hundido, un poco echado para atrás
      const g = grupo(cabeza, [0, 0.11, -0.01], [-0.14, 0, 0.04]);
      pieza(g, cilindro(0.2, 0.45, 0.06, 32), tela);
      pieza(g, cilindro(0.15, 0.19, 0.2), tela, [0, 0.12, 0]);
      pieza(g, esfera(0.15), tela, [0, 0.21, 0], [0, 0, 0], [1, 0.25, 0.9]);
      return;
    }
    case "cucurucho": {
      // El de la piñata: un cono de fiesta ladeado, con su pompón
      const g = grupo(cabeza, [0.05, 0.18, 0], [0, 0, -0.32]);
      pieza(g, cono(0.11, 0.34, 18), tela, [0, 0.17, 0]);
      pieza(g, esfera(0.045), tela, [0, 0.35, 0]);
      return;
    }
    case "bombin": {
      const g = grupo(cabeza, [0, 0.13, 0], [-0.08, 0, 0]);
      pieza(g, cilindro(0.29, 0.29, 0.02, 32), tela, [0, 0, 0], [0, 0, 0], [1, 1, 1.05]);
      pieza(g, casquete(0.19, 0.5), tela, [0, 0, 0], [0, 0, 0], [1, 1.15, 1]);
      return;
    }
    case "puntudo": {
      // El del Cipitío: ala ancha y una punta altísima que se dobla
      const g = grupo(cabeza, [0, 0.1, 0], [-0.1, 0, 0]);
      pieza(g, cilindro(0.21, 0.47, 0.05, 32), tela);
      pieza(g, cono(0.22, 0.34, 24), tela, [0, 0.19, 0]);
      pieza(g, cono(0.09, 0.2, 14), tela, [0.03, 0.42, -0.04], [-0.5, 0, -0.3]);
      return;
    }
    case "chullo": {
      // El andino: tapa la cabeza, con orejeras, cordones y pompón
      pieza(cabeza, casquete(R * 1.07, 0.52), tela, [0, 0.01, -0.01], [-0.12, 0, 0]);
      pieza(cabeza, esfera(0.05), tela, [0, 0.27, -0.03]);
      for (const lado of [1, -1]) {
        pieza(cabeza, esfera(0.1), tela, [lado * 0.22, -0.06, -0.01], [0, 0, lado * 0.15], [0.32, 1, 0.75]);
        pieza(cabeza, cilindro(0.007, 0.007, 0.17, 6), tela, [lado * 0.235, -0.24, -0.01]);
        pieza(cabeza, esfera(0.022), tela, [lado * 0.235, -0.33, -0.01]);
      }
      return;
    }
    case "boina": {
      const g = grupo(cabeza, [0.03, 0.18, -0.02], [-0.12, 0, -0.24]);
      pieza(g, esfera(0.26, 24, 12), tela, [0, 0, 0], [0, 0, 0], [1, 0.28, 1]);
      pieza(g, cilindro(0.012, 0.012, 0.05, 6), tela, [0, 0.08, 0]);
      return;
    }
  }
}

// Peinados -------------------------------------------------------------------------------------------------------

/** El pelo que tapa la coronilla y la nuca, un poquito más grande que la cabeza. */
function melena(cabeza: THREE.Object3D, tela: THREE.Material, hasta = 0.5) {
  pieza(cabeza, casquete(R * 1.05, hasta), tela, [0, 0.005, -0.02], [-0.35, 0, 0]);
}

function peinado(cabeza: THREE.Object3D, cual: Vestuario["peinado"], tela: THREE.Material) {
  switch (cual) {
    case "ninguno":
      return;
    case "trenzas": {
      // Las de la turquesa en el arte: dos trenzas de bolitas que caen al costado, con su moña, y pelos sueltos
      melena(cabeza, tela);
      for (const lado of [1, -1]) {
        for (let i = 0; i < 4; i++) {
          const r = 0.05 - i * 0.004;
          pieza(cabeza, esfera(r, 12, 10), tela, [lado * (0.2 + i * 0.012), -0.04 - i * 0.068, -0.05 + i * 0.008]);
        }
        pieza(cabeza, cilindro(0.02, 0.02, 0.025, 10), tela, [lado * 0.25, -0.3, -0.02]);
        for (const abrir of [-0.35, 0, 0.35])
          pieza(cabeza, cono(0.02, 0.08, 8), tela, [lado * 0.25 + abrir * 0.04, -0.35, -0.02], [Math.PI, 0, abrir]);
      }
      const azar = crearAzar(31);
      for (let i = 0; i < 7; i++) mecha(cabeza, tela, 0.2 + azar() * 0.9, azar() * Math.PI * 2, 0.07, 0.006);
      return;
    }
    case "grenas": {
      // El nido: mechas para todos lados
      melena(cabeza, tela, 0.55);
      const azar = crearAzar(17);
      for (let i = 0; i < 26; i++)
        mecha(cabeza, tela, azar() * 1.35, azar() * Math.PI * 2, 0.07 + azar() * 0.09, 0.016 + azar() * 0.01);
      return;
    }
    case "copete": {
      melena(cabeza, tela, 0.45);
      pieza(cabeza, esfera(0.12), tela, [0, 0.2, 0.09], [0.45, 0, 0], [0.85, 0.6, 1.45]);
      return;
    }
    case "chongo": {
      melena(cabeza, tela);
      pieza(cabeza, esfera(0.095), tela, [0, 0.19, -0.15]);
      pieza(cabeza, new THREE.TorusGeometry(0.06, 0.014, 6, 16), tela, [0, 0.15, -0.13], [-0.9, 0, 0]);
      return;
    }
    case "colitas": {
      melena(cabeza, tela);
      for (const lado of [1, -1]) {
        pieza(cabeza, esfera(0.03), tela, [lado * 0.17, 0.14, -0.06]);
        const g = grupo(cabeza, [lado * 0.19, 0.16, -0.06], [0, 0, -lado * 1.05]);
        pieza(g, cono(0.055, 0.17, 10), tela, [0, 0.085, 0], [Math.PI, 0, 0]);
      }
      return;
    }
    case "cresta": {
      for (let i = 0; i < 7; i++) {
        const alto = -0.75 + i * 0.36;
        mecha(
          cabeza,
          tela,
          Math.abs(alto),
          alto < 0 ? 0 : Math.PI,
          0.1 + 0.04 * Math.sin((i / 6) * Math.PI),
          0.05,
          0.3,
        );
      }
      return;
    }
  }
}

// Máscaras -------------------------------------------------------------------------------------------------------

function mascara(cabeza: THREE.Object3D, cual: Vestuario["mascara"], honda: THREE.Material): ArregloDeCara {
  switch (cual) {
    case "ninguna":
      return { ojos: 0 };
    case "antifaz": {
      pieza(cabeza, banda(0.03, 0.09, 0.012, 1.3), honda, [0, 0.03, 0]);
      for (const lado of [1, -1])
        pieza(cabeza, cono(0.02, 0.12, 6), honda, [lado * 0.05, -0.02, -R - 0.01], [-0.4, 0, lado * 0.5]);
      return { ojos: 0.012 };
    }
    case "guacamaya": {
      // Un pico curvo y un penacho de plumas
      pieza(cabeza, cono(0.065, 0.17, 16), honda, [0, -0.06, R + 0.05], [Math.PI / 2 + 0.55, 0, 0], [1, 1, 0.8]);
      pieza(cabeza, cono(0.04, 0.08, 12), honda, [0, -0.11, R + 0.0], [Math.PI / 2 + 1.1, 0, 0]);
      for (const [i, giro] of [-0.5, -0.9, -1.3].entries())
        pieza(
          cabeza,
          cono(0.035, 0.2 - i * 0.03, 8),
          honda,
          [0, 0.24 - i * 0.02, -0.04 - i * 0.05],
          [giro, 0, 0],
          [0.4, 1, 1],
        );
      return { ojos: 0 };
    }
    case "jade": {
      // Una cara plana de piedra con orejeras redondas
      const z = Math.sqrt(R * R - 0.06 * 0.06) * 0.95;
      pieza(cabeza, new THREE.BoxGeometry(0.24, 0.27, 0.04), honda, [0, -0.01, z], [-0.06, 0, 0]);
      pieza(cabeza, new THREE.BoxGeometry(0.3, 0.05, 0.05), honda, [0, 0.15, z - 0.07]);
      for (const lado of [1, -1])
        pieza(cabeza, cilindro(0.05, 0.05, 0.03, 16), honda, [lado * 0.235, -0.01, 0], [0, 0, Math.PI / 2]);
      return { ojos: z + 0.02 - R * 0.93 + 0.004 };
    }
    case "alebrije": {
      // Orejas de bicho, un hocico y púas en la nuca
      for (const lado of [1, -1])
        pieza(cabeza, cono(0.075, 0.18, 10), honda, [lado * 0.15, 0.22, -0.01], [0, 0, -lado * 0.55], [1, 1, 0.4]);
      pieza(cabeza, esfera(0.09), honda, [0, -0.08, R * 0.9], [0, 0, 0], [1, 0.72, 1]);
      for (let i = 0; i < 4; i++) mecha(cabeza, honda, 1.1 + i * 0.28, Math.PI, 0.09, 0.03, 0.5);
      return { ojos: 0 };
    }
    case "diablito": {
      // El Tío de la mina: cuernos y barbita de chivo
      for (const lado of [1, -1]) {
        const g = grupo(cabeza, [lado * 0.12, 0.17, 0.05], [0.25, 0, -lado * 0.55]);
        pieza(g, cono(0.045, 0.13, 10), honda, [0, 0.065, 0]);
        pieza(g, cono(0.024, 0.08, 8), honda, [-lado * 0.025, 0.15, 0], [0, 0, lado * 0.7]);
      }
      pieza(cabeza, cono(0.035, 0.13, 8), honda, [0, -0.25, 0.13], [Math.PI - 0.35, 0, 0]);
      return { ojos: 0 };
    }
  }
}

// Pañuelos -------------------------------------------------------------------------------------------------------

/** El anillo del pañuelo en el cuello. */
function anillo(torso: THREE.Object3D, panuelo: THREE.Material, alto = 0.08, abajo = 0.17) {
  return pieza(torso, new THREE.CylinderGeometry(0.135, abajo, alto, 18, 1, true), panuelo, [0, CUELLO - 0.02, 0]);
}

function triangulo(ancho: number, largo: number) {
  return new THREE.ShapeGeometry(
    new THREE.Shape()
      .moveTo(-ancho / 2, 0)
      .lineTo(ancho / 2, 0)
      .lineTo(0, -largo)
      .closePath(),
  );
}

function panuelo(
  { cabeza, torso }: { cabeza: THREE.Object3D; torso: THREE.Object3D },
  cual: Vestuario["panuelo"],
  material: THREE.Material,
) {
  const pecho: Vec = [0, CUELLO - 0.02, RADIO_TORSO * 0.98];
  switch (cual) {
    case "triangulo":
      // Un anillo en el cuello y un triángulo que cae sobre el pecho
      anillo(torso, material);
      pieza(torso, triangulo(0.26, 0.21), material, pecho, [-0.32, 0, 0]);
      return;
    case "lazo": {
      anillo(torso, material);
      const g = grupo(torso, [0, CUELLO - 0.05, RADIO_TORSO + 0.01], [-0.2, 0, 0]);
      pieza(g, esfera(0.035), material);
      for (const lado of [1, -1])
        pieza(g, cono(0.06, 0.12, 4), material, [lado * 0.065, 0, 0], [0, 0, lado * (Math.PI / 2)], [1, 1, 0.35]);
      for (const lado of [1, -1])
        pieza(g, triangulo(0.05, 0.12), material, [lado * 0.02, -0.02, 0.01], [0, 0, lado * 0.3]);
      return;
    }
    case "bufanda": {
      anillo(torso, material, 0.12, 0.18);
      for (const lado of [1, -1])
        pieza(
          torso,
          new THREE.BoxGeometry(0.075, 0.42, 0.016),
          material,
          [lado * 0.05, CUELLO - 0.23, -RADIO_TORSO - 0.05],
          [-0.28, 0, lado * 0.1],
        );
      return;
    }
    case "vincha": {
      // Atado en la frente, con las puntas que caen por la nuca
      const y = 0.1;
      const g = grupo(cabeza, [0, y, 0], [-0.18, 0, 0]);
      pieza(g, banda(y, 0.065, 0.01), material);
      const atras = -Math.sqrt(R * R - y * y) - 0.012;
      pieza(g, esfera(0.03), material, [0, 0, atras]);
      for (const lado of [1, -1])
        pieza(g, triangulo(0.06, 0.2), material, [lado * 0.025, 0, atras - 0.005], [0.35, Math.PI, lado * 0.25]);
      return;
    }
    case "capa": {
      anillo(torso, material);
      const capa = new THREE.Shape()
        .moveTo(-0.15, 0)
        .lineTo(0.15, 0)
        .lineTo(0.27, -0.6)
        .lineTo(-0.27, -0.6)
        .closePath();
      pieza(
        torso,
        new THREE.ShapeGeometry(capa),
        material,
        [0, CUELLO - 0.03, -RADIO_TORSO - 0.03],
        [0.16, Math.PI, 0],
      );
      return;
    }
  }
}

/** Le pone el vestuario al muñeco, colgando de los nodos de la cabeza y del torso. Devuelve las mallas puestas (para
 * sacarlas al cambiar de ropa) y cuánto adelantar los ojos. */
export function ponerPrendas(
  nodos: { cabeza: THREE.Object3D; torso: THREE.Object3D },
  vestuario: Vestuario,
  { tela, panuelo: color, honda }: MaterialesPrendas,
): { mallas: THREE.Object3D[]; cara: ArregloDeCara } {
  const antes = [...nodos.cabeza.children, ...nodos.torso.children];
  sombrero(nodos.cabeza, vestuario.sombrero, tela);
  peinado(nodos.cabeza, vestuario.peinado, tela);
  const cara = mascara(nodos.cabeza, vestuario.mascara, honda);
  panuelo(nodos, vestuario.panuelo, color);
  const mallas = [...nodos.cabeza.children, ...nodos.torso.children].filter((o) => !antes.includes(o));
  return { mallas, cara };
}

/** Saca las prendas que puso `ponerPrendas` y libera sus geometrías. */
export function sacarPrendas(mallas: readonly THREE.Object3D[]): void {
  for (const m of mallas) {
    m.removeFromParent();
    m.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.geometry as THREE.BufferGeometry).dispose();
    });
  }
}
