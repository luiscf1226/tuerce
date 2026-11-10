// Piezas comunes de los dos documentos de plan: cáscara HTML, estilos y ayudantes de tablas.
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ESTADO = { hecho: ['Hecho en el prototipo', 'ok'], parcial: ['Parcial', 'mid'], pendiente: ['Pendiente', 'no'], decision: ['Decisión abierta', 'ask'] };
const PRIO = { 1: 'Imprescindible', 2: 'Importante', 3: 'Después' };
export const chip = (txt, cls = '') => `<span class="chip ${cls}">${esc(txt)}</span>`;
/** Tabla genérica. head: string[]; rows: (string | {html})[][]; las celdas string se escapan. */
export function table(head, rows, cls = '') {
  const cell = c => (c && typeof c === 'object' ? c.html : esc(c));
  return `<div class="tabla"><table class="${cls}"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
/** Requerimientos: grupos de [id, texto, prioridad 1-3, estado, nota?]. */
export function reqs(groups) {
  return groups.map(([name, items]) => `<h3>${esc(name)}</h3>` + table(['Id', 'Requerimiento', 'Prioridad', 'Estado'], items.map(([id, txt, p, st, nota]) => [
    { html: `<code>${esc(id)}</code>` }, { html: esc(txt) + (nota ? `<span class="nota"> ${esc(nota)}</span>` : '') }, PRIO[p], { html: `<span class="est ${ESTADO[st][1]}">${ESTADO[st][0]}</span>` },
  ]), 'req')).join('');
}
export const mermaid = code => `<div class="diagrama"><pre class="mermaid">${esc(code.trim())}</pre></div>`;
export const tree = txt => `<pre class="arbol">${esc(txt.trim())}</pre>`;
export const section = (id, title, eyebrow, body) => `<section id="${id}"><p class="eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2>${body}</section>`;

/** Página completa (fragmento de artifact). nav: [id, etiqueta][] */
export function page({ title, lead, facts, nav, body, accent, accentDark, accent2, accent2Dark }) {
  return `<title>${esc(title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Documento de trabajo: índice fijo a la izquierda, texto a la derecha; en celular, una sola columna. */
:root {
  --bg: #f6f7f5; --surface: #ffffff; --fg: #14201f; --muted: #53625f; --line: #d5dcd9;
  --accent: ${accent}; --accent-2: ${accent2}; --accent-soft: color-mix(in srgb, ${accent} 12%, #ffffff);
  --ok: #1f7a4d; --mid: #9a6a00; --no: #6a6f7a; --ask: #a03a2a;
  --display: 'Bricolage Grotesque', 'Trebuchet MS', system-ui, sans-serif;
  --body: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font: 400 16.5px/1.55 var(--body); }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 28px 80px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
header.top { display: flex; flex-direction: column; gap: 14px; padding-bottom: 26px; border-bottom: 3px solid var(--fg); margin-bottom: 30px; }
h1 { font: 800 clamp(34px, 6.4vw, 64px)/.98 var(--display); letter-spacing: -.02em; margin: 0; text-wrap: balance; }
h1 em { font-style: normal; color: var(--accent); }
.lead { font-size: 19px; max-width: 64ch; margin: 0; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; border: 1px solid var(--line); background: var(--surface); }
.facts div { padding: 12px 14px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 0 -1px -1px 0; min-width: 0; }
.facts b { display: block; font: 800 26px/1.05 var(--display); font-variant-numeric: tabular-nums; }
.facts span { font-size: 13px; color: var(--muted); }
.layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 44px; align-items: start; }
nav.toc { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 14px); display: flex; flex-direction: column; gap: 2px; font-size: 14px; max-height: calc(100vh - 40px); overflow-y: auto; }
nav.toc a { color: var(--muted); text-decoration: none; padding: 5px 10px; border-left: 2px solid var(--line); }
nav.toc a.sub { padding-block: 2px; font-size: 13px; }
nav.toc a:hover, nav.toc a:focus-visible { color: var(--fg); border-left-color: var(--accent); outline: none; }
main { display: flex; flex-direction: column; gap: 56px; min-width: 0; }
section { display: flex; flex-direction: column; gap: 14px; min-width: 0; scroll-margin-top: 16px; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--accent); margin: 0; }
h2 { font: 800 clamp(26px, 3.6vw, 36px)/1.05 var(--display); letter-spacing: -.01em; margin: 0; text-wrap: balance; }
h3 { font: 700 19px/1.2 var(--display); margin: 14px 0 0; }
h4 { font: 700 15px/1.2 var(--body); margin: 8px 0 0; }
p { margin: 0; max-width: 70ch; }
ul, ol { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; max-width: 72ch; }
code { font: 600 .86em var(--mono); background: var(--accent-soft); padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
a { color: var(--accent); }
.tabla { overflow-x: auto; border: 1px solid var(--line); background: var(--surface); }
table { border-collapse: collapse; width: 100%; font-size: 14.5px; line-height: 1.4; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
tbody tr:last-child td { border-bottom: 0; }
th { font: 600 11.5px/1.2 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); background: var(--bg); white-space: nowrap; }
table.req { min-width: 620px; } table.req td:nth-child(3), table.req td:nth-child(4) { white-space: nowrap; }
table.tk { min-width: 720px; } table.tk td:nth-child(2) { font-weight: 700; } table.tk td:nth-child(4) { white-space: nowrap; }
.aprobar { border: 2px solid var(--fg); background: var(--surface); padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; max-width: 78ch; }
.aprobar h3 { margin: 0; }
.esencia { font-size: 18px; font-style: italic; }
.tipo { font: 600 12px/1 var(--mono); padding: 3px 6px; border: 1px solid currentColor; border-radius: 3px; white-space: nowrap; }
.tipo.estrella { color: var(--accent); } .tipo.loco { color: var(--accent-2); } .tipo.normal { color: var(--muted); }
ul.lista { list-style: none; padding: 0; gap: 10px; font-size: 14.5px; }
table.motores-d { min-width: 640px; } table.juegos-d { min-width: 760px; } table.rutas { min-width: 900px; }
table.juegos-d td:nth-child(2) { font-weight: 700; min-width: 170px; }
table.juegos { min-width: 700px; } table.juegos td:first-child { font-variant-numeric: tabular-nums; color: var(--muted); } table.juegos td:nth-child(2) { font-weight: 700; }
.wrap:has(table.juegos-unicos) { max-width: 1580px; }
@media (min-width: 901px) { .wrap:has(table.juegos-unicos) .layout { grid-template-columns: 180px minmax(0, 1fr); gap: 28px; } }
table.juegos-unicos { min-width: 1190px; table-layout: fixed; }
table.juegos-unicos th { white-space: normal; }
table.juegos-unicos th:nth-child(1) { width: 38px; }
table.juegos-unicos th:nth-child(2) { width: 195px; }
table.juegos-unicos th:nth-child(3) { width: 135px; }
table.juegos-unicos th:nth-child(4) { width: 90px; }
table.juegos-unicos th:nth-child(5) { width: 330px; }
table.juegos-unicos th:nth-child(6) { width: 115px; }
table.juegos-unicos th:nth-child(7) { width: 65px; }
table.juegos-unicos th:nth-child(8) { width: 150px; }
table.juegos-unicos details { font-weight: 400; margin-top: 8px; font-size: 13px; }
table.juegos-unicos summary { cursor: pointer; color: var(--accent); }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
.est { font: 600 12px/1 var(--mono); padding: 4px 7px; border-radius: 3px; border: 1px solid currentColor; }
.est.ok { color: var(--ok); } .est.mid { color: var(--mid); } .est.no { color: var(--no); } .est.ask { color: var(--ask); }
.nota { color: var(--muted); font-size: .92em; }
ol.pasos { max-width: 78ch; padding-left: 1.4em; display: grid; gap: 6px; }
table.olas td:first-child { white-space: nowrap; }
table.olas td:last-child { font-size: .92em; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 13px; padding: 3px 9px; border: 1px solid var(--line); background: var(--surface); border-radius: 999px; }
.chip.on { border-color: var(--accent); color: var(--accent); font-weight: 700; }
.diagrama { border: 1px solid var(--line); background: var(--surface); padding: 14px; overflow-x: auto; }
.diagrama pre { margin: 0; font: 13px/1.4 var(--mono); }
pre.arbol { margin: 0; font: 13.5px/1.5 var(--mono); background: var(--surface); border: 1px solid var(--line); padding: 14px 16px; overflow-x: auto; }
.cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 18px 28px; }
.cols > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; border-top: 3px solid var(--fg); padding-top: 10px; }
.cols h3 { margin: 0; }
.aviso { border-left: 4px solid var(--accent-2); background: var(--surface); padding: 12px 16px; max-width: 76ch; }
.dept { border-top: 3px solid var(--fg); padding-top: 14px; display: flex; flex-direction: column; gap: 10px; scroll-margin-top: 16px; }
.dept-h { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 14px; }
.dept-h h3 { margin: 0; font-size: 25px; }
.dept-h span { color: var(--muted); font-size: 14px; }
.kv { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 4px 12px; font-size: 14.5px; }
.kv dt { font: 600 11.5px/1.7 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.kv dd { margin: 0; }
.barra { height: 8px; background: var(--line); position: relative; max-width: 320px; }
.barra i { position: absolute; inset: 0 auto 0 0; background: var(--accent); }
.mapa-d { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px; }
.mapa-d a { display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 1px solid var(--line); background: var(--surface); text-decoration: none; color: var(--fg); font-size: 14px; }
.mapa-d a b { color: var(--accent); font-variant-numeric: tabular-nums; }
.nivel { border-top: 3px solid var(--fg); padding-top: 14px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 10px 28px; scroll-margin-top: 16px; }
.nivel > div { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.nivel h3 { margin: 0; font-size: 24px; }
.nivel .num { font: 600 12px/1 var(--mono); letter-spacing: .1em; color: var(--accent); text-transform: uppercase; }
.nivel ol { padding-left: 22px; font-size: 15px; }
.nivel ol li::marker { font: 600 13px var(--mono); color: var(--muted); }
.duo { font-weight: 700; color: var(--accent-2); }
.arte { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.arte figure { margin: 0; display: flex; flex-direction: column; gap: 5px; }
.arte img { display: block; width: 100%; height: auto; border: 1px solid var(--line); }
.arte figcaption { font-size: 13px; color: var(--muted); }
@media (max-width: 900px) { .layout { grid-template-columns: minmax(0, 1fr); gap: 24px; } nav.toc { position: static; flex-direction: row; flex-wrap: wrap; gap: 6px; max-height: none; } nav.toc a { border: 1px solid var(--line); border-radius: 999px; padding: 4px 10px; background: var(--surface); } nav.toc a.sub { display: none; } .nivel { grid-template-columns: 1fr; } }
</style>
<div class="wrap">
  <header class="top">
    <p class="eyebrow">Arquitectura, requerimientos y contenido · versión del 9 de noviembre de 2026</p>
    <h1>${title.replace(/^Plan /, 'Plan <em>') + '</em>'}</h1>
    <p class="lead">${lead}</p>
    <div class="facts">${facts.map(([n, l]) => `<div><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
  </header>
  <div class="layout">
    <nav class="toc" aria-label="Contenido">${nav.map(([id, l]) => `<a href="#${id}"${l.startsWith('· ') ? ' class="sub"' : ''}>${esc(l)}</a>`).join('')}</nav>
    <main>${body}</main>
  </div>
</div>
`;
}

const TAM = { C: 'Chico · hasta 1 día', M: 'Mediano · 2 a 4 días', G: 'Grande · 1 a 2 semanas' };
/** Tickets por fase: [fase, nota, [id, título, listo cuando, tamaño, depende][]][] */
export function tickets(fases) {
  return fases.map(([fase, nota, ts]) => `<h3>${esc(fase)}</h3>${nota ? `<p class="nota">${esc(nota)}</p>` : ''}` + table(['Id', 'Ticket', 'Listo cuando', 'Tamaño', 'Depende de'], ts.map(([id, t, ok, tam, dep]) => [{ html: `<code>${esc(id)}</code>` }, t, { html: esc(ok).replace(/`([^`]+)`/g, '<code>$1</code>') }, TAM[tam], dep || '—']), 'tk')).join('');
}
export const ticketsMd = (titulo, fases) => `# Tickets · ${titulo}\n\nTamaños: C = hasta 1 día · M = 2 a 4 días · G = 1 a 2 semanas.\n` + fases.map(([fase, nota, ts]) => `\n## ${fase}\n${nota ? `\n${nota}\n` : ''}\n| Id | Ticket | Listo cuando | Tamaño | Depende de |\n|---|---|---|---|---|\n` + ts.map(([id, t, ok, tam, dep]) => `| ${id} | ${t} | ${ok} | ${tam} | ${dep || '—'} |`).join('\n') + '\n').join('');
export const contar = fases => fases.reduce((n, f) => n + f[2].length, 0);

/** Olas: [nombre, lo que vas a ver, necesita cuentas, ids][] sobre las fases de tickets. */
export const COMO_OLA = [
  ['Decís la ola', 'Por ejemplo: «haz la ola 0 de Tuerce».'],
  ['Se reparte', 'Un agente por ticket, todos al mismo tiempo, cada uno en su copia del proyecto. Antes reviso tus límites.'],
  ['Se junta', 'Todo entra a una rama <code>ola-N</code>; se corren las pruebas del juego completo.'],
  ['Lo ves', 'Vista previa para jugarlo, capturas o video de lo nuevo y un pull request con el resumen.'],
  ['Aprobás', 'Con «full send» se une a la rama principal y los issues de la ola se cierran. Si algo no te gusta, lo decís con tus palabras y se corrige dentro de la misma ola.'],
];
export function olas(lista, fases) {
  const t = Object.fromEntries(fases.flatMap(f => f[2]).map(x => [x[0], x]));
  const pasos = `<ol class="pasos">${COMO_OLA.map(([a, b]) => `<li><b>${esc(a)}.</b> ${b}</li>`).join('')}</ol>`;
  return pasos + table(['Ola', 'Lo que vas a ver al final', 'Tickets'], lista.map(([nombre, ver, cuentas, ids], i) => [
    { html: `<b>Ola ${i}</b><br>${esc(nombre)}` },
    { html: esc(ver) + (cuentas ? `<br>${chip('necesita tus cuentas')}` : '') },
    { html: ids.map(id => `<code>${esc(id)}</code> ${esc(t[id][1])}`).join('<br>') },
  ]), 'olas');
}
export const olasMd = (titulo, lista, fases) => {
  const t = Object.fromEntries(fases.flatMap(f => f[2]).map(x => [x[0], x]));
  return `# Olas · ${titulo}\n\nUna ola = varios tickets en paralelo, una rama \`ola-N\`, una vista previa y una aprobación.\n\n` +
    COMO_OLA.map(([a, b], i) => `${i + 1}. **${a}.** ${b.replace(/<\/?code>/g, '`')}`).join('\n') + '\n' +
    lista.map(([nombre, ver, cuentas, ids], i) => `\n## Ola ${i} · ${nombre}\n\n**Vas a ver:** ${ver}${cuentas ? ' _(necesita tus cuentas)_' : ''}\n\n` + ids.map(id => `- ${id} · ${t[id][1]}`).join('\n') + '\n').join('');
};
