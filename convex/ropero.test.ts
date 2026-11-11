import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { CATEGORIAS, INICIALES, NIVELES_CON_PREMIOS, nivelQueDa, PREMIOS, PRENDAS, VESTUARIO_INICIAL } from "./premios";
import schema from "./schema";
import { modulos } from "./test.setup";

/** Ana y Beto son pareja; Carla no está en ella (pero es pareja de Beto en otra). */
async function parejaDeAnaYBeto() {
  const t = convexTest(schema, modulos);
  const ana = t.withIdentity({ subject: "ana", issuer: "prueba" });
  const beto = t.withIdentity({ subject: "beto", issuer: "prueba" });
  const carla = t.withIdentity({ subject: "carla", issuer: "prueba" });
  await ana.mutation(api.usuarios.guardarme, { nombre: "Ana" });
  await beto.mutation(api.usuarios.guardarme, { nombre: "Beto" });
  await carla.mutation(api.usuarios.guardarme, { nombre: "Carla" });
  const juntar = async (de: typeof ana, a: typeof ana) => {
    const { codigo } = await de.mutation(api.invitaciones.crearInvitacion, {});
    const pareja = await a.mutation(api.invitaciones.aceptarInvitacion, { codigo });
    if (!pareja.ok) throw new Error(pareja.motivo);
    return pareja._id;
  };
  const parejaId = await juntar(ana, beto);
  const deBetoYCarla = await juntar(carla, beto);
  return { t, ana, beto, carla, parejaId, deBetoYCarla };
}

describe("la tabla de premios", () => {
  it("cada nivel del plan (0 a 16) y el de prueba tienen secreto, logro y una prenda distinta", () => {
    expect(NIVELES_CON_PREMIOS).toEqual([...Array.from({ length: 17 }, (_, i) => i), 99]);
    const prendas = NIVELES_CON_PREMIOS.map((n) => PREMIOS[n]?.prenda);
    expect(new Set(prendas).size).toBe(prendas.length);
    const logros = NIVELES_CON_PREMIOS.map((n) => PREMIOS[n]?.logro.id);
    expect(new Set(logros).size).toBe(logros.length);
    for (const n of NIVELES_CON_PREMIOS) {
      const p = PREMIOS[n];
      expect(p?.secreto).toBeTruthy();
      expect(p?.logro.nombre).toBeTruthy();
      expect(p?.logro.texto).toBeTruthy();
    }
  });

  it("toda prenda se tiene desde el principio o la da exactamente un nivel", () => {
    for (const c of CATEGORIAS) {
      for (const prenda of PRENDAS[c]) {
        const inicial = (INICIALES[c] as readonly string[]).includes(prenda);
        expect(inicial !== (nivelQueDa(`${c}:${prenda}`) !== undefined), `${c}:${prenda}`).toBe(true);
      }
    }
    // El vestuario de los dos al empezar se puede poner sin ganar nada
    for (const v of VESTUARIO_INICIAL)
      for (const c of CATEGORIAS) expect(INICIALES[c] as readonly string[]).toContain(v[c]);
  });
});

describe("ropero", () => {
  it("al principio no hay nada guardado ni ganado", async () => {
    const { ana, t } = await parejaDeAnaYBeto();
    expect(await ana.query(api.ropero.miRopero, {})).toEqual({ vestuario: null, ganadas: [], logros: [] });
    expect(await t.query(api.ropero.miRopero, {})).toBeNull();
  });

  it("se pone lo que tiene desde el principio, y no lo que no ganó o no existe", async () => {
    const { ana } = await parejaDeAnaYBeto();
    const trenzas = { panuelo: "triangulo", sombrero: "ninguno", peinado: "trenzas", mascara: "antifaz" };
    expect(await ana.mutation(api.ropero.elegir, trenzas)).toEqual(trenzas);
    expect((await ana.query(api.ropero.miRopero, {}))?.vestuario).toEqual(trenzas);
    await expect(ana.mutation(api.ropero.elegir, { ...trenzas, sombrero: "puntudo" })).rejects.toThrow(/ganaste/);
    await expect(ana.mutation(api.ropero.elegir, { ...trenzas, mascara: "corona" })).rejects.toThrow(/No existe/);
    await expect(ana.mutation(api.ropero.elegir, { ...trenzas, panuelo: "ninguno" })).rejects.toThrow(/No existe/);
    expect((await ana.query(api.ropero.miRopero, {}))?.vestuario).toEqual(trenzas);
  });

  it("el secreto de un nivel le da su prenda a los dos de la pareja y queda en el avance", async () => {
    const { t, ana, beto, carla, parejaId } = await parejaDeAnaYBeto();
    expect(await ana.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 8 })).toEqual({
      prenda: "sombrero:puntudo",
      nueva: true,
    });
    // Otra vez (el otro también avisa): no se repite
    expect(await beto.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 8 })).toEqual({
      prenda: "sombrero:puntudo",
      nueva: false,
    });
    for (const quien of [ana, beto]) {
      expect((await quien.query(api.ropero.miRopero, {}))?.ganadas).toEqual([{ cosa: "sombrero:puntudo", nivel: 8 }]);
      expect(await quien.query(api.ropero.premiosDeNivel, { parejaId, nivel: 8 })).toEqual({
        secreto: true,
        logro: false,
      });
    }
    expect((await carla.query(api.ropero.miRopero, {}))?.ganadas).toEqual([]);
    const avance = await t.run((ctx) => ctx.db.query("avance").collect());
    expect(avance).toHaveLength(1);
    expect(avance[0]).toMatchObject({ parejaId, nivel: 8, puntoDeControl: 0, secreto: true });
    // Ya ganado, se lo puede poner
    const puesto = { ...VESTUARIO_INICIAL[0], sombrero: "puntudo" };
    expect(await beto.mutation(api.ropero.elegir, puesto)).toEqual(puesto);
  });

  it("el secreto no pisa el punto de control guardado", async () => {
    const { t, ana, parejaId } = await parejaDeAnaYBeto();
    await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 99, puntoDeControl: 2 });
    await ana.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 99 });
    expect(await ana.query(api.avance.puntoDeControl, { parejaId, nivel: 99 })).toBe(2);
    const avance = await t.run((ctx) => ctx.db.query("avance").collect());
    expect(avance).toEqual([expect.objectContaining({ puntoDeControl: 2, secreto: true })]);
  });

  it("lo ganado es de cada uno: Beto lo conserva para jugar con Carla", async () => {
    const { ana, beto, carla, parejaId, deBetoYCarla } = await parejaDeAnaYBeto();
    await ana.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 13 });
    await ana.mutation(api.ropero.lograr, { parejaId, nivel: 13 });
    const diablito = { ...VESTUARIO_INICIAL[1], mascara: "diablito" };
    await beto.mutation(api.ropero.elegir, diablito);
    // Con Carla, el secreto del nivel 13 no está encontrado, pero Beto sigue con su máscara
    expect(await carla.query(api.ropero.premiosDeNivel, { parejaId: deBetoYCarla, nivel: 13 })).toEqual({
      secreto: false,
      logro: false,
    });
    expect(await carla.query(api.ropero.vestuariosDePareja, { parejaId: deBetoYCarla })).toEqual({
      mio: null,
      companero: diablito,
    });
    expect(await beto.query(api.ropero.vestuariosDePareja, { parejaId: deBetoYCarla })).toEqual({
      mio: diablito,
      companero: null,
    });
    expect((await beto.query(api.ropero.miRopero, {}))?.logros).toEqual(["sin-chispas"]);
  });

  it("el logro queda en la lista de los dos una sola vez", async () => {
    const { t, ana, beto, parejaId } = await parejaDeAnaYBeto();
    expect(await beto.mutation(api.ropero.lograr, { parejaId, nivel: 99 })).toEqual({ logro: "mudanza", nuevo: true });
    expect(await ana.mutation(api.ropero.lograr, { parejaId, nivel: 99 })).toEqual({ logro: "mudanza", nuevo: false });
    expect((await ana.query(api.ropero.miRopero, {}))?.logros).toEqual(["mudanza"]);
    expect(await ana.query(api.ropero.premiosDeNivel, { parejaId, nivel: 99 })).toEqual({
      secreto: false,
      logro: true,
    });
    expect(await t.run((ctx) => ctx.db.query("logros").collect())).toHaveLength(2);
  });

  it("alguien de afuera no gana nada por la pareja ni ve lo que tienen puesto", async () => {
    const { t, ana, carla, parejaId } = await parejaDeAnaYBeto();
    await expect(carla.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 0 })).rejects.toThrow(/no es tuya/);
    await expect(carla.mutation(api.ropero.lograr, { parejaId, nivel: 0 })).rejects.toThrow(/no es tuya/);
    expect(await carla.query(api.ropero.vestuariosDePareja, { parejaId })).toBeNull();
    expect(await carla.query(api.ropero.premiosDeNivel, { parejaId, nivel: 0 })).toEqual({
      secreto: false,
      logro: false,
    });
    expect((await ana.query(api.ropero.miRopero, {}))?.ganadas).toEqual([]);
    await expect(t.mutation(api.ropero.encontrarSecreto, { parejaId, nivel: 0 })).rejects.toThrow(/entrar/);
    await expect(t.mutation(api.ropero.elegir, VESTUARIO_INICIAL[0])).rejects.toThrow(/entrar/);
  });

  it("rechaza niveles que no tienen premios", async () => {
    const { ana, parejaId } = await parejaDeAnaYBeto();
    for (const nivel of [-1, 1.5, 17, 98, Number.NaN, 1e9]) {
      await expect(ana.mutation(api.ropero.encontrarSecreto, { parejaId, nivel })).rejects.toThrow(/secreto ni logro/);
      await expect(ana.mutation(api.ropero.lograr, { parejaId, nivel })).rejects.toThrow(/secreto ni logro/);
    }
    expect(await ana.query(api.ropero.miRopero, {})).toEqual({ vestuario: null, ganadas: [], logros: [] });
  });
});
