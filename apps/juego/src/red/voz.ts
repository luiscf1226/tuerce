// Voz entre los dos (TU-34): opcional, directa entre la pareja y sin guardarse.
//
//   · Apagada al empezar. Cada uno prende su micrófono con el botón (getUserMedia); el otro lo escucha sin tener que
//     prender el suyo.
//   · Va por una conexión WebRTC propia, solo de audio, aparte de la de los datos: así prender o apagar la voz no toca
//     los canales de la partida. Sus señales (SDP y candidatos) viajan como texto por el canal fiable, que mientras
//     la conexión es directa ya va directo; los datos de la partida son binarios, así que no se mezclan. Usa los
//     mismos servidores ICE que los datos.
//   · Solo directa: si la conexión pasó al repetidor (la sala), la voz se corta y queda «no disponible» hasta que
//     vuelva lo directo; nunca pasa audio por la sala.
//   · Nada se graba ni se guarda: el audio va de un navegador al otro y se reproduce en un <audio>; no hay
//     MediaRecorder ni copia en ningún lado. Al apagar, la pista del micrófono se detiene (se apaga la luz del
//     navegador).
//
// Las dos puntas pueden querer negociar a la vez (las dos prenden el micrófono juntas): se usa la «negociación
// perfecta» de WebRTC, donde el invitado cede (es el «educado») y el anfitrión no.
import type { Conexion, EstadoRed } from "./conexion";

export type EstadoVoz = "no_disponible" | "apagada" | "pidiendo" | "encendida" | "sin_permiso";

/** Lo que la voz usa de la conexión. */
export type ConexionVoz = Pick<Conexion, "rol" | "estado" | "enviar" | "alRecibir" | "alCambiarEstado"> &
  Partial<Pick<Conexion, "servidoresIce">>;

export interface OpcionesVoz {
  /** El micrófono; por omisión `navigator.mediaDevices.getUserMedia`. */
  pedirMicrofono?: () => Promise<MediaStream>;
  crearConexion?: (configuracion: RTCConfiguration) => RTCPeerConnection;
  /** Qué hacer con el audio del otro; por omisión, un <audio> que lo reproduce. */
  reproducir?: (audio: MediaStream | null) => void;
}

export interface Voz {
  readonly estado: EstadoVoz;
  /** Pistas de audio del otro que llegaron y siguen vivas. */
  readonly pistasRemotas: number;
  /** Prende el micrófono (pide permiso la primera vez). */
  prender(): Promise<void>;
  apagar(): void;
  alCambiar(oyente: (estado: EstadoVoz) => void): () => void;
  cerrar(): void;
}

interface SenalVoz {
  voz: 1;
  descripcion?: RTCSessionDescriptionInit;
  candidato?: RTCIceCandidateInit;
  /** El otro cerró su conexión de voz: se cierra la propia, para empezar limpia la próxima vez. */
  fin?: true;
}

function leerSenal(texto: string): SenalVoz | null {
  try {
    const valor = JSON.parse(texto) as Partial<SenalVoz> | null;
    return valor && valor.voz === 1 ? (valor as SenalVoz) : null;
  } catch {
    return null;
  }
}

function reproducirEnPagina(): (audio: MediaStream | null) => void {
  let elemento: HTMLAudioElement | undefined;
  return (audio) => {
    if (!audio) {
      if (elemento) elemento.srcObject = null;
      return;
    }
    elemento ??= document.body.appendChild(document.createElement("audio"));
    elemento.autoplay = true;
    elemento.srcObject = audio;
    void elemento.play().catch(() => {
      /* sin un gesto del usuario el navegador puede no dejar: suena al primer toque o tecla */
    });
  };
}

export function crearVoz(conexion: ConexionVoz, op: OpcionesVoz = {}): Voz {
  const pedirMicrofono =
    op.pedirMicrofono ??
    (() =>
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      }));
  const crearConexion = op.crearConexion ?? ((c: RTCConfiguration) => new RTCPeerConnection(c));
  const reproducir = op.reproducir ?? reproducirEnPagina();
  const educado = conexion.rol === "invitado";

  let estado: EstadoVoz = conexion.estado === "directa" ? "apagada" : "no_disponible";
  let pc: RTCPeerConnection | undefined;
  let abriendo: Promise<RTCPeerConnection> | undefined;
  let emisor: RTCRtpSender | undefined;
  let microfono: MediaStream | undefined;
  let pistasRemotas = 0;
  let haciendoOferta = false;
  let ignorarOferta = false;
  let cerrada = false;
  let cola: Promise<void> = Promise.resolve();
  const oyentes = new Set<(estado: EstadoVoz) => void>();

  /** Para leerlo después de un `await` (TypeScript no sabe que pudo cambiar mientras tanto). */
  const estadoActual = (): EstadoVoz => estado;
  const cambiar = (nuevo: EstadoVoz) => {
    if (nuevo === estado) return;
    estado = nuevo;
    for (const oyente of oyentes) oyente(estado);
  };
  const mandar = (senal: Omit<SenalVoz, "voz">) => {
    if (conexion.estado !== "directa") return;
    conexion.enviar(JSON.stringify({ voz: 1, ...senal }), { fiable: true });
  };

  const soltarMicrofono = () => {
    for (const pista of microfono?.getTracks() ?? []) pista.stop();
    microfono = undefined;
  };

  /** Cierra la conexión de voz (y el micrófono). La próxima vez se arma de nuevo. */
  const cerrarConexion = (avisar: boolean) => {
    soltarMicrofono();
    if (pc) {
      pc.ontrack = pc.onicecandidate = pc.onnegotiationneeded = pc.onconnectionstatechange = null;
      pc.close();
      if (avisar) mandar({ fin: true });
    }
    pc = undefined;
    abriendo = undefined;
    emisor = undefined;
    pistasRemotas = 0;
    reproducir(null);
  };

  const abrir = (): Promise<RTCPeerConnection> => {
    if (pc) return Promise.resolve(pc);
    abriendo ??= (async () => {
      const iceServers = (await conexion.servidoresIce?.().catch(() => [])) ?? [];
      const nueva = crearConexion({ iceServers });
      nueva.onicecandidate = (e) => {
        if (e.candidate) mandar({ candidato: e.candidate.toJSON() });
      };
      nueva.onnegotiationneeded = async () => {
        try {
          haciendoOferta = true;
          await nueva.setLocalDescription();
          if (nueva.localDescription) mandar({ descripcion: nueva.localDescription.toJSON() });
        } catch (error) {
          console.warn("Tuerce · voz: no se pudo ofrecer", error);
        } finally {
          haciendoOferta = false;
        }
      };
      nueva.ontrack = (e) => {
        pistasRemotas++;
        e.track.addEventListener("ended", () => {
          pistasRemotas = Math.max(0, pistasRemotas - 1);
        });
        reproducir(e.streams[0] ?? new MediaStream([e.track]));
      };
      nueva.onconnectionstatechange = () => {
        if (nueva.connectionState === "failed") {
          console.info("Tuerce · voz: la conexión de voz falló; se cierra");
          cerrarConexion(true);
          if (estado === "encendida") cambiar("apagada");
        }
      };
      pc = nueva;
      return nueva;
    })();
    return abriendo;
  };

  const atender = async (senal: SenalVoz) => {
    if (senal.fin) {
      const tenia = estado === "encendida";
      cerrarConexion(false);
      // Si yo hablaba, vuelvo a ofrecer con una conexión nueva
      if (tenia) {
        cambiar("apagada");
        await prender();
      }
      return;
    }
    const actual = await abrir();
    if (senal.descripcion) {
      const choque = senal.descripcion.type === "offer" && (haciendoOferta || actual.signalingState !== "stable");
      ignorarOferta = !educado && choque;
      if (ignorarOferta) return;
      await actual.setRemoteDescription(senal.descripcion);
      if (senal.descripcion.type === "offer") {
        await actual.setLocalDescription();
        if (actual.localDescription) mandar({ descripcion: actual.localDescription.toJSON() });
      }
    } else if (senal.candidato) {
      try {
        await actual.addIceCandidate(senal.candidato);
      } catch (error) {
        if (!ignorarOferta) throw error;
      }
    }
  };

  const dejarDeEscuchar = conexion.alRecibir((datos, via) => {
    if (typeof datos !== "string" || via === "repetidor" || cerrada) return;
    const senal = leerSenal(datos);
    if (!senal) return;
    cola = cola
      .then(() => atender(senal))
      .catch((error: unknown) => console.warn("Tuerce · voz: señal rechazada", error));
  });

  const dejarDeMirar = conexion.alCambiarEstado((red: EstadoRed) => {
    if (red === "directa") {
      if (estado === "no_disponible") cambiar("apagada");
      return;
    }
    // Sin lo directo no hay voz: nunca va por la sala
    cerrarConexion(false);
    cambiar("no_disponible");
  });

  async function prender(): Promise<void> {
    if (cerrada || estado === "encendida" || estado === "pidiendo") return;
    if (conexion.estado !== "directa") {
      cambiar("no_disponible");
      return;
    }
    cambiar("pidiendo");
    try {
      microfono = await pedirMicrofono();
    } catch (error) {
      console.info("Tuerce · voz: sin micrófono", error);
      cambiar("sin_permiso");
      return;
    }
    const pista = microfono.getAudioTracks()[0];
    // Mientras se pedía el permiso pudo apagarse, cortarse lo directo o cerrarse todo
    if (estadoActual() !== "pidiendo") {
      soltarMicrofono();
      return;
    }
    if (!pista || conexion.estado !== "directa" || cerrada) {
      soltarMicrofono();
      cambiar(conexion.estado === "directa" ? "sin_permiso" : "no_disponible");
      return;
    }
    const actual = await abrir();
    if (emisor) await emisor.replaceTrack(pista);
    else emisor = actual.addTrack(pista, microfono);
    cambiar("encendida");
  }

  return {
    get estado() {
      return estado;
    },
    get pistasRemotas() {
      return pistasRemotas;
    },
    prender,
    apagar() {
      if (estado !== "encendida" && estado !== "pidiendo") return;
      soltarMicrofono();
      // Sin renegociar: el otro deja de recibir sonido, la conexión queda para la próxima
      void emisor?.replaceTrack(null);
      cambiar("apagada");
    },
    alCambiar(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },
    cerrar() {
      cerrada = true;
      dejarDeEscuchar();
      dejarDeMirar();
      cerrarConexion(true);
    },
  };
}
