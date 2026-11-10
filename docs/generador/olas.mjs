// Olas de trabajo, numeradas desde 0 (la ola 0 prepara el repo). Una ola = varios tickets que se hacen en paralelo, se juntan en una rama `ola-N`,
// se entregan con vista previa y capturas, y se aprueban de una sola vez.
// Cada ola: [nombre, lo que vas a ver al final, ¿necesita tus cuentas?, [ids]]
export const OLAS = {
  catrucho: [
    ['Preparar el repo y las herramientas', 'Un pull request de prueba con la revisión automática en verde, su vista previa en tu Cloudflare y capturas del juego tomadas solas; Convex creado.', true, ['MC-60', 'MC-61', 'MC-62', 'MC-63', 'MC-64', 'MC-65', 'MC-01', 'MC-06', 'MC-11']],
    ['Pulido que se ve', 'El mapa con zoom hasta verlo todo desde arriba, atardecer y noche, mando y clubes con apodos.', false, ['MC-02', 'MC-03', 'MC-05', 'MC-57', 'MC-59']],
    ['Cuentas y kit de motores', 'Entrar con Clerk, el catálogo en Convex y el primer motor nuevo hecho con el kit.', false, ['MC-07', 'MC-10', 'MC-32', 'MC-34', 'MC-55']],
    ['Tres departamentos', 'Francisco Morazán, Olancho y Cortés con sus juegos exclusivos; jugar sin cuenta y el personaje en la nube.', false, ['MC-36', 'MC-50', 'MC-39', 'MC-08', 'MC-09', 'MC-18']],
    ['Viajes reales', 'Un video del viaje en rapidito, bus, ferry y avioneta con sus paradas y eventos.', false, ['MC-27', 'MC-28', 'MC-29', 'MC-30']],
    ['Verse en el mapa', 'Dos navegadores viéndose caminar en el mapa, amigos por código; Copán e Islas de la Bahía.', false, ['MC-12', 'MC-19', 'MC-24', 'MC-33', 'MC-45', 'MC-42']],
    ['Hablar y jugar en serio', 'Chat moderado, emotes, salas por departamento, premios que valida el servidor; Atlántida y Comayagua.', false, ['MC-13', 'MC-14', 'MC-20', 'MC-21', 'MC-22', 'MC-40', 'MC-37']],
    ['Partidas juntos', 'Una partida entre dos personas, clasificación real, misiones del día y un viaje compartido.', false, ['MC-15', 'MC-16', 'MC-17', 'MC-23', 'MC-25', 'MC-31']],
    ['Dúo y mundo abierto', 'Los modos dúo y mundo abierto, la exploración turística en celular; Intibucá y Lempira.', false, ['MC-26', 'MC-35', 'MC-54', 'MC-56', 'MC-04', 'MC-49', 'MC-46']],
    ['Cinco departamentos más', 'La Paz, Colón, Gracias a Dios, Ocotepeque y Choluteca con sus juegos.', false, ['MC-38', 'MC-41', 'MC-44', 'MC-47', 'MC-52']],
    ['Honduras completa', 'Yoro, Santa Bárbara, El Paraíso y Valle, más las animaciones exageradas: los 18 departamentos.', false, ['MC-43', 'MC-48', 'MC-51', 'MC-53', 'MC-58']],
  ],
  tuerce: [
    ['Preparar el repo y las herramientas', 'Un pull request de prueba con la revisión automática en verde, su vista previa en tu Cloudflare, capturas tomadas solas y la entrada con Clerk.', true, ['TU-50', 'TU-51', 'TU-52', 'TU-53', 'TU-54', 'TU-55', 'TU-01', 'TU-02', 'TU-17', 'TU-23']],
    ['El muñeco y la imagen', 'El muñeco caminando en el pinar, igual a las imágenes de referencia.', false, ['TU-03', 'TU-10', 'TU-18', 'TU-19']],
    ['De a dos', 'Dos muñecos en la misma pantalla saltando y agarrando; la propuesta rehecha con la imagen nueva.', false, ['TU-04', 'TU-05', 'TU-08', 'TU-36', 'TU-20', 'TU-31']],
    ['Manos y red', 'Trepar, cargar y lanzar al compañero; jugar en línea con las físicas sincronizadas y voz.', false, ['TU-06', 'TU-07', 'TU-09', 'TU-15', 'TU-21', 'TU-34']],
    ['Formato de nivel', 'Un nivel de prueba armado con el formato nuevo; reconexión; versión de escritorio.', false, ['TU-11', 'TU-22', 'TU-35']],
    ['Las piezas', 'Las piezas de rompecabezas, ropero, secretos y contrarreloj.', false, ['TU-12', 'TU-29', 'TU-32']],
    ['Primeros niveles', 'El patio y el pinar jugables de principio a fin; la noche de tuerce.', false, ['TU-13', 'TU-14', 'TU-33']],
    ['Honduras', 'La poza, la calle empedrada, Xibalbá, el tren bananero y Río Plátano; prueba con cinco parejas.', false, ['TU-16', 'TU-24', 'TU-25', 'TU-26', 'TU-27', 'TU-28']],
    ['Latinoamérica I', 'Niveles 7 a 11.', false, ['TU-40', 'TU-41', 'TU-42', 'TU-43', 'TU-44']],
    ['Latinoamérica II', 'Niveles 12 a 16 y el final.', false, ['TU-45', 'TU-46', 'TU-47', 'TU-48', 'TU-49']],
  ],
};

/** Revisa que cada ticket esté en una sola ola y que dependa solo de olas anteriores. */
export function revisarOlas(olas, fases) {
  const tickets = fases.flatMap(f => f[2]), ola = {}, errores = [];
  olas.forEach(([, , , ids], i) => ids.forEach(id => { if (ola[id] != null) errores.push(`${id} está en dos olas`); ola[id] = i; }));
  for (const t of tickets) {
    if (ola[t[0]] == null) { errores.push(`${t[0]} no está en ninguna ola`); continue; }
    for (const d of (t[4] || '').split(/,\s*/).filter(d => /^[A-Z]{2}-\d+$/.test(d)))
      if (!(ola[d] < ola[t[0]])) errores.push(`${t[0]} (ola ${ola[t[0]]}) depende de ${d} (ola ${ola[d] ?? '?'})`);
  }
  for (const id of Object.keys(ola)) if (!tickets.some(t => t[0] === id)) errores.push(`${id} no existe`);
  return errores;
}
