import { N } from './niveles-tuerce.mjs';
const NIVELES_LATAM = N.filter(l => +l[0] >= 7).map((l, i) => [`TU-${40 + i}`, `Nivel ${l[0]} · ${l[1]}`, `${l[2]}: ${l[6].length} misiones, ${l[3]}; secreto y logro incluidos.`, 'G', i < 5 ? 'TU-24, TU-25, TU-26, TU-27, TU-28' : 'TU-40, TU-41, TU-42, TU-43, TU-44']);
// Tickets de Tuerce. [id, título, listo cuando, tamaño (C/M/G), depende de]
export const TICKETS = [
  ['Preparación · Repo y herramientas', 'Antes de programar: estructura, revisión automática, guía para agentes, capturas y entornos.', [
    ['TU-50', 'Estructura y comandos', 'Un `pnpm install` en la raíz instala todo; `pnpm dev`, `pnpm test`, `pnpm build` y `pnpm check` funcionan para todo el proyecto.', 'C', ''],
    ['TU-51', 'Reglas de código', 'TypeScript estricto y Biome para lint y formato; `pnpm check` pasa limpio y corre en cada pull request.', 'C', ''],
    ['TU-52', 'Guía para los agentes', '`CLAUDE.md` y `AGENTS.md` explican el proyecto, cómo probar y qué no tocar; una skill `ola` reparte una ola en paralelo, junta la rama `ola-N` y entrega vista previa, capturas y el pull request.', 'M', ''],
    ['TU-53', 'Capturas y video automáticos', '`pnpm capturas` abre el juego en Chromium sin ventana, recorre las escenas clave y guarda imágenes y un video corto; el pull request de cada ola los muestra.', 'M', ''],
    ['TU-54', 'Plantillas y protección de main', 'Plantilla de pull request (qué cambió, cómo se probó, capturas) y de issue; `main` solo acepta cambios por pull request con la revisión automática en verde.', 'C', ''],
    ['TU-55', 'Entornos y secretos', 'Desarrollo, vista previa y producción separados en Convex, Clerk y Cloudflare; las llaves viven en los secretos de GitHub y Cloudflare, nunca en el código.', 'C', 'tus cuentas'],
  ]],
  ['Fase 1 · El muñeco', 'Lo más difícil va primero. No necesita cuentas.', [
    ['TU-01', 'Primer commit y revisión automática', 'Cada cambio compila y corre las pruebas solo.', 'C', ''],
    ['TU-02', 'Base del juego', 'Three.js y Rapier corriendo con físicas a paso fijo de 60 por segundo.', 'C', ''],
    ['TU-03', 'El muñeco se para y camina', 'Ragdoll activo que se mantiene en pie, camina y gira sin caerse solo.', 'G', 'TU-02'],
    ['TU-04', 'Saltar, caer y levantarse', 'Se cae de forma graciosa y se levanta sin ayuda.', 'M', 'TU-03'],
    ['TU-05', 'Brazos por separado y agarre', 'Cada brazo sube con su botón y lo que agarra queda agarrado.', 'G', 'TU-03'],
    ['TU-06', 'Trepar', 'Con los brazos arriba se cuelga de un borde y sube.', 'M', 'TU-05'],
    ['TU-07', 'Cargar, empujar, lanzar y agarrar al compañero', 'Dos muñecos cargan una caja y uno le da la mano al otro.', 'M', 'TU-05'],
    ['TU-08', 'Dos jugadores en el mismo lugar', 'Teclado compartido, dos mandos o teclado y mando.', 'M', 'TU-03'],
    ['TU-09', 'Cámara de los dos', 'Encuadra a ambos y parte la pantalla si se separan.', 'M', 'TU-08'],
    ['TU-10', 'La imagen: igual a las imágenes de referencia', 'Una escena de prueba se ve como `docs/arte/11-pinar` a `14-personajes`: siluetas oscuras con textura de tela, niebla blanca por capas, luz de día, grano fino; los pañuelos rojo y turquesa son el único color. Solo modo claro.', 'G', 'TU-02'],
    ['TU-36', 'Rehacer la página de propuesta con la imagen nueva', 'La propuesta publicada y su demo para dos se ven como las imágenes de referencia.', 'M', 'TU-10'],
  ]],
  ['Fase 2 · El patio y El pinar', 'Dos niveles completos para probar con parejas de verdad.', [
    ['TU-11', 'Formato de nivel', 'Escena en glTF más guion; puntos de control y reaparición junto al compañero.', 'M', 'TU-07'],
    ['TU-12', 'Primeras piezas', 'Huacal, palanca, plancha de presión, balancín y bejuco funcionan con físicas.', 'G', 'TU-11'],
    ['TU-13', 'Nivel 0 · El patio', 'Sus 5 misiones se pueden terminar de a dos.', 'G', 'TU-12'],
    ['TU-14', 'Nivel 1 · El pinar', 'Sus 6 misiones y el Cadejo; secreto y logro incluidos.', 'G', 'TU-12'],
    ['TU-15', 'Menú, pausa, señalar y gestos', 'Se entra, se pausa y los dos se entienden sin hablar.', 'M', 'TU-08'],
    ['TU-16', 'Prueba con cinco parejas', 'Cinco parejas juegan los dos niveles; lo que traba queda corregido.', 'M', 'TU-13, TU-14'],
  ]],
  ['Fase 3 · En línea', 'Necesita tus cuentas de Convex y Cloudflare.', [
    ['TU-17', 'Convex y cuentas con Clerk', 'El esquema está arriba y se entra con Google o correo por Clerk; Convex reconoce al usuario.', 'M', 'tus cuentas'],
    ['TU-18', 'Parejas e invitación con código', 'Un código de 5 letras o un enlace junta a dos personas.', 'M', 'TU-17'],
    ['TU-19', 'Pase firmado y TURN', 'La sala solo acepta a la pareja; hay respaldo para redes cerradas.', 'M', 'TU-17'],
    ['TU-20', 'Conexión directa con repetidor de respaldo', 'Los dos navegadores se conectan; si no pueden, pasan por la sala sin notarlo.', 'G', 'TU-19'],
    ['TU-21', 'Físicas sincronizadas', 'El invitado ve y siente lo mismo que el anfitrión con hasta 150 ms.', 'G', 'TU-20'],
    ['TU-22', 'Reconexión y avance de la pareja', 'Si uno se cae, vuelve al mismo punto; el avance se guarda en Convex.', 'M', 'TU-21'],
    ['TU-23', 'Publicar en Cloudflare', 'El juego abre con un enlace.', 'C', 'tus cuentas'],
  ]],
  ['Fase 4 · Honduras completa', 'Un ticket por nivel.', [
    ['TU-24', 'Nivel 2 · La poza', 'Agua, balsa y compuerta; 6 misiones.', 'G', 'TU-14'],
    ['TU-25', 'Nivel 3 · La calle empedrada', 'Carreta, engranajes y campanas; 6 misiones.', 'G', 'TU-14'],
    ['TU-26', 'Nivel 4 · Xibalbá', 'Bloques, planchas dobles, antorcha y pelota; 6 misiones.', 'G', 'TU-14'],
    ['TU-27', 'Nivel 5 · El tren bananero', 'Vagones, dresina, cambio de vía y grúa; 6 misiones.', 'G', 'TU-14'],
    ['TU-28', 'Nivel 6 · Río Plátano', 'Pipante, puente colgante y catapulta; 6 misiones.', 'G', 'TU-14'],
    ['TU-29', 'Ropero, secretos y logros', 'Lo ganado en cada nivel se ve en el muñeco y se guarda por jugador.', 'M', 'TU-22'],
  ]],
  ['Fase 5 · Latinoamérica', '', [
    ...NIVELES_LATAM,
    ['TU-31', 'Buscar pareja', 'Quien no tiene con quién jugar encuentra a otra persona de su región.', 'M', 'TU-18'],
    ['TU-32', 'Contrarreloj', 'Tabla de parejas por nivel.', 'M', 'TU-22'],
    ['TU-33', 'Noche de tuerce', 'Los mismos niveles con una trampa al azar.', 'M', ''],
    ['TU-34', 'Voz entre los dos', 'Opcional, directa entre la pareja y sin guardarse.', 'M', 'TU-20'],
  ]],
  ['Fase 6 · Escritorio', '', [
    ['TU-35', 'Versión de escritorio', 'El mismo juego empacado para Steam, con mandos.', 'G', ''],
  ]],
];
