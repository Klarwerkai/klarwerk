import { useTranslation } from "react-i18next";
import type { KoSource } from "../../api/types";

// aufnahme:20260922:gesamt-externe-quellen-kennzeichnung (R-0205 / F-0205): DIE EINE Kennzeichnung
// einer nicht peer-validierten Quelle — das Etikett „Stufe 2" und der Herkunfts-Hinweis
// „Extern · ungeprüft". Bis hierher trug nur `KoView` den Hinweis; Bibliothek, Prüfkarte,
// Belegschicht und die Erfassungs-Warteliste zeigten allein den Prüfstand aus `sourceBadgeKey`.
// Ein Baustein statt fünf Nachbauten, damit „überall" an EINER Bedingung hängt.
//
// DIE BEDINGUNG IST FAIL-CLOSED wie in F-0205 (K3): nur `peerValidated === true` bleibt ohne
// Kennzeichnung. Ein fehlendes Feld ist keine Unbedenklichkeitsbescheinigung.
//
// KEINE ABWERTUNG: die Quelle bleibt, wo sie steht — der Baustein liefert nur zwei Etiketten als
// lesbaren TEXT (ein Hinweis allein über `title` oder Farbe gälte als nicht geliefert). Die
// Erklärung am Etikett ist Zusatz, nicht Träger der Aussage.
export function ExterneQuelleKennung({
  source,
}: {
  source: Pick<KoSource, "peerValidated">;
}): JSX.Element | null {
  const { t } = useTranslation();
  if (source.peerValidated === true) {
    return null;
  }
  return (
    <>
      <span
        data-testid="quelle-stufe2"
        title={t("externequelle.erklaerung")}
        className="rounded-pill bg-page px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-muted"
      >
        {t("externequelle.stufe")}
      </span>
      <span
        data-testid="quelle-extern-ungeprueft"
        className="rounded-pill bg-trust-warn-bg px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase text-trust-warn-text"
      >
        {t("ko.sourceExternUnchecked")}
      </span>
    </>
  );
}
