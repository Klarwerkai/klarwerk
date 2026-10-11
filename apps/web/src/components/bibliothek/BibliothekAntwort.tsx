import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { useReasonerStatus } from "../../api/hooks";
import type { KnowledgeObject } from "../../api/types";
import { aiSperrHinweisKey } from "../../lib/aiAvailability";
import { citationState } from "../../lib/askCitedSources";
import { answerReviewGuard } from "../../lib/askView";
import { type ConflictKnowledge, effectiveAnswer } from "../../lib/effectiveAnswer";
import { kiBremsSatz } from "../../lib/kiBremse";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { useAiAvailable } from "../../lib/useAiAvailable";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { AiModelInfo } from "../AiModelInfo";
import { AiUnavailableHint } from "../AiUnavailableHint";
import { AntwortText } from "../start/AntwortText";

// ==================================================================================================
// R-0429 SLICE 2 — DIE VERDICHTETE ANTWORT ÜBER DEN TREFFERN DER BIBLIOTHEK.
// ==================================================================================================
//
// PETERS ENTSCHEIDUNG ZU FRAGE 52 (11.10.2026): „In einem klar erkennbaren Antwortbereich oberhalb
// der Treffer, mit anklickbaren Quellen. Die ursprünglichen Suchtreffer bleiben erreichbar."
// Der Berater dazu (R-0429): sichtbare Trennung zwischen „gefunden" und „von der KI verdichtet".
//
// SO IST ES GEBAUT:
//   · Sobald gesucht wird, steht über der Liste ein abgesetzter Bereich „Von der KI verdichtet" mit
//     EINEM Knopf. Darunter beginnt die Liste mit der Zeile „Gefunden" — zwei Wörter, keine
//     Erklärung (H4, Pedi 04.09.: kein Erklärtext im Sichtfeld).
//   · Ein Klick holt die Antwort über DENSELBEN Anfragevertrag wie die Fragenseite
//     (`endpoints.ask.ask`), mit derselben Einstufung (`effectiveAnswer`), denselben Fussnoten
//     (`AntwortText`) und denselben Vorbehaltstexten. Es entsteht keine zweite Antwortlogik.
//   · Die Quellen sind Knöpfe: ein Klick öffnet die Quelle rechts in der Lesefläche — die Liste und
//     die Suche bleiben, wo sie sind.
//
// WARUM ZWEI BAUTEILE: das Angebot braucht keinen Hook ausser der Übersetzung. Erst der Klick
// montiert `AntwortLauf`, und erst dort werden Modellstand, Rolle und Konfigurationsauskunft
// gelesen. So schickt Tippen allein nie eine Anfrage an ein Modell, und eine Bibliothek ohne
// Suchbegriff sieht exakt aus wie vorher.
//
// NICHT HIER: eine Antwort, die auf genau einen Eintrag beschränkt ist. Der Anfragevertrag kennt
// keine solche Bindung (s. `fragen.ts`, `FRAGEN_KO_PARAM`); die Antwort beruht auf dem ganzen
// Bestand, den diese Person lesen darf.

/** Ab dieser Länge des Suchbegriffs steht das Angebot (wie beim KI-Knopf in Klara). */
export const ANTWORT_MINDESTLAENGE = 3;

/** Die Stellen der tragenden Quellen in `sources`, 1-basiert — dieselbe Regel wie auf `/fragen`. */
function tragendeNummern(
  sources: readonly string[],
  cited: readonly string[] | undefined,
): number[] | undefined {
  if (citationState(cited) !== "attributed") {
    return undefined;
  }
  const nummern = (cited ?? []).map((id) => sources.indexOf(id) + 1).filter((n) => n > 0);
  return nummern.length > 0 ? nummern : undefined;
}

const WARNKASTEN = "rounded-btn bg-trust-warn-bg px-2.5 py-1.5 text-[12px] text-trust-warn-text";

function AntwortLauf({
  frage,
  bestand,
  konflikte,
  onQuelle,
}: {
  frage: string;
  bestand: readonly KnowledgeObject[];
  konflikte: ConflictKnowledge;
  onQuelle: (id: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const answerAi = useAiAvailable("answer");
  const reasonerStatus = useReasonerStatus();
  const sperrHinweis = aiSperrHinweisKey(
    reasonerStatus.data,
    "answer",
    reasonerStatus.isError && !reasonerStatus.data,
  );
  const ask = useMutation({
    mutationFn: (f: string) => endpoints.ask.ask(f, toReasonerLocale(i18n.language)),
  });
  const { mutate } = ask;

  // Ein Schuss je Klick: erst wenn der Modellstand bekannt ist, und ohne nutzbares Modell gar
  // nicht — dann steht der Sperrhinweis da (dieselbe Regel wie der Auto-Ask auf `/fragen`).
  const gesendet = useRef(false);
  useEffect(() => {
    if (gesendet.current || answerAi.isLoading || !answerAi.available) {
      return;
    }
    gesendet.current = true;
    mutate(frage);
  }, [answerAi.isLoading, answerAi.available, frage, mutate]);

  const result = ask.data?.result;
  const effective = result ? effectiveAnswer(result, bestand, konflikte) : null;
  const reviewGuard = effective
    ? answerReviewGuard(effective.grade, effective.carryingSources)
    : null;

  return (
    <div className="mt-1.5 flex flex-col gap-2">
      <AiModelInfo task="answer" />
      <AiUnavailableHint
        show={!answerAi.isLoading && !answerAi.available}
        hinweisKey={sperrHinweis}
      />
      <output aria-live="polite" className="block">
        {ask.isPending ? (
          <span data-bib-text className="text-[12px] text-muted">
            {t("lib.antwort.laeuft")}
          </span>
        ) : null}
      </output>
      {ask.isError ? (
        <p data-testid="bib-antwort-fehler" data-bib-text className={WARNKASTEN}>
          {kiBremsSatz(ask.error) ?? t("state.error")}
        </p>
      ) : null}
      {result && effective ? (
        result.answered && result.answer ? (
          <div data-testid="bib-antwort-ergebnis" className="flex flex-col gap-2">
            <div data-bib-text className="max-h-[40vh] overflow-y-auto">
              <AntwortText
                text={result.answer}
                quellen={result.sources.length}
                tragend={tragendeNummern(result.sources, result.citedSources)}
                className="text-[13px] leading-relaxed text-text"
              />
            </div>
            <p className="m-0" data-bib-text>
              <AiGeneratedNotice />
            </p>
            <span
              data-testid="bib-antwort-einstufung"
              data-bib-text
              className="self-start rounded-pill border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-muted"
            >
              {t(effective.evidence.labelKey)}
            </span>
            {/* Die Vorbehalte der Fragenseite mit IHREN Texten — keiner fällt weg (R-0287). */}
            {reviewGuard ? (
              <div data-testid="bib-antwort-vorbehalt" data-bib-text className={WARNKASTEN}>
                <div className="font-semibold">{t(reviewGuard.labelKey)}</div>
                <p className="mt-0.5">{t(reviewGuard.hintKey)}</p>
              </div>
            ) : null}
            {effective.sourcesConflicted ? (
              <div data-testid="bib-antwort-vorbehalt" data-bib-text className={WARNKASTEN}>
                <div className="font-semibold">{t("conflict.impact.title")}</div>
                <p className="mt-0.5">{t("conflict.impact.hint")}</p>
              </div>
            ) : null}
            {effective.conflictCaveat ? (
              <div data-testid="bib-antwort-vorbehalt" data-bib-text className={WARNKASTEN}>
                <div className="font-semibold">{t("ask.conflictCaveat.title")}</div>
                <p className="mt-0.5">
                  {t(`ask.conflictCaveat.${effective.conflictCaveat.reason}`)}
                </p>
              </div>
            ) : null}
            {effective.caveat ? (
              <div data-testid="bib-antwort-vorbehalt" data-bib-text className={WARNKASTEN}>
                <div className="font-semibold">{t("ask.checkCaveat.title")}</div>
                <p className="mt-0.5">
                  {t(`ask.checkCaveat.${effective.caveat.reason}`, {
                    unproven: effective.caveat.unproven,
                    total: effective.caveat.total,
                  })}
                </p>
              </div>
            ) : null}
            {result.sources.length > 0 ? (
              <div
                data-testid="bib-antwort-quellen"
                className="flex flex-wrap items-center gap-1.5"
              >
                <span
                  data-bib-text
                  className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2"
                >
                  {t("lib.antwort.quellen")}
                </span>
                {result.sources.map((id, i) => {
                  const titel = bestand.find((k) => k.id === id)?.title;
                  return (
                    <button
                      key={id}
                      type="button"
                      data-testid="bib-antwort-quelle"
                      data-bib-id={id}
                      onClick={() => onQuelle(id)}
                      className="rounded-pill border border-hairline bg-surface px-2 py-0.5 text-[11px] font-semibold text-text hover:border-ink/30"
                    >
                      {`${i + 1} · ${titel ?? t("lib.antwort.quelleN", { n: i + 1 })}`}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : (
          // Keine belegte Antwort: es wird nichts erfunden, und das steht da.
          <div data-testid="bib-antwort-luecke" data-bib-text className="text-[12px] text-muted">
            <div className="font-semibold text-text">{t("ask.gapBadge")}</div>
            <p className="mt-0.5">{t("ask.gap.noInvent")}</p>
          </div>
        )
      ) : null}
    </div>
  );
}

/**
 * Der Antwortbereich über den Treffern. Der Aufrufer setzt `key={frage}`: mit einem neuen
 * Suchbegriff beginnt der Bereich wieder beim Angebot, und keine Antwort steht neben Treffern,
 * zu denen sie nicht gehört.
 */
export function BibliothekAntwort({
  frage,
  bestand,
  konflikte,
  onQuelle,
}: {
  frage: string;
  bestand: readonly KnowledgeObject[];
  konflikte: ConflictKnowledge;
  onQuelle: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [angefordert, setAngefordert] = useState(false);
  const [offen, setOffen] = useState(true);
  return (
    <div className="flex flex-col gap-1.5 px-4 pb-1.5">
      <section
        data-testid="bib-antwort"
        aria-label={t("lib.antwort.titel")}
        className="rounded-card border border-ai/30 bg-ai-surface-2 px-3 py-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            data-bib-text
            className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-ai"
          >
            {t("lib.antwort.titel")}
          </span>
          {angefordert ? (
            <button
              type="button"
              data-testid="bib-antwort-umschalten"
              aria-expanded={offen}
              onClick={() => setOffen((o) => !o)}
              className="rounded-btn px-1.5 py-0.5 text-[11.5px] font-semibold text-ai hover:bg-ai-surface-1"
            >
              {offen ? t("lib.antwort.ausblenden") : t("lib.antwort.einblenden")}
            </button>
          ) : null}
        </div>
        {angefordert ? (
          // Ausblenden behält die Antwort (kein zweiter Modellaufruf beim Wiedereinblenden).
          <div hidden={!offen}>
            <AntwortLauf
              frage={frage}
              bestand={bestand}
              konflikte={konflikte}
              onQuelle={onQuelle}
            />
          </div>
        ) : (
          <button
            type="button"
            data-testid="bib-antwort-anfordern"
            onClick={() => setAngefordert(true)}
            className="mt-1.5 inline-flex h-8 items-center rounded-btn border border-ai bg-surface px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1"
          >
            {t("lib.antwort.anfordern")}
          </button>
        )}
      </section>
      <span
        data-testid="bib-gefunden"
        data-bib-text
        className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2"
      >
        {t("lib.antwort.gefunden")}
      </span>
    </div>
  );
}
