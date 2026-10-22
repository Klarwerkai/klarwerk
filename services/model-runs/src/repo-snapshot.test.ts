import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "./repo";
import type { ModelRunRecord, ModelRunVersuch } from "./types";

const VON = "2026-10-21T10:00:00.000Z";
const SPAETER = "2026-10-21T11:00:00.000Z";
const BIS = "2026-10-21T12:00:00.000Z";

function record(id: string, status: ModelRunRecord["status"], startedAt: string): ModelRunRecord {
  const verbrauch = { eingabeToken: 5, ausgabeToken: 2, gemeldeteAufrufe: 1 };
  const versuch: ModelRunVersuch = {
    provider: "synthetisch",
    model: "test",
    startedAt,
    dauerMs: 100,
    ausgang: status === "success" ? "erfolg" : "fehler",
    aufrufe: 1,
    verbrauch: { ...verbrauch },
    spanId: "2".repeat(16),
  };
  const ergebnis: ModelRunRecord = {
    id,
    task: "assist",
    provider: "synthetisch",
    model: "test",
    demo: status === "error",
    fallback: status === "error",
    locale: "de",
    startedAt,
    finishedAt: startedAt.replace(".000Z", ".100Z"),
    status,
    actor: "actor-original",
    subject: { kind: "ko", id: `ko-${id}` },
    verbrauch,
    kosten: { betrag: 0.001, waehrung: "EUR", preisstand: "fiktiv" },
    versuche: [versuch],
    trace: {
      traceId: "1".repeat(32),
      spanId: "4".repeat(16),
      parentSpanId: "5".repeat(16),
      requestId: `request-${id}`,
    },
  };
  if (status === "success") {
    ergebnis.erzeugt = { art: "text", anzahl: 1 };
  } else {
    ergebnis.error = "synthetischer-fehler";
  }
  return ergebnis;
}

function veraendere(eintrag: ModelRunRecord) {
  eintrag.id = `mutiert-${eintrag.id}`;
  eintrag.actor = "actor-mutiert";
  eintrag.startedAt = "2026-10-21T20:00:00.000Z";
  eintrag.finishedAt = "2026-10-21T20:00:00.100Z";
  eintrag.status = eintrag.status === "success" ? "error" : "success";
  eintrag.error = "mutierter-fehler";
  if (eintrag.subject) {
    eintrag.subject.id = "ko-mutiert";
  }
  if (eintrag.verbrauch) {
    eintrag.verbrauch.eingabeToken = 999;
  }
  if (eintrag.kosten) {
    eintrag.kosten.betrag = 999;
    eintrag.kosten.preisstand = "mutiert";
  }
  if (eintrag.erzeugt) {
    eintrag.erzeugt.anzahl = 999;
  }
  for (const versuche of [eintrag.versuche]) {
    if (!versuche) {
      continue;
    }
    for (const versuch of versuche) {
      versuch.spanId = "f".repeat(16);
      if (versuch.verbrauch) {
        versuch.verbrauch.ausgabeToken = 999;
      }
    }
    versuche.splice(0);
  }
  if (eintrag.trace) {
    eintrag.trace.traceId = "f".repeat(32);
    eintrag.trace.spanId = "e".repeat(16);
    eintrag.trace.requestId = "mutiert";
  }
}

describe("PL5: unabhängige InMemory-Laufrecord-Snapshots", () => {
  it("A · Eingabemutation lässt Vollrecords und Erstrecord unverändert", async () => {
    const repo = new InMemoryModelRunRepo();
    const erfolg = record("success", "success", VON);
    const fehler = record("error", "error", SPAETER);
    const erwartetErfolg = record("success", "success", VON);
    const erwartetFehler = record("error", "error", SPAETER);
    await repo.append(erfolg);
    await repo.append(fehler);
    veraendere(erfolg);
    veraendere(fehler);
    await repo.append(record("success", "error", BIS));
    await repo.append(record("error", "success", BIS));

    expect(await repo.recent()).toStrictEqual([erwartetFehler, erwartetErfolg]);
    expect(await repo.vonAkteur("actor-original")).toStrictEqual([erwartetErfolg, erwartetFehler]);
    expect(await repo.vonAkteur("actor-mutiert")).toStrictEqual([]);
  });

  it("B · Mutierbare Rückgaben aller drei Leser verändern weder Bestand noch Filter", async () => {
    const repo = new InMemoryModelRunRepo();
    await repo.append(record("success", "success", VON));
    await repo.append(record("error", "error", SPAETER));
    const erfolg = record("success", "success", VON);
    const fehler = record("error", "error", SPAETER);

    for (const { lesen, erwartet } of [
      { lesen: () => repo.recent(), erwartet: [fehler, erfolg] },
      { lesen: () => repo.zwischen(VON, BIS, 10), erwartet: [fehler, erfolg] },
      { lesen: () => repo.vonAkteur("actor-original"), erwartet: [erfolg, fehler] },
    ]) {
      const gelesen = await lesen();
      expect(gelesen).toStrictEqual(erwartet);
      gelesen.forEach(veraendere);
      gelesen.splice(0);

      expect(await repo.recent()).toStrictEqual([fehler, erfolg]);
      expect(await repo.recent(1)).toStrictEqual([fehler]);
      expect(await repo.zwischen(VON, SPAETER, 10)).toStrictEqual([erfolg]);
      expect(await repo.vonAkteur("actor-original")).toStrictEqual([erfolg, fehler]);
      expect(await repo.vonAkteur("actor-mutiert")).toStrictEqual([]);
      expect(await repo.vonAkteur("  ")).toStrictEqual([]);
    }
  });
});
