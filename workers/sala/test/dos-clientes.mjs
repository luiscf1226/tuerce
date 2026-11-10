// Prueba de la sala: levanta `wrangler dev` con un secreto de prueba, conecta a los dos jugadores con pases firmados,
// cruza una señal y comprueba que sin pase válido o siendo un tercero no se entra, y que reconectar reemplaza.
import { spawn } from "node:child_process";
import { firmarPase } from "../src/pase.ts";

const PORT = 8798,
  SECRETO = "prueba",
  SALA = `prueba-${Date.now()}`, // las salas recuerdan a su pareja: una nueva en cada corrida
  base = `127.0.0.1:${PORT}`;
const w = spawn("pnpm", ["exec", "wrangler", "dev", "--port", String(PORT), "--var", `SALA_SECRETO:${SECRETO}`], {
  stdio: "ignore",
  detached: true,
});
const fin = (code) => {
  try {
    process.kill(-w.pid, "SIGKILL");
  } catch {}
  process.exit(code);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pase = (usuario, { sala = SALA, vence = Date.now() + 120_000, secreto = SECRETO } = {}) =>
  firmarPase({ sala, usuario, vence }, secreto);
const abrir = (token) =>
  new Promise((res, rej) => {
    const ws = new WebSocket(`ws://${base}/sala/${SALA}${token === undefined ? "" : `?pase=${token}`}`),
      c = { ws, cola: [], cierre: undefined };
    ws.onmessage = (e) => c.cola.push(JSON.parse(e.data));
    ws.onclose = (e) => {
      c.cierre = e.code;
    };
    ws.onopen = () => res(c);
    ws.onerror = () => rej(new Error("no conectó"));
  });
const rechazado = (token) =>
  abrir(token).then(
    (c) => {
      c.ws.close();
      return false;
    },
    () => true,
  );
const espera = async (c, t, ms = 3000) => {
  const s = Date.now();
  for (;;) {
    const m = c.cola.find((x) => x.t === t);
    if (m) return m;
    if (Date.now() - s > ms) throw new Error(`no llegó «${t}»: ${JSON.stringify(c.cola)}`);
    await sleep(30);
  }
};
try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`http://${base}/`)).ok) break;
    } catch {}
    if (i > 150) throw new Error("wrangler dev no arrancó");
    await sleep(200);
  }
  // Sin pase, vencido, mal firmado o de otra sala: no entra.
  if (!(await rechazado(undefined))) throw new Error("entró alguien sin pase");
  if (!(await rechazado(await pase("ana", { vence: Date.now() - 1000 })))) throw new Error("entró un pase vencido");
  if (!(await rechazado(await pase("ana", { secreto: "otro" })))) throw new Error("entró un pase mal firmado");
  if (!(await rechazado(await pase("ana", { sala: "otra-sala" })))) throw new Error("entró un pase de otra sala");

  const a = await abrir(await pase("ana"));
  if ((await espera(a, "hola")).rol !== "anfitrion") throw new Error("el primero debe ser anfitrión");
  const b = await abrir(await pase("beto"));
  if ((await espera(b, "hola")).rol !== "invitado") throw new Error("el segundo debe ser invitado");
  await espera(a, "listos");
  await espera(b, "listos");
  a.ws.send(JSON.stringify({ t: "senal", sdp: "oferta-de-prueba" }));
  if ((await espera(b, "senal")).sdp !== "oferta-de-prueba") throw new Error("la señal no llegó al invitado");
  if (a.cola.some((x) => x.t === "senal")) throw new Error("la señal le volvió a quien la mandó");

  // Un tercero con pase válido para esta sala no entra.
  if (!(await rechazado(await pase("carla")))) throw new Error("un tercero no fue rechazado");
  const oc = await (await fetch(`http://${base}/sala/${SALA}`)).json();
  if (oc.ocupacion !== 2) throw new Error(`ocupación ${oc.ocupacion}`);

  // Ana vuelve a entrar (otra pestaña): la conexión nueva reemplaza a la vieja, conserva el rol y Beto no la pierde.
  b.cola.length = 0;
  const a2 = await abrir(await pase("ana"));
  if ((await espera(a2, "hola")).rol !== "anfitrion") throw new Error("al reconectar se perdió el rol");
  await espera(a2, "listos");
  await espera(b, "listos");
  for (let i = 0; a.cierre === undefined; i++) {
    if (i > 100) throw new Error("la conexión vieja no se cerró");
    await sleep(30);
  }
  await sleep(200);
  if (b.cola.some((x) => x.t === "se_fue")) throw new Error("reemplazar avisó que Ana se fue");
  a2.ws.send(JSON.stringify({ t: "senal", sdp: "otra-oferta" }));
  if (!(await espera(b, "senal")).sdp) throw new Error("la señal de la conexión nueva no llegó");
  const oc2 = await (await fetch(`http://${base}/sala/${SALA}`)).json();
  if (oc2.ocupacion !== 2) throw new Error(`ocupación después de reconectar: ${oc2.ocupacion}`);

  // Ahora se va Beto: el anfitrión se entera. Un tercero sigue sin entrar aunque haya lugar.
  b.ws.close();
  if ((await espera(a2, "se_fue")).rol !== "invitado") throw new Error("no avisó que el invitado se fue");
  if (!(await rechazado(await pase("carla")))) throw new Error("con un lugar libre entró alguien de afuera");
  a2.ws.close();

  // TURN: con pase da servidores ICE (sin llaves de Cloudflare, el STUN público); sin pase, nada.
  if ((await fetch(`http://${base}/turn`)).status !== 401) throw new Error("/turn respondió sin pase");
  const turn = await (await fetch(`http://${base}/turn?pase=${await pase("ana")}`)).json();
  if (!turn.iceServers?.some((s) => s.urls.some((u) => u.startsWith("stun:"))))
    throw new Error(`/turn sin STUN: ${JSON.stringify(turn)}`);
  // tope por hora: con la primera ya van 1; las siguientes hasta 6 pasan y la 7.ª no
  const estados = [];
  for (let i = 0; i < 6; i++) estados.push((await fetch(`http://${base}/turn?pase=${await pase("ana")}`)).status);
  if (estados.slice(0, 5).some((e) => e !== 200) || estados[5] !== 429)
    throw new Error(`/turn no corta en 6 por hora: ${estados.join(",")}`);

  console.log(
    "PASA sala: con pase entran anfitrión e invitado, cruzan señales, reconectar reemplaza; sin pase o un tercero no entra; /turn responde con tope por hora",
  );
  fin(0);
} catch (e) {
  console.log("FALLA", e.message);
  fin(1);
}
