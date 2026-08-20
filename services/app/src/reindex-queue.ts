// ================================================================================================
// JOB 1163 — DIE REINDEX-WARTESCHLANGE. DREI ZUSAGEN, SONST NICHTS.
// ================================================================================================
//
// D2 (BEN-Korrekturpflicht): Der MELDEWEG ist jetzt lueckenlos. `onError` ist eine ZWINGENDE
// Abhaengigkeit — die Konstruktion ohne Fehlerempfaenger gibt es nicht mehr, weder typseitig noch
// zur Laufzeit. Serialitaet und Nichtblockieren sind unveraendert aus D1 uebernommen.
//
// GEGENSTAND, woertlich aus BENs Wuerdigung des verlorenen JOB-556-D4-Standes: „eine **serielle**
// Warteschlange, die den **Aufrufer nicht blockiert** und **Fehler eines Eintrags isoliert**".
// Genau diese drei Eigenschaften stehen hier, jede einzeln in `reindex-queue.test.ts` gemessen.
//
// WAS HIER AUSDRUECKLICH NICHT ENTSTEHT (Auftrag §5.6, BENs Abgrenzung im D4-Urteil):
//   · kein dauerhafter Store und keine Nachfuellung — die Schlange lebt nur im Speicher;
//   · keine Verdrahtung an Revision oder Vertraulichkeitsaenderung;
//   · KEINE Wahl zwischen Service-Hook und Routenanschluss. Diese Anschlusswahl ist laut BEN
//     „weiterhin nicht freigegeben"; dieses Stueck praejudiziert sie nicht. Es wird deshalb auch
//     nirgends registriert — `build-app.ts` bleibt unberuehrt.
//
// DIE NEUSTART-GRENZE, ehrlich benannt wie beim Nachbarn `ai-check-worker.ts`: Stirbt der Prozess,
// sind die wartenden Eintraege weg. Es gibt keinen Cron und keine Nachfuelllogik — das WAERE der
// dauerhafte Store, und der ist ausdruecklich nicht Gegenstand dieses Durchgangs.
//
// WAS EIN REINDEX IST, WEISS DIESE DATEI NICHT. Sie bekommt ihn als Abhaengigkeit herein. Das ist
// keine Bequemlichkeit, sondern die Scopegrenze in Codeform: Wer die Reindexfunktion mitbringt,
// entscheidet auch, woher die Kennungen kommen — und diese Entscheidung ist nicht freigegeben.

/**
 * GENAU EIN Eintrag gleichzeitig. Als benannte Konstante und nicht als Zahl im Code, damit die
 * Zusage einen Namen hat — dieselbe Form wie `AI_CHECK_CONCURRENCY` beim Nachbarn.
 */
export const REINDEX_CONCURRENCY = 1;

export interface ReindexQueueDeps {
  /** Was mit EINEM Eintrag geschieht. Bringt der Aufrufer mit; die Schlange kennt den Inhalt nicht. */
  readonly reindex: (koId: string) => Promise<void>;
  /**
   * ZWINGEND (JOB 1163 D2). Ein fehlgeschlagener Eintrag wird HIER gemeldet.
   *
   * IN D1 STAND HIER EIN FRAGEZEICHEN, und das war der Fehler. Ein optionaler Melder heisst: Es
   * gibt eine zulaessige, typkorrekte Warteschlange, in der Fehler lautlos verschwinden — genau
   * das, was die Fehlerisolation verhindern soll. Sie isoliert, sie verschweigt nicht.
   *
   * Das Pflichtfeld ist die staerkere der beiden zugelassenen Antworten: nicht „irgendwo landet
   * der Fehler schon", sondern „eine Schlange ohne Empfaenger gibt es nicht". Es macht die
   * Entscheidung ausserdem am Aufrufort SICHTBAR — wer wirklich schweigen will, muss es
   * hinschreiben, statt es zu erben.
   */
  readonly onError: (koId: string, fehler: unknown) => void;
}

export interface ReindexQueue {
  /** Reiht einen Eintrag ein und gibt SOFORT zurueck — feuern und vergessen. */
  enqueue(koId: string): void;
  /** Wartende plus der gerade laufende Eintrag. */
  queuedCount(): number;
  /** Fuer Tests und geordnetes Herunterfahren: aufgeloest, sobald nichts mehr wartet oder laeuft. */
  idle(): Promise<void>;
}

/**
 * Nur die FEHLERKLASSE, nie der Fehlertext.
 *
 * Eine Fehlermeldung kann Inhalte tragen; der letzte Ausgang unten schreibt auf stderr und darf
 * deshalb nichts durchreichen, was Wissen sein koennte. Dieselbe Hausregel wie beim Nachbarn
 * `ai-check-worker.ts`, der aus einer Meldung nur die KLASSE liest und nie den Rohtext ausgibt.
 */
function klasseVon(fehler: unknown): string {
  return fehler instanceof Error ? fehler.name : typeof fehler;
}

export function createReindexQueue(deps: ReindexQueueDeps): ReindexQueue {
  // Die Typschranke oben haelt jeden TypeScript-Aufrufer. Diese Zeile haelt auch den, der sie mit
  // `as` umgeht oder aus reinem JavaScript kommt — dort gilt kein Typvertrag. Fail-fast bei der
  // KONSTRUKTION, nicht erst beim ersten Fehler: Eine Schlange, die erst im Schadensfall merkt,
  // dass sie niemandem berichten kann, hat den Bericht schon verloren.
  if (typeof deps.onError !== "function") {
    throw new TypeError(
      "createReindexQueue: onError ist Pflicht — eine Warteschlange ohne Fehlerempfaenger verschluckt Fehler.",
    );
  }

  const wartend: string[] = [];
  // Der EINE laufende Eintrag — `undefined` heisst: die Schlange ist frei. Ein Zaehler taete es
  // auch; die Kennung ist mehr wert, weil `queuedCount` damit ehrlich mitzaehlt, was gerade laeuft.
  let laufend: string | undefined;
  let idleAufloeser: (() => void)[] = [];

  const meldeLeerlauf = (): void => {
    if (laufend !== undefined || wartend.length > 0) {
      return;
    }
    // Erst leeren, dann aufloesen: ein Aufloeser, der synchron erneut einreiht, soll nicht in die
    // Liste zurueckschreiben, die gerade abgearbeitet wird.
    const aufloeser = idleAufloeser;
    idleAufloeser = [];
    for (const aufloesen of aufloeser) {
      aufloesen();
    }
  };

  /**
   * DER LETZTE AUSGANG (JOB 1163 D2): Auch ein Melder kann scheitern.
   *
   * Wirft `onError` selbst, faellt der urspruengliche Fehler ohne diese Klammer als unbehandelte
   * Zurueckweisung aus dem `void`-Aufruf heraus — also genau in das lautlose Verschwinden zurueck,
   * das der Meldevertrag ausschliessen soll. Ein Melder darf ausfallen; der Bericht darf es nicht.
   *
   * Das ist KEIN zweiter Meldeweg neben dem Pflichtfeld: Im Normalbetrieb feuert diese Zeile nie.
   * Sie ist die Notbremse fuer den Fall, dass der bestellte Empfaenger kaputt ist.
   */
  const melde = (koId: string, fehler: unknown): void => {
    try {
      deps.onError(koId, fehler);
    } catch (melderFehler) {
      process.stderr.write(
        `[KLARWERK] Reindex ko=${koId} fehlgeschlagen (${klasseVon(fehler)}) — und der Melder ` +
          `scheiterte selbst (${klasseVon(melderFehler)}). Beide Fehler waeren sonst verloren.\n`,
      );
    }
  };

  /**
   * ZUSAGE 3 — FEHLERISOLATION. Der Fehler wird gemeldet und endet hier.
   *
   * `catch` und nicht `finally`, und ausdruecklich OHNE Weiterwerfen: Ein durchgereichter Fehler
   * wuerde die Kette unten (`.finally` in `pumpe`) zwar noch weiterlaufen lassen, aber als
   * unbehandelte Zurueckweisung aus dem `void`-Aufruf herausfallen — und niemand haette ihn
   * gesehen. „Gemeldet, nicht verschluckt" heisst beides: er verschwindet nicht still, und er
   * reisst auch nichts mit.
   *
   * Das `await` im `try` faengt BEIDE Wuerfe: die verworfene Zusage UND den synchronen Wurf vor
   * dem ersten `await` in `reindex`. Es gibt also keinen dritten Eintrittsweg, der daran vorbei
   * liefe.
   */
  const verarbeite = async (koId: string): Promise<void> => {
    try {
      await deps.reindex(koId);
    } catch (fehler) {
      melde(koId, fehler);
    }
  };

  /**
   * ZUSAGE 1 — SERIELL. Die Waechterzeile ist `laufend !== undefined`.
   *
   * Solange ein Eintrag laeuft, kehrt jeder weitere Pumpversuch sofort zurueck; der naechste
   * startet erst aus dem `finally` des vorherigen. Damit gibt es zu keinem Zeitpunkt zwei
   * gleichzeitige Laeufe, und die Reihenfolge ist die Einreihungsfolge — `wartend` ist eine
   * schlichte FIFO-Liste.
   */
  const pumpe = (): void => {
    if (laufend !== undefined || wartend.length === 0) {
      meldeLeerlauf();
      return;
    }
    const koId = wartend.shift() as string;
    laufend = koId;
    // `.finally` und nicht `.then`: Die Fortsetzung der Schlange haengt NICHT davon ab, dass
    // `verarbeite` fehlerfrei zurueckkommt. Selbst wenn dort eines Tages doch etwas durchkaeme,
    // laeuft die Schlange weiter — die Isolation liegt dann zweifach, nicht einfach.
    void verarbeite(koId).finally(() => {
      laufend = undefined;
      pumpe();
    });
  };

  return {
    /**
     * ZUSAGE 2 — NICHT BLOCKIEREND. `queueMicrotask` ist hier die ganze Zusage.
     *
     * Der Nachbar `ai-check-worker.ts` pumpt synchron; das ist eine bewusste Abweichung und kein
     * Versehen. Ein synchroner Pump fuehrt den ANFANG von `reindex` noch im Aufrufer aus — alles
     * bis zu dessen erstem `await`. Fuer einen HTTP-Weg heisst das: die Antwort wartet auf einen
     * Teil der Arbeit, obwohl sie es nicht muesste. Mit der Verschiebung auf den Microtask kehrt
     * `enqueue` zurueck, BEVOR irgendetwas an der Arbeit begonnen hat.
     *
     * Die Reihenfolge leidet nicht darunter: Mehrere Einreihungen planen mehrere Pumpversuche,
     * aber `wartend` bleibt FIFO und die Waechterzeile in `pumpe` laesst nur einen davon ziehen.
     */
    enqueue(koId: string): void {
      wartend.push(koId);
      queueMicrotask(pumpe);
    },
    queuedCount(): number {
      return wartend.length + (laufend === undefined ? 0 : 1);
    },
    idle(): Promise<void> {
      if (laufend === undefined && wartend.length === 0) {
        return Promise.resolve();
      }
      return new Promise((aufloesen) => {
        idleAufloeser.push(aufloesen);
      });
    },
  };
}
