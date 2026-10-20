import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AenderungsVorschau,
  ladeAenderungsVorschau,
} from "../../api/praesentationAenderungen";
import { type FolienDatenLage, datenFehler } from "../../api/praesentationDaten";
import { DatenKontrolle } from "./DatenKontrolle";

/** PP-07 am vorhandenen Anhang: explizite Vorschau, verwerfbar und ohne Schreibwirkung. */
export function FolienAenderungen({ lage }: { lage: FolienDatenLage }): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const oeffner = useRef<HTMLButtonElement>(null);
  const lauf = useRef(0);
  useEffect(
    () => () => {
      lauf.current += 1;
    },
    [],
  );
  const [offen, setOffen] = useState(false);
  const [wahl, setWahl] = useState(lage.datenpunkte[0]?.id ?? "");
  const dp = lage.datenpunkte.find((d) => d.id === wahl);
  const [wert, setWert] = useState(lage.datenpunkte[0]?.wert ?? "");
  const [grund, setGrund] = useState("");
  const [quelle, setQuelle] = useState(true);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState("");
  const [ergebnis, setErgebnis] = useState<AenderungsVorschau | null>(null);
  const verwerfe = () => {
    lauf.current += 1;
    setErgebnis(null);
    setFehler("");
    setLaedt(false);
  };
  const schliesse = () => {
    verwerfe();
    setOffen(false);
    oeffner.current?.focus();
  };
  const vorschau = async (e: FormEvent) => {
    e.preventDefault();
    if (!dp) {
      return;
    }
    const nr = ++lauf.current;
    setErgebnis(null);
    setFehler("");
    setLaedt(true);
    try {
      const neu = await ladeAenderungsVorschau(lage, dp.id, {
        fassung: dp.fassung,
        grund,
        ...(dp.rechenweg ? { neuBerechnen: true } : { wert }),
        ...(dp.erfassung === "direkt" && quelle ? { quelleAktualisieren: true } : {}),
      });
      if (nr === lauf.current) {
        setErgebnis(neu);
      }
    } catch (f) {
      if (nr === lauf.current) {
        const text = datenFehler(f);
        setFehler(text.text ?? t(text.schluessel));
      }
    } finally {
      if (nr === lauf.current) {
        setLaedt(false);
      }
    }
  };
  return (
    <div className="mt-2 min-w-0 text-[12px] text-text">
      <button
        ref={oeffner}
        type="button"
        aria-expanded={offen}
        aria-controls={id}
        onClick={() => (offen ? schliesse() : setOffen(true))}
        className="rounded-btn border border-hairline px-2 py-1 font-semibold"
      >
        {t("folienaenderungen.oeffnen")}
      </button>
      {offen ? (
        // Escape verwirft nur diese Vorschau, nicht die Auswahl/Herkunft der Folie.
        <section
          id={id}
          aria-label={t("folienaenderungen.oeffnen")}
          className="mt-2 rounded-card border border-hairline p-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              schliesse();
            }
          }}
        >
          <p>{t("folienaenderungen.hinweis")}</p>
          <form
            onSubmit={(e) => {
              void vorschau(e);
            }}
            className="mt-2 grid min-w-0 gap-2"
          >
            <label>
              {t("folienaenderungen.datenpunkt")}
              <select
                value={wahl}
                onChange={(e) => {
                  verwerfe();
                  setWahl(e.target.value);
                  setWert(lage.datenpunkte.find((d) => d.id === e.target.value)?.wert ?? "");
                }}
                className="block w-full min-w-0 rounded-btn border border-hairline bg-panel p-1"
              >
                {lage.datenpunkte.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.wert} · {t("folienaenderungen.fassung", { fassung: d.fassung })}
                  </option>
                ))}
              </select>
            </label>
            {dp?.rechenweg ? (
              <p>{t("folienaenderungen.rechnen")}</p>
            ) : (
              <label>
                {t("folienaenderungen.neuerWert")}
                <input
                  value={wert}
                  required
                  maxLength={1000}
                  onChange={(e) => {
                    verwerfe();
                    setWert(e.target.value);
                  }}
                  className="block w-full min-w-0 rounded-btn border border-hairline bg-panel p-1"
                />
              </label>
            )}
            {dp?.erfassung === "direkt" ? (
              <label>
                <input
                  type="checkbox"
                  checked={quelle}
                  onChange={(e) => {
                    verwerfe();
                    setQuelle(e.target.checked);
                  }}
                />{" "}
                {t("folienaenderungen.quelle")}
              </label>
            ) : null}
            <label>
              {t("folienaenderungen.grund")}
              <input
                value={grund}
                required
                maxLength={1000}
                onChange={(e) => {
                  verwerfe();
                  setGrund(e.target.value);
                }}
                className="block w-full min-w-0 rounded-btn border border-hairline bg-panel p-1"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!dp || laedt}
                className="rounded-btn border border-hairline px-2 py-1 font-semibold"
              >
                {t(laedt ? "folienaenderungen.laedt" : "folienaenderungen.pruefen")}
              </button>
              <button
                type="button"
                onClick={schliesse}
                className="rounded-btn border border-hairline px-2 py-1"
              >
                {t("folienaenderungen.verwerfen")}
              </button>
            </div>
          </form>
          <output aria-live="polite" className="block">
            {ergebnis
              ? t("folienaenderungen.ergebnis", { anzahl: ergebnis.aenderungen.length })
              : ""}
          </output>
          {fehler ? (
            <p role="alert" className="mt-2 text-trust-crit-text">
              {fehler}
            </p>
          ) : null}
          {ergebnis ? (
            <div className="mt-2 space-y-2 break-words">
              <ul>
                {ergebnis.konflikte.map((k) => (
                  <li key={k.datenpunktId} className="text-trust-crit-text">
                    {k.grund}
                  </li>
                ))}
              </ul>
              {ergebnis.aenderungen.map((a) => (
                <details key={a.nachher.id} className="rounded-card border border-hairline p-2">
                  <summary>
                    {a.vorher.wert} → {a.nachher.wert} ·{" "}
                    {t("folienaenderungen.fassung", { fassung: a.nachher.fassung })}
                  </summary>
                  <p>{t("folienaenderungen.pruefungNoetig")}</p>
                  {a.nachher.kontrolle ? (
                    <DatenKontrolle kontrolle={a.nachher.kontrolle} eingebettet />
                  ) : null}
                </details>
              ))}
              <ul className="space-y-1">
                {ergebnis.wirkungen.map((w) => (
                  <li
                    key={`${w.datenpunktId}:${w.bindungId}`}
                    className={w.lage === "konflikt" ? "text-trust-crit-text" : ""}
                  >
                    {t("folienaenderungen.folie", { nummer: w.folienPosition })} · {w.elementName}:{" "}
                    {w.vorher} → {w.nachher}. {w.grund}
                  </li>
                ))}
              </ul>
              <p>{ergebnis.uebernahme.grund}</p>
              <details>
                <summary>{t("folienaenderungen.umfang")}</summary>
                <ul>
                  {ergebnis.grenzen.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
