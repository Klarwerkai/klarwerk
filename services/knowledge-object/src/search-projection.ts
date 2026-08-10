import { createHash } from "node:crypto";
// WP-BILD-1g/1h: der EINE kanonische Fußnoten-Scanner samt Größendeckel (structure-Modul). Die
// Projektion baut ihren `caption_text` NICHT selbst — sonst gäbe es eine zweite Auslegung davon,
// was eine Bildunterschrift ist (Alt-Platzhalter zählen nicht, 500 Zeichen je Fußnote, 50 je KO).
import { decodeHtmlEntities, searchCaptionTexts } from "../../structure";
import { isValidConfidentiality } from "./confidentiality";
import type { Confidentiality, KnowledgeObject, KoVersionSnapshot } from "./types";

// ================================================================================================
// G27 — DIE REVISIONSGEBUNDENE SUCHPROJEKTION. DIESE DATEI IST IHRE REINE REGEL.
// ================================================================================================
//
// WAS SIE LÖST. Bis G27 war der durchsuchbare Text eines Wissensobjekts das Kurzfeld: Titel,
// `statement`, Kategorie, Schlagwörter und (seit WP-BILD-1g) die Bild-Fußnoten. Der eigentliche
// Dokumentinhalt — `bodyHtml`, also das, was der Mensch geschrieben und gelesen hat — war
// unauffindbar. Ein Begriff, der erst nach Zeichen 500 des Fließtexts steht, existierte für die
// Bibliothek und für Klara schlicht nicht.
//
// WARUM NICHT ON-THE-FLY. Ein Scan des `bodyHtml` zur Suchzeit ist genau der Weg, den WP-BILD-1f
// aus gutem Grund verlassen hat: ein Body trägt megabyte-große base64-Bilddaten, und ein
// Voll-Load je Suchanfrage über den ganzen Bestand ist keine Suche, sondern ein Denial-Weg gegen
// sich selbst. Die Projektion wird deshalb EINMAL je Inhaltsversion erzeugt und persistiert.
//
// WARUM VERSIONSGEBUNDEN. Eine Projektion ohne Versionsbindung wäre eine zweite, konkurrierende
// Wahrheit über den Inhalt: sie könnte einer Fassung nachlaufen, die es nicht mehr gibt, und
// niemand könnte sagen, welchem Stand ein Treffer entspricht. Der Schlüssel ist deshalb
// (ko_id, ko_version) — und die Standardsuche sieht ausschließlich die Projektion der AKTIVEN
// KO-Version (Architektur-Mikroentscheidung G27, Abschnitt „Aktiver Datensatz").
//
// WAS SIE NICHT IST. Keine neue fachliche Wahrheit, kein Editierfeld, keine Chunks, keine
// Embeddings, kein Spaces-/Wissenseinheitsmodell. `statement` bleibt unverändert das Kurzfeld.
//
// ================================================================================================
// G27 WELLE 1 / S1 — DIE PROJEKTIONSGRENZE (KW-ARCH-G27, Abschnitte 2, D, H)
// ================================================================================================
//
// WAS SICH GEGENÜBER FASSUNG 1 ÄNDERT UND WARUM.
//
// 1 KATEGORIE UND SCHLAGWÖRTER SIND HIER RAUS. Sie sind im Domänenmodell versionslose Metadaten:
//   `updateCategory`/`updateTags` erzeugen ausdrücklich KEINEN Versions-Bump. In einer append-only
//   Zeile an (ko_id, ko_version) wären sie damit planmäßig veraltet — die Suche würde einen Wert
//   zeigen, den das Objekt nicht mehr trägt. Ihr Ort ist die MUTABLE METADATA PROJECTION
//   (metadata-projection.ts), Schlüssel `ko_id`, mit eigener `metadata_revision`. Der äußere
//   Suchvertrag verliert sie nicht: das EFFECTIVE SEARCH DOCUMENT setzt beide Hälften zusammen
//   (effective-search-document.ts).
//
// 2 `body_text` IST EINE EIGENE SPALTE. Vorher ging der sichtbare Dokumenttext nur im gemischten
//   `search_text` auf. Ein Feld kann aber nicht zugleich autoritative Body-Repräsentation UND frei
//   transformierter Suchtext sein (Detailentscheidung A) — aus normalisiertem Suchtext lässt sich
//   kein Body rekonstruieren. `body_text` wird deshalb SEPARAT persistiert und NIE aus
//   `search_text` zurückgerechnet.
//
// 3 `classification_snapshot` IST NEU. Die Zeile trägt die revisionsgebundene, HISTORISCHE
//   Sicherheitsreferenz (Detailentscheidung B/I). Sie ist ein Hinweis auf den damaligen Zustand,
//   NIEMALS eine Zugriffsentscheidung: das Live-Gate prüft ausschließlich den aktuellen KO-/Policy-
//   Zustand. Fehlt eine Vertraulichkeit, steht dort ausdrücklich `none` — und `none` ist keine
//   Freigabe, sondern die ehrliche Aussage „hier stand nichts".
//
// 4 QUELLEN-/PROVENIENZTEXTE BLEIBEN DRAUSSEN. `sources[].label/excerpt` sind im G27-Ziel nicht
//   suchbar (Detailentscheidung C) — weder in `search_text` noch im `content_hash` noch in dieser
//   Projektion. Eine spätere Suchbarkeit braucht einen eigenen ADR.

// Die Fassung der NORMALISIERUNGSREGEL UND DER FELDGRENZE. Sie steht in jeder Zeile und geht in den
// `content_hash` ein: ändert sich die Regel, ändert sich der Hash, und ein Rebuild ist an der Zahl
// erkennbar fällig. Ohne diese explizite Fassung wäre „Rebuild liefert denselben Hash" eine Aussage
// über nichts — man wüsste nicht, gegen welche Regel gemessen wurde.
//
// FASSUNG 2 (Detailentscheidung D): neue Feldgrenze, eigenes `body_text`, Kategorie/Schlagwörter aus
// der Content Projection entfernt, `classification_snapshot`, neuer Hashvertrag. Eine Zeile mit
// `projection_version = 1` ist semantisch INKOMPATIBEL und wird als solche erkannt (der Backfill
// führt sie auf Fassung 2 nach, `inventoryByProjectionVersion` macht den Mischbestand sichtbar).
export const SEARCH_PROJECTION_VERSION = 2;

// EHRLICH UNBESTIMMT. Das Produkt hat keine Spracherkennung und das Wissensobjekt kein
// Sprachfeld. Ein hart gesetztes „de" wäre eine Behauptung über fremden Inhalt (Klarwerk-Bestände
// tragen deutsche, englische und niederländische Texte) — „und" ist der ISO-639-2-Code für
// „undetermined" und sagt genau das, was wir wissen: nichts. Das Feld bleibt im Vertrag, damit
// eine spätere, echte Erkennung es füllen kann, ohne die Tabelle zu ändern.
export const SEARCH_PROJECTION_LANGUAGE = "und";

// Harte Obergrenze des persistierten Suchtexts je Version. Ein `bodyHtml` ist nach oben nur durch
// die Objektgrenze gedeckelt; ohne Schnitt wüchse eine einzelne Projektionszeile beliebig. 200.000
// Zeichen sind ~40 Normseiten reiner Fließtext und liegen weit über jedem realen Wissensobjekt.
// WIRD GESCHNITTEN, SAGT DIE ZEILE DAS (status "unvollstaendig") — die Projektion behauptet nie
// eine Vollständigkeit, die sie nicht hat (Umsetzungspflicht 3).
export const MAX_SEARCH_TEXT_LENGTH = 200_000;

// Der Zustand EINER Projektionszeile — und zwar ihrer eigenen Herleitung, nicht des Wissensobjekts.
// Bewusst NICHT der KO-Status (offen/validiert): der wandert ohne neue Inhaltsversion (eine
// Validierung erzeugt keine Version), eine versionsgebundene Kopie davon wäre also planmäßig
// veraltet. Wer den KO-Status braucht, liest ihn am Wissensobjekt — dort ist er wahr.
export type SearchProjectionStatus = "vollstaendig" | "unvollstaendig";

// ------------------------------------------------------------------------------------------------
// DIE REVISIONSGEBUNDENE KLASSIFIZIERUNGSREFERENZ (Detailentscheidungen B und I)
// ------------------------------------------------------------------------------------------------
//
// WAS SIE IST: die Aussage „so war dieses Objekt eingestuft, als DIESE Inhaltsversion entstand".
// Sie liegt in der unveränderlichen Zeile, weil ein späterer Vertraulichkeitswechsel die Geschichte
// nicht umschreiben darf.
//
// WAS SIE NICHT IST — und das ist der wichtigere Satz: KEINE ZUGRIFFSENTSCHEIDUNG. Die aktive
// Erlaubnis wird ausschließlich live am aktuellen KO-/Policy-Zustand geprüft. Ein historischer
// Snapshot erteilt niemals Zugriff, gibt niemals frei, entscheidet niemals über Export oder
// KI-Policy. Wer ihn dafür benutzte, autorisierte gegen einen Zustand, den es nicht mehr gibt.
//
// KEIN EIGENES KLASSIFIZIERUNGSOBJEKT: G27 erfindet kein versioniertes Klassifizierungsaggregat
// (das braucht später einen eigenen ADR). Deshalb keine künstliche `classification_ref`-Id, sondern
// ein kleiner, benannter Snapshot mit ausgeschriebener Herkunft.

/** Der Wert. `none` heißt AUSDRÜCKLICH „keine Einstufung erfasst" — und ist nie eine Freigabe. */
export type ClassificationValue = Confidentiality | "none";

/** Die einzige Quelle, die es im heutigen Modell gibt (Detailentscheidung B). */
export const CLASSIFICATION_SOURCE = "knowledge_object.confidentiality" as const;

/**
 * WOHER der Wert stammt. Die Unterscheidung ist die ganze Pointe von Abschnitt I: ein zur
 * Revisionszeit erfasster Wert und eine nachträgliche Rekonstruktion dürfen nie verwechselbar sein.
 *
 * · `captured_at_version` — beim Wirksamwerden DIESER Inhaltsversion am lebenden Objekt gelesen.
 * · `ko_version_snapshot` — aus dem unveränderlichen `KoVersionSnapshot` dieser Version gelesen.
 * · `reconstructed_from_current_ko` — BESTVERFÜGBARE Rekonstruktion aus dem heutigen Objektstand,
 *   weil es für einen Legacy-V1-Bestand keinen unveränderlichen Versionsstand gibt. Nur historischer
 *   Hinweis, keine bestätigte historische Wahrheit.
 */
export type ClassificationProvenance =
  | "captured_at_version"
  | "ko_version_snapshot"
  | "reconstructed_from_current_ko";

/** `verified` ausschließlich für revisionszeitlich erfasste Werte — NIE für Rekonstruktionen. */
export type ClassificationConfidence = "verified" | "unknown";

/**
 * Die DETERMINISTISCHE Zeitquelle (Abschnitt I). Die Reihenfolge ist verbindlich; `now` ist als
 * vermeintlich historischer Zeitpunkt ausdrücklich verboten.
 *
 *   1 `version_event`          — Zeitstempel des tatsächlichen Versions-Erzeugungsereignisses.
 *   2 `ko_version_created_at`  — `created_at` der KO-Version.
 *   3 `ko_created_at`          — `created_at` des Wissensobjekts.
 *   4 `unknown`                — nichts davon verfügbar ⇒ `captured_at = null`.
 */
export type CapturedAtSource =
  | "version_event"
  | "ko_version_created_at"
  | "ko_created_at"
  | "unknown";

export interface ClassificationSnapshot {
  value: ClassificationValue;
  source: typeof CLASSIFICATION_SOURCE;
  koVersion: number;
  capturedAt: string | null;
  capturedAtSource: CapturedAtSource;
  provenance: ClassificationProvenance;
  historicalConfidence: ClassificationConfidence;
}

/**
 * Der Klassifizierungswert eines Objekts für die Projektion.
 *
 * BEWUSST NICHT `normalizeConfidentiality`: die normalisiert fehlende Werte defensiv auf „intern"
 * und BEHAUPTET damit eine Einstufung, die nie jemand gesetzt hat. Für eine historische Aussage ist
 * das falsch — hier steht `none` und sagt die Wahrheit. Kein `none`, wenn ein gültiger aktueller
 * Wert existiert (Abschnitt I, No-Go 1).
 */
export function classificationValueOf(ko: {
  confidentiality?: Confidentiality | null;
}): ClassificationValue {
  return isValidConfidentiality(ko.confidentiality) ? ko.confidentiality : "none";
}

/**
 * Die deterministische Auswahl von `captured_at` samt Quellenangabe. Alle vier Stufen stehen hier
 * ausgeschrieben, auch die im heutigen Datenmodell (noch) nicht materialisierte: eine KO-Version hat
 * bei uns genau EINEN Zeitstempel (`KoVersionSnapshot.at`, Stufe 1) und kein zweites eigenes
 * `created_at`. Die Stufe bleibt trotzdem im Vertrag, damit ein späteres Versionsmodell sie füllen
 * kann, ohne die Reihenfolge neu zu verhandeln.
 */
export function resolveCapturedAt(evidence: {
  versionEventAt?: string | null;
  koVersionCreatedAt?: string | null;
  koCreatedAt?: string | null;
}): { capturedAt: string | null; capturedAtSource: CapturedAtSource } {
  if (evidence.versionEventAt) {
    return { capturedAt: evidence.versionEventAt, capturedAtSource: "version_event" };
  }
  if (evidence.koVersionCreatedAt) {
    return { capturedAt: evidence.koVersionCreatedAt, capturedAtSource: "ko_version_created_at" };
  }
  if (evidence.koCreatedAt) {
    return { capturedAt: evidence.koCreatedAt, capturedAtSource: "ko_created_at" };
  }
  return { capturedAt: null, capturedAtSource: "unknown" };
}

/** Der Schreibweg: die Einstufung wird GELESEN, während diese Version wirksam wird. */
export function classificationAtVersion(
  ko: KnowledgeObject,
  at: string | null,
): ClassificationSnapshot {
  const { capturedAt, capturedAtSource } = resolveCapturedAt({
    versionEventAt: at,
    koCreatedAt: ko.createdAt,
  });
  return {
    value: classificationValueOf(ko),
    source: CLASSIFICATION_SOURCE,
    koVersion: ko.version,
    capturedAt,
    capturedAtSource,
    provenance: "captured_at_version",
    historicalConfidence: "verified",
  };
}

/** Der Rebuild-Weg MIT echtem unveränderlichem Versionsstand — belastbar, also `verified`. */
export function classificationFromVersionSnapshot(
  snapshot: KoVersionSnapshot,
): ClassificationSnapshot {
  const { capturedAt, capturedAtSource } = resolveCapturedAt({
    versionEventAt: snapshot.at,
    koCreatedAt: snapshot.snapshot?.createdAt,
  });
  return {
    value: classificationValueOf(snapshot.snapshot ?? {}),
    source: CLASSIFICATION_SOURCE,
    koVersion: snapshot.version,
    capturedAt,
    capturedAtSource,
    provenance: "ko_version_snapshot",
    historicalConfidence: "verified",
  };
}

/**
 * Der Rebuild-Weg OHNE echten Versionsstand (Legacy V1, Abschnitt I): bestverfügbarer Wert, strikt
 * als Rekonstruktion gekennzeichnet. `historical_confidence` ist hier IMMER `unknown` — ein
 * rekonstruierter Wert wird niemals als bestätigter historischer Snapshot ausgegeben.
 */
export function reconstructedClassification(ko: KnowledgeObject): ClassificationSnapshot {
  const { capturedAt, capturedAtSource } = resolveCapturedAt({ koCreatedAt: ko.createdAt });
  return {
    value: classificationValueOf(ko),
    source: CLASSIFICATION_SOURCE,
    koVersion: ko.version,
    capturedAt,
    capturedAtSource,
    provenance: "reconstructed_from_current_ko",
    historicalConfidence: "unknown",
  };
}

/** Ist der Wert eine bestätigte historische Aussage — oder nur ein rekonstruierter Hinweis? */
export function isReconstructedClassification(snapshot: ClassificationSnapshot): boolean {
  return snapshot.provenance === "reconstructed_from_current_ko";
}

// Kanonische Serialisierung für die Persistenz UND für den `content_hash` (Detailentscheidung J):
// FESTE Schlüsselreihenfolge, damit dieselbe Aussage nie zwei verschiedene Textfassungen hat (und
// ein Zeilenvergleich wie ein Hashvergleich etwas bedeutet).
//
// EINE Serialisierung für beide Zwecke, bewusst: eine zweite, hash-eigene Textfassung wäre eine
// zweite Auslegung derselben sieben Felder — und die eine könnte sich bewegen, ohne dass die andere
// es merkt. `source` ist hier strukturell (`string`) statt literal typisiert, damit der Hashweg
// genau DEN Wert serialisiert, den er bekommen hat, und nicht stillschweigend die Konstante
// einsetzt; ein `ClassificationSnapshot` passt unverändert hinein.
export function serializeClassificationSnapshot(snapshot: {
  value: ClassificationValue;
  source: string;
  koVersion: number;
  capturedAt: string | null;
  capturedAtSource: CapturedAtSource;
  provenance: ClassificationProvenance;
  historicalConfidence: ClassificationConfidence;
}): string {
  return JSON.stringify([
    snapshot.value,
    snapshot.source,
    snapshot.koVersion,
    snapshot.capturedAt,
    snapshot.capturedAtSource,
    snapshot.provenance,
    snapshot.historicalConfidence,
  ]);
}

// DIE UNBELEGTE LAGE — die vier Belegfelder in ihrer ehrlichsten Ausprägung: kein Zeitpunkt, keine
// Zeitquelle, keine bestätigte Geschichte, ausdrücklich als Rekonstruktion gekennzeichnet. EINE
// Definition für beide Stellen, die sie brauchen (der fail-safe Parse einer leeren/unlesbaren Zelle
// und der Hash ohne übergebene Beleglage) — zwei Kopien wären zwei Gelegenheiten, aus Versehen eine
// davon auf `verified` rutschen zu lassen.
const UNBELEGTE_LAGE = {
  capturedAt: null,
  capturedAtSource: "unknown",
  provenance: "reconstructed_from_current_ko",
  historicalConfidence: "unknown",
} as const satisfies {
  capturedAt: string | null;
  capturedAtSource: CapturedAtSource;
  provenance: ClassificationProvenance;
  historicalConfidence: ClassificationConfidence;
};

// Gegenstück zur Serialisierung. FAIL-SAFE, nicht fail-open: ist die Zelle leer oder unlesbar (eine
// Zeile aus einer fremden/älteren Fassung), entsteht ein Snapshot mit `none` und `unknown` — also
// ausdrücklich KEINE Einstufung und ausdrücklich KEINE bestätigte Geschichte. Nie „intern", nie
// „verified", nie eine Freigabe.
export function parseClassificationSnapshot(
  raw: string | null | undefined,
  koVersion: number,
): ClassificationSnapshot {
  const unbekannt: ClassificationSnapshot = {
    value: "none",
    source: CLASSIFICATION_SOURCE,
    koVersion,
    ...UNBELEGTE_LAGE,
  };
  if (!raw) {
    return unbekannt;
  }
  try {
    const teile = JSON.parse(raw) as unknown[];
    if (!Array.isArray(teile) || teile.length !== 7) {
      return unbekannt;
    }
    const [value, , version, capturedAt, capturedAtSource, provenance, confidence] = teile;
    return {
      value: (value === "none" || isValidConfidentiality(value) ? value : "none") as
        | ClassificationValue
        | "none",
      source: CLASSIFICATION_SOURCE,
      koVersion: typeof version === "number" ? version : koVersion,
      capturedAt: typeof capturedAt === "string" ? capturedAt : null,
      capturedAtSource: (typeof capturedAtSource === "string"
        ? capturedAtSource
        : "unknown") as CapturedAtSource,
      provenance: (typeof provenance === "string"
        ? provenance
        : "reconstructed_from_current_ko") as ClassificationProvenance,
      // Fail-safe: alles, was nicht ausdrücklich `verified` sagt, gilt als unbestätigt.
      historicalConfidence: confidence === "verified" ? "verified" : "unknown",
    };
  } catch {
    return unbekannt;
  }
}

/**
 * DER KANONISCHE FELDVERTRAG DER IMMUTABLE CONTENT PROJECTION (Fassung 2).
 *
 * Was hier steht, gehört zur INHALTSVERSION (ko_id, ko_version) und ist nach dem Schreiben
 * unveränderlich. Was zur versionslosen Metadatenlage gehört (Kategorie, Schlagwörter), steht
 * ausdrücklich NICHT hier — s. metadata-projection.ts.
 */
export interface KoSearchProjection {
  koId: string;
  koVersion: number;
  projectionVersion: number;
  searchText: string;
  titleText: string;
  statementText: string;
  captionText: string;
  // Detailentscheidung A: eigene, revisionsgebundene Spalte. NIE aus `searchText` rekonstruiert.
  bodyText: string;
  language: string;
  contentHash: string;
  status: SearchProjectionStatus;
  classificationSnapshot: ClassificationSnapshot;
  createdAt: string;
  updatedAt: string;
}

// Der Feldvertrag als Datum — damit ein Test ihn prüfen kann, statt ihn abzuschreiben. Die
// Reihenfolge ist die der Architekturentscheidung und die der Tabellenspalten.
export const SEARCH_PROJECTION_FIELDS = [
  "koId",
  "koVersion",
  "projectionVersion",
  "searchText",
  "titleText",
  "statementText",
  "captionText",
  "bodyText",
  "language",
  "contentHash",
  "status",
  "classificationSnapshot",
  "createdAt",
  "updatedAt",
] as const;

// Die INHALTLICHEN Felder DIESER Projektion, aus denen ein Treffer entstehen kann. `searchText` ist
// ihre Vereinigung und steht deshalb nicht in der Liste. Kategorie und Schlagwörter fehlen hier
// nicht aus Versehen: sie sind kein Inhalt dieser Revision (s. Kopf).
export const SEARCH_PROJECTION_MATCH_FIELDS = [
  "titleText",
  "statementText",
  "captionText",
  "bodyText",
] as const;

// ------------------------------------------------------------------------------------------------
// SICHTBARER TEXT AUS bodyHtml
// ------------------------------------------------------------------------------------------------
//
// Ein Suchindex, der `<script>`-Inhalt, CSS-Regeln oder ausgeblendete Fragmente aufnimmt, macht
// Dinge auffindbar, die der Mensch im Dokument NIE gesehen hat. Das ist nicht nur unsauber,
// sondern eine Kante: wer einen Body einschleusen kann, könnte ein Objekt unter Begriffen
// auffindbar machen, die niemand darin liest. Deshalb wird hier nicht „Tags entfernt", sondern
// der Inhalt der unsichtbaren Elemente ÜBERSPRUNGEN.
//
// `<figcaption>` wird EBENFALLS übersprungen — nicht weil es unsichtbar wäre, sondern weil es
// bereits einen kanonischen Weg hat (searchCaptionTexts: Alt-Platzhalter sind kein Inhalt, 500
// Zeichen je Fußnote, 50 je Objekt). Beide Wege nebeneinander wären zwei Auslegungen derselben
// Sache, und die zweite hätte die Deckel des Originals nicht.
const SKIP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "head",
  "title",
  "figcaption",
]);

// HTML-Void-Elemente: sie haben keinen Inhalt, also auch nichts zu überspringen, und sie erhöhen
// die Verschachtelungstiefe nicht.
const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Wie viel vom Tag-Kopf für die Attributprüfung überhaupt angesehen wird. Ein `<img>` mit
// eingebettetem base64-Bild ist mehrere Millionen Zeichen lang; einen solchen Attributblock zu
// materialisieren und mit Regex zu durchsuchen wäre genau der Kostenweg, den WP-BILD-1f
// abgeschafft hat. Reale Auszeichnungs-Tags (die einzigen, die Inhalt verbergen KÖNNEN — Void-
// Elemente haben keinen) bleiben weit darunter.
const MAX_TAG_HEAD_INSPECT = 4096;

function tagNameOf(head: string): string {
  const match = /^\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(head);
  return match?.[1]?.toLowerCase() ?? "";
}

// Ausgeblendet im Sinne dieser Projektion: das `hidden`-Attribut, `aria-hidden="true"` oder eine
// Inline-Regel, die das Element aus der Darstellung nimmt. Bewusst konservativ — was hier NICHT
// erkannt wird, landet im Index (fail-visible), und was erkannt wird, ist eindeutig unsichtbar.
function istVerborgen(head: string): boolean {
  const probe = head.length > MAX_TAG_HEAD_INSPECT ? head.slice(0, MAX_TAG_HEAD_INSPECT) : head;
  if (/\shidden(\s|=|\/|$)/i.test(probe)) {
    return true;
  }
  if (/\saria-hidden\s*=\s*["']?\s*true/i.test(probe)) {
    return true;
  }
  return /\sstyle\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden)/i.test(probe);
}

/**
 * Der SICHTBARE Text eines `bodyHtml` — einmaliger Vorwärtslauf, ohne den Body zu duplizieren.
 *
 * Attributwerte (und damit eingebettete base64-Bilddaten) werden NIE in ein Ergebnis kopiert; nur
 * der Text ZWISCHEN den Tags zählt. Jede Tag-Grenze wird zur Wortgrenze (ein Leerzeichen), damit
 * `<p>a</p><p>b</p>` zu „a b" und nicht zu „ab" wird.
 */
export function visibleTextFromBodyHtml(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  const stuecke: string[] = [];
  let i = 0;
  let tiefe = 0;
  // Tiefe, AB der übersprungen wird (-1 = nichts überspringen). Das schließende Tag, das die
  // Tiefe wieder unter diesen Wert bringt, beendet den Sprung — verschachtelte Elemente im
  // übersprungenen Bereich fallen damit automatisch mit weg.
  let skipAb = -1;
  const len = html.length;
  while (i < len) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      if (skipAb < 0) {
        stuecke.push(html.slice(i));
      }
      break;
    }
    if (skipAb < 0 && lt > i) {
      stuecke.push(html.slice(i, lt));
    }
    // Kommentare und Doctype tragen keinen sichtbaren Text.
    if (html.startsWith("<!--", lt)) {
      const ende = html.indexOf("-->", lt + 4);
      i = ende < 0 ? len : ende + 3;
      continue;
    }
    if (html.startsWith("<!", lt)) {
      const ende = html.indexOf(">", lt + 2);
      i = ende < 0 ? len : ende + 1;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      // Unabgeschlossenes Tag: der Rest ist Auszeichnung, kein sichtbarer Text.
      break;
    }
    const head = html.slice(lt + 1, Math.min(gt, lt + 1 + MAX_TAG_HEAD_INSPECT));
    const name = tagNameOf(head);
    const schliessend = head.startsWith("/");
    if (schliessend) {
      tiefe = Math.max(0, tiefe - 1);
      if (skipAb >= 0 && tiefe <= skipAb) {
        skipAb = -1;
      }
    } else if (name.length > 0) {
      const selbstschliessend = html.charCodeAt(gt - 1) === 47; // "/"
      if (!VOID_TAGS.has(name) && !selbstschliessend) {
        if (skipAb < 0 && (SKIP_CONTENT_TAGS.has(name) || istVerborgen(head))) {
          skipAb = tiefe;
        }
        tiefe += 1;
      }
    }
    // Jede Tag-Grenze ist eine Wortgrenze.
    if (skipAb < 0) {
      stuecke.push(" ");
    }
    i = gt + 1;
  }
  return stuecke.join("");
}

// ------------------------------------------------------------------------------------------------
// NORMALISIERUNG
// ------------------------------------------------------------------------------------------------
//
// Deterministisch heißt: dieselbe Eingabe ergibt IMMER dieselbe Ausgabe, auf jeder Maschine, in
// jeder Reihenfolge. Vier Schritte, in dieser Folge:
//   1 Entities auflösen (`&uuml;` ist derselbe Buchstabe wie „ü" — sonst wären es zwei Indexe).
//   2 Unicode NFKC (kanonische Komposition + Kompatibilität: „ü" als ein Zeichen ODER als u + ¨
//     ist dasselbe Wort).
//   3 UNSICHTBARE Zeichen (Steuerzeichen, Zero-Width-Familie, BOM) ERSATZLOS entfernen. Bewusst
//     nicht durch ein Leerzeichen ersetzen: ein Zero-Width-Space steht INNERHALB eines Wortes
//     (als Umbruchhinweis), und ein Leerzeichen an seiner Stelle würde „Donau[ZWSP]dampfschiff"
//     in zwei Indexwörter zerlegen — die Suche nach dem ganzen Wort ginge dann ins Leere.
//   4 JEDE echte Leerraumform (Umbruch, Tabulator, NBSP, Space-Separatoren) auf EIN Leerzeichen
//     kollabieren, danach trimmen.
// Bewusst KEIN Kleinschreiben: die Projektion bleibt am Original lesbar und rekonstruierbar; die
// Groß-/Kleinschreib-Unabhängigkeit der Suche entsteht an der Abfrage (ILIKE bzw. toLowerCase).

// Bewusst KEIN Regex, sondern ein benannter Codepunkt-Test. Ein Literal mit den echten
// unsichtbaren Zeichen wäre im Quelltext weder lesbar noch prüfbar — ein verlorenes Zeichen fiele
// niemandem auf. Eine Zeichenklasse mit `\u`-Escapes wiederum ist eine Steuerzeichen-Klasse und
// damit regelwidrig (Biome: noControlCharactersInRegex), und `new RegExp` über ein konstantes
// Muster ist es ebenso (useRegexLiterals). Als Zahlenbereiche steht jede Grenze einzeln da und ist
// nachlesbar. Der Umfang ist unverändert: C0-Steuerzeichen ohne Tabulator/Umbruch/Wagenrücklauf
// (die deckt LEERRAUM ab), DEL, die Zero-Width-Familie, der Wortverbinder und das BOM.
function istUnsichtbar(code: number): boolean {
  return (
    code <= 0x08 || // C0 vor Tabulator (0x09), Umbruch (0x0a)
    code === 0x0b || // Zeilentabulator
    code === 0x0c || // Seitenvorschub
    (code >= 0x0e && code <= 0x1f) || // C0 nach Wagenrücklauf (0x0d)
    code === 0x7f || // DEL
    (code >= 0x200b && code <= 0x200d) || // ZWSP, ZWNJ, ZWJ
    code === 0x2060 || // Wortverbinder
    code === 0xfeff // BOM / Zero-Width No-Break Space
  );
}

// Ersatzloses Entfernen: ein Zero-Width-Space steht INNERHALB eines Wortes (als Umbruchhinweis);
// ein Leerzeichen an seiner Stelle würde „Donau[ZWSP]dampfschiff" in zwei Indexwörter zerlegen.
function entferneUnsichtbare(text: string): string {
  let out = "";
  let ab = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (istUnsichtbar(text.charCodeAt(i))) {
      out += text.slice(ab, i);
      ab = i + 1;
    }
  }
  return ab === 0 ? text : out + text.slice(ab);
}

const LEERRAUM = /\s+/g;

export function normalizeSearchFragment(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  return entferneUnsichtbare(decodeHtmlEntities(text).normalize("NFKC"))
    .replace(LEERRAUM, " ")
    .trim();
}

// Die Feldtexte werden mit „\n" verbunden. Ein Trennzeichen, das nach der Normalisierung in KEINEM
// Feldtext mehr vorkommen kann (Schritt 4 kollabiert Umbrüche zu Leerzeichen) — damit kann eine
// Suchanfrage nie ÜBER eine Feldgrenze hinweg zufällig treffen.
const FELDTRENNER = "\n";

// Der Inhalt, aus dem sowohl `search_text` als auch der `content_hash` entstehen. Getrennt vom
// Zusammenbau, damit Hash und Text garantiert dieselbe Quelle haben.
//
// AUSDRÜCKLICH NICHT ENTHALTEN (und das ist die Feldgrenze aus S1):
//  · `category` / `tags`         — versionslose Metadaten, s. metadata-projection.ts;
//  · `sources[].label/excerpt`   — Quellen-/Provenienztexte, im G27-Ziel nicht suchbar
//                                  (Detailentscheidung C). Sie berühren weder `search_text` noch
//                                  `content_hash` noch diese Projektion.
interface ProjektionsInhalt {
  titleText: string;
  statementText: string;
  captionText: string;
  bodyText: string;
}

function inhaltVon(ko: KnowledgeObject): ProjektionsInhalt {
  return {
    titleText: normalizeSearchFragment(ko.title),
    statementText: normalizeSearchFragment(ko.statement),
    // WP-BILD-1g/1h: über den EINEN kanonischen Scanner aus dem bodyHtml — eine reine Funktion des
    // Inhalts, damit ein Rebuild aus demselben Objekt exakt denselben Text ergibt.
    captionText: searchCaptionTexts(ko.bodyHtml)
      .map((caption) => normalizeSearchFragment(caption))
      .join(" "),
    bodyText: normalizeSearchFragment(visibleTextFromBodyHtml(ko.bodyHtml)),
  };
}

/**
 * Der `content_hash` über den KANONISCHEN Projektionsinhalt — nicht über die Zeile.
 *
 * Bewusst OHNE `createdAt`/`updatedAt`: die Zeitstempel sagen etwas über den Schreibvorgang, nicht
 * über den Inhalt. Wären sie im Hash, könnte ein Rebuild niemals „denselben Hash" liefern, und die
 * Zusage aus der Architekturentscheidung wäre nicht prüfbar. `projectionVersion` IST im Hash: eine
 * geänderte Feld-/Normalisierungsregel MUSS einen anderen Hash ergeben.
 *
 * BEWUSST OHNE KATEGORIE UND SCHLAGWÖRTER (S1-Muss-Ergebnis): sie sind nicht Bestandteil des
 * fachlichen Content-Vertrags dieser Revision und dürfen den Hash deshalb nicht bewegen. Sonst
 * hätte eine reine Metadatenänderung — die ausdrücklich KEINEN Versions-Bump erzeugt — die
 * unveränderliche Zeile inhaltlich entwertet. Ebenso ohne `sources[].label/excerpt`.
 *
 * MIT DEM VOLLSTÄNDIGEN KANONISCHEN `classification_snapshot` (Detailentscheidung J). Alle sieben
 * Felder gehen ein — `value`, `source`, `ko_version`, `captured_at`, `captured_at_source`,
 * `provenance`, `historical_confidence` —, und zwar über GENAU DIE Serialisierung, die auch in die
 * Zelle geschrieben wird (`serializeClassificationSnapshot`).
 *
 * WARUM DIE PROVENIENZFELDER MIT MÜSSEN — und warum die frühere Begründung („sie sagen nur, WIE der
 * Wert beschafft wurde") falsch war: `provenance`, `captured_at`, `captured_at_source` und
 * `historical_confidence` entscheiden, WIE BELASTBAR die historische Aussage der Zeile ist. Ein
 * `vertraulich` mit `verified` aus einem unveränderlichen Versionsstand und dasselbe `vertraulich`
 * als `unknown`-Rekonstruktion sind NICHT dieselbe historische Aussage. Stünden diese Felder außer-
 * halb des Hashes, ließe sich eine append-only Zeile still von „rekonstruiert/unbestätigt" auf
 * „erfasst/bestätigt" umschreiben, ohne dass ein einziger Prüfwert sich bewegt — genau das No-Go
 * aus Abschnitt J („Provenienzfelder außerhalb des Hashes lassen und später still ändern").
 *
 * WAS DAS FÜR EINE SPÄTER BESSERE BELEGLAGE HEISST: sie ist ein ANDERER historischer Datensatz,
 * keine Mutation dieses einen. Der zulässige Weg ist eine neue Projektionsausprägung mit eigener
 * Kennzeichnung (neue Projection-Version, Rebuild-Ausprägung, unveränderliches Korrekturereignis) —
 * nicht das Überschreiben von `captured_at` oder `historical_confidence` in derselben Zeile.
 *
 * DER REBUILD BLEIBT DETERMINISTISCH, weil er die Beleglage nicht neu erfindet: eine bestehende
 * Zeile der geltenden Fassung behält ihren Snapshot (`classificationForRebuild`, Fall 1), und wo
 * neu abgeleitet wird, ist die Lage eine reine Funktion des Bestands (Versionsstand oder KO), nie
 * der Uhr.
 */
export function searchProjectionContentHash(input: {
  projectionVersion: number;
  koId: string;
  koVersion: number;
  language: string;
  status: SearchProjectionStatus;
  titleText: string;
  statementText: string;
  captionText: string;
  bodyText: string;
  searchText: string;
  classificationValue: ClassificationValue;
  classificationSource: string;
  /**
   * Die BELEGLAGE des Snapshots — die fünf Felder jenseits von Wert und Quelle.
   *
   * Weggelassen heißt AUSDRÜCKLICH „unbestätigt": kein Zeitpunkt, keine Zeitquelle, Rekonstruktion,
   * `historical_confidence = unknown` (s. `UNBELEGTE_LAGE`). Nie eine stillschweigend als
   * `verified` gehashte Aussage — das wäre der No-Go „Default, der historische Sicherheit
   * vortäuscht". Der Schreib-/Rebuildweg (`buildSearchProjection`) übergibt sie IMMER vollständig.
   */
  classificationEvidence?: {
    koVersion: number;
    capturedAt: string | null;
    capturedAtSource: CapturedAtSource;
    provenance: ClassificationProvenance;
    historicalConfidence: ClassificationConfidence;
  };
}): string {
  const beleg = input.classificationEvidence ?? { koVersion: input.koVersion, ...UNBELEGTE_LAGE };
  // Feste Feldfolge, feste Trennung, keine Abhängigkeit von einer JSON-Schlüsselreihenfolge. Der
  // Snapshot steht als EIN kanonisch serialisiertes Feld darin — JSON maskiert Umbrüche, der
  // Feldtrenner kann also nicht aus ihm herausfallen und Feldgrenzen verschieben.
  const kanonisch = [
    String(input.projectionVersion),
    input.koId,
    String(input.koVersion),
    input.language,
    input.status,
    input.titleText,
    input.statementText,
    input.captionText,
    input.bodyText,
    input.searchText,
    serializeClassificationSnapshot({
      value: input.classificationValue,
      source: input.classificationSource,
      koVersion: beleg.koVersion,
      capturedAt: beleg.capturedAt,
      capturedAtSource: beleg.capturedAtSource,
      provenance: beleg.provenance,
      historicalConfidence: beleg.historicalConfidence,
    }),
  ].join(FELDTRENNER);
  return createHash("sha256").update(kanonisch, "utf8").digest("hex");
}

/**
 * DIE reine, deterministische Ableitung. Gleiche Eingabe ⇒ gleiche Ausgabe ⇒ gleicher Hash.
 *
 * `at` ist der Zeitstempel des Schreibvorgangs und geht bewusst NICHT in den Hash ein.
 *
 * `options.classification` ist der Weg für REBUILD und LEGACY-NACHZUG: dort wird die Einstufung
 * nicht am lebenden Objekt gelesen, sondern aus einem unveränderlichen Versionsstand übernommen
 * oder ausdrücklich als Rekonstruktion gekennzeichnet (Abschnitt I). Ohne die Option gilt der
 * Schreibweg: die Einstufung wird gelesen, während diese Version wirksam wird.
 */
export function buildSearchProjection(
  ko: KnowledgeObject,
  at: string,
  options: { classification?: ClassificationSnapshot } = {},
): KoSearchProjection {
  const inhalt = inhaltVon(ko);
  // `body_text` trägt denselben harten Deckel wie der Suchtext: eine einzelne Zeile darf nicht
  // beliebig wachsen. Wird geschnitten, sagt die Zeile das über `status` — sie behauptet nie eine
  // Vollständigkeit, die sie nicht hat.
  const bodyGeschnitten = inhalt.bodyText.length > MAX_SEARCH_TEXT_LENGTH;
  const bodyText = bodyGeschnitten
    ? inhalt.bodyText.slice(0, MAX_SEARCH_TEXT_LENGTH)
    : inhalt.bodyText;
  const roh = [inhalt.titleText, inhalt.statementText, inhalt.captionText, bodyText]
    .filter((teil) => teil.length > 0)
    .join(FELDTRENNER);
  const suchtextGeschnitten = roh.length > MAX_SEARCH_TEXT_LENGTH;
  const searchText = suchtextGeschnitten ? roh.slice(0, MAX_SEARCH_TEXT_LENGTH) : roh;
  const status: SearchProjectionStatus =
    suchtextGeschnitten || bodyGeschnitten ? "unvollstaendig" : "vollstaendig";
  const language = SEARCH_PROJECTION_LANGUAGE;
  const classificationSnapshot = options.classification ?? classificationAtVersion(ko, at);
  const contentHash = searchProjectionContentHash({
    projectionVersion: SEARCH_PROJECTION_VERSION,
    koId: ko.id,
    koVersion: ko.version,
    language,
    status,
    titleText: inhalt.titleText,
    statementText: inhalt.statementText,
    captionText: inhalt.captionText,
    bodyText,
    searchText,
    classificationValue: classificationSnapshot.value,
    classificationSource: classificationSnapshot.source,
    // Detailentscheidung J: die BELEGLAGE geht vollständig mit in den Hash. Der Schreib- und der
    // Rebuildweg übergeben sie deshalb immer — eine Zeile ohne gehashte Beleglage entsteht hier nie.
    classificationEvidence: {
      koVersion: classificationSnapshot.koVersion,
      capturedAt: classificationSnapshot.capturedAt,
      capturedAtSource: classificationSnapshot.capturedAtSource,
      provenance: classificationSnapshot.provenance,
      historicalConfidence: classificationSnapshot.historicalConfidence,
    },
  });
  return {
    koId: ko.id,
    koVersion: ko.version,
    projectionVersion: SEARCH_PROJECTION_VERSION,
    searchText,
    titleText: inhalt.titleText,
    statementText: inhalt.statementText,
    captionText: inhalt.captionText,
    bodyText,
    language,
    contentHash,
    status,
    classificationSnapshot,
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * EIN Treffer — die schmale Ausgabe des gemeinsamen Suchvertrags. DER ÄUSSERE VERTRAG, UNVERÄNDERT:
 * S1/S2 verschieben die interne Herkunft von `category`/`tag`, nicht dieses Feldbild. Ein Konsument
 * merkt an der Trefferform NICHT, dass es jetzt zwei Projektionsarten gibt — und genau das ist die
 * Zusage der Welle (Detailentscheidung H).
 *
 * Bewusst OHNE Textinhalt: Bibliothek und Ask brauchen die Fundstelle, nicht den Index. Ein
 * `search_text` mit bis zu 200.000 Zeichen je Zeile, 200-fach für eine Frage geladen, wäre der
 * Transportfehler, den WP-SAMMEL21-FIX für `bodyHtml` bereits einmal beheben musste.
 */
export interface KoSearchHit {
  koId: string;
  koVersion: number;
  projectionVersion: number;
  contentHash: string;
  status: SearchProjectionStatus;
  language: string;
  // Wo der Begriff stand. `body` heißt: im sichtbaren Dokumenttext und in KEINEM der Kurzfelder —
  // genau der Fund, den es vor G27 nicht geben konnte.
  matched: {
    title: boolean;
    statement: boolean;
    category: boolean;
    tag: boolean;
    caption: boolean;
    body: boolean;
  };
}

// Die Abfrage des gemeinsamen Suchvertrags. `terms` sind bereits zerlegte Inhaltsbegriffe
// (Bibliothek: die eine Suchzeile; Ask: die Fragetoken) — ODER-verknüpft, wie der bestehende
// Ask-Prefilter.
//
// `limit` deckelt QUELLSEITIG und ist bewusst OPTIONAL. Ask setzt ihn (die Kandidatenmenge einer
// Frage ist ohnehin gedeckelt — ASK_CANDIDATE_PREFILTER_LIMIT). Die Bibliothek setzt ihn NICHT:
// ihre Trefferliste war vor G27 unbegrenzt, und ein stiller Deckel würde bei einer breiten Anfrage
// Treffer verschwinden lassen, ohne es zu sagen. Weggelassen heißt „der Aufrufer deckelt selbst" —
// nicht „unbemerkt abgeschnitten".
export interface KoSearchQuery {
  terms: readonly string[];
  limit?: number;
}

// Reine Termbereinigung — an EINER Stelle für alle Adapter (In-Memory wie Postgres), damit die
// Kandidatenmenge nicht je Speicher eine andere ist.
export function normalizeSearchTerms(terms: readonly string[]): string[] {
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const raw of terms) {
    const term = normalizeSearchFragment(raw).toLowerCase();
    if (term.length === 0 || gesehen.has(term)) {
      continue;
    }
    gesehen.add(term);
    out.push(term);
  }
  return out;
}

// Der Treffer-Vertrag selbst ist mit S1/S2 in die Zusammensetzung gewandert: er braucht BEIDE
// Projektionsarten und steht deshalb in effective-search-document.ts (`matchEffectiveSearchDocument`).
// Hier bleibt nur, was eine reine Eigenschaft der Content Projection ist.
