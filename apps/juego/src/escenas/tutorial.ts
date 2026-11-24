// Cómo jugar: el tutorial (`?escena=tutorial`). Un claro del pinar, como la escena `dos`, con seis lecciones en
// orden que la hoja de la misión (src/ui/mision.ts) explica arriba a la izquierda, con las teclas de cada jugador:
//
//   1. Caminen             cada uno se aleja un par de pasos de donde empezó
//   2. Salten              cada uno salta una vez
//   3. Agarren algo        cada uno agarra algo con una mano: una caja, el tronco, la mano del otro
//   4. Junten el cacao     las cinco mazorcas que flotan en el claro (objetos de misión: `semilla`)
//   5. Lleven el cántaro   pesa: entre los dos, del tocón al círculo de piedras (`encargo` y `entrega`)
//   6. Festejen            cada uno hace un gesto
//
// Al terminar, «¡Ya saben jugar!» con «Empezar la historia» (El patio) y «Menú»; queda anotado en este navegador
// y el menú deja de proponer el tutorial primero.
//
// Parámetros (además de los de `dos`: `&j1=`, `&j2=`, `&ayuda`):
//   &leccion=N   empieza en la lección N (1 a 6): las de antes cuentan como hechas (para las capturas)
import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { type CamaraDeDos, crearCamaraDeDos, despejadoEnElMundo, ENCUADRE } from "../camara";
import { crearAyuda } from "../entrada/ayuda";
import { crearControles, type EntradaJugador, entradaQuieta } from "../entrada/mandos";
import { parametrosDeLaDireccion } from "../entrada/teclado";
import {
  crearCapasDeNiebla,
  crearMata,
  crearPino,
  crearRoca,
  crearTroncoCaido,
  crearVelo,
  materialCorteza,
  materialOjo,
  materialPanuelo,
  materialTela,
  type Panuelo,
  vestirDeDia,
} from "../imagen";
import { crearEncargo, crearEntrega, crearSemillas } from "../misiones/objetos";
import { crearTablero, type Objetivo, porJugador, type Tablero } from "../misiones/tablero";
import { PASO } from "../motor/bucle";
import type { Rapier } from "../motor/fisica";
import { crearMallaMuneco, crearMuneco, type Muneco } from "../muneco";
import { PRIMER_NIVEL } from "../niveles/orden";
import { vestuarioDe } from "../ropero/vestuario";
import { crearJuego, crearSenas } from "../ui";
import { MENU, mostrarNivelGanado } from "../ui/llegada";
import { crearInterfaz } from "../ui/menu";
import { crearHojaDeMision } from "../ui/mision";
import { anotarTutorial } from "../ui/tutorial";
import { reaparecerSiCayeron } from "./borde";
import { crearCajas } from "./cajas";
import { COLORES } from "./colores";
import type { EscenaDeJuego } from "./index";

/** Dónde arranca cada muñeco: lado a lado, mirando hacia +x (como en `dos`). */
const SALIDAS = [
  { x: 0, z: 0.5, rumbo: Math.PI / 2 },
  { x: 0, z: -0.5, rumbo: Math.PI / 2 },
] as const;
const DIRECCION_CAMARA = new THREE.Vector3(0.45, 0.36, 1);
const NIEBLA = { cerca: 4, lejos: 26 };

/** Cuánto (m) tiene que alejarse cada uno de donde estaba al empezar la lección de caminar. */
export const PASOS_PARA_CAMINAR = 1.5;
/** El tocón del cántaro, adelante, entre los dos: a la altura de las manos alzadas, como el del huacal en `dos`. */
const TOCON = { x: 1.35, alto: 0.7, radio: 0.26 };
/** El círculo adonde va el cántaro, más adelante. */
export const ENTREGA = { x: 4.6, y: 0, z: 0, radio: 0.85 };
/** Las cinco mazorcas de cacao, repartidas por el claro (lejos de las salidas y del camino del cántaro). */
const CACAO = [
  { x: -1.8, y: 0, z: 1.6 },
  { x: -2.4, y: 0, z: -1.2 },
  { x: 2.2, y: 0, z: 2.0 },
  { x: 3.2, y: 0, z: -1.9 },
  { x: 6.0, y: 0, z: 1.8 },
] as const;
/** Si el cántaro se cae al suelo fuera del círculo y nadie lo toca, cuántos pasos hasta que vuelve al tocón. */
export const PASOS_PARA_VOLVER = 4 * 60;
/** Cuánto esperar (pasos) entre terminar y mostrar el panel. */
const ESPERA_FINAL = 75;
const CAMINAR = {
  rojo: "W S camina · A D gira",
  turquesa: "↑ ↓ camina · ← → gira",
  mando: "palanca",
  tactil: "arrastren la palanca",
} as const;

export type EscenaTutorial = EscenaDeJuego & {
  readonly munecos: readonly [Muneco, Muneco];
  readonly tablero: Tablero;
  readonly camaraDeDos: CamaraDeDos;
};

export function crearEscenaTutorial(
  rapier: Rapier,
  mundo: RAPIER.World,
  parametros: URLSearchParams = parametrosDeLaDireccion(),
): EscenaTutorial {
  const escena = new THREE.Scene();
  vestirDeDia(escena, { cerca: NIEBLA.cerca, lejos: NIEBLA.lejos });
  const conPantalla = typeof document !== "undefined";

  // El suelo del claro
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 120),
    new THREE.MeshStandardMaterial({
      name: "suelo",
      color: new THREE.Color(COLORES.niebla).multiplyScalar(0.8),
      roughness: 1,
      metalness: 0,
    }),
  );
  suelo.rotation.x = -Math.PI / 2;
  escena.add(suelo);
  mundo.createCollider(rapier.ColliderDesc.cuboid(60, 0.5, 60).setTranslation(0, -0.5, 0).setFriction(0.8));

  const vestir = (indice: 0 | 1, panuelo: Panuelo) => {
    const salida = SALIDAS[indice];
    const muneco = crearMuneco(rapier, mundo, {
      posicion: { x: salida.x, y: 0, z: salida.z },
      rumbo: salida.rumbo,
      indice,
    });
    const malla = crearMallaMuneco(
      muneco,
      {
        cuerpo: materialTela(COLORES.silueta, { repetir: 1, relieve: 2.5 }),
        panuelo: materialPanuelo(panuelo, { repetir: 2 }),
        ojos: materialOjo(),
      },
      vestuarioDe(parametros, indice),
    );
    escena.add(malla.grupo);
    return { muneco, malla };
  };
  const jugadores = [vestir(0, "rojo"), vestir(1, "turquesa")] as const;
  const munecos = [jugadores[0].muneco, jugadores[1].muneco] as const;

  const controles = crearControles({ parametros });
  if (conPantalla && parametros.has("ayuda")) crearAyuda(controles, { siempre: true });
  // El tutorial arranca jugando: la hoja de la misión ya dice qué hacer. La pausa (Esc, P o Start) abre el menú.
  const juego = crearJuego("jugando");
  // La pausa muestra la lección de turno (la hoja se arma más abajo y se pide al abrirla)
  const interfaz = conPantalla ? crearInterfaz(juego, controles, { mision: () => hoja?.resumen() ?? null }) : undefined;
  const quietas = [entradaQuieta(), entradaQuieta()] as const;
  const senas = crearSenas(rapier, mundo, escena, munecos);

  // Las cosas del claro: el tocón con el cántaro, dos cajas chicas para practicar el agarre y un tronco caído
  const corteza = materialCorteza(COLORES.silueta, { repetir: [1, 1] });
  const tocon = new THREE.Mesh(new THREE.CylinderGeometry(TOCON.radio, TOCON.radio * 1.15, TOCON.alto, 14), corteza);
  tocon.position.set(TOCON.x, TOCON.alto / 2, 0);
  escena.add(tocon);
  mundo.createCollider(
    rapier.ColliderDesc.cylinder(TOCON.alto / 2, TOCON.radio).setTranslation(TOCON.x, TOCON.alto / 2, 0),
  );
  const cantaro = crearEncargo(rapier, mundo, escena, {
    forma: "cantaro",
    posicion: { x: TOCON.x, y: TOCON.alto, z: 0 },
  });
  const entrega = crearEntrega(escena, ENTREGA, ENTREGA.radio);
  const semillas = crearSemillas(escena, CACAO);
  const cajas = crearCajas(rapier, mundo, escena, corteza);
  // Lejos de las mazorcas: si una caja queda debajo de una, los muñecos chocan con ella y no llegan al cacao
  cajas.poner(-0.7, 0.2, 2.4, 0.4, 3, 0.4);
  cajas.poner(-0.9, 0.18, -2.5, 0.36, 2, -0.3);

  const tronco = crearTroncoCaido({ largo: 7, radio: 0.22, semilla: 5, largoMusgo: 0.2, musgo: 30 });
  tronco.position.set(1.5, 0.2, -4.6);
  tronco.rotation.y = 0.18;
  escena.add(tronco);
  mundo.createCollider(
    rapier.ColliderDesc.capsule(3.5, 0.22)
      .setTranslation(1.5, 0.2, -4.6)
      .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.18, Math.PI / 2))),
  );
  const pinos: [number, number, number][] = [
    [-4.6, -2.8, 0.34],
    [8.4, -4.5, 0.38],
    [-1.5, -7.5, 0.32],
    [3.6, -9, 0.4],
    [-7, -9.5, 0.42],
    [9.5, -11, 0.36],
  ];
  pinos.forEach(([x, z, radio], i) => {
    const pino = crearPino({ alto: 18, radio, semilla: 80 + i, ramasDesde: 0.3, largoRama: 2.4 });
    pino.position.set(x, 0, z);
    escena.add(pino);
  });
  for (const [x, z, radio, semilla] of [
    [-3.2, -1.9, 0.3, 71],
    [7.4, -1.8, 0.45, 72],
    [-5.5, 1.5, 0.6, 73],
  ] as const) {
    const roca = crearRoca(radio, semilla);
    roca.position.set(x, -radio * 0.15, z);
    escena.add(roca);
  }
  for (const [x, z, alto, semilla] of [
    [-4, 3.4, 1.2, 21],
    [8, 3, 1.1, 22],
    [5.6, -3.6, 0.6, 23],
  ] as const) {
    const mata = crearMata(alto, semilla);
    mata.position.set(x, 0, z);
    escena.add(mata);
  }
  const niebla = crearCapasDeNiebla([
    { y: 0.4, z: -5, ancho: 22, alto: 2.5, opacidad: 0.4, velocidad: 0.12 },
    { y: 1.2, z: -8.5, ancho: 28, alto: 8, opacidad: 0.55, velocidad: -0.15 },
    { y: 2, z: -13, ancho: 36, alto: 12, opacidad: 0.65, velocidad: 0.22 },
  ]);
  escena.add(niebla.grupo);
  escena.add(crearVelo({ y: 5, z: -7, ancho: 28, alto: 9, opacidad: 0.75 }));

  // ── Las lecciones ──────────────────────────────────────────────────────────────────────────────────────────
  /** Lo que pidió cada jugador en el último paso (para saber si hizo un gesto). */
  let ultimas: readonly [EntradaJugador, EntradaJugador] = quietas;
  const desde = [new THREE.Vector3(), new THREE.Vector3()] as const;
  const caminar = porJugador((j) => {
    const p = munecos[j].partes.pelvis.translation();
    return Math.hypot(p.x - desde[j].x, p.z - desde[j].z) >= PASOS_PARA_CAMINAR;
  });
  const saltar = porJugador((j) => munecos[j].estado === "en el aire");
  const agarrar = porJugador(
    (j) => munecos[j].agarrado("brazoIzquierdo") !== null || munecos[j].agarrado("brazoDerecho") !== null,
  );
  const festejar = porJugador((j) => ultimas[j].gesto !== null);
  /** Si el cántaro sigue arriba del tocón (más o menos donde empezó). */
  const enElTocon = () => {
    const p = cantaro.cuerpo.translation();
    return Math.hypot(p.x - TOCON.x, p.z) < TOCON.radio + 0.1 && p.y > TOCON.alto;
  };
  /** Desde qué paso está el cántaro tirado en el suelo, fuera del círculo y sin nadie que lo agarre. */
  let tiradoDesde: number | undefined;

  const lecciones: Objetivo[] = [
    {
      id: "caminar",
      titulo: "Caminen",
      texto: "Cada uno da unos pasos por el claro. Se camina adelante y atrás, y se gira a los lados.",
      teclas: CAMINAR,
      empezar() {
        for (const j of [0, 1] as const) desde[j].copy(munecos[j].partes.pelvis.translation());
      },
      medir: caminar.medir,
    },
    {
      id: "saltar",
      titulo: "Salten",
      texto: "Cada uno salta una vez. Saltando se sube a lo bajo y se cruzan los huecos chicos.",
      teclas: { rojo: "Espacio", turquesa: "Enter", mando: "A", tactil: "botón Saltar" },
      medir: saltar.medir,
    },
    {
      id: "agarrar",
      titulo: "Agarren algo",
      texto:
        "Mantengan un brazo arriba y toquen algo: una caja, el tronco o la mano del otro. La mano agarra mientras sostengan el brazo arriba.",
      teclas: {
        rojo: "Q brazo izq. · E der.",
        turquesa: ", brazo izq. · . der.",
        mando: "LB · RB",
        tactil: "sostengan Agarrar",
      },
      medir: agarrar.medir,
    },
    {
      id: "cacao",
      titulo: "Junten el cacao",
      texto: "Hay cinco mazorcas flotando por el claro. Lo que lleva una banda clara es de la misión: tóquenlas.",
      teclas: CAMINAR,
      medir: () => ({ hecho: semillas.juntadas >= semillas.total, cuenta: semillas.juntadas, total: semillas.total }),
    },
    {
      id: "cantaro",
      titulo: "Lleven el cántaro",
      texto:
        "Pesa mucho para uno solo. Párense a cada lado del tocón, agárrenlo con el brazo de adentro y llévenlo juntos al círculo de piedras.",
      teclas: {
        rojo: "Q (brazo izq.) + caminar",
        turquesa: ". (brazo der.) + caminar",
        mando: "LB o RB + palanca",
        tactil: "sostengan Agarrar + palanca",
      },
      // Si al juntar el cacao alguien lo tiró, la lección empieza con el cántaro de vuelta en el tocón
      empezar() {
        if (!enElTocon()) cantaro.volver();
        tiradoDesde = undefined;
      },
      medir: () => {
        const adentro = entrega.contiene(cantaro.cuerpo);
        entrega.llenar(adentro);
        return { hecho: adentro };
      },
    },
    {
      id: "festejar",
      titulo: "Festejen",
      texto:
        "Los gestos sirven para entenderse sin hablar: tecla de gesto y una dirección. Adelante festeja, atrás se encoge, a los lados saluda o llama.",
      teclas: { rojo: "X + W A S D", turquesa: "Shift der. + flechas", mando: "X + palanca", tactil: "botón ¡Eh!" },
      medir: festejar.medir,
    },
  ];
  // `&leccion=N`: las de antes cuentan como hechas
  const saltear = Math.max(0, Math.min(lecciones.length, Number(parametros.get("leccion") ?? 1) - 1 || 0));
  const objetivos = lecciones.map((l, i) => (i < saltear ? { ...l, medir: () => ({ hecho: true }) } : l));
  const tablero = crearTablero(objetivos, { enOrden: true });
  const hoja = conPantalla
    ? crearHojaDeMision(tablero, { titulo: "Cómo jugar", modo: "lecciones", tactil: controles.tactil })
    : undefined;
  const FESTEJOS = ["¡Eso!", "¡Bien!", "¡Así se hace!", "¡De a dos!", "¡Listo!", "¡Ya está!"];
  let festejos = 0;
  tablero.alCambiar((cumplido) => {
    if (cumplido && pasos > 1) hoja?.festejar(FESTEJOS[festejos++ % FESTEJOS.length] ?? "¡Bien!");
  });

  const camaraDeDos = crearCamaraDeDos({ direccion: DIRECCION_CAMARA, despejado: despejadoEnElMundo(rapier, mundo) });
  const camara = camaraDeDos.camara;
  const seguirConLaCamara = () =>
    camaraDeDos.seguir(munecos[0].partes.pelvis.translation(), munecos[1].partes.pelvis.translation());
  seguirConLaCamara();

  let pasos = 0;
  let terminoEn: number | undefined;
  let conElPanel = false;
  const mostrarFin = () => {
    conElPanel = true;
    anotarTutorial();
    mostrarNivelGanado({
      ceja: "Cómo jugar",
      nombre: "¡Ya saben jugar!",
      nota: "Ahora, la historia: El patio, Tegucigalpa, la mañana del 31 de diciembre.",
      acciones: [
        { texto: "Empezar la historia", fuerte: true, href: `?escena=nivel&nivel=${PRIMER_NIVEL}&jugar` },
        { texto: "Menú", href: MENU },
      ],
    });
  };

  return {
    nombre: "tutorial",
    escena,
    camara,
    vistas: camaraDeDos.vistas,
    camaraDeDos,
    juego,
    ...(interfaz ? { interfaz } : {}),
    munecos,
    tablero,
    // Lo que falta: las mazorcas que quedan y, en la lección del cántaro, el cántaro
    pendientes: () => {
      if (tablero.objetivos[tablero.actual]?.id === "cantaro") {
        const p = cantaro.cuerpo.translation();
        return [{ x: p.x, z: p.z }];
      }
      return semillas.quedan().flatMap((i) => (CACAO[i] ? [{ x: CACAO[i].x, z: CACAO[i].z }] : []));
    },
    pasar() {
      cajas.guardar();
      cantaro.guardar();
      const leidas = juego.atienden && !conElPanel ? controles.leer() : quietas;
      ultimas = leidas;
      munecos[0].pasar(senas.entrada(0, leidas[0]));
      munecos[1].pasar(senas.entrada(1, leidas[1]));
      mundo.step();
      // El que se cae por el borde del claro vuelve a donde empezó (la malla salta, sin dibujar el viaje)
      reaparecerSiCayeron(munecos, SALIDAS, (j) => jugadores[j].malla.guardar());
      semillas.pasar(munecos);
      tablero.pasar();
      // En la lección del cántaro, si se cae y nadie lo levanta, vuelve solo al tocón
      if (tablero.objetivos[tablero.actual]?.id === "cantaro") {
        const tirado =
          cantaro.cuerpo.translation().y < TOCON.alto * 0.6 &&
          !entrega.contiene(cantaro.cuerpo) &&
          cantaro.cargadores(munecos) === 0;
        if (!tirado) tiradoDesde = undefined;
        else if (tiradoDesde === undefined) tiradoDesde = pasos;
        else if (pasos - tiradoDesde >= PASOS_PARA_VOLVER) {
          cantaro.volver();
          tiradoDesde = undefined;
          hoja?.festejar("El cántaro volvió al tocón");
        }
      }
      if (tablero.terminado) terminoEn ??= pasos;
      if (conPantalla && !conElPanel && terminoEn !== undefined && pasos - terminoEn >= ESPERA_FINAL) mostrarFin();
      senas.apuntar();
      jugadores[0].malla.guardar();
      jugadores[1].malla.guardar();
      seguirConLaCamara();
      pasos++;
    },
    dibujar(alfa) {
      jugadores[0].malla.dibujar(alfa);
      jugadores[1].malla.dibujar(alfa);
      cajas.dibujar(alfa);
      cantaro.dibujar(alfa);
      camaraDeDos.dibujar(alfa);
      if (escena.fog instanceof THREE.Fog) {
        escena.fog.near = NIEBLA.cerca + camaraDeDos.distancia - ENCUADRE.cerca;
        escena.fog.far = NIEBLA.lejos + camaraDeDos.distancia - ENCUADRE.cerca;
      }
      const segundos = (pasos - 1 + alfa) * PASO;
      niebla.mover(segundos);
      senas.dibujar(segundos);
      semillas.dibujar(segundos);
      entrega.dibujar(segundos);
    },
  };
}
