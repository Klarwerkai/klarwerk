import { describe, expect, it } from "vitest";
import type { AnswerResult, Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import { conflictImpact, effectiveUsability } from "../../apps/web/src/lib/conflictImpact";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { TRUTH_CONFLICT_TRUST_PENALTY } from "../../services/knowledge-object";

// SCRUM-358 / AG-05 / AG-14-SERVER-TRUST / VC-P1-1 / FR-VAL-01: serverseitige Trust-/Status-Integrität.
// Ein offener WAHRHEITSKONFLIKT gegen ein VALIDIERTES KO holt es serverseitig zurück in Review
// (Status validiert→offen, Trust konservativ gesenkt) — keine Fake-Wahrheit, kein Reset auf 0.
// Serverdaten widersprechen damit der FE-Ehrlichkeit aus SCRUM-357 nicht mehr. Gelöster Konflikt
// blockiert nicht dauerhaft: das KO bleibt review-pflichtig und wird normal erneut validiert.
describe("SCRUM-358: Conflict → serverseitige Trust-/Status-Wirkung (HTTP)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function createKo(
    app: App,
    headers: Record<string, string>,
    title: string,
    statement: string,
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement,
        type: "best_practice",
        category: "Anlage 2",
        neededValidations: 1,
      },
    });
    return res.json() as KnowledgeObject;
  }

  const getKo = async (app: App, headers: Record<string, string>, id: string) =>
    (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json() as KnowledgeObject;

  const rateUp = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  const listConflicts = async (app: App, headers: Record<string, string>) =>
    (await app.inject({ method: "GET", url: "/api/conflicts", headers })).json() as Conflict[];

  it("validiertes KO + offener Truth-Konflikt → serverseitig offen + Trust gesenkt; Board/Ask konsistent; resolve blockt nicht dauerhaft", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) Zwei KOs; KO-A validieren (needed=1) → validiert/Trust 100.
    const koA = await createKo(
      app,
      admin,
      "Hydraulikzylinder HZ7 entlüften",
      "Vor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck ablassen.",
    );
    const koB = await createKo(
      app,
      admin,
      "Hydraulikzylinder HZ7 Druck",
      "Der Hydraulikzylinder HZ7 darf unter Druck entlüftet werden.",
    );
    await rateUp(app, admin, koA.id);
    const validatedA = await getKo(app, admin, koA.id);
    expect(validatedA.status).toBe("validiert");
    expect(validatedA.trust).toBe(100);

    // 2) Truth-Konflikt zwischen A und B über den echten KO-Dispatcher.
    const created = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers: admin,
      payload: {
        action: "conflict",
        conflict: {
          koA: koA.id,
          koB: koB.id,
          type: "truth",
          description: "Widerspruch zur Druckablass-Reihenfolge bei HZ7.",
        },
      },
    });
    expect(created.statusCode).toBe(201);
    const conflictId = (created.json() as Conflict).id;

    // 3) SERVERSEITIG: KO-A nicht mehr „validiert/voll vertrauenswürdig" — zurück in Review,
    //    Trust konservativ gesenkt (kleine Strafe, KEIN Reset auf 0 → keine Aussage „falsch").
    const reviewedA = await getKo(app, admin, koA.id);
    expect(reviewedA.status).toBe("offen");
    expect(reviewedA.trust).toBe(100 - TRUTH_CONFLICT_TRUST_PENALTY);
    expect(reviewedA.trust).toBeGreaterThan(0); // nicht zerstört, nur eingeschränkt

    // 4) Board zeigt das zurückgeholte KO wieder als Review-Arbeit (board = status offen).
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers: admin });
    expect((board.json() as KnowledgeObject[]).some((k) => k.id === koA.id)).toBe(true);

    // 5) KONSISTENZ Server↔FE: koOverview ist jetzt selbst nicht mehr „ready"; die SCRUM-357-Ableitung
    //    widerspricht nicht (effectiveUsability bleibt ≠ ready, Konflikt weiterhin als Impact erkannt).
    const conflicts = await listConflicts(app, admin);
    expect(koOverview(reviewedA).usability).not.toBe("ready");
    expect(effectiveUsability(reviewedA, conflicts)).not.toBe("ready");
    expect(conflictImpact(koA.id, conflicts).hasTruth).toBe(true);

    // 6) Ask: konfliktbetroffene Quelle erscheint nicht als „ready" (kein Widerspruch).
    const askRes = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: "Wie wird der Hydraulikzylinder HZ7 entlüftet?" },
    });
    const result = askRes.json().result as AnswerResult;
    if (result.answered && result.sources.length > 0) {
      const kos = [reviewedA, await getKo(app, admin, koB.id)];
      const known = conflictAwareSourceRefs(result.sources, kos, conflicts).filter((s) => s.known);
      for (const r of known) {
        expect(r.usability).not.toBe("ready");
      }
    }

    // 7) RESOLVE blockt nicht dauerhaft: nach dem Lösen bleibt KO-A review-pflichtig (offen), wird aber
    //    über die normale Bewertung wieder validiert (kein Fake-Validate, kein Dauer-Block).
    const resolved = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers: admin,
      payload: {
        action: "resolve-conflict",
        conflictId,
        decision: "A gilt: Druck zuerst ablassen.",
      },
    });
    expect(resolved.statusCode).toBe(200);
    const afterResolve = await getKo(app, admin, koA.id);
    expect(afterResolve.status).toBe("offen"); // bewusst review-pflichtig, nicht auto-validiert

    await rateUp(app, admin, koA.id);
    const revalidatedA = await getKo(app, admin, koA.id);
    expect(revalidatedA.status).toBe("validiert");
    expect(revalidatedA.trust).toBe(100);
  });

  it("Nicht-Wahrheitskonflikt lässt den Server-Status eines validierten KO unverändert (nur FE-Hinweis)", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    const koA = await createKo(app, admin, "Ventil A", "Ventil A schließt bei Überdruck.");
    const koB = await createKo(app, admin, "Ventil B", "Ventil B bleibt bei Überdruck offen.");
    await rateUp(app, admin, koA.id);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers: admin,
      payload: {
        action: "conflict",
        conflict: { koA: koA.id, koB: koB.id, type: "experience", description: "Erfahrungsdiff." },
      },
    });
    // Nicht-Truth: Server-Status/Trust bleiben (kein automatischer Review-Rückzug); die FE-Ehrlichkeit
    // aus SCRUM-357 markiert es weiterhin als konfliktbegrenzt.
    const stillValidated = await getKo(app, admin, koA.id);
    expect(stillValidated.status).toBe("validiert");
    expect(stillValidated.trust).toBe(100);
  });
});
