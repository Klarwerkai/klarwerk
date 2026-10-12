// ==================================================================================================
// ADMIN-16 · DIE DETAILKARTEN „BEISPIEL- UND DEMOPAKETE" UND „TESTDATEN AUS IMPORTEN".
// ==================================================================================================
//
// produkt:20261009:admin-demo-diagnose. Beobachtet am 09.10.2026: Demopakete und das Aufräumen von
// Testdaten standen als Kästen auf der produktiven Importseite (`/import`), zwischen Prüfliste und
// Seitenende. Wer importierte, sah dort Vorführwerkzeuge und eine Aktion, die den GESAMTEN
// Importbestand leert.
//
// JETZT wohnen beide unter „Vorführdaten" in der Verwaltung, je hinter einer eigenen Karte. Die
// Bauteile selbst (`components/ExamplePackages.tsx`, `components/ImportCleanup.tsx`) sind dieselben —
// dieselben Abrufe, dieselbe Vorschau, dieselben Rückfragen, dieselben Serverrechte
// (`users.manage`). Neu ist nur der Ort und die Seitenhilfe, die den Kontext erklärt.
import { useTranslation } from "react-i18next";
import { ExamplePackages } from "../components/ExamplePackages";
import { HelpTip } from "../components/HelpTip";
import { ImportCleanup } from "../components/ImportCleanup";
import { Detailkarte } from "../components/einstellungen/Detailkarte";

export function DemopaketeDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Detailkarte titel={t("betriebdemo.ziel.pakete")} onZurueck={onZurueck} testId="detail-pakete">
      <HelpTip
        title={t("betriebdemo.hilfe.pakete.titel")}
        body={t("betriebdemo.hilfe.pakete.text")}
      />
      <ExamplePackages />
    </Detailkarte>
  );
}

export function TestimporteDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  return (
    <Detailkarte
      titel={t("betriebdemo.ziel.testimporte")}
      onZurueck={onZurueck}
      testId="detail-testimporte"
    >
      <HelpTip
        title={t("betriebdemo.hilfe.testimporte.titel")}
        body={t("betriebdemo.hilfe.testimporte.text")}
      />
      <ImportCleanup />
    </Detailkarte>
  );
}
