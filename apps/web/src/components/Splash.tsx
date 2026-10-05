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
  return <SplashFlaeche text={t("state.loading")} />;
}

// R-0801 (ben, Nacharbeit 3, F1): DIESELBE Fläche, aber ohne `useTranslation`. `main.tsx` zeigt sie,
// BEVOR die Startsprache vorliegt — dort darf nichts auf ein fehlendes Sprachpaket warten (der
// Haken würde bei ausstehendem Paket suspendieren, und ohne Grenze darüber bliebe `#root` leer).
// Den Text reicht der Aufrufer herein; `Splash` oben ist nur noch die übersetzende Hülle darum.
export function SplashFlaeche({ text }: { text: string }): JSX.Element {
  return <div className="grid h-full place-items-center text-sm text-muted">{text}</div>;
}
