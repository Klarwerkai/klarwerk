// FR-EXT-03 / SCRUM-117: Output-Service. Stateless — keine Persistenz, keine KO-Mutation.
// Quelle sind ausschließlich validierte KnowledgeObjects; nicht-validierte werden abgelehnt.
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import { type AuditLeser, pruefnachweiseFuer } from "./pruefnachweis";
import {
  KIND_TITLE,
  OUTPUT_NO_CHECK_NOTE,
  quellenMarke,
  renderBody,
  renderProvenance,
  toProvenance,
  toSource,
} from "./render";
import {
  type GenerateOutputInput,
  OUTPUT_KINDS,
  type OutputDocument,
  OutputError,
  type OutputPruefnachweis,
  type OutputSource,
} from "./types";
import { type Wochenupdate, WochenupdateService } from "./wochenupdate";

export interface OutputServiceDeps {
  koService: KoService;
  now?: () => number;
  /**
   * aufnahme:20260922:gesamt-dokumenterzeugung (R-0337, Nacharbeit 5): der Leseweg zum
   * Validierungsnachweis. `findBySeq` adressiert den Eintrag, `all` liefert die Kette für die
   * Integritätsprüfung (`pruefeValidationDecisionRef`, KW-W3-19). Fehlt er, ist kein Prüfdatum
   * belegbar — das steht dann als Unsicherheit da, nicht als erfundenes Datum.
   */
  audit?: AuditLeser;
}

export class OutputService {
  private readonly koService: KoService;
  private readonly now: () => number;
  private readonly audit: AuditLeser | undefined;

  constructor(deps: OutputServiceDeps) {
    this.koService = deps.koService;
    this.now = deps.now ?? (() => Date.now());
    this.audit = deps.audit;
  }

  // Nur validierte KOs sind als Output-Quelle zulässig (Anti-Fake-Guard).
  // SCRUM-415: vertrauliche KOs erscheinen NICHT als Output-Quelle — ein Output ist teilbar (externer
  // Kontext), vertrauliche Objekte bleiben davon ausgeschlossen.
  async listEligible(): Promise<OutputSource[]> {
    const kos = await this.koService.list({ status: "validiert" });
    return kos.filter((ko) => !isConfidential(ko.confidentiality)).map(toSource);
  }

  /** R-0337: das Prüfdatum je Quelle — dieselbe Lesung wie im Zuruf (`pruefnachweis.ts`). */
  private pruefnachweise(kos: readonly KnowledgeObject[]): Promise<OutputPruefnachweis[]> {
    return pruefnachweiseFuer(this.audit, kos);
  }

  async generate(input: GenerateOutputInput): Promise<OutputDocument> {
    if (!OUTPUT_KINDS.includes(input.kind)) {
      throw new OutputError("UNKNOWN_KIND", `Unbekannter Output-Typ: ${input.kind}.`);
    }
    if (input.koIds.length === 0) {
      throw new OutputError("NO_SOURCES", "Mindestens ein validiertes Wissensobjekt wählen.");
    }
    const selected: KnowledgeObject[] = [];
    for (const id of input.koIds) {
      const ko = await this.koService.get(id);
      if (!ko) {
        throw new OutputError("UNKNOWN_KO", `Wissensobjekt nicht gefunden: ${id}.`);
      }
      if (ko.status !== "validiert") {
        throw new OutputError(
          "NOT_VALIDATED",
          `Nur validierte Objekte sind als Output-Quelle zulässig: ${id}.`,
        );
      }
      // SCRUM-415: vertrauliche KOs dürfen nicht in einen (teilbaren) Output — externe Kontexte tabu.
      if (isConfidential(ko.confidentiality)) {
        throw new OutputError(
          "CONFIDENTIAL",
          `Vertrauliches Wissensobjekt darf nicht exportiert/geteilt werden: ${id}.`,
        );
      }
      selected.push(ko);
    }

    const audienceRole = input.audienceRole ?? null;
    const anlass =
      typeof input.anlass === "string" && input.anlass.trim() ? input.anlass.trim() : null;
    const generatedAt = new Date(this.now()).toISOString();
    const pruefungen = await this.pruefnachweise(selected);
    const provenance = selected.map((ko, i) =>
      // `pruefnachweise` liefert je Quelle genau einen Eintrag; der Rückfall bedient nur den
      // indizierten Zugriff (exactOptionalPropertyTypes) und heißt „kein Nachweis", nie „belegt".
      toProvenance(ko, { marke: `Q${i + 1}`, pruefung: pruefungen[i] ?? { zustand: "MISSING" } }),
    );
    const marken = selected.map((ko, i) => quellenMarke(i, ko));
    const title = KIND_TITLE[input.kind];

    // R-0350: die Betriebsmitteilung ist ein ENTWURF für Menschen — der Kopf sagt das, statt ein
    // technisches Exportgerüst zu zeigen. Er sagt auch, dass kein Modell beteiligt war.
    const kopfzeile =
      input.kind === "betriebsmitteilung"
        ? `_Entwurf · an: ${audienceRole ?? "alle Mitarbeitenden"} · aus ${selected.length} geprüften Quelle(n) zusammengestellt, ohne KI · erstellt am ${generatedAt} · vor dem Versand prüfen, kürzen und unterschreiben_`
        : `_Adressat: ${audienceRole ?? "—"} · erzeugt am ${generatedAt} · ${selected.length} validierte Quelle(n)_`;
    const header = [`# ${title}`, "", kopfzeile].join("\n");

    // AUFTRAG-mega31 BLOCK B (bens ROT-3): der Warnsatz stand ausschließlich am Ende des
    // Herkunftsblocks — also hinter dem gesamten Dokument. Wer eine fertige Arbeitsanweisung
    // durchliest, kommt dort nie an. Er sitzt jetzt direkt unter dem Exportkopf, VOR dem Rumpf;
    // renderProvenance wiederholt ihn am Ende (das bleibt bewusst so).
    const markdown = [
      header,
      "",
      OUTPUT_NO_CHECK_NOTE,
      "",
      renderBody(input.kind, selected, { marken, anlass, audienceRole, provenance }),
      "",
      renderProvenance(provenance),
    ].join("\n");

    return { kind: input.kind, title, audienceRole, generatedAt, markdown, provenance };
  }

  // RECHERCHE:pmo-fea-0004: das Wissensupdate fürs Teamgespräch — dieselbe Quelle, dieselbe Uhr.
  // Auswahl und Format stehen in `wochenupdate.ts`; hier wird nur verdrahtet.
  async wochenupdate(input: { bis?: unknown } = {}): Promise<Wochenupdate> {
    return new WochenupdateService({ koService: this.koService, now: this.now }).erzeuge(input);
  }
}
