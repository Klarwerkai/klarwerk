import { useQuery } from "@tanstack/react-query";
import { type KoFilter, endpoints } from "./endpoints";

// Lese-Hooks (TanStack Query) gegen die Modul-Endpunkte. Mutationen werden je
// Screen mit useMutation gebaut (mit Invalidierung der passenden Keys).
export const useKos = (f?: KoFilter) =>
  useQuery({ queryKey: ["kos", f], queryFn: () => endpoints.ko.list(f) });
export const useLibrarySearch = (params: KoFilter & { q?: string }) =>
  useQuery({
    queryKey: ["library", "search", params],
    queryFn: () => endpoints.library.search(params),
  });
// FUNKE F1 (nacht24 Paket 6): persönliche Wirkungs-Zähler.
export const useMyImpact = () =>
  useQuery({ queryKey: ["me", "impact"], queryFn: () => endpoints.me.impact() });
export const useImportCandidates = () =>
  useQuery({
    queryKey: ["import-candidates"],
    queryFn: () => endpoints.library.importCandidates.list(),
  });
// FR-EXT-03 / SCRUM-117: nur validierte KOs als Output-Quellen.
export const useOutputSources = () =>
  useQuery({ queryKey: ["output", "sources"], queryFn: () => endpoints.output.sources() });
// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot (Live-Daten).
export const useManagementSnapshot = () =>
  useQuery({
    queryKey: ["management", "snapshot"],
    queryFn: () => endpoints.management.snapshot(),
  });
// SCRUM-165: read-only Einsicht in jüngste ModelRuns.
export const useModelRuns = (limit?: number) =>
  useQuery({
    queryKey: ["model-runs", limit],
    queryFn: () => endpoints.modelRuns.recent(limit),
  });
// SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2).
export const useEvidenceIndex = (limit?: number) =>
  useQuery({
    queryKey: ["evidence", "index", limit],
    queryFn: () => endpoints.evidence.recent(limit),
  });
export const useKo = (id: string) =>
  useQuery({ queryKey: ["ko", id], queryFn: () => endpoints.ko.get(id), enabled: id.length > 0 });
export const useKoVersions = (id: string) =>
  useQuery({
    queryKey: ["ko", id, "versions"],
    queryFn: () => endpoints.ko.versions(id),
    enabled: id.length > 0,
  });
export const useKoEvidence = (id: string) =>
  useQuery({
    queryKey: ["ko", id, "evidence"],
    queryFn: () => endpoints.ko.evidence(id),
    enabled: id.length > 0,
  });
export const useValidationBoard = (f?: KoFilter) =>
  useQuery({ queryKey: ["validation", "board", f], queryFn: () => endpoints.validation.board(f) });
export const useValidationOverview = () =>
  useQuery({ queryKey: ["validation", "overview"], queryFn: endpoints.validation.overview });
// AUFTRAG-mega29 C2: die Abdeckungs-Zusammenfassung für die LEEREN Konflikt-/Duplikat-Boards.
export const useAiCheckCoverageSummary = () =>
  useQuery({
    queryKey: ["ai-check", "coverage-summary"],
    queryFn: endpoints.aiCheck.coverageSummary,
  });
export const useConflicts = () =>
  // Der Aufruf bleibt LAZY (wie useKos): die Endpunkt-Funktion wird erst im queryFn ausgelesen,
  // nicht schon beim Rendern des Hooks. Sonst reißt jede Oberfläche, die diesen Hook mitzieht,
  // an einem teilweise gesetzten `endpoints`-Objekt ab, bevor react-query überhaupt lädt.
  useQuery({ queryKey: ["conflicts"], queryFn: () => endpoints.conflicts.list() });
// Berater-Konzept Duplikate 04.07. (Stufe D4): offene Überschneidungen fürs Duplikate-Board.
export const useDuplicates = () =>
  useQuery({ queryKey: ["duplicates"], queryFn: endpoints.duplicates.list });
export const useGaps = () => useQuery({ queryKey: ["gaps"], queryFn: endpoints.gaps.list });
// FUNKE-FIX2 P0 (bens Erforderlich 1): nur aggregierte Zähler für die Startseite (kein Volltext-Fetch).
export const useGapsSummary = () =>
  useQuery({ queryKey: ["gaps", "summary"], queryFn: endpoints.gaps.summary });
export const useDrafts = () => useQuery({ queryKey: ["drafts"], queryFn: endpoints.drafts.list });
export const useAnalytics = () =>
  useQuery({ queryKey: ["analytics"], queryFn: endpoints.analytics.overview });
export const useImpact = () =>
  useQuery({ queryKey: ["analytics", "impact"], queryFn: endpoints.analytics.impact });
export const useBusFactor = () =>
  useQuery({ queryKey: ["busfactor"], queryFn: endpoints.analytics.busfactor });
// Consultant-System (Experten-Matching): nur für berechtigte Rollen aktiv (ko.assign → controller/admin;
// siehe canSeeExpertise). Kein Retry — bei ausgeschaltetem Flag antwortet der Server 404, das soll nicht
// wiederholt werden. Ohne `enabled` bleibt es exakt beim heutigen Verhalten (kein Aufruf, keine Anzeige).
export const useExpertise = (enabled: boolean) =>
  useQuery({
    queryKey: ["analytics", "expertise"],
    queryFn: endpoints.analytics.expertise,
    enabled,
    retry: false,
  });
// AUFTRAG-mega46 Block F: die Betriebsschalter dieser Instanz. Sie ändern sich im laufenden Betrieb
// nicht (ein Schalter wird beim Serverstart gesetzt), deshalb ausdrücklich KEIN Nachladen und kein
// Ablauf — einmal je Sitzung genügt. Kein Retry: Antwortet der Server nicht, gilt „unbekannt", und
// „unbekannt" heißt fail-closed „aus" (siehe FeatureGate).
// AUFTRAG-mega61 Block A: die Auskunft antwortet jetzt AUCH einem Unangemeldeten — mit der
// Teilmenge, deren Fläche vor der Anmeldung erreichbar ist (Rechtsseiten, Hinweisbanner). Damit
// diese Teilmenge nicht wegen `staleTime: Infinity` als vollständige Antwort über die Anmeldung
// hinweg hängenbleibt, verwirft `AuthProvider.refresh()` sie beim Sitzungswechsel ausdrücklich
// mit (app/AuthContext.tsx).
//
// BEWUSST NICHT über einen sitzungsabhängigen Schlüssel gelöst, obwohl das die naheliegende Form
// wäre: Diese Datei ist eine `.ts` und darf keine `.tsx` importieren — der Wurzel-Typprüfer läuft
// ohne jsx (dieselbe Grenze, die schon `lib/aiAvailability.ts` von `lib/useAiAvailable.tsx` trennt).
export const useFeatures = () =>
  useQuery({
    queryKey: ["features"],
    queryFn: endpoints.features.get,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
// AUFTRAG-mega67 Block C/D: der Zugangs-Zustand des Confluence-Imports. `enabled` wird von der
// Fläche auf „Rolle trägt users.manage" gesetzt — die Route verlangt es, und ein Aufruf ohne das
// Recht wäre nur 403-Rauschen (dieselbe Regel wie bei useReasonerConfig). `retry: false`, weil ein
// 403/404 hier eine Antwort ist und keine Störung, die sich durch Wiederholen bessert.
export const useImportAccessConfluence = (enabled = true) =>
  useQuery({
    queryKey: ["import-access", "confluence"],
    queryFn: endpoints.importAccess.confluence,
    enabled,
    retry: false,
  });
export const useAudit = () => useQuery({ queryKey: ["audit"], queryFn: endpoints.audit.list });
export const useLifecyclePending = () =>
  useQuery({ queryKey: ["lifecycle", "pending"], queryFn: endpoints.lifecycle.pending });
export const useLearningPath = (role: string) =>
  useQuery({
    queryKey: ["learning-path", role],
    queryFn: () => endpoints.learningPaths.byRole(role),
    retry: false,
  });
export const useLearningProgress = (pathId: string | undefined) =>
  useQuery({
    queryKey: ["learning-progress", pathId],
    queryFn: () => endpoints.learningPaths.progress(pathId ?? ""),
    enabled: !!pathId,
  });
export const useUsers = () => useQuery({ queryKey: ["users"], queryFn: endpoints.users.list });
export const useDirectory = () =>
  useQuery({ queryKey: ["directory"], queryFn: endpoints.directory.list });
export const useGraph = () => useQuery({ queryKey: ["graph"], queryFn: endpoints.library.graph });
// AUFTRAG-mega68: Nachbarschaft eines Objekts — je Mitte ein eigener Cache-Eintrag (die Fläche
// wandert per Klick durch das Netz, der Rückweg trifft dann den warmen Cache).
export const useKoNeighbors = (id: string) =>
  useQuery({
    queryKey: ["ko-neighbors", id],
    queryFn: () => endpoints.ko.neighbors(id),
    enabled: id !== "",
  });
export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: endpoints.notifications.list });
// Audit-P4 (SCRUM-398): Live-Wall („frisch gesichert / hat heute geholfen").
export const useLiveWall = () =>
  useQuery({ queryKey: ["livewall"], queryFn: endpoints.livewall.get });
export const useReasonerStatus = () =>
  useQuery({ queryKey: ["reasoner", "status"], queryFn: endpoints.reasoner.status });
// SCRUM-166: read-only Reasoner-/Provider-Konfiguration.
// WP-VIP2-GATE-2 (bens Fix 3): serverseitig jetzt ECHTE Admin-Sicht (users.manage). Nicht-Admin-
// Oberflaechen deaktivieren die Query (enabled=false) und fallen auf den oeffentlichen
// abstrahierten Status (/api/reasoner/status: active+mode) zurueck — kein 403-Rauschen.
export const useReasonerConfig = (enabled = true) =>
  useQuery({ queryKey: ["reasoner", "config"], queryFn: endpoints.reasoner.config, enabled });
// SCRUM-386: kundeneigene KI-Assist-Presets für die Palette (lesen: alle Rollen).
export const useAssistPresets = () =>
  useQuery({ queryKey: ["reasoner", "assistPresets"], queryFn: endpoints.reasoner.assistPresets });
// PAKET 2 (D-AISTATE, Pedi 23.07.): Achse 1 (externe Wissensabfrage) als eigene Header-Anzeige —
// die Policy-Stufe ist für alle Leseberechtigten lesbar (GET /external/policy), getrennt vom Reasoner.
export const useExternalPolicy = () =>
  useQuery({ queryKey: ["external", "policy"], queryFn: endpoints.external.policy });

// AUFTRAG-mega14 Block E (SCRUM-421): EINE Quelle für die geltenden Upload-Grenzen — dieselbe, die
// der Server erzwingt. Jede Auswahlstelle liest hierüber; React Query bündelt die Abfrage.
export const useUploadLimits = () =>
  useQuery({ queryKey: ["upload-limits"], queryFn: endpoints.uploadLimits.get });
