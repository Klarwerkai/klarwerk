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
//
// produkt:20261010:antwort-beanstandung-korrektur: wahlweise eine KONKRETE Aussage der Antwort —
// mit Fundstelle oder „Quelle fehlt" — und eine kurze Begründung. Der Server prüft die Aussage gegen
// die signierte Aussagefassung des Belegs und führt sie als eigenen Vorgang; die Quittung verweist
// darauf. Die Begründung steht nur an diesem Vorgang, nicht im Prüfprotokoll.
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import type {
  AntwortAussagenBeleg,
  AntwortBeanstandung,
  AntwortMeldeGrund,
  AntwortMeldungQuittung,
} from "../../api/types";
import { formatKoTimestamp } from "../../lib/koDates";

const GRUENDE: readonly AntwortMeldeGrund[] = ["antwort-falsch", "quelle-passt-nicht"];
/** Dieselbe Grenze wie `BEANSTANDUNG_BEGRUENDUNG_MAX` am Server. */
const BEGRUENDUNG_MAX = 500;

export function AntwortMelden({
  quellen,
  receipt,
  belegGueltig,
  onFehler,
  aussagen = [],
}: {
  /** Die vom Beleg getragenen Quellen, in Anzeigereihenfolge (die tragende zuerst). */
  quellen: readonly { id: string; label: string }[];
  receipt: string;
  belegGueltig: boolean;
  onFehler: () => void;
  /** Die Aussagen dieser Antwort (`AskResponse.aussagen`); leer = nur die einfache Meldung. */
  aussagen?: AntwortAussagenBeleg["aussagen"];
}): JSX.Element | null {
  const { t, i18n } = useTranslation();
  const [offen, setOffen] = useState(false);
  const [grund, setGrund] = useState<AntwortMeldeGrund>("antwort-falsch");
  const [quelle, setQuelle] = useState<string>(quellen[0]?.id ?? "");
  const [aussageId, setAussageId] = useState<string>("");
  const [fundstelleId, setFundstelleId] = useState<string>("");
  const [quelleFehlt, setQuelleFehlt] = useState(false);
  const [begruendung, setBegruendung] = useState("");
  const [quittung, setQuittung] = useState<AntwortMeldungQuittung | null>(null);

  const aussage = aussagen.find((a) => a.aussageId === aussageId) ?? null;
  const fundstellen = aussage ? aussage.teile.flatMap((teil) => teil.fundstellen) : [];
  const fundstelle = fundstellen.find((f) => f.fundstelleId === fundstelleId) ?? null;
  const beanstandung: AntwortBeanstandung | null = aussage
    ? {
        aussage: {
          aussageId: aussage.aussageId,
          text: aussage.text,
          ...(fundstelle ? { fundstelleId: fundstelle.fundstelleId } : {}),
          ...(quelleFehlt ? { quelleFehlt: true as const } : {}),
        },
        begruendung: begruendung.trim(),
      }
    : null;
  // Die gemeldete Quelle: die der Fundstelle, keine bei „Quelle fehlt", sonst die gewählte.
  const koId = fundstelle ? fundstelle.koId : beanstandung && quelleFehlt ? "" : quelle;
  const bereit = beanstandung
    ? beanstandung.begruendung.length > 0 && (koId !== "" || quelleFehlt)
    : quelle !== "";

  const melden = useMutation({
    mutationFn: () =>
      beanstandung
        ? endpoints.ask.report(koId, receipt, grund, beanstandung)
        : endpoints.ask.report(quelle, receipt, grund),
    onSuccess: (q) => {
      setQuittung(q);
      setOffen(false);
    },
    onError: onFehler,
  });

  if (quellen.length === 0 && aussagen.length === 0) {
    return null;
  }

  if (quittung) {
    const vorgang = quittung.beanstandung;
    // `<output>` trägt implizit `role="status"` (biome `useSemanticElements`, dieselbe Wahl wie
    // AdminBetriebDetails): die Quittung ist eine Auskunft, kein Alarm.
    return (
      <>
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
          {vorgang ? (
            <span className="mt-1 block text-muted-2" data-testid="antwortmeldung-beanstandung">
              {t(
                vorgang.zusammengefuehrt
                  ? "antwortmeldung.beanstandung.zusammengefuehrt"
                  : "antwortmeldung.beanstandung.angelegt",
              )}{" "}
              {t(
                vorgang.zustaendigkeit === "zugeordnet"
                  ? "antwortmeldung.beanstandung.zugeordnet"
                  : "antwortmeldung.beanstandung.offen",
              )}
              {vorgang.koVersion !== null
                ? ` ${t("antwortmeldung.beanstandung.fassung", { fassung: vorgang.koVersion })}`
                : ""}
            </span>
          ) : null}
        </output>
        {vorgang ? (
          <Link
            data-testid="antwortmeldung-vorgang"
            to={`/luecke/${encodeURIComponent(vorgang.vorgangId)}`}
            className="basis-full text-[13px] text-ai underline"
          >
            {t("antwortmeldung.beanstandung.vorgang")}
          </Link>
        ) : null}
      </>
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
        if (bereit && !melden.isPending) {
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
      {aussagen.length > 0 ? (
        <label className="mt-2 block">
          <span className="block text-[12px] text-muted-2">{t("antwortmeldung.aussage")}</span>
          <select
            data-testid="antwortmeldung-aussage"
            value={aussageId}
            onChange={(e) => {
              setAussageId(e.target.value);
              setFundstelleId("");
              setQuelleFehlt(false);
            }}
            className="mt-0.5 w-full rounded-[8px] border border-hairline bg-surface px-2 py-1.5"
          >
            <option value="">{t("antwortmeldung.aussageKeine")}</option>
            {aussagen.map((a) => (
              <option key={a.aussageId} value={a.aussageId}>
                {a.text}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {aussage && fundstellen.length > 0 ? (
        <label className="mt-2 block">
          <span className="block text-[12px] text-muted-2">{t("antwortmeldung.fundstelle")}</span>
          <select
            data-testid="antwortmeldung-fundstelle"
            value={fundstelleId}
            disabled={quelleFehlt}
            onChange={(e) => setFundstelleId(e.target.value)}
            className="mt-0.5 w-full rounded-[8px] border border-hairline bg-surface px-2 py-1.5"
          >
            <option value="">{t("antwortmeldung.fundstelleKeine")}</option>
            {fundstellen.map((f) => (
              <option key={f.fundstelleId} value={f.fundstelleId}>
                {f.auszug}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {aussage ? (
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            data-testid="antwortmeldung-quelle-fehlt"
            checked={quelleFehlt}
            onChange={(e) => {
              setQuelleFehlt(e.target.checked);
              setFundstelleId("");
            }}
          />
          {t("antwortmeldung.quelleFehlt")}
        </label>
      ) : null}
      {quellen.length > 1 && !fundstelle && !(aussage && quelleFehlt) ? (
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
      ) : quellen.length === 1 && !fundstelle && !(aussage && quelleFehlt) ? (
        <p className="mt-2 text-[12px] text-muted-2">
          {t("antwortmeldung.quelle")}: {quellen[0]?.label}
        </p>
      ) : null}
      {aussage ? (
        <label className="mt-2 block">
          <span className="block text-[12px] text-muted-2">
            {t("antwortmeldung.begruendung", { max: BEGRUENDUNG_MAX })}
          </span>
          <textarea
            data-testid="antwortmeldung-begruendung"
            value={begruendung}
            maxLength={BEGRUENDUNG_MAX}
            rows={2}
            onChange={(e) => setBegruendung(e.target.value)}
            className="mt-0.5 w-full rounded-[8px] border border-hairline bg-surface px-2 py-1.5"
          />
          <span className="block text-[12px] text-muted-2">
            {t("antwortmeldung.begruendungHinweis")}
          </span>
        </label>
      ) : null}
      <p className="mt-2 text-[12px] text-muted-2">
        {t(aussage ? "antwortmeldung.hinweisBeanstandung" : "antwortmeldung.hinweis")}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          data-testid="antwortmeldung-absenden"
          disabled={melden.isPending || !belegGueltig || !bereit}
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
