import { randomUUID } from "node:crypto";
import {
  type KnowledgeObject,
  type KoService,
  anlagenVon,
  normalizeAsset,
} from "../../knowledge-object";
import type { LifecycleRepo } from "./repo";
import {
  type LearningPath,
  type LearningStep,
  type OffenerFall,
  type RevalidierungsGrund,
  anlassSignatur,
} from "./types";

// R-1635 / ADMIN-10: der Grund einer Markierung — die eine Definition steht in `./types`
// (inzwischen samt „rueckmeldung" aus der Qualitätsübersicht).
export type { RevalidierungsGrund } from "./types";

/**
 * produkt:20261010:aenderungsfolgen-sichtbar: eine Bestätigung nennt einen Stand, der nicht (mehr)
 * offen ist. Domänencode `STAND_VERALTET` → 409 (http.ts): der Aufrufer hat nichts falsch gemacht,
 * er hält nur einen Stand in der Hand, der sich bewegt hat.
 */
export class FolgepruefungStandError extends Error {
  readonly code = "STAND_VERALTET";
  constructor(
    message: string,
    /** Der jetzt offene Stand — `null`, wenn der Fall inzwischen abgeschlossen ist. */
    readonly aktuellerStand: number | null,
  ) {
    super(message);
    this.name = "FolgepruefungStandError";
  }
}

/** Ergebnis einer Markierung je betroffenem Eintrag. */
export interface Markierung {
  koId: string;
  stand: number;
  /** `false`: dasselbe Signal stand schon am offenen Fall — kein neuer Anlass, kein neuer Beleg. */
  neu: boolean;
}

/**
 * R-1635: der Beleg einer Markierung — eine Zeile je markiertem Objekt im Prüfprotokoll
 * (`lifecycle.revalidation-requested`). Aus ihm stellt die Glocke dem Autor bzw. seinem
 * Nachfolger die Benachrichtigung zu (services/app/src/frische-meldungen.ts). Strukturell
 * getippt, damit dieses Modul den Auditdienst nicht importieren muss.
 */
export interface RevalidierungsBeleg {
  record(input: {
    actor: string;
    action: string;
    target: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

/** Der Prüfprotokoll-Vorgang einer Markierung (R-1635). */
export const REVALIDIERUNG_ANGEFORDERT = "lifecycle.revalidation-requested";

const STAND_GEAENDERT =
  "Seit der Anzeige ist eine weitere Änderung eingegangen. Bitte den aktuellen Stand prüfen.";
const STAND_ABGESCHLOSSEN = "Diese Folgeprüfung ist bereits abgeschlossen.";
const STAND_FEHLT =
  "Für diesen Eintrag ist eine Folgeprüfung offen. Bitte neu laden und den angezeigten Stand prüfen.";

/** Wirft, wenn `fall` nicht genau den gesehenen Stand offen hat. */
function pruefeStand(fall: OffenerFall | undefined, geprueftStand: number): void {
  if (!fall) {
    throw new FolgepruefungStandError(STAND_ABGESCHLOSSEN, null);
  }
  if (fall.stand !== geprueftStand) {
    throw new FolgepruefungStandError(STAND_GEAENDERT, fall.stand);
  }
}

export interface LifecycleServiceDeps {
  koService: KoService;
  repo: LifecycleRepo;
  genId?: () => string;
  // R-1635: ohne Beleg wird weiter markiert, nur ohne Benachrichtigungsgrundlage (Altaufbau, Tests).
  audit?: RevalidierungsBeleg;
  /** Zeitquelle der Anlässe (ms). Vorgabe `Date.now`. */
  uhr?: () => number;
}

/**
 * JOB 3054: die Merkergrenze, wie ein LESEPFAD sie sehen darf — genau eine schreibfreie Frage.
 *
 * Der Anzeigestatus-Lesepfad braucht vom Lebenszyklusmodul nichts weiter. Nimmt er die Grenze in
 * dieser Form entgegen, kann er `pendingRevalidation()`, `confirmStillValid()` oder `assetChanged()`
 * dort gar nicht erst erreichen — die Zusage „ein Lesepfad schreibt nicht" hält damit der Compiler
 * und nicht eine Sichtprüfung.
 */
export interface RevalidierungMerkerLeser {
  revalidierungAnstehtFuer(koIds: readonly string[]): Promise<ReadonlySet<string>>;
}

export class LifecycleService implements RevalidierungMerkerLeser {
  private readonly koService: KoService;
  private readonly repo: LifecycleRepo;
  private readonly genId: () => string;
  private readonly audit: RevalidierungsBeleg | undefined;
  private readonly uhr: () => number;

  constructor(deps: LifecycleServiceDeps) {
    this.koService = deps.koService;
    this.repo = deps.repo;
    this.genId = deps.genId ?? (() => randomUUID());
    this.audit = deps.audit;
    this.uhr = deps.uhr ?? Date.now;
  }

  // R-1635: setzt den Merker und hält je Objekt fest, wer ihn warum gesetzt hat. Der Beleg ist die
  // Grundlage der Benachrichtigung an Autor bzw. Nachfolger; er trägt keinen Inhalt des Objekts.
  //
  // produkt:20261010:aenderungsfolgen-sichtbar: je Objekt EIN Anlass am offenen Fall — mit der
  // Fassung, die das Objekt beim Eingang hatte. Ein Signal, das genau so schon am offenen Fall steht
  // (gleiche Signatur), ändert nichts: kein neuer Stand, kein zweiter Beleg, also auch keine zweite
  // Glockenmeldung und keine doppelte Aufgabe. Der Prüfprotokolleintrag behält seine bisherige Form;
  // nur ein mitgegebener Änderungsbeleg (`aenderung`) kommt hinzu.
  private async markiere(
    eintraege: readonly { koId: string; assetRef?: string }[],
    actor: string,
    payload: {
      grund: RevalidierungsGrund;
      assetRef?: string;
      ausgeloestVon?: string;
      ausgeloestVonVersion?: number;
      aenderung?: string;
      // ADMIN-10: die übernommene Rückmeldung (Grund „rueckmeldung").
      meldungId?: string;
    },
  ): Promise<Markierung[]> {
    const am = new Date(this.uhr()).toISOString();
    const ergebnis: Markierung[] = [];
    for (const { koId, assetRef } of eintraege) {
      const anlage = assetRef ?? payload.assetRef;
      const koVersion = (await this.koService.get(koId))?.version;
      const kern = {
        grund: payload.grund,
        ...(anlage !== undefined ? { assetRef: anlage } : {}),
        ...(payload.aenderung !== undefined ? { aenderung: payload.aenderung } : {}),
        ...(payload.ausgeloestVon !== undefined ? { ausgeloestVon: payload.ausgeloestVon } : {}),
        ...(payload.ausgeloestVonVersion !== undefined
          ? { ausgeloestVonVersion: payload.ausgeloestVonVersion }
          : {}),
        ...(payload.meldungId !== undefined ? { meldungId: payload.meldungId } : {}),
      };
      const { stand, neu } = await this.repo.markPending(koId, {
        ...kern,
        am,
        von: actor,
        ...(koVersion !== undefined ? { koVersion } : {}),
        signatur: anlassSignatur(kern),
      });
      ergebnis.push({ koId, stand, neu });
      if (!neu) {
        continue;
      }
      await this.audit?.record({
        actor,
        action: REVALIDIERUNG_ANGEFORDERT,
        target: koId,
        payload: {
          grund: payload.grund,
          ...(payload.ausgeloestVon !== undefined ? { ausgeloestVon: payload.ausgeloestVon } : {}),
          ...(payload.assetRef !== undefined ? { assetRef: payload.assetRef } : {}),
          ...(payload.aenderung !== undefined ? { aenderung: payload.aenderung } : {}),
          // ADMIN-10: der Beleg nennt die übernommene Rückmeldung (wie in `main`).
          ...(payload.meldungId !== undefined ? { meldungId: payload.meldungId } : {}),
        },
      });
    }
    return ergebnis;
  }

  // ============================================================================================
  // Nacharbeit 4 (Ben, K1) — DIE KANONISCHE KO-ANLAGENZUORDNUNG IST DIE EINZIGE QUELLE.
  // ============================================================================================
  //
  // Bis hierher entschied `lifecycle_couplings` allein über Betroffenheit — eine zweite Zuordnung
  // neben `asset`/`assets` am Objekt (JOB 593, R-0082). Ein nur kanonisch zugeordneter Eintrag wurde
  // übersehen; ein umgehängter oder entkoppelter blieb an der alten Anlage hängen. Jetzt:
  //   · betroffen ist, wessen `anlagenVon(ko)` die gemeldete Anlage (Normalform) enthält;
  //   · `couple` schreibt in genau diese Zuordnung (`KoService.ordneAnlageZu`, belegt);
  //   · die Rück-Richtung fürs Detail liest dieselbe Zuordnung.
  // `lifecycle_couplings` wird weder gelesen noch geschrieben (Altbestand, s. Rückgabe).
  private async traegerVon(assetRef: string): Promise<string[]> {
    const anlage = normalizeAsset(assetRef);
    if (anlage === null) {
      return [];
    }
    return (await this.koService.list({}))
      .filter((ko) => anlagenVon(ko).includes(anlage))
      .map((ko) => ko.id);
  }

  // FR-LIF-01: Anlagen-/Prozesskopplung — als kanonische Anlagenzuordnung des Objekts.
  async couple(assetRef: string, koId: string, actor = "system"): Promise<void> {
    await this.koService.ordneAnlageZu(koId, assetRef, actor);
  }

  // FR-LIF-01 / Audit B1: gekoppelte Anlagen eines KOs (fürs KO-Detail sichtbar machen).
  async couplingsForKo(koId: string): Promise<string[]> {
    const ko = await this.koService.get(koId);
    return ko ? anlagenVon(ko) : [];
  }

  // FR-LIF-01: Anlagenänderung markiert gekoppelte KOs „Stimmt das noch?". R-1635: mit Beleg je
  // Objekt (`actor` = wer die Änderung gemeldet hat), damit Autor bzw. Nachfolger erfährt, dass
  // sein Wissen geprüft werden soll.
  async assetChanged(assetRef: string, actor = "system", aenderung?: string): Promise<string[]> {
    return (await this.meldeAnlagenaenderung(assetRef, actor, aenderung)).map((m) => m.koId);
  }

  /**
   * produkt:20261010:aenderungsfolgen-sichtbar: dieselbe Anlagenänderung wie `assetChanged`, mit
   * Auskunft je Eintrag, ob das Signal neu war. Betroffen ist, wem die Anlage kanonisch zugeordnet
   * ist (`asset`/`assets`) — keine Ähnlichkeitssuche, keine zweite Zuordnung.
   */
  async meldeAnlagenaenderung(
    assetRef: string,
    actor = "system",
    aenderung?: string,
  ): Promise<Markierung[]> {
    const koIds = await this.traegerVon(assetRef);
    return this.markiere(
      koIds.map((koId) => ({ koId })),
      actor,
      { grund: "anlage", assetRef, ...(aenderung !== undefined ? { aenderung } : {}) },
    );
  }

  // aufnahme:20260922:gesamt-wissen-frische (R-0203) — DER AUSLÖSER ÜBER BENACHBARTE WISSENSOBJEKTE.
  //
  // Wer an EINEM Wissensobjekt merkt, dass sich seine Anlage geändert hat, meldet das dort einmal:
  // jede an das Objekt gekoppelte Anlage gilt als geändert, und alle Objekte an diesen Anlagen —
  // das Objekt selbst und seine Nachbarn — werden mit „Stimmt das noch?" markiert. Derselbe Merker
  // wie `assetChanged`, kein zweiter Weg. Ohne Kopplung wird nichts markiert (leere Liste).
  // R-1635: auch dieser Auslöser benachrichtigt — je markiertem Objekt EIN Beleg mit Grund „nachbar"
  // und dem auslösenden Objekt, auch wenn es über mehrere Anlagen erreicht wird.
  async neighborsChanged(koId: string, actor = "system", aenderung?: string): Promise<string[]> {
    return (await this.meldeNachbaraenderung(koId, actor, aenderung)).map((m) => m.koId);
  }

  /**
   * produkt:20261010:aenderungsfolgen-sichtbar: der Nachbarauslöser mit Auskunft je Eintrag. Jeder
   * Anlass nennt die Anlage, über die der Eintrag erreicht wurde (die erste gemeinsame Kopplung),
   * und die Fassung des auslösenden Eintrags.
   */
  async meldeNachbaraenderung(
    koId: string,
    actor = "system",
    aenderung?: string,
  ): Promise<Markierung[]> {
    const ueber = new Map<string, string>();
    const anlagen = await this.couplingsForKo(koId);
    for (const assetRef of anlagen) {
      for (const betroffen of await this.traegerVon(assetRef)) {
        if (!ueber.has(betroffen)) {
          ueber.set(betroffen, assetRef);
        }
      }
    }
    const ausloeserVersion = (await this.koService.get(koId))?.version;
    return this.markiere(
      [...ueber].map(([betroffen, assetRef]) => ({ koId: betroffen, assetRef })),
      actor,
      {
        grund: "nachbar",
        ausgeloestVon: koId,
        ...(ausloeserVersion !== undefined ? { ausgeloestVonVersion: ausloeserVersion } : {}),
        ...(anlagen.length === 1 && anlagen[0] !== undefined ? { assetRef: anlagen[0] } : {}),
        ...(aenderung !== undefined ? { aenderung } : {}),
      },
    );
  }

  // R-0206 / R-1732 / R-1745: eine erneute Prüfung GEZIELT für ein Objekt anstoßen — aus der
  // Bibliothek heraus, ohne Anlagenänderung. Derselbe Merker; die Bestätigung räumt ihn wie gewohnt.
  async requestRevalidation(koId: string, actor = "system"): Promise<void> {
    await this.markiere([{ koId }], actor, { grund: "bibliothek" });
  }

  /**
   * produkt:20261010:aenderungsfolgen-sichtbar: die offenen Fälle mit Stand und Anlässen —
   * SCHREIBFREI. Anders als `pendingRevalidation()` räumt dieser Weg keine verwaisten Merker: er
   * beantwortet nur, was die Ablage trägt; wer die Antwort anzeigt, filtert über die Sichtbarkeit
   * (dort fällt ein Merker ohne Objekt ohnehin heraus). Die Selbstheilung nach SCRUM-420 bleibt der
   * Arbeitsbereichsweg — und sie ist kein fachlicher Abschluss: sie schreibt keinen `ko.revalidated`.
   */
  offeneFaelle(koIds?: readonly string[]): Promise<OffenerFall[]> {
    return this.repo.offeneFaelle(koIds);
  }

  // ============================================================================================
  // ADMIN-10 · EINE RÜCKMELDUNG ALS AUFGABE ÜBERNEHMEN — unter derselben Objektsperre wie der Abschluss.
  // ============================================================================================
  //
  // Dieselbe gezielte Prüfanforderung wie `requestRevalidation`, ausgelöst aus einer belegten
  // Rückmeldung. Kein zweiter Aufgabentyp — der Merker ist derselbe, die Bestätigung räumt ihn.
  //
  // Ben (Nacharbeit 2) fand zwei Lücken in der ersten Fassung, die beide hier geschlossen sind:
  //   1. Der Übernahmebeleg stand dauerhaft, bevor die Anforderung geschrieben war. Fiel sie aus,
  //      antwortete jede Wiederholung „bereits" und die Aufgabe entstand nie. Jetzt prüft JEDER
  //      Aufruf — auch der, der den Beleg nicht mehr gewinnt — nach dem Beleg die tatsächliche Lage
  //      und holt eine fehlende Anforderung nach (idempotente Wiederaufnahme).
  //   2. „Angehängt" beruhte auf einer Lesung VOR dem Beleg. Schloss jemand die Revalidierung
  //      dazwischen ab, hing die Meldung an einem Vorgang, den es nicht mehr gab. Jetzt laufen Beleg,
  //      Lesung und Anforderung unter der Sperre des Objekts, unter der auch `confirmStillValid`
  //      läuft: entweder ist der Abschluss ganz vorbei (dann wird neu angefordert) oder er kommt
  //      erst danach (dann schliesst er die Revalidierung, an der die Meldung tatsächlich hängt).
  //
  // `belegen` schreibt den Übernahmebeleg (true = neu geschrieben), `erledigtSeitBeleg` sagt, ob
  // nach diesem Beleg schon eine Bestätigung vorliegt — beides liegt beim Aufrufer, weil dieses
  // Modul das Prüfprotokoll nur schreibt, nicht liest.
  async rueckmeldungUebernehmen(
    koId: string,
    actor: string,
    meldungId: string,
    schritte: {
      belegen: () => Promise<boolean>;
      erledigtSeitBeleg: () => Promise<boolean>;
    },
  ): Promise<{ neu: boolean; lage: "angelegt" | "angehaengt" | "erledigt" }> {
    return this.unterSperre(koId, async () => {
      const neu = await schritte.belegen();
      if ((await this.repo.pendingFor([koId])).includes(koId)) {
        return { neu, lage: "angehaengt" as const };
      }
      if (await schritte.erledigtSeitBeleg()) {
        return { neu, lage: "erledigt" as const };
      }
      await this.markiere([{ koId }], actor, { grund: "rueckmeldung", meldungId });
      return { neu, lage: "angelegt" as const };
    });
  }

  // Je Objekt eine Warteschlange: Übernahme und Bestätigung desselben Objekts laufen nacheinander.
  // Grenze: die Sperre gilt innerhalb EINES Serverprozesses.
  private readonly sperren = new Map<string, Promise<unknown>>();

  private async unterSperre<T>(koId: string, fn: () => Promise<T>): Promise<T> {
    const vorher = this.sperren.get(koId) ?? Promise.resolve();
    const lauf = vorher.catch(() => undefined).then(fn);
    const ende = lauf.catch(() => undefined);
    this.sperren.set(koId, ende);
    try {
      return await lauf;
    } finally {
      if (this.sperren.get(koId) === ende) {
        this.sperren.delete(koId);
      }
    }
  }

  // SCRUM-420 (Pedi 03.07.): Selbstheilung — Marker, deren KO nicht mehr existiert (z. B.
  // nach Löschen/Demodaten-Purge), werden beim Lesen ehrlich ENTFERNT statt als Geister-
  // Karten (nackte UUID, „nicht im Bestand") im Arbeitsbereich zu erscheinen. Wirkt für
  // alle Leser derselben Quelle (Arbeitsbereich, Benachrichtigungen, Management-Kennzahlen).
  async pendingRevalidation(): Promise<string[]> {
    const pending = await this.repo.pending();
    const alive: string[] = [];
    for (const koId of pending) {
      if (await this.koService.get(koId)) {
        alive.push(koId);
      } else {
        await this.repo.clearPending(koId);
      }
    }
    return alive;
  }

  // ============================================================================================
  // JOB 3054 · DIE MERKERLAGE FÜR EINEN LESEPFAD — SCHREIBFREI, MENGENWEISE, OHNE OBJEKTPRÜFUNG.
  // ============================================================================================
  //
  // WOFÜR ES DIESEN WEG BRAUCHT. Die zwei Leserouten (`GET /api/kos/:id`, `GET /api/kos`) leiten
  // den Anzeigestatus ab und brauchen dafür genau eine Auskunft: steht für DIESES Objekt ein
  // „Stimmt das noch?" an? Das vorhandene `pendingRevalidation()` beantwortet eine andere Frage —
  // es lädt den GANZEN Merkerbestand, prüft je Merker ein Objekt (N+1) und ENTFERNT tote Merker.
  // Auf einem Lesepfad ist jedes der drei falsch, und der Schreibvorgang ist der Grund, aus dem
  // `revalidierung` bis hierher ausdrücklich als „nicht erhoben" ausgewiesen wurde.
  //
  // WARUM DIESE ABFRAGE KEINE GEISTERKARTEN ERZEUGEN KANN — der Grund, aus dem die Selbstheilung
  // hier fehlen DARF und nicht bloß fehlt: Sie beantwortet ausschließlich Kennungen, die der
  // Aufrufer übergibt, und der Aufrufer übergibt nur Objekte, die er ohnehin schon geladen hat.
  // Ein Merker ohne Objekt kann in ihrer Antwort gar nicht vorkommen; es gibt hier also nichts,
  // was als nackte UUID im Arbeitsbereich erscheinen könnte (SCRUM-420 wirkt auf die Frage „welche
  // Objekte stehen an?", nicht auf „steht dieses an?").
  //
  // ES ENTSTEHT KEIN ZWEITER WEG ZUR MERKERLAGE: `pendingRevalidation()` bleibt unverändert der
  // einzige selbstheilende Arbeitsbereichsweg, `revalidierungAnstehtFuer` der einzige Leseweg.
  // EINE LEERE EINGABE MACHT NULL ABFRAGEN — hier und nicht erst in der Ablage. Eine leere Liste
  // ist ein Ergebnis, keine Frage; ohne diese Zeile zöge eine leere Antwort der Liste einen
  // Ablagenzugriff nach sich. Dieselbe Aufteilung wie bei `ValidationService.pruefstaendeFuer`:
  // der Dienst hält den Aufruf zurück, der Adapter hält zusätzlich das SQL zurück (R-8).
  async revalidierungAnstehtFuer(koIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (koIds.length === 0) {
      return new Set<string>();
    }
    return new Set(await this.repo.pendingFor(koIds));
  }

  // FR-LIF-01: Bestätigung erzeugt eine neue Version.
  //
  // §12.3 „Re-Validierung": `revise` hinterlässt `ko.revised` — dasselbe wie eine inhaltliche
  // Überarbeitung. Die Bestätigung „stimmt noch" bekommt deshalb ihren eigenen Eintrag
  // `ko.revalidated`, IM SELBEN Audit-Schritt der Revision (`zusatzBeleg`): scheitert er, rollt
  // `KoService` die neue Fassung zurück.
  //
  // Aufnahme gesamt-auditprotokoll, Lauf 2 (Bens letzter Befund aus Lauf 1): der Merker wurde VOR der
  // Revision und außerhalb ihrer Transaktion gelöscht — ging danach etwas schief (etwa eine verlorene
  // Antwort nach ausgeführtem DELETE), war der Merker weg, ohne Fassung und ohne Beleg. Jetzt löscht
  // `zusatzBeleg.vorher` ihn IM Audit-Schritt der Revision:
  //  - mit `withTx` (Betrieb, PostgreSQL) auf demselben Transaktionsclient — Merker, Fassung,
  //    `ko.revised` und `ko.revalidated` committen gemeinsam oder gar nicht;
  //  - ohne `withTx` (Speicherbetrieb) rollt `KoService` die Fassung zurück, und hier wird der Merker
  //    wieder gesetzt, sobald das Löschen auch nur versucht wurde.
  // `pendingCleared` ist die Antwort des Löschens selbst, nicht eine Lesung davor.
  //
  // produkt:20261010:aenderungsfolgen-sichtbar — DIE BESTÄTIGUNG GILT DEM GESEHENEN STAND.
  // Nennt der Aufrufer `geprueftStand` (die Folgeprüfungsübersicht tut das immer), räumt die
  // Bestätigung NUR genau diesen Stand:
  //  - ist seit der Anzeige ein neuer Anlass eingegangen, steht ein höherer Stand da → 409
  //    `STAND_VERALTET`, keine Fassung, kein Beleg, der offene Fall bleibt;
  //  - ist der Fall schon abgeschlossen (Wiederholung, zweite Person parallel) → ebenfalls 409,
  //    keine zweite Fassung.
  // Die Vorprüfung erspart den Revisionsversuch; ENTSCHEIDEND ist das bedingte Löschen im
  // Audit-Schritt (`clearPending(…, stand)`): trifft es nichts, wirft es, und die Revision rollt
  // zurück — auch wenn die neue Änderung genau zwischen Vorprüfung und Löschen eintrifft.
  // Der Beleg `ko.revalidated` nennt dann zusätzlich den bestätigten Stand.
  //
  // Nacharbeit 4 (Ben, K5): OHNE `geprueftStand` wird KEINE offene Folgeprüfung abgeschlossen —
  // steht ein Fall offen, antwortet der Weg 409 `STAND_VERALTET` (Neuladen und mit Stand bestätigen),
  // auch wenn der Fall erst zwischen Vorprüfung und Revision entsteht. Ohne offenen Fall bleibt die
  // reine Gültigkeitsbestätigung (Bibliothek „Re-Validierung", Frist) möglich; sie löscht nichts.
  //
  // ADMIN-10: unter derselben Objektsperre wie `rueckmeldungUebernehmen` (Begründung dort). Die
  // Bindung an Stand und Fassung gilt innerhalb dieser Sperre unverändert.
  async confirmStillValid(
    koId: string,
    author: string,
    geprueftStand?: number,
    geseheneFassung?: number,
  ): Promise<KnowledgeObject> {
    return this.unterSperre(koId, () =>
      this.bestaetigeUngesperrt(koId, author, geprueftStand, geseheneFassung),
    );
  }

  private async bestaetigeUngesperrt(
    koId: string,
    author: string,
    geprueftStand?: number,
    geseheneFassung?: number,
  ): Promise<KnowledgeObject> {
    const [vorab] = await this.repo.offeneFaelle([koId]);
    if (geprueftStand !== undefined) {
      pruefeStand(vorab, geprueftStand);
    } else if (vorab) {
      throw new FolgepruefungStandError(STAND_FEHLT, vorab.stand);
    }
    // Nur ohne Transaktion gebraucht: der Fall vor dem Löschversuch, der wieder einzusetzen ist.
    let ohneTxFall: OffenerFall | undefined;
    try {
      return await this.koService.revise(koId, {}, author, {
        // Nacharbeit 6 (Ben, K5): die angezeigte INHALTSFASSUNG gehört zur Bestätigung. Der vorhandene
        // Compare-and-Set von `revise` prüft sie im selben serialisierten Schritt (mit `withTx` in
        // derselben Transaktion), BEVOR der Audit-Schritt den Merker räumt. Wurde der Eintrag
        // inzwischen überarbeitet, wirft `revise` `KO_STALE` (409) — keine Fassung, kein Beleg, die
        // Folgeprüfung bleibt offen.
        ...(geseheneFassung !== undefined ? { expectedVersion: geseheneFassung } : {}),
        zusatzBeleg: {
          action: "ko.revalidated",
          vorher: async (tx) => {
            if (geprueftStand === undefined) {
              // Ohne Stand wird nichts geräumt; entstand inzwischen ein Fall, gibt es keinen Abschluss.
              const [inzwischen] = await this.repo.offeneFaelle([koId], tx);
              if (inzwischen) {
                throw new FolgepruefungStandError(STAND_FEHLT, inzwischen.stand);
              }
              return { pendingCleared: false };
            }
            if (tx === undefined) {
              [ohneTxFall] = await this.repo.offeneFaelle([koId]);
            }
            const pendingCleared = await this.repo.clearPending(koId, tx, geprueftStand);
            if (!pendingCleared) {
              const [jetzt] = await this.repo.offeneFaelle([koId], tx);
              pruefeStand(jetzt, geprueftStand);
              // Derselbe Stand steht noch und wurde trotzdem nicht gelöscht: nie still bestätigen.
              throw new FolgepruefungStandError(STAND_GEAENDERT, jetzt?.stand ?? null);
            }
            return { pendingCleared, geprueftStand };
          },
        },
      });
    } catch (err) {
      // Der ursprüngliche Fehler bleibt der gemeldete; ein Ausfall beim Wiedersetzen darf ihn nicht
      // verdecken. Mit Transaktion ist nichts zu tun — der Rollback hat den Merker behalten. Ohne
      // Transaktion kommt der Fall mit Stand und Anlässen zurück; ein inzwischen neu entstandener
      // Fall bleibt, wie er ist.
      if (ohneTxFall) {
        await this.repo.restorePending(ohneTxFall).catch(() => undefined);
      }
      throw err;
    }
  }

  // FR-LIF-02: Admin-Autor-Übergabe; Originalautor bleibt sichtbar.
  async transferAuthor(koId: string, newAuthor: string, actor = "admin"): Promise<KnowledgeObject> {
    return this.koService.setAuthor(koId, newAuthor, actor);
  }

  // FR-LIF-03: Lernpfade — rollenspezifische Einarbeitung.
  async createPath(role: string, steps: readonly { title: string }[]): Promise<LearningPath> {
    const path: LearningPath = {
      id: this.genId(),
      role,
      steps: steps.map<LearningStep>((s) => ({ id: this.genId(), title: s.title })),
    };
    await this.repo.savePath(path);
    return path;
  }

  getPath(role: string): Promise<LearningPath | undefined> {
    return this.repo.getPathByRole(role);
  }

  // FR-LIF-03: Abhaken mit Fortschrittsspeicherung.
  async completeStep(pathId: string, userId: string, stepId: string): Promise<string[]> {
    const done = await this.repo.getProgress(pathId, userId);
    if (!done.includes(stepId)) {
      done.push(stepId);
      await this.repo.setProgress(pathId, userId, done);
    }
    return done;
  }

  progress(pathId: string, userId: string): Promise<string[]> {
    return this.repo.getProgress(pathId, userId);
  }
}
