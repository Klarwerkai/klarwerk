import { useTranslation } from "react-i18next";
import {
  ConfidenceBar,
  DISPLAY_STATUSES,
  KNOWLEDGE_TYPES,
  KnowledgeTypeTag,
  ProvenanceLine,
  ReasonerDraft,
  StatusPill,
} from "../components/trust";

// Dev-Schaufenster der Vertrauens-System-Komponenten (#59). Nicht in der Nav;
// über /ui-kit erreichbar zur Sicht- und Regressionsprüfung.
function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-[10.5px] uppercase tracking-wider text-muted-2">{title}</h2>
      <div className="rounded-card border border-hairline bg-surface p-4">{children}</div>
    </section>
  );
}

export function UiKit(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-ink">Vertrauens-System · UI-Kit</h1>

      <Section title="Status-Pills">
        <div className="flex flex-wrap gap-2">
          {DISPLAY_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </Section>

      <Section title="Konfidenz / Reifegrad">
        <div className="space-y-3">
          <ConfidenceBar value={42} />
          <ConfidenceBar value={73} />
          <ConfidenceBar value={91} />
        </div>
      </Section>

      <Section title="Wissensarten">
        <div className="flex flex-wrap gap-2">
          {KNOWLEDGE_TYPES.map((k) => (
            <KnowledgeTypeTag key={k} type={k} />
          ))}
        </div>
      </Section>

      <Section title="KI-Kennung (Reasoner-Entwurf)">
        <ReasonerDraft>
          <p className="text-sm text-text">{t("uikit.sampleStatement")}</p>
        </ReasonerDraft>
      </Section>

      <Section title="Herkunftszeile">
        <ProvenanceLine
          author="M. Brandt"
          originalAuthor="D. Roth"
          domain="Presse P2"
          version={3}
        />
      </Section>
    </div>
  );
}
