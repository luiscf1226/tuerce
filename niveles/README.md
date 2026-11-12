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

| `tipo`    | Qué es                                                                                                                                                        | Propiedades                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solido`  | Algo que choca: suelo, paredes, troncos, cajas. Una malla.                                                                                                    | `forma`: `caja` (la caja de la malla, la más barata), `cilindro` (de pie, sobre su eje Y) o `malla` (los triángulos tal cual) · `cuerpo`: `fijo`, `cinematico` (lo mueve el guion) o `dinamico` (se empuja y se agarra) · `masa` en kilos (dinámicos, 10) · `rozamiento` (0.8) · `material`: `suelo`, `tela`, `corteza`, `honda` (casi negro) o `lejana` · `invisible`: 1 para que choque sin verse |
| `salida`  | Dónde arranca cada jugador (los pies). Un vacío (Empty); mira hacia su −Y de Blender (ver abajo).                                                             | `jugador`: 1 (el rojo) o 2 (el turquesa). Tiene que haber una de cada una.                                                                                                                                                                                                                                                                                                                          |
| `control` | Un punto de control: la zona que hay que cruzar. Un vacío cubo (Empty › Cube), escalado al tamaño de la zona.                                                 | `orden`: 1, 2, 3… sin saltearse ninguno. La pareja reaparece sobre la **base** de la zona, que tiene que apoyar en el suelo, lado a lado y mirando hacia donde mira la zona.                                                                                                                                                                                                                        |
| `vacio`   | Una zona que cuenta como caída aunque esté más arriba que `vacio` (el fondo de un pozo, un río).                                                              | Un vacío cubo escalado, o una malla (cuenta su caja).                                                                                                                                                                                                                                                                                                                                               |
| `adorno`  | Una forma del juego armada en ese lugar (no choca).                                                                                                           | `forma`: `pino`, `abeto`, `roca`, `mata` o `tronco` (acostado sobre su X) · `alto` (el largo, para el tronco) · `radio` · `semilla` (cambia las ramas y abolladuras)                                                                                                                                                                                                                                |
| `niebla`  | Un jirón de niebla que se corre despacio. Un vacío cubo: su escala X e Y es la mitad del ancho y del alto.                                                    | `opacidad` (0.5) · `velocidad` (0.15; negativa va para el otro lado)                                                                                                                                                                                                                                                                                                                                |
| `secreto` | Dónde está escondido el secreto del nivel: el primero de los dos que entra lo encuentra para la pareja. Un vacío cubo escalado, o una malla (cuenta su caja). | Ninguna. Si el secreto es otra cosa (tocar una campana, abrir un cofre), no hace falta la zona: lo dice el guion.                                                                                                                                                                                                                                                                                   |
| `pieza`   | Una pieza de juego: huacal, palanca, plancha, balancín, bejuco y las del pinar (ver abajo). Una malla: su caja dice dónde va.                                 | `pieza`: `huacal`, `palanca`, `plancha`, `balancin`, `bejuco`, `tronco`, `tranca`, `hueso`, `lampara` o `cadejo`, y las propiedades de cada una                                                                                                                                                                                                                                                     |

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

| Mecanismo  | Con qué sólidos                                                                       | Qué hace                                                                                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `porton`   | Una hoja `dinamico` derecha y una `palanca` (la aldaba)                               | Le pone a la hoja una bisagra vertical donde se le diga. Cerrada y sin nadie en la aldaba, no gira; abierta del todo una vez, ya no se traba. `abrir()` la deja abierta (al retomar).                                                                                     |
| `escalera` | Un sólido `dinamico` de caja, largo a lo largo de su x                                | Cargada por los dos (cada uno la agarra), se mantiene derecha; al llegar al pie de la pared apuntando hacia ella, se apoya sola como rampa hasta arriba (queda trabada). Dice si se `botó` (tocó el suelo con una punta) y, tirada sin nadie, vuelve sola a donde empezó. |
| `lamina`   | Un sólido fijo (un techo)                                                             | El que está parado encima (y no agarra nada) se resbala hacia `bajada`: caminando se sube más despacio; quieto, se va para abajo.                                                                                                                                         |
| `camion`   | Un sólido `cinematico` (mejor `forma: malla`, para que choque con su forma de verdad) | Al `arrancar()` maniobra de atrás para adelante a lo largo de un eje; `frenar()` lo para. Puede llevar encima un punto de control: su zona y sus lugares viajan con él.                                                                                                   |

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

## Los niveles sin Blender: `00-patio`, `01-pinar`, `03-calle`, `99-prueba` y `98-piezas`

Sin Blender a mano, sus `escena.glb` se arman con `pnpm niveles` (`scripts/niveles/patio.mjs`, `pinar.mjs`, `calle.mjs`,
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
