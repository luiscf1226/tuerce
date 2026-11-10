// Entrada con guion, para capturas que salen siempre igual con `congelar=N`. Va encima de la entrada del teclado
// (y de `&andar=`/`&girar=`) y solo pisa lo que la dirección pide:
//   &saltar=<paso>[,<paso>…]  aprieta saltar en esos pasos (lo mantiene 5 pasos y lo suelta)
//   &brazos=<i|d|id>          alza el brazo izquierdo, el derecho o los dos desde el principio
//   &soltar=<paso>            baja los brazos desde ese paso
//   &esperar=<paso>           `andar` y `girar` recién cuentan desde ese paso
import type { EntradaMuneco } from "../muneco";

/** Cuántos pasos queda apretado saltar. */
const APRETON = 5;

/** Devuelve la función que ajusta la entrada en cada paso, o nada si la dirección no trae guion. */
export function crearGuion(parametros: URLSearchParams): ((paso: number, entrada: EntradaMuneco) => void) | undefined {
  const numero = (clave: string) => {
    const valor = Number(parametros.get(clave));
    return parametros.has(clave) && Number.isFinite(valor) ? valor : undefined;
  };
  const saltos = parametros.has("saltar")
    ? (parametros.get("saltar") ?? "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isFinite(n))
    : undefined;
  const brazos = parametros.get("brazos");
  const soltar = numero("soltar") ?? Number.POSITIVE_INFINITY;
  const esperar = numero("esperar");
  if (!saltos && brazos === null && esperar === undefined) return undefined;

  let fijo: { avanzar: number; girar: number } | undefined;
  return (paso, entrada) => {
    if (esperar !== undefined) {
      fijo ??= { avanzar: entrada.avanzar, girar: entrada.girar };
      entrada.avanzar = paso >= esperar ? fijo.avanzar : 0;
      entrada.girar = paso >= esperar ? fijo.girar : 0;
    }
    if (saltos) entrada.saltar = saltos.some((s) => paso >= s && paso < s + APRETON);
    if (brazos !== null) {
      entrada.brazoIzquierdo = brazos.includes("i") && paso < soltar;
      entrada.brazoDerecho = brazos.includes("d") && paso < soltar;
    }
  };
}
