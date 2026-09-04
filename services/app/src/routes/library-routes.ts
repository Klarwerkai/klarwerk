import type { FastifyPluginAsync } from "fastify";
import {
  type ConflictService,
  type OverlapService,
  type OverlapSettingsRepo,
  coreText,
  trigramSimilarity,
} from "../../../conflicts";
import type { KnowledgeObject, KoFilter, KoService } from "../../../knowledge-object";
import type {
  DublettenBefund,
  DublettenPruefung,
  ImportCandidate,
  ImportItem,
  KandidatDublettenbefund,
  LibraryService,
  ReviewAction,
} from "../../../library-analytics";
import { can } from "../../../rbac";
import type { Reasoner } from "../../../reasoner";
import {
  AI_CHECK_JOB_TIMEOUT_MS,
  type AiCheckRunOutcome,
  createAiCheckRunner,
  runWithTimeout,
} from "../ai-check-worker";
import type { SemanticPrefilter } from "../duplicate-detection";
import { schalterAn } from "../feature-flags";
import { type Guards, sendError } from "../http";
import { sichtbareFuer, sichtbarkeitsfilterFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

// Consultant-System (Experten-Matching): Feature-Flag, Default AUS. Vor der BR/DSB-Freigabe bleibt das
// Thema→Personen-Matching unsichtbar (Route antwortet 404, als gäbe es sie nicht). Erst
// KLARWERK_EXPERT_MATCHING=1|true schaltet sie frei.
//
// SCRUM-470 (Confluence-Import): Feature-Flag, Default AUS. Nur wenn aktiv, läuft nach einem
// akzeptierten Import-Kandidaten die Widerspruchs-/Duplikat-Erkennung (S6). Aus = heutiges Verhalten.
//
// AUFTRAG-mega46 Block F: Beide Prüfungen standen hier als eigene Kopie derselben Regel. Sie kommen
// jetzt aus dem EINEN Schalter-Registry (services/app/src/feature-flags.ts) — sonst könnte die neue
// Auskunft an die Oberfläche etwas anderes sagen als das, was diese Datei tut.
function expertMatchingEnabled(): boolean {
  return schalterAn("expertMatching");
}

function confluenceImportEnabled(): boolean {
  return schalterAn("confluenceImport");
}

// SCRUM-470 (ben-Review #2): erlaubte Review-Aktionen — Single Source of Truth für die Route-Validierung.
const REVIEW_ACTIONS: readonly ReviewAction[] = ["accept", "reject", "info"];

// WP-SHIP8-CLOSE-8 (bens GELB-2): explizites Response-DTO der Kandidaten-Ausgabe — interne
// Lease-/Claim-Felder (opId, claimedAt, claimedBy, claimedAction) und die auditPending-Interna
// (eventId, actor, Payload) gehen NIE über den Draht; der Schwebezustand erscheint nur als
// boolescher Ausweis. BEWUSST eine ALLOWLIST (kein Omit/Spread): ein künftiges internes Feld am
// Kandidaten bleibt damit standardmäßig unter Verschluss, bis es hier ausdrücklich freigegeben wird.
interface ImportCandidateDto {
  id: string;
  item: ImportItem;
  status: ImportCandidate["status"];
  duplicate: boolean;
  note: string | null;
  koId: string | null;
  createdAt: string;
  // JOB 3050: WORAUF der Kandidat getroffen ist und WOMIT entschieden wurde — reine Produktdaten
  // (getroffene Id + Ähnlichkeitswert), dieselbe Auskunft, die der direkte Importweg seit JOB 3023
  // in `uebersprungen` gibt. Rein additiv; `duplicate` behält Name und Bedeutung. FEHLT das Feld,
  // ist der Kandidat echter Altbestand (eingereiht vor JOB 3050).
  dublettenbefund?: KandidatDublettenbefund;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewedAction?: ReviewAction;
  // Schwebender Aktionsbeleg — nur als Boolean (Muster Cleanup auditFailed), keine Interna.
  auditPending?: boolean;
}

function toImportCandidateDto(candidate: ImportCandidate): ImportCandidateDto {
  return {
    id: candidate.id,
    item: candidate.item,
    status: candidate.status,
    duplicate: candidate.duplicate,
    note: candidate.note,
    koId: candidate.koId,
    createdAt: candidate.createdAt,
    ...(candidate.dublettenbefund !== undefined
      ? { dublettenbefund: candidate.dublettenbefund }
      : {}),
    ...(candidate.reviewedBy !== undefined ? { reviewedBy: candidate.reviewedBy } : {}),
    ...(candidate.reviewedAt !== undefined ? { reviewedAt: candidate.reviewedAt } : {}),
    ...(candidate.reviewedAction !== undefined ? { reviewedAction: candidate.reviewedAction } : {}),
    ...(candidate.auditPending !== undefined ? { auditPending: true } : {}),
  };
}

// ben-Review #6: schmale, immer sichtbare Log-Linie für best-effort-Erkennung am Import-Accept-Pfad
// (Fastify läuft ohne eigenen Logger) — analog defaultLog des dup-prefilters. Bewusst kein Werfen.
function importDetectionLog(msg: string, err: unknown): void {
  console.warn(`[import-accept-detection] ${msg}`, err);
}

// ================================================================================================
// AUFTRAG-mega29 BLOCK A (bens M28-1) — DER `done`-STATUS, DER VOLLSTÄNDIGKEIT BEHAUPTETE.
// ================================================================================================
//
// mega28 gab dieser Kante einen Status — und baute dabei genau die Zusicherung ein, gegen die er
// schützen sollte. Die Kante rief die BESTANDSFASSADE `judgeConflict`/`judgeDuplicate` auf, die aus
// dem strukturierten Ausgang nur `.verdict` weiterreicht: kein verfügbares Modell, ein vertraulich
// gesperrtes Paar und ein normaler Provider-/Parsefehler verdichten sich dort alle zu `null`, der
// Grund fällt weg. Danach galt nur `aborted`/`skipped` als unvollständig — ein `null` ist keins von
// beidem, also wurde `done` geschrieben. Cloud-only ohne Schlüssel, Reasoner offline, vertrauliches
// Paar ohne zulässiges lokales Modell: in all diesen Fällen behauptete der Accept einen
// abgeschlossenen, vollständigen Lauf, in dem kein einziges inhaltliches Urteil fiel.
//
// GEWÄHLTER WEG (A1): NICHT den Outcome-Vertrag hier ein zweites Mal auslegen, sondern den RUNNER
// selbst wiederverwenden — `createAiCheckRunner` aus dem ai-check-worker. Er ist bereits die eine
// Stelle, die `no-model`, `confidential`, die feine Providerfehler-Klasse (RT-001), geworfene
// Fehler, `skipped` und `aborted` zu genau EINEM ehrlichen Ausgang zusammenführt; seine Deps sind
// strukturgleich mit ImportDetectionDeps. Damit gibt es für dieselbe Regel wieder EINE Umsetzung
// statt zweier, die auseinanderlaufen können — und der von ben als Rest-Inkonsistenz benannte
// Unterschied „Accept meldet capacity, Worker meldet model-error" verschwindet mit.
//
// A2 folgt daraus unmittelbar: `done` entsteht nur, wenn ALLE erforderlichen Ebenen ohne no-model,
// confidential, Providerfehler, skipped und aborted durchgelaufen sind. Jeder andere Ausgang ist
// nicht `done`.
//
// Strikt best-effort wie die Erkennung selbst: der Accept darf daran NIE scheitern (das KO ist zu
// diesem Zeitpunkt längst gespeichert).
async function recordImportAcceptAiCheck(
  ko: KoService,
  koId: string,
  outcome: AiCheckRunOutcome,
): Promise<void> {
  try {
    await ko.recordAiCheckOutcome(koId, {
      ok: outcome.ok,
      ...(outcome.fallbackReason ? { fallbackReason: outcome.fallbackReason } : {}),
      ...(outcome.coverage ? { coverage: outcome.coverage } : {}),
    });
  } catch (err) {
    importDetectionLog(`aiCheck-Vermerk für KO ${koId} fehlgeschlagen`, err);
  }
}

// ================================================================================================
// JOB 3023 — DIE DUBLETTENREGEL DES RE-IMPORTS, HIER GEBAUT UND VON HIER ÜBERGEBEN.
// ================================================================================================
//
// WARUM HIER. `library-analytics` darf die Regel nicht selbst auslegen und `services/conflicts`
// nicht importieren (das wäre eine zweite Auslegung derselben Frage an einem zweiten Ort und eine
// neue Modulkante). Diese Datei ist die Kompositionswurzel des Bibliotheksbereichs — hier treffen
// sich `conflicts` (die Kennzahl) und `library-analytics` (der Port), genau wie in
// `duplicate-detection.ts` `conflicts`, `knowledge-object` und `reasoner` zusammenkommen.
//
// KEIN ZWEITES GEHIRN. Verglichen wird der KERNTEXT (`coreText`, conflicts/index.ts:25 — derselbe
// String, den der Duplikat-Judge vergleicht). Verglichen wird MIT `trigramSimilarity`
// (conflicts/index.ts:29 — deterministisch, DOM-frei, ohne Modell/Embedding-Egress). Keine eigene
// Normalisierung, kein eigener Score, kein Stemmer.
//
// WARUM `trigramSimilarity` AUF DEM KERNTEXT UND NICHT `lexicalOverlapScore`. Der gewichtete Score
// setzt Titel 0,30 / Aussage 0,40 / Bedingungen 0,15 / Maßnahmen 0,15 an — eine Gewichtung für die
// Frage „behandeln zwei GEPFLEGTE Objekte dasselbe". Hier ist die Frage eine andere: „ist das der
// Eintrag, den ich schon habe, nur anders abgetippt". Dafür zählt der ganze Vergleichstext gleich.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 (bens Befund 1) — BEIDE SEITEN AUF DERSELBEN FELDBASIS, SONST IST DER VERGLEICH BLIND.
// ------------------------------------------------------------------------------------------------
//
// Runde 1 baute den Kerntext des IMPORT-EINTRAGS mit leeren `conditions`/`measures` (die trägt ein
// `ImportItem` nicht), den des BESTANDSOBJEKTS aber mit dessen echten Bedingungen und Maßnahmen.
// Das ist kein „ehrlicher leerer Rest", sondern ein ASYMMETRISCHER Vergleich: je gepflegter ein
// Wissensobjekt, desto mehr Text steht nur auf einer Seite und desto kleiner wird die Ähnlichkeit.
// Ben hat genau das gemessen — ein vollständiges Bestandsobjekt mit Bedingungen und Maßnahmen,
// wieder eingespielt mit bloß geänderter Schreibweise, kam auf 0,12 und wurde ein zweites Mal
// angelegt. Der Schutz griff also ausgerechnet dort nicht, wo am meisten zu verlieren ist.
//
// DIE FELDBASIS IST DAHER, WAS BEIDE SEITEN TRAGEN KÖNNEN: Titel und Aussage. Eine Sicherung
// liefert nichts anderes; alles darüber hinaus stünde zwangsläufig nur auf der Bestandsseite.
// Das ist keine neue Position des Produkts, sondern DIESELBE, die der exakte erste Pass seit jeher
// einnimmt: er hält `title|statement` für die Identität eines Eintrags. Der zweite Pass macht aus
// dieser Zeichengleichheit eine Ähnlichkeit — mehr nicht.
//
// WAS DAS KOSTET, ausgeschrieben: Zwei Wissensobjekte mit gleichem Titel und gleicher Aussage, die
// sich NUR in Bedingungen oder Maßnahmen unterscheiden, gelten dem Re-Import als dieselbe Sache.
// Der exakte erste Pass tat das schon vorher, also verschiebt sich hier nichts; und ein Eintrag,
// der so zurückgehalten wird, verschwindet nicht still, sondern steht mit Grund, getroffener koId
// und Wert in der Antwort.
const RE_IMPORT_DUBLETTE_AB = 0.85;
//
// DIE SCHWELLE, AN GENAU EINER STELLE AUSGESCHRIEBEN UND BEGRÜNDET (0,85):
// Es ist die Zahl, mit der das Produkt seit dem Berater-Konzept 04.07. „sehr hohe Textdeckung →
// das ist dasselbe, dafür braucht es kein Modell" meint (`conflicts/src/duplicate-detect.ts:48`,
// DUP_DETERMINISTIC_THRESHOLD). Genau diese Aussage wird hier gebraucht, und eine zweite,
// abweichende Zahl für dieselbe Aussage wäre der Anfang zweier Wahrheiten. Die gemessene Lage:
// derselbe Satz mit Satzpunkt und anderer Groß-/Kleinschreibung liegt nach der Normalisierung von
// `trigramSimilarity` bei 1,0; ein fachlich anderer Eintrag derselben Kategorie liegt weit
// darunter. Bewusst KEINE Admin-Einstellung und KEIN Anfrageparameter: wer die Schwelle mit der
// Anfrage mitschicken könnte, könnte den Schutz mit der Anfrage abschalten.

/**
 * Der Vergleichstext EINER Seite — und es gibt nur diese eine Funktion.
 *
 * Sie ist bewusst die einzige Stelle, an der ein Vergleichstext entsteht: Zwei Aufrufer, die
 * `coreText` je selbst zusammensetzen, können in ihrer Feldauswahl auseinanderlaufen, ohne dass
 * der Compiler etwas merkt — genau das war der Defekt aus Runde 1. Import- und Bestandsseite
 * gehen deshalb durch dieselbe Tür.
 *
 * `conditions`/`measures` sind hier leer, weil sie es auf der Importseite IMMER sind. Sie auf der
 * Bestandsseite zu füllen hieße, gegen Text zu vergleichen, den die andere Seite gar nicht haben
 * kann.
 */
const VERGLEICH_REF = "re-import-vergleich";

function vergleichstext(titel: string, aussage: string): string {
  return coreText({
    refId: VERGLEICH_REF,
    title: titel,
    statement: aussage,
    conditions: [],
    measures: [],
    tags: [],
  });
}

/**
 * Der Vergleichstext eines Bestandsobjekts, je Objekt einmal gerechnet.
 *
 * Der Zwischenspeicher hängt an der OBJEKTIDENTITÄT (`WeakMap`), nicht an der `koId`: ein
 * überarbeitetes Wissensobjekt ist ein anderes Objekt und bekommt darum nie den alten Text — ein
 * id-basierter Zwischenspeicher wäre eine veraltbare zweite Wahrheit.
 */
const kerntextJeObjekt = new WeakMap<KnowledgeObject, string>();

function kerntextVon(ko: KnowledgeObject): string {
  const bekannt = kerntextJeObjekt.get(ko);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const text = vergleichstext(ko.title, ko.statement);
  kerntextJeObjekt.set(ko, text);
  return text;
}

// JOB 3050: DIESELBE Instanz bedient jetzt BEIDE Importwege der Bibliothek — `POST /api/library/import`
// (importJson) und `POST /api/library/import/candidates` (createImportCandidates). Sie bleibt
// dateiintern: ein Export hätte nur Sinn, wenn ein Aufrufer außerhalb dieser Datei sie bräuchte, und
// die beiden Anker-/Re-Sync-Wege des Confluence-Imports stellen die Textfrage per Entscheid nicht
// (SCRUM-510 R2b, Lieferung 9). Es gibt weiterhin GENAU EINE Auslegung dieser Frage im Produkt.
const pruefeReImportDublette: DublettenPruefung = (item, bestand): DublettenBefund => {
  const kerntext = vergleichstext(item.title, item.statement);
  // Der BESTE Treffer, nicht der erste: die Antwort soll das Objekt nennen, dem der Eintrag am
  // nächsten kommt. Bei Gleichstand entscheidet die aufsteigende koId — dieselbe Tiebreak-Regel
  // wie in `selectOverlapCandidates`, damit die Auskunft nicht an der Zeilenreihenfolge der
  // Datenbank hängt.
  let treffer: { koId: string; wert: number } | null = null;
  for (const ko of bestand) {
    const wert = trigramSimilarity(kerntext, kerntextVon(ko));
    if (wert < RE_IMPORT_DUBLETTE_AB) {
      continue;
    }
    if (
      treffer === null ||
      wert > treffer.wert ||
      (wert === treffer.wert && ko.id < treffer.koId)
    ) {
      treffer = { koId: ko.id, wert };
    }
  }
  return treffer === null
    ? { dublette: false }
    : { dublette: true, koId: treffer.koId, aehnlichkeit: treffer.wert };
};

// SCRUM-470 (S6): Deps für die Erkennung nach einem akzeptierten Import-Kandidaten. Dieselben Bausteine,
// die auch der Promote-Pfad (capture-routes) nutzt — hier gebündelt, damit der Route-Layer sie an
// detect*ForKo reichen kann. Optional: fehlt das Bündel, unterbleibt die Erkennung (wie bisher).
export interface ImportDetectionDeps {
  ko: KoService;
  conflicts: ConflictService;
  overlaps: OverlapService;
  overlapSettings: OverlapSettingsRepo;
  reasoner: Reasoner;
  semanticPrefilter?: SemanticPrefilter | undefined;
}

// Bibliothek & Analytics (§2.3/§2.4 / FR-LIB, FR-ANA).
export function libraryRoutes(
  library: LibraryService,
  guards: Guards,
  detection?: ImportDetectionDeps,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: KoFilter & { q?: string } }>(
      "/api/library/search",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const { q, ...filter } = request.query;
        // WP-BILD-1f/1g (bens P4 + sammel14-ROT): die Trefferliste transportiert KEINE Bilddaten —
        // die Suche arbeitet bereits auf der bodyHtml-freien Datenquellen-Projektion; die
        // durchsuchbaren Bild-Fußnoten reisen als kleines persistiertes captionTexts-Feld mit
        // (der Client kennzeichnet damit die Fundstelle). Detailansichten laden einzeln voll.
        //
        // AUFTRAG-mega74 BLOCK B: die Suche gab Titel und Kernaussage vertraulicher Objekte an
        // jeden `ko.read`-Inhaber aus — dieselbe Datei setzte die Regel im Export (:172) und in der
        // Nachbarschaft (:395) längst durch, nur hier nicht. Die Projektion trägt Stufe und Autor
        // mit, also fällt die Entscheidung hier an der Route.
        //
        // ==========================================================================================
        // AUFTRAG-BASIC-380 — DIESELBE ENTSCHEIDUNG REIST JETZT BIS IN DAS SQL.
        // ==========================================================================================
        //
        // `sichtbareFuer` allein war eine Nachfilterung. Solange sie das EINZIGE Tor ist, ist jede
        // spätere Paginierung falsch gebaut: ein `LIMIT` in SQL liefert Zeilen, von denen hier
        // danach getrashte und unsichtbare abgezogen werden — kurze Seiten, überspringende Cursor,
        // und ein Zähler, der eine Existenzauskunft wäre (BASIC 379 §1.2).
        //
        // Ab hier wird DIESELBE Entscheidung zusätzlich als SQL-Prädikat injiziert und wirkt auf der
        // GRUNDMENGE, vor jedem Deckel. Es ist genau die Naht, an der schon `sichtbarkeitsfilterFuer`
        // in die Analytics reist (:351) — nur eine Ebene tiefer.
        //
        // WARUM `sichtbareFuer` TROTZDEM STEHEN BLEIBT, und das ist kein doppelter Gürtel aus
        // Bequemlichkeit: es ist G-SHADOW, wörtlich (`oldAllowed ∧ newAllowed`). Im Übergang darf
        // eine neue Regel Sichtbarkeit NIE erweitern. Ein Dienst oder Adapter, der den Trim
        // (etwa in einem zweiten Aufbau) nicht anwendet, findet hier weiterhin das Tor vor, das
        // seit mega74 hier steht. Die Zusage der Route ändert sich damit nicht — sie wird nur
        // billiger und, was mehr zählt, paginierbar.
        reply
          .code(200)
          .send(
            sichtbareFuer(
              user,
              await library.search(q ?? "", filter, { trim: sqlSichtbarkeitFuer(user) }),
            ),
          );
      },
    );

    app.get<{ Querystring: { format?: string } }>("/api/library/export", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // SCRUM-506: der Export durchsetzt Validiert-only + Vertraulichkeit wie die übrigen Egress-
      // Pfade. Vertrauliche KOs nur für Berechtigte — hier an ko.validate gebunden (Controller/
      // Admin, die den Bestand ohnehin kuratieren). Alle anderen Rollen (viewer/experte) bekommen
      // nur die validierten, nicht-vertraulichen KOs.
      const opts = { includeConfidential: can(user.role, "ko.validate") };
      if (request.query.format === "markdown") {
        reply
          .header("content-type", "text/markdown; charset=utf-8")
          .code(200)
          .send(await library.exportMarkdown(opts));
        return;
      }
      if (request.query.format === "mediawiki") {
        reply
          .header("content-type", "text/plain; charset=utf-8")
          .code(200)
          .send(await library.exportMediaWiki(opts));
        return;
      }
      if (request.query.format === "html") {
        // FR-LIB-02: druckfertiges HTML; PDF entsteht im Browser-Druck.
        reply
          .header("content-type", "text/html; charset=utf-8")
          .code(200)
          .send(await library.exportHtml(opts));
        return;
      }
      reply.code(200).send(await library.exportJson(opts));
    });

    app.post<{ Body: { items: ImportItem[] } }>("/api/library/import", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        // JOB 3023: die Dublettenregel reist als Prädikat mit — der Dienst legt sie nicht aus.
        reply
          .code(200)
          .send(
            await library.importJson(request.body.items ?? [], user.id, pruefeReImportDublette),
          );
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-116: Import-/Source-Review-Kandidaten (JSON-Re-Import mit Review-Queue).
    app.post<{ Body: { items: ImportItem[] } }>(
      "/api/library/import/candidates",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          // WP-SHIP8-CLOSE-8 (bens GELB-2): auch frisch eingereihte Kandidaten laufen durchs DTO.
          // JOB 3050: DIESELBE Instanz der Dublettenregel wie `POST /api/library/import` oben —
          // beide Importwege beantworten die Frage ab hier gleich.
          const created = await library.createImportCandidates(
            request.body.items ?? [],
            user.id,
            pruefeReImportDublette,
          );
          reply.code(201).send(created.map(toImportCandidateDto));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get("/api/library/import/candidates", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // WP-SHIP8-CLOSE-3 (bens ROT-1): LAZY Crash-Recovery festhängender Review-Claims beim
      // Laden der Queue — dasselbe dokumentierte Muster wie der aiCheck-Lazy-Re-Enqueue am
      // Board-Load (kein Cron): eine abgelaufene Lease wird VOLLENDET (KO mit opId-Stempel
      // existiert) oder sicher auf 'neu' zurückgegeben, bevor die Liste antwortet.
      await library.recoverStaleReviewClaims();
      // WP-SHIP8-CLOSE-6 (bens ROT-3b): schwebende Review-Aktionsbelege (auditPending) werden
      // am selben Lazy-Punkt exactly-once nachgezogen.
      await library.retryPendingReviewAudits();
      // WP-SHIP8-CLOSE-8 (bens GELB-2): NIE rohe Kandidatenobjekte auf den Draht — das DTO
      // hält Lease-/Claim-Felder und Beleg-Interna zurück (ko.read-Nutzer sehen nur Produktdaten).
      reply.code(200).send((await library.listImportCandidates()).map(toImportCandidateDto));
    });

    // WP-D-CLEAN (Pedis Entscheid: alle Testdaten löschen, auch Confluence und Jira): ZWEISTUFIGER
    // Admin-Aufräumweg. Ohne confirm → reine VORSCHAU (Zähler, nichts passiert); mit confirm:true →
    // Ausführung: alle KOs mit Import-Provenienz Confluence/Jira in den PAPIERKORB (bestehender
    // Soft-Delete; KOs ohne Import-Provenienz bleiben unangetastet), DANACH die Review-Queue leeren
    // (harte Entfernung — Queue-Einträge kennen keinen Papierkorb; bens F1: der unwiderrufliche
    // Teil kommt ans Ende). Guard wie die übrigen Import-Admin-Wege (users.manage).
    // WP-SHIP8-FIX (bens F2): die Bestätigung BINDET die Vorschau — confirm trägt den Digest der
    // gesehenen Zielmenge; ohne/mit veraltetem Digest antwortet der Service CLEANUP_DRIFT → 409
    // (die UI lädt die Vorschau neu), es wird NICHTS verändert.
    app.post<{ Body: { confirm?: boolean; digest?: string } }>(
      "/api/admin/import/cleanup",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          if (request.body?.confirm !== true) {
            const preview = await library.importCleanupPreview();
            reply.code(200).send({ preview: true, ...preview });
            return;
          }
          const digest = typeof request.body?.digest === "string" ? request.body.digest : undefined;
          const result = await library.runImportCleanup(user.id, digest);
          reply.code(200).send({ preview: false, ...result });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.put<{ Params: { id: string }; Body: { action: ReviewAction; note?: string } }>(
      "/api/library/import/candidates/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.validate", request, reply);
        if (!user) {
          return;
        }
        // SCRUM-470 (ben-Review #2): Review-Aktion an der Route auf die Whitelist prüfen. Der Service
        // behandelt alles außer "reject"/"info" als Accept — ein Tippfehler wie {action:"foo"} würde
        // sonst still ein KO anlegen/revidieren. Ungültige Aktion → 400, kein KO-Write.
        if (!REVIEW_ACTIONS.includes(request.body.action)) {
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "Ungültige Review-Aktion (accept/reject/info).",
          });
          return;
        }
        try {
          const result = await library.reviewImportCandidate(
            request.params.id,
            request.body.action,
            user.id,
            request.body.note,
          );
          // SCRUM-470 (S6): ein akzeptierter Import-Kandidat wird — wie ein promoteter Entwurf im
          // Einreiche-Pfad — auf Widerspruch/Duplikat geprüft. Hinter dem Import-Flag (Default AUS).
          // detect*ForKo sind selbst fehlertolerant (schlucken Fehler intern) → der Accept kann daran
          // nie scheitern. VOR send(), damit das Ergebnis deterministisch sichtbar ist (analog Promote).
          if (detection && confluenceImportEnabled() && result.koId) {
            // AUFTRAG-mega29 A1: DERSELBE Lauf wie im Hintergrund-Worker — kein zweiter Aufbau der
            // Erkennungskette und keine zweite Auslegung, wann ein Lauf „vollständig" war. Der
            // Runner ist selbst best-effort (die detect*-Kerne schlucken ihre Fehler und melden sie
            // über den Ausgang), der Accept kann daran also weiterhin nie scheitern.
            // AUFTRAG-mega31 BLOCK D (bens GELB-1): DIESELBE Frist wie im Hintergrund-Worker
            // (runWithTimeout/AI_CHECK_JOB_TIMEOUT_MS), nicht eine zweite. Vorher wartete die Route
            // unbegrenzt synchron auf den Runner: ein Provider, der nie antwortet, blockierte sie
            // ohne Statusabschluss. Nach Fristablauf gewinnt `failed/timeout`; ein spät doch noch
            // eintreffender Ausgang wird verworfen (runWithTimeout settlet genau EINMAL), sodass
            // der Statusschreib unten eindeutig und einmalig bleibt.
            const outcome = await runWithTimeout(
              createAiCheckRunner({
                ko: detection.ko,
                conflicts: detection.conflicts,
                overlaps: detection.overlaps,
                overlapSettings: detection.overlapSettings,
                reasoner: detection.reasoner,
                semanticPrefilter: detection.semanticPrefilter,
              })(result.koId),
              AI_CHECK_JOB_TIMEOUT_MS,
            );
            await recordImportAcceptAiCheck(detection.ko, result.koId, outcome);
          }
          // WP-SHIP8-CLOSE-8 (bens GELB-2): dieselbe DTO-Grenze wie am Queue-Load — die Antwort
          // der Review-Aktion trägt keine Claim-/Beleg-Interna (auditPending nur als Boolean).
          reply.code(200).send(toImportCandidateDto(result));
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get("/api/analytics", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega76 BLOCK D: dieselbe Übergabe wie /api/graph darunter — die Entscheidung
      // fällt hier, der Dienst wendet sie auf seine Grundmenge an.
      reply.code(200).send(await library.analytics({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });

    app.get("/api/analytics/busfactor", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.busFactor({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });

    // Consultant-System (Experten-Matching): Thema → beitragende Personen. Hinter Feature-Flag
    // (Default AUS → 404) und ENGER als die übrigen Analytics: nur ko.assign (controller/admin), die
    // real entscheiden „wen einbeziehe ich". Personen-Matching ist datenschutzsensibel (BetrVG §87(1)6,
    // DSGVO) — scharf erst nach BR/DSB-Freigabe.
    app.get("/api/analytics/expertise", async (request, reply) => {
      if (!expertMatchingEnabled()) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      const user = await guards.requirePermission("ko.assign", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await library.expertise());
    });

    app.get("/api/graph", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega74 BLOCK B: der Graph trug Titel aller Objekte. Die Entscheidung fällt hier
      // (Kompositionswurzel) und reist als Datum in den Dienst; er wendet sie auf die Grundmenge an.
      //
      // JOB 3022: die Antwort trägt seit dem Schlagwort-Index ihre eigenen Grenzen mit
      // (`totalEdges`, `truncated`, `edgeLimit`, `excludedTags`). Sie geht UNVERÄNDERT hinaus —
      // die Route rechnet nichts nach, kürzt nichts weg und kennt bewusst KEINEN Anfrageparameter:
      // ein client-setzbarer Deckel wäre kein Schutz. Wer die Grenzen anzeigen will, liest die
      // Felder; wer sie ignoriert, liest wie bisher `nodes`/`edges`.
      reply.code(200).send(await library.graph({ sichtbar: sichtbarkeitsfilterFuer(user) }));
    });

    // AUFTRAG-mega68: die Nachbarschaft EINES Wissensobjekts — die Anwendersicht des Wissensnetzes
    // (Detailseite). Begrenzt (NEIGHBOR_LIMIT) und ohne Bestands-Paarvergleich; Regel und
    // Komplexität am Service (library-analytics neighbors()).
    //
    // HIER, IN DER KOMPOSITIONSWURZEL, FÄLLT DIE RECHTEENTSCHEIDUNG — dieselbe SCRUM-506-Regel wie
    // Bibliotheks-Export und Herkunftskette (provenance-routes): Vertrauliches sehen nur Rollen mit
    // `ko.validate`. Der Service bekommt die Entscheidung als DATUM und filtert fail-closed; ein
    // unsichtbarer Nachbar fehlt auch in den Zählern. Das ZENTRUM selbst folgt bewusst dem
    // BESTEHENDEN Lesepfad (GET /api/kos/:id liefert jedem ko.read-Inhaber auch Vertrauliches —
    // die ehrliche Grenze aus mega45); diese Route gibt vom Zentrum ohnehin nur zurück, was die
    // Detailseite bereits zeigt.
    app.get<{ Params: { id: string } }>("/api/kos/:id/neighbors", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        // AUFTRAG-mega74 BLOCK F: hier stand `includeConfidential = can(user.role,"ko.validate")` —
        // eine EIGENE Kopie der SCRUM-506-Regel. Sie ist durch das eine Prädikat ersetzt; ohne das
        // gäbe es nach Block A zwei Orte mit unterschiedlicher Antwort (der Autor fehlte hier).
        // Das ZENTRUM bekommt dasselbe Tor wie der Hauptlesepfad — der Dienst wirft NOT_FOUND
        // (→ 404), wenn es unter derselben Entscheidung nicht sichtbar ist.
        reply
          .code(200)
          .send(
            await library.neighbors(request.params.id, { sichtbar: sichtbarkeitsfilterFuer(user) }),
          );
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
