// El límite de voces (TU-59): cuántos efectos suenan a la vez y cada cuánto puede repetirse el mismo. Así un huacal
// que rebota contra el suelo o los dos muñecos que caen juntos no tapan todo con 60 golpes por segundo. Sin audio:
// solo cuenta (lo prueba voces.test.ts).

/** Cuántos efectos pueden sonar a la vez. */
export const MAX_VOCES = 14;

export interface Limite {
  /**
   * Si puede sonar ya (`ahora`, en segundos) un efecto con esa `clave` que dura `dura` segundos y no se repite antes
   * de `separacion` segundos. Si puede, lo anota.
   */
  pedir(clave: string, ahora: number, dura: number, separacion: number): boolean;
  /** Cuántos suenan en `ahora`. */
  sonando(ahora: number): number;
}

export function crearLimite(maximo = MAX_VOCES): Limite {
  /** Cuándo termina cada voz que suena. */
  const terminan: number[] = [];
  /** Cuándo sonó por última vez cada clave. */
  const ultima = new Map<string, number>();
  const limpiar = (ahora: number) => {
    for (let i = terminan.length - 1; i >= 0; i--) if ((terminan[i] ?? 0) <= ahora) terminan.splice(i, 1);
  };
  return {
    pedir(clave, ahora, dura, separacion) {
      const antes = ultima.get(clave);
      if (antes !== undefined && ahora - antes < separacion) return false;
      limpiar(ahora);
      if (terminan.length >= maximo) return false;
      terminan.push(ahora + dura);
      ultima.set(clave, ahora);
      return true;
    },
    sonando(ahora) {
      limpiar(ahora);
      return terminan.length;
    },
  };
}
