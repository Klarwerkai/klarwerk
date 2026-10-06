import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Navigate, useParams } from "react-router-dom";
import { useReasonerStatus } from "../api/hooks";
import { useRole } from "../app/RoleContext";
import { HOME_ROUTE, routePathAllows } from "../app/navigation";
import { RoleLink } from "../components/RoleLink";
import { EINSTIEGE, einstiegFuer } from "../lib/einstiege";
import { antwortLage, faehigkeitTextKey } from "../lib/faehigkeiten";

// ================================================================================================
// R-0928 / R-1675 · EINE KURZE THEMATISCHE EINSTIEGSANSICHT — vier Adressen, ein Bauteil.
// ================================================================================================
// `/einstieg/erfassen`, `/einstieg/pruefen`, `/einstieg/fragen`, `/einstieg/bibliothek`. Jede Ansicht
// sagt drei Dinge und übergibt dann: wofür der Bereich da ist, womit man anfängt, und der Weg in die
// volle Funktion. Begründung und Quelle in `lib/einstiege.ts`.
//
// EHRLICH WIE DIE ÜBERSICHT: der Zweck von „Fragen" folgt der Antwortlage aus dem öffentlichen
// Status (`antwortLage`, dieselbe Ableitung wie im Blatt „Über KLARWERK"), und die Übergabe läuft
// über `RoleLink` — erreicht die Rolle die Vollfunktion nicht, bleibt sie Auskunft, und ein Satz
// sagt warum. Die Ansicht selbst ist für jede Rolle offen: sie erklärt, sie öffnet nichts.
//
// KEINE EINGABE UND KEIN SCHREIBWEG: die Ansicht trägt nur Text und Wege. Was der Bereich kann,
// zeigt die Vollfunktion selbst; hier wird nichts nachgebaut.
export function Einstieg(): JSX.Element {
  const { t } = useTranslation();
  const { role } = useRole();
  const { thema } = useParams();
  const lage = antwortLage(useReasonerStatus().data);
  const einstieg = einstiegFuer(thema);
  if (!einstieg) {
    // Ein unbekanntes Thema ist keine leere Seite, sondern derselbe Weg wie jede unbekannte Adresse.
    return <Navigate to={HOME_ROUTE} replace />;
  }
  const { faehigkeit } = einstieg;
  const name = t(faehigkeit.nameKey);
  const erreichbar = routePathAllows(faehigkeit.to, role);

  return (
    <section
      data-testid="einstieg"
      data-thema={einstieg.thema}
      data-antwort-lage={lage}
      aria-labelledby="einstieg-titel"
      className="mx-auto flex max-w-2xl flex-col gap-5 py-10"
    >
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
        {t("erstnutzer.einstieg.kicker")}
      </p>
      <h1 id="einstieg-titel" className="text-[26px] font-[650] text-text">
        {name}
      </h1>
      <div data-testid="einstieg-zweck">
        <h2 className="text-[13px] font-semibold text-ink">{t("erstnutzer.einstieg.wozu")}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-text">
          {t(faehigkeitTextKey(faehigkeit, lage))}
        </p>
      </div>
      <div data-testid="einstieg-erster-schritt">
        <h2 className="text-[13px] font-semibold text-ink">{t("erstnutzer.einstieg.anfangen")}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-text">{t(einstieg.ersterSchrittKey)}</p>
      </div>
      {erreichbar ? null : (
        <p data-testid="einstieg-rolle" className="text-[13px] leading-relaxed text-muted">
          {t("erstnutzer.einstieg.ohneRolle", { name })}
        </p>
      )}
      <div>
        <RoleLink
          to={faehigkeit.to}
          testId="einstieg-weiter"
          className="inline-flex items-center gap-2 rounded-[10px] bg-ink px-5 py-2.5 text-[14px] font-semibold text-white"
          hoverClassName="hover:opacity-90"
        >
          {(geht) => (
            <>
              {t("erstnutzer.einstieg.weiter", { name })}
              {geht ? <ArrowRight size={15} aria-hidden="true" /> : null}
            </>
          )}
        </RoleLink>
      </div>
      <nav
        aria-label={t("erstnutzer.einstieg.weitere")}
        data-testid="einstieg-weitere"
        className="border-t border-hairline pt-4"
      >
        <h2 className="text-[12px] font-semibold text-muted">{t("erstnutzer.einstieg.weitere")}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {EINSTIEGE.filter((e) => e.thema !== einstieg.thema).map((anderer) => (
            <li key={anderer.thema}>
              <RoleLink
                to={anderer.pfad}
                testId={`einstieg-zu-${anderer.thema}`}
                className="font-semibold text-brand-text"
                hoverClassName="hover:underline"
              >
                {() => t(anderer.faehigkeit.nameKey)}
              </RoleLink>
            </li>
          ))}
          <li>
            <RoleLink
              to={HOME_ROUTE}
              testId="einstieg-zur-startseite"
              className="text-muted"
              hoverClassName="hover:underline"
            >
              {() => t("erstnutzer.einstieg.zurStartseite")}
            </RoleLink>
          </li>
        </ul>
      </nav>
    </section>
  );
}
