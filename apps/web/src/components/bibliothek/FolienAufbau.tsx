import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { type AufbauVorschau, praesentationAufbau } from "../../api/praesentationAufbau";
import { praesentationDaten } from "../../api/praesentationDaten";

/** Kontextaktion am vorhandenen PPTX-Anhang; Herkunft/Prüfen bleiben im benachbarten PP-02/03-Weg. */
export function FolienAufbau({
  koId,
  anhangId,
  fassung,
  gespeichert,
}: {
  koId: string;
  anhangId: string;
  fassung: number;
  gespeichert: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const qc = useQueryClient();
  const [titel, setTitel] = useState("");
  const [ziel, setZiel] = useState("");
  const [publikum, setPublikum] = useState("");
  const [dauer, setDauer] = useState(12);
  const [design, setDesign] = useState<"vorlage" | "betont">("vorlage");
  const [diagramm, setDiagramm] = useState(true);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [vorschau, setVorschau] = useState<AufbauVorschau | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const daten = useQuery({
    queryKey: ["ko", koId, "office", anhangId, "folien-daten"],
    queryFn: () => praesentationDaten.lage(koId, anhangId),
  });
  const feld = "block w-full rounded-btn border border-hairline bg-surface px-2 py-1 text-text";
  const knopf = "rounded-btn border border-hairline px-3 py-1.5 text-text disabled:opacity-50";
  const fehlertext = (f: unknown) => (f instanceof ApiError ? f.message : t("folienaufbau.fehler"));
  async function vorbereiten(e: FormEvent) {
    e.preventDefault();
    setBeschaeftigt(true);
    setFehler("");
    setMeldung("");
    setVorschau(null);
    try {
      const fakten = daten.data?.datenpunkte.filter((d) => auswahl.includes(d.id)) ?? [];
      setVorschau(
        await praesentationAufbau.vorschau(koId, anhangId, {
          expectedVersion: fassung,
          titel,
          ziel,
          publikum,
          dauerMinuten: dauer,
          design,
          diagramm,
          datenpunkte: fakten.map((d) => ({ id: d.id, fassung: d.fassung })),
        }),
      );
    } catch (f) {
      setFehler(fehlertext(f));
    } finally {
      setBeschaeftigt(false);
    }
  }
  async function uebernehmen() {
    if (!vorschau) return;
    setBeschaeftigt(true);
    setFehler("");
    try {
      const ergebnis = await praesentationAufbau.uebernehmen(koId, anhangId, vorschau);
      setMeldung(
        `${t("folienaufbau.gespeichert", { fassung: ergebnis.fassung })} ${ergebnis.hinweis}`,
      );
      setVorschau(null);
      gespeichert();
      void qc.invalidateQueries({ queryKey: ["ko", koId] });
    } catch (f) {
      setFehler(fehlertext(f));
      setVorschau(null);
    } finally {
      setBeschaeftigt(false);
    }
  }
  return (
    <details className="mt-3 border-t border-hairline pt-3 text-[13px]" data-folienaufbau="">
      <summary className="cursor-pointer font-semibold">{t("folienaufbau.titel")}</summary>
      <p className="my-2 text-muted">{t("folienaufbau.hinweis")}</p>
      <form onSubmit={vorbereiten} onChange={() => setVorschau(null)} className="space-y-3">
        <fieldset disabled={beschaeftigt} className="space-y-2">
          <legend className="sr-only">{t("folienaufbau.ziel")}</legend>
          <label htmlFor={`${id}-titel`}>
            {t("folienaufbau.deckTitel")}
            <input
              id={`${id}-titel`}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              maxLength={100}
              required
              className={feld}
            />
          </label>
          <label htmlFor={`${id}-ziel`}>
            {t("folienaufbau.ziel")}
            <input
              id={`${id}-ziel`}
              value={ziel}
              onChange={(e) => setZiel(e.target.value)}
              maxLength={200}
              required
              className={feld}
            />
          </label>
          <label htmlFor={`${id}-publikum`}>
            {t("folienaufbau.publikum")}
            <input
              id={`${id}-publikum`}
              value={publikum}
              onChange={(e) => setPublikum(e.target.value)}
              maxLength={100}
              required
              className={feld}
            />
          </label>
          <label htmlFor={`${id}-dauer`}>
            {t("folienaufbau.dauer")}
            <input
              id={`${id}-dauer`}
              type="number"
              min={1}
              max={120}
              value={dauer}
              onChange={(e) => setDauer(Number(e.target.value))}
              required
              className={feld}
            />
          </label>
          <label htmlFor={`${id}-design`}>
            {t("folienaufbau.design")}
            <select
              id={`${id}-design`}
              className={feld}
              value={design}
              onChange={(e) => setDesign(e.target.value as "vorlage" | "betont")}
            >
              <option value="vorlage">{t("folienaufbau.vorlage")}</option>
              <option value="betont">{t("folienaufbau.betont")}</option>
            </select>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={diagramm}
              onChange={(e) => setDiagramm(e.target.checked)}
            />
            {t("folienaufbau.diagramm")}
          </label>
          <fieldset>
            <legend>{t("folienaufbau.daten")}</legend>
            {daten.data?.datenpunkte.map((d) => (
              <label key={d.id} className="my-1 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={auswahl.includes(d.id)}
                  onChange={(e) =>
                    setAuswahl((xs) =>
                      e.target.checked ? [...xs, d.id] : xs.filter((x) => x !== d.id),
                    )
                  }
                />
                <span>
                  {d.wert} · {d.zeitraum ?? t("folienaufbau.zeitraumOffen")} ·{" "}
                  {t(`praesentationdaten.zustand.${d.kontrolle?.zustand ?? d.pruefstand.zustand}`)}
                </span>
              </label>
            ))}
            {daten.data?.datenpunkte.length === 0 ? <p>{t("folienaufbau.keineDaten")}</p> : null}
            {daten.isError ? <p role="alert">{fehlertext(daten.error)}</p> : null}
          </fieldset>
          <button
            type="submit"
            disabled={auswahl.length < 1 || auswahl.length > 12 || daten.isPending || daten.isError}
            className={knopf}
          >
            {t("folienaufbau.vorschau")}
          </button>
        </fieldset>
      </form>
      {fehler ? (
        <p role="alert" className="mt-2 text-danger">
          {fehler}
        </p>
      ) : null}
      {meldung ? <output className="mt-2 block">{meldung}</output> : null}
      {vorschau ? (
        <section aria-label={t("folienaufbau.vorschau")} className="mt-3 space-y-2">
          <h4 className="font-semibold">{vorschau.auftrag.titel}</h4>
          <p>{t("folienaufbau.gliederung")}</p>
          <details>
            <summary>{t("folienaufbau.folienliste")}</summary>
            <ol className="list-decimal pl-5">
              {vorschau.folien?.map((f) => (
                <li key={f.sldId}>{f.titel}</li>
              ))}
            </ol>
          </details>
          <ul>
            {vorschau.fakten.map((f) => (
              <li key={f.id}>
                <strong>
                  {f.label}: {f.wert}
                </strong>{" "}
                · {f.zeitraum} · {f.zustand}
                <details>
                  <summary>{t("folienaufbau.belege")}</summary>
                  <ul className="space-y-1 break-words">
                    {f.belege.map((b, i) => (
                      <li key={`${f.id}-${i}`}>{b}</li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          {vorschau.diagramm ? <p>{t("folienaufbau.skala", vorschau.diagramm)}</p> : null}
          {vorschau.hinweise.map((h) => (
            <p className="text-muted" key={h}>
              {h}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={knopf}
              disabled={beschaeftigt}
              onClick={() => void uebernehmen()}
            >
              {t("folienaufbau.uebernehmen")}
            </button>
            <button
              type="button"
              className={knopf}
              disabled={beschaeftigt}
              onClick={() => setVorschau(null)}
            >
              {t("folienaufbau.verwerfen")}
            </button>
          </div>
        </section>
      ) : null}
    </details>
  );
}
