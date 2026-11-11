// pnpm niveles: arma niveles/98-piezas/escena.glb, el nivel para ver las piezas de juego (TU-12). Como el de prueba,
// sin Blender: las mismas propiedades (`extras`) que se pondrían en Blender. La convención está en niveles/README.md.
//
// El recorrido, de oeste a este (+x), con la pareja mirando hacia +x (mide lo mismo que el de prueba):
//   el patio (salida, tres huacales y una plancha) → una compuerta que baja mientras la plancha está pisada →
//   punto 1 → una palanca y otra compuerta que baja mientras alguien la empuja (y queda abajo pasado el punto 2) →
//   punto 2 al borde de una quebrada de 2.2 m, con dos bejucos colgando de una rama → punto 3 en la otra orilla →
//   un balancín de tronco → un escalón de 1.4 m → punto 4, la meta.
import { crearEscena } from "./comun.mjs";

const { solido, pieza, vacio, exportar } = crearEscena({
  nivel: 98,
  nombre: "Piezas",
  vacio: -4,
  nieblaCerca: 3,
  nieblaLejos: 26,
});

// El suelo: el patio y la huerta en y = 0, la quebrada, la otra orilla y el escalón de la meta
solido("patio", [-0.5, -0.5, 0], [11, 1, 6]);
solido("huerta", [8.5, -0.5, 0], [7, 1, 6]);
solido("otra-orilla", [18.8, -0.5, 0], [9.2, 1, 6]);
solido("escalon", [22.9, 0.7, 0], [2.6, 1.4, 6], { material: "tela" });
// Las compuertas, que mueve el guion: hundidas en el suelo quedan abiertas
solido("compuerta-1", [4, 1.2, 0], [0.3, 2.4, 6], { cuerpo: "cinematico", material: "tela" });
solido("compuerta-2", [10.2, 1.2, 0], [0.3, 2.4, 6], { cuerpo: "cinematico", material: "tela" });
// La rama de donde cuelgan los bejucos, a 4 m sobre la quebrada: sale del pino de atrás
solido("rama", [12.3, 4, -1.4], [0.2, 0.2, 4.7], { material: "corteza" });

// Las piezas (TU-12). Los huacales, dos apilados; la plancha, delante del rojo
pieza("huacal-1", "huacal", [-2, 0.3, -1.9], [0.6, 0.6, 0.6]);
pieza("huacal-2", "huacal", [-2, 0.9, -1.9], [0.6, 0.6, 0.6]);
pieza("huacal-3", "huacal", [-1.1, 0.3, -2.3], [0.6, 0.6, 0.6], {}, 0.4);
pieza("plancha", "plancha", [0.5, 0.06, 1], [1.2, 0.12, 1.2]);
// La palanca, delante de donde aparece el turquesa en el punto 1, mira hacia −x (hacia quien llega): el travesaño
// queda a lo largo de z y se empuja hacia +x
pieza("palanca", "palanca", [7.6, 0.65, -0.5], [0.6, 1.3, 0.3], {}, -Math.PI / 2);
// Un bejuco para cada uno, justo donde llegan al punto 2, con la punta a la altura de las manos
pieza("bejuco-rojo", "bejuco", [12.3, 2.45, 0.45], [0.08, 2.9, 0.08]);
pieza("bejuco-turquesa", "bejuco", [12.3, 2.45, -0.45], [0.08, 2.9, 0.08]);
// El balancín, en la fila del rojo (el turquesa pasa por al lado)
pieza("balancin", "balancin", [18.6, 0.35, 0.45], [4, 0.2, 0.9]);

// Las salidas y los puntos de control (zonas de 1 × 2 × 6 m, rotadas para mirar hacia +x)
vacio("salida-rojo", [-4.5, 0, 1], [1, 1, 1], { tipo: "salida", jugador: 1 });
vacio("salida-turquesa", [-4.5, 0, -1], [1, 1, 1], { tipo: "salida", jugador: 2 });
vacio("control-1", [5.4, 1, 0], [3, 1, 0.5], { tipo: "control", orden: 1 });
vacio("control-2", [11.3, 1, 0], [3, 1, 0.5], { tipo: "control", orden: 2 });
vacio("control-3", [15.4, 1, 0], [3, 1, 0.5], { tipo: "control", orden: 3 });
vacio("control-4", [23.4, 2.4, 0], [3, 1, 0.5], { tipo: "control", orden: 4 });
// El fondo de la quebrada: cuenta como caída antes de llegar a la altura del vacío
vacio("quebrada", [13.1, -2.5, 0], [1.1, 1.5, 3], { tipo: "vacio" }, 0);

// Adornos: el pino de la rama, más pinos que suben del vacío, abetos al fondo, rocas y matas
const pinos = [
  [12.3, -3.75, 0.42],
  [-5, -4.5, 0.36],
  [3, -5.5, 0.4],
  [8, -4.3, 0.34],
  [17, -5.2, 0.42],
  [22, -4.6, 0.38],
  [-1, -9, 0.4],
  [7, -11, 0.42],
  [17, -10, 0.4],
  [25, -9, 0.44],
];
for (const [i, [x, z, radio]] of pinos.entries()) {
  vacio(`pino-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "pino", alto: 24, radio, semilla: 60 + i }, 0);
}
for (let i = 0; i < 14; i++) {
  const x = -8 + i * 2.6;
  const z = -13 - (i % 3) * 3;
  vacio(`abeto-${i + 1}`, [x, -6, z], [1, 1, 1], { tipo: "adorno", forma: "abeto", alto: 9 + (i % 4) * 1.5 }, 0);
}
vacio("roca-1", [-3.2, -0.05, -2.4], [1, 1, 1], { tipo: "adorno", forma: "roca", radio: 0.4, semilla: 81 }, 0);
vacio("mata-1", [2.5, 0, 2.5], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.7, semilla: 21 }, 0);
vacio("mata-2", [-5.3, 0, 2.4], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 1, semilla: 22 }, 0);
vacio("mata-3", [11.4, 0, -2.6], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.8, semilla: 23 }, 0);
vacio("mata-4", [20.5, 0, -2.5], [1, 1, 1], { tipo: "adorno", forma: "mata", alto: 0.9, semilla: 24 }, 0);

// Niebla: el vapor que sube de la quebrada y capas entre los pinos
vacio("niebla-quebrada", [13.1, -1.5, 0], [6, 1.5, 1], { tipo: "niebla", opacidad: 0.55, velocidad: 0.1 }, 0);
vacio("niebla-1", [6, 0.5, -5], [12, 3, 1], { tipo: "niebla", opacidad: 0.45, velocidad: 0.15 }, 0);
vacio("niebla-2", [8, 2, -9], [16, 5, 1], { tipo: "niebla", opacidad: 0.6, velocidad: -0.18 }, 0);
vacio("niebla-3", [10, 3, -14], [22, 8, 1], { tipo: "niebla", opacidad: 0.7, velocidad: 0.22 }, 0);

await exportar("98-piezas");
