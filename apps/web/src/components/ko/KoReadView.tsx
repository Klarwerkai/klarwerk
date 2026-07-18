import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import i18n from "../../i18n";
import { deriveStatus } from "../../lib/displayStatus";
import { StatusPill } from "../trust";
import { SectionLabel } from "../ui";
import { KoReadDetails, KoReadHeader, KoReadStatement } from "./KoRead";
import { SourceEvidence } from "./SourceEvidence";

// SCRUM-513 (WP3-Design): die Zonen-Leseansicht des KO. Messlatte: ein fachfremder Leser erfasst in
// <10 s WAS gilt · WIE sicher · WOHER · WER/WANN. PURE Komponente (Props rein, JSX raus): sie beschafft
// keine Daten und mutiert nichts. Bestehende Aktionen/Edit-Einstiege werden als `actions`-Slot ehrlich
// NACHGEORDNET übergeben (Verhalten unverändert), nicht entfernt.
//
// - ZONE 1 (Hero): Kernaussage groß + Status + Konfidenz mit %-Sprache.
// - ZONE 2 (Beleg, DIREKT sichtbar): SourceEvidence (klickbare Quelle + Quelldatum + Konfidenz) +
//   Freigabe-Status/-Datum. (Ein dedizierter validiert-von/-am-Vertrag fehlt noch — siehe Bericht;
//   hier wird nur EHRLICH das gezeigt, was der KO-Vertrag trägt, nichts geraten.)
// - ZONE 3 (Sekundär, kompakt): Kategorie · Verantwortlich · Version · Erfasst am.
// - EINGEKLAPPT: Bedingungen · Maßnahmen · Tags (weitere Historie/Lineage/Evidence bleiben in der
//   Sidebar der Seite).
export function KoReadView({
  ko,
  responsibleName,
  actions,
}: {
  ko: KnowledgeObject;
  // Aufgelöster Anzeigename des Verantwortlichen (die Seite reicht nameOf(ko.author) durch); ohne den
  // Prop wird die Roh-ID gezeigt.
  responsibleName?: string;
  // Bestehende Aktions-/Edit-Einstiege der Seite — visuell nachgeordnet, Verhalten unverändert.
  actions?: ReactNode;
}): JSX.Element {
  const { t } = useTranslation();
  // Quelldatum der Belegzeile: das Datum der ersten Quelle, sonst das KO-Erfassungsdatum.
  const evidenceDate = ko.sources?.[0]?.at ?? ko.createdAt;
  const captured = new Date(ko.createdAt);
  const capturedText = Number.isNaN(captured.getTime())
    ? null
    : captured.toLocaleDateString(i18n.language);

  return (
    <div className="space-y-5">
      {/* ZONE 1 — Hero: WAS gilt · WIE sicher */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={deriveStatus(ko)} />
        </div>
        <KoReadHeader ko={ko} />
        <div className="mt-4">
          <KoReadStatement ko={ko} />
        </div>
      </div>

      {/* ZONE 2 — Beleg: WOHER · WER/WANN. Direkt sichtbar, NICHT eingeklappt. */}
      <div className="rounded-card border border-hairline bg-surface p-4">
        <SectionLabel>{t("ko.read.evidenceZone")}</SectionLabel>
        <SourceEvidence
          sources={ko.sources ?? []}
          confidence={ko.confidence}
          date={evidenceDate}
          variant="full"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-[12px] text-muted">
          <span className="font-mono text-micro uppercase tracking-wider text-muted-2">
            {t("ko.read.released")}
          </span>
          <StatusPill status={deriveStatus(ko)} />
          {capturedText ? <span>· {capturedText}</span> : null}
        </div>
      </div>

      {/* ZONE 3 — Sekundär, kompakt: Kategorie · Verantwortlich · Version · Erfasst am */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
        <span>
          <span className="text-muted-2">{t("ko.read.category")}: </span>
          {ko.category}
        </span>
        <span>
          <span className="text-muted-2">{t("ko.read.responsible")}: </span>
          {responsibleName ?? ko.author}
        </span>
        <span>
          <span className="text-muted-2">{t("ko.read.version")}: </span>v{ko.version}
        </span>
        {capturedText ? (
          <span>
            <span className="text-muted-2">{t("ko.read.captured")}: </span>
            {capturedText}
          </span>
        ) : null}
      </div>

      {/* EINGEKLAPPT — sekundäre Detailfelder, auf Wunsch aufklappbar. */}
      {ko.conditions.length > 0 || ko.measures.length > 0 || ko.tags.length > 0 ? (
        <details className="rounded-card border border-hairline bg-surface">
          <summary className="cursor-pointer list-none px-4 py-2.5 font-mono text-micro uppercase tracking-wider text-muted-2">
            {t("ko.read.moreDetails")}
          </summary>
          <div className="border-t border-hairline p-4">
            <KoReadDetails ko={ko} />
          </div>
        </details>
      ) : null}

      {/* Bestehende Aktionen/Edit-Einstiege — nachgeordnet, Verhalten unverändert. */}
      {actions}
    </div>
  );
}
