// El paso final sobre la imagen ya hecha, en una sola pasada: tono (lineal con un hombro suave en las luces, sin
// aplastar las sombras), paso a sRGB, el brillo de la niebla donde está el sol, viñeta suave y grano fino.
//
// Con la pantalla partida (TU-09) la escena se dibuja dos veces, una por cámara, cada una en su propia textura y
// solo en el rectángulo que cubre su lado del corte (scissor). El acabado junta las dos según el lado del corte,
// pinta la costura oscura y recién ahí pone viñeta y grano, una sola vez para toda la pantalla.
import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { type Rectangulo, recorteDelLado } from "../camara/encuadre";
import { crearResolucionAdaptable, type OpcionesResolucion } from "./resolucion";

/** La segunda vista de la pantalla partida. `crearImagen` la lee en cada cuadro (ver src/camara). */
export interface VistasPartidas {
  /** Si hay que dibujar la segunda cámara. Sin partir, solo se dibuja la principal. */
  readonly partida: boolean;
  /** La cámara del jugador 2, que va del lado hacia donde apunta `normal`. */
  readonly camaraB: THREE.Camera;
  /** La normal del corte en pantalla (y hacia arriba), de largo 1. */
  readonly normal: { readonly x: number; readonly y: number };
  /** Cuánto se ve la costura, de 0 a 1. */
  readonly costura: number;
}

/** Ancho de la costura, en píxeles de pantalla (a densidad 1). */
const COSTURA = 2.2;
export interface OpcionesImagen {
  /** Fuerza del grano (0 sin grano). */
  grano?: number;
  /** Cuánto se oscurecen las esquinas (0 nada). */
  vineta?: number;
  /** Cuánto se aclara la niebla alrededor del sol escondido (0 nada). */
  bruma?: number;
  /** Dónde está ese brillo en la pantalla (0 a 1, origen abajo a la izquierda). */
  centroBruma?: readonly [number, number];
  /** Muestras de antialias (MSAA) al dibujar la escena. */
  muestras?: number;
  /** Cuándo y cuánto bajar la resolución si la máquina no da abasto. */
  resolucion?: OpcionesResolucion;
  /** Pantalla partida: si está, la escena se dibuja también con `vistas.camaraB` cuando haga falta. */
  vistas?: VistasPartidas;
}

export const SOMBREADO_GRANO = {
  name: "GranoYVineta",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    /** La segunda vista, del lado positivo de `normal` (solo cuenta con `partida` en 1). */
    tSegunda: { value: null as THREE.Texture | null },
    partida: { value: 0 },
    normal: { value: new THREE.Vector2(1, 0) },
    costura: { value: 0 },
    /** Tamaño del lienzo en píxeles, para la costura. */
    lienzo: { value: new THREE.Vector2(1, 1) },
    anchoCostura: { value: COSTURA },
    /** Qué parte de la textura ocupa la escena (menos de 1 cuando la resolución bajó) y medio texel de margen. */
    ventana: { value: new THREE.Vector2(1, 1) },
    medioTexel: { value: new THREE.Vector2(0, 0) },
    cuadro: { value: 0 },
    aspecto: { value: 16 / 9 },
    grano: { value: 0.07 },
    vineta: { value: 0.32 },
    bruma: { value: 0.5 },
    centroBruma: { value: new THREE.Vector2(0.62, 0.8) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tSegunda;
    uniform float partida;
    uniform vec2 normal;
    uniform float costura;
    uniform vec2 lienzo;
    uniform float anchoCostura;
    uniform vec2 ventana;
    uniform vec2 medioTexel;
    uniform float cuadro;
    uniform float aspecto;
    uniform float grano;
    uniform float vineta;
    uniform float bruma;
    uniform vec2 centroBruma;
    varying vec2 vUv;

    // Lineal hasta 0.8 y de ahí una curva suave hacia 1: las luces no se queman y las sombras quedan como están.
    vec3 hombro(vec3 c) {
      vec3 sobra = max(c - 0.8, 0.0);
      return min(c, 0.8) + 0.2 * (1.0 - exp(-sobra / 0.2));
    }

    float azar(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p.yx + 19.19);
      return fract((p.x + p.y) * p.x);
    }

    void main() {
      vec2 donde = clamp(vUv * ventana, medioTexel, ventana - medioTexel);
      vec4 color = texture2D(tDiffuse, donde);
      // Pantalla partida: de qué lado del corte cae este píxel (en píxeles desde la línea, que pasa por el centro)
      float lado = dot((vUv - 0.5) * lienzo, normal);
      if (partida > 0.5 && lado > 0.0) color = texture2D(tSegunda, donde);
      color.rgb = hombro(max(color.rgb, 0.0));
      color = sRGBTransferOETF(color);
      // La costura: una línea fina del color de las siluetas, con el borde suavizado
      float linea = 1.0 - smoothstep(anchoCostura * 0.5 - 0.75, anchoCostura * 0.5 + 0.75, abs(lado));
      color.rgb = mix(color.rgb, vec3(0.235), partida * costura * linea);
      float luz = dot(color.rgb, vec3(0.299, 0.587, 0.114));

      // La niebla brilla donde está el sol: solo se aclara lo que ya es claro, las siluetas quedan oscuras.
      vec2 haciaSol = (vUv - centroBruma) * vec2(aspecto, 1.0);
      float brillo = 1.0 - smoothstep(0.0, 1.1, length(haciaSol));
      color.rgb = mix(color.rgb, vec3(1.0), bruma * brillo * luz * luz);

      // Viñeta: las esquinas se van apagando de a poco hacia un gris, nunca a negro.
      vec2 desdeCentro = (vUv - 0.5) * vec2(aspecto / 1.6, 1.0);
      float borde = smoothstep(0.3, 0.95, length(desdeCentro));
      color.rgb *= 1.0 - vineta * borde;

      // Grano fino, un píxel de tamaño, que cambia en cada cuadro; se nota más en los grises medios.
      vec2 semilla = gl_FragCoord.xy + vec2(mod(cuadro, 61.0) * 17.0, mod(cuadro, 53.0) * 23.0);
      float ruido = (azar(semilla) + azar(semilla + 0.37) - 1.0);
      color.rgb += ruido * grano * (0.45 + 0.55 * (1.0 - abs(luz * 2.0 - 1.0)));

      gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
    }
  `,
};

/** Sin tarjeta de video la escena se dibuja a un cuarto de lado: el procesador no da para más a 60 por segundo. */
const ESCALA_SIN_TARJETA = 0.25;

/** ¿El navegador dibuja sin tarjeta de video (SwiftShader, llvmpipe)? */
function dibujaPorSoftware(pintor: THREE.WebGLRenderer): boolean {
  const gl = pintor.getContext();
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const nombre = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  return /swiftshader|llvmpipe|software/i.test(nombre);
}

export interface Imagen {
  /** Dibuja la escena con todo el acabado (tono, grano, viñeta) en el lienzo. */
  dibujar(): void;
  /** Llamar cuando cambia el tamaño del lienzo (en píxeles CSS). */
  ajustar(ancho: number, alto: number): void;
  /** Qué parte de la resolución se está usando (baja sola si la máquina no da abasto). */
  readonly escala: number;
  liberar(): void;
}

/**
 * Prepara al pintor y arma la cadena de dibujo: escena (con antialias) → acabado en pantalla.
 * Llamar después de `pintor.setPixelRatio`.
 */
export function crearImagen(
  pintor: THREE.WebGLRenderer,
  escena: THREE.Scene,
  camara: THREE.Camera,
  opciones: OpcionesImagen = {},
): Imagen {
  // El tono y el paso a sRGB los hace el acabado; el pintor no toca los colores.
  pintor.toneMapping = THREE.NoToneMapping;
  pintor.outputColorSpace = THREE.SRGBColorSpace;

  // La escena se dibuja en lineal (media precisión, sin bandas en la niebla) y con antialias propio. La segunda
  // textura es para la otra cámara de la pantalla partida; mientras no se parte no se dibuja en ella.
  const crearObjetivo = () =>
    new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: opciones.muestras ?? 4 });
  const primera = crearObjetivo();
  const segunda = crearObjetivo();
  const acabado = new THREE.ShaderMaterial({
    name: SOMBREADO_GRANO.name,
    uniforms: THREE.UniformsUtils.clone(SOMBREADO_GRANO.uniforms),
    vertexShader: SOMBREADO_GRANO.vertexShader,
    fragmentShader: SOMBREADO_GRANO.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const pantalla = new FullScreenQuad(acabado);
  const u = acabado.uniforms as typeof SOMBREADO_GRANO.uniforms;
  u.tDiffuse.value = primera.texture;
  u.tSegunda.value = segunda.texture;
  u.grano.value = opciones.grano ?? u.grano.value;
  u.vineta.value = opciones.vineta ?? u.vineta.value;
  u.bruma.value = opciones.bruma ?? u.bruma.value;
  if (opciones.centroBruma) u.centroBruma.value.set(...opciones.centroBruma);
  const vistas = opciones.vistas;

  const porSoftware = dibujaPorSoftware(pintor);
  const resolucion = crearResolucionAdaptable({
    ...(porSoftware ? { minima: ESCALA_SIN_TARJETA } : {}),
    ...opciones.resolucion,
  });
  // Al bajar la resolución no se cambian las texturas (rehacerlas a mitad de juego deja a algunos navegadores
  // lentos): la escena se dibuja en un rincón más chico de ellas y el acabado lo estira.
  const aplicarEscala = () => {
    const escala = resolucion.escala;
    for (const destino of [primera, segunda]) {
      destino.viewport.set(0, 0, Math.round(destino.width * escala), Math.round(destino.height * escala));
    }
    const { width, height, viewport } = primera;
    u.ventana.value.set(viewport.z / width, viewport.w / height);
    u.medioTexel.value.set(0.5 / width, 0.5 / height);
  };

  // Una pestaña escondida no dibuja: ese hueco no es lentitud.
  const alVolver = () => resolucion.reiniciar();
  document.addEventListener("visibilitychange", alVolver);

  /** Dibuja la escena con `camara` en `destino`, solo en el lado `lado` del corte si la pantalla está partida. */
  const recorte: Rectangulo = { x: 0, y: 0, ancho: 0, alto: 0 };
  const dibujarVista = (destino: THREE.WebGLRenderTarget, camara: THREE.Camera, lado: 1 | -1 | 0) => {
    if (lado === 0 || !vistas) {
      destino.scissorTest = false;
    } else {
      const { z: ancho, w: alto } = destino.viewport;
      const margen = (COSTURA * pintor.getPixelRatio() * ancho) / Math.max(destino.width, 1) + 2;
      recorteDelLado(vistas.normal, lado, ancho, alto, margen, recorte);
      destino.scissor.set(recorte.x, recorte.y, recorte.ancho, recorte.alto);
      destino.scissorTest = true;
    }
    pintor.setRenderTarget(destino);
    pintor.render(escena, camara);
  };

  let cuadro = 0;
  return {
    dibujar() {
      // Sin tarjeta de video (Chromium sin ventana) todo se dibuja en el procesador: desde el segundo cuadro se
      // baja la resolución. El primero sale completo, así las capturas con ?congelar se ven nítidas.
      if (cuadro === 1 && porSoftware) {
        resolucion.bajarAlMinimo();
        aplicarEscala();
      }
      if (resolucion.cuadro(performance.now() / 1000)) aplicarEscala();
      u.cuadro.value = cuadro++;

      const partida = vistas?.partida === true;
      dibujarVista(primera, camara, partida ? -1 : 0);
      if (partida && vistas) {
        dibujarVista(segunda, vistas.camaraB, 1);
        u.normal.value.set(vistas.normal.x, vistas.normal.y);
        u.costura.value = vistas.costura;
      }
      u.partida.value = partida ? 1 : 0;
      pintor.setRenderTarget(null);
      pantalla.render(pintor);
    },
    ajustar(ancho, alto) {
      const densidad = pintor.getPixelRatio();
      const w = Math.max(1, Math.floor(ancho * densidad));
      const h = Math.max(1, Math.floor(alto * densidad));
      primera.setSize(w, h);
      segunda.setSize(w, h);
      u.aspecto.value = ancho / Math.max(alto, 1);
      u.lienzo.value.set(w, h);
      u.anchoCostura.value = COSTURA * densidad;
      aplicarEscala();
    },
    get escala() {
      return resolucion.escala;
    },
    liberar() {
      document.removeEventListener("visibilitychange", alVolver);
      primera.dispose();
      segunda.dispose();
      acabado.dispose();
      pantalla.dispose();
    },
  };
}
