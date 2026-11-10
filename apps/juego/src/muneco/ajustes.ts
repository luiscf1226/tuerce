// Todos los números del muñeco en un solo lugar: medidas del cuerpo, masas y la afinación del equilibrio.
// Unidades: metros, kilos, segundos y radianes. El muñeco mira hacia +z en su marco local; arriba es +y.

/** Medidas del cuerpo, de pie, con las suelas en y = 0. Proporciones de docs/arte/14-personajes: cabeza grande y
 * redonda, panza de trapo, piernas cortas y brazos largos que cuelgan hasta media pierna. */
export const MEDIDAS = {
  pelvis: { radio: 0.15, y: 0.5 },
  torso: { radio: 0.17, medioAlto: 0.1, y: 0.76 },
  cabeza: { radio: 0.23, y: 1.21 },
  /** Altura del cuello: donde se une la cabeza al torso. */
  cuello: 1.0,
  brazo: { radio: 0.055, largo: 0.36, mano: 0.075, hombroX: 0.21, hombroY: 0.95 },
  /** Cadera: donde se une el muslo a la pelvis. El muslo y la canilla miden lo mismo. */
  cadera: { x: 0.085, y: 0.46 },
  muslo: { radio: 0.07, largo: 0.19 },
  canilla: { radio: 0.062, largo: 0.19 },
  /** El pie es una caja pegada a la canilla, un poco adelantada. */
  pie: { medioAncho: 0.065, medioAlto: 0.04, medioLargo: 0.1, adelante: 0.035 },
} as const;

/** Masas de cada parte, en kilos (unos 19 en total). */
export const MASAS = {
  pelvis: 4,
  torso: 6,
  cabeza: 3,
  brazo: 0.9,
  muslo: 1.2,
  canilla: 1,
} as const;

/** Inercia extra (kg·m²) que se suma a la de las formas. Un tronco con más inercia de la real gira más pesado, así
 * que el empuje de las piernas al dar el paso y el peso de la cabeza no lo voltean: es el truco de siempre para que
 * un ragdoll activo se vea firme sin ganancias enormes. */
export const INERCIA_EXTRA = {
  pelvis: 0.35,
  torso: 0.45,
  cabeza: 0.05,
} as const;

export const AJUSTES = {
  /** Suspensión: un rayo desde la pelvis al suelo y un resorte que la sostiene a la altura de estar de pie.
   * `frecuencia` (rad/s) y `amortiguacion` (1 = crítica) definen el resorte; la fuerza se escala con la masa total,
   * así que no cambia si cambian las masas. */
  suspension: {
    frecuencia: 9,
    amortiguacion: 0.8,
    /** Cuánto más allá de la altura de pie todavía cuenta como «en el suelo». */
    alcanceExtra: 0.25,
    /** Tope de la fuerza, en veces el peso del muñeco, para que un golpe contra el suelo no lo catapulte. */
    fuerzaMaxima: 3,
    /** Al caminar sube un poco la pelvis: así los pies no se arrastran contra el suelo y no lo frenan. */
    subirAlCaminar: 0.015,
  },

  /** Erguirse: cada parte del tronco recibe un torque PD que la lleva a estar derecha y mirando al rumbo.
   * Las ganancias son de aceleración (se multiplican por la inercia de cada cuerpo), con `frecuencia` en rad/s. */
  erguir: {
    pelvis: { frecuencia: 16, amortiguacion: 1 },
    torso: { frecuencia: 14, amortiguacion: 1 },
    cabeza: { frecuencia: 10, amortiguacion: 1 },
    /** Al caminar el torso se inclina hacia adelante, como quien va apurado. */
    inclinacionAlCaminar: 0.12,
  },

  /** Brazos: cuelgan con un torque PD suave respecto al torso y se balancean al revés que las piernas. */
  brazos: {
    frecuencia: 6,
    amortiguacion: 0.7,
    /** Separación de los brazos hacia afuera, para que no rocen la panza. */
    abrir: 0.12,
    balanceo: 0.5,
  },

  /** Andar: fuerza horizontal en la pelvis hacia la velocidad deseada (solo con los pies en el suelo). */
  andar: {
    velocidad: 1.6,
    /** Qué tan rápido alcanza la velocidad deseada (1/s). */
    respuesta: 8,
    /** Tope de la aceleración horizontal (m/s²). */
    aceleracionMaxima: 9,
    /** Velocidad de giro con `girar` = 1 (rad/s). */
    giro: 2.6,
  },

  /** Paso: las piernas se mueven con motores de posición en caderas y rodillas, al ritmo de la velocidad real. */
  paso: {
    /** Distancia que avanza el muñeco en un ciclo completo de dos pasos (m). */
    zancada: 0.62,
    /** Ritmo mínimo para dar pasitos al girar en el lugar (ciclos por segundo con girar = 1). */
    ritmoGiro: 1.4,
    /** Ángulo máximo de la cadera hacia adelante y atrás (rad). */
    cadera: 0.55,
    /** Cuánto dobla la rodilla la pierna que va por el aire (rad). */
    rodilla: 0.9,
    /** Velocidad a la que el paso llega a su amplitud completa (m/s). */
    velocidadPlena: 1,
    /** Motores (modelo de fuerza): rigidez en N·m/rad y amortiguación en N·m·s/rad. */
    rigidez: 220,
    amortiguacionMotor: 14,
  },

  /** Rozamiento de pies, manos y cuerpo. Los pies agarran poco: el peso lo carga la suspensión. */
  rozamiento: { pie: 0.6, cuerpo: 0.4 },

  /** Amortiguación general de cada cuerpo, para que el trapo no tiemble. */
  amortiguacion: { lineal: 0.05, angular: 0.6 },
} as const;
