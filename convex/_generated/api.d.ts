/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as avance from "../avance.js";
import type * as cola from "../cola.js";
import type * as contrarreloj from "../contrarreloj.js";
import type * as crons from "../crons.js";
import type * as cuenta from "../cuenta.js";
import type * as invitaciones from "../invitaciones.js";
import type * as parejas from "../parejas.js";
import type * as premios from "../premios.js";
import type * as regiones from "../regiones.js";
import type * as ropero from "../ropero.js";
import type * as salas from "../salas.js";
import type * as usuarios from "../usuarios.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  avance: typeof avance;
  cola: typeof cola;
  contrarreloj: typeof contrarreloj;
  crons: typeof crons;
  cuenta: typeof cuenta;
  invitaciones: typeof invitaciones;
  parejas: typeof parejas;
  premios: typeof premios;
  regiones: typeof regiones;
  ropero: typeof ropero;
  salas: typeof salas;
  usuarios: typeof usuarios;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
