import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { officeArtikel } from "../../api/officeArtikel";
import type { FolienDatenLage, Ort } from "../../api/praesentationDaten";
import {
  type ErgaenzungsErgebnis,
  type ErgaenzungsSuche,
  type ErgaenzungsVorschau,
  praesentationErgaenzung,
} from "../../api/praesentationErgaenzung";

// Kontextaktion im vorhandenen Folienelement. Nur bewusstes Übernehmen ändert die Datei.
export function DatenErgaenzung({
  lage,
  ort,
  fertig,
  herkunft,
}: {
  lage: FolienDatenLage;
  ort: Ort;
  fertig: () => void;
  herkunft: (id: string, ausloeser?: HTMLButtonElement) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const id = useId();
  const [offen, setOffen] = useState(false);
  const [luecke, setLuecke] = useState<ErgaenzungsSuche["luecke"]>({
    zeitraum: "",
    einheit: "",
    waehrung: "",
    bezugsgroesse: "",
    verwendung: "beobachtet",
  });
  const [quelle, setQuelle] = useState("");
  const [vorschau, setVorschau] = useState<ErgaenzungsVorschau | null>(null);
  const [suche, setSuche] = useState<ErgaenzungsSuche | null>(null);
  const [ergebnis, setErgebnis] = useState<ErgaenzungsErgebnis | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);
  const [fehler, setFehler] = useState("");
  const [bericht, setBericht] = useState<string[]>([]);
  const [teilRuecknahme, setTeilRuecknahme] = useState<{
    ausFassung: number;
    fassung: number;
  } | null>(null);
  const quellen = useQuery({
    queryKey: ["pp06-quellartikel"],
    queryFn: () => endpoints.ko.list(),
    enabled: offen,
  });
  const ausfuehren = async (aktion: () => Promise<void>) => {
    setBeschaeftigt(true);
    setFehler("");
    try {
      await aktion();
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t("ergaenzung.fehler"));
      if (e instanceof ApiError && e.details.dokument && typeof e.details.dokument === "object") {
        const d = e.details.dokument as Record<string, unknown>;
        const zeilen = Array.isArray(d.aenderungsuebersicht) ? d.aenderungsuebersicht : [];
        setBericht(
          zeilen.flatMap((z: unknown) =>
            z && typeof z === "object" && "grund" in z && typeof z.grund === "string"
              ? [z.grund]
              : [],
          ),
        );
        const r = d.ruecknahme;
        if (
          typeof d.neueFassung === "number" &&
          r &&
          typeof r === "object" &&
          "ausFassung" in r &&
          typeof r.ausFassung === "number"
        ) {
          setTeilRuecknahme({ ausFassung: r.ausFassung, fassung: d.neueFassung });
        }
        setVorschau(null);
        fertig();
      }
    } finally {
      setBeschaeftigt(false);
    }
  };
  return (
    <details className="mt-1" onToggle={(e) => setOffen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-muted">{t("ergaenzung.titel")}</summary>
      {offen ? (
        <div className="mt-2 rounded-card border border-hairline p-2" data-pp06="">
          <p>{t("ergaenzung.hinweis")}</p>
          {ergebnis ? (
            <div aria-live="polite">
              <p>{t("ergaenzung.gespeichert")}</p>
              <button
                type="button"
                data-datenpunkt={ergebnis.datenpunktId}
                onClick={(e) => herkunft(ergebnis.datenpunktId, e.currentTarget)}
                className="underline"
              >
                {t("ergaenzung.herkunft")}
              </button>
              {ergebnis.dokument.ruecknahme?.moeglich ? (
                <button
                  type="button"
                  disabled={beschaeftigt}
                  className="ml-2 underline"
                  onClick={() =>
                    void ausfuehren(async () => {
                      await officeArtikel.zurueckholen(
                        lage.koId,
                        lage.anhangId,
                        ergebnis.dokument.ruecknahme?.ausFassung ?? 0,
                        ergebnis.dokument.neueFassung,
                      );
                      setErgebnis(null);
                      setVorschau(null);
                      fertig();
                    })
                  }
                >
                  {t("ergaenzung.ruecknahme")}
                </button>
              ) : null}
            </div>
          ) : (
            <form
              data-ungespeichert=""
              onSubmit={(e) => {
                e.preventDefault();
                const s: ErgaenzungsSuche = {
                  ort,
                  luecke,
                  quellArtikelIds: quelle ? [quelle] : [],
                };
                void ausfuehren(async () => {
                  setVorschau(null);
                  const v = await praesentationErgaenzung.vorschau(lage.koId, s);
                  setSuche(s);
                  setVorschau(v);
                });
              }}
            >
              <fieldset
                disabled={beschaeftigt}
                className="mt-2 space-y-2"
                onChange={() => setVorschau(null)}
              >
                <label className="block" htmlFor={`${id}-quelle`}>
                  {t("ergaenzung.quelle")}
                </label>
                <select
                  data-pp06-quelle=""
                  id={`${id}-quelle`}
                  value={quelle}
                  onChange={(e) => setQuelle(e.target.value)}
                  className="w-full rounded-input border border-hairline bg-surface text-text"
                >
                  <option value="">{t("ergaenzung.eigenerArtikel")}</option>
                  {quellen.data
                    ?.filter((q) => q.id !== lage.koId)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                </select>
                {quellen.isError ? <p role="alert">{t("ergaenzung.quellenFehler")}</p> : null}
                {(["zeitraum", "einheit", "waehrung", "bezugsgroesse"] as const).map((feld) => (
                  <label key={feld} className="block">
                    {t(`ergaenzung.${feld}`)}
                    <input
                      data-pp06-feld={feld}
                      maxLength={feld === "waehrung" ? 20 : feld === "bezugsgroesse" ? 200 : 100}
                      className="block w-full rounded-input border border-hairline bg-surface text-text"
                      value={luecke[feld]}
                      onChange={(e) => setLuecke((l) => ({ ...l, [feld]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="block">
                  {t("ergaenzung.verwendung")}
                  <select
                    className="block w-full rounded-input border border-hairline bg-surface text-text"
                    value={luecke.verwendung}
                    onChange={(e) =>
                      setLuecke((l) => ({
                        ...l,
                        verwendung: e.target.value as "beobachtet" | "prognose",
                      }))
                    }
                  >
                    <option value="beobachtet">{t("ergaenzung.beobachtet")}</option>
                    <option value="prognose">{t("ergaenzung.prognose")}</option>
                  </select>
                </label>
                <button
                  type="submit"
                  data-pp06-suchen=""
                  className="rounded-btn border border-hairline px-2 py-1"
                >
                  {t("ergaenzung.suchen")}
                </button>
              </fieldset>
            </form>
          )}
          {vorschau && !ergebnis ? (
            <div aria-live="polite">
              <p className="mt-2 font-semibold">{t("ergaenzung.vorschau")}</p>
              <p>{t("ergaenzung.alt", { text: vorschau.alt })}</p>
              {vorschau.gruende.map((g) => (
                <p key={g} className="text-trust-crit-text">
                  {g}
                </p>
              ))}
              <ul className="space-y-2">
                {vorschau.kandidaten.map((k) => (
                  <li
                    key={k.datenpunkt.id}
                    data-pp06-kandidat={k.datenpunkt.id}
                    data-passend={k.passend}
                    className="mt-2 border-t border-hairline pt-2"
                  >
                    <p>{k.neu}</p>
                    <p>
                      {t(`praesentationdaten.erfassung.${k.datenpunkt.erfassung}`)} ·{" "}
                      {t(
                        `praesentationdaten.zustand.${k.datenpunkt.kontrolle?.zustand ?? k.datenpunkt.pruefstand.zustand}`,
                      )}
                    </p>
                    {k.gruende.map((g) => (
                      <p key={g} className="text-trust-crit-text">
                        {g}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="underline"
                      data-datenpunkt={k.datenpunkt.id}
                      onClick={(e) => herkunft(k.datenpunkt.id, e.currentTarget)}
                    >
                      {t("ergaenzung.herkunft")}
                    </button>
                    {k.passend ? (
                      <button
                        type="button"
                        data-pp06-uebernehmen=""
                        disabled={beschaeftigt}
                        className="ml-2 rounded-btn border border-hairline px-2 py-1"
                        onClick={() =>
                          void ausfuehren(async () => {
                            if (!suche) return;
                            const r = await praesentationErgaenzung.uebernehmen(
                              lage.koId,
                              suche,
                              k.datenpunkt.id,
                              k.token,
                            );
                            setErgebnis(r);
                            setVorschau(null);
                            fertig();
                          })
                        }
                      >
                        {t("ergaenzung.uebernehmen")}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {beschaeftigt ? <output>{t("ergaenzung.arbeitet")}</output> : null}
          {fehler ? (
            <p role="alert" className="text-trust-crit-text">
              {fehler}
            </p>
          ) : null}
          {bericht.map((g) => (
            <p key={g}>{g}</p>
          ))}
          {teilRuecknahme ? (
            <button
              type="button"
              disabled={beschaeftigt}
              className="underline"
              onClick={() =>
                void ausfuehren(async () => {
                  await officeArtikel.zurueckholen(
                    lage.koId,
                    lage.anhangId,
                    teilRuecknahme.ausFassung,
                    teilRuecknahme.fassung,
                  );
                  setTeilRuecknahme(null);
                  setBericht([]);
                  setFehler("");
                  fertig();
                })
              }
            >
              {t("ergaenzung.ruecknahme")}
            </button>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
