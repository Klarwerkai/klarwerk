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
import { describe, expect, it } from "vitest";
import {
  type AskFetchFn,
  type AskFetchInit,
  type AskFetchResponseLike,
  type AskOutcome,
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

describe("WP-KLARA-ASK Teil 1: Frage-Vorbereitung (Auswahl vor Eingabefeld, ehrliche Kappung)", () => {
  it("Word-Auswahl hat Vorrang; leere Auswahl → Eingabefeld; beides leer → empty", () => {
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

  it("kappt riesige Word-Auswahlen bei der Konstante (2000) und meldet es ehrlich", () => {
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
      prepareAskQuestion: typeof prepareAskQuestion;
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
    const questionFixtures: [string, string][] = [
      ["Auswahl", "Manuell"],
      ["   ", "Freie Frage?"],
      ["", ""],
      ["x".repeat(WORD_ADDIN_ASK_MAX_CHARS + 99), ""],
      ["\n  Mehrzeilige\nAuswahl  ", ""],
    ];
    for (const [sel, manual] of questionFixtures) {
      expect(inline.prepareAskQuestion(sel, manual), `prep:${sel.slice(0, 12)}`).toEqual(
        prepareAskQuestion(sel, manual),
      );
    }
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

  it("Teil 1: Ask-Bereich nutzt den BESTEHENDEN Vertrag — /api/ask via performAsk, Auswahl als Frage, Eingabefeld-Fallback", () => {
    // Der Fetch laeuft ausschliesslich durch performAsk (Spiegel-Helfer) — Same-Origin-Session.
    expect(html).toContain("performAsk(");
    expect(html).toContain('"/api/ask"');
    // Auswahl (nur Text) vor Eingabefeld; ohne Office ehrlich leer → freies Fragen.
    expect(html).toContain("readAskSelection(function (selectionText)");
    expect(html).toContain(
      'prepareAskQuestion(selectionText, document.getElementById("ask-input").value)',
    );
    // Serverseitige Permission dokumentiert (ko.read — exakt die Fragen-Konsole).
    expect(html).toContain("ko.read");
    // Ehrliche Zustaende: leer / busy / auth / timeout / error.
    for (const marker of [
      't("askEmpty")',
      't("askBusy")',
      't("askAuth")',
      't("askTimeout")',
      't("askError"',
    ]) {
      expect(html).toContain(marker);
    }
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
    // Wissensluecke: BESTEHENDER Draft-Weg (origin frontdoor) + lokalisierte Titel-Konvention +
    // Deep-Link. WP-KLARA-ASK-FIX (bens Fix 4): gap-only-Gate, Knopf-Sperre, 403 als fehlendes
    // Recht, voller Fragetext im Draft-Body (kein Verlust durch die 500-Zeichen-Statement-Kappung).
    const gapSend = html.indexOf("function sendOpenQuestion()");
    const gapBlock = html.slice(gapSend, gapSend + 2600);
    expect(gapBlock).toContain('currentAskOutcome.kind !== "gap"');
    expect(gapBlock).toContain("gapBtn.disabled = true");
    expect(gapBlock).toContain('showAskStatus("warn", t("askForbidden"))');
    expect(gapBlock).toContain("bodyHtml: selectionToBodyHtml(currentAskQuestion)");
    expect(gapBlock).toContain('t("askOpenQuestionPrefix")');
    expect(gapBlock).toContain('origin: "frontdoor"');
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
      'askHint: "',
      'askInputPlaceholder: "',
      'askCta: "',
      'askEmpty: "',
      'askBusy: "',
      'askTruncated: "',
      'askAuth: "',
      'askTimeout: "',
      'askError: "',
      'askAnswerTitle: "',
      'askSourcesTitle: "',
      'askTrust: "',
      'askGapTitle: "',
      'askGapBody: "',
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
    // Die Gap-Karte traegt dieselbe ehrliche Kernaussage wie die Konsole (Keine belastbare Grundlage).
    expect(html).toContain('askGapTitle: "Keine belastbare Grundlage."');
    expect(html).toContain('askGapTitle: "No reliable basis."');
    expect(html).toContain('askGapTitle: "Geen betrouwbare basis."');
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
