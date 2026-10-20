// ================================================================================================
// KLARA 06 (produkt:20261007:klara-notizen-aufgaben) — DIE PRIVATEN NOTIZEN IN KLARAS FLÄCHE.
// ================================================================================================
//
// Zeigt, was am Server unter der eigenen Person liegt, und zwar so, wie es TATSÄCHLICH ist:
//   · jedes Anlegen mit seinem Stand — „wird gespeichert", oder „Nicht gespeichert" mit Grund und
//     „Erneut speichern" (derselbe Vorgang, keine Doppelnotiz);
//   · die eigenen Notizen, durchsuchbar; Öffnen liest frisch vom Server;
//   · die geöffnete Notiz mit Rücklink zur Stelle (Artikel/Absatz bzw. Wissensobjekt und Fassung von
//     damals), bearbeitbar, mit offenen Fragen als persönlichem Arbeitszettel.
// Angelegt wird aus dem Eingabefeld (getippt oder diktiert), aus einer gespeicherten
// Gesprächsnachricht und aus dem Notizentwurf eines markierten Ausschnitts (`KlaraVorschau.tsx`,
// `KlaraEchtGespraech.tsx`). Abläufe und Zustand: `notizen.ts`.
import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import type { KlaraNotiz } from "../../api/klaraNotiz";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { formatKoTimestamp } from "../../lib/koDates";
import { KlaraWissen, KlaraWissensImport } from "./KlaraWissen";
import { legeAufgabeAusNotiz } from "./aufgaben";
import { kurzText, starteEntwurf } from "./erinnerungen";
import {
  fragenAusText,
  ladeNotizen,
  loescheNotiz,
  nochmalAendern,
  nochmalAnlegen,
  oeffneNotiz,
  ruecklinkZiel,
  schliesseNotiz,
  speichereNotiz,
  useNotizen,
  verwirfAusstehend,
} from "./notizen";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_HAUPT =
  "inline-flex h-8 items-center rounded-btn border border-ink bg-ink px-2.5 text-[12px] font-semibold text-white hover:bg-ink/90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-klein font-semibold uppercase tracking-wider text-muted-2";
const SCHILD = "rounded-pill px-1.5 py-0.5 font-mono text-klein font-semibold uppercase";
const FELD =
  "mt-0.5 w-full rounded-input border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-text outline-none focus:border-ink/30";

/** Der Ort von damals in einer Zeile: Seite · Objekt · Absatz · Fassung. */
function ortZeile(n: KlaraNotiz, t: ReturnType<typeof useAssistenzT>["t"]): string {
  const b = n.objektbezug;
  const teile = [b.seitenName, b.objekt];
  if (b.absatz) {
    teile.push(t("klaranotiz.absatz", { nr: b.absatz }));
  }
  if (b.fassung) {
    teile.push(t("klaranotiz.fassung", { nr: b.fassung }));
  }
  return teile.join(" · ");
}

function NotizOffen({ n }: { n: KlaraNotiz }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const id = useId();
  const s = useNotizen();
  const [titel, setTitel] = useState(n.titel);
  const [inhalt, setInhalt] = useState(n.inhalt);
  const [fragen, setFragen] = useState(n.offeneFragen.join("\n"));
  const [arbeitszettel, setArbeitszettel] = useState(n.art === "arbeitszettel");
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  // Eine bestätigte neue Fassung (oder eine andere Notiz) setzt die Felder auf den Serverstand.
  useEffect(() => {
    setTitel(n.titel);
    setInhalt(n.inhalt);
    setFragen(n.offeneFragen.join("\n"));
    setArbeitszettel(n.art === "arbeitszettel");
    setLoeschenFragen(false);
  }, [n]);
  // Nur der Versuch DIESER Notiz zählt (Nacharbeit 5) — nie der einer zuvor offenen.
  const b = s.bearbeitung?.notizId === n.id ? s.bearbeitung : null;
  const geaendert =
    titel.trim() !== n.titel ||
    inhalt !== n.inhalt ||
    fragenAusText(fragen).join("\n") !== n.offeneFragen.join("\n") ||
    arbeitszettel !== (n.art === "arbeitszettel");

  return (
    <section
      data-testid="klara-notiz-offen"
      data-notiz={n.id}
      data-art={n.art}
      data-fassung={n.fassung}
      aria-label={t("klaranotiz.offen.titel")}
      className="rounded-card border border-hairline bg-page px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[12.5px] font-semibold text-ink">{t("klaranotiz.offen.titel")}</h4>
        <span className={`${SCHILD} border border-hairline text-muted`}>
          {t("klaranotiz.privat.kennzeichen")}
        </span>
      </div>
      <p data-testid="klara-notiz-herkunft" className="mt-1 text-[11px] text-muted">
        {t("klaranotiz.herkunft", {
          weg: t(`klaranotiz.weg.${n.weg}`),
          zeit: formatKoTimestamp(n.angelegtAm, i18n.language) ?? "—",
        })}
      </p>
      <Link
        to={ruecklinkZiel(n.objektbezug)}
        data-testid="klara-notiz-ruecklink"
        className="mt-0.5 inline-flex text-[12px] font-semibold text-brand-text hover:underline"
      >
        {t("klaranotiz.ruecklink", { ort: ortZeile(n, t) })}
      </Link>
      {n.objektbezug.auswahl ? (
        <p className="mt-0.5 text-[11px] italic text-muted">„{n.objektbezug.auswahl}“</p>
      ) : null}

      <KlaraWissen
        key={`${n.id}-${n.fassung}`}
        id={n.id}
        fassung={n.fassung}
        geaendert={geaendert}
      />
      <label htmlFor={`${id}-titel`} className={`${KLEINTITEL} mt-2 block`}>
        {t("klaranotiz.feld.titel")}
      </label>
      <input
        id={`${id}-titel`}
        data-testid="klara-notiz-titel"
        value={titel}
        maxLength={200}
        onChange={(e) => setTitel(e.target.value)}
        className={`${FELD} h-8`}
      />
      <label htmlFor={`${id}-inhalt`} className={`${KLEINTITEL} mt-2 block`}>
        {t("klaranotiz.feld.inhalt")}
      </label>
      <textarea
        id={`${id}-inhalt`}
        data-testid="klara-notiz-inhalt"
        value={inhalt}
        rows={4}
        onChange={(e) => setInhalt(e.target.value)}
        className={FELD}
      />
      <label htmlFor={`${id}-fragen`} className={`${KLEINTITEL} mt-2 block`}>
        {t("klaranotiz.feld.fragen")}
      </label>
      <textarea
        id={`${id}-fragen`}
        data-testid="klara-notiz-fragen"
        value={fragen}
        rows={3}
        aria-describedby={`${id}-fragen-hilfe`}
        onChange={(e) => setFragen(e.target.value)}
        className={FELD}
      />
      <p id={`${id}-fragen-hilfe`} className="mt-0.5 text-[11px] text-muted-2">
        {t("klaranotiz.feld.fragenHilfe")}
      </p>
      <label className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-text">
        <input
          type="checkbox"
          data-testid="klara-notiz-arbeitszettel"
          checked={arbeitszettel}
          onChange={(e) => setArbeitszettel(e.target.checked)}
        />
        {t("klaranotiz.feld.arbeitszettel")}
      </label>

      {b?.stand === "fehler" ? (
        <p
          role="alert"
          data-testid="klara-notiz-aenderung-fehler"
          className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] font-semibold text-trust-crit-text"
        >
          {t("klaranotiz.aenderungNichtGespeichert", { grund: b.fehler ?? "" })}
          <button
            type="button"
            data-testid="klara-notiz-aenderung-nochmal"
            onClick={() => void nochmalAendern(t)}
            className={KNOPF}
          >
            {t("klaranotiz.nochmal")}
          </button>
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-testid="klara-notiz-speichern"
          disabled={!geaendert || !inhalt.trim() || b?.stand === "laeuft"}
          onClick={() =>
            void speichereNotiz(
              {
                titel: titel.trim(),
                inhalt,
                offeneFragen: fragenAusText(fragen),
                art: arbeitszettel ? "arbeitszettel" : "notiz",
              },
              t,
            )
          }
          className={KNOPF_HAUPT}
        >
          {b?.stand === "laeuft" ? t("klaranotiz.speichertGerade") : t("klaranotiz.speichern")}
        </button>
        {/* Klara 07: aus dieser (gespeicherten) Notiz eine persönliche Aufgabe — Titel, Text und
            Stelle liest der Server aus der Notiz; zweimal gedrückt ergibt eine Aufgabe. */}
        <button
          type="button"
          data-testid="klara-notiz-als-aufgabe"
          title={t("klaraaufgabe.alsAufgabeHilfe")}
          onClick={() => void legeAufgabeAusNotiz(n, t)}
          className={KNOPF}
        >
          {t("klaraaufgabe.alsAufgabe")}
        </button>
        {/* Klara 10: aus dieser Notiz eine Erinnerung anfangen — der Server liest den Bezug selbst. */}
        <button
          type="button"
          data-testid="klara-notiz-erinnern"
          title={t("klaraerinnerung.erinnernHilfe")}
          onClick={() =>
            starteEntwurf(
              { art: "notiz", notizId: n.id },
              t("klaraerinnerung.bezug.notiz", { titel: n.titel }),
              kurzText(n.titel || n.inhalt),
            )
          }
          className={KNOPF}
        >
          {t("klaraerinnerung.erinnern")}
        </button>
        <button
          type="button"
          data-testid="klara-notiz-schliessen"
          onClick={schliesseNotiz}
          className={KNOPF}
        >
          {t("klaranotiz.schliessen")}
        </button>
        {loeschenFragen ? (
          <>
            <button
              type="button"
              data-testid="klara-notiz-loeschen-bestaetigen"
              onClick={() => void loescheNotiz(n.id, t)}
              className={KNOPF}
            >
              {t("klaranotiz.loeschenBestaetigen")}
            </button>
            <button
              type="button"
              data-testid="klara-notiz-loeschen-abbrechen"
              onClick={() => setLoeschenFragen(false)}
              className={KNOPF}
            >
              {t("klaranotiz.loeschenAbbrechen")}
            </button>
          </>
        ) : (
          <button
            type="button"
            data-testid="klara-notiz-loeschen"
            onClick={() => setLoeschenFragen(true)}
            className={KNOPF}
          >
            {t("klaranotiz.loeschen")}
          </button>
        )}
      </div>
    </section>
  );
}

export function KlaraNotizen(): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const id = useId();
  const s = useNotizen();
  const [suche, setSuche] = useState(s.suche);
  // Beim ersten Zeigen die eigenen Notizen vom Server lesen — nach erneuter Anmeldung genauso.
  // Die Generation gehört dazu: ein Vergessen während des ersten Lesens führt zurück auf `aus`, und
  // nur an der neuen Generation sieht React, dass erneut gelesen werden muss.
  const laden = s.laden;
  const generation = s.generation;
  useEffect(() => {
    if (laden === "aus") {
      void ladeNotizen(t, undefined, generation);
    }
  }, [laden, generation, t]);
  useEffect(() => {
    const notiz = new URLSearchParams(window.location.search).get("notiz");
    if (notiz) void oeffneNotiz(notiz, t);
  }, [t]);

  return (
    <section
      data-testid="klara-notizen"
      aria-labelledby={`${id}-titel`}
      className="space-y-1.5 rounded-card border border-hairline px-3 py-2.5"
    >
      <h3 id={`${id}-titel`} className="text-[12.5px] font-semibold text-ink">
        {t("klaranotiz.titel")}
      </h3>
      <p data-testid="klara-notizen-privat" className="text-[11px] leading-relaxed text-muted">
        {t("klaranotiz.privat.hinweis")}
      </p>
      <output data-testid="klara-notiz-meldung" aria-live="polite" className="block text-[11px]">
        {s.meldung ?? ""}
      </output>

      {/* Anlegen, das noch läuft oder gescheitert ist — nie still verschwunden. */}
      {s.ausstehend.length > 0 ? (
        <ul className="space-y-1" data-testid="klara-notiz-ausstehend-liste">
          {s.ausstehend.map((a) => (
            <li
              key={a.vorgang}
              data-testid="klara-notiz-ausstehend"
              data-stand={a.stand}
              className={`rounded-btn px-2 py-1 text-[11.5px] ${
                a.stand === "fehler"
                  ? "bg-trust-crit-bg font-semibold text-trust-crit-text"
                  : "bg-ink/5 text-text"
              }`}
            >
              <span className="block">„{a.vorschau}“</span>
              {a.stand === "laeuft" ? (
                <span>{t("klaranotiz.ausstehend.laeuft")}</span>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  {t("klaranotiz.nichtGespeichert", { grund: a.fehler ?? "" })}
                  <button
                    type="button"
                    data-testid="klara-notiz-nochmal"
                    onClick={() => void nochmalAnlegen(a.vorgang, t)}
                    className={KNOPF}
                  >
                    {t("klaranotiz.nochmal")}
                  </button>
                  <button
                    type="button"
                    data-testid="klara-notiz-verwerfen"
                    onClick={() => verwirfAusstehend(a.vorgang)}
                    className={KNOPF}
                  >
                    {t("klaranotiz.verwerfen")}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <KlaraWissensImport />
      {s.offen ? <NotizOffen n={s.offen} /> : null}

      <form
        data-testid="klara-notizen-suchform"
        onSubmit={(e) => {
          e.preventDefault();
          void ladeNotizen(t, suche);
        }}
        className="flex items-end gap-1.5"
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-suche`} className={KLEINTITEL}>
            {t("klaranotiz.suche.label")}
          </label>
          <input
            id={`${id}-suche`}
            data-testid="klara-notizen-suche"
            type="search"
            value={suche}
            placeholder={t("klaranotiz.suche.platzhalter")}
            onChange={(e) => setSuche(e.target.value)}
            className={`${FELD} h-8`}
          />
        </div>
        <button type="submit" data-testid="klara-notizen-suchen" className={KNOPF}>
          {t("klaranotiz.suche.los")}
        </button>
      </form>

      {/* Erst nach dem Lesen vom Server heisst eine leere Liste „keine Notizen“ — vorher
          (`aus`: noch nicht begonnen, `laedt`) steht der Ladehinweis da. */}
      {s.laden === "aus" || s.laden === "laedt" ? (
        <p data-testid="klara-notizen-laden" className="text-[11.5px] text-muted-2">
          {t("klaranotiz.laden")}
        </p>
      ) : s.laden === "fehler" ? (
        <p
          role="alert"
          data-testid="klara-notizen-ladefehler"
          className="flex flex-wrap items-center gap-1.5 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] text-trust-crit-text"
        >
          {t("klaranotiz.ladeFehler", { grund: s.ladeFehler ?? "" })}
          <button type="button" onClick={() => void ladeNotizen(t)} className={KNOPF}>
            {t("klaranotiz.nochmalLaden")}
          </button>
        </p>
      ) : s.liste.length === 0 ? (
        <p data-testid="klara-notizen-leer" className="text-[11.5px] text-muted-2">
          {s.suche.trim() ? t("klaranotiz.keinTreffer") : t("klaranotiz.leer")}
        </p>
      ) : (
        <ul className="space-y-1" data-testid="klara-notizen-liste">
          {s.liste.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                data-testid="klara-notiz-eintrag"
                data-notiz={n.id}
                data-art={n.art}
                aria-current={s.offen?.id === n.id ? "true" : undefined}
                onClick={() => void oeffneNotiz(n.id, t)}
                className="w-full rounded-btn border border-hairline bg-surface px-2 py-1.5 text-left hover:border-ink/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] font-semibold text-text">{n.titel}</span>
                  {n.art === "arbeitszettel" ? (
                    <span className={`${SCHILD} bg-trust-warn-bg text-trust-warn-text`}>
                      {t("klaranotiz.art.arbeitszettel", { n: n.offeneFragen.length })}
                    </span>
                  ) : null}
                </span>
                <span className="block text-[11px] text-muted">
                  {n.objektbezug.seitenName} · {n.objektbezug.objekt} ·{" "}
                  {formatKoTimestamp(n.geaendertAm, i18n.language) ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
