import { Link, useParams } from "react-router-dom";
import { useConflicts, useDuplicates, useKos } from "../api/hooks";
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { KoView } from "../components/KoView";
import { PageHeader, cx } from "../components/ui";
import {
  type CompareMetrics,
  type CompareSection,
  buildDuplicateCompareSections,
  compareHeadline,
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
  // SCRUM-486 B: EINE führende Zahl, ehrlich beschriftet — die Feld-/Textheuristik ist kein Urteil.
  // Unsicherheit und der frühere „Konflikt"-Wert (jetzt ehrlich „Textunterschied") wandern in die Details.
  const head = compareHeadline(metrics);
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-trust-pos-text">
          {percent(head.leadPercent)}
        </span>
        <span className="text-[13px] font-semibold text-text">Text-Ähnlichkeit</span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted-2">
        kein bewiesener Widerspruch — nur Wort-/Feldähnlichkeit
      </p>
      <div className="mt-3">
        <ScoreBar metrics={metrics} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer list-none text-[12px] font-semibold text-ai hover:opacity-80">
          Weitere Werte
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              Unsicherheit
            </div>
            <div className="text-lg font-semibold text-trust-warn-text">
              {percent(head.uncertaintyPercent)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              Textunterschied
            </div>
            <div className="text-lg font-semibold text-trust-crit-text">
              {percent(head.differencePercent)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{metrics.note}</p>
      </details>
      <p className="mt-2 text-[12px] font-semibold text-muted">
        Scores sind Entscheidungshilfe, keine Wahrheit. Kein automatischer Merge.
      </p>
    </div>
  );
}

function KoPanel({ label, ko }: { label: string; ko: KnowledgeObject | null }): JSX.Element {
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
        // SCRUM-486 C: kein Roh-UUID in der Nutzersicht — neutraler „entfernt"-Hinweis.
        <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12.5px] text-muted">
          Objekt entfernt
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
        {/* SCRUM-486 B: „Ähnlichkeit"/„Textunterschied" statt „Match"/„Konflikt" — kein fachliches Urteil. */}
        <div className="mt-2 space-y-1 text-[11.5px] text-muted">
          <div>Ähnlichkeit: {percent(section.metrics.match)}</div>
          <div>Unsicherheit: {percent(section.metrics.uncertainty)}</div>
          <div>Textunterschied: {percent(section.metrics.conflict)}</div>
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

// SCRUM-486 C: keine Roh-Enums in Titeln — Beziehung/Konfliktart als Klartext (deutschsprachige Seite).
const RELATION_LABEL: Record<string, string> = {
  identisch: "identisch",
  a_enthaelt_b: "A enthält B",
  b_enthaelt_a: "B enthält A",
  teilweise: "teilweise Überschneidung",
  verwandt: "verwandt",
};
const CONFLICT_TYPE_LABEL: Record<string, string> = {
  truth: "Wahrheitskonflikt",
  experience: "Erfahrungskonflikt",
  context: "Kontextkonflikt",
  temporal: "zeitlicher Konflikt",
  role: "Rollenkonflikt",
};

// Kind-abhängiger Seitentitel — kein pauschales „Duplikate vergleichen" über dem Konflikt-Deep-Link.
function comparePageTitle(kind: DuplicateCompareKind): string {
  return kind === "duplicate" ? "Duplikate vergleichen" : "Konflikt vergleichen";
}

function sourceTitle(kind: DuplicateCompareKind, entry: OverlapEntry | Conflict): string {
  if (kind === "duplicate") {
    const overlap = entry as OverlapEntry;
    return `Duplikatvergleich: ${RELATION_LABEL[overlap.relation] ?? overlap.relation}`;
  }
  const conflict = entry as Conflict;
  return `Konfliktvergleich: ${CONFLICT_TYPE_LABEL[conflict.type] ?? conflict.type}`;
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
        <PageHeader kicker="Read-only Vergleich" title={comparePageTitle(kind)} />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          Vergleich wird geladen.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader kicker="Read-only Vergleich" title={comparePageTitle(kind)} />
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
          title={comparePageTitle(kind)}
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
        title={comparePageTitle(kind)}
        actions={
          <Link
            to={isDuplicate ? "/duplikate" : "/konflikte"}
            className="rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
          >
            Zurueck
          </Link>
        }
      />

      {/* SCRUM-486 C: die internen MVP-/Safety-Rohtexte und der deaktivierte Merge-Platzhalter sind raus
          aus der Nutzersicht — EIN ehrlicher Satz, was diese Ansicht tut (und was nicht). */}
      <div className="mb-4 rounded-card border border-ai/20 bg-ai/5 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {sourceTitle(kind, entry)}
        </div>
        <p className="mt-1 text-[13px] text-text">
          Nur zum Vergleich: Es wird nichts zusammengeführt, gelöscht oder validiert, und keine
          Entscheidung wird gespeichert.
        </p>
      </div>

      <ScoreSummary metrics={overall} />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <KoPanel label="Wissensobjekt A" ko={left} />
        <KoPanel label="Wissensobjekt B" ko={right} />
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
