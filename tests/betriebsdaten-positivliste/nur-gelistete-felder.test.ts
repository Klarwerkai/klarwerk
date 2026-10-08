// ================================================================================================
// Aufnahme gesamt-telemetrie (R-0623) — BETRIEBSDATEN NUR AUS EINER AUSDRÜCKLICHEN POSITIVLISTE.
// ================================================================================================
//
// „Wenn ueberhaupt Betriebsdaten gesammelt werden, dann nur Felder von einer ausdruecklichen Liste —
// Kundeninhalte gelangen nie in eine zentrale Auswertung. Was nicht auf der Liste steht, wird gar
// nicht erst erhoben."
//
// Gemessen am Schreibweg des KI-Laufprotokolls (`ProtokollModelRunRepo`), über den die App JEDEN
// Lauf speichert, auswertet und als Logzeile `ki_lauf` ausgibt: ein Schreiber gibt Felder mit, die
// auf keiner Liste stehen — darunter Kundeninhalt —, und keiner der drei Ausgänge enthält sie.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  InMemoryModelRunRepo,
  type KiLaufLogzeile,
  MODEL_RUN_FELDER,
  MODEL_RUN_VERSUCH_FELDER,
  type ModelRunRecord,
  ProtokollModelRunRepo,
  lesePreisliste,
  nurGelisteteLauffelder,
  werteLaeufeAus,
} from "../../services/model-runs";

const KUNDENINHALT = "KUNDENINHALT_Wartungsanweisung_Hauptschalter_7f3";

function lauf(): ModelRunRecord {
  return {
    id: "lauf-1",
    task: "answer",
    provider: "anthropic:claude-sonnet-4-6",
    model: "claude-sonnet-4-6",
    demo: false,
    fallback: false,
    locale: "de",
    startedAt: "2026-10-01T10:00:00.000Z",
    finishedAt: "2026-10-01T10:00:00.400Z",
    status: "success",
    verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
    erzeugt: { art: "antwort", anzahl: 1 },
    versuche: [
      {
        provider: "anthropic:claude-sonnet-4-6",
        model: "claude-sonnet-4-6",
        startedAt: "2026-10-01T10:00:00.000Z",
        dauerMs: 400,
        ausgang: "erfolg",
        verbrauch: { eingabeToken: 1000, ausgabeToken: 500, gemeldeteAufrufe: 1 },
        aufrufe: 1,
        spanId: "00f067aa0ba902b7",
      },
    ],
    trace: {
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b8",
      requestId: "req-1",
    },
    actor: "nutzer-1",
    subject: { kind: "ko", id: "ko-1" },
  };
}

// Derselbe Lauf, an JEDER Ebene um ein Feld ergänzt, das auf keiner Liste steht.
function laufMitUngelistetem(): ModelRunRecord {
  const l = lauf() as unknown as Record<string, unknown> & ModelRunRecord;
  const mit = (o: object, feld: string) => Object.assign(o, { [feld]: KUNDENINHALT });
  mit(l, "frage");
  mit(l, "antwort");
  mit(l.verbrauch as object, "rohantwort");
  mit(l.erzeugt as object, "text");
  mit(l.versuche?.[0] as object, "prompt");
  mit(l.versuche?.[0]?.verbrauch as object, "usageRoh");
  mit(l.trace as object, "baggage");
  mit(l.subject as object, "titel");
  return l;
}

const PREISLISTE = lesePreisliste(
  JSON.stringify({
    waehrung: "EUR",
    preisstand: "2026-10-01",
    modelle: { "claude-sonnet-4-6": { eingabeJeMillion: 3, ausgabeJeMillion: 15 } },
  }),
).preisliste;

async function schreibe(record: ModelRunRecord) {
  const speicher = new InMemoryModelRunRepo();
  const protokoll = new ProtokollModelRunRepo(speicher, PREISLISTE);
  const logzeilen: KiLaufLogzeile[] = [];
  protokoll.logAn((z) => logzeilen.push(z));
  await protokoll.append(record);
  const [gespeichert] = await speicher.recent();
  return { gespeichert: gespeichert as ModelRunRecord, logzeilen };
}

describe("R-0623 · Betriebsdaten nur nach Positivliste", () => {
  it("P1 · nicht gelistete Felder werden nicht erhoben — weder gespeichert noch geloggt noch ausgewertet", async () => {
    const { gespeichert, logzeilen } = await schreibe(laufMitUngelistetem());

    expect(JSON.stringify(gespeichert)).not.toContain(KUNDENINHALT);
    expect(logzeilen).toHaveLength(1);
    expect(JSON.stringify(logzeilen)).not.toContain(KUNDENINHALT);
    const auswertung = werteLaeufeAus(
      [gespeichert],
      "2026-10-01T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
      false,
    );
    expect(JSON.stringify(auswertung)).not.toContain(KUNDENINHALT);

    // Auf jeder Ebene steht nur, was die Liste nennt.
    for (const feld of Object.keys(gespeichert)) {
      expect(MODEL_RUN_FELDER as readonly string[], `ungelistetes Feld ${feld}`).toContain(feld);
    }
    for (const feld of Object.keys(gespeichert.versuche?.[0] ?? {})) {
      expect(MODEL_RUN_VERSUCH_FELDER as readonly string[], `ungelistet ${feld}`).toContain(feld);
    }
    expect(Object.keys(gespeichert.verbrauch ?? {}).sort()).toEqual([
      "ausgabeToken",
      "eingabeToken",
      "gemeldeteAufrufe",
    ]);
    expect(Object.keys(gespeichert.subject ?? {}).sort()).toEqual(["id", "kind"]);
    expect(Object.keys(gespeichert.trace ?? {}).sort()).toEqual(["requestId", "spanId", "traceId"]);
    expect(Object.keys(gespeichert.erzeugt ?? {}).sort()).toEqual(["anzahl", "art"]);
  });

  it("P2 · ein vollständig gelisteter Lauf bleibt feldgleich — nur die Kosten kommen hinzu", async () => {
    const { gespeichert } = await schreibe(lauf());
    expect(gespeichert).toStrictEqual({
      ...lauf(),
      kosten: { betrag: 0.0105, waehrung: "EUR", preisstand: "2026-10-01" },
    });
    // Die Positivliste selbst verändert einen gelisteten Lauf nicht.
    expect(nurGelisteteLauffelder(lauf())).toStrictEqual(lauf());
  });

  it("P3 · die Liste nennt keinen Inhaltsnamen (Frage, Antwort, Prompt, Dokumenttext)", () => {
    const alle = [...MODEL_RUN_FELDER, ...MODEL_RUN_VERSUCH_FELDER].map((f) => f.toLowerCase());
    for (const inhalt of ["question", "frage", "answer", "antwort", "prompt", "text", "body"]) {
      expect(alle, `Inhaltsfeld ${inhalt} auf der Liste`).not.toContain(inhalt);
    }
  });

  it("P4 · die App speichert jeden Lauf über genau diesen Schreibweg", () => {
    const build = readFileSync("services/app/src/build-app.ts", "utf8");
    expect(build).toContain(
      "const modelRunProtokoll = new ProtokollModelRunRepo(repos.modelRuns, preislisteLesung.preisliste);",
    );
    // Der Reasoner — der einzige Schreiber des Protokolls — bekommt den Mantel, nicht das rohe Repo.
    expect(build).toMatch(/new Reasoner\(\s*[\s\S]{0,200}?modelRunProtokoll,/);
    const schreiber = readFileSync("services/reasoner/src/service.ts", "utf8");
    expect(schreiber.match(/this\.modelRuns\.append\(/g) ?? []).toHaveLength(1);
  });
});
