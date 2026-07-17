import { describe, expect, it, vi } from "vitest";
import { ModelProvider, Reasoner } from "../../../reasoner";
import { buildApp, buildServices } from "../build-app";

// SCRUM-502 R6: die Egress-Garantie wird an den TATSÄCHLICHEN reasoner-Aktionsrouten geprüft
// (/api/reasoner task=extract/assist), nicht nur über check-text. Spy = der EINE Modell-Chokepoint
// (client.complete). Vertraulicher Text → complete NIE aufgerufen (kein Cloud-Egress); bewusst
// intern → complete läuft.
describe("SCRUM-502 R6: /api/reasoner egress (echter complete-Spy)", () => {
  const DOC =
    "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften und den Druck prüfen. " +
    "Bei Überdruck sofort das Ventil schließen und den Vorgang dokumentieren.";

  function appWithSpy() {
    const complete = vi.fn(async () => '{"points": []}');
    const services = buildServices();
    // Nur ein Cloud-Provider (usingPrimary), KEIN lokaler → vertraulich landet deterministisch,
    // die Cloud (dieser Spy) darf NIE laufen.
    (services as unknown as { reasoner: Reasoner }).reasoner = new Reasoner(
      new ModelProvider({ name: "cloud-spy", complete }),
    );
    return { app: buildApp(services), complete };
  }

  async function login(app: ReturnType<typeof buildApp>) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("extract: Upload (transient-document) OHNE Stufe → Cloud-complete NIE aufgerufen", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "extract", text: DOC, source: "transient-document" }, // fehlt Stufe → fail-safe
    });
    expect(res.statusCode).toBe(200);
    expect(complete).not.toHaveBeenCalled();
  });

  it("assist: Editor-Text (draft) ohne Stufe → Cloud-complete NIE aufgerufen", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "assist", text: DOC, source: "draft" }, // fehlt Stufe → fail-safe vertraulich
    });
    expect(res.statusCode).toBe(200);
    expect(complete).not.toHaveBeenCalled();
  });

  it("extract: transient-document + koId eines INTERNEN KOs OHNE Stufe → erbt NICHT → complete null", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    // Ein internes (nicht vertrauliches) KO als Ziel-Behälter anlegen.
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Intern",
        statement: "Interner Kerntext.",
        type: "best_practice",
        category: "A",
      },
    });
    const koId = created.json().id as string;
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "extract", text: DOC, source: "transient-document", koId }, // keine Stufe
    });
    expect(res.statusCode).toBe(200);
    expect(complete).not.toHaveBeenCalled(); // kein Erben der intern-Container-Stufe
  });

  it("Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "extract",
        text: DOC,
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(200);
    expect(complete).toHaveBeenCalled();
  });
});
