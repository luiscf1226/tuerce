// Un intento de conexión directa (WebRTC) entre los dos. El anfitrión ofrece y el invitado responde; las señales
// (SDP y candidatos ICE) van por la sala. Abre dos canales ya acordados de antemano (sin `ondatachannel`):
//   · fiable: ordenado y con reenvíos, para botones, eventos y todo lo que no puede perderse;
//   · rápido: sin orden y sin reenvíos (`maxRetransmits: 0`), para las fotos de físicas: la vieja ya no sirve.
// Solo avisa dos cosas: que abrió (los dos canales listos) y que se cayó. Qué hacer con eso lo decide `conexion.ts`.
import type { Datos, Rol, Senal } from "./marco";

export interface OpcionesDirecta {
  rol: Rol;
  intento: string;
  iceServers: RTCIceServer[];
  /** Manda una señal al otro por la sala (ya trae `t` e `intento`). */
  enviarSenal(senal: Senal): void;
  alAbrir(): void;
  /** Se cayó o no pudo ser. Se llama una sola vez y después ya no avisa nada. */
  alCaer(motivo: string): void;
  alRecibir(datos: Datos, fiable: boolean): void;
  /**
   * Simula una red donde lo directo no pasa: no se cruzan candidatos ICE, así que nunca abre y vence la espera de
   * verdad. Para probar el repetidor (`?forzar=repetidor`).
   */
  bloquearIce?: boolean;
}

export interface Directa {
  readonly intento: string;
  recibirSenal(senal: Senal): void;
  /** Manda por el canal que toca. `false` si los canales no están abiertos o el rápido está atorado. */
  enviar(datos: Datos, fiable: boolean): boolean;
  cerrar(): void;
}

export type AbrirDirecta = (opciones: OpcionesDirecta) => Directa;

/** Si el canal rápido junta más que esto sin salir, la foto se tira: llegaría tarde. */
const ATORADO_BYTES = 64 * 1024;
/** `disconnected` a veces se arregla solo; si dura más que esto, se da por caída. */
const DESCONECTADA_MS = 3000;

export const abrirDirectaWebRTC: AbrirDirecta = (op) => {
  const pc = new RTCPeerConnection({ iceServers: op.iceServers });
  const fiable = pc.createDataChannel("fiable", { negotiated: true, id: 0, ordered: true });
  const rapido = pc.createDataChannel("rapido", { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
  let abierta = false;
  let terminada = false;
  let desconectada: ReturnType<typeof setTimeout> | undefined;
  // Las señales se atienden de a una: un candidato no puede entrar antes que la oferta que lo trae.
  let cola: Promise<void> = Promise.resolve();

  const senal = (resto: Omit<Senal, "t" | "intento">) => op.enviarSenal({ t: "senal", intento: op.intento, ...resto });

  const cerrar = () => {
    terminada = true;
    clearTimeout(desconectada);
    for (const canal of [fiable, rapido]) {
      canal.onopen = canal.onclose = canal.onmessage = null;
      canal.close();
    }
    pc.onicecandidate = pc.onconnectionstatechange = null;
    pc.close();
  };
  const caer = (motivo: string) => {
    if (terminada) return;
    cerrar();
    op.alCaer(motivo);
  };

  for (const canal of [fiable, rapido]) {
    canal.binaryType = "arraybuffer";
    canal.onopen = () => {
      if (abierta || terminada || fiable.readyState !== "open" || rapido.readyState !== "open") return;
      abierta = true;
      op.alAbrir();
    };
    canal.onclose = () => caer(`se cerró el canal ${canal.label}`);
    canal.onmessage = (e: MessageEvent<string | ArrayBuffer>) => op.alRecibir(e.data, canal === fiable);
  }

  pc.onicecandidate = (e) => {
    if (!e.candidate || op.bloquearIce) return;
    const { candidate, sdpMid, sdpMLineIndex } = e.candidate;
    senal({ candidato: { candidate, sdpMid, sdpMLineIndex } });
  };
  pc.onconnectionstatechange = () => {
    const estado = pc.connectionState;
    if (estado === "failed" || estado === "closed") caer(`conexión ${estado}`);
    clearTimeout(desconectada);
    if (estado === "disconnected") desconectada = setTimeout(() => caer("conexión perdida"), DESCONECTADA_MS);
  };

  const atender = async (s: Senal) => {
    if (s.sdp) {
      await pc.setRemoteDescription(s.sdp);
      if (s.sdp.type === "offer") {
        await pc.setLocalDescription();
        const { type, sdp } = pc.localDescription ?? {};
        if (type === "answer" && sdp) senal({ sdp: { type, sdp } });
      }
    }
    if (s.candidato && !op.bloquearIce) await pc.addIceCandidate(s.candidato);
  };
  const enCola = (trabajo: () => Promise<void>) => {
    cola = cola.then(trabajo).catch((error: unknown) => caer(`señal rechazada: ${String(error)}`));
  };

  if (op.rol === "anfitrion")
    enCola(async () => {
      await pc.setLocalDescription();
      const { type, sdp } = pc.localDescription ?? {};
      if (type === "offer" && sdp) senal({ sdp: { type, sdp } });
    });

  return {
    intento: op.intento,
    recibirSenal(s) {
      if (!terminada) enCola(() => (terminada ? Promise.resolve() : atender(s)));
    },
    enviar(datos, esFiable) {
      if (!abierta || terminada) return false;
      const canal = esFiable ? fiable : rapido;
      if (canal.readyState !== "open") return false;
      if (!esFiable && canal.bufferedAmount > ATORADO_BYTES) return true; // tirada a propósito, no es caída
      try {
        // Los tipos de DOM separan send(string) y send(ArrayBuffer); en tiempo de ejecución es el mismo.
        if (typeof datos === "string") canal.send(datos);
        else canal.send(datos);
        return true;
      } catch {
        return false;
      }
    },
    cerrar,
  };
};
