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
import { istSelbstbeziehung, kanonischesPaar } from "./kanten-paar";
import type { KantenArt, KantenRichtung, KuratierteKante } from "./kanten-types";
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
  KantenArt,
  KantenRichtung,
  KantenStatus,
  KuratierteKante,
} from "./kanten-types";

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

  // H3 (JOB 1495 D3): Die Zusage aus `KantenRichtung` oben — „ihr Endpunktpaar wird kanonisch
  // abgelegt" — wird hier eingelöst. Sie stand seit dem ersten Entwurf im Kommentar; die
  // Persistenzscheibe, die sie tragen sollte (JOB 1139), ist verloren. Bis sie neu entsteht, legt
  // sonst NIEMAND kanonisch ab, und „A ergänzt B" wäre ein anderer Eintrag als „B ergänzt A".
  //
  // Gerichtete Kanten bleiben unberührt: bei ihnen IST die Reihenfolge die Aussage.
  async setze(kante: KuratierteKante): Promise<void> {
    // JOB 1543 D1 (SCRUM-546): dieselbe Schranke wie im `DeduplizierenderKantenBestand`. Zwei
    // Bestände, die eine Beziehung verschieden streng annehmen, wären genau die zweite Wahrheit,
    // gegen die dieses Modul gebaut ist.
    if (istSelbstbeziehung(kante)) {
      throw new Error(
        `Eine Beziehung braucht zwei Enden: ${kante.quelleId} kann nicht auf sich selbst zeigen.`,
      );
    }
    this.kanten.set(kante.id, { ...kanonischesPaar(kante) });
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
