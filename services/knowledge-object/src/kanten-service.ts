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
import type { Confidentiality, KnowledgeObject, KoStatus } from "./types";

// ================================================================================================
// DAS AGGREGAT.
// ================================================================================================
//
// Feldbestand und Bedeutung stammen unverändert aus dem geschlossenen Vertrag (D2 §2.3). Sie sind
// hier NICHT neu erfunden, damit die Persistenzscheibe denselben Satz vorfindet.

/** Die fachliche Beziehungsart. Bewusst geschlossen: eine freie Zeichenkette wäre kein Vertrag. */
export type KantenArt = "gehoert_zu" | "ergaenzt" | "ersetzt" | "widerspricht" | "beispiel_fuer";

/**
 * `gerichtet` behält die Reihenfolge der Endpunkte (A ersetzt B ist nicht B ersetzt A).
 * `ungerichtet` und `symmetrisch` tragen keine Richtungsaussage; ihr Endpunktpaar wird von der
 * Persistenzscheibe kanonisch abgelegt.
 */
export type KantenRichtung = "gerichtet" | "ungerichtet" | "symmetrisch";

/**
 * `widerrufen` ist eine URHEBERAUSSAGE: ein Mensch hat die Beziehung zurückgenommen. Deshalb setzt
 * ein Papierkorbvorgang am Endpunkt diesen Wert NICHT (D3 §3.3) — sonst wäre nach der
 * Wiederherstellung nicht mehr unterscheidbar, ob jemand widerrufen hat oder ob die Kante nur ein
 * Papierkorbereignis überlebt hat. Die Sichtbarkeit trägt das allein.
 */
export type KantenStatus = "aktiv" | "widerrufen";

export interface KuratierteKante {
  /** Eigene Identität, nicht aus den Endpunkten abgeleitet. */
  id: string;
  quelleId: string;
  zielId: string;
  art: KantenArt;
  richtung: KantenRichtung;
  /** Der Mensch, der sie gesetzt hat. Nie ein Automat (D2 §2.6). */
  urheber: string;
  gesetztAm: string;
  geaendertAm: string;
  status: KantenStatus;
  version: number;
}

// ================================================================================================
// DER BESTAND — ALS PORT.
// ================================================================================================

/**
 * Die Leseseite des Kantenbestands. Absichtlich schmal: dieser Durchgang liest, er schreibt nicht.
 *
 * Die Persistenzscheibe (JOB 1139) implementiert diesen Port mit Postgres und ergänzt ihn um die
 * Schreibseite. Der Port ist der Grund, warum dabei kein zweites Kantenmodell entstehen muss.
 */
export interface KantenRepo {
  /** Alle Kanten, an denen `koId` als Quelle ODER als Ziel beteiligt ist — ungetrimmt. */
  fuerKo(koId: string): Promise<readonly KuratierteKante[]>;
}

/**
 * Die In-Memory-Fassung. Sie ist der Prüfstand dieses Durchgangs, nicht die Produktionsablage:
 * `setze` befüllt den Bestand für Tests und Entwicklungsbetrieb und ist ausdrücklich KEIN
 * öffentlicher Kuratierungsweg — der entsteht erst mit S4 hinter `ko.relate`.
 */
export class InMemoryKantenRepo implements KantenRepo {
  private readonly kanten = new Map<string, KuratierteKante>();

  async setze(kante: KuratierteKante): Promise<void> {
    this.kanten.set(kante.id, { ...kante });
  }

  async fuerKo(koId: string): Promise<readonly KuratierteKante[]> {
    return [...this.kanten.values()].filter((k) => k.quelleId === koId || k.zielId === koId);
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
): Promise<KuratierteKanteAnsicht | undefined> {
  if (kante.status !== "aktiv") {
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
  return {
    id: kante.id,
    art: kante.art,
    richtung: kante.richtung,
    ...(rolle ? { rolle } : {}),
    gegenstueck: { id: gegen.id, title: gegen.title, status: gegen.status },
    urheber: kante.urheber,
    gesetztAm: kante.gesetztAm,
  };
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
    const roh = await this.deps.repo.fuerKo(koId);
    const ansichten: KuratierteKanteAnsicht[] = [];
    for (const kante of roh) {
      const ansicht = await alsAnsicht(kante, koId, this.deps, sichtbar);
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
