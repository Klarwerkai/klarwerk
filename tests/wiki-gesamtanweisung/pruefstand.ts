// ================================================================================================
// JOB 4154 · DER PRÜFSTAND DER GESAMTANWEISUNG — UND WARUM ER HIER WOHNT UND NICHT IM PRODUKT.
// ================================================================================================
//
// Der Auftrag ist ausdrücklich: „Das In-Memory-Repo lebt NUR hier als Testdouble, nie im
// Produktmodul." Der Grund ist nicht Ordnungsliebe: eine zweite Ablage im Produktmodul kann in der
// Kompositionswurzel versehentlich gebunden werden, und dann läuft der Betrieb auf einem Bestand,
// der beim Neustart verschwindet. Genau deshalb verlangt die Lieferung eine echte Postgres-Ablage.
//
// WAS HIER NICHT ENTSTEHT: kein zweiter Regelsatz. Dieses Double speichert und gibt zurück, sonst
// nichts — jede Regel (Version, Reihenfolge, Rechte, Stand) kommt aus dem Produktcode. Ein Double
// mit eigener Logik würde eine Lieferung prüfen, die es gar nicht gibt.
import {
  type AnweisungFassungssatz,
  type AnweisungKoFakten,
  type AnweisungKoLeser,
  GesamtanweisungDienst,
} from "../../services/knowledge-object/src/gesamtanweisung-service";
import {
  type Anweisung,
  type AnweisungRepo,
  type AnweisungSichtbar,
  type AnweisungStandAufnahme,
  anweisungFehler,
} from "../../services/knowledge-object/src/gesamtanweisung-types";

export class InMemoryAnweisungRepo implements AnweisungRepo {
  private readonly bestand = new Map<string, Anweisung>();
  private readonly staendeBestand = new Map<string, AnweisungStandAufnahme>();
  /** Zählt die wirklich ausgeführten Schreibvorgänge — der Bestandsnachweis der Gegenproben. */
  schreibvorgaenge = 0;

  async get(id: string): Promise<Anweisung | undefined> {
    const treffer = this.bestand.get(id);
    // Eine Kopie: sonst hielte der Aufrufer eine Referenz auf den Bestand und könnte ihn
    // versehentlich an der Ablage vorbei ändern — im Test wäre das ein falsches Grün.
    return treffer ? structuredClone(treffer) : undefined;
  }

  /**
   * Ein Riegel, den Tests setzen dürfen: der nächste Historien-Schreibvorgang scheitert.
   *
   * Damit lässt sich OHNE Datenbank prüfen, was die Postgres-Transaktion zusichert — dass bei
   * einem Fehler am Prüfstand auch der Bestand nicht stehen bleibt.
   */
  pruefstandScheitertEinmal = false;

  async anlegen(anweisung: Anweisung, aufnahme: AnweisungStandAufnahme): Promise<void> {
    if (this.bestand.has(anweisung.id)) {
      throw anweisungFehler("CONFLICT", "Diese Anweisung gibt es bereits.");
    }
    this.atomar(anweisung, aufnahme);
  }

  /** Compare-and-Set wie in Postgres: greift NUR auf der erwarteten Version. */
  async schreiben(
    anweisung: Anweisung,
    erwartet: number,
    aufnahme: AnweisungStandAufnahme,
  ): Promise<void> {
    const vorhanden = this.bestand.get(anweisung.id);
    if (!vorhanden) {
      throw anweisungFehler("NOT_FOUND", "Diese Anweisung gibt es nicht.");
    }
    if (vorhanden.version !== erwartet) {
      throw anweisungFehler(
        "CONFLICT",
        "Die Anweisung wurde zwischenzeitlich geändert — bitte erneut lesen.",
        { stand: vorhanden.stand, version: vorhanden.version },
      );
    }
    this.atomar(anweisung, aufnahme);
  }

  /**
   * Bestand UND Prüfstand — beides oder nichts.
   *
   * DAS DOUBLE MUSS DIESELBE ZUSAGE GEBEN WIE POSTGRES, sonst prüfen die Fachtests etwas anderes
   * als den Betrieb. `PgAnweisungRepo` klammert beides in `withPgTx`; hier wird der Prüfstand
   * deshalb ZUERST versucht und der Bestand erst danach gesetzt. Scheitert der Prüfstand, ist am
   * Bestand noch nichts geschehen — dieselbe beobachtbare Wirkung wie ein Rollback.
   */
  private atomar(anweisung: Anweisung, aufnahme: AnweisungStandAufnahme): void {
    if (this.pruefstandScheitertEinmal) {
      this.pruefstandScheitertEinmal = false;
      throw new Error("Prüfstand konnte nicht festgehalten werden (Riegel des Prüfstands).");
    }
    const schluessel = `${aufnahme.anweisungId}@${aufnahme.version}`;
    if (!this.staendeBestand.has(schluessel)) {
      this.staendeBestand.set(schluessel, structuredClone(aufnahme));
    }
    this.bestand.set(anweisung.id, structuredClone(anweisung));
    this.schreibvorgaenge += 1;
  }

  async standLesen(
    anweisungId: string,
    version: number,
  ): Promise<AnweisungStandAufnahme | undefined> {
    return this.staendeBestand.get(`${anweisungId}@${version}`);
  }

  async staende(anweisungId: string): Promise<readonly number[]> {
    return [...this.staendeBestand.values()]
      .filter((a) => a.anweisungId === anweisungId)
      .map((a) => a.version)
      .sort((a, b) => a - b);
  }

  /**
   * Der BESTANDSABDRUCK — die Lehre aus JOB 4141 R1.
   *
   * „Ein `bestand`-Feld zählt erst als Nachweis, wenn seine Vorher-/Nachher-Werte tatsächlich
   * verglichen werden." Dieser Abdruck ist deshalb vollständig und deterministisch: Kopf, Stand,
   * Version UND die geordnete Bausteinfolge jeder Anweisung. Ein 403, nach dem sich trotzdem etwas
   * geändert hat, fällt damit auf — und die Gegenprobe in F3 führt genau das herbei.
   */
  abdruck(): string {
    return JSON.stringify(
      [...this.bestand.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, a]) => [
          id,
          a.version,
          a.stand,
          a.titel,
          a.zweck,
          a.geltungsbereich,
          a.voraussetzungen,
          a.bausteine.map((b) => [
            b.id,
            b.position,
            b.koId,
            b.koVersion,
            b.nachweisHash,
            b.voraussetzung ?? null,
          ]),
        ]),
    );
  }
}

// ================================================================================================
// DIE EINTRÄGE
// ================================================================================================

export interface PruefEintrag extends AnweisungKoFakten {
  readonly fassungen: readonly AnweisungFassungssatz[];
}

export function eintrag(
  over: Partial<AnweisungKoFakten> & { readonly id: string },
  fassungen: readonly Partial<AnweisungKoFakten & { version: number; at: string }>[] = [],
): PruefEintrag {
  const basis: AnweisungKoFakten = {
    id: over.id,
    title: over.title ?? `Eintrag ${over.id}`,
    status: over.status ?? "offen",
    version: over.version ?? 1,
    author: over.author ?? "anna",
    category: over.category ?? "Anlage 1",
    ...(over.confidentiality === undefined ? {} : { confidentiality: over.confidentiality }),
    ...(over.bodyHtml === undefined ? {} : { bodyHtml: over.bodyHtml }),
  };
  const saetze: AnweisungFassungssatz[] = fassungen.map((f) => ({
    version: f.version ?? 1,
    at: f.at ?? `2026-09-0${f.version ?? 1}T09:00:00.000Z`,
    author: f.author ?? basis.author,
    snapshot: { ...basis, ...f, version: f.version ?? 1 },
  }));
  return { ...basis, fassungen: saetze };
}

/** Der Leser über eine feste Menge Einträge. `versionsOf` wirft wie `KoService` bei Unbekanntem. */
export function koLeser(eintraege: readonly PruefEintrag[]): AnweisungKoLeser {
  const nach = new Map(eintraege.map((e) => [e.id, e]));
  return {
    async get(id) {
      const treffer = nach.get(id);
      if (!treffer) {
        return undefined;
      }
      const { fassungen: _fassungen, ...fakten } = treffer;
      return fakten;
    },
    async versionsOf(id) {
      const treffer = nach.get(id);
      if (!treffer) {
        throw new Error(`Unbekannter Eintrag: ${id}`);
      }
      return treffer.fassungen;
    },
  };
}

// ================================================================================================
// DIE RECHTEENTSCHEIDUNG DES PRÜFSTANDS
// ================================================================================================

/**
 * Die Regel von `darfSehen` (`services/app/src/sichtbarkeit.ts:67`), auf den Prüfstand übertragen:
 * nicht vertraulich → sichtbar; vertraulich → nur Prüfberechtigte oder der Autor.
 *
 * Sie steht hier NUR, damit die Dienstschicht ohne HTTP geprüft werden kann. Die echte Entscheidung
 * trifft die Route (F8 prüft sie am Draht, mit dem echten `darfSehen`).
 */
export function sichtbarAls(options: {
  readonly id: string;
  readonly darfPruefen: boolean;
}): AnweisungSichtbar {
  return (fakten) => {
    const vertraulich =
      fakten.confidentiality === "vertraulich" || fakten.confidentiality === "streng_vertraulich";
    if (!vertraulich) {
      return true;
    }
    return options.darfPruefen || fakten.author === options.id;
  };
}

/** Eine Uhr, die bei jedem Aufruf einen Schritt weitergeht — deterministisch und unterscheidbar. */
export function uhr(start = 0): () => string {
  let n = start;
  return () => {
    n += 1;
    return `2026-09-15T12:00:${String(n).padStart(2, "0")}.000Z`;
  };
}

/** Fortlaufende Kennungen — keine Zufallswerte in Prüfständen. */
export function kennungen(praefix: string): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${praefix}-${n}`;
  };
}

/** Der ECHTE Dienst über dem Double — kein nachgebautes Verhalten, nur ein anderer Bestand. */
export function bauDienst(eintraege: readonly PruefEintrag[]): {
  dienst: GesamtanweisungDienst;
  repo: InMemoryAnweisungRepo;
} {
  const repo = new InMemoryAnweisungRepo();
  const dienst = new GesamtanweisungDienst({
    repo,
    ko: koLeser(eintraege),
    jetzt: uhr(),
    kennung: kennungen("b"),
  });
  return { dienst, repo };
}
