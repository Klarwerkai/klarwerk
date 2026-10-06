// @vitest-environment jsdom
// ================================================================================================
// WORD-HOST-GESAMTWEG (Realhostbeleg 06.10.2026) — DIE MARKIERUNG KOMMT AN, AUCH WENN WORD SCHWEIGT.
// ================================================================================================
//
// In Word im Web blieb der Rückruf von `getSelectedDataAsync` aus; die Frage endete trotz 20 von 20
// markierten Wörtern in askSelectionTimeout (HOST-20261005/WORD-AUSWAHL-FRIST-20261006.json). Der
// Absendeweg liest die Markierung seither zuerst über `Word.run` → `getSelection().text` mit
// eigener Frist (4 s) und fällt erst danach auf den alten Weg zurück. Gemessen wird am ganzen
// ausgelieferten Fenster über die Panel-Fixture; gezählt wird, was wirklich an `/api/ask` geht.
// Was diese Datei NICHT belegt: die Antwort des echten Word im Web — das bleibt ein Hostlauf.
//
// Nacharbeit 7: die Fälle standen zuerst in `word-addin-ask.test.ts` und sind unverändert hierher
// umgezogen (dort war ein fremder, unveränderter Quelltext-Pin rot, der mit dieser Änderung nichts
// zu tun hat — die Prüfauswahl soll ihn nicht mitziehen).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORD_ADDIN_ASK_TIMEOUT_MS } from "../../apps/web/src/lib/wordAddin";
import { type FakeWordAuswahl, type KlaraPanel, createKlaraPanel } from "./klara-panel-fixture";

const AUSWAHL_MARKIERUNG = "Ventil vor der Wartung drucklos schalten.";
const AUSWAHL_FRAGE = "Was gilt vor der Wartung?";

let auswahlPanel: KlaraPanel | null = null;

function auswahlOeffnen(optionen: {
  wordAuswahl?: FakeWordAuswahl;
  auswahlHaengt?: boolean;
  selectionText?: string;
}): KlaraPanel {
  auswahlPanel = createKlaraPanel({
    selectionText: optionen.selectionText ?? "",
    ...(optionen.wordAuswahl ? { wordAuswahl: optionen.wordAuswahl } : {}),
    ...(optionen.auswahlHaengt ? { auswahlHaengt: true } : {}),
  });
  return auswahlPanel;
}

function frageEintippen(p: KlaraPanel, frage: string): void {
  const feld = p.q("#ask-input");
  if (feld === null) {
    throw new Error("#ask-input fehlt");
  }
  feld.value = frage;
}

/** Was wirklich an `/api/ask` ging — jeder Aufruf mit seinem Körper. */
function askKoerper(p: KlaraPanel): Array<Record<string, unknown>> {
  return p.calls
    .filter((c) => c.url === "/api/ask" && c.method === "POST")
    .map((c) => JSON.parse(c.body ?? "{}") as Record<string, unknown>);
}

describe("Word-Host-Gesamtweg · Kontextfrage: der Auswahlzugriff hängt nicht mehr an getSelectedDataAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    auswahlPanel?.restore();
    auswahlPanel = null;
    vi.useRealTimers();
  });

  it("W1 · Realhost-Lage: getSelectedDataAsync schweigt, Word.run liefert — genau EINE Frage mit Markierung", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "sofort", text: AUSWAHL_MARKIERUNG },
      auswahlHaengt: true,
    });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.question).toBe(AUSWAHL_FRAGE);
    expect(koerper[0]?.selection).toBe(AUSWAHL_MARKIERUNG);
    expect(koerper[0]?.questionSource).toBe("manual");
    expect(p.text("#ask-status")).not.toBe(p.t("askSelectionTimeout"));
  });

  it("W2 · ohne getippte Frage wird die Markierung selbst zur Frage (Herkunft „selection“)", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "sofort", text: AUSWAHL_MARKIERUNG },
      auswahlHaengt: true,
    });
    await p.flush();
    p.askKlara();
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.question).toBe(AUSWAHL_MARKIERUNG);
    expect(koerper[0]?.questionSource).toBe("selection");
  });

  it("W3 · Word.run schweigt: nach seiner Frist übernimmt der alte Weg — genau eine Frage", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "nie", text: "nie geliefert" },
      selectionText: AUSWAHL_MARKIERUNG,
    });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    expect(askKoerper(p), "vor der Frist darf nichts abgehen").toHaveLength(0);
    vi.advanceTimersByTime(4_001);
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.selection).toBe(AUSWAHL_MARKIERUNG);
  });

  it("W4 · beide Wege schweigen: ehrliche Zeitüberschreitung, KEINE Frage", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "nie", text: "nie geliefert" },
      auswahlHaengt: true,
    });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    vi.advanceTimersByTime(WORD_ADDIN_ASK_TIMEOUT_MS + 1);
    await p.flush();
    expect(askKoerper(p)).toHaveLength(0);
    expect(p.text("#ask-status")).toBe(p.t("askSelectionTimeout"));
  });

  it("W5 · eine VERSPÄTETE Word-Antwort nach dem Rückfall löst keinen zweiten Versand aus", async () => {
    const wa: FakeWordAuswahl = { lage: "verzoegert", text: "späte Word-Markierung" };
    const p = auswahlOeffnen({ wordAuswahl: wa, selectionText: AUSWAHL_MARKIERUNG });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    vi.advanceTimersByTime(4_001);
    await p.flush();
    expect(askKoerper(p)).toHaveLength(1);
    const spaet = wa.ausstehend?.shift();
    expect(spaet, "die Word-Antwort stand nicht aus").toBeDefined();
    spaet?.();
    await p.flush();
    expect(askKoerper(p)).toHaveLength(1);
    expect(askKoerper(p)[0]?.selection).toBe(AUSWAHL_MARKIERUNG);
  });

  it("W6 · verspätete Word-Antwort nach der Gesamtfrist: kein Versand, die Zeitüberschreitung bleibt", async () => {
    const wa: FakeWordAuswahl = { lage: "verzoegert", text: AUSWAHL_MARKIERUNG };
    const p = auswahlOeffnen({ wordAuswahl: wa, auswahlHaengt: true });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    vi.advanceTimersByTime(WORD_ADDIN_ASK_TIMEOUT_MS + 1);
    await p.flush();
    wa.ausstehend?.shift()?.();
    await p.flush();
    expect(askKoerper(p)).toHaveLength(0);
    expect(p.text("#ask-status")).toBe(p.t("askSelectionTimeout"));
  });

  it("W7 · Word.run wirft: der alte Weg übernimmt sofort — genau eine Frage mit Markierung", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "wirft", text: "" },
      selectionText: AUSWAHL_MARKIERUNG,
    });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.selection).toBe(AUSWAHL_MARKIERUNG);
  });

  it("W8 · ein zweiter Klick, während Word noch liest, schickt nichts Zweites", async () => {
    const wa: FakeWordAuswahl = { lage: "verzoegert", text: AUSWAHL_MARKIERUNG };
    const p = auswahlOeffnen({ wordAuswahl: wa, auswahlHaengt: true });
    await p.flush();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    p.askKlara();
    await p.flush();
    wa.ausstehend?.shift()?.();
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.selection).toBe(AUSWAHL_MARKIERUNG);
  });

  it("W9 · GEGENPROBE Mitlesen AUS: keine Markierung reist mit, die getippte Frage geht ab", async () => {
    const p = auswahlOeffnen({
      wordAuswahl: { lage: "sofort", text: AUSWAHL_MARKIERUNG },
      auswahlHaengt: true,
    });
    await p.flush();
    p.q("#einst-mitlesen")?.click();
    frageEintippen(p, AUSWAHL_FRAGE);
    p.askKlara();
    await p.flush();
    const koerper = askKoerper(p);
    expect(koerper).toHaveLength(1);
    expect(koerper[0]?.question).toBe(AUSWAHL_FRAGE);
    expect(koerper[0]?.selection).toBeUndefined();
  });
});
