import { useTranslation } from "react-i18next";
import type { KnowledgeObject } from "../../api/types";
import {
  BODY_READ_BLOCKS_KEY,
  BODY_READ_NOTE_KEY,
  BODY_READ_TITLE_KEY,
  bodyReadMode,
} from "../../lib/bodyReadMode";
import { BodyImageGallery } from "../BodyImageGallery";
import { SanitizedHtml } from "../SanitizedHtml";
import { ConfidenceBar } from "../trust";
import { SectionLabel } from "../ui";

// SCRUM-513 (WP1-Design): reine LESE-Präsentation des KO-Hauptinhalts, aus KnowledgeDetail.tsx
// herausgelöst. PURE Komponenten — Props rein, JSX raus, KEIN State/Mutation/Handler. Verhalten und
// Darstellung sind identisch zur vorherigen Inline-Version; die Extraktion senkt nur das Layout-Risiko und
// schafft wiederverwendbare Bausteine für die Zonen-Leseansicht (WP3).

// Zone-1-Kern: Titel + Konfidenz. SCRUM-513 (WP3): die Konfidenz zeigt lesbare %-Sprache („84 % sicher"),
// nie nur die Rohzahl (G-2/A-4).
export function KoReadHeader({ ko }: { ko: KnowledgeObject }): JSX.Element {
  return (
    <>
      <h2 className="mt-3 text-xl font-semibold text-ink">{ko.title}</h2>
      <div className="mt-2">
        <ConfidenceBar value={ko.confidence} percentPhrase />
      </div>
    </>
  );
}

// Die Hauptaussage: sanitisiertes Body-HTML (Fallback auf statement). Das „WAS gilt" der Zone 1.
export function KoReadStatement({ ko }: { ko: KnowledgeObject }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div>
      <SectionLabel>{t("ko.statement")}</SectionLabel>
      {ko.bodyHtml ? (
        // KW-STR / FR-STR-05: sanitisierter WYSIWYG-Body; Fallback auf statement.
        // SCRUM-318: lesbare Knowledge-Seiten-Rahmung mit kurzer Orientierung.
        <div className="rounded-card border border-hairline bg-surface p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-hairline pb-2">
            <span className="text-[11.5px] font-semibold text-ink">{t(BODY_READ_TITLE_KEY)}</span>
            {bodyReadMode(ko.bodyHtml).hasBlocks ? (
              <span className="rounded-pill bg-page px-2 py-0.5 text-[10.5px] font-semibold text-muted">
                {t(BODY_READ_BLOCKS_KEY)}
              </span>
            ) : null}
          </div>
          <SanitizedHtml
            html={ko.bodyHtml}
            className="prose-kw text-[14.5px] leading-relaxed text-text"
          />
          {/* WP-BILD-1d: Galerie der Beitrags-Bilder (aus den figures des Bodys abgeleitet; erscheint
              nur, wenn mindestens ein verankertes Bild existiert). */}
          <BodyImageGallery bodyHtml={ko.bodyHtml} />
          <p className="mt-2 border-t border-hairline pt-2 text-[11px] leading-relaxed text-muted">
            {t(BODY_READ_NOTE_KEY)}
          </p>
        </div>
      ) : (
        <p className="text-[14.5px] leading-relaxed text-text">{ko.statement}</p>
      )}
    </div>
  );
}

// Sekundäre Detailfelder: Bedingungen + Maßnahmen + Tags. In der Zonen-Leseansicht (WP3) eingeklappt.
export function KoReadDetails({ ko }: { ko: KnowledgeObject }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      {ko.conditions.length > 0 ? (
        <div>
          <SectionLabel>{t("ko.conditions")}</SectionLabel>
          <ul className="list-inside list-disc text-[13.5px] text-text">
            {ko.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ko.measures.length > 0 ? (
        <div className="rounded-card bg-trust-pos-bg p-3">
          <SectionLabel>{t("ko.measures")}</SectionLabel>
          <ul className="list-inside list-disc text-[13.5px] text-trust-pos-text">
            {ko.measures.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {ko.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {ko.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-pill bg-page px-2 py-0.5 font-mono text-[11px] text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Hauptaussage + Detailfelder zusammengesetzt (Aussage, Bedingungen, Maßnahmen, Tags). Bleibt als
// Baustein erhalten; die Zonen-Leseansicht (KoReadView) setzt die Teile getrennt in Zonen zusammen.
export function KoReadBody({ ko }: { ko: KnowledgeObject }): JSX.Element {
  return (
    <div className="mt-5 space-y-4">
      <KoReadStatement ko={ko} />
      <KoReadDetails ko={ko} />
    </div>
  );
}
