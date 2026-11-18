import * as THREE from "three";
import { hayPantallaTactil } from "./entrada/tactil";
import { ESCENA_INICIAL, ESCENAS, PANTALLAS } from "./escenas";
import { publicarEstado } from "./estado";
import { crearImagen } from "./imagen";
import { densidadDeDibujo } from "./imagen/resolucion";
import { crearBucle, PASOS_POR_SEGUNDO } from "./motor/bucle";
import { crearMundo } from "./motor/fisica";
import { prepararEscritorio } from "./ui/escritorio";
import "./estilo.css";

// Parámetros de la dirección:
//   ?escena=<nombre>   qué escena abrir (ver src/escenas/index.ts); `entrar`, `invitar` y `buscar` son pantallas de la cuenta
//   ?congelar=<pasos>  corre exactamente esos pasos de físicas y se detiene; para capturas que siempre salen igual
//   ?depurar           muestra los pasos de físicas por segundo
const parametros = new URLSearchParams(location.search);
const nombre = parametros.get("escena") ?? ESCENA_INICIAL;
const congelar = Number(parametros.get("congelar") ?? Number.NaN);

prepararEscritorio();

async function arrancar() {
  // Las pantallas de la cuenta no son escenas de físicas: se cargan aparte para no meter Clerk en el juego.
  const pantalla = PANTALLAS[nombre];
  if (pantalla) return pantalla();

  const crear = ESCENAS[nombre];
  if (!crear) throw new Error(`No existe la escena «${nombre}». Hay: ${Object.keys(ESCENAS).join(", ")}`);

  const { rapier, mundo } = await crearMundo();
  const escena = await crear(rapier, mundo);
  const estado = publicarEstado({ escena: nombre, listo: false, pasosTotales: 0, pasosPorSegundo: 0 });
  // La misión y los muñecos, para las pruebas en Chromium (se leen al preguntar, sin costo por cuadro)
  const { tablero, munecos } = escena;
  if (tablero)
    Object.defineProperty(estado, "mision", {
      enumerable: true,
      get: () => ({
        actual: tablero.objetivos[tablero.actual]?.id ?? null,
        cumplidos: tablero.objetivos.filter((_, i) => tablero.medida(i).hecho).length,
        total: tablero.objetivos.length,
        terminada: tablero.terminado,
      }),
    });
  const pendientes = escena.pendientes?.bind(escena);
  if (pendientes) Object.defineProperty(estado, "pendientes", { enumerable: true, get: pendientes });
  if (munecos)
    Object.defineProperty(estado, "jugadores", {
      enumerable: true,
      get: () =>
        munecos.map((m) => {
          const p = m.partes.pelvis.translation();
          const manos = [m.agarrado("brazoIzquierdo"), m.agarrado("brazoDerecho")].filter((c) => c !== null).length;
          return { x: p.x, y: p.y, z: p.z, rumbo: m.rumboReal(), estado: m.estado, manos };
        }),
    });

  const lienzo = document.createElement("canvas");
  document.body.append(lienzo);
  // Guardar el cuadro ya mostrado solo hace falta para fotografiar una escena congelada: a cada cuadro le cuesta a la
  // tarjeta de video (sobre todo en los teléfonos)
  const pintor = new THREE.WebGLRenderer({
    canvas: lienzo,
    antialias: false,
    preserveDrawingBuffer: Number.isFinite(congelar),
  });
  pintor.setPixelRatio(densidadDeDibujo(window.devicePixelRatio, hayPantallaTactil(parametros)));
  // Todo se dibuja a través de la imagen (src/imagen): tono, antialias, grano y viñeta de las referencias.
  // Con la cámara de los dos, la pantalla se parte cuando se separan (TU-09).
  const imagen = crearImagen(pintor, escena.escena, escena.camara, escena.vistas ? { vistas: escena.vistas } : {});
  const ajustar = () => {
    pintor.setSize(window.innerWidth, window.innerHeight);
    imagen.ajustar(window.innerWidth, window.innerHeight);
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
    imagen.dibujar();
    Object.assign(estado, { listo: true, pasosTotales: congelar });
    return;
  }

  let anterior = performance.now();
  pintor.setAnimationLoop((ahora: number) => {
    // Pausa (TU-15): el bucle no avanza y el tiempo pausado no se acumula, así al seguir no hay que ponerse al día.
    // El dibujo sigue con el mismo `alfa`, así que la imagen queda quieta (solo el grano se mueve).
    escena.interfaz?.cuadro();
    if (escena.juego?.corren ?? true) pasosEsteSegundo += bucle.avanzar((ahora - anterior) / 1000);
    anterior = ahora;
    escena.dibujar(bucle.alfa);
    imagen.dibujar();

    if (ahora - inicioSegundo >= 1000) {
      estado.pasosPorSegundo = Math.round((pasosEsteSegundo * 1000) / (ahora - inicioSegundo));
      pasosEsteSegundo = 0;
      inicioSegundo = ahora;
      if (medidor) {
        const imagenAl = Math.round(imagen.escala * 100);
        medidor.textContent = `${estado.pasosPorSegundo} / ${PASOS_POR_SEGUNDO} pasos por segundo · imagen al ${imagenAl}%`;
      }
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
