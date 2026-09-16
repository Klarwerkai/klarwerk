// ================================================================================================
// JOB 1495 · D4 · H3 — DERSELBE BEZUG, ZWEIMAL GESETZT, BLEIBT EINE BEZIEHUNG.
// ================================================================================================
//
// WAS HIER ENTSTEHT UND WARUM. `InMemoryKantenRepo` (kanten-service.ts) ist der Prüfstand des
// Lesewegs: `setze` legt ab, `fuerKo` liest. Es dedupliziert nicht — zwei Aufrufe mit derselben
// fachlichen Beziehung, aber verschiedenen Kennungen, ergeben dort zwei Einträge. Für den Prüfstand
// ist das richtig; für einen Bestand, aus dem das Wissensnetz gespeist wird, wäre es die Doppelung,
// gegen die D3 die Kanonisierung gebaut hat — nur eine Ebene höher.
//
// DIE DREI ZUSAGEN, die JOB 1139 D1 einmal hatte und deren Stand verloren ist (D2-Rückgabe §5:
// Clone gelöscht, keine der 28 Sicherungen trägt ihn). Sie stehen im BEN-Urteil zu jenem Durchgang
// beschrieben und werden hier ausführbar gemacht:
//
//   1. DEDUPLIZIERUNG über den Beziehungsschlüssel (kanten-paar.ts) — kanonisches Paar plus Art.
//   2. ERHALT DER ÄLTESTEN HERKUNFT — wer sie zuerst gesetzt hat und wann, bleibt stehen.
//   3. EIGENSTÄNDIGE IDENTITÄT — die Kennung der ersten Setzung gewinnt; sie ist nicht aus den
//      Endpunkten abgeleitet und darf durch eine Wiederholung nicht wandern.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT. Kein öffentlicher Kuratierungsweg: `setze` ist wie beim
// Prüfstand ein Bestandsweg, kein Recht. Die Autorisierung läuft über `ko.relate` und den
// `KantenSchreibService` (kanten-service.ts) — nicht über diese Datei.
//
// JOB 4151 — DER SATZ „UND KEIN POSTGRES" IST EINGELÖST UND DESHALB HIER NICHT MEHR ZU LESEN.
// Bis zu diesem Auftrag stand an dieser Stelle, der Adapter brauche „Migration und Modulexport,
// die beide außerhalb der Lease liegen (D3-Rückgabe §5)". Beides gibt es jetzt:
// `kanten-repo-pg.ts` (`PgKantenRepo`, `KANTEN_SCHEMA`), migriert in `services/app/src/db.ts`,
// exportiert über `services/knowledge-object/index.ts`.
//
// DIESER BESTAND BLEIBT TROTZDEM, und zwar als das, was er immer war: die Vorlage, die der Adapter
// zu übersetzen hatte — und der Prüfstand für Tests und Entwicklungsbetrieb. Dass er wirklich
// dasselbe tut, wird nicht behauptet, sondern gefahren: beide Fassungen laufen gegen DENSELBEN
// Fallsatz (`tests/wissensgraph-integration/bestandsvertrag.ts`). Ein zweites Kantenmodell gibt es
// nicht; es gibt ein Modell und zwei Ablagen.
import { beziehungsSchluessel, istSelbstbeziehung, kanonischesPaar } from "./kanten-paar";
import {
  type KanteGesetzt,
  type KantenRepo,
  SELBSTBEZIEHUNG_MELDUNG,
  Schreibsperre,
  entdoppelt,
  mitBeitragSchluessel,
  pruefeErwarteteVersion,
  pruefeSchluesselBindung,
  vereinigeSchluessel,
} from "./kanten-service";
import { KantenError, type KuratierteKante } from "./kanten-types";

/**
 * Ein Bestand, in dem eine fachliche Beziehung genau einmal vorkommt.
 *
 * Der Schlüssel ist `beziehungsSchluessel` — kanonisches Endpunktpaar, Art und Richtungsklasse,
 * ohne Status, Urheber und Zeit. Damit ist „A ergänzt B" dieselbe Beziehung wie „B ergänzt A",
 * aber eine andere als „A widerspricht B".
 */
export class DeduplizierenderKantenBestand implements KantenRepo {
  // Schlüssel → Kante. Die Kennung der Kante bleibt daneben erhalten; sie ist NICHT der Index,
  // sonst wäre dieselbe Beziehung unter zwei Kennungen wieder zwei Einträge.
  private readonly nachBeziehung = new Map<string, KuratierteKante>();
  /**
   * Die Entsprechung zur Transaktion des Postgres-Bestands (JOB 4151, BEN R3). Warum ein Bestand
   * im Speicher überhaupt eine Sperre braucht, steht ausgeschrieben an `Schreibsperre`
   * (kanten-service.ts): ein einzelner Faden schützt nur, was zwischen zwei `await` liegt.
   */
  private readonly sperre = new Schreibsperre();

  /**
   * Legt die Beziehung ab oder schreibt die vorhandene fort.
   *
   * BEIM ERSTEN MAL: kanonisiert und übernommen, wie sie kommt.
   *
   * BEIM WIEDERHOLTEN SETZEN wird NICHT ersetzt, sondern fortgeschrieben:
   *   · `id`, `urheber`, `gesetztAm` bleiben die der ERSTEN Setzung (Zusage 2 und 3),
   *   · `geaendertAm`, `status` und `widerrufenVon` folgen der NEUEN Setzung,
   *   · `version` zählt hoch.
   *
   * Dass `widerrufenVon` der NEUEN Setzung folgt, ist die Kehrseite von Zusage 2 und gewollt: wer
   * eine zurückgenommene Beziehung erneut setzt, macht sie wieder aktiv — dann steht dort wieder
   * nichts, weil es keine geltende Rücknahme mehr gibt (JOB 4151, `kanten-types.ts`).
   *
   * Warum die alte Herkunft gewinnt: Sie ist eine Tatsache über die Vergangenheit. Wer eine
   * bestehende Beziehung erneut setzt, ändert nicht, wer sie erfunden hat — sonst könnte ein
   * zweiter Mensch die Urheberschaft eines ersten still übernehmen.
   */
  async setze(
    kante: KuratierteKante,
    opts: { erwarteteVersion?: number } = {},
  ): Promise<KuratierteKante> {
    return this.sperre.fuehre(async () => this.lege(kante, opts));
  }

  /**
   * JOB 4151 (BEN R3) — SCHLÜSSELBINDUNG UND ABLAGE IN EINEM UNTEILBAREN SCHRITT.
   *
   * DER RUMPF UNTER DER SPERRE IST SYNCHRON, und das ist keine Feinheit, sondern die Zusage
   * selbst: zwischen „gehört dieser Wiederholschlüssel schon jemandem?" und „abgelegt" gibt es
   * kein `await`, an dem ein zweiter Lauf das Wort bekäme. Was Postgres die Transaktion mit ihrem
   * Unique-Schlüssel ist (`kanten-repo-pg.ts`), ist hier diese Lückenlosigkeit.
   *
   * DASS DER SCHLÜSSEL AN SEINE BEZIEHUNG GEBUNDEN IST, prüft `pruefeSchluesselBindung` — dieselbe
   * Funktion, die der Postgres-Bestand ruft. Eine hier abgeschriebene Fassung wäre die zweite
   * Auslegung derselben Zusage, und sie liefe genau dann auseinander, wenn eine von beiden
   * nachgezogen wird und die andere nicht.
   */
  async setzeMitBindung(kante: KuratierteKante, beitragSchluessel: string): Promise<KanteGesetzt> {
    return this.sperre.fuehre(async () => {
      const gebunden = this.findeNachBeitrag(beitragSchluessel);
      if (gebunden) {
        pruefeSchluesselBindung(gebunden, kante);
        // NICHTS geschrieben — und die Antwort sagt es. `fortgeschrieben` wäre hier die bequeme
        // Verallgemeinerung, die eine Fortschreibung behauptete, die es nicht gab.
        return { kante: gebunden, ergebnis: "wiederholt" as const };
      }
      const vorher = this.nachBeziehung.size;
      const abgelegt = this.lege(mitBeitragSchluessel(kante, beitragSchluessel), {});
      return {
        kante: abgelegt,
        // Woran man die beiden unterscheidet: eine NEUE Beziehung vergrössert den Bestand, eine
        // fortgeschriebene nicht. An der Kennung wäre es ebenfalls ablesbar — aber nur solange
        // der Aufrufer eine frische mitbringt, und das ist eine Annahme über ihn, nicht über hier.
        ergebnis:
          this.nachBeziehung.size > vorher ? ("angelegt" as const) : ("fortgeschrieben" as const),
      };
    });
  }

  /** Der Rumpf des Setzens, synchron und OHNE Sperre — nur von dieser Klasse gerufen. */
  private lege(kante: KuratierteKante, opts: { erwarteteVersion?: number }): KuratierteKante {
    // JOB 1543 D1 (SCRUM-546): AM EINGANG abgewiesen, nicht still verschluckt. Ein stilles Ignorieren
    // hieße, dass ein Kurator seine Beziehung gesetzt glaubt, während der Bestand leer bleibt — und
    // die Kuratierung ist eine Urheberaussage, über deren Verbleib niemand raten soll.
    // JOB 4151: derselbe Wurf, jetzt mit Code (`KantenError`) — ein nacktes `Error` endet am Draht
    // im generischen 500 und ist dort von einem Infrastrukturfehler nicht zu unterscheiden.
    if (istSelbstbeziehung(kante)) {
      throw new KantenError("VALIDATION", SELBSTBEZIEHUNG_MELDUNG);
    }
    const kanonisch = kanonischesPaar(kante);
    const schluessel = beziehungsSchluessel(kanonisch);
    const vorhanden = this.nachBeziehung.get(schluessel);
    // JOB 4151: die optimistische Sperre, VOR jeder Änderung und mit derselben Auslegung wie im
    // Postgres-Bestand (`pruefeErwarteteVersion` steht genau einmal, in `kanten-service.ts`).
    pruefeErwarteteVersion(vorhanden, opts.erwarteteVersion);

    if (vorhanden === undefined) {
      const neu = { ...kanonisch };
      this.nachBeziehung.set(schluessel, neu);
      return neu;
    }

    const fortgeschrieben = {
      ...kanonisch,
      id: vorhanden.id,
      urheber: vorhanden.urheber,
      gesetztAm: vorhanden.gesetztAm,
      version: vorhanden.version + 1,
      // JOB 4151: die Wiederholschlüssel SAMMELN sich, sie ersetzen einander nicht. Ein
      // überschriebener Schlüssel wäre eine Idempotenzzusage, die beim nächsten Beitrag eines
      // anderen Menschen still abläuft — die Begründung steht ausgeschrieben an
      // `KuratierteKante.beitragSchluessel` (kanten-types.ts).
      beitragSchluessel: vereinigeSchluessel(vorhanden, kanonisch),
    };
    this.nachBeziehung.set(schluessel, fortgeschrieben);
    return fortgeschrieben;
  }

  async holeNachBeitrag(beitragSchluessel: string): Promise<KuratierteKante | undefined> {
    return this.findeNachBeitrag(beitragSchluessel);
  }

  /**
   * Derselbe Nachschlag, synchron — die Bindung lebt in den Schlüssellisten der Kanten selbst.
   *
   * Sie ist damit dasselbe wie die Schlüsseltabelle des Postgres-Bestands, nur ohne Tabelle: die
   * Listen SAMMELN (`vereinigeSchluessel`), ein Schlüssel wandert also nie von einer Beziehung zu
   * einer anderen — und der einzige Weg, ihn überhaupt zu vergeben, führt über `setzeMitBindung`.
   */
  private findeNachBeitrag(beitragSchluessel: string): KuratierteKante | undefined {
    return [...this.nachBeziehung.values()].find((k) =>
      (k.beitragSchluessel ?? []).includes(beitragSchluessel),
    );
  }

  async fuerKos(koIds: readonly string[]): Promise<readonly KuratierteKante[]> {
    const menge = new Set(koIds);
    return entdoppelt(
      [...this.nachBeziehung.values()].filter((k) => menge.has(k.quelleId) || menge.has(k.zielId)),
    );
  }

  async alleAktiven(): Promise<readonly KuratierteKante[]> {
    return [...this.nachBeziehung.values()].filter((k) => k.status === "aktiv");
  }

  /**
   * Die Beziehung zu IHRER Kennung. Der Index ist der Beziehungsschlüssel (s. oben), die Kennung
   * ist es ausdrücklich nicht — deshalb ist dies ein Durchlauf und kein Griff. Für den Prüfstand
   * und den Entwicklungsbetrieb ist das die richtige Größe; wer Bestände dieser Art in Größe fährt,
   * nimmt den Postgres-Bestand, der genau dafür einen Primärschlüssel hat.
   */
  async hole(id: string): Promise<KuratierteKante | undefined> {
    return [...this.nachBeziehung.values()].find((k) => k.id === id);
  }

  /**
   * Alle Beziehungen, an denen `koId` beteiligt ist — ungetrimmt und OHNE Sichtbarkeitsurteil.
   *
   * Das Trimmen ist Sache des Lesedienstes (`KantenLeseService`), und zwar dort an genau einer
   * Stelle. Ein Bestand, der selbst filtert, wäre die zweite Rechteauslegung, gegen die das ganze
   * Modul gebaut ist.
   *
   * Widerrufene Beziehungen bleiben enthalten: `widerrufen` ist eine Urheberaussage, keine
   * Löschung (kanten-types.ts). Wer sie aus dem Bestand entfernte, könnte später nicht mehr
   * unterscheiden, ob jemand zurückgenommen hat oder ob es die Beziehung nie gab.
   */
  async fuerKo(koId: string): Promise<readonly KuratierteKante[]> {
    return Promise.resolve(
      [...this.nachBeziehung.values()].filter((k) => k.quelleId === koId || k.zielId === koId),
    );
  }

  /** Wie viele verschiedene Beziehungen der Bestand führt — für Prüfstände und Zähler. */
  async anzahl(): Promise<number> {
    return Promise.resolve(this.nachBeziehung.size);
  }
}
