import { describe, expect, it } from "vitest";
import type { AnswerResult, Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerStatus, conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import {
  conflictImpact,
  conflictLimitedUsability,
  conflictNotice,
  effectiveUsability,
} from "../../apps/web/src/lib/conflictImpact";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-357 / AG-14 / VC-P1-1 / FR-VAL-01: Runtime-/API-E2E über die ECHTEN HTTP-Routen.
// Validiertes KO + offener Truth-Konflikt → Nutzbarkeit/Trust/Review ehrlich eingeschränkt (KO-Detail/
// Library/Ask sagen dasselbe), OHNE serverseitige Status-/Trust-Mutation (keine Fake-Wahrheit). Gelöster
// Konflikt blockiert NICHT weiter. Antwortlogik/Status/Trust serverseitig unverändert (Begründung im Ticket).
describe("SCRUM-357: Conflict → Trust/Usability/Review-Integrität (HTTP + FE-Helfer)", () => {
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

  async function getKo(app: App, headers: Record<string, string>, id: string) {
    return (
      await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })
    ).json() as KnowledgeObject;
  }

  async function listConflicts(app: App, headers: Record<string, string>) {
    return (
      await app.inject({ method: "GET", url: "/api/conflicts", headers })
    ).json() as Conflict[];
  }

  it("validiertes KO mit offenem Truth-Konflikt wirkt nicht mehr uneingeschränkt nutzbar/gesichert; gelöst blockt nicht", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) Zwei KOs anlegen; KO-A validieren (needed=1 → ein Up genügt) → validiert/Trust 100.
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
    await app.inject({
      method: "PUT",
      url: `/api/kos/${koA.id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    const validatedA = await getKo(app, admin, koA.id);
    expect(validatedA.status).toBe("validiert");
    expect(validatedA.trust).toBe(100);
    // Rohzustand wäre „ready" — ohne Konflikt.
    expect(koOverview(validatedA).usability).toBe("ready");
    expect(conflictImpact(koA.id, []).limited).toBe(false);

    // 2) Truth-Konflikt zwischen A und B über den echten KO-Dispatcher anlegen.
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

    // 3) Konflikt ist serverseitig „offen" und in der unresolved-Liste; KO-Status/Trust UNVERÄNDERT
    //    (keine serverseitige Mutation — bewusste Entscheidung, keine Fake-Wahrheit).
    let conflicts = await listConflicts(app, admin);
    expect(conflicts.some((c) => c.id === conflictId && c.status === "offen")).toBe(true);
    const stillValidatedA = await getKo(app, admin, koA.id);
    expect(stillValidatedA.status).toBe("validiert");
    expect(stillValidatedA.trust).toBe(100);

    // 4) ABER die zentrale Ableitung schränkt Nutzbarkeit/Review ehrlich ein (KO-Detail/Library):
    const impact = conflictImpact(koA.id, conflicts);
    expect(impact.limited).toBe(true);
    expect(impact.hasTruth).toBe(true);
    expect(conflictLimitedUsability(koOverview(stillValidatedA).usability, impact)).toBe(
      "in-review",
    );
    expect(useReadiness(effectiveUsability(stillValidatedA, conflicts)).usability).not.toBe(
      "ready",
    );
    const notice = conflictNotice(impact);
    expect(notice?.titleKey).toBe("conflict.impact.truthTitle");
    expect(notice?.to).toBe("/konflikte");

    // 5) Ask: Antwort bleibt serverseitig quellengebunden; die KONFLIKTBEWUSSTE Quellensicht zeigt das
    //    Quell-KO NICHT als uneingeschränkt nutzbar (kein „ready"), klar als konfliktbegrenzt markiert.
    const askRes = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: "Wie wird der Hydraulikzylinder HZ7 entlüftet?" },
    });
    const result = askRes.json().result as AnswerResult;
    expect(result.answered).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
    // Beide KOs (A und B) stehen im selben Truth-Konflikt → jede gebundene, bekannte Quelle ist
    // konfliktbegrenzt und erscheint NICHT als „ready" (unabhängig davon, welches KO gebunden wurde).
    const kos = [stillValidatedA, await getKo(app, admin, koB.id)];
    const knownRefs = conflictAwareSourceRefs(result.sources, kos, conflicts).filter(
      (s) => s.known,
    );
    expect(knownRefs.length).toBeGreaterThan(0);
    for (const r of knownRefs) {
      expect(r.conflictLimited).toBe(true);
      expect(r.usability).not.toBe("ready");
    }
    // Server-Status der Antwort bleibt unverändert (kein Eingriff in die Antwortlogik) …
    expect(answerStatus(result.knowledgeClass)).toBeDefined();

    // 6) Konflikt lösen → fällt aus der unresolved-Liste → blockiert NICHT mehr (wieder „ready").
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
    conflicts = await listConflicts(app, admin);
    expect(conflicts.some((c) => c.id === conflictId)).toBe(false);
    expect(conflictImpact(koA.id, conflicts).limited).toBe(false);
    expect(effectiveUsability(stillValidatedA, conflicts)).toBe("ready");
    const refAfter = conflictAwareSourceRefs([koA.id], [stillValidatedA], conflicts)[0];
    expect(refAfter?.conflictLimited).toBe(false);
    expect(refAfter?.usability).toBe("ready");
  });
});
