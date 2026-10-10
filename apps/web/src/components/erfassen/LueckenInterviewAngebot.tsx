import { useTranslation } from "react-i18next";

// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW (R-0091) — DAS LÜCKEN-INTERVIEW WIRD ANGEBOTEN.
// ================================================================================================
//
// „Sagt die Prüfung ‚dazu gibt es nichts', bietet Klara an, das Wissen gleich abzuholen: drei
// Fragen, ein Entwurf, fertig zur Prüfung. Der Wissende sitzt in diesem Moment ohnehin davor."
//
// Das Blatt zeigt dieses Angebot nur, wenn die Vorschau OHNE Treffer zurückkam. Der Satz behauptet
// nicht, dass es im ganzen Bestand nichts gibt (die Vorschau sieht nur ihren Umfang, s.
// `LiveReactionZone`) — er bietet nur den Weg an. Der Klick öffnet das Interview mit dem Thema;
// gesendet wird erst mit „Interview starten" im Arbeitsraum.
export function LueckenInterviewAngebot({ onStart }: { onStart: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      data-testid="luecken-interview-angebot"
      className="flex flex-wrap items-center gap-2 text-[12px] text-muted"
    >
      <span>{t("interview.angebot.text")}</span>
      <button type="button" onClick={onStart} className="font-semibold text-ai hover:underline">
        {t("interview.angebot.knopf")}
      </button>
    </div>
  );
}
