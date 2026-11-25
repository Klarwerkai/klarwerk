import { useTranslation } from "react-i18next";

const PAKET_PRAEFIX = "[Beispiel] ";

/** Nur der vom Vorführpaket gesetzte Zusatz wird übersetzt. Der gespeicherte Titel bleibt lesbar. */
export function Belegtitel({
  titel,
  demoSeed,
}: { titel: string; demoSeed?: boolean }): JSX.Element {
  const { t } = useTranslation();
  if (!demoSeed || !titel.startsWith(PAKET_PRAEFIX) || titel.length === PAKET_PRAEFIX.length) {
    return <>{titel}</>;
  }
  return (
    <span title={titel}>
      <span className="inline-block rounded bg-surface-2 px-1.5 py-0.5 align-middle text-xs font-semibold text-muted">
        {t("quellen.fokus.beispiel")}
      </span>{" "}
      {titel.slice(PAKET_PRAEFIX.length)}
    </span>
  );
}
