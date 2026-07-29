// Öffentliche API des Moduls provenance (AUFTRAG-mega45 Block A, Epic SCRUM-545 Stufe 1).
//
// Rein lesend. Das Modul kennt weder knowledge-object noch conflicts noch model-runs — die
// Kompositionswurzel (services/app) bildet den Bestand auf die Eingabeformen ab. Begründung dieser
// Schnittform steht ausgeschrieben in src/types.ts.
export { projectProvenance, MAX_PROVENANCE_NODES } from "./src/project";
export type {
  ProvenanceNodeKind,
  ProvenanceEdgeKind,
  ProvenanceNodeStatus,
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceEdgeOrigin,
  ProvenanceScopeCut,
  ProvenanceGraph,
  ProvenanceAudit,
  ProvenanceProjection,
  ProvenanceInput,
  ProvenanceKoIn,
  ProvenanceQuelleIn,
  ProvenanceOriginalIn,
  ProvenanceBelegIn,
  ProvenanceVersionIn,
  ProvenanceGegenseite,
  ProvenanceErkennerIn,
  ProvenanceKonfliktIn,
  ProvenanceLaufIn,
} from "./src/types";
