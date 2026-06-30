import { describe, expect, it } from "vitest";
import type { AnswerResult, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";
import { applyBodyAssistSection } from "../../apps/web/src/lib/bodyAiAssist";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import { studioSaveConfidence } from "../../apps/web/src/lib/editorApplySafety";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { reviewNextSteps } from "../../apps/web/src/lib/reviewDecision";
import {
  isReviewReworkContext,
  reworkHref,
  reworkNextSteps,
  reworkValidationHref,
} from "../../apps/web/src/lib/reviewReworkContext";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import {
  buildValidationFeedback,
  latestValidationFeedback,
} from "../../apps/web/src/lib/validationFeedback";
import {
  REVIEW_FOCUS_PARAM,
  readReviewFocusFilter,
  validationReviewContext,
} from "../../apps/web/src/lib/validationReviewContext";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-349: Der zweite Beta-Kernpfad als zusammenhängender Produktfluss, runtime-nah über die ECHTEN
// HTTP-Routen + Server-Sanitizer + deterministischer Reasoner, verbunden mit den ECHTEN Review-/Rework-/
// Studio-/Anzeige-Helfern: Review-Feedback (down) → KO-Detail-Rework → Studio-Revision → Revision-Save
// → Validation-Fokus „revision" → erneute Validierung → Use/Ask quellengebunden. Kernhärtung: Die
// Revision bleibt nach dem Speichern EHRLICH offen/ungeprüft (Trust 0, Version > 1) und ist erst nach
// erneuter echter Validierung gesichert/quellengebunden nutzbar. Keine Fake-Freigabe, keine Auto-Validierung.
// Bewusst sauberer Bestand (nur dieses KO) für deterministische Quellenbindung; der getrennte
// Reviewer-Fall ist bereits in rework-flow-e2e.test.ts (SCRUM-334) abgedeckt.
describe("SCRUM-349: Review → Rework → Revalidation → Use E2E (HTTP + Sanitizer + Reasoner + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  const getKo = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({ method: "GET", url: `/api/kos/${id}`, headers });

  const ask = (app: App, headers: Record<string, string>, question: string) =>
    app.inject({ method: "POST", url: "/api/ask", headers, payload: { question } });

  it("zurückgegebenes Wissen ist nach Rework-Revision erst mit erneuter Validierung quellengebunden nutzbar", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) Offenes KO mit strukturiertem Studio-Body (Vorlage), eindeutiges Stichwort für Quellenbindung.
    const initialBody = applyBodyTemplate("", "procedure", "de");
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Spezialpresse SPX9 entlüften",
        statement: "Vor Wartung der Spezialpresse SPX9 den Druck ablassen.",
        bodyHtml: initialBody,
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 1,
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(created.json().status).toBe("offen");

    // 2) Review-Entscheidung „down" MIT Pflichtfeedback (FE-Flow: erst Kommentar, dann Bewertung).
    const feedbackText = "Quelle fehlt; Druckwert für SPX9 ist nicht belegt.";
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "comment", text: buildValidationFeedback("down", feedbackText) },
    });
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "rate", verdict: "down" },
    });

    // 3) down hält das KO offen (keine Validierung); Feedback ist real gespeichert.
    const afterReview = (await getKo(app, admin, id)).json() as KnowledgeObject & {
      comments?: { text: string }[];
    };
    expect(afterReview.status).toBe("offen");

    // 4) FE-Entscheidung: down → Nacharbeit im KO-Detail (?rework=review).
    const steps = reviewNextSteps({ id, title: afterReview.title, verdict: "down" });
    expect(steps).toHaveLength(1);
    expect(steps[0]?.to).toBe(reworkHref(id));
    expect(steps[0]?.to).toBe(`/wissen/${id}?rework=review`);
    expect(isReviewReworkContext(new URLSearchParams("rework=review"))).toBe(true);

    // 5) Rework-Kontext zeigt das konkrete Feedback fokussiert + geordnete Nacharbeitsschritte.
    const fb = latestValidationFeedback(afterReview.comments);
    expect(fb?.verdict).toBe("down");
    expect(fb?.body).toBe(feedbackText);
    expect(reworkNextSteps().map((s) => s.key)).toEqual(["feedback", "revise", "back"]);

    // 6) Studio-Revision: Autor adressiert das Feedback, hängt eine Quellen-Section an (echter Helfer).
    const revisedBody = applyBodyAssistSection(
      afterReview.bodyHtml ?? "",
      "Quelle\nDruckwert SPX9 laut Wartungshandbuch SPX9, S. 12: max. 180 bar vor Entlüftung ablassen.",
    );
    expect(revisedBody).toContain("<h3>Quelle</h3>");
    // Save-Confidence im Revisions-Kontext bleibt ehrlich (neue Version + erneute Prüfung).
    const conf = studioSaveConfidence("revision");
    expect(conf).toMatchObject({ titleKey: "studio.save.revision.title", tone: "warn" });

    // 7) Revision speichern (ko.revise) — neue Version, wieder offen, Trust zurückgesetzt.
    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "revise",
        changes: {
          statement: "Vor Wartung der Spezialpresse SPX9 den Druck ablassen (max. 180 bar).",
          bodyHtml: revisedBody,
        },
      },
    });
    expect(revised.statusCode).toBe(200);
    const revisedKo = (await getKo(app, admin, id)).json() as KnowledgeObject & {
      bodyHtml: string;
    };
    expect(revisedKo.version).toBe(2);
    expect(revisedKo.status).toBe("offen"); // muss erneut validiert werden
    expect(revisedKo.trust).toBe(0); // Bewertungen zurückgesetzt
    // Server-sanitisierter Revisions-Body hält die Struktur + die neue Quellen-Section.
    expect(revisedKo.bodyHtml).toContain("<h3>Quelle</h3>");
    expect(revisedKo.bodyHtml).toContain('class="panel panel-info"');
    expect(revisedKo.bodyHtml.toLowerCase()).not.toContain("<script");

    // 8) Validation-Fokus: das revidierte KO zählt als „überarbeitet"; Rückweg führt in diesen Fokus.
    expect(validationReviewContext(revisedKo).kind).toBe("revision");
    expect(reworkValidationHref()).toBe(`/validierung?${REVIEW_FOCUS_PARAM}=revision`);
    const backParams = new URLSearchParams(reworkValidationHref().split("?")[1] ?? "");
    expect(readReviewFocusFilter(backParams)).toBe("revision");
    // Revidiertes KO ist auf dem Validation Board sichtbar.
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers: admin });
    expect((board.json() as KnowledgeObject[]).some((k) => k.id === id)).toBe(true);

    // 9) USE VOR erneuter Validierung: beantwortet (Treffer), aber EHRLICH ungeprüft.
    const askBefore = await ask(app, admin, "Wie wird die Spezialpresse SPX9 entlüftet?");
    const beforeResult = askBefore.json().result as AnswerResult;
    expect(beforeResult.answered).toBe(true);
    expect(beforeResult.sources).toContain(id);
    expect(beforeResult.knowledgeClass).not.toBe("gesichert");
    expect(answerStatus(beforeResult.knowledgeClass).key).toBe("unverified");
    expect(koOverview(revisedKo).usability).not.toBe("ready");

    // 10) Erneute Validierung (needed=1 → ein Up genügt) → validiert/Trust 100.
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    const revalidated = (await getKo(app, admin, id)).json() as KnowledgeObject;
    expect(revalidated.status).toBe("validiert");
    expect(revalidated.trust).toBe(99); // SCRUM-359: Trust-Deckel 99 (PI-K2)
    expect(revalidated.version).toBe(2); // die Revision selbst ist jetzt gesichert
    expect(koOverview(revalidated).usability).toBe("ready");
    expect(useReadiness(koOverview(revalidated).usability).usability).toBe("ready");

    // 11) USE NACH erneuter Validierung: gesichert + quellengebunden auf genau diese Revision.
    const askAfter = await ask(app, admin, "Wie wird die Spezialpresse SPX9 entlüftet?");
    const afterBody = askAfter.json();
    const afterResult = afterBody.result as AnswerResult;
    expect(afterResult.answered).toBe(true);
    expect(afterResult.knowledgeClass).toBe("gesichert");
    expect(afterResult.sources).toEqual([id]);
    expect(answerStatus(afterResult.knowledgeClass).key).toBe("verified");
    expect(afterBody.gap).toBeNull();
    const refAfter = sourceRefs(afterResult.sources, [revalidated])[0];
    expect(refAfter?.validated).toBe(true);
    expect(refAfter?.usability).toBe("ready");
  });
});
