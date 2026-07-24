// FUNKE (nacht24 Paket 6, SCRUM-477/529): die sichtbare Wirkungs-Schleife — würdevoll, ruhig,
// KEIN Punkte-Zirkus (Industrie-Publikum). Drei Bausteine:
//  - MyImpactNumbers (F1): „Meine Wirkung" — nur Zahlen über EIGENE Beiträge.
//  - OpenGapsSummary (F3): „Offene Wissenslücken" als AGGREGIERTE ZAHL mit Weg in die berechtigte
//    Risiko-&-Lücken-Ansicht — KEIN Fragen-Freitext, keine Frage in einer URL.
//  - KnowledgeCapitalNumbers (F5): Wissenskapital-Kachel — ehrliche Bestandssummen.
// Alle drei sind PRÄSENTATIONAL (Daten als Props → mountbar ohne Netz); die Seiten verdrahten
// die Hooks. Vertrauliche Inhalte erscheinen NIE im Klartext.
// FUNKE-FIX P0 (bens Sammel-Nacht): Die frühere OpenGapsList rendere gespeicherte Gap-FREITEXTE und
// trug sie über captureGapHref(gap.question) in die Navigations-URL. Gap-Fragen sind Nutzer-Freitext
// OHNE Vertraulichkeitsstufe; die prominente Startseite hätte damit vertraulichen Entwurfstext
// org-weit sichtbar gemacht (und in Browser-Historie/URL getragen). Die Startseite zeigt jetzt NUR
// die anonyme offene Zahl; Freitext erst NACH bewusst berechtigtem Einstieg (Risiko & Lücken).
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { MyImpact } from "../api/types";
import type { KnowledgeCapital } from "../lib/funke";

function NumberTile({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div className="rounded-card bg-page px-3 py-2.5 text-center">
      <div className="font-mono text-[22px] font-semibold leading-tight text-ink">{value}</div>
      <div className="mt-0.5 text-[11px] leading-snug text-muted">{label}</div>
    </div>
  );
}

// F1: „Meine Wirkung" — meine Beiträge · davon validiert · in Antworten zitiert · als hilfreich
// markiert. Ehrliche Fußnote: „zitiert" zählt die führende Antwort-Quelle (mehr gibt der Beleg
// nicht her — nichts wird erfunden).
export function MyImpactNumbers({ impact }: { impact: MyImpact }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="my-impact">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumberTile value={impact.contributions} label={t("funke.impact.contributions")} />
        <NumberTile value={impact.validated} label={t("funke.impact.validated")} />
        <NumberTile value={impact.cited} label={t("funke.impact.cited")} />
        <NumberTile value={impact.helpfulReceived} label={t("funke.impact.helpful")} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-2">{t("funke.impact.hint")}</p>
    </div>
  );
}

// F3: Offene Wissenslücken als AGGREGIERTE ZAHL. FUNKE-FIX P0 (bens Sammel-Nacht) + FUNKE-FIX2 P0
// (bens Erforderlich 1): KEIN Fragen-Freitext auf der Startseite, keine Frage in einer URL — die Kachel
// bekommt jetzt nur noch die reine AGGREGIERTE ZAHL (aus dem Summary-Endpunkt; die Startseite lädt gar
// keine Gap-Volltexte mehr) und führt in die ohnehin berechtigte Risiko-&-Lücken-Ansicht (/risiko).
export function OpenGapsSummary({ total }: { total: number }): JSX.Element | null {
  const { t } = useTranslation();
  if (total <= 0) {
    return null;
  }
  return (
    <Link
      to="/risiko"
      data-testid="open-gaps-summary"
      className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-surface px-3 py-2.5 hover:border-ink/30"
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold text-ink">{t("funke.gaps.title")}</h2>
        {/* Nur die anonyme Bestandssumme — nie eine gespeicherte Gap-Frage. */}
        <p className="mt-0.5 font-mono text-[12px] text-muted">
          {t("funke.gaps.count", { n: total })}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-btn border border-ink px-2.5 py-1 text-[11.5px] font-semibold text-ink">
        {t("ask.toGaps")} <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

// F5: Wissenskapital-Kachel — fünf ehrliche Bestandszahlen für Begutachter, keine Fantasie-Metriken.
export function KnowledgeCapitalNumbers({ capital }: { capital: KnowledgeCapital }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="knowledge-capital">
      <h2 className="mb-1.5 text-[14px] font-semibold text-ink">{t("funke.capital.title")}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <NumberTile value={capital.secured} label={t("funke.capital.secured")} />
        <NumberTile value={capital.validated} label={t("funke.capital.validated")} />
        <NumberTile value={capital.answerableCategories} label={t("funke.capital.categories")} />
        <NumberTile value={capital.activeAuthors} label={t("funke.capital.authors")} />
        <NumberTile value={capital.openGaps} label={t("funke.capital.gaps")} />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-2">{t("funke.capital.hint")}</p>
    </div>
  );
}
