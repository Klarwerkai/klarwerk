// FR-EXT-03 / SCRUM-117: Output-Service. Stateless — keine Persistenz, keine KO-Mutation.
// Quelle sind ausschließlich validierte KnowledgeObjects; nicht-validierte werden abgelehnt.
import { type KnowledgeObject, type KoService, isConfidential } from "../../knowledge-object";
import { KIND_TITLE, renderBody, renderProvenance, toProvenance, toSource } from "./render";
import {
  type GenerateOutputInput,
  OUTPUT_KINDS,
  type OutputDocument,
  OutputError,
  type OutputSource,
} from "./types";

export interface OutputServiceDeps {
  koService: KoService;
  now?: () => number;
}

export class OutputService {
  private readonly koService: KoService;
  private readonly now: () => number;

  constructor(deps: OutputServiceDeps) {
    this.koService = deps.koService;
    this.now = deps.now ?? (() => Date.now());
  }

  // Nur validierte KOs sind als Output-Quelle zulässig (Anti-Fake-Guard).
  // SCRUM-415: vertrauliche KOs erscheinen NICHT als Output-Quelle — ein Output ist teilbar (externer
  // Kontext), vertrauliche Objekte bleiben davon ausgeschlossen.
  async listEligible(): Promise<OutputSource[]> {
    const kos = await this.koService.list({ status: "validiert" });
    return kos.filter((ko) => !isConfidential(ko.confidentiality)).map(toSource);
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
    const generatedAt = new Date(this.now()).toISOString();
    const provenance = selected.map(toProvenance);
    const title = KIND_TITLE[input.kind];

    const header = [
      `# ${title}`,
      "",
      `_Adressat: ${audienceRole ?? "—"} · erzeugt am ${generatedAt} · ${selected.length} validierte Quelle(n)_`,
    ].join("\n");

    const markdown = [
      header,
      "",
      renderBody(input.kind, selected),
      "",
      renderProvenance(provenance),
    ].join("\n");

    return { kind: input.kind, title, audienceRole, generatedAt, markdown, provenance };
  }
}
