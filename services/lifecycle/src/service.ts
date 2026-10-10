import { randomUUID } from "node:crypto";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { LifecycleRepo } from "./repo";
import type { LearningPath, LearningStep } from "./types";

/**
 * R-1635: warum ein Objekt mit „Stimmt das noch?" markiert wurde.
 * ADMIN-10: „rueckmeldung" — eine belegte Rückmeldung (`answer.reported`) wurde in der
 * Qualitätsübersicht als Aufgabe übernommen; der Beleg nennt ihre `meldungId`.
 */
export type RevalidierungsGrund = "anlage" | "nachbar" | "bibliothek" | "rueckmeldung";

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

export interface LifecycleServiceDeps {
  koService: KoService;
  repo: LifecycleRepo;
  genId?: () => string;
  // R-1635: ohne Beleg wird weiter markiert, nur ohne Benachrichtigungsgrundlage (Altaufbau, Tests).
  audit?: RevalidierungsBeleg;
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

  constructor(deps: LifecycleServiceDeps) {
    this.koService = deps.koService;
    this.repo = deps.repo;
    this.genId = deps.genId ?? (() => randomUUID());
    this.audit = deps.audit;
  }

  // R-1635: setzt den Merker und hält je Objekt fest, wer ihn warum gesetzt hat. Der Beleg ist die
  // Grundlage der Benachrichtigung an Autor bzw. Nachfolger; er trägt keinen Inhalt des Objekts.
  private async markiere(
    koIds: readonly string[],
    actor: string,
    payload: {
      grund: RevalidierungsGrund;
      assetRef?: string;
      ausgeloestVon?: string;
      meldungId?: string;
    },
  ): Promise<void> {
    for (const koId of koIds) {
      await this.repo.markPending(koId);
      await this.audit?.record({
        actor,
        action: REVALIDIERUNG_ANGEFORDERT,
        target: koId,
        payload: { ...payload },
      });
    }
  }

  // FR-LIF-01: Anlagen-/Prozesskopplung.
  async couple(assetRef: string, koId: string): Promise<void> {
    await this.repo.addCoupling(assetRef, koId);
  }

  // FR-LIF-01 / Audit B1: gekoppelte Anlagen eines KOs (fürs KO-Detail sichtbar machen).
  couplingsForKo(koId: string): Promise<string[]> {
    return this.repo.couplingsForKo(koId);
  }

  // FR-LIF-01: Anlagenänderung markiert gekoppelte KOs „Stimmt das noch?". R-1635: mit Beleg je
  // Objekt (`actor` = wer die Änderung gemeldet hat), damit Autor bzw. Nachfolger erfährt, dass
  // sein Wissen geprüft werden soll.
  async assetChanged(assetRef: string, actor = "system"): Promise<string[]> {
    const koIds = await this.repo.couplingsFor(assetRef);
    await this.markiere(koIds, actor, { grund: "anlage", assetRef });
    return koIds;
  }

  // aufnahme:20260922:gesamt-wissen-frische (R-0203) — DER AUSLÖSER ÜBER BENACHBARTE WISSENSOBJEKTE.
  //
  // Wer an EINEM Wissensobjekt merkt, dass sich seine Anlage geändert hat, meldet das dort einmal:
  // jede an das Objekt gekoppelte Anlage gilt als geändert, und alle Objekte an diesen Anlagen —
  // das Objekt selbst und seine Nachbarn — werden mit „Stimmt das noch?" markiert. Derselbe Merker
  // wie `assetChanged`, kein zweiter Weg. Ohne Kopplung wird nichts markiert (leere Liste).
  // R-1635: auch dieser Auslöser benachrichtigt — je markiertem Objekt EIN Beleg mit Grund „nachbar"
  // und dem auslösenden Objekt, auch wenn es über mehrere Anlagen erreicht wird.
  async neighborsChanged(koId: string, actor = "system"): Promise<string[]> {
    const markiert = new Set<string>();
    const anlagen = await this.repo.couplingsForKo(koId);
    for (const assetRef of anlagen) {
      for (const betroffen of await this.repo.couplingsFor(assetRef)) {
        markiert.add(betroffen);
      }
    }
    await this.markiere([...markiert], actor, {
      grund: "nachbar",
      ausgeloestVon: koId,
      ...(anlagen.length === 1 && anlagen[0] !== undefined ? { assetRef: anlagen[0] } : {}),
    });
    return [...markiert];
  }

  // R-0206 / R-1732 / R-1745: eine erneute Prüfung GEZIELT für ein Objekt anstoßen — aus der
  // Bibliothek heraus, ohne Anlagenänderung. Derselbe Merker; die Bestätigung räumt ihn wie gewohnt.
  async requestRevalidation(koId: string, actor = "system"): Promise<void> {
    await this.markiere([koId], actor, { grund: "bibliothek" });
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
      await this.markiere([koId], actor, { grund: "rueckmeldung", meldungId });
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
  // ADMIN-10: unter derselben Objektsperre wie `rueckmeldungUebernehmen` (Begründung dort).
  async confirmStillValid(koId: string, author: string): Promise<KnowledgeObject> {
    return this.unterSperre(koId, () => this.bestaetigeUngesperrt(koId, author));
  }

  private async bestaetigeUngesperrt(koId: string, author: string): Promise<KnowledgeObject> {
    // Nur ohne Transaktion gebraucht: stand vor dem Löschversuch ein Merker, der wieder zu setzen ist?
    let ohneTxWarGesetzt = false;
    try {
      return await this.koService.revise(koId, {}, author, {
        zusatzBeleg: {
          action: "ko.revalidated",
          vorher: async (tx) => {
            if (tx === undefined) {
              ohneTxWarGesetzt = (await this.repo.pendingFor([koId])).includes(koId);
            }
            return { pendingCleared: await this.repo.clearPending(koId, tx) };
          },
        },
      });
    } catch (err) {
      // Der ursprüngliche Fehler bleibt der gemeldete; ein Ausfall beim Wiedersetzen darf ihn nicht
      // verdecken. Mit Transaktion ist nichts zu tun — der Rollback hat den Merker behalten.
      if (ohneTxWarGesetzt) {
        await this.repo.markPending(koId).catch(() => undefined);
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
