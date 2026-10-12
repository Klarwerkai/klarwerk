// AUFNAHME 20260922 · GESAMT-KLARA-ASSISTENZ — der Abgleich je Anliegen bleibt am Baum.
//
// `docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md` nennt Pfade, Panelmarken und Befunde.
// Dieser Test hält sie fest: jeder genannte Pfad existiert, jede Marke steht im ausgelieferten
// Panel, und die Befunde W1, W1a und „Produktfamilie nicht begonnen“ gelten noch. Wird einer rot,
// ist der Abgleich nachzuführen (z. B. weil KA8 jetzt eine Karte hat) — nicht der Test aufzuweichen.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { panelQuelleAus } from "../support/panelquelle";

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), "utf8");

const ABGLEICH = lies("docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md");
// R-1611 (Drei-Datei-Schnitt): das Fenster liegt in `taskpane.html`/`.css`/`.js`; Marken und
// Funktionen des Skripts stehen in `taskpane.js`. `panelQuelleAus` fügt die drei Dateien zu genau
// dem einen Dokument zusammen, das dieser Abgleich bisher gelesen hat.
const PANEL = panelQuelleAus(join(WURZEL, "apps/web/public/word-addin/taskpane.html"));
const KA8_PFAD = "/api/drafts/:id/naechster-schritt";
const GELOESCHT_W5 = "tests/klara-panel/ka5-markierung-reist-mit.test.tsx";
// R-1349 (Auftrag aufruferwaechter): der KA8-Parallelweg, den W1a als ungerufen belegte, ist mit
// seinem Test begründet entfernt. Der Abgleich nennt beide weiter als Befund seines Stands .639.
const GELOESCHT_KA8_PARALLELWEG = [
  "services/app/src/routes/naechster-schritt-entwurf.ts",
  "tests/app/ka8-naechster-schritt-entwurf.test.ts",
];

/** Alle Repo-Pfade, die der Abgleich in Backticks nennt (ohne Zeilenangabe). */
function genanntePfade(text: string): string[] {
  const pfade = new Set<string>();
  for (const [, roh = ""] of text.matchAll(
    /`((?:apps|services|tests|tests-smoke|docs)\/[^`\s]+)`/g,
  )) {
    pfade.add(roh.replace(/:[\d,-]+$/, ""));
  }
  return [...pfade];
}

/** Alle Quelldateien unter einem Verzeichnis, rekursiv. */
function quelldateien(verzeichnis: string): string[] {
  const ergebnis: string[] = [];
  for (const name of readdirSync(join(WURZEL, verzeichnis))) {
    const pfad = join(verzeichnis, name);
    if (statSync(join(WURZEL, pfad)).isDirectory()) {
      ergebnis.push(...quelldateien(pfad));
    } else if (/\.(ts|tsx|js|html)$/.test(name)) {
      ergebnis.push(pfad);
    }
  }
  return ergebnis;
}

describe("Aufnahme Gesamt-Klara-Assistenz · Abgleich bleibt am Baum", () => {
  it("jeder genannte Pfad existiert", () => {
    const pfade = genanntePfade(ABGLEICH);
    // Kalibrierung: die Suche findet wirklich die Belegdateien, nicht nichts.
    expect(pfade).toContain("tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts");
    expect(pfade.length).toBeGreaterThan(20);
    const fehlend = pfade.filter((pfad) => !existsSync(join(WURZEL, pfad)));
    // W5 nennt die gelöschte KA5-Panelprüfung bewusst, W1a den entfernten KA8-Parallelweg. Genau
    // diese müssen fehlen, alles andere muss stehen.
    expect([...fehlend].sort()).toEqual([GELOESCHT_W5, ...GELOESCHT_KA8_PARALLELWEG].sort());
  });

  it("die Panelmarken von KA1, KA3, KA4, KA5 und KA7 stehen im ausgelieferten Panel", () => {
    for (const marke of [
      "KW-KA1-TERMS-START",
      "KW-KA3-KARTEN-START",
      "var KA3_TASTENRUHE_MS = 30000;",
      "KW-KA4-DOKUMENT-CONSENT-START",
      "darf ich dieses Dokument senden? Vertraulich Markiertes bleibt hier.",
      "JOB 3019 (KA5)",
      "KW-KA7-KONFLIKT-START",
      "window.klaraBestandsblick = ka2Bestandsblick;",
    ]) {
      expect(PANEL, marke).toContain(marke);
      if (marke.startsWith("KW-")) {
        expect(ABGLEICH, marke).toContain(`\`${marke}\``);
      }
    }
  });

  it("W1: die KA8-Route besteht, aber keine Fläche ruft sie auf", () => {
    expect(lies("services/app/src/routes/capture-routes.ts")).toContain(`"${KA8_PFAD}"`);
    const aufrufer = [...quelldateien("apps/web/src"), ...quelldateien("apps/web/public")].filter(
      (pfad) => lies(pfad).includes("/naechster-schritt"),
    );
    expect(aufrufer).toEqual([]);
  });

  // R-1349 (Auftrag aufruferwaechter): Der Parallelweg lag ungerufen im Baum, wie W1a es belegte.
  // Er ist seitdem begründet entfernt; dieselbe Auskunft liefert die registrierte Bestandsroute (W1).
  it("W1a: der KA8-Parallelweg ist entfernt und nirgends registriert", () => {
    for (const pfad of GELOESCHT_KA8_PARALLELWEG) {
      expect(existsSync(join(WURZEL, pfad)), pfad).toBe(false);
    }
    expect(lies("services/app/src/build-app.ts")).not.toContain("naechsterSchrittEntwurfRoutes");
  });

  it("R-0301 (Runde 2, B1): KA7 startet nur per Klick, der KA2-Treffer trägt keine Wertung", () => {
    // Jeder Aufruf von `ka7Pruefen` außerhalb von Deklaration und Kommentar ist ein Klickhandler.
    const aufrufe = PANEL.split("\n").filter(
      (zeile) =>
        zeile.includes("ka7Pruefen") &&
        !/^\s*\/\//.test(zeile) &&
        !zeile.includes("function ka7Pruefen()"),
    );
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const zeile of aufrufe) {
      expect(zeile).toMatch(/addEventListener\("click", ka7Pruefen\)/);
    }
    const ka2Treffer = PANEL.slice(
      PANEL.indexOf("function ka2Treffer("),
      PANEL.indexOf("return raus;", PANEL.indexOf("function ka2Treffer(")),
    );
    expect(ka2Treffer).toContain("raus.push({");
    expect(ka2Treffer).not.toContain("deviatesFrom");
    expect(ABGLEICH).toContain("Konfliktabgleich (KA7) startet der Nutzer selbst");
  });

  it("W3 (Runde 2, B2): die KA5-Teilbelege mit Einwilligung stehen, wo der Abgleich sie nennt", () => {
    expect(lies("services/app/src/routes/ka5-markierung.test.ts")).toContain(
      'it("KA5-R6f · auch die KA4-freigegebenen Zweige reichen die Markierung weiter"',
    );
    expect(lies("tests/ka5/markierung-kein-egress.test.ts")).toContain(
      'it("KA5-R3c · MIT KA4-Freigabe (der Modellweg) gilt derselbe Riegel"',
    );
    expect(ABGLEICH).toContain("`KA5-R6f`");
    expect(ABGLEICH).toContain("`KA5-R3c`");
  });

  it("R-1608 (Runde 2, B3): der M365-Folgeauftrag ist zugeordnet und abgegrenzt", () => {
    const vorgang = "aufnahme:20260922:m365-anmeldung";
    const hostabnahme = lies("docs/operations/word-web-hostabnahme.md");
    expect(hostabnahme).toContain(vorgang);
    expect(hostabnahme).toContain("entscheidung:ca86022d");
    expect(ABGLEICH).toContain(`\`${vorgang}\``);
    expect(ABGLEICH).toContain("`entscheidung:ca86022d`");
    expect(ABGLEICH).toContain("Er ersetzt **keine** Abnahme von KA1, KA3, KA4, KA5 oder KA7.");
  });

  it("Produktfamilie: das Manifest kennt nur Word", () => {
    const hosts = [...lies("docs/word-addin/klara-manifest.xml").matchAll(/<Host Name="(\w+)"/g)];
    expect(hosts.map(([, name]) => name)).toEqual(["Document"]);
  });
});
