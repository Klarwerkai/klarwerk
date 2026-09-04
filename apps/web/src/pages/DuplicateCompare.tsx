// ================================================================================================
// JOB 3061 · H2 — DIE VERGLEICHSSEITE: DERSELBE KOPF, DIESELBEN ZWEI KARTEN, DER REST IN „MEHR".
// ================================================================================================
//
// Diese Seite war bis hierher eine DRITTE Darstellung derselben zwei Objekte (neben Board-Karte und
// Modal): eigener Kopf mit Kicker „Vergleich", ein Kasten „nur zum Vergleich", ein Prozentblock mit
// Balken, zwei KoPanels, eine Ampel-Legende und acht Abschnittszeilen mit je drei Zahlen. Sie
// bleibt — sie ist der Ort für die Feinarbeit — aber sie steht jetzt unter DEMSELBEN Reiterkopf und
// zeigt DIESELBEN zwei Karten wie das Brett. Erst darunter, im „Mehr", liegen Ampeln, Ähnlichkeit,
// Unsicherheit, Textunterschied und die Legende.
//
// Erreichbar ist sie über das „···"-Menü der Karten auf dem Brett — der zweite Weg (das Modal mit
// denselben zwei Objekten) ist ersatzlos entfallen, weil die Fläche selbst jetzt die
// Gegenüberstellung IST.
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { useConflicts, useDuplicates, useKos } from "../api/hooks";
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { PruefenKopf } from "../components/pruefen/PruefenKopf";
import { PruefenMehr, PruefenMehrBlock } from "../components/pruefen/PruefenMehr";
import {
  PruefenPaar,
  PruefenPaarKarte,
  PruefenPaarZeile,
  PruefenPille,
} from "../components/pruefen/PruefenPaar";
import { PruefenSatz } from "../components/pruefen/PruefenZustand";
import { markiereTeile } from "../components/pruefen/markierung";
import { cx } from "../components/ui";
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
// die Anzeige übersetzt sie über diese stabile Zuordnung.
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
}: { value: number; className: string }): JSX.Element | null {
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
    <div className="grid gap-3 border-b border-hairline-soft py-3 last:border-b-0 lg:grid-cols-[1fr_220px_1fr]">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
          {t("dcmp.left")}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-text">
          {section.leftValue}
        </p>
      </div>
      <div className="rounded-card bg-surface p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-text">{label}</span>
          <TonePill tone={section.tone} />
        </div>
        {/* SCRUM-486 B: „Ähnlichkeit"/„Textunterschied" statt „Match"/„Konflikt" — kein Urteil. */}
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

function metaVon(ko: KnowledgeObject | null, t: (k: string) => string): string {
  if (!ko) {
    return t("dcmp.objectRemoved");
  }
  const datum = new Date(ko.createdAt);
  return [
    t(`status.${ko.status}`),
    ko.category,
    Number.isNaN(datum.getTime()) ? null : String(datum.getFullYear()),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DuplicateCompare({ kind }: { kind: DuplicateCompareKind }): JSX.Element {
  const { t } = useTranslation();
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

  const kopf = <PruefenKopf aktiv={isDuplicate ? "duplikate" : "konflikte"} />;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="laedt">{t("dcmp.loading")}</PruefenSatz>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="fehler">{t("dcmp.loadError")}</PruefenSatz>
      </div>
    );
  }
  if (!entry) {
    return (
      <div className="mx-auto max-w-[1040px]">
        {kopf}
        <PruefenSatz kennung="fehlt">{t("dcmp.notFound")}</PruefenSatz>
        <Link
          to={isDuplicate ? "/duplikate" : "/konflikte"}
          className="mt-2 inline-block text-[12.5px] font-semibold text-ai hover:opacity-80"
        >
          {t("dcmp.back")}
        </Link>
      </div>
    );
  }

  const left = findKo(kos.data, entry.koA);
  const right = findKo(kos.data, entry.koB);
  const sections = left && right ? buildDuplicateCompareSections(left, right, t) : [];
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
          note: "dcmp.note.koMissing",
        };
  const head = compareHeadline(overall);
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
  // Auf der Vergleichsseite wird NICHT geraten, was der Unterschied ist: die Abschnittstabelle
  // darunter sagt es feldweise. Die zwei Karten zeigen deshalb den Text ohne Markierung.
  const teileA = markiereTeile(left?.statement ?? "", []);
  const teileB = markiereTeile(right?.statement ?? "", []);

  return (
    <div className="mx-auto max-w-[1040px]">
      {kopf}
      <div data-testid="pruefen-flaeche" className="space-y-[22px]">
        <PruefenPaarZeile titel={left?.title ?? right?.title ?? sourceTitle}>
          <PruefenPille ton={isDuplicate ? "warn" : "crit"} kennung="art">
            {sourceTitle}
          </PruefenPille>
          <PruefenPille kennung="fuehrend">
            {isDuplicate
              ? t("dup.samePercent", { percent: Math.round(head.leadPercent) })
              : `${t("dcmp.textSimilarity")} ${percent(head.leadPercent)}`}
          </PruefenPille>
        </PruefenPaarZeile>

        <PruefenPaar>
          <PruefenPaarKarte
            seite="a"
            ton={isDuplicate ? "duplikat" : "konflikt"}
            titel={left?.title ?? t("dcmp.objectRemoved")}
            meta={metaVon(left, t)}
            teile={teileA}
            mehr={
              left ? (
                <Link
                  to={`/wissen/${left.id}`}
                  className="text-[12.5px] font-semibold text-ai hover:opacity-80"
                >
                  {t("dcmp.viewDetails")}
                </Link>
              ) : undefined
            }
          />
          <PruefenPaarKarte
            seite="b"
            ton={isDuplicate ? "duplikat" : "konflikt"}
            titel={right?.title ?? t("dcmp.objectRemoved")}
            meta={metaVon(right, t)}
            teile={teileB}
            mehr={
              right ? (
                <Link
                  to={`/wissen/${right.id}`}
                  className="text-[12.5px] font-semibold text-ai hover:opacity-80"
                >
                  {t("dcmp.viewDetails")}
                </Link>
              ) : undefined
            }
          />
        </PruefenPaar>

        {/* ---- Ampeln, Zahlen, Legende und Abschnitte: alles im „Mehr" ---------------------- */}
        <PruefenMehr kennung="vergleich">
          <PruefenMehrBlock beschriftung={t("dcmp.textSimilarity")}>
            <span className="text-[18px] font-semibold text-trust-pos-text">
              {percent(head.leadPercent)}
            </span>
            <span className="ml-2 text-muted-2">{t("dcmp.noProvenContradiction")}</span>
            <div className="mt-2">
              <ScoreBar metrics={overall} />
            </div>
            <div className="mt-2 flex flex-wrap gap-4">
              <span>
                {t("dcmp.uncertainty")}: {percent(head.uncertaintyPercent)}
              </span>
              <span>
                {t("dcmp.textDifference")}: {percent(head.differencePercent)}
              </span>
            </div>
            <p className="mt-1 text-muted">{t(overall.note)}</p>
            <p className="mt-1 font-semibold text-muted">{t("dcmp.scoresHint")}</p>
            <p className="mt-1 text-muted">{t("dcmp.onlyForComparison")}</p>
          </PruefenMehrBlock>
          <PruefenMehrBlock beschriftung={t("dcmp.legendHelpTitle")}>
            <p>{t("dcmp.legendHelpBody")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              {COMPARE_TONE_LEGEND.map((legend) => (
                <span key={legend.tone} className="flex items-center gap-1.5">
                  <span className={cx("h-2 w-2 shrink-0 rounded-full", TONE_DOT[legend.tone])} />
                  <span className="font-semibold text-text">{t(legend.labelKey)}</span>
                  <span className="text-muted-2">— {t(legend.meaningKey)}</span>
                </span>
              ))}
            </div>
          </PruefenMehrBlock>
          <PruefenMehrBlock beschriftung={t("dcmp.compareByAreas")}>
            {sections.length > 0 ? (
              sections.map((section) => <SectionRow key={section.key} section={section} />)
            ) : (
              <span>{t("dcmp.sectionCompareUnavailable")}</span>
            )}
          </PruefenMehrBlock>
        </PruefenMehr>
      </div>
    </div>
  );
}
