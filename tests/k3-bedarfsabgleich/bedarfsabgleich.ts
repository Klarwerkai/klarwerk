// ================================================================================================
// R-0991 (K3) · DER HEUTIGE BEDARFSABGLEICH DER 82 KANDIDATEN AUS JOB 2612.
// ================================================================================================
//
// Quelle der Kandidaten: die D1-Klassifikation (JOB 2612, `klassifikation.md`, Zeilen 1–82) samt
// der D3-Korrekturpflichten aus `BEN-PRUEFUNG-JOB-2612-D2.md`, bereitgestellt im
// Auftragsverzeichnis unter `QUELLEN-K3-HISTORIE.json`. Die historischen Urteile belegen NICHT den heutigen Stand; jede
// Zeile unten ist am heutigen Code gegengeprüft, und `bedarfsabgleich.test.ts` liest jeden Beleg
// beim Lauf erneut aus dem Code, statt ihn zu glauben.
//
// DIE DREI FÄLLE (Wortlaut JOB 2612 D1 §2):
//   A — Aufruf fehlt: wird gebraucht, niemand ruft es. Im Produkt fehlt dann eine Funktion.
//   B — überholt: die Sache wird anderswo anders gemacht (der Beleg nennt den ANDEREN Weg mit
//       seinem eigenen Produktverbraucher — nie nur einen Geschwister-Export derselben Datei).
//   C — absichtlich offen: Prüfhilfe, offene Produktentscheidung oder fehlender Serverweg.
//
// ERGEBNIS HEUTE: 4 × A (drei inzwischen von anderen Aufträgen angeschlossen, einer HIER neu),
// 73 × B, 5 × C. Damit fehlt heute genau EINE Fähigkeit — nicht drei. Nach der originalen
// Ausweichklausel (D3, Pflicht 3) wird genau dieser eine Fall eingebaut
// (`components/ImportSelect.tsx` → `components/ImportPreviewTree.tsx`, Wirkungstest
// `ordner-ohne-seite-mounted.test.tsx`); für alle übrigen trägt die Einzeltabelle die Klausel.
//
// NACHTRAG R-1349 (Nacharbeit 4): Die B- und C-Fälle sind seither einzeln abgeschlossen —
// entfernt, angeschlossen, in den Test gezogen, als Fremdlesekante gemessen oder als offene
// Produktentscheidung geführt. Die Einstufung oben bleibt das historische R-0991-Ergebnis; der
// Ausgang je Fall steht in `R1349_AUSGANG` am Ende dieser Datei.
//
// Die 25 Word-Add-in-Funde (Nr. 58–82) tragen `beleg: "word-spiegel"`: die Kette TypeScript-Export
// → ausgelieferter Spiegel (`apps/web/public/word-addin/taskpane.js`, eingebunden von
// `taskpane.html`) → realer Aufruf im Spiegel prüft der Test je Name einzeln. Die zwei Namen, die
// 2026-08 im Spiegel noch ohne Aufruf waren (`WORD_ADDIN_ASK_TIMEOUT_MS`,
// `WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS`), haben dort heute Aufrufe — gemessen, nicht übernommen.

export type Fall = "A" | "B" | "C";

/** Heutiger Stand der Fähigkeit. */
export type Stand =
  /** A, von einem anderen Auftrag inzwischen angeschlossen. */
  | "angeschlossen"
  /** A, in diesem Auftrag angeschlossen (R-0991). */
  | "neu-angeschlossen"
  /** B: die Fähigkeit trägt ein anderer, belegter Produktweg. */
  | "alternativweg"
  /** C: bleibt begründet offen. */
  | "offen";

export interface Beleg {
  /** Datei relativ zur Wurzel des Arbeitsbaums. */
  datei: string;
  /** Regulärer Ausdruck, der den Beleg in dieser Datei HEUTE trifft. */
  muster: string;
}

export interface Bedarf {
  nr: number;
  /** Datei unter `apps/web/src/lib/`, so wie die Klassifikation sie nennt. */
  datei: string;
  name: string;
  faehigkeit: string;
  fall: Fall;
  stand: Stand;
  beleg: Beleg | "word-spiegel";
  /** Weitere Glieder derselben Kette (z. B. Knopf → Handler → Bibliotheksfunktion). */
  kette?: readonly Beleg[];
  begruendung: string;
}

/** Die 82 Kandidaten der D1-Klassifikation (Zeilen 1–82), wörtlich `Datei::Name`. */
export const HISTORISCH: readonly string[] = [
  "adminForms.ts::isNewUserValid",
  "adminSections.ts::isAdminSectionId",
  "answerMarkdown.ts::stripAnswerMarkdown",
  "askGapRescue.ts::gapRescueStepLabelKey",
  "askResponse.ts::selectGap",
  "attachment.ts::attachmentPreview",
  "attachment.ts::isObjectAttachment",
  "boardCard.ts::BOARD_REMOVED_LABEL_KEY",
  "boardCard.ts::duplicateLead",
  "bodyFileLink.ts::applyBodyFileLink",
  "captureAttachments.ts::uploadAttachments",
  "captureFlowGuide.ts::captureFlowStepLabelKey",
  "captureFromFile.ts::createWholeDocumentDraft",
  "conflictCollision.ts::conflictDisplayMode",
  "conflictImpact.ts::effectiveUsability",
  "demoKnowledge.ts::demoKnowledgeBadge",
  "demoKnowledge.ts::filterByDemoKnowledge",
  "draftForm.ts::isPromotable",
  "draftListView.ts::isDraftSortKey",
  "editorAttachmentContext.ts::ATTACH_FILE_HINT_KEY",
  "editorAttachmentContext.ts::ATTACH_FILES_KEY",
  "editorAttachmentContext.ts::ATTACH_IMAGE_HINT_KEY",
  "editorAttachmentContext.ts::ATTACH_IMAGES_KEY",
  "editorAttachmentContext.ts::ATTACH_TITLE_KEY",
  "examplePackages.ts::EXAMPLE_PACKAGES_ALL_KEYS",
  "externalSearch.ts::isAttachable",
  "fileMultiPoint.ts::mergedDraftFromPoints",
  "funke.ts::openGapsView",
  "importSelectView.ts::folderTreeSegmentKey",
  "importSelectView.ts::ordnerOhneEigeneZeile",
  "intakeSimilarity.ts::classifyIntake",
  "interviewFlow.ts::answeredTurns",
  "knowledgeRescue.ts::rescueStepLabelKey",
  "knowledgeStory.ts::KNOWLEDGE_STORY_SURFACES",
  "knowledgeStudioGuide.ts::studioGuideActiveStep",
  "knowledgeStudioLayout.ts::knowledgeStudioSections",
  "koEvidence.ts::evidenceKindLabel",
  "koLabel.ts::hatTitel",
  "learningPath.ts::nextOpenStep",
  "libraryMaturity.ts::countByMaturity",
  "libraryMaturity.ts::filterByMaturity",
  "libraryMaturity.ts::MATURITY_FILTERS",
  "libraryMaturity.ts::maturityFilterLabelKey",
  "librarySort.ts::isLibrarySortKey",
  "librarySpace.ts::koHomePath",
  "librarySpace.ts::serializeSpace",
  "librarySpace.ts::spaceFromParams",
  "loadingState.ts::isGroupLoaded",
  "mobileConfirm.ts::confirmsDelete",
  "mobileConfirm.ts::needsConfirmation",
  "offlineQueue.ts::replacePayload",
  "oidcCallback.ts::isCompleteCallback",
  "pdf.ts::extractPdfText",
  "reasonerStatus.ts::reasonerStatusSummary",
  "reviewerMinimum.ts::isNeededValidationsValid",
  "startHelp.ts::START_HELP_TOPICS",
  "validationStatus.ts::deriveDisplayStatus",
  "wordAddin.ts::answerIsLong",
  "wordAddin.ts::answerSelectionIsWhole",
  "wordAddin.ts::askAiNoticeVisible",
  "wordAddin.ts::askEvidenceDetail",
  "wordAddin.ts::askLocale",
  "wordAddin.ts::askSnippetWorthShowing",
  "wordAddin.ts::askSourceRole",
  "wordAddin.ts::askSourceStatus",
  "wordAddin.ts::canInsertAnswer",
  "wordAddin.ts::classifyDraftResponse",
  "wordAddin.ts::composeAnswerOutput",
  "wordAddin.ts::draftWasCreated",
  "wordAddin.ts::fillWordImages",
  "wordAddin.ts::klaraTrustHead",
  "wordAddin.ts::koDetailUrl",
  "wordAddin.ts::loginPollStep",
  "wordAddin.ts::openQuestionDraftTitle",
  "wordAddin.ts::performAsk",
  "wordAddin.ts::performCopy",
  "wordAddin.ts::performInsert",
  "wordAddin.ts::prepareAskQuestion",
  "wordAddin.ts::prepareWordDraftRequest",
  "wordAddin.ts::WORD_ADDIN_ASK_TIMEOUT_MS",
  "wordAddin.ts::WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS",
  "wordAddin.ts::wordHtmlToPlainText",
];

const B = (
  nr: number,
  datei: string,
  name: string,
  faehigkeit: string,
  beleg: Beleg,
  begruendung: string,
): Bedarf => ({
  nr,
  datei,
  name,
  faehigkeit,
  fall: "B",
  stand: "alternativweg",
  beleg,
  begruendung,
});

const C = (
  nr: number,
  datei: string,
  name: string,
  faehigkeit: string,
  beleg: Beleg,
  begruendung: string,
): Bedarf => ({
  nr,
  datei,
  name,
  faehigkeit,
  fall: "C",
  stand: "offen",
  beleg,
  begruendung,
});

const W = (nr: number, name: string, faehigkeit: string): Bedarf => ({
  nr,
  datei: "wordAddin.ts",
  name,
  faehigkeit,
  fall: "B",
  stand: "alternativweg",
  beleg: "word-spiegel",
  begruendung:
    "Das Word-Add-in lädt `lib/wordAddin.ts` nicht; es trägt dieselbe Funktion als eigene Fassung in `public/word-addin/taskpane.js` und ruft sie dort (je Name vom Test gemessen).",
});

export const BEDARFSABGLEICH: readonly Bedarf[] = [
  B(
    1,
    "adminForms.ts",
    "isNewUserValid",
    "Ja/Nein: Formular „Nutzer anlegen“ vollständig",
    { datei: "apps/web/src/pages/AdminKontenDetails.tsx", muster: "newUserIssues\\(newUser\\)" },
    "Die Nutzeranlage prüft über `newUserIssues` und nennt die fehlenden Felder einzeln — mehr als ein bloßes Ja/Nein.",
  ),
  {
    nr: 2,
    datei: "adminSections.ts",
    name: "isAdminSectionId",
    faehigkeit: "Fremden Querytext der Verwaltung als Bereich prüfen",
    fall: "A",
    stand: "angeschlossen",
    beleg: { datei: "apps/web/src/pages/Admin.tsx", muster: "isAdminSectionId\\(bereichRoh\\)" },
    begruendung:
      "Seit JOB 3337 liest die Verwaltung ihren Reiter aus der Adresse und prüft ihn genau hier.",
  },
  B(
    3,
    "answerMarkdown.ts",
    "stripAnswerMarkdown",
    "Antwort-Markdown für Klartext (Word) entfernen",
    {
      datei: "apps/web/public/word-addin/taskpane.js",
      muster: "function stripAskAnswerMarkdown\\(",
    },
    "Der einzige Bedarfsort (Word-Taskpane) trägt seine eigene Fassung `stripAskAnswerMarkdown`.",
  ),
  B(
    4,
    "askGapRescue.ts",
    "gapRescueStepLabelKey",
    "Beschriftung je Schritt der Lückenrettung",
    { datei: "apps/web/src/pages/Ask.tsx", muster: "GAP_RESCUE_STEPS\\.map" },
    "Die Schritte tragen ihren `labelKey` selbst; Ask und Erfassen rendern sie direkt daraus.",
  ),
  B(
    5,
    "askResponse.ts",
    "selectGap",
    "Lücke aus der Ask-Antwort lesen",
    { datei: "apps/web/src/pages/Ask.tsx", muster: "r\\.gap\\?\\.id" },
    "Ask liest `r.gap` unmittelbar und führt die Lücke weiter.",
  ),
  B(
    6,
    "attachment.ts",
    "attachmentPreview",
    "Vorschaubild eines Anhangs (Thumbnail, sonst dataUrl)",
    {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: "a\\.thumbnail \\|\\| a\\.dataUrl",
    },
    "Die Anhangsliste der Bibliothek wählt die Vorschau mit derselben Regel.",
  ),
  B(
    7,
    "attachment.ts",
    "isObjectAttachment",
    "Liegt ein Anhang im Objektspeicher?",
    {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: '\\(a\\.objectId \\?\\? ""\\)\\.trim\\(\\)\\.length > 0',
    },
    "Die Bibliothek filtert Objektanhänge über `objectId` selbst.",
  ),
  B(
    8,
    "boardCard.ts",
    "BOARD_REMOVED_LABEL_KEY",
    "Neutraler Hinweis „Objekt entfernt“ statt Kennung",
    { datei: "apps/web/src/pages/Duplicates.tsx", muster: 't\\("board\\.koRemoved"\\)' },
    "Duplikate, Konflikte und Befundkarte nennen den Schlüssel direkt.",
  ),
  B(
    9,
    "boardCard.ts",
    "duplicateLead",
    "Führungszeile eines Duplikatpaars (Titel/entfernt, Empfehlung)",
    {
      datei: "apps/web/src/pages/Duplicates.tsx",
      muster: 'pair\\.a\\?\\.title \\?\\? t\\("board\\.koRemoved"\\)',
    },
    "Das Duplikat-Board baut Paar und Empfehlung selbst auf.",
  ),
  B(
    10,
    "bodyFileLink.ts",
    "applyBodyFileLink",
    "Datei-Verweis an den Inhalt hängen",
    { datei: "apps/web/src/pages/Capture.tsx", muster: "fileLinkHtml\\(\\{" },
    "Erfassen und Editor hängen den Verweis über `fileLinkHtml` an.",
  ),
  B(
    11,
    "captureAttachments.ts",
    "uploadAttachments",
    "Anhänge einzeln hochladen und anheften, Teilfehler melden",
    { datei: "apps/web/src/pages/Capture.tsx", muster: "await finalizeCaptureSubmit\\(\\{" },
    "Das Einreichen nutzt den zweiphasigen Weg `finalizeCaptureSubmit` mit derselben Teilfehler-Bilanz.",
  ),
  B(
    12,
    "captureFlowGuide.ts",
    "captureFlowStepLabelKey",
    "Beschriftung der drei Erfassungsschritte",
    { datei: "apps/web/src/pages/Capture.tsx", muster: 'from "\\.\\./lib/captureWizard"' },
    "Der dreistufige Leitfaden ist durch die Erfassungsführung `captureWizard` (erzählen/verfeinern/fertig) abgelöst.",
  ),
  B(
    13,
    "captureFromFile.ts",
    "createWholeDocumentDraft",
    "Ganzes Dokument als einen Entwurf anlegen",
    { datei: "apps/web/src/pages/Capture.tsx", muster: "wholeDocumentDraftPayload\\(\\{" },
    "Erfassen baut den Ganzdokument-Entwurf über `wholeDocumentDraftPayload` und legt ihn selbst an.",
  ),
  B(
    14,
    "conflictCollision.ts",
    "conflictDisplayMode",
    "Darstellungsart eines Konflikts wählen",
    { datei: "apps/web/src/pages/Conflicts.tsx", muster: "resolveCollision\\(c, " },
    "Das Konflikt-Board entscheidet über `resolveCollision` und seine Rückfallkaskade.",
  ),
  B(
    15,
    "conflictImpact.ts",
    "effectiveUsability",
    "Nutzbarkeit eines Objekts samt Konfliktbegrenzung",
    {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: "conflictLimitedUsability\\(",
    },
    "Die Bibliothek setzt Basis und Konfliktbegrenzung selbst zusammen.",
  ),
  B(
    16,
    "demoKnowledge.ts",
    "demoKnowledgeBadge",
    "Marke für Vorführwissen",
    {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: "isDemoKnowledge\\(ko\\)",
    },
    "Bibliothek, Quellenliste und Erfassen zeigen `demo.badge.label` über `isDemoKnowledge`.",
  ),
  B(
    17,
    "demoKnowledge.ts",
    "filterByDemoKnowledge",
    "Liste nach Herkunft (Demo/eigen) filtern",
    {
      datei: "apps/web/src/pages/Validation.tsx",
      muster: "matchesDemoKnowledgeFilter\\(k, demoFilter\\)",
    },
    "Prüfboard und Bibliotheksfacette filtern je Eintrag über `matchesDemoKnowledgeFilter`.",
  ),
  B(
    18,
    "draftForm.ts",
    "isPromotable",
    "Pflichtangaben vor dem Einreichen vollständig?",
    { datei: "apps/web/src/pages/Capture.tsx", muster: "captureReadiness\\(\\{" },
    "Erfassen prüft die Pflichtangaben über `captureReadiness` und nennt die fehlenden.",
  ),
  B(
    19,
    "draftListView.ts",
    "isDraftSortKey",
    "Gespeicherte Sortierung der Entwurfsliste prüfen",
    { datei: "apps/web/src/components/CaptureDraftList.tsx", muster: "DRAFT_SORT_STORAGE_KEY," },
    "Die Entwurfsliste prüft den gespeicherten Wert gegen `DRAFT_SORT_KEYS` im Speicherhaken.",
  ),
  ...[
    [20, "ATTACH_FILE_HINT_KEY"],
    [21, "ATTACH_FILES_KEY"],
    [22, "ATTACH_IMAGE_HINT_KEY"],
    [23, "ATTACH_IMAGES_KEY"],
    [24, "ATTACH_TITLE_KEY"],
  ].map(([nr, name]) =>
    B(
      nr as number,
      "editorAttachmentContext.ts",
      name as string,
      "Texte der Anhangskarte im Editor",
      {
        datei: "apps/web/src/components/EditorAttachmentContext.tsx",
        muster: "editorMediaGuide\\(attachments\\)",
      },
      "Die Anhangskarte rendert die reichere Medienführung `editorMediaGuide` mit eigenen Texten.",
    ),
  ),
  C(
    25,
    "examplePackages.ts",
    "EXAMPLE_PACKAGES_ALL_KEYS",
    "Liste aller Texte der Beispielpakete",
    { datei: "apps/web/src/lib/examplePackages.ts", muster: "Sprachen-Test" },
    "Prüfhilfe für den Sprachtest, keine Produktfähigkeit; die Karte rendert die Texte selbst.",
  ),
  B(
    26,
    "externalSearch.ts",
    "isAttachable",
    "Externer Treffer ohne Titel ist nicht anhängbar",
    { datei: "services/external-search/src/wikipedia.ts", muster: "if \\(!title\\) \\{" },
    "Der Server verwirft Treffer ohne Titel, bevor sie die Fläche erreichen.",
  ),
  {
    ...B(
      27,
      "fileMultiPoint.ts",
      "mergedDraftFromPoints",
      "Mehrere Dateipunkte zu EINEM Entwurf zusammenführen",
      { datei: "apps/web/src/pages/Capture.tsx", muster: "onClick=\\{mergeSelectedPoints\\}" },
      "Erfassen führt gewählte Punkte über den Knopf „Verbinden“ zusammen: mergeSelectedPoints ruft mergeSelectedIntoOne (lib/captureFromFile.ts).",
    ),
    // Nacharbeit 13 (BEN): die ganze Kette Knopf → Handler → Bibliotheksfunktion, nicht nur der
    // daneben bestehende Einzelentwurfsweg `createPointDrafts`.
    kette: [
      {
        datei: "apps/web/src/pages/Capture.tsx",
        muster: "const mergeSelectedPoints = \\(\\): void =>",
      },
      { datei: "apps/web/src/pages/Capture.tsx", muster: "mergeSelectedIntoOne\\(pts\\)" },
      {
        datei: "apps/web/src/lib/captureFromFile.ts",
        muster: "export function mergeSelectedIntoOne\\(",
      },
    ],
  },
  B(
    28,
    "funke.ts",
    "openGapsView",
    "Offene Lücken nach Priorität gebündelt",
    {
      datei: "apps/web/src/components/FunkeCards.tsx",
      muster: "export function OpenGapsSummary",
    },
    "Die Liste mit Freitexten wurde bewusst durch eine Zahl ersetzt; Prioritäten pflegt die Risikofläche.",
  ),
  C(
    29,
    "importSelectView.ts",
    "folderTreeSegmentKey",
    "Kollisionsfreier Ordnerschlüssel",
    {
      datei: "tests/app/import-folder-key-collision.test.tsx",
      muster: 'folderTreeSegmentKey\\("A/B"\\)',
    },
    "Der Baum bildet den Schlüssel intern (`encodeTreeSegment`); der Export ist der Prüfzugang.",
  ),
  {
    nr: 30,
    datei: "importSelectView.ts",
    name: "ordnerOhneEigeneZeile",
    faehigkeit: "Ordner kennzeichnen, deren Elternseite nicht in der Importvorschau liegt",
    fall: "A",
    stand: "neu-angeschlossen",
    beleg: {
      datei: "apps/web/src/components/ImportSelect.tsx",
      muster: "ordnerOhneEigeneZeile\\(entries",
    },
    begruendung:
      "Fehlte heute: der Ordner sah aus wie eine mitimportierte Seite. Jetzt trägt er die Marke „Seite nicht in diesem Import“.",
  },
  B(
    31,
    "intakeSimilarity.ts",
    "classifyIntake",
    "Ähnlichkeit einer Eingabe zum Bestand (Live-Check)",
    {
      datei: "apps/web/src/hooks/useLiveKnowledgeCheck.ts",
      muster: "endpoints\\.knowledge\\.check\\(",
    },
    "Der Live-Check fragt den Server (`knowledge.check`) statt clientseitig zu vergleichen.",
  ),
  B(
    32,
    "interviewFlow.ts",
    "answeredTurns",
    "Fortschritt im Interview (beantwortete Fragen)",
    { datei: "apps/web/src/pages/Capture.tsx", muster: "n: ivAnswers\\.length \\+ 1" },
    "Das Interview zeigt „Frage n“ direkt aus der Antwortliste.",
  ),
  B(
    33,
    "knowledgeRescue.ts",
    "rescueStepLabelKey",
    "Beschriftung der Rettungsschritte",
    {
      datei: "apps/web/src/components/KnowledgeRescueIntro.tsx",
      muster: "KNOWLEDGE_RESCUE_STEPS\\.map",
    },
    "Die Schritte tragen ihren `labelKey` selbst.",
  ),
  B(
    34,
    "knowledgeStory.ts",
    "KNOWLEDGE_STORY_SURFACES",
    "Erzählzeile je Fläche",
    { datei: "apps/web/src/components/EmptyStateCtas.tsx", muster: "knowledgeStory\\(context\\)" },
    "Die Leerzustände holen ihre Zeile je Kontext über `knowledgeStory`.",
  ),
  B(
    35,
    "knowledgeStudioGuide.ts",
    "studioGuideActiveStep",
    "Aktiver Schritt der Studio-Leiste",
    {
      datei: "apps/web/src/components/KnowledgeInputStudio.tsx",
      muster: "nextStep\\.stepId === step\\.id",
    },
    "Ersetzt durch den inhaltsbewussten nächsten Schritt (`studioNextStep`).",
  ),
  B(
    36,
    "knowledgeStudioLayout.ts",
    "knowledgeStudioSections",
    "Abschnitte des Studios",
    {
      datei: "apps/web/src/components/KnowledgeInputStudio.tsx",
      muster: 'knowledgeStudioSectionLabelKey\\("editor"\\)',
    },
    "Das Studio rendert seine Abschnitte direkt mit `knowledgeStudioSectionLabelKey`.",
  ),
  B(
    37,
    "koEvidence.ts",
    "evidenceKindLabel",
    "Art eines Belegs (Quelle/Anhang)",
    { datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx", muster: "evidenceRows\\(" },
    "Die Belegzeilen entstehen über `evidenceRows` samt Art.",
  ),
  B(
    38,
    "koLabel.ts",
    "hatTitel",
    "Kennung nur zusätzlich zeigen, wenn ein Titel führt",
    { datei: "apps/web/src/pages/Stufe2.tsx", muster: "title=\\{p\\.koId\\}" },
    "Beide Flächen führen die Kennung immer nachrangig im Tooltip — keine Doppelung im Text.",
  ),
  B(
    39,
    "learningPath.ts",
    "nextOpenStep",
    "Nächster offener Lernschritt",
    { datei: "apps/web/src/pages/Start.tsx", muster: "learningOpenSteps\\(learningPath\\.data" },
    "Der Start zeigt die offenen Lernschritte über `learningOpenSteps`.",
  ),
  ...[
    [40, "countByMaturity", "Zähler je Reife"],
    [41, "filterByMaturity", "Trefferliste nach Reife filtern"],
    [42, "MATURITY_FILTERS", "Reife-Filterchips"],
    [43, "maturityFilterLabelKey", "Beschriftung der Reife-Filter"],
  ].map(([nr, name, faehigkeit]) =>
    B(
      nr as number,
      "libraryMaturity.ts",
      name as string,
      faehigkeit as string,
      { datei: "apps/web/src/lib/libraryFacets.ts", muster: "libraryMaturity\\(ko\\)\\.usability" },
      "Die Bibliothek filtert die Reife als Facette der Facettenschiene (abgelöste Chips).",
    ),
  ),
  B(
    44,
    "librarySort.ts",
    "isLibrarySortKey",
    "Gespeicherte Sortierung der Bibliothek prüfen",
    {
      datei: "apps/web/src/components/bibliothek/BibliothekFlaeche.tsx",
      muster: "LIBRARY_SORT_STORAGE_KEY,",
    },
    "Die Bibliothek prüft den gespeicherten Wert gegen `LIBRARY_SORT_KEYS` im Speicherhaken.",
  ),
  ...[
    [45, "koHomePath", "Zuhause (Wissensraum) eines Objekts"],
    [46, "serializeSpace", "Wissensraum in der Adresse"],
    [47, "spaceFromParams", "Wissensraum aus der Adresse lesen"],
  ].map(([nr, name, faehigkeit]) =>
    C(
      nr as number,
      "librarySpace.ts",
      name as string,
      faehigkeit as string,
      {
        datei: "apps/web/src/components/trust/KoHomeLine.tsx",
        muster: "offene Ownerentscheidung",
      },
      "Wissensräume: der Server liefert heute kein `home`, und das Wort für den Ort ist eine offene Ownerentscheidung (PLAN PRO 378).",
    ),
  ),
  B(
    48,
    "loadingState.ts",
    "isGroupLoaded",
    "Mehrere Quellen gemeinsam geladen?",
    { datei: "apps/web/src/pages/MyTasks.tsx", muster: "groupLoadPhase\\(quellen\\)" },
    "Die Flächen fragen die Ladephase der Gruppe über `groupLoadPhase`/`gruppenlage`.",
  ),
  ...[
    [49, "confirmsDelete", "Zweiter Tipp löscht"],
    [50, "needsConfirmation", "Erster Tipp verlangt Bestätigung"],
  ].map(([nr, name, faehigkeit]) =>
    B(
      nr as number,
      "mobileConfirm.ts",
      name as string,
      faehigkeit as string,
      { datei: "apps/web/src/pages/Mobile.tsx", muster: "isPending\\(confirm, d\\.id\\)" },
      "Mobil bestätigt über `requestConfirm`/`isPending` — dieselbe Zweischritt-Regel.",
    ),
  ),
  {
    nr: 51,
    datei: "offlineQueue.ts",
    name: "replacePayload",
    faehigkeit: "Wartenden Offline-Vorgang durch die gewählte Fassung ersetzen",
    fall: "A",
    stand: "angeschlossen",
    beleg: {
      datei: "apps/web/src/app/useOfflineQueue.ts",
      muster: "replacePayload\\(q, id, payload, title\\)",
    },
    begruendung: "Seit JOB 4193 angeschlossen (Mobil ersetzt den wartenden Eintrag).",
  },
  B(
    52,
    "oidcCallback.ts",
    "isCompleteCallback",
    "SSO-Rückruf vollständig?",
    {
      datei: "apps/web/src/auth/SsoCallback.tsx",
      muster: "if \\(!cb\\.code \\|\\| !cb\\.state\\)",
    },
    "Der SSO-Rückruf prüft code und state selbst und meldet „unvollständig“.",
  ),
  B(
    53,
    "pdf.ts",
    "extractPdfText",
    "Text aus einer PDF lesen",
    { datei: "apps/web/src/lib/files.ts", muster: "await extractPdfDocument\\(" },
    "Das Einlesen nutzt `extractPdfDocument` (Text samt Lage).",
  ),
  B(
    54,
    "reasonerStatus.ts",
    "reasonerStatusSummary",
    "Zusammenfassung der KI-Konfiguration",
    { datei: "apps/web/src/pages/Stufe2.tsx", muster: "c\\.supportsLocales\\.join" },
    "Die Konfigurationskarte zeigt Modus, Anbieter, Modell, Sprachen und Aufgaben einzeln.",
  ),
  B(
    55,
    "reviewerMinimum.ts",
    "isNeededValidationsValid",
    "Standard-Prüferanzahl gültig (1–5)?",
    {
      datei: "apps/web/src/pages/AdminKiDetails.tsx",
      muster: "const neededValid = Number\\.isInteger\\(neededParsed\\)",
    },
    "Die Karte „Grenzen“ prüft dieselbe Bedingung über `parseNeededValidations`.",
  ),
  {
    nr: 56,
    datei: "startHelp.ts",
    name: "START_HELP_TOPICS",
    faehigkeit: "Hilfethemen des Starts",
    fall: "A",
    stand: "angeschlossen",
    beleg: {
      datei: "apps/web/src/components/start/StartPanel.tsx",
      muster: "START_HELP_TOPICS\\.map",
    },
    begruendung: "Seit JOB 3064 H5 rendert der Start seine ?-Hilfen aus dieser Tabelle.",
  },
  B(
    57,
    "validationStatus.ts",
    "deriveDisplayStatus",
    "Anzeigestatus eines Objekts",
    {
      datei: "apps/web/src/components/ko/KoReadView.tsx",
      muster: 'from "\\.\\./\\.\\./lib/displayStatus"',
    },
    "Die Flächen leiten den Status über `displayStatus.deriveStatus` ab.",
  ),
  W(58, "answerIsLong", "Lange Antwort erkennen (Einfügen/Kopieren)"),
  W(59, "answerSelectionIsWhole", "Ganze Antwort markiert?"),
  W(60, "askAiNoticeVisible", "KI-Hinweis zur Antwort zeigen?"),
  W(61, "askEvidenceDetail", "Belegdetail einer Quelle"),
  W(62, "askLocale", "Sprache der Frage"),
  W(63, "askSnippetWorthShowing", "Ausschnitt zeigen?"),
  W(64, "askSourceRole", "Rolle einer Quelle"),
  W(65, "askSourceStatus", "Status einer Quelle"),
  W(66, "canInsertAnswer", "Antwort einfügbar?"),
  W(67, "classifyDraftResponse", "Antwort beim Entwurfsanlegen einordnen"),
  W(68, "composeAnswerOutput", "Ausgabetext der Antwort bauen"),
  W(69, "draftWasCreated", "Entwurf angelegt?"),
  W(70, "fillWordImages", "Bilder in Word-HTML füllen"),
  W(71, "klaraTrustHead", "Vertrauenskopf der Antwort"),
  W(72, "koDetailUrl", "Adresse eines Wissensobjekts"),
  W(73, "loginPollStep", "Anmeldeabfrage takten"),
  W(74, "openQuestionDraftTitle", "Titel für Entwurf aus offener Frage"),
  W(75, "performAsk", "Frage stellen"),
  W(76, "performCopy", "Antwort kopieren"),
  W(77, "performInsert", "Antwort in Word einfügen"),
  W(78, "prepareAskQuestion", "Frage aus Auswahl/Eingabe vorbereiten"),
  W(79, "prepareWordDraftRequest", "Entwurfsanfrage aus Word bauen"),
  W(80, "WORD_ADDIN_ASK_TIMEOUT_MS", "Zeitgrenze der Frage"),
  W(81, "WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS", "Zeitgrenze der Anmeldeabfrage"),
  W(82, "wordHtmlToPlainText", "Word-HTML in Klartext"),
];

// ================================================================================================
// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 4) · WAS AUS JEDEM B- UND C-FALL GEWORDEN IST.
// ================================================================================================
//
// Die Einstufung oben ist das ERGEBNIS von R-0991 und bleibt unverändert stehen (4 A, 73 B, 5 C).
// R-0991 hat die B- und C-Fälle bewusst NICHT angefasst; sie standen danach im eingefrorenen
// Altbestand des Aufrufer-Wächters. R-1349 verlangt: „Jeder Fall soll entweder angeschlossen oder
// begründet entfernt werden." Für B ist die Begründung der Entfernung genau der hier belegte
// Alternativweg. Diese Tabelle hält je Fall den Ausgang fest; `bedarfsabgleich.test.ts` misst ihn
// (T3 Export da/weg, T4 Nachweis, T6 Gleichlauf mit dem Wächter, T7 Vollständigkeit).
export type R1349Ausgang =
  /** Export entfernt; der Alternativweg aus R-0991 trägt die Fähigkeit. */
  | "entfernt"
  /** Der Produktweg ruft jetzt genau diesen Export (statt einer Abschrift daneben). */
  | "angeschlossen"
  /** Prüfzeug: aus dem Produkt in den Test gezogen. */
  | "in-den-test"
  /** Word-Spiegel: der Wächter misst den Aufruf im Aufgabenfenster selbst (`FREMDLESER`). */
  | "fremdleser"
  /** Offene Produktentscheidung, im Wächter mit Grund und Entscheider geführt. */
  | "offen";

export interface R1349Stand {
  ausgang: R1349Ausgang;
  /** Zusätzlicher Nachweis des Ausgangs (Aufrufstelle, neuer Ort im Test). */
  nachweis?: Beleg;
  /**
   * Der R-0991-Beleg trifft seit R-1349 nicht mehr, weil R-1349 seine Fundstelle selbst geändert
   * oder entfernt hat (abgelöste Datei, ersetzte Abschrift). Dann trägt `nachweis` die Aussage.
   */
  alterBelegEntfaellt?: true;
}

const ENTFERNT: R1349Stand = { ausgang: "entfernt" };

export const R1349_AUSGANG: Readonly<Record<string, R1349Stand>> = {
  "adminForms.ts::isNewUserValid": ENTFERNT,
  "answerMarkdown.ts::stripAnswerMarkdown": {
    ausgang: "in-den-test",
    nachweis: {
      datei: "tests/support/antwort-klartext.ts",
      muster: "export function stripAnswerMarkdown\\(",
    },
  },
  "askGapRescue.ts::gapRescueStepLabelKey": ENTFERNT,
  "askResponse.ts::selectGap": ENTFERNT,
  "attachment.ts::attachmentPreview": ENTFERNT,
  "attachment.ts::isObjectAttachment": ENTFERNT,
  "boardCard.ts::BOARD_REMOVED_LABEL_KEY": ENTFERNT,
  "boardCard.ts::duplicateLead": ENTFERNT,
  "bodyFileLink.ts::applyBodyFileLink": ENTFERNT,
  "captureAttachments.ts::uploadAttachments": ENTFERNT,
  "captureFlowGuide.ts::captureFlowStepLabelKey": ENTFERNT,
  "captureFromFile.ts::createWholeDocumentDraft": ENTFERNT,
  "conflictCollision.ts::conflictDisplayMode": ENTFERNT,
  "conflictImpact.ts::effectiveUsability": {
    ausgang: "angeschlossen",
    nachweis: {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: "effectiveUsability\\(ko, conflicts\\.data",
    },
    alterBelegEntfaellt: true,
  },
  "demoKnowledge.ts::demoKnowledgeBadge": ENTFERNT,
  "demoKnowledge.ts::filterByDemoKnowledge": ENTFERNT,
  "draftForm.ts::isPromotable": ENTFERNT,
  "draftListView.ts::isDraftSortKey": ENTFERNT,
  "editorAttachmentContext.ts::ATTACH_FILE_HINT_KEY": ENTFERNT,
  "editorAttachmentContext.ts::ATTACH_FILES_KEY": ENTFERNT,
  "editorAttachmentContext.ts::ATTACH_IMAGE_HINT_KEY": ENTFERNT,
  "editorAttachmentContext.ts::ATTACH_IMAGES_KEY": ENTFERNT,
  "editorAttachmentContext.ts::ATTACH_TITLE_KEY": ENTFERNT,
  "examplePackages.ts::EXAMPLE_PACKAGES_ALL_KEYS": {
    ausgang: "in-den-test",
    nachweis: { datei: "tests/app/example-packages.test.ts", muster: "const alleSchluessel = \\[" },
  },
  "externalSearch.ts::isAttachable": ENTFERNT,
  "fileMultiPoint.ts::mergedDraftFromPoints": ENTFERNT,
  "funke.ts::openGapsView": ENTFERNT,
  "importSelectView.ts::folderTreeSegmentKey": {
    ausgang: "angeschlossen",
    nachweis: {
      datei: "apps/web/src/lib/importSelectView.ts",
      muster: "folder:\\$\\{folderTreeSegmentKey\\(root\\.segment\\)\\}",
    },
  },
  "intakeSimilarity.ts::classifyIntake": ENTFERNT,
  "interviewFlow.ts::answeredTurns": ENTFERNT,
  // Der Rettungseinstieg (`KnowledgeRescueIntro`) ist als Ganzes entfernt — seit JOB 3062 von der
  // Fläche genommen; seine Datei war der R-0991-Beleg.
  "knowledgeRescue.ts::rescueStepLabelKey": { ausgang: "entfernt", alterBelegEntfaellt: true },
  "knowledgeStory.ts::KNOWLEDGE_STORY_SURFACES": {
    ausgang: "in-den-test",
    nachweis: {
      datei: "tests/app/knowledge-story.test.ts",
      muster: "const KNOWLEDGE_STORY_SURFACES: readonly StorySurface\\[\\]",
    },
  },
  "knowledgeStudioGuide.ts::studioGuideActiveStep": ENTFERNT,
  "knowledgeStudioLayout.ts::knowledgeStudioSections": ENTFERNT,
  "koEvidence.ts::evidenceKindLabel": ENTFERNT,
  "koLabel.ts::hatTitel": ENTFERNT,
  "learningPath.ts::nextOpenStep": ENTFERNT,
  "libraryMaturity.ts::countByMaturity": ENTFERNT,
  "libraryMaturity.ts::filterByMaturity": ENTFERNT,
  "libraryMaturity.ts::MATURITY_FILTERS": ENTFERNT,
  "libraryMaturity.ts::maturityFilterLabelKey": ENTFERNT,
  "librarySort.ts::isLibrarySortKey": ENTFERNT,
  "librarySpace.ts::koHomePath": { ausgang: "offen" },
  "librarySpace.ts::serializeSpace": { ausgang: "offen" },
  "librarySpace.ts::spaceFromParams": { ausgang: "offen" },
  "loadingState.ts::isGroupLoaded": ENTFERNT,
  "mobileConfirm.ts::confirmsDelete": ENTFERNT,
  "mobileConfirm.ts::needsConfirmation": ENTFERNT,
  "oidcCallback.ts::isCompleteCallback": ENTFERNT,
  "pdf.ts::extractPdfText": ENTFERNT,
  "reasonerStatus.ts::reasonerStatusSummary": ENTFERNT,
  "reviewerMinimum.ts::isNeededValidationsValid": {
    ausgang: "angeschlossen",
    nachweis: {
      datei: "apps/web/src/pages/AdminKiDetails.tsx",
      muster: "const neededValid = isNeededValidationsValid\\(neededEffective\\)",
    },
    alterBelegEntfaellt: true,
  },
  // Der R-0991-Beleg war die Zonen-Leseansicht `KoReadView.tsx`, die R-1349 entfernt hat (seit
  // JOB 3063 ohne Produktaufrufer). Dieselbe Ableitung liest heute die Lesefläche der Bibliothek.
  "validationStatus.ts::deriveDisplayStatus": {
    ausgang: "entfernt",
    nachweis: {
      datei: "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
      muster: 'from "\\.\\./\\.\\./lib/displayStatus"',
    },
    alterBelegEntfaellt: true,
  },
  ...Object.fromEntries(
    BEDARFSABGLEICH.filter((b) => b.beleg === "word-spiegel").map((b) => [
      `${b.datei}::${b.name}`,
      { ausgang: "fremdleser" } satisfies R1349Stand,
    ]),
  ),
};
