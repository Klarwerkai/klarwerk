// ================================================================================================
// FE-003 · DIE QUELLENLISTE UNTER „…“ → „MEHR …“ — ein Baustein für die echte Seite und das Tutorial.
// ================================================================================================
//
// Bis FE-003 (Runde 2) stand diese Liste inline in `pages/Ask.tsx`, im Seitenblatt „Mehr“ der
// Antwortkarte. Das Tutorial „Fragen“ führt genau diesen Weg vor — „…“ an der Antwortkarte →
// „Mehr …“ → Quellenliste —, und zwar mit DEMSELBEN Baustein (Bens Befund, Runde 1: die Demo hatte
// einen eigenen Weg „Chip → Liste“ erfunden). Das Markup ist zeichengleich umgezogen; die
// Begründungen der einzelnen Zeilen (mega52 A3/A4/A5, JOB 3267 Q1, SCRUM-250/300/308/357,
// WP-RETEST7 R5, JOB 4224 R3) stehen mit ihnen hier.
//
// WAS DIE SEITE ENTSCHEIDET, NICHT DIESER BAUSTEIN: welche Quelle „verwendet“ ist, ihr Prüfstand,
// ob die Zuordnung tragfähig ist, wohin der Titel verlinkt, ob „Danke“ angeboten wird. Die Demo
// reicht dafür `wissenHref={null}` (eine erfundene Quelle hat kein Wissensobjekt, also keinen Link)
// und `dank={null}` (nichts, was eine Nutzerdatenänderung auslösen könnte).
import { ArrowRight, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KnowledgeObject } from "../../api/types";
import { canThank } from "../../lib/askCitedSources";
import type { AnswerCheckState } from "../../lib/askView";
import type { EvidenceTone } from "../../lib/knowledgeClass";
import type { KoUsability } from "../../lib/koOverview";
import { useReadiness } from "../../lib/useReadiness";
import { AnswerSourceDetails } from "../AnswerSourceDetails";
import { SectionLabel } from "../ui";
import {
  PruefstandPlakette,
  VERWENDUNG_BADGE,
  VERWENDUNG_HINWEIS,
  type Verwendung,
  VerwendungsPlakette,
} from "./Quellenplaketten";
import { FRAGEN_ZIEL } from "./ziele";

// Tone → Badge-Stil (Tailwind-Tokens). Die Fragenfläche liest dieselbe Tabelle für ihre
// Einstufungs-Etiketten (`pages/Ask.tsx`).
export const EVIDENCE_TONE: Record<EvidenceTone, string> = {
  pos: "bg-trust-pos-bg text-trust-pos-text",
  warn: "bg-trust-warn-bg text-trust-warn-text",
  crit: "bg-trust-crit-bg text-trust-crit-text",
  neutral: "bg-page text-muted",
};

/**
 * Die Anker der Quellenliste. `ask-source-carrying`/`ask-source-consulted` bleiben WÖRTLICH
 * erhalten (`tests/app/job2703-ask-trefferliste-und-panel.test.tsx:227` misst daran); neu ist
 * allein der dritte Zustand.
 */
const VERWENDUNG_ANKER: Record<Verwendung, string> = {
  verwendet: "ask-source-carrying",
  nichtVerwendet: "ask-source-consulted",
  unbekannt: "ask-source-unclear",
};

/** Eine Zeile — die Auskunft, die die Seite je Quelle EINMAL berechnet (`quellenAuskunft`). */
export interface QuellenZeile {
  id: string;
  label: string;
  carrying: boolean;
  verwendung: Verwendung;
  pruefstand: string | null;
  pruefstandWort: string;
  pruefstandHinweis: string;
  usability: KoUsability | null;
  checkState: AnswerCheckState;
  conflictLimited: boolean;
  demo: boolean;
}

export function QuellenListe({
  quellen,
  zuordnungTragfaehig,
  wissenHref,
  bildfundstelle,
  koVon,
  autorVon,
  standBestaetigt,
  dank,
}: {
  quellen: readonly QuellenZeile[];
  zuordnungTragfaehig: boolean;
  /** Ziel des Titel-Links; `null` = kein Link (die Demo-Quelle hat kein Wissensobjekt). */
  wissenHref: ((id: string) => string) | null;
  bildfundstelle: (id: string) => boolean;
  koVon: (id: string) => KnowledgeObject | undefined;
  autorVon: (autor: string) => string;
  standBestaetigt: boolean;
  /** „Danke“ je tragender Quelle; `null` = nicht angeboten. */
  dank: {
    bedankt: (id: string) => boolean;
    laeuft: boolean;
    danken: (id: string) => void;
  } | null;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="mt-4" data-tutorial-ziel={FRAGEN_ZIEL.quellenliste}>
      <SectionLabel>{t("ask.sources")}</SectionLabel>
      {/* SCRUM-300: ehrliche Kernaussage — die Antwort ist quellengebunden und nur so belastbar
          wie die genutzte Quelle (Status/Trust/Nutzbarkeit). */}
      <p className="mt-0.5 text-[12px] text-muted-2">{t("ask.sourcesHint")}</p>
      {/* AUFTRAG-mega52 A5 — DIE REISSLEINE, SICHTBAR. Liefert das Modell keine oder unbrauchbare
          Fußnotenmarken, wird NICHT geraten; es steht hier, dass die Zuordnung nicht möglich war,
          und keine Zeile trägt ein Kennzeichen. JOB 3267 R3: auch bei ausschliesslich fremden
          Kennungen. */}
      {!zuordnungTragfaehig ? (
        <p
          data-testid="ask-attribution-unknown"
          className="mt-1.5 rounded-card border border-hairline bg-page px-2.5 py-1.5 text-[12px] leading-relaxed text-muted"
        >
          {t("ask.attribution.unknown")}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
          {t("ask.attribution.known")}
        </p>
      )}
      {/* SCRUM-250: Quellen handlungsnah — KO-Titel statt roher ID, Link zum Detail.
          SCRUM-300: je Quelle die kanonische Nutzbarkeit (gleiche Sprache wie KO-Detail/Library). */}
      <ul className="mt-1.5 space-y-1.5">
        {quellen.map((s) => {
          const sourceKo = koVon(s.id);
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {wissenHref ? (
                <Link
                  to={wissenHref(s.id)}
                  className="inline-flex items-center gap-1.5 text-[13px] text-brand-text hover:underline"
                >
                  <ArrowRight size={12} className="shrink-0 text-muted-2" />
                  <span className="text-text">{s.label}</span>
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <span className="text-text">{s.label}</span>
                </span>
              )}
              <span
                data-tutorial-ziel={FRAGEN_ZIEL.quellenstand}
                className="inline-flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                {/* AUFTRAG-mega52 A3 / JOB 3267 Q1: das Kennzeichen an JEDER Zeile — dieselbe
                    Auskunft wie am Chip, aus derselben Rechnung. */}
                <VerwendungsPlakette
                  zustand={s.verwendung}
                  anker={VERWENDUNG_ANKER[s.verwendung]}
                  titel={t(VERWENDUNG_HINWEIS[s.verwendung])}
                  wort={t(VERWENDUNG_BADGE[s.verwendung])}
                />
                {/* JOB 3267 Q1 (Lieferung 3): der Prüfstand mit eigenem Wort — „verwendet“
                    beantwortet nicht „geprüft“. */}
                <PruefstandPlakette
                  stand={s.pruefstand}
                  titel={s.pruefstandHinweis}
                  wort={s.pruefstandWort}
                />
              </span>
              {s.usability ? (
                <span
                  title={t(useReadiness(s.usability).hintKey)}
                  className={`shrink-0 rounded-pill px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase ${EVIDENCE_TONE[useReadiness(s.usability).tone]}`}
                >
                  {t(useReadiness(s.usability).labelKey)}
                </span>
              ) : null}
              {/* AUFTRAG-mega32 E: die Quelle, deren Prüf-Lauf die Vollständigkeit nicht belegt. */}
              {s.checkState !== "proven" ? (
                <span
                  data-testid="ask-source-unproven"
                  title={t(`ask.checkCaveat.${s.checkState}`, {
                    unproven: 1,
                    total: 1,
                  })}
                  className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text"
                >
                  {t("ask.checkCaveat.badge")}
                </span>
              ) : null}
              {/* SCRUM-357 / AG-14: konfliktbetroffene Quelle ehrlich kennzeichnen. */}
              {s.conflictLimited ? (
                <span
                  title={t("conflict.impact.hint")}
                  className="shrink-0 rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-trust-warn-text"
                >
                  {t("conflict.impact.badge")}
                </span>
              ) : null}
              {/* WP-RETEST7 R5: Treffer kam über die Bild-Fußnote. */}
              {bildfundstelle(s.id) ? (
                <span className="shrink-0 rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2">
                  {t("lib.match.caption")}
                </span>
              ) : null}
              {/* SCRUM-308: Herkunfts-Kennzeichnung Demo-/Seed-Wissen (neutral, kein Statussignal). */}
              {s.demo ? (
                <span
                  title={t("demo.badge.hint")}
                  className="shrink-0 rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted-2"
                >
                  {t("demo.badge.label")}
                </span>
              ) : null}
              {/* FUNKE F2 / AUFTRAG-mega52 A4: gedankt wird nur, was die Antwort GETRAGEN hat. */}
              {dank && canThank(s) ? (
                <button
                  type="button"
                  disabled={dank.bedankt(s.id) || dank.laeuft}
                  onClick={() => dank.danken(s.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-hairline px-2 py-0.5 text-[10.5px] font-semibold text-muted hover:text-text disabled:opacity-60"
                >
                  <ThumbsUp size={11} />
                  {dank.bedankt(s.id) ? t("ask.thanked") : t("ask.helpful")}
                </button>
              ) : null}
              {/* Paket 4 (nacht24): je Quelle Status/Trust, Kurzvorschau, Original und Auszug — nur
                  aus bereits geladenen, berechtigten KO-Daten. JOB 4224 R3: bei gescheiterter
                  Auffrischung ist der Quellenstand UNBEKANNT, das Original-Angebot entfällt. */}
              {sourceKo ? (
                <div data-tutorial-ziel={FRAGEN_ZIEL.original} className="w-full">
                  <AnswerSourceDetails
                    ko={sourceKo}
                    authorName={autorVon(sourceKo.author)}
                    standBestaetigt={standBestaetigt}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
