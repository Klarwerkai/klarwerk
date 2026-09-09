// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT as T,
  wholeDocumentBodyHtml,
} from "../../apps/web/src/lib/captureFromFile";
import {
  bremse,
  buttonByText,
  click,
  container,
  dateiEinlesen,
  dateiEinlesenBeenden,
  dateiEinlesenStarten,
  draftId,
  endpoints,
  englisch,
  fehlerpin,
  flush,
  modusKarte,
  mount,
  pageText,
  sichtbar,
  txt,
} from "./datei-buehne";

type Key = keyof typeof T;
type Marke = "FOLGT" | "EINGEFROREN" | "NICHT_ERREICHBAR";
type Zeile = readonly [Key, Marke, string];
// Grenze: Handlungs-/Feld-/Abschnittsbeschriftungen und aufklappbare Bedienhilfe sind keine
// Zustandsmeldungen. Anleitungen hint/hintWhole, Quittungen, Fehler und Fortschritt bleiben drin.
// Kein Default-Ausschluss: jeder Eintrag begründet sich einzeln, neue Produktschlüssel machen rot.

const BEDIENBESCHRIFTUNGEN: Partial<Record<Key, string>> = {
  upload: "Handlung: Datei hochladen.",
  replace: "Handlung: Datei ersetzen.",
  remove: "Handlung: Datei entfernen.",
  pick: "Handlung: nativen Dateidialog öffnen.",
  queryLabel: "Beschriftung des Suchfelds.",
  queryPlaceholder: "Eingabehilfe des Suchfelds.",
  queryHelpTitle: "Titel der aufklappbaren Suchhilfe.",
  queryHelpBody: "Bedienhilfe zum Suchauftrag.",
  langLabel: "Beschriftung der Sprachauswahl.",
  langSystem: "Auswahlwert für die Ergebnissprache.",
  langSource: "Auswahlwert für die Quellsprache.",
  langHelpTitle: "Titel der Sprachhilfe.",
  langHelpBody: "Bedienhilfe zur Ergebnissprache.",
  importModeLabel: "Beschriftung der Importart-Auswahl.",
  importModePoints: "Auswahlhandlung Punkte.",
  importModePointsDesc: "Beschreibung der Punkte-Auswahlkarte.",
  importModeWhole: "Auswahlhandlung Ganzdokument.",
  importModeWholeDesc: "Beschreibung der Ganzdokument-Auswahlkarte.",
  searchCta: "Handlung: Analyse starten.",
  wholeCta: "Handlung: Ganzdokument speichern.",
  wholeOpenDraft: "Handlung: gespeicherten Entwurf öffnen.",
  wholeImportAnother: "Handlung: nächste Datei importieren.",
  formatTitle: "Titel der aufklappbaren Formathilfe.",
  formatHint: "Statische Bedienhilfe zur Formatübernahme.",
  supportedTitle: "Überschrift der Formatübersicht.",
  supportedFormats: "Statische Übersicht der unterstützten Dateitypen.",
  unsupportedFormats: "Statische Übersicht nicht unterstützter Dateitypen.",
  cancel: "Handlung: Dateiimport abbrechen.",
  pointsTitle: "Überschrift der Punkteliste.",
  pointsHint: "Statische Bedienhilfe zur Punkteliste.",
  excerptLabel: "Beschriftung der Belegstelle.",
  applyCta: "Handlung: ausgewählte Punkte übernehmen.",
  queueHint: "Statische Bedienhilfe zur Warteschlange.",
  queueSkip: "Handlung: Warteschlangenpunkt überspringen.",
  saveDraftsCta: "Handlung: Punkte als Entwürfe speichern.",
  mergeCta: "Handlung: Punkte verbinden.",
  connectHint: "Bedienhilfe zum Verbinden.",
  connectDisabledHint: "Erklärung zur deaktivierten Verbinden-Handlung.",
  selectAll: "Handlung: alle Punkte auswählen.",
  deselectAll: "Handlung: alle Punkte abwählen.",
  applyDisabledHint: "Bedienhilfe zur deaktivierten Übernahme.",
  purgeUnselectedYes: "Antwortaktion: ungewählte Punkte löschen.",
  purgeUnselectedKeep: "Antwortaktion: ungewählte Punkte behalten.",
};

// Datentabelle aller Meldungen; Schlüssel stammen aus dem Produkt, nie aus einem Übersetzungsdump.
const INVENTAR: readonly Zeile[] = [
  ["hint", "FOLGT", "Punkte-Startzustand."],
  ["hintWhole", "FOLGT", "Klick auf Ganzdokument."],
  ["dropHint", "FOLGT", "Ablagefläche im Ruhezustand."],
  ["dropActive", "FOLGT", "dragover auf der echten Ablagefläche."],
  ["dropReject", "EINGEFROREN", "Nicht unterstützte BIN über echte Ablagefläche."],
  ["extracting", "EINGEFROREN", "TXT-Lesen angehalten; Capture.setNotice(t(...))."],
  [
    "loaded",
    "NICHT_ERREICHBAR",
    "CaptureArbeitsraum verwendet loadedStats; loaded gehört zu BodyExtractPanel.",
  ],
  ["empty", "EINGEFROREN", "Leere echte TXT; Capture.setErr(t(emptyKey))."],
  [
    "emptyPdf",
    "NICHT_ERREICHBAR",
    "Braucht PDF ohne Textebene; Bühne liest TXT, keine PDF-Fixture.",
  ],
  ["emptyPptx", "NICHT_ERREICHBAR", "Braucht textlose PPTX; Bühne liest TXT, keine PPTX-Fixture."],
  [
    "pdfTruncated",
    "NICHT_ERREICHBAR",
    "Braucht PDF mit greifendem Seitenlimit; keine PDF-Fixture.",
  ],
  [
    "pptxTruncated",
    "NICHT_ERREICHBAR",
    "Braucht PPTX mit greifendem Folienlimit; keine PPTX-Fixture.",
  ],
  [
    "pptxTooLarge",
    "NICHT_ERREICHBAR",
    "Braucht PPTX, die das Archiv-/Dekompressionsbudget sprengt; kein PPTX-Parserlauf.",
  ],
  [
    "pptxImagesFormat",
    "NICHT_ERREICHBAR",
    "Braucht Bilder mit nicht unterstütztem Format im PPTX-Bildtransfer; TXT enthält keine.",
  ],
  [
    "pptxImagesBudget",
    "NICHT_ERREICHBAR",
    "Braucht Budgetverlust im PPTX-Bildtransfer; TXT enthält keine Bilder.",
  ],
  [
    "imagesOnlyNoText",
    "NICHT_ERREICHBAR",
    "Braucht bildreines Dokument mit erfolgreich eingebetteten Bildern; keine Binärfixture.",
  ],
  [
    "imagesAllDropped",
    "NICHT_ERREICHBAR",
    "Braucht vollständigen Bildverlust plus gesichertes Original; TXT hat keine Bildbilanz.",
  ],
  [
    "imagesAllDroppedNoOriginal",
    "NICHT_ERREICHBAR",
    "Braucht vollständigen Bildverlust plus fehlendes Original; kein Upload-Fehlschlag gefahren.",
  ],
  [
    "imagesDefect",
    "NICHT_ERREICHBAR",
    "Braucht defekte Bildverweise in DOCX/PPTX; TXT hat keine Bildverweise.",
  ],
  [
    "imagesOutsidePath",
    "NICHT_ERREICHBAR",
    "Braucht Bilder außerhalb des ausgewerteten Folienpfads; kein PPTX-Parserlauf.",
  ],
  [
    "imagesBudgetBodyHtml",
    "NICHT_ERREICHBAR",
    "Braucht Bild-Drops am HTML-Bytebudget; kein bildhaltiges HTML eingelesen.",
  ],
  [
    "imagesBudgetSingleImage",
    "NICHT_ERREICHBAR",
    "Braucht zu großes PPTX-Einzelbild; keine PPTX-Fixture.",
  ],
  [
    "imagesBudgetTotalImages",
    "NICHT_ERREICHBAR",
    "Braucht Überschreitung des PPTX-Gesamtbildbudgets; keine PPTX-Fixture.",
  ],
  [
    "imageCaptionPlaceholder",
    "NICHT_ERREICHBAR",
    "Gespeicherter Bild-Fußnoteninhalt aus DOCX/PPTX, keine UI-Quittung; TXT ohne Bilder.",
  ],
  [
    "captionsBalance",
    "NICHT_ERREICHBAR",
    "Braucht DOCX-Beschriftungen mit eindeutigen und mehrdeutigen Zuordnungen; keine DOCX-Fixture.",
  ],
  [
    "captionsBalanceAssigned",
    "NICHT_ERREICHBAR",
    "Braucht DOCX mit eindeutig zugeordneten Beschriftungen; keine DOCX-Fixture.",
  ],
  [
    "captionsBalanceAmbiguous",
    "NICHT_ERREICHBAR",
    "Braucht DOCX mit nur mehrdeutigen Beschriftungen; keine DOCX-Fixture.",
  ],
  [
    "imagesKept",
    "NICHT_ERREICHBAR",
    "Braucht Bildbilanz und gelungenen Original-Upload; TXT hat keine Bilder.",
  ],
  [
    "imagesKeptDropped",
    "NICHT_ERREICHBAR",
    "Braucht behaltene und verworfene Bilder plus gesichertes Original; keine Bildfixture.",
  ],
  [
    "imagesNoOriginal",
    "NICHT_ERREICHBAR",
    "Braucht Bilder plus fehlgeschlagenen Original-Upload; kein echter Upload-Fehlschlag.",
  ],
  [
    "imagesLost",
    "NICHT_ERREICHBAR",
    "Braucht Bildverlust und fehlgeschlagenen Original-Upload; kein echter Upload-Fehlschlag.",
  ],
  [
    "tooLargeForImport",
    "EINGEFROREN",
    "Echte TXT mit 4.500.000 Zeichen; Größen-Preflight vor Object-Upload.",
  ],
  ["importNoteDocx", "NICHT_ERREICHBAR", "Braucht DOCX-Einlesen; keine DOCX-Fixture."],
  ["importNotePdf", "NICHT_ERREICHBAR", "Braucht PDF-Einlesen; keine PDF-Fixture."],
  ["importNotePptx", "NICHT_ERREICHBAR", "Braucht PPTX-Einlesen; keine PPTX-Fixture."],
  ["parseError", "EINGEFROREN", "readTextFile wirft definierten Lesefehler."],
  [
    "unsupported",
    "EINGEFROREN",
    "Nicht unterstützte Datei über den echten File-Input (Drop lehnt vorher ab).",
  ],
  [
    "ocrCta",
    "NICHT_ERREICHBAR",
    "Braucht Bilddatei als OCR-Kandidat; TXT-Bühne, OCR-Weg ausdrücklich außerhalb des Auftrags.",
  ],
  [
    "ocrBusy",
    "NICHT_ERREICHBAR",
    "Braucht Bilddatei und bewussten OCR-Start; OCR-Weg außerhalb des Auftrags.",
  ],
  [
    "searching",
    "NICHT_ERREICHBAR",
    "Braucht verfügbare KI-Analyse; reasoner.status dieser Bühne ist active=false.",
  ],
  ["wholeSaving", "FOLGT", "Speicherklick, API-Antwort angehalten."],
  ["wholeSaved", "EINGEFROREN", "Speicherklick; Erfolgssatz wird in notice und Toast abgelegt."],
  ["wholeSourceNote", "FOLGT", "Datei gelesen, vor bewusstem Speichern."],
  ["wholeSavedTitle", "FOLGT", "Bewusster Speicherklick, API-Antwort mit ID."],
  ["wholeSavedBadge", "FOLGT", "Bewusster Speicherklick, API-Antwort mit ID."],
  ["wholeSavedSource", "FOLGT", "Bewusster Speicherklick, API-Antwort mit ID."],
  [
    "wholeOpenMissing",
    "EINGEFROREN",
    "Speicherantwort ohne ID: UI-Karte wandert, err und Toast bleiben deutsch.",
  ],
  [
    "pointCount",
    "NICHT_ERREICHBAR",
    "Braucht KI-Punkteantwort; diese Bühne hat keine KI-Extraktion.",
  ],
  [
    "queueBadge",
    "NICHT_ERREICHBAR",
    "Braucht übernommene KI-Punkte und Warteschlange; keine KI-Punkteantwort.",
  ],
  [
    "queueDone",
    "NICHT_ERREICHBAR",
    "Braucht abgeschlossene Punkt-Warteschlange; keine KI-Punkteantwort.",
  ],
  [
    "sourceNote",
    "NICHT_ERREICHBAR",
    "Braucht in den Wizard geladenen Warteschlangenpunkt; keine KI-Punkteantwort.",
  ],
  ["loadedStats", "FOLGT", "240 Zeichen TXT im Punkte-Modus."],
  ["loadedStatsWhole", "FOLGT", "240 Zeichen TXT im Ganzdokument-Modus."],
  [
    "draftsSaved",
    "NICHT_ERREICHBAR",
    "Braucht mindestens zwei ausgewählte KI-Punkte; keine KI-Punkteantwort.",
  ],
  [
    "draftsPartial",
    "NICHT_ERREICHBAR",
    "Braucht Mehrpunkt-Speicherung mit partieller Fehlerantwort; keine KI-Punkteantwort.",
  ],
  [
    "mergedNote",
    "NICHT_ERREICHBAR",
    "Quelle im erzeugten zusammengeführten Punkt; keine KI-Punkteantwort.",
  ],
  [
    "mergedInList",
    "NICHT_ERREICHBAR",
    "Braucht mindestens zwei verbundene KI-Punkte; keine KI-Punkteantwort.",
  ],
  [
    "purgeUnselectedQ",
    "NICHT_ERREICHBAR",
    "Braucht Mehrpunkt-Speicherung mit nicht gewählten Punkten; keine KI-Punkteantwort.",
  ],
];

const PARAMS = { name: "SPRACHE.txt", chars: 240 };
const WORTLAUT: Partial<Record<Key, readonly [string, string, boolean]>> = {
  tooLargeForImport: [
    "Das Dokument ist auch nach Bildkompression zu groß für den Textimport — bitte kleiner aufteilen. Das Original bleibt unberührt.",
    "Even after image compression the document is too large for text import — please split it up. The original stays untouched.",
    false,
  ],
  extracting: ["Lese „SPRACHE.txt“ …", "Reading “SPRACHE.txt” …", false],
  empty: ["In „SPRACHE.txt“ wurde kein Text gefunden.", "No text found in “SPRACHE.txt”.", false],
  parseError: [
    "„SPRACHE.txt“ konnte nicht gelesen werden.",
    "“SPRACHE.txt” could not be read.",
    false,
  ],
  unsupported: [
    "„SPRACHE.bin“ wird hier nicht unterstützt — bitte als TXT/MD, DOCX, PDF oder PPTX bereitstellen. Bilder gehen nur über OCR.",
    "“SPRACHE.bin” is not supported here — please provide TXT/MD, DOCX, PDF, or PPTX. Images only work via OCR.",
    false,
  ],
  dropReject: [
    "„SPRACHE.bin“ wird hier noch nicht unterstützt — bitte eine Text-, Word-, PDF-, PPTX- oder Bilddatei ablegen.",
    "“SPRACHE.bin” is not supported here yet — please drop a text, Word, PDF, PPTX or image file.",
    false,
  ],
  wholeSaved: [
    "„SPRACHE.txt“ als ein Entwurf gespeichert — Quelle: Dateiname, gesamtes Dokument.",
    "“SPRACHE.txt” saved as one draft — source: file name, whole document.",
    false,
  ],
  wholeOpenMissing: [
    "Entwurf wurde gespeichert, konnte aber nicht direkt geöffnet werden.",
    "Draft was saved, but could not be opened directly.",
    true,
  ],
};
async function ganzes(): Promise<void> {
  await click(modusKarte(T.importModeWhole));
  await dateiEinlesen(PARAMS.name);
}
async function ausloesen(key: Key): Promise<void> {
  await mount();
  switch (key) {
    case "tooLargeForImport":
      await click(modusKarte(T.importModeWhole));
      await dateiEinlesen(PARAMS.name, "A".repeat(4_500_000));
      await click(buttonByText(txt(T.wholeCta)));
      expect(endpoints.objects.upload).not.toHaveBeenCalled();
      expect(endpoints.drafts.create).not.toHaveBeenCalled();
      return;
    case "hint":
    case "dropHint":
      return;
    case "hintWhole":
      await click(modusKarte(T.importModeWhole));
      return;
    case "dropActive":
      await act(async () => {
        const zone = container.querySelector("[data-testid=capture-dropzone]");
        expect(zone).not.toBeNull();
        zone?.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
        await flush();
      });
      return;
    case "loadedStats":
      await dateiEinlesen(PARAMS.name);
      return;
    case "loadedStatsWhole":
    case "wholeSourceNote":
      await ganzes();
      return;
    case "extracting":
      await dateiEinlesenStarten(PARAMS.name);
      return;
    case "empty":
      await dateiEinlesen(PARAMS.name, "");
      return;
    case "parseError":
      bremse.fehler = true;
      await dateiEinlesen(PARAMS.name);
      expect(sichtbar()).toContain("(JOB3379 Lesefehler)");
      return;
    case "dropReject":
      await dateiEinlesen("SPRACHE.bin");
      return;
    case "unsupported":
      // Drop wird früher von CaptureFileImport abgefangen. Für unsupported daher der vorhandene
      // File-Input: dessen echtes change-Ereignis liefert die nicht unterstützte Systemauswahl.
      await act(async () => {
        const input = container.querySelector<HTMLInputElement>('input[type="file"]');
        expect(input).not.toBeNull();
        Object.defineProperty(input, "files", {
          configurable: true,
          value: [new File(["bin"], "SPRACHE.bin", { type: "application/octet-stream" })],
        });
        input?.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      });
      return;
    case "wholeSaving":
    case "wholeSaved":
    case "wholeSavedTitle":
    case "wholeSavedBadge":
    case "wholeSavedSource":
    case "wholeOpenMissing":
      if (key === "wholeOpenMissing") draftId.wert = null;
      if (key === "wholeSaving") draftId.halten = true;
      await ganzes();
      expect(endpoints.drafts.create).not.toHaveBeenCalled();
      await click(buttonByText(txt(T.wholeCta)));
      expect(endpoints.drafts.create).toHaveBeenCalledTimes(1);
      return;
    default:
      throw new Error(`Kein Auslöseweg für ${key}`);
  }
}
async function aufloesen(): Promise<void> {
  if (bremse.loesen) await dateiEinlesenBeenden();
  if (draftId.loesen) {
    await act(async () => {
      draftId.loesen?.();
      await flush();
    });
  }
}

describe("JOB 3379 · vollständiges Meldungsinventar aus CAPTURE_FILE_TEXT", () => {
  it("Inventar · Produktmenge = Ausschlüsse + drei disjunkte Marken; kein stiller Rest", () => {
    const quelle = Object.keys(T).sort();
    // Derselbe echte Collector wie im Tor-Inventar, ohne Testausführung. Der Gruppenwert wird
    // ausdrücklich gesetzt, weil das Tor selbst bereits mit einer Gruppenumgebung aufruft.
    const rest = execFileSync(
      "npx",
      ["vitest", "list", "--filesOnly", "tests/import-anleitung-modus"],
      {
        encoding: "utf8",
        env: { ...process.env, KLARWERK_TESTGRUPPE: "rest" },
      },
    );
    for (const datei of [
      "abbruch-dann-moduswechsel.test.tsx",
      "sprachwechsel-import-meldungen.test.tsx",
    ]) {
      expect(rest).toContain(`tests/import-anleitung-modus/${datei}`);
    }
    expect(rest).not.toContain("tastatur-importart-chromium.test.ts");
    console.info(
      "REST-GRUPPE: beide neuen jsdom-Dateien vom echten Collector erfasst; Chromium ausgeschlossen.",
    );
    const ausschluesse = Object.keys(BEDIENBESCHRIFTUNGEN);
    const meldungen = INVENTAR.map(([key]) => key);
    expect([...ausschluesse, ...meldungen].sort()).toEqual(quelle);
    expect(new Set([...ausschluesse, ...meldungen]).size).toBe(quelle.length);
    for (const marke of ["FOLGT", "EINGEFROREN", "NICHT_ERREICHBAR"] as const) {
      const menge = INVENTAR.filter(([, m]) => m === marke).map(([k]) => k);
      const andere = INVENTAR.filter(([, m]) => m !== marke).map(([k]) => k);
      expect(menge.filter((k) => andere.includes(k))).toEqual([]);
    }
    for (const [, , grund] of INVENTAR) expect(grund.trim().length).toBeGreaterThan(15);
    for (const grund of Object.values(BEDIENBESCHRIFTUNGEN))
      expect(grund.length).toBeGreaterThan(15);
    expect(
      INVENTAR.filter(([, m]) => m === "EINGEFROREN")
        .map(([k]) => k)
        .sort(),
    ).toEqual(Object.keys(WORTLAUT).sort());
  });

  for (const [key, marke] of INVENTAR) {
    if (marke === "NICHT_ERREICHBAR") continue;
    if (marke === "FOLGT") {
      it(`FOLGT · ${key} · DE sichtbar → EN sichtbar und DE vollständig weg`, async () => {
        await ausloesen(key);
        const de = txt(T[key], PARAMS);
        const en = String(i18n.getFixedT("en")(T[key], PARAMS)).replace(/\s+/g, " ");
        expect(de).not.toBe(T[key]);
        expect(en).not.toBe(T[key]);
        expect(en).not.toBe(de);
        expect(sichtbar()).toContain(de);
        await englisch();
        expect(sichtbar(), `${key}: englischer Satz nach Sprachwechsel`).toContain(en);
        expect(
          pageText(),
          `${key}: deutscher Satz muss auch aus verborgenem DOM verschwinden`,
        ).not.toContain(de);
        await aufloesen();
      });
    } else {
      it.fails(`EINGEFROREN · ${key} · BEFUND statt Sprachtreue`, async () => {
        const pin = WORTLAUT[key];
        if (!pin) throw new Error(`Wörtlicher Fehlerpin fehlt: ${key}`);
        const [de, en, englischZusaetzlich] = pin;
        const befund = `BEFUND ${key}: nach DE→EN bleibt „${de}“; EN ${englischZusaetzlich ? "zusätzlich sichtbar" : "fehlt"}: „${en}“`;
        await fehlerpin(befund, async () => {
          await ausloesen(key);
          const params = {
            ...PARAMS,
            name: key === "unsupported" || key === "dropReject" ? "SPRACHE.bin" : PARAMS.name,
          };
          expect(txt(T[key], params)).toBe(de);
          expect(String(i18n.getFixedT("en")(T[key], params))).toBe(en);
          expect(sichtbar()).toContain(de);
          expect(sichtbar()).not.toContain(en);
          await englisch();
          const eingefroren = sichtbar().includes(de);
          if (eingefroren) {
            expect(sichtbar().includes(en)).toBe(englischZusaetzlich);
          } else {
            expect(sichtbar()).toContain(en);
            expect(pageText()).not.toContain(de);
          }
          await aufloesen();
          return eingefroren;
        });
      });
    }
  }

  it("3(ii) · RICHTIG: deutsch gespeicherter Quelle-Blockquote bleibt bei DE→EN bytegleich", async () => {
    await mount();
    await ganzes();
    await click(buttonByText(txt(T.wholeCta)));
    const payload = vi.mocked(endpoints.drafts.create).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    const gespeichert = payload?.bodyHtml;
    expect(gespeichert).toContain(
      wholeDocumentBodyHtml({
        fileName: PARAMS.name,
        text: "A".repeat(240),
        locale: "de",
        sourceKind: "text",
      }),
    );
    expect(gespeichert).toContain(
      "<blockquote><p>Quelle: SPRACHE.txt, gesamtes Dokument</p></blockquote>",
    );
    // SOURCE_LABELS (captureFromFile.ts, localeKey + wholeDocumentBodyHtml) wählt die beim
    // Speichern angegebene Sprache. Der Body ist Inhalt und darf nicht zu UI-Copy werden.
    // Auch die Verlusthinweise sind gespeicherter Inhalt: Serializer separat, keine echten
    // DOCX/PDF/PPTX-Parser oder Binärdateien werden damit als geprüft ausgegeben.
    const quellen = (["docx", "pdf", "pptx"] as const).map((sourceKind) => {
      const input = { fileName: `SPRACHE.${sourceKind}`, text: "Inhalt", sourceKind, locale: "de" };
      return { input, html: wholeDocumentBodyHtml(input) };
    });
    const deBadge = txt(T.wholeSavedBadge);
    await englisch();
    expect(sichtbar()).toContain(txt(T.wholeSavedBadge));
    expect(pageText()).not.toContain(deBadge);
    expect(vi.mocked(endpoints.drafts.create).mock.calls[0]?.[0]?.bodyHtml).toBe(gespeichert);
    expect(endpoints.drafts.create).toHaveBeenCalledTimes(1);
    for (const { input, html } of quellen) {
      expect(html).toContain("<blockquote><p>Quelle:");
      expect(html).toContain("gesamtes Dokument</p><p>");
      expect(
        wholeDocumentBodyHtml(input),
        "gespeicherte Sprache gewinnt gegen aktuelle UI-Sprache",
      ).toBe(html);
      expect(wholeDocumentBodyHtml({ ...input, locale: "en" })).not.toBe(html);
    }
  });
});
