// Aufnahme gesamt-auditprotokoll:aktionsabdeckung · R-0607 / R-0733 / FR-AUD-01.
//
// DIE FORTSETZUNG DER §12.3-MATRIX, NICHT IHRE ABSCHRIFT. `aktionsmatrix-12-3.test.ts` fährt jede
// in §12.3 genannte Aktionsart einmal am Draht. Offen blieben dort die Varianten, die eine Aktionsart
// auf einem ZWEITEN Weg auslöst — und die getroffenen Entscheidungen selbst (R-0733):
//
//   · Konflikt entschieden / als Fehlalarm geschlossen — mit AUSGANG und beteiligten Objekten,
//     nicht nur „es wurde entschieden" (bis zu diesem Auftrag ohne Nutzlast).
//   · Dublette: getrennt lassen, als verwandt verlinken, Fehlalarm — mit Ausgang.
//   · Validieren über die Admin-Freigabe und über die Übernahme eines Änderungsvorschlags,
//     Ablehnen über die Ablehnung eines Änderungsvorschlags.
//   · Nutzerverwaltung über Freigabe, Passwort-Setzen und Löschen (die Matrix fährt nur den
//     Rollenwechsel).
//
// Jeder Fall baut eine eigene Bühne, fährt den echten Nutzerweg über HTTP mit der Rolle, die ihn im
// Betrieb fährt, und liest den geschriebenen Eintrag zurück: wer (actor), was (action + target),
// wann (at, innerhalb des Falls). Danach muss die Kette nachrechenbar bleiben.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { AuditEntry } from "../../services/audit";
import {
  type FrischeBuehne,
  type Rolle,
  baueFrischeBuehne,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const KO_INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
  confidentiality: "intern",
} as const;

function kopf(b: FrischeBuehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${b.sitzung[rolle]}` };
}

async function fahre(
  app: FastifyInstance,
  headers: Record<string, string>,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
) {
  const res = await app.inject({ method, url, headers, ...(payload ? { payload } : {}) });
  expect(
    res.statusCode,
    `${method} ${url} → ${res.statusCode} ${res.body.slice(0, 300)}`,
  ).toBeLessThan(300);
  return res;
}

async function legeKoAnMitFassung(
  b: FrischeBuehne,
  rolle: Rolle,
  inhalt: Record<string, unknown> = {},
): Promise<{ id: string; version: number }> {
  const angelegt = (
    await fahre(b.app, kopf(b, rolle), "POST", "/api/kos", { ...KO_INHALT, ...inhalt })
  ).json() as { id: string; version: number };
  expect(typeof angelegt.version).toBe("number");
  return angelegt;
}

async function legeKoAn(
  b: FrischeBuehne,
  rolle: Rolle,
  inhalt: Record<string, unknown> = {},
): Promise<string> {
  return (await legeKoAnMitFassung(b, rolle, inhalt)).id;
}

/**
 * Genau EIN Eintrag dieser Aktion von diesem Handelnden auf dieses Ziel — gelesen, nicht
 * angenommen —, geschrieben zwischen `seit` und jetzt.
 */
async function beleg(
  b: FrischeBuehne,
  action: string,
  actor: string,
  target: string,
  seit: number,
): Promise<AuditEntry> {
  const treffer = (await b.services.audit.list({ action, actor })).filter(
    (e) => e.target === target,
  );
  expect(treffer, `Einträge action=${action} actor=${actor} target=${target}`).toHaveLength(1);
  const e = treffer[0] as AuditEntry;
  const wann = Date.parse(e.at);
  expect(Number.isNaN(wann), `at=${e.at}`).toBe(false);
  expect(wann).toBeGreaterThanOrEqual(seit - 1000);
  expect(wann).toBeLessThanOrEqual(Date.now() + 1000);
  return e;
}

async function ketteHaelt(b: FrischeBuehne): Promise<void> {
  const bericht = await b.services.audit.verifyReport();
  expect(bericht.ok).toBe(true);
  expect(bericht.linkageBreaks).toBe(0);
}

/** Ein offener, von Hand angelegter Wahrheitskonflikt zwischen zwei Beiträgen (Weg der Fläche). */
async function legeKonfliktAn(b: FrischeBuehne) {
  const koA = await legeKoAn(b, "experte");
  const koB = await legeKoAn(b, "experte", {
    title: "Dichtungswechsel L5",
    statement: "Dichtung erst nach dem Anlauf prüfen.",
  });
  const konflikt = (
    await fahre(b.app, kopf(b, "controller"), "PUT", `/api/kos/${koA}`, {
      action: "conflict",
      conflict: { koA, koB, type: "truth", description: "Vor vs. nach dem Anlauf" },
    })
  ).json() as { id: string };
  return { koA, koB, id: konflikt.id };
}

/** Zwei gleichlautende Beiträge, Erkennung gelaufen, ein offenes Dublettenpaar. */
async function legeDublettenpaarAn(b: FrischeBuehne) {
  await legeKoAn(b, "admin");
  await legeKoAn(b, "admin", { title: "Dichtungswechsel L4 — zweite Fassung" });
  const worker = b.services.aiCheckWorker;
  expect(worker, "die Bühne hat keinen Prüf-Worker").toBeDefined();
  await worker?.idle();
  const paar = (await b.services.overlaps.unresolved())[0];
  expect(paar, "zwei gleichlautende Beiträge ergaben kein offenes Dublettenpaar").toBeDefined();
  return paar as { id: string; koA: string; koB: string };
}

describe("R-0733 · getroffene Entscheidungen stehen mit Ausgang im Protokoll (HTTP)", () => {
  it("Konflikt entschieden → conflict.resolved mit Ausgang „decided“ und beiden Objekten", async () => {
    const b = await baueFrischeBuehne();
    const seit = Date.now();
    const { koA, koB, id } = await legeKonfliktAn(b);
    const entscheidung = "Vor dem Anlauf gilt.";

    // R-0215 (Aufnahme gesamt-konfliktklassifikation): ein Wahrheitskonflikt wird verbindlich erst
    // eskaliert, dann entschieden. Der Beleg der Entscheidung bleibt derselbe.
    await fahre(b.app, kopf(b, "admin"), "POST", `/api/conflicts/${id}/escalate`);
    await fahre(b.app, kopf(b, "admin"), "PUT", `/api/kos/${koA}`, {
      action: "resolve-conflict",
      conflictId: id,
      decision: entscheidung,
    });

    const e = await beleg(b, "conflict.resolved", b.konto.admin.id, id, seit);
    expect(e.payload).toEqual({ koIds: [koA, koB], resolutionReason: "decided" });
    // Der Begründungstext steht am Konflikt, nicht in der unlöschbaren Kette.
    expect(JSON.stringify(e.payload)).not.toContain(entscheidung);
    const gespeichert = await b.services.conflicts.get(id);
    expect(gespeichert?.decision).toBe(entscheidung);
    expect(gespeichert?.decidedBy).toBe(b.konto.admin.id);
    await ketteHaelt(b);
  });

  it("Konflikt eskaliert → conflict.escalated nennt beide Objekte", async () => {
    const b = await baueFrischeBuehne();
    const seit = Date.now();
    const { koA, koB, id } = await legeKonfliktAn(b);

    await fahre(b.app, kopf(b, "controller"), "POST", `/api/conflicts/${id}/escalate`);

    const e = await beleg(b, "conflict.escalated", b.konto.controller.id, id, seit);
    expect(e.payload).toEqual({ koIds: [koA, koB] });
    await ketteHaelt(b);
  });

  it("Konflikt als Fehlalarm geschlossen → conflict.dismissed mit Ausgang „dismissed“", async () => {
    const b = await baueFrischeBuehne();
    const seit = Date.now();
    const { koA, koB, id } = await legeKonfliktAn(b);
    const notiz = "Fehlalarm: andere Anlage.";

    await fahre(b.app, kopf(b, "controller"), "POST", `/api/conflicts/${id}/dismiss`, {
      note: notiz,
    });

    const e = await beleg(b, "conflict.dismissed", b.konto.controller.id, id, seit);
    expect(e.payload).toEqual({ koIds: [koA, koB], resolutionReason: "dismissed" });
    expect(JSON.stringify(e.payload)).not.toContain(notiz);
    await ketteHaelt(b);
  });

  const DUBLETTENWEGE = [
    ["dismiss", "overlap.dismissed", "dismissed"],
    ["keep-separate", "overlap.kept-separate", "kept_separate"],
    ["link-related", "overlap.linked-related", "linked_related"],
  ] as const;
  for (const [weg, aktion, grund] of DUBLETTENWEGE) {
    it(`Dublette · ${weg} → ${aktion} mit Ausgang „${grund}“ und beiden Objekten`, async () => {
      const b = await baueFrischeBuehne();
      const seit = Date.now();
      const paar = await legeDublettenpaarAn(b);

      await fahre(b.app, kopf(b, "controller"), "POST", `/api/duplicates/${paar.id}/${weg}`, {
        note: "Entschieden in der Abdeckungsprüfung.",
      });

      const e = await beleg(b, aktion, b.konto.controller.id, paar.id, seit);
      expect(e.payload).toEqual({ koIds: [paar.koA, paar.koB], resolutionReason: grund });
      await ketteHaelt(b);
    });
  }
});

describe("§12.3 · Validieren und Ablehnen auf ihren zweiten Wegen (HTTP)", () => {
  it("Validieren · Admin-Freigabe → ko.admin-validated mit Fassung", async () => {
    const b = await baueFrischeBuehne();
    const seit = Date.now();
    const { id: ko, version } = await legeKoAnMitFassung(b, "experte");

    await fahre(b.app, kopf(b, "admin"), "PUT", `/api/kos/${ko}`, { action: "admin-validate" });

    const e = await beleg(b, "ko.admin-validated", b.konto.admin.id, ko, seit);
    expect(e.payload.koVersion).toBe(version);
    await ketteHaelt(b);
  });

  const VORSCHLAGSENTSCHEIDUNGEN = [
    ["ablehnen", "ko.proposal-rejected"],
    ["uebernehmen", "ko.admin-validated"],
  ] as const;
  for (const [entscheidung, aktion] of VORSCHLAGSENTSCHEIDUNGEN) {
    it(`Änderungsvorschlag · ${entscheidung} → ${aktion} mit Vorschlagskennung`, async () => {
      const b = await baueFrischeBuehne();
      const seit = Date.now();
      const { id: ko, version } = await legeKoAnMitFassung(b, "experte");
      await fahre(b.app, kopf(b, "experte"), "PUT", `/api/kos/${ko}`, {
        action: "propose",
        proposal: {
          statement: "Dichtung vor jedem Anlauf und nach 500 h prüfen.",
          baseVersion: version,
        },
      });
      const vorgeschlagen = await beleg(b, "ko.proposed", b.konto.experte.id, ko, seit);
      const proposalId = vorgeschlagen.payload.proposalId as string;
      expect(typeof proposalId).toBe("string");

      await fahre(b.app, kopf(b, "admin"), "PUT", `/api/kos/${ko}`, {
        action: "decide-proposal",
        decision: entscheidung,
        proposalId,
      });

      const e = await beleg(b, aktion, b.konto.admin.id, ko, seit);
      expect(e.payload.proposalId).toBe(proposalId);
      if (entscheidung === "uebernehmen") {
        // Die neue Fassung stammt vom Einreicher, die Freigabe vom Entscheider — beide belegt.
        const fassung = await beleg(b, "ko.revised", b.konto.experte.id, ko, seit);
        expect(fassung.payload.proposalId).toBe(proposalId);
      } else {
        expect(await b.services.audit.list({ action: "ko.admin-validated" })).toEqual([]);
      }
      await ketteHaelt(b);
    });
  }
});

describe("§12.3 · Nutzerverwaltung über Freigabe, Passwort und Löschen (HTTP)", () => {
  it("Freigabe → user.approve, Passwort setzen → user.password-reset, Löschen → user.delete", async () => {
    const b = await baueFrischeBuehne();
    const seit = Date.now();
    const neu = await b.services.auth.register({
      name: "Abdeckung Neuzugang",
      email: "neuzugang@abnahme.de",
      password: "Abdeckung-2026!",
    });
    const admin = kopf(b, "admin");

    await fahre(b.app, admin, "POST", `/api/auth/users/${neu.id}/approve`);
    await beleg(b, "user.approve", b.konto.admin.id, neu.id, seit);

    await fahre(b.app, admin, "POST", `/api/auth/users/${neu.id}/reset`, {
      password: "Frisch-gesetzt-2026!",
    });
    const reset = await beleg(b, "user.password-reset", b.konto.admin.id, neu.id, seit);
    // Kein Geheimnis im Protokoll.
    expect(JSON.stringify(reset.payload)).not.toContain("Frisch-gesetzt-2026!");

    await fahre(b.app, admin, "DELETE", `/api/auth/users/${neu.id}`);
    await beleg(b, "user.delete", b.konto.admin.id, neu.id, seit);
    await ketteHaelt(b);
  });
});
