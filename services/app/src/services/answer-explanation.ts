// ================================================================================================
// W3-C (JOB 541 D3) — DER ERKLAERDIENST. ER LIEST, ER SUCHT NICHT.
// ================================================================================================
//
// DIE EINE REGEL, aus der alles andere folgt (KW-W3-18): Der Begruendungspfad gehoert zur SELBEN
// Ausfuehrung. Spaeteres Oeffnen loest KEINE Neusuche aus. Dieser Dienst ruft deshalb weder den
// Reasoner noch die Suche; er holt Record und Snapshot, sieht am HEUTIGEN Bestand nach, was von
// den damals gebundenen Referenzen noch auflost, und rechnet daraus den Lesezustand.
//
// DREI TRENNUNGEN, die hier zusammenkommen und die man leicht vermischt:
//
//   · HISTORIE vs. GEGENWART. Der Snapshot ist von damals und aendert sich nie. Rechte und
//     Aufloesbarkeit sind von heute und werden bei jedem Lesen neu ermittelt.
//   · UNBEKANNT vs. FREMD. Beide enden auf demselben `NOT_FOUND`. Waeren sie unterscheidbar,
//     waere die blosse Kennung eine Auskunft ueber fremden Bestand.
//   · MANIPULATION vs. REDAKTION. Ein gebrochener Beleg wird nie als „Sie duerfen nur nicht
//     hinsehen" beschoenigt. Die Reihenfolge steht in `answerSnapshotIntegrity`.
import {
  type AnswerExplanationOutcome,
  type AnswerPrimaryResolutionFailure,
  type AnswerSnapshotRepo,
  baueAnswerExplanation,
  gehoertNutzer,
} from "../../../ask";
import type { Conflict } from "../../../conflicts";
import { type KnowledgeObject, type KoService, isConfidential } from "../../../knowledge-object";

export interface AnswerExplanationDeps {
  readonly answerSnapshots: AnswerSnapshotRepo;
  readonly ko: KoService;
  /**
   * R-0293: die heute offenen Widersprueche — derselbe interne Leseweg wie `GET /api/conflicts` und
   * die Evidenz der Ask-Route (`conflicts.unresolved()`). OPTIONAL: ohne ihn ist die Konfliktlage
   * ehrlich UNBEKANNT (`null`), nicht „keine".
   */
  readonly conflicts?: { unresolved(): Promise<Conflict[]> };
}

/**
 * Wer fragt — und was er heute sehen darf.
 *
 * `darfVertraulich` kommt vom Aufrufer (der Route), weil nur dort die Rolle bekannt ist. Der
 * Dienst entscheidet nicht ueber Rechte, er WENDET sie an: das haelt die Rechteauslegung an genau
 * einer Stelle im Haus und nicht an zweien, die auseinanderlaufen koennen.
 */
export interface AnswerExplanationLeser {
  readonly userId: string;
  readonly darfVertraulich: boolean;
  /**
   * Antwortbeleg-Nacharbeit 5 (Ben, R-0293/R-0317/R-0618): DIE ZENTRALE SICHTBARKEITSENTSCHEIDUNG
   * von heute — `sichtbarkeitsfilterFuer(user)` (services/app/src/sichtbarkeit.ts, `darfSehen`),
   * einschliesslich des fuehrenden Space und der Autorberechtigung. Die Route reicht sie herein;
   * der Dienst wendet sie auf JEDE gebundene Wissenseinheit an. Liegt sie vor, entscheidet sie
   * ALLEIN — `darfVertraulich` wird dann nicht zusaetzlich ausgewertet (Ben, Nacharbeit 6).
   *
   * FAIL-CLOSED: Fehlt sie (ein Aufrufer ohne Sichtbarkeitsauskunft), gilt jedes Objekt mit
   * fuehrendem Space als gesperrt — dieselbe Richtung wie `spaceErlaubt` ohne `spaceLesbar` — und
   * Vertrauliches nur bei `darfVertraulich`.
   *
   * Integration mit R-1175 (aufnahme:20260922:gesamt-rechte-inventar, Feld `sichtbar`): beide
   * Auftraege haben dieselbe Entscheidung an dieselbe Stelle gebracht. Es gibt sie hier EINMAL —
   * mit Bens Vorgabe aus Nacharbeit 6, dass keine zweite Stufenregel sie ueberstimmt.
   *
   * Integration mit aufnahme:20260922:gesamt-leserechte (Variante B, Entscheidungen 15/16 vom
   * 11.10.2026): die zentrale Regel `darfSehen` traegt seither selbst den Freigaberang (persoenliches
   * Niveau, sonst Uebergangsregel) UND die Autor-Ausnahme, die Entscheidung 15 ausdruecklich
   * behaelt. Eine zusaetzliche UND-Stufensperre hier haette genau diese Ausnahme im Erklaerweg
   * wieder aufgehoben. Uebernommen ist die Rangbildung: die Route bildet `darfVertraulich` aus
   * `freigaberang(user) >= 1` — er wirkt nur im fail-closed-Ersatzweg ohne zentrale Entscheidung.
   */
  readonly darfSehen?: (ko: KnowledgeObject) => boolean;
  /**
   * produkt:20261011:peter-p14 (Bens Befund, Nacharbeit 12 — Existenz-Seitenkanal der Konfliktlage):
   * die PAARREGEL von heute — `paarSichtbar(user, koA, koB, zugang)` aus
   * services/app/src/sichtbarkeit.ts. Ein offener Konflikt zählt für die Konfliktlage einer
   * sichtbaren Belegquelle NUR, wenn der Leser BEIDE Seiten sehen darf. Sonst verriete das Bit
   * `openConflictToday` die Existenz einer unsichtbaren Gegenseite (ohne Existenzrecht).
   * Der Dienst reicht nur den Lesezugang herein; entschieden wird zentral.
   */
  readonly paarSichtbar?: (
    koA: string,
    koB: string,
    zugang: { get(koId: string): Promise<KnowledgeObject | undefined> },
  ) => Promise<boolean>;
}

/** Fail-closed-Ersatz, wenn keine zentrale Entscheidung hereinkommt: führender Space ⇒ gesperrt. */
function ohneSpace(ko: KnowledgeObject): boolean {
  return typeof ko.spaceId !== "string";
}

/** Die Einzelregel des Erklärwegs — zentral, wenn vorhanden; sonst fail-closed (s. o.). */
function objektSichtbar(leser: AnswerExplanationLeser, ko: KnowledgeObject): boolean {
  return leser.darfSehen !== undefined
    ? leser.darfSehen(ko)
    : ohneSpace(ko) && (!isConfidential(ko.confidentiality) || leser.darfVertraulich);
}

export class AnswerExplanationService {
  private readonly answerSnapshots: AnswerSnapshotRepo;
  private readonly ko: KoService;
  private readonly conflicts: AnswerExplanationDeps["conflicts"];

  constructor(deps: AnswerExplanationDeps) {
    this.answerSnapshots = deps.answerSnapshots;
    this.ko = deps.ko;
    this.conflicts = deps.conflicts;
  }

  /**
   * Die Wissenseinheiten mit heute offenem Widerspruch — oder `null`, wenn das nicht feststellbar
   * ist. Ein gescheiterter Abruf verhindert die Erklaerung nicht; er macht die Konfliktlage nur
   * UNBEKANNT (dieselbe Beweislast-Umkehr wie `answerEvidence`, mega34).
   *
   * produkt:20261011:peter-p14 (Nacharbeit 12): gezählt werden nur Konflikte, deren BEIDE Seiten
   * der Leser heute sehen darf — die Paarregel (`leser.paarSichtbar`, sonst fail-closed dieselbe
   * Einzelregel wie für die Belege je Seite). Ein Konflikt mit unsichtbarer Gegenseite ändert die
   * Erklärung damit nicht; ein Widerruf wirkt mit dem nächsten Abruf (Rechte von heute).
   */
  private async offeneKonflikte(
    leser: AnswerExplanationLeser,
  ): Promise<ReadonlySet<string> | null> {
    if (this.conflicts === undefined) {
      return null;
    }
    let offen: Conflict[];
    try {
      offen = await this.conflicts.unresolved();
    } catch {
      return null;
    }
    const zugang = { get: (koId: string) => this.ko.get(koId) };
    const beideSichtbar = async (c: Conflict): Promise<boolean> => {
      if (leser.paarSichtbar !== undefined) {
        return leser.paarSichtbar(c.koA, c.koB, zugang);
      }
      for (const id of new Set([c.koA, c.koB])) {
        const ko = await this.ko.get(id);
        if (!ko || !objektSichtbar(leser, ko)) {
          return false;
        }
      }
      return true;
    };
    const ids = new Set<string>();
    for (const c of offen) {
      if (await beideSichtbar(c)) {
        ids.add(c.koA);
        ids.add(c.koB);
      }
    }
    return ids;
  }

  async erklaere(
    answerId: string,
    leser: AnswerExplanationLeser,
  ): Promise<AnswerExplanationOutcome> {
    const record = await this.answerSnapshots.findRecord(answerId);
    if (record === undefined) {
      return { kind: "NOT_FOUND" };
    }
    // FREMD IST WIE UNBEKANNT. Eine Systemantwort gehoert keinem Konto — auch keinem, das
    // `system` heisst (s. `AnswerOwner` in services/ask/src/types.ts). Und ein Altbestandsrecord
    // ohne Eigentum gehoert ebenfalls niemandem: fail-closed, kein Erbe fuer den Erstfragenden.
    if (!gehoertNutzer(record, leser.userId)) {
      return { kind: "NOT_FOUND" };
    }
    const snapshot = await this.answerSnapshots.latestSnapshot(answerId);
    if (snapshot === undefined) {
      // Der Record existiert ohne Beleg. Das ist ein bekannter, benannter Zustand: der Schreibweg
      // legt Record und Snapshot in zwei Schritten an (services/ask/src/service.ts), und ein
      // Ausfall dazwischen laesst genau das zurueck. Ein `NOT_FOUND` waere hier eine Luege — die
      // Antwort gibt es, nur ihren Beleg nicht.
      return { kind: "NO_SNAPSHOT", answerId: record.answerId, createdAt: record.createdAt };
    }

    // ============================================================================================
    // DIE HEUTIGE SICHT AUF DIE DAMALS GEBUNDENEN REFERENZEN.
    // ============================================================================================
    //
    // Gelesen wird ausschliesslich, was der Snapshot NENNT — kein Suchlauf, keine Erweiterung der
    // Menge. `ko.get` auf eine gebundene Kennung ist eine Aufloesung, keine Suche.
    const gesperrteObjekte = new Set<string>();
    const verschwunden = new Set<string>();
    const fassungUnaufloesbar = new Set<string>();
    for (const ref of snapshot.evidence) {
      const objekt: KnowledgeObject | undefined = await this.ko.get(ref.knowledgeObjectId);
      if (objekt === undefined) {
        verschwunden.add(ref.knowledgeObjectId);
        continue;
      }
      // R-0276: das Objekt gibt es, aber die gebundene Fassung laesst sich nicht aufloesen — sie
      // fehlt im Beleg, oder sie liegt ueber der heutigen Fassung (Fassungen wachsen nur). Das ist
      // kein unbekannter Verweis, sondern ein technisch unaufloesbarer.
      if (ref.knowledgeObjectVersion === null || ref.knowledgeObjectVersion > objekt.version) {
        fassungUnaufloesbar.add(ref.knowledgeObjectId);
      }
      // Gelesen wird mit den Rechten von HEUTE. Liegt die zentrale Sichtbarkeitsentscheidung vor
      // (`darfSehen`, samt Space-Recht und Autorberechtigung), gilt AUSSCHLIESSLICH sie — eine
      // zweite, eigene Rollenregel daneben haette berechtigten Autoren ihre eigenen vertraulichen
      // Objekte geschwaerzt (Ben, Nacharbeit 6). Fehlt sie, bleibt es fail-closed: kein fuehrender
      // Space und Vertrauliches nur mit `darfVertraulich`. Gesperrt heisst geschwaerzt — Quelle,
      // Fundstelle (gespeicherter Textauszug), Zustaendigkeit und Konfliktlage inklusive.
      if (!objektSichtbar(leser, objekt)) {
        gesperrteObjekte.add(ref.knowledgeObjectId);
      }
    }
    // Eine TRAGENDE Referenz, die es nicht mehr gibt, macht den Beleg unbelastbar — eine bloss
    // herangezogene nicht. Die Ursache ist benannt und nicht geraten: KW-W3-22 verlangt genau eine
    // bekannte Ursache. Ein Objekt, das nicht mehr auffindbar ist, ist `UNKNOWN_REFERENCE`; das
    // wiegt schwerer als eine unaufloesbare Fassung und gewinnt deshalb, wenn beides vorliegt.
    const tragendIn = (menge: ReadonlySet<string>): boolean =>
      snapshot.evidence.some(
        (ref) => ref.evidenceRole === "carrying" && menge.has(ref.knowledgeObjectId),
      );
    const ursache: AnswerPrimaryResolutionFailure | undefined = tragendIn(verschwunden)
      ? "UNKNOWN_REFERENCE"
      : tragendIn(fassungUnaufloesbar)
        ? "UNRESOLVABLE_REFERENCE"
        : undefined;
    return baueAnswerExplanation(record, snapshot, {
      primaryResolvable: ursache === undefined,
      ...(ursache !== undefined ? { primaryResolutionFailure: ursache } : {}),
      gesperrt: false,
      gesperrteObjekte,
      offeneKonflikte: await this.offeneKonflikte(leser),
    });
  }
}
