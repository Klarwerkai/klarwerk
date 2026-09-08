// ================================================================================================
// JOB 3288 · LIEFERUNG 4 — DIE DATEN WERDEN NICHT UMGEDEUTET, UM DIE ANZEIGE ZU RETTEN.
// ================================================================================================
//
// DIE VERSUCHUNG, die dieser Test verbietet: Auf den Advisor-Seiten ist der erste Absatz ein
// DEMO-Hinweis. Es waere ein Einzeiler, im Mapper „wenn der erste Absatz mit DEMO/Disclaimer
// beginnt, nimm den zweiten" zu schreiben — und genau das waere geraten. Ein Dokumentkopf ist eine
// uebliche Form; welcher Absatz die Kernaussage traegt, weiss der Mapper nicht.
//
// Die richtige Antwort steht seit JOB 3288 auf der Fläche: der GANZE Text ist aufklappbar da
// (`tests/import-volltext/pruefkarte-zeigt-volltext-und-quelle.test.tsx`). Die REGEL bleibt
// unveraendert — erster Absatz, hoechstens KERNAUSSAGE_MAX Zeichen — und dieser Test haelt sie an
// genau dem Fall fest, der zur Ausnahme verfuehrt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { KERNAUSSAGE_MAX } from "../../services/structure";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "ADV" };
const DEMO = "DEMO-Inhalt: Diese Seite dient der Vorführung und ist kein Beratungsergebnis.";
const FACH_1 = "Die Netzentgelte werden je Entnahmestelle nach Jahresbenutzungsdauer bestimmt.";
const FACH_2 = "Bei mehr als 2.500 Stunden gilt der Leistungspreis, sonst der Arbeitspreis.";

function seite(bodyHtml: string): ConfluencePage {
  return {
    id: "3288",
    title: "Netzentgelte",
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: "/spaces/ADV/pages/3288/Netzentgelte" },
    metadata: { labels: { results: [] } },
  } as unknown as ConfluencePage;
}

describe("JOB 3288 · die Kernaussage-Regel bleibt, auch wenn der erste Absatz ein Hinweis ist", () => {
  it("K1 · ein DEMO-Kopf BLEIBT die Kernaussage — der Mapper überspringt ihn nicht", () => {
    const item = mapConfluencePageToImportItem(
      seite(`<p>${DEMO}</p><p>${FACH_1}</p><p>${FACH_2}</p>`),
      OPTS,
    );
    expect({
      statement: item.statement,
      unterDerKante: item.statement.length <= KERNAUSSAGE_MAX,
    }).toEqual({ statement: DEMO, unterDerKante: true });
  });

  it("K2 · der Volltext reist vollständig mit — nichts wird beim Abbilden weggeschnitten", () => {
    const item = mapConfluencePageToImportItem(
      seite(`<p>${DEMO}</p><p>${FACH_1}</p><p>${FACH_2}</p>`),
      OPTS,
    );
    const body = item.bodyHtml ?? "";
    expect({
      demo: body.includes(DEMO),
      fach1: body.includes(FACH_1),
      fach2: body.includes(FACH_2),
      quelle: item.url,
    }).toEqual({
      demo: true,
      fach1: true,
      fach2: true,
      quelle: "https://acme.atlassian.net/wiki/spaces/ADV/pages/3288/Netzentgelte",
    });
  });

  it("K3 · SAMMLER: weder Mapper noch Kernaussage-Regel kennen ein inhaltliches Schlüsselwort", () => {
    // Kein „wenn da DEMO steht"-Sonderweg — gesucht wird die BAUFORM, nicht der heutige Fall.
    const wurzel = join(__dirname, "../..");
    const verdaechtig = /\b(DEMO|Disclaimer|Hinweistext|Vorführung|Platzhalter)\b/i;
    const treffer = [
      "services/confluence/src/mapper.ts",
      "services/structure/src/kernaussage.ts",
    ].filter((datei) => {
      const quelle = readFileSync(join(wurzel, datei), "utf8")
        // Kommentare duerfen den Fall benennen — nur CODE darf ihn nicht entscheiden.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      return verdaechtig.test(quelle);
    });
    expect(treffer, "eine inhaltliche Sonderregel ist in den Kern gerutscht").toEqual([]);
  });
});
