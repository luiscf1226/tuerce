import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { PUESTOS, TIEMPO_MAXIMO, TIEMPO_MINIMO } from "./contrarreloj";
import schema from "./schema";
import { modulos } from "./test.setup";

type Prueba = ReturnType<typeof convexTest>;
type Cliente = ReturnType<Prueba["withIdentity"]>;

/** Un usuario guardado con ese nombre. */
async function usuario(t: Prueba, nombre: string): Promise<Cliente> {
  const yo = t.withIdentity({ subject: nombre.toLowerCase(), issuer: "prueba" });
  await yo.mutation(api.usuarios.guardarme, { nombre });
  return yo;
}

/** Junta a los dos por invitación y devuelve la pareja. */
async function juntar(invita: Cliente, acepta: Cliente) {
  const { codigo } = await invita.mutation(api.invitaciones.crearInvitacion, {});
  const pareja = await acepta.mutation(api.invitaciones.aceptarInvitacion, { codigo });
  if (!pareja.ok) throw new Error(pareja.motivo);
  return pareja._id;
}

/** Ana y Beto son pareja; Carla no está en ella. */
async function parejaDeAnaYBeto() {
  const t = convexTest(schema, modulos);
  const ana = await usuario(t, "Ana");
  const beto = await usuario(t, "Beto");
  const carla = await usuario(t, "Carla");
  const parejaId = await juntar(ana, beto);
  return { t, ana, beto, carla, parejaId };
}

const SEGUNDOS = 60;

describe("contrarreloj", () => {
  it("ganar un nivel lo abre para la pareja, sin pisar el punto de control", async () => {
    const { ana, beto, carla, parejaId } = await parejaDeAnaYBeto();
    expect(await beto.query(api.contrarreloj.nivelesGanados, { parejaId })).toEqual([]);
    await ana.mutation(api.avance.guardarPuntoDeControl, { parejaId, nivel: 99, puntoDeControl: 3 });
    await ana.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
    await ana.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
    expect(await beto.query(api.contrarreloj.nivelesGanados, { parejaId })).toEqual([{ nivel: 99, mejorTiempo: null }]);
    expect(await beto.query(api.avance.puntoDeControl, { parejaId, nivel: 99 })).toBe(3);
    // Sin avance guardado (el guardado del punto falló) también queda ganado
    await beto.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 0 });
    expect((await ana.query(api.contrarreloj.nivelesGanados, { parejaId })).map((g) => g.nivel).sort()).toEqual([
      0, 99,
    ]);
    // Alguien de afuera no gana por ellos ni ve qué ganaron
    await expect(carla.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 1 })).rejects.toThrow(/no es tuya/);
    expect(await carla.query(api.contrarreloj.nivelesGanados, { parejaId })).toEqual([]);
  });

  it("solo se registra el tiempo de un nivel ganado, y queda el mejor", async () => {
    const { t, ana, beto, parejaId } = await parejaDeAnaYBeto();
    await expect(
      ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: 40 * SEGUNDOS }),
    ).rejects.toThrow(/ganar/);
    await ana.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
    expect(
      await ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: 40 * SEGUNDOS }),
    ).toEqual({ mejor: 40 * SEGUNDOS, mejoro: true });
    // Uno peor no lo pisa; uno mejor sí, y lo puede mandar cualquiera de los dos
    expect(
      await beto.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: 50 * SEGUNDOS }),
    ).toEqual({ mejor: 40 * SEGUNDOS, mejoro: false });
    expect(
      await beto.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: 35 * SEGUNDOS }),
    ).toEqual({ mejor: 35 * SEGUNDOS, mejoro: true });
    // Una sola fila por pareja y nivel, y el mejor también en el avance
    const tiempos = await t.run((ctx) => ctx.db.query("tiempos").collect());
    expect(tiempos).toHaveLength(1);
    expect(tiempos[0]).toMatchObject({ parejaId, nivel: 99, tiempo: 35 * SEGUNDOS });
    expect(await ana.query(api.contrarreloj.nivelesGanados, { parejaId })).toEqual([
      { nivel: 99, mejorTiempo: 35 * SEGUNDOS },
    ]);
  });

  it("corta tiempos imposibles, niveles que no existen, a los de afuera y a quien no entró", async () => {
    const { t, ana, carla, parejaId } = await parejaDeAnaYBeto();
    await ana.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
    for (const tiempo of [0, -5, TIEMPO_MINIMO - 1, TIEMPO_MAXIMO + 1, 1234.5, Number.NaN]) {
      await expect(ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo })).rejects.toThrow(
        /no es posible/,
      );
    }
    await expect(
      ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 1.5, tiempo: TIEMPO_MINIMO }),
    ).rejects.toThrow(/nivel/);
    await expect(
      carla.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: TIEMPO_MINIMO }),
    ).rejects.toThrow(/no es tuya/);
    await expect(
      t.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: TIEMPO_MINIMO }),
    ).rejects.toThrow(/entrar/);
    expect(await t.run((ctx) => ctx.db.query("tiempos").collect())).toHaveLength(0);
    // El mínimo justo sí vale
    expect(
      await ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: TIEMPO_MINIMO }),
    ).toMatchObject({ mejoro: true });
  });

  it("la tabla: las mejores parejas con los dos nombres, empates en el mismo puesto y la propia aunque no entre", async () => {
    const t = convexTest(schema, modulos);
    const yo = await usuario(t, "Zoe");
    const companera = await usuario(t, "Yago");
    const propiaId = await juntar(yo, companera);
    await yo.mutation(api.contrarreloj.ganarNivel, { parejaId: propiaId, nivel: 99 });

    // PUESTOS + 2 parejas más rápidas que la propia, con un empate en el segundo puesto
    for (let i = 0; i < PUESTOS + 2; i++) {
      const a = await usuario(t, `A${i}`);
      const b = await usuario(t, `B${i}`);
      const parejaId = await juntar(a, b);
      await a.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
      const tiempo = (20 + (i === 2 ? 1 : i)) * SEGUNDOS;
      await b.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo });
    }
    await companera.mutation(api.contrarreloj.registrarTiempo, {
      parejaId: propiaId,
      nivel: 99,
      tiempo: 90 * SEGUNDOS,
    });

    const { filas, propia } = await yo.query(api.contrarreloj.tabla, { nivel: 99, parejaId: propiaId });
    expect(filas).toHaveLength(PUESTOS);
    expect(filas.map((f) => f.puesto).slice(0, 4)).toEqual([1, 2, 2, 4]);
    expect(filas.map((f) => f.tiempo)).toEqual([...filas.map((f) => f.tiempo)].sort((x, y) => x - y));
    expect(filas[0]).toMatchObject({ tiempo: 20 * SEGUNDOS, propia: false });
    expect([...(filas[0]?.nombres ?? [])].sort()).toEqual(["A0", "B0"]);
    expect(filas.some((f) => f.propia)).toBe(false);
    expect(propia).toMatchObject({ puesto: PUESTOS + 3, tiempo: 90 * SEGUNDOS, propia: true });
    expect([...(propia?.nombres ?? [])].sort()).toEqual(["Yago", "Zoe"]);

    // Otro nivel tiene su propia tabla; sin sesión o con una pareja ajena se ve la tabla pero no «la propia»
    expect(await yo.query(api.contrarreloj.tabla, { nivel: 0, parejaId: propiaId })).toEqual({
      filas: [],
      propia: null,
    });
    const anonima = await t.query(api.contrarreloj.tabla, { nivel: 99, parejaId: propiaId });
    expect(anonima.filas).toHaveLength(PUESTOS);
    expect(anonima.propia).toBeNull();
  });

  it("si la pareja entra entre las mejores, se marca en la tabla", async () => {
    const { ana, beto, carla, parejaId } = await parejaDeAnaYBeto();
    await ana.mutation(api.contrarreloj.ganarNivel, { parejaId, nivel: 99 });
    await ana.mutation(api.contrarreloj.registrarTiempo, { parejaId, nivel: 99, tiempo: 30 * SEGUNDOS });
    const { filas, propia } = await beto.query(api.contrarreloj.tabla, { nivel: 99, parejaId });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ puesto: 1, propia: true });
    expect(propia).toEqual(filas[0]);
    // Carla ve la misma fila, pero no es la suya
    const ajena = await carla.query(api.contrarreloj.tabla, { nivel: 99, parejaId });
    expect(ajena.filas[0]?.propia).toBe(false);
    expect(ajena.propia).toBeNull();
  });
});
