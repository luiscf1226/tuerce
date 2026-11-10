// El paso final sobre la imagen ya hecha, en una sola pasada: tono (lineal con un hombro suave en las luces, sin
// aplastar las sombras), paso a sRGB, el brillo de la niebla donde está el sol, viñeta suave y grano fino.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { crearResolucionAdaptable, type OpcionesResolucion } from "./resolucion";
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
}

export const SOMBREADO_GRANO = {
  name: "GranoYVineta",
  uniforms: {
    tDiffuse: { value: null },
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
      vec4 color = texture2D(tDiffuse, clamp(vUv * ventana, medioTexel, ventana - medioTexel));
      color.rgb = hombro(max(color.rgb, 0.0));
      color = sRGBTransferOETF(color);
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

  // La escena se dibuja en lineal (media precisión, sin bandas en la niebla) y con antialias propio.
  const objetivo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: opciones.muestras ?? 4 });
  const compositor = new EffectComposer(pintor, objetivo);
  compositor.addPass(new RenderPass(escena, camara));
  const acabado = new ShaderPass(SOMBREADO_GRANO);
  const u = acabado.uniforms as typeof SOMBREADO_GRANO.uniforms;
  u.grano.value = opciones.grano ?? u.grano.value;
  u.vineta.value = opciones.vineta ?? u.vineta.value;
  u.bruma.value = opciones.bruma ?? u.bruma.value;
  if (opciones.centroBruma) u.centroBruma.value.set(...opciones.centroBruma);
  compositor.addPass(acabado);

  const porSoftware = dibujaPorSoftware(pintor);
  const resolucion = crearResolucionAdaptable({
    ...(porSoftware ? { minima: ESCALA_SIN_TARJETA } : {}),
    ...opciones.resolucion,
  });
  // Al bajar la resolución no se cambian las texturas del compositor (rehacerlas a mitad de juego deja a
  // algunos navegadores lentos): la escena se dibuja en un rincón más chico de ellas y el acabado lo estira.
  const aplicarEscala = () => {
    const escala = resolucion.escala;
    for (const destino of [compositor.renderTarget1, compositor.renderTarget2]) {
      destino.viewport.set(0, 0, Math.round(destino.width * escala), Math.round(destino.height * escala));
    }
    const { width, height, viewport } = compositor.renderTarget1;
    u.ventana.value.set(viewport.z / width, viewport.w / height);
    u.medioTexel.value.set(0.5 / width, 0.5 / height);
  };

  // Una pestaña escondida no dibuja: ese hueco no es lentitud.
  const alVolver = () => resolucion.reiniciar();
  document.addEventListener("visibilitychange", alVolver);

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
      compositor.render();
    },
    ajustar(ancho, alto) {
      compositor.setPixelRatio(pintor.getPixelRatio());
      compositor.setSize(ancho, alto);
      u.aspecto.value = ancho / Math.max(alto, 1);
      aplicarEscala();
    },
    get escala() {
      return resolucion.escala;
    },
    liberar() {
      document.removeEventListener("visibilitychange", alVolver);
      compositor.dispose();
    },
  };
}
