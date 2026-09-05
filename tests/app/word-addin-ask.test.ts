// @vitest-environment jsdom
//
// JOB 1153 (KA6 Stufe 1): DIE UMGEBUNGSDIREKTIVE IST NEU — und sie ist die einzige Zeile dieser
// Datei, die nicht zu einem KA6-Fall gehoert. Der KA6-Vertrag verlangt einen VERHALTENSfall am
// ganzen Aufgabenfenster (Spion auf `Word.run` und `setSelectedDataAsync`), und der braucht ein
// Dokument. Die neun bestehenden Faelle sind DOM-frei; dass sie unter jsdom unveraendert gruen
// bleiben, ist gemessen und in der Rueckgabe belegt.
//
// Der Gate-`tsc` laeuft ohne DOM-lib (`tsconfig.json`: `lib: ["ES2022"]`, `tests/**/*.ts` ist im
// Check) und `@types/jsdom` gibt es nicht. Die DOM-Zugriffe werden deshalb ueber schmale
// Struktur-Typen abgegriffen — dasselbe Muster, das `tests/app/word-addin-taskpane-cache.test.ts:36-46`
// bereits traegt. Kein neues Muster, keine neue Abhaengigkeit.
//
// WP-KLARA-ASK (Pedis Entscheid 22.07., bens Option B): das Klara-Funktionsversprechen — Aussage
// in Word markieren, Klara fragen, quellengebundene Antwort aus dem VALIDIERTEN Werkswissen.
// Getestet (Muster KLARA-2: DOM-freie Helfer + Inline-Spiegel + Quelltext-Pins):
//  (1) Frage-Vorbereitung: Auswahl vor Eingabefeld, Kappung bei 2000 Zeichen (ehrlich gemeldet),
//  (2) der Ask-Fluss mit Fake-fetch: Antwort / Wissensluecke / 401 / Timeout — exakt der
//      BESTEHENDE Konsolen-Vertrag POST /api/ask (Session, ko.read; keine neue Route),
//  (3) Einfuege-Gating: NUR eine echte quellengebundene Antwort darf ins Dokument (nie die Luecke),
//      Quellen-Zeile korrekt (Titel + KLARWERK + Stand-Datum),
//  (4) Wissensluecken-Weg: offene Frage als Front-Door-Draft (Titel-Konvention, Deep-Link),
//  (5) Inline-Spiegel im buildlosen Taskpane verhaltensgleich, i18n x3, Tab-Struktur.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AskFetchFn,
  type AskFetchInit,
  type AskFetchResponseLike,
  type AskOutcome,
  type PreparedAskQuestion,
  WORD_ADDIN_ASK_MAX_CHARS,
  WORD_ADDIN_ASK_TIMEOUT_MS,
  WORD_ADDIN_RETRY_AFTER_MAX_SECONDS,
  WORD_ADDIN_TITLE_MAX,
  answerInsertEvidenceNote,
  answerSelectionIsWhole,
  askGradeOf,
  askLocale,
  buildAnswerInsertText,
  buildAskSourceLine,
  canInsertAnswer,
  composeAnswerOutput,
  formatAskDateLabel,
  newestSourceDateLabel,
  openQuestionDraftTitle,
  parseRetryAfterSeconds,
  performAsk,
  prepareAskQuestion,
  stripAskAnswerMarkdown,
  stripComposedMetaLines,
} from "../../apps/web/src/lib/wordAddin";
// G24 (JOB 1610): die Fixture baut den Serververtrag nicht mehr NACH, sie BENUTZT ihn. Siehe
// `ka6AskKoerper` — der Grund steht dort.
import { aiGeneratedMark } from "../../services/model-runs";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function fakeRes(status: number, body: unknown): AskFetchResponseLike {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// AUFTRAG-JOB507-D4: eine Antwort MIT Kopfzeilen — der Retry-After-Weg liest sie wirklich aus.
function fakeResWithHeaders(
  status: number,
  body: unknown,
  headers: Record<string, string>,
): AskFetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (name: string): string | null => {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key === undefined ? null : (headers[key] ?? null);
      },
    },
  };
}

const ANSWERED_BODY = {
  result: {
    answered: true,
    answer: "Ventil vor der Wartung entlasten und den Druck pruefen.",
    sources: ["ko-1", "ko-2"],
    trust: 62,
  },
  gap: null,
};

const GAP_BODY = {
  result: { answered: false, answer: null, sources: [], trust: 0 },
  gap: { id: "gap-1" },
};

// JOB 3019 (KA5): DIESER BLOCK PRUEFT DEN TYPESCRIPT-ZWILLING, NICHT DAS AUSGELIEFERTE FENSTER.
// Der Zwilling `apps/web/src/lib/wordAddin.ts` traegt weiterhin „Auswahl vor Eingabefeld"; das
// Panel tut das seit KA5 NICHT mehr (es stellt die getippte Frage und schickt die Markierung als
// eigenes Feld mit). Der Zwilling liegt AUSSERHALB der Zielpfade von JOB 3019 — Runde 2 hatte ihn
// nachgezogen, die Vorpruefung des Tors hat das als Zielpfad-Verstoss zurueckgewiesen. Wo die
// beiden auseinanderlaufen, steht in Teil 3 NAMENTLICH und auf beiden Seiten woertlich gepinnt;
// was das Panel wirklich absendet, misst `tests/app/k1-ask-koerper-markierung.test.tsx` am
// Koerper (JOB 3056 Nachzug-Runde 1: die Faelle A/C/D der in der Konfliktrunde geloeschten
// KA5-Datei, an der ausgelieferten Flaeche). Der Zwilling hat keinen Aufrufer in der Anwendung
// (nur Tests importieren ihn).
describe("WP-KLARA-ASK Teil 1: Frage-Vorbereitung des Zwillings (Auswahl vor Eingabefeld, ehrliche Kappung)", () => {
  it("Zwilling: Word-Auswahl hat Vorrang; leere Auswahl → Eingabefeld; beides leer → empty", () => {
    expect(prepareAskQuestion("  Aussage aus Word  ", "getippt")).toEqual({
      question: "Aussage aus Word",
      from: "selection",
      truncated: false,
    });
    expect(prepareAskQuestion("   ", "Freie Frage?")).toEqual({
      question: "Freie Frage?",
      from: "manual",
      truncated: false,
    });
    expect(prepareAskQuestion("", "  ")).toEqual({ question: "", from: "empty", truncated: false });
  });

  it("Zwilling: kappt riesige Word-Auswahlen bei der Konstante (2000) und meldet es ehrlich", () => {
    expect(WORD_ADDIN_ASK_MAX_CHARS).toBe(2000);
    const huge = "x".repeat(WORD_ADDIN_ASK_MAX_CHARS + 500);
    const prep = prepareAskQuestion(huge, "");
    expect(prep.truncated).toBe(true);
    expect(prep.question.length).toBe(WORD_ADDIN_ASK_MAX_CHARS);
    // Exakt am Deckel: keine Kappung, keine Meldung.
    const atLimit = prepareAskQuestion("y".repeat(WORD_ADDIN_ASK_MAX_CHARS), "");
    expect(atLimit.truncated).toBe(false);
  });

  // AUFTRAG-mega52 D1: DIESER FALL HIELT PEDIS BEFUND FEST, ohne ihn als solchen zu benennen.
  // Der Server-Vertrag kannte de/en, und die niederlaendische Word-Oberflaeche fragte deshalb auf
  // Deutsch nach — genau das meldete der Handlauf vom 28.07. als P0. Der Vertrag ist jetzt
  // dreisprachig; unbekannte Kennungen fallen weiterhin auf den sicheren Default.
  it("askLocale: der Server kennt de/en/nl — die NL-Oberflaeche fragt auf Niederlaendisch", () => {
    expect(askLocale("de")).toBe("de");
    expect(askLocale("en")).toBe("en");
    expect(askLocale("nl")).toBe("nl");
    expect(askLocale("fr")).toBe("de");
  });
});

describe("WP-KLARA-ASK Teil 1: performAsk — der Konsolen-Vertrag mit Fake-fetch", () => {
  it("sendet EXAKT den bestehenden /api/ask-Request (Same-Origin-Session, keine neue Route)", async () => {
    let seenUrl = "";
    let seenInit: AskFetchInit | null = null;
    const spy: AskFetchFn = async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return fakeRes(200, ANSWERED_BODY);
    };
    await performAsk("Wie entlaste ich das Ventil?", "de", spy, WORD_ADDIN_ASK_TIMEOUT_MS);
    expect(seenUrl).toBe("/api/ask");
    const init = seenInit as unknown as AskFetchInit;
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    // WP-KLARA-ASK-FIX (bens Fix 1): das Add-in sendet IMMER den server-garantierten Modus.
    expect(JSON.parse(init.body)).toEqual({
      question: "Wie entlaste ich das Ventil?",
      locale: "de",
      mode: "retrieval-only",
    });
  });

  it("echte Antwort → kind answered mit Antwort, Quellen-Ids und Trust", async () => {
    const outcome = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, ANSWERED_BODY),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    // AUFTRAG-mega34 B: die serverseitige Einstufung reist jetzt mit. Dieser Fixture-Body traegt
    // KEIN `evidence` — der Grad ist deshalb fail-safe „unverified" (ein Server ohne Feld gilt
    // nicht als belegt). Genau diese Vorsicht pinnt tests/app/mega34-word-einstufung.test.ts.
    expect(outcome).toEqual({
      kind: "answered",
      answer: "Ventil vor der Wartung entlasten und den Druck pruefen.",
      sources: ["ko-1", "ko-2"],
      trust: 62,
      grade: "unverified",
      evidence: undefined,
      // AUFTRAG-mega81 BLOCK A: das serverseitige Kennzeichnungssignal reist ebenfalls mit. Dieser
      // Fixture-Body traegt KEIN `aiGenerated` — genau wie der echte retrieval-only-Weg, den dieses
      // Add-in geht. Folge: die KI-Erzeugungsbehauptung wird NICHT gezeigt (askAiNoticeVisible).
      aiGenerated: false,
    });
  });

  // WP-UX-WOW-1 U1 (Word): das Taskpane zeigt KLARTEXT — Markdown-Zeichen der Antwort werden mit
  // der Subset-Logik ENTFERNT (Ueberschriften-/Fett-/Kursiv-Marker raus, Listen als "- "-Zeilen).
  it("Markdown in der Antwort wird fuers Panel/Einfuegen gestrippt (Klartext, kein Rendern)", async () => {
    const body = {
      result: {
        answered: true,
        answer: "## Antwort\n**Ventil** vor der Wartung *entlasten*.\n\n### Fazit\n* Druck pruefen",
        sources: ["ko-1"],
        trust: 40,
      },
      gap: null,
    };
    const outcome = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, body),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(outcome.kind).toBe("answered");
    expect(outcome.answer).toBe(
      "Antwort\nVentil vor der Wartung entlasten.\n\nFazit\n- Druck pruefen",
    );
  });

  it("stripAskAnswerMarkdown: nummerierte Listen bleiben nummeriert, unpaarige Marker bleiben Text", () => {
    expect(stripAskAnswerMarkdown("1. Erst A\n2. Dann B")).toBe("1. Erst A\n2. Dann B");
    expect(stripAskAnswerMarkdown("**unpaarig bleibt stehen")).toBe("**unpaarig bleibt stehen");
    expect(stripAskAnswerMarkdown("Kein Markdown.")).toBe("Kein Markdown.");
  });

  it("Wissensluecke (answered=false) → kind gap — NIE eine erfundene Antwort", async () => {
    const outcome = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, GAP_BODY),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(outcome).toEqual({ kind: "gap" });
    // Auch ein answered=true mit LEERER Antwort ist keine belastbare Antwort → gap.
    const emptyAnswer = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, { result: { answered: true, answer: "   ", sources: [] } }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(emptyAnswer).toEqual({ kind: "gap" });
    // WP-KLARA-ASK-FIX (bens Fix 2, Quellen-Pflicht): answered OHNE gueltige Source-Id → gap.
    const noSources = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, { result: { answered: true, answer: "Text", sources: [] } }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(noSources).toEqual({ kind: "gap" });
    const blankSources = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(200, { result: { answered: true, answer: "Text", sources: ["  "] } }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(blankSources).toEqual({ kind: "gap" });
  });

  // ============================================================================================
  // AUFTRAG-JOB507-D4 — DER 403-VERTRAG, WIE ER WIRKLICH GILT.
  // ============================================================================================
  //
  // Bis hierher warf `performAsk` 401 und 403 in EINEN Topf („auth") und das Panel sagte in beiden
  // Faellen „Nicht angemeldet — bitte zuerst bei KLARWERK anmelden." Das ist bei 403 falsch, und
  // zwar irrefuehrend falsch: 403 bedeutet, die Sitzung IST da, aber dem Konto fehlt die
  // Berechtigung `ko.read` (services/app/src/routes/ask-routes.ts, guards.requirePermission).
  // Wer daraufhin ein zweites Mal anmeldet, aendert nichts und erfaehrt den Grund nie.
  //
  // Der Vertrag ist damit derselbe, den der Wissensluecken-Weg im Panel SCHON hatte
  // (sendOpenQuestion: 401 → askAuth, 403 → askForbidden) — er gilt jetzt an beiden Stellen gleich.
  it("401 → kind auth; 403 → kind forbidden (fehlendes Recht ist keine fehlende Anmeldung)", async () => {
    const unauth = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(401, { error: "UNAUTHORIZED" }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(unauth).toEqual({ kind: "auth" });
    const forbidden = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(403, { error: "FORBIDDEN" }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(forbidden).toEqual({ kind: "forbidden" });
  });

  // ============================================================================================
  // AUFTRAG-JOB507-D4 — RETRY-AFTER: SECHS KLASSEN, EINE REIHENFOLGE, EINE OBERGRENZE.
  // ============================================================================================
  //
  // Der Server sendet bei einer Sperre 429 mit `Retry-After` (services/auth/src/routes.ts:194 —
  // ganze Sekunden aus rate-limit.ts; RFC 9110 erlaubt zusaetzlich ein HTTP-Datum). Das Panel kannte
  // den Fall gar nicht: 429 fiel in den generischen `!res.ok`-Zweig und wurde als „Fragen
  // fehlgeschlagen (HTTP 429)" gezeigt — technisch wahr, praktisch nutzlos.
  //
  // Die Reihenfolge ist BEWUSST fest und wird hier ausgefuehrt, nicht behauptet:
  //   1. fehlend (null/undefined)      → null  „wir wissen es nicht"
  //   2. leer/nur Leerraum             → null
  //   3. ganze Sekunden (delta-seconds) → Wert, gedeckelt
  //   4. negative Sekunden             → 0     (vergangen: sofort wieder erlaubt)
  //   5. HTTP-Datum                    → Zukunft: aufgerundete Differenz, gedeckelt; Vergangenheit: 0
  //   6. alles andere                  → null  (ungueltig — NIE eine geratene Zahl)
  // `null` und `0` sind AUSDRUECKLICH verschieden: 0 heisst „jetzt", null heisst „unbekannt".
  it("parseRetryAfterSeconds: sechs Klassen deterministisch, null ist nicht 0", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    // 1. fehlend
    expect(parseRetryAfterSeconds(null, now)).toBeNull();
    expect(parseRetryAfterSeconds(undefined, now)).toBeNull();
    // 2. leer
    expect(parseRetryAfterSeconds("", now)).toBeNull();
    expect(parseRetryAfterSeconds("   ", now)).toBeNull();
    // 3. positive Sekunden (mit Leerraum-Toleranz, wie sie ein Header-Wert mitbringt)
    expect(parseRetryAfterSeconds("120", now)).toBe(120);
    expect(parseRetryAfterSeconds("  7  ", now)).toBe(7);
    expect(parseRetryAfterSeconds("0", now)).toBe(0);
    // 4. vergangene/negative Sekunden → sofort
    expect(parseRetryAfterSeconds("-5", now)).toBe(0);
    // 5. HTTP-Datum
    expect(parseRetryAfterSeconds("Mon, 10 Aug 2026 12:02:30 GMT", now)).toBe(150);
    expect(parseRetryAfterSeconds("Mon, 10 Aug 2026 11:59:00 GMT", now)).toBe(0);
    // 6. ungueltig — inklusive der Faelle, die `Date.parse` allein NACHSICHTIG durchgewunken haette
    // (im Red-first-Lauf belegt: "12.5" wurde als Datum gelesen und kam als 0 heraus). Ein
    // ISO-Zeitstempel gilt hier bewusst ebenfalls als unbekannt: er ist an dieser Kopfzeile nicht
    // vertragsgemaess, und „unbekannt" ist ehrlicher als eine Zahl aus einer geratenen Form.
    expect(parseRetryAfterSeconds("bald", now)).toBeNull();
    expect(parseRetryAfterSeconds("12.5", now)).toBeNull();
    expect(parseRetryAfterSeconds("NaN", now)).toBeNull();
    expect(parseRetryAfterSeconds("2026-08-10T12:02:30.000Z", now)).toBeNull();
    expect(parseRetryAfterSeconds("Mon, 10 Aug 2026 12:02:30", now)).toBeNull();
  });

  it("parseRetryAfterSeconds: harte Obergrenze — weder Sekunden noch Datum kommen darueber", () => {
    const now = Date.parse("2026-08-10T12:00:00.000Z");
    expect(WORD_ADDIN_RETRY_AFTER_MAX_SECONDS).toBe(3600);
    expect(parseRetryAfterSeconds(String(WORD_ADDIN_RETRY_AFTER_MAX_SECONDS), now)).toBe(
      WORD_ADDIN_RETRY_AFTER_MAX_SECONDS,
    );
    expect(parseRetryAfterSeconds("999999999", now)).toBe(WORD_ADDIN_RETRY_AFTER_MAX_SECONDS);
    // Ein Datum weit in der Zukunft wird auf dieselbe Grenze gedeckelt — eine Zahl, eine Grenze.
    expect(parseRetryAfterSeconds("Tue, 11 Aug 2026 12:00:00 GMT", now)).toBe(
      WORD_ADDIN_RETRY_AFTER_MAX_SECONDS,
    );
    // Aufrundung: 500 ms Rest sind eine angefangene Sekunde, keine halbe.
    expect(parseRetryAfterSeconds("Mon, 10 Aug 2026 12:00:01 GMT", now + 500)).toBe(1);
  });

  it("429 → kind rate-limited mit gelesener Wartezeit; ohne/ungueltigem Header ehrlich null", async () => {
    const withHeader = await performAsk(
      "Frage",
      "de",
      async () => fakeResWithHeaders(429, { error: "RATE_LIMITED" }, { "retry-after": "90" }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(withHeader).toEqual({ kind: "rate-limited", retryAfterSeconds: 90 });
    const withoutHeader = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(429, { error: "RATE_LIMITED" }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(withoutHeader).toEqual({ kind: "rate-limited", retryAfterSeconds: null });
    const invalid = await performAsk(
      "Frage",
      "de",
      async () => fakeResWithHeaders(429, {}, { "Retry-After": "bald" }),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(invalid).toEqual({ kind: "rate-limited", retryAfterSeconds: null });
  });

  it("haengender Server → kind timeout (eigene Frist je Request); 5xx/offline → kind error", async () => {
    const hanging: AskFetchFn = (_url, init) =>
      new Promise((_resolveRes, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    expect(await performAsk("Frage", "de", hanging, 20)).toEqual({ kind: "timeout" });
    const serverError = await performAsk(
      "Frage",
      "de",
      async () => fakeRes(500, {}),
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(serverError).toEqual({ kind: "error", detail: "HTTP 500" });
    const offline = await performAsk(
      "Frage",
      "de",
      async () => {
        throw new Error("Netz weg");
      },
      WORD_ADDIN_ASK_TIMEOUT_MS,
    );
    expect(offline).toEqual({ kind: "error", detail: "Netz weg" });
  });
});

describe("WP-KLARA-ASK Teil 2: Einfuege-Gating + Quellen-Zeile + Offene-Frage-Weg", () => {
  it("canInsertAnswer: NUR eine echte quellengebundene Antwort — nie Luecke/Fehler/leer/quellenlos", () => {
    expect(canInsertAnswer({ kind: "answered", answer: "Text", sources: ["ko-1"] })).toBe(true);
    // WP-KLARA-ASK-FIX (bens Fix 2): ohne mindestens EINE gueltige Source-Id KEIN Einfuegen.
    expect(canInsertAnswer({ kind: "answered", answer: "Text", sources: [] })).toBe(false);
    expect(canInsertAnswer({ kind: "answered", answer: "Text", sources: ["  "] })).toBe(false);
    expect(canInsertAnswer({ kind: "answered", answer: "Text" })).toBe(false);
    expect(canInsertAnswer({ kind: "answered", answer: "   " })).toBe(false);
    expect(canInsertAnswer({ kind: "gap" })).toBe(false);
    expect(canInsertAnswer({ kind: "auth" })).toBe(false);
    expect(canInsertAnswer({ kind: "timeout" })).toBe(false);
    expect(canInsertAnswer({ kind: "error", detail: "x" })).toBe(false);
    expect(canInsertAnswer(null)).toBe(false);
  });

  it("Quellen-Zeile: Titel + KLARWERK + Stand-Datum; ohne Titel ehrlich der Systemname", () => {
    const template = "Quelle: {titles} (KLARWERK, geprueftes Wissen, Stand {date})";
    expect(buildAskSourceLine(["Ventil-Wartung", "Pumpen-Handbuch"], "22.07.2026", template)).toBe(
      "Quelle: Ventil-Wartung, Pumpen-Handbuch (KLARWERK, geprueftes Wissen, Stand 22.07.2026)",
    );
    expect(buildAskSourceLine([], "22.07.2026", template)).toBe(
      "Quelle: KLARWERK (KLARWERK, geprueftes Wissen, Stand 22.07.2026)",
    );
    expect(buildAskSourceLine(["  ", "Nur Einer"], "22.07.2026", template)).toContain("Nur Einer");
  });

  it("eingefuegter Text = Antwort + Quellen-Zeile — beginnt mit dem WISSEN, nicht mit einem KI-Etikett", () => {
    const text = buildAnswerInsertText(
      "Ventil entlasten.\n",
      "Quelle: X (KLARWERK, Stand 22.07.2026)",
    );
    expect(text).toBe("Ventil entlasten.\n\nQuelle: X (KLARWERK, Stand 22.07.2026)");
    expect(text.startsWith("Ventil entlasten.")).toBe(true);
    expect(formatAskDateLabel(new Date(2026, 6, 22))).toBe("22.07.2026");
    expect(formatAskDateLabel(new Date(2026, 0, 3))).toBe("03.01.2026");
    // WP-KLARA-ASK-FIX (bens Fix 3): gekappte Frage → der eingefuegte Text traegt den Hinweis mit.
    const truncated = buildAnswerInsertText("Antwort", "Quelle: X", "Hinweis: gekappt auf 2000.");
    expect(truncated).toBe("Antwort\n\nQuelle: X\nHinweis: gekappt auf 2000.");
    expect(buildAnswerInsertText("Antwort", "Quelle: X", "")).toBe("Antwort\n\nQuelle: X");
  });

  it("WP-KLARA-ASK-FIX (bens Fix 3): Stand-Datum NUR belegt — sonst null (Aufrufer schreibt abgerufen am)", () => {
    expect(
      newestSourceDateLabel(["2026-07-01T00:00:00.000Z", "2026-07-20T10:00:00.000Z", undefined]),
    ).toBe("20.07.2026");
    expect(newestSourceDateLabel([undefined, "kaputt"])).toBeNull();
    expect(newestSourceDateLabel([])).toBeNull();
  });

  it("Offene-Frage-Titel: LOKALISIERTES Praefix + 60-Zeichen-Deckel des Draft-Senders; nie leer", () => {
    expect(
      openQuestionDraftTitle("Wie entlaste ich das Ventil?", "Offene Frage: ", "Fallback"),
    ).toBe("Offene Frage: Wie entlaste ich das Ventil?");
    expect(openQuestionDraftTitle("How?", "Open question: ", "Fallback")).toBe(
      "Open question: How?",
    );
    expect(openQuestionDraftTitle("x".repeat(200), "Offene Frage: ", "F").length).toBe(
      WORD_ADDIN_TITLE_MAX,
    );
    expect(openQuestionDraftTitle("   ", "Offene Frage: ", "Offene Frage aus Word")).toBe(
      "Offene Frage aus Word",
    );
  });
});

describe("WP-KLARA-ASK Teil 3: Inline-Spiegel im buildlosen Taskpane ist VERHALTENSGLEICH", () => {
  it("Marker-Block extrahieren, ausfuehren, auf Fixtures (inkl. Fake-fetch-Flows) vergleichen", async () => {
    const html = read(TASKPANE);
    const start = html.indexOf("// KW-WORDADDIN-HELPERS-START");
    const end = html.indexOf("// KW-WORDADDIN-HELPERS-END");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = html.slice(start, end);
    const factory = new Function(
      `${block}; return { prepareAskQuestion: prepareAskQuestion, askLocale: askLocale, performAsk: performAsk, canInsertAnswer: canInsertAnswer, buildAskSourceLine: buildAskSourceLine, buildAnswerInsertText: buildAnswerInsertText, askGradeOf: askGradeOf, answerInsertEvidenceNote: answerInsertEvidenceNote, composeAnswerOutput: composeAnswerOutput, stripComposedMetaLines: stripComposedMetaLines, answerSelectionIsWhole: answerSelectionIsWhole, formatAskDateLabel: formatAskDateLabel, newestSourceDateLabel: newestSourceDateLabel, openQuestionDraftTitle: openQuestionDraftTitle, stripAskAnswerMarkdown: stripAskAnswerMarkdown, parseRetryAfterSeconds: parseRetryAfterSeconds, WORD_ADDIN_ASK_MAX_CHARS: WORD_ADDIN_ASK_MAX_CHARS, WORD_ADDIN_ASK_TIMEOUT_MS: WORD_ADDIN_ASK_TIMEOUT_MS, WORD_ADDIN_RETRY_AFTER_MAX_SECONDS: WORD_ADDIN_RETRY_AFTER_MAX_SECONDS };`,
    );
    const inline = factory() as {
      // JOB 3019 (KA5): die AUSGELIEFERTE Fassung traegt zwei Felder mehr als der Zwilling —
      // `selection` (die Markierung als eigenes Suchfeld) und `selectionTruncated` (ihr eigener
      // Deckel-Merker). Der Typ sagt das hier ausdruecklich, statt sie ueber `unknown` zu greifen.
      prepareAskQuestion: (
        selectionText: string,
        manualText: string,
      ) => PreparedAskQuestion & { selection: string; selectionTruncated: boolean };
      askLocale: typeof askLocale;
      performAsk: typeof performAsk;
      canInsertAnswer: typeof canInsertAnswer;
      buildAskSourceLine: typeof buildAskSourceLine;
      buildAnswerInsertText: typeof buildAnswerInsertText;
      askGradeOf: typeof askGradeOf;
      answerInsertEvidenceNote: typeof answerInsertEvidenceNote;
      composeAnswerOutput: typeof composeAnswerOutput;
      stripComposedMetaLines: typeof stripComposedMetaLines;
      answerSelectionIsWhole: typeof answerSelectionIsWhole;
      formatAskDateLabel: typeof formatAskDateLabel;
      newestSourceDateLabel: typeof newestSourceDateLabel;
      openQuestionDraftTitle: typeof openQuestionDraftTitle;
      stripAskAnswerMarkdown: typeof stripAskAnswerMarkdown;
      parseRetryAfterSeconds: typeof parseRetryAfterSeconds;
      WORD_ADDIN_ASK_MAX_CHARS: number;
      WORD_ADDIN_ASK_TIMEOUT_MS: number;
      WORD_ADDIN_RETRY_AFTER_MAX_SECONDS: number;
    };
    expect(inline.WORD_ADDIN_ASK_MAX_CHARS).toBe(WORD_ADDIN_ASK_MAX_CHARS);
    expect(inline.WORD_ADDIN_ASK_TIMEOUT_MS).toBe(WORD_ADDIN_ASK_TIMEOUT_MS);
    expect(inline.WORD_ADDIN_RETRY_AFTER_MAX_SECONDS).toBe(WORD_ADDIN_RETRY_AFTER_MAX_SECONDS);
    // AUFTRAG-JOB507-D4: der Retry-After-Vertrag ist in BEIDEN Fassungen derselbe — ueber alle sechs
    // Klassen und die Obergrenze, mit hereingereichtem „jetzt" (keine Uhrzeit-Wackelei im Vergleich).
    const retryNow = Date.parse("2026-08-10T12:00:00.000Z");
    const retryFixtures: (string | null | undefined)[] = [
      null,
      undefined,
      "",
      "   ",
      "0",
      "120",
      "  7  ",
      "-5",
      "999999999",
      String(WORD_ADDIN_RETRY_AFTER_MAX_SECONDS),
      "Mon, 10 Aug 2026 12:02:30 GMT",
      "Mon, 10 Aug 2026 11:59:00 GMT",
      "Tue, 11 Aug 2026 12:00:00 GMT",
      "bald",
      "12.5",
      "NaN",
      "2026-08-10T12:02:30.000Z",
      "Mon, 10 Aug 2026 12:02:30",
    ];
    for (const value of retryFixtures) {
      expect(inline.parseRetryAfterSeconds(value, retryNow), `retry:${String(value)}`).toBe(
        parseRetryAfterSeconds(value, retryNow),
      );
    }
    // Kalibrierung: der Vergleich ist nicht vakuoes — die Klassen unterscheiden sich wirklich.
    expect(inline.parseRetryAfterSeconds("120", retryNow)).toBe(120);
    expect(inline.parseRetryAfterSeconds("bald", retryNow)).toBeNull();
    // ------------------------------------------------------------------------------------------
    // JOB 3019 (KA5) — HIER LAUFEN DIE BEIDEN FASSUNGEN AUSEINANDER, UND ZWAR BENANNT.
    //
    // Das ausgelieferte Fenster stellt seit KA5 die GETIPPTE Frage und schickt die Markierung als
    // eigenes Feld `selection` mit (`taskpane.html#prepareAskQuestion`). Der TypeScript-Zwilling
    // `apps/web/src/lib/wordAddin.ts` traegt weiterhin die alte Regel „Markierung schlaegt
    // Eingabefeld". Er liegt AUSSERHALB der Zielpfade von JOB 3019: Runde 2 hat ihn nachgezogen,
    // und die Vorpruefung des Tors hat genau das als Zielpfad-Verstoss zurueckgewiesen (ein Diff
    // ausserhalb der Zielpfade ist ungeprueft). Er hat KEINEN Aufrufer in der Anwendung — nur
    // Tests importieren ihn. Ein blindes `toEqual` liesse hier zwei Moeglichkeiten, und beide
    // waeren falsch: die Zusicherung streichen (dann schwiege der Spiegel ueber alles) oder den
    // Zwilling mitaendern (Zielpfad-Verstoss). Stattdessen steht die Grenze NAMENTLICH:
    //
    //   · In den Lagen, in denen NICHT gleichzeitig markiert und getippt wird, muss der Spiegel
    //     weiter Zeichen fuer Zeichen dasselbe liefern wie der Zwilling — verglichen wird dessen
    //     vollstaendige Rueckgabe gegen die gleichnamigen Felder des Spiegels, und der Spiegel
    //     schickt dort nichts mit, was der Zwilling nicht kennt.
    //   · Die Lage „beides" ist die Aenderung selbst. Sie wird auf BEIDEN Seiten woertlich
    //     gepinnt: dreht der Spiegel zurueck oder zieht der Zwilling nach, wird dieser Fall rot —
    //     und wer den Zwilling nachzieht (eigener Auftrag mit freigegebenem Zielpfad), ersetzt
    //     diesen Block wieder durch ein volles `toEqual`.
    //   · Die zwei Deckel des Spiegels (`truncated` × `selectionTruncated`) haben im Zwilling
    //     kein Gegenstueck; ihr Kreuzprodukt ist deshalb hier am SPIEGEL gepinnt.
    // ------------------------------------------------------------------------------------------
    const lang = "x".repeat(WORD_ADDIN_ASK_MAX_CHARS + 99);
    const gleichLaufend: [string, string][] = [
      ["   ", "Freie Frage?"],
      ["", ""],
      [lang, ""], // nur Markierung, ueber dem Deckel → `truncated` in BEIDEN
      ["\n  Mehrzeilige\nAuswahl  ", ""],
      ["  ", lang], // nur die Frage, ueber dem Deckel → `truncated` in BEIDEN
    ];
    for (const [sel, manual] of gleichLaufend) {
      const ausSpiegel = inline.prepareAskQuestion(sel, manual);
      const ausModul = prepareAskQuestion(sel, manual);
      const kennung = `prep:${sel.slice(0, 12)}|${manual.slice(0, 12)}`;
      expect(ausSpiegel, kennung).toMatchObject(ausModul);
      // Und der Spiegel schickt in diesen Lagen nichts mit, was der Zwilling nicht kennt.
      expect(ausSpiegel.selection, `${kennung}/selection`).toBe("");
      expect(ausSpiegel.selectionTruncated, `${kennung}/selectionTruncated`).toBe(false);
    }
    // Die eine Lage, in der sie sich unterscheiden — beide Seiten woertlich.
    expect(inline.prepareAskQuestion("Auswahl", "Manuell")).toEqual({
      question: "Manuell",
      from: "manual",
      selection: "Auswahl",
      truncated: false,
      selectionTruncated: false,
    });
    expect(prepareAskQuestion("Auswahl", "Manuell")).toEqual({
      question: "Auswahl",
      from: "selection",
      truncated: false,
    });
    // Die vier Kombinationen der zwei Deckel — BENs Befund aus Runde 1, am Spiegel als Vertrag.
    expect(inline.prepareAskQuestion("kurz", "kurz")).toMatchObject({
      truncated: false,
      selectionTruncated: false,
    });
    expect(inline.prepareAskQuestion("kurz", lang)).toMatchObject({
      truncated: true,
      selectionTruncated: false,
    });
    expect(inline.prepareAskQuestion(lang, "kurz")).toMatchObject({
      truncated: false,
      selectionTruncated: true,
    });
    expect(inline.prepareAskQuestion(lang, lang)).toMatchObject({
      truncated: true,
      selectionTruncated: true,
    });
    // Und die gekappte Markierung ist wirklich gekappt, nicht nur gemeldet.
    expect(inline.prepareAskQuestion(lang, "kurz").selection.length).toBe(WORD_ADDIN_ASK_MAX_CHARS);
    for (const lng of ["de", "en", "nl", "fr"]) {
      expect(inline.askLocale(lng)).toBe(askLocale(lng));
    }
    // WP-UX-WOW-1 U1: der Markdown-Strip ist in beiden Fassungen verhaltensgleich.
    const stripFixtures = [
      "## Antwort\n**Ventil** vor der Wartung *entlasten*.\n\n### Fazit\n- Druck pruefen\n- Ventil schliessen",
      "1. Erst A\n2. Dann B",
      "Kein Markdown, nur Text.",
      "**unpaarig bleibt stehen",
    ];
    for (const fixture of stripFixtures) {
      expect(inline.stripAskAnswerMarkdown(fixture)).toBe(stripAskAnswerMarkdown(fixture));
    }
    // Ask-Fluss: beide Fassungen liefern auf denselben Fake-fetch-Faellen dasselbe Ergebnis.
    const flows: [string, AskFetchFn][] = [
      ["answered", async () => fakeRes(200, ANSWERED_BODY)],
      ["gap", async () => fakeRes(200, GAP_BODY)],
      ["auth", async () => fakeRes(401, {})],
      // AUFTRAG-JOB507-D4: der neue 403- und der neue 429-Ausgang laufen durch DENSELBEN Vergleich.
      ["forbidden", async () => fakeRes(403, {})],
      ["rate-limited", async () => fakeResWithHeaders(429, {}, { "retry-after": "45" })],
      ["rate-limited-blank", async () => fakeRes(429, {})],
      ["error", async () => fakeRes(500, {})],
      [
        "offline",
        async () => {
          throw new Error("offline");
        },
      ],
      [
        "timeout",
        (_url, init) =>
          new Promise((_resolveRes, reject) => {
            init.signal.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ],
    ];
    for (const [label, fetchFn] of flows) {
      const timeout = label === "timeout" ? 20 : WORD_ADDIN_ASK_TIMEOUT_MS;
      const fromInline = await inline.performAsk("Frage", "de", fetchFn, timeout);
      const fromModule = await performAsk("Frage", "de", fetchFn, timeout);
      expect(fromInline, `flow:${label}`).toEqual(fromModule);
    }
    // Gating + Zeilenbau + Titel-Konvention verhaltensgleich.
    const outcomes: (AskOutcome | null)[] = [
      { kind: "answered", answer: "A", sources: ["ko-1"] },
      { kind: "answered", answer: "A", sources: [] },
      { kind: "answered", answer: "A", sources: ["  "] },
      { kind: "answered", answer: " " },
      { kind: "gap" },
      null,
    ];
    for (const outcome of outcomes) {
      expect(inline.canInsertAnswer(outcome)).toBe(canInsertAnswer(outcome));
    }
    const template = "Quelle: {titles} (KLARWERK, geprueftes Wissen, Stand {date})";
    for (const titles of [["A", "B"], [], ["  ", "C"]]) {
      expect(inline.buildAskSourceLine(titles, "22.07.2026", template)).toBe(
        buildAskSourceLine(titles, "22.07.2026", template),
      );
    }
    expect(inline.buildAnswerInsertText("Antwort \n", "Zeile")).toBe(
      buildAnswerInsertText("Antwort \n", "Zeile"),
    );
    expect(inline.buildAnswerInsertText("Antwort", "Zeile", "Hinweis")).toBe(
      buildAnswerInsertText("Antwort", "Zeile", "Hinweis"),
    );

    // ------------------------------------------------------------------------------------------
    // AUFTRAG-mega35 BLOCK C — DER WAECHTER RUFT AUF, WAS ER BEWACHT.
    //
    // Bis hierher standen die Einstufungshelfer und der vierte Builder-Parameter NEBEN diesem
    // Vergleich, statt in ihm: `askGradeOf` und `answerInsertEvidenceNote` waren gar nicht aus dem
    // Inline-Block exportiert, `buildAnswerInsertText` wurde nur mit zwei und drei Argumenten
    // verglichen. Die Behauptung, der Aequivalenzwaechter pruefe die Einstufungsauswahl, war damit
    // unbelegt (bens GELB-Befund 3). Ab hier wird sie ausgefuehrt.
    // ------------------------------------------------------------------------------------------

    // askGradeOf — fail-safe Ausgang inklusive: fehlendes Feld, falscher Typ, null, Grossschreibung.
    const evidenceFixtures: unknown[] = [
      { grade: "verified" },
      { grade: "unverified" },
      { grade: "Verified" },
      { grade: true },
      { grade: null },
      {},
      null,
      undefined,
      "verified",
      42,
    ];
    for (const evidence of evidenceFixtures) {
      expect(inline.askGradeOf(evidence), `askGradeOf:${JSON.stringify(evidence)}`).toBe(
        askGradeOf(evidence),
      );
    }

    // answerInsertEvidenceNote — beide Grade, inkl. leerer Texte.
    const noteTexts = { verified: "Einstufung: gesichert.", unverified: "Einstufung: ungeprüft." };
    for (const grade of ["verified", "unverified"] as const) {
      expect(inline.answerInsertEvidenceNote(grade, noteTexts)).toBe(
        answerInsertEvidenceNote(grade, noteTexts),
      );
      expect(inline.answerInsertEvidenceNote(grade, { verified: "", unverified: "" })).toBe(
        answerInsertEvidenceNote(grade, { verified: "", unverified: "" }),
      );
    }

    // buildAnswerInsertText MIT dem vierten (Einstufungs-)Parameter — alle vier Kombinationen aus
    // Kappungs-Hinweis vorhanden/leer und Einstufung vorhanden/leer.
    for (const truncatedNote of ["Hinweis: gekappt auf 2000.", "", "   "]) {
      for (const evidenceNote of ["Einstufung: ungeprüft — vor Verwendung prüfen.", "", "  "]) {
        expect(
          inline.buildAnswerInsertText("Antwort \n", "Quelle: X", truncatedNote, evidenceNote),
          `builder4:${JSON.stringify([truncatedNote, evidenceNote])}`,
        ).toBe(buildAnswerInsertText("Antwort \n", "Quelle: X", truncatedNote, evidenceNote));
      }
    }

    // composeAnswerOutput — der Bauer, den Kopieren UND Einfuegen benutzen (AUFTRAG-mega35 A1).
    // Belegtes Quell-Datum vs. „abgerufen am", beide Grade, gekappt/ungekappt, Titel leer/gesetzt.
    const outputTexts = {
      verified: "Einstufung: gesichert — Quellen belegt.",
      unverified: "Einstufung: ungeprüft — nicht als konfliktfrei belegt.",
      sourceLine: "Quelle: {titles} (KLARWERK-Wissen, Stand {date})",
      sourceLineRetrieved: "Quelle: {titles} (KLARWERK-Wissen, abgerufen am {date})",
      truncatedNote: "Hinweis: Die zugrunde liegende Frage wurde auf 2000 Zeichen gekappt.",
    };
    const NOW = new Date(2026, 6, 27);
    for (const grade of ["verified", "unverified"] as const) {
      for (const truncated of [true, false]) {
        for (const dates of [
          ["2026-07-01T00:00:00.000Z", "2026-07-20T10:00:00.000Z"],
          ["kaputt", undefined],
          [],
        ] as (string | undefined)[][]) {
          for (const sourceTitles of [["Wartungsplan V4"], [], ["  ", "Regel 7"]]) {
            const input = {
              body: "Ventil V4 wird jährlich geprüft. \n",
              sourceTitles,
              sourceDates: dates,
              truncated,
              grade,
              now: NOW,
              texts: outputTexts,
            };
            expect(
              inline.composeAnswerOutput(input),
              `compose:${grade}/${truncated}/${dates.length}/${sourceTitles.length}`,
            ).toBe(composeAnswerOutput(input));
          }
        }
      }
    }

    // Kalibrierung: ohne den vierten Parameter waere der obige Builder-Vergleich blind. Der
    // Einstufungstext MUSS im Ergebnis stehen — sonst prueft die Schleife nur Gleichheit von zwei
    // gleich kaputten Fassungen.
    expect(
      inline.buildAnswerInsertText("A", "Q", "", "Einstufung: ungeprüft — vor Verwendung prüfen."),
    ).toContain("Einstufung: ungeprüft");
    expect(
      inline.composeAnswerOutput({
        body: "A",
        sourceTitles: ["T"],
        sourceDates: [],
        truncated: false,
        grade: "unverified",
        now: NOW,
        texts: outputTexts,
      }),
    ).toContain("Einstufung: ungeprüft");
    // AUFTRAG-mega36 D: stripComposedMetaLines — beide Quellen-Vorlagen, beide Einstufungen, der
    // Kappungshinweis, der bloss ERWAEHNENDE Koerper (darf nicht beschnitten werden), Metazeilen
    // MITTEN im Text (bleiben stehen), CRLF und der Nur-Metablock-Fall.
    for (const body of [
      "Ventil V4 wird jährlich geprüft.",
      "Ventil V4.\n\nQuelle: Wartungsplan V4 (KLARWERK-Wissen, Stand 20.07.2026)",
      "Ventil V4.\n\nQuelle: Wartungsplan V4 (KLARWERK-Wissen, abgerufen am 27.07.2026)\nEinstufung: ungeprüft — nicht als konfliktfrei belegt.",
      "Ventil V4.\r\n\r\nQuelle: X (KLARWERK-Wissen, Stand 01.01.2026)\r\nEinstufung: gesichert — Quellen belegt.\r\nHinweis: Die zugrunde liegende Frage wurde auf 2000 Zeichen gekappt.",
      "Die Quelle des Drucks ist V4.\nQuelle: unbekannte Anlage",
      "Quelle: X (KLARWERK-Wissen, Stand 01.01.2026)\nnoch Text danach",
      "Quelle: X (KLARWERK-Wissen, Stand 01.01.2026)",
      "   \n  \n",
      "",
    ]) {
      expect(inline.stripComposedMetaLines(body, outputTexts), `strip:${body.slice(0, 24)}`).toBe(
        stripComposedMetaLines(body, outputTexts),
      );
    }
    // Kalibrierung: der Abzug GREIFT (sonst verglichen beide Seiten nur die Identitaet) — und er
    // beschneidet NICHT, was bloss aehnlich aussieht.
    expect(
      inline.stripComposedMetaLines(
        "A\n\nQuelle: T (KLARWERK-Wissen, Stand 01.01.2026)\nEinstufung: gesichert — Quellen belegt.",
        outputTexts,
      ),
    ).toBe("A");
    expect(inline.stripComposedMetaLines("Die Quelle: unklar", outputTexts)).toBe(
      "Die Quelle: unklar",
    );

    // AUFTRAG-mega36 B2: answerSelectionIsWhole — ganz, Teilauswahl, Leerraum-Rand, umgedreht,
    // leer, ausserhalb der Grenzen.
    for (const [value, start, end] of [
      ["Antwort", 0, 7],
      ["Antwort", 0, 3],
      ["\n Antwort \n\n", 2, 9],
      ["\n Antwort \n\n", 0, 12],
      ["Antwort", 7, 0],
      ["Antwort", 3, 3],
      ["   ", 0, 3],
      ["", 0, 0],
      ["Antwort", -5, 99],
    ] as [string, number, number][]) {
      expect(
        inline.answerSelectionIsWhole(value, start, end),
        `sel:${JSON.stringify([value, start, end])}`,
      ).toBe(answerSelectionIsWhole(value, start, end));
    }
    // Kalibrierung: die Unterscheidung ist echt, nicht konstant.
    expect(inline.answerSelectionIsWhole("Antwort", 0, 7)).toBe(true);
    expect(inline.answerSelectionIsWhole("Antwort", 0, 3)).toBe(false);

    expect(inline.formatAskDateLabel(new Date(2026, 6, 22))).toBe(
      formatAskDateLabel(new Date(2026, 6, 22)),
    );
    for (const dates of [
      ["2026-07-01T00:00:00.000Z", "2026-07-20T10:00:00.000Z"],
      ["kaputt", undefined],
      [],
    ] as (string | undefined)[][]) {
      expect(inline.newestSourceDateLabel(dates)).toBe(newestSourceDateLabel(dates));
    }
    for (const q of ["Frage?", "x".repeat(200), "  "]) {
      expect(inline.openQuestionDraftTitle(q, "Offene Frage: ", "Fallback")).toBe(
        openQuestionDraftTitle(q, "Offene Frage: ", "Fallback"),
      );
    }
  });
});

describe("WP-KLARA-ASK: Taskpane-Verdrahtung (Quelltext-Pins) + i18n x3", () => {
  const html = read(TASKPANE);

  it("Teil 1: Ask-Bereich nutzt den BESTEHENDEN Vertrag — /api/ask via performAsk, EINE Markierungslesung, Eingabefeld-Fallback", () => {
    // Der Fetch laeuft ausschliesslich durch performAsk (Spiegel-Helfer) — Same-Origin-Session.
    expect(html).toContain("performAsk(");
    expect(html).toContain('"/api/ask"');
    // Die Markierung (nur Text) wird GENAU EINMAL gelesen; ohne Office ehrlich leer → freies Fragen.
    expect(html).toContain("readAskSelection(function (selectionText)");
    expect(html).toContain(
      'prepareAskQuestion(selectionText, document.getElementById("ask-input").value)',
    );
    // JOB 3019 (KA5): in `askKlara` wird die Markierung GENAU EINMAL gelesen, und dieselbe
    // Vorbereitung liefert Frage UND Markierung. Ein zweiter Lesevorgang waere ein zweiter
    // Zustand — die Zeile ueber dem Feld koennte dann eine andere Markierung meinen als die,
    // die wirklich abgeht. (Die anderen beiden Vorkommen im Fenster gehoeren `updateAskSourceNote`
    // und dem KA6-Zuruf; jedes von ihnen liest fuer sich selbst genau einmal.)
    const askKlaraRumpf = html.slice(
      html.indexOf("function askKlara()"),
      html.indexOf("function composeOutputText"),
    );
    expect(askKlaraRumpf.length).toBeGreaterThan(200);
    expect(askKlaraRumpf.split("readAskSelection(").length - 1).toBe(1);
    expect(askKlaraRumpf).toContain("prep.selection");
    // Und der Ask-Block selbst normalisiert die Markierung, statt sie irgendwo zu holen.
    expect(html).toContain('var markierung = typeof selection === "string"');
    // Serverseitige Permission dokumentiert (ko.read — exakt die Fragen-Konsole).
    expect(html).toContain("ko.read");
    // Ehrliche Zustaende: leer / busy / auth / timeout / error.
    // JOB 3016 D3: „busy" ist kein Warnkasten mehr. JOB 3056 K1 (§9): der Wartezustand ist der
    // drehende Kreis im Sendeknopf, dessen zugaenglicher Name solange der Schluessel askBusy ist
    // (aria-label, kein Satz im Sichtfeld); ein- und ausgeblendet wird er an EINER Stelle
    // (askWartezustand). Die vier echten Warnungen bleiben in #ask-status.
    for (const marker of [
      't("askEmpty")',
      'askLaeuft ? t("askBusy") : t("askCta")',
      "askWartezustand(true)",
      "askWartezustand(false)",
      't("askAuth")',
      't("askTimeout")',
      't("askError"',
    ]) {
      expect(html).toContain(marker);
    }
    expect(html).not.toContain('showAskStatus("warn", t("askBusy"))');
    // Kappung: die Konstante steht im Spiegel und die Meldung nennt sie.
    expect(html).toContain("WORD_ADDIN_ASK_MAX_CHARS = 2000");
    expect(html).toContain('t("askTruncated", { max: String(WORD_ADDIN_ASK_MAX_CHARS) })');
    // Quellen mit Titel + Trust wie in der Konsole (GET /api/kos/:id, dieselbe Leseberechtigung).
    expect(html).toContain('fetch("/api/kos/" + encodeURIComponent(id)');
    expect(html).toContain('t("askTrust"');
  });

  it("Teil 2: Einfuegen NUR bei echter Antwort (Gating + Office), Quellen-Zeile, Luecken-Weg als Front-Door-Draft mit Deep-Link", () => {
    // klara1b Teil A: robustes Einfuegen ueber performInsert — MODERNER Word.run-Weg (getSelection().
    // insertText) zuerst, setSelectedDataAsync als Fallback; der BEARBEITETE Feldinhalt wird eingefuegt.
    expect(html).toContain("performInsert(text, buildInsertAttempts())");
    // AUFTRAG-mega35 A1: der Koerper kommt aus dem Feld, der AUSGEGEBENE Text entsteht erst hier.
    expect(html).toContain("var body = getEditedAnswerText();");
    expect(html).toContain("var text = composeOutputText(body);");
    // Word.run-Versuch vor dem setSelectedDataAsync-Fallback.
    const wordRun = html.indexOf("range.insertText(text, Word.InsertLocation.replace)");
    const write = html.indexOf("Office.context.document.setSelectedDataAsync(");
    expect(wordRun).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(wordRun);
    expect(html).toContain("coercionType: Office.CoercionType.Text");
    // Gating bleibt: der Einfuegen-Knopf ist nur bei belegter, aufgeloester Antwort UND bereitem
    // Office aktiv; insertAnswer greift ohne bereites Office nie in die Word-API (ehrlicher Hinweis).
    expect(html).toContain("insertBtn.disabled = !(insertable && officeUsable())");
    expect(html).toContain('if (!officeUsable()) {\n        showAskStatus("warn", t("noOffice"));');
    // Quellen-Zeile aus aufgeloesten Titeln + Stand-Datum.
    expect(html).toContain("buildAskSourceLine(");
    // AUFTRAG-mega34 B2 / mega35 A1: der ausgegebene Text traegt die Einstufung — und er entsteht
    // im Moment der Ausgabe aus dem BEARBEITETEN Koerper, nicht aus `currentAskOutcome.answer`.
    expect(html).toContain("return composeAnswerOutput({");
    expect(html).toContain("body: body,");
    expect(html).toContain("grade: askGradeOf(currentAskOutcome && currentAskOutcome.evidence),");
    expect(html).not.toContain("buildAnswerInsertText(currentAskOutcome.answer");
    // Wissensluecke: BESTEHENDER Draft-Weg (origin word_addin, K1.1/JOB 660) + lokalisierte Titel-Konvention +
    // Deep-Link. WP-KLARA-ASK-FIX (bens Fix 4): gap-only-Gate, Knopf-Sperre, 403 als fehlendes
    // Recht, voller Fragetext im Draft-Body (kein Verlust durch die 500-Zeichen-Statement-Kappung).
    const gapSend = html.indexOf("function sendOpenQuestion()");
    // JOB 3046 D2 (Runde 2): der Ausschnitt reicht bis zum Ende der Funktion — sie traegt jetzt
    // die Generation des Versands (Kommentar und zwei Zeilen), die den alten 2600er-Rahmen sprengte.
    const gapEnde = html.indexOf("// Teil 3: Segment-Umschaltung", gapSend);
    expect(gapEnde, "das Ende von sendOpenQuestion ist nicht auffindbar").toBeGreaterThan(gapSend);
    const gapBlock = html.slice(gapSend, gapEnde);
    expect(gapBlock).toContain('currentAskOutcome.kind !== "gap"');
    // JOB 3046 D2: der Weg ist ein Textlink (<a>, Zielbild KeinWissen Z.31) — ein <a> kennt kein
    // `disabled`, die Knopf-Sperre gegen den Doppel-POST traegt deshalb `aria-disabled`.
    expect(gapBlock).toContain('if (gapBtn.getAttribute("aria-disabled") === "true") { return; }');
    expect(gapBlock).toContain('gapBtn.setAttribute("aria-disabled", "true")');
    expect(gapBlock).not.toContain("gapBtn.disabled");
    expect(gapBlock).toContain('showAskStatus("warn", t("askForbidden"))');
    expect(gapBlock).toContain("bodyHtml: selectionToBodyHtml(currentAskQuestion)");
    expect(gapBlock).toContain('t("askOpenQuestionPrefix")');
    expect(gapBlock).toContain('origin: "word_addin"');
    expect(html).toContain('"/capture/frontdoor?draft=" + encodeURIComponent(draft.id)');
    // Fix 2: Einfuegen erst NACH abgeschlossener Quellenaufloesung; Fix 3: ehrliche Stand-Zeile.
    expect(html).toContain("currentAskSourcesResolved");
    expect(html).toContain('t("askSourceLineRetrieved")');
    expect(html).toContain(
      't("askInsertTruncatedNote", { max: String(WORD_ADDIN_ASK_MAX_CHARS) })',
    );
    // Fix 1: der Spiegel sendet IMMER den server-garantierten Modus.
    expect(html).toContain('mode: "retrieval-only"');
  });

  it("Teil 3: zwei Bereiche (Fragen | Wissen erfassen) als einfache Tabs — buildlos, kein Framework", () => {
    expect(html).toContain('id="tab-ask"');
    expect(html).toContain('id="tab-capture"');
    expect(html).toContain('id="section-ask"');
    expect(html).toContain('id="section-capture"');
    expect(html).toContain("function setTab(name)");
    // Kein Framework: weiterhin reines Inline-Skript (der Kopf-Kommentar pinnt es ausdruecklich).
    expect(html).not.toContain("import ");
    expect(html).toContain("kein React, kein Build");
  });

  it("i18n: alle neuen Schluessel existieren in DE, EN und NL (je genau einmal)", () => {
    for (const key of [
      'tabAsk: "',
      'tabCapture: "',
      'askTitle: "',
      // JOB 3017 D4: `askHint` ist in `askReviewNotice` aufgegangen (der EINE Satz unter der
      // Fragen-Karte des Zielbilds); der Schluessel existiert nicht mehr.
      'askInputPlaceholder: "',
      'askCta: "',
      'askEmpty: "',
      'askBusy: "',
      'askTruncated: "',
      // JOB 3019 (KA5) hatte hier zwei weitere Deckel-Saetze: `askSelectionTruncated`,
      // `askBothTruncated`. JOB 3056 K1 (Rebase, 05.09.2026): BEIDE SCHLUESSEL SIND ENTFERNT — sie
      // bedienten ausschliesslich die Vier-Lagen-Herkunftszeile (`askDeckelHinweis`), die mit dem
      // Ruhe-Umbau selbst entfallen ist (taskpane.html `updateAskSourceNote` zeigt nur noch den
      // EINEN Verwerfungssatz, ohne Deckelhinweis). Die Statuszeile nach der Antwort zeigt
      // `askTruncated` unveraendert (renderAskOutcome, s.o.); dort steht die Kappung weiterhin.
      'askAuth: "',
      'askTimeout: "',
      // JOB 3016 Runde 5: die Auswahlfrist des Word-Wegs (Word bleibt den Rueckruf schuldig).
      'askSelectionTimeout: "',
      'askError: "',
      'askAnswerTitle: "',
      'askSourcesTitle: "',
      'askTrust: "',
      'askGapTitle: "',
      // JOB 3046 D2: askGapBody ist ENTFERNT (die Luecke ist eine Auskunft, kein Erklaertext);
      // neu sind die Hauptaktion „Frage ändern" und die Fusszeile des Zielbilds.
      'askGapFrageAendern: "',
      'askGapFuss: "',
      'askGapSendCta: "',
      'askGapSentOk: "',
      'askGapOpenLink: "',
      'askInsertCta: "',
      'askInsertOk: "',
      'askInsertFail: "',
      // klara1b Teil A/B: neue Schluessel (editierbar, Kopieren, kompakt, Rechte-Ausweg).
      'askInsertEmpty: "',
      'askAnswerEditHint: "',
      'askCopyCta: "',
      'askCopyOk: "',
      'askCopyFail: "',
      'askShowMore: "',
      'askShowLess: "',
      'askSourceLine: "',
      'askSourceLineRetrieved: "',
      'askInsertTruncatedNote: "',
      'askForbidden: "',
      'askOpenQuestionPrefix: "',
      'askOpenQuestionFallback: "',
      'helpCan3: "',
    ]) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
    // JOB 3046 D2 — BEWUSSTE ENTSCHEIDUNG, KEINE ABRAEUMUNG: bis hierher trug die Luecke im Panel
    // dieselbe Kernaussage wie die Konsole („Keine belastbare Grundlage." / ask.noBasisTitle).
    // Das Zielbild KeinWissen.dc.html (Pedi, 27.08.; „D2 ja", 03.09.) gibt dem Panel EINEN anderen
    // Satz: „Dazu liegt kein freigegebenes Firmenwissen vor." Zielbild vor Paritaet — die Konsole
    // behaelt ihren Satz (apps/web/src/i18n.ts ask.noBasisTitle, hier nicht angefasst), das Panel
    // traegt den des Zielbilds. Der Schluessel bleibt derselbe (askGapTitle), EN/NL sagen dasselbe.
    expect(html).toContain('askGapTitle: "Dazu liegt kein freigegebenes Firmenwissen vor."');
    expect(html).toContain('askGapTitle: "There is no released company knowledge on this."');
    expect(html).toContain('askGapTitle: "Hierover is geen vrijgegeven bedrijfskennis."');
    expect(html).not.toContain('askGapTitle: "Keine belastbare Grundlage."');
    // Der alte Erklaertext ist in keiner Sprache mehr da — kein toter Schluessel (der Name steht
    // nur noch in den Kommentaren, die seine Entfernung begruenden).
    expect(html).not.toContain("askGapBody:");
    expect(html).not.toContain('data-t="askGapBody"');
  });

  // klara1b Teil B (Pedis Wunsch 24.07.): editierbare, kompaktere Antwort VOR dem Eintragen.
  it("Teil B: editierbares Feld (nur Antwortkoerper), Ausgabe entsteht beim Ausgeben, Kopieren-Ausweg, kompakt", () => {
    // Editierbares Textfeld statt statischem Absatz; es traegt NUR den Antwortkoerper.
    expect(html).toContain('<textarea id="ask-answer-edit"');
    expect(html).toContain('document.getElementById("ask-answer-edit").value = outcome.answer;');
    // AUFTRAG-mega35 A1/A2: es wird NICHTS mehr nachtraeglich in das Feld geschrieben, und der
    // Torwaechter `edit.value === askAnswerPrefill` existiert nicht mehr. Beides waren die Teile,
    // die eine Bearbeitung waehrend der Quellenaufloesung um Einstufung und Quelle gebracht haben.
    expect(html).not.toContain("buildDefaultInsertText");
    expect(html).not.toContain("var askAnswerPrefill");
    expect(html).not.toContain("edit.value === askAnswerPrefill");
    expect(html).toContain("function composeOutputText(body)");
    // Einfuegen UND Kopieren nutzen den AKTUELLEN (ggf. bearbeiteten) Feldinhalt — nie die Originalantwort.
    expect(html).toContain("function getEditedAnswerText()");
    expect(html).toContain('return document.getElementById("ask-answer-edit").value;');
    expect(html).toContain("performInsert(text, buildInsertAttempts())");
    expect(html).toContain("performCopy(text, clipboard)");
    // Kopieren-Ausweg: eigener Knopf, braucht kein Office (immer aktiv bei belegter Antwort).
    expect(html).toContain('id="ask-copy-btn"');
    expect(html).toContain("copyBtn.disabled = !insertable;");
    expect(html).toContain("window.navigator.clipboard");
    // Kompakt: „mehr anzeigen"-Schalter nur bei langer Antwort (answerIsLong), Auf-/Zuklappen.
    expect(html).toContain("if (answerIsLong(text)) {");
    expect(html).toContain("function toggleAnswerExpanded()");
    expect(html).toContain('id="ask-answer-toggle"');
    // Die Quellenliste bleibt GETRENNT vom einzufuegenden Text (nur Anzeige — wandert nie ins Dokument).
    expect(html).toContain('id="ask-sources-block"');
    // Neue Meldungen in allen drei Sprachen (Ausweg/Kopieren/Kompakt).
    for (const key of [
      'askCopyCta: "',
      'askCopyOk: "',
      'askCopyFail: "',
      'askAnswerEditHint: "',
      'askShowMore: "',
      'askShowLess: "',
      'askInsertEmpty: "',
    ]) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
    // Die Rechte-Meldung nennt jetzt zusaetzlich den Versions-Bump und den Kopieren-Ausweg.
    // (mega69 Block C: sichtbare deutsche Texte tragen echte Umlaute.)
    expect(html).toContain("höhere");
    expect(html).toContain("Kopieren");
  });

  it("Inline-Skript bleibt syntaktisch gueltig (node-parsebar, buildlos)", () => {
    const match = /<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/.exec(html);
    expect(match).not.toBeNull();
    // new Function parst das komplette Skript — wirft bei Syntaxfehlern (entspricht node --check).
    expect(() => new Function(match?.[1] ?? "")).not.toThrow();
  });
});

// ================================================================================================
// JOB 1153 · KA6 STUFE 1 — DIE SCHREIBFLAECHE, AM AUSGELIEFERTEN FENSTER GEMESSEN.
// ================================================================================================
//
// DIE DREI WOERTLICHEN ABNAHMEKRITERIEN aus `OFFEN.md` (KA6):
//   · „das Ergebnis erscheint IMMER als Vorschlag im Panel und wird erst auf Klick eingefuegt"
//   · „jede eingefuegte Passage traegt ihre Herkunft"
//   · „Klara schreibt NIE selbsttaetig ins Dokument"
//
// WARUM DIESE FAELLE DAS GANZE FENSTER LADEN statt einen Block zu schneiden: die dritte Zusage ist
// eine Aussage ueber ABWESENHEIT — „kein Schreibaufruf vor dem Klick". Eine Abwesenheit laesst sich
// an einer einzeln gerufenen Hilfsfunktion nicht messen; nur ein Spion am HOST kann sie belegen.
// Er sitzt deshalb auf `Word.run` und `setSelectedDataAsync` — den beiden einzigen Aufrufen, ueber
// die Text in das Dokument gelangt (vollstaendig nachgezaehlt in
// `_relay/kopf/outbox/RUECKGABE-BASIC4-JOB-1146-D1-KA6-ISTDELTA.md`, Abschnitt 4 zu Teilzusage 7).
//
// GEGENMUTATIONS-EMPFINDLICHKEIT, ausdruecklich: Laesst man den Vorschlag direkt einfuegen, steigt
// der Spionzaehler VOR dem Klick — Fall 1 wird rot. Nimmt man die Kennzeichnung weg, fehlt sie im
// ausgegebenen Text — Fall 2 wird rot. Beides ist im Durchgang ausgefuehrt und belegt.

/**
 * Schmale Struktur-Typen statt DOM-lib (Begruendung im Dateikopf). Es wird nur beschrieben, was
 * diese Faelle wirklich anfassen — eine breitere Attrappe waere eine Behauptung ueber Formen, die
 * hier niemand prueft.
 */
interface Ka6Element {
  className: string;
  textContent: string | null;
  value: string;
  disabled: boolean;
  click(): void;
  // JOB 1153 D2: Die nativen Uebernahmewege brauchen die Auswahlgrenzen (eine TEILAUSWAHL bleibt
  // bewusst roh) und einen Weg, das echte Ereignis am Feld auszuloesen.
  selectionStart: number;
  selectionEnd: number;
  dispatchEvent(ereignis: Event): boolean;
}
interface Ka6Dokument {
  getElementById(id: string): Ka6Element | null;
  body: { innerHTML: string };
}
interface Ka6Fenster {
  Office?: unknown;
  Word?: unknown;
  addEventListener(typ: string, fn: unknown): void;
  removeEventListener(typ: string, fn: unknown): void;
  // JOB 1153 D2: das echte Ereignis wird mit dem Konstruktor DES FENSTERS gebaut — ein
  // Node-eigenes `Event` wuerde von jsdom nicht als dasselbe erkannt. `navigator` traegt den
  // Zwischenablage-Spion des Kopierknopf-Wegs.
  Event: new (
    typ: string,
    init?: { bubbles?: boolean; cancelable?: boolean },
  ) => Event;
  navigator: object;
}
const umgebung = globalThis as unknown as { document: Ka6Dokument; window: Ka6Fenster };

/** Die Serverlage, die ein Fall stellt. Jedes Feld entspricht einem echten Vertragsfeld. */
interface Ka6Lage {
  /** `KlaraResolution.executionAllowed` — darf fuer diese Sitzung ueberhaupt ausgefuehrt werden? */
  executionAllowed: boolean;
  /** `KlaraResolution.blockedReason` — der BENANNTE Grund, nicht ein Freitext. */
  blockedReason: string | null;
  /** `KlaraResolution.effectiveMode`. */
  effectiveMode: "deterministic" | "internal" | "external";
  /** Traegt der Antwortkoerper von `/api/ask` das Kennzeichnungssignal `aiGenerated`? */
  aiGenerated: boolean;
  /**
   * G24 (JOB 1610): ein ROHER Wert an der Stelle des Kennzeichnungssignals — fuer den Fall, dass
   * der Server etwas schickt, das kein gueltiger Marker ist. Nur `KERN 3b` benutzt ihn; ohne ihn
   * baut die Fixture den echten Vertrag ueber `aiGeneratedMark()`.
   */
  aiGeneratedRoh?: unknown;
  /** Antwortet `/api/ask` mit einer belegten Antwort — oder mit einer Wissensluecke? */
  answered: boolean;
}

const KA6_ANTWORTTEXT = "Vor jeder Wartung an Linie 3 zuerst den Not-Aus ziehen.";

// ================================================================================================
// WAS DER SPION ZAEHLT — UND WARUM NICHT EINFACH `Word.run`.
// ================================================================================================
//
// Der Auftrag nennt „`Word.run` und `setSelectedDataAsync` bei 0". Am ausgelieferten Fenster kann
// das nicht zutreffen, und zwar aus einem belegten Grund: `Word.run` ist NICHT der Schreibweg,
// sondern der Einstieg in die Word-API ueberhaupt. KA1 benutzt ihn beim Oeffnen LESEND
// (`ka1Aktualisieren` → `readWholeDocument` → `body.load("text")` / `getHtml()`), und mega74 holt
// darueber Bilder. Gemessen: genau ein `Word.run` vor jedem Klick — ein Lesezugriff.
//
// Die Zusage von KA6 lautet aber „Klara schreibt NIE selbsttaetig ins Dokument", und schreiben tun
// exakt zwei Aufrufe: `range.insertText(...)` INNERHALB von `Word.run` und
// `setSelectedDataAsync(...)`. Genau die zaehlt der Spion — er misst damit die Zusage und nicht
// ihren Traeger. `ka6WordRunGesamt` laeuft daneben mit, damit die Lesezugriffe sichtbar bleiben
// statt zu verschwinden; die Abweichung vom Auftragswortlaut ist in der Rueckgabe benannt.
let ka6WordRunGesamt = 0;
let ka6InsertText = 0;
let ka6SetSelected = 0;
let ka6Eingefuegt: string[] = [];
let ka6Zuhoerer: Array<{ typ: string; fn: unknown }> = [];

// JOB 3019 (KA5) R2, BENs Korrekturpflicht 2: KA6 muss die Markierung weiter bevorzugen. Gemessen
// wird das am ABGESETZTEN Koerper, nicht am Quelltext — deshalb schreibt der Router jeden
// `POST /api/ask` mit, und die Office-Attrappe hat eine STELLBARE Textmarkierung (sie lieferte
// bisher unbedingt "" und konnte die Lage „Markierung UND Eingabe" gar nicht herstellen).
let ka6Markierung = "";
let ka6AskAbgesetzt: Array<Record<string, unknown>> = [];

/** Die Summe der echten SCHREIBAUFRUFE — die eine Zahl, an der die Kernzusage haengt. */
function ka6Schreibaufrufe(): number {
  return ka6InsertText + ka6SetSelected;
}

function ka6Aufloesung(lage: Ka6Lage): Record<string, unknown> {
  return {
    resolutionId: "res-ka6",
    mode: lage.effectiveMode,
    provider: "KLARWERK On-Premise",
    model: "haus-modell",
    adminConfiguredMode: lage.effectiveMode,
    effectiveMode: lage.effectiveMode,
    deviation: lage.blockedReason !== null,
    deviationReason: lage.blockedReason,
    externalConsentRequired: lage.effectiveMode === "external",
    externalConsentGranted: false,
    executionAllowed: lage.executionAllowed,
    blockedReason: lage.blockedReason,
    resolvedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    // Genau die eine Klasse, die `klara-policy.ts:175` als KLARA_PAYLOAD_CLASS_QUESTION fuehrt.
    effectivePayloadClasses: ["question"],
    blockedPayloadClasses: [],
  };
}

function ka6Sitzung(lage: Ka6Lage): Record<string, unknown> {
  return {
    sessionId: "sess-ka6",
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-ka6",
    documentContextId: "doc-ka6",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    consentState: "none",
    closed: false,
    resolution: ka6Aufloesung(lage),
  };
}

/** Der Antwortkoerper von `POST /api/ask` — in der Form, die `performAsk` wirklich liest. */
function ka6AskKoerper(lage: Ka6Lage): Record<string, unknown> {
  if (!lage.answered) {
    return { result: { answered: false, answer: null, sources: [], trust: 0 }, gap: { id: "g-1" } };
  }
  return {
    result: {
      answered: true,
      answer: KA6_ANTWORTTEXT,
      sources: ["ko-ka6"],
      citedSources: ["ko-ka6"],
      trust: 55,
      evidence: { grade: "unverified", sourcesConflicted: false, conflictsUnproven: false },
      // AUFTRAG-mega81: das SERVERSEITIGE Kennzeichnungssignal. Der Client liest es, er nimmt es
      // nicht an — deshalb steht es hier als Fixture und nicht als Annahme im Panel.
      //
      // G24 (JOB 1610): HIER STAND EIN HANDGEBAUTES `{ aiGenerated: true, task: "answer" }` —
      // OHNE `mode`. Der echte Server setzt `mode` IMMER (model-runs/src/types.ts:87 baut die
      // Marke unbedingt mit `aiGenerated`, `task`, `mode` und `at`). Die Fixture hat den Vertrag
      // also unvollstaendig nachgebaut und damit etwas anderes geprueft als das Produkt: Solange
      // der Client `Boolean(...)` rechnete, war jedes Objekt wahr und die Luecke unsichtbar.
      // Genau deshalb hat DIESE Datei den G24-Fehler mitgetragen, statt ihn zu fangen.
      //
      // Der Fix ist nicht „ein Feld nachtragen", sondern die Ursache: die Fixture BENUTZT jetzt
      // den Erzeuger des Vertrags. Kommt ein Feld hinzu, reist es von selbst mit — eine
      // Handform kann nicht wieder hinter den Vertrag zurueckfallen.
      ...("aiGeneratedRoh" in lage
        ? { aiGenerated: lage.aiGeneratedRoh }
        : lage.aiGenerated
          ? { aiGenerated: aiGeneratedMark("answer", false) }
          : {}),
    },
    gap: null,
  };
}

function ka6Antwort(koerper: unknown, ok = true, status = 200): unknown {
  return { ok, status, json: () => Promise.resolve(koerper) };
}

function ka6Router(lage: Ka6Lage) {
  return (url: string, init?: { method?: string; body?: string }) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/ask" && methode === "POST" && typeof init?.body === "string") {
      ka6AskAbgesetzt.push(JSON.parse(init.body) as Record<string, unknown>);
    }
    if (url === "/api/auth/me") {
      return Promise.resolve(ka6Antwort({ id: "u1", name: "Pruefer" }));
    }
    if (url === "/api/reasoner/status") {
      return Promise.resolve(ka6Antwort({ enabled: false, reachable: "none" }));
    }
    if (url === "/api/klara/sessions" && methode === "POST") {
      return Promise.resolve(ka6Antwort(ka6Sitzung(lage)));
    }
    if (url === "/api/klara/ai-status") {
      return Promise.resolve(ka6Antwort(ka6Aufloesung(lage)));
    }
    if (url === "/api/ask" && methode === "POST") {
      return Promise.resolve(ka6Antwort(ka6AskKoerper(lage)));
    }
    if (url.startsWith("/api/kos/")) {
      return Promise.resolve(
        ka6Antwort({ id: "ko-ka6", title: "Wartungsplan L3", trust: 55, status: "validiert" }),
      );
    }
    return Promise.resolve(ka6Antwort({}, false, 404));
  };
}

/** Alle anstehenden Mikrotasks abarbeiten lassen (Bauform aus w1-klara-lifecycle-taskpane). */
async function ka6Leerlauf(runden = 10): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

/**
 * Laedt das VOLLSTAENDIGE Aufgabenfenster und haengt die Spione an den Host. Nichts wird
 * herausgeschnitten — was hier gruen ist, ist am ausgelieferten Fenster gruen.
 */
async function ladeKa6Fenster(lage: Ka6Lage): Promise<void> {
  // Lage und Fenster entstehen an EINER Stelle: der Router muss stehen, bevor das Inline-Skript
  // laeuft — es ruft `/api/auth/me`, `/api/klara/sessions` und `/api/klara/ai-status` sofort.
  vi.stubGlobal("fetch", ka6Router(lage));
  const quelle = read(TASKPANE);
  const skriptStart = quelle.lastIndexOf("<script>");
  const skriptEnde = quelle.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = quelle.slice(skriptStart + "<script>".length, skriptEnde);

  const bodyStart = quelle.indexOf("<body>");
  expect(bodyStart, `${TASKPANE}: <body> nicht gefunden`).toBeGreaterThan(0);
  const markup = quelle.slice(bodyStart + "<body>".length, skriptStart);
  // Fail-closed: waere das Markup leer, pruefte dieser Fall ein leeres Dokument.
  expect(markup.length, `${TASKPANE}: Markup ist leer`).toBeGreaterThan(2000);
  umgebung.document.body.innerHTML = markup;

  // ============================================================================================
  // DIE OFFICE-ATTRAPPE — VOLLSTAENDIG, weil eine halbe Attrappe den Lauf abbrechen laesst.
  // ============================================================================================
  // `CoercionType` und `AsyncResultStatus` sind KEIN Beiwerk: der vorhandene Fokus-/Eingabe-Zuhoerer
  // des Panels (Herkunftszeile → `updateAskSourceNote` → `readAskSelection`) greift auf beide zu.
  // Fehlt eines, wirft der Zuhoerer INNERHALB von jsdom, der Fall bleibt gruen und der LAUF endet
  // mit Exitcode 1. Genau das ist in JOB 1151 D2 gemessen und gemeldet worden.
  const COERCION = { Text: "text" } as const;
  const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;
  const kontext = {
    document: {
      url: "",
      addHandlerAsync() {
        /* Der Pruefstand loest keinen Markierungswechsel aus. */
      },
      getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
        // Standard ist die LEERE Auswahl: dieser Pruefstand stellt kein markiertes Dokument und
        // behauptet keines. JOB 3019 R2 macht sie stellbar (`ka6Markierung`), damit die Lage
        // „Markierung UND Eingabe" ueberhaupt erreichbar ist — sie ist der Kern von BENs Befund.
        fn({ status: ASYNC_STATUS.Succeeded, value: ka6Markierung });
      },
      // DER SPION AUF WEG 2 (`buildInsertAttempts`, Rueckfall).
      setSelectedDataAsync(
        text: string,
        _opts: unknown,
        fn: (r: { status: string }) => void,
      ): void {
        ka6SetSelected += 1;
        ka6Eingefuegt.push(text);
        fn({ status: ASYNC_STATUS.Succeeded });
      },
    },
  };
  umgebung.window.Office = {
    context: kontext,
    EventType: {},
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void) => cb(),
  };
  // DER SPION AUF WEG 1 (`buildInsertAttempts`, primaerer Word.run-Weg). Gezaehlt wird der
  // SCHREIBAUFRUF `insertText` — der `Word.run` daneben ist auch der Leseweg von KA1.
  umgebung.window.Word = {
    InsertLocation: { replace: "replace" },
    run: (fn: (ctx: unknown) => unknown) => {
      ka6WordRunGesamt += 1;
      const range = {
        insertText: (text: string) => {
          ka6InsertText += 1;
          ka6Eingefuegt.push(text);
        },
      };
      const ctx = {
        document: {
          getSelection: () => range,
          body: { text: "", load: () => undefined, getHtml: () => ({ value: "" }) },
        },
        sync: () => Promise.resolve(),
      };
      return Promise.resolve(fn(ctx));
    },
  };

  // jsdom teilt EIN `window` ueber alle Faelle. Ohne Aufraeumen reagierten im dritten Fall drei
  // Fensterinstanzen gleichzeitig — ein Messfehler des Pruefstands, kein Befund am Fenster.
  const originalAdd = umgebung.window.addEventListener.bind(umgebung.window);
  umgebung.window.addEventListener = (typ: string, fn: unknown) => {
    ka6Zuhoerer.push({ typ, fn });
    originalAdd(typ, fn);
  };

  new Function(skript)();
  await ka6Leerlauf();
}

function ka6El(id: string): Ka6Element {
  const gefunden = umgebung.document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as Ka6Element;
}

function ka6Sichtbar(id: string): boolean {
  const el = umgebung.document.getElementById(id);
  return el !== null && !el.className.includes("hidden");
}

/** Der Wortlaut eines KA6-Schluessels — GELESEN aus dem ausgelieferten Fenster, nie abgeschrieben. */
function ka6Wortlaut(key: string): string {
  const quelle = read(TASKPANE);
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)"`, "m").exec(quelle);
  expect(treffer, `${TASKPANE}: ${key} fehlt im Woerterbuch`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

/** Die erlaubte Lage: hausintern, ausfuehrbar, mit Kennzeichnungssignal (klara-policy.ts:240-258). */
function ka6Erlaubt(over: Partial<Ka6Lage> = {}): Ka6Lage {
  return {
    executionAllowed: true,
    blockedReason: null,
    effectiveMode: "internal",
    aiGenerated: true,
    answered: true,
    ...over,
  };
}

describe("JOB 1153 · KA6 Stufe 1: die Schreibflaeche im Aufgabenfenster", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ka6WordRunGesamt = 0;
    ka6InsertText = 0;
    ka6SetSelected = 0;
    ka6Eingefuegt = [];
    ka6Zuhoerer = [];
    ka6Markierung = "";
    ka6AskAbgesetzt = [];
  });

  afterEach(() => {
    for (const z of ka6Zuhoerer) {
      umgebung.window.removeEventListener(z.typ, z.fn);
    }
    ka6Zuhoerer = [];
    umgebung.window.Office = undefined;
    umgebung.window.Word = undefined;
    umgebung.document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("Die Flaeche existiert und bietet GENAU DREI Zurufe: erstellen, vervollstaendigen, umformulieren", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    // JOB 3056 K1 (Pages-Massstab): die Schreibflaeche ist ein Untermenue des Frage-Felds — in
    // der leeren Ruhe steht sie NICHT im Sichtfeld; sie erscheint mit dem ersten Zeichen im Feld
    // (oder einer Markierung in Word) und geht mit dem letzten (ka6Kontext, ka6Zeichnen).
    expect(ka6Sichtbar("ka6-block"), "Die Schreibflaeche steht ohne Kontext im Sichtfeld").toBe(
      false,
    );
    const feld = ka6El("ask-input");
    feld.value = "Bitte formulieren";
    feld.dispatchEvent(new umgebung.window.Event("input", { bubbles: true }));
    expect(ka6Sichtbar("ka6-block"), "Die Schreibflaeche fehlt").toBe(true);
    feld.value = "";
    feld.dispatchEvent(new umgebung.window.Event("input", { bubbles: true }));
    expect(ka6Sichtbar("ka6-block"), "Die Schreibflaeche bleibt ohne Kontext stehen").toBe(false);
    feld.value = "Bitte formulieren";
    feld.dispatchEvent(new umgebung.window.Event("input", { bubbles: true }));
    expect(ka6Sichtbar("ka6-block")).toBe(true);
    for (const id of [
      "ka6-zuruf-erstellen",
      "ka6-zuruf-vervollstaendigen",
      "ka6-zuruf-umformulieren",
    ]) {
      expect(ka6Sichtbar(id), `Zuruf ${id} fehlt`).toBe(true);
    }
    // Kalibrierung: die drei tragen VERSCHIEDENE Beschriftungen — sonst waere „drei Zurufe" eine
    // Behauptung ueber drei gleiche Knoepfe.
    const namen = [
      ka6El("ka6-zuruf-erstellen").textContent,
      ka6El("ka6-zuruf-vervollstaendigen").textContent,
      ka6El("ka6-zuruf-umformulieren").textContent,
    ];
    expect(new Set(namen).size, `Die Zurufe heissen gleich: ${namen.join(" / ")}`).toBe(3);
  });

  it("KERN 1: ein Zuruf erzeugt GENAU EINEN Vorschlag im vorhandenen Feld — und NULL Schreibaufrufe", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);

    // (a) Das Ergebnis erscheint als VORSCHLAG im vorhandenen Feld.
    expect(ka6El("ask-answer-edit").value, "Kein Vorschlag im Vorschlagsfeld").toContain(
      KA6_ANTWORTTEXT,
    );
    // (b) „Klara schreibt NIE selbsttaetig ins Dokument" — beide SCHREIBWEGE bei NULL.
    expect(ka6InsertText, "insertText wurde ohne Klick gerufen").toBe(0);
    expect(ka6SetSelected, "setSelectedDataAsync wurde ohne Klick gerufen").toBe(0);
    expect(ka6Eingefuegt, "Es wurde ohne Klick Text ins Dokument gegeben").toEqual([]);
    // (c) KALIBRIERUNG: der Spion ist nicht blind — er hat sehr wohl `Word.run` gesehen (KA1 liest
    // beim Oeffnen das Dokument). Ohne diese Zeile waere die Null oben auch dann gruen, wenn die
    // Attrappe gar nicht angeschlossen ist.
    expect(
      ka6WordRunGesamt,
      "Der Word-Spion hat gar nichts gesehen — er haengt nicht",
    ).toBeGreaterThan(0);
  });

  it('KERN 2: erst der Klick fuegt ein — und die Passage traegt die dritte Klasse „KI-formuliert"', async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);
    expect(ka6Schreibaufrufe(), "Vorbedingung verletzt: schon vor dem Klick geschrieben").toBe(0);

    ka6El("ka6-insert-btn").click();
    await ka6Leerlauf(20);

    // GENAU EIN Schreibvorgang — der moderne Word.run-Weg gewinnt, der Rueckfall bleibt unberuehrt.
    expect(ka6InsertText, "Der Einfuegeweg lief nicht ueber insertText").toBe(1);
    expect(ka6SetSelected, "Der Rueckfall lief zusaetzlich").toBe(0);
    expect(ka6Eingefuegt).toHaveLength(1);

    const ausgegeben = ka6Eingefuegt[0] ?? "";
    expect(ausgegeben, "Der Koerper fehlt im ausgegebenen Text").toContain(KA6_ANTWORTTEXT);
    // Die dritte Klasse steht im AUSGEGEBENEN Text, nicht nur im Panel.
    expect(ausgegeben, 'Die Kennzeichnung „KI-formuliert" fehlt im ausgegebenen Text').toContain(
      ka6Wortlaut("ka6Herkunft"),
    );
    // ... und sie ist von den beiden Bestandsklassen UNTERSCHEIDBAR: keine von ihnen steht daneben.
    expect(ausgegeben).not.toContain(ka6Wortlaut("askEvidenceVerified"));
    expect(ausgegeben).not.toContain(ka6Wortlaut("askEvidenceUnverified"));
  });

  it("KERN 3 (D2, fail-closed): ohne `aiGenerated` entsteht GAR KEIN Vorschlag", async () => {
    // ============================================================================================
    // WAS SICH GEGENUEBER D1 GEAENDERT HAT — UND WARUM.
    // ============================================================================================
    // D1 hat hier den RUECKFALL festgeschrieben: ohne Signal wurde trotzdem ein Vorschlag
    // ausgegeben, nur eben ueber `composeOutputText` — also mit „gesichert" oder „ungeprueft".
    // BEN hat genau das als Scheinbeleg beanstandet (D1-Urteil, TESTAUSSAGEKRAFT) und die Regel
    // woertlich gesetzt: „Ohne belastbares Formulierungssignal wird fail-closed KEIN
    // KA6-Vorschlag freigegeben; ein Rueckfall auf `gesichert`/`ungeprueft` ist unzulaessig."
    //
    // Der Grund ist inhaltlich, nicht formal: Ein per Zuruf geholter Text IST eine Formulierung.
    // Ihn als „gesichert" auszugeben, waere die schlechtere Unehrlichkeit — nicht eine fehlende
    // Angabe, sondern eine falsche.
    const lage = ka6Erlaubt({ aiGenerated: false });
    await ladeKa6Fenster(lage);

    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);

    // (a) Das Vorschlagsfeld bleibt LEER — es gibt nichts, was falsch etikettiert werden koennte.
    expect(
      ka6El("ask-answer-edit").value,
      "Ohne Formulierungssignal wurde trotzdem ein Vorschlag eingestellt",
    ).toBe("");
    // (b) Der Einfuegeknopf wird gar nicht erst angeboten.
    expect(ka6Sichtbar("ka6-insert-btn"), "Der Einfuegeknopf steht trotz fail-closed bereit").toBe(
      false,
    );
    // (c) Die Flaeche sagt den Grund — Schweigen waere hier fail-open in der Anzeige.
    expect(ka6El("ka6-status").textContent ?? "").toContain(ka6Wortlaut("ka6KeinSignal"));
    // (d) Und es wurde nichts geschrieben.
    expect(ka6Schreibaufrufe(), "Es wurde geschrieben, obwohl kein Vorschlag entstand").toBe(0);
  });

  it("KERN 3b (G24): ein UNVOLLSTAENDIGER Marker zaehlt wie KEIN Signal", async () => {
    // ============================================================================================
    // G24 (OFFEN.md:159) — DER FALL, DER OHNE DEN FIX ROT FAELLT.
    // ============================================================================================
    // Bis JOB 1601 rechnete das Aufgabenfenster `Boolean(result.aiGenerated)`. Ein Objekt — auch
    // ein unvollstaendiges — ist damit WAHR, und der Vorschlag waere als KI-formuliert
    // durchgegangen. Hier steht genau so ein Wert: die Marke ohne `mode`.
    //
    // DIESE FORM IST NICHT ERFUNDEN. Sie stand bis heute in DIESER Datei als Fixture
    // (`{ aiGenerated: true, task: "answer" }`) und hat den Fehler dadurch mitgetragen statt ihn
    // zu fangen — der Grund steht bei `ka6AskKoerper`. Jetzt ist sie der Negativfall.
    //
    // Erwartung: dasselbe Verhalten wie bei KERN 3 (gar kein Signal) — fail-closed, kein
    // Vorschlag, kein Knopf, benannter Grund. Im Zweifel nicht behaupten.
    const lage = ka6Erlaubt({ aiGeneratedRoh: { aiGenerated: true, task: "answer" } });
    await ladeKa6Fenster(lage);

    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);

    expect(
      ka6El("ask-answer-edit").value,
      "Ein unvollstaendiger Marker hat einen Vorschlag freigegeben — G24 ist nicht geschlossen",
    ).toBe("");
    expect(
      ka6Sichtbar("ka6-insert-btn"),
      "Der Einfuegeknopf steht trotz ungueltigem Marker bereit",
    ).toBe(false);
    expect(ka6El("ka6-status").textContent ?? "").toContain(ka6Wortlaut("ka6KeinSignal"));
    expect(ka6Schreibaufrufe(), "Es wurde geschrieben, obwohl kein Vorschlag entstand").toBe(0);
  });

  it("EHRLICHKEIT 1: `external_not_migrated` — Grund im Klartext, KEIN Zuruf", async () => {
    const lage = ka6Erlaubt({
      executionAllowed: false,
      blockedReason: "external_not_migrated",
      effectiveMode: "external",
    });
    await ladeKa6Fenster(lage);

    expect(ka6Sichtbar("ka6-hinweis"), "Kein Grund sichtbar, obwohl gesperrt").toBe(true);
    expect(ka6El("ka6-hinweis").textContent ?? "").toContain(ka6Wortlaut("ka6BlockedNotMigrated"));
    // „bietet KEINEN Zuruf an" — die Knoepfe sind weg, nicht bloss `disabled`.
    expect(ka6Sichtbar("ka6-zurufe"), "Die Zurufe werden trotz Sperre angeboten").toBe(false);
  });

  it("EHRLICHKEIT 2: `external_consent_missing` — ein ANDERER Grund (die beiden bleiben getrennt)", async () => {
    const lage = ka6Erlaubt({
      executionAllowed: false,
      blockedReason: "external_consent_missing",
      effectiveMode: "external",
    });
    await ladeKa6Fenster(lage);

    const gezeigt = ka6El("ka6-hinweis").textContent ?? "";
    expect(gezeigt).toContain(ka6Wortlaut("ka6BlockedConsentMissing"));
    // DIE TRENNUNG IST DER PUNKT: die eine ist eine Betriebsentscheidung, die andere eine Frage an
    // den Anwender. Ein gemeinsamer Satz waere genau die Vermischung, die der Auftrag verbietet.
    expect(gezeigt, "Beide Blockgruende zeigen denselben Satz").not.toContain(
      ka6Wortlaut("ka6BlockedNotMigrated"),
    );
    expect(ka6Wortlaut("ka6BlockedConsentMissing")).not.toBe(ka6Wortlaut("ka6BlockedNotMigrated"));
    expect(ka6Sichtbar("ka6-zurufe")).toBe(false);
  });

  it("EHRLICHKEIT 3: keine belastbare Grundlage → ehrliche Meldung, KEIN erfundener Vorschlag", async () => {
    const lage = ka6Erlaubt({ answered: false });
    await ladeKa6Fenster(lage);

    ka6El("ask-input").value = "Etwas, wozu es nichts gibt";
    ka6El("ka6-zuruf-umformulieren").click();
    await ka6Leerlauf(20);

    expect(ka6El("ask-answer-edit").value, "Es wurde ein Vorschlag erfunden").toBe("");
    expect(ka6El("ka6-status").textContent ?? "").toContain(ka6Wortlaut("ka6NoBasis"));
    expect(ka6Schreibaufrufe(), "Trotz fehlender Grundlage wurde geschrieben").toBe(0);
  });

  it("EHRLICHKEIT 4: Zuruf ohne Text — die Flaeche sagt, was fehlt, und ruft NICHTS ab", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    // Weder Markierung (die Attrappe meldet eine leere Auswahl) noch Eingabe.
    ka6El("ask-input").value = "";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);

    expect(ka6El("ka6-status").textContent ?? "").toContain(ka6Wortlaut("ka6Empty"));
    expect(ka6El("ask-answer-edit").value, "Ohne Eingabe entstand ein Vorschlag").toBe("");
    expect(ka6Schreibaufrufe(), "Ohne Eingabe wurde geschrieben").toBe(0);
  });

  // ==============================================================================================
  // JOB 3019 (KA5) R2 · BENs KORREKTURPFLICHT 2 — KA6 BLEIBT BEI DER MARKIERUNG.
  // ==============================================================================================
  //
  // In Runde 1 hat KA6 die neue Ask-Vorrangregel ungefragt mitbekommen, weil beide Wege denselben
  // Helfer riefen: bei Markierung PLUS liegen gebliebenem Eingabetext reiste ploetzlich der
  // Eingabetext als Zuruf, und die markierte Passage ging dort ganz verloren. Fuer einen Zuruf ist
  // die Markierung aber das MATERIAL („Umformulieren" meint die markierte Stelle), nicht ein
  // Suchbegriff. Seit R2 entscheidet `ka6Zurufgrundlage` die Vorrangfrage fuer KA6 allein.
  //
  // GEMESSEN WIRD DER ABGESETZTE KOERPER, nicht der Quelltext — und fuer ALLE DREI Zurufe, damit
  // nicht einer von ihnen still an der Regel vorbeilaeuft.
  for (const zuruf of [
    { id: "ka6-zuruf-erstellen", auftrag: "ka6AuftragErstellen" },
    { id: "ka6-zuruf-vervollstaendigen", auftrag: "ka6AuftragVervollstaendigen" },
    { id: "ka6-zuruf-umformulieren", auftrag: "ka6AuftragUmformulieren" },
  ]) {
    it(`KA6-VORRANG (${zuruf.id}): Markierung UND Eingabe → der Zuruf traegt die MARKIERUNG`, async () => {
      ka6Markierung = "Die Spannrolle wird halbjaehrlich nachgestellt.";
      await ladeKa6Fenster(ka6Erlaubt());
      // Der liegen gebliebene Text im Fragefeld — genau die Lage aus BENs Befund.
      ka6El("ask-input").value = "Wie oft wird die Spannrolle geprueft?";

      ka6El(zuruf.id).click();
      await ka6Leerlauf(20);

      expect(ka6AskAbgesetzt, "Der Zuruf hat gar nichts abgesetzt").toHaveLength(1);
      const koerper = ka6AskAbgesetzt[0] as Record<string, unknown>;
      // Der Auftragssatz des Zurufs plus die MARKIERUNG — nicht der getippte Text.
      expect(koerper.question).toBe(`${ka6Wortlaut(zuruf.auftrag)} ${ka6Markierung}`);
      expect(String(koerper.question)).not.toContain("Wie oft wird die Spannrolle geprueft?");
      // Und byte-gleich zum Stand vor KA5: der Zuruf schickt KEIN `selection`-Feld mit.
      expect(Object.keys(koerper).sort()).toEqual(["locale", "mode", "question"]);
      expect(koerper.mode, "Der server-garantierte Modus fehlt").toBe("retrieval-only");
    });
  }

  it("KA6-VORRANG: ohne Markierung traegt der Zuruf weiterhin die Eingabe (kein toter Zweig)", async () => {
    // Ohne diesen Fall waere die Regel oben auch dann gruen, wenn KA6 die Eingabe NIE benutzte.
    ka6Markierung = "";
    await ladeKa6Fenster(ka6Erlaubt());
    ka6El("ask-input").value = "Anschreiben zur Wartung";

    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);

    expect(ka6AskAbgesetzt).toHaveLength(1);
    expect((ka6AskAbgesetzt[0] as Record<string, unknown>).question).toBe(
      `${ka6Wortlaut("ka6AuftragErstellen")} Anschreiben zur Wartung`,
    );
  });

  it("KA6-VORRANG: der FRAGEN-Weg im selben Fenster entscheidet weiter andersherum", async () => {
    // Die Trennung ist der Kern: dieselbe Lage, zwei Wege, zwei Antworten. Liefe KA6 wieder ueber
    // `prepareAskQuestion`, waeren beide Koerper gleich und dieser Fall rot.
    ka6Markierung = "Die Spannrolle wird halbjaehrlich nachgestellt.";
    await ladeKa6Fenster(ka6Erlaubt());
    ka6El("ask-input").value = "Wie oft wird die Spannrolle geprueft?";

    ka6El("ask-btn").click();
    await ka6Leerlauf(20);

    expect(ka6AskAbgesetzt).toHaveLength(1);
    const koerper = ka6AskAbgesetzt[0] as Record<string, unknown>;
    expect(koerper.question).toBe("Wie oft wird die Spannrolle geprueft?");
    expect(koerper.selection).toBe(ka6Markierung);
  });

  it("EHRLICHKEIT 5: Serverfehler — ehrliche Meldung, kein halber Vorschlag, kein Schreibaufruf", async () => {
    await ladeKa6Fenster(ka6Erlaubt());
    // Der Zuruf laeuft in einen 500er. `performAsk` liefert dafuer `kind: "error"`.
    vi.stubGlobal("fetch", (url: string) =>
      url === "/api/ask"
        ? Promise.resolve(ka6Antwort({}, false, 500))
        : Promise.resolve(ka6Antwort({})),
    );

    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-vervollstaendigen").click();
    await ka6Leerlauf(20);

    const gemeldet = ka6El("ka6-status").textContent ?? "";
    // Der Rahmen des Fehlersatzes steht da — inklusive des konkreten Details, nicht nur „Fehler".
    expect(gemeldet.length, "Der Fehler wurde verschwiegen").toBeGreaterThan(0);
    expect(gemeldet).toContain(ka6Wortlaut("ka6Fehler").split("(")[0]?.trim() ?? "");
    expect(gemeldet, "Das konkrete Detail fehlt in der Meldung").toContain("HTTP 500");
    expect(ka6El("ask-answer-edit").value, "Trotz Fehler steht ein Vorschlag im Feld").toBe("");
    expect(ka6Schreibaufrufe(), "Trotz Fehler wurde geschrieben").toBe(0);
  });

  it("BEWAHREN: die Ask-Flaeche und ihr Einfuegeknopf bleiben unveraendert erreichbar", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    // Der bestehende Fragen-Weg steht unveraendert da …
    for (const id of [
      "ask-input",
      "ask-btn",
      "ask-answer-edit",
      "ask-insert-btn",
      "ask-copy-btn",
    ]) {
      expect(umgebung.document.getElementById(id), `#${id} ist verschwunden`).not.toBeNull();
    }
    // … und sein Einfuegeknopf ist ohne Ask-Antwort weiterhin GESPERRT. Das ist der Beleg, dass der
    // KA6-Vorschlag im gemeinsamen Feld keine zweite, ungegatete Ausgabe oeffnet.
    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ka6-zuruf-erstellen").click();
    await ka6Leerlauf(20);
    expect(
      ka6El("ask-insert-btn").disabled,
      "Der Ask-Einfuegeknopf wurde durch KA6 entsperrt",
    ).toBe(true);
  });

  // ==============================================================================================
  // JOB 1153 D2 · PFLICHT 1 — DIE HERKUNFT IST EINE INVARIANTE ALLER UEBERNAHMEWEGE.
  // ==============================================================================================
  //
  // BENs Kern in einem Satz: „KI-formuliert" darf kein Etikett sein, das nur auf EINEM Weg klebt.
  // Der Vorschlag kann das Feld auf VIER Wegen verlassen; traegt nur der Einfuegeklick die
  // Herkunft, wandert KI-Text ungekennzeichnet ins Dokument.
  //
  // GEMESSEN WIRD JE WEG DER TATSAECHLICH UEBERTRAGENE STRING — nicht, dass ein Ereignis feuerte.
  // Das ist BENs woertliche Auflage („Fuer jeden Weg ist der tatsaechlich uebertragene String zu
  // pruefen"), und sie ist der Unterschied zwischen einer Deckung und einer Behauptung.
  //
  // DER IST-BEFUND, gegen den hier gebaut wird (in D2 im Quelltext nachgeschlagen):
  //   · Kopierknopf   → `copyAnswer` baut ueber `composeOutputText` — ohne KA6-Herkunft.
  //   · copy / cut    → `handleAnswerClipboard` steigt bei `currentAskOutcome.kind !== "answered"`
  //                     SOFORT aus (taskpane.html:4212). Bei einem KA6-Vorschlag ist dieser Zustand
  //                     gar nicht gesetzt — es gibt kein `preventDefault`, und der Host kopiert den
  //                     ROHEN Feldinhalt. Das ist die schwerste der vier Luecken.
  //   · dragstart     → `handleAnswerDragStart` mit demselben Ausstieg (:4268).
  const KA6_ZURUF_IDS = [
    "ka6-zuruf-erstellen",
    "ka6-zuruf-vervollstaendigen",
    "ka6-zuruf-umformulieren",
  ] as const;

  /** Ein Zwischenablage-Behaelter, der den uebergebenen String festhaelt. */
  function ka6Behaelter(): { setData: (typ: string, wert: string) => void; wert: () => string } {
    let gespeichert = "";
    return {
      setData: (_typ: string, wert: string) => {
        gespeichert = wert;
      },
      wert: () => gespeichert,
    };
  }

  /** Ein Ereignis mit Behaelter — `copy`/`cut` tragen `clipboardData`, `dragstart` `dataTransfer`. */
  function ka6Ereignis(typ: "copy" | "cut" | "dragstart"): {
    ereignis: Event;
    wert: () => string;
    verhindert: () => boolean;
  } {
    const behaelter = ka6Behaelter();
    let verhindert = false;
    const ereignis = new umgebung.window.Event(typ, {
      bubbles: true,
      cancelable: true,
    }) as Event & {
      clipboardData?: unknown;
      dataTransfer?: unknown;
      preventDefault: () => void;
    };
    if (typ === "dragstart") {
      (ereignis as { dataTransfer?: unknown }).dataTransfer = behaelter;
    } else {
      (ereignis as { clipboardData?: unknown }).clipboardData = behaelter;
    }
    ereignis.preventDefault = () => {
      verhindert = true;
    };
    return { ereignis, wert: behaelter.wert, verhindert: () => verhindert };
  }

  /** Holt einen Vorschlag ueber den genannten Zuruf und prueft, dass er wirklich im Feld steht. */
  async function ka6VorschlagHolen(zurufId: string): Promise<void> {
    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El(zurufId).click();
    await ka6Leerlauf(20);
    expect(
      ka6El("ask-answer-edit").value,
      `${zurufId}: kein Vorschlag im Feld — alles Weitere misst ins Leere`,
    ).toContain(KA6_ANTWORTTEXT);
  }

  it("PFLICHT 1: alle VIER Uebernahmewege tragen die Herkunft — fuer ALLE DREI Zurufe", async () => {
    const herkunft = ka6Wortlaut("ka6Herkunft");
    const verified = ka6Wortlaut("askEvidenceVerified");
    const unverified = ka6Wortlaut("askEvidenceUnverified");
    // ============================================================================================
    // DIE INVARIANTE, PRAEZISE GEFASST — D3: EINE erlaubte Form, nicht mehr zwei.
    // ============================================================================================
    // D2 hat hier zwei Formen zugelassen: (a) der Weg gibt aus UND traegt die Herkunft, oder
    // (b) der Weg ist geschlossen. Form (b) hat BEN gestrichen, und zwar mit einer Begruendung,
    // die ueber diesen einen Knopf hinausgeht: „Ein geschlossener, ausgelassener oder nicht
    // ausgeloester beauftragter Weg zaehlt NICHT als Invariante." Eine Zusage, die man auch
    // dadurch erfuellen kann, dass man den Weg zumauert, misst am Ende nur noch die eigene
    // Zumauerung — sie wird gruen, waehrend das Versprechen („der Vorschlag laesst sich
    // uebernehmen, und zwar gekennzeichnet") kleiner wird statt eingeloest.
    //
    // Ab hier gilt deshalb fuer JEDE Zelle dasselbe: der Weg ist offen, er uebertraegt, und der
    // uebertragene String traegt Koerper UND Herkunft. `gesperrt` wird weiter GEMESSEN — aber
    // nicht mehr als Ausnahme verrechnet, sondern als Fehlschlag. Genau das macht die
    // Sperr-Gegenmutation (Lieferung 5) sichtbar: ein `disabled` gesetzter Kopierknopf faellt
    // hier durch, statt sich als erfuellte Form (b) auszugeben.
    const matrix: Array<{ zuruf: string; weg: string; text: string; gesperrt: boolean }> = [];

    for (const zurufId of KA6_ZURUF_IDS) {
      // WEG 1 — der Einfuegeklick.
      await ladeKa6Fenster(ka6Erlaubt());
      await ka6VorschlagHolen(zurufId);
      ka6El("ka6-insert-btn").click();
      await ka6Leerlauf(20);
      matrix.push({
        zuruf: zurufId,
        weg: "einfuegeklick",
        text: ka6Eingefuegt.at(-1) ?? "",
        gesperrt: false,
      });

      // ==========================================================================================
      // WEG 2 — DER KOPIERKNOPF. D3: er ist ein VERPFLICHTEND FUNKTIONSFAEHIGER Uebernahmeweg.
      // ==========================================================================================
      // D2 hat diese Zelle als „gesperrt" gemeldet und das als erfuellte Zusage gewertet: ueber
      // einen geschlossenen Ausgang koenne nichts Ungekennzeichnetes hinaus. BEN hat das mit ROT
      // beantwortet und den Massstab woertlich gesetzt: „`disabled`, ‚gesperrt' oder ‚liefert
      // nichts' erfuellt die Abnahme nicht; nach jedem der drei erfolgreichen Zurufe muss er
      // aktiviert sein." Der Grund ist inhaltlich und nicht formal — ein Anwender, der auf
      // „Kopieren" drueckt und nichts bekommt, sucht sich den naechsten Weg (markieren, ziehen,
      // Kontextmenue), und ein zugemauerter Ausgang erzieht zu genau den Umwegen, die diese
      // Invariante eigentlich absichern soll.
      //
      // GEMESSEN WIRD IN DIESER REIHENFOLGE, und die erste Messung ist die neue:
      //   1. Ist der Knopf VOR dem Klick aktiviert? (`disabled === false`)
      //   2. Was hat er tatsaechlich uebertragen?
      // Er hat ZWEI Behaelter, je nach Host: die echte Zwischenablage
      // (`navigator.clipboard.writeText`) oder — wenn die fehlt — das abgeleitete Rueckfallfeld
      // (taskpane.html:4175). Gemessen werden beide; welcher greift, entscheidet die Umgebung,
      // nicht der Test. Der Spion belegt zugleich, dass ueberhaupt etwas uebertragen wurde.
      await ladeKa6Fenster(ka6Erlaubt());
      await ka6VorschlagHolen(zurufId);
      const kopiert: string[] = [];
      Object.defineProperty(umgebung.window.navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (t: string) => {
            kopiert.push(t);
            return Promise.resolve();
          },
        },
      });
      // Der Sperrzustand wird VOR dem Klick abgelesen. Danach waere die Messung wertlos: ein
      // gesperrter Knopf laesst den Rueckruf gar nicht erst laufen, und „nichts uebertragen"
      // saehe dann aus wie ein Bauer, der schweigt, statt wie ein Ausgang, der zu ist.
      const kopierknopfGesperrt = ka6El("ask-copy-btn").disabled === true;
      ka6El("ask-copy-btn").click();
      await ka6Leerlauf(20);
      const ausFallback = ka6El("ask-copy-fallback-text").value ?? "";
      matrix.push({
        zuruf: zurufId,
        weg: "kopierknopf",
        text: kopiert.at(-1) ?? ausFallback,
        gesperrt: kopierknopfGesperrt,
      });

      // WEG 3 und 4 — die nativen Ereignisse am Feld selbst.
      for (const typ of ["copy", "cut", "dragstart"] as const) {
        await ladeKa6Fenster(ka6Erlaubt());
        await ka6VorschlagHolen(zurufId);
        const feld = ka6El("ask-answer-edit");
        // Vollauswahl: eine Teilauswahl bleibt bewusst roh (mega36 B2) und ist nicht dieser Fall.
        feld.selectionStart = 0;
        feld.selectionEnd = (feld.value ?? "").length;
        const { ereignis, wert } = ka6Ereignis(typ);
        feld.dispatchEvent(ereignis);
        await ka6Leerlauf(5);
        // Native Ereignisse kennen kein „gesperrt": sie feuern immer, wenn das Feld bedienbar ist.
        matrix.push({ zuruf: zurufId, weg: typ, text: wert(), gesperrt: false });
      }
    }

    // ZUR ZAEHLUNG, damit sie niemand nachrechnen muss: BEN nennt VIER Wege und fasst dabei
    // `copy`/`cut` als einen zusammen („Klick-Einfuegen, Kopieren, Ausschneiden und Ziehen" —
    // der Kopierknopf steht bei ihm unter „Kopieren"). Gemessen werden hier FUENF Ereignisfaelle,
    // weil `copy` und `cut` im Produkt zwar denselben Rueckruf teilen, aber zwei verschiedene
    // Ereignisse sind — und `cut` zusaetzlich das Feld veraendert. Fuenf × drei Zurufe = 15.
    // Das ist mehr als die Mindestforderung, nicht weniger; keine der vier Nennungen fehlt.
    expect(matrix, `Die Matrix ist unvollstaendig: ${matrix.length} Zellen`).toHaveLength(15);
    for (const weg of ["einfuegeklick", "kopierknopf", "copy", "cut", "dragstart"]) {
      expect(
        matrix.filter((z) => z.weg === weg),
        `Weg ${weg} ist nicht fuer alle drei Zurufe gemessen`,
      ).toHaveLength(3);
    }
    for (const zelle of matrix) {
      const wo = `${zelle.zuruf} / ${zelle.weg}`;
      // D3, Lieferung 1 und 5: KEINE Ausnahme mehr fuer geschlossene Wege. Diese Zeile ist die,
      // an der ein gesperrter Kopierknopf scheitert — sie steht VOR der Textpruefung, damit die
      // Meldung die Ursache nennt („gesperrt") und nicht nur ihre Folge („nichts uebertragen").
      expect(
        zelle.gesperrt,
        `${wo}: der Weg war gesperrt — ein geschlossener Weg zaehlt nicht als Invariante`,
      ).toBe(false);
      // Der Weg ist offen — er traegt den Koerper UND die Herkunft.
      expect(zelle.text.length, `${wo}: es wurde ueberhaupt nichts uebertragen`).toBeGreaterThan(0);
      expect(zelle.text, `${wo}: der Antwortkoerper fehlt`).toContain(KA6_ANTWORTTEXT);
      expect(zelle.text, `${wo}: die Herkunft „KI-formuliert" fehlt`).toContain(herkunft);
      // Und die drei Klassen bleiben unterscheidbar — keine Bestandsklasse steht daneben.
      expect(zelle.text, `${wo}: traegt zusaetzlich „gesichert"`).not.toContain(verified);
      expect(zelle.text, `${wo}: traegt zusaetzlich „ungeprueft"`).not.toContain(unverified);
    }
    // ============================================================================================
    // D3 · DIE KALIBRIERUNG DES NEUEN „AKTIVIERT" — drei Lagen, damit die Zusage etwas bedeutet.
    // ============================================================================================
    // „Der Kopierknopf ist nach dem Zuruf aktiviert" waere eine leere Aussage, wenn er IMMER offen
    // waere. Ein hart auf `disabled = false` gestellter Knopf erfuellte die Matrix oben und
    // oeffnete zugleich einen Ausgang fuer ein leeres oder fremdes Feld. Deshalb wird hier beides
    // gemessen: dass er im Ausgangszustand ZU ist, dass der Bestandsweg ihn weiterhin oeffnet,
    // und dass der KA6-Zuruf ihn oeffnet.
    await ladeKa6Fenster(ka6Erlaubt());
    // (1) Frisches Fenster, kein Vorschlag, keine Antwort — der Knopf ist GESPERRT.
    expect(
      ka6El("ask-copy-btn").disabled,
      'Der Kopierknopf steht schon ohne jeden Vorschlag offen — dann sagt „aktiviert" nichts aus',
    ).toBe(true);
    // (2) Der BESTANDSWEG oeffnet ihn unveraendert. Das ist zugleich der Beleg, dass D3 die
    //     Ask-Verdrahtung (`updateInsertState`) nicht ersetzt, sondern nur ergaenzt hat.
    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ask-btn").click();
    await ka6Leerlauf(30);
    expect(
      ka6El("ask-copy-btn").disabled,
      "Der Kopierknopf bleibt nach einer echten Ask-Antwort gesperrt — der Bestandsweg wurde beschaedigt",
    ).toBe(false);
    // (3) Und der KA6-Zuruf oeffnet ihn ebenfalls — an einem Fenster, das ihn zuvor zu hatte.
    await ladeKa6Fenster(ka6Erlaubt());
    expect(ka6El("ask-copy-btn").disabled, "Vorbedingung verletzt: schon vor dem Zuruf offen").toBe(
      true,
    );
    await ka6VorschlagHolen("ka6-zuruf-erstellen");
    expect(
      ka6El("ask-copy-btn").disabled,
      "Der KA6-Zuruf hat den Kopierknopf nicht aktiviert",
    ).toBe(false);
  });

  it("PFLICHT 1 (Gegenprobe): die nativen Wege brechen den Host-Standard ab, statt roh hinauszulassen", async () => {
    // Ohne diesen Fall koennte ein Weg den richtigen String in den Behaelter legen UND daneben den
    // Host seinen eigenen, rohen Ziehvorgang fortsetzen lassen. Dann stuende die Herkunft im
    // Behaelter und der rohe Koerper im Dokument.
    for (const typ of ["copy", "cut", "dragstart"] as const) {
      await ladeKa6Fenster(ka6Erlaubt());
      await ka6VorschlagHolen("ka6-zuruf-erstellen");
      const feld = ka6El("ask-answer-edit");
      feld.selectionStart = 0;
      feld.selectionEnd = (feld.value ?? "").length;
      const { ereignis, verhindert } = ka6Ereignis(typ);
      feld.dispatchEvent(ereignis);
      await ka6Leerlauf(5);
      expect(verhindert(), `${typ}: der Host-Standard wurde nicht abgebrochen`).toBe(true);
    }
  });

  // ==============================================================================================
  // JOB 1153 D2 · PFLICHT 3 — DIE ZUSTANDSUEBERGAENGE IM GEMEINSAMEN FELD.
  // ==============================================================================================
  //
  // Ask und KA6 teilen sich `#ask-answer-edit`. Bleibt beim Wechsel ein Rest der einen Quelle
  // stehen, traegt die andere eine fremde Herkunft — in beide Richtungen gleich schlimm.
  it("PFLICHT 3a: Ask → KA6 — der KA6-Vorschlag traegt KA6-Herkunft, kein Ask-Rest", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    // Zuerst der ECHTE Ask-Weg.
    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ask-btn").click();
    await ka6Leerlauf(30);
    expect(ka6El("ask-answer-edit").value, "Der Ask-Weg hat gar nicht geantwortet").toContain(
      KA6_ANTWORTTEXT,
    );

    // Danach der KA6-Zuruf im selben Feld.
    await ka6VorschlagHolen("ka6-zuruf-umformulieren");
    ka6El("ka6-insert-btn").click();
    await ka6Leerlauf(20);

    const ausgegeben = ka6Eingefuegt.at(-1) ?? "";
    expect(ausgegeben, "Nach Ask → KA6 fehlt die KA6-Herkunft").toContain(
      ka6Wortlaut("ka6Herkunft"),
    );
    expect(ausgegeben, "Ein Ask-Rest steht noch im KA6-Vorschlag").not.toContain(
      ka6Wortlaut("askEvidenceVerified"),
    );
    expect(ausgegeben).not.toContain(ka6Wortlaut("askEvidenceUnverified"));
  });

  it("PFLICHT 3b: KA6 → Ask — die Ask-Antwort traegt KEINE KA6-Herkunft mehr", async () => {
    await ladeKa6Fenster(ka6Erlaubt());

    // Zuerst KA6 …
    await ka6VorschlagHolen("ka6-zuruf-erstellen");
    // … danach der echte Ask-Weg im selben Feld.
    ka6El("ask-input").value = "Wartungsablauf fuer Linie 3";
    ka6El("ask-btn").click();
    await ka6Leerlauf(30);

    // Der Ask-Weg gibt ueber seinen eigenen Knopf aus — der ist erst nach der Quellenaufloesung frei.
    expect(ka6El("ask-insert-btn").disabled, "Der Ask-Knopf blieb gesperrt").toBe(false);
    ka6El("ask-insert-btn").click();
    await ka6Leerlauf(20);

    const ausgegeben = ka6Eingefuegt.at(-1) ?? "";
    expect(ausgegeben, "Der Ask-Weg gab gar nichts aus").toContain(KA6_ANTWORTTEXT);
    expect(
      ausgegeben,
      "Die KA6-Herkunft klebt noch an einer Ask-Antwort — ein Rest der Vorquelle",
    ).not.toContain(ka6Wortlaut("ka6Herkunft"));
  });

  // ==============================================================================================
  // JOB 1153 D2 · PRUEFLUECKE 6.4 aus dem D1-Urteil — der unbekannte Sperrgrund.
  // ==============================================================================================
  it("PRUEFLUECKE 6.4: ein unbekannter `blockedReason` wird im Klartext genannt, kein Zuruf", async () => {
    await ladeKa6Fenster(
      ka6Erlaubt({
        executionAllowed: false,
        blockedReason: "irgendein_neuer_grund",
        effectiveMode: "external",
      }),
    );

    const gezeigt = ka6El("ka6-hinweis").textContent ?? "";
    expect(gezeigt.length, "Der Grund wird verschwiegen").toBeGreaterThan(0);
    // Der konkrete Grund steht drin — nicht bloss ein Sammelsatz.
    expect(gezeigt, "Der genannte Grund fehlt im Klartext").toContain("irgendein_neuer_grund");
    expect(ka6Sichtbar("ka6-zurufe"), "Zurufe werden trotz unbekannter Sperre angeboten").toBe(
      false,
    );
  });
});
