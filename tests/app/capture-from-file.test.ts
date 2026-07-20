// PMO-FEA-0006: DOM-freie Tests für „Wissen aus Datei" — Punkteliste → Entwurfs-Warteschlange.
// Schwerpunkte: Auswahl-Logik, Punkt→Wissensseiten-Entwurf (nichts erfinden), sichtbare Queue
// (nacheinander prüfen/einreichen, nichts automatisch), Quelle (Dateiname) am KO, Copy DE/EN.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ExtractedPoint } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_MODES, NARRATE_MODES } from "../../apps/web/src/lib/captureEntry";
import {
  CAPTURE_FILE_TEXT,
  MAX_SOURCE_EXCERPT,
  advanceFileQueue,
  buildFileQueue,
  createWholeDocumentDraft,
  currentQueuePoint,
  draftFromPoint,
  fileSourcePayload,
  queueProgress,
  selectablePoints,
  selectedCount,
  togglePoint,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";

const POINTS: ExtractedPoint[] = [
  {
    title: "Dosierwert nach Schichtwechsel kalibrieren",
    summary: "Nach jedem Schichtwechsel muss der Dosierwert neu kalibriert werden.",
    sourceExcerpt: "Der Dosierwert muss nach jedem Schichtwechsel neu kalibriert werden.",
  },
  {
    title: "Ventil X bei Überdruck schließen",
    summary: "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.",
    sourceExcerpt: "Bei Überdruck über 6 bar ist Ventil X sofort zu schließen.",
  },
  {
    title: "Filter F3 alle 500 Betriebsstunden tauschen",
    summary: "Filter F3 wird alle 500 Betriebsstunden getauscht.",
    sourceExcerpt: "Filter F3 wird alle 500 Betriebsstunden getauscht.",
  },
];

describe("PMO-FEA-0006: Auswahl-Logik der Punkteliste", () => {
  it("alle Punkte starten AUSGEWÄHLT (Experte wählt ab); Toggle wirkt nur auf den einen Punkt", () => {
    const pts = selectablePoints(POINTS);
    expect(pts).toHaveLength(3);
    expect(selectedCount(pts)).toBe(3);
    const toggled = togglePoint(pts, pts[1]?.id ?? "");
    expect(selectedCount(toggled)).toBe(2);
    expect(toggled[0]?.selected).toBe(true);
    expect(toggled[1]?.selected).toBe(false);
    // Original bleibt unverändert (keine Mutation).
    expect(selectedCount(pts)).toBe(3);
  });
});

describe("PMO-FEA-0006: Punkt → Wissensseiten-Entwurf (G-2: nichts erfinden)", () => {
  it("Titel = Aussage, Statement = Kurzfassung; Bedingungen/Maßnahmen bleiben LEER", () => {
    const p = POINTS[0] as ExtractedPoint;
    const draft = draftFromPoint(p, false);
    expect(draft.title).toBe(p.title);
    expect(draft.statement).toBe(p.summary);
    // Nicht belegte Felder werden NICHT erfunden — der Experte ergänzt im Wizard.
    expect(draft.conditions).toEqual([]);
    expect(draft.measures).toEqual([]);
    expect(draft.tags).toEqual([]);
    expect(draft.confidence).toBe(0);
  });
});

describe("PMO-FEA-0006: sichtbare Entwurfs-Warteschlange", () => {
  it("Queue enthält NUR ausgewählte Punkte; ohne Auswahl keine Queue", () => {
    const pts = togglePoint(selectablePoints(POINTS), "fp-1");
    const queue = buildFileQueue(pts, "wartung.pdf");
    expect(queue).not.toBeNull();
    expect(queue?.points).toHaveLength(2);
    expect(queue?.points.map((p) => p.title)).not.toContain("Ventil X bei Überdruck schließen");
    // Nichts ausgewählt → ehrlich null (kein leerer Wizard-Einstieg).
    const none = pts.map((p) => ({ ...p, selected: false }));
    expect(buildFileQueue(none, "wartung.pdf")).toBeNull();
  });

  it("nacheinander: aktueller Punkt, Fortschritt X von Y, Abschluss nach dem letzten", () => {
    const queue = buildFileQueue(selectablePoints(POINTS), "wartung.pdf");
    if (!queue) {
      throw new Error("Queue erwartet.");
    }
    expect(queueProgress(queue)).toEqual({ current: 1, total: 3 });
    expect(currentQueuePoint(queue)?.title).toBe(POINTS[0]?.title);
    const second = advanceFileQueue(queue);
    if (!second) {
      throw new Error("zweiter Punkt erwartet.");
    }
    expect(queueProgress(second)).toEqual({ current: 2, total: 3 });
    const third = advanceFileQueue(second);
    if (!third) {
      throw new Error("dritter Punkt erwartet.");
    }
    // Nach dem letzten Punkt endet die Queue ehrlich (null) — kein Endlos-Wizard.
    expect(advanceFileQueue(third)).toBeNull();
    expect(currentQueuePoint(null)).toBeNull();
  });

  it("jeder Queue-Punkt wird zu genau EINEM prüfbaren Entwurf (kein Auto-Save-Konstrukt)", () => {
    const queue = buildFileQueue(selectablePoints(POINTS), "wartung.pdf");
    if (!queue) {
      throw new Error("Queue erwartet.");
    }
    const drafts: string[] = [];
    for (let q: typeof queue | null = queue; q; q = advanceFileQueue(q)) {
      const point = currentQueuePoint(q);
      if (point) {
        drafts.push(draftFromPoint(point, false).title);
      }
    }
    expect(drafts).toEqual(POINTS.map((p) => p.title));
  });
});

describe("PMO-FEA-0006: Quelle (Dateiname) am KO", () => {
  it("Source-Payload = Dateiname als Label + Belegstelle als Excerpt", () => {
    const p = POINTS[1] as ExtractedPoint;
    const src = fileSourcePayload("wartung.pdf", p);
    expect(src.label).toBe("wartung.pdf");
    expect(src.excerpt).toBe(p.sourceExcerpt);
  });

  it("überlange Belegstellen werden gedeckelt (Quelle bleibt Beleg-Hinweis, kein Zweitdokument)", () => {
    const long = { ...POINTS[0], sourceExcerpt: "x".repeat(MAX_SOURCE_EXCERPT + 500) };
    expect(fileSourcePayload("a.txt", long as ExtractedPoint).excerpt).toHaveLength(
      MAX_SOURCE_EXCERPT,
    );
  });
});

describe("KW-W2-01: Ganzdokument-Import als bewusster Entwurf", () => {
  it("baut genau einen Draft-Payload mit Titel, Body und sichtbarer Provenienz", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "wartung-l4.md",
      text: "# Wartung L4\n\nFetter Text bleibt als sicherer Text erhalten.\n\n- Punkt eins\n- Punkt zwei",
      locale: "de",
    });

    expect(payload.title).toBe("Wartung L4");
    expect(payload.statement).toContain("Wartung L4");
    expect(payload.bodyHtml).toContain("Quelle: wartung-l4.md, gesamtes Dokument");
    expect(payload.bodyHtml).toContain("<h2>Wartung L4</h2>");
    expect(payload.bodyHtml).toContain("<li>Punkt eins</li>");
    expect(payload.origin).toBe("frontdoor");
    expect(payload.type).toBe("best_practice");
    expect(payload.conditions).toEqual([]);
    expect(payload.measures).toEqual([]);
  });

  it("ruft den Draft-Client genau einmal auf und keinen KO-/Validate-Pfad", async () => {
    const created: unknown[] = [];
    const result = await createWholeDocumentDraft(
      {
        fileName: "gesamt.pdf",
        text: "Ein ganzer Dokumenttext.",
        locale: "de",
      },
      async (payload) => {
        created.push(payload);
        return { id: "draft-1" };
      },
    );

    expect(result).toEqual({ id: "draft-1" });
    expect(created).toHaveLength(1);
    expect(String((created[0] as { bodyHtml?: string }).bodyHtml)).toContain(
      "Quelle: gesamt.pdf, gesamtes Dokument",
    );
  });

  it("Capture rendert den Importart-Toggle und trennt Draft-Create vom Extract-Pfad", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain("CAPTURE_FILE_TEXT.importModeLabel");
    expect(captureSource).toContain('fileImportMode === "points"');
    expect(captureSource).toContain('fileImportMode === "points" && filePoints');
    // SCRUM-502 R6: der extract-Aufruf kann mehrzeilig formatiert sein (documentProvenance-Arg) —
    // format-robust auf den Aufruf + das fileText-Argument prüfen, nicht auf die exakte Zeile.
    expect(captureSource).toContain("endpoints.reasoner.extract(");
    expect(captureSource).toMatch(/endpoints\.reasoner\.extract\(\s*fileText/);
    // KW-W2-01 / WP-D2: der Ganzdokument-Modus bleibt ein BEWUSSTER, vom Extract-Pfad GETRENNTER
    // Draft-Schritt. WP-D2 hat den Aufruf auf den Zweischritt "wholeDocumentDraftPayload(...) →
    // endpoints.drafts.create(...)" umgestellt (damit die Originaldatei vor dem Draft in den
    // Object-Store geht). Die Invariante wird über die tatsächlich verwendeten Symbole belegt.
    expect(captureSource).toContain("wholeDocumentDraftPayload({");
    expect(captureSource).toMatch(
      /fileWholeDraft = useMutation\(\{[\s\S]*?endpoints\.drafts\.create/,
    );
    expect(captureSource.indexOf("CAPTURE_FILE_TEXT.importModeLabel")).toBeLessThan(
      captureSource.indexOf("onChange={(e) => void onExtractFile(e)}"),
    );
    expect(captureSource).not.toContain(
      "fileWholeDraft = useMutation({\n    mutationFn: () => endpoints.ko.create",
    );
  });

  it("Ganzdokument-Save bietet den erzeugten Draft direkt in der Vordertuer an", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(captureSource).toContain("fileWholeDraftSaved");
    expect(captureSource).toContain("id: savedDraftId");
    expect(captureSource).toContain('typeof draft.id === "string"');
    expect(captureSource).toContain("CAPTURE_FILE_TEXT.wholeOpenDraft");
    expect(captureSource).toContain(
      "CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(fileWholeDraftSaved.id)}",
    );
    expect(captureSource).toContain("CAPTURE_FILE_TEXT.wholeOpenMissing");
    expect(captureSource).toContain("fileWholeDraftSaved.id ?");
    expect(captureSource).toContain("CAPTURE_FILE_TEXT.wholeSavedSource");
  });

  // WP-D2 („Original ist heilig") / WP-D7c: der Datei-Import führt die Quelldatei als Anhang mit —
  // Punkte-Queue jetzt über den serialisierten Finalizer (Ref-Cache: EIN Upload, objectId je KO),
  // Ganzdokument-Entwurf über die sichere Body-Datei-Referenz (fileLinkHtml auf den Object-Store-Raw-Pfad).
  it("Capture verdrahtet die Original-Anhang-Sicherung in beiden Datei-Import-Modi", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );
    // Original geht als Daten + Ref-Cache in den Finalizer (Phase A lädt höchstens einmal hoch).
    expect(captureSource).toContain("cache: fileOriginalRef.current");
    expect(captureSource).toContain("fileLinkHtml({");
    expect(captureSource).toContain("setFileOriginal({");
    // Fehlergrund „zu groß" wird gesondert gemeldet (spezifische i18n-Meldung, kein Generik-Fehler).
    expect(captureSource).toContain('"capture.attachTooLarge"');
    expect(captureSource).toContain('"capture.originalAttachFailed"');
  });

  it("Dateiimport zeigt ehrliche Formatgrenzen ohne Format-Treue-Versprechen", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );
    const deHint = String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.formatHint));
    const enHint = String(i18n.getResource("en", "translation", CAPTURE_FILE_TEXT.formatHint));

    // WP-D10c: der Infokasten lebt jetzt als zugeklappt startende Komponente (FileFormatInfo) —
    // Capture rendert sie, die Texte bleiben dieselben CAPTURE_FILE_TEXT-Keys in der Komponente.
    expect(captureSource).toContain("<FileFormatInfo />");
    const infoSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/FileFormatInfo.tsx"),
      "utf8",
    );
    expect(infoSource).toContain("CAPTURE_FILE_TEXT.formatTitle");
    expect(infoSource).toContain("CAPTURE_FILE_TEXT.formatHint");
    expect(infoSource).toContain("CAPTURE_FILE_TEXT.supportedFormats");
    expect(infoSource).toContain("CAPTURE_FILE_TEXT.unsupportedFormats");
    // WP-D7 (Befund 1): die accept-Liste lebt jetzt ZENTRAL in captureFromFile.ts (kein hartkodierter
    // Dialog mehr); Capture referenziert nur noch die Konstante.
    expect(captureSource).toContain("accept={FILE_IMPORT_ACCEPT}");
    // WP-D5/WP-D7: PPTX ist aktiv auswählbar (Best-Effort-Import), RTF bleibt außen vor — jetzt an der
    // zentralen Quelle gepinnt.
    const acceptSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"),
      "utf8",
    );
    expect(acceptSource).toContain("export const FILE_IMPORT_ACCEPT");
    expect(acceptSource).toContain(".pptx");
    expect(captureSource).not.toContain(".rtf");
    expect(deHint).toMatch(/TXT\/MD/);
    // WP-D1/WP-D4/WP-D5: der Hinweis unterscheidet jetzt ehrlich nach Format (DOCX strukturerhaltend
    // Best-Effort; PDF reiner Textimport; PPTX Text/Struktur je Folie) — alle Formate bleiben benannt.
    expect(deHint).toMatch(/DOCX/);
    expect(deHint).toMatch(/PDF/);
    expect(deHint).toMatch(/PPTX/);
    // WP-D10c (Ehrlichkeit): seit WP-D9 werden PPTX-FOTOS übernommen — der Hinweis darf Bilder nicht
    // mehr pauschal als Verlust nennen; Vektor-Grafiken/Formen bleiben ehrlich als Verlust benannt
    // (konsistent zu importNote.pptx, das Bilder als übernommen führt).
    expect(deHint).toMatch(/Fotos je Folie/);
    expect(deHint).toMatch(/Vektor-Grafiken\/Formen/);
    expect(deHint).not.toMatch(/Animationen, Bilder/);
    expect(enHint).toMatch(/photos per slide/);
    expect(enHint).toMatch(/vector graphics\/shapes/);
    expect(
      String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.supportedFormats)),
    ).toMatch(/TXT.*DOCX.*PDF.*PPTX.*Bilder/i);
    expect(
      String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.unsupportedFormats)),
    ).toMatch(/RTF.*nicht unterstützt/i);
    expect(
      String(i18n.getResource("en", "translation", CAPTURE_FILE_TEXT.unsupportedFormats)),
    ).toMatch(/RTF.*not supported/i);
    expect(`${deHint} ${enHint}`).not.toMatch(/formatgetreu|guaranteed|preserved/i);
  });

  it("Dateiimport nutzt passende Aktionsnamen und bietet Abbrechen ohne Speichern", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    expect(String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.searchCta))).toBe(
      "Datei analysieren",
    );
    expect(String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.wholeCta))).toBe(
      "Ganzes Dokument als Entwurf speichern",
    );
    expect(String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.cancel))).toBe(
      "Abbrechen",
    );
    expect(captureSource).toContain("const cancelFileImport = (): void =>");
    expect(captureSource).toContain("setFileName(null)");
    expect(captureSource).toContain('setFileImportMode("points")');
    expect(captureSource).toContain("setCaptureWorkspaceOpen(false)");
    expect(captureSource).toContain('navigate("/erfassen", { replace: true, state: null })');
    expect(captureSource).toContain('window.scrollTo({ top: 0, behavior: "smooth" })');
    expect(captureSource).toContain("CAPTURE_FILE_TEXT.cancel");
  });

  it("Dateiimport-Abbrechen kehrt zur Erfassungsuebersicht zurueck ohne Speichern oder Validieren", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );
    const cancelStart = captureSource.indexOf("const cancelFileImport = (): void =>");
    const cancelEnd = captureSource.indexOf("// Bug (Pedi 04.07.", cancelStart);
    const cancelSource = captureSource.slice(cancelStart, cancelEnd);

    expect(cancelSource).toContain("setFileName(null)");
    expect(cancelSource).toContain('setFileText("")');
    expect(cancelSource).toContain("setFilePoints(null)");
    expect(cancelSource).toContain("setFileWholeDraftSaved(null)");
    expect(cancelSource).toContain('setFileImportMode("points")');
    expect(cancelSource).toContain("setCaptureWorkspaceOpen(false)");
    expect(cancelSource).toContain('navigate("/erfassen", { replace: true, state: null })');
    expect(cancelSource).toContain('window.scrollTo({ top: 0, behavior: "smooth" })');
    expect(cancelSource).not.toContain("fileWholeDraft.mutate");
    expect(cancelSource).not.toContain("extract.mutate");
    expect(cancelSource).not.toContain("endpoints.drafts.create");
    expect(cancelSource).not.toContain("endpoints.ko.create");
  });

  it("Dateiimport-Abbrechen blendet den Freitext-/Frontdoor-Workspace aus statt ihn zu oeffnen", () => {
    const captureSource = readFileSync(
      resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
      "utf8",
    );

    // SCRUM-458: der Arbeitsraum startet jetzt EINGEKLAPPT (ruhiger Aufklapp-Einstieg statt vollem
    // Formular). Der Default läuft über initialCaptureWorkspaceOpen (eingeklappt, außer aktiver Kontext;
    // in captureEntry.modes.test.ts geprüft) — NICHT mehr useState(true). Der KW-W2-01-Kern bleibt:
    // Dateiimport-Abbrechen blendet aus (cancelFileImport → setCaptureWorkspaceOpen(false), oben geprüft).
    expect(captureSource).toContain("initialCaptureWorkspaceOpen({");
    expect(captureSource).not.toContain(
      "const [captureWorkspaceOpen, setCaptureWorkspaceOpen] = useState(true)",
    );
    expect(captureSource).toContain("const openCaptureWorkspace = (): void =>");
    expect(captureSource).toContain("Weitere Wege anzeigen");
    expect(captureSource).toContain("captureWorkspaceOpen && !expertView");
    expect(captureSource).toContain('captureWorkspaceOpen && (expertView || wizStep === "tell")');
    expect(captureSource).toContain("aria-hidden={!captureWorkspaceOpen}");
    expect(captureSource).toContain(': "hidden"');
  });
});

describe("PMO-FEA-0006: Modus-Verdrahtung + Copy", () => {
  it('„datei" ist vierter Erzähl-Modus; Formular bleibt der Expertenpfad', () => {
    expect(NARRATE_MODES).toContain("datei");
    expect(CAPTURE_MODES).toContain("datei");
    expect(NARRATE_MODES[0]).toBe("freitext");
  });

  it("Copy ist DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [...Object.values(CAPTURE_FILE_TEXT), "capture.mode.datei", "adm.ai.task.extract"];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("Ehrlichkeit in der Copy: nichts automatisch, Belegstellen statt Erfindung", () => {
    const deHint = String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.hint));
    expect(deHint).toMatch(/nichts automatisch|gespeichert wird nichts automatisch/i);
    const deHelp = String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.queryHelpBody));
    expect(deHelp).toMatch(/Erfunden wird .* nichts/i);
    const deQueue = String(i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.queueHint));
    expect(deQueue).toMatch(/nichts wird automatisch gespeichert/i);
  });
});
