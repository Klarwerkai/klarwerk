import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useKo, useLibrarySearch } from "../../api/hooks";
import { GuardedLink } from "../../app/NavGuardContext";
import { anzeigestatusAus } from "../../lib/displayStatus";
import type { TutorialDemoProps, TutorialUebergangProps } from "../typen";

/** Reine Leseübung mit einer tatsächlich zugänglichen Quelle. Kein Schreib-/Modellaufruf. */
export function Demo(_props: TutorialDemoProps): JSX.Element {
  const { t } = useTranslation();
  const [suche, setSuche] = useState("");
  const [id, setId] = useState("");
  const [antwort, setAntwort] = useState<"ja" | "nein" | null>(null);
  const [feedback, setFeedback] = useState(false);
  const [fehler, setFehler] = useState(false);
  const liste = useLibrarySearch({ q: suche }, suche.trim().length > 1);
  const quelle = useKo(id);
  const pruefen = async (): Promise<void> => {
    setFeedback(false);
    setFehler(false);
    try {
      await quelle.refetch({ throwOnError: true });
      setFeedback(true);
    } catch {
      setId("");
      void liste.refetch();
      setFehler(true);
    }
  };
  return (
    <div data-testid="einfuehrung-uebung" className="space-y-3">
      <p className="font-semibold">{t("klaraeinfuehrung.nurUebung")}</p>
      <label className="block">
        {t("klaraeinfuehrung.suche")}
        <input
          className="w-full rounded border border-hairline p-2"
          value={suche}
          onChange={(ev) => {
            setSuche(ev.target.value);
            setId("");
            setFeedback(false);
          }}
        />
      </label>
      {liste.isError ? <p role="alert">{t("klaraeinfuehrung.quelleFehlt")}</p> : null}
      {suche.length > 1 && liste.isSuccess && liste.data.length === 0 ? (
        <p>{t("klaraeinfuehrung.keineQuelle")}</p>
      ) : null}
      {liste.isSuccess && suche.length > 1 ? (
        <ul>
          {liste.data.slice(0, 5).map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => {
                  setId(e.id);
                  setFeedback(false);
                  setAntwort(null);
                }}
                className="text-brand-text underline"
              >
                {e.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {quelle.isSuccess ? (
        <div className="space-y-2">
          <GuardedLink
            to={`/wissen/${encodeURIComponent(quelle.data.id)}`}
            className="text-brand-text underline"
          >
            {quelle.data.title}
          </GuardedLink>
          <p>
            {t("klaraeinfuehrung.quellenstand", {
              fassung: quelle.data.version,
              status: t(`status.${anzeigestatusAus(quelle.data, { konflikt: false }).status}`),
            })}
          </p>
          <fieldset>
            <legend>{t("klaraeinfuehrung.frage")}</legend>
            {(["ja", "nein"] as const).map((w) => (
              <label key={w} className="mr-4 inline-flex gap-2">
                <input
                  name="einfuehrung-antwort"
                  type="radio"
                  checked={antwort === w}
                  onChange={() => {
                    setAntwort(w);
                    setFeedback(false);
                  }}
                />
                {t(`klaraeinfuehrung.${w}`)}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            disabled={!antwort || quelle.isFetching}
            onClick={() => void pruefen()}
            className="rounded border border-hairline p-2"
          >
            {t("klaraeinfuehrung.pruefen")}
          </button>
          {feedback ? (
            <output className="block" data-testid="einfuehrung-rueckmeldung">
              {t(antwort === "nein" ? "klaraeinfuehrung.richtig" : "klaraeinfuehrung.nochmal", {
                titel: quelle.data.title,
                fassung: quelle.data.version,
                status: t(`status.${anzeigestatusAus(quelle.data, { konflikt: false }).status}`),
              })}
            </output>
          ) : null}
        </div>
      ) : null}
      {fehler || quelle.isError ? <p role="alert">{t("klaraeinfuehrung.quelleFehlt")}</p> : null}
    </div>
  );
}
export function Uebergang({ zurEchtenSeite }: TutorialUebergangProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={zurEchtenSeite} className="rounded border border-hairline p-2">
      {t("klaraeinfuehrung.zurArbeit")}
    </button>
  );
}
