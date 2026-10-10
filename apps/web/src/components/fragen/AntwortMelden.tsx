// ================================================================================================
// R-1089 / R-1721 · „ANTWORT MELDEN" — falsche Antwort oder unpassende Quelle, mit Quittung.
// ================================================================================================
//
// Die Meldung geht über `POST /api/ask/report` an die verantwortliche Person des gewählten
// Wissensobjekts (Server: `responsibleOf`), nicht in ein Sammelbecken. Meldbar sind nur die
// Quellen, die der Antwort-Beleg trägt — dieselbe Menge wie beim „Hat geholfen" (`citedSources`);
// eine andere Quelle liefe in 403. Die Seite reicht diese Quellen und den Beleg herein und setzt
// den Baustein je Antwort neu auf (`key`), damit keine Quittung neben einer anderen Antwort steht.
//
// Die Quittung ist die Antwort des Servers, nichts Vorhergesagtes: Meldungsnummer, Zeitpunkt und
// wohin die Meldung ging. Kein Freitext — die Begründung steht am Server (`antwort-meldung.ts`).
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import type { AntwortMeldeGrund, AntwortMeldungQuittung } from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";

const GRUENDE: readonly AntwortMeldeGrund[] = ["antwort-falsch", "quelle-passt-nicht"];

export function AntwortMelden({
  quellen,
  receipt,
  belegGueltig,
  onFehler,
}: {
  /** Die vom Beleg getragenen Quellen, in Anzeigereihenfolge (die tragende zuerst). */
  quellen: readonly { id: string; label: string }[];
  receipt: string;
  belegGueltig: boolean;
  onFehler: () => void;
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const [offen, setOffen] = useState(false);
  const [grund, setGrund] = useState<AntwortMeldeGrund>("antwort-falsch");
  const [quelle, setQuelle] = useState<string>(quellen[0]?.id ?? "");
  const [quittung, setQuittung] = useState<AntwortMeldungQuittung | null>(null);
  const melden = useMutation({
    mutationFn: () => endpoints.ask.report(quelle, receipt, grund),
    onSuccess: (q) => {
      setQuittung(q);
      setOffen(false);
    },
    onError: onFehler,
  });

  if (quellen.length === 0) {
    return null;
  }

  if (quittung) {
    // `<output>` trägt implizit `role="status"` (biome `useSemanticElements`, dieselbe Wahl wie
    // AdminBetriebDetails): die Quittung ist eine Auskunft, kein Alarm.
    return (
      <output
        data-testid="antwortmeldung-quittung"
        data-zugestellt={quittung.zugestelltAn}
        className="block basis-full rounded-[10px] border border-hairline bg-surface px-4 py-3 text-[13px] text-text"
      >
        {/* `<output>` erlaubt nur Textinhalt — deshalb Blockspannen statt Absätzen. */}
        <span className="block font-semibold">
          {t("antwortmeldung.quittung.titel", { meldungId: quittung.meldungId })}
        </span>
        <span className="mt-1 block text-muted">
          {t(`antwortmeldung.quittung.${quittung.zugestelltAn}`, {
            titel: quittung.koTitle,
            zeit: formatKoTimestamp(quittung.at, i18n.language) ?? "—",
          })}
        </span>
        {quittung.bereitsGemeldet ? (
          <span className="mt-1 block text-muted-2" data-testid="antwortmeldung-bereits">
            {t("antwortmeldung.quittung.bereits")}
          </span>
        ) : null}
      </output>
    );
  }

  if (!offen) {
    return (
      <button
        type="button"
        data-testid="antwortmeldung-oeffnen"
        disabled={!belegGueltig}
        aria-describedby={belegGueltig ? undefined : "ask-rueckmeldung-abgelaufen"}
        onClick={() => setOffen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-hairline bg-surface px-5 py-2.5 text-[14px] text-text hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AlertTriangle size={14} aria-hidden="true" />
        {t("antwortmeldung.oeffnen")}
      </button>
    );
  }

  return (
    <form
      data-testid="antwortmeldung-formular"
      className="basis-full rounded-[10px] border border-hairline bg-surface px-4 py-3 text-[13px] text-text"
      onSubmit={(e) => {
        e.preventDefault();
        if (quelle && !melden.isPending) {
          melden.mutate();
        }
      }}
    >
      <fieldset>
        <legend className="font-semibold">{t("antwortmeldung.titel")}</legend>
        {GRUENDE.map((g) => (
          <label key={g} className="mt-1 flex items-center gap-2">
            <input
              type="radio"
              name="antwortmeldung-grund"
              value={g}
              checked={grund === g}
              onChange={() => setGrund(g)}
              data-testid={`antwortmeldung-grund-${g}`}
            />
            {t(`antwortmeldung.grund.${g}`)}
          </label>
        ))}
      </fieldset>
      {quellen.length > 1 ? (
        <label className="mt-2 block">
          <span className="block text-[12px] text-muted-2">{t("antwortmeldung.quelle")}</span>
          <select
            data-testid="antwortmeldung-quelle"
            value={quelle}
            onChange={(e) => setQuelle(e.target.value)}
            className="mt-0.5 w-full rounded-[8px] border border-hairline bg-surface px-2 py-1.5"
          >
            {quellen.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="mt-2 text-[12px] text-muted-2">
          {t("antwortmeldung.quelle")}: {quellen[0]?.label}
        </p>
      )}
      <p className="mt-2 text-[12px] text-muted-2">{t("antwortmeldung.hinweis")}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          data-testid="antwortmeldung-absenden"
          disabled={melden.isPending || !belegGueltig}
          className="rounded-[10px] border border-hairline bg-surface px-4 py-2 font-semibold hover:bg-hairline-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {melden.isPending ? t("antwortmeldung.laeuft") : t("antwortmeldung.absenden")}
        </button>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="rounded-[10px] px-4 py-2 text-muted hover:text-text"
        >
          {t("antwortmeldung.abbrechen")}
        </button>
      </div>
    </form>
  );
}
