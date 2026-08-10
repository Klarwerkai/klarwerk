// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ImportResultView } from "../../apps/web/src/components/confluence-import/ImportResultView";
import "../../apps/web/src/i18n";
import type { ImportResultViewInput } from "../../apps/web/src/lib/importResultView";

// ================================================================================================
// AUFTRAG-81 — DER VORHANDENE A11Y-VERTRAG DER W2-RESULTATVIEW, FESTGEHALTEN.
// ================================================================================================
//
// Preflight 78 hat kartiert, was BEREITS gebaut ist: eine visuell verborgene h1, drei benannte
// Bereiche mit aufloesenden `aria-labelledby`-Referenzen, verborgene Symbole, eine zweite Spur
// neben der Farbe und — als Eigenschaft, nicht als Luecke — KEIN einziges fokussierbares Element.
//
// Dieser Test ERFINDET nichts davon. Er haelt den Bestand fest, damit er nicht unbemerkt
// verlorengeht. Er ist bewusst der leisere der beiden Waechter aus Auftrag 81: er faellt erst auf,
// wenn jemand etwas wegnimmt.
//
// WAS HIER AUSDRUECKLICH NICHT GEPRUEFT WIRD, weil es ohne Beleg waere (Auftrag 81, Akzeptanz 4):
//   · Kontrastwerte der konkreten Farbkombination — die Tokens sind anderswo gepinnt
//     (contrast-tokens-d5, mega40-kontrast-modern); die KOMBINATION in dieser Flaeche ist ungemessen,
//   · Verhalten echter Vorlesewerkzeuge,
//   · Zoom/Reflow bei 400 %,
//   · alles, was eine ROUTE voraussetzt — die Flaeche ist weiterhin nirgends geroutet.
// ================================================================================================

const WURZEL = join(__dirname, "..", "..");

const QUELLE = {
  sourceRecordId: "src-81",
  sourceSystem: "Confluence",
  externalId: "12345",
  sourceVersion: "7",
  url: "https://example.invalid/seite",
  title: "Eine Quellseite",
  importedAt: "2026-08-02T10:00:00.000Z",
};

const EINHEIT = {
  candidateItemId: "cand-81",
  knowledgeObjectId: "ko-81",
  extractedStatement: "Eine Aussage.",
  locator: "Abschnitt 2",
  validationStatus: "VALIDATED",
  conflictIds: [],
  knowledgeGapIds: [],
};

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;

/** Dieselbe Bauart wie der bestehende gemountete W2-Test: React im jsdom, gemessen wird das DOM. */
function zeichne(eingabe: ImportResultViewInput): {
  container: HTMLDivElement;
  unmount: () => void;
} {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(createElement(ImportResultView, { result: eingabe }));
  });
  return { container, unmount: abbauen };
}

function abbauen(): void {
  if (!root) {
    return;
  }
  act(() => {
    root?.unmount();
  });
  container.remove();
  root = undefined;
}

afterEach(abbauen);

const VOLLSTAENDIG: ImportResultViewInput = {
  run: { status: "COMPLETED" },
  source: QUELLE,
  items: [EINHEIT],
};

describe("AUFTRAG-81: der A11y-Vertrag der W2-Resultatview bleibt bestehen", () => {
  it("genau eine h1, und jede h2 steht darunter", () => {
    const { container } = zeichne(VOLLSTAENDIG);
    expect(container.querySelectorAll("h1").length, "die Flaeche braucht genau eine h1").toBe(1);
    // Keine h3 ohne h2 und keine Ueberschrift oberhalb der h1: die Reihenfolge im Dokument ist die
    // Reihenfolge, die ein Vorlesewerkzeug anbietet.
    const ueberschriften = [...container.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((e) =>
      Number(e.tagName.slice(1)),
    );
    expect(ueberschriften[0], "die erste Ueberschrift ist nicht die h1").toBe(1);
    for (const stufe of ueberschriften.slice(1)) {
      expect(stufe, "eine Ueberschrift springt ueber die h2 hinaus").toBeLessThanOrEqual(2);
    }
  });

  it("jede aria-labelledby-Referenz loest im gezeichneten DOM auf", () => {
    const { container } = zeichne(VOLLSTAENDIG);
    const referenzen = [...container.querySelectorAll("[aria-labelledby]")];
    expect(referenzen.length, "die drei benannten Bereiche fehlen").toBe(3);
    for (const el of referenzen) {
      const id = el.getAttribute("aria-labelledby") ?? "";
      // Attributwahl statt `#id`: `CSS.escape` gibt es in dieser jsdom-Fassung nicht, und ein
      // roher `#`-Selektor braeche an Sonderzeichen. Die Attributform ist hier die robustere.
      const ziel = container.querySelector(`[id="${id}"]`);
      expect(ziel, `aria-labelledby="${id}" zeigt ins Leere`).not.toBeNull();
      expect(
        (ziel?.textContent ?? "").trim().length,
        `die Beschriftung ${id} ist leer`,
      ).toBeGreaterThan(0);
    }
  });

  it("jedes Symbol ist vor Hilfsmitteln verborgen", () => {
    const { container } = zeichne(VOLLSTAENDIG);
    const symbole = [...container.querySelectorAll("svg")];
    expect(symbole.length, "kein Symbol gezeichnet — der Fall traegt dann nichts").toBeGreaterThan(
      0,
    );
    for (const s of symbole) {
      expect(
        s.getAttribute("aria-hidden"),
        "ein Symbol wuerde vorgelesen und traegt doch keine eigene Aussage",
      ).toBe("true");
    }
  });

  it("der Laufzustand steht als TEXT da, nicht nur als Farbe", () => {
    for (const status of ["COMPLETED", "FAILED", "PARTIAL", "QUEUED"]) {
      const { container, unmount } = zeichne({ ...VOLLSTAENDIG, run: { status } });
      const bereich = container.querySelector('[data-testid="w2-run"]') as HTMLElement;
      const name = bereich.querySelector('[data-testid="w2-run-label"]')?.textContent ?? "";
      const bedeutung = bereich.querySelector('[data-testid="w2-run-hint"]')?.textContent ?? "";
      expect(name.trim().length, `${status}: kein Zustandsname`).toBeGreaterThan(0);
      expect(bedeutung.trim().length, `${status}: kein Bedeutungssatz`).toBeGreaterThan(0);
      // Der Ton ist die ZWEITE Spur — er darf da sein, aber nie die einzige.
      expect(bereich.getAttribute("data-run-tone"), `${status}: kein Ton`).not.toBeNull();
      unmount();
    }
  });

  it("kein gezeichneter Text sieht aus wie ein roher i18n-Schluessel", () => {
    // Der eigentliche Anlass von Auftrag 81, hier am DOM statt am Woerterbuch: haette
    // `w2.value.missing` gefehlt, stuende genau diese Zeichenkette im Text.
    const faelle: ImportResultViewInput[] = [
      VOLLSTAENDIG,
      // Pflichtangabe fehlt -> w2.value.missing
      { ...VOLLSTAENDIG, source: { ...QUELLE, sourceVersion: null } },
      // freiwillige Angabe fehlt -> w2.value.none
      { ...VOLLSTAENDIG, source: { ...QUELLE, url: null } },
      { run: { status: "FAILED" }, source: null, items: [] },
    ];
    // JE TEXTKNOTEN, nicht ueber `container.textContent`: die Gesamtzeichenkette klebt Werte
    // aneinander („…Versionw2.value.missingImportiert…"), und dann greift keine Wortgrenze mehr —
    // ein erster Entwurf dieses Falls war genau deshalb wirkungslos und blieb unter der
    // Rueckmutation still. Ein von i18next durchgereichter Rohschluessel steht immer ALLEIN in
    // seinem Textknoten, weil er der ganze Wert eines `{t(...)}`-Ausdrucks ist.
    const rohesMuster = /^[a-z][a-z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*){2,}$/;
    for (const fall of faelle) {
      const { container, unmount } = zeichne(fall);
      const knoten = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const roh: string[] = [];
      let k = knoten.nextNode();
      while (k) {
        const wert = (k.textContent ?? "").trim();
        if (rohesMuster.test(wert)) {
          roh.push(wert);
        }
        k = knoten.nextNode();
      }
      expect(
        roh,
        "ein roher Schluessel steht im gezeichneten Text — i18next hat ihn nicht aufgeloest",
      ).toEqual([]);
      unmount();
    }
  });

  it("die zwei Schluessel aus Preflight 78 erscheinen als echter Text", () => {
    const { container } = zeichne({ ...VOLLSTAENDIG, source: { ...QUELLE, sourceVersion: null } });
    const feld = container.querySelector(
      '[data-testid="w2-source-field-w2.source.version"]',
    ) as HTMLElement;
    expect(feld.getAttribute("data-missing")).toBe("true");
    const gezeigt = (feld.textContent ?? "").trim();
    expect(gezeigt.length, "die fehlende Pflichtangabe wird gar nicht benannt").toBeGreaterThan(0);
    expect(gezeigt, "hier stand der rohe Schluessel").not.toBe("w2.value.missing");
    // Gegenprobe gegen das Woerterbuch: der gezeigte Satz ist WIRKLICH der hinterlegte.
    const i18nQuelle = readFileSync(join(WURZEL, "apps/web/src/i18n.ts"), "utf8");
    const erwartet = /^ {2}"w2\.value\.missing":\s*"([^"]+)"/m.exec(i18nQuelle)?.[1];
    expect(erwartet, "w2.value.missing steht nicht im DE-Woerterbuch").toBeDefined();
    expect(gezeigt).toBe(erwartet);
  });

  // ----------------------------------------------------------------------------------------------
  // KORREKTUR AN PREFLIGHT 78.
  //
  // Dort steht „0 interaktive Elemente, rein darstellend". Das war FALSCH und ist hier durch das
  // Mounten aufgefallen: gemessen wurde damals nur nach `<a `/`<button` IN DEN VIER
  // Komponentendateien — die eingebettete `ExternalUrlText` (SourceRecordCard:63) blieb ungesehen.
  // Sie rendert bei einer SICHEREN absoluten http/https-Quelle ein echtes `<a href target rel>`;
  // bei unsicherer oder fehlender URL bleibt es reiner Text.
  //
  // Der wirkliche Vertrag ist damit schaerfer als der behauptete: GENAU EIN fokussierbares
  // Element, und nur dann, wenn eine sichere Quell-URL geliefert wurde.
  // ----------------------------------------------------------------------------------------------
  const FOKUSSIERBAR =
    'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

  it("mit sicherer Quell-URL: GENAU EIN fokussierbares Element, und es ist ein echter Link", () => {
    const { container } = zeichne(VOLLSTAENDIG);
    const fokussierbar = [...container.querySelectorAll(FOKUSSIERBAR)];
    expect(
      fokussierbar.map((e) => e.tagName.toLowerCase()),
      "die Flaeche traegt mehr Fokusziele als den einen Quell-Link",
    ).toEqual(["a"]);
    const link = fokussierbar[0] as HTMLAnchorElement;
    expect(link.getAttribute("href"), "der Link fuehrt nirgendwohin").toBe(QUELLE.url);
    expect(
      (link.textContent ?? "").trim().length,
      "ein Link ohne Text ist fuer Hilfsmittel stumm",
    ).toBeGreaterThan(0);
    expect(link.getAttribute("rel"), "target=_blank ohne rel=noreferrer").toContain("noreferrer");
  });

  it("ohne Quell-URL: gar kein fokussierbares Element", () => {
    // Die Gegenkontrolle. Sie trennt „ein Link, weil eine URL da ist" von „irgendwer hat ein
    // Fokusziel eingebaut" — ohne sie wuerde der Fall darueber jede kuenftige Schaltflaeche decken.
    const { container } = zeichne({ ...VOLLSTAENDIG, source: { ...QUELLE, url: null } });
    expect(
      [...container.querySelectorAll(FOKUSSIERBAR)].map((e) => e.tagName.toLowerCase()),
      "ohne Quell-URL darf es nichts zu fokussieren geben",
    ).toEqual([]);
  });

  it("unsichere Quell-URL wird zu Text, nicht zu einem Link", () => {
    // SCRUM-527 ist anderswo gepinnt; hier zaehlt allein die Fokusfolge: ein neutralisierter
    // Wert darf kein Fokusziel erzeugen.
    const { container } = zeichne({
      ...VOLLSTAENDIG,
      source: { ...QUELLE, url: "javascript:alert(1)" },
    });
    expect(
      [...container.querySelectorAll(FOKUSSIERBAR)].map((e) => e.tagName.toLowerCase()),
      "eine unsichere URL hat ein Fokusziel erzeugt",
    ).toEqual([]);
  });
});
