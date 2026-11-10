import { describe, expect, it } from "vitest";
import { dominioDeClerk } from "./entrar";

describe("llave pública de Clerk", () => {
  it("saca el dominio de Clerk de la llave", () => {
    const llave = `pk_test_${btoa("divine-clam-6554.clerk.accounts.dev$")}`;
    expect(dominioDeClerk(llave)).toBe("divine-clam-6554.clerk.accounts.dev");
  });

  it("avisa si la llave no tiene el formato de Clerk", () => {
    expect(() => dominioDeClerk("cualquier-cosa")).toThrow(/pk_test_/);
  });
});
