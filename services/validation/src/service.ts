import type { AuditService } from "../../audit";
import type { TxContext } from "../../db-tx";
import type { KnowledgeObject, KoFilter, KoService } from "../../knowledge-object";
// JOB 557 (Pedi 13.08.2026): „der Erzeuger ist nicht der Verantwortliche." Beide Helfer kommen über
// die MODULFASSADE — keine Kante in die Innereien von knowledge-object.
import { ownershipOf, responsibleKindOf, responsibleOf } from "../../knowledge-object";
import type { AssignmentRepo, RatingRepo } from "./repo";
import {
  FALLBACK_NEEDED_VALIDATIONS,
  type ValidationSettingsRepo,
  normalizeDefaultNeeded,
} from "./settings";
import { TRUST_MAX, type ValidationOutcome, computeOutcome } from "./trust";
import type { Assignment, Rating } from "./types";
import { ValidationError, type Verdict } from "./types";

export type BoardFilter = Omit<KoFilter, "status">;

// SCRUM-507 R2: die von einer Bewertung bewertete KO-Version. Alt-Bewertungen ohne Feld gelten als
// Version 1 (häufigster Fall: nie revidiert; auf revidierten KOs sind sie damit stale — fail-safe).
function ratingVersion(r: { koVersion?: number }): number {
  return r.koVersion ?? 1;
}

/**
 * ADMIN-09: die Fassung, die die entscheidende Person gelesen hat, gegen die aktuelle. Weicht sie
 * ab, wird nichts entschieden (KO_STALE) — eine Entscheidung zur alten Fassung gibt die neue nicht
 * frei. Ohne Angabe gilt wie bisher die beim Lesen aktuelle Fassung; den Schreibweg schützt danach
 * der Compare-and-Set in `setValidationStateMitBeleg`.
 */
function pruefeErwarteteFassung(aktuell: number, erwartet: number | undefined): void {
  if (erwartet !== undefined && erwartet !== aktuell) {
    throw new ValidationError(
      "KO_STALE",
      `Das Wissensobjekt wurde inzwischen überarbeitet (jetzt Fassung ${aktuell}, geprüft wurde Fassung ${erwartet}). Es wurde nichts entschieden.`,
    );
  }
}

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
}

/** Die Stimmenlage EINER KO-Fassung, getrennt nach gewerteten und veralteten Stimmen. */
interface Stimmenlage {
  votes: { up: number; warn: number; down: number };
  staleVotes: number;
}

/**
 * SCRUM-507 R2, an EINER Stelle: nur Bewertungen der uebergebenen Fassung zaehlen; frueheren wird
 * nicht widersprochen, sie werden getrennt gezaehlt. `board()` und `pruefstandFuer()` rufen beide
 * hierher — zwei Zaehlungen waeren zwei Wahrheiten ueber dieselben Stimmen.
 */
function stimmenAus(ratings: readonly Rating[], koVersion: number): Stimmenlage {
  const votes = { up: 0, warn: 0, down: 0 };
  let staleVotes = 0;
  for (const r of ratings) {
    if (ratingVersion(r) === koVersion) {
      votes[r.verdict] += 1;
    } else {
      staleVotes += 1;
    }
  }
  return { votes, staleVotes };
}

// ================================================================================================
// JOB 3024 — DIE PRUEFSTANDSLAGE GENAU EINES OBJEKTS.
// ================================================================================================
//
// WARUM ES DIESEN WEG BRAUCHT. Vorher war `board()` der einzige oeffentliche Weg an Zuweisungen und
// Bewertungen. Ein Detailabruf musste damit die VOLLMENGE der offenen Objekte laden und je Zeile die
// Bewertungen abfragen (gemessen: neun gleichartige Fremdobjekte kosteten neun zusaetzliche
// Abfragen) — und weil `board()` per Vertrag nur OFFENE Objekte fuehrt, blieb die Bewertungslage
// eines validierten Objekts ungefragt. Daran hing der tragende Fehler: eine aktuelle rote Stimme
// verschwand nach einem Admin-Override hinter „validiert", obwohl `displayStatus` `rejected`
// ausdruecklich VOR `validiert` prueft (display-status.ts:38-43) und `adminValidate` keine
// Peer-Bewertung loescht.
//
// DIESE ABFRAGE IST SCHREIBFREI und kennt keinen Statusvorbehalt: sie beantwortet die Frage fuer
// JEDES Objekt, offen wie validiert. Sie laedt kein Wissensobjekt (die Fassung kommt vom Aufrufer,
// der das Objekt ohnehin in der Hand hat) und keine fremde Zeile.
export interface KoPruefstand {
  /** Die OFFENEN Zuweisungen dieses Objekts. Erledigte zaehlen nicht — dieselbe Lesart wie `board()`. */
  readonly assignments: string[];
  /** Die Stimmen der uebergebenen Fassung. */
  readonly votes: { up: number; warn: number; down: number };
  /** Stimmen frueherer Fassungen: gezaehlt, aber nicht gewertet (SCRUM-507 R2). */
  readonly staleVotes: number;
}

/**
 * Die OFFENEN Zuweisungen je Objekt aus der Vollmenge — die EINE Lesart von „offen" in diesem
 * Modul. `board()`, `pruefstandFuer()` und `pruefstaendeFuer()` gruppieren alle hierueber; drei
 * Kopien dieser Schleife waeren drei Gelegenheiten, sie auseinanderlaufen zu lassen. Erledigte
 * (`done`) Zuweisungen erscheinen nirgends — dieselbe Zusage seit SCRUM-364.
 */
function offeneZuweisungenJeKo(alle: readonly Assignment[]): Map<string, string[]> {
  const offen = new Map<string, string[]>();
  for (const a of alle) {
    if (a.status === "open") {
      const bisher = offen.get(a.koId) ?? [];
      bisher.push(a.userId);
      offen.set(a.koId, bisher);
    }
  }
  return offen;
}

/** Bewertungen je Objekt — dieselbe Gruppierung fuer die Einzel- wie fuer die Mengenabfrage. */
function bewertungenJeKo(alle: readonly Rating[]): Map<string, Rating[]> {
  const nachKo = new Map<string, Rating[]>();
  for (const r of alle) {
    const bisher = nachKo.get(r.koId) ?? [];
    bisher.push(r);
    nachKo.set(r.koId, bisher);
  }
  return nachKo;
}

/**
 * JOB 3043 — DIE EINE ABLEITUNG der Pruefstandslage, aus bereits beschafften Zeilen.
 *
 * `pruefstandFuer` (ein Objekt, gezielte Bewertungsabfrage) und `pruefstaendeFuer` (eine Menge,
 * EINE Mengenabfrage) unterscheiden sich ausschliesslich darin, WIE sie an die Zeilen kommen. Was
 * daraus folgt — welche Zuweisungen als offen gelten, welche Stimmen zaehlen —, steht hier ein
 * einziges Mal. Zwei Herleitungen waeren zwei Wahrheiten ueber dasselbe Objekt, und genau die
 * sollen die beiden Lesepfade der Antwort ja gerade nicht mehr haben.
 *
 * Ein Objekt OHNE Zuweisung und OHNE Stimme bekommt eine vollstaendige, leere Lage — kein
 * `undefined`. Ein fehlender Wert darf fuer den Aufrufer nie „nichts erhoben" bedeuten muessen.
 */
function pruefstandAus(
  koId: string,
  koVersion: number,
  offeneJeKo: ReadonlyMap<string, readonly string[]>,
  stimmenJeKo: ReadonlyMap<string, readonly Rating[]>,
): KoPruefstand {
  return {
    assignments: [...(offeneJeKo.get(koId) ?? [])],
    ...stimmenAus(stimmenJeKo.get(koId) ?? [], koVersion),
  };
}

// SCRUM-363 / AG-15 / FR-VAL-05/06: eine offene, persönliche Review-Zuweisung als leichtgewichtiger
// Hinweis (für den In-App-Feed). Enthält das Quell-KO (Titel + Erstellzeit als Sortier-/Anzeigezeit) —
// kein neues Datenmodell, nur eine Sicht auf das vorhandene Assignment + KO.
export interface AssignmentNotice {
  koId: string;
  title: string;
  at: string;
  // R-0894: die offene Zuweisung ist eine RÜCKGABE zur Nacharbeit (`ko.returned-to-*`) an die
  // verantwortliche Person — dann ist `at` der Zeitpunkt der Rückgabe, nicht die Erstellzeit.
  rueckgabe?: true;
}

// Dieselbe Lesart wie `isReturnedForRework` (apps/web/src/lib/validationStatus.ts): eine Rückgabe gilt,
// solange danach weder überarbeitet noch neu bewertet wurde.
const RUECKGABE_AKTIONEN = new Set(["ko.returned-to-author", "ko.returned-to-owner"]);
const RUECKGABE_ENDE_AKTIONEN = new Set(["ko.revised", "ko.rated"]);

// ================================================================================================
// W3-B (KW-W3-19) — DIE VALIDIERUNGSREFERENZ AM RUECKGABEWERT
// ================================================================================================
//
// WARUM SIE HIER STEHT UND NICHT IN `ValidationOutcome`. Jener Typ liegt in `trust.ts` und wird von
// der PUREN Funktion `computeOutcome` erzeugt, die von Audit nichts weiss und nichts wissen darf.
// Traege er das Feld, muesste eine reine Rechenfunktion etwas fuellen, das sie nicht kennt — oder
// es bliebe strukturell leer und waere eine Einladung zum Erfinden. Die Referenz gehoert deshalb an
// den Rueckgabewert der DIENSTmethoden.
//
// `null` IST EINE EHRLICHE ANTWORT: `audit` ist optional (s. Deps unten). Ohne verdrahteten Audit
// gibt es keinen Eintrag und damit keine Referenz. Rekonstruktion ueber Zeitpunkt, Actor oder
// Status ist ausdruecklicher No-Go von KW-W3-19.
export interface ValidationDecisionRefWertForm {
  readonly auditSeq: number;
  readonly auditHash: string;
}
export type ValidationDecisionRefWert = ValidationDecisionRefWertForm | null;

/** Aus dem Auditbeleg wird die Referenz — reines Durchreichen, keine Ableitung. */
function refAus(beleg: { seq: number; hash: string } | undefined): ValidationDecisionRefWert {
  return beleg ? { auditSeq: beleg.seq, auditHash: beleg.hash } : null;
}

/** Der fachliche Ausgang PLUS der Beleg, auf den er sich stuetzt. */
export type ValidationDecision = ValidationOutcome & {
  readonly validationDecisionRef: ValidationDecisionRefWert;
};

export interface ValidationServiceDeps {
  koService: KoService;
  ratings: RatingRepo;
  assignments: AssignmentRepo;
  audit?: AuditService;
  now?: () => number;
  // SCRUM-395: persistierte Admin-Einstellung „Standard-Prüferanzahl" (optional —
  // ohne Repo gilt der feste Fallback aus settings.ts).
  settings?: ValidationSettingsRepo;
}

export class ValidationService {
  private readonly koService: KoService;
  private readonly ratings: RatingRepo;
  private readonly assignments: AssignmentRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly settings: ValidationSettingsRepo | undefined;

  constructor(deps: ValidationServiceDeps) {
    this.koService = deps.koService;
    this.ratings = deps.ratings;
    this.assignments = deps.assignments;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.settings = deps.settings;
  }

  // SCRUM-395: Standard-Prüferanzahl für neue Einreichungen — Admin-Wert, sonst Fallback 3.
  async defaultNeededValidations(): Promise<number> {
    const stored = await this.settings?.getDefaultNeeded();
    return stored ?? FALLBACK_NEEDED_VALIDATIONS;
  }

  // SCRUM-395: Admin setzt den Standard (1–5, ganzzahlig). Landet im Audit — Einstellungen,
  // die den Prüfprozess verändern, sind nachvollziehbar.
  async setDefaultNeededValidations(value: unknown, actor: string): Promise<number> {
    if (!this.settings) {
      throw new ValidationError(
        "INVALID_DEFAULT",
        "Standard-Prüferanzahl wird in dieser Umgebung nicht persistiert.",
      );
    }
    const normalized = normalizeDefaultNeeded(value);
    await this.settings.setDefaultNeeded(normalized);
    await this.audit?.record({
      actor,
      action: "validation.defaultNeeded.set",
      target: "settings",
      payload: { value: normalized },
    });
    return normalized;
  }

  // FR-VAL-01/02: Bewertung verbuchen, Trust/Status neu berechnen, am KO setzen.
  //
  // ADMIN-09: `erwarteteFassung` ist die Fassung, die die prüfende Person gelesen hat. Ist das Objekt
  // inzwischen überarbeitet, wird nichts bewertet (KO_STALE) — eine Entscheidung zur alten Fassung
  // gibt die neue nicht frei. Ohne Angabe gilt wie bisher die beim Lesen aktuelle Fassung.
  async rate(
    koId: string,
    userId: string,
    verdict: Verdict,
    opts: { erwarteteFassung?: number } = {},
  ): Promise<ValidationDecision> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    pruefeErwarteteFassung(ko.version, opts.erwarteteFassung);
    // SCRUM-507 R2: die Bewertung wird an die bewertete KO-VERSION gebunden. Ein nebenläufiges Revise
    // (Version+1) macht sie damit implizit stale — keine separate Invalidierung, kein Desync.
    const ratedVersion = ko.version;
    const bewertung: Rating = {
      koId,
      userId,
      verdict,
      createdAt: new Date(this.now()).toISOString(),
      koVersion: ratedVersion,
    };
    // Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 3, BEN-R2-B1): die Stimmenlage wird NICHT mehr
    // vor der Klammer gebildet, sondern in ihr (`lese`, aufgerufen aus `zustand` unter dem KO-Lock
    // und — bei einer zweiten Instanz — nach dem neuen Lesen). Zwei gleichzeitige Bewertungen sahen
    // sonst die Stimme des jeweils anderen nicht. Die Bewertung selbst wird in der Klammer gespeichert
    // (Upsert-Semantik: eine Bewertung je Nutzer); hier kommt sie rechnerisch zum Bestand dazu.
    interface Stimmenlage {
      vorherige: Rating | undefined;
      all: Rating[];
      outcome: ValidationOutcome;
      zuweisung: Assignment | undefined;
    }
    let stand: Stimmenlage | undefined;
    const lese = async (): Promise<Stimmenlage> => {
      const bisher = await this.ratings.listByKo(koId);
      const vorherige = bisher.find((r) => r.userId === userId);
      const all = vorherige
        ? bisher.map((r) => (r.userId === userId ? bewertung : r))
        : [...bisher, bewertung];
      // Nur Bewertungen der aktuell bewerteten Version zählen (stale Vorversions-Bewertungen ausgeschlossen).
      const currentVotes = all
        .filter((r) => ratingVersion(r) === ratedVersion)
        .map((r) => r.verdict);
      stand = {
        vorherige,
        all,
        outcome: computeOutcome(currentVotes, ko.neededValidations),
        zuweisung: await this.assignments.find(koId, userId),
      };
      return stand;
    };

    // Rücknahme für den Weg OHNE Transaktion: was `beleg` unten geschrieben hat, rückwärts zurück.
    const rueckwaerts: Array<() => Promise<void>> = [];
    const beleg = async (tx?: TxContext): Promise<ValidationDecisionRefWert> => {
      const { vorherige, zuweisung } = stand ?? (await lese());
      await this.ratings.upsert(bewertung, tx);
      rueckwaerts.push(async () => {
        if (vorherige) {
          await this.ratings.upsert(vorherige);
        } else {
          await this.ratings.remove?.(koId, userId);
        }
      });
      // W3-B (KW-W3-19): der Rueckgabewert wird FESTGEHALTEN statt verworfen. Er ist die Referenz —
      // eine spaetere Suche nach „dem passenden Eintrag" ist ausdruecklich verboten.
      // `koVersion` reist bewusst im Payload mit: die Entscheidung gilt fuer die BEWERTETE Fassung,
      // und nur so kann ein Leser spaeter `WRONG_SUBJECT` von „passt" unterscheiden.
      const eintrag = await this.audit?.record(
        {
          actor: userId,
          action: "ko.rated",
          target: koId,
          payload: { verdict, koVersion: ratedVersion },
        },
        tx,
      );
      // FR-VAL-05: Bewertung erledigt eine offene Zuweisung des Nutzers.
      if (zuweisung && zuweisung.status === "open") {
        await this.assignments.update({ ...zuweisung, status: "done" }, tx);
        rueckwaerts.push(() => this.assignments.update(zuweisung));
      }
      // SCRUM-124: Gelb/Rot (warn/down) gibt das Objekt zur Nacharbeit an den Autor zurück.
      // Schemafrei über das vorhandene Assignment-Modell + Audit; Grün (up) erzeugt nichts.
      // ======================================================================================
      // BEN-70 ROT-2 — DIE SPAETERE ENTSCHEIDUNG IST DIE ENTSCHEIDUNG.
      // ======================================================================================
      //
      // Bei `warn`/`down` faellt die tragende Entscheidung in der RUECKGABE AN DEN AUTOR: sie
      // bestimmt, was mit dem Objekt geschieht. Genau ihre Referenz reist deshalb nach aussen.
      // Bei `up` gibt es keine Rueckgabe — dort bleibt es bei der Bewertungsreferenz (eigener
      // Gegenkontrollfall, damit die Korrektur nicht einfach „immer die letzte" liefert).
      //
      // JOB 557: `responsibleOf` liefert den benannten Eigentümer — und fällt NUR für Altbestand
      // ohne Aggregat auf den Autor zurück, benannt und an genau einer Stelle (ownership.ts).
      let referenz = refAus(eintrag);
      if (verdict === "warn" || verdict === "down") {
        const rueckgabeRef = await this.returnToResponsible(
          koId,
          ko,
          userId,
          verdict,
          ratedVersion,
          tx,
          rueckwaerts,
        );
        if (rueckgabeRef) {
          referenz = rueckgabeRef;
        }
      }
      return referenz;
    };

    // SCRUM-507 R2: Compare-and-Set gegen die bewertete Version. Hat ein Revise die Version
    // zwischenzeitlich erhöht, unterbleibt das Schreiben des Zustands (der Revise-Reset auf „offen"
    // bleibt gültig) → keine fälschlich gültige Alt-Bewertung. Die Stimme selbst wird dann trotzdem
    // festgehalten (`nurBeleg`), ohne Zustand und ohne Verweis — wie bisher.
    //
    // W3-C (Pedi 03.08.) — DIE ENTSCHEIDUNG WIRD AM OBJEKT FESTGEHALTEN, und zwar in DERSELBEN
    // Klammer wie Zustand und Beleg (`setValidationStateMitBeleg`): mit der bewerteten Version als
    // Compare-and-Set; ein zwischenzeitliches `revise` erbt den Verweis nicht.
    const { geschrieben, ref } = await this.koService.setValidationStateMitBeleg(
      koId,
      async () => {
        rueckwaerts.length = 0;
        const { outcome } = await lese();
        return { trust: outcome.trust, status: outcome.status };
      },
      { expectedVersion: ratedVersion, beiVersionswechsel: "nurBeleg" },
      beleg,
      async () => {
        for (const schritt of rueckwaerts.reverse()) {
          await schritt().catch(() => undefined);
        }
      },
    );
    // JOB 557: eine ABGESCHLOSSENE Validierung schreibt fort, WER sie getragen hat. Nicht die
    // Bewertung allein — erst der Übergang nach „validiert" ist die Entscheidung. Getragen haben
    // ihn die grünen Stimmen DIESER Fassung; wer `warn`/`down` gestimmt hat, hat nicht validiert.
    // Ein eigener Schritt mit eigenem Beleg (`ko.ownership-role`, gemeinsam über `schreibeMitBeleg`).
    const { all, outcome } = stand ?? (await lese());
    if (geschrieben && outcome.status === "validiert") {
      const tragende = all
        .filter((r) => ratingVersion(r) === ratedVersion && r.verdict === "up")
        .map((r) => r.userId);
      await this.koService.recordOwnershipRole(koId, "validators", tragende, userId);
    }
    return { ...outcome, validationDecisionRef: ref };
  }

  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — der Admin schließt die Validierung eines
  // Objekts komplett ab (Status „validiert", hoher Trust), unabhängig von der Peer-Stimmenlage.
  // Bewusst nur Admin (Route-Guard users.manage); der Vorgang ist als eigene Aktion im Audit
  // nachvollziehbar. Trust wird auf den Deckel (99) gesetzt — kein Wahrheitsversprechen (PI-K2),
  // aber die höchste Evidenzstufe, die das System vergibt.
  async adminValidate(
    koId: string,
    actorId: string,
    opts: { erwarteteFassung?: number } = {},
  ): Promise<ValidationDecision> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    pruefeErwarteteFassung(ko.version, opts.erwarteteFassung);
    // JOB 3789: DIE GELESENE FASSUNG BEKOMMT EINEN NAMEN — dieselbe Form wie `ratedVersion` in
    // `rate` (:232). Der Admin entscheidet über den Text, den er gelesen hat; jeder folgende
    // Schritt (Schreibvorgang, Beleg, Verweis) bindet sich an genau diese Zahl. Kein zweites
    // `get`, keine zweite Quelle — sonst wäre die Fassung, über die entschieden wurde, nicht mehr
    // dieselbe wie die, die geschrieben wird.
    const geleseneFassung = ko.version;
    // JOB 3789: Compare-and-Set gegen die gelesene Fassung. Es schützt vor „ein `revise` erhöht die
    // Version zwischen dem `get` oben und diesem Schreibvorgang, und ‚validiert' samt Vertrauen 99
    // springt auf einen Text über, den nie ein Mensch geprüft hat". Dieselbe Bindung tragen die
    // beiden Schwesterstellen: der Bewertungsweg (`rate`, :247-251) und der Verweis weiter unten.
    //
    // Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 2, BEN-B1): Zustand, `ko.admin-validated` und
    // der Verweis darauf laufen in EINER Klammer (`setValidationStateMitBeleg`) — fällt der Beleg
    // aus, bleibt das Objekt, wie es war (mit PostgreSQL: Transaktion; im Speicher: Rücknahme).
    const {
      ko: gespeichert,
      geschrieben,
      ref,
    } = await this.koService.setValidationStateMitBeleg(
      koId,
      async () => ({ trust: TRUST_MAX, status: "validiert" }),
      { expectedVersion: geleseneFassung, beiVersionswechsel: "nichts" },
      async (tx) =>
        refAus(
          await this.audit?.record(
            {
              actor: actorId,
              action: "ko.admin-validated",
              target: koId,
              payload: { koVersion: geleseneFassung },
            },
            tx,
          ),
        ),
    );
    // ==========================================================================================
    // JOB 3789 — DER VERFEHLTE WETTLAUF WIRD ERKANNT, NICHT NUR ABGEFANGEN.
    // ==========================================================================================
    //
    // Bei verfehltem Compare-and-Set schreibt die Klammer NICHTS — keinen Zustand, keinen
    // `ko.admin-validated`, keinen Verweis — und liefert das unveränderte Objekt. Ein Beleg ueber
    // einen Vorgang, den es nicht gab, waere eine Falschaussage; `validators` nennte einen Traeger
    // fuer eine Entscheidung ohne Wirkung.
    //
    // Die Antwort traegt den Stand, der wirklich gespeichert ist. Die Stimmenzahlen kommen aus den
    // Bewertungen DER JETZT GUELTIGEN Fassung (`stimmenAus` — dieselbe Zaehlung, die Board und
    // Pruefstand lesen). Feste Nullen waeren eine Behauptung ueber Stimmen, die dieser Aufruf nie
    // erhoben hat.
    if (!geschrieben) {
      const { votes } = stimmenAus(await this.ratings.listByKo(koId), gespeichert.version);
      return {
        ...votes,
        trust: gespeichert.trust,
        status: gespeichert.status,
        // `null` ist die Hausform fuer „es gibt keine Entscheidung und damit keinen Beleg"
        // (s. `ValidationDecisionRefWert`) — hier ist sie woertlich wahr.
        validationDecisionRef: null,
      };
    }
    const referenz = ref;
    // JOB 557: auch die Admin-Validierung ist eine abgeschlossene Validierung — und sie hat genau
    // EINE tragende Identität. Sie wird fortgeschrieben, sonst wäre `validators` für den Weg leer,
    // über den die Validierung am häufigsten endgültig entschieden wird.
    await this.koService.recordOwnershipRole(koId, "validators", [actorId], actorId);
    return {
      up: ko.neededValidations,
      warn: 0,
      down: 0,
      trust: TRUST_MAX,
      status: "validiert",
      validationDecisionRef: referenz,
    };
  }

  // ==============================================================================================
  // R-0507 — „DER EIGENTÜMER KANN ES FREIGEBEN."
  // ==============================================================================================
  //
  // Die Freigabe durch den benannten Eigentümer ist eine abgeschlossene Validierung mit genau EINER
  // tragenden Identität — derselbe Weg wie `adminValidate` (Compare-and-Set gegen die gelesene
  // Fassung, Zustand und Beleg in einer Klammer, Fortschreibung von `validators`). Zwei
  // Unterschiede, beide gewollt:
  //   · WER: nur der benannte Eigentümer (`ownership.owner`), geprüft HIER gegen den gelesenen
  //     Stand. Das Freigaberecht selbst (`ko.validate`) prüft die Route — der Eigentum allein
  //     verleiht keine Freigabebefugnis (ownership.ts: „keine Rechtevergabe"), es BENENNT nur,
  //     wer unter den Freigabeberechtigten das letzte Wort am eigenen Objekt hat.
  //   · WIE VIEL: das Vertrauen bleibt, wie es die Stimmen ergeben. Die Eigentümerfreigabe ist eine
  //     Entscheidung, keine zusätzliche Evidenz — anders als der Admin-Deckel (TRUST_MAX).
  // Der Beleg heisst `ko.owner-validated`; die Rückgabe der Verantwortung
  // (`KoService.releaseOwnership`) bleibt ein eigener, davon getrennter Weg.
  //
  // BEN (Nacharbeit 3): Eigentum und Vertrauen werden NICHT aus dem Vorab-Lesen übernommen. Eine
  // Eigentumsänderung (`setOwnership`, `releaseOwnership`, Wissensübergabe) erhöht die Inhaltsfassung
  // nicht — der Compare-and-Set auf `version` sähe sie nicht. Deshalb prüft der `zustand`-Rückruf,
  // der unter dem KO-Lock den FRISCH gelesenen Stand bekommt, den Eigentümer erneut und übernimmt
  // dessen aktuelles Vertrauen. Die frühe Prüfung bleibt als schnelle Abweisung ohne Schreibversuch.
  async ownerValidate(
    koId: string,
    actorId: string,
    opts: { erwarteteFassung?: number } = {},
  ): Promise<ValidationDecision> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    pruefeErwarteteFassung(ko.version, opts.erwarteteFassung);
    const nichtEigentuemer = (): ValidationError =>
      new ValidationError(
        "NOT_OWNER",
        "Nur der benannte Eigentümer kann dieses Wissensobjekt als Eigentümer freigeben.",
      );
    if (ownershipOf(ko)?.owner !== actorId) {
      throw nichtEigentuemer();
    }
    const geleseneFassung = ko.version;
    const {
      ko: gespeichert,
      geschrieben,
      ref,
    } = await this.koService.setValidationStateMitBeleg(
      koId,
      async (frisch) => {
        if (ownershipOf(frisch)?.owner !== actorId) {
          throw nichtEigentuemer();
        }
        return { trust: frisch.trust, status: "validiert" };
      },
      { expectedVersion: geleseneFassung, beiVersionswechsel: "nichts" },
      async (tx) =>
        refAus(
          await this.audit?.record(
            {
              actor: actorId,
              action: "ko.owner-validated",
              target: koId,
              payload: { koVersion: geleseneFassung },
            },
            tx,
          ),
        ),
    );
    const { votes } = stimmenAus(await this.ratings.listByKo(koId), gespeichert.version);
    if (!geschrieben) {
      return {
        ...votes,
        trust: gespeichert.trust,
        status: gespeichert.status,
        validationDecisionRef: null,
      };
    }
    await this.koService.recordOwnershipRole(koId, "validators", [actorId], actorId);
    // Die Antwort aus dem TATSÄCHLICH gespeicherten Stand — nicht aus dem Vorab-Lesen.
    return {
      ...votes,
      trust: gespeichert.trust,
      status: gespeichert.status,
      validationDecisionRef: ref,
    };
  }

  // SCRUM-124: dedupliziert eine offene Zuweisung an den VERANTWORTLICHEN + Audit-Event.
  //
  // ==============================================================================================
  // JOB 557 — DER BELEG DARF KEINE NICHT-AUTORIN `author` NENNEN.
  // ==============================================================================================
  //
  // Der Methodenname hiess `returnToAuthor` und war damit selbst Teil der Verwechslung. Er ist
  // PRIVAT — kein Vertrag nach aussen — und deshalb hier berichtigt statt stehengelassen.
  //
  // DAS PAYLOAD TRÄGT JETZT BEIDE ANGABEN, JEDE AN IHREM NAMEN:
  //   · `author`      — die Provenienz. Sie ist IMMER der wirkliche Autor des Objekts; dieses Feld
  //                     kann nach dieser Änderung keine fremde Person mehr transportieren. Es
  //                     bleibt stehen, weil bestehende Leser es erwarten.
  //   · `responsible` — wer die Nacharbeit tatsächlich bekommen hat.
  //   · `responsibleKind` — ob das ein BENANNTER Eigentümer war oder der Rückfall auf den Autor.
  //     Ohne diese Angabe müsste ein Leser raten, welcher der beiden Fälle vorliegt — und genau
  //     dieses Raten ist der Befund dieses Jobs.
  //
  // ==============================================================================================
  // JOB 557 D8 (BEN-Korrekturpflicht zu D7) — DER AKTIONSNAME SAGT JETZT DIE ROLLE.
  // ==============================================================================================
  //
  // D7 liess den Namen `ko.returned-to-author` auch dann stehen, wenn eine benannte Eigentümerin
  // die Nacharbeit bekam — und begründete das mit zwei Verbrauchern ausserhalb der damaligen
  // Lease. BEN hat das als Verstoss gewertet, und zu Recht: „`ko.returned-to-author` ist bei
  // `responsibleKind = owner` eine unwahre Produktbezeichnung." Ein Protokoll, das die falsche
  // Rolle nennt, ist schlimmer als keins — es sieht aus wie eine Auskunft.
  //
  // DER NAME FOLGT DESHALB DERSELBEN QUELLE WIE DAS PAYLOAD: `responsibleKindOf(ko)`. Es gibt
  // keine zweite Ableitung und keinen zweiten Ort, an dem die Entscheidung fallen könnte —
  // Name und `responsibleKind` können nicht auseinanderlaufen.
  //
  //   · benannte Eigentümerin  → `ko.returned-to-owner`
  //   · kein Aggregat (Altbestand) → `ko.returned-to-author`, und dort ist der Name WAHR.
  //
  // BEIDE VERBRAUCHER SIND IN DEMSELBEN DURCHGANG MITGEZOGEN — das ist die von BEN verlangte
  // Atomarität, und ohne sie wäre der neue Name ein Schaden statt einer Korrektur:
  //   · `services/audit/src/repo.ts` führt BEIDE Namen in `VALIDATION_DECISION_ACTIONS`; ohne den
  //     neuen wäre der `validationDecisionRef` am Objekt `WRONG_EVENT_TYPE` — die festgehaltene
  //     Entscheidung gälte als ungültig.
  //   · `apps/web/src/lib/validationStatus.ts` leitet „Nacharbeit" aus BEIDEN Namen ab; ohne den
  //     neuen schwiege das Board über einen Zustand, den es gibt.
  //
  // HISTORISCHE EREIGNISSE BLEIBEN LESBAR: der alte Name verschwindet an keiner Lesestelle. Was
  // sich ändert, ist ausschliesslich, was NEU emittiert wird.
  private async returnToResponsible(
    koId: string,
    ko: KnowledgeObject,
    by: string,
    verdict: Verdict,
    koVersion: number,
    // Aufnahme gesamt-auditprotokoll (Lauf 3, Runde 2): im Transaktionsweg auf dem Client der
    // Validierung; ohne Transaktion sammelt `rueckwaerts` die Rücknahmen für einen späteren Ausfall.
    tx?: TxContext,
    rueckwaerts: Array<() => Promise<void>> = [],
  ): Promise<ValidationDecisionRefWert> {
    const verantwortlich = responsibleOf(ko);
    // EINE Quelle für Name und Payload — s. Kopfkommentar. Zwei Ableitungen wären zwei Wahrheiten.
    const art = responsibleKindOf(ko);
    // Lauf 5 (BEN-R3-B1): im Transaktionsweg auf demselben Client gelesen. Über den Pool sah die
    // Rückgabe noch „offen", wenn `rate` die Zuweisung der selbst bewertenden verantwortlichen Person
    // eben in der Transaktion erledigt hatte — und unterließ das Wiederöffnen.
    const existing = await this.assignments.find(koId, verantwortlich, tx);
    if (existing) {
      if (existing.status !== "open") {
        await this.assignments.update({ ...existing, status: "open" }, tx);
        rueckwaerts.push(() => this.assignments.update(existing));
      }
    } else {
      await this.assignments.create({ koId, userId: verantwortlich, status: "open" }, tx);
      // Runde 3 (BEN-R2-B2): eine im Ausfall neu angelegte Zuweisung wird wieder ENTFERNT, nicht nur
      // als erledigt zurückgestellt — vorher gab es sie nicht. Nur ein Test-Double ohne Löschweg
      // fällt auf „erledigt" zurück (dann taucht sie auf keinem offenen Brett auf).
      rueckwaerts.push(async () => {
        if (this.assignments.remove) {
          await this.assignments.remove(koId, verantwortlich);
        } else {
          await this.assignments.update({ koId, userId: verantwortlich, status: "done" });
        }
      });
    }
    // Auch die Rueckgabe IST eine Entscheidung (KW-W3-19) — sie traegt deshalb dieselbe Bindung.
    // Die Methode ist privat; ihre Referenz reist ueber den Rueckgabewert zum Aufrufer, statt hier
    // zu verfallen.
    const beleg = await this.audit?.record(
      {
        actor: by,
        action: art === "owner" ? "ko.returned-to-owner" : "ko.returned-to-author",
        target: koId,
        payload: {
          verdict,
          author: ko.author,
          responsible: verantwortlich,
          responsibleKind: art,
          koVersion,
        },
      },
      tx,
    );
    return refAus(beleg);
  }

  // FR-VAL-03/04: Board zeigt nur offene KOs, Filter kombinierbar.
  // SCRUM-364 / AG-15 / FR-VAL-05/06: Die KO-`assignments` werden für das Board mit den OFFENEN
  // Review-Zuweisungen angereichert (aus dem AssignmentRepo) — erst dadurch arbeiten die persönliche
  // „Mir zugewiesen"-Linse und die Zugewiesen-Markierung mit echten Daten. Erledigte (done)
  // Zuweisungen erscheinen NICHT → ein KO fällt aus der persönlichen Linse, sobald die Person es
  // bewertet hat. Reine Lese-Anreicherung des vorhandenen Felds, kein neues Datenmodell, keine
  // Persistenz. KOs ohne offene Zuweisung bleiben unverändert (assignments wie vom KO-Service geliefert).
  async board(filter: BoardFilter = {}): Promise<KnowledgeObject[]> {
    const kos = await this.koService.list({ ...filter, status: "offen" });
    // JOB 3043: die Gruppierung steht in `offeneZuweisungenJeKo` — dieselbe, die beide
    // Pruefstandswege lesen. Vorher stand sie hier als eigene Schleife; die Lesart war identisch,
    // die Stelle war es nicht.
    const openByKo = offeneZuweisungenJeKo(await this.assignments.all());
    // Pedi 05.07.: Board zeigt „X von Y grün" — dafür je KO die Peer-Stimmen (grün/gelb/rot) als
    // read-only Anreicherung mitgeben. Reine Lese-Sicht auf das Rating-Repo, kein neues Datenmodell.
    return Promise.all(
      kos.map(async (ko) => {
        // SCRUM-507 R2: nur Bewertungen der AKTUELLEN Version zählen für die Anzeige; frühere werden
        // als „veraltet (vor Revision)" separat gezählt (staleVotes), nicht in up/warn/down gemischt.
        // JOB 3024: die Zählung selbst steht in `stimmenAus` — dieselbe, die `pruefstandFuer` ruft.
        const { votes, staleVotes } = stimmenAus(await this.ratings.listByKo(ko.id), ko.version);
        const assigned = openByKo.get(ko.id);
        const base = assigned ? { ...ko, assignments: assigned } : ko;
        return { ...base, reviewVotes: votes, staleVotes };
      }),
    );
  }

  /**
   * JOB 3024: Zuweisungs- und Bewertungslage GENAU eines Objekts — schreibfrei, ohne
   * Statusvorbehalt, ohne die Vollmenge des Pruefbretts. Die Begruendung steht ausgeschrieben
   * ueber `KoPruefstand`.
   *
   * `koVersion` kommt vom Aufrufer, weil der das Objekt bereits geladen hat; ein zweites
   * `koService.get` waere ein Lesevorgang fuer eine Zahl, die schon in der Hand ist. WELCHE Stimmen
   * damit zaehlen, entscheidet weiterhin dieses Modul (`stimmenAus`) und nicht der Aufrufer.
   *
   * PRÜFSTATUS-ANZEIGE (R-1524): die offenen Zuweisungen kommen seither GEZIELT ueber
   * `AssignmentRepo.listByKos([koId])` — nicht mehr ueber den Vollscan `all()`, der hier bis dahin
   * als benannte Grenze stand.
   *
   * JOB 3043: die ABLEITUNG steht seither in `pruefstandAus` und wird mit `pruefstaendeFuer`
   * geteilt. Die ZUSAGE dieser Methode ist unveraendert: GENAU EINE Bewertungsabfrage je Aufruf,
   * gezielt auf dieses Objekt (`ko-routes-anzeigestatus.test.ts`, Fall K, `toBe(1)`).
   */
  /**
   * R-0238 · Nacharbeit 8: die gespeicherte Bewertung EINER Person zu diesem Objekt samt der
   * Fassung, für die sie gilt — oder `null`. Die Fortsetzung eines unterbrochenen
   * Konfliktvorschlags belegt damit, dass die Ablehnung zu genau dieser Fassung wirklich besteht,
   * statt sie ein zweites Mal zu schreiben. Liest nur; bewertet nichts.
   */
  async bewertungVon(
    koId: string,
    userId: string,
  ): Promise<{ verdict: Verdict; koVersion: number } | null> {
    const eigene = (await this.ratings.listByKo(koId)).find((r) => r.userId === userId);
    return eigene ? { verdict: eigene.verdict, koVersion: ratingVersion(eigene) } : null;
  }

  /**
   * ADMIN-09: eine Vertretungsaufgabe aus der Freigaberegel — `durch` prüft an Stelle von `fuer`.
   * WIEDERHOLBAR: besteht für `durch` schon eine Zuweisung an diesem Objekt (gleich welcher
   * Herkunft), entsteht nichts, kein Beleg und keine neue Benachrichtigung. Die neue Zuweisung trägt
   * „ausstehend"; der Aufrufer benachrichtigt über `nochZuBenachrichtigen` und hakt ab.
   * `true` heisst: diese Aufgabe ist eben neu entstanden.
   */
  async vertretungZuweisen(
    koId: string,
    durch: string,
    fuer: string,
    actor: string,
  ): Promise<boolean> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    if (await this.assignments.find(koId, durch)) {
      return false;
    }
    await this.assignments.create({
      koId,
      userId: durch,
      status: "open",
      benachrichtigung: "ausstehend",
      quelle: "vertretung",
      vertretungFuer: fuer,
      seit: new Date(this.now()).toISOString(),
    });
    await this.audit?.record({
      actor,
      action: "ko.assigned",
      target: koId,
      payload: { userIds: [durch], quelle: "vertretung", fuer },
    });
    await this.koService.recordOwnershipRole(koId, "reviewers", [durch], actor);
    return true;
  }

  /** ADMIN-09: alle Zuweisungen dieser Objekte, offen wie erledigt — nur lesend. */
  async zuweisungenZu(koIds: readonly string[]): Promise<Assignment[]> {
    return this.assignments.listByKos(koIds);
  }

  async pruefstandFuer(koId: string, koVersion: number): Promise<KoPruefstand> {
    const [zuweisungen, bewertungen] = await Promise.all([
      this.assignments.listByKos([koId]),
      this.ratings.listByKo(koId),
    ]);
    return pruefstandAus(
      koId,
      koVersion,
      offeneZuweisungenJeKo(zuweisungen),
      bewertungenJeKo(bewertungen),
    );
  }

  /**
   * JOB 3043 — DIE PRUEFSTANDSLAGE EINER MENGE, fuer ZWEI Abfragen insgesamt.
   *
   * WOFUER ES DIESEN WEG BRAUCHT. Der Listen-Lesepfad (`GET /api/kos`) braucht dieselbe Auskunft
   * wie der Detailabruf, aber fuer JEDEN Eintrag. `pruefstandFuer` je Zeile kostete 2·N Abfragen,
   * davon N Vollscans der Zuweisungstabelle — genau der Aufwand, wegen dessen `PRIORITAETEN.md` N4
   * die Liste aus JOB 3024 ausgeklammert hat („N+1 ohne Deckel"). Diese Methode macht `2`, egal wie
   * viele Objekte kommen: `assignments.listByKos(ids)` und `ratings.listByKos(ids)`, nebenlaeufig.
   *
   * EINE LEERE EINGABE MACHT NULL ABFRAGEN. Eine leere Liste ist ein Ergebnis, keine Frage.
   *
   * DIE ANTWORT IST VOLLSTAENDIG: jede uebergebene Kennung steht in der Karte, auch die ohne
   * Zuweisung und ohne Stimme. Ein fehlender Eintrag muesste vom Aufrufer als „nichts erhoben"
   * gedeutet werden — und genau diese stille Deutung ist das, was der Anzeigestatus abschafft.
   * Doppelte Kennungen werden einmal abgefragt und einmal beantwortet.
   *
   * SCHREIBFREI wie `pruefstandFuer`, und mit derselben Zaehlung: `stimmenAus` entscheidet auch
   * hier, dass nur Stimmen der uebergebenen Fassung werten (SCRUM-507 R2).
   */
  async pruefstaendeFuer(
    kos: readonly { readonly id: string; readonly version: number }[],
  ): Promise<Map<string, KoPruefstand>> {
    const staende = new Map<string, KoPruefstand>();
    const ids = [...new Set(kos.map((ko) => ko.id))];
    if (ids.length === 0) {
      return staende;
    }
    // PRÜFSTATUS-ANZEIGE (R-1524): gezielt die Zuweisungen dieser Objekte, kein Vollscan mehr.
    const [zuweisungen, bewertungen] = await Promise.all([
      this.assignments.listByKos(ids),
      this.ratings.listByKos(ids),
    ]);
    const offeneJeKo = offeneZuweisungenJeKo(zuweisungen);
    const stimmenJeKo = bewertungenJeKo(bewertungen);
    for (const ko of kos) {
      if (!staende.has(ko.id)) {
        staende.set(ko.id, pruefstandAus(ko.id, ko.version, offeneJeKo, stimmenJeKo));
      }
    }
    return staende;
  }

  // ==============================================================================================
  // AUFNAHME gesamt-entwurf-einreichen — ZUWEISEN BEIM EINREICHEN, WIEDERHOLBAR.
  // ==============================================================================================
  //
  // Der Einreichweg (`POST /api/drafts/:id/promote`) wird nach einem Abbruch mit demselben
  // Vorgangsschlüssel wiederholt und muss dann GENAU das nachholen, was fehlt (Ben Lauf :2 F1).
  // Ben Lauf :3 Runde 1 (B2) hat gezeigt, dass „Zuweisung vorhanden" dafür nicht reicht: scheitert
  // bei zwei Prüfern die ZWEITE Zuweisung, steht die erste schon, aber niemand ist benachrichtigt —
  // die Wiederholung hielt die erste für erledigt, und ihre Benachrichtigung ging für immer verloren.
  //
  // Deshalb trägt jede hier angelegte Zuweisung ihren Benachrichtigungsstand
  // (`Assignment.benachrichtigung`): angelegt als „ausstehend", erst nach dem Versand „erledigt".
  // Die übrigen Zuweisungswege (`assign`) sind unverändert.
  //
  // Legt nur die FEHLENDEN Zuweisungen an (eine vorhandene wird nie überschrieben — ihr Status und
  // ihr Benachrichtigungsstand bleiben). Die Prüferrolle im Aggregat wird für ALLE genannten
  // Personen fortgeschrieben; das ist idempotent und holt sie nach, falls der frühere Lauf vor ihr
  // abbrach.
  async zuweisenBeimEinreichen(
    koId: string,
    userIds: readonly string[],
    actor: string,
  ): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    const neu: string[] = [];
    for (const userId of userIds) {
      if (!(await this.assignments.find(koId, userId))) {
        await this.assignments.create({
          koId,
          userId,
          status: "open",
          benachrichtigung: "ausstehend",
        });
        neu.push(userId);
      }
    }
    if (neu.length > 0) {
      await this.audit?.record({
        actor,
        action: "ko.assigned",
        target: koId,
        payload: { userIds: neu },
      });
    }
    await this.koService.recordOwnershipRole(koId, "reviewers", [...userIds], actor);
  }

  // ==============================================================================================
  // R-0571 — ZUSTÄNDIGKEIT AUS DEM VERZEICHNIS, ABGEGLICHEN STATT NUR ERGÄNZT.
  // ==============================================================================================
  //
  // `soll` sind die Personen, die laut aktuellem Gruppenstand für dieses Objekt zuständig sind.
  //   · Fehlt einer davon eine Zuweisung, entsteht sie — markiert als `quelle: "verzeichnis"`,
  //     Benachrichtigung „ausstehend" (der Aufrufer verschickt sie, s. `nochZuBenachrichtigen`).
  //   · Eine OFFENE Verzeichnis-Zuweisung an jemanden, der nicht mehr zuständig ist (Gruppe
  //     verlassen, Austritt, Objekt in einen anderen Space gewechselt), wird zurückgezogen.
  //   · Unberührt bleiben: jede Zuweisung ohne diese Herkunft (von Hand, beim Einreichen) und jede
  //     erledigte — eine abgeschlossene Prüfspur verschwindet nicht, weil sich eine Gruppe ändert.
  //     Ebenso bleibt `reviewers` im Aggregat stehen: es ist die Spur, wer je zugewiesen war.
  // Idempotent: ein zweiter Lauf mit demselben Stand ändert nichts.
  async verzeichnisAbgleichen(
    koId: string,
    soll: readonly string[],
    actor = "system",
  ): Promise<{ neu: string[]; entzogen: string[] }> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      return { neu: [], entzogen: [] };
    }
    const vorhanden = await this.assignments.listByKos([koId]);
    const entzogen: string[] = [];
    for (const a of vorhanden) {
      if (a.quelle === "verzeichnis" && a.status === "open" && !soll.includes(a.userId)) {
        if (!this.assignments.remove) {
          // Beide Ablagen (Speicher, PostgreSQL) können es; eine ohne darf nicht still nur ergänzen.
          throw new Error("AssignmentRepo.remove fehlt — Verzeichnisabgleich nicht möglich.");
        }
        await this.assignments.remove(koId, a.userId);
        entzogen.push(a.userId);
      }
    }
    const neu: string[] = [];
    for (const userId of soll) {
      if (!vorhanden.some((a) => a.userId === userId)) {
        await this.assignments.create({
          koId,
          userId,
          status: "open",
          benachrichtigung: "ausstehend",
          quelle: "verzeichnis",
        });
        neu.push(userId);
      }
    }
    if (neu.length > 0) {
      await this.audit?.record({
        actor,
        action: "ko.assigned",
        target: koId,
        payload: { userIds: neu, quelle: "verzeichnis" },
      });
      await this.koService.recordOwnershipRole(koId, "reviewers", neu, actor);
    }
    if (entzogen.length > 0) {
      await this.audit?.record({
        actor,
        action: "ko.assignment-withdrawn",
        target: koId,
        payload: { userIds: entzogen, quelle: "verzeichnis" },
      });
    }
    return { neu, entzogen };
  }

  // R-0571: die Objekte, an denen noch eine OFFENE Verzeichnis-Zuweisung hängt — auch solche, deren
  // Space inzwischen keiner Gruppe mehr zugeordnet ist. Nur für den Gesamtabgleich nach einer
  // Verzeichnisänderung.
  async koMitVerzeichnisZuweisung(): Promise<string[]> {
    const alle = await this.assignments.all();
    const offen = alle.filter((a) => a.quelle === "verzeichnis" && a.status === "open");
    return [...new Set(offen.map((a) => a.koId))];
  }

  // Wer von diesen Personen hat für das KO eine Zuweisung, deren Benachrichtigung noch AUSSTEHT?
  // Reine Lesefrage an die eigene Ablage.
  //
  // ALTBESTAND (Ben Lauf :3 Runde 2, B2-R): Zuweisungen aus der Zeit vor dem Feld tragen KEINEN
  // Benachrichtigungsstand. Ob ihre Mail lief, weiss diese Ablage nicht — der Aufrufer weiss es:
  // `altbestandBenachrichtigt` sagt, ob der frühere Lauf nachweislich über die Benachrichtigung
  // hinausgekommen ist. Ohne diesen Nachweis gilt eine feldlose Zuweisung als AUSSTEHEND — ein
  // abgebrochener alter Vorgang darf nicht allein wegen des fehlenden Feldes als fertig gelten.
  async nochZuBenachrichtigen(
    koId: string,
    userIds: readonly string[],
    opts: { altbestandBenachrichtigt: boolean },
  ): Promise<string[]> {
    const offen: string[] = [];
    for (const userId of userIds) {
      const zuweisung = await this.assignments.find(koId, userId);
      if (!zuweisung) {
        continue;
      }
      const stand =
        zuweisung.benachrichtigung ?? (opts.altbestandBenachrichtigt ? "erledigt" : "ausstehend");
      if (stand === "ausstehend") {
        offen.push(userId);
      }
    }
    return offen;
  }

  // Die Benachrichtigung über diese Zuweisung ist verschickt.
  async benachrichtigungErledigt(koId: string, userId: string): Promise<void> {
    const zuweisung = await this.assignments.find(koId, userId);
    if (zuweisung && zuweisung.benachrichtigung !== "erledigt") {
      await this.assignments.update({ ...zuweisung, benachrichtigung: "erledigt" });
    }
  }

  // FR-VAL-05: KO an ≥1 Person zuweisen.
  async assign(koId: string, userIds: string[], actor = "system"): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    for (const userId of userIds) {
      await this.assignments.create({ koId, userId, status: "open" });
    }
    await this.audit?.record({
      actor,
      action: "ko.assigned",
      target: koId,
      payload: { userIds },
    });
    // JOB 557: eine TATSÄCHLICHE Zuweisung schreibt die Prüferinnen im Aggregat fort — idempotent
    // und dedupliziert. Ohne diesen Schritt bliebe `reviewers` ein Feld, das nur normalisiert
    // werden kann und das im Betrieb niemand füllt (BENs zweiter Mangel an D6).
    //
    // NACH dem Beleg und NACH den Zuweisungen: die Fortschreibung ist die Spur eines Ereignisses,
    // nicht seine Vorbedingung. Sie erzeugt KEIN Eigentum (s. `withRole`) — wer prüft, besitzt nicht.
    await this.koService.recordOwnershipRole(koId, "reviewers", userIds, actor);
  }

  // SCRUM-363 / AG-15 / FR-VAL-05/06: die OFFENEN Review-Zuweisungen GENAU dieser Person (keine fremde
  // Ownership). Erledigte (done) Zuweisungen erscheinen nicht; Zuweisungen auf zwischenzeitlich
  // gelöschte KOs werden übersprungen. Reine Sicht auf vorhandene Daten — kein neues Notification-Backend.
  async openAssignmentsFor(userId: string): Promise<AssignmentNotice[]> {
    const all = await this.assignments.all();
    const mine = all.filter((a) => a.userId === userId && a.status === "open");
    const notices: AssignmentNotice[] = [];
    for (const a of mine) {
      const ko = await this.koService.get(a.koId);
      if (!ko) {
        continue;
      }
      // R-0894: eine offene Zuweisung an die VERANTWORTLICHE Person entsteht durch eine Rückgabe
      // (`returnToResponsible`) — kann aber auch eine gewöhnliche Zuweisung sein. Entschieden wird
      // am Protokoll dieses einen Objekts (gefilterter Leseweg, kein Vollscan — R-0726).
      const rueckgabeAm =
        a.userId === responsibleOf(ko) ? await this.offeneRueckgabeAm(ko.id) : undefined;
      notices.push(
        rueckgabeAm
          ? { koId: ko.id, title: ko.title, at: rueckgabeAm, rueckgabe: true }
          : { koId: ko.id, title: ko.title, at: ko.createdAt },
      );
    }
    return notices;
  }

  // Betroffenenrechte (R-0663): ALLE Bewertungen und Zuweisungen GENAU dieser Person — für die
  // Selbstauskunft. Nur lesend. Die Bewertungen kommen über `listByKos` in EINER Abfrage für die
  // übergebenen Objekte (der Aufrufer kennt den Bestand); die Zuweisungen über `all()`, gefiltert —
  // dieselbe Grundmenge wie `openAssignmentsFor`, hier aber auch die erledigten.
  async datenVon(
    userId: string,
    koIds: readonly string[],
  ): Promise<{ bewertungen: Rating[]; zuweisungen: Assignment[] }> {
    const [bewertungen, zuweisungen] = await Promise.all([
      this.ratings.listByKos(koIds),
      this.assignments.all(),
    ]);
    return {
      bewertungen: bewertungen.filter((r) => r.userId === userId),
      zuweisungen: zuweisungen.filter((a) => a.userId === userId),
    };
  }

  // Zeitpunkt der noch offenen Rückgabe dieses Objekts, sonst undefined (auch ohne Protokoll).
  private async offeneRueckgabeAm(koId: string): Promise<string | undefined> {
    if (!this.audit) {
      return undefined;
    }
    const relevant = (await this.audit.list({ target: koId })).filter(
      (e) => RUECKGABE_AKTIONEN.has(e.action) || RUECKGABE_ENDE_AKTIONEN.has(e.action),
    );
    const letzte = relevant.sort((x, y) => x.seq - y.seq).at(-1);
    return letzte && RUECKGABE_AKTIONEN.has(letzte.action) ? letzte.at : undefined;
  }

  // FR-VAL-06: Übersicht offen/erledigt pro Person.
  //
  // AUFTRAG-mega76 BLOCK D: `sichtbar` ist PFLICHT. Eine einzige Zuweisung auf ein vertrauliches
  // KO erzeugte hier eine neue Personenzeile mit `open: 1` — damit wurden ZUGLEICH die Existenz
  // eines vertraulichen Prüfobjekts und die Kennung der damit befassten Person sichtbar (ben,
  // sammel72). `koService.get` blendet nur den Papierkorb aus und prüft keine Betrachtersicht;
  // das Urteil kommt deshalb von aussen und greift an derselben Stelle wie der Papierkorb-Filter.
  async overview(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
  }): Promise<AssignmentSummary[]> {
    const all = await this.assignments.all();
    const byUser = new Map<string, AssignmentSummary>();
    for (const a of all) {
      // Bug (Pedi 04.07.): Zuweisungen auf zwischenzeitlich gelöschte KOs zählen nicht mehr —
      // sonst bleiben nach dem Löschen/Demo-Purge „Geister-Aufgaben" in den Kennzahlen stehen
      // (wie openAssignmentsFor, das gelöschte KOs bereits überspringt).
      const ko = await this.koService.get(a.koId);
      if (!ko || !opts.sichtbar(ko)) {
        continue;
      }
      const summary = byUser.get(a.userId) ?? { userId: a.userId, open: 0, done: 0 };
      if (a.status === "open") {
        summary.open += 1;
      } else {
        summary.done += 1;
      }
      byUser.set(a.userId, summary);
    }
    return [...byUser.values()];
  }
}
