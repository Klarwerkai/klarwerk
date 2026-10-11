// ================================================================================================
// R-1055 (aufnahme:20260922:gesamt-wissen-versionen) · ZWEI FASSUNGEN NEBENEINANDER — AUCH IM EDITOR.
// ================================================================================================
//
// Der Vergleich zweier frei gewählter Fassungen stand bis hierher nur in der Lesefläche
// (`MehrAbschnitte.tsx`, JOB 4213), und dort untereinander. R-1055 verlangt ihn nebeneinander im
// Editor. Diese Datei trägt deshalb ZWEI Dinge:
//
//   · `FassungsGegenueberstellung` — die EINE Darstellung eines `paarDiff`-Ergebnisses: ältere
//     Fassung links, jüngere rechts, je geändertem Feld eine Zeile. Lesefläche UND Editor zeichnen
//     damit; eine zweite Darstellung daneben wäre die zweite Wahrheit über dieselbe Frage.
//   · `FassungsvergleichImEditor` — derselbe Vergleich als aufklappbarer Block im bestehenden
//     Bearbeiten-Formular (`BibliothekLesen.tsx`). Keine neue Route, kein neuer Abruf: dieselbe
//     Fassungsabfrage (`useKoVersions`, derselbe Cache-Schlüssel) und dieselbe Vergleichsregel
//     (`paarDiff` aus `koVersionDiff.ts`).
//
// Verglichen werden GESPEICHERTE Fassungen. Der ungespeicherte Entwurf im Formular ist keine
// Fassung und steht hier nicht — das sagt der Block auch.
import { type ChangeEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKoVersions } from "../../api/hooks";
import { type KoVersionPaarDiff, paarDiff } from "../../lib/koVersionDiff";
import { SanitizedHtml } from "../SanitizedHtml";

/** Die geänderten Felder zweier Fassungen, ältere links, jüngere rechts. */
export function FassungsGegenueberstellung({
  gegenueber,
}: {
  gegenueber: KoVersionPaarDiff;
}): JSX.Element {
  const { t } = useTranslation();
  // Die Werte kommen als GESPEICHERTE Werte aus `koVersionDiff.ts`; Art und Prüfstand sind dort
  // Schlüssel und werden über die vorhandenen Kataloge eingesetzt.
  const lesbar = (feld: string, wert: string): JSX.Element =>
    wert.length === 0 ? (
      <span className="text-muted-2">{t("ko.snapshotFieldEmpty")}</span>
    ) : feld === "type" ? (
      <>{t(`ktype.${wert}`)}</>
    ) : feld === "status" ? (
      <>{t(`status.${wert}`)}</>
    ) : feld === "bodyHtml" ? (
      // Derselbe eine Zeichenweg wie am geöffneten Bericht: kein `dangerouslySetInnerHTML`.
      <SanitizedHtml html={wert} className="prose-kw text-[12.5px]" />
    ) : (
      <>{wert}</>
    );
  return (
    <dl className="mt-2 grid gap-2" data-bib-fassung-nebeneinander>
      {gegenueber.felder.map((f) => (
        <div key={f.feld} data-bib-fassung-vergleich-feld={f.feld}>
          <dt className="font-mono text-[10.5px] text-muted-2">
            {t(`ko.snapshotField.${f.feld}`)}
          </dt>
          {/* NEBENEINANDER ab schmaler Tablettbreite; auf dem Telefon wieder untereinander, weil
              zwei Spalten dort jeden Bericht auf ein paar Wörter je Zeile drücken. */}
          <dd className="mt-0.5 grid gap-2 text-[12.5px] text-text sm:grid-cols-2">
            <div
              data-bib-vergleich-alt={f.feld}
              className="min-w-0 rounded-btn border border-hairline px-2 py-1.5"
            >
              <span className="mr-1 font-mono text-[10.5px] text-muted-2">
                {`v${gegenueber.von}`}
              </span>
              {lesbar(f.feld, f.alt)}
            </div>
            <div
              data-bib-vergleich-neu={f.feld}
              className="min-w-0 rounded-btn border border-hairline px-2 py-1.5"
            >
              <span className="mr-1 font-mono text-[10.5px] text-muted-2">
                {`v${gegenueber.bis}`}
              </span>
              {lesbar(f.feld, f.neu)}
            </div>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Der Vergleich im Bearbeiten-Formular — zugeklappt als Vorgabe, lädt erst beim Aufklappen. */
export function FassungsvergleichImEditor({ koId }: { koId: string }): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  return (
    <details
      data-bib-editor-vergleich
      open={offen}
      onToggle={(e) => setOffen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-input border border-hairline bg-surface p-2.5"
    >
      <summary className="cursor-pointer text-[12.5px] font-semibold text-text">
        {t("fassungsangabe.editorTitel")}
      </summary>
      {/* Erst aufgeklappt wird abgefragt: wer nur bearbeitet, löst keinen Fassungsabruf aus. */}
      {offen ? <EditorVergleichInhalt koId={koId} /> : null}
    </details>
  );
}

function EditorVergleichInhalt({ koId }: { koId: string }): JSX.Element {
  const { t, i18n } = useTranslation();
  const versions = useKoVersions(koId);
  // `null` heißt „noch nicht gewählt" — keine Vorbelegung, dieselbe Entscheidung wie in der
  // Lesefläche (`MehrAbschnitte.tsx`, JOB 4213): ungefragt stünden sonst zwei alte Berichte da.
  const [von, setVon] = useState<number | null>(null);
  const [bis, setBis] = useState<number | null>(null);

  if (versions.isLoading) {
    return <p className="mt-2 text-[12.5px] text-muted">{t("state.loading")}</p>;
  }
  if (versions.isError) {
    return <p className="mt-2 text-[12.5px] text-danger">{t("state.error")}</p>;
  }
  const fassungen = versions.data ?? [];
  if (fassungen.length < 2) {
    return <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareNeedsTwo")}</p>;
  }
  const absteigend = [...fassungen].sort((a, b) => b.version - a.version);
  const vorhanden = (wahl: number | null): number | null =>
    wahl !== null && absteigend.some((f) => f.version === wahl) ? wahl : null;
  const a = vorhanden(von);
  const b = vorhanden(bis);
  const gegenueber = a === null || b === null ? null : paarDiff(fassungen, a, b);
  const auswahl = (
    welche: "von" | "bis",
    wert: number | null,
    setzen: (n: number | null) => void,
  ): JSX.Element => (
    <label className="flex items-center gap-1.5 text-[12px] text-muted">
      {t(welche === "von" ? "ko.snapshotCompareFrom" : "ko.snapshotCompareTo")}
      <select
        data-bib-editor-vergleich-wahl={welche}
        value={wert === null ? "" : String(wert)}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setzen(e.target.value === "" ? null : Number(e.target.value))
        }
        className="rounded-btn border border-hairline bg-surface px-1.5 py-1 text-[12px] text-text"
      >
        <option value="">{t("ko.snapshotCompareChoose")}</option>
        {absteigend.map((f) => (
          <option key={f.version} value={String(f.version)}>
            {`v${f.version} · ${new Date(f.at).toLocaleDateString(i18n.language)}`}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="mt-2">
      <p className="text-[12px] text-muted">{t("fassungsangabe.editorHinweis")}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {auswahl("von", a, setVon)}
        {auswahl("bis", b, setBis)}
      </div>
      {a === null || b === null ? (
        <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareHint")}</p>
      ) : gegenueber === null ? (
        <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareUnknown")}</p>
      ) : gegenueber.von === gegenueber.bis ? (
        <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareSame")}</p>
      ) : gegenueber.felder.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-muted">{t("ko.snapshotCompareNone")}</p>
      ) : (
        <FassungsGegenueberstellung gegenueber={gegenueber} />
      )}
    </div>
  );
}
