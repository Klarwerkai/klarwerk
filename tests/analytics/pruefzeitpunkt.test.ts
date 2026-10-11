// ================================================================================================
// R-0750 / R-1741 (Aufnahme gesamt-kennzahlen) — VALIDIERT JE WOCHE NACH DEM PRÜFZEITPUNKT.
// ================================================================================================
//
//   P1  die Regel `mitPruefzeitpunkt`: Übergang setzt, Verbleib behält, Rückfall nimmt weg
//   P2  der Wirkungsbericht zählt nach `validatedAt`, NICHT nach `createdAt`; ein validiertes Objekt
//       ohne belegten Prüfzeitpunkt zählt in keine Woche, sondern als zeitlich unbekannt
//   P3  am echten Weg (HTTP-Bewertung → KoService): die Bewertung setzt den Prüfzeitpunkt, der
//       Bericht ordnet das Objekt genau dieser Woche zu, eine Überarbeitung nimmt ihn wieder weg
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { impactReport } from "../../services/app/src/impact";
import type { AuditService } from "../../services/audit";
import type { KnowledgeObject, KoService } from "../../services/knowledge-object";
import { mitPruefzeitpunkt } from "../../services/knowledge-object/src/pruefzeitpunkt";

const JETZT = "2026-10-07T09:00:00.000Z";

function ko(p: Partial<KnowledgeObject>): KnowledgeObject {
  const basis = { id: "k", status: "offen", createdAt: "2026-06-03T08:00:00.000Z" };
  return { ...basis, ...p } as KnowledgeObject;
}

function montag(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

describe("P1 · die Regel des Prüfzeitpunkts", () => {
  it("Übergang nach „validiert“ setzt den Zeitpunkt", () => {
    const nachher = mitPruefzeitpunkt(ko({}), ko({ status: "validiert" }), JETZT);
    expect(nachher.validatedAt).toBe(JETZT);
  });

  it("bleibt validiert (weitere grüne Stimme): der bisherige Zeitpunkt bleibt", () => {
    const vorher = ko({ status: "validiert", validatedAt: "2026-09-01T00:00:00.000Z" });
    expect(mitPruefzeitpunkt(vorher, { ...vorher }, JETZT).validatedAt).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });

  it("Altbestand ohne Zeitpunkt wird beim Verbleib NICHT auf jetzt datiert", () => {
    const vorher = ko({ status: "validiert" });
    expect(mitPruefzeitpunkt(vorher, { ...vorher }, JETZT).validatedAt).toBeUndefined();
  });

  it("eine neue Freigabe datiert neu, auch wenn das Objekt schon validiert war", () => {
    const vorher = ko({ status: "validiert", validatedAt: "2026-09-01T00:00:00.000Z" });
    expect(mitPruefzeitpunkt(vorher, { ...vorher }, JETZT, true).validatedAt).toBe(JETZT);
  });

  it("Rückfall auf „offen“ nimmt den Zeitpunkt weg — das Feld fehlt, statt alt zu bleiben", () => {
    const vorher = ko({ status: "validiert", validatedAt: "2026-09-01T00:00:00.000Z" });
    const nachher = mitPruefzeitpunkt(vorher, { ...vorher, status: "offen" }, JETZT);
    expect("validatedAt" in nachher).toBe(false);
  });
});

describe("P2 · der Wirkungsbericht zählt nach dem Prüfzeitpunkt", () => {
  it("Erfassung im Juni, Prüfung im Oktober → Oktoberwoche; ohne Zeitpunkt → unbekannt", async () => {
    const bestand = [
      ko({ id: "a", status: "validiert", validatedAt: "2026-10-07T09:00:00.000Z" }),
      ko({ id: "b", status: "validiert" }),
      ko({ id: "c", status: "offen" }),
    ];
    const kos = { list: async () => bestand } as unknown as KoService;
    const audit = { list: async () => [] } as unknown as AuditService;
    const bericht = await impactReport(kos, audit, { sichtbar: () => true });
    expect(bericht.validatedTotal).toBe(2);
    expect(bericht.validatedByWeek).toEqual({ "2026-10-05": 1 });
    // Die Erfassungswoche (Juni) taucht nicht auf — kein rückwirkender Zuwachs.
    expect(bericht.validatedByWeek["2026-06-01"]).toBeUndefined();
    expect(bericht.validatedUnknownWeek).toBe(1);
  });
});

describe("P3 · am echten Weg: Bewertung → Prüfzeitpunkt → Wochenzählung", () => {
  it("die Bewertung setzt den Prüfzeitpunkt, die Überarbeitung nimmt ihn weg", async () => {
    const services = buildServices();
    const app = buildApp(services);
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
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Ventil bei Überdruck",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 1,
      },
    });
    const id = angelegt.json().id as string;
    expect(typeof id, angelegt.body).toBe("string");
    expect((await services.ko.get(id))?.validatedAt, "offen: kein Prüfzeitpunkt").toBeUndefined();

    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(bewertet.statusCode, bewertet.body).toBe(200);
    const validiert = await services.ko.get(id);
    expect(validiert?.status).toBe("validiert");
    const zeitpunkt = validiert?.validatedAt ?? "";
    expect(Number.isNaN(Date.parse(zeitpunkt)), "Prüfzeitpunkt fehlt").toBe(false);
    // Erfassung und Prüfung sind zwei Zeitpunkte; der Prüfzeitpunkt liegt nie davor.
    expect(Date.parse(zeitpunkt)).toBeGreaterThanOrEqual(Date.parse(validiert?.createdAt ?? ""));

    const impact = await app.inject({ method: "GET", url: "/api/analytics/impact", headers });
    expect(impact.statusCode).toBe(200);
    expect(impact.json().validatedByWeek).toEqual({ [montag(zeitpunkt)]: 1 });
    expect(impact.json().validatedUnknownWeek).toBe(0);

    await services.ko.revise(id, { statement: "Bei Überdruck Ventil Y schließen." }, "admin");
    const ueberarbeitet = await services.ko.get(id);
    expect(ueberarbeitet?.status).toBe("offen");
    expect(ueberarbeitet?.validatedAt, "die neue Fassung ist ungeprüft").toBeUndefined();
    await app.close();
  });
});
