import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { type GedaechtnisEintrag, gedaechtnisApi } from "../../api/gedaechtnis";
import { useSession } from "../../app/AuthContext";
import { gedaechtnisSchluessel, useGedaechtnis } from "../../lib/gedaechtnis";
import { KlaraGruppe } from "./KlaraSetup";

const KNOPF =
  "rounded-btn border border-hairline px-2 py-1 text-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40";
const FELD = "w-full rounded-btn border border-hairline bg-surface p-2 text-[13px] text-text";

function Eintrag({
  e,
  fristen,
  speichern,
  loeschen,
  gesperrt,
}: {
  e: GedaechtnisEintrag;
  fristen: number[];
  gesperrt: boolean;
  speichern: (
    e: GedaechtnisEintrag,
    text: string,
    tage: number,
    darstellung: GedaechtnisEintrag["darstellung"],
    ausnahme: { bis: string; begruendung: string } | null,
  ) => void;
  loeschen: (e: GedaechtnisEintrag) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [text, setText] = useState(e.inhalt);
  const [mitAusnahme, setMitAusnahme] = useState(Boolean(e.aufbewahrungAusnahme));
  const [ausnahmeBis, setAusnahmeBis] = useState(e.aufbewahrungAusnahme?.bis.slice(0, 16) ?? "");
  const [begruendung, setBegruendung] = useState(e.aufbewahrungAusnahme?.begruendung ?? "");
  const [ungueltig, setUngueltig] = useState(false);
  const speichernMitAusnahme = (): void => {
    const ende = Date.parse(`${ausnahmeBis}Z`);
    if (mitAusnahme && (!begruendung.trim() || !Number.isFinite(ende))) {
      setUngueltig(true);
      return;
    }
    setUngueltig(false);
    speichern(
      e,
      text,
      tage,
      darstellung,
      mitAusnahme ? { bis: new Date(ende).toISOString(), begruendung } : null,
    );
  };
  const [tage, setTage] = useState(e.aufbewahrungTage);
  const [darstellung, setDarstellung] = useState(e.darstellung);
  return (
    <li
      className="space-y-2 rounded-card border border-hairline p-3"
      data-testid="gedaechtnis-eintrag"
    >
      <p className="text-[12px] text-muted">
        {t("klaragedaechtnis.herkunft", {
          art:
            e.herkunft.art === "antwort"
              ? t("klaragedaechtnis.antwort", { id: e.herkunft.antwortId })
              : t("klaragedaechtnis.eigene_eingabe"),
          am: new Date(e.angelegtAm).toLocaleString(i18n.language),
          bis: new Date(e.verfallAm).toLocaleString(i18n.language),
          vertraulichkeit: e.vertraulichkeit,
        })}
      </p>
      <label className="block text-[12px]">
        {t("klaragedaechtnis.inhalt")}
        <textarea
          className={FELD}
          value={text}
          maxLength={2000}
          onChange={(ev) => setText(ev.target.value)}
        />
      </label>
      {e.antwort ? <p className="whitespace-pre-wrap text-[12px]">{e.antwort}</p> : null}
      <label className="block text-[12px]">
        {t("klaragedaechtnis.frist")}
        <select className={FELD} value={tage} onChange={(ev) => setTage(Number(ev.target.value))}>
          {fristen.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {e.art === "vorliebe" ? (
        <label className="block text-[12px]">
          {t("klaragedaechtnis.darstellung")}
          <select
            className={FELD}
            value={darstellung ?? ""}
            onChange={(ev) => setDarstellung((ev.target.value || null) as typeof darstellung)}
          >
            <option value="">{t("klaragedaechtnis.neutral")}</option>
            <option value="kurz">{t("klaragedaechtnis.kurz")}</option>
            <option value="ausfuehrlich">{t("klaragedaechtnis.lang")}</option>
          </select>
        </label>
      ) : null}
      <fieldset
        className="space-y-2 rounded border border-hairline p-2"
        data-testid="gedaechtnis-ausnahme"
      >
        <legend>{t("klaragedaechtnis.ausnahmeTitel")}</legend>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={mitAusnahme}
            onChange={(ev) => setMitAusnahme(ev.target.checked)}
          />
          {t("klaragedaechtnis.ausnahmeAn")}
        </label>
        <p className="text-[12px] text-muted">{t("klaragedaechtnis.ausnahmeHilfe")}</p>
        {mitAusnahme ? (
          <>
            <label className="block">
              {t("klaragedaechtnis.ausnahmeBis")}
              <input
                className={FELD}
                type="datetime-local"
                value={ausnahmeBis}
                onChange={(ev) => setAusnahmeBis(ev.target.value)}
              />
            </label>
            <label className="block">
              {t("klaragedaechtnis.ausnahmeGrund")}
              <textarea
                className={FELD}
                value={begruendung}
                maxLength={500}
                onChange={(ev) => setBegruendung(ev.target.value)}
              />
            </label>
            {e.aufbewahrungAusnahme ? (
              <p className="text-[12px]">
                {t("klaragedaechtnis.ausnahmeVerantwortlich", {
                  wer: e.aufbewahrungAusnahme.verantwortlich,
                  bis: e.aufbewahrungAusnahme.bis,
                })}
              </p>
            ) : null}
          </>
        ) : null}
        {ungueltig ? <p role="alert">{t("klaragedaechtnis.ausnahmeFehler")}</p> : null}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={KNOPF}
          disabled={gesperrt || !text.trim()}
          onClick={speichernMitAusnahme}
        >
          {t("klaragedaechtnis.speichern")}
        </button>
        <button type="button" className={KNOPF} disabled={gesperrt} onClick={() => loeschen(e)}>
          {t("klaragedaechtnis.loeschen")}
        </button>
      </div>
    </li>
  );
}

function Inhalt({ kontoId }: { kontoId: string }): JSX.Element {
  const { t } = useTranslation();
  const q = useGedaechtnis();
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [tage, setTage] = useState(90);
  const [darstellung, setDarstellung] = useState<GedaechtnisEintrag["darstellung"]>(null);
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState("");
  const [fehler, setFehler] = useState(false);
  const [alle, setAlle] = useState(false);
  const fristen = q.data?.fristenTage ?? [30, 90, 365];
  const mutiere = async (aktion: () => Promise<unknown>, geloescht = false): Promise<void> => {
    setBusy(true);
    setMeldung("");
    setFehler(false);
    // Bereits angezeigte Präferenzen gelten während einer unklaren Mutation nicht weiter.
    try {
      await aktion();
      await client.invalidateQueries({ queryKey: gedaechtnisSchluessel(kontoId) });
      const neu = await q.refetch({ throwOnError: true });
      if (neu.isError) throw new Error("readback");
      setMeldung(t(geloescht ? "klaragedaechtnis.geloescht" : "klaragedaechtnis.gespeichert"));
      setAlle(false);
    } catch (e) {
      // Eine verlorene Antwort kann bereits geschrieben worden sein. Kein falscher Negativbeleg.
      await client.invalidateQueries({ queryKey: gedaechtnisSchluessel(kontoId) });
      setFehler(true);
      setMeldung(
        e instanceof ApiError && e.status === 409 ? e.message : t("klaragedaechtnis.fehler"),
      );
    } finally {
      setBusy(false);
    }
  };
  const merken = (ev: FormEvent): void => {
    ev.preventDefault();
    void mutiere(() =>
      gedaechtnisApi.merken({
        art: "vorliebe",
        inhalt: text,
        aufbewahrungTage: tage,
        ...(darstellung ? { darstellung } : {}),
      }),
    );
  };
  return (
    <KlaraGruppe titel={t("klaragedaechtnis.titel")} testId="klara-setup-gedaechtnis">
      <p className="text-[12.5px] text-muted">{t("klaragedaechtnis.hilfe")}</p>
      <p className="text-[12.5px] text-muted">{t("klaragedaechtnis.grenze")}</p>
      {q.isLoading ? <output>{t("klaragedaechtnis.laedt")}</output> : null}
      {q.isError ? <p role="alert">{t("klaragedaechtnis.fehler")}</p> : null}
      <button type="button" className={KNOPF} onClick={() => void q.refetch()} disabled={busy}>
        {t("klaragedaechtnis.laden")}
      </button>
      {q.isSuccess ? (
        <>
          {q.data.eintraege.length ? (
            <ul className="space-y-2">
              {q.data.eintraege.map((e) => (
                <Eintrag
                  key={`${e.id}:${e.fassung}`}
                  e={e}
                  fristen={fristen}
                  gesperrt={busy}
                  speichern={(e, inhalt, n, d, a) =>
                    void mutiere(() => gedaechtnisApi.aendern(e, inhalt, n, d, a))
                  }
                  loeschen={(e) => void mutiere(() => gedaechtnisApi.loeschen(e.id), true)}
                />
              ))}
            </ul>
          ) : (
            <p>{t("klaragedaechtnis.leer")}</p>
          )}
          <form onSubmit={merken} className="space-y-2">
            <label className="block text-[12px]">
              {t("klaragedaechtnis.inhalt")}
              <textarea
                data-testid="gedaechtnis-neu"
                data-tutorial-ziel="gedaechtnis-neu"
                className={FELD}
                value={text}
                maxLength={2000}
                required
                onChange={(ev) => setText(ev.target.value)}
              />
            </label>
            <label className="block text-[12px]">
              {t("klaragedaechtnis.frist")}
              <select
                className={FELD}
                value={tage}
                onChange={(ev) => setTage(Number(ev.target.value))}
              >
                {fristen.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[12px]">
              {t("klaragedaechtnis.darstellung")}
              <select
                data-testid="gedaechtnis-darstellung"
                className={FELD}
                value={darstellung ?? ""}
                onChange={(ev) => setDarstellung((ev.target.value || null) as typeof darstellung)}
              >
                <option value="">{t("klaragedaechtnis.neutral")}</option>
                <option value="kurz">{t("klaragedaechtnis.kurz")}</option>
                <option value="ausfuehrlich">{t("klaragedaechtnis.lang")}</option>
              </select>
            </label>
            <button type="submit" className={KNOPF} disabled={busy || !text.trim()}>
              {t("klaragedaechtnis.merken")}
            </button>
          </form>
          {q.data.eintraege.length ? (
            <button type="button" className={KNOPF} disabled={busy} onClick={() => setAlle(true)}>
              {t("klaragedaechtnis.alle")}
            </button>
          ) : null}
          {alle ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={KNOPF}
                disabled={busy}
                onClick={() => void mutiere(gedaechtnisApi.allesLoeschen, true)}
              >
                {t("klaragedaechtnis.bestaetigen")}
              </button>
              <button type="button" className={KNOPF} onClick={() => setAlle(false)}>
                {t("klaragedaechtnis.abbrechen")}
              </button>
            </div>
          ) : null}
          <p className="text-[12px] text-muted">
            {t(
              q.data.restoreJournalKonfiguriert
                ? "klaragedaechtnis.journal"
                : "klaragedaechtnis.ohneJournal",
            )}
          </p>
        </>
      ) : null}
      <p className="text-[12px] text-muted">{t("klaragedaechtnis.rest")}</p>
      <p role={fehler ? "alert" : "status"} className="text-[12px]">
        {meldung}
      </p>
    </KlaraGruppe>
  );
}
export function KlaraGedaechtnis(): JSX.Element | null {
  const { user } = useSession();
  return user ? <Inhalt key={user.id} kontoId={user.id} /> : null;
}
