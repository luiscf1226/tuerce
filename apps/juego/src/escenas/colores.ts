// Paleta de las imágenes de referencia (docs/arte/11-pinar a 14-personajes): niebla clara, siluetas oscuras
// y los dos pañuelos como único color. Todo lo demás es gris: `src/imagen/paleta.test.ts` lo revisa.
export const COLORES = {
  /** Fondo y niebla: blanco gastado, casi sin tinte. */
  niebla: 0xdedfdc,
  /** Siluetas cercanas: muñecos, troncos, plantas del frente. */
  silueta: 0x3c3c3c,
  /** Siluetas más negras que todo, para lo que tapa la cámara (matas, rocas del frente). */
  siluetaHonda: 0x1a1a1a,
  siluetaLejana: 0x6e6e6b,
  suelo: 0x3a3a38,
  roca: 0x3a3a38,
  agua: 0xc4c5c2,
  /** Los ojos de los muñecos: dos puntos blancos. */
  ojo: 0xf4f4f0,
  panueloRojo: 0xd2463a,
  panueloTurquesa: 0x2bb1ad,
} as const;
