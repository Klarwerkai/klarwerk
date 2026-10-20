// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER ERGEBNISBELEG IM KLARA-VERLAUF.
// ================================================================================================
//
// Was Klara im Browser auf einer freigegebenen Seite getan hat, steht im EIGENEN Klara-Gespräch
// (`KlaraGespraech.browserAuftraege`). Diese Fläche zeigt es dort lesend: Wortlaut und Quelle, die
// Seite, den Stand in Worten des Kerns, jeden Schritt mit seiner Aktionskennung, die Ergebnis-ID,
// eine angewandte Bestätigung und eine Rücknahme. Steuern (Pause, Fortsetzen, Bestätigen,
// Rücknahme) geschieht in der Leiste der Erweiterung, die die Seite erreicht — hier nicht.
// Ohne Browseraufträge in diesem Gespräch zeigt sie nichts.
import { useCallback, useEffect, useState } from "react";
import { type BrowserAuftragSicht, klaraBrowserAuftragApi } from "../../api/klaraBrowserAuftrag";
import { useAssistenzT } from "../../lib/assistenzProfil";

const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function KlaraBrowserAuftraege({
  gespraechId,
}: { gespraechId: string }): JSX.Element | null {
  const { t } = useAssistenzT();
  const [auftraege, setAuftraege] = useState<BrowserAuftragSicht[] | null>(null);
  const [fehler, setFehler] = useState(false);

  const lade = useCallback(async () => {
    try {
      const l = await klaraBrowserAuftragApi.liste();
      setAuftraege(l.auftraege.filter((a) => a.gespraechId === gespraechId));
      setFehler(false);
    } catch {
      setFehler(true);
    }
  }, [gespraechId]);

  useEffect(() => {
    void lade();
  }, [lade]);

  if (fehler) {
    return (
      <p data-testid="klara-browserauftraege-fehler" className="text-[11.5px] text-muted-2">
        {t("browserauftraege.fehler")}
      </p>
    );
  }
  if (!auftraege || auftraege.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="klara-browserauftraege"
      aria-label={t("browserauftraege.titel")}
      className="space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p className={KLEINTITEL}>{t("browserauftraege.titel")}</p>
        <button type="button" className={KNOPF} onClick={() => void lade()}>
          {t("browserauftraege.neuLaden")}
        </button>
      </div>
      <ol className="space-y-2">
        {auftraege.map((a) => (
          <li
            key={a.id}
            data-testid="klara-browserauftrag"
            data-stand={a.stand}
            className="rounded-btn border border-hairline bg-surface p-2 text-[12px]"
          >
            <p className="font-semibold">
              {t(`browserauftraege.quelle.${a.quelle}`)} · {a.ort}
              {a.formular ? ` · ${a.formular}` : ""}
            </p>
            <p data-testid="klara-browserauftrag-wortlaut" className="text-muted-2">
              {a.wortlaut}
            </p>
            {/* Ein Beleg im Verlauf, keine Live-Meldung: die läuft in der Leiste der Erweiterung. */}
            <p data-testid="klara-browserauftrag-stand">{a.text}</p>
            {a.uebergabe ? (
              <p data-testid="klara-browserauftrag-uebergabe">{a.uebergabe.schritt}</p>
            ) : null}
            {a.schritte.length > 0 ? (
              <ol className="mt-1 list-decimal pl-4">
                {a.schritte.map((s) => (
                  <li key={s.aktionskennung} data-kennung={s.aktionskennung} data-stand={s.stand}>
                    {t(`browserauftraege.art.${s.art}`)}
                    {s.feld || s.knopf ? ` „${s.feld ?? s.knopf}"` : ""} —{" "}
                    {t(`browserauftraege.stand.${s.stand}`)}
                  </li>
                ))}
              </ol>
            ) : null}
            {a.ergebnis ? (
              <p data-testid="klara-browserauftrag-ergebnis">
                {t(
                  a.ergebnis.zurueckgenommen
                    ? "browserauftraege.ergebnisZurueck"
                    : "browserauftraege.ergebnis",
                  { id: a.ergebnis.entwurfId },
                )}
              </p>
            ) : null}
            {a.bestaetigung ? (
              <p data-testid="klara-browserauftrag-bestaetigung">
                {t("browserauftraege.bestaetigt", {
                  knopf: a.bestaetigung.knopf,
                  am: a.bestaetigung.bestaetigtAm,
                })}
              </p>
            ) : null}
            {a.ruecknahme ? (
              <p data-testid="klara-browserauftrag-ruecknahme">{a.ruecknahme.text}</p>
            ) : null}
            <p className="text-[10.5px] text-muted-2">
              {t("browserauftraege.host", {
                browser: a.host.browser,
                version: a.host.version,
                adapter: a.host.adapter,
              })}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
