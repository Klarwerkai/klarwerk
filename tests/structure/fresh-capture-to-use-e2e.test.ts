import { describe, expect, it } from "vitest";
import type { AnswerResult, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";
import { applyBodyAssistSection } from "../../apps/web/src/lib/bodyAiAssist";
import { bodyReadMode } from "../../apps/web/src/lib/bodyReadMode";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import { captureNextSteps, captureSavedStatus } from "../../apps/web/src/lib/captureSuccess";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { validationReviewContext } from "../../apps/web/src/lib/validationReviewContext";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-348: Der zentrale Beta-Pfad als zusammenhängender Produktfluss, runtime-nah über die ECHTEN
// HTTP-Routen + Server-Sanitizer + deterministischer Reasoner, verbunden mit den ECHTEN Studio-/
// Anzeige-Helfern: Fresh Capture (Body über die Studio-Helfer aufgebaut) → offenes KO → Validation
// Board → Validierung → validiertes KO → Use/Ask quellengebunden. Kernhärtung: Offenes Wissen bleibt
// ehrlich „offen"/ungeprüft und ist beim Fragen NICHT als gesichert markiert; erst nach echter
// Validierung wird die Antwort „gesichert" und quellengebunden. Keine Fake-Freigabe, keine Auto-Validierung.
describe("SCRUM-348: Fresh Capture → Studio → Review → Use E2E (HTTP + Sanitizer + Reasoner + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  const ask = (app: App, headers: Record<string, string>, question: string) =>
    app.inject({ method: "POST", url: "/api/ask", headers, payload: { question } });

  it("frisch erfasstes, im Studio strukturiertes Wissen ist erst nach Validierung quellengebunden nutzbar", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) Studio-Arbeit nachbilden: leerer Body → Vorlage „procedure" → KI-Abschnitt anhängen.
    //    Genau die Helfer, die KnowledgeInputStudio/BodyTemplateChooser/AiAssistBox aufrufen.
    let bodyHtml = applyBodyTemplate("", "procedure", "de");
    bodyHtml = applyBodyAssistSection(
      bodyHtml,
      "Sicherheitshinweis\nVor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck vollständig ablassen.",
    );
    expect(bodyHtml).toContain("<h3>Sicherheitshinweis</h3>");

    // 2) Fresh Capture über die echte HTTP-Route.
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Hydraulikzylinder HZ7 sicher entlüften",
        statement: "Vor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck ablassen.",
        bodyHtml,
        type: "best_practice",
        category: "Anlage 2",
        neededValidations: 1,
      },
    });
    expect(created.statusCode).toBe(201);
    const ko = created.json() as KnowledgeObject & { bodyHtml: string };
    const koId = ko.id;

    // 3) Frisch = offen, nicht validiert, Trust ehrlich 0, erste Version.
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.version).toBe(1);

    // 4) Server-Sanitizer hält die Studio-Struktur (Überschriften/Listen/Info-Block) erhalten.
    const body = ko.bodyHtml;
    expect(body).toContain("<h2>");
    expect(body).toContain("<h3>Sicherheitshinweis</h3>");
    expect(body).toContain('class="panel panel-info"');
    const quality = editorContentQuality({ bodyHtml: body, attachments: [] });
    expect(quality.isEmpty).toBe(false);
    expect(quality.hasHeadings).toBe(true);
    expect(quality.hasLists).toBe(true);
    expect(quality.hasBlocks).toBe(true);
    expect(bodyReadMode(body)).toEqual({ hasBody: true, hasBlocks: true });

    // 5) Capture-Success-Übergänge sind ehrlich und führen zum echten nächsten Schritt.
    const saved = captureSavedStatus();
    expect(saved.badgeKey).toBe("capture.savedStatusBadge");
    const steps = captureNextSteps(koId);
    expect(steps.find((s) => s.to === `/wissen/${koId}`)).toBeDefined(); // KO ansehen
    const validateStep = steps.find((s) => s.primary);
    expect(validateStep?.to).toContain("/validierung"); // primär: zur Validierung
    expect(steps.some((s) => s.to.includes("non-demo"))).toBe(true); // eigenes Wissen

    // 6) Nutzbarkeit/Status sind NICHT irreführend: needs-work, nicht „ready"; Fokus „neu".
    const before = koOverview(ko);
    expect(before.usability).toBe("needs-work");
    expect(before.trust).toBe(0);
    expect(useReadiness(before.usability).usability).not.toBe("ready");
    expect(validationReviewContext(ko).kind).toBe("new");

    // 7) Offenes KO erscheint im Validation Board als Review-Arbeit.
    const board = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: admin,
    });
    expect(board.statusCode).toBe(200);
    expect((board.json() as KnowledgeObject[]).some((k) => k.id === koId)).toBe(true);

    // 8) USE VOR Validierung: Frage wird beantwortet (Keyword-Treffer), aber EHRLICH ungeprüft —
    //    keine „gesicherte" Antwort, Quelle als nicht validiert / needs-work markiert.
    const askBefore = await ask(app, admin, "Wie wird der Hydraulikzylinder HZ7 entlüftet?");
    expect(askBefore.statusCode).toBe(200);
    const beforeResult = askBefore.json().result as AnswerResult;
    expect(beforeResult.answered).toBe(true);
    expect(beforeResult.sources).toContain(koId);
    expect(beforeResult.knowledgeClass).not.toBe("gesichert"); // offen → ungeprueft
    expect(answerStatus(beforeResult.knowledgeClass).key).toBe("unverified");
    const refBefore = sourceRefs(beforeResult.sources, [ko])[0];
    expect(refBefore?.validated).toBe(false);
    expect(refBefore?.usability).not.toBe("ready");

    // 9) Validierung über die echte HTTP-Bewertung (needed=1 → ein Admin-Up genügt) → validiert/Trust 100.
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode).toBe(200);
    const validated = (
      await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(validated.status).toBe("validiert");
    expect(validated.trust).toBe(100);
    // KO-Detail-Sicht: jetzt nutzbar (ready), konsistent über koOverview → useReadiness.
    const after = koOverview(validated);
    expect(after.usability).toBe("ready");
    expect(useReadiness(after.usability).usability).toBe("ready");

    // 10) USE NACH Validierung: gesichert + quellengebunden, keine Wissenslücke.
    const askAfter = await ask(app, admin, "Wie wird der Hydraulikzylinder HZ7 entlüftet?");
    expect(askAfter.statusCode).toBe(200);
    const afterBody = askAfter.json();
    const afterResult = afterBody.result as AnswerResult;
    expect(afterResult.answered).toBe(true);
    expect(afterResult.knowledgeClass).toBe("gesichert");
    expect(afterResult.sources).toEqual([koId]); // quellengebunden auf genau dieses KO
    expect(answerStatus(afterResult.knowledgeClass).key).toBe("verified");
    expect(afterBody.gap).toBeNull();
    const refAfter = sourceRefs(afterResult.sources, [validated])[0];
    expect(refAfter?.validated).toBe(true);
    expect(refAfter?.usability).toBe("ready");
  });

  it("Use bleibt quellengebunden: Frage ohne passendes Wissen → ehrliche Lücke statt Chatbot-Antwort", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // Leerer Bestand → keine Quelle matcht → keine Rateantwort, ehrliche Wissenslücke.
    const res = await ask(app, admin, "Wie kalibriere ich das Quantenflux-Aggregat ZZZ?");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect((body.result as AnswerResult).answered).toBe(false);
    expect((body.result as AnswerResult).sources).toHaveLength(0);
    expect(body.gap).not.toBeNull();
    expect(body.gap.status).toBe("offen");
  });
});
