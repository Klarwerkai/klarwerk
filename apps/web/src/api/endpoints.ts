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
  Draft,
  DraftPayload,
  Gap,
  Graph,
  KnowledgeObject,
  Notification,
  PublicUser,
  ReasonerStatus,
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
  | { action: "attach"; attachment: { name: string; mime: string; dataUrl: string } }
  | { action: "detach"; attachmentId: string }
  | { action: "category"; category: string }
  | { action: "tags"; tags: string[] }
  | {
      action: "conflict";
      conflict: { koA: string; koB: string; type: ConflictType; description: string };
    }
  | { action: "resolve-conflict"; conflictId: string; decision: string }
  | { action: "transfer-author"; newAuthor: string }
  | { action: "revalidate" };

export const endpoints = {
  ko: {
    list: (f?: KoFilter) => api.get<KnowledgeObject[]>(`/kos${qs(f)}`),
    get: (id: string) => api.get<KnowledgeObject>(`/kos/${id}`),
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
    close: (id: string) => api.put<Gap>(`/gaps/${id}`, { action: "close" }),
    assign: (id: string, expertId: string) => api.put<Gap>(`/gaps/${id}`, { expertId }),
    remove: (id: string) => api.del<void>(`/gaps/${id}?confirm=true`),
  },
  drafts: {
    list: () => api.get<Draft[]>("/drafts"),
    get: (id: string) => api.get<Draft>(`/drafts/${id}`),
    create: (payload: DraftPayload) => api.post<Draft>("/drafts", { payload }),
    remove: (id: string) => api.del<void>(`/drafts/${id}`),
    promote: (id: string) => api.post<KnowledgeObject>(`/drafts/${id}/promote`),
  },
  ask: {
    ask: (question: string) => api.post<AskResponse>("/ask", { question }),
    helpful: (koId: string) => api.post<void>("/ask/helpful", { koId }),
  },
  reasoner: {
    structure: (text: string) =>
      api.post<StructureResult>("/reasoner", { task: "structure", text }),
    assist: (text: string) => api.post<AssistResult>("/reasoner", { task: "assist", text }),
    status: () => api.get<ReasonerStatus>("/reasoner/status"),
  },
  notifications: { list: () => api.get<Notification[]>("/notifications") },
  directory: { list: () => api.get<{ id: string; name: string }[]>("/directory") },
  analytics: {
    overview: () => api.get<Analytics>("/analytics"),
    busfactor: () => api.get<BusFactorEntry[]>("/analytics/busfactor"),
  },
  audit: { list: () => api.get<AuditEntry[]>("/audit") },
  lifecycle: { pending: () => api.get<string[]>("/lifecycle/pending") },
  library: {
    graph: () => api.get<Graph>("/graph"),
    // FE-LIB-01: Server-Volltextsuche + strukturierte Filter (Art/Status/Kategorie/Tag).
    search: (params: KoFilter & { q?: string }) =>
      api.get<KnowledgeObject[]>(`/library/search${qs(params)}`),
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
