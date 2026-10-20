import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  type WissensErgebnis,
  type WissensVorschau,
  type WissensZiel,
  klaraWissenApi,
} from "../../api/klaraWissen";
import { useSession } from "../../app/AuthContext";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { ladeNotizen, oeffneNotiz } from "./notizen";
const feld = "block w-full rounded-input border border-hairline bg-surface px-2 py-1 text-sm";
const knopf = "rounded-btn border border-hairline px-3 py-1 text-sm disabled:opacity-40";
export function KlaraWissen({
  id,
  fassung,
  geaendert,
}: { id: string; fassung: number; geaendert: boolean }) {
  const { t } = useAssistenzT();
  const { user } = useSession();
  const [offen, setOffen] = useState(false);
  const [art, setArt] = useState<"artikel" | "space">("artikel");
  const [spaces, setSpaces] = useState<{ id: string; name: string; zugang: string }[]>([]);
  const [spaceId, setSpace] = useState("");
  const [stufe, setStufe] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [bedingungen, setBedingungen] = useState("");
  const [vorlagen, setVorlagen] = useState<{ id: string; version: number; name: string }[]>([]);
  const [vorlageId, setVorlage] = useState("");
  const [v, setV] = useState<WissensVorschau | null>(null);
  const [ergebnis, setErgebnis] = useState<WissensErgebnis | null>(null);
  const [fehler, setFehler] = useState("");
  const [pruefung, setPruefung] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const aendern = (fn: () => void) => {
    fn();
    setV(null);
    setErgebnis(null);
    setPruefung("");
  };
  useEffect(() => {
    if (!offen) return;
    let aktiv = true;
    void Promise.all([
      klaraWissenApi.ziele(),
      api.get<{ vorlagen: { id: string; version: number; name: string; darfAnwenden: boolean }[] }>(
        "/vorlagen",
      ),
    ])
      .then(([z, vs]) => {
        if (aktiv) {
          setSpaces(z.spaces);
          setVorlagen(vs.vorlagen.filter((v) => v.darfAnwenden));
        }
      })
      .catch((e) => {
        if (aktiv) setFehler(String(e.message));
      });
    return () => {
      aktiv = false;
    };
  }, [offen]);
  const ziel = (): WissensZiel => ({
    art,
    ...(art === "space" ? { spaceId } : {}),
    confidentiality: stufe as WissensZiel["confidentiality"],
    type: "technik",
    category: kategorie,
    conditions: bedingungen.split("\n").filter((s) => s.trim()),
    ...(vorlagen.find((v) => v.id === vorlageId)
      ? {
          vorlage: {
            id: vorlageId,
            version: vorlagen.find((v) => v.id === vorlageId)?.version ?? 0,
          },
        }
      : {}),
  });
  const handeln = async (fn: () => Promise<void>) => {
    setLaeuft(true);
    setFehler("");
    try {
      await fn();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : String(e));
      setV(null);
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <section data-testid="klara-wissen">
      <button className={knopf} type="button" disabled={geaendert} onClick={() => setOffen(!offen)}>
        {t("klarawissen.start")}
      </button>
      {offen ? (
        <div className="mt-2 space-y-2">
          <p>{t("klarawissen.hilfe")}</p>
          <label>
            {t("klarawissen.ziel")}
            <select
              data-testid="wissen-art"
              className={feld}
              value={art}
              onChange={(e) => aendern(() => setArt(e.target.value as "artikel" | "space"))}
            >
              <option value="artikel">{t("klarawissen.artikel")}</option>
              <option value="space">{t("klarawissen.space")}</option>
            </select>
          </label>
          {art === "space" ? (
            <label>
              {t("klarawissen.space")}
              <select
                data-testid="wissen-space"
                className={feld}
                value={spaceId}
                onChange={(e) => aendern(() => setSpace(e.target.value))}
              >
                <option value="">{t("klarawissen.waehlen")}</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ·{" "}
                    {s.zugang === "alle" ? t("klarawissen.alle") : t("klarawissen.mitglieder")}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {t("klarawissen.sichtbarkeit")}
            <select
              data-testid="wissen-stufe"
              className={feld}
              value={stufe}
              onChange={(e) => aendern(() => setStufe(e.target.value))}
            >
              <option value="">{t("klarawissen.waehlen")}</option>
              {["intern", "vertraulich", "streng_vertraulich"].map((s) => (
                <option key={s} value={s}>
                  {t(`klarawissen.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("klarawissen.kategorie")}
            <input
              data-testid="wissen-kategorie"
              className={feld}
              value={kategorie}
              onChange={(e) => aendern(() => setKategorie(e.target.value))}
            />
          </label>
          <label>
            {t("klarawissen.bedingungen")}
            <textarea
              data-testid="wissen-bedingungen"
              className={feld}
              value={bedingungen}
              onChange={(e) => aendern(() => setBedingungen(e.target.value))}
            />
          </label>
          <label>
            {t("klarawissen.vorlage")}
            <select
              className={feld}
              value={vorlageId}
              onChange={(e) => aendern(() => setVorlage(e.target.value))}
            >
              <option value="">{t("klarawissen.frei")}</option>
              {vorlagen.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <button
            data-testid="wissen-vorschau"
            className={knopf}
            type="button"
            disabled={laeuft || !stufe || !kategorie || (art === "space" && !spaceId) || geaendert}
            onClick={() =>
              void handeln(async () => setV(await klaraWissenApi.vorschau(id, fassung, ziel())))
            }
          >
            {t("klarawissen.vorschau")}
          </button>
          <button
            data-testid="wissen-pruefen"
            type="button"
            className={knopf}
            disabled={laeuft}
            onClick={() =>
              void handeln(async () => {
                const p = await klaraWissenApi.pruefen(id);
                setPruefung(
                  p.ergebnis.status === "geprueft"
                    ? p.ergebnis.aussagen
                        .map((a) => t(`klarawissen.pruef.${a.zustand}`))
                        .join(" · ")
                    : t("klarawissen.offen"),
                );
              })
            }
          >
            {t("klarawissen.pruefen")}
          </button>
          {pruefung ? <output>{pruefung}</output> : null}
          {v ? (
            <div data-testid="wissen-vorschau-inhalt">
              <p className="whitespace-pre-wrap">{v.original}</p>
              <p>
                {t("klarawissen.verantwortlich")} {user?.name ?? t("klarawissen.du")} ·{" "}
                {v.space?.name ?? t("klarawissen.artikel")} · {t(`klarawissen.${stufe}`)}
              </p>
              <p>{t("klarawissen.kontoregel")}</p>
              {v.offeneFragen.map((q) => (
                <p key={q}>
                  {t("klarawissen.frage")} {q}
                </p>
              ))}
              <button
                data-testid="wissen-uebernehmen"
                type="button"
                className={knopf}
                disabled={laeuft || geaendert}
                onClick={() =>
                  void handeln(async () => setErgebnis(await klaraWissenApi.uebernehmen(v, ziel())))
                }
              >
                {t("klarawissen.uebernehmen")}
              </button>
            </div>
          ) : null}
          {ergebnis ? (
            <output data-testid="wissen-ergebnis">
              <Link to={`/wissen/${ergebnis.beitrag.id}`}>{t("klarawissen.gespeichert")}</Link> ·{" "}
              {t(`klarawissen.status.${ergebnis.beitrag.status}`)}
            </output>
          ) : null}
          {fehler ? <p role="alert">{fehler}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
export function KlaraWissensImport() {
  const { t } = useAssistenzT();
  const [inhalt, setInhalt] = useState("");
  const [titel, setTitel] = useState("");
  const [projekt, setProjekt] = useState("");
  const [abschnitt, setAbschnitt] = useState("");
  const [fassung, setFassung] = useState("");
  const [anbieter, setAnbieter] = useState("");
  const [modell, setModell] = useState("");
  const [arten, setArten] = useState<Record<number, string>>({});
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  return (
    <details data-testid="wissen-import">
      <summary>{t("klarawissen.import")}</summary>
      <p>{t("klarawissen.importHilfe")}</p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setLaeuft(true);
          setFehler("");
          void klaraWissenApi
            .importiere({
              titel,
              inhalt,
              projekt,
              abschnitt,
              antwortFassung: fassung,
              anbieter: anbieter || null,
              modell: modell || null,
              aussagen: inhalt
                .split("\n")
                .filter((s) => s.trim())
                .map((text, i) => ({ text, art: arten[i] ?? "behauptung", quellen: [] })),
            })
            .then(async (r) => {
              await ladeNotizen(t);
              await oeffneNotiz(r.notiz.id, t);
            })
            .catch((e) => setFehler(e.message))
            .finally(() => setLaeuft(false));
        }}
      >
        {[
          ["titel", titel, setTitel],
          ["projekt", projekt, setProjekt],
          ["abschnitt", abschnitt, setAbschnitt],
          ["fassung", fassung, setFassung],
          ["anbieter", anbieter, setAnbieter],
          ["modell", modell, setModell],
        ].map(([name, wert, setter]) => (
          <label key={String(name)}>
            {t(`klarawissen.${name}`)}
            <input
              data-testid={`wissen-import-${name}`}
              className={feld}
              value={String(wert)}
              onChange={(e) => (setter as (s: string) => void)(e.target.value)}
              required={!["anbieter", "modell"].includes(String(name))}
            />
          </label>
        ))}
        <label>
          {t("klarawissen.text")}
          <textarea
            data-testid="wissen-import-text"
            className={feld}
            value={inhalt}
            maxLength={20000}
            onChange={(e) => {
              setInhalt(e.target.value);
              setArten({});
            }}
            required
          />
        </label>
        {inhalt
          .split("\n")
          .filter((s) => s.trim())
          .map((zeile, i) => (
            <label key={`${i}-${zeile}`}>
              {zeile}
              <select
                className={feld}
                aria-label={t("klarawissen.art")}
                value={arten[i] ?? "behauptung"}
                onChange={(e) => setArten({ ...arten, [i]: e.target.value })}
              >
                {["behauptung", "empfehlung", "kreativ", "nutzerentscheidung"].map((a) => (
                  <option key={a} value={a}>
                    {t(`klarawissen.${a}`)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        <button
          className={knopf}
          data-testid="wissen-import-speichern"
          disabled={laeuft}
          type="submit"
        >
          {t("klarawissen.privatSpeichern")}
        </button>
        {fehler ? <p role="alert">{fehler}</p> : null}
      </form>
    </details>
  );
}
