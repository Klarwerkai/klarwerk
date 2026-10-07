// ================================================================================================
// PMO-FEA-0003 (aufnahme:20260922:gesamt-aktivitaetsanzeige) — FREIWILLIGE LIVE-WAND.
// ================================================================================================
//
// Originalpunkt: „Eine freiwillige Live-Wand zeigt neues validiertes Wissen mit zugestimmtem
// Namen/Foto. Sichtrechte und Widerruf bleiben wirksam; keine Punkte oder Personenranglisten."
//
// Geprüft wird je Satzteil:
//   · neues VALIDIERTES Wissen  → Zweig `validated` enthält nur Status `validiert`, neueste zuerst;
//   · zugestimmter Name         → ohne Zustimmung kein Name; `saved` trägt keine Autorenkennung mehr;
//   · Widerruf wirksam          → die jüngste Erklärung gilt, der Name ist beim nächsten Abruf weg;
//   · Sichtrechte wirksam       → ein vertrauliches validiertes Objekt erscheint dem Leser nicht;
//   · keine Punkte/Ranglisten   → die Antwort führt genau die vier Zweige, keine Zähler je Person.
// Foto: das Produkt führt keine Profilbilder — es gibt nichts anzuzeigen und nichts zu prüfen.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  LIVEWALL_WIDERRUF,
  LIVEWALL_ZUSTIMMUNG,
  buildLiveWall,
  zustimmendeKonten,
} from "../../services/app/src/livewall";
import {
  type LiveWallRoutesDeps,
  livewallRoutes,
} from "../../services/app/src/routes/livewall-routes";
import type { KnowledgeObject } from "../../services/knowledge-object";

const ko = (
  id: string,
  title: string,
  status: "offen" | "validiert",
  author: string,
  createdAt: string,
  confidentiality = "intern",
): KnowledgeObject =>
  ({
    id,
    title,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    confidence: 0,
    trust: 0,
    status,
    version: 1,
    originalAuthor: author,
    author,
    confidentiality,
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt,
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  }) as unknown as KnowledgeObject;

describe("PMO-FEA-0003 · Aggregation", () => {
  const kos = [
    ko("o1", "Offen neu", "offen", "u-eva", "2026-07-03T08:00:00.000Z"),
    ko("v1", "Validiert alt", "validiert", "u-eva", "2026-07-01T08:00:00.000Z"),
    ko("v2", "Validiert neu", "validiert", "u-tom", "2026-07-02T08:00:00.000Z"),
  ];

  it("validated enthält nur validiertes Wissen, neueste zuerst", () => {
    const wand = buildLiveWall({ kos, helpful: [], today: "2026-07-03" });
    expect(wand.validated.map((v) => v.koId)).toEqual(["v2", "v1"]);
  });

  it("ohne Zustimmung kein Name — und saved trägt keine Autorenkennung", () => {
    const wand = buildLiveWall({ kos, helpful: [], today: "2026-07-03" });
    expect(wand.validated.every((v) => !("name" in v))).toBe(true);
    expect(wand.saved.every((s) => !("author" in s))).toBe(true);
  });

  it("Name nur für das zustimmende Konto", () => {
    const wand = buildLiveWall({
      kos,
      helpful: [],
      today: "2026-07-03",
      zugestimmt: new Map([["u-eva", "Eva Muster"]]),
    });
    expect(wand.validated).toEqual([
      { koId: "v2", title: "Validiert neu", at: "2026-07-02T08:00:00.000Z" },
      { koId: "v1", title: "Validiert alt", at: "2026-07-01T08:00:00.000Z", name: "Eva Muster" },
    ]);
  });
});

describe("PMO-FEA-0003 · Zustimmung und Widerruf", () => {
  const e = (seq: number, actor: string, target: string, action: string) => ({
    seq,
    actor,
    target,
    action,
  });

  it("die jüngste Erklärung gilt — ein Widerruf hebt die Zustimmung auf", () => {
    expect(zustimmendeKonten([e(1, "a", "a", LIVEWALL_ZUSTIMMUNG)])).toEqual(new Set(["a"]));
    expect(
      zustimmendeKonten([e(1, "a", "a", LIVEWALL_ZUSTIMMUNG), e(2, "a", "a", LIVEWALL_WIDERRUF)]),
    ).toEqual(new Set());
    // Reihenfolge der Eingabe egal — es zählt `seq`.
    expect(
      zustimmendeKonten([e(5, "a", "a", LIVEWALL_ZUSTIMMUNG), e(3, "a", "a", LIVEWALL_WIDERRUF)]),
    ).toEqual(new Set(["a"]));
  });

  it("eine Erklärung für ein FREMDES Konto zählt nicht", () => {
    expect(zustimmendeKonten([e(1, "admin", "a", LIVEWALL_ZUSTIMMUNG)])).toEqual(new Set());
  });
});

// Route mit kleinem Prüfprotokoll-Doppel: `record` hängt an, `list` filtert nach Aktion.
function aufbau(leser: SessionUser, kos: KnowledgeObject[]) {
  const zeilen: Array<{
    seq: number;
    at: string;
    actor: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
  }> = [];
  const audit = {
    list: async (f: { action?: string }) => zeilen.filter((z) => z.action === f.action),
    record: async (input: { actor: string; action: string; target: string }) => {
      const zeile = { ...input, seq: zeilen.length + 1, at: new Date().toISOString(), payload: {} };
      zeilen.push(zeile);
      return zeile;
    },
  };
  const deps = {
    ko: { list: async () => kos },
    audit,
    konten: async () => [
      { id: "u-eva", name: "Eva Muster" },
      { id: "u-tom", name: "Tom Test" },
    ],
  } as unknown as LiveWallRoutesDeps;
  let aktuell = leser;
  const guards = {
    requireUser: async () => aktuell,
    requirePermission: async () => aktuell,
  } as unknown as Guards;
  return {
    als: (u: SessionUser) => {
      aktuell = u;
    },
    async start() {
      const app = Fastify();
      await app.register(livewallRoutes(deps, guards));
      return app;
    },
  };
}

describe("PMO-FEA-0003 · HTTP über die Route", () => {
  const eva = { id: "u-eva", role: "experte" } as unknown as SessionUser;
  const tom = { id: "u-tom", role: "experte" } as unknown as SessionUser;
  const kos = [
    ko("v1", "Presse P2 entlüften", "validiert", "u-eva", "2026-07-02T08:00:00.000Z"),
    ko(
      "v2",
      "Zugangscode Leitstand",
      "validiert",
      "u-eva",
      "2026-07-03T08:00:00.000Z",
      "vertraulich",
    ),
  ];

  it("Zustimmung zeigt den Namen, Widerruf nimmt ihn beim nächsten Abruf wieder weg", async () => {
    const w = aufbau(eva, kos);
    const app = await w.start();
    const wand = async () => {
      w.als(tom);
      const res = await app.inject({ method: "GET", url: "/api/livewall" });
      expect(res.statusCode).toBe(200);
      return res.json() as { validated: Array<{ koId: string; name?: string }> };
    };

    expect((await wand()).validated).toEqual([
      { koId: "v1", title: "Presse P2 entlüften", at: "2026-07-02T08:00:00.000Z" },
    ]);

    w.als(eva);
    const ja = await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: true },
    });
    expect(ja.json()).toEqual({ nameConsent: true });
    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).json()).toEqual({
      nameConsent: true,
    });
    expect((await wand()).validated[0]?.name).toBe("Eva Muster");

    w.als(eva);
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: false },
    });
    expect((await wand()).validated[0]).not.toHaveProperty("name");
    await app.close();
  });

  it("Sichtrechte: ein vertrauliches validiertes Objekt erscheint dem Leser nicht", async () => {
    const w = aufbau(tom, kos);
    const app = await w.start();
    const res = await app.inject({ method: "GET", url: "/api/livewall" });
    const wand = res.json() as {
      validated: Array<{ koId: string }>;
      saved: Array<{ koId: string }>;
    };
    expect(wand.validated.map((v) => v.koId)).toEqual(["v1"]);
    expect(wand.saved.map((s) => s.koId)).toEqual(["v1"]);
    await app.close();
  });

  it("keine Punkte oder Ranglisten: die Antwort führt genau die vier Zweige", async () => {
    const w = aufbau(tom, kos);
    const app = await w.start();
    const wand = (await app.inject({ method: "GET", url: "/api/livewall" })).json() as Record<
      string,
      unknown
    >;
    expect(Object.keys(wand).sort()).toEqual(["helped", "helpedToday", "saved", "validated"]);
    await app.close();
  });

  it("ein Wert außer true/false wird abgewiesen und schreibt nichts", async () => {
    const w = aufbau(eva, kos);
    const app = await w.start();
    const res = await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      payload: { nameConsent: "ja" },
    });
    expect(res.statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).json()).toEqual({
      nameConsent: false,
    });
    await app.close();
  });
});

describe("PMO-FEA-0003 · Verdrahtung in der echten App", () => {
  it("die eigene Erklärung lässt sich setzen, lesen und widerrufen — ohne Login 401", async () => {
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

    expect((await app.inject({ method: "GET", url: "/api/livewall/consent" })).statusCode).toBe(
      401,
    );
    const lesen = async () =>
      (await app.inject({ method: "GET", url: "/api/livewall/consent", headers })).json();

    expect(await lesen()).toEqual({ nameConsent: false });
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      headers,
      payload: { nameConsent: true },
    });
    expect(await lesen()).toEqual({ nameConsent: true });
    await app.inject({
      method: "PUT",
      url: "/api/livewall/consent",
      headers,
      payload: { nameConsent: false },
    });
    expect(await lesen()).toEqual({ nameConsent: false });
    await app.close();
  });
});
