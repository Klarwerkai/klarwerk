// ==================================================================================================
// R-1107 (Aufnahme gesamt-dublettenvergleich) — DER AUFGEGANGENE ARTIKEL NENNT DEN VERBLEIBENDEN.
// ==================================================================================================
//
// Ist ein Eintrag über den Zusammenführen-Assistenten in einem Führungsartikel aufgegangen
// (`mergedInto`), steht über seiner Lesefläche, wann und worin — mit Verweis. Der Eintrag selbst
// bleibt darunter vollständig lesbar (Text, Quellen, Anhänge, Kommentare, Historie); ausgeblendet
// wird nichts. Ohne `mergedInto`, beim Laden und bei einem Abruffehler zeichnet die Zeile nichts —
// sie behauptet nur, was am Objekt steht. Der Titel des Führungsartikels kommt aus dessen eigenem
// Abruf (derselbe Lesepfad mit derselben Sichtregel); bekommt der Leser ihn nicht, steht der Satz
// ohne Titel und ohne Verweis da — keine Kennung, kein geratener Name.
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useKo } from "../api/hooks";

export function AufgegangenHinweis({ koId }: { koId: string }): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const ko = useKo(koId);
  const ziel = ko.data?.mergedInto;
  const fuehrend = useKo(ziel?.koId ?? "");
  if (!ziel) {
    return null;
  }
  const datum = new Date(ziel.at);
  const datumText = Number.isNaN(datum.getTime())
    ? ziel.at
    : datum.toLocaleDateString(i18n.language);
  const titel = fuehrend.data?.title;
  return (
    <div
      data-testid="aufgegangen-hinweis"
      role="note"
      className="mb-3 rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text"
    >
      {titel
        ? t("dublettenvergleich.aufgegangen.hinweis", { datum: datumText, titel })
        : t("dublettenvergleich.aufgegangen.ohneTitel", { datum: datumText })}
      {titel ? (
        <Link
          to={`/wissen/${ziel.koId}`}
          data-testid="aufgegangen-link"
          className="ml-2 font-semibold underline"
        >
          {t("dublettenvergleich.aufgegangen.link")}
        </Link>
      ) : null}
    </div>
  );
}
