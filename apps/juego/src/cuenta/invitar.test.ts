import { describe, expect, it } from "vitest";
import { enlaceDeInvitacion } from "./invitar";

describe("enlace de invitación", () => {
  it("abre la pantalla de invitar con el código, sin lo que había en la dirección", () => {
    expect(enlaceDeInvitacion("https://tuerce.luiscf1226.workers.dev/?escena=invitar&codigo=VIEJO#x", "ABC23")).toBe(
      "https://tuerce.luiscf1226.workers.dev/?escena=invitar&codigo=ABC23",
    );
  });
});
