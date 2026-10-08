import { useTranslation } from "react-i18next";
import type { ReasonerBetreiberKarte } from "../api/types";
import {
  BETREIBER_KARTE_TEXT,
  type KartenWert,
  betreiberKartenAnzeige,
} from "../lib/betreiberKarte";

// R-0299 (Ben nacharbeit-2): die Karte „Betreiber und Wissensstand des Modells". Reine Anzeige der
// Serverauskunft — Ableitung und Begründung in `lib/betreiberKarte.ts`.
export function BetreiberKarte({ karte }: { karte: ReasonerBetreiberKarte }): JSX.Element {
  const { t } = useTranslation();
  const anzeige = betreiberKartenAnzeige(karte);
  const text = (wert: KartenWert): string =>
    "wortlaut" in wert ? wert.wortlaut : wert.params ? t(wert.key, wert.params) : t(wert.key);
  const zeilen: Array<{ label: string; wert: string; testid: string }> = [];
  if (anzeige.betreiber) {
    const herkunft = anzeige.herkunft
      ? t(anzeige.herkunft.key, {
          land: anzeige.herkunft.landKey ? t(anzeige.herkunft.landKey) : anzeige.herkunft.landCode,
        })
      : null;
    zeilen.push({
      label: t(BETREIBER_KARTE_TEXT.betreiber),
      wert: text(anzeige.betreiber),
      testid: "betreiber-karte-betreiber",
    });
    if (herkunft) {
      zeilen.push({
        label: t(BETREIBER_KARTE_TEXT.herkunft),
        wert: herkunft,
        testid: "betreiber-karte-herkunft",
      });
    }
  }
  if (anzeige.modell) {
    zeilen.push({
      label: t(BETREIBER_KARTE_TEXT.modell),
      wert: text(anzeige.modell),
      testid: "betreiber-karte-modell",
    });
  }
  if (anzeige.modellArbeitet && anzeige.verfuegbarkeit) {
    zeilen.push({
      label: t(BETREIBER_KARTE_TEXT.verfuegbarkeit),
      wert: text(anzeige.verfuegbarkeit),
      testid: "betreiber-karte-verfuegbarkeit",
    });
  }
  if (anzeige.wissensstand) {
    zeilen.push({
      label: t(BETREIBER_KARTE_TEXT.wissensstand),
      wert: text(anzeige.wissensstand),
      testid: "betreiber-karte-wissensstand",
    });
  }
  return (
    <section
      data-testid="betreiber-karte"
      className="space-y-2 rounded-card border border-hairline p-3"
      aria-label={t(BETREIBER_KARTE_TEXT.titel)}
    >
      <h3 className="text-[13px] font-semibold text-text">{t(BETREIBER_KARTE_TEXT.titel)}</h3>
      {anzeige.modellArbeitet ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
          {zeilen.map((zeile) => (
            <div key={zeile.testid} className="contents" data-testid={zeile.testid}>
              <dt className="text-muted-2">{zeile.label}</dt>
              <dd className="text-text">{zeile.wert}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-[12px] text-muted" data-testid="betreiber-karte-kein-modell">
          {anzeige.verfuegbarkeit
            ? text(anzeige.verfuegbarkeit)
            : t(BETREIBER_KARTE_TEXT.keinModell)}
        </p>
      )}
      {anzeige.quellenbedarf ? (
        <p className="text-[11px] text-muted-2" data-testid="betreiber-karte-quellenbedarf">
          {text(anzeige.quellenbedarf)}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-2">{t(BETREIBER_KARTE_TEXT.hinweis)}</p>
    </section>
  );
}
