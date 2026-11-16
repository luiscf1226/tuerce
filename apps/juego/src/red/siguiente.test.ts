// Pasar juntos al nivel siguiente (TU-57) con un enlace de mentira: el anfitrión elige, el invitado contesta y se va
// primero, y el anfitrión lo sigue. También con paquetes perdidos y con el invitado recargando en medio.
import { describe, expect, it } from "vitest";
import type { Datos, Rol } from "./marco";
import { escribirSiguiente, leerSiguiente, TIPO_FOTO, TIPO_SIGUIENTE, TIPO_VOY, tipoDe } from "./paquetes";
import { crearSiguiente, ESPERA_IR, REPETIR_SIGUIENTE, type Siguiente } from "./siguiente";
import type { Enlace } from "./sincronia";

/** Dos puntas que entregan al instante, salvo lo que `perder` decida tirar. Un oyente nuevo reemplaza a la página
 * vieja de esa punta (como al recargar). */
function crearPar(perder: (datos: ArrayBuffer, de: Rol) => boolean = () => false) {
  const oyentes: Record<Rol, Set<(d: Datos) => void>> = { anfitrion: new Set(), invitado: new Set() };
  const enviados: Record<Rol, number[]> = { anfitrion: [], invitado: [] };
  const punta = (rol: Rol, otro: Rol): Enlace => ({
    enviar(datos) {
      enviados[rol].push(tipoDe(datos) ?? -1);
      if (perder(datos, rol)) return;
      for (const o of oyentes[otro]) o(datos.slice(0));
    },
    alRecibir(oyente) {
      oyentes[rol].add(oyente);
      return () => oyentes[rol].delete(oyente);
    },
  });
  return { anfitrion: punta("anfitrion", "invitado"), invitado: punta("invitado", "anfitrion"), enviados };
}

function pagina(rol: Rol, enlace: Enlace, actual: number) {
  const idas: number[] = [];
  const avisos: number[] = [];
  const siguiente = crearSiguiente({
    rol,
    enlace,
    actual,
    ir: (n) => idas.push(n),
    alSeguir: (n) => avisos.push(n),
  });
  return { siguiente, idas, avisos };
}

const pasar = (pasos: number, ...paginas: { siguiente: Siguiente }[]) => {
  for (let i = 0; i < pasos; i++) for (const p of paginas) p.siguiente.paso();
};

describe("siguiente nivel en línea", () => {
  it("los paquetes llevan el número del nivel y no se confunden con otros", () => {
    expect(leerSiguiente(escribirSiguiente(TIPO_SIGUIENTE, 16), TIPO_SIGUIENTE)).toBe(16);
    expect(leerSiguiente(escribirSiguiente(TIPO_VOY, 1), TIPO_VOY)).toBe(1);
    expect(leerSiguiente(escribirSiguiente(TIPO_VOY, 1), TIPO_SIGUIENTE)).toBeNull();
    expect(leerSiguiente(new Uint8Array([TIPO_FOTO, 1]).buffer, TIPO_SIGUIENTE)).toBeNull();
    expect(leerSiguiente(new Uint8Array([TIPO_SIGUIENTE]).buffer, TIPO_SIGUIENTE)).toBeNull();
  });

  it("el anfitrión elige, el invitado contesta y se va primero, y el anfitrión lo sigue", () => {
    const red = crearPar();
    const anfitrion = pagina("anfitrion", red.anfitrion, 0);
    const invitado = pagina("invitado", red.invitado, 0);
    expect(anfitrion.siguiente.pedir(1)).toBe(true);
    // El invitado ya contestó y avisa, pero espera unos pasos para que el «voy» salga antes de irse
    expect(red.enviados.invitado).toEqual([TIPO_VOY]);
    expect(invitado.avisos).toEqual([1]);
    expect(invitado.siguiente.yendo).toBe(1);
    // Con el «voy», el anfitrión se va (una sola vez)
    expect(anfitrion.idas).toEqual([1]);
    pasar(ESPERA_IR - 1, invitado);
    expect(invitado.idas).toEqual([]);
    pasar(1, invitado);
    expect(invitado.idas).toEqual([1]);
    pasar(REPETIR_SIGUIENTE * 3, anfitrion, invitado);
    expect(anfitrion.idas).toEqual([1]);
    expect(invitado.idas).toEqual([1]);
    expect(red.enviados.anfitrion).toEqual([TIPO_SIGUIENTE]);
  });

  it("el invitado no elige: su botón no manda nada", () => {
    const red = crearPar();
    const anfitrion = pagina("anfitrion", red.anfitrion, 3);
    const invitado = pagina("invitado", red.invitado, 3);
    expect(invitado.siguiente.pedir(4)).toBe(false);
    pasar(REPETIR_SIGUIENTE * 2, anfitrion, invitado);
    expect(red.enviados.invitado).toEqual([]);
    expect(anfitrion.idas).toEqual([]);
    expect(invitado.idas).toEqual([]);
  });

  it("si el pedido o la respuesta se pierden, el anfitrión lo repite hasta que le contestan", () => {
    let perdidos = 0;
    const red = crearPar((_, de) => de === "anfitrion" && perdidos++ < 2);
    const anfitrion = pagina("anfitrion", red.anfitrion, 5);
    const invitado = pagina("invitado", red.invitado, 5);
    anfitrion.siguiente.pedir(6);
    pasar(REPETIR_SIGUIENTE, anfitrion, invitado);
    expect(invitado.idas).toEqual([]);
    expect(anfitrion.idas).toEqual([]);
    // El tercer pedido llega
    pasar(REPETIR_SIGUIENTE, anfitrion, invitado);
    expect(anfitrion.idas).toEqual([6]);
    pasar(ESPERA_IR, invitado);
    expect(invitado.idas).toEqual([6]);
  });

  it("si el «voy» se pierde al cerrar la página, la página nueva del invitado contesta «ya estoy» y no se va", () => {
    let tirarVoy = true;
    const red = crearPar((datos, de) => de === "invitado" && tipoDe(datos) === TIPO_VOY && tirarVoy);
    const anfitrion = pagina("anfitrion", red.anfitrion, 7);
    const vieja = pagina("invitado", red.invitado, 7);
    anfitrion.siguiente.pedir(8);
    pasar(ESPERA_IR, anfitrion, vieja);
    expect(vieja.idas).toEqual([8]);
    expect(anfitrion.idas).toEqual([]);
    // La página vieja se cerró; la nueva ya está en el nivel 8 y escucha
    vieja.siguiente.cerrar();
    tirarVoy = false;
    const nueva = pagina("invitado", red.invitado, 8);
    pasar(REPETIR_SIGUIENTE, anfitrion, nueva);
    expect(anfitrion.idas).toEqual([8]);
    pasar(REPETIR_SIGUIENTE, anfitrion, nueva);
    expect(nueva.idas).toEqual([]);
    expect(nueva.avisos).toEqual([]);
  });

  it("el invitado que vuelve (recargó en el nivel de antes) recibe el pedido repetido y se va", () => {
    let fuera = true;
    const red = crearPar((_, de) => de === "anfitrion" && fuera);
    const anfitrion = pagina("anfitrion", red.anfitrion, 2);
    anfitrion.siguiente.pedir(3);
    pasar(REPETIR_SIGUIENTE * 4, anfitrion);
    expect(anfitrion.idas).toEqual([]);
    fuera = false;
    const invitado = pagina("invitado", red.invitado, 2);
    pasar(REPETIR_SIGUIENTE, anfitrion, invitado);
    expect(anfitrion.idas).toEqual([3]);
    pasar(ESPERA_IR, invitado);
    expect(invitado.idas).toEqual([3]);
  });

  it("el anfitrión no hace caso de un «voy» a otro nivel", () => {
    const red = crearPar();
    const anfitrion = pagina("anfitrion", red.anfitrion, 0);
    red.invitado.enviar(escribirSiguiente(TIPO_VOY, 9), { fiable: true });
    expect(anfitrion.idas).toEqual([]);
    anfitrion.siguiente.pedir(1);
    red.invitado.enviar(escribirSiguiente(TIPO_VOY, 9), { fiable: true });
    expect(anfitrion.idas).toEqual([]);
    red.invitado.enviar(escribirSiguiente(TIPO_VOY, 1), { fiable: true });
    expect(anfitrion.idas).toEqual([1]);
  });
});
