# niveles

Una carpeta por nivel (`00-patio`, `01-pinar`, …, y `99-prueba`) con su escena `escena.glb` y su guion
`guion.ts`. La lista completa está en `docs/plan.html`; la que usa el juego, en `apps/juego/src/niveles/lista.ts`.
Se abren con `?escena=nivel&nivel=<nombre>` (por ahora, `patio`, `pinar`, `prueba` y `piezas`).

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

| `tipo`    | Qué es                                                                                                                                                                                                                          | Propiedades                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solido`  | Algo que choca: suelo, paredes, troncos, cajas. Una malla.                                                                                                                                                                      | `forma`: `caja` (la caja de la malla, la más barata), `cilindro` (de pie, sobre su eje Y) o `malla` (los triángulos tal cual) · `cuerpo`: `fijo`, `cinematico` (lo mueve el guion) o `dinamico` (se empuja y se agarra) · `masa` en kilos (dinámicos, 10) · `rozamiento` (0.8) · `material`: `suelo`, `tela`, `corteza`, `honda` (casi negro) o `lejana` · `invisible`: 1 para que choque sin verse |
| `salida`  | Dónde arranca cada jugador (los pies). Un vacío (Empty); mira hacia su −Y de Blender (ver abajo).                                                                                                                               | `jugador`: 1 (el rojo) o 2 (el turquesa). Tiene que haber una de cada una.                                                                                                                                                                                                                                                                                                                          |
| `control` | Un punto de control: la zona que hay que cruzar. Un vacío cubo (Empty › Cube), escalado al tamaño de la zona.                                                                                                                   | `orden`: 1, 2, 3… sin saltearse ninguno. La pareja reaparece sobre la **base** de la zona, que tiene que apoyar en el suelo, lado a lado y mirando hacia donde mira la zona.                                                                                                                                                                                                                        |
| `vacio`   | Una zona que cuenta como caída aunque esté más arriba que `vacio` (el fondo de un pozo, un río).                                                                                                                                | Un vacío cubo escalado, o una malla (cuenta su caja).                                                                                                                                                                                                                                                                                                                                               |
| `adorno`  | Una forma del juego armada en ese lugar (no choca).                                                                                                                                                                             | `forma`: `pino`, `abeto`, `roca`, `mata` o `tronco` (acostado sobre su X) · `alto` (el largo, para el tronco) · `radio` · `semilla` (cambia las ramas y abolladuras)                                                                                                                                                                                                                                |
| `niebla`  | Un jirón de niebla que se corre despacio. Un vacío cubo: su escala X e Y es la mitad del ancho y del alto.                                                                                                                      | `opacidad` (0.5) · `velocidad` (0.15; negativa va para el otro lado)                                                                                                                                                                                                                                                                                                                                |
| `secreto` | Dónde está escondido el secreto del nivel: el primero de los dos que entra lo encuentra para la pareja. Un vacío cubo escalado, o una malla (cuenta su caja).                                                                   | Ninguna. Si el secreto es otra cosa (tocar una campana, abrir un cofre), no hace falta la zona: lo dice el guion.                                                                                                                                                                                                                                                                                   |
| `pieza`   | Una pieza de juego: huacal, palanca, plancha, balancín, bejuco y las del pinar (ver abajo). Una malla: su caja dice dónde va.                                                                                                   | `pieza`: `huacal`, `palanca`, `plancha`, `balancin`, `bejuco`, `tronco`, `tranca`, `hueso`, `lampara` o `cadejo`, y las propiedades de cada una                                                                                                                                                                                                                                                     |
| `agua`    | Una zona de agua (TU-24): arriba de su caja, la superficie; abajo, el fondo. Flota lo liviano, se hunde lo pesado, corre si tiene corriente. Un vacío cubo escalado, o una malla (cuenta su caja); gira solo alrededor de su Y. | `corriente` (0 m/s, hacia su frente, el −Y de Blender) · `arrastre` (2: qué tan rápido lo mojado toma la velocidad del agua, 1/s) · `caer`: `vacio` (el muñeco que cae se lo lleva el agua: reaparece) o `nadar` (flota y chapotea) · `imagen`: `superficie`, `chorro` (una cortina que cae, a lo ancho de su X) o `nada` (ver abajo)                                                               |

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

## Las piezas del pinar (TU-14)

Las que estrena el nivel 1 (`apps/juego/src/niveles/piezas-pinar.ts` y `cadejo.ts`; su lectura, en
`formato-pinar.ts`). Como las otras, su malla no se dibuja. El tronco, la tranca, el hueso y la lámpara los atraviesan
los muñecos (como al bejuco: si no, el tronco que llevan dos en fila le pegaría en la cabeza al de adelante), pero los
agarran igual, y el rayo de la suspensión sí los ve: sobre el tronco tendido se camina.

| `pieza`   | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                              | Propiedades                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tronco`  | Un tronco escuadrado del tamaño de la caja, a lo largo de su lado más largo. Pesa más de lo que levanta un muñeco solo (5 kg), así que se lleva entre dos; si cae al vacío vuelve solo a donde empezó. Para agarrarlo tiene que estar a la altura de las manos alzadas (sobre caballetes).                                                                                                                                                     | `masa` (9 kg) · `rozamiento` (0.9)                                                                                                                                 |
| `tranca`  | Una barra a lo largo de la x de su caja que se saca jalándola hacia su frente (el −Y de Blender): agarrada y caminando para atrás. Un resorte la vuelve a meter al soltarla, así que está **abierta** mientras alguien la sostiene. Que quede a 25 cm de lo que tenga detrás, para que las manos no agarren eso.                                                                                                                               | `recorrido` (0.45 m) · `umbral` (0.7) · `fuerza` (20 N con la barra afuera del todo) · `masa` (3 kg)                                                               |
| `hueso`   | Para tirárselo al Cadejo. Empieza dormido (quieto donde lo pongan, sobre una horqueta) hasta que lo agarran. Del suelo no se lo puede levantar: si nadie lo agarra vuelve solo a su lugar a los 14 s, y cuando el Cadejo termina de roerlo.                                                                                                                                                                                                    | `masa` (0.6 kg)                                                                                                                                                    |
| `lampara` | Un farol del tamaño de la caja colgado de una cadena: se **enciende** al agarrarlo y queda encendido (su luz es blanca, como los ojos).                                                                                                                                                                                                                                                                                                        | `cadena` (0.5 m: desde arriba de la caja hasta el gancho) · `masa` (1.5 kg)                                                                                        |
| `cadejo`  | El Cadejo, un perrote negro. Su caja es su **corral**: anda por adentro, sobre la base, y no sale. Persigue al muñeco de pie más cercano que esté adentro y, si lo alcanza, lo lame (un empujón que lo tira; no hay derrota) y se queda contento un rato. Si hay un hueso suelto en el corral, se olvida de los muñecos y lo roe. Sin nadie, vuelve a su casa (el centro) y se echa. Es cinemático, sin choques y sin azar: lo mueve el juego. | `velocidad` (2 m/s; un muñeco anda a 1.6) · `lamer` (0.75 m de la trompa) · `roer` (7 s) · `descanso` (1.5 s) · `empujon` (4 m/s: con más de 3.2 el muñeco se cae) |

Desde el guion, como las otras:

```ts
nivel.tronco("tronco").cargadores; // cuántos muñecos lo agarran; .puntas(), .volver()
nivel.tranca("tranca").abierta; // y .recorrido, de 0 a 1, y .alCambiar((abierta) => {})
nivel.hueso("hueso").agarrado; // y .enSuLugar, .volver()
nivel.lampara("lampara").encendida; // .encender() (también desde el guion), .alEncender(() => {})
nivel.cadejo("cadejo").estado; // "echado", "persiguiendo", "al hueso", "royendo", "contento" o "volviendo"
nivel.cadejo("cadejo").alLamer((jugador) => {}); // y .lamidas, .persigue, .volver()
```

En línea el anfitrión decide todo (a quién persigue el Cadejo, la lámpara encendida); el invitado recibe en la foto
el cuerpo del Cadejo (lo anima con lo que anduvo) y el de cada pieza. La lámpara del invitado se enciende cuando la
pareja pasa el punto que la sigue (el guion la enciende en `alRetomar`).

## El agua (TU-24)

Un objeto con `tipo: agua` es una zona de agua: su caja, con la superficie arriba y el fondo abajo (el fondo de
verdad, lo que se pisa, es un sólido aparte). La arma `apps/juego/src/niveles/agua.ts` (su lectura, en
`formato-agua.ts`); estrena en La poza y la reusa el Río Plátano. Lo que hace en cada paso:

- **Flotar.** Cada cuerpo dinámico empuja hacia arriba lo que pesa el agua que desaloja: se mide en puntos repartidos
  por sus colisionadores (cajas, bolas, cápsulas, cilindros y cascos), cada uno con su parte del volumen, así lo que se
  hunde de un lado se endereza. Flota lo que pesa menos que el agua que ocupa: un huacal de tablas o un tronco flotan
  altos. Para que algo se hunda aunque su caja sea grande (una piedra), se dice su densidad en el `userData` de su
  cuerpo (`{ densidad: 2600 }`, kg/m³) o con `nivel.aguas.densidad(cuerpo, 2600)`. Los muñecos son de trapo: flotan
  con la cabeza afuera (750 kg/m³).
- **Arrastre y corriente.** Lo mojado toma de a poco la velocidad del agua (`arrastre`, 1/s): en el agua quieta se
  frena y se aquieta; con `corriente` se va río abajo, hacia el frente de la zona.
- **El nivel.** El guion sube o baja la superficie: `irA(altura, velocidad)` (la poza que se seca, el chorro que se
  corta). Con la superficie en el fondo, no queda agua.
- **Caer al agua.** Un muñeco con la pelvis bajo la superficie cayó al agua: se avisa (`alMojar`, para logros como
  «Secos») y salpica. Con `caer: vacio` (lo de siempre: un río, una poza honda, un chorro) cuenta como caída y
  reaparece junto al compañero o en el punto de control; nunca reaparece en el agua. Con `caer: nadar`, flota y
  `avanzar` lo lleva despacio hacia donde mira, hasta que hace pie. Lo que no es un muñeco no se ahoga: flota o se
  hunde (las piezas que vuelven solas, vuelven al caer al `vacio` de siempre).

Desde el guion:

```ts
const poza = nivel.agua("poza"); // .nivel (la altura de la superficie ahora), .lleno, .fondo, .caer
poza.irA(poza.fondo, 0.4); // la seca a 40 cm por segundo (sin velocidad: de una vez); .quieta cuando llegó
poza.corriente = 0; // m/s hacia su frente
poza.hondura({ x, y, z }); // cuánto está ese punto bajo la superficie (m), o null si está fuera de la zona
nivel.aguas.alMojar((jugador, agua) => {}); // y .caidas ([rojo, turquesa]), .en(punto), .densidad(cuerpo, kg)
```

En línea, el nivel de cada zona y su corriente viajan en la foto: cada zona tiene un cuerpo cinemático sin
colisionadores (su marcador) a la altura de su superficie y corrido en x lo que vale su corriente. El invitado no
simula: dibuja el agua donde dice el marcador, y las salpicadas donde ve caer las cosas.

## Las piezas de la poza (TU-24)

Las que estrena el nivel 2 (`apps/juego/src/niveles/piezas-poza.ts` y `sucia.ts`; su lectura, en `formato-poza.ts`).
Como las otras, su malla no se dibuja.

| `pieza`     | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Propiedades                                                                                                      |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `balsa`     | Donde flota la balsa amarrada y cuánto mide; avanza hacia el + de su lado más largo. Sus troncos son piezas `tronco` llamadas `<nombre>-1`, `-2`…, largas a lo largo de su X. Se amarran solos cuando están flotando cerca de su caja (`astillero`), o cuando el guion llama `amarrar(false, dónde)`: ahí se juntan y la balsa baja sola al agua hasta su caja. Amarrada flota entera y tiene dos remos: rema el que va a bordo, de pie junto a su remo, con los brazos alzados. Cada remo empuja de su lado: uno solo la hace girar; los dos, derecho. Al que va a bordo, quieto, la balsa lo lleva. | `troncos` (3) · `remo` (30 N, lo que empuja cada uno) · `astillero` (1.6 m; 0: solo la amarra el guion)          |
| `tendedero` | Una cuerda en bajada, de la punta de arriba del lado −X de la caja a la de abajo del lado +X, con postes y una polea. El que agarra la manija con las dos manos (que cuelgue `manija` debajo de la cuerda, 1.2 m sobre el piso desde donde se agarra) baja como en tirolesa, frena al final y suelta. Sin nadie, la polea vuelve sola arriba.                                                                                                                                                                                                                                                         | `velocidad` (3.5 m/s) · `manija` (0.35 m) · `ropa` (5 prendas, en un hilo al lado) · `hilo` (0.35 m, a lo ancho) |
| `batea`     | Una batea de madera del tamaño de la caja, llena de pepitas, con el peso abajo: agarrada de las puntas (cada uno de un lado, con la mano de adentro) cuelga derecha. Pesa más de lo que levanta un muñeco solo. Ladeada más que `derrame`, se bota: las pepitas saltan y a los 2 s vuelve llena a su lugar (también si la dejan tirada lejos). Los muñecos la atraviesan, como al tronco.                                                                                                                                                                                                             | `masa` (9 kg) · `pepitas` (12) · `derrame` (30°)                                                                 |
| `piedra`    | Una piedra redonda (una bola del tamaño de la caja): se empuja caminando contra ella, rueda y en el agua se hunde.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `masa` (30 kg) · `densidad` (2600 kg/m³, para el agua)                                                           |
| `sucia`     | La Sucia, la lavandera gruñona. Su caja es su lavadero: lava al fondo, mirando hacia el frente. Al terminar de lavar, si hay alguien en la caja se voltea hacia el más cercano, alza el guacal (`apuntar`: lo que tienen para salirse) y le tira el agua: un guacalazo que lo tumba hacia afuera (no hay derrota; el que cargaba algo, lo bota). Cinemática, sin choques y sin azar.                                                                                                                                                                                                                  | `lavar` (2.5 s) · `apuntar` (0.8 s) · `empujon` (2.6 m/s: con más de 3.2 lo tumba)                               |

```ts
nivel.balsa("balsa").estado; // "suelta", "amarrando" o "amarrada"; .remeros, .aBordo, .donde(), .casa, .volver()
nivel.tendedero("tendedero-rojo").recorrido; // de 0 (arriba) a 1 (abajo); .colgados, .polea, .volver()
nivel.batea("batea").llena; // y .ladeo, .cargadores, .botadas, .alBotar(() => {}), .volver()
nivel.piedra("piedra-1").cuerpo; // y .volver()
nivel.sucia("sucia").estado; // "lavando", "apuntando" o "tirando"; .apunta, .salpicadas, .falta, .alSalpicar(j => {})
```

En línea viajan en la foto los troncos, la polea, la batea, las piedras, La Sucia y su guacal: el invitado ve las
amarras cuando los troncos están uno al lado del otro, mueve los remos si la balsa avanza, dibuja los brazos de La
Sucia hacia el guacal y el agua que sale cuando lo tira, y bota las pepitas cuando ve la batea ladeada.

## El guion: `guion.ts`

Lo que la escena no puede decir. Exporta `crearGuion(): GuionDeNivel` (ver `apps/juego/src/niveles/guion.ts`), con
estos momentos, todos opcionales:

- `alEmpezar(nivel)`: una vez, con todo armado y los muñecos en la salida.
- `cadaPaso(nivel)`: en cada paso de físicas, antes de `mundo.step()`; para mover lo `cinematico`.
- `alAlcanzar(punto, nivel)`: la pareja alcanzó el punto de control `punto`.
- `alRetomar(punto, nivel)`: la pareja retoma un avance guardado en ese punto; dejá el nivel como estaría al llegar.

`nivel` trae el plano, el mundo de Rapier, los dos muñecos, los pasos, el punto de control actual, `pieza(nombre)` y
las piezas de juego por nombre (`palanca`, `plancha`, `balancin`, `bejuco`, `huacal`, `tronco`, `tranca`, `hueso`,
`lampara` y `cadejo`, ver arriba). Para el secreto y
el logro (ver abajo) trae también `secreto` y `logro` (si ya los tienen), `encontrarSecreto()` y `lograr()`.

## Mecanismos: lo que arma el guion (TU-13)

Lo que se mueve y no es una pieza de juego lo arma el guion en `alEmpezar` con los sólidos del `.glb`, sin
propiedades nuevas: `apps/juego/src/niveles/mecanismos/`. Cada uno recibe el nivel y los nombres de sus sólidos, y el
guion llama a su `pasar()` en `cadaPaso`.

| Mecanismo   | Con qué sólidos                                                                       | Qué hace                                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `porton`    | Una hoja `dinamico` derecha y una `palanca` (la aldaba)                               | Le pone a la hoja una bisagra vertical donde se le diga. Cerrada y sin nadie en la aldaba, no gira; abierta del todo una vez, ya no se traba. `abrir()` la deja abierta (al retomar).                                                                                     |
| `escalera`  | Un sólido `dinamico` de caja, largo a lo largo de su x                                | Cargada por los dos (cada uno la agarra), se mantiene derecha; al llegar al pie de la pared apuntando hacia ella, se apoya sola como rampa hasta arriba (queda trabada). Dice si se `botó` (tocó el suelo con una punta) y, tirada sin nadie, vuelve sola a donde empezó. |
| `lamina`    | Un sólido fijo (un techo)                                                             | El que está parado encima (y no agarra nada) se resbala hacia `bajada`: caminando se sube más despacio; quieto, se va para abajo.                                                                                                                                         |
| `camion`    | Un sólido `cinematico` (mejor `forma: malla`, para que choque con su forma de verdad) | Al `arrancar()` maniobra de atrás para adelante a lo largo de un eje; `frenar()` lo para. Puede llevar encima un punto de control: su zona y sus lugares viajan con él.                                                                                                   |
| `compuerta` | Una hoja `cinematico` y una `palanca` con `vuelve` (TU-24)                            | Sube mientras alguien sostiene la palanca y baja sola al soltarla, más rápido. Abierta desvía el agua: vacía las zonas de agua que `corta` (un chorro que cae sobre el camino) y llena las que `larga` (lo que sale por ella). `abrir()` la deja abierta.                 |

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

## Los niveles sin Blender: `00-patio`, `01-pinar`, `99-prueba` y `98-piezas`

Sin Blender a mano, sus `escena.glb` se arman con `pnpm niveles` (`scripts/niveles/patio.mjs`, `pinar.mjs`,
`prueba.mjs` y `piezas.mjs`, con el exportador de three y las mismas propiedades que pondría Blender; lo común está en
`comun.mjs`). Si los cambiás, volvé a correrlo y subí los `.glb`.

### `00-patio` (`?escena=nivel&nivel=patio`), el nivel 0

Tegucigalpa, el 31 de diciembre por la mañana. Cada misión termina en un punto de control, así que `&punto=N` empieza
después de la misión N (`&punto=4`, en la losa, listos para saltar al camión):

1. Despiertan tirados de espaldas en el montón de trapos (el guion les quita la firmeza) y se levantan solos → punto
   1 frente al portón. Hay trapos sueltos para probar cada brazo.
2. De a dos: el portón de tablas está trabado mientras nadie empuje la aldaba, una palanca a su lado → punto 2 en el
   solar.
3. De a dos: la escalera, sobre dos barriles, pesa 9 kg (cada uno levanta 5); se la carga con la escalera entre los
   dos y los brazos arriba hasta el muro de la casa del vecino (2.2 m: solo se trepa hasta 1.9), donde se apoya sola
   → punto 3 en la repisa. El logro, «A la de tres», es no botarla.
4. El techo de lámina resbala (6 m/s² hacia el solar) → punto 4 en la losa.
5. Desde la losa, el camión de la mudanza maniobra en la calle (que cuenta como caída); la meta va en su palangana y
   frena cuando sube el primero → punto 5.

El secreto, la piñata olvidada en el palo de mango, es una zona `secreto` en el rincón, debajo de la piñata.

### `01-pinar` (`?escena=nivel&nivel=pinar`)

El nivel 1 (TU-14): La Esperanza, Honduras. Un bosque de pinos con neblina clara, cercos de madera y una pulpería al
final, y el Cadejo. Sube de oeste a este; cada misión termina en un punto de control (`&punto=N` empieza en la
misión N + 1):

1. **El cerco** (2.9 m). Un muñeco trepa colgándose solo de lo fijo, y a un huacal (que se mueve) se sube de un salto,
   con impulso. Se empuja el cajón (1.5 × 0.4 m) contra el cerco, se levanta el huacal del tocón (5 kg: uno solo
   puede) y se lo pone encima, adelante: saltando al cajón y después al huacal (90 cm) se trepa el cerco. Desde el
   cajón solo no se llega. Del otro lado se baja por una leñera → punto 1.
2. **El balancín**, de a dos. El lado de tierra pesa más: la punta de la quebrada queda arriba, junto a la otra
   orilla (2.85 m más alta). El que cruza la vuelca en cuanto pasa el eje, salvo que el otro haga de contrapeso en la
   punta de tierra → punto 2. El guion lo pone ya inclinado al empezar.
3. **El bejuco** sobre un barranco de 2.15 m, uno para cada uno: se columpia y se suelta sobre la otra orilla → punto 3.
4. **El tronco**, de a dos: 5.6 m y 9 kg sobre dos caballetes. Se carga en fila con la mano derecha, cerca del medio;
   el de adelante se para en el borde de la zanja (1.6 m, la otra orilla 40 cm más alta: ni se salta ni se le llega
   con las manos) y lo sueltan: queda de puente y se cruza caminando → punto 4. Si queda tirado en el suelo sin servir
   de puente, a los 3 s vuelve a los caballetes.
5. **El corral del Cadejo**, de a dos. Uno agarra el hueso de la horqueta de la entrada y se lo tira (salta y lo
   suelta en el aire); el otro saca la tranca, junto al portón del fondo: el portón se abre mientras la sostiene, y el
   del hueso pasa → punto 5, y el portón queda abierto. Solo no se puede: al soltar la tranca el portón se cierra
   antes de llegar. Llegar al punto 5 sin ninguna lamida da el logro, «Ni una lamida».
6. **La pulpería**: agarrar la lámpara del alero la enciende y se abre la puerta; adentro está la meta (punto 6).

El secreto, «el nido en el pino más alto», está arriba de tres escalones de leña (de 1.5 m) al pie del pino, junto a
la pulpería: se trepan colgándose y la zona `secreto` está en el nido (da el peinado «Greñas de nido»).

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

### `02-poza` (`?escena=nivel&nivel=poza`)

El nivel 2 (TU-24): el río Guayape, Honduras. Un río de piedras redondas, tendederos de ropa y una represa de
madera; lava ahí La Sucia. Estrena el agua, la balsa y la compuerta. Lo arma `scripts/niveles/poza.mjs` (`pnpm
niveles`). Va de oeste a este, río arriba; cada misión termina en un punto de control (`&punto=N` empieza en la
misión N + 1):

1. **Amarrar la balsa**, de a dos. Tres troncos (9 kg) sobre caballetes, uno en cada carril: se los lleva en fila con
   la mano derecha, derecho, hasta el astillero (otros caballetes junto al agua). Uno solo los arrastra, pero no los
   sube. Con los tres en el astillero se amarran, la balsa baja sola al remanso y queda junto al muelle → punto 1,
   que va en la balsa (el que se cae al río reaparece a bordo). Los troncos tirados o caídos al agua vuelven solos.
2. **Remar**, de a dos. El río baja a 0.85 m/s; cada uno rema de su lado (de pie junto a su remo, con los brazos
   alzados). Con los dos la balsa sube derecho; con uno solo da vueltas y la corriente no la deja pasar. Al pie de la
   represa el agua está quieta: ahí llega sola al embarcadero → punto 2.
3. **La compuerta**, de a dos. El chorro de la represa cae sobre el escalón (1.4 m) y sobre la cara de la represa
   (otros 1.4 m) y se lleva al que trepa. Uno empuja la palanca del embarcadero: la compuerta sube, el agua sale por
   abajo y el chorro se corta mientras la sostiene; el otro trepa → punto 3, en la corona, y la compuerta queda
   abierta. Solo, al soltar la palanca el chorro vuelve antes de llegar.
4. **El tendedero**: dos cuerdas sobre la poza, de la corona a la isla, una para cada uno; se baja colgado de la
   polea como en tirolesa → punto 4, en la isla. El que se suelta antes cae a la poza.
5. **Desviar el agua**: la quebrada que llena la poza entra por la boca, entre la isla y un peñón. Empujando las dos
   piedras redondas de la isla adentro de la boca, el agua se va por la acequia, la quebrada de abajo y la poza se
   secan, y se baja caminando por el fondo en rampa → punto 5, en lo hondo.
6. **La batea**, de a dos: llena de pepitas (9 kg), sobre una piedra en lo hondo. Se la agarra de las puntas, cada
   uno con la mano de adentro, y se la sube por la rampa hasta la mesa de la orilla, junto al lavadero de La Sucia,
   sin ladearla más de 30°. Dejarla llena en la mesa hace aparecer la meta → punto 6. Uno solo no la levanta: se ladea
   y se bota. La Sucia le tira agua al que se queda en su lavadero cuando termina de lavar (cada 3.5 s): hay que
   entrar recién cuando empieza.

El secreto, «una pepita de oro en el fondo de la poza», está en un hoyo en lo más hondo, junto a la represa (la zona
`secreto`): se llega con la poza seca. El logro, «Secos», es llegar a la meta sin que ninguno haya caído al agua (el
río, la poza, la quebrada o el chorro). De noche no va la trampa del mecate: en la represa uno sostiene la palanca
lejos del otro.
