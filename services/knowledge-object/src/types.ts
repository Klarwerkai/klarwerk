import type { DokumentHerkunft } from "./dokumentakte";
import type { KoGeltung } from "./geltung";

// FR-KO-02: fünf Wissensarten (Pflichtenheft §3.5).
export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export const KNOWLEDGE_TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

export type KoStatus = "offen" | "validiert";

// SCRUM-415: Vertraulichkeitsstufe je Wissensobjekt. „intern" = Öffentlich-intern (Standard, keine
// Einschränkung); „vertraulich"/„streng_vertraulich" = vertraulich → gehen NIE in externe Kontexte
// (Output Factory/Export). Fehlt das Feld (Alt-KOs), gilt „intern".
// WP-SUBMIT-ASYNC: Zustand des Hintergrund-Prüf-Jobs. pending = eingereiht/laufend; done = die
// Erkennung lief (Ergebnis-Signale liegen in conflicts/overlaps); failed = EHRLICH gescheitert
// (fallbackReason: no-model/model-error) — nie stiller Verlust, nie erfundenes Ergebnis.
export type AiCheckStatus = "pending" | "done" | "failed";

// AUFTRAG-mega28 A2 (Pedi 26.07.) — WIE WEIT DER PRÜF-LAUF TATSÄCHLICH REICHTE.
// Seit mega28 deckeln beide Erkennungswege ihre Kandidatenmenge (App-Root: DETECTION_CANDIDATE_CAP).
// Ein gedeckelter Lauf darf nicht aussehen wie ein vollständiger: „done" heißt sonst still „gegen 20
// von 12.479 geprüft" und ein leeres Ergebnis läse sich als „konfliktfrei". Diese Zahlen reisen
// deshalb MIT dem Job-Status bis in die Anzeige.
// STRUKTURGLEICH zu conflicts/src/coverage.ts DetectionCoverage — bewusst EIGENSTÄNDIG deklariert:
// knowledge-object kennt conflicts nicht (Modulgrenze). Der App-Root bildet ab.
// AUFTRAG-mega29 B1: aus EINER Zahl (`examined`) sind sieben getrennte Begriffe geworden — eine
// Zahl, die vier Fragen zugleich beantworten musste, log bei jeder (bens M28-2). Bedeutung je Feld
// s. conflicts/src/coverage.ts; diese Deklaration bleibt bewusst eigenständig (Modulgrenze).
export interface AiCheckCoverage {
  available: number;
  selected: number;
  alreadyOpen: number;
  attempted: number;
  completed: number;
  skipped: number;
  capped: boolean;
  aborted: boolean;
}

// AUFTRAG-mega29 C2 (bens M28-3): die schmalste Aussage, die ein LEERES Konflikt-/Duplikat-Board
// braucht, um nicht als „geprüft und frei" gelesen zu werden. Drei Zähler über den Bestand — keine
// Objektdaten, keine IDs. `unchecked` (gar kein Protokoll) ist bewusst von `incomplete` getrennt:
// „über dieses Objekt sagt kein Lauf etwas" ist eine andere Aussage als „der Lauf war unvollständig".
//
// AUFTRAG-mega31 BLOCK A (bens ROT-2, Pedis Umkehr vom 26.07.) — DIE BEWEISLAST WECHSELT DIE SEITE.
// Bis mega29 galt ein Objekt als vollständig geprüft, SOLANGE KEIN MERKER DAS GEGENTEIL SAGTE. Ein
// fehlender Merker erzeugte damit eine Entwarnung — und genau ein fehlender Merker war ROT-1. Jetzt
// gilt: vollständig ist nur, was BELEGT vollständig ist. Jeder unbelegte Zustand ist unvollständig.
//
// VIER SICH AUSSCHLIESSENDE ZÄHLER, in dieser Rangfolge ausgewertet (s. aiCheckCoverageSummary):
//   unchecked   — gar kein Vermerk: über dieses Objekt sagt kein Lauf etwas.
//   incomplete  — ein Lauf, der nicht als vollständig belegt ist (failed/pending ODER ein
//                 Protokoll mit capped/aborted/skipped).
//   noCoverage  — ein abgeschlossen gemeldeter Lauf OHNE Abdeckungsprotokoll (Altbestand von vor
//                 mega28). A4: das ist NICHT „gar kein Lauf" — ein Lauf ist nachweisbar, nur seine
//                 REICHWEITE nicht. Die beiden Aussagen dürfen nicht in einen Zähler fallen.
// Was in keinen der drei fällt, ist belegt vollständig — und nur DAS darf schweigen.
export interface AiCheckCoverageSummary {
  total: number;
  incomplete: number;
  unchecked: number;
  noCoverage: number;
}

export interface AiCheck {
  status: AiCheckStatus;
  requestedAt: string;
  finishedAt?: string;
  fallbackReason?: string;
  // mega28 A2/A3: additiv — Altbestand ohne Feld sagt schlicht nichts über die Abdeckung (und die
  // Anzeige behauptet dann auch nichts).
  coverage?: AiCheckCoverage;
  // WP-SHIP8-FINAL (bens Bedingung 2): der Prüf-Job ist an die INHALTSVERSION gebunden — der
  // pending-Vermerk trägt die KO-Version zum Einreih-Zeitpunkt; der Abschluss schreibt nur, wenn
  // sie noch stimmt (bedingter Write). Additiv: Altbestand ohne Feld = versionsungebundener Job.
  koVersion?: number;
  // AUFNAHME 20260922 · Prüfbasis-Aktualität: die Basis, unter der der Lauf gestartet ist (pending:
  // beim Vermerk; done/failed: beim Laufstart). Regel und Begründung in pruefbasis.ts. Additiv.
  basis?: AiCheckBasis;
  // NUR LESEFASSUNG, nie gespeichert: bei jedem Lesen aus `basis` gegen das jetzige Objekt
  // abgeleitet (mitPruefstand). true = der abgeschlossene Nachweis gilt für eine frühere Basis.
  ueberholt?: boolean;
  // PRÜFSTATUS-ANZEIGE (R-0208) · NUR LESEFASSUNG DES PRÜFBRETTS, nie gespeichert. `laeuft`
  // (nur bei pending): der Worker bearbeitet den Job gerade — sonst ist er bloß ausstehend.
  // `konfliktGefunden` (nur bei done): zu DIESEM Objekt als Subjekt steht ein offener, automatisch
  // erkannter Konflikt, dessen Gegenseite der Leser sehen darf. Fehlt das Feld, ist es nicht
  // erhoben — es heißt dann weder „kein Konflikt" noch „läuft nicht".
  laeuft?: boolean;
  konfliktGefunden?: boolean;
}

// Fingerabdrücke der Prüfbasis (s. pruefbasis.ts): quelle = Fassung + Quellen + Anhänge;
// kontext = Einordnung + Vertraulichkeit; bestand = Vergleichsquellen samt Auswahlkontext.
export interface AiCheckBasis {
  quelle: string;
  kontext: string;
  bestand: string;
}

export type Confidentiality = "intern" | "vertraulich" | "streng_vertraulich";

// ================================================================================================
// JOB 557 (Pedi 13.08.2026) — DAS KANONISCHE EIGENTÜMER-AGGREGAT.
// ================================================================================================
//
// `author` ist PROVENIENZ (wer den Text erzeugt hat), nicht Verantwortung. Wem das Objekt gehört,
// wer es geprüft und wer es validiert hat, stand bis JOB 557 nirgends — und deshalb ging die
// Nacharbeit einer `warn`/`down`-Bewertung an den Erzeuger. Die Regeln, die Rückfallentscheidung
// und ihre Grenzen stehen in `ownership.ts`; hier steht nur die Form.
//
// `owner` IST OPTIONAL, die beiden Folgen sind es NICHT. Ein Aggregat kann sagen „geprüft haben A
// und B, wem es gehört ist offen" — das ist eine ehrliche Aussage. Umgekehrt wäre eine FEHLENDE
// Liste ununterscheidbar von einer leeren; nach der Normalform ist sie deshalb immer da, notfalls
// leer. Ein Aggregat, in dem alle drei nichts sagen, wird gar nicht abgelegt (s. normalizeOwnership).
export interface KnowledgeOwnership {
  /** Wer die Verantwortung trägt. Fehlt er, gibt es keinen — kein stiller Rückfall auf `author`. */
  owner?: string;
  /** Wer tatsächlich zur Prüfung zugewiesen wurde (dedupliziert, in Zuweisungsreihenfolge). */
  reviewers: string[];
  /** Wer die abgeschlossene Validierung getragen hat (dedupliziert, in Entscheidungsreihenfolge). */
  validators: string[];
}

export interface HistoryEntry {
  version: number;
  at: string;
  author: string;
  note: string;
  // ============================================================================================
  // JOB 4213 (WIKI-NACHVOLLZIEHEN) — AUS WELCHER FRÜHEREN FASSUNG DIESER STAND ZURÜCKGEHOLT WURDE.
  // ============================================================================================
  //
  // OPTIONAL, UND „FEHLT" HEISST GENAU EINES: dieser Eintrag entstand nicht aus einer Übernahme.
  // Jede Fassung, die dieses System bis heute geschrieben hat, trägt das Feld nicht — ein
  // Pflichtfeld wäre also eine Aussage über Altbestand, die niemand gemessen hat.
  //
  // WARUM EINE ZAHL UND NICHT NUR DER VERMERK: der Vermerk (`note`) sagt WAS geschah und wird für
  // die Anzeige übersetzt (`apps/web/src/lib/koHistoryNote.ts` — ein fester Dienst-Vermerk über den
  // Katalog). Die Version, aus der der Stand stammt, ist eine ZAHL und keine Beschriftung; sie in
  // den Vermerktext zu schreiben machte ihn unübersetzbar, weil er dann für jede Version anders
  // lautete. Beides zusammen liest sich als „aus früherer Fassung übernommen · v2".
  restoredFrom?: number;
}

// ================================================================================================
// JOB 4146 (WIKI-DISKUSSION) — DER KLÄRUNGSSTAND EINES FADENS. GEKLÄRT, NICHT FREIGEGEBEN.
// ================================================================================================
//
// DIE GRENZE IST DER GANZE ZWECK DIESES TYPS: er sagt, ob die SACHE besprochen ist — nicht, ob der
// Inhalt des Wissensobjekts gelten darf. Die fachliche Freigabe hat ihren eigenen Weg (`status`,
// `KoProposal`, `reviseUndFreigeben`) und ihre eigenen Rechte; ein erledigter Faden bewegt davon
// nichts (`KoService.setCommentResolution`, gemessen in `tests/wiki-diskussion/klaerungsstand.test.ts`).
// Deshalb heissen die Zustände „erledigt"/„offen" und nicht „geprüft"/„freigegeben" — und deshalb
// prüft `tests/wiki-diskussion/sprachen.test.ts` auch den Wortlaut der Oberfläche.
//
// `by`/`at` SIND PFLICHT, sobald es den Stand gibt: „erledigt" ohne Urheber und Zeitpunkt wäre eine
// Tatsachenbehauptung ohne Auskunft — dieselbe Begründung, aus der `KoProposal.decidedBy/decidedAt`
// existieren. Ein WIEDER GEÖFFNETER Faden trägt `state: "offen"` MIT `by`/`at`; das unterscheidet
// ihn von einem Faden, über den noch nie jemand entschieden hat (dort fehlt `resolution` ganz).
export interface KoCommentResolution {
  state: "erledigt" | "offen";
  by: string;
  at: string;
}

// FR-KO-06: Diskussion/Kommentare am Objekt (Peer-Austausch, Revisions-Schleife).
//
// JOB 4146: VIER OPTIONALE FELDER, KEINE MIGRATION. Ein Bestandsbeitrag ohne sie bleibt gültig, wird
// unverändert gespeichert und unverändert angezeigt (Vertrag Abnahmefall 1). Das ist keine Höflichkeit
// gegenüber Altdaten, sondern die Bedingung dafür, dass die ZWEITVERWENDUNG dieser Liste weiterträgt:
// sie führt heute auch das Prüf-Feedback (`apps/web/src/lib/validationFeedback.ts`) und die
// Quellenmeldung (`apps/web/src/lib/sourceContribution.ts`), und beide erkennen sich an einem PRÄFIX
// IM TEXT. Ein neues Pflichtfeld hätte sie leise unlesbar gemacht
// (`tests/wiki-diskussion/zweitverwendung-bleibt.test.ts`).
export interface KoComment {
  id: string;
  author: string;
  text: string;
  at: string;
  /**
   * JOB 4146 — die Kennung des Beitrags, auf den geantwortet wird. Sie zeigt IMMER auf einen Beitrag
   * DESSELBEN Wissensobjekts; der Dienst schlägt sie in der eigenen Liste nach und schreibt sie nur,
   * wenn sie dort liegt (dieselbe Grenze wie `KoSource.objectId` gegen die eigene Anhangsliste).
   * Fehlt das Feld, ist der Beitrag der Anfang eines Fadens.
   */
  replyTo?: string;
  /**
   * JOB 4146 — die INHALTSVERSION, die der Verfasser vor sich hatte. Sie setzt der SERVER aus dem
   * gelesenen Objekt, nicht der Aufrufer: eine mitgeschickte Zahl wäre eine Herkunftsbehauptung ohne
   * Beleg (mega15 Block B).
   *
   * FEHLT SIE, IST SIE UNBEKANNT — und bleibt es. Vertrag Abnahmefall 1: die aktuelle Version darf
   * einem versionslosen Bestandskommentar nicht nachträglich als Basis untergeschoben werden, weder
   * beim Lesen noch beim Schreiben.
   */
  koVersion?: number;
  /** JOB 4146 — der Klärungsstand des FADENS. Er steht am Wurzelbeitrag, nie an einer Antwort. */
  resolution?: KoCommentResolution;
  /**
   * JOB 4146 — DER BEITRAGSSCHLÜSSEL DES AUFRUFERS (Vertrag Fall 5, HINWEIS Runde 1).
   *
   * Reiner Deduplizierungs-Schlüssel OHNE Autorität, Bauform wie `KoAppendOp.id`: er entscheidet
   * nichts, er verhindert nur, dass eine WIEDERHOLUNG nach unklarer Übertragung denselben Beitrag ein
   * zweites Mal anfügt. Der Umfang ist bewusst eng — je Wissensobjekt UND Verfasser: zwei Menschen
   * dürfen denselben Schlüssel bilden, ohne dass einer von beiden verschluckt wird.
   */
  clientKey?: string;
  /**
   * P-WIKI-STELLENBEZUG — WORAN IM TEXT diese Rückfrage hängt (Absatz, Tabelle oder Bild).
   *
   * Nur am Anfang eines Fadens; eine Antwort gehört zur Stelle ihres Fadens. Fehlt das Feld, gilt
   * der Beitrag dem ganzen Dokument — wie jeder Beitrag vor dieser Regel. Form und Prüfung stehen
   * in `stellen-anker.ts`.
   */
  stelle?: KoCommentStelle;
}

// ================================================================================================
// P-WIKI-STELLENBEZUG — DER ANKER EINER RÜCKFRAGE: FASSUNG, ABSCHNITT, TEXTSTELLE.
// ================================================================================================
//
// DREI ANGABEN, UND JEDE IST GESPEICHERT, NICHT ABGELEITET. `koVersion` ist die Fassung, in der die
// Stelle gewählt wurde — der Dienst nimmt den Beitrag nur an, wenn sie die gerade gespeicherte ist
// (sonst `KO_STALE`). `abschnitt` ist die Kennung des Abschnitts (Text der vorangehenden
// Überschrift, bei Gleichnamigen mit Zähler; leer = vor der ersten Überschrift). `text` ist die
// Textstelle selbst — bei Absatz und Tabelle der normalisierte Text (höchstens
// `STELLE_TEXT_MAX` Zeichen), beim Bild seine `data-image-id`.
//
// WEIL DER TEXT MITGESPEICHERT IST, BLEIBT DIE ALTE STELLE LESBAR, auch wenn die neue Fassung sie
// nicht mehr enthält. Die Zuordnung zur NEUEN Fassung rechnet die Fläche
// (`apps/web/src/lib/stellenbezug.ts`) — und zwar nur über GLEICHHEIT, nie über Ähnlichkeit.
//
// `text` IST GEKÜRZT UND DESHALB NUR ANZEIGE (BEN, Nacharbeit 3). Die Identität trägt
// `fingerabdruck`: SHA-256 über Art, VOLLSTÄNDIGEN Abschnitt und VOLLSTÄNDIGEN normalisierten
// Inhalt (`stellen-fingerabdruck.ts`). Zwei Absätze mit demselben Anfang sind damit zwei Stellen.
//
// PLAN-SPRACHANMERKUNG, NACHARBEIT 2 (BEN) — DIE VIERTE ART `anhang`: eine HOCHGELADENE Zeichnung
// (PDF, CAD-Datei, Bild) am Wissensobjekt, nicht ein Bild im Text. `text` ist die `objectId` des
// Anhangs (seine Identität, wie beim Bild die `data-image-id`), `abschnitt` bleibt leer, `seite` nennt
// bei mehrseitigen Dokumenten (PDF) die Seite. Geprüft wird gegen die Anhangsliste der Fassung
// (`stelleAmAnhang`), nicht gegen den Text.
export interface KoCommentStelle {
  koVersion: number;
  art: "absatz" | "tabelle" | "bild" | "anhang";
  abschnitt: string;
  text: string;
  fingerabdruck: string;
  /** PLAN-SPRACHANMERKUNG — die Seite eines mehrseitigen Anhangs (ab 1). Nur bei `art: "anhang"`. */
  seite?: number;
  /**
   * PLAN-SPRACHANMERKUNG (R-1625, R-2177) — WO IN DER ZEICHNUNG die Notiz hängt. Nur bei `art: "bild"`
   * und `art: "anhang"`.
   *
   * Fehlt das Feld, gilt die Rückfrage dem ganzen Bild — wie jede Bildrückfrage vor dieser Regel.
   * Die Position ist RELATIV zum Bild (0 = links/oben, 1 = rechts/unten) und damit unabhängig von der
   * Anzeigegrösse. Sie gehört NICHT zur Identität der Stelle (`fingerabdruck`): das Bild wird über
   * seinen Anker wiedergefunden, die Position reist unverändert mit.
   */
  punkt?: KoStellenPunkt;
}

/** PLAN-SPRACHANMERKUNG — eine Position im Bild, relativ zu Breite (`x`) und Höhe (`y`), je 0..1. */
export interface KoStellenPunkt {
  x: number;
  y: number;
}

// ================================================================================================
// JOB 3667 (WORD-RÜCKWEG, Runde 2) — DER GEBUNDENE ÄNDERUNGSVORSCHLAG.
// ================================================================================================
//
// EIN VORSCHLAG IST KEIN WISSEN. Er hängt an genau einem Wissensobjekt, er ersetzt nichts, und er
// wird nie ausgegeben, als sei er der Stand des Objekts. Erst eine ENTSCHEIDUNG durch einen
// freigabeberechtigten Menschen — der NICHT der Einreicher ist — macht seinen Inhalt zur neuen,
// freigegebenen Fassung (`KoService.decideProposal`).
//
// JEDES FELD HAT EINEN GRUND:
//   · `baseVersion` — die Inhaltsversion, die der Einreicher gesehen hat. Ohne sie liesse sich
//     später nicht sagen, WORAUF sich der Vorschlag bezog; mit ihr sagt die Fläche „stammt aus
//     Version 3, der Eintrag steht auf 5", statt es zu verschweigen.
//   · `status` — DER entschiedene Zustand, der in Runde 1 gefehlt hat (Kommentare kennen keinen).
//     Ein entschiedener Vorschlag ist nicht mehr offen und kann nicht zweimal wirken.
//   · `decidedBy`/`decidedAt`/`resultVersion`/`note` — wer wann wie entschieden hat, und welche
//     Fassung daraus entstand. `note` trägt die Begründung einer Ablehnung; ohne sie wäre
//     „abgelehnt" eine Tatsache ohne Auskunft.
//   · `origin` — woher der Vorschlag kam (`word_addin` für diesen Weg). Dieselbe feste Herkunft,
//     die `POST /api/drafts` seit JOB 660 trägt: wer ihn in KLARWERK öffnet, sieht, wo er entstand.
export interface KoProposal {
  id: string;
  author: string;
  at: string;
  /** Die Inhaltsversion des Objekts, auf der dieser Vorschlag beruht. */
  baseVersion: number;
  statement: string;
  /**
   * Der gesäuberte Rumpf, sofern der Einreicher einen mitgeschickt hat.
   *
   * JOB 3667 R5 — AUSGELASSEN IST NICHT GELÖSCHT: fehlt das Feld (oder steht es auf `null`), hat
   * der Vorschlag KEINEN Fließtext mitgebracht. Die Übernahme lässt dann den bestehenden Fließtext
   * der Grundfassung stehen. Geleert wird nur auf das ausdrückliche Signal `clearBody` (s. u.) —
   * ein Vorschlag aus Word trägt nur Text, und er darf kein Dokument mit ausradieren.
   */
  bodyHtml?: string | null;
  /**
   * JOB 3667 R5 — DIE AUSDRÜCKLICH BEABSICHTIGTE LÖSCHUNG DES FLIESSTEXTES.
   *
   * Ein eigenes, eindeutiges Signal, kein `null` als Nebenwirkung: nur wenn der Einreicher den
   * Fließtext WIRKLICH entfernen wollte (er hat ihn im Formular geleert), steht hier `true`, und
   * nur dann leert die Übernahme das Feld. Ohne dieses Feld ist ein fehlender Rumpf schlicht ein
   * nicht eingereichter Rumpf.
   */
  clearBody?: boolean;
  status: "offen" | "uebernommen" | "abgelehnt";
  origin?: string;
  decidedBy?: string;
  decidedAt?: string;
  /** Die Version, die aus der Übernahme entstanden ist (nur bei „uebernommen"). */
  resultVersion?: number;
  /** Begründung der Entscheidung — bei einer Ablehnung die Auskunft, warum. */
  note?: string;
}

// FR-CAP-05: Anhang/Foto am Objekt. Pilot: client-seitig verkleinertes Thumbnail
// als Daten-URL (keine Objektspeicher-Infrastruktur nötig, größenbegrenzt).
// SCRUM-121: Anhang rückwärtskompatibel. Alt-Anhänge tragen `dataUrl` (Inline-Original);
// neue Anhänge tragen `objectId` (Referenz auf den Object-Store) + kleine `thumbnail`-Vorschau.
export interface KoAttachment {
  id: string;
  name: string;
  mime: string;
  dataUrl?: string; // Alt-Anhänge (Inline)
  objectId?: string; // neue Anhänge: Referenz ins object-store
  thumbnail?: string; // kleine Vorschau (Daten-URL)
  size?: number; // Originalgröße im Object-Store
  author: string;
  at: string;
  // R-0163: Herkunft eines aus einer Quelle übernommenen Anhangs. Additiv, JSON-persistiert →
  // keine Migration; Anhänge ohne das Feld (von Hand hochgeladen, Altbestand) bleiben gültig.
  quelle?: KoAnhangsquelle;
}

/**
 * R-0163: die Quellidentität eines übernommenen Anhangs. `externalId` ist die Kennung des
 * Anhangs IN der Quelle (Confluence: attachment id) — an ihr wird beim nächsten Abgleich
 * zugeordnet, nicht am Dateinamen. `abruf` ist der zuletzt gesehene Abrufweg; ändert die Quelle
 * ihn, wird er hier nachgezogen.
 */
export interface KoAnhangsquelle {
  provider: string;
  externalId: string;
  abruf: string;
  sourceVersion?: number;
}

// Obergrenzen für den Pilot (kleine Thumbnails, JSONB bleibt handhabbar).
// WP-D2: konsistent zur Werksvorgabe DEFAULT_UPLOAD_LIMITS (upload-limits.ts) — dokumententauglich.
export const MAX_ATTACHMENT_BYTES = 20_000_000; // ~20 MB Daten-URL
export const MAX_ATTACHMENTS = 8;

// SCRUM-129 / FR-KO-07: echte Quelle am Objekt. Externe Quellen sind NIE peer-validiert
// (klare Stufe-2-Markierung); kein automatisches Peer-Validation-Verfahren.
export type KoSourceKind = "external";

/**
 * package:confluence (K6) — die LESE-EINSCHRÄNKUNG, wie die QUELLE sie führt, am Herkunftsanker.
 *
 * WAS ES IST: die Kennungen der Quelle selbst — Benutzerkennungen (Confluence: `accountId`, auf
 * älteren Instanzen `userKey`/`username`) und Gruppennamen —, unverändert übernommen, damit
 * nachvollziehbar bleibt, WEM die Quelle diese Seite zugänglich gemacht hat.
 *
 * WAS ES AUSDRÜCKLICH NICHT IST: eine Rechte- oder Rollenabbildung in KLARWERK. Kein Zugriffspfad
 * wertet dieses Feld aus; die wirksame Einstufung bleibt `confidentiality`. Wie (und ob) diese
 * Kennungen auf KLARWERK-Konten oder -Rollen abgebildet werden, gehört dem gesonderten
 * Rechteauftrag (Entscheidung a7834397) und wird hier nicht vorweggenommen.
 *
 * ERZEUGER: ausschließlich ein Quell-Adapter (`services/confluence/src/mapper.ts`). Aus einem
 * Client-Rumpf wird das Feld verworfen (`ohneQuellRestriktionen`, library-analytics) — es ist eine
 * Herkunftsangabe der Quelle, keine Behauptung eines Einreichers. Fehlt das Feld, hat die Quelle
 * keine konkrete Einschränkung geliefert.
 */
export interface KoSourceRestrictions {
  /** Benutzerkennungen der Quelle, in Quell-Reihenfolge, ohne Doppelte. */
  users: string[];
  /** Gruppennamen der Quelle, in Quell-Reihenfolge, ohne Doppelte. */
  groups: string[];
}

export interface KoSource {
  id: string;
  label: string;
  url: string | null;
  excerpt: string | null;
  kind: KoSourceKind;
  peerValidated: boolean;
  // SCRUM-118: optionaler Anbieter externer Quellen (z. B. "Wikipedia"). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne provider bleiben gültig.
  provider?: string | null;
  // SCRUM-470 (Confluence-Import): strukturierte Herkunfts-Anker für Rückverfolgbarkeit UND
  // idempotenten Re-Sync. externalId = Confluence pageId (Idempotenz-Schlüssel). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne diese Felder bleiben gültig.
  externalId?: string;
  spaceKey?: string;
  // aufnahme:20260922:confluence-import-hierarchie (R-0153): die ELTERNKETTE der Quellseite
  // innerhalb von `spaceKey` — Elterntitel, Wurzel zuerst, ohne die Seite selbst (dieselbe Form wie
  // `ImportItem.sourcePath`). Nur der Import-Accept setzt es; fehlt die Kette in der Quelle, fehlt
  // das Feld (kein leeres Array, kein erfundener Elternteil). Additiv, JSON-persistiert → keine
  // Migration; Altquellen ohne das Feld bleiben gültig.
  sourcePath?: string[];
  sourceVersion?: number;
  // package:confluence (K6): die Lese-Einschränkung der Quelle zu GENAU dieser Quellfassung
  // (`sourceVersion`). Additiv, JSON-persistiert → keine Migration. Begründung am Typ oben.
  sourceRestrictions?: KoSourceRestrictions;
  // JOB 4077: DER ANKER DIESER BELEGSTELLE — die `objectId` eines Anhangs, den DIESES Wissensobjekt
  // trägt. Additiv, JSON-persistiert → keine Migration; Altquellen ohne das Feld bleiben gültig.
  //
  // WAS ES IST: eine vom Server GEGEN DIE EIGENE ANHANGSLISTE bestätigte Kennung. `addSource`
  // schlägt sie in `ko.attachments` nach und schreibt sie nur, wenn sie dort liegt
  // (`service.ts`, `confirmedSourceAnchor`); im Übernahmeweg entsteht der Anhang in DERSELBEN
  // Operation (`appendDocumentExtract`).
  //
  // WAS ES NICHT IST: eine Herkunftsbehauptung des Clients — dieselbe Grenze wie bei `provider`
  // (mega15 Block B). Ein nicht bestätigter Wert wird verworfen, nicht gespeichert.
  //
  // WARUM DER ANKER UND NICHT DER DATEINAME: der Name wird beim ANZEIGEN aus dem Anhang aufgelöst
  // (`apps/web/src/lib/koSource.ts`, `quellennachweis`). Ein an die Quelle kopierter Name würde
  // durch eine Umbenennung des Anhangs zur Lüge, ohne dass irgendjemand es merkt.
  objectId?: string;
  // ============================================================================================
  // R-0549 / R-0163 / R-0162 (Confluence-Gesamtimport) — WAS DIE QUELLE ÜBER SICH SELBST SAGT.
  // ============================================================================================
  //
  // Drei additive, JSON-persistierte Angaben (keine Migration, Altquellen bleiben gültig). Sie
  // sind HERKUNFTSANGABEN, keine Rechte und keine Anweisungen: nichts in Klara verzweigt die
  // Autorisierung über sie (s. `services/app/src/sichtbarkeit.ts`, Variante B ist nicht
  // entschieden).
  //
  // `readRestriction`: die Leserestriktion der Quellseite beim Import — Gruppennamen und
  // Benutzerkennungen, wie die Quelle sie liefert. Fehlt das Feld, war die Seite offen oder der
  // Anker stammt von vor dieser Regel.
  readRestriction?: { groups: string[]; users: string[] };
  // `attachmentOf` + `attachment`: diese Quelle ist ein ANHANG der Quellseite mit der genannten
  // `externalId` (derselbe Provider). Ein Anhang trägt bewusst KEINE eigene `externalId` — sonst
  // hielte ihn der Re-Sync-Anker für eine eigene Seite.
  attachmentOf?: string;
  attachment?: { externalId: string; mime?: string; size?: number };
  // `sourceRemovedAt`: ein Abgleich hat festgestellt, dass die Quellseite gelöscht ist (ISO-Zeit).
  // Das Wissensobjekt bleibt unverändert; der Rücklink führt nicht mehr zur Seite, und die
  // Anzeige sagt das, statt ihn weiter anzubieten.
  sourceRemovedAt?: string;
  // R-0142 (Confluence-Import, Lauf 5 R3): der Importlauf der ANNAHME, die diesen Anker zuletzt
  // geschrieben hat (Erstanlage oder Fortschreibung). Eine Kennung, kein Inhalt; die Laufdomäne
  // (`library-analytics`, `ImportRunItemRef`) trägt den Ausgang. Fehlt bei Ankern von vor dieser
  // Regel und bei Annahmen ohne Lauf.
  importRunId?: string;
  // R-0169 (herkunft-identitaet): DIE FESTGESCHRIEBENE QUELLFASSUNG dieses Ankers — die interne
  // `sourceRecordId` der unveränderlichen Quellrevision (`ExternalSourceRecord`,
  // services/library-analytics), die der Import für genau `externalId` + `sourceVersion` angelegt
  // hat. Weil der Anker im Versionsschnappschuss des Objekts mitreist, sagt jede Objektfassung,
  // aus welcher Quellfassung ihre Aussage stammt. Nur die Importwege setzen das Feld; die
  // öffentlichen Schreibrouten verwerfen `sources` ohnehin. Additiv, JSON-persistiert, kein Backfill:
  // Altanker ohne Feld sind vor dieser Regel entstanden.
  sourceRecordId?: string;
  author: string;
  at: string;
}

// AUFTRAG-mega18 Block A-1: Vermerk eines ABGESCHLOSSENEN Übernahme-Vorgangs (Verbund-Operation
// „Dokumentinhalt übernehmen"). Er trägt das Commit-Ergebnis, nicht nur die Kennung: eine
// Wiederholung desselben Vorgangs kann damit EXAKT dieselbe Antwort liefern, ohne ein zweites Mal
// zu schreiben. Die Begründung (warum der Aufrufer die Kennung bildet, warum sie am Objekt liegt,
// warum sie gedeckelt ist) steht in document-append.ts.
export interface KoAppendOp {
  /** Die Operations-Kennung des Aufrufers — reiner Deduplizierungs-Schlüssel, ohne Autorität. */
  id: string;
  at: string;
  /** Die Inhaltsversion, die dieser Vorgang hinterlassen hat. */
  koVersion: number;
  /** Der Anhang, der als Anker entstand (das Originaldokument am Objekt). */
  attachmentId: string;
  /** Die Belegstellen, die dieser Vorgang angelegt hat. */
  sourceIds: string[];
}

/** R-0658: welche Art Schutzdaten erkannt wurde — nie der Wert selbst. */
export type SchutzdatenArt = "personalnummer" | "kontodaten";

/** R-0658: die Quarantänemarke am Wissensobjekt (Begründung in `schutzdaten.ts`). */
export interface SchutzdatenQuarantaene {
  arten: SchutzdatenArt[];
  /** Zeitpunkt des ERSTEN Befunds; eine weitere Fassung mit Schutzdaten setzt ihn nicht neu. */
  seit: string;
}

// FR-KO-01: Datenmodell inkl. version/history/originalAuthor/needed/assignments/asset
// (Pflichtenheft §3.5, Technischer Anhang §1).
export interface KnowledgeObject {
  id: string;
  title: string; // Titel als Aussage
  statement: string; // bleibt Plaintext-Kurzfassung (Output/Ask/Suche)
  // KW-STR / SCRUM-45/46/48: optionaler WYSIWYG-Body als sanitisiertes HTML (additiv).
  bodyHtml?: string | null;
  // WP-BILD-1g (bens sammel14-ROT): ABGELEITETES Suchfeld — die Bild-Fußnoten (figcaption-Texte)
  // des bodyHtml, beim SCHREIBEN mit dem body-sparenden Scanner extrahiert (create/revise). Die
  // Bibliotheks-Suche liest NUR dieses kleine Feld; bodyHtml wird für die Suche nicht mehr geladen.
  // Optional/additiv im JSONB-Dokument (keine Migration): FEHLT das Feld, ist es ein Legacy-KO von
  // vor dieser Regel → einmaliger Backfill beim ersten Such-Kandidaten (danach immer gesetzt, auch
  // als [] für „keine Fußnoten").
  captionTexts?: string[];
  // JOB 3111 · B1b: ABGELEITETES Suchfeld der BENENNUNGEN — die `alt`-Texte der Bilder des
  // bodyHtml, beim SCHREIBEN mit demselben body-sparenden Scanner extrahiert (searchImageNames,
  // create/revise). Die Bildsuche wählt ihre Kandidaten body-frei über dieses kleine Feld; ohne
  // es war ein Name, der NUR im `alt` steht, nicht auffindbar (die benannte Grenze aus JOB 3095).
  // Optional/additiv im JSONB-Dokument (keine Migration), genau wie `captionTexts`: FEHLT das
  // Feld, ist es ein Legacy-KO von vor dieser Regel → Nachzug über den Wartungslauf
  // (ensureSearchArtifacts); `[]` heißt ausdrücklich „keine Benennungen", nicht „unbekannt".
  imageNames?: string[];
  // R-0098 (inhaltskennung-zweitbegriff): ABGELEITETES Feld — je Bild des bodyHtml sein
  // Vorkommensanker (`imageId` = `data-image-id`) und die aus den Bildbytes abgeleitete
  // `inhaltskennung` (`sha256:<hex>`), beim SCHREIBEN gesetzt (create/revise/Dokumentübernahme,
  // structure/src/bildinhalt.ts). Zwei Vorkommen desselben Bildes: zwei Einträge, zwei Anker, eine
  // Inhaltskennung. Zweiter Begriff NEBEN dem Anker, für die Dublettenerkennung — Fußnoten-
  // Zuordnung und Klick laufen weiter allein über `data-image-id`. Optional/additiv im
  // JSONB-Dokument (keine Migration); FEHLT das Feld, ist es Altbestand von vor dieser Regel.
  bildInhalte?: { imageId: string | null; inhaltskennung: string | null }[];
  // R-0658: die Quarantänemarke, gesetzt beim Anlegen/Überarbeiten, wenn der Inhalt Schutzdaten
  // trägt (`schutzdaten.ts`). Sie nennt nur die ARTEN, nie die Werte. Solange sie steht, trägt die
  // Suchprojektion keinen Text und die Sucheinstiege lassen das Objekt aus. Optional/additiv im
  // JSONB-Dokument (keine Migration); fehlt sie, liegt das Objekt nicht in Quarantäne.
  schutzdatenQuarantaene?: SchutzdatenQuarantaene;
  conditions: string[];
  measures: string[];
  type: KnowledgeType;
  category: string;
  // ============================================================================================
  // R-0431 / R-1728 / FR-LIB-01 (K2, K20, K28) — DAS FACHGEBIET, UNABHÄNGIG VON DER KATEGORIE.
  // ============================================================================================
  //
  // Die Originalanforderungen nennen Domäne/Fachgebiet als EIGENE Filterachse neben Kategorie,
  // Art, Status und Schlagwort. Bis hierher gab es dafür kein Datenfeld — die Erfassung führte
  // „Domäne / Kategorie" als ein Feld (`category`). Dieses Feld trägt das Fachgebiet als eigene
  // Angabe, frei benannt wie die Kategorie.
  //
  // OPTIONAL UND OHNE MIGRATION: das KO liegt als Voll-JSONB (`kos.data`, repo-pg.ts). FEHLT das
  // Feld, ist KEIN Fachgebiet angegeben — es wird bewusst NICHT aus Kategorie, Titel oder Inhalt
  // abgeleitet oder nachgetragen; der Altbestand erscheint in der Facette als „ohne Wert".
  // Gesetzt wird es beim Anlegen (`CreateKoInput.domain`) oder nachträglich über `setDomain`.
  domain?: string;
  // ============================================================================================
  // R-1632 / R-1633 (aufnahme:20260922:gesamt-standortwissen) — WO DIESER PUNKT GILT.
  // ============================================================================================
  //
  // Konzern-Standard, Werks-Praxis oder schichtspezifisch, optional mit Rolle; Regel und Vererbung
  // in `geltung.ts`. Gesetzt nur über `setGeltung`; die Anlage- und Überarbeitungswege übernehmen es
  // nicht aus dem Rumpf. Optional, keine Migration; fehlt es, ist die Geltung UNBEKANNT und wird
  // nicht abgeleitet.
  geltung?: KoGeltung;
  // ============================================================================================
  // produkt:20261007:spaces — DER FÜHRENDE SPACE. ER BESTIMMT, WER DIESES OBJEKT SEHEN DARF.
  // ============================================================================================
  //
  // Die Kennung genau eines Space (`services/app/src/spaces.ts`). Fehlt das Feld, gehört das Objekt
  // keinem Space und es gilt allein die bisherige Regel (Stufe + Autor). Ist es gesetzt, sieht das
  // Objekt nur, wer die Inhalte dieses Space lesen darf — angewendet an der einen Stelle
  // `services/app/src/sichtbarkeit.ts`. Eine unbekannte Kennung öffnet nichts (fail-closed).
  //
  // Gesetzt wird es ausschliesslich über `setLeadingSpace` (Spacewechsel mit Rechtevorschau); die
  // öffentlichen Anlage- und Überarbeitungswege übernehmen es nicht aus dem Rumpf. Ein Wechsel
  // ändert weder Inhaltsversion noch `history`, `author` oder `ownership`. Optional, keine Migration.
  spaceId?: string;
  tags: string[];
  confidence: number;
  trust: number;
  status: KoStatus;
  version: number;
  // SCRUM-509 R3: monoton wachsender Nebenläufigkeits-Token für optimistische Concurrency auf DB-Ebene.
  // Jeder Write vergleicht ihn (Compare-and-Set): ein veralteter Voll-Objekt-Write scheitert (StaleWrite)
  // statt eine zwischenzeitliche Änderung (z. B. Vertraulichkeits-Upgrade) zu überschreiben. Fehlt das
  // Feld (Alt-Daten), gilt 0.
  rowVersion?: number;
  originalAuthor: string;
  author: string;
  neededValidations: number;
  assignments: string[];
  // SCRUM-415: Vertraulichkeitsstufe (fehlt = „intern"). Vertrauliche KOs gehen nie in externe Kontexte.
  confidentiality?: Confidentiality;
  // ============================================================================================
  // JOB 679 / D2 (K1.2, Weg A) — WO DAS WISSEN HERKOMMT, UND WARUM ES HIER STEHT.
  // ============================================================================================
  //
  // Der Erfassungsweg des Entwurfs, aus dem dieses Objekt entstanden ist. Bis JOB 679 endete er am
  // Entwurf: `toKoInput` (services/capture) zaehlt die Felder einzeln auf, und `origin` war nicht
  // darunter — die Herkunft fiel an der Persistenzgrenze weg. Die Oberflaeche konnte einen
  // Herkunfts-Chip deshalb nicht ehrlich zeigen; sie haette eine Faehigkeit angekuendigt, deren
  // Wirkung lautlos ausbleibt.
  //
  // DIE WERTMENGE IST DIESELBE WIE AM ENTWURF (`DraftPayload["origin"]`, services/capture/types.ts)
  // und wird dort bereits geprueft: `normalizeOriginIn` laesst nur bekannte Werte durch und
  // VERWIRFT unbekannte, statt sie auf einen Standard zu normalisieren. Hier wird deshalb nichts
  // nachgeprueft und nichts erfunden — was ankommt, ist bereits entschieden. Bewusst als eigene
  // Aufzaehlung und nicht als Import aus `capture`: die beiden Dienste haengen nicht voneinander ab,
  // und eine Modulkante fuer ein Feld waere der teurere Preis.
  //
  // OPTIONAL UND OHNE MIGRATION: das KO liegt als Voll-JSONB (`kos.data`, repo-pg.ts). Ein
  // zusaetzliches optionales Feld landet im Dokument; Altbestand hat den Schluessel schlicht nicht.
  // Kein DDL, kein Backfill. FEHLT das Feld, ist die Herkunft UNBEKANNT — das ist ehrlich und
  // heisst ausdruecklich nicht „ueber die Vordertuer erfasst".
  //
  // R-0180/R-2108: `import` ist die EINZIGE Ausnahme von „dieselbe Wertmenge wie am Entwurf". Den
  // Wert setzt allein die menschliche Annahme eines Importkandidaten (`LibraryService.acceptToKo`,
  // Erstanlage). Ein Entwurf kann ihn nicht tragen (`ERLAUBTE_HERKUNFT` in services/capture kennt
  // ihn bewusst nicht), und die öffentlichen Schreibrouten verwerfen ihn (ko-routes.ts) — sonst
  // könnte sich jedes Objekt als „importiert" ausgeben.
  origin?: "tell" | "studio" | "expert" | "frontdoor" | "word_addin" | "import";
  // Pedi 05.07.: read-only Board-Anreicherung — Peer-Stimmen-Zähler (grün/gelb/rot) für die Anzeige
  // „X von Y grün" auf der Validierungsseite. Nur die Board-Sicht setzt es; sonst undefined.
  reviewVotes?: { up: number; warn: number; down: number };
  // ============================================================================================
  // W3-C (KW-W3-19, Pedi 03.08.) — DER VERWEIS AUF DIE VALIDIERUNGSENTSCHEIDUNG.
  // ============================================================================================
  //
  // Pedis Entscheidung: AUSSCHLIESSLICH das Knowledge Object trägt sie. Ein Rating als Träger
  // wurde verworfen — `adminValidate()` schreibt gar kein Rating und bräuchte einen zweiten Ort.
  //
  // ES IST EIN VERWEIS, KEIN ZWEITER WAHRHEITSORT. Der Auditeintrag bleibt die Wahrheit; wer den
  // Verweis benutzt, löst ihn über `findBySeq` ein und prüft ihn (Audit-Modul:
  // `pruefeValidationDecisionRef`) — er glaubt ihn nicht. Der Wert stammt ausschließlich aus dem
  // Rückgabewert von `AuditService.record()`; eine spätere Suche oder Rekonstruktion über
  // Zeitpunkt, Actor, KO-Version oder aktuellen Status ist ausdrücklicher No-Go von KW-W3-19.
  //
  // OPTIONAL UND OHNE MIGRATION: das KO liegt als Voll-JSONB (`kos.data`). Fehlt das Feld, ist es
  // ein KO ohne festgehaltene Entscheidung — Altbestand oder nie validiert. Das ist EHRLICH
  // `MISSING`, nicht „ungeprüft" und schon gar nicht „gültig". Kein Backfill.
  //
  // WARUM HIER KEINE VERSION DANEBEN STEHT: die geprüfte KO-Fassung reist im Auditpayload mit, und
  // das Subject der Prüfung kommt aus der HEUTIGEN `version` des KO. Würde die Version hier
  // mitgespeichert, meldete eine durch `revise()` überholte Entscheidung dauerhaft `OK` — genau
  // der schlechte Kompromiss, den die Entscheidung ausschließt. Nach einer Revision bleibt der
  // Verweis stehen und wird folgerichtig `WRONG_SUBJECT`.
  validationDecisionRef?: { auditSeq: number; auditHash: string };
  // ============================================================================================
  // JOB 557 (Pedi 13.08.2026) — WEM DAS OBJEKT GEHÖRT, WER ES GEPRÜFT UND WER ES VALIDIERT HAT.
  // ============================================================================================
  //
  // OPTIONAL UND OHNE MIGRATION: das KO liegt als Voll-JSONB (`kos.data`, repo-pg.ts). Ein
  // zusätzliches optionales Feld landet im Dokument; Altbestand hat den Schlüssel schlicht nicht.
  // Kein DDL, kein Backfill.
  //
  // FEHLT DAS FELD, IST DIE VERANTWORTUNG UNBENANNT — und das heisst ausdrücklich NICHT „der Autor
  // ist Eigentümer". Der Rückfall auf den Autor fällt erst bei der Verantwortungs-FRAGE
  // (`responsibleOf`), damit am Objekt ablesbar bleibt, ob Eigentum benannt oder nur ersetzt ist.
  // Ein stiller `owner = author`-Default beim Anlegen ist ausdrücklich verworfen: er wäre genau die
  // Gleichsetzung von Erzeuger und Verantwortlichem, die Pedis Entscheidung zurückgewiesen hat.
  ownership?: KnowledgeOwnership;
  asset: string | null;
  createdAt: string;
  history: HistoryEntry[];
  comments: KoComment[];
  // ============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — DIE EINGEREICHTEN ÄNDERUNGSVORSCHLÄGE DIESES OBJEKTS.
  // ============================================================================================
  //
  // OPTIONAL UND OHNE MIGRATION, dieselbe Bauform wie `ownership` darüber: das KO liegt als
  // Voll-JSONB (`kos.data`, repo-pg.ts), ein zusätzliches optionales Feld landet im Dokument.
  // Altbestand hat den Schlüssel schlicht nicht; kein DDL, kein Backfill, kein Repo-Umbau.
  //
  // WARUM ES DAS BRAUCHT (Pedis Accountregel, SICHTBARES-GESPRAECH.jsonl:693): wer nicht
  // freigabeberechtigt ist, darf den freigegebenen Stand NICHT ersetzen — seine Änderung „muss
  // nochmal von jemand anders überprüft werden". Sie braucht also eine Form, die AN DIESES Objekt
  // gebunden ist, ohne sein Wissen zu sein: nicht ein zweites Wissensobjekt daneben, nicht ein
  // Kommentar (der trägt keinen entschiedenen Zustand), sondern ein eigener Datensatz mit
  // Urheber, Grundlage, Zustand und Entscheidung.
  proposals?: KoProposal[];
  attachments: KoAttachment[];
  sources: KoSource[];
  // Demodaten-Merker (Pedi 02.07.): vom Seed gesetzt, überlebt Bearbeitungen/Versionen —
  // damit Demo-Bestand sichtbar bleibt und komplett entfernt werden kann.
  demoSeed?: boolean;
  // WP-SHIP8-CLOSE-3/4 (bens ROT-1, 1A/1B/1C): STABILER Idempotenzanker des Import-Accepts — die
  // Id des Review-KANDIDATEN, aus dem dieses KO entstand. Bewusst der Kandidat (stabil über alle
  // Claim-Vorgänge/Retries hinweg), NICHT die je Claim wechselnde opId: nur so erzwingt der
  // partielle Unique-Index (kos_import_candidate_uq, inkl. Papierkorb) „höchstens EIN KO je
  // Kandidat" — späte Writes eines abgelösten Laufs kollidieren und werden adoptiert statt
  // dupliziert. NUR der Import-Accept-Pfad setzt das Feld (die öffentliche Schreibroute verwirft
  // es wie `sources`); die Claim-Recovery findet darüber ein bereits erzeugtes KO — auch im
  // Papierkorb.
  importCandidateId?: string;
  // ============================================================================================
  // R-0139 / FR-EXT-02 (aufnahme:20260922:gesamt-import-adoption:herkunft-identitaet) — DASS DIESES
  // OBJEKT IMPORTIERT IST, STEHT AM OBJEKT, UND ZWAR FÜR BEIDE IMPORTWEGE GLEICH.
  // ============================================================================================
  //
  // Bis hierher trug nur der Kandidaten-Accept eine Spur (`importCandidateId`); ein über
  // `POST /api/library/import` (importJson) eingespieltes Objekt war von einem frei erfassten nicht
  // zu unterscheiden — die Herkunft „importiert" ging an der Persistenzgrenze verloren, genau wie
  // `origin` vor JOB 679.
  //
  //   · "library_import"   — direkter JSON-Import (`LibraryService.importJson`).
  //   · "import_candidate" — Prüfwarteschlange → Annehmen (`acceptToKo`); die Quelle selbst steht
  //                          dann in `sources` (Anker mit provider/externalId/sourceVersion) bzw.
  //                          über `importCandidateId` am Kandidaten.
  //
  // NUR SERVERPFADE SETZEN DAS FELD. Die öffentlichen Schreibrouten verwerfen es wie `sources` und
  // `importCandidateId` (ko-routes.ts) — sonst könnte jeder mit `ko.create` ein Objekt als
  // importiert ausgeben. Additiv im JSONB, keine Migration. FEHLT das Feld, ist das Objekt nicht
  // über einen der beiden Importwege entstanden ODER Altbestand von vor dieser Regel — ein Backfill
  // findet bewusst nicht statt, weil er für importJson-Altbestand raten müsste.
  importedVia?: "library_import" | "import_candidate";
  // ============================================================================================
  // R-0169 (herkunft-identitaet, Nacharbeit 5) — AUS WELCHER FASSUNG EINES INTERNEN DOKUMENTS.
  // ============================================================================================
  //
  // Der Bezug auf genau eine unveränderliche Fassung der internen Dokumentakte (dokumentakte.ts):
  // Word-Zusatz und JSON ohne `externalId`. Er reist im Versionsschnappschuss mit — so sagt jede
  // Objektfassung, aus welcher Dokumentfassung ihre Aussage stammt. Getrennt von `sources`
  // (externe Quellen mit eigener Kennung): eine interne Dokumentkennung ist keine Quelle im
  // Quellsystem und wird nie als solche ausgegeben. Nur Serverpfade setzen das Feld; die
  // öffentlichen Schreibrouten verwerfen es. Additiv im JSONB, keine Migration, kein Backfill.
  dokumentHerkunft?: DokumentHerkunft;
  // R-0632 (BEN, Nacharbeit 10): die Herabstufungssperre eines Word-Entwurfs reist beim Promote
  // ins Wissensobjekt. Solange sie steht, wird die Stufe nur angehoben, NIE gesenkt — auch nicht
  // von Prüfer oder Administrator (`setConfidentiality`, unabhängig von `mayDowngrade`). Nur der
  // Entwurfs-Promote setzt sie (Marke `stufeNurAnheben` am Draft); die öffentlichen Schreibrouten
  // verwerfen das Feld. Andere Wissensobjekte behalten die Regel aus SCRUM-509.
  stufeNurAnheben?: true;
  // WP-SUBMIT-ASYNC (Pedis R3 21.07.): Status der HINTERGRUND-KI-Prüfung nach dem Einreichen —
  // additiv im JSONB, keine Migration; Altbestand ohne Feld = kein Prüf-Job. Die Ergebnis-Signale
  // (Konflikte/Überschneidungen) entstehen unverändert in ihren Services — aiCheck trägt nur den
  // ehrlichen Job-Status für die Validierungs-Anzeige.
  aiCheck?: AiCheck;
  // AUFTRAG-mega18 Block A-1: Vorgangsgedächtnis der VERBUND-OPERATION „Dokumentinhalt übernehmen"
  // (KoService.appendDocumentExtract). Additiv im JSONB, keine Migration; Altbestand ohne Feld hat
  // schlicht noch keinen Vorgang erinnert. Es liegt AM OBJEKT und nicht in einem Prozessspeicher,
  // damit die Idempotenz-Prüfung Teil desselben Read-Modify-Write ist wie der Vollzug (kein TOCTOU),
  // einen Neustart übersteht und prozessübergreifend gilt. Gedeckelt (DOCUMENT_APPEND_OP_MEMORY) —
  // die Grenze und ihr Preis stehen ausgeschrieben in document-append.ts.
  appendOps?: KoAppendOp[];
  // AUFTRAG-mega20 Block A: STABILER Idempotenzanker der ERSTANLAGE aus Dokumenten
  // (KoService.createWithDocuments). Anders als `appendOps` kann er nicht im Vorgangsgedächtnis
  // eines bestehenden Objekts liegen — das Objekt entsteht ja gerade erst. Er liegt deshalb AM
  // Objekt und ist DB-weit eindeutig (partieller Unique-Index kos_create_operation_uq, inkl.
  // Papierkorb): ein zweiter Insert desselben Vorgangs kollidiert hart und wird ADOPTIERT statt
  // dupliziert. Additiv im JSONB; Altbestand ohne Feld ist vor dieser Regel entstanden.
  // NUR die Dokumentübernahme setzt das Feld — die öffentliche Schreibroute verwirft es wie
  // `sources` und `importCandidateId`. Die Begründung steht in document-create.ts.
  createOperationId?: string;
  // AUFTRAG-mega20 Block A: REPARATURVERMERK. Gesetzt, wenn die kompensierende Rücknahme einer
  // gescheiterten Erstanlage selbst gescheitert ist — dann steht dieses Objekt im Bestand, obwohl
  // seine Belege (Snapshot/Evidence/Audit) unvollständig sein können. Bis mega19 wurde der
  // Rollback-Fehler verschluckt und dieser Zustand war unsichtbar. Der Vermerk repariert nichts;
  // er macht das Objekt AUFFINDBAR und den Grund BENENNBAR (s. document-create.ts, KoRepairNote).
  needsRepair?: KoRepairNote;
  // AUFTRAG-mega21 Block A: DER VORGANGS-DATENSATZ. `createOperationId` allein ist nur ein
  // SCHLÜSSEL — er weiß nicht, WEM der Vorgang gehört, WAS er war und WIE er ausging. Genau diese
  // drei Lücken waren bens SB-1, SB-3 und SB-4. Der Datensatz liegt AM Objekt (wie der Schlüssel
  // selbst) und wird im SELBEN `repo.insert` geschrieben — es gibt keinen Augenblick, in dem der
  // Schlüssel ohne seinen Eigentümer im Bestand steht. Additiv im JSONB, keine Migration; Altbestand
  // ohne Datensatz ist vor dieser Regel entstanden und wird in adoptCreatedKo eigens behandelt.
  createOperation?: KoCreateOperation;
  // AUFTRAG-mega21 Block C-1: die nach dem Commit GESCHEITERTEN Nacharbeiten, DAUERHAFT am Objekt.
  // Bis mega20 standen sie nur in der Antwort (`followUpsFailed`) und im Audit — die Antwort ist
  // weg, sobald der Browser sie gelesen hat, und im Audit sucht niemand. Ein Wissensobjekt, dessen
  // Prüferzuweisung fehlschlug, war damit ununterscheidbar von einem, das gar keine brauchte. Hier
  // ist es AUFFINDBAR: ein Feld am Objekt, das jede Abfrage sieht und das einen Neustart übersteht.
  createFollowUpsFailed?: string[];
  // SCRUM-422 (Papierkorb): gesetzt beim Soft-Delete. Getrashte KOs sind aus ALLEN
  // Lese-/Mutations-Pfaden ausgeblendet (wirken gelöscht) und werden nach Ablauf der
  // Frist automatisch endgültig entfernt. Demo-Daten landen NIE hier (immer hart).
  deletedAt?: string;
  deletedBy?: string;
  // ============================================================================================
  // R-1107 (Aufnahme gesamt-dublettenvergleich) — DER AUFGEGANGENE ARTIKEL BLEIBT, MIT VERWEIS.
  // ============================================================================================
  //
  // Gesetzt ausschliesslich vom Zusammenführen-Assistenten (`KoService.markMergedInto`), wenn der
  // Inhalt dieses Objekts in einen Führungsartikel übernommen wurde. Das Objekt wird dabei NICHT
  // gelöscht und nicht in den Papierkorb gelegt (der endlöscht nach Frist und nähme Quellen,
  // Kommentare und Historie mit): es bleibt dauerhaft lesbar und nennt den verbleibenden Artikel.
  // Additiv im JSONB, keine Migration; fehlt das Feld, ist das Objekt in nichts aufgegangen.
  mergedInto?: KoMergedInto;
}

/** R-1107: wohin ein aufgegangener Artikel zusammengeführt wurde (s. `KnowledgeObject.mergedInto`). */
export interface KoMergedInto {
  /** Der verbleibende Führungsartikel. */
  koId: string;
  /** Seine Fassung, die den Inhalt aufgenommen hat (eine neue, ungeprüfte Fassung). */
  version: number;
  /** Der Dublettenbefund, über den zusammengeführt wurde. */
  overlapId: string;
  at: string;
  by: string;
}

// SCRUM-422: Papierkorb-Zeile für den Admin — nur Metadaten, keine Inhalte.
export interface TrashedKo {
  id: string;
  title: string;
  category: string;
  deletedAt: string;
  deletedBy: string;
  // Wann die automatische Endlöschung greift (deletedAt + TRASH_RETENTION_DAYS).
  expiresAt: string;
}

// SCRUM-159 (Knowledge-OS-Foundation): unveränderlicher Voll-Snapshot eines KO je Version.
// Hält den kompletten Stand bei Versions-Erstellung (create/revise) fest. Aktuelles KO bleibt
// canonical current state; Snapshots sind reine Foundation-Infrastruktur (kein UI-Feature).
export interface KoVersionSnapshot {
  koId: string;
  version: number;
  snapshot: KnowledgeObject; // vollständiger Stand dieser Version
  at: string;
  author: string;
  note: string;
}

// SCRUM-160 (Knowledge-OS-Foundation): separate Evidence-Records für externe Quellen
// und Objekt-Anhänge. Additiv zur bestehenden KO-Struktur; keine UI-/API-Änderung.
export type EvidenceKind = "source" | "attachment";

export interface EvidenceRecord {
  id: string;
  koId: string;
  koVersion: number;
  kind: EvidenceKind;
  sourceId?: string;
  attachmentId?: string;
  objectId?: string;
  label: string;
  mime?: string;
  url?: string | null;
  provider?: string | null;
  // AUFTRAG-mega26 Block B: DER GRUND DER VERKNÜPFUNG (additiv, optional).
  //
  // Bis mega25 sagte ein EvidenceRecord, DASS eine Quelle an einem KO hängt, aber nicht, WARUM.
  // Der Grund stand ausschliesslich mittelbar im `excerpt` der zugehörigen `KoSource` — also in
  // einem Datensatz, den die Evidence nicht kopiert und der beim Rollback einer Version verschwindet,
  // während die append-only Evidence bleibt (s. `evidence-without-source` weiter unten). Genau dann
  // war der Beleg vorhanden und seine Begründung weg.
  //
  // Der Erzeuger KENNT den Grund zum Schreibzeitpunkt: an allen drei quellenschreibenden Stellen
  // liegt die fertige `KoSource` samt getrimmtem `excerpt` im selben Scope. Er wird deshalb
  // mitgeschrieben — wörtlich, nicht umformuliert.
  //
  // NUR bei `kind:"source"`. Ein Anhang (`kind:"attachment"`) hat keinen solchen Grund: dort gibt
  // es zum Schreibzeitpunkt keinen Text ausser dem Dateinamen (der bereits in `label` steht).
  // Leerer/fehlender excerpt → Feld weggelassen, nie ein leeres Feld.
  excerpt?: string;
  createdBy: string;
  createdAt: string;
}

/**
 * AUFTRAG-mega20 Block A — der Reparaturvermerk am Wissensobjekt. Die ausgeschriebene Begründung
 * (warum ein verschluckter Rollback-Fehler der teurere Zustand ist, und warum dieser Vermerk best
 * effort bleiben MUSS) steht in document-create.ts.
 */
export interface KoRepairNote {
  /** Zeitpunkt des gescheiterten Rollbacks (ISO). */
  at: string;
  /** Der Beleg-Schritt, der die Anlage zu Fall gebracht hat (Fehlername, PII-frei). */
  failedStep: string;
  /** Warum die Rücknahme selbst nicht ging (Fehlername, PII-frei). */
  rollbackFailure: string;
}

/**
 * AUFTRAG-mega21 Block A — DAS GEDÄCHTNIS DES VORGANGS.
 *
 * Drei Felder, drei Fragen, die `createOperationId` allein nicht beantworten konnte. Die
 * ausgeschriebene Begründung je Feld steht in document-create.ts; hier nur die Kurzform:
 *
 *   · `actor`       — WEM gehört der Vorgang? Der AUTHENTIFIZIERTE Anfragende der Erstanlage,
 *                     unveränderlich. NICHT `author`: der stammt beim Entwurfsweg vom ursprünglichen
 *                     Verfasser (FR-CAP-07) und ist über `setAuthor` später änderbar. Ein
 *                     veränderliches Feld taugt nicht als Eigentümerbindung.
 *   · `fingerprint` — WAS war der Vorgang? Der kanonische Abdruck der Anfrage. Ohne ihn liefert
 *                     derselbe Schlüssel nach einer Inhaltsänderung still das alte Objekt.
 *   · `state`       — WIE ging er aus? `committed` = normal gelungen. `repair_required` = die
 *                     Anlage scheiterte NACH dem Insert und die Rücknahme ebenfalls; das Objekt
 *                     steht mit möglicherweise unvollständigen Belegen im Bestand und darf NIE als
 *                     normaler Erfolg adoptiert werden.
 */
export interface KoCreateOperation {
  /** Der unveränderliche Eigentümer: die Kennung des authentifizierten Anfragenden. */
  actor: string;
  /** Kanonischer Inhaltsabdruck der Anfrage (SHA-256, hex) — s. createOperationFingerprint. */
  fingerprint: string;
  /** Der Zustand des Vorgangs. Ein Reparaturrest wird nie als Erfolg ausgeliefert. */
  state: KoCreateOperationState;
  /** Zeitpunkt der Anlage (ISO). */
  at: string;
}

export type KoCreateOperationState = "committed" | "repair_required";

export type KoErrorCode =
  | "NOT_FOUND"
  | "INVALID_TYPE"
  | "INVALID_NEEDED"
  | "INVALID_SOURCE"
  // produkt:20261007:spaces: der führende Space hat sich seit der Rechtevorschau geändert
  // (`setLeadingSpace`); die Route antwortet darauf mit 409 VORSCHAU_VERALTET.
  | "SPACE_STAND_VERALTET"
  // SCRUM-421: ungültige Upload-Grenzen (Admin-Einstellung).
  | "INVALID_UPLOAD_LIMITS"
  // SCRUM-509: ungültige Vertraulichkeitsstufe (kein stilles Normalisieren auf „intern").
  | "INVALID_CONFIDENTIALITY"
  // JOB 557: die gelieferte Eigentümerangabe trägt nichts Brauchbares. Sie wird ABGELEHNT statt
  // still zu `null` normalisiert — ein stilles `null` würde ein vorhandenes Aggregat löschen, und
  // ein Löschen darf nicht die Nebenwirkung eines Tippfehlers sein (fail-closed, wie
  // INVALID_CONFIDENTIALITY daneben).
  | "INVALID_OWNERSHIP"
  // SCRUM-509 R2: Herabstufung ohne Prüfer-/Admin-Rolle (atomar an der Datenschicht geprüft).
  | "DOWNGRADE_FORBIDDEN"
  // SCRUM-509 R3: optimistische Concurrency — der Voll-Objekt-Write war veraltet (rowVersion-Konflikt).
  | "STALE_WRITE"
  // ============================================================================================
  // JOB 3667 (WORD-RÜCKWEG, Runde 2) — DIE VIER FEHLER DES RÜCKWEGS.
  // ============================================================================================
  // `KO_STALE`: der Aufrufer hat eine Inhaltsversion mitgeschickt, die das Objekt nicht (mehr)
  //   trägt. Geschrieben wird NICHTS — das ist der Unterschied zu „letzter gewinnt". Die Prüfung
  //   sitzt IM Dienst (in derselben per-KO serialisierten Transaktion wie der Schreibvorgang) und
  //   nicht an der Route: an der Route wäre sie ein Zeitfenster, hier ist sie ein CAS.
  // `PROPOSAL_NOT_FOUND`: die Vorschlagskennung gehört nicht zu diesem Objekt.
  // `PROPOSAL_DECIDED`: der Vorschlag ist bereits entschieden. Eine Wiederholung wirkt NICHT ein
  //   zweites Mal — genau daran fehlte es, solange ein Kommentar den Vorschlag trug.
  // `PROPOSAL_OWN`: der Entscheider IST der Einreicher. Eine Prüfung durch sich selbst ist keine
  //   Prüfung („dies muss nochmal von jemand anders überprüft werden"); die Regel steht im Dienst,
  //   weil eine Oberflächenregel sie nicht halten kann.
  | "KO_STALE"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSAL_DECIDED"
  | "PROPOSAL_OWN"
  // JOB 4146 (WIKI-DISKUSSION): die Beitragskennung gehört nicht zu diesem Wissensobjekt — als
  // Bezug einer Antwort (`replyTo`) oder als Gegenstand eines Klärungsstands. Bewusst KEIN
  // `NOT_FOUND`: das bedeutet an dieser Route „das Wissensobjekt gibt es nicht" (404) und würde die
  // Auskunft über eine ganz andere Sache geben. Ohne eigenen Eintrag in `STATUS_BY_CODE` (http.ts,
  // nicht Zielpfad) wird daraus ein 400 mit Grund — und das ist hier die richtige Antwort: der
  // Aufrufer hat einen Bezug geschickt, den es nicht gibt.
  | "COMMENT_NOT_FOUND"
  // WP-SHIP8-CLOSE-4 (bens ROT-1B): der Kandidaten-Anker (importCandidateId) ist bereits vergeben —
  // ein zweites KO desselben Import-Kandidaten wird DB-seitig abgelehnt (Pg: partieller Unique-Index,
  // InMemory: Insert-Guard). Der Import-Accept adoptiert dann das bestehende KO statt zu duplizieren.
  | "IMPORT_ANCHOR_TAKEN"
  // AUFTRAG-mega18 Block A-2: die INTERNE BELEGPFLICHT hat gegriffen — übernommener Dokumentinhalt
  // ohne echten Original-Anker. Eine eigene Regel, unabhängig von der externen Stufe; die
  // Begründung der Trennung steht in document-append.ts.
  | "MISSING_DOCUMENT_ANCHOR"
  // AUFTRAG-mega18 Block A-1: die Verbund-Operation braucht einen wiederholbaren Vorgangsschlüssel
  // (Idempotenz). Fehlt er oder ist er unbrauchbar, wird ehrlich abgelehnt statt einer erfundenen
  // Kennung — die würde die Wiederholbarkeit lautlos aufheben.
  | "INVALID_OPERATION_ID"
  // AUFTRAG-mega20 Block A: die Erzeugungs-Kennung der Dokumentübernahme ist bereits vergeben —
  // ein zweites Wissensobjekt DESSELBEN Vorgangs wird DB-seitig abgelehnt (Pg: partieller
  // Unique-Index kos_create_operation_uq, InMemory: Insert-Guard). Der Service adoptiert daraufhin
  // das bestehende Objekt statt zu duplizieren; nach außen wird dieser Code nur sichtbar, wenn die
  // Adoption NICHT zulässig ist (fremde Autorschaft) — dann ehrlich als Konflikt.
  | "CREATE_ANCHOR_TAKEN"
  // AUFTRAG-mega20 Block A: die kompensierende RÜCKNAHME einer gescheiterten Erstanlage ist selbst
  // gescheitert. Das Wissensobjekt steht im Bestand und ist möglicherweise unvollständig belegt.
  // Bis mega19 wurde dieser Fall verschluckt (`.catch(() => undefined)`) und der Aufrufer sah nur
  // den ursprünglichen Fehler. Jetzt ist er ein EIGENER Fehler mit der Kennung des Objekts.
  | "CREATE_ROLLBACK_FAILED"
  // AUFTRAG-mega21 Block A: DERSELBE Vorgangsschlüssel, ABWEICHENDER Inhalt. Bis mega20 wurde in
  // diesem Fall still das alte Objekt geliefert — der Nutzer hatte gerade Text geändert und bekam
  // den vorherigen Stand zurück, ohne es zu erfahren. Jetzt ist es ein ausdrücklicher Fehler mit
  // einem Weg zurück (die Oberfläche bietet an, den Vorgang neu zu beginnen).
  | "IDEMPOTENCY_PAYLOAD_MISMATCH"
  // AUFTRAG-mega21 Block A: der Vorgang steht auf `repair_required` — Anlage UND Rücknahme sind
  // gescheitert, das Objekt ist möglicherweise unvollständig belegt. Ein Wiederholversuch bekommt
  // diesen Rest NIE als Erfolg (das war bens SB-4), sondern eine ehrliche Auskunft.
  | "CREATE_REPAIR_REQUIRED"
  // G27 R1 (KW-ARCH-G27-RESTFRAGEN-05 §2): die Standardsuche ist NICHT verfügbar, weil keine
  // Projektionsfassung freigegeben ist (`UNINITIALIZED`, `V2_BUILDING`, `V2_READY`, `FAILED`) oder
  // der Control-State beschädigt/inkonsistent ist. REIN ADDITIV und rein INTERN: technische
  // Betriebslogik der Suchinfrastruktur, keine Änderung am KO-Fachmodell, keine Routen- und keine
  // Vertragsänderung nach außen. Er existiert, weil die Alternative — `[]` — gelogen hätte: eine
  // leere Treffermenge bedeutet fachlich „nichts gefunden" und darf „Suche nicht verfügbar" nicht
  // verschleiern (Entscheidung 04 §4).
  | "SEARCH_PROJECTION_NOT_READY"
  // ============================================================================================
  // JOB 4213 (WIKI-NACHVOLLZIEHEN): DER ALLGEMEINE EINGABEFEHLER — bewusst KEIN neuer Name.
  // ============================================================================================
  //
  // Er trägt heute genau einen Fall: `restoredFromVersion` nennt eine Fassung, die es an diesem
  // Wissensobjekt nicht gibt (`KoService.pruefeHerkunft`). Ohne Eintrag in `STATUS_BY_CODE`
  // (`services/app/src/http.ts`) wird daraus ein 400 mit Grund — dieselbe Bauform und dieselbe
  // Begründung wie bei `COMMENT_NOT_FOUND` daneben: der Aufrufer hat etwas geschickt, das es nicht
  // gibt, und der Zustand ist in Ordnung.
  //
  // WARUM NICHT „INVALID_RESTORE_SOURCE": jeder Domänencode muss in `ERLAUBTE_FEHLERCODES`
  // (`services/app/src/build-app.ts`) stehen, sonst erschiene er im Protokoll als UNBEKANNT — und
  // diese Datei ist in diesem Auftrag AUSDRÜCKLICH keine Zielpfaddatei (sie gehört dem wartenden
  // JOB 4155). `INVALID` steht dort seit jeher. Der Preis ist ein unschärferer Code im Protokoll;
  // der Meldungstext nennt die Sache vollständig.
  | "INVALID";

export class KoError extends Error {
  readonly code: KoErrorCode;
  /**
   * AUFTRAG-mega20 Block A: ADDITIVE Zusatzangaben für Fehler, bei denen der Aufrufer mehr braucht
   * als eine Meldung. Konkret `CREATE_ROLLBACK_FAILED`: ohne die Kennung des zurückgebliebenen
   * Objekts ist „es ist etwas übrig" keine reparierbare Aussage, sondern nur eine beunruhigende.
   * Optional und rein informativ — keine bestehende Fehlerstelle ändert ihr Verhalten dadurch.
   * `cause` trägt den URSPRÜNGLICHEN Fehler; er wird bewusst NICHT in `message` gespiegelt, damit
   * nichts über sendError nach außen leckt, was dort nicht hingehört (SCRUM-496).
   */
  readonly details?: { readonly koId?: string; readonly cause?: unknown };

  constructor(code: KoErrorCode, message: string, details?: { koId?: string; cause?: unknown }) {
    super(message);
    this.code = code;
    this.name = "KoError";
    if (details) {
      this.details = details;
    }
  }
}
