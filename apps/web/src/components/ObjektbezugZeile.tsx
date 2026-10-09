// ==================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL — DIE ZEILE „FRAGE ZUM BEITRAG …" UND IHR RÜCKWEG.
// ==================================================================================================
//
// Steht auf `/fragen`, wenn die Adresse einen Beitrag nennt (`ko=<id>`, optional `fassung=<n>`,
// `lib/objektbezug.ts`). Sie nennt Titel und Fassung und führt mit DERSELBEN Kennung und Fassung
// zurück in die Lesefläche. Den Titel reicht die Seite aus ihrem schon geladenen Bestand herein;
// fehlt er (lädt, kein Leserecht), steht die Kennung da — nie ein geratener Name.
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { type Objektbezug, leserHref } from "../lib/objektbezug";

export function ObjektbezugZeile({
  bezug,
  titel,
}: {
  bezug: Objektbezug;
  titel: string | null;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <p
      data-testid="objektbezug-zeile"
      data-ko={bezug.koId}
      data-fassung={bezug.fassung ?? undefined}
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted"
    >
      <span>{t("arbeitsweg.fragen.bezug", { titel: titel ?? bezug.koId })}</span>
      {bezug.fassung !== null ? (
        <span data-testid="objektbezug-fassung" className="font-mono text-[11.5px] text-muted-2">
          {t("arbeitsweg.fassung", { fassung: bezug.fassung })}
        </span>
      ) : null}
      <Link
        data-testid="objektbezug-zurueck"
        to={leserHref(bezug)}
        className="font-semibold text-text underline"
      >
        {t("arbeitsweg.fragen.zurueck")}
      </Link>
    </p>
  );
}
