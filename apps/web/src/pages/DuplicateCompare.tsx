import { Link, useParams } from "react-router-dom";
import { useConflicts, useDuplicates, useKos } from "../api/hooks";
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { KoView } from "../components/KoView";
import { PageHeader, cx } from "../components/ui";
import {
  type CompareMetrics,
  type CompareSection,
  DUPLICATE_COMPARE_SAFETY,
  buildDuplicateCompareSections,
  compareToneLabel,
  overallFromConflict,
  overallFromOverlap,
} from "../lib/duplicateCompare";

export type DuplicateCompareKind = "duplicate" | "conflict";

function percent(value: number): string {
  return `${Math.round(value)} %`;
}

function ScoreSegment({
  value,
  className,
}: {
  value: number;
  className: string;
}): JSX.Element | null {
  if (value <= 0) {
    return null;
  }
  return <div className={className} style={{ width: `${Math.max(4, value)}%` }} />;
}

function ScoreBar({ metrics }: { metrics: CompareMetrics }): JSX.Element {
  const total = Math.max(metrics.match + metrics.conflict + metrics.uncertainty, 1);
  const match = (metrics.match / total) * 100;
  const conflict = (metrics.conflict / total) * 100;
  const uncertainty = (metrics.uncertainty / total) * 100;
  return (
    <div className="h-3 w-full overflow-hidden rounded-pill bg-page">
      <div className="flex h-full w-full">
        <ScoreSegment value={match} className="bg-trust-pos-text" />
        <ScoreSegment value={uncertainty} className="bg-trust-warn-text" />
        <ScoreSegment value={conflict} className="bg-trust-crit-text" />
      </div>
    </div>
  );
}

function ScoreSummary({ metrics }: { metrics: CompareMetrics }): JSX.Element {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            Uebereinstimmung
          </div>
          <div className="text-lg font-semibold text-trust-pos-text">{percent(metrics.match)}</div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            Unsicherheit
          </div>
          <div className="text-lg font-semibold text-trust-warn-text">
            {percent(metrics.uncertainty)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            Konflikt
          </div>
          <div className="text-lg font-semibold text-trust-crit-text">
            {percent(metrics.conflict)}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ScoreBar metrics={metrics} />
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{metrics.note}</p>
      <p className="mt-1 text-[12px] font-semibold text-muted">
        Scores sind Entscheidungshilfe, keine Wahrheit. Kein automatischer Merge.
      </p>
    </div>
  );
}

function KoPanel({
  label,
  ko,
  fallbackId,
}: {
  label: string;
  ko: KnowledgeObject | null;
  fallbackId: string;
}): JSX.Element {
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2">{label}</span>
        {ko ? (
          <Link
            to={`/wissen/${ko.id}`}
            className="text-[12px] font-semibold text-ai hover:underline"
          >
            Details ansehen
          </Link>
        ) : null}
      </div>
      {ko ? (
        <KoView ko={ko} />
      ) : (
        <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12.5px] text-muted">
          Wissensobjekt nicht gefunden: {fallbackId}
        </div>
      )}
    </div>
  );
}

function TonePill({ tone }: { tone: CompareSection["tone"] }): JSX.Element {
  return (
    <span
      className={cx(
        "rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
        tone === "green" && "bg-trust-pos-bg text-trust-pos-text",
        tone === "yellow" && "bg-trust-warn-bg text-trust-warn-text",
        tone === "red" && "bg-trust-crit-bg text-trust-crit-text",
      )}
    >
      {compareToneLabel(tone)}
    </span>
  );
}

function SectionRow({ section }: { section: CompareSection }): JSX.Element {
  return (
    <div className="grid gap-3 rounded-card border border-hairline bg-surface p-4 lg:grid-cols-[1fr_220px_1fr]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">Links</div>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
          {section.leftValue}
        </p>
      </div>
      <div className="rounded-card bg-page p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text">{section.label}</span>
          <TonePill tone={section.tone} />
        </div>
        <div className="mt-2 space-y-1 text-[11.5px] text-muted">
          <div>Match: {percent(section.metrics.match)}</div>
          <div>Unsicherheit: {percent(section.metrics.uncertainty)}</div>
          <div>Konflikt: {percent(section.metrics.conflict)}</div>
        </div>
        <div className="mt-2">
          <ScoreBar metrics={section.metrics} />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{section.reason}</p>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">Rechts</div>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
          {section.rightValue}
        </p>
      </div>
    </div>
  );
}

function findKo(kos: readonly KnowledgeObject[] | undefined, id: string): KnowledgeObject | null {
  return kos?.find((ko) => ko.id === id) ?? null;
}

function sourceTitle(kind: DuplicateCompareKind, entry: OverlapEntry | Conflict): string {
  if (kind === "duplicate") {
    const overlap = entry as OverlapEntry;
    return `Duplikatvergleich: ${overlap.relation}`;
  }
  const conflict = entry as Conflict;
  return `Konfliktvergleich: ${conflict.type}`;
}

export function DuplicateCompare({ kind }: { kind: DuplicateCompareKind }): JSX.Element {
  const { id = "" } = useParams();
  const duplicates = useDuplicates();
  const conflicts = useConflicts();
  const kos = useKos();
  const isDuplicate = kind === "duplicate";
  const loading = kos.isLoading || (isDuplicate ? duplicates.isLoading : conflicts.isLoading);
  const error = kos.isError || (isDuplicate ? duplicates.isError : conflicts.isError);
  const entry = isDuplicate
    ? duplicates.data?.find((item) => item.id === id)
    : conflicts.data?.find((item) => item.id === id);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader kicker="Read-only Vergleich" title="Duplikate vergleichen" />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          Vergleich wird geladen.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader kicker="Read-only Vergleich" title="Duplikate vergleichen" />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          Vergleich konnte nicht geladen werden.
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          kicker="Read-only Vergleich"
          title="Duplikate vergleichen"
          actions={<Link to={isDuplicate ? "/duplikate" : "/konflikte"}>Zurueck</Link>}
        />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          Vergleich nicht gefunden oder bereits geschlossen.
        </div>
      </div>
    );
  }

  const left = findKo(kos.data, entry.koA);
  const right = findKo(kos.data, entry.koB);
  const sections = left && right ? buildDuplicateCompareSections(left, right) : [];
  const overall =
    left && right
      ? isDuplicate
        ? overallFromOverlap(entry as OverlapEntry, sections)
        : overallFromConflict(entry as Conflict, sections)
      : {
          match: 0,
          conflict: 0,
          uncertainty: 100,
          source: "heuristic" as const,
          note: "Score nicht vorhanden: mindestens ein Wissensobjekt fehlt.",
        };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        kicker="Read-only Vergleich"
        title="Duplikate vergleichen"
        actions={
          <Link
            to={isDuplicate ? "/duplikate" : "/konflikte"}
            className="rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
          >
            Zurueck
          </Link>
        }
      />

      <div className="mb-4 rounded-card border border-ai/20 bg-ai/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              {sourceTitle(kind, entry)}
            </div>
            <p className="mt-1 text-[13px] text-text">
              Read-only MVP: keine Zusammenfuehrung, keine Loeschung, keine Validierung, keine
              gespeicherten Entscheidungen.
            </p>
          </div>
          <button
            type="button"
            disabled
            className="rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-muted opacity-60"
          >
            Merge spaeter
          </button>
        </div>
      </div>

      <ScoreSummary metrics={overall} />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_280px_1fr]">
        <KoPanel label="Wissensobjekt A" ko={left} fallbackId={entry.koA} />
        <div className="rounded-card border border-hairline bg-surface p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            Sicherheitsstatus
          </div>
          <ul className="mt-3 space-y-2 text-[12.5px] text-text">
            <li>Merge aktiv: {DUPLICATE_COMPARE_SAFETY.mergeEnabled ? "ja" : "nein"}</li>
            <li>Delete aktiv: {DUPLICATE_COMPARE_SAFETY.deleteEnabled ? "ja" : "nein"}</li>
            <li>
              Auto-Validate aktiv: {DUPLICATE_COMPARE_SAFETY.autoValidateEnabled ? "ja" : "nein"}
            </li>
            <li>
              Entscheidungen gespeichert:{" "}
              {DUPLICATE_COMPARE_SAFETY.persistDecisions ? "ja" : "nein"}
            </li>
            <li>KI-Aktion aktiv: {DUPLICATE_COMPARE_SAFETY.aiActionEnabled ? "ja" : "nein"}</li>
          </ul>
          <div className="mt-4 rounded-card bg-page p-3 text-[12px] text-muted">
            KI-Vorschlag spaeter. In KW-DUP-02 wird kein KI-Merge erzeugt.
          </div>
        </div>
        <KoPanel label="Wissensobjekt B" ko={right} fallbackId={entry.koB} />
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            Abschnittsampeln
          </div>
          <h2 className="mt-1 text-lg font-semibold text-ink">Vergleich nach Wissensbereichen</h2>
        </div>
        {sections.length > 0 ? (
          sections.map((section) => <SectionRow key={section.key} section={section} />)
        ) : (
          <div className="rounded-card border border-dashed border-hairline bg-surface p-6 text-sm text-muted">
            Abschnittsvergleich nicht moeglich, weil ein Wissensobjekt fehlt.
          </div>
        )}
      </div>
    </div>
  );
}
