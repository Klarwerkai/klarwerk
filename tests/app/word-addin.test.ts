// @vitest-environment jsdom
// WP-KLARA-1 (Klara in Word): Node-/jsdom-Tests für den ersten Add-in-Schritt. Getestet: die reinen
// Hilfslogiken (Titel-Ableitung, Absatz-Escaping) im DOM-freien Modul, die VERHALTENS-Äquivalenz der
// Inline-Kopie in taskpane.html (Marker-Block wird extrahiert und ausgeführt — kein Text-Diff, echte
// Gleichheit auf Fixtures), die Wohlgeformtheit des Manifest-XML (jsdom-DOMParser) und die Pfad-/
// CSP-Verdrahtung (public/word-addin, gezielte Server-Ausnahme NUR für /word-addin/*).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  WORD_ADDIN_FALLBACK_TITLE,
  WORD_ADDIN_LOGIN_POLL_MAX_MS,
  deriveDraftTitleFromSelection,
  loginPollDecision,
  loginPollStep,
  selectionToBodyHtml,
} from "../../apps/web/src/lib/wordAddin";

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

describe("WP-KLARA-1: Inline-Kopie im Taskpane ist VERHALTENSGLEICH zum Modul", () => {
  it("Marker-Block extrahieren, ausführen und auf Fixtures gegen das Modul vergleichen", () => {
    const html = read(TASKPANE);
    const start = html.indexOf("// KW-WORDADDIN-HELPERS-START");
    const end = html.indexOf("// KW-WORDADDIN-HELPERS-END");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = html.slice(start, end);
    const factory = new Function(
      `${block}; return { deriveDraftTitleFromSelection: deriveDraftTitleFromSelection, selectionToBodyHtml: selectionToBodyHtml, loginPollDecision: loginPollDecision, loginPollStep: loginPollStep };`,
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
    };
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
    expect(doc.getElementsByTagName("SourceLocation")[0]?.getAttribute("DefaultValue")).toBe(
      "https://app.klarwerk.ai/word-addin/taskpane.html",
    );
    // WP-KLARA-1b (K3, Least-Privilege): NUR lesen (getSelectedDataAsync) — keine Dokumentmutation,
    // also KEIN ReadWriteDocument.
    expect(text("Permissions")).toBe("ReadDocument");
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

  it("Taskpane: office.js von der offiziellen CDN, echte Endpunkte, ehrliche Grenzen, kein KI-Versprechen", () => {
    const html = read(TASKPANE);
    expect(html).toContain("https://appsforoffice.microsoft.com/lib/1/hosted/office.js");
    // (a) Session-Check über den BESTEHENDEN Endpunkt, (b) Entwurf über die BESTEHENDE Draft-API.
    expect(html).toContain('fetch("/api/auth/me", { credentials: "include" })');
    expect(html).toContain('fetch("/api/drafts"');
    expect(html).toContain('credentials: "include"');
    expect(html).toContain('origin: "frontdoor"');
    // Ehrlichkeit: ENTWURF, keine KI-Behauptung — das EINZIGE Vorkommen von „KI" ist die ausdrückliche
    // Negation im Kopf-Kommentar („keine KI"); die Nutzertexte versprechen nichts dergleichen.
    const kiHits = html.match(/\bKI\b/g) ?? [];
    expect(kiHits.length).toBe(1);
    expect(html).toContain("keine KI");
    expect(html).toContain("kommt spaeter");
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
    expect(html).toContain("Diese Seite laeuft als Klara-Panel in Microsoft Word.");
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
