// Genera plan-tuerce.html: requerimientos, arquitectura y todos los niveles con sus misiones.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contar, esc, mermaid, olas, olasMd, page, reqs, section, table, tickets, ticketsMd, tree } from './lib.mjs';
import { OLAS, revisarOlas } from './olas.mjs';
import { TICKETS } from './tickets-tuerce.mjs';
import { N } from './niveles-tuerce.mjs';
const here = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------ requerimientos
const RF = [
  ['Siempre de a dos', [
    ['RF-01', 'El juego es para dos jugadores. No hay historia para uno solo.', 1, 'pendiente'],
    ['RF-02', 'En el mismo lugar: dos mandos, teclado compartido, o teclado y mando.', 1, 'parcial', 'La demo 2D ya acepta dos jugadores en un teclado.'],
    ['RF-03', 'Una sola pantalla con una cámara que encuadra a los dos. Si se separan mucho, se parte en dos mitades.', 1, 'pendiente'],
    ['RF-04', 'En línea: invitar a alguien con un código de 5 letras o un enlace.', 1, 'pendiente'],
    ['RF-05', 'En línea: buscar pareja entre quienes también están buscando.', 2, 'pendiente'],
    ['RF-06', 'Si a uno se le cae la conexión, el nivel espera 60 segundos y lo deja volver al mismo punto.', 1, 'pendiente'],
    ['RF-07', 'Quien no tiene pareja en ese momento puede practicar en «El patio» con un compa bot. La historia no avanza así.', 3, 'decision'],
  ]],
  ['El muñeco', [
    ['RF-08', 'Cuerpo flojo movido por físicas: camina, corre, salta, se cae y se levanta solo.', 1, 'pendiente'],
    ['RF-09', 'Cada brazo se levanta y agarra por separado, con su propio botón.', 1, 'pendiente'],
    ['RF-10', 'Trepar, cargar, empujar, jalar y lanzar. También se puede agarrar al compañero.', 1, 'pendiente'],
    ['RF-11', 'Mojado pesa más y salta menos, hasta que se seca.', 2, 'pendiente'],
    ['RF-12', 'Está relleno de pólvora: si toca fuego, sale volando con chispas y reaparece. Da risa, no miedo.', 2, 'pendiente'],
  ]],
  ['El mundo', [
    ['RF-13', '17 niveles: el patio, 6 de Honduras y 10 de Latinoamérica.', 1, 'pendiente', 'Están todos planeados abajo.'],
    ['RF-14', 'Cada nivel tiene 5 o 6 rompecabezas. Al menos dos no se pueden resolver sin el compañero.', 1, 'pendiente'],
    ['RF-15', 'Cada rompecabezas admite más de una solución.', 1, 'pendiente'],
    ['RF-16', 'No hay derrota: al caer se reaparece en el último punto de control, cerca del compañero.', 1, 'pendiente'],
    ['RF-17', 'Un secreto y un logro por nivel.', 2, 'pendiente'],
    ['RF-18', 'Se ve como Limbo en clave clara: siluetas oscuras sobre niebla luminosa. El único color son los dos pañuelos.', 1, 'pendiente'],
    ['RF-29', 'Un solo modo de imagen, claro. No hay versión oscura.', 1, 'pendiente'],
  ]],
  ['Avance y premios', [
    ['RF-19', 'El avance es de la pareja. Cada jugador conserva lo que desbloqueó para jugar con otra persona.', 1, 'pendiente'],
    ['RF-20', 'Ropero: pañuelo, sombrero, peinado y máscara. Se ganan en los niveles.', 2, 'pendiente'],
    ['RF-21', 'Contrarreloj por nivel, con tabla de parejas.', 3, 'pendiente'],
    ['RF-22', '«Noche de tuerce»: los mismos niveles con trampas (todo resbala, gravedad baja, pólvora nerviosa).', 3, 'pendiente'],
  ]],
  ['Entenderse', [
    ['RF-23', 'Señalar un punto del nivel y hacer gestos con los brazos.', 1, 'pendiente'],
    ['RF-24', 'Frases prearmadas: «agarrá», «soltá», «esperame», «a la de tres».', 2, 'pendiente'],
    ['RF-25', 'Voz entre los dos cuando juegan en línea.', 3, 'pendiente'],
  ]],
  ['Comodidad', [
    ['RF-26', 'Mando y teclado, con botones que se pueden cambiar.', 1, 'pendiente'],
    ['RF-27', 'Agarrar con un toque en vez de mantener apretado, para quien lo prefiera.', 2, 'pendiente'],
    ['RF-28', 'Los pañuelos se distinguen por color y por forma.', 2, 'pendiente'],
  ]],
];
const RNF = [
  ['Calidad', [
    ['RNF-01', '60 cuadros por segundo, con las físicas a paso fijo de 60 por segundo.', 1, 'pendiente'],
    ['RNF-02', 'En línea se juega bien con hasta 150 ms entre los dos.', 1, 'pendiente'],
    ['RNF-03', 'Entrar a un nivel tarda menos de 10 segundos; cada nivel pesa menos de 25 MB.', 2, 'pendiente'],
    ['RNF-04', 'Funciona en Chrome, Edge, Firefox y Safari recientes, sin instalar nada.', 1, 'pendiente'],
    ['RNF-05', 'Si la conexión directa entre los dos falla, el juego pasa por un repetidor sin que se note.', 1, 'pendiente'],
  ]],
  ['Seguridad y cuidado', [
    ['RNF-06', 'El avance y los premios se escriben en el servidor, nunca desde el juego.', 1, 'pendiente'],
    ['RNF-07', 'La voz va directa entre los dos jugadores y no se guarda.', 2, 'pendiente'],
    ['RNF-08', 'Con desconocidos solo hay gestos y frases prearmadas.', 1, 'pendiente'],
  ]],
];

// ------------------------------------------------------------------ arquitectura
const CAPAS = [
  ['Juego', 'TypeScript, Three.js y Rapier (físicas 3D en WebAssembly), Vite', 'El muñeco, los niveles, la cámara y la interfaz. Corre en el navegador.'],
  ['Publicación', 'Cloudflare Workers con archivos estáticos', 'Sirve el juego. Los niveles se bajan uno por uno desde R2.'],
  ['Entre los dos jugadores', 'WebRTC (canal de datos y voz)', 'Conexión directa. Uno es el anfitrión y su computadora calcula las físicas.'],
  ['Encontrarse', 'Cloudflare Durable Object por sala', 'Presenta a los dos navegadores, guarda quién es anfitrión y hace de repetidor si la conexión directa falla.'],
  ['Atravesar redes cerradas', 'Cloudflare Realtime TURN', 'Para cuando un router no deja conectar directo.'],
  ['Datos y reglas', 'Convex', 'Cuentas, parejas, invitaciones, cola para buscar pareja, avance, ropero, logros y tablas.'],
  ['Sesión', 'Clerk', 'Entrar con Google o correo; Convex valida el token de Clerk con su integración oficial. Mismo proveedor que Mundo Catrucho.'],
  ['Imagen', 'Materiales sin luz, niebla por capas y grano', 'Limbo en clave clara: todo es silueta menos los pañuelos.'],
  ['Niveles', 'Blender a glTF, guardados en Cloudflare R2', 'Cada nivel es un archivo de escena más su guion en TypeScript.'],
  ['Escritorio', 'Tauri, más adelante', 'El mismo juego empacado para Steam, con mandos.'],
];
const RED = [
  ['Mismo lugar', 'No hay red. Un solo navegador calcula todo.', '—'],
  ['Lo que manda el invitado', 'Sus botones y palancas.', '60 por segundo'],
  ['Lo que manda el anfitrión', 'Posición y giro de cada cuerpo que se mueve, comprimidos.', '30 por segundo'],
  ['Lo que hace el invitado al recibir', 'Suaviza entre fotos y adelanta un poco su propio muñeco para que responda al instante.', 'cada cuadro'],
  ['Agarres y palancas', 'Los decide el anfitrión; el invitado los ve confirmados.', 'al ocurrir'],
  ['Punto de control', 'El anfitrión lo anota en Convex para los dos.', 'al llegar'],
];
const TABLAS = [
  ['usuarios', 'clerkId, nombre, creado', 'Se crea la primera vez que llega un token de Clerk.'],
  ['perfiles', 'usuarioId, panuelo, sombrero, peinado, mascara', 'Cómo se ve su muñeco.'],
  ['parejas', 'a, b, creada, ultimaVez', 'Dos jugadores que han jugado juntos. Es dueña del avance.'],
  ['invitaciones', 'codigo, de, vence, parejaId', 'Código de 5 letras o enlace.'],
  ['cola', 'usuarioId, region, desde', 'Quién busca pareja. Una mutación empareja a los dos primeros de la misma región.'],
  ['sesiones', 'parejaId, nivel, anfitrion, sala, estado', 'Una partida en curso; permite volver tras una caída.'],
  ['avance', 'parejaId, nivel, puntoDeControl, misiones[], secreto, mejorTiempo', 'Un documento por pareja y nivel.'],
  ['desbloqueos', 'usuarioId, cosa, nivel', 'Lo que cada jugador se lleva aunque cambie de pareja.'],
  ['logros', 'usuarioId, logroId, fecha', ''],
  ['tiempos', 'nivel, parejaId, tiempo', 'Tabla de contrarreloj.'],
  ['reportes', 'de, a, motivo, fecha', ''],
];
const PIEZAS = [
  ['Huacal, piedra, tronco', 'Se cargan, se apilan y sirven de contrapeso.'],
  ['Palanca y plancha de presión', 'Algo pasa mientras alguien la sostiene o se para encima.'],
  ['Bejuco, cuerda y cadena', 'Columpiarse, amarrar y jalar.'],
  ['Polea y contrapeso', 'Uno baja para que el otro suba.'],
  ['Balancín', 'El peso de uno levanta al otro.'],
  ['Carreta, vagoneta y dresina', 'Ruedas: se empujan, se frenan y se montan.'],
  ['Balsa, cayuco y pipante', 'Flotan y se reman entre los dos.'],
  ['Catapulta de palmera', 'Uno la dobla, el otro sale volando.'],
  ['Antorcha y candil', 'Encienden cosas; cuidado con la pólvora.'],
  ['Agua', 'Sube, baja y moja.'],
];
const MODOS = [
  ['Historia', 'Los 17 niveles en orden, con la pareja.'],
  ['El patio', 'Un espacio libre con todas las piezas para practicar y hacer tonterías.'],
  ['Contrarreloj', 'Cualquier nivel ya ganado, contra el reloj y contra otras parejas.'],
  ['Noche de tuerce', 'Los mismos niveles con una trampa al azar.'],
];

// ------------------------------------------------------------------ niveles y misiones
// [número, nombre, lugar, criatura, cómo es, piezas nuevas, misiones[], secreto, logro]  — '∞' al inicio marca la misión que exige a los dos
const misiones = N.reduce((n, l) => n + l[6].length, 0), duo = N.reduce((n, l) => n + l[6].filter(m => m.startsWith('∞')).length, 0);
const nivel = l => `<div class="nivel" id="n-${l[0]}">
  <div><span class="num">Nivel ${l[0]} · ${esc(l[2])}</span><h3>${esc(l[1])}</h3><p>${esc(l[4])}</p>
    <dl class="kv"><dt>Criatura</dt><dd>${esc(l[3])}</dd><dt>Estrena</dt><dd>${esc(l[5])}</dd><dt>Secreto</dt><dd>${esc(l[7])}</dd><dt>Logro</dt><dd>${esc(l[8])}</dd></dl></div>
  <div><ol>${l[6].map(m => m.startsWith('∞') ? `<li><span class="duo">De a dos.</span> ${esc(m.slice(2))}</li>` : `<li>${esc(m)}</li>`).join('')}</ol></div>
</div>`;

// arte conceptual (si ya se generó)
const ARTE = [['11-pinar', 'El pinar: el huacal se carga entre los dos; el Cadejo mira desde la niebla.'], ['12-copan', 'Copán: un bloque que uno solo no mueve.'], ['13-carreta', 'La calle empedrada: la carreta sin bueyes.'], ['14-personajes', 'Los dos muñecos: sombrero y pañuelo rojo, trenzas y pañuelo turquesa.']]
  .filter(([f]) => existsSync(join(here, `../arte/${f}.jpg`)));
const arte = ARTE.length ? `<div class="arte">${ARTE.map(([f, cap]) => `<figure><img alt="${esc(cap)}" src="data:image/jpeg;base64,${readFileSync(join(here, `../arte/${f}.jpg`)).toString('base64')}"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div><p class="nota">Arte conceptual generado con IA para fijar el tono. No son capturas del juego.</p>` : '';

const FASES = [
  ['0', 'Propuesta y demo 2D', 'La página de propuesta con la demo para dos.', 'Listo'],
  ['1', 'El muñeco', 'Ragdoll activo en Rapier: caminar, caer, agarrar, trepar y cargar. Dos jugadores en el mismo teclado.', '4 a 6 semanas'],
  ['2', 'El patio y El pinar', 'Los dos primeros niveles completos, jugados en el mismo lugar, para probarlos con gente.', '6 a 8 semanas'],
  ['3', 'En línea', 'Invitar con código, conexión directa, repetidor de respaldo, reconexión y avance de la pareja en Convex.', '4 a 6 semanas'],
  ['4', 'Honduras completa', 'Los niveles 2 a 6, ropero, logros y secretos.', '4 a 5 meses'],
  ['5', 'Latinoamérica', 'Los niveles 7 a 16, buscar pareja, contrarreloj y Noche de tuerce.', '6 meses o más'],
  ['6', 'Escritorio', 'Versión para Steam con mandos.', 'Después'],
];
const RIESGOS = [
  ['Las físicas en línea', 'Sincronizar dos muñecos flojos y los objetos que cargan juntos es lo más difícil del proyecto. Por eso el anfitrión calcula todo y la fase 1 empieza por el muñeco.'],
  ['Rendimiento en la web', 'Un nivel con muchas piezas físicas puede pesar en computadoras viejas. Cada nivel tiene un tope de piezas móviles y se mide desde el primero.'],
  ['Practicar sin pareja', 'El pedido es que siempre sea de a dos. El compa bot del patio queda fuera salvo que lo pidás.'],
  ['Parecerse demasiado', 'La imagen se inspira en Limbo y las físicas en Human Fall Flat, pero el muñeco, los mundos y las leyendas son propios. Conviene mantener esa distancia en arte y en nombre.'],
  ['Web o Unity', 'La web permite jugar con un enlace y usar Cloudflare y Convex de punta a punta. Si la meta principal fuera consola, Unity sería mejor camino para el juego, con el mismo servidor.'],
];

const body = [
  section('direccion', 'Limbo en clave clara, y siempre de a dos', 'Dirección', `
    <p>Tuerce es un juego cooperativo de físicas para dos. Dos muñecos de Año Viejo, rellenos de trapos, se escapan antes de la quema y cruzan Latinoamérica resolviendo rompecabezas a puro agarrón.</p>
    <div class="cols">
      <div><h3>Cómo se ve</h3><ul><li>Como Limbo: vista de lado, siluetas oscuras y nítidas.</li><li>En clave clara: niebla blanca y gris perla, luz de día. Nunca oscuro.</li><li>Casi sin color. Los únicos colores son los dos pañuelos, rojo y turquesa.</li><li>Un solo modo de imagen: claro.</li></ul></div>
      <div><h3>Cómo se juega</h3><ul><li>Siempre de a dos, en el mismo lugar o en línea.</li><li>Cuerpos flojos movidos por físicas: agarrar, cargar, trepar.</li><li>Las criaturas son leyendas de aquí; intrigan más de lo que asustan.</li><li>Sin texto ni tutorial: se aprende probando.</li></ul></div>
    </div>
    ${arte}
    <p class="nota">Estas imágenes son la referencia obligatoria: el juego debe verse así. La página de propuesta todavía muestra el estilo de colores que descartaste y se rehace con esta imagen en la fase 1.</p>`),
  section('funcionales', 'Qué tiene que hacer', 'Requerimientos funcionales', reqs(RF)),
  section('calidad', 'Qué tan bien tiene que hacerlo', 'Requerimientos de calidad', reqs(RNF)),
  section('arquitectura', 'Cómo se arma', 'Arquitectura', `
    <p>Los dos navegadores se hablan directo. Cloudflare los presenta y hace de respaldo. Convex guarda quién juega con quién y hasta dónde llegaron.</p>
    ${mermaid(`
flowchart LR
  A["Jugador A<br/>anfitrión: calcula las físicas"]
  B["Jugador B<br/>invitado"]
  S["Durable Object<br/>sala y señalización"]
  T["Cloudflare TURN"]
  C[("Convex<br/>parejas y avance")]
  R[("R2<br/>niveles")]
  A <-->|"WebRTC directo: botones y posiciones"| B
  A <-->|"presentarse"| S
  B <-->|"presentarse"| S
  A -.->|"si no hay conexión directa"| T
  B -.-> T
  A <-->|"invitar, avance"| C
  B <-->|"aceptar, ropero"| C
  R -->|"nivel"| A
  R -->|"nivel"| B`)}
    ${table(['Pieza', 'Tecnología', 'Qué hace'], CAPAS)}
    <h3>Cómo viajan las físicas</h3>
    ${table(['Qué', 'Cómo', 'Cada cuánto'], RED)}
    <h3>Invitar y empezar, paso a paso</h3>
    ${mermaid(`
sequenceDiagram
  participant A as Jugador A
  participant C as Convex
  participant S as Sala
  participant B as Jugador B
  A->>C: crearInvitacion()
  C-->>A: código de 5 letras
  B->>C: aceptarInvitacion(código)
  C-->>B: pareja, sala y pase firmado
  A->>S: entrar con pase
  B->>S: entrar con pase
  S-->>A: datos para conectar con B
  S-->>B: datos para conectar con A
  A->>B: conexión directa lista
  A->>C: punto de control alcanzado`)}`),
  section('datos', 'Qué se guarda', 'Modelo de datos en Convex', `
    ${table(['Tabla', 'Campos principales', 'Notas'], TABLAS.map(r => [{ html: `<code>${esc(r[0])}</code>` }, r[1], r[2]]))}
    <h3>Funciones</h3>
    ${table(['Tipo', 'Funciones'], [
      ['Consultas', 'miPerfil · miPareja · avanceDe(pareja) · tiempos(nivel) · estadoDeLaCola'],
      ['Mutaciones', 'alEntrar · guardarMuñeco · crearInvitacion · aceptarInvitacion · buscarPareja · dejarDeBuscar · anotarPuntoDeControl · terminarNivel'],
      ['Acciones', 'emitirPaseDeSala · credencialesTURN'],
      ['Crons', 'limpiarColaYSesiones · vencerInvitaciones'],
    ])}`),
  section('piezas', 'Con qué se arman los rompecabezas', 'Mecánicas', `
    <div class="cols"><div><h3>Lo que hace el muñeco</h3><ul><li>Caminar, correr y saltar.</li><li>Levantar cada brazo por separado y agarrar.</li><li>Trepar bordes y cuerdas.</li><li>Cargar, empujar, jalar y lanzar.</li><li>Agarrar al compañero: darle la mano, cargarlo o hacerle escalera.</li></ul></div>
    <div><h3>Las piezas del mundo</h3>${table(['Pieza', 'Para qué sirve'], PIEZAS)}</div></div>
    <h3>Modos</h3>
    ${table(['Modo', 'Qué es'], MODOS)}`),
  section('niveles', 'Los 17 niveles y sus misiones', 'Contenido', `
    <p>${misiones} misiones en total. ${duo} llevan la marca <span class="duo">De a dos</span>: no se pueden resolver sin el compañero. Las demás se pueden hacer entre los dos o cada quien por su lado.</p>
    <div class="mapa-d">${N.map(l => `<a href="#n-${l[0]}"><span>${l[0]}. ${esc(l[1])}</span><b>${l[6].length}</b></a>`).join('')}</div>
    ${N.map(nivel).join('')}`),
  section('repositorio', 'Cómo queda el proyecto', 'Repositorio', `
    ${tree(`
tuerce/
  apps/juego/        el juego: src/muneco (ragdoll), src/niveles, src/red (WebRTC), src/ui
  convex/            schema.ts, parejas.ts, invitaciones.ts, cola.ts, avance.ts, crons.ts
  workers/sala/      señalización y repetidor (Durable Object) y su wrangler.toml
  niveles/           escenas .glb y sus guiones
  prototipo/         la propuesta con la demo 2D
  docs/              arquitectura, requerimientos y este plan`)}
    <p>La carpeta ya está creada en <code>~/Work/personal/tuerce</code> y agregada a T3 Code.</p>`),
  section('olas', 'Se trabaja por olas', 'Olas', `<p>Son ${OLAS.tuerce.length} olas. Cada una junta varios tickets que se hacen al mismo tiempo y termina con algo que podés ver y jugar de a dos.</p>${olas(OLAS.tuerce, TICKETS)}`),
  section('tickets', 'El trabajo, ticket por ticket', 'Tickets', `
    <div class="aprobar"><h3>Para aprobar</h3><p>Son ${contar(TICKETS)} tickets, cada uno un issue; cada ola es un hito en GitHub. La ola 0 prepara el repo y necesita tus cuentas; desde la ola 1 todo se ve en vista previa.</p><ul><li><b>Motor:</b> web con Three.js y Rapier. Decime si preferís Unity.</li><li><b>Sin pareja:</b> el compa bot del patio queda fuera salvo que lo pidás.</li><li>Para la fase 3 hacen falta tus cuentas de <b>Convex</b> y <b>Cloudflare</b>.</li></ul></div>
    ${tickets(TICKETS)}`),
  section('fases', 'En qué orden', 'Fases', table(['Fase', 'Nombre', 'Qué se entrega', 'Tiempo estimado'], FASES) + `<p class="nota">Los tiempos son estimados para un equipo pequeño; no son un compromiso.</p>`),
  section('riesgos', 'Lo que hay que decidir', 'Riesgos y decisiones', `<div class="cols">${RIESGOS.map(([t, x]) => `<div><h3>${esc(t)}</h3><p>${esc(x)}</p></div>`).join('')}</div>`),
].join('\n');

const html = page({
  title: 'Plan Tuerce', accent: '#c2441c', accentDark: '#ff9a73', accent2: '#0a7c8c', accent2Dark: '#4fd0de',
  lead: 'Lo que el juego tiene que hacer, cómo se arma con Cloudflare y Convex, y los 17 niveles con cada una de sus misiones.',
  facts: [['2', 'jugadores, siempre'], [String(N.length), 'niveles'], [String(misiones), 'misiones'], [String(duo), 'exigen a los dos'], [String(N.length), 'secretos y logros'], [`${RF.reduce((n, g) => n + g[1].length, 0) + RNF.reduce((n, g) => n + g[1].length, 0)}`, 'requerimientos'], [String(contar(TICKETS)), 'tickets']],
  nav: [['direccion', 'Dirección'], ['funcionales', 'Requerimientos'], ['calidad', 'Calidad'], ['arquitectura', 'Arquitectura'], ['datos', 'Datos'], ['piezas', 'Mecánicas'], ['niveles', 'Niveles'], ...N.map(l => [`n-${l[0]}`, `· ${l[0]}. ${l[1]}`]), ['repositorio', 'Repositorio'], ['olas', 'Olas'], ['tickets', 'Tickets'], ['fases', 'Fases'], ['riesgos', 'Decisiones']],
  body,
});
writeFileSync(join(here, 'plan-tuerce.html'), html);
writeFileSync(join(here, 'TICKETS-tuerce.md'), ticketsMd('Tuerce', TICKETS));
writeFileSync(join(here, 'OLAS-tuerce.md'), olasMd('Tuerce', OLAS.tuerce, TICKETS));
const errOlas = revisarOlas(OLAS.tuerce, TICKETS); if (errOlas.length) { console.error(errOlas.join('\n')); process.exit(1); }
console.log('plan-tuerce.html', (html.length / 1024).toFixed(0) + ' KB', N.length, 'niveles', misiones, 'misiones', duo, 'de a dos', ARTE.length, 'imágenes');
