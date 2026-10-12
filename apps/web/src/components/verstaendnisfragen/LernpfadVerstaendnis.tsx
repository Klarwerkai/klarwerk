import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { type EigenerFragensatz, verstaendnisApi } from "./api";

// ================================================================================================
// VERSTÄNDNISFRAGEN IM LERNPFAD — die der eigenen Rolle zugeordneten Fragensätze.
// ================================================================================================
//
// Steht UNTER den Leseschritten des bestehenden Lernpfads (die bleiben, wie sie sind) und sagt je
// Fragensatz nur, was belegt ist: offen, bestanden, nicht bestanden oder zur erneuten Prüfung. Der
// letzte Satz trennt ausdrücklich Lesen, Verständnisfragen und praktische Befähigung.

export type LernpfadLage = "offen" | "bestanden" | "nichtBestanden" | "pruefung";

/** Die Lage eines zugeordneten Fragensatzes — gemessen an der GÜLTIGEN Version. */
export function lernpfadLage(s: EigenerFragensatz): LernpfadLage {
  if (s.quellenlage !== null && s.quellenlage !== "aktuell") {
    return "pruefung";
  }
  const zurGueltigen = s.ergebnisse.filter((e) => e.fragensatzVersion === s.gueltigeVersion);
  if (zurGueltigen.length === 0) {
    return "offen";
  }
  return zurGueltigen.some((e) => e.bestanden) ? "bestanden" : "nichtBestanden";
}

const TON: Record<LernpfadLage, string> = {
  offen: "text-muted",
  bestanden: "text-trust-pos-text",
  nichtBestanden: "text-trust-warn-text",
  pruefung: "text-trust-warn-text",
};

export function LernpfadVerstaendnis(): JSX.Element | null {
  const { t } = useTranslation();
  const meine = useQuery({
    queryKey: ["verstaendnisfragen", "meine"],
    queryFn: verstaendnisApi.meine,
    retry: false,
  });
  if (!meine.data) {
    return null;
  }
  const zugeordnet = meine.data.fragensaetze.filter((s) => s.zugeordnet);
  return (
    <div data-testid="lernpfad-verstaendnis" className="mt-2 space-y-1">
      <div className="font-semibold text-text">{t("verstaendnis.lernpfad.titel")}</div>
      {zugeordnet.length === 0 ? (
        <p>{t("verstaendnis.lernpfad.leer")}</p>
      ) : (
        <ul className="space-y-1">
          {zugeordnet.map((s) => {
            const lage = lernpfadLage(s);
            return (
              <li
                key={s.fragensatzId}
                data-testid="lernpfad-verstaendnis-satz"
                data-lage={lage}
                className="flex flex-wrap items-center gap-x-2"
              >
                <Link
                  to={`/wissen/${encodeURIComponent(s.koId)}`}
                  className="text-text underline-offset-4 hover:underline"
                >
                  {s.titel}
                </Link>
                <span className={TON[lage]}>{t(`verstaendnis.lernpfad.${lage}`)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p data-testid="lernpfad-verstaendnis-drei" className="text-muted-2">
        {t("verstaendnis.lernpfad.drei")}
      </p>
    </div>
  );
}
