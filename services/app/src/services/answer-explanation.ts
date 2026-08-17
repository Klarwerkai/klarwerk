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
import { type KnowledgeObject, type KoService, isConfidential } from "../../../knowledge-object";

export interface AnswerExplanationDeps {
  readonly answerSnapshots: AnswerSnapshotRepo;
  readonly ko: KoService;
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
}

export class AnswerExplanationService {
  private readonly answerSnapshots: AnswerSnapshotRepo;
  private readonly ko: KoService;

  constructor(deps: AnswerExplanationDeps) {
    this.answerSnapshots = deps.answerSnapshots;
    this.ko = deps.ko;
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
    for (const ref of snapshot.evidence) {
      const objekt: KnowledgeObject | undefined = await this.ko.get(ref.knowledgeObjectId);
      if (objekt === undefined) {
        verschwunden.add(ref.knowledgeObjectId);
        continue;
      }
      if (isConfidential(objekt.confidentiality) && !leser.darfVertraulich) {
        gesperrteObjekte.add(ref.knowledgeObjectId);
      }
    }
    // Eine TRAGENDE Referenz, die es nicht mehr gibt, macht den Beleg unbelastbar — eine bloss
    // herangezogene nicht. Die Ursache ist benannt und nicht geraten: KW-W3-22 verlangt genau eine
    // bekannte Ursache, und ein Objekt, das nicht mehr auffindbar ist, ist `UNKNOWN_REFERENCE`.
    const primaerFehlt = snapshot.evidence.some(
      (ref) => ref.evidenceRole === "carrying" && verschwunden.has(ref.knowledgeObjectId),
    );
    const ursache: AnswerPrimaryResolutionFailure = "UNKNOWN_REFERENCE";
    return baueAnswerExplanation(record, snapshot, {
      primaryResolvable: !primaerFehlt,
      ...(primaerFehlt ? { primaryResolutionFailure: ursache } : {}),
      gesperrt: false,
      gesperrteObjekte,
    });
  }
}
