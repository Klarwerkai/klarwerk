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
//
// produkt:20261009:referenzki-antwortstatus (REF-04, K1): jede der beiden Antworten trägt ihre
// EIGENE Referenzprüfung (`referenzpruefungZweitmeinung`) samt Quellenkennzeichnung — eine
// Gegenüberstellung ist keine Quellenbestätigung.
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import type {
  AussagenBelegKurz,
  Fragekontext,
  ReferenzPruefung,
  ZweitmeinungAntwort,
  ZweitmeinungErgebnis,
  ZweitmeinungStufe,
} from "../../api/types";
import { kiHerkunftAus } from "../../lib/kiHerkunft";
import { toReasonerLocale } from "../../lib/reasonerLocale";
import { AiCostHint } from "../AiCostHint";
import { AiGeneratedNotice } from "../AiGeneratedNotice";
import { AntwortText } from "../start/AntwortText";
import {
  QuellenStatusMarke,
  Referenzpruefung,
  auszuegeAus,
  referenzGesamt,
} from "./Referenzpruefung";

/** REF-04: der Rückweg zur Quelle in ihrer Fassung, wenn die Seite keinen eigenen nennt. */
const WISSEN_HREF = (koId: string, fassung: number): string =>
  `/wissen/${encodeURIComponent(koId)}?fassung=${fassung}`;

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
  referenz,
  aussagen,
  wissenHref,
}: {
  testId: string;
  kopf: string;
  antwort: ZweitmeinungAntwort;
  titelVon: (id: string) => string | undefined;
  /** REF-04: die Referenzprüfung GENAU dieser Antwort; abwesend bei einem älteren Server. */
  referenz?: ReferenzPruefung | null | undefined;
  aussagen?: AussagenBelegKurz | null | undefined;
  wissenHref: (koId: string, fassung: number) => string;
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
      {/* Ben (Nacharbeit 17): dieselbe Regel wie die Antwortkarte (`kiHerkunftAus`, R-0604) —
        die Kennzeichnung nur bei belegter Modellherkunft, nie für den deterministischen Rückfall. */}
      {kiHerkunftAus(antwort) === "ki" ? <AiGeneratedNotice className="mt-2 block" /> : null}
      {/* REF-04 (K1/K3): die Quellenkennzeichnung und Prüfung DIESER Antwort. Ohne Prüfergebnis
        steht sie als offener Entwurf, nie als bestätigt. */}
      {antwort.answered && antwort.answer ? (
        <div className="mt-2 space-y-2">
          <QuellenStatusMarke
            gesamt={referenzGesamt(referenz)}
            testId={`${testId}-quellenstatus`}
          />
          {referenz ? (
            <Referenzpruefung
              ergebnis={referenz}
              aussageTexte={
                new Map(
                  (aussagen?.aussagen ?? []).map((a): [string, string] => [a.aussageId, a.text]),
                )
              }
              // REF-04 (K5, Ben nacharbeit-3): die gebundene Passage GENAU dieser Antwort.
              auszugVon={(id) => auszuegeAus(aussagen).get(id)}
              titelVon={titelVon}
              wissenHref={wissenHref}
              testId={`${testId}-referenz`}
              ueberschrift={t("referenzpruefung.zweitmeinung.titel")}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Zweitmeinung({
  frage,
  faden,
  kontext,
  kontextUnbekannt = false,
  onNeuFragen,
  billable,
  titelVon,
  wissenHref = WISSEN_HREF,
}: {
  /** Die Frage, zu der die stehende Antwort gehört. */
  frage: string;
  /** Der Gesprächsfaden, mit dem sie gestellt wurde (R-0348) — leer ohne Faden. */
  faden: readonly string[];
  /** Ben (Nacharbeit 9): der Fragekontext (R-1633), mit dem die stehende Antwort gestellt wurde —
   *  nicht die aktuelle Auswahl. Ohne Kontext gefragt: abwesend. */
  kontext?: Fragekontext | undefined;
  /** Ben (Nacharbeit 10): die stehende Antwort ist ein wiederaufgenommener Altstand, dessen
   *  Fragekontext niemand kennt. Dann wird KEINE kontextgleiche Zweitmeinung angeboten — die
   *  Fläche sagt warum und bietet an, die Frage mit dem gewählten Kontext neu zu stellen. */
  kontextUnbekannt?: boolean;
  /** Die Frage erneut stellen (mit dem aktuell gewählten Kontext der Seite). */
  onNeuFragen?: (() => void) | undefined;
  /** Kann der Klick etwas kosten? Er fragt den Antwortweg UND das gewählte Zweitmodell — die Seite
   *  leitet das aus beiden ab (`deriveZweitmeinungBillable`, lib/aiAvailability.ts). */
  billable: boolean | undefined;
  /** Der Titel einer Quelle, soweit die Seite ihn kennt — sonst bleibt sie ungenannt. */
  titelVon: (id: string) => string | undefined;
  /** REF-04: Rückweg zur Quelle in der geprüften Fassung. */
  wissenHref?: (koId: string, fassung: number) => string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const anfrage = useMutation({
    mutationFn: () =>
      endpoints.ask.zweitmeinung(frage, toReasonerLocale(i18n.language), faden, kontext),
  });
  const stufe = (wert: ZweitmeinungStufe): string => t(`zweitmeinung.stufe.${wert}`);
  const antwort = anfrage.data;
  const ergebnis = antwort?.zweitmeinung;
  if (kontextUnbekannt) {
    return (
      <section data-testid="ask-zweitmeinung" className="print-hide mt-1 flex flex-col gap-2">
        <p data-testid="ask-zweitmeinung-kontext-unbekannt" className="text-[13px] text-muted-2">
          {t("zweitmeinung.kontextUnbekannt")}
        </p>
        {onNeuFragen ? (
          <div>
            <button
              type="button"
              data-testid="ask-zweitmeinung-neu-fragen"
              onClick={onNeuFragen}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft"
            >
              {t("zweitmeinung.neuFragen")}
            </button>
          </div>
        ) : null}
      </section>
    );
  }
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
          // Ben (Nacharbeit 17): ein Zuschnitt (R-0346) hat die ausgelieferte Antwort nach dem
          // Vergleich ergänzt — das steht außerhalb der Gegenüberstellung, nicht in Spalte A.
          ergaenzt={antwort.result.answer !== ergebnis.erste.answer}
          stufe={stufe}
          titelVon={titelVon}
          referenz={antwort.referenzpruefungZweitmeinung}
          aussagen={antwort.zweitmeinungAussagen}
          wissenHref={wissenHref}
        />
      ) : null}
    </section>
  );
}

function Gegenueberstellen({
  ergebnis,
  ergaenzt,
  stufe,
  titelVon,
  referenz,
  aussagen,
  wissenHref,
}: {
  ergebnis: Gegenueberstellung;
  ergaenzt: boolean;
  stufe: (wert: ZweitmeinungStufe) => string;
  titelVon: (id: string) => string | undefined;
  referenz: { erste: ReferenzPruefung | null; zweite: ReferenzPruefung | null } | undefined;
  aussagen: { erste: AussagenBelegKurz | null; zweite: AussagenBelegKurz | null } | undefined;
  wissenHref: (koId: string, fassung: number) => string;
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
          antwort={ergebnis.erste}
          titelVon={titelVon}
          referenz={referenz?.erste}
          aussagen={aussagen?.erste}
          wissenHref={wissenHref}
        />
        <Spalte
          testId="ask-zweitmeinung-b"
          kopf={t("zweitmeinung.zweiteAntwort", { stufe: stufe(ergebnis.zweiteStufe) })}
          antwort={ergebnis.zweite}
          titelVon={titelVon}
          referenz={referenz?.zweite}
          aussagen={aussagen?.zweite}
          wissenHref={wissenHref}
        />
      </div>
      {ergaenzt ? (
        <p data-testid="ask-zweitmeinung-ergaenzt" className="text-[12px] text-muted-2">
          {t("zweitmeinung.ergaenztAusserhalb")}
        </p>
      ) : null}
      <p className="text-[12px] text-muted-2">
        {t("zweitmeinung.erklaerung")} {t("zweitmeinung.neuGestellt")}
      </p>
    </div>
  );
}
