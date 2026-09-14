// @vitest-environment jsdom
// ================================================================================================
// JOB 4016 · LIEFERUNG 4+5 — DIE ANLEITUNG FUER WORD IM BROWSER UND DAS MANIFEST HALTEN ZUSAMMEN
// ================================================================================================
//
// Pedi fragt, ob Klara auch in Word fuer das Web (Chrome) laeuft. Bis hierher konnte das niemand
// ehrlich beantworten: `docs/word-addin/SIDELOAD-ANLEITUNG.md` heisst „Sideload-Anleitung (Mac)"
// und verlangt in ihrer Voraussetzungsliste „Word fuer Mac (Microsoft 365)"; ihr Weg A ist ein
// macOS-Containerpfad. Fuer den Browser gab es nichts.
//
// Diese Datei haelt zwei Dinge zusammen, die sonst auseinanderlaufen: die ANLEITUNG und das
// MANIFEST, das sie dem Menschen in die Hand gibt. Gelesen werden beide Dateien wirklich; das
// Manifest wird GEPARST (kein Zeichenkettenvergleich auf XML).
//
// WAS HIER NICHT NOCH EINMAL GEMESSEN WIRD: die Gleichheit von `<Version>` und der Cachekennung in
// `SourceLocation?v=`. Sie liegt vollstaendig in `tests/app/word-addin-taskpane-cache.test.ts`,
// Fall „SourceLocation endet auf `?v=<Version>` — beide Haelften aus DEMSELBEN Manifest gelesen",
// samt echter Mutations-Gegenprobe („die Invariante ERKENNT eine Divergenz"). Ein zweiter Messweg
// ueber dieselbe Zusage ist ausdruecklich unerwuenscht.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "..", "..");
const ORDNER = "docs/word-addin";
const MANIFEST_DATEI = "klara-manifest.xml";
const MAC_ANLEITUNG = `${ORDNER}/SIDELOAD-ANLEITUNG.md`;
const BROWSER_ANLEITUNG = `${ORDNER}/SIDELOAD-CHROME.md`;

function lies(rel: string): string {
  return readFileSync(resolve(WURZEL, rel), "utf8");
}

// Der Gate-tsc laeuft ohne DOM-lib — den jsdom-DOMParser ueber einen schmalen Struktur-Typ
// abgreifen (dasselbe Muster wie `tests/app/word-addin-taskpane-cache.test.ts:39-48`).
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

const manifestText = lies(`${ORDNER}/${MANIFEST_DATEI}`);
const manifest: XmlDocLike = new XmlParser().parseFromString(manifestText, "text/xml");
if (manifest.getElementsByTagName("parsererror").length > 0) {
  // Wohlgeformtheit ist die Voraussetzung dieser Datei; sie wird in `tests/app/word-addin.test.ts`
  // als eigener Fall gemessen. Hier bricht sie den Aufbau ab, statt still falsche Werte zu liefern.
  throw new Error(`${ORDNER}/${MANIFEST_DATEI} ist kein wohlgeformtes XML`);
}

function attribut(tag: string): string {
  return manifest.getElementsByTagName(tag)[0]?.getAttribute("DefaultValue") ?? "";
}

/** Die Domains, die das Manifest WIRKLICH fuehrt — aus dem geparsten Dokument, nicht behauptet. */
const MANIFEST_DOMAINS: readonly string[] = [
  ...Array.from(manifest.getElementsByTagName("AppDomain")).map((d) => d.textContent ?? ""),
  attribut("IconUrl"),
  attribut("HighResolutionIconUrl"),
  attribut("SupportUrl"),
  attribut("SourceLocation"),
]
  .map((url) => url.replace(/^https?:\/\//, "").split("/")[0] ?? "")
  .filter((host) => host.length > 0)
  .map((host) => host.toLowerCase());

/**
 * Eine Domain, die das Manifest NICHT fuehrt und die trotzdem in der Anleitung stehen darf: die
 * Originaldoku, auf die der Abschnitt „Was hier NICHT belegt ist" verweist. Der Auftrag verlangt
 * beides — den Verweis auf die Microsoft-Doku (Lieferung 4) und „keinen Host, den das Manifest
 * nicht fuehrt" (Lieferung 5). Die Aufloesung ist diese EINE benannte Ausnahme; sie ist Belegziel
 * und keine Herkunft, von der Klara etwas laedt oder der Klara etwas erlaubt.
 */
const BELEGQUELLEN: readonly string[] = ["learn.microsoft.com"];

/** Dateinamen sehen wie Domains aus. Sie sind keine. */
const DATEIENDUNG = /\.(md|ts|tsx|js|json|html|xml|png|css|yml|sh)$/;

/**
 * Domain-aehnliche Zeichenfolgen eines Textes. Bewusst weiter als „URL": auch eine nackte Domain
 * ohne Schema soll auffallen. Versionsnummern (`1.0.0.1`) fallen heraus, weil ihr letzter
 * Bestandteil keine Buchstaben traegt.
 */
function domainsAus(text: string): string[] {
  const roh = text.match(/\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\b/gi) ?? [];
  return [
    ...new Set(
      roh
        .map((t) => t.toLowerCase())
        .filter((t) => !DATEIENDUNG.test(t))
        .filter((t) => /^[a-z]{2,}$/.test(t.split(".").at(-1) ?? "")),
    ),
  ].sort();
}

describe("JOB 4016 · C · Anleitung und Manifest zeigen auf dasselbe", () => {
  it("C1 · es gibt eine Anleitung fuer Word im Browser, und sie zeigt auf dieselbe Manifestdatei", () => {
    expect(existsSync(resolve(WURZEL, BROWSER_ANLEITUNG))).toBe(true);
    const browser = lies(BROWSER_ANLEITUNG);
    const mac = lies(MAC_ANLEITUNG);
    // Sie handelt wirklich vom Browser-Weg und nicht noch einmal vom Mac.
    expect(browser).toContain("Word für das Web");
    expect(browser).toContain("Chrome");
    // Beide Anleitungen nennen DIESELBE Manifestdatei, und die Datei liegt unter diesem Namen.
    expect(browser).toContain(MANIFEST_DATEI);
    expect(mac).toContain(MANIFEST_DATEI);
    expect(existsSync(resolve(WURZEL, ORDNER, MANIFEST_DATEI))).toBe(true);
    // Der Verweis in der Mac-Anleitung steht an GENAU EINER Stelle (Auftrag §5.4).
    expect(mac.split("SIDELOAD-CHROME.md").length - 1).toBe(1);
  });

  it("C2 · die Taskpane-Adresse des Manifests ist HTTPS und liegt auf einer der AppDomains", () => {
    const quelle = attribut("SourceLocation");
    expect(quelle.startsWith("https://")).toBe(true);
    const appDomains = Array.from(manifest.getElementsByTagName("AppDomain")).map((d) =>
      (d.textContent ?? "").toLowerCase(),
    );
    expect(appDomains.length).toBeGreaterThan(0);
    const herkunft = quelle.slice(0, quelle.indexOf("/", "https://".length)).toLowerCase();
    expect(appDomains, `Herkunft ${herkunft} fehlt in den AppDomains`).toContain(herkunft);
    // Kalibrierung: die Herkunft ist wirklich Schema+Host und nicht die ganze Adresse.
    expect(herkunft).toBe("https://app.klarwerk.ai");
    // Und die Anleitung verspricht genau diese HTTPS-Voraussetzung.
    expect(lies(BROWSER_ANLEITUNG)).toContain(herkunft);
  });

  it("C3 · die Browser-Anleitung nennt keine Domain, die das Manifest nicht fuehrt", () => {
    const erlaubt = new Set([...MANIFEST_DOMAINS, ...BELEGQUELLEN]);
    const genannt = domainsAus(lies(BROWSER_ANLEITUNG));
    // Kalibrierung: der Fall ist nicht vakuos — die Anleitung nennt sehr wohl Domains.
    expect(genannt.length).toBeGreaterThan(0);
    expect(MANIFEST_DOMAINS).toContain("app.klarwerk.ai");
    for (const domain of genannt) {
      expect(erlaubt.has(domain), `${domain} steht in der Anleitung, aber nicht im Manifest`).toBe(
        true,
      );
    }
  });

  it("C4 · die Browser-Anleitung sagt, wo sie aufhoert — und behauptet keinen Lauf", () => {
    const browser = lies(BROWSER_ANLEITUNG);
    // Der Pflichtabschnitt und die drei Dinge, die darin ohne Beschoenigung stehen muessen.
    expect(browser).toContain("## Was hier NICHT belegt ist");
    const abschnitt = browser.slice(browser.indexOf("## Was hier NICHT belegt ist"));
    expect(abschnitt).toContain("SameSite=Lax");
    expect(abschnitt).toContain("JOB 3667");
    expect(abschnitt).toContain("JOB 4011");
    // Der Verweis auf die Originaldoku zu ITP und Drittanbieter-Cookies (nicht nacherzaehlt).
    expect(abschnitt).toContain("https://learn.microsoft.com/");
    expect(abschnitt.toLowerCase()).toContain("itp");
    // Kein behaupteter Office-Web-Lauf: es ist keiner gefahren.
    expect(browser).not.toMatch(/erfolgreich(e[mnrs]?)?\s+(Lauf|Sideload|Test|Anmeldung)/i);
    expect(browser).toContain("Kein Lauf in Word für das Web ist belegt.");
  });

  it("C5 · KALIBRIERUNG: eine fremde Domain im Text wuerde C3 wirklich rot machen", () => {
    // Ohne diesen Fall koennte C3 gruen sein, weil die Domain-Erhebung nichts findet.
    const erlaubt = new Set([...MANIFEST_DOMAINS, ...BELEGQUELLEN]);
    const gefunden = domainsAus(
      "Lade das Add-in von https://klarwerk-fake.ai/word-addin/taskpane.html (Version 1.0.0.1).",
    );
    expect(gefunden).toEqual(["klarwerk-fake.ai"]);
    expect(erlaubt.has("klarwerk-fake.ai")).toBe(false);
    // Und Dateinamen bleiben Dateinamen.
    expect(domainsAus("siehe klara-manifest.xml und SIDELOAD-CHROME.md")).toEqual([]);
  });
});
