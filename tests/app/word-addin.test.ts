// @vitest-environment jsdom
// WP-KLARA-1 (Klara in Word): Node-/jsdom-Tests für den ersten Add-in-Schritt. Getestet: die reinen
// Hilfslogiken (Titel-Ableitung, Absatz-Escaping) im DOM-freien Modul, die VERHALTENS-Äquivalenz der
// Inline-Kopie in taskpane.html (Marker-Block wird extrahiert und ausgeführt — kein Text-Diff, echte
// Gleichheit auf Fixtures), die Wohlgeformtheit des Manifest-XML (jsdom-DOMParser) und die Pfad-/
// CSP-Verdrahtung (public/word-addin, gezielte Server-Ausnahme NUR für /word-addin/*).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveStatus } from "../../apps/web/src/lib/displayStatus";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import {
  type InsertAttempt,
  WORD_ADDIN_ANSWER_COMPACT_CHARS,
  WORD_ADDIN_ANSWER_COMPACT_LINES,
  WORD_ADDIN_BODY_BUDGET_BYTES,
  WORD_ADDIN_FALLBACK_TITLE,
  WORD_ADDIN_LOGIN_POLL_MAX_MS,
  answerIsLong,
  askSourceStatus,
  classifyDraftResponse,
  classifyInsertError,
  countUndeliveredWordImages,
  deriveDraftTitleFromSelection,
  draftPostPayload,
  draftWasCreated,
  extractWordBodyHtml,
  koDetailUrl,
  loginPollDecision,
  loginPollStep,
  performCopy,
  performInsert,
  prepareWordDraftRequest,
  selectionToBodyHtml,
  wordHtmlToPlainText,
  wordHtmlUtf8Bytes,
} from "../../apps/web/src/lib/wordAddin";
// KA1 (JOB 1149): die KANONISCHEN Suchregeln des Hauses. Das Taskpane ist buildlos und muss sie
// spiegeln; genau deshalb werden sie hier importiert und die Spiegelfassung gegen sie gemessen.
import { normalizeSearchFragment, normalizeSearchTerms } from "../../services/knowledge-object";
import { queryTokens } from "../../services/reasoner";
import { type KlaraPanel, createKlaraPanel, reply } from "./klara-panel-fixture";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Der Gate-tsc läuft ohne DOM-lib — den jsdom-DOMParser über einen schmalen Struktur-Typ abgreifen
// (gleiches Muster wie editor-figure-caption.test.ts).
interface XmlElementLike {
  textContent: string | null;
  getAttribute(name: string): string | null;
}
interface XmlDocLike {
  getElementsByTagName(tag: string): ArrayLike<XmlElementLike> & Iterable<XmlElementLike>;
}
const { DOMParser: XmlParser } = globalThis as unknown as {
  DOMParser: new () => { parseFromString(source: string, mime: string): XmlDocLike };
};

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const MANIFEST = "docs/word-addin/klara-manifest.xml";

describe("WP-KLARA-1: Hilfslogik (DOM-freies Modul)", () => {
  it("leitet den Titel aus der ersten nicht-leeren Zeile ab, kappt auf 60 Zeichen", () => {
    expect(deriveDraftTitleFromSelection("\n\n  Ventil entlasten vor Wartung  \nRest")).toBe(
      "Ventil entlasten vor Wartung",
    );
    const long = "X".repeat(80);
    expect(deriveDraftTitleFromSelection(long).length).toBe(60);
    // Ohne brauchbare Zeile → ehrlicher Standardtitel (nie leer).
    expect(deriveDraftTitleFromSelection("   \n \n")).toBe(WORD_ADDIN_FALLBACK_TITLE);
  });

  it("baut je Zeile ein escaptes <p>; leere Selektion → leerer String", () => {
    expect(selectionToBodyHtml("Zeile 1\nZeile <b>2</b> & mehr\n\n")).toBe(
      "<p>Zeile 1</p><p>Zeile &lt;b&gt;2&lt;/b&gt; &amp; mehr</p>",
    );
    expect(selectionToBodyHtml("")).toBe("");
    expect(selectionToBodyHtml("  \n  ")).toBe("");
  });

  // WP-KLARA-1c: pure Anmelde-Warte-Entscheidung — Session da → fertig; Frist (5 Min) → Timeout;
  // sonst weiter pollen. Angemeldet gewinnt IMMER (auch nach der Frist — nie Erfolg verwerfen).
  it("loginPollDecision: done/timeout/poll deterministisch", () => {
    expect(loginPollDecision(0, false)).toBe("poll");
    expect(loginPollDecision(WORD_ADDIN_LOGIN_POLL_MAX_MS - 1, false)).toBe("poll");
    expect(loginPollDecision(WORD_ADDIN_LOGIN_POLL_MAX_MS, false)).toBe("timeout");
    expect(loginPollDecision(0, true)).toBe("done");
    expect(loginPollDecision(WORD_ADDIN_LOGIN_POLL_MAX_MS + 1, true)).toBe("done");
  });

  // WP-IC-PAKET-1c (bens ROT-1d): Schritt-Entscheidung mit GENERATION-Guard — eine veraltete
  // Generation (Abbrechen/Neustart) endet IMMER still, egal was der Fetch ergab (auch bei Erfolg:
  // kein später Zustands-Überschreiber eines abgebrochenen Laufs).
  it("loginPollStep: stale schlägt ALLES; sonst done/timeout/schedule", () => {
    expect(loginPollStep(1, 2, 0, true)).toBe("stale");
    expect(loginPollStep(1, 2, WORD_ADDIN_LOGIN_POLL_MAX_MS + 1, false)).toBe("stale");
    expect(loginPollStep(2, 2, 0, true)).toBe("done");
    expect(loginPollStep(2, 2, WORD_ADDIN_LOGIN_POLL_MAX_MS, false)).toBe("timeout");
    expect(loginPollStep(2, 2, 100, false)).toBe("schedule");
  });
});

// WP-KLARA-2 (Pedis Befund 2+3): Word-HTML → Draft-Body. Der Client schneidet nur den body-Inhalt
// heraus und entscheidet Budget/Fallback; die autoritative Säuberung macht der Server-Sanitizer.
describe("WP-KLARA-2: Word-HTML-Aufbereitung (DOM-freies Modul)", () => {
  const WORD_DOC =
    '<html><head><style>p{mso-style:x}</style></head><body class="WordSection1"><h1>Titel</h1><p><span style="mso-bidi">Text</span></p></body></html>';

  it("Budget-Spiegel: WORD_ADDIN_BODY_BUDGET_BYTES ist EXAKT MAX_INLINE_BODY_HTML_BYTES", () => {
    expect(WORD_ADDIN_BODY_BUDGET_BYTES).toBe(MAX_INLINE_BODY_HTML_BYTES);
  });

  it("extractWordBodyHtml: schneidet den body-Inhalt; Fragmente ohne body bleiben roh", () => {
    expect(extractWordBodyHtml(WORD_DOC)).toBe(
      '<h1>Titel</h1><p><span style="mso-bidi">Text</span></p>',
    );
    expect(extractWordBodyHtml("<p>Fragment</p>")).toBe("<p>Fragment</p>");
    expect(extractWordBodyHtml("   ")).toBe("");
  });

  it("countUndeliveredWordImages: zählt Bilder OHNE sichere data:image-Quelle (ehrliche Bilanz, kein Fake)", () => {
    const html =
      '<p><img src="data:image/png;base64,QQ=="><img src="cid:img1"><img alt="ohne src"><img src="https://extern/x.png"></p>';
    expect(countUndeliveredWordImages(html)).toBe(3); // cid:, ohne src, extern — nur data:image zählt als geliefert
    expect(countUndeliveredWordImages("<p>ohne Bilder</p>")).toBe(0);
  });

  // WP-SHIP8-FINAL (bens Bedingung 4): die Entscheidungsstelle baut den FINALEN POST-Payload —
  // das Budget misst DIESEN String (Envelope inkl. Escaping), nicht mehr die rohen HTML-Bytes.
  it("prepareWordDraftRequest: HTML im Budget → usedHtml; leeres HTML → Klartext-Fallback (finaler Payload)", () => {
    const withHtml = prepareWordDraftRequest(WORD_DOC, "Titel\nText");
    expect(withHtml.usedHtml).toBe(true);
    expect(withHtml.overBudget).toBe(false);
    const parsed = JSON.parse(withHtml.payload) as Record<string, string>;
    expect(parsed.bodyHtml).toContain("<h1>Titel</h1>"); // roh — h1→h2 mappt der Server-Sanitizer
    expect(parsed.title).toBe("Titel");
    expect(parsed.origin).toBe("word_addin");
    const noHtml = prepareWordDraftRequest("", "Nur Text\nZweite Zeile");
    expect(noHtml.usedHtml).toBe(false);
    expect((JSON.parse(noHtml.payload) as Record<string, string>).bodyHtml).toBe(
      "<p>Nur Text</p><p>Zweite Zeile</p>",
    );
  });

  it("Budget-Grenzfall EXAKT am finalen Payload: knapp drunter bleibt HTML, drueber ehrlicher Klartext-Fallback", () => {
    // Grenze über den ECHTEN finalen Payload ansteuern: erst die Envelope-Bytes messen, dann das
    // HTML exakt so füllen, dass der Gesamt-Payload einmal AM Budget und einmal 1 Byte darüber liegt.
    const text = "t";
    const envelopeBytes = wordHtmlUtf8Bytes(draftPostPayload("t", "t", "<p></p>"));
    const fillAtLimit = WORD_ADDIN_BODY_BUDGET_BYTES - envelopeBytes;
    const atLimit = prepareWordDraftRequest(`<body><p>${"x".repeat(fillAtLimit)}</p></body>`, text);
    expect(wordHtmlUtf8Bytes(atLimit.payload)).toBe(WORD_ADDIN_BODY_BUDGET_BYTES);
    expect(atLimit.usedHtml).toBe(true);
    const over = prepareWordDraftRequest(
      `<body><p>${"x".repeat(fillAtLimit + 1)}</p></body>`,
      text,
    );
    expect(over.overBudget).toBe(true);
    expect(over.usedHtml).toBe(false);
    expect((JSON.parse(over.payload) as Record<string, string>).bodyHtml).toBe("<p>t</p>");
  });

  it("Escaping-Fall: anführungszeichenlastiges HTML kippt über das Budget, obwohl die ROHEN Bytes darunter lägen", () => {
    // Jedes " kostet im JSON-Payload 2 Bytes (\") — der finale Payload ist die ehrliche Messgröße.
    const quoteHeavy = `<p>${'"'.repeat(100)}</p>`;
    const rawBytes = wordHtmlUtf8Bytes(quoteHeavy);
    const payloadBytes =
      wordHtmlUtf8Bytes(draftPostPayload("t", "t", quoteHeavy)) -
      wordHtmlUtf8Bytes(draftPostPayload("t", "t", ""));
    expect(payloadBytes).toBe(rawBytes + 100); // 100 × 1 Byte Escaping-Aufschlag
    // Konstruktion: rohe HTML-Bytes ≤ Budget, finaler Payload > Budget → Fallback greift.
    const envelopeBytes = wordHtmlUtf8Bytes(draftPostPayload("t", "t", ""));
    const quotes = '"'.repeat(Math.ceil((WORD_ADDIN_BODY_BUDGET_BYTES - envelopeBytes) / 2) + 1);
    const html = `<body>${quotes}</body>`;
    expect(wordHtmlUtf8Bytes(quotes)).toBeLessThanOrEqual(WORD_ADDIN_BODY_BUDGET_BYTES);
    const prepared = prepareWordDraftRequest(html, "t");
    expect(prepared.overBudget).toBe(true);
    expect(prepared.usedHtml).toBe(false);
  });

  // WP-SHIP8-FINAL (bens Bedingung 4, EIN Snapshot): Klartext aus dem HTML abgeleitet.
  it("wordHtmlToPlainText: Block-Enden → Zeilen, Tags weg, Entities dekodiert (&amp; zuletzt)", () => {
    expect(wordHtmlToPlainText(WORD_DOC)).toBe("Titel\nText");
    expect(wordHtmlToPlainText("<p>Zeile&nbsp;1&amp;2</p><p>&lt;T&gt; &quot;x&quot;</p>")).toBe(
      'Zeile 1&2\n<T> "x"',
    );
    // &amp;lt; ist die ESCAPTE Zeichenfolge &lt; — sie darf nicht doppelt dekodiert werden.
    expect(wordHtmlToPlainText("<p>&amp;lt;</p>")).toBe("&lt;");
    expect(wordHtmlToPlainText("a<br>b")).toBe("a\nb");
    expect(wordHtmlToPlainText("")).toBe("");
  });
});

// RT-KLARA1 + K2/K3 (AUFTRAG-klara1): ehrliche Einfuege-Fehler-Klassifikation und
// Quellen-Status/-Deep-Link — pure Logik, DOM-frei.
describe("RT-KLARA1/K2/K3: Einfuege-Fehler + Quellen-Status (DOM-freies Modul)", () => {
  it("classifyInsertError: erkennt den Berechtigungsfall (Pedis Live-Fehlertext, DE/EN/NL-Varianten), sonst other", () => {
    // Der exakte Fehlertext aus Pedis Live-Test 23.07.
    expect(classifyInsertError("You don't have sufficient permissions for this action.")).toBe(
      "permission",
    );
    expect(classifyInsertError("AccessDenied Word-API")).toBe("permission");
    expect(classifyInsertError("Keine Berechtigung für diese Aktion.")).toBe("permission");
    expect(classifyInsertError("Geen toestemming voor deze actie.")).toBe("permission");
    // Alles andere bleibt ehrlich "other" — nie ein geratener Grund.
    expect(classifyInsertError("GeneralException")).toBe("other");
    expect(classifyInsertError("")).toBe("other");
  });

  it("askSourceStatus: Bibliotheks-Kern (validiert/pruefung/offen), nicht ladbar → unknown", () => {
    expect(askSourceStatus({ status: "validiert" })).toBe("validiert");
    expect(askSourceStatus({ status: "offen", assignments: ["u1"] })).toBe("pruefung");
    expect(askSourceStatus({ status: "offen", assignments: [] })).toBe("offen");
    expect(askSourceStatus({ status: "offen" })).toBe("offen");
    // Ehrlich "unknown": KO nicht ladbar oder fremder Status — nie raten.
    expect(askSourceStatus(null)).toBe("unknown");
    expect(askSourceStatus({})).toBe("unknown");
    expect(askSourceStatus({ status: "irgendwas" })).toBe("unknown");
  });

  it("askSourceStatus ist auf den aufloesbaren Faellen GLEICH der Bibliotheks-Ableitung deriveStatus", () => {
    const fixtures: { status: "offen" | "validiert"; assignments: string[] }[] = [
      { status: "validiert", assignments: [] },
      { status: "validiert", assignments: ["u1"] },
      { status: "offen", assignments: [] },
      { status: "offen", assignments: ["u1", "u2"] },
    ];
    for (const ko of fixtures) {
      expect(askSourceStatus(ko), `${ko.status}/${ko.assignments.length}`).toBe(deriveStatus(ko));
    }
  });

  it("koDetailUrl: bestehende Route /wissen/:id, Id URL-encodiert", () => {
    expect(koDetailUrl("https://app.klarwerk.ai", "ko-1")).toBe(
      "https://app.klarwerk.ai/wissen/ko-1",
    );
    expect(koDetailUrl("https://app.klarwerk.ai", "a b/c")).toBe(
      "https://app.klarwerk.ai/wissen/a%20b%2Fc",
    );
  });
});

// klara1b (Pedis Live-Befund 24.07.): Teil A (robustes Einfuegen) + Teil B (editierbar, Kopieren,
// kompakt) — reine, DOM-/Office-freie Logik. Die konkreten Office-/Clipboard-Aufrufe reicht der
// Aufrufer als injizierte Funktionen (wie performAsk mit fetchFn) → hier mit Fakes gepinnt.
describe("klara1b Teil A/B: robustes Einfuegen + Kopieren + kompakte Antwort (DOM-freies Modul)", () => {
  it("performInsert: erster Erfolg gewinnt, uebergibt den (bearbeiteten) Text, meldet die Methode", async () => {
    const seen: string[] = [];
    const ok: InsertAttempt = {
      method: "word-run",
      run: async (text) => {
        seen.push(text);
      },
    };
    const outcome = await performInsert("BEARBEITETER Text", [ok]);
    expect(outcome).toEqual({ ok: true, method: "word-run" });
    // Der Spy bekommt GENAU den (bearbeiteten) Feldinhalt.
    expect(seen).toEqual(["BEARBEITETER Text"]);
  });

  it("performInsert: Word.run-Fehler → Fallback setSelectedDataAsync (beide bekommen den Text)", async () => {
    const seen: string[] = [];
    const wordRun: InsertAttempt = {
      method: "word-run",
      run: async () => {
        throw new Error("GeneralException");
      },
    };
    const setData: InsertAttempt = {
      method: "set-selected-data",
      run: async (text) => {
        seen.push(text);
      },
    };
    const outcome = await performInsert("Antwort", [wordRun, setData]);
    expect(outcome).toEqual({ ok: true, method: "set-selected-data" });
    expect(seen).toEqual(["Antwort"]);
  });

  it("performInsert: alle Versuche scheitern am Recht → failure permission (Pedis Live-Fehlertext)", async () => {
    const permFail = (method: InsertAttempt["method"]): InsertAttempt => ({
      method,
      run: async () => {
        throw new Error("You don't have sufficient permissions for this action.");
      },
    });
    const outcome = await performInsert("Antwort", [
      permFail("word-run"),
      permFail("set-selected-data"),
    ]);
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("permission");
    expect(outcome.detail).toContain("sufficient permissions");
  });

  it("performInsert: nicht-berechtigungs-Fehler → failure other mit konkretem Detail (nie geraten)", async () => {
    const outcome = await performInsert("Antwort", [
      {
        method: "word-run",
        run: async () => {
          throw new Error("GeneralException 5001");
        },
      },
    ]);
    expect(outcome.ok).toBe(false);
    expect(outcome.failure).toBe("other");
    expect(outcome.detail).toBe("GeneralException 5001");
  });

  it("performCopy: legt den Feldinhalt in die (gemockte) Zwischenablage; ohne API ehrlich ok=false", async () => {
    const written: string[] = [];
    const clip = { writeText: async (t: string) => void written.push(t) };
    expect(await performCopy("Kopier mich", clip)).toEqual({ ok: true });
    expect(written).toEqual(["Kopier mich"]);
    // Kein Clipboard (unsicherer Kontext) → ehrlich ok=false, der Aufrufer nennt den manuellen Ausweg.
    expect(await performCopy("x", null)).toEqual({ ok: false, detail: "no-clipboard" });
    const rejecting = { writeText: async () => Promise.reject(new Error("NotAllowedError")) };
    expect(await performCopy("x", rejecting)).toEqual({ ok: false, detail: "NotAllowedError" });
  });

  it("answerIsLong: kompakt bei kurzer Antwort, lang ab Zeichen- ODER Zeilen-Deckel", () => {
    expect(WORD_ADDIN_ANSWER_COMPACT_CHARS).toBe(320);
    expect(WORD_ADDIN_ANSWER_COMPACT_LINES).toBe(6);
    expect(answerIsLong("Eine knappe Kernaussage.")).toBe(false);
    expect(answerIsLong("x".repeat(WORD_ADDIN_ANSWER_COMPACT_CHARS))).toBe(false);
    expect(answerIsLong("x".repeat(WORD_ADDIN_ANSWER_COMPACT_CHARS + 1))).toBe(true);
    // 7 nicht-leere Zeilen (> 6) → lang; 6 → kompakt.
    const sixLines = Array.from({ length: 6 }, (_v, i) => `Zeile ${i}`).join("\n");
    const sevenLines = Array.from({ length: 7 }, (_v, i) => `Zeile ${i}`).join("\n");
    expect(answerIsLong(sixLines)).toBe(false);
    expect(answerIsLong(sevenLines)).toBe(true);
    expect(answerIsLong("")).toBe(false);
  });
});

// AUFTRAG-JOB507-D4: die Antwort des Draft-POSTs wird KLASSIFIZIERT statt an drei Stellen erraten.
// Die Zusage ist bewusst fail-closed: NUR das dokumentierte 201 der Route
// (services/app/src/routes/capture-routes.ts) gilt als angelegter Entwurf; jede andere Antwort ist
// Create-0. Damit kann kein neuer Statuscode versehentlich als Erfolg durchrutschen.
describe("AUFTRAG-JOB507-D4: Draft-Antwortklassen (DOM-freies Modul)", () => {
  it("classifyDraftResponse: 201 created, 401 auth, 403 forbidden, 413 too-large, 429 rate-limited, sonst error", () => {
    expect(classifyDraftResponse(201)).toBe("created");
    expect(classifyDraftResponse(401)).toBe("auth");
    expect(classifyDraftResponse(403)).toBe("forbidden");
    expect(classifyDraftResponse(413)).toBe("too-large");
    expect(classifyDraftResponse(429)).toBe("rate-limited");
    for (const status of [200, 202, 204, 400, 404, 409, 500, 502]) {
      expect(classifyDraftResponse(status), String(status)).toBe("error");
    }
  });

  it("draftWasCreated: genau eine Klasse zaehlt als Entwurf — alles andere ist Create-0", () => {
    expect(draftWasCreated(classifyDraftResponse(201))).toBe(true);
    for (const status of [200, 401, 403, 413, 429, 500]) {
      expect(draftWasCreated(classifyDraftResponse(status)), String(status)).toBe(false);
    }
  });
});

describe("WP-KLARA-1: Inline-Kopie im Taskpane ist VERHALTENSGLEICH zum Modul", () => {
  it("Marker-Block extrahieren, ausführen und auf Fixtures gegen das Modul vergleichen", async () => {
    const html = read(TASKPANE);
    const start = html.indexOf("// KW-WORDADDIN-HELPERS-START");
    const end = html.indexOf("// KW-WORDADDIN-HELPERS-END");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = html.slice(start, end);
    const factory = new Function(
      `${block}; return { deriveDraftTitleFromSelection: deriveDraftTitleFromSelection, selectionToBodyHtml: selectionToBodyHtml, loginPollDecision: loginPollDecision, loginPollStep: loginPollStep, extractWordBodyHtml: extractWordBodyHtml, countUndeliveredWordImages: countUndeliveredWordImages, wordHtmlToPlainText: wordHtmlToPlainText, draftPostPayload: draftPostPayload, prepareWordDraftRequest: prepareWordDraftRequest, WORD_ADDIN_BODY_BUDGET_BYTES: WORD_ADDIN_BODY_BUDGET_BYTES, classifyInsertError: classifyInsertError, askSourceStatus: askSourceStatus, koDetailUrl: koDetailUrl, performInsert: performInsert, performCopy: performCopy, answerIsLong: answerIsLong, classifyDraftResponse: classifyDraftResponse, draftWasCreated: draftWasCreated, WORD_ADDIN_ANSWER_COMPACT_CHARS: WORD_ADDIN_ANSWER_COMPACT_CHARS };`,
    );
    const inline = factory() as {
      deriveDraftTitleFromSelection: (text: string) => string;
      selectionToBodyHtml: (text: string) => string;
      loginPollDecision: (elapsedMs: number, signedIn: boolean) => string;
      loginPollStep: (
        generation: number,
        currentGeneration: number,
        elapsedMs: number,
        signedIn: boolean,
      ) => string;
      extractWordBodyHtml: (html: string) => string;
      countUndeliveredWordImages: (html: string) => number;
      wordHtmlToPlainText: (html: string) => string;
      draftPostPayload: (title: string, statement: string, bodyHtml: string) => string;
      prepareWordDraftRequest: (
        html: string,
        text: string,
      ) => {
        payload: string;
        title: string;
        usedHtml: boolean;
        overBudget: boolean;
        undeliveredImages: number;
      };
      WORD_ADDIN_BODY_BUDGET_BYTES: number;
      classifyInsertError: (detail: string) => string;
      askSourceStatus: (ko: unknown) => string;
      koDetailUrl: (origin: string, koId: string) => string;
      performInsert: typeof performInsert;
      performCopy: typeof performCopy;
      answerIsLong: (text: string) => boolean;
      classifyDraftResponse: typeof classifyDraftResponse;
      draftWasCreated: typeof draftWasCreated;
      WORD_ADDIN_ANSWER_COMPACT_CHARS: number;
    };
    // AUFTRAG-JOB507-D4: die Draft-Antwortklassen sind im buildlosen Panel dieselben wie im Modul.
    for (const status of [201, 200, 401, 403, 413, 429, 500]) {
      expect(inline.classifyDraftResponse(status), `class:${status}`).toBe(
        classifyDraftResponse(status),
      );
      expect(
        inline.draftWasCreated(inline.classifyDraftResponse(status)),
        `created:${status}`,
      ).toBe(draftWasCreated(classifyDraftResponse(status)));
    }
    // Kalibrierung: der Vergleich unterscheidet wirklich (sonst waeren zwei gleich kaputte Fassungen gleich).
    expect(inline.classifyDraftResponse(413)).toBe("too-large");
    expect(inline.draftWasCreated(inline.classifyDraftResponse(413))).toBe(false);
    const fixtures = [
      "",
      "   \n \n",
      "Ventil entlasten vor Wartung\nZweite Zeile",
      "\r\nWindows-Zeilen\r\nNoch eine",
      `<script>alert("x")</script> & "Quotes"`,
      "X".repeat(200),
      "Ümläute & Sonderzeichen — Prüfstand <T> 100 %",
    ];
    for (const fx of fixtures) {
      expect(inline.deriveDraftTitleFromSelection(fx), `title:${fx.slice(0, 20)}`).toBe(
        deriveDraftTitleFromSelection(fx),
      );
      expect(inline.selectionToBodyHtml(fx), `body:${fx.slice(0, 20)}`).toBe(
        selectionToBodyHtml(fx),
      );
    }
    // WP-KLARA-1c: auch die Anmelde-Warte-Entscheidung ist verhaltensgleich gespiegelt.
    const pollFixtures: [number, boolean][] = [
      [0, false],
      [2_999, false],
      [WORD_ADDIN_LOGIN_POLL_MAX_MS - 1, false],
      [WORD_ADDIN_LOGIN_POLL_MAX_MS, false],
      [WORD_ADDIN_LOGIN_POLL_MAX_MS + 1, false],
      [0, true],
      [WORD_ADDIN_LOGIN_POLL_MAX_MS + 1, true],
    ];
    for (const [elapsed, signedIn] of pollFixtures) {
      expect(inline.loginPollDecision(elapsed, signedIn), `poll:${elapsed}/${signedIn}`).toBe(
        loginPollDecision(elapsed, signedIn),
      );
    }
    // WP-IC-PAKET-1c: auch die Generation-Schritt-Entscheidung ist verhaltensgleich gespiegelt.
    const stepFixtures: [number, number, number, boolean][] = [
      [1, 1, 0, false],
      [1, 2, 0, false],
      [1, 2, 0, true],
      [3, 3, WORD_ADDIN_LOGIN_POLL_MAX_MS, false],
      [3, 3, WORD_ADDIN_LOGIN_POLL_MAX_MS - 1, false],
      [3, 3, 0, true],
    ];
    for (const [gen, cur, elapsed, signedIn] of stepFixtures) {
      expect(
        inline.loginPollStep(gen, cur, elapsed, signedIn),
        `step:${gen}/${cur}/${elapsed}/${signedIn}`,
      ).toBe(loginPollStep(gen, cur, elapsed, signedIn));
    }
    // WP-KLARA-2/WP-SHIP8-FINAL: auch die Word-HTML-Aufbereitung (Snapshot-Klartext, finaler
    // Payload, Budget-Wert) ist verhaltensgleich gespiegelt.
    expect(inline.WORD_ADDIN_BODY_BUDGET_BYTES).toBe(WORD_ADDIN_BODY_BUDGET_BYTES);
    const htmlFixtures: [string, string][] = [
      ["", "Nur Text"],
      ["<html><head><style>x</style></head><body class=w><h1>T</h1><p>A</p></body></html>", "T\nA"],
      ["<p>Fragment ohne body</p>", "F"],
      ['<body><img src="data:image/png;base64,QQ=="><img src="cid:x"></body>', "Bild"],
      [`<body><p>${"y".repeat(64)}</p></body>`, "y"],
      ['<body><p>&amp;lt; &nbsp;"Quote"&quot;</p><br><p>Ende</p></body>', "Q"],
    ];
    for (const [html, text] of htmlFixtures) {
      expect(inline.extractWordBodyHtml(html), `extract:${html.slice(0, 24)}`).toBe(
        extractWordBodyHtml(html),
      );
      expect(inline.countUndeliveredWordImages(html), `imgs:${html.slice(0, 24)}`).toBe(
        countUndeliveredWordImages(html),
      );
      expect(inline.wordHtmlToPlainText(html), `plain:${html.slice(0, 24)}`).toBe(
        wordHtmlToPlainText(html),
      );
      expect(inline.draftPostPayload("T", "S", html), `payload:${html.slice(0, 24)}`).toBe(
        draftPostPayload("T", "S", html),
      );
      expect(inline.prepareWordDraftRequest(html, text), `prepare:${html.slice(0, 24)}`).toEqual(
        prepareWordDraftRequest(html, text),
      );
    }
    // RT-KLARA1 + K2/K3: auch Fehler-Klassifikation, Quellen-Status und Deep-Link sind
    // verhaltensgleich gespiegelt.
    for (const detail of [
      "You don't have sufficient permissions for this action.",
      "AccessDenied",
      "Keine Berechtigung",
      "Geen toestemming",
      "GeneralException",
      "",
    ]) {
      expect(inline.classifyInsertError(detail), `err:${detail.slice(0, 20)}`).toBe(
        classifyInsertError(detail),
      );
    }
    for (const ko of [
      { status: "validiert" },
      { status: "offen", assignments: ["u1"] },
      { status: "offen", assignments: [] },
      { status: "offen" },
      {},
      null,
      { status: "irgendwas" },
    ]) {
      expect(inline.askSourceStatus(ko), `status:${JSON.stringify(ko)}`).toBe(
        askSourceStatus(ko as Parameters<typeof askSourceStatus>[0]),
      );
    }
    for (const [origin, id] of [
      ["https://app.klarwerk.ai", "ko-1"],
      ["https://klarwerk.ai", "a b/c"],
    ] as const) {
      expect(inline.koDetailUrl(origin, id), `url:${id}`).toBe(koDetailUrl(origin, id));
    }
    // klara1b Teil A/B: auch robustes Einfuegen, Kopieren und die Kompakt-Schwelle sind
    // verhaltensgleich gespiegelt (Fakes fuer die injizierten Office-/Clipboard-Aufrufe).
    expect(inline.WORD_ADDIN_ANSWER_COMPACT_CHARS).toBe(WORD_ADDIN_ANSWER_COMPACT_CHARS);
    for (const fx of ["kurz", "x".repeat(400), "a\nb\nc\nd\ne\nf\ng", ""]) {
      expect(inline.answerIsLong(fx), `long:${fx.slice(0, 10)}`).toBe(answerIsLong(fx));
    }
    // performInsert: derselbe Ausgang bei Erfolg, Fallback und Berechtigungs-/anderem Fehler.
    const makeAttempts = (kinds: ("ok" | "perm" | "other")[]): InsertAttempt[] =>
      kinds.map((kind, i) => ({
        method: i === 0 ? "word-run" : "set-selected-data",
        run: async () => {
          if (kind === "ok") {
            return;
          }
          throw new Error(kind === "perm" ? "insufficient permissions" : "GeneralException");
        },
      }));
    for (const kinds of [["ok"], ["other", "ok"], ["perm", "perm"], ["other"]] as (
      | "ok"
      | "perm"
      | "other"
    )[][]) {
      expect(
        await inline.performInsert("T", makeAttempts(kinds)),
        `insert:${kinds.join("/")}`,
      ).toEqual(await performInsert("T", makeAttempts(kinds)));
    }
    // performCopy: ok, kein-Clipboard und Wurf sind verhaltensgleich.
    const okClip = { writeText: async () => undefined };
    const rejClip = { writeText: async () => Promise.reject(new Error("NotAllowedError")) };
    expect(await inline.performCopy("x", okClip)).toEqual(await performCopy("x", okClip));
    expect(await inline.performCopy("x", null)).toEqual(await performCopy("x", null));
    expect(await inline.performCopy("x", rejClip)).toEqual(await performCopy("x", rejClip));
  });
});

describe("WP-KLARA-1: Manifest + Taskpane + Hosting", () => {
  it("Manifest-XML ist wohlgeformt und trägt die Kernfelder", () => {
    const xml = read(MANIFEST);
    const doc = new XmlParser().parseFromString(xml, "text/xml");
    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    const text = (tag: string) => doc.getElementsByTagName(tag)[0]?.textContent ?? "";
    expect(text("ProviderName")).toBe("KLARWERK");
    expect(doc.getElementsByTagName("DisplayName")[0]?.getAttribute("DefaultValue")).toBe("Klara");
    // JOB 899 (OFFEN.md K7): Hier stand die URL NACKT und zeichengenau gepinnt. Das war eine
    // ZWEITE Wahrheit neben dem Manifest — und sie stand der Cachebindung im Weg: jede Kennung in
    // `SourceLocation` machte genau diese Zeile rot. Geprüft wird jetzt dieselbe Invariante wie in
    // `word-addin-taskpane-cache.test.ts`: Basis-URL plus die aus DEMSELBEN Dokument gelesene
    // `<Version>`. Eine Versions-/URL-Divergenz wird damit hier ebenso rot wie dort; eine
    // fortgeschriebene Version bleibt grün, ohne dass jemand diese Zeile nachpflegen muss.
    expect(doc.getElementsByTagName("SourceLocation")[0]?.getAttribute("DefaultValue")).toBe(
      `https://app.klarwerk.ai/word-addin/taskpane.html?v=${text("Version")}`,
    );
    // WP-KLARA-1b (K3): bis KLARA-2 reichte ReadDocument (nur lesen). WP-KLARA-ASK (Teil 2):
    // „Antwort in Word einfuegen" ist eine bewusste Dokumentmutation (setSelectedDataAsync) —
    // ReadWriteDocument ist jetzt die KLEINSTE ausreichende Stufe (Least-Privilege neu begruendet).
    expect(text("Permissions")).toBe("ReadWriteDocument");
    // WordApi 1.1 reicht (Selektion lesen) — Requirement-Set bewusst niedrig.
    expect(doc.getElementsByTagName("Set")[0]?.getAttribute("Name")).toBe("WordApi");
    expect(doc.getElementsByTagName("Set")[0]?.getAttribute("MinVersion")).toBe("1.1");
    // GUID vorhanden und stabil formatiert.
    expect(text("Id")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    // Redirect-Realität: beide Domains freigegeben (app.klarwerk.ai → 301 → klarwerk.ai).
    const domains = [...doc.getElementsByTagName("AppDomain")].map((d) => d.textContent);
    expect(domains).toContain("https://app.klarwerk.ai");
    expect(domains).toContain("https://klarwerk.ai");
  });

  it("Pfad-Konvention: Taskpane + Icons liegen unter public/word-addin (statisch mit ausgeliefert)", () => {
    expect(existsSync(resolve(process.cwd(), TASKPANE))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "apps/web/public/word-addin/icon-32.png"))).toBe(true);
    expect(existsSync(resolve(process.cwd(), "apps/web/public/word-addin/icon-80.png"))).toBe(true);
  });

  it("Taskpane: office.js von der offiziellen CDN, echte Endpunkte, ehrliche Grenzen, kein Chatbot-Versprechen", () => {
    const html = read(TASKPANE);
    expect(html).toContain("https://appsforoffice.microsoft.com/lib/1/hosted/office.js");
    // (a) Session-Check über den BESTEHENDEN Endpunkt, (b) Entwurf über die BESTEHENDE Draft-API.
    expect(html).toContain('fetch("/api/auth/me", { credentials: "include" })');
    expect(html).toContain('fetch("/api/drafts"');
    expect(html).toContain('credentials: "include"');
    expect(html).toContain('origin: "word_addin"');
    // WP-KLARA-ASK: das Funktionsversprechen ist da — die Ehrlichkeit verschiebt sich von „keine KI"
    // zu „NUR validiertes Wissen, kein Chatbot, nichts erfunden" (DE-Texte, Hilfe + Gap-Karte).
    expect(html).toContain("kein Chatbot");
    // JOB 3046 D2: die Luecke ist die Auskunft des Zielbilds KeinWissen.dc.html — der Erklaertext
    // askGapBody („Statt einer erfundenen Antwort …") ist entfernt; die Haltung „nichts erfunden"
    // traegt jetzt die Fusszeile der Luecke (askGapFuss) und der eine Satz (askGapTitle).
    expect(html).toContain("Klara erfindet keine Antworten");
    expect(html).toContain("Dazu liegt kein freigegebenes Firmenwissen vor.");
    // AUFTRAG-mega35 B1: die Quellenbindung bleibt die Zusage — aber ohne das Wort „geprueft".
    // Es meinte den validierten Bestand, stand aber neben der Einstufung „ungeprueft"; eine
    // Testerin ohne Vorwissen kann diese zwei Ebenen nicht auseinanderhalten.
    // JOB 3017 D4: der Satz „AUSSCHLIESSLICH aus KLARWERK-Wissen" (askHint) ist mit dem
    // Pruefhinweis zu dem EINEN Satz unter der Fragen-Karte zusammengefuehrt (askReviewNotice);
    // die Quellenbindung steht dort weiter — als „woertlich aus validiertem KLARWERK-Wissen".
    expect(html).toContain("wörtlich aus validiertem KLARWERK-Wissen — mit Quellen");
    expect(html).not.toContain("askHint:");
    expect(html).not.toContain("aus geprueftem KLARWERK-Wissen");
    // DE/EN/NL-Umschalter mit vollständigen Wörterbüchern.
    for (const lng of ["de:", "en:", "nl:"]) {
      expect(html).toContain(lng);
    }
    // Leere Auswahl → ehrliche Meldung; Fehler → nie Erfolg vortäuschen.
    expect(html).toContain("sendEmpty");
    expect(html).toContain("KEIN Entwurf angelegt");
  });

  // WP-KLARA-1b (K1): der fruehere Quelltext-String-Pin der CSP-Ausnahme (der den unsicheren
  // Prefix-Ansatz sogar festschrieb) ist ERSETZT durch die echte HTTP-Header-Matrix gegen die reale
  // Produktionsregistrierung — s. tests/app/word-addin-csp.test.ts (inject-Matrix inkl. Negativfaelle)
  // und services/app/src/sync-onsend-hooks.test.ts (server.ts verdrahtet registerSecurityHeaders).

  // WP-KLARA-1b (K5): der Office-unavailable-Pfad ist KONTROLLIERT — kein toter/crashender Klick,
  // wenn office.js fehlt oder Office nie bereit wird (Seite im normalen Browser geoeffnet).
  it("Taskpane: timeout-basierte Office-Erkennung + ehrlicher Browser-Zustand (DE/EN/NL), Guard vor der Word-API", () => {
    const html = read(TASKPANE);
    // Erkennung: Office.onReady MIT Frist; ohne window.Office sofort ehrlicher Zustand.
    expect(html).toContain("OFFICE_READY_TIMEOUT_MS = 4000");
    expect(html).toContain("Office.onReady(function () {");
    expect(html).toContain("clearTimeout(officeTimer)");
    expect(html).toContain("markOfficeChecked(false)");
    // Ehrlicher Hinweis in allen drei Sprachen (eigener noOffice-Text je Woerterbuch).
    expect((html.match(/noOffice: "/g) ?? []).length).toBe(3);
    expect(html).toContain("Diese Seite läuft als Klara-Panel in Microsoft Word.");
    expect(html).toContain("This page runs as the Klara panel inside Microsoft Word.");
    expect(html).toContain("Deze pagina draait als Klara-paneel in Microsoft Word.");
    // Der Senden-Knopf haengt an Anmeldung UND Office-Bereitschaft; deaktiviert traegt er den Grund.
    expect(html).toContain("sendBtn.disabled = !(signedIn && officeUsable())");
    expect(html).toContain('sendBtn.title = t("noOffice")');
    // Defense-in-Depth: sendSelection greift NIE ohne bereites Office in die Word-API.
    const guard = html.indexOf(
      'if (!officeUsable()) {\n        showSendStatus("warn", t("noOffice"));',
    );
    const wordApi = html.indexOf("Office.context.document.getSelectedDataAsync");
    expect(guard).toBeGreaterThan(0);
    expect(wordApi).toBeGreaterThan(guard);
    // Der Session-Check laeuft auch ohne Office (Anmelde-Status bleibt im Browser sichtbar).
    expect(html).toContain("checkSession();");
  });

  // WP-KLARA-1c (Pedis Live-Befund): Der Anmelde-Knopf navigiert das Panel NICHT mehr zur App (dort
  // blieb es nach dem Login auf der vollen Webseite haengen) — Anmeldung in EIGENEM Fenster
  // (Office-Dialog, sonst window.open) + Session-Polling auf taskpane.html.
  it("Login-Rueckweg: keine Panel-Navigation mehr; eigenes Fenster + Session-Polling mit Frist und Abbrechen", () => {
    const html = read(TASKPANE);
    // Die alte Navigation (Ursache des Haengenbleibens) ist raus.
    expect(html).not.toContain('window.location.href = "/"');
    // Eigenes Fenster: offizieller Office-Dialog zuerst, window.open als Fallback (Browser-Vorschau).
    expect(html).toContain("displayDialogAsync");
    expect(html).toContain('window.open(url, "_blank")');
    expect(html).toContain("WORD_ADDIN_LOGIN_POLL_MAX_MS = 300000");
    // Sichtbarer Warte-Zustand + Abbrechen; Timeout endet ehrlich.
    expect(html).toContain('id="login-cancel-btn"');
    expect((html.match(/loginWaiting: "/g) ?? []).length).toBe(3);
    expect((html.match(/loginCancel: "/g) ?? []).length).toBe(3);
    expect((html.match(/loginTimeout: "/g) ?? []).length).toBe(3);
    // Erfolg → normale Zustands-Renderung OHNE Navigation (checkSession).
    expect(html).toContain("stopLoginPolling();");
  });

  // WP-IC-PAKET-1c (bens ROT-1): Poll-Lifecycle — sequenziell, abbrechbar, generationssicher.
  it("Poll-Lifecycle: sequenziell (kein Interval), Fetch-Frist, harte Deadline, Generation, Knopf-Sperre, Popup-/Kontext-Ehrlichkeit", () => {
    const html = read(TASKPANE);
    // (a) GENAU EIN Poll gleichzeitig: kein setInterval; der naechste Versuch wird NACH Abschluss
    // rekursiv per setTimeout geplant.
    expect(html).not.toContain("setInterval(");
    expect(html).toContain("runLoginPoll(generation)");
    // (b) jeder Fetch mit eigenem AbortController + eigener Frist.
    expect(html).toContain("new AbortController()");
    expect(html).toContain("signal: controller.signal");
    expect(html).toContain("WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = 5000");
    // (c) UNABHAENGIGE harte 5-Minuten-Frist (eigener Deadline-Timer ab Start).
    expect(html).toContain("loginDeadlineTimer = setTimeout(");
    // (d) Generation-ID: Abbruch neutralisiert Timer + laufenden Fetch + spaete Dialog-Callbacks.
    expect(html).toContain("loginPollGeneration += 1");
    expect(html).toContain("loginPollStep(generation, loginPollGeneration");
    expect(html).toContain("loginPollController.abort()");
    expect(html).toContain("closeDialogHandle(dialog)");
    // (e) Login-Knopf waehrend des Laufs deaktiviert.
    expect(html).toContain('document.getElementById("login-btn").disabled = true');
    expect(html).toContain('document.getElementById("login-btn").disabled = false');
    // (f) displayDialogAsync in try/catch (synchroner Wurf) + window.open-Rueckgabe geprueft.
    const dialogCallIdx = html.indexOf("ui.displayDialogAsync(");
    const tryIdx = html.lastIndexOf("try {", dialogCallIdx);
    expect(tryIdx).toBeGreaterThan(0);
    expect(html).toContain("if (win === null) {");
    expect((html.match(/loginPopupBlocked: "/g) ?? []).length).toBe(3);
    // (g) ehrlicher Kontext-Hinweis fuer den Fallback-Fall, DE/EN/NL.
    expect((html.match(/loginOtherContext: "/g) ?? []).length).toBe(3);
    expect(html).toContain('id="login-context-hint"');
  });

  it("Sideload-Anleitung: funktionierender Mac-Weg zuerst (wef + Cache + Neustart + Home-Tab), Hochladen als Fallback", () => {
    const md = read("docs/word-addin/SIDELOAD-ANLEITUNG.md");
    // WP-KLARA-1c: Weg A = wef-Ordner; Klara erscheint im HOME-Tab unter Add-ins.
    expect(md).toContain("Weg A — wef-Ordner");
    expect(md).toContain("HOME-Tab");
    expect(md.indexOf("wef-Ordner")).toBeLessThan(md.indexOf("Mein Add-In hochladen"));
    expect(md).toContain("Weg B — Fallback");
    expect(md).toContain("Mein Add-In hochladen");
    expect(md).toContain("Troubleshooting");
    // Kommentar-Header-Hinweis: Manifest unveraendert kopieren, kein Header vor OfficeApp.
    expect(md).toContain("OHNE Kommentar-Header");
  });

  it("Manifest: KEIN Kommentar vor <OfficeApp> (vermutliche Mitursache des Nicht-Erscheinens)", () => {
    const xml = read(MANIFEST);
    const beforeRoot = xml.slice(0, xml.indexOf("<OfficeApp"));
    expect(beforeRoot).not.toContain("<!--");
    // Direkt nach der XML-Deklaration folgt das Root-Element.
    expect(beforeRoot.trim()).toBe('<?xml version="1.0" encoding="UTF-8"?>');
  });
});

// WP-KLARA-2 (Pedis Befunde 1-4): das Taskpane ist vom Textblock-Sender zum Werkzeug geworden —
// Quelltext-Pins auf die Verdrahtung (die reine Logik ist oben unit-/äquivalenz-getestet).
describe("WP-KLARA-2: Taskpane-Verdrahtung (Umfang, HTML, Deep-Link, ehrliche Grenzen)", () => {
  const html = read(TASKPANE);

  it("Befund 1: der Erfolgs-Link öffnet den ENTWURF direkt (bestehendes Deep-Link-Muster der App)", () => {
    expect(html).toContain('"/capture/frontdoor?draft=" + encodeURIComponent(draft.id)');
  });

  it("Befund 2: die Auswahl reist als HTML (Office.CoercionType.Html) — der Server-Sanitizer bleibt autoritativ", () => {
    expect(html).toContain("Office.CoercionType.Html");
    expect(html).toContain("prepareWordDraftRequest(html, text)");
    // Klartext bleibt erhalten (statement + Fallback) — WP-SHIP8-FINAL: aus dem EINEN
    // HTML-Snapshot abgeleitet; der Text-Aufruf existiert nur noch als Fallback aelterer Hosts.
    expect(html).toContain("Office.CoercionType.Text");
    expect(html).toContain("body: prepared.payload");
  });

  // WP-SHIP8-FINAL (bens Bedingung 4): EIN Auswahl-Snapshot — im HTML-Pfad GENAU EIN
  // Office-Aufruf; der Klartext wird abgeleitet, der Text-Aufruf lebt NUR im Fallback-Zweig.
  it("Bedingung 4: Snapshot-Konsistenz — HTML zuerst, Klartext daraus abgeleitet, Text-Aufruf nur im Fallback", () => {
    const readSel = html.slice(
      html.indexOf("function readSelection(done)"),
      html.indexOf("function readWholeDocument(done)"),
    );
    // HTML-Aufruf kommt VOR dem Text-Aufruf; der Erfolgszweig leitet den Klartext ab und returned.
    const htmlCall = readSel.indexOf("Office.CoercionType.Html");
    const derive = readSel.indexOf("done(wordHtmlToPlainText(html), html");
    const textCall = readSel.indexOf("Office.CoercionType.Text");
    expect(htmlCall).toBeGreaterThan(0);
    expect(derive).toBeGreaterThan(htmlCall);
    expect(textCall).toBeGreaterThan(derive); // Fallback-Zweig NACH dem Erfolgs-return
    // Genau EIN Text-Aufruf (der Fallback) und EIN HTML-Aufruf in readSelection.
    expect(readSel.match(/getSelectedDataAsync\(Office\.CoercionType\.Html/g) ?? []).toHaveLength(
      1,
    );
    expect(readSel.match(/getSelectedDataAsync\(Office\.CoercionType\.Text/g) ?? []).toHaveLength(
      1,
    );
  });

  it("Befund 3: Umfangs-Wahl — Auswahl (Default) / ganzes Dokument via Word.run; Seiten ehrlich deaktiviert", () => {
    expect(html).toContain('id="scope-selection" checked');
    expect(html).toContain('id="scope-document"');
    expect(html).toContain("Word.run(function (context)");
    expect(html).toContain("body.getHtml()");
    // Seiten-Option: sichtbar, aber EHRLICH deaktiviert (kein verlässliches Seiten-API im
    // Taskpane) — mit Tooltip-Erklärung und Ausweg-Hinweis in allen drei Sprachen.
    expect(html).toContain('id="scope-pages" disabled');
    expect(html).toContain(
      'document.getElementById("scope-pages-label").title = t("scopePagesOff")',
    );
    for (const key of [
      'scopeSelection: "',
      'scopeDocument: "',
      'scopePages: "',
      'scopePagesOff: "',
      'scopePagesHint: "',
    ]) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
    // KEINE wacklige Näherung: kein Seiten-API-Aufruf im Quelltext.
    expect(html).not.toContain("getPageRange");
    // AUFTRAG-mega74: dieser Wächter prüfte die bloße ZEICHENFOLGE „WordApiDesktop" — und schlug
    // damit auf einen KOMMENTAR an, der erklärt, warum eine WordApiDesktop-Eigenschaft bewusst
    // GEMIEDEN wird (`InlinePicture.imageFormat`). Ein Wächter, der Prosa nicht von Code
    // unterscheidet, zwingt dazu, Begründungen zu verschweigen; genau daran sind am 30.07. drei
    // Wächter gescheitert. Gemeint war immer die NUTZUNG, nicht die Erwähnung — also wird jetzt
    // der kommentarbereinigte Quelltext geprüft.
    const codeOhneKommentare = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(
      codeOhneKommentare,
      "WordApiDesktop darf nicht BENUTZT werden (Erwähnung in einem Kommentar ist erlaubt).",
    ).not.toContain("WordApiDesktop");
    // Und die eine WordApiDesktop-Eigenschaft, die beim Bildweg naheliegt, ausdrücklich mit:
    // der Bildtyp kommt aus den Bytes (wordImageMimeFromBase64), nicht aus `imageFormat`.
    expect(codeOhneKommentare).not.toContain("imageFormat");
    // Gegenprobe, damit dieser Wächter nicht vakuös wird: die Kommentar-Bereinigung darf nicht
    // einfach ALLES entfernen — der tragende Code steht noch da.
    expect(codeOhneKommentare).toContain("getBase64ImageSrc");
  });

  it("Befund 4 + Budget: ehrliche Bild-Bilanz und Budget-Fallback in allen drei Sprachen", () => {
    for (const key of ['sendImagesMissing: "', 'sendOverBudget: "', 'sendEmptyDoc: "']) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
    expect(html).toContain("prepared.undeliveredImages");
    expect(html).toContain("prepared.overBudget");
    // Budget-Spiegel im Inline-Block (Gleichheit zum Modul pinnt der Äquivalenztest).
    expect(html).toContain("WORD_ADDIN_BODY_BUDGET_BYTES = 3500000");
  });

  // RT-KLARA1 + klara1b Teil A (Pedis Live-Befunde 23./24.07.): der Einfuege-Berechtigungsfall wird
  // EHRLICH erklaert (Manifest ohne Schreibrecht → Re-Sideload mit ReadWriteDocument + Versions-Bump)
  // statt roher Office-Fehlertext. Der robuste Insert laeuft ueber performInsert (Word.run zuerst,
  // setSelectedDataAsync als Fallback) — die Fehler-Klassifikation liegt jetzt IM performInsert.
  it("RT-KLARA1: Einfuege-Fehler — Berechtigungsfall (performInsert.failure) + ehrliche Meldung DE/EN/NL", () => {
    expect(html).toContain('outcome.failure === "permission"');
    expect(html).toContain('showAskStatus("warn", t("askInsertNoPermission"))');
    // Ehrliche Meldung in allen drei Sprachen, mit dem konkreten Ausweg (ReadWriteDocument).
    expect((html.match(/askInsertNoPermission: "/g) ?? []).length).toBe(3);
    expect(html).toContain("Schreibberechtigung");
    expect(html).toContain("write permission");
    expect(html).toContain("schrijfrechten");
    expect((html.match(/ReadWriteDocument/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // Der Nicht-Berechtigungsfall behaelt den konkreten Detail-Text (nie ein geratener Grund).
    expect(html).toContain('t("askInsertFail", { detail: outcome.detail || "Word-API" })');
  });

  // K2/K3 (AUFTRAG-klara1 Paket 2): Quellen sind klickbare Deep-Links auf die KO-Detailseite
  // mit Status (Bibliotheks-Logik) und weiterhin sichtbarem Trust-Wert.
  // JOB 3056 K1: der Chip traegt nur „n · Titel" (Main.dc.html Z.33); Status, Rolle, Vertrauen
  // und Stand stehen je Quelle in der Detailzeile unter „Mehr" (askQuellenDetailZeile) — dieselbe
  // Ableitung, derselbe Schluessel, kein Raten.
  it("K2/K3: Quelle = Deep-Link (/wissen/:id, extern) + Status + Trust unter „Mehr“, DE/EN/NL", () => {
    // Deep-Link ueber den gespiegelten Helfer, extern geoeffnet, ohne Opener-Zugriff.
    expect(html).toContain("link.href = koDetailUrl(window.location.origin, resolved[i].id)");
    expect(html).toContain('link.target = "_blank"');
    expect(html).toContain('link.rel = "noopener noreferrer"');
    // Aufbau ueber DOM-APIs (textContent) — kein HTML-Sink fuer KO-Titel.
    expect(html).toContain("link.textContent = resolved[i].title");
    // Status aus der Bibliotheks-Ableitung; unbekannt wird NIE geraten.
    expect(html).toContain("function askQuellenDetailZeile(nummer, quelle)");
    expect(html).toContain('teile.push(t(ASK_STATUS_KEYS[quelle.status] || "askStatusUnknown"))');
    for (const key of [
      'askStatusValidiert: "',
      'askStatusPruefung: "',
      'askStatusOffen: "',
      'askStatusUnknown: "',
    ]) {
      expect(html.split(key).length - 1, key).toBe(3);
    }
    // Trust bleibt erreichbar (Detailzeile unter „Mehr“); die Quellen-Aufloesung traegt Id + Status
    // (unknown im Fehlerfall).
    expect(html).toContain('t("askTrust", { n: String(quelle.trust) })');
    expect(html).toContain("status: askSourceStatus(ko)");
    expect(html).toContain(
      '{ id: id, title: id, trust: null, standDate: null, status: "unknown" }',
    );
  });
});

// ================================================================================================
// AUFTRAG-JOB507-D4 — DIE SICHTBAREN ZUSTAENDE, AUSGEFUEHRT STATT GEPINNT.
// ================================================================================================
//
// Alle Tests oberhalb pruefen entweder reine Logik oder Zeichenfolgen im Quelltext. Was ein Mensch
// im Aufgabenfenster WIRKLICH liest, stand in keinem ausgefuehrten Test — genau dort lagen die
// Loecher: ein 413 und ein 429 landeten im generischen „Senden fehlgeschlagen (HTTP 413)"-Zweig,
// und niemand konnte belegen, dass dabei KEIN Entwurf behauptet wird.
//
// Diese Gruppe faehrt das AUSGELIEFERTE Inline-Skript im jsdom (tests/app/klara-panel-fixture.ts)
// und liest die Oberflaeche ab. Die Zaehlung ist die eigentliche Zusage:
//   Create-1 = genau EIN POST /api/drafts UND ein sichtbarer Entwurf-Link,
//   Create-0 = genau EIN POST /api/drafts UND KEIN Link, KEIN Erfolgstext.
describe("AUFTRAG-JOB507-D4: sichtbare Panelzustaende (413/201, Retry-After, DE/EN/NL)", () => {
  let panel: KlaraPanel | null = null;

  // Lieferung 3: `restore()` laeuft UNBEDINGT — ohne Bedingung, ohne „falls vorhanden". Die feste
  // Reihenfolge (stopLoginPolling → Timer → Fetch → Office/Word → DOM) steht in der Fixture.
  afterEach(() => {
    if (panel !== null) {
      panel.restore();
      panel = null;
    }
  });

  function openPanel(draftReply: ReturnType<typeof reply>): KlaraPanel {
    panel = createKlaraPanel({ routes: { "/api/drafts": draftReply } });
    return panel;
  }

  function draftPosts(open: KlaraPanel): number {
    return open.calls.filter((call) => call.url === "/api/drafts" && call.method === "POST").length;
  }

  it("Fixture-Vertrag: `q` ist im dynamischen Skriptrumpf deklariert, das Rueckgabeobjekt traegt die fuenf Bedienstellen", () => {
    const open = openPanel(reply(201, { id: "draft-1" }));
    expect(open.scriptSource).toContain("function q(selector) { return document.querySelector(");
    for (const member of ["setLang", "setTab", "sendSelection", "q", "stopLoginPolling"] as const) {
      expect(typeof open[member], member).toBe("function");
    }
    // Das Panel steht wirklich im DOM (und nicht nur als Zeichenkette im Test).
    expect(open.q("#send-btn")).not.toBeNull();
    // JOB 3056 K1: die Sitzungskarte ist gefallen; der Kopf traegt den Titel „Klara".
    expect(open.text("#kw-titel").length).toBeGreaterThan(0);
  });

  it("201 → Create-1: genau ein POST, Erfolgstext mit Titel, Entwurf-Link sichtbar", async () => {
    const open = openPanel(reply(201, { id: "draft-42" }));
    await open.flush();
    open.sendSelection();
    await open.flush();
    expect(draftPosts(open)).toBe(1);
    expect(open.q("#send-status")?.className).toBe("status ok");
    expect(open.text("#send-status")).toContain("Ventil entlasten vor der Wartung");
    // Der Entwurf ist wirklich da → der Deep-Link geht auf.
    expect(open.q("#open-block")?.className).toBe("");
    expect(open.q("#open-link")?.href).toContain("/capture/frontdoor?draft=draft-42");
  });

  it("413 → Create-0: genau ein POST, eigener Zu-gross-Zustand, KEIN Link und KEIN Erfolgstext", async () => {
    const open = openPanel(reply(413, { error: "FST_ERR_CTP_BODY_TOO_LARGE" }));
    await open.flush();
    open.sendSelection();
    await open.flush();
    expect(draftPosts(open)).toBe(1);
    expect(open.q("#send-status")?.className).toBe("status warn");
    expect(open.text("#send-status")).toBe(open.t("sendTooLarge"));
    // Die entscheidende Zusage: nichts behauptet, nichts verlinkt.
    expect(open.q("#open-block")?.className).toBe("hidden");
    expect(open.text("#send-status")).not.toContain("Entwurf angelegt:");
  });

  it("403 → fehlendes Recht statt Anmeldeaufforderung; 401 → Anmeldeweg", async () => {
    const forbidden = openPanel(reply(403, { error: "FORBIDDEN" }));
    await forbidden.flush();
    forbidden.sendSelection();
    await forbidden.flush();
    expect(forbidden.text("#send-status")).toBe(forbidden.t("sendForbidden"));
    expect(forbidden.q("#open-block")?.className).toBe("hidden");
    forbidden.restore();
    panel = null;

    const unauth = openPanel(reply(401, { error: "UNAUTHORIZED" }));
    await unauth.flush();
    unauth.sendSelection();
    await unauth.flush();
    expect(unauth.text("#send-status")).toBe(unauth.t("sendAuth"));
  });

  it("429 → Wartezeit aus Retry-After sichtbar; ohne Header ehrlich ohne Zahl", async () => {
    const withHeader = openPanel(reply(429, { error: "RATE_LIMITED" }, { "retry-after": "90" }));
    await withHeader.flush();
    withHeader.sendSelection();
    await withHeader.flush();
    expect(withHeader.text("#send-status")).toBe(withHeader.t("sendRateLimited", { n: "90" }));
    expect(withHeader.text("#send-status")).toContain("90");
    expect(withHeader.q("#open-block")?.className).toBe("hidden");
    withHeader.restore();
    panel = null;

    const blind = openPanel(reply(429, { error: "RATE_LIMITED" }));
    await blind.flush();
    blind.sendSelection();
    await blind.flush();
    expect(blind.text("#send-status")).toBe(blind.t("sendRateLimitedUnknown"));
    // Keine geratene Zahl, wenn der Server keine genannt hat.
    expect(blind.text("#send-status")).not.toMatch(/\d/);
  });

  it("DE/EN/NL: der 413-Zustand wechselt die Sprache mit und bleibt in jeder Sprache eine Absage", async () => {
    const open = openPanel(reply(413, {}));
    await open.flush();
    const gesehen: string[] = [];
    for (const [code, anker] of [
      ["de", "KEIN Entwurf"],
      ["en", "NO draft"],
      ["nl", "GEEN concept"],
    ] as const) {
      open.setLang(code);
      await open.flush();
      open.sendSelection();
      await open.flush();
      const sichtbar = open.text("#send-status");
      expect(sichtbar, code).toBe(open.t("sendTooLarge"));
      expect(sichtbar, code).toContain(anker);
      gesehen.push(sichtbar);
    }
    // Drei Sprachen, drei verschiedene Saetze — kein stiller Rueckfall auf Deutsch.
    expect(new Set(gesehen).size).toBe(3);
    expect(open.q("#open-block")?.className).toBe("hidden");
  });

  it("Sprachumschaltung setzt auch das lang-Attribut und die Bereichs-Umschaltung bleibt reine Sichtbarkeit", async () => {
    const open = openPanel(reply(201, { id: "d1" }));
    await open.flush();
    open.setLang("nl");
    await open.flush();
    expect(open.q("#ask-title-probe")).toBeNull(); // es gibt keine Testhilfen im Produkt
    expect(
      (globalThis as unknown as { document: { documentElement: { lang: string } } }).document
        .documentElement.lang,
    ).toBe("nl");
    open.setTab("capture");
    expect(open.q("#section-capture")?.className).toBe("");
    expect(open.q("#section-ask")?.className).toBe("hidden");
    open.setTab("ask");
    expect(open.q("#section-ask")?.className).toBe("");
    expect(open.q("#section-capture")?.className).toBe("hidden");
  });
});

// ================================================================================================
// JOB 1149 · KA1 — DAS DOKUMENT-BEGRIFFSBILD, HAUSINTERN UND OHNE JEDEN EGRESS.
// ================================================================================================
//
// DIE ZUSAGE, woertlich aus `OFFEN.md` (Zeile KA1): „das Panel haelt zu einem offenen Dokument eine
// Begriffsliste, ohne dass ein Modellaufruf stattfindet".
//
// WARUM DIESE TESTS SO GEBAUT SIND. Das Aufgabenfenster ist buildlos — es kann `queryTokens` und
// `normalizeSearchTerms` nicht importieren und MUSS sie spiegeln. Eine Spiegelfassung ohne
// Aequivalenzmessung waere eine zweite Suchwahrheit, die morgen auseinanderlaeuft; genau davor
// warnt der Auftrag. Gemessen wird deshalb nicht der Quelltext der Kopie, sondern ihr VERHALTEN
// gegen die echten Hausregeln — dieselbe Bauform, die dieses Fenster seit WP-KLARA-1 fuer
// `KW-WORDADDIN-HELPERS-*` benutzt.
describe("JOB 1149 · KA1: Begriffsbild — Aequivalenz zur Suchregel, Deckel, Kein-Egress", () => {
  // Der Gate-tsc laeuft Node-rein ohne DOM-lib (dieselbe Lage wie bei XmlParser oben) — die zwei
  // Eigenschaften, die diese Tests wirklich lesen, stehen deshalb als schmaler Struktur-Typ da.
  interface PanelKnoten {
    textContent: string | null;
    className: string;
    children: ArrayLike<unknown>;
  }
  interface PanelDoc {
    body: { innerHTML: string };
    getElementById(id: string): PanelKnoten | null;
  }

  /** Der ausgelieferte KA1-Block, ausgefuehrt statt gelesen. */
  function ladeKa1(): {
    KA1_MAX_TERMS: number;
    ka1TermsFromText: (text: string) => string[];
    ka1Anzeigen: (terms: string[], verfuegbar: boolean) => void;
  } {
    const html = read(TASKPANE);
    const start = html.indexOf("// KW-KA1-TERMS-START");
    const end = html.indexOf("// KW-KA1-TERMS-END");
    expect(start, "Markerblock KW-KA1-TERMS-START fehlt").toBeGreaterThan(0);
    expect(end, "Markerblock KW-KA1-TERMS-END fehlt").toBeGreaterThan(start);
    const block = html.slice(start, end);
    const factory = new Function(
      `${block}; return { KA1_MAX_TERMS: KA1_MAX_TERMS, ka1TermsFromText: ka1TermsFromText, ka1Anzeigen: ka1Anzeigen };`,
    );
    return factory() as ReturnType<typeof ladeKa1>;
  }

  /**
   * DIE KANONISCHE LISTE — aus den echten Hausfunktionen zusammengesetzt, nicht nachgebaut.
   *
   * Die Reihenfolge der drei Schritte ist die Aussage: erst die Bereinigung (`&uuml;` ist derselbe
   * Buchstabe wie „ü", NFKC, unsichtbare Zeichen, Leerraum), dann die Inhaltstoken-Zerlegung der
   * Suche, dann die kanonische Termbereinigung der Suchadapter. Wer eine dieser Stufen weglaesst,
   * bekommt eine andere Liste — und genau das machen die Gegenmutationen sichtbar.
   */
  function kanonisch(text: string, max: number): string[] {
    return normalizeSearchTerms(queryTokens(normalizeSearchFragment(text))).slice(0, max);
  }

  // Ein realistischer Dokumentanfang mit GENAU den sechs Eigenschaften, die der Auftrag verlangt:
  // Umlaute, eine HTML-Entitaet, eine Wiederholung, Stoppwoerter, Kurzwoerter und Inhaltswoerter.
  const DOKUMENT =
    "Die Wartung der Hallenkr&auml;ne ist zu pr&uuml;fen. " +
    "Bei der Wartung gilt: der Kran wird vorher entlastet, das Ventil ab M12 geschlossen.";

  it("die Spiegelfassung ist VERHALTENSGLEICH zur Suchregel des Hauses", () => {
    const ka1 = ladeKa1();
    const fixtures = [
      DOKUMENT,
      "",
      "   \n\t  ",
      "und oder aber weil dann", // ausschliesslich Stoppwoerter → leer
      "an im so ob je", // ausschliesslich Kurzwoerter → leer
      "F3 M12 DN50 Q1", // Kennungen ueberleben die Laengengrenze (mega54 A)
      "Pr&uuml;fung gepr&uuml;ft pr&uuml;fen Pr&uuml;fungen", // Entitaet + vier Beugungen EINES Worts
      "Donau​dampfschiff", // Zero-Width MITTEN im Wort — darf nicht trennen
      "Arbeitsschutz, Arbeitsschutz; Arbeitsschutz!", // Wiederholung mit Satzzeichen
      "Ümläute UND GROSSschreibung",
      "Wartungsplan\nVentil\r\nHallenkran",
      "x".repeat(300),
    ];
    for (const fx of fixtures) {
      expect(ka1.ka1TermsFromText(fx), `terms:${fx.slice(0, 24)}`).toEqual(
        kanonisch(fx, ka1.KA1_MAX_TERMS),
      );
    }
  });

  it("das Beispieldokument ergibt EXAKT die kanonische Liste — mit allen sechs Eigenschaften", () => {
    const ka1 = ladeKa1();
    const terms = ka1.ka1TermsFromText(DOKUMENT);
    expect(terms).toEqual(kanonisch(DOKUMENT, ka1.KA1_MAX_TERMS));
    // KALIBRIERUNG: die Liste ist nicht leer — sonst waeren alle Zusagen darunter vakuoes.
    expect(terms.length).toBeGreaterThan(3);
    // Die HTML-Entitaet ist AUFGELOEST: aus `pr&uuml;fen` wird der Stamm mit echtem Umlaut.
    expect(terms.some((term) => term.includes("ü"))).toBe(true);
    expect(terms.join(" ")).not.toContain("uuml");
    // Die WIEDERHOLUNG zaehlt einmal: „Wartung" steht zweimal im Text, einmal in der Liste.
    const wartung = terms.filter((term) => term.startsWith("wart"));
    expect(wartung.length).toBe(1);
    // STOPPWOERTER und KURZWOERTER sind draussen.
    for (const raus of ["die", "der", "ist", "zu", "bei", "das", "und", "ab"]) {
      expect(terms, `Stopp-/Kurzwort ${raus}`).not.toContain(raus);
    }
    // Die KENNUNG ueberlebt die Laengengrenze (mega54 A) — genau dafuer gibt es sie.
    expect(terms).toContain("m12");
  });

  it("der Deckel gilt und schneidet erst NACH der Entdopplung", () => {
    const ka1 = ladeKa1();
    expect(ka1.KA1_MAX_TERMS).toBeGreaterThan(0);
    // 40 verschiedene Inhaltswoerter, jedes dreimal — der Deckel greift, die Dopplung nicht.
    const viele = Array.from({ length: 40 }, (_v, i) => `Begriffwort${i} Begriffwort${i}`).join(
      " ",
    );
    const terms = ka1.ka1TermsFromText(viele);
    expect(terms.length).toBe(ka1.KA1_MAX_TERMS);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms).toEqual(kanonisch(viele, ka1.KA1_MAX_TERMS));
  });

  it("Kein-Egress: die Begriffsgewinnung ruft weder fetch noch Modell noch Embedder", () => {
    const ka1 = ladeKa1();
    const globals = globalThis as unknown as { fetch?: unknown; XMLHttpRequest?: unknown };
    const hatteFetch = "fetch" in globals;
    const originalFetch = globals.fetch;
    const hatteXhr = "XMLHttpRequest" in globals;
    const originalXhr = globals.XMLHttpRequest;
    const rufe: string[] = [];
    globals.fetch = (url: unknown): never => {
      rufe.push(`fetch:${String(url)}`);
      throw new Error("KA1 darf nicht senden");
    };
    globals.XMLHttpRequest = function XhrSpion(): never {
      rufe.push("xhr");
      throw new Error("KA1 darf nicht senden");
    };
    try {
      ka1.ka1TermsFromText(DOKUMENT);
      ka1.ka1TermsFromText("");
      ka1.ka1TermsFromText("Ventil pr&uuml;fen");
    } finally {
      if (hatteFetch) {
        globals.fetch = originalFetch;
      } else {
        Reflect.deleteProperty(globals, "fetch");
      }
      if (hatteXhr) {
        globals.XMLHttpRequest = originalXhr;
      } else {
        Reflect.deleteProperty(globals, "XMLHttpRequest");
      }
    }
    expect(rufe, "KA1 hat gesendet").toEqual([]);
    // Der STRUKTURELLE Beleg daneben: im ausgelieferten Block steht kein Sendeweg. Ein Test, der
    // nur die Laufzeit misst, uebersieht einen Zweig, den keine Fixture betritt.
    const html = read(TASKPANE);
    const block = html.slice(
      html.indexOf("// KW-KA1-TERMS-START"),
      html.indexOf("// KW-KA1-TERMS-END"),
    );
    for (const verboten of ["fetch(", "XMLHttpRequest", "sendBeacon", "/api/", "WebSocket"]) {
      expect(block, `KA1-Block enthaelt ${verboten}`).not.toContain(verboten);
    }
  });

  it("die Anzeige zeigt die Begriffe — und bei fehlendem Office ehrlich NICHTS statt Beispielen", () => {
    const ka1 = ladeKa1();
    const doc = (globalThis as unknown as { document: PanelDoc }).document;
    const vorher = doc.body.innerHTML;
    doc.body.innerHTML =
      '<div id="ka1-block" class="hidden"><ul id="ka1-terms"></ul><p id="ka1-empty"></p></div>';
    try {
      ka1.ka1Anzeigen(["wart", "ventil", "hallenkran"], true);
      const liste = doc.getElementById("ka1-terms");
      expect(liste?.textContent).toContain("ventil");
      expect(liste?.children.length).toBe(3);
      // Office/Word nicht verfuegbar: die Liste ist LEER — nie mit Beispielbegriffen gefuellt.
      ka1.ka1Anzeigen([], false);
      expect(doc.getElementById("ka1-terms")?.children.length).toBe(0);
      const leer = doc.getElementById("ka1-empty");
      expect((leer?.textContent ?? "").length).toBeGreaterThan(0);
      expect(leer?.className ?? "").not.toContain("hidden");
      // Und ein leeres Dokument MIT Office ist ebenfalls ehrlich leer.
      ka1.ka1Anzeigen([], true);
      expect(doc.getElementById("ka1-terms")?.children.length).toBe(0);
    } finally {
      doc.body.innerHTML = vorher;
    }
  });

  it("das Panel haelt das Begriffsbild als Zustand und zeigt ohne Word den ehrlichen Zustand", async () => {
    // Die Fixture entfernt `Word` bewusst — das ist GENAU der ehrliche Nicht-verfuegbar-Fall.
    const open = createKlaraPanel({});
    try {
      await open.flush();
      expect(open.q("#ka1-block")).not.toBeNull();
      // Die Fixture kennt bewusst kein `children` (schmaler Struktur-Typ, keine DOM-lib) — die
      // leere Liste wird deshalb an ihrem Text gemessen. Beides sagt dasselbe: da steht nichts.
      expect(open.text("#ka1-terms")).toBe("");
      expect(open.text("#ka1-empty").length).toBeGreaterThan(0);
      // Und die Begriffsgewinnung hat KEINEN einzigen Abruf ausgeloest.
      expect(open.calls.filter((call) => call.url.startsWith("/api/ask"))).toEqual([]);
    } finally {
      open.restore();
    }
  });
});
