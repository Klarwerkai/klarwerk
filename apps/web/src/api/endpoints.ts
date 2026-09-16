import type { ReasonerLocale } from "../lib/reasonerLocale";
// WP-RETEST7 R8: Timeout-Konstante der Folien-Konvertierung (eine Quelle, lib/slideImages).
import { SLIDES_CONVERT_TIMEOUT_MS } from "../lib/slideImages";
import { ApiError, api } from "./client";
import type {
  AiCheckCoverageSummary,
  Analytics,
  AnswerResult,
  // JOB 4154 (WIKI-GESAMTANWEISUNG): der Drahtvertrag der zusammengesetzten Anweisung.
  Anweisung,
  AnweisungKopfEingabe,
  AnweisungLesestand,
  AnweisungStaende,
  AnweisungVergleich,
  AskResponse,
  AssignmentSummary,
  AssistPreset,
  AssistResult,
  AuditEntry,
  AuditVerifyReport,
  BeziehungSetzenBody,
  BeziehungWiderrufBody,
  BusFactorEntry,
  Confidentiality,
  Conflict,
  ConflictSelfTestResult,
  ConflictType,
  DemoPackageListResponse,
  DemoPackagePreview,
  DemoPackageResult,
  DemoSeedResult,
  DescribeImageResult,
  Draft,
  DraftPayload,
  DuplicateSelfTestResult,
  EigenerBefund,
  EnrichResult,
  EvidenceRecord,
  ExampleLoadResponse,
  ExpertiseEntry,
  ExternalKnowledgeStage,
  ExternalResult,
  ExtractResult,
  FeatureFlags,
  Gap,
  GapPriority,
  GapSummary,
  Graph,
  ImpactReport,
  ImportAccessStatus,
  ImportApplyResponse,
  ImportCandidate,
  ImportCleanupPreview,
  ImportCleanupResult,
  ImportExploreResponse,
  ImportGroupResponse,
  ImportItemInput,
  ImportRunRecord,
  ImportRunStartResponse,
  ImportSelectCriteria,
  ImportSelectResponse,
  InterviewResult,
  KandidatenLesevariante,
  KnowledgeCheckResult,
  KnowledgeObject,
  KoComment,
  KoVersionSnapshot,
  KuratierteKanteAnsicht,
  KuratierteKanten,
  LearningPath,
  Lesevariante,
  LesevariantenLadeBilanz,
  LesevariantenUebersicht,
  LibraryImageSearchResponse,
  LiveWall,
  ManagementSnapshot,
  MediaAnalysis,
  ModelRunRecord,
  MyImpact,
  Neighborhood,
  Notification,
  ObjectContent,
  ObjectRef,
  OutputDocument,
  OutputKind,
  OutputSource,
  OverlapEntry,
  OverlapSettings,
  PublicUser,
  ReasonerConfigStatus,
  ReasonerProbeResult,
  ReasonerStatus,
  ReviewAction,
  Role,
  SicherungenAuskunft,
  Sichtmetrik,
  SlideConvertResponse,
  StructureResult,
  TrashedKo,
  UploadLimits,
  ValidationBoardKo,
  ValidationSettings,
  Verdict,
} from "./types";

function qs(params?: Record<string, string | undefined>): string {
  if (!params) {
    return "";
  }
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) {
    return "";
  }
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`;
}

export type KoFilter = { type?: string; status?: string; category?: string; tag?: string };

// SCRUM-502 Round 4: die Einstufung ist an den VERARBEITETEN Text gebunden. Da die Reasoner-Aktionen
// immer client-gelieferten Text bearbeiten (Editor/Upload, nie den gespeicherten KO-Body), deklariert
// der Client die AKTUELLE Stufe des Textes selbst:
//  - source "draft":              getippter/bearbeiteter Text (Capture, Studio, KnowledgeDetail-Editor).
//  - source "transient-document": hochgeladener Dokumenttext (BodyExtractPanel/„Aus Datei").
// `confidentiality` ist Pflicht (inkl. "intern"). Optionale `koId` ist NUR ein hebender Backstop
// (Downgrade-Schutz eines gespeichert-vertraulichen KOs), NIE ein Freigabe-Anker.
// JOB 2692 D2 (Review-Befund 17): `draftId` — die Kennung des GESPEICHERTEN Entwurfs, aus dem der
// Text oder das Bild stammt. Der Server laedt dazu die gespeicherte Stufe als zweiten hebenden
// Backstop (sie hebt, sie senkt nie). Ohne aufloesbaren Anker (weder `draftId` noch `koId`) gilt
// `source:"draft"` serverseitig als vertraulich — die Deklaration allein reicht nicht mehr.
export type ReasonerProvenance = {
  source: "draft" | "transient-document";
  confidentiality: Confidentiality;
  nichtEingestuft?: true;
  koId?: string;
  draftId?: string;
};

function provenanceFields(p: ReasonerProvenance): Record<string, string | true> {
  return {
    source: p.source,
    confidentiality: p.confidentiality,
    ...(p.nichtEingestuft === true ? { nichtEingestuft: true as const } : {}),
    ...(p.koId ? { koId: p.koId } : {}),
    ...(p.draftId ? { draftId: p.draftId } : {}),
  };
}

// ================================================================================================
// JOB 4146 (WIKI-DISKUSSION) — DER BEITRAG, WIE IHN DIE DISKUSSIONSFLÄCHE LIEST.
// ================================================================================================
//
// Spiegel der drei ANZEIGBAREN Ergänzungen aus `services/knowledge-object/src/types.ts` (`KoComment`).
// Der Beitragsschlüssel (`clientKey`) steht bewusst NICHT darin: er ist ein Deduplizierer des
// Absendens und keine Auskunft, die eine Fläche zeigen dürfte.
//
// WARUM HIER UND NICHT IN `api/types.ts`: ALLE drei Felder sind optional, und `KoComment` bleibt
// deshalb zuweisbar — die Lesefläche nimmt `ko.comments` unverändert entgegen und liest die Felder,
// wo sie da sind. Ein Pflichtfeld am gemeinsamen Typ hätte die beiden ANDEREN Träger dieser Liste
// (Prüf-Feedback, Quellenmeldung) mitgezogen, ohne dass sie etwas davon haben.
//
// „FEHLT" HEISST FEHLT, an jedem der drei: kein `koVersion` bedeutet UNBEKANNTER Fassungsbezug (nie
// „die aktuelle"), kein `replyTo` bedeutet Anfang eines Fadens, kein `resolution` bedeutet, dass
// über diesen Faden noch nie jemand entschieden hat — nicht „offen entschieden".
export interface KoDiskussionsbeitrag extends KoComment {
  replyTo?: string;
  koVersion?: number;
  resolution?: { state: "erledigt" | "offen"; by: string; at: string };
}

// PUT /api/kos/:id — ein Mutations-Endpunkt, per {action} verzweigt.
export type KoAction =
  | { action: "rate"; verdict: Verdict }
  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die Validierung komplett ab.
  | { action: "admin-validate" }
  | { action: "assign"; userIds: string[] }
  // ================================================================================================
  // JOB 3667 R3 — `expectedVersion` AM REVISE: DER BEDINGTE SCHREIBZUGRIFF, VOM CLIENT AUS NUTZBAR.
  // ================================================================================================
  // Der Server nimmt ihn seit Runde 2 an (`ko-routes.ts:2073`) und prüft ihn im Dienst, in derselben
  // Transaktion, in der geschrieben wird. OPTIONAL, weil er es dort auch ist: ohne das Feld bleibt
  // `revise` unbedingt wie bisher — kein Aufrufer im Haus ändert sein Verhalten, weil dieser Typ
  // wächst. Wer ihn MITSCHICKT, bekommt statt eines stillen Überschreibers ein 409 `KO_STALE`.
  // ================================================================================================
  // JOB 4213 (WIKI-NACHVOLLZIEHEN) — `restoredFromVersion`: DIESE REVISION HOLT EINEN STAND ZURÜCK.
  // ================================================================================================
  //
  // KEINE ZWEITE SCHREIBTÜR. Die Übernahme einer alten Fassung ist eine Überarbeitung wie jede
  // andere — derselbe Endpunkt, dieselbe Aktion, derselbe bedingte Schreibzugriff über
  // `expectedVersion`. Das Feld sagt dem Dienst nur, WOHER der mitgeschickte Inhalt stammt; er prüft
  // die Zahl gegen den Bestand und schreibt sie als Herkunft in die Historie
  // (`services/knowledge-object/src/service.ts`, `pruefeHerkunft` / `naechsteFassung`).
  //
  // ES STEHT AN `changes` UND NICHT DANEBEN, weil die Route genau dieses Objekt durchreicht
  // (`ko-routes.ts`: `const { sources: _ignoredSources, ...changes } = body.changes ?? {}`). Ein
  // Feld neben `changes` verlangte eine Routenänderung — und die ist hier ausdrücklich nicht der Weg.
  //
  // ES ÜBERTRÄGT KEINE FREIGABE: Prüfstand und Vertrauenswert setzt der Dienst, nicht dieser Aufruf.
  // Eine zurückgeholte Fassung steht auf `offen`, auch wenn die übernommene freigegeben war.
  //
  // RUNDE 3 · UND ES ÜBERTRÄGT AUCH KEINEN INHALT MEHR. Eine Übernahme schickt AUSSCHLIESSLICH
  // `restoredFromVersion` — kommt ein Inhaltsfeld daneben, weist der Dienst den Aufruf mit 400 ab
  // (`KoService.pruefeUebernahmeEingabe`). Der Inhalt wird aus der abgelegten Fassung geholt, und
  // damit IST die Herkunftsangabe wahr, statt geglaubt zu werden. Der Typ bleibt trotzdem der
  // gemeinsame `DraftPayload`-Schnitt: dieselbe Aktion trägt weiterhin jede gewöhnliche Revision,
  // und zwei Typen für einen Endpunkt wären zwei Verträge für eine Tür.
  | {
      action: "revise";
      changes: DraftPayload & { restoredFromVersion?: number };
      expectedVersion?: number;
    }
  // ================================================================================================
  // JOB 4146 (WIKI-DISKUSSION) — DER BEITRAG BEKOMMT ZWEI OPTIONALE BEGLEITER.
  // ================================================================================================
  //
  // `replyTo` — der Beitrag, auf den geantwortet wird. Der Server GLAUBT die Kennung nicht, er
  //   schlägt sie in der Beitragsliste DIESES Objekts nach (`KoService.addComment`); ein fremder
  //   oder erfundener Wert erzeugt gar keinen Beitrag, sondern ein 400.
  // `clientKey` — der Beitragsschlüssel dieses Absendevorgangs (Vertrag Fall 5). Er sorgt dafür,
  //   dass eine WIEDERHOLUNG nach unklarer Übertragung keinen zweiten Beitrag erzeugt. Reine
  //   Deduplizierung, keine Autorität — dieselbe Rolle wie `operationId` am Dokumentweg.
  //
  // BEIDE OPTIONAL, weil sie es am Server auch sind: ohne sie ist dies Zeichen für Zeichen der
  // bisherige Kommentarweg, den auch das Prüf-Feedback und die Quellenmeldung benutzen.
  | { action: "comment"; text: string; replyTo?: string; clientKey?: string }
  // JOB 4146: den Faden als geklärt markieren und wieder öffnen. GEKLÄRT, NICHT FREIGEGEBEN — am
  // Freigabestand des Wissensobjekts ändern beide nichts, und sie verlangen kein neues Recht
  // (dasselbe `requireUser` wie `comment`).
  | { action: "comment-resolve"; commentId: string }
  | { action: "comment-reopen"; commentId: string }
  | {
      action: "attach";
      attachment: {
        name: string;
        mime: string;
        dataUrl?: string;
        objectId?: string;
        thumbnail?: string;
        size?: number;
      };
    }
  | { action: "detach"; attachmentId: string }
  | { action: "category"; category: string }
  | { action: "tags"; tags: string[] }
  // SCRUM-415: Vertraulichkeitsstufe setzen/ändern (mit Audit).
  | { action: "confidentiality"; level: Confidentiality }
  | {
      action: "conflict";
      conflict: { koA: string; koB: string; type: ConflictType; description: string };
    }
  | { action: "resolve-conflict"; conflictId: string; decision: string }
  | { action: "transfer-author"; newAuthor: string }
  // AUFTRAG-mega15 Block B (bens SB-4): dieser Vertrag war schon richtig — falsch war der
  // Laufzeitpfad, der zusätzlich ein `provider` mitschickte, und der Server, der seine Stufen-
  // Sperre nach diesem Client-Feld ausrichtete. Beides ist jetzt aufgeräumt: die Herkunft leitet
  // der Server aus der Adresse ab. Der Weg zu dieser Aktion führt über `toAddSourceRequest`
  // (lib/koSource.ts).
  // AUFTRAG-mega16 Block A (bens SB-4, dritter Durchgang): `objectId` ist der ANKER einer
  // adresslosen Belegstelle — die Referenz auf ein Dokument, das DIESES Wissensobjekt bereits als
  // Anhang trägt. Der Server glaubt das Feld nicht, er prüft es gegen die eigene Anhangsliste; ein
  // erfundener Wert belegt nichts und hebt keine Sperre auf.
  | {
      action: "add-source";
      source: { label: string; url?: string; excerpt?: string; objectId?: string };
    }
  | { action: "remove-source"; sourceId: string }
  // AUFTRAG-mega18 Block A-1: die VERBUND-OPERATION „Dokumentinhalt übernehmen". Sie ersetzt die
  // Dreier-Kette attach → n× add-source → revise auf ALLEN Wegen (Artikel-Anhängen, KO-Detail,
  // Capture-Finalizer). Der Aufruf läuft NICHT über `ko.act`, weil die Antwort kein
  // KnowledgeObject ist, sondern ein COMMIT-ERGEBNIS: sie sagt, was tatsächlich gilt (Version,
  // Anker, Belegstellen) — s. `endpoints.ko.appendDocument`.
  | { action: "append-document"; appendDocument: DocumentAppendRequest }
  // ================================================================================================
  // JOB 3667 R3 — DIE ZWEI AKTIONEN DES RÜCKWEGS, DIE DER BROWSER BISHER NICHT AUFRUFEN KONNTE.
  // ================================================================================================
  //
  // Runde 2 hat die Accountregel am SERVER durchgesetzt: wer ein freigegebenes Wissensobjekt nicht
  // auch freigeben darf, bekommt am direkten `revise` ein 403 `PROPOSAL_REQUIRED` und soll statt
  // dessen einen an DASSELBE Objekt gebundenen Vorschlag einreichen. Das Word-Fenster tut das seit
  // Runde 2 — die Web-Fläche stand vor einer Sperre ohne Ausweg, weil dieser Vertrag die beiden
  // Aktionen nicht kannte. Ohne sie ist der Weg nicht aufrufbar; das ist der ganze Grund dieser Zeilen.
  //
  // `propose` — DER EINREICHWEG (Fall 2 und 3 der Accountregel).
  //   · `baseVersion` ist PFLICHT und ist der bedingte Schreibzugriff dieses Wegs: der Server hängt
  //     den Vorschlag nur an die Fassung, die der Einreicher wirklich gesehen hat, sonst 409
  //     `KO_STALE` (`service.ts:3787`). Ein Vorschlag an eine Fassung, die es nicht mehr gibt, wäre
  //     später nicht einzuordnen.
  //   · `bodyHtml` ist OPTIONAL und wird NUR mitgeschickt, wo ein Rumpf wirklich vorliegt. Der
  //     Server säubert ihn (`cleanBody`, `service.ts:3794`) — was ankommt, entscheidet er, nicht wir.
  //   · `clearBody` (R5) ist die AUSDRÜCKLICHE Löschung des Fließtextes und der einzige Weg dazu.
  //     Ein fehlendes `bodyHtml` heisst seit R5 „nicht eingereicht": die Übernahme lässt den
  //     bestehenden Fließtext dann stehen (`service.ts`, `rumpfAusVorschlag`). Genau so reicht Word
  //     ein — eine reine Textänderung darf das Dokument des Objekts nicht mit ausradieren. Beides
  //     zugleich weist der Dienst ab (`INVALID_SOURCE`): zwei Absichten in einem Vorschlag.
  //   · `origin` sagt, WO der Vorschlag entstand. Derselbe Platz, an dem der Word-Weg `word_addin`
  //     trägt; aus dieser Oberfläche steht dort `klarwerk_web`. Der Server nimmt jede Zeichenkette
  //     (`ko-routes.ts:2151`) — die Vokabel gehört deshalb dem Aufrufer, und sie ist hier keine
  //     Vermutung, sondern die Stelle, die den Aufruf absetzt.
  //
  // `decide-proposal` — DIE FREMDE ENTSCHEIDUNG (der Kreis von Fall 2).
  //   · ES GEHT NUR DIE KENNUNG HINAUS, NIE EIN INHALT. Übernommen wird, was IM VORSCHLAG steht
  //     (`service.ts:3891` liest `vorschlag.statement`/`vorschlag.bodyHtml`) — nicht ein Entwurf,
  //     den die Fläche zwischenzeitlich verändert hat, und nicht der aktuelle Stand des Objekts.
  //     Dass der Vertrag hier gar kein Inhaltsfeld anbietet, ist diese Zusage und nicht ihr Beiwerk.
  //   · `expectedVersion` bindet die Freigabe an die Fassung, die der Entscheider gesehen hat. Ohne
  //     sie nähme eine Übernahme fremden, zwischenzeitlich geschriebenen Text mit — der dritte der
  //     vier gemessenen Defekte aus Runde 1.
  //   · `note` trägt die Begründung. Bei einer Ablehnung ist sie die einzige Auskunft, die bleibt.
  | {
      action: "propose";
      proposal: {
        statement: string;
        bodyHtml?: string;
        clearBody?: true;
        baseVersion: number;
        origin?: string;
      };
    }
  | {
      action: "decide-proposal";
      proposalId: string;
      decision: "uebernehmen" | "ablehnen";
      note?: string;
      expectedVersion?: number;
    }
  | { action: "revalidate" };

/**
 * AUFTRAG-mega18 Block A-1 — Nutzlast der Verbund-Operation.
 *
 * `operationId` ist der WIEDERHOLSCHLÜSSEL. Derselbe Aufruf mit derselben Kennung führt zu EINEM
 * Ergebnis, nicht zu doppelten Quellen oder einer zweiten Revision — deshalb darf der Client nach
 * einem Netzfehler gefahrlos wiederholen, statt blind zu kompensieren. Das Feld trägt keine
 * Autorität; die Abgrenzung zum `provider`-Fehler aus mega15 steht in
 * services/knowledge-object/src/document-append.ts.
 *
 * `anchor` ist das Originaldokument, das die Operation als ANKER an dasselbe Objekt bindet. Der
 * Server glaubt die `objectId` nicht — er schlägt sie im eigenen Objektspeicher nach und prüft die
 * gespeicherte Größe gegen die Admin-Grenze. Ohne Anker bricht die Übernahme ab, auf JEDER Stufe
 * (interne Belegpflicht, unabhängig von der externen Stufenregel).
 */
export interface DocumentAppendRequest {
  operationId: string;
  anchor: { objectId: string; name: string; mime: string; thumbnail?: string };
  /** Eine Belegstelle je übernommenem Punkt. Leer ist ein Fehler, keine leere Übernahme. */
  points: { label: string; excerpt?: string; url?: string }[];
  /**
   * Der überarbeitete Inhalt. FEHLT das Feld, bindet die Operation nur Anker + Belege ohne
   * Versions-Bump — der Fall des Erfassens, wo `create` den Inhalt schon committet hat.
   */
  changes?: { bodyHtml: string; statement?: string; title?: string };
}

/** Das eindeutige Commit-Ergebnis der Verbund-Operation (s. lib/appendToArticle.ts). */
export interface DocumentAppendResponse {
  committed: true;
  operationId: string;
  replayed: boolean;
  koVersion: number;
  attachmentId: string;
  sourceIds: string[];
  /** Folgeschritte, die NACH dem Commit nicht liefen. Die Revision gilt trotzdem. */
  followUpsFailed?: string[];
  ko: KnowledgeObject;
}

/**
 * AUFTRAG-mega19 Block B — DIE ERSTANLAGE AUS DOKUMENTEN, in EINEM fachlichen Vorgang.
 *
 * Bis mega18 committete das frische Erfassen zuerst den vollständigen Body (`create`/`promote`) und
 * band die Herkunft erst danach mit je einem `append-document` je Ankerdokument. Zwischen beiden
 * Schritten stand Dokumentinhalt OHNE Herkunft im Bestand — und bei zwei Ankerdokumenten konnte
 * eines gebunden sein und das andere nicht.
 *
 * Dieser Aufruf erzeugt Inhalt, ALLE Ankerdokumente und ALLE Belegstellen gemeinsam — oder gar
 * nichts. Die allgemeine Route `POST /api/kos` bleibt dabei unverändert streng (sie verwirft
 * Client-`sources`, SCRUM-470); dies ist eine zweite, ENGERE Tür daneben.
 *
 * `draftId` setzt einen gespeicherten Entwurf fort (Originalautor bleibt, FR-CAP-07); dann kommen
 * die Inhaltsfelder AUS DEM ENTWURF und `create` entfällt. Der Entwurf wird erst entfernt, wenn das
 * Wissensobjekt vollständig steht.
 */
export interface CreateFromDocumentRequest {
  /**
   * AUFTRAG-mega20 Block A: der WIEDERHOLSCHLÜSSEL. PFLICHT. Derselbe Schlüssel liefert denselben
   * Vorgang: entweder wird das Wissensobjekt jetzt angelegt (201) oder das bereits angelegte
   * zurückgegeben (200). Ohne ihn erzeugte jeder Antwortverlust ein zweites vollständiges Objekt.
   * Er muss über Wiederholungen hinweg STABIL bleiben — s. lib/createOperation.ts.
   */
  operationId: string;
  draftId?: string;
  /**
   * JOB 2684 D3 (R2-17): der `updatedAt`-Stand des fortgesetzten Entwurfs, den der Client beim
   * Laden gesehen hat. Ein veralteter Stand legt nichts an — 409 `DRAFT_STALE`, wie beim Promote.
   */
  expectedUpdatedAt?: string;
  create?: DraftPayload;
  /**
   * AUFTRAG-mega21 Block B: der AKTUELLE Entwurfsstand reist MIT der Erstanlage statt in einem
   * vorgeschalteten `PUT /api/drafts/:id`. Der frühere PUT war es, der jeden Wiederholversuch nach
   * Antwortverlust mit 404 abfing, bevor der serverseitige Idempotenz-Nachschlag überhaupt lief —
   * der Entwurf ist nach dem ersten (gelungenen) POST ja schon verworfen. Die ausgeschriebene
   * Begründung, warum es der atomare Vertrag geworden ist und nicht das Überspringen des PUT,
   * steht an `DraftPromotionSource.applyAndLoad` in services/app/src/routes/ko-routes.ts.
   *
   * AUFTRAG-mega22 Block C: bei gesetztem `draftId` ist das Feld PFLICHT — der Server antwortet
   * sonst mit 400. Ohne es trüge der Abdruck weder Entwurfs-Kennung noch Entwurfsinhalt, und ein
   * Wiederholversuch mit ANDEREM Entwurf würde als identisch adoptiert. Der Typ bildet das ab: die
   * beiden Wege sind eine Vereinigung, keine Sammlung optionaler Felder.
   */
  draftPayload?: DraftPayload;
  documents: {
    /**
     * AUFTRAG-mega22 Block B: `thumbnail` ist ENTFALLEN. Es wurde nie in den Inhaltsabdruck
     * genommen, aber sehr wohl am Wissensobjekt persistiert — zwei parallele Anfragen mit
     * demselben Schlüssel und verschiedener Vorschau erzeugten damit gewinnerabhängig
     * verschiedenen gespeicherten Anzeigeinhalt. Der Server liest das Feld nicht mehr; die
     * Vorschau ist aus der `objectId` ableitbar.
     */
    anchor: { objectId: string; name: string; mime: string };
    points: { label: string; excerpt?: string; url?: string }[];
  }[];
  reviewerIds?: string[];
}

/**
 * AUFTRAG-mega20 Block A: die Antwort ist das Wissensobjekt — plus, wenn nötig, die ehrliche Liste
 * der NACHARBEITEN, die nach dem Commit nicht liefen (Entwurfs-Rücknahme, Prüfer-Zuweisung,
 * Benachrichtigung, KI-Prüf-Vermerk). Sie sind KEIN Teil der Erfolgsdefinition: das Objekt steht
 * und ist vollständig belegt. Aus einem Eintrag hier darf NIE geschlossen werden, der Inhalt sei
 * nicht gespeichert — das war die Fehlerklasse, die in mega18 zu Datenverlust geführt hat.
 */
/**
 * AUFTRAG-mega23 Block B — WAS VON DER BUCHFÜHRUNG TATSÄCHLICH GESCHRIEBEN WURDE.
 *
 * Beide Vermerke sind Best Effort und stehen NACH der Erfolgsdefinition (die 201 kippt nicht, wenn
 * sie ausfallen). Ob sie gelangen, ist trotzdem eine Tatsache, die der Client kennen MUSS:
 *
 *   · `aiCheckFailed` — steht der `failed`-Vermerk am Prüf-Job? NUR dann ist der vorhandene
 *     Wiederhol-Endpunkt (`POST /api/kos/:id/ai-check`) nutzbar; er verlangt `failed` oder
 *     `pending`. Ohne diesen Nachweis darf die Oberfläche den Wiederholweg NICHT versprechen —
 *     genau diese ungedeckte Zusage war bens SB-G.
 *   · `failures` — steht die Liste der gescheiterten Nacharbeiten dauerhaft am Objekt? Nur dann
 *     ist der Fehlschlag nach dem Schließen des Tabs überhaupt noch auffindbar.
 *
 * FEHLT DAS FELD GANZ, ist NICHTS nachgewiesen. Die Oberfläche behandelt das wie „nicht
 * geschrieben" (fail-closed) — eine Zusage ohne Beleg ist der Fehler, den dieses Feld beendet.
 */
export interface FollowUpsRecorded {
  aiCheckFailed: boolean;
  failures: boolean;
}

export type CreateFromDocumentResponse = KnowledgeObject & {
  followUpsFailed?: string[];
  followUpsRecorded?: FollowUpsRecorded;
};

// ================================================================================================
// JOB 3782 — DIE FRIST DES ENTWURFSABRUFS. DIE ZAHL IST GEMESSEN, NICHT GEGRIFFEN.
// ================================================================================================
//
// Die Bahn des JOB 3633 hat diesen Auftrag ausdrücklich mit EINER Abwägung zurückgelegt
// (`archiv/3633/runde-2/RUECKGABE.md:34`, wörtlich): „eine Frist bricht auch das Laden grosser
// Entwürfe ab." Genau diese Abwägung entscheidet diese Zahl, und sie steht auf vier Stützen:
//
//   1. DER SERVERANTEIL, GEMESSEN. `tests/entwurf-laden-zeitgrenze/frist-messung.test.ts` legt einen
//      Entwurf von drei Vierteln des Parserlimits an (`DRAFTS_BODY_LIMIT` = 5 MiB,
//      `capture-routes.ts:164`; grösser nimmt dieser Server keinen an) und holt ihn dreimal wieder:
//      3,77 MiB Nutzlast, 28/27/28 ms allein auf dem Rechner, 60/123/119 ms im Lauf neben einem
//      zweiten Prüfstand (12.09.2026; schlechtester gemessener Wert: 123 ms). Darin steckt die echte
//      Rechteprüfung, die echte Ankerprüfung (`resumeDraft`) und die echte JSON-Serialisierung.
//      Der Server ist also NICHT der Grund, warum ein Abruf lange dauert — nicht einmal unter Last,
//      nicht einmal beim grösstmöglichen Entwurf.
//   1b. DER BROWSERANTEIL, EBENFALLS GEMESSEN — einmalig am 12.09.2026 an der ECHTEN gebauten
//      Anwendung (`apps/web/dist`) in einem echten Chromium auf der Bühne `tests/design/h3-blatt-buehne`,
//      mit demselben Entwurf: Abruf 79/75/76 ms, `JSON.parse` 4/5/4 ms, und der GANZE sichtbare Weg
//      — Adresse öffnen bis der Titel im Blatt steht — 312 ms. Auch der Browser ist also nicht der
//      Grund. (Die Messung war ein Einmallauf und steht bewusst nicht als Prüfstand im Tor: sie
//      startet einen Browser, und ihre Aussage hält `frist-messung.test.ts` billiger.)
//   2. DIE LEITUNG, GERECHNET — und als Rechnung benannt, weil sie in keiner der beiden Messungen
//      vorkommt: beide fahren im selben Rechner, kein Kabel dazwischen. Ein Entwurf an der
//      Obergrenze sind 5 MiB = 41,9 Mbit. Auf einer absichtlich schlechten Verbindung (2 Mbit/s,
//      gedrosseltes Mobilnetz) braucht allein die Übertragung 21,0 s. 21,0 s + Serveranteil +
//      Browseranteil ergeben rund 21,5 s Bedarf; 25 s lassen darüber gut drei Sekunden Luft.
//   3. DIE GEGENPROBE AM HAUS. Der Speicherweg fährt `FRONT_DOOR_SAVE_TIMEOUT_MS = 30000`
//      (`lib/captureFrontDoor.ts:15`) für DIESELBE Datenmenge — und zwar in der SCHWEREREN
//      Richtung: Speichern lädt hoch, Laden lädt herunter, und Heimat- wie Mobilanschlüsse sind
//      nach oben langsamer als nach unten. Eine Ladefrist ÜBER der bewährten Speicherfrist wäre
//      deshalb nicht vorsichtig, sondern unbegründet. 25 s bleibt darunter.
//
// ================================================================================================
// DIE RECHNUNG IST SEIT RUNDE 2 SELBST EIN PRÜFSTAND — sonst wäre sie nur Prosa neben einer Zahl.
// ================================================================================================
// bens Befund der Runde 1, wörtlich: „begründet den entscheidenden Leitungsanteil rechnerisch …
// Das belegt eine Timeout-Grenze, aber keine am grossen Entwurf gemessene Kalibrierung." Er hatte
// recht: wer diese Zahl auf 90 000 gesetzt hätte, wäre durch jeden Prüfstand gekommen, und der
// Absatz hier wäre still falsch geworden. Der Fall M2 in `tests/entwurf-laden-zeitgrenze/
// frist-messung.test.ts` rechnet die drei Posten deshalb in jedem Lauf nach und klammert die Frist
// von BEIDEN Seiten ein: nicht unter dem Bedarf (sonst schnitte sie den grössten Entwurf ab) und
// nicht mehr als fünf Sekunden darüber (sonst wäre der Aufschlag durch nichts gedeckt). Wer die
// Zahl ändert, ändert entweder die Posten mit — oder der Lauf meldet sich mit allen dreien.
//
// WAS DIESE ZAHL NICHT IST: eine Aussage darüber, wie lange ein Abruf im Feld dauert. GEMESSEN ist
// der Serveranteil (in jedem Lauf), ÜBERNOMMEN der Browseranteil (Einmallauf oben, in M2 als
// grosszügige Schranke von 500 ms geführt), GERECHNET die Leitung. Die Frist schneidet deshalb
// nichts ab, was in dieser Rechnung Platz hat — und der Fall T3 in `tests/entwurf-laden-zeitgrenze/`
// hält das auf der FLÄCHE fest: derselbe 3,8-MiB-Entwurf, der knapp innerhalb der Frist antwortet,
// steht danach vollständig im Blatt — erste Zeile, letzte Zeile, alle dreissig Abbildungen.
export const DRAFT_LOAD_TIMEOUT_MS = 25_000;

export const endpoints = {
  ko: {
    list: (f?: KoFilter) => api.get<KnowledgeObject[]>(`/kos${qs(f)}`),
    get: (id: string) => api.get<KnowledgeObject>(`/kos/${id}`),
    versions: (id: string) => api.get<KoVersionSnapshot[]>(`/kos/${id}/versions`),
    evidence: (id: string) => api.get<EvidenceRecord[]>(`/kos/${id}/evidence`),
    // AUFTRAG-mega68: begrenzte Nachbarschaft eines Objekts (Anwendersicht des Wissensnetzes).
    neighbors: (id: string) => api.get<Neighborhood>(`/kos/${id}/neighbors`),
    // ==========================================================================================
    // JOB 4153 (WG-ANZEIGE) — DIE AUSDRÜCKLICH GESETZTEN FACHBEZIEHUNGEN.
    // ==========================================================================================
    // NICHT dieselbe Auskunft wie `neighbors` darüber: dort zählt das geteilte Schlagwort, hier die
    // verantwortete Aussage eines Menschen. Deshalb ein eigener Endpunkt und keine Erweiterung —
    // die beiden Herkünfte dürfen an keiner Stelle zu einer Menge verschmelzen (Vertrag Nr. 6).
    // Der Vertrag steht wörtlich in `jobs/4151/HINWEIS.md`, Abschnitt „Verbindlicher API-Vertrag".
    beziehungen: (id: string) => api.get<KuratierteKanten>(`/kos/${id}/beziehungen`),
    // 201 bei neuer Kante, 200 mit der BESTEHENDEN bei Dedup oder wiederholtem `beitragSchluessel`.
    // Der Client unterscheidet das nicht: er zeigt in beiden Fällen den Stand des Servers.
    beziehungSetzen: (id: string, body: BeziehungSetzenBody) =>
      api.post<KuratierteKanteAnsicht>(`/kos/${id}/beziehungen`, body),
    // KEIN `DELETE`: der Widerruf ist eine Urheberaussage, nichts wird gelöscht, die Historie
    // bleibt (Vertrag Nr. 7, `kanten-types.ts:30-36`). Die Kennung ist die der KANTE, nicht die
    // eines Eintrags — deshalb der eigene Pfad `/beziehungen/:kanteId/widerruf`.
    beziehungWiderrufen: (kanteId: string, body: BeziehungWiderrufBody) =>
      api.post<KuratierteKanteAnsicht>(`/beziehungen/${kanteId}/widerruf`, body),
    // SCRUM-395: optionaler Prüfer-Vorschlag direkt beim Einreichen (reviewerIds).
    create: (body: DraftPayload & { reviewerIds?: string[] }) =>
      api.post<KnowledgeObject>("/kos", body),
    // AUFTRAG-mega19 Block B: Erstanlage/Promote MIT Ankerdokumenten — ein Vorgang, oder keiner.
    createFromDocument: (body: CreateFromDocumentRequest) =>
      api.post<CreateFromDocumentResponse>("/kos/from-document", body),
    act: (id: string, body: KoAction) => api.put<KnowledgeObject>(`/kos/${id}`, body),
    // AUFTRAG-mega18 Block A-1: eigener Aufruf, weil die Antwort ein COMMIT-ERGEBNIS ist und kein
    // KnowledgeObject — der Aufrufer erfährt daraus ohne Rückfrage, was gilt.
    appendDocument: (id: string, appendDocument: DocumentAppendRequest) =>
      api.put<DocumentAppendResponse>(`/kos/${id}`, { action: "append-document", appendDocument }),
    remove: (id: string) => api.del<void>(`/kos/${id}`),
    // WP-SUBMIT-ASYNC: reiht die Hintergrund-KI-Pruefung neu ein (Retry am failed-Badge).
    aiCheckRetry: (id: string) => api.post<{ status: string }>(`/kos/${id}/ai-check`, {}),
    // SCRUM-422: Papierkorb (nur Admin): Liste, Wiederherstellen, sofortige Endlöschung.
    trash: () => api.get<TrashedKo[]>("/kos/trash"),
    restore: (id: string) => api.post<KnowledgeObject>(`/kos/${id}/restore`),
    purge: (id: string) => api.del<void>(`/kos/trash/${id}`),
  },
  validation: {
    // JOB 3027: die Board-Route liefert seit JOB 3003/3009 MEHR als ein Wissensobjekt — Stufe und
    // Herkunft samt Beleglage (services/validation/src/board-herkunft.ts:122-135). Der Typ sagt das
    // jetzt; vorher las die Oberfläche eine Auskunft, von der ihr Vertrag nichts wusste.
    board: (f?: KoFilter) => api.get<ValidationBoardKo[]>(`/validation/board${qs(f)}`),
    overview: () => api.get<AssignmentSummary[]>("/validation/overview"),
    // SCRUM-395: Standard-Prüferanzahl (lesen: alle Leseberechtigten; setzen: Admin).
    settings: () => api.get<ValidationSettings>("/validation/settings"),
    saveSettings: (defaultNeededValidations: number) =>
      api.put<ValidationSettings>("/validation/settings", { defaultNeededValidations }),
  },
  // AUFTRAG-mega29 C2: schmale Abdeckungs-Zusammenfassung des Bestands (drei Zähler, read-only) —
  // die Finding-Endpunkte liefern nur OFFENE Befunde und wissen nichts über die Laufabdeckung.
  aiCheck: {
    coverageSummary: () => api.get<AiCheckCoverageSummary>("/ai-check/coverage-summary"),
  },
  // A28 (JOB 1546 D2): das dauerhafte Signal am EIGENEN Objekt. Bewusst NICHT unter `conflicts`
  // oder `duplicates` — die beiden liefern Paare mit wörtlichen Belegzitaten und sind deshalb an
  // `paarSichtbar` gebunden (BEIDE Objekte müssen sichtbar sein). Dieser Weg liefert nur
  // Vorhandensein und Art am eigenen Objekt und trägt darum genau dort, wo jene schweigen müssen.
  duplicateSignal: {
    list: () => api.get<EigenerBefund[]>("/duplicate-signal"),
  },
  conflicts: {
    list: () => api.get<Conflict[]>("/conflicts"),
    get: (id: string) => api.get<Conflict>(`/conflicts/${id}`),
    escalate: (id: string) => api.post<Conflict>(`/conflicts/${id}/escalate`),
    secondOpinion: (id: string, opinion: string) =>
      api.post<Conflict>(`/conflicts/${id}/second-opinion`, { opinion }),
    // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch" schließt den Konflikt.
    dismiss: (id: string, note?: string) =>
      api.post<Conflict>(`/conflicts/${id}/dismiss`, note ? { note } : {}),
  },
  // Berater-Konzept Duplikate 04.07. (Stufe D4): Überschneidungs-/Duplikat-Board. Liste + Detail
  // lesen alle Leseberechtigten; die menschlichen Abschlüsse sind kuratorische Entscheidungen.
  duplicates: {
    list: () => api.get<OverlapEntry[]>("/duplicates"),
    get: (id: string) => api.get<OverlapEntry>(`/duplicates/${id}`),
    dismiss: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/dismiss`, note ? { note } : {}),
    keepSeparate: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/keep-separate`, note ? { note } : {}),
    linkRelated: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/link-related`, note ? { note } : {}),
    // JOB 3061 · H2 (bens Korrekturpflicht 1, Runde 5): „Status setzen" aus dem „···"-Menü der
    // Duplikatkarte — der eigene Weg neben den Entscheidungsknöpfen. `in_bearbeitung` braucht
    // keinen Grund (nichts ist entschieden), `geschlossen` verlangt ihn (der Server weist einen
    // fehlenden oder systemischen Grund mit 400 ab). Der Typ nennt genau die drei wählbaren
    // Gründe, damit ein systemischer hier gar nicht erst getippt werden kann.
    setStatus: (
      id: string,
      eingabe:
        | { status: "in_bearbeitung"; note?: string }
        | {
            status: "geschlossen";
            reason: "kept_separate" | "linked_related" | "dismissed";
            note?: string;
          },
    ) => api.post<OverlapEntry>(`/duplicates/${id}/status`, eingabe),
    // Pedi 04.07.: Anzeige-Schwelle (lesen: alle Leseberechtigten; setzen: Admin).
    settings: () => api.get<OverlapSettings>("/duplicates/settings"),
    saveSettings: (minConfidence: number) =>
      api.put<OverlapSettings>("/duplicates/settings", { minConfidence }),
  },
  gaps: {
    // FUNKE-FIX2 P0 (bens Erforderlich 1): nur aggregierte Zähler (kein Fragetext) — die Startseite
    // nutzt AUSSCHLIESSLICH diesen Weg.
    summary: () => api.get<GapSummary>("/gaps/summary"),
    // Detail-Liste: der Server redigiert den Fragetext adressatengerecht (redacted-Marker).
    list: () => api.get<Gap[]>("/gaps"),
    close: (id: string) => api.put<Gap>(`/gaps/${id}`, { close: true }),
    assign: (id: string, expertId: string) => api.put<Gap>(`/gaps/${id}`, { expertId }),
    // SCRUM-115 / FE-RISK-02: Priorität der Wissenslücke setzen.
    setPriority: (id: string, priority: GapPriority) => api.put<Gap>(`/gaps/${id}`, { priority }),
    remove: (id: string) => api.del<void>(`/gaps/${id}?confirm=true`),
  },
  // WP-D11: PPTX-Folien → PNG je Folie (Server-Konvertierung; base64 konsistent zum Objekt-Upload).
  slides: {
    // WP-RETEST7 R8: leichter Verfügbarkeits-Check VOR dem großen Upload + harter Client-Timeout
    // der Konvertierung — kein endloser Spinner mehr (Meldung sofort, Text-Import bleibt).
    availability: () => api.get<{ available: boolean }>("/capture/slides/availability"),
    convert: (dataBase64: string) =>
      api.postWithTimeout<SlideConvertResponse>(
        "/capture/slides",
        { data: dataBase64 },
        SLIDES_CONVERT_TIMEOUT_MS,
      ),
  },
  drafts: {
    list: () => api.get<Draft[]>("/drafts"),
    // JOB 3782: DER EINE ABRUF MIT FRIST. Er ist der Weg, auf dem `/erfassen?draft=<id>` das Blatt
    // füllt — und der einzige, der hier eine Frist bekommt: `list` und die übrigen Lesewege bleiben
    // unverändert, weil dieser Auftrag nur DIESEN Hänger gemessen hat. Die Zahl steht begründet
    // oben an `DRAFT_LOAD_TIMEOUT_MS`; die Bauform ist die des Nachbarn `slides.convert`.
    get: (id: string) => api.getWithTimeout<Draft>(`/drafts/${id}`, DRAFT_LOAD_TIMEOUT_MS),
    // SCRUM-395-Beifang (BUG): Body war fälschlich als { payload } verschachtelt — der Server
    // erwartet die DraftPayload-Felder FLACH (wie update/promote). Folge: frisch gespeicherte
    // Entwürfe verloren Titel & Inhalte bis zum ersten Update. Jetzt konsistent flach.
    // JOB 2697: `operationId` ist der WIEDERHOLSCHLÜSSEL der Entwurfsanlage — derselbe Vertrag wie
    // beim Wissensobjekt oben (`:190`, `:204`, `:237`). Derselbe Aufruf mit derselben Kennung führt
    // zu EINEM Entwurf, nicht zu zweien; ohne Kennung bleibt alles wie bisher. Sie reist NEBEN der
    // Nutzlast, nicht in ihr — der Server trennt sie ab, bevor er den Entwurf anlegt.
    create: (payload: DraftPayload, operationId?: string) =>
      api.post<Draft>("/drafts", operationId ? { ...payload, operationId } : payload),
    // SCRUM-113 / FE-CAP-07: Entwurf fortsetzen (continueDraft, Originalautor bleibt).
    // JOB 2684 D1: `expectedUpdatedAt` = der beim Laden gesehene Stand; der Server antwortet 409
    // DRAFT_STALE, wenn inzwischen jemand anders (zweiter Tab, Studio) gespeichert hat. Ohne den
    // Wert bleibt der alte Weg.
    //
    // JOB 4193: „Mobil, Offline-Warteschlange" stand hier als Beispiel für den alten Weg — das
    // stimmt nicht mehr. Der mobile Aktualisierungsweg (`pages/Mobile.tsx`) und das Nachsenden aus
    // der Warteschlange (`app/useOfflineQueue.ts`) schicken den gesehenen Stand jetzt mit; der
    // Konflikt endet dort in einer Rückfrage mit Feldangabe, nicht in einer stillen Überschreibung.
    // Ohne den Wert bleibt es beim alten Verhalten — für Vorgänge, die keinen Stand kennen.
    update: (id: string, payload: DraftPayload, opts?: { expectedUpdatedAt?: string }) =>
      api.put<Draft>(`/drafts/${id}`, {
        ...payload,
        ...(opts?.expectedUpdatedAt ? { expectedUpdatedAt: opts.expectedUpdatedAt } : {}),
      }),
    // JOB 3668: `remove` legt den Entwurf in den PAPIERKORB, es vernichtet ihn nicht mehr. Der
    // Aufruf, die Adresse und die Antwort (204) bleiben zeichengleich — der Entwurf verschwindet
    // aus `list()` wie zuvor, ist aber unter `trash()` wieder auffindbar.
    remove: (id: string) => api.del<void>(`/drafts/${id}`),
    // ==========================================================================================
    // JOB 3668 — DER PAPIERKORB DER ENTWÜRFE: DIESELBEN DREI METHODEN WIE BEIM WISSENSOBJEKT.
    // ==========================================================================================
    // Wörtlich die Namen und die Reihenfolge von `kos.trash`/`kos.restore`/`kos.purge` (`:342-344`)
    // — Pedis Befund war, dass gleiche Funktionen auf verschiedenen Seiten verschieden behandelt
    // werden. Hier gibt es deshalb kein zweites Wort für dasselbe.
    //
    // DER TYP IST `Draft & { deletedAt: string }` UND NICHT EINE SCHMALE ZEILE wie `TrashedKo`:
    // Der KO-Papierkorb ist eine ADMIN-Auskunft über fremde Objekte und gibt bewusst keine Inhalte
    // heraus. Dieser hier zeigt dem Autor SEINE EIGENEN Entwürfe — also genau das, was er über
    // `list()` ohnehin sähe, plus den Löschzeitpunkt. `deletedAt` ist PFLICHT: die Liste sortiert
    // und beschriftet danach, ein optionales Feld machte beides zur Vermutung.
    //
    // DER TYP WIRD HIER AUFGESCHRIEBEN UND NICHT IN `api/types.ts` (kein Zielpfad dieses Auftrags,
    // s. Rückgabe): `deletedAt` ist PFLICHT — was im Papierkorb liegt, hat einen Löschzeitpunkt, und
    // die Liste sortiert und beschriftet danach. `deletedBy` ist OPTIONAL und wird nicht geraten:
    // der Server setzt ihn aus der Anmeldung, aber Altbestand könnte ihn nicht tragen. Die Fläche
    // zeigt dann den Zeitpunkt allein statt eines erfundenen Namens.
    trash: () => api.get<(Draft & { deletedAt: string; deletedBy?: string })[]>("/drafts/trash"),
    restore: (id: string) => api.post<Draft>(`/drafts/${id}/restore`),
    purge: (id: string) => api.del<void>(`/drafts/trash/${id}`),
    // SCRUM-395: optionaler Prüfer-Vorschlag auch auf dem Entwurfs-Weg.
    // AUFTRAG-mega22 Block H: `operationId` macht den Promote WIEDERHOLBAR (derselbe Vertrag wie
    // `createFromDocument`, s. services/app/src/routes/capture-routes.ts) und `draftPayload` lässt
    // den aktuellen Stand MIT dem Promote reisen, statt in einem vorgeschalteten PUT — der nach
    // einem gelungenen ersten Lauf mit 404 abfinge, weil der Entwurf dann bereits gelöscht ist.
    promote: (
      id: string,
      body?: {
        reviewerIds?: string[];
        operationId?: string;
        draftPayload?: DraftPayload;
        // JOB 2684 D1: derselbe Standvergleich wie beim Speichern — vor dem Wissensobjekt.
        expectedUpdatedAt?: string;
      },
    ) => api.post<KnowledgeObject>(`/drafts/${id}/promote`, body),
  },
  ask: {
    // FR-I18N-01: aktuelle UI-Sprache mitsenden (Default serverseitig "de").
    ask: (question: string, locale?: ReasonerLocale) =>
      api.post<AskResponse>("/ask", { question, ...(locale ? { locale } : {}) }),
    // FUNKE-FIX P0 (bens ROT-1): „Danke" trägt den Answer-Receipt aus dem echten Antwortvorgang
    // zurück — ohne gültigen, dieses KO belegenden Receipt antwortet der Server 403.
    helpful: (koId: string, receipt: string) => api.post<void>("/ask/helpful", { koId, receipt }),
  },
  // FUNKE F1 (nacht24 Paket 6): persönliche Wirkungs-Zähler (nur eigene Beiträge, nur Zahlen).
  me: {
    impact: () => api.get<MyImpact>("/me/impact"),
  },
  // SCRUM-527: Live-Check eines Entwurfstextes (Ähnlichkeit/Widerspruch gegen den Bestand).
  //
  // JOB 3556 (LIVE-CHECK-VERDRAHTUNG Teil A) — DIE HERKUNFT REIST MIT.
  // Bis hierher ging nur `{ text }` hinaus. Die Route kennt `source`/`koId`/`confidentiality`/
  // `nichtEingestuft` seit SCRUM-527 WP3 und stuft eine FEHLENDE Herkunft fail-safe als vertraulich
  // ein (knowledge-check-routes.ts:46-47) — der Widerspruchs-Judge lief deshalb im Standardeditor
  // grundsätzlich NIE, und ein echter Widerspruch erschien dauerhaft als „nicht geprüft".
  //
  // KEIN ZWEITER VERTRAG: es ist dieselbe `ReasonerProvenance` und derselbe `provenanceFields`-
  // Serializer wie auf den Reasoner-Wegen (`:502` ff.) — eine Form, eine Bedeutung, eine Stelle,
  // an der sich beides ändern lässt. `provenance` ist OPTIONAL und wird weggelassen, wenn die
  // Fläche die Einstufung nicht kennt: dann geht wie bisher nur der Text hinaus und der Server
  // entscheidet unverändert fail-safe. Ein Vorgabewert wäre hier eine erfundene Freigabe.
  knowledge: {
    check: (text: string, provenance?: ReasonerProvenance) =>
      api.post<KnowledgeCheckResult>("/knowledge/check", {
        text,
        ...(provenance ? provenanceFields(provenance) : {}),
      }),
  },
  // Klara Stufe 2: KI-Antwort NUR aus mitgesandten Hilfe-Schnipseln (ehrliche Luecke sonst).
  help: {
    explain: (body: {
      question: string;
      snippets: { id: string; title: string; body: string }[];
      locale?: ReasonerLocale;
    }) => api.post<AnswerResult>("/help/explain", body),
  },
  reasoner: {
    structure: (text: string, locale: ReasonerLocale | undefined, provenance: ReasonerProvenance) =>
      api.post<StructureResult>("/reasoner", {
        task: "structure",
        text,
        ...(locale ? { locale } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-312: optionale Bearbeitungs-Anweisung (klarer/strukturieren/erweitern/rechtschreibung
    // oder frei) — der deterministische Fallback ignoriert sie, das Modell berücksichtigt sie.
    assist: (
      text: string,
      locale: ReasonerLocale | undefined,
      instruction: string | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<AssistResult>("/reasoner", {
        task: "assist",
        text,
        ...(locale ? { locale } : {}),
        ...(instruction?.trim() ? { instruction: instruction.trim() } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-132: reasoner-getriebenes Interview, stateless.
    interview: (
      answers: string[],
      locale: ReasonerLocale | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<InterviewResult>("/reasoner", {
        task: "interview",
        answers,
        ...(locale ? { locale } : {}),
        ...provenanceFields(provenance),
      }),
    // WP-BILD-1c/1f: KI-Bildbeschreibung als VORSCHLAG für die Bild-Fußnote (Vision). EIGENE
    // Route (bens P2: nur der Bild-Task trägt die große Parsergrenze); die Provenienz läuft wie
    // bei den Text-Tasks mit — vertrauliche Entwürfe erreichen die Cloud nie.
    describeImage: (
      dataUrl: string,
      locale: ReasonerLocale | undefined,
      provenance: ReasonerProvenance,
      // WP-BILD-1f: optionaler umgebender Dokument-Kontext (Klartext, bereits budgetgekürzt). Reist im
      // selben describe-Request wie das Bild und damit über DIESELBE Vertraulichkeits-/Egress-Stelle.
      context?: string,
    ) =>
      api.post<DescribeImageResult>("/reasoner/describe", {
        dataUrl,
        ...(locale ? { locale } : {}),
        ...(context?.trim() ? { context: context.trim() } : {}),
        ...provenanceFields(provenance),
      }),
    // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag).
    // SCRUM-451: outputLanguage "source" = Ergebnis bleibt in der Sprache des Dokuments.
    extract: (
      text: string,
      locale: ReasonerLocale | undefined,
      query: string | undefined,
      outputLanguage: "system" | "source" | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<ExtractResult>("/reasoner", {
        task: "extract",
        text,
        ...(locale ? { locale } : {}),
        ...(query?.trim() ? { query: query.trim() } : {}),
        ...(outputLanguage === "source" ? { outputLanguage } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-426: Public-KI-Anreicherung (Modellwissen) — extern/ungeprüft; nur wenn der
    // Admin-Regler (SCRUM-414) auf „offen" steht (Server prüft, sonst 403).
    enrich: (query: string, locale?: ReasonerLocale) =>
      api.post<EnrichResult>("/reasoner/enrich", { query, ...(locale ? { locale } : {}) }),
    status: () => api.get<ReasonerStatus>("/reasoner/status"),
    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten).
    config: () => api.get<ReasonerConfigStatus>("/reasoner/config"),
    // KI-Verwaltung v1: Zuordnung setzen (nur Admin; Antwort = frischer configStatus).
    updateConfig: (cfg: { global: string; perTask: Record<string, string> }) =>
      api.put<ReasonerConfigStatus>("/reasoner/config", cfg),
    // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf (nur Admin, ehrliches Ergebnis).
    test: () => api.post<ReasonerProbeResult>("/reasoner/test"),
    // SCRUM-428: Key-Test für den eigenen lokalen LLM (echter Mini-Aufruf über den Tunnel).
    testLocal: () => api.post<ReasonerProbeResult>("/reasoner/test-local"),
    // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung (echter judgeConflict + kollision).
    conflictSelfTest: () => api.post<ConflictSelfTestResult>("/reasoner/conflict-self-test"),
    duplicateSelfTest: () => api.post<DuplicateSelfTestResult>("/reasoner/duplicate-self-test"),
    // SCRUM-386: kundeneigene KI-Assist-Presets — lesen alle Rollen (Palette), pflegen nur Admin.
    assistPresets: () => api.get<AssistPreset[]>("/reasoner/assist-presets"),
    updateAssistPresets: (presets: { id?: string; name: string; instruction: string }[]) =>
      api.put<AssistPreset[]>("/reasoner/assist-presets", { presets }),
  },
  notifications: {
    list: () => api.get<Notification[]>("/notifications"),
    // Audit-P3 (SCRUM-397): bewusstes Als-gesehen-Markieren (idempotent, nur eigene Sicht).
    markSeen: (ids: string[]) => api.post<{ unseenCount: number }>("/notifications/seen", { ids }),
  },
  directory: { list: () => api.get<{ id: string; name: string }[]>("/directory") },
  // Audit-P4 (SCRUM-398): Live-Wall (read-only Aggregation).
  livewall: { get: () => api.get<LiveWall>("/livewall") },
  analytics: {
    overview: () => api.get<Analytics>("/analytics"),
    busfactor: () => api.get<BusFactorEntry[]>("/analytics/busfactor"),
    // Consultant-System (Experten-Matching): Thema → Personen. Hinter Feature-Flag (Default AUS → 404)
    // und ko.assign — der Aufruf erfolgt nur für berechtigte Rollen (siehe useExpertise/canSeeExpertise).
    expertise: () => api.get<ExpertiseEntry[]>("/analytics/expertise"),
    // SCRUM-140: vorhandene Wirkungs-API anbinden (FR-ANA-02).
    impact: () => api.get<ImpactReport>("/analytics/impact"),
  },
  audit: {
    list: () => api.get<AuditEntry[]>("/audit"),
    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (Admin-Knopf „Integrität geprüft").
    // AUFTRAG-mega14 Block A: der Bericht nennt jetzt auch die URSACHE einer Abweichung.
    verify: () => api.get<AuditVerifyReport>("/audit/verify"),
  },
  // SCRUM-121: Objekt-/Attachment-Speicher — Original via Referenz statt Inline im KO.
  objects: {
    // SCRUM-521 (WP1): optionale Vertraulichkeit beim Upload PERSISTIEREN. Der Medien-Egress liest sie
    // serverseitig aus dem gespeicherten Objekt; nur so kann ein als „intern" hochgeladenes Medium extern
    // transkribiert werden. Ohne Wert bleibt das Objekt serverseitig fail-safe vertraulich.
    upload: (input: {
      name: string;
      mime: string;
      data: string;
      kind?: ObjectRef["kind"];
      confidentiality?: Confidentiality;
      // AUFTRAG-mega20 Block C: WOZU wird hochgeladen. Der Server prüft den Wert gegen seine
      // Liste und stuft einen unbekannten auf „unknown" — also konservativ, nicht wohlwollend.
      // `owner` fehlt hier bewusst: er kommt serverseitig aus der Anmeldung, nie aus dem Body.
      purpose?: "anchor" | "attachment" | "media" | "example";
      draftId?: string;
    }) => api.post<ObjectRef>("/objects", input),
    read: (id: string) => api.get<ObjectContent>(`/objects/${id}`),
  },
  // SCRUM-382: Video-/Audio-Analyse — Transkript serverseitig (Schlüssel bleibt im Backend).
  media: {
    status: () => api.get<{ active: boolean; engine: string | null }>("/media/status"),
    // SCRUM-502 R7: die Vertraulichkeit des Mediums mitsenden (Upload = transient-document).
    // Fehlt/ungültig → serverseitig fail-safe vertraulich → kein externer Transkriptions-Egress.
    analyze: (objectId: string, locale: ReasonerLocale, confidentiality?: Confidentiality) =>
      api.post<MediaAnalysis>("/media/analyze", {
        objectId,
        locale,
        ...(confidentiality ? { confidentiality } : {}),
      }),
  },
  lifecycle: {
    pending: () => api.get<string[]>("/lifecycle/pending"),
    // Audit B1 (02.07.2026): Anlagen-Kopplung im KO-Detail — koppeln + gekoppelte Anlagen lesen.
    couple: (assetRef: string, koId: string) =>
      api.post<void>("/lifecycle/couple", { assetRef, koId }),
    couplingsFor: (koId: string) => api.get<string[]>(`/lifecycle/couplings/${koId}`),
    // SCRUM-146: vorhandener Asset-Change-Pfad → markiert gekoppelte KOs als „prüfen".
    assetChanged: (assetRef: string) =>
      api.post<string[]>("/lifecycle/asset-changed", { assetRef }),
  },
  // SCRUM-145: vorhandene Learning-Path-API (rollenbasiert, Fortschritt serverseitig).
  learningPaths: {
    byRole: (role: string) => api.get<LearningPath>(`/learning-paths/${role}`),
    progress: (pathId: string) => api.get<string[]>(`/learning-paths/${pathId}/progress`),
    complete: (pathId: string, stepId: string) =>
      api.post<string[]>(`/learning-paths/${pathId}/complete`, { stepId }),
  },
  // JOB 2600 D1: die Themenkarte reist auf der BESTEHENDEN Wissensnetz-Route mit — sie ist Teil
  // der Sichtmetrik (`services/wissensnetz`). Kein neuer Endpunkt und keine zweite Lesequelle:
  // dieselbe Route, dieselbe Rechte-Naht, derselbe getrimmte Bestand.
  wissensnetz: {
    luecken: () => api.get<Sichtmetrik>("/wissensnetz/luecken"),
  },
  library: {
    graph: () => api.get<Graph>("/graph"),
    // FE-LIB-01: Server-Volltextsuche + strukturierte Filter (Art/Status/Kategorie/Tag).
    search: (params: KoFilter & { q?: string }) =>
      api.get<KnowledgeObject[]>(`/library/search${qs(params)}`),
    // JOB 3095 · M5: Bilder anhand ihrer Unterschrift, mit Herkunft; dieselbe Rechte-Naht wie search.
    images: (q: string, limit?: number) =>
      api.get<LibraryImageSearchResponse>(
        `/library/images${qs({ q, limit: limit === undefined ? undefined : String(limit) })}`,
      ),
    // SCRUM-116/108: Import-/Source-Review (JSON-Re-Import mit Review-Queue).
    importCandidates: {
      create: (items: ImportItemInput[]) =>
        api.post<ImportCandidate[]>("/library/import/candidates", { items }),
      list: () => api.get<ImportCandidate[]>("/library/import/candidates"),
      review: (id: string, action: ReviewAction, note?: string) =>
        api.put<ImportCandidate>(`/library/import/candidates/${id}`, { action, note }),
    },
  },
  // FR-EXT-03 / SCRUM-117: Output Factory — Quellen (nur validiert) + Generierung.
  output: {
    sources: () => api.get<OutputSource[]>("/output/sources"),
    generate: (body: { kind: OutputKind; koIds: string[]; audienceRole?: string | null }) =>
      api.post<OutputDocument>("/output/generate", body),
  },
  // SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot (read-only).
  management: {
    snapshot: () => api.get<ManagementSnapshot>("/management/snapshot"),
  },
  // SCRUM-165: read-only Einsicht in jüngste ModelRuns (nur Metadaten).
  modelRuns: {
    recent: (limit?: number) =>
      api.get<ModelRunRecord[]>(`/model-runs${qs({ limit: limit?.toString() })}`),
  },
  // SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2; nur Metadaten).
  evidence: {
    recent: (limit?: number) =>
      api.get<EvidenceRecord[]>(`/evidence${qs({ limit: limit?.toString() })}`),
  },
  // SCRUM-118 / FR-EXT-02: externer Such-Proxy (optional; 501 wenn deaktiviert).
  // SCRUM-421: einstellbare Upload-Grenzen (lesen: alle Leseberechtigten; setzen: Admin).
  uploadLimits: {
    get: () => api.get<UploadLimits>("/upload-limits"),
    save: (limits: UploadLimits) => api.put<UploadLimits>("/upload-limits", limits),
  },
  external: {
    search: (q: string) => api.get<ExternalResult[]>(`/external/search${qs({ q })}`),
    // SCRUM-414: Admin-Regler „externe Wissensabfrage" (lesen: alle; setzen: Admin).
    policy: () => api.get<{ stage: ExternalKnowledgeStage }>("/external/policy"),
    savePolicy: (stage: ExternalKnowledgeStage) =>
      api.put<{ stage: ExternalKnowledgeStage }>("/external/policy", { stage }),
  },
  // SCRUM-181: admin-only Demo-Seed für leere Instanzen (ehrliche seeded/skipped-Rückgabe).
  admin: {
    // Pedi 05.07. (Beta): `force` lädt das Demo-Set auch bei bereits erfassten Daten.
    // SCRUM-487: `locale` (UI-Sprache) steuert die Sprache der Demo-Inhalte (Server-Default "de").
    // AUFTRAG-mega14 Block H (SCRUM-437): LESENDER Stand für die Bereitschafts-Zeile — kein
    // zweiter Lade-/Entfernen-Weg.
    demoStatus: () => api.get<{ present: boolean; count: number }>("/admin/demo-seed"),
    demoSeed: (force = false, locale?: string) =>
      api.post<DemoSeedResult>("/admin/demo-seed", { force, ...(locale ? { locale } : {}) }),
    // Pedi 02.07./05.07.: Demodaten komplett entfernen (inkl. Demo-Anwender); Merker überlebt
    // Tester-Bearbeitungen.
    demoPurge: () =>
      api.del<{ kos: number; conflicts: number; duplicates: number; gaps: number; users: number }>(
        "/admin/demo-seed",
      ),
    // JOB 3277: Demopakete — wählen, laden, zurücksetzen, PAKETBEZOGEN entfernen. Vier Wege neben
    // dem Gesamt-Purge oben, der bestehen bleibt und die Pakete weiterhin mitnimmt.
    demoPackages: {
      list: () => api.get<DemoPackageListResponse>("/admin/demo-packages"),
      // Die Aktion reist MIT: die Vorschau des Zurücksetzens und die des Entfernens sind
      // verschiedene Pläne (herstellen gegen löschen), und die Fläche darf sie nicht verwechseln.
      preview: (id: string, aktion: "zuruecksetzen" | "entfernen") =>
        api.get<DemoPackagePreview>(`/admin/demo-packages/${id}/preview?aktion=${aktion}`),
      load: (id: string) => api.post<DemoPackageResult>(`/admin/demo-packages/${id}/load`),
      reset: (id: string) => api.post<DemoPackageResult>(`/admin/demo-packages/${id}/reset`),
      remove: (id: string) => api.del<DemoPackageResult>(`/admin/demo-packages/${id}`),
    },
    // Pedi 05.07. (Beta): Werksreset — Verfügbarkeit (nur Desktop/Dev) + Ausführen (löscht alles,
    // beendet das Programm; nächster Start = Ersteinrichtung).
    factoryResetStatus: () => api.get<{ available: boolean }>("/admin/factory-reset"),
    // JOB 4025 (KUNDENBETRIEB-BACKUP): die LESENDE Auskunft über das Sicherungsverzeichnis. Sie
    // löst nichts aus, löscht nichts und lädt nichts herunter — sie sagt nur, was dort liegt und
    // ob es seine Prüfsumme trägt (`scripts/backup/backup.sh:55-57/:82`).
    sicherungen: () => api.get<SicherungenAuskunft>("/admin/sicherungen"),
    // SCRUM-450: Werksreset erst nach Passwort-Bestätigung des Admins (Re-Authentifizierung).
    factoryReset: (password: string) =>
      api.post<{ ok: boolean }>("/admin/factory-reset", { password }),
    // IC-2 (Import-Cockpit): READ-ONLY Erkundung „was ist da" VOR jedem Import. Schreibt nichts —
    // liefert nur die aggregierte Landkarte (Mengen/Autoren/Themen/Zeitraum) + truncated.
    import: {
      // F-0140 / K-20 (JOB 2970 D1): der asynchrone Lauf. Beide Routen existieren serverseitig
      // seit JOB 2691 D2 und waren vom Client bis hierher UNERREICHBAR — die Import-Seite konnte
      // deshalb nichts über einen laufenden Import sagen.
      //
      // `startRun` antwortet 202 `{importId, status:"QUEUED"}`. Läuft für denselben Space schon
      // einer, antwortet der Server 409 `IMPORT_ALREADY_RUNNING` und legt KEINEN zweiten an
      // (confluence-import-routes.ts:274-281) — die Sperre liegt am Server, die Fläche hält den
      // Knopf zusätzlich gesperrt, solange sie einen laufenden Lauf kennt.
      // JOB 2970 D2: Der 409-Körper trägt die Kennung des BEREITS laufenden Imports
      // (`confluence-import-routes.ts:274-280`) — und genau die ging bisher verloren.
      //
      // WARUM NICHT ÜBER `api.post`: `apiFetch` wirft bei `!res.ok` einen `ApiError`, der nur
      // `status`, `code` und `message` trägt (`api/client.ts:33-40`). Das `importId`-Feld des
      // Körpers fällt dabei weg. Für 409 ist das aber die einzige nützliche Information: „es
      // läuft schon" ist kein Fehler, sondern eine Auskunft — mit der Kennung, unter der der
      // laufende Import lesbar ist. Deshalb wird HIER, an genau dieser einen Stelle, die Antwort
      // selbst gelesen. `api/client.ts` bleibt unangetastet; Basis (`/api`), Anmeldung
      // (`credentials: "include"`) und Kopfzeile sind Zeichen für Zeichen dieselben.
      //
      // Jede ANDERE Fehlerantwort bleibt ein Fehler und fliegt als `ApiError` weiter — kein
      // stiller Schlucker.
      startRun: async (): Promise<ImportRunStartResponse> => {
        const res = await fetch("/api/admin/import/confluence", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const roh = await res.text();
        const daten = (roh ? JSON.parse(roh) : {}) as {
          importId?: unknown;
          status?: unknown;
          error?: unknown;
          message?: unknown;
        };
        if (res.status === 409 && daten.error === "IMPORT_ALREADY_RUNNING") {
          return {
            importId: String(daten.importId ?? ""),
            status: String(daten.status ?? "RUNNING"),
            alreadyRunning: true,
          };
        }
        if (!res.ok) {
          throw new ApiError(
            res.status,
            daten.error ? String(daten.error) : "ERROR",
            daten.message ? String(daten.message) : res.statusText,
          );
        }
        return {
          importId: String(daten.importId ?? ""),
          status: String(daten.status ?? ""),
          alreadyRunning: false,
        };
      },
      run: (importId: string) => api.get<ImportRunRecord>(`/admin/import/runs/${importId}`),
      explore: () => api.post<ImportExploreResponse>("/admin/import/confluence/explore", {}),
      // IC-3: READ-ONLY Auswahl-Vorschau (Prompt und/oder Klick-Kriterien). Schreibt nichts.
      // WP-SAMMEL20-FIX (bens Fix 3): locale reist explizit mit (Route-Schema: de/en).
      // WP-VIP2-GATE-2 (bens Fix 1): promptConfidential = die PFLICHT-Eigeneinstufung des Satzes
      // (true = enthaelt Vertrauliches/unsicher — Vorgabe; false = explizit unbedenklich). Der
      // Client sendet sie immer; der Server lehnt einen Satz ohne Einstufung mit 400 ab.
      select: (body: {
        prompt?: string;
        criteria?: ImportSelectCriteria;
        locale?: ReasonerLocale;
        promptConfidential?: boolean;
      }) => api.post<ImportSelectResponse>("/admin/import/confluence/select", body),
      // WP-IC-4 (Schritt 4): KI-Gruppierung (read-only; ehrlicher deterministischer Fallback).
      // WP-SHIP9-S2c (F3): selectedCandidateIds = die in der Vorschau gewählten, zulässigen IDs —
      // der Server gruppiert NUR sie (serverseitig gegen den aktuellen Snapshot validiert).
      group: (body: {
        criteria?: ImportSelectCriteria;
        locale?: ReasonerLocale;
        selectedCandidateIds?: string[];
      }) => api.post<ImportGroupResponse>("/admin/import/confluence/group", body),
      // WP-IC-4 (Schritt 5): Übernahme in die BESTEHENDE Review-Queue (Batch, ehrliche Teil-Bilanz).
      // WP-SHIP9-S2c (F3): selectedCandidateIds beschränkt die Übernahme zusätzlich auf die in der
      // Vorschau gewählten IDs — eine IncludeId außerhalb wird ehrlich als notFound ausgewiesen.
      apply: (body: {
        criteria?: ImportSelectCriteria;
        includeIds: string[];
        snapshotToken?: number;
        selectedCandidateIds?: string[];
      }) => api.post<ImportApplyResponse>("/admin/import/confluence/apply", body),
      // WP-D-CLEAN: zweistufiges Testdaten-Aufräumen (ohne confirm = Vorschau).
      cleanupPreview: () => api.post<ImportCleanupPreview>("/admin/import/cleanup", {}),
      // WP-SHIP8-FIX (bens F2): confirm sendet den Vorschau-Digest mit — der Server vergleicht
      // gegen den aktuellen Bestand (Drift → 409 CLEANUP_DRIFT, nichts wird verändert).
      cleanupConfirm: (digest: string) =>
        api.post<ImportCleanupResult>("/admin/import/cleanup", { confirm: true, digest }),
      // WP-B6: EIN kuratiertes Beispielpaket laden (idempotent).
      loadExamples: (pkg: string) =>
        api.post<ExampleLoadResponse>("/admin/examples/load", { package: pkg }),
      // JOB 3326: die Leseübersetzungen EINES Pakets aus der lokalen Lieferung laden. Idempotent
      // (zweites Laden aktualisiert), legt KEIN Wissensobjekt an und ruft KEIN Modell.
      loadLesevarianten: (pkg: string) =>
        api.post<LesevariantenLadeBilanz>("/admin/lesevarianten/laden", { package: pkg }),
    },
  },
  // JOB 3326: die Leseübersetzungen. Die Übersicht trägt Titel/Kernaussage für Listen und
  // Vorschauen; den Fließtext holt die Leseansicht gezielt je Objekt.
  lesevarianten: {
    uebersicht: (lang: string) =>
      api.get<LesevariantenUebersicht>(`/lesevarianten?lang=${encodeURIComponent(lang)}`),
    fuerKo: (koId: string, lang: string) =>
      api.get<Lesevariante>(
        `/kos/${encodeURIComponent(koId)}/lesevariante/${encodeURIComponent(lang)}`,
      ),
    // JOB 3363: die Prüfkarte in Stufe 2. Sie fragt über die KANDIDATEN-Kennung — der Server löst
    // daraus Provider und Quellkennung auf. Es gibt bewusst keinen Weg, die Lieferung mit einer
    // frei gewählten Quellkennung zu befragen.
    fuerKandidat: (kandidatId: string, lang: string) =>
      api.get<KandidatenLesevariante>(
        `/library/import/candidates/${encodeURIComponent(kandidatId)}/lesevariante/${encodeURIComponent(lang)}`,
      ),
  },
  // AUFTRAG-mega46 Block F: „welche Schalter stehen" — die EINE Auskunft, Ja/Nein je Schalter.
  // Sie ersetzt das Raten am 404 (siehe analytics.expertise): Eine Fläche, die gar nicht gerendert
  // werden soll, kann man nicht an einem Fehlversuch erkennen — man muss vorher fragen dürfen.
  features: {
    get: () => api.get<{ features: FeatureFlags }>("/features"),
  },
  // AUFTRAG-mega67 Block C/D: der ZUGANGS-ZUSTAND des Confluence-Imports — rein lesend, ohne jeden
  // Aufruf an Confluence. Bewusst NICHT im features-Vertrag (der ist auf „Booleans, keine
  // Variablennamen" festgelegt) und bewusst nicht hinter dem Import-Schalter, weil er den Zustand
  // „ausgeschaltet" melden können muss. Begründung ausführlich in import-access-routes.ts.
  importAccess: {
    confluence: () => api.get<ImportAccessStatus>("/import/confluence/zugang"),
  },
  users: {
    list: () => api.get<PublicUser[]>("/users"),
    // JOB 4103 (ERSTEINRICHTUNG-GAST T3): DER ABLAUF REIST IM ANLAGEAUFRUF MIT — additiv, als
    // letztes Argument, und NUR wenn er dasteht.
    //
    // Der Server kann es seit JOB 4011 in EINEM Aufruf (`services/auth/src/routes.ts`, „Wache 1 ·
    // DIE FORM" / „Wache 2 · DIE LESBARKEIT" stehen VOR `register`). Bis hierher rief die
    // Oberfläche es nur nicht auf: sie legte an und befristete danach über `setAccessExpiry` —
    // zwischen beiden Aufrufen stand ein freigegebenes, UNBEFRISTETES Konto, und unterblieb der
    // zweite, blieb es dort.
    //
    // `string | undefined` und NICHT `string | null` wie unten bei `setAccessExpiry`: am
    // Änderungsweg sind `null` („nimm die Befristung") und „fehlt" („ich sage dazu nichts")
    // verschiedene Aussagen, weil es dort eine Vorgeschichte gibt. Beim Anlegen gibt es nichts zu
    // nehmen — `null` und „fehlt" heissen beide „unbefristet" (`routes.ts`, „DREI EINGABEN, ZWEI
    // AUSSAGEN"). Ein `undefined` verschwindet in `JSON.stringify` spurlos; der Rumpf des
    // Bestandswegs bleibt damit unverändert, genau wie bei `role`. Gemessen von A2 in
    // `tests/gast-befristung-flaeche/befristung-ist-bedienbar.test.tsx`
    // (`Object.hasOwn(rumpf, "accessExpiresAt") === false`).
    create: (
      name: string,
      email: string,
      password: string,
      role?: Role,
      accessExpiresAt?: string,
    ) => api.post<PublicUser>("/users", { name, email, password, role, accessExpiresAt }),
    approve: (id: string) => api.post<void>(`/auth/users/${id}/approve`),
    setRole: (id: string, role: Role) => api.put<void>(`/users/${id}`, { role }),
    remove: (id: string) => api.del<void>(`/users/${id}`),
    // SCRUM-148: Admin-Passwort-Reset (eigener Pfad; invalidiert Sitzungen serverseitig).
    resetPassword: (id: string, password: string) =>
      api.post<void>(`/auth/users/${id}/reset`, { password }),
    // JOB 4021 (ERSTEINRICHTUNG-GAST T2): DER EINE WEG, EINE BEFRISTUNG ZU SETZEN UND ZU NEHMEN.
    //
    // Derselbe Endpunkt wie `setRole` — der Server führt Rolle, Freigabe, Passwort und Befristung
    // an EINER Route (`services/auth/src/routes.ts:764-769`). Zwei Dinge sind hier Vertrag und
    // keine Feinheit:
    //
    //   · `null` NIMMT die Befristung, `undefined` sagt gar nichts. `JSON.stringify` lässt ein
    //     `undefined` spurlos verschwinden, und der Server geht über ein fehlendes Feld
    //     ausdrücklich hinweg (`routes.ts:836/839`) — das „Beenden" wäre dann ein Klick, der
    //     nichts tut und Erfolg meldet. Deshalb `string | null` und kein optionales Argument.
    //
    //   · `put<PublicUser>` und nicht `put<void>` wie `setRole`: die Route antwortet mit dem
    //     vollen Konto MIT der soeben geschriebenen Befristung, und sie schreibt sie eigens
    //     ZULETZT, damit genau das stimmt (`routes.ts:833-847`). Wer diese Antwort wegwirft,
    //     zeigt nach dem Speichern den Stand von davor.
    setAccessExpiry: (id: string, accessExpiresAt: string | null) =>
      api.put<PublicUser>(`/users/${id}`, { accessExpiresAt }),
  },
  // ==============================================================================================
  // JOB 4154 · WIKI-GESAMTANWEISUNG — NEUN ADRESSEN, UND JEDE SCHREIBENDE TRÄGT DEN GELESENEN STAND.
  // ==============================================================================================
  //
  // `version` ist bei JEDEM schreibenden Aufruf Pflicht und kein Komfortfeld: der Server bestätigt
  // nur genau den unverändert vorgelegten Prüfstand, und ohne die gelesene Version könnte er
  // „zwischenzeitlich geändert" gar nicht feststellen. Ein Aufruf ohne sie bekommt 400, keiner
  // wird stillschweigend auf den aktuellen Stand gehoben.
  //
  // Die Route ist noch NICHT in `build-app.ts` registriert (die Datei gehört dem Nachfolger
  // WIKI-GESAMTANWEISUNG-ANSCHLUSS). Diese Adressen sind der fertige Draht dorthin; bis der
  // Nachfolger gelaufen ist, antwortet der Server darauf mit 404, und das ist keine Panne, sondern
  // der ehrliche Zwischenstand.
  gesamtanweisung: {
    get: (id: string) => api.get<AnweisungLesestand>(`/gesamtanweisungen/${id}`),
    create: (kopf: AnweisungKopfEingabe) => api.post<Anweisung>("/gesamtanweisungen", kopf),
    updateKopf: (id: string, version: number, kopf: AnweisungKopfEingabe) =>
      api.put<Anweisung>(`/gesamtanweisungen/${id}`, { ...kopf, version }),
    addBaustein: (
      id: string,
      version: number,
      baustein: { koId: string; koVersion: number; nachweisHash: string | null },
    ) => api.post<Anweisung>(`/gesamtanweisungen/${id}/bausteine`, { ...baustein, version }),
    setReihenfolge: (id: string, version: number, reihenfolge: string[]) =>
      api.put<Anweisung>(`/gesamtanweisungen/${id}/reihenfolge`, { reihenfolge, version }),
    // `null` NIMMT die Voraussetzung. `undefined` gäbe es hier nicht: `JSON.stringify` liesse es
    // spurlos verschwinden, und „Voraussetzung entfernen" wäre ein Klick ohne Wirkung.
    setVoraussetzung: (
      id: string,
      version: number,
      bausteinId: string,
      voraussetzung: string | null,
    ) =>
      api.put<Anweisung>(`/gesamtanweisungen/${id}/bausteine/${bausteinId}/voraussetzung`, {
        voraussetzung,
        version,
      }),
    staende: (id: string) => api.get<AnweisungStaende>(`/gesamtanweisungen/${id}/staende`),
    vergleich: (id: string, von: number, bis: number) =>
      api.get<AnweisungVergleich>(`/gesamtanweisungen/${id}/vergleich?von=${von}&bis=${bis}`),
    vorlegen: (id: string, version: number) =>
      api.post<Anweisung>(`/gesamtanweisungen/${id}/vorlegen`, { version }),
    entscheiden: (id: string, version: number, entscheidung: "angenommen" | "abgelehnt") =>
      api.post<Anweisung>(`/gesamtanweisungen/${id}/entscheiden`, { version, entscheidung }),
  },
};
