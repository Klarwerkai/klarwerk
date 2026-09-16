// ================================================================================================
// JOB 1140 · D1 (Scheibe S1, Leseweg) — DIE KURATIERTE BEZIEHUNG, SICHER GELESEN.
// ================================================================================================
//
// WAS HIER ENTSTEHT UND WARUM AN DIESER STELLE. Die Roadmap-Kette zu JOB 1045 hat drei Kantenarten
// im Bestand vermessen und alle drei als Nebenprodukt anderer Zwecke verworfen: ein Konflikt sagt
// „diese beiden widersprechen sich", eine Überschneidung „diese beiden ähneln sich", eine
// Herkunftskante „das stammt aus jenem". Keine sagt „ein Mensch hat entschieden, dass diese beiden
// fachlich zusammengehören" (D1-Rückgabe §1.1, §1.4). Genau das ist die kuratierte Kante, und sie
// gehört an das Wissensobjekt — NICHT in `services/conflicts`, wo eine Kante bereits zwei andere
// Bedeutungen trägt (D1 §3.7, Doppelarbeitsfalle 1).
//
// ================================================================================================
// DIE EINE REGEL, DIE DIESE DATEI TRÄGT.
// ================================================================================================
//
// Wörtlich aus dem geschlossenen Vertrag (D2-Rückgabe §2.3): „Eine kuratierte Kante darf NICHT
// eigenständig sichtbar sein. Sonst entsteht genau das Existenzsignal, das der abgeleitete Graph
// heute strukturell vermeidet — die Kante würde den unsichtbaren Gegenknoten verraten."
//
// Der abgeleitete Graph vermeidet es STRUKTURELL: `library-analytics` bildet seine Kanten in einer
// Doppelschleife über die BEREITS gefilterte Grundmenge, ein unsichtbares Objekt kann dort gar kein
// Kantenende sein. Eine gespeicherte Kante hat diesen Schutz nicht geschenkt — sie kennt ihre
// Endpunkte als Kennungen und würde sie ohne Weiteres ausliefern. Deshalb trimmt dieser Dienst die
// Grundmenge VOR der Ausgabe, und `total` zählt DANACH.
//
// KEIN SCHNITTZÄHLER. Es gibt bewusst keine Zahl ausgefilterter Kanten und keine Quote. Beides wäre
// selbst die Existenzauskunft, die der Vertrag verbietet — derselbe Fehlertyp, den mega76 Block D
// im Bestand schon einmal gefunden und geschlossen hat („`total + 1` … verrieten die Existenz eines
// vertraulichen Objekts"). Die offene Ownerfrage O-3 steht auf „Empfehlung: nie".
//
// ================================================================================================
// REICHWEITE — WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT.
// ================================================================================================
//
// S1 ist ein LESEWEG. Es gibt hier keinen Setzen-, Ändern- oder Widerrufen-Weg und keine öffentliche
// Mutation. Die Kuratierung selbst ist Scheibe S4 und hängt an der Autorisierung `ko.relate`
// (controller/admin), die D3 §2.2 entschieden, aber nicht gebaut hat. Wer hier eine Schreibmethode
// ergänzt, baut S4 durch die Hintertür — ohne Recht, ohne Audit, ohne Urheberpflicht.
//
// Der Bestand hinter `KantenRepo` ist in diesem Durchgang absichtlich nur als Port und
// In-Memory-Fassung vorhanden. Das persistente Aggregat samt Postgres-Repo, Deduplizierung,
// Versionierung und transaktionsgebundener Endlöschung ist eine eigene Scheibe (JOB 1139); sie
// füllt genau diesen Port, statt ein zweites Modell daneben zu stellen.
import { beziehungsSchluessel, istSelbstbeziehung, kanonischesPaar } from "./kanten-paar";
import {
  type BeurteilterStand,
  KANTEN_ARTEN,
  KANTEN_RICHTUNGEN,
  type KantenArt,
  KantenError,
  type KantenRichtung,
  type KantenStatus,
  type KuratierteKante,
} from "./kanten-types";
import type { Confidentiality, KnowledgeObject, KoStatus } from "./types";

// ================================================================================================
// DAS AGGREGAT.
// ================================================================================================
//
// Feldbestand und Bedeutung stammen unverändert aus dem geschlossenen Vertrag (D2 §2.3). Sie sind
// hier NICHT neu erfunden, damit die Persistenzscheibe denselben Satz vorfindet.
//
// SEIT JOB 1495 D3 STEHEN SIE IN `kanten-types.ts` — unverändert, Feld für Feld. Der Grund ist
// technisch: `kanten-paar.ts` trägt die Kanonisierungsregel und braucht dieselben Typen; diese
// Datei importiert die Regel. Lägen die Typen weiterhin hier, wäre das ein Importzyklus (von
// `dependency-cruiser` beim ersten Versuch gemeldet).
//
// SIE WERDEN HIER WEITER EXPORTIERT. Jeder bestehende Importpfad bleibt gültig — insbesondere der
// des Vertragstests (`tests/ko/kanten-lesekette-sichtbarkeit.test.ts:25-29`). Es wird nichts
// weggenommen, nur ein zweiter, tieferer Ort geschaffen.
export type {
  BeurteilterStand,
  KantenArt,
  KantenRichtung,
  KantenStatus,
  KuratierteKante,
} from "./kanten-types";

// ================================================================================================
// DER BESTAND — ALS PORT.
// ================================================================================================

/**
 * Der Kantenbestand als Port.
 *
 * JOB 4151 HAT DIE SCHREIBSEITE ERGÄNZT — die Stelle, an der der Satz „Die Persistenzscheibe
 * (JOB 1139) implementiert diesen Port mit Postgres und ergänzt ihn um die Schreibseite"
 * eingelöst wird. `PgKantenRepo` (kanten-repo-pg.ts) und `DeduplizierenderKantenBestand`
 * (kanten-repo.ts) erfüllen ihn beide und werden gegen DENSELBEN Vertragstest gefahren
 * (`tests/wissensgraph-integration/bestandsvertrag.ts`); ein zweites Kantenmodell entsteht nicht.
 *
 * EINEN ÖFFENTLICHEN KURATIERUNGSWEG MACHT DIESER PORT NICHT AUF. `setze` ist ein Bestandsweg,
 * kein Recht — die Warnung aus dem Kopf dieser Datei gilt unverändert. Der Weg, über den ein
 * Mensch wirklich verknüpft, führt über `KantenSchreibService` (Urheberpflicht, Sichtbarkeit
 * BEIDER Endpunkte) und darüber über `ko.relate` an der Route.
 */
export interface KantenRepo {
  /** Alle Kanten, an denen `koId` als Quelle ODER als Ziel beteiligt ist — ungetrimmt. */
  fuerKo(koId: string): Promise<readonly KuratierteKante[]>;
  /**
   * Legt die Beziehung ab oder schreibt die vorhandene fort und gibt den GESPEICHERTEN Stand
   * zurück.
   *
   * Der Rückgabewert ist nicht dasselbe wie die Eingabe: bei einer Wiederholung gewinnen `id`,
   * `urheber` und `gesetztAm` der ERSTEN Setzung. Ein Aufrufer, der stattdessen seine eigene
   * Eingabe weiterreichte, gäbe eine Kennung heraus, die im Bestand gar nicht steht.
   *
   * `erwarteteVersion` ist die optimistische Sperre: sie wird IM Bestand geprüft, nicht davor.
   * Eine Prüfung im Dienst wäre ein Lesen-Prüfen-Schreiben mit einem Fenster dazwischen; hier
   * fällt sie mit dem Schreiben in denselben unteilbaren Schritt. Passt sie nicht, wirft der
   * Bestand `KantenError("CONFLICT")` und schreibt NICHTS.
   */
  setze(kante: KuratierteKante, opts?: { erwarteteVersion?: number }): Promise<KuratierteKante>;
  /**
   * DASSELBE SETZEN, ABER DER WIEDERHOLSCHLÜSSEL WIRD IM SELBEN UNTEILBAREN SCHRITT GEBUNDEN.
   *
   * WARUM ES DIESE ZWEITE METHODE GIBT (JOB 4151, BEN R3). Der Schreibdienst hat den Schlüssel
   * bis hierher SELBST nachgeschlagen und danach `setze` gerufen — zwei Schritte mit einem Fenster
   * dazwischen. BEN hat gemessen, was in dieses Fenster passt: zwei gleichzeitige Anfragen lesen
   * beide „Schlüssel unbekannt", und danach schreiben beide. Aus derselben Zusage („derselbe
   * Beitrag, nicht ein zweiter") wurden dann `version: 2` — oder, bei zwei VERSCHIEDENEN
   * Beziehungen unter EINEM Schlüssel, zwei Einträge. Ein Fenster schliesst man nicht mit einer
   * weiteren Prüfung davor; man schliesst es, indem Prüfung und Schreiben zusammenfallen. Genau
   * das ist diese Methode, und deshalb liegt sie im BESTAND und nicht im Dienst: nur der Bestand
   * hat das Mittel dafür (Postgres: eine Transaktion mit Unique-Schlüssel; Speicher: die Sperre).
   *
   * DIE DREI AUSGÄNGE sind dieselben wie beim sequentiellen Ablauf, und das ist ihr Massstab:
   *
   *   · `wiederholt` — der Schlüssel gehört bereits einer Beziehung, und es ist DIESELBE
   *     (kanonisches Paar, Art und Richtung stimmen überein). Es wird NICHTS geschrieben.
   *   · `fortgeschrieben` — die Beziehung gab es schon, dieser Beitrag ist neu.
   *   · `angelegt` — beides war neu.
   *
   * Und der vierte Ausgang ist kein Ergebnis, sondern eine Abweisung: gehört der Schlüssel einer
   * ANDEREN Beziehung, wirft der Bestand `KantenError("CONFLICT")` und schreibt nichts
   * (`pruefeSchluesselBindung` — dieselbe Prüfung in beiden Fassungen).
   */
  setzeMitBindung(kante: KuratierteKante, beitragSchluessel: string): Promise<KanteGesetzt>;
  /** Die Beziehung zu IHRER Kennung — oder `undefined`. Ungetrimmt, wie `fuerKo`. */
  hole(id: string): Promise<KuratierteKante | undefined>;
  /**
   * Die Beziehung, unter der dieser WIEDERHOLSCHLÜSSEL schon einmal gesetzt wurde — oder
   * `undefined`.
   *
   * Sie ist die ganze Idempotenzzusage: geht die Antwort verloren und der Client wiederholt
   * denselben Beitrag, findet der Schreibweg hier den bereits gespeicherten Stand und ändert
   * NICHTS. Ohne diesen Weg zählte jede Wiederholung die Version hoch und beurteilte neu — der
   * Client sähe dann eine Beziehung, die er einmal gesetzt hat, zweimal beurteilt.
   */
  holeNachBeitrag(beitragSchluessel: string): Promise<KuratierteKante | undefined>;
  /**
   * Alle Kanten MEHRERER Objekte in EINEM Zug — ungetrimmt, wie `fuerKo`.
   *
   * WARUM ES DIESE METHODE GIBT (API-Vertrag der Steuerung, HINWEIS 15.09. 17:30): das
   * Wissensnetz zeichnet den ganzen sichtbaren Bestand. Über `fuerKo` wäre das eine Abfrage JE
   * EINTRAG — bei einem Bestand in Betriebsgrösse eine Abfrage pro Knoten, nur um die Kanten zu
   * finden. Der Vertrag verbietet das ausdrücklich („Keine Einzelabfragen je Eintrag aus der UI").
   *
   * Jede Kante kommt HÖCHSTENS EINMAL zurück, auch wenn beide Endpunkte in `koIds` stehen.
   */
  fuerKos(koIds: readonly string[]): Promise<readonly KuratierteKante[]>;
  /**
   * Alle AKTIVEN Beziehungen des Bestands — ungetrimmt und ohne Sichtbarkeitsurteil.
   *
   * „Aktiv" ist hier KEIN Rechteurteil, sondern der Status am Aggregat: widerrufene Beziehungen
   * sind eine Urheberaussage über die Vergangenheit und gehören in keine Zeichnung des heutigen
   * Netzes. Das Trimmen nach Sichtbarkeit bleibt beim Aufrufer — ein Bestand, der selbst filtert,
   * wäre die zweite Rechteauslegung, gegen die dieses Modul gebaut ist.
   */
  alleAktiven(): Promise<readonly KuratierteKante[]>;
}

/**
 * Die EINE Entdopplung für `fuerKos`: dieselbe Kante, über beide Endpunkte gefunden, ist EINE.
 *
 * Sie steht hier und nicht zweimal in den Beständen, weil sonst der Speicherbestand und Postgres
 * verschieden oft dieselbe Kante lieferten — und ein Zähler darüber wäre dann je Ablage ein
 * anderer.
 */
export function entdoppelt(kanten: readonly KuratierteKante[]): readonly KuratierteKante[] {
  return [...new Map(kanten.map((k) => [k.id, k])).values()];
}

/**
 * Die Wiederholschlüssel der fortgeschriebenen Beziehung: die bisherigen PLUS die neuen.
 *
 * Auch diese Regel steht genau einmal, aus demselben Grund wie `entdoppelt`: liefe sie in den
 * beiden Beständen auseinander, wäre die Idempotenz je Ablage eine andere Zusage. Die Reihenfolge
 * ist die Setzreihenfolge (ältester zuerst) und stabil — zwei Läufe ergeben dieselbe Liste.
 */
export function vereinigeSchluessel(
  vorhanden: KuratierteKante,
  neu: KuratierteKante,
): readonly string[] {
  return [...new Set([...(vorhanden.beitragSchluessel ?? []), ...(neu.beitragSchluessel ?? [])])];
}

/**
 * Die Kante MIT diesem Wiederholschlüssel in ihrer Liste — der Schlüssel als Parameter ist die
 * Wahrheit, nicht das Feld am übergebenen Aggregat.
 *
 * Warum überhaupt zwei Orte für dieselbe Angabe: `setzeMitBindung` bekommt den Schlüssel
 * ausdrücklich, weil er BINDEND ist und nicht bloss mitreist. Dass er danach auch im Aggregat
 * steht, ist kein zweiter Wille, sondern die Ablage desselben — diese Funktion stellt sicher, dass
 * beide nie auseinandergehen, statt sich auf einen Aufrufer zu verlassen, der beides gleich füllt.
 */
export function mitBeitragSchluessel(
  kante: KuratierteKante,
  beitragSchluessel: string,
): KuratierteKante {
  return {
    ...kante,
    beitragSchluessel: [...new Set([...(kante.beitragSchluessel ?? []), beitragSchluessel])],
  };
}

/**
 * Die EINE Meldung der Selbstbeziehung. Sie steht als Konstante, weil beide Bestände und der
 * Schreibdienst sie tragen — drei abgeschriebene Sätze wären drei Gelegenheiten, dass derselbe
 * Vorgang je nach Weg anders klingt.
 */
export const SELBSTBEZIEHUNG_MELDUNG =
  "Eine Beziehung braucht zwei Enden: ein Wissenseintrag kann nicht auf sich selbst zeigen.";

/**
 * Die EINE Auslegung der optimistischen Sperre — geteilt von beiden Beständen.
 *
 * `undefined` heisst „ich prüfe nicht" und ist der Normalfall des Setzens: wer eine Beziehung
 * ERSTMALS behauptet, kennt keine Vorversion. Ein Wert heisst „ich habe DIESEN Stand gesehen";
 * trifft er nicht, wird abgewiesen, statt still zu überschreiben. Ein fehlender Eintrag zählt als
 * Version 0 — so ist auch „ich glaubte, es gäbe schon eine" eine Abweisung und kein stiller Neubau.
 */
export function pruefeErwarteteVersion(
  vorhanden: KuratierteKante | undefined,
  erwarteteVersion: number | undefined,
): void {
  if (erwarteteVersion === undefined) {
    return;
  }
  if ((vorhanden?.version ?? 0) !== erwarteteVersion) {
    throw new KantenError(
      "CONFLICT",
      "Diese Beziehung wurde inzwischen geändert. Bitte den aktuellen Stand laden und erneut entscheiden.",
    );
  }
}

/**
 * GEHÖRT DER GEFUNDENE WIEDERHOLSCHLÜSSEL WIRKLICH ZU DIESER BEZIEHUNG?
 *
 * Sie steht hier und nicht in den Beständen, aus demselben Grund wie `pruefeErwarteteVersion`:
 * liefe sie in beiden Fassungen auseinander, wäre die Bindung des Schlüssels je Ablage eine andere
 * Zusage — und ausgerechnet der Fall, den sie abwehrt, tritt selten und dann folgenschwer auf.
 *
 * WAS SIE ABWEHRT (BEN R2, Korrekturpflicht 2): Ein Client, der denselben Schlüssel an zwei
 * verschiedene Beiträge hängt, bekäme sonst die FREMDE Beziehung als Antwort — einschliesslich
 * ihrer Endpunkte, die er vielleicht gar nicht sehen darf. Autorisiert wurden die ANGEFRAGTEN
 * Endpunkte; nur wenn beide Tupel übereinstimmen, sind das dieselben.
 *
 * DIE RICHTUNG IST MITGEPRÜFT, weil `ungerichtet` und `symmetrisch` denselben Beziehungsschlüssel
 * ergeben (`kanten-paar.ts`) und trotzdem verschiedene Aussagen sind.
 */
export function pruefeSchluesselBindung(
  gefunden: KuratierteKante,
  angefragt: { quelleId: string; zielId: string; art: KantenArt; richtung: KantenRichtung },
): void {
  if (
    beziehungsSchluessel(gefunden) !== beziehungsSchluessel(angefragt) ||
    gefunden.richtung !== angefragt.richtung
  ) {
    throw new KantenError("CONFLICT", SCHLUESSEL_FREMD_MELDUNG);
  }
}

/**
 * DIE SERIALISIERUNG FÜR BESTÄNDE IM SPEICHER — das, was Postgres die Transaktion ist.
 *
 * WARUM SIE NÖTIG IST, OBWOHL JAVASCRIPT EINEN FADEN HAT. Ein einzelner Faden schützt nur das,
 * was zwischen zwei `await` liegt. `setzeMitBindung` muss aber nachschlagen UND schreiben, und
 * beides sind Methoden des Ports, also `Promise`. Ohne diese Sperre gäbe `Promise.all([a, b])`
 * dem zweiten Lauf genau an der Stelle das Wort, an der der erste seinen Schlüssel geprüft, aber
 * noch nicht abgelegt hat — derselbe Wettlauf wie in einer Datenbank, nur billiger herzustellen.
 *
 * SIE IST EINE KETTE UND KEIN ZÄHLER: jeder Vorgang hängt sich an den vorherigen, auch wenn der
 * gescheitert ist (`catch`), sonst bliebe die Sperre nach der ersten Abweisung für immer zu.
 * Fairness ist die Reihenfolge des Eintreffens; etwas anderes braucht ein Prüfstand nicht.
 */
export class Schreibsperre {
  /** Trägt NUR die Reihenfolge, nie einen Fehler — s. das `catch` unten. */
  private kette: Promise<unknown> = Promise.resolve();

  async fuehre<T>(arbeit: () => Promise<T>): Promise<T> {
    const lauf = this.kette.then(arbeit);
    // Das `catch` ist die ganze Robustheit dieser Klasse: ohne es reichte EINE Abweisung, und
    // jeder folgende Vorgang bekäme den Fehler des fremden Vorgängers statt an die Reihe zu kommen.
    this.kette = lauf.catch(() => undefined);
    return lauf;
  }
}

/**
 * Die In-Memory-Fassung. Sie ist der Prüfstand dieses Durchgangs, nicht die Produktionsablage:
 * `setze` befüllt den Bestand für Tests und Entwicklungsbetrieb und ist ausdrücklich KEIN
 * öffentlicher Kuratierungsweg — der entsteht erst mit S4 hinter `ko.relate`.
 */
export class InMemoryKantenRepo implements KantenRepo {
  private readonly kanten = new Map<string, KuratierteKante>();
  private readonly sperre = new Schreibsperre();

  // H3 (JOB 1495 D3): Die Zusage aus `KantenRichtung` oben — „ihr Endpunktpaar wird kanonisch
  // abgelegt" — wird hier eingelöst. Sie stand seit dem ersten Entwurf im Kommentar; die
  // Persistenzscheibe, die sie tragen sollte (JOB 1139), ist verloren. Bis sie neu entsteht, legt
  // sonst NIEMAND kanonisch ab, und „A ergänzt B" wäre ein anderer Eintrag als „B ergänzt A".
  //
  // Gerichtete Kanten bleiben unberührt: bei ihnen IST die Reihenfolge die Aussage.
  async setze(
    kante: KuratierteKante,
    opts: { erwarteteVersion?: number } = {},
  ): Promise<KuratierteKante> {
    return this.sperre.fuehre(async () => this.lege(kante, opts));
  }

  /**
   * JOB 4151 (BEN R3) — Schlüsselbindung und Ablage in EINEM Schritt.
   *
   * Der ganze Rumpf unter der Sperre ist SYNCHRON: kein `await` zwischen Nachschlag und Ablage.
   * Das ist die Entsprechung zur Transaktion des Postgres-Bestands, und es ist die Bedingung dafür,
   * dass `setzeMitBindung` hält, was der Port zusagt.
   */
  async setzeMitBindung(kante: KuratierteKante, beitragSchluessel: string): Promise<KanteGesetzt> {
    return this.sperre.fuehre(async () => {
      const gebunden = this.findeNachBeitrag(beitragSchluessel);
      if (gebunden) {
        pruefeSchluesselBindung(gebunden, kante);
        return { kante: gebunden, ergebnis: "wiederholt" as const };
      }
      const abgelegt = this.lege(mitBeitragSchluessel(kante, beitragSchluessel), {});
      return { kante: abgelegt, ergebnis: "angelegt" as const };
    });
  }

  /** Der Rumpf des Setzens, synchron und OHNE Sperre — nur von dieser Klasse gerufen. */
  private lege(kante: KuratierteKante, opts: { erwarteteVersion?: number }): KuratierteKante {
    // JOB 1543 D1 (SCRUM-546): dieselbe Schranke wie im `DeduplizierenderKantenBestand`. Zwei
    // Bestände, die eine Beziehung verschieden streng annehmen, wären genau die zweite Wahrheit,
    // gegen die dieses Modul gebaut ist.
    // JOB 4151: derselbe Wurf, jetzt mit Code — siehe `KantenError` (kanten-types.ts).
    if (istSelbstbeziehung(kante)) {
      throw new KantenError("VALIDATION", SELBSTBEZIEHUNG_MELDUNG);
    }
    pruefeErwarteteVersion(this.kanten.get(kante.id), opts.erwarteteVersion);
    const abgelegt = { ...kanonischesPaar(kante) };
    this.kanten.set(kante.id, abgelegt);
    return abgelegt;
  }

  private findeNachBeitrag(beitragSchluessel: string): KuratierteKante | undefined {
    return [...this.kanten.values()].find((k) =>
      (k.beitragSchluessel ?? []).includes(beitragSchluessel),
    );
  }

  async hole(id: string): Promise<KuratierteKante | undefined> {
    return this.kanten.get(id);
  }

  async holeNachBeitrag(beitragSchluessel: string): Promise<KuratierteKante | undefined> {
    return this.findeNachBeitrag(beitragSchluessel);
  }

  async fuerKo(koId: string): Promise<readonly KuratierteKante[]> {
    return [...this.kanten.values()].filter((k) => k.quelleId === koId || k.zielId === koId);
  }

  async fuerKos(koIds: readonly string[]): Promise<readonly KuratierteKante[]> {
    const menge = new Set(koIds);
    return entdoppelt(
      [...this.kanten.values()].filter((k) => menge.has(k.quelleId) || menge.has(k.zielId)),
    );
  }

  async alleAktiven(): Promise<readonly KuratierteKante[]> {
    return [...this.kanten.values()].filter((k) => k.status === "aktiv");
  }
}

// ================================================================================================
// DIE SICHTBARKEITSENTSCHEIDUNG — ALS DATUM, NICHT ALS ZWEITE AUSLEGUNG.
// ================================================================================================
//
// Dieser Dienst beantwortet NICHT, wer was sehen darf. Er bekommt die fertige Entscheidung
// übergeben — dasselbe Muster, mit dem `library-analytics` seit mega74 arbeitet und aus demselben
// Grund: die Frage verbindet Rolle, Rechtematrix und Stufe am Objekt, und sie wird an genau EINER
// Stelle beantwortet (`services/app/src/sichtbarkeit.ts`). Ein Import von dort wäre hier zudem ein
// Modulgrenzenbruch; ein eigenes Prädikat wäre die zweite Wahrheit, gegen die jene Datei gebaut ist.

/** Die Mindestform, an der die Sichtbarkeitsfrage hängt — strukturgleich zu `SichtbarkeitsFakten`. */
export interface KantenSichtbarkeitsFakten {
  confidentiality?: Confidentiality | null | undefined;
  author?: string | null | undefined;
}

export type KantenSichtbar = (ko: KantenSichtbarkeitsFakten) => boolean;

/**
 * FAIL-CLOSED, wörtlich wie im Bestand (`library-analytics/src/service.ts:83-87`): ohne
 * übergebene Entscheidung ist NICHTS sichtbar — nicht „alles". Das ist die Beweislastumkehr, ohne
 * die eine vergessene Injektion in der Kompositionswurzel den gesamten Bestand ausliefern würde.
 */
function erzwingeSichtbar(sichtbar: KantenSichtbar | undefined): KantenSichtbar {
  return typeof sichtbar === "function" ? sichtbar : () => false;
}

// ================================================================================================
// DIE AUSKUNFT.
// ================================================================================================

/** Der aufgelöste Gegenendpunkt. Nur, was die Detailseite zum Anzeigen und Verlinken braucht. */
export interface KantenGegenstueck {
  id: string;
  title: string;
  status: KoStatus;
}

/**
 * JOB 4151 (G6) — WIE WEIT DIE BEURTEILUNG HEUTE NOCH TRÄGT.
 *
 * DIE VERWECHSLUNG, GEGEN DIE DIESE DREI FELDER STEHEN: `KuratierteKante.version` zählt Setzungen
 * der BEZIEHUNG. Eine Fläche, die daraus „fachlich geprüft, Stand aktuell" macht, behauptet etwas,
 * das niemand gemessen hat — die Endpunkte können sich seither beliebig oft geändert haben.
 *
 * DIE DREI WERTE SIND ABSCHLIESSEND, und es gibt keinen weicheren vierten:
 *
 *   · `unveraendert` — beide beurteilten Fassungen sind bekannt UND stimmen mit den heutigen.
 *   · `geaendert`    — mindestens eine hat sich bewegt.
 *   · `unbekannt`    — es gibt keine Beurteilung (Altbestand). „Wahrscheinlich noch gültig" wäre
 *                      eine Behauptung ohne Messung, und der Vertrag verbietet ausdrücklich,
 *                      `beurteilt` rückwirkend mit der heutigen Version aufzufüllen.
 *
 * DIE ZAHLEN SIND KEINE EXISTENZAUSKUNFT: sie betreffen ausschliesslich Objekte, die dieser
 * Aufrufer ohnehin sehen darf — eine getrimmte Kante erreicht diese Stelle gar nicht (`alsAnsicht`).
 */
export type KantenAbweichung = "unveraendert" | "geaendert" | "unbekannt";

/**
 * Die heutigen Fassungsnummern beider Endpunkte, in der Orientierung DER KANTE.
 *
 * BEIDE SIND IMMER DA, und das ist seit JOB 4151 (BEN R2) keine Hoffnung, sondern eine Folge: eine
 * Ansicht entsteht nur, wenn BEIDE Endpunkte aufgelöst UND sichtbar sind — das Gegenstück in
 * `alsAnsicht`, das angefragte Objekt in `kantenFuer`. Ein `null` hätte hier nur der Fall
 * „angefragtes Objekt nicht auflösbar" erzeugt, und der liefert jetzt gar keine Kante mehr.
 */
export interface KantenAktuell {
  quelleVersion: number;
  zielVersion: number;
}

export interface KuratierteKanteAnsicht {
  id: string;
  art: KantenArt;
  richtung: KantenRichtung;
  /**
   * Die Rolle des ANGEFRAGTEN Objekts in dieser Kante. Nur bei `gerichtet` gesetzt — bei einer
   * ungerichteten Beziehung gäbe es keine Aussage, und ein erfundenes „quelle" wäre eine.
   */
  rolle?: "quelle" | "ziel";
  gegenstueck: KantenGegenstueck;
  /** Der Mensch, der die Beziehung gesetzt hat — die Detailseite nennt ihn ausdrücklich. */
  urheber: string;
  gesetztAm: string;
  /**
   * IM LESEWEG immer `"aktiv"`: `alsAnsicht` führt widerrufene Beziehungen gar nicht.
   *
   * IM SCHREIBWEG kann `"widerrufen"` stehen (JOB 4151 R6, `ansichtNachSchreiben`) — und genau
   * dafür ist dieses Feld da. Der Vertrag verlangt für `POST …/widerruf` eine `200` mit
   * `status: "widerrufen"`, und die Fläche entscheidet daran, ob sie „Widerrufen" melden darf oder
   * ob der Vorgang ohne Wirkung blieb. Ein Feld, das nur einen Wert annehmen kann, wäre hier eine
   * Erfolgsmeldung in Typform.
   */
  status: KantenStatus;
  /**
   * WANN ZULETZT ETWAS AN DIESER BEZIEHUNG GESCHAH — belegt nur in der Antwort des SCHREIBWEGS.
   *
   * Optional und nicht geraten: der Leseweg gibt es nicht aus (er zeigt nur aktive Beziehungen,
   * und für die ist `gesetztAm` die Aussage, die zählt). Nach einem Widerruf ist es der Zeitpunkt
   * der Rücknahme — der Vertrag nennt es dort ausdrücklich. Ein zweites Zeitfeld für den Widerruf
   * gibt es bewusst nicht.
   */
  geaendertAm?: string;
  /**
   * WER ZURÜCKGENOMMEN HAT — nur zusammen mit `status: "widerrufen"` belegt, sonst `null`/fehlend.
   *
   * `urheber` oben bleibt daneben stehen und ist eine ANDERE Aussage: wer die Beziehung erfunden
   * hat. Eine Fläche, die nur einen der beiden Namen zeigt, nennt den Falschen — deshalb stehen
   * beide im Vertrag und nicht einer, der je nach Status etwas anderes bedeutet.
   */
  widerrufenVon?: string | null;
  /**
   * JOB 4151 (G6): Die Beziehungsversion — als WAS SIE IST, nämlich der Zählstand der Setzungen.
   * Sie steht hier, weil der Schreibweg sie als erwartete Version zurückverlangt (optimistische
   * Sperre); sie ist ausdrücklich KEINE Aussage über den Inhalt. Die steht in `abweichung`.
   */
  version: number;
  /**
   * Woher diese Kante kommt. Heute gibt es genau einen Wert — und genau deshalb steht er da: das
   * Wissensnetz zeichnet daneben ABGELEITETE Kanten (geteilte Schlagwörter), und die beiden
   * dürfen in keiner Zeichnung und in keinem Zähler verschmelzen.
   */
  herkunft: "kuratiert";
  /** Der beurteilte Stand — `null`, wenn keiner festgehalten wurde. Nie rückwirkend aufgefüllt. */
  beurteilt: BeurteilterStand | null;
  aktuell: KantenAktuell;
  abweichung: KantenAbweichung;
}

export interface KuratierteKanten {
  koId: string;
  kanten: KuratierteKanteAnsicht[];
  /** Zählt NACH dem Trimm. Es gibt keine zweite Zahl, aus der sich der Trimm errechnen ließe. */
  total: number;
}

/** Die Leseseite des KO-Bestands, die dieser Dienst braucht — erfüllt von `KoService`. */
export interface KantenKoLeser {
  get(id: string): Promise<KnowledgeObject | undefined>;
}

export interface KantenLeseServiceDeps {
  repo: KantenRepo;
  kos: KantenKoLeser;
}

/**
 * Löst den Gegenendpunkt einer Kante auf und entscheidet in EINEM Schritt, ob sie ausgegeben werden
 * darf. `undefined` heißt: diese Kante existiert für den Aufrufer nicht — und zwar aus jedem der
 * drei Gründe ununterscheidbar. Genau diese Ununterscheidbarkeit ist die Zusage:
 *
 *   · widerrufen             → ein Mensch hat sie zurückgenommen,
 *   · Endpunkt unauflösbar   → endgültig gelöscht oder im Papierkorb (`KoService.get` liefert für
 *                              getrashte Objekte bereits `undefined` — kein zweiter Papierkorbtest),
 *   · Endpunkt unsichtbar    → die Rechteentscheidung sagt nein.
 *
 * Ein unterscheidbarer Fehler je Grund wäre selbst die Auskunft, die hier verhindert wird.
 */
async function alsAnsicht(
  kante: KuratierteKante,
  koId: string,
  deps: KantenLeseServiceDeps,
  sichtbar: KantenSichtbar,
  eigeneFassung: number,
): Promise<KuratierteKanteAnsicht | undefined> {
  if (kante.status !== "aktiv") {
    return undefined;
  }
  // JOB 1543 D1 (SCRUM-546), VIERTER GRUND: eine Kante auf sich selbst hat kein Gegenstück. Ohne
  // diese Zeile liefert die Ableitung unten das ANGEFRAGTE Objekt als seinen eigenen Nachbarn, und
  // `total` zählt ihn mit. Der Bestand weist solche Kanten seit demselben Durchgang schon am
  // Eingang ab (`kanten-repo.ts`); diese Schranke gilt Beständen, die vor der Regel gefüllt wurden
  // — die Persistenzscheibe (JOB 1139) ist noch nicht gebaut, ihre Altdaten kennt heute niemand.
  if (istSelbstbeziehung(kante)) {
    return undefined;
  }
  const gegenId = kante.quelleId === koId ? kante.zielId : kante.quelleId;
  const gegen = await deps.kos.get(gegenId);
  if (!gegen || !sichtbar(gegen)) {
    return undefined;
  }
  // exactOptionalPropertyTypes: `rolle` wird nur gesetzt, wenn es eine Aussage GIBT.
  const rolle =
    kante.richtung === "gerichtet" ? (kante.quelleId === koId ? "quelle" : "ziel") : undefined;
  const aktuell = aktuellVon(kante, koId, eigeneFassung, gegen.version);
  return {
    id: kante.id,
    art: kante.art,
    richtung: kante.richtung,
    ...(rolle ? { rolle } : {}),
    gegenstueck: { id: gegen.id, title: gegen.title, status: gegen.status },
    urheber: kante.urheber,
    gesetztAm: kante.gesetztAm,
    status: kante.status,
    version: kante.version,
    herkunft: "kuratiert",
    beurteilt: kante.beurteilt ?? null,
    aktuell,
    abweichung: abweichungVon(kante.beurteilt ?? null, aktuell),
  };
}

/**
 * Die heutigen Fassungen in der Orientierung DER KANTE.
 *
 * Der Lesedienst kennt zwei Objekte: das ANGEFRAGTE und das Gegenstück. Welches davon Quelle und
 * welches Ziel ist, sagt die Kante — nicht die Anfrage. Wer das verwechselt, liefert für dieselbe
 * Beziehung von den zwei Seiten gelesen zwei verschiedene Auskünfte.
 */
function aktuellVon(
  kante: KuratierteKante,
  koId: string,
  eigeneFassung: number,
  gegenFassung: number,
): KantenAktuell {
  return kante.quelleId === koId
    ? { quelleVersion: eigeneFassung, zielVersion: gegenFassung }
    : { quelleVersion: gegenFassung, zielVersion: eigeneFassung };
}

/**
 * Die EINE Stelle, an der „gilt die Beurteilung noch?" beantwortet wird. Eine zweite Auslegung an
 * der Fläche wäre genau der Weg, auf dem aus „unbekannt" ein freundliches „vermutlich in Ordnung"
 * würde.
 *
 * FAIL-CLOSED: ohne Beurteilung `unbekannt`. „Unveraendert" wird nur behauptet, wenn beide Paare
 * wirklich vorliegen und wirklich gleich sind.
 *
 * JOB 4151 (BEN R2): Der zweite Zweig — „eine HEUTIGE Fassung fehlt" — ist ERSATZLOS entfallen und
 * nicht etwa unbemerkt verschwunden. Er war seit dem Sichtbarkeitstor in `kantenFuer` unerreichbar:
 * eine Kante erreicht diese Stelle nur, wenn BEIDE Endpunkte aufgelöst sind. Ein toter Zweig, der
 * aussieht wie ein Schutz, ist schlechter als keiner — er lädt dazu ein, sich auf ihn zu verlassen.
 */
function abweichungVon(
  beurteilt: BeurteilterStand | null,
  aktuell: KantenAktuell,
): KantenAbweichung {
  if (!beurteilt) {
    return "unbekannt";
  }
  return beurteilt.quelleVersion === aktuell.quelleVersion &&
    beurteilt.zielVersion === aktuell.zielVersion
    ? "unveraendert"
    : "geaendert";
}

/**
 * Der Lesedienst der kuratierten Beziehungen.
 *
 * Die Fläche ist absichtlich eine einzige Methode. Das ist keine Sparsamkeit, sondern die Zusage
 * aus Lieferung 4 in ausführbarer Form: solange hier nur gelesen wird, kann kein Automat und keine
 * Route versehentlich eine kuratierte Kante setzen. `tests/ko/kanten-lesekette-sichtbarkeit.test.ts`
 * hält diese Fläche fest und wird rot, sobald eine zweite Methode hinzukommt.
 */
export class KantenLeseService {
  constructor(private readonly deps: KantenLeseServiceDeps) {}

  async kantenFuer(koId: string, opts: { sichtbar?: KantenSichtbar }): Promise<KuratierteKanten> {
    const sichtbar = erzwingeSichtbar(opts.sichtbar);
    // ==========================================================================================
    // JOB 4151 (BEN R2, Korrekturpflicht 1) — DER AUSGANGSPUNKT WIRD GEPRÜFT, NICHT NUR DAS ZIEL.
    // ==========================================================================================
    //
    // WAS HIER FALSCH WAR, und es war eine Offenlegung: Geprüft wurde bis hierher ausschliesslich
    // das GEGENSTÜCK (`alsAnsicht`). Das angefragte Objekt wurde nur gelesen, um seine Fassung zu
    // erfahren — ohne ein einziges Sichtbarkeitsurteil. Wer die Kennung eines VERTRAULICHEN
    // Eintrags kannte, bekam über diese Tür seine Beziehungen, `total`, Fassungsnummern und
    // Zeitpunkte, obwohl er den Eintrag selbst nicht öffnen darf. Gemessen von BEN an einem
    // fremden Experten: `total: 1` samt Fassungsdaten des vertraulichen Eintrags.
    //
    // WARUM DIE ANTWORT EIN LEERES ERGEBNIS IST UND KEIN FEHLER: Ein eigener Fehler wäre selbst die
    // Existenzauskunft, die der Kopf dieser Datei verbietet — er unterschiede „gibt es, darfst du
    // nicht" von „gibt es nicht". Ein Objekt, das dieser Mensch nicht erreicht, hat für ihn keine
    // Beziehungen, und zwar aus jedem Grund ununterscheidbar: unbekannt, Papierkorb, gelöscht,
    // unsichtbar. Genau diese Lesart steht als Zusage am Client-Typ (`apps/web/src/api/types.ts`):
    // `total: 0` heisst „keine SICHTBARE Beziehung", nie „keine Beziehung".
    const eigenes = await this.deps.kos.get(koId);
    if (!eigenes || !sichtbar(eigenes)) {
      return { koId, kanten: [], total: 0 };
    }
    const roh = await this.deps.repo.fuerKo(koId);
    // JOB 4151 (G6): EIN Abruf des angefragten Objekts für die ganze Auskunft, nicht einer je
    // Kante. Er ist die zweite Hälfte des Inhaltsbezugs — ohne ihn liesse sich nur sagen, ob sich
    // das GEGENSTÜCK geändert hat, und eine Änderung an der eigenen Seite fiele durch. Die Kosten
    // sind ehrlich benannt: `netzQualitaet` zahlt sie einmal je Objekt der Grundmenge.
    const eigeneFassung = eigenes.version;
    const ansichten: KuratierteKanteAnsicht[] = [];
    for (const kante of roh) {
      const ansicht = await alsAnsicht(kante, koId, this.deps, sichtbar, eigeneFassung);
      if (ansicht) {
        ansichten.push(ansicht);
      }
    }
    // Deterministische Reihenfolge: älteste Beziehung zuerst, Kennung als Stichentscheid. Ohne sie
    // wäre jede Anzeige und jeder Vergleichstest von der Ablagereihenfolge abhängig.
    ansichten.sort((a, b) => a.gesetztAm.localeCompare(b.gesetztAm) || a.id.localeCompare(b.id));
    return { koId, kanten: ansichten, total: ansichten.length };
  }
}

/**
 * ================================================================================================
 * JOB 4151 (R6) — DIE ANTWORT DES SCHREIBWEGS HAT DIESELBE FORM WIE DIE DES LESEWEGS.
 * ================================================================================================
 *
 * WAS HIER FALSCH WAR, und es war beim Einbau sichtbar geworden, nicht vorher: Die Schreibwege
 * (`POST …/beziehungen`, `POST …/widerruf`) gaben das AGGREGAT zurück (`KuratierteKante`:
 * `quelleId`/`zielId`, kein `gegenstueck`). Die Anzeige aus JOB 4153 (WG-ANZEIGE) liest von der
 * Antwort aber `antwort.gegenstueck.id`, um zu prüfen, ob die Antwort der eigene Auftrag ist
 * (`WissensbeziehungenBereich.tsx`, `antwortPasstZumAuftrag`). Am echten Draht wäre das
 * `undefined.id` gewesen — ein Fehler genau im Erfolgsfall. Aufgefallen ist es nicht, weil die
 * Prüfungen dort gegen eine Attrappe laufen, die ein `gegenstueck` mitliefert
 * (`tests/wissensgraph-anzeige/bestand.ts:225`): grün gegen eine Form, die der Server nie sendete.
 *
 * WARUM NICHT `alsAnsicht` WIEDERVERWENDET, sondern diese Funktion daneben: `alsAnsicht` ist der
 * LESEWEG und trimmt deshalb alles weg, was der Abrufende nicht sehen darf — darunter jede nicht
 * aktive Kante (`kante.status !== "aktiv"` → `undefined`). Genau die braucht der Widerruf aber
 * zurück: der Vertrag verlangt `200` mit `status: "widerrufen"`, und die Fläche prüft daran, ob der
 * Widerruf wirklich geschehen ist. Ein Leseweg, der sie ausgibt, wäre die Existenzauskunft, gegen
 * die dieses Modul gebaut ist; ein Schreibweg, der sie verschweigt, wäre eine Erfolgsmeldung ohne
 * Deckung. Zwei Fragen, zwei Funktionen — die gemeinsamen Teile (`aktuellVon`, `abweichungVon`,
 * die Form des Gegenstücks) stehen trotzdem nur EINMAL und werden hier gerufen.
 *
 * DIE SICHTBARKEIT IST HIER BEREITS ENTSCHIEDEN. Diese Funktion läuft ausschliesslich NACH einem
 * erfolgreichen Schreibvorgang, und der hat BEIDE Endpunkte durch `erreichbar` geschickt
 * (`KantenSchreibService.setze`/`.widerrufe`). Sie prüft die Rechte deshalb nicht ein zweites Mal —
 * sie könnte es auch nicht besser. Findet sie einen Endpunkt trotzdem nicht mehr, ERFINDET sie
 * nichts, sondern wirft dieselbe Abweisung wie der Schreibweg: zwischen Schreiben und Antworten
 * kann ein anderer Mensch den Eintrag in den Papierkorb gelegt haben, und dann ist die ehrliche
 * Antwort „steht nicht zur Verfügung" und keine halbe Kante.
 */
export async function ansichtNachSchreiben(
  kante: KuratierteKante,
  koId: string,
  deps: KantenLeseServiceDeps,
): Promise<KuratierteKanteAnsicht> {
  const eigenes = await deps.kos.get(koId);
  const gegenId = kante.quelleId === koId ? kante.zielId : kante.quelleId;
  const gegen = await deps.kos.get(gegenId);
  if (!eigenes || !gegen) {
    throw new KantenError("FORBIDDEN", ENDPUNKT_UNERREICHBAR_MELDUNG);
  }
  // exactOptionalPropertyTypes: `rolle` wird nur gesetzt, wenn es eine Aussage GIBT — dieselbe
  // Regel wie im Leseweg, und aus demselben Grund: ein erfundenes „quelle" an einer ungerichteten
  // Beziehung wäre eine Richtungsaussage, die niemand getroffen hat.
  const rolle =
    kante.richtung === "gerichtet" ? (kante.quelleId === koId ? "quelle" : "ziel") : undefined;
  const aktuell = aktuellVon(kante, koId, eigenes.version, gegen.version);
  return {
    id: kante.id,
    art: kante.art,
    richtung: kante.richtung,
    ...(rolle ? { rolle } : {}),
    gegenstueck: { id: gegen.id, title: gegen.title, status: gegen.status },
    urheber: kante.urheber,
    gesetztAm: kante.gesetztAm,
    // DER STATUS KOMMT UNVERÄNDERT DURCH — auch `widerrufen`. Er ist die Frage, die die Fläche nach
    // einem Widerruf stellt; ein hier auf „aktiv" geglätteter Wert wäre die Erfolgsmeldung für
    // einen Vorgang, der nicht stattgefunden hat.
    status: kante.status,
    geaendertAm: kante.geaendertAm,
    // `null` bleibt `null`: „nicht widerrufen" ist eine eigene Tatsache und kein leerer Name.
    widerrufenVon: kante.widerrufenVon ?? null,
    version: kante.version,
    herkunft: "kuratiert",
    beurteilt: kante.beurteilt ?? null,
    aktuell,
    abweichung: abweichungVon(kante.beurteilt ?? null, aktuell),
  };
}

// ================================================================================================
// JOB 4151 · S4 — DER KURATIERUNGSWEG. EIGENER DIENST, WEIL DIE ZUSAGE DES LESEDIENSTES GILT.
// ================================================================================================
//
// WARUM EIN ZWEITER DIENST UND KEINE ZWEITE METHODE AM ERSTEN. `KantenLeseService` sagt zu, GENAU
// EINE Methode zu tragen (der Block darüber, wörtlich); `tests/ko/kanten-lesekette-sichtbarkeit.test.ts:252`
// hält das fest und bleibt unverändert grün. Diese Zusage ist nicht Sparsamkeit, sondern die
// ausführbare Form von „solange hier nur gelesen wird, kann kein Automat und keine Route
// versehentlich eine kuratierte Kante setzen". Eine Schreibmethode dort hätte sie aufgelöst.
//
// WAS DIESER DIENST ZUSÄTZLICH ZUM BESTAND LEISTET — und was der Bestand deshalb NICHT tut:
//
//   1. URHEBERPFLICHT. Der Urheber ist ein Mensch (`kanten-types.ts:45`) und kommt vom Aufrufer,
//      nie aus der Nutzlast. Die Route setzt ihn aus der Sitzung; dieser Dienst nimmt ihn als
//      Pflichtfeld entgegen und erfindet keinen Vorgabewert.
//   2. SICHTBARKEIT BEIDER ENDPUNKTE, VOR dem Schreiben. Wer ein Objekt nicht sehen darf, darf es
//      auch nicht verknüpfen — sonst wäre die Beziehung selbst die Existenzauskunft, die
//      `kanten-service.ts:17-30` verbietet. Es ist DIESELBE Entscheidung wie beim Lesen, als DATUM
//      übergeben (der Block „DIE SICHTBARKEITSENTSCHEIDUNG" oben), nicht eine zweite Auslegung.
//   3. DER BEURTEILTE INHALTSSTAND. Beim Setzen wird festgehalten, WELCHE Fassung beider Endpunkte
//      der Mensch vor sich hatte (G6). Ohne diesen Schritt gäbe es keine Tatsache, an der später
//      „gilt das noch?" hinge — und die Fläche müsste raten.
//
// WAS ER AUSDRÜCKLICH NICHT TUT: Er entscheidet NICHT, wer kuratieren darf. Das Recht `ko.relate`
// prüft die Route (`services/app/src/routes/kanten-routes.ts`) über dasselbe Tor wie jedes andere
// Recht. Ein zweites Rechteurteil hier wäre die zweite Wahrheit, gegen die `rbac` gebaut ist.
// Und er löst nichts aus: kein Freigabealgorithmus, keine Widerspruchsableitung, keine Bewertung.

/**
 * DIE EINE MELDUNG FÜR EINEN ENDPUNKT, DEN DIESER MENSCH NICHT ERREICHT.
 *
 * Sie deckt vier Gründe ununterscheidbar ab: die Kennung gibt es nicht, das Objekt liegt im
 * Papierkorb, es ist endgültig gelöscht, oder die Sichtbarkeitsentscheidung sagt nein. Kein Titel,
 * keine Kennung, keine Zahl — genau das schreibt der API-Vertrag der Steuerung vor.
 */
const ENDPUNKT_UNERREICHBAR_MELDUNG =
  "Dieser Wissenseintrag steht für eine Verknüpfung nicht zur Verfügung.";

/** Die EINE Meldung für eine Beziehungskennung, zu der es nichts gibt. */
const BEZIEHUNG_UNBEKANNT_MELDUNG = "Diese Beziehung gibt es nicht.";

/**
 * DIE MELDUNG FÜR EINEN WIEDERHOLSCHLÜSSEL, DER SCHON EINEM ANDEREN BEITRAG GEHÖRT.
 *
 * Sie nennt ausdrücklich KEINE Endpunkte, keine Kennung und keinen Titel: der Aufrufer hat den
 * fremden Beitrag nicht gesehen, und die Antwort darf ihm nichts darüber sagen.
 */
const SCHLUESSEL_FREMD_MELDUNG =
  "Dieser Beitrag wurde bereits für eine andere Verknüpfung verwendet. Bitte mit einem eigenen Beitrag erneut senden.";

export interface KantenSchreibServiceDeps {
  repo: KantenRepo;
  kos: KantenKoLeser;
}

/**
 * WANN DIESE FASSUNG ENTSTAND — gelesen aus dem Verlauf des Objekts, nicht geraten.
 *
 * `KnowledgeObject` trägt keinen „zuletzt geändert"-Zeitstempel; die Zeit steht am Verlaufseintrag
 * der jeweiligen Fassung (`HistoryEntry.version`/`.at`, types.ts:111-116). Findet sich zu der
 * heutigen Fassungsnummer kein Eintrag — bei Altbestand ohne Verlauf ist das möglich —, ist die
 * Antwort `null`. Ein hilfsweise eingesetztes `createdAt` wäre eine erfundene Tatsache: es sagt,
 * wann das OBJEKT entstand, nicht, wann DIESE Fassung entstand.
 */
export function fassungszeitVon(ko: KnowledgeObject): string | null {
  return (ko.history ?? []).find((e) => e.version === ko.version)?.at ?? null;
}

/** Der beurteilte Stand, aus den beiden Objekten in der Orientierung QUELLE → ZIEL gelesen. */
function beurteiltAus(quelle: KnowledgeObject, ziel: KnowledgeObject): BeurteilterStand {
  return {
    quelleVersion: quelle.version,
    zielVersion: ziel.version,
    quelleFassungAm: fassungszeitVon(quelle),
    zielFassungAm: fassungszeitVon(ziel),
  };
}

/** Der Inhaltsstand, den der Mensch VOR SICH HATTE, als er sich entschied. */
export interface GesehenerStand {
  quelleVersion: number;
  zielVersion: number;
}

/** Was ein Mensch behauptet, wenn er zwei Einträge verbindet. */
export interface KanteSetzenEingabe {
  quelleId: string;
  zielId: string;
  art: KantenArt;
  richtung: KantenRichtung;
  /** Der angemeldete Mensch. Pflicht — es gibt keinen Vorgabewert und keinen Automaten. */
  urheber: string;
  /** Der Zeitpunkt als Datum, nicht als Uhr im Dienst: so ist jeder Fall wiederholbar prüfbar. */
  jetzt: string;
  /** Die eigene Kennung der Beziehung, falls eine NEUE entsteht (Route: `randomUUID`). */
  id: string;
  /**
   * Der Wiederholschlüssel des Beitrags. PFLICHT: er ist die Zusage, dass ein verlorener
   * Antwortweg keinen zweiten Beitrag erzeugt. Ohne ihn liesse sich „nochmal beurteilt" nicht von
   * „Antwort ging verloren" unterscheiden — und der Server müsste raten.
   */
  beitragSchluessel: string;
  /**
   * Die Fassungen, die der Mensch beim Entscheiden vor sich hatte. Weichen sie vom heutigen Stand
   * ab, wird ABGEWIESEN (`STAND_VERALTET`) statt stillschweigend die neue Fassung zu beurteilen:
   * wer über zwei Texte urteilt, urteilt über DIESE zwei Texte.
   */
  gesehen: GesehenerStand;
}

/**
 * WAS BEIM SETZEN WIRKLICH GESCHAH — als Wert, nicht als Schluss aus `version === 1`.
 *
 * Genau diese Verwechslung stand hier einmal: die Route las die Version und antwortete 201, wenn
 * sie 1 war. Bei einer WIEDERHOLUNG desselben Beitrags ist sie ebenfalls 1 (es geschieht ja
 * nichts) — die Antwort behauptete also eine Neuanlage, die es nicht gab. Der Dienst sagt es
 * seither selbst, statt es den Aufrufer erraten zu lassen.
 */
export type Setzergebnis = "angelegt" | "fortgeschrieben" | "wiederholt";

export interface KanteGesetzt {
  kante: KuratierteKante;
  ergebnis: Setzergebnis;
}

export class KantenSchreibService {
  constructor(private readonly deps: KantenSchreibServiceDeps) {}

  /**
   * Setzt eine Beziehung, schreibt die vorhandene fort — oder gibt den unveränderten Stand zurück,
   * wenn derselbe Beitrag schon einmal ankam.
   *
   * DIE DREI AUSGÄNGE, in genau dieser Reihenfolge (API-Vertrag der Steuerung):
   *
   *   1. DERSELBE `beitragSchluessel` war schon da → der gespeicherte Stand, UNVERÄNDERT. Kein
   *      Versionsanstieg, keine neue Beurteilung, kein zweiter Eintrag. Das ist der Fall
   *      „Antwort ging verloren, Client wiederholt".
   *   2. DIESELBE FACHLICHE BEZIEHUNG (kanonisches Paar + Art) war schon da → sie wird
   *      FORTGESCHRIEBEN: `id`, `urheber` und `gesetztAm` bleiben die der ersten Setzung, `version`
   *      zählt hoch, der beurteilte Stand wird neu erhoben. Das ist der Fall „ein Zweiter sieht es
   *      genauso" — und er ist kein Doppel.
   *   3. Sonst → eine neue Beziehung mit `version: 1`.
   *
   * Der Aufrufer unterscheidet 2 von 3 an `version === 1`; die Route macht daraus 201 gegen 200.
   */
  async setze(
    eingabe: KanteSetzenEingabe,
    opts: { sichtbar: KantenSichtbar },
  ): Promise<KanteGesetzt> {
    if (!KANTEN_ARTEN.includes(eingabe.art)) {
      throw new KantenError("VALIDATION", "Unbekannte Beziehungsart.");
    }
    if (!KANTEN_RICHTUNGEN.includes(eingabe.richtung)) {
      throw new KantenError("VALIDATION", "Unbekannte Richtung der Beziehung.");
    }
    if (typeof eingabe.urheber !== "string" || eingabe.urheber.length === 0) {
      throw new KantenError("VALIDATION", "Eine kuratierte Beziehung braucht einen Urheber.");
    }
    if (typeof eingabe.beitragSchluessel !== "string" || eingabe.beitragSchluessel.length === 0) {
      throw new KantenError("VALIDATION", "Zu jedem Beitrag gehört sein Wiederholschlüssel.");
    }
    if (eingabe.quelleId === eingabe.zielId) {
      throw new KantenError("VALIDATION", SELBSTBEZIEHUNG_MELDUNG);
    }

    // AUSGANG 1, VOR JEDER ANDEREN ARBEIT. Er steht bewusst vor der Sichtbarkeitsprüfung nicht:
    // wer den Schlüssel kennt, hat den Beitrag geleistet — aber sehen darf er das Ergebnis nur,
    // wenn er die Endpunkte sehen darf. Deshalb erst die Endpunkte, dann der Schlüssel.
    const quelle = await this.erreichbar(eingabe.quelleId, opts.sichtbar);
    const ziel = await this.erreichbar(eingabe.zielId, opts.sichtbar);

    // ==========================================================================================
    // AUSGANG 1 — DER SCHLÜSSEL WAR SCHON DA. HIER ALS VORGRIFF, VERBINDLICH IM BESTAND.
    // ==========================================================================================
    //
    // DIESE ABFRAGE ENTSCHEIDET NICHTS ÜBER DIE EINDEUTIGKEIT — das tut seit BEN R3 allein
    // `KantenRepo.setzeMitBindung`, wo Prüfung und Schreiben zusammenfallen. Sie steht trotzdem
    // hier, und zwar für GENAU EINE Sache, die weiter unten nicht mehr möglich wäre: eine
    // WIEDERHOLUNG darf nicht an `gesehen` scheitern. Wessen Antwort verloren ging, der sendet
    // seinen Beitrag unverändert noch einmal — und dass sich einer der beiden Texte inzwischen
    // bewegt hat, ist kein Grund, ihn abzuweisen: es geschieht ja nichts. Ohne diesen Vorgriff
    // bekäme ausgerechnet der ehrliche Wiederholer ein `409 STAND_VERALTET`.
    //
    // DIE BINDUNGSPRÜFUNG IST DIESELBE FUNKTION wie im Bestand (`pruefeSchluesselBindung`), und
    // sie trägt hier die Autorisierung: stimmen kanonisches Paar, Art und Richtung überein, sind
    // die Endpunkte der zurückgegebenen Beziehung DIESELBEN, die zwei Zeilen weiter oben durch
    // `erreichbar` gegangen sind (BEN R2, Korrekturpflicht 2 — gemessen an A–B setzen, A in den
    // Papierkorb, dann C–D mit demselben Schlüssel).
    const schonGesetzt = await this.deps.repo.holeNachBeitrag(eingabe.beitragSchluessel);
    if (schonGesetzt) {
      pruefeSchluesselBindung(schonGesetzt, eingabe);
      return { kante: schonGesetzt, ergebnis: "wiederholt" };
    }

    // DER STAND, ÜBER DEN WIRKLICH GEURTEILT WURDE. Weicht er ab, wird nicht „hilfsweise" der
    // heutige beurteilt — der Mensch hat einen anderen Text gelesen, als heute dasteht.
    if (
      eingabe.gesehen.quelleVersion !== quelle.version ||
      eingabe.gesehen.zielVersion !== ziel.version
    ) {
      throw new KantenError(
        "STAND_VERALTET",
        "Einer der beiden Einträge wurde inzwischen überarbeitet. Bitte den aktuellen Stand ansehen und erneut entscheiden.",
        { quelleVersion: quelle.version, zielVersion: ziel.version },
      );
    }

    const neu: KuratierteKante = {
      id: eingabe.id,
      quelleId: eingabe.quelleId,
      zielId: eingabe.zielId,
      art: eingabe.art,
      richtung: eingabe.richtung,
      urheber: eingabe.urheber,
      gesetztAm: eingabe.jetzt,
      geaendertAm: eingabe.jetzt,
      status: "aktiv",
      version: 1,
      beurteilt: beurteiltAus(quelle, ziel),
      beitragSchluessel: [eingabe.beitragSchluessel],
    };
    // ==========================================================================================
    // AUSGANG 2 UND 3 — IN EINEM SCHRITT, WEIL SIE IN EINEM SCHRITT GEHÖREN.
    // ==========================================================================================
    //
    // WAS HIER BIS BEN R3 STAND: ein `setze` und darum herum eine Fehlerbehandlung, die einen
    // Unique-Index-Verstoss nachträglich in den richtigen Ausgang übersetzte. Das war die
    // Reparatur eines Wettlaufs, nicht seine Vermeidung — und sie deckte nur den Fall ab, in dem
    // die DATENBANK widersprach. Zwei gleichzeitige Beiträge mit DEMSELBEN Schlüssel widersprachen
    // ihr gar nicht: der Schlüssel stand in einem jsonb-Feld, über das kein Index wacht. Beide
    // Anfragen kamen durch, eine legte an, die andere schrieb fort — `version: 2` für einen
    // Beitrag, der einmal gemeint war.
    //
    // DIE ENTSCHEIDUNG DARÜBER LIEGT JETZT DORT, WO SIE UNTEILBAR GETROFFEN WERDEN KANN: im
    // Bestand. Dieser Dienst prüft die Rechte und den beurteilten Stand und übergibt dann Kante
    // UND Schlüssel zusammen. Was zurückkommt, sagt der Bestand selbst — geraten wird nichts.
    return this.deps.repo.setzeMitBindung(neu, eingabe.beitragSchluessel);
  }

  /**
   * Der WIDERRUF — die Rücknahme einer Beziehung durch einen Menschen.
   *
   * ER LÖSCHT NICHT. `status: "widerrufen"` ist eine Urheberaussage (`kanten-types.ts:30-36`);
   * Kennung, Urheber und `gesetztAm` bleiben stehen, `version` zählt hoch. Wer die Zeile
   * entfernte, könnte später nicht mehr unterscheiden, ob jemand zurückgenommen hat oder ob es die
   * Beziehung nie gab. Genau deshalb gibt es im Vertrag KEIN `DELETE`.
   *
   * ZWEI VERANTWORTLICHKEITEN, ZWEI FELDER (JOB 4151, BEN R2, Korrekturpflicht 3). Der `urheber`
   * bleibt, wer die Beziehung ERFUNDEN hat; `widerrufenVon` hält fest, wer sie ZURÜCKGENOMMEN hat.
   * Bis hierher verlangte diese Methode einen Urheber, prüfte ihn — und schrieb ihn dann nicht;
   * ein Admin konnte die Beziehung einer Controllerin widerrufen, und im Bestand stand danach
   * nur noch die Controllerin. Eine Urheberaussage ohne Urheber ist keine.
   *
   * `erwarteteVersion` ist PFLICHT und keine Bequemlichkeit: ohne sie nähme der zweite Bearbeiter
   * still die Entscheidung des ersten zurück, und beide hielten ihre für die geltende. Die Prüfung
   * geschieht IM Bestand (`KantenRepo.setze`), also im selben unteilbaren Schritt wie das
   * Schreiben — eine Prüfung hier oben wäre ein Fenster.
   *
   * DER BEURTEILTE STAND BLEIBT STEHEN. Ein Widerruf ist keine neue Beurteilung des Inhalts; er
   * nimmt die alte zurück. Ihn beim Widerruf zu erneuern hiesse, eine zurückgenommene Aussage als
   * frisch geprüft auszuweisen.
   */
  async widerrufe(
    id: string,
    aenderung: { urheber: string; jetzt: string; erwarteteVersion: number },
    opts: { sichtbar: KantenSichtbar },
  ): Promise<KuratierteKante> {
    if (typeof aenderung.urheber !== "string" || aenderung.urheber.length === 0) {
      throw new KantenError("VALIDATION", "Ein Widerruf braucht einen Urheber.");
    }
    const vorhanden = await this.deps.repo.hole(id);
    if (!vorhanden) {
      throw new KantenError("NOT_FOUND", BEZIEHUNG_UNBEKANNT_MELDUNG);
    }
    // BEIDE Endpunkte müssen für diesen Menschen erreichbar sein — sonst verriete schon die
    // Unterscheidung „409 statt 403" die Existenz einer Beziehung zu etwas Unsichtbarem.
    await this.erreichbar(vorhanden.quelleId, opts.sichtbar);
    await this.erreichbar(vorhanden.zielId, opts.sichtbar);

    return this.deps.repo.setze(
      {
        ...vorhanden,
        status: "widerrufen",
        geaendertAm: aenderung.jetzt,
        widerrufenVon: aenderung.urheber,
      },
      { erwarteteVersion: aenderung.erwarteteVersion },
    );
  }

  /**
   * Das Objekt, WENN es der Aufrufer erreichen darf — sonst DIESELBE Abweisung wie für ein Objekt,
   * das es gar nicht gibt. Die vier Gründe (unbekannt, Papierkorb, gelöscht, unsichtbar) bleiben
   * ununterscheidbar; das ist die Zusage des Moduls und nicht eine Bequemlichkeit dieser Funktion.
   */
  private async erreichbar(koId: string, sichtbar: KantenSichtbar): Promise<KnowledgeObject> {
    const ko = await this.deps.kos.get(koId);
    if (!ko || !sichtbar(ko)) {
      throw new KantenError("FORBIDDEN", ENDPUNKT_UNERREICHBAR_MELDUNG);
    }
    return ko;
  }
}

// ================================================================================================
// JOB 1553 · D1 (H3 / SCRUM-550+551) — DER QUALITÄTSBLICK. VIER ZAHLEN, KEINE OBJEKTDATEN.
// ================================================================================================
//
// WAS „QUALITÄT" HIER HEISST, IST NICHT ERFUNDEN. Der Auftrag hält fest, dass der Begriff nirgends
// definiert steht — er ist deshalb aus dem einzigen Präzedenzfall dieses Moduls abgeleitet:
// `KoService.aiCheckCoverageSummary` (`service.ts:2730`). Von dort stammen vier Entscheidungen:
//
//  1. **`sichtbar` ist PFLICHT, nicht optional.** Begründung dort im Quelltext (`:2726-2729`): die
//     Zähler hängen algebraisch zusammen, „jedes vertrauliche Nicht-Demo-KO erhöhte `total` und
//     genau einen Zustandszähler. Bei `total: 1` war die Existenz unmittelbar belegt (ben,
//     sammel72). Gefiltert wird die GRUNDMENGE." Genau deshalb steht hier kein `sichtbar?`:
//     Es gibt keine sinnvolle Lesart einer Kennzahl ohne Entscheidung, und fail-closed wäre die
//     schwächere Antwort — ein vergessenes Prädikat soll gar nicht erst übersetzen.
//  2. **Demo-Bestand fällt aus der Grundmenge** (`:2733` `!ko.demoSeed`).
//  3. **„Bewusst so schmal wie möglich … keine Objektdaten, keine Titel, keine IDs."**
//  4. **Verschiedene Aussagen bekommen verschiedene Zähler** und werden nicht verschmolzen
//     (`:2723`: „das ist eine andere Aussage … und darf nicht mit ihr verschmelzen").
//
// WAS DAS NETZ BIS HEUTE ÜBER SICH SELBST SAGTE: genau eine Zahl, `KantenRepo.anzahl()`
// (`kanten-repo.ts:93`) — und sie ist UNGETRIMMT, ausdrücklich „für Prüfstände und Zähler". Für
// einen Qualitätsblick ist sie unbrauchbar: sie zählt Beziehungen, die die Rolle nicht sehen darf.
//
// WAS HIER BEWUSST NICHT ENTSTEHT — „Kanten auf gelöschte Objekte". Diese Zahl lässt sich nicht
// bauen, ohne den Kern dieses Dienstes zu brechen: `alsAnsicht` macht widerrufen, unauflösbar und
// unsichtbar AUSDRÜCKLICH ununterscheidbar (siehe dort). Eine Zahl darüber wäre genau die Auskunft,
// die diese Ununterscheidbarkeit verhindert — und ab n=1 ist sie eine.

/** Die Objektliste, über die der Qualitätsblick zählt — erfüllt von `KoService.list`. */
export interface QualitaetKoBestand {
  alle(): Promise<readonly KnowledgeObject[]>;
}

/**
 * Vier Zahlen über das kuratierte Netz — **alle über derselben getrimmten Grundmenge**.
 *
 * `vernetzt + verwaist === total` ist zugesagt und geprüft. Diese algebraische Kopplung ist der
 * Grund, warum die Grundmenge VOR dem Zählen gefiltert wird: sonst verriete jede der Zahlen die
 * Existenz dessen, was sie mitzählt.
 *
 * **Keine Zahl über Weggelassenes.** Es gibt keinen Zähler für widerrufene, unauflösbare oder
 * unsichtbare Beziehungen — siehe der Block oben.
 */
export interface NetzQualitaet {
  /** Sichtbare Nicht-Demo-Objekte. Die Grundmenge, auf die sich alles Weitere bezieht. */
  total: number;
  /** Davon mit mindestens einer sichtbaren kuratierten Beziehung zu einem Objekt der Grundmenge. */
  vernetzt: number;
  /** Davon ohne jede solche Beziehung. Eigener Zähler, weil es eine eigene Aussage ist. */
  verwaist: number;
  /** Verschiedene sichtbare Beziehungen INNERHALB der Grundmenge — jede genau einmal. */
  kanten: number;
}

/**
 * Erhebt den Qualitätsblick aufs kuratierte Netz.
 *
 * **Die drei Zahlen und warum gerade sie** (Auftrag §3 Nr. 2):
 *
 * * `vernetzt` — Beziehungen zu erheben ist der Zweck von H3; diese Zahl sagt, wie weit er
 *   gediehen ist, statt dass jemand es schätzt.
 * * `verwaist` — sie benennt den Rest, den noch jemand kuratieren müsste: das Rohmaterial für
 *   „wo sind die Lücken", ohne selbst zu urteilen, ob eine Lücke schlimm ist.
 * * `kanten` — erst zusammen mit `vernetzt` unterscheidet sie ein breit geknüpftes Netz von einem,
 *   in dem wenige Objekte viele Beziehungen tragen.
 *
 * **Gebaut auf dem vorhandenen Lesedienst, nicht daneben:** die Sichtbarkeitsentscheidung wird über
 * `kantenFuer` erfragt und damit geerbt, statt ein zweites Mal ausgelegt zu werden.
 *
 * **Als Modulfunktion, nicht als Methode:** `KantenLeseService` sagt zu, genau eine Methode zu
 * tragen (`tests/ko/kanten-lesekette-sichtbarkeit.test.ts:252` hält das fest). Ein Lesezusatz ist
 * kein Grund, eine fremde Zusicherung anzutasten.
 *
 * **Kosten, ehrlich:** ein `kantenFuer` je Objekt der Grundmenge, darunter eine Objektabfrage je
 * Beziehung. Ein Bündelweg gehört in `KantenRepo` und damit nicht in diese Lease.
 */
export async function netzQualitaet(
  deps: KantenLeseServiceDeps & { bestand: QualitaetKoBestand },
  opts: { sichtbar: KantenSichtbar },
): Promise<NetzQualitaet> {
  // TRIMM VOR ALLEM ANDEREN — und der Demo-Ausschluss gehört mit hinein, sonst zählte eine
  // Demo-Beziehung ein echtes Objekt als vernetzt.
  const grundmenge = (await deps.bestand.alle()).filter((ko) => !ko.demoSeed && opts.sichtbar(ko));
  const inGrundmenge = new Set(grundmenge.map((ko) => ko.id));

  const dienst = new KantenLeseService(deps);
  const kantenIds = new Set<string>();
  let vernetzt = 0;
  let verwaist = 0;

  for (const ko of grundmenge) {
    const auskunft = await dienst.kantenFuer(ko.id, { sichtbar: opts.sichtbar });
    // `kantenFuer` trimmt nach Sichtbarkeit, kennt den Demo-Ausschluss aber nicht — die Kante muss
    // deshalb BEIDE Enden in der Grundmenge haben, sonst wäre sie eine Aussage über etwas, das
    // nicht mitgezählt wird.
    let eigene = 0;
    for (const kante of auskunft.kanten) {
      if (inGrundmenge.has(kante.gegenstueck.id)) {
        kantenIds.add(kante.id);
        eigene++;
      }
    }
    if (eigene > 0) {
      vernetzt++;
    } else {
      verwaist++;
    }
  }

  return { total: grundmenge.length, vernetzt, verwaist, kanten: kantenIds.size };
}
