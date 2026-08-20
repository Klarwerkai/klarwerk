import type { AuditService } from "../../audit";
import type { KnowledgeObject, KoFilter, KoService } from "../../knowledge-object";
// JOB 557 (Pedi 13.08.2026): „der Erzeuger ist nicht der Verantwortliche." Beide Helfer kommen über
// die MODULFASSADE — keine Kante in die Innereien von knowledge-object.
import { responsibleKindOf, responsibleOf } from "../../knowledge-object";
import type { AssignmentRepo, RatingRepo } from "./repo";
import {
  FALLBACK_NEEDED_VALIDATIONS,
  type ValidationSettingsRepo,
  normalizeDefaultNeeded,
} from "./settings";
import { TRUST_MAX, type ValidationOutcome, computeOutcome } from "./trust";
import { ValidationError, type Verdict } from "./types";

export type BoardFilter = Omit<KoFilter, "status">;

// SCRUM-507 R2: die von einer Bewertung bewertete KO-Version. Alt-Bewertungen ohne Feld gelten als
// Version 1 (häufigster Fall: nie revidiert; auf revidierten KOs sind sie damit stale — fail-safe).
function ratingVersion(r: { koVersion?: number }): number {
  return r.koVersion ?? 1;
}

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
}

// SCRUM-363 / AG-15 / FR-VAL-05/06: eine offene, persönliche Review-Zuweisung als leichtgewichtiger
// Hinweis (für den In-App-Feed). Enthält das Quell-KO (Titel + Erstellzeit als Sortier-/Anzeigezeit) —
// kein neues Datenmodell, nur eine Sicht auf das vorhandene Assignment + KO.
export interface AssignmentNotice {
  koId: string;
  title: string;
  at: string;
}

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
  async rate(koId: string, userId: string, verdict: Verdict): Promise<ValidationDecision> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    // SCRUM-507 R2: die Bewertung wird an die bewertete KO-VERSION gebunden. Ein nebenläufiges Revise
    // (Version+1) macht sie damit implizit stale — keine separate Invalidierung, kein Desync.
    const ratedVersion = ko.version;
    await this.ratings.upsert({
      koId,
      userId,
      verdict,
      createdAt: new Date(this.now()).toISOString(),
      koVersion: ratedVersion,
    });
    const all = await this.ratings.listByKo(koId);
    // Nur Bewertungen der aktuell bewerteten Version zählen (stale Vorversions-Bewertungen ausgeschlossen).
    const currentVotes = all.filter((r) => ratingVersion(r) === ratedVersion).map((r) => r.verdict);
    const outcome = computeOutcome(currentVotes, ko.neededValidations);
    // SCRUM-507 R2: Compare-and-Set gegen die bewertete Version. Hat ein Revise die Version
    // zwischenzeitlich erhöht, unterbleibt das Schreiben (der Revise-Reset auf „offen" bleibt gültig)
    // → keine fälschlich gültige Alt-Bewertung. setValidationState ist per-KO serialisiert.
    await this.koService.setValidationState(
      koId,
      { trust: outcome.trust, status: outcome.status },
      { expectedVersion: ratedVersion },
    );
    // W3-B (KW-W3-19): der Rueckgabewert wird FESTGEHALTEN statt verworfen. Er ist die Referenz —
    // eine spaetere Suche nach „dem passenden Eintrag" ist ausdruecklich verboten.
    // `koVersion` reist bewusst im Payload mit: die Entscheidung gilt fuer die BEWERTETE Fassung,
    // und nur so kann ein Leser spaeter `WRONG_SUBJECT` von „passt" unterscheiden.
    const beleg = await this.audit?.record({
      actor: userId,
      action: "ko.rated",
      target: koId,
      payload: { verdict, koVersion: ratedVersion },
    });
    // FR-VAL-05: Bewertung erledigt eine offene Zuweisung des Nutzers.
    const assignment = await this.assignments.find(koId, userId);
    if (assignment && assignment.status === "open") {
      await this.assignments.update({ ...assignment, status: "done" });
    }
    // SCRUM-124: Gelb/Rot (warn/down) gibt das Objekt zur Nacharbeit an den Autor zurück.
    // Schemafrei über das vorhandene Assignment-Modell + Audit; Grün (up) erzeugt nichts.
    // ==========================================================================================
    // BEN-70 ROT-2 — DIE SPAETERE ENTSCHEIDUNG IST DIE ENTSCHEIDUNG.
    // ==========================================================================================
    //
    // Bis Freeze 67 wurde der Rueckgabewert von `returnToAuthor` hier VERWORFEN, und `rate()`
    // lieferte weiter die Referenz des vorherigen `ko.rated`-Ereignisses. Der Weg war gebaut,
    // aber nicht angeschlossen — eine halbe Zusage.
    //
    // Bei `warn`/`down` faellt die tragende Entscheidung in der RUECKGABE AN DEN AUTOR: sie
    // bestimmt, was mit dem Objekt geschieht. Genau ihre Referenz reist deshalb nach aussen.
    // Bei `up` gibt es keine Rueckgabe — dort bleibt es bei der Bewertungsreferenz (eigener
    // Gegenkontrollfall, damit die Korrektur nicht einfach „immer die letzte" liefert).
    let referenz = refAus(beleg);
    if (verdict === "warn" || verdict === "down") {
      // ========================================================================================
      // JOB 557 — HIER WURDE ERZEUGER MIT VERANTWORTLICHEM VERWECHSELT.
      // ========================================================================================
      // Bis hierher stand `ko.author`: die Nacharbeit ging an die Person, die den TEXT geschrieben
      // hat. Genau diese Gleichsetzung hat Pedis Entscheidung zu JOB 557 verworfen. `responsibleOf`
      // liefert den benannten Eigentümer — und fällt NUR für Altbestand ohne Aggregat auf den Autor
      // zurück, benannt und an genau einer Stelle (ownership.ts).
      const rueckgabeRef = await this.returnToResponsible(koId, ko, userId, verdict, ratedVersion);
      if (rueckgabeRef) {
        referenz = rueckgabeRef;
      }
    }
    // JOB 557: eine ABGESCHLOSSENE Validierung schreibt fort, WER sie getragen hat. Nicht die
    // Bewertung allein — erst der Übergang nach „validiert" ist die Entscheidung. Getragen haben
    // ihn die grünen Stimmen DIESER Fassung; wer `warn`/`down` gestimmt hat, hat nicht validiert.
    if (outcome.status === "validiert") {
      const tragende = all
        .filter((r) => ratingVersion(r) === ratedVersion && r.verdict === "up")
        .map((r) => r.userId);
      await this.koService.recordOwnershipRole(koId, "validators", tragende, userId);
    }
    // ==========================================================================================
    // W3-C (Pedi 03.08.) — DIE ENTSCHEIDUNG WIRD AM OBJEKT FESTGEHALTEN.
    // ==========================================================================================
    //
    // HIER UND NICHT FRÜHER: erst an dieser Stelle steht fest, WELCHE Entscheidung trägt. Bei
    // `warn`/`down` ist es die Rückgabe an den Autor, bei `up` die Bewertung — die Fallunterscheidung
    // ist zwei Zeilen weiter oben gefallen. Ein Festhalten vor `audit.record()` wäre unmöglich (den
    // `seq` gibt es dann noch nicht), eines vor dieser Zeile wäre falsch.
    //
    // MIT DER BEWERTETEN VERSION ALS COMPARE-AND-SET: hat ein `revise` zwischenzeitlich die Version
    // erhöht, unterbleibt das Festhalten — dieselbe Regel, die schon `setValidationState` schützt.
    if (referenz) {
      await this.koService.setValidationDecisionRef(koId, referenz, {
        expectedVersion: ratedVersion,
      });
    }
    return { ...outcome, validationDecisionRef: referenz };
  }

  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — der Admin schließt die Validierung eines
  // Objekts komplett ab (Status „validiert", hoher Trust), unabhängig von der Peer-Stimmenlage.
  // Bewusst nur Admin (Route-Guard users.manage); der Vorgang ist als eigene Aktion im Audit
  // nachvollziehbar. Trust wird auf den Deckel (99) gesetzt — kein Wahrheitsversprechen (PI-K2),
  // aber die höchste Evidenzstufe, die das System vergibt.
  async adminValidate(koId: string, actorId: string): Promise<ValidationDecision> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    await this.koService.setValidationState(koId, { trust: TRUST_MAX, status: "validiert" });
    const beleg = await this.audit?.record({
      actor: actorId,
      action: "ko.admin-validated",
      target: koId,
      payload: { koVersion: ko.version },
    });
    // W3-C (Pedi 03.08.): auch die Admin-Entscheidung wird am KO festgehalten — und GENAU SIE ist
    // der Grund, warum das Rating als Träger ausschied: hier entsteht keins. Compare-and-Set gegen
    // die validierte Fassung, damit ein zwischenzeitliches `revise` den Verweis nicht erbt.
    const referenz = refAus(beleg);
    if (referenz) {
      await this.koService.setValidationDecisionRef(koId, referenz, {
        expectedVersion: ko.version,
      });
    }
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
  ): Promise<ValidationDecisionRefWert> {
    const verantwortlich = responsibleOf(ko);
    // EINE Quelle für Name und Payload — s. Kopfkommentar. Zwei Ableitungen wären zwei Wahrheiten.
    const art = responsibleKindOf(ko);
    const existing = await this.assignments.find(koId, verantwortlich);
    if (existing) {
      if (existing.status !== "open") {
        await this.assignments.update({ ...existing, status: "open" });
      }
    } else {
      await this.assignments.create({ koId, userId: verantwortlich, status: "open" });
    }
    // Auch die Rueckgabe IST eine Entscheidung (KW-W3-19) — sie traegt deshalb dieselbe Bindung.
    // Die Methode ist privat; ihre Referenz reist ueber den Rueckgabewert zum Aufrufer, statt hier
    // zu verfallen.
    const beleg = await this.audit?.record({
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
    });
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
    const all = await this.assignments.all();
    const openByKo = new Map<string, string[]>();
    for (const a of all) {
      if (a.status === "open") {
        const list = openByKo.get(a.koId) ?? [];
        list.push(a.userId);
        openByKo.set(a.koId, list);
      }
    }
    // Pedi 05.07.: Board zeigt „X von Y grün" — dafür je KO die Peer-Stimmen (grün/gelb/rot) als
    // read-only Anreicherung mitgeben. Reine Lese-Sicht auf das Rating-Repo, kein neues Datenmodell.
    return Promise.all(
      kos.map(async (ko) => {
        // SCRUM-507 R2: nur Bewertungen der AKTUELLEN Version zählen für die Anzeige; frühere werden
        // als „veraltet (vor Revision)" separat gezählt (staleVotes), nicht in up/warn/down gemischt.
        const votes: { up: number; warn: number; down: number } = { up: 0, warn: 0, down: 0 };
        let staleVotes = 0;
        for (const r of await this.ratings.listByKo(ko.id)) {
          if (ratingVersion(r) === ko.version) {
            votes[r.verdict] += 1;
          } else {
            staleVotes += 1;
          }
        }
        const assigned = openByKo.get(ko.id);
        const base = assigned ? { ...ko, assignments: assigned } : ko;
        return { ...base, reviewVotes: votes, staleVotes };
      }),
    );
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
      if (ko) {
        notices.push({ koId: ko.id, title: ko.title, at: ko.createdAt });
      }
    }
    return notices;
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
