// ================================================================================================
// JOB 4154 · WIKI-GESAMTANWEISUNG — DER GEGENSTAND „ANWEISUNG", UND WARUM ER GEBUNDEN BINDET.
// ================================================================================================
//
// Eine Anweisung ist ein lesbares Dokument aus Titel, Zweck, Geltungsbereich, Voraussetzungen und
// einer GEORDNETEN Folge von Bausteinen. Jeder Baustein verweist auf eine KONKRETE Fassung eines
// vorhandenen Wissenseintrags — nicht auf „den Eintrag".
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE BINDUNG (koId, koVersion, nachweisHash) HEISST UND NICHT NUR koId
// ------------------------------------------------------------------------------------------------
// Wörtlich aus dem Startvertrag (`GESAMTANWEISUNG-STARTVERTRAG.md`, Abschnitt „Festgehaltener
// Prüfstand"): „Keine dynamische Ersetzung eines eingebundenen Bausteins in einer bereits
// freigegebenen Anweisung. Neuere Fassung bedeutet Aktualisierungsvorschlag."
//
// Eine unversionierte Bindung würde genau das verletzen: Wer eine Anweisung entschieden hat, hätte
// morgen eine andere Anweisung, ohne dass jemand etwas entschieden hätte. Die Fassungsnummer ist
// deshalb Teil der Identität des Bausteins, nicht eine Anzeige daneben.
//
// Der `nachweisHash` kommt zusätzlich dazu und trägt eine ANDERE Aussage: er belegt, dass der
// Inhalt jener Fassung derselbe geblieben ist. Er belegt NICHT, dass er richtig ist — deshalb
// heisst das Vergleichsergebnis unten `unveraendert` und nicht `geprueft`. Auch das steht wörtlich
// im Startvertrag: „Ein gleicher Hash bestätigt Unverändertheit, nicht Richtigkeit."
//
// ------------------------------------------------------------------------------------------------
// KEIN NEUER KO-TYP
// ------------------------------------------------------------------------------------------------
// Die Anweisung ist ein EIGENER Gegenstand mit eigener Ablage. `KNOWLEDGE_TYPES` (`types.ts:9`)
// bleibt unberührt, und ein Dokumenttyp am Wissensobjekt entsteht hier nicht. `bodyTemplates.ts`
// (procedure/decision) bleibt, was es ist: ein HTML-Textgerüst im Editor.

// NUR der Stufentyp — kein Wissensobjekt, kein `KNOWLEDGE_TYPES`, keine Berührung des KO-Modells.
// Er steht hier, damit die Sichtbarkeitsfakten unten ZEICHENGLEICH zu `SichtbarkeitsFakten`
// (`services/app/src/sichtbarkeit.ts:50`) sind: sonst müsste die Route beim Durchreichen eine
// Zeichenkette auf die Stufe verengen, und diese Verengung wäre eine zweite Auslegung von
// `isConfidential`.
import type { Confidentiality } from "./types";

// ================================================================================================
// DER GEGENSTAND
// ================================================================================================

/**
 * Der Lebenslauf einer Anweisung.
 *
 * `entschieden` entsteht AUSSCHLIESSLICH aus einer menschlichen Entscheidung über die
 * Gesamtfassung — nie aus den Markierungen der einzelnen Bausteine. Startvertrag: „Die
 * Entscheidung über die Gesamtfassung ist getrennt von Freigaben einzelner Bausteine."
 */
export type AnweisungStand = "entwurf" | "vorgelegt" | "entschieden" | "abgelehnt";

/**
 * Ein Baustein bindet genau EINE Fassung eines vorhandenen Eintrags.
 *
 * `nachweisHash` ist `null`, wenn zu dieser Fassung kein Nachweis vorliegt — das ist ein eigener
 * Zustand und wird im Vergleich zu `unbekannt`, nie zu `unveraendert`.
 */
export interface Baustein {
  readonly id: string;
  /** Der Platz in der Folge, ab 0 und lückenlos. Die Reihenfolge IST Teil der Gesamtfassung. */
  readonly position: number;
  readonly koId: string;
  readonly koVersion: number;
  readonly nachweisHash: string | null;
  readonly voraussetzung?: string;
}

export interface Anweisung {
  readonly id: string;
  readonly titel: string;
  readonly zweck: string;
  readonly geltungsbereich: string;
  readonly voraussetzungen: string;
  readonly bausteine: readonly Baustein[];
  readonly stand: AnweisungStand;
  /**
   * Die CAS-Nummer des Bestands — sie zählt SCHREIBVORGÄNGE, nicht Inhalt.
   *
   * Dieselbe Bauart wie `KnowledgeObject.rowVersion` (`repo-pg.ts:412-437`): jeder erfolgreiche
   * Schreibvorgang erhöht sie um eins, und jeder bedingte UPDATE greift nur auf dem gelesenen
   * Wert. Vorlegen und Entscheiden hängen daran (Fall F4).
   */
  readonly version: number;
  readonly urheber: string;
  readonly erstelltAm: string;
  readonly geaendertAm: string;
}

// ================================================================================================
// DER INHALT EINER GEBUNDENEN FASSUNG — ALS TATSACHEN, NICHT ALS HTML
// ================================================================================================
//
// Der Vergleich zählt ausdrücklich Tabellenüberschriften, Abbildungen und Geltung (Startvertrag).
// Der Dienst selbst liest kein HTML: er bekommt diese Tatsachen übergeben. Das hält ihn rein
// prüfbar UND verhindert eine zweite Auswertung neben der bestehenden.
//
// `null` heisst UNBEKANNT und ist von „leer" unterschieden: eine Fassung ohne Abbildungen hat
// `abbildungen: []`, eine Fassung, deren Abbildungen niemand feststellen konnte, hat `null`.
// Die beiden dürfen nie zusammenfallen — sonst würde „nicht feststellbar" als „nichts vorhanden"
// gelesen, und genau das verbietet der Anzeigevertrag (`VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md`:
// „unbekannter Prüfumfang bleibt ‚Umfang nicht belegt'").

export interface BausteinInhalt {
  readonly tabellenUeberschriften: readonly string[] | null;
  readonly abbildungen: readonly string[] | null;
  readonly geltung: string | null;
}

/** Der unbestimmte Inhalt — jede Tatsache unbekannt. Kein leerer Inhalt. */
export const INHALT_UNBEKANNT: BausteinInhalt = {
  tabellenUeberschriften: null,
  abbildungen: null,
  geltung: null,
};

/** Die gebundene Fassung, so wie sie im Bestand steht. Herkunftsauskunft des Lesestands. */
export interface GebundeneFassung {
  readonly koId: string;
  readonly version: number;
  readonly titel: string;
  readonly autor: string;
  /**
   * Wann diese Fassung entstanden ist — `null`, wenn es dazu keinen Fassungssatz gibt.
   *
   * NICHT das Anlagedatum des Eintrags ersatzweise: das wäre die Fassungszeit einer ANDEREN
   * Fassung und damit eine Erfindung. Unbekannt bleibt unbekannt.
   */
  readonly fassungAm: string | null;
  readonly status: string;
  readonly inhalt: BausteinInhalt;
  /**
   * JOB 4233 · DER RUMPF DIESER FASSUNG — der Text, den ein Mensch lesen will.
   *
   * `null` heisst UNBEKANNT (kein Rumpf im Fassungssatz) und ist von „leer" unterschieden, genau
   * wie bei den Mengen oben. Er steht HIER und NICHT in `BausteinInhalt`, und das ist gemessen,
   * nicht Geschmack: `BausteinInhalt` fliesst über `standAufnehmen` (`gesamtanweisung-service.ts`)
   * in den festgehaltenen Prüfstand (`gesamtanweisung_staende.aufnahme`) und über `inhaltsBefunde`
   * in den Vergleich. Ein Dokumentrumpf dort wäre eine ZWEITE DOKUMENTWAHRHEIT neben dem
   * Wissenseintrag — und der Vergleich spräche plötzlich über HTML statt über Tatsachen.
   */
  readonly rumpfHtml: string | null;
}

/**
 * Was der Bestand über EINEN gebundenen Baustein weiss.
 *
 * `gebunden === null` heisst: die gebundene Fassung ist nicht auffindbar. Dann bleibt die
 * Herkunft leer und der Inhalt unbekannt — es wird NICHT auf die heutige Fassung ausgewichen.
 * `aktuelleVersion === null` heisst: die heutige Fassung ist unbekannt; dann entsteht auch kein
 * Aktualisierungsvorschlag, denn es gäbe keine belegte Grundlage dafür.
 */
export interface KoFassungslage {
  readonly koId: string;
  /**
   * Die Sichtbarkeitsfakten des Eintrags — STRUKTURGLEICH zu `SichtbarkeitsFakten`
   * (`services/app/src/sichtbarkeit.ts:67`) und aus demselben Grund wie
   * `KantenSichtbarkeitsFakten` (`kanten-service.ts:140`) hier eigenständig benannt: dieses Modul
   * darf `services/app` nicht importieren, und ein eigenes Prädikat wäre die zweite Wahrheit.
   * Die ENTSCHEIDUNG kommt übergeben, nur ihre EINGABE steht hier.
   */
  readonly confidentiality?: Confidentiality | null | undefined;
  readonly author?: string | null | undefined;
  readonly aktuelleVersion: number | null;
  readonly gebunden: GebundeneFassung | null;
}

/** Der Schlüssel, unter dem eine Fassungslage nachgeschlagen wird: Eintrag UND Fassung. */
export function fassungsSchluessel(koId: string, koVersion: number): string {
  return `${koId}@${koVersion}`;
}

export type Fassungslagen = ReadonlyMap<string, KoFassungslage>;

// ================================================================================================
// DIE RECHTEENTSCHEIDUNG — ÜBERGEBEN, NICHT SELBST GETROFFEN
// ================================================================================================

/** Dieselbe Mindestform wie `KoFassungslage` sie trägt — und wie `SichtbarkeitsFakten` sie fordert. */
export interface AnweisungSichtbarkeitsFakten {
  readonly confidentiality?: Confidentiality | null | undefined;
  readonly author?: string | null | undefined;
}

export type AnweisungSichtbar = (fakten: AnweisungSichtbarkeitsFakten) => boolean;

/**
 * FAIL-CLOSED, wörtlich im Muster von `kanten-service.ts:146-148`: ohne übergebene Entscheidung
 * ist NICHTS sichtbar — nicht „alles". Eine vergessene Injektion in der Kompositionswurzel darf
 * nicht den gesamten Bestand ausliefern.
 */
export function erzwingeSichtbar(sichtbar: AnweisungSichtbar | undefined): AnweisungSichtbar {
  return typeof sichtbar === "function" ? sichtbar : () => false;
}

// ================================================================================================
// DER LESESTAND
// ================================================================================================

export interface BausteinHerkunft {
  readonly titel: string;
  readonly autor: string;
  /** `null` = unbekannt. Von „kein Datum" ist das nicht zu unterscheiden — es gibt keins. */
  readonly fassungAm: string | null;
  readonly status: string;
}

export interface Aktualisierungsvorschlag {
  /** Die neuere Fassung, die es GÄBE. Die gebundene bleibt trotzdem stehen. */
  readonly aufVersion: number;
}

export interface BausteinLesestand {
  readonly id: string;
  readonly position: number;
  readonly koId: string;
  readonly koVersion: number;
  readonly nachweisHash: string | null;
  readonly voraussetzung: string | null;
  /** `null`: die gebundene Fassung ist nicht auffindbar — kein Ausweichen auf die heutige. */
  readonly herkunft: BausteinHerkunft | null;
  /**
   * JOB 4233 · Der Text GENAU der gebundenen Fassung, neben der Herkunft und aus derselben Quelle.
   *
   * `null` heisst UNBEKANNT: entweder ist die gebundene Fassung nicht auffindbar (dann ist auch
   * `herkunft` null), oder sie trägt keinen Rumpf. In beiden Fällen bleibt es unbekannt — es wird
   * NIE auf die heutige Fassung ausgewichen, und „unbekannt" wird nie als „leer" gezeigt.
   */
  readonly rumpfHtml: string | null;
  readonly aktuelleKoVersion: number | null;
  readonly aktualisierungsvorschlag: Aktualisierungsvorschlag | null;
  readonly inhalt: BausteinInhalt;
}

/**
 * Der Lückenvermerk als DATUM, nicht als Satz in einer Komponente.
 *
 * Startvertrag: „Aktuelle Lücken der Prüfanbindung deutlich nennen." Solange keine Prüfung an der
 * Anweisung hängt, sagt der Server es selbst — damit keine Oberfläche einen grünen Haken erfinden
 * kann, den der Bestand nicht hergibt.
 */
export const PRUEFANBINDUNG_OFFEN = "nicht_angebunden" as const;

export interface AnweisungLesestand {
  readonly id: string;
  readonly titel: string;
  readonly zweck: string;
  readonly geltungsbereich: string;
  readonly voraussetzungen: string;
  readonly stand: AnweisungStand;
  readonly version: number;
  readonly urheber: string;
  readonly erstelltAm: string;
  readonly geaendertAm: string;
  /** NUR die zugänglichen Bausteine. Ein verborgener erscheint hier gar nicht — auch nicht leer. */
  readonly bausteine: readonly BausteinLesestand[];
  /** Wahr, sobald auch nur ein gebundener Baustein für den Betrachter nicht zugänglich ist. */
  readonly unvollstaendig: boolean;
  /**
   * Wie viele Bausteine verborgen sind — die Zahl, und sonst nichts.
   *
   * Sie steht hier, weil der Auftrag sie ausdrücklich verlangt („samt Anzahl der verborgenen
   * Bausteine") und weil ein Leser sonst nicht wüsste, ob ihm ein Satz oder ein halbes Dokument
   * fehlt. Titel und Kennung des geschützten Eintrags stehen NICHT dabei.
   */
  readonly verborgeneBausteine: number;
  readonly pruefanbindung: typeof PRUEFANBINDUNG_OFFEN;
}

// ================================================================================================
// JOB 4357 · DER BESTAND ALS LISTE — DER KOPF JEDER ANWEISUNG UND ZWEI ZAHLEN, SONST NICHTS.
// ================================================================================================
//
// WOZU DAS DA IST. Bis JOB 4357 war eine gespeicherte Anweisung ausschliesslich über ihre KENNUNG
// erreichbar (`AnweisungLesestand` oben, `GET /api/gesamtanweisungen/:id`). Wer sie nicht notiert
// hatte, fand sie nach einem Neustart nicht wieder — der Menüpunkt führte nur auf ein Formular.
//
// WARUM EIN EIGENER GEGENSTAND UND NICHT `readonly AnweisungLesestand[]`, und das ist der Kern:
// ein Lesestand trägt JEDEN zugänglichen Baustein samt Titel, Fassungskennung und RUMPF der
// gebundenen Fassung. Eine Liste über zwanzig Anweisungen wäre damit ein vollständiger Abzug des
// halben Bestands an einem Endpunkt, den die Fläche bei jedem Menüklick ruft. Der Eintrag hier
// trägt deshalb NUR den Kopf und ZWEI ZAHLEN — kein Baustein-Titel, keine Fassungskennung, kein
// Rumpf. Was ein Betrachter nicht sehen darf, kann hier gar nicht durchsickern, weil es hier
// überhaupt keinen Platz hat.
//
// DIE ZWEI ZAHLEN SIND DIESELBEN WIE AM EINZELABRUF und werden nicht zweitausgelegt: sie entstehen
// in `listeneintrag` (`gesamtanweisung-service.ts`) AUS `lesestand` — `sichtbareBausteine` ist
// dessen `bausteine.length`, `verborgeneBausteine` und `unvollstaendig` sind wörtlich seine Felder.
// Eine zweite Zählung neben `lesestand` wäre genau die zweite Wahrheit, gegen die `darfSehen` als
// EINE Stelle gebaut ist (`services/app/src/sichtbarkeit.ts`, Kopf).
//
// UND SIE SIND GETRENNT, nicht summiert: „0 sichtbar / 3 verborgen" und „3 sichtbar / 0 verborgen"
// sind für den Leser zwei völlig verschiedene Lagen. Eine einzige Gesamtzahl würde die erste als
// die zweite ausgeben — dieselbe Klasse Unwahrheit wie „unbekannt" als „leer" zu zeigen.

export interface AnweisungListeneintrag {
  readonly id: string;
  readonly titel: string;
  readonly stand: AnweisungStand;
  /** Die CAS-Nummer — sie steht hier, damit die Fläche denselben Stand benennen kann wie der Kopf. */
  readonly version: number;
  readonly urheber: string;
  readonly erstelltAm: string;
  readonly geaendertAm: string;
  /** Wie viele Bausteine dieser Betrachter sehen darf — `lesestand(...).bausteine.length`. */
  readonly sichtbareBausteine: number;
  /** Wie viele ihm verborgen bleiben. Die Zahl, und sonst nichts über sie. */
  readonly verborgeneBausteine: number;
  /** Wahr, sobald auch nur einer verborgen ist — wörtlich `lesestand(...).unvollstaendig`. */
  readonly unvollstaendig: boolean;
}

/**
 * Die Antwort des Listenwegs.
 *
 * EIN OBJEKT UM DAS FELD `eintraege` und kein nacktes Feld: dasselbe Muster wie
 * `{ staende: … }` an `GET /api/gesamtanweisungen/:id/staende` (`gesamtanweisung-routes.ts`). Ein
 * nacktes Array liesse sich später nicht um eine Auskunft ergänzen, ohne den Drahtvertrag zu
 * brechen — und eine Fläche, die ein Array erwartet, unterscheidet „leer" nicht von „unbrauchbar".
 */
export interface AnweisungListe {
  readonly eintraege: readonly AnweisungListeneintrag[];
}

// ================================================================================================
// DER FESTGEHALTENE PRÜFSTAND UND SEIN VERGLEICH
// ================================================================================================

export interface AufgenommenerBaustein {
  readonly id: string;
  readonly position: number;
  readonly koId: string;
  readonly koVersion: number;
  readonly nachweisHash: string | null;
  readonly voraussetzung: string | null;
  readonly inhalt: BausteinInhalt;
}

/**
 * Ein festgehaltener Stand. Er trägt die eigene Dokumentfassung, die Reihenfolge und die festen
 * Baustein-/Medienfassungen — genau die Aufzählung des Startvertrags.
 */
export interface AnweisungStandAufnahme {
  readonly anweisungId: string;
  readonly version: number;
  readonly aufgenommenAm: string;
  readonly titel: string;
  readonly zweck: string;
  readonly geltungsbereich: string;
  readonly voraussetzungen: string;
  readonly bausteine: readonly AufgenommenerBaustein[];
}

/**
 * Das Ergebnis eines Vergleichs — in genau dieser Vokabel.
 *
 * `unveraendert` heisst UNVERÄNDERT. Es heisst nicht richtig, nicht geprüft, nicht bestätigt und
 * nicht freigegeben. Wer hier ein viertes Wort einführt, führt eine Behauptung ein, die der
 * Bestand nicht hergibt.
 *
 * `unbekannt` ist ein EIGENER Wert und wird nie zu `unveraendert` zusammengefasst — die Auswirkung
 * einer Änderung, die niemand bestimmen konnte, bleibt sichtbar und fachlich zu klären.
 */
export type Auswirkung = "unveraendert" | "geaendert" | "unbekannt";

export type VergleichsFeld =
  | "kopf"
  | "geltung"
  | "voraussetzungen"
  | "bausteinbestand"
  | "reihenfolge"
  | "fassung"
  | "tabellenueberschriften"
  | "abbildungen";

export interface VergleichsBefund {
  readonly feld: VergleichsFeld;
  /** `null` = die Anweisung selbst, sonst der Baustein. */
  readonly bausteinId: string | null;
  readonly auswirkung: Auswirkung;
  /** Ein Satz ohne geschützte Titel, Kennungen oder Zahlen fremder Einträge. */
  readonly hinweis: string;
}

export interface AnweisungVergleich {
  readonly anweisungId: string;
  readonly vonVersion: number;
  readonly bisVersion: number;
  readonly gesamt: Auswirkung;
  readonly befunde: readonly VergleichsBefund[];
  /** Wie viele Befunde unbestimmbar blieben. Sie verschwinden nirgends. */
  readonly unbekannte: number;
}

// ================================================================================================
// DER SPEICHERVERTRAG
// ================================================================================================

/**
 * Die Ablage der Anweisung — als PORT.
 *
 * Er steht hier und nicht bei der Postgres-Fassung, weil ihn zwei Seiten brauchen: der Dienst
 * (`gesamtanweisung-service.ts`) ruft ihn, der Adapter (`gesamtanweisung-repo-pg.ts`) erfüllt ihn.
 * Läge er beim Adapter, hinge der Dienst an `pg`.
 *
 * Das In-Memory-Gegenstück lebt AUSSCHLIESSLICH im Testordner (`tests/wiki-gesamtanweisung/`).
 * Ein Testdouble im Produktmodul wäre eine zweite Ablage, die im Betrieb versehentlich gebunden
 * werden kann — genau der Fall, gegen den der Auftrag echte Persistenz verlangt.
 */
export interface AnweisungRepo {
  get(id: string): Promise<Anweisung | undefined>;
  /**
   * Anlegen — Kopf, Bausteinfolge UND der erste Prüfstand in EINER Transaktion.
   *
   * Die Aufnahme ist ein PFLICHTPARAMETER und kein zweiter Aufruf. Der Grund steht unten.
   */
  anlegen(anweisung: Anweisung, aufnahme: AnweisungStandAufnahme): Promise<void>;
  /**
   * Bedingter Schreibzugriff — und der festgehaltene Prüfstand dazu, in EINER Transaktion.
   *
   * ZWEI ZUSAGEN IN EINER METHODE, und dass sie zusammengehören, ist bezahlt:
   *
   * 1. CAS. Der Schreibvorgang greift NUR, wenn die gespeicherte Version `erwartet` ist; sonst
   *    wirft er `CONFLICT` mit dem tatsächlichen Stand. Ohne diese Bedingung könnten Vorlegen und
   *    Entscheiden auf einem Stand landen, den niemand gesehen hat (F4).
   *
   * 2. ATOMAR MIT DER HISTORIE. Bis Runde 2 stand hier ein getrenntes `standFesthalten`, und der
   *    Dienst rief es NACH dem Schreiben. BEN hat gemessen, was das heisst: scheitert der zweite
   *    Aufruf, ist der Bestand geändert und der zugehörige Prüfstand fehlt — die Anweisung trägt
   *    dann Version 2, die Historie kennt nur 1, und der ausgelassene Zwischenstand ist nicht mehr
   *    rekonstruierbar. Genau dieser Stand ist der Gegenstand des Auftrags („Server bestätigt nur
   *    genau den vorgelegten unveränderten Prüfstand"); ohne ihn ist der Vergleich zweier Stände
   *    eine Lücke, die man erst bemerkt, wenn man sie braucht.
   *
   * Deshalb nimmt der Port die Aufnahme ENTGEGEN, statt sie nachzureichen. Eine Ablage, die beides
   * nicht zusammen schreiben kann, kann diesen Port nicht erfüllen — und das ist die Absicht.
   */
  schreiben(
    anweisung: Anweisung,
    erwartet: number,
    aufnahme: AnweisungStandAufnahme,
  ): Promise<void>;
  standLesen(anweisungId: string, version: number): Promise<AnweisungStandAufnahme | undefined>;
  /** Die Versionsnummern der festgehaltenen Stände, aufsteigend. */
  staende(anweisungId: string): Promise<readonly number[]>;
  /**
   * ==============================================================================================
   * JOB 4357 · DER GESAMTE BESTAND — UND WARUM DIESE EINE METHODE OPTIONAL IST.
   * ==============================================================================================
   *
   * Sie liefert die Anweisungen, wie sie gespeichert sind: OHNE Trimm, OHNE Reihenfolgezusage.
   * Beides gehört bewusst nicht hierher.
   *   · KEIN TRIMM, weil die Ablage die Rechtefrage nicht stellen darf — die Entscheidung reist als
   *     `AnweisungSichtbar` in den Dienst (oben, `erzwingeSichtbar`), und eine Ablage, die selbst
   *     filterte, wäre die zweite Auslegung von „darf sehen".
   *   · KEINE REIHENFOLGE, weil der Dienst sie setzt (`GesamtanweisungDienst.auflisten`). Stünde sie
   *     als Zusage hier, müsste jede Ablage sie einhalten — zwei Implementierungen derselben
   *     Sortierregel, von denen eines Tages eine abweicht.
   *
   * WARUM `liste?` UND NICHT `liste`, ausgeschrieben statt stillschweigend: dieser Port hat drei
   * Erfüller, und zwei davon liegen AUSSERHALB der Zielpfade dieses Auftrags
   * (`tests/wiki-gesamtanweisung/pruefstand.ts` → `InMemoryAnweisungRepo`,
   * `tests/wiki-gesamtanweisung-fassungsbindung/flaeche-zwei-ursachen.test.tsx` →
   * `VergesslicheAblage`). Eine Pflichtmethode würde deren Typprüfung brechen, und dieser Auftrag
   * darf sie nicht anfassen (Abnahmekriterium 5: an bestehenden Fällen wird nichts verändert).
   *
   * WAS DAS EHRLICH KOSTET, und es wird nicht weggeredet: eine künftige Ablage kann diese Methode
   * typgültig weglassen, und der Compiler sagt dazu nichts. Der Preis ist an genau EINER Stelle
   * bezahlt und dort auch geprüft: `auflisten` lehnt eine Ablage ohne `liste` mit einem
   * ausgeschriebenen Fehler AB und liefert NIEMALS eine leere Liste. Eine leere Liste wäre die
   * Aussage „es ist nichts gespeichert" über einen Bestand, den niemand gelesen hat — genau die
   * unbelegte Negativaussage, die der Anzeigevertrag verbietet. Fail-closed, wie `erzwingeSichtbar`.
   *
   * WER SIE ERFÜLLT: `PgAnweisungRepo` (`gesamtanweisung-repo-pg.ts`) für den Betrieb und die
   * flüchtige Ablage der Kompositionswurzel (`services/app/src/build-app.ts`) für Tests und Dev.
   */
  liste?(): Promise<readonly Anweisung[]>;
}

// ================================================================================================
// FEHLER
// ================================================================================================

/**
 * VIER CODES, UND ALLE VIER SIND BESTANDSWORTE — keiner ist neu. Das ist gemessen und nicht
 * Geschmack; bitte vor dem Ändern lesen.
 *
 * ERSTENS die HTTP-Abbildung: `sendError` (`services/app/src/http.ts:129-158`) bildet `NOT_FOUND`
 * auf 404, `FORBIDDEN` auf 403 und `CONFLICT` auf 409 ab; alles andere auf 400. `INVALID` ist
 * damit genau „die Eingabe taugt nicht" — und `http.ts` gehört nicht zu diesem Auftrag.
 *
 * ZWEITENS die LOGLISTE: `services/app/src/build-app.test.ts:696-736` verlangt, dass jeder
 * Domänencode aus `services/**` in `ERLAUBTE_FEHLERCODES` (`build-app.ts:1422`) steht — sonst
 * erschiene er im Protokoll als `UNBEKANNT`. `NOT_FOUND`, `FORBIDDEN`, `CONFLICT` und `INVALID`
 * stehen dort bereits. Ein fünfter Code (etwa `VALIDATION`, der erste Entwurf dieser Datei) hätte
 * einen Eintrag in `build-app.ts` verlangt — und diese Datei ist in diesem Durchgang gesperrt
 * (JOB 4151 und der Nachfolger WIKI-GESAMTANWEISUNG-ANSCHLUSS halten sie).
 *
 * Dass es dabei bleibt, ist nicht dem Zufall überlassen: `tests/wiki-gesamtanweisung/
 * fehlercodes-auf-der-logliste.test.ts` prüft jeden hier genannten Code gegen die ECHTE Liste.
 */
export type AnweisungFehlerCode = "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "INVALID";

// HIER STAND EINE LAUFZEITLISTE `ANWEISUNG_FEHLERCODES` UND IST ENTFERNT.
//
// Sie hing an `istAnweisungFehler`, das dieser Durchgang ebenfalls entfernt hat — und blieb danach
// als Export ohne Aufrufer zurück (`tests/capture/aufrufer-waechter.test.ts`). Das Produkt braucht
// sie nicht: den Code setzt der Compiler über `AnweisungFehlerCode`, und wer ihn liest, liest ihn
// als Zeichenkette (`sendError`, `services/app/src/http.ts:130`).
//
// Die ERWARTUNG „genau diese vier, alle vom Bestand" wohnt jetzt dort, wo sie geprüft wird:
// `tests/wiki-gesamtanweisung/fehlercodes-auf-der-logliste.test.ts` führt die Liste und hält sie
// gegen die echte `ERLAUBTE_FEHLERCODES` aus `build-app.ts` — und sammelt zusätzlich aus DIESEN
// Quelldateien, welche Codes wirklich geworfen werden. Ein fünfter fällt dort auf, nicht hier.

/** Der Stand, den der Server WIRKLICH hat — die Auskunft, die eine 409 mitgeben muss. */
export interface AktuellerStand {
  readonly stand: AnweisungStand;
  readonly version: number;
}

export interface AnweisungFehler extends Error {
  readonly code: AnweisungFehlerCode;
  /** Bei `CONFLICT` gesetzt: ohne den neuen Stand wäre die Ablehnung nicht nachvollziehbar. */
  readonly aktuell: AktuellerStand | null;
}

/**
 * WARUM HIER KEINE EIGENE FEHLERKLASSE STEHT — die zweite Hälfte derselben Messung.
 *
 * `build-app.test.ts:673-694` verlangt für JEDE `class …Error extends …` unter `services/**` einen
 * Eintrag in `ERLAUBTE_FEHLERTYPEN` (`build-app.ts:1339`). Eine `AnweisungError`-Klasse — der
 * erste Entwurf dieser Datei — hat den Wächter im Gesamttor prompt rot gemacht. Der Eintrag liegt
 * in `build-app.ts`, und die Datei ist gesperrt.
 *
 * Es gäbe einen billigen Ausweg: die Klasse `AnweisungKonflikt` nennen, dann greift das
 * Suchmuster nicht mehr. Das wäre genau die Umgehung, die einen Wächter wertlos macht — sie
 * kommt hier nicht vor.
 *
 * Stattdessen ein gewöhnlicher `Error` mit zwei zusätzlichen Feldern. Sein `name` bleibt „Error",
 * und „Error" steht auf `ERLAUBTE_FEHLERTYPEN` (`build-app.ts:1341`) — die Zusage des Wächters
 * („nichts erscheint als UNBEKANNT") ist also eingehalten, nicht umgangen.
 *
 * WAS DER NACHFOLGER TUN DARF: eine echte `AnweisungError`-Klasse einführen UND sie im selben Zug
 * in `ERLAUBTE_FEHLERTYPEN` eintragen. Beides zusammen, nie eines allein.
 */
export function anweisungFehler(
  code: AnweisungFehlerCode,
  message: string,
  aktuell?: AktuellerStand,
): AnweisungFehler {
  const fehler = new Error(message) as Error & {
    code: AnweisungFehlerCode;
    aktuell: AktuellerStand | null;
  };
  fehler.code = code;
  fehler.aktuell = aktuell ?? null;
  return fehler;
}

// HIER STAND `istAnweisungFehler` UND IST ENTFERNT, nicht verschoben.
//
// `tests/capture/aufrufer-waechter.test.ts` hat es gemeldet: die Funktion hatte keinen einzigen
// Aufrufer im Produkt — nur Tests. „Ein Test ist kein Aufrufer" (`tools/modalgrenze.ts:8`), und
// ein Registereintrag wäre hier die schwächere Antwort gewesen: er hätte einen Baustein
// festgeschrieben, der nichts tut. Ein Prädikat, das nur seine eigenen Tests bedient, IST der
// Befund, gegen den jener Wächter gebaut ist.
//
// Wer den Code eines Fehlers wissen will, liest ihn: `sendError` (`services/app/src/http.ts:130`)
// und `alsFehler` (`gesamtanweisung-routes.ts`) tun genau das seit jeher, über das Feld `code` und
// ohne `instanceof`. Die Tests prüfen den Code jetzt ebenso direkt.
