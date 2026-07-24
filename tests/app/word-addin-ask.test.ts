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
  WORD_ADDIN_TITLE_MAX,
  askLocale,
  buildAnswerInsertText,
  buildAskSourceLine,
  canInsertAnswer,
  formatAskDateLabel,
  newestSourceDateLabel,
  openQuestionDraftTitle,
  performAsk,
  prepareAskQuestion,
  stripAskAnswerMarkdown,
} from "../../apps/web/src/lib/wordAddin";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function fakeRes(status: number, body: unknown): AskFetchResponseLike {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
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

  it("askLocale: Server kennt de/en — NL-Oberflaeche fragt auf Deutsch", () => {
    expect(askLocale("de")).toBe("de");
    expect(askLocale("en")).toBe("en");
    expect(askLocale("nl")).toBe("de");
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
    expect(outcome).toEqual({
      kind: "answered",
      answer: "Ventil vor der Wartung entlasten und den Druck pruefen.",
      sources: ["ko-1", "ko-2"],
      trust: 62,
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

  it("401/403 → kind auth (Login-Hinweis im Panel)", async () => {
    for (const status of [401, 403]) {
      const outcome = await performAsk(
        "Frage",
        "de",
        async () => fakeRes(status, { error: "X" }),
        WORD_ADDIN_ASK_TIMEOUT_MS,
      );
      expect(outcome).toEqual({ kind: "auth" });
    }
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
      `${block}; return { prepareAskQuestion: prepareAskQuestion, askLocale: askLocale, performAsk: performAsk, canInsertAnswer: canInsertAnswer, buildAskSourceLine: buildAskSourceLine, buildAnswerInsertText: buildAnswerInsertText, formatAskDateLabel: formatAskDateLabel, newestSourceDateLabel: newestSourceDateLabel, openQuestionDraftTitle: openQuestionDraftTitle, stripAskAnswerMarkdown: stripAskAnswerMarkdown, WORD_ADDIN_ASK_MAX_CHARS: WORD_ADDIN_ASK_MAX_CHARS, WORD_ADDIN_ASK_TIMEOUT_MS: WORD_ADDIN_ASK_TIMEOUT_MS };`,
    );
    const inline = factory() as {
      prepareAskQuestion: typeof prepareAskQuestion;
      askLocale: typeof askLocale;
      performAsk: typeof performAsk;
      canInsertAnswer: typeof canInsertAnswer;
      buildAskSourceLine: typeof buildAskSourceLine;
      buildAnswerInsertText: typeof buildAnswerInsertText;
      formatAskDateLabel: typeof formatAskDateLabel;
      newestSourceDateLabel: typeof newestSourceDateLabel;
      openQuestionDraftTitle: typeof openQuestionDraftTitle;
      stripAskAnswerMarkdown: typeof stripAskAnswerMarkdown;
      WORD_ADDIN_ASK_MAX_CHARS: number;
      WORD_ADDIN_ASK_TIMEOUT_MS: number;
    };
    expect(inline.WORD_ADDIN_ASK_MAX_CHARS).toBe(WORD_ADDIN_ASK_MAX_CHARS);
    expect(inline.WORD_ADDIN_ASK_TIMEOUT_MS).toBe(WORD_ADDIN_ASK_TIMEOUT_MS);
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
    expect(html).toContain("var text = getEditedAnswerText();");
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
    // Quellen-Zeile aus aufgeloesten Titeln + Stand-Datum; die Vorbefuellung beginnt mit dem Wissen.
    expect(html).toContain("buildAskSourceLine(");
    expect(html).toContain("buildAnswerInsertText(currentAskOutcome.answer, line, truncatedNote)");
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
  it("Teil B: editierbares Feld (vorbefuellt), Einfuegen nutzt den bearbeiteten Text, Kopieren-Ausweg, kompakt", () => {
    // Editierbares Textfeld statt statischem Absatz; vorbefuellt mit der Antwort, dann Quellen-Zeile.
    expect(html).toContain('<textarea id="ask-answer-edit"');
    expect(html).toContain('document.getElementById("ask-answer-edit").value = outcome.answer;');
    expect(html).toContain("var full = buildDefaultInsertText();");
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
    expect(html).toContain("hoehere");
    expect(html).toContain("Kopieren");
  });

  it("Inline-Skript bleibt syntaktisch gueltig (node-parsebar, buildlos)", () => {
    const match = /<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/.exec(html);
    expect(match).not.toBeNull();
    // new Function parst das komplette Skript — wirft bei Syntaxfehlern (entspricht node --check).
    expect(() => new Function(match?.[1] ?? "")).not.toThrow();
  });
});
