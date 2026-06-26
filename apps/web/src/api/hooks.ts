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
export const useKo = (id: string) =>
  useQuery({ queryKey: ["ko", id], queryFn: () => endpoints.ko.get(id), enabled: id.length > 0 });
export const useKoVersions = (id: string) =>
  useQuery({
    queryKey: ["ko", id, "versions"],
    queryFn: () => endpoints.ko.versions(id),
    enabled: id.length > 0,
  });
export const useValidationBoard = (f?: KoFilter) =>
  useQuery({ queryKey: ["validation", "board", f], queryFn: () => endpoints.validation.board(f) });
export const useValidationOverview = () =>
  useQuery({ queryKey: ["validation", "overview"], queryFn: endpoints.validation.overview });
export const useConflicts = () =>
  useQuery({ queryKey: ["conflicts"], queryFn: endpoints.conflicts.list });
export const useGaps = () => useQuery({ queryKey: ["gaps"], queryFn: endpoints.gaps.list });
export const useDrafts = () => useQuery({ queryKey: ["drafts"], queryFn: endpoints.drafts.list });
export const useAnalytics = () =>
  useQuery({ queryKey: ["analytics"], queryFn: endpoints.analytics.overview });
export const useImpact = () =>
  useQuery({ queryKey: ["analytics", "impact"], queryFn: endpoints.analytics.impact });
export const useBusFactor = () =>
  useQuery({ queryKey: ["busfactor"], queryFn: endpoints.analytics.busfactor });
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
export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: endpoints.notifications.list });
export const useReasonerStatus = () =>
  useQuery({ queryKey: ["reasoner", "status"], queryFn: endpoints.reasoner.status });
