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
import { demoKennwort } from "../support/demoZugang";

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
    // AUFTRAG-mega64 Block A: das Kennwort kommt aus der Seed-ANTWORT, nicht mehr aus dem Quelltext.
    const seed = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: admin.headers,
    });
    const carla = await login(
      app,
      "carla@demo.klarwerk",
      demoKennwort(seed, "carla@demo.klarwerk"),
    );

    // 1) Reales offenes KO anlegen (needed=2).
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.headers,
      payload: {
        confidentiality: "intern",
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

  // ==============================================================================================
  // R-0238 · WIDERSPRECHENDE ABLEHNUNG → KONFLIKTVORSCHLAG (UI/UX-Brief Screen 5).
  // ==============================================================================================
  //
  // Eine Ablehnung, die einem benannten anderen Objekt widerspricht, legt im SELBEN Aufruf einen
  // Konfliktvorschlag an: manueller Konflikt zwischen beiden, Status „offen", die Ablehnende als
  // `createdBy`. Gemessen über die echten Routen `PUT /api/kos/:id` und `GET /api/conflicts`.
  async function zweiObjekte() {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    const seed = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: admin.headers,
    });
    const carla = await login(
      app,
      "carla@demo.klarwerk",
      demoKennwort(seed, "carla@demo.klarwerk"),
    );
    const anlegen = async (title: string, statement: string) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: admin.headers,
        payload: {
          confidentiality: "intern",
          title,
          statement,
          type: "best_practice",
          category: "Anlage 1",
          neededValidations: 2,
        },
      });
      expect(res.statusCode).toBe(201);
      return res.json().id as string;
    };
    const a = await anlegen("Presse P2 Druck 6 bar", "Die Presse P2 läuft mit 6 bar.");
    const b = await anlegen("Presse P2 Druck 8 bar", "Die Presse P2 läuft mit 8 bar.");
    return { app, services, admin, carla, a, b };
  }

  async function konflikteZwischen(
    app: App,
    headers: Record<string, string>,
    a: string,
    b: string,
  ) {
    const res = await app.inject({ method: "GET", url: "/api/conflicts", headers });
    expect(res.statusCode).toBe(200);
    return (res.json() as Array<Record<string, unknown>>).filter(
      (c) => (c.koA === a && c.koB === b) || (c.koA === b && c.koB === a),
    );
  }

  async function stimmenVon(app: App, headers: Record<string, string>, id: string) {
    const res = await app.inject({ method: "GET", url: "/api/validation/board", headers });
    expect(res.statusCode).toBe(200);
    const zeile = (res.json() as Array<{ id: string; reviewVotes?: { down: number } }>).find(
      (k) => k.id === id,
    );
    return zeile?.reviewVotes?.down ?? 0;
  }

  it("R-0238: die widersprechende Ablehnung legt einen Konfliktvorschlag an", async () => {
    const { app, admin, carla, a, b } = await zweiObjekte();
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);

    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: {
        action: "rate",
        verdict: "down",
        widerspruch: { koB: b, type: "truth", description: "Widerspricht dem 8-bar-Eintrag." },
      },
    });
    expect(rated.statusCode).toBe(200);
    expect(rated.json().konfliktvorschlag).toMatchObject({ koA: a, koB: b, status: "offen" });

    const konflikte = await konflikteZwischen(app, admin.headers, a, b);
    expect(konflikte).toHaveLength(1);
    expect(konflikte[0]).toMatchObject({
      type: "truth",
      status: "offen",
      origin: "manual",
      createdBy: carla.id,
    });
    // Die Ablehnung selbst ist gezählt — der Vorschlag ersetzt sie nicht.
    expect(await stimmenVon(app, admin.headers, a)).toBe(1);
  });

  it("R-0238: eine Ablehnung OHNE Widerspruch legt keinen Konflikt an", async () => {
    const { app, admin, carla, a, b } = await zweiObjekte();
    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: { action: "rate", verdict: "down" },
    });
    expect(rated.statusCode).toBe(200);
    expect(rated.json().konfliktvorschlag).toBeUndefined();
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);
  });

  it("R-0238: ungültige Widersprüche werden VOR der Bewertung abgewiesen — nichts wird gezählt", async () => {
    const { app, admin, carla, a, b } = await zweiObjekte();
    const fremd = { koB: "gibt-es-nicht", type: "truth" };
    const faelle: Array<[string, Record<string, unknown>, number]> = [
      ["an der Zustimmung", { verdict: "up", widerspruch: { koB: b, type: "truth" } }, 400],
      ["gegen sich selbst", { verdict: "down", widerspruch: { koB: a, type: "truth" } }, 400],
      ["ohne Art", { verdict: "down", widerspruch: { koB: b } }, 400],
      ["unbekannte Art", { verdict: "down", widerspruch: { koB: b, type: "raten" } }, 400],
      ["unbekanntes Gegenüber", { verdict: "down", widerspruch: fremd }, 404],
    ];
    for (const [name, payload, status] of faelle) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${a}`,
        headers: carla.headers,
        payload: { action: "rate", ...payload },
      });
      expect(res.statusCode, name).toBe(status);
    }
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);
    expect(await stimmenVon(app, admin.headers, a)).toBe(0);
  });

  // ==============================================================================================
  // R-0238 · Nacharbeit 7 — DIE TEILERFOLGE ZWISCHEN BEWERTUNG UND KONFLIKTVORSCHLAG.
  // ==============================================================================================
  //
  // Die Bewertung wird zuerst gespeichert. Scheitert danach ein Konfliktschritt, sagt die Antwort
  // GENAU, welcher fehlt (Nacharbeit 8): der Vorschlag selbst (`KONFLIKTVORSCHLAG_OFFEN`) oder
  // nur seine Folge (`KONFLIKTFOLGE_OFFEN`, der Vorschlag steht). Sie nennt die bewertete Fassung.
  // Die Fortsetzung schickt `fortsetzungFuerFassung` und BEWERTET NICHT NOCH EINMAL — belegt am
  // Audit: genau ein `ko.rated` der Ablehnenden. Eingespeist wird der Fehler an den echten
  // Dienstinstanzen, die die Route benutzt — einmal, danach läuft der Dienst normal.
  const ABLEHNUNG = (b: string) => ({
    action: "rate",
    verdict: "down",
    widerspruch: { koB: b, type: "truth", description: "Widerspricht dem 8-bar-Eintrag." },
  });

  /** Wie oft die Person dieses Objekt bewertet hat — gezählt am Audit, nicht an den Stimmen. */
  async function bewertungsereignisse(
    app: App,
    headers: Record<string, string>,
    actor: string,
    target: string,
  ) {
    const res = await app.inject({
      method: "GET",
      url: `/api/audit?action=ko.rated&actor=${encodeURIComponent(actor)}`,
      headers,
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as Array<{ target: string }>).filter((e) => e.target === target).length;
  }

  /** `conflicts.create` scheitert genau einmal, danach läuft der echte Dienst. */
  function anlageScheitertEinmal(services: ReturnType<typeof buildServices>): void {
    const original = services.conflicts.create.bind(services.conflicts);
    let einmal = true;
    services.conflicts.create = (async (...args: Parameters<typeof original>) => {
      if (einmal) {
        einmal = false;
        throw new Error("Ablage nicht erreichbar");
      }
      return original(...args);
    }) as typeof services.conflicts.create;
  }

  /** Die Wahrheitskonflikt-Folge scheitert genau einmal — NACH dem Anlegen des Konflikts. */
  function folgeScheitertEinmal(services: ReturnType<typeof buildServices>): void {
    const original = services.ko.markTruthConflictReview.bind(services.ko);
    let einmal = true;
    services.ko.markTruthConflictReview = (async (...args: Parameters<typeof original>) => {
      if (einmal) {
        einmal = false;
        throw new Error("Folge gescheitert");
      }
      return original(...args);
    }) as typeof services.ko.markTruthConflictReview;
  }

  it("R-0238: scheitert der Vorschlag nach der Bewertung, sagt die Antwort es — die Fortsetzung bewertet nicht erneut", async () => {
    const { app, services, admin, carla, a, b } = await zweiObjekte();
    anlageScheitertEinmal(services);

    const erster = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: ABLEHNUNG(b),
    });
    expect(erster.statusCode).toBe(500);
    expect(erster.json()).toMatchObject({
      error: "KONFLIKTVORSCHLAG_OFFEN",
      bewertungGespeichert: true,
      konfliktAngelegt: false,
      bewerteteFassung: 1,
    });
    // Wahr ist: die Ablehnung steht, der Vorschlag nicht.
    expect(await stimmenVon(app, admin.headers, a)).toBe(1);
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);

    const zweiter = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: { ...ABLEHNUNG(b), fortsetzungFuerFassung: 1 },
    });
    expect(zweiter.statusCode).toBe(200);
    expect(await konflikteZwischen(app, admin.headers, a, b)).toHaveLength(1);
    expect(await stimmenVon(app, admin.headers, a)).toBe(1);
    expect(await bewertungsereignisse(app, admin.headers, carla.id, a)).toBe(1);
  });

  it("R-0238: scheitert erst die Folge NACH dem Anlegen, sagt die Antwort, dass der Vorschlag steht — die Fortsetzung legt keinen zweiten an", async () => {
    const { app, services, admin, carla, a, b } = await zweiObjekte();
    folgeScheitertEinmal(services);

    const erster = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: ABLEHNUNG(b),
    });
    expect(erster.statusCode).toBe(500);
    // Der Konflikt war schon geschrieben, als die Folge scheiterte — und genau das sagt die Antwort.
    const konflikteNachher = await konflikteZwischen(app, admin.headers, a, b);
    expect(konflikteNachher).toHaveLength(1);
    expect(erster.json()).toMatchObject({
      error: "KONFLIKTFOLGE_OFFEN",
      bewertungGespeichert: true,
      konfliktAngelegt: true,
      konfliktId: konflikteNachher[0]?.id,
      bewerteteFassung: 1,
    });

    const zweiter = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: { ...ABLEHNUNG(b), fortsetzungFuerFassung: 1 },
    });
    expect(zweiter.statusCode).toBe(200);
    const konflikte = await konflikteZwischen(app, admin.headers, a, b);
    expect(konflikte).toHaveLength(1);
    expect(zweiter.json().konfliktvorschlag?.id).toBe(konflikte[0]?.id);
    expect(await stimmenVon(app, admin.headers, a)).toBe(1);
    expect(await bewertungsereignisse(app, admin.headers, carla.id, a)).toBe(1);
  });

  it("R-0238: Teilerfolg → Revision → Fortsetzung: keine neue Bewertung, kein Vorschlag, 409", async () => {
    const { app, services, admin, carla, a, b } = await zweiObjekte();
    anlageScheitertEinmal(services);
    const erster = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: ABLEHNUNG(b),
    });
    expect(erster.statusCode).toBe(500);
    expect(erster.json().bewerteteFassung).toBe(1);

    // Der Verantwortliche überarbeitet das zurückgegebene Objekt — Fassung 2, neu zu prüfen.
    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: admin.headers,
      payload: { action: "revise", changes: { statement: "Die Presse P2 läuft mit 7 bar." } },
    });
    expect(revidiert.statusCode).toBe(200);
    expect((await getKo(app, admin.headers, a)).json().version).toBe(2);

    const fortsetzung = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: { ...ABLEHNUNG(b), fortsetzungFuerFassung: 1 },
    });
    expect(fortsetzung.statusCode).toBe(409);
    expect(fortsetzung.json()).toMatchObject({ error: "FASSUNG_UEBERARBEITET", currentVersion: 2 });
    // Nichts ist entstanden: kein Vorschlag, keine Bewertung der neuen Fassung, kein zweites
    // Bewertungsereignis — der Revisionsweg bleibt, wie er ist.
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);
    expect(await stimmenVon(app, admin.headers, a)).toBe(0);
    expect(await bewertungsereignisse(app, admin.headers, carla.id, a)).toBe(1);
  });

  it("R-0238: eine Fortsetzung ohne bestehende Ablehnung dieser Fassung wird abgewiesen", async () => {
    const { app, admin, carla, a, b } = await zweiObjekte();
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: carla.headers,
      payload: { ...ABLEHNUNG(b), fortsetzungFuerFassung: 1 },
    });
    expect(res.statusCode).toBe(409);
    expect(await konflikteZwischen(app, admin.headers, a, b)).toEqual([]);
    expect(await bewertungsereignisse(app, admin.headers, carla.id, a)).toBe(0);
  });
});
