// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) — RÜCKFRAGEN ZU GESPROCHENEN AUFTRÄGEN, OHNE BROWSER.
// ================================================================================================
//
// Misst `apps/web/src/lib/klaraSprache.ts`: welche Stellen eines gesprochenen Textes unklar sind
// (Namen, Zeiten, Bezug), welche Lesarten angeboten werden und dass jede Wahl einen KORRIGIERTEN Text
// ergibt, der danach nicht erneut als unklar gilt. Dazu die Einordnung Frage/Arbeitsauftrag und die
// Fehlermeldung der Rekorder-Fabrik (Mikrofon abgelehnt). Die Fläche selbst misst
// `klara-sprache-am-server.test.tsx`.
import { describe, expect, it } from "vitest";
import {
  type KlaerKontext,
  anfuegen,
  auftragsArt,
  klaerungen,
} from "../../apps/web/src/lib/klaraSprache";
import { makeRec } from "../../apps/web/src/lib/speechDictation";

// Freitag, 09.10.2026, 10:00 Uhr Ortszeit.
const JETZT = new Date(2026, 9, 9, 10, 0, 0);
const BEZUG = "(Bezug: Artikel · Rollenwechsel)";

function kontext(teil: Partial<KlaerKontext> = {}): KlaerKontext {
  return {
    personen: [
      { id: "p1", name: "Anna Berger" },
      { id: "p2", name: "Anna Kramer" },
      { id: "p3", name: "Jonas Weber" },
    ],
    jetzt: JETZT,
    sprache: "de",
    bezug: BEZUG,
    ...teil,
  };
}

/** Wählt für jede Rückfrage die erste Lesart, bis keine mehr offen ist. */
function alleErsteWahl(text: string, k: KlaerKontext): string {
  let t = text;
  for (let i = 0; i < 10; i++) {
    const offen = klaerungen(t, k);
    const erste = offen[0]?.optionen[0];
    if (!erste) {
      return t;
    }
    t = erste.text;
  }
  throw new Error(`Rückfragen enden nicht: ${t}`);
}

describe("K3 · Namen", () => {
  it("ein Vorname zweier Personen wird geklärt, die Wahl schreibt den vollen Namen in den Text", () => {
    const [k] = klaerungen("Was macht Anna heute im Werk?", kontext({ bezug: null })).filter(
      (x) => x.art === "name",
    );
    expect(k?.fund).toBe("Anna");
    expect(k?.optionen.map((o) => o.wert)).toEqual(["Anna Berger", "Anna Kramer"]);
    const neu = k?.optionen[1]?.text ?? "";
    expect(neu).toBe("Was macht Anna Kramer heute im Werk?");
    expect(klaerungen(neu, kontext()).filter((x) => x.art === "name")).toEqual([]);
  });

  it("ein eindeutiger oder schon voller Name ist nicht unklar", () => {
    expect(klaerungen("Wo arbeitet Jonas?", kontext()).filter((x) => x.art === "name")).toEqual([]);
    expect(
      klaerungen("Wo arbeitet Anna Berger?", kontext()).filter((x) => x.art === "name"),
    ).toEqual([]);
  });
});

describe("K3 · Zeitangaben", () => {
  it("„morgen“ wird ein Datum; „So lassen“ ist ebenfalls eine Wahl", () => {
    const [k] = klaerungen("Was steht morgen an?", kontext());
    expect(k?.art).toBe("zeit");
    expect(k?.optionen[0]?.text).toBe("Was steht am 10.10.2026 an?");
    expect(k?.optionen[0]?.wert).toContain("10.10.2026");
    expect(k?.optionen[1]).toEqual({ wert: null, text: "Was steht morgen an?" });
    expect(klaerungen("Was steht am 10.10.2026 an?", kontext())).toEqual([]);
  });

  it("„heute Morgen“ ist keine Frage nach dem nächsten Tag", () => {
    const funde = klaerungen("Was war heute Morgen?", kontext()).map((x) => x.fund);
    expect(funde).toEqual(["heute"]);
  });

  it("ein Wochentag ohne Datum bekommt die nächsten zwei Termine", () => {
    const [k] = klaerungen("Was ist am Dienstag geplant?", kontext());
    expect(k?.fund).toBe("am Dienstag");
    expect(k?.optionen.map((o) => o.wert)).toEqual([
      "Dienstag, 13.10.2026",
      "Dienstag, 20.10.2026",
    ]);
    const neu = k?.optionen[0]?.text ?? "";
    expect(neu).toBe("Was ist am Dienstag, 13.10.2026 geplant?");
    expect(klaerungen(neu, kontext())).toEqual([]);
  });

  it("„um drei“ ohne Tageszeit: 03:00 oder 15:00 — mit Tageszeit oder Minuten nicht unklar", () => {
    const [k] = klaerungen("Wer hat um drei Uhr Schicht?", kontext());
    expect(k?.optionen.map((o) => o.wert)).toEqual(["03:00", "15:00"]);
    const neu = k?.optionen[1]?.text ?? "";
    expect(neu).toBe("Wer hat um 15:00 Uhr Schicht?");
    expect(klaerungen(neu, kontext())).toEqual([]);
    expect(klaerungen("Wer hat um drei Uhr nachmittags Schicht?", kontext())).toEqual([]);
    expect(klaerungen("Wer hat um 10:30 Schicht?", kontext())).toEqual([]);
  });

  it("englisch: „tomorrow“ und „at 3“", () => {
    const k = klaerungen("Who works tomorrow at 3?", kontext({ sprache: "en" }));
    expect(k.map((x) => x.fund)).toEqual(["tomorrow", "at 3"]);
    expect(k[0]?.optionen[0]?.text).toBe("Who works on 10/10/2026 at 3?");
  });
});

describe("K3 · Ziel", () => {
  it("„hier“ bekommt das Ziel der Seite als Bezug — oder bewusst keinen", () => {
    const [k] = klaerungen("Was bedeutet das hier?", kontext());
    expect(k?.art).toBe("ziel");
    expect(k?.optionen[0]).toEqual({ wert: BEZUG, text: `Was bedeutet das hier? ${BEZUG}` });
    expect(k?.optionen[1]?.wert).toBeNull();
    expect(klaerungen(`Was bedeutet das hier? ${BEZUG}`, kontext())).toEqual([]);
  });

  it("ohne erkanntes Objekt bleibt nur „ohne Bezug“ (oder selbst im Text nennen)", () => {
    const [k] = klaerungen("Was steht hier?", kontext({ bezug: null }));
    expect(k?.optionen).toEqual([{ wert: null, text: "Was steht hier?" }]);
  });
});

describe("K3 · korrigierter Text wird weiterverwendet", () => {
  it("nach allen Wahlen ist nichts mehr offen, und der Text trägt jede Entscheidung", () => {
    const fertig = alleErsteWahl("Hat Anna morgen um drei hier Dienst?", kontext());
    expect(fertig).toBe(`Hat Anna Berger am 10.10.2026 um 03:00 hier Dienst? ${BEZUG}`);
    expect(klaerungen(fertig, kontext())).toEqual([]);
  });
});

describe("K2/K5 · Frage oder Arbeitsauftrag", () => {
  it("Fragen bleiben Fragen, Handlungssätze heissen Arbeitsauftrag", () => {
    expect(auftragsArt("Wie wird die Dichtung entlastet")).toBe("frage");
    expect(auftragsArt("Die Dichtung entlasten?")).toBe("frage");
    expect(auftragsArt("Lege eine Aufgabe für Anna an")).toBe("aktion");
    expect(auftragsArt("Erinnere mich morgen an die Prüfung")).toBe("aktion");
    expect(auftragsArt("Remind me tomorrow")).toBe("aktion");
  });

  it("Diktat hängt mit genau einem Leerzeichen an", () => {
    expect(anfuegen("", " Wie geht ")).toBe("Wie geht");
    expect(anfuegen("Wie geht", "das")).toBe("Wie geht das");
    expect(anfuegen("Wie geht  ", "")).toBe("Wie geht  ");
  });
});

describe("K4 · die Rekorder-Fabrik nennt den Grund eines Fehlers", () => {
  it("„not-allowed“ kommt vor dem Ende an; ohne Rückruf bleibt alles wie vorher", () => {
    const folge: string[] = [];
    class Doppel {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: unknown = null;
      onend: (() => void) | null = null;
      onerror: ((e?: { error?: string }) => void) | null = null;
      start(): void {}
      stop(): void {}
    }
    const g = globalThis as unknown as { SpeechRecognition?: unknown };
    g.SpeechRecognition = Doppel;
    try {
      const rec = makeRec(
        () => {},
        () => folge.push("ende"),
        "de-DE",
        undefined,
        (grund) => folge.push(`grund:${grund}`),
      );
      rec?.onerror?.({ error: "not-allowed" });
      expect(folge).toEqual(["grund:not-allowed", "ende"]);

      const alt = makeRec(
        () => {},
        () => folge.push("ende-alt"),
        "de-DE",
      );
      alt?.onerror?.();
      expect(folge.at(-1)).toBe("ende-alt");
    } finally {
      g.SpeechRecognition = undefined;
    }
  });
});
