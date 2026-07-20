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
  deriveDraftTitleFromSelection,
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
      `${block}; return { deriveDraftTitleFromSelection: deriveDraftTitleFromSelection, selectionToBodyHtml: selectionToBodyHtml };`,
    );
    const inline = factory() as {
      deriveDraftTitleFromSelection: (text: string) => string;
      selectionToBodyHtml: (text: string) => string;
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

  it("Sideload-Anleitung existiert mit beiden Wegen (Hochladen + wef-Ordner)", () => {
    const md = read("docs/word-addin/SIDELOAD-ANLEITUNG.md");
    expect(md).toContain("Mein Add-In hochladen");
    expect(md).toContain("wef");
    expect(md).toContain("Troubleshooting");
  });
});
