// Tareas que Convex corre solas.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Saca de la cola de «buscar pareja» a quien se fue sin avisar (y los avisos de pareja ya viejos).
crons.interval("limpiar la cola de buscar pareja", { minutes: 2 }, internal.cola.limpiar, {});

export default crons;
