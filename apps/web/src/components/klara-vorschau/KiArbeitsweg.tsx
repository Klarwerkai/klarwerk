// ================================================================================================
// BPA-13 (produkt:20261011:assistenz-ki-arbeitsbegleitung) — MIT EINER AUSGEWÄHLTEN KI ARBEITEN.
// ================================================================================================
//
// Die Fläche am eigenen Klara-Gespräch: Auftrag vorbereiten, den gewählten Weg nutzen (Prompt
// übergeben, direkt über die Schnittstelle, Codex), Ergebnis zurückgeben, unterbrechen,
// wiederaufnehmen, stoppen und — wenn Rechte oder Freigaben sich geändert haben — neu binden.
//
// SIE ENTSCHEIDET NICHTS. Welche Quellen hinaus dürfen, ob der Weg offen ist, welcher Anbieter
// wirklich rechnet und ob ein Paket noch übergeben werden darf, sagt der Server; die Fläche zeigt
// seine Sätze und Zustände. Den Prompt zeigt sie nur, wenn der Server ihn mitschickt — und das tut
// er nur, solange die frische Prüfung des Pakets trägt.
import { useCallback, useEffect, useState } from "react";
import {
  type KiAuftragSicht,
  type KiErgebnisformat,
  type KiFaehigkeit,
  type KiFaehigkeiten,
  kiArbeitswegApi,
} from "../../api/kiArbeitsweg";
import type { KlaraObjektbezug } from "../../api/klaraGespraech";
import { useAssistenzT } from "../../lib/assistenzProfil";
import {
  beendeKiUebergabe,
  beginneKiUebergabe,
  kiAuftraegeVon,
  ladeKiAuftraege,
  leseKiAuftraege,
  meldeKiAuftraege,
  useKiAuftraege,
} from "./kiAuftraege";

const KNOPF =
  "inline-flex h-8 items-center gap-1 rounded-btn border border-hairline bg-surface px-2.5 text-[12px] font-semibold text-text hover:border-ink/30 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const KNOPF_KI =
  "inline-flex h-8 items-center rounded-btn border border-ai bg-ai-surface-2 px-2.5 text-[12px] font-semibold text-ai hover:bg-ai-surface-1 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const FELD =
  "w-full rounded-btn border border-hairline bg-surface px-2 py-1 text-[12px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const KLEINTITEL = "font-mono text-[9.5px] font-semibold uppercase tracking-wider text-muted-2";
const FORMATE: readonly KiErgebnisformat[] = [
  "stichpunkte",
  "fliesstext",
  "tabelle",
  "code_aenderung",
];

function meldung(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : String(fehler);
}

function AuftragKarte({
  gespraechId,
  a,
  onNeu,
  onHinweis,
}: {
  gespraechId: string;
  a: KiAuftragSicht;
  onNeu: (a: KiAuftragSicht) => void;
  onHinweis: (text: string) => void;
}): JSX.Element {
  const { t } = useAssistenzT();
  const [erneut, setErneut] = useState(false);
  const [ergebnis, setErgebnis] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  // Nacharbeit 38 (UI-MIN-06/14): eine ausstehende Übergabe ist ein EIGENER Zustand. Sie sperrt
  // nur ein zweites Übergeben — Unterbrechen und Stoppen bleiben währenddessen bedienbar.
  const [uebergabeLaeuft, setUebergabeLaeuft] = useState(false);
  const job = a.job;

  const tue = async (schritt: () => Promise<KiAuftragSicht>) => {
    setLaeuft(true);
    try {
      onNeu(await schritt());
    } catch (fehler) {
      onHinweis(meldung(fehler));
    } finally {
      setLaeuft(false);
    }
  };
  const uebergeben = async () => {
    setUebergabeLaeuft(true);
    // Die Assistenz liest während der Übergabe den Serverstand nach (Sendestand steht dort zuerst).
    beginneKiUebergabe(gespraechId);
    try {
      const r = await kiArbeitswegApi.uebergib(gespraechId, job.jobId, erneut);
      onHinweis(r.text);
      onNeu(r.sicht);
    } catch (fehler) {
      onHinweis(meldung(fehler));
    } finally {
      beendeKiUebergabe(gespraechId);
      setUebergabeLaeuft(false);
      // Wurde während der Übergabe gestoppt oder unterbrochen, ist ihre Antwort schon veraltet: der
      // Stand kommt deshalb danach noch einmal vom Server.
      void ladeKiAuftraege(gespraechId);
    }
  };

  const wiederaufnehmbar = job.status === "unterbrochen" || job.status === "fehler";
  const offen = job.status !== "gestoppt" && job.status !== "ersetzt";
  const manuell = job.faehigkeit !== "api";

  return (
    <li
      data-testid="ki-auftrag"
      data-status={job.status}
      data-paket-aktuell={a.paketAktuell}
      className="rounded-card border border-hairline bg-page px-2.5 py-2"
    >
      <p className="text-[12px] font-semibold text-ink">{a.auftrag.ziel}</p>
      <p data-testid="ki-auftrag-status" className="text-[11px] text-muted">
        {t("kiarbeitsweg.status", {
          status: t(`kiarbeitsweg.status.${job.status}`),
          anbieter: t(`kiarbeitsweg.anbieter.${job.anbieter}`),
          weg: t(`kiarbeitsweg.weg.${job.faehigkeit}`),
          sendungen: job.sendungen,
        })}
      </p>
      {a.ausgelassen.map((x) => (
        <p
          key={`${x.quelleId}-${x.abschnittId ?? ""}`}
          data-testid="ki-auftrag-ausgelassen"
          className="text-[11px] text-muted-2"
        >
          {t("kiarbeitsweg.ausgelassen", { quelle: x.titel || x.quelleId, grund: x.grund })}
        </p>
      ))}
      {!a.paketAktuell ? (
        <p
          role="alert"
          data-testid="ki-auftrag-paket-veraltet"
          className="mt-1 rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] text-trust-warn-text"
        >
          {t("kiarbeitsweg.paketVeraltet")}
        </p>
      ) : null}
      {a.wegGesperrt !== null ? (
        <p
          data-testid="ki-auftrag-weg-gesperrt"
          className="mt-1 rounded-btn bg-trust-crit-bg px-2 py-1 text-[11.5px] text-trust-crit-text"
        >
          {a.wegGesperrt}
        </p>
      ) : null}
      {a.inhalteZurueckgehalten ? (
        <p
          data-testid="ki-auftrag-zurueckgehalten"
          className="mt-1 rounded-btn bg-trust-warn-bg px-2 py-1 text-[11.5px] text-trust-warn-text"
        >
          {t("kiarbeitsweg.zurueckgehalten")}
        </p>
      ) : null}
      {a.prompt !== null ? (
        <label className="mt-1 block text-[11px] text-muted">
          {t("kiarbeitsweg.prompt")}
          <textarea
            data-testid="ki-auftrag-prompt"
            readOnly
            value={a.prompt}
            rows={5}
            className={`${FELD} mt-0.5 font-mono`}
          />
        </label>
      ) : null}

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {job.status === "vorbereitet" || wiederaufnehmbar ? (
          <button
            type="button"
            data-testid="ki-auftrag-uebergeben"
            disabled={laeuft || uebergabeLaeuft || !a.paketAktuell || a.wegGesperrt !== null}
            onClick={() => void uebergeben()}
            className={KNOPF_KI}
          >
            {job.status === "vorbereitet"
              ? t("kiarbeitsweg.uebergeben")
              : t("kiarbeitsweg.wiederaufnehmen")}
          </button>
        ) : null}
        {offen && job.status !== "antwort_erhalten" ? (
          <button
            type="button"
            data-testid="ki-auftrag-unterbrechen"
            disabled={laeuft}
            onClick={() =>
              void tue(
                async () => (await kiArbeitswegApi.unterbrich(gespraechId, job.jobId)).auftrag,
              )
            }
            className={KNOPF}
          >
            {t("kiarbeitsweg.unterbrechen")}
          </button>
        ) : null}
        {offen ? (
          <button
            type="button"
            data-testid="ki-auftrag-stoppen"
            disabled={laeuft}
            onClick={() =>
              void tue(async () => {
                const r = await kiArbeitswegApi.stoppe(gespraechId, job.jobId);
                onHinweis(r.text);
                return r.auftrag;
              })
            }
            className={KNOPF}
          >
            {t("kiarbeitsweg.stoppen")}
          </button>
        ) : null}
        {!a.paketAktuell && offen ? (
          <button
            type="button"
            data-testid="ki-auftrag-neu-binden"
            disabled={laeuft}
            onClick={() =>
              void tue(async () => (await kiArbeitswegApi.bindeNeu(gespraechId, job.jobId)).auftrag)
            }
            className={KNOPF}
          >
            {t("kiarbeitsweg.neuBinden")}
          </button>
        ) : null}
      </div>
      {wiederaufnehmbar && job.sendungen > 0 ? (
        <label className="mt-1 flex items-center gap-1.5 text-[11px] text-text">
          <input
            type="checkbox"
            data-testid="ki-auftrag-erneut"
            checked={erneut}
            onChange={(e) => setErneut(e.target.checked)}
          />
          {t("kiarbeitsweg.erneutBestaetigen")}
        </label>
      ) : null}
      {offen
        ? a.freigegebeneQuellen.map((q) => (
            <button
              key={q}
              type="button"
              data-testid="ki-auftrag-freigabe-schliessen"
              disabled={laeuft}
              onClick={() =>
                void tue(
                  async () =>
                    (await kiArbeitswegApi.schliesseFreigabe(gespraechId, job.jobId, q)).auftrag,
                )
              }
              className={`${KNOPF} mt-1`}
            >
              {t("kiarbeitsweg.freigabeSchliessen", { quelle: q })}
            </button>
          ))
        : null}

      {manuell && job.sendungen > 0 && offen ? (
        <div className="mt-1.5">
          <label className="block text-[11px] text-muted">
            {t("kiarbeitsweg.ergebnis")}
            <textarea
              data-testid="ki-auftrag-ergebnis"
              value={ergebnis}
              rows={3}
              onChange={(e) => setErgebnis(e.target.value)}
              className={`${FELD} mt-0.5`}
            />
          </label>
          <button
            type="button"
            data-testid="ki-auftrag-ergebnis-speichern"
            disabled={laeuft || ergebnis.trim().length === 0}
            onClick={() =>
              void tue(async () => {
                const r = await kiArbeitswegApi.ergebnis(
                  gespraechId,
                  job.jobId,
                  ergebnis,
                  job.anbieter,
                );
                setErgebnis("");
                return r.auftrag;
              })
            }
            className={`${KNOPF} mt-1`}
          >
            {t("kiarbeitsweg.ergebnisSpeichern")}
          </button>
        </div>
      ) : null}

      {a.antworten.map((x) => (
        <div
          key={x.am}
          data-testid="ki-auftrag-antwort"
          data-anwendbar={x.anwendbar}
          className="mt-1.5"
        >
          <p className={KLEINTITEL}>{t("kiarbeitsweg.antwort", { anbieter: x.anbieter })}</p>
          {x.inhalt !== null ? (
            <p className="whitespace-pre-wrap text-[12px] text-text">{x.inhalt}</p>
          ) : null}
          {!x.anwendbar ? (
            <p className="text-[11px] font-semibold text-trust-warn-text">
              {x.hinweis ?? t("kiarbeitsweg.nichtAnwendbar")}
            </p>
          ) : null}
        </div>
      ))}
      {a.belege.map((b) => (
        <p
          key={`${b.am}-${b.klasse}`}
          data-testid="ki-auftrag-beleg"
          data-klasse={b.klasse}
          className="text-[10.5px] text-muted-2"
        >
          {t("kiarbeitsweg.beleg", { text: b.text })}
        </p>
      ))}
    </li>
  );
}

export function KiArbeitsweg({
  gespraechId,
  kontext,
}: {
  gespraechId: string;
  kontext: KlaraObjektbezug;
}): JSX.Element {
  const { t } = useAssistenzT();
  const [lage, setLage] = useState<KiFaehigkeiten | null>(null);
  // Beim Öffnen mit dem gemeinsamen Stand dieses Gesprächs beginnen — nie mit einer leeren Liste, die
  // den gemeinsamen Bestand bis zur Antwort des Servers überschriebe.
  const [auftraege, setAuftraege] = useState<KiAuftragSicht[]>(() => {
    return kiAuftraegeVon(leseKiAuftraege(), gespraechId);
  });
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [ziel, setZiel] = useState("");
  const [format, setFormat] = useState<KiErgebnisformat>("stichpunkte");
  const [anbieter, setAnbieter] = useState("");
  const [weg, setWeg] = useState<KiFaehigkeit>("prompt_manuell");
  const [seiteFreigeben, setSeiteFreigeben] = useState(false);
  const [weitere, setWeitere] = useState("");
  const [weitereFreigeben, setWeitereFreigeben] = useState(false);
  const [offenePunkte, setOffenePunkte] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const lade = useCallback(async () => {
    try {
      const [f, l] = await Promise.all([
        kiArbeitswegApi.faehigkeiten(),
        kiArbeitswegApi.liste(gespraechId),
      ]);
      setLage(f);
      setAuftraege(l.auftraege);
      setAnbieter((alt) => alt || (f.lage.erlaubteAnbieter[0] ?? ""));
      setLadefehler(null);
    } catch (fehler) {
      setLadefehler(meldung(fehler));
    }
  }, [gespraechId]);

  useEffect(() => {
    void lade();
  }, [lade]);

  // produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-06/14): der Bestand gilt für die
  // ganze Assistenz — die Fläche meldet ihn, und ein Stand von außen (Stopp aus der Vorgangsleiste
  // oder an der eingeklappten Figur) wird hier übernommen, statt einen veralteten zu zeigen.
  const gemeinsam = useKiAuftraege();
  useEffect(() => {
    meldeKiAuftraege(gespraechId, auftraege);
  }, [gespraechId, auftraege]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur ein Stand von außen löst aus.
  useEffect(() => {
    const vonAussen = gemeinsam.proGespraech[gespraechId];
    if (vonAussen && vonAussen !== auftraege) {
      setAuftraege(vonAussen);
    }
  }, [gemeinsam]);

  const ersetze = (neu: KiAuftragSicht) =>
    setAuftraege((alt) => {
      const ohne = alt.filter((x) => x.job.jobId !== neu.job.jobId);
      return [...ohne, neu];
    });

  const bereite = async () => {
    setLaeuft(true);
    setHinweis(null);
    try {
      const weitereIds = weitere
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      const quellen = [...(kontext.koId ? [kontext.koId] : []), ...weitereIds];
      const freigegeben = [
        ...(kontext.koId && seiteFreigeben ? [kontext.koId] : []),
        ...(weitereFreigeben ? weitereIds : []),
      ];
      const r = await kiArbeitswegApi.bereite(gespraechId, {
        ziel,
        ergebnisformat: format,
        offenePunkte: offenePunkte
          .split("\n")
          .map((x) => x.trim())
          .filter((x) => x.length > 0),
        anbieter,
        faehigkeit: weg,
        quellen: [...new Set(quellen)],
        freigegebeneQuellen: [...new Set(freigegeben)],
      });
      ersetze(r.auftrag);
      // Ein neu gebundener Auftrag ersetzt den alten — den Bestand frisch vom Server holen.
      void lade();
    } catch (fehler) {
      setHinweis(meldung(fehler));
    } finally {
      setLaeuft(false);
    }
  };

  if (ladefehler !== null) {
    return (
      <p data-testid="ki-arbeitsweg-fehler" className="text-[11.5px] text-trust-crit-text">
        {t("kiarbeitsweg.fehler", { grund: ladefehler })}
      </p>
    );
  }
  if (lage === null) {
    return (
      <p data-testid="ki-arbeitsweg-laden" className="text-[11.5px] text-muted-2">
        {t("kiarbeitsweg.laden")}
      </p>
    );
  }
  const gesperrt = lage.lage.keineKi || !lage.lage.oeffentlicheKiFreigegeben;

  return (
    <section
      data-testid="ki-arbeitsweg"
      aria-label={t("kiarbeitsweg.titel")}
      className="space-y-1.5 rounded-card border border-hairline bg-surface px-3 py-2.5"
    >
      <h3 className="text-[12px] font-semibold text-ink">{t("kiarbeitsweg.titel")}</h3>
      <p className="text-[11.5px] leading-relaxed text-text">{t("kiarbeitsweg.hinweis")}</p>
      {lage.lage.keineKi ? (
        <p data-testid="ki-arbeitsweg-keine-ki" className="text-[11.5px] text-trust-crit-text">
          {t("kiarbeitsweg.keineKi")}
        </p>
      ) : !lage.lage.oeffentlicheKiFreigegeben ? (
        <p data-testid="ki-arbeitsweg-nicht-frei" className="text-[11.5px] text-trust-crit-text">
          {t("kiarbeitsweg.nichtFreigegeben")}
        </p>
      ) : null}

      <div data-testid="ki-arbeitsweg-faehigkeiten">
        <p className={KLEINTITEL}>{t("kiarbeitsweg.faehigkeiten")}</p>
        <ul className="mt-0.5 space-y-0.5">
          {lage.faehigkeiten.map((f) => (
            <li
              key={f.faehigkeit}
              data-faehigkeit={f.faehigkeit}
              data-status={f.status}
              className="text-[11px] text-text"
            >
              {f.text}
            </li>
          ))}
          <li data-testid="ki-arbeitsweg-mcp" className="text-[11px] text-muted">
            {lage.mcpText}
          </li>
        </ul>
      </div>

      {!gesperrt ? (
        <div className="space-y-1">
          <label className="block text-[11px] text-muted">
            {t("kiarbeitsweg.ziel")}
            <textarea
              data-testid="ki-arbeitsweg-ziel"
              value={ziel}
              rows={2}
              onChange={(e) => setZiel(e.target.value)}
              className={`${FELD} mt-0.5`}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="text-[11px] text-muted">
              {t("kiarbeitsweg.format")}
              <select
                data-testid="ki-arbeitsweg-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as KiErgebnisformat)}
                className={FELD}
              >
                {FORMATE.map((f) => (
                  <option key={f} value={f}>
                    {t(`kiarbeitsweg.format.${f}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-muted">
              {t("kiarbeitsweg.anbieter")}
              <select
                data-testid="ki-arbeitsweg-anbieter"
                value={anbieter}
                onChange={(e) => setAnbieter(e.target.value)}
                className={FELD}
              >
                {lage.lage.erlaubteAnbieter.map((a) => (
                  <option key={a} value={a}>
                    {t(`kiarbeitsweg.anbieter.${a}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-muted">
              {t("kiarbeitsweg.weg")}
              <select
                data-testid="ki-arbeitsweg-weg"
                value={weg}
                onChange={(e) => setWeg(e.target.value as KiFaehigkeit)}
                className={FELD}
              >
                {lage.faehigkeiten.map((f) => (
                  <option key={f.faehigkeit} value={f.faehigkeit}>
                    {t(`kiarbeitsweg.weg.${f.faehigkeit}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {kontext.koId ? (
            <label className="flex items-center gap-1.5 text-[11px] text-text">
              <input
                type="checkbox"
                data-testid="ki-arbeitsweg-seite-freigeben"
                checked={seiteFreigeben}
                onChange={(e) => setSeiteFreigeben(e.target.checked)}
              />
              <span>{t("kiarbeitsweg.quelleSeite", { koId: kontext.koId })}</span>
              <span className="font-semibold">{t("kiarbeitsweg.quelleFreigeben")}</span>
            </label>
          ) : null}
          <label className="block text-[11px] text-muted">
            {t("kiarbeitsweg.weitereQuellen")}
            <input
              data-testid="ki-arbeitsweg-weitere"
              value={weitere}
              onChange={(e) => setWeitere(e.target.value)}
              className={`${FELD} mt-0.5`}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-text">
            <input
              type="checkbox"
              data-testid="ki-arbeitsweg-weitere-freigeben"
              checked={weitereFreigeben}
              onChange={(e) => setWeitereFreigeben(e.target.checked)}
            />
            {t("kiarbeitsweg.weitereFreigeben")}
          </label>
          <label className="block text-[11px] text-muted">
            {t("kiarbeitsweg.offen")}
            <textarea
              data-testid="ki-arbeitsweg-offen"
              value={offenePunkte}
              rows={2}
              onChange={(e) => setOffenePunkte(e.target.value)}
              className={`${FELD} mt-0.5`}
            />
          </label>
          <button
            type="button"
            data-testid="ki-arbeitsweg-vorbereiten"
            disabled={laeuft || ziel.trim().length === 0 || anbieter.length === 0}
            onClick={() => void bereite()}
            className={KNOPF_KI}
          >
            {t("kiarbeitsweg.vorbereiten")}
          </button>
        </div>
      ) : null}

      {hinweis ? (
        <output
          data-testid="ki-arbeitsweg-hinweis"
          className="block rounded-btn bg-ai-surface-2 px-2 py-1 text-[11.5px] text-text"
        >
          {hinweis}
        </output>
      ) : null}

      <div>
        <p className={KLEINTITEL}>{t("kiarbeitsweg.auftraege")}</p>
        {auftraege.length === 0 ? (
          <p data-testid="ki-arbeitsweg-leer" className="text-[11.5px] text-muted-2">
            {t("kiarbeitsweg.leer")}
          </p>
        ) : (
          <ol className="mt-1 space-y-2">
            {auftraege.map((a) => (
              <AuftragKarte
                key={a.job.jobId}
                gespraechId={gespraechId}
                a={a}
                onNeu={(neu) => {
                  ersetze(neu);
                }}
                onHinweis={setHinweis}
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
