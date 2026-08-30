// @vitest-environment jsdom
// ================================================================================================
// JOB 2703 · D1 — DER BELEG AN DER STELLE, WO DER MENSCH HANDELT: DIE KANDIDATENKARTE.
// ================================================================================================
//
// BEN in 2614 D4: „ein Feld am API-Endpunkt ist ein Scheinbeleg." Die Review-Queue (`Stufe2.tsx`)
// rendert die Aussage eines Kandidaten über `KoSummaryDisclosure` mit
// `text={displayImportText(c.item.statement, c.item.textCodec)}` — genau diese Komponente wird hier
// mit dem ECHTEN Mapper-Ergebnis gemountet. Gelesen wird `textContent`.
//
//   K1 · die Karte einer Drei-Absatz-Seite zeigt Absatz 1 — nicht Absatz 2 oder 3.
//   K2 · die Karte einer 30-KB-Seite zeigt höchstens 500 Zeichen Aussage.
//   K3 · GEGENPROBE: mit der alten Regel (ganzer Klartext als Aussage) stünde der ganze Text auf der
//        Karte — der Fall hängt an der Kürzung, nicht an der Komponente.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { KoSummaryDisclosure } from "../../apps/web/src/components/KoSummaryDisclosure";
import "../../apps/web/src/i18n";
import { displayImportText } from "../../apps/web/src/lib/htmlEntities";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
// JOB 2703 D2: die Kuerzungsregel liegt in `structure` (D1: library-analytics, umgelegt).
import { KERNAUSSAGE_MAX, htmlToPlainText } from "../../services/structure";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };
const ABSATZ_1 = "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.";
const ABSATZ_2 = "Danach wird der Druck am Manometer M4 abgelesen und im Schichtbuch vermerkt.";
const ABSATZ_3 = "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren.";

function seite(bodyHtml: string): ConfluencePage {
  return {
    id: "2703",
    title: "Überdruck an Ventil X",
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: "/spaces/K/pages/2703/x" },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Die Karte, wie Stufe2.tsx sie baut (Zeilen 549–553): Volltext-Override aus `item.statement`. */
function karte(
  statement: string,
  bodyHtml: string | undefined,
  textCodec: string | undefined,
): string {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      createElement(KoSummaryDisclosure, {
        source: { statement, ...(bodyHtml !== undefined ? { bodyHtml } : {}) },
        text: displayImportText(statement, textCodec),
        defaultOpen: true,
      }),
    );
  });
  return (container.textContent ?? "").replace(/\s+/g, " ").trim();
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 2703 · K — die Kandidatenkarte zeigt einen Satz, nicht die Seite", () => {
  it("K1 · drei Absätze: die Karte trägt Absatz 1 und weder Absatz 2 noch 3", () => {
    const item = mapConfluencePageToImportItem(
      seite(`<p>${ABSATZ_1}</p><p>${ABSATZ_2}</p><p>${ABSATZ_3}</p>`),
      OPTS,
    );
    const text = karte(item.statement, item.bodyHtml, item.textCodec);
    expect(text).toContain(ABSATZ_1);
    expect(text).not.toContain(ABSATZ_2);
    expect(text).not.toContain(ABSATZ_3);
  });

  it("K2 · 30 KB: die Karte trägt höchstens 500 Zeichen Aussage (plus die Beschriftung des Aufklappers)", () => {
    const satz =
      "Die Pumpe P-12 wird wöchentlich auf Dichtheit geprüft und das Ergebnis dokumentiert. ";
    const item = mapConfluencePageToImportItem(
      seite(`<p>${satz.repeat(Math.ceil(30_000 / satz.length))}</p>`),
      OPTS,
    );
    const text = karte(item.statement, item.bodyHtml, item.textCodec);
    expect(item.statement.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(text).toContain(item.statement);
    expect(text.length).toBeLessThan(KERNAUSSAGE_MAX + 200);
  });

  it("K3 · GEGENPROBE: die alte Regel stellte den ganzen Text auf die Karte", () => {
    const satz =
      "Die Pumpe P-12 wird wöchentlich auf Dichtheit geprüft und das Ergebnis dokumentiert. ";
    const item = mapConfluencePageToImportItem(
      seite(`<p>${satz.repeat(Math.ceil(30_000 / satz.length))}</p>`),
      OPTS,
    );
    const alteAussage = htmlToPlainText(item.bodyHtml ?? "");
    const text = karte(alteAussage, item.bodyHtml, item.textCodec);
    expect(text.length).toBeGreaterThan(30_000);
  });
});
