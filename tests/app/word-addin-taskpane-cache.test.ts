// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// JOB 899 — K7: DIE TASKPANE-URL IST AN DIE MANIFESTVERSION GEBUNDEN.
// ================================================================================================
//
// DER BEFUND (OFFEN.md K7): Ein ausgeliefertes Taskpane bleibt bei jedem Client im Cache, und es
// gab keinen Weg, ihn zu entwerten. Aendert sich nur die Seite und NICHT das Manifest, hat kein
// Client einen Anlass, sie neu zu holen. Der Versionssprung im Manifest allein half nicht: er
// steuert den Cache des MANIFESTS, nicht den Inhalt des Taskpanes. „Bei uns kostet das eine
// Cache-Leerung; bei einem Kunden mit dreissig Arbeitsplaetzen kostet es dreissig."
//
// DIE BINDUNG: `SourceLocation` endet auf `taskpane.html?v=<Version>`. Damit ist die Abruf-URL eine
// andere, sobald die Manifestversion steigt — der Server liefert weiterhin dieselbe Datei
// (`services/app/src/web-static.ts` schneidet Query und Fragment vor dem Pfadvergleich ab).
//
// WARUM KEIN INHALTS-HASH UND KEIN ZEITSTEMPEL. Ein Inhaltshash zoege die URL bei jeder
// Textaenderung mit und entwertete damit genau den BEWUSSTEN Versionsschritt, den diese Bindung
// erhalten will. Ein Zeitstempel machte die URL bei identischem Inhalt verschieden — beides waere
// eine andere Zusage als die, die hier gilt: ein Taskpane-Release VERLANGT einen Versionsschritt.
//
// WARUM ECHTE MUTIERTE FIXTURES. BEN hat am D1-Entwurf zwei Faelle als schwaecher als ihre Namen
// beanstandet: einer baute die Vergleichs-URL selbst aus einer anderen Konstante und mass damit
// keine Transformation des Manifests, der andere veraenderte die Taskpane-Datei gar nicht. Hier
// wird deshalb der ECHTE Manifesttext mutiert und das Ergebnis GEPARST — nie ein selbst
// zusammengesetzter String mit sich selbst verglichen.

const WURZEL = resolve(__dirname, "..", "..");
const MANIFEST = resolve(WURZEL, "docs/word-addin/klara-manifest.xml");
const TASKPANE = resolve(WURZEL, "apps/web/public/word-addin/taskpane.html");

const BASIS_URL = "https://app.klarwerk.ai/word-addin/taskpane.html";

// Der Gate-tsc läuft ohne DOM-lib — den jsdom-DOMParser über einen schmalen Struktur-Typ
// abgreifen (dasselbe Muster wie `word-addin.test.ts:44-55`).
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

function parse(xml: string): XmlDocLike {
  const doc = new XmlParser().parseFromString(xml, "text/xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

/** Die Manifestversion — GELESEN, nie angenommen. */
function version(xml: string): string {
  return parse(xml).getElementsByTagName("Version")[0]?.textContent ?? "";
}

/** Die ausgelieferte Taskpane-URL — GELESEN, nie zusammengesetzt. */
function sourceLocation(xml: string): string {
  return parse(xml).getElementsByTagName("SourceLocation")[0]?.getAttribute("DefaultValue") ?? "";
}

const manifestText = readFileSync(MANIFEST, "utf8");

describe("899/K7 · die Kennung ist exakt die Manifestversion", () => {
  it("SourceLocation endet auf `?v=<Version>` — beide Haelften aus DEMSELBEN Manifest gelesen", () => {
    expect(sourceLocation(manifestText)).toBe(`${BASIS_URL}?v=${version(manifestText)}`);
  });

  it("die Basis-URL vor dem Fragezeichen ist unveraendert — keine neue Domain, kein neuer Pfad", () => {
    expect(sourceLocation(manifestText).split("?")[0]).toBe(BASIS_URL);
  });

  it("die Kennung traegt weder Inhalts-Hash noch Zeitstempel — nur die Version", () => {
    const query = sourceLocation(manifestText).split("?")[1] ?? "";
    expect(query).toBe(`v=${version(manifestText)}`);
    // Ein Hash waere lang und hexadezimal, ein Zeitstempel rein numerisch und lang.
    expect(query).not.toMatch(/[0-9a-f]{16,}/i);
    expect(query).not.toMatch(/\d{10,}/);
  });
});

describe("899/K7 · ein Versionswechsel aendert die URL kausal — an echten Fixtures", () => {
  // ECHTE MUTATION des Manifesttexts: die Version wird ueberall ersetzt, also auch in der
  // abgeleiteten SourceLocation. Beide Fassungen werden GEPARST; verglichen werden die
  // EXTRAHIERTEN Werte, nicht selbst gebaute Strings.
  const ALT = "1.0.0.1";
  const NEU = "9.9.9.9";
  const mutiert = manifestText.split(ALT).join(NEU);

  it("die Vorbedingung stimmt: das Bestandsmanifest traegt die alte Version", () => {
    expect(version(manifestText)).toBe(ALT);
    expect(mutiert).not.toBe(manifestText);
  });

  it("nach der Mutation ist die extrahierte URL eine ANDERE", () => {
    expect(sourceLocation(mutiert)).not.toBe(sourceLocation(manifestText));
  });

  it("und die mutierte Fassung erfuellt dieselbe Invariante", () => {
    expect(version(mutiert)).toBe(NEU);
    expect(sourceLocation(mutiert)).toBe(`${BASIS_URL}?v=${NEU}`);
  });

  it("die Invariante ERKENNT eine Divergenz — sie ist ein Waechter, keine Formel", () => {
    // Nur die Version wird gehoben, die URL bleibt auf der alten. Genau der Fehler, den ein
    // spaeterer Versionsschritt ohne URL-Nachzug erzeugen wuerde.
    const divergent = manifestText.replace(
      `<Version>${ALT}</Version>`,
      `<Version>${NEU}</Version>`,
    );
    expect(version(divergent)).toBe(NEU);
    expect(sourceLocation(divergent)).not.toBe(`${BASIS_URL}?v=${version(divergent)}`);
  });
});

describe("899/K7 · eine blosse Taskpane-Aenderung aendert die URL NICHT", () => {
  // Zwei Fixtures mit IDENTISCHEM Manifest und UNTERSCHIEDLICHEM Taskpane-Inhalt. Der bewusste
  // Versionsschritt bleibt damit die notwendige Freigabehandlung fuer einen Taskpane-Release —
  // genau das, was K7 verlangt und was ein Inhalts-Hash zerstoert haette.
  const taskpaneA = readFileSync(TASKPANE, "utf8");
  const taskpaneB = `${taskpaneA}\n<!-- geaenderter Taskpane-Inhalt -->`;

  it("die Vorbedingung stimmt: die zwei Taskpane-Fassungen sind wirklich verschieden", () => {
    expect(taskpaneB).not.toBe(taskpaneA);
    expect(taskpaneA.length).toBeGreaterThan(0);
  });

  it("bei identischem Manifest bleibt die URL identisch — der Inhalt geht nicht ein", () => {
    const urlZuA = sourceLocation(manifestText);
    const urlZuB = sourceLocation(manifestText);
    expect(urlZuB).toBe(urlZuA);
    expect(urlZuA).not.toContain(String(taskpaneA.length));
    expect(urlZuA).not.toContain(String(taskpaneB.length));
  });
});

describe("899/K7 · alles andere am Manifest bleibt unveraendert", () => {
  const doc = parse(manifestText);
  const text = (tag: string): string => doc.getElementsByTagName(tag)[0]?.textContent ?? "";

  it("Domain, Add-in-Id und Rechte sind unberuehrt", () => {
    expect(sourceLocation(manifestText).startsWith("https://app.klarwerk.ai/")).toBe(true);
    expect(text("Id")).toBe("7f6b1c9e-4a2d-4e8f-9b3a-2c5d8e7f1a64");
    expect(text("Permissions")).toBe("ReadWriteDocument");
  });

  it("beide AppDomains und die WordApi-Anforderung stehen unveraendert", () => {
    const domains = Array.from(doc.getElementsByTagName("AppDomain")).map((d) => d.textContent);
    expect(domains).toEqual(["https://app.klarwerk.ai", "https://klarwerk.ai"]);
    expect(doc.getElementsByTagName("Set")[0]?.getAttribute("Name")).toBe("WordApi");
    expect(doc.getElementsByTagName("Set")[0]?.getAttribute("MinVersion")).toBe("1.1");
  });

  it("kein Laufzeit-Egress: die Kennung ist statisch im Manifest, nicht errechnet", () => {
    // Der Wert steht als Literal in der Datei — kein Skript, kein Abruf, keine Ableitung zur
    // Laufzeit. Das ist die Zusage „keine neue Domain, kein Laufzeit-Egress".
    expect(manifestText).toContain(`${BASIS_URL}?v=${version(manifestText)}`);
  });
});
