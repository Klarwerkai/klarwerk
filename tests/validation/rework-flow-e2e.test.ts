import { describe, expect, it } from "vitest";
import { reviewNextSteps } from "../../apps/web/src/lib/reviewDecision";
import {
  isReviewReworkContext,
  reworkHref,
  reworkValidationHref,
} from "../../apps/web/src/lib/reviewReworkContext";
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

// SCRUM-334: Der Review-Nacharbeitsfluss (SCRUM-330/331/332/333) wird runtime-nah über die ECHTEN
// HTTP-Routen UND die FE-Entscheidungs-/Anzeige-Helfer als zusammenhängender Beta-Workflow geprüft:
// warn/down + Pflichtfeedback (Kommentar) → KO-Detail ?rework=review → Feedback fokussiert erkennbar
// → Revision erhöht Version + macht das KO wieder review-pflichtig → Rückweg /validierung?review=revision.
// Keine Fake-Validierung, keine automatische Freigabe — alles aus realem Backend-Zustand abgeleitet.
describe("SCRUM-334: Review-Nacharbeitsfluss E2E (HTTP + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    return { headers, id: me.json().id as string };
  }

  const getKo = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({ method: "GET", url: `/api/kos/${id}`, headers });

  it("warn/down + Feedback → rework=review → fokussiertes Feedback → Revision → review=revision", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin.headers });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");

    // 1) Reales offenes KO anlegen (needed=2).
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        title: "Presse P2 entlüften",
        statement: "Vor Wartung Druck ablassen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 2,
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(created.json().status).toBe("offen");

    // 2) Reviewerin (Carla, ko.validate) entscheidet "down" MIT Pflichtfeedback — wie im FE-Flow:
    //    erst der Feedback-Kommentar (stabiles Präfix), dann die Bewertung.
    const feedbackText = "Quelle fehlt und Druckwert ist nicht belegt.";
    const comment = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: carla.headers,
      payload: { action: "comment", text: buildValidationFeedback("down", feedbackText) },
    });
    expect(comment.statusCode).toBe(200);
    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: carla.headers,
      payload: { action: "rate", verdict: "down" },
    });
    expect(rated.statusCode).toBe(200);

    // 3) Feedback-Kommentar ist real gespeichert; down hält das KO offen (keine Validierung).
    const afterReview = (await getKo(app, admin.headers, id)).json();
    expect(afterReview.status).toBe("offen");
    expect(
      (afterReview.comments ?? []).some((c: { text: string }) =>
        c.text.startsWith("Validierungsfeedback (Ablehnung): "),
      ),
    ).toBe(true);

    // 4) FE-Entscheidung: warn/down führen mit Nacharbeitskontext ins KO-Detail (?rework=review).
    const steps = reviewNextSteps({ id, title: afterReview.title, verdict: "down" });
    expect(steps).toHaveLength(1);
    expect(steps[0]?.to).toBe(reworkHref(id));
    expect(steps[0]?.to).toBe(`/wissen/${id}?rework=review`);
    expect(isReviewReworkContext(new URLSearchParams("rework=review"))).toBe(true);

    // 5) KO-Detail erkennt im Rework-Kontext das konkrete Feedback fokussiert (SCRUM-332/333).
    const fb = latestValidationFeedback(afterReview.comments);
    expect(fb).not.toBeNull();
    expect(fb?.verdict).toBe("down");
    expect(fb?.body).toBe(feedbackText);

    // 6) Revision speichern (ko.revise) — neue Version + zurück auf review-pflichtig.
    const revised = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin.headers,
      payload: {
        action: "revise",
        changes: { statement: "Vor Wartung Druck ablassen; Quelle: Wartungshandbuch P2, S. 12." },
      },
    });
    expect(revised.statusCode).toBe(200);
    const revisedKo = (await getKo(app, admin.headers, id)).json();
    expect(revisedKo.version).toBe(2);
    expect(revisedKo.status).toBe("offen"); // muss neu validiert werden
    expect(revisedKo.trust).toBe(0); // Bewertungen zurückgesetzt

    // 7) Validation-Fokus: das revidierte KO zählt als „überarbeitet"; Rückweg führt in diesen Fokus.
    expect(validationReviewContext(revisedKo).kind).toBe("revision");
    expect(reworkValidationHref()).toBe(`/validierung?${REVIEW_FOCUS_PARAM}=revision`);
    const backUrl = reworkValidationHref();
    const backParams = new URLSearchParams(backUrl.split("?")[1] ?? "");
    expect(readReviewFocusFilter(backParams)).toBe("revision");

    // 8) Ehrlichkeit: das frische KO (Version 1) bleibt „neu" — der Fokus trennt neu vs. überarbeitet.
    expect(validationReviewContext({ version: 1 }).kind).toBe("new");
  });
});
