import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// JOB 577: die kanonische Normalisierung von „nicht vorhanden / nicht sichtbar" (404) in den
// Datenzustand `null`. Sie steht in einer eigenen Datei, weil sie ein VERTRAG ist und keine
// Hilfszeile — die Begründung, warum 403 und 5xx ausdrücklich NICHT dazugehören, gehört an genau
// eine Stelle und nicht in drei Hook-Kommentare (s. api/abwesenheit.ts).
import { importRunStateView } from "../lib/importResultView";
import { alsAbwesenheit } from "./abwesenheit";
import { type KoFilter, endpoints } from "./endpoints";
import type { BeziehungSetzenBody } from "./types";

/** Nachfragetakt für einen laufenden Import — ruhig genug fürs Netz, schnell genug fürs Auge. */
const IMPORT_RUN_TAKT_MS = 2000;

// Lese-Hooks (TanStack Query) gegen die Modul-Endpunkte. Mutationen werden je
// Screen mit useMutation gebaut (mit Invalidierung der passenden Keys).
export const useKos = (f?: KoFilter) =>
  useQuery({ queryKey: ["kos", f], queryFn: () => endpoints.ko.list(f) });
// JOB 4153: `enabled` kam ADDITIV hinzu und ist standardmässig `true` — jeder bestehende Aufrufer
// verhält sich Zeichen für Zeichen wie vorher. Die Zielauswahl der Wissensbeziehungen braucht ihn:
// ohne ihn liefe bei JEDEM Öffnen eines Eintrags eine Suche mit leerem Begriff los und holte den
// ganzen sichtbaren Bestand, bevor jemand ein Zeichen getippt hat. Ein eigener `useQuery` dort wäre
// der zweite Ausdruck DESSELBEN Cache-Schlüssels gewesen (LEHREN.md, JOB 3081 R2).
export const useLibrarySearch = (params: KoFilter & { q?: string }, enabled = true) =>
  useQuery({
    queryKey: ["library", "search", params],
    queryFn: () => endpoints.library.search(params),
    enabled,
  });
// FUNKE F1 (nacht24 Paket 6): persönliche Wirkungs-Zähler.
export const useMyImpact = () =>
  useQuery({ queryKey: ["me", "impact"], queryFn: () => endpoints.me.impact() });
export const useImportCandidates = () =>
  useQuery({
    queryKey: ["import-candidates"],
    queryFn: () => endpoints.library.importCandidates.list(),
  });
// F-0140 / K-20 (JOB 2970 D1): der laufende Importlauf, so lange er läuft.
//
// Ob nachgefragt wird, entscheidet NICHT dieser Hook, sondern `importRunStateView` — dieselbe reine
// Ableitung, die auch die Anzeige speist. Ein zweiter Lauf-Begriff („welche Zustände sind laufend?")
// wäre genau die zweite Wahrheit, die auseinanderläuft: Der View-Kern nennt `QUEUED … ANALYZING`
// laufend, und wer hier eine eigene Liste pflegte, würde bei der nächsten Erweiterung entweder
// ewig nachfragen oder zu früh aufhören.
export const useImportRun = (importId: string | null) =>
  useQuery({
    queryKey: ["import-run", importId],
    queryFn: () => endpoints.admin.import.run(importId ?? ""),
    enabled: importId !== null,
    refetchInterval: (q) =>
      importRunStateView(q.state.data?.status).running ? IMPORT_RUN_TAKT_MS : false,
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
// ================================================================================================
// JOB 3088 · Q1b — DER SCHLÜSSEL DER DETAILABFRAGE WOHNT AN GENAU EINER STELLE.
// ================================================================================================
// Seit JOB 3088 fasst der Wiederholknopf der Bibliotheksfläche DIESELBE Abfrage an, die dieser
// Haken hält — über den `QueryClient`, weil die Fläche den Haken selbst nicht hält (er wohnt in
// `BibliothekLesen.tsx:158`). Schriebe sie den Schlüssel dort ein zweites Mal als Literal hin,
// gäbe es zwei Ausdrücke derselben Sache, und der eine liefe beim nächsten Umbau vom anderen weg
// (LEHREN.md, JOB 3081 R2: „ein zweiter Ausdruck desselben Schlüssels ist ein zweites Gehirn").
// Deshalb: EINE Funktion, zwei Aufrufer.
export const koQueryKey = (id: string): readonly ["ko", string] => ["ko", id];
export const useKo = (id: string) =>
  useQuery({
    queryKey: koQueryKey(id),
    queryFn: () => endpoints.ko.get(id),
    enabled: id.length > 0,
  });
// ACHTUNG, PRÄFIX: dieser Schlüssel und der von `useKoEvidence` beginnen mit dem Detailschlüssel.
// Eine Auffrischung über `["ko", id]` OHNE `exact` trifft sie mit — wer das will, muss es sagen
// (s. die begründete Reichweiten-Entscheidung in `BibliothekFlaeche.tsx`, `alleAuffrischen`).
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
// A28 (OFFEN.md:165), JOB 1546: das dauerhafte Signal an den EIGENEN Objekten des Betrachters.
// Lazy wie `useConflicts`, aus demselben Grund.
export const useEigeneBefunde = () =>
  useQuery({ queryKey: ["duplicate-signal"], queryFn: () => endpoints.duplicateSignal.list() });
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
//
// JOB 577: `retry: false` bleibt (es unterdrückt die Wiederholung), aber es hat die Sichtbarkeit nie
// geregelt — der Query endete trotzdem in `isError`. `alsAbwesenheit` macht aus dem 404 den
// Datenzustand `null`; die Absicht des Kommentars oben ist damit durchgesetzt statt nur benannt.
export const useExpertise = (enabled: boolean) =>
  useQuery({
    queryKey: ["analytics", "expertise"],
    queryFn: alsAbwesenheit(endpoints.analytics.expertise),
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
//
// JOB 577: „unbekannt heißt fail-closed aus" stand hier als Absicht — durchgesetzt hat es der
// Renderer (`FeatureGate`: `features.data?.features[feature] ?? false`). Mit `alsAbwesenheit` ist
// ein 404 jetzt `data === null`, und die optionale Verkettung dort greift aus einem DATENzustand
// statt aus einem übergangenen Fehler. Dass die Fläche dabei unsichtbar bleibt, ist ab jetzt
// gemessen (tests/app/577-abwesenheit-verbraucher-mounted.test.tsx).
export const useFeatures = () =>
  useQuery({
    queryKey: ["features"],
    queryFn: alsAbwesenheit(endpoints.features.get),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
// AUFTRAG-mega67 Block C/D: der Zugangs-Zustand des Confluence-Imports. `enabled` wird von der
// Fläche auf „Rolle trägt users.manage" gesetzt — die Route verlangt es, und ein Aufruf ohne das
// Recht wäre nur 403-Rauschen (dieselbe Regel wie bei useReasonerConfig). `retry: false`, weil ein
// 403/404 hier eine Antwort ist und keine Störung, die sich durch Wiederholen bessert.
//
// JOB 577: „ein 403/404 ist hier eine Antwort und keine Störung" — auch das war eine Absicht ohne
// Durchsetzung. Der 404 wird jetzt zu `null`; der 403 bleibt ausdrücklich ein Fehler, weil er in
// diesem Haus eine Route anzeigt, die von der einheitlichen 404-Form abweicht (s. abwesenheit.ts).
export const useImportAccessConfluence = (enabled = true) =>
  useQuery({
    queryKey: ["import-access", "confluence"],
    queryFn: alsAbwesenheit(endpoints.importAccess.confluence),
    enabled,
    retry: false,
  });
export const useAudit = () => useQuery({ queryKey: ["audit"], queryFn: endpoints.audit.list });
// JOB 2600 D1: die Themenkarte kommt als Teil der Sichtmetrik — eine Route, eine Rechte-Naht.
export const useWissensnetz = () =>
  useQuery({ queryKey: ["wissensnetz", "luecken"], queryFn: endpoints.wissensnetz.luecken });
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

// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — DIE GESETZTEN FACHBEZIEHUNGEN: EIN LESEWEG, ZWEI SCHREIBWEGE.
// ================================================================================================
//
// WARUM DIE MUTATIONEN HIER STEHEN UND NICHT IM SCHIRM. Der Kommentar oben (Z. 13-14) sagt
// „Mutationen werden je Screen mit useMutation gebaut" — und das bleibt für Einzelfälle richtig.
// Diese beiden sind keine Einzelfälle: der Beziehungsbereich hängt am Eintrag (heute in
// `KnowledgeNeighborhood`), die direkt sichtbare Platzierung in der Eintragsansicht folgt im
// Integrationsnachfolger WG-LUECKEN, und der Wissensgraph auf Stufe 2 liest dieselben Daten. Ein
// zweiter, abgeschriebener `useMutation`-Rumpf im nächsten Einbauort wäre der zweite Ausdruck
// derselben Sache — samt der Gefahr, dass genau dort die Auffrischung des Graphen fehlt. Deshalb:
// EINE Stelle, die weiß, was nach einem Schreibvorgang nicht mehr stimmt.
//
// WAS DIE HOOKS AUSDRÜCKLICH NICHT TUN: kein optimistisches Einfügen. Die Liste kommt nach dem
// Schreiben wieder vom SERVER — nur so ist die Bestätigung an der Fläche eine Zusage des Servers
// und nicht eine des Browsers (Auftrag §5 Lieferung 3, R4). Dedup (200 mit der bestehenden Kante)
// erzeugt damit von selbst keinen zweiten Listeneintrag.
/** EIN Ausdruck des Schlüssels — Leseweg und Auffrischung nach dem Schreiben nehmen denselben. */
export const koBeziehungenQueryKey = (koId: string): readonly ["ko-beziehungen", string] => [
  "ko-beziehungen",
  koId,
];

export const useKoBeziehungen = (koId: string) =>
  useQuery({
    queryKey: koBeziehungenQueryKey(koId),
    queryFn: () => endpoints.ko.beziehungen(koId),
    enabled: koId !== "",
  });

/**
 * Nach jedem Schreibvorgang stimmen ZWEI Auskünfte nicht mehr: die Beziehungsliste dieses Eintrags
 * und der globale Graph (`/api/graph` trägt die kuratierten Kanten mit). Beide werden entwertet;
 * die Fläche holt sie neu, statt sich selbst etwas auszurechnen.
 *
 * `onSettled` UND NICHT `onSuccess` — das ist die Lehre aus BEN1 (Runde 2, gemessen): der Server
 * kann geschrieben haben, und die ANTWORT geht verloren. Genau dann ist die Liste falsch und der
 * Mensch braucht sie am dringendsten, denn nur sie kann ihm sagen, was wirklich gesetzt ist. Eine
 * Auffrischung nur im Erfolgsfall hätte den Bestand ausgerechnet im unklaren Fall alt stehen
 * lassen. Im eindeutig abgelehnten Fall (403/409) kostet sie eine Abfrage und sagt dasselbe wie
 * vorher — eine Regel, die immer stimmt, ist besser als zwei, von denen eine trügt.
 */
function beziehungenEntwerten(qc: ReturnType<typeof useQueryClient>, koId: string): void {
  void qc.invalidateQueries({ queryKey: koBeziehungenQueryKey(koId) });
  void qc.invalidateQueries({ queryKey: ["graph"] });
}

export const useBeziehungSetzen = (koId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BeziehungSetzenBody) => endpoints.ko.beziehungSetzen(koId, body),
    onSettled: () => beziehungenEntwerten(qc, koId),
  });
};

export const useBeziehungWiderrufen = (koId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kanteId, version }: { kanteId: string; version: number }) =>
      endpoints.ko.beziehungWiderrufen(kanteId, { version }),
    onSettled: () => beziehungenEntwerten(qc, koId),
  });
};

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
