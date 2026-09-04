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

// ================================================================================================
// JOB 3048 — DIE TREFFERGÜTE: WER IM DECKEL ÜBERLEBT, ENTSCHEIDET DIE FUNDSTELLE.
// ================================================================================================
//
// DER BEFUND. Die gedeckelte KANDIDATENABFRAGE (`KoService.findCandidates`) füllte ihre Plätze nach
// `validiert ↓, trust ↓, koId`. Das ist eine Rangfolge über die VERLÄSSLICHKEIT eines Objekts und
// sagt nichts darüber, wie gut es zur Frage passt. Sobald mehr als `limit` validierte Objekte einen
// Fragebegriff irgendwo im Fließtext tragen, fällt ausgerechnet das Objekt heraus, das ihn im
// TITEL trägt, wenn sein Trust niedriger ist — und die Antwort lautet „keine belastbare
// Grundlage", obwohl das Wissen im Haus liegt.
//
// WAS DIESE FUNKTION IST: eine reine Abbildung `matched` → Rang. Sie erfindet KEINE Zahl und KEINE
// neue Messung; sie liest ausschließlich die Fundstellen, die beide Adapter ohnehin schon
// berechnen und ausliefern (das Feld `matched` oben). Es gibt deshalb im ganzen Haus genau EINE
// Aussage darüber, welcher Treffer der bessere ist.
//
// WARUM EINE LEITER UND KEIN PUNKTEKONTO — die Entscheidung, die eine Gewichtung erspart:
// Der Rang ist die STÄRKSTE Fundstelle des Treffers, nicht die Summe seiner Fundstellen. Ein
// Punktekonto müsste beantworten, wie viele Fußnotentreffer einen Titeltreffer aufwiegen — dafür
// gibt es in diesem Haus keine Messung, und eine erfundene Zahl behauptete etwas, das niemand
// belegen kann. Die Leiter behauptet nur, was ihre Reihenfolge sagt, und ist deshalb auch in SQL
// als ein `CASE` ohne Arithmetik abbildbar (`search-projection-repo-pg.ts`).
//
// DIE REIHENFOLGE, Stufe für Stufe begründet:
//
//   titel (4)      Der Titel ist die erklärte Sache des Objekts. Steht der Begriff dort, HANDELT
//                  das Objekt von ihm — die stärkste Aussage, die dieser Datenbestand über
//                  Einschlägigkeit machen kann.
//   aussage (3)    Die Aussage ist der verdichtete Kern. Sie handelt ebenfalls vom Begriff, ist
//                  aber länger als der Titel und streift deshalb häufiger Nachbarthemen.
//   einordnung (2) Kategorie UND Schlagwort teilen sich EINE Stufe: beides ist von einem Menschen
//                  erklärte Zuordnung, und für eine Ordnung ZWISCHEN den beiden gibt es keinen
//                  Beleg — eine erfundene wäre genau die Zahl, die diese Leiter vermeidet. Sie
//                  stehen unter Titel und Aussage, weil sie grob sind: eine Kategorie trifft jedes
//                  Objekt ihres Regals und unterscheidet innerhalb davon nichts.
//   fussnote (1)   Die Bildunterschrift ist ein kurzer, bewusst geschriebener Text — aber zu EINEM
//                  Bild, nicht zum Objekt. Sie steht über dem Körper, weil dort jedes Wort gewählt
//                  ist, und unter der Einordnung, weil sie nur einen Ausschnitt beschreibt.
//   koerper (0)    Der Fließtext. `matched.body` heißt seit G27 unverändert „getroffen, und in
//                  KEINEM der Kurzfelder" — also der beiläufige Fund. Er bleibt ein Treffer; er
//                  verliert nur, wenn der Platz knapp wird.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT — zwei Grenzen, beide aus der Prüfung von Runde 1:
//
//  1 SIE ÄNDERT DIE AUSGABEREIHENFOLGE NICHT. Beide Adapter geben ihre Treffer weiter in
//    `validiert ↓, trust ↓, koId` aus; die Güte entscheidet allein darüber, WER bei gesetztem
//    `limit` überhaupt in der Ausgabe steht.
//  2 SIE GILT NICHT FÜR JEDEN DECKEL, SONDERN NUR FÜR DEN, DER SIE ANFORDERT. Das ist die
//    Berichtigung eines Fehlers aus Runde 1: dort wirkte sie auf JEDE gedeckelte Abfrage, und der
//    Auftrag hatte behauptet, die Bibliothek setze kein `limit`. Sie tut es — seit JOB 2689 fragt
//    `LibraryService.search` mit `LIBRARY_SEARCH_HIT_LIMIT = 200`
//    (`services/library-analytics/src/service.ts:1334`). Die Güte hätte dort also still die
//    Trefferliste verschoben. Wer die Güteauswahl will, sagt es jetzt: `deckelauswahl`.
//
// STAND HEUTE, ausgesprochen statt verschwiegen: NIEMAND fordert sie an. Die eine Stelle, die es
// tun müsste, ist `KoService.findCandidates` (`service.ts:3028`) — der gemeinsame Kandidatenweg von
// Klara, Textprüfung und Wissensprüfung. Diese Datei liegt nicht in den Zielpfaden von JOB 3048;
// die Vorprüfung des Taktgebers weist einen Diff dort ab. Die Regel ist damit gebaut, geprüft und
// WIRKUNGSLOS, bis die Zielpfade um `service.ts` erweitert werden. Der Nachweis, dass sich diese
// Unterscheidung nicht im Adapter treffen lässt, steht als Fall K1 in
// `tests/suchraum-deckel/deckel-waehlt-nach-treffergute.test.ts`.
export const SUCH_TREFFERGUETE = {
  titel: 4,
  aussage: 3,
  einordnung: 2,
  fussnote: 1,
  koerper: 0,
} as const;

export function suchTrefferguete(matched: KoSearchHit["matched"]): number {
  if (matched.title) {
    return SUCH_TREFFERGUETE.titel;
  }
  if (matched.statement) {
    return SUCH_TREFFERGUETE.aussage;
  }
  if (matched.category || matched.tag) {
    return SUCH_TREFFERGUETE.einordnung;
  }
  if (matched.caption) {
    return SUCH_TREFFERGUETE.fussnote;
  }
  return SUCH_TREFFERGUETE.koerper;
}

// ================================================================================================
// JOB 3048 — WER IM DECKEL ÜBERLEBT, IST EINE ANGABE DES AUFRUFERS, KEINE ANNAHME DER SUCHE.
// ================================================================================================
//
// DER FEHLER, DEN DIESER TYP JETZT VERHINDERT (BEN, Runde 1, Korrekturpflicht 1): eine gedeckelte
// Suche kann ZWEI VERSCHIEDENE FRAGEN meinen, und bis hierher konnte der Adapter sie nicht
// unterscheiden —
//
//   „gib mir die 200 Treffer, die ich einer Liste zeigen will"   → die Bibliothek. Sie will die
//       verlässlichsten zuerst; ihre Menge ist seit JOB 2689 gedeckelt
//       (`LIBRARY_SEARCH_HIT_LIMIT = 200`, library-analytics/src/service.ts:1334) und darf sich
//       durch diesen Job NICHT verschieben.
//   „gib mir die 50 Objekte, aus denen eine Antwort werden soll"  → der Kandidatenweg
//       (`KoService.findCandidates` für Ask, Textprüfung und Wissensprüfung). Hier ist die
//       Verlässlichkeit das falsche Maß: was nicht in der Vorauswahl steht, kann gar nicht erst
//       Antwort werden.
//
// EINE VORGABE, DIE NICHTS ÄNDERT. Ohne Angabe gilt `vertrauen` — Zeichen für Zeichen das
// Verhalten des Basisstands. Ein Aufrufer, der nichts sagt, bekommt nichts Neues; das ist die
// Absicherung dagegen, dass ein künftiger dritter Deckel wieder still die Regel wechselt.
//
// `limit` deckelt QUELLSEITIG und bleibt OPTIONAL. Weggelassen heißt „der Aufrufer deckelt selbst"
// — nicht „unbemerkt abgeschnitten"; dann ist auch `deckelauswahl` ohne jede Wirkung.
export const DECKELAUSWAHL = ["vertrauen", "trefferguete"] as const;
export type Deckelauswahl = (typeof DECKELAUSWAHL)[number];
export const DECKELAUSWAHL_VORGABE: Deckelauswahl = "vertrauen";

// Die Abfrage des gemeinsamen Suchvertrags. `terms` sind bereits zerlegte Inhaltsbegriffe
// (Bibliothek: die eine Suchzeile; Ask: die Fragetoken) — ODER-verknüpft, wie der bestehende
// Ask-Prefilter.
export interface KoSearchQuery {
  terms: readonly string[];
  /**
   * WER IM DECKEL ÜBERLEBT (JOB 3048). Wirkt ausschließlich zusammen mit `limit`.
   *   `vertrauen`     — validiert ↓, Trust ↓, koId. Die Vorgabe und das alte Verhalten.
   *   `trefferguete`  — zuerst die Fundstelle (`suchTrefferguete`), bei Gleichstand unverändert
   *                     validiert ↓, Trust ↓, koId.
   * Die AUSGABEREIHENFOLGE ist in beiden Fällen dieselbe und bleibt `validiert ↓, Trust ↓, koId`.
   */
  deckelauswahl?: Deckelauswahl;
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

// ================================================================================================
// JOB 1531 · D1 (M-5, Anker S2) — „KLEP" FINDET „VENTIL" NICHT.
// ================================================================================================
//
// S2 beschreibt die Lage, nicht die Loesung: „literaler Token-Schnitt und `ILIKE`, keine Synonyme,
// keine Uebersetzung, keine Embeddings." Und S6 sagt, warum das mehr weh tut als es klingt:
// „‚Urlaubsregelung' und ‚Urlaubszeiten' sind fuer einen literalen Vergleich zwei verschiedene
// Woerter."
//
// WAS HIER ENTSTEHT, IST DIE DETERMINISTISCHE SEITE: eine DEKLARIERTE Zuordnung. Kein Modell, kein
// Egress, keine Netzverbindung, kein Scharfschalten des semantischen Vorfilters (der bleibt AUS —
// Hardware- und Kostenentscheidung, OFFEN.md S6).
//
// ================================================================================================
// WARUM DAS NICHT IN `normalizeSearchTerms` GEHOERT — gemessen, nicht gemutmasst.
// ================================================================================================
//
// Der naheliegende Ort waere `normalizeSearchTerms` (oben, Z. 853): dort laufen alle Adapter
// zusammen. **Er ist der falsche, und der Beleg ist ein Vertragstest:**
//
//   tests/app/word-addin.test.ts:1080   kanonisch(text) = normalizeSearchTerms(queryTokens(...))
//   tests/app/word-addin.test.ts:1106   expect(ka1.ka1TermsFromText(fx)).toEqual(kanonisch(...))
//
// Das Aufgabenfenster ist buildlos, kann nichts importieren und SPIEGELT `normalizeSearchTerms`
// von Hand (`taskpane.html:4770`). Der Test misst die Aequivalenz beider Fassungen. **Wer
// `normalizeSearchTerms` um Synonyme erweitert, macht diesen Test rot** — und die Spiegelfassung
// mitzuziehen ist hier ausgeschlossen: `taskpane.html` gehoert PRO3 (W6) und steht unter Null-Diff.
//
// UND ES IST AUCH FACHLICH DIE FALSCHE STELLE. `normalizeSearchTerms` beantwortet „was hat der
// Nutzer eingegeben?" — eine Bereinigung. Die Erweiterung beantwortet „wonach wird ausserdem
// gesucht?". Das sind zwei Aussagen, und das Haus haelt zwei Aussagen auseinander (vgl.
// `service.ts:2723-2724`: „das ist eine andere Aussage … und darf nicht mit ihr verschmelzen").
//
// ================================================================================================
// DIE TABELLE IST KLEIN, UND DAS IST ABSICHT.
// ================================================================================================
//
// Eine erfundene Synonymliste waere derselbe Fehler, den mir BEN heute in JOB 1521 nachgewiesen
// hat: eine unbelegte Setzung, die wie eine Messung aussieht. **Jeder Eintrag hier traegt deshalb
// seine Fundstelle**, und `tests/knowledge/s2-synonyme.test.ts` prueft, dass keiner ohne dasteht.
// Wer die Menge erweitern will, braucht eine Quelle — nicht eine Meinung.

/** Ein deklariertes Wortpaar mit der Stelle, an der es belegt ist. */
export interface SuchZuordnung {
  /** Die Begriffe, die einander bedeuten. Mindestens zwei, kleingeschrieben. */
  readonly begriffe: readonly string[];
  /** Wo dieses Paar herkommt. Ohne Fundstelle kein Eintrag. */
  readonly quelle: string;
}

/**
 * Die deklarierten Zuordnungen. **Nur belegte Faelle** — die beiden aus OFFEN.md.
 *
 * Bewusst KEINE automatische Uebersetzung und keine Ableitung: `klep`/`ventil` steht hier, weil
 * OFFEN.md es als den Fall benennt, an dem S2 haengt — nicht, weil eine Regel Niederlaendisch nach
 * Deutsch abbildet. Eine solche Regel waere die „Uebersetzung", die S2 ausschliesst.
 */
export const SUCH_ZUORDNUNGEN: readonly SuchZuordnung[] = [
  { begriffe: ["klep", "ventil"], quelle: "OFFEN.md S2 — ‚klep' findet ‚Ventil' nicht" },
  {
    begriffe: ["urlaubsregelung", "urlaubszeiten"],
    quelle: "OFFEN.md S6 — zwei verschiedene Woerter fuer den literalen Vergleich",
  },
  // JOB 3021 · N2 — Pedis ZWEITER Fall, wortgleich aus seinem Diktat. Die Zerlegung von
  // „Dienstwagenfarbe" ist NICHT Gegenstand dieses Eintrags und war nie das Problem: der
  // Treffer-Vertrag prueft per Teilzeichenkette (`effective-search-document.ts:120-123`,
  // `lower.includes(term)`, in SQL als ILIKE gespiegelt), „dienstwagen" trifft „Dienstwagenfarbe"
  // also schon heute. Was fehlte, ist allein die BRUECKE zwischen den beiden Woertern.
  {
    begriffe: ["firmenwagen", "dienstwagen"],
    quelle: "Pedis Diktat 30.07. (PRIORITAETEN.md N2) — ‚Firmenwagen findet Dienstwagenfarbe'",
  },
];

/** Was diese Erweiterung zusichert — als Datum, damit ein Test es lesen kann. */
export const S2_ERWEITERUNG_GRENZE = {
  /** Kein Modellaufruf, kein Egress, keine Netzverbindung. */
  brauchtNetz: false,
  /** Der semantische Vorfilter bleibt unberuehrt und AUS. */
  ruehrtVorfilterAn: false,
  /** Nur deklarierte Paare — nichts wird abgeleitet oder uebersetzt. */
  leitetAb: false,
  /** Die Eingabeterme bleiben erhalten; es wird nur ergaenzt. */
  entferntTerme: false,
} as const;

/** Der Index: Begriff -> die anderen Begriffe derselben Zuordnung. Einmal gebaut, nicht je Abfrage. */
const ZUORDNUNGS_INDEX: ReadonlyMap<string, readonly string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const zuordnung of SUCH_ZUORDNUNGEN) {
    for (const begriff of zuordnung.begriffe) {
      const andere = zuordnung.begriffe.filter((b) => b !== begriff);
      const vorhanden = index.get(begriff);
      if (vorhanden) {
        // Ein Begriff in zwei Zuordnungen: beide gelten, keine gewinnt.
        vorhanden.push(...andere.filter((b) => !vorhanden.includes(b)));
      } else {
        index.set(begriff, [...andere]);
      }
    }
  }
  return index;
})();

/**
 * Erweitert bereits bereinigte Suchterme um ihre deklarierten Entsprechungen.
 *
 * @param terme Das Ergebnis von `normalizeSearchTerms` — bereinigt, kleingeschrieben, entdoppelt.
 *              **In der OBERFLAECHENFORM**, so wie die Tabelle oben deklariert ist. Der Abgleich
 *              ist ein Mengenvergleich und kennt keine Beugung: wer Terme in einer ANDEREN Form
 *              hereingibt, bekommt sie unveraendert zurueck. Das ist keine Nachlaessigkeit,
 *              sondern die Grenze `leitetAb: false` — diese Funktion darf keine Wortform auf eine
 *              andere abbilden. Der Fragepfad fuehrt seine Terme in der Grundform des Reasoners
 *              (`queryTokens("Urlaubsregelung") === ["urlaubsregel"]`, gemessen) und rechnet die
 *              beiden Formen deshalb bei sich aufeinander um, bevor er hier hereingeht
 *              (`services/ask/src/service.ts`, `zugeordneteSuchterme`).
 *
 * @returns Dieselben Terme in derselben Reihenfolge, gefolgt von den ergaenzten. **Die Eingabe
 *          wird nie gekuerzt und nie umsortiert:** Ein Aufrufer, der die Erweiterung nicht will,
 *          bekommt bei leerer Tabelle exakt seine Eingabe zurueck — und die Reihenfolge des ersten
 *          Vorkommens ist dieselbe Zusage, die `normalizeSearchTerms` gibt.
 */
export function expandSearchTerms(terme: readonly string[]): string[] {
  const raus: string[] = [];
  const gesehen = new Set<string>();
  for (const term of terme) {
    if (!gesehen.has(term)) {
      gesehen.add(term);
      raus.push(term);
    }
  }
  // Erst nach ALLEN Eingabetermen ergaenzen — sonst haenge die Reihenfolge davon ab, welcher Term
  // zufaellig eine Zuordnung hat, und ein gedeckelter Aufrufer verloere echte Eingaben zuerst.
  for (const term of terme) {
    for (const weiterer of ZUORDNUNGS_INDEX.get(term) ?? []) {
      if (!gesehen.has(weiterer)) {
        gesehen.add(weiterer);
        raus.push(weiterer);
      }
    }
  }
  return raus;
}
