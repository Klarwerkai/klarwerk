// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIE ZWEITMEINUNG ZU EINER ANTWORT — NEBENEINANDER GESTELLT.
// ================================================================================================
//
// R-0305: „Zu einer Antwort kann eine zweite, unabhängige Einschätzung eingeholt werden, damit man
// sich nicht auf einen einzigen Weg verlässt." R-1099: „… dieselbe Frage von zwei Modellen
// beantworten und die beiden Antworten gegenüberstellen. Weichen sie voneinander ab, ist das ein
// Warnzeichen, dem jemand nachgehen muss."
//
// WAS DIESER BAUSTEIN TUT: ein Knopf unter der stehenden Antwort. Er stellt DIESELBE Frage samt
// Gesprächsfaden noch einmal, diesmal mit `zweitmeinung: true` — der Server beantwortet sie dann
// über den gewohnten Antwortweg (A) und über das Modell, das der Administrator für die Zweitmeinung
// gewählt hat (B), aus derselben Grundlage. Beide Antworten stehen hier nebeneinander, darüber das
// Ergebnis des Abgleichs: ein Warnzeichen bei Abweichung, sonst der ehrliche Satz, dass der Abgleich
// an seinen Merkmalen nichts gefunden hat — und immer die Grenze dieses Abgleichs.
//
// WAS ER BEWUSST NICHT TUT: den Zustand der Fragenseite anfassen. Die stehende Antwort, ihr Beleg
// und ihr Dank-Knopf bleiben, wie sie sind; dieser Baustein hält seine eigene Anfrage. Deshalb sagt
// er auch, dass Antwort A neu gestellt wurde und im Wortlaut von der Antwort oben abweichen kann.
//
// Modell- und Anbieternamen erscheinen nicht — der Server liefert nur die Stufe (WP-VIP2-GATE-2).
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type {
  Fragekontext,
  ZweitmeinungAntwort,
  ZweitmeinungErgebnis,
  ZweitmeinungStufe,
} from "../../api/types";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { AiCostHint } from "../AiCostHint";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { AntwortText } from "../start/AntwortText";

type Gegenueberstellung = Extract<ZweitmeinungErgebnis, { status: "verglichen" }>;

/** Die Stellen der tragenden Quellen in `sources`, 1-basiert — wie die Fragenseite sie zählt. */
function tragendeStellen(antwort: ZweitmeinungAntwort): number[] {
  return antwort.citedSources
    .map((id) => antwort.sources.indexOf(id) + 1)
    .filter((stelle) => stelle > 0);
}

function Spalte({
  testId,
  kopf,
  antwort,
  titelVon,
}: {
  testId: string;
  kopf: string;
  antwort: ZweitmeinungAntwort;
  titelVon: (id: string) => string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const titel = antwort.citedSources.flatMap((id) => {
    const name = titelVon(id);
    return name === undefined ? [] : [{ id, name }];
  });
  return (
    <div data-testid={testId} className="min-w-0 rounded-[10px] border border-hairline p-3">
      <p className="text-[12px] font-semibold text-muted">{kopf}</p>
      {antwort.answered && antwort.answer ? (
        <AntwortText
          text={antwort.answer}
          quellen={antwort.sources.length}
          tragend={tragendeStellen(antwort)}
          className="mt-2 text-[14px] text-text"
        />
      ) : (
        <p className="mt-2 text-[14px] text-muted-2">{t("zweitmeinung.keineAntwort")}</p>
      )}
      {titel.length > 0 ? (
        <ul data-testid={`${testId}-quellen`} className="mt-2 text-[12px] text-muted-2">
          {titel.map((quelle) => (
            <li key={quelle.id} className="break-words">
              {quelle.name}
            </li>
          ))}
        </ul>
      ) : null}
      <AiGeneratedNotice className="mt-2 block" />
    </div>
  );
}

export function Zweitmeinung({
  frage,
  faden,
  kontext,
  billable,
  titelVon,
}: {
  /** Die Frage, zu der die stehende Antwort gehört. */
  frage: string;
  /** Der Gesprächsfaden, mit dem sie gestellt wurde (R-0348) — leer ohne Faden. */
  faden: readonly string[];
  /** Ben (Nacharbeit 9): der Fragekontext (R-1633), mit dem die stehende Antwort gestellt wurde —
   *  nicht die aktuelle Auswahl. Ohne Kontext gefragt: abwesend. */
  kontext?: Fragekontext | undefined;
  /** Kann der Klick etwas kosten? Er fragt den Antwortweg UND das gewählte Zweitmodell — die Seite
   *  leitet das aus beiden ab (`deriveZweitmeinungBillable`, lib/aiAvailability.ts). */
  billable: boolean | undefined;
  /** Der Titel einer Quelle, soweit die Seite ihn kennt — sonst bleibt sie ungenannt. */
  titelVon: (id: string) => string | undefined;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const anfrage = useMutation({
    mutationFn: () =>
      endpoints.ask.zweitmeinung(frage, toReasonerLocale(i18n.language), faden, kontext),
  });
  const stufe = (wert: ZweitmeinungStufe): string => t(`zweitmeinung.stufe.${wert}`);
  const antwort = anfrage.data;
  const ergebnis = antwort?.zweitmeinung;
  return (
    <section data-testid="ask-zweitmeinung" className="print-hide mt-1 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="ask-zweitmeinung-knopf"
          disabled={anfrage.isPending || frage.trim().length === 0}
          onClick={() => anfrage.mutate()}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {anfrage.isPending ? t("zweitmeinung.laeuft") : t("zweitmeinung.knopf")}
        </button>
        <AiCostHint billable={billable} />
      </div>
      {anfrage.isError ? (
        <p
          data-testid="ask-zweitmeinung-fehler"
          role="alert"
          className="text-[13px] text-trust-crit-text"
        >
          {anfrage.error instanceof ApiError ? anfrage.error.message : t("zweitmeinung.fehler")}
        </p>
      ) : null}
      {antwort && ergebnis === undefined ? (
        // Ein älterer Server kennt das Feld nicht — dann wird nichts gegenübergestellt.
        <p data-testid="ask-zweitmeinung-grund" className="text-[13px] text-muted-2">
          {t("zweitmeinung.fehler")}
        </p>
      ) : null}
      {antwort && ergebnis?.status === "nicht_moeglich" ? (
        <p data-testid="ask-zweitmeinung-grund" className="text-[13px] text-muted-2">
          {t(`zweitmeinung.grund.${ergebnis.grund}`)}
        </p>
      ) : null}
      {antwort && ergebnis?.status === "verglichen" ? (
        <Gegenueberstellen
          ergebnis={ergebnis}
          erste={{
            answered: antwort.result.answered,
            answer: antwort.result.answer,
            sources: antwort.result.sources,
            citedSources: antwort.result.citedSources ?? [],
            demo: antwort.result.demo,
          }}
          stufe={stufe}
          titelVon={titelVon}
        />
      ) : null}
    </section>
  );
}

function Gegenueberstellen({
  ergebnis,
  erste,
  stufe,
  titelVon,
}: {
  ergebnis: Gegenueberstellung;
  erste: ZweitmeinungAntwort;
  stufe: (wert: ZweitmeinungStufe) => string;
  titelVon: (id: string) => string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div data-testid="ask-zweitmeinung-ergebnis" className="flex flex-col gap-3">
      <p className="text-[13px] font-semibold text-text">{t("zweitmeinung.titel")}</p>
      {ergebnis.abweichend ? (
        <div
          data-testid="ask-zweitmeinung-warnung"
          role="alert"
          className="rounded-[10px] bg-trust-warn-bg p-3 text-[13px] text-trust-warn-text"
        >
          <p className="font-semibold">{t("zweitmeinung.warnung")}</p>
          <ul className="mt-1 list-disc pl-5">
            {ergebnis.abweichungen.map((art) => (
              <li key={art} data-testid={`ask-zweitmeinung-abweichung-${art}`}>
                {t(`zweitmeinung.abweichung.${art}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p data-testid="ask-zweitmeinung-gleich" className="text-[13px] text-text">
          {t("zweitmeinung.keineAbweichung")}
        </p>
      )}
      <p className="text-[12px] text-muted-2">{t("zweitmeinung.grenze")}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Spalte
          testId="ask-zweitmeinung-a"
          kopf={t("zweitmeinung.ersteAntwort", { stufe: stufe(ergebnis.ersteStufe) })}
          antwort={erste}
          titelVon={titelVon}
        />
        <Spalte
          testId="ask-zweitmeinung-b"
          kopf={t("zweitmeinung.zweiteAntwort", { stufe: stufe(ergebnis.zweiteStufe) })}
          antwort={ergebnis.zweite}
          titelVon={titelVon}
        />
      </div>
      <p className="text-[12px] text-muted-2">
        {t("zweitmeinung.erklaerung")} {t("zweitmeinung.neuGestellt")}
      </p>
    </div>
  );
}
