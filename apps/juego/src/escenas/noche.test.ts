// La Noche de tuerce (TU-33) en la escena `nivel`, con los niveles de verdad: con cada trampa se siguen pudiendo
// jugar. Recorrer un nivel entero pide resolverlo; acá se prueban los pasos que cada trampa podría romper.
import { describe, expect, it } from "vitest";
import { crearMundo } from "../motor/fisica";
import { NIVELES } from "../niveles/lista";
import { TRAMPAS } from "../niveles/noche";
import { leerDelDisco } from "../niveles/prueba";
import { armarEscenaNivel } from "./nivel";

async function escenaDe(cual: "prueba" | "piezas", parametros: string) {
  const datos = NIVELES[cual];
  if (!datos) throw new Error(`falta el nivel ${cual}`);
  const { rapier, mundo } = await crearMundo();
  const plano = await leerDelDisco(datos.carpeta);
  return armarEscenaNivel(rapier, mundo, plano, datos.crearGuion(), new URLSearchParams(`nivel=${cual}&${parametros}`));
}

describe("Noche de tuerce en la escena nivel", () => {
  it("sin `&noche` es de día; con `&noche=N` la trampa sale de la semilla y es siempre la misma", async () => {
    expect((await escenaDe("prueba", "j1=&j2=")).noche.trampa).toBeUndefined();
    const una = (await escenaDe("prueba", "noche=4&j1=&j2=")).noche.trampa;
    expect(una).toBeDefined();
    expect((await escenaDe("prueba", "noche=4&j1=&j2=")).noche.trampa).toBe(una);
  });

  for (const t of TRAMPAS) {
    it(`${t.nombre}: en el de prueba, desde el punto 2 llegan a la meta`, async () => {
      const e = await escenaDe("prueba", `noche=1&trampa=${t.nombre}&punto=2&j1=andar:1&j2=andar:1`);
      expect(e.noche.trampa?.nombre).toBe(t.nombre);
      for (let i = 0; i < 900 && (e.avance?.puntoDeControl() ?? 0) < 3; i++) e.pasar();
      e.dibujar(0.5);
      expect(e.avance?.puntoDeControl()).toBe(3);
    });

    it(`${t.nombre}: en el de piezas, la plancha abre la compuerta y el bejuco se agarra`, async () => {
      // El rojo se para en la plancha del patio y la compuerta 1 baja
      const plancha = await escenaDe("piezas", `noche=1&trampa=${t.nombre}&j1=&j2=`);
      const altura = () => plancha.nivel.pieza("compuerta-1").cuerpo?.translation().y ?? Number.NaN;
      const arriba = altura();
      plancha.munecos[0].reaparecer({ x: 0.5, y: 0.15, z: 1 }, Math.PI / 2);
      for (let i = 0; i < 120; i++) plancha.pasar();
      expect(plancha.nivel.plancha("plancha").pisada).toBe(true);
      expect(altura()).toBeLessThan(arriba - 2.4);

      // Desde el punto 2, el rojo anda hacia su bejuco con los dos brazos arriba y sale colgado sobre la quebrada
      const bejuco = await escenaDe("piezas", `noche=1&trampa=${t.nombre}&punto=2&j1=andar:1,izq@10,der@10&j2=`);
      const rojo = bejuco.nivel.bejuco("bejuco-rojo");
      for (let i = 0; i < 300 && rojo.colgados === 0; i++) bejuco.pasar();
      expect(rojo.colgados).toBe(1);
    });
  }
});
