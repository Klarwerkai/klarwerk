import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, RotateCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import { useConflicts, useDirectory, useKos, useLibrarySearch } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { useRole } from "../app/RoleContext";
import { useToast } from "../app/ToastContext";
import { DemoBanner } from "../components/DemoBanner";
import { EmptyStateCtas } from "../components/EmptyStateCtas";
import {
  ConfidenceBar,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  KoAuthorLine,
  StatusPill,
} from "../components/trust";
import { Button, Card, PageHeader, QueryState } from "../components/ui";
import { conflictImpact, conflictLimitedUsability } from "../lib/conflictImpact";
import {
  DEMO_KNOWLEDGE_FILTERS,
  type DemoKnowledgeFilter,
  countByDemoKnowledge,
  demoKnowledgeFilterLabelKey,
  filterByDemoKnowledge,
  isDemoKnowledge,
  ownKnowledgeEmptyHint,
  readDemoKnowledgeFilter,
} from "../lib/demoKnowledge";
import { demoHref, isDemoContext } from "../lib/demoPilotPath";
import { deriveStatus } from "../lib/displayStatus";
import { type KnowledgeGuidanceTone, knowledgeGuidance } from "../lib/knowledgeGuidance";
import { koAuthorParts } from "../lib/koAuthor";
import { windowList } from "../lib/libraryDisplay";
import { EXPORT_FORMATS, type ExportFormat, exportFilename, exportUrl } from "../lib/libraryExport";
import {
  MATURITY_FILTERS,
  type MaturityFilter,
  type MaturityTone,
  countByMaturity,
  filterByMaturity,
  libraryMaturity,
  libraryUseCta,
  maturityFilterLabelKey,
} from "../lib/libraryMaturity";
import { EMPTY_LIBRARY_FILTER, buildLibraryQuery } from "../lib/libraryQuery";
import { type MatchField, searchLibrary } from "../lib/librarySearch";
import { canRevalidate } from "../lib/revalidation";
import { useReadiness } from "../lib/useReadiness";
import { categoryOptions, tagOptions } from "../lib/validationFilters";

const KO_STATUSES = ["offen", "validiert"] as const;

// SCRUM-262: Tönung der Reife-/Nutzbarkeits-Plakette (nutzbar/in Prüfung/zu prüfen).
const MATURITY_TONE: Record<MaturityTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

// SCRUM-289: kompakte Reife-Erklärung (nutzbar vs. in Prüfung/zu prüfen).
const GUIDE_TONE: Record<KnowledgeGuidanceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  neutral: "bg-page text-muted",
};

export function Library(): JSX.Element {
  const { t } = useTranslation();
  // Startfilter aus der URL (?q=…), gesetzt von der globalen Topbar-Suche.
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ ...EMPTY_LIBRARY_FILTER, q: params.get("q") ?? "" });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  // SCRUM-267: einfacher Reife-Filter (Alle/Nutzbar/In Prüfung/Zu prüfen) auf der gerankten Liste.
  const [maturity, setMaturity] = useState<MaturityFilter>("all");
  // SCRUM-309: Herkunftsfilter (Demo/Eigenes) — ergänzend zu Reife/Suche, nicht als Ersatz.
  // SCRUM-310: lazy aus dem Query-Param (?origin=…) vorbelegen — z. B. Capture-Success → eigenes
  // Wissen; fehlend/ungültig → „all". Die Chips überschreiben den State weiterhin frei.
  const [demoFilter, setDemoFilter] = useState<DemoKnowledgeFilter>(() =>
    readDemoKnowledgeFilter(params),
  );
  const guide = knowledgeGuidance("library");

  // Optionen (Domäne/Tags) aus dem ungefilterten Bestand, damit sie stabil bleiben.
  const all = useKos();
  const cats = categoryOptions(all.data ?? []);
  const tags = tagOptions(all.data ?? []);
  // FR-LIF-04: Autor in jeder KO-Zeile sichtbar (Namen via Directory, Fallback ID).
  const dir = useDirectory();
  const nameOf = (uid: string): string => dir.data?.find((d) => d.id === uid)?.name || uid;
  // SCRUM-357 / AG-14: Konfliktliste für die ehrliche „conflict-limited"-Reife je Treffer.
  const conflicts = useConflicts();

  // Ergebnisse über den Server-Search-/Filterpfad (Volltext + KoFilter).
  const query = useLibrarySearch(buildLibraryQuery(filter));
  // SCRUM-245: aktuelle Volltext-Query für client-seitiges Re-Ranking + Match-Hinweise.
  const trimmedQ = filter.q.trim();

  // Match-Grund → kompaktes, ehrliches Label (kein „semantisch", keine Fake-Treffer).
  const matchLabel = (field: MatchField): string => t(`lib.match.${field}`);

  const qc = useQueryClient();
  const { push } = useToast();
  // SCRUM-136: Re-Validierung über den vorhandenen KO-/Lifecycle-Pfad (revalidate).
  // Pedi 02.07. (mehrfach gewünscht): Löschen DIREKT in der Bibliothek — für Autor oder
  // Controller/Admin, mit Inline-Bestätigung (kein confirm()). Backend-Regel existiert
  // seit v0.9.12 (DELETE /api/kos/:id prüft Autor-oder-ko.validate serverseitig).
  const { role } = useRole();
  const { user } = useSession();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const removeKo = useMutation({
    mutationFn: (id: string) => endpoints.ko.remove(id),
    onSuccess: () => {
      setConfirmDeleteId(null);
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      push("success", t("ko.deleteDone"));
    },
    onError: (e) => push("error", e instanceof ApiError ? e.message : t("state.error")),
  });
  const revalidate = useMutation({
    mutationFn: (id: string) => endpoints.ko.act(id, { action: "revalidate" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["library"] });
      void qc.invalidateQueries({ queryKey: ["kos"] });
      void qc.invalidateQueries({ queryKey: ["validation"] });
      void qc.invalidateQueries({ queryKey: ["lifecycle"] });
      push("success", t("lib.revalidateDone"));
    },
    onError: () => push("error", t("state.error")),
  });

  const selectCls =
    "h-10 rounded-input border border-hairline bg-surface px-2 text-sm text-text outline-none focus:border-ink/30";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        kicker={t("lib.kicker")}
        title={t("nav.library")}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/import">
              <Button variant="ghost">{t("lib.reimport")}</Button>
            </Link>
            <select
              aria-label={t("lib.exportFormat")}
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="h-9 rounded-input border border-hairline bg-surface px-2 text-[13px] text-text outline-none focus:border-ink/30"
            >
              {EXPORT_FORMATS.map((fmt) => (
                <option key={fmt} value={fmt}>
                  {t(`lib.format.${fmt}`)}
                </option>
              ))}
            </select>
            <a href={exportUrl(exportFormat)} download={exportFilename(exportFormat)}>
              <Button>
                <Download size={15} />
                {t("lib.export")}
              </Button>
            </a>
          </div>
        }
      />
      {/* SCRUM-291: Demo-/Pilotpfad auf der Zielseite wiedererkennbar (nur bei ?demo=stage1). */}
      {isDemoContext(params) ? <DemoBanner surface="library" /> : null}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
          placeholder={t("lib.search")}
          className="h-10 min-w-[12rem] flex-1 rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
        />
        <select
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allTypes")}</option>
          {KNOWLEDGE_TYPES.map((tp) => (
            <option key={tp} value={tp}>
              {t(`ktype.${tp}`)}
            </option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allStatus")}</option>
          {KO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={filter.category}
          onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allCategories")}</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filter.tag}
          onChange={(e) => setFilter((f) => ({ ...f, tag: e.target.value }))}
          className={selectCls}
        >
          <option value="">{t("lib.allTags")}</option>
          {tags.map((tg) => (
            <option key={tg} value={tg}>
              {tg}
            </option>
          ))}
        </select>
      </div>
      {/* SCRUM-289: Reife-Plaketten/Filter kurz erklären — kein neues Statusmodell. */}
      <Card className="mb-4 border-dashed">
        <div className="mb-2">
          <h2 className="text-[14px] font-semibold text-ink">{t(guide.titleKey)}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t(guide.bodyKey)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {guide.items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className="inline-flex items-start gap-2 rounded-btn border border-hairline bg-surface px-2.5 py-2 hover:border-ink/30"
            >
              <span
                className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${GUIDE_TONE[item.tone]}`}
              >
                {t(item.labelKey)}
              </span>
              <span className="max-w-[18rem] text-[12px] leading-relaxed text-muted">
                {t(item.bodyKey)}
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <QueryState
        query={query}
        emptyText={trimmedQ ? t("lib.emptyQuery", { q: trimmedQ }) : t("lib.empty")}
        emptyExtra={<EmptyStateCtas context="library" />}
      >
        {(items) => {
          // SCRUM-245: client-seitig nach nachvollziehbarer Relevanz re-ranken (verwirft nichts).
          const ranked = searchLibrary(items, trimmedQ);
          // SCRUM-309: Herkunfts-Zähler über die volle gerankte Liste; dann ergänzend nach Herkunft
          // (Demo/Eigenes) filtern — VOR der Reife, damit beide Filter sauber komponieren.
          const demoCounts = countByDemoKnowledge(ranked);
          const byDemo = filterByDemoKnowledge(ranked, demoFilter);
          // SCRUM-267: Reife-Zähler über die (nach Herkunft gefilterte) Liste; dann nach Reife filtern …
          const maturityCounts = countByMaturity(byDemo);
          const filtered = filterByMaturity(byDemo, maturity);
          // SCRUM-158: … erst danach fenstern + zählen (Count-Linie passt zur sichtbaren Menge).
          const win = windowList(filtered);
          return (
            <>
              {/* SCRUM-309: Herkunftsfilter (Demo/Eigenes) — ergänzend, nutzt dieselbe Erkennung wie
                  das Demo-Badge; ersetzt NICHT Status/Trust/Nutzbarkeit/Reife/Suche. */}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="mr-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("lib.originLabel")}:
                </span>
                {DEMO_KNOWLEDGE_FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDemoFilter(f)}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      demoFilter === f
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-muted hover:text-text"
                    }`}
                  >
                    {t(demoKnowledgeFilterLabelKey(f))} · {demoCounts[f]}
                  </button>
                ))}
              </div>
              {/* SCRUM-267: Reife-Filter — dieselbe Logik wie die Plakette (libraryMaturity). */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                {MATURITY_FILTERS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMaturity(m)}
                    className={`rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold ${
                      maturity === m
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-muted hover:text-text"
                    }`}
                  >
                    {t(maturityFilterLabelKey(m))} · {maturityCounts[m]}
                  </button>
                ))}
              </div>
              {/* Beta Own-Knowledge Work Queue v0: ehrlicher Leerzustand für die „Eigenes Wissen"-Linse
                  — wenn auf eigenes/nicht-Demo-Wissen gefiltert wird, aber (noch) keins existiert, den
                  Weg zurück ins Erfassen zeigen statt einer stummen leeren Liste. */}
              {(() => {
                const ownEmpty = ownKnowledgeEmptyHint({
                  filter: demoFilter,
                  count: demoCounts["non-demo"],
                });
                if (!ownEmpty) {
                  return null;
                }
                return (
                  <Card className="mb-2">
                    <p className="text-[13px] font-semibold text-text">{t(ownEmpty.titleKey)}</p>
                    <p className="mt-0.5 text-[12px] text-muted">{t(ownEmpty.hintKey)}</p>
                    <Link
                      to={ownEmpty.to}
                      className="mt-2 inline-flex items-center gap-1 rounded-btn bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90"
                    >
                      {t(ownEmpty.ctaKey)} <span aria-hidden="true">→</span>
                    </Link>
                  </Card>
                );
              })()}
              <div className="mb-2 flex items-center justify-between gap-2 font-mono text-[11px] text-muted-2">
                <span>{t("lib.resultCount", { n: win.total })}</span>
                {win.limited ? (
                  <span className="text-trust-warn-text">
                    {t("lib.showingFirst", { shown: win.shown, total: win.total })}
                  </span>
                ) : null}
              </div>
              <Card className="p-0">
                <div className="divide-y divide-hairline">
                  {win.visible.map(({ ko: k, matches }) => {
                    // SCRUM-262: ehrliche Reife/Nutzbarkeit je Treffer (DOM-freier Helper).
                    const maturity = libraryMaturity(k);
                    // SCRUM-357 / AG-14: ein offener Konflikt begrenzt die Reife ehrlich (ready → in
                    // Prüfung). So wirkt ein validiertes KO mit offenem Truth-Konflikt NICHT „nutzbar".
                    const impact = conflictImpact(k.id, conflicts.data ?? []);
                    const effReadiness = useReadiness(
                      conflictLimitedUsability(maturity.usability, impact),
                    );
                    // Konfliktbegrenztes KO führt nicht direkt in Ask, sondern zur Konfliktseite.
                    const useCta = impact.limited
                      ? {
                          labelKey: "conflict.impact.cta",
                          href: "/konflikte",
                          kind: "review" as const,
                        }
                      : libraryUseCta(k);
                    return (
                      <div
                        key={k.id}
                        // SCRUM-419: umbruchfähig — die Lösch-Bestätigung bekommt ihre eigene Zeile.
                        className="group flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-hairline-soft"
                      >
                        <Link
                          to={demoHref(`/wissen/${k.id}`, params)}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          {/* SCRUM-396-Muster (Pedi 02.07.): Titel zuerst und deutlich — die
                              Badge-Kette davor machte die Überschrift unauffindbar. Badges
                              rücken in eine ruhige Zeile UNTER den Titel; nichts entfernt. */}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-semibold leading-snug text-text underline-offset-4 group-hover:underline">
                              {k.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`shrink-0 rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${MATURITY_TONE[effReadiness.tone]}`}
                              >
                                {t(effReadiness.labelKey)}
                              </span>
                              <StatusPill status={deriveStatus(k)} />
                              {/* SCRUM-357: sichtbares Konflikt-Signal direkt in der Trefferzeile. */}
                              {impact.limited ? (
                                <span
                                  title={t("conflict.impact.hint")}
                                  className="shrink-0 rounded-pill bg-trust-warn-bg px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text"
                                >
                                  {t("conflict.impact.badge")}
                                </span>
                              ) : null}
                              {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral). */}
                              {isDemoKnowledge(k) ? (
                                <span
                                  title={t("demo.badge.hint")}
                                  className="shrink-0 rounded-pill bg-hairline-soft px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted-2"
                                >
                                  {t("demo.badge.label")}
                                </span>
                              ) : null}
                              <KnowledgeTypeTag type={k.type} />
                            </span>
                            <KoAuthorLine {...koAuthorParts(k, nameOf)} />
                            {/* SCRUM-245: kompakte, ehrliche Match-Gründe (nur bei aktiver Suche). */}
                            {trimmedQ && matches.length > 0 ? (
                              <span className="mt-0.5 flex flex-wrap items-center gap-1">
                                <span className="font-mono text-[9.5px] uppercase tracking-wide text-muted-2">
                                  {t("lib.matchIn")}
                                </span>
                                {matches.map((field) => (
                                  <span
                                    key={field}
                                    className="rounded-pill bg-hairline-soft px-1.5 py-0.5 text-[10px] text-muted"
                                  >
                                    {matchLabel(field)}
                                  </span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                          <span className="hidden font-mono text-[11px] text-muted-2 sm:block">
                            {k.category}
                          </span>
                          <div className="hidden sm:block">
                            <ConfidenceBar value={k.confidence} showLabel={false} />
                          </div>
                        </Link>
                        {/* SCRUM-288: nur nutzbares/validiertes Wissen direkt in Ask; offene KOs → Review.
                            SCRUM-294: im Demo-Kontext den Use-Fluss-Kontext weitertragen. */}
                        <Link
                          to={demoHref(useCta.href, params)}
                          title={t(useCta.labelKey)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-btn border px-2.5 py-1 text-[12px] font-semibold hover:text-text ${
                            useCta.kind === "ask"
                              ? "border-ink bg-ink text-white hover:text-white"
                              : "border-hairline text-muted"
                          }`}
                        >
                          {t(useCta.labelKey)}
                        </Link>
                        {canRevalidate(k.status) ? (
                          <button
                            type="button"
                            title={t("lib.revalidate")}
                            disabled={revalidate.isPending && revalidate.variables === k.id}
                            onClick={() => revalidate.mutate(k.id)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text disabled:opacity-50"
                          >
                            <RotateCw size={13} />
                            {t("lib.revalidate")}
                          </button>
                        ) : null}
                        {/* Pedi 02.07.: Löschen direkt in der Zeile (Autor/Controller/Admin) —
                            Inline-Bestätigung; Server erzwingt dieselbe Regel (403 sonst). */}
                        {role === "admin" || role === "controller" || k.author === user?.id ? (
                          confirmDeleteId === k.id ? (
                            // SCRUM-412/419 (CI + Layout): Bestätigung auf EIGENER voller Zeile,
                            // rechtsbündig — quetscht sich nicht mehr neben Pills und Knöpfe.
                            <span className="flex w-full basis-full flex-wrap items-center justify-end gap-1.5 border-t border-hairline pt-2">
                              <span className="text-[12px] font-semibold text-text">
                                {t("ko.deleteQ")}
                              </span>
                              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                                {t("ko.deleteKeep")}
                              </Button>
                              <Button
                                variant="outline"
                                disabled={removeKo.isPending}
                                onClick={() => removeKo.mutate(k.id)}
                              >
                                {t("ko.deleteYes")}
                              </Button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              title={t("ko.deleteButton")}
                              onClick={() => setConfirmDeleteId(k.id)}
                              className="inline-flex shrink-0 items-center rounded-btn border border-hairline px-2 py-1 text-muted hover:bg-trust-crit-bg hover:text-trust-crit-text"
                            >
                              <Trash2 size={13} />
                            </button>
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
