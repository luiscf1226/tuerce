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
