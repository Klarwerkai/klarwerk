// @vitest-environment jsdom
//
// ================================================================================================
// JOB 3091 · M2 — DAS MEMO IM WORD-PANEL, am VOLLSTAENDIGEN ausgelieferten Aufgabenfenster.
// ================================================================================================
//
// Pedis Weg (§1): Antwort mit Quelle → Knopf „Memo aus dieser Quelle" → Entwurf mit Herkunftsblock
// und Anbieter → erst der ZWEITE Klick fuegt ein, mit der Herkunftszeile als letztem Absatz.
//
// RED-FIRST (§6): vor diesem Auftrag gab es weder `#ka6-memo-btn` noch `#ka6-memo-block` in
// taskpane.html — P1 scheiterte an „#ka6-memo-btn fehlt im Aufgabenfenster". Gegenprobe (Rueckgabe):
// den Einfuegeaufruf in `ka6MemoAnfordern` vorziehen → P3 rot („insertText wurde ohne Klick gerufen").
//
// BAUFORM: dieselbe wie `tests/app/word-addin-ask.test.ts` (JOB 1153, KA6 Stufe 1) — das ganze
// Fenster wird geladen, `fetch` ist ein Router ueber die echten Pfade, und der Spion sitzt auf den
// beiden einzigen SCHREIBWEGEN (`range.insertText` in `Word.run`, `setSelectedDataAsync`). Eine
// Abwesenheit („kein Schreibaufruf vor dem Klick") laesst sich nur am Host messen.
//
// Der Gate-`tsc` laeuft ohne DOM-lib; DOM-Zugriffe gehen ueber schmale Struktur-Typen (Muster aus
// word-addin-ask.test.ts:1113-1146).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

interface El {
  className: string;
  textContent: string | null;
  value: string;
  disabled: boolean;
  click(): void;
  dispatchEvent(ereignis: Event): boolean;
  querySelectorAll(sel: string): { length: number; [i: number]: { textContent: string | null } };
}
interface Dok {
  getElementById(id: string): El | null;
  body: { innerHTML: string };
}
interface Fenster {
  Office?: unknown;
  Word?: unknown;
  addEventListener(typ: string, fn: unknown): void;
  removeEventListener(typ: string, fn: unknown): void;
  Event: new (typ: string, init?: { bubbles?: boolean }) => Event;
}
const umgebung = globalThis as unknown as { document: Dok; window: Fenster };

/** Die Serverlage eines Falls — jedes Feld ist ein echtes Vertragsfeld oder eine Serverantwort. */
interface Lage {
  executionAllowed: boolean;
  blockedReason: string | null;
  effectiveMode: "deterministic" | "internal" | "external";
  /** Der Status, mit dem `GET /api/kos/ko-ka6` die Quelle liefert. */
  quellenStatus: "validiert" | "offen" | "http503" | "netz";
  /** Wie `POST /api/klara/sessions/{id}/zuruf` antwortet. */
  zurufStatus: 200 | 403 | 404 | 422 | 500;
}

const FRAGE = "Haben wir eine Regelung fuer Homeoffice?";
const ANTWORT = "Homeoffice ist an bis zu zwei Tagen je Woche nach Absprache moeglich.";
const MEMO =
  "Memo: Homeoffice ist an bis zu zwei Tagen je Woche moeglich, nach Absprache mit der Fuehrungskraft.";
const QUELLE_TITEL = "Regelung Homeoffice";
const QUELLE_VERSION = 3;
const ANBIETER = "anbieter-eins";
const MODELL = "modell-eins";
const SITZUNG = "sess-ka6";

let wordRunGesamt = 0;
let insertText = 0;
let setSelected = 0;
let eingefuegt: string[] = [];
let zuhoerer: Array<{ typ: string; fn: unknown }> = [];
let zurufAbgesetzt: Array<{
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}> = [];
let askAbgesetzt = 0;

function schreibaufrufe(): number {
  return insertText + setSelected;
}

function aufloesung(lage: Lage): Record<string, unknown> {
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
    effectivePayloadClasses: ["question"],
    blockedPayloadClasses: [],
  };
}

function sitzung(lage: Lage): Record<string, unknown> {
  return {
    sessionId: SITZUNG,
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-ka6",
    documentContextId: "doc-ka6",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    consentState: "none",
    closed: false,
    resolution: aufloesung(lage),
  };
}

/** Der Antwortkoerper von `POST /api/ask` — retrieval-only, eine Quelle, wie im Panelweg. */
function askKoerper(): Record<string, unknown> {
  return {
    result: {
      answered: true,
      answer: ANTWORT,
      sources: ["ko-ka6"],
      citedSources: ["ko-ka6"],
      trust: 70,
      evidence: { grade: "verified", sourcesConflicted: false, conflictsUnproven: false },
    },
    gap: null,
  };
}

/** Der Drahtvertrag der Route bei 200 (klara-session-routes.ts, `ZurufAntwort`). */
function zurufKoerper(): Record<string, unknown> {
  return {
    art: "erstellen",
    entwurf: MEMO,
    herkunft: [
      { koId: "ko-ka6", titel: QUELLE_TITEL, stufe: "validiert", version: QUELLE_VERSION },
    ],
    anbieter: ANBIETER,
    modell: MODELL,
    aiGenerated: true,
    generatedAt: new Date().toISOString(),
  };
}

function antwort(koerper: unknown, status = 200): unknown {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(koerper) };
}

function router(lage: Lage) {
  return (
    url: string,
    init?: { method?: string; body?: string; headers?: Record<string, string> },
  ) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/auth/me") {
      return Promise.resolve(antwort({ id: "u1", name: "Pruefer" }));
    }
    if (url === "/api/reasoner/status") {
      return Promise.resolve(antwort({ enabled: false, reachable: "none" }));
    }
    if (url === "/api/klara/sessions" && methode === "POST") {
      return Promise.resolve(antwort(sitzung(lage)));
    }
    if (url === "/api/klara/ai-status") {
      return Promise.resolve(antwort(aufloesung(lage)));
    }
    if (url === `/api/klara/sessions/${SITZUNG}/zuruf` && methode === "POST") {
      zurufAbgesetzt.push({
        url,
        body: JSON.parse(init?.body ?? "{}") as Record<string, unknown>,
        headers: init?.headers ?? {},
      });
      if (lage.zurufStatus === 200) {
        return Promise.resolve(antwort(zurufKoerper()));
      }
      if (lage.zurufStatus === 403) {
        return Promise.resolve(
          antwort(
            {
              error: "CONSENT_MISSING",
              message:
                "Ohne Einwilligung fuer dieses Dokument wird nichts formuliert und nichts gesendet.",
            },
            403,
          ),
        );
      }
      if (lage.zurufStatus === 422) {
        return Promise.resolve(antwort({ error: "NO_BASIS", message: "Kein Vorschlag." }, 422));
      }
      if (lage.zurufStatus === 404) {
        // Fastifys Standardform fuer eine NICHT registrierte Route — der Zustand eines Servers,
        // auf dem build-app.ts die Route (noch) nicht kennt.
        return Promise.resolve(
          antwort(
            {
              message: "Route POST:/api/klara/sessions/sess-ka6/zuruf not found",
              error: "Not Found",
              statusCode: 404,
            },
            404,
          ),
        );
      }
      return Promise.resolve(antwort({ error: "INTERNAL" }, 500));
    }
    if (url === "/api/ask" && methode === "POST") {
      askAbgesetzt += 1;
      return Promise.resolve(antwort(askKoerper()));
    }
    if (url.startsWith("/api/kos/")) {
      // R4 (BEN): der Quellenabruf kann scheitern — HTTP-Fehler oder verworfener Fetch. Beides
      // endet in resolveAskSources als `status: "unknown"`, nicht als „keine Quelle".
      if (lage.quellenStatus === "http503") {
        return Promise.resolve(antwort({ error: "UNAVAILABLE" }, 503));
      }
      if (lage.quellenStatus === "netz") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(
        antwort({
          id: "ko-ka6",
          title: QUELLE_TITEL,
          trust: 70,
          status: lage.quellenStatus,
          version: QUELLE_VERSION,
          createdAt: "2026-08-01T10:00:00.000Z",
        }),
      );
    }
    return Promise.resolve(antwort({}, 404));
  };
}

async function leerlauf(runden = 10): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

/** Laedt das VOLLSTAENDIGE Aufgabenfenster und haengt die Spione an den Host (Bauform JOB 1153). */
async function ladeFenster(lage: Lage): Promise<void> {
  vi.stubGlobal("fetch", router(lage));
  const quelle = read(TASKPANE);
  const skriptStart = quelle.lastIndexOf("<script>");
  const skriptEnde = quelle.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = quelle.slice(skriptStart + "<script>".length, skriptEnde);
  const bodyStart = quelle.indexOf("<body>");
  expect(bodyStart).toBeGreaterThan(0);
  const markup = quelle.slice(bodyStart + "<body>".length, skriptStart);
  expect(markup.length).toBeGreaterThan(2000);
  umgebung.document.body.innerHTML = markup;

  const COERCION = { Text: "text" } as const;
  const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;
  umgebung.window.Office = {
    context: {
      document: {
        url: "",
        addHandlerAsync() {
          /* kein Markierungswechsel im Pruefstand */
        },
        getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
          fn({ status: ASYNC_STATUS.Succeeded, value: "" });
        },
        setSelectedDataAsync(
          text: string,
          _opts: unknown,
          fn: (r: { status: string }) => void,
        ): void {
          setSelected += 1;
          eingefuegt.push(text);
          fn({ status: ASYNC_STATUS.Succeeded });
        },
      },
    },
    EventType: {},
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void) => cb(),
  };
  umgebung.window.Word = {
    InsertLocation: { replace: "replace" },
    run: (fn: (ctx: unknown) => unknown) => {
      wordRunGesamt += 1;
      const range = {
        insertText: (text: string) => {
          insertText += 1;
          eingefuegt.push(text);
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
  const originalAdd = umgebung.window.addEventListener.bind(umgebung.window);
  umgebung.window.addEventListener = (typ: string, fn: unknown) => {
    zuhoerer.push({ typ, fn });
    originalAdd(typ, fn);
  };
  new Function(skript)();
  await leerlauf();
}

function el(id: string): El {
  const gefunden = umgebung.document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as El;
}

function sichtbar(id: string): boolean {
  const e = umgebung.document.getElementById(id);
  return e !== null && !e.className.includes("hidden");
}

/** Der Wortlaut eines Schluessels — GELESEN aus dem ausgelieferten Fenster, nie abgeschrieben. */
function wortlaut(key: string, sprache = "de"): string {
  const quelle = read(TASKPANE);
  // Memo-Schluessel stehen in KA6_MEMO_TEXTE je Sprache; alle anderen (KA6_TEXTE, STRINGS) werden
  // im ganzen Fenster gesucht — der erste Treffer ist dort der deutsche Block.
  const memoStart = quelle.indexOf("var KA6_MEMO_TEXTE");
  const block = key.startsWith("ka6Memo") ? quelle.indexOf(`      ${sprache}: {`, memoStart) : -1;
  const ausschnitt = block > 0 ? quelle.slice(block) : quelle;
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)"`, "m").exec(ausschnitt);
  expect(treffer, `${TASKPANE}: ${key} (${sprache}) fehlt im Woerterbuch`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

/** Die erlaubte Lage: ausfuehrbar, Quelle validiert, Route antwortet mit einem Entwurf. */
function erlaubt(over: Partial<Lage> = {}): Lage {
  return {
    executionAllowed: true,
    blockedReason: null,
    effectiveMode: "external",
    quellenStatus: "validiert",
    zurufStatus: 200,
    ...over,
  };
}

/** Eine Frage stellen — ueber den echten Knopf, den echten Ask-Weg und die echte Quellenaufloesung. */
async function fragen(): Promise<void> {
  el("ask-input").value = FRAGE;
  el("ask-input").dispatchEvent(new umgebung.window.Event("input", { bubbles: true }));
  el("ask-btn").click();
  await leerlauf(30);
  expect(askAbgesetzt, "Die Frage ging nicht an /api/ask").toBeGreaterThan(0);
  expect(el("ask-answer-edit").value, "Keine Antwort im Feld").toContain(ANTWORT);
}

describe("JOB 3091 · M2 · das Memo im Word-Panel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    wordRunGesamt = 0;
    insertText = 0;
    setSelected = 0;
    eingefuegt = [];
    zuhoerer = [];
    zurufAbgesetzt = [];
    askAbgesetzt = 0;
  });

  afterEach(() => {
    for (const z of zuhoerer) {
      umgebung.window.removeEventListener(z.typ, z.fn);
    }
    zuhoerer = [];
    umgebung.window.Office = undefined;
    umgebung.window.Word = undefined;
    umgebung.document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("P0 · vor einer Antwort gibt es weder Knopf noch Satz — nichts wird behauptet", async () => {
    await ladeFenster(erlaubt());
    expect(sichtbar("ka6-memo-angebot")).toBe(false);
    expect(sichtbar("ka6-memo-btn")).toBe(false);
    expect(sichtbar("ka6-memo-keine-quelle")).toBe(false);
    expect(sichtbar("ka6-memo-block")).toBe(false);
  });

  it("P1 · Antwort mit VALIDIERTER Quelle → der Knopf „Memo aus dieser Quelle“ steht in der Antwortkarte, kein Absage-Satz", async () => {
    await ladeFenster(erlaubt());
    await fragen();
    expect(sichtbar("ka6-memo-angebot"), "Das Angebot fehlt").toBe(true);
    expect(sichtbar("ka6-memo-btn"), "Der Memo-Knopf fehlt").toBe(true);
    expect(el("ka6-memo-btn").textContent).toBe(wortlaut("ka6MemoCta"));
    expect(sichtbar("ka6-memo-keine-quelle")).toBe(false);
    // Das Angebot sitzt IN der Antwortkarte — nicht als Kind von #ask-answer-block (Zielbild K1 W2).
    expect(el("antwortkarte").querySelectorAll("#ka6-memo-btn").length).toBe(1);
    // Kein Entwurf, kein Schreibaufruf — der Knopf ist ein Angebot, nichts ist passiert.
    expect(sichtbar("ka6-memo-block")).toBe(false);
    expect(zurufAbgesetzt).toHaveLength(0);
    expect(schreibaufrufe()).toBe(0);
  });

  it("P2 · Antwort, deren Quelle NICHT validiert ist → kein Knopf, sondern der ehrliche Satz", async () => {
    await ladeFenster(erlaubt({ quellenStatus: "offen" }));
    await fragen();
    expect(sichtbar("ka6-memo-btn"), "Ohne validierte Quelle wird ein Memo angeboten").toBe(false);
    expect(sichtbar("ka6-memo-keine-quelle"), "Der Absage-Satz fehlt").toBe(true);
    expect(el("ka6-memo-keine-quelle").textContent).toBe(wortlaut("ka6MemoKeineQuelle"));
    // Eine erfolgreich geladene, nicht validierte Quelle ist KEIN „nicht feststellbar".
    expect(sichtbar("ka6-memo-quelle-unbekannt")).toBe(false);
    expect(zurufAbgesetzt).toHaveLength(0);
  });

  for (const [lage, name] of [
    ["http503", "HTTP 503"],
    ["netz", "Netzfehler (verworfener Fetch)"],
  ] as const) {
    it(`P2b · Antwort da, aber der Quellenabruf scheitert (${name}) → weder Knopf noch „keine validierte Quelle“, sondern „nicht feststellbar“`, async () => {
      // R4 (BEN, Korrekturpflicht 1): `resolveAskSources` faengt den Fehler und liefert `status:
      // "unknown"`; `currentAskSourcesResolved` steht danach trotzdem auf true. Bis R3 las das Panel
      // das als „keine validierte Quelle" — eine negative Aussage ohne Datengrundlage (§9).
      await ladeFenster(erlaubt({ quellenStatus: lage }));
      await fragen();
      expect(sichtbar("ka6-memo-angebot")).toBe(true);
      expect(sichtbar("ka6-memo-btn"), "Ohne geladene Quelle wird ein Memo angeboten").toBe(false);
      expect(
        sichtbar("ka6-memo-keine-quelle"),
        "Nach einem Abruffehler wird „keine validierte Quelle“ behauptet",
      ).toBe(false);
      expect(sichtbar("ka6-memo-quelle-unbekannt"), "Der Satz „nicht feststellbar“ fehlt").toBe(
        true,
      );
      expect(el("ka6-memo-quelle-unbekannt").textContent).toBe(wortlaut("ka6MemoQuelleUnbekannt"));
      expect(zurufAbgesetzt).toHaveLength(0);
      expect(schreibaufrufe()).toBe(0);
    });
  }

  it("P2c · EN: der Satz „nicht feststellbar“ steht auch auf Englisch da", async () => {
    await ladeFenster(erlaubt({ quellenStatus: "http503" }));
    await fragen();
    el("lang-en").click();
    await leerlauf(5);
    expect(el("ka6-memo-quelle-unbekannt").textContent).toBe(
      wortlaut("ka6MemoQuelleUnbekannt", "en"),
    );
    expect(sichtbar("ka6-memo-keine-quelle")).toBe(false);
  });

  it("P3 · Klick → die Route bekommt Quelle und Auftrag; der Entwurf steht mit Herkunft und Anbieter — und NULL Schreibaufrufe", async () => {
    await ladeFenster(erlaubt());
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);

    // (a) Genau EIN Abruf, mit der validierten Quelle, der Frage und den Bindungskopfzeilen.
    expect(zurufAbgesetzt).toHaveLength(1);
    const abruf = zurufAbgesetzt[0];
    expect(abruf?.body.koIds).toEqual(["ko-ka6"]);
    expect(abruf?.body.art).toBe("erstellen");
    expect(String(abruf?.body.text)).toContain(wortlaut("ka6MemoAuftrag"));
    expect(String(abruf?.body.text)).toContain(FRAGE);
    expect(abruf?.headers["x-klara-session"]).toBe(SITZUNG);
    expect(abruf?.headers["x-klara-document"]).toBe("doc-ka6");

    // (b) Der Entwurf ist SICHTBAR — als Vorschlag, mit Herkunftsblock und Anbieter/Modell.
    expect(sichtbar("ka6-memo-block"), "Die Memo-Karte fehlt").toBe(true);
    expect(el("ka6-memo-entwurf").textContent).toBe(MEMO);
    const herkunft = el("ka6-memo-herkunft").querySelectorAll("li");
    expect(herkunft.length).toBe(1);
    const zeile = herkunft[0]?.textContent ?? "";
    expect(zeile).toContain(QUELLE_TITEL);
    expect(zeile).toContain(`v${QUELLE_VERSION}`);
    // Der Pruefstand steht im Klartext des Woerterbuchs (dieselbe Tabelle wie die Quellen-Chips).
    expect(zeile).toContain(wortlaut("askStatusValidiert"));
    expect(el("ka6-memo-anbieter").textContent).toContain(ANBIETER);
    expect(el("ka6-memo-anbieter").textContent).toContain(MODELL);
    expect(el("ka6-memo-karte-status").textContent).toBe(wortlaut("ka6MemoReady"));
    expect(sichtbar("ka6-memo-einfuegen")).toBe(true);
    expect(sichtbar("ka6-memo-verwerfen")).toBe(true);

    // (c) „Klara schreibt NIE selbsttaetig ins Dokument" — beide Schreibwege bei NULL …
    expect(insertText, "insertText wurde ohne Klick gerufen").toBe(0);
    expect(setSelected, "setSelectedDataAsync wurde ohne Klick gerufen").toBe(0);
    expect(eingefuegt).toEqual([]);
    // … und der Spion ist nicht blind: `Word.run` hat er sehr wohl gesehen (KA1 liest beim Oeffnen).
    expect(wordRunGesamt, "Der Word-Spion haengt nicht").toBeGreaterThan(0);
  });

  it("P4 · erst der ZWEITE Klick fuegt ein — genau einmal, an der Auswahl, mit der Herkunftszeile als letztem Absatz", async () => {
    await ladeFenster(erlaubt());
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(schreibaufrufe(), "Vorbedingung verletzt: schon vor dem Klick geschrieben").toBe(0);

    el("ka6-memo-einfuegen").click();
    await leerlauf(20);

    expect(insertText, "Der Einfuegeweg lief nicht ueber insertText").toBe(1);
    expect(setSelected, "Der Rueckfall lief zusaetzlich").toBe(0);
    expect(eingefuegt).toHaveLength(1);
    const text = eingefuegt[0] ?? "";
    expect(text.startsWith(MEMO)).toBe(true);
    const absaetze = text.split("\n").filter((z) => z.trim().length > 0);
    const letzter = absaetze[absaetze.length - 1] ?? "";
    expect(letzter).toContain(QUELLE_TITEL);
    expect(letzter).toContain(`v${QUELLE_VERSION}`);
    expect(letzter.startsWith(wortlaut("ka6MemoHerkunftZeile").split("{")[0] ?? "Quelle:")).toBe(
      true,
    );
    // Die Statuszeile sagt, was geschah — und wo die Herkunft steht.
    expect(el("ka6-memo-karte-status").textContent).toBe(wortlaut("ka6MemoInsertOk"));
  });

  it("P5 · „Verwerfen“ nimmt den Entwurf zurueck — kein Schreibaufruf, die Karte geht", async () => {
    await ladeFenster(erlaubt());
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(sichtbar("ka6-memo-block")).toBe(true);
    el("ka6-memo-verwerfen").click();
    await leerlauf(5);
    expect(sichtbar("ka6-memo-block")).toBe(false);
    expect(el("ka6-memo-entwurf").textContent).toBe("");
    expect(schreibaufrufe()).toBe(0);
    // Ein Klick auf „In Word einfuegen" nach dem Verwerfen tut NICHTS — es gibt keinen Entwurf mehr.
    el("ka6-memo-einfuegen").click();
    await leerlauf(5);
    expect(schreibaufrufe()).toBe(0);
  });

  it("P6 · der Server sagt 403 (keine deckende Zustimmung) → der Zustimmungsweg von KA4/3079 wird gezeigt, kein Entwurf, kein zweiter Dialog", async () => {
    await ladeFenster(erlaubt({ zurufStatus: 403 }));
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(zurufAbgesetzt).toHaveLength(1);
    expect(sichtbar("ka6-memo-block"), "Trotz 403 steht ein Entwurf").toBe(false);
    // DERSELBE Satz wie die Schreibflaeche KA6 bei fehlender Zustimmung — er verweist auf den
    // Zustimmungskasten oben, nicht auf einen eigenen Dialog.
    expect(el("ka6-memo-status").textContent).toBe(wortlaut("ka6BlockedConsentMissing"));
    expect(schreibaufrufe()).toBe(0);
    // Kein zweiter Zustimmungsdialog ist entstanden: kein neues Consent-Element im Fenster.
    expect(umgebung.document.getElementById("ka6-memo-consent")).toBeNull();
  });

  it("P6b · 422 (keine Grundlage) → der ehrliche KA6-Satz, kein Entwurf", async () => {
    await ladeFenster(erlaubt({ zurufStatus: 422 }));
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(sichtbar("ka6-memo-block")).toBe(false);
    expect(el("ka6-memo-status").textContent).toBe(wortlaut("ka6NoBasis"));
    expect(schreibaufrufe()).toBe(0);
  });

  it("P6c · der Server kennt die Route nicht (404, build-app.ts ohne Registrierung) → das Panel sagt genau das, kein Entwurf, nichts geschrieben", async () => {
    await ladeFenster(erlaubt({ zurufStatus: 404 }));
    await fragen();
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(zurufAbgesetzt).toHaveLength(1);
    expect(sichtbar("ka6-memo-block")).toBe(false);
    expect(el("ka6-memo-status").textContent).toBe(wortlaut("ka6MemoServerKenntWegNicht"));
    // Kein Rueckfall auf den generischen Fehlersatz, kein Zustimmungssatz: die Lage ist eine andere.
    expect(el("ka6-memo-status").textContent).not.toBe(
      wortlaut("ka6Fehler").replace("{detail}", "HTTP 404"),
    );
    expect(el("ka6-memo-status").textContent).not.toBe(wortlaut("ka6BlockedConsentMissing"));
    expect(schreibaufrufe()).toBe(0);
  });

  it("P7 · die Aufloesung ist gesperrt (Zustimmung fehlt) → der Klick ruft die Route NICHT und zeigt den Zustimmungsweg", async () => {
    const lage = erlaubt();
    await ladeFenster(lage);
    await fragen();
    expect(sichtbar("ka6-memo-btn")).toBe(true);
    // Die Lage kippt serverseitig: die naechste Aufloesung sagt „external_consent_missing". Das
    // Fenster holt sie beim Ablauf der alten Aufloesung (klaraS4RefreshPlanen, 300 s) von selbst.
    lage.executionAllowed = false;
    lage.blockedReason = "external_consent_missing";
    await vi.advanceTimersByTimeAsync(301_000);
    await leerlauf(30);

    el("ka6-memo-btn").click();
    await leerlauf(20);
    expect(zurufAbgesetzt, "Trotz gesperrter Aufloesung ging ein Zuruf hinaus").toHaveLength(0);
    expect(sichtbar("ka6-memo-block")).toBe(false);
    expect(el("ka6-memo-status").textContent).toBe(wortlaut("ka6BlockedConsentMissing"));
    expect(schreibaufrufe()).toBe(0);
  });

  it("P8 · DE und EN gleichwertig: jeder Memo-Schluessel steht in beiden Sprachen, gleiche Platzhalter, und der Sprachwechsel zeichnet um", async () => {
    const quelle = read(TASKPANE);
    const start = quelle.indexOf("var KA6_MEMO_TEXTE");
    const ende = quelle.indexOf("// In das VORHANDENE Woerterbuch einhaengen", start);
    expect(start).toBeGreaterThan(0);
    expect(ende).toBeGreaterThan(start);
    const tabelle = new Function(`${quelle.slice(start, ende)} return KA6_MEMO_TEXTE;`)() as Record<
      string,
      Record<string, string>
    >;
    const de = Object.keys(tabelle.de ?? {}).sort();
    expect(de.length).toBeGreaterThanOrEqual(12);
    for (const sprache of ["en", "nl"]) {
      expect(Object.keys(tabelle[sprache] ?? {}).sort(), `${sprache}: Schluesselmenge`).toEqual(de);
      for (const key of de) {
        const a = tabelle.de?.[key] ?? "";
        const b = tabelle[sprache]?.[key] ?? "";
        expect(b.trim().length, `${sprache}.${key} ist leer`).toBeGreaterThan(0);
        expect(b, `${sprache}.${key} ist eine Kopie des Deutschen`).not.toBe(a);
        const platzhalter = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort();
        expect(platzhalter(b), `${sprache}.${key}: Platzhalter`).toEqual(platzhalter(a));
      }
    }

    await ladeFenster(erlaubt());
    await fragen();
    el("lang-en").click();
    await leerlauf(5);
    expect(el("ka6-memo-btn").textContent).toBe(wortlaut("ka6MemoCta", "en"));
    el("ka6-memo-btn").click();
    await leerlauf(30);
    expect(el("ka6-memo-einfuegen").textContent).toBe(wortlaut("ka6MemoInsertCta", "en"));
    expect(el("ka6-memo-verwerfen").textContent).toBe(wortlaut("ka6MemoVerwerfenCta", "en"));
    expect(el("ka6-memo-anbieter").textContent).toContain(ANBIETER);
  });
});
