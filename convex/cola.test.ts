import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { LATIDO_MS, VIGENCIA_MS } from "./cola";
import schema from "./schema";
import { modulos } from "./test.setup";

/** Un Convex vacío con cuatro personas ya guardadas. */
async function preparar() {
  const t = convexTest(schema, modulos);
  const persona = async (subject: string, nombre: string) => {
    const cliente = t.withIdentity({ subject, issuer: "prueba" });
    const id = await cliente.mutation(api.usuarios.guardarme, { nombre });
    return { cliente, id };
  };
  return {
    t,
    ana: await persona("ana", "Ana"),
    beto: await persona("beto", "Beto"),
    carla: await persona("carla", "Carla"),
    dani: await persona("dani", "Dani"),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("buscar pareja", () => {
  it("junta a dos de la misma región y saca a los dos de la cola", async () => {
    const { t, ana, beto } = await preparar();
    expect(await ana.cliente.mutation(api.cola.buscarPareja, { region: "centroamerica" })).toMatchObject({
      estado: "esperando",
      region: "centroamerica",
    });
    vi.advanceTimersByTime(1000);
    const resultado = await beto.cliente.mutation(api.cola.buscarPareja, { region: "centroamerica" });
    expect(resultado).toMatchObject({ estado: "emparejados", nombres: ["Beto", "Ana"] });

    const [pareja, ...otras] = await t.run((ctx) => ctx.db.query("parejas").collect());
    if (!pareja) throw new Error("no se creó la pareja");
    expect(otras).toHaveLength(0);
    expect(pareja.a < pareja.b).toBe(true);
    expect([pareja.a, pareja.b].sort()).toEqual([ana.id, beto.id].sort());
    // Las dos entradas quedan marcadas con la pareja: ya no están en la fila para nadie más.
    const cola = await t.run((ctx) => ctx.db.query("cola").collect());
    expect(cola).toHaveLength(2);
    expect(cola.every((e) => e.parejaId === pareja._id)).toBe(true);
  });

  it("empareja primero a quien lleva más tiempo esperando", async () => {
    const { t, ana, beto, carla } = await preparar();
    // Con la cola de verdad nunca hay dos esperando vivos en una región (el segundo se junta con el primero),
    // así que se arma a mano: Carla llegó antes que Ana.
    const ahora = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("cola", { usuarioId: ana.id, region: "andes", desde: ahora - 5000, visto: ahora });
      await ctx.db.insert("cola", { usuarioId: carla.id, region: "andes", desde: ahora - 9000, visto: ahora });
    });
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "andes" })).toMatchObject({
      estado: "emparejados",
      nombres: ["Beto", "Carla"],
    });
    expect(await ana.cliente.query(api.cola.estadoCola, {})).toMatchObject({ estado: "esperando" });
  });

  it("salta a quien se fue y se queda con el siguiente en la fila", async () => {
    const { t, ana, beto, carla } = await preparar();
    const ahora = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("cola", {
        usuarioId: ana.id,
        region: "brasil",
        desde: ahora - VIGENCIA_MS * 3,
        visto: ahora - VIGENCIA_MS - 1,
      });
      await ctx.db.insert("cola", { usuarioId: carla.id, region: "brasil", desde: ahora - 1000, visto: ahora });
    });
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "brasil" })).toMatchObject({
      estado: "emparejados",
      nombres: ["Beto", "Carla"],
    });
    // La entrada vieja de Ana se borró en el camino.
    expect(await ana.cliente.query(api.cola.estadoCola, {})).toBeNull();
  });

  it("con tres esperando en distintas regiones, cada uno se junta con el más viejo de la suya", async () => {
    const { t, ana, beto, carla, dani } = await preparar();
    // Ana y Carla esperan en el Caribe (Ana primero); Beto espera en México.
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    vi.advanceTimersByTime(1000);
    await beto.cliente.mutation(api.cola.buscarPareja, { region: "mexico" });
    // Carla, sola en su región por un momento, cambia al Caribe y encuentra a Ana.
    const deCarla = await carla.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    expect(deCarla).toMatchObject({ estado: "emparejados", nombres: ["Carla", "Ana"] });
    // Dani en el Caribe ya no encuentra a nadie; Beto sigue esperando en México.
    expect(await dani.cliente.mutation(api.cola.buscarPareja, { region: "caribe" })).toMatchObject({
      estado: "esperando",
    });
    expect(await beto.cliente.query(api.cola.estadoCola, {})).toMatchObject({ estado: "esperando", region: "mexico" });
    const parejas = await t.run((ctx) => ctx.db.query("parejas").collect());
    expect(parejas).toHaveLength(1);
  });

  it("no junta a personas de regiones distintas", async () => {
    const { t, ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "mexico" });
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "cono-sur" })).toMatchObject({
      estado: "esperando",
      region: "cono-sur",
    });
    expect(await t.run((ctx) => ctx.db.query("parejas").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("cola").collect())).toHaveLength(2);
  });

  it("no me junta conmigo mismo: volver a buscar solo avisa que sigo acá y conserva mi lugar", async () => {
    const { t, ana } = await preparar();
    const primera = await ana.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    vi.advanceTimersByTime(LATIDO_MS);
    const segunda = await ana.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    expect(segunda).toEqual(primera);
    const cola = await t.run((ctx) => ctx.db.query("cola").collect());
    expect(cola).toHaveLength(1);
    expect(cola[0]?.visto).toBe(Date.now());
    expect(await t.run((ctx) => ctx.db.query("parejas").collect())).toHaveLength(0);
  });

  it("no empareja a quien se fue sin avisar (sin noticias en más de dos minutos) y lo saca", async () => {
    const { t, ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "centroamerica" });
    vi.advanceTimersByTime(VIGENCIA_MS + 1000);
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "centroamerica" })).toMatchObject({
      estado: "esperando",
    });
    const cola = await t.run((ctx) => ctx.db.query("cola").collect());
    expect(cola.map((e) => e.usuarioId)).toEqual([beto.id]);
  });

  it("quien sigue avisando no vence aunque espere más de dos minutos", async () => {
    const { ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "norteamerica" });
    for (let i = 0; i < 6; i++) {
      vi.advanceTimersByTime(LATIDO_MS);
      await ana.cliente.mutation(api.cola.buscarPareja, { region: "norteamerica" });
    }
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "norteamerica" })).toMatchObject({
      estado: "emparejados",
    });
  });

  it("dejarDeBuscar me saca de la cola", async () => {
    const { t, ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "mexico" });
    await ana.cliente.mutation(api.cola.dejarDeBuscar, {});
    expect(await ana.cliente.query(api.cola.estadoCola, {})).toBeNull();
    expect(await t.run((ctx) => ctx.db.query("cola").collect())).toHaveLength(0);
    expect(await beto.cliente.mutation(api.cola.buscarPareja, { region: "mexico" })).toMatchObject({
      estado: "esperando",
    });
  });

  it("estadoCola le avisa a quien esperaba apenas lo encuentran", async () => {
    const { ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "andes" });
    expect(await ana.cliente.query(api.cola.estadoCola, {})).toMatchObject({ estado: "esperando", region: "andes" });
    const deBeto = await beto.cliente.mutation(api.cola.buscarPareja, { region: "andes" });
    const deAna = await ana.cliente.query(api.cola.estadoCola, {});
    expect(deAna).toMatchObject({ estado: "emparejados", nombres: ["Ana", "Beto"] });
    expect(deBeto.estado === "emparejados" && deAna?.estado === "emparejados" && deAna.parejaId).toBe(
      deBeto.estado === "emparejados" && deBeto.parejaId,
    );
    // Si el juego de Ana vuelve a avisar justo después, le devuelve la misma pareja en vez de ponerla a esperar.
    expect(await ana.cliente.mutation(api.cola.buscarPareja, { region: "andes" })).toEqual(deAna);
  });

  it("dos que ya son pareja pueden volver a encontrarse: se reusa la pareja", async () => {
    const { t, ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    const primera = await beto.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    await ana.cliente.mutation(api.cola.dejarDeBuscar, {});
    await beto.cliente.mutation(api.cola.dejarDeBuscar, {});
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    const segunda = await beto.cliente.mutation(api.cola.buscarPareja, { region: "caribe" });
    expect(segunda.estado === "emparejados" && segunda.parejaId).toBe(
      primera.estado === "emparejados" && primera.parejaId,
    );
    expect(await t.run((ctx) => ctx.db.query("parejas").collect())).toHaveLength(1);
  });

  it("pide sesión y una región conocida", async () => {
    const { t, ana } = await preparar();
    await expect(t.mutation(api.cola.buscarPareja, { region: "caribe" })).rejects.toThrow(/entrar/);
    await expect(ana.cliente.mutation(api.cola.buscarPareja, { region: "marte" })).rejects.toThrow(/región/);
    expect(await t.query(api.cola.estadoCola, {})).toBeNull();
  });

  it("la limpieza borra solo las entradas sin noticias", async () => {
    const { t, ana, beto } = await preparar();
    await ana.cliente.mutation(api.cola.buscarPareja, { region: "mexico" });
    vi.advanceTimersByTime(VIGENCIA_MS + 1000);
    await beto.cliente.mutation(api.cola.buscarPareja, { region: "andes" });
    expect(await t.mutation(internal.cola.limpiar, {})).toBe(1);
    const cola = await t.run((ctx) => ctx.db.query("cola").collect());
    expect(cola.map((e) => e.usuarioId)).toEqual([beto.id]);
  });
});
