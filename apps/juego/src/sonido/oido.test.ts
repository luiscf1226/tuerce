// El oído con físicas de verdad: en la escena `dos` y en un nivel, lo que hacen los muñecos suena; el invitado en
// línea oye con lo que trae la foto; y el sonido no cambia las físicas.
import { describe, expect, it } from "vitest";
import { crearEscenaDos } from "../escenas/dos";
import { armarEscenaNivel } from "../escenas/nivel";
import { crearEscenaTutorial } from "../escenas/tutorial";
import { crearMundo } from "../motor/fisica";
import { NIVELES } from "../niveles/lista";
import { leerDelDisco } from "../niveles/prueba";
import type { EventoSonido } from "./eventos";
import { SUELO_DEL_NIVEL, sueloDelMaterial } from "./oido";

async function dos(parametros: string) {
  const { rapier, mundo } = await crearMundo();
  return crearEscenaDos(rapier, mundo, new URLSearchParams(parametros));
}

function correr(escena: { pasar(): void; oido: { ultimos: readonly EventoSonido[] } }, pasos: number) {
  const eventos: EventoSonido[] = [];
  for (let i = 0; i < pasos; i++) {
    escena.pasar();
    eventos.push(...escena.oido.ultimos);
  }
  return eventos;
}

describe("oído de la escena", () => {
  it("en el claro, andar suena a pasos sobre pinocha, de los dos", async () => {
    const eventos = correr(await dos("j1=andar:1&j2=andar:1"), 150);
    const pasos = eventos.filter((e) => e.cual === "paso");
    expect(pasos.filter((e) => e.jugador === 0).length).toBeGreaterThan(3);
    expect(pasos.filter((e) => e.jugador === 1).length).toBeGreaterThan(3);
    expect(pasos.every((e) => e.cual === "paso" && e.suelo === "hojas")).toBe(true);
  });

  it("en el tutorial también: andar suena a pasos sobre pinocha", async () => {
    const { rapier, mundo } = await crearMundo();
    const eventos = correr(crearEscenaTutorial(rapier, mundo, new URLSearchParams("j1=andar:1&j2=andar:1")), 150);
    const pasos = eventos.filter((e) => e.cual === "paso");
    expect(pasos.filter((e) => e.jugador === 0).length).toBeGreaterThan(3);
    expect(pasos.filter((e) => e.jugador === 1).length).toBeGreaterThan(3);
  });

  it("quietos no suena nada (ni al aparecer)", async () => {
    expect(correr(await dos("j1=&j2="), 120)).toEqual([]);
  });

  it("saltar suena a salto y después a aterrizaje", async () => {
    const eventos = correr(await dos("j1=saltar@30&j2="), 120);
    const cuales = eventos.filter((e) => e.cual !== "pieza" && e.jugador === 0).map((e) => e.cual);
    expect(cuales).toContain("salto");
    expect(cuales.indexOf("aterrizar")).toBeGreaterThan(cuales.indexOf("salto"));
  });

  it("agarrar el huacal suena a agarrar", async () => {
    const eventos = correr(await dos("j1=andar:0.6,izq&j2=andar:0.6,der"), 120);
    expect(
      eventos
        .filter((e) => e.cual === "agarrar")
        .map((e) => e.jugador)
        .sort(),
    ).toEqual([0, 1]);
  });

  it("el invitado en línea oye los agarres y estados de la foto, no los de sus muñecos (que no simula)", async () => {
    const escena = await dos("j1=&j2=");
    correr(escena, 5);
    let agarres = 0;
    escena.oido.mirarCon(() => ({ estados: ["de pie", "de pie"], agarres }));
    correr(escena, 2);
    agarres = 0b0100; // la izquierda del turquesa
    const eventos = correr(escena, 1);
    expect(eventos).toEqual([expect.objectContaining({ cual: "agarrar", jugador: 1 })]);
    // Sin foto todavía, nada
    escena.oido.mirarCon(() => undefined);
    expect(correr(escena, 3)).toEqual([]);
  });

  it("el sonido no toca las físicas: dos corridas iguales dan lo mismo", async () => {
    const pelvis = async () => {
      const e = await dos("j1=andar:1,izq&j2=andar:0.7,saltar@40");
      correr(e, 200);
      return e.munecos.map((m) => m.partes.pelvis.translation());
    };
    expect(await pelvis()).toEqual(await pelvis());
  });

  it("en un nivel, los pasos salen con el suelo del material que pisa", async () => {
    const { rapier, mundo } = await crearMundo();
    const plano = await leerDelDisco("99-prueba");
    const escena = armarEscenaNivel(
      rapier,
      mundo,
      plano,
      NIVELES.prueba?.crearGuion() ?? {},
      new URLSearchParams("nivel=prueba&j1=andar:1&j2=andar:1"),
    );
    const pasos = correr(escena, 150).filter((e) => e.cual === "paso");
    expect(pasos.length).toBeGreaterThan(3);
    const materiales = new Set(plano.solidos.map((s) => sueloDelMaterial(s.material, "prueba")));
    for (const p of pasos) if (p.cual === "paso") expect([...materiales, "agua"]).toContain(p.suelo);
  });

  it("cada nivel de la historia pisa algo sobre su suelo", () => {
    for (const clave of Object.keys(NIVELES)) {
      if (clave === "piezas" || clave === "prueba") continue;
      expect(SUELO_DEL_NIVEL[clave], clave).toBeDefined();
    }
    expect(sueloDelMaterial("corteza", "calle")).toBe("madera");
    expect(sueloDelMaterial("suelo", "calle")).toBe("piedra");
    expect(sueloDelMaterial("suelo", "pinar")).toBe("hojas");
  });
});
