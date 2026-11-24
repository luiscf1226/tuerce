# niveles

Una carpeta por nivel (`00-patio`, `01-pinar`, …, y `99-prueba`) con su escena `escena.glb` y su guion
`guion.ts`. La lista completa está en `docs/plan.html`; la que usa el juego, en `apps/juego/src/niveles/lista.ts`.
Se abren con `?escena=nivel&nivel=<nombre>` (por ahora, `patio`, `pinar`, `prueba`, `piezas` y `tren`).

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

### Cómo se ve cada nivel (TU-61)

El color de Blender no se usa. Lo que lleva `material: suelo` se viste con la textura del lugar, en grises, y eso se
elige en código, por el `numero` de la escena, en `apps/juego/src/niveles/vestido.ts` (no hace falta volver a
exportar el `.glb`):

| `suelo`     | Qué es                                   | Niveles                         |
| ----------- | ---------------------------------------- | ------------------------------- |
| `tierra`    | Tierra apisonada con piedritas y grietas | patio, calle, cafetal, pruebas  |
| `pinocha`   | Agujas de pino caídas                    | pinar                           |
| `arena`     | Arena de río o de playa, con ondas       | poza, minga                     |
| `sillar`    | Bloques de piedra labrada con musgo      | Xibalbá                         |
| `grava`     | Balasto de la vía, piedra suelta         | tren, puente                    |
| `hojarasca` | Hojas caídas de la selva                 | río, medianoche                 |
| `empedrado` | Piedras bola con juntas oscuras          | trenzas                         |
| `pasto`     | Briznas cortas y tupidas                 | canales, garrucha, llano, pampa |
| `piedra`    | Roca oscura con grietas                  | mina                            |

La textura va en metros del mundo (no se estira según el tamaño de cada caja), por arriba; los costados llevan tierra
cortada (la roca y el sillar siguen con lo suyo) y quedan más oscuros, así se lee el borde de cada plataforma. La
calle pone además sus piedras bola encima (su guion).

En `vestido.ts` también va el **primer plano**: `abajo` (`hojas`, `pasto` o `piedras`) crece en el borde de abajo de
la imagen y `arriba` (`pino` u `hojas`) cuelga en las esquinas de arriba, casi negras y desenfocadas, altas en las
orillas y apenas asomadas al medio; se corren con la cámara (paralaje). Con `&vista=todo` no se ven.

Los muñecos y las piezas sueltas de más de 30 cm (`cuerpo: dinamico`) llevan una **sombra de contacto** debajo, que se
achica y se aclara con la altura (`apps/juego/src/imagen/sombras.ts`): no hay que hacer nada en Blender.

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

## Las piezas de Xibalbá (TU-26)

Las que estrena el nivel 4 (`apps/juego/src/niveles/piezas-xibalba.ts` y `murcielagos.ts`; su lectura, en
`formato-xibalba.ts`). Como las otras, su malla no se dibuja: solo dice dónde va la pieza y cuánto mide.

| `pieza`       | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Propiedades                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `bloque`      | Un bloque de piedra labrada del tamaño de la caja. Si pesa más de lo que levanta un muñeco solo (5 kg), mientras no lo agarren los dos no se mueve de costado (ni empujándolo ni arrastrándolo): solo cae, derecho. Entre dos se carga y se sube caminando por gradas de 30 cm. Los muñecos chocan con él: sirve de escalón. Si cae al vacío vuelve solo a donde empezó.                                                                                                                                         | `masa` (9 kg) · `rozamiento` (1)                                                                                                     |
| `doble`       | La plancha doble: dos placas de piedra, una en cada punta del lado más largo de la caja (cuadradas, del ancho del lado corto). Queda **pisada** solo con las dos hundidas a la vez.                                                                                                                                                                                                                                                                                                                              | `peso` (15 kg por placa: solo un muñeco) · `hundir` (0.06 m)                                                                         |
| `estela`      | Una estela labrada (la caja) que gira sobre su eje de pie, con dos varas a lo largo de su x, a `altura` de la base y hasta `brazo` del eje. **Trabada** mientras no la agarren los dos; girándola `angulo` (su frente hacia su +x) queda **alineada** y ya no se mueve.                                                                                                                                                                                                                                          | `angulo` (90°) · `brazo` (1.5 m) · `altura` (1 m) · `masa` (40 kg)                                                                   |
| `pelota`      | Una pelota de hule (una esfera dentro de la caja) que rebota. Se agarra con las dos manos; saltando y soltándola en el aire, vuela. Tirada en el suelo vuelve sola a su lugar.                                                                                                                                                                                                                                                                                                                                   | `masa` (1.5 kg) · `rebote` (0.6) · `vuelve` (5 s)                                                                                    |
| `antorcha`    | Una antorcha grande: el palo a lo alto de la caja y un travesaño a lo ancho, a un tercio de abajo (que quede a la altura de las manos: en un poste). Empieza **encendida**. Llevada con las dos manos va derecha (**bien llevada**). Tirada vuelve sola a su lugar, encendida. El fuego viaja en la foto de la red: el invitado lo ve prendido o apagado.                                                                                                                                                        | `masa` (1.2 kg) · `vuelve` (4 s)                                                                                                     |
| `llave`       | La llave de jade: una placa clara labrada. Se lleva con una mano o con las dos; el guion la **encaja** en su cerradura (y ya no choca con nada). Tirada vuelve sola a su lugar.                                                                                                                                                                                                                                                                                                                                  | `masa` (0.8 kg) · `vuelve` (4 s)                                                                                                     |
| `murcielagos` | Los murciélagos de Xibalbá. Su caja es el túnel: cuelgan de `perchas` en el techo (repartidas a lo largo, alternando de lado). Una antorcha encendida alumbra hasta `radio`. Si una antorcha encendida queda desatendida en el túnel (nadie la lleva con las dos manos) o pasa por debajo de una percha (a menos de `despertar`), vuelan y la **apagan**. Al que anda a oscuras en el túnel lo **espantan**: un aletazo que lo tira hacia el −x de la caja (la entrada). Cinemáticos y sin azar, como el Cadejo. | `cuantos` (9) · `radio` (3 m) · `velocidad` (4.5 m/s) · `empujon` (4 m/s) · `descanso` (1.5 s) · `perchas` (3) · `despertar` (0.9 m) |
| `guacamayas`  | Guacamayas que vuelan en círculos dentro de su caja. Solo imagen: no tienen cuerpo.                                                                                                                                                                                                                                                                                                                                                                                                                              | `cuantas` (6)                                                                                                                        |

```ts
nivel.bloque("bloque").cargadores; // y .libre, .volver(), .ponerEn(posicion)
nivel.doble("planchas").pisada; // y .hundidas, .alCambiar((pisada) => {})
nivel.estela("estela").alineada; // y .angulo, .girando, .alAlinear(() => {}), .alinear()
nivel.pelota("pelota").agarrada; // y .enSuLugar, .volver()
nivel.antorcha("antorcha").encendida; // y .bienLlevada, .llevador, .llama(), .encender(), .apagar(), .alApagar()
nivel.llave("llave").encajada; // y .encajar(posicion), .volver()
nivel.murcielagos("murcielagos").apagadas; // y .espantados, .estado, .alApagar(), .alEspantar((jugador) => {})
```

Lo que da hacia la cámara puede ser bajo y aun así no dejar pasar: un sólido `invisible` cuyo nombre termina en
`-baranda` lo vuelve el guion de Xibalbá una baranda (`soloParaMunecos`), que choca solo con los muñecos; la cámara
y lo suelto no la ven. Un muro de 90 cm, en cambio, se trepa.

## Las piezas del tren bananero (TU-27)

Las que estrena el nivel 5 (`apps/juego/src/niveles/piezas-tren.ts` y `duende.ts`; su lectura, en `formato-tren.ts`).
Como las otras, su malla no se dibuja. El racimo, el sombrero y la bomba de la dresina los atraviesan los muñecos
pero los agarran igual.

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                    | Propiedades                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vagon`    | Un vagón sobre rieles del tamaño de la caja: más alto que 1.5 m es un furgón, si no una plataforma con barandas. Rueda empujado a lo largo de su lado más largo (su frente es su +x) y se **engancha** al vagón que toca con su punta de adelante. Las ruedas (los 35 cm de abajo) son solo imagen.                                                                                                                                  | `masa` (30 kg) · `adelante` y `atras` (0 m: cuánto rueda hacia cada lado; con los dos en 0 no se mueve) · `roce` (40 N por m/s)                                                 |
| `dresina`  | Una plataforma del tamaño de la caja con una bomba de balancín a lo largo, sobre un poste. Cinemática: va por su vía (el guion se la da, `seguir`; si no, derecho hacia su +x). Cada vez que la bomba pasa de un lado al otro la apura; la cuesta la frena (o la apura de bajada) y los rieles de a poco. El que agarra su manija se cuelga y la baja: se bombea de a dos, uno arriba y otro abajo. Lo que va encima viaja con ella. | `impulso` (0.55 m/s por bombeo) · `roce` (0.2 por s) · `angulo` (10°) · `bomba` (1.15 m: el eje sobre la plataforma) · `velocidad` (2.2 m/s) · `recorrido` (10 m, sin otra vía) |
| `grua`     | Su caja es el mástil. Arriba, un brazo de `brazo` que mira hacia el frente de la caja (donde recoge) y un gancho que cuelga de su punta. Mientras el guion la manda (`mandar(true)`, con una palanca), el gancho baja a `bajo`; el racimo que alguien le acerca agarrado se engancha. Al soltar la palanca lo sube a `alto`, gira `giro` a la izquierda, lo suelta y vuelve.                                                         | `brazo` (3.2 m) · `giro` (90°) · `bajo` (1.7 m) · `alto` (3.6 m), sobre la base del mástil                                                                                      |
| `racimo`   | Un racimo de guineos que cuelga de su tallo, del tamaño de la caja. Empieza quieto en su lugar hasta que lo agarran; tirado en el suelo vuelve solo a los 3 s (las manos no llegan al suelo).                                                                                                                                                                                                                                        | `masa` (4 kg: uno solo lo carga; con más de 5, no)                                                                                                                              |
| `sombrero` | El sombrero del Duende. Quieto en su lugar hasta que lo agarran.                                                                                                                                                                                                                                                                                                                                                                     | `masa` (0.4 kg)                                                                                                                                                                 |
| `duende`   | El Duende: su caja es su casa (se para en el centro de la base, mirando al frente). Cinemático, sin choques ni azar. Cuida las palancas que le encarga el guion (`cuidar(palanca, agujero)`): la que quedó movida, sin nadie que la agarre ni nadie a menos de `vista`, la vuelve a su lugar saliendo por el agujero de al lado. Con el sombrero suelto a su alcance se lo pone y las deja en paz.                                   | `vista` (3.5 m) · `viaje` (0.4 s: lo que tarda bajo tierra de un agujero a otro)                                                                                                |

```ts
nivel.vagon("vagon-1").enganchados; // .corrido, .puntas(), .alEnganchar((otro) => {}), .llevar(posicion, giro)
nivel.dresina("dresina").seguir(via, () => cambio.activa); // .avance, .velocidad, .bombeos, .porElDesvio, .frenar()
nivel.grua("grua").mandar(palanca.activa); // .estado, .racimo, .alEnganchar(), .alSoltar(), .volver()
nivel.racimo("racimo").colgado; // .agarrado, .colgarDe(cuerpo, punto), .descolgar(), .volver()
nivel.duende("duende").cuidar(nivel.palanca("cambio"), { x, y, z }); // .contento, .cambios, .ponerSombrero()
```

Y los mecanismos del nivel (`mecanismos/via.ts` y `mecanismos/tren.ts`): `crearVia(puntos, { desde, puntos })` (una vía
de tramos rectos con un cambio y su desvío), `crearTren` (la locomotora y sus vagones salen de una estación y llegan a
otra a la hora, con un pito de vapor), `crearLevadizo` (un puente que gira sobre su punta de +x) y `crearRomana` (los
racimos que se sueltan bajo una plancha alta se cuelgan de sus ganchos y pesan).

## Las piezas de la calle (TU-25)

Las que estrena el nivel 3 (`apps/juego/src/niveles/piezas-calle.ts` y `sin-bueyes.ts`; su lectura, en
`formato-calle.ts`). Como las otras, su malla no se dibuja. Las pesas, los engranajes, las campanas y la Carreta sin
bueyes son cinemáticos (los mueve la pieza, a paso fijo y sin azar); la carreta es dinámica.

| `pieza`      | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                 | Propiedades                                                                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `carreta`    | Una carreta de dos ruedas; la caja va de abajo de las ruedas a arriba de las barandas y mira hacia su +x. Corre por un riel a lo largo de su x (inclinado `pendiente`): sola no frena, la cuesta la lleva. Se empuja caminando contra ella (90 kg en 12°: uno solo no la mueve) y se monta (el muñeco anda respecto de lo que pisa). Con `empina`, la caja gira sobre el eje y se empina si el peso queda detrás. | `masa` (90 kg) · `adelante` y `atras` (5 y 0 m de riel desde donde empieza) · `pendiente` (0°) · `rozamiento` (40 N·s/m) · `eje` (0.5) · `empina` (0°: fija al eje) · `cabecea` (4°) · `contrapeso` (12 kg en las varas) · `llegada` (0 m: en los últimos metros frena sola) |
| `sin-bueyes` | La Carreta sin bueyes: rueda sola a lo largo de la x de su caja, hasta `recorrido` y de vuelta, sin frenar nunca. Mientras anda no choca con nada, pero al muñeco que alcanza lo saca hacia donde empieza el recorrido (un empujón que lo tira). Solo la para el guion (`frenar`): se detiene donde está y choca como madera.                                                                                     | `recorrido` (8 m) · `velocidad` (3.5 m/s) · `espera` (0.6 s en cada punta) · `empujon` (4.5 m/s) · `frenada` (6 m/s²)                                                                                                                                                        |
| `pesa`       | Una pesa del reloj colgada de su cadena, con una manija a lo ancho (la x de la caja) abajo, a 1.75 m del suelo (se salta para colgarse). El que se cuelga la baja `recorrido`; abajo del todo se traba.                                                                                                                                                                                                           | `recorrido` (0.4 m) · `bajada` (0.35 m/s) · `subida` (0.15 m/s) · `cadena` (2 m, desde arriba de la caja)                                                                                                                                                                    |
| `engranaje`  | Una rueda dentada, o con `aguja: 1` una aguja del reloj (de largo, el radio de la caja), que gira sobre la z de su caja con la pesa `pesa-N`: da `vueltas` cuando la pesa baja todo. No vuelve atrás.                                                                                                                                                                                                             | `pesa` (1) · `vueltas` (1; positivo como el reloj, visto desde su +z) · `desde` (0°: hacia arriba) · `dientes` (12) · `aguja` (0)                                                                                                                                            |
| `campana`    | Una campana colgada (su caja), que se columpia sobre su yugo, con su soga hasta una manija a lo ancho. Colgarse de la manija la baja `recorrido` y la campana suena (y queda `sonando` un rato); para volver a sonar, la manija tiene que subir.                                                                                                                                                                  | `soga` (3 m, desde abajo de la campana) · `adelante` (0 m: la soga cuelga hacia el +z de la caja) · `recorrido` (0.35 m) · `sonar` (1 s)                                                                                                                                     |
| `alfombra`   | Una alfombra de aserrín del tamaño de la caja, sobre el suelo. Cualquier parte de un muñeco que la toque la deja marcada (una pisada cada 35 cm). Se busca en el mundo con los cuerpos como quedaron, así el invitado ve las mismas pisadas.                                                                                                                                                                      | `semilla` (el dibujo)                                                                                                                                                                                                                                                        |

Desde el guion:

```ts
nivel.carreta("carreta").avance; // y .velocidad, .empinada, .encima, .frenar(si), .trabar(), .ponerEn(m), .volver()
nivel.sinBueyes("carreta-sin-bueyes").frenar(true); // y .estado, .avance, .sacados, .alSacar((jugador) => {}), .volver()
nivel.pesa("pesa-1").llego; // y .bajada, .colgados, .bajar()
nivel.engranaje("minutero").angulo; // radianes desde arriba, como las agujas
nivel.campana("campana-1").sonando; // y .campanadas, .alSonar(() => {})
nivel.alfombra("alfombra-1").intacta; // y .pisadas, .alPisar(() => {})
```

## Las piezas del río (TU-28)

Las que estrena el nivel 6, el Río Plátano (`apps/juego/src/niveles/piezas-rio.ts` y `sisimite.ts`; su lectura, en
`formato-rio.ts`). Como las otras, su malla no se dibuja. El agua es la de La poza.

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Propiedades                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pipante`  | Una canoa de un solo tronco del tamaño de la caja, con el piso arriba de la caja; avanza hacia el + de su lado más largo. Flota y gira solo alrededor de su Y. Empuja el que va de pie en la popa (el tercio de atrás) con los brazos alzados: la pértiga se clava de un lado, así que sola lo tuerce. El que va en la proa con los brazos alzados lleva el rumbo: gira el pipante hacia donde él mira. Al que va a bordo, quieto, lo lleva.                                                                                                                                                                           | `masa` (30 kg) · `pertiga` (70 N) · `lado` (0.45 m: dónde se clava la pértiga) · `timon` (6: qué tan fuerte endereza el de la proa)                         |
| `puente`   | Un puente colgante a lo largo del lado más largo de la caja: el piso, a la altura de arriba de la caja en las puntas, se comba hacia el medio, con barandas de soga (atajan a los muñecos, no a lo que llevan en las manos). Baja y se mece con los que van encima. Le faltan tablas en `huecos` lugares (cada uno en el medio de su parte del largo). Una tabla (las piezas `tronco` `<nombre>-1`, `-2`…) que se suelta tendida sobre un hueco, apoyada de los dos lados, queda clavada, si la llevaban entre dos (la que uno solo arrastra hasta ahí, no).                                                           | `comba` (0.25 m) · `huecos` (2) · `hueco` (1.8 m) · `mecer` (0.04 m por muñeco)                                                                             |
| `palmera`  | Una palmera de pie del tamaño de la caja, mirando hacia su frente. Una soga cuelga del cogollo hasta una manija, junto al tronco, de costado: jalándola caminando hacia atrás (como la tranca), la palmera se dobla hacia atrás hasta que el cogollo toca el suelo; un resorte la endereza. Doblada del todo y soltada la soga, se endereza de golpe y lanza hacia su frente al que esté en el cogollo. Los muñecos la atraviesan.                                                                                                                                                                                     | `angulo` (85°) · `soga` (2.4 m: lo que se jala) · `lado` (1.1 m: a qué costado cuelga la manija) · `fuerza` (20 N) · `lanzar` (6.5 m/s) · `elevacion` (35°) |
| `sisimite` | El Sisimite, un gigante peludo con los pies al revés, dormido boca arriba en su caja (12 × 2.6 × 3.4 m; su forma se escala con ella), con los pies hacia el − de su lado largo. Se lo trepa como a un cerro: los pies (1 m) y las canillas (1.25 m más) colgándose; las rodillas, los muslos, la panza y el pecho (2.6 m, la cumbre) caminando, y se baja por el brazo que tiene estirado sobre la cabeza. Respira. Se despierta si alguien le cae encima de lo alto o le pisa la cara: abre los ojos, se alza, se sacude y tumba a los que tiene encima (no hay derrota), y se vuelve a dormir. Cinemático, sin azar. | `aterrizaje` (3.6 m/s: cayéndole encima más rápido, lo despierta; un salto no) · `revolverse` (3 s) · `empujon` (2.5 m/s)                                   |

```ts
nivel.pipante("pipante").pertiguero; // y .timonel (0, 1 o null), .aBordo, .rumbo, .encima(p), .casa, .volver()
nivel.puente("puente").huecos; // [true, false]: cuáles tienen su tabla; .faltan, .tablas, .hueco(i), .reparar(), .alClavar(i => {})
nivel.palmera("palmera").estado; // "derecha", "doblada" o "disparando"; .doblada, .jalada, .cogollo(), .lanzados, .alLanzar(j => {})
nivel.sisimite("sisimite").ojos; // y .estado ("dormido" o "despierto"), .despertares, .encima(p), .alDespertar(j => {}), .volver()
```

En línea viajan en la foto el pipante, el piso del puente y sus tablas (las clavadas se vuelven cinemáticas), el tronco
de la palmera y su manija, y el Sisimite: el invitado mueve la pértiga si ve avanzar el pipante, dibuja la soga y le
abre los ojos al Sisimite cuando lo ve alzado.

## Las piezas de Las trenzas (TU-40)

Las que estrena el nivel 7, Antigua (`apps/juego/src/niveles/piezas-trenzas.ts` y `sombreron.ts`; su lectura, en
`formato-trenzas.ts`). Como las otras, su malla no se dibuja. Los cabos del nudo, la rienda de la mula y el balde los
atraviesan los muñecos, pero los agarran igual.

| `pieza`      | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                | Propiedades                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `nudo`       | Dos cuerdas trenzadas a lo largo del lado más largo de la caja, con un nudo en el medio y un cabo (una barra de través, para las dos manos) en cada punta. Cada cabo se jala hacia afuera, agarrado y caminando para atrás (como la tranca); un resorte lo vuelve a meter. Con los dos cabos jalados a la vez el nudo se afloja de a poco hasta **desatarse**; con uno solo, se aprieta.                         | `recorrido` (0.5 m) · `umbral` (0.7) · `fuerza` (25 N) · `desatar` (2.5 s jalando los dos) · `masa` (1 kg) |
| `mula`       | Una mula del tamaño de la caja, mirando hacia el + de su lado más largo. Cinemática y sin azar: no da un paso sin su carga, los huacales `<nombre>-1`, `-2`…, que quedan **amarrados** en su lomo al soltarlos junto a su costado, en alto (del suelo no). Cargada, sigue al que la lleva de la rienda (una manija colgada del bozal con una soga de verdad). No se mete en las paredes ni se tira a los huecos. | `velocidad` (1.2 m/s) · `rienda` (1.3 m) · `carga` (2 bultos) · `giro` (1.8 rad/s)                         |
| `balde`      | Un balde de madera del tamaño de la caja. El guion lo **llena**; se lleva en la mano (3 kg: uno solo). Lleno, si nadie lo agarra un ratito se **derrama**: no se puede dejar en ningún lado ni tirar, solo pasar de mano en mano. Tirado en el suelo, vuelve solo a su lugar.                                                                                                                                    | `masa` (3 kg) · `suelto` (0.3 s) · `vuelve` (3 s)                                                          |
| `brasa`      | Una piedra caliente del tamaño de la caja: **quema** al que la toca (lo tira para atrás, no hay derrota) y no se salta. Un balde lleno que llega a `alcance` de ella la **apaga**: se vacía el balde y la piedra se hunde a ras del suelo, ya se camina.                                                                                                                                                         | `empujon` (3.4 m/s) · `alcance` (0.9 m)                                                                    |
| `sombreron`  | El Sombrerón, bajito, de negro y con su guitarra. Su caja es su plaza: anda por adentro y no sale. Sin su sombrero, persigue al muñeco de pie más cercano que entra y le hace trenzas (lo **enreda**: lo tumba) y se queda tocando la guitarra un rato. Si su sombrero llega a la plaza, va por él y se lo pone; con el sombrero puesto ya no molesta. Cinemático, sin choques ni azar.                          | `velocidad` (1 m/s) · `alcance` (0.7 m) · `tocar` (4 s) · `empujon` (3.6 m/s)                              |
| `sombrerote` | El sombrero gigante del Sombrerón: una rueda de canto del tamaño de la caja que solo gira sobre su eje (el lado corto de abajo) y rueda a lo largo del largo. Se empuja caminando contra él; en una cuesta, sin nadie, rueda para abajo.                                                                                                                                                                         | `masa` (5 kg) · `rozamiento` (1)                                                                           |

```ts
nivel.nudo("nudo").desatado; // y .progreso (0 a 1), .jalados, .recorridos, .desatar(), .alDesatar(() => {})
nivel.mula("mula").cargada; // y .cargados, .bultos, .guia, .rapidez, .rumbo, .cargar(), .ponerEn(x, z, rumbo), .alCargar(n => {})
nivel.balde("balde").lleno; // y .cargadores, .derramadas, .llenar(), .vaciar(), .volver(), .alDerramar(() => {})
nivel.brasa("brasa-1").caliente; // y .quemados, .apagar(ya?), .alApagar(() => {})
nivel.sombreron("sombreron").conSombrero; // y .estado, .enredos, .persigue, .ponerse(), .volver(), .alEnredar(j => {}), .alPonerse(() => {})
nivel.sombrerote("sombrero").puesto; // y .radio, .eje, .volver()
```

En línea viajan en la foto los cabos y el nudo (un marcador cinemático sin choques: gira con lo que se aflojó y cae al
desatarse), la mula, su rienda y sus bultos, el balde y su marcador (un metro más alto con el balde lleno), las piedras
(hundidas, apagadas), el Sombrerón (agachado mientras hace trenzas) y su sombrero: el invitado dibuja las trenzas del
nudo, el agua del balde, el brillo de las piedras y al Sombrerón tocando o trenzando con los cuerpos tal como llegan.

## Las piezas del cafetal (TU-41)

Las que estrena el nivel 8, El cafetal (`apps/juego/src/niveles/piezas-cafetal.ts` y `cipitio.ts`; su lectura, en
`formato-cafetal.ts`). Como las otras, su malla no se dibuja. El canasto, el costal, el guineo, la llave y las piedras del
Cipitío los atraviesan los muñecos pero los agarran igual (y pisan las piedras: el rayo de la suspensión las ve).

| `pieza`   | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Propiedades                                                                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canasto` | Un canasto de corte lleno de café, del tamaño de la caja, quieto en su poste hasta que lo agarran. **Lanzar y atrapar** salen del agarre de siempre, sin ayuda: se lanza saltando y soltándolo en el aire (como la pelota de Xibalbá) y se atrapa con los brazos alzados (la mano que lo toca en el aire lo agarra). Sale a unos 2 m de alto y se atrapa a 3 o 3.5 m, con el que atrapa unos 60 cm más arriba que el que lanza. Suelto, en cuanto toca algo que no sea una mano se vacía y vuelve lleno a su poste: el guion mira dónde cayó.                                                                                                                                                                                                   | `masa` (1.5 kg)                                                                                                                                                        |
| `zaranda` | La zaranda del café: una bandeja colgada del tamaño de la caja, con una manija a lo ancho en cada punta de su x. **Trabada** mientras no la agarren los dos (uno de cada manija); entre los dos se la mueve a lo largo de su x, `recorrido` hacia cada lado. Cada vez que pasa de una punta a la otra es un zarandeo; con `zarandeos`, la llave (un manojo, escondido entre el café) cae por detrás y queda colgando de un clavo, `llave` detrás de la caja, a la altura de las manos. Al agarrarla se descuelga; tirada, vuelve al clavo. Los muñecos la atraviesan (con los brazos alzados se agarra la bandeja).                                                                                                                             | `masa` (12 kg) · `recorrido` (0.35 m) · `zarandeos` (6) · `umbral` (0.7: qué parte del recorrido es llegar a la punta) · `llave` (0.3 m) · `vuelve` (4 s)              |
| `polea`   | Una polea con torno: su caja es el armazón. La manija cuelga en la punta −x, a `manija` de la base (se salta para colgarse); el gancho, en la punta +x, a `gancho`. El que se cuelga de la manija la baja `recorrido` y el gancho sube `subir`; sin nadie, vuelven solos. El costal que alguien le acerca al gancho (con el gancho abajo) queda colgado.                                                                                                                                                                                                                                                                                                                                                                                        | `manija` (1.75 m) · `gancho` (1.25 m) · `recorrido` (0.5 m) · `subir` (2.8 m) · `bajada` (0.35 m/s) · `subida` (0.25 m/s)                                              |
| `costal`  | Un costal de café del tamaño de la caja, quieto en su tarima hasta que lo agarran (4 kg: uno solo lo carga). Se cuelga del gancho de la polea. Tirado en el suelo, vuelve solo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `masa` (4 kg) · `vuelve` (3 s)                                                                                                                                         |
| `guineo`  | Un guineo maduro colgado de su mata, quieto hasta que lo agarran. Tirado, vuelve solo; El Cipitío se come el que le queda a la mano.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | `masa` (0.3 kg) · `vuelve` (3 s)                                                                                                                                       |
| `cipitio` | El Cipitío: un cipote barrigón con los pies al revés, sentado en el medio de la base de su caja, mirando hacia su frente. Al muñeco más cercano a menos de `vista` (de costado) que no le traiga un guineo le tira una piedra cada `cada` segundos, adelantándole lo que camina, `corto` antes (nunca más cerca de él que `cerca`), y se ríe. Las piedras (4 kg, 50 cm de alto, no giran) se quedan donde caen: la que cae a los pies de uno lo sube encima, y sirve de escalón. Con `empujon`, la piedra que pasa junto a un muñeco lo tumba. Con el morral vacío recoge la tirada más vieja de las que tiene a la vista. Un guineo suelto a menos de 1 m de su boca, se lo come: desde ahí está contento y no tira más. Cinemático, sin azar. | `vista` (6 m) · `cada` (1.8 s) · `piedras` (4) · `corto` (1 m) · `cerca` (1.2 m) · `empujon` (0 m/s: con más de 3.2 tumba) · `vuelo` (0.9 s: lo que vuela cada piedra) |

```ts
nivel.canasto("canasto-1").estado; // "en su lugar", "llevado" o "volando"; .lanzador, .atrapadas, .alAtrapar(j => {}), .alCaer((donde, atrapado) => {})
nivel.zaranda("zaranda").trabada; // y .corrido (−1 a 1), .zarandeos, .llave (.suelta, .colgada, .agarrada, .encajada), .encajar(p), .soltarLlave()
nivel.polea("polea").subida; // de 0 (abajo) a 1; .colgados, .costal, .descolgar()
nivel.costal("costal-1").colgado; // y .agarrado, .enSuLugar, .ponerEn(p), .volver()
nivel.guineo("guineo").comido; // y .agarrado, .enSuLugar, .volver()
nivel.cipitio("cipitio").estado; // "sentado", "apuntando", "riendo", "comiendo" o "contento"; .tiradas, .pegadas, .riendo, .conPiedra, .mudarse(p, rumbo, punteria), .alComer(() => {})
```

En línea viajan en la foto los canastos, la bandeja de la zaranda y su llave, la manija y el gancho de la polea, los
costales, el guineo, El Cipitío y sus piedras (las del morral, escondidas 40 m abajo). El invitado no corre el guion ni
`antes`: ve al Cipitío reírse porque lo ve echado para atrás, alzar el brazo porque tiene una piedra en la mano y
comer porque tiene el guineo en la boca, y dibuja las sogas de la zaranda y de la polea con los cuerpos como llegan.

## Las piezas de los canales (TU-42)

Las que estrena el nivel 9, Los canales de Xochimilco (`apps/juego/src/niveles/piezas-canales.ts` y `llorona.ts`;
su lectura, en `formato-canales.ts`). Como las otras, su malla no se dibuja. El agua es la de La poza; su nivel lo
sube y lo baja el guion con `irA` (el llanto de La Llorona).

| `pieza`     | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Propiedades                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trajinera` | Una lancha plana del tamaño de la caja, con el piso arriba de la caja, un techo y el arco de la proa; avanza hacia el + de su lado más largo. Flota y gira solo alrededor de su Y. Tiene dos pértigas, una de cada lado de la popa (el 40 % de atrás): empuja la de su lado el que va de pie ahí con los brazos alzados. Una sola la tuerce (se clava de costado); las dos, derecho. La viga de arriba del arco choca: no pasa bajo un puente más bajo. Puede llevar flores en el piso: cada golpe (un cambio de velocidad de más de `golpe` en un paso) bota una al agua, que flota un rato y se hunde. Al que va a bordo, quieto, lo lleva. | `masa` (80 kg) · `pertiga` (72 N cada una) · `lado` (0.7 m: dónde se clava cada pértiga) · `flores` (0) · `golpe` (0.4 m/s) · `arco` (2.1 m sobre el piso; 0: sin arco) |
| `chinampa`  | Una chinampa flotante del tamaño de la caja (la tierra arriba de la caja). Con alguien parado encima, aguanta `aguante` y se hunde `hundir` por segundo por cada muñeco; vacía, vuelve a subir. Cinemática: lleva al que la pisa.                                                                                                                                                                                                                                                                                                                                                                                                             | `hundir` (0.3 m/s) · `aguante` (0.25 s) · `subir` (0.2 m/s) · `fondo` (1 m: hasta dónde se hunde)                                                                       |
| `pinata`    | Una piñata de siete picos colgada en el medio de una soga tendida entre dos postes (en las puntas del lado más largo de la caja; la caja va del suelo a la soga). La soga baja hasta una manija junto al poste de la punta −, 75 cm hacia adentro: jalándola caminando hacia atrás (hacia el − de su frente) la piñata baja; al soltarla, un resorte la sube. La mano o la cabeza que le llega a más de `pegar` cuenta un golpe (cada muñeco, uno cada 0.4 s) y la mece; con `golpes` se rompe y saltan los dulces. Los muñecos la atraviesan.                                                                                                | `soga` (2.4 m) · `baja` (2 m) · `fuerza` (20 N) · `golpes` (4) · `pegar` (1 m/s)                                                                                        |
| `llorona`   | La Llorona, de pie en su caja (los pies abajo) mirando hacia su frente. Un fantasma: no choca. Llora (`llanto`, de 0 a 1) y se ríe de los porrazos: un muñeco que se cae delante de ella, a menos de `publico`. Cada carcajada le baja el llanto; con `risas` deja de llorar para siempre. Si pasa `olvido` sin reírse, se olvida de una.                                                                                                                                                                                                                                                                                                     | `risas` (3) · `olvido` (20 s) · `publico` (6 m)                                                                                                                         |

```ts
nivel.trajinera("trajinera").pertigas; // [izquierda, derecha]: 0, 1 o null; y .aBordo, .rumbo, .encima(p), .casa
nivel.trajinera("trajinera-flores").flores; // las que lleva, de .totalFlores; .alBotarFlor(quedan => {}), .llevar(c), .volver()
nivel.chinampa("chinampa-1").hundida; // m; y .encima (cuántos), .tierra (su altura), .volver()
nivel.pinata("pinata").estado; // "colgada" o "rota"; .jalada, .bajada, .golpes, .aguanta, .manija, .alGolpear(j => {}), .alRomper(() => {}), .romper()
nivel.llorona("llorona").estado; // "llorando", "riendo" o "tranquila"; .risas, .faltan, .llanto, .alReir(j => {}), .alCalmarse(() => {}), .calmar()
```

En línea viajan en la foto las dos trajineras y sus flores (cuerpos cinemáticos sin choques), las chinampas, la
piñata y su manija, La Llorona y el marcador de cada agua: el invitado cuenta las flores que ve en el piso, mueve
las pértigas si la trajinera avanza, rompe la piñata cuando la ve desaparecer y sabe si La Llorona llora, se ríe o
está tranquila por cuánto la ve inclinada.

## Las piezas de La garrucha (TU-43)

Las que estrena el nivel 10, La garrucha (`apps/juego/src/niveles/piezas-garrucha.ts` y `patasola.ts`; su lectura, en
`formato-garrucha.ts`). Como las otras, su malla no se dibuja. Las lianas son bejucos.

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Propiedades                                                                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `garrucha` | Una canasta colgada de un cable, a lo largo del lado más largo de la caja: de la estación de abajo (la punta −, con el piso de la canasta abajo de la caja) a la de arriba (la punta +, con el piso arriba de la caja). Se sube caminando por las puntas, que están abiertas. Cada estación tiene una manija en la soga, detrás de la punta y de costado: jalándola caminando hacia atrás (como la soga de la palmera), la canasta sube; al soltarla la manija vuelve sola y la canasta no (un trinquete), si alguien va adentro. Vacía y sin nadie en las manijas, baja sola a la estación de abajo. Desde la canasta no se alcanza ninguna manija: hacen falta los dos. | `velocidad` (1.4 m/s) · `soga` (2.2 m: lo que se jala) · `multiplica` (3.2 m de cable por metro de soga) · `bajar` (1.2 m/s) · `fuerza` (20 N) · `lado` (−1.3 m: de costado) · `atras` (1.4 m: detrás de la punta) |
| `chiva`    | El bus de escalera, del tamaño de la caja (de la calle hasta arriba del techo), mirando hacia el + de su lado más largo, con la parrilla del techo (barandas a los costados). Su carga es el huacal `<nombre>-carga`. Con la carga en el techo y los dos encima, arranca y pasa `baches`; en cada bache la carga salta del techo si no la sostienen los dos, y se lleva al que la sostenía solo: la chiva frena, se devuelve y la carga vuelve a su lugar. Al que va en el techo lo lleva. Cinemática, sin azar.                                                                                                                                                          | `recorrido` (14 m) · `velocidad` (2 m/s) · `baches` (2) · `bache` (0.1 m)                                                                                                                                          |
| `palma`    | Una palma de cera de pie, del tamaño de la caja: arriba de la caja termina lo que se trepa (ahí va su plataforma, un sólido aparte, con el borde al ras del tronco del lado por donde se sube) y encima va el cogollo, que solo se ve. Con `manea`, un aro de soga alrededor del tronco: el que lo agarra con las dos manos sube apretando adelante y baja apretando atrás; arriba se encarama a la plataforma, como a cualquier borde. Sin nadie, la manea baja sola.                                                                                                                                                                                                    | `manea` (1) · `velocidad` (0.9 m/s) · `copa` (2.5 m: el cogollo sobre la caja)                                                                                                                                     |
| `patasola` | La Patasola, que anda brincando en una sola pata: corre a lo largo del lado más largo de su caja (su carril), de la punta − (la salida de la carrera) a la + (la meta), con la base de la caja en el suelo. Esperando, brinca en el lugar. Arranca cuando alguno de los dos cruza la salida, llega a la meta en `tiempo` segundos (siempre igual) y se devuelve; para otra carrera los dos tienen que volver detrás de la salida. No choca con nada.                                                                                                                                                                                                                      | `tiempo` (15 s) · `salto` (0.45 m) · `brinco` (0.5 s)                                                                                                                                                              |

```ts
nivel.garrucha("garrucha").recorrido; // de 0 (abajo) a 1 (arriba); .aBordo, .jalando, .jalada(0 | 1), .manijas, .encima(p), .volver()
nivel.chiva("chiva").estado; // "parada", "andando", "frenando", "devolviendose" o "llego"; .recorrido, .caidas, .carga, .cargada, .alLlegar(), .alCaer(), .llegar(), .volver()
nivel.palma("palma").altura; // la manea, de 0 a 1; .trepando (0, 1 o null), .manea, .volver()
nivel.patasola("patasola").estado; // "esperando", "corriendo" o "volviendo"; .avance, .alto, .carreras, .perdidas, .ganadas, .alPerder(j => {}), .alGanar(), .volver()
```

En línea viajan en la foto la canasta y sus manijas, la chiva y su carga, las maneas y La Patasola: el invitado dibuja
las sogas, hace girar las ruedas de la chiva y le dobla la pata a La Patasola con lo alto que la ve.

## Las piezas del llano (TU-44)

Las que estrena el nivel 11, El llano (`apps/juego/src/niveles/piezas-llano.ts` y `silbon.ts`; su lectura, en
`formato-llano.ts`; el silbido, en `silbido.ts` y `silbido-audio.ts`). Como las otras, su malla no se dibuja.

| `pieza`  | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Propiedades                                                                                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `silbon` | El Silbón, un flaco altísimo de sombrero. Su caja es donde está escondido, agachado en el pajonal (la base en el suelo; de alto, lo que mide de pie). Escondido no se ve y **silba al revés**: a cada jugador le toca su volumen y su paneo (`silbido.ts`, una función pura), fuerte de lejos y bajito de cerca, y viene del lado contrario. Suena con Web Audio, sintetizado, y se ve: unas ondas sobre cada muñeco que se cierran, más marcadas cuanto más fuerte suena. El primero que llega a `hallar` de él lo halla: se alza, se va y aparece donde el guion le dijo que espere (`esperarEn`). Esperando, recoge su saco si se lo dejan suelto a menos de `alcance`. Cinemático, sin choques y sin azar. | `hallar` (1.3 m) · `velocidad` (1.4 m/s) · `alcance` (1.6 m)                                                     |
| `molino` | Un molino de viento de dos aspas largas que giran sobre la z de la caja (la rueda: el eje en el centro y de radio el mayor de su X y su Y; de grueso, su Z). Gira sin parar con el viento; con el freno (`frenar`, lo manda el guion) para con las aspas en rampa, subiendo `angulo` hacia su +x: se sube caminando por ellas. Al soltar el freno vuelve a agarrar viento y bota al que esté encima. Cinemática.                                                                                                                                                                                                                                                                                               | `angulo` (15°) · `viento` (1.6 rad/s) · `arranque` (1.2 rad/s²) · `frenada` (2.5 rad/s²)                         |
| `ganado` | Reses cebú que pastan sueltas en el potrero (la caja) y se apartan del muñeco que se les acerca a menos de `huir`: se las arrea. No van contra la cerca del potrero; arrinconadas, se escurren hacia el corral. La que entra al corral (los últimos `corral` metros de la X de la caja) se queda ahí, en su comedero contra la cerca de atrás. Pastan con azar de semilla: dos corridas iguales dan lo mismo.                                                                                                                                                                                                                                                                                                  | `cuantas` (3) · `corral` (5 m) · `huir` (3.2 m) · `velocidad` (1.4 m/s) · `masa` (250 kg) · `semilla` (1)        |
| `hamaca` | Una hamaca colgada a lo ancho de la X de la caja, entre dos horcones, mirando a su frente (el −Y de Blender). Su cabuya cuelga hasta una manija a un costado: jalándola caminando hacia atrás (como la palmera del río) la hamaca se estira hacia atrás hasta el suelo, donde uno se puede meter. Estirada del todo y soltada la cabuya, vuelve de golpe y lanza hacia su frente al que esté adentro. Los muñecos la atraviesan.                                                                                                                                                                                                                                                                               | `estirar` (2.2 m) · `lado` (−1.8 m) · `fuerza` (25 N) · `colgar` (0.55 m) · `lanzar` (8 m/s) · `elevacion` (38°) |
| `saco`   | El saco de cachivaches del Silbón: un costal del tamaño de la caja, quieto donde lo pongan hasta que lo agarran; se carga con una mano o con las dos. Tirado mucho rato (o caído al vacío), vuelve a su lugar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `masa` (3 kg)                                                                                                    |

```ts
nivel.silbon("silbon").silbidos(); // [{ volumen, paneo }, …]: lo que oye cada uno; .silba, .estado, .hallado, .conSaco
nivel.silbon("silbon").oir(nivel.munecos); // y .esperarEn(donde, rumbo), .alHallar(j => {}), .alRecibir(() => {}), .hallar()
nivel.molino("molino").frenar(palanca.activa); // .parada, .giro, .velocidad, .rueda
nivel.ganado("ganado").encerradas; // y .cuantas, .reses, .enElCorral(i), .alEncerrar(n => {}), .encerrar()
nivel.hamaca("hamaca").estado; // "colgada", "estirada" o "disparando"; .estirada, .jalada, .medio(), .adentro(p), .lanzados
nivel.saco("saco").entregado; // y .agarrado, .enSuLugar, .volver()
```

En línea viajan en la foto las aspas, las reses, el medio de la hamaca y su manija, el saco y el Silbón. El invitado no
corre el guion ni las piezas: el silbido y sus ondas los calcula con los cuerpos tal como llegan (sabe que el Silbón
silba porque lo ve hundido en su escondite; quiénes lo oyen se lo dice el guion en `alEmpezar`, que corre en los dos),
anima las patas de las reses con lo que anduvieron y dibuja la tela y la cabuya de la hamaca.

## Las piezas del puente de paja (TU-45)

Las que estrena el nivel 12, El puente de paja (`apps/juego/src/niveles/piezas-puente.ts` y `llama.ts`; su lectura, en
`formato-puente.ts`). Como las otras, su malla no se dibuja. Los torcedores, la soga, el amarre, las losas y la rienda
los atraviesan los muñecos, pero los agarran igual. El agua de las acequias es la de La poza (su nivel lo sube y lo
baja el guion con `irA`) y las puertas de las pircas las baja el guion (`crearPuertaQueBaja`).

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Propiedades                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `qeswa`    | Tres hebras de paja a lo largo del lado más largo de la caja, con un **torcedor** en cada punta: un palo de través, arriba de la caja (a la altura de las manos), que gira sobre su estaca. Agarrado con las dos manos, gira con el que lo agarra al girar. La cuerda se **trenza** solo si los dos torcedores giran a la vez y para lados contrarios (uno a la izquierda, el otro a la derecha); para el mismo lado, o uno solo, no pasa nada. Si alguien suelta su torcedor antes de terminar, se destuerce.                                                                                                                                                                                                         | `vueltas` (3: las que da cada torcedor) · `destorcer` (4 s) · `masa` (1 kg)                                                                                                                                                        |
| `chaka`    | El puente colgante, a lo largo del lado más largo de la caja, con el piso arriba de la caja en las puntas. Empieza **flojo**: colgando `flojo` en el cañón y sin piso. Detrás de su punta −, de costado (+z), su **soga**: una manija que se jala caminando hacia atrás (como la tranca) y lo tensa; del otro costado, sobre el estribo, el **amarre**: sostenido con las dos manos mientras está tenso, en `amarrar` segundos queda **amarrado** y se teje el piso. Amarrado se **mece**: cada uno que camina encima lo mece más (más rápido y más en el medio, más), y quieto se calma solo; corrido del medio, se ladea. Mecido más que `voltear`, se **voltea**: bota a los de encima al cañón y se endereza solo. | `comba` (0.6 m) · `flojo` (4 m) · `tensar` (2.4 m) · `fuerza` (25 N) · `lado` (1.3 m) · `umbral` (0.85) · `amarrar` (2.5 s) · `mecer` (0.3 rad/s) · `calma` (0.35/s) · `periodo` (2.4 s) · `ladear` (0.35 rad/m) · `voltear` (32°) |
| `bocatoma` | Una losa de piedra del tamaño de la caja (cerrada) que tapa la boca de una acequia, con un palo y un travesaño a `manija` de su base. Se **abre** jalándola del travesaño hacia su frente (el −Y de Blender), caminando para atrás, y se **cierra** empujándola; queda donde la dejan.                                                                                                                                                                                                                                                                                                                                                                                                                                 | `recorrido` (0.5 m) · `umbral` (0.7) · `manija` (1 m) · `masa` (6 kg) · `abierta` (0)                                                                                                                                              |
| `anden`    | La terraza sembrada: la base de la caja es la tierra y su alto, las matas de papa, en `surcos` a lo largo de su X. El guion la riega (`regar(true)` en cada paso que le llega agua): con `regar` segundos de agua queda **regada** y las matas se paran.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `regar` (5 s) · `surcos` (4) · `regada` (0)                                                                                                                                                                                        |
| `carguera` | La llama carguera, con su carga en el lomo: su caja es ella de pie, mirando hacia el + de su lado más largo. Sigue a su paso al que la lleva de la **rienda** (una manija colgada del bozal con una soga de verdad, como la mula). Si la **apuran** (la rienda tirante del todo más de `paciencia`, o alguien que se le viene encima por detrás, a menos de `arrear` de su anca), se **enoja**: se da vuelta, le **escupe** (el escupitajo vuela y lo tumba), se echa `echarse` segundos y se vuelve sola a su casa. Cinemática, sin azar.                                                                                                                                                                             | `velocidad` (0.9 m/s) · `giro` (1.8 rad/s) · `rienda` (1.4 m) · `paciencia` (1.5 s) · `echarse` (3 s) · `escupir` (3.6 m/s) · `arrear` (0.6 m)                                                                                     |

```ts
nivel.qeswa("qeswa").trenzada; // y .progreso, .agarrados, .giros, .soltadas, .trenzar(), .alTrenzar(() => {}), .alSoltar(() => {})
nivel.chaka("chaka").estado; // "flojo", "firme", "volteado" o "enderezandose"; .tension, .jalada, .amarrando, .amarrado, .ladeo, .mecida, .carga, .volteadas, .soltadas
nivel.chaka("chaka").encima(p); // y .amarrar(), .alAmarrar(() => {}), .alVoltear(() => {}), .alSoltar(() => {})
nivel.bocatoma("bocatoma-1").abierta; // y .abertura (0 a 1), .poner(abierta), .alCambiar(abierta => {})
nivel.anden("anden-1").regada; // y .humedad, .mojandose, .regar(si), .mojar(), .alRegar(() => {})
nivel.carguera("llama").estado; // "tranquila", "escupiendo", "echada", "volviendo" o "contenta"; .guia, .apuro, .enojos, .escupidas, .casa
nivel.carguera("llama").llegar(); // y .ponerEn(x, z, rumbo), .volver(), .alEnojar(j => {}), .alEscupir(j => {})
```

En línea viajan en la foto los torcedores, los tramos del puente, su soga, las losas, la llama, su rienda y su
escupitajo (escondido 40 m abajo mientras no vuela). Lo que no se ve en un cuerpo lo lleva un marcador cinemático sin
choques, como el nudo de Las trenzas: lo trenzado (su giro), si el puente está amarrado (su altura), lo regado de cada
andén y si le llega agua, y en qué anda la llama. El invitado no corre `antes` ni el guion: dibuja con eso (`vista`).

## Las piezas de la mina (TU-46)

Las que estrena el nivel 13, La mina (`apps/juego/src/niveles/piezas-mina.ts` y `tio.ts`; su lectura, en
`formato-mina.ts`; lo que solo se ve, en `decorado-mina.ts`). Como las otras, su malla no se dibuja. La polea es la de
El cafetal; la vía y su cambio, los del tren (`mecanismos/via.ts`, con una `palanca` de cambio).

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Propiedades                                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vagoneta` | Una vagoneta de mina del tamaño de la caja (las ruedas abajo), mirando hacia su +x. Va por su vía (el guion se la da con `seguir`, con su cambio; si no, derecho hacia su +x). Se empuja caminando contra ella: en cada paso la pieza la vuelve a poner sobre los rieles y le deja solo la velocidad a lo largo; la cuesta la apura o la frena, y los rieles la frenan. Choca solo con los muñecos (pasa por el piso y las paredes, que la vía esquiva). Lleva al que va adentro. | `masa` (40 kg) · `roce` (2 por s: con mucho, se para apenas la sueltan) · `velocidad` (2 m/s) · `ruedas` (0.3 m) · `recorrido` (10 m, sin otra vía)     |
| `espejo`   | Un espejo de dos caras del tamaño de la caja (de ancho su x, de alto su y) sobre un poste que baja `poste` hasta el piso. Gira sobre el poste con un brazo hacia su frente, a `manija` del piso, que se empuja caminando de costado. Un resorte lo vuelve al reposo: queda **orientado** (en su tope, `giro` desde el reposo) solo mientras alguien lo sostiene.                                                                                                                  | `giro` (35°, a la izquierda visto desde arriba) · `umbral` (0.9) · `fuerza` (15 N) · `brazo` (0.9 m) · `manija` (1 m) · `poste` (1.5 m) · `masa` (6 kg) |
| `grieta`   | La grieta por donde entra el sol: un haz claro que sale del centro de la caja hacia su frente (el −Y de Blender), rebota en los espejos que encuentra y lo para lo fijo y lo cinemático. Sin color nuevo: la luz es blanca, como los ojos.                                                                                                                                                                                                                                        | `largo` (20 m por tramo) · `rebotes` (4)                                                                                                                |
| `ofrenda`  | La ofrenda para El Tío (un atado de coca, un cigarro y un trago), quieta en su lugar hasta que la agarran; tirada, vuelve sola. Si pasa a menos de su radio de una vela (llevada o tirada) es un susto: ¡pum!, humo, vuelve a su lugar y el que la llevaba aparece frente a ella, para retomar. Nadie explota de verdad.                                                                                                                                                          | `masa` (0.6 kg) · `vuelve` (3 s)                                                                                                                        |
| `velas`    | Una hilera de velas paradas en la base de la caja, a lo largo de su lado más largo, cada una con su llama y la luz que hace en el suelo (lo que no hay que pisar). Solo imagen: no chocan.                                                                                                                                                                                                                                                                                        | `cuantas` (4) · `radio` (0.45 m)                                                                                                                        |
| `tio`      | El Tío de la mina, un diablito con cuernos sentado en su altar en el medio de la base de su caja, mirando hacia su frente. Mira al muñeco más cercano y estira la mano. La ofrenda suelta (lo que tiene una mano encima no está suelto) a menos de `alcance` de su mano se la queda: la lleva al regazo y fuma contento. Cinemático y sin azar; choca, pero no empuja.                                                                                                            | `vista` (5 m) · `alcance` (0.9 m)                                                                                                                       |

```ts
nivel.vagoneta("vagoneta").seguir(via, () => cambio.activa); // .avance, .velocidad, .porElDesvio, .enElTope, .montados, .poner(s), .frenar(si)
nivel.espejo("espejo-1").orientado; // y .recorrido, de 0 (reposo) a 1 (tope), .alCambiar((orientado) => {})
nivel.grieta("grieta").alumbra(punto, radio); // y .camino (el haz, tramo a tramo) y .espejos (en los que rebota)
nivel.ofrenda("ofrenda").alAsustar((llevaban) => {}); // y .sustos, .agarrado, .entregada, .volver()
nivel.velas("velas-1").cerca(punto); // y .puntos (la base de cada vela)
nivel.tio("tio").estado; // "esperando", "recibiendo" o "contento"; .contento, .mira, .mano(), .recibir(ofrenda), .alRecibir(() => {})
```

En línea viajan en la foto las vagonetas, los marcos de los espejos, la ofrenda y El Tío. El invitado no corre el guion
ni las piezas: el haz lo traza con los espejos tal como llegan (pregunta a cada colisionador, porque las consultas del
mundo se arman al correr pasos), ve al Tío contento porque ve la ofrenda en su regazo, hace tiritar las velas, hace
girar las ruedas con lo que anduvo cada vagoneta y echa el humo del susto cuando ve la ofrenda saltar a su lugar.

La mina (TU-46): `scripts/niveles/mina.mjs` arma `13-mina`, también con `pnpm niveles`.

## Las piezas de La minga (TU-47)

Las que estrena el nivel 14, La minga (`apps/juego/src/niveles/piezas-minga.ts` y `caleuche.ts`; su lectura, en
`formato-minga.ts`). Como las otras, su malla no se dibuja. El agua es la de La poza; la marea la sube y la baja el
guion con `irA` y `mareaEn` (bajamar, sube, pleamar y baja, siempre igual desde que empieza el nivel).

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Propiedades                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `minga`    | La casa de la minga, del tamaño de la caja (las paredes; el techo de dos aguas va encima), sobre un camino de troncos que sigue `recorrido` metros hacia el +x de la caja (los troncos, de 12 cm de radio, van bajo la base de la caja). De cada esquina de adelante cuelga un cabo con su manija, a la altura de las manos. Se tira caminando para atrás: pasado su largo, el cabo se estira como un resorte. La casa anda **solo si cada cabo lo tira un muñeco distinto**, los dos pasados el `umbral`, y va hacia donde tiran los dos juntos: si uno tira torcido se corre de costado y, si una esquina pasa la punta de los troncos, **se sale**: se ladea, se atasca y a los `atasco` s los vecinos la vuelven a poner en los troncos. Cinemática.                                                           | `recorrido` (8 m) · `cabo` (2 m) · `estirar` (0.4 m) · `fuerza` (24 N, estirado del todo) · `umbral` (0.45) · `velocidad` (0.7 m/s) · `margen` (0.3 m: lo que salen los troncos de cada lado) · `atasco` (3 s) |
| `chalupa`  | El bote chilote, del tamaño de la caja **donde queda amarrado**, con la proa hacia el + de su lado más largo y el muelle de su lado +z. Flota y gira solo alrededor de su Y. Suelto queda fondeado `fondeo` m más afuera y `corrida` m hacia atrás (un resorte lo lleva ahí). Sus dos cabos (proa y popa) cuelgan de una barandilla en la orilla del muelle; las bitas van frente a cada punta, `muelle` m adentro del muelle, sobre un piso que está `alto` m más arriba que el de la chalupa. Con **los dos cabos en sus bitas a la vez**, cada uno en una mano, durante `nudo` s, se amarra: los cabos quedan atados y la chalupa se arrima al muelle y se corre a su lugar. Suelto, cada cabo vuelve a su clavo. Lleva al que pisa.                                                                            | `masa` (150 kg) · `cabo` (6.5 m) · `fondeo` (2.6 m) · `corrida` (5 m) · `muelle` (1 m) · `alto` (0.8 m) · `nudo` (1 s) · `alcance` (0.5 m)                                                                     |
| `ancla`    | El ancla del Caleuche, colgada de su cadena (que sube hasta un escobén sobre la caja). Lo de arriba de sus brazos (donde se pisa) va de lo bajo de la caja a lo alto. Abajo, con alguien parado en sus brazos `espera` s, la suben; arriba, sin nadie `arriba` s, la bajan; si alguien se sube mientras baja, la vuelven a subir. Cinemática.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `velocidad` (0.6 m/s) · `espera` (0.6 s) · `arriba` (2.5 s)                                                                                                                                                    |
| `caleuche` | El Caleuche: el casco del tamaño de la caja, la cubierta arriba, la proa hacia su −x y la popa hacia su +x. Bordas de 50 cm en los costados (la de adelante, +z, abierta en el `portalon`, por donde llega el ancla) y de 90 cm en proa y popa (la de popa, abierta donde va la plancha, parada). Con los dos a bordo un segundo **empieza la fiesta**: `compases` compases de `compas` s en que la cubierta se mece de lado a lado, cada vez más, hasta `rolido`. Si uno se sale de la cubierta (se cae al agua, se cuelga de la borda), **se corta la música** y vuelve a empezar cuando los dos están a bordo. Terminada la canción queda **contento**: deja de mecerse y baja la plancha (`plancha` m, hasta `bajada` más abajo). La tripulación de fantasmas, los faroles y las velas son imagen. Cinemático. | `compases` (24) · `compas` (0.8 s) · `rolido` (7°) · `plancha` (3.4 m) · `bajada` (0.6 m) · `portalon` (1 m desde la proa)                                                                                     |

```ts
nivel.minga("casa").estado; // "quieta", "andando", "atascada" o "llego"; .avance, .desvio, .tiradores, .jaladas, .seSalio
nivel.minga("casa").alLlegar(() => {}); // y .alSalirse(() => {}), .llevarAlFinal(), .volver(), .manijas
nivel.chalupa("chalupa").estado; // "suelta", "amarrando" o "amarrada"; .cabos, .bitas, .aBordo, .encima(p), .alAmarrar(() => {})
nivel.chalupa("chalupa").amarrar(); // al retomar; y .volver()
nivel.ancla("ancla").estado; // "abajo", "subiendo", "arriba" o "bajando"; .altura, .encima, .alLlegarArriba(() => {}), .volver()
nivel.caleuche("caleuche").estado; // "fondeado", "de fiesta" o "contento"; .compas, .rolido, .aBordo, .cortes, .aBordoDe(p)
nivel.caleuche("caleuche").alContento(() => {}); // y .alCortar(() => {}), .contentar()
```

En línea viajan en la foto la casa y las manijas de sus cabos, la chalupa y las suyas, el ancla, el casco del Caleuche
y su plancha, y el marcador de cada agua (la marea). El invitado no simula: saca de los cuerpos cuánto anduvo la casa y
si se salió (la ve ladeada), si la chalupa está amarrada (las manijas en las bitas), dónde va el ancla y si hay fiesta
(el casco se mece) o el Caleuche está contento (la plancha abajo), y dibuja los cabos, los troncos que ruedan, la
cadena y el baile de la tripulación con los cuerpos tal como llegan.

## Las piezas de La pampa (TU-48)

Las que estrena el nivel 15, La pampa (`apps/juego/src/niveles/piezas-pampa.ts` y `luz-mala.ts`; su lectura, en
`formato-pampa.ts`). Como las otras, su malla no se dibuja. Las boleadoras, el candil y la manija de la tranquera los
atraviesan los muñecos, pero los agarran igual.

| `pieza`        | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Propiedades                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pampero`      | El viento de la pampa: su caja es donde sopla, hacia su frente (el −Y de Blender). Sopla siempre un poco (`calma`) y a ratos en ráfagas, con azar de semilla. Empuja a los muñecos que están adentro, cierra las tranqueras y apura al chambergo. Se ve en unas rayas que corren con el viento.                                                                                                                                                                                                                                                      | `fuerza` (3 m/s² en lo más fuerte de una ráfaga) · `calma` (0.35) · `cada` (6 s) · `dura` (2.5 s) · `semilla` (1)                                              |
| `tranquera`    | Una tranquera de varas del tamaño de la caja, larga a lo largo de su X, con la bisagra en la punta −x y la manija cerca de la +x, que sobresale por delante. Se abre solo hacia su frente, jalándola de la manija caminando hacia atrás; el viento la cierra de golpe al soltarla. Los muñecos atraviesan la hoja, pero los ataja su sombra (un cuerpo cinemático detrás de la hoja). Al que quedó del lado de adentro cuando se le viene encima (o cuando ya casi cierra) le da un portazo: lo voltea hacia afuera y rebota.                        | `fuerza` (16 N en la manija para sostenerla, más en las ráfagas) · `abrir` (100°) · `masa` (4 kg)                                                              |
| `boleadoras`   | Tres bolas atadas, colgadas donde está su caja hasta que una mano las descuelga. Se lanzan saltando y soltándolas en el aire (salen a unos 2 m de alto y caen a unos 3.5 m). Tiradas en el suelo, vuelven solas a su gancho.                                                                                                                                                                                                                                                                                                                         | `masa` (1.2 kg) · `vuelve` (2.5 s)                                                                                                                             |
| `chambergo`    | El sombrero que se llevó el viento: vuela solo por su caja, subiendo y bajando (azar de semilla), más rápido con las ráfagas. No se lo agarra con la mano: lo enredan unas boleadoras que vuelan de verdad (soltadas en el aire, a más de 1 m de donde salieron) y le pasan a menos de `enredar`. Enredado, cae al piso con las boleadoras. Cinemático, sin choques.                                                                                                                                                                                 | `velocidad` (1.3 m/s) · `enredar` (0.75 m) · `semilla` (1)                                                                                                     |
| `pie-de-amigo` | La escalerita: su caja es donde se para el que la hace (la base en el suelo), mirando hacia su frente. Parado ahí, de pie y con los dos brazos alzados, sus manos son un escalón (un poncho doblado) delante de él, a `alto` del suelo: lo pisa solo el otro. Al bajar los brazos o salirse, desaparece.                                                                                                                                                                                                                                             | `alto` (1.1 m) · `desde` y `hasta` (0.75 y 1.35 m delante del medio de la caja) · `ancho` (1 m)                                                                |
| `candil`       | Un farol de lata del tamaño de la caja, colgado de su gancho hasta que una mano lo descuelga; se lleva con una mano o con las dos. Con la Luz adentro alumbra. Tirado mucho rato (o caído al vacío), vuelve a su gancho.                                                                                                                                                                                                                                                                                                                             | `masa` (1 kg)                                                                                                                                                  |
| `luz-mala`     | La Luz Mala, una luciérnaga gigante y despistada, del tamaño de la caja. Guía por el camino que le da el guion (`guiar`): en cada parada espera a que alguno llegue cerca. En los desvíos con señuelo a veces se equivoca (azar de semilla): va titubeando, ladeada, hasta el señuelo, se da cuenta y vuelve. Si alguno se cae o los pierde, vuelve a la parada que les queda más cerca. Después se posa en sus posaderos y se espanta del que se le acerca sin candil; un candil que alguien lleva en la mano la encierra. Cinemática, sin choques. | `velocidad` (2.2 m/s) · `esperar` (1.1 m) · `acierto` (0.6) · `despiste` (2.5 s) · `posarse` (3.5 s) · `espantar` (1.3 m) · `atrapar` (0.55 m) · `semilla` (1) |

```ts
nivel.pampero("pampero").soplo; // de `calma` a 1; .rafagas, .direccion, .adentro(p), .marcador
nivel.tranquera("tranquera").angulo; // radianes; .apertura, .abierta, .sostenida, .trabada, .golpes, .portazos, .trabar(ya?), .alGolpe(), .alPortazo(j => {}), .volver()
nivel.boleadoras("boleadoras").estado; // "en su lugar", "llevadas", "volando", "tiradas" o "enredadas"; .lanzador, .recorrido, .tiros, .volver()
nivel.chambergo("chambergo").atrapado; // y .estado ("volando", "cayendo" o "en el suelo"), .cazador, .alAtrapar(j => {}), .atrapar()
nivel.pieDeAmigo("pie-de-amigo").activo; // y .quien (0, 1 o null), .pisado, .escalon
nivel.candil("candil").encendido; // y .agarrado, .enSuLugar, .encender(), .alEncender(() => {}), .volver()
nivel.luzMala("luz-mala").estado; // "esperando", "volando", "despistada", "yendose", "posada", "revoloteando" o "encerrada"
nivel.luzMala("luz-mala").guiar(camino, senuelos); // y .posaderos(lista), .irAPosaderos(ya?), .encerrar(candil), .parada, .extravios, .vueltas, .guio, .alExtraviarse(i => {}), .alEncerrar(j => {})
```

En línea viajan en la foto el marcador del pampero (corrido en x lo que sopla), la hoja de la tranquera y su sombra,
las boleadoras, el chambergo, el escalón del pie de amigo (40 m abajo mientras nadie hace pie), el candil y la Luz. El
invitado no corre `antes` ni el guion: ve las rayas del viento por el marcador, abre las boleadoras que ve volar, ve
titilar la Luz cuando le llega ladeada y prende el candil cuando ve la Luz adentro.

## Las piezas de La medianoche (TU-49)

Las que estrena el nivel 16, La medianoche (`apps/juego/src/niveles/piezas-medianoche.ts` y `curupira.ts`; su lectura,
en `formato-medianoche.ts`). Como las otras, su malla no se dibuja. El agua es la de La poza; el arbolito que pide el
Curupira es un `bloque` de Xibalbá (9 kg) que el guion viste de plantón.

| `pieza`    | Qué es y cómo se arma con su caja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Propiedades                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nenufar`  | Una hoja de vitória-régia, el nenúfar gigante: de radio el mayor de la X y la Z de la caja y de grueso su alto. Flota de verdad (un prisma de 16 lados, para que el agua la mida de cada lado), se hunde y se ladea un poco con el que salta encima y lo lleva. Su tallo la vuelve a su lugar si la corriente o un salto la corren.                                                                                                                                                                                                                                              | `masa` (20 kg) · `tallo` (250 N/m)                                                                                                                            |
| `montaria` | La canoa amazónica, del tamaño de la caja, con el piso arriba de la caja; avanza hacia el + de su lado más largo. Flota y gira solo alrededor de su Y. Tiene dos puestos: el de la proa rema a la izquierda y el de la popa a la derecha. Cada vez que el que va de pie en su puesto alza los brazos, da una palada (si terminó la anterior). Dos paladas que empiezan con menos de `compas` entre una y otra van al mismo ritmo y empujan con toda su fuerza, derecho; fuera de ritmo (o solo), cada una empuja `fuera` y tuerce la canoa. Al que va a bordo, quieto, lo lleva. | `masa` (50 kg) · `remo` (95 N por palada) · `palada` (0.55 s) · `compas` (0.25 s) · `fuera` (0.15) · `lado` (0.35 m: dónde se clava cada remo)                |
| `fuegos`   | Los fuegos artificiales: un castillo de morteros en el medio de la caja (choca) y una mecha a cada punta de su lado más largo, con un chispero colgado de una estaca, a `chispero` de la base. Con los dos chisperos agarrados a la vez durante `juntos` se encienden: las mechas arden hasta el castillo y salen los cohetes, uno cada `cada`, que estallan detrás de la caja (sobre el río), en rojo y turquesa. Con uno solo, chispea y nada más.                                                                                                                             | `cohetes` (8) · `cada` (0.8 s) · `mecha` (2 s) · `juntos` (0.4 s) · `altura` (5.5 m) · `fondo` (13 m) · `radio` (3.6 m) · `chispero` (1.05 m) · `semilla` (1) |
| `curupira` | El Curupira, el guardián del bosque con los pies al revés (sus huellas apuntan para el lado de donde viene), de pie en el medio de la base de su caja, mirando a su frente; mide el alto de la caja. No choca. Lo mueve el guion: se ríe del que se pierde, pide el árbol señalando el hoyo y se alegra (baila) cuando se lo plantan. Cinemático, sin azar.                                                                                                                                                                                                                      | `reir` (2.2 s: cuánto dura una carcajada)                                                                                                                     |

```ts
nivel.nenufar("nenufar-1").encima; // cuántos muñecos están encima; y .ladeo, .casa, .volver()
nivel.montaria("montaria").remeros; // [proa, popa]: 0, 1 o null; y .paladas, .aCompas, .remos, .aBordo, .rumbo, .encima(p), .llevar(c), .volver()
nivel.fuegos("fuegos-1").estado; // "apagados", "chispeando", "mecha", "disparando" o "quemados"; .encendidos, .agarrados, .estallidos, .cielo, .encender(), .quemar(), .alEncender(() => {})
nivel.curupira("curupira").estado; // "mirando", "riendo", "pidiendo", "contento" o "escondido"; .risas, .reir(), .pedir(p), .alegrar(), .mudarse(p, rumbo), .esconder(), .alReir(() => {})
```

En línea viajan en la foto los nenúfares, la montaria y sus dos remos (cinemáticos sin choques: los mueve la canoa), los
chisperos, las chispas de las mechas, cada cohete y el Curupira. El invitado no corre el guion ni las piezas: cada
cohete le dice con su altura si está guardado y con su giro si ya estalló y cuánto, y así dibuja los mismos estallidos;
sabe lo que hace el Curupira por cómo lo ve inclinado (para atrás se ríe, para adelante pide, de costado baila). Con
cohetes en el cielo, la cámara de la escena se aleja y mira hacia arriba (`cielo`, en los dos).

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

## Los niveles sin Blender: del `00-patio` al `16-medianoche`, `98-piezas` y `99-prueba`

Sin Blender a mano, sus `escena.glb` se arman con `pnpm niveles` (`scripts/niveles/patio.mjs`, `pinar.mjs`, `poza.mjs`,
`calle.mjs`, `xibalba.mjs`, `tren.mjs`, `rio.mjs`, `trenzas.mjs`, `cafetal.mjs`, `canales.mjs`, `garrucha.mjs`,
`llano.mjs`, `puente.mjs`, `mina.mjs`, `minga.mjs`, `pampa.mjs`, `medianoche.mjs`, `prueba.mjs` y `piezas.mjs`, con
el exportador de three y las mismas propiedades que pondría Blender; lo común está en `comun.mjs`). Si los cambiás, volvé a correrlo y subí los `.glb`.

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

### `03-calle` (`?escena=nivel&nivel=calle`)

El nivel 3 (TU-25): Comayagua, Honduras. Calles coloniales en subida, el corredor alto de las casas, las alfombras de
aserrín, la torre del reloj y el campanario; la ronda la Carreta sin bueyes. Va de oeste a este; hacia +z (la cámara)
solo hay tapias bajas y delgadas, que no se trepan. Cada misión termina en un punto de control:

1. **La cuesta**, de a dos: un callejón de 12° justo del ancho de la carreta (90 kg). Uno solo no la mueve; los dos
   la suben hasta donde la cuesta se abre, ahí se traba (una cuña) y pasan por al lado → punto 1 en la plazuela.
2. **La Carreta sin bueyes**, de a dos: rueda sola de la plazuela al fondo de su calle y de vuelta, a 3.5 m/s, y al que
   encuentra lo saca de la calle. Uno empuja el freno (una palanca a la entrada) mientras la carreta espera en la
   plazuela, y el otro cruza la calle y empuja los dos huacales que tapan el zaguán → punto 2. Pasado el punto 2 queda
   frenada. Solo no se puede: la calle mide 9 m y la carreta pasa antes.
3. **La torre del reloj**: colgado de cada pesa (se salta a la manija), la pesa baja y su aguja llega a las doce; con
   las dos, la puerta del arco sube → punto 3.
4. **Las alfombras**: se sube por la escalinata al corredor alto, se cruza el callejón columpiándose en la enredadera
   (una para cada uno) y se baja por la otra escalinata → punto 4. Por la calle también se llega, pisando las
   alfombras. Llegar al punto 4 con las tres intactas da el logro, «Ni una pisada».
5. **Las campanas**, de a dos: cada una con su soga, a 7 m una de otra; si suenan juntas (cada una cuenta un segundo),
   la reja del mirador sube → punto 5.
6. **La bajada**: la carreta del mirador espera frenada hasta que suben los dos y no está empinada; entonces baja sola
   por el riel, sobre la barranca, y frena al llegar a la plaza (punto 6, la meta). Si en la bajada los dos se van
   para atrás, se empina y vuelca: caen a la barranca y la carreta vuelve arriba.

El secreto, «el pilón escondido en el carrito del parque», está arriba de la vitrina del carrito de la plazuela: se
trepa al mostrador (1 m) y de ahí a la vitrina (otro metro); la zona `secreto` está encima (da el sombrero bombín).
Con la Noche de tuerce no sale el mecate: uno sostiene el freno lejos del otro, y las campanas están a 7 m.

### `04-xibalba` (`?escena=nivel&nivel=xibalba`)

El nivel 4 (TU-26): Xibalbá de juguete, en Copán, Honduras. Pirámides y ceibas entre la niebla, estelas y túneles de
piedra clara, guacamayas por todas partes, y los murciélagos de Xibalbá. Va de oeste a este; cada misión termina en
un punto de control (`&punto=N` empieza en la misión N + 1):

1. **La plancha doble**, de a dos: una placa a cada lado de la entrada de la muralla, a 2 m una de otra. Con los dos
   encima a la vez la entrada se hunde y queda abierta → punto 1.
2. **La estela**, de a dos: se la gira entre los dos empujando sus varas (trabada si la agarra uno solo) hasta que el
   glifo del sol mira la reja; la reja se hunde → punto 2.
3. **El juego de pelota**: la pelota de hule en su soporte, frente al aro. Agarrarla, retroceder un paso, saltar y
   soltarla en el aire la mete por el aro; se hunde el portón → punto 3. Soltada parado no llega.
4. **La escalinata**, de a dos: el bloque de 9 kg en su altar (uno solo no lo saca de ahí); lo suben los dos grada por
   grada (30 cm) hasta el pie del templo (2.3 m, más de lo que se trepa), lo dejan contra la pared y desde el bloque
   se trepa → punto 4. Tirado sin servir, a los 3 s vuelve a su altar.
5. **El túnel de los murciélagos**, de a dos: uno lleva la antorcha con las dos manos y el otro la llave de jade, juntos
   (a oscuras los espantan), sin pasar la llama por debajo de las perchas. La llave encaja en la cerradura de la
   puerta del fondo y la puerta se hunde → punto 5. Solo no se puede: con la antorcha bien llevada no quedan manos
   para la llave, y con una sola mano los murciélagos la apagan. Apagada, se prende en el brasero de la entrada. El
   logro, «Con luz», es llegar al punto 5 sin que la apaguen ni una vez.
6. **La tumba**: la losa sube con el contrapeso, tanto como se hunde el plato; con las dos piedras de la repisa en el
   plato (o alguien parado encima) sube del todo → punto 6 adentro, la meta.

El secreto, «la guacamaya dorada en lo alto del templo», está arriba del muro del túnel: se sube por tres escalones de
1.5 m junto a la boca del túnel, colgándose (da la máscara «Guacamaya»). El dorado, el jade y el fuego no tienen color:
se leen por la forma, lo claro y el brillo.

### `05-tren` (`?escena=nivel&nivel=tren`)

El nivel 5 (TU-27): El Progreso, Honduras. Una estación vieja de la bananera, rieles entre bananales, una grúa y el
Duende, que cambia las palancas cuando nadie lo ve. Va de oeste a este; cada misión termina en un punto de control
(`&punto=N` empieza en la misión N + 1):

1. **Los vagones.** El tren (la locomotora y un furgón) tapa el paso a nivel del cerco del andén (delgado: no se
   trepa). Se empuja la plataforma suelta por la vía hasta el furgón: se enganchan, el tren sale y se pasa → punto 1.
2. **La dresina**, de a dos: sube 80 cm por un puente de caballetes. Cada uno se para en una punta mirando la bomba y,
   cuando su manija está arriba, la agarra y la baja. Solo, entre bombeo y bombeo hay que cruzar la plataforma y la
   cuesta lo devuelve → punto 2 en la loma, donde se frena.
3. **El cambio de vía**, de a dos: uno empuja la palanca del cambio y se queda cerca (si nadie la ve, el Duende la
   vuelve); el otro bombea un par de veces, la dresina baja sola y por el desvío llega al bananal → punto 3. Derecho, se
   acaba en el puente roto; sola ahí, vuelve a la loma.
4. **La grúa**, de a dos: uno empuja la palanca de la caseta y el gancho baja; el otro agarra el racimo grande (9 kg)
   de su horca y se engancha. Al soltar la palanca la grúa lo lleva a la tolva (2.5 m, no se trepa) y el portón de la
   empacadora baja → punto 4.
5. **La romana:** los tres racimos de 4 kg del colgadero, soltados bajo la romana, quedan colgados de sus ganchos;
   con los tres (con dos no alcanza) el puente levadizo baja sobre el canal → punto 5.
6. **El Duende:** el portón final baja mientras sus dos palancas están movidas, pero quedan lejos del portón y el
   Duende vuelve la que nadie ve. Hay que llevarle el sombrero (en el perchero de la garita) y dejárselo delante: se lo
   pone, se queda contento y deja las palancas en paz → punto 6, la meta.

El secreto, «el racimo de mínimos dorados», cuelga en el rellano del puente roto: se llega yendo derecho en el cambio
(da el peinado «Copete»). El logro, «Puntual», es llegar a la meta antes de que pite el tren: sale al enganchar los
vagones y llega a la estación de llegada seis minutos después. Retomando un avance guardado no se gana (el tren ya
llegó). En la noche de tuerce no sale el mecate: la pareja se separa en el cambio, en la grúa y en el portón.

### `06-rio` (`?escena=nivel&nivel=rio`)

El nivel 6 (TU-28): el Río Plátano, La Mosquitia (Honduras). Selva, un río ancho, puentes colgantes y las huellas
enormes del Sisimite. Estrena el pipante, el puente colgante, la palmera y el Sisimite; el agua es la de La poza. Lo
arma `scripts/niveles/rio.mjs` (`pnpm niveles`). Va de oeste a este, río arriba, y va todo corrido 53 m hacia −x: la
foto de la red mide las posiciones en int16 (±64 m desde el origen) y el nivel mide 124 m. Cada misión termina en un
punto de control (`&punto=N` empieza en la misión N + 1):

1. **El pipante**, de a dos: amarrado junto al muelle. El río baja a 0.75 m/s y tiene dos piedras. Uno empuja con
   la pértiga desde la popa y el otro lleva el rumbo desde la proa (el pipante gira hacia donde él mira). Solo con la
   pértiga se tuerce contra la orilla; solo con el rumbo, la corriente se lo lleva → punto 1, en el embarcadero. El
   pipante vacío que quedó lejos vuelve solo al muelle.
2. **Los rápidos**: una quebrada brava (2.4 m/s) cruza el camino; se pasa por un vado de piedras mientras bajan
   troncos por tres carriles, siempre igual (cada 4.2 s por carril). Se espera entre carril y carril; el tronco que
   alcanza al que está en el vado lo tumba al agua → punto 2.
3. **Las huellas**: el camino se parte en dos por un matorral que no se trepa. En el carril de adelante los dedos de
   las huellas apuntan para adentro; en el de atrás, para afuera. El Sisimite tiene los pies al revés: se fue por el
   de atrás. El de adelante termina en un lodazal → punto 3.
4. **El puente colgante**, de a dos: 10 m sobre la cañada, con dos huecos de 1.6 m (ni se saltan). Las dos tablas
   (9 kg, 5 m) están sobre caballetes, una detrás de otra: se llevan en fila con la mano derecha, cerca del medio, y
   se sueltan con el de adelante en el borde de cada hueco. Uno solo no las levanta, y la que arrastra no queda
   clavada. Las tiradas en el suelo vuelven a sus caballetes → punto 4.
5. **El Sisimite**, dormido de pared a pared en el cañón: se trepan sus pies y sus canillas colgándose y se camina
   hasta su pecho → punto 5, en la cumbre. Llegar sin que abra los ojos da el logro, «Sin despertarlo». Del pecho se
   baja por el brazo, sin pisarle la cara.
6. **La palmera**, de a dos: uno agarra la manija de la soga y camina para atrás hasta doblarla del todo; el otro se
   mete en el cogollo, en el suelo. Al soltar la soga, la palmera lo lanza sobre el barranco (2.2 m). Del otro lado,
   el que voló agarra la liana recogida junto a la ceiba y la suelta: se corre por la rama y queda colgando junto a
   la orilla de acá, y el otro cruza columpiándose. Recién ahí aparece la meta → punto 6, a la entrada de la ciudad
   perdida. Solo no se puede: al soltar la soga la palmera se endereza antes de llegar al cogollo.

El secreto, «la figura de jade de la ciudad perdida», está en el nicho de arriba del templo, detrás de la meta: dos
gradas de 1.4 m que se trepan colgándose (la zona `secreto`). Sin color nuevo: es lo único claro, pulido y con luz de
la ciudad. De noche no va la trampa del mecate: la palmera lanza a uno solo al otro lado del barranco.

### `07-trenzas` (`?escena=nivel&nivel=trenzas`)

El nivel 7 (TU-40): Las trenzas, en Antigua (Guatemala). Calles de fachadas en grises (sin color: solo los pañuelos lo
tienen), arcos, ruinas de iglesias y un volcán al fondo; ahí anda el Sombrerón, que le hace trenzas a todo (a las
cuerdas del arco, a la crin y la cola de la mula, a la gente). Estrena el nudo, la mula, el balde de agua y las piedras
calientes. Lo arma `scripts/niveles/trenzas.mjs` (`pnpm niveles`). Va de oeste a este, y va todo corrido 38 m hacia
−x: la foto de la red mide las posiciones en int16 (±64 m desde el origen) y el nivel mide 92 m. Cada misión termina
en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **El nudo**, de a dos: las cuerdas trenzadas amarran el portón del arco, de lado a lado de la calle. Cada uno agarra
   un cabo (a 4 m uno de otro) y camina para atrás; con los dos jalados a la vez el nudo se afloja en 2.5 s, se desata y
   las dos hojas del portón se abren → punto 1. Solo no se puede: no se llega a los dos cabos, y jalando uno solo el
   nudo se aprieta.
2. **La mula**: no da un paso sin su carga. Se agarra cada bulto (4 kg: uno solo) de su pilar y se lo suelta junto al
   costado de la mula, en alto: queda amarrado en su lomo. Con los dos, se la lleva de la rienda (la manija delante de
   su cabeza) por al lado de la pila hasta el mesón: el zaguán se abre → punto 2. Los bultos tirados en el suelo
   vuelven a su pilar.
3. **Las ruinas**: el piso de la iglesia se hundió (cuenta como caída). Se cruza saltando de arco caído en arco caído
   (cuatro, con huecos de 60 cm) → punto 3.
4. **El balde**, de a dos: la fuente está de este lado del pretil (85 cm y delgado: ni se trepa ni se salta) y las dos
   piedras calientes, en el pasillo de la sacristía, del otro. Uno trepa el muro caído del fondo (1.4 m, colgándose);
   el otro agarra el balde de su pilar, lo llena bajo el caño de la fuente y se lo pasa por encima del pretil, de mano
   en mano. El de allá lo lleva hasta cada piedra y la apaga (se vacía el balde, la piedra se hunde); vacío, lo suelta
   y el balde vuelve solo a su pilar para la segunda → punto 4, pasado el pasillo. Solo no se puede: el balde lleno que
   se suelta se derrama (no se puede dejar sobre el pretil ni tirar), y con el balde en las manos no se trepa el muro.
5. **El sombrero**: el del Sombrerón rodó al pie de la cuesta (1.5 m en 8 m). Se lo empuja rodando, caminando contra
   él, hasta su plaza; él va por él y se lo pone, y aparece la meta → punto 5. Soltado en la cuesta, rueda para abajo.
   Al que entra a su plaza sin el sombrero, el Sombrerón lo persigue y le hace trenzas (lo tumba).

El secreto, «un barrilete escondido en el campanario», está arriba de la torre de la plaza del Sombrerón: un escalón y
la torre, de 1.45 m cada uno, que se trepan colgándose (la zona `secreto`; da el pañuelo «Bufanda»). Antes de devolverle
el sombrero, subir es meterse a su plaza. El logro, «Sin un nudo», es llegar a la meta sin que el Sombrerón haya
enredado a ninguno de los dos. De noche no va la trampa del mecate: los cabos del nudo están a 4 m, y en la fuente uno
se queda de cada lado del pretil.

### `08-cafetal` (`?escena=nivel&nivel=cafetal`)

El nivel 8 (TU-41): Izalco, El Salvador. Cafetales en la falda del volcán, patios de secado, un beneficio y El
Cipitío, un cipote barrigón que tira piedritas y se ríe. Estrena lanzar y atrapar, el canasto y la zaranda. Lo arma
`scripts/niveles/cafetal.mjs` (`pnpm niveles`). Va de oeste a este, subiendo por terrazas: el cafetal (y = 0), el patio
de secado (1.4 m) y la terraza del beneficio (3.5 m). Mide 82 m (de −46 a 36): cabe en la foto de la red sin correrlo.
Cada misión termina en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **Los canastos**, de a dos: uno, en el tapesco del cafetal (80 cm), agarra un canasto de su poste, retrocede un
   paso, salta y lo suelta en el aire; el otro, parado en el patio a un metro del borde, lo atrapa con los brazos
   alzados y lo vacía en el recibidero, a más de 6 m del borde (hasta ahí no llega uno tirado). Con tres vaciados
   baja el portón del patio → punto 1. Solo no se puede: el patio (1.4 m) se trepa colgándose, con las dos manos, así
   que con un canasto no; y el canasto que nadie atrapa cae en el patio y se riega (vuelve lleno a su poste).
2. **Las piedras del Cipitío**: el muro de la terraza mide 2.1 m (se trepa hasta 1.65). El Cipitío, en la rama del palo
   de jocote que sale por encima del muro, le tira piedras a los pies al que se acerca. El que lo espera al pie del muro
   queda parado sobre la piedra (50 cm), y de ahí trepa → punto 2. El Cipitío se va riendo al portillo; la piedra se
   queda para el otro.
3. **La zaranda**, de a dos: colgada de la ramada; cada uno agarra una manija y la mueven para un lado y para el otro
   (uno tira mientras el otro empuja). A los seis zarandeos la llave cae por detrás y queda colgando de un clavo; se pasa
   por debajo de la zaranda con los brazos abajo y se la agarra. Llevada al candado, junto a la puerta del beneficio,
   se encaja y la puerta baja → punto 3. Solo no se puede: con uno solo la zaranda está trabada.
4. **La polea**: los dos costales (4 kg) en su tarima; se los cuelga del gancho de la polea (abajo, a la altura de las
   manos) y, colgándose de la manija (se salta), el gancho sube 2.8 m y el costal se descarga en la troja (2.6 m, no se
   trepa). Con los dos arriba se abre la puerta de atrás del beneficio → punto 4.
5. **El guineo**: El Cipitío se sentó en el portillo de la tapia (2.4 m) y le tira piedrazos que tumban al que se acerca
   (a menos de 6 m; le adelanta lo que camina, así que no se lo esquiva). Al que le trae el guineo de la mata de atrás
   del beneficio no le tira: soltado delante de él, se lo come, se sube contento a la tapia y deja libre el portillo
   → punto 5, la meta.

El secreto, «el sombrero puntudo del Cipitío», está arriba de la piedra grande de detrás de la meta: dos gradas de
1.4 m que se trepan colgándose (la zona `secreto`; da el sombrero «puntudo»). El logro, «Buen pulso», es atrapar diez
canastos seguidos: la racha se corta cuando un canasto lanzado cae sin que nadie lo atrape (el que ya atraparon y
después se suelta no la corta). De noche no va la trampa del mecate: el que lanza y el que atrapa quedan a más de 3 m.

### `09-canales` (`?escena=nivel&nivel=canales`)

El nivel 9 (TU-42): Los canales de Xochimilco, México. Canales, chinampas con flores, trajineras (sin color:
siluetas y grises) y una feria. Estrena la trajinera, el nivel del agua de La Llorona, la chinampa flotante y la
piñata. Lo arma `scripts/niveles/canales.mjs` (`pnpm niveles`). Va de oeste a este y todo va corrido 45 m hacia −x
(el nivel mide 104 m; la foto de la red, ±64). Cada misión termina en un punto de control (`&punto=N` empieza en la
misión N + 1):

1. **La trajinera**, de a dos: amarrada al muelle, en un carril de 2.4 m con corriente en contra (0.6 m/s). Cada
   uno empuja con la pértiga de su lado, de pie en la popa. Con una sola no le gana a la corriente y se tuerce
   contra la orilla; pasándose de un lado al otro, la corriente se la lleva de vuelta → punto 1, en la chinampa de
   La Llorona. La trajinera vacía que quedó lejos vuelve sola al muelle.
2. **La Llorona** llora tanto que el canal está crecido (25 cm): el arco de la trajinera choca contra el puente. Se
   ríe de los porrazos: el que trepa la tarima de los mariachis (1.5 m, colgándose) y se tira delante de ella cae
   como trapo y le saca una carcajada. Cada carcajada baja un poco el agua; a la tercera deja de llorar y el canal
   baja del todo. Si pasan 20 s sin reírse, se olvida de una. La trajinera, que los espera junto a la chinampa,
   pasa bajo el puente hasta el embarcadero → punto 2.
3. **Las chinampas flotantes**: cinco islotes de 1.3 m con 70 cm de agua entre uno y otro, que se hunden mientras
   alguien está encima (el doble con los dos). Se cruzan saltando sin quedarse → punto 3, a la entrada de la feria.
4. **La piñata**, de a dos: cuelga a 3.5 m. La manija de la soga está junto al poste del fondo: uno la jala
   caminando hacia el este y la piñata baja a la altura de las manos; el otro le pega saltando con los brazos
   alzados. Con cuatro golpes se rompe y se hunde la reja del muelle de las flores → punto 4. Solo no se puede: al
   soltar la soga la piñata sube antes de que llegue debajo (la manija queda a más de 3 m).
5. **La trajinera de las flores** (8 macetas), con las mismas dos pértigas, por un canal con dos chinampas en el
   medio (la primera se pasa por detrás, la segunda por delante) hasta el embarcadero de la feria → punto 5, la
   meta. Cada golpe fuerte (contra una chinampa, o llegar rápido al muelle) bota una flor. Llegar con todas da el
   logro, «Ni una flor menos». La trajinera que dejan sola vuelve a su muelle con todas sus flores.

El secreto, «un alebrije dormido en una chinampa», está en la chinampa firme del fondo de la ciénaga, a un salto
de la segunda chinampa flotante (la zona `secreto`). Es lo único claro y con dibujitos de la ciénaga. De noche no va
la trampa del mecate: el que jala la soga de la piñata queda lejos del que le pega.

### `10-garrucha` (`?escena=nivel&nivel=garrucha`)

El nivel 10 (TU-43): La garrucha, en el Eje cafetero (Colombia). Montañas (en siluetas y grises), palmas de cera
altísimas, guaduales y cables sobre los cañones. Estrena la garrucha, la chiva, la palma de cera y La Patasola; las
lianas son bejucos. Lo arma `scripts/niveles/garrucha.mjs` (`pnpm niveles`). Va de oeste a este y va todo corrido 52 m
hacia −x, para caber en la foto de la red (el nivel mide 120 m). La finca está a 0.3 m, la loma a 2.3 m y la
plataforma de la palma y la otra orilla del cañón a 8.3 m. Cada misión termina en un punto de control (`&punto=N`
empieza en la misión N + 1):

1. **La garrucha**, de a dos: la canasta cruza el cañón del río, de la finca a la loma (13 m, 2 m más arriba). Uno se
   sube a la canasta y el otro jala la manija de la finca caminando hacia atrás, la suelta, vuelve y otra vez (unas
   tres jaladas) → punto 1, al bajarse en la loma. Vacía, la canasta baja sola; el que llegó jala la manija de arriba
   y sube al otro. Solo no se puede: desde la canasta no se alcanza la manija, y la que sube vacía se devuelve.
2. **La carrera de saltos contra La Patasola**: cuatro zanjas de 70 cm cruzan la loma (se saltan; el que cae,
   reaparece). Cuando alguno cruza la salida, La Patasola arranca brincando por su carril, detrás, y llega a la meta
   en 15 s. Corriendo y saltando bien se le gana por unos dos segundos: el logro, «En una pata». Si gana ella, se
   sigue igual → punto 2, pasada la meta.
3. **La chiva**, de a dos: parqueada junto a la bodega, con el techo a la altura del piso. La carga (un huacal de
   8 kg) espera en una tarima, a la altura de las manos: se agarra entre los dos, cada uno con el brazo de adentro, y
   se lleva al techo. Con la carga y los dos encima, la chiva arranca, vadea el río y pasa dos baches. Si en un bache
   la carga no la sostienen los dos, salta del techo (con el que la sostenía solo), la chiva frena, se devuelve y la
   carga vuelve a la tarima. Con uno solo en el techo no arranca → punto 3, en la otra loma.
4. **La palma de cera**: 6 m de tronco. Se agarra la manea con las dos manos, adelante sube y atrás baja; arriba se
   encarama a la plataforma → punto 4. La manea baja sola para el otro.
5. **El cañón de las lianas**: de la plataforma, tres lianas cuelgan de un cable, cada una a 30 cm de un borde, con
   dos farallones entre ellas (huecos de 2 m). De liana en liana, columpiándose y soltándose sobre el piso de
   enfrente → punto 5, la meta, en la otra orilla.

El secreto, «una orquídea en la palma más alta», está detrás de la meta: la palma más alta tiene su manea y un nido
en lo alto, donde está la orquídea (la zona `secreto`). Sin color nuevo: la orquídea es lo único blanco y con luz allá
arriba. Los bordes invisibles del lado de la cámara solo atajan a los muñecos (el guion les cambia los grupos de
choque): así la cámara no los ve como paredes. De noche no va la trampa del mecate: el que jala la manija se queda en
la finca mientras el otro cruza en la canasta.

### `11-llano` (`?escena=nivel&nivel=llano`)

El nivel 11 (TU-44): Los Llanos, Venezuela. Sabana plana, molinos de viento, corrales y hamacas; anda por ahí el
Silbón. Estrena el sonido como pista, el molino y la hamaca. Lo arma `scripts/niveles/llano.mjs` (`pnpm niveles`). Va
de oeste a este, y va todo corrido 49 m hacia −x (mide 104 m: la foto de la red mide las posiciones en int16). Cada
misión termina en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **El Silbón**, en el pajonal: está escondido en una de tres matas y no se ve. Silba al revés: bajito de cerca y
   fuerte de lejos, y del lado contrario. Hay que ir hacia donde suena más bajito; al hallarlo se alza, se va y la
   talanquera del pajonal se abre → punto 1. Entrar antes a otra mata es un intento fallido: hallarlo al primer intento
   da el logro, «Buen oído».
2. **El molino**, de a dos: la empalizada del hato (2.6 m) y las pacas de heno (2.25 m) no se trepan. Uno empuja el
   freno y el molino para con las aspas en rampa, del borde del pozo hasta las pacas; el otro sube caminando por ellas,
   baja del otro lado y saca la tranca: el portón se abre y queda abierto → punto 2. Solo no se puede: al soltar el
   freno las aspas agarran viento antes de que llegue arriba, y lo botan al pozo.
3. **El ganado**: tres reses pastan en el potrero y se apartan del que se acerca. Se las arrea caminando detrás hasta
   el corral; con las tres adentro, la talanquera del corral se abre → punto 3.
4. **La hamaca**, de a dos: uno jala la cabuya caminando para atrás y estira la hamaca hasta el suelo; el otro se mete
   y, al soltarla, sale disparado sobre el caño (3.2 m: no se salta). Del otro lado empuja la palanca y baja el puente
   de tablas (queda abajo); el otro cruza → punto 4. Solo no se puede: al soltar la cabuya la hamaca vuelve antes de
   que llegue a meterse.
5. **El saco**: arriba de la troja (1.5 m, se trepa colgándose) está el saco de cachivaches del Silbón, sobre un banco.
   Se lo baja, se lo lleva y se lo deja junto al Silbón, que espera al lado de su rancho: lo recoge, se va contento y
   aparece la meta → punto 5.

El secreto, «un arpa llanera bajo el samán», está en el conuco de atrás: se trepa la tapia (1.4 m) colgándose y la zona
`secreto` está al pie del samán (da la vincha). De noche no va la trampa del mecate: el que frena el molino queda lejos
de las aspas, y la hamaca lanza a uno solo al otro lado del caño.

### `12-puente` (`?escena=nivel&nivel=puente`)

El nivel 12 (TU-45): Q'eswachaka, Perú. Un cañón andino, terrazas con canales de agua y un puente tejido a mano; andan
por ahí las llamas, que escupen si las apurás. Estrena trenzar la cuerda, el puente que se mece y los canales. Lo arma
`scripts/niveles/puente.mjs` (`pnpm niveles`). Va de oeste a este y va todo corrido 42 m hacia −x (mide 91 m: la foto
de la red mide las posiciones en int16). La pampa y la otra orilla están a la altura del puente (y = 0), las terrazas
suben de a 1.3 m y la puna de la llama está a 2.6 m. Cada misión termina en un punto de control (`&punto=N` empieza en
la misión N + 1):

1. **La qeswa**, de a dos: tres hebras de paja entre dos torcedores, a 6 m uno del otro. Cada uno agarra el suyo con
   las dos manos y gira para su lado (uno a la izquierda, el otro a la derecha): en unos ocho segundos la cuerda queda
   trenzada y baja la puerta de la pirca → punto 1. Solo no se puede: un torcedor solo gira en vano, y los dos para
   el mismo lado tampoco trenzan. Si uno suelta a medias, se destuerce.
2. **Tender el puente**, de a dos: el puente cuelga flojo en el cañón, sin piso. Uno jala la soga de la cabecera
   caminando hacia atrás y lo tensa; el otro, sobre el estribo del otro costado, sostiene el amarre con las dos manos.
   Tenso y sostenido dos segundos y medio, queda amarrado, se teje el piso y aparece la cabecera → punto 2. Solo no se
   puede: la soga queda a más de 4 m del amarre y, soltada, el puente se afloja antes de llegar.
3. **Cruzarlo sin que se voltee**: el puente se mece con los que caminan encima (más rápido y más en el medio, más) y
   se calma solo. De corrido se voltea a mitad de camino (con los dos encima, en menos de tres segundos) y bota a los
   de encima al río; parándose cuando se mece mucho, se cruza → punto 3, en la otra orilla.
4. **Los canales**: el agua sale del ojo de agua arriba de la tercera terraza, baja por la acequia madre y se va entera
   por la primera bocatoma abierta, de arriba hacia abajo. Al llegar, la de arriba está abierta (su terraza ya está
   regada) y las de abajo, secas: hay que cerrar la de arriba y abrir las de abajo (y cerrar la del medio para que el
   agua llegue a la primera). Cinco segundos de agua riegan una terraza; con las tres regadas baja la puerta de arriba
   → punto 4. Las terrazas se suben colgándose.
5. **La llama carguera**: se la lleva de la rienda por el camino de piedra hasta el patio del tambo. Anda más despacio
   que un muñeco: con la rienda tirante más de un segundo y medio se enoja, escupe al que la lleva (lo tumba), se echa y
   se vuelve a su casa. También con el que se le viene encima por detrás. Llevándola a su paso (parando cuando la rienda
   se pone tirante) llega, se queda contenta y aparece la meta → punto 5.

El secreto, «un quipu escondido entre las piedras», está arriba del pedregal del fondo de la pampa (1.35 m, se trepa
colgándose): entre las dos piedras grandes, la zona `secreto` (da el chullo). Es lo único claro del pedregal. El logro,
«Tejedores», es armar el puente sin soltar la cuerda: trenzar la qeswa y tender el puente sin que nadie suelte su
torcedor a medio trenzar ni la soga del puente tenso antes de amarrarlo (retomando del punto 1 en adelante ya no se
puede). De noche no va la trampa del mecate: los torcedores quedan a 6 m, y la soga a más de 4 m del amarre.

### `13-mina` (`?escena=nivel&nivel=mina`)

El nivel 13 (TU-46): La mina, en Potosí (Bolivia). Túneles con vigas en el Cerro Rico, vagonetas, un pozo con su jaula,
la galería del Tío (un diablito que quiere su ofrenda) y, al salir, el salar blanco que refleja el cielo. Los túneles
son oscuros, pero siguen siendo siluetas sobre niebla clara: la única luz es blanca (las lámparas, las velas y el haz
del sol). Estrena la vagoneta, la polea (la de El cafetal, para la jaula) y los espejos. Lo arma
`scripts/niveles/mina.mjs` (`pnpm niveles`). Va de oeste a este: la galería de abajo (y = 0), la de arriba (2.2 m) y
el salar (−3.4), cuesta abajo. Mide 104 m (de −52 a 52): cabe en la foto de la red sin correrlo. Cada misión termina
en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **La vagoneta**, de a dos: la vía sigue derecho hasta un derrumbe y el cambio la manda por un desvío a la báscula
   de la reja. Uno empuja la vagoneta caminando detrás de ella; el otro sostiene la palanca del cambio (vuelve sola al
   soltarla), contra la pared del fondo. La vagoneta que llega a la báscula sube la reja → punto 1. Solo no se puede:
   la palanca queda a más de 4 m de donde se empuja cuando la vagoneta pasa el cambio, y suelta, la vagoneta se para
   enseguida. Derecho, se queda en el derrumbe y a los 3 s vuelve sola a su lugar.
2. **El pozo**: la galería de arriba está a 2.2 m (no se trepa). La jaula sube con el gancho de dos poleas: uno se
   cuelga de la manija de abajo (se salta) y el otro sube en la jaula → punto 2. Vacía, la jaula baja sola; el de
   arriba se cuelga de la manija de arriba y sube al otro. Desde la jaula no se alcanza la manija de abajo.
3. **La ofrenda del Tío**: la ofrenda está en su repisa. Hay que llevársela al Tío entre tres hileras de velas, en
   zigzag: si pasa por una vela, ¡pum! (un susto: humo, la ofrenda vuelve a la repisa y el que la llevaba aparece
   frente a ella). El Tío no se queda con la que alguien tiene en la mano: hay que dejársela suelta al alcance; se
   pone contento, fuma y abre su puerta → punto 3.
4. **Los espejos del salar**, de a dos: el sol entra por una grieta del fondo. Cada uno empuja el brazo de un espejo
   hasta su tope y lo sostiene: el primero manda el haz hacia el segundo, y el segundo de vuelta al sol de piedra del
   fondo, que sube la puerta de luz → punto 4. Solo no se puede: cada espejo vuelve al reposo al soltarlo, y el primero
   solo no llega nunca al sol (queda al oeste de él).
5. **La salida**: la vagoneta espera en la boca de la mina, con el freno puesto y el borde a ras del piso. Al meterse
   los dos (o uno solo, a los 2 s) se suelta el freno y baja la cuesta por un puente de rieles sobre el barranco hasta
   el salar → punto 5, la meta. Si queda abajo vacía sin que lleguen, vuelve sola a la boca.

El secreto, «una pepita de plata en la galería vieja», está en una repisa de 1.4 m al fondo, entre la reja y el pozo
(se trepa colgándose; la zona `secreto`, da la máscara del diablito). El logro, «Sin chispas», es salir de la mina sin
explotar: llegar a la meta sin que la ofrenda pase nunca por las velas. Retomando un avance de después de la ofrenda no
se gana (no se sabe si explotaron). Los bordes invisibles del lado de la cámara solo atajan a los muñecos, como en La
garrucha. De noche no va la trampa del mecate: el que sostiene el cambio queda lejos de la vagoneta, uno sube en la
jaula mientras el otro se cuelga abajo y los espejos están a 6 m.

### `14-minga` (`?escena=nivel&nivel=minga`)

El nivel 14 (TU-47): La minga, en Chiloé, Chile. Palafitos sobre la marea (de grises: siluetas, sin colores), el
bosque mojado con sus nalcas, una iglesia de madera en la loma, un muelle y El Caleuche, el barco fantasma que en
realidad anda de fiesta. Estrena la marea, mover una casa y los cabos de barco. Lo arma `scripts/niveles/minga.mjs`
(`pnpm niveles`). Va de oeste a este y todo va corrido 52 m hacia −x (mide 116 m; la foto de la red, ±64). Cada
misión termina en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **Los palafitos**: la marea de la caleta pasa 10 s abajo, sube en 3, se queda 6 tapando la playa y baja en 3. Con
   la marea alta solo se salvan los corredores de los dos palafitos (se sube por sus rampas). Del camino al primer
   palafito, de ahí al segundo y del segundo a la explanada: cada tramo alcanza en una bajamar, dos seguidos no. El que
   se queda en la playa cae al agua y reaparece junto al compañero → punto 1, arriba de la explanada.
2. **La minga**, de a dos: la casa va sobre un camino de troncos. Cada uno agarra la manija de un cabo y camina para
   atrás; la casa anda solo con los dos cabos tirados, cada uno por uno distinto (solo, con uno o con los dos cabos en
   las manos, no se mueve). Si uno tira torcido, la casa se corre y se sale de los troncos: se atasca un rato y los
   vecinos la vuelven a poner. Cuando llega a su sitio se hunde la tranquera (2.6 m: no se trepa) → punto 2. Llevarla
   sin que se salga nunca de los troncos da el logro, «A hombro».
3. **La chalupa**, de a dos: está fondeada lejos del muelle (2.4 m de agua: no se salta) y sus dos cabos cuelgan de la
   barandilla de la orilla. Cada uno lleva un cabo a su bita; las bitas están a 5 m una de otra, así que uno solo no
   las alcanza. Con los dos a la vez, un segundo, se amarra, se arrima y se corre junto al muelle. Se baja a ella y se
   la cruza hasta los brazos del ancla del Caleuche, que cuelga del otro lado → punto 3 (desde el muelle no se llega).
4. **El ancla**: parados en sus brazos, la tripulación la sube hasta la borda; se pasa a la cubierta por el portalón →
   punto 4. Sin nadie, la vuelven a bajar a buscar al otro.
5. **La fiesta**: con los dos a bordo suena la música (24 compases, unos 19 s) y la cubierta se mece de lado a lado,
   cada vez más (hasta 7°). Si uno se cae al agua (o se cuelga de la borda), se corta la música y empieza de nuevo.
   Aguantando la canción entera, El Caleuche baja la plancha de la popa al muelle de la fiesta → punto 5, la meta.

El secreto, «un curanto enterrado en la playa», es el montículo con hojas de nalca y vapor detrás del segundo
palafito, junto al mar (la zona `secreto`; da las colitas): se llega solo con la marea baja, y el desvío come tiempo del
último tramo. De noche no va la trampa del mecate: las bitas de la chalupa quedan a 5 m una de otra.

### `15-pampa` (`?escena=nivel&nivel=pampa`)

El nivel 15 (TU-48): La Pampa, Argentina. Llanura hasta el horizonte, alambrados, un ombú enorme, tranqueras y un
molino (el del llano, girando al fondo del potrero); de noche anda La Luz Mala. Estrena el pampero (el viento), la
tranquera y las boleadoras, más el chambergo, el pie de amigo, el candil y la Luz. Lo arma `scripts/niveles/pampa.mjs`
(`pnpm niveles`). Va de oeste a este y va todo corrido 52 m hacia −x (mide 109 m: la foto de la red mide las
posiciones en int16). Cada misión termina en un punto de control (`&punto=N` empieza en la misión N + 1):

1. **Seguir a la Luz** por el bañado: una calzada de tierra que va en zigzag apenas bajo el agua (casi no se ve). La
   Luz se para en cada vuelta y espera a que alguno llegue; en cuatro vueltas hay un ramal que se corta y a veces
   (azar de semilla) se equivoca: se va titubeando sobre el agua honda, se da cuenta y vuelve. El que la sigue ahí se
   cae al agua y reaparece junto al compañero → punto 1, en la otra orilla. Conviene que uno vaya adelante y el otro
   una parada atrás.
2. **La tranquera**, de a dos: el pampero la cierra de golpe. Uno la agarra de la manija y la sostiene abierta
   caminando para atrás; el otro pasa y, del otro lado, corre el pasador (una palanca junto al poste de la bisagra),
   que la traba abierta; el primero la suelta y pasa → punto 2. Pasar los dos sin que se cierre nunca da el logro,
   «Contra el viento». Solo no se puede: al soltarla se cierra antes de llegar al hueco, y al que quedó en el medio lo
   voltea para atrás.
3. **El chambergo**: el viento le voló el sombrero al puestero y lo pasea por el potrero (de 1.1 a 3.1 m de alto). Se
   descuelgan las boleadoras de su poste y se las tira saltando cuando el chambergo pasa bajo y cerca; enredado, cae y
   el portón del puesto se abre → punto 3. Si erran, las boleadoras vuelven solas al poste.
4. **El ombú**, de a dos: la horqueta está a 2.6 m (no se trepa). Uno se para al pie del tronco con los dos brazos
   alzados (pie de amigo) y el otro se trepa a sus manos (1.1 m) y de ahí a la horqueta. Arriba empuja la palanca y
   baja la rama gacha hasta el suelo: el otro sube caminando. Por la rama larga, en bajada, los dos cruzan la cañada
   (6 m: no se salta) → punto 4. Solo no se puede: sin nadie que haga pie no hay escalón, y el que lo hace no lo pisa.
5. **Encerrar a la Luz en el candil**: la Luz se posa en los postes del alambrado y salta de uno a otro; se espanta del
   que se le acerca sin candil. Se descuelga el candil y se lo acerca con los brazos alzados a la Luz posada: queda
   encerrada, el candil alumbra y aparece la meta → punto 5.

El secreto, «un mate olvidado en el ombú», está en la copa de atrás: desde la horqueta se trepa 1.4 m colgándose y la
zona `secreto` está arriba, junto al mate (da la boina). De noche no va la trampa del mecate: el que sostiene la
tranquera queda en la punta de la manija, a más de 3 m del que pasa.

### `16-medianoche` (`?escena=nivel&nivel=medianoche`)

El nivel 16 (TU-49): La medianoche, en la Amazonía (Brasil), el último del juego. El viaje empezó en el patio de
Tegucigalpa la mañana del 31 de diciembre y termina acá, a la medianoche: la selva inundada (el igapó), nenúfares
gigantes, un río ancho y, al final, una playa con fuegos artificiales. Anda por ahí El Curupira, con los pies al revés.
Es de noche (más oscura que la noche de tuerce). Estrena el nenúfar gigante, la montaria y los fuegos artificiales. Lo
arma `scripts/niveles/medianoche.mjs` (`pnpm niveles`). Va de oeste a este, y va todo corrido 53 m hacia −x (mide
120 m: la foto de la red mide las posiciones en int16). Cada misión termina en un punto de control (`&punto=N` empieza
en la misión N + 1):

1. **Las huellas del Curupira**: la trocha se parte dos veces entre el monte (no se trepa ni se pasa de una a otra). El
   Curupira tiene los pies al revés: se fue por la trocha donde los dedos de sus huellas apuntan para acá (la de atrás
   en la primera y la de adelante en la segunda). Las otras acaban en el agua, y el que llega al final se gana una
   carcajada del Curupira, desde su tocón en el monte → punto 1.
2. **El igarapé de los nenúfares**: cinco hojas gigantes cruzan el igarapé, con medio metro de agua entre una y otra. Se
   cruza saltando de hoja en hoja, que flotan, se hunden un poco y se ladean con el que cae encima → punto 2.
3. **La montaria**, de a dos: río arriba, contra la corriente (0.5 m/s), por un canal entre los árboles. Uno se para en
   la proa y el otro en la popa, y reman alzando los brazos al mismo tiempo. Al mismo ritmo, la canoa sube derecho;
   fuera de ritmo o con uno solo, la corriente no la deja avanzar → punto 3, en la tierra firme. La montaria vacía que
   quedó lejos vuelve sola al muelle.
4. **El árbol del Curupira**, de a dos: el Curupira espera junto al hoyo de un claro talado y lo señala. El arbolito
   (un bloque de 9 kg, uno solo no lo mueve de su tocón) se lleva entre los dos, uno de cada lado, y se suelta sobre el
   hoyo: queda plantado, el Curupira se alegra y baila, y el monte cerrado se hunde → punto 4. El Curupira se va a la
   playa a ver los fuegos.
5. **Los fuegos de Año Nuevo**, de a dos: en la playa hay tres castillos, cada uno con sus dos chisperos lejos uno del
   otro (6 m el grande, 4.4 los otros). Se encienden agarrando los dos chisperos a la vez: las mechas arden hasta el
   castillo y los cohetes estallan grandes sobre el río, en rojo y turquesa, con la cámara mirando el cielo. Nadie se
   quema: la pareja los prende desde la punta de las mechas. El castillo grande trae la meta → punto 5, en la playa,
   mirando los fuegos. Solo no se puede: con un chispero agarrado la mecha chispea y nada más.

El secreto, «un delfín rosado en el recodo del río», está río arriba en el igarapé: desde la tercera hoja salen dos más
hacia el recodo, hasta una playita donde el delfín sale a respirar (la zona `secreto`; da el pañuelo «capa»). Sin color
nuevo: el delfín es lo único claro y brillante del agua. El logro, «Feliz año», es encender los tres castillos a la
medianoche: menos de un minuto entre el primero y el último. Retomando en la meta, el castillo grande se enciende otra
vez. De noche no va la trampa del mecate: los chisperos de cada castillo quedan a más de 4 m.

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
