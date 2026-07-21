import { api } from "./client";
import type {
  Analytics,
  AnswerResult,
  AskResponse,
  AssignmentSummary,
  AssistPreset,
  AssistResult,
  AuditEntry,
  BusFactorEntry,
  Confidentiality,
  Conflict,
  ConflictSelfTestResult,
  ConflictType,
  DemoSeedResult,
  DescribeImageResult,
  Draft,
  DraftPayload,
  DuplicateSelfTestResult,
  EnrichResult,
  EvidenceRecord,
  ExampleLoadResponse,
  ExpertiseEntry,
  ExternalKnowledgeStage,
  ExternalResult,
  ExtractResult,
  Gap,
  GapPriority,
  Graph,
  ImpactReport,
  ImportApplyResponse,
  ImportCandidate,
  ImportCleanupPreview,
  ImportCleanupResult,
  ImportExploreResponse,
  ImportGroupResponse,
  ImportItemInput,
  ImportSelectCriteria,
  ImportSelectResponse,
  InterviewResult,
  KnowledgeCheckResult,
  KnowledgeObject,
  KoVersionSnapshot,
  LearningPath,
  LiveWall,
  ManagementSnapshot,
  MediaAnalysis,
  ModelRunRecord,
  Notification,
  ObjectContent,
  ObjectRef,
  OutputDocument,
  OutputKind,
  OutputSource,
  OverlapEntry,
  OverlapSettings,
  PublicUser,
  ReasonerConfigStatus,
  ReasonerProbeResult,
  ReasonerStatus,
  ReviewAction,
  Role,
  SlideConvertResponse,
  StructureResult,
  TrashedKo,
  UploadLimits,
  ValidationSettings,
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

// SCRUM-502 Round 4: die Einstufung ist an den VERARBEITETEN Text gebunden. Da die Reasoner-Aktionen
// immer client-gelieferten Text bearbeiten (Editor/Upload, nie den gespeicherten KO-Body), deklariert
// der Client die AKTUELLE Stufe des Textes selbst:
//  - source "draft":              getippter/bearbeiteter Text (Capture, Studio, KnowledgeDetail-Editor).
//  - source "transient-document": hochgeladener Dokumenttext (BodyExtractPanel/„Aus Datei").
// `confidentiality` ist Pflicht (inkl. "intern"). Optionale `koId` ist NUR ein hebender Backstop
// (Downgrade-Schutz eines gespeichert-vertraulichen KOs), NIE ein Freigabe-Anker.
export type ReasonerProvenance = {
  source: "draft" | "transient-document";
  confidentiality: Confidentiality;
  koId?: string;
};

function provenanceFields(p: ReasonerProvenance): Record<string, string> {
  return {
    source: p.source,
    confidentiality: p.confidentiality,
    ...(p.koId ? { koId: p.koId } : {}),
  };
}

// PUT /api/kos/:id — ein Mutations-Endpunkt, per {action} verzweigt.
export type KoAction =
  | { action: "rate"; verdict: Verdict }
  // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die Validierung komplett ab.
  | { action: "admin-validate" }
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
  // SCRUM-415: Vertraulichkeitsstufe setzen/ändern (mit Audit).
  | { action: "confidentiality"; level: Confidentiality }
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
    // SCRUM-395: optionaler Prüfer-Vorschlag direkt beim Einreichen (reviewerIds).
    create: (body: DraftPayload & { reviewerIds?: string[] }) =>
      api.post<KnowledgeObject>("/kos", body),
    act: (id: string, body: KoAction) => api.put<KnowledgeObject>(`/kos/${id}`, body),
    remove: (id: string) => api.del<void>(`/kos/${id}`),
    // SCRUM-422: Papierkorb (nur Admin): Liste, Wiederherstellen, sofortige Endlöschung.
    trash: () => api.get<TrashedKo[]>("/kos/trash"),
    restore: (id: string) => api.post<KnowledgeObject>(`/kos/${id}/restore`),
    purge: (id: string) => api.del<void>(`/kos/trash/${id}`),
  },
  validation: {
    board: (f?: KoFilter) => api.get<KnowledgeObject[]>(`/validation/board${qs(f)}`),
    overview: () => api.get<AssignmentSummary[]>("/validation/overview"),
    // SCRUM-395: Standard-Prüferanzahl (lesen: alle Leseberechtigten; setzen: Admin).
    settings: () => api.get<ValidationSettings>("/validation/settings"),
    saveSettings: (defaultNeededValidations: number) =>
      api.put<ValidationSettings>("/validation/settings", { defaultNeededValidations }),
  },
  conflicts: {
    list: () => api.get<Conflict[]>("/conflicts"),
    get: (id: string) => api.get<Conflict>(`/conflicts/${id}`),
    escalate: (id: string) => api.post<Conflict>(`/conflicts/${id}/escalate`),
    secondOpinion: (id: string, opinion: string) =>
      api.post<Conflict>(`/conflicts/${id}/second-opinion`, { opinion }),
    // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch" schließt den Konflikt.
    dismiss: (id: string, note?: string) =>
      api.post<Conflict>(`/conflicts/${id}/dismiss`, note ? { note } : {}),
  },
  // Berater-Konzept Duplikate 04.07. (Stufe D4): Überschneidungs-/Duplikat-Board. Liste + Detail
  // lesen alle Leseberechtigten; die menschlichen Abschlüsse sind kuratorische Entscheidungen.
  duplicates: {
    list: () => api.get<OverlapEntry[]>("/duplicates"),
    get: (id: string) => api.get<OverlapEntry>(`/duplicates/${id}`),
    dismiss: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/dismiss`, note ? { note } : {}),
    keepSeparate: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/keep-separate`, note ? { note } : {}),
    linkRelated: (id: string, note?: string) =>
      api.post<OverlapEntry>(`/duplicates/${id}/link-related`, note ? { note } : {}),
    // Pedi 04.07.: Anzeige-Schwelle (lesen: alle Leseberechtigten; setzen: Admin).
    settings: () => api.get<OverlapSettings>("/duplicates/settings"),
    saveSettings: (minConfidence: number) =>
      api.put<OverlapSettings>("/duplicates/settings", { minConfidence }),
  },
  gaps: {
    list: () => api.get<Gap[]>("/gaps"),
    close: (id: string) => api.put<Gap>(`/gaps/${id}`, { close: true }),
    assign: (id: string, expertId: string) => api.put<Gap>(`/gaps/${id}`, { expertId }),
    // SCRUM-115 / FE-RISK-02: Priorität der Wissenslücke setzen.
    setPriority: (id: string, priority: GapPriority) => api.put<Gap>(`/gaps/${id}`, { priority }),
    remove: (id: string) => api.del<void>(`/gaps/${id}?confirm=true`),
  },
  // WP-D11: PPTX-Folien → PNG je Folie (Server-Konvertierung; base64 konsistent zum Objekt-Upload).
  slides: {
    convert: (dataBase64: string) =>
      api.post<SlideConvertResponse>("/capture/slides", { data: dataBase64 }),
  },
  drafts: {
    list: () => api.get<Draft[]>("/drafts"),
    get: (id: string) => api.get<Draft>(`/drafts/${id}`),
    // SCRUM-395-Beifang (BUG): Body war fälschlich als { payload } verschachtelt — der Server
    // erwartet die DraftPayload-Felder FLACH (wie update/promote). Folge: frisch gespeicherte
    // Entwürfe verloren Titel & Inhalte bis zum ersten Update. Jetzt konsistent flach.
    create: (payload: DraftPayload) => api.post<Draft>("/drafts", payload),
    // SCRUM-113 / FE-CAP-07: Entwurf fortsetzen (continueDraft, Originalautor bleibt).
    update: (id: string, payload: DraftPayload) => api.put<Draft>(`/drafts/${id}`, payload),
    remove: (id: string) => api.del<void>(`/drafts/${id}`),
    // SCRUM-395: optionaler Prüfer-Vorschlag auch auf dem Entwurfs-Weg.
    promote: (id: string, body?: { reviewerIds: string[] }) =>
      api.post<KnowledgeObject>(`/drafts/${id}/promote`, body),
  },
  ask: {
    // FR-I18N-01: aktuelle UI-Sprache mitsenden (Default serverseitig "de").
    ask: (question: string, locale?: "de" | "en") =>
      api.post<AskResponse>("/ask", { question, ...(locale ? { locale } : {}) }),
    helpful: (koId: string) => api.post<void>("/ask/helpful", { koId }),
  },
  // SCRUM-527: Live-Check eines Entwurfstextes (Ähnlichkeit/Widerspruch gegen den Bestand).
  knowledge: {
    check: (text: string) => api.post<KnowledgeCheckResult>("/knowledge/check", { text }),
  },
  // Klara Stufe 2: KI-Antwort NUR aus mitgesandten Hilfe-Schnipseln (ehrliche Luecke sonst).
  help: {
    explain: (body: {
      question: string;
      snippets: { id: string; title: string; body: string }[];
      locale?: "de" | "en";
    }) => api.post<AnswerResult>("/help/explain", body),
  },
  reasoner: {
    structure: (text: string, locale: "de" | "en" | undefined, provenance: ReasonerProvenance) =>
      api.post<StructureResult>("/reasoner", {
        task: "structure",
        text,
        ...(locale ? { locale } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-312: optionale Bearbeitungs-Anweisung (klarer/strukturieren/erweitern/rechtschreibung
    // oder frei) — der deterministische Fallback ignoriert sie, das Modell berücksichtigt sie.
    assist: (
      text: string,
      locale: "de" | "en" | undefined,
      instruction: string | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<AssistResult>("/reasoner", {
        task: "assist",
        text,
        ...(locale ? { locale } : {}),
        ...(instruction?.trim() ? { instruction: instruction.trim() } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-132: reasoner-getriebenes Interview, stateless.
    interview: (
      answers: string[],
      locale: "de" | "en" | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<InterviewResult>("/reasoner", {
        task: "interview",
        answers,
        ...(locale ? { locale } : {}),
        ...provenanceFields(provenance),
      }),
    // WP-BILD-1c/1f: KI-Bildbeschreibung als VORSCHLAG für die Bild-Fußnote (Vision). EIGENE
    // Route (bens P2: nur der Bild-Task trägt die große Parsergrenze); die Provenienz läuft wie
    // bei den Text-Tasks mit — vertrauliche Entwürfe erreichen die Cloud nie.
    describeImage: (
      dataUrl: string,
      locale: "de" | "en" | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<DescribeImageResult>("/reasoner/describe", {
        dataUrl,
        ...(locale ? { locale } : {}),
        ...provenanceFields(provenance),
      }),
    // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag).
    // SCRUM-451: outputLanguage "source" = Ergebnis bleibt in der Sprache des Dokuments.
    extract: (
      text: string,
      locale: "de" | "en" | undefined,
      query: string | undefined,
      outputLanguage: "system" | "source" | undefined,
      provenance: ReasonerProvenance,
    ) =>
      api.post<ExtractResult>("/reasoner", {
        task: "extract",
        text,
        ...(locale ? { locale } : {}),
        ...(query?.trim() ? { query: query.trim() } : {}),
        ...(outputLanguage === "source" ? { outputLanguage } : {}),
        ...provenanceFields(provenance),
      }),
    // SCRUM-426: Public-KI-Anreicherung (Modellwissen) — extern/ungeprüft; nur wenn der
    // Admin-Regler (SCRUM-414) auf „offen" steht (Server prüft, sonst 403).
    enrich: (query: string, locale?: "de" | "en") =>
      api.post<EnrichResult>("/reasoner/enrich", { query, ...(locale ? { locale } : {}) }),
    status: () => api.get<ReasonerStatus>("/reasoner/status"),
    // SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten).
    config: () => api.get<ReasonerConfigStatus>("/reasoner/config"),
    // KI-Verwaltung v1: Zuordnung setzen (nur Admin; Antwort = frischer configStatus).
    updateConfig: (cfg: { global: string; perTask: Record<string, string> }) =>
      api.put<ReasonerConfigStatus>("/reasoner/config", cfg),
    // Key-Test (Pedi 02.07.): echter Mini-Modellaufruf (nur Admin, ehrliches Ergebnis).
    test: () => api.post<ReasonerProbeResult>("/reasoner/test"),
    // SCRUM-428: Key-Test für den eigenen lokalen LLM (echter Mini-Aufruf über den Tunnel).
    testLocal: () => api.post<ReasonerProbeResult>("/reasoner/test-local"),
    // SCRUM-493: End-to-End-Selbsttest der Konflikterkennung (echter judgeConflict + kollision).
    conflictSelfTest: () => api.post<ConflictSelfTestResult>("/reasoner/conflict-self-test"),
    duplicateSelfTest: () => api.post<DuplicateSelfTestResult>("/reasoner/duplicate-self-test"),
    // SCRUM-386: kundeneigene KI-Assist-Presets — lesen alle Rollen (Palette), pflegen nur Admin.
    assistPresets: () => api.get<AssistPreset[]>("/reasoner/assist-presets"),
    updateAssistPresets: (presets: { id?: string; name: string; instruction: string }[]) =>
      api.put<AssistPreset[]>("/reasoner/assist-presets", { presets }),
  },
  notifications: {
    list: () => api.get<Notification[]>("/notifications"),
    // Audit-P3 (SCRUM-397): bewusstes Als-gesehen-Markieren (idempotent, nur eigene Sicht).
    markSeen: (ids: string[]) => api.post<{ unseenCount: number }>("/notifications/seen", { ids }),
  },
  directory: { list: () => api.get<{ id: string; name: string }[]>("/directory") },
  // Audit-P4 (SCRUM-398): Live-Wall (read-only Aggregation).
  livewall: { get: () => api.get<LiveWall>("/livewall") },
  analytics: {
    overview: () => api.get<Analytics>("/analytics"),
    busfactor: () => api.get<BusFactorEntry[]>("/analytics/busfactor"),
    // Consultant-System (Experten-Matching): Thema → Personen. Hinter Feature-Flag (Default AUS → 404)
    // und ko.assign — der Aufruf erfolgt nur für berechtigte Rollen (siehe useExpertise/canSeeExpertise).
    expertise: () => api.get<ExpertiseEntry[]>("/analytics/expertise"),
    // SCRUM-140: vorhandene Wirkungs-API anbinden (FR-ANA-02).
    impact: () => api.get<ImpactReport>("/analytics/impact"),
  },
  audit: {
    list: () => api.get<AuditEntry[]>("/audit"),
    // SCRUM-439: aktive Integritätsprüfung der Audit-Kette (Admin-Knopf „Integrität geprüft").
    verify: () => api.get<{ ok: boolean; count: number }>("/audit/verify"),
  },
  // SCRUM-121: Objekt-/Attachment-Speicher — Original via Referenz statt Inline im KO.
  objects: {
    // SCRUM-521 (WP1): optionale Vertraulichkeit beim Upload PERSISTIEREN. Der Medien-Egress liest sie
    // serverseitig aus dem gespeicherten Objekt; nur so kann ein als „intern" hochgeladenes Medium extern
    // transkribiert werden. Ohne Wert bleibt das Objekt serverseitig fail-safe vertraulich.
    upload: (input: {
      name: string;
      mime: string;
      data: string;
      kind?: ObjectRef["kind"];
      confidentiality?: Confidentiality;
    }) => api.post<ObjectRef>("/objects", input),
    read: (id: string) => api.get<ObjectContent>(`/objects/${id}`),
  },
  // SCRUM-382: Video-/Audio-Analyse — Transkript serverseitig (Schlüssel bleibt im Backend).
  media: {
    status: () => api.get<{ active: boolean; engine: string | null }>("/media/status"),
    // SCRUM-502 R7: die Vertraulichkeit des Mediums mitsenden (Upload = transient-document).
    // Fehlt/ungültig → serverseitig fail-safe vertraulich → kein externer Transkriptions-Egress.
    analyze: (objectId: string, locale: "de" | "en", confidentiality?: Confidentiality) =>
      api.post<MediaAnalysis>("/media/analyze", {
        objectId,
        locale,
        ...(confidentiality ? { confidentiality } : {}),
      }),
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
  // SCRUM-421: einstellbare Upload-Grenzen (lesen: alle Leseberechtigten; setzen: Admin).
  uploadLimits: {
    get: () => api.get<UploadLimits>("/upload-limits"),
    save: (limits: UploadLimits) => api.put<UploadLimits>("/upload-limits", limits),
  },
  external: {
    search: (q: string) => api.get<ExternalResult[]>(`/external/search${qs({ q })}`),
    // SCRUM-414: Admin-Regler „externe Wissensabfrage" (lesen: alle; setzen: Admin).
    policy: () => api.get<{ stage: ExternalKnowledgeStage }>("/external/policy"),
    savePolicy: (stage: ExternalKnowledgeStage) =>
      api.put<{ stage: ExternalKnowledgeStage }>("/external/policy", { stage }),
  },
  // SCRUM-181: admin-only Demo-Seed für leere Instanzen (ehrliche seeded/skipped-Rückgabe).
  admin: {
    // Pedi 05.07. (Beta): `force` lädt das Demo-Set auch bei bereits erfassten Daten.
    // SCRUM-487: `locale` (UI-Sprache) steuert die Sprache der Demo-Inhalte (Server-Default "de").
    demoSeed: (force = false, locale?: string) =>
      api.post<DemoSeedResult>("/admin/demo-seed", { force, ...(locale ? { locale } : {}) }),
    // Pedi 02.07./05.07.: Demodaten komplett entfernen (inkl. Demo-Anwender); Merker überlebt
    // Tester-Bearbeitungen.
    demoPurge: () =>
      api.del<{ kos: number; conflicts: number; duplicates: number; gaps: number; users: number }>(
        "/admin/demo-seed",
      ),
    // Pedi 05.07. (Beta): Werksreset — Verfügbarkeit (nur Desktop/Dev) + Ausführen (löscht alles,
    // beendet das Programm; nächster Start = Ersteinrichtung).
    factoryResetStatus: () => api.get<{ available: boolean }>("/admin/factory-reset"),
    // SCRUM-450: Werksreset erst nach Passwort-Bestätigung des Admins (Re-Authentifizierung).
    factoryReset: (password: string) =>
      api.post<{ ok: boolean }>("/admin/factory-reset", { password }),
    // IC-2 (Import-Cockpit): READ-ONLY Erkundung „was ist da" VOR jedem Import. Schreibt nichts —
    // liefert nur die aggregierte Landkarte (Mengen/Autoren/Themen/Zeitraum) + truncated.
    import: {
      explore: () => api.post<ImportExploreResponse>("/admin/import/confluence/explore", {}),
      // IC-3: READ-ONLY Auswahl-Vorschau (Prompt und/oder Klick-Kriterien). Schreibt nichts.
      select: (body: { prompt?: string; criteria?: ImportSelectCriteria }) =>
        api.post<ImportSelectResponse>("/admin/import/confluence/select", body),
      // WP-IC-4 (Schritt 4): KI-Gruppierung (read-only; ehrlicher deterministischer Fallback).
      group: (body: { criteria?: ImportSelectCriteria; locale?: "de" | "en" }) =>
        api.post<ImportGroupResponse>("/admin/import/confluence/group", body),
      // WP-IC-4 (Schritt 5): Übernahme in die BESTEHENDE Review-Queue (Batch, ehrliche Teil-Bilanz).
      apply: (body: {
        criteria?: ImportSelectCriteria;
        includeIds: string[];
        snapshotToken?: number;
      }) => api.post<ImportApplyResponse>("/admin/import/confluence/apply", body),
      // WP-D-CLEAN: zweistufiges Testdaten-Aufräumen (ohne confirm = Vorschau).
      cleanupPreview: () => api.post<ImportCleanupPreview>("/admin/import/cleanup", {}),
      cleanupConfirm: () =>
        api.post<ImportCleanupResult>("/admin/import/cleanup", { confirm: true }),
      // WP-B6: EIN kuratiertes Beispielpaket laden (idempotent).
      loadExamples: (pkg: string) =>
        api.post<ExampleLoadResponse>("/admin/examples/load", { package: pkg }),
    },
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
