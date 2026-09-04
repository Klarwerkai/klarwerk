import { useTranslation } from "react-i18next";

// JOB 3030: die Ladefläche stand als lokale Funktion in `App.tsx` und wurde dort an zwei Stellen
// benutzt. Seit die Seiten nachgeladen werden, braucht `routes.tsx` dieselbe Fläche als
// Suspense-Rückfall — und zwei gleich aussehende Definitionen wären zwei Wahrheiten. Deshalb steht
// sie hier, EINMAL; die Definition in `App.tsx` ist ersatzlos entfallen, nicht kopiert.
//
// Sie behauptet nichts: „Lädt …" (`state.loading`, dreisprachig) sagt, dass etwas unterwegs ist,
// nicht dass etwas fehlt. Ein `fallback={null}` wäre die stumme Aussage und ist ausgeschlossen.
export function Splash(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid h-full place-items-center text-sm text-muted">{t("state.loading")}</div>
  );
}
