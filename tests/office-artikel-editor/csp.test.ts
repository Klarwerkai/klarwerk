// ================================================================================================
// OFFICE IM ARTIKEL · DIE CSP AM DRAHT (Auftrag produkt:20261007:office-artikel-editor, Plan 3.1).
// ================================================================================================
//
// Die Artikelseite bettet den Editor per Formular-POST in ein iframe. Dafür braucht die globale CSP
// GENAU die eine Editor-Herkunft in `frame-src` und `form-action` — und nur, wenn der Editor
// vollständig eingerichtet ist. Gemessen an der echten Registrierung `registerSecurityHeaders`.
//
//   C1  Eingerichtet: beide Direktiven nennen `'self'` und genau die Editor-Herkunft.       (K1)
//   C2  Nicht eingerichtet: beide bleiben `'self'`; `frame-ancestors 'none'` bleibt.         (K6)

import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";

async function cspMit(env: NodeJS.ProcessEnv): Promise<string> {
  const app = Fastify();
  await registerSecurityHeaders(app, env);
  app.get("/wissen/x", async (_request, reply) => reply.type("text/html").send("ok"));
  await app.ready();
  try {
    const antwort = await app.inject({ method: "GET", url: "/wissen/x" });
    return String(antwort.headers["content-security-policy"] ?? "");
  } finally {
    await app.close();
  }
}

function direktive(csp: string, name: string): string[] {
  const teil = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));
  return teil ? teil.split(/\s+/).slice(1) : [];
}

describe("Office im Artikel · CSP", () => {
  it("C1: eingerichtet — frame-src und form-action nennen genau die Editor-Herkunft", async () => {
    const csp = await cspMit({
      KLARWERK_OFFICE_EDITOR_URL: "https://editor.beispiel.invalid/browser",
      APP_BASE_URL: "https://klarwerk.beispiel.invalid",
      KLARWERK_WOPI_SCHLUESSEL: "0f".repeat(32),
    });
    expect(direktive(csp, "frame-src")).toEqual(["'self'", "https://editor.beispiel.invalid"]);
    expect(direktive(csp, "form-action")).toEqual(["'self'", "https://editor.beispiel.invalid"]);
    expect(direktive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(csp).not.toContain("*");
  });

  it("C2: nicht eingerichtet — keine fremde Herkunft", async () => {
    // Nur die Editor-Adresse, ohne Schlüssel: unvollständig, also nicht eingerichtet.
    const csp = await cspMit({ KLARWERK_OFFICE_EDITOR_URL: "https://editor.beispiel.invalid" });
    expect(direktive(csp, "frame-src")).toEqual(["'self'"]);
    expect(direktive(csp, "form-action")).toEqual(["'self'"]);
    expect(direktive(csp, "frame-ancestors")).toEqual(["'none'"]);
  });
});
