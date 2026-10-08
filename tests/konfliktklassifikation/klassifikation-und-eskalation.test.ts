// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTKLASSIFIKATION — Konfliktart, Arbeitsart und zulässige Eskalation.
// ================================================================================================
//
// Die Originalpunkte (QUELLEN.json, original_points) und was dieser Test davon am Verhalten misst:
//
//   R-0209 / R-1713 / R-2103 / FR-CON-01 — ein Widerspruch wird ein SICHTBARER Konflikt mit Art
//       UND Beschreibung, für jede der fünf Arten; der Bestand wird dabei nicht verändert.
//   R-0215 / R-1714 / R-2104 / FR-CON-02 — nur „truth" kann eskaliert werden; die vier anderen
//       Arten bleiben offen nebeneinander stehen (über die echte Route und am Dienst).
//   R-2065 (NFR-TAI-02) — kein automatischer „Wahrheits"-Entscheid: auch ein vom Modell erkannter
//       Widerspruch bleibt offen, ohne Entscheider, ohne Entscheidung, ohne Abschlussgrund.
//   R-0252 — die Arbeitsart (Regel/Sache/Version): ausdrücklich gewählt bei der Anlage, sonst aus
//       der Art abgeleitet; je Arbeitsart ein anderes Band.
//
// Die Fälle zu R-0209 … FR-CON-02 belegen LIEFERUNGEN, die es vor diesem Auftrag schon gab
// (`services/conflicts/src/service.ts` create/escalate, `services/app/src/conflict-routes.test.ts`).
// Sie stehen hier, weil die Auftragsquelle für diese Punkte nur Altquellen („nur Jira-Stand aus
// Juni, Sichtung nicht belegt") führt — sie werden am heutigen Stand gemessen, nicht übernommen.
import { describe, expect, it } from "vitest";
import {
  conflictNextStep,
  conflictWorkActions,
  conflictWorkKind,
} from "../../apps/web/src/lib/conflictView";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  ConflictService,
  type ConflictType,
  type ConflictVerdict,
  type DetectSubject,
  InMemoryConflictRepo,
  isConflictWorkKind,
} from "../../services/conflicts";

const ARTEN: readonly ConflictType[] = ["truth", "experience", "context", "temporal", "role"];

function dienst(): { service: ConflictService; repo: InMemoryConflictRepo } {
  const repo = new InMemoryConflictRepo();
  let n = 0;
  const service = new ConflictService({ repo, genId: () => `c${++n}` });
  return { service, repo };
}

async function adminApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers });
  const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
  const ids = kos.json().map((k: { id: string }) => k.id) as string[];
  return { app, headers, koA: ids[0] as string, koB: ids[1] as string };
}

describe("R-0209 / FR-CON-01 · Widerspruch → klassifizierter, sichtbarer Konflikt", () => {
  it("jede der fünf Arten entsteht als offener Konflikt mit Art und Beschreibung", async () => {
    const { service } = dienst();
    for (const type of ARTEN) {
      const description = `Beschreibung ${type}`;
      const c = await service.create({ koA: "A", koB: "B", type, description });
      expect(c.type).toBe(type);
      expect(c.description).toBe(`Beschreibung ${type}`);
      expect(c.status).toBe("offen");
    }
    // Sichtbar heisst: alle fünf stehen in der Liste der offenen Konflikte — keiner ersetzt einen
    // anderen, auch nicht für dasselbe Paar.
    expect((await service.unresolved()).map((c) => c.type).sort()).toEqual([...ARTEN].sort());
  });

  it("über die echte Route: die Art kommt so zurück, wie sie gewählt wurde; die Liste zeigt sie", async () => {
    const { app, headers, koA, koB } = await adminApp();
    for (const type of ARTEN) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${koA}`,
        headers,
        payload: { action: "conflict", conflict: { koA, koB, type, description: `D ${type}` } },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().type).toBe(type);
    }
    const liste = (await app.inject({ method: "GET", url: "/api/conflicts", headers })).json() as {
      type: string;
      description: string;
    }[];
    for (const type of ARTEN) {
      expect(liste.some((c) => c.type === type && c.description === `D ${type}`)).toBe(true);
    }
  });
});

describe("R-0215 / FR-CON-02 · nur der Wahrheitskonflikt eskaliert", () => {
  it("am Dienst: truth → eskaliert; die vier anderen → NOT_ESCALATABLE und bleiben offen", async () => {
    const { service } = dienst();
    for (const type of ARTEN) {
      const c = await service.create({ koA: "A", koB: "B", type, description: type });
      if (type === "truth") {
        expect((await service.escalate(c.id)).status).toBe("eskaliert");
      } else {
        await expect(service.escalate(c.id)).rejects.toMatchObject({ code: "NOT_ESCALATABLE" });
        expect((await service.get(c.id))?.status).toBe("offen");
      }
    }
  });

  it("über die echte Route: nur truth bekommt 200, die anderen eine Absage", async () => {
    const { app, headers, koA, koB } = await adminApp();
    for (const type of ARTEN) {
      const angelegt = await app.inject({
        method: "PUT",
        url: `/api/kos/${koA}`,
        headers,
        payload: { action: "conflict", conflict: { koA, koB, type, description: type } },
      });
      const res = await app.inject({
        method: "POST",
        url: `/api/conflicts/${angelegt.json().id}/escalate`,
        headers,
      });
      if (type === "truth") {
        expect(res.statusCode).toBe(200);
      } else {
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
      }
    }
  });

  it("die nächste Handlung: Eskalieren steht nur beim offenen Wahrheitskonflikt", () => {
    for (const type of ARTEN) {
      const schritt = conflictNextStep({ type, status: "offen" });
      expect(schritt === "escalate").toBe(type === "truth");
    }
  });
});

describe("R-2065 (NFR-TAI-02) · kein automatischer Wahrheitsentscheid", () => {
  it("ein vom Modell erkannter Widerspruch bleibt offen — ohne Entscheider und ohne Entscheidung", async () => {
    const { service } = dienst();
    const a: DetectSubject = {
      refId: "A",
      title: "Prüffrist",
      statement: "Die Prüffrist beträgt 14 Tage.",
      conditions: [],
      measures: [],
      category: "Qualität",
      tags: [],
    };
    const b: DetectSubject = { ...a, refId: "B", statement: "Die Prüffrist beträgt 30 Tage." };
    const urteil: ConflictVerdict = {
      relation: "widerspruch",
      older: null,
      confidence: 0.95,
      begruendung: "Zwei verschiedene Fristen für dieselbe Prüfung.",
      zitat_a: "14 Tage",
      zitat_b: "30 Tage",
    };
    const angelegt = await service.detectForSubject(a, [a, b], async () => urteil);
    expect(angelegt).toHaveLength(1);
    const c = angelegt[0];
    expect(c?.type).toBe("truth");
    expect(c?.status).toBe("offen");
    expect(c?.decidedBy).toBeNull();
    expect(c?.decision).toBeNull();
    expect(c?.resolutionReason).toBeUndefined();
    // Auch die Eskalation geschieht nicht von selbst: sie ist ein menschlicher Schritt.
    expect((await service.get(c?.id ?? ""))?.status).toBe("offen");
  });
});

describe("R-0252 · Arbeitsart Regel / Sache / Version", () => {
  it("die Anlage übernimmt eine ausdrücklich gewählte Arbeitsart und lässt sie sonst weg", async () => {
    const { service } = dienst();
    const gewaehlt = await service.create({
      koA: "A",
      koB: "B",
      type: "truth",
      arbeitsart: "regel",
      description: "Firmenwagen blau gegen rot",
    });
    expect(gewaehlt.arbeitsart).toBe("regel");
    const ohne = await service.create({ koA: "A", koB: "B", type: "truth", description: "x" });
    expect("arbeitsart" in ohne).toBe(false);
  });

  it("die Route nimmt nur regel/sache/version an — ein fremder Wert ist ein 400", async () => {
    const { app, headers, koA, koB } = await adminApp();
    const gut = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type: "context", arbeitsart: "version", description: "d" },
      },
    });
    expect(gut.statusCode).toBe(201);
    expect(gut.json().arbeitsart).toBe("version");
    const detail = await app.inject({
      method: "GET",
      url: `/api/conflicts/${gut.json().id}`,
      headers,
    });
    expect(detail.json().arbeitsart).toBe("version");

    const schlecht = await app.inject({
      method: "PUT",
      url: `/api/kos/${koA}`,
      headers,
      payload: {
        action: "conflict",
        conflict: { koA, koB, type: "context", arbeitsart: "wahrheit", description: "d" },
      },
    });
    expect(schlecht.statusCode).toBe(400);
    expect(isConflictWorkKind("wahrheit")).toBe(false);
  });

  it("ohne Wahl wird abgeleitet — und als Ableitung gekennzeichnet", () => {
    const abgeleitet = (type: ConflictType) => conflictWorkKind({ type });
    expect(abgeleitet("truth")).toEqual({ kind: "sache", ausdruecklich: false });
    expect(abgeleitet("experience")).toEqual({ kind: "sache", ausdruecklich: false });
    expect(abgeleitet("temporal")).toEqual({ kind: "version", ausdruecklich: false });
    expect(abgeleitet("context")).toEqual({ kind: "regel", ausdruecklich: false });
    expect(abgeleitet("role")).toEqual({ kind: "regel", ausdruecklich: false });
    // Die Wahl schlägt die Ableitung.
    expect(conflictWorkKind({ type: "truth", arbeitsart: "regel" })).toEqual({
      kind: "regel",
      ausdruecklich: true,
    });
  });

  it("die angebotenen Knöpfe unterscheiden sich je Arbeitsart", () => {
    const sache = conflictWorkActions("sache");
    const regel = conflictWorkActions("regel");
    const version = conflictWorkActions("version");
    // Sache: das bisherige Band — beide Seiten, „beide gelten", Zweitmeinung.
    expect(sache).toEqual({
      linksKey: "con.side.left",
      rechtsKey: "con.side.right",
      beideGelten: true,
      zweitmeinung: true,
    });
    // Regel: keine Zweitmeinung — keine Quelle entscheidet, eine befugte Person tut es.
    expect(regel.zweitmeinung).toBe(false);
    expect(regel.beideGelten).toBe(true);
    // Version: welcher STAND gilt — kein „beide gelten", keine Zweitmeinung.
    expect(version).toEqual({
      linksKey: "konfliktarbeit.knopf.standLinks",
      rechtsKey: "konfliktarbeit.knopf.standRechts",
      beideGelten: false,
      zweitmeinung: false,
    });
    const baender = new Set([sache, regel, version].map((b) => JSON.stringify(b)));
    expect(baender.size).toBe(3);
  });

  it("die nächste Handlung folgt dem Band: Regel und Version → entscheiden", () => {
    expect(conflictNextStep({ type: "context", status: "offen" })).toBe("resolve");
    expect(conflictNextStep({ type: "temporal", status: "offen" })).toBe("resolve");
    expect(conflictNextStep({ type: "experience", status: "offen" })).toBe("secondOpinion");
    // Ein als Regel gewählter Wahrheitskonflikt eskaliert trotzdem zuerst (R-0215) …
    expect(conflictNextStep({ type: "truth", status: "offen", arbeitsart: "regel" })).toBe(
      "escalate",
    );
    // … und wird danach entschieden, ohne Zweitmeinung.
    expect(conflictNextStep({ type: "truth", status: "eskaliert", arbeitsart: "regel" })).toBe(
      "resolve",
    );
  });
});
