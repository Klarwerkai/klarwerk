// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC01 — DER LERNAUFTRAG IM KLARA-GESPRÄCH.
// ================================================================================================
//
// Ein natürlicher Lernauftrag im Eingabefeld („Verfolge, wie ich diesen Bericht erstelle.“) geht
// an den VORHANDENEN P06-Lernstart (`POST /api/me/vormachen` mit `auftrag`). Der Server bestimmt
// Anwendung und Vorgänge (`assistenz-lernen-lernauftrag.ts`) oder fragt gezielt nach. Diese Karte
// zeigt, was gilt: den begrenzten Lernbereich — den Lernzustand mit sofortiger Pause zeigt die
// vorhandene Lernanzeige der Hülle (`VormachenAnzeige`) — oder die Rückfrage mit ihren Optionen.
import { useTranslation } from "react-i18next";
import type { LernauftragKlaerung, VormachenHost } from "../../api/vormachen";

export type LernauftragLage =
  | { stand: "gestartet"; host: VormachenHost; vorgaenge: string[] }
  | { stand: "klaerung"; text: string; klaerung: LernauftragKlaerung }
  | { stand: "fehler"; grund: string };

export function KlaraLernauftrag({
  lage,
  waehle,
  schliesse,
}: {
  lage: LernauftragLage;
  waehle: (text: string, host: VormachenHost, vorgaenge: string[]) => void;
  schliesse: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <section
      data-testid="klara-lernauftrag"
      data-stand={lage.stand}
      className="my-2 space-y-1.5 rounded-card border border-hairline bg-surface p-2.5 text-[12.5px]"
    >
      <p className="font-medium">{t("vormachen.lernauftrag.titel")}</p>
      {lage.stand === "gestartet" ? (
        <output className="block" data-testid="klara-lernauftrag-bereich">
          {t("vormachen.lernauftrag.gestartet", {
            anwendung: t(`vormachen.host.${lage.host}`),
            vorgaenge: lage.vorgaenge.map((v) => t(`vormachen.vorgang.${v}`)).join(", "),
          })}
        </output>
      ) : null}
      {lage.stand === "klaerung" ? (
        <div className="space-y-1.5">
          <output className="block" data-testid="klara-lernauftrag-frage">
            {lage.klaerung.frage}
          </output>
          <div className="flex flex-wrap gap-1.5">
            {lage.klaerung.optionen.map((o) => (
              <button
                key={o.beschriftung}
                type="button"
                data-testid="klara-lernauftrag-option"
                className="rounded-input border border-hairline px-2 py-1 hover:border-ink/30"
                onClick={() => waehle(lage.text, o.host, o.vorgaenge)}
              >
                {o.beschriftung}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {lage.stand === "fehler" ? (
        <p data-testid="klara-lernauftrag-fehler" role="alert" className="text-trust-crit-text">
          {t("vormachen.fehler", { grund: lage.grund })}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="klara-lernauftrag-schliessen"
        className="text-muted underline"
        onClick={schliesse}
      >
        {t("vormachen.lernauftrag.schliessen")}
      </button>
    </section>
  );
}
