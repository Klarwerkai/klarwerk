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

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lies = (pfad: string) => readFileSync(join(WURZEL, pfad), "utf8");

const ABGLEICH = lies("docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md");
const PANEL = lies("apps/web/public/word-addin/taskpane.html");
const KA8_PFAD = "/api/drafts/:id/naechster-schritt";
const GELOESCHT_W5 = "tests/klara-panel/ka5-markierung-reist-mit.test.tsx";

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
    // W5 nennt die gelöschte KA5-Panelprüfung bewusst. Sie muss fehlen, alles andere muss stehen.
    expect(fehlend).toEqual([GELOESCHT_W5]);
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

  it("W1a: der KA8-Parallelweg liegt noch im Baum und ist nicht registriert", () => {
    expect(lies("services/app/src/routes/naechster-schritt-entwurf.ts")).toContain(
      "export const NAECHSTER_SCHRITT_PFAD",
    );
    expect(lies("services/app/src/build-app.ts")).not.toContain("naechsterSchrittEntwurfRoutes");
  });

  it("Produktfamilie: das Manifest kennt nur Word", () => {
    const hosts = [...lies("docs/word-addin/klara-manifest.xml").matchAll(/<Host Name="(\w+)"/g)];
    expect(hosts.map(([, name]) => name)).toEqual(["Document"]);
  });
});
