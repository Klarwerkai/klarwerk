// ================================================================================================
// JOB 1496 · D1 (M-2, Schritt 2) — DAS GRAPH-LESEMODELL: DIE ABFRAGE, DIE EINE SICHT BEDIENT.
// ================================================================================================
//
// DIE ABNAHMEFRAGE DES MEILENSTEINS, wörtlich: „Kann Pedi eine Seite oeffnen, die zeigt, welche
// Themen es gibt, wer dazu beigetragen hat und wo die Luecken sind?" Diese Datei baut das Stück
// darunter — die eine Abfrage, aus der eine solche Seite ihre Zahlen zieht.
//
// Sie beantwortet Frage 1 (welche Themen) und Frage 2 (wer hat beigetragen) und legt für Frage 3
// das Rohmaterial bereit. Die Lückenauswertung selbst gehört PRO5 (`luecken*.ts`) — Auftrag
// §110-112. Hier stehen deshalb Zähler und keine Urteile: kein Schwellenwert, keine Rangfolge nach
// Bedürftigkeit, kein „hier fehlt etwas".
//
// ================================================================================================
// DIE DREI ENTSCHEIDUNGEN, DIE DER AUFTRAG VERLANGT (§85-88) — hier, nicht in der Rückgabe.
// ================================================================================================
//
// 1. WELCHE FORM DIE ABFRAGE HAT: eine einzige Lesemethode `sicht()` auf einer Klasse mit
//    injizierten Ports. Die Fläche ist absichtlich eine Methode — dieselbe Zusage wie bei
//    `KantenLeseService` (kanten-service.ts:229-236): solange hier nur gelesen wird, kann keine
//    Route und kein Automat über dieses Modul etwas verändern. Ein Test hält die Fläche fest.
//
// 2. WAS SIE ZURÜCKGIBT: eine fertig aggregierte `WissensnetzSicht` — Themen mit Zählern und
//    Beitragenden, keine Objektlisten. Der Grund ist nicht Sparsamkeit, sondern die Zusage aus dem
//    Kantenvertrag: was nicht mitreist, kann nicht auslaufen. Eine Themenübersicht braucht weder
//    Titel noch Kennungen; wer ein einzelnes Objekt sehen will, geht über die Objektroute, die
//    ihre eigene Rechteprüfung hat.
//
// 3. WIE SIE MIT GROSSEN MENGEN UMGEHT: in drei Stufen, alle gemessen abschaltbar —
//    (a) Die Aggregation ist EIN Durchlauf über die getrimmte Grundmenge. Keine Sortierung der
//        Objekte, nur der fertigen Themen; damit hängt die Laufzeit an der Zahl der Objekte, nicht
//        an der Zahl der Themen mal Objekte.
//    (b) Die Kantenzähler sind OPT-IN (`mitVerknuepfung`). Sie kosten eine Abfrage JE OBJEKT und
//        sind das einzige N+1 in dieser Datei; die Fragen 1 und 2 brauchen sie nicht. Wer sie nicht
//        anfordert, zahlt sie nicht.
//    (c) Beide Mengen haben einen harten Deckel: `THEMEN_DECKEL` begrenzt die Ausgabe,
//        `KANTEN_ABFRAGE_DECKEL` die Zahl der Kantenabfragen. Der zweite lässt die Zähler lieber
//        WEG, als eine falsche Zahl zu liefern — eine über einer Teilmenge gebildete Summe sähe
//        aus wie eine Gesamtsumme.
//
// ================================================================================================
// DIE REGEL, DIE HIER NICHT FÄLLT: TRIMM VOR AGGREGATION, ZÄHLER DANACH.
// ================================================================================================
//
// Sie ist im Bestand zweimal gegen genau diesen Fehler gebaut worden und wird hier fortgeführt:
//  · `kanten-service.ts:19-30` — „Deshalb trimmt dieser Dienst die Grundmenge VOR der Ausgabe, und
//    `total` zählt DANACH. KEIN SCHNITTZÄHLER."
//  · `service.ts:2726-2729` (mega76 Block D) — „jedes vertrauliche Nicht-Demo-KO erhöhte `total`
//    und genau einen Zustandszähler. Bei `total: 1` war die Existenz unmittelbar belegt."
//
// Eine Themenübersicht ist dafür besonders anfällig: ein Thema, das NUR vertrauliche Objekte
// enthält, dürfte gar nicht erscheinen — sein blosser Name wäre die Auskunft, dass es dazu etwas
// gibt. Dieses Lesemodell bildet die Themen deshalb AUS der getrimmten Menge, nicht aus dem
// Bestand; ein leer getrimmtes Thema existiert für den Aufrufer nicht.
import type {
  WissensnetzKantenLeser,
  WissensnetzKo,
  WissensnetzKoLeser,
  WissensnetzSicht,
  WissensnetzSichtbar,
  WissensnetzThema,
} from "./lesemodell-ports";
import { themenkarte } from "./themenkarte";

/**
 * Höchstzahl ausgelieferter Themen. Eine Seite, die tausend Themen zeichnet, ist keine Sicht mehr;
 * und eine unbegrenzte Antwort ist ein Speicherrisiko, das der Aufrufer nicht sieht.
 */
export const THEMEN_DECKEL = 200;

/**
 * Höchstzahl der Objekte, für die Kantenzähler erhoben werden. Darüber werden sie AUSGELASSEN und
 * `verknuepfungAusgelassen` gesetzt — nicht geschätzt und nicht über eine Teilmenge gebildet.
 *
 * **Gemessen wird die abfragbare Menge, nicht die sichtbare:** Objekte OHNE Thema lösen nie eine
 * Kantenabfrage aus (sie verlassen die Aggregation vorher), also zählen sie hier nicht mit. Bis
 * D4 zählten sie mit — ein Bestand aus zweitausend themenlosen und zwei thematisierten Objekten
 * liess die Zähler aus, obwohl genau zwei Abfragen angefallen wären. Der Deckel schützt vor Last;
 * Last entsteht nur, wo abgefragt wird.
 */
export const KANTEN_ABFRAGE_DECKEL = 2000;

/**
 * Höchstzahl ausgelieferter Beitragender JE THEMA. Dieselbe Begründung wie bei `THEMEN_DECKEL`
 * eine Zeile höher — sie galt hier immer schon und war nur nicht angewandt: ein Thema mit
 * fünftausend Beitragenden lieferte fünftausend Einträge, und der Aufrufer sah das Risiko nicht.
 *
 * Abgeschnitten wird der Schwanz, nicht der Kopf: sortiert wird vorher nach Umfang. Dass
 * abgeschnitten wurde, sagt `beitragendeAbgeschnitten` je Thema — **eine Zahl der Weggelassenen
 * gibt es nicht.**
 */
export const BEITRAGENDE_DECKEL = 200;

/**
 * FAIL-CLOSED, wörtlich wie im Bestand (`kanten-service.ts:137-144`,
 * `library-analytics/src/service.ts:83-87`): ohne übergebene Entscheidung ist NICHTS sichtbar —
 * nicht „alles". Ohne diese Beweislastumkehr lieferte eine vergessene Injektion in der
 * Kompositionswurzel den gesamten Bestand aus.
 */
function erzwingeSichtbar<K>(sichtbar: WissensnetzSichtbar<K> | undefined): WissensnetzSichtbar<K> {
  return typeof sichtbar === "function" ? sichtbar : () => false;
}

export interface LesemodellDeps<K extends WissensnetzKo> {
  kos: WissensnetzKoLeser<K>;
  /** Nur nötig, wenn `mitVerknuepfung` angefordert wird. */
  kanten?: WissensnetzKantenLeser<K>;
}

export interface SichtOptionen<K> {
  sichtbar?: WissensnetzSichtbar<K>;
  /**
   * Kantenzähler je Thema erheben. Kostet eine Abfrage je sichtbarem Objekt — siehe Entscheidung 3
   * im Dateikopf. Ohne `deps.kanten` wirkungslos und ehrlich als ausgelassen gemeldet.
   */
  mitVerknuepfung?: boolean;
  /**
   * Abweichender Themendeckel, nie über `THEMEN_DECKEL`.
   *
   * **Ein unbrauchbarer Wert (`NaN`, `Infinity`) gilt als nicht angegeben**, nicht als Null — eine
   * leere Themenliste mit `abgeschnitten: false` wäre eine falsche Aussage, und `Number(param)`
   * auf einen fehlerhaften URL-Parameter liefert genau `NaN`. Gebrochene Werte werden abgerundet,
   * damit der angewandte und der gemeldete Deckel dieselbe Zahl sind.
   */
  deckel?: number;
  /**
   * JOB 2600 D1: zusätzlich die Themenkarte erheben (`themenkarte.ts`).
   *
   * Sie kostet KEINE weitere Abfrage — sie rechnet über dieselbe getrimmte Grundmenge, die für die
   * Themenzähler ohnehin schon im Speicher liegt. Trotzdem opt-in: ohne Anforderung fehlt der
   * Schlüssel in der Antwort, statt dass eine leere Karte wie ein Ergebnis aussieht.
   */
  mitThemenkarte?: boolean;
}

/** Zwischenstand je Thema während des einen Durchlaufs. */
interface Sammler {
  objekte: number;
  beitraege: Map<string, number>;
  /** Objekte ohne benannten Urheber — sie fallen aus `beitraege` heraus und brauchen eine Zahl. */
  ohneBeitragende: number;
  verknuepft: number;
  unverknuepft: number;
}

function leererSammler(): Sammler {
  return { objekte: 0, beitraege: new Map(), ohneBeitragende: 0, verknuepft: 0, unverknuepft: 0 };
}

/**
 * Das Graph-Lesemodell.
 *
 * Die Fläche ist eine einzige Methode. Das ist die Zusage aus Entscheidung 1 in ausführbarer Form:
 * `tests/wissensnetz/lesemodell-sicht.test.ts` hält sie fest und wird rot, sobald eine zweite
 * Methode hinzukommt — insbesondere eine schreibende.
 */
export class LesemodellService<K extends WissensnetzKo = WissensnetzKo> {
  constructor(private readonly deps: LesemodellDeps<K>) {}

  async sicht(opts: SichtOptionen<K> = {}): Promise<WissensnetzSicht> {
    const sichtbar = erzwingeSichtbar(opts.sichtbar);
    // `Math.min`/`Math.max` reichen `NaN` unverändert durch. Ein unbrauchbarer Wert ergäbe damit
    // `slice(0, NaN)` → leere Liste und `length > NaN` → `abgeschnitten: false`: **eine leere
    // Sicht, die sich für vollständig erklärt.** Unbrauchbar heisst deshalb „nicht angegeben" —
    // es gilt derselbe Höchstwert wie bei `undefined`. Und ganzzahlig, damit der angewandte und
    // der gemeldete Deckel dieselbe Zahl sind.
    const deckelWunsch =
      typeof opts.deckel === "number" && Number.isFinite(opts.deckel)
        ? Math.floor(opts.deckel)
        : THEMEN_DECKEL;
    const deckel = Math.max(0, Math.min(deckelWunsch, THEMEN_DECKEL));

    // TRIMM VOR ALLEM ANDEREN. Ab hier existiert für dieses Modul nur noch Sichtbares.
    const roh = await this.deps.kos.alle();
    const sichtbare: K[] = [];
    // Wie viele der sichtbaren Objekte überhaupt in ein Thema fallen. NUR diese können eine
    // Kantenabfrage auslösen — themenlose verlassen die Schleife unten per `continue`, bevor
    // irgendetwas abgefragt wird. Der Deckel muss deshalb sie messen und nicht die Gesamtmenge,
    // sonst schützt er vor einer Last, die gar nicht entstünde.
    let mitThema = 0;
    for (const ko of roh) {
      if (sichtbar(ko)) {
        sichtbare.push(ko);
        if (ko.category.trim() !== "") {
          mitThema++;
        }
      }
    }

    const kantenLeser = this.deps.kanten;
    const verknuepfungGewuenscht = opts.mitVerknuepfung === true && kantenLeser !== undefined;
    const verknuepfungAusgelassen =
      opts.mitVerknuepfung === true &&
      (kantenLeser === undefined || mitThema > KANTEN_ABFRAGE_DECKEL);
    const verknuepfungErheben = verknuepfungGewuenscht && !verknuepfungAusgelassen;

    const themen = new Map<string, Sammler>();
    const alleBeitragenden = new Set<string>();
    // Wer in mindestens EIN Thema einzahlt. Die Differenz zu `alleBeitragenden` sind genau die
    // Menschen, die zwar sichtbar beitragen, aber in keinem `beitragende`-Eintrag auftauchen —
    // sonst bliebe `beitragendeGesamt` gegenüber der Themenliste unerklärt.
    const themenBeitragende = new Set<string>();
    let ohneThema = 0;

    for (const ko of sichtbare) {
      const urheber = (ko.author ?? "").trim();
      if (urheber !== "") {
        alleBeitragenden.add(urheber);
      }

      const thema = ko.category.trim();
      if (thema === "") {
        // Kein erfundenes Sammelthema — die Zahl steht eigens in der Antwort.
        ohneThema++;
        continue;
      }

      let sammler = themen.get(thema);
      if (sammler === undefined) {
        sammler = leererSammler();
        themen.set(thema, sammler);
      }
      sammler.objekte++;
      if (urheber !== "") {
        sammler.beitraege.set(urheber, (sammler.beitraege.get(urheber) ?? 0) + 1);
        themenBeitragende.add(urheber);
      } else {
        // Kein erfundener Sammelurheber — die Zahl steht eigens in der Antwort, damit die
        // Differenz zwischen `objekte` und der Summe der Beiträge nicht stumm bleibt.
        sammler.ohneBeitragende++;
      }

      if (verknuepfungErheben && kantenLeser !== undefined) {
        // Dieselbe Sichtbarkeitsentscheidung wird durchgereicht: der Kantendienst trimmt seine
        // Gegenendpunkte damit selbst, und dieses Modul zählt nur, was er ausgibt.
        const auskunft = await kantenLeser.kantenFuer(ko.id, { sichtbar });
        if (auskunft.total > 0) {
          sammler.verknuepft++;
        } else {
          sammler.unverknuepft++;
        }
      }
    }

    const sortiert: WissensnetzThema[] = [...themen.entries()]
      .map(([thema, s]) => {
        const beitragende = [...s.beitraege.entries()]
          .map(([urheber, objekte]) => ({ urheber, objekte }))
          .sort((a, b) => b.objekte - a.objekte || a.urheber.localeCompare(b.urheber));
        // exactOptionalPropertyTypes: die Kantenzähler stehen nur da, wenn sie erhoben wurden.
        return {
          thema,
          objekte: s.objekte,
          // Erst sortiert, dann geschnitten: der Deckel nimmt den Schwanz, nicht den Kopf.
          beitragende: beitragende.slice(0, BEITRAGENDE_DECKEL),
          beitragendeAbgeschnitten: beitragende.length > BEITRAGENDE_DECKEL,
          ohneBeitragende: s.ohneBeitragende,
          ...(verknuepfungErheben
            ? { verknuepft: s.verknuepft, unverknuepft: s.unverknuepft }
            : {}),
        };
      })
      // Deterministische Reihenfolge: grösstes Thema zuerst, Name als Stichentscheid. Ohne sie
      // wäre jede Anzeige und jeder Vergleichstest von der Ablagereihenfolge abhängig.
      .sort((a, b) => b.objekte - a.objekte || a.thema.localeCompare(b.thema));

    return {
      themen: sortiert.slice(0, deckel),
      objekteGesamt: sichtbare.length,
      beitragendeGesamt: alleBeitragenden.size,
      ohneThema,
      // Der Grund steht nur da, wenn wirklich ausgelassen wurde — sonst wäre er eine Aussage
      // über nichts. Reihenfolge nicht beliebig: ein fehlender Port ist ein Verdrahtungsfehler
      // und wiegt schwerer als eine zu grosse Menge, die nur eine engere Abfrage verlangt.
      ...(verknuepfungAusgelassen
        ? {
            verknuepfungAusgelassenGrund:
              kantenLeser === undefined
                ? ("kein-kantenport" as const)
                : ("zu-viele-objekte" as const),
          }
        : {}),
      // Mengendifferenz, kein zweiter Zähler: wer nirgends in ein Thema einzahlt. Bewusst gegen
      // ALLE gebildeten Themen gerechnet und nicht gegen die am Deckel beschnittene Ausgabe —
      // sonst wanderte ein Mensch, dessen Thema nur abgeschnitten wurde, in diese Zahl und würde
      // dort als themenlos ausgewiesen. Das wäre eine falsche Auskunft, kein knapperer Bericht.
      beitragendeNurOhneThema: [...alleBeitragenden].filter((u) => !themenBeitragende.has(u))
        .length,
      verknuepfungAusgelassen,
      abgeschnitten: sortiert.length > deckel,
      // JOB 2600 D1: RECHTE ZUERST ist hier bereits geschehen — `sichtbare` ist die getrimmte
      // Menge aus der Schleife oben, und `themenkarte` trimmt nicht und darf es nicht. Der
      // Schlüssel fehlt ohne Anforderung; siehe `SichtOptionen.mitThemenkarte`.
      ...(opts.mitThemenkarte === true ? { themenkarte: themenkarte(sichtbare) } : {}),
    };
  }
}
