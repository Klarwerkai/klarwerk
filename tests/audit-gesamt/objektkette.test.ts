// Aufnahme gesamt-auditprotokoll · R-0766 (Runden 2 und 3) — DIE DURCHGEHENDE KETTE AM WISSENSOBJEKT.
//
// Runde 3 (Bens Befund): auch Überschneidungsentscheidungen (`overlap.*`, Ziel = Überschneidungs-Id)
// fehlten. Sie tragen jetzt die beteiligten Objekte (`koIds`) und erscheinen in der Objektkette.
//
// Bens Befund aus Runde 1: `koAuditEvents` filterte nur `target === koId`. Ein Objekt, das in einem
// Konflikt stand und exportiert wurde, zeigte in seiner Herkunftskette nur `ko.created` — Konflikt,
// Eskalation, Entscheidung und Export fehlten, obwohl sie dieses Objekt betreffen.
//
// Lauf 2 (Bens letzter Befund aus Lauf 1): ABGESCHLOSSENE Alt-Überschneidungen, deren Belege das Objekt
// nicht nennen, fehlten — die Oberfläche kannte nur offene Konflikte. Der Server nennt jetzt über
// `GET /api/audit/ko/:koId/findings` alle Befunde des Objekts, auch abgeschlossene; die Belege selbst
// bleiben unangetastet.
//
// Gemessen wird zweimal:
//   1. am ECHTEN Draht: die Belege entstehen über die Routen (Anlegen, Konflikt, Eskalation,
//      Entscheidung, Export), die Kette am Objekt wird aus `GET /api/audit` und `GET /api/conflicts`
//      genau so abgeleitet wie in `MehrAbschnitte.tsx`;
//   2. an einer gültig verketteten Belegreihe mit Altbelegen OHNE `koIds` und einem fremden
//      Konflikt — der fremde darf nicht hineinrutschen, der alte muss über die bekannten Konflikte
//      gefunden werden.
import { afterEach, describe, expect, it } from "vitest";
import type { AuditEntry as WebAuditEntry } from "../../apps/web/src/api/types";
import { koAuditEvents } from "../../apps/web/src/lib/koLineage";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryOverlapRepo, type OverlapEntry, OverlapService } from "../../services/conflicts";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const KO = {
  type: "best_practice",
  category: "Instandhaltung",
  confidentiality: "intern",
} as const;

describe("R-0766 · die Kette am Objekt zeigt Konflikte und Exporte", () => {
  it("am Draht: Anlegen, Konflikt, Eskalation, Entscheidung und Export stehen in der Objektkette", async () => {
    const b = await baueFrischeBuehne();
    const h = (r: "admin" | "controller" | "viewer") => ({
      authorization: `Bearer ${b.sitzung[r]}`,
    });
    const neu = async (title: string, statement: string) => {
      const res = await b.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: h("admin"),
        payload: { ...KO, title, statement },
      });
      expect(res.statusCode, res.body).toBeLessThan(300);
      return res.json().id as string;
    };
    const a = await neu("Pumpe L1 entlüften", "Pumpe alle 200 h entlüften.");
    const bb = await neu("Pumpe L1 entlüften (Werk 2)", "Pumpe alle 400 h entlüften.");
    const fremdA = await neu("Förderband spannen", "Band monatlich spannen.");
    const fremdB = await neu("Förderband prüfen", "Band wöchentlich prüfen.");

    const konflikt = async (koA: string, koB: string) => {
      const res = await b.app.inject({
        method: "PUT",
        url: `/api/kos/${koA}`,
        headers: h("controller"),
        payload: {
          action: "conflict",
          conflict: { koA, koB, type: "truth", description: "Intervall widerspricht sich" },
        },
      });
      expect(res.statusCode, res.body).toBeLessThan(300);
      return res.json().id as string;
    };
    const eigener = await konflikt(a, bb);
    const fremder = await konflikt(fremdA, fremdB);
    expect(
      (
        await b.app.inject({
          method: "POST",
          url: `/api/conflicts/${eigener}/escalate`,
          headers: h("controller"),
        })
      ).statusCode,
    ).toBe(200);
    await b.app.inject({
      method: "POST",
      url: `/api/conflicts/${fremder}/escalate`,
      headers: h("controller"),
    });
    expect(
      (
        await b.app.inject({
          method: "PUT",
          url: `/api/kos/${a}`,
          headers: h("admin"),
          payload: { action: "resolve-conflict", conflictId: eigener, decision: "200 h gilt." },
        })
      ).statusCode,
    ).toBe(200);
    // Der Export gibt nur validierte Objekte aus — also erst freigeben.
    const frei = await b.app.inject({
      method: "PUT",
      url: `/api/kos/${a}`,
      headers: h("admin"),
      payload: { action: "admin-validate" },
    });
    expect(frei.statusCode, frei.body).toBe(200);
    const exportiert = await b.app.inject({
      method: "GET",
      url: "/api/library/export",
      headers: h("admin"),
    });
    expect(exportiert.statusCode).toBe(200);
    expect((exportiert.json() as { id: string }[]).map((k) => k.id)).toContain(a);

    const alle = (
      await b.app.inject({ method: "GET", url: "/api/audit", headers: h("admin") })
    ).json() as WebAuditEntry[];
    const konflikte = (
      await b.app.inject({ method: "GET", url: "/api/conflicts", headers: h("admin") })
    ).json() as { id: string; koA: string; koB: string }[];
    const eigeneKonflikte = konflikte.filter((c) => c.koA === a || c.koB === a).map((c) => c.id);

    const kette = koAuditEvents(alle, a, eigeneKonflikte);
    const aktionen = kette.map((e) => e.action);
    expect(aktionen).toEqual(
      expect.arrayContaining([
        "ko.created",
        "conflict.created",
        "conflict.escalated",
        "conflict.resolved",
        "library.export",
      ]),
    );
    // Nur der EIGENE Konflikt — der fremde (fremdA/fremdB) gehört nicht in diese Kette.
    const konfliktZiele = new Set(
      kette.filter((e) => e.action.startsWith("conflict.")).map((e) => e.target),
    );
    expect([...konfliktZiele]).toEqual([eigener]);
    // Chronologisch nach Sequenz.
    expect(kette.map((e) => e.seq)).toEqual([...kette.map((e) => e.seq)].sort((x, y) => x - y));
    await b.schliesse();
  });

  it("Runde 3 · Überschneidungen: erkannt, in Bearbeitung und „getrennt lassen“ stehen in der Kette beider Objekte, nicht bei fremden", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const overlaps = new OverlapService({ repo: new InMemoryOverlapRepo(), audit });
    await audit.record({ actor: "anna", action: "ko.created", target: "K1" });
    const detector = { trigger: "manual", method: "deterministic", lexicalScore: 0.95 } as const;
    const eigen = await overlaps.createAuto(
      {
        koA: "K1",
        koB: "K2",
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      detector,
      "system",
    );
    const fremd = await overlaps.createAuto(
      {
        koA: "K3",
        koB: "K4",
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "spannen", zitatB: "spannen" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      detector,
      "system",
    );
    await overlaps.takeInProgress(eigen.id, "carla");
    await overlaps.keepSeparate(eigen.id, "carla", "Zwei Werke, zwei Vorgaben.");
    await overlaps.keepSeparate(fremd.id, "carla");
    expect((await audit.verifyReport()).ok).toBe(true);

    const alle = (await audit.list()) as WebAuditEntry[];
    for (const ko of ["K1", "K2"]) {
      const kette = koAuditEvents(alle, ko).filter((e) => e.action.startsWith("overlap."));
      expect(kette.map((e) => `${e.action}@${e.target}`)).toEqual([
        `overlap.auto-created@${eigen.id}`,
        `overlap.in-progress@${eigen.id}`,
        `overlap.kept-separate@${eigen.id}`,
      ]);
      const entscheidung = kette.at(-1);
      expect(entscheidung?.actor).toBe("carla");
    }
    expect(koAuditEvents(alle, "K1").map((e) => e.target)).not.toContain(fremd.id);
  });

  it("gültig verkettete Belegreihe: Altbeleg ohne koIds über die bekannten Konflikte, fremder Konflikt bleibt draußen", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    await audit.record({ actor: "anna", action: "ko.created", target: "K1" });
    await audit.record({
      actor: "carla",
      action: "conflict.created",
      target: "C1",
      payload: { koIds: ["K1", "K2"] },
    });
    // Altbestand: vor Runde 2 trug `conflict.created` keine Objekte.
    await audit.record({ actor: "carla", action: "conflict.created", target: "C-ALT" });
    await audit.record({ actor: "carla", action: "conflict.escalated", target: "C-ALT" });
    await audit.record({
      actor: "carla",
      action: "conflict.created",
      target: "C-FREMD",
      payload: { koIds: ["K3", "K4"] },
    });
    await audit.record({ actor: "carla", action: "conflict.escalated", target: "C-FREMD" });
    await audit.record({ actor: "ada", action: "conflict.resolved", target: "C1" });
    await audit.record({
      actor: "vera",
      action: "library.export",
      target: "library",
      payload: { format: "json", count: 2, includeConfidential: false, koIds: ["K1", "K2"] },
    });
    await audit.record({
      actor: "vera",
      action: "library.export",
      target: "library",
      payload: { format: "json", count: 1, includeConfidential: false, koIds: ["K3"] },
    });
    expect((await audit.verifyReport()).ok).toBe(true);

    const alle = (await audit.list()) as WebAuditEntry[];
    const kette = koAuditEvents(alle, "K1", ["C-ALT"]);
    expect(kette.map((e) => `${e.action}@${e.target}`)).toEqual([
      "ko.created@K1",
      "conflict.created@C1",
      "conflict.created@C-ALT",
      "conflict.escalated@C-ALT",
      "conflict.resolved@C1",
      "library.export@library",
    ]);
    // Ohne den Hinweis auf den Altkonflikt bleibt er draußen — er nennt das Objekt nirgends.
    expect(koAuditEvents(alle, "K1").map((e) => e.target)).not.toContain("C-ALT");
  });

  // Verwalteransicht · Bens Befund Nacharbeit 7: der SCORM-Export trägt als Ziel das Exportpaket
  // (`lms-export:<kennung>`) und nennt die Objekte NUR unter `payload.objekte[].koId`
  // (`services/app/src/routes/lms-export-routes.ts:53-60`). Bis hierher fehlte er in der Kette.
  it("SCORM-Export · gespeicherter Beleg erscheint in der Kette jedes exportierten Objekts, nicht beim unbeteiligten", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    await audit.record({ actor: "anna", action: "ko.created", target: "K1" });
    await audit.record({ actor: "anna", action: "ko.created", target: "K2" });
    await audit.record({ actor: "anna", action: "ko.created", target: "K9" });
    // Dieselbe Nutzlastform, die die Route schreibt — ein bereits gespeicherter Beleg.
    await audit.record({
      actor: "vera",
      action: "output.lms-export",
      target: "lms-export:EXP-1",
      payload: {
        format: "SCORM 1.2",
        exportfassung: "EXP-1",
        manifestId: "M-1",
        empfaenger: "Lernplattform Werk 1",
        sprache: "de",
        objekte: [
          { koId: "K1", version: 3 },
          { koId: "K2", version: 1 },
        ],
        paketSha256: "abc",
      },
    });
    expect((await audit.verifyReport()).ok).toBe(true);

    const alle = (await audit.list()) as WebAuditEntry[];
    for (const ko of ["K1", "K2"]) {
      const kette = koAuditEvents(alle, ko);
      expect(
        kette.map((e) => `${e.action}@${e.target}`),
        ko,
      ).toEqual([`ko.created@${ko}`, "output.lms-export@lms-export:EXP-1"]);
      expect(kette.at(-1)?.actor).toBe("vera");
    }
    // Das unbeteiligte Objekt bekommt den Export nicht — auch nicht über eine ähnliche Kennung.
    expect(koAuditEvents(alle, "K9").map((e) => e.action)).toEqual(["ko.created"]);
    expect(koAuditEvents(alle, "K").map((e) => e.action)).toEqual([]);
  });

  it("Lauf 2 · abgeschlossene Alt-Überschneidung ohne koIds: über die Befunde des Objekts in der Kette, fremde bleibt draußen", async () => {
    const b = await baueFrischeBuehne();
    const h = (r: "admin" | "controller" | "viewer") => ({
      authorization: `Bearer ${b.sitzung[r]}`,
    });
    const neu = async (title: string, statement: string) => {
      const res = await b.app.inject({
        method: "POST",
        url: "/api/kos",
        headers: h("admin"),
        payload: { ...KO, title, statement },
      });
      expect(res.statusCode, res.body).toBeLessThan(300);
      return res.json().id as string;
    };
    const a = await neu("Kessel entleeren", "Kessel vor Wartung entleeren.");
    const bb = await neu("Kessel entleeren (Werk 2)", "Kessel vor Wartung ganz entleeren.");
    const fremdA = await neu("Filter tauschen", "Filter quartalsweise tauschen.");
    const fremdB = await neu("Filter prüfen", "Filter monatlich prüfen.");

    // Bestand im bisherigen Belegformat: der Befund ist gespeichert und geschlossen, seine Belege
    // tragen nur die Überschneidungs-Id (so schrieb `OverlapService` vor Lauf 1).
    const alt = (id: string, koA: string, koB: string): OverlapEntry => ({
      id,
      koA,
      koB,
      relation: "identisch",
      aspects: [],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "getrennt_lassen",
      status: "geschlossen",
      pairKey: `dup|${[koA, koB].sort().join("|")}`,
      origin: "auto",
      resolution: {
        reason: "kept_separate",
        by: b.konto.controller.id,
        note: null,
        at: "2026-08-01T00:00:00.000Z",
      },
      createdAt: "2026-07-01T00:00:00.000Z",
      closedAt: "2026-08-01T00:00:00.000Z",
    });
    for (const [id, koA, koB] of [
      ["OV-ALT", a, bb],
      ["OV-FREMD", fremdA, fremdB],
    ] as const) {
      await b.repos.overlapRepo.insert(alt(id, koA, koB));
      await b.services.audit.record({
        actor: "system",
        action: "overlap.auto-created",
        target: id,
        payload: { relation: "identisch", method: "deterministic" },
      });
      await b.services.audit.record({
        actor: b.konto.controller.id,
        action: "overlap.kept-separate",
        target: id,
      });
    }
    expect((await b.services.audit.verifyReport()).ok).toBe(true);

    const alle = (
      await b.app.inject({ method: "GET", url: "/api/audit", headers: h("controller") })
    ).json() as WebAuditEntry[];
    // Ohne die Befunde des Objekts fehlt der Altbefund — genau Bens Gegenprobe.
    expect(koAuditEvents(alle, a).map((e) => e.target)).not.toContain("OV-ALT");

    const befunde = await b.app.inject({
      method: "GET",
      url: `/api/audit/ko/${a}/findings`,
      headers: h("controller"),
    });
    expect(befunde.statusCode, befunde.body).toBe(200);
    const ids = (befunde.json() as { ids: string[] }).ids;
    expect(ids).toEqual(["OV-ALT"]);

    for (const ko of [a, bb]) {
      const eigene = (
        (
          await b.app.inject({
            method: "GET",
            url: `/api/audit/ko/${ko}/findings`,
            headers: h("controller"),
          })
        ).json() as { ids: string[] }
      ).ids;
      const kette = koAuditEvents(alle, ko, eigene).filter((e) => e.action.startsWith("overlap."));
      expect(kette.map((e) => `${e.action}@${e.target}`)).toEqual([
        "overlap.auto-created@OV-ALT",
        "overlap.kept-separate@OV-ALT",
      ]);
      expect(kette.at(-1)?.actor).toBe(b.konto.controller.id);
    }
    // Die Belege selbst sind unverändert — nichts wurde umgeschrieben.
    const nachher = (await b.services.audit.list({ action: "overlap.auto-created" })).map(
      (e) => e.payload,
    );
    expect(nachher).toEqual([
      { relation: "identisch", method: "deterministic" },
      { relation: "identisch", method: "deterministic" },
    ]);

    // Dieselbe Tür wie das Protokoll: der Betrachter bekommt die Befunde nicht.
    const betrachter = await b.app.inject({
      method: "GET",
      url: `/api/audit/ko/${a}/findings`,
      headers: h("viewer"),
    });
    expect(betrachter.statusCode).toBe(403);
    await b.schliesse();
  });
});
