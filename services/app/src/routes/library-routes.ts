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
// JOB 3095: DER EINE Fußnoten-Scanner des Produkts (WP-BILD-1g) — hier für den Text je Fußnote,
// damit die Bildsuche denselben Klartext liest, den die Persistenz in `captionTexts` schreibt.
import { imageCaptionTexts } from "../../../structure";
import {
  AI_CHECK_JOB_TIMEOUT_MS,
  type AiCheckRunOutcome,
  createAiCheckRunner,
  runWithTimeout,
} from "../ai-check-worker";
import type { SemanticPrefilter } from "../duplicate-detection";
import { schalterAn } from "../feature-flags";
import { type Guards, sendError } from "../http";
import {
  darfSehen,
  sichtbareFuer,
  sichtbarkeitsfilterFuer,
  sqlSichtbarkeitFuer,
} from "../sichtbarkeit";

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

// ================================================================================================
// JOB 3095 · M5 — BILDER FINDEN: EIN VORHANDENES BILD ÜBER SEINE UNTERSCHRIFT, MIT HERKUNFT.
// ================================================================================================
//
// DIE FRAGE, die diese Route beantwortet: „Gibt es im Bestand ein Bild zu <Stichwort>?" — und die
// Antwort ist je Treffer das Bild SAMT seiner Beschreibung, seiner Benennung und seiner Herkunft
// (Quelle, Version, Prüfstand) — und der Auskunft, WORÜBER es gefunden wurde.
//
// DIE ZWEI SUCHFELDER, und warum es genau zwei sind (Runde 2, Pedis Entscheidung 4: „Benennung,
// Bildunterschrift UND Beschreibung"):
//   · BESCHREIBUNG = die `figcaption`. Sie ist im Produkt die „Bildbeschreibung" (so heißt sie an
//     jeder Fläche, `editor.captionPlaceholder`), und die KI schlägt ihren Vorschlag genau DORTHIN
//     vor (WP-BILD-1c, nach Klick des Autors). Ein zweites, gesondert gespeichertes
//     KI-Beschreibungsfeld gibt es im Bestand nicht — es wird deshalb auch nicht durchsucht und
//     nicht behauptet. Unterschrift und Beschreibung sind hier EIN Feld.
//   · BENENNUNG = der `alt`-Text des Bildes (der Editor schreibt beim Einfügen den Dateinamen
//     hinein, `insertImageSrcHtml`/`insertImageHtml`), ersatzweise der Name des Anhangs, auf den
//     ein `/api/objects/<id>/raw`-Bild zeigt. Ein DOCX-Import trägt keinen Namen — dann ist die
//     Benennung ehrlich `null`, nicht erfunden.
// Ein Bild ohne beides ist über diesen Weg nicht auffindbar: es gibt keinen Text, der passen könnte.
//
// WARUM HIER, in der Kompositionswurzel: die Sichtbarkeit fällt an der Route (mega74, BASIC-380),
// der Bestand kommt aus dem Bibliotheksdienst, und der volle Rumpf eines Treffers aus dem
// Wissensobjekt-Dienst. Nur diese Datei kennt alle drei — genau wie beim Re-Import oben.
//
// DER WEG IN DREI SCHRITTEN, jeder mit seiner Grenze:
//   1. KANDIDATEN, BODY-FREI (WP-BILD-1g bleibt: die Suche lädt nie den ganzen Bestand mit Rumpf).
//      Zwei Quellen, beide durch denselben SQL-Trim UND `sichtbareFuer` (G-SHADOW wie
//      `GET /api/library/search`): (a) die body-freie Projektion aller sichtbaren Objekte, aus der
//      die bleiben, deren persistierte `captionTexts` oder deren Anhangsnamen das Stichwort tragen
//      (fehlt `captionTexts` — Altbestand —, bleibt das Objekt Kandidat); (b) die Treffer der
//      Bibliothekssuche selbst (Titel, Kernaussage, Text, Schlagwörter) — ein Objekt, das vom
//      Stichwort handelt, kann das gesuchte Bild tragen, dessen Name nur im `alt` steht.
//   2. Erst für diese wenigen wird der Rumpf geladen (`ko.get`, Papierkorb ausgeblendet) und ein
//      zweites Mal gegen `darfSehen` am vollen Objekt gehalten.
//   3. Aus dem Rumpf kommen Bild, Beschreibung und Benennung je figure über den Scanner unten;
//      je Bild entscheidet DIESELBE Substring-Regel wie die Bibliothekssuche (case-insensitiv), und
//      die Antwort nennt je Treffer die getroffenen Felder. Höchstens `limit` Treffer verlassen die
//      Route; `gedeckelt: true` sagt es NUR, wenn ein weiteres sichtbares, passendes Bild wirklich
//      gefunden wurde (Runde 3) — ein reiner Textkandidat hinter dem Limit ist kein Deckel.
//
// DIE BENANNTE GRENZE: ein Name, der NUR im `alt` eines eingebetteten Bildes steht, in einem
// Objekt, das über Unterschrift, Anhangsname oder Text nicht Kandidat wird, ist nicht auffindbar.
// Ihn body-frei zu finden bräuchte ein persistiertes Namensfeld neben `captionTexts` (Schreibweg
// in knowledge-object/service.ts, außerhalb dieses Auftrags). Das steht in der Rückgabe, nicht
// zwischen den Zeilen.
//
// `thumbnailUrl` IST DIE BILDQUELLE SELBST (`/api/objects/<id>/raw` oder die eingebettete
// data-URL des Imports) — es gibt im Produkt keinen Vorschaudienst, und die Fläche braucht genau
// diese Quelle, um das Bild wieder einzusetzen (der Sanitizer lässt nur sie durch). Das ist ehrlich
// benannt und nicht verkleinert: bei eingebetteten Bildern reist das Bild in voller Größe, deshalb
// der Deckel (Standard 20, höchstens 50).
interface Bestandsbild {
  imageId: string;
  src: string;
  /** Die Beschreibung (figcaption-Klartext); leer, wenn das Bild keine hat. */
  caption: string;
  /** Die Benennung aus dem `alt`-Text; `null`, wenn keine da ist. */
  name: string | null;
}

type Fundstelle = "beschreibung" | "name";

// Die Drahtform eines Treffers — BEWUSST eine Allowlist (kein Spread des Objekts): Rumpf, Stufe,
// Autor und alles weitere bleiben unter Verschluss, bis es hier ausdrücklich freigegeben wird.
// Runde 2: `name` und `gefundenUeber` sind ADDITIV — der Vertrag `treffer/geprueft/gedeckelt`
// (auch für JOB 3096) bleibt, `caption` bleibt ein String (leer = ohne Beschreibung).
interface BildsucheTreffer {
  imageId: string;
  koId: string;
  koTitel: string;
  version: number;
  pruefstand: KnowledgeObject["status"];
  caption: string;
  name: string | null;
  gefundenUeber: Fundstelle[];
  thumbnailUrl: string;
}

const OBJEKT_QUELLE_RE = /^\/api\/objects\/([\w-]+)\/raw$/;

/** Der Anhangsname zu einem `/api/objects/<id>/raw`-Bild — oder `null`, wenn keiner passt. */
function anhangsnameFuer(ko: KnowledgeObject, src: string): string | null {
  const m = OBJEKT_QUELLE_RE.exec(src.trim());
  if (!m) {
    return null;
  }
  const treffer = (ko.attachments ?? []).find((a) => a.objectId === m[1]);
  const name = treffer?.name.trim() ?? "";
  return name.length > 0 ? name : null;
}

/** Trägt ein Objekt body-frei einen Anhang, dessen Name das Stichwort enthält? */
function anhangsnameTrifft(ko: KnowledgeObject, q: string): boolean {
  return (ko.attachments ?? []).some((a) => a.name.toLowerCase().includes(q));
}

const BILDSUCHE_LIMIT_STANDARD = 20;
const BILDSUCHE_LIMIT_MAX = 50;

function bildsucheLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) {
    return BILDSUCHE_LIMIT_STANDARD;
  }
  return Math.min(n, BILDSUCHE_LIMIT_MAX);
}

// Attributwert in einem (kleinen) Öffnungs-Tag — dieselbe Lesart wie `attrOf` in
// apps/web/src/lib/bodyImages.ts: Whitespace VOR dem Namen ist Pflicht (kein `data-src`-Treffer
// für `src`), beliebiger Whitespace um `=`, doppelt/einfach/gar nicht gequotet.
function attributIn(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

const BILD_KENNUNG_RE = /^[\w-]{1,64}$/;

/**
 * Bild und Unterschrift EINER (äußersten) figure als Paare.
 *
 * Gepaart wird über die gemeinsame `data-image-id` — die Identität, die der Server-Sanitizer beim
 * Speichern als Dreifachanker setzt (JOB 509). Eine Fußnote OHNE Kennung geht der Reihe nach an
 * das nächste noch unversorgte Bild (Altbestand vor WP-BILD-1b, dieselbe enge Regel wie in der
 * Galerie `extractBodyImages`); eine fremd gekennzeichnete Fußnote wird NICHT geraten.
 *
 * Der Klartext einer Fußnote kommt aus `imageCaptionTexts` — dem einen Scanner, der auch
 * `captionTexts` schreibt. Leere Fußnoten und Alt-Platzhalter fallen dort weg; ein Bild ohne
 * verbleibende Fußnote hat hier die Beschreibung `""` (Runde 2: es bleibt ein Bild, das über
 * seine Benennung gefunden werden kann).
 */
function bilderEinerFigur(figur: string): Bestandsbild[] {
  const bilder: { id: string; src: string; name: string | null }[] = [];
  const imgRe = /<img\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = imgRe.exec(figur)) !== null) {
    const id = attributIn(m[0], "data-image-id");
    const src = attributIn(m[0], "src");
    if (id && BILD_KENNUNG_RE.test(id) && src) {
      // Die Benennung: der alt-Text, wie ihn der Editor beim Einfügen aus dem Dateinamen setzt.
      // Der Sanitizer hat das Attribut bereits escaped abgelegt; die drei Entities, die er in
      // Attributwerten erzeugt, werden zurückübersetzt — sonst hieße „A&B.png" im Treffer anders
      // als im Bestand.
      const alt = (attributIn(m[0], "alt") ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim();
      bilder.push({ id, src, name: alt.length > 0 ? alt : null });
    }
  }
  if (bilder.length === 0) {
    return [];
  }
  const fussnoten: { id: string | null; text: string }[] = [];
  const capRe = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/gi;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = capRe.exec(figur)) !== null) {
    const [text] = imageCaptionTexts(m[0]);
    if (text === undefined) {
      continue;
    }
    const oeffner = m[0].slice(0, m[0].indexOf(">") + 1);
    fussnoten.push({ id: attributIn(oeffner, "data-image-id"), text });
  }
  const belegt = fussnoten.map(() => false);
  const texte: (string | null)[] = bilder.map(() => null);
  bilder.forEach((bild, i) => {
    const k = fussnoten.findIndex((f, j) => !belegt[j] && f.id === bild.id);
    if (k >= 0) {
      belegt[k] = true;
      texte[i] = fussnoten[k]?.text ?? null;
    }
  });
  bilder.forEach((_bild, i) => {
    if (texte[i] !== null) {
      return;
    }
    const k = fussnoten.findIndex((f, j) => !belegt[j] && (f.id === null || f.id === ""));
    if (k >= 0) {
      belegt[k] = true;
      texte[i] = fussnoten[k]?.text ?? null;
    }
  });
  return bilder.map((bild, i) => ({
    imageId: bild.id,
    src: bild.src,
    caption: texte[i] ?? "",
    name: bild.name,
  }));
}

/**
 * Alle Bild/Unterschrift-Paare eines Rumpfes, je ÄUSSERSTER figure (Tiefenzähler wie in der
 * Galerie, mega89). Body-sparend im Sinne von WP-BILD-1f: die Marken werden per Regex über den
 * Rumpf gesucht (base64 enthält kein `<`), nur die figure-Abschnitte werden ausgeschnitten.
 */
function bestandsbilderAusRumpf(bodyHtml: string | null | undefined): Bestandsbild[] {
  if (!bodyHtml || bodyHtml.indexOf("<figure") < 0) {
    return [];
  }
  const out: Bestandsbild[] = [];
  const marken = /<figure\b|<\/figure\s*>/gi;
  let tiefe = 0;
  let start = -1;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard-Regex-Iteration.
  while ((m = marken.exec(bodyHtml)) !== null) {
    if (m[0].startsWith("</")) {
      tiefe = Math.max(0, tiefe - 1);
      if (tiefe === 0 && start >= 0) {
        out.push(...bilderEinerFigur(bodyHtml.slice(start, marken.lastIndex)));
        start = -1;
      }
      continue;
    }
    if (tiefe === 0) {
      start = m.index;
    }
    tiefe += 1;
  }
  if (start >= 0) {
    // Unbalanciertes Markup (ein `</figure>` fehlt): was noch offen ist, wird ausgeliefert statt
    // still verworfen.
    out.push(...bilderEinerFigur(bodyHtml.slice(start)));
  }
  return out;
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

    // JOB 3095 · M5: Bilder anhand ihrer Unterschrift — Begründung und Weg oben bei `Bestandsbild`.
    app.get<{ Querystring: { q?: string; limit?: string } }>(
      "/api/library/images",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const q = (request.query.q ?? "").trim().toLowerCase();
        if (q.length === 0) {
          // Ohne Stichwort gibt es keine Frage — und damit keine Auslieferung des Bildbestands.
          reply.code(400).send({
            error: "BAD_REQUEST",
            message: "Die Bildsuche braucht ein Suchwort (q).",
          });
          return;
        }
        if (!detection) {
          // Der Rumpf eines Treffers kommt aus dem Wissensobjekt-Dienst, der über das vorhandene
          // Deps-Bündel hereinkommt (build-app.ts reicht es immer). Ohne ihn ist die Suche
          // ehrlich nicht möglich — kein Rückfall auf eine Antwort ohne Bild.
          reply.code(503).send({
            error: "SEARCH_UNAVAILABLE",
            message: "Die Bildsuche ist auf dieser Instanz nicht verfügbar.",
          });
          return;
        }
        const limit = bildsucheLimit(request.query.limit);
        try {
          // Schritt 1: Kandidaten, body-frei, durch SQL-Trim UND `sichtbareFuer` (G-SHADOW).
          const trim = sqlSichtbarkeitFuer(user);
          const kandidaten = new Map<string, KnowledgeObject>();
          // (a) alle sichtbaren Objekte in der body-freien Projektion — bleiben, wenn ihre
          //     persistierten Fußnoten oder ihre Anhangsnamen das Stichwort tragen (Altbestand
          //     ohne `captionTexts` bleibt Kandidat, statt still herauszufallen).
          for (const ko of sichtbareFuer(user, await detection.ko.listForSearch({}, trim))) {
            if (
              ko.captionTexts === undefined ||
              ko.captionTexts.some((caption) => caption.toLowerCase().includes(q)) ||
              anhangsnameTrifft(ko, q)
            ) {
              kandidaten.set(ko.id, ko);
            }
          }
          // (b) die Treffer der Bibliothekssuche — derselbe Weg wie /api/library/search.
          for (const ko of sichtbareFuer(user, await library.search(q, {}, { trim }))) {
            kandidaten.set(ko.id, ko);
          }
          const treffer: BildsucheTreffer[] = [];
          // `gedeckelt` ist eine BESTANDSAUSSAGE („mehr passende Bilder als gezeigt") und wird
          // erst wahr, wenn ein WEITERES sichtbares, passendes Bild NACHGEWIESEN ist (Runde 3,
          // Bens Korrekturpflicht 1). Ein Kandidat, der das Stichwort nur im Text trägt, ist kein
          // Nachweis — die Rümpfe werden deshalb über das Limit hinaus gelesen, bis das erste
          // überzählige Bild gefunden ist; dann ist die Aussage belegt und die Suche endet.
          let gedeckelt = false;
          suche: for (const kandidat of kandidaten.values()) {
            // Schritt 2: nur für die Kandidaten der volle Rumpf — Papierkorb ausgeblendet (`get`),
            // Sichtbarkeit am VOLLEN Objekt ein zweites Mal geprüft (G-SHADOW).
            const ko = await detection.ko.get(kandidat.id);
            if (!ko || !darfSehen(user, ko)) {
              continue;
            }
            // Schritt 3: je Bild beide Felder gegen das Stichwort — und die Antwort sagt, welche.
            for (const bild of bestandsbilderAusRumpf(ko.bodyHtml)) {
              const name = bild.name ?? anhangsnameFuer(ko, bild.src);
              const gefundenUeber: Fundstelle[] = [];
              if (bild.caption.toLowerCase().includes(q)) {
                gefundenUeber.push("beschreibung");
              }
              if (name?.toLowerCase().includes(q)) {
                gefundenUeber.push("name");
              }
              if (gefundenUeber.length === 0) {
                continue;
              }
              if (treffer.length >= limit) {
                // Das überzählige Bild ist da: sichtbar, passend, nicht mehr in der Liste.
                gedeckelt = true;
                break suche;
              }
              treffer.push({
                imageId: bild.imageId,
                koId: ko.id,
                koTitel: ko.title,
                version: ko.version,
                pruefstand: ko.status,
                caption: bild.caption,
                name,
                gefundenUeber,
                thumbnailUrl: bild.src,
              });
            }
          }
          reply.code(200).send({
            treffer,
            // Die Prüfzeit der Antwort — Grundlage des Satzes „geprüft <Zeit>" an der Fläche. Sie
            // steht hier, weil nur der Server weiß, WANN er den Bestand gelesen hat.
            geprueft: new Date().toISOString(),
            gedeckelt,
          });
        } catch (error) {
          sendError(reply, error);
        }
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
