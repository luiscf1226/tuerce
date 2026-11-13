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

## Los niveles sin Blender: del `00-patio` al `06-rio`, `98-piezas` y `99-prueba`

Sin Blender a mano, sus `escena.glb` se arman con `pnpm niveles` (`scripts/niveles/patio.mjs`, `pinar.mjs`, `poza.mjs`,
`calle.mjs`, `xibalba.mjs`, `tren.mjs`, `rio.mjs`, `prueba.mjs` y `piezas.mjs`, con el exportador de three y las mismas propiedades que pondría Blender; lo común está en
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
