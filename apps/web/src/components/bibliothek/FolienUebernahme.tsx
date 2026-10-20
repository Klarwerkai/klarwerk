import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import {
  type FolienDatenLage,
  type Korrekturauftrag,
  datenFehler,
} from "../../api/praesentationDaten";
import {
  type UebernahmeVorschau,
  praesentationUebernahme,
} from "../../api/praesentationUebernahme";

export function FolienUebernahme({
  lage,
  id,
  korrektur,
  gespeichert,
}: {
  lage: FolienDatenLage;
  id: string;
  korrektur: Korrekturauftrag;
  gespeichert: (text: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [v, setV] = useState<UebernahmeVorschau | null>(null);
  const [bestaetigt, setBestaetigt] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState("");
  const lauf = useRef(0);
  useEffect(
    () => () => {
      lauf.current++;
    },
    [],
  );
  async function ausfuehren(speichern: boolean) {
    const nr = ++lauf.current;
    setFehler("");
    setLaedt(true);
    try {
      if (speichern && v) {
        const r = await praesentationUebernahme.speichern(lage, id, korrektur, v, bestaetigt);
        if (nr !== lauf.current) return;
        gespeichert(
          t(
            r.zustand === "uebernommen" ? "folienuebernahme.erfolg" : "folienuebernahme.teilweise",
            { fassung: r.fassung },
          ),
        );
        setV(null);
      } else {
        setV(null);
        setBestaetigt([]);
        const neu = await praesentationUebernahme.vorschau(lage, id, korrektur);
        if (nr === lauf.current) setV(neu);
      }
    } catch (f) {
      if (nr !== lauf.current) return;
      const e = datenFehler(f);
      setFehler(e.text ?? t(e.schluessel));
      if (
        f instanceof ApiError &&
        ["PP07_TEILWIRKUNG", "PP07_NACHKONTROLLE_OFFEN"].includes(f.code)
      )
        gespeichert(t("folienuebernahme.teilweise", { fassung: f.details.fassung ?? "?" }));
    } finally {
      if (nr === lauf.current) setLaedt(false);
    }
  }
  return (
    <section
      className="mt-2 min-w-0 break-words rounded-card border border-hairline p-2"
      aria-label={t("folienuebernahme.titel")}
    >
      <p>{t("folienuebernahme.hinweis")}</p>
      <button
        type="button"
        disabled={laedt}
        onClick={() => void ausfuehren(false)}
        className="mt-1 rounded-btn border border-hairline px-2 py-1 font-semibold"
      >
        {t(laedt ? "folienuebernahme.laedt" : "folienuebernahme.vorbereiten")}
      </button>
      {fehler ? (
        <p role="alert" className="mt-2 text-trust-crit-text">
          {fehler}
        </p>
      ) : null}
      {v ? (
        <div className="mt-2 space-y-2">
          <output aria-live="polite" className="block">
            {t("folienuebernahme.wirkungen", { anzahl: v.dateiwirkungen.length })}
          </output>
          <details>
            <summary>{t("folienuebernahme.stellen")}</summary>
            <ul>
              {v.dateiwirkungen.map((w, i) => {
                const folie = lage.folien.find((f) => f.sldId === w.sldId);
                return (
                  <li key={`${w.sldId}:${w.shapeId}:${i}`}>
                    {folie
                      ? t("folienaenderungen.folie", { nummer: folie.position })
                      : t("folienuebernahme.neueBelegfolie")}
                    : {w.vorher} → {w.nachher}
                  </li>
                );
              })}
            </ul>
          </details>
          {v.konflikte.length ? (
            <ul className="text-trust-crit-text">
              {v.konflikte.map((k) => (
                <li key={k.datenpunktId}>{k.grund}</li>
              ))}
            </ul>
          ) : null}
          {v.dateikonflikte.length ? (
            <div>
              <p>{t("folienuebernahme.konflikte")}</p>
              <ul className="space-y-2">
                {v.dateikonflikte.map((k) => (
                  <li key={k.id}>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        disabled={laedt || k.sperrtUebernahme}
                        checked={bestaetigt.includes(k.id)}
                        onChange={(e) =>
                          setBestaetigt((b) =>
                            e.target.checked ? [...b, k.id] : b.filter((id) => id !== k.id),
                          )
                        }
                      />
                      <span>
                        {k.grund} {k.sperrtUebernahme ? "" : t("folienuebernahme.unveraendert")}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p>{t("folienuebernahme.keineFreigabe")}</p>
          <button
            type="button"
            disabled={
              laedt ||
              !v.uebernahme.verfuegbar ||
              v.dateikonflikte.some((k) => !bestaetigt.includes(k.id))
            }
            onClick={() => void ausfuehren(true)}
            className="rounded-btn border border-hairline px-2 py-1 font-semibold"
          >
            {t("folienuebernahme.speichern")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
