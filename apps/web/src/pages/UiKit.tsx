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
import { Button } from "../components/ui";
import { BENANNTE_STUFEN, MINDEST_LESEGROESSE_PX, ZIELBILD_GROESSEN_PX } from "../lib/schriftskala";

// Dev-Schaufenster der Vertrauens-System-Komponenten (#59). Nicht in der Nav;
// über /ui-kit erreichbar zur Sicht- und Regressionsprüfung.
//
// R-0919 / R-0996 (Design-Abgleich): dieselbe Seite ist der interne Bausteinkatalog und die
// Vorführfläche. Sie lädt keine Daten und schreibt nichts — ein Stand ist hier vorführbar und
// vergleichbar, ohne den Arbeitsbetrieb zu berühren. Oben die Grundwerte (Farbbedeutung,
// Schriftskala R-0918, Radien, neutrale Rückfrage R-0896), darunter die Vertrauensbausteine.
// Die Klassen stehen ausgeschrieben da, damit Tailwind sie findet.
const FARBEN = [
  { testId: "marke", klasse: "bg-brand", key: "bausteine.farben.marke" },
  { testId: "pos", klasse: "bg-trust-pos-fill", key: "bausteine.farben.pos" },
  { testId: "warn", klasse: "bg-trust-warn-fill", key: "bausteine.farben.warn" },
  { testId: "crit", klasse: "bg-trust-crit-fill", key: "bausteine.farben.crit" },
  { testId: "ki", klasse: "bg-ai", key: "bausteine.farben.ki" },
  { testId: "ink", klasse: "bg-ink", key: "bausteine.farben.ink" },
] as const;

// Die Zielbildgrößen als ausgeschriebene Klassen (Tailwind liest nur Literale).
const ZIELBILD_KLASSEN: Record<number, string> = {
  11: "text-[11px]",
  11.5: "text-[11.5px]",
  12: "text-[12px]",
  12.5: "text-[12.5px]",
  13: "text-[13px]",
  13.5: "text-[13.5px]",
  14: "text-[14px]",
  15: "text-[15px]",
  16: "text-[16px]",
  20: "text-[20px]",
  26: "text-[26px]",
};

const RADIEN = [
  { name: "card", klasse: "rounded-card" },
  { name: "btn", klasse: "rounded-btn" },
  { name: "input", klasse: "rounded-input" },
  { name: "nav", klasse: "rounded-nav" },
  { name: "pill", klasse: "rounded-pill" },
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-micro uppercase tracking-wider text-muted-2">{title}</h2>
      <div className="rounded-card border border-hairline bg-surface p-4">{children}</div>
    </section>
  );
}

export function UiKit(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-ink">Vertrauens-System · UI-Kit</h1>

      <Section title={t("bausteine.farben.titel")}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FARBEN.map((f) => (
            <li
              key={f.testId}
              data-testid={`bausteine-farbe-${f.testId}`}
              className="flex items-center gap-3"
            >
              <span aria-hidden="true" className={`h-6 w-6 shrink-0 rounded-pill ${f.klasse}`} />
              <span className="text-[13px] text-text">{t(f.key)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("bausteine.schrift.titel")}>
        <p data-testid="bausteine-untergrenze" className="mb-3 text-[13px] text-text">
          {t("bausteine.schrift.untergrenze", { px: MINDEST_LESEGROESSE_PX })}
        </p>
        <ul className="space-y-1.5">
          {BENANNTE_STUFEN.map((s) => (
            <li key={s.klasse} data-testid="bausteine-stufe" className="flex items-baseline gap-3">
              <span className="w-28 shrink-0 font-mono text-klein text-muted-2">
                {s.klasse} · {s.px}px
              </span>
              {/* Die Klassen stehen wörtlich in `lib/schriftskala.ts` — Tailwind liest sie dort. */}
              <span className={`${s.klasse} text-text`}>{t(s.verwendungKey)}</span>
            </li>
          ))}
        </ul>
        <p className="mb-1.5 mt-4 text-[12px] text-muted">{t("bausteine.schrift.zielbild")}</p>
        <ul className="space-y-1">
          {ZIELBILD_GROESSEN_PX.map((px) => (
            <li key={px} className={`text-text ${ZIELBILD_KLASSEN[px] ?? ""}`}>
              {px}px · KLARWERK
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("bausteine.radien.titel")}>
        <div className="flex flex-wrap gap-3">
          {RADIEN.map((r) => (
            <div
              key={r.name}
              className={`grid h-14 w-20 place-items-center border border-hairline bg-page font-mono text-klein text-muted-2 ${r.klasse}`}
            >
              {r.name}
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("bausteine.rueckfrage.titel")}>
        <div
          data-testid="bausteine-rueckfrage"
          className="space-y-2.5 rounded-card border border-hairline bg-page px-4 py-3.5"
        >
          <p className="text-[14px] font-bold text-text">{t("bausteine.rueckfrage.frage")}</p>
          <p className="text-[12.5px] text-muted">{t("bausteine.rueckfrage.regel")}</p>
          <div className="flex items-center gap-3">
            <Button type="button">{t("bausteine.rueckfrage.behalten")}</Button>
            <Button type="button" variant="danger">
              {t("bausteine.rueckfrage.loeschen")}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Status-Pills">
        <div className="flex flex-wrap gap-2">
          {DISPLAY_STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
        </div>
      </Section>

      {/* AUFTRAG-mega35 E: dieselbe Fassung wie auf allen normalen Leseflächen — Balken und Zahl,
          KEIN prozentbasiertes Qualitätswort. Bis hierher hing diese Seite am alten Vorgabewert und
          zeigte bei 91 weiterhin „Gesichert", obwohl das Wort überall sonst entfernt ist; /ui-kit
          ist ohne Nav erreichbar und damit sichtbar. */}
      <Section title="Konfidenz / Reifegrad">
        <div className="space-y-3">
          <ConfidenceBar value={42} showLabel={false} />
          <ConfidenceBar value={73} showLabel={false} />
          <ConfidenceBar value={91} showLabel={false} />
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
