// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) — DIE PERSÖNLICHEN AUFGABEN, SO WIE SIE AM SERVER SIND.
// ================================================================================================
//
// Dieselbe Fläche in Klara und auf „Meine Aufgaben“ (`pages/MyTasks.tsx`): je Aufgabe Titel, Status,
// Priorität, persönliche Zuständigkeit, Bezug (Notiz bzw. Auftrag mit Wortlaut) und Rücklink zum
// Ort; öffnen und bearbeiten, priorisieren, erledigen und wieder öffnen, löschen. Jeder angezeigte
// Status ist der vom Server bestätigte — ein laufender Versuch heisst „wird gespeichert“, ein
// gescheiterter steht mit Grund und „Erneut speichern“ an GENAU dieser Aufgabe. Abläufe: `aufgaben.ts`.
//
// GELTUNGSBEREICH SICHTBAR: Jede Zeile trägt „Persönlich“; der Hinweis oben sagt, dass gemeinsame
// Aufgaben (Prüfung, Konflikt, Lücke) an ihrem Ort mit ihren Rechten bleiben. Hier wird keine
// Unternehmensaufgabe gezeigt und keine umetikettiert.
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import type { KlaraAufgabe, KlaraAufgabePrioritaet } from "../../api/klaraAufgabe";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { formatKoTimestamp } from "../../lib/koDates";
import {
  aendereAufgabe,
  holeAufgabe,
  ladeAufgaben,
  loescheAufgabe,
  nochmalAendern,
  nochmalAnlegen,
  useAufgaben,
  verwirfAenderung,
  verwirfAusstehend,
} from "./aufgaben";
import { ruecklinkZiel } from "./notizen";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_HAUPT =
  "inline-flex h-8 items-center rounded-btn border border-ink bg-ink px-2.5 text-[12px] font-semibold text-white hover:bg-ink/90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-klein font-semibold uppercase tracking-wider text-muted-2";
const SCHILD = "rounded-pill px-1.5 py-0.5 font-mono text-klein font-semibold uppercase";
const FELD =
  "mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30";

const PRIORITAETEN: readonly KlaraAufgabePrioritaet[] = ["hoch", "mittel", "niedrig"];

type T = ReturnType<typeof useAssistenzT>["t"];

/** Woraus die Aufgabe entstand — in den Worten der Person. */
function bezugText(a: KlaraAufgabe, t: T): string {
  if (a.bezug.art === "notiz") {
    return t("klaraaufgabe.bezug.notiz", { titel: a.bezug.notizTitel });
  }
  return t(`klaraaufgabe.bezug.auftrag.${a.bezug.quelle}`, { wortlaut: a.bezug.wortlaut });
}

function AufgabeZeile({
  a,
  istZiel,
}: {
  a: KlaraAufgabe;
  istZiel: boolean;
}): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const id = useId();
  const s = useAufgaben();
  const [offen, setOffen] = useState(istZiel);
  // Nacharbeit 2 (Ben): nicht nur beim ersten Zeigen — wird diese Aufgabe später zum Ziel eines
  // Ergebnislinks (`?persoenlich=<id>` bei schon offener Seite), öffnet sie sich ebenfalls.
  useEffect(() => {
    if (istZiel) {
      setOffen(true);
    }
  }, [istZiel]);
  const [titel, setTitel] = useState(a.titel);
  const [inhalt, setInhalt] = useState(a.inhalt);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  // Eine bestätigte neue Fassung setzt die Felder auf den Serverstand.
  useEffect(() => {
    setTitel(a.titel);
    setInhalt(a.inhalt);
    setLoeschenFragen(false);
  }, [a]);
  const versuch = s.aenderungen[a.id] ?? null;
  const laeuft = versuch?.stand === "laeuft";
  const erledigt = a.status === "erledigt";
  const geaendert = titel.trim() !== a.titel || inhalt !== a.inhalt;
  const ort = [a.objektbezug.seitenName, a.objektbezug.objekt].filter(Boolean).join(" · ");

  return (
    <li
      data-testid="klara-aufgabe-eintrag"
      data-aufgabe={a.id}
      data-status={a.status}
      data-prioritaet={a.prioritaet}
      data-fassung={a.fassung}
      data-laeuft={laeuft ? "ja" : "nein"}
      className="rounded-btn border border-hairline bg-surface px-2 py-1.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="klara-aufgabe-erledigen"
          aria-pressed={erledigt}
          disabled={laeuft}
          onClick={() => void aendereAufgabe(a.id, { status: erledigt ? "offen" : "erledigt" }, t)}
          className={KNOPF}
        >
          {erledigt ? t("klaraaufgabe.wiederOeffnen") : t("klaraaufgabe.erledigen")}
        </button>
        <button
          type="button"
          data-testid="klara-aufgabe-oeffnen"
          aria-expanded={offen}
          onClick={() => setOffen((v) => !v)}
          className={`min-w-0 flex-1 text-left text-[12.5px] font-semibold hover:underline ${
            erledigt ? "text-muted line-through" : "text-text"
          }`}
        >
          {a.titel}
        </button>
        <span
          data-testid="klara-aufgabe-status"
          className={`${SCHILD} ${
            erledigt ? "bg-trust-pos-bg text-trust-pos-text" : "border border-hairline text-muted"
          }`}
        >
          {laeuft ? t("klaraaufgabe.speichertGerade") : t(`klaraaufgabe.status.${a.status}`)}
        </span>
      </div>
      <p data-testid="klara-aufgabe-zustaendig" className="mt-0.5 text-[11px] text-muted">
        {t("klaraaufgabe.zustaendig")} · {t("klaraaufgabe.bereich.persoenlich")}
        {erledigt && a.erledigtAm
          ? ` · ${t("klaraaufgabe.erledigtAm", {
              zeit: formatKoTimestamp(a.erledigtAm, i18n.language) ?? "—",
            })}`
          : ""}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <label htmlFor={`${id}-prio`} className={KLEINTITEL}>
          {t("klaraaufgabe.feld.prioritaet")}
        </label>
        <select
          id={`${id}-prio`}
          data-testid="klara-aufgabe-prioritaet"
          value={a.prioritaet}
          disabled={laeuft}
          onChange={(e) =>
            void aendereAufgabe(a.id, { prioritaet: e.target.value as KlaraAufgabePrioritaet }, t)
          }
          className="h-7 rounded-input border border-hairline bg-surface px-1.5 text-[12px] text-text"
        >
          {PRIORITAETEN.map((p) => (
            <option key={p} value={p}>
              {t(`klaraauftrag.prioritaet.${p}`)}
            </option>
          ))}
        </select>
      </div>
      <p data-testid="klara-aufgabe-bezug" className="mt-0.5 text-[11px] text-muted">
        {bezugText(a, t)}
      </p>

      {versuch?.stand === "fehler" ? (
        <p
          role="alert"
          data-testid="klara-aufgabe-fehler"
          className="mt-1 flex flex-wrap items-center gap-1.5 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] font-semibold text-trust-crit-text"
        >
          {t("klaraaufgabe.aenderungNichtGespeichert", { grund: versuch.fehler ?? "" })}
          <button
            type="button"
            data-testid="klara-aufgabe-nochmal"
            onClick={() => void nochmalAendern(a.id, t)}
            className={KNOPF}
          >
            {t("klaraaufgabe.nochmal")}
          </button>
          <button
            type="button"
            data-testid="klara-aufgabe-verwerfen"
            onClick={() => void verwirfAenderung(a.id, t)}
            className={KNOPF}
          >
            {t("klaraaufgabe.verwerfen")}
          </button>
        </p>
      ) : null}

      {offen ? (
        <div data-testid="klara-aufgabe-offen" className="mt-1.5 border-t border-hairline pt-1.5">
          <Link
            to={ruecklinkZiel(a.objektbezug)}
            data-testid="klara-aufgabe-ruecklink"
            className="inline-flex text-[12px] font-semibold text-brand-text hover:underline"
          >
            {t("klaraaufgabe.ruecklink", { ort })}
          </Link>
          <p className="text-[11px] text-muted">
            {t("klaraaufgabe.angelegt", {
              zeit: formatKoTimestamp(a.angelegtAm, i18n.language) ?? "—",
            })}
          </p>
          <label htmlFor={`${id}-titel`} className={`${KLEINTITEL} mt-1.5 block`}>
            {t("klaraaufgabe.feld.titel")}
          </label>
          <input
            id={`${id}-titel`}
            data-testid="klara-aufgabe-titel"
            value={titel}
            maxLength={200}
            onChange={(e) => setTitel(e.target.value)}
            className={`${FELD} h-8`}
          />
          <label htmlFor={`${id}-inhalt`} className={`${KLEINTITEL} mt-1.5 block`}>
            {t("klaraaufgabe.feld.inhalt")}
          </label>
          <textarea
            id={`${id}-inhalt`}
            data-testid="klara-aufgabe-inhalt"
            value={inhalt}
            rows={3}
            onChange={(e) => setInhalt(e.target.value)}
            className={FELD}
          />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="klara-aufgabe-speichern"
              disabled={!geaendert || !titel.trim() || laeuft}
              onClick={() => void aendereAufgabe(a.id, { titel: titel.trim(), inhalt }, t)}
              className={KNOPF_HAUPT}
            >
              {laeuft ? t("klaraaufgabe.speichertGerade") : t("klaraaufgabe.speichern")}
            </button>
            {loeschenFragen ? (
              <>
                <button
                  type="button"
                  data-testid="klara-aufgabe-loeschen-bestaetigen"
                  onClick={() => void loescheAufgabe(a.id, t)}
                  className={KNOPF}
                >
                  {t("klaraaufgabe.loeschenBestaetigen")}
                </button>
                <button
                  type="button"
                  data-testid="klara-aufgabe-loeschen-abbrechen"
                  onClick={() => setLoeschenFragen(false)}
                  className={KNOPF}
                >
                  {t("klaraaufgabe.loeschenAbbrechen")}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="klara-aufgabe-loeschen"
                onClick={() => setLoeschenFragen(true)}
                className={KNOPF}
              >
                {t("klaraaufgabe.loeschen")}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function KlaraAufgaben({ offenId = null }: { offenId?: string | null }): JSX.Element {
  const { t } = useAssistenzT();
  const id = useId();
  const s = useAufgaben();
  // Beim ersten Zeigen die eigenen Aufgaben vom Server lesen — nach erneuter Anmeldung genauso.
  const laden = s.laden;
  const generation = s.generation;
  useEffect(() => {
    if (laden === "aus") {
      void ladeAufgaben(t, generation);
    }
  }, [laden, generation, t]);
  // Nacharbeit 2 (Ben): ein direkt verlinktes Ziel hängt nicht am Listenausschnitt — fehlt es nach
  // dem Lesen in der Liste, wird es einzeln vom Server geholt (oder sein Fehlen gemeldet).
  const zielFehlt =
    offenId !== null && laden === "bereit" && !s.liste.some((a) => a.id === offenId);
  useEffect(() => {
    if (zielFehlt && offenId) {
      void holeAufgabe(offenId, t);
    }
  }, [zielFehlt, offenId, t]);
  const offene = s.liste.filter((a) => a.status === "offen").length;

  return (
    <section
      data-testid="klara-aufgaben"
      aria-labelledby={`${id}-titel`}
      className="space-y-1.5 rounded-card border border-hairline px-3 py-2.5"
    >
      <h3 id={`${id}-titel`} className="text-[12.5px] font-semibold text-ink">
        {t("klaraaufgabe.titel")}
        {s.laden === "bereit" ? (
          <span data-testid="klara-aufgaben-zahl" className="ml-1.5 font-normal text-muted">
            {t("klaraaufgabe.zahl", { offen: offene, alle: s.liste.length })}
          </span>
        ) : null}
      </h3>
      <p data-testid="klara-aufgaben-privat" className="text-[11px] leading-relaxed text-muted">
        {t("klaraaufgabe.privat.hinweis")}
      </p>
      <output data-testid="klara-aufgabe-meldung" aria-live="polite" className="block text-[11px]">
        {s.meldung ?? ""}
      </output>

      {/* Anlegen aus einer Notiz, das noch läuft oder gescheitert ist — nie still verschwunden. */}
      {s.ausstehend.length > 0 ? (
        <ul className="space-y-1">
          {s.ausstehend.map((x) => (
            <li
              key={x.vorgang}
              data-testid="klara-aufgabe-ausstehend"
              data-stand={x.stand}
              className={`rounded-btn px-2 py-1 text-[11.5px] ${
                x.stand === "fehler"
                  ? "bg-trust-crit-bg font-semibold text-trust-crit-text"
                  : "bg-ink/5 text-text"
              }`}
            >
              <span className="block">„{x.vorschau}“</span>
              {x.stand === "laeuft" ? (
                <span>{t("klaraaufgabe.speichertGerade")}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  {t("klaraaufgabe.nichtGespeichert", { grund: x.fehler ?? "" })}
                  <button
                    type="button"
                    data-testid="klara-aufgabe-anlegen-nochmal"
                    onClick={() => void nochmalAnlegen(x.vorgang, t)}
                    className={KNOPF}
                  >
                    {t("klaraaufgabe.nochmal")}
                  </button>
                  <button
                    type="button"
                    data-testid="klara-aufgabe-anlegen-verwerfen"
                    onClick={() => verwirfAusstehend(x.vorgang)}
                    className={KNOPF}
                  >
                    {t("klaraaufgabe.verwerfen")}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Erst nach dem Lesen vom Server heisst eine leere Liste „keine Aufgaben“. */}
      {s.laden === "aus" || s.laden === "laedt" ? (
        <p data-testid="klara-aufgaben-laden" className="text-[11.5px] text-muted-2">
          {t("klaraaufgabe.laden")}
        </p>
      ) : s.laden === "fehler" ? (
        <p
          role="alert"
          data-testid="klara-aufgaben-ladefehler"
          className="flex flex-wrap items-center gap-1.5 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] text-trust-crit-text"
        >
          {t("klaraaufgabe.ladeFehler", { grund: s.ladeFehler ?? "" })}
          <button type="button" onClick={() => void ladeAufgaben(t)} className={KNOPF}>
            {t("klaraaufgabe.nochmalLaden")}
          </button>
        </p>
      ) : s.liste.length === 0 ? (
        <p data-testid="klara-aufgaben-leer" className="text-[11.5px] text-muted-2">
          {t("klaraaufgabe.leer")}
        </p>
      ) : (
        <ul className="space-y-1" data-testid="klara-aufgaben-liste">
          {s.liste.map((a) => (
            <AufgabeZeile key={a.id} a={a} istZiel={a.id === offenId} />
          ))}
        </ul>
      )}
    </section>
  );
}
