import { describe, expect, it } from "vitest";
import type { Draft, KnowledgeObject } from "../../apps/web/src/api/types";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-354 / FR-STR-06 / G-P1-2: Ein FORTGESETZTER Capture-Entwurf wird beim Einreichen sauber über
// die vorhandene Promote-Route abgeschlossen. Das Frontend macht dazu: drafts.update(aktueller Payload)
// → drafts.promote(id). Dieser E2E prüft genau diese Sequenz über die ECHTEN HTTP-Routen:
//  - Promote erzeugt ein KO mit Status „offen" (nicht validiert, Trust 0, Version 1),
//  - die AKTUELLEN Änderungen (vorher per update geschrieben) sind im KO angekommen (inkl. bodyHtml),
//  - der verbundene Entwurf ist serverseitig aus dem gemeinsamen Pool ENTFERNT,
//  - der Originalautor-Kontext bleibt erhalten (Promote nutzt draft.originalAuthor, FR-CAP-07).
describe("SCRUM-354: Draft → continue → submit (promote) E2E (HTTP)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("promotet den aktualisierten Entwurf zu einem offenen KO und entfernt ihn aus dem Pool", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Autorin", email: "autor@x.de", password: "secret123" },
    });
    const author = await login(app, "autor@x.de", "secret123");
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers: author });
    const authorId = me.json().id as string;

    // 1) Entwurf anlegen (gemeinsamer Pool), zunächst dünn.
    const created = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: author,
      payload: {
        title: "Kompressor K8 starten",
        statement: "Ablauf grob.",
        type: "best_practice",
        category: "Anlage 4",
      },
    });
    expect(created.statusCode).toBe(201);
    const draftId = created.json().id as string;

    // 2) Entwurf wird fortgesetzt (geladen) und im Studio/Formular ausgearbeitet → vor dem Promote
    //    aktualisiert das Frontend den Entwurf mit den AKTUELLEN Inhalten.
    const bodyHtml = applyBodyTemplate("", "procedure", "de");
    const updated = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draftId}`,
      headers: author,
      payload: {
        title: "Kompressor K8 sicher starten",
        statement: "Vor dem Start von Kompressor K8 Ölstand und Druck prüfen.",
        type: "best_practice",
        category: "Anlage 4",
        bodyHtml,
        neededValidations: 1,
      },
    });
    expect(updated.statusCode).toBe(200);

    // 3) Einreichen = Promote der vorhandenen Route → KO entsteht.
    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${draftId}/promote`,
      headers: author,
    });
    expect(promote.statusCode).toBe(201);
    const ko = promote.json() as KnowledgeObject & { bodyHtml?: string };

    // 4) KO ist „offen", nicht validiert, Version 1 — kein Fake-Status.
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.version).toBe(1);
    // 5) Die AKTUELLEN Änderungen sind angekommen (Titel/Statement + strukturierter Body).
    expect(ko.title).toBe("Kompressor K8 sicher starten");
    expect(ko.statement).toContain("Ölstand und Druck prüfen");
    expect(ko.bodyHtml ?? "").toContain("<h2>");
    // 6) Originalautor-Kontext bleibt erhalten (Promote nutzt den Entwurfs-Originalautor).
    expect(ko.author).toBe(authorId);

    // 7) Der verbundene Entwurf ist aus dem gemeinsamen Pool entfernt.
    const draftList = await app.inject({ method: "GET", url: "/api/drafts", headers: author });
    expect((draftList.json() as Draft[]).some((d) => d.id === draftId)).toBe(false);
    const draftGet = await app.inject({
      method: "GET",
      url: `/api/drafts/${draftId}`,
      headers: author,
    });
    expect(draftGet.statusCode).toBe(404);

    // 8) Das KO erscheint als Review-Arbeit im Validation Board (nächster Schritt: Prüfung).
    const board = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: author,
    });
    expect((board.json() as KnowledgeObject[]).some((k) => k.id === ko.id)).toBe(true);
  });
});
