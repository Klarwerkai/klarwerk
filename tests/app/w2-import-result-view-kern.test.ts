// ================================================================================================
// AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — DER REINE KERN: ABBILDEN, NICHT ABLEITEN.
// ================================================================================================
//
// WAS DIESER TEST PRUEFT: dass `importResultView` genau das anzeigt, was der Vertrag geliefert hat
// — und dass er bei allem, was fehlt, einen sichtbaren Mangel benennt statt einer Behauptung.
//
// DREI ENTSCHEIDUNGEN, DIE IHN VOM NACHERZAEHLEN UNTERSCHEIDEN:
//
//  1. DER ZUSTANDSRAUM STEHT GETRENNT VOM CODE. Die neun Laufzustaende sind hier eigenstaendig aus
//     `KW-W2-17` uebernommen und werden gegen die Konstante der lib geprueft — eine Aenderung an
//     der lib allein macht den Test rot. Die Herkunft und die bewusste Grenze dieser Uebernahme
//     stehen bei `STATUS_AUS_KW_W2_17` (das Blatt liegt ausserhalb des Repositories).
//
//  2. „KEINE CLIENTSEITIGE FACHLOGIK" WIRD AM CODE GEMESSEN, nicht behauptet: die lib-Quelle wird
//     gelesen und auf Sortierung und Statusherleitung abgesucht (Auftrag §7).
//
//  3. FAIL-CLOSED. Fehlt die Quelle oder schrumpft die Zustandsliste, ist der Test rot — ein
//     gruener Nichtlauf waere schlimmer als ein roter Lauf.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMPORT_RUN_STATUS,
  type ImportResultViewInput,
  type ImportRunStatus,
  importResultView,
  importRunStateView,
  isImportRunStatus,
  knowledgeBlockView,
  sourceBlockView,
} from "../../apps/web/src/lib/importResultView";

const LIB = "apps/web/src/lib/importResultView.ts";
const LIB_SRC = readFileSync(resolve(process.cwd(), LIB), "utf8");

/**
 * Die neun Zustaende, wortwoertlich aus `KW-W2-17`, Abschnitt „Persistenter Importvertrag":
 *
 *   Status: `QUEUED`, `FETCHING`, `PERSISTING_SOURCE`, `EXTRACTING`, `CREATING_KNOWLEDGE`,
 *   `ANALYZING`, `COMPLETED`, `PARTIAL`, `FAILED`.
 *
 * BENANNTE GRENZE: das Architekturblatt liegt AUSSERHALB dieses Repositories
 * (`/Users/peterkohnert/Documents/Projekt_klarwerk/03_AUFTRAEGE/entscheidung/`). Es zur Laufzeit zu
 * lesen haette die Testsuite an einen Pfad ausserhalb des Repos gebunden — auf jedem anderen
 * Rechner waere `tools/check` daran gescheitert. Die Liste steht deshalb HIER, mit ihrer Herkunft,
 * und wird gegen die Konstante der lib geprueft: eine Abweichung zwischen Blatt und Code faellt
 * damit an genau einer Stelle auf, statt an keiner.
 */
const STATUS_AUS_KW_W2_17 = [
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

function quelle(over: Partial<NonNullable<ImportResultViewInput["source"]>> = {}) {
  return {
    sourceRecordId: "src-1",
    sourceSystem: "confluence",
    externalId: "123456",
    sourceVersion: "7",
    url: "https://example.invalid/wiki/x",
    title: "Wartung der Ventilstation",
    importedAt: "2026-08-02T09:00:00.000Z",
    ...over,
  };
}

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

// ================================================================================================
// BLOCK A — die neun Laufzustaende
// ================================================================================================
describe("AUFTRAG-23 BLOCK A: die Laufzustaende kommen aus dem Vertrag", () => {
  it("die Zustandsliste der lib ist die Zustandsliste von KW-W2-17", () => {
    expect([...IMPORT_RUN_STATUS]).toEqual(STATUS_AUS_KW_W2_17);
    // Fail-closed: genau neun, nicht „mindestens".
    expect(IMPORT_RUN_STATUS.length).toBe(9);
  });

  it("jeder der neun Zustaende ist zuordenbar und traegt eigene Text-Schluessel", () => {
    const labels = new Set<string>();
    const hints = new Set<string>();
    for (const status of IMPORT_RUN_STATUS) {
      const view = importRunStateView(status);
      expect(view.unknown, `${status} faellt in den Unbekannt-Zweig`).toBe(false);
      expect(view.labelKey).toBe(`w2.run.status.${status}`);
      expect(view.hintKey).toBe(`w2.run.hint.${status}`);
      labels.add(view.labelKey);
      hints.add(view.hintKey);
    }
    // Neun eigene Namen — kein Sammelzustand, der zwei Laeufe gleich aussehen liesse.
    expect(labels.size).toBe(9);
    expect(hints.size).toBe(9);
  });

  it("die sechs laufenden Zustaende sind laufend und KEIN Erfolg", () => {
    const laufend: ImportRunStatus[] = [
      "QUEUED",
      "FETCHING",
      "PERSISTING_SOURCE",
      "EXTRACTING",
      "CREATING_KNOWLEDGE",
      "ANALYZING",
    ];
    for (const status of laufend) {
      const view = importRunStateView(status);
      expect(view.running, `${status} muss laufend sein`).toBe(true);
      expect(view.success, `${status} darf kein Erfolg sein`).toBe(false);
    }
  });

  it("NUR COMPLETED ist ein Erfolg — PARTIAL und FAILED nie", () => {
    expect(importRunStateView("COMPLETED").success).toBe(true);
    expect(importRunStateView("PARTIAL").success).toBe(false);
    expect(importRunStateView("FAILED").success).toBe(false);
    // Und sie sind auch nicht „noch unterwegs" — sie sind fertig und nicht gut.
    expect(importRunStateView("PARTIAL").running).toBe(false);
    expect(importRunStateView("FAILED").running).toBe(false);
    // Eigener Ton je Ausgang: Erfolg, Teilfehler und Fehlschlag sind drei Sachen.
    expect(importRunStateView("COMPLETED").tone).toBe("ok");
    expect(importRunStateView("PARTIAL").tone).toBe("warn");
    expect(importRunStateView("FAILED").tone).toBe("error");
  });

  it("ein unbekannter Zustand wird benannt und gilt nie als Erfolg", () => {
    for (const wert of [undefined, null, "", "DONE", "completed", 7, {}]) {
      const view = importRunStateView(wert);
      expect(view.unknown, `${String(wert)} muesste unbekannt sein`).toBe(true);
      expect(view.success).toBe(false);
      expect(view.running).toBe(false);
      expect(view.labelKey).toBe("w2.run.status.unknown");
    }
    // Positive Kontrolle — sonst waere der Erkenner blind.
    expect(isImportRunStatus("COMPLETED")).toBe(true);
    expect(importRunStateView("COMPLETED").unknown).toBe(false);
  });
});

// ================================================================================================
// BLOCK B — das Original
// ================================================================================================
describe("AUFTRAG-23 BLOCK B: das Original zeigt Geliefertes und benennt Fehlendes", () => {
  it("alle fuenf Pflichtangaben erscheinen WOERTLICH", () => {
    const block = sourceBlockView(quelle());
    expect(block.present).toBe(true);
    expect(block.missingRequiredCount).toBe(0);
    const werte = Object.fromEntries(block.fields.map((f) => [f.labelKey, f.value]));
    expect(werte["w2.source.title"]).toBe("Wartung der Ventilstation");
    expect(werte["w2.source.system"]).toBe("confluence");
    expect(werte["w2.source.version"]).toBe("7");
    expect(werte["w2.source.url"]).toBe("https://example.invalid/wiki/x");
    expect(werte["w2.source.importedAt"]).toBe("2026-08-02T09:00:00.000Z");
  });

  it("eine fehlende Pflichtangabe wird als fehlend BENANNT, nicht weggelassen", () => {
    const block = sourceBlockView(quelle({ sourceVersion: null, importedAt: "  " }));
    // Die Zeilen bleiben stehen — eine weggelassene Zeile saehe aus wie ein vollstaendiges Original.
    expect(block.fields.length).toBe(6);
    const version = block.fields.find((f) => f.labelKey === "w2.source.version");
    expect(version?.value).toBeNull();
    expect(version?.missingKey).toBe("w2.value.missing");
    expect(block.missingRequiredCount).toBe(2);
  });

  it("eine ganz fehlende Quelle ist ein Befund, kein leerer Bereich", () => {
    for (const leer of [null, undefined]) {
      const block = sourceBlockView(leer);
      expect(block.present).toBe(false);
      expect(block.missingKey).toBe("w2.source.missing");
      expect(block.fields).toEqual([]);
    }
  });

  it("die URL geht ueber die gehaertete Anzeige, alles andere als Text", () => {
    const block = sourceBlockView(quelle());
    const arten = Object.fromEntries(block.fields.map((f) => [f.labelKey, f.kind]));
    expect(arten["w2.source.url"]).toBe("url");
    expect(arten["w2.source.title"]).toBe("text");
    expect(arten["w2.source.system"]).toBe("text");
  });
});

// ================================================================================================
// BLOCK C — die Wissenseinheiten
// ================================================================================================
describe("AUFTRAG-23 BLOCK C: n Einheiten, gelieferte Reihenfolge, gelesene Werte", () => {
  it("eine Quelle mit drei Einheiten ergibt drei Zeilen in GELIEFERTER Reihenfolge", () => {
    const block = knowledgeBlockView([
      einheit({ candidateItemId: "c", extractedStatement: "Drittens" }),
      einheit({ candidateItemId: "a", extractedStatement: "Erstens" }),
      einheit({ candidateItemId: "b", extractedStatement: "Zweitens" }),
    ]);
    expect(block.count).toBe(3);
    expect(block.empty).toBe(false);
    // Die Reihenfolge ist die GELIEFERTE — bewusst NICHT alphabetisch, nicht nach Id sortiert.
    expect(block.items.map((i) => i.candidateItemId)).toEqual(["c", "a", "b"]);
    expect(block.items.map((i) => i.statement)).toEqual(["Drittens", "Erstens", "Zweitens"]);
    expect(block.items.map((i) => i.position)).toEqual([1, 2, 3]);
  });

  it("eine fehlende Fundstelle wird ausdruecklich benannt — die Zeile bleibt", () => {
    const block = knowledgeBlockView([einheit({ locator: null }), einheit({ locator: "" })]);
    expect(block.count).toBe(2);
    for (const item of block.items) {
      expect(item.locator).toBeNull();
      expect(item.locatorMissingKey).toBe("w2.item.locatorMissing");
    }
    // Positive Kontrolle: eine vorhandene Fundstelle wird WOERTLICH uebernommen.
    const mit = knowledgeBlockView([einheit({ locator: "Absatz 3" })]);
    expect(mit.items[0]?.locator).toBe("Absatz 3");
    expect(mit.items[0]?.locatorMissingKey).toBeNull();
  });

  it("der Validierungsstatus wird GELESEN — fehlt er, wird keiner behauptet", () => {
    const gelesen = knowledgeBlockView([einheit({ validationStatus: "validiert" })]);
    expect(gelesen.items[0]?.validationStatus).toBe("validiert");
    const ohne = knowledgeBlockView([einheit({ validationStatus: null })]);
    expect(ohne.items[0]?.validationStatus).toBeNull();
    expect(ohne.items[0]?.validationMissingKey).toBe("w2.item.statusMissing");
  });

  it("Konflikte und Luecken sind GEZAEHLTE gelieferte IDs, nichts Erkanntes", () => {
    const block = knowledgeBlockView([
      einheit({ conflictIds: ["k1", "k2"], knowledgeGapIds: ["g1"] }),
      einheit({ conflictIds: null, knowledgeGapIds: undefined }),
      // Leere und unbrauchbare Eintraege zaehlen nicht mit — sie sind keine Konflikte.
      einheit({ conflictIds: ["", "   "], knowledgeGapIds: [] }),
    ]);
    expect(block.items.map((i) => i.conflictCount)).toEqual([2, 0, 0]);
    expect(block.items.map((i) => i.gapCount)).toEqual([1, 0, 0]);
  });

  it("kein Element ist NICHT dasselbe wie Erfolg", () => {
    for (const leer of [[], null, undefined]) {
      const block = knowledgeBlockView(leer);
      expect(block.empty).toBe(true);
      expect(block.count).toBe(0);
      expect(block.emptyKey).toBe("w2.knowledge.empty");
    }
  });

  it("eine Einheit ohne Id bekommt einen Stellenschluessel, keinen erfundenen Fachwert", () => {
    const block = knowledgeBlockView([
      einheit({ candidateItemId: null }),
      einheit({ candidateItemId: "x" }),
    ]);
    // Die fachliche Id bleibt ehrlich leer — es wird keine erfunden.
    expect(block.items[0]?.candidateItemId).toBeNull();
    expect(block.items[1]?.candidateItemId).toBe("x");
    // Der Listenschluessel traegt die Position und ist damit trotzdem eindeutig.
    expect(block.items[0]?.key).toBe("1-ohne-id");
    expect(block.items[1]?.key).toBe("2-x");
  });

  it("zwei Einheiten mit DERSELBEN gelieferten Id bleiben zwei Einheiten", () => {
    // Sonst zoege React die Zeilen zusammen und aus n gelieferten Einheiten wuerden sichtbar
    // weniger — genau die Zusage, um die es in dieser Welle geht.
    const block = knowledgeBlockView([
      einheit({ candidateItemId: "doppelt", extractedStatement: "Erste Aussage." }),
      einheit({ candidateItemId: "doppelt", extractedStatement: "Zweite Aussage." }),
    ]);
    expect(block.count).toBe(2);
    expect(new Set(block.items.map((i) => i.key)).size, "Die Listenschluessel kollidieren").toBe(2);
    expect(block.items.map((i) => i.statement)).toEqual(["Erste Aussage.", "Zweite Aussage."]);
  });
});

// ================================================================================================
// BLOCK D — das Ganze und die Gegenproben
// ================================================================================================
describe("AUFTRAG-23 BLOCK D: Gegenproben gegen erfundene Wahrheit", () => {
  it("Teilfehler: erzeugte Einheiten bleiben sichtbar, der Lauf gilt trotzdem nicht als Erfolg", () => {
    const view = importResultView({
      run: {
        importId: "imp-1",
        status: "PARTIAL",
        failureCode: "SOURCE_PAGE_GONE",
        failureReason: "Zwei Seiten waren nicht mehr abrufbar.",
      },
      source: quelle(),
      items: [einheit(), einheit({ candidateItemId: "item-2" })],
    });
    expect(view.runState.success).toBe(false);
    expect(view.runState.labelKey).toBe("w2.run.status.PARTIAL");
    // Die erzeugten Einheiten verschwinden NICHT, nur weil ein Teil fehlschlug.
    expect(view.knowledge.count).toBe(2);
    // Grund und Code WOERTLICH — kein Ersatztext.
    expect(view.failureCode).toBe("SOURCE_PAGE_GONE");
    expect(view.failureReason).toBe("Zwei Seiten waren nicht mehr abrufbar.");
  });

  it("ein Fehlschlag ohne Grund erfindet keinen Grund", () => {
    const view = importResultView({ run: { status: "FAILED" }, source: null, items: [] });
    expect(view.failureCode).toBeNull();
    expect(view.failureReason).toBeNull();
    expect(view.runState.success).toBe(false);
    expect(view.source.present).toBe(false);
    expect(view.knowledge.empty).toBe(true);
  });

  it("eine ganz leere Antwort behauptet nichts", () => {
    for (const leer of [null, undefined, {}]) {
      const view = importResultView(leer as ImportResultViewInput);
      expect(view.runState.unknown).toBe(true);
      expect(view.runState.success).toBe(false);
      expect(view.source.present).toBe(false);
      expect(view.knowledge.empty).toBe(true);
    }
  });

  it("die Abbildung ist rein: dieselbe Eingabe, dasselbe Ergebnis, kein Seiteneffekt", () => {
    const eingabe: ImportResultViewInput = {
      run: { status: "COMPLETED" },
      source: quelle(),
      items: [einheit({ candidateItemId: "z" }), einheit({ candidateItemId: "a" })],
    };
    const gefroren = JSON.stringify(eingabe);
    const eins = importResultView(eingabe);
    const zwei = importResultView(eingabe);
    expect(eins).toEqual(zwei);
    // Insbesondere wurde die gelieferte Liste NICHT an Ort und Stelle sortiert.
    expect(JSON.stringify(eingabe), "Die Eingabe wurde veraendert").toBe(gefroren);
    expect(eins.knowledge.items.map((i) => i.candidateItemId)).toEqual(["z", "a"]);
  });
});

// ================================================================================================
// BLOCK E — keine clientseitige Fachlogik, am Code gemessen
// ================================================================================================
describe("AUFTRAG-23 BLOCK E: der View-Kern rechnet nichts aus", () => {
  /** Nur der Code, ohne Erklaerungen — ein Kommentar, der eine Sortierung ausschliesst, darf die
   *  Gegenprobe nicht ausloesen. */
  function ohneKommentare(quelltext: string): string {
    return quelltext.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it("die lib sortiert nicht und dreht nichts um", () => {
    const code = ohneKommentare(LIB_SRC);
    for (const eintrag of [".sort(", ".reverse(", "localeCompare"]) {
      expect(code, `${eintrag} waere eine clientseitige Sortierung`).not.toContain(eintrag);
    }
  });

  it("die lib leitet keinen Status ab und ruft nichts ab", () => {
    const code = ohneKommentare(LIB_SRC);
    for (const eintrag of ["fetch(", "useQuery", "axios", "XMLHttpRequest"]) {
      expect(code, `${eintrag} waere ein Abruf im View-Kern`).not.toContain(eintrag);
    }
    // Kein Erfolgsbegriff, der NICHT am gelieferten COMPLETED haengt.
    expect(code).toContain('success: status === "COMPLETED"');
  });

  it("die lib kennt keine Fixture- und keine Demo-Wahrheit", () => {
    const code = ohneKommentare(LIB_SRC).toLowerCase();
    for (const eintrag of ["confluence", "example.com", "demo", "lorem", "musterfirma"]) {
      expect(code, `„${eintrag}" waere eine erfundene Fachwahrheit im Produktcode`).not.toContain(
        eintrag,
      );
    }
  });

  it("der View-Kern ist DOM-frei — er importiert kein React", () => {
    expect(LIB_SRC).not.toContain('from "react"');
    expect(LIB_SRC).not.toContain("JSX.Element");
  });
});
