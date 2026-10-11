// produkt:20261007:templates-default — DIE NACHVOLLZIEHBARE AUSGANGSSTRUKTUR EINES BEITRAGS.
//
// Mit welcher Vorlage und welcher Fassung der Beitrag entstanden ist — und, wenn die Vorlage
// inzwischen weiterentwickelt oder ausgemustert wurde, dass sein Inhalt davon unberührt bleibt.
// Die Felder der verwendeten Fassung stehen nur da, wenn diese Person die Vorlage sehen darf (der
// Server entscheidet, `GET /api/vorlagen/nutzung/:koId`). Ohne Vorlagenbezug zeigt sie nichts.
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { vorlagenApi } from "../api/vorlagen";
import { feldText, vorlagenSprache } from "../lib/vorlagenStruktur";

export function VorlagenHerkunft({ koId }: { koId: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const sprache = vorlagenSprache(i18n.language);
  const auskunft = useQuery({
    queryKey: ["vorlagen", "nutzung", koId],
    queryFn: () => vorlagenApi.nutzung(koId),
    retry: false,
  });
  const n = auskunft.data?.nutzung;
  if (!n) {
    return null;
  }
  const neuer = n.aktuelleVersion !== null && n.aktuelleVersion > n.version;
  return (
    <div data-testid="vorlagen-herkunft" className="mt-3 text-[12px] text-muted">
      <p>
        {t("vorlagen.herkunft.mit", { name: n.name, version: n.version })}
        {neuer ? ` ${t("vorlagen.herkunft.neuer", { version: n.aktuelleVersion })}` : ""}
        {n.ausgemustert ? ` ${t("vorlagen.herkunft.ausgemustert")}` : ""}
      </p>
      {n.felder ? (
        <details>
          <summary className="cursor-pointer text-muted-2">
            {t("vorlagen.herkunft.struktur")}
          </summary>
          <ul className="list-disc pl-5" data-testid="vorlagen-herkunft-felder">
            {n.felder.map((f) => (
              <li key={f.id}>
                {feldText(f, sprache).titel}
                {f.pflicht ? ` (${t("vorlagen.pflicht.marke")})` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
