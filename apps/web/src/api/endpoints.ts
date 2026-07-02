import { api } from "./client";
import type {
  Analytics,
  AskResponse,
  AssignmentSummary,
  AssistResult,
  AuditEntry,
  BusFactorEntry,
  Conflict,
  ConflictType,
  DemoSeedResult,
  Draft,
  DraftPayload,
  EvidenceRecord,
  ExternalResult,
  Gap,
  GapPriority,
  Graph,
  ImpactReport,
  ImportCandidate,
  ImportItemInput,
  InterviewResult,
  KnowledgeObject,
  KoVersionSnapshot,
  LearningPath,
  ManagementSnapshot,
  MediaAnalysis,
  ModelRunRecord,
  Notification,
  ObjectContent,
  ObjectRef,
  OutputDocument,
  OutputKind,
  OutputSource,
  PublicUser,
  ReasonerConfigStatus,
  ReasonerStatus,
  ReviewAction,
  Role,
  StructureResult,
  Verdict,
} from "./types";

function qs(params?: Record<string, string | undefined>): string {
  if (!params) {
    return "";
  }
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== "");
  if (entries.length === 0) {
    return "";
  }
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`;
}

export type KoFilter = { type?: string; status?: string; category?: string; tag?: string };

// PUT /api/kos/:id — ein Mutations-Endpunkt, per {action} verzweigt.
export type KoAction =
  | { action: "rate"; verdict: Verdict }
  | { action: "assign"; userIds: string[] }
  | { action: "revise"; changes: DraftPayload }
  | { action: "comment"; text: string }
  | {
      action: "attach";
      attachment: {
        name: string;
        mime: string;
        dataUrl?: string;
        objectId?: string;
        thumbnail?: string;
        size?: number;
      };
    }
  | { action: "detach"; attachmentId: string }
  | { action: "category"; category: string }
  | { action: "tags"; tags: string[] }
  | {
      action: "conflict";
      conflict: { koA: string; koB: string; type: ConflictType; description: string };
    }
  | { action: "resolve-conflict"; conflictId: string; decision: string }
  | { action: "transfer-author"; newAuthor: string }
  | { action: "add-source"; source: { label: string; url?: string; excerpt?: string } }
  | { action: "remove-source"; sourceId: string }
  | { action: "revalidate" };

export const endpoints = {
  ko: {
    list: (f?: KoFilter) => api.get<KnowledgeObject[]>(`/kos${qs(f)}`),
    get: (id: string) => api.get<KnowledgeObject>(`/kos/${id}`),
    versions: (id: string) => api.get<KoVersionSnapshot[]>(`/kos/${id}/versions`),
    evidence: (id: string) => api.get<EvidenceRecord[]>(`/kos/${id}/evidence`),
    create: (body: DraftPayload) => api.post<KnowledgeObject>("/kos", body),
    act: (id: string, body: KoAction) => api.put<KnowledgeObject>(`/kos/${id}`, body),
    remove: (id: string) => api.del<void>(`/kos/${id}`),
  },
  validation: {
    board: (f?: KoFilter) => api.get<KnowledgeObject[]>(`/validation/board${qs(f)}`),
    overview: () => api.get<AssignmentSummary[]>("/validation/overview"),
  },
  conflicts: {
    list: () => api.get<Conflict[]>("/conflicts"),
    get: (id: string) => api.get<Conflict>(`/conflicts/${id}`),
    escalate: (id: string) => api.post<Conflict>(`/conflicts/${id}/escalate`),
    secondOpinion: (id: string, opinion: string) =>
      api.post<Conflict>(`/conflicts/${id}/second-opinion`, { opinion }),
  },
  gaps: {
    list: () => api.get<Gap[]>("/gaps"),
    close: (id: string) => api.put<Gap>(`/gaps/${id}`, { close: true }),
    assign: (id: string, expertId: string) => api.put<Gap>(`/gaps/${id}`, { expertId }),
    // SCRUM-115 / FE-RISK-02: Priorität der Wissenslücke setzen.
    setPriority: (id: string, priority: GapPriority) => api.put<Gap>(`/gaps/${id}`, { priority }),
    remove: (id: string) => api.del<void>(`/gaps/${id}?confirm=true`),
  },
  drafts: {
    list: () => api.get<Draft[]>("/drafts"),
    get: (id: string) => api.get<Draft>(`/drafts/${id}`),
    create: (payload: DraftPayload) => api.post<Draft>("/drafts", { payload }),
    // SCRUM-113 / FE-CAP-07: Entwurf fortsetzen (continueDraft, Originalautor bleibt).
    update: (id: string, payload: DraftPayload) => api.put<Draft>(`/drafts/${id}`, payload),
    remove: (id: string) => api.del<void>(`/drafts/${id}`),
    promote: (id: string) => api.post<KnowledgeObject>(`/drafts/${id}/promote`),
  },
  ask: {
    // FR-I18N-01: aktuelle UI-Sprache mitsenden (Default serverseitig "de").
    ask: (question: string, locale?: "de" | "en") =>
      api.post<AskResponse>("/ask", { question, ...(locale ? { locale } : {}) }),
    helpful: (koId: string) => api.post<void>("/ask/helpful", { koId }),
  },
  reasoner: {
    structure: (text: string, locale?: "de" | "en") =>
      api.post<StructureResult>("/reasoner", {
        task: "structure",
        text,
        ...(locale ? { locale } : {}),
      }),
    // SCRUM-312: optionale Bearbeitungs-Anweisung (klarer/strukturieren/erweitern/rechtschreibung
    // oder frei) — der deterministische Fallback ignoriert sie, das Modell berücksichtigt sie.
    assist: (text: string, locale?: "de" | "en", instruction?: string) =>
      api.post<AssistResult>("/reasoner", {
        task: "assist",
        text,
        ...(locale ? { locale } : {}),
        ...(instruction?.trim() ? { instruction: instruction.trim() } : {}),
      }),
    // SCRUM-132: reasoner-getriebenes Interview, stateless.
    interview: (answers: string[], locale?: "de" | "en") =>
      api.post<InterviewResult>("/reasoner", {
        task: "interview",
        answers,
        ...(locale ? { locale } : {}),
      }),
    status: () => api.get<ReasonerStatus>("/reasoner/status"),
    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten).
    config: () => api.get<ReasonerConfigStatus>("/reasoner/config"),
    // KI-Verwaltung v1: Zuordnung setzen (nur Admin; Antwort = frischer configStatus).
    updateConfig: (cfg: { global: string; perTask: Record<string, string> }) =>
      api.put<ReasonerConfigStatus>("/reasoner/config", cfg),
  },
  notifications: { list: () => api.get<Notification[]>("/notifications") },
  directory: { list: () => api.get<{ id: string; name: string }[]>("/directory") },
  analytics: {
    overview: () => api.get<Analytics>("/analytics"),
    busfactor: () => api.get<BusFactorEntry[]>("/analytics/busfactor"),
    // SCRUM-140: vorhandene Wirkungs-API anbinden (FR-ANA-02).
    impact: () => api.get<ImpactReport>("/analytics/impact"),
  },
  audit: { list: () => api.get<AuditEntry[]>("/audit") },
  // SCRUM-121: Objekt-/Attachment-Speicher — Original via Referenz statt Inline im KO.
  objects: {
    upload: (input: { name: string; mime: string; data: string; kind?: ObjectRef["kind"] }) =>
      api.post<ObjectRef>("/objects", input),
    read: (id: string) => api.get<ObjectContent>(`/objects/${id}`),
  },
  // SCRUM-382: Video-/Audio-Analyse — Transkript serverseitig (Schlüssel bleibt im Backend).
  media: {
    status: () => api.get<{ active: boolean; engine: string | null }>("/media/status"),
    analyze: (objectId: string, locale: "de" | "en") =>
      api.post<MediaAnalysis>("/media/analyze", { objectId, locale }),
  },
  lifecycle: {
    pending: () => api.get<string[]>("/lifecycle/pending"),
    // Audit B1 (02.07.2026): Anlagen-Kopplung im KO-Detail — koppeln + gekoppelte Anlagen lesen.
    couple: (assetRef: string, koId: string) =>
      api.post<void>("/lifecycle/couple", { assetRef, koId }),
    couplingsFor: (koId: string) => api.get<string[]>(`/lifecycle/couplings/${koId}`),
    // SCRUM-146: vorhandener Asset-Change-Pfad → markiert gekoppelte KOs als „prüfen".
    assetChanged: (assetRef: string) =>
      api.post<string[]>("/lifecycle/asset-changed", { assetRef }),
  },
  // SCRUM-145: vorhandene Learning-Path-API (rollenbasiert, Fortschritt serverseitig).
  learningPaths: {
    byRole: (role: string) => api.get<LearningPath>(`/learning-paths/${role}`),
    progress: (pathId: string) => api.get<string[]>(`/learning-paths/${pathId}/progress`),
    complete: (pathId: string, stepId: string) =>
      api.post<string[]>(`/learning-paths/${pathId}/complete`, { stepId }),
  },
  library: {
    graph: () => api.get<Graph>("/graph"),
    // FE-LIB-01: Server-Volltextsuche + strukturierte Filter (Art/Status/Kategorie/Tag).
    search: (params: KoFilter & { q?: string }) =>
      api.get<KnowledgeObject[]>(`/library/search${qs(params)}`),
    // SCRUM-116/108: Import-/Source-Review (JSON-Re-Import mit Review-Queue).
    importCandidates: {
      create: (items: ImportItemInput[]) =>
        api.post<ImportCandidate[]>("/library/import/candidates", { items }),
      list: () => api.get<ImportCandidate[]>("/library/import/candidates"),
      review: (id: string, action: ReviewAction, note?: string) =>
        api.put<ImportCandidate>(`/library/import/candidates/${id}`, { action, note }),
    },
  },
  // FR-EXT-03 / SCRUM-117: Output Factory — Quellen (nur validiert) + Generierung.
  output: {
    sources: () => api.get<OutputSource[]>("/output/sources"),
    generate: (body: { kind: OutputKind; koIds: string[]; audienceRole?: string | null }) =>
      api.post<OutputDocument>("/output/generate", body),
  },
  // SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot (read-only).
  management: {
    snapshot: () => api.get<ManagementSnapshot>("/management/snapshot"),
  },
  // SCRUM-165: read-only Einsicht in jüngste ModelRuns (nur Metadaten).
  modelRuns: {
    recent: (limit?: number) =>
      api.get<ModelRunRecord[]>(`/model-runs${qs({ limit: limit?.toString() })}`),
  },
  // SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2; nur Metadaten).
  evidence: {
    recent: (limit?: number) =>
      api.get<EvidenceRecord[]>(`/evidence${qs({ limit: limit?.toString() })}`),
  },
  // SCRUM-118 / FR-EXT-02: externer Such-Proxy (optional; 501 wenn deaktiviert).
  external: {
    search: (q: string) => api.get<ExternalResult[]>(`/external/search${qs({ q })}`),
  },
  // SCRUM-181: admin-only Demo-Seed für leere Instanzen (ehrliche seeded/skipped-Rückgabe).
  admin: {
    demoSeed: () => api.post<DemoSeedResult>("/admin/demo-seed", {}),
  },
  users: {
    list: () => api.get<PublicUser[]>("/users"),
    create: (name: string, email: string, password: string, role?: Role) =>
      api.post<PublicUser>("/users", { name, email, password, role }),
    approve: (id: string) => api.post<void>(`/auth/users/${id}/approve`),
    setRole: (id: string, role: Role) => api.put<void>(`/users/${id}`, { role }),
    remove: (id: string) => api.del<void>(`/users/${id}`),
    // SCRUM-148: Admin-Passwort-Reset (eigener Pfad; invalidiert Sitzungen serverseitig).
    resetPassword: (id: string, password: string) =>
      api.post<void>(`/auth/users/${id}/reset`, { password }),
  },
};
