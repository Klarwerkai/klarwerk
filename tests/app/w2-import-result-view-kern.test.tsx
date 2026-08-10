// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DIE SICHTBARE TRENNUNG, GEMOUNTET GEMESSEN.
// ================================================================================================
//
// Der reine Kern (`w2-import-result-view-kern.test.ts`) beweist die ABBILDUNG. Dieser Test beweist,
// dass die Abbildung auch ANKOMMT: dass Original und Wissen wirklich zwei getrennte Objekte auf
// dem Bildschirm sind, dass ein Teilfehler nicht wie ein Erfolg aussieht und dass jeder Zustand
// auch ohne Farbwahrnehmung lesbar ist.
//
// Gemountet, nicht gerendert-und-geglaubt: die Komponenten laufen im jsdom durch React, und
// gemessen wird das entstandene DOM — dieselbe Bauart wie die uebrigen `*-mounted`-Tests.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportResultView } from "../../apps/web/src/components/confluence-import/ImportResultView";
import i18n from "../../apps/web/src/i18n";
import type { ImportResultViewInput } from "../../apps/web/src/lib/importResultView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

// Mehrfaches Mounten im selben Fall ist ausdruecklich erlaubt (die Zustandsschleife unten braucht
// es): ein etwaiger Vorlauf wird zuerst sauber abgebaut, damit nie zwei Baeume gleichzeitig stehen.
function mount(result: ImportResultViewInput | null): void {
  unmount();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(ImportResultView, { result }));
  });
}

function unmount(): void {
  if (!root) {
    return;
  }
  act(() => {
    root.unmount();
  });
  container.remove();
  root = undefined as unknown as ReturnType<typeof createRoot>;
}

afterEach(async () => {
  unmount();
  if (i18n.language !== "de") {
    await i18n.changeLanguage("de");
  }
});

function q(testid: string): Element | null {
  return container.querySelector(`[data-testid="${testid}"]`);
}

function alle(testid: string): Element[] {
  return [...container.querySelectorAll(`[data-testid="${testid}"]`)];
}

const QUELLE = {
  sourceRecordId: "src-1",
  sourceSystem: "confluence",
  externalId: "123456",
  sourceVersion: "7",
  url: "https://example.invalid/wiki/wartung",
  title: "Wartung der Ventilstation",
  importedAt: "2026-08-02T09:00:00.000Z",
};

function einheit(over: Record<string, unknown> = {}) {
  return {
    candidateItemId: "item-1",
    knowledgeObjectId: "ko-1",
    extractedStatement: "Vor der Wartung Druck ablassen.",
    locator: "Absatz 3",
    validationStatus: "offen",
    conflictIds: [],
    knowledgeGapIds: [],
    ...over,
  };
}

/** Der Demo-Fall des Auftrags: EINE Quelle, DREI Einheiten. */
const EINE_QUELLE_DREI_EINHEITEN: ImportResultViewInput = {
  run: { importId: "imp-1", status: "COMPLETED" },
  source: QUELLE,
  items: [
    einheit({ candidateItemId: "a", extractedStatement: "Vor der Wartung Druck ablassen." }),
    einheit({ candidateItemId: "b", extractedStatement: "Ventil danach gegen Anlauf sichern." }),
    einheit({ candidateItemId: "c", extractedStatement: "Pruefprotokoll im Schrank ablegen." }),
  ],
};

// ================================================================================================
// BLOCK A — zwei Objekte, sichtbar getrennt
// ================================================================================================
describe("AUFTRAG-23 BLOCK A: Original und Wissen sind zwei getrennte Bloecke", () => {
  it("beide Bloecke existieren als eigene benannte Bereiche", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    const quelle = q("w2-source");
    const wissen = q("w2-knowledge");
    expect(quelle, "Der Original-Block fehlt").not.toBeNull();
    expect(wissen, "Der Wissen-Block fehlt").not.toBeNull();
    // Jeder traegt eine eigene Ueberschrift — nicht eine gemeinsame, die beides einrahmt.
    expect(quelle?.getAttribute("aria-labelledby")).toBe("w2-source-heading");
    expect(wissen?.getAttribute("aria-labelledby")).toBe("w2-knowledge-heading");
    expect(container.querySelector("#w2-source-heading")?.textContent).toBe("Original");
    expect(container.querySelector("#w2-knowledge-heading")?.textContent).toBe("Wissenseinheiten");
  });

  it("KEINER der beiden liegt im anderen — sie sind Geschwister, keine Verschachtelung", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    const quelle = q("w2-source") as Element;
    const wissen = q("w2-knowledge") as Element;
    expect(quelle.contains(wissen), "Wissen steckt im Original").toBe(false);
    expect(wissen.contains(quelle), "Original steckt im Wissen").toBe(false);
  });

  it("die Reihenfolge im DOM ist Original vor Wissen — die Entstehungsrichtung", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    const position = (q("w2-source") as Element).compareDocumentPosition(
      q("w2-knowledge") as Element,
    );
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(position & 4).toBeTruthy();
  });
});

// ================================================================================================
// BLOCK B — eine Quelle, n Einheiten
// ================================================================================================
describe("AUFTRAG-23 BLOCK B: eine Quelle traegt n Einheiten in gelieferter Reihenfolge", () => {
  it("drei Einheiten ergeben drei Zeilen — in genau der gelieferten Folge", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    const zeilen = alle("w2-knowledge-item");
    expect(zeilen.length).toBe(3);
    expect(alle("w2-item-statement").map((e) => e.textContent)).toEqual([
      "Vor der Wartung Druck ablassen.",
      "Ventil danach gegen Anlauf sichern.",
      "Pruefprotokoll im Schrank ablegen.",
    ]);
    expect(zeilen.map((z) => z.getAttribute("data-position"))).toEqual(["1", "2", "3"]);
  });

  it("die Liste ist geordnet ausgezeichnet — die Reihenfolge ist bedeutungstragend", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    expect((q("w2-knowledge-list") as Element).tagName).toBe("OL");
  });

  it("das Original zeigt Titel, System, Version, Adresse und Importzeit", () => {
    mount(EINE_QUELLE_DREI_EINHEITEN);
    const text = (q("w2-source") as Element).textContent ?? "";
    expect(text).toContain("Wartung der Ventilstation");
    expect(text).toContain("confluence");
    expect(text).toContain("7");
    expect(text).toContain("https://example.invalid/wiki/wartung");
    expect(text).toContain("2026-08-02T09:00:00.000Z");
    // Und das Original enthaelt KEINE Aussage — die gehoert in den anderen Block.
    expect(text).not.toContain("Vor der Wartung Druck ablassen.");
  });

  it("eine sichere Adresse wird verlinkt, eine unsichere bleibt reiner Text", () => {
    mount({ ...EINE_QUELLE_DREI_EINHEITEN, source: QUELLE });
    const link = (q("w2-source") as Element).querySelector("a[href]");
    expect(link?.getAttribute("href")).toBe("https://example.invalid/wiki/wartung");
    act(() => {
      root.render(
        createElement(ImportResultView, {
          result: {
            ...EINE_QUELLE_DREI_EINHEITEN,
            // eslint-disable-next-line no-script-url
            source: { ...QUELLE, url: "javascript:alert(1)" },
          },
        }),
      );
    });
    expect(
      (q("w2-source") as Element).querySelector("a[href]"),
      "Ein unsicheres Schema darf nie anklickbar werden",
    ).toBeNull();
  });
});

// ================================================================================================
// BLOCK C — die neun Laufzustaende, ehrlich
// ================================================================================================
describe("AUFTRAG-23 BLOCK C: jeder Laufzustand ist unterscheidbar und ehrlich", () => {
  const NEUN = [
    "QUEUED",
    "FETCHING",
    "PERSISTING_SOURCE",
    "EXTRACTING",
    "CREATING_KNOWLEDGE",
    "ANALYZING",
    "COMPLETED",
    "PARTIAL",
    "FAILED",
  ];

  it("alle neun erzeugen je einen eigenen sichtbaren Namen", () => {
    const gesehen = new Set<string>();
    for (const status of NEUN) {
      mount({ run: { status }, source: QUELLE, items: [einheit()] });
      const label = q("w2-run-label")?.textContent ?? "";
      expect(label.length, `${status} ohne sichtbaren Namen`).toBeGreaterThan(0);
      gesehen.add(label);
    }
    expect(gesehen.size, "Zwei Zustaende teilen sich einen Namen").toBe(9);
  });

  it("PARTIAL und FAILED erscheinen NIE als Erfolg", () => {
    for (const status of ["PARTIAL", "FAILED"]) {
      mount({
        run: { status, failureCode: "SOURCE_PAGE_GONE", failureReason: "Seite nicht abrufbar." },
        source: QUELLE,
        items: [einheit()],
      });
      const banner = q("w2-run") as Element;
      expect(banner.getAttribute("data-run-success"), `${status} gilt als Erfolg`).toBe("false");
      expect(banner.getAttribute("data-run-running")).toBe("false");
      // Der Hinweis sagt ausdruecklich, was das fuer das Gezeigte bedeutet.
      expect((q("w2-run-hint")?.textContent ?? "").length).toBeGreaterThan(20);
      // Grund und Code stehen WOERTLICH da.
      expect(q("w2-run-failure-code")?.textContent).toContain("SOURCE_PAGE_GONE");
      expect(q("w2-run-failure-reason")?.textContent).toContain("Seite nicht abrufbar.");
    }
  });

  it("bei Teilfehler bleiben die erzeugten Einheiten sichtbar — auch bei doppelter Id", () => {
    // Doppelte gelieferte Id ist Absicht: zwei Einheiten muessen zwei Zeilen bleiben.
    mount({ run: { status: "PARTIAL" }, source: QUELLE, items: [einheit(), einheit()] });
    expect(alle("w2-knowledge-item").length).toBe(2);
    expect((q("w2-run") as Element).getAttribute("data-run-success")).toBe("false");
  });

  it("der Zustand steht als TEXT da, nicht nur als Farbe", () => {
    mount({ run: { status: "FAILED" }, source: QUELLE, items: [] });
    // Ohne jede Farbwahrnehmung lesbar: Name plus Bedeutung plus eigenes Symbol.
    expect(q("w2-run-label")?.textContent).toBe("Fehlgeschlagen");
    expect((q("w2-run-hint")?.textContent ?? "").length).toBeGreaterThan(20);
    expect((q("w2-run") as Element).querySelector("svg"), "Kein eigenes Zeichen").not.toBeNull();
  });

  it("ein unbekannter Zustand wird benannt und nicht als Erfolg gezeigt", () => {
    mount({ run: { status: "ALLES_GUT" }, source: QUELLE, items: [einheit()] });
    expect(q("w2-run-label")?.textContent).toBe("Zustand unbekannt");
    expect((q("w2-run") as Element).getAttribute("data-run-success")).toBe("false");
  });
});

// ================================================================================================
// BLOCK D — die Gegenproben
// ================================================================================================
describe("AUFTRAG-23 BLOCK D: fehlende Werte werden benannt, nicht versteckt", () => {
  it("fehlende Fundstelle: die Zeile bleibt und sagt es", () => {
    mount({
      run: { status: "COMPLETED" },
      source: QUELLE,
      items: [einheit({ locator: null }), einheit({ candidateItemId: "b", locator: "Absatz 9" })],
    });
    const zeilen = alle("w2-knowledge-item");
    expect(zeilen.length, "Die Zeile ohne Fundstelle wurde weggelassen").toBe(2);
    const fundstellen = alle("w2-item-locator");
    expect(fundstellen[0]?.getAttribute("data-missing")).toBe("true");
    expect(fundstellen[0]?.textContent).toBe("Fundstelle fehlt");
    // Positive Kontrolle — sonst waere der Befund oben blind.
    expect(fundstellen[1]?.getAttribute("data-missing")).toBe("false");
    expect(fundstellen[1]?.textContent).toBe("Absatz 9");
  });

  it("fehlende Quelle: ein Befund, kein leerer Kasten", () => {
    mount({ run: { status: "PARTIAL" }, source: null, items: [einheit()] });
    expect(q("w2-source-missing")?.textContent).toBe(
      "Zu diesem Lauf wurde kein Original geliefert.",
    );
    // Der Block existiert trotzdem — er verschwindet nicht mitsamt seiner Aussage.
    expect(q("w2-source")).not.toBeNull();
  });

  it("fehlende Pflichtangabe am Original: sichtbar benannt, Zeile bleibt stehen", () => {
    mount({
      run: { status: "COMPLETED" },
      source: { ...QUELLE, sourceVersion: null, importedAt: null },
      items: [einheit()],
    });
    expect(q("w2-source-missing-required")).not.toBeNull();
    const version = q("w2-source-field-w2.source.version") as Element;
    expect(version.getAttribute("data-missing")).toBe("true");
    expect(version.textContent?.length).toBeGreaterThan(0);
  });

  it("kein Ergebnis ist NICHT Erfolg — der Satz sagt beides", () => {
    mount({ run: { status: "COMPLETED" }, source: QUELLE, items: [] });
    const text = q("w2-knowledge-empty")?.textContent ?? "";
    expect(text).toContain("keine Wissenseinheit");
    expect(text).toContain("kein erfolgreicher Import");
    expect(alle("w2-knowledge-item").length).toBe(0);
  });

  it("null Konflikte heisst „keine gemeldet“ — nicht „keine vorhanden“", () => {
    mount({
      run: { status: "COMPLETED" },
      source: QUELLE,
      items: [einheit({ conflictIds: [] }), einheit({ candidateItemId: "b", conflictIds: ["k1"] })],
    });
    const konflikte = alle("w2-item-conflicts");
    expect(konflikte[0]?.getAttribute("data-count")).toBe("0");
    expect(konflikte[0]?.textContent).toBe("Keine Konflikte gemeldet");
    expect(konflikte[1]?.getAttribute("data-count")).toBe("1");
    expect(konflikte[1]?.textContent).toContain("1");
  });

  it("fehlender Validierungsstatus wird benannt — es wird keiner behauptet", () => {
    mount({
      run: { status: "COMPLETED" },
      source: QUELLE,
      items: [einheit({ validationStatus: null })],
    });
    const status = q("w2-item-status") as Element;
    expect(status.getAttribute("data-missing")).toBe("true");
    expect(status.textContent).toBe("Validierungsstatus fehlt");
  });
});

// ================================================================================================
// BLOCK E — drei Sprachen
// ================================================================================================
describe("AUFTRAG-23 BLOCK E: DE, EN und NL sind vollstaendig", () => {
  const ERWARTET: Record<string, { original: string; wissen: string; partial: string }> = {
    de: { original: "Original", wissen: "Wissenseinheiten", partial: "Teilweise fehlgeschlagen" },
    en: { original: "Original", wissen: "Knowledge units", partial: "Partially failed" },
    nl: { original: "Origineel", wissen: "Kenniseenheden", partial: "Gedeeltelijk mislukt" },
  };

  for (const sprache of ["de", "en", "nl"]) {
    it(`${sprache}: beide Ueberschriften und der Teilfehler stehen uebersetzt da`, async () => {
      await i18n.changeLanguage(sprache);
      mount({ run: { status: "PARTIAL" }, source: QUELLE, items: [einheit({ locator: null })] });
      const soll = ERWARTET[sprache] as { original: string; wissen: string; partial: string };
      expect(container.querySelector("#w2-source-heading")?.textContent).toBe(soll.original);
      expect(container.querySelector("#w2-knowledge-heading")?.textContent).toBe(soll.wissen);
      expect(q("w2-run-label")?.textContent).toBe(soll.partial);
      // Kein Schluessel scheint durch: ein sichtbarer `w2.` waere eine fehlende Uebersetzung.
      expect(
        container.textContent ?? "",
        `${sprache}: unuebersetzter Schluessel sichtbar`,
      ).not.toContain("w2.");
      // Und die fehlende Fundstelle ist auch hier benannt, nicht weggelassen.
      expect((q("w2-item-locator") as Element).getAttribute("data-missing")).toBe("true");
      expect(((q("w2-item-locator") as Element).textContent ?? "").length).toBeGreaterThan(0);
    });
  }
});
