// Crea en GitHub un hito por ola y un issue por ticket (la fase va como etiqueta). Se puede correr varias veces:
// no repite issues; a los que ya existen les actualiza ola, etiquetas y texto, y borra los hitos viejos que quedan vacíos.
// Uso: node issues.mjs <dueño/repo> <catrucho|tuerce> [--seco]
import { execFileSync } from 'node:child_process';
const [repo, cual, seco] = [process.argv[2], process.argv[3], process.argv.includes('--seco')];
if (!repo || !['catrucho', 'tuerce'].includes(cual)) { console.error('uso: node issues.mjs <dueño/repo> <catrucho|tuerce> [--seco]'); process.exit(2); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gh = (args, input) => JSON.parse(execFileSync('gh', ['api', ...args], { input: input && JSON.stringify(input), encoding: 'utf8', maxBuffer: 64 << 20 }) || 'null');
const ghTodo = ruta => gh(['--paginate', '--slurp', ruta]).flat();

const T = cual === 'catrucho' ? await import('./tickets-catrucho.mjs') : await import('./tickets-tuerce.mjs');
const { OLAS, revisarOlas } = await import('./olas.mjs');
const N = cual === 'tuerce' ? (await import('./niveles-tuerce.mjs')).N : [];
const PLAN = cual === 'catrucho' ? 'https://claude.ai/artifact/LEve6F6zgDJTY4ChFj3W8E' : 'https://claude.ai/artifact/QVzT8avdwoipVvDm2Leg1z';
const TAM = { C: ['chico', 'hasta 1 día', 'c2e0c6'], M: ['mediano', '2 a 4 días', 'fbca04'], G: ['grande', '1 a 2 semanas', 'd93f0b'] };

// ------------------------------------------------------------------ cuerpo de cada issue
function extra(t) {
  const meta = t[5];
  if (meta?.dept) {
    const x = T.CONTENIDO[meta.dept], motor = Object.fromEntries(x.motores.map(m => [m.id, m.nombre]));
    return [`> ${x.esencia}`, '',
      '### Motores que solo existen aquí', ...x.motores.map(m => `- [ ] **${m.nombre}**${m.reutiliza ? ` _(reutiliza «${m.reutiliza}»)_` : ' _(nuevo)_'}: ${m.mecanica}`), '',
      '### Juegos', ...x.juegos.map(j => `- [ ] ${j.icono} **${j.nombre}** · ${j.tipo} · ${j.etapas} etapas · motor «${motor[j.motor] ?? j.motor}»: ${j.deQueVa}${j.guino ? ` _Guiño: ${j.guino}_` : ''}`), '',
      '### Para explorar', ...x.turismo.map(l => `- [ ] **${l.nombre}** (${l.tipo}): ${l.queHaces} ${l.dato}${l.fuente ? ` [fuente](${l.fuente})` : ''}`), '',
      '### Locuras', ...x.locuras.map(l => `- [ ] **${l.nombre}**: ${l.queEs} En el juego: ${l.comoAparece}${l.fuente ? ` [fuente](${l.fuente})` : ''}`), '',
      '### Antes de cerrar', '- [ ] Cada motor tiene su prueba automática y se juega de principio a fin', '- [ ] Revisión cultural hecha por alguien del departamento', '- [ ] Ningún motor ni juego existe en otro departamento (`node docs/generador/validar-contenido.mjs`)'].join('\n');
  }
  const nivel = cual === 'tuerce' && t[1].match(/^Nivel (\d+) · /) && N.find(l => l[0] === t[1].match(/^Nivel (\d+)/)[1]);
  if (nivel) return [`> ${nivel[4]}`, '', `**Lugar:** ${nivel[2]} · **Criatura:** ${nivel[3]} · **Estrena:** ${nivel[5]}`, '', '### Misiones',
    ...nivel[6].map(m => (m.startsWith('∞') ? `- [ ] **De a dos:** ${m.slice(2)}` : `- [ ] ${m}`)), '', `- [ ] Secreto: ${nivel[7]}`, `- [ ] Logro: ${nivel[8]}`, '',
    '### Antes de cerrar', '- [ ] Se ve como las imágenes de referencia (`docs/arte/11-*` a `14-*`)', '- [ ] Probado por una pareja en el mismo lugar y otra en línea'].join('\n');
  return '';
}
const cuerpo = (t, fase, num) => [
  `**Listo cuando:** ${t[2].replace(/`([^`]+)`/g, '`$1`')}`, '',
  `**Ola:** ${olaDe[t[0]] ?? '—'} · **Tamaño:** ${TAM[t[3]][0]} (${TAM[t[3]][1]}) · **Fase:** ${fase}`,
  `**Depende de:** ${t[4] ? t[4].split(/,\s*/).map(d => (num[d] ? `#${num[d]} (${d})` : d)).join(', ') : '—'}`, '',
  extra(t), '', `---`, `Plan completo: ${PLAN} · también en \`docs/plan.html\``,
].join('\n');

// ------------------------------------------------------------------ crear
const fases = T.TICKETS, total = fases.reduce((n, f) => n + f[2].length, 0), olas = OLAS[cual];
const errores = revisarOlas(olas, fases); if (errores.length) { console.error(errores.join('\n')); process.exit(1); }
const tituloOla = (o, i) => `Ola ${i} · ${o[0]}`;
const olaDe = Object.fromEntries(olas.flatMap((o, i) => o[3].map(id => [id, tituloOla(o, i)])));
const faseNum = f => f.match(/^Fase (\d+)/)?.[1] ?? f.split(' · ')[0].toLowerCase();
console.log(`${repo}: ${olas.length} olas, ${total} issues${seco ? ' (en seco)' : ''}`);
if (seco) { const f = fases.find(x => x[2].some(t => t[5]?.dept || /^Nivel /.test(t[1]))) ?? fases[0]; const t = f[2].find(x => x[5]?.dept || /^Nivel /.test(x[1])) ?? f[2][0]; console.log(`\n# ${t[0]} · ${t[1]}\n${cuerpo(t, f[0], {})}`); process.exit(0); }

const etiquetas = new Set(ghTodo(`repos/${repo}/labels?per_page=100`).map(l => l.name));
const etiqueta = (name, color, description) => { if (!etiquetas.has(name)) { gh(['-X', 'POST', `repos/${repo}/labels`, '--input', '-'], { name, color, ...(description && { description }) }); etiquetas.add(name); } };
for (const [k, [nombre, , color]] of Object.entries(TAM)) etiqueta(`tamaño: ${nombre}`, color, TAM[k][1]);
for (const [n, c] of [['departamento', '0e8a16'], ['nivel', '5319e7'], ['necesita tus cuentas', 'b60205']]) etiqueta(n, c);
for (const f of fases) etiqueta(`fase ${faseNum(f[0])}`, 'ededed', f[0]);

const viejos = ghTodo(`repos/${repo}/milestones?state=all&per_page=100`);
const hitos = Object.fromEntries(viejos.map(m => [m.title, m.number]));
olas.forEach((o, i) => { hitos[tituloOla(o, i)] ??= gh(['-X', 'POST', `repos/${repo}/milestones`, '--input', '-'], { title: tituloOla(o, i), description: `Vas a ver: ${o[1]}` }).number; });
const existentes = Object.fromEntries(ghTodo(`repos/${repo}/issues?state=all&per_page=100`).filter(i => !i.pull_request).map(i => [i.title.split(' · ')[0], i.number]));
const num = { ...existentes };
let creados = 0, cambiados = 0;
for (const [fase, , ts] of fases) for (const t of ts) {
  if (num[t[0]]) continue;
  const r = gh(['-X', 'POST', `repos/${repo}/issues`, '--input', '-'], { title: `${t[0]} · ${t[1]}`, body: '…' });
  num[t[0]] = r.number; creados++; process.stdout.write(`+#${r.number} `); await sleep(1200); // GitHub limita la creación rápida de contenido
}
for (const [fase, , ts] of fases) for (const t of ts) {
  const labels = [`tamaño: ${TAM[t[3]][0]}`, `fase ${faseNum(fase)}`, ...(t[5]?.dept ? ['departamento'] : []), ...(/^Nivel /.test(t[1]) ? ['nivel'] : []), ...(/tus cuentas|tu cuenta/.test(t[4]) ? ['necesita tus cuentas'] : [])];
  gh(['-X', 'PATCH', `repos/${repo}/issues/${num[t[0]]}`, '--input', '-'], { title: `${t[0]} · ${t[1]}`, body: cuerpo(t, fase, num), milestone: hitos[olaDe[t[0]]], labels });
  cambiados++; process.stdout.write(`${t[0]} `); await sleep(300);
}
for (const m of viejos) if (!Object.values(olaDe).includes(m.title)) { gh(['-X', 'DELETE', `repos/${repo}/milestones/${m.number}`]); console.log(`\nborrado el hito viejo «${m.title}»`); }
console.log(`\nlisto: ${creados} issues nuevos, ${cambiados} al día, ${olas.length} olas`);
