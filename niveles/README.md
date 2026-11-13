# niveles

Una carpeta por nivel (`00-el-patio`, `01-el-pinar`, …, y `99-prueba`) con su escena `escena.glb` y su guion
`guion.ts`. La lista completa está en `docs/plan.html`; la que usa el juego, en `apps/juego/src/niveles/lista.ts`.
Se abren con `?escena=nivel&nivel=<nombre>` (por ahora, `prueba` y `piezas`).

## La escena: un `.glb` hecho en Blender

Se exporta con **File › Export › glTF 2.0 (.glb)**, con **Include › Custom Properties** marcado y **+Y Up** (lo que
trae por defecto). Un metro de Blender es un metro del juego. La pareja avanza mirando hacia donde mire su salida.

Cada objeto dice qué es con sus **propiedades personalizadas** (Object Properties › Custom Properties; en glTF quedan
en `extras`). Lo que no tiene `tipo` es solo imagen: se ve, pero no choca. El color de los materiales de Blender no
se usa: el juego pone los suyos, siluetas oscuras sobre niebla clara (`src/escenas/colores.ts`).

### Las propiedades de la escena (Scene Properties › Custom Properties)

| Propiedad     | Qué es                                                                           | Si falta                         |
| ------------- | -------------------------------------------------------------------------------- | -------------------------------- |
| `nivel`       | El número del nivel (0 El patio, 1 El pinar…; 99 el de prueba). **Obligatoria.** | error                            |
| `nombre`      | Cómo se llama.                                                                   | «Nivel N»                        |
| `vacio`       | La altura por debajo de la cual un muñeco cayó al vacío.                         | 3 m bajo el sólido fijo más bajo |
| `nieblaCerca` | Desde qué distancia de la cámara empieza la niebla (m), con los dos juntos.      | 3                                |
| `nieblaLejos` | Desde qué distancia ya no se ve nada (m).                                        | 24                               |

### Los objetos

| `tipo`    | Qué es                                                                                                                                                        | Propiedades                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solido`  | Algo que choca: suelo, paredes, troncos, cajas. Una malla.                                                                                                    | `forma`: `caja` (la caja de la malla, la más barata), `cilindro` (de pie, sobre su eje Y) o `malla` (los triángulos tal cual) · `cuerpo`: `fijo`, `cinematico` (lo mueve el guion) o `dinamico` (se empuja y se agarra) · `masa` en kilos (dinámicos, 10) · `rozamiento` (0.8) · `material`: `suelo`, `tela`, `corteza`, `honda` (casi negro) o `lejana` · `invisible`: 1 para que choque sin verse |
| `salida`  | Dónde arranca cada jugador (los pies). Un vacío (Empty); mira hacia su −Y de Blender (ver abajo).                                                             | `jugador`: 1 (el rojo) o 2 (el turquesa). Tiene que haber una de cada una.                                                                                                                                                                                                                                                                                                                          |
| `control` | Un punto de control: la zona que hay que cruzar. Un vacío cubo (Empty › Cube), escalado al tamaño de la zona.                                                 | `orden`: 1, 2, 3… sin saltearse ninguno. La pareja reaparece sobre la **base** de la zona, que tiene que apoyar en el suelo, lado a lado y mirando hacia donde mira la zona.                                                                                                                                                                                                                        |
| `vacio`   | Una zona que cuenta como caída aunque esté más arriba que `vacio` (el fondo de un pozo, un río).                                                              | Un vacío cubo escalado, o una malla (cuenta su caja).                                                                                                                                                                                                                                                                                                                                               |
| `adorno`  | Una forma del juego armada en ese lugar (no choca).                                                                                                           | `forma`: `pino`, `abeto`, `roca`, `mata` o `tronco` (acostado sobre su X) · `alto` (el largo, para el tronco) · `radio` · `semilla` (cambia las ramas y abolladuras)                                                                                                                                                                                                                                |
| `niebla`  | Un jirón de niebla que se corre despacio. Un vacío cubo: su escala X e Y es la mitad del ancho y del alto.                                                    | `opacidad` (0.5) · `velocidad` (0.15; negativa va para el otro lado)                                                                                                                                                                                                                                                                                                                                |
| `secreto` | Dónde está escondido el secreto del nivel: el primero de los dos que entra lo encuentra para la pareja. Un vacío cubo escalado, o una malla (cuenta su caja). | Ninguna. Si el secreto es otra cosa (tocar una campana, abrir un cofre), no hace falta la zona: lo dice el guion.                                                                                                                                                                                                                                                                                   |
| `pieza`   | Una pieza de juego: huacal, palanca, plancha, balancín o bejuco (ver abajo). Una malla: su caja dice dónde va.                                                | `pieza`: `huacal`, `palanca`, `plancha`, `balancin` o `bejuco`, y las propiedades de cada una                                                                                                                                                                                                                                                                                                       |

Hacia dónde mira algo (salidas y puntos de control): su adelante de glTF, el +Z del objeto. Blender, al exportar con
+Y Up, convierte su −Y en ese +Z: en la vista de arriba de Blender, el objeto mira hacia su eje Y negativo.

El nombre de cada objeto es libre, pero el guion encuentra las piezas por nombre (`nivel.pieza("compuerta")`), y los
errores del formato lo nombran: «"masa-rara": `masa` tiene que ser un número».

## Las piezas de juego (TU-12)

Un objeto con `tipo: pieza` y `pieza: <cuál>`. Su malla no se dibuja: solo dice dónde va la pieza y cuánto mide (su
caja, con la rotación y la escala del objeto). La imagen y las físicas las arma el juego (`apps/juego/src/niveles/
piezas.ts`). Basta un cubo de Blender escalado a la medida. Los ángulos van en grados.

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                 | Propiedades                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `huacal`   | Una caja de tablas suelta, del tamaño de la caja: se empuja, se carga entre dos, se apila y hace de contrapeso (sobre una plancha). Si cae al vacío vuelve sola a donde empezó.                                                                                                                                   | `masa` (8 kg) · `rozamiento` (0.7)                                                                                                                                                                                      |
| `palanca`  | Una base abajo y un brazo con bisagra que llega hasta arriba de la caja; la manija es un travesaño a lo ancho (su X), para que la agarren las dos manos. En reposo se inclina hacia su frente (el −Y de Blender) y queda **activa** al llevarla hacia atrás: empujándola desde el frente o jalándola desde atrás. | `angulo` (35°, hacia cada lado) · `umbral` (0.75: qué parte del recorrido) · `vuelve` (1: un resorte la regresa al soltarla, así que está activa mientras alguien la sostiene; 0: queda donde la dejan) · `masa` (2 kg) |
| `plancha`  | Una placa con resorte sobre una base de `hundir` de alto, las dos dentro de la caja. Se hunde con el peso y queda **pisada** con un muñeco o un huacal de 8 kg encima; vuelve a subir al quedar vacía. Conviene que sea baja (12 cm): se sube caminando.                                                          | `peso` (10 kg: los que la hunden del todo) · `hundir` (0.06 m)                                                                                                                                                          |
| `balancin` | Una tabla de tronco del tamaño de la caja, con bisagra sobre un poste que baja 3 m desde debajo del eje. Va a lo largo de su lado más largo. El peso de un lado lo baja y sube el otro.                                                                                                                           | `angulo` (15°, hacia cada lado) · `apoyo` (0.5: dónde va el eje a lo largo, de 0 a 1; corrido, el lado largo pesa más) · `masa` (25 kg)                                                                                 |
| `bejuco`   | Una cadena que cuelga del centro de arriba de la caja hasta su base. Se agarra caminando o saltando con los brazos arriba; colgado, adelante y atrás lo columpian. Que termine a la altura de las manos (1 m sobre el piso desde donde se agarra) y a unos 30 cm del borde. Los muñecos lo atraviesan.            | `segmentos` (uno cada 30 cm) · `masa` (4 kg)                                                                                                                                                                            |

Desde el guion se las busca por nombre, de su clase; si no existe, es un error del nivel:

```ts
nivel.palanca("palanca").activa; // y .recorrido, de 0 (reposo) a 1 (del todo hacia atrás)
nivel.plancha("plancha").pisada; // y .hundida, de 0 a 1
nivel.balancin("balancin").inclinacion; // radianes: positivo si baja el extremo hacia +X de su caja (o −Y de Blender)
nivel.bejuco("bejuco").colgados; // cuántos muñecos cuelgan de él; .segmentos, sus cuerpos
nivel.huacal("huacal").cuerpo; // y .volver(), que lo pone donde empezó
nivel.plancha("plancha").alCambiar((pisada) => {}); // también la palanca; devuelve cómo dejar de escuchar
nivel.pieza("palanca").cuerpo; // el cuerpo principal: el huacal, el brazo, la placa, la tabla o el primer segmento
```

El estado (activa, pisada) se decide después de cada paso. En línea lo decide el anfitrión, que es el que simula y
corre el guion; el invitado recibe todos los cuerpos de las piezas en la foto, cada segmento del bejuco incluido.

## El guion: `guion.ts`

Lo que la escena no puede decir. Exporta `crearGuion(): GuionDeNivel` (ver `apps/juego/src/niveles/guion.ts`), con
estos momentos, todos opcionales:

- `alEmpezar(nivel)`: una vez, con todo armado y los muñecos en la salida.
- `cadaPaso(nivel)`: en cada paso de físicas, antes de `mundo.step()`; para mover lo `cinematico`.
- `alAlcanzar(punto, nivel)`: la pareja alcanzó el punto de control `punto`.
- `alRetomar(punto, nivel)`: la pareja retoma un avance guardado en ese punto; dejá el nivel como estaría al llegar.

`nivel` trae el plano, el mundo de Rapier, los dos muñecos, los pasos, el punto de control actual, `pieza(nombre)` y
las piezas de juego por nombre (`palanca`, `plancha`, `balancin`, `bejuco` y `huacal`, ver arriba). Para el secreto y
el logro (ver abajo) trae también `secreto` y `logro` (si ya los tienen), `encontrarSecreto()` y `lograr()`.

## Secreto y logro

Cada nivel tiene un secreto y un logro (RF-17). Qué son y qué dan está en `convex/premios.ts` (`PREMIOS`, por número
de nivel), con los textos del plan: encontrar el secreto les da a los dos la prenda del nivel para el ropero (un
sombrero, un peinado, una máscara o una forma de pañuelo, RF-20); el logro queda en la lista de cada uno. Un nivel
nuevo agrega su fila ahí; las pruebas de `convex/ropero.test.ts` revisan que cada prenda la dé un solo nivel.

- **El secreto** lo encuentra la zona `secreto` del `.glb`, sola. Si el secreto es otra cosa, el guion llama a
  `nivel.encontrarSecreto()`.
- **El logro** lo decide siempre el guion: `nivel.lograr()` cuando se cumple (cargar la escalera sin botarla, llegar
  sin caer…). Las dos llamadas se pueden repetir: solo cuenta la primera.

El juego avisa arriba al centro («¡Encontraron el secreto!», «Logro: …»). En línea lo guarda en Convex el anfitrión
(`convex/ropero.ts`), y el invitado se entera por Convex; lo que ya tenían de antes no se vuelve a avisar. En el mismo
lugar, sin cuentas, se avisa pero no se guarda.

## Puntos de control y reaparición

No hay derrota (RF-16). El primero de los dos que entra en la zona de un punto de control lo alcanza para la pareja;
nunca se vuelve atrás. El que cae al vacío (por debajo de `vacio`, dentro de una zona `vacio` o a más de 12 m de lo
sólido) reaparece de pie **junto a su compañero**, si este está de pie en terreno firme y hay piso al lado; si no, en
el último punto de control alcanzado. El punto de control se guarda en Convex para retomar (TU-22).

## Los niveles sin Blender: `99-prueba` y `98-piezas`

Sin Blender a mano, sus `escena.glb` se arman con `pnpm niveles` (`scripts/niveles/prueba.mjs` y `piezas.mjs`, con el
exportador de three y las mismas propiedades que pondría Blender; lo común está en `comun.mjs`). Si los cambiás,
volvé a correrlo y subí los `.glb`.

### `98-piezas` (`?escena=nivel&nivel=piezas`)

Las piezas de juego, una tras otra. El patio (salida, tres huacales, dos apilados, y una plancha delante del rojo) →
una compuerta que baja mientras la plancha está pisada (uno se para encima o le ponen un huacal) → punto 1 → una
palanca y otra compuerta que baja mientras alguien la empuja, y queda abajo pasado el punto 2 → punto 2 al borde de
una quebrada de 2.2 m, con un bejuco para cada uno colgando de una rama → punto 3 en la otra orilla → un balancín de
tronco → un escalón de 1.4 m → punto 4, la meta.

### `99-prueba`

El patio (salida y un huacal de 8 kg) → un hueco de 2.5 m con un tablón angosto, donde no caben los dos a la vez →
punto 1 → una compuerta que el guion hunde al llegar al punto 1 → un escalón de 1.5 m para trepar colgándose (o de la
mano del compañero) → punto 2 arriba → punto 3, la meta. El secreto está detrás de la meta, en la mata del rincón (da
el peinado «Cresta»), y el logro, «Mudanza», es subir el huacal hasta arriba del escalón.
