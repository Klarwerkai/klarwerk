import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useConflicts, useDuplicates, useKos } from "../api/hooks";
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { HelpTip } from "../components/HelpTip";
import { KoView } from "../components/KoView";
import { PageHeader, cx } from "../components/ui";
import {
  COMPARE_TONE_LEGEND,
  type CompareMetrics,
  type CompareSection,
  buildDuplicateCompareSections,
  compareHeadline,
  compareToneLabelKey,
  overallFromConflict,
  overallFromOverlap,
} from "../lib/duplicateCompare";

// SCRUM-488: Punktfarbe je Ampel für die Legende (gleiche Semantik wie die Score-Balken-Segmente).
const TONE_DOT: Record<CompareSection["tone"], string> = {
  green: "bg-trust-pos-text",
  yellow: "bg-trust-warn-text",
  red: "bg-trust-crit-text",
};

// SCRUM-487 (i18n): die Lib liefert die Abschnitts-Labels weiterhin deutsch (stabiler Test-Vertrag);
// die Anzeige übersetzt sie über diese stabile Zuordnung. Unbekannte Labels fallen auf den Rohwert
// zurück. Die heuristischen reason/note-Texte kommen jetzt als i18n-Keys (dcmp.reason.* / dcmp.note.*)
// aus der Lib und werden hier über t(...) übersetzt.
const SECTION_LABEL_KEY: Record<string, string> = {
  Titel: "dcmp.section.title",
  "Kernaussage / Inhalt": "dcmp.section.statement",
  Bedingungen: "dcmp.section.conditions",
  Massnahmen: "dcmp.section.measures",
  Hinweise: "dcmp.section.hints",
  "Quellen / Evidence": "dcmp.section.sources",
  "Tags / Kategorie": "dcmp.section.tags",
  "Trust / Validierungsstatus": "dcmp.section.trust",
};

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
  const { t } = useTranslation();
  const head = compareHeadline(metrics);
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-trust-pos-text">
          {percent(head.leadPercent)}
        </span>
        <span className="text-[13px] font-semibold text-text">{t("dcmp.textSimilarity")}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted-2">{t("dcmp.noProvenContradiction")}</p>
      <div className="mt-3">
        <ScoreBar metrics={metrics} />
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer list-none text-[12px] font-semibold text-ai hover:opacity-80">
          {t("dcmp.moreValues")}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              {t("dcmp.uncertainty")}
            </div>
            <div className="text-lg font-semibold text-trust-warn-text">
              {percent(head.uncertaintyPercent)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
              {t("dcmp.textDifference")}
            </div>
            <div className="text-lg font-semibold text-trust-crit-text">
              {percent(head.differencePercent)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{t(metrics.note)}</p>
      </details>
      <p className="mt-2 text-[12px] font-semibold text-muted">{t("dcmp.scoresHint")}</p>
    </div>
  );
}

function KoPanel({ label, ko }: { label: string; ko: KnowledgeObject | null }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-hairline bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2">{label}</span>
        {ko ? (
          <Link
            to={`/wissen/${ko.id}`}
            className="text-[12px] font-semibold text-ai hover:underline"
          >
            {t("dcmp.viewDetails")}
          </Link>
        ) : null}
      </div>
      {ko ? (
        <KoView ko={ko} />
      ) : (
        // SCRUM-486 C: kein Roh-UUID in der Nutzersicht — neutraler „entfernt"-Hinweis.
        <div className="rounded-card border border-dashed border-hairline bg-page p-3 text-[12.5px] text-muted">
          {t("dcmp.objectRemoved")}
        </div>
      )}
    </div>
  );
}

function TonePill({ tone }: { tone: CompareSection["tone"] }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span
      className={cx(
        "rounded-pill px-2 py-0.5 font-mono text-[10px] font-semibold uppercase",
        tone === "green" && "bg-trust-pos-bg text-trust-pos-text",
        tone === "yellow" && "bg-trust-warn-bg text-trust-warn-text",
        tone === "red" && "bg-trust-crit-bg text-trust-crit-text",
      )}
    >
      {t(compareToneLabelKey(tone))}
    </span>
  );
}

function SectionRow({ section }: { section: CompareSection }): JSX.Element {
  const { t } = useTranslation();
  const labelKey = SECTION_LABEL_KEY[section.label];
  const label = labelKey ? t(labelKey) : section.label;
  return (
    <div className="grid gap-3 rounded-card border border-hairline bg-surface p-4 lg:grid-cols-[1fr_220px_1fr]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {t("dcmp.left")}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
          {section.leftValue}
        </p>
      </div>
      <div className="rounded-card bg-page p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text">{label}</span>
          <TonePill tone={section.tone} />
        </div>
        {/* SCRUM-486 B: „Ähnlichkeit"/„Textunterschied" statt „Match"/„Konflikt" — kein fachliches Urteil. */}
        <div className="mt-2 space-y-1 text-[11.5px] text-muted">
          <div>
            {t("dcmp.similarity")}: {percent(section.metrics.match)}
          </div>
          <div>
            {t("dcmp.uncertainty")}: {percent(section.metrics.uncertainty)}
          </div>
          <div>
            {t("dcmp.textDifference")}: {percent(section.metrics.conflict)}
          </div>
        </div>
        <div className="mt-2">
          <ScoreBar metrics={section.metrics} />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{t(section.reason)}</p>
      </div>
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {t("dcmp.right")}
        </div>
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

export function DuplicateCompare({ kind }: { kind: DuplicateCompareKind }): JSX.Element {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const duplicates = useDuplicates();
  const conflicts = useConflicts();
  const kos = useKos();
  const isDuplicate = kind === "duplicate";
  const pageTitle = t(isDuplicate ? "dcmp.titleDuplicate" : "dcmp.titleConflict");
  const loading = kos.isLoading || (isDuplicate ? duplicates.isLoading : conflicts.isLoading);
  const error = kos.isError || (isDuplicate ? duplicates.isError : conflicts.isError);
  const entry = isDuplicate
    ? duplicates.data?.find((item) => item.id === id)
    : conflicts.data?.find((item) => item.id === id);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader kicker={t("dcmp.kicker")} title={pageTitle} />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          {t("dcmp.loading")}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader kicker={t("dcmp.kicker")} title={pageTitle} />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          {t("dcmp.loadError")}
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          kicker={t("dcmp.kicker")}
          title={pageTitle}
          actions={<Link to={isDuplicate ? "/duplikate" : "/konflikte"}>{t("dcmp.back")}</Link>}
        />
        <div className="rounded-card border border-dashed border-hairline bg-surface p-10 text-center text-sm text-muted">
          {t("dcmp.notFound")}
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

  // SCRUM-486 C / SCRUM-487: Beziehung/Konfliktart als übersetztes Klartext-Label (Fallback: Rohwert).
  const sourceTitle = isDuplicate
    ? t("dcmp.sourceDuplicate", {
        relation: t(`dcmp.relation.${(entry as OverlapEntry).relation}`, {
          defaultValue: (entry as OverlapEntry).relation,
        }),
      })
    : t("dcmp.sourceConflict", {
        type: t(`dcmp.conflictType.${(entry as Conflict).type}`, {
          defaultValue: (entry as Conflict).type,
        }),
      });

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        kicker={t("dcmp.kicker")}
        title={pageTitle}
        actions={
          <Link
            to={isDuplicate ? "/duplikate" : "/konflikte"}
            className="rounded-btn border border-hairline px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t("dcmp.back")}
          </Link>
        }
      />

      {/* SCRUM-486 C: EIN ehrlicher Satz, was diese Ansicht tut (und was nicht). */}
      <div className="mb-4 rounded-card border border-ai/20 bg-ai/5 p-4">
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {sourceTitle}
        </div>
        <p className="mt-1 text-[13px] text-text">{t("dcmp.onlyForComparison")}</p>
      </div>

      <ScoreSummary metrics={overall} />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <KoPanel label={t("dcmp.koA")} ko={left} />
        <KoPanel label={t("dcmp.koB")} ko={right} />
      </div>

      <div className="mt-6 space-y-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
            {t("dcmp.sectionSignals")}
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <h2 className="text-lg font-semibold text-ink">{t("dcmp.compareByAreas")}</h2>
            <HelpTip title={t("dcmp.legendHelpTitle")} body={t("dcmp.legendHelpBody")} />
          </div>
          {/* SCRUM-488 (Nullschulung): Ampel-Legende — grün/gelb/rot ohne Erklärung war ein Blindspot. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
            {COMPARE_TONE_LEGEND.map((legend) => (
              <span key={legend.tone} className="flex items-center gap-1.5">
                <span className={cx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[legend.tone])} />
                <span className="font-semibold text-text">{t(legend.labelKey)}</span>
                <span className="text-muted-2">— {t(legend.meaningKey)}</span>
              </span>
            ))}
          </div>
        </div>
        {sections.length > 0 ? (
          sections.map((section) => <SectionRow key={section.key} section={section} />)
        ) : (
          <div className="rounded-card border border-dashed border-hairline bg-surface p-6 text-sm text-muted">
            {t("dcmp.sectionCompareUnavailable")}
          </div>
        )}
      </div>
    </div>
  );
}
