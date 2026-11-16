# Tickets · Tuerce

Tamaños: C = hasta 1 día · M = 2 a 4 días · G = 1 a 2 semanas.

## Preparación · Repo y herramientas

Antes de programar: estructura, revisión automática, guía para agentes, capturas y entornos.

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-50 | Estructura y comandos | Un `pnpm install` en la raíz instala todo; `pnpm dev`, `pnpm test`, `pnpm build` y `pnpm check` funcionan para todo el proyecto. | C | — |
| TU-51 | Reglas de código | TypeScript estricto y Biome para lint y formato; `pnpm check` pasa limpio y corre en cada pull request. | C | — |
| TU-52 | Guía para los agentes | `CLAUDE.md` y `AGENTS.md` explican el proyecto, cómo probar y qué no tocar; una skill `ola` reparte una ola en paralelo, junta la rama `ola-N` y entrega vista previa, capturas y el pull request. | M | — |
| TU-53 | Capturas y video automáticos | `pnpm capturas` abre el juego en Chromium sin ventana, recorre las escenas clave y guarda imágenes y un video corto; el pull request de cada ola los muestra. | M | — |
| TU-54 | Plantillas y protección de main | Plantilla de pull request (qué cambió, cómo se probó, capturas) y de issue; `main` solo acepta cambios por pull request con la revisión automática en verde. | C | — |
| TU-55 | Entornos y secretos | Desarrollo, vista previa y producción separados en Convex, Clerk y Cloudflare; las llaves viven en los secretos de GitHub y Cloudflare, nunca en el código. | C | tus cuentas |

## Fase 1 · El muñeco

Lo más difícil va primero. No necesita cuentas.

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-01 | Primer commit y revisión automática | Cada cambio compila y corre las pruebas solo. | C | — |
| TU-02 | Base del juego | Three.js y Rapier corriendo con físicas a paso fijo de 60 por segundo. | C | — |
| TU-03 | El muñeco se para y camina | Ragdoll activo que se mantiene en pie, camina y gira sin caerse solo. | G | TU-02 |
| TU-04 | Saltar, caer y levantarse | Se cae de forma graciosa y se levanta sin ayuda. | M | TU-03 |
| TU-05 | Brazos por separado y agarre | Cada brazo sube con su botón y lo que agarra queda agarrado. | G | TU-03 |
| TU-06 | Trepar | Con los brazos arriba se cuelga de un borde y sube. | M | TU-05 |
| TU-07 | Cargar, empujar, lanzar y agarrar al compañero | Dos muñecos cargan una caja y uno le da la mano al otro. | M | TU-05 |
| TU-08 | Dos jugadores en el mismo lugar | Teclado compartido, dos mandos o teclado y mando. | M | TU-03 |
| TU-09 | Cámara de los dos | Encuadra a ambos y parte la pantalla si se separan. | M | TU-08 |
| TU-10 | La imagen: igual a las imágenes de referencia | Una escena de prueba se ve como `docs/arte/11-pinar` a `14-personajes`: siluetas oscuras con textura de tela, niebla blanca por capas, luz de día, grano fino; los pañuelos rojo y turquesa son el único color. Solo modo claro. | G | TU-02 |
| TU-36 | Rehacer la página de propuesta con la imagen nueva | La propuesta publicada y su demo para dos se ven como las imágenes de referencia. | M | TU-10 |

## Fase 2 · El patio y El pinar

Dos niveles completos para probar con parejas de verdad.

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-11 | Formato de nivel | Escena en glTF más guion; puntos de control y reaparición junto al compañero. | M | TU-07 |
| TU-12 | Primeras piezas | Huacal, palanca, plancha de presión, balancín y bejuco funcionan con físicas. | G | TU-11 |
| TU-13 | Nivel 0 · El patio | Sus 5 misiones se pueden terminar de a dos. | G | TU-12 |
| TU-14 | Nivel 1 · El pinar | Sus 6 misiones y el Cadejo; secreto y logro incluidos. | G | TU-12 |
| TU-15 | Menú, pausa, señalar y gestos | Se entra, se pausa y los dos se entienden sin hablar. | M | TU-08 |
| TU-16 | Prueba con cinco parejas | Cinco parejas juegan los dos niveles; lo que traba queda corregido. | M | TU-13, TU-14 |

## Fase 3 · En línea

Necesita tus cuentas de Convex y Cloudflare.

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-17 | Convex y cuentas con Clerk | El esquema está arriba y se entra con Google o correo por Clerk; Convex reconoce al usuario. | M | tus cuentas |
| TU-18 | Parejas e invitación con código | Un código de 5 letras o un enlace junta a dos personas. | M | TU-17 |
| TU-19 | Pase firmado y TURN | La sala solo acepta a la pareja; hay respaldo para redes cerradas. | M | TU-17 |
| TU-20 | Conexión directa con repetidor de respaldo | Los dos navegadores se conectan; si no pueden, pasan por la sala sin notarlo. | G | TU-19 |
| TU-21 | Físicas sincronizadas | El invitado ve y siente lo mismo que el anfitrión con hasta 150 ms. | G | TU-20 |
| TU-22 | Reconexión y avance de la pareja | Si uno se cae, vuelve al mismo punto; el avance se guarda en Convex. | M | TU-21 |
| TU-23 | Publicar en Cloudflare | El juego abre con un enlace. | C | tus cuentas |

## Fase 4 · Honduras completa

Un ticket por nivel.

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-24 | Nivel 2 · La poza | Agua, balsa y compuerta; 6 misiones. | G | TU-14 |
| TU-25 | Nivel 3 · La calle empedrada | Carreta, engranajes y campanas; 6 misiones. | G | TU-14 |
| TU-26 | Nivel 4 · Xibalbá | Bloques, planchas dobles, antorcha y pelota; 6 misiones. | G | TU-14 |
| TU-27 | Nivel 5 · El tren bananero | Vagones, dresina, cambio de vía y grúa; 6 misiones. | G | TU-14 |
| TU-28 | Nivel 6 · Río Plátano | Pipante, puente colgante y catapulta; 6 misiones. | G | TU-14 |
| TU-29 | Ropero, secretos y logros | Lo ganado en cada nivel se ve en el muñeco y se guarda por jugador. | M | TU-22 |

## Fase 5 · Latinoamérica

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-40 | Nivel 7 · Las trenzas | Antigua, Guatemala: 5 misiones, El Sombrerón, que le hace trenzas a todo; secreto y logro incluidos. | G | TU-24, TU-25, TU-26, TU-27, TU-28 |
| TU-41 | Nivel 8 · El cafetal | Izalco, El Salvador: 5 misiones, El Cipitío, un cipote barrigón que tira piedritas y se ríe; secreto y logro incluidos. | G | TU-24, TU-25, TU-26, TU-27, TU-28 |
| TU-42 | Nivel 9 · Los canales | Xochimilco, México: 5 misiones, La Llorona, que llora tanto que sube el agua; secreto y logro incluidos. | G | TU-24, TU-25, TU-26, TU-27, TU-28 |
| TU-43 | Nivel 10 · La garrucha | Eje cafetero, Colombia: 5 misiones, La Patasola, que anda brincando en una sola pata; secreto y logro incluidos. | G | TU-24, TU-25, TU-26, TU-27, TU-28 |
| TU-44 | Nivel 11 · El llano | Los Llanos, Venezuela: 5 misiones, El Silbón, un flaco altísimo que silba al revés: si suena cerca, está lejos; secreto y logro incluidos. | G | TU-24, TU-25, TU-26, TU-27, TU-28 |
| TU-45 | Nivel 12 · El puente de paja | Q’eswachaka, Perú: 5 misiones, Las llamas, que escupen si las apurás; secreto y logro incluidos. | G | TU-40, TU-41, TU-42, TU-43, TU-44 |
| TU-46 | Nivel 13 · La mina | Potosí, Bolivia: 5 misiones, El Tío de la mina, un diablito que quiere su ofrenda; secreto y logro incluidos. | G | TU-40, TU-41, TU-42, TU-43, TU-44 |
| TU-47 | Nivel 14 · La minga | Chiloé, Chile: 5 misiones, El Caleuche, un barco fantasma que en realidad anda de fiesta; secreto y logro incluidos. | G | TU-40, TU-41, TU-42, TU-43, TU-44 |
| TU-48 | Nivel 15 · La pampa | La Pampa, Argentina: 5 misiones, La Luz Mala, una luciérnaga gigante y despistada; secreto y logro incluidos. | G | TU-40, TU-41, TU-42, TU-43, TU-44 |
| TU-49 | Nivel 16 · La medianoche | Amazonía, Brasil: 5 misiones, El Curupira, guardián del bosque con los pies al revés; secreto y logro incluidos. | G | TU-40, TU-41, TU-42, TU-43, TU-44 |
| TU-31 | Buscar pareja | Quien no tiene con quién jugar encuentra a otra persona de su región. | M | TU-18 |
| TU-32 | Contrarreloj | Tabla de parejas por nivel. | M | TU-22 |
| TU-33 | Noche de tuerce | Los mismos niveles con una trampa al azar. | M | — |
| TU-34 | Voz entre los dos | Opcional, directa entre la pareja y sin guardarse. | M | TU-20 |

## Fase 6 · Escritorio

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-35 | Versión de escritorio | El mismo juego empacado para Steam, con mandos. | G | — |

## Fase 7 · La historia completa

| Id | Ticket | Listo cuando | Tamaño | Depende de |
|---|---|---|---|---|
| TU-56 | Menú de la historia y de los niveles | Desde el menú de inicio se juega la historia (empieza en El patio o sigue en el próximo nivel sin ganar) o se elige cualquiera de los 17 niveles; noche y contrarreloj abren niveles de verdad. | M | — |
| TU-57 | Meta, siguiente nivel y el final | Al llegar a la meta, «Nivel ganado» con «Siguiente nivel» y «Menú», aquí y en línea (los dos pasan juntos); después de La medianoche, el final de Año Nuevo con créditos. | M | — |
| TU-58 | En línea: elegir nivel y volver a empezar | Después de juntarse la pareja elige el nivel o sigue la historia; un nivel ganado se vuelve a jugar desde la salida; «Volver al menú» en la cuenta; tablas solo con los 17 niveles. | M | — |
