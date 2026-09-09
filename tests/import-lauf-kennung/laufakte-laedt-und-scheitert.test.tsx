// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · FALL 4 — DER AUSGANG WIRD NIE BEHAUPTET, BEVOR ER GELESEN IST.
// ================================================================================================
//
// Die Kennung kommt mit der Übernahme-Antwort und steht sofort da. Der AUSGANG kommt aus einer
// zweiten Quelle (`GET /api/admin/import/runs/:importId`, gelesen über den bestehenden Haken
// `useImportRun`) und braucht Zeit — er kann laden, gelingen, scheitern, und er kann als alter
// Stand im Zwischenspeicher liegen, während eine Auffrischung läuft oder gerade gescheitert ist.
//
// DIESE ZUSTÄNDE SIND DER GEGENSTAND (Auftrag §9, und REGELN.md §7, die drei Fehler, die der
// Prüfer am 03.09. dreimal fand):
//
//   1. LÄDT           — die Kennung steht da, über den Ausgang wird NICHTS gesagt.
//   2. GELUNGEN       — Status und Zähler, im Vokabular von `Stufe2.tsx`.
//   3. FEHLGESCHLAGEN — Status, `failureCode` und `failureReason` wörtlich; kein Ersatztext.
//   4. NICHT ABRUFBAR — die Kennung BLEIBT sichtbar, der Ausgang wird als nicht abrufbar benannt;
//                       nie als „erfolgreich", nie als leerer Zähler.
//   5. ALTER STAND    — scheitert die Auffrischung, bleiben die zuletzt gelesenen Werte SICHTBAR,
//                       aber ausdrücklich als alter Stand gekennzeichnet.
//   6. AUFFRISCHUNG   — sie läuft: der alte Stand bleibt, wird aber nicht als frisch ausgegeben.
//   7. AUSGESETZT     — ohne Verbindung hält react-query die Abfrage an (`fetchStatus: "paused"`):
//                       KEIN `isError`, KEIN `isFetching`. Genau dieser Zustand fehlte in Runde 1
//                       (Prüferbefund BEN), und genau er ist der gefährlichste — die Fläche sähe
//                       ruhig und aktuell aus, obwohl niemand mehr nachfragt. Zwei Lagen: mit
//                       gelesener Akte (D7) und ohne (D8).
//
// ARIA-HIDDEN: nicht mitgelesen, aus dem im Kopf von `buehne.tsx` genannten Grund. Für Zustand 1
// ist das doppelt wichtig: dort wird die ABWESENHEIT einer Aussage zugesichert, und eine Aussage,
// die nur unter `aria-hidden` läge, wäre für einen sehenden Nutzer trotzdem da. Deshalb prüft
// dieser Fall die Abwesenheit am SICHTBAREN Text — der engeren, nicht der bequemeren Menge.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn() } } },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({ useImportRun: vi.fn() }));

import i18n from "../../apps/web/src/i18n";
import {
  abbauen,
  bisZurBilanz,
  laufAntwortStellen,
  laufakte,
  sichtbarerText,
  uebernahmeAntwort,
  uebernahmeDoppel,
} from "./buehne";

const KENNUNG = "run-4711";

/** Jeder Zustandsname, den `importRunStateView` kennt — keiner davon darf beim Laden dastehen. */
const ALLE_ZUSTANDSNAMEN = [
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "unknown",
].map((s) => `w2.run.status.${s}`);

/**
 * Die festen Bruchstücke des Zählersatzes, ohne die eingesetzten Zahlen.
 *
 * Auf „0 von 0" zu prüfen wäre zu eng: eine Fläche, die beim Laden IRGENDEINE Zahl behauptet, käme
 * damit durch. Geprüft wird deshalb der Satz selbst — sprachunabhängig, weil er aus i18n kommt und
 * die Platzhalter mit Markern herausgeschnitten werden.
 */
const MARKE = "@@";

function zaehlersatzBruchstuecke(): string[] {
  return i18n
    .t("w2.run.progress", { verarbeitet: MARKE, gesamt: MARKE })
    .split(MARKE)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  uebernahmeDoppel().mockResolvedValue(uebernahmeAntwort(KENNUNG));
});

afterEach(async () => {
  await abbauen();
  vi.clearAllMocks();
});

describe("JOB 3357 · L3 + §9 — der Ausgang folgt seiner Quelle, nicht der Hoffnung", () => {
  it("D0 · die Zählersatz-Erhebung greift wirklich — sonst wären D1 und D4 leer-grün", () => {
    // Ein `.some()` über eine leere Liste ist immer `false`. Ohne diesen Fall würden D1 und D4
    // „kein Zählersatz" auch dann melden, wenn die Erhebung nichts findet.
    const bruchstuecke = zaehlersatzBruchstuecke();
    expect(bruchstuecke.length).toBeGreaterThan(0);
    expect(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })).toContain(
      bruchstuecke[0] as string,
    );
  });

  it("D1 · LÄDT: die Kennung steht da, über den Ausgang steht NICHTS", async () => {
    laufAntwortStellen({ data: undefined, isError: false, isFetching: true, isPaused: false });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      kennungDa: text.includes(KENNUNG),
      ladehinweis: text.includes(i18n.t("imp.groups.runOutcomeLoading")),
      // KEIN Zustandswort, kein Zählersatz — solange nichts gelesen ist, wird nichts gesagt.
      behaupteteZustaende: ALLE_ZUSTANDSNAMEN.filter((k) => text.includes(i18n.t(k))),
      zaehlerBehauptet: zaehlersatzBruchstuecke().some((b) => text.includes(b)),
      // Und ausdrücklich auch nicht das Gegenteil: „nicht abrufbar" ist beim Laden genauso falsch.
      nichtAbrufbarBehauptet: text.includes(i18n.t("imp.groups.runOutcomeUnavailable")),
    }).toEqual({
      kennungDa: true,
      ladehinweis: true,
      behaupteteZustaende: [],
      zaehlerBehauptet: false,
      nichtAbrufbarBehauptet: false,
    });
  });

  it("D2 · GELUNGEN: Status und Zähler stehen da — im Vokabular der Stufe 2", async () => {
    laufAntwortStellen({
      data: laufakte({
        counters: {
          itemsTotal: 3,
          itemsCreated: 2,
          itemsBound: 1,
          itemsSkipped: 0,
          itemsFailed: 0,
        },
      }),
      isError: false,
      isFetching: false,
      isPaused: false,
    });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      status: text.includes(i18n.t("w2.run.status.COMPLETED")),
      // 2 angelegt + 1 gebunden + 0 übersprungen + 0 gescheitert = 3 verarbeitet, von 3.
      zaehler: text.includes(i18n.t("w2.run.progress", { verarbeitet: 3, gesamt: 3 })),
      keinLadehinweis: text.includes(i18n.t("imp.groups.runOutcomeLoading")),
      keinAltstandhinweis: text.includes(i18n.t("imp.groups.runOutcomeStale")),
    }).toEqual({ status: true, zaehler: true, keinLadehinweis: false, keinAltstandhinweis: false });
  });

  it("D3 · FEHLGESCHLAGEN: Code und Grund stehen wörtlich da", async () => {
    laufAntwortStellen({
      data: laufakte({
        status: "FAILED",
        completedAt: null,
        failureCode: "CONFLUENCE_LIMIT",
        failureReason: "Die Quelle hat die Seitengrenze überschritten",
      }),
      isError: false,
      isFetching: false,
      isPaused: false,
    });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      status: text.includes(i18n.t("w2.run.status.FAILED")),
      code: text.includes("CONFLUENCE_LIMIT"),
      grund: text.includes("Die Quelle hat die Seitengrenze überschritten"),
      // Ein fehlgeschlagener Lauf hat trotzdem eine Kennung — gerade dann braucht Pedi sie.
      kennungDa: text.includes(KENNUNG),
      // Und er wird NICHT als Erfolg gezeigt.
      alsErfolg: text.includes(i18n.t("w2.run.status.COMPLETED")),
    }).toEqual({ status: true, code: true, grund: true, kennungDa: true, alsErfolg: false });
  });

  it("D4 · NICHT ABRUFBAR: die Kennung bleibt, der Ausgang wird als nicht abrufbar benannt", async () => {
    laufAntwortStellen({ data: undefined, isError: true, isFetching: false, isPaused: false });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      kennungBleibt: text.includes(KENNUNG),
      benannt: text.includes(i18n.t("imp.groups.runOutcomeUnavailable")),
      // Weder Erfolg noch leerer Zähler — beides wäre eine Aussage über Ungelesenes.
      behaupteteZustaende: ALLE_ZUSTANDSNAMEN.filter((k) => text.includes(i18n.t(k))),
      leererZaehler: zaehlersatzBruchstuecke().some((b) => text.includes(b)),
      ladehinweis: text.includes(i18n.t("imp.groups.runOutcomeLoading")),
    }).toEqual({
      kennungBleibt: true,
      benannt: true,
      behaupteteZustaende: [],
      leererZaehler: false,
      ladehinweis: false,
    });
  });

  it("D5 · ALTER STAND: gescheiterte Auffrischung leert nichts — kennzeichnet aber", async () => {
    // REGELN.md §7, erster Satz: „Scheitert eine Hintergrund-Auffrischung, bleiben die zuletzt
    // erfolgreich geholten Werte SICHTBAR, mit dem Hinweis … Niemals Karte, Stufe, Zahlen oder
    // Herkunft leeren." Genau dieser Zustand: `data` liegt noch, `isError` steht schon.
    laufAntwortStellen({ data: laufakte(), isError: true, isFetching: false, isPaused: false });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      werteBleiben: text.includes(i18n.t("w2.run.status.COMPLETED")),
      zaehlerBleiben: text.includes(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })),
      // Kennzeichnung UND Grund: der eine Satz sagt „nicht aktuell", der andere, warum.
      alsAltstandGekennzeichnet: text.includes(i18n.t("imp.groups.runOutcomeStale")),
      grund: text.includes(i18n.t("imp.groups.runOutcomeStaleFailed")),
    }).toEqual({
      werteBleiben: true,
      zaehlerBleiben: true,
      alsAltstandGekennzeichnet: true,
      grund: true,
    });
  });

  it("D6 · LAUFENDE AUFFRISCHUNG: der alte Stand bleibt, wird aber nicht als frisch ausgegeben", async () => {
    laufAntwortStellen({ data: laufakte(), isError: false, isFetching: true, isPaused: false });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      werteBleiben: text.includes(i18n.t("w2.run.status.COMPLETED")),
      alsAltstandGekennzeichnet: text.includes(i18n.t("imp.groups.runOutcomeStale")),
      alsAuffrischungGekennzeichnet: text.includes(i18n.t("imp.groups.runOutcomeRefreshing")),
      // „Auffrischung läuft" ist nicht dasselbe wie „Auffrischung gescheitert".
      nichtAlsGescheitert: text.includes(i18n.t("imp.groups.runOutcomeStaleFailed")),
    }).toEqual({
      werteBleiben: true,
      alsAltstandGekennzeichnet: true,
      alsAuffrischungGekennzeichnet: true,
      nichtAlsGescheitert: false,
    });
  });

  it("D7 · AUSGESETZT mit Akte: der alte Ausgang bleibt — ausdrücklich als alter Stand", async () => {
    // Der Befund des Prüfers, Runde 1: offline gemessen `{"status":"success","fetchStatus":"paused"}`
    // — `isError` und `isFetching` BEIDE falsch, und die Fläche ließ den Ausgang unmarkiert stehen.
    // Ohne diesen Fall bliebe die Zusage aus §9 („darf nicht unmarkiert als aktueller Stand stehen
    // bleiben") ungeprüft. Dass dieser Doppelgänger die echte Lage trifft, misst
    // `laufakte-offline-pausiert.test.tsx` am echten `QueryClient`.
    laufAntwortStellen({ data: laufakte(), isError: false, isFetching: false, isPaused: true });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      werteBleiben: text.includes(i18n.t("w2.run.status.COMPLETED")),
      zaehlerBleiben: text.includes(i18n.t("w2.run.progress", { verarbeitet: 1, gesamt: 1 })),
      alsAltstandGekennzeichnet: text.includes(i18n.t("imp.groups.runOutcomeStale")),
      grund: text.includes(i18n.t("imp.groups.runOutcomeStalePaused")),
      // Nicht die falsche Begründung: es ist nichts gescheitert und es läuft nichts.
      nichtAlsGescheitert: text.includes(i18n.t("imp.groups.runOutcomeStaleFailed")),
      nichtAlsLaufend: text.includes(i18n.t("imp.groups.runOutcomeRefreshing")),
    }).toEqual({
      werteBleiben: true,
      zaehlerBleiben: true,
      alsAltstandGekennzeichnet: true,
      grund: true,
      nichtAlsGescheitert: false,
      nichtAlsLaufend: false,
    });
  });

  it("D8 · AUSGESETZT ohne Akte: kein Ladehinweis — es lädt ja nichts", async () => {
    laufAntwortStellen({ data: undefined, isError: false, isFetching: false, isPaused: true });
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      kennungBleibt: text.includes(KENNUNG),
      benannt: text.includes(i18n.t("imp.groups.runOutcomeOffline")),
      // „wird geladen" wäre hier eine Behauptung über einen Vorgang, den es nicht gibt.
      ladehinweis: text.includes(i18n.t("imp.groups.runOutcomeLoading")),
      behaupteteZustaende: ALLE_ZUSTANDSNAMEN.filter((k) => text.includes(i18n.t(k))),
      zaehlerBehauptet: zaehlersatzBruchstuecke().some((b) => text.includes(b)),
    }).toEqual({
      kennungBleibt: true,
      benannt: true,
      ladehinweis: false,
      behaupteteZustaende: [],
      zaehlerBehauptet: false,
    });
  });
});
