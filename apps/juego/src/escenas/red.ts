// Pantalla de depuración de la red (`?escena=red`): muestra el estado de la conexión entre los dos y el ida y vuelta
// (ping) medido por el canal rápido. No dibuja muñecos.
//
// Parámetros: ?escena=red&sala=<url de la sala>&pase=<pase>
//   sala        p. ej. http://127.0.0.1:8798/sala/prueba-1 (la sala de `pnpm sala:dev`)
//   pase        firmado con el SALA_SECRETO de esa sala
//   forzar      `repetidor` para simular una red donde lo directo no pasa
//   espera      ms de espera de lo directo (5000)
//   reintentar  ms antes de reintentar lo directo después de una caída (10000)
//
// En local: `pnpm sala:dev` en una terminal, `pnpm --filter tuerce-juego dev` en otra y `pnpm red:local`, que firma
// dos pases con el secreto de workers/sala/.dev.vars y escribe las dos direcciones para abrir (una por jugador).
// La prueba `pnpm prueba:red` hace lo mismo sola y usa `window.__red`.

import { publicarEstado } from "../estado";
import { type Conexion, conectar, type Datos, type EstadoRed, type Via } from "../red";

/** Lo que la pantalla deja ver a las pruebas en Chromium. */
export interface EstadoRedPrueba {
  estado: EstadoRed | "sin_sala";
  estados: string[];
  rol?: string;
  /** Último ida y vuelta por el canal rápido, en ms. */
  ida?: number;
  recibidos: { datos: string; binario: boolean; via: Via }[];
  enviar(datos: string, fiable: boolean, binario?: boolean): void;
  cortarDirecta(): void;
  cerrar(): void;
}

declare global {
  interface Window {
    __red?: EstadoRedPrueba;
  }
}

// Ping y pong: 9 bytes, la marca y la hora de salida (que el pong devuelve tal cual).
const PING = 0x70;
const PONG = 0x71;

const texto = new TextDecoder();
const codificar = new TextEncoder();

export async function abrirRed(): Promise<void> {
  const parametros = new URLSearchParams(location.search);
  const estadoJuego = publicarEstado({ escena: "red", listo: false, pasosTotales: 0, pasosPorSegundo: 0 });
  const panel = document.body.appendChild(document.createElement("main"));
  panel.className = "entrar red";
  const titulo = panel.appendChild(document.createElement("h1"));
  titulo.textContent = "Red";
  const lineaEstado = panel.appendChild(document.createElement("p"));
  lineaEstado.className = "red-estado";
  const lineaIda = panel.appendChild(document.createElement("p"));
  const lineaUltimo = panel.appendChild(document.createElement("p"));

  const prueba: EstadoRedPrueba = {
    estado: "sin_sala",
    estados: [],
    recibidos: [],
    enviar: () => {},
    cortarDirecta: () => {},
    cerrar: () => {},
  };
  window.__red = prueba;

  const urlSala = parametros.get("sala");
  const pase = parametros.get("pase");
  if (!urlSala || !pase) {
    lineaEstado.textContent = "Falta ?sala=<url de la sala>&pase=<pase>. Ver src/escenas/red.ts.";
    estadoJuego.listo = true;
    return;
  }
  const numero = (nombre: string) => {
    const valor = Number(parametros.get(nombre) ?? Number.NaN);
    return Number.isFinite(valor) ? valor : undefined;
  };

  let conexion: Conexion;
  try {
    conexion = await conectar({
      urlSala,
      pase,
      forzar: parametros.get("forzar") === "repetidor" ? "repetidor" : undefined,
      esperaDirectaMs: numero("espera"),
      reintentarDirectaMs: numero("reintentar"),
    });
  } catch (error) {
    lineaEstado.textContent = String(error instanceof Error ? error.message : error);
    estadoJuego.listo = true;
    return;
  }

  const mostrar = (estado: EstadoRed) => {
    prueba.estado = estado;
    prueba.estados.push(estado);
    lineaEstado.textContent = `${conexion.rol} · ${estado}`;
    lineaEstado.dataset.estado = estado;
  };
  prueba.rol = conexion.rol;
  mostrar(conexion.estado);
  conexion.alCambiarEstado(mostrar);

  conexion.alRecibir((datos: Datos, via: Via) => {
    if (typeof datos !== "string") {
      const vista = new DataView(datos);
      const marca = datos.byteLength === 9 ? vista.getUint8(0) : undefined;
      if (marca === PING) {
        const pong = datos.slice(0);
        new DataView(pong).setUint8(0, PONG);
        conexion.enviar(pong, { fiable: false });
        return;
      }
      if (marca === PONG) {
        prueba.ida = Math.round((performance.now() - vista.getFloat64(1)) * 10) / 10;
        lineaIda.textContent = `ida y vuelta: ${prueba.ida} ms (${via})`;
        return;
      }
    }
    const binario = typeof datos !== "string";
    const leido = binario ? texto.decode(datos) : datos;
    prueba.recibidos.push({ datos: leido, binario, via });
    lineaUltimo.textContent = `llegó «${leido}» por ${via}`;
  });

  prueba.enviar = (datos, fiable, binario = false) =>
    conexion.enviar(binario ? codificar.encode(datos).buffer : datos, { fiable });
  prueba.cortarDirecta = () => conexion.cortarDirecta();
  prueba.cerrar = () => conexion.cerrar();

  setInterval(() => {
    const ping = new ArrayBuffer(9);
    const vista = new DataView(ping);
    vista.setUint8(0, PING);
    vista.setFloat64(1, performance.now());
    conexion.enviar(ping, { fiable: false });
  }, 500);
  estadoJuego.listo = true;
}
