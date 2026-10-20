import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { KlaraAuftragsnotiz } from "../../api/klaraAuftrag";
import { type KlaraNotiz, klaraNotizApi } from "../../api/klaraNotiz";
import { ruecklinkZiel } from "./notizen";

/** Readback des Originals über die bestehende Notiztür; keine zusätzliche Notizablage/-bearbeitung. */
export function KlaraAuftragsnotizNachweis({
  quelle,
}: { quelle: KlaraAuftragsnotiz }): JSX.Element {
  const { t } = useTranslation();
  const [notiz, setNotiz] = useState<KlaraNotiz | null>(null);
  const [fehler, setFehler] = useState(false);
  const [laden, setLaden] = useState(false);
  return (
    <details
      data-testid="klara-auftrag-notiznachweis"
      data-id={quelle.id}
      className="mt-1.5 text-[11.5px]"
      onToggle={async (e) => {
        if (!e.currentTarget.open || laden) return;
        setLaden(true);
        setFehler(false);
        setNotiz(null);
        try {
          const r = await klaraNotizApi.hole(quelle.id);
          setNotiz(r.notiz);
        } catch {
          setFehler(true);
        } finally {
          setLaden(false);
        }
      }}
    >
      <summary className="cursor-pointer text-text">
        {t(
          quelle.weg === "geschrieben"
            ? "klaraauftrag.notizquelle.geschrieben"
            : "klaraauftrag.notizquelle.gebunden",
          {
            titel: quelle.titel ?? quelle.id,
            fassung: quelle.fassung,
          },
        )}
      </summary>
      {laden ? <p>{t("klaraauftrag.notizquelle.laedt")}</p> : null}
      {fehler ? <p role="alert">{t("klaraauftrag.notizquelle.nichtLesbar")}</p> : null}
      {notiz ? (
        <div
          data-testid="klara-auftrag-originalnotiz"
          data-id={notiz.id}
          data-fassung={notiz.fassung}
        >
          {notiz.fassung !== quelle.fassung ? (
            <p role="alert">{t("klaraauftrag.notizquelle.geaendert")}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-text">{notiz.inhalt}</p>
          <Link data-testid="klara-auftrag-notizruecklink" to={ruecklinkZiel(notiz.objektbezug)}>
            {t(
              quelle.weg === "geschrieben"
                ? "klaraauftrag.notizquelle.ruecklinkGeschrieben"
                : "klaraauftrag.notizquelle.ruecklink",
            )}
          </Link>
        </div>
      ) : null}
    </details>
  );
}
