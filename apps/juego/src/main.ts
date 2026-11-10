import * as THREE from "three";
import { ESCENA_INICIAL, ESCENAS } from "./escenas";
import { publicarEstado } from "./estado";
import { crearBucle, PASOS_POR_SEGUNDO } from "./motor/bucle";
import { crearMundo } from "./motor/fisica";
import "./estilo.css";

// Parámetros de la dirección:
//   ?escena=<nombre>   qué escena abrir (ver src/escenas/index.ts); `entrar` abre la entrada con Clerk
//   ?congelar=<pasos>  corre exactamente esos pasos de físicas y se detiene; para capturas que siempre salen igual
//   ?depurar           muestra los pasos de físicas por segundo
const parametros = new URLSearchParams(location.search);
const nombre = parametros.get("escena") ?? ESCENA_INICIAL;
const congelar = Number(parametros.get("congelar") ?? Number.NaN);

async function arrancar() {
  // La pantalla de entrar no es una escena de físicas: se carga aparte para no meter Clerk en el juego.
  if (nombre === "entrar") return (await import("./cuenta/entrar")).abrirEntrar();

  const crear = ESCENAS[nombre];
  if (!crear) throw new Error(`No existe la escena «${nombre}». Hay: ${Object.keys(ESCENAS).join(", ")}`);

  const { rapier, mundo } = await crearMundo();
  const escena = crear(rapier, mundo);
  const estado = publicarEstado({ escena: nombre, listo: false, pasosTotales: 0, pasosPorSegundo: 0 });

  const lienzo = document.createElement("canvas");
  document.body.append(lienzo);
  const pintor = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
  pintor.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const ajustar = () => {
    pintor.setSize(window.innerWidth, window.innerHeight);
    escena.camara.aspect = window.innerWidth / window.innerHeight;
    escena.camara.updateProjectionMatrix();
  };
  window.addEventListener("resize", ajustar);
  ajustar();

  const medidor = parametros.has("depurar") ? document.body.appendChild(document.createElement("output")) : undefined;
  const bucle = crearBucle(() => escena.pasar());
  let pasosEsteSegundo = 0;
  let inicioSegundo = performance.now();

  if (Number.isFinite(congelar)) {
    for (let i = 0; i < congelar; i++) escena.pasar();
    escena.dibujar(1);
    pintor.render(escena.escena, escena.camara);
    Object.assign(estado, { listo: true, pasosTotales: congelar });
    return;
  }

  let anterior = performance.now();
  pintor.setAnimationLoop((ahora: number) => {
    pasosEsteSegundo += bucle.avanzar((ahora - anterior) / 1000);
    anterior = ahora;
    escena.dibujar(bucle.alfa);
    pintor.render(escena.escena, escena.camara);

    if (ahora - inicioSegundo >= 1000) {
      estado.pasosPorSegundo = Math.round((pasosEsteSegundo * 1000) / (ahora - inicioSegundo));
      pasosEsteSegundo = 0;
      inicioSegundo = ahora;
      if (medidor) medidor.textContent = `${estado.pasosPorSegundo} / ${PASOS_POR_SEGUNDO} pasos por segundo`;
    }
    estado.pasosTotales = bucle.pasosTotales;
    estado.listo = true;
  });
}

arrancar().catch((error: unknown) => {
  const aviso = document.body.appendChild(document.createElement("pre"));
  aviso.className = "error";
  aviso.textContent = String(error instanceof Error ? error.message : error);
  console.error(error);
});
