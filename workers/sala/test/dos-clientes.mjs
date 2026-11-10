// Prueba de la sala: levanta `wrangler dev`, conecta a los dos jugadores, cruza una señal y comprueba el cupo de 2.
import { spawn } from "node:child_process";

const PORT = 8798,
  url = `ws://127.0.0.1:${PORT}/sala/ABCDE`;
const w = spawn("pnpm", ["exec", "wrangler", "dev", "--port", String(PORT)], { stdio: "ignore", detached: true });
const fin = (code) => {
  try {
    process.kill(-w.pid, "SIGKILL");
  } catch {}
  process.exit(code);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const abrir = () =>
  new Promise((res, rej) => {
    const ws = new WebSocket(url),
      cola = [];
    ws.onmessage = (e) => cola.push(JSON.parse(e.data));
    ws.onopen = () => res({ ws, cola });
    ws.onerror = () => rej(new Error("no conectó"));
  });
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
      if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) break;
    } catch {}
    if (i > 150) throw new Error("wrangler dev no arrancó");
    await sleep(200);
  }
  const a = await abrir();
  if ((await espera(a, "hola")).rol !== "anfitrion") throw new Error("el primero debe ser anfitrión");
  const b = await abrir();
  if ((await espera(b, "hola")).rol !== "invitado") throw new Error("el segundo debe ser invitado");
  await espera(a, "listos");
  await espera(b, "listos");
  a.ws.send(JSON.stringify({ t: "senal", sdp: "oferta-de-prueba" }));
  if ((await espera(b, "senal")).sdp !== "oferta-de-prueba") throw new Error("la señal no llegó al invitado");
  if (a.cola.some((x) => x.t === "senal")) throw new Error("la señal le volvió a quien la mandó");
  const tercero = await abrir().then(
    (c) => {
      c.ws.close();
      return "entró";
    },
    () => "rechazado",
  );
  if (tercero !== "rechazado") throw new Error("un tercero no fue rechazado");
  const oc = await (await fetch(`http://127.0.0.1:${PORT}/sala/ABCDE`)).json();
  if (oc.ocupacion !== 2) throw new Error(`ocupación ${oc.ocupacion}`);
  b.ws.close();
  if ((await espera(a, "se_fue")).rol !== "invitado") throw new Error("no avisó que el invitado se fue");
  a.ws.close();
  console.log("PASA sala: anfitrión e invitado se encuentran, cruzan señales y un tercero no entra");
  fin(0);
} catch (e) {
  console.log("FALLA", e.message);
  fin(1);
}
