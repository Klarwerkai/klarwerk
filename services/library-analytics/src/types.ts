import type {
  Confidentiality,
  KnowledgeObject,
  KnowledgeType,
  KoStatus,
} from "../../knowledge-object";

export interface ImportItem {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  author?: string;
  tags?: string[];
  // SCRUM-509 R3: optionale Vertraulichkeit aus einem Quell-Governance-Signal (SCRUM-511). FEHLT sie,
  // stuft der Import-Pfad KONSERVATIV auf „vertraulich" ein (kein stiller intern-Default auf Bulk-Pfaden).
  confidentiality?: Confidentiality;
  // SCRUM-510 R2b: QUELLNEUTRALE Provenienz/Herkunfts-Anker. externalId = Idempotenz-/Re-Sync-Schlüssel
  // je Quell-Objekt (Confluence-pageId, Jira-Issue-Key, …); sourceScope = Quell-Container (Confluence-
  // Space, Jira-Projekt, …). Der Import-Kern kennt keine quell-spezifischen Begriffe — ein Adapter #2
  // (Jira) füllt dieselben Felder ohne Confluence-Symbole.
  externalId?: string;
  sourceScope?: string;
  // AUFTRAG-mega27 A2: QUELLNEUTRALE HIERARCHIE INNERHALB des Containers — die Elterntitel in
  // Quell-Reihenfolge, WURZEL ZUERST, OHNE das Objekt selbst (Confluence: die `ancestors`-Kette;
  // ein Jira-Adapter füllt dasselbe Feld später mit Epic/Projekt). Der Import-Kern kennt weiterhin
  // keine quell-spezifischen Begriffe (SCRUM-510 R2b).
  //
  // KEIN FELD OHNE ERZEUGER: liefert die Quelle keine Elternkette, FEHLT das Feld — kein leeres
  // Array, kein Platzhalter-Ordner, kein aus dem Titel geratener Pfad. Rein additiv; kein
  // Import-Pfad hängt davon ab. Der Dekodier-Marker `textCodec` gilt für diese Werte wie für
  // Titel/Autor: sie sind an der Quelle EINMAL kanonisch dekodiert.
  sourcePath?: string[];
  sourceVersion?: number;
  url?: string;
  provider?: string;
  bodyHtml?: string;
  // IC-1 (Import-Cockpit): OPTIONALER ISO-Zeitstempel der letzten Quell-Änderung (z. B. Confluence
  // version.when). Rein additiv — nur für die Read-only-Erkundung (Zeitraum); kein Adapter MUSS es
  // füllen, kein Import-Pfad hängt davon ab.
  updatedAt?: string;
  // WP-IC-PAKET-1c/1d (bens ROT-2 + sammel9): DECODE-MARKER. "decoded" = die textuellen Felder sind
  // KANONISCH — die Anzeige darf NICHT erneut dekodieren (sonst wird ein echtes Literal &uuml;
  // faelschlich zu ü). ZENTRALE ERZEUGUNGSREGEL (1d): createImportCandidates stempelt JEDES neue Item
  // autoritativ an der einen Ingest-Grenze (deckt Confluence-Import, JSON-Re-Import-Route und
  // Demo-Korpus ab); der Confluence-Mapper setzt den Marker zusaetzlich bereits bei der Erzeugung
  // (Explore/Select laufen ohne Kandidaten-Erzeugung direkt auf Mapper-Items). FEHLT der Marker, ist
  // es ECHTER Altbestand (gespeichert vor dieser Regel) → defensiver Anzeige-Decode. JSON-persistiert.
  textCodec?: "decoded";
}

// ================================================================================================
// JOB 3023 — DIE DUBLETTENREGEL REIST ALS DATUM IN DEN DIENST.
// ================================================================================================
//
// Bis HEAD 7cf92ce entschied `importJson()` „Dublette" ueber ZEICHENGLEICHHEIT von
// `` `${title}|${statement}` `` (service.ts:1394-1399). Ein Satzpunkt, ein anderes Leerzeichen oder
// eine geaenderte Gross-/Kleinschreibung genuegte, damit derselbe Eintrag ein zweites Mal in den
// Bestand ging — genau das, was eine aus einem anderen Werkzeug gezogene Sicherung mitbringt.
//
// WARUM EIN PORT UND KEIN IMPORT AUS `services/conflicts`. Das Produkt BESITZT die Regel bereits,
// deterministisch und ohne Modell/Egress (`conflicts/index.ts:25` `coreText`, `:29`
// `trigramSimilarity`). Wuerde dieses Modul sie selbst holen, gaebe es eine zweite Auslegung
// derselben Frage an einem zweiten Ort — und eine neue Modulkante library-analytics → conflicts.
// Stattdessen faellt die Entscheidung dort, wo sie hingehoert (Kompositionswurzel
// `services/app/src/routes/library-routes.ts`) und reist von hier als PRAEDIKAT herein. Das Vorbild
// steht eine Datei tiefer unten: `KoSichtbar` (mega76 Block D).
//
// BEWUSST NICHT OPTIONAL, wo dieser Typ verlangt wird — dieselbe Begruendung wie am Kopf von
// `erzwingeSichtbar`: ein optionaler Schutz ist ein angebotener Schutz, und ein zweiter Aufbau
// duerfte ihn dann typgueltig weglassen, ohne dass es jemand merkt.
//
// BEWUSST SYNCHRON. Eine synchrone Signatur ist die Zusicherung selbst: hinter ihr kann kein
// Modellaufruf und kein Egress stecken. Die Regel ist eine Rechnung auf Text, nichts sonst.
export type DublettenBefund =
  | { readonly dublette: false }
  | {
      readonly dublette: true;
      /** Das getroffene Wissensobjekt — die Antwort sagt, WORAUF der Eintrag getroffen ist. */
      readonly koId: string;
      /** Der Aehnlichkeitswert 0..1, mit dem die Pruefung entschieden hat. */
      readonly aehnlichkeit: number;
    };

export type DublettenPruefung = (
  item: ImportItem,
  /**
   * Der Vergleichsbestand. Er enthaelt auch die IM SELBEN LAUF erzeugten Objekte — eine Sicherung,
   * die dieselbe Sache zweimal traegt, erzeugt sie darum nicht zweimal.
   */
  bestand: readonly KnowledgeObject[],
) => DublettenBefund;

/** Warum ein Eintrag der Sicherung nicht in den Bestand ging. */
export type UebersprungenGrund = "identisch" | "aehnlich" | "pruefung_nicht_moeglich";

export interface UebersprungenerImport {
  titel: string;
  grund: UebersprungenGrund;
  /**
   * Das getroffene Wissensobjekt. `null` heisst ehrlich „es wurde keins ermittelt" — bei
   * `pruefung_nicht_moeglich` gab es gar keine Entscheidung, nicht etwa keinen Treffer.
   */
  koId: string | null;
  /** Nur bei `aehnlich`: der Wert, mit dem die Pruefung entschieden hat. */
  aehnlichkeit?: number;
}

// ================================================================================================
// JOB 3050 — DIESELBE FRAGE AM REVIEW-KANDIDATEN, UND DIE ANTWORT SAGT, WORAUF.
// ================================================================================================
//
// `createImportCandidates` war von JOB 3023 ausdruecklich ausgenommen und verglich weiter Zeichen
// (`seen.has(`${title}|${statement}`)`). Das war keine Kosmetik: `duplicate` ist eine ENTSCHEIDUNG —
// bei `true` legt der `accept`-Zweig KEIN Wissensobjekt an. Ein falsches `false` erzeugte also
// wirklich die zweite Karteikarte, nur eine Reviewrunde spaeter als beim direkten Weg.
//
// WARUM EIN EIGENER TYP UND NICHT ZWEI FLACHE FELDER: jede Aussage haengt an ihrer Voraussetzung.
// Eine `koId` gibt es nur, wenn wirklich getroffen wurde; einen Aehnlichkeitswert nur, wenn die
// Pruefung gerechnet hat. Zwei optionale Felder neben einem `boolean` liessen die Kombination
// „Dublette ohne Treffer" typgueltig — genau die Behauptung ohne Voraussetzung, die das Produkt
// nicht ausgibt.
//
// WORAUF getroffen wurde, hat ZWEI Arten. Der Bestand traegt Wissensobjekte; eine Sicherung, die
// dieselbe Sache zweimal enthaelt, trifft aber auf einen KANDIDATEN desselben Laufs, der noch kein
// Wissensobjekt ist. Eine `koId` waere dort ein Verweis auf etwas, das es nicht gibt.
export type Dublettentreffer =
  | { readonly art: "wissensobjekt"; readonly koId: string }
  | { readonly art: "kandidat"; readonly kandidatId: string };

/**
 * Der Befund der Dublettenfrage an EINEM Kandidaten — vier Ausgaenge, nicht zwei.
 *
 * - `keine` — geprueft, kein Treffer. Der `accept` legt ein Wissensobjekt an.
 * - `identisch` — Pass 1, exakte Zeichengleichheit von `title|statement`.
 * - `aehnlich` — Pass 2, die injizierte `DublettenPruefung` hat entschieden.
 * - `pruefung_nicht_moeglich` — es gab GAR KEINE Entscheidung. Weder „Dublette" noch „keine
 *   Dublette" darf hier behauptet werden; der `accept` legt fail-closed kein Wissensobjekt an.
 * - `nicht_gestellt` — der externalId-Upsert-/Re-Sync-Strang (SCRUM-510 R2b): dort ist eine
 *   Bestandskollision per Entscheid ein Re-Sync und keine Dublette, die Textfrage wird also nicht
 *   gestellt. `duplicate` heisst dort ausschliesslich „dasselbe Quellobjekt zweimal in DIESEM Lauf".
 * - `im_papierkorb` — JOB 3081, s. unten.
 *
 * Die Woerter sind bewusst die von `UebersprungenGrund` (plus die Faelle, die es dort nicht geben
 * kann): dieselbe Frage, dieselbe Sprache auf beiden Importwegen.
 *
 * ------------------------------------------------------------------------------------------------
 * JOB 3081 — DER PAPIERKORB IST EIN ZUSTAND DES BESTANDS, KEIN LOCH IM BESTAND.
 * ------------------------------------------------------------------------------------------------
 *
 * `im_papierkorb` ist der FUENFTE Ausgang und gehoert AUSSCHLIESSLICH dem externalId-/Anker-Strang:
 * derselbe Herkunfts-Anker (`externalId` + `importProviderKey(provider)`) traegt ein Wissensobjekt,
 * das im PAPIERKORB liegt. Bis JOB 3081 stand hier `nicht_gestellt` — sachlich richtig fuer den
 * AKTIVEN Re-Sync, aber fuer den getrashten Fall zu wenig: der Reviewer entschied, ohne zu wissen,
 * dass die Sache schon einmal da war und weggeworfen wurde, und der `accept` legte eine ZWEITE
 * Karteikarte fuer dieselbe Sache an (Codex' Live-Messung R-0192 vom 05.09.2026).
 *
 * DER TREFFER IST DIE VORHANDENE FORM `{ art: "wissensobjekt", koId }` und nennt IMMER eine Kennung,
 * die es wirklich gibt — die des getrashten Objekts. Eine eigene Trefferart waere ein zweites Wort
 * fuer dieselbe Sache: das getroffene IST ein Wissensobjekt, es liegt nur im Papierkorb.
 *
 * VORRANG DES LEBENDEN: liegt derselbe Anker AKTIV im Bestand, bleibt es `nicht_gestellt` — der
 * Re-Sync ist unveraendert. `im_papierkorb` entsteht nur, wenn es kein aktives Gegenstueck gibt.
 */
export type KandidatDublettenbefund =
  | { readonly ergebnis: "keine" }
  | { readonly ergebnis: "identisch"; readonly treffer: Dublettentreffer }
  | {
      readonly ergebnis: "aehnlich";
      readonly treffer: Dublettentreffer;
      readonly aehnlichkeit: number;
    }
  | { readonly ergebnis: "pruefung_nicht_moeglich" }
  | { readonly ergebnis: "nicht_gestellt" }
  | { readonly ergebnis: "im_papierkorb"; readonly treffer: Dublettentreffer };

export interface ImportResult {
  imported: number;
  skipped: number;
  /**
   * JOB 3023: die nackte Zahl konnte weder sagen, WARUM etwas uebersprungen wurde, noch worauf es
   * getroffen ist. Rein ADDITIV — `imported`/`skipped` behalten Name und Bedeutung; `skipped` ist
   * weiterhin „nicht eingespielt" und damit stets `uebersprungen.length`.
   */
  uebersprungen: UebersprungenerImport[];
}

// SCRUM-510: quell-agnostischer Import-Vertrag. Ein Adapter (Confluence = #1, Jira-TEST später = #2)
// liest seine Quelle und liefert NORMALISIERTE ImportItems; der Import-Kern (createImportCandidates →
// acceptToKo) kennt die Quelle nicht. Neue Quelle = neuer Adapter, KEIN Umbau des Import-Kerns.
export interface SourceAdapter {
  // Menschlicher Quell-Name (z. B. "Confluence") — Provenienz/Diagnose.
  readonly source: string;
  collect(): Promise<ImportItem[]>;
}

// SCRUM-116: Import-/Source-Review-Kandidaten (JSON-Re-Import mit Review-Queue).
// WP-SHIP8-CLOSE-2 (bens F1): "in_bearbeitung" ist der TRANSIENTE Claim-Status einer laufenden
// Review-Aktion (Status-CAS 'neu' → 'in_bearbeitung' am Aktions-BEGINN). Er schützt den
// Kandidaten vor dem bedingten Cleanup-Delete, solange der Accept noch im KO-Schritt hängt;
// die Aktion persistiert am Ende den echten Endstatus (bzw. gibt den Claim bei Fehlern zurück).
export type ReviewStatus = "neu" | "in_bearbeitung" | "angenommen" | "abgelehnt" | "info-angefragt";
export type ReviewAction = "accept" | "reject" | "info";

export interface ImportCandidate {
  id: string;
  item: ImportItem;
  status: ReviewStatus;
  // JOB 3050: als Dublette ERKANNT — der `accept` legt dann kein Wissensobjekt an, überschreibt
  // aber auch nichts. Der überholte Wortlaut von SCRUM-116 („Gleiche title|statement existiert
  // bereits") stand hier bis JOB 3050 und war falsch: seither entscheidet nicht mehr allein die
  // Zeichengleichheit, sondern zusätzlich die injizierte `DublettenPruefung` (Pass 2).
  //
  // `false` heisst „NICHT als Dublette erkannt" — und ausdrücklich nicht „geprüft und sauber":
  // konnte die Prüfung nicht entscheiden, steht `false` hier und `pruefung_nicht_moeglich` in
  // `dublettenbefund`. Ob der `accept` ein Wissensobjekt anlegen darf, entscheidet deshalb NIE
  // dieses Feld allein, sondern `kandidatErzeugtWissensobjekt` (service.ts) — die eine Stelle.
  duplicate: boolean;
  // JOB 3050: WORAUF getroffen wurde und WOMIT entschieden wurde — additiv, JSON-persistiert
  // (JSONB-Spalte `data`, keine Migration). FEHLT das Feld, ist es ECHTER Altbestand (eingereiht
  // VOR JOB 3050); dann gilt allein `duplicate`, wie bisher.
  dublettenbefund?: KandidatDublettenbefund | undefined;
  note: string | null;
  // Bei „angenommen" und nicht-Dublette: das erzeugte Wissensobjekt.
  koId: string | null;
  createdAt: string;
  // WP-SHIP8-CLOSE-3 (bens ROT-1): Lease-Protokoll des Claims — beide Felder existieren NUR bei
  // status "in_bearbeitung" (resolveClaim räumt sie beim Abschluss immer aus).
  // opId = eindeutige Operations-Id GENAU DIESER Review-Aktion; der Accept stempelt sie ans neu
  // erzeugte KO (importOpId), BEVOR der Endstatus geschrieben wird — die Crash-Recovery erkennt
  // daran, ob die Operation vollendet werden muss (KO existiert) oder sicher neu startbar ist.
  opId?: string | undefined;
  // Lease-Beginn (ISO): erst nach Ablauf von REVIEW_CLAIM_LEASE_MS greift die Recovery — ein
  // LAUFENDER Claim wird nie angefasst.
  claimedAt?: string | undefined;
  // WP-SHIP8-CLOSE-7 (bens ROT-2): WER die Aktion geclaimt hat und WELCHE — im selben Claim-CAS
  // persistiert. Die Crash-Recovery vollendet damit im Namen des ECHTEN Reviewers (reviewedBy =
  // claimedBy) statt anonym als System; resolveClaim räumt beide Felder wie opId/claimedAt aus.
  // Altclaims (vor CLOSE-7) haben die Felder nicht — die Recovery fällt dann EHRLICH auf
  // reviewedBy "system" mit Kennzeichnung zurück.
  claimedBy?: string | undefined;
  claimedAction?: ReviewAction | undefined;
  // WP-SHIP8-CLOSE-6 (bens ROT-3a): WER/WANN der Review-Entscheidung — IM SELBEN Statuswrite
  // persistiert (resolveClaim) und damit unverlierbar im Produktbestand, unabhängig vom
  // Aktionsaudit.
  reviewedBy?: string | undefined;
  reviewedAt?: string | undefined;
  // WP-SHIP8-CLOSE-7 (bens GELB): die Aktion WIRKLICH persistiert (nicht aus dem Status
  // abgeleitet) — beim Abschluss aus der geclaimten Aktion übernommen.
  reviewedAction?: ReviewAction | undefined;
  // WP-SHIP8-CLOSE-6 (bens ROT-3b/3c): SCHWEBENDER Aktionsbeleg — gesetzt, wenn der
  // import.candidate-<action>-Audit NACH dem persistierten Statuswechsel fehlschlug. Trägt alles
  // für den exactly-once-Nachzug (recordOnce mit dieser eventId) beim nächsten Queue-Load; die
  // API-Antwort weist den Schwebezustand über die PRÄSENZ des Felds aus (Muster Cleanup
  // auditFailed). Nach gelungenem Nachzug wird die Markierung gelöscht.
  // WP-SHIP8-CLOSE-8 (bens GELB-1): optionaler, begrenzter Beleg-Payload (z. B. recovered/
  // recoveredBy/reviewerUnknown der Recovery-Vollendung) — der Retry übernimmt ihn UNVERÄNDERT,
  // damit die Recovery-Kennzeichnung den Nachzug überlebt.
  auditPending?:
    | {
        eventId: string;
        action: ReviewAction;
        actor: string;
        payload?: Record<string, unknown> | undefined;
      }
    | undefined;
}

// WP-SHIP8-FIX (bens F2): CLEANUP_DRIFT = die bestätigte Aufräum-Zielmenge (Vorschau-Digest)
// stimmt nicht mehr mit dem Bestand überein — die Route antwortet 409, nichts wird verändert.
// WP-SHIP8-CLOSE-2 (bens F1): CONFLICT = ein Persistenz-Write traf 0 Zeilen (der Kandidat ist
// zwischenzeitlich verschwunden) — ehrlicher Abbruch statt stillem Ok.
// W2-A (BEN-33 Befund B): CONFLICT traegt zusaetzlich den zweiten Fall derselben Art — ein
// Persistenz-Write, der an einer bereits vergebenen SCHLUESSELIDENTITAET scheitert, naemlich eine
// `sourceRecordId`, die schon zu einer anderen Quellrevision gehoert. BEWUSST KEIN neuer Code:
// beide Faelle sind derselbe Satz („der Bestand sagt nein, es wurde nichts geschrieben"), und ein
// eigener Code waere ein Vertragswert, den heute niemand auf einen HTTP-Status abbildet.
export type LibraryErrorCode =
  | "NOT_FOUND"
  | "ALREADY_REVIEWED"
  | "BAD_REQUEST"
  | "CLEANUP_DRIFT"
  | "CONFLICT";

export class LibraryError extends Error {
  readonly code: LibraryErrorCode;

  constructor(code: LibraryErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LibraryError";
  }
}

// FR-LIB-03: Bus-Faktor — Domänen/Kategorien mit Einzelquelle.
export interface BusFactorEntry {
  category: string;
  authorCount: number;
  koCount: number;
  singleSource: boolean;
}

// Consultant-System (Experten-Matching): Thema → beitragende Personen — als Hilfe „wen könnte man zu
// diesem Thema einbeziehen". BEWUSST nur Thema→Person (kein Personen-Profil), ohne Score/Trust/
// Rangfolge/Zeitreihe (anti-Gamification). `koCount` ist reiner Kontext, KEINE Sortier-/Ranggröße.
export interface ExpertiseContributor {
  authorId: string;
  koCount: number;
}

export interface ExpertiseEntry {
  category: string;
  contributors: ExpertiseContributor[];
}

// FR-LIB-04: Wissensgraph.
export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphEdge {
  a: string;
  b: string;
  via: string;
}

// JOB 3022: der Graph nennt seine Grenzen. `nodes`/`edges` behalten Namen und Form — die vier
// neuen Felder kommen additiv dazu, damit ein Leser eine gedeckelte Antwort von einer
// vollständigen unterscheiden kann. Vorher konnte er das nicht: 5.000 Kanten sahen aus wie
// „alle Kanten", und ein wegen Allgegenwart übergangenes Schlagwort verschwand spurlos.
export interface Graph {
  // Alle sichtbaren Objekte, nach Id sortiert. NICHT gedeckelt — der Deckel liegt auf den Kanten.
  nodes: GraphNode[];
  // Höchstens `edgeLimit` Kanten, deterministisch sortiert (a, dann b).
  edges: GraphEdge[];
  // Kanten NACH Sichtbarkeits- UND Ubiquitätsfilter, VOR dem Deckel — die Zahl verrät nie ein
  // Objekt, das der Aufrufer nicht sehen darf, und zählt keine verworfene Kante mit.
  totalEdges: number;
  truncated: boolean;
  // Der WIRKSAME Deckel als Zahl in der Antwort. Bewusst hier und nicht als Modul-Export: der
  // Wert gehört zu DIESER Antwort, und ein Export ohne Aufrufer wäre toter Code (Aufrufer-Wächter).
  edgeLimit: number;
  // Schlagwörter, die wegen Allgegenwart KEINE Kante erzeugen (z. B. `pilot-demo`), sortiert —
  // dieselbe Regel und dieselbe Ehrlichkeit wie in `Neighborhood.excludedTags`.
  excludedTags: string[];
}

// AUFTRAG-mega68: die Nachbarschaft EINES Wissensobjekts — die Anwendersicht des Wissensnetzes.
// BEWUSST ein eigener Vertrag neben `Graph` (FR-LIB-04): die Nachbarschaft hängt an EINEM Objekt
// und nennt an jeder Kante das WARUM (alle geteilten Schlagwörter), der globale Graph zeigt den
// ganzen sichtbaren Bestand mit je einem Schlagwort pro Kante.
// JOB 3022: bis dahin stand hier, der globale Graph rechne „über den ganzen Bestand (O(n²)) und
// bleibt unangetastet (Register H5)". Das ist nicht mehr wahr — `graph()` baut denselben
// Schlagwort-Index wie diese Auskunft, wendet dieselbe Ubiquitätsregel an und ist gedeckelt.
export interface NeighborKo {
  id: string;
  title: string;
  status: KoStatus;
  // Die geteilten, NICHT-ubiquitären Schlagwörter — das sichtbare „warum" der Kante, sortiert.
  via: string[];
}

export interface Neighborhood {
  center: { id: string; title: string; status: KoStatus };
  // Gedeckelt (NEIGHBOR_LIMIT) und deterministisch sortiert: meiste geteilte Schlagwörter zuerst.
  neighbors: NeighborKo[];
  // Nachbarn NACH dem Vertraulichkeits-Filter, VOR dem Deckel — der Zähler verrät nie ein
  // Objekt, das der Aufrufer nicht sehen darf.
  total: number;
  truncated: boolean;
  // Schlagwörter des Zentrums, die wegen Ubiquität KEINE Kante erzeugen (z. B. `pilot-demo`) —
  // ehrlich ausgewiesen, damit die Fläche den Filter sichtbar begründen kann.
  excludedTags: string[];
}

// FR-ANA-01: Kennzahlen.
export interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

// ================================================================================================
// AUFTRAG-mega76 BLOCK D — DIE SICHTBARKEITSENTSCHEIDUNG ALS DATUM.
// ================================================================================================
//
// Die Entscheidung „darf dieser Mensch dieses Objekt sehen" fällt in der Kompositionswurzel
// (services/app/src/sichtbarkeit.ts) und reist von dort als PRÄDIKAT in die Dienste — nie als
// Rolle, nie als Boolescher `includeConfidential`-Schalter. Der Grund steht dort ausführlich:
// seit Variante A hängt die Sichtbarkeit auch am Autor, und ein Flag kann „vertrauliches, aber
// eigenes Objekt" nicht ausdrücken. Ein Dienst, der ein Flag bekäme, müsste die Regel ein zweites
// Mal auslegen.
//
// BEWUSST NICHT OPTIONAL, wo dieser Typ verlangt wird. Genau daran ist mega74 gescheitert: ein
// optionaler Schutz ist ein angebotener Schutz, und ein zweiter Aufbau darf ihn dann typgültig
// weglassen, ohne dass es jemand merkt.
export type KoSichtbar = (ko: KnowledgeObject) => boolean;

// ================================================================================================
// W2-A (KW-W2-17, Zeilen 18-41) — DIE QUELLREVISION ALS UNVERAENDERLICHER GEGENSTAND
// ================================================================================================
//
// WAS HIER ENTSTEHT UND WAS AUSDRUECKLICH NICHT. `KW-W2-17` fuehrt fuer den ersten W2-Schnitt KEIN
// universelles Dokumentaggregat ein, sondern einen begrenzten, revisionsgebundenen und
// UNVERAENDERLICHEN `ExternalSourceRecord`. Genau der steht hier — mit exakt den zehn kanonischen
// Feldern, keinem mehr und keinem weniger.
//
// WARUM IM VORHANDENEN MODUL. `library-analytics` besitzt bereits die Kandidaten-Persistenz und
// den Accept-Pfad; die Quellrevision gehoert in denselben Datenraum. Ein neuer Top-Level-Service
// waere die zweite Importdomaene, die `KW-W2-17` Zeile 11 und 102 verbieten.
//
// ZWEI IDENTITAETEN, die nicht verwechselt werden duerfen (Zeilen 35-37):
//   · FACHLICHE Quellenidentitaet  = sourceSystem + externalId          („welche Seite")
//   · REVISIONSIDENTITAET          = sourceSystem + externalId + sourceVersion  („welcher Stand")
// `sourceRecordId` ist die stabile INTERNE Klarwerk-Id und NIE ein Ersatz fuer eine der beiden.
//
// UNVERAENDERLICH heisst hier woertlich: der Repo-Vertrag (repo.ts) kennt bewusst KEINE
// Update-Operation. Eine neue Confluence-Version erzeugt eine NEUE Zeile; alte Revisionen werden
// nie ueberschrieben (Zeilen 38-39).
export interface ExternalSourceRecord {
  /** Stabile interne Klarwerk-Id dieser Revision. */
  readonly sourceRecordId: string;
  /** Das Quellsystem, z. B. "Confluence". Teil beider Identitaeten. */
  readonly sourceSystem: string;
  /** Die Kennung des Quellobjekts im Quellsystem (Confluence: die pageId). */
  readonly externalId: string;
  /** Die Version des Quellobjekts (Confluence: version.number). */
  readonly sourceVersion: number;
  /** Die absolute Quell-URL, falls die Quelle eine liefert. */
  readonly url: string | null;
  /** Der Titel des Quellobjekts zum Zeitpunkt dieser Revision. */
  readonly title: string;
  /**
   * Der VERWEIS auf den Roh-/Renderinhalt dieser Revision — nicht der Inhalt selbst.
   *
   * `KW-W2-17` nennt das Feld `rawOrRenderedContentReference`. Ob dahinter spaeter eine
   * Objektspeicher-Kennung, ein Dateiname oder ein anderer Anker steht, ist BEWUSST offen und
   * gehoert nicht in diesen Schnitt (PLAN-…-24 §10, offene Frage 4). `null` heisst ehrlich:
   * fuer diese Revision liegt kein Inhaltsverweis vor — nicht „der Inhalt ist leer".
   */
  readonly rawOrRenderedContentReference: string | null;
  /** Zeitpunkt der Aufnahme dieser Revision in Klarwerk (ISO). */
  readonly importedAt: string;
  /** Inhaltsabdruck dieser Revision — Vorbild: content_hash der Suchprojektion. */
  readonly contentHash: string;
  /**
   * Quellseitige Zusatzangaben (Space/Container, Elternpfad, Aenderungszeitpunkt, …).
   *
   * BEWUSST ein offener Sack und KEIN durchdeklariertes Schema: was eine Quelle mitliefert,
   * unterscheidet sich je Adapter, und ein festes Feld je Quelle waere der Anfang der
   * quell-spezifischen Sonderbehandlung, die der Import-Kern seit SCRUM-510 vermeidet.
   */
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
}

// ================================================================================================
// AUFTRAG-144 (KW-S4-26 §59-114, KW-S4-28 F1/F2/F3) — DER IMPORTLAUF ALS GEGENSTAND MIT LEBENSLAUF
// ================================================================================================
//
// WARUM HIER UND NICHT IN `services/app`. `KW-S4-28 F1` entscheidet den Eigentuemer: `ImportRun`,
// `ImportRunItemRef`, ihre Typen, Repos und Schemata liegen bei `ExternalSourceRecord` und
// `ImportCandidate` in `library-analytics`. `services/app` bleibt Kompositionswurzel und
// Orchestrierungsadapter und besitzt KEINE eigene Laufpersistenz — sonst gaebe es zwei
// Fachwahrheiten ueber denselben Lauf.
//
// WAS DIESER SCHNITT NICHT IST: kein sichtbares W2-A, kein Feature-Gate, keine Route, keine
// Navigation. Er ist die Domaenen- und Persistenzbasis darunter — allein nicht auslieferbar.

/**
 * Die kanonische Statusmenge aus `KW-S4-26` §77-87 — EXAKT diese neun, in dieser Reihenfolge.
 *
 * BEWUSST eine geschlossene Liste und kein offener String. Waere sie „mindestens diese", koennte
 * ein zehnter, erfundener Zustand still dazukommen, und die Oberflaeche muesste ihn deuten. Nur
 * `COMPLETED` ist voller Erfolg (§89-90); `PARTIAL`, `FAILED` und alles Unbekannte duerfen nie als
 * vollstaendiges Ergebnis erscheinen.
 */
export const IMPORT_RUN_STATUSES = [
  "QUEUED",
  "FETCHING",
  "PERSISTING_SOURCE",
  "EXTRACTING",
  "CREATING_KNOWLEDGE",
  "ANALYZING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const;

export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];

/** Fail-closed: alles, was nicht wortgleich in der kanonischen Liste steht, ist kein Status. */
export function istImportRunStatus(wert: unknown): wert is ImportRunStatus {
  return typeof wert === "string" && (IMPORT_RUN_STATUSES as readonly string[]).includes(wert);
}

/**
 * JOB-924: DIE ZWEITE FAIL-CLOSED GRENZE DIESER DOMAENE — ein GUELTIGER Abschlusszeitpunkt.
 *
 * `ImportRun.completedAt` ist im Vertrag ein freier String, weil die Ablage ihn roh durchreicht:
 * JSONB kennt keinen Zeitstempeltyp, und ein Altbestand kann alles enthalten. Wer aus diesem Feld
 * eine AUSSAGE macht („zuletzt erfolgreich verbunden"), braucht deshalb eine eigene Grenze — sonst
 * wird aus unbrauchbarem Text eine Zahl, die wie Wissen aussieht.
 *
 * WARUM NICHT `Date.parse` ALLEIN: `Date.parse("2026")` ist gueltig und ergaebe den 1. Januar —
 * eine erfundene Genauigkeit aus einer Jahreszahl. WARUM NICHT DIE FORM ALLEIN: `2026-13-45T…`
 * hat die richtige Form und bezeichnet keinen Tag. Deshalb beides.
 */
const IMPORT_ZEITPUNKT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export function istImportZeitpunkt(wert: unknown): wert is string {
  if (typeof wert !== "string" || !IMPORT_ZEITPUNKT.test(wert)) {
    return false;
  }
  return Number.isFinite(Date.parse(wert));
}

/**
 * Was mit EINEM Element des Laufs geschehen ist. `CREATED` = ein Wissensobjekt ist entstanden,
 * `BOUND` = ein vorhandenes wurde gebunden, `SKIPPED` = bewusst uebergangen (z. B. Dublette),
 * `FAILED` = an diesem Element gescheitert. Der Lauf als Ganzes bleibt davon unberuehrt: erst die
 * Summe der Elementtatsachen entscheidet ueber `COMPLETED`/`PARTIAL`/`FAILED` (§137).
 */
export const IMPORT_ITEM_OUTCOMES = ["CREATED", "BOUND", "SKIPPED", "FAILED"] as const;

export type ImportItemOutcome = (typeof IMPORT_ITEM_OUTCOMES)[number];

export function istImportItemOutcome(wert: unknown): wert is ImportItemOutcome {
  return typeof wert === "string" && (IMPORT_ITEM_OUTCOMES as readonly string[]).includes(wert);
}

/**
 * Die ehrliche Zusammenfassung der PERSISTIERTEN Elementtatsachen — nie deren Ersatz.
 *
 * `KW-S4-26` §177-179 sagt es woertlich: „Zaehler allein sind keine Resultatdatenquelle." Sie
 * duerfen aus den persistierten `ImportRunItemRef` berechnet oder transaktional mit ihnen
 * fortgeschrieben werden, ersetzen aber niemals die referenzierbaren Einzelergebnisse.
 */
export interface ImportRunCounters {
  readonly itemsTotal: number;
  readonly itemsCreated: number;
  readonly itemsBound: number;
  readonly itemsSkipped: number;
  readonly itemsFailed: number;
}

export interface ImportRun {
  /** Die stabile Kennung dieses Laufs. Primaerschluessel in beiden Ablagen. */
  readonly importId: string;
  readonly sourceSystem: string;
  /**
   * Das konkrete Quellobjekt — ODER `null`, wenn der Lauf einen Container umfasst. Dann traegt
   * `sourceScope` den expliziten Importauftrag. Beide zugleich `null` waere ein Lauf ohne Scope
   * und ist verboten (`pruefeImportRun`).
   */
  readonly externalId: string | null;
  readonly sourceScope: string | null;
  /** Die angeforderte Quellversion, falls der Auftrag eine nennt. */
  readonly requestedSourceVersion: number | null;
  readonly status: ImportRunStatus;
  /** Die im Lauf persistierte Quellrevision — `null`, solange sie nicht geschrieben ist. */
  readonly sourceRecordId: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly failureCode: string | null;
  /** SANITISIERT (`sanitizeImportFailureReason`) — nie roh, nie mit Secret oder Quellinhalt. */
  readonly failureReason: string | null;
  readonly counters: ImportRunCounters;
}

/**
 * Der Kindvertrag des Laufs (`KW-S4-26` §92-110) — geordnet, persistent und ausschliesslich aus
 * kanonischen IDs.
 *
 * ER KOPIERT NICHTS. Kein KO-Inhalt, keine Validierungsentscheidung, kein Konfliktobjekt, keine
 * Wissensluecke. Die Feldmenge SELBST ist diese Zusicherung: was hier nicht steht, kann auch nicht
 * versehentlich zur zweiten Wahrheit werden. Validierung, Konflikte und Gaps werden serverseitig
 * ueber diese Referenzen aus ihren autoritativen Domaenen GELESEN (§112-114).
 */
export interface ImportRunItemRef {
  readonly importId: string;
  /** Die stabile Ordnung INNERHALB des Laufs, ab 0. Sie ist die Reihenfolge, nicht die Einfuegezeit. */
  readonly ordinal: number;
  readonly sourceRecordId: string | null;
  readonly candidateItemId: string;
  /** Das entstandene bzw. gebundene Wissensobjekt — `null`, solange keines existiert. */
  readonly knowledgeObjectId: string | null;
  readonly itemOutcome: ImportItemOutcome;
  readonly itemFailureCode: string | null;
}

// ================================================================================================
// KW-S4-28 F2/F3 — ZWEI ZUSTANDS-/WERTEPAARE, DIE NUR GEMEINSAM WAHR SIND
// ================================================================================================
//
// Beide Paare folgen derselben Haltung: `null` ist eine AUSSAGE („dazu kann das System nichts
// sagen") und nie ein Platzhalter fuer „leer". Der Server setzt beide Felder; der Client darf
// weder umdeuten noch ableiten. Unbekannte oder widerspruechliche Paare sind fail-closed (§96-99)
// — sie duerfen keine Resultatflaeche aktivieren.

export type KnowledgeGapRelationState = "AVAILABLE" | "RELATION_NOT_AVAILABLE";

export interface KnowledgeGapBinding {
  readonly knowledgeGapRelationState: KnowledgeGapRelationState;
  readonly knowledgeGapIds: string[] | null;
}

export type ContentReferenceState = "AVAILABLE" | "NOT_CAPTURED";

export interface ContentReferenceBinding {
  readonly contentReferenceState: ContentReferenceState;
  readonly rawOrRenderedContentReference: string | null;
}

/**
 * `RELATION_NOT_AVAILABLE -> null` · `AVAILABLE -> [] | kanonische IDs` (`KW-S4-28` §46-49).
 *
 * DER UNTERSCHIED, DEN DIESE PRUEFUNG SCHUETZT: `[]` heisst „eine autoritative Relation ist da und
 * liefert fuer dieses KO keine Luecken". `null` heisst „es gibt diese Relation nicht". Ein `[]`
 * ohne Relation saehe aus wie „keine Wissensluecken" und waere eine Behauptung, die niemand belegen
 * kann — §103 verbietet ihn deshalb ausdruecklich.
 */
export function pruefeGapBindung(bindung: KnowledgeGapBinding): void {
  const zustand = bindung.knowledgeGapRelationState;
  const ids = bindung.knowledgeGapIds;
  if (zustand === "RELATION_NOT_AVAILABLE") {
    if (ids !== null) {
      throw new LibraryError(
        "BAD_REQUEST",
        "RELATION_NOT_AVAILABLE verlangt knowledgeGapIds = null — eine Liste ohne autoritative Relation waere eine unbelegbare Aussage.",
      );
    }
    return;
  }
  if (zustand === "AVAILABLE") {
    if (!Array.isArray(ids)) {
      throw new LibraryError(
        "BAD_REQUEST",
        "AVAILABLE verlangt eine Liste kanonischer Gap-IDs (auch die leere) — null waere die Gegenrichtung derselben Luecke.",
      );
    }
    if (ids.some((id) => typeof id !== "string" || id.trim() === "")) {
      throw new LibraryError(
        "BAD_REQUEST",
        "AVAILABLE verlangt ausschliesslich nicht-leere kanonische Gap-IDs.",
      );
    }
    return;
  }
  throw new LibraryError(
    "BAD_REQUEST",
    `Unbekannter knowledgeGapRelationState ${JSON.stringify(zustand)} — unbekannt ist fail-closed, nicht wohlwollend.`,
  );
}

/**
 * `NOT_CAPTURED -> null` · `AVAILABLE -> nicht-leere kanonische Referenz` (`KW-S4-28` §82-85).
 *
 * `null` heisst NIE „der Inhalt war leer", sondern: fuer diese unveraenderliche Quellrevision wurde
 * kein Roh-/Renderinhalt erfasst. Die leere Zeichenkette als Ersatz ist ausdruecklich verboten
 * (§105) — sie sieht wie eine Referenz aus und ist keine.
 */
export function pruefeInhaltsreferenzBindung(bindung: ContentReferenceBinding): void {
  const zustand = bindung.contentReferenceState;
  const referenz = bindung.rawOrRenderedContentReference;
  if (zustand === "NOT_CAPTURED") {
    if (referenz !== null) {
      throw new LibraryError(
        "BAD_REQUEST",
        "NOT_CAPTURED verlangt rawOrRenderedContentReference = null — auch die leere Zeichenkette ist kein Ersatz.",
      );
    }
    return;
  }
  if (zustand === "AVAILABLE") {
    if (typeof referenz !== "string" || referenz.trim() === "") {
      throw new LibraryError(
        "BAD_REQUEST",
        "AVAILABLE verlangt eine nicht-leere kanonische Inhaltsreferenz.",
      );
    }
    return;
  }
  throw new LibraryError(
    "BAD_REQUEST",
    `Unbekannter contentReferenceState ${JSON.stringify(zustand)} — unbekannt ist fail-closed.`,
  );
}

/** Obergrenze des persistierten Fehlergrunds — ein Grund ist ein Satz, kein Protokoll. */
export const IMPORT_FAILURE_REASON_MAX_CHARS = 300;

/**
 * Macht aus einem rohen Fehlertext einen SPEICHERBAREN Grund (`KW-S4-26` §138).
 *
 * ZWEI QUELLEN VON UNGEWOLLTEM: Abfrageteile von URLs tragen Token und Schluessel; zitierte
 * Abschnitte tragen Quellinhalt. Beide werden entfernt, nicht maskiert — ein maskiertes Geheimnis
 * ist immer noch ein gespeichertes Geheimnis.
 *
 * EHRLICHE GRENZE: das ist die LETZTE Verteidigungslinie, keine Erlaubnis, Geheimnisse bis hierher
 * zu tragen. Wer einen Fehlergrund baut, laesst Token gar nicht erst hinein.
 */
export function sanitizeImportFailureReason(roh: string): string {
  const ohneAbfrage = roh.replace(/((?:https?|ftp):\/\/\S*?)\?\S*/gi, "$1?…");
  const ohneZitate = ohneAbfrage.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "…");
  const geglaettet = ohneZitate.replace(/\s+/g, " ").trim();
  return geglaettet.length > IMPORT_FAILURE_REASON_MAX_CHARS
    ? `${geglaettet.slice(0, IMPORT_FAILURE_REASON_MAX_CHARS)}…`
    : geglaettet;
}
