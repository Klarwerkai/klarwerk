import { useEffect, useRef, useState } from "react";
import { alsDatenUrl } from "../../api/besprechungen";
import { api } from "../../api/client";
import { klaraFristenApi, type FristenStand } from "../../api/klaraFristen";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { ladeAufgaben } from "./aufgaben";
import { ladeNotizen, oeffneNotiz } from "./notizen";
const feld = "block w-full rounded-input border border-hairline bg-surface px-2 py-1 text-sm";
const knopf = "rounded-btn border border-hairline px-3 py-1 text-sm disabled:opacity-40";
const basis = "/me/klara/besprechungen";
interface Ergebnis {
  id: string;
  art: string;
  text: string;
  unsicher: boolean;
  ueberlappend: boolean;
  quelle: {
    startMs: number | null;
    endMs: number | null;
    zeile: number;
    transkriptFassung: number;
  };
}
export function KlaraBesprechungsImport() {
  const { t } = useAssistenzT();
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [vtt, setVtt] = useState("");
  const [datum, setDatum] = useState("");
  const [zone, setZone] = useState("");
  const [berechtigt, setBerechtigt] = useState(false);
  const [transkription, setTranskription] = useState(false);
  const [audio, setAudio] = useState<File | null>(null);
  const [audioId, setAudioId] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  return (
    <details data-testid="besprechung-import">
      <summary>{t("klarabesprechung.import")}</summary>
      <p>{t("klarabesprechung.hilfe")}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setFehler("");
          setLaeuft(true);
          void (async () => {
            let id = audioId;
            if (audio && !id) {
              id = (
                await api.post<{ id: string }>("/objects", {
                  name: audio.name,
                  mime: audio.type,
                  kind: "video",
                  purpose: "klara_audio",
                  data: await alsDatenUrl(audio),
                })
              ).id;
              setAudioId(id);
            }
            const r = await api.post<{ notiz: { id: string } }>(`${basis}/import`, {
              titel,
              text,
              ...(vtt ? { vtt } : {}),
              ...(id ? { audioId: id } : {}),
              meetingDatum: datum || null,
              zeitzone: zone || null,
              berechtigt,
              transkription,
            });
            await ladeNotizen(t);
            await oeffneNotiz(r.notiz.id, t);
          })()
            .catch((e) => setFehler(e.message))
            .finally(() => setLaeuft(false));
        }}
      >
        <label>
          {t("klarawissen.titel")}
          <input
            className={feld}
            data-testid="besprechung-import-titel"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            required
          />
        </label>
        <label>
          {t("klarabesprechung.text")}
          <textarea
            className={feld}
            data-testid="besprechung-import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={20000}
          />
        </label>
        <label>
          {t("klarabesprechung.vtt")}
          <input
            type="file"
            accept=".vtt,text/vtt"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void f.text().then(setVtt);
            }}
          />
        </label>
        <label>
          {t("klarabesprechung.audio")}
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              setAudio(e.target.files?.[0] ?? null);
              setAudioId(null);
            }}
          />
        </label>
        <label>
          {t("klarabesprechung.datum")}
          <input
            className={feld}
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            placeholder="2026-10-20T10:00:00+02:00"
          />
        </label>
        <label>
          {t("klarabesprechung.zone")}
          <input
            className={feld}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Europe/Berlin"
          />
        </label>
        <label>
          <input
            data-testid="besprechung-berechtigt"
            type="checkbox"
            checked={berechtigt}
            onChange={(e) => setBerechtigt(e.target.checked)}
          />
          {t("klarabesprechung.berechtigt")}
        </label>
        {audio && !vtt ? (
          <label>
            <input
              type="checkbox"
              checked={transkription}
              onChange={(e) => setTranskription(e.target.checked)}
            />
            {t("klarabesprechung.transkription")}
          </label>
        ) : null}
        <button
          className={knopf}
          data-testid="besprechung-import-speichern"
          type="submit"
          disabled={
            !berechtigt ||
            !titel ||
            (!text && !vtt && !audio) ||
            (!!audio && !vtt && !transkription) ||
            laeuft
          }
        >
          {t("klarawissen.privatSpeichern")}
        </button>
        {fehler ? <p role="alert">{fehler}</p> : null}
      </form>
    </details>
  );
}
export function KlaraBesprechungsAuswertung({ id, fassung }: { id: string; fassung: number }) {
  const { t } = useAssistenzT();
  const [ergebnisse, setErgebnisse] = useState<Ergebnis[]>([]);
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [eigene, setEigene] = useState(false);
  const [fehler, setFehler] = useState("");
  const [korrektur, setKorrektur] = useState<Record<string, string>>({});
  const [audioVorhanden, setAudioVorhanden] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [fristquelle, setFristquelle] = useState<string | null>(null);
  const [fristen, setFristen] = useState<FristenStand | null>(null);
  useEffect(() => {
    let aktiv = true;
    void api
      .post<{
        ergebnisse: Ergebnis[];
        notiz: { wissensHerkunft: { besprechung: { audioId: string | null } } };
      }>(`${basis}/${encodeURIComponent(id)}/lesen`, {})
      .then((r) => {
        if (aktiv) {
          setErgebnisse(r.ergebnisse);
          setAudioVorhanden(!!r.notiz.wissensHerkunft.besprechung.audioId);
        }
      })
      .catch((e) => {
        if (aktiv) setFehler(e.message);
      });
    return () => {
      aktiv = false;
    };
  }, [id]);
  const tun = async (fn: () => Promise<void>) => {
    setLaeuft(true);
    setFehler("");
    try {
      await fn();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <section data-testid="besprechung-auswertung">
      <h5>{t("klarabesprechung.auswertung")}</h5>
      <p>{t("klarabesprechung.kennzeichnung")}</p>
      {audioVorhanden ? (
        <audio ref={audio} controls src={`/api${basis}/${encodeURIComponent(id)}/audio`}>
          <track kind="captions" />
        </audio>
      ) : null}
      <ul>
        {ergebnisse.map((a) => (
          <li key={a.id} className="my-2 border-b border-hairline">
            <label>
              <input
                type="checkbox"
                data-testid={`besprechung-auswahl-${a.id}`}
                checked={auswahl.includes(a.id)}
                onChange={(e) =>
                  setAuswahl(
                    e.target.checked ? [...auswahl, a.id] : auswahl.filter((id) => id !== a.id),
                  )
                }
              />
              {t(`klarabesprechung.art.${a.art}`)}: {a.text}
            </label>
            <p>
              {t("klarabesprechung.quelle", { fassung: a.quelle.transkriptFassung })} ·{" "}
              {a.quelle.startMs === null
                ? t("klarabesprechung.zeile", { nr: a.quelle.zeile })
                : t("klarabesprechung.zeit", { von: a.quelle.startMs, bis: a.quelle.endMs })}
              {a.unsicher || a.ueberlappend ? ` · ${t("klarabesprechung.unsicher")}` : ""}
            </p>
            {audioVorhanden && a.quelle.startMs !== null ? (
              <button
                className={knopf}
                type="button"
                onClick={() => {
                  if (audio.current) {
                    audio.current.currentTime = (a.quelle.startMs ?? 0) / 1000;
                    void audio.current
                      .play()
                      .catch(() => setFehler(t("klarabesprechung.wiedergabeFehler")));
                  }
                }}
              >
                {t("klarabesprechung.anhoeren")}
              </button>
            ) : null}
            <label>
              {t("klarabesprechung.korrektur")}
              <textarea
                className={feld}
                value={korrektur[a.id] ?? a.text}
                onChange={(e) => setKorrektur({ ...korrektur, [a.id]: e.target.value })}
              />
            </label>
            <button
              className={knopf}
              type="button"
              disabled={laeuft || !korrektur[a.id] || korrektur[a.id] === a.text}
              onClick={() =>
                void tun(async () => {
                  const r = await api.post<{ notiz: { id: string } }>(
                    `${basis}/${encodeURIComponent(id)}/korrektur`,
                    { fassung, segmentId: a.id, text: korrektur[a.id] },
                  );
                  await ladeNotizen(t);
                  await oeffneNotiz(r.notiz.id, t);
                })
              }
            >
              {t("klarabesprechung.korrekturSpeichern")}
            </button>
          </li>
        ))}
      </ul>
      <label>
        <input
          type="checkbox"
          data-testid="besprechung-eigene"
          checked={eigene}
          onChange={(e) => setEigene(e.target.checked)}
        />
        {t("klarabesprechung.eigene")}
      </label>
      <p>{t("klarabesprechung.fristen")}</p>
      <button
        className={knopf}
        type="button"
        data-testid="besprechung-fristquelle"
        disabled={!auswahl.length || laeuft}
        onClick={() =>
          void tun(async () => {
            const q = await api.post<{ notizId: string }>(
              `${basis}/${encodeURIComponent(id)}/fristquelle`,
              { fassung, auswahl, bewusst: true },
            );
            setFristquelle(q.notizId);
            await ladeNotizen(t);
            const stand = await klaraFristenApi.lesen();
            if (!stand.regel?.aktiv) {
              setFristen(stand);
              return;
            }
            const vorhanden = stand.regel.quellen.some(
              (s) => s.art === "notiz" && s.id === q.notizId,
            );
            setFristen(
              vorhanden
                ? await klaraFristenApi.aktualisieren()
                : await klaraFristenApi.speichern(
                    {
                      ...stand.regel,
                      quellen: [...stand.regel.quellen, { art: "notiz", id: q.notizId }],
                    },
                    stand.fassung,
                  ),
            );
          })
        }
      >
        {t("klarabesprechung.fristquelle")}
      </button>
      {fristquelle ? (
        <div data-testid="besprechung-friststand">
          <p>
            {t(
              !fristen
                ? "klarabesprechung.fristNurQuelle"
                : fristen.regel?.aktiv
                  ? "klarabesprechung.fristGespeichert"
                  : "klarabesprechung.fristRegelNoetig",
            )}
          </p>
          <button type="button" className={knopf} onClick={() => void oeffneNotiz(fristquelle, t)}>
            {t("klarafristen.original")}
          </button>
          <a className="underline" href="/kalender#fristen-aus-informationen">
            {t("klarabesprechung.fristenOeffnen")}
          </a>
          <ul>
            {fristen?.fristen
              .filter((f) =>
                f.herkunft.some(
                  (h) => h.beleg.quelle.art === "notiz" && h.beleg.quelle.id === fristquelle,
                ),
              )
              .map((f) => (
                <li key={f.id}>
                  <a href={`/kalender#frist-${f.id}`}>
                    {f.objekt.art} {f.objekt.kennung} · {t(`klarafristen.art.${f.art}`)} ·{" "}
                    {t(`klarafristen.stand.${f.stand}`)} {f.datum?.datum ?? ""}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      <button
        data-testid="besprechung-uebernehmen"
        type="button"
        className={knopf}
        disabled={!auswahl.length || laeuft}
        onClick={() =>
          void tun(async () => {
            const r = await api.post<{ notizId: string }>(
              `${basis}/${encodeURIComponent(id)}/uebernehmen`,
              { fassung, auswahl, eigeneAufgaben: eigene, bewusst: true },
            );
            await ladeNotizen(t);
            await ladeAufgaben(t);
            await oeffneNotiz(r.notizId, t);
          })
        }
      >
        {t("klarabesprechung.uebernehmen")}
      </button>
      {fehler ? <p role="alert">{fehler}</p> : null}
    </section>
  );
}
