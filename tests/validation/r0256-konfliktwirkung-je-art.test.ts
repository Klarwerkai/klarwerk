import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  KoService,
  TRUTH_CONFLICT_TRUST_PENALTY,
} from "../../services/knowledge-object";
import {
  CONFLICT_TRUST_FLOOR,
  CONFLICT_TRUST_IMPACT,
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  type KonfliktArt,
  TRUST_MAX,
  ValidationService,
  applyConflictImpact,
  computeOutcome,
} from "../../services/validation";

// R-0256 (Aufnahme gesamt-peer-validierung): die abgestufte Konfliktwirkung je Art steht in der
// EINEN Trust-Formel. Gewichte aus Technischem Anhang §3.3, Untergrenze 15 aus §3.2. Vorher wirkte
// nur der Wahrheitskonflikt, einmal beim Anlegen — und die nächste Bewertung rechnete ihn weg.

describe("R-0256 · Konfliktgewichte je Art in der Formel", () => {
  it("jede Art hat ihr Gewicht aus Anhang §3.3; Wahrheit nimmt dieselbe Zahl wie der Anlageweg", () => {
    expect(CONFLICT_TRUST_IMPACT).toEqual({
      truth: -TRUTH_CONFLICT_TRUST_PENALTY,
      experience: -8,
      context: -6,
      temporal: -8,
      role: -5,
    });
    expect(TRUTH_CONFLICT_TRUST_PENALTY).toBe(12);
    for (const [art, gewicht] of Object.entries(CONFLICT_TRUST_IMPACT)) {
      expect(applyConflictImpact(TRUST_MAX, [art as KonfliktArt])).toBe(TRUST_MAX + gewicht);
    }
  });

  it("ohne offenen Konflikt bleibt der Wert, wie die Stimmen ihn ergeben", () => {
    expect(applyConflictImpact(73, [])).toBe(73);
    expect(computeOutcome(["up"], 1).trust).toBe(TRUST_MAX);
    expect(computeOutcome(["up"], 1, []).trust).toBe(TRUST_MAX);
  });

  it("mehrere offene Konflikte: es zählt die stärkste Wirkung, nicht die Summe", () => {
    expect(applyConflictImpact(99, ["role", "truth", "context"])).toBe(87);
    expect(applyConflictImpact(99, ["role", "role"])).toBe(94);
  });

  it("Untergrenze 15: ein Konflikt drückt nie darunter und hebt keinen niedrigeren Wert an", () => {
    expect(CONFLICT_TRUST_FLOOR).toBe(15);
    expect(applyConflictImpact(20, ["truth"])).toBe(15);
    expect(applyConflictImpact(15, ["truth"])).toBe(15);
    expect(applyConflictImpact(10, ["truth"])).toBe(10);
    expect(applyConflictImpact(0, ["experience"])).toBe(0);
  });

  it("der Status folgt weiter allein den Stimmen (FR-VAL-02) — ein Konflikt ist kein „abgelehnt“", () => {
    const gruen = computeOutcome(["up", "up"], 2, ["truth"]);
    expect(gruen.status).toBe("validiert");
    expect(gruen.trust).toBe(87);
    const rot = computeOutcome(["up", "up", "down"], 2, ["role"]);
    expect(rot.status).toBe("offen");
  });
});

describe("R-0256 · der Bewertungsweg trägt die offenen Konflikte", () => {
  function wired(offen: KonfliktArt[] | undefined) {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      ...(offen ? { offeneKonfliktArten: async () => offen } : {}),
    });
    return { koService, service };
  }

  const eingabe = {
    title: "Aussage",
    statement: "Inhalt.",
    type: "best_practice" as const,
    category: "Anlage 1",
    author: "anna",
    neededValidations: 1,
  };

  it("offener Erfahrungskonflikt: validiert, gespeichert mit 99 − 8", async () => {
    const { koService, service } = wired(["experience"]);
    const ko = await koService.create(eingabe);
    const ergebnis = await service.rate(ko.id, "u1", "up");
    expect(ergebnis.status).toBe("validiert");
    expect(ergebnis.trust).toBe(91);
    expect((await koService.get(ko.id))?.trust).toBe(91);
  });

  it("GEGENPROBE: ohne verdrahtete Konfliktabfrage bleibt die reine Stimmenformel", async () => {
    const { koService, service } = wired(undefined);
    const ko = await koService.create(eingabe);
    expect((await service.rate(ko.id, "u1", "up")).trust).toBe(TRUST_MAX);
  });
});

describe("R-0256 · am echten HTTP-Weg", () => {
  type App = ReturnType<typeof buildApp>;

  async function anmelden(app: App) {
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

  async function anlegen(
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
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "Anlage 3",
        neededValidations: 1,
      },
    });
    return res.json() as KnowledgeObject;
  }

  const lesen = async (app: App, headers: Record<string, string>, id: string) =>
    (await app.inject({ method: "GET", url: `/api/kos/${id}`, headers })).json() as KnowledgeObject;

  const gruen = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  async function konflikt(
    app: App,
    headers: Record<string, string>,
    koA: string,
    koB: string,
    type: KonfliktArt,
  ) {
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type, description: `Konfliktfall ${type}.` },
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json() as Conflict;
  }

  it("offener Wahrheitskonflikt: die erneute Freigabe rechnet die Strafe nicht mehr weg; gelöst zählt er nicht", async () => {
    const app = buildApp(buildServices());
    const admin = await anmelden(app);
    const a = await anlegen(
      app,
      admin,
      "Presse P4 Anfahren",
      "Presse P4 erst nach Sichtprüfung anfahren.",
    );
    const b = await anlegen(
      app,
      admin,
      "Kühlkreis K2 Wechsel",
      "Kühlmittel K2 alle sechs Monate tauschen.",
    );

    expect((await gruen(app, admin, a.id)).statusCode).toBe(200);
    expect((await lesen(app, admin, a.id)).trust).toBe(TRUST_MAX);

    const offen = await konflikt(app, admin, a.id, b.id, "truth");
    const zurueck = await lesen(app, admin, a.id);
    expect(zurueck.status).toBe("offen");
    expect(zurueck.trust).toBe(TRUST_MAX - TRUTH_CONFLICT_TRUST_PENALTY);

    // Vorher: 99 — die Strafe verschwand mit der nächsten Stimme, obwohl der Konflikt offen war.
    expect((await gruen(app, admin, a.id)).statusCode).toBe(200);
    const wieder = await lesen(app, admin, a.id);
    expect(wieder.status).toBe("validiert");
    expect(wieder.trust).toBe(TRUST_MAX - TRUTH_CONFLICT_TRUST_PENALTY);

    const geloest = await app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers: admin,
      payload: { action: "resolve-conflict", conflictId: offen.id, decision: "A gilt." },
    });
    expect(geloest.statusCode).toBe(200);
    expect((await gruen(app, admin, a.id)).statusCode).toBe(200);
    expect((await lesen(app, admin, a.id)).trust).toBe(TRUST_MAX);
  });

  it("offener Rollenkonflikt an einem offenen Beitrag: die Freigabe trägt −5", async () => {
    const app = buildApp(buildServices());
    const admin = await anmelden(app);
    // Bewusst unähnliche Texte: das Dublettentor der Freigabe (R-0247) soll hier nicht anschlagen.
    const a = await anlegen(
      app,
      admin,
      "Frühdienst Taktvorgabe",
      "Im Frühdienst gelten 40 Teile je Stunde.",
    );
    const b = await anlegen(
      app,
      admin,
      "Stichprobe Lackierung",
      "Die Lackprobe wird vor dem Versand gezogen.",
    );

    await konflikt(app, admin, a.id, b.id, "role");
    // Anlegen allein ändert einen offenen Beitrag nicht (nur Wahrheit holt Validiertes zurück).
    expect((await lesen(app, admin, a.id)).trust).toBe(0);

    expect((await gruen(app, admin, a.id)).statusCode).toBe(200);
    const ko = await lesen(app, admin, a.id);
    expect(ko.status).toBe("validiert");
    expect(ko.trust).toBe(TRUST_MAX + CONFLICT_TRUST_IMPACT.role);
  });
});
