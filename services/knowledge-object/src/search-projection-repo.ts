import type { TxContext } from "../../db-tx";
import {
  composeEffectiveSearchDocument,
  matchEffectiveSearchDocument,
} from "./effective-search-document";
import type { KoMetadataProjection } from "./metadata-projection";
import {
  InMemoryKoMetadataProjectionRepo,
  type KoMetadataProjectionRepo,
} from "./metadata-projection-repo";
import type { KoRepo } from "./repo";
import {
  DECKELAUSWAHL_VORGABE,
  type KoSearchHit,
  type KoSearchProjection,
  type KoSearchQuery,
  SEARCH_PROJECTION_VERSION,
  expandSearchTerms,
  normalizeSearchTerms,
  suchTrefferguete,
} from "./search-projection";
import { KoError } from "./types";

// Ein Treffer samt der beiden Werte, die über seine Reihenfolge entscheiden — die Zeile, auf der
// `findActive` seine Auswahl (Deckel) und seine Ausgabe ordnet.
interface Gefunden {
  hit: KoSearchHit;
  validiert: boolean;
  trust: number;
}

// ================================================================================================
// G27 — DIE PERSISTENZ DER SUCHPROJEKTION (Vertrag + In-Memory-Adapter)
// ================================================================================================
//
// APPEND-ONLY, wie die Versions-Snapshots (SCRUM-159) und aus demselben Grund: eine einmal
// geschriebene Projektion GEHÖRT zu einer Inhaltsversion und darf sich nicht mehr ändern, sonst
// wäre der Treffer von gestern nicht mehr erklärbar. `insert` schreibt deshalb NUR, wenn
// (koId, koVersion) noch frei ist, und meldet über den Rückgabewert ehrlich, ob DIESER Aufruf
// geschrieben hat.
//
// DIE EINZIGE AUSNAHME ist `replace` — der ausdrückliche, administrative Rebuild und die ebenso
// ausdrückliche Nachführung einer Zeile auf Projektionsfassung 2. Er ist keine Umgehung der
// Append-only-Regel, sondern ihr Gegenstück: die Regel schützt vor STILLEM Überschreiben im
// Normalbetrieb; beides hier sind benannte Operationen, deren Ergebnis (gleicher content_hash bzw.
// eine gezählte Fassungsmigration) prüfbar ist.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESES REPOSITORY DIE METADATENPROJEKTION MITFÜHRT
// ------------------------------------------------------------------------------------------------
//
// `findActive` ist DER Suchweg — und ein Suchtreffer entsteht seit S1/S2 aus BEIDEN Projektionen
// (Effective Search Document). Ein Objekt, das nur über seine Kategorie gefunden wird, käme aus
// einer reinen Inhaltsabfrage überhaupt nicht zurück; die Zusammensetzung muss deshalb IN der
// Abfrage stattfinden (in Postgres als JOIN) und nicht dahinter.
//
// `metadata` liegt darum als benannte Hälfte an diesem Vertrag: EINE Injektionsstelle, EIN
// Datenraum, keine Kompositionswurzel, die zwei zusammengehörige Adapter versehentlich aus
// verschiedenen Datenbanken zusammensteckt. Ein ZWEITER öffentlicher Suchvertrag entsteht dadurch
// ausdrücklich nicht — nach außen bleibt `findActive` die einzige Standardsuche.

// ================================================================================================
// G27 R1 — DER PERSISTENTE PROJECTION CONTROL STATE (KW-ARCH-G27-PROJECTION-CONTROL-STATE-04)
// ================================================================================================
//
// WARUM ES IHN GIBT. BEN hat einen produktiven V1/V2-Mischbetrieb reproduziert: nach einem
// gedeckelten Backfill blieb eine Legacy-V1-Zeile regulär durchsuchbar, und nach einer
// Kategorieänderung trafen ALTER Begriff (aus dem V1-`search_text`) und NEUER Begriff (aus der
// Metadatenprojektion) gleichzeitig. Die Wurzel: im gesamten Lesepfad gab es KEINE Vorstellung
// einer freigegebenen aktiven Projektionsfassung — `findActive` filterte ausschließlich auf die
// aktive KO-Version.
//
// DIE REGEL (Entscheidung 03 §2): für den regulären Suchpfad existiert zu jedem Zeitpunkt GENAU
// EINE freigegebene aktive Projektionsfassung. V1 darf historisch weiterbestehen — es wird nicht
// gelöscht, überschrieben oder verändert —, ist im freigegebenen V2-Betrieb aber kein regulärer
// Treffer mehr.
//
// DIE AUTORITÄT (Entscheidung 04 §1): welche Fassung freigegeben ist und ob die Instanz überhaupt
// suchbereit ist, steht AUSSCHLIESSLICH hier — instanzweit, restartfest, in der Datenbank. Es wird
// NICHT je Suche aus Projektionszeilen abgeleitet und nicht aus Hintergrundprozessen erraten.
// Deshalb wohnt der Control-State an DIESEM Vertrag und nicht neben ihm: derselbe Datenraum,
// dieselbe Injektionsstelle wie die beiden Projektionshälften.

export const PROJECTION_STATES = [
  "UNINITIALIZED",
  "V1_ACTIVE",
  "V2_BUILDING",
  "V2_READY",
  "V2_ACTIVE",
  "FAILED",
] as const;

export type ProjectionState = (typeof PROJECTION_STATES)[number];

/**
 * Die Pflichtfelder aus Entscheidung 04 §6 — abschließend („Mehr ist architektonisch derzeit nicht
 * erforderlich"). `null` heißt überall ehrlich „noch nicht", nie „vermutlich".
 */
export interface ProjectionControlState {
  /** Die EINE freigegebene Fassung. `null` = nichts freigegeben ⇒ keine reguläre Suche. */
  readonly activeProjectionVersion: number | null;
  /** Das Ziel des laufenden Wechsels. */
  readonly targetProjectionVersion: number | null;
  readonly projectionState: ProjectionState;
  /** Vorbedingung 1 der Freigabe (04 §3.1). */
  readonly lastSuccessfulRebuild: string | null;
  /** Vorbedingung 2 der Freigabe (04 §3.2). */
  readonly lastReconcile: string | null;
  readonly lastFailure: string | null;
  readonly buildStartedAt: string | null;
  readonly buildFinishedAt: string | null;
  // ----------------------------------------------------------------------------------------------
  // G27 R1 · Entscheidung 09 — GENERATION UND INTEGRITÄT
  // ----------------------------------------------------------------------------------------------
  /**
   * Die MONOTONE Kennung des laufenden Bauzyklus (09 §2). Jeder `V2_BUILDING`-Beginn zählt sie
   * hoch; jede Mutation während Bau und Ready trägt genau SIE. Sie ist der Grund, warum „geprüfter
   * Bestand" und „freigegebener Bestand" dieselbe Sache sein können: das Gate prüft eine
   * Generation, und freigegeben wird genau diese Generation — nicht „der Bestand von eben".
   *
   * `0` heißt: es hat auf dieser Instanz noch NIE einen V2-Bauzyklus gegeben. Genau daran hängt die
   * einmalige Legacy-Bestätigung (09 §4).
   */
  readonly buildGeneration: number;
  /** Die freigegebene Generation. `null` = keine V2-Fassung aktiv. */
  readonly activeGeneration: number | null;
  /**
   * DER GENERATIONSGEBUNDENE INTEGRITÄTS-/READINESS-MARKER (09 §3, Prüfung 4).
   *
   * Er ist KEIN Audit-Hash und kein Ersatz für Sperre und Generation (09 §6): er ist die eine
   * persistierte Zusage „der Bestand der Generation N ist geprüft und seither nicht ausserhalb
   * dieser Generation angefasst worden". Gültig ist er ausschließlich für die Generation, die in
   * ihm steht — deshalb ist seine Prüfung konstant teuer (ein Feldvergleich an der Steuerzeile) und
   * braucht keinen Vollscan pro Suchanfrage.
   *
   * Er wird von JEDER Mutation invalidiert, die den aktiven Bestand ausserhalb seiner Generation
   * verändert (V1-Rückschreibung, Fremdfassung, Entfernung einer bedienenden Zeile). Danach ist die
   * Suche fail-closed, bis ein vollständiger neuer Zyklus gelaufen ist.
   */
  readonly integrityMarker: string | null;
  /** Zeitpunkt der Freigabe der aktiven Generation (09 §2.5). */
  readonly activatedAt: string | null;
}

/**
 * Die Gestalt des Markers — generationsgebunden und damit NICHT übertragbar. Ein Marker der
 * Generation 7 ist für Generation 8 wertlos; genau das macht ihn zur Zusage über einen bestimmten
 * Bestand und nicht zu einem allgemeinen „war mal in Ordnung".
 */
export function integritaetsMarkerFuer(generation: number): string {
  return `V2-READY:${generation}`;
}

/** Prüfung 4 aus 09 §3 — konstant teuer, rein an der Steuerzeile. */
export function integritaetsMarkerGueltig(control: ProjectionControlState): boolean {
  return (
    control.activeGeneration !== null &&
    control.integrityMarker === integritaetsMarkerFuer(control.activeGeneration)
  );
}

/**
 * DER ANFANGSZUSTAND EINER NEUEN INSTANZ (Entscheidung 05 §1): `UNINITIALIZED`, persistiert.
 *
 * NICHT `V1_ACTIVE` (eine frische Installation hatte nie V1) und NICHT `V2_ACTIVE` (auch ein leerer
 * oder reiner V2-Bestand wird erst durch dieselbe atomare Freigabe aktiv wie jede spätere Fassung).
 * „Leere Tabellen" sind ausdrücklich KEIN Aktivierungsgrund.
 */
export const UNINITIALIZED_CONTROL_STATE: ProjectionControlState = {
  activeProjectionVersion: null,
  targetProjectionVersion: null,
  projectionState: "UNINITIALIZED",
  lastSuccessfulRebuild: null,
  lastReconcile: null,
  lastFailure: null,
  buildStartedAt: null,
  buildFinishedAt: null,
  // Generation 0 = noch NIE ein V2-Bauzyklus auf dieser Instanz (09 §4).
  buildGeneration: 0,
  activeGeneration: null,
  integrityMarker: null,
  activatedAt: null,
};

/**
 * Die EINE zulässige Belegung je Zustand — Lifecycle, Zeiger und Eindeutigkeit der aktiven Fassung
 * in einer Aussage. Ein Tripel außerhalb dieser Tabelle ist ein BESCHÄDIGTER Control-State und
 * niemals eine Suchgrundlage (04 §4).
 *
 * `undefined` in `aktiv` heißt: dieser Zustand beantwortet keine reguläre Suche.
 */
const ZUSTANDSBELEGUNG: Record<
  ProjectionState,
  { aktiv: number | null; ziel: number | null; bedient: boolean }
> = {
  UNINITIALIZED: { aktiv: null, ziel: null, bedient: false },
  V1_ACTIVE: { aktiv: 1, ziel: 1, bedient: true },
  V2_BUILDING: { aktiv: null, ziel: SEARCH_PROJECTION_VERSION, bedient: false },
  V2_READY: { aktiv: null, ziel: SEARCH_PROJECTION_VERSION, bedient: false },
  V2_ACTIVE: { aktiv: SEARCH_PROJECTION_VERSION, ziel: SEARCH_PROJECTION_VERSION, bedient: true },
  FAILED: { aktiv: null, ziel: null, bedient: false },
};

/** Trägt der Control-State eine in sich stimmige Belegung? (Teil der Integritätsprüfung, 05 §3.) */
export function controlStateLifecycleGueltig(control: ProjectionControlState): boolean {
  const soll = ZUSTANDSBELEGUNG[control.projectionState];
  if (!soll) {
    return false;
  }
  if (control.projectionState === "FAILED") {
    // Nach einem Fehlschlag darf ein Ziel stehenbleiben (der Rebuild ist ja fällig) — aktiv nicht.
    return control.activeProjectionVersion === null;
  }
  return (
    control.activeProjectionVersion === soll.aktiv && control.targetProjectionVersion === soll.ziel
  );
}

/**
 * DIE EINE STELLE, an der aus dem Control-State eine Suchentscheidung wird — von BEIDEN Adaptern
 * benutzt. Parität ist dadurch strukturell und nicht bloß zugesichert: es ist dieselbe Funktion.
 *
 * Bei `UNINITIALIZED`, `V2_BUILDING`, `V2_READY`, `FAILED` oder einem beschädigten/inkonsistenten
 * Control-State WIRFT sie (04 §4). Sie liefert weder `[]` als Verfügbarkeitsersatz noch eine
 * Teilmenge: eine leere Treffermenge bedeutet weiterhin fachlich „nichts gefunden" und darf nicht
 * „Suche nicht verfügbar" verschleiern. Der Fehler ist rein intern (`KoError`); Routen und
 * öffentlicher API-Vertrag bleiben unverändert.
 */
export function freigegebeneProjektionsfassung(control: ProjectionControlState): number {
  return freigegebeneProjektion(control).fassung;
}

/**
 * DIE VIER KONSTANTEN PRÜFUNGEN DER SUCHE (09 §3) — und ihr Ergebnis, das die Abfrage einengt.
 *
 * Sie kosten zusammen EINEN gelesenen Steuersatz: Zustand, Fassung, Generation und Marker stehen
 * alle in derselben Zeile. Kein Vollscan, keine Bestandsaufnahme, keine Zählung je Suchanfrage
 * (09 §3, „Es gibt keinen Vollscan pro Anfrage").
 *
 *   1 der Zustand bedient überhaupt eine reguläre Suche,
 *   2 Lifecycle und Zeiger passen zueinander und eine Fassung ist freigegeben,
 *   3 für die Zielfassung 2: `active_generation` ist gesetzt,
 *   4 für die Zielfassung 2: der Integritätsmarker gilt für GENAU diese Generation.
 *
 * WARUM 3 UND 4 NUR FÜR FASSUNG 2 GELTEN. Die Generation ist die Kennung eines V2-BAUZYKLUS; einen
 * solchen hat der einmalig bestätigte Legacy-V1-Betrieb (09 §4) definitionsgemäß nie durchlaufen.
 * Für ihn wäre „Generation gesetzt" eine Anforderung, die er nur durch eine erfundene Generation
 * erfüllen könnte — und eine erfundene Generation ist genau die Behauptung, die diese Entscheidung
 * abschafft. V1 bleibt deshalb der ungenerationierte Altbetrieb; er wird durch den Bauzyklus
 * abgelöst, nicht nachträglich in ihn hineingerechnet.
 *
 * WIRFT in jedem Fehlerfall (04 §4) — nie `[]`, nie eine Teilmenge.
 */
export function freigegebeneProjektion(control: ProjectionControlState): {
  fassung: number;
  generation: number | null;
} {
  const soll = ZUSTANDSBELEGUNG[control.projectionState];
  if (!soll?.bedient) {
    throw new KoError(
      "SEARCH_PROJECTION_NOT_READY",
      `Suchprojektion nicht freigegeben (Zustand ${control.projectionState}).`,
    );
  }
  if (!controlStateLifecycleGueltig(control) || control.activeProjectionVersion === null) {
    throw new KoError(
      "SEARCH_PROJECTION_NOT_READY",
      `Control-State inkonsistent (Zustand ${control.projectionState}).`,
    );
  }
  if (control.activeProjectionVersion !== SEARCH_PROJECTION_VERSION) {
    return { fassung: control.activeProjectionVersion, generation: null };
  }
  if (control.activeGeneration === null) {
    throw new KoError(
      "SEARCH_PROJECTION_NOT_READY",
      `Freigegebene Fassung ohne Generation (Zustand ${control.projectionState}).`,
    );
  }
  // DER MARKER IST DIE STELLE, an der eine nachträgliche Beschädigung sichtbar wird (09 §3, §5).
  // Er wird nicht hier berechnet — er wurde bei der Freigabe geschrieben und von jeder Mutation
  // ausserhalb seiner Generation gelöscht. Fehlt oder passt er nicht, ist der Bestand strukturell
  // unmöglich, und die einzige ehrliche Antwort ist der interne Readiness-Fehler.
  if (!integritaetsMarkerGueltig(control)) {
    throw new KoError(
      "SEARCH_PROJECTION_NOT_READY",
      `Integritätsmarker ungültig (Generation ${control.activeGeneration}).`,
    );
  }
  return { fassung: control.activeProjectionVersion, generation: control.activeGeneration };
}

/**
 * DIE EINE REGEL, MIT WELCHER GENERATION EINE GESCHRIEBENE ZEILE GESTEMPELT WIRD (09 §2)
 * — und wann ein Schreibvorgang den Integritätsmarker verbrennt.
 *
 * Von BEIDEN Adaptern benutzt; Parität ist dadurch dieselbe Funktion und nicht dieselbe Absicht.
 *
 *   · `V2_BUILDING` / `V2_READY` — die Zeile gehört zum laufenden Bau und trägt dessen Generation.
 *     Genau darauf prüft das Gate; eine Zeile ohne diese Generation ist für die Freigabe unsichtbar.
 *   · `V2_ACTIVE` und Zielfassung — der reguläre Produktivschreibweg (eine neue KO-Version, ein
 *     Nachzug). Er trägt die AKTIVE Generation und hält die Zusage damit ein: der freigegebene
 *     Bestand bleibt vollständig, ohne dass die Wahrheit von gestern konserviert würde. Ohne diesen
 *     Zweig könnte nach der Freigabe nie wieder etwas eingepflegt werden — die Bibliothek und
 *     Klara wären auf den Stand des letzten Bauzyklus eingefroren.
 *   · `V2_ACTIVE` und FREMDE Fassung — die V1-Rückschreibung, die BEN reproduziert hat. Sie kann
 *     die aktive Generation nicht tragen (sie ist keine V2-Zeile) und ist damit eine Mutation
 *     ausserhalb der freigegebenen Generation: der Marker fällt, die Suche wird fail-closed. Das
 *     ist die Stelle, an der aus dem früheren stillen `[]` ein ehrlicher Fehler wird (09 §5).
 *   · sonst — es ist nichts freigegeben; es gibt keinen geschützten Bestand und nichts zu
 *     invalidieren.
 */
export function schreibStempel(
  control: ProjectionControlState,
  projectionVersion: number,
): { generation: number | null; invalidieren: boolean } {
  if (control.projectionState === "V2_BUILDING" || control.projectionState === "V2_READY") {
    return { generation: control.buildGeneration, invalidieren: false };
  }
  if (control.projectionState === "V2_ACTIVE") {
    if (projectionVersion === SEARCH_PROJECTION_VERSION && control.activeGeneration !== null) {
      return { generation: control.activeGeneration, invalidieren: false };
    }
    return { generation: null, invalidieren: true };
  }
  return { generation: null, invalidieren: false };
}

/**
 * Die Entsprechung für das ENTFERNEN einer Zeile (09 §5, „Nachträgliche Entfernung").
 *
 * Invalidiert wird NUR, wenn eine BEDIENENDE Zeile verschwindet: Zielfassung, aktive Generation,
 * und das Wissensobjekt lebt noch in genau dieser Version. Nur dann entsteht die Lücke, die die
 * Suche sonst als „nichts gefunden" ausgeben würde.
 *
 * WARUM DIE KOMPENSATION AUSGENOMMEN IST (`ruecknahme`). `remove` ist laut Vertrag die Rücknahme
 * eines NICHT COMMITTETEN Schreibvorgangs — sie nimmt zurück, was derselbe Vorgang eben geschrieben
 * hat, und stellt damit den Zustand VOR dem Vorgang wieder her. Sie reisst keine Lücke, sie
 * schliesst eine. Würde sie den Marker fällen, brächte ein gescheiterter Anlagevorgang die ganze
 * Instanz zum Erliegen — die Kompensation wäre schädlicher als der Fehler, den sie aufräumt. Die
 * Kennzeichnung steht deshalb an den drei Kompensationsstellen ausdrücklich im Aufruf und nicht als
 * stille Annahme in dieser Regel.
 */
export function entfernungInvalidiert(
  control: ProjectionControlState,
  zeile: { projectionVersion: number; generation: number | null } | undefined,
  koLebtInDieserVersion: boolean,
): boolean {
  if (control.projectionState !== "V2_ACTIVE" || !zeile || !koLebtInDieserVersion) {
    return false;
  }
  return (
    zeile.projectionVersion === SEARCH_PROJECTION_VERSION &&
    zeile.generation !== null &&
    zeile.generation === control.activeGeneration
  );
}

/**
 * DIE SITZUNG UNTER DER EXKLUSIVEN CONTROL-SPERRE (09 §2).
 *
 * Sie ist der Grund, warum „geprüft" und „freigegeben" derselbe Bestand sind: `control` ist der
 * Zustand, der beim Sperren galt, und `schreibe` schreibt IN DERSELBEN Transaktion auf DIESELBE
 * gesperrte Zeile. Zwischen beidem kann keine Projektionsmutation committen — sie läuft in die
 * Sperre. Das ist BENs ROT-4-Fenster, geschlossen.
 */
export interface ProjectionControlSitzung {
  readonly control: ProjectionControlState;
  schreibe(naechster: ProjectionControlState): Promise<void>;
}

/**
 * Bestandsaufnahme der AKTIVEN Zeilen — die Datengrundlage der fünf Gate-Prüfungen (04 §3).
 *
 * AUSDRÜCKLICH NICHT die Grundlage der Suche: Readiness wird nie hieraus abgeleitet (04 §1, §8).
 * Diese Zahlen entscheiden, ob eine Freigabe zulässig ist — nicht, ob gerade gesucht werden darf.
 */
export interface ProjectionAudit {
  /** Nicht gelöschte Wissensobjekte. */
  kos: number;
  /** Davon mit Inhaltszeile für ihre AKTIVE Version. */
  mitInhalt: number;
  /** Davon mit Metadatenzeile. */
  mitMetadaten: number;
  /** Die Fassungen der AKTIVEN Zeilen — mehr als ein Eintrag ist ein Mischbestand. */
  aktiveFassungen: { projectionVersion: number; count: number }[];
  /** Aktive Zeilen mit leerem Pflichtfeld (content_hash, language, status). */
  pflichtfelderFehlen: number;
}

export interface KoSearchProjectionRepo {
  /** Die zweite Hälfte des Effective Search Document — derselbe Datenraum, dieselbe Wurzel. */
  readonly metadata: KoMetadataProjectionRepo;
  /**
   * Append-only. true = DIESER Aufruf hat geschrieben; false = (koId, koVersion) war belegt.
   * JOB 2704 D1 (R2-35): optionaler, opaker TxContext (Muster `KoRepo.delete(id, tx)`) — der
   * Pg-Adapter schreibt dann auf dem Transaktionsclient von mutateKoTx statt in einer eigenen
   * Transaktion; die Steuerzeilensperre (09 §2) hält er trotzdem. InMemory ignoriert ihn.
   */
  insert(projection: KoSearchProjection, tx?: TxContext): Promise<boolean>;
  /** Ausschliesslich fuer Rebuild und Fassungsnachfuehrung (ueberschreibt bewusst). */
  replace(projection: KoSearchProjection): Promise<void>;
  find(koId: string, koVersion: number): Promise<KoSearchProjection | undefined>;
  listByKo(koId: string): Promise<KoSearchProjection[]>;
  /**
   * DIE Standardsuche: ODER-Treffer ueber das Effective Search Document der AKTIVEN KO-Version
   * IN DER FREIGEGEBENEN PROJEKTIONSFASSUNG (G27 R1, Entscheidung 03 §2).
   *
   * ZWEI Aktivitaetsdimensionen, nicht eine — genau hier lag BENs Befund: bis R1 filterte diese
   * Zusage nur auf die aktive KO-Version, und eine Zeile der Fassung 1 bestand sie unveraendert.
   * Jetzt gilt zusaetzlich `projectionVersion === controlState.activeProjectionVersion`.
   *
   * WIRFT, wenn keine Fassung freigegeben ist (04 §4) — weder `[]` noch eine Teilmenge. Die Pruefung
   * steht VOR jeder fachlichen Leermengenentscheidung: „keine Begriffe" ist eine fachliche Antwort
   * und darf einen nicht suchbereiten Zustand nicht verdecken.
   *
   * Historische KO-Versionen werden NIE geliefert (Architekturentscheidung G27, „Aktiver Datensatz").
   * Reihenfolge wie der bestehende Ask-Prefilter: validierte zuerst, dann Trust absteigend.
   */
  findActive(query: KoSearchQuery): Promise<KoSearchHit[]>;
  /**
   * DIE EINZIGE AUTORITATIVE QUELLE fuer aktive Projektionsfassung und Readiness (04 §1).
   * Fehlt die Zeile, ist die Antwort `UNINITIALIZED` — fail-closed, nie geraten.
   */
  controlState(): Promise<ProjectionControlState>;
  /**
   * BEDINGTER, ATOMARER Zustandswechsel: schreibt NUR, wenn der gespeicherte Zustand `erwartet`
   * ist, und meldet ehrlich, ob DIESER Aufruf geschrieben hat. Genau das macht die Freigabe
   * `V2_READY → V2_ACTIVE` zu EINER Operation ohne beobachtbaren Zwischenzustand (04 §3).
   */
  compareAndSetControlState(
    erwartet: ProjectionState,
    naechster: ProjectionControlState,
  ): Promise<boolean>;
  /**
   * DIE EXKLUSIVE INSTANZSPERRE der Steuerzeile (09 §2.1) — der Rahmen, in dem Gate-Pruefung und
   * Aktivierung EINE Entscheidung sind. Solange sie gehalten wird, blockiert jede
   * Projektionsmutation; danach traegt sie zwingend die dann gueltige Generation.
   *
   * Der Rueckgabewert von `fn` reicht durch. Wirft `fn`, wird nichts geschrieben.
   */
  withExclusiveControlLock<T>(fn: (sitzung: ProjectionControlSitzung) => Promise<T>): Promise<T>;
  /** Bestandsaufnahme der AKTIVEN Zeilen fuer die Gate-Pruefungen (nie fuer die Suche). */
  activeProjectionAudit(): Promise<ProjectionAudit>;
  /**
   * Die Generation, mit der eine gespeicherte Zeile gestempelt ist — read-only, ausschliesslich
   * fuer Gate und Gegenprobe. Sie ist bewusst NICHT Teil von `KoSearchProjection`: die Generation
   * gehoert zur Steuerung des Bestands, nicht zum abgeleiteten Suchdokument.
   */
  generationOf(koId: string, koVersion: number): Promise<number | null | undefined>;
  /**
   * Traegt JEDE aktive Zeile die Zielfassung UND die genannte Generation? Die Gate-Frage aus
   * 09 §2.4 („seit Beginn keine Projektionsmutation einer anderen Generation"), als eine Aussage.
   */
  activeRowsInGeneration(generation: number): Promise<boolean>;
  /**
   * Die Arbeitsliste des Nachzugs: KO-Ids, deren SUCHDOKUMENT fuer die aktive Version noch nicht
   * vollstaendig auf dem geltenden Stand ist. Drei Faelle, EINE Liste (sonst gaebe es drei Laeufe,
   * die dasselbe Objekt dreimal vollladen):
   *   1 keine Content Projection fuer die aktive Version,
   *   2 eine Content Projection in einer aelteren Projektionsfassung (V1/V2-Mischbestand),
   *   3 keine Mutable Metadata Projection.
   */
  missingActive(limit: number): Promise<string[]>;
  /**
   * Bestandsaufnahme der Projektionsfassungen — macht einen V1/V2-Mischzustand EINDEUTIG sichtbar,
   * statt ihn nur zu vermuten. Zaehlt Zeilen je `projection_version` (keine Inhalte).
   */
  inventoryByProjectionVersion(): Promise<{ projectionVersion: number; count: number }[]>;
  /**
   * Kompensation eines nicht committeten Schreibvorgangs (Spiegel von KoVersionRepo.remove).
   *
   * `ruecknahme: true` kennzeichnet genau das — der Aufrufer nimmt zurueck, was er selbst eben
   * geschrieben hat. Ohne die Kennzeichnung gilt das Entfernen einer BEDIENENDEN Zeile als
   * nachtraegliche Beschaedigung und faellt den Integritaetsmarker (s. `entfernungInvalidiert`).
   */
  remove(koId: string, koVersion: number, opts?: { ruecknahme?: boolean }): Promise<void>;
  /**
   * Alle Projektionen EINES Objekts entfernen — Inhalts- UND Metadatenzeile, ausschliesslich fuer
   * die harte Endloeschung (purgeKo). Ohne sie bliebe der Suchindex eines endgueltig geloeschten
   * Objekts als Karteileiche liegen; die Standardsuche wuerde ihn zwar nie zeigen (der JOIN auf
   * `kos` faellt weg), aber „geloescht" heisst geloescht, auch im abgeleiteten Datenraum.
   */
  removeByKo(koId: string): Promise<void>;
  /** Zaehler fuer Backfill-/Rebuild-Bilanzen (keine Inhalte). */
  count(): Promise<number>;
}

function schluessel(koId: string, koVersion: number): string {
  return `${koId}@${koVersion}`;
}

/**
 * DER SPEICHER des In-Memory-Adapters — Projektionszeilen UND Control-State in EINEM Objekt.
 *
 * Er ist herausgezogen, damit „Wiederanlauf" auch ohne Datenbank ehrlich messbar ist: ein ZWEITER,
 * frischer Adapter ueber DENSELBEN Speicher ist das In-Memory-Gegenstueck zu „zweiter Adapter am
 * selben Pool" (04 §1, §8). Ohne diese Trennung waere der Zustand an die Objektlebensdauer des
 * Adapters gebunden — und damit gerade nicht restartfest.
 */
export interface InMemoryProjektionsSpeicher {
  readonly items: Map<string, KoSearchProjection>;
  /**
   * Die Generation JE ZEILE — bewusst NEBEN `items` und nicht in `KoSearchProjection` (09 §2).
   *
   * Die Generation ist eine Eigenschaft der SPEICHERUNG, nicht des abgeleiteten Suchdokuments: sie
   * entsteht beim Schreiben aus dem Control-State und geht in keinen Hash und in keinen äusseren
   * Vertrag ein. Stünde sie am Dokument, müsste jeder Erzeuger einer Projektion sie kennen — und
   * damit könnte jeder Erzeuger sie auch behaupten.
   */
  readonly generationen: Map<string, number | null>;
  control: ProjectionControlState;
  /**
   * DIE EXKLUSIVE INSTANZSPERRE (09 §2, InMemory-Hälfte). Eine Kette statt eines echten Mutex —
   * derselbe Effekt bei einem Single-Thread-Ereignisumlauf: wer die Sperre will, hängt sich hinten
   * an und läuft erst, wenn der Vorgänger fertig ist.
   */
  sperre: Promise<unknown>;
}

export function neuerProjektionsSpeicher(): InMemoryProjektionsSpeicher {
  return {
    items: new Map(),
    generationen: new Map(),
    control: { ...UNINITIALIZED_CONTROL_STATE },
    sperre: Promise.resolve(),
  };
}

/**
 * In-Memory-Adapter. Er braucht das KO-Repository, weil „aktive Version" eine Tatsache am
 * Wissensobjekt ist und nicht an der Projektion — genau der JOIN, den der Postgres-Adapter in SQL
 * fährt. Die Aktivität in der Projektionszeile mitzuführen wäre eine zweite, nachlaufende Wahrheit.
 */
export class InMemoryKoSearchProjectionRepo implements KoSearchProjectionRepo {
  private readonly items: Map<string, KoSearchProjection>;

  private readonly generationen: Map<string, number | null>;

  readonly metadata: KoMetadataProjectionRepo;

  constructor(
    private readonly kos: KoRepo,
    metadata: KoMetadataProjectionRepo = new InMemoryKoMetadataProjectionRepo(),
    // Ohne eigenen Speicher ist jeder Adapter eine eigene frische Instanz — und die startet nach
    // 05 §1 in `UNINITIALIZED`, nicht suchbereit. Wer den Wiederanlauf messen will, reicht denselben
    // Speicher einem zweiten Adapter.
    private readonly speicher: InMemoryProjektionsSpeicher = neuerProjektionsSpeicher(),
  ) {
    this.metadata = metadata;
    this.items = speicher.items;
    this.generationen = speicher.generationen;
  }

  controlState(): Promise<ProjectionControlState> {
    return Promise.resolve({ ...this.speicher.control });
  }

  compareAndSetControlState(
    erwartet: ProjectionState,
    naechster: ProjectionControlState,
  ): Promise<boolean> {
    if (this.speicher.control.projectionState !== erwartet) {
      return Promise.resolve(false);
    }
    this.speicher.control = { ...naechster };
    return Promise.resolve(true);
  }

  /**
   * Dieselbe Zusage wie `SELECT … FOR UPDATE` in PostgreSQL: solange `fn` läuft, kommt keine
   * Mutation und keine zweite Sitzung an die Steuerzeile. Die Kette wird IMMER weitergereicht —
   * auch wenn `fn` wirft —, sonst bliebe die Sperre nach einem Fehlschlag für immer zu.
   */
  withExclusiveControlLock<T>(fn: (sitzung: ProjectionControlSitzung) => Promise<T>): Promise<T> {
    const lauf = this.speicher.sperre.then(
      () => this.mitSitzung(fn),
      () => this.mitSitzung(fn),
    );
    this.speicher.sperre = lauf.then(
      () => undefined,
      () => undefined,
    );
    return lauf;
  }

  private async mitSitzung<T>(fn: (sitzung: ProjectionControlSitzung) => Promise<T>): Promise<T> {
    return fn({
      control: { ...this.speicher.control },
      schreibe: (naechster) => {
        this.speicher.control = { ...naechster };
        return Promise.resolve();
      },
    });
  }

  /**
   * Der gemeinsame Schreibrahmen JEDER Projektionsmutation: Stempel bestimmen, Zeile schreiben und
   * — falls die Mutation ausserhalb der freigegebenen Generation liegt — den Marker fällen. Alles
   * unter derselben Sperre, unter der auch das Gate läuft; genau das macht ROT-4 und ROT-5 zu einer
   * einzigen Regel statt zu zwei Sonderfällen.
   */
  private schreibeUnterSperre(
    projection: KoSearchProjection,
    schreiben: (generation: number | null) => boolean,
  ): Promise<boolean> {
    return this.withExclusiveControlLock((sitzung) => {
      const stempel = schreibStempel(sitzung.control, projection.projectionVersion);
      const geschrieben = schreiben(stempel.generation);
      if (geschrieben && stempel.invalidieren) {
        return sitzung
          .schreibe({ ...sitzung.control, integrityMarker: null })
          .then(() => geschrieben);
      }
      return Promise.resolve(geschrieben);
    });
  }

  async activeProjectionAudit(): Promise<ProjectionAudit> {
    const kos = (await this.kos.listForSearch({})).filter((ko) => !ko.deletedAt);
    const metadaten = new Set(
      (await this.metadata.findMany(kos.map((ko) => ko.id))).map((m) => m.koId),
    );
    const fassungen = new Map<number, number>();
    let mitInhalt = 0;
    let mitMetadaten = 0;
    let pflichtfelderFehlen = 0;
    for (const ko of kos) {
      const projection = this.items.get(schluessel(ko.id, ko.version));
      if (projection) {
        mitInhalt += 1;
        fassungen.set(
          projection.projectionVersion,
          (fassungen.get(projection.projectionVersion) ?? 0) + 1,
        );
        if (!projection.contentHash || !projection.language || !projection.status) {
          pflichtfelderFehlen += 1;
        }
      }
      if (metadaten.has(ko.id)) {
        mitMetadaten += 1;
      }
    }
    return {
      kos: kos.length,
      mitInhalt,
      mitMetadaten,
      aktiveFassungen: [...fassungen.entries()]
        .map(([projectionVersion, count]) => ({ projectionVersion, count }))
        .sort((a, b) => a.projectionVersion - b.projectionVersion),
      pflichtfelderFehlen,
    };
  }

  insert(projection: KoSearchProjection): Promise<boolean> {
    const key = schluessel(projection.koId, projection.koVersion);
    return this.schreibeUnterSperre(projection, (generation) => {
      if (this.items.has(key)) {
        return false;
      }
      this.items.set(key, { ...projection });
      this.generationen.set(key, generation);
      return true;
    });
  }

  async replace(projection: KoSearchProjection): Promise<void> {
    const key = schluessel(projection.koId, projection.koVersion);
    await this.schreibeUnterSperre(projection, (generation) => {
      this.items.set(key, { ...projection });
      this.generationen.set(key, generation);
      return true;
    });
  }

  generationOf(koId: string, koVersion: number): Promise<number | null | undefined> {
    const key = schluessel(koId, koVersion);
    return Promise.resolve(this.items.has(key) ? (this.generationen.get(key) ?? null) : undefined);
  }

  async activeRowsInGeneration(generation: number): Promise<boolean> {
    for (const ko of (await this.kos.listForSearch({})).filter((k) => !k.deletedAt)) {
      const key = schluessel(ko.id, ko.version);
      const projection = this.items.get(key);
      if (
        !projection ||
        projection.projectionVersion !== SEARCH_PROJECTION_VERSION ||
        (this.generationen.get(key) ?? null) !== generation
      ) {
        return false;
      }
    }
    return true;
  }

  find(koId: string, koVersion: number): Promise<KoSearchProjection | undefined> {
    return Promise.resolve(this.items.get(schluessel(koId, koVersion)));
  }

  listByKo(koId: string): Promise<KoSearchProjection[]> {
    return Promise.resolve(
      [...this.items.values()]
        .filter((p) => p.koId === koId)
        .sort((a, b) => a.koVersion - b.koVersion),
    );
  }

  async findActive(query: KoSearchQuery): Promise<KoSearchHit[]> {
    // DER CONTROL-STATE ZUERST — vor jeder fachlichen Leermengenentscheidung (04 §4). Stünde die
    // Prüfung hinter `terms.length === 0`, meldete eine nicht suchbereite Instanz bei leerer Anfrage
    // ein ehrliches „nichts gefunden" und log damit über ihre Verfügbarkeit.
    const { fassung: aktiveFassung, generation } = freigegebeneProjektion(
      await this.controlState(),
    );
    // JOB 1531 D2 (S2): die deklarierte Zuordnung wird AUFGERUFEN, nicht neu gebaut. Sie steht
    // seit `6ebd903` in `search-projection.ts:976` und war bis hierher wirkungslos — ein Baustein
    // in der Luft. `expandSearchTerms` ERGAENZT die bereinigten Terme; es ersetzt
    // `normalizeSearchTerms` nicht, weil das zwei verschiedene Aussagen sind (was gab der Nutzer
    // ein / wonach wird ausserdem gesucht) und weil der Panelspiegel an der Bereinigung haengt.
    const terms = expandSearchTerms(normalizeSearchTerms(query.terms));
    if (terms.length === 0) {
      return [];
    }
    // Ohne `limit` bleibt die Treffermenge ungedeckelt (s. KoSearchQuery) — wer keinen Deckel
    // setzt, verliert keinen Treffer still. (JOB 3048: das ist NICHT dasselbe wie „die Bibliothek";
    // die deckelt seit JOB 2689 auf 200. Wer deckelt, sagt mit `deckelauswahl`, wer überleben soll.)
    const limit = query.limit === undefined ? undefined : Math.max(0, Math.floor(query.limit));
    if (limit === 0) {
      return [];
    }
    // Der „JOIN": nur Projektionen, deren Version die AKTUELLE des Wissensobjekts ist. Getrashte
    // Objekte fallen weg — ein Papierkorb-Eintrag ist kein Suchtreffer.
    //
    // UND — die R1-Zeile — nur Zeilen der FREIGEGEBENEN Projektionsfassung. Eine V1-Zeile bleibt
    // physisch im Bestand und über `listByKo`/`find` sichtbar; sie ist nur kein regulärer Treffer
    // mehr. Der Wert stammt aus dem Control-State, nie aus einer festverdrahteten Konstante: sonst
    // gäbe es zwei Wahrheiten darüber, was gerade gilt.
    //
    // UND — die Zeile aus Entscheidung 09 §3 — nur Zeilen der AKTIVEN GENERATION. Eine Zeile, die
    // seit der Freigabe ausserhalb dieser Generation entstanden ist, gehört nicht zum geprüften
    // Bestand. Sie still mitzuliefern wäre dieselbe zweite Wahrheit, die die Fassungsgrenze gerade
    // abgeschafft hat. Für den ungenerationierten Legacy-V1-Betrieb entfällt die Bedingung.
    const kos = new Map((await this.kos.listForSearch({})).map((ko) => [ko.id, ko]));
    const aktiv = [...this.items.values()].filter((projection) => {
      const ko = kos.get(projection.koId);
      return Boolean(
        ko &&
          !ko.deletedAt &&
          ko.version === projection.koVersion &&
          projection.projectionVersion === aktiveFassung &&
          (generation === null ||
            (this.generationen.get(schluessel(projection.koId, projection.koVersion)) ?? null) ===
              generation),
      );
    });
    // Ein Nachschlag für die ganze Kandidatenmenge statt einer je Zeile (Spiegel des SQL-JOINs).
    const metadaten = new Map<string, KoMetadataProjection>(
      (await this.metadata.findMany(aktiv.map((p) => p.koId))).map((m) => [m.koId, m]),
    );
    const gefunden: Gefunden[] = [];
    for (const projection of aktiv) {
      const ko = kos.get(projection.koId);
      if (!ko) {
        continue;
      }
      const hit = matchEffectiveSearchDocument(
        composeEffectiveSearchDocument(projection, metadaten.get(projection.koId)),
        terms,
      );
      if (hit) {
        gefunden.push({ hit, validiert: ko.status === "validiert", trust: ko.trust ?? 0 });
      }
    }
    // JOB 3048: ZWEI ORDNUNGEN MIT ZWEI AUFGABEN — und sie stehen nicht nebeneinander, sondern
    // ineinander.
    //
    //   `ausgabeordnung`  ist Zeichen für Zeichen die bisherige Regel und bleibt die EINZIGE
    //                     Aussage darüber, in welcher Reihenfolge Treffer den Adapter verlassen.
    //   `auswahlordnung`  entscheidet AUSSCHLIESSLICH über das Überleben im Deckel. Sie stellt der
    //                     Ausgabeordnung die Treffergüte VORAN — aber NUR, wenn der Aufrufer sie
    //                     angefordert hat (`deckelauswahl: "trefferguete"`). Bei gleicher Güte und
    //                     im Vorgabefall `vertrauen` fällt sie auf dieselbe Ausgabeordnung zurück.
    //                     Das ist kein zweiter Sortierpfad: es ist DIESELBE Regel mit einem
    //                     vorangestellten Schlüssel, der im Vorgabefall neutral ist (0).
    //
    // WARUM DER SCHLÜSSEL BEDINGT IST (BEN, Runde 1): weil `limit` nicht nur der Kandidatenweg
    // setzt. Die Bibliothek deckelt seit JOB 2689 auf 200; ein unbedingter Gütevorrang hätte ihre
    // Trefferliste still verschoben. Im Vorgabefall ist der Ausdruck `0 || ausgabeordnung(a, b)`
    // — also buchstäblich die alte Auswahl, und das anschließende zweite Sortieren einer bereits
    // total geordneten Liste ist die Identität.
    const guetevorrang = (query.deckelauswahl ?? DECKELAUSWAHL_VORGABE) === "trefferguete";
    const ausgabeordnung = (a: Gefunden, b: Gefunden) =>
      Number(b.validiert) - Number(a.validiert) ||
      b.trust - a.trust ||
      a.hit.koId.localeCompare(b.hit.koId);
    const auswahlordnung = (a: Gefunden, b: Gefunden) =>
      (guetevorrang ? suchTrefferguete(b.hit.matched) - suchTrefferguete(a.hit.matched) : 0) ||
      ausgabeordnung(a, b);
    if (limit === undefined) {
      return gefunden.sort(ausgabeordnung).map((x) => x.hit);
    }
    return gefunden
      .sort(auswahlordnung)
      .slice(0, limit)
      .sort(ausgabeordnung)
      .map((x) => x.hit);
  }

  async missingActive(limit: number): Promise<string[]> {
    const cap = Math.max(0, Math.floor(limit));
    if (cap === 0) {
      return [];
    }
    const kos = (await this.kos.listForSearch({})).filter((ko) => !ko.deletedAt);
    const metadaten = new Set(
      (await this.metadata.findMany(kos.map((ko) => ko.id))).map((m) => m.koId),
    );
    const out: string[] = [];
    for (const ko of kos) {
      const projection = this.items.get(schluessel(ko.id, ko.version));
      const offen =
        !projection ||
        projection.projectionVersion !== SEARCH_PROJECTION_VERSION ||
        !metadaten.has(ko.id);
      if (offen) {
        out.push(ko.id);
        if (out.length >= cap) {
          break;
        }
      }
    }
    return out;
  }

  inventoryByProjectionVersion(): Promise<{ projectionVersion: number; count: number }[]> {
    const zaehler = new Map<number, number>();
    for (const projection of this.items.values()) {
      zaehler.set(
        projection.projectionVersion,
        (zaehler.get(projection.projectionVersion) ?? 0) + 1,
      );
    }
    return Promise.resolve(
      [...zaehler.entries()]
        .map(([projectionVersion, count]) => ({ projectionVersion, count }))
        .sort((a, b) => a.projectionVersion - b.projectionVersion),
    );
  }

  async remove(
    koId: string,
    koVersion: number,
    opts: { ruecknahme?: boolean } = {},
  ): Promise<void> {
    const key = schluessel(koId, koVersion);
    const projection = this.items.get(key);
    // Der Lebendbeleg ist ein PUNKTNACHSCHLAG, kein Bestandslauf: nur DIESES Objekt in GENAU dieser
    // Version entscheidet, ob hier eine bedienende Zeile verschwindet.
    const ko = opts.ruecknahme
      ? undefined
      : (await this.kos.listForSearch({})).find((k) => k.id === koId);
    const lebt = Boolean(ko && !ko.deletedAt && ko.version === koVersion);
    await this.withExclusiveControlLock(async (sitzung) => {
      const faellt =
        !opts.ruecknahme &&
        entfernungInvalidiert(
          sitzung.control,
          projection
            ? {
                projectionVersion: projection.projectionVersion,
                generation: this.generationen.get(key) ?? null,
              }
            : undefined,
          lebt,
        );
      this.items.delete(key);
      this.generationen.delete(key);
      if (faellt) {
        await sitzung.schreibe({ ...sitzung.control, integrityMarker: null });
      }
    });
  }

  async removeByKo(koId: string): Promise<void> {
    for (const [key, projection] of this.items) {
      if (projection.koId === koId) {
        this.items.delete(key);
        this.generationen.delete(key);
      }
    }
    await this.metadata.remove(koId);
  }

  count(): Promise<number> {
    return Promise.resolve(this.items.size);
  }
}
